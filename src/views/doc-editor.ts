// SPDX-License-Identifier: MPL-2.0
// doc-editor.ts - the TipTap (ProseMirror) rich-document editor for Doc Studio
// (render.layout:'document'). Lazy-imported only for document-layout tools, so the
// gallery and every other tool stay lean.
//
// WHY TipTap: a real word-processor editing model - ONE contenteditable over the whole
// document, so selection/delete crosses paragraphs, tables, lists and images freely, and
// tables/lists/inline images are first-class nodes. The custom per-block editor could not
// do cross-content selection; ProseMirror does it natively.
//
// HOW IT STAYS LOLLY-NATIVE: the document is stored as portable ProseMirror JSON in the
// tool input (id 'content'), so URL state, saved sessions and the runtime survive. The
// EDITOR owns the on-screen editing surface (a scrolling, page-width document); the ENGINE
// hook (tools/doc-studio/hooks.js) renders that SAME JSON → paginated [data-pdf-page] pages
// into #tool-canvas underneath, which is what export / CLI / OG-previews rasterise. Editing
// is continuous (Notion-style); pages appear in the exported PDF. Everything is offline - 
// TipTap/ProseMirror are pure JS, no network.

import { Editor, Extension } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import DOMPurify from 'dompurify';
import { PageBreak, mountPageGuides } from './doc-pages.ts';
import { looksLikeMarkdown, mdToHtml } from '../lib/markdown.ts';
import { mountColorField } from '../components/color-field.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';

// Border / padding presets (shared by the DocTable decoration and the table-bar cycle).
const TABLE_BORDERS = ['grid', 'rows', 'none'];
const TABLE_PADS = ['tight', 'normal', 'roomy'];

interface Runtime {
  getModel(): { id: string; value: unknown }[];
  setInput(id: string, value: unknown): void | Promise<void>;
  setInputNoHistory?(id: string, value: unknown): void | Promise<void>;
}
interface InputSpec { id: string; type?: string; label?: string; group?: string; default?: unknown; options?: { value: string; label?: string; width?: number; height?: number; unit?: string }[]; }
interface DocEditorOpts {
  viewEl: HTMLElement & { _cleanup?: () => void };
  stageEl: HTMLElement;
  canvasEl: HTMLElement;
  runtime: Runtime;
  host: { assets?: { pick?: (o: unknown) => Promise<{ url?: string } | null> } };
  input: InputSpec;
  inputs: InputSpec[];
  onDirty?: (id: string) => void;
  setCanvasSize?: (w: number, h: number, unit?: string) => void;
  editTool?: (url: string, mode?: string) => void;
  history?: { register: (sync: (u: boolean, r: boolean) => void) => void };
  actions?: { export?: () => void; save?: () => void; canSave?: boolean; dirtyRef?: HTMLElement | null };
}

// Map a manifest face name → a CSS font stack the FontFamily mark stores.
const FONT_STACK: Record<string, string> = {
  SUSE: "'SUSE', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  'SUSE Mono': "'SUSE Mono', ui-monospace, SFMono-Regular, monospace",
};

// Block-level typography - line-height and letter-spacing as attributes on paragraph
// and heading nodes (the correct model for a document: both are per-paragraph settings,
// not inline marks). renderHTML emits them as inline style so the on-screen editor shows
// them live; the export hook (tools/doc-studio/hooks.js `blockStyle`) reads the same attrs
// off the stored ProseMirror JSON, so the paginated PDF/HTML matches.
const BlockTypography = Extension.create({
  name: 'blockTypography',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
          renderHTML: (attrs: { lineHeight?: string | null }) =>
            attrs.lineHeight ? { style: `line-height:${attrs.lineHeight}` } : {},
        },
        letterSpacing: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.letterSpacing || null,
          renderHTML: (attrs: { letterSpacing?: string | null }) =>
            attrs.letterSpacing ? { style: `letter-spacing:${attrs.letterSpacing}` } : {},
        },
      },
    }];
  },
});

const IC = {
  bold: 'B', italic: '<i>I</i>', under: '<u>U</u>', strike: '<s>S</s>',
  ul: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>',
  ol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="1.5" y="8" font-size="7" fill="currentColor" stroke="none">1</text><text x="1.5" y="14.5" font-size="7" fill="currentColor" stroke="none">2</text><text x="1.5" y="21" font-size="7" fill="currentColor" stroke="none">3</text></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5H3v7h4c0 4-4 4-4 4zM14 21c3 0 7-1 7-8V5h-7v7h4c0 4-4 4-4 4z"/></svg>',
  alignL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="17" x2="18" y2="17"/></svg>',
  alignC: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="17" x2="19" y2="17"/></svg>',
  alignR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="6" y1="17" x2="20" y2="17"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 7 8 19"/><path d="m14 7 1 6"/><path d="m18 4-14 16"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  rowAbove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="18" height="9" rx="1"/><path d="M12 3v6M9 6h6"/></svg>',
  rowBelow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="9" rx="1"/><path d="M12 15v6M9 18h6"/></svg>',
  colRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="9" height="18" rx="1"/><path d="M15 12h6M18 9v6"/></svg>',
  delRow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M9 4h6M9 20h6"/></svg>',
  delCol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="18" rx="1"/><path d="M4 9v6M20 9v6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
};

const STYLE_OPTS = [
  { value: 'p', label: 'Body text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
];

// A fallback starter document if the input is empty. Kept in sync with the hook's
// STARTER (tools/doc-studio/hooks.js) so a fresh doc matches editor ⇄ export/preview.
const STARTER = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Your document title' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Welcome to ' },
      { type: 'text', marks: [{ type: 'bold' }], text: 'Doc Studio' },
      { type: 'text', text: ' - a real word processor. Select and delete across anything, and insert tables, lists and images inline.' },
    ] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Write the way you think' }] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Paste rich text - bold, italics, lists and tables keep their shape' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Insert a Lolly render (a QR code, a chart, a map) inline' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Headings 1 to 4, SUSE or SUSE Mono, export to PDF' }] }] },
    ] },
  ],
};

// A resizable image. Adds a `width` attribute (a CSS width like "62%", persisted in the
// document JSON) and a NodeView with a corner handle to drag-resize on the canvas. Width
// is a PERCENTAGE of the text column, so it survives page-size changes and matches the
// hook's exported <img> (which sets the same width) exactly.
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(this as any).parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.width || el.getAttribute('width') || null,
        renderHTML: (attrs: { width?: string | null }) => (attrs.width ? { style: `width:${attrs.width}` } : {}),
      },
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ({ node, editor, getPos }: any) => {
      const wrap = document.createElement('span');
      wrap.className = 'doc-img-wrap';
      const img = document.createElement('img');
      img.src = node.attrs.src; img.alt = node.attrs.alt || '';
      if (node.attrs.width) wrap.style.width = node.attrs.width;
      const handle = document.createElement('span');
      handle.className = 'doc-img-handle'; handle.contentEditable = 'false';
      wrap.append(img, handle);

      let startX = 0, startW = 0, contW = 1, dragging = false;
      const onMove = (e: PointerEvent): void => {
        if (!dragging) return;
        const pct = Math.max(8, Math.min(100, ((startW + (e.clientX - startX)) / contW) * 100));
        wrap.style.width = pct.toFixed(1) + '%';
      };
      const onUp = (): void => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (typeof pos === 'number') {
          const cur = editor.state.doc.nodeAt(pos);
          if (cur) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...cur.attrs, width: wrap.style.width }));
        }
      };
      handle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        dragging = true;
        startX = e.clientX; startW = img.offsetWidth;
        contW = (editor.view.dom as HTMLElement).clientWidth || img.offsetWidth || 1;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      return {
        dom: wrap,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: (updated: any) => {
          if (updated.type.name !== 'image') return false;
          img.src = updated.attrs.src; img.alt = updated.attrs.alt || '';
          wrap.style.width = updated.attrs.width || '';
          return true;
        },
        ignoreMutation: () => true,  // leaf image: PM never reads content back from our DOM
        destroy: () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); },
      };
    };
  },
});

// Table cell fill: a backgroundColor attribute, set on the current cell-selection via the
// setCellAttribute command (so it applies across a multi-cell shift-click / drag range).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CELL_BG: any = {
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-bg') || el.style.backgroundColor || null,
    renderHTML: (attrs: { backgroundColor?: string | null }) =>
      (attrs.backgroundColor ? { 'data-bg': attrs.backgroundColor, style: `background-color:${attrs.backgroundColor}` } : {}),
  },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DocTableCell = TableCell.extend({ addAttributes() { return { ...(this as any).parent?.(), ...CELL_BG }; } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DocTableHeader = TableHeader.extend({ addAttributes() { return { ...(this as any).parent?.(), ...CELL_BG }; } });
// Table-level border + padding presets. Kept whole-table (not per-cell) so the vector
// export stays clean - arbitrary per-cell borders would double-draw at the grid seams.
const DocTable = Table.extend({
  addAttributes() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(this as any).parent?.(),
      border: { default: 'grid', parseHTML: (el: HTMLElement) => el.getAttribute('data-border') || 'grid', renderHTML: (a: { border?: string }) => ({ 'data-border': a.border || 'grid' }) },
      pad: { default: 'normal', parseHTML: (el: HTMLElement) => el.getAttribute('data-pad') || 'normal', renderHTML: (a: { pad?: string }) => ({ 'data-pad': a.pad || 'normal' }) },
    };
  },
  // With resizable:true the table's DOM is owned by prosemirror-tables' TableView, which
  // ignores the border/pad renderHTML attrs - so styling the live editor from those attrs
  // needs a node DECORATION (decorations DO apply over a custom node view). Stamp the
  // preset classes onto each table's node-view DOM so the editor matches the export.
  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = (this as any).parent?.() ?? [];
    const plugin = new Plugin({
      props: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decorations: (state: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const decos: any[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.doc.descendants((node: any, pos: number) => {
            if (node.type.name !== 'table') return;
            const b = TABLE_BORDERS.includes(node.attrs.border) ? node.attrs.border : 'grid';
            const p = TABLE_PADS.includes(node.attrs.pad) ? node.attrs.pad : 'normal';
            decos.push(Decoration.node(pos, pos + node.nodeSize, { class: `doc-tb-${b} doc-pad-${p}` }));
            return false;   // don't descend into the table
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    });
    return [...parent, plugin];
  },
});

export function initDocEditor(opts: DocEditorOpts): { destroy(): void } {
  const { stageEl, runtime, host, input } = opts;
  const inputId = input.id;
  const doc = document;
  const cleanups: (() => void)[] = [];
  const el = (tag: string, cls?: string, html?: string): HTMLElement => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const btn = (cls: string, html: string, title: string): HTMLButtonElement => {
    const b = el('button', cls, html) as HTMLButtonElement;
    b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    return b;
  };
  const on = (t: EventTarget, ev: string, fn: (e: Event) => void, o?: AddEventListenerOptions): void => {
    t.addEventListener(ev, fn as EventListener, o);
    cleanups.push(() => t.removeEventListener(ev, fn as EventListener, o));
  };

  // ── load the doc JSON from the input (or the starter) ────────────────────────
  const readDoc = (): object => {
    const v = runtime.getModel().find((m) => m.id === inputId)?.value;
    if (v && typeof v === 'object') return v as object;
    if (typeof v === 'string' && v.trim()) { try { return JSON.parse(v); } catch { /* fall through */ } }
    return STARTER;
  };

  // ── the editing surface: a scrolling, page-width light document over the stage ─
  const surface = el('div', 'doc-tt-surface');
  surface.setAttribute('data-export-hide', '');
  const paper = el('div', 'doc-tt-paper');
  const holder = el('div', 'doc-tt-holder');   // TipTap mounts here
  holder.setAttribute('aria-label', 'Document body');
  paper.appendChild(holder);
  surface.appendChild(paper);

  // ── the editor ────────────────────────────────────────────────────────────────
  const editor = new Editor({
    element: holder,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      TextStyleKit,
      BlockTypography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      DocTable.configure({ resizable: true }),
      TableRow,
      DocTableHeader,
      DocTableCell,
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      PageBreak,
    ],
    content: readDoc(),
    autofocus: 'end',
    editorProps: {
      // TipTap already stamps role="textbox" on the editable (@tiptap/core createView) - 
      // do NOT add a second one. What it does not give the textbox is a NAME: the
      // aria-label on .doc-tt-holder is invisible to AT because the wrapper is not the
      // focusable element, so the name goes on the editable itself.
      attributes: { 'aria-label': 'Document body' },
      // Paste raw Markdown → fully-formatted nodes. If the clipboard's HTML carries real
      // block STRUCTURE (Word / Docs / a web page - tables, lists, headings), let
      // ProseMirror parse that (richer). But code editors (VS Code) and browsers attach an
      // HTML copy that is only styled <span>s of the SAME literal Markdown; there we prefer
      // converting the Markdown so '# ', '- ', '| … |' land formatted, not literal.
      handlePaste(_view, event) {
        const cd = event.clipboardData;
        if (!cd) return false;
        const html = cd.getData('text/html');
        if (/<(table|thead|tbody|tr|td|th|ul|ol|li|h[1-6]|blockquote|pre)\b/i.test(html)) return false;
        const text = cd.getData('text/plain');
        if (!text || !looksLikeMarkdown(text)) return false;
        const clean = DOMPurify.sanitize(mdToHtml(text));
        // insertContent runs the HTML through the editor schema, so anything the schema
        // can't hold (h5/6, task lists) is normalised away; onUpdate then commits.
        editor.chain().focus().deleteSelection().insertContent(clean, { parseOptions: { preserveWhitespace: false } }).run();
        return true;
      },
    },
    onUpdate: () => scheduleCommit(),
    // onTransaction is a strict superset of onSelectionUpdate - TipTap emits
    // "transaction" for every applied root transaction (selection moves included),
    // so a single handler here fires refresh() once per interaction, not twice.
    onTransaction: () => refresh(),
  });

  // ── persist: debounce the JSON commit so we don't hammer setInput per keystroke.
  // TipTap owns fine-grained undo (Cmd+Z inside the editor); the runtime commit is for
  // URL state + saved sessions, so a coarse per-pause snapshot is right.
  let commitTimer = 0;
  const commitNow = (): void => {
    commitTimer = 0;
    opts.onDirty?.(inputId);
    const write = runtime.setInputNoHistory ?? runtime.setInput;
    write.call(runtime, inputId, JSON.stringify(editor.getJSON()));
  };
  const scheduleCommit = (): void => {
    if (commitTimer) window.clearTimeout(commitTimer);
    commitTimer = window.setTimeout(commitNow, 500);
  };
  const flushCommit = (): void => { if (commitTimer) { window.clearTimeout(commitTimer); commitNow(); } };

  // ── chrome: format ribbon (top) ──────────────────────────────────────────────
  const ribbonDock = el('div', 'doc-ribbon-dock');
  ribbonDock.setAttribute('data-export-hide', '');
  const ribbon = el('div', 'doc-ribbon');
  ribbonDock.appendChild(ribbon);

  const styleSel = el('select', 'doc-style-select field-select field-select--sm field-select--auto') as HTMLSelectElement;
  styleSel.title = 'Paragraph style'; styleSel.setAttribute('aria-label', 'Paragraph style');
  STYLE_OPTS.forEach((o) => { const op = doc.createElement('option'); op.value = o.value; op.textContent = o.label; styleSel.appendChild(op); });
  const fontSel = el('select', 'doc-font-select field-select field-select--sm field-select--auto') as HTMLSelectElement;
  fontSel.title = 'Font'; fontSel.setAttribute('aria-label', 'Font');
  [['', 'Document font'], ['SUSE', 'SUSE'], ['SUSE Mono', 'SUSE Mono']].forEach(([v, l]) => { const op = doc.createElement('option'); op.value = v!; op.textContent = l!; fontSel.appendChild(op); });
  // Line height + letter spacing - block-level typographic controls (applied to the
  // selected paragraph/heading via the BlockTypography extension). Empty value = default.
  const lhSel = el('select', 'doc-lh-select field-select field-select--sm field-select--auto') as HTMLSelectElement;
  lhSel.title = 'Line height'; lhSel.setAttribute('aria-label', 'Line height');
  [['', 'Line height'], ['1', 'Single'], ['1.15', 'Snug'], ['1.4', 'Normal'], ['1.6', 'Relaxed'], ['2', 'Double']].forEach(([v, l]) => { const op = doc.createElement('option'); op.value = v!; op.textContent = l!; lhSel.appendChild(op); });
  const lsSel = el('select', 'doc-ls-select field-select field-select--sm field-select--auto') as HTMLSelectElement;
  lsSel.title = 'Letter spacing'; lsSel.setAttribute('aria-label', 'Letter spacing');
  [['', 'Letter spacing'], ['-0.03em', 'Tight'], ['0em', 'Normal'], ['0.03em', 'Wide'], ['0.06em', 'Wider']].forEach(([v, l]) => { const op = doc.createElement('option'); op.value = v!; op.textContent = l!; lsSel.appendChild(op); });

  const bBold = btn('fc-cbtn', '<b>B</b>', 'Bold  (⌘B)');
  const bItal = btn('fc-cbtn', IC.italic, 'Italic  (⌘I)');
  const bUnder = btn('fc-cbtn', IC.under, 'Underline  (⌘U)');
  const bStrike = btn('fc-cbtn', IC.strike, 'Strikethrough');
  const bUl = btn('fc-cbtn', IC.ul, 'Bulleted list');
  const bOl = btn('fc-cbtn', IC.ol, 'Numbered list');
  const bQuote = btn('fc-cbtn', IC.quote, 'Quote');
  // Text colour: our own picker, mounted invisibly over the button (the visible
  // face is the ::after "A"). No focus() on apply - the popover is in-page, so
  // stealing focus would break a slider drag; ProseMirror keeps its selection
  // while blurred, so setColor still lands on the right run.
  const colorWrap = el('span', 'fc-cbtn doc-color');
  colorWrap.title = 'Text colour'; colorWrap.style.setProperty('--sw', '#30ba78');
  mountColorField(colorWrap, 'doc-textcolor', {
    value: '#30ba78', float: true,
    onChange: (v) => { colorWrap.style.setProperty('--sw', v); editor.chain().setColor(v).run(); },
  });
  const bClear = btn('fc-cbtn', IC.clear, 'Clear formatting');
  const bAlignL = btn('fc-cbtn', IC.alignL, 'Align left');
  const bAlignC = btn('fc-cbtn', IC.alignC, 'Align centre');
  const bAlignR = btn('fc-cbtn', IC.alignR, 'Align right');
  // Toggle buttons report their state to assistive tech (kept in sync by setOn / refresh).
  [bBold, bItal, bUnder, bStrike, bUl, bOl, bQuote, bAlignL, bAlignC, bAlignR].forEach((b) => b.setAttribute('aria-pressed', 'false'));
  const bTable = btn('fc-cbtn', IC.table, 'Insert table');
  const bImage = btn('fc-cbtn', IC.image, 'Insert image / Lolly');
  const bPageBreak = btn('fc-cbtn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v4"/><path d="M6 21h12v-6"/><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2.5 2.5"/></svg>', 'Insert page break');

  // The shared registry glyph, not another inline SVG (primitive-guards R3).
  const bImportDocx = btn('fc-cbtn', icon('document'), t('Import Word doc'));
  // Hidden input lives inside the ribbon, so destroy()'s ribbonDock.remove() takes it.
  const docxInput = doc.createElement('input');
  docxInput.type = 'file';
  docxInput.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  docxInput.hidden = true;

  const sep = (): HTMLElement => el('span', 'fc-sep-v');
  ribbon.append(styleSel, fontSel, sep(), bBold, bItal, bUnder, bStrike, colorWrap, bClear, sep(),
    bUl, bOl, bQuote, bAlignL, bAlignC, bAlignR, sep(), lhSel, lsSel, sep(), bTable, bImage, bPageBreak,
    sep(), bImportDocx, docxInput);

  // A second row of TABLE controls, shown only when the caret is inside a table.
  const tbar = el('div', 'doc-ribbon doc-tablebar');
  const bRowAbove = btn('fc-cbtn', IC.rowAbove, 'Row above');
  const bRowBelow = btn('fc-cbtn', IC.rowBelow, 'Row below');
  const bColRight = btn('fc-cbtn', IC.colRight, 'Column right');
  const bDelRow = btn('fc-cbtn', IC.delRow, 'Delete row');
  const bDelCol = btn('fc-cbtn', IC.delCol, 'Delete column');
  const bTblHead = btn('fc-cbtn', 'H', 'Toggle header row');
  // Cell fill - applies to the whole current cell selection (shift-click / drag a range).
  const fillWrap = el('span', 'fc-cbtn doc-color doc-cellfill');
  fillWrap.title = 'Cell fill'; fillWrap.style.setProperty('--sw', '#e8f6ee');
  mountColorField(fillWrap, 'doc-cellfill', {
    value: '#e8f6ee', float: true,
    // setCellAttribute lands on the whole CellSelection, preserved while blurred.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (v) => { fillWrap.style.setProperty('--sw', v); (editor.chain() as any).setCellAttribute('backgroundColor', v).run(); },
  });
  const bFillClear = btn('fc-cbtn', IC.clear, 'Clear cell fill');
  const bBorder = btn('fc-cbtn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>', 'Border: grid / rows / none');
  const bPad = btn('fc-cbtn', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>', 'Cell padding: tight / normal / roomy');
  const bDelTable = btn('fc-cbtn fc-danger', IC.trash, 'Delete table');
  tbar.append(bRowAbove, bRowBelow, sep(), bColRight, bDelCol, sep(), bDelRow, sep(),
    bTblHead, fillWrap, bFillClear, bBorder, bPad, sep(), bDelTable);
  const tbarDock = el('div', 'doc-ribbon-dock doc-tablebar-dock');
  tbarDock.setAttribute('data-export-hide', '');
  tbarDock.appendChild(tbar);

  // Keep the editor focused when a ribbon BUTTON is pressed (so selection survives).
  const keepFocus = (e: Event): void => {
    const t = e.target as HTMLElement;
    if (t.closest('button') && t.tagName !== 'INPUT' && t.tagName !== 'SELECT') e.preventDefault();
  };
  on(ribbon, 'pointerdown', keepFocus);
  on(tbar, 'pointerdown', keepFocus);

  const chain = () => editor.chain().focus();
  on(bBold, 'click', () => chain().toggleBold().run());
  on(bItal, 'click', () => chain().toggleItalic().run());
  on(bUnder, 'click', () => chain().toggleUnderline().run());
  on(bStrike, 'click', () => chain().toggleStrike().run());
  on(bUl, 'click', () => chain().toggleBulletList().run());
  on(bOl, 'click', () => chain().toggleOrderedList().run());
  on(bQuote, 'click', () => chain().toggleBlockquote().run());
  on(bClear, 'click', () => chain().unsetAllMarks().clearNodes().run());
  on(bAlignL, 'click', () => chain().setTextAlign('left').run());
  on(bAlignC, 'click', () => chain().setTextAlign('center').run());
  on(bAlignR, 'click', () => chain().setTextAlign('right').run());
  on(styleSel, 'change', () => {
    const v = styleSel.value;
    if (v === 'p') chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 }).run();
  });
  on(fontSel, 'change', () => {
    const stack = FONT_STACK[fontSel.value];
    if (stack) chain().setFontFamily(stack).run();
    else chain().unsetFontFamily().run();
  });
  // Line height / letter spacing apply to the current paragraph OR heading - chaining both
  // updateAttributes covers whichever the selection sits in (the other is a no-op). Empty → clear.
  on(lhSel, 'change', () => {
    const v = lhSel.value || null;
    chain().updateAttributes('paragraph', { lineHeight: v }).updateAttributes('heading', { lineHeight: v }).run();
  });
  on(lsSel, 'change', () => {
    const v = lsSel.value || null;
    chain().updateAttributes('paragraph', { letterSpacing: v }).updateAttributes('heading', { letterSpacing: v }).run();
  });

  // Table insert + in-table controls.
  on(bTable, 'click', () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
  on(bRowAbove, 'click', () => chain().addRowBefore().run());
  on(bRowBelow, 'click', () => chain().addRowAfter().run());
  on(bColRight, 'click', () => chain().addColumnAfter().run());
  on(bDelRow, 'click', () => chain().deleteRow().run());
  on(bDelCol, 'click', () => chain().deleteColumn().run());
  on(bTblHead, 'click', () => chain().toggleHeaderRow().run());
  on(bDelTable, 'click', () => chain().deleteTable().run());
  // Cell fill over the whole cell selection; clear resets it. setCellAttribute applies to
  // every cell in the current CellSelection (a shift-click / drag range), so multi-cell fill
  // "just works".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setCellAttr = (name: string, value: unknown): void => { (chain() as any).setCellAttribute(name, value).run(); };
  on(bFillClear, 'click', () => setCellAttr('backgroundColor', null));
  // Border + padding are whole-table presets cycled on each click.
  const cycleTableAttr = (name: string, order: string[], cur: unknown): void => {
    const i = order.indexOf(String(cur));
    chain().updateAttributes('table', { [name]: order[(i + 1) % order.length] }).run();
  };
  on(bBorder, 'click', () => cycleTableAttr('border', TABLE_BORDERS, editor.getAttributes('table').border ?? 'grid'));
  on(bPad, 'click', () => cycleTableAttr('pad', TABLE_PADS, editor.getAttributes('table').pad ?? 'normal'));

  // Image / Lolly insert via the host picker (Library / Tools tab / paste-a-link / upload).
  on(bImage, 'click', async () => {
    const pick = host.assets?.pick;
    if (!pick) return;
    const ref = await pick({ title: 'Insert an image or Lolly', type: 'image', allowUpload: true, editTool: opts.editTool }).catch(() => null);
    const url = ref?.url;
    if (url) editor.chain().focus().setImage({ src: url }).run();
  });

  // Insert an explicit page break (the export hook starts a fresh page on it).
  on(bPageBreak, 'click', () => chain().insertContent({ type: 'pageBreak' }).run());

  // Import a Word document (plans/139): docx-read → the engine's HTML projection →
  // the editor, in ONE chained transaction so a single undo takes the import back.
  // Images arrive as data URLs, memoised per part and budgeted inside docxToHtml.
  // The sanitise is the same belt-and-braces pass the Markdown paste path runs.
  on(bImportDocx, 'click', () => docxInput.click());
  on(docxInput, 'change', () => {
    const file = (docxInput.files ?? [])[0];
    docxInput.value = '';   // re-picking the same file must fire `change` again
    if (!file) return;
    void (async () => {
      try {
        const { docxToHtml } = await import('../lib/office-text.ts');
        const { html, dropped, sourceAuthor } = await docxToHtml(new Uint8Array(await file.arrayBuffer()));
        editor.chain().focus().setContent(DOMPurify.sanitize(html)).run();
        // The source document's own author → the tool's sourceAuthor input, so
        // the re-export credits both authors when they differ (plans/144 G6).
        if (sourceAuthor) { try { void runtime.setInput('sourceAuthor', sourceAuthor); } catch { /* older manifest without the input */ } }
        if (dropped) announce(t('Some images in that document could not be imported.'));
      } catch (e) {
        announce((e as Error)?.message || t('Could not read that Word document.'), { assertive: true });
      }
    })();
  });

  // ── left rail (Undo/Redo · Export · Save · Page setup) ────────────────────────
  const dock = el('div', 'fc-toolbar-dock');
  dock.setAttribute('data-export-hide', '');
  const rail = el('div', 'fc-toolbar');
  dock.appendChild(rail);
  const bUndo = btn('fc-btn', IC.undo, 'Undo  (⌘Z)');
  const bRedo = btn('fc-btn', IC.redo, 'Redo  (⌘⇧Z)');
  const bExport = btn('fc-btn fc-action fc-action-primary', IC.export, 'Export / download');
  const bSave = btn('fc-btn fc-action fc-action-save', IC.save, 'Save');
  const bSetup = btn('fc-btn', IC.gear, 'Page setup');
  rail.append(bUndo, bRedo, el('span', 'fc-sep'), bExport, ...(opts.actions?.canSave ? [bSave] : []), el('span', 'fc-sep'), bSetup);
  on(bUndo, 'click', () => editor.chain().focus().undo().run());
  on(bRedo, 'click', () => editor.chain().focus().redo().run());
  on(bExport, 'click', () => { flushCommit(); opts.actions?.export?.(); });
  on(bSave, 'click', () => { flushCommit(); opts.actions?.save?.(); });
  opts.history?.register((_u, _r) => { /* TipTap owns undo; rail buttons stay enabled */ });
  const dirtyRef = opts.actions?.dirtyRef;
  if (dirtyRef) {
    const syncSave = (): void => { bSave.classList.toggle('is-unsaved', dirtyRef.classList.contains('is-unsaved')); };
    const mo = new MutationObserver(syncSave); mo.observe(dirtyRef, { attributes: true, attributeFilter: ['class'] });
    cleanups.push(() => mo.disconnect()); syncSave();
  }

  // ── page setup panel (from the tool's non-blocks, non-export top inputs) ───────
  let openPop: HTMLElement | null = null;
  const closePop = (): void => { openPop?.remove(); openPop = null; };
  const setupInputs = opts.inputs.filter((i) => i.id !== inputId && i.group !== 'export' && i.type !== 'blocks');
  on(bSetup, 'click', () => {
    if (openPop) { closePop(); return; }
    const pop = el('div', 'fc-panel'); pop.setAttribute('data-export-hide', '');
    const head = el('div', 'fc-panel-head'); head.textContent = 'Page setup'; pop.appendChild(head);
    const model = runtime.getModel();
    const val = (id: string): unknown => model.find((m) => m.id === id)?.value;
    setupInputs.forEach((spec) => {
      // A colour row can't be a <label>: it would forward clicks to the picker's
      // hidden native <input type=color> and pop the OS picker. Use a div.
      const row = el(spec.type === 'color' ? 'div' : 'label', 'doc-setup-row');
      row.appendChild(el('span', undefined, spec.label || spec.id));
      let ctrl: HTMLElement;
      if (spec.type === 'select') {
        const s = doc.createElement('select');
        s.className = 'field-select field-select--sm';
        (spec.options || []).forEach((o) => { const op = doc.createElement('option'); op.value = o.value; op.textContent = o.label || o.value; s.appendChild(op); });
        s.value = String(val(spec.id) ?? spec.default ?? '');
        on(s, 'change', () => { runtime.setInput(spec.id, s.value); const o = (spec.options || []).find((x) => x.value === s.value); if (o?.width && o?.height) opts.setCanvasSize?.(o.width, o.height, o.unit || 'mm'); });
        ctrl = s;
      } else if (spec.type === 'color') {
        ctrl = el('span', 'doc-setup-color');
        mountColorField(ctrl, `doc-setup-${spec.id}`, {
          value: String(val(spec.id) ?? spec.default ?? '#30ba78'), float: true,
          onChange: (v) => runtime.setInput(spec.id, v),
        });
      } else if (spec.type === 'boolean') {
        const c = doc.createElement('input'); c.type = 'checkbox'; c.className = 'field-check'; c.checked = val(spec.id) !== false;
        on(c, 'change', () => runtime.setInput(spec.id, c.checked)); ctrl = c;
      } else {
        const t = doc.createElement('input'); t.type = 'text'; t.className = 'field-input field-input--sm'; t.value = String(val(spec.id) ?? spec.default ?? '');
        on(t, 'input', () => runtime.setInput(spec.id, t.value)); ctrl = t;
      }
      row.appendChild(ctrl); pop.appendChild(row);
    });
    stageEl.appendChild(pop);
    const ar = bSetup.getBoundingClientRect(); const sr = stageEl.getBoundingClientRect();
    pop.style.left = (ar.right - sr.left + 8) + 'px'; pop.style.top = (ar.top - sr.top) + 'px';
    openPop = pop;
    const off = (e: Event): void => { if (openPop && !openPop.contains(e.target as Node) && !bSetup.contains(e.target as Node)) closePop(); };
    setTimeout(() => on(doc, 'pointerdown', off), 0);
  });

  // ── toolbar state sync ────────────────────────────────────────────────────────
  const setOn = (b: HTMLElement, v: boolean): void => { b.classList.toggle('is-on', v); b.setAttribute('aria-pressed', String(v)); };
  function refresh(): void {
    setOn(bBold, editor.isActive('bold'));
    setOn(bItal, editor.isActive('italic'));
    setOn(bUnder, editor.isActive('underline'));
    setOn(bStrike, editor.isActive('strike'));
    setOn(bUl, editor.isActive('bulletList'));
    setOn(bOl, editor.isActive('orderedList'));
    setOn(bQuote, editor.isActive('blockquote'));
    setOn(bAlignL, editor.isActive({ textAlign: 'left' }));
    setOn(bAlignC, editor.isActive({ textAlign: 'center' }));
    setOn(bAlignR, editor.isActive({ textAlign: 'right' }));
    styleSel.value = editor.isActive('heading', { level: 1 }) ? 'h1'
      : editor.isActive('heading', { level: 2 }) ? 'h2'
        : editor.isActive('heading', { level: 3 }) ? 'h3'
          : editor.isActive('heading', { level: 4 }) ? 'h4' : 'p';
    const fam = editor.getAttributes('textStyle').fontFamily as string | undefined;
    fontSel.value = fam ? (/mono/i.test(fam) ? 'SUSE Mono' : 'SUSE') : '';
    // Reflect the current block's line-height / letter-spacing (paragraph or heading).
    const lh = (editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight) as string | null;
    lhSel.value = lh != null ? String(lh) : '';
    const ls = (editor.getAttributes('paragraph').letterSpacing ?? editor.getAttributes('heading').letterSpacing) as string | null;
    lsSel.value = ls != null ? String(ls) : '';
    const inTable = editor.isActive('table');
    tbarDock.style.display = inTable ? '' : 'none';
  }

  // Mount chrome + surface. The surface sits over the stage; #tool-canvas underneath
  // still holds the hook-rendered pages (what export rasterises).
  stageEl.appendChild(surface);
  stageEl.appendChild(dock);
  stageEl.appendChild(ribbonDock);
  stageEl.appendChild(tbarDock);
  refresh();

  // Soft page-boundary guides - pages appear as content grows (infinite) and reset at any
  // explicit page break. The per-page content step is derived inside from the paper's real
  // margins, so pass the full native page height (from the height input → A4/Letter/A5).
  const nativeH = Number(runtime.getModel().find((m) => m.id === 'height')?.value)
    || Number(opts.inputs.find((i) => i.id === 'height')?.default) || 1123;
  mountPageGuides({ editor, stageEl, nativeH, cleanups });

  return {
    destroy(): void {
      flushCommit();
      try { editor.destroy(); } catch { /* ignore */ }
      closePop();
      cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
      surface.remove(); ribbonDock.remove(); dock.remove(); tbarDock.remove();
    },
  };
}
