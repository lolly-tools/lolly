// SPDX-License-Identifier: MPL-2.0
/** Atomic one-use enrollment and revocation admission across replicas. */
import { createHmac } from 'node:crypto';

export class EnrollmentAdmissionUnavailable extends Error {}
const LUA = "return redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])";
const MAX_KEYS = 20_000;
const memoryStores = new WeakMap();

function keyFor(secret, scope, id) {
  return `lolly:ca:once:${createHmac('sha256', secret).update(scope).update('\0').update(id).digest('hex')}`;
}
function parameters(env) {
  const url = String(env.CA_RATE_LIMIT_REST_URL || env.LOLLY_RATE_LIMIT_REST_URL || '').trim();
  const token = String(env.CA_RATE_LIMIT_REST_TOKEN || env.LOLLY_RATE_LIMIT_REST_TOKEN || '').trim();
  if (!url || !token) throw new EnrollmentAdmissionUnavailable('Shared enrollment admission is not configured');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new EnrollmentAdmissionUnavailable('Shared enrollment admission is not configured');
  return { url: parsed.toString(), token };
}

export async function consumeEnrollment(env, scope, id, requestDigest, expires, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!env.CA_SERVICE_SECRET || typeof id !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(id) || !/^[a-f0-9]{64}$/.test(requestDigest)) throw new EnrollmentAdmissionUnavailable('Invalid enrollment admission input');
  const ttl = Math.ceil((expires * 1000 - now) / 1000);
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 600) throw new EnrollmentAdmissionUnavailable('Invalid enrollment admission lifetime');
  const key = keyFor(env.CA_SERVICE_SECRET, scope, id);
  if (env.CA_ENROLLMENT_ALLOW_MEMORY === '1' && env.NODE_ENV !== 'production' && !env.VERCEL && env.CA_HOSTED !== '1') {
    let store = memoryStores.get(env);
    if (!store) { store = new Map(); memoryStores.set(env, store); }
    for (const [entry, value] of store) if (value.expires <= now) store.delete(entry);
    if (store.has(key)) return false;
    if (store.size >= MAX_KEYS) throw new EnrollmentAdmissionUnavailable('Enrollment admission capacity reached');
    store.set(key, { digest: requestDigest, expires: expires * 1000 });
    return true;
  }
  const configured = parameters(env);
  let res;
  try {
    res = await fetchImpl(configured.url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(2500),
      headers: { authorization: `Bearer ${configured.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(['EVAL', LUA, '1', key, requestDigest, String(ttl)]),
    });
  } catch { throw new EnrollmentAdmissionUnavailable('Shared enrollment admission is unavailable'); }
  if (!res.ok || Number(res.headers.get('content-length')) > 4096) throw new EnrollmentAdmissionUnavailable('Shared enrollment admission is unavailable');
  const reader = res.body?.getReader();
  if (!reader) throw new EnrollmentAdmissionUnavailable('Shared enrollment admission is unavailable');
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) throw new EnrollmentAdmissionUnavailable('Shared enrollment admission response is too large');
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8')).result;
    if (result === 'OK') return true;
    if (result === null) return false;
    throw new EnrollmentAdmissionUnavailable('Shared enrollment admission returned an invalid result');
  } catch (err) {
    await reader.cancel().catch(() => {});
    if (err instanceof EnrollmentAdmissionUnavailable) throw err;
    throw new EnrollmentAdmissionUnavailable('Shared enrollment admission is unavailable');
  }
}
