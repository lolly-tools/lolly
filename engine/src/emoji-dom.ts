// SPDX-License-Identifier: MPL-2.0
/** Replace emoji in a rendered tree with pinned pack artwork, over a minimal node interface. */
import type { EmojiStyleV1 } from '@lolly-tools/core';
import { revertEmojiSvgText } from './emoji-svg-text.ts';
import { escapeXml } from './xml-escape.ts';
import { emojiPackPinKey } from './emoji-pack.ts';
import type { VerifiedEmojiPack } from './emoji-pack.ts';
import { emojiInlineStyle, prepareEmojiText } from './emoji-inline.ts';
import type { EmojiArtworkCache, EmojiTextIO, EmojiTextSegmentV1, PreparedEmojiText } from './emoji-inline.ts';
import { EMOJI_TEXT_MAX_UNITS } from './emoji-segment.ts';
import { EMOJI_TEXT_TRIGGER, emojiTextTrigger } from './emoji-trigger.ts';
import type { EmojiLineSource } from './emoji-line.ts';

/**
 * The slice of a node tree this pass uses, declared by shape rather than by
 * importing a browser type, so the engine names none and jsdom, a browser and
 * any other tree that answers these members all work unchanged.
 */
export interface EmojiDomDocument {
  createElement(tag: string): EmojiDomElement;
}

export interface EmojiDomNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly childNodes: ArrayLike<EmojiDomNode>;
  readonly parentNode: EmojiDomNode | null;
  readonly ownerDocument: EmojiDomDocument | null;
  textContent: string | null;
  /** A text node's characters. */
  data?: string;
  insertBefore(node: EmojiDomNode, before: EmojiDomNode | null): unknown;
  removeChild(node: EmojiDomNode): unknown;
  replaceChild(next: EmojiDomNode, previous: EmojiDomNode): unknown;
  /** Merges adjacent text nodes when the tree offers it. */
  normalize?(): void;
}

export interface EmojiDomElement extends EmojiDomNode {
  innerHTML: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

export interface EmojiDomOptions {
  /** Shared with the runtime, so each distinct artwork is prepared once. */
  cache?: EmojiArtworkCache;
  /** The host's own reasons to leave a subtree alone, such as the element a
   *  person is editing right now. Returning true skips it and its children. */
  skip?(element: EmojiDomElement): boolean;
  /**
   * The letter every placement id in this run starts with. Default `e`. A caller
   * that walks more than one root into one document gives each root its own
   * scope, so two roots cannot mint the same id. Letters, digits and underscore
   * only; anything else falls back to the default.
   */
  idScope?: string;
}

export interface EmojiDomResult {
  /** Glyphs drawn from the chosen set, counted over the finished tree. */
  replaced: number;
  /** Clusters left as the neutral placeholder. */
  unresolved: number;
  census: EmojiLineSource[];
}

const ELEMENT_NODE = 1, TEXT_NODE = 3;

export const EMOJI_SPAN_CLASS = 'lolly-emoji';
export const EMOJI_UNSET_CLASS = 'lolly-emoji--unset';
export const EMOJI_TEXT_CLASS = 'lolly-emoji-text';
/** Said after the glyph name when no artwork was drawn. */
export const EMOJI_UNSET_LABEL = ' (no emoji set chosen)';

/** The one placeholder: a rounded square with a centred dot, at 1em, in the
 *  surrounding text colour. Never an operating-system glyph. */
export const EMOJI_PLACEHOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%">'
  + '<rect x="1.6" y="1.6" width="12.8" height="12.8" rx="3.4" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.55"></rect>'
  + '<circle cx="8" cy="8" r="1.6" fill="currentColor" opacity="0.55"></circle></svg>';

const PLACEHOLDER_STYLE = 'display:inline-block;position:relative;width:1em;height:1em;vertical-align:-0.125em';
/** Kept for copy, find-in-page and selection; clipped rather than removed, so it
 *  is never painted and never reaches an export as visible text. */
const HIDDEN_TEXT_STYLE = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
/**
 * The artwork fills the outer span. No colour is set here, on purpose: an inline
 * `<svg>` inherits CSS `color` from the text it sits in, which is what lets a
 * single-ink glyph's `currentColor` paints follow the surrounding text, and what
 * lets the placeholder above do the same. An inline colour would freeze both.
 */
const ARTWORK_ATTRIBUTES = ' aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%"';

/** SVG text uses the shaped vector pass; form controls use their editing overlays. */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SVG', 'CANVAS', 'NOSCRIPT']);

export { emojiTextTrigger };

const isEmojiSpan = (element: EmojiDomElement): boolean => /(?:^|\s)lolly-emoji(?:\s|$)/.test(element.getAttribute('class') ?? '');
const isUnsetSpan = (element: EmojiDomElement): boolean => /(?:^|\s)lolly-emoji--unset(?:\s|$)/.test(element.getAttribute('class') ?? '');
const meaningKey = (meaning: EmojiLineSource['meaning']): string => meaning.kind === 'unicode' ? meaning.key : meaning.id;
/** The short form of a treated artwork checksum a placement carries, so a later
 *  pass can tell "already drawn from this set" from "drawn from another one". */
const shortSum = (checksum: string): string => checksum.replace(/^sha256:/, '').slice(0, 16);

const SCOPE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

/**
 * The prefix every local id in one work item's artwork carries, so two copies of
 * one glyph never share a gradient or a clip path.
 *
 * Derived from the item's place in document order, never from a counter: the same
 * tree gives the same ids however many times the pass has run over it, so an
 * export taken after ten repaints is byte for byte the export taken after one.
 * A caller walking several roots into one document passes `idScope` to keep them
 * apart. A run of text longer than the segmenter accepts is cut into chunks, and
 * each chunk takes its own prefix for the same reason.
 */
function placementPrefix(scope: string, item: number, chunk: number): string {
  const base = SCOPE_PATTERN.test(scope) ? scope : 'e';
  return chunk === 0 ? `${base}${item}` : `${base}${item}c${chunk}`;
}

function documentFor(node: EmojiDomNode): EmojiDomDocument | null {
  const owner = node.ownerDocument;
  if (owner && typeof owner.createElement === 'function') return owner;
  const self = node as unknown as Partial<EmojiDomDocument>;
  return typeof self.createElement === 'function' ? (self as EmojiDomDocument) : null;
}

function skipElement(element: EmojiDomElement, options: EmojiDomOptions): boolean {
  if (SKIP_TAGS.has(element.nodeName.toUpperCase())) return true;
  const editable = element.getAttribute('contenteditable');
  if (editable !== null && editable !== 'false') return true;
  return options.skip?.(element) === true;
}

type Work =
  | { kind: 'text'; node: EmojiDomNode; text: string; at: number }
  | { kind: 'span'; node: EmojiDomElement; text: string; at: number };

/** Document order, iteratively: a deep tree must not cost a call stack. Passing
 *  `everything` walks past the skip rules, which is what a revert wants. */
function collect(root: EmojiDomNode, options: EmojiDomOptions, everything = false): Work[] {
  const work: Work[] = [];
  const stack: EmojiDomNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.nodeType === TEXT_NODE) {
      const text = node.data ?? node.textContent ?? '';
      if (emojiTextTrigger(text)) work.push({ kind: 'text', node, text, at: 0 });
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const element = node as EmojiDomElement;
    if (isEmojiSpan(element)) {
      const text = element.getAttribute('data-emoji') ?? '';
      const at = Number(element.getAttribute('data-emoji-at') ?? '0');
      if (text) work.push({ kind: 'span', node: element, text, at: Number.isFinite(at) ? at : 0 });
      continue;
    }
    if (!everything && skipElement(element, options)) continue;
    const children = element.childNodes;
    for (let index = children.length - 1; index >= 0; index--) stack.push(children[index]!);
  }
  return work;
}

function artworkMarkup(markup: string): string {
  return markup.startsWith('<svg') ? `<svg${ARTWORK_ATTRIBUTES}${markup.slice(4)}` : markup;
}

/**
 * XML escaping plus a numeric carriage return, because this markup is put back
 * through an HTML parser and that parser turns a raw CR (and a CRLF pair) into a
 * newline. The pass must hand back exactly the characters it was given, so text
 * pasted from a Windows machine keeps its line endings.
 */
function escapeChars(text: string): string {
  return escapeXml(text).replace(/\r/g, '&#13;');
}

function hiddenText(text: string): string {
  return `<span class="${EMOJI_TEXT_CLASS}" style="${HIDDEN_TEXT_STYLE}">${escapeChars(text)}</span>`;
}

/** One placement's markup: the artwork, then the characters it stands for. */
function spanMarkup(segment: EmojiTextSegmentV1, at: number): string {
  if (segment.kind === 'text') return escapeChars(segment.text);
  const common = `role="img" data-emoji="${escapeChars(segment.text)}" data-emoji-at="${at}"`;
  if (segment.kind === 'unresolved') {
    const label = `${segment.label ?? segment.text}${EMOJI_UNSET_LABEL}`;
    return `<span class="${EMOJI_SPAN_CLASS} ${EMOJI_UNSET_CLASS}" ${common} aria-label="${escapeChars(label)}" data-emoji-why="${escapeXml(segment.reason)}" style="${PLACEHOLDER_STYLE}">`
      + `${EMOJI_PLACEHOLDER_SVG}${hiddenText(segment.text)}</span>`;
  }
  return `<span class="${EMOJI_SPAN_CLASS}" ${common} aria-label="${escapeChars(segment.label)}" data-emoji-key="${escapeXml(segment.key)}"`
    + ` data-emoji-sum="${shortSum(segment.source.canonicalChecksum)}" style="${escapeXml(emojiInlineStyle(segment.metrics))}">`
    + `${artworkMarkup(segment.markup)}${hiddenText(segment.text)}</span>`;
}

/** Well under the segmenter's own ceiling, so a long run is cut rather than refused. */
const CHUNK_UNITS = 32_768;
/** How far back a cut may walk to miss a joined sequence before it gives up. */
const CHUNK_BACKOFF = 64;
/** Characters that must not be the first of a chunk, because a cluster is built
 *  from them: a low surrogate, a zero-width joiner, a keycap mark or either
 *  variation selector. Written in escapes, so this file carries no invisible
 *  characters. */
const JOINER = /[\uDC00-\uDFFF]|\u200D|\u20E3|\uFE0E|\uFE0F/;
/** The zero-width joiner, as an escape for the same reason. */
const ZWJ = '\u200D';

/**
 * Cut a long run into pieces the segmenter accepts, preferring a boundary that
 * is not inside a surrogate pair or a joined sequence. A run this long has to be
 * cut somewhere: cutting it is what keeps a pasted article's emoji drawn, where
 * refusing the node whole would hand the paragraph back to the machine's own
 * emoji font.
 */
function chunkText(text: string): string[] {
  if (text.length <= EMOJI_TEXT_MAX_UNITS) return [text];
  const out: string[] = [];
  let at = 0;
  while (at < text.length) {
    let end = Math.min(at + CHUNK_UNITS, text.length);
    if (end < text.length) {
      const floor = Math.max(at + 1, end - CHUNK_BACKOFF);
      while (end > floor && (JOINER.test(text[end]!) || text[end - 1] === ZWJ)) end -= 1;
    }
    out.push(text.slice(at, end));
    at = end;
  }
  return out;
}

/** Every emoji-looking run in a chunk the segmenter refused, one at a time. */
const TRIGGER_ALL = new RegExp(`(?:${EMOJI_TEXT_TRIGGER.source})+`, 'g');

/**
 * What to draw when the segmenter will not read a run at all: an unpaired
 * surrogate, or text still too long after the cut above. Every character the
 * pre-check calls emoji-shaped becomes the neutral placeholder and the rest stays
 * text, so even a refused node never falls through to an operating-system glyph.
 */
function refusedSegments(text: string): EmojiTextSegmentV1[] {
  const segments: EmojiTextSegmentV1[] = [];
  let at = 0;
  TRIGGER_ALL.lastIndex = 0;
  for (let hit = TRIGGER_ALL.exec(text); hit; hit = TRIGGER_ALL.exec(text)) {
    if (hit.index > at) segments.push({ kind: 'text', text: text.slice(at, hit.index) });
    segments.push({ kind: 'unresolved', text: hit[0], reason: 'unreadable-text' });
    at = hit.index + hit[0].length;
  }
  if (at < text.length) segments.push({ kind: 'text', text: text.slice(at) });
  return segments;
}

/** Parse markup once, then move the parsed nodes in before `target`. */
function insertMarkup(doc: EmojiDomDocument, parent: EmojiDomNode, target: EmojiDomNode, html: string): void {
  const container = doc.createElement('span');
  container.innerHTML = html;
  for (const child of Array.from(container.childNodes)) parent.insertBefore(child, target);
  parent.removeChild(target);
}

/**
 * Draw every emoji in `root` from the chosen set. Idempotent: a placement that
 * already carries this set's artwork is left exactly as it is, and the result
 * describes the finished tree, so a second call over a processed root reports
 * the same counts and the same census.
 *
 * A null style, an unavailable pack or a glyph the set does not carry all give
 * the neutral placeholder. The engine never falls back to an operating-system
 * font.
 */
export async function applyEmojiToDom(
  root: EmojiDomNode,
  style: EmojiStyleV1 | null | undefined,
  packs: readonly VerifiedEmojiPack[],
  io: EmojiTextIO,
  options: EmojiDomOptions = {},
): Promise<EmojiDomResult> {
  const doc = documentFor(root);
  const census: EmojiLineSource[] = [];
  const index = new Map<string, EmojiLineSource>();
  let replaced = 0, unresolved = 0;
  if (!doc) return { replaced, unresolved, census };

  const work = collect(root, options);
  const scope = options.idScope ?? 'e';
  for (let at = 0; at < work.length; at++) {
    const item = work[at]!;
    const parent = item.node.parentNode;
    if (!parent) continue;
    // A run longer than the segmenter accepts is cut rather than refused, and a
    // chunk it still will not read (an unpaired surrogate) has every emoji-shaped
    // character drawn as the placeholder. Either way the characters are accounted
    // for: nothing here ever hands a cluster back to the machine's own font.
    const segments: EmojiTextSegmentV1[] = [];
    const chunks = chunkText(item.text);
    for (let chunk = 0; chunk < chunks.length; chunk++) {
      let prepared: PreparedEmojiText;
      const prefix = placementPrefix(scope, at, chunk);
      try { prepared = await prepareEmojiText(chunks[chunk]!, style, packs, io, { cache: options.cache, prefix }); }
      catch { segments.push(...refusedSegments(chunks[chunk]!)); continue; }
      segments.push(...prepared.segments);
    }
    let offset = item.at;
    let html = '';
    // A text node is rewritten only when it really holds an emoji; a placement
    // that already carries what this pass would draw is left exactly as it is.
    let rewrite = false;
    for (const segment of segments) {
      html += spanMarkup(segment, offset);
      if (segment.kind === 'emoji') {
        replaced++;
        const key = JSON.stringify([emojiPackPinKey(segment.source.pack), meaningKey(segment.source.meaning)]);
        let entry = index.get(key);
        if (!entry) {
          entry = { ...structuredClone(segment.source), occurrences: [] };
          index.set(key, entry);
          census.push(entry);
        }
        entry.occurrences.push({ start: offset, end: offset + segment.text.length });
        if (item.kind === 'text' || item.node.getAttribute('data-emoji-sum') !== shortSum(segment.source.canonicalChecksum)) rewrite = true;
      } else if (segment.kind === 'unresolved') {
        unresolved++;
        if (item.kind === 'text' || !isUnsetSpan(item.node)) rewrite = true;
      }
      offset += segment.text.length;
    }
    if (!rewrite) continue;
    insertMarkup(doc, parent, item.node, html);
  }
  return { replaced, unresolved, census };
}

/**
 * Put the characters back. Used before a text box becomes editable, so the
 * caret, selection and input composition all work on plain text.
 */
export function revertEmojiDom(root: EmojiDomNode): number {
  revertEmojiSvgText(root);
  const doc = documentFor(root);
  if (!doc) return 0;
  let reverted = 0;
  for (const item of collect(root, {}, true)) {
    if (item.kind !== 'span') continue;
    const parent = item.node.parentNode;
    if (!parent) continue;
    insertMarkup(doc, parent, item.node, escapeChars(item.text));
    parent.normalize?.();
    reverted++;
  }
  return reverted;
}
