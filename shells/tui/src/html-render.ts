// SPDX-License-Identifier: MPL-2.0
/**
 * HTML → terminal text. Text-based/interactive UTILITIES (text-helper, color-palette,
 * countdown-timer) don't produce a file you export - their rendered HTML IS the point.
 * So instead of a raster half-block (meaningless for text) or an "export to view" banner,
 * the TUI walks the tool's hydrated DOM and renders its CONTENT as structured, coloured
 * terminal text: headings bold, blocks on their own lines, buttons/tabs marked, and a
 * colour swatch shown as a block in its actual colour.
 *
 * jsdom applies no stylesheet cascade (a `.swatch[name=pine]{background:var(--color-pine)}`
 * computes to transparent), so swatch colours are resolved by parsing the `--name: value`
 * custom-property definitions out of the tool's own `<style>` and matching an element's
 * inline `background`, a `var(--x)` reference, or a `name`/`data-*` attribute.
 */

/** One coloured span on a rendered line. */
export interface Run { text: string; fg?: string; bg?: string; bold?: boolean; dim?: boolean; focused?: boolean }

const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'section', 'header', 'footer', 'nav', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'ul', 'p', 'pre', 'table', 'tr', 'thead', 'tbody', 'figure', 'figcaption', 'form', 'fieldset', 'legend', 'dl', 'dt', 'dd']);
const BOLD = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'th', 'dt']);
const DIM = new Set(['small', 'caption', 'figcaption']);
const SKIP = new Set(['script', 'style', 'svg', 'template', 'noscript', 'link', 'meta']);

/** Normalise a CSS colour (#rgb, #rrggbb, rgb()/rgba()) to a #rrggbb hex Ink can use. */
export function cssToHex(c?: string | null): string | undefined {
  if (!c) return undefined;
  const s = c.trim();
  const short = s.match(/^#([0-9a-fA-F]{3})$/);
  if (short) return '#' + short[1]!.split('').map(x => x + x).join('').toLowerCase();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  const rgb = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map(n => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
  return undefined;
}

/** name → #hex from every `--name: <colour>` definition in the tool's <style> blocks. */
function parseVarMap(styleText: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(styleText))) {
    const hex = cssToHex(m[2]);
    if (hex) map.set(m[1]!.toLowerCase(), hex);
  }
  return map;
}

type El = { getAttribute(n: string): string | null; hasAttribute(n: string): boolean; tagName: string; textContent: string | null; value?: string; childNodes: ArrayLike<Node> & Iterable<Node> };

/** Resolve a swatch's fill: inline background, a var() reference, or a name/data-* attr. */
function swatchColor(el: El, varMap: Map<string, string>): string | undefined {
  const style = el.getAttribute('style') ?? '';
  const bg = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  if (bg) {
    const v = bg[1]!.trim();
    const ref = v.match(/var\(\s*--([\w-]+)/);
    if (ref) { const h = varMap.get(ref[1]!.toLowerCase()); if (h) return h; }
    const h = cssToHex(v);
    if (h) return h;
  }
  for (const attr of ['name', 'data-color', 'data-name', 'data-swatch', 'data-token']) {
    const a = el.getAttribute(attr);
    if (a) { const h = varMap.get('color-' + a.toLowerCase()) ?? varMap.get(a.toLowerCase()); if (h) return h; }
  }
  return undefined;
}

const isHidden = (el: El): boolean => el.hasAttribute('hidden') || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute('style') ?? '');

/** The live value of a field - the PROPERTY first (jsdom doesn't reflect a script-set
 *  `.value` back to the attribute), then the value attribute, then the placeholder. */
function fieldValue(el: El): { text: string; placeholder: boolean } {
  const prop = typeof el.value === 'string' ? el.value : undefined;
  if (prop !== undefined && prop !== '') return { text: prop, placeholder: false };
  const attr = el.getAttribute('value');
  if (attr) return { text: attr, placeholder: false };
  return { text: el.getAttribute('placeholder') ?? '', placeholder: true };
}

interface RenderOpts { focus?: El | null; }
export interface RenderResult { lines: Run[][]; focusLine: number }

/**
 * Render a hydrated DOM subtree to lines of coloured runs, wrapping swatch rows to
 * `maxCols`. `styleText` is the concatenated <style> text (for the swatch var map).
 * When `opts.focus` is given (interactive mode), that element's runs are marked
 * `focused` and `focusLine` reports the line it lands on (so the view can scroll to it).
 */
function render(root: El, styleText: string, maxCols: number, opts: RenderOpts): RenderResult {
  const varMap = parseVarMap(styleText);
  const focusEl = opts.focus ?? null;
  let focusLine = -1;
  const lines: Run[][] = [];
  let cur: Run[] = [];
  const width = (): number => cur.reduce((w, r) => w + r.text.length, 0);
  const flush = (): void => {
    const text = cur.map(r => r.text).join('').replace(/\s+$/, '');
    if (text) lines.push(cur);
    else if (lines.length && lines[lines.length - 1]!.length) lines.push([]);   // one blank between blocks
    cur = [];
  };
  const pushText = (raw: string, ctx: { bold?: boolean; dim?: boolean; focused?: boolean }): void => {
    let text = raw.replace(/\s+/g, ' ');
    if (width() === 0) text = text.replace(/^ /, '');
    if (!text) return;
    cur.push({ text, bold: ctx.bold, dim: ctx.dim, focused: ctx.focused });
  };

  const NODE_TEXT = 3, NODE_ELEMENT = 1;
  const walk = (node: El, ctx: { bold?: boolean; dim?: boolean; focused?: boolean }): void => {
    for (const child of Array.from(node.childNodes) as Array<Node & Partial<El>>) {
      if (child.nodeType === NODE_TEXT) { pushText(child.textContent ?? '', ctx); continue; }
      if (child.nodeType !== NODE_ELEMENT) continue;
      const el = child as unknown as El;
      const tag = el.tagName.toLowerCase();
      if (SKIP.has(tag) || isHidden(el)) continue;
      const focused = ctx.focused || el === focusEl;
      if (el === focusEl && focusLine < 0) focusLine = lines.length;   // where its content begins

      // A colour swatch: a coloured, (near-)empty element → a block in its own colour,
      // packed several per line.
      const sc = swatchColor(el, varMap);
      const ownLen = (el.textContent ?? '').replace(/\s+/g, '').length;
      if (sc && ownLen === 0) {
        const label = el.getAttribute('name') ?? el.getAttribute('data-name') ?? el.getAttribute('data-token') ?? '';
        const chunk = 2 + (label ? label.length + 1 : 0) + 2;
        if (width() > 0 && width() + chunk > maxCols) flush();
        cur.push({ text: focused ? '▐█' : '██', fg: sc, focused });
        cur.push({ text: (label ? ' ' + label : '') + '  ', dim: true, focused });
        continue;
      }

      const block = BLOCK.has(tag);
      if (block) flush();
      const childCtx = { bold: ctx.bold || BOLD.has(tag), dim: ctx.dim || DIM.has(tag), focused };
      if (tag === 'button' || tag === 'summary' || el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'button') {
        const t = (el.textContent ?? '').trim();
        if (t) pushText(`‹${t}› `, childCtx);
        else walk(el, childCtx);
      } else if (tag === 'textarea' || tag === 'input' || tag === 'select') {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (tag === 'input' && (t === 'checkbox' || t === 'radio')) {
          pushText(`${(el as { checked?: boolean }).checked ? '[x]' : '[ ]'} `, childCtx);
        } else {
          const { text, placeholder } = tag === 'select'
            ? { text: el.value ?? (el.textContent ?? '').trim(), placeholder: false }
            : fieldValue(el);
          pushText(`[${text.replace(/\s+/g, ' ').trim() || '…'}] `, { dim: placeholder && !focused, focused });
        }
      } else if (tag === 'li') {
        pushText('• ', ctx);
        walk(el, childCtx);
      } else {
        walk(el, childCtx);
      }
      if (block) flush();
    }
  };

  walk(root, {});
  flush();

  // Collapse trailing/leading blank lines and any doubled blanks.
  const out: Run[][] = [];
  let removedBefore = 0;                          // blanks dropped above focusLine → shift it
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    const blank = ln.length === 0;
    if (blank && (out.length === 0 || out[out.length - 1]!.length === 0)) { if (i < focusLine) removedBefore++; continue; }
    out.push(ln);
  }
  while (out.length && out[out.length - 1]!.length === 0) out.pop();
  return { lines: out, focusLine: focusLine < 0 ? -1 : Math.max(0, focusLine - removedBefore) };
}

/** Render a hydrated DOM subtree to coloured terminal lines (no focus tracking). */
export function htmlToRuns(root: El, styleText: string, maxCols: number): Run[][] {
  return render(root, styleText, maxCols, {}).lines;
}

/** Render with one element marked focused (interactive mode); reports its line index. */
export function htmlToRunsFocused(root: El, styleText: string, maxCols: number, focus: El | null): RenderResult {
  return render(root, styleText, maxCols, { focus });
}
