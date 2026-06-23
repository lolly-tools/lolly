/* global onInit, onInput */

/**
 * Resolve the corner brand logo (see tools/tool-logo for the standalone
 * reference). The right SVG variant is chosen from the THEME's darkness — neg
 * for dark themes, pos for light — and the logo style (mono vs brand green).
 * Horizontal lockup, since it sits in a corner. The resolved AssetRef lands in
 * `extras.brandLogo`; the template places it when `logo` (the corner) is set.
 */

// Mirror the theme background colours defined in template.html's <style>.
const THEME_BG = {
  pine: '#0c322c', jungle: '#30ba78', white: '#ffffff',
};

function relLuminance(hex) {
  const s = String(hex || '#000000').replace('#', '');
  const h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  const lin = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}

function logoId(inputs) {
  const dark = relLuminance(THEME_BG[inputs.theme] || THEME_BG.pine) < 0.5;
  const ink  = inputs.logoStyle === 'brand' ? 'green' : (dark ? 'white' : 'black');
  return `suse/logo/hor-${dark ? 'neg' : 'pos'}-${ink}`;
}

async function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  if (!inputs.logo || inputs.logo === 'none') return { brandLogo: null };
  const id = logoId(inputs);
  try {
    return { brandLogo: await host.assets.get(id) };
  } catch (e) {
    host.log('warn', 'dynamic-layout: logo not found', { id, error: String(e) });
    return { brandLogo: null };
  }
}

function onInit(ctx) { return patch(ctx); }

// Only re-resolve when something that affects the logo changed — typing in the
// heading shouldn't re-fetch it. Returning nothing leaves the prior extra intact.
function onInput(ctx) {
  if (ctx.id === 'logo' || ctx.id === 'logoStyle' || ctx.id === 'theme') return patch(ctx);
}
