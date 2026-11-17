// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadGalleryLook, placeBakedCover } from './gallery-look-loader.ts';
import { carouselDotsMarkup } from './gallery-carousel.ts';

test('a timed-out render stays failed when it eventually resolves', async () => {
  const dom = new JSDOM(`<div class="gcar"><ol class="gcar-track"><li class="gcar-slide"><a href="#old"><img class="gcar-img"></a></li></ol>${carouselDotsMarkup(2)}</div>`);
  const gcar = dom.window.document.querySelector<HTMLElement>('.gcar')!;
  const slide = gcar.querySelector<HTMLElement>('.gcar-slide')!;
  const img = slide.querySelector('img')!;
  img.decode = async () => {};
  let finish!: (result: { thumb: string; href: string }) => void;
  await loadGalleryLook(gcar, slide, () => new Promise(resolve => { finish = resolve; }), 10);
  assert.ok(slide.classList.contains('is-failed'));
  assert.equal(gcar.querySelector('.gcar-dot')?.hasAttribute('data-look-pending'), false);
  finish({ thumb: 'late.svg', href: '#late' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(img.hasAttribute('src'), false);
  assert.equal(slide.querySelector('a')?.getAttribute('href'), '#old');
  assert.equal(slide.classList.contains('is-loaded'), false);
  dom.window.close();
});

test('a preview removed during rendering cannot paint or change its link', async () => {
  const dom = new JSDOM('<div class="gcar"><ol class="gcar-track"><li class="gcar-slide"><a href="#old"><img class="gcar-img"></a></li></ol></div>');
  const gcar = dom.window.document.querySelector<HTMLElement>('.gcar')!;
  const slide = gcar.querySelector<HTMLElement>('.gcar-slide')!;
  let finish!: (result: { thumb: string; href: string }) => void;
  const done = loadGalleryLook(gcar, slide, () => new Promise(resolve => { finish = resolve; }));
  gcar.remove();
  finish({ thumb: 'late.svg', href: '#late' });
  await done;
  assert.equal(slide.querySelector('img')?.hasAttribute('src'), false);
  assert.equal(slide.querySelector('a')?.getAttribute('href'), '#old');
  dom.window.close();
});

function bakedStrip() {
  const dom = new JSDOM(`<div class="gcar"><ol class="gcar-track"><li class="gcar-slide gcar-slide--ex" data-look-pending><a href="#old"><img class="gcar-img"></a></li><li class="gcar-slide gcar-slide--ex"><a href="#two"><img class="gcar-img"></a></li></ol>${carouselDotsMarkup(2)}</div>`);
  const gcar = dom.window.document.querySelector<HTMLElement>('.gcar')!;
  const slide = gcar.querySelector<HTMLElement>('.gcar-slide')!;
  return { dom, gcar, slide, img: slide.querySelector('img')!, fire: (type: string) => slide.querySelector('img')!.dispatchEvent(new dom.window.Event(type)) };
}

test('a baked cover goes on as a plain file and is ready when the browser has loaded it', async () => {
  const s = bakedStrip();
  let missing = 0;
  assert.equal(placeBakedCover(s.gcar, s.slide, '/catalog/previews/covers/demo.light.webp', Promise.resolve('#/tool/demo?template=cover'), () => { missing += 1; }), true);
  assert.equal(s.img.getAttribute('src'), '/catalog/previews/covers/demo.light.webp');
  assert.equal(s.img.loading, 'lazy', 'a card with no priority fetches its file when the page gets there');
  assert.equal(s.slide.classList.contains('is-loaded'), false, 'not ready until the file has loaded');
  s.fire('load');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(s.slide.classList.contains('is-loaded'));
  assert.ok(s.gcar.classList.contains('has-art'));
  assert.equal(s.slide.querySelector('a')?.getAttribute('href'), '#/tool/demo?template=cover');
  assert.equal(s.gcar.querySelector('.gcar-dot')?.hasAttribute('data-look-pending'), false);
  assert.equal(missing, 0);
  s.dom.window.close();
});

test('a card the page draws first keeps its priority and is not deferred', () => {
  const s = bakedStrip();
  s.img.setAttribute('fetchpriority', 'high');
  placeBakedCover(s.gcar, s.slide, '/covers/demo.webp', Promise.resolve('#x'), () => {});
  assert.notEqual(s.img.getAttribute('loading'), 'lazy');
  s.dom.window.close();
});

test('a baked file that is gone leaves the slide empty and hands the look back', () => {
  const s = bakedStrip();
  let missing = 0;
  placeBakedCover(s.gcar, s.slide, '/covers/gone.webp', Promise.resolve('#x'), () => { missing += 1; });
  s.fire('error');
  assert.equal(s.img.hasAttribute('src'), false, 'the live render can take the slide');
  assert.equal(missing, 1);
  assert.equal(s.slide.classList.contains('is-loaded'), false);
  s.fire('load');
  assert.equal(s.slide.classList.contains('is-loaded'), false, 'a late event after the error changes nothing');
  s.dom.window.close();
});

test('a slide that already has a picture is left alone', () => {
  const s = bakedStrip();
  s.img.setAttribute('src', 'data:image/svg+xml,live');
  assert.equal(placeBakedCover(s.gcar, s.slide, '/covers/demo.webp', Promise.resolve('#x'), () => {}), false);
  assert.equal(s.img.getAttribute('src'), 'data:image/svg+xml,live');
  s.dom.window.close();
});

test('a card removed before its file loads is not marked', () => {
  const s = bakedStrip();
  placeBakedCover(s.gcar, s.slide, '/covers/demo.webp', Promise.resolve('#x'), () => {});
  s.gcar.remove();
  s.fire('load');
  assert.equal(s.slide.classList.contains('is-loaded'), false);
  s.dom.window.close();
});
