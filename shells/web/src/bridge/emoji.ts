// SPDX-License-Identifier: MPL-2.0
/**
 * The web host's pinned emoji packs: one catalog bundle asset in, exact manifest and
 * artwork bytes out.
 *
 * Two kinds of pack live here and they are stored differently. A pack the catalog
 * serves is catalog material: its file sits in the catalog cache, it is shared by
 * every document and it never enters a person's uploads. A pack a person imported, or
 * a document brought with it, is theirs and lives in their uploads.
 */
import type { AssetRef, EmojiAPI } from '@lolly-tools/core/host-v1';
import { EMOJI_BUNDLE_MAX_BYTES } from '@lolly-tools/core/emoji-v1';
import type { EmojiGlyphV1, EmojiPackBundleV1, EmojiPackPinV1, EmojiSetInfoV1 } from '@lolly-tools/core/emoji-v1';
import { storeEmojiBundle, userEmojiRefs, type EmojiStorage, writeOnce } from './emoji-storage.ts';
import { admitEmojiBundle } from '../../../../engine/src/emoji-bundle.ts';
import type { EmojiXmlParser } from '../../../../engine/src/emoji-svg.ts';
import { sha256Hex } from '../../../../engine/src/bytes.ts';

/** The catalog tag that makes an asset an emoji pack. Nothing else is listed as a set. */
export const EMOJI_PACK_TAG = 'emoji-pack';

/** A bundle is a manifest plus every glyph's artwork, so it carries its own ceiling. */
const BUNDLE_MAX_BYTES = EMOJI_BUNDLE_MAX_BYTES;

/** What an asset index entry states about a pack before anything downloads it. */
interface EmojiEntryMeta {
  id: string;
  version: string;
  checksum: string;
  family: string;
  style: string;
  label: string;
  glyphs: number;
  coverageComplete?: boolean;
  license: string;
  licenseUrl: string;
  attribution: string;
}

/** The assets surface this module needs. Narrow on purpose, so a test can stand in for it. */
export type EmojiAssets = EmojiStorage;

const pinKey = (pin: EmojiPackPinV1): string => JSON.stringify([pin.id, pin.pin?.version, pin.checksum]);

/** True only for a complete `meta.emoji` block. A half-written entry is not offered as a set. */
function readEntryMeta(value: unknown): EmojiEntryMeta | null {
  if (!value || typeof value !== 'object') return null;
  const meta = value as Record<string, unknown>;
  const strings = ['id', 'version', 'checksum', 'family', 'style', 'label', 'license', 'licenseUrl', 'attribution'];
  if (strings.some((name) => typeof meta[name] !== 'string' || !(meta[name] as string))) return null;
  if (typeof meta.glyphs !== 'number' || !Number.isInteger(meta.glyphs) || meta.glyphs < 1) return null;
  if (!/^sha256:[0-9a-f]{64}$/.test(meta.checksum as string)) return null;
  return meta as unknown as EmojiEntryMeta;
}

interface Entry {
  assetId: string;
  meta: EmojiEntryMeta;
  bytes?: number;
  /** The catalog serves this one, as opposed to a pack a person holds. */
  catalog: boolean;
  /** The catalog file's own version, the last part of its cache key. */
  version: string;
}

/** A pack the catalog serves, named without touching its bytes. It is a dependency
 *  like any other library ref: the retention walk keeps exactly this version. */
function catalogPackRef(id: string, version: string): AssetRef {
  return { source: 'library', id, type: 'data', format: 'json', version, pin: { version, format: 'json' } } as AssetRef;
}

export interface EmojiAPIOptions {
  /** When a pack may be brought onto the device. A test runs this at once. */
  whenIdle?(run: () => void): void;
}

/** After the tool has painted and the page has gone quiet. */
function afterFirstPaint(run: () => void): void {
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
    else run();
  }, 1500);
}

export function createEmojiAPI(assets: EmojiAssets, options: EmojiAPIOptions = {}): EmojiAPI {
  // Parsed bundles, keyed by pin. A refusal caches as null so a bad pack is not
  // re-fetched on every glyph of a paragraph.
  const bundles = new Map<string, Promise<EmojiPackBundleV1 | null>>();
  let listing = "";
  let holding: string[] = [];
  let holdQueued = false;
  const held = new Set<string>();

  async function entries(): Promise<Entry[]> {
    const refs = [...await userEmojiRefs(assets), ...await assets.query({ tags: [EMOJI_PACK_TAG] })];
    const found: Entry[] = [];
    for (const ref of refs) {
      const meta = readEntryMeta((ref.meta as { emoji?: unknown } | undefined)?.emoji);
      if (!meta) continue;
      const size = (ref.meta as { size?: unknown } | undefined)?.size;
      if (found.some(entry => entry.assetId === ref.id)) continue;
      found.push({ assetId: ref.id, meta, bytes: typeof size === 'number' ? size : undefined,
        catalog: ref.source === 'library', version: ref.version ?? meta.version });
    }
    return found;
  }

  /** The entry a pin names exactly. Id, version and checksum must all agree; a host
   *  holding a different release of the same set answers nothing, never a substitute. */
  async function entryFor(pin: EmojiPackPinV1): Promise<Entry | null> {
    if (!pin?.id || !pin.pin?.version || !pin.checksum) return null;
    const found = await entries();
    return found.find((entry) =>
      entry.meta.id === pin.id && entry.meta.version === pin.pin.version && entry.meta.checksum === pin.checksum) ?? null;
  }

  /**
   * Bytes the device still holds for a release the catalog has moved on from. The
   * retention walk keeps the file a saved document names, so its exact artwork
   * still draws. Only a set the catalog lists qualifies, and only at another
   * version, which is what stops a link from reading or fetching any other file.
   */
  async function readHeldRelease(pin: EmojiPackPinV1): Promise<Uint8Array | null> {
    if (!pin?.id || !pin.pin?.version || !pin.checksum || !assets._getBlob) return null;
    const current = (await entries()).find(entry => entry.catalog && entry.assetId === pin.id);
    if (!current || current.version === pin.pin.version) return null;
    const blob = await assets._getBlob(pin.id, { format: 'json', version: pin.pin.version });
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  }

  async function readEntry(entry: Entry): Promise<Uint8Array | null> {
    // Straight from the catalog cache. The route below records a placed file's
    // read and writes a second row for it, and a pack is not a placed file.
    if (entry.catalog && assets._getBlob) {
      const blob = await assets._getBlob(entry.assetId, { format: 'json', fetchIfMissing: true });
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    }
    // `bytes` is optional on the contract, so a host without a byte reader simply
    // has no packs. That is never a reason to reach for anything else.
    if (!assets.bytes) return null;
    return assets.bytes(await assets.get(entry.assetId, { format: 'json' }));
  }

  /** Bring the catalog packs in force onto the device, once each, away from the tool
   *  opening. It stores the file only: nothing parses it until a glyph needs drawing. */
  function holdOnDevice(ids: string[]): void {
    if (!ids.length) return;
    void assets._holdCatalogAssets?.(ids)?.catch(() => {});
    if (!assets._getBlob) return;
    holding = ids;
    if (holdQueued) return;
    holdQueued = true;
    (options.whenIdle ?? afterFirstPaint)(() => {
      holdQueued = false;
      const connection = (globalThis.navigator as { connection?: { saveData?: boolean } } | undefined)?.connection;
      if (globalThis.navigator?.onLine === false || connection?.saveData) return;
      void (async () => {
        for (const id of holding) {
          if (held.has(id)) continue;
          held.add(id);
          try { await assets._getBlob!(id, { format: 'json', fetchIfMissing: true }); }
          catch { held.delete(id); }
        }
      })();
    });
  }

  async function fetchBundle(pin: EmojiPackPinV1, from?: Entry): Promise<EmojiPackBundleV1 | null> {
    const entry = from ?? await entryFor(pin);
    // Refused BEFORE the download, because that is the only moment the ceiling
    // means anything: reading the file materialises all of it, then the decode and
    // the parse each copy it again.
    if (entry?.bytes !== undefined && entry.bytes > BUNDLE_MAX_BYTES) return null;
    // The catalog checksum is checked by the asset bridge as it fetches an on-demand
    // file. What is checked below is the thing the pin actually promises: that the
    // manifest text inside the bundle hashes to it.
    const bytes = entry ? await readEntry(entry) : await readHeldRelease(pin);
    if (!bytes?.byteLength || bytes.byteLength > BUNDLE_MAX_BYTES) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return null; }
    const bundle = parsed as EmojiPackBundleV1;
    if (bundle?.schemaVersion !== 1 || bundle.kind !== 'emoji-pack-bundle') return null;
    if (typeof bundle.manifest !== 'string' || !bundle.artwork || typeof bundle.artwork !== 'object' || Array.isArray(bundle.artwork)) return null;
    if (`sha256:${await sha256Hex(new TextEncoder().encode(bundle.manifest))}` !== pin.checksum) return null;
    // A glyph url is looked up by name on an object straight out of JSON.parse, so
    // the prototype goes: an own-property read is what the repo does everywhere
    // else it keys into parsed data, and there is no reason for this one to differ.
    Object.setPrototypeOf(bundle.artwork, null);
    return bundle;
  }

  function bundleFor(pin: EmojiPackPinV1, from?: Entry): Promise<EmojiPackBundleV1 | null> {
    const key = `${pinKey(pin)}:${from?.assetId ?? ''}`;
    let hit = bundles.get(key);
    if (!hit) {
      hit = fetchBundle(pin, from).catch(() => {
        // A failed download can be retried from the set browser. Admission
        // refusals still resolve to null and stay cached for this exact pin.
        if (bundles.get(key) === hit) bundles.delete(key);
        return null;
      });
      bundles.set(key, hit);
    }
    return hit;
  }

  const api: EmojiAPI = {
    async install(bytes) {
      const admitted = await admitEmojiBundle(bytes, api.parseXml as EmojiXmlParser);
      const pin = admitted.info.pin;
      const collision = (await api.sets()).some(set => set.pin.id === pin.id && set.pin.pin.version === pin.pin.version && set.pin.checksum !== pin.checksum);
      if (collision) throw new Error('This emoji version already names different artwork. Give the edited set a new version.');
      await storeEmojiBundle(assets, admitted.bundle, admitted.info);
      for (const glyph of admitted.manifest.glyphs.filter(glyph => glyph.meaning.kind === 'custom')) {
        const meaningDigest = await sha256Hex(new TextEncoder().encode(JSON.stringify(glyph.meaning)));
        const id = `user/emoji-symbol/${pin.checksum.slice(7)}/${meaningDigest}`;
        await writeOnce(assets, { id, type: 'vector', format: 'svg', version: pin.pin.version,
          blob: new Blob([admitted.bundle.artwork[glyph.asset.url]!], { type: 'image/svg+xml' }),
          meta: { name: glyph.label, tags: ['emoji-symbol'], license: glyph.source.license, attribution: glyph.source.attribution,
            emojiSymbol: { meaning: glyph.meaning, pack: pin },
            rights: { works: [{ id: glyph.asset.id, title: glyph.label, creators: [{ name: glyph.source.creator, role: 'creator' }],
              sourceUrl: glyph.source.sourceUrl, revision: glyph.source.revision, rights: [{ declaration: glyph.source.license, url: glyph.source.licenseUrl,
                assertedBy: 'author', notices: admitted.manifest.notices.map(notice => notice.text), status: 'parsed' }] }] } } });
      }
      bundles.clear();
      return admitted.info;
    },
    async dependencies(pins) {
      await api.sets();
      const refs: AssetRef[] = [];
      const shipped: string[] = [];
      for (const pin of pins) {
        const matching = (await entries()).filter(entry => entry.meta.id === pin.id && entry.meta.version === pin.pin.version && entry.meta.checksum === pin.checksum);
        // A pack the catalog serves stays catalog material. Naming it reads no bytes,
        // so opening a tool downloads nothing for this and writes nothing a person
        // has to own. A person's own copy of the same pin is left exactly as it is.
        const catalog = matching.find(entry => entry.catalog);
        if (catalog) {
          refs.push(catalogPackRef(catalog.assetId, catalog.version));
          shipped.push(catalog.assetId);
          continue;
        }
        if (!matching.length) {
          if (await bundleFor(pin)) refs.push(catalogPackRef(pin.id, pin.pin.version));
          continue;
        }
        const available = (await Promise.all(matching.map(entry => bundleFor(pin, entry))))
          .filter((bundle): bundle is EmojiPackBundleV1 => bundle !== null)
          .sort((a, b) => Object.keys(b.artwork).length - Object.keys(a.artwork).length);
        if (!available.length) continue;
        // A document can bring only some glyphs. Preserve the union of locally
        // held subsets and the catalog's exact pack when the catalog is available.
        const bundle = { ...available[0]!, artwork: Object.assign(Object.create(null), ...available.map(bundle => bundle.artwork)) };
        const info = (await api.sets()).find(set => pinKey(set.pin) === pinKey(pin));
        if (info) refs.push(await storeEmojiBundle(assets, bundle, info));
      }
      holdOnDevice(shipped);
      return refs;
    },
    async sets(): Promise<EmojiSetInfoV1[]> {
      const found = await entries();
      const nextListing = found.map(entry => JSON.stringify([entry.assetId, entry.meta])).sort().join('\n');
      if (nextListing !== listing) { bundles.clear(); listing = nextListing; }
      const distinct = found.filter((entry, at) => found.findIndex(other => other.meta.id === entry.meta.id && other.meta.version === entry.meta.version && other.meta.checksum === entry.meta.checksum) === at);
      return distinct.map((entry) => ({
        pin: { id: entry.meta.id, pin: { version: entry.meta.version }, checksum: entry.meta.checksum },
        family: entry.meta.family,
        style: entry.meta.style,
        label: entry.meta.label,
        license: entry.meta.license,
        licenseUrl: entry.meta.licenseUrl,
        attribution: entry.meta.attribution,
        glyphs: entry.meta.glyphs,
        coverageComplete: entry.meta.coverageComplete === true,
        ...(entry.bytes !== undefined ? { bytes: entry.bytes } : {}),
      }));
    },

    async manifest(pin: EmojiPackPinV1): Promise<Uint8Array | null> {
      const bundle = await bundleFor(pin);
      return bundle ? new TextEncoder().encode(bundle.manifest) : null;
    },

    async artwork(pin: EmojiPackPinV1, asset: EmojiGlyphV1['asset']): Promise<Uint8Array | null> {
      const bundle = await bundleFor(pin);
      const key = asset?.url ?? '';
      const svg = bundle && Object.hasOwn(bundle.artwork, key) ? bundle.artwork[key] : null;
      if (typeof svg === 'string') return new TextEncoder().encode(svg);
      // Never let one imported subset hide another document's glyphs or the
      // complete catalog pack. Only sources with the exact same pin qualify.
      for (const entry of await entries()) {
        if (entry.meta.id !== pin.id || entry.meta.version !== pin.pin.version || entry.meta.checksum !== pin.checksum) continue;
        const other = await bundleFor(pin, entry);
        const art = other && Object.hasOwn(other.artwork, key) ? other.artwork[key] : null;
        if (typeof art === 'string') return new TextEncoder().encode(art);
      }
      return null;
    },

    parseXml(source: string): unknown {
      return new DOMParser().parseFromString(source, 'image/svg+xml');
    },
  };
  if (!assets._uploadUserAsset) { delete api.install; delete api.dependencies; }
  return api;
}
