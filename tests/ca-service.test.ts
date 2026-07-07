/**
 * CA service contract tests — pure logic, no sockets, no live OIDC.
 * Run with: node --test tests/ca-service.test.ts
 *
 * Covers the HMAC token scheme, proof-of-possession, the full enrollment
 * issue path (root generated in-test, leaf checked with the engine's
 * independent parseCertificate), the origin allowlist and the dev-provider
 * gate — everything the identity bridge is built against.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mintEnrollToken as _mintEnrollToken,
  verifyEnrollToken as _verifyEnrollToken,
  verifyValue as _verifyValue,
} from '../services/ca/lib/tokens.mjs';
import { verifyPop as _verifyPop, enroll as _enroll } from '../services/ca/lib/enroll.mjs';
import {
  isAllowedOrigin as _isAllowedOrigin,
  routeAuth as _routeAuth,
  routeEmailStart as _routeEmailStart,
  routeHealth as _routeHealth,
  routeRootPem as _routeRootPem,
} from '../services/ca/handler.mjs';
import { generateCaRoot, derToPem, pemToDer } from '../engine/src/x509.ts';
import { parseCertificate } from '../engine/src/c2pa-verify.ts';

// The CA service modules are untyped .mjs; their inferred shapes are noisier than
// this test needs. Treat them as `any` at the boundary — the engine imports above
// stay precisely typed.
/* eslint-disable @typescript-eslint/no-explicit-any */
const mintEnrollToken: any = _mintEnrollToken;
const verifyEnrollToken: any = _verifyEnrollToken;
const verifyValue: any = _verifyValue;
const verifyPop: any = _verifyPop;
const enroll: any = _enroll;
const isAllowedOrigin: any = _isAllowedOrigin;
const routeAuth: any = _routeAuth;
const routeEmailStart: any = _routeEmailStart;
const routeHealth: any = _routeHealth;
const routeRootPem: any = _routeRootPem;

const SECRET = 'test-secret';
const DAY = 24 * 3600 * 1000;
const te = new TextEncoder();
const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');

// A fresh root + the env the handler/enroll logic reads.
async function testEnv() {
  const root = await generateCaRoot({ commonName: 'CA Test Root', organization: 'LollyTest' });
  return {
    root,
    env: {
      CA_SERVICE_SECRET: SECRET,
      CA_ROOT_CERT_PEM: derToPem(root.certDer, 'CERTIFICATE'),
      CA_ROOT_KEY_PEM: derToPem(root.pkcs8Der, 'PRIVATE KEY'),
      CA_ALLOWED_ORIGINS: 'https://lolly.tools',
    },
  };
}

// What the device does: P-256 pair, raw SPKI, PoP = ECDSA over the token string.
async function deviceEnrollArgs(token: string) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const spkiDer = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const pop = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, te.encode(token)));
  return { spki: b64u(spkiDer), pop: b64u(pop), spkiDer };
}

// ─── enrollment tokens ────────────────────────────────────────────────────────

test('enrollment token: mint → verify roundtrip carries identity + 10-min window', async () => {
  const token = await mintEnrollToken({ email: 'a@b.co', provider: 'github' }, SECRET);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'payloadB64.macB64 shape');
  const v = await verifyEnrollToken(token, SECRET);
  assert.equal(v.ok, true);
  assert.equal(v.payload.email, 'a@b.co');
  assert.equal(v.payload.provider, 'github');
  assert.equal(v.payload.exp - v.payload.iat, 600);
});

test('enrollment token: expiry and tampering are rejected', async () => {
  const expired = await mintEnrollToken({ email: 'a@b.co', provider: 'dev' }, SECRET, -10);
  const e = await verifyEnrollToken(expired, SECRET);
  assert.equal(e.ok, false);
  assert.match(e.error, /expired/);

  const token = await mintEnrollToken({ email: 'a@b.co', provider: 'dev' }, SECRET);
  const [, mac] = token.split('.');
  // swap the payload, keep the MAC — signature must not verify
  const forgedBody = Buffer.from(JSON.stringify({ email: 'evil@x.co', provider: 'dev', iat: 0, exp: 9999999999 })).toString('base64url');
  assert.equal((await verifyEnrollToken(`${forgedBody}.${mac}`, SECRET)).ok, false);
  // wrong secret, wrong shape, empty
  assert.equal(await verifyValue(token, 'not-the-secret'), null);
  assert.equal(await verifyValue('garbage', SECRET), null);
  assert.equal((await verifyEnrollToken('', SECRET)).ok, false);
});

// ─── proof of possession ──────────────────────────────────────────────────────

test('verifyPop: accepts the presenting key, rejects everything else', async () => {
  const token = await mintEnrollToken({ email: 'pop@x.co', provider: 'dev' }, SECRET);
  const { spki, pop } = await deviceEnrollArgs(token);
  assert.equal((await verifyPop({ token, spki, pop })).ok, true);

  // a DIFFERENT key's signature over the same token
  const other = await deviceEnrollArgs(token);
  const cross = await verifyPop({ token, spki, pop: other.pop });
  assert.equal(cross.ok, false);
  assert.match(cross.error, /does not verify/);

  // right key, wrong message
  const { pop: wrongMsg } = { pop: b64u(new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])).privateKey,
    te.encode('some other bytes'),
  ))) };
  assert.equal((await verifyPop({ token, spki, pop: wrongMsg })).ok, false);

  // wrong signature length / garbage SPKI
  assert.equal((await verifyPop({ token, spki, pop: b64u(new Uint8Array(70)) })).ok, false);
  assert.equal((await verifyPop({ token, spki: b64u(new Uint8Array(20)), pop })).ok, false);
});

// ─── the full enroll path ─────────────────────────────────────────────────────

test('enroll: token + PoP → default-lifetime leaf chained to the root', async () => {
  const { root, env } = await testEnv();
  const token = await mintEnrollToken({ email: 'andy@example.com', provider: 'github' }, SECRET);
  const { spki, pop, spkiDer } = await deviceEnrollArgs(token);

  const result = await enroll({ token, spki, pop }, env);
  assert.equal(result.status, 200, JSON.stringify(result.json));
  const { cert, chain, identity, notBefore, notAfter } = result.json;
  assert.equal(identity.email, 'andy@example.com');
  assert.equal(identity.provider, 'github');
  assert.equal(chain.length, 2, 'chain is leaf-first [leaf, root]');
  assert.equal(chain[0], cert);
  assert.equal(hex(pemToDer(chain[1])), hex(root.certDer), 'chain[1] is the root');

  const certDer = pemToDer(cert);
  const parsed = parseCertificate(certDer);
  const rootParsed = parseCertificate(root.certDer);
  // issuer == the root's subject
  assert.equal(parsed.issuer.commonName, rootParsed.subject.commonName);
  assert.equal(parsed.issuer.organization, rootParsed.subject.organization);
  assert.equal(parsed.subject.commonName, 'andy@example.com');
  assert.equal(parsed.selfSigned, false);
  // default 30-day window; reported ISO strings mirror the cert to the second
  assert.equal(parsed.notBefore.toISOString(), notBefore);
  assert.equal(parsed.notAfter.toISOString(), notAfter);
  assert.equal(parsed.notAfter.getTime() - parsed.notBefore.getTime(), 30 * DAY);
  // SAN rfc822Name ([1] IMPLICIT IA5String) carries the email
  const san = new Uint8Array([0x81, 'andy@example.com'.length, ...te.encode('andy@example.com')]);
  assert.ok(hex(certDer).includes(hex(san)), 'SAN rfc822Name = the verified email');
  // the presented SPKI is the certified key, verbatim
  assert.ok(hex(certDer).includes(hex(spkiDer)));
});

test('enroll: days ∈ {7,30,90,365} honoured, anything else falls back', async () => {
  const { env } = await testEnv();
  const token = await mintEnrollToken({ email: 'd@x.co', provider: 'dev' }, SECRET);
  const args = await deviceEnrollArgs(token);
  const month = await enroll({ token, ...args, days: 30 }, env);
  assert.equal(month.status, 200);
  assert.equal(new Date(month.json.notAfter).getTime() - new Date(month.json.notBefore).getTime(), 30 * DAY);
  const odd = await enroll({ token, ...args, days: 12 }, env);
  assert.equal(new Date(odd.json.notAfter).getTime() - new Date(odd.json.notBefore).getTime(), 30 * DAY, 'off-menu lifetime → default');
});

test('enroll: bad inputs are 400/401, never certs', async () => {
  const { env } = await testEnv();
  assert.equal((await enroll({}, env)).status, 400);
  assert.equal((await enroll(undefined, env)).status, 400);

  // token signed with another secret
  const foreign = await mintEnrollToken({ email: 'x@y.co', provider: 'dev' }, 'not-the-secret');
  assert.equal((await enroll({ token: foreign, ...(await deviceEnrollArgs(foreign)) }, env)).status, 401);
  // expired token
  const expired = await mintEnrollToken({ email: 'x@y.co', provider: 'dev' }, SECRET, -10);
  assert.equal((await enroll({ token: expired, ...(await deviceEnrollArgs(expired)) }, env)).status, 401);
  // valid token, PoP from a different key
  const token = await mintEnrollToken({ email: 'x@y.co', provider: 'dev' }, SECRET);
  const { spki } = await deviceEnrollArgs(token);
  const { pop: otherPop } = await deviceEnrollArgs(token);
  assert.equal((await enroll({ token, spki, pop: otherPop }, env)).status, 401);
});

// ─── origin allowlist ─────────────────────────────────────────────────────────

test('routeAuth enforces the origin allowlist before anything else', async () => {
  const { env } = await testEnv();
  const redirectUri = 'https://lolly.tools/api/ca/callback/github';
  assert.equal((await routeAuth(env, { provider: 'github', origin: 'https://evil.example', redirectUri })).status, 403);
  assert.equal((await routeAuth(env, { provider: 'github', origin: null, redirectUri })).status, 403);
  // allowlisted origin gets PAST the gate — github unconfigured here → 501
  assert.equal((await routeAuth(env, { provider: 'github', origin: 'https://lolly.tools', redirectUri })).status, 501);

  // localhost is only implicitly allowed when the dev flag is on
  assert.equal(isAllowedOrigin('http://localhost:5173', env), false);
  assert.equal(isAllowedOrigin('http://localhost:5173', { ...env, CA_DEV_FAKE_PROVIDER: '1' }), true);
  assert.equal(isAllowedOrigin('http://evil.example', { ...env, CA_DEV_FAKE_PROVIDER: '1' }), false);
  assert.equal(isAllowedOrigin('https://lolly.tools', env), true);
});

test('routeEmailStart: origin gate, syntax check, 501 without Resend config', async () => {
  const { env } = await testEnv();
  assert.equal((await routeEmailStart(env, { email: 'a@b.co', origin: 'https://evil.example' })).status, 403);
  assert.equal((await routeEmailStart(env, { email: 'not-an-email', origin: 'https://lolly.tools' })).status, 400);
  assert.equal((await routeEmailStart(env, { email: 'a@b.co', origin: 'https://lolly.tools' })).status, 501);
});

// ─── dev provider ─────────────────────────────────────────────────────────────

test('dev provider: gated off without the flag, full auth → enroll loop with it', async () => {
  const { env } = await testEnv();
  const off = await routeAuth(env, { provider: 'dev', origin: 'https://lolly.tools', redirectUri: 'x' });
  assert.equal(off.status, 404, 'dev provider does not exist without CA_DEV_FAKE_PROVIDER=1');

  const devEnv = { ...env, CA_DEV_FAKE_PROVIDER: '1' };
  const on = await routeAuth(devEnv, { provider: 'dev', origin: 'http://localhost:5173', redirectUri: 'x' });
  assert.equal(on.status, 200);
  assert.match(on.type, /text\/html/);
  assert.ok(on.body.includes('"source":"lolly-ca"'), 'completion page posts a lolly-ca message');
  assert.ok(on.body.includes(JSON.stringify('http://localhost:5173')), 'postMessage target is the requesting origin, not *');

  // pull the token out of the postMessage payload and run the real enrollment
  const m = on.body.match(/"token":"([^"]+)"/);
  assert.ok(m, 'completion page embeds the enrollment token');
  const result = await enroll({ token: m[1], ...(await deviceEnrollArgs(m[1])) }, devEnv);
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.identity.email, 'dev@example.com');
  assert.equal(result.json.identity.provider, 'dev');
});

// ─── health + root.pem ────────────────────────────────────────────────────────

test('health reports the dev flag + per-provider config; root.pem serves the PEM', async () => {
  const { env } = await testEnv();
  const h = routeHealth({ ...env, GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'sec' });
  assert.equal(h.status, 200);
  assert.equal(h.json.ok, true);
  assert.equal(h.json.devProvider, false);
  assert.deepEqual(h.json.configured, { github: true, google: false, suse: false, email: false });
  assert.equal(routeHealth({ ...env, CA_DEV_FAKE_PROVIDER: '1' }).json.devProvider, true);

  const pem = routeRootPem(env);
  assert.equal(pem.status, 200);
  assert.ok(pem.body.startsWith('-----BEGIN CERTIFICATE-----'));
  assert.match(pem.type, /text\/plain/);
  assert.equal(routeRootPem({}).status, 404, 'unset root → 404 with a plain message');
});
