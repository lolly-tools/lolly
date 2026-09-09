// SPDX-License-Identifier: MPL-2.0
/**
 * CLI implementation of the v1 capability bridge.
 *
 * The CLI runs in Node with a jsdom DOM. Storage is in-memory only (each
 * CLI invocation is ephemeral). Assets are read from the catalog on disk.
 *
 * The point of this file is to demonstrate that the SAME engine, hooks, and
 * tools work against a completely different bridge implementation. No tool
 * changes were needed.
 */

import { readFile } from 'node:fs/promises';
import { assetBytes } from '@lolly-tools/node-shell/asset-bytes';
import { join } from 'node:path';
// The .penpot archive's zip step (plans/178). fflate is already this shell's zip codec
// (the pptx read path uses it); the engine hands back entries and the caller zips them,
// exactly the split the web shell's lib/zip.ts sits on.
import { zipSync } from 'fflate';
import { buildCmykPaletteMap, parseDimension, toCssLength, toCssPx, toPixels, loadTool, createRuntime, emitEmf, emitEps, emitDxf, emitWmf, gzip, svgToPenpotDoc, imageToPenpotDoc, buildPenpotEntries, markToolComponents, imageDimensions, penpotUuid, PENPOT_MIME, parseToolUrl, buildEmbedUrl, parseUrlState, expandQuery, RESERVED, assertComposeStack, parseThemedAssetId, applyIconTheme, parseIconThemesDoc, parseTreatedAssetId, parsePhotoTreatmentsDoc, wrapRasterWithTreatment, createTokenSet, colorToHex, isAlias, makeColorApi, makeGeomApi, makeConnectorsApi, isZzfxmRef, parseZzfxmRef, formatZzfxmRef, embedC2pa, C2PA_FORMATS, exportActionSteps, ENGINE_VERSION, collectIngredients, applyPinnedAssets, DESIGN_VERSION_LATEST, pickHeadAssetId, readVersionIndex, resolveDesignVersion, versionAssetId } from '@lolly/engine';
import type {
  HostV1, Profile, AssetsAPI, AssetRef, AssetQuery, ExportOpts, ExportMeta,
  StateEntry, ComposeSpec, ExportFormat, TokenSet, C2paSignOpts,
} from '@lolly-tools/core/host-v1';
// Deep image encoders (v1.100 host.codec) - off the @lolly/engine barrel by
// design, imported deep-relative like node-shell/raster.ts does for packExr.
import { encodeExr, encodeRadiance, encodePng16, encodeDither8 } from '../../../engine/src/deep-encode.ts';
// PDF metadata inspect/strip is pure pdf-lib (no DOM), so the lean node CLI
// shares ONE implementation with the web shell rather than duplicating it. It
// used to live in shells/web and be imported across the submodule boundary;
// plans/202 WP1.1 moved it here and left the web file as a re-export. RELATIVE
// import for the same MCP-bundle reason as repo-root below.
import { createPdfAPI } from '../../../packages/node-shell/src/pdf.ts';
// PPTX inspect/rebrand is engine primitives + fflate (plain JS) with the XML
// parser injected, so the CLI shares one impl with the web shell and supplies
// jsdom's DOMParser. RELATIVE import on purpose, same reason as repo-root below:
// this file is inlined into the Vercel MCP function by scripts/build-mcp-fn.ts,
// whose esbuild config leaves bare package specifiers external, so a
// `@lolly-tools/node-shell/pptx` import would dangle in the bundle.
import { createPptxAPI } from '../../../packages/node-shell/src/pptx.ts';
// host.net allowlisted fetch is DOM-free too (global fetch + TransformStream, both
// Node ≥18 globals), so every shell builds it from one module - the prefix-match
// rules and the 64 MB counting-stream cap can never drift. RELATIVE for the same
// MCP-bundle reason as above.
import { createNetAPI } from '../../../packages/node-shell/src/net.ts';
// SVG→EMF IR walk is DOM-light (attribute reads), so it runs under jsdom for
// native-SVG tools - the same "no layout engine" constraint as the svg branch.
// Moved out of shells/web by plans/202 WP1.1; RELATIVE for the MCP-bundle reason.
// The walk shapes <text> itself and takes the font resolver as an argument: the
// web shell injects its IndexedDB/document.fonts registry, and `cliResolveFont`
// below is this shell's equivalent over host.text's headless registry. It is NOT
// optional here - EPS, DXF, WMF and `--text=outline` EMF have no <text> fallback,
// so with no resolver every run reads as an unresolvable family and the export
// throws (which is what the byte-pinned goldens in tests/cli-export-golden.test.ts
// caught).
import { svgDomToIr } from '../../../packages/node-shell/src/svg-ir.ts';
import type { SvgIrFont } from '../../../packages/node-shell/src/svg-ir.ts';
import type { FontStyleSlice } from '../../../packages/node-shell/src/text-svg.ts';

// Repo root holding catalog/ - the shared resolver (LOLLY_ROOT → marker walk → cwd;
// see packages/node-shell/src/repo-root.ts for why a fixed `../../..` can't work in
// the bundled Vercel function). RELATIVE import on purpose: this file is inlined into
// that function by scripts/build-mcp-fn.ts, whose esbuild config leaves bare package
// specifiers external - a `@lolly-tools/node-shell` import would dangle in the bundle.
import { repoRoot } from '../../../packages/node-shell/src/repo-root.ts';
// host.text (HarfBuzz text-to-path). RELATIVE for the same reason as repo-root above - 
// this file is inlined into the Vercel MCP function, where a bare @lolly-tools/node-shell
// specifier would dangle. Lazily loads its WASM on first shape, so attaching it is free.
import { createNodeTextAPI } from '../../../packages/node-shell/src/text.ts';
// host.audio (WAV/ZzFXM decode + the engine's frame analysis). RELATIVE for the same
// MCP-bundle reason; it pulls no codec and no WASM, so attaching it is free.
import { createNodeAudioAPI } from '../../../packages/node-shell/src/audio.ts';
// url-shot page capture (scoped Chromium). RELATIVE for the MCP bundle; its browser is
// lazy-loaded, so importing it costs nothing until a capture actually runs.
import { captureUrl } from '../../../packages/node-shell/src/url-capture.ts';
// host.images (decode/resize/encode via sharp). RELATIVE for the same MCP-bundle reason;
// it resolves sharp lazily and returns null when it isn't installed, so importing it is
// free and a lean install simply leaves host.images undefined.
import { createNodeImagesAPI } from '../../../packages/node-shell/src/images.ts';
// The on-device ML utilities (upscale / matte / OCR over onnxruntime-node + sharp).
// RELATIVE for the same MCP-bundle reason; each factory is a require.resolve probe and
// the runtimes load on first use, so importing them costs nothing.
import {
  createNodeMatteAPI, createNodeOcrAPI, createNodeUpscaleAPI,
} from '../../../packages/node-shell/src/ml/index.ts';
// pdf.redact/pdf.pages + host.raster, over @napi-rs/canvas. Same conditional-attach
// stance as images.ts: the import is free, the native module loads lazily, and both
// factories return null on a lean install so the capability stays honestly absent.
import { createNodePdfRedact } from '../../../packages/node-shell/src/pdf-redact.ts';
import { createNodeRasterAPI } from '../../../packages/node-shell/src/canvas.ts';
// host.speech (Kokoro TTS + Whisper transcription). RELATIVE for the same MCP-bundle
// reason; it resolves transformers.js lazily and returns null when the runtime is
// absent, so importing it costs nothing and a lean install leaves host.speech undefined.
import { createNodeSpeechAPI } from '../../../packages/node-shell/src/speech.ts';
import { createNodeScanAPI } from '../../../packages/node-shell/src/scan.ts';
// LOLLY_STATE_DIR resolution (shared with the TUI). RELATIVE for the MCP-bundle reason.
import { resolveStateDir } from '../../../packages/node-shell/src/state-dir.ts';
// The saved-session files on this machine, in the layout the desktop app writes
// (plans/202 WP3.1). Same relative-import reason.
import {
  deleteSessionRecord, listSessionSlots, loadSessionData, writeSessionRecord,
  type SessionData,
} from '../../../packages/node-shell/src/session-store.ts';
import { activeNodeDesignSystem, readActiveDesignSystemTokens } from '../../../packages/node-shell/src/design-systems.ts';
// Text-as-paths on the svg branch (contract section 6a). Local to this shell: it resolves
// fonts through host.text's headless registry, not the web shell's fetching one.
import { familyStack, numericWeight, outlineSvgText } from './svg-outline.ts';
import { unavailableHere } from './exit-codes.ts';
const REPO_ROOT = repoRoot();

/**
 * The font resolver `svgDomToIr` outlines a run with, over host.text's headless
 * registry. Cascade order is a browser's: the first named family that resolves to
 * a real sfnt wins, and a generic keyword is skipped rather than looked up as a
 * family name - the same rule svg-outline.ts applies on the svg branch, so the two
 * text paths in this shell pick the same face for the same run.
 *
 * Returns null when nothing resolves. The vector formats treat that as fatal and
 * say which family failed; no substitute face is ever chosen, because outlining a
 * run in whatever font is on disk would bake a design nobody picked into a file
 * that then looks authoritative.
 */
function cliResolveFont(host: HostV1): (style: FontStyleSlice, text: string) => Promise<SvgIrFont | null> {
  return async (style) => {
    const text = host.text;
    if (!text?.fontUrl) return null;
    const weight = numericWeight(style.fontWeight ?? null);
    const italic = /italic|oblique/i.test(style.fontStyle ?? '');
    for (const family of familyStack(style.fontFamily ?? null)) {
      if (/^(sans-serif|serif|monospace|cursive|fantasy|system-ui)$/i.test(family)) continue;
      const font = await text.fontUrl(family, { weight, italic });
      if (font) return font;
    }
    return null;
  };
}

/**
 * Capabilities THIS shell can actually fulfil - the CLI's answer to the web shell's
 * PROVIDED_CAPABILITIES (shells/web/src/bridge/capabilities-provided.ts), which the
 * gallery uses to disable tools it cannot run. The CLI never declared its set at all,
 * so a `screen`/`microphone` tool rendered a misleading placeholder and exited 0
 * instead of refusing (contract B11).
 *
 * What is in and why:
 *   • network - host.net, allowlisted per manifest.
 *   • wasm - host.text's HarfBuzz WASM loads in Node.
 *   • compose - host.compose renders child tools in-process.
 *   • capture - host.capture.page drives the scoped Chromium. Present even when no
 *                browser is installed: that is a "not installed HERE yet" (exit 3 with
 *                `lolly install-browser`), not "this shell cannot do it".
 * What is out: clipboard (throws by design, section 4.4), camera/microphone/screen (no
 * device access in a headless process, and shelling out to one is a non-goal),
 * ffmpeg (never shipped), filesystem (the RUNNER reads and writes files; the host
 * bridge exposes no filesystem API a tool could call).
 */
export const CLI_CAPABILITIES = ['network', 'wasm', 'compose', 'capture'] as const;

/** One format entry inside a catalog asset record (catalog/assets/index.json). */
interface CatalogAssetFormat {
  format: string;
  url: string;
  checksum?: string;
  width?: number;
  height?: number;
}

/** A catalog asset record - the shape validate-catalog.js guarantees on disk. */
interface CatalogAsset {
  id: string;
  name?: string;
  type: AssetRef['type'];
  version?: string;
  tags?: string[];
  deprecated?: boolean;
  formats: CatalogAssetFormat[];
}

/** The CLI's private extensions to AssetsAPI - stubs mirroring the web shell's
 *  user-image surface (see below); never part of the public HostV1 contract. */
interface CliAssetsAPI extends AssetsAPI {
  _listUserAssets(): Promise<unknown[]>;
  _userAssetsCount(): Promise<number>;
  _userAssetsSize(): Promise<number>;
  _deleteUserAsset(id?: string): Promise<void>;
}

/** The concrete host the CLI builds: HostV1 plus the private assets stubs. */
type CliHost = HostV1 & { assets: CliAssetsAPI };

/** MIME (or, failing that, URL extension) → the AssetRef type vocabulary for
 *  direct-URL assets. Mirrors the web bridge's urlAssetType - keep in step. */
function urlAssetKind(mime: string, id: string): { type: 'vector' | 'raster' | 'video' | 'audio'; format: string } | null {
  const m = (mime || '').toLowerCase().split(';')[0]!.trim();
  if (m === 'image/svg+xml') return { type: 'vector', format: 'svg' };
  if (m.startsWith('image/')) return { type: 'raster', format: m.slice(6).replace('jpeg', 'jpg') };
  if (m.startsWith('video/')) return { type: 'video', format: m.slice(6) };
  if (m.startsWith('audio/')) return { type: 'audio', format: m.slice(6).replace('mpeg', 'mp3') };
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(id)?.[1]?.toLowerCase();
  if (!ext) return null;
  if (ext === 'svg') return { type: 'vector', format: 'svg' };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].includes(ext)) return { type: 'raster', format: ext.replace('jpeg', 'jpg') };
  if (['mp4', 'webm', 'mov'].includes(ext)) return { type: 'video', format: ext };
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return { type: 'audio', format: ext };
  return null;
}

/** Options `host.export.render` reads beyond ExportOpts: the engine-hydrated
 *  data/text payload and the physical-unit qualifier threaded to the emitters. */
interface CliExportRenderOpts extends ExportOpts {
  dataText?: string;
  dataMime?: string;
  unit?: string;
  /** Resolved Imprint decision forwarded by run.ts - consumed only by the BMP branch
   *  (the pixel watermark; container-less BMP carries no C2PA). Default-on when absent. */
  imprint?: boolean;
  /** The `hdr=` request, forwarded by run.ts. The canonical HostV1 ExportOpts has no
   *  HDR dials (the web shell carries its own extension too - shells/web/src/bridge/
   *  export.ts's ExportOpts), so this is the CLI's local extension of the same shape,
   *  in url-mode's 0–100 author dial units. Absent ⇒ SDR ⇒ exr/hdr refuse. */
  hdr?: { targets?: readonly string[]; peakNits?: number; reach?: number; lift?: number; richness?: number } | null;
  /** `--text=outline|live` (contract section 1.3). svg defaults to outline and
   *  'live' keeps `<text>`; emf defaults to LIVE (editable GDI text records,
   *  per-run outline fallback) and 'outline' forces paths. wmf/eps/dxf are
   *  always outlined regardless. */
  text?: 'outline' | 'live';
  /** Reported once per run that could not be outlined, so the runner can warn (and
   *  refuse under --strict) instead of the bridge writing to stderr itself. */
  onTextFallback?: (run: { text: string; reason: string }) => void;
}

/** Element type of parseIconThemesDoc's result - derived so no engine-internal
 *  type name has to be imported. */
type IconThemeDef = ReturnType<typeof parseIconThemesDoc>[number];

interface CliBridgeOpts {
  profile?: Profile;
  dom: { window: Window & typeof globalThis };
  /** The loaded manifest's `network.allowlist` - what host.net may fetch this
   *  run. Absent/empty ⇒ every host.net fetch rejects (same as the web shell). */
  networkAllowlist?: readonly string[];
  /**
   * The two upper rungs of the design-system resolution ladder (plans/97 section 6a)
   * for THIS run: `override` is `--designv=`/`?designv=`, `pin` is the tool
   * manifest's `designVersion`. The lower rungs (the catalog's active version,
   * then the edit head) are read off the head document's own ledger, so a caller
   * that passes nothing still resolves the same version the web shell would.
   */
  designVersion?: { override?: string | null; pin?: string | null };
  /**
   * Refuse `host.capture.page` targets a hosted process must never reach: only
   * http(s), no credentials, no loopback/link-local/private/multicast literals
   * (`assertPublicHttpUrl`). The MCP host sets it; a person's own CLI/TUI leaves
   * it off, since capturing your own localhost is a normal thing to do there.
   */
  capturePublicOnly?: boolean;
}

export async function createCliBridge(
  { profile = {}, dom, networkAllowlist, designVersion, capturePublicOnly = false }: CliBridgeOpts = {} as CliBridgeOpts,
): Promise<HostV1> {
  const w = dom.window;
  // Pre-load the asset catalog so query/get can be synchronous-ish.
  const assetCatalogPath = join(REPO_ROOT, 'catalog', 'assets', 'index.json');
  const assetIndex = JSON.parse(await readFile(assetCatalogPath, 'utf8')) as { assets: CatalogAsset[] };
  const assetById = new Map<string, CatalogAsset>(assetIndex.assets.map((a): [string, CatalogAsset] => [a.id, a]));

  const state = new Map<string, { data: object; updatedAt: string }>();

  const host = {
    version: '1',
    shell: 'cli',
    capabilities: CLI_CAPABILITIES,
    // EVERY level goes to stderr (contract B4). `info`/`debug` used to go to stdout,
    // where a tool's one chatty log line interleaved itself into a piped PNG - and
    // tools ship as data from another repository, so this shell cannot assume they are
    // quiet. stdout carries the payload and nothing else.
    log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object): void => {
      if (level === 'debug' && !process.env.DEBUG) return;
      process.stderr.write(`[${level}] ${msg}${ctx ? ' ' + JSON.stringify(ctx) : ''}\n`);
    },
    // The literal is built in stages below (profile, assets, state, export, …), so the
    // assertion is what tells TypeScript the finished object is a CliHost.
  } as unknown as CliHost;

  host.profile = {
    async get() { return profile; },
    subscribe() { return () => {}; },
  };

  // Deep image codecs (v1.100) - the same pure engine writers the web shell
  // wraps, so a tool that hands over a float frame encodes identically headless.
  // (No native deps; the writers are pure TypeScript.)
  host.codec = {
    png16: async (f, o) => encodePng16({ ...f, space: f.space ?? 'srgb-linear' }, o),
    exr: async (f, o) => encodeExr({ ...f, space: f.space ?? 'srgb-linear' }, o),
    radiance: async (f, o) => encodeRadiance({ ...f, space: f.space ?? 'srgb-linear' }, o),
    dither8: async (f, o) => encodeDither8({ ...f, space: f.space ?? 'srgb-linear' }, o),
  };

  // Layered-bitmap write-back (v1.102) - the same engine PSD writer the web
  // shell wraps, so `--export`ing a layered PSD is byte-identical headless.
  host.layers = {
    writePsd: async (doc) => {
      const { writePsd } = await import('../../../engine/src/psd-write.ts');
      const { CSS_TO_PSD_BLEND } = await import('../../../engine/src/raster-layers.ts');
      return writePsd({
        width: doc.width,
        height: doc.height,
        layers: doc.layers.map((l) => ({
          ...l,
          blend: (l.blend && Object.hasOwn(CSS_TO_PSD_BLEND, l.blend) ? l.blend : 'normal') as
            import('../../../engine/src/raster-layers.ts').CssBlendMode,
        })),
      });
    },
  };

  // Colour pairings for themable two-colour icons, from the catalog's palette
  // asset tagged "icon-themes". The in-flight promise is cached so N themed
  // refs resolving in parallel share one read per CLI invocation.
  let iconThemesCache: Promise<IconThemeDef[]> | null = null;
  function iconThemes(): Promise<IconThemeDef[]> {
    iconThemesCache ??= (async () => {
      const pal = [...assetById.values()].find(a => a.type === 'palette' && a.tags?.includes('icon-themes'));
      if (!pal) return [];
      const doc = JSON.parse(await readFile(join(REPO_ROOT, pal.formats[0]!.url.replace(/^\//, '')), 'utf8'));
      return parseIconThemesDoc(doc);
    })().catch(() => []); // unavailable ≠ broken: icons just stay default
    return iconThemesCache;
  }

  // Colour treatments for raster photos, from the catalog's palette asset tagged
  // "photo-treatments" - the raster analogue of iconThemes() above.
  let photoTreatmentsCache: Promise<ReturnType<typeof parsePhotoTreatmentsDoc>> | null = null;
  function photoTreatments(): Promise<ReturnType<typeof parsePhotoTreatmentsDoc>> {
    photoTreatmentsCache ??= (async () => {
      const pal = [...assetById.values()].find(a => a.type === 'palette' && a.tags?.includes('photo-treatments'));
      if (!pal) return [];
      const doc = JSON.parse(await readFile(join(REPO_ROOT, pal.formats[0]!.url.replace(/^\//, '')), 'utf8'));
      return parsePhotoTreatmentsDoc(doc);
    })().catch(() => []); // unavailable ≠ broken: photos just stay untreated
    return photoTreatmentsCache;
  }

  // Design tokens - the catalog's HEAD `type:'tokens'` asset, read from disk and
  // resolved by the engine per theme. Missing or unreadable → an empty set:
  // token-bound colour inputs fall back to their cached hex and the semantic
  // brand vars (applyBrandVars below) stay unset.
  //
  // "Head" is the descendant-exclusion rule of plans/97 section 6a, applied through the
  // ONE engine predicate the web bridge and the MCP tokens resource also call: a
  // published version ships as `<head>/<slug>`, and a version must never be
  // picked as "the design system". With zero or one tokens asset - every catalog
  // that never published, which is all of them today - `pickHeadAssetId` returns
  // exactly what the `.find(…)` here returned before the rule existed.
  const tokensAssets = assetIndex.assets.filter(a => a.type === 'tokens');
  const headTokensId = pickHeadAssetId(tokensAssets.map(a => a.id));
  const headTokensAsset = tokensAssets.find(a => a.id === headTokensId) ?? null;

  const readAssetDoc = async (asset: CatalogAsset): Promise<unknown> =>
    JSON.parse(await readFile(join(REPO_ROOT, asset.formats[0]!.url.replace(/^\//, '')), 'utf8'));

  let tokensDocCache: Promise<unknown> | null = null;
  let tokensDocRevision = '';
  /** The HEAD document - the edit head, `-latest`. Never a published version. */
  async function tokensDoc(): Promise<unknown> {
    const localRecord = await activeNodeDesignSystem().catch(() => null);
    const revision = localRecord ? `${localRecord.id}:${localRecord.updatedAt}` : 'catalog';
    if (revision !== tokensDocRevision) {
      tokensDocRevision = revision;
      tokensDocCache = null;
    }
    tokensDocCache ??= (async () => {
      // CLI and TUI share one editable Node-side head. A terminal system is an
      // override only when one is active; otherwise the mounted catalog remains
      // the exact source it was before the start experience existed.
      const local = localRecord ? await readActiveDesignSystemTokens() : null;
      if (local) return local;
      if (!headTokensAsset) return null;
      return readAssetDoc(headTokensAsset);
    })().catch(() => null); // unavailable ≠ broken: everything token-y just degrades
    return tokensDocCache;
  }

  /**
   * The document THIS run renders against: the section 6a ladder applied once, over the
   * head's own ledger - `--designv=` → the manifest pin → the catalog's active
   * version → the head.
   *
   * A catalog that never published carries no ledger, so this costs one empty
   * read and returns the head object itself: an unversioned install renders
   * byte-identically to before versions existed. A version that resolves has its
   * asset tokens rewritten through the entry's pins (`applyPinnedAssets`), which
   * is the same rewrite the web bridge does at load - so a `{asset.logo.*}` under
   * a pinned version reaches the preserved bytes here too.
   *
   * An unresolvable version degrades to the head rather than to a blank render,
   * and says so: an author who typed a slug and silently got a different design
   * system has the one failure this shell refuses to be quiet about.
   */
  async function resolvedDoc(): Promise<unknown> {
    return (async () => {
      const head = await tokensDoc();
      const index = readVersionIndex(head);
      const override = designVersion?.override ?? null;
      const slug = resolveDesignVersion({ override, pin: designVersion?.pin ?? null, index });
      // An override this catalog does not ship is ALWAYS said out loud, whatever
      // the ladder lands on next. Warning only when it fell all the way to the
      // head would swallow the typo whenever the tool carries a manifest pin: the
      // author asked for one version, silently got another, and the flag they
      // typed left no trace at all.
      if (override && override !== DESIGN_VERSION_LATEST && !index.versions.some(v => v.slug === override)) {
        host.log('warn', `--designv=${override} names no design-system version in this catalog - rendering against ${slug === DESIGN_VERSION_LATEST ? 'the edit head' : `"${slug}"`} instead.`);
      }
      if (slug === DESIGN_VERSION_LATEST) return head;
      const entry = index.versions.find(v => v.slug === slug);
      const asset = headTokensAsset ? assetById.get(versionAssetId(headTokensAsset.id, slug)) : undefined;
      if (!entry || !asset) {
        host.log('warn', `design-system version "${slug}" is listed but ships no tokens asset - rendering against the edit head instead.`);
        return head;
      }
      try {
        return applyPinnedAssets(await readAssetDoc(asset), entry.assets ?? []);
      } catch (e) {
        host.log('warn', `design-system version "${slug}" could not be read (${e instanceof Error ? e.message : e}) - rendering against the edit head instead.`);
        return head;
      }
    })().catch(() => tokensDoc());
  }

  const tokenSets = new Map<string, TokenSet>(); // revision + theme → resolved set
  async function tokenSet(theme?: string): Promise<TokenSet> {
    const localRecord = await activeNodeDesignSystem().catch(() => null);
    const revision = localRecord ? `${localRecord.id}:${localRecord.updatedAt}` : 'catalog';
    const key = `${revision}\0${theme ?? ''}`;
    let set = tokenSets.get(key);
    if (!set) { set = createTokenSet(await resolvedDoc(), { theme }); tokenSets.set(key, set); }
    return set;
  }
  host.tokens = {
    get: (opts = {}) => tokenSet(opts.theme),
    colors: async (opts = {}) => (await tokenSet(opts.theme)).colors(),
    resolve: async (ref, opts = {}) => (await tokenSet(opts.theme)).resolve(ref),
    themes: async () => (await tokenSet()).themes(),
    // Owner-side seam for the worker_threads hook executor: the raw DTCG doc it
    // snapshots into the worker so hooks resolve tokens without an RPC. Never a
    // hook-facing call (the worker core omits it from the proxy).
    raw: () => resolvedDoc(),
  } as typeof host.tokens;

  // Perceptual colour tools (v1.40) - pure engine math, attached verbatim
  // (same object the web bridge attaches, so shells can never drift).
  host.color = makeColorApi();

  // Vector geometry (v1.64) - the geometry kernel behind SVG path-data strings.
  // Pure engine math, attached verbatim (the SAME object the web bridge attaches),
  // so a pen-tool hook computes identical geometry headlessly.
  host.geom = makeGeomApi();

  // host.connectors (v1.106; path heads + dash fitting v1.110) - the engine's committed,
  // export-safe connector geometry, attached verbatim (the SAME factory the web bridge
  // calls via installToolApis), so a canvas tool's hooks.js renders identical connector
  // geometry, arrowheads and corner-fitted dashes in a headless `--export`.
  host.connectors = makeConnectorsApi();

  // host.text - text-to-path (HarfBuzz WASM), the SAME shaping the web shell uses, so a
  // tool that outlines text via host.text renders identically in the terminal. Without
  // it, brand-lockup (and any host.text-in-hooks tool) throws in onInit and emits an
  // empty SVG. Fonts resolve off disk under the repo root (see text.ts). Node-only fonts
  // are all sfnt; the WASM loads lazily on first shape.
  host.text = createNodeTextAPI({ repoRoot: REPO_ROOT });

  // host.audio (v1.71) - the SAME per-frame analysis the web shell runs (the engine's
  // analysePcm), so an audio-reactive tool draws identical frames headlessly. The
  // decoder is what differs and it is narrow on purpose: WAV plus our own ZzFXM
  // songs, with no shelling out to ffmpeg, so a headless render never silently
  // depends on whatever binary is on PATH. Anything needing a platform codec (mp3,
  // aac, opus) rejects by name - see packages/node-shell/src/audio.ts.
  host.audio = createNodeAudioAPI({ repoRoot: REPO_ROOT });

  // host.speech (v1.96 synthesis, v1.99 transcription) - the SAME Kokoro and Whisper
  // models the web shell runs, over transformers.js on the onnxruntime-node backend
  // instead of two Workers, so a narration hook renders headlessly and says the same
  // words at the same times. ATTACHED ONLY IF the runtime resolves, like host.images.
  // Models are READ, never fetched: one that is not staged refuses by name with the
  // `lolly models fetch <family>` command (packages/node-shell/src/speech.ts).
  const speech = createNodeSpeechAPI({});
  if (speech) host.speech = speech;

  // host.images - decode/resize/encode, backed by sharp (native codecs; reads HEIC/AVIF/
  // TIFF, writes the web-safe three). Without it a converter tool like convert-image can
  // only throw, which is what the CLI used to do. ATTACHED ONLY IF sharp resolves: the
  // contract is optional and tools feature-detect it, so absent is a defined state and
  // strictly better than a present-but-throwing stub.
  const images = createNodeImagesAPI();
  if (images) host.images = images;

  // The on-device ML utilities (plans/183 WS2) - host.upscale (v1.101),
  // host.matte (v1.103) and host.ocr (plans/125), over onnxruntime-node with
  // sharp for pixels. The MATHS is the web shell's own: the tiling, the letterbox
  // geometry, the CTC decode and the model rosters live in
  // packages/node-shell/src/ml/, which shells/web/src/lib/ imports too, so
  // `models()`/`modelBytes()` answer identically on both and a tool sees one
  // catalogue. ATTACHED ONLY IF the runtimes resolve, like host.images; models
  // are READ off disk and never fetched, so a model that is not there refuses by
  // name with the `lolly models fetch <family>` command.
  //
  // The other three families in that directory (ai-detect, reword, depth) have no
  // HostV1 member today - the web shell reaches them as libs, not bridge methods
  // - so they are CLI subcommands only and nothing is invented on the bridge.
  const upscale = createNodeUpscaleAPI();
  if (upscale) host.upscale = upscale;
  const matte = createNodeMatteAPI();
  if (matte) host.matte = matte;
  const ocr = createNodeOcrAPI();
  if (ocr) host.ocr = ocr;

  // host.scan (v1.153, plans/162 Part 2) - on-device code reader via zxing-wasm.
  // Gives the CLI `lolly scan photo.png` and gives CI a real decoder for the
  // round-trip suite. Optional/additive, like host.images: a reader tool feature-
  // detects it. Zero network - the wasm is loaded from disk (see node-shell/scan).
  host.scan = createNodeScanAPI();

  // host.net - allowlisted fetch for tools that declared the 'network' capability,
  // built per-invocation from the loaded manifest's network.allowlist (callers thread
  // it in via CliBridgeOpts). Deny happens before any I/O, so an empty/absent allowlist
  // means the API exists but every fetch rejects - identical fail-closed stance to web.
  host.net = createNetAPI({ allowlist: networkAllowlist });

  host.assets = {
    // v1.183: bytes behind a ref. This bridge inlines catalog files as data:
    // urls, so most reads never touch the disk; http(s) rides the tool's own
    // allowlist through host.net, never an open fetch.
    bytes: (target) => assetBytes(target, { netFetch: (url) => (host.net ? host.net.fetch(url) : Promise.reject(new Error('no host.net'))) }),
    async resolveProvider(ref) {
      if (ref.provider === 'catalog' || ref.provider === 'library') {
        try { return await host.assets.get([ref.scope, ref.path].filter(Boolean).join('/')); } catch { return null; }
      }
      if (ref.provider === 'image' && ref.scope === 'brand') {
        const slot = ref.path || 'logo';
        const matches = await host.assets.query({ tags: [slot] });
        const picked = matches[0] ?? (slot === 'logo' ? (await host.assets.query({ tags: ['logo'] }))[0] : undefined);
        if (!picked) return null;
        try { return await host.assets.get(picked.id); } catch { return null; }
      }
      return null;
    },
    async get(id, opts = {}) {
      // A PROCEDURAL asset: `zzfxm:<seed>[:<style>]` names a song that is
      // synthesised on demand, not a file the catalog stores. It resolves to
      // ITSELF - url === id - exactly as the web bridge does, so a headless render
      // of a project carries the same bed marker a browser render does. Without
      // it the engine's resolveOne throws "Asset not in catalog", nulls the field
      // before hooks run, and the bed silently disappears from the output.
      // The CLI cannot synthesise the audio (no Web Audio), but dropping the ref
      // would be a different document, not a smaller one.
      if (isZzfxmRef(id)) {
        const ref = parseZzfxmRef(id);
        if (!ref) throw new Error(`Malformed procedural audio ref: ${id}`);
        const canonical = formatZzfxmRef(ref);
        return {
          source: 'library', id: canonical, type: 'audio', format: 'zzfxm', url: canonical,
          meta: { name: 'Generated music', generated: true, seed: ref.seed, ...(ref.style ? { style: ref.style } : {}) },
        };
      }
      // A DIRECT URL as the asset id (same contract as the web bridge, Andy
      // 2026-08-28): `data:` inline bytes pass through as-is (jsdom reads a
      // data: img src natively); an http(s) file is fetched and inlined to a
      // data: URL so the render needs no second network trip. This is the
      // agent path - `lolly frame --image=https://…/logo.png`. No CSP applies
      // here; a failed fetch throws and resolveOne drops the asset with its
      // logged warning, exactly as on the web.
      if (/^data:/i.test(id)) {
        const mime = /^data:([^;,]+)/i.exec(id)?.[1] ?? '';
        const kind = urlAssetKind(mime, id);
        if (!kind) throw new Error(`Unsupported data: asset type: ${mime || 'unknown'}`);
        return { source: 'remote', id, type: kind.type, format: kind.format, url: id };
      }
      if (/^https?:\/\//i.test(id)) {
        const res = await fetch(id, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`URL asset fetch failed (${res.status}): ${id}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') ?? '';
        const kind = urlAssetKind(mime, id);
        if (!kind) throw new Error(`Unsupported URL asset type (${mime || 'unknown'}): ${id}`);
        return { source: 'remote', id, type: kind.type, format: kind.format, url: `data:${mime.split(';')[0] || 'application/octet-stream'};base64,${buf.toString('base64')}` };
      }
      // A presentation modifier can ride in the id, baked in at resolve time
      // (same contract as the web bridge). An id carries at most one:
      //   `<baseId>?theme=<themeId>` - themable two-colour icon pairing
      //   `<baseId>?treatment=<id>` - raster photo colour treatment
      const { baseId: themedBase, theme } = parseThemedAssetId(id);
      const { baseId: treatedBase, treatment } = parseTreatedAssetId(id);
      const baseId = theme ? themedBase : treatedBase;
      const meta = assetById.get(baseId);
      if (!meta) throw new Error(`Asset not in catalog: ${baseId}`);
      if (opts.version && opts.version !== meta.version) throw new Error(`Asset version unavailable: ${baseId} (${opts.version})`);
      // Lottie entries list the animation (json) plus a static poster variant;
      // tools always want the animation regardless of listing order (mirrors the
      // web bridge's pickFormat).
      const fmt = opts.format ? meta.formats.find(f => f.format === opts.format) : meta.type === 'lottie'
        ? (meta.formats.find(f => f.format === 'json') ?? meta.formats[0]!)
        : meta.formats[0]!;
      if (!fmt) throw new Error(`Asset format unavailable: ${baseId} (${opts.format})`);
      const localPath = join(REPO_ROOT, fmt.url.replace(/^\//, ''));
      let buf = await readFile(localPath);
      // For palette JSON, embed swatches in meta for templates to use.
      let extraMeta: Record<string, unknown> = { name: meta.name, tags: meta.tags };
      if (meta.type === 'palette' && fmt.format === 'json') {
        try {
          const parsed = JSON.parse(buf.toString('utf8'));
          extraMeta = { ...extraMeta, ...parsed };
        } catch {}
      }
      if (theme) {
        const def = (await iconThemes()).find(t => t.id === theme);
        const baked = def ? applyIconTheme(buf.toString('utf8'), def) : null;
        if (baked) {
          buf = Buffer.from(baked, 'utf8');
          extraMeta = { ...extraMeta, theme, baseId };
        }
        // Unknown theme / non-themable file → plain bytes under the requested
        // id (kept so a temporarily unresolvable theme isn't stripped from
        // persisted state - same contract as the web bridge).
      }
      if (treatment && meta.type === 'raster') {
        const def = (await photoTreatments()).find(t => t.id === treatment);
        // Fall back to a sibling format's dims when the primary format omits them
        // (jpg entries usually do) - otherwise the bake no-ops and the untreated
        // photo is served. Same reasoning as the web bridge.
        const dimSrc = (fmt.width && fmt.height) ? fmt : meta.formats.find(f => f.width && f.height);
        const w = dimSrc?.width, h = dimSrc?.height;
        if (def && w && h) {
          const href = `data:${mimeFor(fmt.format)};base64,${buf.toString('base64')}`;
          const svg = wrapRasterWithTreatment({ href, width: w, height: h, treatment: def });
          return {
            source: 'library',
            id,
            type: meta.type,
            format: fmt.format,
            url: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
            version: meta.version,
            checksum: fmt.checksum,
            meta: { ...extraMeta, treatment, baseId },
          };
        }
        // Unknown/invalid treatment or missing dimensions → plain bytes.
      }
      // jsdom doesn't have URL.createObjectURL by default; encode as data URL.
      const mime = mimeFor(fmt.format);
      const url = `data:${mime};base64,${buf.toString('base64')}`;
      return {
        source: 'library',
        id,
        type: meta.type,
        format: fmt.format,
        url,
        version: meta.version,
        checksum: fmt.checksum,
        meta: extraMeta,
      };
    },
    async query(filter = {}) {
      return Array.from(assetById.values())
        .filter(m => matchesFilter(m, filter))
        .map((m): AssetRef => ({
          source: 'library',
          id: m.id,
          type: m.type,
          format: m.formats[0]?.format ?? 'svg',
          url: '',
          version: m.version,
          meta: { name: m.name, tags: m.tags, _placeholder: true },
        }));
    },
    async pick() {
      throw new Error('Asset picker not available in CLI mode - list ids with `lolly assets [query]` and pass one to the asset input (e.g. --logo=suse/logo/hor-pos-green)');
    },
    async isAvailable(id) {
      return assetById.has(parseThemedAssetId(id).baseId);
    },

    // The user-image library (device upload → downscale → IndexedDB) is a GUI
    // concern. The CLI is ephemeral and headless, so it has no user images - 
    // these stubs keep the internal surface consistent with the web bridge.
    async _listUserAssets() { return []; },
    async _userAssetsCount() { return 0; },
    async _userAssetsSize() { return 0; },
    async _deleteUserAsset() { /* no-op: no user images in CLI */ },
  };

  // host.state - the saved-session files this machine already has, in the layout the
  // desktop app writes: <state dir>/saved-state/<token>.json (plans/202 WP3.1). So a
  // session saved in the desktop app or the TUI loads here by slot.
  //
  // READS see that directory always. WRITES still need the environment to name one
  // (contract section 1.5/B14): a headless render must not drop files into the desktop
  // app's store, or anywhere else in $HOME, that nobody asked for (non-goal section 8.7).
  // With no directory named, a save stays in the per-run memory map, exactly as before.
  const stateHome = resolveStateDir();
  const stateReadDir = stateHome.dir;
  const stateWriteDir = stateHome.explicit ? stateHome.dir : null;
  host.state = {
    async save(slot, data) {
      state.set(slot, { data, updatedAt: new Date().toISOString() });
      if (stateWriteDir) await writeSessionRecord(stateWriteDir, { slot, data: data as SessionData });
    },
    async load(slot) {
      const hit = state.get(slot);
      if (hit) return hit.data;
      return await loadSessionData(stateReadDir, slot);
    },
    async list() {
      const slots = new Set(state.keys());
      for (const slot of await listSessionSlots(stateReadDir)) slots.add(slot);
      return Array.from(slots).map(slot => ({ slot })) as StateEntry[];
    },
    async delete(slot) {
      state.delete(slot);
      if (stateWriteDir) await deleteSessionRecord(stateWriteDir, slot);
    },
  };

  // The clipboard keeps throwing (shelling out to pbcopy/xclip is a non-goal), but the
  // throw is now CLASSIFIED: exit 3, "impossible in this installation", naming the way
  // out. It is not a bug and it is not a usage error (contract section 4.4).
  const noClipboard = (): never => {
    throw unavailableHere(
      'The clipboard is not available in the CLI - write the result with --output=<path> (or --output=- for stdout) instead.',
      'CAPABILITY_UNAVAILABLE',
    );
  };
  host.clipboard = {
    async writeText() { return noClipboard(); },
    async writeImage() { return noClipboard(); },
  };

  // CLI export covers everything producible without a layout/paint engine:
  //   • text / data - html, svg, json, csv, ics, vcf (the engine hydrates these)
  // Raster (png/jpg/webp/avif/ico), pdf/pdf-cmyk, zip and video need a real
  // browser engine (jsdom has no layout), so they're produced by the web shell
  // or the Tauri-bundled CLI (which ships a WebView) - a deliberate decision, not
  // a TODO: the node CLI stays dependency-light rather than bundling Chromium.
/**
 * The tool's OWN root `<svg>`, or null when the tool draws in HTML.
 *
 * The vector formats below (svg / emf / eps / dxf) are CLI-native only for tools whose
 * template IS an `<svg>` - a browser-free vector path with no layout engine. The old
 * test for that was `node.querySelector('svg')`, which finds ANY descendant, and that
 * is wrong now that an HTML-layout tool can contain one: Design's vector path
 * boxes emit an inline `<svg><path>` per shape, so a poster with one pen shape used to
 * export as that ONE shape, with the artboard, the background and every other box
 * silently dropped - a plausible-looking wrong file, which is worse than a refusal.
 *
 * So: descend only through wrappers that have exactly one drawable child (scripts and
 * styles don't count - several native-svg tools ship a template script beside their
 * `<svg>`). A container with two drawable children is a LAYOUT, not a wrapper, and the
 * answer is null → the caller raises "needs a browser engine", which is the truth.
 *
 * `[data-export-hide]` elements are also not counted: they are explicitly detached
 * from every export (the web raster path drops them the same way), so a native-<svg>
 * tool may sit an editor-only sibling next to its `<svg>` - e.g. qr-code's
 * scannability warnings (plans/162) - without forfeiting its browser-free vector
 * path. The hidden sibling is never in the exported bytes: only the `<svg>` is.
 */
const NON_DRAWABLE = new Set(['script', 'style', 'template', 'link', 'meta']);
function rootSvgOf(node: Element | null): Element | null {
  let cur: Element | null = node;
  for (let depth = 0; cur && depth < 8; depth++) {
    if (cur.tagName?.toLowerCase() === 'svg') return cur;
    const kids = Array.from(cur.children).filter(
      (el) => !NON_DRAWABLE.has(el.tagName.toLowerCase()) && !el.hasAttribute('data-export-hide'),
    );
    if (kids.length !== 1) return null;
    cur = kids[0] ?? null;
  }
  return null;
}

  host.export = {
    async render(node: Element, format: string, opts: CliExportRenderOpts = {}): Promise<Blob> {
      // Data/text formats: the engine already hydrated the payload (JSON from the
      // model, ICS/VCF/CSV from a sibling text template). The host just wraps it.
      if (opts.dataText !== undefined) {
        return new Blob([opts.dataText], { type: opts.dataMime ?? 'text/plain' });
      }
      // Strip the markers annotateTemplate leaves (plans/222) so every deliverable is
      // clean: data-canvas-input is web-edit-only, data-lolly-paint an intermediate,
      // and a data-lolly-bind is meaningful ONLY to the penpot export - kept there so
      // an inherited colour binds, removed everywhere else. One-shot node, safe to mutate.
      if (typeof node?.querySelectorAll === 'function') {
        const strip = (attr: string): void => {
          if (node.hasAttribute?.(attr)) node.removeAttribute(attr);
          node.querySelectorAll(`[${attr}]`).forEach((el) => { el.removeAttribute(attr); });
        };
        strip('data-canvas-input');
        strip('data-lolly-paint');
        if (format !== 'penpot') strip('data-lolly-bind');
      }
      if (format === 'html') {
        // Strip any template <script> (editor-runtime helpers - e.g. a canvas
        // auto-resize hook) before serialising: the exported markup is static, and
        // the web shell's HTML export (renderStaticHtml) does the same. Clone so the
        // live node is left untouched.
        const clone = node.cloneNode(true) as Element;
        clone.querySelectorAll('script').forEach((el) => el.remove());
        return new Blob([clone.outerHTML], { type: 'text/html' });
      }
      if (format === 'svg' || format === 'svgz') {
        const svg = rootSvgOf(node);
        if (!svg) {
          throw new Error('SVG export requires the template\'s root drawable to be an <svg> (HTML-layout tools need a browser engine - use the desktop app or the web shell)');
        }
        // Honour requested dimensions (incl. physical units like "210mm"): set
        // width/height in the unit and ensure a px viewBox so it scales.
        const dw = parseDimension(opts.width);
        const dh = parseDimension(opts.height);
        if (dw || dh) {
          if (!svg.getAttribute('viewBox')) {
            const vw = dw ? toCssPx(dw) : (parseFloat(svg.getAttribute('width') as string) || 0);
            const vh = dh ? toCssPx(dh) : (parseFloat(svg.getAttribute('height') as string) || 0);
            if (vw && vh) svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
          }
          if (dw) svg.setAttribute('width', toCssLength(dw));
          if (dh) svg.setAttribute('height', toCssLength(dh));
        }
        // TEXT AS PATHS (contract section 6a). Every other vector format this shell writes
        // (emf/eps/dxf) already outlines through the same host.text; svg kept live
        // <text>, so a recipient without the font silently got a different design.
        // `--text=live` (opts.text) is the documented opt-out for anyone who wants an
        // editable SVG; a run whose font cannot be resolved keeps its <text> and warns,
        // because unlike EMF, SVG can represent live text and a hard failure on the
        // everyday format would be worse than a warned fallback.
        if (opts.text !== 'live') {
          const res = await outlineSvgText(svg, host, {
            getComputedStyle: w.getComputedStyle ? (el: Element) => { try { return w.getComputedStyle(el); } catch { return null; } } : null,
          });
          for (const f of res.fallbacks) opts.onTextFallback?.(f);
        }
        const raw = w.XMLSerializer
          ? new w.XMLSerializer().serializeToString(svg)
          : svg.outerHTML;
        const xml = injectSvgMeta(raw, opts.meta); // embed authorship provenance
        const full = '<?xml version="1.0" standalone="no"?>\n' + xml;
        if (format === 'svgz') {
          // SVGZ is literally gzip(SVG) - same provenance-bearing markup, ~60-70%
          // smaller. gunzip on read recovers the identical bytes.
          const gz = gzip(new TextEncoder().encode(full));
          return new Blob([gz as BlobPart], { type: 'image/svg+xml' });
        }
        return new Blob([full], { type: 'image/svg+xml' });
      }
      if (format === 'emf') {
        // EMF is pure bytes built from SVG primitives - no rasteriser needed, so
        // it joins svg as a CLI-native format for native-<svg> tools. Text default
        // INVERTS the other vector formats' (contract section 6a note): a plain
        // <text> run stays LIVE - a real GDI font + string record, editable in
        // Office / Google Drawings, no host.text needed - and only runs GDI text
        // can't express (tracking, features, stroke, skew) are outlined via
        // host.text (createNodeTextAPI above), where an unresolvable family still
        // throws. `--text=outline` forces the old always-text-as-paths output.
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('EMF export requires an <svg> in the template (HTML-layout tools need a browser engine - use the desktop app)');
        const ir = await svgDomToIr(svg, { host, resolveFont: cliResolveFont(host), background: opts.background, textMode: opts.text === 'outline' ? 'outline' : 'live' });
        const bytes = emitEmf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi });
        // application/x-msmetafile, not RFC 7903 image/emf - Google Drive only
        // opens metafiles in Google Drawings/Slides under the legacy type.
        return new Blob([bytes as BlobPart], { type: 'application/x-msmetafile' });
      }
      if (format === 'penpot') {
        // A Penpot design file (plans/178). Like emf/eps this is pure bytes over the
        // tool's own <svg> - no rasteriser, no browser - so `--export=penpot` works
        // headless for every SVG-native tool. The ENGINE owns all of it (the lowering,
        // the schema, the token filter); this branch only serialises the DOM, reads the
        // brand off host.tokens and zips what comes back.
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('Penpot export requires an <svg> in the template (HTML-layout tools need a browser engine - use the desktop app)');
        const svgText = w.XMLSerializer ? new w.XMLSerializer().serializeToString(svg) : svg.outerHTML;
        const name = opts.meta?.tool?.trim() || 'From Lolly';
        // The brand: the SAME two reads the web shell's penpot-brand.ts makes - the raw
        // multi-set token document (which is already Penpot's own tokens.json shape) and
        // the resolved swatches for the file's Assets tab. Typographies are a web-shell
        // font-role read and are simply absent here; the archive is valid without them.
        const palette = (await tokenSet()).colors()
          .filter(c => typeof c.value === 'string' && /^#[0-9a-f]{6,8}$/i.test(c.value))
          .map(c => ({ name: c.name || c.path, path: c.group ?? undefined, color: c.value }));
        const shared = { name, tokens: await resolvedDoc(), palette, generatedBy: `lolly/${ENGINE_VERSION}` };
        // The engine's notes sink: the reasons a lowering declined survive its null return.
        const why: string[] = [];
        const lowered = svgToPenpotDoc(svgText, { ...shared, background: opts.background, notes: why });
        // A `data:` <image> is decoded by the engine itself; anything else would need a
        // fetch, and an unresolved placeholder is simply not added - the writer drops an
        // image shape whose media is missing and says so in its warnings.
        let doc = lowered?.doc;
        if (!doc) {
          // Nothing Penpot has a construct for: keep the SVG whole as one picture on
          // one board, so a lowering that declines never costs fidelity.
          //
          // AND SAY SO. The lowering's own `notes` ride the result it declined to
          // return, so this branch is the only place the flatten can be reported at
          // all - without this line, `--export=penpot` on a render carrying one
          // `<filter>` exits 0, prints nothing, and hands back an uneditable picture
          // to someone who asked for an editable document. The archive is valid and
          // loses no fidelity, so this is a warning and not a failure.
          host.log('warn', 'penpot: the render was kept whole as one picture, not lowered to editable shapes - '
            + (why.length ? why.join('; ') : 'something in it (a filter, mask, clip path, pattern, <use> or inline <style>) has no Penpot construct')
            + '. The board carries the whole SVG as one image, so nothing is lost, but the shapes are not separable in Penpot.');
          const bytes = new TextEncoder().encode(svgText);
          const size = imageDimensions(bytes, 'image/svg+xml') ?? { w: 1000, h: 1000 };
          doc = imageToPenpotDoc(
            { id: penpotUuid(), name, mtype: 'image/svg+xml', width: size.w, height: size.h, bytes },
            { ...shared, background: opts.background },
          );
        }
        // Each top-level board becomes a reusable component (plans/222), so the
        // browser-free native-SVG export matches the Tier-B web-shell one.
        markToolComponents(doc, name);
        const build = buildPenpotEntries(doc);
        for (const note of lowered?.notes ?? []) host.log('warn', `penpot: ${note}`);
        for (const wmsg of build.warnings) host.log('warn', `penpot: ${wmsg}`);
        const files: Record<string, Uint8Array> = {};
        const enc = new TextEncoder();
        for (const [path, content] of Object.entries(build.entries)) {
          files[path] = typeof content === 'string' ? enc.encode(content) : content;
        }
        return new Blob([zipSync(files) as BlobPart], { type: PENPOT_MIME });
      }
      if (format === 'eps' || format === 'eps-cmyk') {
        // EPS is vector PostScript built from the same SVG IR as EMF - text is
        // outlined upstream (svgDomToIr shapes live <text> via host.text; an
        // unresolvable family throws), so the emitter writes no fonts. eps-cmyk
        // is naive DeviceCMYK: no embedded output intent (same as the web shell).
        //
        // The brand cmykPalette IS threaded now, through the SAME shared builder
        // the web shell's three CMYK sinks use (engine/src/cmyk-palette.ts). It
        // used to be omitted here, which made the finish fix web-only: a brand
        // declaring a Gold spot with finish 'foil' got a naive
        // rgb→cmyk gold build out of `lolly … --export=eps-cmyk`, silently, with
        // nothing in the file saying so. A finish now resolves to
        // FINISH_MASK_CMYK here exactly as it does in the browser.
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('EPS export requires an <svg> in the template (HTML-layout tools need a browser engine - use the desktop app)');
        const ir = await svgDomToIr(svg, { host, resolveFont: cliResolveFont(host), background: opts.background, label: 'EPS' });
        const text = emitEps(ir, {
          width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi,
          cmyk: format === 'eps-cmyk',
          ...(format === 'eps-cmyk' ? { cmykPalette: await brandCmykPalette(host) } : {}),
          meta: opts.meta as { title?: string } | undefined,
        });
        return new Blob([text], { type: 'application/postscript' });
      }
      if (format === 'dxf') {
        // DXF is the same SVG-IR path as EMF/EPS - a fourth sink on svgDomToIr, so a
        // native-<svg> tool exports vector CAD DXF browser-free (no 150MB Chromium for
        // what is fundamentally text). Text is outlined upstream (host.text present).
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('DXF export requires an <svg> in the template (HTML-layout tools need a browser engine - use the desktop app)');
        const ir = await svgDomToIr(svg, { host, resolveFont: cliResolveFont(host), background: opts.background, label: 'DXF' });
        const { text } = emitDxf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi });
        return new Blob([text], { type: 'image/vnd.dxf' });
      }
      if (format === 'wmf') {
        // WMF is the 16-bit ancestor of EMF - a fifth sink on the SAME svgDomToIr
        // vector path, wired identically. Text is outlined upstream (host.text
        // present; an unresolvable family throws - the text-as-paths guard). The
        // metadata flag is accepted for call-site symmetry but is a no-op: WMF has
        // no comment record to carry a source URL.
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('WMF export requires an <svg> in the template (HTML-layout tools need a browser engine - use the desktop app)');
        const ir = await svgDomToIr(svg, { host, resolveFont: cliResolveFont(host), background: opts.background, label: 'WMF' });
        const bytes = emitWmf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi });
        // Same legacy metafile type as EMF above - Drive's Drawings import
        // matches application/x-msmetafile for WMF too.
        return new Blob([bytes as BlobPart], { type: 'application/x-msmetafile' });
      }
      if (format === 'exr' || format === 'hdr') {
        // The pro float formats (plans/61-deeprichpixels.md section 6 B3, surfaced CLI-first per
        // section 10 item 4): the engine's own OpenEXR / Radiance writers over a resvg raster
        // of THIS tool's SVG. Browser-free, so they belong on this side of the tier
        // split rather than in raster.ts's Tier B.
        //
        // Two refusals, in order, both loud (their wording deliberately avoids run.ts's
        // "fall back to HTML" signature - a pro-format request must never quietly
        // become a .html file):
        //   1. no root <svg> → this tool needs layout, which jsdom cannot do;
        //   2. no `hdr=` → the raster is 8-bit sRGB and float would be padding.
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('EXR/HDR export needs the template\'s root drawable to be a vector image (HTML-layout tools have no browser-free raster here - use the desktop app or the web shell)');
        const raw = w.XMLSerializer ? new w.XMLSerializer().serializeToString(svg) : svg.outerHTML;
        // Lazy: pulls in resvg (a native module) and the engine's EXR/Radiance writers
        // only when a pro format is actually asked for.
        const { renderDeepRaster, deepFormatMime } = await import('../../../packages/node-shell/src/raster.ts');
        // Physical units convert through the engine's own unit maths at the export
        // DPI, exactly like every other CLI format (--width=210 --unit=mm --dpi=300).
        const dpi = opts.dpi ?? 300;
        const px = (v: string | number | undefined, fallback: number): number => {
          const d = parseDimension(v);
          return d ? Math.max(1, Math.round(toPixels(d, dpi))) : fallback;
        };
        const { bytes, mime } = await renderDeepRaster({
          svg: raw,
          width: px(opts.width, parseFloat(svg.getAttribute('width') as string) || 1280),
          height: px(opts.height, parseFloat(svg.getAttribute('height') as string) || 720),
          format,
          hdr: opts.hdr ?? null,
          depth: opts.depth,
          log: (level, message) => host.log(level, message),
        });
        return new Blob([bytes as BlobPart], { type: mime || deepFormatMime(format) });
      }
      if (format === 'bmp') {
        // BMP joins exr/hdr as a browser-free raster: the engine's own encoder over a
        // resvg raster of THIS tool's SVG (no Chromium). Uncompressed Windows Bitmap - 
        // the escape hatch for a legacy/embedded consumer that can't read a PNG. The
        // Lolly pixel Imprint is embedded by default (BMP has no metadata box for a
        // C2PA manifest, so the in-pixel mark is its only provenance); --imprint=0
        // resolves opts.imprint to false and it is skipped.
        const svg = rootSvgOf(node);
        if (!svg) throw new Error('BMP export requires an <svg> in the template (HTML-layout tools need a browser engine - use the desktop app)');
        const raw = w.XMLSerializer ? new w.XMLSerializer().serializeToString(svg) : svg.outerHTML;
        const { rasterizeSvgToBmp } = await import('../../../packages/node-shell/src/raster.ts');
        const dpi = opts.dpi ?? 300;
        const px = (v: string | number | undefined, fallback: number): number => {
          const d = parseDimension(v);
          return d ? Math.max(1, Math.round(toPixels(d, dpi))) : fallback;
        };
        const bytes = await rasterizeSvgToBmp(
          raw,
          px(opts.width, parseFloat(svg.getAttribute('width') as string) || 1280),
          px(opts.height, parseFloat(svg.getAttribute('height') as string) || 720),
          { imprint: opts.imprint !== false },
        );
        return new Blob([bytes as BlobPart], { type: 'image/bmp' });
      }
      // The remedy list is NODE_FORMATS itself, not a hand-kept copy of it: the two
      // drifted, so the message offered formats the engine no longer claims and omitted
      // `md`, which works. A remedy a reader cannot act on is worse than no remedy.
      const { NODE_FORMATS } = await import('../../../packages/node-shell/src/raster.ts');
      throw new Error(`CLI shell does not support format "${format}" (needs a browser engine). Use one of the browser-free formats (${NODE_FORMATS.join(', ')}), a pro float format (exr, hdr - with hdr=1), install the render tier with \`lolly install-browser\`, or run the Tauri-bundled CLI for raster/pdf/zip.`);
    },
    async download() {
      throw new Error('CLI cannot trigger a browser download - pipe the blob to a file via --output');
    },
    // Transform-path delivery has no browser download in the CLI; the runner
    // (run.js) writes the exportFile bytes to --output / stdout directly. This
    // stub keeps the bridge surface complete and fails clearly if a hook calls it.
    async file() {
      throw new Error('CLI delivers transformed files via --output (run.js writes the bytes), not host.export.file');
    },
    // Seal files a tool holds into a Linux package (plan 197 M5). Real in the CLI:
    // it returns the package bytes, which the tool's exportFile hook returns and
    // run.js writes to --output. The engine owns the format.
    async pack(spec: import('@lolly-tools/core').ExportPackSpec): Promise<Uint8Array> {
      const { buildLinuxPack, buildHomeTarball } = await import('@lolly/engine');
      if (spec.target === 'tar.gz') return buildHomeTarball(spec.files ?? []);
      return buildLinuxPack({
        type: spec.type,
        meta: { ...spec.meta },
        ...(spec.fonts ? { fonts: spec.fonts } : {}),
        ...(spec.foundry ? { foundry: spec.foundry } : {}),
        ...(spec.appstream ? { appstream: spec.appstream } : {}),
        ...(spec.icons ? { icons: spec.icons } : {}),
        ...(spec.files ? { files: spec.files } : {}),
      });
    },
    // The pixel Imprint / durable mark are a raster+canvas enhancement; the lean
    // headless CLI has no rasteriser, so it returns the bytes unchanged (progressive
    // enhancement, per the host.export.imprint contract). The C2PA credential - the
    // portable mark - is still applied by host.c2pa.sign either way.
    async imprint(bytes: Uint8Array): Promise<Uint8Array> { return bytes; },
  };

  // Page capture - navigate a URL in the scoped Chromium and read back its pixels. The
  // CLI ships the same browsers.ts as the TUI, so this is now real (not a stub): a tool
  // that calls host.capture.page in a hook works when a browser is installed, and gets a
  // clear, actionable BrowserError (`lolly install-browser`) when it isn't. Mirrors the
  // TUI bridge. (url-shot's EXPORT is routed straight to captureUrl in run.ts, bypassing
  // this - but this fulfils the 'capture' capability for the hook + non-CLI callers.)
  host.capture = {
    async page(spec) {
      const { bytes, mime } = await captureUrl(
        {
          url: spec.url, scrollDepth: spec.scrollDepth ?? 0, waitMs: spec.waitMs ?? 500,
          css: spec.css ?? '',
          cropLeft: spec.crop?.left ?? 0, cropRight: spec.crop?.right ?? 0,
          cropTop: spec.crop?.top ?? 0, cropBottom: spec.crop?.bottom ?? 0,
          recolor: 'none', tintColor: '#111111', hue: 0,   // recolor 'none' ⇒ tint unused
          zoom: 1,                                          // zoom rides in spec.css (html{zoom:…})
        },
        'png',
        { width: spec.width, height: spec.height ?? spec.width, dpi: (spec.dpr ?? 1) * 96 },
        { publicOnly: capturePublicOnly },
      );
      const url = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
      return { source: 'remote', id: `capture:${spec.url}`, type: 'raster', format: 'png', url, width: spec.width, height: spec.height };
    },
  };

  // PDF metadata inspect + strip. Unlike raster/PDF *rendering* (which needs a
  // browser engine), metadata surgery is pure pdf-lib, which runs fine in node -
  // so the lean CLI can clean PDFs too.
  host.pdf = createPdfAPI();

  // pdf.redact + pdf.pages (plan 183 WS4) - the two PdfAPI members that REBUILD
  // PIXELS. They used to be web-only, so `lolly redact` on a PDF escalated a black
  // rectangle into a 200 MB Chromium. The page render is the app's own interpreter
  // (the engine's interpretPdfPage → pdfNodesToSvg) rasterised by resvg, and the
  // bars are burned by @napi-rs/canvas over the SAME shared maths the web half uses
  // (packages/node-shell/src/pdf-redact-core.ts), so a bar covers identical pixels
  // on both. ATTACHED ONLY IF the canvas package resolves - the contract makes both
  // members optional per method precisely so a shell can lack them, and a tool
  // feature-detects `host.pdf?.redact` rather than assuming.
  const pdfCanvas = createNodePdfRedact();
  if (pdfCanvas) {
    host.pdf.redact = pdfCanvas.redact;
    host.pdf.pages = pdfCanvas.pages;
  }

  // host.raster (v1.105) - the realm-portable raster primitives, over the same
  // canvas. `canRaster()` is the sync probe a tool branches on before deciding what
  // to render, and it now answers honestly here instead of being absent (which every
  // hook reads as "headless, refuse"). Conditional for the same reason as above.
  const raster = createNodeRasterAPI();
  if (raster) host.raster = raster;

  // host.c2pa.sign (v1.85; widened v1.104) - freshly sign a manifest into finished
  // bytes. The engine's embedC2pa is DOM-free, so the lean CLI signs exactly like the
  // web shell: the any-media authorship path (author/©/licence over an existing file,
  // nested manifests preserved as ingredients) and the redact derivative path. Ephemeral
  // on-device signer by default; an enrolled identity (env/config) fixes the window.
  host.c2pa = {
    async sign(bytes: Uint8Array, format: string, opts: C2paSignOpts = {}): Promise<Uint8Array> {
      if (!C2PA_FORMATS.includes(format)) throw new Error(`no C2PA container for '${format}'`);
      const imported = opts.action === 'imported'
        || (opts.action == null && (opts.author != null || opts.rights != null || (opts.ingredients?.length ?? 0) > 0));
      // Explicit artist-asserted author/rights win; else the profile identity, gated by
      // the same "Use my details" opt-in the render path (buildExportC2paOpts) uses.
      const author = opts.author != null
        ? (typeof opts.author === 'string' ? (opts.author.trim() ? { name: opts.author.trim() } : undefined) : opts.author)
        : (profile.useDetails === true && profile.firstname
          ? { name: [profile.firstname, profile.lastname].filter(Boolean).join(' '), ...(profile.email ? { email: profile.email } : {}) }
          : undefined);
      const rights = opts.rights != null ? (opts.rights.trim() || undefined) : undefined;
      const actions = imported
        ? [{ action: 'c2pa.metadata', description: opts.description || 'Author, copyright and licence embedded' },
           ...(opts.imprinted ? [{ action: 'c2pa.edited', description: 'Embedded a durable Lolly pixel watermark' }] : [])]
        : (() => { const a = exportActionSteps(format, {}); a.splice(1, 0, { action: 'c2pa.redacted', description: opts.description || 'Covered content removed and the file rebuilt' }); return a; })();
      // Additive by construction: with nothing configured resolveSigningIdentity
      // returns null and the ephemeral self-signed signer applies, unchanged.
      let identity: { signer: unknown; notBefore: Date; notAfter: Date } | null = null;
      try {
        const { resolveSigningIdentity } = await import('@lolly-tools/node-shell/signing-identity');
        identity = await resolveSigningIdentity({});
      } catch { /* no identity configured - ephemeral */ }
      return await embedC2pa(bytes, format, {
        title: opts.title || 'Embed, Imprint & Track',
        claimGenerator: 'Lolly lolly.tools',
        generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
        ...(author ? { author } : {}),
        ...(rights ? { rights } : {}),
        actions,
        ...(opts.ingredients?.length ? { ingredients: opts.ingredients } : {}),
        ...(identity
          ? { signer: identity.signer as never, dates: { notBefore: identity.notBefore, notAfter: identity.notAfter } }
          : { dates: { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) } }),
      });
    },
    async readIngredients(bytes: Uint8Array) {
      try { return collectIngredients(bytes); } catch { return []; }
    },
  };

  // PPTX deck inspect + rebrand. The web impl already isolates its two host
  // dependencies (fflate zip codec, injectable XML parser), so the CLI reuses
  // it wholesale - jsdom's DOMParser stands in for the browser's.
  host.pptx = createPptxAPI({ parseXml: (xml) => new w.DOMParser().parseFromString(xml, 'application/xml') });

  // Compose - render another tool to an embeddable asset (tool composition).
  // The lean node CLI has no rasteriser, so it composes only children that export
  // to svg/data (same stance as host.export above) - a raster child throws and the
  // runtime omits that slot gracefully. Result is a data: URL (jsdom has no
  // URL.createObjectURL). Mirrors run.js's render path (hydrate into a node →
  // host.export.render), with watermark/provenance suppressed (intermediate asset).
  const composeFetchFile = async (p: string): Promise<string> => readFile(join(REPO_ROOT, 'tools', p), 'utf8');
  host.compose = {
    async render(spec) {
      const { toolId, inputs = {}, format, width, height, unit, dpi, _stack = [] } = (spec ?? {}) as ComposeSpec;
      if (typeof toolId !== 'string' || !toolId) throw new Error('compose: missing toolId');
      assertComposeStack(_stack, toolId); // engine-owned cycle/depth policy, shared with every shell
      const childTool = await loadTool(toolId, composeFetchFile);
      // Pass the ANCESTOR stack (_stack), not `path`: createRuntime re-appends the
      // child's id, so `path` would double-count and hit the depth guard early.
      const childRuntime = await createRuntime(childTool, host, inputs as Parameters<typeof createRuntime>[2], { composeStack: _stack });
      const el = w.document.createElement('div');
      el.innerHTML = childRuntime.getHydrated();
      // Compose children get the same brand vars as the top-level canvas
      // (plans/archive/brand-token-contract.md section 3 injection rules). For html-format
      // children the wrapper div (with its inline vars) is what's serialised;
      // the svg serialiser excludes the wrapper root, so standalone svg
      // children still rely on their var() fallbacks (accepted class).
      await applyBrandVars(el, host);
      const fmt = format ?? childTool.manifest.render.formats[0]!;
      // Honour requested dimensions - host.export (CLI svg) parses a unit-qualified
      // width/height via parseDimension; px passes through as a number.
      const u = unit || 'px';
      const qual = (v: number | null | undefined): string | number | undefined => (typeof v === 'number' && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
      const blob = await host.export.render(el, fmt as ExportFormat, { width: qual(width), height: qual(height), dpi, embedMeta: false, watermark: false });
      const buf = Buffer.from(await blob.arrayBuffer());
      return {
        source: 'remote',
        id: `compose:${toolId}`,
        type: fmt === 'svg' ? 'vector' : 'raster',
        format: fmt,
        url: `data:${mimeFor(fmt)};base64,${buf.toString('base64')}`,
      };
    },

    // Render a pasted/stored Lolly tool URL to an AssetRef whose id is the
    // canonical embed URL - the same contract as the web bridge, so a tool-sourced
    // asset re-resolves in CLI/headless runs too (svg works; a raster child throws
    // and the caller leaves the slot empty, matching host.compose.render's stance).
    async renderUrl(url, opts = {}) {
      const parsed = parseToolUrl(url);
      if (!parsed) return null;
      let childTool!: Awaited<ReturnType<typeof loadTool>>;
      try { childTool = await loadTool(parsed.toolId, composeFetchFile); } catch { return null; }
      // A pasted link may carry packed state (`?z=…`); expand before parsing. The
      // embed id below is minted from the EXPANDED query too - the packed query's
      // only param is the reserved `z`, which gets stripped, so a packed link would
      // otherwise render (and persist) as all defaults. Same as the web bridge.
      const query = await expandQuery(parsed.query);
      const st = parseUrlState(query, childTool.manifest);
      const supported = (childTool.manifest.render?.formats ?? []).map(f => String(f).toLowerCase());
      const norm = (f: string | null | undefined) => { const x = String(f || '').toLowerCase(); return x === 'jpeg' ? 'jpg' : x; };
      const format = norm(opts.format) || norm(parsed.format)
        || (supported.includes('svg') ? 'svg' : supported[0]);
      const width = opts.width ?? st.width ?? undefined;
      const height = opts.height ?? st.height ?? undefined;
      const unit = opts.unit ?? st.unit ?? undefined;
      const dpi = opts.dpi ?? st.dpi ?? undefined;
      let ref!: AssetRef;
      try {
        ref = await host.compose!.render({
          toolId: parsed.toolId, inputs: st.values,
          format: format as ExportFormat, width, height, unit, dpi, _stack: opts._stack ?? [],
        });
      } catch { return null; }
      if (!ref) return null;
      const q = new URLSearchParams(query);
      for (const k of RESERVED) q.delete(k);
      if (width) q.set('w', String(width));
      if (height) q.set('h', String(height));
      if (unit && unit !== 'px') { q.set('unit', String(unit)); if (dpi) q.set('dpi', String(dpi)); }
      const id = buildEmbedUrl({ toolId: parsed.toolId, format, query: q.toString() });
      // No re-parseable identity (too long) → don't persist a dead slot: a
      // `compose:<toolId>` id can't re-resolve on load (same stance as the web
      // bridge). meta.toolUrl carries the canonical id - it is what drives the
      // live-edit UI and what baking records as provenance (meta.bakedFrom).
      if (!id) return null;
      return {
        ...ref,
        id,
        meta: { ...(ref.meta || {}), tool: parsed.toolId, name: childTool.manifest.name ?? parsed.toolId, toolUrl: id },
      };
    },
  };

  return host;
}

// The seven semantic colour slots → namespaced CSS custom properties on the
// canvas root (plans/archive/brand-token-contract.md section 3): `--brand-primary` …
// `--brand-edge`. Reserved --brand-font/--brand-font-text are NOT set yet
// (font rung is a later pass).
const BRAND_VAR_SLOTS = ['primary', 'on-primary', 'secondary', 'surface', 'text', 'muted', 'edge'] as const;

/**
 * Resolve the active brand's semantic colour slots (`color.semantic.*`) via
 * host.tokens and set them as CSS custom properties (`--brand-primary`,
 * `--brand-surface`, …) on the element the tool template hydrates into - the
 * CLI half of the web shell's applyBrandVars, so a semantic-var template
 * renders identically via web, URL mode, and CLI. TokenSet.resolve takes the
 * alias form ({path}) and bare dotted paths under the same rule, so one call
 * covers both. A missing tokens asset or an unresolvable slot sets nothing
 * (never ''), leaving the template's own fallbacks
 * (`var(--brand-primary, #4f83cc)`) in charge.
 */
export async function applyBrandVars(el: HTMLElement, host: HostV1): Promise<void> {
  if (!host.tokens) return;
  for (const slot of BRAND_VAR_SLOTS) {
    let value: unknown;
    try { value = await host.tokens.resolve(`{color.semantic.${slot}}`); } catch { continue; }
    // A string passes through as resolved (oklch()/hex are both valid CSS) - 
    // unless it is alias residue: a `{path}` that never resolved is a missing
    // slot, not a colour (contract section 3), so it sets nothing. Any structured
    // DTCG colour form is normalised to hex by the engine.
    const css = typeof value === 'string' && value
      ? (isAlias(value) ? null : value)
      : colorToHex(value);
    if (css) el.style.setProperty(`--brand-${slot}`, css);
  }
}

// Embed authorship provenance as <title>/<desc> + a Dublin-Core <metadata> block
// right after the opening <svg> tag (mirrors the web bridge's injectSvgMeta).
function injectSvgMeta(xml: string, meta: ExportMeta | undefined): string {
  if (!meta) return xml;
  const e = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines: string[] = [];
  if (meta.tool) lines.push(`<title>${e(meta.tool)}</title>`);
  const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
  if (desc) lines.push(`<desc>${e(desc)}</desc>`);
  lines.push(
    '<metadata>',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<rdf:Description rdf:about="">',
  );
  if (meta.author) lines.push(`<dc:creator>${e(meta.author)}</dc:creator>`);
  lines.push(`<dc:publisher>${e(meta.software)}</dc:publisher>`);
  lines.push(`<dc:source>${e(meta.source)}</dc:source>`, '</rdf:Description>', '</rdf:RDF>', '</metadata>');
  const m = xml.match(/<svg\b[^>]*?>/);
  if (!m) return xml;
  const at = m.index! + m[0]!.length;
  return xml.slice(0, at) + '\n' + lines.join('\n') + xml.slice(at);
}

function matchesFilter(meta: CatalogAsset, filter: AssetQuery): boolean {
  if (filter.type && meta.type !== filter.type) return false;
  if (filter.namespace && !meta.id.startsWith(filter.namespace + '/') && meta.id !== filter.namespace) return false;
  if (filter.tags?.length) {
    const tags = new Set(meta.tags ?? []);
    if (!filter.tags.every(t => tags.has(t))) return false;
  }
  if (!filter.includeDeprecated && meta.deprecated) return false;
  return true;
}

function mimeFor(format: string): string {
  switch (format) {
    case 'svg': case 'svgz': return 'image/svg+xml';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    // Legacy Windows-metafile type rather than RFC 7903 image/emf|image/wmf:
    // it's the only MIME Google Drive opens in Google Drawings/Slides.
    case 'emf': case 'wmf': return 'application/x-msmetafile';
    case 'eps': case 'eps-cmyk': return 'application/postscript';
    // A .penpot archive IS a zip, but never says so: application/zip is what makes a
    // shell rename the download to .zip, and Penpot's Import wants the .penpot name.
    case 'penpot': return PENPOT_MIME;
    // Pro float formats (plans/61-deeprichpixels.md section 6 B3). `image/x-exr` is the de-facto
    // OpenEXR type (never IANA-registered); `image/vnd.radiance` IS registered for RGBE.
    case 'exr': return 'image/x-exr';
    case 'hdr': return 'image/vnd.radiance';
    case 'json': return 'application/json';
    default: return 'application/octet-stream';
  }
}

/**
 * The brand palette as a CMYK substitution map, for the CLI's eps-cmyk sink.
 *
 * Built through the ENGINE's `buildCmykPaletteMap` - the same one the web
 * shell's PDF/TIFF/EPS sinks use - so a declared finish resolves to
 * `FINISH_MASK_CMYK` in the terminal exactly as it does in the browser. Before
 * this existed the CLI passed no palette at all, so the finish fix stopped at
 * the shell boundary and `lolly wordmark --export=eps-cmyk` still converted a
 * declared foil into its plausible swatch gold, silently.
 *
 * Total: a brand with no tokens, an unreadable tokens doc or a throwing
 * `host.tokens.colors()` yields an empty map, which is byte-identical to the
 * previous behaviour (every colour falls through to the generic conversion).
 */
async function brandCmykPalette(host: HostV1): Promise<Map<string, { cmyk: [number, number, number, number] }>> {
  try {
    const colors = await host.tokens?.colors?.();
    if (!Array.isArray(colors) || colors.length === 0) return new Map();
    return buildCmykPaletteMap(colors.map(c => ({
      hex: c.value,
      ...(Array.isArray(c.cmyk) ? { cmyk: c.cmyk } : {}),
      label: c.name,
      spot: c.spot ?? null,
    })));
  } catch {
    return new Map();
  }
}
