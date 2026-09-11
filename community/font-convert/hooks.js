/* global onInit, onInput, exportFile */
/**
 * Convert Font - reads a dropped font, reports its container, and hands back the
 * source bytes named for the chosen target. The actual container swap (TTF/OTF ⇄
 * WOFF) is done by the shell's export.file(), because a tool hook cannot reach the
 * engine's sfnt/WOFF codecs. Nothing leaves the device; the glyph outlines are
 * never touched, only the wrapper. WOFF2 is read-detected but not written (no
 * in-tree Brotli encoder).
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

const KIND_LABEL = { ttf: 'TrueType', otf: 'OpenType (CFF)', woff: 'WOFF', woff2: 'WOFF2' };
const TARGET_LABEL = { ttf: 'TrueType (.ttf)', otf: 'OpenType (.otf)', woff: 'Web font (.woff)' };

function supportsTarget(bytes, target) {
  const kind = fontKind(bytes);
  const outline = kind === 'woff' && bytes.length >= 44 ? fontKind(bytes.subarray(4, 8)) : kind;
  return (outline === 'ttf' || outline === 'otf') && (target === 'woff' || target === outline);
}

function patch({ model }) {
  const inputs = Object.fromEntries(model.map((i) => [i.id, i.value]));
  const f = inputs.source;
  const target = inputs.target || 'woff';
  if (!f || !f.bytes) return { hasFile: false };

  const kind = fontKind(f.bytes);
  const kindLabel = KIND_LABEL[kind] || 'Unknown';
  const targetLabel = TARGET_LABEL[target] || target;
  const convertible = supportsTarget(f.bytes, target);
  const note = !kind
    ? "This doesn't look like a font file (no sfnt or WOFF signature)."
    : kind === 'woff2'
      ? 'WOFF2 is read-detected but not convertible yet (it needs a Brotli encoder). Use a TTF, OTF or WOFF source.'
      : !convertible
        ? 'TTF and OTF use different glyph outlines. Choose WOFF or the original outline format; this tool does not redraw glyphs.'
      : kind === target
        ? `Already ${kindLabel}. Downloading re-wraps it unchanged.`
        : `${kindLabel} to ${targetLabel}. The glyph outlines pass through untouched; only the container changes.`;

  return {
    hasFile: true,
    fileName: f.name || 'font',
    fileSize: fmtBytes(f.bytes.length),
    currentFormat: kindLabel,
    targetLabel,
    convertible,
    note,
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
  const base = (f.name || 'font').replace(/\.(ttf|otf|woff2?|sfnt|ttc)$/i, '') || 'font';
  const mime = target === 'woff' ? 'font/woff' : target === 'otf' ? 'font/otf' : 'font/ttf';
  // Source bytes, named for the target. export.file() performs the container swap via
  // the engine's sfntToWoff/woffToSfnt (keyed on this filename extension vs the bytes).
  return { bytes: f.bytes, mime, filename: `${base}.${target}` };
}
