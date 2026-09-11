// SPDX-License-Identifier: MPL-2.0
/**
 * The WebKit box-shadow capture fix (the standing bug recorded during plans/104 P2):
 * dom-to-image on WebKit rasterises a `box-shadow` with offsets as a CENTRED halo
 * (measured IoU 0.715 against the on-screen shadow), untransformed elements
 * included - so shipped Safari PNG/JPG exports of offset shadows are simply wrong.
 * `filter: drop-shadow()` captures correctly there, so for the capture's duration
 * the offset shadows are BAKED into drop-shadows on the live node and restored
 * right after - the same in-place mutate/restore idiom as swapBlobUrls.
 *
 * Approximation, stated: `spread` has no drop-shadow analog and is dropped, and
 * `inset` shadows cannot become drop-shadows and are left as box-shadow (their
 * offsets still mis-capture on WebKit - a narrower defect than the outer halo).
 * An offset shadow without spread converts exactly.
 */

/** Safari-the-engine, excluding every Chromium that also says AppleWebKit - the
 *  same `Version/N ... Safari` shape the export metadata stamp keys on. */
export function isWebKitCapture(ua: string = (globalThis.navigator?.userAgent ?? '')): boolean {
  return /Version\/\d+.*Safari/.test(ua) && !/Chrom(e|ium)|Edg\//.test(ua);
}

/** Split a computed box-shadow list on TOP-LEVEL commas (never inside rgb()). */
function splitShadows(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface ParsedShadow {
  inset: boolean;
  color: string;
  /** x, y, blur, spread - lengths as authored/computed, px. */
  lengths: string[];
}

/** Tolerant single-shadow parse: `inset` anywhere, colour first or last. */
function parseShadow(s: string): ParsedShadow | null {
  let inset = false;
  let color = '';
  const lengths: string[] = [];
  // Tokenise on spaces outside parens so `rgb(0, 0, 0)` stays one token.
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) tokens.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur) tokens.push(cur);
  for (const t of tokens) {
    if (t === 'inset') inset = true;
    else if (/^[-+]?\d/.test(t) || /^\./.test(t)) lengths.push(t);
    else color = color ? `${color} ${t}` : t;
  }
  if (lengths.length < 2) return null;
  return { inset, color, lengths };
}

/**
 * The drop-shadow chain for a box-shadow list, or null when nothing needs (or
 * survives) conversion. Only NON-inset shadows with a real offset convert; a
 * centred glow (0 0 blur) captures fine as box-shadow and stays put.
 */
export function boxShadowToDropShadows(value: string): { filter: string; keep: string } | null {
  if (!value || value === 'none') return null;
  const parts = splitShadows(value).map((s) => ({ raw: s, p: parseShadow(s) }));
  const converted: string[] = [];
  const kept: string[] = [];
  for (const { raw, p } of parts) {
    const offX = p ? parseFloat(p.lengths[0] ?? '0') : 0;
    const offY = p ? parseFloat(p.lengths[1] ?? '0') : 0;
    if (!p || p.inset || (offX === 0 && offY === 0)) { kept.push(raw); continue; }
    const blur = p.lengths[2] ?? '0px';
    converted.push(`drop-shadow(${p.lengths[0]} ${p.lengths[1]} ${blur}${p.color ? ` ${p.color}` : ''})`);
  }
  if (!converted.length) return null;
  return { filter: converted.join(' '), keep: kept.join(', ') };
}

/**
 * Bake every offset box-shadow under `root` (root included) into drop-shadow
 * filters, in place. Returns the restore. No-op (identity restore) off WebKit.
 */
export function bakeWebKitBoxShadows(root: Element, ua?: string): () => void {
  if (!isWebKitCapture(ua)) return () => {};
  const doc = root.ownerDocument;
  const win = doc?.defaultView;
  if (!win) return () => {};
  const touched: { el: HTMLElement; boxShadow: string; filter: string }[] = [];
  const els: Element[] = [root, ...root.querySelectorAll('*')];
  for (const el of els) {
    if (!(el instanceof win.HTMLElement)) continue;
    const cs = win.getComputedStyle(el);
    const conv = boxShadowToDropShadows(cs.boxShadow);
    if (!conv) continue;
    touched.push({ el, boxShadow: el.style.boxShadow, filter: el.style.filter });
    const prior = cs.filter && cs.filter !== 'none' ? `${cs.filter} ` : '';
    el.style.boxShadow = conv.keep || 'none';
    el.style.filter = `${prior}${conv.filter}`;
  }
  return () => {
    for (const t of touched) {
      t.el.style.boxShadow = t.boxShadow;
      t.el.style.filter = t.filter;
    }
  };
}
