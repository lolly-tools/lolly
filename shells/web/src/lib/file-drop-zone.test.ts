// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { wireFileDropZone } from './file-drop-zone.ts';

function mount(t: TestContext) {
  const dom = new JSDOM('<!doctype html><body><label><input type="file" multiple><span></span></label></body>');
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  const drop = doc.querySelector('label')!;
  const input = doc.querySelector('input')!;
  const child = doc.querySelector('span')!;
  const parentEvents: string[] = [];
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
    doc.body.addEventListener(type, () => parentEvents.push(type));
  }
  function drag(type: string, files?: File[] | null): Event {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    if (files !== undefined) Object.defineProperty(event, 'dataTransfer', { value: { files } });
    child.dispatchEvent(event);
    return event;
  }
  function pick(files: File[] | null): void {
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  }
  return { drop, input, parentEvents, drag, pick };
}

test('drag cues prevent defaults and propagation even without files', (t) => {
  const m = mount(t);
  wireFileDropZone(m.drop, m.input, {
    async onFile() { assert.fail('no files were dropped'); },
    async onComplete() { assert.fail('no batch was started'); },
  });
  for (const [type, highlighted] of [
    ['dragenter', true], ['dragover', true], ['dragleave', false], ['dragenter', true], ['drop', false],
  ] as const) {
    assert.equal(m.drag(type).defaultPrevented, true);
    assert.equal(m.drop.classList.contains('is-dragover'), highlighted);
  }
  assert.deepEqual(m.parentEvents, []);
  assert.equal(m.drop.classList.contains('is-busy'), false);
});

for (const source of ['pick', 'drop'] as const) {
  test(`${source} processes files in order, then clears busy and input before refreshing`, async (t) => {
    const m = mount(t);
    const files = [new File(['one'], 'one.icc'), new File(['two'], 'two.icc')];
    Object.defineProperty(m.input, 'value', { configurable: true, writable: true, value: 'selected-file' });
    const calls: string[] = [];
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => { releaseFirst = resolve; });
    let complete!: () => void;
    const completed = new Promise<void>(resolve => { complete = resolve; });
    wireFileDropZone(m.drop, m.input, {
      async onFile(file) {
        assert.equal(m.drop.classList.contains('is-busy'), true);
        assert.equal(m.input.value, 'selected-file');
        assert.equal(file, files[calls.length]);
        calls.push(file.name);
        if (file === files[0]) await firstFinished;
      },
      async onComplete() {
        assert.equal(m.drop.classList.contains('is-busy'), false);
        assert.equal(m.input.value, '');
        calls.push('refresh');
        complete();
      },
    });
    if (source === 'pick') m.pick(files);
    else {
      m.drag('dragover');
      assert.equal(m.drag('drop', files).defaultPrevented, true);
      assert.equal(m.drop.classList.contains('is-dragover'), false);
    }
    assert.deepEqual(calls, ['one.icc']);
    await Promise.resolve();
    assert.deepEqual(calls, ['one.icc']);
    releaseFirst();
    await completed;
    assert.deepEqual(calls, ['one.icc', 'two.icc', 'refresh']);
    assert.deepEqual(m.parentEvents, []);
  });
}

test('empty and missing file lists leave the input and batch state alone', async (t) => {
  const m = mount(t);
  Object.defineProperty(m.input, 'value', { configurable: true, writable: true, value: 'unchanged' });
  wireFileDropZone(m.drop, m.input, {
    async onFile() { assert.fail('no files were selected'); },
    async onComplete() { assert.fail('no batch was started'); },
  });
  m.pick(null);
  m.pick([]);
  m.drag('drop');
  m.drag('drop', null);
  m.drag('drop', []);
  await Promise.resolve();
  assert.equal(m.input.value, 'unchanged');
  assert.equal(m.drop.classList.contains('is-busy'), false);
  assert.deepEqual(m.parentEvents, []);
});
