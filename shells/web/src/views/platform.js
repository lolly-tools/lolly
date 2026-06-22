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

// Split the flat palette into the named "brand" colours and the numbered tint
// ramps (e.g. "Jungle 1".."Jungle 8"), grouped by family in first-seen order.
function groupPalette(palette) {
  const ramps = new Map();
  const brand = [];
  for (const c of palette) {
    const m = /^(.+?)\s+\d+$/.exec(c.label);
    if (m) {
      if (!ramps.has(m[1])) ramps.set(m[1], []);
      ramps.get(m[1]).push(c);
    } else {
      brand.push(c);
    }
  }
  return { brand, ramps: [...ramps] };
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

export async function mountPlatform(viewEl, host) {
  document.title = 'Platform — Lolly';

  const { brand, ramps } = groupPalette(PALETTE);
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
}
