// SPDX-License-Identifier: MPL-2.0
// Coherence check for the M0b DocsRenderContext seam: a minimal mock context must
// satisfy the interface, and its shapes must be constructible. This is a compile-time
// guarantee (the interface is implementable) plus a reference for the two real adapters
// coming in M0b (build.ts filesystem/C2PA) and M2 (in-app manifest + fetch).
// Run: node --test packages/docs-render/test/context.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  DocsRenderContext,
  CredentialFacts,
  ShotResolution,
} from '../src/index.ts';

// A trivial in-memory context: the smallest thing that satisfies the interface. The
// build-time and runtime adapters are richer, but must present exactly this surface.
function mockContext(overrides: Partial<DocsRenderContext> = {}): DocsRenderContext {
  let seq = 0;
  return {
    lang: 'en',
    htmlLang: 'en',
    t: (en) => en,
    docIcon: () => '',
    docLogo: () => '',
    docLogoBlock: () => '',
    nextCredId: () => `shot-cred-${++seq}`,
    localizedShot: () => null,
    darkShot: () => null,
    shotSize: () => null,
    credential: () => null,
    tryLink: () => null,
    showcase: () => null,
    art: () => null,
    ...overrides,
  };
}

test('a minimal mock satisfies DocsRenderContext', () => {
  const ctx = mockContext();
  assert.equal(ctx.lang, 'en');
  assert.equal(ctx.t('Try it in the app'), 'Try it in the app'); // identity fallback
  assert.equal(ctx.credential('missing.svg'), null);
});

test('nextCredId is monotonic within one context (build reuses one across the run)', () => {
  const ctx = mockContext();
  assert.equal(ctx.nextCredId(), 'shot-cred-1');
  assert.equal(ctx.nextCredId(), 'shot-cred-2');
});

test('CredentialFacts / ShotResolution are constructible with the documented shape', () => {
  const facts: CredentialFacts = {
    signer: 'SUSE',
    generator: 'Lolly 1.90.0',
    when: '2026-08-14T00:00:00Z',
    dimensions: '1440 × 1200 px',
    ai: 'generated',
    model: 'Claude Fable 5',
    oversight: 'prompt_guided',
    anat: { kind: 'vector', paths: 134, nodes: 4200, groups: 12, images: 2, elements: 400, bytes: 41000 },
    recipe: { width: 1440, height: 1200, dpi: 192, walker: true },
    src: '/info/shots/gallery.svg',
    canCopySource: false,
  };
  assert.equal(facts.anat?.kind, 'vector');
  const shot: ShotResolution = {
    file: 'gallery.de.svg',
    src: '/info/shots/gallery.de.svg',
    width: 848,
    height: 530,
    dark: { file: 'gallery.de.dark.svg', src: '/info/shots/gallery.de.dark.svg', width: 848, height: 530 },
  };
  assert.equal(shot.dark?.file, 'gallery.de.dark.svg');
});
