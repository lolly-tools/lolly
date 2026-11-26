// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HostV1 } from '../../../../engine/src/bridge/host-v1.ts';
import { saveTakeNative, takeFilename, takeNameFrom } from './audio-take.ts';

test('take names use the export filename slug and signed suffix', () => {
  assert.equal(takeFilename('webm', false, '  Café / Meeting: Notes  '), 'cafe-meeting-notes.webm');
  assert.equal(takeFilename('m4a', true, '  Café / Meeting: Notes  '), 'cafe-meeting-notes-lolly.m4a');
  assert.equal(takeFilename('mp3', true, 'Voice note'), 'voice-note-lolly.mp3');
  assert.equal(takeFilename('mp3', true, 'Voice note-lolly'), 'voice-note-lolly.mp3');
  assert.equal(takeFilename('ogg', false, 'a'.repeat(60)), `${'a'.repeat(40)}.ogg`);
});

test('empty or unusable names keep the existing filenames', () => {
  for (const name of [undefined, '', '   ', '///']) {
    assert.equal(takeFilename('webm', false, name), 'voice-recording.webm');
    assert.equal(takeFilename('ogg', true, name), 'voice-recording-lolly.ogg');
    assert.equal(takeFilename('mp3', true, name), 'voice-recording-lolly.mp3');
  }
});

test('native saves pass the name through and preserve the original blob', async () => {
  const files: Array<{ blob: Blob; filename: string }> = [];
  const host = { export: { file: async (blob: Blob, opts: { filename: string }) => { files.push({ blob, filename: opts.filename }); } } } as unknown as HostV1;
  const blob = new Blob(['take']);
  await saveTakeNative(host, { blob, mimeType: 'audio/mp4', container: 'm4a' }, 'My note');
  await saveTakeNative(host, { blob, mimeType: 'audio/ogg', container: null }, 'My note');
  await saveTakeNative(host, { blob, mimeType: 'audio/webm', container: null });
  assert.deepEqual(files, [
    { blob, filename: 'my-note-lolly.m4a' },
    { blob, filename: 'my-note.ogg' },
    { blob, filename: 'voice-recording.webm' },
  ]);
});

test('a tool with an asset input called audio takes the recording as that input', async () => {
  const { takesAudioInput } = await import('./audio-take.ts');
  assert.equal(takesAudioInput([{ id: 'audio', type: 'asset' }, { id: 'title', type: 'text' }]), true, 'Audiogram');
  assert.equal(takesAudioInput([{ id: 'name', type: 'text' }, { id: 'target', type: 'select' }]), false, 'Voice Recorder keeps the take');
  assert.equal(takesAudioInput([{ id: 'audio', type: 'boolean' }]), false, 'an input that only shares the id does not count');
});


test('a take is filed under the tool\'s name input, or its title', () => {
  assert.equal(takeNameFrom([{ id: 'name', value: 'Memo' }, { id: 'title', value: 'Card' }]), 'Memo');
  assert.equal(takeNameFrom([{ id: 'title', value: 'Standup notes' }, { id: 'theme', value: 'dark' }]), 'Standup notes', 'Voice Recorder');
  assert.equal(takeNameFrom([{ id: 'title', value: '  ' }]), undefined);
  assert.equal(takeNameFrom([{ id: 'title', value: 7 }]), undefined);
});
