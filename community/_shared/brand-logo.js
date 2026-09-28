// === lolly:shared brand-logo - canonical source; edit here and run pnpm run sync:shared ===
// Resolve only slots declared by the active design system. Catalogue tags describe
// available artwork; they do not say which identity the person selected.
async function resolveBrandLogo(dark, mono) {
  if (!host.tokens || !host.tokens.resolve || !host.assets || !host.assets.get) return null;
  var suffix = dark ? '-reverse' : '';
  var treatments = mono ? ['mono', 'primary'] : ['primary', 'mono'];
  for (var t = 0; t < treatments.length; t++) {
    for (var o = 0; o < 2; o++) {
      var variant = (o ? 'vertical-' : 'horizontal-') + treatments[t] + suffix;
      try {
        var id = await host.tokens.resolve('{asset.logo.' + variant + '}');
        if (typeof id !== 'string' || !id.trim() || id.indexOf('{') !== -1) continue;
        var asset = await host.assets.get(id);
        if (asset && typeof asset.url === 'string' && asset.url) return asset;
      } catch { /* Try another declared slot on the same background. */ }
    }
  }
  return null;
}

var _lastBrandLogoWarning = '';
function brandLogoWarning(missing) {
  var message = missing
    ? 'A logo for this background is unavailable in the active design system. Add a matching mark in Logos, or turn off the logo.'
    : '';
  if (message && message !== _lastBrandLogoWarning && host.log) host.log('warn', message);
  _lastBrandLogoWarning = message;
  return message;
}
// === /lolly:shared brand-logo ===
