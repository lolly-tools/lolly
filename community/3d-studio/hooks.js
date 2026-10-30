// SPDX-License-Identifier: MPL-2.0

// The controls a saved studio carries (plan 265 step 2). Tools never import from the
// engine, so the list is data here too; tests/studio3d-look.test.ts fails if it drifts
// from the engine's STUDIO_LOOK_INPUT_IDS.
const STUDIO_LOOK_INPUTS = [
  'studio',
  'materialMode',
  'colorA',
  'colorB',
  'finishA',
  'finishB',
  'glow',
  'surfaceFinishes',
  'faceFinishA',
  'bevelFinishA',
  'sideFinishA',
  'faceFinishB',
  'bevelFinishB',
  'sideFinishB',
  'drama',
  'softness',
  'exposure',
  'lightMotion',
  'lightMotionAmount',
  'shape',
  'curveDetail',
  'projection',
  'camera',
  'depthOfField',
  'aperture',
  'atmosphere',
  'atmosphereForms',
  'atmosphereSpread',
  'atmosphereCount',
  'seed',
  'backdrop',
  'background',
  'background2',
  'backdropImage',
  'backdropStrength',
  'floor',
  'floorColor',
  'shadowOpacity',
  'pedestal',
  'keyColor',
  'fillColor',
  'rimColor',
  'coolColor',
  'warmColor',
  'lightLevels',
  'keyPosition',
  'fillPosition',
  'rimPosition',
  'environment',
  'environmentImage',
  'environmentBackground',
  'environmentBlur',
  'environmentIntensity',
  'environmentRotation',
  'lights',
  'samples',
  'videoSamples',
  'motion',
  'motionAmount',
  'motionRest',
  'cameraMotion',
  'cameraAmount',
  'cameraKeys',
  'cameraEase',
  'cameraLoop',
  'duration',
  'turnDegrees',
];

/**
 * A studio control the reader changed while a saved studio is attached becomes theirs:
 * its id joins studioOverrides, and Update from studio then leaves it alone. Returns
 * the new list as text, or null when there is nothing to write. The camera is recorded
 * whole, because a hook is told which input changed and not which of its fields moved,
 * so an orbit also keeps the field of view.
 */
function studioOverridesAfter(values, changedId) {
  if (!String(values.studioRef || '').trim()) return null;
  if (!STUDIO_LOOK_INPUTS.includes(changedId)) return null;
  const raw = String(values.studioOverrides || '').trim();
  let listed = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) listed = parsed.map((id) => String(id));
    } catch {
      listed = [];
    }
  }
  const ids = listed.filter((id) => STUDIO_LOOK_INPUTS.includes(id));
  if (ids.includes(changedId)) return null;
  ids.push(changedId);
  const next = JSON.stringify([...new Set(ids)].sort());
  return next === raw ? null : next;
}

const NAMED_PAINTS = { black: '#000000', white: '#ffffff' };

/** A paint as #rrggbb, 'none', or null when this reader cannot tell what it is. */
function paintHex(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return 'none';
  if (NAMED_PAINTS[v]) return NAMED_PAINTS[v];
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

/**
 * The solid colours an SVG paints, in the order it first paints them, which is the order
 * the studio numbers its material slots (fill before stroke, document order, a group's
 * paint inherited, black when nothing is set). Null when a paint is not a plain colour,
 * so the caller leaves the materials alone rather than guess.
 */
function svgPaints(source) {
  const text = String(source).replace(/<!--[\s\S]*?-->/g, '');
  const rules = {};
  for (const style of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    for (const rule of style[1].matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const fill = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(rule[2]);
      const stroke = /(?:^|;)\s*stroke\s*:\s*([^;]+)/i.exec(rule[2]);
      for (const selector of rule[1].split(',')) {
        const name = /^\s*\.([\w-]+)\s*$/.exec(selector);
        if (name) rules[name[1]] = { fill: fill?.[1], stroke: stroke?.[1] };
      }
    }
  const own = (attrs, prop) => {
    const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
    const inline = style && new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style[1]);
    if (inline) return inline[1];
    const attr = new RegExp(`\\s${prop}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs);
    if (attr) return attr[1];
    const cls = /\sclass\s*=\s*"([^"]*)"/i.exec(attrs);
    for (const name of cls ? cls[1].split(/\s+/) : []) if (rules[name]?.[prop]) return rules[name][prop];
    return undefined;
  };
  const shapes = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);
  const stack = [{ fill: '#000000', stroke: 'none' }];
  const order = [];
  for (const tag of text.replace(/<defs[\s\S]*?<\/defs>/gi, '').matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, attrs, selfClosing] = tag;
    if (closing) {
      if (name === 'g' || name === 'svg') stack.pop();
      continue;
    }
    const parent = stack[stack.length - 1];
    const paint = {
      fill: own(attrs, 'fill') ?? parent.fill,
      stroke: own(attrs, 'stroke') ?? parent.stroke,
    };
    if ((name === 'g' || name === 'svg') && !selfClosing) stack.push(paint);
    if (!shapes.has(name)) continue;
    for (const value of [paint.fill, paint.stroke]) {
      const hex = paintHex(value);
      if (hex === null) return null;
      if (hex !== 'none' && !order.includes(hex)) order.push(hex);
    }
  }
  return order;
}

/**
 * Colours A and B from a one- or two-colour SVG, as a colour pair, so a two-tone icon
 * arrives as two colours the reader can change. Artwork with more colours keeps its
 * own materials. Null when there is nothing to set.
 */
async function artworkPair(ref) {
  if (!ref || typeof ref !== 'object' || typeof host.assets.bytes !== 'function') return null;
  let text;
  try {
    text = new TextDecoder().decode(await host.assets.bytes(ref));
  } catch {
    return null;
  }
  const paints = svgPaints(text);
  if (!paints || !paints.length || paints.length > 2) return null;
  return { materialMode: 'pair', colorA: paints[0], colorB: paints[1] ?? paints[0] };
}

async function compute(model, changedId) {
  const values = {};
  for (let i = 0; i < model.length; i++) values[model[i].id] = model[i].value;
  const flag = (value) => value === true || value === 'true' || value === 1;
  // Collection items and arrangement objects both carry an asset per row plus booleans
  // that URL mode may deliver as strings; normalize once and write back only on change.
  const lists = {
    subjects: ['ownFraming', 'ownFocus'],
    objects: ['grounded', 'visible'],
  };
  const patch = {};
  for (const key of ['artwork', 'modelAsset', 'backdropImage']) {
    let value = values[key];
    if (typeof value === 'string' && value) value = await host.assets.get(value);
    if (value && typeof value === 'object')
      values[key] = {
        id: value.id || '',
        url: value.url || '',
        name: value.name || value.meta?.name || value.id || '',
      };
  }
  const blank = (value) => value === undefined || value === null || value === '';
  for (const [key, flags] of Object.entries(lists)) {
    if (!Array.isArray(values[key])) continue;
    const rows = values[key].map((row) => {
      const next = { ...row };
      for (const name of flags)
        next[name] = row[name] === undefined ? name !== 'ownFraming' && name !== 'ownFocus' : flag(row[name]);
      return next;
    });
    // Objects dropped onto the list or chosen from the library arrive at the centre.
    // A newcomer that would sit on top of, or inside, an object already placed takes
    // the next free place along the stage instead. Every source is normalised to
    // about 3.25 studio units across, so widths follow the scale.
    if (key === 'objects') {
      const placed = [];
      const width = (row) => 3.25 * (Number(row.scale) || 0.6);
      const crowded = (x, z, w) =>
        placed.some((p) => Math.abs(p.x - x) < (w + p.w) / 2 && Math.abs(p.z - z) < (w + p.w) / 2);
      rows.forEach((row) => {
        if (blank(row.x) && blank(row.z)) row.x = row.z = 0;
        const x = Number(row.x) || 0,
          z = Number(row.z) || 0,
          w = width(row);
        const newcomer = x === 0 && z === 0;
        const duplicate = placed.some((p) => p.x === x && p.z === z);
        if ((newcomer && crowded(x, z, w)) || duplicate) {
          const step = w + 0.35;
          for (let slot = 1; slot < 64; slot++) {
            const candidate = Math.round((slot % 2 ? 1 : -1) * Math.ceil(slot / 2) * step * 100) / 100;
            if (!crowded(candidate, 0, w)) {
              row.x = candidate;
              row.z = 0;
              break;
            }
          }
        }
        placed.push({ x: Number(row.x) || 0, z: Number(row.z) || 0, w });
      });
    }
    let normalizeRows = values[key].some(
      (row, i) =>
        flags.some((name) => row[name] !== rows[i][name]) ||
        row.x !== rows[i].x ||
        row.z !== rows[i].z ||
        (typeof row.asset === 'string' && row.asset)
    );
    values[key] = await Promise.all(
      rows.map(async (row, index) => {
        let value = row.asset;
        if (typeof value === 'string' && value) value = await host.assets.get(value);
        // The file decides the kind, so a dropped model is never read as artwork, and a
        // blank name takes the file name.
        const patched = { ...row };
        if (value && typeof value === 'object') {
          const kind = value.type === 'model' ? 'model' : value.type === 'vector' ? 'artwork' : null;
          if (kind && row.kind !== kind && row.kind !== 'primitive') patched.kind = kind;
          if (blank(row.name)) {
            const label = String(value.meta?.name || value.name || value.id || '');
            patched.name = label.replace(/^.*\//, '').replace(/^[0-9a-f-]{36}-/i, '').replace(/\.[a-z0-9]+$/i, '').slice(0, 120);
          }
          if (patched.kind !== row.kind || patched.name !== row.name) normalizeRows = true;
        }
        if (blank(patched.name) && row.kind === 'text' && !blank(row.text)) {
          patched.name = String(row.text).split('\n')[0].trim().slice(0, 40);
          normalizeRows = true;
        }
        rows[index] = { ...patched, asset: value };
        row = patched;
        return {
          ...row,
          asset:
            value && typeof value === 'object'
              ? {
                  id: value.id || '',
                  url: value.url || '',
                  name: value.name || value.meta?.name || value.id || '',
                }
              : value,
        };
      })
    );
    if (normalizeRows) patch[key] = rows;
  }
  // A new SVG, or a switch to a colour pair, starts from the artwork's own colours.
  if (
    values.source === 'artwork' &&
    (changedId === 'artwork' || (changedId === 'materialMode' && values.materialMode === 'pair'))
  ) {
    const raw = model.find((input) => input.id === 'artwork')?.value;
    const pair = await artworkPair(typeof raw === 'string' && raw ? await host.assets.get(raw) : raw);
    if (pair)
      for (const [key, value] of Object.entries(pair))
        if (values[key] !== value) patch[key] = values[key] = value;
  }
  const overrides = changedId ? studioOverridesAfter(values, changedId) : null;
  if (overrides !== null) {
    patch.studioOverrides = overrides;
    values.studioOverrides = overrides;
  }
  return {
    ...patch,
    _studioState: JSON.stringify({ version: 1, values: values }),
    _expert: values.controls === 'expert' || values.materialMode === 'custom',
    _collection: values.source === 'collection',
    _arrangement: values.source === 'arrangement',
    _cameraKeys: Array.isArray(values.cameraKeys) ? values.cameraKeys.length : 0,
    _cameraPlays:
      values.cameraMotion === 'keys' &&
      Array.isArray(values.cameraKeys) &&
      values.cameraKeys.length >= 2,
    // A clip has a length when anything moves: any motion but Still image, any light
    // animation, a camera move, or a camera path with two keys to travel between. A
    // dolly zoom changes the lens against the distance, and an orthographic camera has
    // no lens to change, so that one pair draws the same frame throughout.
    _clipMs:
      (values.motion && values.motion !== 'still') ||
      (values.lightMotion && values.lightMotion !== 'still') ||
      (values.cameraMotion === 'keys'
        ? Array.isArray(values.cameraKeys) && values.cameraKeys.length >= 2
        : !!values.cameraMotion &&
          values.cameraMotion !== 'still' &&
          !(values.cameraMotion === 'dolly' && values.projection === 'orthographic'))
        ? Math.max(1, Math.min(30, Number(values.duration) || 5)) * 1000
        : 0,
  };
}

// biome-ignore lint/correctness/noUnusedVariables: The runtime calls this hook.
function onInit(ctx) {
  return compute(ctx.model);
}
// biome-ignore lint/correctness/noUnusedVariables: The runtime calls this hook.
function onInput(ctx) {
  return compute(ctx.model, ctx.id);
}
