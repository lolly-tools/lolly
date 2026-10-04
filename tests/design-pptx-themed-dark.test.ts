// SPDX-License-Identifier: MPL-2.0
/**
 * Tier A PowerPoint and a light archetype drawn dark (plan 291 M4). Compose draws a
 * light archetype with no dark twin under the design system's Dark theme
 * (`compose.dark.themed`), so the frame keeps the light archetype's id with a dark
 * ground. Its slide binds the light layout, so PowerPoint's Reset Slide, or a new
 * slide from that layout, comes back light: the export notes name those slides, once per deck.
 *
 * Public: the neutral master.
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-pptx-themed-dark.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { designFramesToPptx } from '../packages/node-shell/src/design-pptx.ts';

const master = neutralSlideMaster();
const TOKENS: Record<string, string> = { 'color.semantic.text': '#11141f', 'color.semantic.surface': '#ffffff', 'color.ramp.neutral.8': '#eef1f4' };
const tokens = (path: string): string | undefined => TOKENS[path];

function frame(archetype: string, id: string, x: number, bg?: string) {
  const s = seedFrame(master, archetype, { frameId: id, x, y: 0, resolveToken: tokens });
  assert.ok(s);
  if (bg) s.frame.bg = bg;
  for (const l of s.layers) if (l.kind === 'text') l.text = 'Words';
  return { row: s.frame, layers: s.layers };
}

test('a light archetype drawn dark is noted: its layout is the light one, so Reset Slide comes back light', async () => {
  const out = await designFramesToPptx({
    frames: [frame('main-point', 's01', 0, '#13294b'), frame('main-point', 's02', 2000), frame('content', 's03', 4000, 'var(--brand-surface, #0c322c)')],
    master,
    tokens,
  });
  const note = out.notes.find((n) => /Reset Slide/.test(n));
  assert.ok(note, `a note names the limit (${out.notes.join(' | ')})`);
  assert.match(note, /slides 1 and 3/);
  assert.match(note, /Main point/);
  // A dark archetype drawn dark, or a light one left light, says nothing.
  const quiet = await designFramesToPptx({ frames: [frame('main-point', 's01', 0), frame('title', 's02', 2000)], master, tokens });
  assert.ok(!quiet.notes.some((n) => /Reset Slide/.test(n)));
});
