/* global onInit, onInput */

/**
 * color-block hook.
 *
 * Two jobs, both data-only (no DOM — the template's controller owns layout):
 *
 *   1. Resolve the two mono SUSE logo marks (white for dark corners, black for
 *      light) once, cached, and expose them as extras. The controller swaps
 *      between them based on the block actually under the logo's corner.
 *
 *   2. Compute each block's effective background and foreground colour:
 *        - background: the block's own colour, or the next SUSE palette colour
 *          if it set none (so a freshly-added block looks intentional).
 *        - foreground: the user's override, else black or white — whichever has
 *          the higher contrast on that background (white over a photo, since the
 *          image content is unknown).
 *      These land in `blockBg` / `blockFg`, parallel arrays the template applies
 *      by index. Doing it here (not in the controller) means the colours are
 *      correct even where the layout JS can't run.
 */

// SUSE palette cycled for blocks that haven't picked a background.
const PALETTE = ['#0c322c', '#30ba78', '#ffffff', '#90ebcd', '#01564a'];
const INK_DARK = '#0c322c';   // the SUSE near-black used as "black"
const INK_LIGHT = '#ffffff';

function relLuminance(hex) {
  const s = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s)) return null;
  const h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : s;
  const lin = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}

// WCAG contrast ratio between two luminances.
function contrast(l1, l2) {
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// Black or white — whichever reads better on this background.
function inkFor(bgHex) {
  const l = relLuminance(bgHex);
  if (l === null) return INK_LIGHT;
  const dl = relLuminance(INK_DARK), ll = relLuminance(INK_LIGHT);
  return contrast(l, dl) >= contrast(l, ll) ? INK_DARK : INK_LIGHT;
}

// Module-scoped cache so logo assets resolve once, not on every keystroke.
let logoCache;
async function resolveLogos() {
  if (logoCache) return logoCache;
  try {
    const [white, black] = await Promise.all([
      host.assets.get('suse/logo/hor-neg-white'),
      host.assets.get('suse/logo/hor-pos-black'),
    ]);
    logoCache = { logoWhite: white, logoBlack: black };
  } catch (e) {
    host.log('warn', 'color-block: logo assets unavailable', { error: String(e) });
    logoCache = { logoWhite: null, logoBlack: null };
  }
  return logoCache;
}

function colours(blocks) {
  const blockBg = [];
  const blockFg = [];
  blocks.forEach((b, i) => {
    const hasImage = !!(b && b.bgImage);
    const bg = (b && String(b.bgColor || '').trim()) || PALETTE[i % PALETTE.length];
    const fg = (b && String(b.fgColor || '').trim()) || (hasImage ? INK_LIGHT : inkFor(bg));
    blockBg.push(bg);
    blockFg.push(fg);
  });
  return { blockBg, blockFg };
}

async function patch({ model }) {
  const blocksInput = model.find(i => i.id === 'blocks');
  const blocks = Array.isArray(blocksInput?.value) ? blocksInput.value : [];
  const logos = await resolveLogos();
  return { ...logos, ...colours(blocks) };
}

function onInit(ctx) { return patch(ctx); }

// Recompute only when the blocks themselves change — typing in another control
// (or moving the logo) leaves the colour arrays intact.
function onInput(ctx) {
  if (ctx.id === 'blocks') return patch(ctx);
}
