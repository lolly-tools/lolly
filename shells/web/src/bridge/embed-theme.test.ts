// SPDX-License-Identifier: MPL-2.0
/**
 * A tool link written into a template (`<img src="https://lolly.tools/tool/...">`) and
 * theme choices (plans/319 A6). resolveLollyToolUrl renders each such link through
 * `host.compose.render(embedComposeSpec(...))`; this suite pins that the link's own
 * `_themes` reaches the spec, and that the hosts the views hand to hydrateEmbeds (the
 * multi-edit cell's and the offscreen stage's, both from lib/theme-choices.ts
 * withComposeSelection) put the document's choices under the link's own. The whole path is checked
 * in a real browser by tests/theme-choices-offscreen.browser.test.ts.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/embed-theme.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AssetRef, HostV1, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import { parseEmbedUrl } from '@lolly/engine';
import { embedComposeSpec } from './embed.ts';
import { withComposeSelection } from '../lib/theme-choices.ts';
import { documentHosts } from '../pro/render-export.ts';
import { addColourway } from '../../../../engine/src/colourway.ts';
import { inspectTokenDocument } from '../../../../engine/src/token-inspect.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

const QR = JSON.parse(readFileSync(new URL('../../../../community/qr-code/tool.json', import.meta.url), 'utf8')) as ToolManifest;
const DARK = { '': 'dark' };
const PERSIMMON_LIGHT = { '': 'light', colourway: 'persimmon' };
const PERSIMMON_DARK = { '': 'dark', colourway: 'persimmon' };

const link = (themes?: Record<string, string>) =>
  `https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Fexample.com${themes ? `&_themes=${encodeURIComponent(JSON.stringify(themes))}` : ''}`;
const spec = (themes?: Record<string, string>) => embedComposeSpec(parseEmbedUrl(link(themes))!, QR, ['design']);

/** Lolly Start with a Persimmon colourway, its design system set to dark Persimmon. */
function storedDoc(): Record<string, unknown> {
  const start = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
  const result = addColourway(start, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
  const doc = structuredClone(result.doc) as Record<string, unknown>;
  doc.$metadata = { ...(doc.$metadata as object ?? {}), activeThemeSelection: PERSIMMON_DARK };
  return doc;
}

/** A host whose compose.render records the choices each spec carries. */
function recordingHost(doc: unknown = storedDoc()) {
  const seen: unknown[] = [];
  const ref = { source: 'remote', id: 'x', type: 'vector', url: 'blob:x' } as AssetRef;
  const host = {
    version: '1', shell: 'web',
    tokens: { inspect: async (opts?: TokenResolveOptions) => inspectTokenDocument(doc, opts) },
    compose: { render: async (s: { tokenSelection?: unknown }) => { seen.push(s.tokenSelection); return ref; } },
  } as unknown as HostV1;
  return { host, seen };
}

test('an embed that names theme choices carries them; one that names none carries no key at all', () => {
  assert.deepEqual(spec(DARK).tokenSelection, DARK);
  assert.deepEqual(spec(PERSIMMON_DARK).tokenSelection, PERSIMMON_DARK);
  const plain = spec();
  assert.equal('tokenSelection' in plain, false);
  assert.equal(plain.thumbnail, false, 'an embed is part of the output, at export quality');
  assert.deepEqual(plain._stack, ['design'], 'the recursion stack is threaded through');
  assert.equal(plain.inputs.url, 'https://example.com');
});

test('a multi-edit cell\'s host puts the session\'s choices under the embed\'s own', async () => {
  // The wrapper views/multi-edit.ts hands hydrateEmbeds: the session's choices, read per call.
  const { host, seen } = recordingHost();
  let session: Record<string, string> | undefined = PERSIMMON_DARK;
  const cell = withComposeSelection(host, () => session);
  await cell.compose!.render(spec({ '': 'light' }));
  await cell.compose!.render(spec());
  session = DARK;
  await cell.compose!.render(spec({ colourway: 'persimmon' }));
  assert.deepEqual(seen, [PERSIMMON_LIGHT, PERSIMMON_DARK, PERSIMMON_DARK]);
});

test('the offscreen stage\'s host does the same for a row with choices, and fills from the design system for one without', async () => {
  const withChoices = recordingHost();
  await documentHosts(withChoices.host, DARK).canvas.compose!.render(spec({ colourway: 'persimmon' }));
  assert.deepEqual(withChoices.seen, [PERSIMMON_DARK]);
  const without = recordingHost();
  const canvas = documentHosts(without.host, undefined).canvas;
  await canvas.compose!.render(spec({ '': 'light' }));
  await canvas.compose!.render(spec());
  assert.deepEqual(without.seen, [PERSIMMON_LIGHT, undefined], 'the stored colourway fills the group the link leaves out');
});

test('an unwrapped host is handed the embed\'s own choices only', async () => {
  const { host, seen } = recordingHost();
  await host.compose!.render(spec({ '': 'light' }));
  assert.deepEqual(seen, [{ '': 'light' }], 'which is why every view that hydrates embeds wraps its host');
});
