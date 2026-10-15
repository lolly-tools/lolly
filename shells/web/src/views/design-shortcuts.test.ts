// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { ModifierKeys, TransformKind, TransformRules } from './free-canvas-transform.ts';

const dom = new JSDOM('<!DOCTYPE html><body><button id="opener">Help</button></body>', {
  url: 'https://lolly.test/',
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLDialogElement',
  'Event',
  'Node',
  'history',
  'location',
]) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[
    key
  ];
}
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  },
});
Object.defineProperty(dom.window.HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new dom.window.Event('close'));
  },
});

const { designShortcutGroups, openDesignShortcuts } = await import('./design-shortcuts.ts');
const { ROTATE_STEP, rotateSnap, transformRules } = await import('./free-canvas-transform.ts');

const here = dirname(fileURLToPath(import.meta.url));
/** The whole free-canvas feature: the orchestrator and every module, tests left out. */
function freeCanvasSource(): string {
  const dir = join(here, 'free-canvas');
  const modules = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'));
  return [readFileSync(join(here, 'free-canvas.ts'), 'utf8'), ...modules].join('\n');
}

test('the inventory documents every cross-surface Design chord, including style and panels', () => {
  const rows = designShortcutGroups('MacIntel').flatMap((group) => group.rows);
  const byLabel = new Map(rows.map((row) => [row.label, row.keys]));
  assert.equal(byLabel.get('Save to your library'), '⌘ S');
  assert.equal(byLabel.get('Export'), '⌘ E');
  assert.equal(byLabel.get('Present'), '⌘ Enter');
  assert.equal(byLabel.get('Copy / paste style'), '⌘ ⌥ C / V');
  assert.equal(byLabel.get('Toggle timeline'), '⌥ 1');
  assert.equal(byLabel.get('Keyboard shortcuts'), '?');
});

const SCALE_ROW = 'Scale mode: handles scale fonts, strokes, radii and effects, not only the box';

test('the K row is the canvas binding that turns Scale mode on and off', () => {
  for (const platform of ['MacIntel', 'Win32']) {
    const transform = designShortcutGroups(platform).find((group) => group.label === 'Transform');
    assert.ok(transform, `${platform}: the sheet has a Transform group`);
    assert.equal(transform.rows.find((row) => row.label === SCALE_ROW)?.keys, 'K');
  }
  // The binding itself, read from the whole feature so a moved handler is still found:
  // one call site, guarded by a bare K with no modifier held.
  const src = freeCanvasSource();
  const calls = src.split('fc.scaleMode.key()').length - 1;
  assert.equal(calls, 1, 'exactly one key handler reaches fc.scaleMode.key()');
  const at = src.indexOf('fc.scaleMode.key()');
  const guard = src.slice(src.lastIndexOf('if (', at), at);
  assert.match(guard, /e\.key === 'k' \|\| e\.key === 'K'/, 'the handler is bound to K');
  for (const held of ['!e.metaKey', '!e.ctrlKey', '!e.altKey', '!e.shiftKey']) {
    assert.ok(guard.includes(held), `the K binding requires ${held}`);
  }
  assert.match(src, /key: bindOp\(fc, keyScale\)/, 'fc.scaleMode.key is the Scale mode key handler');
});

/** What each modifier row promises, read through the modifier table's own answer. */
const MODIFIER_ROWS: Record<string, { kinds: TransformKind[]; holds: (rules: TransformRules) => boolean }> = {
  'While resizing: keep proportions': { kinds: ['resize'], holds: (r) => r.keepAspect },
  'While rotating: turn in 15 degree steps': { kinds: ['rotate'], holds: (r) => r.rotate.shift },
  'While resizing or scaling: work from the centre': { kinds: ['resize', 'scale'], holds: (r) => r.fromCentre },
  'While resizing or scaling: no snapping': { kinds: ['resize', 'scale'], holds: (r) => !r.snap },
  'While rotating: turn freely': { kinds: ['rotate'], holds: (r) => r.rotate.free },
  'While moving: no snapping': { kinds: ['move'], holds: (r) => !r.snap },
};

test('every Transform modifier row lists exactly the keys the modifier table honours', () => {
  for (const platform of ['MacIntel', 'Win32']) {
    const mac = platform === 'MacIntel';
    const glyphs: Record<string, keyof ModifierKeys> = mac
      ? { Shift: 'shiftKey', '⌥': 'altKey', '⌘': 'metaKey' }
      : { Shift: 'shiftKey', Alt: 'altKey', Ctrl: 'ctrlKey' };
    const transform = designShortcutGroups(platform).find((group) => group.label === 'Transform');
    assert.ok(transform);
    for (const [label, row] of Object.entries(MODIFIER_ROWS)) {
      const keys: string | undefined = transform.rows.find((r) => r.label === label)?.keys;
      assert.ok(keys, `${platform}: the sheet lists "${label}"`);
      const listed: Array<keyof ModifierKeys | undefined> = keys.split(' / ').map((glyph: string) => glyphs[glyph]);
      assert.ok(listed.every(Boolean), `${platform}: "${keys}" is made of modifier glyphs`);
      for (const kind of row.kinds) {
        assert.equal(row.holds(transformRules(kind, {})), false, `${kind} without a modifier does not "${label}"`);
        for (const modifier of Object.values(glyphs)) {
          assert.equal(
            row.holds(transformRules(kind, { [modifier]: true })),
            listed.includes(modifier),
            `${platform} ${kind}: ${modifier} and the "${label}" row agree`
          );
        }
      }
    }
  }
  // The step the Shift row quotes.
  assert.equal(ROTATE_STEP, 15);
  assert.equal(rotateSnap(22, { shift: true }), 15);
  assert.equal(rotateSnap(22), 22);
});

test('the sheet is an accessible dialog, uses text nodes, and restores focus on close', () => {
  const opener = document.getElementById('opener') as HTMLButtonElement;
  opener.focus();
  let closes = 0;
  const modal = openDesignShortcuts({
    opener,
    onClose: () => {
      closes++;
    },
  });
  assert.equal(modal.el.getAttribute('aria-label'), 'Design keyboard shortcuts');
  assert.equal(modal.el.querySelectorAll('.fc-shortcuts-group').length, 5);
  assert.ok(modal.el.querySelectorAll('kbd').length > 20);
  assert.equal(document.activeElement?.textContent, 'Done');

  (document.activeElement as HTMLButtonElement).click();
  assert.equal(modal.el.isConnected, false);
  assert.equal(closes, 1);
  assert.equal(document.activeElement, opener);
});
