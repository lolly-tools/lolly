// SPDX-License-Identifier: MPL-2.0
/**
 * Spoken-text extraction for the docs audio pipeline (plans/docs-audio-listen.md
 * §4.1) — markdown source in, an ordered list of speakable blocks out.
 *
 * The input is the page's SOURCE (`docs/<slug>.md`), never the built HTML: the
 * source is stable across chrome/CSS churn, and that stability is what the
 * staleness contract hashes (§5). Extraction decides what a listener hears:
 *
 *   - code fences   → one "Code example omitted." line per fence (never the code)
 *   - tables        → the authored caption line immediately above, else
 *                     "Table omitted."
 *   - shot recipes  → dropped entirely (they are figures, and the page itself is
 *                     the visual layer of the attention stack — narrating a
 *                     screenshot's alt text would double-speak the page)
 *   - links         → the link text only, never a URL
 *   - inline markup → the text inside it (bold/italic/backticks/HTML comments)
 *   - a leading H1 that restates the page's build.ts title (exactly, or as a
 *     "<title> - <subtitle>" metadata label) → skipped when the caller passes
 *     `pageTitle` — the spoken page opens with real prose, not a filing label
 *
 * blockId parity: heading ids reuse the SAME slug rule docs/build.ts mints for
 * heading anchors (`headingId` there — build.ts deliberately has no exports, so
 * the two-line rule is duplicated here and pinned by a parity test that reads
 * build.ts's source). Paragraphs and list items are `<heading-id>:p<n>`,
 * n counted within the section, so the player can highlight the right DOM node
 * and the ids survive edits elsewhere on the page.
 */

import { createHash } from 'node:crypto';

export interface SpokenBlock {
  blockId: string;
  kind: 'heading' | 'para' | 'listItem';
  /** Heading level (1–4) — headings only. */
  level?: number;
  text: string;
}

export interface ExtractOptions {
  /**
   * The page's title from docs/build.ts's pages[] entry. When the FIRST block
   * of the document is a level-1 heading that merely restates it — exactly, or
   * as a "<title> - <subtitle>" metadata pattern like site.md's
   * "Lolly - Landing page copy" — that heading is a label for editors, not
   * content, and narrating it opens the page with filing-cabinet noise. It is
   * skipped so the spoken page opens with real prose. Only the first block is
   * a candidate, and only a level-1 heading; every other heading (and its
   * anchor id) is untouched. Callers must agree on this value: the pipeline
   * reads it from pages[] and the player passes the same title build.ts stamped
   * on the Listen button, so hashes and blockIds stay in lockstep.
   */
  pageTitle?: string;
}

/** Does a leading H1 merely restate the page title (see ExtractOptions)? */
function isMetaTitle(spoken: string, pageTitle: string): boolean {
  const title = pageTitle.trim().replace(/\s+/g, ' ');
  if (!title) return false;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(\\s*[-–—:]\\s+.+)?$`, 'i').test(spoken);
}

/** docs/build.ts's headingId, duplicated verbatim (it has no exports by design).
 *  tests/docs-spoken-text.test.ts pins the two implementations together. */
export function headingId(text: string, ordinal: number): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `section-${ordinal}`;
}

/** Inline markdown → the words a narrator says. Order matters: images before
 *  links (an image IS a link syntactically), comments before emphasis. */
function speakInline(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, ' ')            // icon comments and friends
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')       // images/shot recipes — dropped
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links → their text
    // A bare URL in prose has no link text to fall back to; the host is the one
    // part a narrator can say without spelling out a path ("mcp.lolly.tools",
    // not slash-by-slash). Runs after the link rule so it only sees bare ones.
    .replace(/\bhttps?:\/\/([^/\s)\]"'>]+)[^\s)\]"'>]*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')                 // inline code → the text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')         // stray inline HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the spoken-text document from one docs page's markdown source.
 * Deterministic and pure — same source, same blocks, same ids.
 */
export function extractSpokenText(markdown: string, opts: ExtractOptions = {}): SpokenBlock[] {
  const lines = markdown.split('\n');
  const out: SpokenBlock[] = [];
  let headingOrdinal = 0;
  let sectionId = 'intro';   // blocks before the first heading
  let paraIndex = 0;
  let inFence = false;
  let i = 0;

  const push = (kind: SpokenBlock['kind'], text: string, level?: number): void => {
    const spoken = speakInline(text);
    if (!spoken) return;
    if (kind === 'heading') {
      // A leading meta-title H1 is never narrated (see ExtractOptions). The
      // ordinal still advances — build.ts numbers every heading it renders, so
      // skipping the emit must not shift later fallback ids out of parity —
      // but sectionId stays 'intro': the following prose sits before the first
      // NARRATED heading, which is what the id describes.
      if (out.length === 0 && level === 1 && opts.pageTitle && isMetaTitle(spoken, opts.pageTitle)) {
        headingOrdinal++;
        return;
      }
      headingOrdinal++;
      sectionId = headingId(spoken, headingOrdinal);
      paraIndex = 0;
      out.push({ blockId: sectionId, kind, level, text: spoken });
    } else {
      paraIndex++;
      out.push({ blockId: `${sectionId}:p${paraIndex}`, kind, text: spoken });
    }
  };

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code: swallow the fence, speak one omission line — unless the fence
    // opens with the `narrate-skip` info string, which drops it silently (for a
    // block voiced elsewhere: the Beatrice manifesto poems are read by their own
    // .opus players, so the body narration must not announce them). build.ts
    // renders the info string as an invisible `language-*` CSS class, so it
    // never shows on the page, and it survives verbatim into the twin the player
    // re-extracts — keeping the audio and the follow-along highlight in lockstep.
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      if (!inFence && fence[1]!.trim() !== 'narrate-skip') push('para', 'Code example omitted.');
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) { i++; continue; }

    // Provenance credential lines (`%file{…} %entity{…} …`) render as pills on the
    // page, not body copy, and would read as gibberish aloud. Skip any line that
    // OPENS with a provenance macro — the credential lines always do. The
    // published twin (docs/build.ts) drops the same lines entirely, so the audio
    // (extracted from source) and the player's block map (re-extracted from the
    // twin) exclude the identical set and stay in lockstep.
    if (/^\s*%(?:file|entity|act|detail|sig)\{/.test(line)) { i++; continue; }

    // Tables: a run of |-rows. Spoken as the authored caption line immediately
    // above (already emitted as its own para) — if the previous emitted block
    // wasn't a para, announce the omission.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const prev = out[out.length - 1];
      if (!prev || prev.kind === 'heading') push('para', 'Table omitted.');
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!)) i++;
      continue;
    }

    // Layout chrome, never spoken: `:::` directive fences (cols/timeline/showcase
    // markers — build.ts renders the content between them, so we keep walking it)
    // and horizontal rules (build.ts renders `^-{3,}$` as <hr>).
    if (/^\s*:::/.test(line) || /^-{3,}$/.test(line.trim())) { i++; continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      push('heading', heading[2]!, heading[1]!.length);
      i++;
      continue;
    }

    // Bullet / numbered list items: one block each.
    const item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      push('listItem', item[1]!);
      i++;
      continue;
    }

    // Blockquote lines fold into the paragraph flow (the text is the point).
    // Everything else: accumulate a paragraph until a blank line or a line that
    // starts a construct handled above.
    if (line.trim() === '') { i++; continue; }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.trim() === '' || /^\s*```/.test(l) || /^#{1,4}\s/.test(l)
        || /^\s*(?:[-*]|\d+\.)\s+/.test(l) || /^\s*\|.*\|\s*$/.test(l)
        || /^\s*:::/.test(l) || /^-{3,}$/.test(l.trim())
        || /^\s*%(?:file|entity|act|detail|sig)\{/.test(l)) break;
      para.push(l.replace(/^\s*>\s?/, ''));
      i++;
    }
    push('para', para.join(' '));
  }

  return out;
}

/**
 * The staleness hash (plans/docs-audio-listen.md §5): sha256 over the
 * whitespace-normalised spoken text, so chrome/CSS/recipe/translation churn and
 * paragraph reflow never re-render narration — only a change to the words a
 * listener would hear does. Includes the block kinds/levels (a paragraph
 * promoted to a heading changes pacing) but never the blockIds' positions.
 */
export function spokenTextHash(blocks: SpokenBlock[]): string {
  const doc = blocks.map(b => `${b.kind}${b.level ?? ''}|${b.text.replace(/\s+/g, ' ').trim()}`).join('\n');
  return createHash('sha256').update(doc).digest('hex');
}
