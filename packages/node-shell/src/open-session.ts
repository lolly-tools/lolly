// SPDX-License-Identifier: MPL-2.0
/**
 * The session transport of the browser tier (plan 291 W8 and W9): a Design document
 * reaches the web shell as a `.lolly` file, through the `#/open` route, instead of in
 * the address. An address is capped by the browser (Chromium refuses a navigation URL
 * over 2,097,152 characters), and it never carried uploaded pictures at all, so a
 * deck with large photos could not be exported or checked from Node before this.
 *
 * Everything here works on a page the caller already owns, so the CLI, the TUI and
 * the MCP server keep their own browser context, queue and egress policy. The bytes
 * are answered by page.route from a random same-origin path: nothing listens on a
 * socket, nothing else on the machine can fetch them, and the route answers one GET
 * and is then removed.
 */
import { randomBytes } from 'node:crypto';
import type { Page, Route, Request } from 'playwright-core';
import { assetIdForUrl, isBakedRef } from '../../../engine/src/bake.ts';
import { RESERVED } from '../../../engine/src/url-mode.ts';
import { readLollyFile, type LollyFileContents } from './lolly-file.ts';
import { decodeDataUrl } from './asset-bytes.ts';
import { sampleContrastReviews } from './contrast-sample.ts';

/** Where the page fetches the file from. Answered by page.route, never by a server. */
export const OPEN_ROUTE_PREFIX = '/__lolly-open/';

/** Largest `.lolly` the route hands a page: the check limit (CHECK_MAX_INPUT_BYTES). */
export const OPEN_ROUTE_MAX_BYTES = 64_000_000;

/** A session the page could not open. The browser tier's callers map it to their own error. */
export class OpenSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenSessionError';
  }
}

/** A file name that is safe as one URL path segment and ends in `.lolly`. */
export function openRouteFileName(name: string): string {
  const leaf = (name.split(/[\\/]/).pop() ?? '').replace(/[^\w.-]+/g, '-').replace(/^[.-]+/, '').slice(0, 120);
  const stem = leaf || 'shared';
  return /\.lolly$/i.test(stem) ? stem : `${stem}.lolly`;
}

/**
 * The tool and slot an address opens, in any spelling the shell uses: the hash route
 * `#/tool/<id>?slot=<slot>`, the canonical `/t/<id>?slot=<slot>` or Design's own
 * `/design?slot=<slot>`. null for any other address.
 */
export function openedToolSlot(href: string): { toolId: string; slot: string } | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  const hashed = /^#\/tool\/([^?/]+)\?(.*)$/.exec(url.hash);
  const pathed = hashed ? null : /^\/(?:t\/([^/]+)|(design))$/.exec(url.pathname);
  const id = hashed?.[1] ?? pathed?.[1] ?? pathed?.[2];
  const query = hashed ? hashed[2]! : url.search.slice(1);
  const slot = new URLSearchParams(query).get('slot');
  if (!id || !slot) return null;
  return { toolId: decodeURIComponent(id), slot };
}

/**
 * Why `#/open` would not open these bytes unattended, or null for a plain saved session.
 * The route skips the chooser only for a session that carries nothing else; any other
 * file stops at a prompt (a chooser, the tool trust prompt, the data import) that waits
 * for a person, so it is refused here, in Node, before a browser starts.
 */
export function openRouteRefusal(bytes: Uint8Array): string | null {
  let contents: LollyFileContents;
  try { contents = readLollyFile(bytes, { allowTool: true }); } catch (error) {
    return `is not a saved session the app opens from a link: ${(error as Error).message.replace(/\.$/, '')}`;
  }
  const declared = new Map(Object.entries(contents.manifest));
  const templates = declared.get('templates');
  const templateCount = templates && typeof templates === 'object' ? Number((templates as { count?: unknown }).count) : 0;
  const carries = contents.manifest.kind === 'tool' || contents.manifest.bundledTool ? 'a tool'
    : declared.get('designSystem') ? 'a design system'
    : Number.isFinite(templateCount) && templateCount > 0 ? 'templates'
    : null;
  return carries ? `carries ${carries} as well as a saved session, so the app asks a person what to do with it` : null;
}

/**
 * Serve `bytes` once to `page` at `path` on `origin`. Only a GET is answered (anything
 * else gets 405 and leaves the route in place); the first GET is fulfilled and the
 * route consumed, so a later request for the path falls through to the web shell
 * itself, which knows nothing of the file. `remove` detaches the handler once the
 * open finishes or the caller gives up; `requested` settles when the page has asked
 * for the file. Detaching inside the handler would toggle browser interception
 * while the intake is fetching its modules, leaving some of those fetches stalled.
 */
export async function serveSessionOnce(
  page: Page, origin: string, path: string, bytes: Uint8Array,
): Promise<{ remove: () => Promise<void>; requested: Promise<void> }> {
  if (bytes.length > OPEN_ROUTE_MAX_BYTES) {
    throw new OpenSessionError(`The file is ${Math.round(bytes.length / 1_000_000)} MB, over the ${OPEN_ROUTE_MAX_BYTES / 1_000_000} MB a page is handed. Make it smaller (fewer or smaller pictures) and try again.`);
  }
  const body = Buffer.from(bytes);
  const matches = (url: URL): boolean => url.origin === origin && url.pathname === path;
  let removed = false;
  let consumed = false;
  let asked: () => void = () => {};
  const requested = new Promise<void>((resolve) => { asked = resolve; });
  const remove = async (): Promise<void> => {
    if (removed) return;
    removed = true;
    await page.unroute(matches, handler).catch(() => {});
  };
  const handler = async (route: Route, request: Request): Promise<void> => {
    if (removed || consumed) { await route.fallback(); return; }
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 405, body: '', headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
      return;
    }
    // Consume before answering so concurrent GETs cannot receive a second copy.
    // Keep the handler attached until the open finishes; later requests fall through.
    consumed = true;
    await route.fulfill({ status: 200, body, contentType: 'application/vnd.lolly+zip', headers: { 'Cache-Control': 'no-store' } });
    asked();
  };
  await page.route(matches, handler);
  return { remove, requested };
}

/** How long a page may take to ask for the file before the shell is taken to have no `#/open` route. */
export const OPEN_ROUTE_ASK_MS = 45_000;

export interface OpenSessionInPageOptions {
  /** Longest wait for the session to open, in ms. Default 120 s. */
  timeoutMs?: number;
  /** Longest wait for the page to ask for the file, in ms. Default OPEN_ROUTE_ASK_MS. */
  askTimeoutMs?: number;
  /** A step marker, for the Tier-B debug log. */
  step?: (name: string) => void;
}

/**
 * Wait until the Design (or any) editor on `page` has mounted and stayed still: the
 * document surface is up and neither the Loading card nor the Opening card has shown
 * for a second. Navigating away under those cards races the mount's own writes.
 */
export async function settleEditor(page: Page, timeoutMs: number, opts: { fresh?: boolean } = {}): Promise<void> {
  await page.evaluate(() => { (window as unknown as { __lollyOpenSettled?: number }).__lollyOpenSettled = 0; });
  await page.waitForFunction((fresh: boolean) => {
    const w = window as unknown as { lolly?: { document?: unknown }; __lollyOpenSettled?: number; __lollyPrevSurface?: unknown };
    const surface = w.lolly?.document;
    const ready = !!surface && (!fresh || surface !== w.__lollyPrevSurface) && !document.querySelector('dialog.view-loading[open], .open-progress');
    w.__lollyOpenSettled = ready ? (w.__lollyOpenSettled ?? 0) + 1 : 0;
    return w.__lollyOpenSettled >= 5;
  }, !!opts.fresh, { timeout: timeoutMs, polling: 200 });
}

/** Remember the mounted editor's document surface, so `settleEditor(..., {fresh: true})` waits for the next mount. */
export async function markEditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { lolly?: { document?: unknown }; __lollyPrevSurface?: unknown };
    w.__lollyPrevSurface = w.lolly?.document;
  });
}

/**
 * Open a `.lolly` in the page through `#/open` (plan 291 W8), with no drop and no
 * chooser. The route skips the chooser for a plain saved session only: a file that
 * carries a tool, a design system, templates, a renovation or a project is refused
 * before the page is touched, because it would wait for a person's answer.
 *
 * The caller registers any route of its own (an egress policy) BEFORE calling this:
 * Playwright runs the most recently registered matching route first, so the file's
 * route then answers ahead of a catch-all.
 *
 * Resolves once the page is on the tool with the saved session's slot and the editor
 * has settled.
 */
export async function openSessionInPage(
  page: Page, base: string, bytes: Uint8Array, name: string, opts: OpenSessionInPageOptions = {},
): Promise<{ slot: string; toolId: string }> {
  const timeout = opts.timeoutMs ?? 120_000;
  const refusal = openRouteRefusal(bytes);
  if (refusal) throw new OpenSessionError(`${name} ${refusal}. Open it in the app instead.`);
  const root = base.replace(/\/$/, '');
  const origin = new URL(root).origin;
  const path = `${OPEN_ROUTE_PREFIX}${randomBytes(16).toString('hex')}/${openRouteFileName(name)}`;
  const { remove, requested } = await serveSessionOnce(page, origin, path, bytes);
  try {
    opts.step?.('open the file through #/open');
    await page.goto(`${root}/#/open?lolly=${encodeURIComponent(path)}`, { waitUntil: 'load', timeout: Math.min(timeout, 60_000) });
    // Whichever comes first: the tool address, the route's own failure card, the
    // chooser (a file that is more than a plain session), or a shell that never asks
    // for the file at all (one built before the route). Only the first may time out.
    const never = (): Promise<never> => new Promise<never>(() => {});
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const silent = new Promise<{ kind: 'silent' }>((resolve) => {
      quiet = setTimeout(() => resolve({ kind: 'silent' }), Math.min(timeout, opts.askTimeoutMs ?? OPEN_ROUTE_ASK_MS));
    });
    void requested.then(() => clearTimeout(quiet));
    const outcome = await Promise.race([
      requested.then(() => never()),
      silent,
      page.waitForFunction(() => {
        const slotted = (q: string): boolean => new URLSearchParams(q).has('slot');
        const hashed = /^#\/tool\/[^?/]+\?(.*)$/.exec(location.hash);
        const on = hashed ? slotted(hashed[1]!)
          : /^\/(?:t\/[^/]+|design)$/.test(location.pathname) && slotted(location.search.slice(1));
        return on ? location.href : false;
      }, undefined, { timeout, polling: 100 })
        .then(async (handle) => ({ kind: 'opened' as const, href: String(await handle.jsonValue()) })),
      page.locator('[data-open-route="failed"]').waitFor({ state: 'visible', timeout })
        .then(async () => ({ kind: 'failed' as const, message: (await page.locator('[data-open-route="failed"] p').innerText().catch(() => '')).trim() }))
        .catch(never),
      page.locator('[data-dialog-tag="lolly-intake"]').waitFor({ state: 'visible', timeout })
        .then(() => ({ kind: 'asks' as const }))
        .catch(never),
    ]).finally(() => clearTimeout(quiet));
    if (outcome.kind === 'silent') {
      throw new OpenSessionError(`The web shell at ${root} never asked for ${name}, so it has no #/open route (it predates plan 291 W8). Rebuild it (pnpm run build:web), or point LOLLY_WEB_BASE at a current one.`);
    }
    if (outcome.kind === 'failed') throw new OpenSessionError(`The web shell did not open ${name}: ${outcome.message || 'no reason was given.'}`);
    if (outcome.kind === 'asks') {
      throw new OpenSessionError(`${name} carries more than a saved session (a tool, a design system, templates, a renovation or a project), so the app asks a person what to do with it. Open it in the app instead.`);
    }
    const opened = openedToolSlot(outcome.href);
    if (!opened) throw new OpenSessionError(`The web shell opened ${name} at an address with no slot: ${shortenUrls(outcome.href)}`);
    opts.step?.('wait for the editor to finish loading');
    await settleEditor(page, timeout);
    return opened;
  } finally {
    await remove();
  }
}

// ── Design values as a session ────────────────────────────────────────────────

/** One `image` cell as a session stores it: an id, never resolved bytes. */
function sessionImage(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const ref = value as { id?: unknown; url?: unknown; source?: unknown; pin?: unknown; meta?: unknown };
  if (isBakedRef(ref)) {
    // A baked ref carries its bytes; it travels as those bytes unless it points at a live source.
    const id = assetIdForUrl(ref as never);
    if (id === ref.id && typeof ref.url === 'string' && ref.url.startsWith('data:')) return ref.url;
    return id;
  }
  if (typeof ref.id !== 'string' || !ref.id) return value;
  if (ref.pin !== undefined) return { id: ref.id, ...(typeof ref.source === 'string' ? { source: ref.source } : {}), pin: ref.pin };
  return ref.id;
}

/**
 * Design input values as `packageDesign` takes them, and every `data:` picture lifted
 * out as an asset keyed by its exact URL (so the package carries it as an upload):
 *
 * - a row's `image` is reduced to its id (a resolved ref's bytes are the host's, and a
 *   reopened session resolves its own);
 * - `fill` is applied to rows whose `image` the host could not resolve, by position,
 *   so an id the caller gave is never replaced by an empty cell.
 */
export function designSessionValues(
  values: Record<string, unknown>, fill?: Record<string, unknown>,
): { values: Record<string, unknown>; assets: Array<{ key: string; bytes: Uint8Array; name: string }> } {
  const out: Record<string, unknown> = { ...values };
  const assets = new Map<string, { key: string; bytes: Uint8Array; name: string }>();
  let rows = values.boxes;
  if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch { rows = undefined; } }
  if (Array.isArray(rows)) {
    const given = Array.isArray(fill?.boxes) && (fill!.boxes as unknown[]).length === rows.length ? fill!.boxes as unknown[] : null;
    out.boxes = rows.map((row, index) => {
      if (!row || typeof row !== 'object' || !('image' in row)) return row;
      let image = sessionImage((row as Record<string, unknown>).image);
      if ((image === null || image === undefined || image === '') && given) {
        const source = given[index];
        if (source && typeof source === 'object') image = sessionImage((source as Record<string, unknown>).image) ?? image;
      }
      if (typeof image === 'string' && /^data:image\//i.test(image) && !assets.has(image)) {
        try {
          assets.set(image, { key: image, bytes: decodeDataUrl(image), name: `picture ${assets.size + 1}` });
        } catch { /* a malformed data: URL stays a reference, as the URL path left it */ }
      }
      return { ...(row as Record<string, unknown>), image };
    });
  }
  return { values: out, assets: [...assets.values()] };
}

/**
 * Package Design input values as a saved session for the page (W9). The catalog is not
 * checked and pictures the values name without bytes are written as references, the
 * tolerance the URL transport had; both come back as notes, never as a refusal.
 */
export async function packageDesignSession(
  values: Record<string, unknown>,
  opts: { label?: string; fill?: Record<string, unknown>; assets?: ReadonlyArray<{ key: string; bytes: Uint8Array; name?: string }> } = {},
): Promise<{ bytes: Uint8Array; notes: string[] }> {
  const { packageDesign } = await import('./design-lolly.ts');
  const prepared = designSessionValues(values, opts.fill);
  const { bytes, report } = await packageDesign({ values: prepared.values }, {
    assets: [...prepared.assets, ...(opts.assets ?? [])],
    catalog: null,
    allowMissingMedia: true,
    ...(opts.label ? { label: opts.label } : {}),
  });
  const notes = report.warnings
    .filter((w) => w.code !== 'reference.unchecked' && w.code !== 'asset.unused')
    .map((w) => w.message);
  return { bytes, notes };
}

/**
 * The reserved params of a render query that still mean something once the document
 * itself travels as a session: the theme choice, the emoji set, the deck address, the
 * language, the design system and the export settings. The document's own inputs and
 * the params that would change what is open (`template`, `preset`, `slot`, a packed
 * `z`) are dropped. The result is `slot=<slot>` plus those, ready for an export URL,
 * whose builder then sets the export settings it owns over them.
 */
export function sessionQuery(slot: string, query = ''): string {
  const DROP = new Set(['slot', 'z', 'zx', 'template', 'preset', 'present', 'kiosk', 'full', 'iframe', 'nostage', 'options', 'output', 'filename', 'copy']);
  const from = new URLSearchParams(query);
  const out = new URLSearchParams({ slot });
  for (const [key, value] of from) {
    if (DROP.has(key) || !(RESERVED.has(key) || key.startsWith('_'))) continue;
    out.append(key, value);
  }
  return out.toString();
}

/** The query an export of an opened session carries: its slot, the theme choice, then the reserved params of `extra`. */
export function sessionExportQuery(slot: string, tokenSelection?: Record<string, string>, extra = ''): string {
  const p = new URLSearchParams(sessionQuery(slot, extra));
  if (tokenSelection) p.set('_themes', JSON.stringify(tokenSelection));
  return p.toString();
}

/** What the page's Design check hook answered, or why it could not. */
export type OpenedChecksAnswer = { kind: 'answered'; value: unknown } | { kind: 'no-hook'; reason: string };

/**
 * Open `bytes` in `page` and run `window.lolly.document.check()`, the function the
 * app's "Before you export" card runs. With a theme choice, the editor is reopened on
 * the slot in that theme first. Shared by the CLI and the MCP server, which drives its
 * own page under its egress policy.
 */
export async function checksInOpenedPage(
  page: Page, base: string, bytes: Uint8Array, name: string, tokenSelection: Record<string, string> | undefined,
  timeout: number, step: (name: string) => void = () => {},
): Promise<OpenedChecksAnswer> {
  const opened = await openSessionInPage(page, base, bytes, name, { timeoutMs: timeout, step });
  if (opened.toolId !== 'design') return { kind: 'no-hook', reason: `The file opened in ${opened.toolId}, not the Design editor.` };
  if (tokenSelection) {
    step('reopen the editor in the chosen theme');
    await markEditor(page);
    await page.goto(`${base.replace(/\/$/, '')}/#/tool/design?${sessionExportQuery(opened.slot, tokenSelection)}`, { waitUntil: 'commit', timeout: Math.min(timeout, 60_000) });
    await settleEditor(page, timeout, { fresh: true });
  }
  const hasHook = await page.evaluate(
    () => typeof (window as unknown as { lolly?: { document?: { check?: unknown } } }).lolly?.document?.check === 'function',
  );
  if (!hasHook) {
    return { kind: 'no-hook', reason: 'This web shell build has no Design check hook; rebuild it (pnpm run build:web) or update the desktop app.' };
  }
  step('run the Design checks');
  const value = await page.evaluate(
    () => (window as unknown as { lolly: { document: { check: () => Promise<unknown> } } }).lolly.document.check(),
  );
  // Text the audit could only send to a visual check (over a picture or a gradient)
  // is measured against the rendered pixels under its lines.
  step('measure text over pictures');
  return { kind: 'answered', value: await sampleContrastReviews(page, value) };
}

/** Every http(s) URL longer than `max` characters cut to its head and its length, for an error message. */
export function shortenUrls(message: string, max = 2_000): string {
  return message.replace(/(?:https?|data):[^\s"'<>]+/g, (url) => (url.length > max ? `${url.slice(0, 200)}... (${url.length.toLocaleString('en')} characters)` : url));
}
