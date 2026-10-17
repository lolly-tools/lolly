// SPDX-License-Identifier: MPL-2.0
/**
 * Local consumer index for design tokens (plan 286 M3).
 *
 * Two sources, each with its own scope: saved sessions in this device's storage, and
 * the tool manifests of the mounted catalog. Every count carries how many items the
 * source listed, how many were read, how many were skipped and how many a size limit
 * cut short, so a result never reads as a total. Shared projects, other devices,
 * History checkpoints, sideloaded tool manifests and values that tool hooks compute
 * are outside both sources. The index is built on request, kept in memory and never
 * written anywhere.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { aliasPath, isAlias } from '../../../../engine/src/tokens.ts';
import { readBlockRunBindings, readBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';
import { isHiddenSlot } from './batch-slots.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';

export type TokenConsumerKind = 'linked' | 'unresolved' | 'custom' | 'default' | 'example';
export type TokenConsumerScopeKind = 'local-sessions' | 'mounted-catalog';

/** One place a token path is referenced, inside a session or a manifest. */
export interface TokenUseSite { path: string; where: string; kind: TokenConsumerKind }

export interface TokenConsumerUse extends TokenUseSite {
  scope: TokenConsumerScopeKind;
  /** Session slot or tool id. */
  id: string;
  label: string;
  toolId: string;
  /** The design system a saved session recorded, when it recorded one. */
  designSystem?: { id: string; label: string };
}

export interface TokenConsumerScope {
  kind: TokenConsumerScopeKind;
  /** False when the source could not list anything, so nothing from it is counted. */
  available: boolean;
  listed: number;
  read: number;
  /** Listed but not read: missing, unreadable or past the item limit. */
  skipped: number;
  /** Read, but a size limit stopped the walk before the end. */
  partial: number;
}

export interface TokenConsumerIndex {
  builtAt: string;
  sessions: TokenConsumerScope;
  tools: TokenConsumerScope;
  uses: ReadonlyMap<string, readonly TokenConsumerUse[]>;
  /** Changes when a listed session is added, removed or saved again. */
  sessionStamp: string;
  /** The design system the index was built for, or null when the source cannot tell. */
  systemId: string | null;
}

export interface TokenConsumerSessionEntry {
  slot: string;
  toolId?: string;
  label?: string;
  updatedAt?: string;
  designSystem?: { id: string; label: string };
}

/** Each member is optional; a missing list makes that scope unavailable. */
export interface TokenConsumerSources {
  listSessions?(): Promise<TokenConsumerSessionEntry[] | null>;
  loadSession?(slot: string): Promise<unknown>;
  listTools?(): Promise<{ id: string; name?: string }[] | null>;
  loadManifest?(id: string): Promise<unknown>;
  systemId?(): Promise<string | null>;
}

export interface TokenConsumerLimits {
  sessions: number;
  tools: number;
  /** Values visited in one session before its walk stops. */
  nodes: number;
  /** Characters of an embedded JSON document, such as a composed text story. */
  embedded: number;
  concurrency: number;
}
export const TOKEN_CONSUMER_LIMITS: TokenConsumerLimits = { sessions: 2000, tools: 1000, nodes: 50000, embedded: 2_000_000, concurrency: 4 };

type Rec = Record<string, unknown>;
const record = (value: unknown): value is Rec => !!value && typeof value === 'object' && !Array.isArray(value);
const join = (where: string, key: string): string => where ? `${where}.${key}` : key;
/** Input types whose bare alias value the runtime resolves as a link. Text keeps `{x}` literal. */
const BARE_ALIAS_TYPES = new Set(['color', 'number']);
/** The block metadata field that holds row links (Design layers and composed paragraphs). */
const LINK_FIELD = 'tokenLinks';
const MAX_DEPTH = 64;

function linkKind(link: { custom?: unknown; status?: unknown }): TokenConsumerKind {
  if (link.custom === true) return 'custom';
  return link.status === 'unresolved' || link.status === 'incompatible' ? 'unresolved' : 'linked';
}

/**
 * Token references in one saved session. `typedInputs` lists the colour and number
 * inputs from the tool's manifest, when it was read: only those treat a bare alias
 * string as a link. Restore hints (`__tokenLinks`) are custom values that remember a link.
 */
export function sessionTokenUses(data: unknown, options: { typedInputs?: ReadonlySet<string>; nodeLimit?: number; embeddedLimit?: number } = {}): { uses: TokenUseSite[]; truncated: boolean } {
  const uses: TokenUseSite[] = [];
  const limit = options.nodeLimit ?? TOKEN_CONSUMER_LIMITS.nodes, embedded = options.embeddedLimit ?? TOKEN_CONSUMER_LIMITS.embedded;
  let nodes = 0, truncated = false;
  if (!record(data)) return { uses, truncated };
  const add = (ref: unknown, where: string, kind: TokenConsumerKind): void => {
    const path = isAlias(ref) ? aliasPath(ref) : null;
    if (path) uses.push({ path, where, kind });
  };
  const rowLinks = (raw: string, where: string): void => {
    for (const [field, link] of Object.entries(readBlockTokenBindings(raw))) add(link.ref, join(where, field), linkKind(link));
    for (const link of Object.values(readBlockRunBindings(raw))) add(link.ref, join(where, 'text'), linkKind(link));
  };
  const visit = (node: unknown, where: string, depth: number): void => {
    if (truncated) return;
    if (++nodes > limit || depth > MAX_DEPTH) { truncated = true; return; }
    if (typeof node === 'string') {
      // A composed text story is stored as one JSON string; its paragraphs carry their own links.
      if (node.length > embedded || !node.startsWith('{') || !node.includes(`"${LINK_FIELD}"`)) return;
      let parsed: unknown;
      try { parsed = JSON.parse(node); } catch { return; }
      visit(parsed, where, depth + 1);
      return;
    }
    if (Array.isArray(node)) { node.forEach((item, index) => { visit(item, `${where}[${index}]`, depth + 1); }); return; }
    if (!record(node)) return;
    // A typed input link: `{ref, value}` with an alias in `ref`.
    if (isAlias(node.ref)) { add(node.ref, where, linkKind(node)); return; }
    for (const [key, value] of Object.entries(node)) {
      if (key === LINK_FIELD && typeof value === 'string') rowLinks(value, where);
      else visit(value, join(where, key), depth + 1);
    }
  };
  for (const [id, value] of Object.entries(data)) {
    if (id.startsWith('__')) continue;
    if (typeof value === 'string' && isAlias(value)) { if (options.typedInputs?.has(id)) add(value, id, 'linked'); continue; }
    visit(value, id, 0);
  }
  const restore = data.__tokenLinks;
  if (record(restore)) for (const [id, ref] of Object.entries(restore).slice(0, 256)) add(ref, id, 'custom');
  return { uses, truncated };
}

/** Declared references in one tool manifest: colour and number defaults, and examples. */
export function manifestTokenUses(manifest: unknown): { uses: TokenUseSite[]; typedInputs: Set<string> } {
  const uses: TokenUseSite[] = [], typedInputs = new Set<string>();
  if (!record(manifest) || !Array.isArray(manifest.inputs)) return { uses, typedInputs };
  const add = (ref: unknown, where: string, kind: TokenConsumerKind): void => {
    const path = isAlias(ref) ? aliasPath(ref) : null;
    if (path) uses.push({ path, where, kind });
  };
  for (const input of manifest.inputs.slice(0, 1000)) {
    if (!record(input) || typeof input.id !== 'string') continue;
    if (BARE_ALIAS_TYPES.has(String(input.type))) { typedInputs.add(input.id); add(input.default, input.id, 'default'); }
    if (Array.isArray(input.fields)) for (const field of input.fields.slice(0, 256)) {
      if (record(field) && typeof field.id === 'string' && BARE_ALIAS_TYPES.has(String(field.type))) add(field.default, `${input.id}.${field.id}`, 'default');
    }
  }
  if (Array.isArray(manifest.examples)) manifest.examples.slice(0, 64).forEach((example, index) => {
    if (!record(example) || !record(example.values)) return;
    for (const [id, value] of Object.entries(example.values)) if (typedInputs.has(id)) add(value, `examples[${index}].${id}`, 'example');
  });
  return { uses, typedInputs };
}

function cancelled(): Error {
  return new DOMException(t('Check cancelled'), 'AbortError');
}

/** FNV-1a over the visible session list: cheap to recompute for a staleness check. */
function stampOf(entries: readonly TokenConsumerSessionEntry[]): string {
  let hash = 0x811c9dc5;
  for (const line of entries.map(e => `${e.slot}\u0000${e.updatedAt ?? ''}`).sort()) {
    for (let i = 0; i < line.length; i++) hash = Math.imul(hash ^ line.charCodeAt(i), 0x01000193) >>> 0;
    hash = Math.imul(hash ^ 10, 0x01000193) >>> 0;
  }
  return `${entries.length}:${hash.toString(16)}`;
}

async function visibleSessions(sources: TokenConsumerSources): Promise<TokenConsumerSessionEntry[] | null> {
  const listed = await sources.listSessions?.();
  return Array.isArray(listed) ? listed.filter(entry => typeof entry?.slot === 'string' && !isHiddenSlot(entry.slot)) : null;
}

/** Reads the mounted catalog first so bare colour aliases in sessions can be typed. */
export async function buildTokenConsumerIndex(sources: TokenConsumerSources, options: { signal?: AbortSignal; limits?: Partial<TokenConsumerLimits>; onProgress?(done: number, total: number): void } = {}): Promise<TokenConsumerIndex> {
  const limits = { ...TOKEN_CONSUMER_LIMITS, ...options.limits };
  const { signal } = options;
  const check = (): void => { if (signal?.aborted) throw cancelled(); };
  const uses = new Map<string, TokenConsumerUse[]>();
  const put = (use: TokenConsumerUse): void => { const list = uses.get(use.path); if (list) list.push(use); else uses.set(use.path, [use]); };
  const sessions: TokenConsumerScope = { kind: 'local-sessions', available: false, listed: 0, read: 0, skipped: 0, partial: 0 };
  const tools: TokenConsumerScope = { kind: 'mounted-catalog', available: false, listed: 0, read: 0, skipped: 0, partial: 0 };
  const typed = new Map<string, Set<string>>();

  const [toolList, sessionList, systemId] = await Promise.all([
    sources.listTools?.().catch(() => null) ?? null,
    visibleSessions(sources).catch(() => null),
    sources.systemId?.().catch(() => null) ?? null,
  ]);
  check();
  const toolEntries = Array.isArray(toolList) ? toolList.filter(tool => typeof tool?.id === 'string') : [];
  const sessionEntries = sessionList ?? [];
  const total = Math.min(toolEntries.length, limits.tools) + Math.min(sessionEntries.length, limits.sessions);
  let done = 0;
  const progress = (): void => { options.onProgress?.(++done, total); };

  if (Array.isArray(toolList) && sources.loadManifest) {
    tools.available = true;
    tools.listed = toolEntries.length;
    tools.skipped = Math.max(0, toolEntries.length - limits.tools);
    const queue = toolEntries.slice(0, limits.tools);
    const worker = async (): Promise<void> => {
      for (let tool = queue.shift(); tool; tool = queue.shift()) {
        check();
        let manifest: unknown;
        try { manifest = await sources.loadManifest?.(tool.id); } catch { manifest = undefined; }
        check();
        if (!record(manifest)) tools.skipped++;
        else {
          tools.read++;
          const found = manifestTokenUses(manifest);
          typed.set(tool.id, found.typedInputs);
          for (const use of found.uses) put({ ...use, scope: 'mounted-catalog', id: tool.id, label: tool.name || tool.id, toolId: tool.id });
        }
        progress();
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limits.concurrency, queue.length)) }, worker));
  }

  if (sessionList && sources.loadSession) {
    sessions.available = true;
    sessions.listed = sessionEntries.length;
    sessions.skipped = Math.max(0, sessionEntries.length - limits.sessions);
    for (const entry of sessionEntries.slice(0, limits.sessions)) {
      check();
      let data: unknown;
      try { data = await sources.loadSession?.(entry.slot); } catch { data = undefined; }
      check();
      if (!record(data)) { sessions.skipped++; progress(); continue; }
      sessions.read++;
      const toolId = entry.toolId ?? (typeof data.__toolId === 'string' ? data.__toolId : '');
      const found = sessionTokenUses(data, { typedInputs: typed.get(toolId), nodeLimit: limits.nodes, embeddedLimit: limits.embedded });
      if (found.truncated) sessions.partial++;
      const label = entry.label || (typeof data.__label === 'string' && data.__label) || toolId || entry.slot;
      for (const use of found.uses) put({ ...use, scope: 'local-sessions', id: entry.slot, label, toolId, ...(entry.designSystem ? { designSystem: { ...entry.designSystem } } : {}) });
      progress();
    }
  }
  return { builtAt: new Date().toISOString(), sessions, tools, uses, sessionStamp: stampOf(sessionEntries), systemId: typeof systemId === 'string' ? systemId : null };
}

/** True when saved sessions changed after the index was built. */
export async function tokenConsumerIndexStale(index: TokenConsumerIndex, sources: TokenConsumerSources): Promise<boolean> {
  const listed = await visibleSessions(sources).catch(() => null);
  return listed ? stampOf(listed) !== index.sessionStamp : index.sessions.available;
}

export interface TokenConsumerSummary {
  path: string;
  sessions: TokenConsumerScope & { following: number; customOnly: number; thisSystem: number; otherSystem: number; unrecorded: number };
  tools: TokenConsumerScope & { matched: number };
  uses: readonly TokenConsumerUse[];
}

/** Counts distinct sessions and tools for one path, within the index's scopes. */
export function summariseTokenConsumers(index: TokenConsumerIndex, path: string): TokenConsumerSummary {
  const uses = index.uses.get(path) ?? [];
  const bySession = new Map<string, TokenConsumerUse[]>();
  const toolIds = new Set<string>();
  for (const use of uses) {
    if (use.scope === 'mounted-catalog') { toolIds.add(use.id); continue; }
    const list = bySession.get(use.id);
    if (list) list.push(use); else bySession.set(use.id, [use]);
  }
  let following = 0, customOnly = 0, thisSystem = 0, otherSystem = 0, unrecorded = 0;
  for (const list of bySession.values()) {
    if (list.some(use => use.kind !== 'custom')) following++; else customOnly++;
    const system = list[0]!.designSystem?.id;
    if (!system) unrecorded++; else if (system === index.systemId) thisSystem++; else otherSystem++;
  }
  return { path, uses, sessions: { ...index.sessions, following, customOnly, thisSystem, otherSystem, unrecorded }, tools: { ...index.tools, matched: toolIds.size } };
}

/** Plain sentences for a summary. Each count states the scope it covers; none is a total. */
export function tokenConsumerSentences(summary: TokenConsumerSummary, systemKnown: boolean): string[] {
  const out: string[] = [];
  const s = summary.sessions;
  if (!s.available) out.push(t('Saved sessions on this device could not be listed, so none are counted.'));
  else {
    out.push(t('Saved sessions on this device that follow this token: {n} of {read} read.', { n: s.following, read: s.read }));
    if (s.customOnly) out.push(t('Saved sessions with a custom value that remembers this token: {n}.', { n: s.customOnly }));
    if (systemKnown && s.following + s.customOnly) out.push(t('Of those, saved with this design system active: {same}. With another design system: {other}. No design system recorded: {none}.', { same: s.thisSystem, other: s.otherSystem, none: s.unrecorded }));
    if (s.skipped) out.push(t('Saved sessions not read, so not counted: {n}.', { n: s.skipped }));
    if (s.partial) out.push(t('Saved sessions only partly read because of a size limit: {n}. Their counts may be low.', { n: s.partial }));
  }
  const c = summary.tools;
  if (!c.available) out.push(t('The tool catalog has not loaded on this device, so no tools are counted.'));
  else {
    out.push(t('Tools in the mounted catalog that use this token as a default or example: {n} of {read} read.', { n: c.matched, read: c.read }));
    if (c.skipped) out.push(t('Tools not read, so not counted: {n}.', { n: c.skipped }));
  }
  return out;
}

function kindLabel(kind: TokenConsumerKind): string {
  switch (kind) {
    case 'linked': return t('Follows the token');
    case 'unresolved': return t('Linked, unresolved when saved');
    case 'custom': return t('Custom value, link remembered');
    case 'default': return t('Tool default');
    default: return t('Tool example');
  }
}
const USE_LIMIT = 50;

export type TokenConsumerState =
  | { status: 'idle' }
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; index: TokenConsumerIndex; stale: boolean }
  | { status: 'failed'; message: string }
  | { status: 'cancelled' };

/** The section body for one token path. Pure, so a test can read every state. */
export function tokenConsumerSectionHtml(state: TokenConsumerState, path: string): string {
  const scope = `<p>${t('Shared projects, other devices, earlier versions in History, the defaults of tools added from files and values that tool hooks compute are not counted.')}</p>`;
  const again = (label: string): string => `<button type="button" class="btn btn--ghost" data-tw-consumers-check>${label}</button>`;
  let body: string;
  if (state.status === 'idle') body = `<p>${t('Look through the saved sessions and mounted tools on this device for references to this token. One check covers every token in this workspace.')}</p>${scope}${again(t('Check saved work and tools'))}`;
  else if (state.status === 'loading') body = `<p data-tw-consumers-progress>${state.total ? t('Checking {done} of {total}…', { done: state.done, total: state.total }) : t('Listing saved work and tools…')}</p><button type="button" class="btn btn--ghost" data-tw-consumers-cancel>${t('Cancel check')}</button>`;
  else if (state.status === 'cancelled') body = `<p>${t('Check cancelled. Nothing was counted.')}</p>${again(t('Check saved work and tools'))}`;
  else if (state.status === 'failed') body = `<p>${esc(state.message)}</p>${again(t('Check again'))}`;
  else {
    const summary = summariseTokenConsumers(state.index, path);
    const time = new Date(state.index.builtAt).toLocaleTimeString();
    const list = summary.uses.slice(0, USE_LIMIT).map(use => `<li><strong>${esc(use.label)}</strong> · ${esc(use.toolId || t('Unknown tool'))} · <code>${esc(use.where)}</code> · ${kindLabel(use.kind)}</li>`).join('');
    body = `<p>${t('Checked at {time}.', { time })}</p>${state.stale ? `<p>${t('Saved sessions changed after this check. Check again for current counts.')}</p>` : ''}<ul>${tokenConsumerSentences(summary, !!state.index.systemId).map(line => `<li>${line}</li>`).join('')}</ul>${scope}${list ? `<ul class="tw-consumer-uses">${list}</ul>` : ''}${summary.uses.length > USE_LIMIT ? `<p>${t('Showing {shown} of {total} uses.', { shown: USE_LIMIT, total: summary.uses.length })}</p>` : ''}${again(t('Check again'))}`;
  }
  return `<section class="tw-consumers" data-tw-consumers data-tw-consumers-path="${esc(path)}" aria-busy="${state.status === 'loading'}"><h5>${t('Saved work and tools on this device')}</h5>${body}</section>`;
}

export interface TokenConsumerCheck {
  html(path: string): string;
  /** True when the click belonged to the section. */
  click(target: HTMLElement): boolean;
  dispose(): void;
}

/**
 * One index per workspace, shared by every token it shows. Updates repaint only the
 * section and keep focus on its buttons; a superseded or disposed check is discarded.
 */
export function createTokenConsumerCheck(sources: TokenConsumerSources, options: { root(): ParentNode | null; announce(message: string): void }): TokenConsumerCheck {
  let state: TokenConsumerState = { status: 'idle' };
  let controller: AbortController | undefined;
  let disposed = false, checkingStale = false;
  const section = (): HTMLElement | null => options.root()?.querySelector<HTMLElement>('[data-tw-consumers]') ?? null;
  const paint = (): void => {
    const el = section();
    if (!el) return;
    const focused = el.contains(document.activeElement);
    el.outerHTML = tokenConsumerSectionHtml(state, el.dataset.twConsumersPath ?? '');
    if (focused) section()?.querySelector<HTMLElement>('button')?.focus();
  };
  const checkStale = (index: TokenConsumerIndex): void => {
    if (checkingStale) return;
    checkingStale = true;
    void tokenConsumerIndexStale(index, sources).then(stale => {
      if (!disposed && stale && state.status === 'ready' && state.index === index && !state.stale) { state = { ...state, stale }; paint(); }
    }, () => undefined).finally(() => { checkingStale = false; });
  };
  async function run(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    state = { status: 'loading', done: 0, total: 0 };
    paint();
    try {
      const index = await buildTokenConsumerIndex(sources, { signal: current.signal, onProgress: (done, total) => {
        if (disposed || controller !== current) return;
        state = { status: 'loading', done, total };
        const progress = section()?.querySelector('[data-tw-consumers-progress]');
        if (progress) progress.textContent = t('Checking {done} of {total}…', { done, total });
      } });
      if (disposed || controller !== current) return;
      state = { status: 'ready', index, stale: false };
      options.announce(t('Saved work check finished.'));
    } catch (error) {
      if (disposed || controller !== current) return;
      state = current.signal.aborted ? { status: 'cancelled' } : { status: 'failed', message: error instanceof Error && error.message ? error.message : t('Saved work could not be checked.') };
      options.announce(state.status === 'cancelled' ? t('Check cancelled. Nothing was counted.') : t('Saved work could not be checked.'));
    }
    paint();
  }
  return {
    html(path) {
      if (state.status === 'ready') checkStale(state.index);
      return tokenConsumerSectionHtml(state, path);
    },
    click(target) {
      if (target.hasAttribute('data-tw-consumers-check')) { void run(); return true; }
      if (target.hasAttribute('data-tw-consumers-cancel')) { controller?.abort(); return true; }
      return false;
    },
    dispose() { disposed = true; controller?.abort(); },
  };
}

/** The web shell's sources: this browser's saved sessions and the loaded catalog index. */
export function webTokenConsumerSources(host: Pick<HostV1, 'state' | 'tokens'>): TokenConsumerSources {
  return {
    async listSessions() {
      const entries = await host.state.list();
      return entries.map(entry => {
        const system = (entry as { designSystem?: unknown }).designSystem;
        return { slot: entry.slot, toolId: entry.toolId, label: entry.label, updatedAt: entry.updatedAt, ...(record(system) && typeof system.id === 'string' && typeof system.label === 'string' ? { designSystem: { id: system.id, label: system.label } } : {}) };
      });
    },
    loadSession: slot => host.state.load(slot),
    async listTools() {
      const index = (globalThis as { __toolIndex?: { tools?: unknown } }).__toolIndex;
      if (!index || !Array.isArray(index.tools)) return null;
      return index.tools.flatMap((tool: unknown) => record(tool) && typeof tool.id === 'string' ? [{ id: tool.id, name: typeof tool.name === 'string' ? tool.name : tool.id }] : []);
    },
    async loadManifest(id) {
      const { makeFetchFile } = await import('../bridge/tool-loader.ts');
      return JSON.parse(await makeFetchFile(id)('tool.json')) as unknown;
    },
    async systemId() {
      const { activeDesignSystemRecord } = await import('./design-system/active.ts');
      return (await activeDesignSystemRecord(host))?.id ?? null;
    },
  };
}
