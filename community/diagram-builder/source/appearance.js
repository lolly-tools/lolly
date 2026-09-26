// SPDX-License-Identifier: MPL-2.0
// Tool data, assembled into hooks.js by scripts/build-diagram-hooks.ts.
const DB_LOOKS = { minimal: 1, editorial: 1, soft: 1, flow: 1, studio: 1 };
const DB_BASE = {
  cardWidth: 208, cardScale: 1, rowGap: 76, siblingGap: 32,
  cornerRadius: 12, radiusMode: 'design', canvasPadding: 44, labelSize: 16, labelWeight: 600,
  cardBorderWidth: 1, connectorWidth: 1.75, arrowWidth: 1.75,
  arrowHead: 'open', arrowHeadSizing: 'auto', gridBg: 'none', theme: 'custom',
  connectionRoute: 'auto', connectionPaint: 'solid', connectionForm: 'line',
  bendRadius: 16, cardDepth: 0, lineDepth: 0, directionMarkers: 'infer',
  focalEmphasis: 'none', surfaceHighlight: 0
};
export function dbRecipe(look) {
  const recipe = Object.assign({}, DB_BASE);
  if (look === 'editorial') { recipe.cornerRadius = 5; recipe.focalEmphasis = 'first'; }
  if (look === 'soft') recipe.cardDepth = 1;
  if (look === 'flow' || look === 'studio') {
    recipe.connectionRoute = 'curve'; recipe.connectionPaint = 'gradient';
    recipe.cardDepth = look === 'studio' ? 1.5 : 0.5;
    recipe.lineDepth = look === 'studio' ? 0.5 : 0;
    if (look === 'studio') { recipe.focalEmphasis = 'first'; recipe.surfaceHighlight = 1; }
  }
  return recipe;
}
export function dbSeed(model, inp, changedId) {
  const patch = {}, supplied = {};
  model.forEach((item) => { if (item.isDirty) supplied[item.id] = true; });
  const fresh = changedId === null && !Object.keys(supplied).length;
  const selected = supplied.look && DB_LOOKS[inp.look];
  if (fresh) patch.look = 'minimal';
  const look = patch.look || inp.look;
  if (!DB_LOOKS[look]) return patch;
  if (changedId === 'cornerRadius') patch.radiusMode = 'custom';
  const reset = changedId === 'resetLook' && inp.resetLook;
  if (fresh || (changedId === null && selected) || changedId === 'look' || reset) {
    const recipe = dbRecipe(look);
    Object.keys(recipe).forEach((id) => {
      if (reset || changedId === 'look' || !supplied[id]) patch[id] = recipe[id];
    });
    if (changedId === null && supplied.cornerRadius && !supplied.radiusMode) patch.radiusMode = 'custom';
    ['nodeFill', 'nodeStroke', 'nodeText', 'edgeColor', 'background'].forEach((id) => {
      if (reset || !supplied[id]) patch[id] = '';
    });
    if (reset) patch.resetLook = false;
    if (fresh || !supplied.layers) patch.layers = arr(inp.layers).map((layer) => Object.assign({}, layer, { bandFill: '' }));
  }
  return patch;
}
export function dbMix(a, b, t) {
  if (host.color?.mix) return host.color.mix(a, b, t, { space: 'oklab' }) || a;
  return mixHex(a, b, t);
}
export function dbInk(fill, preferred, ratio) {
  const base = inkOn(fill, preferred);
  if (host.color?.contrast && host.color.contrast(preferred, fill) >= ratio) return preferred;
  if (host.color?.contrast && host.color.contrast(base, fill) >= ratio) return base;
  return relLuminance(fill) > 0.18 ? '#17191c' : '#ffffff';
}
export async function dbAppearance(inp) {
  let swatches = [], set = null, themes = [], opts;
  if (host.tokens) {
    try {
      themes = host.tokens.themes ? await host.tokens.themes() : [];
      const match = inp.colourMode !== 'system' && themes.find((t) => t.name.toLowerCase() === inp.colourMode);
      if (match) opts = { theme: match.name };
      if (host.tokens.colors) swatches = await host.tokens.colors(opts);
      if (host.tokens.get) set = await host.tokens.get(opts);
    } catch (_err) { note('Some design-system values are unavailable. Neutral defaults are in use.'); }
  }
  const map = {};
  swatches.forEach((s) => { if (/^#[0-9a-f]{6}$/i.test(s.value)) map[s.path] = s.value; });
  function slot(name, fallback) { return map['color.semantic.' + name] || fallback; }
  let surface = slot('surface', '#ffffff'), ink = slot('text', '#20272c');
  if (!opts && inp.colourMode === 'dark' && relLuminance(surface) > 0.3) { surface = '#172027'; ink = '#f5f7f8'; }
  if (!opts && inp.colourMode === 'light' && relLuminance(surface) < 0.3) { surface = '#ffffff'; ink = '#20272c'; }
  const primary = slot('primary', ink), secondary = slot('secondary', primary);
  let bg = color(inp.background, surface), card = color(inp.nodeFill, surface);
  if (!inp.nodeFill && (inp.look === 'soft' || inp.look === 'studio')) card = dbMix(surface, ink, relLuminance(surface) < 0.3 ? 0.06 : 0.015);
  if (!inp.background && (inp.look === 'soft' || inp.look === 'studio')) bg = dbMix(surface, primary, relLuminance(surface) < 0.3 ? 0.02 : 0.045);
  let font = 'sans-serif', mono = 'monospace';
  async function token(path) {
    try { return set ? set.resolve('{' + path + '}') : host.tokens?.resolve ? await host.tokens.resolve('{' + path + '}', opts) : null; }
    catch (_err) { return null; }
  }
  function family(v, fallback) { return Array.isArray(v) ? v.join(', ') : typeof v === 'string' && v && v[0] !== '{' ? v : fallback; }
  font = family(await token('font.brand'), font); mono = family(await token('font.mono'), mono);
  const body = await token('typography.body');
  if (body?.fontFamily) font = family(body.fontFamily, font);
  const radius = await token('shape.radius'), base = await token('space.base');
  function dimension(v) { if (v && typeof v === 'object') return v.unit === 'px' ? Number(v.value) : null; return typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?px$/.test(v) ? parseFloat(v) : null; }
  const gradients = set?.query ? set.query({ type: 'gradient' }) : [];
  const shadows = set?.query ? set.query({ type: 'shadow' }) : [];
  const shadowEntry = shadows.find((s) => s.path === 'shadow.card' || s.path === 'shadow.medium') || (shadows.length === 1 ? shadows[0] : null);
  let shadow = shadowEntry?.value;
  if (Array.isArray(shadow)) shadow = shadow[0];
  const elevation = shadow && typeof shadow === 'object' ? {
    x: clamp(dimension(shadow.offsetX) || 0, -8, 8), y: clamp(dimension(shadow.offsetY) || 3, -8, 8),
    blur: clamp(dimension(shadow.blur) || 8, 1, 12), colour: color(shadow.color, '#10191d')
  } : null;
  return { primary: primary, secondary: secondary, surface: surface, bg: bg, card: card,
    ink: color(inp.nodeText, ink), detail: slot('muted', dbMix(ink, card, 0.3)),
    edge: color(inp.edgeColor, dbInk(bg === 'transparent' ? surface : bg, primary, 3)),
    border: color(inp.nodeStroke, slot('edge', dbMix(ink, card, 0.75))),
    font: font, mono: mono, radius: dimension(radius), space: dimension(base), elevation: elevation,
    gradient: gradients.find((g) => g.path === inp.gradientToken) || (gradients.length === 1 ? gradients[0] : null)
  };
}
export function dbHash(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return h >>> 0; }
export function dbAccent(n, nodes, S) {
  let root = n, visited = new Set();
  while (root.parentId && !visited.has(root.id)) {
    visited.add(root.id);
    const parent = nodes.find((other) => other.id === root.parentId);
    if (!parent?.parentId) break;
    root = parent;
  }
  const key = n.layerId || root.id;
  return dbMix(S.brand.primary, S.brand.secondary, (dbHash(key) % 5) / 4);
}
export function dbStyle(S, inp, nodes) {
  S.modern = true; S.look = inp.look; S.brand = inp._brand; S.inp = inp;
  S.nodeFill = S.brand.card; S.nodeStroke = S.brand.border; S.nodeText = S.brand.ink;
  S.detailColor = S.brand.detail; S.edgeColor = S.brand.edge;
  S.detailSize = Math.max(12, Math.round(S.labelSize * 0.8125)); S.detailLH = Math.round(S.detailSize * 1.38);
  S.labelLH = Math.round(S.labelSize * 1.375); S.cardPadV = Math.round(16 * S.scale);
  if (S.brand.space) S.cardPadV = clamp(S.brand.space * 4, 12, 20) * S.scale;
  S.bandPalette = [0.9, 0.84, 0.78, 0.72].map((t) => dbMix(S.brand.secondary, S.brand.surface, t));
  S.cornerRadius = inp.radiusMode === 'design' && S.brand.radius !== null ? clamp(S.brand.radius * (S.look === 'editorial' ? 0.45 : 1), 0, 28) : S.cornerRadius;
  if (nodes.length > 300) throw new Error('Use at most 300 cards per diagram.');
  nodes.forEach((n) => { n.accent = dbAccent(n, nodes, S); });
}

export function dbCanvasAttrs(ref, label, settings) {
  return ' data-canvas-input="' + esc(ref) + '" data-canvas-name="' + esc(label) + '" data-canvas-settings="' + esc(settings || '') + '" tabindex="0" role="button" aria-label="' + esc(label) + '"';
}
export function dbCardAttrs(n, S) {
  const ref = S.sourceInput === 'nodes' ? 'nodes:' + n.idx : S.sourceInput;
  const settings = S.sourceInput === 'nodes' ? ['label', 'detail', 'shape', 'fill', 'emphasis'].map((field) => ref + ':' + field).join(' ') : '';
  return dbCanvasAttrs(ref, n.label || n.id, settings + ' cardDepth focalEmphasis surfaceHighlight');
}
