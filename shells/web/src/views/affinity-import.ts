// SPDX-License-Identifier: MPL-2.0
/**
 * Native Affinity files (.af, .afdesign, .afphoto, .afpub) in Design, Unpack and the drop router.
 *
 * Stage 2 maps the document model to editable rows. Stage 1 is the fallback when the model cannot be
 * read or mapped: Affinity's own embedded preview placed as one picture, with a plain note.
 */
import { describeAffinityError, isAffinitySignature } from '@lolly-tools/node-shell/affinity';
import { mapAffinityDocument, type AffinityFrame, type AffinityImage, type AffinityNote } from '../../../../engine/src/design-map-affinity.ts';
import type { DesignMapOptions } from '../../../../engine/src/design-map.ts';
import type { AffinityRead } from '../bridge/affinity-protocol.ts';
import type { PickerHost } from './picker.ts';

/** True for an Affinity container, by its signature or by the file name when the bytes are not at hand. */
export function isAffinity(buf: Uint8Array, name?: unknown): boolean {
  if (buf.length >= 16 && isAffinitySignature(buf)) return true;
  return typeof name === 'string' && /\.(af|afdesign|afphoto|afpub|aftemplate)$/i.test(name.trim());
}

const MAX_NOTES_SHOWN = 30;
export const AFFINITY_PREVIEW_NOTE = 'This is Affinity’s own preview picture of the document. The layers are not yet editable here.';
const AFFINITY_EDITABLE_NOTE = 'This Affinity file was read on your device. Layers, shapes and text are editable; the notes below list what was approximated or left out. Check the result against your original.';

export interface AffinityImportFrame { name: string; width: number; height: number; boxes: unknown[]; background: string }
export interface AffinityImportResult { frames: AffinityImportFrame[]; mode: 'layers' | 'preview'; read: AffinityRead; notes: AffinityNote[] }

const KIND_LABEL: Record<AffinityNote['kind'], string> = {
  effect: 'Effect not imported', adjustment: 'Adjustment not imported', approximated: 'Approximated', dropped: 'Left out', reader: 'Reader note',
};

/** The preview as one picture the size of the document, or null when the file has no usable preview. */
async function previewFrame(read: AffinityRead, host: PickerHost | undefined, name: string, warn: (m: string) => void): Promise<AffinityImportFrame | null> {
  const { preview, document: doc } = read.inspection;
  if (!preview || !host) return null;
  const { storeUserUpload } = await import('./picker.ts');
  const ref = await storeUserUpload(host, new File([preview.png as BlobPart], `${name.replace(/\.[^.]+$/, '') || 'affinity'}-preview.png`, { type: 'image/png' }), { batch: true });
  if (!ref) return null;
  const aspect = preview.width / preview.height;
  const width = doc && doc.width >= 1 ? Math.round(doc.width) : preview.width;
  const height = doc && doc.height >= 1 ? Math.round(doc.height) : Math.round(width / aspect);
  warn(AFFINITY_PREVIEW_NOTE);
  const box = {
    id: 'af-preview', kind: 'image', x: 0, y: 0, w: width, h: height, rot: 0, shape: 'rect', radius: 0, bg: '', grad: '', opacity: 100, image: ref, fit: 'fill',
    blend: 'normal', text: '', fg: '#000000', fontSize: 16, align: 'left', valign: 'middle', weight: '400', font: 'sans', lineHeight: 1.2, group: '', clip: '', pad: 0,
    shadow: 'none', shadowColor: '#00000055', shadowX: 0, shadowY: 0, shadowBlur: 10, blur: 0, stroke: '', strokeW: 0, strokeDash: '', strokeDashLen: 0, strokeGapLen: 0, bgBlur: 0,
    name: 'Affinity preview',
  };
  return { name: name.replace(/\.[^.]+$/, '') || 'Affinity preview', width, height, boxes: [box], background: '#ffffff' };
}

/**
 * Read an Affinity file and build Design frames. Stage 2 gives editable layers; if it cannot, stage 1
 * places the preview. Throws, in plain words, when neither works.
 */
export async function importAffinity(
  buf: Uint8Array,
  file: File | Blob,
  { host, warn, map, signal, read: readFile }: {
    host?: PickerHost; warn: (msg: string) => void; map?: DesignMapOptions; signal?: AbortSignal;
    /** The reader, for tests; the shell reads on a worker. */
    read?: (bytes: Uint8Array, name: string, signal?: AbortSignal) => Promise<AffinityRead>;
  },
): Promise<AffinityImportResult> {
  if (!isAffinitySignature(buf)) {
    throw new Error('This file isn’t an Affinity document that Lolly can read. Affinity files from versions 1 to 3 open here; otherwise export SVG or PDF from Affinity.');
  }
  const name = String((file as File).name || 'document.af');
  warn('Reading the Affinity file on your device…');
  const reader = readFile ?? (await import('../bridge/affinity.ts')).readAffinityOffThread;
  let read: AffinityRead;
  try { read = await reader(buf, name, signal); }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(describeAffinityError(error));
  }
  const fallback = async (reason: string): Promise<AffinityImportResult> => {
    const frame = await previewFrame(read, host, name, warn);
    if (!frame) throw new Error(`This Affinity file could not be opened as layers (${reason}) and has no preview picture. Export SVG or PDF from Affinity instead.`);
    warn(`Layers could not be imported: ${reason}`);
    return { frames: [frame], mode: 'preview', read, notes: [] };
  };
  if (!read.model || !read.payload) return fallback(read.modelError ?? 'the document model could not be read');
  const { model, payload } = read;
  const refs = new Map<number, unknown>();
  let uploads: typeof import('./picker.ts').storeUserUpload | null = null;
  try {
    const result = await mapAffinityDocument(model, {
      map,
      image: async (img: AffinityImage) => {
        if (!host || !img.data) return null;
        if (refs.has(img.data.o)) return refs.get(img.data.o)!;
        uploads ??= (await import('./picker.ts')).storeUserUpload;
        const bytes = payload.slice(img.data.o, img.data.o + img.data.l);
        const mime = img.enc === 'jpeg' ? 'image/jpeg' : 'image/png';
        const ref = await uploads(host, new File([bytes as BlobPart], `affinity-${refs.size + 1}.${img.enc === 'jpeg' ? 'jpg' : 'png'}`, { type: mime }), { batch: true });
        refs.set(img.data.o, ref);
        return ref;
      },
    });
    warn(AFFINITY_EDITABLE_NOTE);
    for (const n of result.report.slice(0, MAX_NOTES_SHOWN)) warn(`${KIND_LABEL[n.kind]}: ${n.text}`);
    if (result.report.length > MAX_NOTES_SHOWN) warn(`${result.report.length - MAX_NOTES_SHOWN} more notes were left out.`);
    const frames: AffinityImportFrame[] = result.frames.map((f: AffinityFrame) => ({ name: f.name, width: f.width, height: f.height, boxes: f.boxes, background: f.background || '#ffffff' }));
    return { frames, mode: 'layers', read, notes: result.report };
  } catch (error) {
    if (signal?.aborted) throw error;
    return fallback(error instanceof Error ? error.message : String(error));
  }
}
