// SPDX-License-Identifier: MPL-2.0
/**
 * A one- or two-colour SVG chosen in 3D Studio arrives as a colour pair whose A and B are
 * the artwork's own colours, in the order the studio numbers its material slots (first
 * painted is A). Artwork with more colours, or a paint the hook cannot read, keeps its
 * own materials. Runs the real community/3d-studio/hooks.js with a fake host.
 *
 *   node --import ./tests/css-stub.mjs --test tests/studio3d-artwork-colours.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'community/3d-studio/hooks.js'), 'utf8');

type Input = { id: string; value: unknown };
type Hooks = { onInput(ctx: { model: Input[]; id: string }): Promise<Record<string, unknown>> };

/** The hooks with a host whose assets hold `files` (id to SVG text). */
function load(files: Record<string, string>): Hooks {
  const host = {
    assets: {
      get: async (id: string) => ({ id, url: `blob:${id}`, name: id }),
      bytes: async (ref: { id: string }) => new TextEncoder().encode(files[ref.id] ?? ''),
    },
  };
  return new Function('host', `${source}\nreturn { onInput };`)(host) as Hooks;
}

const model = (values: Record<string, unknown>): Input[] =>
  Object.entries({ source: 'artwork', materialMode: 'source', colorA: '{color.semantic.secondary}', colorB: '{color.semantic.primary}', ...values })
    .map(([id, value]) => ({ id, value }));

// A lolly-demo Etiquette icon as it ships: classes set in a stylesheet inside defs,
// the base painted first.
const ETIQUETTE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><style>.c1{fill:#50c369}.c2{fill:#033633}</style></defs><path class="c2" d="M3 20L3 4H5V19H20V21H4Z"/><path class="c1" d="M7 18C9 18 11 12 17 6V8C12 13 10 18 7 18Z"/></svg>';

describe('3D Studio artwork colours', () => {
  it('turns a two-tone icon into a colour pair of its own colours, first painted as A', async () => {
    const hooks = load({ 'lolly/icons/animation': ETIQUETTE });
    const patch = await hooks.onInput({ model: model({ artwork: 'lolly/icons/animation' }), id: 'artwork' });
    assert.equal(patch.materialMode, 'pair');
    assert.equal(patch.colorA, '#033633');
    assert.equal(patch.colorB, '#50c369');
  });

  it('reads groups, inline styles, short hex and strokes in paint order', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><!-- <path fill="#ff0000"/> --><g fill="#0A0"><rect width="4" height="4"/></g><path style="fill:none;stroke:#123456" d="M0 0L4 4"/></svg>';
    const patch = await load({ two: svg }).onInput({ model: model({ artwork: 'two' }), id: 'artwork' });
    assert.deepEqual([patch.colorA, patch.colorB], ['#00aa00', '#123456']);
  });

  it('gives a one-colour SVG the same colour as A and B', async () => {
    const patch = await load({ one: '<svg><path d="M0 0H4V4Z"/></svg>' }).onInput({ model: model({ artwork: 'one' }), id: 'artwork' });
    assert.deepEqual([patch.materialMode, patch.colorA, patch.colorB], ['pair', '#000000', '#000000']);
  });

  it('leaves artwork with three colours, or a paint it cannot read, on its own materials', async () => {
    const three = '<svg><path fill="#111111" d="M0 0H1V1Z"/><path fill="#222222" d="M2 0H3V1Z"/><path fill="#333333" d="M4 0H5V1Z"/></svg>';
    const current = '<svg><path fill="currentColor" d="M0 0H1V1Z"/></svg>';
    const hooks = load({ three, current });
    for (const artwork of ['three', 'current']) {
      const patch = await hooks.onInput({ model: model({ artwork }), id: 'artwork' });
      assert.equal(patch.materialMode, undefined, artwork);
      assert.equal(patch.colorA, undefined, artwork);
    }
  });

  it('seeds the pair again when Materials switches to a colour pair, and not on other edits', async () => {
    const hooks = load({ icon: ETIQUETTE });
    const switched = await hooks.onInput({ model: model({ artwork: 'icon', materialMode: 'pair' }), id: 'materialMode' });
    assert.deepEqual([switched.colorA, switched.colorB], ['#033633', '#50c369']);
    const other = await hooks.onInput({ model: model({ artwork: 'icon', materialMode: 'pair', colorA: '#ff0000' }), id: 'colorA' });
    assert.equal(other.colorA, undefined, 'a colour the reader picked is kept');
  });
});
