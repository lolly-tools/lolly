// SPDX-License-Identifier: MPL-2.0
/** Signature-first catalog transactions; network failures never advance the trust floor. */
import {
  catalogFreshness, catalogIndexPath, sha256Hex, verifyEnvelopeSignature,
} from '../../../../engine/src/catalog-integrity.ts';
import type { CatalogSignatureEnvelope, CatalogWatermark } from '../../../../engine/src/catalog-integrity.ts';
import { assetIndexIntegrity } from './asset-integrity.ts';

export interface CatalogSnapshot {
  envelope: CatalogSignatureEnvelope;
  toolText: string;
  assetText?: string;
  slimText?: string;
  /** Validators belong to exact URLs, including a filtered instance's scope. */
  validators: Record<string, string>;
  /** Cached, already accepted bytes used during a network outage. */
  offline?: boolean;
}
export interface AcceptedCatalog { watermark: CatalogWatermark; snapshot: CatalogSnapshot; }
export interface CatalogSnapshotIO {
  fetch(path: string, init: RequestInit): Promise<Response>;
  publicKey: CryptoKey;
  read(scope: string): Promise<AcceptedCatalog | null>;
  latest?(): Promise<AcceptedCatalog | null>;
  /** Must check freshness and write snapshot + floor in one durable transaction. */
  accept(scope: string, snapshot: CatalogSnapshot): Promise<void>;
  now?: () => number;
}
export class CatalogPairError extends Error {}
export class CatalogTrustError extends Error {}
const MAX_CATALOG_BYTES = 16 * 1024 * 1024;
const SIGNATURE_PATH = '/catalog/tools/index.sig.json';

/** A dishonest Content-Length cannot make catalog parsing unbounded. */
async function catalogText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The catalog has no readable body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_CATALOG_BYTES) throw new Error('The catalog exceeds the 16 MiB limit');
      chunks.push(item.value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

const refuse = (reason: string): never => { throw new CatalogTrustError(`Catalog refused: ${reason}`); };

function assetChecksums(text: string, catalogScope?: string): void {
  const reason = assetIndexIntegrity(JSON.parse(text), catalogScope);
  if (reason) refuse(reason);
}

/** Even durable local copies are checked against the pinned identity before reuse. */
async function checkedOffline(io: CatalogSnapshotIO, previous: AcceptedCatalog): Promise<CatalogSnapshot> {
  const snapshot = previous.snapshot, envelope = snapshot.envelope;
  const verified = await verifyEnvelopeSignature(envelope, io.publicKey);
  if (!verified.ok) refuse(verified.reason!);
  const current = await io.read(envelope.catalogScope ?? 'public');
  const fresh = catalogFreshness(envelope, current?.watermark ?? previous.watermark, io.now?.());
  if (!fresh.ok) refuse(fresh.reason!);
  for (const [text, digest] of [[snapshot.toolText, envelope.indexHash], [snapshot.assetText, envelope.assetIndexHash], [snapshot.slimText, envelope.slimHash]] as const) {
    if (digest && (text === undefined || await sha256Hex(new TextEncoder().encode(text)) !== digest)) refuse('the saved catalog bytes do not verify');
  }
  if (snapshot.assetText !== undefined) assetChecksums(snapshot.assetText, envelope.assetIndexHash ? envelope.catalogScope : undefined);
  return { ...snapshot, offline: true };
}

/** Exact text for a hash URL, optionally revalidated from a previously accepted pair. */
async function resource(io: CatalogSnapshotIO, path: string, legacy: string, digest: string | undefined,
  previous: CatalogSnapshot | undefined, text: string | undefined, reload: boolean, validators: Record<string, string>): Promise<string> {
  const headers: Record<string, string> = {};
  if (!reload && previous?.validators[path] && text !== undefined) headers['If-None-Match'] = previous.validators[path]!;
  let response = await io.fetch(path, { headers, cache: reload ? 'reload' : 'no-cache' });
  // One-release interoperability: verify legacy bytes even when a deployment has not
  // enabled hash paths yet. A refusal is never mistaken for a missing public file.
  if (response.status === 404 && path !== legacy) response = await io.fetch(legacy, { cache: reload ? 'reload' : 'no-cache' });
  const body = response.status === 304 && text !== undefined ? text : response.ok ? await catalogText(response) : null;
  if (body === null) throw new Error(`Catalog request failed (HTTP ${response.status})`);
  if (digest && await sha256Hex(new TextEncoder().encode(body)) !== digest) throw new CatalogPairError('the catalog and its signature are out of step');
  const etag = response.headers.get('etag') ?? previous?.validators[path];
  if (etag) validators[path] = etag;
  return body;
}

/** Fetch and accept a complete pair. Only byte-pair mismatches get one reload retry. */
export async function fetchSignedCatalogSnapshot(io: CatalogSnapshotIO): Promise<CatalogSnapshot> {
  const latest = await io.latest?.() ?? null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reload = attempt > 0;
      const headers: Record<string, string> = {};
      if (!reload && latest?.snapshot.validators[SIGNATURE_PATH]) headers['If-None-Match'] = latest.snapshot.validators[SIGNATURE_PATH]!;
      let response: Response;
      try { response = await io.fetch(SIGNATURE_PATH, { headers, cache: reload ? 'reload' : 'no-cache' }); }
      catch (error) {
        // Access refusals and served corrupt bytes never become an offline fallback.
        if (attempt === 0 && latest && error instanceof TypeError) return checkedOffline(io, latest);
        throw error;
      }
      const envelope = response.status === 304 && latest ? latest.snapshot.envelope
        : response.ok ? JSON.parse(await catalogText(response)) as CatalogSignatureEnvelope : null;
      if (!envelope) throw new Error(`Catalog signature request failed (HTTP ${response.status})`);
      const verified = await verifyEnvelopeSignature(envelope, io.publicKey);
      if (!verified.ok) refuse(verified.reason ?? 'the signature does not verify');
      const scope = envelope.catalogScope ?? 'public';
      const accepted = await io.read(scope);
      const fresh = catalogFreshness(envelope, accepted?.watermark ?? null, io.now?.());
      if (!fresh.ok) refuse(fresh.reason!);
      const old = accepted?.snapshot;
      const validators: Record<string, string> = {};
      const signatureValidator = response.headers.get('etag') ?? (response.status === 304 ? latest?.snapshot.validators[SIGNATURE_PATH] : undefined);
      if (signatureValidator) validators[SIGNATURE_PATH] = signatureValidator;
      const toolText = await resource(io, catalogIndexPath(envelope.indexHash), '/catalog/tools/index.json',
        envelope.indexHash, old, old?.envelope.indexHash === envelope.indexHash ? old.toolText : undefined, reload, validators);
      const assetText = envelope.assetIndexHash ? await resource(io, catalogIndexPath(envelope.assetIndexHash, 'assets'), '/catalog/assets/index.json',
        envelope.assetIndexHash, old, old?.envelope.assetIndexHash === envelope.assetIndexHash ? old.assetText : undefined, reload, validators) : undefined;
      if (assetText !== undefined) assetChecksums(assetText, envelope.catalogScope);
      const slimText = envelope.slimHash ? await resource(io, catalogIndexPath(envelope.slimHash, 'slim'), '/catalog/tools/index.slim.json',
        envelope.slimHash, old, old?.envelope.slimHash === envelope.slimHash ? old.slimText : undefined, reload, validators) : undefined;
      for (const text of [toolText, slimText]) {
        if (text === undefined) continue;
        const index = JSON.parse(text) as { tools?: unknown[] };
        if (!Array.isArray(index.tools)) refuse('the signed tool index has no tools list');
      }
      const snapshot: CatalogSnapshot = { envelope, toolText, ...(assetText !== undefined ? { assetText } : {}), ...(slimText !== undefined ? { slimText } : {}), validators };
      // A successful signature alone cannot pin clients past a missing/corrupt index.
      await io.accept(scope, snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof CatalogPairError && attempt === 0) continue;
      throw error;
    }
  }
  throw new CatalogPairError('the catalog and its signature are out of step');
}
