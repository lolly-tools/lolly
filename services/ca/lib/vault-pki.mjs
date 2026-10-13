// SPDX-License-Identifier: MPL-2.0
/** Bounded PKI requests using a projected workload credential. */
import { readFile } from 'node:fs/promises';
import { enrollmentCertificateDer, equalDer } from '../../../engine/src/enrollment.ts';

export class VaultUnavailable extends Error {}
const invalidCredential = text => [...text].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127);
const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;
export function vaultPath(raw) {
  if (typeof raw !== 'string' || raw.length > 300 || !raw.split('/').every(v => SEGMENT.test(v))) throw new Error('Invalid Vault mount path');
  return raw;
}
export function vaultName(raw) {
  if (typeof raw !== 'string' || !SEGMENT.test(raw) || raw === 'default') throw new Error('Vault references must be explicit');
  return raw;
}
async function boundedBody(res, cap) {
  if (Number(res.headers.get('content-length')) > cap || !res.body) throw new VaultUnavailable('Provider response exceeds its limit');
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > cap) throw new VaultUnavailable('Provider response exceeds its limit');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch (err) { await reader.cancel().catch(() => {}); throw err; }
}
async function workloadFile(path, readImpl) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 4096) throw new VaultUnavailable('Workload credential file is not configured');
  let text;
  try { text = String(await readImpl(path, 'utf8')).trim(); } catch { throw new VaultUnavailable('Workload credential is unavailable'); }
  if (!text || text.length > 16384 || invalidCredential(text)) throw new VaultUnavailable('Workload credential is invalid');
  return text;
}
export function createVaultPki(env, { fetchImpl = fetch, readImpl = readFile, now = Date.now } = {}) {
  const url = new URL(env.CA_VAULT_ADDR);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Vault address must be an HTTPS origin');
  const mount = vaultPath(env.CA_VAULT_MOUNT);
  const namespace = String(env.CA_VAULT_NAMESPACE || '');
  if (namespace && !/^[A-Za-z0-9_/-]{1,300}$/.test(namespace)) throw new Error('Invalid Vault namespace');
  const auth = env.CA_VAULT_AUTH;
  if (!['agent', 'kubernetes'].includes(auth)) throw new Error('Vault workload authentication is not configured');
  if (auth === 'agent' && !env.CA_VAULT_TOKEN_FILE) throw new Error('Vault Agent token file is not configured');
  if (auth === 'kubernetes') { vaultPath(env.CA_VAULT_K8S_MOUNT); vaultName(env.CA_VAULT_K8S_ROLE); }
  let cached = null;
  let loginPromise = null;
  async function request(path, body, token, cap = 128 * 1024, binary = false) {
    let res;
    const headers = { ...(namespace ? { 'X-Vault-Namespace': namespace } : {}), ...(token ? { 'X-Vault-Token': token } : {}) };
    try {
      res = await fetchImpl(`${url.origin}/v1/${path}`, {
        method: body == null ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { ...headers, ...(body == null ? {} : { 'content-type': 'application/json' }) },
        ...(body == null ? {} : { body: JSON.stringify(body) }),
      });
      if (!res.ok) { await res.body?.cancel(); throw new VaultUnavailable('Certificate provider refused the request'); }
      const bytes = await boundedBody(res, cap);
      if (binary) return new Uint8Array(bytes);
      const json = JSON.parse(bytes.toString('utf8'));
      if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
      return json;
    } catch (error) {
      if (error instanceof VaultUnavailable) throw error;
      throw new VaultUnavailable('Certificate provider is unavailable');
    }
  }
  async function credential() {
    if (auth === 'agent') {
      const token = await workloadFile(env.CA_VAULT_TOKEN_FILE, readImpl);
      const result = await request('auth/token/lookup-self', null, token);
      const ttl = Number(result.data?.ttl);
      if (!Array.isArray(result.data?.policies) || result.data.policies.includes('root') || !Number.isSafeInteger(ttl) || ttl < 1 || ttl > 900) throw new VaultUnavailable('Workload credential does not meet the required lifetime and privilege policy');
      return token;
    }
    if (cached && cached.until > now()) return cached.token;
    loginPromise ??= (async () => {
      const jwt = await workloadFile(env.CA_VAULT_K8S_JWT_FILE, readImpl);
      const result = await request(`auth/${env.CA_VAULT_K8S_MOUNT}/login`, { role: env.CA_VAULT_K8S_ROLE, jwt });
      const token = result.auth?.client_token;
      const seconds = Number(result.auth?.lease_duration);
      if (!Array.isArray(result.auth?.policies) || result.auth.policies.includes('root')) throw new VaultUnavailable('Workload authentication returned an invalid privilege policy');
      if (typeof token !== 'string' || !token || token.length > 16384 || invalidCredential(token) || !Number.isSafeInteger(seconds) || seconds < 60 || seconds > 900) throw new VaultUnavailable('Workload authentication returned an invalid credential');
      cached = { token, until: now() + (seconds - 30) * 1000 };
      return token;
    })();
    try { return await loginPromise; } finally { loginPromise = null; }
  }
  return {
    async verifyProfile(role, approved) {
      const token = await credential();
      const issuer = await request(`${mount}/issuer/${vaultName(approved.issuer)}`, null, token);
      const configured = await request(`${mount}/roles/${vaultName(role)}`, null, token);
      const i = issuer.data, r = configured.data;
      const list = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(Boolean) : [];
      const only = (value, expected) => { const values = list(value).map(v => v.toLowerCase()); return values.length === 1 && values[0] === expected.toLowerCase(); };
      if ((issuer.warnings?.length ?? 0) || (configured.warnings?.length ?? 0) || !i || !r || i.issuer_id !== approved.issuer || i.key_id !== approved.issuerKeyId || !equalDer(enrollmentCertificateDer(i.certificate), approved.certificate) || !list(i.usage).includes('issuing-certificates') || r.issuer_ref !== approved.issuer || r.no_store !== true || r.generate_lease !== false || r.use_csr_common_name !== false || r.use_csr_sans !== false || r.server_flag !== false || r.client_flag !== false || r.code_signing_flag !== false || r.email_protection_flag !== true || r.key_type !== 'ec' || r.key_bits !== 256 || !only(r.key_usage, 'DigitalSignature') || list(r.ext_key_usage).some(v => v.toLowerCase() !== 'emailprotection') || list(r.ext_key_usage_oids).some(v => v !== '1.3.6.1.5.5.7.3.4') || !only(r.policy_identifiers, approved.policyOid) || !Number.isSafeInteger(r.max_ttl) || r.max_ttl < 60 || r.max_ttl > approved.maxLifetimeSeconds || r.allow_any_name !== false || r.allow_ip_sans !== false || r.allow_subdomains !== false || r.allow_glob_domains !== false || list(r.allowed_domains).length !== approved.domains.length || !approved.domains.every(d => list(r.allowed_domains).includes(d)) || list(r.allowed_uri_sans).length || list(r.allowed_other_sans).length) throw new VaultUnavailable('Provider issuer policy does not match deployment configuration');
    },
    async sign(role, body) { return (await request(`${mount}/sign/${vaultName(role)}`, body, await credential())).data; },
    async revoke(certificate) {
      if (!env.CA_VAULT_REVOCATION_TOKEN_FILE) throw new VaultUnavailable('Revocation workload is not configured');
      const token = await workloadFile(env.CA_VAULT_REVOCATION_TOKEN_FILE, readImpl);
      const info = (await request('auth/token/lookup-self', null, token)).data;
      if (!Array.isArray(info?.policies) || info.policies.includes('root') || !Number.isSafeInteger(info.ttl) || info.ttl < 1 || info.ttl > 900) throw new VaultUnavailable('Revocation credential does not meet workload policy');
      return (await request(`${mount}/revoke`, { certificate }, token)).data;
    },
    async crl(issuer, unified = false) {
      return request(`${mount}/issuer/${vaultName(issuer)}/${unified ? 'unified-crl' : 'crl'}/der`, null, null, 1024 * 1024, true);
    },
  };
}
