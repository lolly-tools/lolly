#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
// Minimal static site generator for Lolly.
// Run: node docs/build.ts            build the /info pages once
//      node docs/build.ts --watch    rebuild on every change under docs/ (used by dev:web)
// Output: shells/web/public/info/
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync, existsSync, readdirSync, rmSync, statSync, watch } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateOgImages } from './og-image.ts';
import { LANGS, LANG_META, sortedLangs } from '../engine/src/lang.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { buildAgentDocs, AGENT_FILES } from './agents-pages.ts';
import { readShotProvenance } from './shot-provenance.ts';
import { scan as scanVernacular, staleAllows as staleVernacularAllows } from '../scripts/check-docs-vernacular.ts';

// Deterministic vernacular + fingerprint-unicode gate (owner-mandated, no model
// in the loop): the build refuses to produce /info from sources that carry a
// banned phrase or character. Same scanner as tests/docs-vernacular.test.ts and
// the standalone CLI - fix the copy, never this gate.
{
  const vernacularHits = scanVernacular();
  const staleAllowEntries = staleVernacularAllows();
  if (vernacularHits.length || staleAllowEntries.length) {
    for (const v of vernacularHits) console.error(`✗ ${v.file}:${v.line} [${v.what}] ${v.excerpt}`);
    for (const st of staleAllowEntries) console.error(`✗ stale allow entry: ${st}`);
    console.error(`build:info refused: ${vernacularHits.length} vernacular/unicode violation(s), ${staleAllowEntries.length} stale allow(s) - see scripts/check-docs-vernacular.ts`);
    process.exit(1);
  }
}
// Banked docs art (plans/105 section 6). The strip/namespace + composition live in their
// own module because this one runs build() on import: a test can exercise them
// there without building the site (see tests/docs-figures.test.ts).
// parseFigureFence + figureBlock moved to @lolly-tools/docs-render (the renderer composes
// figures there); the filesystem art resolvers + the masthead band stay here.
import { resolveDocsArt, inlineDocsArt, mastheadArtBand } from './docs-art.ts';
// Page seals (plans/105 section 7): the <link rel="c2pa-manifest"> each English page
// carries, and the signing pass that runs after every page is on disk. Same
// reason as docs-art.ts for living outside this file - sealing is exercised by
// tests/docs-page-seal.test.ts, and importing build.ts would build the site.
import { pageSealLink, sealPages, type SealTarget } from './page-seal.ts';
import { DOC_LOGOS } from './logos.ts';
import { readShotAnatomy } from './shot-anatomy.ts';
// The shots pipeline's own recipe parser, reused rather than re-implemented: the
// capture params a credential wants to state are exactly the ones the capture read,
// and a second parser is a second thing to disagree with the first.
import { parseShotRecipes, type ShotDef } from '../scripts/lib/shot-compare.ts';
// The narration pipeline's own extraction, reused for the cue→anchor assertion
// below - the blockIds a committed cues.json speaks must be judged by the same
// rules that minted them, and the player already bundles this exact module.
import { extractSpokenText } from '../scripts/lib/docs-spoken-text.ts';
// The shared, DOM-free docs render layer (@lolly-tools/docs-render). Imported by
// RELATIVE path because docs/ is a submodule, not an npm-workspace member (same as
// engine/src and scripts/lib above); the web shell imports the same code via the
// bare specifier through the workspace symlink. The renderer lives here so the
// static site and the in-app live docs view can never drift. `esc` here is the
// 3-char escaper the whole site relies on - never the web shell's 5-char one.
import {
  esc,
  stripFrontMatter,
  unwrapFigureFences,
  unwrapProvenanceMarkers,
  stripLogoMarkers,
  commentStandaloneProvenanceLines,
  mdDescription,
  renderCredential,
  inline as pkgInline,
  mdToHtml as pkgMdToHtml,
  type DocsRenderContext,
  type CredentialFacts,
} from '../packages/docs-render/src/index.ts';
// esbuild bundles the docs player (docs/player/) into /info/docs-player.js - it
// is already in the tree as vite's bundler, so this adds no dependency.
import { buildSync } from 'esbuild';
// The format side-door page models (plan 116 workstream A). Pure transforms over
// the register, factored into their own module so a unit test can import them
// without importing build.ts (which reads the catalog + builds the site at import).
import {
  buildCapabilities,
  convertPageList,
  buildFormatPageModel,
  buildConvertPageModel,
  llmsFormatsSection,
  METADATA_LABEL,
  type FmtMetadata,
  type FmtCatalog as SideDoorCatalog,
  type FormatPageModel,
  type ConvertPageModel,
} from './formats-pages.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'shells/web/public/info');

type Lang = (typeof LANGS)[number];

// Canonical site origin - used for absolute URLs in social/Open Graph tags.
// Social crawlers (Slack, X, Facebook, LinkedIn, iMessage) require absolute og:image URLs.
const SITE_URL = 'https://lolly.tools';
const REPO_URL = 'https://github.com/lolly-tools/lolly';
// "Founded by SUSE" badge - reused at the same size in the hero, the social-proof
// block, and the footer. Always links to suse.com in a new window.
const FOUNDED_BY = `<a class="founded-badge" href="https://www.suse.com" target="_blank" rel="noopener" aria-label="Founded by SUSE"><img src="/info/founded-by.svg" alt="Founded by SUSE"></a>`;
const OG_IMAGE = `${SITE_URL}/og.png`;
// og:logo is machine-read metadata, and its consumers (GitHub-style scrapers) don't all
// decode SVG - so point it at the derived PNG of the mark, not the signed source icon.svg.
// It's still the one mark: icon-512.png is rasterised from icon.svg by `npm run icons`.
const OG_LOGO = `${SITE_URL}/icons/icon-512.png`;
const SITE_DESCRIPTION = 'Lolly: constraint-first, template-driven platform for generating production-ready creative and content assets at scale.';
// Landing-page <title>/share title (matches the web shell's index.html). Other
// pages use "<page title> - Lolly", so this is landing-only. Kept short: the
// Listen player and the browser tab both wear this string, so a tagline here
// makes the player comically wide.
const LANDING_TITLE = 'Lolly Tools';

// Tool count for the hero badge - read from the generated catalog index so it
// tracks the real number of tools rather than drifting as a hand-edited literal.
const TOOL_COUNT = JSON.parse(
  readFileSync(resolve(repoRoot, 'catalog/tools/index.json'), 'utf8')
).tools.length;

type Pathway = 'quickstart' | 'builders' | 'creators' | 'operators' | 'trust';

interface Page {
  slug: string;
  title: string;
  src: string;
  isLanding?: boolean;
  // Which pathway this page belongs under - drives the docs sidebar + which top-nav
  // link is highlighted. Omitted only for the landing page.
  pathway?: Pathway;
  // True for the four pathway landing pages (quickstart + the three hubs).
  isHub?: boolean;
  // Social/search description. Defaults to the page's first body sentence
  // (mdDescription), which is right for most pages because it cannot drift from
  // the docs. Set this where that sentence makes a poor preview on its own: a
  // four-word opener ("A tool is a folder."), a 200-character one that platforms
  // truncate mid-clause, or an opener that describes the DOCUMENT rather than the
  // subject ("This document captures…").
  description?: string;
  // A page whose body is not markdown alone. The landing has always been special-
  // cased; `render` is the general form of the same thing, for a page that hosts a
  // COMPOSED band (the formats table, the design-import band) which markdown cannot
  // express - the band ships from one function, so the page and the landing teaser
  // can never show two different versions of it (plan 117 block 9).
  render?: (md: string, lang: Lang) => string;
  // A generated side-door page (per-format, per-conversion): no markdown source,
  // no docs-sidebar rail, and not page-sealed. It is a standalone content column
  // under the site nav, so a reader arriving from a search engine meets the same
  // header, nav, footer and theme every other page wears, without the pathway rail
  // it does not belong to. Built in build()'s per-locale loop, never in pages[].
  generated?: boolean;
}

// Where docs/formats.md wants the composed three-zone table dropped in. An HTML
// comment, so the markdown twin at /info/formats.md still reads as a document (the
// line is invisible) and an author can move the table by moving one line.
const FORMATS_TABLE_MARK = '<!-- the three-zone formats table renders here -->';

// A retired slug that now redirects to its new home. Emitted as a tiny meta-refresh
// stub so inbound links + bookmarks keep resolving after the IA rebuild.
interface Stub { slug: string; target: string; }
const stubs: Stub[] = [
  // Old front-door entry; the friendly start is now the Quickstart primary article.
  { slug: 'getting-started', target: '/info/start/quickstart.html' },
  // Retitled the same day it shipped: "labour" read as an invitation to the very
  // work Lolly exists to remove, and an agent's real surface is the tool's inputs.
  { slug: 'labour-not-impersonation', target: '/info/trust/input-not-impersonation.html' },
];

const pages: Page[] = [
  { slug: 'index',            title: 'Lolly',     src: 'site.md',            isLanding: true },

  // ── Primary article ──────────────────────────────────────────────────────
  { slug: 'quickstart',       title: 'Quickstart', src: 'quickstart.md', pathway: 'quickstart', isHub: true },
  { slug: 'make-something',   title: 'Make something in 60 seconds', src: 'make-something.md', pathway: 'quickstart', description: "Pick a tool, type a few words and download the finished file: three short walkthroughs that need no account, no setup and no design skill.", render: renderMakeSomethingPage },
  // The FAQ, previously an accordion inside the landing (plans/177 moved it out;
  // the gallery's #faq-… deep links now land here).
  { slug: 'faq',              title: 'Questions & answers', src: 'faq.md', pathway: 'quickstart', description: "The things people ask most: why it is free, what the catch is not, what happens to your files and where Lolly is going.", render: renderFaqPage },
  // The destination of the hero's download rail (downloadsRail). Its own page rather
  // than five direct file links, because picking a package is a decision - which
  // architecture, which repository, what to trust - and a bare link cannot answer any
  // of it. Registered under Quickstart: a reader who wants the app installed is at the
  // very start of the path, not deep in Operators.
  { slug: 'install',          title: 'Install Lolly', src: 'install.md', pathway: 'quickstart', description: "Every packaged build in one list: the macOS disk image, the openSUSE Tumbleweed and Leap RPMs, the Flatpak, the Android APK, and how to check the file you downloaded is the one we made." },

  // ── Pathway hubs ─────────────────────────────────────────────────────────
  { slug: 'creators',         title: 'Lolly for Creators',  src: 'creators.md',  pathway: 'creators',  isHub: true },
  { slug: 'builders',         title: 'Lolly for Builders',  src: 'builders.md',  pathway: 'builders',  isHub: true },
  { slug: 'operators',        title: 'Lolly for Operators', src: 'operators.md', pathway: 'operators', isHub: true, description: "Roll Lolly out across an organisation: governance, deployment, configuration and the trust properties your security review will ask about." },
  { slug: 'trust',            title: 'Trust',               src: 'trust.md',     pathway: 'trust',     isHub: true, description: "Where your content comes from, how to check it yourself, and what happens to your data. The claims on this site with the mechanism that enforces each one." },
  { slug: 'status-quo',       title: 'The trade we never agreed to', src: 'status-quo.md', pathway: 'trust', description: "Uploading a logo to a stranger to resize it. Artwork locked behind a lapsed plan. The frictions we all learned to accept, and what replaces them." },
  { slug: 'input-not-impersonation', title: 'Input, not impersonation', src: 'input-not-impersonation.md', pathway: 'trust', description: "An AI agent may fill in the inputs and may not claim to be you. Where the line sits, how it is enforced, and what a rogue agent still cannot do." },

  // ── Creators pathway ─────────────────────────────────────────────────────
  { slug: 'using',            title: 'Using Lolly',       src: 'using.md',        pathway: 'creators' },
  { slug: 'brand-studio',     title: 'The Brand Studio',  src: 'brand-studio.md', pathway: 'creators' },
  { slug: 'profile',          title: 'Profiles',          src: 'profile.md',      pathway: 'creators', description: "The working identity Lolly creates as - your name, role and contact details, filled into tools automatically and stored on your own device." },
  // Both of these pages HOST a band that used to sit on the landing (plan 117 block
  // 9). The band is the same function the landing called, so the layout that made
  // the content readable moved with the content instead of being flattened to prose.
  // Both renderers are NAMED functions rather than inline arrows on purpose:
  // scripts/check-docs-nav.ts recovers each entry with a brace-free match, and an
  // inline arrow body (or a template literal) puts braces inside the entry, which
  // drops it from that guard's count.
  { slug: 'design-import',    title: 'Import a design (Figma, Penpot, Illustrator, InDesign)', src: 'design-import.md', pathway: 'creators', description: "Bring a finished design out of Figma, Penpot, Illustrator or InDesign and into Lolly as an editable, re-renderable tool rather than a flat picture.", render: renderDesignImportPage },
  { slug: 'formats',          title: 'Every format Lolly can open and make', src: 'formats.md', pathway: 'creators', description: "Every file format Lolly reads, every format it writes, and the ones it does both ways - grouped by what each one is, with a plain-language card behind every chip.", render: renderFormatsPage },
  { slug: 'sequence-editor',  title: 'The sequence editor', src: 'sequence-editor.md', pathway: 'creators' },
  { slug: 'animating',        title: 'Animating: keyframes, depth and a camera', src: 'animating.md', pathway: 'creators', description: "Pose a box at one moment, lift it off the page, and fly a camera over the result - keyframes, depth, the scene camera and Lift layers, all on your device." },
  // Collab is a CREATORS page, not a Builders or Trust one: it is a thing two people
  // do with a tool session, and the reader arrives at it from "I want to work on this
  // with someone", not from an interest in WebRTC. The security property it turns on
  // (the matching plates) is explained where the reader meets it, and Trust links here.
  { slug: 'collaborate',      title: 'Working together',  src: 'collaborate.md',  pathway: 'creators', description: "Two people, two devices, one tool session, edited live - no account, no server in the middle, and no internet needed when both devices are on the same network." },
  // The first sentence of each of these reads well as a preview on its own, so both
  // fall through to mdDescription rather than repeating themselves here.
  { slug: 'search',           title: 'Search',            src: 'search.md',       pathway: 'creators' },
  { slug: 'ask',              title: 'Ask Lolly',         src: 'ask.md',          pathway: 'creators' },
  { slug: 'dashboard',        title: 'The Dashboard',     src: 'dashboard.md',    pathway: 'creators' },
  { slug: 'utilities',        title: 'Utility views',     src: 'utilities.md',    pathway: 'creators', description: "The five workbenches built into the app - spreadsheet, converter, Colour Lab, PDF extractor and Script audio - what each one does, and where it stops." },
  { slug: 'favourites',       title: 'Your favourites',   src: 'favourites.md',   pathway: 'creators' },
  { slug: 'exporting',        title: 'Exporting & Formats', src: 'exporting.md',  pathway: 'creators' },
  { slug: 'positioning',      title: 'How Lolly compares', src: 'positioning.md', pathway: 'creators' },
  { slug: 'compare',            title: 'Lolly compared, tool by tool', src: 'compare.md', pathway: 'creators', description: "Where Lolly overlaps with Canva, Adobe, Figma, rendering APIs and online converters, and what each of those does better. Dated, concession first, no superlatives." },
  { slug: 'compare-canva',      title: 'Lolly and Canva',   src: 'compare-canva.md',   pathway: 'creators', description: "Making an on-brand graphic without a subscription: where Lolly and Canva overlap, and what Canva does better today." },
  { slug: 'compare-adobe',      title: 'Lolly and Adobe',   src: 'compare-adobe.md',   pathway: 'creators', description: "Converting, exporting and signing files without a Creative Cloud account: where Lolly and Adobe overlap." },
  { slug: 'compare-figma',      title: 'Lolly and Figma',   src: 'compare-figma.md',   pathway: 'creators', description: "Laying out a design and turning it into a reusable output: where Lolly and Figma overlap, and what Figma does better." },
  { slug: 'compare-render-apis', title: 'Lolly and rendering APIs', src: 'compare-render-apis.md', pathway: 'creators', description: "Generating many on-brand images from data: where Lolly and a hosted rendering API like Bannerbear or Placid overlap." },
  { slug: 'compare-converters', title: 'Lolly and online file converters', src: 'compare-converters.md', pathway: 'creators', description: "Turning one file format into another on your own device, without uploading it to a stranger's server." },
  { slug: 'compare-penpot',   title: 'Lolly and Penpot',  src: 'compare-penpot.md',  pathway: 'creators', description: "Two open-source answers to design work: where Lolly and Penpot overlap, what Penpot does better today, and how the two projects work together." },
  { slug: 'compare-brand-portals', title: 'Lolly and brand portals', src: 'compare-brand-portals.md', pathway: 'creators', description: "Locked templates without the portal: where Lolly overlaps with brand platforms like Bynder, Frontify and Marq, and what a portal still does better." },

  // ── Builders pathway ─────────────────────────────────────────────────────
  { slug: 'overview',         title: 'Architecture',      src: 'overview.md',        pathway: 'builders', description: "How the Lolly platform is put together: the engine, the shells, the capability bridge, and why tools are data rather than bundled code." },
  { slug: 'design-tokens',    title: 'Design Tokens',     src: 'design-tokens.md',   pathway: 'builders' },
  { slug: 'constraints',      title: 'Constraints',       src: 'constraints.md',     pathway: 'builders', description: "Why output comes out right by construction: inputs declared in the manifest, logic-less templates and brand values resolved from tokens, with the tests that enforce each." },
  { slug: 'determinism',      title: 'Determinism',       src: 'determinism.md',     pathway: 'builders', description: "Same inputs, same file: one render path behind every shell, what is byte-reproducible and what is not, and the receipts for both." },
  { slug: 'reproducibility',  title: 'Reproducibility',   src: 'reproducibility.md', pathway: 'builders', description: "The URL is the artifact: every input travels as parameters, so a link re-renders next year, and the limits of what a bare link can carry." },
  { slug: 'authoring-tools',  title: 'Authoring Tools',   src: 'authoring-tools.md', pathway: 'builders', description: "Author a Lolly tool: the manifest, the template, the optional hooks, and the invariants that keep one tool running unchanged in the browser, on the desktop and in the terminal." },
  { slug: 'authoring-assets', title: 'Authoring Assets',  src: 'authoring-assets.md', pathway: 'builders' },
  { slug: 'host-api',         title: 'Host API',          src: 'host-api.md',        pathway: 'builders' },
  { slug: 'url-mode',         title: 'URL Mode',          src: 'url-mode.md',        pathway: 'builders', description: "Every tool's state lives in the URL, so a link is a finished asset, a reproducible render, and the same input the CLI takes." },
  { slug: 'cli',              title: 'CLI',               src: 'cli.md',             pathway: 'builders' },
  { slug: 'cli-signing',      title: 'Signing from the terminal', src: 'cli-signing.md', pathway: 'operators', description: "Set up a real signing identity for the CLI, so files made from the terminal carry a verifiable name rather than an anonymous on-device key." },
  { slug: 'tui',              title: 'TUI',               src: 'tui.md',             pathway: 'builders' },
  { slug: 'mcp',              title: 'MCP Server',        src: 'mcp.md',             pathway: 'builders' },
  { slug: 'ai-agents',        title: 'AI Agents',         src: 'ai-agents.md',       pathway: 'builders' },
  { slug: 'extension',        title: 'Browser Extension', src: 'extension.md',       pathway: 'creators' },
  { slug: 'contributing-setup', title: 'Contributing Setup', src: 'contributing-setup.md', pathway: 'builders', description: "Get a development checkout sized to what you're here to do: slim clone personas for tool authors and engine developers, and how to upgrade to the full thing later." },
  { slug: 'build-guide',      title: 'Build Guide',       src: 'build-guide.md',     pathway: 'operators', description: "Build Lolly for each target: the CLI binary, the desktop app, mobile, and the web PWA. Prerequisites, commands and what each build produces." },
  { slug: 'ios-build',        title: 'Building for iOS',  src: 'ios-build.md',       pathway: 'builders' },
  { slug: 'deployment',       title: 'Deployment',        src: 'deployment.md',      pathway: 'operators' },
  { slug: 'configuration',    title: 'Configuration',     src: 'configuration.md',   pathway: 'operators', description: "Everything that shapes a Lolly instance: which brand it wears, which tools it exposes, and what each tool may do on the device it runs on." },
  { slug: 'content-credentials-identity', title: 'Content Credentials Identity', src: 'content-credentials-identity.md', pathway: 'trust' },
  { slug: 'content-credentials-engineering', title: 'Content Credentials - Engineering', src: 'content-credentials-engineering.md', pathway: 'trust' },
  { slug: 'data-transfer',    title: 'Data Transfer',     src: 'data-transfer.md',   pathway: 'builders' },
  { slug: 'about',            title: 'About',             src: '../README.md',       pathway: 'builders', description: "What Lolly is, who builds it, and how the pieces fit together. The project's own README." },

  // ── Operators pathway ────────────────────────────────────────────────────
  // The function playbooks (plans/177 section 5): job-first pages harvested from
  // the retired landing audience tabs; the landing's persona device links them.
  { slug: 'sales',     title: 'Lolly for sales teams', src: 'sales.md',     pathway: 'operators', description: "Walk into every meeting with exactly the file you need: fix the deck you already have, rebuild it as a native deck file, and make the asset on the way there." },
  { slug: 'press',     title: 'Lolly for the newsroom', src: 'press.md',    pathway: 'operators', description: "Build the info-editorial style once, then generate publication-quality charts, maps and tables from live data, in the house style, for print and screen." },
  { slug: 'marketing', title: 'Lolly for marketing teams', src: 'marketing.md', pathway: 'operators', description: "Every size, every language, one source of truth: paste a spreadsheet and get one finished file per row, with no agency bottleneck for routine files." },
  { slug: 'legal',     title: 'Lolly for legal teams', src: 'legal.md',     pathway: 'operators', description: "Redact, anonymise, verify and compress on the device the file already lives on, so nothing leaves the building to be cleaned, with the licence and the EU AI Act position stated plainly." },
  { slug: 'adoption-governance', title: 'Adoption & Governance', src: 'adoption-governance.md', pathway: 'operators', description: "Adopting Lolly across a team: who approves tools, how brand rules become enforceable, and what changes in a creative workflow." },
  { slug: 'sovereign-production', title: 'Sovereign creative production', src: 'sovereign-production.md', pathway: 'operators', description: "Creative production with no server in the render path: air-gapped deployment, consent-gated networking, on-device signing and the tools as files you hold." },
  { slug: 'security',         title: 'Security & Verification', src: 'security-verification.md', pathway: 'trust', description: "The cryptography behind Lolly's Content Credentials, verification and encryption, summarised for a security reviewer with the limits stated as clearly as the guarantees." },
  { slug: 'threat-model',     title: 'Threat Model & Trust Boundaries', src: 'threat-model.md', pathway: 'trust', description: "What Lolly defends against, what it explicitly does not, and where each trust boundary sits. Written for reviewers who need the limits stated as plainly as the protections." },
  { slug: 'parser-inventory', title: 'Parser Inventory',  src: 'parser-inventory.md', pathway: 'trust' },
  { slug: 'server-surface',   title: 'Server Surface',    src: 'server-surface.md',  pathway: 'trust', description: "The complete inventory of what a Lolly server does and does not see, component by component, so you can audit the whole network surface in one sitting." },
  { slug: 'verify-yourself',  title: 'Verify It Yourself', src: 'verify-yourself.md', pathway: 'trust', description: "Check this site's claims against a real export, step by step. No account, no trust required, and nothing you cannot run yourself." },
  { slug: 'privacy',          title: 'Privacy Policy',    src: 'privacy.md',         pathway: 'trust' },
  { slug: 'inclusive-design', title: 'Inclusive Design',  src: 'inclusive-design.md', pathway: 'trust', description: "Accessibility, language coverage and the ethical commitments Lolly holds itself to, with the tests that fail the build when one is broken." },
  { slug: 'ai-stance',        title: 'Our AI Stance',     src: 'ai-stance.md',       pathway: 'trust', description: "AI is welcome as labour and refused as impersonation. Where Lolly stands on generated content, and the machinery that enforces each commitment." },
  { slug: 'ai-features',      title: 'Generated once, rendered the same', src: 'ai-features.md', pathway: 'trust', description: "Text-to-speech, upscaling and background removal: generated once under guard-rails, then rendered identically everywhere. Why inventing pixels is marked AI and removing them is not." },
  { slug: 'eu-ai-act',        title: 'AI marking and the EU AI Act', src: 'eu-ai-act.md', pathway: 'trust', description: "Article 50 has applied since 2 August 2026, and its Code of Practice points at C2PA. Lolly's honest fit: it preserves arriving AI marks, declares its own AI operations and verifies files on-device." },
  { slug: 'beatrice-warde',   title: 'Beatrice Warde',    src: 'beatrice-warde.md',  pathway: 'trust', description: "The typographer whose 1932 lines this project adapted, who proved that the types the whole trade called Garamond had been cut by somebody else entirely." },
  { slug: 'shoulders-of-giants', title: 'Shoulders of giants', src: 'shoulders-of-giants.md', pathway: 'trust', description: "The open source projects Lolly is built from, named and thanked: three decades of free-desktop text shaping, speech and formats, and the newer giants beside them." },
];

// ── Door-structured URLs (plans/177 P1) ──────────────────────────────────────
// Every hand-authored page lives under its pathway's DOOR directory as a real
// file: /info/<door>/<slug>.html (locales: /info/<lang>/<door>/<slug>.html).
// The landing stays at /info/, and the generated side doors keep their frozen
// directory URLs (formats/…, convert/… are the adoption engine, never moved).
// Derived from the one `pages` registry so URL, nav, sidebar, search, sitemap
// and stubs cannot disagree about which door a page is behind. The old flat
// URL of every doored page gets a meta-refresh stub for one release cycle
// (appended to `stubs` below); delete that loop to end the grace period.
const DOOR: Record<Pathway, string> = {
  quickstart: 'start',
  creators:   'create',
  builders:   'build',
  operators:  'operate',
  trust:      'trust',
};
const DOOR_DIRS = new Set(Object.values(DOOR));
// slug → door directory, from the registry.
const PAGE_DOOR: Record<string, string> = Object.fromEntries(
  pages.filter(p => !p.isLanding && p.pathway).map(p => [p.slug, DOOR[p.pathway!]]),
);
/** The path form of a page slug: 'create/using' for doored pages, bare otherwise. */
function pathSlug(slug: string): string {
  return PAGE_DOOR[slug] ? `${PAGE_DOOR[slug]}/${slug}` : slug;
}
for (const p of pages) {
  if (PAGE_DOOR[p.slug]) stubs.push({ slug: p.slug, target: `/info/${pathSlug(p.slug)}.html` });
}
/**
 * Rewrite the flat internal links a page's rendered HTML carries (hand-authored
 * markdown cross-links, JSON content hrefs, template literals) to the doored
 * URLs, in one pass over the final document - so no source file needs its links
 * rewritten and the markdown twins stay verbatim. Locale-prefixed links keep
 * their prefix. Runs on every written page; the flat-URL stubs remain the net
 * under anything this pass cannot see (external references, bookmarks).
 */
function doorizeLinks(html: string): string {
  const langAlt = LANGS.filter(l => l !== 'en').join('|');
  const re = new RegExp(`/info/((?:${langAlt})/)?([\\w-]+)\\.html`, 'g');
  return html.replace(re, (m, langPrefix: string | undefined, slug: string) =>
    PAGE_DOOR[slug] ? `/info/${langPrefix ?? ''}${pathSlug(slug)}.html` : m);
}

/**
 * Which page opens on which BANKED masthead - `slug → docs/mastheads/<id>` (plans/105 section 6).
 *
 * Empty, and that is the shipped state: the default band (the chip field behind the
 * h1, `docsMasthead` below) is every page's masthead until a real artifact is banked
 * and signed, which is Andy's hand and not a build step's. An id here overrides the
 * default for that page in ALL 27 locales at once - the table is chrome, so no .md
 * changes, no front matter, and nothing for `propagate-shot-recipes` to keep in step.
 *
 * The id is PERMANENT once banked, exactly like an asset id: the bank is a reusable
 * library, several pages may point at one artifact, and versioning lives in the
 * manifest, never in the filename.
 *
 * A mapped id with nothing behind it warns and falls back to the default band, so a
 * checkout without the bank (or a typo) never ships a page with no top.
 */
const MASTHEADS: Record<string, string> = {
  // The first banked masthead: the Sensory Mixer (Gemini artwork, Andy-directed,
  // adapted to the band contract) - the inclusive-design page's stimulation dial.
  'inclusive-design': 'inclusive-sensory',
  // Input, not impersonation: a fluid input wave forced to part around a rigid,
  // unforgeable identity seal (Gemini artwork, Andy-directed).
  'input-not-impersonation': 'input-not-impersonation',
  // Status quo ("the trade we never agreed to"): rigid tectonic slabs grinding
  // along a friction fault line (Gemini artwork, Andy-directed).
  'status-quo': 'status-quo',
  // Our AI stance ("channels, not buckets"): a flood turned to irrigation - water
  // running the channels into growth (Gemini artwork, Andy-directed).
  'ai-stance': 'ai-stance',
  // For Creators ("one seed, many lanes"): one input fanning into guard-railed
  // lanes of aligned on-brand outputs. Artwork by Claude Fable 5, directed by
  // Claude Opus 4.8 - an AI directing an AI, both disclosed in the credential.
  'creators': 'creators',
  // Verify It Yourself: opaque unverified rings vs a hard-edged green cryptographic
  // lens revealing the verified state (Gemini artwork, Andy-directed).
  'verify-yourself': 'verify-yourself',
  // Working together ("confluence"): four colour streams merging into one flow.
  // Artwork by GLM-5.2 (z.ai), Andy-directed.
  'collaborate': 'collaborate',
  // The five below: AI-directed (Claude Opus 4.8) art by Claude Fable 5 / Sonnet 5.
  'quickstart': 'quickstart',   // facet on-ramp - sparse inputs clicking into a whole (Fable 5)
  'builders': 'builders',       // one module stamping into an aligned grid of copies (Sonnet 5)
  'operators': 'operators',     // governed deploy-wave across a framed grid (Sonnet 5)
  'url-mode': 'url-mode',        // one encoded line resolving to an exact render (Fable 5)
  'overview': 'overview',        // one core pulsing through many distinct shells (Sonnet 5)
  // Trust pathway + MCP - AI-directed (Claude Opus 4.8) art by Claude Sonnet 5 / Fable 5.
  'privacy': 'privacy',                     // protected interior, nothing leaves (Sonnet 5)
  'ai-features': 'ai-features',             // flux crystallising to a fixed artifact (Fable 5)
  'security': 'security',                   // guilloché security engraving (Sonnet 5)
  'threat-model': 'threat-model',           // defended boundary, probes deflect (Fable 5)
  'content-credentials-identity': 'content-credentials-identity',       // anonymous mark rising through trust tiers (Sonnet 5)
  'content-credentials-engineering': 'content-credentials-engineering', // nested manifest container tree (Fable 5)
  'server-surface': 'server-surface',       // negative space, one minimal footprint (Sonnet 5)
  'parser-inventory': 'parser-inventory',   // chaotic bytes tamed into ordered rows (Fable 5)
  'beatrice-warde': 'beatrice-warde',       // the Crystal Goblet - clarity through glass (Sonnet 5)
  'mcp': 'mcp',                             // one port, bidirectional call-and-return (Fable 5)
};

// Top-nav links, grouped into clusters. Each inner array renders as one cluster
// (tight spacing); clusters are separated by a divider (see .nav-group CSS). Home
// is intentionally omitted - the brand wordmark already links to /info/index.html.
interface NavLink {
  label: string;
  href: string;
}

// Simplified top nav: the one primary article + the three pathways. Each nav link
// maps to a pathway (via NAV_PATHWAY below) so the hub highlights on any child page,
// not only on the hub itself.
const NAV: NavLink[][] = [
  [ { label: 'Quickstart',    href: '/info/quickstart.html' } ],
  [ { label: 'For Creators',  href: '/info/creators.html' },
    { label: 'For Builders',  href: '/info/builders.html' },
    { label: 'For Operators', href: '/info/operators.html' } ],
  // Trust is its own top-level destination, not a subsection of an audience. The
  // provenance/privacy/security docs are the ones a sceptical reader comes looking
  // for FIRST, and they answer the same questions whoever is asking - buried under
  // "For Operators" they were only findable by someone who already self-identified
  // as one.
  [ { label: 'Trust', href: '/info/trust.html' } ],
];
// href → pathway, so a child page (e.g. host-api) lights up its hub's nav link.
const NAV_PATHWAY: Record<string, Pathway> = {
  '/info/quickstart.html': 'quickstart',
  '/info/creators.html':   'creators',
  '/info/builders.html':   'builders',
  '/info/operators.html':  'operators',
  '/info/trust.html':      'trust',
};

// The docs sidebar, per pathway. Each group is a labelled cluster of links; the
// first item of the first group is the pathway hub itself. Slugs must exist in
// `pages` (or `stubs`). A page can appear in more than one pathway's sidebar
// (e.g. Content Credentials is builder + operator) - its own `pathway` only picks
// which sidebar renders when you're viewing it.
interface SideItem { slug: string; label: string; }
interface SideGroup { label: string; items: SideItem[]; }
const SIDEBARS: Record<Pathway, { title: string; groups: SideGroup[] }> = {
  quickstart: {
    title: 'Quickstart',
    groups: [
      { label: 'Start here', items: [
        { slug: 'make-something', label: 'Make something' },
        { slug: 'quickstart',     label: 'Quickstart' },
        { slug: 'install',        label: 'Install Lolly' },
        { slug: 'faq',            label: 'Questions & answers' } ] },
      { label: 'Then pick a path', items: [
        { slug: 'creators',  label: 'For Creators' },
        { slug: 'builders',  label: 'For Builders' },
        { slug: 'operators', label: 'For Operators' },
        { slug: 'trust',     label: 'Trust' } ] },
    ],
  },
  // The creators rail used to be one six-item "Make things" group with everything in
  // it, and adding collab/search/favourites would have taken it to nine - a flat list
  // long enough that its shape stopped telling a reader anything. Split by what the
  // reader is trying to DO, kindred pages together: the surfaces you make in, the ways
  // back to your own things, and getting work out of the app to other people.
  creators: {
    title: 'For Creators',
    groups: [
      { label: 'Creators', items: [
        { slug: 'creators',   label: 'Why Lolly' },
        { slug: 'quickstart', label: 'Quickstart' } ] },
      // The lane groups mirror the landing's persona side tabs (plans/177:
      // Make / Animate / Collaborate / Post), so the door and this rail are one
      // mental model. Record has no page of its own - Using Lolly carries it.
      { label: 'Make', items: [
        { slug: 'using',           label: 'Using Lolly' },
        { slug: 'brand-studio',    label: 'The Brand Studio' },
        { slug: 'design-import',   label: 'Import a design' },
        { slug: 'utilities',       label: 'Utility views' },
        { slug: 'extension',       label: 'Browser Extension' } ] },
      { label: 'Animate', items: [
        { slug: 'sequence-editor', label: 'The sequence editor' },
        { slug: 'animating',       label: 'Animating' } ] },
      // Search, favourites and the profile are the three pages about getting back to
      // your own things - finding them, keeping them to hand, and the on-device record
      // both of the other two are written onto.
      { label: 'Find your way', items: [
        { slug: 'search',      label: 'Search' },
        { slug: 'ask',         label: 'Ask Lolly' },
        { slug: 'dashboard',   label: 'The Dashboard' },
        { slug: 'favourites',  label: 'Your favourites' },
        { slug: 'profile',     label: 'Your profile' } ] },
      { label: 'Collaborate', items: [
        { slug: 'collaborate', label: 'Working together' } ] },
      { label: 'Post', items: [
        { slug: 'formats',     label: 'What Lolly opens and makes' },
        { slug: 'exporting',   label: 'Exporting a file' } ] },
      { label: 'Compare', items: [
        { slug: 'positioning', label: 'How Lolly compares' },
        { slug: 'compare',     label: 'Tool by tool' },
        { slug: 'compare-canva',         label: 'and Canva' },
        { slug: 'compare-adobe',         label: 'and Adobe' },
        { slug: 'compare-figma',         label: 'and Figma' },
        { slug: 'compare-penpot',        label: 'and Penpot' },
        { slug: 'compare-render-apis',   label: 'and rendering APIs' },
        { slug: 'compare-brand-portals', label: 'and brand portals' },
        { slug: 'compare-converters',    label: 'and online converters' } ] },
    ],
  },
  builders: {
    title: 'For Builders',
    groups: [
      { label: 'Builders', items: [
        { slug: 'builders',   label: 'Overview' },
        { slug: 'quickstart', label: 'Quickstart' } ] },
      { label: 'Architecture', items: [
        { slug: 'overview',      label: 'Architecture' },
        { slug: 'design-tokens', label: 'Design Tokens' } ] },
      // The three concept pages: each takes one term the landing states in plain
      // words and shows the mechanism, the receipts and the limits (plan 117 section 2).
      { label: 'Concepts', items: [
        { slug: 'constraints',     label: 'Constraints' },
        { slug: 'determinism',     label: 'Determinism' },
        { slug: 'reproducibility', label: 'Reproducibility' } ] },
      { label: 'Author tools', items: [
        { slug: 'authoring-tools',  label: 'Authoring Tools' },
        { slug: 'authoring-assets', label: 'Authoring Assets' },
        { slug: 'host-api',         label: 'Host API' },
        { slug: 'url-mode',         label: 'URL Mode' } ] },
      { label: 'Run & integrate', items: [
        { slug: 'cli',         label: 'CLI' },
        { slug: 'cli-signing', label: 'Signing from the terminal' },
        { slug: 'tui',       label: 'Terminal (TUI)' },
        { slug: 'mcp',       label: 'MCP Server' },
        { slug: 'ai-agents', label: 'AI Agents' },
        { slug: 'extension', label: 'Browser Extension' } ] },
      { label: 'Ship & operate', items: [
        { slug: 'contributing-setup', label: 'Contributing setup' },
        { slug: 'build-guide',   label: 'Build Guide' },
        { slug: 'ios-build',     label: 'Building for iOS' },
        { slug: 'deployment',    label: 'Deployment' },
        { slug: 'configuration', label: 'Configuration' },
        { slug: 'about',         label: 'About' } ] },
      { label: 'Trust & data', items: [
        { slug: 'content-credentials-identity', label: 'Content Credentials' },
        { slug: 'security',      label: 'Security & Verification' },
        { slug: 'threat-model',     label: 'Threat Model' },
        { slug: 'parser-inventory', label: 'Every parser we run' },
        { slug: 'data-transfer', label: 'Backup file format' } ] },
    ],
  },
  operators: {
    title: 'For Operators',
    groups: [
      { label: 'Operators', items: [
        { slug: 'operators',  label: 'Overview' },
        { slug: 'quickstart', label: 'Quickstart' } ] },
      // The function playbooks (plans/177): the landing's Operators pane links
      // straight into these.
      { label: 'Playbooks', items: [
        { slug: 'sales',     label: 'For sales teams' },
        { slug: 'press',     label: 'For the newsroom' },
        { slug: 'marketing', label: 'For marketing teams' },
        { slug: 'legal',     label: 'For legal teams' } ] },
      { label: 'Adopt & govern', items: [
        { slug: 'adoption-governance', label: 'Adoption & Governance' },
        { slug: 'sovereign-production', label: 'Sovereign production' },
        { slug: 'deployment',    label: 'Deployment' },
        { slug: 'configuration', label: 'Configuration' },
        { slug: 'build-guide',   label: 'Build Guide' } ] },
      { label: 'Trust', items: [
        { slug: 'trust',    label: 'Trust overview' },
        { slug: 'security', label: 'Security & Verification' },
        { slug: 'verify-yourself', label: 'Verify It Yourself' },
        { slug: 'threat-model',    label: 'Threat Model' },
        { slug: 'server-surface',  label: 'What a server sees' },
        { slug: 'parser-inventory', label: 'Every parser we run' },
        { slug: 'cli-signing', label: 'Signing from the terminal' },
        { slug: 'privacy',  label: 'Privacy Policy' } ] },
    ],
  },
  // The trust rail is tiered by reader (2026-08-16): the lay essays first, the
  // hands-on check next, the reviewer references clearly labelled as such, and an
  // exit group so a convinced reviewer has a next step instead of a cul-de-sac.
  trust: {
    title: 'Trust',
    groups: [
      { label: 'Trust', items: [
        { slug: 'trust',            label: 'Overview' },
        { slug: 'status-quo',       label: 'Why this differs' },
        { slug: 'inclusive-design', label: 'Inclusive Design' } ] },
      { label: 'Where content comes from', items: [
        { slug: 'input-not-impersonation',      label: 'Input, not impersonation' },
        { slug: 'content-credentials-identity', label: 'Content Credentials' },
        { slug: 'ai-stance',                    label: 'Our AI Stance' },
        { slug: 'ai-features',                  label: 'AI features' },
        { slug: 'eu-ai-act',                    label: 'The EU AI Act' },
        { slug: 'beatrice-warde',               label: 'Beatrice Warde' },
        { slug: 'shoulders-of-giants',          label: 'Shoulders of giants' } ] },
      { label: 'Check it yourself', items: [
        { slug: 'verify-yourself', label: 'Verify It Yourself' },
        { slug: 'security',        label: 'Security & Verification' } ] },
      { label: 'For reviewers', items: [
        { slug: 'threat-model',     label: 'Threat Model' },
        { slug: 'parser-inventory', label: 'Every parser we run' },
        { slug: 'server-surface',   label: 'What a server sees' },
        { slug: 'content-credentials-engineering', label: 'Content Credentials - Engineering' } ] },
      { label: 'Your data', items: [
        { slug: 'privacy',       label: 'Privacy Policy' },
        { slug: 'data-transfer', label: 'Backup file format' } ] },
      { label: 'Roll it out', items: [
        { slug: 'adoption-governance',  label: 'Adoption & Governance' },
        { slug: 'sovereign-production', label: 'Sovereign production' },
        { slug: 'deployment',           label: 'Deployment' } ] },
    ],
  },
};

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

function getBulletIcon(raw: string) {
  const t = raw.toLowerCase();
  if (t.includes('real studio'))                                          return BICONS.star;
  if (t.includes('hdr') || t.includes('spot colour'))                     return BICONS.sliders;
  if (t.includes('finished work'))                                        return BICONS.image;
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
  link:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  folder:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  canvas:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 7.07 17 2.51-7.42L21 11.09z"/></svg>`,
  shield:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
};

function getPlatformIcon(title: string) {
  const t = title.toLowerCase();
  // Specific feature keywords first, so a word like "free" in "Free-canvas layout"
  // doesn't shadow the more specific canvas/link/folder icons.
  if (t.includes('credential') || t.includes('authentic') || t.includes('provenance')) return PICONS.shield;
  if (t.includes('link') || t.includes('share'))       return PICONS.link;
  if (t.includes('organise') || t.includes('folder') || t.includes('bulk')) return PICONS.folder;
  if (t.includes('canvas') || t.includes('layout'))    return PICONS.canvas;
  if (t.includes('offline'))                           return PICONS.offline;
  if (t.includes('everywhere') || t.includes('works')) return PICONS.devices;
  if (t.includes('free') || t.includes('open'))        return PICONS.star;
  if (t.includes('format') || t.includes('huge'))      return PICONS.layers;
  if (t.includes('production') || t.includes('quality') || t.includes('studio')) return PICONS.film;
  return PICONS.zap;
}

function getIcon(h2: string) {
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

function tabLabel(h2: string) {
  const t = h2.toLowerCase();
  if (t.startsWith('ai'))                              return 'AI';
  if (t.startsWith('it') || t.includes('security'))   return 'IT & Sec';
  if (t.includes('media') || t.includes('creativ'))   return 'Creatives';
  if (t.includes('journal'))                          return 'Press';
  return h2.split(/[\s,&]+/)[0]!;
}

function toSlug(h2: string) {
  const t = h2.toLowerCase();
  if (t.includes('journal'))                          return 'press';
  if (t.includes('media') || t.includes('creativ'))  return 'creatives';
  if (t.startsWith('ai') || t.includes('agent'))     return 'ai';
  if (t.startsWith('it') || t.includes('security'))  return 'it';
  return t.split(/\W+/)[0]!;
}

// ── Markdown helpers ──────────────────────────────────────────────────────────

// PROV_SEAL, parseCells, headingId, CONTENT_TOKEN + stripAuthoringComments now live
// in @lolly-tools/docs-render (imported above) - pure helpers the in-app renderer needs too.

// inline() binds the build-time docCtx to the shared renderer (@lolly-tools/docs-render).
// The pass order, the darkFor channel and every impure-fact source now live in the package;
// this wrapper keeps build.ts's ~17 inline() call sites (buildLandingContent) unchanged.
function inline(text: string): string {
  return pkgInline(text, docCtx);
}

/**
 * Every screenshot recipe on the site, keyed by the slug it captures.
 *
 * The recipe is the shot's other half of the record: the .md holds the url-shot link
 * the pipeline captured from, so capture size, dpi and which renderer drew it are
 * facts about the file that the file itself does not carry. inline() parses that
 * query and throws it away 50 lines before the credential is emitted, and by then
 * only the resolved filename survives - so the credential reads the recipes back off
 * the pages, once, and looks its own slug up.
 *
 * Parsed by the SHOTS PIPELINE's parser (scripts/lib/shot-compare.ts), not a local
 * one: a credential that described a capture in different terms from the capture
 * would be a second opinion, and the first one is the one that ran. Recipe problems
 * are that pipeline's to report - here a slug that does not resolve simply means the
 * capture facts are left off the line.
 */
let shotRecipes: Map<string, ShotDef> | null = null;
function shotRecipe(slug: string): ShotDef | null {
  if (!shotRecipes) {
    shotRecipes = new Map();
    for (const f of readdirSync(__dirname).filter(n => n.endsWith('.md'))) {
      try {
        // Raw source, before inline()'s escaping: the parser's regex expects the
        // query's literal `&`.
        for (const r of parseShotRecipes(readFileSync(resolve(__dirname, f), 'utf-8')).recipes) {
          if (!shotRecipes.has(r.slug)) shotRecipes.set(r.slug, r);
        }
      } catch { /* an unreadable page costs its shots their capture pill, nothing more */ }
    }
  }
  return shotRecipes.get(slug) ?? null;
}

// localeNum + approxCount now live in @lolly-tools/docs-render (they take htmlLang as a
// param there); the credential assembly is the only thing that used them and it moved too.

/**
 * The credential line a screenshot carries: a photo-credit in the corner, except
 * the credit is checkable.
 *
 * Deliberately almost invisible. At rest it is one small imprint glyph at low
 * opacity - the same weight a photographer's byline carries in a magazine, which
 * readers are practised at skimming past. It only becomes words on hover, focus or
 * tap. Every shot on the site was made the same way, so a permanently visible line
 * on all 155 would be noise repeated 155 times; the people who go looking are the
 * people it convinces.
 *
 * The facts come from the file's own manifest (docs/shot-provenance.ts), never from
 * anything hardcoded here, and the two links act on the SERVED FILE:
 *   - verify   → #/verify?src=/info/shots/<file>, the shell's same-origin verify
 *                path, which fetches those bytes and checks them on the reader's
 *                machine. The site never marks its own homework.
 *   - download → the signed file itself, so the credential can be taken elsewhere
 *                (c2patool, Content Credentials Verify) and checked independently.
 *
 * A shot whose credential will not decode gets NO line, rather than a line that
 * implies more than the file can back up.
 *
 * The second row (paths, groups, embedded images, KB) is the same idea pointed at the
 * artwork rather than at its signature: it says what the file IS. Every one of these
 * screenshots is a vector document, and the corpus lost 50% of its weight moving from
 * the print path to the walker, so "134 paths, 484 KB" is the claim in numbers a reader
 * can check against the bytes they were served. Every pill is a property of those bytes
 * - the recipe's capture viewport is NOT here, because it describes the request rather
 * than the file and disagrees with the shipped artwork on most shots; it lives in the
 * accessible label as context instead. The row appears only in the expanded state,
 * which is the whole line's state - see the CSS - and the line is bottom-anchored so
 * its second row never moves the resting glyph.
 */
// shotTryLink now lives in @lolly-tools/docs-render's render.ts (as `shotTry`, driven by
// docCtx.tryLink) - inline() moved with it, and nothing else in build.ts used it.

let credSeq = 0;
// The credential's HTML assembly now lives in @lolly-tools/docs-render's renderCredential
// (shared with the in-app docs view); the FACTS come from docCtx.credential, read off the
// served bytes. `from` names a page ASSET (mascot, hero) or banked ART; a bare shot passes
// none. This thin wrapper keeps every call site unchanged.
function shotCredential(file: string, extraClass = '', from?: { path: string; src: string; art?: boolean }): string {
  const facts = docCtx.credential(file, from ? { assetSrc: from.src, art: from.art } : undefined);
  return renderCredential(facts, { file, extraClass, fromPresent: !!from }, docCtx);
}

/**
 * A landing-page mascot wrapped with its own Content Credential - the same imprint glyph
 * + verify/download the docs screenshots carry, read from the served file. The inline()
 * asset-cred rewrite only sees markdown; the landing template emits raw HTML, so this is
 * its equivalent. `cls` is the mascot's sizing class (width / flex / drop-shadow); it moves
 * onto the WRAPPER so the img can fill it 100% and the credential can position against it.
 * Every image on the /info site becoming a live demonstration of the provenance chain is
 * the point (see plans + the mascot-provenance note): a site that argues AI should declare
 * itself should not ship undeclared stock art. A file with no readable credential still
 * renders - just as a plain img, without a line.
 */
function credentialedMascot(src: string, cls: string, alt = ''): string {
  const file = src.replace(/^\/info\//, '');
  const path = resolve(outDir, file);
  const size = shotSize(file, path);
  const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
  // Rests CLOSED like a screenshot's credit (glyph only, expands on hover / focus / tap),
  // NOT open like the AI-stance hero: a mascot sits in a narrow flex slot, so an
  // always-open line would overflow the artwork. This is the "same imprint as the
  // screenshots" the brief asked for. shot-cred--mascot is a positioning hook only - 
  // it does NOT contain 'shot-cred--asset', so shotCredential leaves restsOpen false.
  const cred = shotCredential(file, 'shot-cred--mascot', { path, src });
  // No readable credential → the plain mascot it was before, sizing class on the img.
  if (!cred) return `<img src="${src}"${dims} alt="${esc(alt)}" class="${esc(cls)}" loading="lazy"${alt ? '' : ' aria-hidden="true"'}>`;
  // Wrapper carries the sizing class; the img fills it (mascot-cred>img is width:100%).
  return `<span class="mascot-cred ${esc(cls)}" data-shot="${src}">`
    + `<img src="${src}"${dims} alt="${esc(alt)}" loading="lazy"${alt ? '' : ' aria-hidden="true"'}>`
    + `${cred}</span>`;
}

/**
 * A screenshot's intrinsic pixel size, read straight out of the committed file.
 *
 * This is required, not a nicety. `.shot` is `width:fit-content`, so with a
 * `loading="lazy"` image that has no declared size the wrapper lays out 0×0 - and
 * a zero-area box never comes near the viewport, so the image never loads, so the
 * box never gains size. A deadlock that silently leaves every screenshot on the
 * site invisible (it did, before these attributes existed). Declaring width/height
 * also gives the reader reserved space instead of the page jumping as shots arrive.
 *
 * Cached across the 27-locale build: the same handful of files would otherwise be
 * re-read for every page in every language.
 */
const shotSizeCache = new Map<string, { w: number; h: number } | null>();
function shotSize(file: string, from?: string): { w: number; h: number } | null {
  const path = from ?? resolve(__dirname, 'shots', file);
  const hit = shotSizeCache.get(path);
  if (hit !== undefined) return hit;
  const out = (() => {
    if (!existsSync(path)) return null;
    if (file.endsWith('.svg')) {
      // The walker writes width/height in px on the root; fall back to the viewBox
      // extent, which is the same number for every shot the pipeline produces.
      const head = readFileSync(path, 'utf-8').slice(0, 2048);
      const w = Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(head)?.[1]);
      const h = Number(/<svg[^>]*\sheight="([\d.]+)"/.exec(head)?.[1]);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w: Math.round(w), h: Math.round(h) };
      const vb = /viewBox="([\d.\-\s]+)"/.exec(head)?.[1]?.trim().split(/\s+/).map(Number);
      if (vb?.length === 4 && vb[2]! > 0 && vb[3]! > 0) return { w: Math.round(vb[2]!), h: Math.round(vb[3]!) };
      return null;
    }
    const b = readFileSync(path);
    // PNG: IHDR is always the first chunk, width/height as big-endian u32.
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    // JPEG: walk the marker segments to the first SOF (0xC0-0xCF, excluding the
    // non-frame markers C4/C8/CC) and read the frame's dimensions.
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1]!;
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    // WebP: RIFF container. VP8X carries the canvas size as two 24-bit LE
    // minus-ones; the plain lossy (VP8 ) and lossless (VP8L) chunks each pack it
    // their own way. Page artwork arrives as WebP (the AI stance hero), and an
    // image with no declared size is the 0x0 deadlock described above.
    if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
      const chunk = b.toString('latin1', 12, 16);
      if (chunk === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
      if (chunk === 'VP8L' && b[20] === 0x2f) {
        const n = b.readUInt32LE(21);
        return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8 ' && b.length > 30) {
        return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      }
    }
    return null;
  })();
  shotSizeCache.set(path, out);
  if (!out) console.warn(`⚠  ${path}: could not read intrinsic size - the image will not reserve space and may not settle`);
  return out;
}

/**
 * `::: showcase` - the one screenshot on the site that is INLINED as live SVG
 * rather than served through an <img>, so scroll can drive its real `viewBox`.
 *
 * Why this exists: Blink rasterises an SVG <img> at whatever scale it is
 * composited, so the moment you zoom or pan one it goes soft - the one thing the
 * docs most want to demonstrate (that these screenshots are geometry, not pixels)
 * is exactly the thing an <img> cannot show under motion. Animating a viewBox on
 * inlined SVG is a true camera move
 * over the geometry: nothing re-rasterises, and because the captured strokes carry
 * `vector-effect="non-scaling-stroke"`, they stay hairline at every zoom the way a
 * CAD viewer does. A bitmap cannot fake either property.
 *
 * PROVENANCE - the important part. Inlining takes the FILE off the page, and a
 * C2PA hash binding covers file bytes, not DOM. Two consequences, both handled:
 *
 *  1. The manifest is STRIPPED from the inlined copy. Left in, a reader who saved
 *     the inline markup out of devtools would hold a file whose credential fails to
 *     validate - a false negative on a genuine Lolly asset, which is worse than no
 *     credential at all.
 *  2. The signed file is still served at /info/shots/<slug>.svg and the credential
 *     line points at it, so "verify" and "download" both act on the real bytes.
 *     The inline copy is presentation; the file remains the record.
 *
 * WHY THE INLINING HAPPENS AT RUNTIME, not here. Emitting the SVG into the page
 * took exporting.html from 35 KB to 285 KB gzipped - a quarter-megabyte of
 * BLOCKING markup charged to every reader, scroll that far or not, neither lazily
 * loaded nor cacheable apart from the page. So the build emits the ordinary <img>
 * and SHOWCASE_SCRIPT swaps in live SVG when the block first approaches the
 * viewport. The file was going to be fetched anyway, so the motion costs no extra
 * bytes - and the geometry being animated is then literally the signed file's own,
 * parsed from the exact bytes the credential covers.
 *
 * With no JS the <img> simply stays: the finished artwork, no motion, no penalty.
 *
 * The block wraps an ordinary url-shot recipe line, so the shot pipeline
 * (scripts/build-docs-shots.ts, which regex-scans every docs page) still captures,
 * compares and credentials it exactly like the other 154.
 */
// buildShowcase (::: showcase) now lives in @lolly-tools/docs-render's render.ts, driven by
// docCtx.showcase; mdToHtml moved with it.

// parseCells + headingId now live in @lolly-tools/docs-render (imported above).

// ── Search index ─────────────────────────────────────────────────────────────
// One record per SECTION, not per page: 41 pages is a list you can read, but the
// thing a reader actually wants is the paragraph, and a page like authoring-tools
// is 773 lines across 16 sections. Built from the RENDERED HTML rather than the
// markdown so the anchors are the ids that exist on the page by construction - 
// re-deriving them from the source would be a second implementation of
// headingId() free to drift from the first.
//
// Keys are short because this file ships 27 times (once per locale) and is fetched
// by the reader: p=page slug, t=page title, h=heading, a=anchor, x=text.
interface SearchRecord { p: string; t: string; h: string; a: string; x: string; i: string }

/** Longest section body kept per record. The lead of a section carries almost all
 *  of its search signal, and an uncapped index is ~4x the size for the tail. */
const SEARCH_SNIPPET_MAX = 240;

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

/** Rendered HTML → the plain text a human reads, collapsed onto one line. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (e) => HTML_ENTITIES[e.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split one rendered page into per-heading search records. */
function indexSections(html: string, slug: string, title: string): SearchRecord[] {
  const records: SearchRecord[] = [];
  // The page's sidebar glyph (SIDEBAR_ICON), carried on every record so a
  // consumer can distinguish sections by which page they came from - the app's
  // spotlight Docs group renders it instead of one generic help icon (plans/103).
  // '' where a page has no sidebar icon; the consumer falls back.
  const i = SIDEBAR_ICON[slug] ?? '';
  const heading = /<h([2-4])\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g;
  const push = (h: string, a: string, body: string) => {
    const x = htmlToText(body).slice(0, SEARCH_SNIPPET_MAX);
    // A heading with no prose under it is still worth finding - it is a place in
    // the document. One with neither heading nor body is not.
    if (h || x) records.push({ p: slug, t: title, h, a, x, i });
  };

  const marks: Array<{ h: string; a: string; start: number; end: number }> = [];
  for (let m = heading.exec(html); m; m = heading.exec(html)) {
    marks.push({ h: htmlToText(m[3]!), a: m[2]!, start: m.index, end: heading.lastIndex });
  }

  // Everything above the first heading belongs to the page itself - on most pages
  // that intro is the best one-line answer to "what is this page".
  push('', '', html.slice(0, marks.length ? marks[0]!.start : html.length));
  marks.forEach((mark, n) => {
    const next = marks[n + 1];
    push(mark.h, mark.a, html.slice(mark.end, next ? next.start : html.length));
  });
  return records;
}

// CONTENT_TOKEN + stripAuthoringComments now live in @lolly-tools/docs-render (imported above).

// mdToHtml() binds the build-time docCtx to the shared block renderer
// (@lolly-tools/docs-render). The block loop, the ::: fence dispatch (cols/timeline/
// showcase/figure) and headingOrdinal locality now live in the package; this wrapper keeps
// build.ts's mdToHtml(md) call sites (page render, FAQ, opensource, landing) unchanged.
function mdToHtml(md: string): string {
  return pkgMdToHtml(md, docCtx);
}

// ── FAQ source ────────────────────────────────────────────────────────────────
// FAQs are authored in docs/faq.md so they can be maintained without touching this
// build script. Each `##` heading is a question; the lines beneath it (up to the
// next `##`) are the answer, in the same lightweight markdown the rest of the site
// uses. Everything before the first `##` (title + maintainer notes) is ignored.
function loadFaqs(lang: Lang = 'en') {
  const localized = lang !== 'en' ? resolve(__dirname, 'i18n', lang, 'faq.md') : null;
  const md = readFileSync(localized && existsSync(localized) ? localized : resolve(__dirname, 'faq.md'), 'utf8');
  const faqs: { q: string; a: string }[] = [];
  let cur: { q: string; a: string[] } | null = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      if (cur) faqs.push({ q: cur.q, a: cur.a.join('\n').trim() });
      cur = { q: m[1]!.trim(), a: [] };
    } else if (cur) {
      cur.a.push(line);
    }
  }
  if (cur) faqs.push({ q: cur.q, a: cur.a.join('\n').trim() });
  return faqs;
}

// ── Landing content files (docs/site/*.{json,md}) ────────────────────────────
// The landing page's copy - headings, leads, card text - lives in these files so
// editing it never touches this build script. Bespoke SVG icons/illustrations
// stay in code (SITE_ICONS below) since they're graphics, not content a
// non-developer edits; content files reference them by string key.
// Locale-aware: a `docs/i18n/<lang>/site/<name>` translation is used when present,
// else the English source at `docs/site/<name>` (fallback, not a 404 - same
// contract as resolvePageSrc/loadFaqs).
function siteContentPath(name: string, lang: Lang): string {
  if (lang !== 'en') {
    const localized = resolve(__dirname, 'i18n', lang, 'site', name);
    if (existsSync(localized)) return localized;
  }
  return resolve(__dirname, 'site', name);
}
function loadSiteJson(name: string, lang: Lang = 'en'): any {
  return JSON.parse(readFileSync(siteContentPath(name, lang), 'utf8'));
}
// `\n` in a JSON string field becomes a literal <br> - the convention every
// multi-line heading/copy field in docs/site/*.json uses.
const br = (s: string) => esc(s).replace(/\n/g, '<br>');

const SITE_ICON_S = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
const SITE_ICON_S18 = `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

// Every bespoke icon the landing content files reference by key. Consolidates
// what used to be a dozen scattered `IC_*`/local-array consts inside
// buildLandingContent so a content file can name an icon without any code nearby.
const SITE_ICONS: Record<string, string> = {
  // why-section frustrations
  anxiety: `<svg viewBox="0 0 24 24" ${SITE_ICON_S18}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  bottleneck: `<svg viewBox="0 0 24 24" ${SITE_ICON_S18}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  cloudDependence: `<svg viewBox="0 0 24 24" ${SITE_ICON_S18}><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.3 8.4"/><path d="M13 16H7a4 4 0 0 1-.9-7.9"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  // The third frustration became the toll gate (an account wall, a subscription that
  // outlives the job, a charge at the download) when the offline pain moved into the
  // sovereignty statement - plan 117 blocks 3 + 4. `cloudDependence` above stays: the
  // 26 locale why.json twins still name it, and an unresolved key renders nothing.
  tollGate: `<svg viewBox="0 0 24 24" ${SITE_ICON_S18}><rect x="2" y="5.5" width="20" height="13" rx="2.5"/><path d="M2 10.5h20"/><path d="M6 15h4"/></svg>`,
  // assure section
  assureCheck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>`,
  assureEyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.6 6.6A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`,
  assureScan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
  assureServer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="6" rx="2"/><rect x="2" y="15" width="20" height="6" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  // import section - flow steps + points
  importFlowFile: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  importFlowCanvas: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  importFlowMix: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  importFlowRender: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  importPointEdit: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  importPointShield: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
  importPointGrid: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  // whats-a-tool features
  toolFeatureStar: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  toolFeaturePeople: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`,
  toolFeatureCode: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  toolFeatureMonitor: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  toolFeatureShuffle: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  toolFeatureNested: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1.5"/></svg>`,
  // about-section items
  aboutAnimals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="10" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r="1" fill="currentColor" stroke="none"/><ellipse cx="12" cy="15.5" rx="2" ry="1.5"/></svg>`,
  aboutGem: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>`,
  // everywhere-section surfaces + delivery models
  surfaceWeb: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  surfaceMacos: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`,
  surfaceLinux: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  // Four panes - the one glyph that reads as Windows without using the logo.
  surfaceWindows: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>`,
  surfaceIos: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  surfaceAndroid: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><polyline points="9 2 9 7 15 7 15 2"/></svg>`,
  surfaceCli: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  // TUI = the CLI's terminal prompt (chevron + command line), but framed in a
  // box with a divider (title bar) - the CLI icon, drawn as a full-screen app.
  surfaceTui: `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><polyline points="7 12 10 15 7 18"/><line x1="13" y1="18" x2="17" y2="18"/></svg>`,
  modelDeploy: `<svg class="everywhere-model-icon" viewBox="0 0 24 24" ${SITE_ICON_S}><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  modelServe: `<svg class="everywhere-model-icon" viewBox="0 0 24 24" ${SITE_ICON_S}><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  modelHybrid: `<svg class="everywhere-model-icon" viewBox="0 0 24 24" ${SITE_ICON_S}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
};
function siteIcon(key: string): string {
  const svg = SITE_ICONS[key];
  if (!svg) console.warn(`⚠  docs/site: unknown icon key "${key}"`);
  return svg ?? '';
}

// ── Per-bullet icons for policy/doc pages (the `<!--i:key-->` list marker) ────
// A bullet may open with an HTML-comment marker `<!--i:lock-->` - invisible on
// GitHub and in the .md twins - which mdToHtml maps to an inline SVG here and a
// `.icon-list` layout. Aliases reuse the maps above; the rest are path strings
// lifted from shells/web/src/lib/icons.ts (the app's own glyphs, so the doc and
// the product agree on iconography). All stroke currentColor → theme-safe.
const DOC_ICON_S = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
const DOC_ICONS: Record<string, string> = {
  // A framed ripple - the app's "in-pixel imprint" glyph (shells/web/src/lib/icons.ts),
  // reused as the mark on every screenshot's credential line so the same symbol means
  // the same thing in the product and in the docs.
  imprint:    `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M6.5 13.5c1.8-3 3.6-3 5.5 0s3.7 3 5.5 0"/><path d="M6.5 9.5c1.8-2.4 3.6-2.4 5.5 0s3.7 2.4 5.5 0"/></svg>`,
  pause:      `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  sunburst:   `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  font:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>`,
  moon:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  neurobeat:  `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M2 12h3l2-7 4 18 3-14 2 7h6"/></svg>`,
  convert:    `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
  checklist:  `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.3 1.3L6.5 5"/><path d="m3 12 1.3 1.3 2.2-2.3"/><path d="m3 18 1.3 1.3 2.2-2.3"/></svg>`,
  palette:    `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  pentool:    `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/></svg>`,
  folder:     `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
  hash:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>`,
  cpu:        `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>`,
  link:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M9 15 15 9"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/></svg>`,
  wrench:     `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  usercheck:  `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M14 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8" cy="8" r="4"/><path d="M15 11.5l2.2 2.2 4.3-4.3"/></svg>`,
  photos:     `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><rect x="6" y="2" width="16" height="16" rx="2"/><path d="M18 22H4a2 2 0 0 1-2-2V6"/><circle cx="12" cy="8" r="2"/><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L11 18"/></svg>`,
  document:   `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>`,
  trash:      `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  mail:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  seal:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><circle cx="12" cy="9" r="6"/><path d="M9 14.2 8 22l4-2.5 4 2.5-1-7.8"/></svg>`,
  upload:     `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>`,
  star:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  box:        `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>`,
  clock:      `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.5 2"/></svg>`,
  // The same magnifier the app's own search field wears (shells/web/src/lib/icons.ts,
  // MAGNIFIER) - one glyph for the feature in the product and on the page about it.
  search:     `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  // Home - the footer sitemap's `index` row. The one destination no sidebar lists
  // (the landing page has no rail), so it exists for the footer alone.
  home:       `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M10 21v-6h4v6"/></svg>`,
  eyeoff:     '', // aliased below
  sliders: '', lock: '', layers: '', globe: '', people: '', shieldcheck: '', check: '', code: '',
  download: '', database: '', server: '', monitor: '',
};
// `shield` is what docs/profile.md (and its 26 twins) name the Verify glyph;
// the drawn glyph is `shieldcheck`. An alias here keeps the marker valid without
// editing a translated block in 27 files.
DOC_ICONS.shield = DOC_ICONS.shieldcheck!;
DOC_ICONS.eyeoff = SITE_ICONS.assureEyeOff!;
DOC_ICONS.sliders = BICONS.sliders;
DOC_ICONS.lock = BICONS.lock;
DOC_ICONS.layers = BICONS.layers;
DOC_ICONS.globe = SITE_ICONS.surfaceWeb!;
DOC_ICONS.people = SITE_ICONS.toolFeaturePeople!;
DOC_ICONS.shieldcheck = SITE_ICONS.importPointShield!;
DOC_ICONS.check = SITE_ICONS.assureCheck!;
DOC_ICONS.code = SITE_ICONS.toolFeatureCode!;
DOC_ICONS.download = BICONS.download;
DOC_ICONS.database = BICONS.database;
DOC_ICONS.server = BICONS.server;
DOC_ICONS.monitor = SITE_ICONS.toolFeatureMonitor!;
// The AI mark. Mirrors the spark the web shell's /verify view uses for
// AI-generated content, so the same idea wears the same glyph in both places.
DOC_ICONS.sparkle = `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>`;
function docIcon(key: string): string {
  const svg = DOC_ICONS[key];
  if (!svg) { console.warn(`⚠  unknown doc bullet icon "${key}"`); return ''; }
  return svg;
}

// ── Technology marks (the `<!--l:key-->` inline marker) ──────────────────────
// A second, separate register from DOC_ICONS: those are OUR glyphs, drawn in the
// site's own hand and free to be recoloured; these are other people's marks, shipped
// verbatim from docs/logos.ts and never restyled beyond taking the text colour. The
// two never mix in one map, so "is this ours to change?" is answered by which
// registry a key lives in. An unknown key behaves exactly as docIcon's does - warn
// at build, render nothing, never a broken glyph in the reader's face.
function docLogo(key: string): string {
  const svg = DOC_LOGOS[key];
  if (!svg) { console.warn(`⚠  unknown technology mark "${key}"`); return ''; }
  return `<span class="doc-logo" data-logo="${key}">${svg}</span>`;
}

/**
 * The whole-line form: `<!--lb:kubernetes helm-->` on its own line, before a `## `
 * heading, becomes a centred row of big marks - a moment in the scroll that says
 * "this next part is about these" before a word of it is read.
 *
 * Why a block instead of marks IN the heading: a heading is a name, and a glyph
 * wedged in front of one competes with the words for the same line. Reserved for
 * MAJOR sections whose subject really is the technology - one per page at most in
 * practice. A whole row of marks that only decorates would spend the device on
 * nothing (and the section headings are what a reader scans to navigate).
 *
 * aria-hidden on the WRAPPER, not per mark: the heading underneath already names
 * every one of them, so to a screen reader this row is silence by design.
 */
function docLogoBlock(keys: string[]): string {
  const marks = keys.map(k => {
    const svg = DOC_LOGOS[k];
    if (!svg) { console.warn(`⚠  unknown technology mark "${k}" in a <!--lb:…--> block`); return ''; }
    return `<span class="doc-logo-mark" data-logo="${k}">${svg}</span>`;
  }).filter(Boolean);
  // Every key unknown → no empty box left behind, exactly as docIcon/docLogo do.
  if (!marks.length) return '';
  return `<div class="doc-logo-block" aria-hidden="true">${marks.join('')}</div>`;
}

/**
 * The verify badge on the hero lollipop.
 *
 * The mark at the top of the landing page is a signed file - /info/icon.svg carries
 * its own Content Credential - and the page's whole argument is that you should not
 * have to take that on trust. So the logo wears the app's own verify glyph (the
 * shield + tick the web shell's Verify button and profile use, SITE_ICONS
 * .importPointShield here), and it opens the real /verify view with THIS file already
 * loaded: `#/verify?src=…` fetches a same-origin path and runs it through the normal
 * on-device check (shells/web/src/views/valid.ts). Nothing is re-signed and nothing is
 * swapped to make the demonstration work - it is the same bytes the page is serving.
 *
 * A corner overlay, sized in the same clamp() family as the logo so it stays a badge
 * at every width, and positioned at 82%/82% of the slot: the mark is a circle, so its
 * bottom-right diagonal edge (50% + 35.4%) is the one place a badge sits ON the
 * artwork rather than in the empty corner of its box. It is a real <a> with its own
 * accessible name - NOT nested inside the logo's link, which would be invalid and
 * would leave the badge unreachable by keyboard: a link's name is the text it
 * contains, so a badge in there would make the logo link read as "Open Lolly -
 * browse all tools Verify this logo's credentials". It is a sibling of the logo mark
 * inside .hero-logo-slot, which is the positioned box for both.
 */
const HERO_VERIFY = (lang: Lang) => {
  const href = `${localizeHref(lang, '/')}#/verify?src=${encodeURIComponent('/info/icon.svg')}`;
  const label = t("Verify this logo's credentials");
  return `<a class="hero-verify" href="${esc(href)}" aria-label="${esc(label)}" title="${esc(label)}">`
    + `<span aria-hidden="true">${SITE_ICONS.importPointShield}</span></a>`;
};

// ── Landing page special renderer ─────────────────────────────────────────────

// The audience-card icons and internal slug/anchor wiring are matched from ENGLISH
// keywords (getIcon/toSlug). A translated landing page has translated headings, which
// match nothing: every card falls through to the default monitor icon, and non-Latin
// headings (CJK/Arabic) slug to empty strings that collide and break tab activation.
// The cards are authored in the same order in every locale, so key the icon + slug off
// the ENGLISH heading at the same index. The visible tab LABEL still uses the translated
// heading - only the presentational icon and the wiring are shared across locales.
let _enAudienceH2: string[] | null = null;
function englishAudienceH2s(): string[] {
  if (_enAudienceH2) return _enAudienceH2;
  try {
    const enMd = readFileSync(resolve(__dirname, 'site.md'), 'utf-8');
    _enAudienceH2 = enMd.split(/\n---\n/).slice(1, -1).map(
      s => s.split('\n').find(l => l.startsWith('## '))?.slice(3).trim() ?? '',
    );
  } catch {
    _enAudienceH2 = [];
  }
  return _enAudienceH2;
}


// ═══ LANDING COPY REGION START ═══════════════════════════════════════════════
// Everything between this marker and LANDING COPY REGION END composes the landing
// page (plus the two bands the landing shares with their own pages), and
// tests/docs-claims.test.ts reads it as SOURCE: the say-offline-once purge, the
// competitor-name rule and the banned-word list are enforced against these bytes
// (plans/117 section 6, plans/116 section 3). Sub-regions that are allowed to break one of those
// rules are marked CLAIMS-ALLOW, each with the reason on the line - and the test
// excuses exactly those, so an unmarked exception fails the build's test run.

/**
 * The download rail - the packaged builds, one tile each.
 *
 * It closed the hero from its first day (the argument then: "above the fold" was
 * the whole requirement, and a band under the hero falls off a 720px laptop the
 * moment the H1 wraps). On 2026-09-02 Andy moved it down to its own band between
 * the persona device and lolly.work: a reader meets the tiles after the pitch.
 * The rail itself is unchanged; .downloads-section paints the hero's dark surface
 * under it so the on-band-dark tile colours still hold.
 *
 * Each tile carries the OTHER party's mark (docLogo, from docs/logos.ts) rather
 * than one of our own glyphs, because the reader is scanning for a mark they
 * already recognise, not reading five labels. Two openSUSE tiles wear the same
 * mark on purpose - the distribution is the thing being recognised, and the line
 * under it is what separates Tumbleweed from Leap.
 *
 * Every tile links STRAIGHT at the file on lolli.li - the stable `lolly-latest.*`
 * alias, overwritten in place on each release, so the link never rots on a version
 * bump (which is what the section-anchor indirection used to guard against, and no
 * longer needs to). The "more" link still opens /info/install.html for the
 * platforms without a tile (Windows, iOS, the terminal) and the checksum step.
 * URLs come from DOWNLOAD_FILE below, keyed by tile, not from the locale JSON, so
 * they cannot drift per language.
 */
function downloadsRail(lang: Lang): string {
  const d = loadSiteJson('downloads.json', lang) as {
    label: string; lead: string;
    items: { logo: string; os: string; name: string; ext: string; note: string; slug: string; hash: string }[];
    more: { label: string; slug: string };
  };
  // aria-label rather than letting the four spans be read in DOM order: the tile's
  // visual order (mark, badge, name, meta) is a scanning order, not a sentence, and
  // "DMG macOS Apple silicon M1 and later" is what the spans read as. One composed
  // label says the same thing once, so the internals are all aria-hidden.
  // Stable release aliases on lolli.li, keyed by tile hash. A tile with no entry
  // falls back to the old install-section anchor. Both openSUSE tiles resolve to the
  // one x86_64 rpm for now; split them when distro-specific rpms ship.
  const RELEASE = 'https://lolli.li';
  const DOWNLOAD_FILE: Record<string, string> = {
    macos: 'lolly-latest.dmg', tumbleweed: 'lolly-latest.rpm', leap: 'lolly-latest.rpm',
    flatpak: 'lolly-latest.flatpak', android: 'lolly-latest.apk', deb: 'lolly-latest.deb',
  };
  const tiles = d.items.map((it) => {
    const file = DOWNLOAD_FILE[it.hash];
    const href = file ? `${RELEASE}/${file}` : `${localeHref(lang, it.slug)}#${it.hash}`;
    return `<a class="dl-tile" data-dl="${esc(it.logo)}" href="${esc(href)}"${file ? ' download' : ''} aria-label="${esc(
      t('Install for {os}: {name}, {ext} file').replace('{os}', it.os).replace('{name}', it.name).replace('{ext}', it.ext))}">
        <span class="dl-top" aria-hidden="true">
          <span class="dl-mark">${docLogo(it.logo)}</span>
          <span class="dl-go">${docIcon('download')}</span>
          <span class="dl-ext">${esc(it.ext)}</span>
        </span>
        <span class="dl-name" aria-hidden="true">${esc(it.name)}</span>
        <span class="dl-meta" aria-hidden="true"><span class="dl-os">${esc(it.os)}</span><span class="dl-note">${esc(it.note)}</span></span>
      </a>`;
  }).join('\n      ');
  return `<div class="hero-downloads">
      <div class="dl-head">
        <span class="dl-label">${esc(d.label)}</span>
        <span class="dl-lead">${esc(d.lead)}</span>
      </div>
      <div class="dl-grid">
      ${tiles}
      </div>
      <a class="dl-verify" href="${RELEASE}/SHA256SUMS.txt">${docIcon('shieldcheck')}<span>${esc(t('Verify downloads (SHA-256)'))}</span></a>
      <a class="dl-more" href="${esc(localeHref(lang, d.more.slug))}">${esc(d.more.label)} <span aria-hidden="true">&rarr;</span></a>
    </div>`;
}

// The landing page states positions; the docs hold the reasoning, the caveats and
// the mechanisms, and they are kept current in a way marketing copy never is. So
// the trust section ends by handing the reader over to them rather than trying to
// summarise a threat model in a card. Authored here rather than in assure.json
// because every locale's JSON would otherwise need the key before it could render.
const ASSURE_DOC_LINKS = (lang: Lang) => {
  const links: { icon: string; label: string; desc: string; href: string }[] = [
    { icon: 'shieldcheck', label: t('Trust'), href: '/info/trust.html',
      desc: t('Where content comes from, how to check it and what happens to your data.') },
    { icon: 'sparkle', label: t('Our AI Stance'), href: '/info/ai-stance.html',
      desc: t('AI as labour, never as impersonation - and the machinery that enforces it.') },
    { icon: 'convert', label: t('Why this differs'), href: '/info/status-quo.html',
      desc: t('The frictions you have been trained to accept, and what replaces them.') },
    { icon: 'lock', label: t('Security'), href: '/info/security.html',
      desc: t('The cryptography, the threat model and the limits stated as plainly as the guarantees.') },
    { icon: 'people', label: t('Inclusive Design'), href: '/info/inclusive-design.html',
      desc: t('Accessibility, language coverage and the commitments we hold ourselves to.') },
  ];
  return `<div class="assure-docs reveal reveal-3">
      <span class="assure-docs-label">${esc(t('Read the detail'))}</span>
      <div class="assure-docs-grid">
        ${links.map(l => `<a class="assure-doc" href="${esc(localizeHref(lang, l.href))}">
          <span class="assure-doc-ic">${docIcon(l.icon)}</span>
          <strong>${esc(l.label)}</strong>
          <span class="assure-doc-desc">${esc(l.desc)}</span>
        </a>`).join('\n        ')}
      </div>
    </div>`;
};

// ── Shared bands: composed here, rendered on MORE THAN ONE page ───────────────
// Plan 117 block 9: heavy reference content leaves the landing for its own page,
// and the page KEEPS the layout that made it readable. So the two bands that
// moved are functions rather than in-line template literals - one layout, two
// call sites, no second copy to drift.

/**
 * "Your design files aren't stranded" - the import band.
 *
 * Was the landing's `IMPORT_HTML`. It now opens `/info/design-import.html`, the
 * page it always linked to, in the same visual treatment (plan 117 block 9); the
 * landing keeps a one-line teaser. `cta: false` drops the "See how importing a
 * design works" row on the page that row would only point back at.
 */
function importBand(lang: Lang, opts: { cta?: boolean } = {}): string {
  const showCta = opts.cta !== false;
  const importData = loadSiteJson('import.json', lang) as {
    eyebrow: string; heading: string; lead: string;
    sources: { mono: string; name: string; fmt: string; color: string }[];
    flow: { icon: string; title: string; desc: string }[];
    points: { icon: string; title: string; desc: string }[];
    cta: string; ctaHref: string;
  };
  return `<section class="import-section">
  <div class="import-inner">
    <div class="import-lede reveal">
      ${credentialedMascot('/info/mascots/kookaburra.webp', 'import-mascot')}
      <div class="import-lede-text">
        <span class="import-eyebrow">${esc(importData.eyebrow)}</span>
        <h2>${esc(importData.heading)}</h2>
        <p class="import-lead">${inline(importData.lead)}</p>
      </div>
    </div>
    <div class="import-sources reveal reveal-1">
      ${importData.sources.map(s => `<div class="import-source">
        <span class="import-badge" style="--b:${s.color}">${esc(s.mono)}</span>
        <strong>${esc(s.name)}</strong>
        <span class="import-fmt">${esc(s.fmt)}</span>
      </div>`).join('\n      ')}
    </div>
    <div class="import-flow reveal reveal-2">
      ${importData.flow.map((f, i) => `<div class="import-step">
        <div class="import-step-icon">${siteIcon(f.icon)}</div>
        <strong>${esc(f.title)}</strong>
        <p>${esc(f.desc)}</p>
      </div>${i < importData.flow.length - 1 ? '<span class="import-arrow" aria-hidden="true">→</span>' : ''}`).join('\n      ')}
    </div>
    <div class="import-points reveal reveal-3">
      ${importData.points.map(p => `<div class="import-point">
        <div class="import-point-icon">${siteIcon(p.icon)}</div>
        <strong>${esc(p.title)}</strong>
        <p>${esc(p.desc)}</p>
      </div>`).join('\n      ')}
    </div>
    ${showCta ? `<div class="import-cta-row reveal reveal-4">
      <a href="${esc(localizeHref(lang, importData.ctaHref))}" class="import-more">${esc(importData.cta)}</a>
    </div>` : ''}
  </div>
</section>`;
}

// ── The formats register ─────────────────────────────────────────────────────
// The structural data (tokens, direction, features, descriptions) lives in the
// English-only docs/site/formats-catalog.json - format names are not translated.
interface FmtEntry { token: string; name: string; full: string; category: string; dir: 'in' | 'out' | 'both'; features: string[]; desc: string; metadata: FmtMetadata; }
interface FmtCatalog { features: Record<string, string>; specifics?: Record<string, string[]>; unsupported?: Record<string, string[]>; formats: FmtEntry[] }
let _fmtCatalog: FmtCatalog | null = null;
function formatCatalog(): FmtCatalog {
  if (!_fmtCatalog) _fmtCatalog = loadSiteJson('formats-catalog.json') as FmtCatalog;
  return _fmtCatalog;
}
/** in / out / round-trip counts, computed from the register's `dir` fields - never hard-coded. */
function formatCounts() {
  const f = formatCatalog().formats;
  return {
    in: f.filter(x => x.dir !== 'out').length,
    out: f.filter(x => x.dir !== 'in').length,
    both: f.filter(x => x.dir === 'both').length,
    inOnly: f.filter(x => x.dir === 'in').length,
    outOnly: f.filter(x => x.dir === 'out').length,
  };
}

const FMT_IST = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
// A large icon sits above each category label. Inline SVGs (stroke = currentColor)
// so they inherit the section's green and need no asset fetch.
const FMT_CAT_ICON: Record<string, string> = {
  Vector: `<svg viewBox="0 0 24 24" ${FMT_IST}><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/></svg>`,
  Raster: `<svg viewBox="0 0 24 24" ${FMT_IST}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  Layered: `<svg viewBox="0 0 24 24" ${FMT_IST}><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>`,
  Motion: `<svg viewBox="0 0 24 24" ${FMT_IST}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5"/></svg>`,
  Audio: `<svg viewBox="0 0 24 24" ${FMT_IST}><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg>`,
  Document: `<svg viewBox="0 0 24 24" ${FMT_IST}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`,
  Data: `<svg viewBox="0 0 24 24" ${FMT_IST}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
  Tokens: `<svg viewBox="0 0 24 24" ${FMT_IST}><circle cx="13.5" cy="6.5" r="1.3"/><circle cx="17" cy="10.5" r="1.3"/><circle cx="8.5" cy="7" r="1.3"/><circle cx="6.5" cy="12" r="1.3"/><path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 2.5-2.5c0-.7-.3-1.3-.3-2a2 2 0 0 1 2-2H18a4 4 0 0 0 4-4c0-5.5-4.5-9.5-10-9.5z"/></svg>`,
  '3D': `<svg viewBox="0 0 24 24" ${FMT_IST}><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2v20M21 7l-9 5-9-5"/></svg>`,
  Bundle: `<svg viewBox="0 0 24 24" ${FMT_IST}><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>`,
  Font: `<svg viewBox="0 0 24 24" ${FMT_IST}><path d="M6 4h12M12 4v16M9 20h6"/></svg>`,
};

/**
 * The three-zone formats table - a single table, NOT two columns.
 *
 * Each category is a row; import-only formats sit at the LEFT edge, export-only
 * at the RIGHT edge, and the round-trip formats (read AND written) sit centred
 * between them - so a format Lolly both reads and writes is shown ONCE, in the
 * middle, never duplicated. Every chip is a button: clicking it opens a dialog
 * that names the format in full, describes it in plain language, and lists the
 * properties Lolly supports (alpha, HDR, CMYK, layers, encryption …) - inclusive
 * design, so someone who does not know formats can learn what each one is for.
 *
 * Plan 117 block 9 moved this off the landing onto /info/formats.html, layout
 * intact. `head: false` drops the section's own h2 on the page whose h1 already
 * says it. Wherever this renders, wrapPage must also ship FORMATS_DIALOG_SCRIPT.
 */
function formatsSection(lang: Lang, opts: { head?: boolean } = {}): string {
  const formats = loadSiteJson('formats.json', lang) as { heading: string; lead: string };
  const catalog = formatCatalog();
  const n = formatCounts();
  const CAT_ORDER = ['Vector', 'Raster', 'Layered', 'Motion', 'Audio', 'Document', 'Data', 'Font', 'Tokens', '3D', 'Bundle'];
  const fmtChip = (f: FmtEntry) =>
    `<button type="button" class="fmt-chip fmt-chip--${f.dir}" data-fmt="${esc(f.token)}" aria-haspopup="dialog"${f.dir === 'both' ? ' title="Round-trip - Lolly reads and writes this"' : ''}>${f.dir === 'both' ? '<span class="rt-mark" aria-hidden="true">⇄</span>' : ''}${esc(f.name)}</button>`;
  const zone = (cls: string, list: FmtEntry[]) => `<div class="fmt-zone fmt-zone--${cls}">${list.map(fmtChip).join('')}</div>`;
  const catRows = CAT_ORDER
    .map(cat => ({ cat, all: catalog.formats.filter(f => f.category === cat) }))
    .filter(r => r.all.length)
    .map(({ cat, all }) => `<div class="fmt-row">
        <span class="fmt-cat">${FMT_CAT_ICON[cat] || ''}<span class="fmt-cat-label">${esc(cat)}</span></span>
        ${zone('in', all.filter(f => f.dir === 'in'))}
        ${zone('both', all.filter(f => f.dir === 'both'))}
        ${zone('out', all.filter(f => f.dir === 'out'))}
      </div>`).join('\n      <div class="fmt-rowsep"></div>\n      ');
  const zoneHead = `<div class="fmt-row fmt-row--head" aria-hidden="true">
        <span class="fmt-cat"></span>
        <div class="fmt-zone fmt-zone--in"><span class="fmt-zonelabel">Import only<b>${n.inOnly}</b></span></div>
        <div class="fmt-zone fmt-zone--both"><span class="fmt-zonelabel"><span class="rt-mark">⇄</span> Both ways<b>${n.both}</b></span></div>
        <div class="fmt-zone fmt-zone--out"><span class="fmt-zonelabel">Export only<b>${n.outOnly}</b></span></div>
      </div>`;
  // Catalog data for the dialog: names, full names, feature labels and descriptions,
  // serialised into the page so the click handler has everything without a fetch.
  const catalogJson = JSON.stringify({
    features: catalog.features,
    specifics: catalog.specifics || {},
    unsupported: catalog.unsupported || {},
    catIcons: FMT_CAT_ICON,
    metaLabels: METADATA_LABEL,
    formats: Object.fromEntries(catalog.formats.map(f => [f.token, { name: f.name, full: f.full, category: f.category, dir: f.dir, features: f.features, desc: f.desc, metadata: f.metadata }])),
  }).replace(/</g, '\\u003c');
  return `<section class="formats-section" id="formats">
  <div class="formats-inner">
    <div class="formats-head reveal">
      ${opts.head === false ? '' : `<h2>${esc(formats.heading)}</h2>`}
      <p class="formats-hint">${esc(`${n.in} in · ${n.out} out - tap any format to learn what it is and what Lolly supports.`)}</p>
    </div>
    <div class="fmt-scroll reveal reveal-1">
      <div class="fmt-table">
      ${zoneHead}
      <div class="fmt-divider"></div>
      ${catRows}
      </div>
    </div>
    <div class="section-more-row"><a class="section-more" href="${esc(localeHref(lang, 'exporting'))}">${esc(t('Every format in detail'))} <span aria-hidden="true">→</span></a></div>
  </div>
  <dialog class="fmt-dialog" id="fmt-dialog" aria-labelledby="fmt-dlg-name">
    <form method="dialog" class="fmt-dialog-inner">
      <button class="fmt-dialog-x" value="close" aria-label="Close">✕</button>
      <div class="fmt-dialog-head">
        <span class="fmt-dialog-icon" id="fmt-dlg-icon" aria-hidden="true"></span>
        <div class="fmt-dialog-headtext">
          <span class="fmt-dialog-dir" id="fmt-dlg-dir"></span>
          <h3 id="fmt-dlg-name"></h3>
          <p class="fmt-dialog-full" id="fmt-dlg-full"></p>
        </div>
      </div>
      <p class="fmt-dialog-desc" id="fmt-dlg-desc"></p>
      <ul class="fmt-dialog-specs" id="fmt-dlg-specs"></ul>
      <ul class="fmt-dialog-feats" id="fmt-dlg-feats"></ul>
      <p class="fmt-dialog-meta" id="fmt-dlg-meta"></p>
      <div class="fmt-dialog-unsup" id="fmt-dlg-unsup-wrap" hidden>
        <span class="fmt-dialog-unsup-label">Not yet supported</span>
        <ul class="fmt-dialog-unsup-list" id="fmt-dlg-unsup"></ul>
      </div>
    </form>
  </dialog>
  <script type="application/json" id="fmt-catalog-data">${catalogJson}</script>
</section>`;
}

/** /info/design-import.html: the import band opens the page it always linked to. */
function renderDesignImportPage(md: string, lang: Lang): string {
  return `${importBand(lang, { cta: false })}\n${mdToHtml(md)}`;
}

/** /info/formats.html: the three-zone table, dropped where the source asks for it. */
function renderFormatsPage(md: string, lang: Lang): string {
  const [before, after] = md.split(FORMATS_TABLE_MARK);
  return `${mdToHtml(before ?? md)}\n${formatsSection(lang, { head: false })}\n${after ? mdToHtml(after) : ''}`;
}

/** A deep link INTO THE APP (not the docs): `/#/tool/…`, carrying the reader's locale. */
function appHref(lang: Lang, hash: string): string {
  return lang === 'en' ? `/${hash}` : `/?lang=${lang}${hash}`;
}

/**
 * Block 2 - "Make something, right now". Three worked examples from the reader's
 * own life; the caption names the SCENE, never the tool ("A code for the party",
 * not "QR Code Generator").
 *
 * Each card is a plain link into the app carrying the example's own inputs, so a
 * click opens the tool already filled in - the same "you get the config you saw"
 * contract the gallery's example carousel has, expressed as a URL because a
 * static page has no gallery to click.
 *
 * The three tools are pinned in tests/docs-claims.test.ts. All three are
 * community tools (present on every profile), declare no capabilities, and make
 * no network request of any kind - so this block keeps working with the Wi-Fi
 * off, which is the claim block 3 makes one screen further down.
 *
 * The picture is the tool's OWN preview of that exact look, copied out of the
 * active brand's catalog at build time (build(): /info/examples/). Faithful by
 * construction: what the card shows is what the click gives you. A profile whose
 * catalog has no preview for a look renders the card without its picture rather
 * than a broken image.
 */
interface Scene { tool: string; look: string; query: string; scene: string; line: string; alt: string }
const LANDING_SCENES: Scene[] = [
  // The prefilled URL is the VISITOR's job, not ours (plans/168 WP-5): the card sells
  // "a code for the invitation", so the first artifact a stranger makes must be that
  // invitation. rsvp.example is a reserved example domain (RFC 2606) - obviously not a
  // real organisation's link, per the no-invented-history rule.
  { tool: 'qr-code', look: 'qr-code.look0.svg',
    query: 'url=https%3A%2F%2Frsvp.example%2Fmidsummer-party&color=%231a1a2e&background=%23faf7f2',
    scene: 'A code for the invitation',
    line: 'Print it on the invite or pin it to the noticeboard, and everyone lands in the right place.',
    alt: 'A square QR code in dark ink on warm paper' },
  // Slot 2 is the audiogram (Andy, 2026-08-17): the camera-shy path deserves featuring.
  // The query seeds the manifest's own look0 example so the preview and the click agree.
  { tool: 'audiogram', look: 'audiogram.look0.svg',
    query: 'title=Slow%20is%20smooth%2C%20smooth%20is%20fast&subtitle=The%20Build%20Notes%20podcast%20%C2%B7%20Ep.%2041&style=bars',
    scene: 'Feeling shy? Your voice is plenty',
    line: 'A voice note becomes a finished video: moving waveform, your words on the cover, your colours. No camera, no makeup needed.',
    alt: 'An audiogram video cover with a title and a sound waveform' },
  { tool: 'filter', look: 'filter.look1.svg',
    query: 'effect=duotone',
    scene: 'A photo, ready for the poster',
    line: 'Drop in a picture and it takes on your two colours, so the poster looks like it was planned.',
    alt: 'A photograph recoloured in two flat brand colours' },
];
function makeSomethingBlock(lang: Lang): string {
  const cards = LANDING_SCENES.map((s, i) => {
    const shot = existsSync(resolve(outDir, 'examples', s.look))
      ? `<span class="make-shot"><img src="/info/examples/${esc(s.look)}" alt="${esc(t(s.alt))}" loading="lazy"></span>`
      : '';
    return `<a class="make-card reveal reveal-${i + 1}" href="${esc(appHref(lang, `#/tool/${s.tool}?${s.query}`))}">
        ${shot}
        <strong class="make-scene">${esc(t(s.scene))}</strong>
        <span class="make-line">${esc(t(s.line))}</span>
        <span class="make-go">${esc(t('Open this one'))} <span aria-hidden="true">→</span></span>
      </a>`;
  }).join('\n      ');
  return `<section class="make-section" id="make">
  <div class="make-inner">
    <div class="make-head reveal">
      <h2>${esc(t('Make something, right now'))}</h2>
      <p class="make-lead">${esc(t('Three ordinary jobs. Pick one: it opens already filled in, and the words are yours to change.'))}</p>
    </div>
    <div class="make-grid">
      ${cards}
    </div>
  </div>
</section>`;
}

/**
 * The FAQ, its own page since plans/177 (/info/start/faq.html): the same native
 * <details> accordion the landing used to inline, plus the deep-link opener.
 * NAMED function (not an inline arrow) so scripts/check-docs-nav.ts can recover
 * the page entry with a brace-free match.
 */
function renderFaqPage(_md: string, lang: Lang): string {
  const FAQ_CHEVRON = `<svg viewBox="0 0 24 24" ${SITE_ICON_S}><polyline points="6 9 12 15 18 9"/></svg>`;
  const FAQS = loadFaqs(lang);
  // Stable per-question ids built from the ENGLISH question (same rule as markdown
  // headings, prefixed `faq-`), so one #faq-… anchor points at the same item on
  // every locale page. An empty slug (non-Latin question) becomes its 1-based
  // position; a repeat gets a document-order suffix.
  const enFaqs = lang === 'en' ? FAQS : loadFaqs('en');
  const slugSeen = new Map<string, number>();
  const faqSlug = (q: string, i: number) => {
    const base =
      (enFaqs[i]?.q ?? q).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
      String(i + 1);
    const n = (slugSeen.get(base) ?? 0) + 1;
    slugSeen.set(base, n);
    return `faq-${base}${n > 1 ? `-${n}` : ''}`;
  };
  const FAQ_JS = `<script>
(function(){
  function openFaq(){
    var id = decodeURIComponent(location.hash.slice(1));
    if(!id) return;
    var el = document.getElementById(id);
    if(el && el.tagName === 'DETAILS' && el.classList.contains('faq-item')){
      el.open = true;
      requestAnimationFrame(function(){ el.scrollIntoView({behavior:'smooth', block:'start'}); });
    }
  }
  openFaq();
  window.addEventListener('hashchange', openFaq);
})();
</script>`;
  return `<section class="faq-section faq-page" id="faq">
  <div class="faq-inner">
    <h2>${esc(t('Questions & answers'))}</h2>
    <p class="faq-lead">${esc(t('The things people ask most.'))}</p>
    <div class="faq-list">
      ${FAQS.map((f, i) => `<details class="faq-item" id="${faqSlug(f.q, i)}">
        <summary class="faq-q"><span>${inline(f.q)}</span><span class="faq-chevron">${FAQ_CHEVRON}</span></summary>
        <div class="faq-a">${mdToHtml(f.a)}</div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>
${FAQ_JS}`;
}

/** /info/start/make-something.html opens with the three worked scenes - they moved
 *  here from the landing (plans/177 disposition; the covers carry the show-me job
 *  on the door now). NAMED function for check-docs-nav's brace-free match. */
function renderMakeSomethingPage(md: string, lang: Lang): string {
  return `${makeSomethingBlock(lang)}\n${mdToHtml(md)}`;
}

// ── The landing's copy is DATA: docs/site/*.json (plans/177 P4) ─────────────
// One file per beat - hero-chrome (the cycle + CTAs), covers, whatwhy, persona,
// behind - documented in docs/site/README.md. build.ts is the RENDERER only.
// Every copy string is read through localizeSiteJson, which looks it up in the
// site catalogue (t(), English-as-key, identity fallback) and leaves the keys in
// LANDING_I18N_SKIP alone: routes, slugs, file names, css classes, counter
// names and code notes are never copy. scripts/translate.ts carries the SAME
// list (its site corpus walks these files with it) and
// tests/docs-landing-i18n.test.ts pins the two lists and the file list equal,
// so a key added on one side cannot be quietly missed on the other.
const LANDING_I18N_SKIP = ['href', 'slug', 'class', 'img', 'video', 'mascot', 'id', 'count', 'note'];
function localizeSiteJson<T>(value: T, key = ''): T {
  if (typeof value === 'string') return (LANDING_I18N_SKIP.includes(key) ? value : t(value)) as T;
  if (Array.isArray(value)) return value.map((v) => localizeSiteJson(v, key)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = localizeSiteJson(v, k);
    return out as T;
  }
  return value;
}
/** A landing beat file, localised. English-only on disk by design: no locale
 *  twin lookup here (siteContentPath is the older twin mechanism the import and
 *  formats bands still use). */
function loadLandingJson<T>(name: string): T {
  return localizeSiteJson(JSON.parse(readFileSync(resolve(__dirname, 'site', name), 'utf8')) as T);
}

interface HeroChrome {
  lead: string;
  cycle: Array<{ word: string; slug: string }>;
  ctas: Array<{ href: string; label: string; class: string }>;
}
/** `hue`: the OKLCH hue the cover was posed in (scripts/build-covers.ts) - the
 *  fan opens on the cover nearest the reader's own accent (lib/covers-flow.ts). */
interface LandingCover { img: string; video?: string; hue?: number; name: string; promise: string; href: string; alt: string }
interface CoversJson { label: string; open: string; prev: string; next: string; pick: string; covers: LandingCover[] }
interface WhatWhyJson {
  what: { eyebrow: string; heading: string; body: string; more: { label: string; slug: string } };
  stats: Array<{ count: string; label: string; slug: string }>;
  why: { eyebrow: string; heading: string; statement: string; receipts: Array<{ label: string; slug: string }>; more: { label: string; slug: string } };
}
interface Lane { tab: string; pitch: string; mascot?: string; links?: Array<{ label: string; slug?: string; href?: string; note?: string }>; cta?: { label: string; href: string }; doc: { label: string; slug: string } }
interface Door { id: string; name: string; sub: string; mascot: string; lanes: Lane[] }
interface PersonaJson { title: string; doors: Door[] }
interface BehindJson { eyebrow: string; sceptic: string; links: Array<{ label: string; slug: string }>; quiet: string }
interface WorkJson { eyebrow: string; heading: string; body: string; links: Array<{ label: string; href: string }> }

/** An app route (`#/tool/design`) goes through appHref (carries the reader's
 *  locale); anything else is a site path through localizeHref. */
const landingCtaHref = (lang: Lang, href: string): string => (href.startsWith('#') ? appHref(lang, href) : localizeHref(lang, href));

/**
 * The Cover Flow motion: shells/web/src/lib/covers-flow.ts, bundled ONCE per
 * build into the landing's inline covers script. It is the very module the
 * in-app reader imports for #/docs/index (lib/docs-landing.ts), so the two
 * surfaces cannot drift - the earlier hand-kept twin (COVERS_JS here plus a
 * TypeScript copy there) is gone. esbuild is already the docs player's bundler.
 */
let _coversJs: string | null = null;
function coversScript(): string {
  if (_coversJs === null) {
    const out = buildSync({
      entryPoints: [resolve(repoRoot, 'shells/web/src/lib/covers-flow.ts')],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'LollyCoverFlow',
      minify: true,
      platform: 'browser',
      target: 'es2019',
      logLevel: 'silent',
    });
    _coversJs = out.outputFiles[0]!.text.trim();
  }
  return `<script>\n${_coversJs}\nLollyCoverFlow.mountCoverFlow(document);\n</script>`;
}

/**
 * The lolly.work band (Andy, 2026-09-02): one small beat for the organisation that
 * wants the same tools with governance around them - the control plane that lives
 * in the public lolly-work repository and the hosted sandbox at lolly.work. Copy:
 * docs/site/work.json; the two links are external, so they open in a new tab.
 * Product-level only: what it does, where the code is, where to try it.
 */
function workBand(lang: Lang): string {
  const w = loadLandingJson<WorkJson>('work.json');
  void lang;
  return `<section class="work-section" id="work">
  <div class="work-inner reveal">
    <span class="work-eyebrow">${esc(w.eyebrow)}</span>
    <div class="work-cols">
      <div class="work-copy">
        <h2 class="work-heading">${esc(w.heading)}</h2>
        <p class="work-body">${esc(w.body)}</p>
      </div>
      <div class="work-links">
        ${w.links.map((l, i) => `<a class="${i === 0 ? 'btn btn-primary btn-compact' : 'work-link'}" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('\n        ')}
      </div>
    </div>
  </div>
</section>`;
}

/**
 * Block 5 - who is behind this, and why. The progressive-disclosure turn, and the
 * only block on the page where "we" is the subject. Origin and stewardship only:
 * no roadmap, no commitments, no product copy. Copy: docs/site/behind.json.
 *
 * The sceptic paragraph has three homes (behind.json, docs/faq.md, docs/trust.md)
 * and one wording; tests/docs-claims.test.ts pins the three byte-identical. It
 * stands alone since 2026-09-02 (Andy: "shorten the Who is behind this section") -
 * the SUSE assurance paragraph that used to sit beside it lives on trust.md and the
 * operators' Security lane. Public facts only, never headcounts.
 */
function whoIsBehindBlock(lang: Lang): string {
  const b = loadLandingJson<BehindJson>('behind.json');
  return `<section class="behind-section" id="behind">
  <div class="behind-inner reveal">
    <span class="behind-eyebrow">${esc(b.eyebrow)}</span>
    <p class="behind-para behind-para--solo">${inline(b.sceptic)}</p>
    <div class="behind-foot">
      ${FOUNDED_BY}
      <div class="behind-links">
        ${b.links.map((l) => `<a href="${esc(localeHref(lang, l.slug))}">${esc(l.label)}</a>`).join('\n        <span class="behind-dot" aria-hidden="true">·</span>\n        ')}
      </div>
    </div>
    <p class="behind-quiet">${esc(b.quiet)}</p>
  </div>
</section>`;
}

// ── The landing (plans/177: five beats, top to bottom) ───────────────────────
// 1 hero ("Lolly is …" cycling its five claims) · 2 covers (the studios in the
// app's own Cover Flow gesture) · 3 what/why (the counts; the sovereignty
// statement's one home) · 4 the persona device (top tabs + side tabs, CSS-only
// radios so the in-app reader rehosts it working, scripts stripped) · 5 who is
// behind this. Everything the previous landing carried beyond these lives on
// the docs page the plan's disposition table names. The copy is docs/site/*.json;
// only the hero's tagline and one-liner come from site.md.
function buildLandingContent(md: string, lang: Lang = 'en') {
  const rawSections = md.split(/\n---\n/);
  const heroSection = rawSections[0]!;
  // The hero tag + one-liner: site.md section[0]'s non-heading lines. A locale
  // twin not yet re-translated still carries its old multi-line subtitle; the
  // extra lines simply render as further subtitle rows until the wave.
  const heroLines = heroSection.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => esc(l.trim()));

  const hero = loadLandingJson<HeroChrome>('hero-chrome.json');
  if (hero.cycle.length < 2) throw new Error('docs/site/hero-chrome.json: the hero cycle needs at least two words');
  const cycleData = hero.cycle.map(c => ({ w: c.word, h: localeHref(lang, c.slug) }));

  const HERO_CYCLE_JS = `<script>
(function(){
  var a=document.getElementById('heroCycle');if(!a)return;
  var data;try{data=JSON.parse(a.getAttribute('data-cycle'))}catch(e){return}
  if(!data||data.length<2)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return; // the first word stands
  var word=a.querySelector('span')||a,i=0,hold=0;
  function set(n){
    i=(n+data.length)%data.length;
    a.classList.add('is-swapping');
    setTimeout(function(){word.textContent=data[i].w;a.setAttribute('href',data[i].h);a.classList.remove('is-swapping');},240);
  }
  // Hovering or focusing the word holds the cycle so it stays clickable.
  a.addEventListener('mouseenter',function(){hold=Math.max(hold,Date.now()+6000);});
  a.addEventListener('focus',function(){hold=Math.max(hold,Date.now()+6000);});
  setInterval(function(){if(Date.now()>hold&&!document.hidden)set(i+1);},2800);
})();
</script>`;

  // ── beat 1: hero ───────────────────────────────────────────────────────────
  const heroHtml = `<section class="hero">
  <div class="hero-inner">
  <div class="hero-heading">
    <div class="hero-logo-slot"><div class="hero-logo-mark"><a href="${esc(localizeHref(lang, '/'))}" class="hero-logo-link" aria-label="Open Lolly - browse all tools"><img src="/info/icon.svg" alt="Lolly" class="hero-logo"><img src="/icons/hero-still.png" alt="" aria-hidden="true" class="hero-logo-still"></a></div>${HERO_VERIFY(lang)}</div>
  </div>
  <div class="hero-details">
    <h1 class="hero-statement hero-statement--cycle"><span class="cycle-lead">${esc(hero.lead)}</span>
      <a id="heroCycle" class="cycle-word" data-cycle="${esc(JSON.stringify(cycleData)).replace(/"/g, '&quot;')}" href="${esc(localeHref(lang, hero.cycle[0]!.slug))}"><span>${esc(hero.cycle[0]!.word)}</span></a>
      <span class="sr-only">${esc(hero.cycle.slice(1).map(c => c.word).join(', '))}</span></h1>
    <p class="subtitle">${heroLines.join('<br>')}</p>
    <div class="hero-cta">
      ${hero.ctas.map(c => `<a href="${esc(localizeHref(lang, c.href))}" class="${esc(c.class)}">${esc(c.label)}</a>`).join('\n      ')}
    </div>
  </div>
  </div>
</section>`;

  // ── beat 2: the covers ─────────────────────────────────────────────────────
  // Ten studios in the app's own Cover Flow. Day-one images are committed docs
  // shots (/info/shots/); a cover with `video` becomes a muted loop (WebM or
  // MP4) with `img` as its poster - the posed covers drop files in and edit JSON.
  // The base layout is a scroll-snap filmstrip that swipes natively (and works
  // with scripts stripped); coversScript() upgrades it to the 3-D fan from
  // 720px up. `href` is an app route (appHref carries the reader's locale).
  const cv = loadLandingJson<CoversJson>('covers.json');
  const coverMedia = (c: LandingCover): string => c.video
    ? `<video src="/info/shots/${esc(c.video)}" poster="/info/shots/${esc(c.img)}" autoplay muted loop playsinline preload="metadata" aria-label="${esc(c.alt)}"></video>`
    : `<img src="/info/shots/${esc(c.img)}" alt="${esc(c.alt)}" loading="lazy" decoding="async">`;
  // No heading row above the fan (Andy, 2026-09-02: "remove this row of text,
  // it's not needed") - the covers speak for themselves.
  const coversHtml = `<section class="covers-section" id="covers">
  <div class="covers-inner">
    <div class="covers" id="coversRoot" role="region" aria-roledescription="carousel" aria-label="${esc(cv.label)}" tabindex="0">
      <div class="covers-strip" id="coversStrip">
        ${cv.covers.map((c, i) => `<a class="cover-card${i === 0 ? ' is-cur' : ''}" data-i="${i}"${typeof c.hue === 'number' ? ` data-hue="${c.hue}"` : ''} href="${esc(appHref(lang, c.href))}">
          ${coverMedia(c)}
          <span class="cover-cap"><b>${esc(c.name)}</b><i>${esc(c.promise)}</i></span>
        </a>`).join('\n        ')}
      </div>
      <a class="covers-open-btn" id="coversOpen" data-tpl="${esc(cv.open)}" href="#"><span></span> <span aria-hidden="true">→</span></a>
      <div class="covers-nav" hidden>
        <button type="button" class="covers-btn" data-covers="prev" aria-label="${esc(cv.prev)}">‹</button>
        <div class="covers-dots" role="tablist" aria-label="${esc(cv.pick)}"></div>
        <button type="button" class="covers-btn" data-covers="next" aria-label="${esc(cv.next)}">›</button>
      </div>
    </div>
  </div>
</section>`;

  // ── beat 3: what / why ─────────────────────────────────────────────────────
  // The Why column is the home of the offline claim (plans/177 moved it here
  // from the retired standalone block; still said once) - the short form, Andy
  // 2026-09-02; the full statement lives on docs/trust.md verbatim. The counts
  // are LIVE: whatwhy.json names a counter, never a number.
  const ww = loadLandingJson<WhatWhyJson>('whatwhy.json');
  const counts = formatCounts();
  const LIVE_COUNTS: Record<string, number> = { tools: TOOL_COUNT, formatsOut: counts.out, formatsIn: counts.in, languages: LANGS.length };
  const stats = ww.stats.map((s) => {
    const n = LIVE_COUNTS[s.count];
    if (n === undefined) throw new Error(`docs/site/whatwhy.json: unknown live counter "${s.count}" (one of ${Object.keys(LIVE_COUNTS).join(', ')})`);
    return { n: String(n), label: s.label, slug: s.slug };
  });
  const whatWhyHtml = `<section class="whatwhy-section" id="why">
  <div class="whatwhy-inner">
    <div class="whatwhy-col reveal">
      <span class="whatwhy-eyebrow">${esc(ww.what.eyebrow)}</span>
      <h2 class="whatwhy-big">${esc(ww.what.heading)}</h2>
      <p class="whatwhy-body">${esc(ww.what.body)}</p>
      <div class="whatwhy-stats">
        ${stats.map(s => `<a class="whatwhy-stat" href="${esc(localeHref(lang, s.slug))}"><b>${esc(s.n)}</b><span>${esc(s.label)}</span></a>`).join('\n        ')}
      </div>
      <a class="whatwhy-more" href="${esc(localeHref(lang, ww.what.more.slug))}">${esc(ww.what.more.label)} <span aria-hidden="true">→</span></a>
    </div>
    <div class="whatwhy-col reveal reveal-2">
      <span class="whatwhy-eyebrow">${esc(ww.why.eyebrow)}</span>
      <h2 class="whatwhy-big">${esc(ww.why.heading)}</h2>
      <p class="whatwhy-maxim">${inline(ww.why.statement)}</p>

      <div class="whatwhy-receipts">
        ${ww.why.receipts.map((r) => `<a href="${esc(localeHref(lang, r.slug))}">${esc(r.label)}</a>`).join('\n        <span class="sovereign-dot" aria-hidden="true">·</span>\n        ')}
      </div>
      <a class="whatwhy-more" href="${esc(localeHref(lang, ww.why.more.slug))}">${esc(ww.why.more.label)} <span aria-hidden="true">→</span></a>
    </div>
  </div>
</section>`;

  // ── beat 4: the persona device ─────────────────────────────────────────────
  // Top tabs (Creators / Builders / Operators) with SIDE TABS for the
  // sub-sections (Andy, 2026-09-02): detail without leaving the door. CSS-ONLY,
  // the audience-strip precedent: hidden radios + labels + nth-matched pairing
  // rules in docs-landing.css, so the in-app reader (which strips scripts)
  // rehosts a fully working device. Keyboard is the native radio group. Each
  // pane's primary call to action jumps into the APP; the docs page is the
  // compromise (plans/177 CTA policy - the URLs are pinned in docs-claims).
  // The door tabs wear the quokka / koala / echidna. A lane with `mascot` (the
  // magpie guards Security) shows it figure-sized beside its pane's copy, at the
  // inline end, through the same credentialed wrapper as the import band's
  // kookaburra - not on the side tab, where a 24px glyph read as an icon (Andy,
  // 2026-09-02). It is emitted BEFORE the copy so the phone stylesheet can float
  // it and wrap the copy around it; desktop `order` moves it to the end of the
  // row. Drop a credentialed .webp into shells/web/public/info/mascots/ and
  // name it in persona.json.
  const persona = loadLandingJson<PersonaJson>('persona.json');
  const lanePane = (l: Lane): string => `<div class="lane-pane">
    ${l.mascot ? credentialedMascot(`/info/mascots/${esc(l.mascot)}.webp`, 'lane-mascot') : ''}
    <div class="lane-copy">
      <h3>${esc(l.tab)}</h3>
      <p class="lane-pitch">${esc(l.pitch)}</p>
      ${l.links ? `<ul class="lane-links">${l.links.map(k => `<li><a href="${esc(k.href ? landingCtaHref(lang, k.href) : localeHref(lang, k.slug ?? 'index'))}"><span>${esc(k.label)}</span>${k.note ? `<code>${esc(k.note)}</code>` : ''}</a></li>`).join('')}</ul>` : ''}
      <div class="lane-cta">
        ${l.cta ? `<a class="btn btn-primary btn-compact" href="${esc(landingCtaHref(lang, l.cta.href))}">${esc(l.cta.label)}</a>` : ''}
        <a class="lane-doc" href="${esc(localeHref(lang, l.doc.slug))}">${esc(l.doc.label)} <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </div>`;
  const doorPane = (d: Door): string => `<div class="persona-pane" data-door="${esc(d.id)}">
    ${d.lanes.map((l, i) => `<input class="lane-radio" type="radio" name="lane-${esc(d.id)}" id="lane-${esc(d.id)}-${i}"${i === 0 ? ' checked' : ''} aria-label="${esc(l.tab)}">`).join('\n    ')}
    <div class="lane-cols">
      <div class="lane-tabs">
        ${d.lanes.map((l, i) => `<label class="lane-tab" for="lane-${esc(d.id)}-${i}"><span>${esc(l.tab)}</span></label>`).join('\n        ')}
      </div>
      <div class="lane-panes">
        ${d.lanes.map(lanePane).join('\n        ')}
      </div>
    </div>
  </div>`;
  const personaHtml = `<section class="persona-section" id="who">
  <div class="persona-inner">
    <h2 class="persona-title reveal">${esc(persona.title)}</h2>
    ${persona.doors.map((d, i) => `<input class="persona-radio" type="radio" name="persona-door" id="door-${esc(d.id)}"${i === 0 ? ' checked' : ''} aria-label="${esc(d.name)}">`).join('\n    ')}
    <div class="persona-tabs">
      ${persona.doors.map((d) => `<label class="persona-tab" for="door-${esc(d.id)}"><span class="persona-name">${esc(d.name)}</span><span class="persona-sub">${esc(d.sub)}</span><img class="persona-mascot" src="/info/mascots/${esc(d.mascot)}.webp" alt="" loading="lazy" decoding="async"></label>`).join('\n      ')}
    </div>
    <div class="persona-panes">
      ${persona.doors.map(doorPane).join('\n      ')}
    </div>
  </div>
</section>`;

  // ── beat 4a: get the app ───────────────────────────────────────────────────
  // The download rail closed the hero until 2026-09-02; it now sits between the
  // persona device and the lolly.work band (Andy), so a reader meets the tiles
  // after the pitch rather than before it. Same rail, same tile styles: the band
  // paints the hero's dark surface under it so the on-band-dark colours hold.
  const downloadsHtml = `<section class="downloads-section" id="get-the-app">
  <div class="downloads-inner reveal">
    ${downloadsRail(lang)}
  </div>
</section>`;

  const NAV_SOLID_JS = `<script>
(function(){
  var nav=document.querySelector('nav');
  var hero=document.querySelector('.hero');
  // The floating Listen pill rides the same measurement (plans/168 WP-6). At 393px the
  // hero's CTA stack fills the bottom of the first screen, so a bottom-right pill would
  // sit on the hero's controls - a tap collision, not just a smudge. While the hero is
  // on screen the pill docks under the top nav instead; everywhere else it is the
  // ordinary bottom-right float. Class is toggled at every width, the move is CSS-gated
  // to phones (LISTEN_STYLE), so desktop is untouched.
  var listen=document.querySelector('.listen-bar-float');
  // The dark wrap holds the hero AND the covers band (one chip field behind both);
  // its gradient is sized to the hero through --hero-h so the covers stay flat.
  var wrap=document.querySelector('.hero-wrap');
  function fitHero(){if(wrap&&hero)wrap.style.setProperty('--hero-h',hero.offsetHeight+'px');}
  if(window.ResizeObserver&&hero)new ResizeObserver(fitHero).observe(hero);
  fitHero();
  function updateNav(){
    var heroBottom=hero?hero.getBoundingClientRect().bottom:0;
    nav.classList.toggle('nav-solid',heroBottom<=0);
    if(listen)listen.classList.toggle('over-hero',heroBottom>0);
  }
  window.addEventListener('scroll',updateNav,{passive:true});
  updateNav();
})();
</script>`;

  // The hero and the covers band share one dark surface: the wrap holds both, so
  // the chip field (#heroCanvas, absolute inset:0) runs on behind the covers
  // (Andy, 2026-09-02). The wrap's gradient is sized to the hero alone (--hero-h,
  // measured in NAV_SOLID_JS), so the covers keep the flat colour they had as a
  // band of their own.
  const darkBandHtml = `<div class="hero-wrap">
<canvas id="heroCanvas" aria-hidden="true"></canvas>
${heroHtml}
${coversHtml}
</div>`;
  return `${darkBandHtml}
${whatWhyHtml}
${personaHtml}
${downloadsHtml}
${workBand(lang)}
${whoIsBehindBlock(lang)}
${NAV_SOLID_JS}
${HERO_CYCLE_JS}
${coversScript()}`;
}

// ═══ LANDING COPY REGION END ═════════════════════════════════════════════════

// ── Format side-door pages (plan 116 workstream A) ───────────────────────────
// One generated page per register format (/info/formats/<token>/) and one per
// curated conversion (/info/convert/<in>-to-<out>/). Structurally identical
// across formats on purpose: the content is derived from the register, so a page
// can never promise more than the register lists. The page-model logic is pure
// and lives in ./formats-pages.ts; the HTML chrome below reads it and reuses the
// same wrapPage the rest of the site uses.
//
// The fixed labels below all pass through t(), so translating this small skeleton
// once localises every generated page in every locale. The format NAMES and the
// register descriptions stay English (the register says so, and the formats
// dialog already renders them English-only).

/** A JSON-LD SoftwareApplication block for a generated page (offers price 0, MPL-2.0). */
function sideDoorJsonLd(opts: { name: string; description: string; url: string; featureList: string[] }): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Lolly',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web, Windows, macOS, Linux, iOS, Android',
    description: opts.description,
    url: opts.url,
    featureList: opts.featureList,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
    license: 'https://www.mozilla.org/en-US/MPL/2.0/',
    isAccessibleForFree: true,
  };
  // Escape the closing-tag opener so the JSON can never break out of the script.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** The shared in-content footer both side-door page kinds carry: the why-free
 *  line, then three onward paths (do it, browse every format, learn the app).
 *  Three real routes because a side-door searcher is the likeliest first-time
 *  visitor, and one competitor link was their only exit before. */
function sideDoorFoot(lang: Lang, appHash: string): string {
  return `<footer class="sidedoor-foot">
    <p class="sidedoor-foot-why"><strong>${esc(t('Why is this free?'))}</strong> ${esc(t('Lolly is open source and made by SUSE, who use it every day.'))}</p>
    <nav class="sidedoor-foot-links">
      <a class="sidedoor-foot-link" href="${esc(appHref(lang, appHash))}">${esc(t('Do it now'))} <span aria-hidden="true">→</span></a>
      <a class="sidedoor-foot-link" href="${esc(localeHref(lang, 'formats'))}">${esc(t('Every format Lolly can open and make'))}</a>
      <a class="sidedoor-foot-link" href="${esc(localeHref(lang, 'quickstart'))}">${esc(t('Start with the quickstart'))}</a>
    </nav>
  </footer>`;
}

/** The one contrast line every side-door page carries above the fold. The person
 *  arriving here searched a format or a conversion and normally lands on an
 *  upload site; category prose only, no vendor named. */
function sideDoorContrastLine(): string {
  return `<p class="sidedoor-contrast">${esc(t('Most tools like this are upload sites: your file goes to their server, and ads pay the bill. Lolly runs on your device, so your file stays with you.'))}</p>`;
}

/** The reads/writes/round-trip line, chosen by direction (fixed labels via t()). */
function sideDoorDirLine(dir: 'in' | 'out' | 'both'): string {
  const key = dir === 'both' ? 'Lolly opens and makes this format'
    : dir === 'in' ? 'Lolly opens this format'
    : 'Lolly makes this format';
  return esc(t(key));
}

/** /info/formats/<token>/ - one page per register format. */
function renderFormatSideDoor(model: FormatPageModel, lang: Lang): string {
  const url = `${SITE_URL}${localeHref(lang, `formats/${model.slug}`)}`;
  const provLine = model.provenance
    ? t('Content Credentials survive this format')
    : t('This format carries no Content Credential');
  const feats = model.featureLabels
    .map((label) => `<li>${esc(label)}</li>`).join('');
  const cat = FMT_CAT_ICON[model.category] || '';
  return `<article class="sidedoor page-format">
    <div class="sidedoor-eyebrow">${cat}<span>${esc(t('Format'))} · ${esc(model.category)}</span></div>
    <h1>${esc(model.name)}</h1>
    <p class="sidedoor-full">${esc(model.full)}</p>
    <p class="sidedoor-dir">${sideDoorDirLine(model.dir)}</p>
    <p class="sidedoor-lead">${esc(model.desc)}</p>
    ${sideDoorContrastLine()}
    <ul class="sidedoor-promise">
      <li>${esc(t('Runs on your device'))}</li>
      <li>${esc(t('Free, no account'))}</li>
    </ul>
    <a class="sidedoor-cta" href="${esc(appHref(lang, model.appHash))}">${esc(t('Do it now'))} <span aria-hidden="true">→</span></a>
    <section class="sidedoor-detail">
      <h2>${esc(t('What Lolly supports'))}</h2>
      ${feats ? `<ul class="sidedoor-feats">${feats}</ul>` : ''}
      <p class="sidedoor-prov">${esc(provLine)}</p>
      <p class="sidedoor-offline">${esc(t('Everything happens on your device, so it works with the Wi-Fi off.'))}</p>
    </section>
    ${sideDoorJsonLd({ name: model.name, description: model.description, url, featureList: model.featureLabels })}
    ${sideDoorFoot(lang, model.appHash)}
  </article>`;
}

/** /info/convert/<in>-to-<out>/ - one page per curated conversion pair. */
function renderConvertSideDoor(model: ConvertPageModel, lang: Lang): string {
  const url = `${SITE_URL}${localeHref(lang, `convert/${model.slug}`)}`;
  const provLine = model.provenance
    ? t('Content Credentials survive this format')
    : t('This format carries no Content Credential');
  // What carries over (plans/144 O1): the static twin of the converter's own
  // disclosure line. The container names come from the register (the input's
  // reads intersected with the output's writes); the sentence after them is the
  // carry story for this KIND of pair, so a page never promises a carry the
  // pipeline does not perform.
  const carryTail = model.carryKind === 'converter'
    ? t('The converter moves the description, author, copyright and capture date into the new file. Location stays behind unless you turn it on, and a Content Credential cannot be copied: it is bound to the original bytes.')
    : model.carryKind === 'font'
      ? t('Every table in the font, its name and licence records included, passes through untouched.')
      : t('Nothing embedded carries over: the new file is written fresh with Lolly\'s own details, and your original keeps its own.');
  const carryNames = model.carryKind === 'converter' && model.carriesLabels.length
    ? `${model.carriesLabels.join(', ')} - `
    : '';
  const carryLine = `${t('What carries over')}: ${carryNames}${carryTail}`;
  const outFeats = model.outFeatureLabels.map((label) => `<li>${esc(label)}</li>`).join('');
  return `<article class="sidedoor page-convert">
    <div class="sidedoor-eyebrow">${DOC_ICONS.convert}<span>${esc(t('Convert'))}</span></div>
    <h1>${esc(model.title)}</h1>
    <div class="sidedoor-convert-cols">
      <div class="sidedoor-col">
        <span class="sidedoor-col-label">${esc(t('What goes in'))}</span>
        <strong>${esc(model.inName)}</strong>
        <p>${esc(model.inDesc)}</p>
      </div>
      <span class="sidedoor-convert-arrow" aria-hidden="true">→</span>
      <div class="sidedoor-col">
        <span class="sidedoor-col-label">${esc(t('What comes out'))}</span>
        <strong>${esc(model.outName)}</strong>
        <p>${esc(model.outDesc)}</p>
      </div>
    </div>
    ${sideDoorContrastLine()}
    <ul class="sidedoor-promise">
      <li>${esc(t('Runs on your device'))}</li>
      <li>${esc(t('Free, no account'))}</li>
      <li>${esc(t('Nothing is uploaded'))}</li>
    </ul>
    <a class="sidedoor-cta" href="${esc(appHref(lang, model.appHash))}">${esc(t('Do it now'))} <span aria-hidden="true">→</span></a>
    <section class="sidedoor-detail">
      <h2>${esc(t('What Lolly supports'))}</h2>
      ${outFeats ? `<ul class="sidedoor-feats">${outFeats}</ul>` : ''}
      <p class="sidedoor-carry">${esc(carryLine)}</p>
      <p class="sidedoor-prov">${esc(provLine)}</p>
      <p class="sidedoor-offline">${esc(t('Everything happens on your device, so it works with the Wi-Fi off.'))}</p>
    </section>
    ${sideDoorJsonLd({ name: model.title, description: model.description, url, featureList: model.outFeatureLabels })}
    ${sideDoorFoot(lang, model.appHash)}
  </article>`;
}

// ── HTML template ─────────────────────────────────────────────────────────────

// The app's design tokens, inlined verbatim (comments/blank lines stripped) so the docs
// share ONE source of truth with the web shell - the same [data-theme] light/dark/brand
// system, the same shadcn HSL-triple slots (--background/--foreground/--primary/--muted/
// --border/--radius/--font-brand/…), and the same a11y-contrast overrides. In the app shell
// (the in-app docs view, M2) brand-vars.ts overrides these per active brand, so the docs go
// brand-reactive for free; the static site ships the neutral values below. The DOCS_BRIDGE
// after it expresses this file's legacy token names (--text/--page/--green/…) in these slots,
// so the ~300 var() call sites across the docs stylesheet follow the app theme unchanged.
const APP_TOKENS = readFileSync(resolve(repoRoot, 'shells/web/src/styles/tokens.css'), 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\n\s*\n/g, '\n')
  .trim();

// The landing bands, single-sourced as a real stylesheet: the static front door
// below and the in-app docs reader (plans/123 decision D2) both render the same
// bytes, so neither surface can drift from the other. Read verbatim, unlike
// APP_TOKENS above: the web shell imports this same file, and a comment stripped
// here would be a comment missing there.
const LANDING_CSS = readFileSync(resolve(repoRoot, 'shells/web/src/styles/parts/docs-landing.css'), 'utf-8');

const CSS = `
/* Self-hosted SUSE variable fonts - same-origin, no CDN egress; mirrors shells/web/src/styles/fonts.css,
   including its source ORDER: the shell copy under /fonts/ ships on every profile, the brand catalog
   under /catalog/fonts/ only under a pack that has one. Listing the catalog alone (as this did before
   2026-08-10) meant the whole docs site fell back to a system font on the neutral profile. */
@font-face{font-family:'SUSE';src:url('/fonts/SUSE[wght].woff2') format('woff2-variations'),url('/catalog/fonts/webfonts/SUSE[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:'SUSE';src:url('/fonts/SUSE-Italic[wght].woff2') format('woff2-variations'),url('/catalog/fonts/webfonts/SUSE-Italic[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:italic;font-display:swap}
@font-face{font-family:'SUSE Mono';src:url('/fonts/SUSEMono[wght].woff2') format('woff2-variations'),url('/catalog/fonts/webfonts/SUSEMono[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:'SUSE Mono';src:url('/fonts/SUSEMono-Italic[wght].woff2') format('woff2-variations'),url('/catalog/fonts/webfonts/SUSEMono-Italic[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:italic;font-display:swap}
/* Cinzel (SIL OFL 1.1, see /info/fonts/Cinzel-OFL.txt) - Roman inscriptional capitals,
   the same source Gill drew Perpetua Titling from. Self-hosted, not fetched from
   fonts.gstatic.com: a third-party request on every docs page would contradict what
   server-surface.md tells the reader. Latin subset only, 26 KB, loaded on one page. */
@font-face{font-family:'Cinzel';src:url('/info/fonts/cinzel-latin.woff2') format('woff2-variations');font-weight:400 900;font-style:normal;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122,U+2212}
${APP_TOKENS}
/* Bridge: the docs' legacy token names, expressed in the app's design tokens above, so the
   whole docs stylesheet follows the app's [data-theme] light/dark/brand system and - inside
   the app shell - the active brand. Neutrals/surfaces map cleanly; the ACCENT (--green ->
   --primary) is the one design choice to review: the app's primary is deep teal in light,
   pine green in dark/brand, so light-mode links become teal rather than green. */
:root{
  --page:hsl(var(--background));
  --text:hsl(var(--foreground));
  --muted:hsl(var(--muted-foreground));
  --border:hsl(var(--border));
  --pale:hsl(var(--muted));
  --green:hsl(var(--primary));
  --dark:hsl(var(--foreground));
  --light:hsl(var(--primary)/0.4);
  --red:hsl(var(--destructive));
  /* The deep, ALWAYS-DARK marketing-band / chrome surface (nav, hero, platform, assure,
     about, everywhere, pathways). It must stay dark in EVERY theme - unlike --background/
     --card which flip light in the light theme, and unlike --primary which goes pine-green
     in dark/brand. Default is the SUSE deep teal (= the old #0c322c); brand-vars.ts will
     override it per active brand in the app shell (M2) so a self-hosted org's dark bands
     carry their brand. Fixes the M1 bug where these bands used var(--dark) (=--foreground),
     which inverted to near-white text-on-band in dark mode. */
  --band-dark:171 62% 12%;
  /* The always-LIGHT ink that rides on --band-dark (headings, nav wordmark, nav/hero/
     platform/assure/everywhere/about/pathways copy). Paired with --band-dark so the
     always-dark chrome is fully brand-reactive: a self-hosted brand overrides BOTH the
     band surface and its on-dark ink. Defaults to white, so the neutral build renders
     byte-identical to the old hardcoded #fff. Crucially it is a dedicated token, NOT
     --primary-foreground: that one flips to BLACK under [data-a11y-contrast=high] in
     dark/brand, which would turn every band's white text black-on-dark. --on-band-dark
     stays light in every theme + contrast mode, so the a11y contract holds. */
  --on-band-dark:0 0% 100%;
  /* The always-BRIGHT accent that rides on --band-dark for CTAs on the dark chrome (the
     nav "Launch App" pill). Band-invariant like the pair above: the nav is dark in every
     theme, so its CTA must POP in every theme - it can't borrow --primary, which goes deep
     teal in the LIGHT theme and would sink the button into the dark band. Default is the
     pine green (= dark/brand --primary, the old bright SUSE green); brand-vars.ts overrides
     it per active brand in the app shell. Paired with --band-dark as its ink (dark-on-green,
     the original CTA look). */
  --band-accent:151 57% 46%;
  --orange:#fe7c3f;--navy:#192072;--blue:#2453ff;
  --col-cap:38rem;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'SUSE',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--text);background:var(--page);line-height:1.65}
a{color:var(--green);text-decoration:none}
a:hover{text-decoration:underline}
/* Safety net for inline icon SVGs: every one carries only a viewBox (no width/height),
   so without a scoped size rule it balloons to the CSS default 300×150 - or stretches to
   fill a flex/grid parent - and reads as an unfinished giant glyph. Default them to a
   text-sized square; sized contexts (.icon-*, .assure-card-ic, illustrations, …) override
   this with a more specific selector. Keeps a missing/renamed rule from ever ballooning. */
svg{width:1em;height:1em;flex:none}
code{font-family:var(--brand-font),'SUSE Mono','SF Mono','Fira Code',monospace;font-size:.875em;background:hsl(var(--muted));padding:.15em .35em;border-radius:3px}
pre{background:hsl(var(--muted));color:hsl(var(--foreground));padding:1.25rem 1.5rem;border-radius:8px;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.875rem;line-height:1.5;margin-bottom:1.25rem; box-shadow: inset 0 .2rem .4rem #0002, 0 1px #fff2}
pre code{background:none;padding:0;color:inherit;font-size:1em}
h1,h2,h3,h4{line-height:1.25;font-weight:700}
h2{font-size:2rem;letter-spacing:0;font-weight:900;text-transform:uppercase}
p{margin-bottom:2rem}
ul{padding-left:1.25rem;margin-bottom:1rem}
li{margin-bottom:.35rem}
blockquote{border-left:0; box-shadow:0 0 0 1px #30ba7825, inset 0 1px #fff3, inset 0 -1px #0001, 0 .1rem 2.4rem #30ba7855;  border-radius: 2em; padding: 1.5rem 2.25rem;background:var(--pale);margin:4rem 0;transform:scale(1.1)}
blockquote p{margin:0}
hr{border:none;border-top:1px solid var(--border);margin:2rem 0}
strong{font-weight:600}

/* Nav */
nav{display:flex;align-items:center;gap:.25rem;padding:0 1.5rem;height:3.75rem;background:transparent;position:fixed;width:100%;top:0;z-index:100;overflow-x:auto;transition:background .25s}
nav.nav-solid{background:hsl(var(--band-dark))}
/* Phones: the top nav always carries its ground (plans/168 WP-6). Transparent-over-hero
   is a desktop luxury - at 393px the hero's trust-chip row scrolls straight under the
   bar and two rows of small text collide with the nav links. The :not()s keep this off
   the quicknav and the doc jump nav, which paint their own surfaces. */
@media(max-width:600px){
  nav:not(.quicknav):not(.doc-jump-nav){background:hsl(var(--band-dark) / .94);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
}
/* On-page quick nav - a sticky jump bar under the top nav, on the landing only. */
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
section[id]{scroll-margin-top:6.4rem}
/* The nav sits on #0c322c in BOTH themes (nav.nav-solid, and the dark hero on the
   landing page), so its text needs a fixed light colour. It used var(--pale),
   which the dark theme redefines to #0d2419 - near-identical to that background,
   about 1.1:1, so the wordmark disappeared in dark mode. Every other nav control
   already uses a literal white for this reason. */
.brand{display:inline-flex;align-items:center;gap:.5rem;font-weight:800;color:hsl(var(--on-band-dark));font-size:1.05rem;white-space:nowrap;margin-right:.75rem;letter-spacing:-.01em;text-transform:uppercase}
.brand:hover{color:var(--light);text-decoration:none}
.brand-icon{width:1.5rem;height:1.5rem;border-radius:5px;flex-shrink:0;object-fit:contain}
/* Draft marker in the nav. English pages only (see buildNav) - the translated
   pages are a fallback to English source anyway, and a red pill nobody can read
   in their own language is a worse signal than none. flex:none so the scrolling
   nav can never squeeze it to unreadable. */
.nav-draft{display:inline-flex;align-items:center;flex:none;font-family:'SUSE Mono','SF Mono','Fira Code',monospace;font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:hsl(var(--on-band-dark));background:var(--red);padding:.15em .6em;border-radius:999px;margin-right:.75rem;white-space:nowrap}
nav .gap{flex:1}
/* The <label> wrapping the icon + <select> is the WHOLE hit area - a generous
   pill, matching .nav-theme-toggle's footprint - not just the select's own tight
   text box. Clicking/tapping the icon activates the select exactly like clicking
   the text does (native label→control delegation), and since hover/focus is
   styled on the label, the icon (fill="currentColor") and the select text pick up
   the SAME colour change together via inheritance - no separate icon hover rule. */
.nav-lang-picker-wrap{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .75rem .45rem .6rem;border-radius:2em;color:hsl(var(--on-band-dark) / .55);cursor:pointer;transition:color .12s,background .12s}
.nav-lang-picker-wrap:hover,.nav-lang-picker-wrap:focus-within{color:hsl(var(--on-band-dark));background:rgba(255,255,255,.1)}
.nav-lang-picker-wrap .lang-switch-icon{width:16px;height:16px;flex-shrink:0;pointer-events:none}
.nav-lang-picker{background:transparent;color:inherit;border:none;font-size:.8125rem;cursor:pointer;padding:0}
.nav-lang-picker option{color:#000}
nav:not(.quicknav):not(.doc-jump-nav) a:not(.brand):not(.nav-launch){color:hsl(var(--on-band-dark) / .55);font-size:.8125rem;padding:.25rem .5rem;white-space:nowrap;border-radius:2em;transition:color .12s}
nav:not(.quicknav):not(.doc-jump-nav) a:not(.brand):not(.nav-launch):hover{color:hsl(var(--on-band-dark));text-decoration:none}
nav:not(.quicknav):not(.doc-jump-nav) a.active:not(.nav-launch){color:hsl(var(--on-band-dark))}
/* Top-nav clusters: tight within a group, a thin divider between groups. */
nav .nav-group{display:inline-flex;align-items:center;gap:.0625rem}
nav .nav-group + .nav-group{margin-left:.5rem;padding-left:.625rem;border-left:1px solid rgba(255,255,255,.18)}
.nav-launch{background:hsl(var(--band-accent));color:hsl(var(--band-dark))!important;padding:.375rem 1rem;border-radius:1.5em;font-weight:700;font-size:.875rem;white-space:nowrap;margin-left:.5rem;transition:background .15s}
.nav-launch:hover{background:hsl(var(--band-accent) / .82);text-decoration:none!important}

/* Language FAB menu - popup language selector matching the app UX */
.lang-fab-wrap{display:inline-flex}
.lang-fab{background:none;border:none;padding:.45rem .6rem;border-radius:2em;color:hsl(var(--on-band-dark) / .55);cursor:pointer;transition:color .12s,background .12s;width:32px;height:32px;display:flex;align-items:center;justify-content:center}
.lang-fab:hover{color:hsl(var(--on-band-dark));background:rgba(255,255,255,.1)}
.lang-fab svg{width:24px;height:24px}
.lang-menu{position:fixed;top:auto;right:1.5rem;margin-top:0;background:hsl(var(--band-dark) / .98);border:1px solid rgba(255,255,255,.15);border-radius:8px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.24);z-index:101;backdrop-filter:blur(8px)}
.lang-menu[hidden]{display:none}
.lang-sort-tabs{display:flex;gap:2px;margin:6px 6px 2px;padding:3px;background:rgba(255,255,255,.08);border-radius:999px}
.lang-sort-tab{flex:1 1 auto;white-space:nowrap;padding:4px 8px;border:0;cursor:pointer;background:transparent;color:hsl(var(--on-band-dark) / .55);font-family:'SUSE Mono','SF Mono','Fira Code',monospace;font-size:10.5px;letter-spacing:.04em;border-radius:999px;transition:background .12s,color .12s}
.lang-sort-tab:hover{color:hsl(var(--on-band-dark))}
.lang-sort-tab[aria-selected=true]{background:rgba(255,255,255,.16);color:hsl(var(--on-band-dark));font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.24)}
.lang-sort-tab:focus-visible{outline:2px solid var(--green);outline-offset:1px}
.lang-menu-list{display:flex;flex-direction:column;max-height:calc(100vh - 7.5rem);overflow-y:auto}
.lang-menu-item{background:none;border:none;display:flex;align-items:center;gap:.5rem;width:100%;padding:.625rem 1rem;color:hsl(var(--on-band-dark) / .7);text-align:left;cursor:pointer;transition:background .12s,color .12s;font-size:.8125rem;font-family:inherit}
.lang-menu-item:hover{background:rgba(255,255,255,.08);color:hsl(var(--on-band-dark))}
.lang-menu-item[aria-pressed=true]{background:rgba(48,186,120,.15);color:hsl(var(--on-band-dark))}
.lang-menu-flags{display:inline-flex;gap:.2em;min-width:4em;     place-content: flex-end;}
.lang-menu-name{flex:1}
.lang-sort-tab:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 1px; }
@media (min-width:800px){
.lang-menu-list {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    }
}

${LANDING_CSS}

/* Docs layout */
.docs-wrap{display:grid;grid-template-columns:220px 1fr;max-width:1180px;margin:0 auto;min-height:calc(100vh - 3.5rem - 60px)}
.docs-sidebar{padding:2rem 1.25rem;border-right:1px solid var(--border);position:sticky;top:3.75rem;height:calc(100vh - 3.75rem);overflow-y:auto}
/* Format / convert side-door pages (plan 116 workstream A). */
.sidedoor-eyebrow{display:flex;align-items:center;gap:.5rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--green);margin-bottom:.75rem}
.sidedoor-eyebrow svg{width:1.25rem;height:1.25rem}
.sidedoor .sidedoor-full{color:var(--muted);font-size:1.0625rem;margin:-1rem 0 1.25rem}
.sidedoor-dir{font-weight:600;margin:0 0 1rem}
.sidedoor-lead{font-size:1.0625rem;line-height:1.7;margin-bottom:1.5rem}
.sidedoor-contrast{color:var(--muted);font-size:.9375rem;line-height:1.65;border-inline-start:3px solid var(--green);padding-inline-start:.85rem;margin:0 0 1.5rem}
.sidedoor-promise{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.5rem .75rem;margin:0 0 1.5rem}
.sidedoor-promise li{display:inline-flex;align-items:center;gap:.4em;background:hsl(var(--card));border:1px solid var(--border);border-radius:999px;padding:.3rem .85rem;font-size:.875rem;font-weight:600}
.sidedoor-promise li::before{content:"✓";color:var(--green);font-weight:700}
.sidedoor-cta{display:inline-flex;align-items:center;gap:.4em;background:var(--green);color:#fff;text-decoration:none;font-weight:700;padding:.7rem 1.4rem;border-radius:.6rem;margin-bottom:.5rem}
.sidedoor-cta:hover{filter:brightness(1.05)}
.sidedoor-convert-cols{display:flex;flex-wrap:wrap;align-items:stretch;gap:1rem;margin:0 0 1.5rem}
.sidedoor-col{flex:1 1 15rem;background:hsl(var(--card));border:1px solid var(--border);border-radius:.75rem;padding:1rem 1.15rem}
.sidedoor-col-label{display:block;font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin-bottom:.35rem}
.sidedoor-col strong{display:block;font-size:1.35rem;margin-bottom:.5rem}
.sidedoor-col p{margin:0;font-size:.9375rem;color:var(--muted);line-height:1.6}
.sidedoor-convert-arrow{align-self:center;color:var(--green);font-size:1.6rem;font-weight:700}
.sidedoor-detail{margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border)}
.sidedoor-feats{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 1rem}
.sidedoor-feats li{background:hsl(var(--card));border:1px solid var(--border);border-radius:.5rem;padding:.3rem .75rem;font-size:.8125rem}
.sidedoor-carry{color:var(--muted);margin:.5rem 0;line-height:1.6}
.sidedoor-prov{font-weight:600;margin:.5rem 0}
.sidedoor-offline{color:var(--muted);margin:.25rem 0 0}
.sidedoor-foot{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border)}
.sidedoor-foot-why{margin:0 0 .5rem}
.sidedoor-foot-links{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem}
.sidedoor-foot-link{font-weight:700;text-decoration:none;color:var(--green)}
.sidedoor-foot-link:hover{text-decoration:underline}
.sidebar-label{font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:700;margin:1.5rem 0 .5rem}
.sidebar-label:first-child{margin-top:0}
.sidebar-home{display:block;font-size:.8125rem;color:var(--muted)!important;margin-bottom:1rem;padding:0!important}
.sidebar-home:hover{color:var(--green)!important;background:none!important}
/* Docs search - in the TOPBAR, not the rail. It sits with the other whole-site
   controls (language, theme, launch) because it acts on the whole site: the rail
   answers "what is there", the box answers "where is the thing I already know I
   want", and that second question does not belong inside the first question's list.
   It is also where readers look for it.

   Logical properties throughout so the Arabic build mirrors without a second rule
   set. The field lives inside a fixed-height (3.75rem) nav on purpose - .docs-sidebar
   pins its sticky top and height to that number, so this must not change it. */
.docs-search{position:relative;flex:none;margin-inline-start:.25rem}
.docs-search-input{inline-size:11rem;box-sizing:border-box;padding:.4rem .7rem;font:inherit;font-size:.8125rem;
  color:hsl(var(--on-band-dark));background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:2em;
  transition:inline-size .18s ease,background .15s ease,border-color .15s ease}
.docs-search-input::placeholder{color:hsl(var(--on-band-dark) / .5)}
.docs-search-input:hover{background:rgba(255,255,255,.14)}
.docs-search-input:focus{outline:none;inline-size:15rem;background:rgba(255,255,255,.18);border-color:var(--green)}
/* Only on genuinely small screens does the field collapse to a puck that opens on
   focus. The breakpoint is 560px, not the ~900px that looks natural in isolation,
   because the nav sheds its whole link row at 1100px (see the hamburger block) -
   from there down to 560px the bar is just brand, search and three controls, so a
   readable field fits easily and shrinking it early would cost function for nothing.
   Below 560px the remaining controls do start to crowd, so it becomes a glyph. */
@media(max-width:560px){
  .docs-search-input{inline-size:2.1rem;padding-inline:0;text-align:center}
  .docs-search-input:focus{inline-size:min(60vw,14rem);padding-inline:.7rem;text-align:start}
  .docs-search-input::placeholder{color:transparent}
}
/* FIXED, not absolute: the nav is a horizontally scrolling flex bar, so an absolute
   panel would be clipped to a 3.75rem-tall strip and scroll away with the field.
   Fixed escapes it (nothing on the ancestor chain establishes a containing block -
   no transform, no filter, no backdrop-filter on nav, which is what would trap it),
   and the script positions it from the input's rect on scroll and resize.

   Width: wide enough for a result to read as three lines of prose rather than a
   column of single words. It is a floating overlay anchored to the field, so it is
   free to be wider than whatever it hangs from. */
.docs-search-results{position:fixed;z-index:110;inline-size:min(30rem,calc(100vw - 2rem));max-height:min(60vh,28rem);overflow-y:auto;background:hsl(var(--popover));border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 34px #00000026;padding:.25rem}
/* A hit is explicitly a flex COLUMN rather than a block. It used to be a block that
   had to out-specify the rail's .docs-sidebar a{display:flex} - and when that
   fight was lost the three spans became flex items in a ROW, so every result was
   three narrow columns of one-word-per-line text. The panel no longer lives in the
   rail, but declaring the axis means the layout cannot be decided by whichever
   ancestor rule happens to win a specificity contest later. */
.docs-search-hit{display:flex;flex-direction:column;align-items:stretch;padding:.5rem .6rem;border-radius:7px;color:var(--text)}
.docs-search-hit .hit-h{font-size:.875rem;font-weight:600;color:var(--dark);line-height:1.35}
.docs-search-hit .hit-c{font-size:.6875rem;color:var(--green);margin-top:.1rem}
.docs-search-hit .hit-x{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.8125rem;color:var(--muted);margin-top:.25rem;line-height:1.45}
.docs-search-hit:hover,.docs-search-hit.is-active{background:var(--pale);text-decoration:none}
.docs-search-empty{padding:.6rem .55rem;font-size:.8125rem;color:var(--muted)}
[data-theme="dark"] .docs-search-results{background:hsl(var(--popover));box-shadow:0 10px 34px #0000008c}
/* --dark is NOT remapped by the [data-theme="dark"] theme (it overrides --text/--muted/--border
   /--pale only), so every var(--dark) foreground is near-black on the dark panel.
   The docs headings solve it the same way one block up: repoint to --text. */
[data-theme="dark"] .docs-search-hit .hit-h{color:var(--text)}
.sidebar-pathway{font-size:.9375rem;font-weight:700;color:var(--dark);margin-bottom:.75rem;padding-bottom:.75rem;border-bottom:1px solid var(--border)}
.docs-sidebar a{display:flex;align-items:flex-start;gap:.5rem;padding:.3rem .5rem;font-size:.875rem;color:var(--text);border-radius:5px}
.docs-sidebar a:hover{color:var(--green);background:var(--pale);text-decoration:none}
.docs-sidebar a.active{color:var(--green);font-weight:600;background:var(--pale)}
/* Sidebar glyphs. Quiet by default so the LABEL still leads and the icon is the
   second cue rather than a competing one; they take the link's colour on hover and
   when active, so the row reads as one object. Fixed 1.05em box + flex-start keeps
   a two-line label aligned to the glyph's first line, not centred against it. */
.docs-sidebar a .sidebar-ic{flex:none;width:1.05em;height:1.05em;margin-top:.12em;color:var(--muted);opacity:.75}
.docs-sidebar a .sidebar-ic svg{width:100%;height:100%;display:block}
.docs-sidebar a:hover .sidebar-ic,.docs-sidebar a.active .sidebar-ic{color:inherit;opacity:1}
/* Two pages keep a hue of their own (see buildSidebar): AI and Inclusive Design.
   It is carried by a SOFT TINTED ROW, not a bright glyph - a saturated purple or
   pink sitting next to SUSE green read as two brands arguing rather than one
   system with an accent. The tint does the signalling, the glyph just picks it up,
   and both hues are desaturated toward the palette's own muted register so the
   column still reads green-first. Same landmark, no fight. */
.docs-sidebar a:has(.sidebar-ic.is-ai){background:#f5f2fd}
.docs-sidebar a:has(.sidebar-ic.is-inclusive){background:#fdf1f7}
.docs-sidebar a .sidebar-ic.is-ai{color:#6f5cc6;opacity:1}
.docs-sidebar a .sidebar-ic.is-inclusive{color:#c14b83;opacity:1}
/* Hover and active keep the row in its own hue instead of snapping to green -
   a landmark that changes colour when you touch it stops being a landmark. */
.docs-sidebar a:hover:has(.sidebar-ic.is-ai),.docs-sidebar a.active:has(.sidebar-ic.is-ai){background:#ece6fb;color:#5b4aab}
.docs-sidebar a:hover:has(.sidebar-ic.is-inclusive),.docs-sidebar a.active:has(.sidebar-ic.is-inclusive){background:#fbe3ef;color:#a83c6f}
.docs-sidebar a:hover .sidebar-ic.is-ai,.docs-sidebar a.active .sidebar-ic.is-ai{color:#5b4aab}
.docs-sidebar a:hover .sidebar-ic.is-inclusive,.docs-sidebar a.active .sidebar-ic.is-inclusive{color:#a83c6f}
/* Dark mode: a tint, not a fill - low-alpha over the near-black page so the row
   glows rather than becoming a slab, and the glyph lifts to stay legible. */
/* AI/inclusive sidebar chips: the base rules paint a light lilac/pink chip with
   dark ink, which on a dark ground (dark AND brand) would be light-link-text on
   a light chip. Brand has no overrides of its own, so it takes the dark chip
   treatment too. */
[data-theme="dark"] .docs-sidebar a:has(.sidebar-ic.is-ai),[data-theme="brand"] .docs-sidebar a:has(.sidebar-ic.is-ai){background:rgba(139,124,246,.13)}
[data-theme="dark"] .docs-sidebar a:has(.sidebar-ic.is-inclusive),[data-theme="brand"] .docs-sidebar a:has(.sidebar-ic.is-inclusive){background:rgba(244,114,182,.12)}
[data-theme="dark"] .docs-sidebar a .sidebar-ic.is-ai,[data-theme="brand"] .docs-sidebar a .sidebar-ic.is-ai{color:#b9a8f7}
[data-theme="dark"] .docs-sidebar a .sidebar-ic.is-inclusive,[data-theme="brand"] .docs-sidebar a .sidebar-ic.is-inclusive{color:#f2a9c9}
[data-theme="dark"] .docs-sidebar a:hover:has(.sidebar-ic.is-ai),[data-theme="dark"] .docs-sidebar a.active:has(.sidebar-ic.is-ai),[data-theme="brand"] .docs-sidebar a:hover:has(.sidebar-ic.is-ai),[data-theme="brand"] .docs-sidebar a.active:has(.sidebar-ic.is-ai){background:rgba(139,124,246,.2);color:#cbbdff}
[data-theme="dark"] .docs-sidebar a:hover:has(.sidebar-ic.is-inclusive),[data-theme="dark"] .docs-sidebar a.active:has(.sidebar-ic.is-inclusive),[data-theme="brand"] .docs-sidebar a:hover:has(.sidebar-ic.is-inclusive),[data-theme="brand"] .docs-sidebar a.active:has(.sidebar-ic.is-inclusive){background:rgba(244,114,182,.19);color:#ffc2dd}
[data-theme="dark"] .docs-sidebar a:hover .sidebar-ic.is-ai,[data-theme="dark"] .docs-sidebar a.active .sidebar-ic.is-ai,[data-theme="brand"] .docs-sidebar a:hover .sidebar-ic.is-ai,[data-theme="brand"] .docs-sidebar a.active .sidebar-ic.is-ai{color:#cbbdff}
[data-theme="dark"] .docs-sidebar a:hover .sidebar-ic.is-inclusive,[data-theme="dark"] .docs-sidebar a.active .sidebar-ic.is-inclusive,[data-theme="brand"] .docs-sidebar a:hover .sidebar-ic.is-inclusive,[data-theme="brand"] .docs-sidebar a.active .sidebar-ic.is-inclusive{color:#ffc2dd}
/* Icon bullet lists (the <!--i:key--> md marker - policy pages). Logical
   properties so the Arabic build mirrors correctly. */
.docs-content ul.icon-list{list-style:none;padding-inline-start:0;display:flex;flex-direction:column;gap:.9rem}
.docs-content ul.icon-list>li.ic{display:flex;align-items:flex-start;gap:.75rem}
/* Technology marks (the <!--l:key--> md marker - docs/logos.ts). Sized in em so a
   mark tracks whatever text it sits in, capped so it cannot become an illustration,
   and nudged onto the baseline the way an inline image needs to be. Muted by default
   at the same weight the sidebar glyphs use: these are landmarks for the eye, not a
   second reading of the sentence. Slightly OVER 1em (1.1) on purpose - these marks
   are dense little pictures, and at exactly the type size they read as smudges.

   HEADINGS CARRY NO MARKS. A heading is the page's own name for a section and the
   thing a reader scans to navigate by; a glyph in front of it competes for that job.
   Where a section really is about a technology, the marks go ABOVE it as a block
   (.doc-logo-block) instead, and the heading keeps its line to itself.

   Colour is deliberately just currentColor at reduced opacity - no per-brand fills.
   The site colours exactly two glyph families on purpose (the AI and inclusive-design
   sidebar rows); twenty brand palettes down a build page would be a carnival, and
   every mark here is someone else's trademark, which is not ours to restyle. If one
   ever earns its colour, it is one rule against [data-logo="key"]. */
.doc-logo{display:inline-block;width:1.1em;height:1.1em;max-width:1.35em;max-height:1.35em;vertical-align:-.18em;margin-inline-end:.3em;opacity:.75}
.doc-logo svg{width:100%;height:100%;display:block}
/* A mark inside a table cell carries the row, so it keeps full presence. */
.docs-content td .doc-logo{opacity:.85}
/* The block form (<!--lb:a b--> on its own line, before a major heading): the same
   marks given air and scale, so scrolling past one reads as arriving somewhere.
   Centred, generous margin above and below, and still monochrome - the size is what
   makes it an event, not colour. Sized in px rather than em: this row belongs to the
   PAGE's rhythm, not to the type around it, and every block should be the same size
   on every page. */
.doc-logo-block{display:flex;justify-content:center;align-items:center;gap:1.5rem;margin:4.5rem 0 2rem;color:var(--muted);opacity:.55}
.doc-logo-mark{display:block;width:44px;height:44px}
.doc-logo-mark svg{width:100%;height:100%;display:block}
@media(max-width:600px){.doc-logo-block{gap:1.1rem;margin:3rem 0 1.5rem}.doc-logo-mark{width:36px;height:36px}}
/* Two columns from a ::: cols fence. The pairing IS the argument on
   /info/status-quo - what happened on the left, what it cost on the right - so the
   two read together rather than one after the other. Below 900px they stack, which
   keeps the reading order intact because the source order is already correct. */
.md-cols{display:grid;grid-template-columns:1fr 1fr;gap:1.75rem 3rem;margin:2rem 0 2.5rem}
.md-cols .md-col>h2:first-child{margin-top:0;font-size:1.25rem}
.md-cols .md-col>ul{margin-bottom:0}
.md-cols .md-col li{font-size:.9375rem}
@media(max-width:900px){.md-cols{grid-template-columns:1fr;gap:2.25rem}}
/* A ::: timeline fence draws its icon list as a sequence: a rail joining each step,
   the way the change history in Verify draws a file's steps. Same visual grammar for
   the same idea - things that happened, in order. Used for the frictions we all
   accumulated, and for the rogue-agent scenario walked step by step. Sequences only:
   a set of causes or commitments stays a plain icon list, because a rail between
   unordered things says something untrue about them. */
.md-timeline .icon-list{position:relative;gap:1.35rem}
.md-timeline .icon-list>li.ic{position:relative;padding-bottom:.1rem}
.md-timeline .icon-list>li.ic .li-icon{position:relative;z-index:1;
  width:2rem;height:2rem;flex:none;display:grid;place-items:center;border-radius:999px;
  background:var(--pale);border:1.5px solid var(--border);color:var(--muted)}
.md-timeline .icon-list>li.ic .li-icon svg{width:1rem;height:1rem}
/* The rail: drawn from each item down to the next, so it stops cleanly at the last
   one instead of trailing into whitespace. */
.md-timeline .icon-list>li.ic:not(:last-child)::before{content:'';position:absolute;
  left:1rem;top:2rem;bottom:-1.35rem;width:1.5px;background:var(--border)}
@media(max-width:640px){.md-timeline .icon-list>li.ic .li-icon{width:1.75rem;height:1.75rem}
  .md-timeline .icon-list>li.ic:not(:last-child)::before{left:.875rem;top:1.75rem}}
.li-icon{flex-shrink:0;width:1.35rem;height:1.35rem;margin-top:.2rem;color:var(--green)}
.li-icon svg{width:100%;height:100%;display:block}
.docs-content{padding:2.75rem 3.5rem 6rem;min-width:0}
/* No band (a page with no h1 at all): the column is back to clearing the fixed nav
   by itself, which is what the 6rem was always for. */
.docs-content.no-mast{padding-top:6rem}
/* ── Article masthead (docsMasthead + DOCS_MASTHEAD_SCRIPT) ───────────────────
   The page's own h1 over the chip field, FULL VIEWPORT WIDTH: the band is a sibling
   of .docs-wrap, so the sidebar rail and the article both begin underneath it. That
   is the landing page's own grammar (its hero spans the window and the content
   starts below), and a band inset to one column would have read as an illustration
   inside the article rather than as the top of the page.

   The heading is left-aligned ON THE CONTENT GRID rather than centred: the landing
   hero sets its h1 to text-align:start inside a centred max-width box, and lining
   this one up with the column the article is about to start in makes the band feel
   structural instead of pasted on. Logical padding, so an RTL locale mirrors it.

   isolation:isolate keeps the canvas's blend mode inside the band - without it the
   dark theme's color-dodge would reach the page behind. */
.docs-masthead{position:relative;isolation:isolate;overflow:hidden;padding:calc(3.75rem + 3.25rem) 0 3rem;min-height:clamp(14rem,30vh,20rem);display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,var(--pale) 0%,var(--page) 100%)}
/* The dark plate stays a PLATE - a green a couple of steps up from the page - because
   color-dodge divides by the backdrop: over near-black (#061816) the chips resolve to
   near-black too and the field disappears. The gradient's last stop still reaches the
   page colour, so the band ends where the article begins. */
[data-theme="dark"] .docs-masthead{background:linear-gradient(180deg,#16482f 0%,#0b2b21 58%,var(--page) 100%)}
/* Same box as .docs-wrap, then indented past the rail: the h1 starts exactly where
   the article's text will. Below 768px the rail is gone and so is the indent. */
.docs-mast-inner{position:relative;z-index:2;max-width:1180px;width:100%;margin:0 auto;padding-inline:calc(220px + 3.5rem) 3.5rem}
.docs-mast-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.55}
/* Dark reuses the landing's own recipe (color-dodge over a dark plate); light gets
   a normal blend, because dodging on a near-white band blows the chips out to
   invisible white. Blend and opacity live here rather than in the JS: they are how
   the field MEETS the page, and the page's own theme rules already know that. */
[data-theme="dark"] .docs-mast-canvas{mix-blend-mode:color-dodge;opacity:.6}
/* Two scrims, both above the canvas and below the h1 (::before/::after are z-index 1,
   the heading is 2). The first is legibility insurance - the heading is currentColor,
   so decoration must never be allowed to eat its contrast; the second melts the band
   into the page it sits on, which at full bleed is the whole difference between a
   masthead and a banner. */
.docs-masthead::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(ellipse 70% 60% at 30% 88%,var(--mast-scrim) 0%,transparent 72%)}
.docs-masthead::after{content:'';position:absolute;left:0;right:0;bottom:0;height:50%;z-index:1;pointer-events:none;background:linear-gradient(180deg,transparent 0%,var(--page) 94%)}
:root{--mast-scrim:rgba(255,255,255,.82)}
[data-theme="dark"]{--mast-scrim:rgba(6,24,22,.72)}
/* Brand theme is a dark-teal ground: without an override it fell back to the white
   :root scrim, washing the glow white. Ride the brand primary so the halo is the
   active brand's own colour (pine green for SUSE, the mounted brand's primary else). */
[data-theme="brand"]{--mast-scrim:hsl(var(--primary) / .4)}
/* Qualified with .docs-content (0,2,1) on purpose: the article rule .docs-content h1
   is (0,1,1) and gives every page heading a bottom rule and 2rem of padding. Inside a
   band that rule is a second horizontal line under a heading that already sits on
   one, so it has to be out-specified rather than tied with. */
.docs-masthead h1{margin:0;padding:0;border-bottom:0;color:var(--dark)}
[data-theme="dark"] .docs-masthead h1{color:var(--text)}
@media(max-width:768px){.docs-masthead{padding:calc(3.75rem + 1.75rem) 0 1.75rem;min-height:9rem}.docs-mast-inner{padding-inline:1rem}}
/* ── Banked masthead art (MASTHEADS + docs-art.ts) ────────────────────────────
   A signed artifact inlined in place of the chip canvas. SAME BAND: same padding,
   min-height, scrims and hoisted h1 - the only thing that changes is what is painted
   behind the heading, so a page that gains banked art does not also silently gain a
   different top. The art takes the canvas's z-index (0), under both scrims, so the
   heading's contrast is protected by the same two layers whatever the artwork does.

   width/height 100% on an SVG artifact's root rather than its own attributes: the
   band's height is the band's decision (it is furniture on a page, not a picture), and
   an SVG that keeps its own preserveAspectRatio then fills it the way it was drawn to.
   A fragment (markup + script) sizes ITSELF inside this box - it brought its own CSS,
   and a blanket rule here would fight it. */
.docs-mast-art{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.docs-mast-art>svg{display:block;width:100%;height:100%}
/* The credential is a mark on the ARTWORK, so it hangs off the band's own corner like a
   screenshot's does - but the band is full-bleed, so it is inset to the same gutter the
   footer and nav use rather than sitting against the window edge. Above both scrims
   (z-index 3) or the melt gradient would fade the one line on the band that must stay
   legible; pointer-events are restored by .shot-cred-btn/.shot-cred-line themselves. */
.docs-masthead--art .shot-cred--mast{inset-block-end:.8rem;inset-inline-end:1.2rem;z-index:3}
/* A banked masthead carries a full claim - signer, file, kind, date, an AI pill and its
   model, plus all three actions - which is far more than the one short row .shot-cred-row's
   nowrap was written for, so on the mast the line overflows its padded card and the facts
   row lands adrift. Same fix the asset/mascot/figure marks use: give the card room and let
   the row WRAP into a compact stack inside it, right-aligned to the anchored corner. */
.docs-masthead--art .shot-cred--mast .shot-cred-line{max-width:min(30rem,calc(100vw - 3rem))}
.docs-masthead--art .shot-cred--mast .shot-cred-row{flex-wrap:wrap}
/* ── Figures (::: figure - a banked artifact in the text flow) ────────────────
   Content, not decoration: it sits in the column with the prose that argues with it,
   and its caption is a real caption (the showcase's, which this deliberately matches -
   two inlined-vector blocks that read differently would be two grammars for one idea).
   The credential rides INSIDE the figcaption rather than on the artwork's corner: a
   figure's provenance is part of what the caption says. */
.docs-figure{position:relative;margin:2.5rem auto;max-width:100%;min-width:0}
.docs-figure-art{position:relative;border-radius:1.2em;overflow:hidden}
.docs-figure-art>svg{display:block;width:100%;height:auto}
.docs-figure figcaption{margin-top:.9rem;font-size:.8125rem;color:var(--muted);text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:.5rem}
.docs-figure figcaption p{margin:0}
/* In the flow, not anchored: .shot-cred is absolutely positioned for the corner-mark
   case, and inside a caption that would drop it onto the artwork above. Static, centred,
   and the glyph BEFORE the line (row, not row-reverse) so it reads left-to-right as a
   caption does. */
.docs-figure figcaption .shot-cred{position:static;flex-direction:row;align-items:center;
  justify-content:center;width:auto;max-width:100%}
/* Open at rest, like the AI-stance hero's and for the same reason: in a caption a mark
   that only appears on hover is a caption hiding half of itself, and a figure's own
   origin is frequently the point the surrounding page is making. */
.shot-cred--figure .shot-cred-line{opacity:1;pointer-events:auto;transform:none}
.docs-figure figcaption .shot-cred-line{align-items:center;max-width:100%}
.docs-figure figcaption .shot-cred-row{flex-wrap:wrap;justify-content:center}
/* "Copy signed source" is a BUTTON among two links (it does something to the reader's
   machine rather than going somewhere), so it is stripped back to look like them -
   the alternative, a link with a click handler, would lie to the keyboard and to the
   status bar about where it goes. */
button.shot-cred-copy{border:0;background:none;padding:.1em .35em;font:inherit;font-size:.6875rem;
  font-weight:600;color:inherit;cursor:pointer}
.shot-cred-copy-label{pointer-events:none}
/* The model pill's entity chip sits tight against its label, like the signer's. */
.prov-model .prov-entity{margin-inline:.18em 0}
.docs-content img{height:auto;    max-width: min(100%, 40em);    height: auto;   margin: 0 auto; display: block;}
/* App screenshots (docs/shots.json captures) read at full column width, framed like a window. */
.docs-content img[src*="/info/shots/"]{max-width:100%;min-width:50%;border-radius:1.2em;
  /* The <img> carries hardcoded width/height attrs to reserve layout space (no
     settle shift). Let CSS win over them so a tall PORTRAIT shot (the mobile
     /verify captures) is bounded by HEIGHT and shrinks its width to match, rather
     than filling the column and running metres down the page. object-fit keeps the
     aspect ratio while width/height are auto. */
  object-fit:contain;width:auto;height:auto;max-height:50em;
  box-shadow: inset 0 0 0 1px hsl(var(--border)), 0 3px 6px #0002, 0 6px 2em #00000014}
/* The frame ring is INK, so it has to invert: a black hairline is invisible on a
   near-black page, which is why the shots read as unframed in dark mode. Light
   ring, slightly stronger (a 1px white line at 6% disappears against a screenshot
   whose own edges are light), plus a deeper drop so the card still sits ON the
   page rather than in it. */
[data-theme="dark"] .docs-content img[src*="/info/shots/"]{
  box-shadow: inset 0 0 0 1px hsl(var(--border)), 0 3px 8px #00000073, 0 6px 2em #0000004d}

/* ── Screenshot settle ──────────────────────────────────────────────────────
   Every shot enters lifted, with a wide diffuse shadow, then lands: the shadow
   tightens under it as it rises the last 30px into place. Read as a sheet being
   set down on the page.

   fit-content, not 100%: the wrapper must hug the IMAGE, because the credential
   line is positioned against this box. A portrait shot in a wide column would
   otherwise strand its credential in the empty margin.

   NO scale, on purpose: an <img> of an SVG is rasterised by Blink at the
   composited scale, so a transform-SCALED shot goes soft DURING the motion and
   snaps crisp only at rest. Since the whole point of these shots is that they are
   vector - razor-sharp at any size - the settle only translates and fades; it
   never scales, so the artwork stays crisp through the entire motion. The
   showcase block below makes the vector argument outright (it animates real
   geometry). */
.shot{display:block;position:relative;width:fit-content;max-width:100%;margin:0 auto}
.shot>img{margin:0}
/* The hidden start state is gated on .shots-motion, which the pre-paint script in
   <head> adds. A shot must NEVER be able to strand itself at opacity 0: with no
   JS (or a script that failed to parse) the class is absent, no rule below
   matches, and every screenshot is simply visible. The gate is set before first
   paint rather than by the observer at end-of-body, or a long page would paint
   the shots once and then blink them out to animate them back in. */
@media(prefers-reduced-motion:no-preference){
  .shots-motion .shot{opacity:0;transform:translateY(30px);
    transition:opacity .5s ease,transform .75s cubic-bezier(.16,.84,.3,1)}
  /* Every rule that undoes the start state carries the SAME .shots-motion
     qualifier, so it matches the (0,2,0) above. A bare .shot--in here is
     (0,1,0) and loses to the hidden state - which would leave every screenshot
     on the site invisible forever. */
  .shots-motion .shot--in{opacity:1;transform:none}
  .shots-motion .shot>img{transition:box-shadow .75s cubic-bezier(.16,.84,.3,1)}
  .shots-motion .shot:not(.shot--in)>img{box-shadow:inset 0 0 0 1px hsl(var(--border)), 0 28px 60px #00000030}
  [data-theme="dark"] .shots-motion .shot:not(.shot--in)>img{box-shadow:inset 0 0 0 1px hsl(var(--border)), 0 28px 60px #00000073}
}

/* ── Screenshot credential line ─────────────────────────────────────────────
   A photo-credit that can be checked. At rest: one imprint glyph in the corner at
   low opacity. On hover, keyboard focus or tap it becomes a line of provenance
   pills plus two actions.

   NO JavaScript is required for the reveal, and that is a deliberate a11y choice.
   The line is never display:none - it is opacity 0 with pointer-events off - so it
   stays in the accessibility tree and in tab order, and :focus-within brings it
   into view the instant a keyboard reaches one of its links. A hidden-until-JS
   popover would have had to lie about aria-expanded in the no-JS case; this cannot.
   The script only adds tap-to-open and Escape-to-close, which hover cannot do. */
/* width:max-content is doing real work. An absolutely positioned box shrink-to-fits
   against its containing block, so on a 247px-wide shot the line was squeezed until
   even "signed by Lolly" broke across three lines. Given intrinsic width and an
   inline-end anchor with no inline-start, it lays out at its natural size and grows
   LEFTWARDS across (and past) the artwork, like a caption.

   pointer-events are handed to the children, not the container: the closed line
   still occupies its full box, and a transparent 350px strip that opens on hover
   would fire whenever the pointer crossed the bottom of the shot. */
/* align-items:flex-END, not center: the line is a flex SIBLING of the glyph and is
   opacity-0 (never display:none), so it keeps its box in the layout at rest. Under
   center a taller line - which is exactly what the second, anatomy row makes it -
   would re-centre the glyph upward off its anchored corner, on every shot, expanded or
   not. Bottom-aligning pins the glyph to inset-block-end regardless of how tall the
   invisible line beside it is, so the resting mark is identical whether or not a shot
   has a readable second row. */
.shot-cred{position:absolute;inset-block-end:.55rem;inset-inline-end:.7rem;z-index:2;
  display:flex;align-items:flex-end;justify-content:flex-end;gap:.4rem;flex-direction:row-reverse;
  width:max-content;max-width:min(28rem,calc(100vw - 3rem));pointer-events:none}
/* Quiet by COLOUR and size, never by transparency. This mark used to rest at
   opacity:.34, which faded the glyph's strokes along with its puck - so the ripple
   path dissolved into whatever the screenshot's own corner happened to be and, at
   1.4rem, read as a smudge rather than a mark. A credential nobody can make out is
   not discreet, it is decoration.

   So: the puck stays opaque enough to GUARANTEE the glyph's contrast whatever sits
   behind it (screenshot corners are unpredictable - a white card, a dark timeline, a
   photo), and the glyph is muted against that puck instead of against the shot. Rest
   is legible; hover only sharpens it. */
.shot-cred-btn{display:grid;place-items:center;width:1.4rem;height:1.4rem;flex:none;padding:0;
  border:0;border-radius:50%;cursor:pointer;color:var(--muted);background:hsl(var(--popover) / 0.9);
  box-shadow:0 1px 3px #00000024;
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);pointer-events:auto;
  transition:color .2s ease,background .2s ease,box-shadow .2s ease}
.shot-cred-btn svg{width:.9rem;height:.9rem;display:block}
/* Approaching the shot at all sharpens it; it never shouts. */
.shot:hover .shot-cred-btn,.showcase:hover .shot-cred-btn{color:var(--dark)}
.shot-cred-btn:hover,.shot-cred-btn:focus-visible{color:var(--dark);background:hsl(var(--popover));box-shadow:0 2px 6px #0003}
/* Sized against the VIEWPORT, never the shot. Some shots are a 236px-wide crop of
   one control, and a line clamped to that width wraps into a stack taller than the
   artwork. Because .shot-cred is anchored to the inline-end and nothing on the way
   up clips, a wider line simply extends back across the shot (and past its edge on
   a small one), which is how a caption behaves rather than how a box does. */
.shot-cred-line{display:flex;flex-direction:column;align-items:flex-end;gap:.16rem;
  max-width:min(26rem,calc(100vw - 3rem));padding:.28rem .45rem;border-radius:.9rem;
  background:hsl(var(--popover) / 0.87);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  box-shadow:0 2px 10px #0000001f, inset 0 0 0 1px hsl(var(--border));
  opacity:0;pointer-events:none;transform:translateX(.4rem);
  transition:opacity .22s ease,transform .22s ease}
/* Hover is keyed off the GLYPH (and then the line itself, so the pointer can travel
   onto it without it closing) rather than off the container, which is
   pointer-events:none for the reason given above. */
.shot-cred-btn:hover + .shot-cred-line,.shot-cred-btn:focus-visible + .shot-cred-line,
.shot-cred-line:hover,.shot-cred:focus-within .shot-cred-line,
.shot-cred[data-open] .shot-cred-line{opacity:1;pointer-events:auto;transform:none}
/* The "try it" offer under a shot. In the FLOW and OUTSIDE the .shot wrapper, not in
   the overlay: the credential is a mark on the artwork, this is a line of the page, and
   they must not compete. Outside matters structurally too - .shot-cred is anchored to
   the wrapper's bottom edge, so a link inside it pushes that edge down and the mark
   lifts off the artwork's corner onto the caption. Centred under the picture (the shot
   itself is a centred fit-content box), quiet until approached. */
.shot-try{display:block;margin-block-start:.5rem;text-align:center;
  font-size:.8125rem;font-weight:600;color:var(--muted)}
.shot-try::after{content:' →'}
.shot-try:hover,.shot-try:focus-visible{color:var(--green);text-decoration:underline}
/* A PAGE ASSET's credential (the AI stance hero): open at rest, because the file's
   history is what the surrounding page is arguing about rather than a footnote to a
   screenshot. Same mark, same line, same two links - only the resting state differs,
   so a reader who never hovers still sees who signed the picture they are looking at. */
.shot-cred--asset .shot-cred-line{opacity:1;pointer-events:auto;transform:none}
/* Full column width, and nothing else: page artwork sizes itself (the hero is
   width:100% a few rules down), so the wrapper only has to be a positioned box the
   mark can hang off. An image that wants 100% of a fit-content parent resolves to
   zero, which is the other reason this is not a .shot. */
.asset-cred{display:block;position:relative;width:100%}
.asset-cred>img{display:block;width:100%;height:auto;margin:1em auto}
/* A page-asset credential rests OPEN on a full-width hero, so - unlike a screenshot's
   caption, which deliberately overhangs a narrow crop (see the .shot-cred notes above) -
   it must stay INSIDE the frame: there is a whole column of room, so a spill past the
   edge like the one on /input-not-impersonation is just a bug. Same fix the mascot credit
   uses a few rules down: clamp the line to the artwork, and let the rows WRAP into a
   compact stack rather than run off the side. The glyph stays anchored; the line grows
   within the box. */
.asset-cred .shot-cred{max-width:calc(100% - 1.4rem)}
.asset-cred .shot-cred-line{max-width:18em}
.asset-cred .shot-cred-row{flex-wrap:wrap}
/* not-a-pipe keeps the DEFAULT centred, 40em-capped image (see .docs-content img above),
   so its .asset-cred wrapper is the full column - wider than the picture - and a mark
   anchored to the wrapper's edge hangs off into the margin. Hug the wrapper to the same cap
   so the credential aligns to the artwork's real edge. (the-flood escapes this only because
   it overrides its image to width:100% further down, filling the wrapper.) */
.asset-cred[data-shot="/info/not-a-pipe.webp"]{max-width:min(100%,40em);margin-inline:auto}
/* Its caption "Ceci n'est pas une pipe" runs along the bottom edge, and that writing is the
   whole point of the picture - so this hero's mark sits mid-height rather than in the bottom
   corner where it would cover the words it is arguing about. */
.asset-cred[data-shot="/info/not-a-pipe.webp"] .shot-cred{inset-block-end:50%}
/* The line is a stack of ROWS, and a shot with no readable file has exactly one of
   them - so the column above is byte-identical to the single row it replaced. The
   second row (what the file is made of) only ever appears inside the expanded line,
   which is the only state the line has: at rest the whole thing is opacity 0. The
   glyph itself does not move when the second row is present, because .shot-cred
   bottom-anchors it (align-items:flex-end) rather than centring it against the line.

   nowrap on the ROW, not on the line: the row still refuses to break "signed by
   Lolly" across lines, and a stack of two short rows is shorter than the four-row
   wrap the one-row rule was written to prevent. */
.shot-cred-row{display:flex;align-items:center;gap:.3rem;flex-wrap:nowrap;justify-content:flex-end}
/* The line's pills are chips on a chip, so they sit a step quieter than the ones
   the prose uses - and they must not inherit the docs paragraph line-height, which
   would make the row twice as tall as the glyph beside it. */
.shot-cred-row>*{flex:none}
.shot-cred-line .prov-pill{font-size:.6875rem;line-height:1.3;padding:.1em .5em;margin:0;white-space:nowrap}
.shot-cred-line .prov-seal{width:.8em;height:.8em}
.shot-cred-do{font-size:.6875rem;font-weight:600;white-space:nowrap;padding:.1em .35em;border-radius:.6em}
.shot-cred-do:hover{background:var(--pale);text-decoration:underline}
/* An AI declaration is not a detail to be discovered - if a shot ever carries one,
   its mark arrives already at full contrast and wearing the brand ring, so it reads
   as a statement rather than as the same quiet glyph every other shot has. */
.shot-cred--ai .shot-cred-btn{color:hsl(var(--on-band-dark));background:hsl(var(--band-dark));box-shadow:0 0 0 2px var(--green)}
/* Dark mode: same contract, inverted. The puck is near-opaque for the same reason -
   a dark screenshot's corner is not reliably darker than the puck - and the glyph is
   a muted PALE against it, not a full-white one, so it stays quiet without becoming
   the invisible stroke this used to be. */
[data-theme="dark"] .shot-cred-btn{color:#93a8a0;background:hsl(var(--popover) / 0.9);box-shadow:0 1px 3px #0006}
[data-theme="dark"] .shot:hover .shot-cred-btn,[data-theme="dark"] .showcase:hover .shot-cred-btn{color:var(--pale)}
[data-theme="dark"] .shot-cred-btn:hover,[data-theme="dark"] .shot-cred-btn:focus-visible{color:var(--pale);background:hsl(var(--popover));box-shadow:0 2px 6px #0008}
[data-theme="dark"] .shot-cred--ai .shot-cred-btn{color:var(--dark);background:var(--light)}
[data-theme="dark"] .shot-cred-line{background:hsl(var(--popover) / 0.93);box-shadow:0 2px 10px #0007, inset 0 0 0 1px hsl(var(--border))}
[data-theme="dark"] .shot-cred-do:hover{background:hsl(var(--foreground) / 0.08)}
@media(prefers-reduced-motion:reduce){.shot-cred-line{transition:none;transform:none}}
/* Narrow columns: the line would be wider than the shot, so it stacks above the
   glyph instead of beside it and takes the shot's full width. */
@media(max-width:640px){
  .shot-cred{flex-direction:column;align-items:flex-end;inset-inline-start:.7rem}
  .shot-cred-line{max-width:100%;transform:translateY(.4rem)}
}

/* ── Geometry showcase (::: showcase - one inlined vector shot) ─────────────
   Scroll drives --p from 0 to 1. Everything that moves is geometry:

     camera  the svg viewBox is lerped from a centre crop out to full extent (JS -
             viewBox is an attribute, not a CSS property). The captured strokes are
             non-scaling-stroke, so they stay hairline all the way in. No re-raster,
             no blur, at any zoom - the whole point of the block.
     ink     grayscale(1 - p): the drawing arrives as ink and takes on its colour.
             A filter function list CAN transition, unlike the url() case above.
     order   each leaf shape appears when p passes its share of the paint order, so
             the map assembles itself layer by layer (water, then road classes by
             weight) instead of fading in as one flat picture.

   --p is set by JS, so with no JS the fallbacks below (p:1) render the finished
   artwork at full extent, in colour, every layer visible. */
.showcase{--p:1;margin:2.5rem auto;max-width:100%;width:fit-content}
/* The radius lives on the artwork, NOT as overflow:hidden on the stage - the stage
   also holds the credential line, which is allowed to extend past the artwork's
   edge, and a clipping stage would cut it off. */
.showcase-stage{position:relative;border-radius:1.2em;
  box-shadow:inset 0 0 0 1px hsl(var(--border)), 0 3px 6px #0002, 0 6px 2em #00000014}
[data-theme="dark"] .showcase-stage{
  box-shadow:inset 0 0 0 1px hsl(var(--border)), 0 3px 8px #00000073, 0 6px 2em #0000004d}
/* The <img> the build emits, and the live SVG that replaces it, must occupy the
   same box - the swap happens under the reader's eyes and any size change would
   read as a jump rather than an upgrade. */
.showcase-fallback,.showcase-art{display:block;width:min(100%,40em);height:auto;margin:0;border-radius:1.2em}
.showcase-art{filter:grayscale(calc(1 - var(--p)))}
/* The stagger. Each leaf gets --i (its paint-order index) and the root gets --n
   (the total) from the showcase script; ×2.2 fades each shape over a fraction of
   the scroll rather than all of it, so the layers overlap into one motion.

   The +1 is what makes this read as drawing rather than loading: it puts the FIRST
   leaf (the sheet the artwork sits on) on screen at p=0, so the block opens as
   blank paper and the ink arrives onto it. Without it every layer including the
   background starts at zero, and the opening frame is an empty box that looks like
   a screenshot that failed to load. */
.showcase-art [data-sc-i]{opacity:clamp(0,calc((var(--p) * var(--n) - var(--i) + 1) * 2.2),1)}
.showcase figcaption{margin-top:.9rem;font-size:.8125rem;color:var(--muted);text-align:center;
  max-width:34em;margin-inline:auto}
.showcase figcaption p{margin:0}
@media(prefers-reduced-motion:reduce){
  /* No camera, no ink phase, no stagger - the finished artwork, still. */
  .showcase{--p:1 !important}
  .showcase-art{filter:none}
  .showcase-art [data-sc-i]{opacity:1}
}

/* ── Theme twin: two committed files, one shown ────────────────────────────
   A "dark=1" recipe ships a second baseline captured with the app pinned dark, and
   the reader's own toggle decides which one is on screen. NOT a <picture> with a
   prefers-color-scheme source: the site's dark mode is a CLASS the reader flips,
   so a media-query source would follow the OS and contradict the toggle.

   Ungated (no .shots-motion, no media query) so it holds with JS off, and scoped
   to .shot--dual so a shot with no twin is byte-identical to before. Each twin
   carries its OWN credential line - two separately signed files. */
/* Every img rule here is qualified with the ELEMENT as well as the class: the base
   .docs-content img rule sets display:block at (0,1,1), so a bare .shot-alt (0,1,0)
   loses and BOTH twins render, one under the other. */
.shot--dual>img.shot-alt,.shot--dual .shot-cred--alt{display:none}
[data-theme="dark"] .shot--dual>img:not(.shot-alt),[data-theme="dark"] .shot--dual .shot-cred:not(.shot-cred--alt){display:none}
[data-theme="dark"] .shot--dual>img.shot-alt{display:block}
[data-theme="dark"] .shot--dual .shot-cred--alt{display:flex}

/* Provenance pills (the typed markers authors write in the markdown - see inline()).
   A provenance line reads as
   data tags in sentence order, so the hierarchy is carried by weight and fill, not
   by size: ACTORS solid and darkest, SIGNATURES outlined with a seal, then the
   mechanical detail (actions, filenames, sizes) quiet enough to skim past.
   The paragraph stays ordinary inline text - a flex row would make every word
   between the pills its own flex item and strand the connecting commas. */
.prov-pill{display:inline-block;border-radius:999px;padding:.16em .62em;font-size:.8125rem;
  line-height:1.4;margin:0 .08em;vertical-align:baseline}
/* Every surface below is a THEME TOKEN, never a literal - the tokens flip with
   [data-theme="dark"], a hex does not. A hardcoded light fill under light-on-dark text is how
   these pills went unreadable in dark mode the first time. */
.prov-entity{background:hsl(var(--band-dark));color:hsl(var(--on-band-dark));font-weight:700;letter-spacing:.01em}
[data-theme="dark"] .prov-entity{background:#12463a}  /* lifted off the near-black page so the chip still reads as a chip */
.prov-sig{color:var(--text);font-weight:600;background:rgba(48,186,120,.14)}
/* An actor inside a signature is WHITE ON GREEN in both themes - a signature is the
   one claim that must look identical wherever it is read. The fill is a deepened
   brand green rather than --green itself: white on #30ba78 is about 2.2:1, which
   fails for 13px text, and a signature nobody can read is worse than an off-swatch
   one. This keeps the hue and clears 4.5:1. */
.prov-sig .prov-entity{background:#14784d;color:hsl(var(--on-band-dark));margin-inline:.18em 0}
/* Inline, not a flex child: the pill's baseline must be its TEXT baseline so it
   sits on the same line as the prose around it. The glyph is nudged optically. */
/* The seal is the one glyph in the pill that must read at a glance, and --green
   on --pale is the weakest pairing in the set (a mid-green on a tinted background
   in BOTH themes). It takes the theme's ink instead: near-black on the light pill,
   white on the dark one. The literal #fff is safe here because it lives inside
   [data-theme="dark"], so it flips with the theme rather than surviving it. */
.prov-seal{width:.95em;height:.95em;margin-inline-end:.34em;vertical-align:-.14em;color:var(--dark)}
[data-theme="dark"] .prov-seal{color:hsl(var(--on-band-dark))}
.prov-act{background:var(--pale);color:var(--text);font-weight:550;border:1px solid transparent}
[data-theme="dark"] .prov-act{border-color:var(--border)}
/* A filename wraps rather than truncating - it is evidence the caption is naming,
   so hiding its tail hides the point. NOTE: never give this overflow:hidden -
   on an inline-block that moves the baseline to the bottom margin edge (CSS 2.1
   10.8.1) and the pill visibly drops below the line it sits in. */
.prov-file{background:var(--pale);color:var(--muted);border:1px solid var(--border);
  font-family:'SUSE Mono','SF Mono',monospace;font-size:.75rem;
  white-space:normal;overflow-wrap:anywhere;max-width:100%}
.prov-detail{color:var(--muted);font-variant-numeric:tabular-nums;font-size:.8125rem}
/* The caption sits under the hero as a caption, not as body copy. The extra
   leading is what keeps a wrapped chain of padded pills off the rows above and
   below - with normal leading the pill boxes collide even though the text does not. */
.docs-content p:has(.prov-pill){margin-top:.9rem;font-size:.9375rem;line-height:2.15;color:var(--muted)}

/* The AI-stance hero photo carries a three-manifest C2PA chain (Google's two as
   ingredients, Lolly's own on top) that readers are invited to verify, so its
   bytes are exactly what Lolly exported - never re-encode it in a build step.
   Full column width: it is the page's one image and the argument's evidence. */
.docs-content img[src*="the-flood"]{width:100%;max-width:100%;border-radius:1.2em;box-shadow:0 3px 6px #0002, 0 6px 2em #0001}
.docs-content h2{font-size:1.5rem;font-weight:700;letter-spacing:normal;text-transform:none;border-top:1px solid var(--border);padding-top:2rem;margin-top:2.5rem;margin-bottom:.75rem;color:var(--dark)}
.docs-content h2:first-of-type{border-top:none;padding-top:0;margin-top:0}
.docs-content h3{font-size:1.15rem;margin-top:1.75rem;margin-bottom:.5rem;color:var(--dark)}
.docs-content h4{font-size:1rem;margin-top:1.25rem;margin-bottom:.35rem;color:var(--muted)}
/* The top nav is fixed at 3.75rem, so a heading landed on by an #anchor (the jump
   nav below, a search result, a shared deep link) would otherwise sit UNDER it. Same
   idea as section[id] on the landing page, with room for the heading's rule. */
.docs-content h2[id],.docs-content h3[id],.docs-content h4[id]{scroll-margin-top:5.5rem}
.docs-content ul,.docs-content ol{margin-bottom:1rem}
/* ── "On this page" jump nav (long docs pages only - pageJumpNav) ─────────────
   Bottom-right, deliberately quiet: a 2.25rem disc that reads as page furniture
   until you want it. Logical inset so the Arabic build puts it in the corner an RTL
   reader reaches for. Tokens only (--text/--muted/--border/--pale, all redefined by
   .dark) so dark mode needs no second palette here. */
.doc-jump{position:fixed;bottom:1rem;inset-inline-end:1rem;z-index:88}
.doc-jump-btn{display:flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:999px;border:1px solid var(--border);background:var(--pale);color:var(--muted);cursor:pointer;box-shadow:0 2px 10px #0c322c1f;transition:color .12s,border-color .12s}
.doc-jump-btn svg{width:1.1rem;height:1.1rem}
.doc-jump-btn:hover,.doc-jump-btn[aria-expanded="true"]{color:var(--green);border-color:var(--green)}
/* The first six declarations are RESETS, not choices: the bare nav element selector at
   the top of this sheet IS the site's top bar (fixed, full-width, 3.75rem, flex), and
   it lands on any <nav> on the page. The landing page's quicknav opts out the same
   way. Losing them lays this panel out as a strip across the bottom of the window. */
.doc-jump-nav{position:absolute;display:block;top:auto;width:auto;height:auto;overflow-x:hidden;transition:none;bottom:calc(100% + .5rem);inset-inline-end:0;min-width:14rem;max-width:min(20rem,calc(100vw - 2rem));max-height:min(60vh,26rem);overflow-y:auto;padding:.4rem;background:var(--pale);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 34px #0c322c26}
.doc-jump-nav[hidden]{display:none}
.doc-jump-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:.15rem .5rem .35rem}
.doc-jump-nav a{display:block;padding:.32rem .5rem;border-radius:6px;font-size:.875rem;line-height:1.35;color:var(--text);text-decoration:none}
.doc-jump-nav a:hover{background:#30ba7818;color:var(--green);text-decoration:none}
.doc-jump-top{margin-top:.25rem;border-top:1px solid var(--border);padding-top:.45rem;color:var(--muted)}
/* The docs player dock owns this corner while it is open (html.ldp-open, fixed at
   the same 16px). One control per corner - the reader is listening, not scanning. */
html.ldp-open .doc-jump{display:none}
@media(prefers-reduced-motion:reduce){.doc-jump-btn{transition:none}}
@media print{.doc-jump{display:none}}
.docs-content h1{font-size:3rem;color:var(--dark);line-height:1.15;margin-bottom:2rem;padding-bottom:2rem;border-bottom:1px solid var(--border); font-weight:300;}

/* Table */
.table-wrap{overflow-x:auto;margin-bottom:2rem;box-shadow: 0 0 0 1px hsl(var(--border)), 0 .2rem .4rem #00000018; border-radius: 1.5em;}
table{border-collapse:collapse;width:100%;font-size:.875rem}
thead tr th:first-child{border-radius: 1em 0 0 0}
thead tr th:last-child{border-radius: 0 1em 0 0}
th,td{padding:.55rem .9rem;text-align:start;border:1px solid var(--border)}
th{background:var(--pale);font-weight:600;color:var(--dark)}
tr:nth-child(even) td{background:hsl(var(--muted) / 0.4)}

/* Mascots */
.social-proof-mascot{position:absolute;right:4%;top:50%;transform:translateY(-50%);width:clamp(90px,12vw,180px);pointer-events:none;filter:drop-shadow(0 8px 20px rgba(12,50,44,.18))}
.footer-inner{display:flex;align-items:center;justify-content:center;gap:1rem}
.footer-mascot{width:2.75rem;flex-shrink:0;filter:drop-shadow(0 2px 6px rgba(0,0,0,.18))}
@media(max-width:768px){
  .social-proof-mascot{display:none}
}

/* Social proof */
.social-proof{padding:4rem 0 3rem;background:hsl(var(--background));overflow:hidden;position:relative}
.social-proof-inner{text-align:center;padding:0 1.5rem 2.5rem;max-width:50rem;margin:0 auto}
.social-proof h2{font-size:2rem;color:var(--dark);margin-bottom:.375rem}
.social-proof-date{font-size:.8125rem;color:var(--green);font-weight:600;margin-bottom:.625rem;letter-spacing:.02em;text-transform:uppercase}
.social-proof-desc{color:var(--muted);font-size:.9375rem;line-height:1.6}
/* "Founded by SUSE" badge - same size everywhere it appears (hero, social proof, footer) */
.social-proof-founded{margin:1.5rem 0 0;text-align:center}
.social-proof-credit{text-align:center;color:var(--muted);font-size:.875rem;margin-top:1.75rem;padding:0 1.5rem}
.social-proof-credit a{color:var(--green);font-weight:600;text-decoration:none}
.social-proof-credit a:hover{text-decoration:underline}

.opensource-section{padding:5rem 2rem;background:var(--pale);text-align:center}
.opensource-inner{max-width:720px;margin:0 auto}
.opensource-section h2{margin-bottom:1.25rem}
.opensource-section p{color:var(--muted);font-size:1.0625rem;line-height:1.8}

.quokka{max-width:320px;}
@media(max-width:768px){.quokka{max-height:260px;width:auto;max-width:60vw}}
/* Footer */
footer{border-top:1px solid var(--border);padding:2rem 1.5rem;text-align:center;color:var(--muted);font-size:.8125rem;background:var(--pale)}
footer a{color:var(--muted);text-decoration:underline}
footer a:hover{color:var(--dark)}
footer .founded-badge{margin-top:.5rem}
/* Footer sitemap - the whole docs set, ten columns (see FOOTER_SECTIONS).
   auto-fit is right for a handful of columns and wrong for ten: it maximises the
   count, so 1180px yields seven and the last three sit alone on a second row under
   four empty tracks. Explicit counts instead - 2 on a phone, 3 on a tablet, then 5.
   Ten divides by both 2 and 5, so the phone and the desktop layouts are exactly
   full (5 rows of two; 2 rows of five). The tablet band is the one that cannot be:
   ten in threes leaves a single column on a fourth row, and the alternative (four
   columns, 4+4+2) trades that for a half-empty row at a narrower column width.
   align-items:start keeps a short column's links at the top of its row
   rather than stretched down it. Columns read left-aligned inside a centred footer,
   which is what makes them scannable as lists rather than as prose. Titles take
   var(--text), not var(--dark), because --dark keeps its value in the dark theme
   and would go invisible there. */
.footer-sitemap{display:grid;grid-template-columns:repeat(2,1fr);align-items:start;gap:1.25rem 1.5rem;max-width:1180px;margin:0 auto 1.75rem;padding-bottom:1.75rem;border-bottom:1px solid var(--border);text-align:start}
@media(min-width:34rem){.footer-sitemap{grid-template-columns:repeat(3,1fr)}}
@media(min-width:64rem){.footer-sitemap{grid-template-columns:repeat(5,1fr)}}
.footer-sitemap a{display:flex;align-items:flex-start;gap:.45em;color:var(--muted);text-decoration:none;padding:.15rem 0 .15rem;line-height:2}
.footer-sitemap a:hover{color:var(--green);text-decoration:underline}
/* Every sitemap link opens with the SAME glyph the docs sidebar gives that page
   (SIDEBAR_ICON - one page→icon mapping, both navs), so the landmark a reader
   learned on the rail keeps working down here. Decorative: aria-hidden spans,
   sized in em to the footer's own text so rows and the smaller uppercase headings
   each get a matching icon from one rule. margin-top holds the 1.5em glyph on the
   FIRST line of the 2-line-height row when a label wraps. */
.footer-sitemap .sitemap-ic{flex:none;width:1.5em;height:1.5em;margin-top:.22em;opacity:.6;color:var(--green)}
.footer-sitemap .sitemap-ic svg{width:100%;height:100%;display:block}
.footer-sitemap a:hover .sitemap-ic{opacity:1}
/* The column heading is a LINK to its pathway's main page. That is what pays for
   the full enumeration: the overview never costs a row of its own, and the two or
   three columns a long pathway is split across all point their heading at the same
   hub. It keeps the heading's own weight and colour rather than the muted link
   treatment two rules above - declared AFTER them so it wins without a specificity
   fight - and takes the underline only on hover, so it reads as a heading first and
   a destination second. footer a{text-decoration:underline} is the rule overridden. */
.sitemap-title{font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text);font-weight:700;margin-bottom:.5rem;text-decoration:none}
.footer-sitemap a.sitemap-title{color:var(--text)}
.footer-sitemap a.sitemap-title:hover{color:var(--green);text-decoration:underline}
.sitemap-title .sitemap-ic{ width:2em; height:2em; color:var(--text);}

/* Hamburger */
.nav-hamburger{display:none;background:none;border:none;cursor:pointer;color:hsl(var(--on-band-dark) / .65);width:2.25rem;height:2.25rem;align-items:center;justify-content:center;border-radius:5px;padding:.3rem;flex-shrink:0}
.nav-hamburger:hover{color:hsl(var(--on-band-dark));background:rgba(255,255,255,.1)}
.nav-hamburger svg{width:1.25rem;height:1.25rem;pointer-events:none}
.nav-hamburger .icon-close{display:none}
.nav-hamburger.open .icon-menu{display:none}
.nav-hamburger.open .icon-close{display:block}
/* The panel scrolls on its own: below 768px it also carries the page nav (see
   .nav-mobile-page), which on a builders page is longer than a phone screen.
   overscroll-behavior keeps that scroll from continuing into the article behind it. */
.nav-mobile-menu{display:none;position:fixed;top:3.75rem;left:0;right:0;background:hsl(var(--band-dark));border-bottom:1px solid rgba(255,255,255,.1);padding:1rem 1.5rem 1.5rem;z-index:99;flex-direction:column;gap:.125rem;max-height:calc(100vh - 3.75rem);overflow-y:auto;overscroll-behavior:contain}
.nav-mobile-menu.open{display:flex}
.nav-mobile-menu a{color:hsl(var(--on-band-dark) / .7);font-size:.9375rem;padding:.625rem .625rem;border-radius:6px;display:block;text-decoration:none}
.nav-mobile-menu a:hover{color:hsl(var(--on-band-dark));background:rgba(255,255,255,.07)}
.nav-mobile-menu a.active{color:var(--green);font-weight:600}
.nav-mobile-menu .nav-launch{background:hsl(var(--band-accent));color:hsl(var(--band-dark))!important;font-weight:700;text-align:center;margin-top:.75rem;padding:.75rem;border-radius:8px}
.nav-mobile-menu .nav-launch:hover{background:hsl(var(--band-accent) / .82)}
/* Page nav inside the hamburger panel. Hidden by default and switched on at 768px
   only: from 768 to 1100px the hamburger is open for business while the rail is
   still on screen, and listing the same links twice would be noise. The rule sits
   with the other panel styles rather than in the media query so the two kinds of
   navigation are described in one place. */
.nav-mobile-page{display:none;margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.14)}
.nav-mobile-title{color:var(--green);font-size:.8125rem;font-weight:700;letter-spacing:.02em;padding:0 .625rem .25rem}
/* .55 not .42 - at 42% over the panel's #0c322c this computes to 3.7:1, under AA
   for 11px text. .55 clears 5.3:1 and still reads as a quieter tier than the
   links at .7. */
.nav-mobile-label{font-size:.6875rem;text-transform:uppercase;letter-spacing:.1em;color:hsl(var(--on-band-dark) / .55);font-weight:700;margin:.75rem 0 .125rem;padding:0 .625rem}

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
/* Collapse the top nav to a hamburger before its links overflow into a horizontal
   scroll. The full link row needs ~1032px; collapse at 1100px for a cross-browser /
   font-fallback margin. (The docs grid + content keep reflowing at 768px below.) */
@media(max-width:1100px){
  nav{overflow-x:visible}
  /* Collapse the desktop nav links into the hamburger - but NOT the search-result
     anchors, which are also <a> inside <nav> (the results panel lives in .docs-search).
     Without the exemption this rule hid every hit, collapsing the results panel to an
     empty strip on any viewport ≤1100px, and neither the jump nav's section links
     (.doc-jump-nav), for the same reason. The GitHub mark beside the theme switch is
     an <a> too, and stays: it is a control of the bar, not a link of the row. */
  nav:not(.quicknav):not(.doc-jump-nav) a:not(.brand):not(.docs-search-hit):not(.nav-github){display:none}
  nav .nav-group{display:none}
  .nav-hamburger{display:flex}
}
@media(max-width:768px){
  .docs-wrap{grid-template-columns:1fr}
  /* The rail goes away rather than stacking above the article: as a static block it
     put a screenful of nav in front of the first sentence of every short page. Its
     links reappear inside the hamburger panel (.nav-mobile-page), which is switched
     on by the same breakpoint. */
  .docs-sidebar{display:none}
  .nav-mobile-page{display:block}
  /* Top padding must still clear the 3.75rem FIXED nav - collapsing it with the
     side padding slid every page's h1 underneath the bar on phones. */
  .docs-content{padding:1.75rem 1rem 1.5rem}
  .docs-content.no-mast{padding-top:5.25rem}
  .audience-card{
    --aud-card-display:flex;
    display:flex;flex-direction:column;
    gap:2rem;padding:2.5rem 1.25rem;
  }
  .audience-header{padding:3rem 1rem 1.25rem}
  .audience-title{font-size:1.875rem}
  .audience-tabs{gap:.375rem;padding:.625rem .75rem .875rem}
  .audience-tab{padding:.4rem .7rem}
  .tool-anatomy{gap:.5rem}
  .tool-plus{display:none}
  .tool-part{min-width:110px}
}
@media(max-width:480px){
  .platform-features{grid-template-columns:1fr}
  .tool-features{grid-template-columns:1fr}
  .card-benefits{grid-template-columns:1fr}
  .try-now-callout{position:static;transform:none;width:auto;margin-top:1.75rem;flex-direction:column;align-items:stretch}
  .try-now-callout .btn{text-align:center;justify-content:center}
}



/* Theme toggle */
.nav-theme-toggle{background:none;border:none;cursor:pointer;color:hsl(var(--on-band-dark) / .65);width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;border-radius:5px;padding:.25rem;flex-shrink:0;margin-left:.25rem}
.nav-theme-toggle:hover{color:hsl(var(--on-band-dark));background:rgba(255,255,255,.1)}
.nav-theme-toggle svg{width:1.1rem;height:1.1rem;pointer-events:none}
/* The repository, one glyph beside the theme switch (Andy, 2026-09-04): same footprint,
   same colour ramp, a plain link - the code is the product's proof and belongs in the chrome. */
.nav-github{color:hsl(var(--on-band-dark) / .65);width:2rem;height:2rem;display:flex;align-items:center;justify-content:center;border-radius:5px;padding:.25rem;flex-shrink:0;margin-left:.25rem;text-decoration:none}
.nav-github:hover{color:hsl(var(--on-band-dark));background:rgba(255,255,255,.1)}
.nav-github svg{width:1.1rem;height:1.1rem;pointer-events:none}
/* Show the ACTIVE theme's glyph. Default (light, incl. no [data-theme]) = sun;
   dark = moon; brand = palette. Each theme hides the other two. */
.nav-theme-toggle .icon-moon,.nav-theme-toggle .icon-brand{display:none}
.nav-theme-toggle .icon-sun{display:block}
[data-theme="dark"] .nav-theme-toggle .icon-sun{display:none}
[data-theme="dark"] .nav-theme-toggle .icon-moon{display:block}
[data-theme="brand"] .nav-theme-toggle .icon-sun{display:none}
[data-theme="brand"] .nav-theme-toggle .icon-brand{display:block}

/* Dark mode. The token redefinitions that used to live here are gone: the DOCS_BRIDGE
   above maps --text/--muted/--border/--pale/--page onto the app's [data-theme]-driven
   slots, so dark mode falls out of tokens.css. The component rules below only restyle
   the few places that carry a hardcoded colour of their own. */
[data-theme="dark"] body{background:var(--page)}
[data-theme="dark"] .social-proof{background:hsl(var(--background))}
[data-theme="dark"] .social-proof h2{color:var(--text)}
[data-theme="dark"] .social-proof-desc{color:var(--muted)}
[data-theme="dark"] tr:nth-child(even) td{background:hsl(var(--muted) / 0.4)}
[data-theme="dark"] footer{border-top-color:var(--border)}
[data-theme="dark"] .docs-content h1,[data-theme="dark"] .docs-content h2,[data-theme="dark"] .docs-content h3{color:var(--text)}
[data-theme="dark"] th{color:var(--text)}
/* Code on a dark ground (dark AND brand - brand is a dark-teal theme with no
   [data-theme="brand"] overrides of its own, so it inherits the base rules; the
   base pre now uses hsl(var(--foreground)) so it is already legible, and these
   add the dark box + border for parity). Give inline code a dark surface + light
   text, and the pre block a dark box. The last rule keeps code inside pre
   background-free - [data-theme="dark"] .docs-content code would otherwise
   out-specify the base "pre code background none" reset. */
[data-theme="dark"] .docs-content code,[data-theme="brand"] .docs-content code{background:hsl(var(--muted));color:var(--text)}
[data-theme="dark"] .docs-content pre,[data-theme="brand"] .docs-content pre{background:hsl(var(--muted));color:var(--text);border:1px solid var(--border)}
/* The Warde page sets its two verse blocks as an inscription rather than as code.
   Scoped to the page so no other fenced block is touched. Centred and letterspaced
   because that is what the 1932 broadside and the 1940 bronze both do - the poem was
   cut in capitals for a titling face, and reading it as a listing loses the shape. */
.page-beatrice-warde .docs-content pre{font-family:'Cinzel',Georgia,serif;font-size:1.0625rem;line-height:2.05;letter-spacing:.055em;text-align:center;background:linear-gradient(#fbfaf7,#f4f2ec);color:#25313a;padding:2.5rem 1.5rem;border-radius:10px;box-shadow:inset 0 0 0 1px #0000000f,0 1px 2px #0000000a;white-space:pre-wrap;text-wrap:balance}
.page-beatrice-warde .docs-content pre code{font-family:inherit;font-size:inherit;background:none;padding:0}
[data-theme="dark"] .page-beatrice-warde .docs-content pre,[data-theme="brand"] .page-beatrice-warde .docs-content pre{background:linear-gradient(#12271d,#0d2016);color:#e8f0ea;box-shadow:inset 0 0 0 1px #ffffff14}
.doc-audio{margin:0 0 .5rem;padding:0}
.doc-audio audio{width:100%;height:40px;display:block}
/* An audiogram MP4 is square (1080²) and would swamp the column at full width -
   cap it and centre it, letting its own aspect ratio set the height. The dark
   fill matches the audiogram's own background so the poster-load gap isn't black. */
.doc-video{margin:0 auto 1rem;max-width:min(420px,100%)}
.doc-video video{width:100%;height:auto;display:block;border-radius:10px;background:#0d1f17}
[data-theme="dark"] .docs-content pre code{background:none;color:inherit}
/* ── Pilot / prototype disclaimer badge (in the dark hero) ─────────────────── */
.hero-pilot{display:inline-flex;align-items:center;gap:.5rem;margin-bottom:3rem;padding:.34rem .36rem .34rem .55rem;background:rgba(254,124,63,.17);border-radius:999px;text-decoration:none;font-size:.8125rem;color:#ffd9c4;transition:background .15s}
.hero-pilot:hover{background:rgba(254,124,63,.26)}
.hero-pilot-tag{background:var(--orange);color:#2a0f04;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:.66rem;padding:.22em .62em;border-radius:999px}
.hero-pilot-text{padding-right:.35rem}
@media(max-width:600px){.hero-pilot-text{font-size:.74rem}}

/* RTL correctness (Arabic pages get dir="rtl" on <html>): code is Latin and
   always reads LTR - isolate it so surrounding RTL prose doesn't scramble
   leading/trailing punctuation. Mirrors the SPA's parts/rtl.css. */
[dir="rtl"] pre,[dir="rtl"] code,[dir="rtl"] kbd,[dir="rtl"] samp{direction:ltr;text-align:left;unicode-bidi:isolate}
/* The nav row mirrors under RTL, putting the lang FAB toward the LEFT edge -
   follow it with the menu (which is otherwise pinned right:1.5rem physically). */
[dir="rtl"] .lang-menu{right:auto;left:1.5rem}
`.trim();

const THEME_SVG_MOON = `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const THEME_SVG_SUN  = `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
// The third theme: the app's mid-toned, palette-driven 'brand' chrome (theme.ts
// THEME_ICONS.brand). A painter's palette so the three glyphs read at a glance.
const THEME_SVG_BRAND = `<svg class="icon-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 22z"/><circle cx="13.5" cy="6.5" r=".8"/><circle cx="17.5" cy="10.5" r=".8"/><circle cx="8.5" cy="7.5" r=".8"/><circle cx="6.5" cy="12.5" r=".8"/></svg>`;
// Icon-only cycle button showing the ACTIVE theme's glyph (CSS below picks which,
// off [data-theme]) - matching the app's createThemeToggle. Clicking steps
// light → dark → brand → light (THEME_INTERACT_SCRIPT).
const THEME_TOGGLE   = `<button class="nav-theme-toggle" aria-label="Switch theme (light, dark, brand)" title="Switch theme - light / dark / brand">${THEME_SVG_SUN}${THEME_SVG_MOON}${THEME_SVG_BRAND}</button>`;
// The source, next to the theme switch. The GitHub mark is a proper noun's glyph, so the
// label is not a t() key (the site corpus would otherwise ask 26 translators for "GitHub").
const GITHUB_LINK    = `<a class="nav-github" href="https://github.com/lolly-tools/lolly" aria-label="Lolly on GitHub" title="GitHub" rel="noopener" target="_blank"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></a>`;

// The theme lives on [data-theme] (the app's mechanism, so the inlined tokens.css themes),
// and the legacy `.dark` CLASS is kept in lock-step with it - purely so the banked masthead
// canvases (docs/mastheads/*.html), which detect dark via classList.contains('dark') + a
// MutationObserver on the class attribute, keep theme-switching without being re-signed. The
// 'brand' theme is a DARK ground (tokens.css [data-theme="brand"] declares color-scheme:dark),
// so it carries the `.dark` class too - the mastheads render their dark palette under it. New
// mastheads read [data-theme] per dev-docs/docs-masthead-gemini-prompt.md; once the bank is
// re-baked on that prompt this class shim can go.
const THEME_INIT_SCRIPT = `<script>(function(){var c=localStorage.getItem('theme'),s=window.matchMedia('(prefers-color-scheme:dark)').matches;var t=(c==='light'||c==='dark'||c==='brand')?c:(s?'dark':'light');var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark'||t==='brand');})();</script>`;

// Pre-paint, beside the theme flag and for the same reason: it decides how the
// first frame is painted. It only ARMS the screenshot motion - SHOT_MOTION_SCRIPT
// at end-of-body is what lands each shot. Without JS neither runs, the class is
// absent, and the shots are plain visible images.
const SHOT_MOTION_INIT = `<script>document.documentElement.classList.add('shots-motion');</script>`;

// The formats table's educational dialog: click a chip → open a <dialog> naming the
// format in full, describing it, and listing the properties Lolly supports. The whole
// catalog is embedded as JSON so there's no fetch; text goes in via textContent (safe).
const FORMATS_DIALOG_SCRIPT = `<script>(function(){
  var el=document.getElementById('fmt-catalog-data'),dlg=document.getElementById('fmt-dialog');
  if(!el||!dlg)return;var data;try{data=JSON.parse(el.textContent);}catch(e){return;}
  var DIR={in:'Reads · import only',out:'Writes · export only',both:'Reads & writes · round-trip'};
  var q=function(id){return dlg.querySelector(id);};
  function open(tok){var f=data.formats[tok];if(!f)return;
    q('#fmt-dlg-icon').innerHTML=(data.catIcons&&data.catIcons[f.category])||'';
    q('#fmt-dlg-dir').textContent=DIR[f.dir]||'';
    q('#fmt-dlg-name').textContent=f.name;
    q('#fmt-dlg-full').textContent=f.full+' · '+f.category;
    q('#fmt-dlg-desc').textContent=f.desc;
    var us=q('#fmt-dlg-specs');us.textContent='';
    ((data.specifics&&data.specifics[tok])||[]).forEach(function(s){var li=document.createElement('li');li.textContent=s;us.appendChild(li);});
    var ul=q('#fmt-dlg-feats');ul.textContent='';
    (f.features||[]).forEach(function(k){var li=document.createElement('li');li.textContent=(data.features&&data.features[k])||k;ul.appendChild(li);});
    var md=f.metadata||null,mEl=q('#fmt-dlg-meta');
    var names=function(v){return (v&&v.length?v:[]).map(function(k){return (data.metaLabels&&data.metaLabels[k])||k;}).join(', ')||'nothing';};
    mEl.textContent=md?('Metadata: reads '+names(md.reads)+' · writes '+names(md.writes)+' · round trip '+md.preserves+'.'+(md.note?' '+md.note:'')):'';
    var un=q('#fmt-dlg-unsup'),unWrap=q('#fmt-dlg-unsup-wrap');un.textContent='';
    var gaps=(data.unsupported&&data.unsupported[tok])||[];
    gaps.forEach(function(s){var li=document.createElement('li');li.textContent=s;un.appendChild(li);});
    unWrap.hidden=gaps.length===0;
    if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
  }
  document.addEventListener('click',function(e){
    var chip=e.target.closest&&e.target.closest('.fmt-chip');
    if(chip){e.preventDefault();open(chip.getAttribute('data-fmt'));return;}
    if(e.target===dlg)dlg.close();
  });
})();</script>`;
const THEME_INTERACT_SCRIPT = `<script>(function(){var order=['light','dark','brand'];var btn=document.querySelector('.nav-theme-toggle');if(!btn)return;function apply(t){var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark'||t==='brand');localStorage.setItem('theme',t);}btn.addEventListener('click',function(){var cur=document.documentElement.dataset.theme||'light';var i=order.indexOf(cur);apply(order[i<0?0:(i+1)%order.length]);});window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(e){if(!localStorage.getItem('theme')){var r=document.documentElement;r.dataset.theme=e.matches?'dark':'light';r.classList.toggle('dark',e.matches);}});})();</script>`;

const HAM_BTN = `<button class="nav-hamburger" id="navHamburger" aria-label="Toggle navigation" aria-expanded="false"><svg class="icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg><svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;

/**
 * Screenshot settle. Its own observer rather than a `.reveal` class on each shot,
 * because a shot has a second condition the text blocks don't: it waits for the
 * image to actually decode. Shots are `loading="lazy"`, so reusing `.reveal`
 * would animate an empty box and then pop the pixels in afterwards.
 */
const SHOT_MOTION_SCRIPT = `<script>(function(){
  var els=document.querySelectorAll('.shot');if(!els.length)return;
  if(!('IntersectionObserver' in window)){els.forEach(function(el){el.classList.add('shot--in');});return;}
  function land(el){
    // The RENDERED image, which on a dual shot in dark mode is the second one.
    // Blink fetches display:none images too, so keying off the first would happen
    // to work - and would be landing the motion on the wrong file's decode.
    var imgs=el.querySelectorAll('img'),img=imgs[0];
    for(var k=0;k<imgs.length;k++){if(getComputedStyle(imgs[k]).display!=='none'){img=imgs[k];break;}}
    // Decoded already (cache) → settle now. Otherwise settle on load, so the
    // motion always carries real pixels. A failed image still lands, or the shot
    // would be stuck invisible at opacity 0.
    if(!img||img.complete){el.classList.add('shot--in');return;}
    var go=function(){el.classList.add('shot--in');};
    img.addEventListener('load',go,{once:true});
    img.addEventListener('error',go,{once:true});
  }
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);land(e.target);}});
  },{threshold:0,rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(el){io.observe(el);});
})();</script>`;

/**
 * The showcase camera. Maps the block's travel through the viewport onto --p, and
 * lerps the inlined SVG's viewBox from a centre crop out to full extent.
 *
 * The zoom crop is derived from the shot's own viewBox and keeps its aspect ratio,
 * so preserveAspectRatio never letterboxes mid-flight (which would read as the
 * artwork jumping rather than the camera moving).
 *
 * Everything is rAF-coalesced: a scroll event only marks the frame dirty. Writing
 * the viewBox attribute directly in the scroll handler would force layout on every
 * event, on the one element on the page that is expensive to lay out.
 */
const SHOWCASE_SCRIPT = `<script>(function(){
  var els=document.querySelectorAll('.showcase');if(!els.length)return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;  // the <img> is already the finished state
  var ZOOM=0.22;   // p=0 shows this fraction of each axis, centred - deep in the streets
  var items=[];

  // Swap the <img> for live SVG parsed from the same file. Only ever an upgrade:
  // any failure (offline, 404, unparseable, no <svg> root) leaves the image alone,
  // so the worst case is a still screenshot rather than a broken one.
  function upgrade(fig,done){
    var src=fig.getAttribute('data-shot');if(!src)return;
    fetch(src,{credentials:'same-origin'}).then(function(r){
      if(!r.ok)throw new Error(r.status);return r.text();
    }).then(function(text){
      // Strip the credential from the DOM copy: a manifest whose hash binding no
      // longer matches its bytes is a FALSE NEGATIVE waiting to happen if anyone
      // saves this markup out. The file keeps its credential; the credential line
      // on this block points at the file.
      text=text.replace(/<metadata>[\\s\\S]*?<\\/metadata>/g,'').replace(/<\\?xml[^>]*\\?>/g,'');
      // An inline SVG joins the PAGE's id space, so namespace anything it defines
      // before it can collide with another asset's clipPath or filter.
      text=text.replace(/\\bid="([^"]+)"/g,'id="sc-$1"')
               .replace(/url\\(#([^)]+)\\)/g,'url(#sc-$1)')
               .replace(/\\bhref="#([^"]+)"/g,'href="#sc-$1"');
      var doc=new DOMParser().parseFromString(text,'image/svg+xml');
      var svg=doc.documentElement;
      if(!svg||svg.nodeName!=='svg'||doc.querySelector('parsererror'))throw new Error('unparseable');
      svg.setAttribute('class','showcase-art');
      svg.setAttribute('aria-hidden','true');
      svg.setAttribute('focusable','false');
      svg.removeAttribute('width');svg.removeAttribute('height');
      var img=fig.querySelector('.showcase-fallback');
      var stage=fig.querySelector('.showcase-stage');
      if(!stage)return;
      // The image carried the accessible description; the live SVG is decorative,
      // so the description moves to the stage rather than being lost in the swap.
      if(img){stage.setAttribute('role','img');stage.setAttribute('aria-label',img.getAttribute('alt')||'');}
      stage.appendChild(document.importNode(svg,true));
      if(img)img.remove();
      done(fig,stage.querySelector('.showcase-art'));
    }).catch(function(){/* keep the <img> */});
  }

  function activate(fig,svg){
    var vb=(fig.getAttribute('data-viewbox')||'').split(/\\s+/).map(Number);
    if(!svg||vb.length!==4||vb.some(function(n){return !isFinite(n);}))return;
    // Index the leaves in paint order for the stagger. Leaves only: a <g> wrapping
    // half the drawing would otherwise fade as one lump and swallow the layering.
    var leaves=svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,image,text,use');
    for(var i=0;i<leaves.length;i++){leaves[i].setAttribute('data-sc-i','');leaves[i].style.setProperty('--i',i);}
    svg.style.setProperty('--n',leaves.length||1);
    items.push({fig:fig,svg:svg,vb:vb});
    fig.classList.add('showcase--live');
    mark();
  }

  // Fetch when the block is within a screen of the viewport, not on load: this is
  // the one shot on the site worth a few hundred KB, and only for a reader who is
  // actually heading towards it.
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);upgrade(e.target,activate);}});
    },{rootMargin:'100% 0px'});
    els.forEach(function(el){io.observe(el);});
  }else{
    els.forEach(function(el){upgrade(el,activate);});
  }

  var dirty=false;
  function frame(){
    dirty=false;
    var vh=window.innerHeight||document.documentElement.clientHeight;
    items.forEach(function(it){
      var r=it.fig.getBoundingClientRect();
      // 0 when the block's top is still near the fold, 1 by the time its middle
      // has risen to just above centre. Clamped, so scrolling past holds the end.
      var p=(vh*0.9-r.top)/Math.max(1,(vh*0.55+r.height*0.35));
      p=p<0?0:p>1?1:p;
      it.fig.style.setProperty('--p',p.toFixed(4));
      var e=1-Math.pow(1-p,3);                       // ease-out: the camera decelerates into the wide shot
      var f=ZOOM+(1-ZOOM)*e;                         // fraction of each axis on show
      var w=it.vb[2]*f,h=it.vb[3]*f;
      var x=it.vb[0]+(it.vb[2]-w)/2,y=it.vb[1]+(it.vb[3]-h)/2;
      it.svg.setAttribute('viewBox',x.toFixed(2)+' '+y.toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2));
    });
  }
  function mark(){if(!dirty){dirty=true;requestAnimationFrame(frame);}}
  addEventListener('scroll',mark,{passive:true});
  addEventListener('resize',mark);
  frame();
})();</script>`;

/**
 * Tap-to-open for the credential line, and Escape to close it.
 *
 * Everything else about the reveal is CSS (:hover / :focus-within), so this script
 * exists ONLY for the two things CSS cannot do: a touch device has no hover, and a
 * pointer user who opened the line by tapping needs a way out. aria-expanded is
 * managed here rather than in the markup because it is only ever true in a session
 * where this script is running - a static attribute would misreport the CSS-only
 * hover state.
 */
const SHOT_CRED_SCRIPT = `<script>(function(){
  // "Copy signed source" - the banked art's third action (plans/105 section 6). Fetches the
  // SAME file the other two actions point at and puts its text on the clipboard, so a
  // reader can paste it straight into /verify's box and check the credential without
  // downloading anything. Wired FIRST, and independently of the reveal below: an
  // always-open line (a figure's, a page asset's) carries data-static and is
  // deliberately absent from that list.
  var copies=document.querySelectorAll('.shot-cred-copy');
  for(var ci=0;ci<copies.length;ci++)(function(btn){
    var label=btn.querySelector('.shot-cred-copy-label')||btn;
    var rest=label.textContent,timer=null;
    function say(word){
      clearTimeout(timer);
      label.textContent=word;
      // Long enough to read, short enough that the button is honest about its label
      // again before anyone tries a second copy.
      timer=setTimeout(function(){label.textContent=rest;},2400);
    }
    btn.addEventListener('click',function(){
      var src=btn.getAttribute('data-copy-src');if(!src)return;
      fetch(src,{credentials:'same-origin'}).then(function(r){
        if(!r.ok)throw new Error(r.status);return r.text();
      }).then(function(text){
        // No clipboard (an insecure origin, an old browser, a denied permission) is
        // a refusal to pretend: the button says so rather than reporting a copy that
        // never happened. The file is still one link away.
        if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error('no clipboard');
        return navigator.clipboard.writeText(text);
      }).then(function(){
        say(btn.getAttribute('data-copied')||'Copied');
      }).catch(function(){
        say(btn.getAttribute('data-copy-failed')||'Copy failed');
      });
    });
  })(copies[ci]);
  var creds=document.querySelectorAll('.shot-cred:not([data-static])');if(!creds.length)return;
  function close(c){c.removeAttribute('data-open');var b=c.querySelector('.shot-cred-btn');if(b)b.setAttribute('aria-expanded','false');}
  function closeAll(except){creds.forEach(function(c){if(c!==except)close(c);});}
  creds.forEach(function(c){
    var btn=c.querySelector('.shot-cred-btn');if(!btn)return;
    btn.addEventListener('click',function(e){
      e.preventDefault();
      var open=!c.hasAttribute('data-open');
      closeAll(c);
      if(open){c.setAttribute('data-open','');btn.setAttribute('aria-expanded','true');}else close(c);
    });
  });
  // Escape closes the open line and returns focus to its trigger, matching how the
  // app's own overlays behave.
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var open=document.querySelector('.shot-cred[data-open]');
    if(!open)return;
    close(open);
    var b=open.querySelector('.shot-cred-btn');if(b)b.focus();
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('.shot-cred'))closeAll(null);
  });
})();</script>`;

const SCROLL_REVEAL_SCRIPT = `<script>(function(){var els=document.querySelectorAll('.reveal');if(!els.length)return;
  // Pre-reveal on BOTH widths (plans/168 WP-3). Desktop used to wait for 10% of a band
  // to be inside the viewport minus 32px, which on this page's tall bands meant a
  // normally-paced scroller met an empty screen before the content faded in - the
  // un-revealed band still holds its layout space, so the gap is real, not perceived.
  // A positive bottom rootMargin starts the fade while the band is still below the fold.
  var opts={threshold:0,rootMargin:window.matchMedia('(max-width:768px)').matches
    ?'0px 0px 20% 0px'
    :'0px 0px 25% 0px'};
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}});},opts);
  els.forEach(function(el){io.observe(el);});})();</script>`;

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
    svg.setAttribute('class','lg-svg');
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
    // 2x displacement so the refraction visibly bends whatever passes behind the
    // button (format chips, the lollipop) instead of only whispering at the edge.
    var REFRACTION_BOOST=2;
    feDisp.setAttribute('scale',String((maxS*2*W*REFRACTION_BOOST).toFixed(2)));

    filter.appendChild(feImg);filter.appendChild(feDisp);
    defs.appendChild(filter);svg.appendChild(defs);
    document.body.appendChild(svg);

    var bf='url(#'+id+') blur(0.4px) contrast(1.15) brightness(1.07) saturate(1.2)';
    // Apply synchronously. The filter auto-re-renders when its feImage map finishes
    // loading, so there's no need to defer - and NOT via img.decode(), which never
    // resolves in a hidden/throttled tab and would leave the glass unapplied.
    btn.style.backdropFilter=bf;
    btn.style.webkitBackdropFilter=bf;
  }

  function paint(){
    // Clear any filters from a previous pass so a re-run (e.g. after webfonts change
    // the button size) rebuilds cleanly instead of stacking duplicate-id filters.
    document.querySelectorAll('svg.lg-svg').forEach(function(s){ s.remove(); });
    // PRIMARY only. The displacement backdrop paints the button blank in some
    // renderers (Chromium at rest, recovering only on the hover transform), which
    // is a nuisance under the primary's black-on-white label and a blank white
    // box under the secondary's white-on-glass one - so the secondary keeps the
    // stylesheet's plain blur and never takes the SVG filter. .btn-compact (the
    // persona lanes, plans/177) opts out for the same reason over the pane's flat
    // ground; small utility buttons keep their plain fill.
    document.querySelectorAll('.btn-primary:not(.btn-compact)').forEach(function(btn,i){
      try{ buildGlass(btn,i); }catch(e){ if(window.console)console.warn('liquid-glass failed',e); }
    });
  }
  // Two rAFs so layout has settled and the buttons have their final size; re-run once
  // on full load as a belt-and-braces guard for a cold image cache.
  requestAnimationFrame(function(){ requestAnimationFrame(paint); });
  window.addEventListener('load', paint);
})();</script>`;

/**
 * The chip labels: every format the platform can WRITE, read from the same catalog
 * the /info formats table is built from (docs/site/formats-catalog.json, whose own
 * header says the counts are computed here rather than hand-maintained).
 *
 * `dir` is in|out|both - anything but "in" is exportable, so that is the whole test.
 * A token with a space in it ("CMYK PDF", "Animated WebP", "CSS variables") is a
 * LABEL, not an extension: those are skipped rather than mangled into one, and every
 * one of them but Radiance HDR already shares its extension with an entry that stays.
 * Skipping is the rule because the alternative - a lookup table of "what file
 * extension does this really use" - is exactly the hand-maintained list this replaces.
 */
function chipExtensions(): string[] {
  const catalog = loadSiteJson('formats-catalog.json') as { formats: Array<{ token?: string; dir?: string }> };
  const exts: string[] = [];
  for (const f of catalog.formats ?? []) {
    if (f.dir === 'in') continue;
    const token = String(f.token ?? '').trim();
    if (!token || /\s/.test(token)) continue;
    const ext = `.${token.toUpperCase()}`;
    if (!exts.includes(ext)) exts.push(ext);
  }
  return exts;
}

/**
 * The floating-format chip field - the landing hero's ambient effect, and (since
 * plans/105) the default masthead behind every article page's h1.
 *
 * ONE engine, two instances, because they are the same idea seen twice: Lolly's
 * output formats drifting up past whatever the page is about. What differs is not
 * the motion but the manners - the landing is a front door and may play (chips burst
 * where you tap, the loop never stops); a docs masthead is furniture on a page
 * someone came to READ, so it holds still when asked, stops when scrolled past, and
 * never reacts to a click.
 *
 * The engine takes those as options rather than branching on which page it is on:
 *
 *   palette()      → {fill,label} read at BAKE time, so a theme flip can re-bake the
 *                    existing chips in place (docs) instead of resetting the field.
 *   burst          → click/tap scatters a ring of chips (landing only).
 *   pause          → run only while the band is on screen and the tab is visible.
 *   reduceMotion   → honour prefers-reduced-motion by painting ONE frame, no loop.
 *
 * Defaults reproduce the landing exactly (landing palette, no pausing, no
 * reduced-motion branch, and the loop started immediately) - this refactor moved the
 * code, not the hero.
 */
const CHIP_FIELD_JS = `
window.__lollyChipField=function(canvas,opt){
  opt=opt||{};
  var ctx=canvas.getContext('2d');
  // GENERATED at build time from docs/site/formats-catalog.json (chipExtensions()) -
  // every format the catalog says Lolly can WRITE. Not a hand list: the last one was
  // written when Lolly exported 27 formats and was still claiming 27 long after the
  // real answer had passed 40, because nothing failed when it fell behind.
  var exts=${JSON.stringify(chipExtensions())};
  // Headline formats appear ~2x as often as the rest: listing them again weights
  // them double in the pick pool (each favored ext is in the pool twice).
  var extPool=exts.concat(['.PDF','.SVG','.PNG','.MP4','.PPTX']);
  var floaters=[], fragments=[];
  // The chip colours, resolved at bake time. Two fields only: the box and its label.
  var defaultPal=function(){return{fill:'#1c4a2e',label:'#30ba78'};};
  var palette=opt.palette||defaultPal;
  var pal=palette();
  // Ambient chip population scales with canvas width so wide heroes aren't sparse
  // and narrow/mobile ones aren't crowded - and with height past a hero's worth,
  // since the landing's field runs on behind the covers band: twice the height at
  // the same count would be half the density. Short mastheads are unaffected.
  function targetFloaters(){ return Math.max(5, Math.min(22, Math.round(cw/100*Math.max(1, ch/600)))); }
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
    if(still) paintOnce();
  }
  function rand(a,b){return a+Math.random()*(b-a);}

  // Bake one chip (filled box + label) into an offscreen sprite. Both the ambient
  // floaters and the click-burst fragments reuse this, so the chip look lives in
  // one place; callers add their own motion fields. Pre-compositing also lets a
  // chip fade as a single group instead of each layer fading over the bg.
  // ext/fs are passed back out so a palette change can re-bake the SAME chip
  // rather than replacing it with a different word at a different size.
  function makeChip(ext,fs){
    ext=ext||extPool[Math.floor(Math.random()*extPool.length)];
    fs=fs||rand(10,22);
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
    sx.fillStyle=pal.fill; sx.fill();
    sx.fillStyle=pal.label;
    sx.font=weight+' '+fs+'px SUSE,sans-serif';
    // Centre on the actual glyph box, not the em box: these labels are all-caps
    // with no descenders, so a 'middle' baseline leaves them riding high with a
    // gap at the bottom. Offset the baseline by half the ink height to balance.
    sx.textAlign='center'; sx.textBaseline='alphabetic';
    var m=sx.measureText(ext);
    var asc=m.actualBoundingBoxAscent||fs*0.7, desc=m.actualBoundingBoxDescent||0;
    sx.fillText(ext,w/2,h/2+(asc-desc)/2);
    return{spr:spr,w:w,h:h,ext:ext,fs:fs};
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
      spr:c.spr, w:c.w, h:c.h, ext:c.ext, fs:c.fs,
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

    if(running) requestAnimationFrame(tick);
  }

  // One frame, no loop - the reduced-motion rendering. The field still SAYS what it
  // says (formats, drifting); it just doesn't move while saying it.
  function paintOnce(){
    fill(true);
    ctx.clearRect(0,0,cw,ch);
    for(var i=0;i<floaters.length;i++) drawChip(floaters[i],1);
  }
  function fill(initial){
    while(floaters.length<targetFloaters()) floaters.push(makeFloater(initial));
  }

  var still=!!opt.reduceMotion && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var running=false;
  function start(){
    if(running||still)return;
    running=true; requestAnimationFrame(tick);
  }
  function stop(){ running=false; }
  // Re-bake every chip in the current palette, in place: same word, same size, same
  // position, new colours. A theme flip should recolour the field, not restart it.
  function rebake(){
    pal=palette();
    for(var i=0;i<floaters.length;i++){
      var fl=floaters[i], c=makeChip(fl.ext,fl.fs);
      fl.spr=c.spr; fl.w=c.w; fl.h=c.h;
    }
    if(still) paintOnce();
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  if(opt.burst){
    // Click/tap over the band bursts a ring of chips from the point. The canvas is
    // pointer-events:none, so we listen on the document and gate on its parent (the
    // .hero-wrap on the landing, the masthead band on an article); coords are mapped
    // into the canvas box, which covers the whole parent.
    var band=canvas.parentElement;
    var burstAt=function(e){
      if(!band.contains(e.target))return;
      if(still)return;               // a band that holds still holds still when clicked
      var rect=canvas.getBoundingClientRect();
      explodeAt(e.clientX-rect.left,e.clientY-rect.top);
    };
    if(opt.burstGuard){
      // On a page of prose the band contains real text and may later contain real
      // controls, so the effect yields to both: no burst from a link/button, and none
      // when the pointer was dragged (a text selection) rather than clicked. Fires on
      // pointerUP for exactly that reason - at pointerdown a drag is indistinguishable
      // from a tap.
      var dx=0,dy=0,downT=0;
      band.addEventListener('pointerdown',function(e){ dx=e.clientX; dy=e.clientY; downT=Date.now(); });
      band.addEventListener('pointerup',function(e){
        if(e.button!==0)return;
        if(e.target.closest('a,button,input,select,textarea,label,summary,[role="button"],[contenteditable]'))return;
        if(Math.abs(e.clientX-dx)>6||Math.abs(e.clientY-dy)>6)return;   // dragged: a selection
        if(Date.now()-downT>600)return;                                 // held: not a tap
        var sel=window.getSelection&&window.getSelection();
        if(sel&&!sel.isCollapsed)return;                                // text is selected
        burstAt(e);
      });
    }else{
      document.addEventListener('pointerdown',burstAt);
    }
  }
  fill(true);
  if(still){
    paintOnce();
  }else if(opt.pause){
    // Two gates, both cheap and both about not animating for nobody: off screen
    // (the reader has scrolled into the article) and hidden tab.
    var onScreen=true;
    var sync=function(){ if(onScreen && !document.hidden) start(); else stop(); };
    if(window.IntersectionObserver){
      new IntersectionObserver(function(es){ onScreen=es[0].isIntersecting; sync(); }).observe(canvas.parentElement);
    }
    document.addEventListener('visibilitychange',sync);
    sync();
  }else{
    start();
  }
  return {rebake:rebake,start:start,stop:stop};
};
`;

const HERO_CANVAS_SCRIPT = `<script>(function(){
  var canvas=document.getElementById('heroCanvas');
  if(!canvas)return;
  // The landing hero: default palette, always running, and it bursts when tapped.
  window.__lollyChipField(canvas,{burst:true});
})();</script>`;

/**
 * The article masthead's instance of the same field.
 *
 * The effect was built for one dark plate and hardcoded to it (#1c4a2e chips,
 * #30ba78 labels, color-dodge). Docs pages are read in every theme, so here the
 * palette comes from the page's own tokens and the chips are RE-BAKED when the
 * theme changes - the toggle stamps [data-theme] (light/dark/brand) on <html>, and a
 * reader on "system" gets the same flip from the OS; palette() treats brand as a dark
 * ground. Blend + opacity are CSS's job (.docs-mast-canvas), so
 * the JS only ever decides two colours.
 */
const DOCS_MASTHEAD_SCRIPT = `<script>(function(){
  var canvas=document.querySelector('.docs-mast-canvas');
  if(!canvas)return;
  function tok(name,fallback){
    var v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v||fallback;
  }
  function palette(){
    var th=document.documentElement.dataset.theme;
    var dark=th==='dark'||th==='brand';  // brand is a dark ground too
    // Dark: the landing's own chip fill over the dark band, under color-dodge -
    // the same glow the front door has. Light: a mint chip on a near-white band,
    // normal blend, so the field reads as watermark rather than decoration.
    return dark
      ? {fill:'#1c4a2e', label:tok('--green','#30ba78')}
      : {fill:tok('--border','#d8ede4'), label:tok('--green','#30ba78')};
  }
  var field=window.__lollyChipField(canvas,{palette:palette,pause:true,reduceMotion:true,burst:true,burstGuard:true});
  // The [data-theme] flip (docs theme toggle) and the OS preference both change the answer.
  new MutationObserver(function(){ field.rebake(); })
    .observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  var mq=window.matchMedia('(prefers-color-scheme:dark)');
  if(mq.addEventListener) mq.addEventListener('change',function(){ field.rebake(); });
})();</script>`;

// Links into the app's /verify view open as a POPOUT WINDOW, not a tab - the
// whole point of the link is dragging an image from THIS page into that drop
// zone, which needs both windows visible side by side. Plain target=_blank
// backgrounds the docs page and the reader loses the image they meant to drag.
// The href stays a real link (middle-click / ctrl-click / no-JS all still work).
const VERIFY_POPOUT_SCRIPT = `<script>(function(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href$="/verify"]');if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();var w=Math.min(1100,screen.availWidth*.8),h=Math.min(850,screen.availHeight*.9);window.open(a.href,'lolly-verify','popup,width='+w+',height='+h+',left='+((screen.availWidth-w)/2)+',top='+((screen.availHeight-h)/2));});})();</script>`;

// Docs search. The index is fetched on first interaction, never on load, so a
// reader who doesn't search pays nothing. Results are built with DOM calls rather
// than innerHTML: the records are plain text lifted out of rendered pages, and
// code samples in them legitimately contain < and &.
const DOCS_SEARCH_SCRIPT = `<script>(function(){
var wrap=document.querySelector('.docs-search');if(!wrap)return;
var input=document.getElementById('docs-search');
var out=document.getElementById('docs-search-results');
var base=wrap.getAttribute('data-search-base')||'/info';
var records=null,pending=null,active=-1,timer;

// Fold case and diacritics, so "recuperer" finds "récupérer" and the reverse.
// NFD splits an accented letter into base + combining mark and the range strip
// removes the mark; scripts that neither case-fold nor decompose pass through
// unchanged, which is the correct no-op rather than a wrong transform.
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}

function load(){
  if(records)return Promise.resolve(records);
  if(!pending)pending=fetch(base+'/search-index.json')
    .then(function(r){return r.ok?r.json():[];})
    .then(function(j){records=j.map(function(r){r._=norm(r.h+' '+r.t+' '+r.x);return r;});return records;})
    .catch(function(){records=[];return records;});
  return pending;
}

// Every term must appear somewhere in the record - an AND, so adding a word
// narrows rather than widens. Where it matched decides the rank: a heading beats
// a page title beats body prose.
function score(r,terms){
  var h=norm(r.h),t=norm(r.t),s=0;
  for(var i=0;i<terms.length;i++){
    var q=terms[i];
    if(r._.indexOf(q)<0)return 0;
    if(h.indexOf(q)===0)s+=8;else if(h.indexOf(q)>=0)s+=5;
    else if(t.indexOf(q)>=0)s+=3;else s+=1;
  }
  if(!r.h)s+=1;
  return s;
}

function close(){out.hidden=true;out.textContent='';active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}

// The panel is position:fixed to escape the sidebar's scroll clipping, so it has
// to be told where the input is - and told again whenever that moves. Clamped so
// a narrow window can't push it off the inline edge.
function place(){
  if(out.hidden)return;
  var r=input.getBoundingClientRect();
  var w=out.offsetWidth||340;
  var x=Math.max(8,Math.min(r.left,document.documentElement.clientWidth-w-8));
  out.style.top=(r.bottom+6)+'px';
  out.style.left=x+'px';
}

function render(list){
  out.textContent='';active=-1;input.removeAttribute('aria-activedescendant');
  if(!list.length){
    var e=document.createElement('div');
    e.className='docs-search-empty';
    e.textContent=out.getAttribute('data-empty')||'No matches';
    out.appendChild(e);
  }else{
    list.forEach(function(r,n){
      var a=document.createElement('a');
      a.className='docs-search-hit';a.id='docs-hit-'+n;a.setAttribute('role','option');
      a.href=base+'/'+r.p+'.html'+(r.a?'#'+r.a:'');
      var h=document.createElement('span');h.className='hit-h';h.textContent=r.h||r.t;a.appendChild(h);
      if(r.h){var c=document.createElement('span');c.className='hit-c';c.textContent=r.t;a.appendChild(c);}
      if(r.x){var x=document.createElement('span');x.className='hit-x';x.textContent=r.x;a.appendChild(x);}
      out.appendChild(a);
    });
  }
  out.hidden=false;input.setAttribute('aria-expanded','true');place();
}

function run(){
  var q=input.value.trim();
  if(!q){close();return;}
  load().then(function(rs){
    if(input.value.trim()!==q)return;   // a later keystroke already won
    var terms=norm(q).split(/\\s+/).filter(Boolean);
    var hits=[];
    for(var i=0;i<rs.length;i++){var s=score(rs[i],terms);if(s>0)hits.push({r:rs[i],s:s});}
    hits.sort(function(a,b){return b.s-a.s;});
    render(hits.slice(0,12).map(function(x){return x.r;}));
  });
}

function move(d){
  var links=out.querySelectorAll('.docs-search-hit');if(!links.length)return;
  active=(active+d+links.length)%links.length;
  for(var i=0;i<links.length;i++)links[i].classList.toggle('is-active',i===active);
  input.setAttribute('aria-activedescendant',links[active].id);
  links[active].scrollIntoView({block:'nearest'});
}

input.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,90);});
input.addEventListener('focus',load);
input.addEventListener('keydown',function(e){
  if(e.key==='ArrowDown'){e.preventDefault();move(1);}
  else if(e.key==='ArrowUp'){e.preventDefault();move(-1);}
  else if(e.key==='Enter'){var l=out.querySelector('.docs-search-hit.is-active');if(l){e.preventDefault();l.click();}}
  else if(e.key==='Escape'){if(input.value){input.value='';close();}else{input.blur();}}
});
document.addEventListener('click',function(e){if(!wrap.contains(e.target)&&!out.contains(e.target))close();});
addEventListener('resize',place);
addEventListener('scroll',place,true);   // capture: the rail scrolls, not the window
})();</script>`;

const HAMBURGER_SCRIPT = `<script>(function(){var ham=document.getElementById('navHamburger');var menu=document.getElementById('navMobileMenu');if(!ham||!menu)return;ham.addEventListener('click',function(){var open=menu.classList.toggle('open');ham.classList.toggle('open',open);ham.setAttribute('aria-expanded',open?'true':'false');});menu.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){menu.classList.remove('open');ham.classList.remove('open');ham.setAttribute('aria-expanded','false');});});document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!ham.contains(e.target)){menu.classList.remove('open');ham.classList.remove('open');ham.setAttribute('aria-expanded','false');}});})();</script>`;

// The "On this page" jump nav (pageJumpNav, near wrapPage). Deliberately does NOT
// touch scrolling: the links are ordinary anchors, so the browser's own jump - and
// the site's own `scroll-behavior` (already reduced-motion-aware in CSS) - does the
// move. Closing on link click is the only thing the click handler does; the default
// navigation runs after it. Esc closes and RETURNS FOCUS to the button, so keyboard
// reading resumes where it left off rather than at the top of the document.
const DOC_JUMP_SCRIPT = `<script>(function(){
  var btn=document.getElementById('docJumpBtn'),nav=document.getElementById('docJumpNav');
  if(!btn||!nav)return;
  function setOpen(open){nav.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');}
  btn.addEventListener('click',function(e){e.stopPropagation();setOpen(nav.hidden);});
  nav.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false);});
  document.addEventListener('click',function(e){if(!nav.hidden&&!nav.contains(e.target)&&!btn.contains(e.target))setOpen(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!nav.hidden){setOpen(false);btn.focus();}});
})();</script>`;

// ── i18n: site chrome (nav/sidebar/footer labels) + per-locale page sources ──
//
// A flat {EnglishSource: Translated} catalog per language (docs/i18n/<lang>/
// site.json), generated by `npm run translate -- --corpus site` (see
// plans/38-localize.md section 8) - the same English-as-key, identity-fallback contract
// as the SPA's i18n.ts. Page BODY content follows the same fallback: a
// docs/i18n/<lang>/<slug>.md sidecar is used when present, else the page ships
// in English inside the localized chrome rather than 404ing.
function loadSiteCatalog(lang: Lang): Record<string, string> {
  if (lang === 'en') return {};
  const p = resolve(__dirname, 'i18n', lang, 'site.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}
// Set once per locale pass in build(); read by every t() call during that pass.
let activeCatalog: Record<string, string> = {};
function t(s: string): string { return activeCatalog[s] ?? s; }

// The locale of the page currently being rendered (mirrors activeCatalog). Read by
// inline()'s screenshot rewrite so a translated page can point at a localized shot
// (<slug>.<lang>.<ext>, captured with ?lang= injected) when one exists, else the
// English baseline. Set in build()'s per-locale loop.
let activeLang: Lang = 'en';
/** A `<slug>.<lang>.<ext>` localized shot exists on disk (docs/shots/) for this pass? */
function localizedShot(slug: string, ext: string): string | null {
  if (activeLang === 'en') return null;
  const name = `${slug}.${activeLang}.${ext}`;
  return existsSync(resolve(__dirname, 'shots', name)) ? name : null;
}

/**
 * The dark-theme twin of an already-resolved shot filename, if the pipeline
 * captured one (`dark=1` on the recipe → `<slug>[.<lang>].dark.<ext>`).
 *
 * Derived from the file the locale resolver just chose, never from the slug: a
 * translated page must pair its own translated light shot with its own translated
 * dark shot. Falling back to the English dark file would make the reader's theme
 * toggle change the LANGUAGE of the picture.
 */
function darkShot(file: string): string | null {
  const name = file.replace(/\.(\w+)$/, '.dark.$1');
  return existsSync(resolve(__dirname, 'shots', name)) ? name : null;
}

// The build-time DocsRenderContext: the adapter the shared renderer
// (@lolly-tools/docs-render) calls into. It reads facts from the filesystem + C2PA
// manifests here; the in-app docs view (M2) will implement the same surface over a
// shipped docs-manifest.json. lang/htmlLang/t are GETTERS so this single const reflects
// the live per-locale module state (activeLang/activeCatalog); nextCredId shares the one
// process-global credSeq counter across every page and locale, so ids stay byte-identical.
const docCtx: DocsRenderContext = {
  get lang() { return activeLang; },
  get htmlLang() { return LANG_META[activeLang]?.htmlLang ?? activeLang; },
  t: (s) => t(s),
  docIcon: (k) => docIcon(k),
  docLogo: (k) => docLogo(k),
  docLogoBlock: (ks) => docLogoBlock(ks),
  nextCredId: () => `shot-cred-${++credSeq}`,
  localizedShot: (slug, ext) => localizedShot(slug, ext),
  darkShot: (f) => darkShot(f),
  // The contract's second arg is a served /info/ URL (a page asset), which this impl
  // resolves to its built path; a bare shot (no assetSrc) reads from docs/shots/<file>.
  shotSize: (f, assetSrc) => shotSize(f, assetSrc ? resolve(outDir, assetSrc.replace(/^\/info\//, '')) : undefined),
  tryLink: (file) => {
    const def = shotRecipe(file.split('.')[0] ?? '');
    return def?.tryIt && def.route.startsWith('/') ? { route: def.route } : null;
  },
  // The credential FACTS, read off the served bytes. Path reconstruction reproduces
  // exactly what each shotCredential call site used to pass as `from.path`: a bare shot
  // reads docs/shots/<file>; a page asset/mascot reads outDir/<rel>; banked art (art:true)
  // reads docs/<bank>/<file>. `file` (the ext/basename/recipe-slug) and `rel` (the read
  // path) can differ for banked art, and each is used where the original used it.
  credential: (file, opts): CredentialFacts | null => {
    const art = !!opts?.art;
    let path: string;
    let src: string;
    if (!opts) {
      path = resolve(__dirname, 'shots', file);
      src = `/info/shots/${file}`;
    } else {
      src = opts.assetSrc ?? `/info/shots/${file}`;
      const rel = src.replace(/^\/info\//, '');
      path = art ? resolve(__dirname, rel) : resolve(outDir, rel);
    }
    const p = readShotProvenance(path);
    if (!p) return null;
    const anat = readShotAnatomy(path);
    const def = art ? null : shotRecipe(file.split('.')[0] ?? '');
    return {
      signer: p.signer,
      generator: p.generator,
      when: p.when,
      dimensions: p.dimensions,
      ai: p.ai,
      model: p.model,
      oversight: p.oversight,
      anat: anat
        ? { kind: anat.kind, paths: anat.paths, nodes: anat.nodes, groups: anat.groups, images: anat.images, elements: anat.elements, bytes: anat.bytes }
        : null,
      recipe: def ? { width: def.width, height: def.height, dpi: def.dpi, walker: def.walker } : null,
      src,
      canCopySource: art,
    };
  },
  showcase: (slug) => {
    const file = `${slug}.svg`;
    const path = resolve(__dirname, 'shots', file);
    if (!existsSync(path)) return null;
    const vb = /viewBox="([\d.\-\s]+)"/.exec(readFileSync(path, 'utf-8'))?.[1]?.trim().split(/\s+/).map(Number);
    if (!vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) return null;
    const size = shotSize(file);
    return { viewBox: vb.join(' '), file, src: `/info/shots/${file}`, width: size?.w, height: size?.h };
  },
  art: (bank, id) => {
    const resolved = resolveDocsArt(bank, id, { dir: __dirname, lang: activeLang });
    if (!resolved) return null;
    const inlined = inlineDocsArt(resolved);
    if ('error' in inlined) return null;
    return { html: inlined.html, file: resolved.file, src: resolved.src };
  },
};

function resolvePageSrc(page: Page, lang: Lang): string {
  if (lang !== 'en') {
    const localized = resolve(__dirname, 'i18n', lang, `${page.slug}.md`);
    if (existsSync(localized)) return localized;
  }
  return resolve(__dirname, page.src);
}

// English lives at /info/<door>/<slug>.html (the landing at /info/); every
// other locale mirrors the tree under /info/<lang>/… (plans/177 P1).
function localeHref(lang: Lang, slug: string): string {
  // A generated side-door page carries a directory-style slug (formats/svg,
  // convert/heic-to-jpg) and is served from its own folder as .../index.html,
  // so its URL is the directory, not a .html file. No hand-authored page slug
  // has a slash, so this branch only ever fires for the generated pages.
  if (slug.includes('/')) return lang === 'en' ? `/info/${slug}/` : `/info/${lang}/${slug}/`;
  const file = slug === 'index' ? 'index.html' : `${pathSlug(slug)}.html`;
  return lang === 'en' ? `/info/${file}` : `/info/${lang}/${file}`;
}
function hrefToSlug(href: string): string {
  const bare = href.replace(/^\/info\//, '').replace(/\.html$/, '');
  const m = bare.match(/^([\w-]+)\/([\w-]+)$/);
  return m && DOOR_DIRS.has(m[1]!) ? m[2]! : bare;
}

// Rewrite an href authored in the (always-English) landing-page JSON content -
// either "/" (the app root) or an internal "/info/<slug>.html" page - to the
// equivalent URL for `lang`, so a Spanish landing page's CTAs/links don't dump
// the visitor back into English. The app root gets a `?lang=` query override
// (a session-only override the SPA's initI18n reads at the top of its
// precedence chain - see shells/web/src/main.ts/i18n.ts) since, unlike /info,
// it has no per-locale path to link to instead.
function localizeHref(lang: Lang, href: string): string {
  if (href === '/') return lang === 'en' ? '/' : `/?lang=${lang}`;
  // Accept both the flat authored form (/info/<slug>.html - content JSON keeps
  // writing this; localeHref doorizes it) and an already-doored href.
  const m = href.match(/^\/info\/(?:([\w-]+)\/)?([\w-]+)\.html$/);
  if (!m) return href;
  if (m[1] && !DOOR_DIRS.has(m[1])) return href;
  return localeHref(lang, m[2]!);
}

// Language-switcher indicator (~/Build/language-icon.svg), inlined with
// fill="currentColor" so it themes with the surrounding nav text. Same markup
// as shells/web/src/i18n.ts's LANG_ICON_SVG - duplicated (not imported) since
// this static-site generator has no shared module boundary with the SPA.
const LANG_ICON_SVG = `<svg class="lang-switch-icon" viewBox="0 0 440.332 510.236" fill="currentColor" aria-hidden="true"><path d="m311.768 445.719 12.531 20.615c-31.404 20.067-66.19 30.034-103.148 33.127h-16.436c-3.287 0-19.54-2.008-20.088-2.008-6.026-.913-12.235-2.009-17.896-3.287q-15.34-3.562-30.68-9.315c-7.487-2.739-15.34-6.391-22.28-9.86-3.469-1.644-6.573-3.287-9.86-5.296-1.096-.548-6.94-4.748-9.862-4.748-3.287 0-5.297 2.556-5.297 5.295 0 1.644.184 3.106 2.375 4.566 12.418 8.218 25.566 14.426 38.166 19.174 6.94 2.74 14.063 5.296 21.367 7.305 4.2 1.278 8.948 2.558 13.33 3.47 5.662 1.279 11.689 2.375 17.35 3.288 6.392.913 13.15 1.643 19.541 2.191 36.8 0 80.597-5.566 122.537-30.498 1.721-1.243 4.493-2.286 6.744-3.758l11.428 18.801 15.725-45.576z"/><path d="m639.838 180.403-40.768-12.976V48.363c0-3.47-2.557-5.843-5.844-5.843-2.556 0-84.917 28.306-91.492 30.68-22.334 7.444-86.798 29.733-86.798 29.733-1.034.297-2.638.787-4.741 1.449L252.855 48.85a1.826 1.826 0 0 0-2.435 1.722v106.724c-24.405 8.17-41.808 14.02-42.701 14.335-1.644.548-4.2.913-5.662 2.922-.73.73-.913 2.009-1.278 2.922v306.982c0 .365.183.547.183.73 1.095 2.374 3.104 3.835 5.296 3.835 2.739 0 208.367-69.03 212.933-70.856.215-.072.458-.24.697-.438L638.73 487.48a1.826 1.826 0 0 0 2.38-1.74V182.143c0-.795-.514-1.5-1.272-1.74M410.973 409.4l-199.054 66.29V182.04l199.054-66.29ZM587.93 55.668v108.213l-164.492-52.354Zm-20.243 329.6-10.52-38.43-60.517-18.341-13.013 31.304-29.292-8.886 62.178-152.587 28.508 8.636 51.939 187.188zm-183.723-51.715c-1.658-.602-35.965-14.814-40.828-17.142-3.98-1.914-13.737-6.04-18.328-7.913 12.931-19.938 21.094-34.984 22.18-37.276 2.012-4.193 15.699-30.976 16.018-32.625.31-1.67.7-7.843.399-9.31-.302-1.495-5.32 1.38-12.134 3.69-6.824 2.3-19.794 10.735-24.803 11.793-5.027 1.048-21.094 7.135-29.316 9.863s-23.773 7.475-30.17 9.202c-6.406 1.728-11.998 1.865-15.581 2.951 0 0 .477 5.019 1.428 6.523.94 1.505 4.33 5.194 8.27 6.224 3.942 1.037 10.465.62 13.436-.058 2.97-.69 8.114-3.204 8.804-4.301.698-1.116-.36-4.553.814-5.592 1.186-1.028 16.843-4.688 22.755-6.474 5.911-1.817 28.54-9.61 31.607-9.213-.971 3.223-19.173 39.276-25.035 50.032-5.864 10.755-39.926 58.07-47.177 66.408-5.505 6.338-18.843 22.558-23.463 26.218 1.165.322 9.425-.387 10.93-1.318 9.377-5.777 24.996-25.22 30.026-31.142 14.949-17.532 28.083-35.947 38.497-51.75h.011c2.03.845 18.434 14.21 22.714 17.173 4.281 2.96 21.173 12.385 24.833 13.948 3.66 1.583 17.725 8.068 18.317 5.873.591-2.213-2.544-15.154-4.204-15.784m-106.167-120.33c-1.118-1.098 1.455 8.968 5.036 12.59 6.35 6.405 11.31 7.23 13.95 7.337 5.844.233 13.056-1.456 17.338-3.25 4.144-1.769 11.405-5.476 14.153-10.883.583-1.156 2.173-3.097 1.174-7.893-.757-3.689-3.106-4.98-5.97-4.775-2.863.193-11.532 2.505-15.725 3.794-4.194 1.273-12.834 3.903-16.6 4.72-3.756.814-12.038-.379-13.356-1.64" transform="translate(-200.78 -42.52)"/><path d="m529.556 247.883-21.718 52.496 39.929 12.104z" transform="translate(-200.78 -42.52)"/></svg>`;

// The persistent, combined language picker - same control, same options, on
// every /info page and (via the shared `lang` localStorage key - see i18n.ts's
// initI18n) on the app itself. Renders as a FAB button that opens a menu, matching
// the app's UX. The menu lists all languages with flags and native names, defaulting
// to most-spoken-first order (total speakers, largest first) with an A–Z toggle at the top - the
// choice is shared with the app's lang menu via the same-origin 'langSort'
// localStorage key. Clicking a language navigates to that locale's version
// of the current page and saves the choice to localStorage.
function langPickerHtml(lang: Lang, slug: string): string {
  const flags = (code: Lang): string => {
    const flagCodes = LANG_META[code].flags ?? [];
    if (!flagCodes.length) return '';
    const flagEmoji = (cc: string): string => {
      const s = String(cc ?? '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(s)) return '';
      if (s === 'AU') return '🐨';
      const RI = 0x1f1e6;
      const A = 'A'.charCodeAt(0);
      return String.fromCodePoint(RI + s.charCodeAt(0) - A, RI + s.charCodeAt(1) - A);
    };
    return `<span class="lang-menu-flags" aria-hidden="true">${flagCodes.map(flagEmoji).join('')}</span>`;
  };
  // data-idx = position in the server-rendered speakers order - the client's
  // speakers re-sort tie-breaks on it so an az→speakers round trip restores THIS
  // exact order (equal-speakers pairs would otherwise settle in az-relative order).
  const options = sortedLangs('speakers').map((l, i) =>
    `<button type="button" class="lang-menu-item" data-lang="${l}" data-href="${esc(localeHref(l, slug))}" data-name="${esc(LANG_META[l].nativeName)}" data-speakers="${LANG_META[l].speakers}" data-idx="${i}" aria-pressed="${l === lang}">${flags(l)}<span class="lang-menu-name">${esc(LANG_META[l].nativeName)}</span></button>`,
  ).join('');
  const sortTabs = `<div class="lang-sort-tabs" role="tablist" aria-label="${esc(t('Sort languages'))}"><button type="button" class="lang-sort-tab" role="tab" data-sort="speakers" aria-selected="true">№ ${esc(t('Speakers'))}</button><button type="button" class="lang-sort-tab" role="tab" data-sort="az" aria-selected="false">A–Z</button></div>`;
  return `<div class="lang-fab-wrap"><button type="button" class="lang-fab" aria-label="${esc(t('Language'))}" aria-haspopup="menu" aria-expanded="false" title="${esc(t('Language'))}">${LANG_ICON_SVG}</button><div class="lang-menu" role="group" aria-label="${esc(t('Language'))}" hidden>${sortTabs}<div class="lang-menu-list" role="menu" aria-label="${esc(t('Language'))}">${options}</div></div></div>`;
}
const LANG_PICKER_SCRIPT = `<script>
(function(){
  const trigger = document.querySelector('.lang-fab');
  const menu = document.querySelector('.lang-menu');
  if (!trigger || !menu) return;
  const list = menu.querySelector('.lang-menu-list');
  const sortTabs = [...menu.querySelectorAll('.lang-sort-tab')];
  // Reorder the menu in place: speakers (descending data-speakers) or A–Z
  // (data-name). The choice persists via the 'langSort' localStorage key,
  // shared same-origin with the app's language menu.
  function applySort(mode, persist) {
    sortTabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.sort === mode)));
    const items = [...list.querySelectorAll('.lang-menu-item')];
    items.sort((a, b) => mode === 'az'
      ? a.dataset.name.localeCompare(b.dataset.name, 'en')
      : (Number(b.dataset.speakers) - Number(a.dataset.speakers)) || (Number(a.dataset.idx) - Number(b.dataset.idx)));
    items.forEach(item => list.appendChild(item));
    if (persist) { try { localStorage.setItem('langSort', mode); } catch (err) {} }
  }
  try { if (localStorage.getItem('langSort') === 'az') applySort('az', false); } catch (err) {}
  let isOpen = false;
  function positionMenu() {
    const rect = trigger.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
  }
  function close() {
    if (!isOpen) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    isOpen = false;
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', positionMenu);
  }
  function open() {
    if (isOpen) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    isOpen = true;
    positionMenu();
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', positionMenu);
  }
  function onOutside(e) {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = [...menu.querySelectorAll('.lang-menu-item')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(i + step + items.length) % items.length].focus();
  }
  trigger.addEventListener('click', () => isOpen ? close() : open());
  menu.addEventListener('click', e => {
    const tab = e.target.closest('.lang-sort-tab');
    if (tab) {
      if (tab.getAttribute('aria-selected') === 'true') return;
      applySort(tab.dataset.sort === 'az' ? 'az' : 'speakers', true);
      // Re-appending items blurs a focused one to <body> in browsers that don't
      // focus buttons on click - keep focus inside the open menu.
      if (!menu.contains(document.activeElement)) tab.focus();
      return;
    }
    const btn = e.target.closest('.lang-menu-item');
    if (!btn) return;
    try { localStorage.setItem('lang', btn.dataset.lang); } catch(err) {}
    location.href = btn.dataset.href;
  });
})();
</script>`;

function buildNav(lang: Lang, slug: string, activeHref: string, isLanding: boolean | undefined, activePathway?: Pathway) {
  const link = (n: NavLink) => {
    const isActive = n.href === activeHref || NAV_PATHWAY[n.href] === activePathway;
    return `<a href="${localeHref(lang, hrefToSlug(n.href))}"${isActive ? ' class="active"' : ''}>${esc(t(n.label))}</a>`;
  };
  // Desktop: one <span class="nav-group"> per cluster, dividers come from CSS.
  const groups = NAV.map(group => `<span class="nav-group">${group.map(link).join('')}</span>`).join('');
  // Mobile menu: a single flat vertical list (clusters collapse to plain rows).
  const mobileLinks = NAV.flat().map(link).join('');
  const navClass = isLanding ? '' : ' class="nav-solid"';
  const launch = esc(t('Launch App ↗'));
  const launchHref = esc(localizeHref(lang, '/'));
  // Draft marker: English only, and deliberately not run through t() - it must
  // not enter the translation corpora, because it is meant to come straight back
  // out again once the docs are no longer a draft.
  const draft = lang === 'en' ? '<span class="nav-draft">BETA</span>' : '';
  // The landing page has no rail, so it gets no page-nav block - an empty heading
  // and a separator with nothing under it would be worse than the omission.
  const pageNav = isLanding ? '' : mobilePageNavHtml(lang, activePathway ?? 'builders', activeHref);
  // Search joins the right-hand cluster of whole-site controls, ahead of the
  // language picker. Docs pages only - there is no index behind the landing page,
  // and a box that returns nothing is worse than no box.
  return `<nav${navClass}><a href="${localeHref(lang, 'index')}" class="brand">Lolly</a>${draft}${groups}<div class="gap"></div>${isLanding ? '' : searchBox(lang)}${langPickerHtml(lang, slug)}${THEME_TOGGLE}${GITHUB_LINK}${HAM_BTN}<a href="${launchHref}" class="nav-launch">${launch}</a></nav>
<div class="nav-mobile-menu" id="navMobileMenu">${mobileLinks}${pageNav}<a href="${launchHref}" class="nav-launch">${launch}</a></div> `;
}

/**
 * The pathway hub each footer column's HEADING points at. Every pathway has one - 
 * the `isHub` page of the same name - so the heading is always a real destination
 * and never decoration a reader tries to click.
 */
const PATHWAY_HUB: Record<Pathway, string> = {
  quickstart: 'quickstart', creators: 'creators', builders: 'builders',
  operators: 'operators', trust: 'trust',
};

/**
 * The footer sitemap: the WHOLE docs set, one column per section.
 *
 * This is a full site map, not a selection. Every page the build emits is either a
 * column HEADING (the five pathway hubs) or a link inside a column - asserted below,
 * so the footer cannot silently stop listing a page. There is no "everything else"
 * row: a catch-all is the shape a sitemap takes when it has given up being one, and
 * it hides exactly the pages nothing else links to.
 *
 * What makes that affordable is the heading. Each column's heading IS the link to
 * its pathway's main page, so the overview never costs a row of its own, and a
 * pathway too long for one readable column is split into two or three columns that
 * all point their heading at the same hub. That is where the balance comes from -
 * Builders' seventeen children are three columns of five or six rather than one
 * unreadable stack, and the same split gives Creators' ten (the "Using Lolly" set,
 * which grew by three pages when collab/search/favourites landed) a making column,
 * a finding column and a sharing column.
 *
 * The creators split IS its rail: the three columns below are exactly the rail's
 * "Make things", "Find your way" and "Share & collaborate" groups - same members,
 * same order - with only its "Creators" (hub + quickstart, both already elsewhere
 * in the footer) and "Compare" groups placed differently, as noted below. The two
 * columns that borrow a rail label ("Find your way", "Share & collaborate") hold
 * exactly the pages that label holds in the sidebar.
 *
 * Reusing a rail label over a DIFFERENT
 * set is worse than not reusing it - a reader who learned upstairs that "Find your
 * way" means search / favourites / profile then meets a fourth page under it down
 * here and has to work out which grouping is the real one.
 *
 * Builders and Trust cannot be held to that, and the reason is structural rather
 * than sloppy: a sidebar deliberately REPEATS a page across pathways (Security sits
 * in three rails; Data Transfer in two), while the footer lists every page exactly
 * once. So their columns are the rail clusters with the borrowed pages settled onto
 * one owner - cli-signing to Operators, data-transfer and about to Builders, privacy
 * and inclusive-design to Trust's second column.
 *
 * Two placements are worth stating out loud because they are footer-only groupings
 * and do NOT move the pages themselves - each page keeps its own `pathway`, its own
 * sidebar rail and its own URL:
 *   - Home sits under Quickstart. The Quickstart pathway has exactly one page, which
 *     is the heading, and a heading over an empty column reads as a bug.
 *   - "How Lolly compares" sits there too, next to Home: it is the page a reader
 *     wants BEFORE they pick a pathway, and it is the one Creators page that is not
 *     about operating the app.
 *
 * Order is the order shown. Labels reuse the SIDEBARS group labels wherever one
 * fits, so the footer and the rail name the same cluster the same way (and so the
 * string is already in every locale's site.json).
 */
interface SitemapSection { hub: Pathway; label: string; slugs: string[] }
const FOOTER_SECTIONS: SitemapSection[] = [
  { hub: 'quickstart', label: 'Quickstart', slugs: ['index', 'make-something', 'install', 'faq', 'positioning', 'compare',
    'compare-canva', 'compare-adobe', 'compare-figma', 'compare-render-apis', 'compare-converters',
    'compare-penpot', 'compare-brand-portals'] },
  // Keeps the pathway's own name rather than the rail's "Make things", because the
  // FIRST column of a split pathway is where a reader looks for the pathway. The three
  // "For …" pathway heads sit NEXT TO EACH OTHER (Andy, 2026-08-17): they are the same
  // kind of thing - who-you-are doors - so they read as one group, with each pathway's
  // sub-columns following after the trio. Membership is unchanged, order only.
  { hub: 'creators', label: 'For Creators', slugs: [
    'using', 'brand-studio', 'design-import', 'sequence-editor', 'animating', 'utilities', 'extension'] },
  { hub: 'builders', label: 'For Builders', slugs: [
    'overview', 'design-tokens', 'authoring-tools', 'authoring-assets', 'host-api', 'url-mode'] },
  { hub: 'operators', label: 'For Operators', slugs: [
    'sales', 'press', 'marketing', 'legal',
    'adoption-governance', 'sovereign-production', 'deployment', 'configuration', 'build-guide', 'cli-signing'] },
  { hub: 'creators', label: 'Find your way', slugs: [
    'search', 'ask', 'dashboard', 'favourites', 'profile'] },
  { hub: 'creators', label: 'Share & collaborate', slugs: [
    'collaborate', 'formats', 'exporting'] },
  { hub: 'builders', label: 'Concepts', slugs: [
    'constraints', 'determinism', 'reproducibility'] },
  { hub: 'builders', label: 'Run & integrate', slugs: [
    'cli', 'tui', 'mcp', 'ai-agents', 'data-transfer'] },
  { hub: 'builders', label: 'Ship & operate', slugs: [
    'contributing-setup', 'ios-build', 'about'] },
  { hub: 'trust', label: 'Trust', slugs: [
    'status-quo', 'input-not-impersonation', 'content-credentials-identity',
    'content-credentials-engineering', 'ai-stance', 'ai-features', 'eu-ai-act', 'beatrice-warde',
    'shoulders-of-giants'] },
  { hub: 'trust', label: 'Check it yourself', slugs: [
    'verify-yourself', 'security', 'threat-model', 'parser-inventory', 'server-surface'] },
  { hub: 'trust', label: 'Your data', slugs: ['privacy', 'inclusive-design'] },
];

// The guard that makes "full site map" a property of the build rather than a claim in
// a comment: every page is listed exactly once, every listed slug is a real page, and
// every pathway hub heads at least one column. Adding a page to `pages` without giving
// it a home here fails the build - which is the point, since the failure mode being
// prevented is a page nobody can find.
{
  const listed = new Map<string, number>();
  for (const sec of FOOTER_SECTIONS) {
    for (const s of sec.slugs) {
      if (!pages.some(p => p.slug === s)) throw new Error(`FOOTER_SECTIONS "${sec.label}" names "${s}", which is not a page`);
      listed.set(s, (listed.get(s) ?? 0) + 1);
    }
  }
  const dupes = [...listed].filter(([, n]) => n > 1).map(([s]) => s);
  if (dupes.length) throw new Error(`FOOTER_SECTIONS lists these twice: ${dupes.join(', ')}`);
  // Hubs are headings, never rows - that is the space the full enumeration spends.
  const hubs = new Set(Object.values(PATHWAY_HUB));
  for (const s of hubs) {
    if (listed.has(s)) throw new Error(`FOOTER_SECTIONS lists "${s}" as a row, but it is a pathway hub and already heads a column`);
  }
  const missing = pages.filter(p => !hubs.has(p.slug) && !listed.has(p.slug)).map(p => p.slug);
  if (missing.length) throw new Error(`FOOTER_SECTIONS omits ${missing.length} page(s): ${missing.join(', ')}. The footer is a full site map - give each one a column.`);
  const headed = new Set(FOOTER_SECTIONS.map(s => s.hub));
  for (const pw of Object.keys(SIDEBARS) as Pathway[]) {
    if (!headed.has(pw)) throw new Error(`No footer column heads the "${pw}" pathway`);
  }
}

/**
 * The link text for one sitemap row.
 *
 * Prefers the label its own rail already gives it, so the footer and the sidebar
 * never call the same page two different things; falls back to the page title.
 * `index` is the exception - its title is the wordmark ("Lolly"), which is not a
 * useful thing to read in a list of destinations.
 */
function sitemapLabel(slug: string, hub: Pathway): string {
  if (slug === 'index') return 'Home';
  for (const g of SIDEBARS[hub].groups) for (const it of g.items) if (it.slug === slug) return it.label;
  for (const pw of Object.keys(SIDEBARS) as Pathway[]) {
    for (const g of SIDEBARS[pw].groups) for (const it of g.items) if (it.slug === slug) return it.label;
  }
  return pages.find(p => p.slug === slug)?.title ?? slug;
}

function footerSitemap(lang: Lang): string {
  // Each link opens with the SAME glyph the docs sidebar gives that page - 
  // SIDEBAR_ICON is the one page→icon mapping, shared, so the footer and the rail
  // can never disagree about what a destination looks like (headings included:
  // they link to the pathway hubs, which are sidebar pages too). Decorative here - 
  // the label is the link - so aria-hidden, sized by the stylesheet's .sitemap-ic
  // rule to the footer's own text scale. A missing entry throws at build (the
  // guard beside SIDEBAR_ICON), never renders blank.
  const ic = (slug: string) => `<span class="sitemap-ic" aria-hidden="true">${docIcon(SIDEBAR_ICON[slug]!)}</span>`;
  const cols = FOOTER_SECTIONS.map(sec => {
    const links = sec.slugs
      .map(s => `<a href="${localeHref(lang, s)}">${ic(s)}<span>${esc(t(sitemapLabel(s, sec.hub)))}</span></a>`)
      .join('');
    return `<div class="sitemap-col">`
      + `<a class="sitemap-title" href="${localeHref(lang, PATHWAY_HUB[sec.hub])}">${ic(PATHWAY_HUB[sec.hub])}<span>${esc(t(sec.label))}</span></a>`
      + `${links}</div>`;
  }).join('');
  // A <div role="navigation">, NOT a <nav>: the stylesheet styles the bare `nav`
  // element as the fixed top bar (position:fixed; top:0; height:3.75rem; flex),
  // so a second <nav> anywhere on the page is pinned over the real one with its
  // column titles laid out as a nav row. Same landmark semantics, no inheritance.
  return `<div role="navigation" class="footer-sitemap" aria-label="${esc(t('Sitemap'))}">${cols}</div>`;
}

const FOOTER = (lang: Lang) => `<footer>${footerSitemap(lang)}<p>Lolly - <a href="${REPO_URL}">${esc(t('Open Source'))}</a> · <a href="${localeHref(lang, 'privacy')}">${esc(t('Privacy Policy'))}</a> · <a href="${localeHref(lang, 'inclusive-design')}">${esc(t('Inclusive Design'))}</a></p><p>${esc(t('Questions? Contact Andy Fitzsimon -'))} <a href="mailto:fitzy@suse.com">fitzy@suse.com</a></p>${FOUNDED_BY}</footer>`;

// Docs sidebar for a page, driven by its pathway. Falls back to the builders
// sidebar for any non-landing page without an explicit pathway.

// Sidebar glyphs, keyed by slug so a page wears the SAME icon in every sidebar
// that lists it (several pages appear in two pathways). This is an accessibility
// feature before it is a decorative one: a wall of same-length link text is hard
// to scan, and a stable picture per destination gives a second, non-verbal way to
// find a page - the recognition is instant where reading the label is not. That
// makes it part of the inclusive-design commitment in docs/inclusive-design.md,
// not styling; keep the mapping meaningful (what the page is ABOUT) rather than
// picking whatever glyph is unused. The footer sitemap renders this SAME mapping
// (footerSitemap above), so a destination wears one landmark everywhere it is
// listed - which is why `index` lives here despite no sidebar listing it: it is
// the footer's Home row.
const SIDEBAR_ICON: Record<string, string> = {
  // Hubs & entry points (`index` is footer-only - the landing page has no rail)
  index: 'home',
  quickstart: 'star', creators: 'palette', builders: 'wrench', operators: 'checklist', trust: 'shieldcheck',
  'status-quo': 'convert', 'input-not-impersonation': 'usercheck',
  // Creators
  using: 'pentool', 'brand-studio': 'palette', profile: 'usercheck', 'design-import': 'upload',
  'sequence-editor': 'clock', animating: 'layers', exporting: 'download', formats: 'convert', positioning: 'sliders', compare: 'checklist',
  'compare-canva': 'checklist', 'compare-adobe': 'checklist', 'compare-figma': 'checklist', 'compare-render-apis': 'checklist', 'compare-converters': 'checklist',
  'compare-penpot': 'checklist', 'compare-brand-portals': 'checklist',
  'make-something': 'pentool', install: 'download', faq: 'document',
  // Operator playbooks (plans/177)
  sales: 'people', press: 'document', marketing: 'photos', legal: 'lock',
  // Concepts: the locked rule set, the same-every-time check, the link as the artifact.
  constraints: 'lock', determinism: 'check', reproducibility: 'link',
  'sovereign-production': 'server',
  ask: 'sparkle', dashboard: 'monitor', utilities: 'wrench',
  collaborate: 'people', search: 'search', favourites: 'star',
  // Builders - architecture & authoring
  overview: 'layers', 'design-tokens': 'hash', 'authoring-tools': 'wrench', 'authoring-assets': 'photos',
  'host-api': 'code', 'url-mode': 'link',
  // Builders - run & integrate
  cli: 'code', 'cli-signing': 'seal', tui: 'monitor', mcp: 'server', 'ai-agents': 'sparkle', extension: 'globe',
  // Builders - ship & operate
  'contributing-setup': 'download', 'build-guide': 'box', 'ios-build': 'box', deployment: 'upload', configuration: 'sliders', about: 'document',
  // Operators
  'adoption-governance': 'people',
  // Trust - where content comes from
  'content-credentials-identity': 'seal', 'content-credentials-engineering': 'cpu', 'ai-stance': 'sparkle',
  'ai-features': 'sparkle', 'eu-ai-act': 'document',
  'beatrice-warde': 'font',
  'shoulders-of-giants': 'people',
  // Trust - check it yourself
  'verify-yourself': 'check', security: 'shieldcheck', 'threat-model': 'lock',
  'parser-inventory': 'code', 'server-surface': 'server',
  // Trust - your data
  privacy: 'eyeoff', 'data-transfer': 'convert', 'inclusive-design': 'people',
};

// The footer sitemap reuses the mapping above, so its completeness is enforced the
// same way FOOTER_SECTIONS' own enumeration is - at build, loudly. Without this,
// a footer slug with no entry degrades to docIcon()'s console.warn and an empty
// string: a blank where a landmark should be, invisible in a log nobody reads.
// (Lives here rather than in the FOOTER_SECTIONS guard because SIDEBAR_ICON is
// declared after that block runs.)
{
  const bare = [...new Set([...Object.values(PATHWAY_HUB), ...FOOTER_SECTIONS.flatMap(s => s.slugs)])]
    .filter(s => !SIDEBAR_ICON[s]);
  if (bare.length) throw new Error(`SIDEBAR_ICON is missing footer sitemap entries for ${bare.join(', ')} - every footer link carries the page's sidebar glyph`);
}

/**
 * One rail link. Shared by the desktop sidebar and the hamburger panel's page-nav
 * section, so the narrow-screen list cannot drift from the wide-screen one - they
 * are the same links rendered twice, not two lists that happen to agree today.
 * `icon` is off in the hamburger panel: rows there sit on a dark sheet where the
 * glyph tint is a different design problem, and the panel is already long.
 */
function sidebarLinkHtml(lang: Lang, it: SideItem, activeHref: string, icon: boolean) {
  const href = `/info/${it.slug}.html`; // logical (English) href - identity only
  // The AI pages are the ONE purple in an otherwise green sidebar. AI is the
  // subject the docs treat as categorically different, so it is the one thing
  // worth spending a second hue on; more colours would flatten that signal.
  // Two pages keep their own hue in every state, so "which page is this?" is
  // answerable from the corner of your eye without reading a word: AI (the
  // subject the docs treat as categorically different) and Inclusive Design
  // (the page whose whole subject is making things findable for everyone).
  // Only two - a third colour would flatten the signal back into
  // decoration. See docs/inclusive-design.md.
  const hue = it.slug === 'ai-stance' || it.slug === 'ai-agents' ? ' is-ai'
    : it.slug === 'inclusive-design' ? ' is-inclusive' : '';
  const glyph = icon ? SIDEBAR_ICON[it.slug] : undefined;
  const ic = glyph ? `<span class="sidebar-ic${hue}" aria-hidden="true">${docIcon(glyph)}</span>` : '';
  return `<a href="${localeHref(lang, it.slug)}"${href === activeHref ? ' class="active"' : ''}>${ic}<span>${esc(t(it.label))}</span></a>`;
}

function buildSidebar(lang: Lang, page: Page, activeHref: string) {
  const pathway: Pathway = page.pathway ?? 'builders';
  const sb = SIDEBARS[pathway];
  const groups = sb.groups.map(g => {
    const links = g.items.map(it => sidebarLinkHtml(lang, it, activeHref, true)).join('\n    ');
    return `<div class="sidebar-label">${esc(t(g.label))}</div>\n    ${links}`;
  }).join('\n    ');
  return `<aside class="docs-sidebar">
    <a href="${localeHref(lang, 'index')}" class="sidebar-home">${esc(t('← Home'))}</a>
    <div class="sidebar-pathway">${esc(t(sb.title))}</div>
    ${groups}
  </aside>`;
}

/**
 * The pathway rail again, this time inside the hamburger panel, for screens where
 * the rail itself is hidden (<=768px). Stacked above the article the rail cost a
 * reader a whole screenful of nav before the first word of a short page, so below
 * that width the page nav lives where the site nav already lives.
 *
 * The group headings come across with it: a flat list of thirty links loses the
 * one thing the rail was giving a reader, which is shape.
 */
function mobilePageNavHtml(lang: Lang, pathway: Pathway, activeHref: string) {
  const sb = SIDEBARS[pathway];
  const groups = sb.groups.map(g =>
    `<div class="nav-mobile-label">${esc(t(g.label))}</div>${
      g.items.map(it => sidebarLinkHtml(lang, it, activeHref, false)).join('')}`,
  ).join('');
  // Drop the pathway title when the first group repeats it - the Trust pathway
  // opens with a group also called "Trust", which rendered as "Trust" then
  // "TRUST" and read as a stutter. The active link in the site nav directly above
  // already names the pathway, so losing the heading costs nothing.
  const first = sb.groups[0]?.label;
  const title = first && t(first) === t(sb.title)
    ? ''
    : `<div class="nav-mobile-title">${esc(t(sb.title))}</div>`;
  return `<div class="nav-mobile-page">${title}${groups}</div>`;
}

/**
 * The docs search field, for the topbar (docs pages only - the landing page has no
 * search index behind it).
 *
 * A combobox rather than a bare input so the arrow-key walk through results is
 * announced; `data-search-base` carries the locale prefix so the inline script stays
 * locale-agnostic.
 *
 * Deliberately NO global "press / to search" shortcut, though every docs site has
 * one: `/` is Firefox's own quick-find, and not fighting the browser's defaults
 * outranks saving a click. Tab and click both reach the field.
 */
function searchBox(lang: Lang): string {
  return `<div class="docs-search" data-search-base="${lang === 'en' ? '/info' : `/info/${lang}`}">
      <input type="search" id="docs-search" class="docs-search-input" autocomplete="off" spellcheck="false"
             role="combobox" aria-expanded="false" aria-controls="docs-search-results" aria-autocomplete="list"
             placeholder="${esc(t('Search the docs…'))}" aria-label="${esc(t('Search the docs'))}">
      <div id="docs-search-results" class="docs-search-results" role="listbox" hidden
           data-empty="${esc(t('No matches'))}"></div>
    </div>`;
}

// ── Docs narration - "Listen to this page" (plans/40-docs-audio-listen.md) ───────
// Narration artefacts are rendered manually (never in CI) by
// scripts/build-docs-audio.ts and committed under docs/audio/<lang>/<slug>/;
// the build only LINKS what exists. A page without committed audio gets no
// button - no dead controls - and with no audio anywhere the player bundle is
// neither built nor referenced, so /info carries zero extra bytes.
interface AudioEntry { slug: string; title: string; url: string; duration: number; bytes: number }

// slug → playlist entry for the CURRENT build() pass. Module-level like
// activeCatalog (wrapPage has no channel for per-build state), reset at the top
// of every build() so a --watch reimport can never serve a previous pass's set.
let audioBySlug = new Map<string, AudioEntry>();

/** The committed English narration set, in pages[] (sidebar) order - that order
 *  IS the playlist auto-advance walks. */
function collectDocsAudio(): Map<string, AudioEntry> {
  const map = new Map<string, AudioEntry>();
  const base = resolve(repoRoot, 'docs', 'audio', 'en');
  if (!existsSync(base)) return map;
  for (const page of pages) {
    const dir = resolve(base, page.slug);
    if (!existsSync(resolve(dir, 'audio.opus')) || !existsSync(resolve(dir, 'meta.json'))) continue;
    try {
      const meta = JSON.parse(readFileSync(resolve(dir, 'meta.json'), 'utf-8')) as { duration?: number; bytes?: number };
      map.set(page.slug, {
        slug: page.slug,
        title: page.title,
        url: `/info/audio/en/${page.slug}/audio.opus`,
        duration: Number(meta.duration) || 0,
        bytes: Number(meta.bytes) || statSync(resolve(dir, 'audio.opus')).size,
      });
    } catch {
      console.warn(`⚠  docs audio: ${page.slug}/meta.json unreadable - page not linked`);
    }
  }
  return map;
}

/** Bundle the docs player (docs/player/player.ts) to /info/docs-player.js.
 *  Static docs pages cannot import shells/web/src modules at runtime, so the
 *  player is its own tiny esm bundle; the butterchurn dynamic import splits
 *  into a docs-player-<hash>.js chunk fetched only when the viz panel opens. */
function bundleDocsPlayer(): void {
  buildSync({
    entryPoints: [resolve(__dirname, 'player', 'player.ts')],
    bundle: true,
    format: 'esm',
    splitting: true,
    minify: true,
    platform: 'browser',
    outdir: outDir,
    entryNames: 'docs-player',
    chunkNames: 'docs-player-[hash]',
    // The player bundles scripts/lib/docs-spoken-text.ts for extractSpokenText;
    // that module's node:crypto import (spokenTextHash, unused here) is aliased
    // to a throwing stub so the browser bundle resolves.
    alias: { 'node:crypto': resolve(__dirname, 'player', 'crypto-stub.ts') },
    logLevel: 'silent',
  });
  buildSync({
    entryPoints: [resolve(__dirname, 'player', 'player.css')],
    bundle: true,
    minify: true,
    outfile: resolve(outDir, 'docs-player.css'),
    logLevel: 'silent',
  });
}

const LISTEN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

// Styles for the button only - everything past the first press lives in
// /info/docs-player.css, fetched with the bundle. Shipped inline beside the
// button (not in CSS above) so pages without audio carry none of it.
const LISTEN_STYLE = `<style>
.listen-bar{display:flex;justify-content:flex-end;margin:0 0 -8px}
.listen-bar-float{position:fixed;right:16px;bottom:16px;z-index:89;margin:0}
/* Phones only: docked under the top nav while the landing hero owns the screen, so the
   pill never sits on a hero CTA (plans/168 WP-6; the class comes from NAV_SOLID_JS). */
@media(max-width:600px){.listen-bar-float.over-hero{bottom:auto;top:calc(3.75rem + 8px)}}
.docs-listen{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;border:1px solid hsl(var(--muted-foreground) / .25);background:hsl(var(--popover) / .9);color:hsl(var(--popover-foreground));font:600 13px/1 inherit;font-family:inherit;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.docs-listen:hover{border-color:hsl(var(--primary) / .5)}
.docs-listen svg{width:15px;height:15px}
.docs-listen .listen-mins{font-weight:400;opacity:.65}
.docs-listen.is-loading{opacity:.6;pointer-events:none}
</style>`;

// The lazy loader - the ONLY player code a page carries. The bundle is fetched
// on the first press (plan section 6.1), or on arrival when the previous page's
// auto-advance/prev/next left a hand-off in sessionStorage.
const LISTEN_SCRIPT = `<script>(function(){
var btn=document.querySelector('.docs-listen');if(!btn)return;
// The ladder (plan 131 B.3): a produced page needs Ogg/Opus playback; every page can
// fall back to the device voice (speechSynthesis). Remove the control only when there
// is genuinely nothing to play - a produced page this browser can't decode (iOS Safari
// before 18.4) AND no device voice, or a device-voice page with no speechSynthesis
// (some webkitgtk - the Linux gap a native command will close).
var produced=btn.hasAttribute('data-listen-produced');
var hasTts=('speechSynthesis' in window)&&(typeof SpeechSynthesisUtterance!=='undefined');
var canOpus=false;try{canOpus=!!document.createElement('audio').canPlayType('audio/ogg; codecs=opus');}catch(e){}
if((!produced||!canOpus)&&!hasTts){var bar=btn.closest('.listen-bar');if(bar)bar.remove();return;}
var busy=false;
function open(auto){if(busy)return;busy=true;btn.classList.add('is-loading');
import('/info/docs-player.js').then(function(m){
  m.openDocsPlayer({slug:btn.getAttribute('data-listen-slug'),title:btn.getAttribute('data-listen-title'),autoplay:!!auto,trigger:btn});
}).catch(function(e){console.warn('docs player failed to load',e);}).finally(function(){busy=false;btn.classList.remove('is-loading');});}
btn.addEventListener('click',function(){open(true);});
try{var s=sessionStorage.getItem('lolly-docs-listen');
if(s&&JSON.parse(s).slug===btn.getAttribute('data-listen-slug'))open(JSON.parse(s).auto);}catch(e){}
})();</script>`;

/**
 * Build-time cue→anchor assertion (plans/40-docs-audio-listen.md section 10): every
 * blockId in a narrated page's committed cues.json must still resolve against
 * the BUILT page, judged the way the player maps blocks (buildBlockMap in
 * docs/player/player.ts) - a blockId that survives in the CURRENT extraction,
 * whose spoken text is present in the built markup (paragraphs and list items
 * are matched by text there, so text presence IS the derivable position), a
 * heading's element id being the stronger signal where the markup carries it.
 * A plain id check would be wrong on the landing page: buildLandingContent
 * mints its own section ids ("Journalists" → #press), so its headings map by
 * being present at all, not by anchor. Synthetic omission lines ("Code example
 * omitted.") have no DOM twin by design and are exempt. One console.warn per
 * miss; the build only throws when more than 20% of a page's blocks miss - 
 * drift tolerance while copy moves, since tests/docs-audio-stale.test.ts
 * already names every stale page.
 */
function assertAudioCues(page: Page, content: string, md: string): void {
  const cuesPath = resolve(repoRoot, 'docs', 'audio', 'en', page.slug, 'cues.json');
  if (!existsSync(cuesPath)) return;
  let blocks: Array<{ blockId: string }>;
  try {
    blocks = (JSON.parse(readFileSync(cuesPath, 'utf-8')) as { blocks?: Array<{ blockId: string }> }).blocks ?? [];
  } catch {
    console.warn(`⚠  docs audio: ${page.slug}/cues.json unreadable - cue assertion skipped`);
    return;
  }
  if (!blocks.length) return;
  const norm = (s: string): string => s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .toLowerCase().replace(/\s+/g, ' ').trim();
  const domIds = new Set([...content.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
  const pageText = norm(content.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
  const spoken = new Map(extractSpokenText(md, { pageTitle: page.title }).map((b) => [b.blockId, b.text]));
  let missed = 0;
  for (const b of blocks) {
    const text = spoken.get(b.blockId);
    const resolves = text !== undefined && (
      /^(Code example|Table) omitted\.$/.test(text)
      || domIds.has(b.blockId)
      || pageText.includes(norm(text).slice(0, 40))
    );
    if (resolves) continue;
    missed++;
    console.warn(`⚠  docs audio: ${page.slug} cue "${b.blockId}" does not resolve in the built page`);
  }
  if (missed > blocks.length * 0.2) {
    throw new Error(
      `docs audio: ${page.slug} - ${missed}/${blocks.length} cues.json blocks fail to anchor; `
      + 'the narration no longer matches the page (re-render: node scripts/build-docs-audio.ts)',
    );
  }
  console.log(`✓  docs audio cues: ${page.slug} - ${blocks.length - missed}/${blocks.length} blocks anchored${missed ? ' (drift within tolerance)' : ''}`);
}

// The Listen pill ships on EVERY page (plan 131 B.3). A page with committed audio
// (`a` present) plays its produced Kokoro voice; every other page - all locales, the
// reference/side-door pages - falls back to the reader's device voice via
// speechSynthesis. `data-listen-produced` lets the loader tell the two apart for its
// codec ladder; the minutes badge only makes sense for a fixed-length produced track.
function listenButtonHtml(page: Page, a?: AudioEntry): string {
  const mins = a && a.duration > 0 ? `${Math.max(1, Math.round(a.duration / 60))} min` : '';
  const producedAttr = a ? ' data-listen-produced' : '';
  return `${LISTEN_STYLE}<div class="listen-bar${page.isLanding ? ' listen-bar-float' : ''}"><button type="button" class="docs-listen"${producedAttr} data-listen-slug="${esc(page.slug)}" data-listen-title="${esc(page.title)}" aria-label="${esc(`Listen to ${page.title}`)}">${LISTEN_ICON}<span>Listen</span>${mins ? `<span class="listen-mins">${esc(mins)}</span>` : ''}</button></div>`;
}

// ── "On this page" jump nav ──────────────────────────────────────────────────
// A long reference page (build-guide runs to nine sections and 60 KB of rendered
// HTML) gives a reader arriving from search no way back out of the middle of it: the
// left rail lists PAGES, and the section they want is a scroll away with nothing
// naming it. So on long pages only, a small fixed control opens the page's own h2
// list - the ids mdToHtml already stamped, as plain anchors.
//
// LONG is measured, not declared per page, so nobody has to remember to turn it on:
// six sections is where a rail stops being scannable in one glance, and 25 KB of
// rendered HTML is roughly the same page from the other direction (a page with few
// but enormous sections still buries its landmarks). Either qualifies.
const JUMP_MIN_H2 = 6;
const JUMP_MIN_BYTES = 25_000;
// A contents mark: three rules, ragged like a list of headings. Not `checklist` from
// DOC_ICONS - its ticks say "done", and nothing here is done.
const JUMP_ICON = `<svg viewBox="0 0 24 24" ${DOC_ICON_S}><path d="M4 7h16M4 12h11M4 17h13"/></svg>`;

function pageJumpNav(content: string): string {
  const items: Array<{ id: string; text: string }> = [];
  for (const m of content.matchAll(/<h2\s+id="([^"]*)"[^>]*>([\s\S]*?)<\/h2>/g)) {
    const id = m[1]!;
    const text = htmlToText(m[2]!);
    if (id && text) items.push({ id, text });
  }
  // The two thresholds are OR'd; `content` is the rendered body this page will ship,
  // so the measurement is of the real thing rather than of its source.
  if (items.length < JUMP_MIN_H2 && content.length < JUMP_MIN_BYTES) return '';
  const label = t('On this page');
  const links = items
    .map(it => `<a href="#${esc(it.id)}">${esc(it.text)}</a>`)
    .join('');
  // "#top" is the HTML spec's own name for the top of the document when nothing
  // carries that id - a browser default, so no script is involved in the scroll.
  const top = `<a class="doc-jump-top" href="#top">${esc(t('Back to top'))}</a>`;
  return `<div class="doc-jump">`
    + `<button type="button" class="doc-jump-btn" id="docJumpBtn" aria-expanded="false" aria-controls="docJumpNav" aria-label="${esc(label)}" title="${esc(label)}">${JUMP_ICON}</button>`
    + `<nav class="doc-jump-nav" id="docJumpNav" aria-label="${esc(label)}" hidden>`
    + `<p class="doc-jump-title">${esc(label)}</p>${links}${top}</nav></div>`;
}

/**
 * Hoist a page's own h1 into a masthead band with the chip field behind it.
 *
 * Every article page opened with a bare h1 on white - correct, and completely
 * silent about what site you had landed on. The landing page's hero already says it
 * (formats drifting past the name), so the docs get the same greeting rather than a
 * second invented one. plans/105 records why this is the DEFAULT rather than a
 * per-page choice, and why it carries no credential line: it is shell decoration
 * drawn at read time, nothing signed and nothing claimed.
 *
 * THE H1 MOVES BUT ITS IDENTITY DOES NOT. The element is re-emitted verbatim, id
 * and all, because that id is a published anchor - deep links, the search index's
 * page record, and anything a reader has bookmarked. Rebuilding the heading from
 * page.title instead would have quietly renamed every one of them.
 */
function docsMasthead(content: string, slug: string): { band: string; rest: string; canvas: boolean } | null {
  const m = /<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/.exec(content);
  if (!m) return null; // a page with no h1 keeps its plain top
  const rest = content.slice(0, m.index) + content.slice(m.index + m[0].length);
  const art = mastheadArt(slug, m[0]);
  if (art) return { band: art, rest, canvas: false };
  const band = `<div class="docs-masthead">`
    + `<canvas class="docs-mast-canvas" aria-hidden="true"></canvas>`
    + `<div class="docs-mast-inner">${m[0]}</div></div>`;
  return { band, rest, canvas: true };
}

/**
 * A page's BANKED masthead, when `MASTHEADS` maps its slug to one - the artifact
 * replacing the default chip canvas, in the same band, behind the same h1.
 *
 * Returns '' for a page with no mapping (the common case, and today every case),
 * and warns + falls back to the default band when a mapped id cannot be resolved
 * or inlined. A missing artifact is a bank problem, not a reason to ship a page
 * with no top.
 */
function mastheadArt(slug: string, heading: string): string {
  const id = MASTHEADS[slug];
  if (!id) return '';
  const art = resolveDocsArt('mastheads', id, { dir: __dirname, lang: activeLang });
  if (!art) {
    console.warn(`⚠  masthead: /${slug} maps to '${id}', which is not in docs/mastheads/ - the page keeps the default band`);
    return '';
  }
  const inlined = inlineDocsArt(art);
  if ('error' in inlined) {
    console.warn(`⚠  masthead ${id}: ${inlined.error} - the page keeps the default band`);
    return '';
  }
  // Read from the SAME file that was just inlined (art.path), pointed at the same
  // file's served URL (art.src). The presentation copy on the page and the record
  // the line describes are two views of one artifact - never the id resolved twice.
  const cred = shotCredential(art.file, 'shot-cred--mast', { path: art.path, src: art.src, art: true });
  // Renders anyway (art with no line is still art), but never silently: an unsigned
  // artifact in a bank whose whole premise is "banked art is credentialed art" is a
  // sign step that did not run, and the page gives the reader no way to notice.
  if (!cred) console.warn(`⚠  masthead ${art.file}: no readable Content Credential - run 'node scripts/sign-docs-art.ts'`);
  return mastheadArtBand({ art: inlined.html, heading, credential: cred });
}

// buildFigure (::: figure <id>) now lives in @lolly-tools/docs-render's render.ts, driven by
// docCtx.art + the package's figureBlock; mdToHtml moved with it.

// ── Shared chrome CSS + JS, shipped once (plan 131 B.1) ───────────────────────────
// CSS and the body scripts are byte-identical on every page and every locale, so they
// ship as two fingerprinted files linked per page instead of ~185 KB inlined into each
// one. A locale tree goes ~43 MB -> ~13 MB raw; across 27 locales + root, /info drops
// from ~361 MB to ~85 MB in the binary, and the web deploy caches one stylesheet
// instead of re-downloading 153 KB per page view.
//
// Every body script is already its own `(function(){...})();` and self-guards
// (`if(!el)return`), so one always-loaded bundle is safe - each no-ops when its DOM
// target is absent. CHIP_FIELD_JS assigns `window.__lollyChipField` and is included
// ONCE here (its two consumers, HERO/MASTHEAD, dropped their inline copies above).
// LIQUID_GLASS_SCRIPT is the one without an early-return; it only touches
// `.btn-primary`, which exists on the landing page alone today, so on every other
// page its querySelectorAll is an empty-set no-op. THEME_INIT_SCRIPT and
// SHOT_MOTION_INIT stay inline in <head> (FOUC-critical, must run before paint);
// LISTEN_STYLE stays in body (injected by listenButtonHtml). CSP allows both 'self'
// and 'unsafe-inline' for script/style, so external same-origin + the head inits both
// load. The seals (sealPages, run tail) re-hash whole-document bytes, so every English
// page re-signs once when this first rebuilds - the intended self-healing churn.
const stripScriptTags = (s: string): string =>
  s.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const DOCS_JS = [
  CHIP_FIELD_JS,
  FORMATS_DIALOG_SCRIPT, THEME_INTERACT_SCRIPT, SHOT_MOTION_SCRIPT, SHOWCASE_SCRIPT,
  SHOT_CRED_SCRIPT, SCROLL_REVEAL_SCRIPT, LIQUID_GLASS_SCRIPT, HERO_CANVAS_SCRIPT,
  DOCS_MASTHEAD_SCRIPT, VERIFY_POPOUT_SCRIPT, DOCS_SEARCH_SCRIPT, HAMBURGER_SCRIPT,
  DOC_JUMP_SCRIPT, LANG_PICKER_SCRIPT, LISTEN_SCRIPT,
].map(stripScriptTags).join('\n;\n');
const fingerprint = (s: string): string =>
  createHash('sha256').update(s).digest('base64url').slice(0, 16);
const DOCS_CSS_FILE = `docs.${fingerprint(CSS)}.css`;
const DOCS_JS_FILE = `docs.${fingerprint(DOCS_JS)}.js`;
const DOCS_CSS_LINK = `<link rel="stylesheet" href="/info/${DOCS_CSS_FILE}">`;
const DOCS_JS_TAG = `<script src="/info/${DOCS_JS_FILE}" defer></script>`;

function wrapPage(lang: Lang, page: Page, content: string, ogSlugs: Set<string>, md = '') {
  const activeHref = page.slug === 'index' ? '/info/index.html' : `/info/${page.slug}.html`; // logical (English) - identity only
  const isLanding  = page.isLanding;
  // A generated page's slug carries a slash (formats/svg); a class name cannot, so
  // the body/main class uses a slash-free form. A normal slug has no slash, so this
  // is a no-op there and the existing page-<slug> classes stay byte-identical.
  const slugClass  = page.slug.replace(/\//g, '-');

  // A page with its own generated card (subtitle = its title) points share tags at
  // it; the landing page and any page that failed generation keep the canonical og.png.
  // OG cards are generated once, in English, and shared across locales (see build()).
  const ogImage    = (!isLanding && ogSlugs?.has(page.slug)) ? `${SITE_URL}/info/og/${page.slug}.png` : OG_IMAGE;
  const ogImageAlt = isLanding ? 'Lolly - creative tools with the rules built in' : `Lolly - ${page.title}`;
  // What a shared link says about itself. Every page had the same site-wide
  // sentence, so forty links previewed identically and told a reader nothing
  // about where they were going. Order: an explicit description, else the page's
  // own first sentence, else the site line for the landing page.
  const description = t(page.description || (isLanding ? SITE_DESCRIPTION : mdDescription(md) || SITE_DESCRIPTION));

  // The Listen pill ships on EVERY page (plan 131 B.3). English pages with committed
  // audio play the produced Kokoro voice; every other page - all locales, the
  // reference/side-door pages - falls back to the reader's device voice (the OS speaks
  // the page's own `<html lang>`). The produced track is English-only, so only English
  // resolves an AudioEntry; a locale page passes undefined and the loader/host take the
  // device-voice branch. Cues (produced-only) are still asserted where audio exists.
  const audio = lang === 'en' ? audioBySlug.get(page.slug) : undefined;
  const listen = listenButtonHtml(page, audio);
  if (audio) assertAudioCues(page, content, md);

  // Docs pages only: the landing page already carries its own sticky quicknav, and
  // a second on-page nav in the corner would be two answers to one question. A
  // generated side-door page has no sidebar to mirror, so it skips the jump nav too.
  const jump = (isLanding || page.generated) ? '' : pageJumpNav(content);

  // The masthead band, and the article body with its h1 lifted out of it. The Listen
  // button keeps its place ABOVE the h1 (it was always the first thing in <main>),
  // so it now floats over the band's top edge rather than over bare page. A generated
  // page has no banked masthead, so it gets none.
  const mast = (isLanding || page.generated) ? null : docsMasthead(content, page.slug);
  const article = mast ? mast.rest : content;

  // The band is a SIBLING of .docs-wrap, not something inside the content column:
  // full viewport width, with the rail and the article both starting underneath it.
  // A generated page renders as a single column (no rail) under the same nav.
  // The landing wraps in a <main> the in-app reader can extract (plans/123 step 1).
  // The class is docs-landing, NOT docs-content: the article-typography rules scoped
  // to .docs-content sit at (0,1,1) and would out-specify every band rule at (0,1,0),
  // restyling all of the landing headings.
  const body = isLanding ? `<main class="docs-landing page-${slugClass}">${listen}${content}</main>`
    : page.generated ? `
<div class="docs-wrap">
  ${buildSidebar(lang, page, activeHref)}
  <main class="docs-content no-mast page-${slugClass}">
    ${listen}
    ${article}
  </main>
</div>`
    : `
${mast ? mast.band : ''}
<div class="docs-wrap">
  ${buildSidebar(lang, page, activeHref)}
  <main class="docs-content${mast ? '' : ' no-mast'} page-${slugClass}">
    ${listen}
    ${article}
  </main>
</div>`;

  const pageTitle  = isLanding ? LANDING_TITLE : `${t(page.title)} - Lolly`;
  const localeUrl  = `${SITE_URL}${localeHref(lang, page.slug)}`;
  const alternates = LANGS.map(l =>
    `<link rel="alternate" hreflang="${LANG_META[l].htmlLang}" href="${esc(`${SITE_URL}${localeHref(l, page.slug)}`)}">`,
  ).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${esc(`${SITE_URL}${localeHref('en', page.slug)}`)}">`;
  // The page's OWN Content Credential, C2PA 2.4 section A.7.1.2's external form: one
  // stable link, the store beside it at /info/<slug>.c2pa, signed after this
  // string has been written to disk (docs/page-seal.ts explains the ordering).
  //
  // ENGLISH ONLY this wave. A locale page linking a sidecar that does not exist
  // reads as a failed check, and pointing 26 locales at the English store would
  // read as "this document was modified" - so a locale page's bytes stay exactly
  // what they were before seals existed. Generated side-door pages are not sealed
  // (no .c2pa store is minted for them), so they carry no seal link either.
  const seal = (lang === 'en' && !page.generated) ? `\n${pageSealLink(page.slug)}` : '';

  return `<!doctype html>
<html lang="${LANG_META[lang].htmlLang}" data-theme="light"${LANG_META[lang].dir ? ` dir="${LANG_META[lang].dir}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(localeUrl)}">
${alternates}${seal}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lolly">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(localeUrl)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogImageAlt)}">
<meta property="og:logo" content="${esc(OG_LOGO)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/SUSE[wght].woff2">
${THEME_INIT_SCRIPT}
${SHOT_MOTION_INIT}
${DOCS_CSS_LINK}
</head>
<body class="page-${slugClass}">
${buildNav(lang, page.slug, activeHref, isLanding, page.pathway)}
${body}
${FOOTER(lang)}
${jump}
${DOCS_JS_TAG}
</body>
</html>`;
}

// ── llms.txt + markdown twins ─────────────────────────────────────────────────
// Alongside each English HTML page the build emits a verbatim markdown twin at
// /info/<slug>.md, indexed by /info/llms.txt (https://llmstxt.org) - the
// agent-readable face of the docs. English only by design; locale sidecars stay
// HTML-only.

// The twin transforms (stripFrontMatter, unwrapFigureFences,
// unwrapProvenanceMarkers, stripLogoMarkers, commentStandaloneProvenanceLines,
// mdDescription) now live in @lolly-tools/docs-render - pure string ops the
// in-app docs view needs too. Imported at the top of this file.

// Section order + labels for llms.txt - mirrors the top nav (NAV/NAV_PATHWAY).
const LLMS_SECTIONS: Array<{ pathway: Pathway; label: string }> = [
  { pathway: 'quickstart', label: 'Quickstart' },
  { pathway: 'creators',   label: 'For Creators' },
  { pathway: 'builders',   label: 'For Builders' },
  { pathway: 'operators',  label: 'For Operators' },
  // The privacy and provenance story: Privacy, Threat Model, Verify It Yourself
  // and the rest of the Trust rail. Omitting it meant every AI-mediated read of
  // the docs missed exactly the pages the sceptical reader needs.
  { pathway: 'trust',      label: 'Trust' },
];

// slug → English markdown source, collected on the en pass. Membership doubles as
// "the twin actually exists on disk" for the llms.txt lines (a missing source is
// skipped by the page loop, so it must be skipped here too).
function buildLlmsTxt(mdBySlug: Map<string, string>): string {
  // Every pathway a registered page carries must have an llms.txt section, or
  // that whole rail silently vanishes from the agent-readable index (the Trust
  // rail shipped invisible this way). Same build-time-fail pattern as
  // FOOTER_SECTIONS/SIDEBAR_ICON.
  const covered = new Set(LLMS_SECTIONS.map((s) => s.pathway));
  const missing = [...new Set(pages.map((p) => p.pathway ?? 'builders'))].filter((pw) => !covered.has(pw));
  if (missing.length) {
    throw new Error(`llms.txt is missing a section for pathway(s): ${missing.join(', ')} - add them to LLMS_SECTIONS`);
  }
  const sections = LLMS_SECTIONS.map(({ pathway, label }) => {
    const lines = pages
      .filter((p) => p.pathway === pathway && mdBySlug.has(p.slug))
      .map((p) => `- [${p.title}](${SITE_URL}/info/${pathSlug(p.slug)}.md): ${mdDescription(mdBySlug.get(p.slug)!)}`);
    return `## ${label}\n\n${lines.join('\n')}`;
  });
  return `# Lolly

> ${SITE_DESCRIPTION}

Every page below is also served as plain markdown - a twin of the HTML page at
the same slug under ${SITE_URL}/info/ - so fetch the .md URL directly. English
only. Product landing copy: ${SITE_URL}/info/index.md

The whole corpus in one file: ${SITE_URL}/llms-full.txt. The short guide for
agents (entry points, URL grammar, how to get bytes): ${SITE_URL}/agents.md. The
HTTP surface as OpenAPI 3.1: ${SITE_URL}/openapi.json. Discovery record:
${SITE_URL}/.well-known/lolly.json

Reading this as an agent? Lolly speaks MCP, so you can act, not just read:
connect at https://mcp.lolly.tools/mcp (full render tier) or
${SITE_URL}/api/mcp (browser-free tier: vector and data output). Access
tokens come from the instance operator; endpoints, auth and the tool list:
${SITE_URL}/info/${pathSlug('mcp')}.md and ${SITE_URL}/info/${pathSlug('ai-agents')}.md. Machine-readable
format claims: ${SITE_URL}/info/capabilities.json

${sections.join('\n\n')}

${buildLlmsFormatsSection()}
`;
}

// The Formats section for llms.txt: every per-format side-door page, plus the
// machine-readable claims file. An agent that wants "does Lolly do X format"
// fetches capabilities.json; a reader-facing page sits at each formats/<token>/.
// The section body is built by the pure module so the llms test can pin it.
function buildLlmsFormatsSection(): string {
  return llmsFormatsSection(formatCatalog() as unknown as SideDoorCatalog, { url: SITE_URL });
}

// ── Build all pages ───────────────────────────────────────────────────────────

async function build() {
  // Ensure output dirs exist and copy static assets (icons).
  mkdirSync(outDir, { recursive: true });

  // The shared chrome CSS + JS (plan 131 B.1), written once and linked per page.
  // Mirror, don't accumulate: a content change moves the hash, so drop any prior
  // docs.<hash>.{css,js} first or the gitignored output keeps serving stale twins.
  for (const f of readdirSync(outDir)) {
    if (/^docs\.[A-Za-z0-9_-]{16}\.(css|js)$/.test(f)) rmSync(resolve(outDir, f));
  }
  writeFileSync(resolve(outDir, DOCS_CSS_FILE), CSS, 'utf-8');
  writeFileSync(resolve(outDir, DOCS_JS_FILE), DOCS_JS, 'utf-8');
  console.log(`✓  /info/${DOCS_CSS_FILE} + /info/${DOCS_JS_FILE} (shared chrome, linked per page)`);
  // icon.svg is THE site mark (hero logo; the README + overview doc use it too) - the
  // single source of truth, a hand-drawn C2PA- + RDF-signed vector, served verbatim so its
  // provenance travels. A missing source is a broken landing page, so warn loudly.
  try { copyFileSync(resolve(repoRoot, 'icon.svg'), resolve(outDir, 'icon.svg')); }
  catch { console.warn('⚠  docs/site: icon.svg missing at repo root - /info/icon.svg will 404'); }
  try { copyFileSync(resolve(repoRoot, 'founded-by.svg'), resolve(outDir, 'founded-by.svg')); } catch {}

  // Docs screenshots - committed baselines captured by `npm run docs:shots` from
  // the url-shot recipe links inline in docs/*.md (neutral lolly-start brand;
  // scripts/build-docs-shots.ts). Served at /info/shots/ so every locale's pages
  // reference one set. A checkout that never captured any still builds - the
  // pages just show their alt text.
  const shotsSrc = resolve(repoRoot, 'docs', 'shots');
  if (existsSync(shotsSrc)) {
    // Mirror, don't accumulate: a renamed/reformatted baseline must not leave its
    // old copy behind in the (gitignored) output dir to be served stale.
    rmSync(resolve(outDir, 'shots'), { recursive: true, force: true });
    mkdirSync(resolve(outDir, 'shots'), { recursive: true });
    for (const f of readdirSync(shotsSrc)) {
      if (/\.(png|svg|jpg)$/.test(f)) copyFileSync(resolve(shotsSrc, f), resolve(outDir, 'shots', f));
    }
    // The landing's cover media (plans/177): stills AND the short animated loops
    // (webp/svg/webm/mp4), one subdirectory, mirrored like the shots above it.
    const coversSrc = resolve(shotsSrc, 'covers');
    if (existsSync(coversSrc)) {
      mkdirSync(resolve(outDir, 'shots', 'covers'), { recursive: true });
      for (const f of readdirSync(coversSrc)) {
        if (/\.(png|svg|jpg|webp|webm|mp4)$/.test(f)) copyFileSync(resolve(coversSrc, f), resolve(outDir, 'shots', 'covers', f));
      }
    }
  }

  // Block 2's worked examples (plan 117): each card shows the tool's OWN preview of
  // the exact look its link seeds, so what the reader sees is what the click gives
  // them. Copied verbatim out of the ACTIVE brand's catalog - these are signed
  // artifacts, so they are copied, never rewritten - and mirrored, not accumulated.
  // A brand whose catalog has no preview for a look ships that card without a
  // picture (makeSomethingBlock checks), which is why this is a warning, not a fail.
  rmSync(resolve(outDir, 'examples'), { recursive: true, force: true });
  const previewDir = resolve(repoRoot, 'catalog', 'previews');
  const havePreviews = LANDING_SCENES.filter(s => existsSync(resolve(previewDir, s.look)));
  if (havePreviews.length) {
    mkdirSync(resolve(outDir, 'examples'), { recursive: true });
    for (const s of havePreviews) copyFileSync(resolve(previewDir, s.look), resolve(outDir, 'examples', s.look));
    console.log(`✓  /info/examples/ (${havePreviews.length} worked-example previews)`);
  }
  for (const s of LANDING_SCENES) {
    if (!existsSync(resolve(previewDir, s.look))) {
      console.warn(`⚠  landing example: this brand's catalog has no ${s.look} - the "${s.scene}" card ships without its picture`);
    }
  }

  // Banked art - the signed mastheads and figures, served verbatim at
  // /info/mastheads/ and /info/figures/ (the shots precedent). The page inlines a
  // STRIPPED copy of these bytes; this is the copy the credential line describes and
  // that "Check it yourself" / "Get the signed file" / "Copy signed source" act on,
  // so it must arrive byte-identical to what was signed - copied, never rewritten.
  // The sibling <id>.meta.json is bank input (generator, model, oversight - read by
  // scripts/sign-docs-art.ts) and is deliberately NOT published.
  for (const bank of ['mastheads', 'figures']) {
    // Mirror, don't accumulate: a withdrawn artifact must not stay behind in the
    // (gitignored) output dir to be served stale beside a page that no longer
    // references it. Cleared BEFORE the existence check, so emptying the bank
    // empties the site too.
    rmSync(resolve(outDir, bank), { recursive: true, force: true });
    const src = resolve(repoRoot, 'docs', bank);
    if (!existsSync(src)) continue;
    const art = readdirSync(src).filter(f => /\.(svg|html)$/.test(f));
    if (!art.length) continue;   // a bank holding only its README serves nothing
    mkdirSync(resolve(outDir, bank), { recursive: true });
    for (const f of art) copyFileSync(resolve(src, f), resolve(outDir, bank, f));
    console.log(`✓  /info/${bank}/ (${art.length} signed ${art.length === 1 ? 'artifact' : 'artifacts'})`);
  }

  // Docs narration - mirror the committed artefacts and link them (plan section 4.5).
  // Same mirror-don't-accumulate rule as shots: a withdrawn narration must not
  // stay behind in the gitignored output dir to be served stale. The player
  // bundle and audio-index.json exist only while at least one page has audio,
  // so a no-audio checkout builds a byte-identical /info with none of this.
  audioBySlug = collectDocsAudio();
  rmSync(resolve(outDir, 'audio'), { recursive: true, force: true });
  rmSync(resolve(outDir, 'audio-index.json'), { force: true });
  for (const f of readdirSync(outDir)) {
    if (/^docs-player.*\.(js|css)$/.test(f)) rmSync(resolve(outDir, f), { force: true });
  }
  if (audioBySlug.size) {
    cpSync(resolve(repoRoot, 'docs', 'audio'), resolve(outDir, 'audio'), { recursive: true });
    // The ordered playlist prev/next + auto-advance walk - pages[] order, which
    // is the same order the sidebar reads in.
    writeFileSync(resolve(outDir, 'audio-index.json'), JSON.stringify([...audioBySlug.values()]), 'utf-8');
    try {
      bundleDocsPlayer();
      console.log(`✓  /info/docs-player.js (${audioBySlug.size} narrated pages)`);
    } catch (err) {
      // No bundle means every Listen press would 404 - withhold the buttons
      // rather than render dead controls.
      audioBySlug = new Map();
      console.warn('⚠  docs player bundle failed - Listen buttons withheld:', (err as Error).message);
    }
  }

  // Which pages actually have a generated OG card *on disk* right now. Derived from
  // the filesystem rather than generateOgImages()'s return value so the share-tag
  // wiring is correct even when generation ran in a different process (a stale or
  // duplicate `--watch`), and so a page only points at its own card when the PNG
  // truly exists - otherwise it falls back to the canonical og.png.
  const ogSlugs = new Set(
    pages
      .filter((p) => !p.isLanding && p.slug && existsSync(resolve(outDir, 'og', `${p.slug}.png`)))
      .map((p) => p.slug),
  );

  // English at /info/, every other locale mirrored under /info/<lang>/ - same
  // page set, same slugs, translated chrome + (where a docs/i18n/<lang>/<slug>.md
  // sidecar exists) translated body; otherwise the English body ships inside the
  // localized chrome rather than 404ing. See plans/38-localize.md section 8.
  const sitemapUrls: Array<{ slug: string; isLanding?: boolean }> = [];
  const mdBySlug = new Map<string, string>();
  // The English pages to seal, collected as they are written (plans/105 section 7). The
  // list is built here rather than from `pages` so a page whose source could not
  // be read - and which therefore has no file on disk - is never sealed.
  const sealTargets: SealTarget[] = [];

  // The format register drives three things (plan 116 workstream A): the machine-
  // readable capabilities.json below, one side-door page per format, and the
  // curated convert pages. The register is English-only (format names are not
  // translated), so it and the derived convert-pair list are resolved once here.
  const sideDoorCatalog = formatCatalog() as unknown as SideDoorCatalog;
  const sideDoorConvertPairs = convertPageList(sideDoorCatalog);
  // /info/capabilities.json - the static, server-free claims file an agent can
  // fetch instead of scraping a page. Built straight from the register.
  writeFileSync(
    resolve(outDir, 'capabilities.json'),
    JSON.stringify(buildCapabilities(sideDoorCatalog, { url: SITE_URL }), null, 2),
    'utf-8',
  );
  console.log(`✓  /info/capabilities.json (${sideDoorCatalog.formats.length} formats)`);

  for (const lang of LANGS) {
    activeCatalog = loadSiteCatalog(lang);
    activeLang = lang;
    const localeOutDir = lang === 'en' ? outDir : resolve(outDir, lang);
    mkdirSync(localeOutDir, { recursive: true });
    const searchRecords: SearchRecord[] = [];

    for (const page of pages) {
      const srcPath = resolvePageSrc(page, lang);
      let md: string;
      try {
        md = readFileSync(srcPath, 'utf-8');
      } catch {
        if (lang === 'en') console.warn(`⚠  Skipping ${page.slug}: ${srcPath} not found`);
        continue;
      }

      const content = page.isLanding ? buildLandingContent(md, lang)
        : page.render ? page.render(md, lang)
        : mdToHtml(md);
      const html    = doorizeLinks(wrapPage(lang, page, content, ogSlugs, md));
      const outFile = page.slug === 'index' ? 'index.html' : `${pathSlug(page.slug)}.html`;
      if (outFile.includes('/')) mkdirSync(dirname(resolve(localeOutDir, outFile)), { recursive: true });
      writeFileSync(resolve(localeOutDir, outFile), html, 'utf-8');
      // Indexed from `content`, this locale's actual rendered body - so a locale
      // with no sidecar (English body inside translated chrome) indexes the English
      // it really shows, rather than claiming a translation it doesn't have.
      // The record's `p` is the PATH slug (create/using): the search script builds
      // hrefs as /info/<p>.html, which is exactly the doored file.
      searchRecords.push(...indexSections(content, pathSlug(page.slug), t(page.title)));
      console.log(`✓  ${localeHref(lang, page.slug)}`);
      if (lang === 'en') {
        sitemapUrls.push({ slug: page.slug, isLanding: page.isLanding });
        sealTargets.push({
          slug: page.slug,
          path: resolve(localeOutDir, outFile),
          title: t(page.title),
          // The file that was actually read, repo-relative - not `page.src`
          // re-derived, so the claim names the source this page really came from.
          source: relative(repoRoot, srcPath).split(sep).join('/'),
        });
        // Markdown twin: the verbatim English source, published next to the HTML
        // so agents (and llms.txt below) can read the docs without a DOM.
        const twin = stripLogoMarkers(unwrapFigureFences(unwrapProvenanceMarkers(commentStandaloneProvenanceLines(stripFrontMatter(md)))));
        // Written at the DOORED path beside its HTML (/info/<door>/<slug>.md):
        // the search index records carry the doored path and the in-app Ask
        // fetches `/info/<p>.md` from it (lib/ask/answer.ts), so a flat twin
        // was a 404 for every moved page and the answer fell back to the snippet.
        writeFileSync(resolve(outDir, `${pathSlug(page.slug)}.md`), twin, 'utf-8');
        mdBySlug.set(page.slug, twin);
      }
    }

    // The format side-door pages (plan 116 workstream A): one per register format
    // at /info/formats/<token>/, one per curated conversion at
    // /info/convert/<in>-to-<out>/. Generated, not in pages[], and reusing the
    // same wrapPage chrome. Written per locale (English body + register prose,
    // localized chrome via activeCatalog), the English URLs feeding the sitemap.
    let sideDoorCount = 0;
    for (const entry of sideDoorCatalog.formats) {
      const model = buildFormatPageModel(entry, sideDoorCatalog);
      const slug = `formats/${model.slug}`;
      const gp: Page = { slug, title: model.title, src: '', description: model.description, pathway: 'creators', generated: true };
      const content = renderFormatSideDoor(model, lang);
      const html = wrapPage(lang, gp, content, ogSlugs, '');
      const dir = resolve(localeOutDir, 'formats', model.slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'index.html'), doorizeLinks(html), 'utf-8');
      // One record per page (no id'd headings inside): the searcher who types a
      // format name must find its page, not only the formats table.
      searchRecords.push(...indexSections(content, slug, gp.title));
      if (lang === 'en') sitemapUrls.push({ slug });
      sideDoorCount++;
    }
    for (const pair of sideDoorConvertPairs) {
      const model = buildConvertPageModel(pair, sideDoorCatalog);
      const slug = `convert/${model.slug}`;
      const gp: Page = { slug, title: model.title, src: '', description: model.description, pathway: 'creators', generated: true };
      const content = renderConvertSideDoor(model, lang);
      const html = wrapPage(lang, gp, content, ogSlugs, '');
      const dir = resolve(localeOutDir, 'convert', model.slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'index.html'), doorizeLinks(html), 'utf-8');
      searchRecords.push(...indexSections(content, slug, gp.title));
      if (lang === 'en') sitemapUrls.push({ slug });
      sideDoorCount++;
    }
    console.log(`✓  ${lang === 'en' ? '' : `/${lang}`}/info format side-door pages (${sideDoorCount})`);

    // One index per locale, fetched lazily by the sidebar search on first use - 
    // never on page load, so a reader who doesn't search pays nothing for it.
    writeFileSync(resolve(localeOutDir, 'search-index.json'), JSON.stringify(searchRecords), 'utf-8');
    console.log(`✓  ${lang === 'en' ? '' : `/${lang}`}/info/search-index.json (${searchRecords.length} sections)`);
  }
  activeCatalog = {};
  activeLang = 'en';

  // Redirect stubs for retired slugs - keep inbound links + bookmarks resolving.
  // English-only: these are legacy URLs, never linked from the localized nav tree.
  for (const s of stubs) {
    const dest = esc(s.target);
    const stub = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moved - Lolly</title>
<link rel="canonical" href="${SITE_URL}${dest}">
<meta http-equiv="refresh" content="0; url=${dest}">
<meta name="robots" content="noindex">
<script>location.replace(${JSON.stringify(s.target)});</script>
</head>
<body>Redirecting to <a href="${dest}">${dest}</a>…</body>
</html>`;
    writeFileSync(resolve(outDir, `${s.slug}.html`), stub, 'utf-8');
    console.log(`↪  /info/${s.slug}.html → ${s.target}`);
  }

  // Sitemap - every page × every locale, with hreflang alternates so search
  // engines route each locale to the language it actually serves.
  const urlEntries = sitemapUrls.map(({ slug }) => {
    const alternates = LANGS.map(l =>
      `      <xhtml:link rel="alternate" hreflang="${LANG_META[l].htmlLang}" href="${esc(`${SITE_URL}${localeHref(l, slug)}`)}"/>`,
    ).join('\n');
    return LANGS.map(lang => `  <url>\n    <loc>${esc(`${SITE_URL}${localeHref(lang, slug)}`)}</loc>\n${alternates}\n  </url>`).join('\n');
  }).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlEntries}\n</urlset>\n`;
  writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap, 'utf-8');
  console.log(`✓  /info/sitemap.xml (${sitemapUrls.length} pages × ${LANGS.length} locales)`);

  writeFileSync(resolve(outDir, 'llms.txt'), buildLlmsTxt(mdBySlug), 'utf-8');
  console.log(`✓  /info/llms.txt (+${mdBySlug.size} markdown twins)`);

  // The agent-facing set beside it (docs/agents-pages.ts): the full-text twin, the
  // short guide, the OpenAPI description and the discovery record. Root URLs for
  // each are vercel.json rewrites (ROOT_ALIASES there, held to vercel.json by test).
  const agentDocs = buildAgentDocs({
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    engineVersion: ENGINE_VERSION,
    pages: pages.map((p) => ({ slug: p.slug, title: p.title, pathway: p.pathway ?? 'builders', path: pathSlug(p.slug), isLanding: !!p.isLanding })),
    mdBySlug,
    sections: LLMS_SECTIONS,
  });
  for (const [file, text] of Object.entries(agentDocs)) writeFileSync(resolve(outDir, file), text, 'utf-8');
  console.log(`✓  /info/{${Object.keys(agentDocs).join(',')}} (agent set; root aliases via vercel.json)`);

  // ── Page seals (plans/105 section 7) ──────────────────────────────────────────────
  // LAST, and after every page is on disk: C2PA 2.4 section A.7.1.3 hashes the whole
  // document, so anything that rewrote a page after this point would silently
  // invalidate its own credential. Only pages whose bytes (or whose signed
  // components) actually changed are re-signed - see docs/page-seal.ts for why
  // an unconditional re-sign is not an option on a committed site.
  await sealPages({ outDir, targets: sealTargets });

  // After the seals, so the offline docs bundle carries each page's sidecar
  // alongside the page it belongs to (and hashes its real bytes).
  writeInfoManifest();
  // AFTER writeInfoManifest (which walks outDir), so the render manifest is not itself
  // swept into the offline bundle - that keeps manifest.json byte-identical.
  writeDocsManifest();
  console.log(`\nSite built → shells/web/public/info/`);
}

// ── /info/manifest.json - the offline-docs download manifest ─────────────────
// The web shell's "Available offline" manager (shells/web/src/lib/
// offline-manager.ts) reads this to download the docs site into the service
// worker's per-URL lolly-info bucket. Grouped so the manager can fetch just
// what a device needs: `en` (the root pages + css + inline art + search index),
// `shots` (the shared screenshots - every locale references these), and one
// entry per translated locale. og/ is deliberately absent: those are social
// share cards read by scrapers, never by a person browsing offline (and they're
// rasterised AFTER build(), so listing them here would race their generation).
// `version` hashes the listing - the manager's re-download watermark.
const AGENT_SET_URLS = new Set(Object.values(AGENT_FILES).map((f) => `/info/${f}`));
function writeInfoManifest(): void {
  interface ManifestFile { url: string; size: number; hash: string }
  const walk = (dir: string): ManifestFile[] => {
    const out: ManifestFile[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue; // Finder droppings, not site payload
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.isFile()) {
        out.push({
          url: `/info/${relative(outDir, full).split(sep).join('/')}`,
          size: statSync(full).size,
          // Content hash: docs URLs are stable slugs, so a same-size page edit
          // is invisible to a size compare - the offline download manager's
          // resume (cachedMatches) needs the bytes' identity, not their count.
          hash: createHash('sha256').update(readFileSync(full)).digest('base64url').slice(0, 16),
        });
      }
    }
    return out;
  };
  const localeDirs = new Set(LANGS.filter((l) => l !== 'en').map(String));
  const en: ManifestFile[] = [];
  const shots: ManifestFile[] = [];
  const audio: ManifestFile[] = [];
  const locales: Record<string, ManifestFile[]> = {};
  for (const f of walk(outDir).sort((a, b) => a.url.localeCompare(b.url))) {
    const seg = f.url.split('/')[2] ?? '';
    if (seg === 'og' || f.url === '/info/manifest.json') continue;
    // The agent set is for machine readers fetching over HTTP; llms-full.txt alone is
    // the whole corpus a second time, so none of it belongs in "Available offline: Docs".
    if (AGENT_SET_URLS.has(f.url)) continue;
    if (seg === 'shots') shots.push(f);
    // Narration + its player travel as their own group, which docsFileList()
    // deliberately EXCLUDES from the default docs part (plan section 7): audio grows
    // linearly with pages × locales and must never silently fatten "Available
    // offline: Docs". Online playback still caches incidentally via the SW's
    // lolly-info bucket. The player chunks live here too - the biggest one is
    // butterchurn, useless without the audio it visualises.
    else if (seg === 'audio' || /^\/info\/(docs-player[^/]*|audio-index\.json)$/.test(f.url)) audio.push(f);
    else if (localeDirs.has(seg)) (locales[seg] ??= []).push(f);
    else en.push(f);
  }
  const all = [...en, ...shots, ...audio, ...Object.values(locales).flat()];
  const version = createHash('sha256')
    .update(all.map((f) => `${f.url}:${f.size}:${f.hash}`).join('\n'))
    .digest('base64url').slice(0, 16);
  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify({ version, groups: { en, shots, audio, locales } }), 'utf-8');
  console.log(`✓  /info/manifest.json (${all.length} files, ${Object.keys(locales).length} locales)`);
}

// ── /info/docs-render-manifest.json - facts for a RUNTIME DocsRenderContext ───
// The in-app docs view and the interactive figures/embeds (plan M2/M3) implement
// DocsRenderContext over THIS instead of the filesystem: shot dimensions, Content-Credential
// facts, capture-recipe try-links, showcase frames and banked-art resolutions - precomputed
// here, where the C2PA/anatomy reads already happen. Locale-INDEPENDENT: every fact is about
// file BYTES, and localizedShot is resolved by the runtime from `shots` (the full committed
// file list). Keyed by served src so the runtime can compute a key from (file, opts) the same
// way build.ts's docCtx does. Deterministic (sorted iteration) so the file itself is stable.
function writeDocsManifest(): void {
  const shotsDir = resolve(__dirname, 'shots');
  const sizes: Record<string, { w: number; h: number }> = {};
  const credentials: Record<string, CredentialFacts> = {};
  const recipes: Record<string, { route: string }> = {};
  const showcases: Record<string, unknown> = {};
  const art: Record<string, unknown> = {};
  const shots: string[] = [];

  // Every committed shot: its dimensions, credential facts and (opt-in) try-link route.
  for (const file of readdirSync(shotsDir).filter((f) => /\.(svg|png|jpe?g)$/.test(f)).sort()) {
    shots.push(file);
    const src = `/info/shots/${file}`;
    const size = docCtx.shotSize(file);
    if (size) sizes[src] = size;
    const cred = docCtx.credential(file);
    if (cred) credentials[src] = cred;
    const slug = file.split('.')[0] ?? '';
    if (!(slug in recipes)) {
      const link = docCtx.tryLink(file);
      if (link) recipes[slug] = link;
    }
  }

  // Page assets referenced in the prose (the AI-stance hero, the-flood, …).
  const assetRefs = new Set<string>();
  const pages = readdirSync(__dirname).filter((f) => f.endsWith('.md')).sort();
  for (const page of pages) {
    const md = readFileSync(resolve(__dirname, page), 'utf-8');
    for (const m of md.matchAll(/\/info\/(?!shots\/)[\w./-]+\.(?:webp|png|jpe?g|avif)/g)) assetRefs.add(m[0]);
  }
  for (const src of [...assetRefs].sort()) {
    const file = src.slice('/info/'.length);
    const cred = docCtx.credential(file, { assetSrc: src });
    if (!cred) continue;
    credentials[src] = cred;
    const size = docCtx.shotSize(file, src);
    if (size) sizes[src] = size;
  }

  // Showcase frames (::: showcase) - resolved from the same viewBox the build reads.
  for (const page of pages) {
    const md = readFileSync(resolve(__dirname, page), 'utf-8');
    for (const m of md.matchAll(/^::: showcase\b[\s\S]*?filename=([\w-]+)/gm)) {
      const show = docCtx.showcase(m[1]!);
      if (show) showcases[m[1]!] = show;
    }
  }
  // Banked art (figures/mastheads) - English resolution (the manifest is locale-neutral;
  // localized art variants are a follow-up, like the localized-shot capture axis).
  for (const bank of ['figures', 'mastheads'] as const) {
    const dir = resolve(__dirname, bank);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((n) => /\.(svg|html)$/.test(n) && !/\.\w{2,5}\.(svg|html)$/.test(n)).sort()) {
      const id = f.replace(/\.[^.]+$/, '');
      const resolved = docCtx.art(bank, id);
      if (resolved) art[`${bank}/${id}`] = resolved;
    }
  }

  writeFileSync(resolve(outDir, 'docs-render-manifest.json'),
    JSON.stringify({ shots, sizes, credentials, recipes, showcases, art }), 'utf-8');
  console.log(`✓  /info/docs-render-manifest.json (${shots.length} shots, ${Object.keys(credentials).length} credentials)`);
}

// Per-page OG share images depend only on the page titles + brand assets (never the
// docs markdown), so they're rasterised once here and reused by every build()
// (including incremental --watch rebuilds). `ogSlugs` names the slugs that got their
// own card; the rest fall back to og.png. Best-effort - a missing render browser
// (or any rasterise error) just yields an empty set, leaving every page on og.png.
// Caption each /info card with the SAME description its <meta> tag uses - explicit
// where set, otherwise the page's first body sentence - so every docs card carries its
// own copy instead of one shared tagline. The md is read once here (cheap, English only;
// the cards are language-neutral). A page whose source can't be read keeps whatever
// explicit description it had, and generateOgImages falls back to the site tagline.
const ogPages = pages.map((p) => {
  if (p.description || p.isLanding) return p;
  try { return { ...p, description: mdDescription(readFileSync(resolve(__dirname, p.src), 'utf-8')) || undefined }; }
  catch { return p; }
});
const ogGenerated = await generateOgImages(ogPages, outDir, repoRoot, (m) => console.log(m));
const ogExpected = pages.filter((p) => !p.isLanding && p.slug && p.title).length;
if (ogExpected > 0 && ogGenerated.size < ogExpected) {
  const onDisk = pages.filter(
    (p) => !p.isLanding && p.slug && existsSync(resolve(outDir, 'og', `${p.slug}.png`)),
  ).length;
  console.warn(
    `⚠  og: generated ${ogGenerated.size}/${ogExpected} per-page share cards (${onDisk} present on disk).` +
      (onDisk === 0
        ? ' Every /info page will use the fallback og.png - is the render browser (Playwright/Chromium) installed for this platform?'
        : ''),
  );
}

// Awaited: build() signs each changed page as its last step (plans/105 section 7), and a
// process that exits before those writes land would publish pages pointing at
// sidecars that were never written.
await build();

// ── Watch mode ────────────────────────────────────────────────────────────────
// `node docs/build.ts --watch` rebuilds whenever a docs source changes, so the
// /info pages stay current during `npm run dev:web`. Sources are everything under
// docs/ (the markdown, faq.md, and src/*.svg) plus the repo-root README.md (the
// About page). Output goes to shells/web/public/ - outside docs/ - so a rebuild
// never re-triggers the watcher.
//
// TWO KINDS OF CHANGE, and they cannot be rebuilt the same way. A markdown or SVG
// edit is DATA: `build()` re-reads it from disk, so calling the function again is
// both correct and cheap. An edit to a .ts file in here is CODE, and every
// top-level binding this module owns - `CSS` above all, plus the page templates
// and the nav - was evaluated once when the module was imported. Calling `build()`
// after a CSS edit therefore re-emits the OLD stylesheet straight over the new
// one, silently: the file's mtime updates, the "✓" prints, and the change is gone.
// (That cost a real debugging session on 2026-07-31 - the built pages kept
// reverting and the source was plainly correct.) So a code change re-imports the
// module instead, with a cache-busting query, to get a fresh graph.
//
// The fresh copy runs its own top-level `build()` - that is the rebuild - but must
// NOT arm a second watcher, hence the env guard below. The original process stays
// the only watcher. Cost: Node keeps each imported version in its ESM cache, so a
// very long session with many builder edits accumulates a few module instances.
// That is the accepted price of never writing stale output.
if (process.argv.includes('--watch') && process.env.LOLLY_DOCS_RELOAD !== '1') {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let reloading = false;
  const reload = async (label: string): Promise<void> => {
    if (reloading) return;                       // a burst of saves is one reload
    reloading = true;
    console.log(`\n↻  ${label} changed (builder code) - reimporting…`);
    process.env.LOLLY_DOCS_RELOAD = '1';
    try {
      await import(`${import.meta.url}?reload=${Date.now()}`);
    } catch (err) {
      // A syntax error in a half-saved file is the common case: say so and keep
      // watching, so the next save recovers rather than leaving a dead watcher.
      console.error('✗  Reload failed:', (err as Error).message);
    } finally {
      process.env.LOLLY_DOCS_RELOAD = '';
      reloading = false;
    }
  };
  // build() is ASYNC now (the page seals are its last step, and signing is), which
  // changes one thing about this watcher: a synchronous build could not be
  // re-entered - the debounce timer simply could not fire while it ran - whereas an
  // awaited one yields, so a save landing during the seal pass would start a second
  // build over the first one's output. Two builds writing the same pages while one
  // of them hashes them is how a seal ends up over half-written bytes. So: one build
  // at a time, and a save that arrives mid-build queues exactly one more.
  let building = false;
  let queued: string | null = null;
  const runBuild = async (label: string): Promise<void> => {
    if (building) { queued = label; return; }
    building = true;
    console.log(`\n↻  ${label} changed - rebuilding /info…`);
    try {
      await build();
    } catch (err) {
      console.error('✗  Rebuild failed:', (err as Error).message);
    } finally {
      building = false;
      const next = queued;
      queued = null;
      if (next) void runBuild(next);
    }
  };
  const scheduleRebuild = (label: string) => {
    clearTimeout(timer!);
    timer = setTimeout(() => {
      if (/\.ts$/.test(label)) { void reload(label); return; }
      void runBuild(label);
    }, 120);
  };
  // fs.watch types the filename as string | Buffer | null; it's a string here.
  watch(__dirname, { recursive: true }, (_event, file) => scheduleRebuild((file || 'docs') as string));
  try { watch(resolve(repoRoot, 'README.md'), () => scheduleRebuild('README.md')); } catch {}
  console.log('\n👀  Watching docs/ for changes - Ctrl+C to stop.');
}
