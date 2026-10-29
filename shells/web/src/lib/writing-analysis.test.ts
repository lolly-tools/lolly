// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseWriting, WRITING_ISSUE_LIMIT, WRITING_SCAN_LIMIT } from './writing-analysis.ts';

test('writing checks find wording, adverbs and possible passive voice with exact offsets', () => {
  const text = '😀\r\nIn order to help, the report was quickly written. We utilized the old plan.';
  const analysis = analyseWriting(text);
  assert.deepEqual(analysis.issues.map(issue => [issue.kind, text.slice(issue.start, issue.end)]), [
    ['simpler', 'In order to'], ['passive', 'was quickly written'], ['adverb', 'quickly'], ['simpler', 'utilized'],
  ]);
  assert.equal(analysis.issues[0]!.replacement, 'To');
  assert.equal(analysis.issues.at(-1)!.replacement, 'used');
  assert.equal(analysis.sentences, 2);
  assert.equal(analysis.grade, null);
  assert.deepEqual(analyseWriting(text), analysis, 'analysis never changes its input or retains state');
});

test('Markdown code and destinations are excluded while prose offsets remain unchanged', () => {
  const text = '# Draft\r\n\r\nWe [quickly](https://example.com/utilize) utilize help. `was quickly written`\r\n\r\n```js\r\nwas quickly written\r\n```\r\n\r\n~~~\nutilize quickly\n~~~\n\n    utilize quickly\n\n[ref]: https://example.com/quickly';
  const issues = analyseWriting(text, true).issues;
  assert.deepEqual(issues.map(issue => text.slice(issue.start, issue.end)), ['quickly', 'utilize']);
  assert.equal(issues[0]!.start, text.indexOf('quickly'));
  assert.equal(analyseWriting('```\nutilize quickly', true).issues.length, 0, 'unfinished code fence stays excluded');
  assert.equal(analyseWriting('`quickly`', false).issues.length, 1, 'plain text keeps backticks literal');
});

test('readability and reading time distinguish simple prose from long sentences', () => {
  const simple = analyseWriting('The cat sat on the mat. We had a good day. The sun is out. We can walk to the park.');
  const complex = analyseWriting('The implementation of organizational communication necessitates comprehensive consideration of operational responsibilities and administrative requirements because the coordination of multidisciplinary participants involves considerable complexity and substantial preparation before any meaningful collaboration can commence within the organization.');
  assert.equal(simple.grade !== null, true);
  assert.ok(complex.grade! > simple.grade!);
  assert.equal(simple.readingSeconds, Math.ceil(simple.words / 200 * 60));
  assert.equal(complex.issues.some(issue => issue.kind === 'hard'), true);
  assert.equal(analyseWriting(Array(45).fill('word').join(' ') + '.').issues[0]!.kind, 'very-hard');
});

test('empty text, non-Latin prose and common non-adverbs are handled conservatively', () => {
  assert.deepEqual(analyseWriting(''), { words: 0, sentences: 0, paragraphs: 0, readingSeconds: 0, grade: null, issues: [], limited: false });
  assert.equal(analyseWriting('friendly family lovely lonely early only reply apply supply').issues.length, 0);
  assert.equal(analyseWriting('你好世界。 '.repeat(30)).grade, null);
  assert.equal(analyseWriting('UTILIZE').issues[0]!.replacement, 'USE');
});

test('large or adversarial input has bounded findings and valid source ranges', () => {
  const text = 'quickly '.repeat(100_000);
  const analysis = analyseWriting(text);
  assert.equal(analysis.limited, true);
  assert.equal(analysis.issues.length, WRITING_ISSUE_LIMIT);
  assert.ok(analysis.issues.every(issue => issue.start >= 0 && issue.end <= WRITING_SCAN_LIMIT));
  for (const text of ['`'.repeat(50_000), '['.repeat(50_000), '[a]('.repeat(12_000), '<'.repeat(50_000), '\n'.repeat(50_000), '😀'.repeat(30_000)]) {
    assert.doesNotThrow(() => analyseWriting(text, true));
  }
});
