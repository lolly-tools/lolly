/* global onInit, onInput, host */

// A raster library asset shown when the user hasn't picked an image yet, so the
// tool demonstrates the effect on load. Same default as filter-scanline /
// filter-halftone, kept in sync deliberately.
var DEFAULT_IMAGE_ID = 'suse/headshots/andy-fitzsimon';

// Resolved URL of the demo default asset, cached so repeated input changes don't
// re-fetch it. Stays null until the first lookup succeeds.
var _defaultUrl = null;

function hexToChannels(hex) {
  const c = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

function ch(n) {
  return parseFloat(n.toFixed(4));
}

function buildDuo(inputs) {
  const fg = hexToChannels(inputs.colorFg);
  const bg = hexToChannels(inputs.colorBg);
  return {
    tableR: `${ch(fg.r)} ${ch(bg.r)}`,
    tableG: `${ch(fg.g)} ${ch(bg.g)}`,
    tableB: `${ch(fg.b)} ${ch(bg.b)}`,
  };
}

async function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const out = buildDuo(inputs);

  // No image picked → fall back to the shared demo image (resolved once), exposed
  // to the template as an extra. The template uses {{asset bgImage}} for the
  // user's own pick and {{defaultImageUrl}} for this fallback.
  if (!inputs.bgImage) {
    if (!_defaultUrl) {
      try { const def = await host.assets.get(DEFAULT_IMAGE_ID); _defaultUrl = def && def.url; }
      catch (e) { if (host.log) host.log('warn', 'filter-duotone: default image unavailable', { error: String(e) }); }
    }
    if (_defaultUrl) out.defaultImageUrl = _defaultUrl;
  }

  return out;
}

function onInit(ctx) {
  return patch(ctx);
}

function onInput(ctx) {
  return patch(ctx);
}
