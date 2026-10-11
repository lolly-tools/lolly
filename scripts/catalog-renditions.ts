#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Protected sign-once rendition cache. Never rewrites an original or an existing product. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { embedC2pa } from '../engine/src/c2pa.ts';
import type { EmbedOptions, C2paIngredientInput } from '../engine/src/c2pa.ts';
import { prepareC2paIngredient } from '../engine/src/c2pa-extract.ts';
import { renditionKey } from '../packages/core/src/delivery-v1.ts';
import type { RenditionSpec } from '../packages/core/src/delivery-v1.ts';

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
export interface RenditionCredits { title: string; attribution?: string; license?: string; rights?: unknown }
export interface RenditionRecord {
  v: 1; sourceSha256: string; signerVersion: string; spec: RenditionSpec;
  sha256: string; file: string; width: number; height: number; size: number;
  credits: RenditionCredits;
}
export const DEFAULT_RASTER_LADDER: readonly RenditionSpec[] = [320, 640, 1280].map(w => ({ w, fit: 'inside', format: 'webp', q: 80 }));
export async function encodeRendition(source: Uint8Array, spec: RenditionSpec) {
  renditionKey(spec);
  const info = await sharp(source, { limitInputPixels: 64_000_000 }).metadata();
  if ((info.pages ?? 1) > 1) throw new Error('Animated sources require an explicit poster policy');
  if (!info.width || !info.height) throw new Error('Source dimensions are unavailable');
  const rotated = info.orientation !== undefined && info.orientation >= 5;
  const width = rotated ? info.height : info.width, height = rotated ? info.width : info.height;
  if ((spec.w !== undefined && spec.w > width) || (spec.h !== undefined && spec.h > height)) throw new Error('Renditions must never upscale');
  // Keep source EXIF/IPTC/XMP/ICC before adding the derivative's credential.
  // Original JUMBF bytes are preserved separately as a parent ingredient.
  const pipeline = sharp(source, { limitInputPixels: 64_000_000 }).rotate().resize({ width: spec.w, height: spec.h, fit: spec.fit, withoutEnlargement: true }).keepMetadata();
  return pipeline.toFormat(spec.format, { quality: spec.q ?? 80 }).toBuffer({ resolveWithObject: true });
}
/** Approval is explicit at the write seam; tests can supply an isolated fixture signer. */
export async function signedRendition(opts: {
  source: Uint8Array; sourceUrl: string; sourceFormat: string; spec: RenditionSpec;
  credits: RenditionCredits; signerVersion: string; cache: string;
  approveSigning: boolean; signing?: Pick<EmbedOptions, 'signer' | 'dates' | 'claimGenerator' | 'generatorInfo'>;
}): Promise<RenditionRecord & { bytes: Uint8Array; cached: boolean }> {
  if (!opts.approveSigning) throw new Error('Rendition manifest writing requires owner approval (Plan 300 Q4)');
  const url = new URL(opts.sourceUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || [...url.searchParams.keys()].some(k => /^(dt|token|pw|x-amz-.+)$/i.test(k))) throw new Error('An ingredient requires a persistent public source URL');
  if (!opts.signerVersion || opts.signerVersion.length > 200) throw new Error('A rendition needs a bounded signer identity/version');
  const sourceSha256 = sha(opts.source), key = renditionKey(opts.spec);
  const identity = sha(JSON.stringify({ sourceSha256, key, signerVersion: opts.signerVersion }));
  mkdirSync(opts.cache, { recursive: true, mode: 0o700 });
  const directory = join(opts.cache, identity), recordPath = join(directory, 'record.json');
  const readCached = () => {
    if (!existsSync(recordPath)) return null;
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as RenditionRecord;
    if (record.v !== 1 || record.sourceSha256 !== sourceSha256 || record.signerVersion !== opts.signerVersion || renditionKey(record.spec) !== key || JSON.stringify(record.credits) !== JSON.stringify(opts.credits) || !/^out\.[0-9a-f]{16}\.(png|jpeg|webp|avif)$/.test(record.file)) throw new Error('Rendition cache identity mismatch');
    const bytes = new Uint8Array(readFileSync(join(directory, record.file)));
    if (sha(bytes) !== record.sha256 || bytes.length !== record.size) throw new Error('Rendition cache checksum mismatch');
    return { ...record, bytes, cached: true };
  };
  const previous = readCached(); if (previous) return previous;
  const lock = `${directory}.lock`;
  try { mkdirSync(lock, { mode: 0o700 }); } catch { throw new Error('Rendition writer is already active; retry after it completes'); }
  try {
    const concurrent = readCached(); if (concurrent) return concurrent;
    const encoded = await encodeRendition(opts.source, opts.spec);
    const parent = prepareC2paIngredient(opts.source);
    const ingredient: C2paIngredientInput = parent ? { ...parent, relationship: 'parentOf' } : {
      credential: 'none', relationship: 'parentOf', title: opts.credits.title,
      format: opts.sourceFormat, url: opts.sourceUrl, hash: new Uint8Array(createHash('sha256').update(opts.source).digest()), size: opts.source.length,
      ...(opts.credits.attribution ? { description: opts.credits.attribution } : {}),
    };
    const resized = encoded.info.width !== (await sharp(opts.source).metadata()).width || encoded.info.height !== (await sharp(opts.source).metadata()).height;
    const bytes = await embedC2pa(new Uint8Array(encoded.data), opts.spec.format, {
      ...opts.signing, title: opts.credits.title, authorship: 'delivered',
      actions: [
        ...(resized ? [{ action: 'c2pa.resized', parameters: { width: encoded.info.width, height: encoded.info.height } }] : []),
        ...(opts.spec.format !== opts.sourceFormat ? [{ action: 'c2pa.transcoded', parameters: { format: opts.spec.format } }] : []),
      ], ingredients: [ingredient],
      rights: [opts.credits.attribution, opts.credits.license].filter(Boolean).join(' · ') || undefined,
      environment: { role: 'catalog rendition', sourceSha256, rendition: opts.spec, renditionKey: key,
        credits: opts.credits, creditsJson: JSON.stringify(opts.credits), signerVersion: opts.signerVersion },
    });
    const hash = sha(bytes), file = `out.${hash.slice(0, 16)}.${opts.spec.format}`;
    const record: RenditionRecord = { v: 1, sourceSha256, signerVersion: opts.signerVersion, spec: opts.spec, sha256: hash, file, width: encoded.info.width, height: encoded.info.height, size: bytes.length, credits: opts.credits };
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const output = join(directory, file);
    if (existsSync(output) && sha(readFileSync(output)) !== hash) throw new Error('Rendition hash-prefix collision');
    if (!existsSync(output)) writeFileSync(output, bytes, { mode: 0o600, flag: 'wx' });
    const pending = join(directory, 'record.pending.json');
    writeFileSync(pending, JSON.stringify(record, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(pending, recordPath);
    return { ...record, bytes, cached: false };
  } finally { rmSync(lock, { recursive: true, force: true }); }
}
