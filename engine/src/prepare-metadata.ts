// SPDX-License-Identifier: MPL-2.0
/** Compose existing metadata removal with per-file recovery and output inspection. */
import type { PdfAPI, PreparationResult } from '@lolly-tools/core/host-v1';
import { stripMetadata } from './strip-metadata.ts';
import { extractFileMetadata } from './file-metadata.ts';
import { preparationDigest, type PreparationOptions } from './prepare.ts';

/** Existing Strip Hidden Data operations, with verified output counts. Each failed
 * transform retains that file and allows other copies to complete. No values leave
 * the private inspector in the report. PDF services are supplied by the shell. */
export async function applyPreparationMetadata(input: PreparationResult, ids: string[], pdf?: Pick<PdfAPI, 'analyze' | 'strip'>, options: PreparationOptions = {}): Promise<PreparationResult> {
  const result = structuredClone(input);
  result.report.stages ??= [];
  for (const id of [...new Set(ids)]) {
    options.signal?.throwIfAborted();
    const output = result.outputs.find(s => s.id === id);
    if (!output) throw new Error('Unknown metadata source.');
    const ext = output.name.split('.').pop()?.toLowerCase();
    const originalHash = await preparationDigest(output.bytes);
    try {
      const format = ext === 'jpg' ? 'jpeg' : ext;
      let before: number, after: number, bytes: Uint8Array;
      if (format === 'pdf') {
        if (!pdf) throw new Error('PDF metadata removal is unavailable.');
        before = (await pdf.analyze(output.bytes)).findings.length;
        bytes = (await pdf.strip(output.bytes)).bytes;
        after = (await pdf.analyze(bytes)).findings.length;
      } else if (format === 'jpeg' || format === 'png' || format === 'svg') {
        const first = extractFileMetadata(output.bytes);
        if (first.format.toLowerCase() !== format) throw new Error('The file does not match this format.');
        before = first.fields.length;
        bytes = stripMetadata(output.bytes, format);
        after = extractFileMetadata(bytes).fields.length;
      } else throw new Error('Metadata removal is unavailable for this format.');
      options.signal?.throwIfAborted();
      if (bytes.length > 32 * 1024 * 1024) throw new Error('Metadata output is too large.');
      const sha256 = await preparationDigest(bytes);
      output.bytes = bytes;
      const ref = result.report.outputs.find(s => s.id === id)!;
      ref.sha256 = sha256; ref.size = bytes.length; ref.changed = sha256 !== result.report.sources.find(s => s.id === id)?.sha256;
      const inspected = result.inspection.sources.find(s => s.id === id)!; inspected.sha256 = sha256; inspected.size = bytes.length;
      const limitations = ['Metadata was re-inspected after removal; structural file fields may remain.', 'Visible content, attachments, scripts and unrecognized data are not certified removed by this metadata operation.', 'Metadata removal can invalidate signatures, remove colour profiles or discard JPEG HDR gain maps.'];
      result.report.stages.push({ sourceId: id, operation: 'strip-hidden-data', status: 'completed', inputSha256: originalHash, outputSha256: sha256, before, after, limitations });
      const scope = result.report.scopes.find(s => s.id === id);
      if (scope) { scope.status = 'partial'; scope.limitations = limitations; }
      const privateScope = result.inspection.scopes.find(s => s.id === id);
      if (privateScope) { privateScope.status = 'partial'; privateScope.limitations = limitations; }
    } catch {
      options.signal?.throwIfAborted();
      result.report.stages.push({ sourceId: id, operation: 'strip-hidden-data', status: 'failed', inputSha256: originalHash, outputSha256: originalHash, limitations: ['Metadata removal could not finish. This file was retained; review it or retry in Strip Hidden Data.'] });
    }
  }
  return result;
}
