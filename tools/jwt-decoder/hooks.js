/* global onInit, onInput */
/**
 * JWT Decoder — runs entirely in the sandboxed hook context (no DOM, no network).
 * Splits a JSON Web Token, base64url-decodes the header and payload, parses the
 * JSON and surfaces the standard claims with humanised timestamps and validity
 * checks. It deliberately does NOT verify the signature: there's no key, and the
 * honest framing is "this reads the token, it doesn't trust it" — so we never
 * imply a token is authentic.
 *
 * Pure JS: base64url is decoded by hand (no atob — it mangles UTF-8 and isn't
 * guaranteed in every shell), then TextDecoder gives correct Unicode.
 */

// ─── base64url ────────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64urlToBytes(input) {
  const s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const c0 = B64.indexOf(s[i]);
    const c1 = B64.indexOf(s[i + 1]);
    const c2 = i + 2 < s.length ? B64.indexOf(s[i + 2]) : -1;
    const c3 = i + 3 < s.length ? B64.indexOf(s[i + 3]) : -1;
    if (c0 < 0 || c1 < 0) break;
    out.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) out.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) out.push(((c2 & 3) << 6) | c3);
  }
  return new Uint8Array(out);
}

function b64urlToString(input) {
  return new TextDecoder('utf-8', { fatal: false }).decode(b64urlToBytes(input));
}

// ─── decode ──────────────────────────────────────────────────────────────────

function decodeJwt(raw) {
  let t = (raw || '').trim().replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  if (!t) return { state: 'empty' };
  const parts = t.split('.');
  if (parts.length === 5) return { state: 'jwe' };
  if (parts.length !== 3) {
    return { state: 'error', error: `A JWT has 3 dot-separated parts; this has ${parts.length}.` };
  }
  let header, payload;
  try { header = JSON.parse(b64urlToString(parts[0])); }
  catch (e) { return { state: 'error', error: 'The header is not valid base64url-encoded JSON.' }; }
  try { payload = JSON.parse(b64urlToString(parts[1])); }
  catch (e) { return { state: 'error', error: 'The payload is not valid base64url-encoded JSON.' }; }
  if (header === null || typeof header !== 'object') return { state: 'error', error: 'The header is not a JSON object.' };
  if (payload === null || typeof payload !== 'object') return { state: 'error', error: 'The payload is not a JSON object.' };
  return { state: 'ok', header, payload, signature: parts[2] };
}

// ─── formatting helpers ──────────────────────────────────────────────────────

function fmtVal(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.map(fmtVal).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function relTime(diffSec) {
  const a = Math.abs(diffSec);
  if (a < 1) return 'now';
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  let label = '';
  for (const [name, s] of units) {
    if (a >= s) { const nn = Math.floor(a / s); label = `${nn} ${name}${nn > 1 ? 's' : ''}`; break; }
  }
  return diffSec >= 0 ? `in ${label}` : `${label} ago`;
}

function fmtTime(sec, nowSec) {
  if (typeof sec !== 'number' || !isFinite(sec)) return null;
  const d = new Date(sec * 1000);
  if (isNaN(d.getTime())) return null;
  const iso = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `${iso} (${relTime(sec - nowSec)})`;
}

const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time', 'updated_at']);
const CLAIM_LABEL = {
  iss: 'Issuer (iss)', sub: 'Subject (sub)', aud: 'Audience (aud)', exp: 'Expires (exp)',
  nbf: 'Not before (nbf)', iat: 'Issued at (iat)', jti: 'JWT ID (jti)',
  azp: 'Authorized party (azp)', scope: 'Scope', email: 'Email', name: 'Name',
};

function rowsFor(obj, nowSec, withTime) {
  return Object.keys(obj).map((k) => {
    const v = obj[k];
    let detail = '';
    let tone = '';
    if (withTime && TIME_CLAIMS.has(k) && typeof v === 'number') {
      detail = fmtTime(v, nowSec) || '';
      if (k === 'exp' && nowSec >= v) tone = 'warn';
      if (k === 'nbf' && nowSec < v) tone = 'warn';
    }
    return { k, label: CLAIM_LABEL[k] || k, value: fmtVal(v), detail, tone };
  });
}

// ─── view model ──────────────────────────────────────────────────────────────

function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const blank = {
    hasToken: false, isEmpty: true, isOk: false, isError: false, isJwe: false,
    error: '', alg: '', typ: '', kid: '', headerRows: [], payloadRows: [],
    statusLabel: '', statusTone: '', hasValidity: false, warnings: [], summary: 'no token',
  };
  const d = decodeJwt(inputs.token);

  if (d.state === 'empty') return blank;
  if (d.state === 'jwe') {
    return { ...blank, hasToken: true, isEmpty: false, isError: true,
      error: 'This is an encrypted token (JWE, 5 parts). Its contents can\'t be read without the decryption key.',
      summary: 'encrypted (JWE)' };
  }
  if (d.state === 'error') {
    return { ...blank, hasToken: true, isEmpty: false, isError: true, error: d.error, summary: 'not a valid JWT' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const { header, payload } = d;
  const alg = header.alg != null ? String(header.alg) : '';
  const typ = header.typ != null ? String(header.typ) : '';
  const kid = header.kid != null ? String(header.kid) : '';

  // Validity + security checks.
  const warnings = [];
  const expired = typeof payload.exp === 'number' && nowSec >= payload.exp;
  const notYet = typeof payload.nbf === 'number' && nowSec < payload.nbf;
  let statusLabel, statusTone;
  if (expired) { statusLabel = `Expired ${relTime(payload.exp - nowSec)}`; statusTone = 'warn'; }
  else if (notYet) { statusLabel = `Not valid yet — starts ${relTime(payload.nbf - nowSec)}`; statusTone = 'warn'; }
  else if (typeof payload.exp === 'number') { statusLabel = `Within its validity window (expires ${relTime(payload.exp - nowSec)})`; statusTone = 'ok'; }
  else { statusLabel = 'No expiry claim — this token does not expire'; statusTone = 'warn'; }

  if (/^none$/i.test(alg)) warnings.push({ label: 'Algorithm "none"', detail: 'This token is unsigned — anyone can forge one. Reject "alg: none" server-side.' });
  if (!('exp' in payload)) warnings.push({ label: 'No expiry', detail: 'Without an "exp" claim the token is valid forever unless revoked.' });

  const summary = `${alg || 'unknown alg'}${expired ? ', expired' : (notYet ? ', not yet valid' : '')}`;

  return {
    hasToken: true, isEmpty: false, isOk: true, isError: false, isJwe: false, error: '',
    alg, typ, kid,
    headerRows: rowsFor(header, nowSec, false),
    payloadRows: rowsFor(payload, nowSec, true),
    statusLabel, statusTone, hasValidity: true, warnings, summary,
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }
