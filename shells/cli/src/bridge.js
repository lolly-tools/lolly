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
import { parseDimension, toCssLength, toCssPx } from '@lolly/engine';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export async function createCliBridge({ profile = {}, dom } = {}) {
  const w = dom.window;
  // Pre-load the asset catalog so query/get can be synchronous-ish.
  const assetCatalogPath = join(REPO_ROOT, 'catalog', 'assets', 'index.json');
  const assetIndex = JSON.parse(await readFile(assetCatalogPath, 'utf8'));
  const assetById = new Map(assetIndex.assets.map(a => [a.id, a]));

  const state = new Map();

  const host = {
    version: '1',
    shell: 'cli',
    log: (level, msg, ctx) => {
      const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
      out.write(`[${level}] ${msg}${ctx ? ' ' + JSON.stringify(ctx) : ''}\n`);
    },
  };

  host.profile = {
    async get() { return profile; },
    subscribe() { return () => {}; },
  };

  host.assets = {
    async get(id) {
      const meta = assetById.get(id);
      if (!meta) throw new Error(`Asset not in catalog: ${id}`);
      const fmt = meta.formats[0];
      const localPath = join(REPO_ROOT, fmt.url.replace(/^\//, ''));
      const buf = await readFile(localPath);
      // For palette JSON, embed swatches in meta for templates to use.
      let extraMeta = { name: meta.name, tags: meta.tags };
      if (meta.type === 'palette' && fmt.format === 'json') {
        try {
          const parsed = JSON.parse(buf.toString('utf8'));
          extraMeta = { ...extraMeta, ...parsed };
        } catch {}
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
    async query(filter = {}) {
      return Array.from(assetById.values())
        .filter(m => matchesFilter(m, filter))
        .map(m => ({
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
  };

  host.state = {
    async save(slot, data) { state.set(slot, { data, updatedAt: new Date().toISOString() }); },
    async load(slot) { return state.get(slot)?.data ?? null; },
    async list() { return Array.from(state.keys()).map(slot => ({ slot })); },
    async delete(slot) { state.delete(slot); },
  };

  host.clipboard = {
    async writeText() { throw new Error('Clipboard unavailable in CLI; use --output instead'); },
    async writeImage() { throw new Error('Clipboard unavailable in CLI; use --output instead'); },
  };

  // CLI export covers everything producible without a layout/paint engine:
  //   • text / data — html, svg, json, csv, ics, vcf (the engine hydrates these)
  // Raster (png/jpg/webp/avif/ico), pdf/pdf-cmyk, zip and video need a real
  // browser engine (jsdom has no layout), so they're produced by the web shell
  // or the Tauri-bundled CLI (which ships a WebView) — a deliberate decision, not
  // a TODO: the node CLI stays dependency-light rather than bundling Chromium.
  host.export = {
    async render(node, format, opts = {}) {
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
            const vw = dw ? toCssPx(dw) : (parseFloat(svg.getAttribute('width')) || 0);
            const vh = dh ? toCssPx(dh) : (parseFloat(svg.getAttribute('height')) || 0);
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
      throw new Error(`CLI shell does not support format "${format}" (needs a browser engine). Use a text/data format (html, svg, json, csv, ics, vcf), or run the Tauri-bundled CLI for raster/pdf/zip.`);
    },
    async download() {
      throw new Error('CLI cannot trigger a browser download — pipe the blob to a file via --output');
    },
    // Transform-path delivery has no browser download in the CLI; the runner
    // (run.js) writes the exportFile bytes to --output / stdout directly. This
    // stub keeps the bridge surface complete and fails clearly if a hook calls it.
    async file() {
      throw new Error('CLI delivers transformed files via --output (run.js writes the bytes), not host.export.file');
    },
  };

  // Page capture needs a real, authoritative browser engine — navigate a URL and
  // read back its pixels. The lean node CLI ships no browser (mirroring its raster
  // stance above), so capture is fulfilled by the Tauri-bundled CLI (WebView) or a
  // headless-Chromium build. Stub here so 'capture'-capability tools fail clearly
  // rather than with an undefined-property error.
  host.capture = {
    async page() {
      throw new Error('Page capture needs a browser engine — unavailable in the node CLI. Use the desktop app, or a headless-Chromium build.');
    },
  };

  return host;
}

// Embed authorship provenance as <title>/<desc> + a Dublin-Core <metadata> block
// right after the opening <svg> tag (mirrors the web bridge's injectSvgMeta).
function injectSvgMeta(xml, meta) {
  if (!meta) return xml;
  const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = [];
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
  const at = m.index + m[0].length;
  return xml.slice(0, at) + '\n' + lines.join('\n') + xml.slice(at);
}

function matchesFilter(meta, filter) {
  if (filter.type && meta.type !== filter.type) return false;
  if (filter.namespace && !meta.id.startsWith(filter.namespace + '/') && meta.id !== filter.namespace) return false;
  if (filter.tags?.length) {
    const tags = new Set(meta.tags ?? []);
    if (!filter.tags.every(t => tags.has(t))) return false;
  }
  if (!filter.includeDeprecated && meta.deprecated) return false;
  return true;
}

function mimeFor(format) {
  switch (format) {
    case 'svg': return 'image/svg+xml';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'json': return 'application/json';
    default: return 'application/octet-stream';
  }
}
