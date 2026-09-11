// SPDX-License-Identifier: MPL-2.0
/**
 * On-canvas editing for paginated table tools (render.paginate) - the canvas as
 * a rich editor over the table input, which stays the single source of truth.
 *
 * A paginated tool's template opts a rendered cell into editing by stamping it
 * with its source address:
 *
 *     data-cell="<row>:<col>"   row = page.index, col = the cell's original
 *                               column index (page.cells/fields `col`)
 *     data-cell-md              present → the cell holds {{{markdown value}}}
 *                               output; edits serialise BACK to the markdown
 *                               subset. Absent → the cell edits as plain text.
 *     data-cell-empty           present → the visible content is a placeholder
 *                               (an em-dash), cleared on focus, restored when
 *                               the edit commits nothing.
 *
 * and can offer a click-to-pick image slot (e.g. a per-card icon):
 *
 *     data-cell-pick="<row>"    click opens the asset picker; the pick lands as
 *                               ![name](url) markdown in the named column
 *     data-pick-column="Icon"   column written to (case-insensitive match),
 *                               APPENDED to the table if absent
 *     data-pick-tag="icon"      optional catalog tag filter for the picker
 *
 * Commits ride runtime.setInput on the paginate source input - the exact path a
 * sidebar keystroke takes - so URL sync, undo history, dirty state and session
 * save all come for free, and the sidebar grid updates live. Commits happen on
 * blur (or Enter in a plain cell), never per keystroke: every commit repaints
 * the canvas, and a mid-edit repaint would eat the caret.
 *
 * WHY EDITS BAKE TO MARKDOWN IMMEDIATELY: there is deliberately no parallel
 * rich-text state. The table cell's markdown is what the sidebar shows, what
 * URL mode encodes, what the CLI renders, and what the table's Copy button
 * hands back to a spreadsheet - the canvas is only a friendlier way to write it.
 *
 * The serialiser is DOM-agnostic (nodeType/nodeName/nodeValue/childNodes/
 * getAttribute only), so node:test feeds it plain object trees - same pattern
 * as views/rich-text.ts.
 */
import type { TableValue } from '../../../../engine/src/inputs.js';

// ── HTML → markdown (the engine {{markdown}} helper's subset, inverted) ───────

/** The minimal node surface the serialiser touches - satisfied by DOM nodes and
 *  by the plain object trees the tests feed in. */
export interface CellNode {
  nodeType: number;
  nodeName?: string;
  nodeValue?: string | null;
  childNodes: ArrayLike<CellNode>;
  getAttribute?(name: string): string | null;
}

const TEXT = 3;
const ELEMENT = 1;

/** li class → the leading direction marker the engine parsed it from. */
const ARROW_MARKERS: Record<string, string> = {
  'md-arrow': '>', 'md-arrow-left': '<', 'md-arrow-up': '^', 'md-arrow-down': 'v',
};

const attr = (n: CellNode, name: string): string => n.getAttribute?.(name) ?? '';
const classTokens = (n: CellNode): string[] => attr(n, 'class').split(/\s+/).filter(Boolean);

/** Inline serialisation of a node's children. BR becomes a line break; block
 *  children encountered inline (contenteditable can nest anything) degrade to
 *  their inline content. */
function inline(node: CellNode): string {
  let out = '';
  for (let i = 0; i < node.childNodes.length; i++) {
    const c = node.childNodes[i]!;
    if (c.nodeType === TEXT) { out += (c.nodeValue ?? '').replace(/\u00a0/g, ' '); continue; }
    if (c.nodeType !== ELEMENT) continue;
    const name = (c.nodeName ?? '').toUpperCase();
    switch (name) {
      case 'BR': out += '\n'; break;
      case 'IMG': {
        const src = attr(c, 'src');
        // A source-less <img> serialises to nothing rather than broken syntax.
        if (src) out += `![${attr(c, 'alt').replace(/[[\]]/g, '')}](${src})`;
        break;
      }
      case 'A': {
        const href = attr(c, 'href');
        const label = inline(c);
        out += href && label ? `[${label}](${href})` : label;
        break;
      }
      case 'STRONG': case 'B': { const s = inline(c); out += s ? `**${s}**` : ''; break; }
      case 'EM': case 'I': { const s = inline(c); out += s ? `*${s}*` : ''; break; }
      case 'DEL': case 'S': case 'STRIKE': { const s = inline(c); out += s ? `~~${s}~~` : ''; break; }
      case 'SPAN':
        // The engine bakes ordered-list numbers as <span class="md-index">N.</span>;
        // the serialiser re-numbers, so the baked copy must not double.
        if (classTokens(c).includes('md-index')) break;
        out += inline(c);
        break;
      default: out += inline(c);
    }
  }
  return out;
}

/** Trim trailing whitespace per line, drop leading/trailing blank lines. */
const tidy = (s: string): string =>
  s.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/^\n+|\n+$/g, '');

/**
 * Serialise a rich cell's rendered HTML back to the engine's markdown subset.
 * Handles both the engine's own output (p/h1–h6/ul/ol/strong/em/del/a/img) and
 * what contenteditable mutates it into (sibling DIV lines, `<div><br></div>`
 * blank lines, `<b>`/`<i>` from execCommand).
 */
export function cellHtmlToMarkdown(root: CellNode): string {
  const blocks: string[] = [];
  let run: string[] = [];                      // pending paragraph lines
  const flush = (): void => {
    const lines = run.map(tidy).filter((l) => l !== '');
    if (lines.length) blocks.push(lines.join('\n'));
    run = [];
  };
  for (let i = 0; i < root.childNodes.length; i++) {
    const c = root.childNodes[i]!;
    if (c.nodeType === TEXT) {
      const text = (c.nodeValue ?? '').replace(/\u00a0/g, ' ');
      if (text.trim()) run.push(text);
      continue;
    }
    if (c.nodeType !== ELEMENT) continue;
    const name = (c.nodeName ?? '').toUpperCase();
    const heading = /^H([1-6])$/.exec(name);
    if (heading) {
      flush();
      const text = tidy(inline(c)).replace(/\n/g, ' ');
      if (text) blocks.push(`${'#'.repeat(Number(heading[1]))} ${text}`);
    } else if (name === 'UL' || name === 'OL') {
      flush();
      const items: string[] = [];
      for (let j = 0; j < c.childNodes.length; j++) {
        const li = c.childNodes[j]!;
        if (li.nodeType !== ELEMENT || (li.nodeName ?? '').toUpperCase() !== 'LI') continue;
        // trim() (not just tidy): dropping a baked md-index span leaves the
        // space that followed it at the front of the item text.
        const text = tidy(inline(li)).replace(/\n/g, ' ').trim();
        if (name === 'OL') { items.push(`${items.length + 1}. ${text}`); continue; }
        const arrow = classTokens(li).map((t) => ARROW_MARKERS[t]).find(Boolean);
        items.push(`${arrow ?? '-'} ${text}`);
      }
      if (items.length) blocks.push(items.join('\n'));
    } else if (name === 'P') {
      flush();
      const text = tidy(inline(c));
      if (text) blocks.push(text);
    } else if (name === 'DIV') {
      // A contenteditable line. Non-empty → one line of the current paragraph;
      // empty (<div><br></div>) → a paragraph break.
      const text = tidy(inline(c));
      if (text) run.push(text); else flush();
    } else {
      run.push(inline(c));
    }
  }
  flush();
  return blocks.join('\n\n');
}

/** Plain-text serialisation for cells without data-cell-md (e.g. the card
 *  title): formatting unwraps to bare text, line/block structure collapses to
 *  single spaces. */
export function cellPlainText(root: CellNode): string {
  let out = '';
  const walk = (n: CellNode): void => {
    for (let i = 0; i < n.childNodes.length; i++) {
      const c = n.childNodes[i]!;
      if (c.nodeType === TEXT) { out += (c.nodeValue ?? '').replace(/\u00a0/g, ' '); continue; }
      if (c.nodeType !== ELEMENT) continue;
      if ((c.nodeName ?? '').toUpperCase() === 'BR') { out += ' '; continue; }
      walk(c);
      out += ' ';                              // any element boundary is at most a space
    }
  };
  walk(root);
  return out.replace(/\s+/g, ' ').trim();
}

// ── mounting ──────────────────────────────────────────────────────────────────

export interface TableEditOpts {
  /** Current (normalized) value of the paginate source table. */
  getTable(): TableValue;
  /** Commit a new table value - must ride the runtime's setInput path. */
  commit(next: TableValue): void;
  /** Open the asset picker (optionally tag-filtered); resolve a markdown-ready
   *  URL + alt text, or null on cancel. */
  pickImage(tag?: string): Promise<{ url: string; alt?: string } | null>;
  /** Accessible label for the pick slots (i18n happens in the caller). */
  pickLabel?: string;
}

const cloneTable = (t: TableValue): TableValue =>
  ({ columns: [...t.columns], rows: t.rows.map((r) => [...r]) });

/**
 * Make a picked asset URL safe to bake into a markdown cell. A blob: URL dies
 * with the session, so small blobs are inlined as data: (which the engine's
 * image allowlist accepts); anything else - catalog paths, https, data: - is
 * already durable and passes through untouched. Oversized blobs pass through
 * too: a broken-after-reload ref beats megabytes of base64 in the table param.
 */
export async function markdownSafeUrl(url: string, maxInlineBytes = 512 * 1024): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  try {
    const blob = await (await fetch(url)).blob();
    if (blob.size > maxInlineBytes) return url;
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error ?? new Error('read failed'));
      r.readAsDataURL(blob);
    });
  } catch { return url; }
}

/** The cell the pointer last went down in - so when a blur-commit repaints the
 *  canvas out from under a click into the NEXT cell, focus can be restored to
 *  where the user was headed. Module scope: the repaint replaces every node. */
let lastPointer: { addr: string; at: number } | null = null;

function caretToEnd(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Wire the current paint's editable cells and pick slots. Call once per canvas
 * repaint - the innerHTML swap discards previous wiring, same as every other
 * canvas enhancer.
 */
export function mountTableCellEditing(root: HTMLElement, opts: TableEditOpts): void {
  root.querySelectorAll<HTMLElement>('[data-cell]').forEach((el) => {
    const m = /^(\d+):(\d+)$/.exec(el.dataset.cell ?? '');
    if (!m) return;
    const row = Number(m[1]);
    const col = Number(m[2]);
    const rich = el.hasAttribute('data-cell-md');
    const placeholder = el.hasAttribute('data-cell-empty');
    el.contentEditable = 'true';
    el.spellcheck = false;
    let original: string | null = null;        // pre-focus innerHTML, for revert
    let cancelled = false;
    el.addEventListener('focus', () => {
      original = el.innerHTML;
      cancelled = false;
      if (placeholder) el.textContent = '';
    });
    el.addEventListener('keydown', (e) => {
      // Keep canvas-level shortcuts (undo, escape-to-close) out of an active edit.
      e.stopPropagation();
      if (e.key === 'Escape') { cancelled = true; el.blur(); }
      else if (e.key === 'Enter' && !rich) { e.preventDefault(); el.blur(); }
    });
    el.addEventListener('blur', () => {
      const revert = (): void => { if (original != null) el.innerHTML = original; };
      if (cancelled) { revert(); return; }
      const text = rich ? cellHtmlToMarkdown(el) : cellPlainText(el);
      const t = opts.getTable();
      if ((t.rows[row]?.[col] ?? '') === text || col >= t.columns.length) { revert(); return; }
      const next = cloneTable(t);
      while (next.rows.length <= row) next.rows.push(next.columns.map(() => ''));
      next.rows[row]![col] = text;
      opts.commit(next);
    });
    el.addEventListener('mousedown', () => { lastPointer = { addr: el.dataset.cell!, at: Date.now() }; });
  });

  root.querySelectorAll<HTMLElement>('[data-cell-pick]').forEach((el) => {
    const row = Number(el.dataset.cellPick);
    if (!Number.isInteger(row) || row < 0) return;
    const columnName = el.dataset.pickColumn || 'Icon';
    const tag = el.dataset.pickTag || undefined;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    // Style hook: a tool can reveal an EMPTY slot's affordance only when armed
    // (i.e. only where editing is actually live), keeping export DOM inert.
    el.dataset.pickArmed = '';
    if (opts.pickLabel && !el.getAttribute('aria-label')) el.setAttribute('aria-label', opts.pickLabel);
    const open = async (): Promise<void> => {
      const picked = await opts.pickImage(tag);
      if (!picked) return;
      const next = cloneTable(opts.getTable());
      let col = next.columns.findIndex((c) => c.trim().toLowerCase() === columnName.trim().toLowerCase());
      if (col < 0) {
        next.columns.push(columnName);
        next.rows.forEach((r) => r.push(''));
        col = next.columns.length - 1;
      }
      while (next.rows.length <= row) next.rows.push(next.columns.map(() => ''));
      next.rows[row]![col] = `![${(picked.alt ?? '').replace(/[[\]]/g, '')}](${picked.url})`;
      opts.commit(next);
    };
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); void open(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void open(); }
    });
  });

  // When a blur-commit's repaint swallowed a click into the next cell, put the
  // user back where they were headed (fresh pointer-downs only).
  if (lastPointer && Date.now() - lastPointer.at < 600) {
    const active = document.activeElement;
    if (!active || active === document.body || !root.contains(active)) {
      const sel = `[data-cell="${lastPointer.addr}"]`;
      const el = root.querySelector<HTMLElement>(sel);
      if (el) { el.focus(); caretToEnd(el); }
    }
    lastPointer = null;
  }
}
