// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 E17, private: with the SUSE pack's themed role tokens, every colour that
 * differs between the delivered light and dark Sleepwalking decks is one token
 * reference, so one linked document resolves to the light rows in light and to the
 * dark rows in dark (bg, fg, stroke and the run colours).
 *
 * Gated: LOLLY_CHECK_DELIVERED points at the folder holding the delivered
 * light.lolly.boxes.json and dark.lolly.boxes.json, and brands/suse must be mounted.
 * Neither ships in a public clone; both skips are listed in tests/expected-skips.json.
 *
 * Run with: LOLLY_CHECK_DELIVERED=<dir> node --import ./tests/css-stub.mjs --test tests/design-colour-roles-suse.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createTokenSet } from '../engine/src/tokens.ts';
import { normaliseDesignColourRefs, readBlockRunBindings, resolveBlockTokenBindings } from '../engine/src/token-block-bindings.ts';
import type { BlockFieldSpec, InputValue } from '../engine/src/inputs.ts';

type Row = Record<string, unknown>;
const DELIVERED = (process.env.LOLLY_CHECK_DELIVERED ?? '').trim();
const TOKENS = new URL('../brands/suse/catalog/assets/suse/tokens/brand.json', import.meta.url).pathname;
const haveRows = !!DELIVERED && existsSync(join(DELIVERED, 'light.lolly.boxes.json')) && existsSync(join(DELIVERED, 'dark.lolly.boxes.json'));
const skip = !existsSync(TOKENS) ? 'brands/suse is not mounted on this machine'
  : !haveRows ? 'the delivered Sleepwalking rows are not on this machine (set LOLLY_CHECK_DELIVERED)' : false;
const FIELDS = ['bg', 'fg', 'stroke'];
const SPECS: BlockFieldSpec[] = [...FIELDS.map((id) => ({ id, type: 'color' as const })), { id: 'tokenLinks', type: 'text' }];

test('one linked document resolves to the delivered light rows in light and the dark rows in dark', { skip }, () => {
  const doc: unknown = JSON.parse(readFileSync(TOKENS, 'utf8'));
  const light = createTokenSet(doc, {});
  const dark = createTokenSet(doc, { selection: { '': 'dark' } });
  const lightRows = JSON.parse(readFileSync(join(DELIVERED, 'light.lolly.boxes.json'), 'utf8')) as Row[];
  const darkRows = new Map((JSON.parse(readFileSync(join(DELIVERED, 'dark.lolly.boxes.json'), 'utf8')) as Row[]).map((r) => [r.id, r]));
  // Every themed colour token, by its light|dark pair; semantic slots first, then roles.
  const byPair = new Map<string, string>();
  const paths = light.query({ type: 'color' }).map((e) => e.path).filter((p) => p.startsWith('color.semantic.') || p.startsWith('color.role.'));
  for (const path of paths) {
    const key = `${String(light.get(path)?.value).toLowerCase()}|${String(dark.get(path)?.value).toLowerCase()}`;
    if (!byPair.has(key)) byPair.set(key, path);
  }
  assert.ok(paths.some((p) => p.startsWith('color.role.')), 'the pack declares color.role.* tokens');
  let differing = 0;
  const missing: string[] = [];
  const authored = lightRows.map((row): Row => {
    const other = darkRows.get(row.id);
    if (!other) return row;
    const out: Row = { ...row };
    for (const f of FIELDS) {
      if (typeof row[f] !== 'string' || row[f] === other[f]) continue;
      differing += 1;
      const path = byPair.get(`${String(row[f]).toLowerCase()}|${String(other[f]).toLowerCase()}`);
      if (path) out[f] = `{${path}}`;
      else missing.push(`${String(row.id)}.${f}`);
    }
    // Run colours: each light run hex that changes becomes an @ reference.
    if (typeof row.text === 'string' && typeof other.text === 'string' && row.text !== other.text) {
      const lightHexes = [...row.text.matchAll(/\{#([0-9a-f]{6})\b/gi)].map((m) => m[1]!.toLowerCase());
      const darkHexes = [...other.text.matchAll(/\{#([0-9a-f]{6})\b/gi)].map((m) => m[1]!.toLowerCase());
      let text = row.text;
      lightHexes.forEach((hex, i) => {
        const path = byPair.get(`#${hex}|#${darkHexes[i]}`);
        if (path) text = text.split(`{#${hex}`).join(`{@${path}`);
        else missing.push(`${String(row.id)}.text #${hex}`);
      });
      out.text = text;
    }
    return out;
  });
  assert.ok(differing > 300, `the delivered decks differ in ${differing} colour fields`);
  assert.deepEqual(missing, [], 'every differing colour is one token reference');

  const linked = normaliseDesignColourRefs(authored as InputValue[], FIELDS, light, 'srgb', { onIssue: (i) => assert.fail(`${i.pointer}: ${i.message}`) }) as Row[];
  assert.ok(linked.some((r) => Object.keys(readBlockRunBindings(r.tokenLinks)).length), 'run links were written');
  const pick = (rows: Row[]): string[] => rows.map((r) => JSON.stringify([r.id, ...FIELDS.map((f) => typeof r[f] === 'string' ? String(r[f]).toLowerCase() : r[f]), r.text]));
  assert.deepEqual(pick(linked), pick(lightRows), 'in light the linked document is the light deck');
  const inDark = resolveBlockTokenBindings(linked as InputValue[], 'tokenLinks', SPECS, dark) as Row[];
  assert.deepEqual(pick(inDark), pick(lightRows.map((r) => darkRows.get(r.id) ?? r)), 'in dark the same document is the dark deck');
});
