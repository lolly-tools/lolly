// SPDX-License-Identifier: MPL-2.0
/**
 * The words a token document says about itself, read through the scope hints.
 *
 * A description in a token document becomes the design system's own words, and the design
 * brief hands those words to agents. `leaveOutScopedTokenText` takes out each description
 * the scope hints flag, along with a flagged name or rule label from the vendor extension.
 *
 * It runs twice, for different documents. The import functions in `brand-import.ts` call it
 * so a file's flagged text never joins the stored document. `designBrief`, `writeDesignMd`
 * and `buildBrandPage` call it on what they read, because a document saved before this
 * existed, or text a person typed in the studio, never passed an import. The studio's own
 * saves do not call it, so a person's words stay in their document. They stay out of what an
 * agent is handed, and `leftOut` says where without repeating the text.
 *
 * Scope hints are a line-by-line lint: a description written another way still arrives, and
 * so do token names and values.
 */
import { brandSkillScopeHints } from './brand-skill.ts';
import { TOKEN_EXT } from './token-ext.ts';

/** One piece of text left out of a token document: its place and the hint behind the decision. Never the words. */
export interface TokenTextLeftOutV1 {
  /** Dotted path of the group, token or record that held the text. Empty for the document root. */
  path: string;
  field: string;
  code: string;
}

export interface ScopedTokenTextV1 {
  /** The document itself when nothing was flagged, otherwise a copy. The input is never changed. */
  doc: unknown;
  leftOut: TokenTextLeftOutV1[];
}

type Row = Record<string, unknown>;

/** Deeper than any import admits, so only a hand-made document reaches this, and its deep rows stay out. */
const MAX_DEPTH = 128;

const hintOf = (text: string): string | null => brandSkillScopeHints(text)[0]?.code ?? null;

/** Own properties only, defined rather than assigned: a key spelled `__proto__` stays a key. */
function putOwn(row: Row, key: string, value: unknown): void {
  Object.defineProperty(row, key, { value, enumerable: true, writable: true, configurable: true });
}

function copyOf(row: Row): Row {
  const copy = Object.create(Object.getPrototypeOf(row)) as Row;
  for (const key of Object.keys(row)) putOwn(copy, key, row[key]);
  return copy;
}

/** The vendor extension, whose `name` and `label` fields are words about the system and not token paths. */
function inVendorExtension(path: readonly string[]): boolean {
  return path[0] === '$extensions' && path[1] === TOKEN_EXT;
}

function walk(node: unknown, path: readonly string[], leftOut: TokenTextLeftOutV1[], seen: WeakSet<object>): unknown {
  if (!node || typeof node !== 'object') return node;
  if (seen.has(node)) return node;
  seen.add(node);
  if (Array.isArray(node)) {
    let list: unknown[] | null = null;
    node.forEach((item, index) => {
      const next = walk(item, [...path, String(index)], leftOut, seen);
      if (next !== item) { list ??= [...node]; list[index] = next; }
    });
    return list ?? node;
  }
  const row = node as Row;
  let copy: Row | null = null;
  const drop = (key: string, code: string): void => {
    copy ??= copyOf(row);
    delete copy[key];
    leftOut.push({ path: path.join('.'), field: key, code });
  };
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (key === '$description' && typeof value !== 'string') { drop(key, 'scope.not-text'); continue; }
    if (typeof value === 'string') {
      const words = key === '$description' || key === 'description'
        || (inVendorExtension(path) && (key === 'label' || (key === 'name' && path.length === 2)));
      const code = words ? hintOf(value) : null;
      if (!code) continue;
      if (key === 'label' && typeof row.id === 'string') {
        // A rule, role or guide group needs its label to stay valid, and its id is a label a person can read.
        copy ??= copyOf(row);
        putOwn(copy, key, row.id);
        leftOut.push({ path: path.join('.'), field: key, code });
      } else drop(key, code);
      continue;
    }
    if (path.length >= MAX_DEPTH) { if (value && typeof value === 'object') drop(key, 'scope.depth'); continue; }
    const next = walk(value, [...path, key], leftOut, seen);
    if (next !== value) {
      copy ??= copyOf(row);
      putOwn(copy, key, next);
    }
  }
  return copy ?? row;
}

/** `doc` without the text the scope hints flag, and a list of where that text was. */
export function leaveOutScopedTokenText(doc: unknown): ScopedTokenTextV1 {
  const leftOut: TokenTextLeftOutV1[] = [];
  return { doc: walk(doc, [], leftOut, new WeakSet()), leftOut };
}

/** One readable line per import, for the warnings an import already reports. */
export function scopedTokenTextWarnings(leftOut: readonly TokenTextLeftOutV1[]): string[] {
  const where = (row: TokenTextLeftOutV1): string => row.path ? `The ${row.field === 'label' || row.field === 'name' ? row.field : 'description'} on ${row.path}` : 'The description';
  if (leftOut.length > 5) return [`${leftOut.length} descriptions and labels speak about permissions or running code, so they were left out. The first is on ${leftOut[0]!.path || 'the document'}.`];
  return leftOut.map(row => `${where(row)} speaks about permissions or running code, so it was left out.`);
}
