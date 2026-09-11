// SPDX-License-Identifier: MPL-2.0
/**
 * hosted.ts - design systems that live at an instance (plans/186 section 3.6):
 * add one by URL, keep it on the device, notice when the host changed.
 *
 * A hosted record is an ordinary design system whose source can be fetched
 * again. Adding one reads the instance manifest (`GET <base>/api/v1/instance`,
 * unauthenticated), then either downloads the pack the manifest advertises and
 * imports it into a fresh namespace, or - for a deployment that hosts no pack -
 * builds the core from the catalog index: the tokens document and the logo
 * assets it names, re-keyed into the namespace so the system renders with no
 * network at all. Everything else the instance serves stays online: while the
 * hosted system is active its instance is the base, and the picker and tool
 * loads go through the instance overlay as they do for any connected instance.
 *
 * Checking for updates compares what the host reports (the manifest's `brand`
 * block; the pack's ETag) with what the record holds. A change re-imports into
 * the same namespace; a change that could not be brought down marks the record
 * `stale` so the row can say "Update available when online".
 *
 * Reachability is honest, never assumed: the deployed web build's CSP allows no
 * cross-origin fetch, so in that shell adding by URL fails with a clear message
 * and the file door is the way (download `<base>/connect/pack.lolly`, add it
 * from a file - the pack carries its instance, so the record is hosted all the
 * same). The desktop and mobile shells fetch through their CORS-free transport.
 */
import { instanceFetch, normalizeInstanceBase } from '../instance.ts';
import { pickHeadAssetId } from '../../../../../engine/src/design-version.ts';
import { withDesignSystemIdentity } from '../../../../../engine/src/design-system.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import type { DesignSystemRecord, DesignSystemRegistry, PackSignature } from './registry.ts';
import { createDesignSystem, uniqueDesignSystemId } from './manage.ts';

/** What this module reads off `GET <base>/api/v1/instance`. Every field is optional
 *  on the wire (an older deployment carries fewer); the shape is tolerant. */
export interface HostedManifest {
  name: string;
  engineVersion?: string;
  packUrl: string | null;
  brand: {
    profile: string | null;
    label: string | null;
    version: string | null;
    checksum: string | null;
    locked: boolean;
    packUrl: string | null;
  } | null;
}

export interface HostedHost {
  designSystems: DesignSystemRegistry;
  assets: {
    _getBlob(id: string): Promise<Blob | null>;
    _exportUserAssets(): Promise<Array<{ id: string; type: string }>>;
    _deleteUserAsset(id: string): Promise<void>;
    _uploadUserAsset(record: { id: string; type: string; format: string; blob: Blob; version?: string; meta?: Record<string, unknown> }, opts?: { skipQuota?: boolean }): Promise<void>;
    _getUserRecord?(id: string): Promise<{ meta?: Record<string, unknown> } | null>;
  };
  tokens?: { bust?(opts?: { lock?: boolean }): void; isLocked?(): Promise<boolean> };
  log?(level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object): void;
}

/** How long a record's last check stands before the next boot checks again. */
export const HOSTED_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Shape a manifest body. Null when it is not a Lolly instance manifest. */
export function shapeHostedManifest(body: unknown): HostedManifest | null {
  if (!body || typeof body !== 'object') return null;
  const m = body as Record<string, unknown>;
  const name = str(m.name);
  if (!name) return null;
  const connect = m.connect && typeof m.connect === 'object' ? (m.connect as Record<string, unknown>) : null;
  const b = m.brand && typeof m.brand === 'object' ? (m.brand as Record<string, unknown>) : null;
  const packUrl = str(b?.packUrl) ?? str(connect?.packUrl);
  return {
    name,
    ...(str(m.engineVersion) ? { engineVersion: str(m.engineVersion)! } : {}),
    packUrl,
    brand: b ? {
      profile: str(b.profile), label: str(b.label), version: str(b.version), checksum: str(b.checksum),
      locked: b.locked === true, packUrl: str(b.packUrl) ?? packUrl,
    } : null,
  };
}

/** Fetch and shape the manifest, or throw with a sentence a dialog can show. */
export async function fetchHostedManifest(base: string): Promise<HostedManifest> {
  let resp: Response;
  try {
    resp = await instanceFetch(`${base}/api/v1/instance`, { cache: 'no-cache' });
  } catch (e) {
    throw new Error(unreachableMessage(base, e));
  }
  if (!resp.ok) throw new Error(`${base} answered ${resp.status} for its instance manifest.`);
  let body: unknown;
  try { body = await resp.json(); } catch { throw new Error(`${base} did not return an instance manifest.`); }
  const manifest = shapeHostedManifest(body);
  if (!manifest) throw new Error(`${base} is not a Lolly instance.`);
  return manifest;
}

function unreachableMessage(base: string, e: unknown): string {
  const csp = typeof document !== 'undefined' && !('__TAURI_INTERNALS__' in globalThis);
  return csp
    ? `This browser build cannot reach ${base} directly. Download ${base}/connect/pack.lolly and add it from a file, or use the desktop app.`
    : `Could not reach ${base} (${e instanceof Error ? e.message : String(e)}).`;
}

/** The tokens asset of a catalog index plus the logo assets its document names. */
interface CatalogCore {
  tokens: { id: string; name?: string; brandLock?: boolean; checksum?: string; url: string; version?: string };
  assets: Array<{ id: string; type: string; version?: string; formats: Array<{ format: string; url: string; checksum?: string }> }>;
}

async function readCatalogCore(base: string): Promise<CatalogCore> {
  const resp = await instanceFetch(`${base}/catalog/assets/index.json`, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`${base} hosts no catalog (${resp.status}).`);
  const idx = await resp.json() as { assets?: CatalogCore['assets'] };
  const assets = idx.assets ?? [];
  const tokensEntries = assets.filter(a => a.type === 'tokens');
  const headId = pickHeadAssetId(tokensEntries.map(a => a.id));
  const head = tokensEntries.find(a => a.id === headId) as (CatalogCore['assets'][number] & { name?: string; brandLock?: boolean; checksum?: string }) | undefined;
  if (!head) throw new Error(`${base} ships no design tokens.`);
  const fmt = head.formats.find(f => f.format === 'json') ?? head.formats[0];
  if (!fmt) throw new Error(`${base}'s tokens asset has no file.`);
  return {
    tokens: { id: head.id, name: head.name, brandLock: head.brandLock, checksum: head.checksum ?? fmt.checksum, url: fmt.url, version: head.version },
    assets,
  };
}

/** Walk a tokens document and hand every `$type: 'asset'` leaf's id to `fn`,
 *  writing back what it returns (a re-keyed id, or the same one). */
function rewriteAssetLeaves(doc: unknown, fn: (id: string) => string): unknown {
  if (Array.isArray(doc)) return doc.map(v => rewriteAssetLeaves(v, fn));
  if (!doc || typeof doc !== 'object') return doc;
  const rec = doc as Record<string, unknown>;
  if (rec.$type === 'asset' && typeof rec.$value === 'string') return { ...rec, $value: fn(rec.$value) };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = rewriteAssetLeaves(v, fn);
  return out;
}

/**
 * Bring a pack-less instance's core into `record`'s namespace: the tokens
 * document with its identity written in, and each logo asset it names as a
 * user row under `${ns}logo/<slot>`. Returns the checksum the record should hold.
 */
async function synthesiseFromCatalog(host: HostedHost, base: string, record: DesignSystemRecord): Promise<string | null> {
  const core = await readCatalogCore(base);
  const docResp = await instanceFetch(core.tokens.url.startsWith('http') ? core.tokens.url : `${base}${core.tokens.url}`, { cache: 'no-cache' });
  if (!docResp.ok) throw new Error(`Could not read ${base}'s design tokens (${docResp.status}).`);
  const doc = await docResp.json();
  const byId = new Map(core.assets.map(a => [a.id, a]));
  const rekeyed = new Map<string, string>();
  let slot = 0;
  const wanted: string[] = [];
  rewriteAssetLeaves(doc, (id) => { if (byId.has(id) && !wanted.includes(id)) wanted.push(id); return id; });
  for (const id of wanted) {
    const asset = byId.get(id)!;
    const fmt = asset.formats.find(f => f.format === 'svg') ?? asset.formats[0];
    if (!fmt) continue;
    try {
      const resp = await instanceFetch(fmt.url.startsWith('http') ? fmt.url : `${base}${fmt.url}`);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const local = `${record.ns}logo/${id.split('/').pop() || `slot-${slot++}`}`;
      await host.assets._uploadUserAsset({
        id: local,
        type: fmt.format === 'svg' ? 'vector' : 'raster',
        format: fmt.format,
        blob,
        ...(asset.version ? { version: asset.version } : {}),
        meta: { name: id.split('/').pop(), from: id },
      });
      rekeyed.set(id, local);
    } catch { /* one logo that will not download is a gap, not a failure */ }
  }
  const local = withDesignSystemIdentity(rewriteAssetLeaves(doc, id => rekeyed.get(id) ?? id), { id: record.id, label: record.label });
  await installUserTokens(host as unknown as Parameters<typeof installUserTokens>[0], local, { system: record.id, label: record.label });
  return core.tokens.checksum ?? null;
}

/** Download the pack, import it into the record's namespace. Returns its ETag. */
async function importPack(host: HostedHost, record: DesignSystemRecord, packUrl: string): Promise<{ etag: string | null; signature: PackSignature; theme?: 'light' | 'dark' | 'brand' }> {
  const resp = await instanceFetch(packUrl, { cache: 'no-cache' });
  if (resp.status === 401) throw new Error('This instance asks you to sign in before it hands out its design system. Sign in there, download the pack, and add it from a file.');
  if (!resp.ok) throw new Error(`The pack at ${packUrl} answered ${resp.status}.`);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const { importBrandPack } = await import('../../brand-transfer.ts');
  const storage = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const summary = await importBrandPack(
    { host: host as unknown as Parameters<typeof importBrandPack>[0]['host'], storage: storage as Parameters<typeof importBrandPack>[0]['storage'] },
    bytes,
    { target: { system: record.id } },
  );
  return { etag: resp.headers.get('etag'), signature: summary.packSignature ?? 'unsigned', ...(summary.theme ? { theme: summary.theme } : {}) };
}

/**
 * Add a hosted design system. Creates the record, brings its core down, and
 * returns the record. Does NOT switch to it - the caller decides.
 */
export async function addHostedDesignSystem(host: HostedHost, url: string): Promise<DesignSystemRecord> {
  const base = normalizeInstanceBase(url);
  const registry = host.designSystems;
  for (const r of await registry.list()) {
    if (r.source.kind === 'hosted' && r.source.instance === base) throw new Error(`${r.label} is already on this device from ${base}.`);
  }
  const manifest = await fetchHostedManifest(base);
  const label = manifest.brand?.label || manifest.name || base.replace(/^https?:\/\//, '');
  const record = await createDesignSystem(host as unknown as Parameters<typeof createDesignSystem>[0], {
    label,
    source: { kind: 'hosted', instance: base, packUrl: manifest.packUrl, signature: 'unsigned', ...(manifest.brand?.version ? { version: manifest.brand.version } : {}) },
    locked: manifest.brand?.locked ?? false,
  });
  try {
    const synced = await syncInto(host, record, manifest);
    await registry.put(synced);
    return synced;
  } catch (e) {
    // Half a system is worse than none: take the record and its rows back out.
    const { removeDesignSystem } = await import('./manage.ts');
    await removeDesignSystem(host as unknown as Parameters<typeof removeDesignSystem>[0], record.id).catch(() => { /* best effort */ });
    throw e;
  }
}

/** Bring the host's current core into an existing record's namespace. */
async function syncInto(host: HostedHost, record: DesignSystemRecord, manifest: HostedManifest): Promise<DesignSystemRecord> {
  if (record.source.kind !== 'hosted') throw new Error('not a hosted design system');
  const base = record.source.instance;
  const now = Date.now();
  let checksum: string | null = manifest.brand?.checksum ?? null;
  let signature: PackSignature = record.source.signature;
  let theme: 'light' | 'dark' | 'brand' | undefined;
  if (manifest.packUrl) {
    const r = await importPack(host, record, manifest.packUrl);
    signature = r.signature;
    theme = r.theme;
    checksum = checksum ?? r.etag?.replace(/^W\//, '').replace(/^"|"$/g, '') ?? null;
  } else {
    checksum = (await synthesiseFromCatalog(host, base, record)) ?? checksum;
  }
  return {
    ...record,
    label: manifest.brand?.label || record.label,
    locked: manifest.brand?.locked ?? record.locked,
    ...(theme ? { appearance: { ...(record.appearance ?? {}), theme } } : {}),
    source: {
      kind: 'hosted', instance: base, packUrl: manifest.packUrl, signature,
      ...(manifest.brand?.version ? { version: manifest.brand.version } : {}),
      ...(checksum ? { checksum } : {}),
      lastCheckedAt: now, lastSyncedAt: now, stale: false,
    },
  };
}

export type RefreshOutcome = 'unchanged' | 'updated' | 'stale' | 'unreachable' | 'not-hosted';

/**
 * Check one hosted record against its host and bring a change down. `force`
 * skips the interval. Never throws: a host that is away answers `unreachable`.
 */
export async function refreshHostedDesignSystem(host: HostedHost, id: string, opts: { force?: boolean } = {}): Promise<RefreshOutcome> {
  const registry = host.designSystems;
  const record = await registry.get(id);
  if (!record || record.source.kind !== 'hosted') return 'not-hosted';
  const src = record.source;
  if (!opts.force && src.lastCheckedAt && Date.now() - src.lastCheckedAt < HOSTED_CHECK_INTERVAL_MS) return 'unchanged';
  let manifest: HostedManifest;
  try { manifest = await fetchHostedManifest(src.instance); } catch { return 'unreachable'; }
  const remote = manifest.brand?.checksum ?? null;
  const version = manifest.brand?.version ?? null;
  const changed = (remote && remote !== (src.checksum ?? null)) || (version && version !== (src.version ?? null)) || (!remote && !version);
  if (!changed) {
    await registry.put({ ...record, source: { ...src, lastCheckedAt: Date.now(), stale: false } });
    return 'unchanged';
  }
  try {
    await registry.put(await syncInto(host, record, manifest));
    host.tokens?.bust?.({ lock: true });
    return 'updated';
  } catch (e) {
    host.log?.('warn', 'A hosted design system changed but the update could not be brought down', { id, error: String(e) });
    await registry.put({ ...record, source: { ...src, lastCheckedAt: Date.now(), stale: true } });
    return 'stale';
  }
}

/** Check every hosted record whose interval has lapsed. Boot and visibility hook. */
export async function checkHostedDesignSystems(host: HostedHost, opts: { force?: boolean } = {}): Promise<Record<string, RefreshOutcome>> {
  const out: Record<string, RefreshOutcome> = {};
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return out;
  for (const r of await host.designSystems.list()) {
    if (r.source.kind !== 'hosted') continue;
    out[r.id] = await refreshHostedDesignSystem(host, r.id, opts);
  }
  return out;
}

/** Whether a hosted record should be treated as connected material: it has a base. */
export function hostedInstanceOf(record: DesignSystemRecord): string | null {
  return record.source.kind === 'hosted' ? record.source.instance : null;
}

export { uniqueDesignSystemId };
