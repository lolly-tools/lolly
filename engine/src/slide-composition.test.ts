// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeSlideMarkdown, parseSlideMarkdown, slideGridCells } from './slide-composition.ts';

for (const [count, columns, rows] of [[3, 3, 1], [4, 2, 2], [6, 3, 2], [9, 3, 3]]) {
  test(`${count} peer bullets become ${columns} columns and ${rows} rows`, () => {
    const result = composeSlideMarkdown('# Priorities\n\n' + Array.from({ length: count! }, (_, i) => `- Priority ${i + 1}`).join('\n'));
    assert.equal(result.plan.columns, columns); assert.equal(result.plan.cells.length, count);
    assert.equal(new Set(result.plan.cells.map(c => c.y)).size, rows);
  });
}
test('section headings retain nested bullets and code in their own group', () => {
  const content = parseSlideMarkdown('# Plan\nIntro\n\n## Build\n- First\n  - Nested\n\n```md\n## Literal\n```\n\n## Ship\n- Last');
  assert.equal(content.title, 'Plan'); assert.equal(content.intro, 'Intro'); assert.equal(content.groups.length, 2);
  assert.match(content.groups[0]!.body, / {2}- Nested/); assert.match(content.groups[0]!.body, /## Literal/);
});
test('subheadings stay with their parent and indented peer bullets still form columns', () => {
  const content = parseSlideMarkdown('# Plan\n## Build\n### Detail\n- First\n## Ship\n- Last');
  assert.equal(content.groups.length, 2); assert.match(content.groups[0]!.body, /### Detail/);
  assert.equal(composeSlideMarkdown('# Plan\n  - A\n    - Detail\n  - B\n  - C').plan.columns, 3);
});
test('ordered peers produce steps, retain labels, and preserve manual geometry as counts change', () => {
  const content = '# Steps\n4. **Discover**: Ask people\n5. **Build**: Try a prototype\n6. **Learn**: Test';
  const result = composeSlideMarkdown(content); assert.equal(result.plan.kind, 'steps'); assert.equal(result.content.groups[0]!.ordinal, '4');
  const manual = composeSlideMarkdown(content + '\n7. Improve', { recipe: 'flow-columns-3-2' });
  assert.equal(manual.plan.kind, 'columns'); assert.equal(manual.plan.columns, 2);
});
test('longer text can choose wider columns without dropping words', () => {
  const source = '# Choices\n' + Array.from({ length: 3 }, (_, i) => `- **Option ${i}**: ${'Long detail '.repeat(45)}`).join('\n');
  const result = composeSlideMarkdown(source);
  assert.equal(result.content.groups.length, 3); assert.match(result.content.groups[2]!.body, /Long detail/);
  assert.ok(result.choices.some(c => c.columns === 1));
});
test('more than twelve groups remain in the source and carry a split hint', () => {
  const source = '# Many\n' + Array.from({ length: 15 }, (_, i) => `- Item ${i}`).join('\n');
  const result = composeSlideMarkdown(source); assert.match(result.content.groups[0]!.body, /Item 14/); assert.match(result.plan.warning, /Split/);
});
test('shared cells are bounded, disjoint and centre the last row', () => {
  const cells = slideGridCells(5, 3, { x: .05, y: .2, w: .9, h: .6 });
  assert.ok(cells[3]!.x > cells[0]!.x);
  for (const cell of cells) { assert.ok(cell.x >= .05 && cell.y >= .2); assert.ok(cell.x + cell.w <= .951 && cell.y + cell.h <= .801); }
});
