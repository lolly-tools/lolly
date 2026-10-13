// SPDX-License-Identifier: MPL-2.0
/** Hosted enrollment delegated to a configured PKI issuer. */
import { createHash } from 'node:crypto';
import { parseCertificate } from '../../../engine/src/x509-read.ts';
import { asBufferSource } from '../../../engine/src/bytes.ts';
import { derToPem } from '../../../engine/src/x509.ts';
import { enrollmentCertificateDer, parseEnrollmentTrustBundle, revocationProofMessage, validateEnrollmentChain, validateEnrollmentCrl, verifyEnrollmentRequest } from '../../../engine/src/enrollment.ts';
import { b64uToBytes, randomB64u, signValue, verifyEnrollToken, verifyValue } from './tokens.mjs';
import { consumeEnrollment, EnrollmentAdmissionUnavailable } from './enrollment-admission.mjs';
import { createVaultPki, VaultUnavailable, vaultName } from './vault-pki.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (status, error) => ({ status, json: { error } });
export function issuerMode(env) {
  const hasVault = Object.keys(env).some(k => k.startsWith('CA_VAULT_') && env[k]);
  const mode = env.CA_ISSUER_MODE || (hasVault ? '' : 'legacy-root');
  if (!['legacy-root', 'vault-pki'].includes(mode) || (mode === 'legacy-root' && hasVault)) throw new Error('Certificate issuer mode must be explicitly configured');
  return mode;
}
export function managedPolicy(env) {
  if (issuerMode(env) !== 'vault-pki') throw new Error('Managed issuer mode is not configured');
  const trust = parseEnrollmentTrustBundle(env.CA_ENROLLMENT_TRUST_JSON);
  if (trust.defaultLifetimeSeconds > 86400 || trust.maxLifetimeSeconds > 604800) throw new Error('Managed certificate lifetimes exceed deployment policy');
  const roles = JSON.parse(env.CA_VAULT_ROLES_JSON || 'null');
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) throw new Error('Managed issuer roles are not configured');
  const assurance = { suse: 'managed-sso', google: 'consumer-email', github: 'consumer-email', email: 'email-link' };
  const used = new Map();
  for (const name of Object.keys(trust.providers)) {
    const category = Object.hasOwn(assurance, name) ? assurance[name] : undefined;
    const oid = trust.providers[name].policyOid;
    if (!category || (used.has(oid) && used.get(oid) !== category)) throw new Error('Enrollment assurance classes must have distinct policy identifiers');
    used.set(oid, category);
    vaultName(roles[name]?.role);
    vaultName(roles[name]?.managedKeyId);
    vaultName(roles[name]?.issuerKeyId);
  }
  return { trust, roles };
}
function approvedIdentity(payload, trust) {
  const policy = trust.providers[payload.provider];
  const email = payload.email;
  if (!policy || typeof email !== 'string' || email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+$/.test(email) || !policy.domains.includes(email.slice(email.lastIndexOf('@') + 1).toLowerCase())) throw new Error('Identity is outside enrollment policy');
  return policy;
}
function requestBytes(value, cap) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(cap * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid enrollment input');
  const b = b64uToBytes(value);
  if (!b.length || b.length > cap || Buffer.from(b).toString('base64url') !== value) throw new Error('Invalid enrollment input');
  return b;
}
function publicFailure(err) {
  if (err instanceof EnrollmentAdmissionUnavailable) return fail(503, 'Enrollment admission is temporarily unavailable');
  if (err instanceof VaultUnavailable) return fail(503, 'Certificate provider is temporarily unavailable');
  return fail(502, 'Certificate provider returned an invalid certificate');
}
export async function managedEnroll(body, env, deps = {}) {
  let config, adapter;
  try { config = managedPolicy(env); adapter = deps.adapter || createVaultPki(env, deps); }
  catch { return fail(503, 'Managed enrollment is not configured'); }
  const { trust, roles } = config;
  if (body?.version !== 2 || typeof body.token !== 'string' || body.token.length > 8192) return fail(400, 'Enrollment protocol version 2 is required');
  let token;
  try { token = await verifyEnrollToken(body.token, env.CA_SERVICE_SECRET); } catch { return fail(503, 'Enrollment authentication is unavailable'); }
  if (!token.ok) return fail(401, 'Enrollment authentication is invalid or expired');
  if (token.payload.version !== 2 || !token.payload.jti || !Number.isSafeInteger(token.payload.iat) || token.payload.iat > Math.floor(Date.now() / 1000) + 60 || token.payload.exp - token.payload.iat > 600) return fail(401, 'A fresh enrollment authentication is required');
  let csr, spki, proof, policy, seconds;
  try {
    policy = approvedIdentity(token.payload, trust);
    csr = requestBytes(body.csr, 4096); spki = requestBytes(body.spki, 256); proof = requestBytes(body.pop, 64);
    await verifyEnrollmentRequest(csr, spki, proof, body.token);
    seconds = body.lifetimeSeconds == null ? trust.defaultLifetimeSeconds : body.lifetimeSeconds;
    if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > trust.maxLifetimeSeconds) throw new Error();
    const issuer = parseCertificate(trust.issuers.get(policy.issuer));
    seconds = Math.min(seconds, Math.floor((issuer.notAfter.getTime() - Date.now()) / 1000));
    if (seconds < 60) throw new Error();
  } catch { return fail(400, 'Enrollment proof, identity or lifetime does not meet policy'); }
  try {
    await adapter.verifyProfile(roles[token.payload.provider].role, { ...policy, issuerKeyId: roles[token.payload.provider].issuerKeyId, certificate: trust.issuers.get(policy.issuer), maxLifetimeSeconds: trust.maxLifetimeSeconds });
    const accepted = await consumeEnrollment(env, 'issue', token.payload.jti, digest(Buffer.concat([Buffer.from(csr), Buffer.from(spki), Buffer.from(String(seconds))])), token.payload.exp, deps);
    if (!accepted) return fail(409, 'This enrollment authentication was already used; sign in again');
    const result = await adapter.sign(roles[token.payload.provider].role, {
      csr: derToPem(csr, 'CERTIFICATE REQUEST'), common_name: token.payload.email,
      alt_names: token.payload.email, exclude_cn_from_sans: true, ttl: `${seconds}s`,
      format: 'pem', remove_roots_from_chain: false,
    });
    if (!result || result.private_key || !Array.isArray(result.ca_chain) || result.ca_chain.length < 1 || result.ca_chain.length > 2) throw new Error();
    const chain = [enrollmentCertificateDer(result.certificate), ...result.ca_chain.map(enrollmentCertificateDer)];
    const checked = await validateEnrollmentChain(chain, { roots: trust.roots, issuer: trust.issuers.get(policy.issuer), email: token.payload.email, policyOid: policy.policyOid, spki, maxLifetimeSeconds: seconds });
    if (checked.leaf.notBefore.getTime() < Date.now() - 300_000 || checked.leaf.notAfter.getTime() > Date.now() + seconds * 1000 + 60_000) throw new Error();
    const status = await validateEnrollmentCrl(await adapter.crl(policy.issuer, trust.unifiedCrl), trust.issuers.get(policy.issuer), trust.crlMaxAgeSeconds);
    if (status.revokedSerials.includes(checked.serial)) throw new Error();
    const pem = chain.map(b => derToPem(b, 'CERTIFICATE'));
    return { status: 200, json: { version: 2, issuerMode: 'vault-pki', issuer: policy.issuer, cert: pem[0], chain: pem,
      identity: { email: token.payload.email, provider: token.payload.provider }, policyOid: policy.policyOid,
      notBefore: checked.leaf.notBefore.toISOString(), notAfter: checked.leaf.notAfter.toISOString() } };
  } catch (err) { return publicFailure(err); }
}
export async function managedCrl(env, issuer, deps = {}) {
  try {
    const { trust } = managedPolicy(env);
    const cert = trust.issuers.get(issuer);
    if (!cert) return fail(404, 'Issuer is not configured');
    const adapter = deps.adapter || createVaultPki(env, deps);
    const bytes = await adapter.crl(issuer, trust.unifiedCrl);
    await validateEnrollmentCrl(bytes, cert, trust.crlMaxAgeSeconds);
    return { status: 200, body: Buffer.from(bytes), type: 'application/pkix-crl', headers: { 'x-content-type-options': 'nosniff' } };
  } catch (err) { return publicFailure(err); }
}
async function approvedCertificate(env, body) {
  const { trust } = managedPolicy(env);
  const certificate = enrollmentCertificateDer(body?.certificate);
  const issuer = trust.issuers.get(body?.issuer);
  const policy = trust.providers[body?.provider];
  const parsed = parseCertificate(certificate);
  if (!policy || !issuer || body.issuer !== policy.issuer || parsed.sanEmails.length !== 1) throw new Error();
  approvedIdentity({ email: parsed.sanEmails[0], provider: body.provider }, trust);
  await validateEnrollmentChain([certificate, issuer], { roots: trust.roots, issuer, email: parsed.sanEmails[0], policyOid: policy.policyOid, maxLifetimeSeconds: trust.maxLifetimeSeconds });
  return { certificate, parsed, trust };
}
export async function managedRevocationChallenge(env, body) {
  try {
    const { certificate } = await approvedCertificate(env, body);
    const now = Math.floor(Date.now() / 1000);
    const challenge = await signValue({ typ: 'lolly-ca/revoke', jti: randomB64u(24), iat: now, exp: now + 120, hash: digest(certificate), issuer: body.issuer, provider: body.provider }, env.CA_SERVICE_SECRET);
    return { status: 200, json: { challenge } };
  } catch { return fail(400, 'Certificate does not meet revocation policy'); }
}
export async function managedRevoke(env, body, deps = {}) {
  let checked, challenge;
  try {
    checked = await approvedCertificate(env, body);
    challenge = await verifyValue(body?.challenge, env.CA_SERVICE_SECRET);
    const now = Math.floor(Date.now() / 1000);
    if (challenge?.typ !== 'lolly-ca/revoke' || challenge.hash !== digest(checked.certificate) || challenge.issuer !== body.issuer || challenge.provider !== body.provider || !Number.isSafeInteger(challenge.exp) || challenge.exp <= now || challenge.exp - challenge.iat > 120 || challenge.iat > now + 60) throw new Error();
    const key = await crypto.subtle.importKey('spki', asBufferSource(checked.parsed.spki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, asBufferSource(requestBytes(body.pop, 64)), asBufferSource(await revocationProofMessage(body.challenge, checked.certificate)))) throw new Error();
  } catch { return fail(401, 'Revocation proof does not verify'); }
  try {
    if (!await consumeEnrollment(env, 'revoke', challenge.jti, challenge.hash, challenge.exp, deps)) return fail(409, 'This revocation challenge was already used');
    const adapter = deps.adapter || createVaultPki(env, deps);
    const response = await adapter.revoke(derToPem(checked.certificate, 'CERTIFICATE'));
    if (!Number.isSafeInteger(response?.revocation_time) || response.revocation_time < 1) throw new Error();
    return { status: 200, json: { revoked: true } };
  } catch (err) { return publicFailure(err); }
}
