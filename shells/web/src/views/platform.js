// SPDX-License-Identifier: MPL-2.0
/**
 * Platform view — a read-only dashboard of global brand / platform data.
 *
 * Surfaces the things that are defined once and used everywhere: the colour
 * palette (with print/CMYK ink substitutions), typography, themes, print press
 * conditions, and a catalogue summary. It is intentionally READ-ONLY — a
 * snapshot of what the platform currently knows, not a live editor and not a way
 * to change the running app. Editing here would only ever shape *new builds*, so
 * until a platform-configuration package exists this view is just the
 * human-readable record of the current globals.
 *
 * Data sources (single sources of truth, imported — never duplicated):
 *   - colours   → src/palette.js          (PALETTE)
 *   - CMYK      → engine/src/color.js      (CMYK_CONDITIONS, via @lolly/engine)
 *   - themes    → src/theme.js             (THEMES)
 *   - fonts     → src/styles/fonts.css     (mirrored in FONTS below)
 *   - catalogue → window.__toolIndex + /catalog/assets/index.json
 */

import { escape } from '../utils.js';
import { armViewEnter } from '../view-enter.js';
import { PALETTE } from '../palette.js';
import { THEMES } from '../theme.js';
import { CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';

// Mirrors the @font-face registrations in src/styles/fonts.css. These are the
// platform's local (bundled) typefaces — no webfont / CDN dependency at runtime.
const FONTS = [
  {
    family: 'SUSE',
    role: 'Display, UI & body',
    stack: "'SUSE', system-ui, sans-serif",
    variable: true,
    weights: '100–900',
    styles: ['normal', 'italic'],
    source: '/catalog/fonts/variable/SUSE[wght].ttf',
  },
  {
    family: 'SUSE Mono',
    role: 'Monospace',
    stack: "'SUSE Mono', ui-monospace, monospace",
    variable: true,
    weights: '100–900',
    styles: ['normal', 'italic'],
    source: '/catalog/fonts/variable/SUSEMono[wght].ttf',
  },
];

const WEIGHT_RAMP = [100, 300, 400, 500, 700, 900];

// Chevron for a collapsible section's summary (rotates 90° when open via CSS).
// Matches the profile page's collapsible sections.
const COLLAPSE_CHEV = `<svg class="plat-section-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

const isTransparent = (hex) => !hex || hex.toLowerCase() === 'transparent';
const cmykText = (cmyk) =>
  Array.isArray(cmyk) ? `C ${cmyk[0]}  M ${cmyk[1]}  Y ${cmyk[2]}  K ${cmyk[3]}` : 'RGB→CMYK (generic)';

// Split the flat palette into three buckets: the named "brand" colours, the
// secondary "spectrum" palette (tagged group:'spectrum'), and the numbered tint
// ramps (e.g. "Jungle 1".."Jungle 8"), grouped by family in first-seen order.
// An explicit group that names a family (e.g. White → 'Fog') pins a swatch into
// that ramp; otherwise a trailing number in the label decides the family.
function groupPalette(palette) {
  const ramps = new Map();
  const brand = [];
  const spectrum = [];
  const addToRamp = (fam, c) => {
    if (!ramps.has(fam)) ramps.set(fam, []);
    ramps.get(fam).push(c);
  };
  for (const c of palette) {
    if (c.group === 'spectrum') {
      spectrum.push(c);
    } else if (c.group) {
      addToRamp(c.group, c);
    } else {
      const m = /^(.+?)\s+\d+$/.exec(c.label);
      if (m) addToRamp(m[1], c);
      else brand.push(c);
    }
  }
  return { brand, spectrum, ramps: [...ramps] };
}

function swatch(c) {
  const measured = Array.isArray(c.cmyk);
  const trans = isTransparent(c.hex);
  const chipStyle = trans ? '' : `style="background:${escape(c.hex)}"`;
  return `
    <div class="plat-swatch${measured ? ' is-measured' : ''}">
      <button type="button" class="plat-swatch-chip${trans ? ' is-transparent' : ''}" ${chipStyle}
              data-copy="${trans ? 'transparent' : escape(c.hex)}"
              aria-label="${escape(c.label)} — ${trans ? 'transparent' : escape(c.hex)} (click to copy)">
        ${measured ? '<span class="plat-chip-flag" title="Exact CMYK ink values — substituted directly into CMYK PDF exports">CMYK</span>' : ''}
      </button>
      <span class="plat-swatch-name">${escape(c.label)}</span>
      <code class="plat-swatch-hex">${trans ? 'transparent' : escape(c.hex)}</code>
      <span class="plat-swatch-cmyk${measured ? '' : ' is-generic'}">${cmykText(c.cmyk)}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// "This device" — a live, read-only snapshot of the browser/runtime this
// session is running on. Read entirely from the active session; never stored
// or transmitted. Every value degrades to '—' when the browser doesn't expose
// it, and whole groups (Network, System/Browser Graphics) are omitted when their API is absent.
// ---------------------------------------------------------------------------
const DASH = '—';
const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : DASH);

// Values that can change while the session is live (window resize, device
// rotation). Read on demand so the same code produces the initial render and
// every real-time refresh — see the `live` rows in collectClientInfo() and the
// listener wiring in mountPlatform().
const LIVE_VALUES = {
  viewport: () => `${window.innerWidth} × ${window.innerHeight}`,
  // Orientation derived from the viewport box (not the device): taller → Portrait,
  // wider → Landscape, equal → Square. Recomputed live on resize like `viewport`.
  viewportOrientation: () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return h > w ? 'Portrait' : w > h ? 'Landscape' : 'Square';
  },
  orientation: () => screen.orientation?.type || DASH,
};
const liveValue = (key) => LIVE_VALUES[key]?.() ?? DASH;

function matchPref(feature, options) {
  if (typeof window.matchMedia !== 'function') return DASH;
  for (const opt of options) {
    try {
      if (window.matchMedia(`(${feature}: ${opt})`).matches) return opt;
    } catch {
      /* feature unsupported by this engine */
    }
  }
  return DASH;
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return DASH;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 ? n : n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Heading icons for the "This device" cards. Two-tier "kind-changing" logic:
// a generic icon picked from the card *title* (TITLE_ICONS), overridden by a
// specific icon when we can identify the browser brand or operating system
// (browserIcon / osIcon). Everything is monochrome `currentColor` so it inherits
// the heading's accent colour and stays consistent with the rest of the UI.
// Brand glyphs are simplified, theme-tinted marks — not the vendors' colour logos.
const ICONS = {
  // Generic, title-based fallbacks.
  browser:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/><path d="M6 4v5"/><path d="M10 4v5"/></svg>',
  system:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M9 2v2"/><path d="M15 20v2"/><path d="M9 20v2"/><path d="M20 9h2"/><path d="M20 15h2"/><path d="M2 9h2"/><path d="M2 15h2"/></svg>',
  display:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  locale:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/></svg>',
  capabilities:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  network:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8.5a16 16 0 0 1 20 0"/><path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
  graphics:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4"/><path d="M14 14h4"/></svg>',
  layers:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  // Rendering stack — a "type" mark (the part of the pipeline that shapes glyphs & vectors).
  render:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  // Browser brands (simplified marks).
  chrome:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>',
  firefox:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  safari:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  edge:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.6 13.4C3.6 7.8 7.9 4 12.5 4c4 0 6.9 2.4 6.9 5.4 0 2.3-1.9 4-4.7 4-1.8 0-3.1-1-3.1-2.3"/><path d="M4.2 11.8c-.4 1-.7 2.1-.7 3.3 0 3 2.6 5.4 6.2 5.4 3 0 5.6-1.6 7-4.1"/></svg>',
  opera:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="3.5" ry="6.5"/></svg>',
  // Operating systems (simplified marks; cut-outs use the card colour).
  windows:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
  apple:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M17.05 12.54c-.02-2.27 1.85-3.36 1.94-3.41-1.06-1.55-2.7-1.76-3.29-1.79-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.88-3.71 2.24-1.58 2.75-.4 6.81 1.13 9.04.75 1.09 1.64 2.31 2.81 2.27 1.13-.05 1.56-.73 2.93-.73 1.36 0 1.75.73 2.94.71 1.21-.02 1.98-1.11 2.72-2.21.86-1.26 1.21-2.49 1.23-2.55-.03-.01-2.36-.91-2.38-3.6z"/><path d="M14.78 6.27c.62-.76 1.05-1.8.93-2.85-.9.04-1.99.6-2.64 1.36-.58.67-1.09 1.74-.95 2.76 1 .08 2.03-.51 2.66-1.27z"/></svg>',
  android:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M6 13a6 6 0 0 1 12 0v4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><rect x="2.5" y="12.5" width="2.2" height="6" rx="1.1"/><rect x="19.3" y="12.5" width="2.2" height="6" rx="1.1"/><path d="M8 3.5l1.6 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 3.5l-1.6 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.6" cy="10.5" r=".9" fill="hsl(var(--card))"/><circle cx="14.4" cy="10.5" r=".9" fill="hsl(var(--card))"/></svg>',
  linux:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2c-2.5 0-4 2-4 4.5v3.2c0 1.1-.5 1.9-1.3 2.9C5.3 14.3 4 16 4 17.8c0 .9.6 1.4 1.5 1.2.7-.2 1.3-.7 1.7-1.4-.1.8-.2 1.6-.2 2.2 0 1 .7 1.4 1.7 1.4h6.6c1 0 1.7-.4 1.7-1.4 0-.6-.1-1.4-.2-2.2.4.7 1 1.2 1.7 1.4.9.2 1.5-.3 1.5-1.2 0-1.8-1.3-3.5-2.7-5.2-.8-1-1.3-1.8-1.3-2.9V6.5C16 4 14.5 2 12 2z"/><circle cx="10.3" cy="7" r=".8" fill="hsl(var(--card))"/><circle cx="13.7" cy="7" r=".8" fill="hsl(var(--card))"/><path d="M11 8.7h2l-1 1.5z" fill="hsl(var(--card))"/></svg>',
};

// Card title → generic icon. The fallback when no brand/OS match is found.
const TITLE_ICONS = {
  Browser: ICONS.browser,
  System: ICONS.system,
  Display: ICONS.display,
  'Locale & preferences': ICONS.locale,
  'Capabilities & privacy': ICONS.capabilities,
  Network: ICONS.network,
  'Rendering stack': ICONS.render,
  'System Graphics': ICONS.graphics,
  'Browser Graphics': ICONS.layers,
};

// Specific browser/OS marks, matched against the strings we already parse for
// display. Returns null when unknown so the caller falls back to the title icon.
function browserIcon(name) {
  if (!name || name === DASH) return null;
  if (/edge/i.test(name)) return ICONS.edge;
  if (/opera|opr\b/i.test(name)) return ICONS.opera;
  if (/samsung/i.test(name)) return null; // no distinct mark → generic browser
  if (/firefox/i.test(name)) return ICONS.firefox;
  if (/chrom/i.test(name)) return ICONS.chrome; // Chrome / Chromium
  if (/safari/i.test(name)) return ICONS.safari;
  return null;
}
function osIcon(os) {
  if (!os || os === DASH) return null;
  if (/chrome\s*os|cros/i.test(os)) return ICONS.chrome; // before the generic mac/linux checks
  if (/windows/i.test(os)) return ICONS.windows;
  if (/mac|ios|ipad/i.test(os)) return ICONS.apple;
  if (/android/i.test(os)) return ICONS.android;
  if (/linux/i.test(os)) return ICONS.linux;
  return null;
}

// Brand mark for the GPU card. Only Apple silicon has a distinct house glyph;
// everything else falls back to the generic graphics icon for the card title.
function gpuIcon(vendor) {
  if (vendor && vendor !== DASH && /apple/i.test(vendor)) return ICONS.apple;
  return null;
}

function parseBrowser(ua) {
  const tests = [
    ['Microsoft Edge', /Edg\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of tests) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]}`;
  }
  return DASH;
}

function engineOf(ua) {
  if (/Edg\/|OPR\/|Chrome\//.test(ua)) return 'Blink';
  if (/Firefox\//.test(ua)) return 'Gecko';
  if (/Version\/[\d.]+.*Safari/.test(ua)) return 'WebKit';
  return DASH;
}

// The native libraries that actually rasterise vectors and shape text are NOT
// exposed by any web API — but they're a deterministic function of (engine × OS),
// so we infer them. This is the layer that decides how a glyph edge or a curved
// stroke lands on the canvas, which is exactly what matters when reproducing an
// export, so it's worth surfacing even though it's inferred (the card says so).
// Kept current: Blink/Gecko bundle Skia + HarfBuzz cross-platform; WebKit uses
// Apple's Core Graphics / Core Text on Apple OSes and Skia (Cairo before
// WebKitGTK 2.46) + HarfBuzz elsewhere.
function renderStack(engine, os) {
  const apple = /mac|ios|ipad/i.test(os || '');
  if (engine === 'Blink') return { raster: 'Skia', text: 'HarfBuzz', compositor: 'Viz (GPU)' };
  if (engine === 'Gecko') return { raster: 'Skia', text: 'HarfBuzz', compositor: 'WebRender' };
  if (engine === 'WebKit') {
    return apple
      ? { raster: 'Core Graphics (Quartz)', text: 'Core Text', compositor: 'Core Animation' }
      : { raster: 'Skia / Cairo', text: 'HarfBuzz', compositor: DASH };
  }
  return null;
}

// Display colour gamut (`color-gamut` media query) → human label. Queried widest
// first, since a P3 panel also reports matching srgb.
const GAMUT_LABELS = { rec2020: 'Rec. 2020', p3: 'Display P3', srgb: 'sRGB' };

function parseOS(ua) {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  const android = /Android ([\d.]+)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  if (/(iPhone|iPad|iPod)/.test(ua)) {
    const m = /OS ([\d_]+)/.exec(ua);
    return `iOS ${m ? m[1].replace(/_/g, '.') : ''}`.trim();
  }
  const mac = /Mac OS X ([\d_]+)/.exec(ua);
  if (mac) return `macOS ${mac[1].replace(/_/g, '.')}`;
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return DASH;
}

// GPU vendor/renderer via the (unmasked) WebGL debug extension — the most
// identifiable bit, so it lives in its own group and is omitted when blocked.
function readGpu() {
  try {
    const canvas = document.createElement('canvas');
    // Prefer a WebGL2 context — whether the browser grants one is itself a
    // browser-graphics detail; it serves the debug extension the same way.
    const gl2 = typeof WebGL2RenderingContext !== 'undefined' ? canvas.getContext('webgl2') : null;
    const gl = gl2 || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      webgl2: !!gl2,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) || null,
    };
  } catch {
    return null;
  }
}

// Chromium runs WebGL through ANGLE, which buries the real hardware inside a
// translation wrapper: the vendor reads "Google Inc. (Apple)" and the renderer
// reads "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)".
// describeGpu() pulls the parts that actually identify the machine — vendor,
// chip and graphics backend — so they can be the headline, and keeps the raw
// string as a detail row for reproducing an exact render. Degrades gracefully
// for non-ANGLE strings (Safari/Firefox report the chip directly).
const GPU_APIS = [
  [/\bmetal\b/i, 'Metal'],
  [/\bvulkan\b/i, 'Vulkan'],
  [/direct3d\s*11|\bd3d11\b/i, 'Direct3D 11'],
  [/direct3d\s*9|\bd3d9\b/i, 'Direct3D 9'],
  [/opengl\s*es/i, 'OpenGL ES'],
  [/\bopengl\b/i, 'OpenGL'],
];

function detectGpuApi(s) {
  for (const [re, name] of GPU_APIS) if (re.test(s)) return name;
  return DASH;
}

// Strip the ANGLE/driver cruft around a device name, leaving just the chip:
// "ANGLE Metal Renderer: Apple M4" → "Apple M4";
// "NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0" → "NVIDIA GeForce RTX 3070".
function cleanGpuChip(s) {
  return s
    .replace(/^ANGLE\s+[\w ]*Renderer:\s*/i, '')
    .replace(/\s*\(0x[0-9a-f]+\)/i, '')
    .replace(/\s*Direct3D\d.*$/i, '')
    .replace(/\s*OpenGL(\s*ES)?\b.*$/i, '')
    .replace(/\s+vs_\d.*$/i, '')
    .trim();
}

function describeGpu(rawVendor, rawRenderer) {
  const vendorRaw = (rawVendor || '').trim();
  const rendererRaw = (rawRenderer || '').trim();

  // "Google Inc. (Apple)" splits into a *browser* graphics vendor ("Google Inc."
  // — ANGLE's own vendor) and the *hardware* vendor ("Apple") in the parens.
  // Native strings ("Apple Inc.") have no parens and pass straight through.
  let glVendor = vendorRaw;
  let hwVendor = vendorRaw;
  const vParen = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(vendorRaw);
  if (vParen) {
    glVendor = vParen[1].trim();
    hwVendor = vParen[2].trim();
  }

  // Unwrap "ANGLE (<vendor>, <device…>, <backend>)": the wrapper word is the
  // browser's translation layer, the middle field is the actual device.
  let translation = 'Native';
  let device = rendererRaw;
  const wrap = /^(\w[\w ]*?)\s*\((.*)\)$/is.exec(rendererRaw);
  if (wrap && /angle/i.test(wrap[1])) {
    translation = wrap[1].trim();
    const parts = wrap[2].split(',').map((p) => p.trim());
    if (parts.length) {
      if (!vParen) hwVendor = parts[0]; // no paren vendor → take ANGLE's vendor field
      device = parts.length > 2 ? parts.slice(1, -1).join(', ') : parts[parts.length - 1] || rendererRaw;
    }
  }

  return {
    // Hardware (System Graphics card).
    chip: cleanGpuChip(device) || DASH,
    hwVendor: hwVendor || DASH,
    // Browser rendering pipeline (Browser Graphics card).
    translation,
    api: detectGpuApi(rendererRaw),
    glVendor: glVendor || DASH,
    raw: rendererRaw || DASH,
  };
}

async function collectClientInfo() {
  const nav = navigator;
  const ua = nav.userAgent || '';
  const groups = [];

  // High-entropy client hints (Chromium only) — best effort; resolves null elsewhere.
  let hints = null;
  try {
    hints = await nav.userAgentData?.getHighEntropyValues?.([
      'platform', 'platformVersion', 'architecture', 'bitness', 'model', 'uaFullVersion',
    ]);
  } catch {
    /* unsupported / rejected */
  }

  const browser = parseBrowser(ua);
  const browserStr =
    browser !== DASH && hints?.uaFullVersion ? browser.replace(/[\d.]+$/, hints.uaFullVersion) : browser;
  const engine = engineOf(ua);
  const osFromHints = hints?.platform
    ? `${hints.platform}${hints.platformVersion ? ` ${hints.platformVersion}` : ''}`.trim()
    : null;
  const os = osFromHints || parseOS(ua);

  groups.push({
    title: 'Browser',
    icon: browserIcon(browser),
    rows: [
      { k: 'Browser', v: browserStr },
      { k: 'Engine', v: engine },
      {
        k: 'Mobile',
        v: nav.userAgentData
          ? yesNo(nav.userAgentData.mobile)
          : /(Mobi|Android|iPhone|iPad)/.test(ua) ? 'Yes' : 'No',
      },
      { k: 'Languages', v: nav.languages?.join(', ') || nav.language || DASH },
      { k: 'User agent', v: ua || DASH, mono: true, stacked: true },
    ],
  });

  groups.push({
    title: 'System',
    icon: osIcon(os),
    rows: [
      { k: 'Operating system', v: os },
      {
        k: 'Architecture',
        v: hints?.architecture
          ? `${hints.architecture}${hints.bitness ? ` · ${hints.bitness}-bit` : ''}`
          : DASH,
      },
      { k: 'Device model', v: hints?.model || DASH },
      { k: 'CPU threads', v: nav.hardwareConcurrency ?? DASH },
      { k: 'Device memory', v: nav.deviceMemory ? `${nav.deviceMemory} GB` : DASH },
      { k: 'Touch points', v: Number.isFinite(nav.maxTouchPoints) ? nav.maxTouchPoints : DASH },
    ],
  });

  const dpr = window.devicePixelRatio;
  groups.push({
    title: 'Display',
    rows: [
      { k: 'Screen', v: `${screen.width} × ${screen.height}` },
      { k: 'Available', v: `${screen.availWidth} × ${screen.availHeight}` },
      // Viewport & Orientation can change mid-session — tagged `live` so the view
      // refreshes them in real time while the "This device" panel is open.
      { k: 'Viewport', v: liveValue('viewport'), live: 'viewport' },
      { k: 'Viewport orientation', v: liveValue('viewportOrientation'), live: 'viewportOrientation' },
      { k: 'Pixel ratio', v: dpr ? `${Math.round(dpr * 100) / 100}×` : DASH },
      { k: 'Colour depth', v: screen.colorDepth ? `${screen.colorDepth}-bit` : DASH },
      { k: 'Colour gamut', v: GAMUT_LABELS[matchPref('color-gamut', ['rec2020', 'p3', 'srgb'])] || DASH },
      {
        k: 'Dynamic range',
        v: { high: 'High (HDR)', standard: 'Standard' }[matchPref('dynamic-range', ['high', 'standard'])] || DASH,
      },
      { k: 'Orientation', v: liveValue('orientation'), live: 'orientation' },
    ],
  });

  let intl = {};
  try {
    intl = Intl.DateTimeFormat().resolvedOptions();
  } catch {
    /* ignore */
  }
  groups.push({
    title: 'Locale & preferences',
    rows: [
      { k: 'Locale', v: intl.locale || nav.language || DASH },
      { k: 'Time zone', v: intl.timeZone || DASH },
      { k: 'Colour scheme', v: matchPref('prefers-color-scheme', ['dark', 'light']) },
      { k: 'Reduced motion', v: matchPref('prefers-reduced-motion', ['reduce', 'no-preference']) },
      { k: 'Contrast', v: matchPref('prefers-contrast', ['more', 'less', 'custom', 'no-preference']) },
      { k: 'Display mode', v: matchPref('display-mode', ['standalone', 'minimal-ui', 'fullscreen', 'browser']) },
    ],
  });

  const capRows = [
    // The browser reports whether cookies *could* be set; Lolly never sets one,
    // so we flag it so the "Yes" isn't read as "this app uses cookies".
    { k: 'Cookies', v: yesNo(nav.cookieEnabled), note: 'not in use' },
    { k: 'Online', v: yesNo(nav.onLine) },
    { k: 'Do Not Track', v: nav.doNotTrack === '1' ? 'On' : nav.doNotTrack === '0' ? 'Off' : DASH },
    { k: 'Service worker', v: yesNo('serviceWorker' in nav) },
    { k: 'PDF viewer', v: 'pdfViewerEnabled' in nav ? yesNo(nav.pdfViewerEnabled) : DASH },
  ];
  try {
    const est = await nav.storage?.estimate?.();
    if (est && Number.isFinite(est.quota)) {
      capRows.push({ k: 'Storage', v: `${fmtBytes(est.usage || 0)} of ${fmtBytes(est.quota)}` });
    }
  } catch {
    /* ignore */
  }
  groups.push({ title: 'Capabilities & privacy', rows: capRows });

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (conn) {
    groups.push({
      title: 'Network',
      rows: [
        { k: 'Effective type', v: conn.effectiveType ? conn.effectiveType.toUpperCase() : DASH },
        { k: 'Downlink', v: Number.isFinite(conn.downlink) ? `${conn.downlink} Mb/s` : DASH },
        { k: 'Round trip', v: Number.isFinite(conn.rtt) ? `${conn.rtt} ms` : DASH },
        { k: 'Data saver', v: 'saveData' in conn ? (conn.saveData ? 'On' : 'Off') : DASH },
      ],
    });
  }

  // Rendering stack — the engine's native 2D/text libraries. Inferred (engine × OS),
  // not probed; the card note says so. Sits beside the two GPU cards: this is the
  // CPU-side half of the pipeline (geometry + glyphs) the GPU cards don't show.
  const stack = renderStack(engine, os);
  if (stack) {
    groups.push({
      title: 'Rendering stack',
      note: 'The engine’s native 2D and text libraries — inferred from engine + OS, not reported by any web API.',
      rows: [
        { k: '2D rasteriser', v: stack.raster },
        { k: 'Text shaping', v: stack.text },
        { k: 'Compositor', v: stack.compositor },
      ],
    });
  }

  const gpu = readGpu();
  if (gpu) {
    const g = describeGpu(gpu.vendor, gpu.renderer);
    // The physical GPU — the chip is the whole story, so it stands alone.
    groups.push({
      title: 'System Graphics',
      icon: gpuIcon(g.hwVendor),
      rows: [{ k: 'GPU', v: g.chip, hero: true }],
    });
    // How *this browser* draws — the translation layer, backend API and the
    // vendor/strings that belong to the rendering pipeline, not the hardware.
    groups.push({
      title: 'Browser Graphics',
      rows: [
        { k: 'Graphics API', v: g.api },
        { k: 'Translation', v: g.translation },
        { k: 'Vendor', v: g.glVendor },
        { k: 'WebGL', v: gpu.webgl2 ? '2.0' : '1.0' },
        { k: 'WebGPU', v: 'gpu' in navigator ? 'Supported' : DASH },
        { k: 'Max texture', v: gpu.maxTexture ? `${gpu.maxTexture} px` : DASH },
        // Verbatim WebGL string, kept for exact reproduction of a render.
        { k: 'Reported', v: g.raw, mono: true, stacked: true },
      ],
    });
  }

  return groups;
}

function clientCard(group) {
  // Matched browser/OS mark if we found one, else the generic icon for the title.
  const icon = group.icon || TITLE_ICONS[group.title] || '';
  return `
    <article class="plat-client-card">
      <h3 class="plat-client-title">${icon ? `<span class="plat-client-icon" aria-hidden="true">${icon}</span>` : ''}<span>${escape(group.title)}</span></h3>
      ${group.note ? `<p class="plat-client-note">${escape(group.note)}</p>` : ''}
      <dl class="plat-kv plat-kv--wide">
        ${group.rows
          .map((r) => {
            // A hero row stacks the value below a small eyebrow label and is sized
            // big (CSS) — used to make the headline datum the focus of the card.
            const divClass = r.hero ? 'is-hero' : r.stacked ? 'is-stacked' : '';
            const ddClass = [r.mono ? 'is-mono' : '', r.lead ? 'is-lead' : '', r.hero ? 'is-hero' : '']
              .filter(Boolean)
              .join(' ');
            return `
        <div${divClass ? ` class="${divClass}"` : ''}>
          <dt>${escape(r.k)}</dt>
          <dd${ddClass ? ` class="${ddClass}"` : ''}${r.live ? ` data-live="${escape(r.live)}"` : ''}>${escape(String(r.v))}${r.note ? `<span class="plat-pill plat-pill--muted">${escape(r.note)}</span>` : ''}</dd>
        </div>`;
          })
          .join('')}
      </dl>
    </article>`;
}

export async function mountPlatform(viewEl, host) {
  document.title = 'Platform — Lolly';

  // QoL deep links: every section is a <details>; the presence of its flag in the
  // hash query (e.g. `#/platform?print`) forces it open, otherwise its default
  // applies. Read straight off the hash — no router change.
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const isOpen = (flag, defaultOpen) => params.has(flag) || defaultOpen;

  // The live "This device" snapshot (collectClientInfo) and the brand-asset
  // summary are filled AFTER first paint — see the deferred hydration block at
  // the end of this function. Keeping them off the synchronous path lets the page
  // paint + cascade immediately instead of waiting on a WebGL probe and a network
  // round-trip for content that is collapsed (device) or at the page foot (assets).

  const { brand, spectrum, ramps } = groupPalette(PALETTE);
  const measuredCount = PALETTE.filter((c) => Array.isArray(c.cmyk)).length;

  const tools = window.__toolIndex?.tools ?? [];
  const byCategory = {};
  const byStatus = {};
  for (const t of tools) {
    const cat = t.category ?? 'other';
    const st = t.status ?? 'official';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byStatus[st] = (byStatus[st] || 0) + 1;
  }

  const stat = (n, label) => `<span class="plat-stat"><strong>${n}</strong>${escape(label)}</span>`;

  // Collapsible section: title becomes the <summary>; everything else the body.
  // `flag`/`defaultOpen` decide the initial state (overridable via the hash query).
  const panel = (flag, defaultOpen, id, title, body, extraClass = '') => `
    <details class="plat-section${extraClass ? ` ${extraClass}` : ''}"${isOpen(flag, defaultOpen) ? ' open' : ''}>
      <summary class="plat-section-summary"><h2 id="${id}" class="plat-section-title">${title}</h2>${COLLAPSE_CHEV}</summary>
      <div class="plat-section-body">${body}</div>
    </details>`;

  viewEl.innerHTML = `
    <a href="#/" class="tools-home home-full">Tools</a>
    <div class="platform-layout">
      <header class="plat-header">
        <h1 class="plat-title">Platform</h1>
        <div class="plat-header-text">
          <p class="plat-sub">A read-only snapshot of the global brand and platform data — the values defined once and reused across every tool, export and surface.</p>
          <p class="plat-note" role="note">
            <strong>Read-only.</strong> Nothing here changes the running app. It is a record of what the platform currently knows; a future
            platform-configuration package will make these editable and exportable to shape new builds.
          </p>
        </div>
      </header>

      ${panel('device', false, 'plat-client', 'This device', `
          <p class="plat-section-desc">A live, read-only snapshot of the browser and device this session is running on — handy when reproducing a render or export. Read on the fly from the current session; nothing is stored or sent anywhere.</p>
          <div class="plat-client-grid" data-client-grid></div>`,
        'plat-device')}

      ${panel('color', true, 'plat-colours', 'Colour palette', `
          <p class="plat-section-desc">Shown as swatches in every colour picker. ${measuredCount} of ${PALETTE.length} have measured <strong>CMYK</strong> ink values that are substituted directly into CMYK PDF exports; the rest fall back to a generic RGB→CMYK conversion.</p>
          <div class="plat-legend">
            <span class="plat-legend-item"><span class="plat-chip-flag is-static">CMYK</span> exact ink substitution</span>
            <span class="plat-legend-item"><span class="plat-swatch-cmyk is-generic">RGB→CMYK (generic)</span> generic conversion at export</span>
          </div>
          <h3 class="plat-ramp-title">Brand colours</h3>
          <div class="plat-swatch-grid">${brand.map(swatch).join('')}</div>
          ${
            spectrum.length
              ? `<h3 class="plat-ramp-title">Spectrum <span class="plat-ramp-count">${spectrum.length}</span></h3>
          <p class="plat-ramp-note">Secondary palette for infographics, charts &amp; data viz — it expands the colour wheel but does <strong>not</strong> replace brand colours.</p>
          <div class="plat-swatch-grid">${spectrum.map(swatch).join('')}</div>`
              : ''
          }
          ${ramps
            .map(
              ([fam, cols]) => `
            <h3 class="plat-ramp-title">${escape(fam)} <span class="plat-ramp-count">${cols.length}</span></h3>
            <div class="plat-swatch-grid">${cols.map(swatch).join('')}</div>`,
            )
            .join('')}`)}

      ${panel('print', false, 'plat-print', 'Print &amp; CMYK', `
          <p class="plat-section-desc">Press conditions a CMYK PDF can declare in its <code>OutputIntent</code>. Selected per-export via the <code>colorProfile</code> option; raster &amp; on-screen output stays sRGB.</p>
          <table class="plat-table">
            <thead><tr><th>Profile key</th><th>Identifier</th><th>Condition</th></tr></thead>
            <tbody>
              ${Object.entries(CMYK_CONDITIONS)
                .map(
                  ([key, c]) => `
                <tr${key === DEFAULT_CMYK_CONDITION ? ' class="is-default"' : ''}>
                  <td><code>${escape(key)}</code>${key === DEFAULT_CMYK_CONDITION ? '<span class="plat-pill">default</span>' : ''}</td>
                  <td>${escape(c.identifier)}</td>
                  <td>${escape(c.info)}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>`)}

      ${panel('type', true, 'plat-type', 'Typography', `
          <p class="plat-section-desc">Bundled (local) variable typefaces — registered via <code>@font-face</code> and available to every tool canvas and the app UI. No webfont/CDN dependency.</p>
          <div class="plat-font-grid">
            ${FONTS.map(
              (f) => `
              <article class="plat-font">
                <header class="plat-font-head">
                  <span class="plat-font-name" style="font-family:${f.stack}">${escape(f.family)}</span>
                  <span class="plat-font-role">${escape(f.role)}</span>
                </header>
                <div class="plat-font-specimen" style="font-family:${f.stack}">
                  <div class="plat-font-aa">Aa</div>
                  <p class="plat-font-pangram">The quick brown fox jumps over the lazy dog 0123456789</p>
                  <div class="plat-font-weights">
                    ${WEIGHT_RAMP.map((w) => `<span style="font-weight:${w}">${w}</span>`).join('')}
                  </div>
                </div>
                <dl class="plat-kv">
                  <div><dt>Type</dt><dd>${f.variable ? 'Variable' : 'Static'} · ${escape(f.weights)}</dd></div>
                  <div><dt>Styles</dt><dd>${f.styles.map(escape).join(', ')}</dd></div>
                  <div><dt>Source</dt><dd><code class="plat-src">${escape(f.source)}</code></dd></div>
                </dl>
              </article>`,
            ).join('')}
          </div>`)}

      ${panel('themes', true, 'plat-themes', 'Themes', `
          <p class="plat-section-desc">Selected via <code>[data-theme]</code> on the document. Each preview below is rendered in its own theme tokens.</p>
          <div class="plat-theme-grid">
            ${THEMES.map(
              (t) => `
              <div class="plat-theme" data-theme="${escape(t)}">
                <div class="plat-theme-name">${escape(t)}${t === 'light' ? '<span class="plat-pill">default</span>' : ''}</div>
                <div class="plat-theme-dots">
                  <span style="background:hsl(var(--primary))" title="primary"></span>
                  <span style="background:hsl(var(--card))" title="card"></span>
                  <span style="background:hsl(var(--accent))" title="accent"></span>
                  <span style="background:hsl(var(--muted))" title="muted"></span>
                  <span style="background:hsl(var(--foreground))" title="foreground"></span>
                </div>
                <div class="plat-theme-sample">Aa</div>
              </div>`,
            ).join('')}
          </div>`)}

      ${panel('catalog', true, 'plat-catalogue', 'Catalogue', `
          <p class="plat-section-desc">What ships in this build, synced to clients as data.</p>
          <div class="plat-stat-block">
            <h3 class="plat-ramp-title">Tools <span class="plat-ramp-count">${tools.length}</span></h3>
            <div class="plat-stats">
              ${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => stat(v, k)).join('') || '<span class="plat-muted">none loaded</span>'}
            </div>
            <div class="plat-stats plat-stats--sub">
              ${Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="plat-chip">${v} ${escape(k)}</span>`).join('')}
            </div>
          </div>
          <div class="plat-stat-block" data-asset-block>
            <h3 class="plat-ramp-title">Brand assets <span class="plat-ramp-count" data-asset-count hidden></span></h3>
            <div class="plat-stats" data-asset-stats><span class="plat-muted">reading…</span></div>
          </div>`)}
    </div>
  `;

  // Arm the entrance cascade synchronously (nothing is awaited between innerHTML
  // and here) so the first paint already carries the hidden state — back-link →
  // header → each section reveal as one wave.
  armViewEnter(viewEl);

  // Read-only convenience: click a swatch chip to copy its hex. Doesn't touch app
  // state — purely a clipboard nicety. Degrades silently where clipboard is absent.
  viewEl.querySelectorAll('.plat-swatch-chip[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard?.writeText(btn.dataset.copy);
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 900);
      } catch {
        /* clipboard blocked — no-op */
      }
    });
  });

  // Keep the `live` rows (Viewport, Orientation) current while the "This device"
  // panel is open — they're the only values that change mid-session. We attach
  // resize/orientation listeners ONLY while the panel is expanded (and refresh
  // once on expand to catch changes made while collapsed), so a collapsed panel
  // costs nothing. rAF-coalesced so a resize drag updates at most once per frame.
  // Called AFTER the device grid is filled (its [data-live] rows don't exist
  // until then), so it re-queries rather than capturing at mount time.
  function wireDevice() {
    const device = viewEl.querySelector('.plat-device');
    const liveEls = [...viewEl.querySelectorAll('[data-live]')];
    if (!device || !liveEls.length) return;
    let raf = 0;
    const refresh = () => {
      raf = 0;
      for (const el of liveEls) el.textContent = liveValue(el.dataset.live);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(refresh);
    };
    const orientation = screen.orientation;
    const onToggle = () => {
      if (device.open) {
        refresh(); // sync immediately — values may have changed while collapsed
        window.addEventListener('resize', schedule);
        orientation?.addEventListener?.('change', schedule);
      } else {
        window.removeEventListener('resize', schedule);
        orientation?.removeEventListener?.('change', schedule);
      }
    };
    device.addEventListener('toggle', onToggle);
    if (device.open) onToggle(); // deep-linked open: wire listeners now (no toggle event fires)
    viewEl._cleanup = () => {
      cancelAnimationFrame(raf);
      device.removeEventListener('toggle', onToggle);
      window.removeEventListener('resize', schedule);
      orientation?.removeEventListener?.('change', schedule);
    };
  }

  // ── Deferred hydration ─────────────────────────────────────────────────────
  // Fill the two pieces we kept off the first-paint path. Each .then is guarded
  // twice: a per-mount token (so a stale fill from a SUPERSEDED same-view re-mount
  // can't wire listeners onto the current one — viewEl is the persistent #view, so
  // contains() alone can't tell two platform mounts apart) and viewEl.contains()
  // (so a fill resolving after navigation to a DIFFERENT view writes nothing).
  // `.plat-hydrated` is added in the same tick the content lands, so it fades in
  // rather than popping into the already-revealed section.
  const myMount = (viewEl._platMount = (viewEl._platMount || 0) + 1);
  const isCurrent = (node) => viewEl._platMount === myMount && node && viewEl.contains(node);

  collectClientInfo()
    .then((groups) => {
      const grid = viewEl.querySelector('[data-client-grid]');
      if (!isCurrent(grid)) return;
      grid.innerHTML = groups.map(clientCard).join('');
      grid.classList.add('plat-hydrated');
      wireDevice();
    })
    .catch(() => { /* device snapshot is best-effort */ });

  fetchAssetSummary()
    .then((assets) => {
      const block = viewEl.querySelector('[data-asset-block]');
      if (!isCurrent(block)) return;
      const stats = block.querySelector('[data-asset-stats]');
      if (!assets) {
        if (stats) stats.innerHTML = '<span class="plat-muted">unavailable offline</span>';
        return;
      }
      const count = block.querySelector('[data-asset-count]');
      if (count) { count.textContent = assets.total; count.hidden = false; }
      if (stats) {
        stats.innerHTML = Object.entries(assets.byType)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => stat(v, k))
          .join('');
        stats.classList.add('plat-hydrated');
      }
    })
    .catch(() => { /* offline — leave the placeholder */ });
}

// Brand asset catalogue summary — best-effort; absent offline is fine. No
// `cache: 'no-store'` so a repeat visit reuses the HTTP cache instead of a fresh
// round-trip (the figures only feed the foot-of-page counts).
async function fetchAssetSummary() {
  try {
    const resp = await fetch('/catalog/assets/index.json');
    if (!resp.ok) return null;
    const idx = await resp.json();
    const arr = Array.isArray(idx) ? idx : idx.assets ?? [];
    const byType = {};
    for (const a of arr) {
      const ty = a.type ?? 'other';
      byType[ty] = (byType[ty] || 0) + 1;
    }
    return { total: arr.length, byType };
  } catch {
    return null;
  }
}
