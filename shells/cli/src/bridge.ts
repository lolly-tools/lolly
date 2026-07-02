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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JSDOM } from 'jsdom';
import { parseDimension, toCssLength, toCssPx, loadTool, createRuntime, emitEmf, emitEps, parseToolUrl, buildEmbedUrl, parseUrlState, RESERVED } from '@lolly/engine';
import type { HostV1, Profile, AssetRef, ExportFormat, ExportOpts, ExportMeta, ExportAPI, InputValue } from '@lolly/engine';
import type {
  AssetsAPI, AssetQuery, StateAPI, StateEntry, ClipboardAPI, CaptureAPI, PdfAPI,
  ComposeAPI, ComposeSpec,
} from '../../../engine/src/bridge/host-v1.ts';
// PDF metadata inspect/strip is pure pdf-lib (no DOM), so the lean node CLI
// shares the web shell's implementation rather than duplicating it.
import { createPdfAPI } from '../../web/src/bridge/pdf.ts';
// SVG→EMF IR walk is DOM-light (attribute reads), so it runs under jsdom for
// native-SVG tools — the same "no layout engine" constraint as the svg branch.
import { svgDomToIr } from '../../web/src/bridge/svg-ir.ts';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** One resolvable file for a catalog asset (an entry in CatalogAsset.formats). */
interface CatalogAssetFormat {
  format: string;
  url: string;
  checksum?: string;
}

/** A catalog/assets/index.json entry — produced by scripts/build-catalog-index.ts. */
interface CatalogAsset {
  id: string;
  name: string;
  type: AssetRef['type'];
  version: string;
  tags?: string[];
  deprecated?: boolean;
  formats: CatalogAssetFormat[];
}

interface CatalogIndex {
  assets: CatalogAsset[];
}

/**
 * The tool-facing v1 ExportOpts, plus the data/text payload fields
 * runtime.ts's buildDataPayload spreads in for json/csv/ics/vcf formats (see
 * runtime.export). Mirrors shells/web/src/bridge/export/types.ts's ExportOptions —
 * ExportOpts itself only documents the DOM-render path.
 */
interface CliExportOpts extends ExportOpts {
  dataText?: string;
  dataMime?: string;
}

/** The CLI's assets surface: HostV1's AssetsAPI plus the underscore-prefixed
 *  user-image stubs the web bridge also exposes (kept for surface parity —
 *  the CLI is ephemeral and headless, so it has no user images to list). */
interface CliAssetsAPI extends AssetsAPI {
  _listUserAssets(): Promise<AssetRef[]>;
  _userAssetsCount(): Promise<number>;
  _userAssetsSize(): Promise<number>;
  _deleteUserAsset(): Promise<void>;
}

/** In-memory record backing host.state — save() takes a plain `object` per
 *  StateAPI, so nothing here can assume the runtime's `__toolId`/`__toolVersion`
 *  markers are present. */
interface CliStateRecord {
  data: object;
  updatedAt: string;
}

/**
 * The CLI's HostV1 slice, typed honestly: every capability it actually
 * implements (profile/assets/state/clipboard/export/log, plus the optional
 * pdf/capture/compose additions), narrowed from the full v1 surface. net,
 * tokens, text, and media stay unimplemented — see the module doc comment
 * above each unsupported branch below.
 */
interface CliHost extends HostV1 {
  shell: 'cli';
  assets: CliAssetsAPI;
  export: ExportAPI;
  pdf: PdfAPI;
  capture: CaptureAPI;
  compose: ComposeAPI;
}

export interface CreateCliBridgeOpts {
  profile?: Profile;
  dom: JSDOM;
}

export async function createCliBridge(opts: CreateCliBridgeOpts): Promise<CliHost> {
  const { profile = {}, dom } = opts;
  const w = dom.window;
  // Pre-load the asset catalog so query/get can be synchronous-ish.
  const assetCatalogPath = join(REPO_ROOT, 'catalog', 'assets', 'index.json');
  const assetIndexRaw: unknown = JSON.parse(await readFile(assetCatalogPath, 'utf8'));
  // JSON trust boundary: build-catalog-index.ts produced this file to the
  // CatalogIndex shape — this assertion records that fact.
  const assetIndex = assetIndexRaw as CatalogIndex;
  const assetById = new Map(assetIndex.assets.map(a => [a.id, a]));

  const state = new Map<string, CliStateRecord>();

  const composeFetchFile = async (p: string): Promise<string> => readFile(join(REPO_ROOT, 'tools', p), 'utf8');

  const host: CliHost = {
    version: '1',
    shell: 'cli',
    log: (level, msg, ctx) => {
      const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
      out.write(`[${level}] ${msg}${ctx ? ' ' + JSON.stringify(ctx) : ''}\n`);
    },

    profile: {
      async get() { return profile; },
      subscribe() { return () => {}; },
    },

    assets: {
      async get(id) {
        const meta = assetById.get(id);
        if (!meta) throw new Error(`Asset not in catalog: ${id}`);
        const fmt = meta.formats[0];
        if (!fmt) throw new Error(`Asset ${id} has no formats`);
        const localPath = join(REPO_ROOT, fmt.url.replace(/^\//, ''));
        const buf = await readFile(localPath);
        // For palette JSON, embed swatches in meta for templates to use.
        let extraMeta: Record<string, unknown> = { name: meta.name, tags: meta.tags };
        if (meta.type === 'palette' && fmt.format === 'json') {
          try {
            const parsed: unknown = JSON.parse(buf.toString('utf8'));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              // JSON trust boundary: catalog palette documents are build-authored.
              extraMeta = { ...extraMeta, ...(parsed as Record<string, unknown>) };
            }
          } catch { /* malformed palette JSON: keep name/tags only */ }
        }
        // jsdom doesn't have URL.createObjectURL by default; encode as data URL.
        const mime = mimeFor(fmt.format);
        const url = `data:${mime};base64,${buf.toString('base64')}`;
        return {
          source: 'library',
          id: meta.id,
          type: meta.type,
          format: fmt.format,
          url,
          version: meta.version,
          checksum: fmt.checksum,
          meta: extraMeta,
        };
      },
      async query(filter: AssetQuery = {}) {
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
        throw new Error('Asset picker not available in CLI mode — pass asset ids via URL params instead');
      },
      async isAvailable(id) {
        return assetById.has(id);
      },

      // The user-image library (device upload → downscale → IndexedDB) is a GUI
      // concern. The CLI is ephemeral and headless, so it has no user images —
      // these stubs keep the internal surface consistent with the web bridge.
      async _listUserAssets() { return []; },
      async _userAssetsCount() { return 0; },
      async _userAssetsSize() { return 0; },
      async _deleteUserAsset() { /* no-op: no user images in CLI */ },
    },

    state: {
      async save(slot, data) { state.set(slot, { data, updatedAt: new Date().toISOString() }); },
      async load(slot) { return state.get(slot)?.data ?? null; },
      async list(): Promise<StateEntry[]> {
        // In-memory only: the CLI tracks no toolId/toolVersion per slot (save()
        // takes a plain `object`), so those fields are reported empty rather
        // than invented — matching what the JS implementation actually knew.
        return Array.from(state.entries()).map(([slot, rec]) => ({
          slot, toolId: '', toolVersion: '', updatedAt: rec.updatedAt,
        }));
      },
      async delete(slot) { state.delete(slot); },
    },

    clipboard: {
      async writeText() { throw new Error('Clipboard unavailable in CLI; use --output instead'); },
      async writeImage() { throw new Error('Clipboard unavailable in CLI; use --output instead'); },
    },

    // CLI export covers everything producible without a layout/paint engine:
    //   • text / data — html, svg, json, csv, ics, vcf (the engine hydrates these)
    // Raster (png/jpg/webp/avif/ico), pdf/pdf-cmyk, zip and video need a real
    // browser engine (jsdom has no layout), so they're produced by the web shell
    // or the Tauri-bundled CLI (which ships a WebView) — a deliberate decision, not
    // a TODO: the node CLI stays dependency-light rather than bundling Chromium.
    export: {
      async render(node: Element, format: ExportFormat, opts: CliExportOpts = {}) {
        // Data/text formats: the engine already hydrated the payload (JSON from the
        // model, ICS/VCF/CSV from a sibling text template). The host just wraps it.
        if (opts.dataText !== undefined) {
          return new Blob([opts.dataText], { type: opts.dataMime ?? 'text/plain' });
        }
        if (format === 'html') {
          return new Blob([node.outerHTML], { type: 'text/html' });
        }
        if (format === 'svg') {
          const svg = node.querySelector('svg') ?? node;
          if (svg.tagName.toLowerCase() !== 'svg') {
            throw new Error('SVG export requires an <svg> in the template');
          }
          // Honour requested dimensions (incl. physical units like "210mm"): set
          // width/height in the unit and ensure a px viewBox so it scales.
          const dw = parseDimension(opts.width);
          const dh = parseDimension(opts.height);
          if (dw || dh) {
            if (!svg.getAttribute('viewBox')) {
              const vw = dw ? toCssPx(dw) : (parseFloat(svg.getAttribute('width') ?? '') || 0);
              const vh = dh ? toCssPx(dh) : (parseFloat(svg.getAttribute('height') ?? '') || 0);
              if (vw && vh) svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
            }
            if (dw) svg.setAttribute('width', toCssLength(dw));
            if (dh) svg.setAttribute('height', toCssLength(dh));
          }
          const raw = w.XMLSerializer
            ? new w.XMLSerializer().serializeToString(svg)
            : svg.outerHTML;
          const xml = injectSvgMeta(raw, opts.meta); // embed authorship provenance
          return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
        }
        if (format === 'emf') {
          // EMF is pure bytes built from SVG primitives — no rasteriser needed, so
          // it joins svg as a CLI-native format for native-<svg> tools. Text must
          // already be outlined: the lean CLI has no host.text, so svgDomToIr throws
          // on any live <text> (the always-text-as-paths guard surfaced as an error).
          const svg = node.querySelector('svg') ?? (node.tagName.toLowerCase() === 'svg' ? node : null);
          if (!svg) throw new Error('EMF export requires an <svg> in the template (HTML-layout tools need a browser engine — use the desktop app)');
          const ir = await svgDomToIr(svg, { host, background: opts.background });
          // opts.unit has no counterpart in ExportOpts (units travel embedded in
          // the width/height string, e.g. "210mm") — this was always undefined;
          // omitted rather than fabricated. See the eps branch below for the same.
          const bytes = emitEmf(ir, { width: opts.width, height: opts.height, dpi: opts.dpi });
          return new Blob([new Uint8Array(bytes)], { type: 'image/emf' });
        }
        if (format === 'eps' || format === 'eps-cmyk') {
          // EPS is vector PostScript built from the same SVG IR as EMF — text is
          // outlined upstream (svgDomToIr throws on live <text>, as the lean CLI
          // has no host.text), so the emitter writes no fonts. eps-cmyk is naive
          // DeviceCMYK (no embedded output intent), same as the web shell.
          const svg = node.querySelector('svg') ?? (node.tagName.toLowerCase() === 'svg' ? node : null);
          if (!svg) throw new Error('EPS export requires an <svg> in the template (HTML-layout tools need a browser engine — use the desktop app)');
          const ir = await svgDomToIr(svg, { host, background: opts.background, label: 'EPS' });
          // emitEps's `meta.title` has no counterpart in ExportOpts's ExportMeta
          // (tool/software/author/…, no `title` field) — this was always a no-op
          // (never emitted a DSC %%Title: line); omitted rather than fabricated.
          const text = emitEps(ir, { width: opts.width, height: opts.height, dpi: opts.dpi, cmyk: format === 'eps-cmyk' });
          return new Blob([text], { type: 'application/postscript' });
        }
        throw new Error(`CLI shell does not support format "${format}" (needs a browser engine). Use a text/data format (html, svg, emf, eps, json, csv, ics, vcf), or run the Tauri-bundled CLI for raster/pdf/zip.`);
      },
      async download() {
        throw new Error('CLI cannot trigger a browser download — pipe the blob to a file via --output');
      },
      // Transform-path delivery has no browser download in the CLI; the runner
      // (run.ts) writes the exportFile bytes to --output / stdout directly. This
      // stub keeps the bridge surface complete and fails clearly if a hook calls it.
      async file() {
        throw new Error('CLI delivers transformed files via --output (run.ts writes the bytes), not host.export.file');
      },
    },

    // Page capture needs a real, authoritative browser engine — navigate a URL and
    // read back its pixels. The lean node CLI ships no browser (mirroring its raster
    // stance above), so capture is fulfilled by the Tauri-bundled CLI (WebView) or a
    // headless-Chromium build. Stub here so 'capture'-capability tools fail clearly
    // rather than with an undefined-property error.
    capture: {
      async page() {
        throw new Error('Page capture needs a browser engine — unavailable in the node CLI. Use the desktop app, or a headless-Chromium build.');
      },
    },

    // PDF metadata inspect + strip. Unlike raster/PDF *rendering* (which needs a
    // browser engine), metadata surgery is pure pdf-lib, which runs fine in node —
    // so the lean CLI can clean PDFs too.
    pdf: createPdfAPI(),

    // Compose — render another tool to an embeddable asset (tool composition).
    // The lean node CLI has no rasteriser, so it composes only children that export
    // to svg/data (same stance as host.export above) — a raster child throws and the
    // runtime omits that slot gracefully. Result is a data: URL (jsdom has no
    // URL.createObjectURL). Mirrors run.ts's render path (hydrate into a node →
    // host.export.render), with watermark/provenance suppressed (intermediate asset).
    compose: {
      async render(spec: ComposeSpec): Promise<AssetRef> {
        const { toolId, inputs = {}, format, width, height, unit, dpi, _stack = [] } = spec ?? {};
        if (typeof toolId !== 'string' || !toolId) throw new Error('compose: missing toolId');
        const path = [..._stack, toolId];
        if (_stack.includes(toolId)) throw new Error(`cycle ${path.join(' → ')}`);
        if (_stack.length >= 3) throw new Error(`max compose depth (${path.join(' → ')})`);
        const childTool = await loadTool(toolId, composeFetchFile);
        // ComposeSpec.inputs is deliberately host-contract-loose (Record<string,
        // unknown>: callers outside the runtime may assemble inputs from anywhere).
        // createRuntime's own manifest-driven input model coerces/validates each
        // value on the way in, so this narrowing reflects an already-enforced
        // invariant rather than an unchecked cast (mirrors bridge/compose.ts).
        const values = inputs as Record<string, InputValue>;
        // Pass the ANCESTOR stack (_stack), not `path`: createRuntime re-appends the
        // child's id, so `path` would double-count and hit the depth guard early.
        const childRuntime = await createRuntime(childTool, host, values, { composeStack: _stack });
        const el = w.document.createElement('div');
        el.innerHTML = childRuntime.getHydrated();
        const fmt = format ?? childTool.manifest.render.formats[0];
        if (!fmt) throw new Error(`compose: tool "${toolId}" declares no render formats`);
        // Honour requested dimensions — host.export (CLI svg) parses a unit-qualified
        // width/height via parseDimension; px passes through as a number.
        const u = unit || 'px';
        const qual = (v: number | undefined) => (v && v > 0 ? (u !== 'px' ? `${v}${u}` : v) : undefined);
        // childTool.manifest.render.formats is host-contract-loose (`string[]`, the
        // schema's opaque enum), a superset of host-v1's tool-facing ExportFormat;
        // it flows unmodified into host.export.render, whose actual format handling
        // covers every value this catalog of tools ever declares, so this narrowing
        // changes no runtime behavior.
        const blob = await host.export.render(el, fmt as ExportFormat, { width: qual(width), height: qual(height), dpi, embedMeta: false, watermark: false });
        const buf = Buffer.from(await blob.arrayBuffer());
        return {
          source: 'remote' as const,
          id: `compose:${toolId}`,
          type: fmt === 'svg' ? 'vector' as const : 'raster' as const,
          format: fmt,
          url: `data:${mimeFor(fmt)};base64,${buf.toString('base64')}`,
        };
      },

      // Render a pasted/stored Lolly tool URL to an AssetRef whose id is the
      // canonical embed URL — the same contract as the web bridge, so a tool-sourced
      // asset re-resolves in CLI/headless runs too (svg works; a raster child throws
      // and the caller leaves the slot empty, matching host.compose.render's stance).
      async renderUrl(url, opts = {}) {
        const parsed = parseToolUrl(url);
        if (!parsed) return null;
        let childTool;
        try { childTool = await loadTool(parsed.toolId, composeFetchFile); } catch { return null; }
        const st = parseUrlState(parsed.query, childTool.manifest);
        const supported = (childTool.manifest.render?.formats ?? []).map(f => String(f).toLowerCase());
        const norm = (f: string | null | undefined) => { const x = String(f || '').toLowerCase(); return x === 'jpeg' ? 'jpg' : x; };
        const format = norm(opts.format) || norm(parsed.format)
          || (supported.includes('svg') ? 'svg' : supported[0]);
        if (!format) return null;
        const width = opts.width ?? st.width ?? undefined;
        const height = opts.height ?? st.height ?? undefined;
        const unit = opts.unit ?? st.unit ?? undefined;
        const dpi = opts.dpi ?? st.dpi ?? undefined;
        let ref;
        try {
          ref = await host.compose.render({
            toolId: parsed.toolId, inputs: st.values,
            format: format as ExportFormat, width, height, unit, dpi, _stack: opts._stack ?? [],
          });
        } catch { return null; }
        if (!ref) return null;
        const q = new URLSearchParams(parsed.query);
        for (const k of RESERVED) q.delete(k);
        if (width) q.set('w', String(width));
        if (height) q.set('h', String(height));
        if (unit && unit !== 'px') { q.set('unit', String(unit)); if (dpi) q.set('dpi', String(dpi)); }
        const id = buildEmbedUrl({ toolId: parsed.toolId, format, query: q.toString() });
        return { ...ref, id: id ?? ref.id };
      },
    },
  };

  return host;
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
  if (!m || m.index === undefined) return xml;
  const at = m.index + m[0].length;
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
    case 'svg': return 'image/svg+xml';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'emf': return 'image/emf';
    case 'eps': case 'eps-cmyk': return 'application/postscript';
    case 'json': return 'application/json';
    default: return 'application/octet-stream';
  }
}
