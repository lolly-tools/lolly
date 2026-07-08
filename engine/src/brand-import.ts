// SPDX-License-Identifier: MPL-2.0
/**
 * Brand token ingestion — container extraction for the three shapes Penpot
 * (and Tokens Studio) export the SAME token document in:
 *
 *   1. Monolithic `tokens.json` — the whole Tokens-Studio/DTCG doc in one file
 *      (`coerceTokensDoc`).
 *   2. One-file-per-set — `$metadata.json` + `$themes.json` at the root, every
 *      other `<set name>.json` where a `/` in the set name is a real
 *      subdirectory (`Color theme/Muted` → `Color theme/Muted.json`), file
 *      content = the unwrapped set body (`assembleTokenSetFiles`).
 *   3. A `.penpot` project zip — `manifest.json` lists files, each file's token
 *      doc (shape 1) lives at `files/<id>/tokens.json` (`extractPenpotProject`).
 *
 * Each helper reassembles its container back into the single document shape
 * `tokens.ts` `createTokenSet` already consumes (top-level sets + `$themes` +
 * `$metadata.tokenSetOrder`, `{dotted.path}` aliases, `$type` inheritance) —
 * this module owns *containers only*, never token semantics.
 *
 * PURE and platform-agnostic like the rest of the engine: no node:fs/node:path,
 * no DOM, no network. All IO stays in the caller — `assembleTokenSetFiles`
 * takes already-parsed JSON and `extractPenpotProject` takes already-unzipped
 * path→bytes entries (fflate's `unzipSync` shape), mirroring how design-map.ts
 * takes pre-parsed design JSON. Extraction never throws on bad input; problems
 * accumulate in `warnings` and the worst case is `doc: null`.
 *
 * Deliberate v1 non-goals:
 *   - No math-expression evaluation: a Tokens-Studio value like
 *     `"{scale.base}*1.5"` passes through untouched (it is not a whole-value
 *     alias, so createTokenSet keeps it verbatim).
 *   - No plural→canonical `$type` remapping (`colors`→`color` etc.);
 *     createTokenSet consumes the doc as-is and `.colors()` only needs
 *     resolvable `color` tokens.
 *   - No zip inflation — the shell/script that has the archive inflates it.
 */

import { createTokenSet } from './tokens.ts';

type UnknownRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The result of pulling a token document out of one of the three containers. */
export interface TokensExtraction {
  /** Reassembled Tokens-Studio/DTCG document, or null when nothing usable was found. */
  doc: Record<string, unknown> | null;
  /** Per-entry parse failures, set collisions, missing tokens.json, … — never fatal. */
  warnings: string[];
  /** Which container shape produced the document. */
  source: 'dtcg' | 'tokens-studio' | 'token-set-files' | 'penpot-project';
}

// Key-order-insensitive equality for "same set exported twice?" checks — JSON
// from different files may serialise identical bodies with different key order,
// and a false "differs" warning is worse than the O(n log n) sort.
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (isRecord(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'undefined';
}

/**
 * Classify an already-parsed monolithic token document (container shape 1).
 * `source` is 'tokens-studio' when the doc carries `$themes`/`$metadata`
 * (top-level keys are sets), plain 'dtcg' otherwise (one implicit set).
 * Anything but a plain object → `doc: null` with a warning.
 */
export function coerceTokensDoc(json: unknown): TokensExtraction {
  if (!isRecord(json)) {
    return {
      doc: null,
      warnings: [`tokens document is ${json === null ? 'null' : Array.isArray(json) ? 'an array' : `a ${typeof json}`}, expected an object`],
      source: 'dtcg',
    };
  }
  const studio = '$themes' in json || '$metadata' in json;
  return { doc: json, warnings: [], source: studio ? 'tokens-studio' : 'dtcg' };
}

/**
 * Reassemble a one-file-per-set export (container shape 2) into one document.
 *
 * @param files POSIX relative path → already-parsed JSON (caller does the IO).
 *   `$metadata.json` / `$themes.json` (root only) become `$metadata` / `$themes`;
 *   every other `*.json` becomes the set named by its path minus `.json` —
 *   subdirectories are part of the set name (`Color theme/Muted.json` → set
 *   `Color theme/Muted`). Non-.json keys and malformed bodies are skipped with
 *   a warning. Set ordering is irrelevant here: layering order comes from
 *   `$metadata.tokenSetOrder`, not object key order.
 */
export function assembleTokenSetFiles(files: Record<string, unknown>): TokensExtraction {
  const warnings: string[] = [];
  // Null-prototype accumulator: a set legitimately named "__proto__" (its file
  // is attacker-/user-controlled) must become an own key, not a prototype swap.
  const doc: UnknownRecord = Object.create(null);
  let setCount = 0;
  for (const [path, body] of Object.entries(files)) {
    if (path === '$metadata.json') {
      if (isRecord(body)) doc.$metadata = body;
      else warnings.push(`$metadata.json is not an object — ignored`);
      continue;
    }
    if (path === '$themes.json') {
      if (Array.isArray(body)) doc.$themes = body;
      else warnings.push(`$themes.json is not an array — ignored`);
      continue;
    }
    if (!path.endsWith('.json')) {
      warnings.push(`${path}: not a .json file — ignored`);
      continue;
    }
    if (!isRecord(body)) {
      warnings.push(`${path}: set body is not an object — ignored`);
      continue;
    }
    doc[path.slice(0, -'.json'.length)] = body;
    setCount++;
  }
  // $themes/$metadata alone carry no tokens; a doc without a single set is unusable.
  if (!setCount) {
    warnings.push('no token set files found');
    return { doc: null, warnings, source: 'token-set-files' };
  }
  return { doc, warnings, source: 'token-set-files' };
}

const decoder = /* lazily shared; TextDecoder is a web+node global */ new TextDecoder();
const asText = (v: Uint8Array | string): string => (typeof v === 'string' ? v : decoder.decode(v));

function parseEntry(entries: Record<string, Uint8Array | string>, path: string, warnings: string[]): unknown {
  const raw = entries[path];
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(asText(raw));
  } catch (e) {
    warnings.push(`${path}: ${e instanceof Error ? e.message : 'unparseable JSON'}`);
    return undefined;
  }
}

/**
 * Extract and merge every token document from an unzipped `.penpot` project
 * (container shape 3).
 *
 * @param entries archive path → bytes (fflate's `unzipSync` shape) or → string.
 *   The zip is inflated by the CALLER; this stays IO-free.
 *
 * `manifest.json` (`{type:'penpot/export-files', files:[{id,…}]}`) fixes which
 * token docs exist and their order: `files/<id>/tokens.json` per entry. A
 * missing/unparseable manifest is a warning, then we fall back to scanning for
 * any `files/*\/tokens.json` (sorted, for determinism).
 *
 * Merge semantics when several files carry tokens: later file wins per
 * top-level set key, with a warning when a colliding set's body actually
 * differs (key-order-insensitive compare — identical re-exports stay silent).
 * `$themes`/`$metadata` come from the FIRST doc carrying a MEANINGFUL one —
 * themes name sets by key, and first-wins keeps them pointing at the doc that
 * defined those keys first. Presence isn't usefulness: Penpot writes an empty
 * `$themes: []` alongside real sets, and an empty first block must not shadow
 * a later file's real themes. Conflicting meaningful blocks warn (dropped).
 */
export function extractPenpotProject(entries: Record<string, Uint8Array | string>): TokensExtraction {
  const warnings: string[] = [];

  // Resolve the ordered list of per-file token doc paths.
  let tokenPaths: string[] = [];
  const manifest = parseEntry(entries, 'manifest.json', warnings);
  const manifestFiles = isRecord(manifest) && Array.isArray(manifest.files) ? manifest.files : null;
  if (manifestFiles) {
    for (const f of manifestFiles) {
      if (!isRecord(f) || typeof f.id !== 'string') continue;
      const p = `files/${f.id}/tokens.json`;
      if (p in entries) {
        tokenPaths.push(p);
      } else if (Array.isArray(f.features) && f.features.includes('design-tokens/v1')) {
        // Only noisy when the manifest *promised* tokens; files without the
        // feature routinely have no tokens.json and that is not a defect.
        warnings.push(`${p}: declared design-tokens/v1 but has no tokens.json`);
      }
    }
  } else {
    warnings.push(
      manifest === undefined
        ? 'manifest.json missing or unparseable — scanning for files/*/tokens.json'
        : 'manifest.json is not a penpot/export-files manifest — scanning for files/*/tokens.json',
    );
    tokenPaths = Object.keys(entries)
      .filter(p => /^files\/[^/]+\/tokens\.json$/.test(p))
      .sort();
  }

  // Merge the docs in order. Sets: last writer wins. $themes/$metadata: first wins.
  let doc: UnknownRecord | null = null;
  for (const path of tokenPaths) {
    const parsed = parseEntry(entries, path, warnings);
    if (parsed === undefined) continue;
    if (!isRecord(parsed)) {
      warnings.push(`${path}: token document is not an object — ignored`);
      continue;
    }
    if (!doc) {
      // Null-prototype (see assembleTokenSetFiles): a "__proto__" set key from
      // a later file must merge as an own key, never mutate the prototype.
      doc = Object.assign(Object.create(null) as UnknownRecord, parsed);
      continue;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (key === '$themes' || key === '$metadata') {
        // First MEANINGFUL block wins — an empty `$themes: []` / `$metadata: {}`
        // (Penpot writes these alongside real sets) counts as absent.
        const meaningful = (v: unknown) =>
          key === '$themes' ? Array.isArray(v) && v.length > 0 : isRecord(v) && Object.keys(v).length > 0;
        if (!meaningful(doc[key])) doc[key] = value;
        else if (meaningful(value) && stableStringify(doc[key]) !== stableStringify(value)) {
          warnings.push(`${path}: ${key} differs from an earlier file's — keeping the first`);
        }
        continue;
      }
      if (Object.hasOwn(doc, key) && stableStringify(doc[key]) !== stableStringify(value)) {
        warnings.push(`${path}: set "${key}" collides with an earlier file's — later file wins`);
      }
      doc[key] = value;
    }
  }

  if (!doc) {
    warnings.push('no tokens.json found in the project');
    return { doc: null, warnings, source: 'penpot-project' };
  }
  return { doc, warnings, source: 'penpot-project' };
}

/**
 * Cheap import-preview stats for a reassembled document — what a shell shows
 * before the user commits ("14 sets · 4 themes · 391 tokens, 120 colours").
 *
 * `sets` lists top-level non-$ keys only when the doc carries a non-empty
 * `$themes` (the Tokens-Studio layered shape — mirrors createTokenSet's set
 * detection); a plain DTCG doc is one implicit set → `[]`. Counts come from
 * `createTokenSet(doc)` unthemed, so they reflect the default theme's active
 * layering, exactly what an import would resolve.
 */
export function summarizeTokensDoc(doc: unknown): {
  sets: string[];
  themes: { name: string; group: string | null }[];
  tokenCount: number;
  colorCount: number;
} {
  const layered = isRecord(doc) && Array.isArray(doc.$themes) && doc.$themes.length > 0;
  const sets = layered ? Object.keys(doc as UnknownRecord).filter(k => !k.startsWith('$')) : [];
  const ts = createTokenSet(doc);
  return { sets, themes: ts.themes(), tokenCount: ts.size, colorCount: ts.colors().length };
}
