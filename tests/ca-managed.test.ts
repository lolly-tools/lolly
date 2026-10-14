// SPDX-License-Identifier: MPL-2.0
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { asBufferSource } from '../engine/src/bytes.ts';
import { createEnrollmentCsr, enrollmentProofMessage, parseEnrollmentTrustBundle, validateEnrollmentChain, validateEnrollmentCrl, verifyEnrollmentRequest, revocationProofMessage } from '../engine/src/enrollment.ts';
import { generateCaRoot, derToPem, pemToDer } from '../engine/src/x509.ts';
import { enroll as _enroll } from '../services/ca/lib/enroll.mjs';
import { managedEnroll as _managedEnroll, managedRevocationChallenge as _challenge, managedRevoke as _revoke, issuerMode as _mode } from '../services/ca/lib/managed-enroll.mjs';
import { mintEnrollToken as _mint } from '../services/ca/lib/tokens.mjs';
import { consumeEnrollment as _consume } from '../services/ca/lib/enrollment-admission.mjs';
import { createVaultPki as _createVaultPki } from '../services/ca/lib/vault-pki.mjs';
import { validateEnrollmentResponse, fetchEnrollmentCrl } from '../shells/web/src/bridge/enrollment-policy.ts';

const enroll: any = _enroll, managedEnroll: any = _managedEnroll, challenge: any = _challenge, revoke: any = _revoke, mode: any = _mode, mint: any = _mint, consume: any = _consume, createVaultPki: any = _createVaultPki;
const run = promisify(execFile);
const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64url');
const te = new TextEncoder();
const OID = '1.3.6.1.4.1.55555.1.1';
let dir: string, root: Awaited<ReturnType<typeof generateCaRoot>>, mid: Uint8Array, crl: Uint8Array, trustJson: string, env: any;
let serial = 1000;
const command = async (...args: string[]): Promise<void> => { await run('openssl', args, { maxBuffer: 256 * 1024 }); };

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'lolly-enrollment-'));
  root = await generateCaRoot({ commonName: 'Disposable Root', organization: 'Example' });
  await writeFile(join(dir, 'root.pem'), derToPem(root.certDer, 'CERTIFICATE'));
  await writeFile(join(dir, 'root-key.pem'), derToPem(root.pkcs8Der, 'PRIVATE KEY'), { mode: 0o600 });
  await command('genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:P-256', '-out', join(dir, 'mid-key.pem'));
  await command('req', '-new', '-key', join(dir, 'mid-key.pem'), '-subj', '/O=Example/CN=Disposable Intermediate', '-out', join(dir, 'mid.csr'));
  await writeFile(join(dir, 'mid-ext.ini'), 'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nnameConstraints=critical,permitted;email:example.test\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n');
  await command('x509', '-req', '-in', join(dir, 'mid.csr'), '-CA', join(dir, 'root.pem'), '-CAkey', join(dir, 'root-key.pem'), '-set_serial', '5', '-days', '30', '-extfile', join(dir, 'mid-ext.ini'), '-out', join(dir, 'mid.pem'));
  mid = pemToDer(await readFile(join(dir, 'mid.pem'), 'utf8'));
  await writeFile(join(dir, 'index'), '');
  await writeFile(join(dir, 'serial'), '1000\n');
  await writeFile(join(dir, 'ca.ini'), `[ca]\ndefault_ca=issuer\n[issuer]\ndatabase=${join(dir, 'index')}\nserial=${join(dir, 'serial')}\nnew_certs_dir=${dir}\ncertificate=${join(dir, 'mid.pem')}\nprivate_key=${join(dir, 'mid-key.pem')}\ndefault_md=sha256\npolicy=names\ndefault_days=1\ndefault_crl_hours=1\n[names]\norganizationName=optional\ncommonName=optional\n`);
  await command('ca', '-gencrl', '-config', join(dir, 'ca.ini'), '-out', join(dir, 'crl.pem'));
  crl = pemToDer(await readFile(join(dir, 'crl.pem'), 'utf8'));
  trustJson = JSON.stringify({ version: 1, roots: [derToPem(root.certDer, 'CERTIFICATE')], issuers: [{ id: 'issuer-one', certificate: derToPem(mid, 'CERTIFICATE') }], providers: { suse: { issuer: 'issuer-one', policyOid: OID, domains: ['example.test'] } }, defaultLifetimeSeconds: 86400, maxLifetimeSeconds: 604800, crlMaxAgeSeconds: 3600, unifiedCrl: false });
  env = { CA_ISSUER_MODE: 'vault-pki', CA_SERVICE_SECRET: 'disposable-admission-secret', CA_ENROLLMENT_TRUST_JSON: trustJson, CA_VAULT_ROLES_JSON: JSON.stringify({ suse: { role: 'device-role', managedKeyId: 'approved-key', issuerKeyId: 'issuer-key' } }), CA_ENROLLMENT_ALLOW_MEMORY: '1' };
});
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

async function args(provider = 'suse', email = 'device@example.test') {
  const token = await mint({ email, provider }, env.CA_SERVICE_SECRET);
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const csr = await createEnrollmentCsr(pair);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const pop = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, asBufferSource(await enrollmentProofMessage(token, csr))));
  return { body: { version: 2, token, csr: b64(csr), spki: b64(spki), pop: b64(pop) }, csr, spki, pair, pop };
}
async function issue(csrPem: string, email = 'device@example.test', extra = '', days = 1): Promise<Uint8Array> {
  const id = String(serial++);
  await writeFile(join(dir, `${id}.csr`), csrPem);
  await writeFile(join(dir, `${id}.ini`), `basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\nsubjectAltName=email:${email}\ncertificatePolicies=${OID}\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n${extra}`);
  await command('x509', '-req', '-in', join(dir, `${id}.csr`), '-CA', join(dir, 'mid.pem'), '-CAkey', join(dir, 'mid-key.pem'), '-set_serial', id, '-days', String(days), '-subj', `/O=Example/CN=${email}`, '-extfile', join(dir, `${id}.ini`), '-out', join(dir, `${id}.pem`));
  return pemToDer(await readFile(join(dir, `${id}.pem`), 'utf8'));
}
function adapter(signImpl?: (body: any) => Promise<Uint8Array>) {
  let issued = 0;
  return {
    get issued() { return issued; },
    async verifyProfile() {},
    async sign(role: string, body: any) {
      assert.equal(role, 'device-role'); assert.equal(body.exclude_cn_from_sans, true); assert.equal(body.ttl, '86400s');
      issued++;
      const cert = signImpl ? await signImpl(body) : await issue(body.csr, body.alt_names);
      return { certificate: derToPem(cert, 'CERTIFICATE'), ca_chain: [derToPem(mid, 'CERTIFICATE'), derToPem(root.certDer, 'CERTIFICATE')] };
    },
    async crl() { return crl; },
    async revoke(cert: string) { assert.match(cert, /^-----BEGIN CERTIFICATE-----/); return { revocation_time: Math.floor(Date.now() / 1000) }; },
  };
}

test('versioned CSR is accepted by independent OpenSSL and binds both proofs to one key', async () => {
  const a = await args();
  await writeFile(join(dir, 'device.csr'), derToPem(a.csr, 'CERTIFICATE REQUEST'));
  await command('req', '-in', join(dir, 'device.csr'), '-verify', '-noout');
  await verifyEnrollmentRequest(a.csr, a.spki, a.pop, a.body.token);
  const b = await args();
  await assert.rejects(verifyEnrollmentRequest(a.csr, b.spki, a.pop, a.body.token), /key does not match/);
  await assert.rejects(verifyEnrollmentRequest(a.csr, a.spki, b.pop, a.body.token), /proof does not verify/);
  await assert.rejects(verifyEnrollmentRequest(a.csr, a.spki, a.pop, b.body.token), /proof does not verify/);
  const changed = a.csr.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  await assert.rejects(verifyEnrollmentRequest(changed, a.spki, a.pop, a.body.token), /signature/);
  await assert.rejects(verifyEnrollmentRequest(new Uint8Array(4097), a.spki, a.pop, a.body.token), /size/);
});

test('managed enrollment yields a constrained chain and never reads local authority key', async () => {
  const a = await args();
  const provider = adapter();
  const guardedEnv = { ...env, get CA_ROOT_KEY_PEM() { throw new Error('Local authority key was read'); } };
  const result = await enroll(a.body, guardedEnv, { adapter: provider });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.version, 2); assert.equal(result.json.issuer, 'issuer-one');
  const chain = result.json.chain.map(pemToDer);
  const checked = await validateEnrollmentChain(chain, { roots: [root.certDer], issuer: mid, email: 'device@example.test', policyOid: OID, spki: a.spki, maxLifetimeSeconds: 86400 });
  assert.equal(checked.leaf.sanEmails[0], 'device@example.test');
  await command('verify', '-CAfile', join(dir, 'root.pem'), '-untrusted', join(dir, 'mid.pem'), join(dir, `${serial - 1}.pem`));
  assert.equal(provider.issued, 1);
});

test('concurrent and repeated enrollment consumes authentication before provider side effects', async () => {
  const a = await args(), provider = adapter();
  const results = await Promise.all(Array.from({ length: 8 }, () => managedEnroll(a.body, env, { adapter: provider })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 7);
  assert.equal(provider.issued, 1);
  assert.equal((await managedEnroll(a.body, env, { adapter: provider })).status, 409);
});

test('provider failure does not release admission or issue through a local authority', async () => {
  const a = await args(); let calls = 0;
  const failed = { async verifyProfile() {}, async sign() { calls++; throw new Error('Unavailable'); } };
  assert.equal((await managedEnroll(a.body, env, { adapter: failed })).status, 502);
  assert.equal((await managedEnroll(a.body, env, { adapter: failed })).status, 409);
  assert.equal(calls, 1);
});

test('provider identities, lifetimes, protocol and unconfigured policy fail before issuance', async () => {
  const provider = adapter();
  for (const a of [await args('google'), await args('suse', 'device@elsewhere.test')]) assert.equal((await managedEnroll(a.body, env, { adapter: provider })).status, 400);
  const a = await args();
  for (const lifetimeSeconds of [59, 604801, NaN, '86400']) assert.equal((await managedEnroll({ ...a.body, lifetimeSeconds }, env, { adapter: provider })).status, 400);
  assert.equal((await managedEnroll({ ...a.body, version: 1 }, env, { adapter: provider })).status, 400);
  assert.equal((await managedEnroll(a.body, { ...env, CA_ENROLLMENT_TRUST_JSON: '' }, { adapter: provider })).status, 503);
  assert.equal(provider.issued, 0);
  assert.throws(() => mode({ CA_VAULT_ADDR: 'https://vault.example.test' }), /explicit/);
  assert.throws(() => mode({ CA_ISSUER_MODE: 'legacy-root', CA_VAULT_ADDR: 'https://vault.example.test' }), /explicit/);
  assert.throws(() => parseEnrollmentTrustBundle(JSON.stringify({ version: 1 })), /configuration/);
});

test('pinned certificate validation rejects identity, policy, key, root, lifetime and changed bytes', async () => {
  const a = await args();
  const cert = await issue(derToPem(a.csr, 'CERTIFICATE REQUEST'));
  const policy = { roots: [root.certDer], issuer: mid, email: 'device@example.test', policyOid: OID, spki: a.spki, maxLifetimeSeconds: 86400 };
  await validateEnrollmentChain([cert, mid], policy);
  for (const patch of [{ email: 'other@example.test' }, { policyOid: '1.3.6.1.4.1.55555.1.2' }, { spki: (await args()).spki }, { roots: [(await generateCaRoot()).certDer] }, { maxLifetimeSeconds: 3600 }]) await assert.rejects(validateEnrollmentChain([cert, mid], { ...policy, ...patch }));
  const changed = cert.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  await assert.rejects(validateEnrollmentChain([changed, mid], policy), /signature/);
  await assert.rejects(validateEnrollmentChain([cert, mid, mid], policy), /approved root/);
  const outside = await issue(derToPem(a.csr, 'CERTIFICATE REQUEST'), 'device@elsewhere.test');
  await assert.rejects(validateEnrollmentChain([outside, mid], { ...policy, email: 'device@elsewhere.test' }), /name constraints/);
  const ca = await issue(derToPem(a.csr, 'CERTIFICATE REQUEST'), 'device@example.test', 'basicConstraints=critical,CA:TRUE\n');
  await assert.rejects(validateEnrollmentChain([ca, mid], policy), /Leaf/);
  const forbidden = await issue(derToPem(a.csr, 'CERTIFICATE REQUEST'), 'device@example.test', 'extendedKeyUsage=serverAuth\n');
  await assert.rejects(validateEnrollmentChain([forbidden, mid], policy), /Leaf/);
  const unknown = await issue(derToPem(a.csr, 'CERTIFICATE REQUEST'), 'device@example.test', '1.3.6.1.4.1.55555.9=critical,DER:05:00\n');
  await assert.rejects(validateEnrollmentChain([unknown, mid], policy), /critical/);
});

test('signed CRL freshness and issuer validation are required by service and shell', async () => {
  const checked = await validateEnrollmentCrl(crl, mid, 3600);
  assert.equal(checked.revokedSerials.length, 0);
  await command('crl', '-in', join(dir, 'crl.pem'), '-CAfile', join(dir, 'mid.pem'), '-verify', '-noout');
  await assert.rejects(validateEnrollmentCrl(crl, root.certDer, 3600), /issuer/);
  await assert.rejects(validateEnrollmentCrl(crl, mid, 3600, checked.nextUpdate + 1), /fresh/);
  const changed = crl.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  await assert.rejects(validateEnrollmentCrl(changed, mid, 3600), /signature/);
  const trust = parseEnrollmentTrustBundle(trustJson);
  const bytes = await fetchEnrollmentCrl('issuer-one', trust, async (url, init) => {
    assert.equal(url, '/api/ca/issuer/issuer-one/crl'); assert.equal(init?.redirect, 'error');
    return new Response(asBufferSource(crl));
  });
  assert.deepEqual(bytes, crl);
  await assert.rejects(fetchEnrollmentCrl('unapproved', trust), /trusted/);
});

test('shell enrollment validates independently against build-distributed trust', async () => {
  const a = await args(); const result = await managedEnroll(a.body, env, { adapter: adapter() });
  const trust = parseEnrollmentTrustBundle(trustJson);
  await validateEnrollmentResponse(result.json, a.spki, trust);
  await assert.rejects(validateEnrollmentResponse(result.json, (await args()).spki, trust), /device/);
  await assert.rejects(validateEnrollmentResponse({ ...result.json, issuerMode: 'legacy-root' }, a.spki, trust), /policy/);
  await assert.rejects(validateEnrollmentResponse(result.json, a.spki, null), /trusted/);
  await assert.rejects(validateEnrollmentResponse({ ...result.json, notAfter: new Date().toISOString() }, a.spki, trust), /device/);
});

test('certificate revocation requires device-bound proof and a one-use challenge', async () => {
  const a = await args(), provider = adapter();
  const result = await managedEnroll(a.body, env, { adapter: provider });
  const request = { issuer: 'issuer-one', provider: 'suse', certificate: result.json.cert };
  const response = await challenge(env, request); assert.equal(response.status, 200);
  const token = response.json.challenge;
  const message = await revocationProofMessage(token, pemToDer(result.json.cert));
  const pop = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, a.pair.privateKey, asBufferSource(message)));
  const bad = (await args()).pop;
  assert.equal((await revoke(env, { ...request, challenge: token, pop: b64(bad) }, { adapter: provider })).status, 401);
  assert.equal((await revoke(env, { ...request, challenge: token, pop: b64(pop) }, { adapter: provider })).status, 200);
  assert.equal((await revoke(env, { ...request, challenge: token, pop: b64(pop) }, { adapter: provider })).status, 409);
});

test('shared admission uses only keyed identifiers and digests and fails closed', async () => {
  const a = await args(); const payload = JSON.parse(Buffer.from(a.body.token.split('.')[0]!, 'base64url').toString());
  let request = '';
  const durable = { CA_SERVICE_SECRET: env.CA_SERVICE_SECRET, CA_RATE_LIMIT_REST_URL: 'https://redis.example.test', CA_RATE_LIMIT_REST_TOKEN: 'workload-test' };
  assert.equal(await consume(durable, 'issue', payload.jti, 'a'.repeat(64), payload.exp, { fetchImpl: async (_url: string, init: RequestInit) => { request = String(init.body); assert.equal(init.redirect, 'error'); return new Response(JSON.stringify({ result: 'OK' })); } }), true);
  assert.doesNotMatch(request, /device@example|eyJ|PRIVATE KEY/); assert.ok(!request.includes(payload.jti));
  assert.equal(await consume(durable, 'issue', payload.jti, 'a'.repeat(64), payload.exp, { fetchImpl: async () => new Response(JSON.stringify({ result: null })) }), false);
  await assert.rejects(consume({ CA_SERVICE_SECRET: 'x', CA_ENROLLMENT_ALLOW_MEMORY: '1', NODE_ENV: 'production' }, 'issue', payload.jti, 'a'.repeat(64), payload.exp), /not configured/);
  await assert.rejects(consume(durable, 'issue', payload.jti, 'a'.repeat(64), payload.exp, { fetchImpl: async () => new Response('oops', { status: 503 }) }), /unavailable/);
});

test('Vault adapter uses fixed sign paths, projected credentials and bounded responses', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const config = { CA_VAULT_ADDR: 'https://vault.example.test', CA_VAULT_MOUNT: 'pki-device', CA_VAULT_AUTH: 'agent', CA_VAULT_TOKEN_FILE: '/projected/token', CA_VAULT_REVOCATION_TOKEN_FILE: '/projected/revocation' };
  const v = createVaultPki(config, { readImpl: async (path: string) => path.endsWith('revocation') ? 'revocation-credential' : 'issuance-credential', fetchImpl: async (url: string, init: RequestInit) => { if (url.endsWith('lookup-self')) return new Response(JSON.stringify({ data: { policies: ['enrollment'], ttl: 120 } })); calls.push({ url, init }); return new Response(JSON.stringify({ data: { certificate: 'public-result' } })); } });
  await v.sign('device-role', { csr: 'public-csr' });
  assert.equal(calls[0]!.url, 'https://vault.example.test/v1/pki-device/sign/device-role');
  assert.equal((calls[0]!.init.headers as Record<string, string>)['X-Vault-Token'], 'issuance-credential'); assert.equal(calls[0]!.init.redirect, 'error');
  await v.revoke('public-cert'); assert.equal((calls[1]!.init.headers as Record<string, string>)['X-Vault-Token'], 'revocation-credential');
  await assert.rejects(v.sign('../wrong', {}), /explicit/);
  assert.throws(() => createVaultPki({ ...config, CA_VAULT_ADDR: 'http://vault.example.test' }), /HTTPS/);
  assert.throws(() => createVaultPki({ ...config, CA_VAULT_MOUNT: '../pki' }), /mount/);
  const oversized = createVaultPki(config, { readImpl: async () => 'credential', fetchImpl: async () => new Response('x'.repeat(128 * 1024 + 1)) });
  await assert.rejects(oversized.sign('device-role', {}), /limit/);
});

test('Kubernetes workload login reuses only short-lived tokens and reauthenticates on expiry', async () => {
  let now = Date.now(), logins = 0;
  const config = { CA_VAULT_ADDR: 'https://vault.example.test', CA_VAULT_MOUNT: 'pki-device', CA_VAULT_AUTH: 'kubernetes', CA_VAULT_K8S_MOUNT: 'kubernetes', CA_VAULT_K8S_ROLE: 'enrollment', CA_VAULT_K8S_JWT_FILE: '/projected/jwt' };
  const v = createVaultPki(config, { now: () => now, readImpl: async () => 'projected-jwt', fetchImpl: async (url: string) => { if (url.endsWith('/login')) { logins++; return new Response(JSON.stringify({ auth: { client_token: 'short-lived-workload', policies: ['enrollment'], lease_duration: 120 } })); } return new Response(JSON.stringify({ data: {} })); } });
  await Promise.all([v.sign('device-role', {}), v.sign('device-role', {})]); assert.equal(logins, 1);
  now += 91_000; await v.sign('device-role', {}); assert.equal(logins, 2);
});

test('configured managed identity verification requires chain policy and fresh status', async () => {
  const { embedC2pa, verifyC2pa } = await import('../engine/src/index.ts');
  const { validateManagedCredential } = await import('../engine/src/enrollment.ts');
  const a = await args(), result = await managedEnroll(a.body, env, { adapter: adapter() });
  const chain = result.json.chain.map(pemToDer), trust = parseEnrollmentTrustBundle(trustJson);
  const input = te.encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  const output = await embedC2pa(input, 'svg', { signer: { privateKey: a.pair.privateKey, certDer: chain[0], chain } });
  assert.equal((await verifyC2pa(output, { trustAnchors: trust.roots, enrollmentTrust: trust, enrollmentCrls: { 'issuer-one': crl } })).trusted, true);
  assert.equal((await verifyC2pa(output, { trustAnchors: trust.roots, enrollmentTrust: trust })).trusted, false);
  const changed = crl.slice(); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  assert.equal((await verifyC2pa(output, { trustAnchors: trust.roots, enrollmentTrust: trust, enrollmentCrls: { 'issuer-one': changed } })).trusted, false);
  await validateManagedCredential(chain, trust, { 'issuer-one': crl });
});

test('projected Vault issuer/role drift is refused before signing', async () => {
  const config = { CA_VAULT_ADDR: 'https://vault.example.test', CA_VAULT_MOUNT: 'pki-device', CA_VAULT_AUTH: 'agent', CA_VAULT_TOKEN_FILE: '/projected/token' };
  const issuer = { issuer_id: 'issuer-one', key_id: 'issuer-key', certificate: derToPem(mid, 'CERTIFICATE'), usage: 'read-only,issuing-certificates,crl-signing' };
  const role = { issuer_ref: 'issuer-one', no_store: true, generate_lease: false, use_csr_common_name: false, use_csr_sans: false, server_flag: false, client_flag: false, code_signing_flag: false, email_protection_flag: true, key_type: 'ec', key_bits: 256, key_usage: ['DigitalSignature'], ext_key_usage: [], ext_key_usage_oids: [], policy_identifiers: [OID], max_ttl: 604800, allow_any_name: false, allow_ip_sans: false, allow_subdomains: false, allow_glob_domains: false, allowed_domains: ['example.test'], allowed_uri_sans: [], allowed_other_sans: [] };
  let altered: any = role;
  const v = createVaultPki(config, { readImpl: async () => 'projected-workload', fetchImpl: async (url: string) => new Response(JSON.stringify({ data: url.endsWith('lookup-self') ? { policies: ['enrollment'], ttl: 120 } : url.includes('/issuer/') ? issuer : altered })) });
  const expected = { issuer: 'issuer-one', issuerKeyId: 'issuer-key', certificate: mid, policyOid: OID, maxLifetimeSeconds: 604800, domains: ['example.test'] };
  await v.verifyProfile('device-role', expected);
  for (const patch of [{ issuer_ref: 'default' }, { no_store: false }, { use_csr_sans: true }, { key_bits: 384 }, { policy_identifiers: [] }, { allowed_domains: ['other.test'] }, { max_ttl: 604801 }, { server_flag: true }]) {
    altered = { ...role, ...patch }; await assert.rejects(v.verifyProfile('device-role', expected), /policy/);
  }
});

test('managed Node signing uses operator-distributed policy and refuses missing status', async () => {
  const { resolveSigningIdentity } = await import('../packages/node-shell/src/signing-identity.ts');
  const a = await args();
  const extractable = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const csr = await createEnrollmentCsr(extractable);
  const cert = await issue(derToPem(csr, 'CERTIFICATE REQUEST'));
  const chain = [cert, mid, root.certDer];
  const path = join(dir, 'trust.json'), crlPath = join(dir, 'status.crl');
  await writeFile(path, trustJson); await writeFile(crlPath, crl);
  const settings = { LOLLY_SIGN_KEY_PEM: derToPem(new Uint8Array(await crypto.subtle.exportKey('pkcs8', extractable.privateKey)), 'PRIVATE KEY'), LOLLY_SIGN_CERT_PEM: chain.map(b => derToPem(b, 'CERTIFICATE')).join(''), LOLLY_ENROLLMENT_TRUST: path, LOLLY_ENROLLMENT_CRLS: JSON.stringify({ 'issuer-one': crlPath }) };
  const identity = await resolveSigningIdentity({ env: settings }); assert.ok(identity);
  await assert.rejects(resolveSigningIdentity({ env: { ...settings, LOLLY_ENROLLMENT_CRLS: '{}' } }), /status policy/);
  await assert.rejects(resolveSigningIdentity({ env: { ...settings, LOLLY_ENROLLMENT_TRUST: join(dir, 'missing.json') } }), /status policy/);
  assert.equal(a.body.version, 2);
});

test('privileged and long-lived workload credentials are refused before signing', async () => {
  let calls = 0;
  for (const data of [{ policies: ['root'], ttl: 120 }, { policies: ['enrollment'], ttl: 3600 }, { policies: ['enrollment'], ttl: 0 }]) {
    const v = createVaultPki({ CA_VAULT_ADDR: 'https://vault.example.test', CA_VAULT_MOUNT: 'pki-device', CA_VAULT_AUTH: 'agent', CA_VAULT_TOKEN_FILE: '/projected/token' }, { readImpl: async () => 'projected-credential', fetchImpl: async (url: string) => {
      if (!url.endsWith('lookup-self')) calls++;
      return new Response(JSON.stringify({ data }));
    } });
    await assert.rejects(v.sign('device-role', {}), /privilege policy/);
  }
  assert.equal(calls, 0);
});

test('browser enrollment persists a nonextractable key, validates before storing and revokes with device proof', { skip: process.env.LOLLY_CA_BROWSER_TESTS !== '1' && 'Set LOLLY_CA_BROWSER_TESTS=1 for managed enrollment browser checks.' }, async () => {
  const { createServer } = await import('node:http');
  const { build } = await import('esbuild');
  const { chromium } = await import('playwright-core');
  const script = (await build({ stdin: { contents: `import{openDB}from'idb';import{createIdentityAPI}from'./shells/web/src/bridge/identity.ts';window.boot=async trust=>{window.db=await openDB('managed-identity',1,{upgrade(db){db.createObjectStore('identity')}});window.identity=createIdentityAPI(window.db,{managedTrustJson:trust});};`, resolveDir: new URL('../', import.meta.url).pathname }, bundle: true, write: false, format: 'esm', platform: 'browser', define: { 'import.meta.env': '{}' } })).outputFiles[0]!.text;
  let altered = false;
  const provider = adapter();
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.end('<!doctype html><script type="module" src="/identity.js"></script>'); return; }
    if (req.url === '/identity.js') { res.setHeader('content-type', 'text/javascript'); res.end(script); return; }
    if (req.url === '/api/ca/issuer/issuer-one/crl') { res.setHeader('content-type', 'application/pkix-crl'); res.end(crl); return; }
    if (req.method !== 'POST') { res.statusCode = 404; res.end(); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = req.url === '/api/ca/enroll' ? await managedEnroll(body, env, { adapter: provider }) : req.url === '/api/ca/revoke/challenge' ? await challenge(env, body) : await revoke(env, body, { adapter: provider });
    if (altered && req.url === '/api/ca/enroll' && result.status === 200) result.json.notAfter = new Date().toISOString();
    res.statusCode = result.status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(result.json));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as import('node:net').AddressInfo).port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`); await page.waitForFunction(() => typeof (window as any).boot === 'function');
    await page.evaluate(raw => (window as any).boot(raw), trustJson);
    const token = await mint({ email: 'device@example.test', provider: 'suse' }, env.CA_SERVICE_SECRET);
    const first = await page.evaluate(async token => {
      const w = window as any; const status = await w.identity.completeEnrollment(token); const pair = await w.db.get('identity', 'keypair');
      let refused = false; try { await crypto.subtle.exportKey('pkcs8', pair.privateKey); } catch { refused = true; }
      return { status, extractable: pair.privateKey.extractable, refused, signer: !!await w.identity.signer(), cert: btoa(String.fromCharCode(...(await w.db.get('identity', 'cert')).chain[0])) };
    }, token);
    assert.equal(first.status.enrolled, true); assert.equal(first.status.statusUnavailable, false); assert.equal(first.extractable, false); assert.equal(first.refused, true); assert.equal(first.signer, true);
    await page.reload(); await page.waitForFunction(() => typeof (window as any).boot === 'function'); await page.evaluate(raw => (window as any).boot(raw), trustJson);
    assert.equal(await page.evaluate(async () => !!await (window as any).identity.signer()), true);
    altered = true;
    const next = await mint({ email: 'device@example.test', provider: 'suse' }, env.CA_SERVICE_SECRET);
    const invalid = await page.evaluate(async token => {
      const w = window as any; let refused = false; try { await w.identity.completeEnrollment(token); } catch { refused = true; }
      return { refused, cert: btoa(String.fromCharCode(...(await w.db.get('identity', 'cert')).chain[0])) };
    }, next);
    assert.equal(invalid.refused, true); assert.equal(invalid.cert, first.cert);
    await page.evaluate(async () => (window as any).identity.revoke());
    assert.equal(await page.evaluate(async () => (await (window as any).identity.status()).enrolled), false);
    await context.close();
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
