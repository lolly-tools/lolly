/**
 * Contract tests for the JWT Decoder utility — runs the real tool (manifest +
 * hooks + template) through the engine runtime and asserts on the hydrated
 * output, the same end-to-end strategy as the file-utility tools.
 *
 * Run with: node --test tests/jwt-decoder.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createRuntime } from '../engine/src/runtime.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BARE_HOST = { version: '1', profile: { get: async () => ({}) }, log: () => {} };

function jwtDecoderTool() {
  return {
    manifest: JSON.parse(readFileSync(join(ROOT, 'tools/jwt-decoder/tool.json'), 'utf8')),
    hooksSource: readFileSync(join(ROOT, 'tools/jwt-decoder/hooks.js'), 'utf8'),
    template: readFileSync(join(ROOT, 'tools/jwt-decoder/template.html'), 'utf8'),
  };
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (header, payload, sig = 'c2ln') => `${b64url(header)}.${b64url(payload)}.${sig}`;

// Hydrated HTML with tags stripped, for substring assertions.
async function decodedText(token) {
  const rt = await createRuntime(jwtDecoderTool(), BARE_HOST, { token });
  return rt.getHydrated().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('jwt-decoder: decodes header + payload claims and labels standard claims', async () => {
  const text = await decodedText(jwt(
    { alg: 'HS256', typ: 'JWT', kid: 'key-1' },
    { iss: 'https://auth.example.com', sub: 'user-42', aud: 'api', iat: 1700000000, exp: 1700003600 },
  ));
  assert.match(text, /HS256/);
  assert.match(text, /key-1/);
  assert.match(text, /Issuer \(iss\)/);
  assert.match(text, /https:\/\/auth\.example\.com/);
  assert.match(text, /Subject \(sub\)/);
  assert.match(text, /user-42/);
  // exp=1700003600 is 2023-11-14 — a fixed wall-clock instant regardless of "now".
  assert.match(text, /2023-11-14T23:13:20Z/);
  // We never claim authenticity.
  assert.match(text, /signature is .*not.* verified/i);
});

test('jwt-decoder: an expired token reads as expired', async () => {
  const text = await decodedText(jwt({ alg: 'HS256', typ: 'JWT' }, { exp: 1700003600 }));
  assert.match(text, /Expired/);
});

test('jwt-decoder: alg "none" raises a forgery warning', async () => {
  const text = await decodedText(jwt({ alg: 'none', typ: 'JWT' }, { sub: 'x', exp: 4102444800 }));
  // Handlebars entity-encodes the quotes in the label ("none" → &quot;none&quot;),
  // so assert on the unescaped words rather than the literal quote characters.
  assert.match(text, /Algorithm/);
  assert.match(text, /unsigned/i);
  assert.match(text, /forge/i);
});

test('jwt-decoder: a token with no exp claim is flagged as non-expiring', async () => {
  const text = await decodedText(jwt({ alg: 'HS256', typ: 'JWT' }, { sub: 'x' }));
  assert.match(text, /does not expire|No expiry/i);
});

test('jwt-decoder: decodes non-ASCII payload correctly (hand-rolled base64url + UTF-8)', async () => {
  const text = await decodedText(jwt({ alg: 'HS256', typ: 'JWT' }, { name: 'Renée Δîönço 你好', exp: 4102444800 }));
  assert.match(text, /Renée Δîönço 你好/);
});

test('jwt-decoder: a malformed token (wrong part count) shows a clear error', async () => {
  const text = await decodedText('abc.def');
  assert.match(text, /A JWT has 3 dot-separated parts; this has 2\./);
});

test('jwt-decoder: a 5-part token is identified as an encrypted JWE', async () => {
  const text = await decodedText('a.b.c.d.e');
  assert.match(text, /encrypted token \(JWE/);
});

test('jwt-decoder: empty input shows the inspector prompt, not an error', async () => {
  const text = await decodedText('');
  assert.match(text, /Inspect a JSON Web Token/);
  assert.doesNotMatch(text, /error/i);
});

test('jwt-decoder: a "Bearer " prefix and surrounding quotes are tolerated', async () => {
  const raw = jwt({ alg: 'HS256', typ: 'JWT' }, { sub: 'ok', exp: 4102444800 });
  const text = await decodedText(`  Bearer "${raw}"  `);
  assert.match(text, /Subject \(sub\)/);
  assert.match(text, /\bok\b/);
});
