/* global onInit, onInput, exportFile */
/**
 * Convert Font - reads a dropped font, reports what its own tables say, and hands
 * back bytes named for the chosen target. The container swap (TTF/OTF to and from
 * WOFF) is done by the shell's export.file(), because a tool hook cannot reach the
 * engine's sfnt/WOFF codecs. Nothing leaves the device.
 *
 * Where the shell provides host.fonts, the card also shows the outline format,
 * family and style, weights and named styles, glyph and character counts, the
 * Unicode blocks covered and the font's own embedding statement, and the export
 * can subset the font to chosen characters. host.fonts refuses a font whose
 * fsType forbids subsetting and checks the subset's bytes before returning them;
 * this hook only reports and asks. Without host.fonts the tool still converts
 * containers and says the details need a newer Lolly. WOFF2 is detected but
 * neither read nor written (no in-tree Brotli codec).
 */

/** sfnt / WOFF magic (uint32 BE) - inlined; the hook has no engine access. */
function fontKind(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const m = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  if (m === 0x00010000 || m === 0x74727565) return 'ttf';  // TrueType / 'true'
  if (m === 0x4f54544f) return 'otf';                       // 'OTTO' (CFF)
  if (m === 0x774f4646) return 'woff';                      // 'wOFF'
  if (m === 0x774f4632) return 'woff2';                     // 'wOF2'
  return null;
}

function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

const fmtCount = (n) => Number(n || 0).toLocaleString('en');

const KIND_LABEL = { ttf: 'TrueType', otf: 'OpenType (CFF)', woff: 'WOFF', woff2: 'WOFF2' };
const TARGET_LABEL = { ttf: 'TrueType (.ttf)', otf: 'OpenType (.otf)', woff: 'Web font (.woff)' };
const OUTLINE_LABEL = {
  truetype: 'TrueType outlines (glyf)',
  cff: 'PostScript outlines (CFF)',
  cff2: 'Variable PostScript outlines (CFF2)',
  bitmap: 'Bitmap glyphs only',
  none: 'No outlines found',
};
const EMBEDDING_LABEL = {
  installable: 'Installable: no embedding restriction stated',
  editable: 'Editable embedding allowed',
  'preview-print': 'Preview and print embedding only',
  restricted: 'Restricted: must not be embedded or changed',
  unstated: 'Not stated (the font has no OS/2 table)',
};
// Mirrors engine/src/font-subset-policy.ts; host.fonts enforces the real rule.
const REFUSAL_NOTE = {
  outlines: 'Subsetting works on TrueType outlines only, so this font is not subset.',
  restricted: 'This font says it must not be embedded or changed, so it is not subset.',
  'no-subsetting': 'This font says it must not be subset, so it is not subset.',
  'bitmap-only': 'This font allows only bitmap embedding, so its outlines are not subset.',
  unstated: 'This font states no embedding permission, so it is not subset.',
};

/** Code point lists for the preset subsets, built from numbers so no literal glyph hides in source. */
function range(first, last) {
  let out = '';
  for (let cp = first; cp <= last; cp++) out += String.fromCodePoint(cp);
  return out;
}
const PRESETS = {
  latin: () => range(0x20, 0x7e),
  western: () => range(0x20, 0x7e) + range(0xa0, 0xff)
    + String.fromCodePoint(0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x20ac, 0x2122),
};

function keepText(mode, characters) {
  if (PRESETS[mode]) return PRESETS[mode]();
  return mode === 'text' ? String(characters || '') : '';
}

/** Distinct requested code points, ignoring control characters and line breaks (as host.fonts does). */
function requested(text) {
  const seen = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
    seen.add(cp);
  }
  return [...seen];
}

function covered(ranges, cp) {
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < ranges[mid][0]) hi = mid - 1;
    else if (cp > ranges[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}

function supportsTarget(bytes, target) {
  const kind = fontKind(bytes);
  const outline = kind === 'woff' && bytes.length >= 44 ? fontKind(bytes.subarray(4, 8)) : kind;
  return (outline === 'ttf' || outline === 'otf') && (target === 'woff' || target === outline);
}

/** Card rows from a host.fonts inspection. Every value is plain text, escaped by the template. */
function describe(info) {
  const wght = (info.axes || []).find((axis) => axis.tag === 'wght');
  const weight = wght
    ? `${wght.min} to ${wght.max} (variable, default ${wght.default})`
    : `${info.weight.value}${info.style ? ` (${info.style})` : ''}`;
  const named = (info.instances || []).map((instance) => instance.name);
  const otherAxes = (info.axes || []).filter((axis) => axis.tag !== 'wght' && !axis.hidden)
    .map((axis) => `${axis.name} ${axis.min} to ${axis.max}`);
  const blocks = (info.coverage.blocks || []).slice().sort((a, b) => b.characters - a.characters);
  const shown = blocks.slice(0, 8).map((block) => `${block.name} ${fmtCount(block.characters)}`);
  const more = blocks.length - shown.length;
  const flags = [];
  if (info.embedding.noSubsetting) flags.push('no subsetting');
  if (info.embedding.bitmapOnly) flags.push('bitmap embedding only');
  const raw = info.embedding.fsType === null ? '' : ` (fsType 0x${info.embedding.fsType.toString(16).padStart(4, '0')})`;
  return [
    { label: 'Outlines', value: OUTLINE_LABEL[info.outlines] || info.outlines },
    { label: 'Family', value: [info.family, info.style].filter(Boolean).join(' ') || 'Not named' },
    { label: 'Weight', value: weight },
    named.length ? { label: 'Named styles', value: named.slice(0, 12).join(', ') + (named.length > 12 ? ` and ${named.length - 12} more` : '') } : null,
    otherAxes.length ? { label: 'Other axes', value: otherAxes.join(', ') } : null,
    { label: 'Glyphs', value: `${fmtCount(info.glyphs)} glyphs, ${fmtCount(info.coverage.characters)} characters mapped` },
    { label: 'Coverage', value: shown.length ? shown.join(', ') + (more > 0 ? ` and ${more} more blocks` : '') : 'No characters mapped' },
    { label: 'Embedding', value: `${EMBEDDING_LABEL[info.embedding.permission] || info.embedding.permission}${flags.length ? `, ${flags.join(', ')}` : ''}${raw}. This is the font's own statement, not its licence.` },
  ].filter(Boolean);
}

function subsetStatus(info, mode, characters, hasFonts) {
  if (mode === 'all') return '';
  if (!hasFonts) return 'Subsetting needs a newer version of Lolly. Choose "Keep every glyph" to convert without a subset.';
  if (!info) return 'This font could not be read, so it cannot be subset.';
  if (info.subsetRefusal) return REFUSAL_NOTE[info.subsetRefusal] || 'This font is not subset.';
  const wanted = requested(keepText(mode, characters));
  if (!wanted.length) return 'Type the characters to keep.';
  const missing = wanted.filter((cp) => !covered(info.coverage.ranges, cp));
  const kept = wanted.length - missing.length;
  if (!kept) return 'None of those characters are in this font.';
  const list = missing.slice(0, 12).map((cp) => String.fromCodePoint(cp)).join(' ');
  return `The subset keeps ${fmtCount(kept)} of ${fmtCount(wanted.length)} characters and their glyph ids, and is checked before it is saved.`
    + (missing.length ? ` Not in this font: ${list}${missing.length > 12 ? ` and ${missing.length - 12} more` : ''}.` : '');
}

const inspected = { bytes: null, result: null };

async function patch({ model }) {
  const inputs = Object.fromEntries(model.map((i) => [i.id, i.value]));
  const f = inputs.source;
  const target = inputs.target || 'woff';
  const mode = inputs.subset || 'all';
  if (!f || !f.bytes) return { hasFile: false };

  const kind = fontKind(f.bytes);
  const kindLabel = KIND_LABEL[kind] || 'Unknown';
  const targetLabel = TARGET_LABEL[target] || target;
  const convertible = supportsTarget(f.bytes, target);
  const hasFonts = !!(host && host.fonts && typeof host.fonts.inspect === 'function');

  let info = null;
  let detailsNote = '';
  if (kind && kind !== 'woff2') {
    if (hasFonts) {
      // Typing in the characters field re-runs this hook; read the same bytes once.
      if (inspected.bytes !== f.bytes) {
        inspected.bytes = f.bytes;
        inspected.result = Promise.resolve().then(() => host.fonts.inspect(f.bytes)).then(
          (result) => ({ info: result, error: '' }),
          (e) => ({ info: null, error: (e && e.message) || 'The font tables could not be read.' }),
        );
      }
      const read = await inspected.result;
      info = read.info;
      detailsNote = read.error;
    } else {
      detailsNote = 'Coverage, weights and embedding details need a newer version of Lolly.';
    }
  }

  const note = !kind
    ? "This doesn't look like a font file (no sfnt or WOFF signature)."
    : kind === 'woff2'
      ? 'WOFF2 is recognised but not convertible yet (it needs a Brotli encoder). Use a TTF, OTF or WOFF source.'
      : !convertible
        ? 'TTF and OTF use different glyph outlines. Choose WOFF or the original outline format; this tool does not redraw glyphs.'
      : kind === target && mode === 'all'
        ? `Already ${kindLabel}. Downloading re-wraps it unchanged.`
        : `${kindLabel} to ${targetLabel}. ${mode === 'all' ? 'The glyph outlines pass through untouched; only the container changes.' : 'The kept glyph outlines pass through untouched.'}`;

  return {
    hasFile: true,
    fileName: f.name || 'font',
    fileSize: fmtBytes(f.bytes.length),
    currentFormat: kindLabel,
    targetLabel,
    convertible,
    note,
    details: info ? describe(info) : [],
    detailsNote,
    subsetNote: subsetStatus(info, mode, inputs.characters, hasFonts),
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

async function exportFile({ model }) {
  const inputs = Object.fromEntries(model.map((i) => [i.id, i.value]));
  const f = inputs.source;
  if (!f || !f.bytes) throw new Error('Choose a font file first.');
  const kind = fontKind(f.bytes);
  if (!kind) throw new Error("That doesn't look like a font file.");
  if (kind === 'woff2') throw new Error('WOFF2 input is not convertible yet (no Brotli decoder). Try a TTF, OTF or WOFF.');

  const target = inputs.target || 'woff';
  if (!supportsTarget(f.bytes, target)) throw new Error('That outline conversion is not supported. Choose WOFF or the original outline format.');
  const mode = inputs.subset || 'all';
  let bytes = f.bytes;
  if (mode !== 'all') {
    if (!host || !host.fonts || typeof host.fonts.subset !== 'function') {
      throw new Error('Subsetting needs a newer version of Lolly. Choose "Keep every glyph" to convert without a subset.');
    }
    // host.fonts refuses restricted fonts and verifies the output; a refusal fails this export visibly.
    bytes = (await host.fonts.subset(f.bytes, { text: keepText(mode, inputs.characters) })).bytes;
  }
  const base = (f.name || 'font').replace(/\.(ttf|otf|woff2?|sfnt|ttc)$/i, '') || 'font';
  const mime = target === 'woff' ? 'font/woff' : target === 'otf' ? 'font/otf' : 'font/ttf';
  // Named for the target. export.file() performs the container swap via the
  // engine's sfntToWoff/woffToSfnt (keyed on this filename extension vs the bytes);
  // a subset arrives as a TrueType sfnt and is rewrapped the same way.
  return { bytes, mime, filename: `${base}${mode === 'all' ? '' : '-subset'}.${target}` };
}
