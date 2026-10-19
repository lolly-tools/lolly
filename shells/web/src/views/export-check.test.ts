// SPDX-License-Identifier: MPL-2.0
/**
 * The export check's shell half - views/export-check.ts: a delivered Blob read
 * back within its memory bound, and only differences reaching the export card.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Finding, PreflightJob } from '@lolly/engine';
import { packPng } from '../../../../engine/src/png.ts';
import { EXPORT_CHECK_MAX_BYTES, exportCheckFindings, exportCheckLines } from './export-check.ts';

const job = (format: string, width = 4, height = 3): PreflightJob => ({
  source: 'web',
  manifest: { id: 'card', render: { width: 4, height: 3, formats: ['png', 'jpg'] } },
  settings: {
    format,
    size: { width: { value: width, unit: 'px' }, height: { value: height, unit: 'px' }, dpi: 96, declaredBy: 'url', unitDeclared: true },
    bleed: { known: true, value: null },
    marks: { known: true, value: null },
    pressProfile: { known: true, value: null },
  },
  palette: { known: false, why: 'not-resolved' },
  stage: { known: false, why: 'needs-mount' },
});
const png = (channels: 3 | 4): Blob => new Blob([packPng(new Uint8Array(4 * 3 * channels), { width: 4, height: 3, channels }) as BlobPart], { type: 'image/png' });

test('a delivered file that matches the settings puts nothing on the card', async () => {
  const findings = await exportCheckFindings(job('png'), png(4), { format: 'png', alpha: 'transparent' });
  assert.deepEqual(exportCheckLines(findings), []);
});

test('differences reach the card in the engine wording; notes and gaps do not', async () => {
  const findings = await exportCheckFindings(job('avif', 8, 6), png(3), { format: 'avif', alpha: 'transparent', credential: true });
  const lines = exportCheckLines(findings);
  assert.ok(lines.some((l) => /not the avif that was requested/.test(l)), lines.join('\n'));
  assert.ok(lines.some((l) => /8 x 6 was requested/.test(l)), lines.join('\n'));
  assert.ok(lines.some((l) => /no alpha channel/.test(l)), lines.join('\n'));
  assert.ok(lines.some((l) => /Content Credentials/.test(l)), lines.join('\n'));
  const info: Finding = { id: 'output.unverified', severity: 'info', needs: 'not-computable', message: 'gap' };
  assert.deepEqual(exportCheckLines([info]), []);
});

test('a manifest-sized job requests no size, so the measured size is not a difference', async () => {
  const manifestJob = job('png', 1200, 630);
  const sized = { ...manifestJob, settings: { ...manifestJob.settings, size: { ...manifestJob.settings.size, declaredBy: 'manifest' as const, unitDeclared: false } } };
  assert.deepEqual(exportCheckLines(await exportCheckFindings(sized, png(4), { format: 'png' })), []);
});

test('a file above the read-back bound is skipped rather than copied', async () => {
  const huge = { size: EXPORT_CHECK_MAX_BYTES + 1, arrayBuffer: () => { throw new Error('must not be read'); } } as unknown as Blob;
  assert.deepEqual(await exportCheckFindings(job('png'), huge, { format: 'png' }), []);
});
