// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const parts = join(import.meta.dirname, '..', 'styles', 'parts');
const css = (name: string): string => readFileSync(join(parts, name), 'utf8');

const contractFiles = [
  'design-topbar.css',
  'design-navigator.css',
  'design-inspector.css',
  'design-guides.css',
  'timeline.css',
] as const;

test('Design workspace composites consume the semantic Lolly UI contract', () => {
  for (const name of contractFiles) {
    const source = css(name);
    assert.match(source, /var\(--ui-color-surface-/u, `${name} has a semantic surface`);
    assert.match(source, /var\(--ui-color-text-/u, `${name} has semantic text`);
    assert.match(source, /var\(--ui-color-focus-ring\)/u, `${name} has the shared focus ring`);
  }
  assert.match(css('design-navigator.css'), /var\(--ui-color-selection-surface\)/u);
  assert.match(css('timeline.css'), /var\(--ui-motion-feedback\)/u);
  assert.match(css('timeline.css'), /var\(--ui-elevation-sheet\)/u);
});

test('Design panel sheets no longer bypass the app contract for stock theme roles', () => {
  const bypass = /hsl\(var\(--(?:card(?:-foreground)?|popover(?:-foreground)?|background|foreground|muted(?:-foreground)?|primary(?:-foreground)?|border|ring|accent(?:-foreground)?)\)/u;
  for (const name of contractFiles) {
    assert.doesNotMatch(css(name), bypass, `${name} must use a --ui-* semantic alias`);
  }
});

test('the floating toolbar and export sheet roots use semantic surfaces and elevation', () => {
  const editor = css('editor.css');
  assert.match(editor, /\.fc-toolbar\s*\{[^}]*background:\s*var\(--ui-color-surface-raised\)[^}]*box-shadow:\s*var\(--ui-elevation-floating\)/su);
  assert.match(editor, /\.fc-popover\s*\{[^}]*var\(--ui-color-surface-overlay\)[^}]*var\(--ui-elevation-floating\)/su);

  const tool = css('tool.css');
  assert.match(tool, /\.render-pill\s*\{[^}]*background:\s*var\(--ui-color-action-primary\)[^}]*box-shadow:\s*var\(--ui-elevation-floating\)/su);
  assert.match(tool, /\.export-popup\s*\{[^}]*var\(--ui-color-surface-raised\)[^}]*var\(--ui-elevation-sheet\)/su);
});
