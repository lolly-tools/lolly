// SPDX-License-Identifier: MPL-2.0
/**
 * Which asset types are read as text, asked in one place.
 *
 * A brand skill (plan 323) is a Markdown file the brand wrote, so every surface
 * that previews, copies or downloads a text upload treats it the same way: the
 * reader, Copy text and Download as come along with no second code path. Two
 * things differ, and the predicates below are how a surface asks:
 *
 *  - a skill is never put through the AI-writing analysis. Brand standards are
 *    often written for and with AI, so a heat map over the brand team's document
 *    is noise rather than a signal;
 *  - its frontmatter is metadata for agents, not prose, so the rendered reading
 *    view drops the block. The raw view still shows every byte.
 *
 * DOM-free, so the assets view, the thumbnails and the Start room share one answer.
 */
import { parseSkillFrontmatter } from '@lolly-tools/core/skill-frontmatter-v1';

/** Asset types whose bytes are the text itself. */
export const TEXT_KINDS: ReadonlySet<string> = new Set(['text', 'skill']);

/** True for a type read as text: a text upload or a brand skill. */
export function isTextKind(type: unknown): boolean {
  return typeof type === 'string' && TEXT_KINDS.has(type);
}

/** True for a brand skill, which reads as text but is never analysed for AI signals. */
export function isSkillKind(type: unknown): boolean {
  return type === 'skill';
}

/** True when the AI-writing analysis and its heat marks apply to this type. */
export function analysesTextSignals(type: unknown): boolean {
  return isTextKind(type) && !isSkillKind(type);
}

/**
 * The Markdown to render for reading: the body after a well-formed frontmatter
 * block, else the whole text. A leading `---` that is not a clean `key: value`
 * block (a document that opens with a rule) is left alone, so nothing a person
 * wrote disappears from the rendered view.
 */
export function readableMarkdown(text: string): string {
  const fm = parseSkillFrontmatter(text);
  return fm.present && fm.length > 0 && !fm.errors.length ? fm.body.replace(/^\r?\n/, '') : text;
}

/** A link target in the catalog asset id grammar (schemas/asset.schema.json), as a skill writes a mark. */
const ASSET_ID_TARGET = /^[a-z0-9]+(?:\/[a-z0-9][a-z0-9-]*)+$/;

/**
 * Makes the links in rendered Markdown safe to press inside the app. A web link opens
 * in a new tab; a catalog asset id opens that asset in Assets; anything else (a
 * relative file, an in-page anchor the hash router would treat as a route) keeps its
 * text and loses its href, with the target kept as a tooltip.
 */
export function tidyReaderLinks(root: ParentNode): void {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = (a.getAttribute('href') ?? '').trim();
    if (/^https?:\/\//i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; continue; }
    const id = href.replace(/^asset:/, '');
    if (ASSET_ID_TARGET.test(id)) { a.setAttribute('href', `#/a?asset=${encodeURIComponent(id)}`); continue; }
    a.title = href;
    a.removeAttribute('href');
  }
}
