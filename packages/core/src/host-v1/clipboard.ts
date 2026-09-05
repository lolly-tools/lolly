// SPDX-License-Identifier: MPL-2.0

// ─── Clipboard ──────────────────────────────────────────────────────────────

export interface ClipboardAPI {
  writeText(text: string): Promise<void>;
  /** Writes an image to clipboard if the platform supports it; otherwise falls back to download. */
  writeImage(blob: Blob): Promise<{ method: 'clipboard' | 'download' }>;
}
