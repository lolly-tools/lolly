// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextToolsAPI } from '../engine/src/text-tools.ts';
import { highlightCode } from '../engine/src/text-syntax.ts';
import { TextDocument, textFromInput, sourceOffset } from '../engine/src/text-document.ts';
import { parseTextLogs, filterTextLogs, groupTextLogs } from '../engine/src/text-logs.ts';
import { textAssistChunks, finishTextAssist } from '../engine/src/text-assist.ts';
import { createNodeTextTools } from '../packages/node-shell/src/text-tools.ts';
const api = createTextToolsAPI({
  digest: async (algorithm, bytes) =>
    new Uint8Array(await crypto.subtle.digest(algorithm, bytes as BufferSource)),
  random: (length) => crypto.getRandomValues(new Uint8Array(length)),
});
const run = async (
  operation: string,
  text: string,
  options: Record<string, string | number | boolean> = {}
) => await api.run({ operation, text, options });
test('Unicode encodings round-trip and malformed data fails visibly', async () => {
  const text = 'Łódź 🧑🏽‍💻\nالعربية\u0000';
  assert.equal((await run('base64-decode', (await run('base64-encode', text)).text)).text, text);
  assert.equal(
    (await run('base64-decode', (await run('base64-encode', text, { alphabet: 'url-safe' })).text))
      .text,
    text
  );
  assert.equal((await run('url-decode', (await run('url-encode', text)).text)).text, text);
  for (const value of ['a', 'AA=A', '%%%', 'Zh=='])
    await assert.rejects(run('base64-decode', value));
  assert.equal(
    (await run('hash', 'abc')).text,
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});
test('conversions retain values or refuse unsupported values', async () => {
  const input = '{"nested":{"value":null},"list":[1,null,2]}';
  await assert.rejects(run('structured', input, { from: 'json', to: 'toml' }), /null/);
  const yaml = (await run('structured', input, { from: 'json', to: 'yaml' })).text;
  assert.deepEqual(
    JSON.parse((await run('structured', yaml, { from: 'yaml', to: 'json' })).text),
    JSON.parse(input)
  );
  await assert.rejects(
    run('structured', 'a: 1\n---\nb: 2', { from: 'yaml', to: 'json' }),
    /single/
  );
  await assert.rejects(
    run('structured', 'a = 9223372036854775807', { from: 'toml', to: 'json' }),
    /precision/
  );
  assert.match(
    (await run('format', 'const x={a:1}', { language: 'javascript' })).text,
    /const x = \{ a: 1 \};/
  );
});
test('edits preserve selected boundaries and one undo restores the exact source', () => {
  const doc = new TextDocument('α before 👩🏽‍💻 after\r\n');
  const start = doc.value.text.indexOf('before');
  doc.select(start, start + 6, 90);
  const revision = doc.revision;
  assert.ok(doc.replace('BEFORE', undefined, revision));
  assert.equal(doc.value.text, 'α BEFORE 👩🏽‍💻 after\r\n');
  assert.ok(doc.undo());
  assert.equal(doc.value.text, 'α before 👩🏽‍💻 after\r\n');
  assert.equal(doc.value.scroll, 90);
  assert.ok(doc.redo());
  assert.equal(doc.replace('stale', { start: 0, end: 0 }, revision), false);
  assert.equal(textFromInput('a\r\nb\nc\r\n', 'a\nB\nc\n'), 'a\r\nB\nc\r\n');
  assert.equal(textFromInput('a\r\nb', 'a\nb\nc'), 'a\r\nb\r\nc');
  assert.equal(sourceOffset('a\r\nb', 2), 3);
});
test('logs retain raw source, continuations, fields and consecutive repetitions', () => {
  const text =
    'INFO ready\nERROR failed\n  at module:4\nERROR failed\n  at module:4\n{"PRIORITY":"3","MESSAGE":"disk","_SYSTEMD_UNIT":"disk.service"}\n{broken json}\n';
  const report = parseTextLogs(text);
  assert.equal(report.events.length, 5);
  assert.equal(report.events.map((e) => e.raw).join(''), text);
  assert.equal(report.events[1]!.lastLine, 3);
  assert.equal(groupTextLogs(report.events)[1]!.length, 2);
  assert.equal(report.events[3]!.source, 'disk.service');
  assert.equal(filterTextLogs(report.events, { severity: 'error' }).length, 3);
  assert.equal(report.counts.unclassified, 1);
  for (const event of report.events) assert.equal(text.slice(event.start, event.end), event.raw);
});
test('ASCII remains ASCII and never silently discards unsupported input', async () => {
  for (const style of ['compact', 'block', 'slant']) {
    const result = await run('ascii', 'A 9', { style, ink: '@' });
    assert.match(result.text, /^[\x20-\x7e\n]+$/);
    assert.equal(result.text.split('\n').length, 7);
    assert.ok(result.text.includes('@'));
  }
  await assert.rejects(run('ascii', 'café'));
  await assert.rejects(run('ascii', 'HI', { width: 2 }));
});
test('redaction maps are reversible without recursively replacing replacement text', async () => {
  const original = 'Contact alice@example.com and Alice.';
  const result = await run('redact', original, { literals: 'Alice' });
  assert.notEqual(result.text, original);
  assert.equal(
    (await run('restore', result.text, { map: JSON.stringify(result.details!.aliases) })).text,
    original
  );
  assert.equal(
    (await run('restore', '[A] [B]', { map: '{"[A]":"[B]","[B]":"original"}' })).text,
    '[B] original'
  );
});
test('syntax never treats code as HTML and shared callouts remain opt-in', () => {
  const code = 'const x = "<img onerror=alert(1)>"; // TODO **check**';
  const result = highlightCode(code, 'javascript');
  assert.ok(result.html.includes('tok-keyword'));
  assert.ok(!result.html.includes('<img'));
  assert.ok(!result.html.includes('cc-callout'));
  assert.ok(
    highlightCode(code, 'javascript', { calloutMode: 'tags' }).html.includes(
      '<strong>check</strong>'
    )
  );
  const decoded = result.html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  assert.equal(decoded, code);
  assert.equal(highlightCode('everyday prose', 'auto').language, 'plain');
});
test('AI chunks retain every character and source lines', () => {
  const text = 'A passage about code.\n'.repeat(220);
  const chunks = textAssistChunks(text);
  assert.equal(chunks.map((c) => c.text).join(''), text);
  assert.equal(chunks[0]!.firstLine, 1);
  assert.ok(chunks.every((c) => c.text.length <= 1800));
  assert.throws(() => textAssistChunks('a'.repeat(16001)));
});
test('AI synopsis can only select original excerpts and rewrites must preserve details', () => {
  const chunk = {
    text: 'The team released version 2 on Monday. It fixes the search bug.\nOffline mode is still being tested.',
    firstLine: 12,
    lastLine: 13,
  };
  assert.equal(
    finishTextAssist(chunk, 'synopsis', '[1,3]'),
    'The team released version 2 on Monday.\n[Source line 12]\n\nOffline mode is still being tested.\n[Source line 13]'
  );
  for (const output of ['Android was released.', '[0]', '[4]', '[1,2,3,4]'])
    assert.throws(() => finishTextAssist(chunk, 'synopsis', output));
  assert.throws(() => finishTextAssist(chunk, 'rewrite', 'Android version 3 is ready.'));
});
test('regex replacement can delete matches and reports exact source offsets', async () => {
  const result = await run('regex', 'a123b45', {
    pattern: '\\d+',
    mode: 'replace',
    replacement: '',
  });
  assert.equal(result.text, 'ab');
  assert.deepEqual(
    (result.details!.matches as Array<{ at: number }>).map((match) => match.at),
    [1, 5]
  );
});
test('Node bridge executes the same operations in a disposable worker', async () => {
  const node = createNodeTextTools();
  assert.equal((await node.run({ text: 'HELLO', operation: 'lower' })).text, 'hello');
  assert.equal(
    (await node.highlight('const a=1', 'javascript')).html,
    highlightCode('const a=1', 'javascript').html
  );
  assert.ok(!(await node.operations()).some((op) => /qr/i.test(op.label)));
});

test('XML validation distinguishes syntax and schema without loading external resources', async () => {
  const { xmlText } = await import('../packages/node-shell/src/text-xml.ts');
  const schema =
    '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="count" type="xs:integer"/></xs:schema>';
  assert.match(await xmlText('<count>4</count>', schema, false), /Valid against/);
  await assert.rejects(xmlText('<count>four</count>', schema, false));
  await assert.rejects(xmlText('<count>', '', false));
  await assert.rejects(
    xmlText('<!DOCTYPE x SYSTEM "https://example.com/private"><x/>', '', false),
    /DTDs/
  );
  await assert.rejects(
    xmlText('<x/>', '<xs:include schemaLocation="file:///private"/>', false),
    /External/
  );
});
test('code compaction preserves string literals and important CSS spacing', async () => {
  const js = 'function greet(name) { return "hello  " + name; }';
  const compact = await run('format', js, { language: 'javascript', style: 'compact' });
  assert.equal(new Function(compact.text + ';return greet("World")')(), 'hello  World');
  const css = (
    await run('format', 'p { width: calc(100% - 2px); content: "a  b"; }', {
      language: 'css',
      style: 'compact',
    })
  ).text;
  assert.match(css, /calc\(100% - 2px\)/);
  assert.match(css, /a {2}b/);
});

test('loading another document clears old undo and redo and rejects stale edits', () => {
  const doc = new TextDocument('first\r\n');
  assert.equal(doc.canUndo, false);
  doc.replace('FIRST', { start: 0, end: 5 });
  const revision = doc.revision;
  assert.equal(doc.canUndo, true);
  doc.undo();
  assert.equal(doc.canRedo, true);
  doc.reset('second\r\n');
  assert.equal(doc.value.text, 'second\r\n');
  assert.equal(doc.canUndo, false);
  assert.equal(doc.canRedo, false);
  assert.equal(doc.undo(), false);
  assert.equal(doc.redo(), false);
  assert.equal(doc.replace('stale', { start: 0, end: 0 }, revision), false);
});
