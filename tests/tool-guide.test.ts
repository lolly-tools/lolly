// SPDX-License-Identifier: MPL-2.0
// The manifest `guide` block — a tool's short "now what?" walkthrough (schema +
// packages/core types + the shell dialog in shells/web/src/components/tool-guide.ts).
// Covered here: the schema contract every shell trusts, and the i18n sidecar
// overlay (engine/src/loader.ts's applyManifestI18n), whose guide traversal is
// mirrored by scripts/validate-catalog.ts and must not drift from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateManifest, applyManifestI18n } from '../engine/src/index.ts';
import type { ToolManifest } from '../engine/src/loader.ts';

const BASE = {
  id: 'guide-fixture',
  name: 'Guide Fixture',
  version: '1.0.0',
  engineVersion: '^1.0.0',
  status: 'official',
  render: { width: 100, height: 100, formats: ['png'] },
  inputs: [],
};

const withGuide = (guide: unknown): Record<string, unknown> => ({ ...BASE, guide });

const GUIDE = {
  title: 'Put it somewhere',
  tracks: [
    { id: 'desktop', label: 'On a computer', steps: ['Copy it', 'Paste it'], note: 'Same in Outlook.' },
    { id: 'mobile', label: 'On a phone', steps: ['Tap Copy'] },
  ],
};

test('a guide block validates, and a manifest without one still does', () => {
  assert.equal(validateManifest(withGuide(GUIDE)).valid, true);
  assert.equal(validateManifest(BASE).valid, true);
});

test('the guide schema rejects the shapes the dialog could not render', () => {
  const invalid: [string, unknown][] = [
    ['no tracks', { title: 'x' }],
    ['empty tracks', { tracks: [] }],
    ['track without steps', { tracks: [{ id: 'a', label: 'A' }] }],
    ['track without an id', { tracks: [{ label: 'A', steps: ['x'] }] }],
    ['non-slug track id', { tracks: [{ id: 'On Desktop', label: 'A', steps: ['x'] }] }],
    ['unknown track key', { tracks: [{ id: 'a', label: 'A', steps: ['x'], video: 'x' }] }],
    ['steps that are not strings', { tracks: [{ id: 'a', label: 'A', steps: [{ text: 'x' }] }] }],
  ];
  for (const [why, guide] of invalid) {
    assert.equal(validateManifest(withGuide(guide)).valid, false, `should have been rejected: ${why}`);
  }
});

test('an i18n sidecar translates the title, tab labels, notes and individual steps', () => {
  const manifest = structuredClone(withGuide(GUIDE)) as unknown as ToolManifest;
  applyManifestI18n(manifest, {
    'guide.title': 'Irgendwo einfügen',
    'guide.tracks.desktop.label': 'Am Computer',
    'guide.tracks.desktop.steps.1': 'Einfügen',
    'guide.tracks.desktop.note': 'Genauso in Outlook.',
    'guide.tracks.mobile.label': 'Am Telefon',
  });

  assert.equal(manifest.guide!.title, 'Irgendwo einfügen');
  const [desktop, mobile] = manifest.guide!.tracks;
  assert.equal(desktop!.label, 'Am Computer');
  assert.equal(desktop!.note, 'Genauso in Outlook.');
  // Sparse by design: step 0 was never translated, so it keeps its English.
  assert.deepEqual(desktop!.steps, ['Copy it', 'Einfügen']);
  assert.equal(mobile!.label, 'Am Telefon');
  assert.deepEqual(mobile!.steps, ['Tap Copy']);
});

test('a guide overlay key that resolves to nothing is ignored, never thrown', () => {
  const manifest = structuredClone(withGuide(GUIDE)) as unknown as ToolManifest;
  const before = structuredClone(manifest.guide);
  applyManifestI18n(manifest, {
    'guide.tracks.tablet.label': 'Am Tablet',        // unknown track
    'guide.tracks.mobile.steps.7': 'Schritt acht',   // past the end of the track
    'guide.tracks.mobile.blurb': 'nope',             // unknown field
    'guide.subtitle': 'nope',                        // unknown guide field
  });
  assert.deepEqual(manifest.guide, before);

  // A manifest with no guide at all must survive a stale sidecar unchanged.
  const plain = structuredClone(BASE) as unknown as ToolManifest;
  applyManifestI18n(plain, { 'guide.title': 'Irgendwo einfügen', name: 'Fixture' });
  assert.equal(plain.guide, undefined);
  assert.equal(plain.name, 'Fixture');
});

// The shipped guide this feature was built for. Its steps name controls the web
// shell actually renders (Export → format → Copy), so a rename that orphans the
// walkthrough should surface here rather than in a user's Gmail settings.
test('the email-signature guide points at the export path the shell provides', () => {
  const path = new URL('../brands/suse/tools/email-signature/tool.json', import.meta.url);
  let manifest: Record<string, any>;
  try { manifest = JSON.parse(readFileSync(fileURLToPath(path), 'utf8')); }
  catch { return; }   // private brand pack not mounted (public clone / CI) — nothing to check

  assert.equal(validateManifest(manifest).valid, true);
  const guide = manifest.guide;
  assert.ok(guide, 'email-signature should ship a guide');
  assert.deepEqual(guide.tracks.map((t: any) => t.id), ['desktop', 'mobile']);
  // Every track's first step is the copy instruction, and html must remain an
  // offered format for it to be true (performCopy branches on it for rich HTML).
  assert.ok(manifest.render.formats.includes('html'));
  assert.ok(manifest.render.actions.includes('copy'));
  for (const track of guide.tracks) {
    assert.match(track.steps[0], /\*\*HTML\*\*/, `${track.id}: first step should name the HTML format`);
    assert.match(track.steps[0], /\*\*Copy\*\*/, `${track.id}: first step should name the Copy action`);
  }
});
