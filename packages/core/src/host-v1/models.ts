// SPDX-License-Identifier: MPL-2.0

// ─── Model files a tool may read (optional, v1.246) ────────────────────────────

/** Progress of whatever is moving for one `files` call: a download first when the
 *  family is not on the device yet, then the read of the named files. */
export interface ModelFilesProgress {
  loaded: number;
  total: number;
}

export interface ModelFilesOpts {
  /**
   * What needs the files, as a short noun phrase the shell may show in its
   * download offer ("singing in this song"). Plain text, shortened by the shell
   * when long.
   */
  reason?: string;
  onProgress?: (p: ModelFilesProgress) => void;
  /** Rejects the call with an `AbortError` between steps. */
  signal?: AbortSignal;
}

/**
 * The bytes of named files of an on-device model family, for a tool that runs a
 * model in a context of its own and so cannot reach the shell's model store: the
 * Rondocode utility's editor frame has an opaque origin, with no IndexedDB and no
 * network of its own (plan 301 phase F).
 *
 * The shell decides everything about the download. When a named file is not on
 * the device, the shell offers the family's download in place first, with its
 * size and licence facts, and only a person's yes moves any bytes. A family the
 * shell does not let tools read, or a path that is not one of the family's files,
 * is refused by name (the promise rejects); a person who declines, or an AI policy
 * that forbids the family, resolves `null`. Bytes come back as whole buffers, one
 * `Uint8Array` per requested path, each the only view of its own `ArrayBuffer`, so
 * a caller can transfer `bytes.buffer` to a frame without copying.
 *
 * Optional/additive and NOT gated by a `capabilities` flag: feature-detect
 * `host.models`. The web and desktop shells provide it; the Node shells do not.
 * Runs locally; nothing the tool sends leaves the device.
 */
export interface ModelsAPI {
  /**
   * The bytes of `paths` in model family `family`, keyed by each path as given.
   * Only `sing` is readable today: rondocode's singing models, by their path under
   * the family (`rondocode/vec-768.onnx`, `supertonic/onnx/tts.json`), plus
   * `runtime/<file>` for the onnxruntime-web WebAssembly binary the shell itself
   * runs (`runtime/ort-wasm-simd-threaded.jsep.wasm`).
   */
  files(family: string, paths: string[], opts?: ModelFilesOpts): Promise<Record<string, Uint8Array> | null>;
}
