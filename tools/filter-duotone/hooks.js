/* global onInit, onInput, onFrame, host */

// A raster library asset shown when the user hasn't picked an image yet, so the
// tool demonstrates the effect on load. Same default as filter-scanline /
// filter-halftone, kept in sync deliberately.
// A Lolly tool URL (bag-video → PNG), resolved via host.compose. A plain catalog
// id still works (the resolver below branches on whether this is a URL).
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';

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
      try {
        // Tool URL → render via compose; plain catalog id → host.assets.
        const def = (DEFAULT_IMAGE_ID.indexOf('://') !== -1)
          ? (host.compose && host.compose.renderUrl ? await host.compose.renderUrl(DEFAULT_IMAGE_ID) : null)
          : await host.assets.get(DEFAULT_IMAGE_ID);
        _defaultUrl = def && def.url;
      }
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

// Live camera (engine v1.4): the runtime calls this once per frame with raw RGBA
// pixels. Unlike the pixel-tracing filters, duotone is a browser SVG filter on an
// <image>, so we just hand the frame back as the image source (a data URL) plus the
// current colour tables — the browser applies the #duo filter to it (GPU-fast). The
// template renders it as #duo-live (see template.html), so the framing script skips
// re-probing a fresh data URL every frame. null = no patch (last frame stays).
function onFrame({ frame, model }) {
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (typeof document === 'undefined' || typeof ImageData === 'undefined') return null;
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  let liveSrc;
  try {
    const c = document.createElement('canvas');
    c.width = frame.width; c.height = frame.height;
    c.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
    // JPEG: cheap to encode and the duotone filter discards colour fidelity anyway.
    liveSrc = c.toDataURL('image/jpeg', 0.85);
  } catch (e) { return null; }
  return Object.assign(buildDuo(inputs), { liveSrc });
}
