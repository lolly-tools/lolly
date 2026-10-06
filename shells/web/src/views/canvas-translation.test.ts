// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { cacheCanvasTranslations, patchCanvasTranslations } from './canvas-translation.ts';
import { readTranslationSource } from './canvas-translation-source.ts';

const markup = (x: number, text = 'stable') => `<div class="lolly-box" data-box-id="a" style="left:${x}px;top:20px;width:100px"><video></video>${text}</div><div class="lolly-box" data-box-id="b" style="left:0px;top:0px">other</div>`;
const plan = [{ id: 'a', x: 40, y: 20 }];

test('export metadata follows translations while executable or unknown script changes repaint', () => {
  const payload = (x: number) => `<script type="application/json" data-penpot-doc>{"x":${x}}</script>`;
  const before = markup(10) + payload(10);
  const after = markup(40) + payload(40);
  const dom = new JSDOM(before);
  const root = dom.window.document.body;
  const script = root.querySelector('script');
  assert.equal(patchCanvasTranslations(root, before, after, plan), true);
  assert.equal(root.querySelector('script'), script);
  assert.equal(script!.textContent, '{"x":40}');
  for (const attr of ['type="application/json" data-unknown', 'data-penpot-doc']) {
    const a = markup(10) + `<script ${attr}>{"x":10}</script>`;
    const b = markup(40) + `<script ${attr}>{"x":40}</script>`;
    root.innerHTML = a;
    assert.equal(patchCanvasTranslations(root, a, b, plan), false);
    assert.equal(root.querySelector('script')!.textContent, '{"x":10}');
  }
  dom.window.close();
});

test('a translation preserves live nodes and local state while changing export geometry', () => {
  const dom = new JSDOM(markup(10));
  const root = dom.window.document.body;
  const box = root.firstElementChild as HTMLElement;
  const video = box.querySelector('video')!;
  const other = root.lastElementChild;
  box.style.setProperty('--fit', '0.8');
  assert.equal(patchCanvasTranslations(root, markup(10), markup(40), plan), true);
  assert.equal(root.firstElementChild, box);
  assert.equal(root.lastElementChild, other);
  assert.equal(box.querySelector('video'), video);
  assert.equal(box.style.getPropertyValue('--fit'), '0.8');
  assert.equal(dom.window.getComputedStyle(box).left, '40px');
  dom.window.close();
});

test('changes outside the planned coordinates and missing/duplicate targets fall back atomically', () => {
  const dom = new JSDOM(markup(10));
  const root = dom.window.document.body;
  const before = root.innerHTML;
  for (const next of [markup(40, 'new text'), markup(40).replace('other', 'changed'), markup(40).replace('width:100px', 'width:120px')]) {
    assert.equal(patchCanvasTranslations(root, markup(10), next, plan), false);
    assert.equal(root.innerHTML, before);
  }
  assert.equal(patchCanvasTranslations(root, markup(10), markup(40), [...plan, { id: 'missing', x: 0, y: 0 }]), false);
  assert.equal(root.innerHTML, before);
  assert.equal(patchCanvasTranslations(root, markup(10), markup(40), [...plan, ...plan]), false);
  assert.equal(patchCanvasTranslations(root, markup(10), markup(40), []), false);
  dom.window.close();
});

const boardMarkup = (x: number, y: number, childX = x + 30, childY = y + 40, border = 2.5): string =>
  `<div class="lolly-frame-page" data-pdf-page data-frame-id="f" style="position:absolute;left:${x}px;top:${y}px;width:300px;height:200px;border:${border}px solid red;overflow:hidden">` +
  `<div class="lolly-box" data-box-id="child" style="left:${childX}px;top:${childY}px;width:80px;height:50px;left:${childX - x - border}px;top:${childY - y - border}px"><video></video><span>Stable text</span></div></div>` +
  `<script type="application/json" data-penpot-doc>{"x":${x},"childX":${childX}}</script>` +
  `<script type="application/json" data-pptx-deck>{"y":${y}}</script>`;

test('board translations preserve child nodes and local state while updating both export payloads', () => {
  const before = boardMarkup(100, 200), after = boardMarkup(120, 230);
  const dom = new JSDOM(before), root = dom.window.document.body;
  const frame = root.firstElementChild as HTMLElement;
  const child = frame.firstElementChild as HTMLElement, video = child.firstElementChild;
  cacheCanvasTranslations(root, before);
  child.style.setProperty('--fit', '0.75');
  assert.equal(patchCanvasTranslations(root, before, after, [{ id: 'f', x: 120, y: 230, frame: true }]), true);
  assert.equal(root.firstElementChild, frame);
  assert.equal(frame.firstElementChild, child);
  assert.equal(child.firstElementChild, video);
  assert.equal(child.style.left, '27.5px');
  assert.equal(child.style.top, '37.5px');
  assert.equal(child.style.getPropertyValue('--fit'), '0.75');
  assert.equal(frame.style.left, '120px');
  assert.deepEqual([...root.querySelectorAll('script')].map(node => JSON.parse(node.textContent!)), [{ x: 120, childX: 150 }, { y: 230 }]);
  dom.window.close();
});

test('independent frame-member translations use rendered local coordinates including fractional borders', () => {
  const before = boardMarkup(100, 200), after = boardMarkup(100, 200, 150, 230);
  const dom = new JSDOM(before), root = dom.window.document.body;
  const frame = root.firstElementChild as HTMLElement, child = frame.firstElementChild as HTMLElement;
  cacheCanvasTranslations(root, before);
  child.style.setProperty('--fit', '0.8');
  const plan = [{ id: 'child', x: 150, y: 230, localDelta: { dx: 20, dy: -10 } }];
  assert.equal(patchCanvasTranslations(root, before, after, plan), true);
  assert.equal(root.firstElementChild, frame);
  assert.equal(frame.firstElementChild, child);
  assert.equal(child.style.left, '47.5px');
  assert.equal(child.style.top, '27.5px');
  assert.equal(child.style.getPropertyValue('--fit'), '0.8');
  dom.window.close();
});

test('a board move refuses changed local positions, content, clipping and declaration priority atomically', () => {
  const before = boardMarkup(100, 200), after = boardMarkup(120, 230);
  const dom = new JSDOM(before), root = dom.window.document.body;
  cacheCanvasTranslations(root, before);
  const mounted = root.innerHTML;
  const plan = [{ id: 'f', x: 120, y: 230, frame: true }];
  for (const next of [
    after.replace('left:27.5px', 'left:28.5px'), after.replace('Stable text', 'Changed text'),
    after.replace('overflow:hidden', 'overflow:visible'), after.replace('left:120px', 'left:120px!important'),
    after.replace('width:80px', 'width:90px'), after.replace('data-box-id="child"', 'data-box-id="other"'),
  ]) {
    assert.equal(patchCanvasTranslations(root, before, next, plan), false);
    assert.equal(root.innerHTML, mounted);
  }
  dom.window.close();
});

test('cached comparisons advance through changing source offsets without reparsing the document', () => {
  const docHtml = (x: number) => markup(x) + Array.from({ length: 1000 }, (_, i) =>
    `<div class="lolly-box" data-box-id="extra${i}" style="left:${i}px;top:0px">Label ${i}</div>`).join('') +
    `<script type="application/json" data-penpot-doc>{"x":${x}}</script>`;
  let previous = docHtml(9);
  const dom = new JSDOM(previous), root = dom.window.document.body, node = root.firstElementChild;
  cacheCanvasTranslations(root, previous);
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.Element.prototype, 'innerHTML')!;
  let documentParses = 0;
  Object.defineProperty(dom.window.Element.prototype, 'innerHTML', { ...descriptor,
    set(value: string) { if (value.length > 10_000) documentParses++; descriptor.set!.call(this, value); } });
  try {
    for (const x of [10, 1000, -20, 9]) {
      const next = docHtml(x);
      assert.equal(patchCanvasTranslations(root, previous, next, [{ id: 'a', x, y: 20 }]), true);
      assert.equal(root.firstElementChild, node);
      assert.equal(root.querySelector('script')!.textContent, `{"x":${x}}`);
      previous = next;
    }
    assert.equal(documentParses, 0, 'only changed style fragments need parsing');
    const changed = docHtml(12).replace('Label 999', 'Different content');
    const mounted = root.innerHTML;
    assert.equal(patchCanvasTranslations(root, previous, changed, [{ id: 'a', x: 12, y: 20 }]), false);
    assert.equal(root.innerHTML, mounted, 'late differences cannot leave early targets partially updated');
  } finally { Object.defineProperty(dom.window.Element.prototype, 'innerHTML', descriptor); dom.window.close(); }
});

test('ambiguous source markup uses the DOM proof and executable text cannot impersonate a target', () => {
  for (const wrap of [(html: string) => `<!-- ${html} -->`, (html: string) => `<script>const text = '${html}';</script>`]) {
    const before = wrap(markup(10)) + markup(10), next = wrap(markup(40)) + markup(40);
    const dom = new JSDOM(before), root = dom.window.document.body, mounted = root.innerHTML;
    cacheCanvasTranslations(root, before);
    assert.equal(patchCanvasTranslations(root, before, next, plan), false);
    assert.equal(root.innerHTML, mounted);
    dom.window.close();
  }
  for (const decorate of [
    (html: string) => html.replace('class="lolly-box"', 'class="lolly&#x2d;box"'),
    (html: string) => html.replace('data-box-id="a"', 'data-box-id=a'),
  ]) {
    const before = decorate(markup(10)), next = decorate(markup(40));
    const dom = new JSDOM(before), root = dom.window.document.body;
    assert.equal(readTranslationSource(dom.window.document, before), null);
    assert.equal(patchCanvasTranslations(root, before, next, plan), true, 'legacy markup keeps its guarded DOM path');
    dom.window.close();
  }
});

test('a cached source still verifies mounted target uniqueness and valid inert metadata before mutation', () => {
  const before = markup(10) + '<script type="application/json" data-penpot-doc>{"x":10}</script>';
  const after = markup(40) + '<script type="application/json" data-penpot-doc>{"x":40}</script>';
  const dom = new JSDOM(before), root = dom.window.document.body;
  cacheCanvasTranslations(root, before);
  assert.equal(patchCanvasTranslations(root, before, after.replace('{"x":40}', 'invalid'), plan), false);
  assert.equal(root.firstElementChild!.getAttribute('style'), 'left:10px;top:20px;width:100px');
  root.appendChild(root.firstElementChild!.cloneNode(true));
  const mounted = root.innerHTML;
  assert.equal(patchCanvasTranslations(root, before, after, plan), false);
  assert.equal(root.innerHTML, mounted);
  dom.window.close();
});

test('large selections share target discovery and retain an atomic uniqueness check', () => {
  const id = (i: number) => i === 7 ? 'box[7]:detail' : `box${i}`;
  const html = (offset: number) => Array.from({ length: 1000 }, (_, i) =>
    `<div class="${i === 99 ? 'lolly-frame-page' : 'lolly-box'}" data-${i === 99 ? 'frame' : 'box'}-id="${id(i)}" style="left:${i + (i < 100 ? offset : 0)}px;top:20px"><video></video></div>`).join('');
  const before = html(0), next = html(30), plan = Array.from({ length: 100 }, (_, i) =>
    ({ id: id(i), x: i + 30, y: 20, ...(i === 99 ? { frame: true } : {}) }));
  const dom = new JSDOM(before), root = dom.window.document.body;
  const originals = [...root.children];
  cacheCanvasTranslations(root, before);
  const query = root.querySelectorAll.bind(root);
  let geometryQueries = 0;
  root.querySelectorAll = ((selector: string) => {
    if (selector.includes('lolly-box') || selector.includes('lolly-frame-page')) geometryQueries++;
    return query(selector);
  }) as typeof root.querySelectorAll;
  try {
    assert.equal(patchCanvasTranslations(root, before, next, plan), true);
    assert.equal(geometryQueries, 1, 'a group must not rescan the document for each object');
    assert.deepEqual([...root.children], originals);
    for (let i = 0; i < 1000; i++) assert.equal((root.children[i] as HTMLElement).style.left, `${i + (i < 100 ? 30 : 0)}px`);
    root.append(root.children[99]!.cloneNode(true));
    const mounted = root.innerHTML;
    const later = plan.map(patch => ({ ...patch, x: patch.x + 30 }));
    assert.equal(patchCanvasTranslations(root, next, html(60), later), false);
    assert.equal(root.innerHTML, mounted, 'a duplicate late target cannot partially update earlier targets');
  } finally { root.querySelectorAll = query; dom.window.close(); }
});
