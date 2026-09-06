/**
 * Web Icon Maker hooks.
 *
 * The whole challenge of a favicon label is legibility once the icon is scaled
 * down to a 16 px browser tab. So the label is AUTO-FITTED: we estimate the
 * rendered width of the (upper-cased) text, then pick the largest font size that
 * fills the tile without spilling out - taking letter-spacing into account.
 * The label is set in SUSE Mono, so every glyph shares one advance width and the
 * estimate is just a per-character constant. Pure arithmetic, no DOM, so it
 * produces the same result in the web shell and the headless CLI.
 *
 * Returns extras only (labelSize / trackingEm / tileBg, the variant flags and the
 * kit plan) - none collide with a declared input id, so nothing is clobbered.
 * `webManifest` / `kitFilesJson` are the plan read out as strings: the canvas has
 * no place to show them, but they let the manifest be inspected without building
 * the whole archive.
 *
 * The second job is the app kit: `exportStill` owns the `zip` format and packs the
 * icon in every face plus a PWA manifest.json (see kitPlan below).
 */

// SUSE Mono is monospaced: every cap / digit / symbol occupies the same advance
// (~0.6 em). Slightly overestimated so the fitted label keeps off the edges.
var MONO_ADV = 0.62;

function advance() { return MONO_ADV; }

function toArgs(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}

// ── App kit ───────────────────────────────────────────────────────────────────
// The kit is the same icon rendered four ways (icon / maskable / monochrome /
// social card) plus a PWA manifest.json that names the icon files. One list
// describes both halves, so the manifest can never advertise a file the zip does
// not contain: kitPlan() is the single source of truth, read by the template
// preview (the webManifest extra) and by exportStill (the zip members).

var KIT_PNG_SIZES = [192, 512];
// The link-preview card's own box. Not square like every other member, which is
// why exportStill passes it explicitly and beforeExport re-sizes a lone card
// export away from the tool's square render box.
var OG_W = 1200, OG_H = 630;

function str(v) { return v == null ? '' : String(v).trim(); }

// The hex forms CSS actually has. `{3,8}` would also swallow #12345 and
// #1234567, which are not colours - and a manifest is read by a browser, so a
// near-miss would be junk rather than a fallback.
var HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** A value CSS can actually paint, or ''. A shell with no token bridge leaves a
 *  `{color.semantic.*}` default as the literal alias, and an invalid custom
 *  property poisons every declaration that reads it - the tile then paints
 *  nothing at all, which is worse than the fallback colour. */
function cssColor(v) {
  var s = str(v);
  return !s || s.charAt(0) === '{' ? '' : s;
}

/** A CSS colour safe to write into a manifest, or null - which is what an
 *  unresolved `{color.semantic.*}` alias returns on a shell with no tokens. */
function manifestColor(v) {
  var s = str(v);
  if (HEX_RE.test(s)) return s;
  if (/^(rgb|hsl)a?\([^()]*\)$/i.test(s)) return s;
  return null;
}

/** #rgb / #rgba / #rrggbb / #rrggbbaa → { r, g, b } in 0-1, else null. Any alpha
 *  is dropped: the colour matrix keeps the SOURCE image's alpha, not the ink's. */
function hexUnit(v) {
  var s = str(v);
  var m = HEX_RE.exec(s);
  if (!m) return null;
  var h = m[1];
  if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  };
}

function kitPlan(a) {
  var members = [
    { name: 'favicon.ico', variant: 'icon', format: 'ico', w: 512, h: 512 },
    { name: 'icon.svg', variant: 'icon', format: 'svg', w: 512, h: 512,
      icon: { sizes: 'any', type: 'image/svg+xml', purpose: 'any' } }
  ];
  KIT_PNG_SIZES.forEach(function (s) {
    members.push({
      name: 'icon-' + s + '.png', variant: 'icon', format: 'png', w: s, h: s,
      icon: { sizes: s + 'x' + s, type: 'image/png', purpose: 'any' }
    });
  });
  if (a.maskable !== false) {
    members.push({
      name: 'icon-maskable-512.png', variant: 'maskable', format: 'png', w: 512, h: 512,
      icon: { sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    });
  }
  if (a.monochrome !== false) {
    members.push({
      name: 'icon-monochrome-512.png', variant: 'monochrome', format: 'png', w: 512, h: 512,
      icon: { sizes: '512x512', type: 'image/png', purpose: 'monochrome' }
    });
  }
  // The social card is a kit file, not a manifest icon (no `icon` key) - a 1200x630
  // landscape image is what a link preview reads, and the manifest has no slot for it.
  members.push({ name: 'social-card.png', variant: 'og', format: 'png', w: OG_W, h: OG_H });

  var name = str(a.appName) || str(a.text).toUpperCase() || 'App';
  var bg = manifestColor(a.background);
  var manifest = {
    name: name,
    short_name: str(a.appShortName) || name,
    start_url: '/',
    display: 'standalone',
    icons: members.filter(function (m) { return m.icon; }).map(function (m) {
      return { src: m.name, sizes: m.icon.sizes, type: m.icon.type, purpose: m.icon.purpose };
    })
  };
  if (bg) { manifest.background_color = bg; manifest.theme_color = bg; }
  return { members: members, manifest: manifest };
}

function compute(a) {
  var text = (a.text == null ? '' : String(a.text)).toUpperCase();
  var hasArt = !!(a.image && typeof a.image === 'object' && a.image.url);

  var trackingNum = isFinite(Number(a.tracking)) ? Number(a.tracking) : -4;
  var trackingEm = trackingNum / 100;

  // Total advance of the line in em (glyphs + the gaps between them). Monospace,
  // so weight doesn't change the advance - every glyph is MONO_ADV wide.
  var n = text.length;
  var totalEm = 0;
  for (var i = 0; i < n; i++) totalEm += advance(text[i]);
  if (n > 1) totalEm += trackingEm * (n - 1);
  if (totalEm < 0.2) totalEm = 0.2; // guard divide-by-~zero for empty/odd input

  // Fill this fraction of the tile width; cap the height so a 1–2 char label
  // doesn't tower. The band is shorter when an image sits above the label.
  var targetW = hasArt ? 84 : 90;
  var heightCap = hasArt ? 30 : 64;
  var size = Math.min(targetW / totalEm, heightCap);

  var scale = isFinite(Number(a.labelScale)) ? Number(a.labelScale) : 100;
  size = size * scale / 100;
  if (size < 6) size = 6;
  if (size > 130) size = 130;

  // transparentBg toggle (injected by the engine) → see-through tile fill, for a
  // glyph/letter-only icon. Otherwise the chosen background colour.
  var tileBg = a.transparentBg ? 'transparent' : (cssColor(a.background) || '#0c322c');

  // Which face the canvas shows. The flags are extras rather than template logic so
  // the template stays logic-less, and the monochrome fill is handed over as three
  // 0-1 channels because that is what an feColorMatrix row takes.
  var variant = str(a.variant) || 'icon';
  // One ink for the whole tile. A shell with no token bridge hands the hook the
  // `{color.semantic.*}` alias resolved to nothing, and an empty custom property
  // makes `color: var(--fg)` invalid - the label would then inherit whatever the
  // page paints, and the monochrome matrix would go black while the label went
  // light. So the fallback is decided ONCE here and both read `ink`.
  var ink = cssColor(a.color) || '#ffffff';
  var mono = hexUnit(ink) || { r: 1, g: 1, b: 1 };
  var plan = kitPlan(a);
  var f4 = function (n) { return Math.round(n * 10000) / 10000; };

  return {
    labelSize: Math.round(size * 10) / 10,
    trackingEm: trackingEm,
    tileBg: tileBg,
    ink: ink,
    isMaskable: variant === 'maskable',
    isMono: variant === 'monochrome',
    isOg: variant === 'og',
    monoR: f4(mono.r),
    monoG: f4(mono.g),
    monoB: f4(mono.b),
    ogTitle: str(a.appName) || text,
    ogSubtitle: str(a.appShortName),
    webManifest: JSON.stringify(plan.manifest, null, 2),
    kitFilesJson: JSON.stringify(plan.members.map(function (m) { return m.name; }).concat(['manifest.json']))
  };
}

// The input model as of the last onInit / onInput. An export hook's context
// carries { node, format, opts, host } and no model, so the kit builder reads it
// from here. Safe against nested renders: the hook module gets a fresh scope per
// mount, so a composed child never writes into its parent's copy.
var lastArgs = {};

function onInit(ctx)  { lastArgs = toArgs(ctx.model); return compute(lastArgs); }
function onInput(ctx) { lastArgs = toArgs(ctx.model); return compute(lastArgs); }

function beforeExport(ctx) {
  // A favicon should be transparent OUTSIDE its shape so a rounded / circular
  // icon never rides on a white box in the browser tab. Force an alpha background
  // for the raster favicon formats; the tile's own fill is painted by the
  // template, so only the corners outside the shape go transparent.
  var alpha = ['png', 'ico', 'webp', 'avif'];
  if (alpha.indexOf(ctx.format) !== -1) ctx.opts.background = 'transparent';

  // Exporting the social card ON ITS OWN (the variant picker doubles as a way to
  // do that) would otherwise use the tool's render box, which is the square every
  // icon face needs - and a square is the one shape a link preview can't use. So a
  // card asked for at the square default comes out at the same 1200x630 the kit
  // packs. A deliberately non-square request, or one in physical units, is the
  // user's own framing and is left alone. The zip never needs this: exportStill
  // sizes each member itself.
  if (ctx.format !== 'zip' && str(lastArgs.variant) === 'og' &&
      (!ctx.opts.unit || ctx.opts.unit === 'px')) {
    var w = ctx.opts.width, h = ctx.opts.height;
    var squareDefault = (w == null || w === '') && (h == null || h === '')
      ? true
      : Number(w) > 0 && Number(w) === Number(h);
    if (squareDefault) { ctx.opts.width = OG_W; ctx.opts.height = OG_H; }
  }
}

// ── STORED zip ────────────────────────────────────────────────────────────────
// A hook has no imports, so the archive is framed here: a local header plus data
// per member, then the central directory and the end record. Every member is
// STORED (method 0) - PNG / ICO bytes are already compressed and the tool carries
// no deflater. Timestamps are fixed at 1980-01-01, so the same inputs give the
// same archive bytes twice.
var CRC_TABLE = null;

function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c;
    }
  }
  var crc = -1;
  for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function utf8(s) { return new TextEncoder().encode(s); }

function zipStore(files) {
  var locals = [], central = [], offset = 0;
  files.forEach(function (f) {
    var name = utf8(f.name);
    var crc = crc32(f.bytes);
    var size = f.bytes.length;

    var lh = new Uint8Array(30 + name.length);
    var lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);   // local file header
    lv.setUint16(4, 20, true);           // version needed
    lv.setUint16(10, 0, true);           // modification time
    lv.setUint16(12, 33, true);          // modification date - 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);        // compressed size (stored)
    lv.setUint32(22, size, true);        // uncompressed size
    lv.setUint16(26, name.length, true);
    lh.set(name, 30);
    locals.push(lh, f.bytes);

    var ch = new Uint8Array(46 + name.length);
    var cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);   // central directory header
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(12, 0, true);           // modification time
    cv.setUint16(14, 33, true);          // modification date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);      // offset of the local header
    ch.set(name, 46);
    central.push(ch);

    offset += lh.length + size;
  });

  var cdSize = central.reduce(function (n, c) { return n + c.length; }, 0);
  var end = new Uint8Array(22);
  var ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);     // end of central directory
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  var all = locals.concat(central, [end]);
  var total = all.reduce(function (n, p) { return n + p.length; }, 0);
  var out = new Uint8Array(total);
  var at = 0;
  all.forEach(function (p) { out.set(p, at); at += p.length; });
  return out;
}

/** Read a composed render's bytes, then release the object URL - `transient`
 *  renders hand ownership to the caller, so nothing else will free it. */
async function refBytes(ref) {
  var url = ref && ref.url;
  if (!url) throw new Error('A kit image failed to render.');
  try {
    if (host.assets && host.assets.bytes) return await host.assets.bytes(url); // portable read (v1.183)
    var res = await fetch(url);
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    if (url.slice(0, 5) === 'blob:' && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try { URL.revokeObjectURL(url); } catch (e) { /* already released */ }
    }
  }
}

/**
 * The kit export. `zip` is the only format this hook owns; every other format
 * returns null and takes the normal render path, byte for byte as before.
 *
 * Each member is a nested render of this same tool with `variant` swapped and the
 * member's own pixel size, so a face is described once (in the template) and the
 * kit gets it for free. manifest.json is written from the same plan, so it can
 * never name a file the archive lacks.
 *
 * Known ceiling: one nested render per member, all of them inside the hook's 10s
 * export budget (seven at the defaults, five with both toggles off). If that gets
 * tight on slow devices the fix is a shell-side job, not more hook code.
 */
async function exportStill(ctx) {
  if (ctx.format !== 'zip') return null;
  var host = ctx.host;
  if (!host || !host.compose || typeof host.compose.render !== 'function') {
    throw new Error('This app cannot build the icon kit here - nested renders are unavailable.');
  }
  // The export panel offers a zip password because the shell's own zip writer can
  // encrypt. This one cannot, and handing back an unlocked archive to someone who
  // typed a password would be the worst possible answer.
  if (ctx.opts && (ctx.opts.password || ctx.opts.strongPassword)) {
    throw new Error('The icon kit cannot be password protected - clear the password, or export the icon on its own.');
  }
  var a = lastArgs;
  var plan = kitPlan(a);
  var files = [];
  for (var i = 0; i < plan.members.length; i++) {
    var m = plan.members[i];
    var inputs = {};
    Object.keys(a).forEach(function (k) { inputs[k] = a[k]; });
    inputs.variant = m.variant;
    inputs.showGrid = false;   // the 16 px chips are an editor aid, never a kit file
    var ref = await host.compose.render({
      toolId: 'icon', inputs: inputs, format: m.format,
      width: m.w, height: m.h, transient: true
    });
    files.push({ name: m.name, bytes: await refBytes(ref) });
  }
  files.push({ name: 'manifest.json', bytes: utf8(JSON.stringify(plan.manifest, null, 2) + '\n') });
  return { bytes: zipStore(files), mime: 'application/zip' };
}
