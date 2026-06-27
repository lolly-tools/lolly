/**
 * Brand Lockup — official SUSE logo lockups as crisp outlined vectors.
 *
 * The lockup is the SUSE chameleon mark + the "SUSE" wordmark + a descriptor
 * (the product / program / team name). Everything is emitted as outlined SVG
 * paths so the result is WYSIWYG — the live preview *is* the export, with no
 * <text> nodes to mis-render on another machine.
 *
 *   • chameleon  — a compound path; positive and negative are SEPARATE artworks
 *                  (negative redraws the interior for dark backgrounds, never a recolour)
 *   • SUSE       — SUSE SemiBold, outlined via host.text (HarfBuzz WASM)
 *   • descriptor — SUSE Regular,  outlined via host.text
 *   • location   — SUSE Light at ~70% size (event/team city, on its own line)
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

// ── Canonical SUSE chameleon — two artworks, NOT a recolour of one ────────────
// The mark's interior (eye, jaw, scales) is shaped by holes in the compound path.
// Positive: those holes let a LIGHT background show through. On a DARK background
// the same holes read dark and the interior would vanish — so the brand ships a
// separate negative/knockout path with the interior redrawn (the eye becomes a
// filled pupil, not a hole). Both share the same outer silhouette and native box
// (0 0 70.83 35.68), so switching polarity recolours + swaps interior cutouts but
// NEVER reverses or reshapes the silhouette. chameleonFor() picks the path by variant.
const CHAMELEON_POS_D = 'M66.89,12.61c-.38.25-.89.25-1.27,0-.62-.41-.68-1.28-.18-1.78.45-.46,1.18-.46,1.63,0,.5.5.44,1.36-.18,1.78M68.7,10.09c.72,3.08-2.04,5.84-5.12,5.12-1.57-.37-2.81-1.61-3.18-3.18-.72-3.07,2.04-5.84,5.12-5.12,1.57.37,2.81,1.61,3.18,3.17M47.99,26.64c.35.51.64.99.81,1.48.11.35.26.8.61.99.02.01.04.02.06.03.63.23,2.24.19,2.24.19h2.97c.25,0,2.48,0,2.43-.25-.27-1.19-1.65-1.41-2.7-2.03-.97-.58-1.88-1.23-2.3-2.36-.22-.58-.09-1.92.29-2.41.27-.35.67-.59,1.11-.68.48-.1.97-.01,1.45.03.59.06,1.17.17,1.76.24,1.14.15,2.28.21,3.43.18,1.89-.05,3.78-.35,5.57-.96,1.25-.42,2.48-.99,3.54-1.78,1.21-.9.89-.81-.33-.69-1.47.15-2.95.17-4.42.09-1.37-.08-2.73-.24-3.97-.88-.98-.5-1.82-1.01-2.59-1.79-.12-.12-.19-.46.02-.68.21-.21.64-.09.78.02,1.35,1.13,3.37,2.06,5.46,2.16,1.13.06,2.23.08,3.36.03.56-.03,1.42-.02,1.98-.03.29,0,1.09.08,1.24-.23.05-.09.04-.19.04-.3-.17-4.52-.5-9.62-5.23-11.78-3.53-1.61-8.82-4.11-11.05-5.15-.52-.25-1.12.14-1.12.72,0,1.51.08,3.68.08,5.65-1.07-1.09-2.87-1.78-4.25-2.41-1.56-.72-3.17-1.32-4.81-1.83-3.3-1.02-6.72-1.65-10.15-1.99-3.89-.39-7.86-.2-11.69.59-6.32,1.31-12.53,4.35-17.24,8.79C2.44,12.32.17,16.2.02,20.13c-.22,5.57,1.34,8.56,4.21,11.64,4.57,4.91,14.41,5.6,18.39-.23,1.79-2.62,2.18-6.18.88-9.07-1.3-2.9-4.29-4.99-7.46-5.1-2.46-.08-5.08,1.17-6.02,3.45-.72,1.74-.31,3.88,1,5.23.51.53,1.2.96,1.96.79.44-.1.82-.43.88-.89.1-.67-.48-1.1-.84-1.61-.65-.92-.52-2.31.29-3.09.68-.66,1.7-.86,2.65-.86.89,0,1.79.16,2.56.61,1.08.63,1.79,1.79,2.04,3.01.74,3.66-2.23,6.63-6.26,6.86-2.06.12-4.16-.42-5.77-1.71-4.07-3.28-5.07-9.98-.41-13.56,4.42-3.4,10-2.52,13.29-.76,2.63,1.41,4.6,3.72,6.08,6.28.75,1.28,1.38,2.63,1.97,3.99.57,1.31,1.1,2.63,2.23,3.59.75.64,1.68.61,2.67.61h5.63c.76,0,.58-.51.25-.85-.75-.76-1.82-.93-2.81-1.21-2.27-.62-2.04-3.63-1.41-3.63,2.03,0,2.09.06,3.87.04,2.56-.04,3.34-.18,5.34.56,1.07.4,2.1,1.44,2.77,2.4'; // interior = holes onto a light background
const CHAMELEON_NEG_D = 'M67.08,10.84c-.45-.46-1.18-.46-1.63,0-.5.5-.44,1.37.18,1.78.38.25.89.25,1.27,0,.62-.41.68-1.28.18-1.78M65.59,6.93c-3.08-.72-5.85,2.04-5.12,5.12.37,1.57,1.61,2.81,3.18,3.18,3.08.72,5.85-2.05,5.12-5.12-.37-1.57-1.61-2.81-3.18-3.18M45.26,24.26c-2.01-.74-2.78-.59-5.35-.56-1.78.02-1.84-.04-3.87-.04-.63,0-.86,3,1.41,3.63.99.27,2.07.45,2.81,1.21.33.34.52.85-.25.85h-5.63c-.99,0-1.92.02-2.67-.61-1.14-.96-1.67-2.28-2.24-3.6-.59-1.36-1.23-2.71-1.97-3.99-1.49-2.56-3.45-4.87-6.09-6.28-3.29-1.77-8.88-2.64-13.31.76-4.66,3.58-3.66,10.29.42,13.57,1.61,1.3,3.71,1.84,5.78,1.72,4.03-.24,7.01-3.21,6.27-6.87-.25-1.23-.96-2.38-2.04-3.02-.77-.45-1.67-.61-2.56-.61-.95,0-1.97.2-2.65.86-.81.78-.94,2.17-.29,3.1.36.51.94.94.84,1.61-.07.45-.44.79-.89.89-.76.17-1.45-.26-1.96-.79-1.31-1.35-1.72-3.5-1-5.24.94-2.28,3.57-3.53,6.03-3.45,3.18.11,6.17,2.2,7.47,5.1,1.3,2.9.91,6.46-.88,9.08-3.99,5.83-13.84,5.14-18.41.22C1.36,28.72-.2,25.72.02,20.15c.15-3.94,2.43-7.82,5.32-10.55C10.06,5.16,16.28,2.12,22.6.8,26.44.01,30.41-.18,34.31.21c3.44.34,6.86.97,10.16,2,1.64.51,3.25,1.12,4.81,1.83,1.38.63,3.18,1.32,4.25,2.41,0-1.98-.08-4.15-.08-5.66,0-.58.61-.97,1.13-.72,2.24,1.04,7.53,3.54,11.07,5.16,4.74,2.16,5.07,7.27,5.24,11.79,0,.1,0,.21-.04.29-.15.31-.95.23-1.24.23-.57,0-1.42,0-1.99.03-1.13.05-2.23.03-3.36-.03-2.09-.1-4.11-1.03-5.47-2.17-.13-.11-.57-.24-.78-.02-.21.22-.14.57-.02.68.78.78,1.62,1.29,2.6,1.8,1.24.64,2.6.8,3.97.88,1.47.09,2.95.07,4.42-.09,1.23-.12,1.54-.21.33.69-1.06.79-2.3,1.36-3.55,1.78-1.79.61-3.69.91-5.58.96-1.15.03-2.29-.03-3.43-.18-.59-.07-1.17-.18-1.76-.24-.48-.05-.98-.14-1.45-.04-.43.09-.83.33-1.11.68-.37.49-.5,1.83-.29,2.41.42,1.13,1.34,1.78,2.3,2.36,1.05.62,2.43.84,2.7,2.03.06.25-2.18.26-2.43.25h-2.97s-1.62.04-2.24-.19c-.02,0-.04-.02-.06-.02-.34-.18-.49-.64-.61-.99-.17-.49-.46-.98-.81-1.48-.67-.96-1.7-2-2.78-2.4M67.76,11.07c0,1.74-1.41,3.15-3.15,3.15s-3.15-1.41-3.15-3.15,1.41-3.15,3.15-3.15,3.15,1.41,3.15,3.15'; // knockout: interior redrawn for dark backgrounds
const CHAM_W = 70.83, CHAM_H = 35.68, CHAM_ASPECT = CHAM_W / CHAM_H; // shared native box
const chameleonFor = v => (v && v.startsWith('neg')) ? CHAMELEON_NEG_D : CHAMELEON_POS_D;

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Weights measured from the brand source via stem-thickness analysis (resolution-
// independent): SUSE wordmark = SemiBold; the descriptor (product/program/team/
// event name) = Regular — NOT Medium, which reads a touch too bold; the event/team
// location (a city on its own line) = Light at a reduced size. See LOC_* below.
const FONT_SUSE = '/tools/brand-lockup/fonts/SUSE-SemiBold.otf'; // wordmark   (600)
const FONT_DESC = '/tools/brand-lockup/fonts/SUSE-Regular.otf';  // descriptor (400)
const FONT_LOC  = '/tools/brand-lockup/fonts/SUSE-Light.otf';    // location   (300)

// ── Design constants (base font size 40, cap-height 28) ───────────────────────
const BASE_FONT      = 320;   // 8× the source scale → crisp raster exports
const F              = 40;    // reference design unit
const GAP_CHAM_SUSE  = 9.51;  // horizontal: chameleon ink-right → SUSE ink-left
const GAP_WORD       = 12.60; // SUSE → descriptor (ink gap)
const VGAP_CHAM_SUSE = 6.40;  // stacked: chameleon bottom → SUSE cap-top
const LINE_H         = 40;    // stacked: baseline → baseline
const LOC_SCALE      = 0.70;  // event/team location cap-height vs the main name (≈0.70 in source)
const LOC_LEAD       = 33;    // stacked: previous baseline → location baseline (tighter than LINE_H)
const DESC_RESERVE   = 12;    // space reserved below the LAST baseline (font descender
                              // ~8.4 + margin) so g/y/p clear the edge on every last line
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

/** Render a line's words as one run in `fontUrl` (default descriptor), ink-left at x, baseline Yb. */
async function descLine(host, words, fontSize, fill, x, Yb, fontUrl = FONT_DESC) {
  if (!words.length) return null;
  const run = await shape(host, words.join(' '), fontUrl, fontSize);
  if (!run.bbox) return null;
  return {
    part: placed(run.d, fill, x - run.bbox.x1, Yb),
    inkRight: x + (run.bbox.x2 - run.bbox.x1),
    bottom: Yb + run.bbox.y2,
  };
}

// A name can carry a SUB-DESCRIPTOR the brand sets smaller + lighter on its own
// line (same treatment as a location): the "for …" qualifier ("SUSE Rancher" /
// "for SAP applications") and, for programs, the trailing "… Program" phrase
// ("SUSE One" / "Partner Program"). Returns [mainWords, qualifierWords] — the
// qualifier is [] when neither pattern applies, so ordinary names are untouched.
function splitQualifier(words, category) {
  const forIdx = words.findIndex((w, i) => i > 0 && w.toLowerCase() === 'for');
  if (forIdx > 0) return [words.slice(0, forIdx), words.slice(forIdx)];
  if (category === 'program' && words.length >= 3 && /^program$/i.test(words[words.length - 1])) {
    return [words.slice(0, words.length - 2), words.slice(words.length - 2)]; // "… / X Program"
  }
  return [words, []];
}

// ── Build the lockup SVG inner markup + dimensions ────────────────────────────
// layout: 'horizontal' (one line) | 'ontop' (chameleon over SUSE+name) |
//         'hybrid' (chameleon inline-left, SUSE+name wrap below — programs/services)
async function buildLockup({ host, name, location, layout, variant, wrapMode, background, category }) {
  const fs = BASE_FONT, k = fs / F;
  const col = COLORS[variant] || COLORS['pos-green'];
  const chamD = chameleonFor(variant); // positive vs negative/knockout artwork
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  const [mainWords, qualWords] = splitQualifier(words, category); // qualifier → smaller sub-line
  const locWords = (location || '').trim().split(/\s+/).filter(Boolean);

  const suse = await shape(host, 'SUSE', FONT_SUSE, fs);
  const suseInk = suse.bbox ? suse.bbox.x2 - suse.bbox.x1 : 0;
  const cap = suse.bbox ? -suse.bbox.y1 : 28 * k; // cap-top above baseline
  const gap2 = GAP_WORD * k;

  const parts = [];
  let W = 0, H = 0, lastBaseline = 0, lastScale = 1; // lastBaseline+lastScale drive reserved descender space

  if (layout === 'horizontal') {
    // chameleon inline-left, one baseline
    const chW = CHAM_W * k, chH = CHAM_H * k, Yb = cap; // chameleon top (=cap top) at y=0
    lastBaseline = Yb;
    parts.push(`<path fill="${col.mark}" d="${chamD}" transform="scale(${fmt(chW / CHAM_W)})"/>`);
    parts.push(placed(suse.d, col.text, chW + GAP_CHAM_SUSE * k - suse.bbox.x1, Yb));
    let right = chW + GAP_CHAM_SUSE * k + suseInk;
    let bottom = Math.max(chH, Yb + (suse.bbox ? suse.bbox.y2 : 0));
    const inlineWords = [...words, ...locWords];          // horizontal keeps location inline
    if (inlineWords.length) {
      const r = await descLine(host, inlineWords, fs, col.text, right + gap2, Yb);
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
    parts.push(`<path fill="${col.mark}" d="${chamD}" transform="scale(${fmt(chW / CHAM_W)})"/>`);

    // per-word advances + Medium space advance, for wrap accounting (main name only)
    const wordRuns = await Promise.all(mainWords.map(w => shape(host, w, FONT_DESC, fs)));
    const advs = wordRuns.map(r => r.advanceWidth);
    const [nn, n] = await Promise.all([shape(host, 'n n', FONT_DESC, fs), shape(host, 'n', FONT_DESC, fs)]);
    const spaceAdv = nn.advanceWidth - 2 * n.advanceWidth;

    // Smaller + lighter sub-lines (loc:true): the "for …" / "… Program" qualifier
    // first, then the event/team location. Their presence also pins a single-word
    // main name to the SUSE line.
    const subLines = [];
    if (qualWords.length) subLines.push(qualWords);
    if (locWords.length) subLines.push(locWords);

    // Brand convention: a single-word name sits on its OWN line under SUSE
    // (SUSE / Storage, SUSE / AI). Multi-word names flow after SUSE and wrap
    // ("SUSE AI" / Factory, "SUSE Linux" / "Enterprise Server"). But when a
    // sub-line follows ("SUSE Exchange" / "Madrid", "SUSE Rancher" / "for AWS"),
    // the name stays ON the SUSE line — a short name must NOT be wrapped off it by
    // a narrow wrapMode (always "SUSE Exchange" / city, never "SUSE" / "Exchange").
    let lines;
    if (subLines.length) {
      lines = mainWords.length <= 1
        ? [{ suse: true, words: mainWords }]                           // "SUSE Exchange" on one line
        : wrapWords(mainWords, advs, spaceAdv, suseInk + gap2, maxW);  // long names may still wrap
    } else if (mainWords.length <= 1) {
      lines = [{ suse: true, words: [] }, ...(mainWords.length ? [{ suse: false, words: mainWords }] : [])];
    } else if (mainWords.length === 2) {
      // Brand wraps two-word stacked names "SUSE word1" / "word2" (measured 10/11
      // sources: Cloud Observability, Linux Micro, Rancher Prime, Data Team, …),
      // regardless of wrapMode — so a wide default never keeps them on one line.
      lines = [{ suse: true, words: [mainWords[0]] }, { suse: false, words: [mainWords[1]] }];
    } else {
      lines = wrapWords(mainWords, advs, spaceAdv, suseInk + gap2, maxW); // 3+ words: greedy wrap
    }
    for (const sw of subLines) lines.push({ suse: false, loc: true, words: sw });
    let maxRight = chW, bottom = 0;
    // Baselines advance line-by-line: full lines by LINE_H, the smaller location
    // line by the tighter LOC_LEAD. The location renders in Light at LOC_SCALE.
    let Yb = firstBaseline;
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      if (li > 0) Yb += (ln.loc ? LOC_LEAD : LINE_H) * k;
      if (ln.suse) {
        parts.push(placed(suse.d, col.text, textX - suse.bbox.x1, Yb)); // SUSE ink-left at textX
        bottom = Math.max(bottom, Yb + suse.bbox.y2);
        let right = textX + suseInk;
        const r = await descLine(host, ln.words, fs, col.text, right + gap2, Yb);
        if (r) { parts.push(r.part); right = r.inkRight; bottom = Math.max(bottom, r.bottom); }
        maxRight = Math.max(maxRight, right);
      } else {
        const lfs = ln.loc ? fs * LOC_SCALE : fs;
        const font = ln.loc ? FONT_LOC : FONT_DESC;
        const r = await descLine(host, ln.words, lfs, col.text, textX, Yb, font);
        if (r) { parts.push(r.part); maxRight = Math.max(maxRight, r.inkRight); bottom = Math.max(bottom, r.bottom); }
      }
    }
    lastBaseline = Yb;
    lastScale = lines[lines.length - 1].loc ? LOC_SCALE : 1; // descender reserve tracks last line's size
    W = maxRight; H = Math.max(hybrid ? chH : 0, bottom);
  }

  // Reserve descender space below the last line — even when its glyphs have no
  // descender — so the bottom edge is consistent and g/y/p never clip.
  H = Math.max(H, lastBaseline + DESC_RESERVE * lastScale * k);
  W = Math.ceil(W * 100) / 100;
  H = Math.ceil(H * 100) / 100;

  const hasBg = background && background !== 'transparent';
  const bgRect = hasBg ? `<rect width="100%" height="100%" fill="${background}"/>` : '';
  // preview backdrop (not exported): bake colour for bg, else dark for negatives
  const surface = hasBg ? background : (variant.startsWith('neg') ? '#0c322c' : 'transparent');

  return { inner: bgRect + parts.join(''), w: W, h: H, surface };
}

// ── Export-dimension sync ─────────────────────────────────────────────────────
// The export bar should default to the lockup's natural size, but the user (or a
// URL width/height param) may override it — and that override must stick and
// reframe the canvas. The shell sizes the canvas from these fields and the SVG
// fills it with preserveAspectRatio, so any aspect stays centred (no reframing
// needed here). We only write a field when it's empty, still holds our last
// value, or — on first sync — only holds the manifest placeholder; a real
// user/URL value is left alone. RENDER_DEFAULT must match tool.json render.w/h.
const RENDER_DEFAULT_W = 1200, RENDER_DEFAULT_H = 1200;
let _initDone = false, _lastW = null, _lastH = null;

// `force` (used when switching back to Fit) overwrites whatever a size preset left
// behind; otherwise we only touch a field that's empty, holds our last value, or
// still shows the manifest placeholder — so manual/URL dims and presets stick.
function syncExportDims(w, h, force) {
  const wIn = document.querySelector('[data-action="export-width"]');
  const hIn = document.querySelector('[data-action="export-height"]');
  if (!wIn || !hIn) return;
  const rw = Math.round(w), rh = Math.round(h);
  const mine = (inp, last, def) => force ||
    inp.value === '' || inp.value === String(last) || (!_initDone && inp.value === String(def));
  let changed = false;
  if (mine(wIn, _lastW, RENDER_DEFAULT_W) && wIn.value !== String(rw)) { wIn.value = rw; changed = true; }
  if (mine(hIn, _lastH, RENDER_DEFAULT_H) && hIn.value !== String(rh)) { hIn.value = rh; changed = true; }
  _initDone = true; _lastW = rw; _lastH = rh;
  // When WE set the fields (user hasn't overridden), size the canvas to the
  // natural box and let the shell's fitCanvas scale it to the stage. If the user
  // owns the fields, their `input` already drove the shell's own canvas sizing,
  // so we leave it alone. canvas-resize avoids the URL-sync that `input` triggers.
  if (changed) {
    const canvas = document.getElementById('tool-canvas');
    if (canvas) {
      canvas.style.width = rw + 'px';
      canvas.style.height = rh + 'px';
      canvas.dispatchEvent(new CustomEvent('canvas-resize'));
    }
  }
}

// Team lockups always read "… Team" — append it when the Team type is chosen and
// the name doesn't already end in "Team" (so "Data" → "Data Team", "Data Team" stays).
function applyCategory(name, category) {
  const n = (name || '').trim();
  if (category === 'team' && n && !/\bteam$/i.test(n)) return `${n} Team`;
  return n;
}

// Location only applies to events and teams (a city/place on its own line).
const HAS_LOCATION = c => c === 'event' || c === 'team';

// Stacked layout depends on type: products and teams stack the chameleon ON TOP;
// programs and events use the inline-chameleon HYBRID, where the name (and the
// location) wrap below SUSE. Horizontal is always a single line.
function layoutFor(orientation, category) {
  if (orientation !== 'stacked') return 'horizontal';
  return (category === 'program' || category === 'event') ? 'hybrid' : 'ontop';
}

// Show the Location row only for the types that use it.
function toggleLocationRow(category) {
  const ctrl = document.querySelector('[data-input-id="location"]');
  const row = ctrl && ctrl.closest('.input-row');
  if (row) row.style.display = HAS_LOCATION(category) ? '' : 'none';
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function readModel(model) {
  const v = Object.fromEntries(model.map(i => [i.id, i.value]));
  const polarity  = v.polarity  || 'positive';
  const treatment = v.treatment || 'colour';
  const category  = v.category || 'product';
  return {
    name:       applyCategory(v.name ?? '', category),
    location:   HAS_LOCATION(category) ? (v.location || '').trim() : '',
    layout:     layoutFor(v.orientation || 'horizontal', category),
    variant:    variantFor(polarity, treatment),
    wrapMode:   v.wrapMode || 'compact',
    background: v.background || 'transparent',
    size:       v.size || 'fit',
    category,
  };
}

let _lastSize = null;

async function render({ model, host }) {
  const opts = readModel(model);
  host.text.preload(FONT_SUSE).catch(() => {});
  host.text.preload(FONT_DESC).catch(() => {});
  const { inner, w, h, surface } = await buildLockup({ host, ...opts });
  // In Fit mode we drive the export box to the lockup's natural size; the fixed
  // sizes are owned by the shell's size-driver, so we leave the box alone (the SVG
  // just centres inside it via preserveAspectRatio). Force a re-fit on the switch
  // back to Fit so a preset's leftover dimensions don't stick.
  const fit = opts.size === 'fit';
  const force = fit && _lastSize !== 'fit';
  _lastSize = opts.size;
  setTimeout(() => {
    if (fit) syncExportDims(w, h, force);
    toggleLocationRow(opts.category);
  }, 0);
  return { inner, w, h, surface };
}

async function onInit(ctx)  { return render(ctx); }
async function onInput(ctx) { return render(ctx); }
