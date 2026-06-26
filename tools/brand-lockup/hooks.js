/**
 * Brand Lockup — official SUSE logo lockups as crisp outlined vectors.
 *
 * The lockup is the SUSE chameleon mark + the "SUSE" wordmark + a descriptor
 * (the product / program / team name). Everything is emitted as outlined SVG
 * paths so the result is WYSIWYG — the live preview *is* the export, with no
 * <text> nodes to mis-render on another machine.
 *
 *   • chameleon  — a single compound path (the eye is a hole), recoloured per variant
 *   • SUSE       — SUSE SemiBold, outlined via host.text (HarfBuzz WASM)
 *   • descriptor — SUSE Medium,   outlined via host.text
 *
 * Three layouts, flush to the bounding box like the brand source. Orientation +
 * type pick the layout: horizontal is always one line; stacked depends on type —
 *   horizontal — chameleon inline-left, SUSE + name on one baseline
 *   ontop      — (product/team stacked) chameleon on top (width = SUSE wordmark),
 *                SUSE + name flow below and wrap at a width chosen by `wrapMode`
 *   hybrid     — (program/service stacked) chameleon inline-left, SUSE + name
 *                wrap below it — the layout SUSE uses for programs and services
 *
 * Four colour variants (the only combinations the brand ships):
 *   positive+colour → green chameleon, midnight text   (pos-green)
 *   positive+mono   → all black                         (pos-black)
 *   negative+colour → green chameleon, white text       (neg-green)
 *   negative+mono   → all white                         (neg-white)
 *
 * Geometry constants are measured from the brand source files at a base font
 * size of 40 (cap-height 28); everything scales by k = BASE_FONT / 40.
 */

// ── Canonical SUSE chameleon (native box 0 0 70.83 35.68; eye = hole) ──────────
const CHAMELEON_D = 'M66.89,12.61c-.38.25-.89.25-1.27,0-.62-.41-.68-1.28-.18-1.78.45-.46,1.18-.46,1.63,0,.5.5.44,1.36-.18,1.78M68.7,10.09c.72,3.08-2.04,5.84-5.12,5.12-1.57-.37-2.81-1.61-3.18-3.18-.72-3.07,2.04-5.84,5.12-5.12,1.57.37,2.81,1.61,3.18,3.17M47.99,26.64c.35.51.64.99.81,1.48.11.35.26.8.61.99.02.01.04.02.06.03.63.23,2.24.19,2.24.19h2.97c.25,0,2.48,0,2.43-.25-.27-1.19-1.65-1.41-2.7-2.03-.97-.58-1.88-1.23-2.3-2.36-.22-.58-.09-1.92.29-2.41.27-.35.67-.59,1.11-.68.48-.1.97-.01,1.45.03.59.06,1.17.17,1.76.24,1.14.15,2.28.21,3.43.18,1.89-.05,3.78-.35,5.57-.96,1.25-.42,2.48-.99,3.54-1.78,1.21-.9.89-.81-.33-.69-1.47.15-2.95.17-4.42.09-1.37-.08-2.73-.24-3.97-.88-.98-.5-1.82-1.01-2.59-1.79-.12-.12-.19-.46.02-.68.21-.21.64-.09.78.02,1.35,1.13,3.37,2.06,5.46,2.16,1.13.06,2.23.08,3.36.03.56-.03,1.42-.02,1.98-.03.29,0,1.09.08,1.24-.23.05-.09.04-.19.04-.3-.17-4.52-.5-9.62-5.23-11.78-3.53-1.61-8.82-4.11-11.05-5.15-.52-.25-1.12.14-1.12.72,0,1.51.08,3.68.08,5.65-1.07-1.09-2.87-1.78-4.25-2.41-1.56-.72-3.17-1.32-4.81-1.83-3.3-1.02-6.72-1.65-10.15-1.99-3.89-.39-7.86-.2-11.69.59-6.32,1.31-12.53,4.35-17.24,8.79C2.44,12.32.17,16.2.02,20.13c-.22,5.57,1.34,8.56,4.21,11.64,4.57,4.91,14.41,5.6,18.39-.23,1.79-2.62,2.18-6.18.88-9.07-1.3-2.9-4.29-4.99-7.46-5.1-2.46-.08-5.08,1.17-6.02,3.45-.72,1.74-.31,3.88,1,5.23.51.53,1.2.96,1.96.79.44-.1.82-.43.88-.89.1-.67-.48-1.1-.84-1.61-.65-.92-.52-2.31.29-3.09.68-.66,1.7-.86,2.65-.86.89,0,1.79.16,2.56.61,1.08.63,1.79,1.79,2.04,3.01.74,3.66-2.23,6.63-6.26,6.86-2.06.12-4.16-.42-5.77-1.71-4.07-3.28-5.07-9.98-.41-13.56,4.42-3.4,10-2.52,13.29-.76,2.63,1.41,4.6,3.72,6.08,6.28.75,1.28,1.38,2.63,1.97,3.99.57,1.31,1.1,2.63,2.23,3.59.75.64,1.68.61,2.67.61h5.63c.76,0,.58-.51.25-.85-.75-.76-1.82-.93-2.81-1.21-2.27-.62-2.04-3.63-1.41-3.63,2.03,0,2.09.06,3.87.04,2.56-.04,3.34-.18,5.34.56,1.07.4,2.1,1.44,2.77,2.4';
const CHAM_W = 70.83, CHAM_H = 35.68, CHAM_ASPECT = CHAM_W / CHAM_H; // 1.9852

// ── Fonts ─────────────────────────────────────────────────────────────────────
const FONT_SUSE = '/tools/brand-lockup/fonts/SUSE-SemiBold.otf'; // wordmark
const FONT_DESC = '/tools/brand-lockup/fonts/SUSE-Medium.otf';   // descriptor

// ── Design constants (base font size 40, cap-height 28) ───────────────────────
const BASE_FONT      = 320;   // 8× the source scale → crisp raster exports
const F              = 40;    // reference design unit
const GAP_CHAM_SUSE  = 9.51;  // horizontal: chameleon ink-right → SUSE ink-left
const GAP_WORD       = 12.60; // SUSE → descriptor (ink gap)
const VGAP_CHAM_SUSE = 6.40;  // stacked: chameleon bottom → SUSE cap-top
const LINE_H         = 40;    // stacked: baseline → baseline
const DESC_PAD       = 2.4;   // bottom breathing room so g/y/p descenders aren't clipped
const WRAP = { compact: 240, balanced: 360, wide: 520 }; // stacked wrap widths (design units)

const COLORS = {
  'pos-green': { mark: '#30ba78', text: '#0c322c' },
  'neg-green': { mark: '#30ba78', text: '#ffffff' },
  'pos-black': { mark: '#000000', text: '#000000' },
  'neg-white': { mark: '#ffffff', text: '#ffffff' },
};

// Map the polarity + treatment selects onto the four brand variants.
function variantFor(polarity, treatment) {
  const neg = polarity === 'negative';
  if (treatment === 'mono') return neg ? 'neg-white' : 'pos-black';
  return neg ? 'neg-green' : 'pos-green';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return Math.round(n * 100) / 100; }
function placed(d, fill, dx, dy) {
  return `<path fill="${fill}" d="${d}" transform="translate(${fmt(dx)},${fmt(dy)})"/>`;
}

/** Shape one run via host.text. Returns { d, advanceWidth, bbox }. */
function shape(host, text, fontUrl, fontSize) {
  return host.text.toPath({ text, fontUrl, fontSize });
}

/**
 * Greedy word-wrap for stacked. Line 0 carries SUSE (its width folded into
 * `prefix`); a word joins the current line only if it still fits in `maxW`,
 * otherwise it starts a fresh left-margin line.
 * Returns [{ suse:bool, words:[...] }].
 */
function wrapWords(words, advs, spaceAdv, prefix, maxW) {
  const lines = []; let line = { suse: true, words: [] }, lineW = prefix;
  for (let i = 0; i < words.length; i++) {
    const firstOnLine = line.words.length === 0;
    const emptyPlain  = firstOnLine && !line.suse;          // must take ≥1 word
    const sep  = firstOnLine ? 0 : spaceAdv;                // gap2 already in prefix
    const cand = lineW + sep + advs[i];
    if (!emptyPlain && cand > maxW) {
      lines.push(line); line = { suse: false, words: [words[i]] }; lineW = advs[i];
    } else {
      line.words.push(words[i]); lineW = cand;
    }
  }
  lines.push(line);
  return lines;
}

/** Render a line's descriptor words as one Medium run, ink-left at x, baseline Yb. */
async function descLine(host, words, fontSize, fill, x, Yb) {
  if (!words.length) return null;
  const run = await shape(host, words.join(' '), FONT_DESC, fontSize);
  if (!run.bbox) return null;
  return {
    part: placed(run.d, fill, x - run.bbox.x1, Yb),
    inkRight: x + (run.bbox.x2 - run.bbox.x1),
    bottom: Yb + run.bbox.y2,
  };
}

// ── Build the lockup SVG inner markup + dimensions ────────────────────────────
// layout: 'horizontal' (one line) | 'ontop' (chameleon over SUSE+name) |
//         'hybrid' (chameleon inline-left, SUSE+name wrap below — programs/services)
async function buildLockup({ host, name, layout, variant, wrapMode, background }) {
  const fs = BASE_FONT, k = fs / F;
  const col = COLORS[variant] || COLORS['pos-green'];
  const words = (name || '').trim().split(/\s+/).filter(Boolean);

  const suse = await shape(host, 'SUSE', FONT_SUSE, fs);
  const suseInk = suse.bbox ? suse.bbox.x2 - suse.bbox.x1 : 0;
  const cap = suse.bbox ? -suse.bbox.y1 : 28 * k; // cap-top above baseline
  const gap2 = GAP_WORD * k;

  const parts = [];
  let W = 0, H = 0;

  if (layout === 'horizontal') {
    // chameleon inline-left, one baseline
    const chW = CHAM_W * k, chH = CHAM_H * k, Yb = cap; // chameleon top (=cap top) at y=0
    parts.push(`<path fill="${col.mark}" d="${CHAMELEON_D}" transform="scale(${fmt(chW / CHAM_W)})"/>`);
    parts.push(placed(suse.d, col.text, chW + GAP_CHAM_SUSE * k - suse.bbox.x1, Yb));
    let right = chW + GAP_CHAM_SUSE * k + suseInk;
    let bottom = Math.max(chH, Yb + (suse.bbox ? suse.bbox.y2 : 0));
    if (words.length) {
      const r = await descLine(host, words, fs, col.text, right + gap2, Yb);
      if (r) { parts.push(r.part); right = r.inkRight; bottom = Math.max(bottom, r.bottom); }
    }
    W = right; H = bottom;
  } else {
    // ontop + hybrid both wrap "SUSE" + name into stacked lines; they differ only
    // in where the chameleon sits and where the text column begins.
    const hybrid = layout === 'hybrid';
    const chW = hybrid ? CHAM_W * k : suseInk;
    const chH = hybrid ? CHAM_H * k : chW / CHAM_ASPECT;
    const textX = hybrid ? chW + GAP_CHAM_SUSE * k : 0;        // left edge of every text line
    const firstBaseline = hybrid ? cap : chH + VGAP_CHAM_SUSE * k + cap;
    const maxW = (WRAP[wrapMode] || WRAP.compact) * k;
    parts.push(`<path fill="${col.mark}" d="${CHAMELEON_D}" transform="scale(${fmt(chW / CHAM_W)})"/>`);

    // per-word advances + Medium space advance, for wrap accounting
    const wordRuns = await Promise.all(words.map(w => shape(host, w, FONT_DESC, fs)));
    const advs = wordRuns.map(r => r.advanceWidth);
    const [nn, n] = await Promise.all([shape(host, 'n n', FONT_DESC, fs), shape(host, 'n', FONT_DESC, fs)]);
    const spaceAdv = nn.advanceWidth - 2 * n.advanceWidth;

    // Brand convention: a single-word name sits on its OWN line under SUSE
    // (SUSE / Storage, SUSE / AI). Multi-word names flow after SUSE and wrap
    // ("SUSE AI" / Factory, "SUSE Linux" / "Enterprise Server").
    const lines = words.length <= 1
      ? [{ suse: true, words: [] }, ...(words.length ? [{ suse: false, words }] : [])]
      : wrapWords(words, advs, spaceAdv, suseInk + gap2, maxW);
    let maxRight = chW, bottom = 0;
    for (let li = 0; li < lines.length; li++) {
      const Yb = firstBaseline + li * LINE_H * k, ln = lines[li];
      if (ln.suse) {
        parts.push(placed(suse.d, col.text, textX - suse.bbox.x1, Yb)); // SUSE ink-left at textX
        bottom = Math.max(bottom, Yb + suse.bbox.y2);
        let right = textX + suseInk;
        const r = await descLine(host, ln.words, fs, col.text, right + gap2, Yb);
        if (r) { parts.push(r.part); right = r.inkRight; bottom = Math.max(bottom, r.bottom); }
        maxRight = Math.max(maxRight, right);
      } else {
        const r = await descLine(host, ln.words, fs, col.text, textX, Yb);
        if (r) { parts.push(r.part); maxRight = Math.max(maxRight, r.inkRight); bottom = Math.max(bottom, r.bottom); }
      }
    }
    W = maxRight; H = Math.max(hybrid ? chH : 0, bottom);
  }

  H += DESC_PAD * k; // breathing room below the baseline so descenders clear the edge
  W = Math.ceil(W * 100) / 100;
  H = Math.ceil(H * 100) / 100;

  const hasBg = background && background !== 'transparent';
  const bgRect = hasBg ? `<rect width="100%" height="100%" fill="${background}"/>` : '';
  // preview backdrop (not exported): bake colour for bg, else dark for negatives
  const surface = hasBg ? background : (variant.startsWith('neg') ? '#0c322c' : 'transparent');

  return { inner: bgRect + parts.join(''), w: W, h: H, surface };
}

// ── Canvas / export-dimension sync ────────────────────────────────────────────
function syncExportDims(w, h) {
  const wIn = document.querySelector('[data-action="export-width"]');
  const hIn = document.querySelector('[data-action="export-height"]');
  if (wIn) wIn.value = Math.round(w);
  if (hIn) hIn.value = Math.round(h);
}

// Team lockups always read "… Team" — append it when the Team type is chosen and
// the name doesn't already end in "Team" (so "Data" → "Data Team", "Data Team" stays).
function applyCategory(name, category) {
  const n = (name || '').trim();
  if (category === 'team' && n && !/\bteam$/i.test(n)) return `${n} Team`;
  return n;
}

// Stacked layout depends on type: products and teams stack the chameleon ON TOP;
// programs (and program-like services) use the inline-chameleon HYBRID, where the
// name wraps below SUSE. Horizontal is always a single line.
function layoutFor(orientation, category) {
  if (orientation !== 'stacked') return 'horizontal';
  return category === 'program' ? 'hybrid' : 'ontop';
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function readModel(model) {
  const v = Object.fromEntries(model.map(i => [i.id, i.value]));
  const polarity  = v.polarity  || 'positive';
  const treatment = v.treatment || 'colour';
  const category  = v.category || 'product';
  return {
    name:       applyCategory(v.name ?? '', category),
    layout:     layoutFor(v.orientation || 'horizontal', category),
    variant:    variantFor(polarity, treatment),
    wrapMode:   v.wrapMode || 'compact',
    background: v.background || 'transparent',
  };
}

async function render({ model, host }) {
  const opts = readModel(model);
  host.text.preload(FONT_SUSE).catch(() => {});
  host.text.preload(FONT_DESC).catch(() => {});
  const { inner, w, h, surface } = await buildLockup({ host, ...opts });
  setTimeout(() => syncExportDims(w, h), 0);
  return { inner, w, h, surface };
}

async function onInit(ctx)  { return render(ctx); }
async function onInput(ctx) { return render(ctx); }
