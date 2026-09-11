// SPDX-License-Identifier: MPL-2.0
/**
 * "This device" - a live, read-only snapshot of the browser / runtime this
 * session is running on. Read entirely from the active session; never stored or
 * transmitted. Every value degrades to ' - ' when the browser doesn't expose it,
 * and whole groups (Network, Graphics) are omitted when their API is absent.
 *
 * Extracted from the old Platform view so the merged Dashboard (#/d) can reuse
 * it. It exposes four things:
 *   - collectDevice()   → { headline, groups } - the full snapshot
 *   - renderDeviceCards(groups) → the KV-card grid (all rows, nothing dropped)
 *   - liveValue(key)    → the values that change mid-session (viewport, orientation)
 *   - wireDeviceLive(root) → keep those [data-live] rows current; returns a disposer
 * The Dashboard owns layout and the hero band; this module owns the data + the
 * detailed cards, so the two can't drift. A view wanting only part of the
 * snapshot (Colour Lab takes Display + the two Graphics cards) filters
 * `groups` by `key` - never by `title`, which is translated.
 */

import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { displayGamutClaim } from './display-gamut.ts';

const DASH = '-';
const yesNo = (v: boolean | null | undefined): string => (v === true ? t('Yes') : v === false ? t('No') : DASH);

// Values that can change while the session is live (window resize, device
// rotation). Read on demand so the same code produces the initial render and
// every real-time refresh - see the `live` rows and the listener wiring the
// Dashboard attaches over [data-live]. Reading (not caching) also means they
// speak the active language: t() resolves at call time, not at module load.
export const LIVE_VALUES: Record<string, () => string> = {
  viewport: () => `${window.innerWidth} × ${window.innerHeight}`,
  viewportOrientation: () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return h > w ? t('Portrait') : w > h ? t('Landscape') : t('Square');
  },
  // The Screen Orientation API's own token ('landscape-primary') - a spec value
  // like a UA string or a GPU renderer name, so it rides through verbatim.
  orientation: () => screen.orientation?.type || DASH,
};
export const liveValue = (key: string): string => LIVE_VALUES[key]?.() ?? DASH;

function matchPref(feature: string, options: string[]): string {
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

// A media-feature keyword as a person reads it. The raw CSS tokens leak the spec
// into the card ("Reduced motion: no-preference"), and a token that never reaches
// t() can't be localised at all - so each one gets a human label, which is also
// its translation key. Unknown keywords (a future value) pass through as-is.
// Every label here is dynamically keyed, so it lives in scripts/i18n/extra-keys.spa.json.
const PREF_LABELS: Record<string, string> = {
  dark: 'Dark',
  light: 'Light',
  reduce: 'Reduce',
  'no-preference': 'No preference',
  more: 'More',
  less: 'Less',
  custom: 'Custom',
  standalone: 'Standalone',
  'minimal-ui': 'Minimal UI',
  fullscreen: 'Fullscreen',
  browser: 'Browser tab',
};
const prefLabel = (raw: string): string => (raw === DASH ? DASH : t(PREF_LABELS[raw] ?? raw));

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return DASH;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${i === 0 ? n : n.toFixed(n >= 10 ? 0 : 1)} ${units[i]!}`; // loop keeps i in-bounds
}

// ---------------------------------------------------------------------------
// Heading icons for the device cards. Two-tier "kind-changing" logic: a generic
// icon each card names for itself, overridden by a specific icon when we can
// identify the browser brand or operating system. Everything is monochrome
// `currentColor`. Brand glyphs are simplified, theme-tinted marks - not the
// vendors' colour logos.
const ICONS: Record<string, string> = {
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
  render:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
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
  windows:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>',
  apple:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M17.05 12.54c-.02-2.27 1.85-3.36 1.94-3.41-1.06-1.55-2.7-1.76-3.29-1.79-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.88-3.71 2.24-1.58 2.75-.4 6.81 1.13 9.04.75 1.09 1.64 2.31 2.81 2.27 1.13-.05 1.56-.73 2.93-.73 1.36 0 1.75.73 2.94.71 1.21-.02 1.98-1.11 2.72-2.21.86-1.26 1.21-2.49 1.23-2.55-.03-.01-2.36-.91-2.38-3.6z"/><path d="M14.78 6.27c.62-.76 1.05-1.8.93-2.85-.9.04-1.99.6-2.64 1.36-.58.67-1.09 1.74-.95 2.76 1 .08 2.03-.51 2.66-1.27z"/></svg>',
  android:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M6 13a6 6 0 0 1 12 0v4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><rect x="2.5" y="12.5" width="2.2" height="6" rx="1.1"/><rect x="19.3" y="12.5" width="2.2" height="6" rx="1.1"/><path d="M8 3.5l1.6 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 3.5l-1.6 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.6" cy="10.5" r=".9" fill="hsl(var(--card))"/><circle cx="14.4" cy="10.5" r=".9" fill="hsl(var(--card))"/></svg>',
  linux:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2c-2.5 0-4 2-4 4.5v3.2c0 1.1-.5 1.9-1.3 2.9C5.3 14.3 4 16 4 17.8c0 .9.6 1.4 1.5 1.2.7-.2 1.3-.7 1.7-1.4-.1.8-.2 1.6-.2 2.2 0 1 .7 1.4 1.7 1.4h6.6c1 0 1.7-.4 1.7-1.4 0-.6-.1-1.4-.2-2.2.4.7 1 1.2 1.7 1.4.9.2 1.5-.3 1.5-1.2 0-1.8-1.3-3.5-2.7-5.2-.8-1-1.3-1.8-1.3-2.9V6.5C16 4 14.5 2 12 2z"/><circle cx="10.3" cy="7" r=".8" fill="hsl(var(--card))"/><circle cx="13.7" cy="7" r=".8" fill="hsl(var(--card))"/><path d="M11 8.7h2l-1 1.5z" fill="hsl(var(--card))"/></svg>',
};

// Each card names its own generic icon at the push site (see collectDevice), so a
// brand/OS-specific mark can override it and the fallback still resolves. It used
// to be a title → icon Record, which quietly coupled the icon to the ENGLISH card
// title - the moment the title became a t() call, every fallback icon vanished.
function browserIcon(name: string): string | null {
  if (!name || name === DASH) return null;
  if (/edge/i.test(name)) return ICONS.edge!;
  if (/opera|opr\b/i.test(name)) return ICONS.opera!;
  if (/samsung/i.test(name)) return null; // no distinct mark → generic browser
  if (/firefox/i.test(name)) return ICONS.firefox!;
  if (/chrom/i.test(name)) return ICONS.chrome!; // Chrome / Chromium
  if (/safari/i.test(name)) return ICONS.safari!;
  return null;
}
function osIcon(os: string): string | null {
  if (!os || os === DASH) return null;
  if (/chrome\s*os|cros/i.test(os)) return ICONS.chrome!; // before the generic mac/linux checks
  if (/windows/i.test(os)) return ICONS.windows!;
  if (/mac|ios|ipad/i.test(os)) return ICONS.apple!;
  if (/android/i.test(os)) return ICONS.android!;
  if (/linux/i.test(os)) return ICONS.linux!;
  return null;
}
function gpuIcon(vendor: string): string | null {
  if (vendor && vendor !== DASH && /apple/i.test(vendor)) return ICONS.apple!;
  return null;
}

// Compact "ARM64"/"x64"-style label for the glance chip - UA-CH's raw
// architecture ('arm'/'x86') + bitness, in the short form people actually recognise.
function archChip(architecture: string, bitness?: string): string {
  const a = architecture.toLowerCase();
  if (a === 'arm') return bitness === '32' ? 'Arm32' : 'Arm64';
  if (a === 'x86') return bitness === '32' ? 'x86' : 'x64';
  return architecture;
}

// "macOS 27.0.0" → "macOS"; "Android 15" → "Android" - the version-free family
// name for the glance chip (the detail cards keep the full version elsewhere).
function osFamily(os: string): string {
  return os === DASH ? DASH : os.replace(/\s+[\d./]+.*$/, '');
}

function parseBrowser(ua: string): string {
  const tests: Array<[string, RegExp]> = [
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

function engineOf(ua: string): string {
  if (/Edg\/|OPR\/|Chrome\//.test(ua)) return 'Blink';
  if (/Firefox\//.test(ua)) return 'Gecko';
  if (/Version\/[\d.]+.*Safari/.test(ua)) return 'WebKit';
  return DASH;
}

interface RenderStackInfo {
  raster: string;
  text: string;
  compositor: string;
}

// The native libraries that actually rasterise vectors and shape text are NOT
// exposed by any web API - but they're a deterministic function of (engine × OS),
// so we infer them (the card says so). Blink/Gecko bundle Skia + HarfBuzz
// cross-platform; WebKit uses Core Graphics / Core Text on Apple OSes and
// Skia (Cairo before WebKitGTK 2.46) + HarfBuzz elsewhere.
function renderStack(engine: string, os: string): RenderStackInfo | null {
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

const GAMUT_LABELS: Record<string, string> = { rec2020: 'Rec. 2020', p3: 'Display P3', srgb: 'sRGB' };

function parseOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  const android = /Android ([\d.]+)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  if (/(iPhone|iPad|iPod)/.test(ua)) {
    const m = /OS ([\d_]+)/.exec(ua);
    return `iOS ${m ? m[1]!.replace(/_/g, '.') : ''}`.trim();
  }
  const mac = /Mac OS X ([\d_]+)/.exec(ua);
  if (mac) return `macOS ${mac[1]!.replace(/_/g, '.')}`;
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return DASH;
}

interface GpuInfo {
  vendor: string;
  renderer: string;
  webgl2: boolean;
  maxTexture: number | null;
}

function readGpu(): GpuInfo | null {
  try {
    const canvas = document.createElement('canvas');
    const gl2 = typeof WebGL2RenderingContext !== 'undefined' ? canvas.getContext('webgl2') : null;
    const gl = (gl2 || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const info = {
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      webgl2: !!gl2,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) || null,
    };
    // Release the context now - we only needed its parameters. Browsers cap live
    // WebGL contexts (~16); without this, one leaks per dashboard visit until GC,
    // eventually logging "Too many active WebGL contexts" and force-dropping old ones.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return info;
  } catch {
    return null;
  }
}

// Chromium runs WebGL through ANGLE, which buries the real hardware inside a
// translation wrapper. describeGpu() pulls the parts that actually identify the
// machine - vendor, chip and graphics backend - and keeps the raw string as a
// detail row. Degrades gracefully for non-ANGLE strings (Safari/Firefox report
// the chip directly).
const GPU_APIS: Array<[RegExp, string]> = [
  [/\bmetal\b/i, 'Metal'],
  [/\bvulkan\b/i, 'Vulkan'],
  [/direct3d\s*11|\bd3d11\b/i, 'Direct3D 11'],
  [/direct3d\s*9|\bd3d9\b/i, 'Direct3D 9'],
  [/opengl\s*es/i, 'OpenGL ES'],
  [/\bopengl\b/i, 'OpenGL'],
];

function detectGpuApi(s: string): string {
  for (const [re, name] of GPU_APIS) if (re.test(s)) return name;
  return DASH;
}

function cleanGpuChip(s: string): string {
  return s
    .replace(/^ANGLE\s+[\w ]*Renderer:\s*/i, '')
    .replace(/\s*\(0x[0-9a-f]+\)/i, '')
    .replace(/\s*Direct3D\d.*$/i, '')
    .replace(/\s*OpenGL(\s*ES)?\b.*$/i, '')
    .replace(/\s+vs_\d.*$/i, '')
    .trim();
}

interface DescribedGpu {
  chip: string;
  hwVendor: string;
  translation: string;
  api: string;
  glVendor: string;
  raw: string;
}

function describeGpu(rawVendor: string, rawRenderer: string): DescribedGpu {
  const vendorRaw = (rawVendor || '').trim();
  const rendererRaw = (rawRenderer || '').trim();

  let glVendor = vendorRaw;
  let hwVendor = vendorRaw;
  const vParen = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(vendorRaw);
  if (vParen) {
    glVendor = vParen[1]!.trim();
    hwVendor = vParen[2]!.trim();
  }

  let translation = 'Native';
  let device = rendererRaw;
  const wrap = /^(\w[\w ]*?)\s*\((.*)\)$/is.exec(rendererRaw);
  if (wrap && /angle/i.test(wrap[1]!)) {
    translation = wrap[1]!.trim();
    const parts = wrap[2]!.split(',').map((p) => p.trim());
    if (parts.length) {
      if (!vParen) hwVendor = parts[0]!; // no paren vendor → take ANGLE's vendor field
      device = parts.length > 2 ? parts.slice(1, -1).join(', ') : parts[parts.length - 1] || rendererRaw;
    }
  }

  return {
    chip: cleanGpuChip(device) || DASH,
    hwVendor: hwVendor || DASH,
    translation,
    api: detectGpuApi(rendererRaw),
    glVendor: glVendor || DASH,
    raw: rendererRaw || DASH,
  };
}

/** UA-Client-Hints high-entropy values (Chromium only). */
interface UaHighEntropyValues {
  platform?: string;
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
  uaFullVersion?: string;
}
interface NavigatorUAData {
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<UaHighEntropyValues>;
}
interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}
type PlatformNavigator = Navigator & {
  userAgentData?: NavigatorUAData;
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
  pdfViewerEnabled?: boolean;
  deviceMemory?: number;
};

/** One row in a device card. */
export interface ClientRow {
  k: string;
  v: string | number;
  mono?: boolean;
  stacked?: boolean;
  hero?: boolean;
  lead?: boolean;
  live?: string;
  note?: string;
}

/**
 * A stable identity for one card, independent of its (translated) title - the
 * handle a view uses to take a subset of the snapshot. Adding a group means
 * adding a key here; the titles stay free to be reworded or localised.
 */
export type ClientGroupKey =
  | 'browser' | 'system' | 'display' | 'locale' | 'capabilities'
  | 'network' | 'render' | 'gpu' | 'graphics';

/** One device card. */
export interface ClientGroup {
  key: ClientGroupKey;
  title: string;
  icon?: string | null;
  note?: string;
  rows: ClientRow[];
}

/** A single big readout in the hero instrument band. */
export interface DeviceStat {
  label: string;
  value: string;
  sub?: string;
  icon?: string | null;
  live?: string;
  mono?: boolean;
}

export interface DeviceSnapshot {
  headline: DeviceStat[];
  groups: ClientGroup[];
  /** Best-fit icon for the collapsed section header - OS mark, else browser
   *  mark, else a generic device glyph. Never blank. */
  icon: string;
  /** Compact glance facts for the collapsed header (machine, memory,
   *  architecture, browser, OS) - only the ones this session actually exposes;
   *  unavailable facts are omitted rather than shown as a dash. */
  chips: string[];
}

/**
 * Collect the full device snapshot: a short list of headline readouts for the
 * hero band and the complete set of grouped key/value cards (every row kept).
 */
export async function collectDevice(): Promise<DeviceSnapshot> {
  const nav = navigator as PlatformNavigator;
  const ua = nav.userAgent || '';
  const groups: ClientGroup[] = [];

  let hints: UaHighEntropyValues | null | undefined = null;
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
  const browserName = browser === DASH ? DASH : browser.replace(/\s+[\d.].*$/, '');
  const engine = engineOf(ua);
  const osFromHints = hints?.platform
    ? `${hints.platform}${hints.platformVersion ? ` ${hints.platformVersion}` : ''}`.trim()
    : null;
  const os = osFromHints || parseOS(ua);

  groups.push({
    key: 'browser',
    title: t('Browser'),
    icon: browserIcon(browser) ?? ICONS.browser!,
    rows: [
      { k: t('Browser'), v: browserStr },
      { k: t('Engine'), v: engine },
      {
        k: t('Mobile'),
        v: nav.userAgentData
          ? yesNo(nav.userAgentData.mobile)
          : yesNo(/(Mobi|Android|iPhone|iPad)/.test(ua)),
      },
      { k: t('Languages'), v: nav.languages?.join(', ') || nav.language || DASH },
      { k: t('User agent'), v: ua || DASH, mono: true, stacked: true },
    ],
  });

  const arch = hints?.architecture
    ? `${hints.architecture}${hints.bitness ? ` · ${tRaw('{n}-bit', { n: hints.bitness })}` : ''}`
    : DASH;
  groups.push({
    key: 'system',
    title: t('System'),
    icon: osIcon(os) ?? ICONS.system!,
    rows: [
      { k: t('Operating system'), v: os },
      { k: t('Architecture'), v: arch },
      { k: t('Device model'), v: hints?.model || DASH },
      { k: t('CPU threads'), v: nav.hardwareConcurrency ?? DASH },
      { k: t('Device memory'), v: nav.deviceMemory ? `${nav.deviceMemory} GB` : DASH },
      { k: t('Touch points'), v: Number.isFinite(nav.maxTouchPoints) ? nav.maxTouchPoints : DASH },
    ],
  });

  const dpr = window.devicePixelRatio;
  // Gamut names are proper nouns (sRGB, Display P3, Rec. 2020) - never translated.
  // One detector for the whole shell (lib/display-gamut.ts), which the colour
  // charts also anchor their pixels to - so this readout and what is on screen can
  // never come from two different answers. Unlike the charts, this one reports the
  // rec2020 claim as-is: it is a diagnostic, not a promise about pixels.
  const gamut = GAMUT_LABELS[displayGamutClaim()] || DASH;
  const dynRangeRaw = matchPref('dynamic-range', ['high', 'standard']);
  const dynRange =
    dynRangeRaw === 'high' ? t('High (HDR)') : dynRangeRaw === 'standard' ? t('Standard') : DASH;
  groups.push({
    key: 'display',
    title: t('Display'),
    icon: ICONS.display!,
    rows: [
      { k: t('Screen'), v: `${screen.width} × ${screen.height}` },
      { k: t('Available'), v: `${screen.availWidth} × ${screen.availHeight}` },
      { k: t('Viewport'), v: liveValue('viewport'), live: 'viewport' },
      { k: t('Viewport orientation'), v: liveValue('viewportOrientation'), live: 'viewportOrientation' },
      { k: t('Pixel ratio'), v: dpr ? `${Math.round(dpr * 100) / 100}×` : DASH },
      { k: t('Colour depth'), v: screen.colorDepth ? t('{n}-bit', { n: screen.colorDepth }) : DASH },
      { k: t('Colour gamut'), v: gamut },
      { k: t('Dynamic range'), v: dynRange },
      { k: t('Orientation'), v: liveValue('orientation'), live: 'orientation' },
    ],
  });

  let intl: Partial<Intl.ResolvedDateTimeFormatOptions> = {};
  try {
    intl = Intl.DateTimeFormat().resolvedOptions();
  } catch {
    /* ignore */
  }
  groups.push({
    key: 'locale',
    title: t('Locale & preferences'),
    icon: ICONS.locale!,
    rows: [
      { k: t('Locale'), v: intl.locale || nav.language || DASH },
      { k: t('Time zone'), v: intl.timeZone || DASH },
      { k: t('Colour scheme'), v: prefLabel(matchPref('prefers-color-scheme', ['dark', 'light'])) },
      { k: t('Reduced motion'), v: prefLabel(matchPref('prefers-reduced-motion', ['reduce', 'no-preference'])) },
      { k: t('Contrast'), v: prefLabel(matchPref('prefers-contrast', ['more', 'less', 'custom', 'no-preference'])) },
      { k: t('Display mode'), v: prefLabel(matchPref('display-mode', ['standalone', 'minimal-ui', 'fullscreen', 'browser'])) },
    ],
  });

  const onOff = (on: boolean): string => (on ? t('On') : t('Off'));
  const capRows: ClientRow[] = [
    { k: t('Cookies'), v: yesNo(nav.cookieEnabled), note: t('not in use') },
    { k: t('Online'), v: yesNo(nav.onLine) },
    { k: t('Do Not Track'), v: nav.doNotTrack === '1' ? t('On') : nav.doNotTrack === '0' ? t('Off') : DASH },
    { k: t('Service worker'), v: yesNo('serviceWorker' in nav) },
    { k: t('PDF viewer'), v: 'pdfViewerEnabled' in nav ? yesNo(nav.pdfViewerEnabled) : DASH },
  ];
  try {
    const est = await nav.storage?.estimate?.();
    if (est && Number.isFinite(est.quota)) {
      // Number.isFinite proves quota present.
      capRows.push({ k: t('Storage'), v: t('{used} of {quota}', { used: fmtBytes(est.usage || 0), quota: fmtBytes(est.quota!) }) });
    }
  } catch {
    /* ignore */
  }
  groups.push({ key: 'capabilities', title: t('Capabilities & privacy'), icon: ICONS.capabilities!, rows: capRows });

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (conn) {
    groups.push({
      key: 'network',
      title: t('Network'),
      icon: ICONS.network!,
      rows: [
        { k: t('Effective type'), v: conn.effectiveType ? conn.effectiveType.toUpperCase() : DASH },
        { k: t('Downlink'), v: Number.isFinite(conn.downlink) ? `${conn.downlink} Mb/s` : DASH },
        { k: t('Round trip'), v: Number.isFinite(conn.rtt) ? `${conn.rtt} ms` : DASH },
        { k: t('Data saver'), v: 'saveData' in conn ? onOff(!!conn.saveData) : DASH },
      ],
    });
  }

  const stack = renderStack(engine, os);
  if (stack) {
    groups.push({
      key: 'render',
      title: t('Rendering stack'),
      icon: ICONS.render!,
      note: t('The engine’s native 2D and text libraries - inferred from engine + OS, not reported by any web API.'),
      rows: [
        // Library names (Skia, HarfBuzz, Core Text…) are proper nouns - untranslated.
        { k: t('2D rasteriser'), v: stack.raster },
        { k: t('Text shaping'), v: stack.text },
        { k: t('Compositor'), v: stack.compositor },
      ],
    });
  }

  let chip = DASH;
  let hwVendor = DASH;
  let gpuApi = DASH;
  const gpu = readGpu();
  if (gpu) {
    const g = describeGpu(gpu.vendor, gpu.renderer);
    chip = g.chip;
    hwVendor = g.hwVendor;
    gpuApi = g.api;
    groups.push({
      key: 'gpu',
      title: t('System Graphics'),
      icon: gpuIcon(g.hwVendor) ?? ICONS.graphics!,
      rows: [{ k: t('GPU'), v: g.chip, hero: true }],
    });
    groups.push({
      key: 'graphics',
      title: t('Browser Graphics'),
      icon: ICONS.layers!,
      rows: [
        // 'Native' is the only word here - API names (Metal, Vulkan, Direct3D) and
        // the translation layer (ANGLE) are proper nouns, as is the raw report.
        { k: t('Graphics API'), v: g.api },
        { k: t('Translation'), v: g.translation === 'Native' ? t('Native') : g.translation },
        { k: t('Vendor'), v: g.glVendor },
        { k: t('WebGL'), v: gpu.webgl2 ? '2.0' : '1.0' },
        { k: t('WebGPU'), v: 'gpu' in navigator ? t('Supported') : DASH },
        { k: t('Max texture'), v: gpu.maxTexture ? `${gpu.maxTexture} px` : DASH },
        { k: t('Reported'), v: g.raw, mono: true, stacked: true },
      ],
    });
  }

  // Headline readouts for the hero band - the facts people find fascinating,
  // sized big. The GPU chip is the star (it names the actual machine), so it
  // leads. Everything degrades to ' - ' the same way the cards do.
  const headline: DeviceStat[] = [
    { label: t('Machine'), value: chip, sub: hwVendor !== DASH ? hwVendor : gpuApi !== DASH ? gpuApi : undefined, icon: gpuIcon(hwVendor) || ICONS.graphics!, mono: true },
    { label: t('Operating system'), value: os, sub: arch !== DASH ? arch : undefined, icon: osIcon(os) || ICONS.system! },
    { label: t('Browser'), value: browserName, sub: engine !== DASH ? tRaw('{engine} engine', { engine }) : undefined, icon: browserIcon(browser) || ICONS.browser! },
    { label: t('Display'), value: `${screen.width} × ${screen.height}`, sub: dpr ? t('{n}× density', { n: Math.round(dpr * 100) / 100 }) : undefined, icon: ICONS.display! },
    { label: t('Colour'), value: gamut, sub: dynRange !== DASH ? dynRange : undefined, icon: ICONS.capabilities! },
    { label: t('Viewport'), value: liveValue('viewport'), sub: t('live'), icon: ICONS.layers!, live: 'viewport' },
  ];

  // A single best-fit icon for the collapsed section header: the OS mark reads
  // best (it's what people recognise their own device by), then the browser
  // mark, then the generic chip glyph the System card already uses - never blank.
  const icon = osIcon(os) || browserIcon(browser) || ICONS.system!;

  // Compact glance chips for the collapsed header - machine leads (it's the
  // most identifying fact, same as the hero band), then memory/architecture/
  // browser/OS. Only facts this session actually exposes; the rest are
  // silently skipped rather than shown as a dash - a chip row is a preview,
  // not a checklist of what's missing. The machine chip in particular is only
  // worth showing when it's actually short (a clean "AppleM4") - a software
  // renderer's verbose GPU string ("Google Vulkan 1.3.0 (SwiftShader Device
  // (LLVM 10.0.0))") reads as a wall of text, not a glance chip, so skip it.
  // The chip string itself sometimes already carries the vendor name (real
  // Apple Silicon reports the GPU renderer as "Apple M4", not just "M4") - only
  // prepend hwVendor when chip doesn't already start with it, or it reads
  // "AppleApple M4".
  const machineChip = (hwVendor !== DASH && chip !== DASH
    ? (chip.toLowerCase().includes(hwVendor.toLowerCase()) ? chip : `${hwVendor} ${chip}`)
    : hwVendor !== DASH ? hwVendor : chip !== DASH ? chip : ''
  ).replace(/\s+/g, '');
  const chips = [
    machineChip.length <= 20 ? machineChip : '',
    nav.deviceMemory ? `${nav.deviceMemory}GB` : '',
    hints?.architecture ? archChip(hints.architecture, hints.bitness) : '',
    browserName !== DASH ? browserName : '',
    osFamily(os) !== DASH ? osFamily(os) : '',
  ].filter(Boolean);

  return { headline, groups, icon, chips };
}

/** Render one device card (all rows; a `hero` row is sized big by CSS). */
function clientCard(group: ClientGroup): string {
  const icon = group.icon || '';
  return `
    <article class="plat-client-card">
      <h3 class="plat-client-title">${icon ? `<span class="plat-client-icon" aria-hidden="true">${icon}</span>` : ''}<span>${escape(group.title)}</span></h3>
      ${group.note ? `<p class="plat-client-note">${escape(group.note)}</p>` : ''}
      <dl class="plat-kv plat-kv--wide">
        ${group.rows
          .map((r) => {
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

/** The full grid of device cards. */
export function renderDeviceCards(groups: ClientGroup[]): string {
  return groups.map(clientCard).join('');
}

/**
 * Keep the `[data-live]` rows inside `root` current for as long as the view is
 * mounted - viewport size and orientation are the only values in the snapshot
 * that move while you watch them, and a stale "1440 × 900" beside a window you
 * just resized reads as a bug in the readout rather than a stale render.
 *
 * Call AFTER the rows exist (the snapshot is async, so that's inside the
 * `collectDevice()` continuation). Returns a disposer; every caller must run it
 * on unmount - `#view` is persistent, so nothing detaches these listeners for us.
 */
export function wireDeviceLive(root: HTMLElement): () => void {
  const liveEls = [...root.querySelectorAll<HTMLElement>('[data-live]')];
  if (!liveEls.length) return () => { /* nothing wired */ };
  let raf = 0;
  const refresh = (): void => {
    raf = 0;
    for (const el of liveEls) el.textContent = liveValue(el.dataset.live!); // the selector guarantees the attribute
  };
  // Coalesce a resize drag's flood of events into one read per frame.
  const schedule = (): void => { if (!raf) raf = requestAnimationFrame(refresh); };
  const orientation = screen.orientation;
  window.addEventListener('resize', schedule);
  orientation?.addEventListener?.('change', schedule);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', schedule);
    orientation?.removeEventListener?.('change', schedule);
  };
}

/** One big hero readout. */
export function renderDeviceStat(s: DeviceStat): string {
  const val = escape(s.value);
  return `
    <div class="dash-dev-stat">
      ${s.icon ? `<span class="dash-dev-stat-icon" aria-hidden="true">${s.icon}</span>` : ''}
      <span class="dash-dev-stat-label">${escape(s.label)}</span>
      <span class="dash-dev-stat-value${s.mono ? ' is-mono' : ''}"${s.live ? ` data-live="${escape(s.live)}"` : ''}>${val}</span>
      ${s.sub ? `<span class="dash-dev-stat-sub">${escape(s.sub)}</span>` : ''}
    </div>`;
}
