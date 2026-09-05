// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { runNodeFileOperation } from '../packages/node-shell/src/file-operations.ts';
import { assertFileOperationReport } from '../packages/core/src/file-operation-v1.ts';
test('Node uses shared receipts and produces correctly sized real JPEG bytes', async () => {
  const bytes = await sharp({ create: { width: 200, height: 100, channels: 4, background: '#33668888' } }).png().toBuffer();
  const result = await runNodeFileOperation(new File([bytes], 'photo.png', { type: 'image/png' }), { version: 1, operation: 'convert', target: 'jpeg', options: { maxEdge: 100 } });
  assertFileOperationReport(result.report); assert.equal(result.report.state, 'succeeded');
  const output = Buffer.from(await result.output!.arrayBuffer());
  const facts = await sharp(output).metadata();
  assert.deepEqual([facts.format, facts.width, facts.height], ['jpeg', 100, 50]);
  assert.equal(result.report.outputs[0]!.sha256, createHash('sha256').update(output).digest('hex'));
  assert.equal(result.output!.name, 'photo.jpg');
  const fail = await runNodeFileOperation(new File([bytes], 'photo.png'), { version: 1, operation: 'convert', target: 'jpeg', options: { targetBytes: 1 } });
  assert.equal(fail.report.state, 'failed'); assert.equal(fail.output, undefined);
});
test('Node data conversions share duplicate-header refusal and values-only warnings', async () => {
  const result = await runNodeFileOperation(new File(['name,value\na,3'], 'table.csv'), { version: 1, operation: 'convert', target: 'json', options: {} });
  assert.equal(result.report.state, 'succeeded'); assert.deepEqual(JSON.parse(await result.output!.text()), [{ name: 'a', value: '3' }]);
  const fail = await runNodeFileOperation(new File(['name,name\na,3'], 'table.csv'), { version: 1, operation: 'convert', target: 'json', options: {} });
  assert.equal(fail.report.state, 'failed'); assert.equal(fail.output, undefined);
});
test('EXIF orientation is applied before fitting to the longest edge', async () => {
  const bytes = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#336688' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await runNodeFileOperation(new File([bytes], 'rotated.jpg'), { version: 1, operation: 'convert', target: 'png', options: { maxEdge: 100 } });
  const output = await sharp(Buffer.from(await result.output!.arrayBuffer())).metadata();
  assert.deepEqual([output.width, output.height], [50, 100]);
});
