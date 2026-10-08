// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { Box } from '../free-canvas-math.ts';
import type { FcCtx } from './context.ts';
import { assignFrames } from './select.ts';
import { placeRefs, wire } from './file-drop.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 0;
};

function fixture() {
  const viewEl = document.createElement('div');
  const stageEl = document.createElement('div');
  const canvasEl = document.createElement('div');
  stageEl.append(canvasEl);
  viewEl.append(stageEl);
  document.body.append(viewEl);
  let boxes: Box[] = [{ id: 'existing', kind: 'image', x: 0, y: 0, w: 20, h: 20 }];
  let commits = 0,
    nextId = 0,
    timelines = 0;
  let canEdit = true;
  const fc = {
    viewEl,
    stageEl,
    canvasEl,
    disposed: false,
    opts: { canEdit: () => canEdit },
    cfg: {
      idField: 'id',
      xField: 'x',
      yField: 'y',
      wField: 'w',
      hField: 'h',
      rotationField: 'rot',
      kindField: 'kind',
      imageField: 'image',
      fitField: 'fit',
    },
    cv: { labelField: 'name' },
    addKinds: [
      { id: 'image', seed: { kind: 'image', bg: '', text: '' } },
      { id: 'video', seed: { kind: 'image', bg: '', text: '' } },
      { id: 'audio', seed: { kind: 'audio' } },
      { id: 'lottie', seed: { kind: 'image' } },
    ],
    timeCfg: {
      startField: 'start',
      durField: 'dur',
      clipInField: 'clipIn',
      speedField: 'speed',
      laneField: 'lane',
    },
    timelinePanel: { time: () => 2.5 },
    selection: new Set(['existing']),
    helpers: { canvasWH: () => ({ w: 1600, h: 1200 }) },
    stage: {
      metrics: () => ({
        sr: { left: 100, top: 60, right: 900, bottom: 660, width: 800, height: 600 },
      }),
      clientToNative: (x: number, y: number) => ({ x: (x - 100) * 2, y: (y - 60) * 2 }),
    },
    document: {
      clampToWorkArea: (box: Box) => box,
      activeArtboardId: () => boxes.find((box) => box.kind === 'frame')?.id ?? '',
    },
    modes: { toPointer() {} },
    select: {
      getBoxes: () => boxes,
      freshId: () => `new-${++nextId}`,
      idOf: (box: Box) => String(box.id),
      assignFrames: (rows: Box[], touched: Set<number>) => assignFrames(fc, rows, touched),
      commit: (rows: Box[]) => {
        boxes = rows;
        commits++;
      },
      notifySelection() {},
    },
    chromeSync: { renderChrome() {} },
    timeline: {
      openTimeline: () => {
        timelines++;
      },
    },
  } as unknown as FcCtx;
  return {
    fc,
    boxes: () => boxes,
    commits: () => commits,
    timelines: () => timelines,
    readOnly: () => {
      canEdit = false;
    },
  };
}

const ref = (type: AssetRef['type'], name: string, width = 400, height = 200): AssetRef => ({
  source: 'user',
  format: 'png',
  id: `user/upload/${name}`,
  url: `blob:${name}`,
  type,
  width,
  height,
  meta: { name, durationMs: 1800 },
});
function drag(
  target: HTMLElement,
  type: string,
  files: File[] = [],
  x = 400,
  y = 300,
  types = ['Files']
) {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
  const transfer = { files, types, dropEffect: 'none' };
  Object.assign(event, { dataTransfer: transfer, clientX: x, clientY: y });
  target.dispatchEvent(event);
  return { event, transfer };
}
const settle = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

test('a mixed drop adds new objects at the zoomed pointer in one commit', async () => {
  const f = fixture();
  const files = [
    new File(['x'], 'photo.png', { type: 'image/png' }),
    new File(['x'], 'clip.mov'),
    new File(['x'], 'voice.wav'),
  ];
  const refs = [
    ref('raster', 'photo.png'),
    ref('video', 'clip.mov', 1920, 1080),
    ref('audio', 'voice.wav'),
  ];
  const seen: string[] = [];
  const dispose = wire(f.fc, async (file) => {
    seen.push(file.name);
    return refs[seen.length - 1]!;
  });
  try {
    const { event, transfer } = drag(f.fc.canvasEl, 'drop', files);
    transfer.files = [];
    await settle();
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(
      seen,
      files.map((file) => file.name),
      'the files survive the end of the drop event'
    );
    assert.equal(f.commits(), 1, 'the entire drop is one undo step');
    assert.equal(f.boxes()[0]!.id, 'existing', 'a selected image is kept');
    const [image, video, audio] = f.boxes().slice(1);
    assert.equal(image!.image, refs[0]);
    assert.equal(image!.x, 400);
    assert.equal(image!.y, 380);
    assert.equal(Number(video!.w) / Number(video!.h), 16 / 9);
    assert.equal(video!.start, 2.5);
    assert.equal(video!.dur, 1.8);
    assert.equal(video!.lane, '');
    assert.equal(audio!.kind, 'audio');
    assert.equal(audio!.image, refs[2]);
    assert.equal(audio!.dur, 1.8);
    assert.deepEqual([...f.fc.selection], ['new-1', 'new-2', 'new-3']);
    assert.equal(f.timelines(), 1);
  } finally {
    dispose();
    f.fc.viewEl.remove();
  }
});

test('drops on editor controls use the active artboard centre and join it', async () => {
  const f = fixture();
  f.boxes().push({ id: 'page', kind: 'frame', x: 500, y: 300, w: 800, h: 600 });
  f.fc.frameCfg = { frameField: 'frame', frameKind: 'frame' } as FcCtx['frameCfg'];
  const dispose = wire(f.fc, async () => ref('vector', 'logo.svg'));
  try {
    const control = document.createElement('input');
    f.fc.stageEl.append(control);
    drag(control, 'drop', [new File(['x'], 'logo.svg')]);
    await settle();
    const image = f.boxes().at(-1)!;
    assert.equal(image.x, 700);
    assert.equal(image.y, 500);
    assert.equal(image.frame, 'page');
  } finally {
    dispose();
    f.fc.viewEl.remove();
  }
});

test('failed files do not stop other files, and later drops retain edits made during upload', async () => {
  const f = fixture();
  let finish!: (value: AssetRef) => void;
  const dispose = wire(f.fc, async (file) => {
    if (file.name === 'bad.png') throw new Error('Invalid image');
    if (file.name === 'slow.png')
      return new Promise<AssetRef>((resolve) => {
        finish = resolve;
      });
    return ref('raster', file.name);
  });
  try {
    drag(f.fc.viewEl, 'drop', [new File(['x'], 'bad.png'), new File(['x'], 'slow.png')]);
    drag(f.fc.viewEl, 'drop', [new File(['x'], 'later.png')]);
    await settle();
    f.boxes().push({ id: 'during-upload', kind: 'text', text: 'Keep me' });
    finish(ref('raster', 'slow.png'));
    await settle();
    assert.equal(f.commits(), 2);
    assert.deepEqual(
      f.boxes().map((box) => box.id),
      ['existing', 'during-upload', 'new-1', 'new-2']
    );
    assert.equal((f.boxes().at(-1)!.image as AssetRef).id, 'user/upload/later.png');
  } finally {
    dispose();
    f.fc.viewEl.remove();
  }
});

test('file drag feedback ignores in-app drags and respects a child drop handler', async () => {
  const f = fixture();
  let uploads = 0;
  const dispose = wire(f.fc, async () => {
    uploads++;
    return ref('raster', 'x.png');
  });
  try {
    assert.equal(
      drag(f.fc.viewEl, 'dragenter', [], 0, 0, ['text/plain']).event.defaultPrevented,
      false
    );
    assert.equal(f.fc.canvasEl.classList.contains('is-file-dragover'), false);
    drag(f.fc.viewEl, 'dragenter');
    drag(f.fc.canvasEl, 'dragenter');
    drag(f.fc.canvasEl, 'dragleave');
    assert.equal(f.fc.canvasEl.classList.contains('is-file-dragover'), true);
    const { transfer } = drag(f.fc.viewEl, 'dragover');
    assert.equal(transfer.dropEffect, 'copy');
    f.fc.canvasEl.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    drag(f.fc.canvasEl, 'drop', [new File(['x'], 'x.png')]);
    await settle();
    assert.equal(uploads, 0);
    assert.equal(f.fc.canvasEl.classList.contains('is-file-dragover'), false);
  } finally {
    dispose();
    f.fc.viewEl.remove();
  }
});

test('navigation removes handlers and abandons a pending upload', async () => {
  const f = fixture();
  let finish!: (value: AssetRef) => void;
  let uploads = 0;
  const dispose = wire(f.fc, async () => {
    uploads++;
    return new Promise<AssetRef>((resolve) => {
      finish = resolve;
    });
  });
  drag(f.fc.viewEl, 'dragenter');
  drag(f.fc.viewEl, 'drop', [new File(['x'], 'x.png')]);
  await settle();
  dispose();
  finish(ref('raster', 'x.png'));
  await settle();
  assert.equal(f.commits(), 0);
  assert.equal(f.fc.canvasEl.classList.contains('is-file-dragover'), false);
  assert.equal(
    drag(f.fc.viewEl, 'drop', [new File(['x'], 'again.png')]).event.defaultPrevented,
    false
  );
  assert.equal(uploads, 1);
  f.fc.viewEl.remove();
});

test('read-only editors cannot upload or place files', async () => {
  const f = fixture();
  let uploads = 0;
  const dispose = wire(f.fc, async () => {
    uploads++;
    return ref('raster', 'x.png');
  });
  try {
    f.readOnly();
    drag(f.fc.viewEl, 'drop', [new File(['x'], 'x.png')]);
    placeRefs(f.fc, [ref('raster', 'x.png')], { x: 100, y: 100 }, 0);
    await settle();
    assert.equal(uploads, 0);
    assert.equal(f.commits(), 0);
  } finally {
    dispose();
    f.fc.viewEl.remove();
  }
});
