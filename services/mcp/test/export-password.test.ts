// SPDX-License-Identifier: MPL-2.0
/**
 * `password` on the routes that fail before any browser starts: what lolly_render refuses,
 * what the public GET route says, and that no answer repeats the value.
 * The browser half reads real files back in export-password.browser.test.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { renderGet, _resetRenderGetCaches } from '../src/render-get.ts';
import { render, RenderError } from '../src/render.ts';
import { callTool, TOOL_DEFS } from '../src/tools.ts';

const SECRET = 'Zq7-right-password';
const QR = { toolId: 'qr-code', inputs: { url: 'https://example.com' }, link: false };
const AGENDA = { toolId: 'agenda', inputs: {}, link: false };

const textOf = (result: { content: Array<{ type: string; text?: string }> }): string => result.content.filter(p => p.type === 'text').map(p => p.text).join('\n');

for (const [name, args, expected] of [
  ['a browser-free svg', { ...QR, format: 'svg', password: SECRET }, /"svg" file cannot carry a password/],
  ['a browser-free png', { ...QR, format: 'png', password: SECRET }, /"png" file cannot carry a password/],
  ['a Print PDF', { ...AGENDA, format: 'pdf-cmyk', password: SECRET }, /cannot lock a "pdf-cmyk"/],
  ['a PDF with bleed', { ...AGENDA, format: 'pdf', bleed: '3mm', password: SECRET }, /bleed or print marks/],
  ['a PDF with print marks', { ...AGENDA, format: 'pdf', marks: 'crop', password: SECRET }, /bleed or print marks/],
  ['a PDF password readers cannot type', { ...AGENDA, format: 'pdf', password: 'пароль123' }, /plain ASCII/],
] as Array<[string, Record<string, unknown>, RegExp]>) {
  test(`lolly_render fails on ${name}, with no file and no password in the answer`, async () => {
    const result = await callTool('lolly_render', args);
    assert.equal(result.isError, true, textOf(result));
    assert.match(textOf(result), expected);
    assert.match(textOf(result), /nothing was written/);
    assert.equal(result.content.some(p => p.type === 'resource' || p.type === 'image'), false, 'no file comes back');
    assert.ok(!JSON.stringify(result).includes(String(args.password)), 'the value is never repeated');
  });
}

test('a password that is not a string fails the call rather than becoming a file with no lock', async () => {
  const result = await callTool('lolly_render', { ...QR, format: 'pdf', password: 12345 });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /password must be a string/);
});

test('lolly_render refuses a password in a query argument it does not read', async () => {
  const result = await callTool('lolly_render', { ...QR, format: 'pdf', query: `password=${SECRET}` });
  assert.equal(result.isError, true);
  assert.match(textOf(result), /in the password argument/);
  assert.ok(!JSON.stringify(result).includes(SECRET));
});

test('a password left in a query is refused the same way as an argument', async () => {
  await assert.rejects(
    () => render('qr-code', `url=https%3A%2F%2Fexample.com&password=${SECRET}`, { format: 'svg' }),
    (error: Error) => error instanceof RenderError && /"svg" file cannot carry a password/.test(error.message) && !error.message.includes(SECRET),
  );
});

test('the public GET route refuses a password instead of redirecting to an unlocked file', async () => {
  _resetRenderGetCaches();
  const env = {} as NodeJS.ProcessEnv;
  const plain = await renderGet('/tool/qr-code.svg', `url=https%3A%2F%2Fexample.com&password=${SECRET}`, { ip: '10.9.0.1', env });
  assert.equal(plain.status, 400);
  const body = Buffer.from(plain.body as Uint8Array | string).toString('utf8');
  assert.match(body, /cannot lock a file/);
  assert.ok(!body.includes(SECRET) && !JSON.stringify(plain.headers).includes(SECRET));

  // Packed, the same word is in the address. The route reads what the packed form expands to.
  const packed = `z=1${deflateRawSync(`url=https%3A%2F%2Fexample.com&password=${SECRET}`).toString('base64url')}`;
  const viaPack = await renderGet('/tool/qr-code.svg', packed, { ip: '10.9.0.2', env });
  assert.equal(viaPack.status, 400);
  const packedBody = Buffer.from(viaPack.body as Uint8Array | string).toString('utf8');
  assert.match(packedBody, /cannot lock a file/);
});

test('the argument description says what the argument does', async () => {
  const def = TOOL_DEFS.find(tool => tool.name === 'lolly_render');
  assert.ok(def);
  const words = (def.inputSchema as { properties: Record<string, { description?: string }> }).properties.password?.description ?? '';
  assert.match(words, /"pdf" or "zip"/);
  assert.match(words, /fails the call/);
  assert.doesNotMatch(words, /—/);
});
