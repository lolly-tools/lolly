// SPDX-License-Identifier: MPL-2.0
/**
 * Keybind exclusivity (plan 342 I6): two actions may share a key only if the gates that make each one available are
 * exclusive. Three checks over the shortcut registries the shell has:
 *
 *  1. Design canvas inventory (design-shortcuts.ts). Rows that share a chord, after expanding "A / B" and "A or B"
 *     alternatives, must each carry a `gate`, all different, all in one class (a `drag:` gate is one drag kind at a time).
 *     A key listed twice with the same label is a duplicate row.
 *  2. Timeline panel (timeline-config.ts PANEL_SHORTCUTS). Every row lives under one gate, panel focus, so no two rows may
 *     handle the same key event (key, ctrl, meta, alt, shift).
 *  3. Across the two. Design and the panel do share keys (Home, End, K, Delete, Ctrl A, ?). They are exclusive because the canvas
 *     handler bails while focus is inside `.tl-panel` (free-canvas/keys.ts), and the panel only sees keydown events whose
 *     target is inside its own root. The source check below fails if that bail is removed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Event', 'Node', 'history', 'location']) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
const { designShortcutGroups } = await import('./design-shortcuts.ts');
const { PANEL_SHORTCUTS } = await import('./timeline-config.ts');
const here = dirname(fileURLToPath(import.meta.url));

/** "Ctrl Shift [ / ]" is two chords: the second inherits the first's modifiers. */
function chordsOf(keys: string): string[] {
  const norm = keys.replace(/\s+or\s+/g, ' / ').replace(/\s+/g, ' ').trim();
  const parts = norm.split(' / ').map((p) => p.trim()).filter(Boolean);
  const first = parts[0] ?? '';
  const prefix = first.includes(' ') ? first.slice(0, first.lastIndexOf(' ')) : '';
  return parts.map((p, i) => (i > 0 && prefix && !p.includes(' ') ? `${prefix} ${p}` : p));
}

test('chord expansion', () => {
  assert.deepEqual(chordsOf('Ctrl Shift [ / ]'), ['Ctrl Shift [', 'Ctrl Shift ]']);
  assert.deepEqual(chordsOf('Shift H / V'), ['Shift H', 'Shift V']);
  assert.deepEqual(chordsOf('Enter / F2'), ['Enter', 'F2']);
  assert.deepEqual(chordsOf('/  or  \\'), ['/', '\\']);
  assert.deepEqual(chordsOf('Alt / Ctrl'), ['Alt', 'Ctrl']);
  assert.deepEqual(chordsOf('Z / Alt Z + click'), ['Z', 'Alt Z + click']);
});

for (const platform of ['MacIntel', 'Linux x86_64']) {
  test(`Design inventory (${platform}): a shared chord needs distinct gates of one class`, () => {
    const byChord = new Map<string, { label: string; gate?: string }[]>();
    for (const group of designShortcutGroups(platform)) {
      for (const row of group.rows) {
        if (row.gesture) continue;
        for (const chord of chordsOf(row.keys)) byChord.set(chord, [...(byChord.get(chord) ?? []), { label: row.label, gate: row.gate }]);
      }
    }
    const problems: string[] = [];
    for (const [chord, rows] of byChord) {
      if (rows.length < 2) continue;
      if (new Set(rows.map((r) => r.label)).size !== rows.length) { problems.push(`"${chord}" is listed twice with the same label`); continue; }
      const gates = rows.map((r) => r.gate);
      if (gates.some((g) => !g)) { problems.push(`"${chord}" is shared by ${rows.map((r) => `"${r.label}"`).join(', ')} and not every row declares a gate`); continue; }
      const classes = new Set(gates.map((g) => g!.split(':')[0]));
      if (classes.size !== 1 || new Set(gates).size !== gates.length) problems.push(`"${chord}" gates are not exclusive: ${gates.join(', ')}`);
    }
    assert.deepEqual(problems, []);
  });
}

test('a gate is declared only where a chord is actually shared', () => {
  const count = new Map<string, number>();
  const gated: { chords: string[]; label: string }[] = [];
  for (const group of designShortcutGroups('Linux x86_64')) for (const row of group.rows) {
    const chords = chordsOf(row.keys);
    for (const c of chords) count.set(c, (count.get(c) ?? 0) + 1);
    if (row.gate) gated.push({ chords, label: row.label });
  }
  for (const g of gated) assert.ok(g.chords.some((c) => (count.get(c) ?? 0) > 1), `"${g.label}" has a gate but shares no chord`);
});

const eventSignature = (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }): string =>
  [e.metaKey ? 'meta' : '', e.ctrlKey ? 'ctrl' : '', e.altKey ? 'alt' : '', e.shiftKey ? 'shift' : '', e.key.toLowerCase() === 'spacebar' ? ' ' : e.key.toLowerCase()].filter(Boolean).join('+');

test('Timeline panel: no two rows handle the same key event', () => {
  const seen = new Map<string, string>(), clashes: string[] = [];
  for (const row of PANEL_SHORTCUTS) {
    for (const event of row.events) {
      const sig = eventSignature(event);
      // "Space" is written with two spellings of one key inside a single row.
      if (seen.has(sig) && seen.get(sig) !== row.label) clashes.push(`${sig}: "${seen.get(sig)}" and "${row.label}"`);
      seen.set(sig, row.label);
    }
  }
  assert.deepEqual(clashes, []);
});

test('Design and the timeline panel share keys only under exclusive focus gates', () => {
  const design = new Set<string>();
  for (const group of designShortcutGroups('Linux x86_64')) for (const row of group.rows) if (!row.gesture) for (const c of chordsOf(row.keys)) design.add(c.toLowerCase());
  const shared: string[] = [];
  for (const row of PANEL_SHORTCUTS) for (const event of row.events) {
    const chord = [event.ctrlKey || event.metaKey ? 'ctrl' : '', event.altKey ? 'alt' : '', event.shiftKey ? 'shift' : '', event.key.toLowerCase()].filter(Boolean).join(' ');
    if (design.has(chord)) shared.push(chord);
  }
  // Recorded so a new overlap shows up in review: these are the ones the focus gate below has to keep apart.
  assert.deepEqual([...new Set(shared)].sort(), ['+', '?', 'ctrl a', 'delete', 'end', 'home', 'k']);

  const keys = readFileSync(join(here, 'free-canvas/keys.ts'), 'utf8');
  assert.ok(/if \(fc\.timelinePanel && \(document\.activeElement as HTMLElement \| null\)\?\.closest\?\.\('\.tl-panel'\)\)\s*return;/.test(keys), 'the canvas key handler no longer bails while focus is in .tl-panel');
  const panel = readFileSync(join(here, 'timeline-panel.ts'), 'utf8');
  assert.ok(/root\.addEventListener\('keydown', tp\.panel\.onKey\)/.test(panel), 'the timeline panel no longer binds its keys on its own root');
});
