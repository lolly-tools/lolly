// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX import binds a slide's NARRATION to an audio box (plans/180 section 5, import side).
 *
 * `readPptx` resolves a slide's audio relationship into `slide.audio = { part, ext }`; what
 * is tested here is the mapping half - the node `pptxSlideToNodes` appends for it - against
 * hand-built read-model slides. No zip, no host, no DOM.
 *
 * Two rules are pinned because both are easy to get wrong later:
 *   • the node's kind is `image`, not `audio`. The engine's `nodeToBox` knows three kinds,
 *     and audio-ness is a property of the ASSET (`type: 'audio'`), which is exactly how the
 *     Design tool recognises an audio box today.
 *   • no `group` is set. `narration:<frameId>` is the Narrate flow's contract over clips
 *     Lolly generated; an imported clip is someone else's recording, and we hold no word
 *     timings for it - its captions have to come from Whisper under TRANSCRIPT_META_KEY,
 *     never `meta.tts`. Two different claims about origin.
 *
 * Run with: node --import ./tests/css-stub.mjs --test shells/web/src/views/pptx-import-audio.test.ts
 */

/// <reference path="../vendor.d.ts" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pptxSlideToNodes } from './pptx-import.ts';
import { EMU_PER_PX } from '../../../../engine/src/pptx.ts';
import type { PptxReadSlide, PptxReadTheme } from '../../../../engine/src/pptx-read.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

const THEME: PptxReadTheme = { colors: { lt1: 'FFFFFF', dk1: '000000' }, majorFont: 'Calibri Light', minorFont: 'Calibri' };
const OPTS = (resolve: (path: string) => AssetRef | null) => ({
  widthEmu: 960 * EMU_PER_PX, heightEmu: 540 * EMU_PER_PX, theme: THEME, resolveMedia: resolve,
});

const slide = (over: Partial<PptxReadSlide> = {}): PptxReadSlide => ({ index: 0, nodes: [], ...over });
const audioRef: AssetRef = { id: 'user/upload/1-audio1.wav', type: 'audio', url: 'blob:audio1', format: 'wav' } as AssetRef;

test('a narrated slide gains one box bound to the clip, drawn last', () => {
  const nodes = pptxSlideToNodes(
    slide({
      audio: { part: 'ppt/media/audio1.wav', ext: 'wav' },
      nodes: [{
        type: 'shape', xEmu: 0, yEmu: 0, cxEmu: EMU_PER_PX * 100, cyEmu: EMU_PER_PX * 100,
        fill: { hex: '30BA78' }, geom: 'rect',
      } as never],
    }),
    OPTS((path) => (path === 'ppt/media/audio1.wav' ? audioRef : null)),
  );

  const last = nodes[nodes.length - 1] as Record<string, unknown>;
  assert.equal(last.image, audioRef, 'the box carries the stored ref, not the part path');
  assert.equal(last.kind, 'image', 'the engine mapper knows box/text/image; the ASSET says audio');
  assert.equal(last.fill, '', 'an audio box paints nothing');
  assert.ok(!('group' in last), 'an imported clip is not a `narration:` group member');
  assert.ok((last.w as number) >= 1 && (last.h as number) >= 1, 'finalizeBoxes drops a degenerate node');
  assert.ok(nodes.length === 2, 'the slide keeps its own shape and gains exactly one audio box');
});

test('the audio box sits inside the slide, near its bottom-left corner', () => {
  const nodes = pptxSlideToNodes(
    slide({ audio: { part: 'ppt/media/audio1.wav', ext: 'wav' } }),
    OPTS(() => audioRef),
  );
  const box = nodes[0] as { x: number; y: number; w: number; h: number };
  assert.ok(box.x >= 0 && box.x + box.w <= 960, `x within the slide: ${box.x}+${box.w}`);
  assert.ok(box.y >= 0 && box.y + box.h <= 540, `y within the slide: ${box.y}+${box.h}`);
  assert.ok(box.y > 270, 'the handle belongs at the bottom, out of the artwork');
});

test('no audio, or a part the store refused, leaves the slide exactly as it was', () => {
  const bare = pptxSlideToNodes(slide(), OPTS(() => audioRef));
  assert.equal(bare.length, 0, 'a silent slide gains nothing');

  // The store refuses a container it cannot hold (a .wma, an oversized part): the slide
  // imports without the clip rather than with a broken reference to one.
  const refused = pptxSlideToNodes(
    slide({ audio: { part: 'ppt/media/audio1.wma', ext: 'wma' } }),
    OPTS(() => null),
  );
  assert.equal(refused.length, 0);
});
