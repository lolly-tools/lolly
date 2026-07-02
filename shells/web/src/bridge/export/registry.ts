// SPDX-License-Identifier: MPL-2.0
/**
 * Format-adapter registry (finding 2).
 *
 * Replaces the giant `switch (format)` in bridge/export.js: each adapter
 * registers the formats it handles, and `resolve` maps a requested format back
 * to its adapter. An unknown format raises a typed error whose message matches
 * the switch's old `default` case, so behaviour is preserved.
 */

import type { ExportFormat, FormatAdapter } from './types.ts';

/** Thrown by `resolve` for a format no adapter registered. */
export class UnknownExportFormatError extends Error {
  readonly format: string;
  constructor(format: string) {
    super(`Unsupported export format: ${format}`);
    this.name = 'UnknownExportFormatError';
    this.format = format;
  }
}

export interface ExportRegistry {
  /** Register an adapter for every format it declares. Throws on a duplicate. */
  register(adapter: FormatAdapter): void;
  /** Resolve a format to its adapter, or throw UnknownExportFormatError. */
  resolve(format: ExportFormat | string): FormatAdapter;
}

export function createRegistry(): ExportRegistry {
  const byFormat = new Map<string, FormatAdapter>();
  return {
    register(adapter) {
      for (const f of adapter.formats) {
        if (byFormat.has(f)) throw new Error(`Duplicate export adapter for format: ${f}`);
        byFormat.set(f, adapter);
      }
    },
    resolve(format) {
      const adapter = byFormat.get(format);
      if (!adapter) throw new UnknownExportFormatError(String(format));
      return adapter;
    },
  };
}
