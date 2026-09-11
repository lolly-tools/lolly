// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog access for the TUI - reads the same on-disk registry the CLI does
 * (`catalog/tools/index.json`) and provides the tool-file fetcher `loadTool`
 * needs. No engine coupling: this is pure Node fs, mirroring shells/cli.
 */
import { readFile } from 'node:fs/promises';
import { catalogFile, readToolText } from '@lolly-tools/node-shell/content-roots';

/** A denormalised tool row as the generated catalog index carries it. */
export interface ToolEntry {
  id: string;
  name: string;
  description?: string;
  status?: string;
  category?: string;
  icon?: string;
  formats?: string[];
  capabilities?: string[];
  width?: number;
  height?: number;
  unit?: string;
  exportable?: boolean;
  /** Derived from hooks.exportFile + a file input by the catalog builder. */
  fileTransform?: boolean;
}

// The content resolver (@lolly-tools/node-shell/content-roots) is the ONE place that
// answers where a tool or a catalog file lives, for the CLI and the TUI alike: it picks
// the profile, composes brand overlays, and reads a packaged materialized root the same
// way it reads a checkout. This file used to join 'catalog' and 'tools' onto repoRoot(),
// which worked only while those two repo-root symlink views existed (plan 244 removed
// them). The TUI and the CLI must resolve content identically, so both go through here.

/** All tools from the generated registry, in catalog order. */
export async function loadTools(): Promise<ToolEntry[]> {
  const idx = JSON.parse(await readFile(catalogFile('tools/index.json'), 'utf8')) as { tools?: ToolEntry[] };
  return idx.tools ?? [];
}

/** The `fetchFile` the engine's `loadTool` calls to read a tool's files from disk. */
export function toolFetchFile(): (path: string) => Promise<string> {
  return readToolText;
}

/** One catalog asset row as the generated asset registry carries it. */
export interface AssetRow {
  id: string;
  name: string;
  description?: string;
  type?: string;                 // vector | raster | lottie | audio | palette | tokens
  tier?: string;
  tags?: string[];
  formats?: Array<{ format: string; url: string; size?: number }>;
}

/** All catalog assets, in registry order (mirrors the web catalog view's source). */
export async function loadAssets(): Promise<AssetRow[]> {
  const idx = JSON.parse(await readFile(catalogFile('assets/index.json'), 'utf8')) as { assets?: AssetRow[] };
  return idx.assets ?? [];
}
