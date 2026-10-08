// SPDX-License-Identifier: MPL-2.0
/**
 * Rondocode songs through the MCP server (plan 301 phase C).
 *
 * A song reaches the server as an audio input: a rondocode share link passed to an
 * `asset` input (audiogram's `audio`), or a `.rondo.json` file handed to a file
 * utility (clean). Either way node-shell's host.audio renders it in a Worker, its
 * code in the `vm` execution class, and never in this process's realm. Pinned here,
 * over the real tool handlers:
 *
 *   - `lolly_render` answers with the execution class and every silent part, by
 *     stable code, for a song given as a share link
 *   - `lolly_transform` does the same for a song given as a file
 *   - the caps are the request's: a hosted deployment gets the hosted caps, the
 *     longest song can be changed alone, and a host built outside any request
 *     still gets the hosted caps
 *   - a song past the cap is cut to it and says so; a song that does not render is
 *     named in the result even when the tool's hook caught the error
 *
 * Run with: node --test services/mcp/test/rondo-audio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'fflate';
import { rondoSourceBytes } from '@lolly/engine';
import { HOSTED_RONDO_CAPS, LOCAL_RONDO_CAPS, RondoAudioError } from '@lolly-tools/node-shell/audio';
import { callTool } from '../src/tools.ts';
import { render } from '../src/render.ts';
import { withHost } from '../src/host.ts';
import { audioRunText, rondoCapsFor } from '../src/audio-runs.ts';
import { loadToolCached } from '../src/catalog.ts';

const fixtures = fileURLToPath(new URL('../../../packages/rondo/test/fixtures/examples.json', import.meta.url));
const { examples } = JSON.parse(readFileSync(fixtures, 'utf8')) as { examples: { name: string; js: string }[] };
const codeOf = (name: string): string => examples.find(e => e.name === name)!.js;
const shareLink = (name: string, code: string): string =>
  `https://rondocode.com/#s=d${Buffer.from(deflateSync(new TextEncoder().encode(JSON.stringify({ n: name, c: code })))).toString('base64url')}`;

const hasTool = async (id: string): Promise<boolean> => (await loadToolCached(id).catch(() => null)) !== null;
const textOf = (r: { content: Array<{ type: string; text?: string }> }): string =>
  r.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');

test('lolly_render: a song as a share link reports the vm class and its silent parts', async (t) => {
  if (!(await hasTool('audiogram'))) return t.skip('audiogram is not in this catalog');
  const result = await callTool('lolly_render', {
    toolId: 'audiogram', format: 'html', link: false,
    inputs: { audio: shareLink('Live mic', codeOf('live mic')) },
  }) as { content: Array<{ type: string; text?: string }>; isError?: boolean };
  const text = textOf(result);
  assert.notEqual(result.isError, true, text);
  assert.match(text, /Audio: song "Live mic" rendered [\d.]+ s in the vm execution class \(rondocode [0-9a-f]{12}\+lolly\.\d+, seed \d+\)\./);
  assert.match(text, /rondo\.part\.mic - Parts that play the live microphone are silent in a render: breath, talkbox\./);
  // The tool analyses twice (a frame-rate guess, then the real pass): one render, one report.
  assert.equal(text.match(/Audio: song/g)?.length, 1);
});

test('lolly_transform: a song as a .rondo.json file reports the vm class', async (t) => {
  if (!(await hasTool('clean'))) return t.skip('clean is not in this catalog');
  const bytes = rondoSourceBytes({ schemaVersion: 1, format: 'rondocode', name: 'Acid', lang: 'js', code: codeOf('acid') });
  const result = await callTool('lolly_transform', {
    toolId: 'clean',
    file: { base64: Buffer.from(bytes).toString('base64'), name: 'acid.rondo.json', mime: 'application/json' },
    inputs: { normalize: 'off', trimSilence: false },
  }) as { content: Array<{ type: string; text?: string; resource?: { blob?: string } }>; isError?: boolean };
  const text = textOf(result);
  assert.notEqual(result.isError, true, text);
  assert.match(text, /Audio: song "Acid" rendered [\d.]+ s in the vm execution class/);
  assert.match(text, /Every part played\./);
  // An on-device utility adds no provenance, so the file does not record the song,
  // and the result says so rather than leaving an agent to assume it does.
  assert.match(text, /Songs: Content Credentials in this file do not record "Acid"\./);
  const wav = Buffer.from(result.content.find(c => c.type === 'resource')?.resource?.blob ?? '', 'base64');
  assert.equal(wav.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString('latin1'), 'WAVE');
});

test('the caps follow the deployment, and the longest song can be changed alone', () => {
  assert.deepEqual(rondoCapsFor({}, true), { ...HOSTED_RONDO_CAPS });
  assert.deepEqual(rondoCapsFor({}, false), { ...LOCAL_RONDO_CAPS });
  assert.equal(rondoCapsFor({ LOLLY_MCP_RONDO_MAX_SECONDS: '12' }, true).maxSeconds, 12);
  assert.equal(rondoCapsFor({ LOLLY_MCP_RONDO_MAX_SECONDS: '12' }, true).timeoutMs, HOSTED_RONDO_CAPS.timeoutMs);
  assert.equal(rondoCapsFor({ LOLLY_MCP_RONDO_MAX_SECONDS: '9000' }, true).maxSeconds, HOSTED_RONDO_CAPS.maxSeconds, 'out of range is ignored');
  assert.ok(HOSTED_RONDO_CAPS.maxSeconds < LOCAL_RONDO_CAPS.maxSeconds);
  assert.equal(HOSTED_RONDO_CAPS.maxConcurrent, 1);
});

test('a host built outside any request renders songs under the hosted caps', async () => {
  const link = shareLink('Acid', codeOf('acid'));
  await assert.rejects(
    withHost({}, async (_dom, host) => host.audio!.decode!(link, { seconds: HOSTED_RONDO_CAPS.maxSeconds + 1 })),
    (e: unknown) => e instanceof RondoAudioError && e.code === 'rondo.limits.seconds',
  );
});

test('a song longer than the cap is cut to it and says so', async (t) => {
  if (!(await hasTool('audiogram'))) return t.skip('audiogram is not in this catalog');
  const query = new URLSearchParams({ audio: shareLink('Live mic', codeOf('live mic')) }).toString();
  const result = await render('audiogram', query, { format: 'html', rondo: { ...HOSTED_RONDO_CAPS, maxSeconds: 2 } });
  const run = result.audio?.[0];
  assert.ok(run, 'the song ran');
  assert.equal(run.seconds, 2);
  assert.ok(run.findings.some(f => f.code === 'rondo.limits.length'), JSON.stringify(run.findings));
});

test('a song that does not render is named in the result, though the tool drew a placeholder', async (t) => {
  if (!(await hasTool('audiogram'))) return t.skip('audiogram is not in this catalog');
  const query = new URLSearchParams({ audio: shareLink('Hostile', 'while (true) {}') }).toString();
  const result = await render('audiogram', query, {
    format: 'html',
    rondo: { ...HOSTED_RONDO_CAPS, vmLimits: { prepareBudgetMs: 300 } },
  });
  assert.ok(result.bytes.length > 0, 'the render still answered');
  assert.equal(result.audio, undefined);
  assert.deepEqual(result.audioFailures?.map(f => [f.name, f.code]), [['Hostile', 'rondo.vm.timeout']]);
  assert.match(audioRunText({ failures: result.audioFailures }), /Audio: song "Hostile" was not rendered: rondo\.vm\.timeout - /);
});
