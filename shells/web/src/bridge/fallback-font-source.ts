// SPDX-License-Identifier: MPL-2.0
/**
 * Where the fallback fonts come from on this device: their catalog entries and their
 * bytes. The host wires this once at boot (bridge/index.ts) over the catalog cache, so the
 * modules that draw with a fallback font (font-fill.ts, page-fallback-fonts.ts) need no
 * host of their own and load nothing until a document needs one.
 *
 * Kept tiny and free of imports because the boot chunk carries this module.
 */
export interface FallbackFontSource {
  /** The synced catalog entries that carry `meta.fallbackFont`. Reads no bytes. */
  entries(): Promise<readonly unknown[]>;
  /** One font's bytes: from the catalog cache, fetched and stored there the first time. */
  bytes(id: string): Promise<Uint8Array | null>;
  /** Keep these files through a catalog prune, so a script used once still draws offline. */
  hold(ids: readonly string[]): Promise<void>;
}

let source: FallbackFontSource | null = null;

export function provideFallbackFontSource(next: FallbackFontSource | null): void { source = next; }

export function fallbackFontSource(): FallbackFontSource | null { return source; }

let catalogSync: Promise<unknown> | null = null;

/** The boot catalog sync (main.ts), which a first visit's fallback fonts arrive with. */
export function noteCatalogSync(job: Promise<unknown>): void { catalogSync = job; }

/** Settles once the boot catalog sync has, or after `ms`; at once when none is running. */
export async function catalogSynced(ms = 15000): Promise<void> {
  if (!catalogSync) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([catalogSync.then(() => {}, () => {}), new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  if (timer !== undefined) clearTimeout(timer);
}

/** The prefix of the family titles the live page registers fallback fonts under. Exports
 *  skip these names and take the same files from the catalog, so a page that registered
 *  one and a page that did not export the same outlines. */
export const PAGE_FALLBACK_FAMILY = 'Lolly Fallback ';

/**
 * A computed `font-family` as an export writes it into a file: without the live page's own
 * fallback families, which exist only on this page. A stack holding none comes back as
 * the same string: a file lists exactly the fonts it listed before.
 */
export function exportFontFamily(stack: string): string {
  if (!stack.includes(PAGE_FALLBACK_FAMILY)) return stack;
  const parts: string[] = [];
  let cur = '', quote = '';
  for (const ch of stack) {
    if (quote) { cur += ch; if (ch === quote) quote = ''; }
    else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === ',') { parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  parts.push(cur.trim());
  return parts.filter((p) => p && !p.replace(/^["']|["']$/g, '').startsWith(PAGE_FALLBACK_FAMILY)).join(', ');
}

/** What one fallback font drew, in words for the export notice. */
export interface FillUseNote { label: string; family: string }

const fillChains = new WeakMap<object, readonly FillUseNote[]>();
const fillLogs: FillUseNote[][] = [];

/** The fallback fonts a resolved chain carries (font-fill.ts), keyed by the chain itself. */
export function markFillChain(chain: object, uses: readonly FillUseNote[]): void { fillChains.set(chain, uses); }

/**
 * A run was shaped from `chain` with no glyph missing (text.ts toPath), so it is drawn
 * with the fallback fonts the chain carries: every open export log records them.
 */
export function noteShapedChain(chain: object | undefined): void {
  if (!chain || !fillLogs.length) return;
  const uses = fillChains.get(chain);
  if (uses) for (const log of fillLogs) log.push(...uses);
}

/** Collect what fallback fonts draw from now on; the closer returns the list and stops. */
export function openFillLog(): () => FillUseNote[] {
  const log: FillUseNote[] = [];
  fillLogs.push(log);
  return () => {
    const at = fillLogs.lastIndexOf(log);
    if (at !== -1) fillLogs.splice(at, 1);
    return log;
  };
}

const pagePending = new Set<Promise<unknown>>();

/** The live page is deciding or loading its fallback fonts; an export waits for that. */
export function notePageFill(job: Promise<unknown>): void {
  pagePending.add(job);
  const done = (): void => { pagePending.delete(job); };
  job.then(done, done);
}

/**
 * Settles when the live page has its fallback fonts in place, so an export lays text out
 * in the same faces the page shows. Bounded: a page that cannot finish does not hold an
 * export back for longer than `ms`.
 */
export async function pageFillSettled(ms = 8000): Promise<void> {
  const until = Date.now() + ms;
  while (pagePending.size) {
    const left = until - Date.now();
    if (left <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled([...pagePending]),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, left); }),
    ]);
    if (timer !== undefined) clearTimeout(timer);
  }
}
