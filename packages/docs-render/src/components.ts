// SPDX-License-Identifier: MPL-2.0
// Reading components (plan 277 step 3): admonitions, disclosures and the code block
// wrapper. Pure string assembly. render.ts parses the fences, renders titles and bodies
// through the shared inline/block passes and hands the finished pieces here, so this
// module needs no rendering context and imports nothing that imports it back.
//
// Authoring, allowlisted and nothing else:
//   ::: note Title          a prerequisite or scope the reader needs before acting
//   ::: warning Title       a concrete consequence of the next action
//   ::: check Title         an observable result that shows the step worked
//   ::: details Title       optional depth, closed by default
//   :::
// Styles: shells/web/src/styles/parts/docs-components.css. Behaviour (Copy, feedback,
// opening a disclosure from a link): docs/reader/enhance.ts.
import { escAttr } from './esc.ts';

export const NOTE_KINDS = ['note', 'warning', 'check'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export type ComponentKind = NoteKind | 'details';

/** Sprite keys for each glyph (registered from shells/web/src/lib/icons.ts). */
export const COMPONENT_GLYPH: Record<ComponentKind, string> = {
  note: 'adm-info',
  warning: 'adm-alert',
  check: 'adm-check',
  details: 'adm-more',
};

/** `note Some title` → { kind, title }, or null when the label is not a component. */
export function parseComponentFence(label: string): { kind: ComponentKind; title: string } | null {
  const m = /^(note|warning|check|details)(?:\s+(.*))?$/.exec(label.trim());
  if (!m) return null;
  return { kind: m[1] as ComponentKind, title: (m[2] ?? '').trim() };
}

/** A heading inside a component body would take a positional `section-N` id in
 *  non-Latin locales that collides with the page's own, and it breaks the reading
 *  order a note or disclosure is meant to keep. Code fences are skipped. */
export function bodyHasHeading(body: string): boolean {
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (!inFence && /^#{1,6}\s/.test(line)) return true;
  }
  return false;
}

export interface NoteParts {
  kind: NoteKind;
  /** The visually hidden kind word, already translated ("Note", "Warning", "Check"). */
  kindWord: string;
  titleHtml: string;
  bodyHtml: string;
  glyph: string;
}

/** An admonition. role="note" rather than <aside>: /info's article is a <main> and the
 *  app's is an <article>, and an aside would become a complementary landmark in one
 *  host only. */
export function noteBlock(p: NoteParts): string {
  return `<div class="doc-note doc-note--${p.kind}" role="note">`
    + `<span class="doc-note-glyph" aria-hidden="true">${p.glyph}</span>`
    + `<div class="doc-note-main"><div class="doc-note-title"><span class="doc-visually-hidden">${p.kindWord}: </span>${p.titleHtml}</div>`
    + `<div class="doc-note-body">${p.bodyHtml}</div></div></div>`;
}

export interface DetailsParts {
  id: string;
  titleHtml: string;
  bodyHtml: string;
  glyph: string;
  chevron: string;
}

/** A native disclosure. Expanded state stays in <details open>; no second ARIA flag. */
export function detailsBlock(p: DetailsParts): string {
  return `<details class="doc-details" id="${escAttr(p.id)}">`
    + `<summary><span class="doc-details-glyph" aria-hidden="true">${p.glyph}</span>`
    + `<span class="doc-details-title">${p.titleHtml}</span>`
    + `<span class="doc-details-chev" aria-hidden="true">${p.chevron}</span></summary>`
    + `<div class="doc-details-body">${p.bodyHtml}</div></details>`;
}

/** A fence info string: the first token is the language, restricted to a safe
 *  alphabet; later tokens are allowlisted flags. Anything else is dropped rather
 *  than written into a class attribute. */
export const FENCE_FLAGS = ['no-copy', 'wrap'] as const;
export function parseFenceInfo(info: string): { lang: string; flags: Set<string> } {
  const [first = '', ...rest] = info.trim().split(/\s+/).filter(Boolean);
  const lang = /^[a-z0-9+#._-]+$/i.test(first) ? first : '';
  const flags = new Set(rest.filter(f => (FENCE_FLAGS as readonly string[]).includes(f)));
  return { lang, flags };
}

/** The toolbar label for a fence language. Proper names stay as they are; the words go
 *  through the render context's t(). */
const FENCE_PROPER: Record<string, string> = {
  json: 'JSON', jsonc: 'JSON', js: 'JavaScript', ts: 'TypeScript', html: 'HTML', css: 'CSS', yaml: 'YAML',
  yml: 'YAML', xml: 'XML', svg: 'SVG', ini: 'INI', toml: 'TOML', nginx: 'nginx', dockerfile: 'Dockerfile',
  csv: 'CSV', handlebars: 'Handlebars', md: 'Markdown', markdown: 'Markdown', diff: 'Diff',
};
const FENCE_WORD: Record<string, string> = {
  bash: 'Terminal', sh: 'Terminal', shell: 'Terminal', zsh: 'Terminal',
  console: 'Terminal output', text: 'Text', output: 'Output',
};
/** Every word the components pass through the render context's t(), for the site
 *  translation corpus (scripts/translate.ts extractSiteKeys), which cannot see a call
 *  whose argument is not a literal. */
export const RENDER_WORDS: readonly string[] = [
  'Note', 'Warning', 'Check', ...new Set(Object.values(FENCE_WORD)), 'Code',
];

/** Output and plain text are read, not reused, so they carry no Copy; neither does an
 *  unlabelled fence, which in this corpus is usually a directory tree or a transcript. */
const FENCE_NO_COPY = new Set(['', 'console', 'text', 'output']);
/** Shell examples copy as commands: prompts, output and comments are left out, because a
 *  comment line pasted into zsh (the macOS default, where comments are off) is an error. */
const FENCE_SHELL = new Set(['bash', 'sh', 'shell', 'zsh']);

export function fenceLabel(lang: string, t: (en: string) => string): string {
  return FENCE_PROPER[lang] ?? t(FENCE_WORD[lang] ?? 'Code');
}
export function fenceCopies(lang: string, flags: Set<string>): boolean {
  return !flags.has('no-copy') && !FENCE_NO_COPY.has(lang);
}
/** How Copy reads a block: 'shell' copies the commands, 'exact' the text as shown. */
export function fenceCopyMode(lang: string): 'shell' | 'exact' {
  return FENCE_SHELL.has(lang) ? 'shell' : 'exact';
}

export interface CodeParts {
  lang: string;
  label: string;
  copy: boolean;
  /** 'shell' when Copy should give the commands only (see fenceCopyMode). */
  copyMode?: 'shell' | 'exact';
  wrap: boolean;
  codeHtml: string;
}

/** A code block. The bar holds no text: its label is data, drawn by CSS, so search
 *  and the model index read the page exactly as before. The enhancer
 *  (shells/web/src/lib/docs-enhance.ts) adds Copy to blocks marked data-copy. */
export function codeBlock(p: CodeParts): string {
  const label = escAttr(p.label);
  // A wrapping block may break only between arguments: each whitespace-separated token
  // is held together, because a browser also breaks after a hyphen and would strand a
  // flag's "--" at a line end. The text, and so the copy, is unchanged.
  const codeHtml = p.wrap ? p.codeHtml.replace(/\S+/g, (tok) => `<span class="doc-code-token">${tok}</span>`) : p.codeHtml;
  const copy = p.copy ? ` data-copy="${p.copyMode === 'shell' ? 'shell' : ''}"` : '';
  return `<div class="doc-code" data-label="${label}"${copy}${p.wrap ? ' data-wrap=""' : ''}>`
    + `<div class="doc-code-bar" data-label="${label}"></div>`
    + `<pre tabindex="0" role="group" aria-label="${label}"><code${p.lang ? ` class="language-${escAttr(p.lang)}"` : ''}>${codeHtml}</code></pre></div>`;
}

/** True when rendered HTML holds a block the enhancer gives Copy, in either copy mode.
 *  The static build carries the Copy words only on such pages, so it asks this module,
 *  which writes the marker, rather than matching one spelling of the marker. */
export function hasCopyBlock(html: string): boolean {
  return /\sdata-copy="(?:shell)?"/.test(html);
}
