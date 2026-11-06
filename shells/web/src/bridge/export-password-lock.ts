// SPDX-License-Identifier: MPL-2.0
/**
 * The export bridge's rules for a password on a PDF: what the standard tier can lock, and
 * the last look at a locked file before anything else receives the bytes.
 *
 * The standard lock is built into a document with no finishing left to run, so it has
 * nowhere to go on a Print PDF or on a PDF with print geometry. Those renderers used to drop
 * it and write an unlocked file. The export panel never asks for this (it forces the Strong
 * lock there); these checks keep every other caller from getting that file.
 */
import { parseDimension, toPoints } from '@lolly/engine';
import type { ExportOpts } from './export-shared.ts';

/** The writer's encryption settings for the standard tier, on a page with no print geometry. */
export function standardPdfEncryption(opts: ExportOpts, hasGeometry: unknown): { userPassword: string; ownerPassword: string; userPermissions: string[] } | undefined {
  return opts.password && !hasGeometry ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print'] } : undefined;
}

/** Throws before any work when the standard password has nowhere to go on this export. */
export function assertStandardPasswordFits(format: string, opts: ExportOpts): void {
  if (!opts.password) return;
  if (format === 'pdf-cmyk') throw new Error('A standard password cannot lock a Print PDF. Use the Strong lock.');
  if (format !== 'pdf') return;
  const bleed = parseDimension(opts.bleed);
  const geometry = (bleed ? toPoints(bleed) : 0) > 0 || opts.cropMarks || opts.registrationMarks || opts.bleedMarks || opts.colorBars || opts.provenance;
  if (geometry) throw new Error('A standard password cannot be combined with bleed or print marks. Use the Strong lock.');
  if (!/^[\x20-\x7e]+$/.test(opts.password)) throw new Error('A standard password takes plain ASCII. Use the Strong lock.');
}

/** Both writers end a locked PDF with a classic trailer that points at its /Encrypt dictionary. */
export async function assertPdfCameOutLocked(blob: Blob, format: string, opts: ExportOpts): Promise<void> {
  if (!(opts.password || opts.strongPassword) || (format !== 'pdf' && format !== 'pdf-cmyk')) return;
  const tail = new Uint8Array(await blob.slice(Math.max(0, blob.size - 8192)).arrayBuffer());
  if (!/\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/.test(String.fromCharCode(...tail))) {
    throw new Error('This PDF came out without its password, so it was not written.');
  }
}
