// SPDX-License-Identifier: MPL-2.0
/**
 * Seeds and calls for the lolly-render fuzz targets (declared in targets.ts): mutated
 * bytes sent through the Node binding (packages/node-shell/src/lolly-render.ts) into the
 * crate's envelope reader and each picture decoder.
 *
 * Contract: every input comes back as a value, drawn or refused with a listed code. A
 * caught panic comes back as the `internal` refusal, which is thrown here as a
 * WebAssembly.RuntimeError so the discovery runner classifies it as a crash, as it does
 * a trapped WASM parser. A page is read for every input and drawn only while it is at
 * most 2^20 pixels, so the runs stay fast; the crate's own tests draw larger pages.
 *
 * The binding is native and built with cargo, so a machine without it skips these
 * targets by name (`lollyRenderUnavailable`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { lollyRenderBinding, type LollyRenderBinding, type RawResult } from '../../packages/node-shell/src/lolly-render.ts';

const CRATE = new URL('../../crates/lolly-render/', import.meta.url);

/** The skip reason when the binding is not here, as fixed text for the expected-skips list. */
export const LOLLY_RENDER_NOT_BUILT = 'the lolly-render Node addon is not built here: run `cargo build --release` in crates/lolly-render-node (or set LOLLY_RENDER_ADDON)';

export function lollyRenderUnavailable(): string | null {
  return lollyRenderBinding() ? null : LOLLY_RENDER_NOT_BUILT;
}

const MAX_DRAWN_PIXELS = 1 << 20;

function binding(): LollyRenderBinding {
  const found = lollyRenderBinding();
  if (!found) throw new Error(LOLLY_RENDER_NOT_BUILT);
  return found;
}

function settle(result: RawResult, codes: ReadonlySet<string>): void {
  if (result.ok) return;
  if (result.code === 'internal') throw new WebAssembly.RuntimeError(`lolly-render stopped on an internal error: ${result.detail}`);
  for (const r of result.refusals ?? []) if (!codes.has(r.code)) throw new WebAssembly.RuntimeError(`lolly-render refused with an unlisted code: ${r.code}`);
}

/** Read one envelope, and draw it when it is admitted and small. */
export function invokeLollyRenderEnvelope(bytes: Uint8Array): void {
  const api = binding();
  const codes = new Set(api.refusalCodes());
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const admitted = api.admit(input);
  settle(admitted, codes);
  if (!admitted.ok || (admitted.width ?? 0) * (admitted.height ?? 0) > MAX_DRAWN_PIXELS) return;
  const drawn = api.renderPng(input);
  settle(drawn, codes);
  if (drawn.ok && !(drawn.png instanceof Uint8Array && drawn.png[1] === 0x50)) throw new WebAssembly.RuntimeError('lolly-render drew a page and returned no PNG');
}

/** The core crate's fixtures, drawn at a quarter of their size so each mutation is quick. */
export async function lollyRenderEnvelopeSeeds(): Promise<Uint8Array[]> {
  const dir = new URL('tests/fixtures/', CRATE);
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((file) => {
    const envelope = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { output: { width: number; height: number } };
    envelope.output = { ...envelope.output, width: envelope.output.width / 4, height: envelope.output.height / 4 };
    return new TextEncoder().encode(JSON.stringify(envelope));
  });
}

/** The page each picture is placed on: one picture filling most of a 64 x 48 frame. */
export function lollyRenderPicturePage(picture: Uint8Array, type: string): string {
  const rect = { kind: 'rect', radius: 0 };
  const area = { x: 4, y: 4, w: 56, h: 40 };
  return JSON.stringify({
    format: 'lolly-render-input', version: 1, drawVersion: 0,
    output: { width: 64, height: 48, dpi: 96 },
    page: {
      version: 0, width: 64, height: 48, background: '#ffffff', findings: [],
      frame: { id: 'f', box: { x: 0, y: 0, w: 64, h: 48 }, opacity: 100, op: 'shape', shape: rect, fills: [{ kind: 'color', color: '#ffffff' }] },
      ops: [{
        id: 'pic', box: area, opacity: 100, op: 'shape', shape: rect, fills: [],
        picture: { ref: 'p', fit: 'cover', x: 50, y: 50, zoom: 1, area, element: { box: area, shape: rect }, clip: { box: area, shape: rect }, label: 'Picture not available here', natural: { width: 16, height: 12 } },
      }],
    },
    resources: [{ ref: 'p', type, data: Buffer.from(picture).toString('base64') }],
  });
}

/** The 16 x 12 seed pictures of one kind (crates/lolly-render/tests/seeds). */
export function lollyRenderPictureSeeds(kind: 'png' | 'jpeg' | 'webp'): () => Promise<Uint8Array[]> {
  const match = { png: /\.png$/, jpeg: /\.jpg$/, webp: /\.webp$/ }[kind];
  return async () => {
    const dir = new URL('tests/seeds/', CRATE);
    return readdirSync(dir).filter((f) => match.test(f)).sort().map((f) => new Uint8Array(readFileSync(new URL(f, dir))));
  };
}

/** One mutated picture through the decoder that reads its kind, placed on the page and drawn. */
export function invokeLollyRenderPicture(kind: 'png' | 'jpeg' | 'webp'): (bytes: Uint8Array) => Promise<void> {
  const type = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[kind];
  return async (bytes) => {
    const api = binding();
    settle(api.renderPng(lollyRenderPicturePage(bytes, type)), new Set(api.refusalCodes()));
  };
}
