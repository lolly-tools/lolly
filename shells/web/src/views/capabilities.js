/**
 * Capabilities view — a human-readable map of what Lolly can actually do.
 *
 * A straight feature-set page (not marketing): the breadth and depth of the
 * platform, organised so someone evaluating Lolly can see the whole surface at a
 * glance and drill into any area. It reuses the Platform view's chrome (the
 * `.plat-*` design language, collapsible sections) so the two read as siblings.
 *
 * Content here is descriptive prose about settled capabilities; the only live
 * value is the tool count (read from the synced catalogue). Everything else is
 * stable platform fact, kept in step with docs/exporting.md, docs/using.md and
 * the export bridge. Read-only — it changes nothing about the running app.
 */

import { escape } from '../utils.js';

// Small, monochrome line icons (inherit the heading colour via currentColor).
const I = (p) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
  edit:     I('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  mobile:   I('<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>'),
  install:  I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12l4 4 4-4"/>'),
  link:     I('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
  save:     I('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  grid:     I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  extension:I('<path d="M4 7h4V5a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4H4z"/>'),
  transfer: I('<path d="M4 7h13M13 3l4 4-4 4"/><path d="M20 17H7M11 21l-4-4 4-4"/>'),
  globe:    I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>'),
  desktop:  I('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  phone:    I('<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="10" y1="18" x2="14" y2="18"/>'),
  terminal: I('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M13 15h4"/>'),
  layers:   I('<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'),
  vector:   I('<rect x="2" y="2" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 5h7a4 4 0 0 1 4 4v7"/>'),
  image:    I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  printer:  I('<path d="M6 9V2h12v7"/><rect x="6" y="13" width="12" height="8"/><path d="M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>'),
  film:     I('<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5"/>'),
  doc:      I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  zip:      I('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M12 7v2M12 11v2M12 15v3"/>'),
  ruler:    I('<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 11l2 2M11 7l2 2M15 11l2 2"/>'),
  swatch:   I('<rect x="3" y="3" width="7" height="18" rx="1"/><path d="M10 14 17 7l4 4-9 9H10z"/>'),
  marks:    I('<path d="M9 3v6H3M21 9h-6V3M3 15h6v6M15 21v-6h6"/>'),
  stamp:    I('<path d="M5 21h14"/><path d="M9 12a3 3 0 0 1-3-3 3 3 0 0 1 6 0 3 3 0 0 1-3 3z"/><path d="M9 12v3h6v-3"/>'),
  lock:     I('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  repeat:   I('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  url:      I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>'),
  bot:      I('<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 8V4M9 13h.01M15 13h.01M9 16h6"/>'),
  shield:   I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  device:   I('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 9h6"/>'),
  brush:    I('<path d="M3 21c3 0 4-3 4-3a3 3 0 1 0-4-4s-3 1-3 4a3 3 0 0 0 3 3z"/><path d="M11 13 19 5a2.8 2.8 0 0 0-4-4l-8 8"/>'),
  font:     I('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
  user:     I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  tag:      I('<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  cube:     I('<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m12 12 9-5M12 12v10M12 12 3 7"/>'),
  bridge:   I('<path d="M3 18v-5a9 9 0 0 1 18 0v5M3 13h18M8 13v5M16 13v5M12 13v5"/>'),
  sync:     I('<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>'),
  id:       I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 9h4M14 13h4M6 16h6"/>'),
  open:     I('<path d="M7 11V7a5 5 0 0 1 10 0M4 11h16v9H4z"/>'),
};

// One feature card: an icon + group title, then a stacked list of named features.
// `desc` strings may carry safe inline <code>/<strong> (authored here, not user input).
function card({ icon, title, features }) {
  return `
    <article class="plat-client-card cap-card">
      <h3 class="plat-client-title">${icon ? `<span class="plat-client-icon" aria-hidden="true">${icon}</span>` : ''}<span>${escape(title)}</span></h3>
      <dl class="cap-feat">
        ${features.map((f) => `<div><dt>${escape(f.name)}</dt><dd>${f.desc}</dd></div>`).join('')}
      </dl>
    </article>`;
}

// The page content. Each section becomes a collapsible <details> panel; `open`
// controls the default state (any section can be force-opened via its hash flag,
// e.g. #/capabilities?print). Cards are authored facts kept in step with the docs.
const SECTIONS = [
  {
    flag: 'experiences', open: true, id: 'cap-experiences', title: 'Experiences',
    desc: 'The ways people actually use Lolly — from a thumb-typed edit on a phone to a one-link share or an automated render. The same tool, met where you are.',
    cards: [
      { icon: ICONS.edit, title: 'Live tool editing', features: [
        { name: 'Split view', desc: 'Controls on one side, a live canvas on the other — change any input and the preview updates instantly.' },
        { name: 'The preview is the file', desc: 'What you see is exactly what exports — no separate render step.' },
        { name: 'Zoom &amp; pan', desc: 'Cmd/Ctrl-scroll or pinch to zoom; <code>Space</code>-drag or middle-drag to pan; <code>0</code> fit, <code>1</code> = 100%.' },
      ] },
      { icon: ICONS.mobile, title: 'On a phone', features: [
        { name: 'Controls sheet', desc: 'The inputs become a sheet with a drag grip that snaps to peek / half / full; the preview stays visible while you edit.' },
        { name: 'Render sheet', desc: 'A floating Render button opens every format, size, copy, save and share control — sized for touch.' },
        { name: 'Touch canvas', desc: 'Pinch to zoom, drag to pan, double-tap to fit.' },
      ] },
      { icon: ICONS.install, title: 'Install &amp; full-screen', features: [
        { name: 'Installable PWA', desc: 'Add to home screen / install from the address bar for an app-like, full-screen experience; updates itself when online.' },
        { name: 'Deep-link modes', desc: '<code>full</code> opens fullscreen (sidebar collapsed); <code>options</code> opens with the export panel expanded.' },
      ] },
      { icon: ICONS.link, title: 'Share a link', features: [
        { name: 'The URL is the design', desc: 'Every input lives in the link — paste it to a colleague, bookmark it, or commit it.' },
        { name: 'Act-on-open flags', desc: 'Add <code>&amp;export</code> to download on open, or <code>&amp;copy</code> to arm copy-to-clipboard.' },
      ] },
      { icon: ICONS.save, title: 'Save &amp; continue', features: [
        { name: 'Named sessions', desc: 'Keep multiple saved sessions per tool, all device-local; Continue resumes your most recent.' },
        { name: 'Copy to clipboard', desc: 'Paste an image straight into Slack, email or a doc; falls back to a download where the browser can’t.' },
      ] },
      { icon: ICONS.grid, title: 'Batch (Pro) mode', features: [
        { name: 'Many at once', desc: 'A grid where each row is a set of inputs, all exported together — a dozen languages or every size variant in one pass.' },
      ] },
      { icon: ICONS.extension, title: 'Browser extension', features: [
        { name: 'Capture into a tool', desc: 'Pull a page or screenshot from the browser into a Lolly tool to finish it on-brand.' },
      ] },
      { icon: ICONS.transfer, title: 'Move to another device', features: [
        { name: 'Portable backup', desc: 'Export one checksummed zip — profile, every session + thumbnail, your images and preferences — and import-merge it on another install. No account, no cloud.' },
      ] },
    ],
  },
  {
    flag: 'platforms', open: true, id: 'cap-platforms', title: 'Platforms & runtimes',
    desc: 'One platform-agnostic engine and the same render path on every surface, so a tool — and its output — behaves identically wherever it runs.',
    cards: [
      { icon: ICONS.globe, title: 'Web PWA', features: [
        { name: 'Installable & offline', desc: 'Works fully offline after the first load; installs as an app; auto-updates online.' },
      ] },
      { icon: ICONS.desktop, title: 'Desktop', features: [
        { name: 'macOS & Linux', desc: 'Native packages via Tauri — the same engine in a desktop shell.' },
      ] },
      { icon: ICONS.phone, title: 'Mobile', features: [
        { name: 'iOS & Android', desc: 'Installable mobile packages via Tauri, with the touch-first UI.' },
      ] },
      { icon: ICONS.terminal, title: 'Command line', features: [
        { name: 'Headless render', desc: 'Run any tool from the CLI (jsdom + the same engine); write to a file or stdout.' },
        { name: 'Same parameters', desc: '<code>--flag=value</code> arguments are the URL params — a web link runs unchanged on the CLI.' },
      ] },
      { icon: ICONS.layers, title: 'One engine everywhere', features: [
        { name: 'No drift', desc: 'The engine knows nothing about the DOM, storage or networking; a capability bridge injects each host’s specifics, so GUI and CLI never diverge.' },
      ] },
    ],
  },
  {
    flag: 'formats', open: true, id: 'cap-formats', title: 'Export formats',
    desc: 'Twenty formats across vector, raster, print, motion and data. A tool offers only the formats its author declared, and the picker hides any your browser can’t produce.',
    cards: [
      { icon: ICONS.vector, title: 'Vector', features: [
        { name: 'SVG', desc: 'Infinitely scalable and self-contained — text is outlined to paths (HarfBuzz-shaped) so it renders identically without the font installed.' },
      ] },
      { icon: ICONS.image, title: 'Raster', features: [
        { name: 'PNG · JPG · WebP · AVIF · ICO', desc: 'Lossless or compact, alpha where supported, with the real DPI and an embedded sRGB ICC profile so colour reproduces faithfully.' },
      ] },
      { icon: ICONS.printer, title: 'Print', features: [
        { name: 'PDF · Print PDF (CMYK) · CMYK TIFF', desc: 'True page sizes and DeviceCMYK output for the press — see Print production below.' },
      ] },
      { icon: ICONS.film, title: 'Motion', features: [
        { name: 'MP4 · WebM · GIF', desc: 'Animated tools record to video (the picker shows what your browser can encode) or GIF, which works everywhere.' },
      ] },
      { icon: ICONS.doc, title: 'Documents & data', features: [
        { name: 'HTML · MD · TXT', desc: 'HTML pastes formatted into mail clients; Markdown and plain text for content.' },
        { name: 'JSON · CSV · ICS · VCF', desc: 'Structured data straight from the input model — calendar invites, contacts, tabular and machine-readable payloads.' },
      ] },
      { icon: ICONS.zip, title: 'Bundles', features: [
        { name: 'ZIP', desc: 'Bundle several formats of one design into a single download.' },
      ] },
    ],
  },
  {
    flag: 'print', open: true, id: 'cap-print', title: 'Print production',
    desc: 'Press-ready output computed entirely on-device — the engine owns the dimension and colour maths, and each shell draws it. No print service, no upload.',
    cards: [
      { icon: ICONS.ruler, title: 'Physical sizing', features: [
        { name: 'Real units & DPI', desc: 'Set width × height in <code>mm/cm/in/pt/pc</code> at a DPI (default 300). PDF becomes a true page, raster renders the exact pixel count (and embeds the resolution), SVG keeps the physical unit with a px viewBox.' },
      ] },
      { icon: ICONS.swatch, title: 'CMYK colour', features: [
        { name: 'DeviceCMYK output', desc: 'Print PDF and CMYK TIFF write CMYK, not RGB.' },
        { name: 'Exact brand inks', desc: 'Brand swatches with measured CMYK values are substituted exactly; other colours use a standard device conversion.' },
      ] },
      { icon: ICONS.id, title: 'Press conditions', features: [
        { name: 'OutputIntent', desc: 'A CMYK PDF declares its target press condition (Coated FOGRA39 by default; FOGRA51, SWOP and more) so a RIP knows how the inks are meant to read. On-screen and raster stay sRGB.' },
      ] },
      { icon: ICONS.marks, title: 'Bleed & marks', features: [
        { name: 'Trim, bleed & marks', desc: 'Add bleed (with declared TrimBox/BleedBox) plus crop, registration and bleed marks in the margin; registration prints on every plate.' },
      ] },
      { icon: ICONS.swatch, title: 'Colour bars', features: [
        { name: 'Calibration + verification', desc: 'A solid C/M/Y/K process strip to calibrate against, then RGB↔CMYK pairs for the brand inks actually used — so a press operator can confirm the conversion landed.' },
      ] },
      { icon: ICONS.stamp, title: 'Provenance stamps', features: [
        { name: 'Proof-margin credits', desc: 'Optional timestamp, “Made with…”, and tool/author credit in the margin — a proof annotation, trimmed at the final cut.' },
      ] },
      { icon: ICONS.lock, title: 'Locked PDFs', features: [
        { name: 'Open password', desc: 'A plain PDF can carry an open-password (a basic lock for short-lived transactional material).' },
      ] },
    ],
  },
  {
    flag: 'determinism', open: false, id: 'cap-determinism', title: 'Determinism & reproducibility',
    desc: 'The same inputs produce the same file — on every device, today and next year. Output is a build artifact, not a stochastic guess.',
    cards: [
      { icon: ICONS.repeat, title: 'One render path', features: [
        { name: 'No surprises', desc: 'Web, mobile, desktop and CLI share the engine; there is one code path that turns inputs into a file.' },
      ] },
      { icon: ICONS.url, title: 'URL = state', features: [
        { name: 'Reproducible from a link', desc: 'Every input is expressible as a URL parameter, so a link reproduces the design exactly — commit it, diff it, regenerate on demand.' },
      ] },
      { icon: ICONS.tag, title: 'Version pinning', features: [
        { name: 'Forward-compatible', desc: 'Pin a tool version with <code>_v</code> so a saved link keeps rendering the way it did when you made it.' },
      ] },
      { icon: ICONS.shield, title: 'Auditable', features: [
        { name: 'Reviewable output', desc: 'No model, no server, no randomness — outputs are inspectable and version-controllable.' },
      ] },
    ],
  },
  {
    flag: 'automation', open: false, id: 'cap-automation', title: 'Automation & AI',
    desc: 'Built to be driven by scripts, pipelines and agents as easily as by a person.',
    cards: [
      { icon: ICONS.terminal, title: 'CLI & pipelines', features: [
        { name: 'Generate at build time', desc: 'Produce OG images, QR codes, social cards and data visuals from the command line — repeatably, as part of CI, instead of checking binaries into Git.' },
      ] },
      { icon: ICONS.url, title: 'URL mode', features: [
        { name: 'Everything is a parameter', desc: 'Inputs plus reserved controls — <code>format</code>, <code>export</code>, <code>copy</code>, size/unit/dpi, bleed and marks — all expressible in a link.' },
      ] },
      { icon: ICONS.bot, title: 'AI agents', features: [
        { name: 'Cheap & deterministic', desc: 'A parameterised URL is a few tokens and always renders the same press-quality result locally — no prompt drift, no stochastic surprises in production.' },
      ] },
      { icon: ICONS.grid, title: 'Batch', features: [
        { name: 'Many in one pass', desc: 'Render every variant of a design at once from a grid of input sets.' },
      ] },
    ],
  },
  {
    flag: 'brand', open: false, id: 'cap-brand', title: 'Brand & design system',
    desc: 'Design decisions are locked at the template level; only the inputs that are meant to vary are exposed — so whatever anyone makes is on-brand by construction.',
    cards: [
      { icon: ICONS.brush, title: 'Constraint-first tools', features: [
        { name: 'Guardrails, not guidelines', desc: 'Authors hard-code typography, colour and spacing; users just fill in content. The tool is the brand guardrail.' },
      ] },
      { icon: ICONS.swatch, title: 'Tokens, themes & palette', features: [
        { name: 'Defined once, used everywhere', desc: 'Shared design tokens and multiple themes; the brand palette appears in every colour picker, with measured CMYK ink values where known.' },
      ] },
      { icon: ICONS.font, title: 'Bundled type', features: [
        { name: 'Local variable fonts', desc: 'SUSE and SUSE Mono ship with the app — no webfont or CDN dependency at render time.' },
      ] },
      { icon: ICONS.user, title: 'Personalisation', features: [
        { name: 'Bind to your profile', desc: 'Any input can pre-fill from your saved name, contact details or headshot (opt-in); override per session.' },
      ] },
      { icon: ICONS.tag, title: 'Maturity tags', features: [
        { name: 'Approved by default', desc: 'Every tool declares official / community / experimental; experimental tools watermark their exports — applied by the host, so it can’t be edited out.' },
      ] },
    ],
  },
  {
    flag: 'privacy', open: false, id: 'cap-privacy', title: 'Privacy & data ownership',
    desc: 'Creative production stays on the device, under your control — there is no place for a file to leak to.',
    cards: [
      { icon: ICONS.shield, title: 'On-device by default', features: [
        { name: 'Nothing transmitted', desc: 'No cloud rendering, no analytics, no telemetry. What you create stays on your machine.' },
      ] },
      { icon: ICONS.device, title: 'Local storage', features: [
        { name: 'Your browser’s database', desc: 'Profile, saved sessions, uploaded images and the catalogue cache live in IndexedDB; Storage tools show usage and let you clear it.' },
      ] },
      { icon: ICONS.image, title: 'Image hygiene', features: [
        { name: 'Stripped & local', desc: 'Images you add are downscaled and stripped of EXIF/GPS, then kept in a local My images library — never uploaded.' },
      ] },
      { icon: ICONS.lock, title: 'Self-host / air-gap', features: [
        { name: 'No backend', desc: 'No server-side processing or database — deploy on your own infrastructure and run entirely behind your firewall.' },
      ] },
    ],
  },
  {
    flag: 'architecture', open: false, id: 'cap-architecture', title: 'Architecture (for builders)',
    desc: 'The structure that makes the rest possible: tools are data, not bundled code, so new tools ship without an app update.',
    cards: [
      { icon: ICONS.doc, title: 'Declarative tools', features: [
        { name: 'Manifest + template + hooks', desc: 'A tool is a manifest, a template and optional hooks; inputs are declared, not inferred. Non-developers can author the template; hooks are the escape hatch for real logic.' },
      ] },
      { icon: ICONS.bridge, title: 'Capability bridge', features: [
        { name: 'One tool, every shell', desc: 'Tools call a versioned <code>host.*</code> API (profile, assets, state, clipboard, export, text-to-path) and never touch the DOM, filesystem or network directly — which is why one tool runs unchanged in browser, Tauri and CLI.' },
      ] },
      { icon: ICONS.sync, title: 'Synced as data', features: [
        { name: 'No app update needed', desc: 'Tools and assets sync from a signed manifest; new tools appear automatically on clients.' },
      ] },
      { icon: ICONS.id, title: 'Stable asset IDs', features: [
        { name: 'Permanent contracts', desc: 'An asset id is forever — never reused or renamed; versioning lives in the manifest, never the path.' },
      ] },
      { icon: ICONS.open, title: 'Open-source engine', features: [
        { name: 'MPL-licensed core', desc: 'The engine, shells, schemas and docs are designed to be open-sourceable; brand content stays separate.' },
      ] },
    ],
  },
];

export async function mountCapabilities(viewEl) {
  document.title = 'Capabilities — Lolly';

  // Any section can be force-opened via its flag in the hash query
  // (e.g. #/capabilities?print) — read straight off the hash, no router change.
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const isOpen = (flag, defaultOpen) => params.has(flag) || defaultOpen;

  const toolCount = window.__toolIndex?.tools?.length ?? null;

  const stat = (n, label) => `<span class="plat-stat"><strong>${escape(String(n))}</strong>${escape(label)}</span>`;
  const chip = (label) => `<span class="plat-chip">${escape(label)}</span>`;

  const panel = (flag, defaultOpen, id, title, desc, body) => `
    <details class="plat-section"${isOpen(flag, defaultOpen) ? ' open' : ''}>
      <summary class="plat-section-summary"><h2 id="${id}" class="plat-section-title">${escape(title)}</h2></summary>
      <div class="plat-section-body">
        ${desc ? `<p class="plat-section-desc">${desc}</p>` : ''}
        <div class="plat-client-grid cap-grid">${body}</div>
      </div>
    </details>`;

  viewEl.innerHTML = `
    <a href="#/" class="tools-home home-full">Tools</a>
    <div class="platform-layout">
      <header class="plat-header">
        <h1 class="plat-title">Capabilities</h1>
        <p class="plat-sub">The full feature set — what Lolly can make, where it runs, and how it stays on-brand, deterministic and private. A straight inventory, not a pitch.</p>
        <div class="plat-stats">
          ${toolCount != null ? stat(toolCount, 'tools') : ''}
          ${stat(20, 'export formats')}
          ${stat(6, 'surfaces')}
          ${chip('Works offline')}
          ${chip('Open source')}
          ${chip('No SaaS fees')}
          ${chip('Zero telemetry')}
        </div>
      </header>

      ${SECTIONS.map((s) => panel(s.flag, s.open, s.id, s.title, s.desc, s.cards.map(card).join(''))).join('')}
    </div>
  `;
}
