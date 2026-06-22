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
    source: '/tools/lockup/src/fonts/variable/SUSE[wght].ttf',
  },
  {
    family: 'SUSE Mono',
    role: 'Monospace',
    stack: "'SUSE Mono', ui-monospace, monospace",
    variable: true,
    weights: '100–900',
    styles: ['normal', 'italic'],
    source: '/tools/lockup/src/fonts/variable/SUSEMono[wght].ttf',
  },
];

const WEIGHT_RAMP = [100, 300, 400, 500, 700, 900];

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
// it, and whole groups (Network, System Graphics) are omitted when their API is absent.
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
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  } catch {
    return null;
  }
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
  const osFromHints = hints?.platform
    ? `${hints.platform}${hints.platformVersion ? ` ${hints.platformVersion}` : ''}`.trim()
    : null;

  groups.push({
    title: 'Browser',
    rows: [
      { k: 'Browser', v: browserStr },
      { k: 'Engine', v: engineOf(ua) },
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
    rows: [
      { k: 'Operating system', v: osFromHints || parseOS(ua) },
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
    { k: 'Cookies', v: yesNo(nav.cookieEnabled) },
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

  const gpu = readGpu();
  if (gpu) {
    groups.push({
      title: 'System Graphics',
      rows: [
        { k: 'Vendor', v: gpu.vendor || DASH, stacked: true },
        { k: 'Renderer', v: gpu.renderer || DASH, mono: true, stacked: true },
      ],
    });
  }

  return groups;
}

function clientCard(group) {
  return `
    <article class="plat-client-card">
      <h3 class="plat-client-title">${escape(group.title)}</h3>
      <dl class="plat-kv plat-kv--wide">
        ${group.rows
          .map(
            (r) => `
        <div${r.stacked ? ' class="is-stacked"' : ''}>
          <dt>${escape(r.k)}</dt>
          <dd${r.mono ? ' class="is-mono"' : ''}${r.live ? ` data-live="${escape(r.live)}"` : ''}>${escape(String(r.v))}</dd>
        </div>`,
          )
          .join('')}
      </dl>
    </article>`;
}

export async function mountPlatform(viewEl, host) {
  document.title = 'Platform — Lolly';

  // Live client/runtime snapshot for the dashboard card at the top of the page.
  const clientGroups = await collectClientInfo();

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

  // Brand asset catalogue — best-effort; absent offline is fine (we just omit it).
  let assets = null;
  try {
    const resp = await fetch('/catalog/assets/index.json', { cache: 'no-store' });
    if (resp.ok) {
      const idx = await resp.json();
      const arr = Array.isArray(idx) ? idx : idx.assets ?? [];
      const byType = {};
      for (const a of arr) {
        const ty = a.type ?? 'other';
        byType[ty] = (byType[ty] || 0) + 1;
      }
      assets = { total: arr.length, byType };
    }
  } catch {
    /* offline — skip the asset summary */
  }

  const stat = (n, label) => `<span class="plat-stat"><strong>${n}</strong>${escape(label)}</span>`;

  viewEl.innerHTML = `
    <a href="#/" class="tools-home home-full">Tools</a>
    <div class="platform-layout">
      <header class="plat-header">
        <h1 class="plat-title">Platform</h1>
        <p class="plat-sub">A read-only snapshot of the global brand and platform data — the values defined once and reused across every tool, export and surface.</p>
        <p class="plat-note" role="note">
          <strong>Read-only.</strong> Nothing here changes the running app. It is a record of what the platform currently knows; a future
          platform-configuration package will make these editable and exportable to shape new builds.
        </p>
      </header>

      <details class="plat-section plat-device" aria-labelledby="plat-client">
        <summary class="plat-device-summary">
          <h2 id="plat-client" class="plat-section-title">This device</h2>
        </summary>
        <div class="plat-device-body">
          <p class="plat-section-desc">A live, read-only snapshot of the browser and device this session is running on — handy when reproducing a render or export. Read on the fly from the current session; nothing is stored or sent anywhere.</p>
          <div class="plat-client-grid">${clientGroups.map(clientCard).join('')}</div>
        </div>
      </details>

      <section class="plat-section" aria-labelledby="plat-colours">
        <div class="plat-section-head">
          <h2 id="plat-colours" class="plat-section-title">Colour palette</h2>
          <p class="plat-section-desc">Shown as swatches in every colour picker. ${measuredCount} of ${PALETTE.length} have measured <strong>CMYK</strong> ink values that are substituted directly into CMYK PDF exports; the rest fall back to a generic RGB→CMYK conversion.</p>
        </div>
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
          .join('')}
      </section>

      <section class="plat-section" aria-labelledby="plat-print">
        <div class="plat-section-head">
          <h2 id="plat-print" class="plat-section-title">Print &amp; CMYK</h2>
          <p class="plat-section-desc">Press conditions a CMYK PDF can declare in its <code>OutputIntent</code>. Selected per-export via the <code>colorProfile</code> option; raster &amp; on-screen output stays sRGB.</p>
        </div>
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
        </table>
      </section>

      <section class="plat-section" aria-labelledby="plat-type">
        <div class="plat-section-head">
          <h2 id="plat-type" class="plat-section-title">Typography</h2>
          <p class="plat-section-desc">Bundled (local) variable typefaces — registered via <code>@font-face</code> and available to every tool canvas and the app UI. No webfont/CDN dependency.</p>
        </div>
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
        </div>
      </section>

      <section class="plat-section" aria-labelledby="plat-themes">
        <div class="plat-section-head">
          <h2 id="plat-themes" class="plat-section-title">Themes</h2>
          <p class="plat-section-desc">Selected via <code>[data-theme]</code> on the document. Each preview below is rendered in its own theme tokens.</p>
        </div>
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
        </div>
      </section>

      <section class="plat-section" aria-labelledby="plat-catalogue">
        <div class="plat-section-head">
          <h2 id="plat-catalogue" class="plat-section-title">Catalogue</h2>
          <p class="plat-section-desc">What ships in this build, synced to clients as data.</p>
        </div>
        <div class="plat-stat-block">
          <h3 class="plat-ramp-title">Tools <span class="plat-ramp-count">${tools.length}</span></h3>
          <div class="plat-stats">
            ${Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => stat(v, k)).join('') || '<span class="plat-muted">none loaded</span>'}
          </div>
          <div class="plat-stats plat-stats--sub">
            ${Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="plat-chip">${v} ${escape(k)}</span>`).join('')}
          </div>
        </div>
        <div class="plat-stat-block">
          <h3 class="plat-ramp-title">Brand assets ${assets ? `<span class="plat-ramp-count">${assets.total}</span>` : ''}</h3>
          <div class="plat-stats">
            ${
              assets
                ? Object.entries(assets.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => stat(v, k)).join('')
                : '<span class="plat-muted">unavailable offline</span>'
            }
          </div>
        </div>
      </section>
    </div>
  `;

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
  const device = viewEl.querySelector('.plat-device');
  const liveEls = [...viewEl.querySelectorAll('[data-live]')];
  if (device && liveEls.length) {
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
    viewEl._cleanup = () => {
      cancelAnimationFrame(raf);
      device.removeEventListener('toggle', onToggle);
      window.removeEventListener('resize', schedule);
      orientation?.removeEventListener?.('change', schedule);
    };
  }
}
