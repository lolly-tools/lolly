// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { FileMetadata } from '@lolly/engine';
import { STAGE_SHOW_EVENT, showOnStage, stageHasMap, stageHtml, wireStage, type StageShowDetail } from './valid-stage.ts';

const photo = { kind: 'image' as const, url: 'blob:photo', format: 'jpeg', name: 'photo.jpg' };
const located = { fields: [], gps: { lat: -27.47, lon: 153.025 }, mapUrl: 'https://www.openstreetmap.org/?mlat=-27.47&mlon=153.025' } as unknown as FileMetadata;

function mount(html: string): { root: HTMLElement; restore: () => void } {
  const dom = new JSDOM(`<body><div id="report"><div class="valid-result">${html}</div></div></body>`);
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
  }
  return {
    root: dom.window.document.querySelector<HTMLElement>('#report')!,
    restore: () => {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    },
  };
}

test('the stage offers the map only when the file records a usable place', () => {
  assert.equal(stageHasMap(located), true);
  assert.equal(stageHasMap(undefined), false);
  assert.equal(stageHasMap({ fields: [], gps: { lat: 120, lon: 10 } } as unknown as FileMetadata), false);
  const plain = stageHtml(photo, undefined, 0);
  assert.doesNotMatch(plain, /data-stage-pane="map"/);
  assert.doesNotMatch(plain, /data-stage-view-pick/);
  assert.match(plain, /data-forensic-host="0"/, 'the AI evidence page view has a place on every stage');
  const withMap = stageHtml(photo, located, 3);
  assert.match(withMap, /data-stage-pane="map" hidden/);
  assert.match(withMap, /data-forensic-host="3"/);
  assert.match(withMap, /-27\.47000, 153\.02500/);
});

test('a finding is shown on the stage: Personal data opens the map, every other finding the asset', (t) => {
  const { root, restore } = mount(stageHtml(photo, located, 2));
  t.after(restore);
  wireStage(root);
  const result = root.querySelector<HTMLElement>('.valid-result')!;
  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const pane = (name: string) => root.querySelector<HTMLElement>(`[data-stage-pane="${name}"]`)!;
  const heard: StageShowDetail[] = [];
  root.addEventListener(STAGE_SHOW_EVENT, (event) => { heard.push((event as CustomEvent<StageShowDetail>).detail); });

  assert.equal(showOnStage(result, 'personal'), true, 'a recorded place is drawn on the stage');
  assert.equal(stage.dataset.stageView, 'map');
  assert.equal(pane('map').hidden, false);
  assert.equal(pane('asset').hidden, true);
  assert.equal(root.querySelector('[data-stage-view-pick="map"]')!.getAttribute('aria-pressed'), 'true');

  showOnStage(result, 'ai');
  assert.equal(stage.dataset.stageView, 'asset');
  assert.equal(pane('asset').hidden, false);
  assert.deepEqual(heard, [{ finding: 'personal', fileIndex: 2 }, { finding: 'ai', fileIndex: 2 }]);

  // The view control does the same by hand.
  root.querySelector<HTMLElement>('[data-stage-view-pick="map"]')!.click();
  assert.equal(stage.dataset.stageView, 'map');
});

test('a stage with no map keeps showing the asset for a personal-data finding', (t) => {
  const { root, restore } = mount(stageHtml(photo, undefined, 0));
  t.after(restore);
  assert.equal(showOnStage(root.querySelector<HTMLElement>('.valid-result')!, 'personal'), false, 'nothing to draw without a place');
  assert.equal(showOnStage(root.querySelector<HTMLElement>('.valid-result')!, 'licence'), false);
  assert.equal(root.querySelector<HTMLElement>('[data-stage]')!.dataset.stageView, 'asset');
  assert.equal(root.querySelector<HTMLElement>('[data-stage-pane="asset"]')!.hidden, false);
});

test('the report draws the asset once, on the stage, and the findings beside it', () => {
  const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
  const view = read('./valid.ts');
  assert.match(view, /reportBodyHtml\(findings, \{\s*stage: stageHtml\(preview, meta, fileIndex\),/);
  assert.doesNotMatch(view, /mediaPreviewHtml/, 'the preview is the stage, not a second figure in the report');
  // A slot press shows its finding on the asset, and the AI evidence answers on the stage.
  assert.match(read('./valid-findings.ts'), /showOnStage\(result, id\)/);
  const forensics = read('./valid-forensics.ts');
  assert.match(forensics, /addEventListener\(STAGE_SHOW_EVENT, onStageShow\)/);
  assert.match(forensics, /host\.replaceChildren\(part\)/);
  assert.match(read('./valid-forensics-render.ts'), /data-forensic-stagepart/);
});
