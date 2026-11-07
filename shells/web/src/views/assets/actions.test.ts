// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { canConvert, selection } from './actions.ts';
import type { CatCtx } from './context.ts';
import type { DetailsCtx } from './details-context.ts';
import { editingHtml, sidebarHtml, templateUseHash } from './details-controls.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
const photo = { id: 'photo', type: 'raster', format: 'png' } as AssetRef;
const sound = { id: 'sound', type: 'audio', format: 'wav' } as AssetRef;
const cat = {} as CatCtx;
test('conversion gates the whole selection and refuses unsupported procedural audio', () => {
  assert.equal(canConvert(cat, [photo]), true);
  assert.equal(canConvert(cat, [photo, photo]), true);
  assert.equal(canConvert(cat, [photo, sound]), false);
  assert.equal(canConvert(cat, [{ ...sound, format: 'zzfxm' }]), false);
  assert.equal(canConvert(cat, [{ ...photo, meta: { animated: true } }]), false);
  assert.equal(canConvert(cat, [{ ...photo, original: { url: 'original', format: 'psd' } }]), false);
  assert.equal(canConvert(cat, [{ ...photo, type: 'text', format: 'md' }]), true);
});
test('a missing selected source cannot silently turn into a partial operation', () => {
  const ctx = { selected: new Set(['photo', 'deleted']), assetById: new Map([['photo', photo]]) } as CatCtx;
  assert.deepEqual(selection(ctx), []);
  ctx.selected.delete('deleted');
  assert.deepEqual(selection(ctx), [photo]);
});

// A workspace template is a set of values whose one action is Use (plan 82 M6, F11).
const template = { id: 'inst/sheet1', type: 'template', format: 'json', source: 'library', url: '/inst/sheet1.json',
  meta: { toolId: 'pricing', version: 2, name: 'Partner price sheet' } } as unknown as AssetRef;
const details = (ref: AssetRef, over: Record<string, unknown> = {}) =>
  ({ cat: {} as CatCtx, ref, fav: false, isUser: false, hidden: false, configurable: false, isTextAsset: false, ...over }) as unknown as DetailsCtx;
const acts = (html: string): string[] => [...html.matchAll(/data-act="([^"]+)"/g)].map(m => m[1]!);
test('a workspace template keeps Use, Favourite and Copy link and offers no file actions', () => {
  assert.deepEqual(acts(sidebarHtml(details(template))).sort(), ['fav', 'share', 'use-template']);
  assert.equal(editingHtml(details(template)), '');
  // Copy link joins Use in the inspector's primary row.
  assert.match(sidebarHtml(details(template)), /data-act="share" data-inspector-primary/);
  assert.equal(templateUseHash({ toolId: 'pricing', id: 'inst/sheet1' }), '#/tool/pricing?template=inst%2Fsheet1');
  // A retired template is never offered as a start, and still has no file actions.
  const retired = { ...template, meta: { ...template.meta, retired: true } } as AssetRef;
  assert.deepEqual(acts(sidebarHtml(details(retired))).sort(), ['fav', 'share']);
});
test('an ordinary catalog asset keeps Download and its file actions', () => {
  const html = sidebarHtml(details(photo));
  for (const act of ['download', 'share', 'send', 'prepare', 'fav', 'add-to-project', 'hide']) assert.ok(acts(html).includes(act), act);
  assert.ok(!acts(html).includes('use-template'));
  assert.doesNotMatch(html, /data-inspector-primary/);
});
