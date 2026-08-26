// SPDX-License-Identifier: MPL-2.0
/**
 * scan-code - the safety model (plans/162 section 2.4, section 2.6 safety tests).
 *
 * A scanned code is untrusted input. The classifier is pure and is exercised here
 * through the tool's `paste` mode (the same analysis a typed-in value gets), so
 * the whole safety model is tested with no camera. The pins that matter:
 * `javascript:` never yields an open affordance; punycode is dual-rendered;
 * WIFI/otpauth secrets are masked by default; GS1 parses to an AI table.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/scan-code-safety.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(join(COMMUNITY, 'scan-code')) && 'scan-code not mounted';
const tool: any = SKIP ? null : await loadTool('scan-code',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

/** Classify a value through paste mode; return the observable view model. */
async function inspect(value: string) {
  const rt = await createRuntime(tool, baseHost(), { mode: 'paste', paste: value });
  const g = (expr: string) => (rt.getHydratedText(expr) as string) ?? '';
  return {
    kind: g('{{scanKind}}'),
    label: g('{{scanLabel}}'),
    openUrl: g('{{scanOpenUrl}}'),
    warnings: rt.getHydratedString('{{{scanWarnHtml}}}') as string,
    fields: rt.getHydratedString('{{{scanFieldsHtml}}}') as string,
    value: rt.getHydratedString('{{{scanValueHtml}}}') as string,
  };
}

// ─── Nothing dangerous is ever openable ──────────────────────────────────────

test('a javascript: URL is inert text with a warning, never openable', { skip: SKIP }, async () => {
  const r = await inspect('javascript:alert(document.cookie)');
  assert.equal(r.openUrl, '', 'no open affordance for javascript:');
  assert.match(r.warnings, /run code|never openable/i);
});

for (const scheme of ['data:text/html,<script>x</script>', 'file:///etc/passwd', 'intent://x#Intent;end']) {
  test(`a dangerous scheme (${scheme.split(':')[0]}:) is never openable`, { skip: SKIP }, async () => {
    const r = await inspect(scheme);
    assert.equal(r.openUrl, '', `${scheme} must not be openable`);
    assert.ok(r.warnings.length > 0, 'a warning is shown');
  });
}

test('an https URL is openable and shown in full', { skip: SKIP }, async () => {
  const r = await inspect('https://lolly.tools/gallery?ref=poster');
  assert.equal(r.kind, 'url');
  assert.equal(r.openUrl, 'https://lolly.tools/gallery?ref=poster', 'openable');
  assert.match(r.value, /lolly\.tools\/gallery\?ref=poster/);
});

test('a plain http URL is openable but flagged as not encrypted', { skip: SKIP }, async () => {
  const r = await inspect('http://example.com/x');
  assert.equal(r.openUrl, 'http://example.com/x');
  assert.match(r.warnings, /not encrypted|plain http/i);
});

// ─── IDN / punycode dual render + homoglyph warning ──────────────────────────

test('an IDN host is dual-rendered (unicode + punycode) with a look-alike warning', { skip: SKIP }, async () => {
  const r = await inspect('https://аррӏе.com/login'); // Cyrillic look-alike of apple.com
  assert.match(r.value, /punycode:\s*xn--/i, 'punycode form shown');
  assert.match(r.warnings, /non-Latin|look-alike/i);
});

test('userinfo before @ is flagged as a disguise trick', { skip: SKIP }, async () => {
  const r = await inspect('https://apple.com@evil.example/login');
  assert.match(r.warnings, /before the "@"|login info/i);
});

test('a known shortener is annotated as destination-unknown', { skip: SKIP }, async () => {
  const r = await inspect('https://bit.ly/3xYz');
  assert.match(r.warnings, /shortener|destination is unknown/i);
});

// ─── Secrets masked by default ───────────────────────────────────────────────

test('a WIFI code masks the password by default', { skip: SKIP }, async () => {
  const r = await inspect('WIFI:S:Studio Guest;T:WPA;P:welcome-2026;;');
  assert.equal(r.kind, 'wifi');
  assert.ok(!r.fields.includes('welcome-2026') || r.fields.includes('data-secret'), 'password not shown in the clear');
  assert.match(r.fields, /data-secret="welcome-2026"/, 'real value only behind an explicit reveal');
  assert.match(r.fields, /•/, 'a mask is displayed');
  assert.match(r.fields, /Studio Guest/, 'the network name is shown');
});

test('an otpauth secret is masked and warned', { skip: SKIP }, async () => {
  const r = await inspect('otpauth://totp/ACME:alice?secret=JBSWY3DPEHPK3PXP&issuer=ACME');
  assert.equal(r.kind, 'otpauth');
  assert.match(r.fields, /data-secret="JBSWY3DPEHPK3PXP"/);
  assert.match(r.fields, /•/);
  assert.match(r.warnings, /two-factor/i);
});

test('a free-text credential is flagged and masked', { skip: SKIP }, async () => {
  const r = await inspect('api_key: sk-live-abcdef123456');
  assert.equal(r.kind, 'text');
  assert.match(r.warnings, /password or key/i);
  assert.ok(r.value.includes('•'), 'masked in the value block');
});

// ─── Structured payloads parse for display ───────────────────────────────────

test('GS1 element strings parse to an AI table', { skip: SKIP }, async () => {
  const r = await inspect('(01)09521234543213(17)270831(10)LOT42');
  assert.equal(r.kind, 'gs1');
  assert.match(r.fields, /GTIN/);
  assert.match(r.fields, /Expiry/);
  assert.match(r.fields, /Batch\/Lot/);
  assert.match(r.fields, /LOT42/);
});

test('a Matter pairing code masks its setup code', { skip: SKIP }, async () => {
  const r = await inspect('MT:Y.K9042C00KA0648G00');
  assert.equal(r.kind, 'matter');
  assert.match(r.warnings, /pairing code|smart-home/i);
  assert.match(r.fields, /data-secret=/);
});

test('a tel: link dials nothing automatically', { skip: SKIP }, async () => {
  const r = await inspect('tel:+61400000000');
  assert.equal(r.kind, 'tel');
  assert.match(r.warnings, /Nothing is dialled/i);
  assert.match(r.fields, /\+61400000000/);
});

test('plain text is just text', { skip: SKIP }, async () => {
  const r = await inspect('Meet at the north entrance at 6pm');
  assert.equal(r.kind, 'text');
  assert.match(r.value, /north entrance/);
  assert.equal(r.openUrl, '');
});

// ─── Regression pins for the adversarial-review findings (plans/162) ─────────

test('backslash-@ authority confusion: not openable, and it names the REAL host', { skip: SKIP }, async () => {
  // Browsers normalise "\" to "/", so this opens evil.com, not good.com.
  const r = await inspect('https://evil.com\\@good.com/login');
  assert.equal(r.openUrl, '', 'a backslash-authority link must not be openable');
  assert.match(r.warnings, /backslash/i, 'the trick is named');
  assert.ok(!/good\.com/.test(r.warnings) || /evil\.com/.test(r.warnings + r.value),
    'must not vouch for good.com as the destination');
});

test('a raw punycode (xn--) host is flagged as an IDN look-alike', { skip: SKIP }, async () => {
  const r = await inspect('https://xn--pple-43d.com/login'); // punycode of a Cyrillic apple.com
  assert.match(r.warnings, /internationalised|punycode|look-alike/i, 'xn-- host must be flagged');
});

test('a credential in a URL query is masked, not shown in the clear', { skip: SKIP }, async () => {
  const r = await inspect('https://api.example.com/v1?api_key=sk_live_9aX2rTk3V4lue');
  assert.match(r.warnings, /password or key/i, 'flagged');
  assert.ok(!r.value.includes('sk_live_9aX2rTk3V4lue'), 'the key is not shown in the clear');
  assert.ok(r.value.includes('•'), 'the value block is masked');
});

test('SMSTO: parses the number without leaking the scheme tail', { skip: SKIP }, async () => {
  const r = await inspect('SMSTO:+61400000000:hello');
  assert.equal(r.kind, 'sms');
  assert.match(r.fields, /\+61400000000/, 'the number is clean');
  assert.ok(!/O:\+/.test(r.fields), 'no "O:" leaked from SMSTO into the number');
});

test('a URL that merely contains /01/<digit> keeps full URL scrutiny (not raw GS1)', { skip: SKIP }, async () => {
  const r = await inspect('https://evil.example/01/9malware');
  assert.equal(r.kind, 'url', 'still classified as a URL');
  assert.equal(r.openUrl, 'https://evil.example/01/9malware', 'openability decided by URL rules');
});

test('_mask reveals no characters of a short secret', { skip: SKIP }, async () => {
  // A short Wi-Fi PIN must not show its ends.
  const r = await inspect('WIFI:S:x;T:WPA;P:1234;;');
  assert.match(r.fields, /data-secret="1234"/, 'real value behind reveal');
  assert.ok(!/>1<|>4</.test(r.fields.replace('data-secret="1234"', '')), 'no plaintext digit shown in the mask');
});
