// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { boxesToPenpotDoc } from '../../../../engine/src/penpot-file.ts';
import { cameraPosterBoxes } from './export-camera-posters.ts';

const poster = { id: 'cam', kind: 'webcam', x: 0, y: 0, w: 640, h: 360, bg: '#071b16', fit: 'cover',
  image: { type: 'raster', url: 'data:image/png;base64,POSTER' } };

test('PowerPoint lowers a captured camera poster as an image with its framing', () => {
  const source = readFileSync(new URL('../../../../community/design/hooks.js', import.meta.url), 'utf8');
  const lower = new Function('host', `${source}\nreturn deckElementFor;`)({});
  assert.deepEqual(lower(poster, {}, 0, 0), lower({ ...poster, kind: 'image' }, {}, 0, 0));
  assert.equal(lower(poster, {}, 0, 0).t, 'image');
});

test('Penpot receives the captured poster as editable image geometry without changing saved kind', () => {
  const portable = cameraPosterBoxes([poster]);
  const doc = boxesToPenpotDoc(portable, { name: 'Camera', canvas: { w: 1000, h: 700 },
    mediaFor: () => ({ id: 'poster-media', name: 'poster', width: 640, height: 360, mtype: 'image/png', bytes: new Uint8Array() }) });
  const board = doc.pages[0]!.shapes[0]!;
  assert.equal(board.type, 'board');
  assert.ok('children' in board && board.children.some(shape => shape.type === 'image' && shape.media === 'poster-media'));
  assert.equal(doc.media?.length, 1);
  assert.equal(poster.kind, 'webcam');
});
