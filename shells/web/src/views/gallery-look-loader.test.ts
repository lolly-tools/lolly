// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadGalleryLook } from './gallery-look-loader.ts';
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

test('a held cover shows at once and the new render replaces the held picture', async () => {
  const { showHeldLook } = await import('./gallery-look-loader.ts');
  const dom = new JSDOM(`<div class="gcar"><ol class="gcar-track"><li class="gcar-slide"><a href="#old"><img class="gcar-img"></a></li></ol>${carouselDotsMarkup(1)}</div>`);
  const gcar = dom.window.document.querySelector<HTMLElement>('.gcar')!;
  const slide = gcar.querySelector<HTMLElement>('.gcar-slide')!;
  const img = slide.querySelector('img')!;
  img.decode = async () => {};
  await showHeldLook(gcar, slide, 'held.svg');
  assert.equal(img.getAttribute('src'), 'held.svg');
  assert.equal(img.dataset.held, '', 'marked as a stand-in');
  // A slide with a finished picture is left alone; a held picture is not finished.
  await loadGalleryLook(gcar, slide, async () => ({ thumb: 'fresh.svg', href: '#fresh' }));
  assert.equal(img.getAttribute('src'), 'fresh.svg');
  assert.equal(img.dataset.held, undefined);
  assert.equal(slide.querySelector('a')?.getAttribute('href'), '#fresh');
  await loadGalleryLook(gcar, slide, async () => ({ thumb: 'again.svg', href: '#again' }));
  assert.equal(img.getAttribute('src'), 'fresh.svg', 'a finished picture is not drawn twice');
  dom.window.close();
});

test('a held cover comes off when the new render fails', async () => {
  const { showHeldLook } = await import('./gallery-look-loader.ts');
  const dom = new JSDOM(`<div class="gcar"><ol class="gcar-track"><li class="gcar-slide"><a href="#old"><img class="gcar-img"></a></li></ol>${carouselDotsMarkup(1)}</div>`);
  const gcar = dom.window.document.querySelector<HTMLElement>('.gcar')!;
  const slide = gcar.querySelector<HTMLElement>('.gcar-slide')!;
  const img = slide.querySelector('img')!;
  img.decode = async () => {};
  await showHeldLook(gcar, slide, 'held.svg');
  await loadGalleryLook(gcar, slide, async () => { throw new Error('no render'); });
  assert.equal(img.hasAttribute('src'), false, 'the old colours do not stay as if they were current');
  assert.ok(slide.classList.contains('is-failed'));
  dom.window.close();
});
