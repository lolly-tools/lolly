// SPDX-License-Identifier: MPL-2.0
import { consumeSaveAsNext } from './export-save-picker.ts';
import type { DeliveryOutcome } from './export-save-picker.ts';

type Download = (blob: Blob, filename: string) => Promise<void>;

/**
 * What a shell that writes the file itself can add to a 'saved' outcome (plans/277,
 * P9). Every field is optional: a receipt with none of them reads exactly like a
 * plain 'saved'. Shell-internal, not part of HostV1: `download` still resolves void,
 * and a receipt travels only through deliveryFor(), beside the bridge function it
 * belongs to.
 */
export interface SavedReceipt {
  readonly saved: true;
  /** The name the file was written under, when the shell changed it ("qr (1).png"). */
  readonly name?: string;
  /** Where the file went, in the words the shell's own notice uses ("Downloads/Lolly"). */
  readonly place?: string;
  /** Show the written file in the system file manager. Present only where the shell can. */
  readonly reveal?: () => Promise<void>;
}

/** A delivery's outcome, or a completed native write with its optional detail. */
export type DeliveryReport = DeliveryOutcome | SavedReceipt;

type Deliver = (blob: Blob, filename: string) => Promise<DeliveryReport>;

const OUTCOMES: ReadonlySet<unknown> = new Set<DeliveryOutcome>(['saved', 'requested', 'cancelled']);

/** The receipt inside a report, keeping only well-formed fields; null for a plain outcome. */
export function receiptOf(report: unknown): SavedReceipt | null {
  if (!report || typeof report !== 'object' || (report as { saved?: unknown }).saved !== true) return null;
  const { name, place, reveal } = report as Record<string, unknown>;
  return {
    saved: true,
    ...(typeof name === 'string' && name ? { name } : {}),
    ...(typeof place === 'string' && place ? { place } : {}),
    ...(typeof reveal === 'function' ? { reveal: reveal as () => Promise<void> } : {}),
  };
}

/** The plain outcome of a report. Anything unrecognised counts as a request, never a save. */
export function outcomeOf(report: unknown): DeliveryOutcome {
  if (OUTCOMES.has(report)) return report as DeliveryOutcome;
  return receiptOf(report) ? 'saved' : 'requested';
}

// Associate outcomes with the bridge function, not a global last-result slot.
// Concurrent exports cannot steal each other's outcome. Native overrides replace
// the function and therefore continue through their own delivery implementation.
const deliveries = new WeakMap<Download, Deliver>();

export function createDownload(request: (blob: Blob, filename: string) => void): Download {
  const deliver: Deliver = async (blob, filename) => {
    const picked = await consumeSaveAsNext(blob, filename);
    if (picked !== null) return picked;
    request(blob, filename);
    return 'requested';
  };
  const download: Download = async (blob, filename) => { await deliver(blob, filename); };
  deliveries.set(download, deliver);
  return download;
}

export function deliveryFor(download: Download): Deliver | undefined {
  return deliveries.get(download);
}

/**
 * For a shell that writes the file itself (the Tauri export overrides). The returned
 * function is an ordinary HostV1 download: it resolves void, throws when the write
 * fails and throws AbortError when a native dialog is dismissed. What `write`
 * reports reaches deliverFile through deliveryFor(), so the lazy facade below can
 * say the file was saved instead of guessing 'requested'. A report it does not
 * recognise counts as 'requested', which is what every shell said before this.
 */
export function reportingDownload(write: (blob: Blob, filename: string) => Promise<DeliveryReport>): Download {
  const deliver: Deliver = async (blob, filename) => {
    const report = await write(blob, filename);
    return receiptOf(report) ?? outcomeOf(report);
  };
  const download: Download = async (blob, filename) => { await deliver(blob, filename); };
  deliveries.set(download, deliver);
  return download;
}

/**
 * Preserve delivery evidence through the bridge's lazy export facade. An
 * implementation registered here (createDownload, reportingDownload) answers for
 * itself; one that is not can only prove it was asked, so it reports 'requested'.
 */
export function deferredDownload(load: () => Promise<Download>): Download {
  const deliver: Deliver = async (blob, filename) => {
    const implementation = await load();
    const known = deliveryFor(implementation);
    if (known) return known(blob, filename);
    await implementation(blob, filename);
    return 'requested';
  };
  const download: Download = async (blob, filename) => { await deliver(blob, filename); };
  deliveries.set(download, deliver);
  return download;
}

/** File-transform delivery changes only explicitly requested font containers. */
export async function fileDeliveryBlob(blob: Blob, name: string): Promise<Blob> {
  const ext = name.match(/\.(ttf|otf|woff)$/i)?.[1]?.toLowerCase();
  if (!ext) return blob;
  const {sfntKind,convertFontContainer} = await import('@lolly/engine');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return sfntKind(bytes) ? new Blob([convertFontContainer(bytes,ext) as BlobPart], {type:`font/${ext}`}) : blob;
}
