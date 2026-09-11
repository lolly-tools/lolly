// SPDX-License-Identifier: MPL-2.0
/**
 * Spoken-text extraction from the RENDERED docs DOM (plan 131 B.3).
 *
 * The counterpart to scripts/lib/docs-spoken-text.ts, which reads the markdown
 * SOURCE. The produced-audio host (narration-host.ts) uses that markdown path,
 * because a slug's committed .opus was baked from the source and the follow-along
 * cues speak in source blockIds. The DEVICE-TTS host has no committed audio and no
 * source to lean on: locale pages ship HTML only (no `.md` twin), and so do the
 * generated side-door pages. So it reads the page it is standing on.
 *
 * It applies the SAME editorial rules as the markdown extractor - skip code (say
 * "Code example omitted." once per fence, silence a `narrate-skip` fence), skip a
 * table (announce it once), skip the provenance credential lines, skip a leading
 * meta-title H1 - so a reader hears the same document either way. The rules are
 * matched to the markdown side by tests/docs-dom-spoken-text.test.ts (heading
 * sequence parity). Two things DON'T match by construction, and the parity test
 * allows for them: a bare URL in prose (the markdown side says just its host; the
 * DOM carries the link's full visible text) and exact block counts (two parsers).
 *
 * Because the blocks are read straight off the DOM, each one keeps a direct handle
 * to its element - no fuzzy text-matching back onto the page the way the audio host
 * must do from source blockIds. The follow-along highlight is then exact.
 *
 * ISOLATION: like its siblings in docs/player/, this imports nothing from
 * shells/web - only the pure helpers from scripts/lib (esbuild aliases their
 * node:crypto to a browser stub; this file uses none of it).
 */
// Self-contained on purpose: no scripts/lib or shells/web import, so BOTH the static
// /info bundle and the in-app #/docs reader can use it. The two pure helpers below are
// duplicated from scripts/lib/docs-spoken-text.ts (its own header explains the same
// duplication of build.ts's headingId) - the canonical copy stays there; the parity
// test tests/docs-dom-spoken-text.test.ts pins the DOM output against it.

/** One speakable block. Structurally identical to scripts/lib/docs-spoken-text's. */
export interface SpokenBlock {
  blockId: string;
  kind: 'heading' | 'para' | 'listItem';
  /** Heading level (1-4) - headings only. */
  level?: number;
  text: string;
}

export interface DomBlock {
  block: SpokenBlock;
  /** The live element this block was read from - the follow-along highlight target. */
  el: HTMLElement;
}

/** docs/build.ts's headingId (duplicated; see header). */
function headingId(text: string, ordinal: number): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `section-${ordinal}`;
}

/** Does a leading H1 merely restate the page title? (duplicated; see header) */
function isMetaTitle(spoken: string, pageTitle: string): boolean {
  const title = pageTitle.trim().replace(/\s+/g, ' ');
  if (!title) return false;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(\\s*[-–—:]\\s+.+)?$`, 'i').test(spoken);
}

/** The first non-whitespace node is a `.prov-pill` - i.e. this block is a credential
 *  line (`%file{…} %entity{…} …` renders pill-first). Mirrors the markdown extractor's
 *  "skip a line that OPENS with a provenance macro". */
function opensWithProvPill(el: HTMLElement): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? '').trim()) return false; // real prose before any pill
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return (node as HTMLElement).classList?.contains('prov-pill') ?? false;
    }
  }
  return false;
}

/**
 * Read the current page's speakable blocks in document order, each paired with the
 * element it came from. `pageTitle` is the same string build.ts stamps on the Listen
 * button, so the leading meta-title H1 is skipped identically to the markdown path.
 */
export function extractDomSpokenText(pageTitle?: string, contentRoot?: HTMLElement): DomBlock[] {
  // The in-app reader renders into its own node (passed here); the static site reads
  // its live .docs-content / .docs-landing.
  const root =
    contentRoot ??
    document.querySelector<HTMLElement>('.docs-content') ??
    document.querySelector<HTMLElement>('.docs-landing') ??
    document.body;

  // Candidates in document order; drop any that nests inside another candidate (a
  // <p> inside an <li>, a heading inside nothing) so no text is spoken twice.
  const all = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,pre,table'));
  const nodes = all.filter((n) => !all.some((o) => o !== n && o.contains(n)));

  const out: DomBlock[] = [];
  let headingOrdinal = 0;
  let sectionId = 'intro';
  let paraIndex = 0;
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

  const push = (kind: SpokenBlock['kind'], text: string, el: HTMLElement, level?: number): void => {
    const spoken = norm(text);
    if (!spoken) return;
    if (kind === 'heading') {
      // A leading H1 that just restates the page title is a filing label, not
      // content (see docs-spoken-text ExtractOptions). Advance the ordinal so
      // fallback ids stay in parity, but emit nothing.
      if (out.length === 0 && level === 1 && pageTitle && isMetaTitle(spoken, pageTitle)) {
        headingOrdinal++;
        return;
      }
      headingOrdinal++;
      sectionId = headingId(spoken, headingOrdinal);
      paraIndex = 0;
      out.push({ block: { blockId: sectionId, kind, level, text: spoken }, el });
    } else {
      paraIndex++;
      out.push({ block: { blockId: `${sectionId}:p${paraIndex}`, kind, text: spoken }, el });
    }
  };

  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'pre') {
      // A `narrate-skip` fence is voiced elsewhere (or is decorative) - silence it;
      // any other code block is announced once, never read out character by character.
      const code = el.querySelector('code');
      if (code?.classList.contains('language-narrate-skip')) continue;
      push('para', 'Code example omitted.', el);
      continue;
    }

    if (tag === 'table') {
      // The authored caption sits in the <p> just above, already spoken; only announce
      // an omission when nothing prose-like preceded it (mirrors the markdown rule).
      const prev = out[out.length - 1];
      if (!prev || prev.block.kind === 'heading') push('para', 'Table omitted.', el);
      continue;
    }

    if (/^h[1-4]$/.test(tag)) {
      push('heading', el.textContent ?? '', el, Number(tag[1]));
      continue;
    }

    // <p> / <li>: skip the provenance credential lines, speak the rest.
    if (opensWithProvPill(el)) continue;
    push(tag === 'li' ? 'listItem' : 'para', el.textContent ?? '', el);
  }

  return out;
}
