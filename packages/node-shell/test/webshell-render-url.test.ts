// SPDX-License-Identifier: MPL-2.0
/**
 * The browser tier's request URL is the whole of the Node shells' parity with the web
 * export panel: whatever is not written here, the web shell never hears about. These pin
 * the forwarded controls - dimensions, provenance, the video params and the HDR request -
 * and that reserved names in the tool query cannot smuggle a second value in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportUrl } from '../src/webshell-render.ts';

const BASE = 'http://127.0.0.1:1';
const params = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1] ?? '');

test('video controls travel as the url-mode params of the same names, only when given', () => {
  const p = params(exportUrl(BASE, 'chart', 'title=Hi', 'mp4', { video: { fps: 60, seconds: 2, codec: 'h264', quality: 'best' } }));
  assert.equal(p.get('fps'), '60');
  assert.equal(p.get('seconds'), '2');
  assert.equal(p.get('codec'), 'h264');
  assert.equal(p.get('vq'), 'best');
  assert.equal(p.has('wait'), false, 'an unset control writes nothing');
  assert.equal(p.get('format'), 'mp4');
  assert.equal(p.get('export'), '1');
  assert.equal(p.get('title'), 'Hi', 'the tool input survives beside the controls');
});

test('the HDR request reaches the browser tier for the formats it encodes there', () => {
  const p = params(exportUrl(BASE, 'chart', '', 'avif', { hdrParam: '1600-60-0-50' }));
  assert.equal(p.get('hdr'), '1600-60-0-50');
  const none = params(exportUrl(BASE, 'chart', '', 'avif', {}));
  assert.equal(none.has('hdr'), false);
});

test('reserved names in the tool query are dropped before the controls are written', () => {
  const p = params(exportUrl(BASE, 'chart', 'fps=1&hdr=1&width=9&title=Hi', 'mp4', { width: 1200, video: { fps: 30 } }));
  assert.equal(p.get('fps'), '30', 'the caller wins over a stray query value');
  assert.equal(p.has('hdr'), false, 'a stray hdr= in the query does not turn HDR on');
  assert.equal(p.get('width'), '1200');
});

test('a resolved language override reaches the browser without changing source inputs', () => {
  const p = params(exportUrl(BASE, 'agenda', 'lang=fr&title=Conférence', 'html', { lang: 'es' }));
  assert.equal(p.get('lang'), 'es');
  assert.equal(p.get('title'), 'Conférence');
  assert.equal(params(exportUrl(BASE, 'agenda', 'lang=ar', 'html', {})).get('lang'), 'ar');
});

test('timeline still controls survive browser routing and override stale query samples', () => {
  const p = params(exportUrl(BASE, 'design', 'cuts=12&sampletimes=9', 'png', { sampleTimes: [0, 1 / 30, 2] }));
  assert.equal(p.get('sampletimes'), '0,0.03333333333333333,2');
  assert.equal(p.has('cuts'), false);
  const cuts = params(exportUrl(BASE, 'design', 'sampletimes=9', 'png', { cuts: 3 }));
  assert.equal(cuts.get('cuts'), '3');
  assert.equal(cuts.has('sampletimes'), false);
});
