#!/usr/bin/env node
// Minimal static site generator for Lolly.
// Run: node docs/build.js            build the /info pages once
//      node docs/build.js --watch    rebuild on every change under docs/ (used by dev:web)
// Output: shells/web/public/info/
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, watch } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOgImages } from './og-image.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'shells/web/public/info');

// Canonical site origin — used for absolute URLs in social/Open Graph tags.
// Social crawlers (Slack, X, Facebook, LinkedIn, iMessage) require absolute og:image URLs.
const SITE_URL = 'https://lolly.tools';
const REPO_URL = 'https://github.com/lolly-tools/lolly';
const OG_IMAGE = `${SITE_URL}/og.png`;
const OG_LOGO = `${SITE_URL}/info/icon-normal.png`;
const SITE_DESCRIPTION = 'Lolly: constraint-first, template-driven platform for generating on-brand creative assets at scale.';
// Landing-page <title>/share title — the brand tagline (matches the web shell's
// index.html). Other pages use "<page title> — Lolly", so this is landing-only.
const LANDING_TITLE = 'Lolly — assets that stay the same so everything else can change';

// Tool count for the hero badge — read from the generated catalog index so it
// tracks the real number of tools rather than drifting as a hand-edited literal.
const TOOL_COUNT = JSON.parse(
  readFileSync(resolve(repoRoot, 'catalog/tools/index.json'), 'utf8')
).tools.length;

const pages = [
  { slug: 'index',            title: 'Lolly',     src: 'site.md',            isLanding: true },
  { slug: 'about',            title: 'About',             src: '../README.md' },
  { slug: 'getting-started', title: 'Getting Started',   src: 'getting-started.md' },
  { slug: 'using',            title: 'Using Lolly', src: 'using.md' },
  { slug: 'profile',          title: 'Profiles',          src: 'profile.md' },
  { slug: 'extension',        title: 'Browser Extension', src: 'extension.md' },
  { slug: 'exporting',        title: 'Exporting & Formats', src: 'exporting.md' },
  { slug: 'positioning',      title: 'Positioning',       src: 'positioning.md' },
  { slug: 'ai-agents',        title: 'AI Agents',         src: 'ai-agents.md' },
  { slug: 'overview',         title: 'Overview',          src: 'overview.md' },
  { slug: 'authoring-tools',  title: 'Authoring Tools',   src: 'authoring-tools.md' },
  { slug: 'authoring-assets', title: 'Authoring Assets',  src: 'authoring-assets.md' },
  { slug: 'host-api',         title: 'Host API',          src: 'host-api.md' },
  { slug: 'url-mode',         title: 'URL Mode',          src: 'url-mode.md' },
  { slug: 'data-transfer',    title: 'Data Transfer',     src: 'data-transfer.md' },
  { slug: 'design-tokens',    title: 'Design Tokens',     src: 'design-tokens.md' },
  { slug: 'cli',              title: 'CLI',               src: 'cli.md' },
  { slug: 'build-guide',      title: 'Build Guide',       src: 'build-guide.md' },
  { slug: 'privacy',          title: 'Privacy Policy',    src: 'privacy.md' },
];

// Top-nav links, grouped into clusters. Each inner array renders as one cluster
// (tight spacing); clusters are separated by a divider (see .nav-group CSS). Home
// is intentionally omitted — the brand wordmark already links to /info/index.html.
const NAV = [
  [ { label: 'Overview',   href: '/info/overview.html' },
    { label: 'Compare',    href: '/info/positioning.html' } ],
  [ { label: 'Using',      href: '/info/using.html' },
    { label: 'Profiles',   href: '/info/profile.html' },
    { label: 'AI',         href: '/info/ai-agents.html' },
    { label: 'Export',     href: '/info/exporting.html' } ],
  [ { label: 'Authoring',  href: '/info/authoring-tools.html' },
    { label: 'Build',      href: '/info/build-guide.html' },
    { label: 'Extension',  href: '/info/extension.html' } ],
  [ { label: 'Host API',   href: '/info/host-api.html' },
    { label: 'CLI',        href: '/info/cli.html' } ],
];

const ICONS = {
  developers:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  marketers:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  journalists: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  media:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>`,
  ai:          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  security:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  platform:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  tool:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  sales:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
};

// Per-bullet benefit icons
const S2 = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
const BICONS = {
  repeat:       `<svg viewBox="0 0 24 24" ${S2}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  image:        `<svg viewBox="0 0 24 24" ${S2}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  cpu:          `<svg viewBox="0 0 24 24" ${S2}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
  unlock:       `<svg viewBox="0 0 24 24" ${S2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  layers:       `<svg viewBox="0 0 24 24" ${S2}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  zap:          `<svg viewBox="0 0 24 24" ${S2}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  alertTriangle:`<svg viewBox="0 0 24 24" ${S2}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  settings:     `<svg viewBox="0 0 24 24" ${S2}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  barChart:     `<svg viewBox="0 0 24 24" ${S2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  sliders:      `<svg viewBox="0 0 24 24" ${S2}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
  download:     `<svg viewBox="0 0 24 24" ${S2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  refreshCw:    `<svg viewBox="0 0 24 24" ${S2}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  tool:         `<svg viewBox="0 0 24 24" ${S2}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  lock:         `<svg viewBox="0 0 24 24" ${S2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  star:         `<svg viewBox="0 0 24 24" ${S2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  checkCircle:  `<svg viewBox="0 0 24 24" ${S2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  trendingDown: `<svg viewBox="0 0 24 24" ${S2}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
  database:     `<svg viewBox="0 0 24 24" ${S2}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  gitCommit:    `<svg viewBox="0 0 24 24" ${S2}><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>`,
  server:       `<svg viewBox="0 0 24 24" ${S2}><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  minusCircle:  `<svg viewBox="0 0 24 24" ${S2}><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  shield:       `<svg viewBox="0 0 24 24" ${S2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  alertCircle:  `<svg viewBox="0 0 24 24" ${S2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  arrowRight:   `<svg viewBox="0 0 24 24" ${S2}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  stopwatch:    `<svg viewBox="0 0 24 24" ${S2}><circle cx="12" cy="13" r="7"/><polyline points="12 10 12 13 14 13"/><line x1="9.5" y1="3" x2="14.5" y2="3"/><line x1="12" y1="3" x2="12" y2="6"/></svg>`,
  buildings:    `<svg viewBox="0 0 24 24" ${S2}><rect x="2" y="10" width="8" height="11"/><rect x="14" y="5" width="8" height="16"/><line x1="1" y1="21" x2="23" y2="21"/><line x1="5" y1="14" x2="5" y2="14"/><line x1="5" y1="17" x2="5" y2="17"/><line x1="17" y1="9" x2="17" y2="9"/><line x1="17" y1="13" x2="17" y2="13"/><line x1="17" y1="17" x2="17" y2="17"/></svg>`,
};

function getBulletIcon(raw) {
  const t = raw.toLowerCase();
  if (t.includes('compliance') || t.includes('risk'))                    return BICONS.alertTriangle;
  if (t.includes('governance') || t.includes('enforce'))                  return BICONS.shield;
  if (t.includes('self-host'))                                             return BICONS.server;
  if (t.includes('never leaves') || t.includes('air-gap'))               return BICONS.lock;
  if (t.includes('lock what'))                                            return BICONS.lock;
  if (t.includes('infrastructure') || t.includes('deploy'))               return BICONS.server;
  if (t.includes('vendor') || t.includes('lock-in'))                     return BICONS.minusCircle;
  if (t.includes('data') && t.includes('visual'))                         return BICONS.barChart;
  if (t.includes('data') && (t.includes('belongs') || t.includes('directly'))) return BICONS.database;
  if (t.includes('deterministic') || t.includes('version-controlled') || t.includes('auditable')) return BICONS.gitCommit;
  if (t.includes('reproducible') || t.includes('same inputs'))            return BICONS.repeat;
  if (t.includes('source of truth') || t.includes('permutation'))         return BICONS.layers;
  if (t.includes('execute logic') || t.includes('logic inside'))          return BICONS.cpu;
  if (t.includes('codebase') || t.includes('media out'))                  return BICONS.image;
  if (t.includes('bottleneck') || t.includes('tedious') || t.includes('instantly')) return BICONS.zap;
  if (t.includes('operationalize') || t.includes('production'))           return BICONS.settings;
  if (t.includes('style') || t.includes('publication'))                   return BICONS.sliders;
  if (t.includes('print') || t.includes('screen-ready') || t.includes('format')) return BICONS.download;
  if (t.includes('reusable') || t.includes('recurring'))                  return BICONS.refreshCw;
  if (t.includes('author tool') || t.includes('not files'))               return BICONS.tool;
  if (t.includes('frontier') || t.includes('ceiling'))                    return BICONS.star;
  if (t.includes("doesn't drift") || t.includes('quality'))               return BICONS.checkCircle;
  if (t.includes('token') || t.includes('fraction'))                      return BICONS.trendingDown;
  if (t.includes('critical information') || t.includes('incident'))       return BICONS.alertCircle;
  if (t.includes('zero lock'))                                             return BICONS.unlock;
  if (t.includes('wait on nothing') || t.includes('on the road'))         return BICONS.stopwatch;
  if (t.includes('army') || t.includes('global campaign'))                return BICONS.buildings;
  return BICONS.arrowRight;
}

// Per-feature platform icons
const PICONS = {
  star:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  devices: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  offline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>`,
  layers:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  film:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
  zap:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

function getPlatformIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('offline'))                           return PICONS.offline;
  if (t.includes('everywhere') || t.includes('works')) return PICONS.devices;
  if (t.includes('free') || t.includes('open'))        return PICONS.star;
  if (t.includes('format') || t.includes('huge'))      return PICONS.layers;
  if (t.includes('production') || t.includes('quality') || t.includes('studio')) return PICONS.film;
  return PICONS.zap;
}

function getIcon(h2) {
  const t = h2.toLowerCase();
  if (t.includes('develop')) return ICONS.developers;
  if (t.includes('market'))  return ICONS.marketers;
  if (t.includes('journal')) return ICONS.journalists;
  if (t.includes('media') || t.includes('creative')) return ICONS.media;
  if (t.includes('ai') || t.includes('agent'))       return ICONS.ai;
  if (t.includes('sales'))                           return ICONS.sales;
  if (t.includes('it') || t.includes('security'))    return ICONS.security;
  if (t.includes('platform')) return ICONS.platform;
  return ICONS.tool;
}

function tabLabel(h2) {
  const t = h2.toLowerCase();
  if (t.startsWith('ai'))                              return 'AI';
  if (t.startsWith('it') || t.includes('security'))   return 'IT & Sec';
  if (t.includes('media') || t.includes('creativ'))   return 'Creatives';
  if (t.includes('journal'))                          return 'Press';
  return h2.split(/[\s,&]+/)[0];
}

function toSlug(h2) {
  const t = h2.toLowerCase();
  if (t.includes('journal'))                          return 'press';
  if (t.includes('media') || t.includes('creativ'))  return 'creatives';
  if (t.startsWith('ai') || t.includes('agent'))     return 'ai';
  if (t.startsWith('it') || t.includes('security'))  return 'it';
  return t.split(/\W+/)[0];
}

// ── Markdown helpers ──────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function parseCells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|'))   s = s.slice(0, -1);
  return s.split('|').map(c => c.trim());
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    const hm = line.match(/^(#{1,4}) (.+)/);
    if (hm) {
      const lvl = hm[1].length, text = hm[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`);
      i++; continue;
    }

    if (line.startsWith('> ')) {
      const ql = [];
      while (i < lines.length && lines[i].startsWith('> ')) { ql.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote>${ql.map(l => `<p>${inline(l)}</p>`).join('')}</blockquote>`);
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

    if (line.includes('|') && i + 1 < lines.length && /^\|?[-|: ]+\|/.test(lines[i + 1])) {
      const headers = parseCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(parseCells(lines[i])); i++; }
      out.push('<div class="table-wrap"><table>');
      out.push('<thead><tr>' + headers.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>');
      out.push('<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>');
      out.push('</table></div>');
      continue;
    }

    if (/^\s*[-*] /.test(line)) {
      out.push('<ul>');
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\s*[-*] /, ''))}</li>`); i++;
      }
      out.push('</ul>'); continue;
    }

    if (/^\d+\. /.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        out.push(`<li>${inline(lines[i].replace(/^\d+\. /, ''))}</li>`); i++;
      }
      out.push('</ol>'); continue;
    }

    if (line.trim() === '') { i++; continue; }

    const para = [];
    while (
      i < lines.length && lines[i].trim() !== '' &&
      !lines[i].startsWith('#') && !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') && !/^\s*[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) && !/^-{3,}$/.test(lines[i].trim()) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\|?[-|: ]+\|/.test(lines[i + 1]))
    ) { para.push(lines[i]); i++; }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i++;
  }

  return out.join('\n');
}

// ── FAQ source ────────────────────────────────────────────────────────────────
// FAQs are authored in docs/faq.md so they can be maintained without touching this
// build script. Each `##` heading is a question; the lines beneath it (up to the
// next `##`) are the answer, in the same lightweight markdown the rest of the site
// uses. Everything before the first `##` (title + maintainer notes) is ignored.
function loadFaqs() {
  const md = readFileSync(resolve(__dirname, 'faq.md'), 'utf8');
  const faqs = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      if (cur) faqs.push({ q: cur.q, a: cur.a.join('\n').trim() });
      cur = { q: m[1].trim(), a: [] };
    } else if (cur) {
      cur.a.push(line);
    }
  }
  if (cur) faqs.push({ q: cur.q, a: cur.a.join('\n').trim() });
  return faqs;
}

// ── Landing page special renderer ─────────────────────────────────────────────

function buildLandingContent(md) {
  const rawSections = md.split(/\n---\n/);
  const heroSection      = rawSections[0];
  const audienceSections = rawSections.slice(1, -1);
  const tailSection      = rawSections[rawSections.length - 1];

  const heroSubtitle = heroSection.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => esc(l.trim())).join('<br>').trim();

  function parseAudienceCard(section) {
    const lines = section.split('\n');
    const h2 = lines.find(l => l.startsWith('## '))?.slice(3).trim() ?? '';
    const h3 = lines.find(l => l.startsWith('### '))?.slice(4).trim() ?? '';
    const bullets = lines.filter(l => /^- /.test(l)).map(l => l.slice(2).trim());
    // Extract first prose paragraph after the h3
    let intro = '';
    const h3Idx = lines.findIndex(l => l.startsWith('### '));
    if (h3Idx >= 0) {
      for (let j = h3Idx + 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (!l) continue;
        if (l.startsWith('#') || l.startsWith('-') || l.startsWith('`')) break;
        intro = l; break;
      }
    }
    let inCode = false, codeLang = '', codeLines = [];
    const codeBlocks = [];
    for (const l of lines) {
      if (l.startsWith('```') && !inCode)  { inCode = true; codeLang = l.slice(3); codeLines = []; }
      else if (l.startsWith('```') && inCode) { inCode = false; codeBlocks.push({ lang: codeLang, code: codeLines.join('\n') }); }
      else if (inCode) codeLines.push(l);
    }
    return { h2, h3, intro, bullets, codeBlocks };
  }

  const cardData = audienceSections.map(s => parseAudienceCard(s));

  // Tab strip with header
  const tabsHtml = `<div class="audience-header reveal">
  <img src="/info/mascots/quoll.png" alt="" class="audience-mascot" aria-hidden="true">
  <div class="audience-header-text">
    <h2 class="audience-title">Who needs Lolly?</h2>
    <p class="audience-sub">Select your role to see what Lolly does for you.</p>
  </div>
</div>
<div class="audience-tabs" role="tablist" aria-label="Who is it for?">
${cardData.map(({ h2 }, i) => `  <button class="audience-tab" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" data-panel="${i}" data-slug="${toSlug(h2)}">
    <span class="tab-icon">${getIcon(h2)}</span>
    <span class="tab-label">${esc(tabLabel(h2))}</span>
  </button>`).join('\n')}
</div>`;

  // Cards as full-width panels (two-column on desktop)
  const cardsHtml = cardData.map(({ h2, h3, intro, bullets, codeBlocks }, i) => `<div class="audience-card${i === 0 ? ' tab-active' : ''}" id="${toSlug(h2)}" data-panel="${i}">
  <div class="card-main">
    <div class="card-icon">${getIcon(h2)}</div>
    <div class="card-audience">${esc(h2)}</div>
    <div class="card-tagline">${inline(h3)}</div>
    ${intro ? `<p class="card-intro">${inline(intro)}</p>` : ''}
    ${codeBlocks[0] ? `<pre><code class="language-${esc(codeBlocks[0].lang)}">${esc(codeBlocks[0].code)}</code></pre>` : ''}
  </div>
  <ul class="card-benefits">${bullets.map(b => `<li><span class="bullet-icon">${getBulletIcon(b)}</span><span>${inline(b)}</span></li>`).join('')}</ul>
</div>`).join('\n');

  // Parse platform features and "What's a tool?" from tail
  const tailLines  = tailSection.split('\n');
  const platformIdx = tailLines.findIndex(l => l.startsWith('## The Creator'));
  const whatsIdx    = tailLines.findIndex(l => l.startsWith('## The Tools'));

  const platformFeatures = tailLines
    .slice(platformIdx + 1, whatsIdx >= 0 ? whatsIdx : undefined)
    .filter(l => l.startsWith('**'))
    .map(l => {
      const m = l.match(/^\*\*([^*]+)\*\*\.?\s*(.*)/);
      return m ? { title: m[1], desc: m[2] } : null;
    }).filter(Boolean);

  const whatsLines = whatsIdx >= 0
    ? tailLines.slice(whatsIdx + 1).filter(l => l.trim() && !l.startsWith('#'))
    : [];

  // Platform feature renderer — formats row gets chip badges
  function renderPlatformFeature(f, idx = 0) {
    const isFormats = f.title.toLowerCase().includes('format') || f.title.toLowerCase().includes('huge');
    const body = isFormats
      ? `<div class="format-chips">${f.desc.split(/\s·\s|·/).map(fmt => `<span class="format-chip">${esc(fmt.trim())}</span>`).join('')}</div>`
      : `<p>${inline(f.desc)}</p>`;
    return `<div class="platform-feature reveal reveal-${(idx % 6) + 1}">
  <div class="platform-feature-icon">${getPlatformIcon(f.title)}</div>
  <strong>${esc(f.title)}</strong>
  ${body}
</div>`;
  }

  const ANATOMY_HTML = `<div class="tool-anatomy reveal reveal-1">
  <div class="tool-part">
    <div class="tool-part-file">tool.json</div>
    <div class="tool-part-name">Manifest</div>
    <div class="tool-part-desc">Name, inputs &amp; metadata</div>
  </div>
  <div class="tool-plus">+</div>
  <div class="tool-part">
    <div class="tool-part-file">template.html</div>
    <div class="tool-part-name">Template</div>
    <div class="tool-part-desc">HTML/CSS/JS that renders the output</div>
  </div>
  <div class="tool-plus">+</div>
  <div class="tool-part">
    <div class="tool-part-file">hooks.js</div>
    <div class="tool-part-name">Hooks</div>
    <div class="tool-part-desc">Optional logic, sandboxed</div>
  </div>
</div>`;

  const TAB_JS = `<script>
(function(){
  var tabs=document.querySelectorAll('.audience-tab');
  var panels=document.querySelectorAll('.audience-card');
  function activate(idx){
    tabs.forEach(function(t,i){t.setAttribute('aria-selected',i===idx?'true':'false');});
    panels.forEach(function(p,i){p.classList.toggle('tab-active',i===idx);});
  }
  function activateBySlug(slug){
    var found=false;
    tabs.forEach(function(t,i){if(t.dataset.slug===slug){activate(i);found=true;}});
    return found;
  }
  // Activate from hash on load
  var hash=location.hash.slice(1);
  if(hash) activateBySlug(hash);
  else activateBySlug('ai');
  // Click: activate and push slug to hash
  tabs.forEach(function(tab,idx){
    tab.addEventListener('click',function(){
      activate(idx);
      history.replaceState(null,'','#'+tab.dataset.slug);
    });
  });
  // Browser back/forward
  window.addEventListener('hashchange',function(){
    activateBySlug(location.hash.slice(1));
  });
  // Nav: transparent over hero, solid after
  (function(){
    var nav=document.querySelector('nav');
    var hero=document.querySelector('.hero');
    function updateNav(){
      var heroBottom=hero?hero.getBoundingClientRect().bottom:0;
      nav.classList.toggle('nav-solid',heroBottom<=0);
    }
    window.addEventListener('scroll',updateNav,{passive:true});
    updateNav();
  })();
})();
</script>`;

  const S = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const SURFACES = [
    { label: 'Web', icon: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>` },
    { label: 'macOS',   icon: `<svg viewBox="0 0 24 24" ${S}><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>` },
    { label: 'Linux',   icon: `<svg viewBox="0 0 24 24" ${S}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>` },
    { label: 'iOS',     icon: `<svg viewBox="0 0 24 24" ${S}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>` },
    { label: 'Android', icon: `<svg viewBox="0 0 24 24" ${S}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><polyline points="9 2 9 7 15 7 15 2"/></svg>` },
    { label: 'CLI',     icon: `<svg viewBox="0 0 24 24" ${S}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>` },
  ];

  // The three distribution models from the getting-started guide, distilled to a
  // visual 1/2/3 summary beneath the surface chips.
  const MODELS = [
    {
      n: '1', label: 'Deploy',
      icon: `<svg class="everywhere-model-icon" viewBox="0 0 24 24" ${S}><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
      desc: 'Ship to devices through your existing MDM. Runs fully offline, behind any firewall or air-gap — nothing leaves the device.',
    },
    {
      n: '2', label: 'Serve',
      icon: `<svg class="everywhere-model-icon" viewBox="0 0 24 24" ${S}><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
      desc: 'One hosted instance, used in any browser. Nothing to install — approved updates reach everyone the instant they ship.',
    },
    {
      n: '3', label: 'Hybrid',
      icon: `<svg class="everywhere-model-icon" viewBox="0 0 24 24" ${S}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
      desc: 'Offline local apps plus an always-current web version, sharing one tool library — across every OS at once.',
    },
  ];

  // Frequently asked questions — rendered as native <details> accordions (no JS,
  // keyboard-accessible, works offline). Answers are markdown; blank lines split
  // paragraphs. Add or edit an item in docs/faq.md (see loadFaqs above).
  const FAQ_CHEVRON = `<svg viewBox="0 0 24 24" ${S}><polyline points="6 9 12 15 18 9"/></svg>`;
  const FAQS = loadFaqs();

  const faqHtml = `<section class="faq-section" id="faq">
  <div class="faq-inner reveal">
    <h2>Questions &amp; answers</h2>
    <p class="faq-lead">The things people ask most.</p>
    <div class="faq-list">
      ${FAQS.map(f => `<details class="faq-item">
        <summary class="faq-q"><span>${inline(f.q)}</span><span class="faq-chevron">${FAQ_CHEVRON}</span></summary>
        <div class="faq-a">${mdToHtml(f.a)}</div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>`;

  return `
<section class="hero">
  <canvas id="heroCanvas" aria-hidden="true"></canvas>
  <div class="hero-inner">
  <div class="hero-heading">
    <h1 class="hero-logo-h1"><a href="/" class="hero-logo-link" aria-label="Open Lolly — browse all tools"><img src="/info/icon-normal.webp" alt="Lolly" class="hero-logo"></a></h1>
  </div>
  <div class="hero-details">
    <p class="subtitle">${heroSubtitle}</p>
    <div class="hero-cta">
      <a href="/" class="btn btn-primary">Launch App ↗</a>
      <a href="/info/about.html" class="btn btn-secondary">Learn More</a>
    </div>
    <div class="hero-trust">
      <span>100% Free</span>
      <span class="trust-dot">·</span>
      <span>No Cookies</span>
      <span class="trust-dot">·</span>
      <span>No Sign-up</span>
      <span class="trust-dot">·</span>
      <span>Works offline</span>
      <span class="trust-dot">·</span>
      <span>Open Source</span>
      <span class="trust-dot">·</span>
      <span>Privacy First</span>
      <span class="trust-dot">·</span>
      <span>${TOOL_COUNT} Example Tools Loaded</span>
    </div>
  </div>
  </div>

</section>
<section class="audience-section">
  ${tabsHtml}
  <div class="audience-panels">
    ${cardsHtml}
  </div>
</section>
<div class="platform-whats-wrap">
<div class="whats-label">What is this?</div>
<section class="platform-section">
  <div class="platform-inner">
    <div class="platform-header reveal">
      <h2>Lolly</h2>
      <p class="platform-tagline">Rendering engine. production-quality. Zero lock-in.</p>
    </div>
    <div class="platform-features">
      ${platformFeatures.map((f, i) => renderPlatformFeature(f, i)).join('\n      ')}
    </div>
  </div>
</section>
${whatsLines.length ? `<section class="whats-a-tool">
  <div class="whats-inner">
  <h2 class="reveal">Tools</h2>
  <p class="tool-lead reveal reveal-1">A self-contained template.<br>  Layout rules and style, waiting for data</p>
  ${ANATOMY_HTML}
  <div class="tool-features">
    <div class="tool-feature reveal reveal-2">
      <div class="tool-feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <strong>A smart template</strong>
      <p>Knows its own layout, type, colors, and brand rules. You bring the content — it handles everything else.</p>
    </div>
    <div class="tool-feature reveal reveal-3">
      <div class="tool-feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg></div>
      <strong>No design experience needed</strong>
      <p>Authored once by someone who knows the brand. Everyone else just fills in the blanks.</p>
    </div>
    <div class="tool-feature reveal reveal-4">
      <div class="tool-feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
      <strong>Design as code</strong>
      <p>Plain HTML, CSS, and JS. Version-controlled, diff-able, and reviewable like any other source file.</p>
    </div>
    <div class="tool-feature reveal reveal-5">
      <div class="tool-feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
      <strong>No app needed</strong>
      <p>Open <code>template.html</code> in any browser — it just works. The tool is the app.</p>
    </div>
  </div>
  <div class="try-now-callout">
    <div class="try-now-text">
      <strong>Tools work fine on their own.</strong>
      <p>To render to PNG, PDF, SVG, video, and more — use the Lolly platform.</p>
    </div>
    <a href="/" class="btn btn-primary">Launch App ↗</a>
  </div>
  </div>
</section>` : ''}
</div>
<section class="everywhere-section">
  <div class="everywhere-inner reveal">
    <div class="everywhere-copy-col">
      <h2>All of it,<br>as you are,<br>on anything</h2>
      <p class="everywhere-copy">Run offline on your device, be always available hosted online, you decide.<br>Lolly Tools can work there.</p>
      <div class="everywhere-chips">
        ${SURFACES.map(s => `<span class="everywhere-chip">${s.icon}<span>${esc(s.label)}</span></span>`).join('')}
      </div>
    </div>
    <img src="/info/mascots/quokka.png" class="quokka" alt="" class="everywhere-mascot">
  </div>
  <div class="everywhere-models reveal">
    <p class="everywhere-models-intro">Three modes of delivery:</p>
    <div class="everywhere-models-grid">
      ${MODELS.map(m => `
      <div class="everywhere-model">
        <div class="everywhere-model-main">
          <span class="everywhere-model-num">Option ${m.n}</span>
          ${m.icon}
          <h3>${esc(m.label)}</h3>
        </div>
        <p>${esc(m.desc)}</p>
      </div>`).join('')}
    </div>
  </div>
</section>
<section class="social-proof">
  <div class="social-proof-inner reveal">
    <h2>Building &amp; brand new</h2>
    <p class="social-proof-date">June 2026</p>
    <p class="social-proof-desc">Made in the open, used in confidence.</p> <p>By design, we have no idea who or what runs Lolly — and that's exactly the point.</p>
    <p class="social-proof-desc">Organisations that benefit most, are privacy aware ones!</p>
  </div>
  <a class="social-proof-founded" href="https://www.suse.com" target="_blank" rel="noopener" aria-label="Founded by SUSE">
    <img src="/info/founded-by.svg" alt="Founded by SUSE">
  </a>
  <p class="social-proof-credit">Developed in-house at <a href="https://www.suse.com" target="_blank" rel="noopener"> SUSE</a></p>
</section>
<section class="about-section">
  <div class="about-inner reveal">
    <div class="about-header">
      <img src="/info/mascots/koala.png" alt="" class="about-mascot" aria-hidden="true">
      <div class="about-header-text">
        <h2>Made for us</h2>
        <p class="about-lead">We are a coalition of passionate designers, developers, marketers, and IT operations experts. Manual work, expensive ugly software, and anything that slows us down day to day is the only adversary.</p>
      </div>
    </div>

    <h3>What's with the Quoll, Quokka, and Koala?</h3>
    <div class="about-items">
      <div class="about-item">
        <div class="about-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r="1" fill="currentColor" stroke="none"/><ellipse cx="12" cy="15.5" rx="2" ry="1.5"/></svg></div>
        <p><strong>They're adorable</strong> Australian animals who cause no harm to their environment. In a world of predators looking for your data, money, or time — give them none and thrive.</p>
      </div>
      <div class="about-item">
        <div class="about-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg></div>
        <p><strong>Quoll-tea. Koala-ty. Quo'lity.</strong> We are obsessed with quality. Studio-quality media. When evaluating tools and platform improvements we ask:  Is it good enough to make everything?</p>
      </div>
    </div>

  </div>
</section>
<section class="opensource-section">
  <div class="opensource-inner reveal">
    <h2>Why open source?</h2>
    <p>The more the platform is used, the more we improve the core engine — and the more time, money, and frustration we collectively save. Open source means anyone can build, audit, improve, and deploy Lolly. That's a better deal for everyone.</p>
  </div>
</section>
${faqHtml}
${TAB_JS}`;
}

// ── HTML template ─────────────────────────────────────────────────────────────

const CSS = `
:root{--green:#30ba78;--dark:#0c322c;--orange:#fe7c3f;--navy:#192072;--blue:#2453ff;--light:#90ebcd;--pale:#f0fbf5;--text:#1d2726;--muted:#5a7067;--border:#d8ede4;--col-cap:38rem}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'SUSE',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--text);background:#fff;line-height:1.65}
a{color:var(--blue);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:'SUSE Mono','SF Mono','Fira Code',monospace;font-size:.875em;background:#eef5f0;padding:.15em .35em;border-radius:3px}
pre{background:#f6f6f6;color:#0d1f17;padding:1.25rem 1.5rem;border-radius:8px;overflow-x:auto;font-size:.875rem;line-height:1.5;margin-bottom:1.25rem}
pre code{background:none;padding:0;color:inherit;font-size:1em}
h1,h2,h3,h4{line-height:1.25;font-weight:700}
h2{font-size:2rem;letter-spacing:0;font-weight:900;text-transform:uppercase}
p{margin-bottom:1rem}
ul{padding-left:1.25rem;margin-bottom:1rem}
li{margin-bottom:.35rem}
blockquote{border-left:4px solid var(--green);padding:.75rem 1.25rem;background:var(--pale);border-radius:0 6px 6px 0;margin-bottom:1rem}
blockquote p{margin:0}
hr{border:none;border-top:1px solid var(--border);margin:2rem 0}
strong{font-weight:600}

/* Nav */
nav{display:flex;align-items:center;gap:.25rem;padding:0 1.5rem;height:3.75rem;background:transparent;position:fixed;width:100%;top:0;z-index:100;overflow-x:auto;transition:background .25s}
nav.nav-solid{background:#0c322c}
.brand{display:inline-flex;align-items:center;gap:.5rem;font-weight:800;color:var(--pale);font-size:1.05rem;white-space:nowrap;margin-right:.75rem;letter-spacing:-.01em;text-transform:uppercase}
.brand:hover{color:var(--light);text-decoration:none}
.brand-icon{width:1.5rem;height:1.5rem;border-radius:5px;flex-shrink:0;object-fit:contain}
nav .gap{flex:1}
nav a:not(.brand):not(.nav-launch){color:rgba(255,255,255,.55);font-size:.8125rem;padding:.25rem .5rem;white-space:nowrap;border-radius:2em;transition:color .12s}
nav a:not(.brand):not(.nav-launch):hover{color:#fff;text-decoration:none}
nav a.active:not(.nav-launch){color:#fff}
/* Top-nav clusters: tight within a group, a thin divider between groups. */
nav .nav-group{display:inline-flex;align-items:center;gap:.0625rem}
nav .nav-group + .nav-group{margin-left:.5rem;padding-left:.625rem;border-left:1px solid rgba(255,255,255,.18)}
.nav-launch{background:var(--green);color:var(--dark)!important;padding:.375rem 1rem;border-radius:6px;font-weight:700;font-size:.875rem;white-space:nowrap;margin-left:.5rem;transition:background .15s}
.nav-launch:hover{background:var(--light);text-decoration:none!important}

/* Hero */
.hero{background:#1c4a2e;color:#fff;padding:7rem 1.5rem 6rem;text-align:center;position:relative;overflow:hidden;min-height:50vh;user-select:none;-webkit-user-select:none}
/* Double-clicking the hero backdrop shouldn't highlight the heading/subtitle/trust copy; buttons keep normal selection. */
.hero .btn{user-select:auto;-webkit-user-select:auto}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 90% 55% at 50% -5%,rgba(48,186,120,.13) 0%,transparent 65%);pointer-events:none}
#heroCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:color-dodge;opacity:.6}
.hero h1{font-size:clamp(2.75rem,6vw,5rem);letter-spacing:-.04em;line-height:1.05;margin-bottom:1.5rem;color:#fff;position:relative;padding-left:.3em;font-weight:200}
.hero-logo-h1{margin:0 0 1.5rem;padding:0;line-height:0;position:relative}
.hero-logo-link{display:block;width:clamp(180px,32vw,340px);margin:0 auto;border-radius:50%;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;box-shadow:0 0.5em 1em #0004,0 .1em .2em #0003}
.hero-logo-link:hover,.hero-logo-link:focus-visible{transform:translateY(-3px) scale(1.02);box-shadow:0 0.9em 1.6em #0006,0 .15em .3em #0004;outline:none}
.hero-logo-link:active{transform:translateY(-1px) scale(1.0)}
.hero-logo{display:block;width:100%;height:auto;position:relative;border-radius:50%}
.hero .subtitle{font-size:clamp(.9375rem,1.8vw,1.125rem);max-width:560px;margin:0 auto 2.75rem;color:rgba(255,255,255,.8);line-height:1.85;position:relative}
.hero-cta{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;position:relative;margin-bottom:2.5rem}
.hero-trust{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.5rem;position:relative}
.hero-trust span{font-size:.8rem;line-height:1;color:rgba(255,255,255,.5);letter-spacing:.02em}
.trust-dot{color:rgba(255,255,255,.18)!important}
.btn{display:inline-flex;align-items:center;padding:2rem 3rem;border-radius:1rem;font-weight:700;font-size:1rem;transition:all .18s ease;box-shadow:0 .2em 1em #0002}
.btn-primary{background:rgba(48,186,120,.72);color:#000;mix-blend-mode:plus-lighter}
.btn-primary:hover{background:var(--light);text-decoration:none;transform:translateY(-2px);box-shadow:0 8px 28px rgba(48,186,120,.35)}
.btn-secondary{background:rgba(255,255,255,.05);color:#fff;border:1px solid rgba(255,255,255,.22);position:relative}
.btn-secondary:hover{background:rgba(255,255,255,.1);text-decoration:none;transform:translateY(-1px)}
/* Glass baseline — frosted blur so the buttons read as glass even where the JS
   liquid-displacement filter can't render. The buildGlass script overrides this
   inline with the refractive filter where it's supported. */
.btn-primary,.btn-secondary{-webkit-backdrop-filter:blur(3px) saturate(1.45);backdrop-filter:blur(3px) saturate(1.45)}

/* Audience section */
.audience-section{}
.audience-header{background:linear-gradient(180deg,var(--pale) 0%,#fff 100%)}
.audience-title{font-size:2.5rem;color:var(--dark);margin:0}
.audience-sub{color:var(--muted);font-size:.9375rem;margin-top:.5rem;margin-bottom:0}
.audience-tabs{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:.625rem;padding:1rem 1.5rem 1.5rem;background:#fff;border-bottom:2px solid var(--border);max-width:1400px;margin:0 auto}
.audience-tabs::-webkit-scrollbar{display:none}
.audience-tab{display:inline-flex;flex:1;flex-direction:column;align-items:center;gap:.4rem;padding:1.75rem 1.125rem;border:2px solid var(--border);background:#fff;cursor:pointer;border-radius:12px;min-width:5.5rem;color:var(--muted);transition:all .15s;font-family:'SUSE',inherit}
.audience-tab .tab-icon{width:1.5rem;height:1.5rem}
.audience-tab .tab-icon svg{width:100%;height:100%}
.audience-tab .tab-label{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;white-space:nowrap}
.audience-tab[aria-selected=true]{background:var(--dark);color:var(--green);border-color:var(--dark);box-shadow:0 3px 12px rgba(12,50,44,.2)}
.audience-tab:hover:not([aria-selected=true]){border-color:var(--green);color:var(--dark);background:var(--pale)}

/* Audience panels — full-width, two-column on desktop */
.audience-panels{display:block;margin-bottom:2em}
.audience-card{display:none}
.audience-card.tab-active{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);
  gap:2.5rem 5rem;
  align-items:start;
  padding:3.75rem 3.5rem;
  max-width:1400px;
  margin:0 auto;
}
.card-main{min-width:0;overflow:hidden}
.card-icon{width:2.5rem;height:2.5rem;color:var(--green);margin-bottom:1.25rem}
.card-icon svg{width:100%;height:100%}
.card-audience{font-size:.6875rem;text-transform:uppercase;letter-spacing:.14em;color:var(--green);font-weight:700;margin-bottom:.375rem}
.card-tagline{font-size:1.5rem;font-weight:800;color:var(--dark);margin-bottom:.75rem;line-height:1.2;letter-spacing:-.02em}
.card-intro{font-size:.9375rem;color:var(--muted);line-height:1.75;margin-bottom:1.5rem}
.card-main pre{font-size:.8rem;margin-top:0;margin-bottom:0;width:0;min-width:100%;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;box-sizing:border-box}
.card-main pre::-webkit-scrollbar{display:none}
.card-benefits{display:grid;grid-template-columns:1fr 1fr;gap:4em;padding-left:0;list-style:none;margin:0;padding-top:.25rem}
.card-benefits li{display:flex;align-items:flex-start;gap:.75rem;font-size:.9375rem;line-height:1.6;color:var(--text)}
.card-benefits li:last-child{margin-bottom:0}
.bullet-icon{width:3em;height:3em;display:block;margin:1em 0;color:var(--green);flex-shrink:0}
.bullet-icon svg{width:100%;height:100%}
.card-benefits strong{font-weight:700;color:var(--dark)}

/* Platform + What's a tool — side by side on desktop */
.platform-whats-wrap{position:relative;display:flex;align-items:stretch}
.platform-whats-wrap .platform-section,.platform-whats-wrap .whats-a-tool{flex:1;min-width:0}
.whats-label{position:absolute;top:0;left:50%;transform:translate(-50%,-50%);z-index:10;border-radius:3rem;padding:.85rem 2rem;font-weight:700;font-size:1.0625rem;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.18);     background: var(--muted);    color: var(--pale);}

/* Platform */
.platform-section{background:linear-gradient(20deg,#0c322c 0%,#008657 100%);color:#fff;padding:4.5rem 3.5rem}
.platform-inner{max-width:var(--col-cap);margin-left:auto;margin-right:0}
.platform-header{text-align:center;margin-bottom:2.75rem}
.platform-section h2{margin-bottom:.5rem}
.platform-tagline{color:rgba(255,255,255,.8);font-size:1.0625rem;margin:0;letter-spacing:.01em}
.platform-features{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:1.75rem}
.platform-feature{background:rgba(255,255,255,.025);padding:1.625rem 1.5rem;display:flex;flex-direction:column;gap:.5rem;transition:background .15s}
.platform-feature:hover{background:#00000033}
.platform-feature-icon{width:1.75rem;height:1.75rem;color:var(--green);margin-bottom:.375rem}
.platform-feature-icon svg{width:100%;height:100%}
.platform-feature strong{font-size:.9375rem;font-weight:700;line-height:1.3}
.platform-feature p{color:rgba(255,255,255,.45);font-size:.85rem;margin:0;line-height:1.6}
.format-chips{display:flex;flex-wrap:wrap;gap:.375rem;margin-top:.125rem}
.format-chip{background:rgba(48,186,120,.12);color:var(--green);font-size:.72rem;font-family:'SUSE Mono','SF Mono',monospace;font-weight:600;padding:.2em .55em;border-radius:1em;letter-spacing:.04em;border:0}

/* Everywhere section */
.everywhere-section{padding:5rem 2rem;background:var(--dark);color:#fff}
.everywhere-inner{display:flex;align-items:center;gap:4rem;max-width:1400px;margin:0 auto}
.everywhere-copy-col{flex:1;text-align:left}
.everywhere-mascot{width:20vw;max-width:420px;flex-shrink:0}
.everywhere-section h2{color:#fff;margin-bottom:1rem}
.everywhere-copy{font-size:1.125rem;line-height:1.75;color:rgba(255,255,255,.65);margin-bottom:3rem}
.everywhere-chips{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:1rem}
@media(max-width:768px){.everywhere-inner{flex-direction:column}.everywhere-mascot{width:60vw;max-width:280px}.everywhere-copy-col{text-align:center}.everywhere-chips{justify-content:center}}
.everywhere-chip{display:inline-flex;flex-direction:column;align-items:center;gap:.625rem;padding:1.25rem 1.75rem;background:rgba(255,255,255,.05);border-radius:14px;color:#fff;font-size:.95rem;font-weight:700;min-width:7rem;transition:background .2s}
.everywhere-chip:hover{background:rgba(255,255,255,.09)}
.everywhere-chip svg{width:2rem;height:2rem;color:var(--green);flex-shrink:0}
.everywhere-chip span{letter-spacing:.02em}
.everywhere-models{max-width:1400px;margin:4rem auto 0}
.everywhere-models-intro{text-align:center;color:#fff;font-size:1rem;margin:0 0 2rem}
.everywhere-models-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
.everywhere-model{position:relative;display:flex;align-items:stretch;gap:1.5rem;padding:3.5rem 1.75rem 2rem;background:rgba(255,255,255,.05);border-radius:18px;transition:background .2s,border-color .2s}
.everywhere-model:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.16)}
.everywhere-model-main{flex:0 0 2em;min-width:0}
.everywhere-model-num{position:absolute;top:-1rem;left:50%;transform:translateX(-50%);width:fit-content;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--dark);background:rgba(48,186,120,1.14);padding:.32rem .7rem;border-radius:999px;margin:0}
.everywhere-model-icon{width:2.25rem;height:2.25rem;color:var(--green);display:block;margin-bottom:.9rem}
.everywhere-model h3{color:var(--green);font-size:1.2rem;margin:0}
.everywhere-model p{flex:1;min-width:0;font-size:.95rem;line-height:1.65;color:rgba(255,255,255,.6);margin:0;padding-left:1.5rem}
@media(max-width:768px){.everywhere-models-grid{grid-template-columns:1fr;gap:2rem}.everywhere-models{margin-top:2.5rem}}

/* What's a tool */
.whats-a-tool{padding:4.5rem 3.5rem;background:var(--border)}
.whats-inner{max-width:var(--col-cap);margin-right:auto;margin-left:0}
.whats-a-tool .whats-inner>h2{color:var(--dark);font-size:2rem;margin-bottom:.625rem;text-align:center}
.tool-lead{max-width:100%;margin:0 0 2rem;font-size:1.0625rem;line-height:1.8;color:var(--muted);text-align:center}
.tool-anatomy{display:flex;flex-wrap:wrap;gap:.75rem;max-width:100%;margin:0 0 2rem;justify-content:center;align-items:center}
.tool-part{background:#fff;border:1px solid var(--border);border-radius:12px;padding:1rem 1.25rem;text-align:center;flex:1;min-width:110px;box-shadow:0 2px 8px rgba(12,50,44,.07);transition:box-shadow .15s}
.tool-part:hover{box-shadow:0 4px 16px rgba(12,50,44,.12)}
.tool-part-file{font-family:'SUSE Mono','SF Mono',monospace;font-size:.75rem;background:#eef5f0;color:var(--dark);padding:.2em .55em;border-radius:4px;display:inline-block;margin-bottom:.5rem;font-weight:600}
.tool-part-name{font-weight:700;color:var(--dark);font-size:.8125rem;margin-bottom:.2rem}
.tool-part-desc{font-size:.73rem;color:var(--muted);line-height:1.45}
.tool-plus{font-size:1.5rem;color:var(--border);font-weight:300;flex-shrink:0;align-self:center}
.tool-features{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1.75rem}
.tool-feature{background-color:#fff6;border:1px solid var(--border);border-radius:12px;padding:1.25rem 1.375rem;display:flex;flex-direction:column;gap:.35rem;transition:box-shadow .15s}
.tool-feature:hover{box-shadow:0 4px 16px rgba(12,50,44,.1)}
.tool-feature-icon{width:1.375rem;height:1.375rem;color:var(--green);margin-bottom:.25rem;flex-shrink:0}
.tool-feature-icon svg{width:100%;height:100%}
.tool-feature strong{font-size:.9rem;color:var(--dark);font-weight:700;line-height:1.25}
.tool-feature p{font-size:.8rem;color:var(--muted);line-height:1.55;margin:0}
/* Floats at the bottom seam where the two columns meet (relative to .platform-whats-wrap). */
.try-now-callout{position:absolute;left:50%;bottom:0;transform:translate(-50%,50%);z-index:10;width:min(92%,640px);background:#01564a;border-radius:14px;padding:1.5rem 1.75rem;display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;box-shadow: 0 10px 30px rgba(0,0,0,.2), inset 0 .06rem .1rem #fff2}
.try-now-text{flex:1;min-width:0}
.try-now-text strong{color:var(--green);font-size:.9375rem;display:block;margin-bottom:.35rem;font-weight:700}
.try-now-text p{color:#fff;font-size:.85rem;line-height:1.6;margin:0}

/* Docs layout */
.docs-wrap{display:grid;grid-template-columns:220px 1fr;max-width:1180px;margin:0 auto;min-height:calc(100vh - 3.5rem - 60px)}
.docs-sidebar{padding:2rem 1.25rem;border-right:1px solid var(--border);position:sticky;top:3.75rem;height:calc(100vh - 3.75rem);overflow-y:auto}
.sidebar-label{font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin:1.5rem 0 .5rem}
.sidebar-label:first-child{margin-top:0}
.docs-sidebar a{display:block;padding:.3rem .5rem;font-size:.875rem;color:var(--text);border-radius:5px}
.docs-sidebar a:hover{color:var(--green);background:var(--pale);text-decoration:none}
.docs-sidebar a.active{color:var(--green);font-weight:600;background:var(--pale)}
.docs-content{padding:6rem 3.5rem;min-width:0}
.docs-content h2{font-size:1.5rem;font-weight:700;letter-spacing:normal;text-transform:none;border-top:1px solid var(--border);padding-top:2rem;margin-top:2.5rem;margin-bottom:.75rem;color:var(--dark)}
.docs-content h2:first-of-type{border-top:none;padding-top:0;margin-top:0}
.docs-content h3{font-size:1.15rem;margin-top:1.75rem;margin-bottom:.5rem;color:var(--dark)}
.docs-content h4{font-size:1rem;margin-top:1.25rem;margin-bottom:.35rem;color:var(--muted)}
.docs-content ul,.docs-content ol{margin-bottom:1rem}
.docs-content h1{font-size:2.25rem;color:var(--dark);line-height:1.15;margin-bottom:2rem;padding-bottom:2rem;border-bottom:1px solid var(--border)}

/* Table */
.table-wrap{overflow-x:auto;margin-bottom:1.5rem}
table{border-collapse:collapse;width:100%;font-size:.875rem}
th,td{padding:.55rem .9rem;text-align:left;border:1px solid var(--border)}
th{background:var(--pale);font-weight:600;color:var(--dark)}
tr:nth-child(even) td{background:#fafffe}

/* Mascots */
.audience-header{display:flex;align-items:center;justify-content:center;gap:2rem;padding:4rem 3rem 1.75rem}
.audience-header-text{text-align:left}
.audience-mascot{width:clamp(200px,26vw,430px);flex-shrink:0;filter:drop-shadow(0 6px 20px rgba(12,50,44,.18))}
@media(max-width:900px){.audience-mascot{width:clamp(160px,22vw,280px)}}
@media(max-width:600px){.audience-header{flex-direction:column;gap:1rem;padding:2.5rem 1.25rem 1.25rem}.audience-header-text{text-align:center}.audience-mascot{width:clamp(140px,44vw,220px)}}
.social-proof-mascot{position:absolute;right:4%;top:50%;transform:translateY(-50%);width:clamp(90px,12vw,180px);pointer-events:none;filter:drop-shadow(0 8px 20px rgba(12,50,44,.18))}
.footer-inner{display:flex;align-items:center;justify-content:center;gap:1rem}
.footer-mascot{width:2.75rem;flex-shrink:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.18))}
@media(max-width:768px){
  .social-proof-mascot{display:none}
}

/* Social proof */
.social-proof{padding:4rem 0 3rem;background:#fff;overflow:hidden;position:relative}
.social-proof-inner{text-align:center;padding:0 1.5rem 2.5rem;max-width:50rem;margin:0 auto}
.social-proof h2{font-size:2rem;color:var(--dark);margin-bottom:.375rem}
.social-proof-date{font-size:.8125rem;color:var(--green);font-weight:600;margin-bottom:.625rem;letter-spacing:.02em;text-transform:uppercase}
.social-proof-desc{color:var(--muted);font-size:.9375rem;line-height:1.6}
.social-proof-founded{display:block;margin:1.5rem 0 0}
.social-proof-founded img{display:block;max-width:10em;height:auto;margin:0 auto}
.social-proof-credit{text-align:center;color:var(--muted);font-size:.875rem;margin-top:1.75rem;padding:0 1.5rem}
.social-proof-credit a{color:var(--green);font-weight:600;text-decoration:none}
.social-proof-credit a:hover{text-decoration:underline}

/* About section */
.about-section{padding:5rem 1.5rem;background:var(--dark);color:#fff}
.about-inner{max-width:960px;margin:0 auto}
.about-header{display:flex;align-items:center;gap:3rem;margin-bottom:3.5rem}
.about-header-text{flex:1;min-width:0}
.about-mascot{width:clamp(200px,26vw,360px);flex-shrink:0;filter:drop-shadow(0 16px 40px rgba(0,0,0,.5))}
.about-section h2{color:#fff;margin-bottom:1rem}
.about-section h3{font-size:.75rem;font-weight:800;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.16em;margin:3rem 0 1.25rem;text-align:center}
.about-lead{font-size:1.0625rem;color:rgba(255,255,255,.7);line-height:1.85;margin:0}
.about-items{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}
.about-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:2rem 1.75rem;display:flex;flex-direction:row;align-items:flex-start;gap:1.125rem}
.about-item-icon{width:3.25rem;height:3.25rem;flex-shrink:0;color:var(--green)}
.about-item-icon svg{width:100%;height:100%}
.about-item p{color:rgba(255,255,255,.6);line-height:1.8;font-size:.9375rem;margin:0}
.about-item strong{color:#fff;font-weight:700}
.opensource-section{padding:5rem 2rem;background:var(--pale);text-align:center}
.opensource-inner{max-width:720px;margin:0 auto}
.opensource-section h2{margin-bottom:1.25rem}
.opensource-section p{color:var(--muted);font-size:1.0625rem;line-height:1.8}

/* FAQ */
.faq-section{padding:5rem 2rem;background:#fff}
.faq-inner{margin:0 auto; max-width: calc(var(--col-cap) * 1.4);}
.faq-section h2{text-align:center;margin-bottom:.5rem}
.faq-lead{text-align:center;color:var(--muted);font-size:1.0625rem;margin-bottom:2.5rem}
.faq-list{display:flex;flex-direction:column;gap:.75rem}
.faq-item{border:1px solid var(--border);border-radius:12px;background:var(--pale);overflow:hidden;transition:box-shadow .15s,border-color .15s}
.faq-item[open]{border-color:var(--green);box-shadow:0 4px 16px rgba(12,50,44,.08)}
.faq-q{display:flex;align-items:center;justify-content:space-between;gap:1.25rem;padding:1.25rem 1.5rem;font-weight:700;color:var(--dark);font-size:1.0625rem;line-height:1.4;cursor:pointer;list-style:none}
.faq-q::-webkit-details-marker{display:none}
.faq-q:hover{color:var(--green)}
.faq-chevron{flex-shrink:0;width:1.25rem;height:1.25rem;color:var(--green);transition:transform .2s}
.faq-chevron svg{width:100%;height:100%}
.faq-item[open] .faq-chevron{transform:rotate(180deg)}
.faq-a{padding:0 1.5rem 1.4rem;color:var(--muted);line-height:1.75}
.faq-a p{margin-bottom:.75rem}
.faq-a p:last-child{margin-bottom:0}
@media(max-width:800px){
  .about-header{flex-direction:column;text-align:center;gap:1.75rem}
  .about-mascot{width:clamp(160px,44vw,260px)}
  .about-items{grid-template-columns:1fr}
}
.quokka{max-width:320px;}
/* Footer */
footer{border-top:1px solid var(--border);padding:2rem 1.5rem;text-align:center;color:var(--muted);font-size:.8125rem;background:var(--pale)}
footer a{color:var(--muted);text-decoration:underline}
footer a:hover{color:var(--dark)}

/* Hamburger */
.nav-hamburger{display:none;background:none;border:none;cursor:pointer;color:rgba(255,255,255,.65);width:2.25rem;height:2.25rem;align-items:center;justify-content:center;border-radius:5px;padding:.3rem;flex-shrink:0}
.nav-hamburger:hover{color:#fff;background:rgba(255,255,255,.1)}
.nav-hamburger svg{width:1.25rem;height:1.25rem;pointer-events:none}
.nav-hamburger .icon-close{display:none}
.nav-hamburger.open .icon-menu{display:none}
.nav-hamburger.open .icon-close{display:block}
.nav-mobile-menu{display:none;position:fixed;top:3.75rem;left:0;right:0;background:var(--dark);border-bottom:1px solid rgba(255,255,255,.1);padding:1rem 1.5rem 1.5rem;z-index:99;flex-direction:column;gap:.125rem}
.nav-mobile-menu.open{display:flex}
.nav-mobile-menu a{color:rgba(255,255,255,.7);font-size:.9375rem;padding:.625rem .625rem;border-radius:6px;display:block;text-decoration:none}
.nav-mobile-menu a:hover{color:#fff;background:rgba(255,255,255,.07)}
.nav-mobile-menu a.active{color:var(--green);font-weight:600}
.nav-mobile-menu .nav-launch{background:var(--green);color:var(--dark)!important;font-weight:700;text-align:center;margin-top:.75rem;padding:.75rem;border-radius:8px}
.nav-mobile-menu .nav-launch:hover{background:var(--light)}

/* Mobile */
@media(max-width:900px){
  .platform-whats-wrap{flex-direction:column}
  .whats-label{display:none}
  .platform-section{padding:4rem 2rem}
  .whats-a-tool{padding:4rem 2rem}
  .platform-inner,.whats-inner{max-width:760px;margin:0 auto}
  .tool-lead{max-width:640px;margin:0 auto 2rem}
  .tool-anatomy{max-width:720px;margin:0 auto 2rem}
  .platform-features{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:768px){
  .docs-wrap{grid-template-columns:1fr}
  .docs-sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border);padding:1rem}
  .docs-content{padding:1.5rem 1rem}
  nav{overflow-x:visible}
  nav a:not(.brand){display:none}
  nav .nav-group{display:none}
  .nav-hamburger{display:flex}
  .audience-card.tab-active{
    display:flex;flex-direction:column;
    gap:2rem;padding:2.5rem 1.25rem;
  }
  .audience-header{padding:3rem 1rem 1.25rem}
  .audience-title{font-size:1.875rem}
  .audience-tabs{display:flex;flex-wrap:wrap;justify-content:center;overflow-x:visible;gap:.375rem;padding:.625rem .75rem .875rem}
  .audience-tab{flex:0 0 calc(25% - .375rem);min-width:0;padding:.625rem .375rem}
  .tool-anatomy{gap:.5rem}
  .tool-plus{display:none}
  .tool-part{min-width:110px}
}
@media(max-width:480px){
  .platform-features{grid-template-columns:1fr}
  .tool-features{grid-template-columns:1fr}
  .card-benefits{grid-template-columns:1fr}
  .audience-tab{flex-basis:calc(33.333% - .375rem)}
  .try-now-callout{position:static;transform:none;width:auto;margin-top:1.75rem;flex-direction:column;align-items:stretch}
  .try-now-callout .btn{text-align:center;justify-content:center}
}

/* Hero entrance */
@keyframes heroUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.hero-heading{animation:heroUp .7s ease both .22s}
.hero .subtitle{animation:heroUp .65s ease both .38s}
.hero-cta{animation:heroUp .65s ease both .52s}
.hero-trust{animation:heroUp .65s ease both .65s}
.hero-inner{display:flex;align-items:center;gap:4rem;max-width:1400px;margin:0 auto;width:100%}
.hero-heading{margin-bottom:1.5rem;position:relative}
.hero h1{margin-bottom:0;text-align:left;letter-spacing:0;font-weight:100}
.hero-details{flex:1;text-align:left}
.hero .subtitle{margin-left:0;max-width:none}
.hero-cta{justify-content:flex-start}
.hero-trust{justify-content:flex-start}
@media(max-width:600px){.hero-inner{flex-direction:column;text-align:center}.hero-heading{flex-direction:column;gap:1rem;align-items:center}.hero h1{text-align:center;font-size:clamp(2rem,10vw,4rem)}.hero-details{text-align:center}.hero-cta{justify-content:center}.hero-trust{justify-content:center}}

/* Scroll reveal */
.reveal{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease}
.reveal.visible{opacity:1;transform:none}
.reveal-1{transition-delay:.05s}
.reveal-2{transition-delay:.15s}
.reveal-3{transition-delay:.25s}
.reveal-4{transition-delay:.35s}
.reveal-5{transition-delay:.45s}
.reveal-6{transition-delay:.55s}
/* Mobile: snappier reveals — drop the stagger and shorten the fade so content
   doesn't lag behind the scroll (the observer also triggers earlier on mobile). */
@media(max-width:768px){
  .reveal{transition-duration:.3s}
  .reveal-1,.reveal-2,.reveal-3,.reveal-4,.reveal-5,.reveal-6{transition-delay:0s}
}
@media(prefers-reduced-motion:reduce){
  .hero h1,.hero .subtitle,.hero-cta,.hero-trust{animation:none}
  .reveal,.reveal.visible{opacity:1;transform:none;transition:none}
}

/* Theme toggle */
.nav-theme-toggle{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.65);width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;border-radius:5px;padding:.25rem;flex-shrink:0;margin-left:.25rem}
.nav-theme-toggle:hover{color:#fff;background:rgba(255,255,255,.1)}
.nav-theme-toggle svg{width:1.1rem;height:1.1rem;pointer-events:none}
.nav-theme-toggle .icon-sun{display:none}
.dark .nav-theme-toggle .icon-moon{display:none}
.dark .nav-theme-toggle .icon-sun{display:block}

/* Dark mode */
.dark{--text:#cce8da;--muted:#7aaa90;--border:#1b3d2c;--pale:#0d2419;--blue:#5d9eff}
.dark body{background:#061816}
.dark .audience-section{border-bottom-color:var(--border)}
.dark .audience-header{background:linear-gradient(180deg,#0a1f16 0%,#061816 100%)}
.dark .audience-title{color:var(--text)}
.dark .audience-tabs{background:#061816;border-bottom-color:var(--border)}
.dark .audience-tab{background:#112a1e}
.dark .audience-tab[aria-selected=true]{background:var(--dark);color:var(--green);border-color:rgba(48,186,120,.4);box-shadow:0 3px 12px rgba(0,0,0,.4)}
.dark .audience-tab:hover:not([aria-selected=true]){color:var(--green);background:#0d2419}
.dark .card-tagline{color:var(--text)}
.dark .card-intro{color:var(--muted)}
.dark .social-proof{background:#061816}
.dark .social-proof h2{color:var(--text)}
.dark .social-proof-desc{color:var(--muted)}
.dark .faq-section{background:#061816}
.dark .faq-section h2{color:var(--text)}
.dark .faq-item{background:#0d2419}
.dark .faq-q{color:var(--text)}
.dark .card-benefits strong{color:var(--text)}
.dark .tool-part{background:#112a1e}
.dark .tool-part-file{background:#0d2419}
.dark .tool-part-name{color:var(--text)}
.dark .whats-a-tool .whats-inner>h2{color:var(--text)}
.dark .tool-feature{background:#112a1e}
.dark .tool-feature strong{color:var(--text)}
.dark tr:nth-child(even) td{background:#0d2419}
.dark footer{border-top-color:var(--border)}
.dark .docs-content h1,.dark .docs-content h2,.dark .docs-content h3{color:var(--text)}
.dark th{color:var(--text)}
/* Code in dark mode: the base code/pre rules hardcode light backgrounds, so in
   dark mode inline code became light-text-on-light-bg (invisible). Give chips a
   dark surface + light text, and the pre block a dark box. The third rule keeps
   code inside pre background-free — .dark .docs-content code would otherwise
   out-specify the base "pre code background none" reset. */
.dark .docs-content code{background:#112a1e;color:var(--text)}
.dark .docs-content pre{background:#0d2419;color:var(--text);border:1px solid var(--border)}
.dark .docs-content pre code{background:none;color:inherit}
`.trim();

const THEME_SVG_MOON = `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const THEME_SVG_SUN  = `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const THEME_TOGGLE   = `<button class="nav-theme-toggle" aria-label="Toggle dark mode" title="Toggle dark/light mode">${THEME_SVG_MOON}${THEME_SVG_SUN}</button>`;

const THEME_INIT_SCRIPT = `<script>(function(){var c=localStorage.getItem('theme'),s=window.matchMedia('(prefers-color-scheme:dark)').matches;if(c==='dark'||(c!=='light'&&s))document.documentElement.classList.add('dark');})();<\/script>`;

const THEME_INTERACT_SCRIPT = `<script>(function(){var btn=document.querySelector('.nav-theme-toggle');if(!btn)return;btn.addEventListener('click',function(){var d=document.documentElement.classList.toggle('dark');localStorage.setItem('theme',d?'dark':'light');});window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(e){if(!localStorage.getItem('theme'))document.documentElement.classList.toggle('dark',e.matches);});})();<\/script>`;

const HAM_BTN = `<button class="nav-hamburger" id="navHamburger" aria-label="Toggle navigation" aria-expanded="false"><svg class="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg><svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;

const SCROLL_REVEAL_SCRIPT = `<script>(function(){var els=document.querySelectorAll('.reveal');if(!els.length)return;
  // Mobile is trigger-happy: a positive bottom rootMargin pre-reveals elements as
  // they approach (so they're faded in by the time you reach them), with threshold 0.
  // Desktop keeps a subtler trigger just inside the viewport.
  var eager=window.matchMedia('(max-width:768px)').matches;
  var opts=eager?{threshold:0,rootMargin:'0px 0px 20% 0px'}:{threshold:0.1,rootMargin:'0px 0px -32px 0px'};
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}});},opts);
  els.forEach(function(el){io.observe(el);});})();<\/script>`;

const LIQUID_GLASS_SCRIPT = `<script>(function(){
  // Adapted from shuding/liquid-glass (https://github.com/shuding/liquid-glass)
  var ns='http://www.w3.org/2000/svg';
  var xl='http://www.w3.org/1999/xlink';

  function smoothStep(a,b,t){t=Math.max(0,Math.min(1,(t-a)/(b-a)));return t*t*(3-2*t);}
  function len(x,y){return Math.sqrt(x*x+y*y);}
  function rrSDF(x,y,w,h,r){var qx=Math.abs(x)-w+r,qy=Math.abs(y)-h+r;return Math.min(Math.max(qx,qy),0)+len(Math.max(qx,0),Math.max(qy,0))-r;}

  function buildGlass(btn,idx){
    var rect=btn.getBoundingClientRect();
    var W=Math.round(rect.width)||180,H=Math.round(rect.height)||48;
    var id='lg'+idx;

    var canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    var ctx=canvas.getContext('2d');
    var n=W*H,raw=new Float32Array(n*2),maxS=0;

    for(var i=0;i<n;i++){
      var px=i%W,py=Math.floor(i/W);
      var ux=(px+0.5)/W-0.5,uy=(py+0.5)/H-0.5;
      var d=rrSDF(ux,uy,0.3,0.2,0.55);
      var disp=smoothStep(0.8,0,d-0.15);
      var sc=smoothStep(0,1,disp);
      var dx=ux*sc-ux,dy=uy*sc-uy;
      raw[i*2]=dx;raw[i*2+1]=dy;
      if(Math.abs(dx)>maxS)maxS=Math.abs(dx);
      if(Math.abs(dy)>maxS)maxS=Math.abs(dy);
    }
    maxS=(maxS*0.5)||0.01;

    var img=new Uint8ClampedArray(n*4);
    for(var i=0;i<n;i++){
      img[i*4]  =Math.round((raw[i*2]  /maxS+0.5)*255);
      img[i*4+1]=Math.round((raw[i*2+1]/maxS+0.5)*255);
      img[i*4+2]=0;img[i*4+3]=255;
    }
    ctx.putImageData(new ImageData(img,W,H),0,0);

    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('width','0');svg.setAttribute('height','0');
    svg.setAttribute('aria-hidden','true');
    svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;overflow:hidden';

    var defs=document.createElementNS(ns,'defs');
    var filter=document.createElementNS(ns,'filter');
    filter.setAttribute('id',id);
    filter.setAttribute('filterUnits','userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters','sRGB');
    filter.setAttribute('x','0');filter.setAttribute('y','0');
    filter.setAttribute('width',String(W));filter.setAttribute('height',String(H));

    var feImg=document.createElementNS(ns,'feImage');
    feImg.setAttribute('result','map');
    feImg.setAttribute('x','0');feImg.setAttribute('y','0');
    feImg.setAttribute('width',String(W));feImg.setAttribute('height',String(H));
    feImg.setAttribute('preserveAspectRatio','none');
    var mapUrl=canvas.toDataURL();
    feImg.setAttribute('href',mapUrl);            // modern feImage href
    feImg.setAttributeNS(xl,'href',mapUrl);       // legacy xlink fallback (older engines)

    var feDisp=document.createElementNS(ns,'feDisplacementMap');
    feDisp.setAttribute('in','SourceGraphic');feDisp.setAttribute('in2','map');
    feDisp.setAttribute('xChannelSelector','R');feDisp.setAttribute('yChannelSelector','G');
    feDisp.setAttribute('scale',String((maxS*2*W).toFixed(2)));

    filter.appendChild(feImg);filter.appendChild(feDisp);
    defs.appendChild(filter);svg.appendChild(defs);
    document.body.appendChild(svg);

    var bf='url(#'+id+') blur(0.4px) contrast(1.15) brightness(1.07) saturate(1.2)';
    btn.style.backdropFilter=bf;
    btn.style.webkitBackdropFilter=bf;
  }

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      document.querySelectorAll('.btn-primary,.btn-secondary').forEach(function(btn,i){buildGlass(btn,i);});
    });
  });
})();<\/script>`;

const HERO_CANVAS_SCRIPT = `<script>(function(){
  var canvas=document.getElementById('heroCanvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var exts=['.TXT','.MD','.PDF','.SVG','.JPG','.PNG','.WEBM','.MP4','.WEBP','.GIF','.AVIF','.HTML'];
  // Headline formats appear ~2x as often as the rest: listing them again weights
  // them double in the pick pool (each favored ext is in the pool twice).
  var extPool=exts.concat(['.PDF','.SVG','.JPG','.MP4']);
  var floaters=[], fragments=[];
  // Ambient chip population scales with canvas width so wide heroes aren't sparse
  // and narrow/mobile ones aren't crowded.
  function targetFloaters(){ return Math.max(5, Math.min(14, Math.round(cw/100))); }
  // Logical (CSS-pixel) canvas size. The backing store is scaled by devicePixelRatio
  // so the animation stays crisp on HiDPI/Retina displays instead of being a 1x
  // bitmap the browser upscales; all motion math below stays in these logical units.
  var dpr=Math.max(1, window.devicePixelRatio||1);
  var cw=800, ch=400;

  function resize(){
    dpr=Math.max(1, window.devicePixelRatio||1);
    cw=canvas.parentElement.offsetWidth||800;
    ch=canvas.parentElement.offsetHeight||400;
    canvas.width=Math.round(cw*dpr);
    canvas.height=Math.round(ch*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function rand(a,b){return a+Math.random()*(b-a);}

  // Bake one chip (filled box + label) into an offscreen sprite. Both the ambient
  // floaters and the click-burst fragments reuse this, so the chip look lives in
  // one place; callers add their own motion fields. Pre-compositing also lets a
  // chip fade as a single group instead of each layer fading over the bg.
  function makeChip(){
    var ext=extPool[Math.floor(Math.random()*extPool.length)];
    var fs=rand(10,22);
    var weight='700';
    ctx.font=weight+' '+fs+'px SUSE,sans-serif';
    var tw=ctx.measureText(ext).width;
    var px=fs*0.75,py=fs*0.75;
    var w=tw+px*2, h=fs+py*2, r=Math.round(fs*0.38);
    var spr=document.createElement('canvas');
    spr.width=Math.ceil(w*dpr); spr.height=Math.ceil(h*dpr);
    var sx=spr.getContext('2d');
    sx.scale(dpr,dpr);
    sx.lineJoin='round';
    rr(sx,0,0,w,h,r);
    // Borderless: a solid fill (hero background) so overlapping chips occlude each
    // other cleanly instead of letting labels behind them bleed through. The chips
    // read apart via the soft drop shadow cast at blit time (see drawChip).
    sx.fillStyle='#1c4a2e'; sx.fill();
    sx.fillStyle='#30ba78';
    sx.font=weight+' '+fs+'px SUSE,sans-serif';
    // Centre on the actual glyph box, not the em box: these labels are all-caps
    // with no descenders, so a 'middle' baseline leaves them riding high with a
    // gap at the bottom. Offset the baseline by half the ink height to balance.
    sx.textAlign='center'; sx.textBaseline='alphabetic';
    var m=sx.measureText(ext);
    var asc=m.actualBoundingBoxAscent||fs*0.7, desc=m.actualBoundingBoxDescent||0;
    sx.fillText(ext,w/2,h/2+(asc-desc)/2);
    return{spr:spr,w:w,h:h};
  }

  // Ambient chip: drifts up from below the canvas, anti-gravity, with a gentle
  // leaf-like sway. The tilt tracks the horizontal sway so it reads as floating,
  // not spinning. initial=true spreads the first batch across the full height so
  // the hero isn't empty on load; otherwise it starts just below the bottom edge.
  function makeFloater(initial){
    var c=makeChip();
    var x=rand(c.w*0.6, cw-c.w*0.6);
    var y=initial ? rand(-c.h, ch) : ch+c.h+rand(0,ch*0.35);
    return{
      spr:c.spr, w:c.w, h:c.h,
      baseX:x, x:x, y:y, vy:rand(-0.95,-0.45),
      swayPhase:rand(0,Math.PI*2), swayFreq:rand(0.006,0.016), swayAmp:rand(6,20),
      rot:0, tilt:rand(0.18,0.79)
    };
  }

  // Click burst: a chip flung outward from (x,y); drag + gravity + fade in tick().
  function makeFragment(x,y,angle){
    var c=makeChip();
    var spd=rand(4.5,11.0);
    return{
      spr:c.spr, w:c.w, h:c.h,
      x:x,y:y,
      vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd,
      rot:rand(-0.5,0.5), vrot:rand(-0.022,0.022),
      alpha:rand(0.8,1.0), life:1
    };
  }

  function explodeAt(x,y){
    var count=Math.floor(rand(12,18));
    for(var i=0;i<count;i++){
      var angle=(i/count)*Math.PI*2+rand(-0.3,0.3);
      var f=makeFragment(x,y,angle);
      f.vx*=1.5; f.vy*=1.5;
      fragments.push(f);
    }
  }

  function rr(c,x,y,w,h,r){
    c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);
    c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);
    c.arcTo(x+w,y+h,x+w-r,y+h,r);c.lineTo(x+r,y+h);
    c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);
    c.arcTo(x,y,x+r,y,r);c.closePath();
  }

  // Blit a chip sprite. No drop shadow: per-frame shadowBlur forces a separate blur
  // pass on every chip every frame, which dominated the hero's render cost. The
  // chips' solid fill already occludes cleanly, so overlapping chips still read apart.
  function drawChip(c,alpha){
    ctx.save();
    ctx.translate(c.x,c.y); ctx.rotate(c.rot); ctx.globalAlpha=alpha;
    ctx.drawImage(c.spr,-c.w/2,-c.h/2,c.w,c.h);
    ctx.restore();
  }

  function tick(){
    ctx.clearRect(0,0,cw,ch);

    // Fragments: drag + gravity, fade out
    for(var i=fragments.length-1;i>=0;i--){
      var f=fragments[i];
      f.vx*=0.972; f.vy=f.vy*0.972+0.03;
      f.x+=f.vx; f.y+=f.vy; f.rot+=f.vrot;
      f.life-=0.0045;
      if(f.life<=0){fragments.splice(i,1);continue;}
      // Hold the chip at full opacity for most of its life, then fall off a cliff
      // over the last ~18%. A linear fade leaves chips semi-transparent the whole
      // time, so their solid fill goes translucent and overlapping chips bleed
      // through (muddy). Squaring the tail makes the late drop bite harder.
      var t=f.life/0.18, fade=t>=1?1:t*t;
      drawChip(f, f.alpha*fade);
    }

    // Floaters: drift up, sway, fade at the top/bottom edges, recycle off-top.
    for(var i=floaters.length-1;i>=0;i--){
      var fl=floaters[i];
      fl.swayPhase+=fl.swayFreq;
      fl.y+=fl.vy;
      fl.x=fl.baseX+Math.sin(fl.swayPhase)*fl.swayAmp;
      fl.rot=Math.sin(fl.swayPhase)*fl.tilt;
      // No fade: chips ride in fully opaque from below the bottom edge, and the
      // canvas edge simply clips them as they pass the top. Drop once fully above.
      if(fl.y<-fl.h){ floaters.splice(i,1); continue; }
      drawChip(fl, 1);
    }

    // Replenish to the responsive target (also restocks after a resize grows it).
    while(floaters.length<targetFloaters()) floaters.push(makeFloater(false));

    requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  var hero=canvas.parentElement;
  document.addEventListener('pointerdown',function(e){
    if(!hero.contains(e.target))return;
    var rect=canvas.getBoundingClientRect();
    explodeAt(e.clientX-rect.left,e.clientY-rect.top);
  });
  while(floaters.length<targetFloaters()) floaters.push(makeFloater(true));
  tick();
})();<\/script>`;

const HAMBURGER_SCRIPT = `<script>(function(){var ham=document.getElementById('navHamburger');var menu=document.getElementById('navMobileMenu');if(!ham||!menu)return;ham.addEventListener('click',function(){var open=menu.classList.toggle('open');ham.classList.toggle('open',open);ham.setAttribute('aria-expanded',open?'true':'false');});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');ham.classList.remove('open');ham.setAttribute('aria-expanded','false');});});document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!ham.contains(e.target)){menu.classList.remove('open');ham.classList.remove('open');ham.setAttribute('aria-expanded','false');}});})();<\/script>`;

function buildNav(activeHref, isLanding) {
  const link = n =>
    `<a href="${n.href}"${n.href === activeHref ? ' class="active"' : ''}>${esc(n.label)}</a>`;
  // Desktop: one <span class="nav-group"> per cluster, dividers come from CSS.
  const groups = NAV.map(group => `<span class="nav-group">${group.map(link).join('')}</span>`).join('');
  // Mobile menu: a single flat vertical list (clusters collapse to plain rows).
  const mobileLinks = NAV.flat().map(link).join('');
  const navClass = isLanding ? '' : ' class="nav-solid"';
  return `<nav${navClass}><a href="/info/index.html" class="brand">Lolly</a>${groups}<div class="gap"></div>${THEME_TOGGLE}${HAM_BTN}<a href="/" class="nav-launch">Launch App ↗</a></nav>
<div class="nav-mobile-menu" id="navMobileMenu">${mobileLinks}<a href="/" class="nav-launch">Launch App ↗</a></div>`;
}

const FOOTER = `<footer><p>Lolly — <a href="${REPO_URL}">Open Source</a></p></footer>`;

function wrapPage(page, content, ogSlugs) {
  const activeHref = page.slug === 'index' ? '/info/index.html' : `/info/${page.slug}.html`;
  const isLanding  = page.isLanding;

  // A page with its own generated card (subtitle = its title) points share tags at
  // it; the landing page and any page that failed generation keep the canonical og.png.
  const ogImage    = (!isLanding && ogSlugs?.has(page.slug)) ? `${SITE_URL}/info/og/${page.slug}.png` : OG_IMAGE;
  const ogImageAlt = isLanding ? 'Lolly — on-brand creative tools' : `Lolly — ${page.title}`;

  const body = isLanding ? content : `
<div class="docs-wrap">
  <aside class="docs-sidebar">
    <div class="sidebar-label">Marketing</div>
    <a href="/info/index.html"${activeHref === '/info/index.html' ? ' class="active"' : ''}>Home</a>
    <a href="/info/positioning.html"${activeHref.includes('positioning') ? ' class="active"' : ''}>Positioning</a>
    <div class="sidebar-label">Project</div>
    <a href="/info/about.html"${activeHref.includes('about') ? ' class="active"' : ''}>About</a>
    <a href="/info/overview.html"${activeHref.includes('overview') ? ' class="active"' : ''}>Overview</a>
    <div class="sidebar-label">Authoring</div>
    <a href="/info/authoring-tools.html"${activeHref.includes('authoring-tools') ? ' class="active"' : ''}>Tools</a>
    <a href="/info/authoring-assets.html"${activeHref.includes('authoring-assets') ? ' class="active"' : ''}>Assets</a>
    <a href="/info/url-mode.html"${activeHref.includes('url-mode') ? ' class="active"' : ''}>URL Mode</a>
    <div class="sidebar-label">Deployment</div>
    <a href="/info/build-guide.html"${activeHref.includes('build-guide') ? ' class="active"' : ''}>Build Guide</a>
  </aside>
  <main class="docs-content">
    ${content}
  </main>
</div>`;

  const pageTitle  = isLanding ? LANDING_TITLE : `${page.title} — Lolly`;
  const canonical  = `${SITE_URL}${activeHref}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(SITE_DESCRIPTION)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lolly">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(SITE_DESCRIPTION)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogImageAlt)}">
<meta property="og:logo" content="${esc(OG_LOGO)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(SITE_DESCRIPTION)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="icon" href="/favicon.ico">
<link rel="icon" type="image/png" href="/icon.png">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=SUSE:wght@100..800&family=SUSE+Mono:wght@100..700&display=swap" rel="stylesheet">
${THEME_INIT_SCRIPT}
<style>${CSS}</style>
</head>
<body>
${buildNav(activeHref, isLanding)}
${body}
${FOOTER}
${THEME_INTERACT_SCRIPT}
${HAMBURGER_SCRIPT}
${SCROLL_REVEAL_SCRIPT}
${isLanding ? HERO_CANVAS_SCRIPT : ''}
${isLanding ? LIQUID_GLASS_SCRIPT : ''}
</body>
</html>`;
}

// ── Build all pages ───────────────────────────────────────────────────────────

function build() {
  // Ensure output dirs exist and copy static assets (icons).
  mkdirSync(outDir, { recursive: true });
  try { copyFileSync(resolve(repoRoot, 'icon.png'), resolve(repoRoot, 'shells/web/public/icon.png')); } catch {}
  try { copyFileSync(resolve(repoRoot, 'icon-normal.webp'), resolve(outDir, 'icon-normal.webp')); } catch {}
  try { copyFileSync(resolve(repoRoot, 'icon-normal.png'), resolve(outDir, 'icon-normal.png')); } catch {}
  try { copyFileSync(resolve(repoRoot, 'founded-by.svg'), resolve(outDir, 'founded-by.svg')); } catch {}

  for (const page of pages) {
    const srcPath = resolve(__dirname, page.src);
    let md;
    try {
      md = readFileSync(srcPath, 'utf-8');
    } catch {
      console.warn(`⚠  Skipping ${page.slug}: ${srcPath} not found`);
      continue;
    }

    const content = page.isLanding ? buildLandingContent(md) : mdToHtml(md);
    const html    = wrapPage(page, content, ogSlugs);
    const outFile = page.slug === 'index' ? 'index.html' : `${page.slug}.html`;
    writeFileSync(resolve(outDir, outFile), html, 'utf-8');
    console.log(`✓  /info/${outFile}`);
  }
  console.log(`\nSite built → shells/web/public/info/`);
}

// Per-page OG share images depend only on the page titles + brand assets (never the
// docs markdown), so they're rasterised once here and reused by every build()
// (including incremental --watch rebuilds). `ogSlugs` names the slugs that got their
// own card; the rest fall back to og.png. Best-effort — a missing @resvg/resvg-js
// (or any rasterise error) just yields an empty set, leaving every page on og.png.
const ogSlugs = await generateOgImages(pages, outDir, repoRoot, (m) => console.log(m));

build();

// ── Watch mode ────────────────────────────────────────────────────────────────
// `node docs/build.js --watch` rebuilds whenever a docs source changes, so the
// /info pages stay current during `npm run dev:web`. Sources are everything under
// docs/ (the markdown, faq.md, and src/*.svg) plus the repo-root README.md (the
// About page). Output goes to shells/web/public/ — outside docs/ — so a rebuild
// never re-triggers the watcher.
if (process.argv.includes('--watch')) {
  let timer = null;
  const scheduleRebuild = (label) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\n↻  ${label} changed — rebuilding /info…`);
      try { build(); } catch (err) { console.error('✗  Rebuild failed:', err.message); }
    }, 120);
  };
  watch(__dirname, { recursive: true }, (_event, file) => scheduleRebuild(file || 'docs'));
  try { watch(resolve(repoRoot, 'README.md'), () => scheduleRebuild('README.md')); } catch {}
  console.log('\n👀  Watching docs/ for changes — Ctrl+C to stop.');
}
