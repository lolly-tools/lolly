// SPDX-License-Identifier: MPL-2.0
/**
 * Plain Markdown for the Lolly Work console.
 *
 * The console reads its packaged guides (`/admin#/docs`) with a deliberately small renderer:
 * headings, fenced code, pipe tables, lists, block quotes, rules, images and paragraphs, built
 * as DOM nodes with no Markdown library (lolly-work console/app.js, mdToNodes). It has no
 * `:::` fences, no provenance pills and no HTML comments, so each would reach the reader as
 * literal text. scripts/export-work-docs.ts runs every bundled guide through
 * lowerForConsole, so lolly-work's scripts/sync-docs-bundle.ts writes (and its --check
 * verifies) a bundle the console can show:
 *
 *   ::: note|warning|check Title   → **Note: Title** (Warning, Check), then the body
 *   ::: details Title              → **Title**, then the body (nothing to open or close)
 *   ::: figure <id>                → a link titled from the caption's first sentence, to the
 *                                    signed figure on lolly.tools, then the rest of the caption
 *   ::: cols, ::: timeline, ::: showcase and any other fence
 *                                  → the body alone; `## ` sections inside cols stack
 *   %work{…} %download{…}          → the version (docs/version-tokens.ts)
 *   %entity{x} and the other pills → x
 *   <!-- comments --> and the <!--l:…--> style content tokens → removed
 *
 * Code blocks pass through untouched apart from version tokens, which expand there too: a
 * `helm install --version` line is exactly where a stale version hurts. Pure: the figure
 * address and the versions come in as arguments.
 */
import { stripAuthoringComments, unwrapProvenanceMarkers } from '../packages/docs-render/src/index.ts';
import { expandVersionTokens, type VersionFacts } from './version-tokens.ts';

export interface ConsoleLoweringOptions {
  facts: VersionFacts;
  /** The public address of a banked figure, or null when the bank has no such id. */
  figureUrl(id: string): string | null;
  /** The source file a version-token error points at. */
  where?: string;
}

const KIND_WORD: Record<string, string> = { note: 'Note', warning: 'Warning', check: 'Check' };
const CODE_FENCE = /^\s*(```|~~~)/;
/** The render-only HTML comments stripAuthoringComments keeps for the site renderer, with the
 *  one space that separates a bullet icon or a plate from the following words. */
const CONTENT_TOKENS = /<!--(?:i:[a-z-]+|l:[a-z0-9-]+|g:(?:light|dark|brand))-->[ \t]?/g;
const LOGO_BLOCK = /^\s*<!--lb:[a-z0-9 -]+-->\s*$/;

export function lowerForConsole(md: string, opts: ConsoleLoweringOptions): string {
  const expanded = expandVersionTokens(md, opts.facts, opts.where);
  const lowered = lowerFences(stripAuthoringComments(expanded).split('\n'), opts).join('\n');
  return mapOutsideCode(lowered, line => (LOGO_BLOCK.test(line) ? null : unwrapProvenanceMarkers(line.replace(CONTENT_TOKENS, ''))));
}

/** Applies `fn` to each line outside code blocks; a null result drops the line. */
function mapOutsideCode(md: string, fn: (line: string) => string | null): string {
  let inCode = false;
  const out: string[] = [];
  for (const line of md.split('\n')) {
    if (CODE_FENCE.test(line)) { inCode = !inCode; out.push(line); continue; }
    if (inCode) { out.push(line); continue; }
    const next = fn(line);
    if (next !== null) out.push(next);
  }
  return out.join('\n');
}

function lowerFences(lines: string[], opts: ConsoleLoweringOptions): string[] {
  const out: string[] = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (CODE_FENCE.test(line)) { inCode = !inCode; out.push(line); continue; }
    const t = line.trim();
    if (inCode || !t.startsWith(':::') || t === ':::') { out.push(line); continue; }
    // Collect the body up to the matching close, counting nested fences and skipping code.
    const label = t.slice(3).trim();
    const body: string[] = [];
    let depth = 1;
    let bodyCode = false;
    for (i++; i < lines.length; i++) {
      const inner = lines[i]!;
      if (CODE_FENCE.test(inner)) bodyCode = !bodyCode;
      else if (!bodyCode) {
        const it = inner.trim();
        if (it === ':::') { if (--depth === 0) break; }
        else if (it.startsWith(':::')) depth++;
      }
      body.push(inner);
    }
    const block = lowerBlock(label, lowerFences(body, opts), opts);
    // The console joins consecutive lines into one paragraph, so the lowered block needs a
    // blank line on each side to stay a block of its own.
    if (out.length && out[out.length - 1]!.trim()) out.push('');
    out.push(...block);
    if (i + 1 < lines.length && lines[i + 1]!.trim()) out.push('');
  }
  return out;
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a]!.trim()) a++;
  while (b > a && !lines[b - 1]!.trim()) b--;
  return lines.slice(a, b);
}

function lowerBlock(label: string, body: string[], opts: ConsoleLoweringOptions): string[] {
  const inner = trimBlank(body);
  const component = /^(note|warning|check|details)\s+(.+)$/.exec(label);
  if (component) {
    const word = KIND_WORD[component[1]!];
    const title = component[2]!.trim();
    return [word ? `**${word}: ${title}**` : `**${title}**`, ...(inner.length ? ['', ...inner] : [])];
  }
  const figure = /^figure\s+(\S+)$/.exec(label);
  if (figure) return lowerFigure(figure[1]!, inner.join('\n'), opts);
  return inner;
}

function lowerFigure(id: string, caption: string, opts: ConsoleLoweringOptions): string[] {
  const url = opts.figureUrl(id);
  const { first, rest } = splitFirstSentence(caption.trim());
  // No banked figure: the site renders nothing for it either, so keep only the prose.
  if (!url) return caption.trim() ? caption.trim().split('\n') : [];
  const title = plainInline(first).replace(/[.!?]$/, '') || 'Open the figure';
  return [`[Figure: ${title}](${url})`, ...(rest ? ['', ...rest.split('\n')] : [])];
}

/**
 * The first sentence of a caption, and the rest of the caption. A full stop inside a link, a
 * code span or brackets does not end the sentence.
 */
export function splitFirstSentence(text: string): { first: string; rest: string } {
  let depth = 0;
  let code = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '`') code = !code;
    if (code) continue;
    if (c === '[' || c === '(') depth++;
    else if ((c === ']' || c === ')') && depth > 0) depth--;
    else if (depth === 0 && (c === '.' || c === '!' || c === '?') && (i + 1 === text.length || /\s/.test(text[i + 1]!))) {
      return { first: text.slice(0, i + 1).trim(), rest: text.slice(i + 1).trim() };
    }
  }
  return { first: text.trim(), rest: '' };
}

/** Inline Markdown to plain words, for use as a link label. */
function plainInline(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
