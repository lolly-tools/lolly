// SPDX-License-Identifier: MPL-2.0
import { frameFilterApplies, selectFramePage } from '@lolly/engine';
// Export-target opt-in (plan: sandbox render). A tool whose exported output is
// NOT its whole canvas - e.g. a code sandbox whose rendered preview is transplanted
// into a same-origin mirror node - marks that node with `data-export-root`; the
// walker then rasterises the mirror instead of the IDE chrome. Inert by construction
// for every other tool: no marker → querySelector null → the canvas itself is used.
export const exportTargetNode = (c: HTMLElement | null): HTMLElement | null =>
  c?.querySelector<HTMLElement>('[data-export-root]') ?? c;


/**
 * The one artboard a deep link's `s=` names, for a still export (plan 112 section 10).
 * The export panel's fan-out already honours `s`; a link that exports on load called
 * the runtime with the whole target instead, so `?s=9&format=png&export` (and the CLI's
 * `--s=9`, the same path under another transport) wrote the first slide. Resolution is
 * the engine's, against the ids the rendered pages carry, so both paths pick the same
 * page from the same string. Null when nothing applies: no address, a multi-page or
 * motion format, a document without artboards, or an address that matches no page.
 */
export function addressedFramePage(
  root: Pick<ParentNode, 'querySelectorAll'> | null,
  fmt: string,
  address: string | null | undefined,
): HTMLElement | null {
  if (!root || !address || !frameFilterApplies(fmt)) return null;
  const pages = [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')];
  const pick = selectFramePage(pages.map((p) => p.getAttribute('data-frame-id')), address);
  return pick.kind === 'page' ? pages[pick.index] ?? null : null;
}

/**
 * Formats the export panel never splits into one file per page box: each carries the whole
 * document in one file or is a package of its own.
 */
export const WHOLE_DOCUMENT_FORMATS: ReadonlySet<string> = new Set([
  'pdf', 'zip', 'html', 'pptx', 'penpot', 'rpm', 'tar.gz',
]);

/**
 * Formats written from a paged document's content rather than drawn from a page: its text
 * (Markdown, plain text, Word, OpenDocument) and the data formats the engine writes from
 * sibling templates (DATA_FORMATS in engine/src/runtime.ts). Splitting one per page would
 * only repeat the same file. They stay whole for a paged document (render.paged). A page
 * strip or Design frames keep the rule they had, so Record's subtitle files are untouched.
 */
export const DOCUMENT_TEXT_FORMATS: ReadonlySet<string> = new Set([
  'md', 'txt', 'docx', 'odt',
  'json', 'csv', 'ics', 'vcf', 'srt', 'vtt', 'ttml', 'scc', 'css', 'scss', 'gpl',
]);

/** Where a stage's page boxes come from, for the export panel's per-page fan-out. */
export interface StagePages {
  /** A page strip (render.pages) or Design frames: the rule that predates paged documents. */
  frames: boolean;
  /** A paged document (render.paged) with neither. */
  paged: boolean;
}

/**
 * Whether a tool's stage holds page boxes (`[data-pdf-page]`) that a still export is
 * written per page from: a page strip (render.pages), Design frames, or a paged document
 * (render.paged: Battlecards, Booklet, Print Sheet, Doc Studio, Deck Studio). A paged
 * document used to be left out, so its PNG and SVG held the first page only, cropped to
 * the export size, and said nothing about the rest. Null when there are none.
 */
export function stagePages(render: { pages?: unknown; paged?: boolean }, hasFrames: boolean): StagePages | null {
  const frames = !!render.pages || hasFrames;
  if (frames) return { frames: true, paged: false };
  return render.paged === true ? { frames: false, paged: true } : null;
}

/** Whether an export in `fmt` is written once per page box: one file for one page, a ZIP for several. */
export function fansOutPerPage(fmt: string, animated: boolean, pages: StagePages): boolean {
  if (animated || WHOLE_DOCUMENT_FORMATS.has(fmt)) return false;
  return !(pages.paged && DOCUMENT_TEXT_FORMATS.has(fmt));
}
