// SPDX-License-Identifier: MPL-2.0
/**
 * No accent outlines at rest (Andy's decision C3, 15 October 2026).
 *
 * At rest a card, panel, chip or ring wears the theme's neutral hairline:
 * hsl(var(--border)) in the app, var(--ui-color-border-default) in the docs
 * sheets. The accent appears on hover, selection and state. A full accent wash
 * stays allowed, because Andy's rule is to highlight with a full wash, a full
 * border or padding.
 *
 * The scan reads every stylesheet under shells/web/src/styles, the CSS template
 * literals in docs/build.ts (CSS, EDITION_CSS and the style inside NOSCRIPT_NAV)
 * and the style blocks in shells/web/index.html. For each rule it looks at the
 * border, outline and ring box-shadow declarations, and reports any whose colour
 * reads an accent on a selector part that holds no state.
 *
 * Three things clear a selector part without a list entry: a state in the part
 * (hover, focus, checked, an aria or data attribute, an is-* class and the like),
 * a filled control whose own rule paints its background in the same accent at
 * full strength and membership of the primary button alias list in buttons.css.
 * Everything else that is meant to keep its accent goes in ALLOWED with a reason.
 *
 * ALLOWED fails both ways, like RASTER_ALLOWED in docs-shots-vector.test.ts: a
 * hit that is not listed fails, and so does a listed entry that matches nothing,
 * so the list cannot outlive its own reasons. Entries match on the file and the
 * selector part, never on a line number, so unrelated edits do not churn the list.
 *
 * This rule should move into the house-rules check (scripts/check-house-rules.ts)
 * once that check is on main.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES_DIR = 'shells/web/src/styles';
const DOCS_BUILD = 'docs/build.ts';
const INDEX_HTML = 'shells/web/index.html';
const BUTTONS_CSS = 'shells/web/src/styles/parts/buttons.css';

interface Allowed {
  file: string;
  selector: string;
  reason: string;
}

const WAITING = 'Waiting on Andy:';

/**
 * Selector parts allowed to keep an accent outline at rest, each with its reason.
 * The selector is one comma part of the rule's selector list, compared with its
 * whitespace collapsed. Entries waiting on a decision start their reason with
 * "Waiting on Andy:".
 */
const PARTS = 'shells/web/src/styles/parts/';
const ALLOWED: Allowed[] = [
  // Andy's own exemption.
  { file: `${PARTS}ask.css`, selector: '.ask-send',
    reason: 'The candy Ask button keeps its accent edge at rest; Andy exempted it by name in C3.' },

  // Editing fields that exist only while something is being renamed or edited.
  { file: `${PARTS}data-grid.css`, selector: '.dg-editor',
    reason: 'The cell editor is mounted only while a cell is being edited, so its ring is the editing state.' },
  { file: `${PARTS}design-guides.css`, selector: '.fc-guide-pill input',
    reason: "The guide position field appears only while a guide's position is being typed: an editing state." },
  { file: `${PARTS}design-navigator.css`, selector: '.fc-nav-name-input',
    reason: 'The layer name field replaces the label only while a layer is being renamed: an editing state.' },
  { file: `${PARTS}projects.css`, selector: '.projects-name-input',
    reason: 'The project name field replaces the title only while a project is being renamed: an editing state.' },
  { file: `${PARTS}timeline.css`, selector: '.tl-clip-rename',
    reason: 'The clip name field replaces the clip label only while a clip is being renamed: an editing state.' },

  // A filled control whose border is the fill colour, not an outline.
  { file: 'shells/web/src/styles/retouch.css', selector: '.rt-run',
    reason: 'A filled primary button: its fill comes from the alias list as .rt-actions .rt-run, and the border matches that fill.' },

  // Canvas overlays drawn while selecting, dragging, transforming or following.
  { file: `${PARTS}brand-studio.css`, selector: '.be-marquee',
    reason: 'The drag selection marquee in Brand Studio, drawn only while the pointer is dragging out a selection.' },
  { file: `${PARTS}components.css`, selector: '.tile-marquee',
    reason: 'The drag selection marquee over the tile grid, drawn only while the pointer is dragging out a selection.' },
  { file: `${PARTS}timeline.css`, selector: '.tl-marquee',
    reason: 'The drag selection marquee on the timeline, drawn only while the pointer is dragging out a selection.' },
  { file: `${PARTS}design-rules.css`, selector: '.dr-hover',
    reason: 'The hover outline the design rules overlay draws around the element under the pointer: a hover state.' },
  { file: `${PARTS}design-rules.css`, selector: '.dr-marquee',
    reason: 'The design rules drag marquee, drawn only while the pointer is dragging out a selection.' },
  { file: `${PARTS}deck-editor.css`, selector: '.deck-free__marquee',
    reason: 'The deck editor drag marquee, drawn only while the pointer is dragging out a selection on a slide.' },
  { file: `${PARTS}deck-editor.css`, selector: '.deck-free-bbox',
    reason: 'The bounding box around the selected slide elements in the deck editor: a selection overlay.' },
  { file: `${PARTS}deck-editor.css`, selector: '.deck-free-rot',
    reason: 'The rotate handle on the selected slide element in the deck editor: part of the selection overlay.' },
  { file: `${PARTS}deck-editor.css`, selector: '.deck-free-box',
    reason: 'The editing frame the deck editor draws over each movable slide element: a canvas overlay, not a card.' },
  { file: `${PARTS}deck-editor.css`, selector: '.deck-free-h',
    reason: 'The resize handles on the selected slide element in the deck editor: part of the selection overlay.' },
  { file: `${PARTS}editor.css`, selector: '.fc-outline',
    reason: 'The Design canvas selection outline, drawn only around the selected box: a selection overlay.' },
  { file: `${PARTS}editor.css`, selector: '.fc-group-outline',
    reason: 'The Design canvas outline around a selected group, drawn only while the group is selected.' },
  { file: `${PARTS}editor.css`, selector: '.fc-handle',
    reason: 'The Design canvas resize and rotate handles, drawn only on the current selection.' },
  { file: `${PARTS}editor.css`, selector: '.fc-rubber',
    reason: 'The Design canvas rubber band, drawn only while the pointer is dragging out a selection.' },
  { file: `${PARTS}editor.css`, selector: '.fc-pen-node',
    reason: 'The pen tool path nodes on the Design canvas, drawn only while a path is being drawn or edited.' },
  { file: `${PARTS}rebrand-compare.css`, selector: '.rb-outline',
    reason: "The selected object's place on the Proposed pane of the rebrand compare view: a selection overlay." },
  { file: `${PARTS}tool.css`, selector: '.framing-layer',
    reason: 'The framing layer exists only while framing is armed and takes the drag; it is kept out of every capture.' },
  { file: `${PARTS}collab.css`, selector: '.collab-follow-frame',
    reason: "Presence: the frame in the followed collaborator's colour, drawn only while following someone." },

  // Transient feedback and states the selector does not spell as one.
  { file: `${PARTS}tool.css`, selector: '.block-item.drag-over',
    reason: 'Drag reorder feedback on a block row, set only while another block is dragged over the row.' },
  { file: `${PARTS}tool.css`, selector: '.block-item.drop-inside',
    reason: 'Drop feedback on a tree block, set only while a dragged block would nest inside this one.' },
  { file: `${PARTS}gallery.css`, selector: '.drop-hint',
    reason: 'The drop hint pill is shown only while a file is dragged over the window: a drop target state.' },
  { file: `${PARTS}gallery.css`, selector: '.meta-fmt--default',
    reason: 'Marks the default export format among the format chips: a selection state, with its wash and label.' },
  { file: `${PARTS}tool.css`, selector: '.canvas-record-help .crh-nudge',
    reason: 'A transient tip, flashed only while its detected condition holds and the help panel is closed.' },
  { file: `${PARTS}tool.css`, selector: '.canvas-processing-spinner',
    reason: 'The busy spinner arc, shown only while the canvas is processing. Its Jungle literal is a separate Opal greens item.' },
  { file: `${PARTS}tool-chrome.css`, selector: '.scrub-readout::after',
    reason: "The scrub readout's arrow, drawn in the readout's own fill and shown only while scrubbing." },

  // Previews, illustrations and content, where the colour is the thing shown.
  { file: `${PARTS}components-lib.css`, selector: '.cl-cover-swatches i',
    reason: "The components cover palette swatches: the edge shows the brand's own action colour as content." },
  { file: `${PARTS}dashboard.css`, selector: '.dash-token-shape',
    reason: "A token preview swatch on the dashboard: the edge shows the brand's selection colour as content." },
  { file: `${PARTS}document.css`, selector: '.doc-color::after',
    reason: 'The colour swatch underline in the document text tool draws the chosen colour itself.' },
  { file: `${PARTS}document.css`, selector: '.doc-tt-holder h1',
    reason: "The Text tool renders the document's own heading style; the rule is part of the user's content." },
  { file: `${PARTS}document.css`, selector: '.doc-tt-holder h2',
    reason: "The Text tool renders the document's own heading style; the rule is part of the user's content." },
  { file: `${PARTS}document.css`, selector: '.doc-tt-holder blockquote',
    reason: "The Text tool renders the document's own quote style; the bar is part of the user's content." },
  { file: `${PARTS}document.css`, selector: '.doc-tt-guide',
    reason: 'An editing guide line in the document text tool, drawn as a guide over the page, not a resting card.' },
  { file: `${PARTS}document.css`, selector: '.doc-tt-guide-lbl',
    reason: 'The label on an editing guide in the document text tool, ringed in the guide colour so the two read as one.' },
  { file: `${PARTS}document.css`, selector: '.doc-tt-holder .doc-pagebreak',
    reason: 'The page break marker in the document text tool: an editing guide that shows where the page ends.' },

  // Jelly is opt-in and off by default.
  { file: `${PARTS}fields.css`, selector: '.cs-jelly .cs-tail',
    reason: "The Jelly speech bubble tail: its edge is the bubble's own fill, and Jelly effects are opt-in." },

  // GEN AI markers keep their violet at full contrast.
  { file: `${PARTS}valid.css`, selector: '.valid-aidecl',
    reason: 'A GEN AI declaration marker in Valid: the violet edge is how an AI declaration announces itself.' },
  { file: `${PARTS}valid.css`, selector: '.valid-tsig-details > summary',
    reason: 'The GEN AI training signal details in Valid: the violet divider belongs to the AI marker it sits in.' },
  { file: 'docs/build.ts', selector: '.shot-cred--ai .shot-cred-btn',
    reason: 'A docs shot carrying an AI declaration says so at full contrast; the comment above the rule explains why.' },

  // The /info seal.
  { file: `${PARTS}docs-landing.css`, selector: '.hero-verify',
    reason: 'The Pine rim is part of the /info seal. fix/info-opal recolours this ring; delete this entry when it merges.' },

  // Needs Andy: listed in the C3 pull request and left unchanged.
  { file: `${PARTS}docs.css`, selector: '.docs-content th',
    reason: `${WAITING} the reader table restates a green bottom rule after the neutral one, which reads as a deliberate hand edit.` },
  { file: `${PARTS}docs.css`, selector: '.docs-content td',
    reason: `${WAITING} the reader table restates a green bottom rule after the neutral one, which reads as a deliberate hand edit.` },
  { file: `${PARTS}docs-landing.css`, selector: '.tn-mission',
    reason: `${WAITING} a 2px accent top rule on the mission band is reading typography, not a card or a ring.` },
  { file: 'docs/build.ts', selector: '.sidedoor-contrast',
    reason: `${WAITING} a 3px accent quote rail on an unrounded paragraph is reading typography, not a card or a ring.` },
  { file: 'docs/build.ts', selector: 'blockquote',
    reason: `${WAITING} the /info blockquote keeps a 1px green ring that the in-app reader callout dropped in C3; fix/info-opal owns this line.` },
];

const FAILURE_HELP =
  "At rest a card or ring wears the theme's neutral hairline (hsl(var(--border)) in the app, "
  + 'var(--ui-color-border-default) in the docs sheets); the accent appears on hover, selection '
  + 'and state (Andy, C3). Move the accent to :hover, or, for a real state, filled control or '
  + 'overlay, add an ALLOWED entry with its reason.';

// ---------------------------------------------------------------------------
// Parsing

interface Decl {
  prop: string;
  value: string;
  line: number;
}

interface Rule {
  parts: string[];
  decls: Decl[];
}

/** Collapse runs of whitespace so a selector compares the same however it wraps. */
function norm(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim();
}

/** Replace every character but a newline with a space, so offsets and lines stay true. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, blank);
}

/** Split on a separator that sits outside quotes and brackets. */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === sep && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

/** At-rules whose block holds ordinary style rules. Any other block at-rule is skipped. */
const GROUP_AT_RULE = /^@(media|supports|layer|container|scope|document|starting-style)\b/i;

interface Frame {
  kind: 'group' | 'style';
  parts: string[];
  bodyStart: number;
  children: Array<[number, number]>;
}

/**
 * Walk the braces of a stylesheet and return every style rule with its selector
 * parts and declarations. Keyframes and other non-style at-rule bodies are skipped.
 * A nested style rule takes its parent's parts, through the ampersand when it has
 * one and as a descendant when it does not.
 */
function parseRules(source: string): Rule[] {
  const css = stripComments(source);
  const lineStarts = [0];
  for (let i = 0; i < css.length; i++) if (css[i] === '\n') lineStarts.push(i + 1);
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const rules: Rule[] = [];
  const stack: Frame[] = [];
  let preludeStart = 0;
  let quote = '';
  let paren = 0;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '(') {
      paren++;
      continue;
    }
    if (c === ')') {
      paren = Math.max(0, paren - 1);
      continue;
    }
    if (paren > 0) continue;
    if (c === ';') {
      preludeStart = i + 1;
      continue;
    }
    if (c === '{') {
      const prelude = css.slice(preludeStart, i).trim();
      const parent = stack[stack.length - 1];
      if (prelude.startsWith('@') && !GROUP_AT_RULE.test(prelude)) {
        // Keyframes, font faces and the like: skip the whole body.
        let depth = 1;
        let j = i + 1;
        for (; j < css.length && depth > 0; j++) {
          if (css[j] === '{') depth++;
          else if (css[j] === '}') depth--;
        }
        if (parent) parent.children.push([preludeStart, j]);
        i = j - 1;
        preludeStart = j;
        continue;
      }
      if (parent) parent.children.push([preludeStart, i]);
      if (prelude.startsWith('@')) {
        stack.push({ kind: 'group', parts: parent?.parts ?? [], bodyStart: i + 1, children: [] });
      } else {
        let parts = splitTop(prelude, ',').map(norm).filter(Boolean);
        if (parent?.parts.length) {
          // A nested style rule, directly or through a group such as a nested @media.
          parts = parent.parts.flatMap((p) =>
            parts.map((child) => (child.includes('&') ? child.replaceAll('&', p) : `${p} ${child}`)),
          );
        }
        stack.push({ kind: 'style', parts, bodyStart: i + 1, children: [] });
      }
      preludeStart = i + 1;
      continue;
    }
    if (c === '}') {
      const frame = stack.pop();
      if (frame && frame.kind === 'style') {
        let body = css.slice(frame.bodyStart, i);
        for (const [from, to] of frame.children) {
          const a = from - frame.bodyStart;
          const b = to - frame.bodyStart;
          body = body.slice(0, a) + blank(body.slice(a, b + 1)) + body.slice(b + 1);
        }
        const decls: Decl[] = [];
        let offset = frame.bodyStart;
        for (const chunk of splitTop(body, ';')) {
          const colon = chunk.indexOf(':');
          const lead = chunk.length - chunk.trimStart().length;
          if (colon > 0 && chunk.trim()) {
            const prop = chunk.slice(0, colon).trim().toLowerCase();
            const value = chunk.slice(colon + 1).replace(/!important/i, '').trim();
            if (/^-{0,2}[a-z][\w-]*$/i.test(prop)) decls.push({ prop, value, line: lineOf(offset + lead) });
          }
          offset += chunk.length + 1;
        }
        rules.push({ parts: frame.parts, decls });
      }
      preludeStart = i + 1;
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// The rule

const ACCENT_SOURCES = [
  '--primary(?![\\w-])',
  '--green(?![\\w-])',
  '--ring(?![\\w-])',
  '--band-accent',
  '--lolly-[\\w-]+',
  '--ui-color-action-primary',
  '--ui-color-focus-ring',
  '--ui-color-selection-border',
  '--vf-ai[\\w-]*',
  // An eight-digit hex is the same colour with an alpha, so it counts too.
  '#(?:30ba78|0c322c|159f66|008657|50c369|033633|24894e|64ce90|11734b|37c684)(?:[0-9a-f]{2})?(?![0-9a-f])',
  'rgba\\(\\s*12\\s*,\\s*50\\s*,\\s*44(?![\\d.])',
  'rgba\\(\\s*48\\s*,\\s*186\\s*,\\s*120(?![\\d.])',
];
/** The no-script page calls its own accent --pine, renamed to --accent by the Lolly tone work. */
const INDEX_ONLY_SOURCES = ['var\\(--pine(?![\\w-])', 'var\\(--accent(?![\\w-])'];

function accentPattern(file: string): RegExp {
  const sources = file === INDEX_HTML ? [...ACCENT_SOURCES, ...INDEX_ONLY_SOURCES] : ACCENT_SOURCES;
  return new RegExp(sources.join('|'), 'i');
}

const OUTLINE_PROP =
  /^(border(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(-color)?|outline(-color)?)$/;

const ZERO = /^[-+]?0*\.?0+(px|rem|em|%)?$/i;
const LENGTH_START = /^([-+]?[\d.]|calc\(|min\(|max\(|clamp\(|var\()/i;

/** A box-shadow part is a ring when it has no offset, no blur and a spread that is not zero. */
function isRingPart(part: string, accent: RegExp): boolean {
  const tokens = splitTop(part.trim(), ' ').filter(Boolean);
  const lengths: string[] = [];
  for (const token of tokens) {
    if (token.toLowerCase() === 'inset') continue;
    if (accent.test(token) || /^(#|hsla?\(|rgba?\(|oklch\(|oklab\(|color-mix\(|color\()/i.test(token)) continue;
    if (LENGTH_START.test(token)) lengths.push(token);
  }
  if (lengths.length < 4) return false;
  const [x = '', y = '', blur = '', spread = ''] = lengths;
  return ZERO.test(x) && ZERO.test(y) && ZERO.test(blur) && !ZERO.test(spread);
}

/** The accent named in a value, lower case, so a border and a fill can be compared. */
function accentKey(value: string, accent: RegExp): string | null {
  const m = value.match(accent);
  return m ? m[0].toLowerCase().replace(/\s+/g, '') : null;
}

/** A fill at full strength: no alpha slash, no mix with another colour, no rgba. */
function isFullStrength(value: string): boolean {
  return !/\/\s*[\d.]/.test(value) && !/color-mix\(/i.test(value) && !/rgba\(/i.test(value);
}

const STATE_PATTERNS: RegExp[] = [
  /:(hover|focus|focus-visible|focus-within|active|checked|indeterminate|disabled|invalid|user-invalid|target|popover-open)(?![\w-])/,
  /:has\([^)]*(:checked|\[checked)/,
  /\[aria-/,
  /\[data-(?!theme|a11y)/,
  /\.is-[\w-]/,
  /\.[\w-]+--(active|selected|current|set|editing|focused|armed|open)(?![\w-])/,
  /\.(active|selected|open|current|copy-armed|fc-editing|dragging)(?![\w-])/,
];

/** Remove :not(...) groups, since a negated state (":not(:disabled)") describes the rest state. */
function withoutNegations(part: string): string {
  let out = '';
  for (let i = 0; i < part.length; i++) {
    if (part.startsWith(':not(', i)) {
      let depth = 0;
      let j = i + 4;
      for (; j < part.length; j++) {
        if (part[j] === '(') depth++;
        else if (part[j] === ')' && --depth === 0) break;
      }
      i = j;
      continue;
    }
    out += part[i];
  }
  return out;
}

function isStatePart(part: string): boolean {
  const bare = withoutNegations(part);
  return STATE_PATTERNS.some((re) => re.test(bare));
}

interface Hit {
  file: string;
  line: number;
  part: string;
  decl: string;
}

/**
 * Every accent outline at rest in one stylesheet. `fillAliases` is the primary
 * button alias list; a part on it is a filled control. With `clearFills` off the
 * scan also reports filled controls, so a test can see which rule cleared them.
 */
function scanCss(css: string, file: string, fillAliases: ReadonlySet<string> = new Set(), clearFills = true): Hit[] {
  const accent = accentPattern(file);
  const hits: Hit[] = [];
  for (const rule of parseRules(css)) {
    const fills = rule.decls
      .filter((d) => (d.prop === 'background' || d.prop === 'background-color') && isFullStrength(d.value))
      .map((d) => accentKey(d.value, accent))
      .filter((k): k is string => k !== null);
    for (const decl of rule.decls) {
      let colour: string | null = null;
      if (OUTLINE_PROP.test(decl.prop)) {
        if (accent.test(decl.value)) colour = decl.value;
      } else if (decl.prop === 'box-shadow') {
        const ring = splitTop(decl.value, ',').find((p) => isRingPart(p, accent) && accent.test(p));
        if (ring) colour = ring.trim();
      }
      if (colour === null) continue;
      const key = accentKey(colour, accent);
      if (clearFills && key && fills.includes(key)) continue;
      for (const part of rule.parts) {
        if (isStatePart(part) || (clearFills && fillAliases.has(part))) continue;
        hits.push({ file, line: decl.line, part, decl: `${decl.prop}: ${decl.value}` });
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Scope

function cssFilesUnder(rel: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, rel)).sort()) {
    const child = `${rel}/${name}`;
    if (statSync(join(ROOT, child)).isDirectory()) out.push(...cssFilesUnder(child));
    else if (name.endsWith('.css')) out.push(child);
  }
  return out;
}

/** The body range of a template literal that opens with `opener`, interpolations blanked. */
function templateLiteral(source: string, opener: string): { start: number; text: string } {
  const at = source.indexOf(opener);
  assert.ok(at >= 0, `${DOCS_BUILD} no longer has ${opener}; update the scope of this test`);
  const start = at + opener.length;
  let text = '';
  let i = start;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') {
      text += c + (source[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '`') break;
    if (c === '$' && source[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}' && --depth === 0) break;
      }
      text += blank(source.slice(i, j + 1));
      i = j;
      continue;
    }
    text += c;
  }
  return { start, text };
}

/** A copy of `source` with only the given ranges kept, everything else blanked. */
function keepOnly(source: string, ranges: Array<{ start: number; text: string }>): string {
  let out = blank(source);
  for (const { start, text } of ranges) out = out.slice(0, start) + text + out.slice(start + text.length);
  return out;
}

/** The style elements inside some markup, as ranges relative to `base`. */
function styleBlocks(markup: string, base: number): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = [];
  const open = /^[ \t]*<style\b[^>]*>|<noscript><style\b[^>]*>/gm;
  for (let m = open.exec(markup); m; m = open.exec(markup)) {
    const start = m.index + m[0].length;
    const end = markup.indexOf('</style>', start);
    assert.ok(end > start, 'an unclosed style element');
    out.push({ start: base + start, text: markup.slice(start, end) });
  }
  return out;
}

function fillAliasList(): Set<string> {
  const rule = parseRules(readFileSync(join(ROOT, BUTTONS_CSS), 'utf-8')).find((r) =>
    r.decls.some((d) => d.prop === 'background' && d.value === 'var(--ui-color-action-primary)'),
  );
  assert.ok(rule, `${BUTTONS_CSS} no longer has the primary alias list this test reads`);
  return new Set(rule.parts);
}

function scanScope(clearFills = true): { hits: Hit[]; files: string[] } {
  const aliases = fillAliasList();
  const hits: Hit[] = [];
  const files = cssFilesUnder(STYLES_DIR);
  for (const file of files) hits.push(...scanCss(readFileSync(join(ROOT, file), 'utf-8'), file, aliases, clearFills));

  const build = readFileSync(join(ROOT, DOCS_BUILD), 'utf-8');
  const css = templateLiteral(build, 'const CSS = `');
  const edition = templateLiteral(build, 'const EDITION_CSS = `');
  const noscript = templateLiteral(build, 'const NOSCRIPT_NAV = `');
  const noscriptStyles = styleBlocks(noscript.text, noscript.start);
  assert.equal(noscriptStyles.length, 1, 'NOSCRIPT_NAV should hold one style element');
  hits.push(...scanCss(keepOnly(build, [css, edition, ...noscriptStyles]), DOCS_BUILD, aliases, clearFills));

  const html = readFileSync(join(ROOT, INDEX_HTML), 'utf-8');
  const htmlStyles = styleBlocks(html, 0);
  assert.ok(htmlStyles.length >= 2, `${INDEX_HTML} should hold the no-script and boot style elements`);
  hits.push(...scanCss(keepOnly(html, htmlStyles), INDEX_HTML, aliases, clearFills));

  return { hits, files: [...files, DOCS_BUILD, INDEX_HTML] };
}

const isAllowed = (hit: Hit) => (a: Allowed) => a.file === hit.file && norm(a.selector) === hit.part;

// ---------------------------------------------------------------------------
// Unit cases on inline CSS

test('flags an accent border and an accent ring on a resting card', () => {
  assert.equal(scanCss('.card{border:1px solid hsl(var(--primary))}', 'x.css').length, 1);
  assert.equal(scanCss('.card{box-shadow:0 0 0 1px hsl(var(--primary)/.2)}', 'x.css').length, 1);
  assert.equal(scanCss('.card{box-shadow:inset 0 0 0 1px var(--green)}', 'x.css').length, 1);
  assert.equal(scanCss('.card{outline:2px solid var(--ring)}', 'x.css').length, 1);
});

test('passes states, keyframes, drop shadows, foreground colours and filled controls', () => {
  assert.deepEqual(scanCss('.card:hover{border:1px solid hsl(var(--primary))}', 'x.css'), []);
  assert.deepEqual(scanCss('.x.is-on{border:1px solid hsl(var(--primary))}', 'x.css'), []);
  assert.deepEqual(
    scanCss('@keyframes pulse{0%{box-shadow:0 0 0 0 hsl(var(--primary))}100%{box-shadow:0 0 0 8px hsl(var(--primary)/0)}}', 'x.css'),
    [],
  );
  assert.deepEqual(scanCss('.card{box-shadow:0 2px 8px hsl(var(--primary))}', 'x.css'), []);
  assert.deepEqual(scanCss('.card{border:2px solid hsl(var(--primary-foreground))}', 'x.css'), []);
  assert.deepEqual(scanCss('.b{background:hsl(var(--primary));border:1px solid hsl(var(--primary))}', 'x.css'), []);
  assert.deepEqual(scanCss('.x[aria-pressed="true"]{border-color:var(--green)}', 'x.css'), []);
  assert.deepEqual(scanCss('.chip--selected{border-color:var(--green)}', 'x.css'), []);
  assert.deepEqual(scanCss('.p{border:1px solid hsl(var(--primary))}', 'x.css', new Set(['.p'])), []);
});

test('a wash that is not full strength does not make a filled control', () => {
  assert.equal(scanCss('.b{background:hsl(var(--primary)/.1);border:1px solid hsl(var(--primary))}', 'x.css').length, 1);
});

test('a negated state is still the rest state', () => {
  assert.equal(scanCss('.b:not(:disabled){border:1px solid hsl(var(--primary))}', 'x.css').length, 1);
});

test('tests each selector part on its own', () => {
  const hits = scanCss('.a, .a:hover{border:1px solid var(--green)}', 'x.css');
  assert.deepEqual(hits.map((h) => h.part), ['.a']);
});

test('theme and accessibility attributes are not states', () => {
  assert.equal(scanCss('[data-theme="dark"] .card{border-color:var(--green)}', 'x.css').length, 1);
  assert.equal(scanCss('html[data-a11y-contrast="high"] .card{border-color:var(--green)}', 'x.css').length, 1);
});

test('reports the line of the declaration and the no-script accent variables in index.html only', () => {
  const hits = scanCss('/* a\n comment */\n.badge {\n  color: red;\n  border: 1px solid var(--pine);\n}', INDEX_HTML);
  assert.deepEqual(hits.map((h) => h.line), [5]);
  assert.deepEqual(scanCss('.badge{border:1px solid var(--pine)}', 'x.css'), []);
});

// ---------------------------------------------------------------------------
// The live tree

const scope = scanScope();

test('the scan reads the stylesheets, the docs site literals and the shell page', () => {
  assert.ok(scope.files.length > 100, `only ${scope.files.length} files in scope`);
  assert.ok(scope.files.includes(BUTTONS_CSS));
});

test('every primary button on the alias list clears as a filled control', () => {
  const aliases = fillAliasList();
  for (const part of ['.btn--primary', '.modal .modal-primary', '.profile-view .profile-btn-primary',
    '.cropper-btn--primary', '.projects-render.btn', '.fc-frames-empty-add']) {
    assert.ok(aliases.has(part), `${part} is no longer on the primary alias list in ${BUTTONS_CSS}`);
  }
});

test('the filled primary buttons clear as filled controls, except .rt-run', () => {
  const raw = scanScope(false).hits;
  const filled = ['.btn--primary', '.modal .modal-primary', '.profile-view .profile-btn-primary',
    '.cropper-btn--primary', '.projects-render.btn', '.rt-run', '.fc-frames-empty-add',
    '.embed-editor-actions .ee-apply', '.nojs-btn--primary'];
  for (const part of filled) {
    assert.ok(raw.some((h) => h.part === part), `${part} no longer draws an accent border; update this list`);
    const cleared = !scope.hits.some((h) => h.part === part);
    assert.equal(cleared, part !== '.rt-run', `${part} ${cleared ? 'now clears' : 'no longer clears'} as a filled control`);
  }
});

test('no accent outline at rest outside ALLOWED', () => {
  const unexplained = scope.hits.filter((hit) => !ALLOWED.some(isAllowed(hit)));
  assert.equal(
    unexplained.length,
    0,
    `${unexplained.map((h) => `${h.file}:${h.line}  ${h.part}  ${h.decl}`).join('\n')}\n\n${FAILURE_HELP}`,
  );
});

test('every ALLOWED entry still matches an accent outline at rest', () => {
  const stale = ALLOWED.filter((a) => !scope.hits.some((hit) => isAllowed(hit)(a)));
  assert.deepEqual(
    stale.map((a) => `${a.file}  ${a.selector}`),
    [],
    'These entries match nothing any more; delete them from ALLOWED so the list stays true.',
  );
});

test('every ALLOWED reason says why in more than 40 characters', () => {
  const thin = ALLOWED.filter((a) => a.reason.trim().length <= 40);
  assert.deepEqual(thin.map((a) => `${a.file}  ${a.selector}`), [], 'Give each of these a real reason.');
  const dupes = ALLOWED.filter((a, i) => ALLOWED.findIndex((b) => b.file === a.file && norm(b.selector) === norm(a.selector)) !== i);
  assert.deepEqual(dupes.map((a) => `${a.file}  ${a.selector}`), [], 'Each entry should be listed once.');
});

test('the four cases Andy named wear a neutral outline at rest', () => {
  const named: Record<string, string> = {
    '.persona-pane': `${PARTS}docs-landing.css`,
    '.welcome-card--brand': `${PARTS}welcome.css`,
    '.profile-link-avatar': `${PARTS}components.css`,
    '.nojs-badge': INDEX_HTML,
  };
  for (const [name, file] of Object.entries(named)) {
    const token = new RegExp(`${name.replace('.', '\\.')}(?![\\w-])`);
    assert.match(readFileSync(join(ROOT, file), 'utf-8'), token, `${name} is no longer in ${file}; update this test`);
    const found = scope.hits.filter((h) => token.test(h.part) && !isStatePart(h.part));
    assert.deepEqual(found, [], `${name} has an accent outline at rest`);
    assert.ok(!ALLOWED.some((a) => token.test(a.selector)), `${name} must not be on ALLOWED`);
  }
});

test('the candy Ask button keeps its accent edge', () => {
  assert.ok(ALLOWED.some((a) => a.file === 'shells/web/src/styles/parts/ask.css' && a.selector === '.ask-send'));
});
