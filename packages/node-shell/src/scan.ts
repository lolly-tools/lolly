// SPDX-License-Identifier: MPL-2.0
/**
 * host.scan for the Node shells (CLI + the repo-root round-trip tests) - the
 * zxing-wasm rung of plans/162 Part 2. This is the CLI's real decoder (so
 * `lolly scan photo.png` works) and the round-trip CI's decoder (so a generator
 * regression and a decoder regression are the same red test).
 *
 * zxing-cpp (Apache-2.0) compiled to WASM via zxing-wasm (MIT). The wasm binary
 * ships in node_modules; we load it from disk and pin it as `wasmBinary`, so
 * NOTHING reaches the network - the default loader would fetch it from a CDN,
 * which the on-device promise forbids. Format names are normalised to
 * BarcodeDetector naming ('qr_code', 'data_matrix', …) to match the ScanAPI
 * contract, so a tool reads identical `format` strings on web-native and here.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
import type { ScanAPI, ScanHit } from '@lolly-tools/core/host-v1';

// zxing canonical name -> BarcodeDetector naming. Only the readable families the
// qr-code generator can also write, plus the industrial 1D set.
const ZXING_TO_BD: Record<string, string> = {
  QRCode: 'qr_code',
  MicroQRCode: 'micro_qr_code',
  RMQRCode: 'rm_qr_code',
  DataMatrix: 'data_matrix',
  Aztec: 'aztec',
  PDF417: 'pdf417',
  EAN13: 'ean_13',
  EAN8: 'ean_8',
  UPCA: 'upc_a',
  UPCE: 'upc_e',
  Code39: 'code_39',
  Code93: 'code_93',
  Code128: 'code_128',
  Codabar: 'codabar',
  ITF: 'itf',
  DataBar: 'databar',
  DataBarExp: 'databar_expanded', // zxing v3 canonical name is 'DataBarExp', not 'DataBarExpanded'
  MaxiCode: 'maxi_code',
};
const ZXING_NAMES = Object.keys(ZXING_TO_BD);
const BD_NAMES = Object.values(ZXING_TO_BD);
function toBd(z: string): string { return ZXING_TO_BD[z] ?? z.toLowerCase(); }

/** True when `text` is exactly the UTF-8 decoding of `bytes` (a clean round-trip). */
function utf8RoundTrips(text: string, bytes: Uint8Array): boolean {
  const enc = new TextEncoder().encode(text);
  if (enc.length !== bytes.length) return false;
  for (let i = 0; i < enc.length; i++) if (enc[i] !== bytes[i]) return false;
  return true;
}

let prepared: Promise<void> | null = null;
function ensureModule(): Promise<void> {
  if (!prepared) {
    prepared = (async () => {
      const require = createRequire(import.meta.url);
      // The reader wasm is a real subpath export, so resolve it directly.
      const wasmPath = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
      const bytes = await readFile(wasmPath);
      // Pin the local binary so the module never fetches from a CDN.
      prepareZXingModule({ overrides: { wasmBinary: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } });
    })().catch((e) => { prepared = null; throw e; }); // don't cache a rejection - a transient failure must be retryable
  }
  return prepared;
}

/** A ScanAPI backed by zxing-wasm, for Node (CLI + tests). */
export function createNodeScanAPI(): ScanAPI {
  return {
    formats: () => BD_NAMES.slice(),
    async detect(frame, opts) {
      // Contract: never reject - "couldn't decode" is an empty array. The whole
      // body (incl. module init) is guarded so a transient wasm/init failure
      // degrades to [] instead of a rejection the caller's onFrame can't catch.
      try {
        if (!frame || !frame.width || !frame.height) return [];
        const want = opts?.formats;
        let zxFormats: string[] | undefined;
        if (want && want.length) {
          zxFormats = ZXING_NAMES.filter((z) => want.includes(toBd(z)));
          // A filter that matches nothing means "decode nothing" - NOT everything.
          // (zxing treats an empty formats array as "all", so return early.)
          if (!zxFormats.length) return [];
        }
        await ensureModule();
        const imageData = {
          data: new Uint8ClampedArray(frame.data),
          width: frame.width,
          height: frame.height,
          colorSpace: 'srgb' as const,
        };
        const results = await readBarcodes(imageData as ImageData, {
          formats: (zxFormats ?? []) as never,
          tryHarder: true,
          maxNumberOfSymbols: 20,
        });
        const hits: ScanHit[] = [];
        for (const r of results) {
          if (!r.format || r.format === 'None') continue;
          const p = r.position;
          const corners = p
            ? ([[p.topLeft.x, p.topLeft.y], [p.topRight.x, p.topRight.y],
                [p.bottomRight.x, p.bottomRight.y], [p.bottomLeft.x, p.bottomLeft.y]] as [number, number][])
            : undefined;
          const text = r.text ?? '';
          const bytes = r.bytes instanceof Uint8Array ? r.bytes : undefined;
          hits.push({
            format: toBd(r.format),
            rawValue: text,
            // Carry raw bytes whenever the text is NOT a clean UTF-8 round-trip of
            // them (binary payloads), not on a fragile replacement-char guess.
            rawBytes: bytes && !utf8RoundTrips(text, bytes) ? bytes : undefined,
            corners,
          });
        }
        return hits;
      } catch {
        return [];
      }
    },
  };
}
