// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { patchLivePreview } from './live-preview.ts';

const source = (frame: number, width = 8) => `<div><svg data-live-preview viewBox="0 0 ${width} 8"><image href="data:image/jpeg;base64,${frame}" width="${width}" height="8"/><polygon points="${frame},1 7,7"/></svg><button>Copy</button><a href="https://example.com">Open</a><p></p><script>/* handlers */</script></div>`;

function fixture() {
  const dom = new JSDOM('<main></main>');
  const container = dom.window.document.querySelector('main')!;
  container.innerHTML = source(1);
  const loads: Array<{ onload?: () => void; src: string }> = [];
  Object.defineProperty(dom.window, 'Image', { value: class {
    onload?: () => void;
    src = '';
    constructor() { loads.push(this); }
  } });
  return { dom, container, loads };
}

test('camera frames retain buttons, listeners, focus and copy feedback while the next JPEG loads', () => {
  const { dom, container, loads } = fixture();
  const button = container.querySelector('button')!;
  const image = container.querySelector('image')!;
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  button.focus();
  container.querySelector('p')!.textContent = 'Copied';
  assert.equal(patchLivePreview(container, source(1), source(2)), true);
  assert.equal(image.getAttribute('href'), 'data:image/jpeg;base64,1', 'last image remains during decode');
  loads[0]!.onload!();
  assert.equal(container.querySelector('image'), image);
  assert.equal(image.getAttribute('href'), 'data:image/jpeg;base64,2');
  assert.equal(container.querySelector('button'), button);
  assert.equal(dom.window.document.activeElement, button);
  assert.equal(container.querySelector('p')!.textContent, 'Copied');
  button.click();
  assert.equal(clicks, 1);
  dom.window.close();
});

test('out-of-order image loads cannot regress the frame or drop a pending resize', () => {
  const { dom, container, loads } = fixture();
  assert.equal(patchLivePreview(container, source(1), source(2, 16)), true);
  assert.equal(patchLivePreview(container, source(2, 16), source(3, 16)), true);
  loads[1]!.onload!();
  loads[0]!.onload!();
  assert.equal(container.querySelector('image')!.getAttribute('href'), 'data:image/jpeg;base64,3');
  assert.equal(container.querySelector('image')!.getAttribute('width'), '16');
  assert.equal(container.querySelector('svg')!.getAttribute('viewBox'), '0 0 16 8');
  dom.window.close();
});

test('changed results, scripts, source modes and untrusted image URLs require a full paint without partial mutation', () => {
  const { dom, container, loads } = fixture();
  for (const changed of [
    source(2).replace('Copy', 'New result'),
    source(2).replace('https://example.com', 'https://other.example'),
    source(2).replace('/* handlers */', '/* new handlers */'),
    source(2).replace('data-live-preview', ''),
    source(2).replace('data:image/jpeg;base64,2', 'https://other.example/camera.jpg'),
    source(2).replace('<polygon', '<circle'),
  ]) {
    assert.equal(patchLivePreview(container, source(1), changed), false);
    assert.equal(container.querySelector('image')!.getAttribute('href'), 'data:image/jpeg;base64,1');
  }
  assert.equal(loads.length, 0);
  dom.window.close();
});

test('a late frame cannot update a preview replaced by a new scan result', () => {
  const { dom, container, loads } = fixture();
  const oldImage = container.querySelector('image')!;
  patchLivePreview(container, source(1), source(2));
  container.innerHTML = source(3);
  loads[0]!.onload!();
  assert.equal(oldImage.getAttribute('href'), 'data:image/jpeg;base64,1');
  assert.equal(container.querySelector('image')!.getAttribute('href'), 'data:image/jpeg;base64,3');
  dom.window.close();
});
