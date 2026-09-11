// SPDX-License-Identifier: MPL-2.0
/**
 * The **website source** (plan 97 section 9, M6) - a first-party site as design-system
 * material, on the two shells that can actually read one.
 *
 * section 9's decision is the structure of this file: **no server fetch, ever**. The
 * deployed PWA cannot reach an arbitrary origin at all (`connect-src` allowlists
 * six hosts, so this dies at CSP before CORS is even asked), and `api/ingest`
 * was ruled out rather than built. So the reading is done by whatever on-device
 * transport the person already has:
 *
 *  - **Tauri** - a native fetch (the Rust `site_fetch` command), which has no
 *    CORS or CSP to answer to. Probed two ways, because one of them can miss:
 *    an optional bridge member a shell's `bridge-overrides` may add, and - the
 *    one that cannot miss - Tauri's own `__TAURI_INTERNALS__.invoke` global.
 *    A build-time override keyed on a FILENAME has silently failed in this repo
 *    before, and here it would fail OPEN: no throw, just a tile that never
 *    appears on the one platform it is meant to work on. The runtime probe owns
 *    no filename, so a rename cannot break it.
 *  - **Chromium + the Lolly extension** - the capture extension already holds
 *    `debugger`/`tabs` + `<all_urls>`; alongside its PNG capture it answers a
 *    site request with the rendered page's HTML, stylesheet text and asset
 *    bytes. **The wire protocol for that lives in exactly one place** - 
 *    `bridge/capture-extension.ts`, beside the `capture` request that shares the
 *    relay - and this module adapts it rather than restating it. It restated it
 *    once, disagreed with the shipped extension on both the request type and
 *    the reply's shape, and the only symptom was a 60 s wait ending in
 *    "{host} took too long to answer": a wrong answer that blames the site.
 *
 * `detectSiteTransport` returns `null` when neither exists, and that null is the
 * whole gate: **the Website tile is not rendered otherwise**. Never show someone
 * a source they cannot use.
 *
 * Three lines the module holds to:
 *
 *  1. **Nothing is fetched before a press.** This module has no boot-time work
 *     and no ambient behaviour; `scanWebsite` fetches once, for the address it
 *     was handed. A `?source=url&u=` deep link only prefills - it never reaches
 *     here on its own.
 *  2. **First-party only, no crawling.** One address, one page, whatever the
 *     transport resolved for it. Links are not followed; the only sub-resources
 *     read are the stylesheets and candidate logo bytes the transport already
 *     resolved for that one page.
 *  3. **Machine reasons, never a throw.** Every failure comes back as a
 *     `refused` result with a token the caller renders through its own `t()` - 
 *     the same stance as `sources/pdf.ts`. A source picker that throws on a
 *     hostile page is a source picker that loses the press.
 *
 * The parsing itself is not here: `extract-site.ts` is the pure HTML/CSS →
 * census reader, and this module is the transport seam around it - address
 * validation, the fetch, pairing logo bytes onto the URLs the parser found, and
 * the section 9 bonus of feeding a screenshot through the image census so colours
 * painted by a webfont or a canvas (which no stylesheet declares) are seen too.
 *
 * Everything with judgement in it is a pure exported function taking plain data,
 * so it runs under bare node; the transports are injected, so the tests use
 * fakes and no test ever needs a browser, an extension or a network.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';
import { imageColorCloud } from '@lolly/engine';

import { censusFromImageCloud, mergeCensus } from '../census.ts';
import type { DesignCensus } from '../census.ts';
import { extractSite } from '../extract-site.ts';
import { PENDING_LOGO_MAX_BYTES, PENDING_LOGO_MAX_FILES } from '../pending-files.ts';
import * as captureBridge from '../../../bridge/capture-extension.ts';

// ── The transport contract ───────────────────────────────────────────────────

/** One sub-resource a transport resolved for the page - a favicon, an
 *  `apple-touch-icon`, an `og:image`. Bytes only; nothing here re-fetches. */
export interface SiteAsset {
  url: string;
  bytes: Uint8Array;
  /** As the transport received it. Treated as a claim, not a fact - see
   *  {@link sniffImageMime}. */
  mime: string;
}

/** What one page read produced. Every field is what the TRANSPORT saw, so a
 *  redirect shows up as a `finalUrl` different from the address asked for. */
export interface SiteFetchResult {
  html: string;
  cssTexts: string[];
  assets: SiteAsset[];
  finalUrl: string;
  /** The rendered page as an image, when the transport can paint one. Optional
   *  by design: the native fetch has no renderer, the extension does. */
  screenshot?: Uint8Array;
}

/**
 * A way to read one page on this device.
 *
 * `label` is a MACHINE token, never display copy - the caller maps it through
 * its own `t()`, because the consent sentence is the caller's to write and it
 * differs per transport ("The extension reads {host} in a background tab" vs
 * "The app fetches {host} directly"). Copy lives with the button that IS the
 * consent, not in a lib module.
 */
export interface SiteTransport {
  kind: 'extension' | 'native';
  label: string;
  fetchSite(url: string, opts?: { timeoutMs?: number }): Promise<SiteFetchResult>;
}

/** A logo the page pointed at, with its bytes when the transport brought them. */
export interface SiteLogoCandidate {
  url: string;
  bytes?: Uint8Array;
  /** Present only alongside `bytes`, and always the SNIFFED type. */
  mime?: string;
}

// ── Caps ─────────────────────────────────────────────────────────────────────

/** Same ceiling `extract-site.ts` puts on a URL it resolves. */
export const SITE_MAX_URL_CHARS = 2_048;

/**
 * How long a transport gets before this module stops waiting.
 *
 * The transport owns the real deadline (it is the one that can cancel a tab or
 * abort a socket) and is told this number; the race below is only the backstop
 * for a transport that dies without answering, which on the extension path
 * means a background service worker that was torn down mid-request. Generous
 * for the same reason `capture-extension.ts` allows 90s: a real page load and
 * settle is slow, and a false timeout costs a re-press of a consent button.
 */
export const SITE_TIMEOUT_MS = 60_000;

/** Extra time the backstop allows past `timeoutMs`, so a transport that reports
 *  its own timeout wins the race and the caller gets the better reason. */
const TIMEOUT_GRACE_MS = 2_000;

/**
 * Belt-and-braces size caps on what a transport hands back.
 *
 * Both transports cap at the fetch - but a page is untrusted input arriving over
 * two independent code paths, and stating the ceiling once here means the parser
 * cannot be handed 200 MB of markup because one of them regressed. Over-cap
 * input is TRUNCATED, not refused: `extract-site.ts` is deliberately tolerant of
 * a document that stops mid-tag, and a partial read of a huge page is worth more
 * than nothing at all. Truncation is reported as a warning so the caller can say
 * the read was partial.
 */
export const SITE_MAX_HTML_CHARS = 4_000_000;
export const SITE_MAX_CSS_CHARS = 8_000_000;
export const SITE_MAX_STYLESHEETS = 60;

/** Logo candidates offered from one page, and the byte ceiling per candidate - 
 *  the Logos room's own caps, so nothing travels that the room would refuse. */
export const SITE_MAX_LOGOS = PENDING_LOGO_MAX_FILES;
export const SITE_MAX_LOGO_BYTES = PENDING_LOGO_MAX_BYTES;

/**
 * Prefetched files one answer may carry, and the total bytes across them.
 *
 * The same belt-and-braces reasoning as the html/css ceilings above, and it has
 * to be stated in the same terms: an asset list is not free to read, because
 * every entry is DECODED into a buffer on the way in. Both transports already
 * cap (10 files, 8 MB in total), so these are the outer bound on a transport
 * that regressed, not the working limit. Over-cap entries lose their bytes and
 * keep their URL, exactly as {@link pairLogoAssets} does one step later.
 */
export const SITE_MAX_ASSETS = 24;
export const SITE_MAX_ASSET_TOTAL_BYTES = 16 * 1024 * 1024;

/**
 * Colour buckets kept from a screenshot.
 *
 * 24 is the studio's own condense ceiling (`condenseColors` in `views/start.ts`)
 * and comfortably more than the tray shows. A screenshot's tail is page chrome,
 * anti-aliasing and photography; taking more of it would only crowd the merge.
 */
export const SITE_MAX_SHOT_COLORS = 24;

// ── Address validation (pure) ────────────────────────────────────────────────

export type SiteUrlRefusal =
  /** Nothing typed. */
  | 'empty-url'
  /** Not an address at all once a scheme was assumed. */
  | 'unparseable-url'
  /** Named a scheme that is not `http`/`https` - `javascript:`, `data:`, `file:`. */
  | 'unsupported-scheme'
  /** Carried a user:password. */
  | 'credentials-in-url'
  /** Longer than {@link SITE_MAX_URL_CHARS}. */
  | 'url-too-long';

export type SiteUrlCheck =
  | { ok: true; url: string; siteHost: string }
  | { ok: false; reason: SiteUrlRefusal };

/** Schemes named in the refusal rather than letting the parse fail. */
const BAD_SCHEME_RE = /^(?:javascript|data|blob|file|about|mailto|tel|ftp|ws|wss|view-source|chrome|chrome-extension|moz-extension):/i;
/** An explicit `scheme://` prefix. Bare `localhost:3000` is NOT one of these,
 *  which is why the test is for `://` rather than for a colon. */
const HAS_ORIGIN_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const HTTP_SCHEME_RE = /^https?:\/\//i;
/** An interior space or control character - what a line-wrapped paste and a
 *  smuggling attempt both look like. A scan rather than a character class: a
 *  control character inside a regex literal is unreadable, and the linter is
 *  right to say so. */
function hasControlOrSpace(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Normalise what someone typed into an address worth fetching, or say why not.
 *
 * **`https` is assumed, never `http`.** A person types "suse.com"; assuming the
 * unencrypted scheme would silently downgrade a fetch they never described. A
 * site that only serves `http` still works - they can type it.
 *
 * **Credentials are refused, not stripped.** `https://user:pw@example.com` would
 * send that secret to a third party from the person's own machine, and the host
 * would then sit in a provenance chip. Quietly dropping them would fetch a
 * different (probably 401) page than the one described; refusing says so.
 *
 * **Nothing about privacy is decided here.** No allowlist, no blocklist, no
 * refusal of `localhost` or a private range: there is no server in this
 * feature, so there is no SSRF to prevent, and someone reading their own
 * dev site is the plainest legitimate case there is. The address is the
 * person's; the only judgements are "is it an address" and "is it fetchable".
 *
 * The fragment survives: an SPA route lives in one, and the extension transport
 * renders the live page.
 */
export function normalizeSiteUrl(raw: unknown): SiteUrlCheck {
  const input = typeof raw === 'string' ? raw.trim() : '';
  if (input.length === 0) return { ok: false, reason: 'empty-url' };
  if (input.length > SITE_MAX_URL_CHARS) return { ok: false, reason: 'url-too-long' };
  if (hasControlOrSpace(input)) return { ok: false, reason: 'unparseable-url' };
  if (BAD_SCHEME_RE.test(input)) return { ok: false, reason: 'unsupported-scheme' };
  if (HAS_ORIGIN_SCHEME_RE.test(input) && !HTTP_SCHEME_RE.test(input)) {
    return { ok: false, reason: 'unsupported-scheme' };
  }

  const candidate = HTTP_SCHEME_RE.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: 'unparseable-url' };
  }
  // The assumed scheme cannot produce anything else, but an explicit one can be
  // spelled in ways the prefix test above misses, so the parse has the last word.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'unsupported-scheme' };
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return { ok: false, reason: 'credentials-in-url' };
  }
  if (parsed.hostname.length === 0) return { ok: false, reason: 'unparseable-url' };
  if (parsed.href.length > SITE_MAX_URL_CHARS) return { ok: false, reason: 'url-too-long' };

  return { ok: true, url: parsed.href, siteHost: parsed.hostname };
}

/** The host a scanned page belongs to - the provenance chip's text ("from
 *  suse.com"), and the noun the caller puts in its consent sentence. */
function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

// ── Bytes across a transport boundary (pure) ─────────────────────────────────

const B64_RE = /^[A-Za-z0-9+/\r\n]+={0,2}$/;
const DATA_URL_RE = /^data:([^;,]*)(;base64)?,/i;

function b64ToBytes(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s+/g, '');
  if (clean.length === 0 || clean.length % 4 !== 0 || !B64_RE.test(clean)) return null;
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Bytes out of whatever a transport could carry them in.
 *
 * A Tauri command answers over JSON, where a `Uint8Array` becomes an array of
 * numbers; the extension answers over `postMessage`, where the practical
 * encoding is base64 (structured clone can carry a typed array, but the
 * extension's own relay hop stringifies) and a screenshot arrives as the same
 * `data:` URL its capture sibling returns. All three are the same fact, so all
 * three are accepted here rather than in two nearly-identical adapters.
 *
 * Anything else - a number, an object, a string that is not base64 - is `null`.
 * A transport that hands over something unreadable contributes nothing; it does
 * not get to throw inside a scan.
 */
export function toBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value.length > 0 ? value : null;
  if (value instanceof ArrayBuffer) return value.byteLength > 0 ? new Uint8Array(value) : null;
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.byteLength > 0
      ? new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength))
      : null;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const out = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const n = Number(value[i]);
      if (!Number.isFinite(n)) return null;
      out[i] = n & 0xff;
    }
    return out;
  }
  if (typeof value === 'string') {
    const data = DATA_URL_RE.exec(value);
    if (data) {
      // A non-base64 data URL is percent-encoded text - an inline SVG, which is
      // a perfectly good logo.
      const body = value.slice(data[0].length);
      if (data[2]) return b64ToBytes(body);
      try { return new TextEncoder().encode(decodeURIComponent(body)); } catch { return null; }
    }
    return b64ToBytes(value);
  }
  return null;
}

/**
 * What these bytes actually are, by their own leading bytes.
 *
 * The declared type is a claim by a third-party server, and the claim that
 * matters most is the one a 404 page makes when it is served with a 200 in place
 * of a missing favicon: HTML bytes labelled `image/x-icon`. Installing that as a
 * logo would be silent nonsense, so the SNIFF is authoritative and an
 * unrecognised head means the bytes are dropped (the URL still travels).
 *
 * SVG is text, so it is sniffed as text: a leading `<svg`, an XML declaration or
 * a doctype, within the first few hundred bytes to allow for a comment banner.
 */
export function sniffImageMime(bytes: Uint8Array | null | undefined): string | null {
  if (!bytes || bytes.length < 4) return null;
  const b = bytes;
  const u32 = (i: number): number =>
    (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;

  if (u32(0) === 0x89504e47) return 'image/png';
  if ((b[0] ?? 0) === 0xff && (b[1] ?? 0) === 0xd8 && (b[2] ?? 0) === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  // ICO/CUR: reserved 0, type 1 or 2, little-endian.
  if (b[0] === 0 && b[1] === 0 && (b[2] === 1 || b[2] === 2) && b[3] === 0) return 'image/x-icon';

  const ascii = (from: number, len: number): string => {
    let s = '';
    for (let i = from; i < from + len && i < b.length; i++) s += String.fromCharCode(b[i] ?? 0);
    return s;
  };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1' || brand === 'msf1') return 'image/heic';
  }

  const head = ascii(0, Math.min(b.length, 512)).replace(/^\ufeff/, '').trimStart().toLowerCase();
  if (head.startsWith('<svg')) return 'image/svg+xml';
  if (head.startsWith('<?xml') || head.startsWith('<!doctype svg')) {
    return head.includes('<svg') ? 'image/svg+xml' : null;
  }
  return null;
}

// ── Coercing a transport's answer (pure) ─────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * How many bytes a carrier WOULD decode to, without decoding it.
 *
 * The point of the estimate is that it costs nothing: `toBytes` allocates the
 * whole buffer, so measuring afterwards is a cap on memory already spent. Every
 * branch over-states rather than under-states - a base64 string is at most
 * three bytes per four characters, a percent-encoded data URL at most one byte
 * per character - so a carrier this admits is genuinely under the ceiling, and
 * the exact length is re-checked after the decode anyway.
 */
function byteLengthHint(value: unknown): number {
  if (value instanceof Uint8Array) return value.length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') {
    const data = DATA_URL_RE.exec(value);
    const body = data ? value.length - data[0].length : value.length;
    return data && !data[2] ? body : Math.ceil((body * 3) / 4);
  }
  return 0;
}

/**
 * A transport's raw answer as a `SiteFetchResult`, with the caps applied.
 *
 * Both transports cross a serialisation boundary, so neither can be trusted to
 * have produced the declared TypeScript shape: this is where a JSON blob becomes
 * the type the rest of the module reads, and where the ceilings in the Caps
 * section are actually enforced. Missing fields become empty ones; a page that
 * carries no stylesheets is an ordinary page, not an error.
 *
 * Returns the truncation warnings alongside, because a partial read must be
 * reportable - the caller says "read this far", never implies the whole page.
 */
export function coerceFetchResult(
  value: unknown,
  requestedUrl: string,
): { result: SiteFetchResult; warnings: SiteScanWarning[] } {
  const warnings: SiteScanWarning[] = [];
  const raw = (value ?? {}) as Record<string, unknown>;

  let html = str(raw.html);
  if (html.length > SITE_MAX_HTML_CHARS) {
    html = html.slice(0, SITE_MAX_HTML_CHARS);
    warnings.push('html-truncated');
  }

  const cssTexts: string[] = [];
  let cssChars = 0;
  const rawCss = Array.isArray(raw.cssTexts) ? raw.cssTexts : [];
  for (const entry of rawCss) {
    if (typeof entry !== 'string' || entry.length === 0) continue;
    if (cssTexts.length >= SITE_MAX_STYLESHEETS || cssChars >= SITE_MAX_CSS_CHARS) {
      warnings.push('css-truncated');
      break;
    }
    const room = SITE_MAX_CSS_CHARS - cssChars;
    if (entry.length > room) {
      cssTexts.push(entry.slice(0, room));
      warnings.push('css-truncated');
      cssChars = SITE_MAX_CSS_CHARS;
      continue;
    }
    cssTexts.push(entry);
    cssChars += entry.length;
  }

  const assets: SiteAsset[] = [];
  const rawAssets = Array.isArray(raw.assets) ? raw.assets : [];
  let assetBytes = 0;
  for (const entry of rawAssets) {
    if (assets.length >= SITE_MAX_ASSETS) {
      warnings.push('assets-truncated');
      break;
    }
    const row = (entry ?? {}) as Record<string, unknown>;
    const url = str(row.url).trim();
    if (url.length === 0) continue;
    // `bytes` is the declared field; `base64` and `data` are what the two wire
    // encodings call it, and accepting all three keeps the transports honest
    // rather than making one of them rename a field it already ships.
    const carrier = row.bytes ?? row.base64 ?? row.data;
    // Judged BEFORE the decode, and again after: the estimate is what keeps a
    // 200 MB carrier from being allocated in order to discover it is 200 MB,
    // and the exact length is what actually enforces the ceiling.
    const hint = byteLengthHint(carrier);
    if (hint > SITE_MAX_LOGO_BYTES || assetBytes + hint > SITE_MAX_ASSET_TOTAL_BYTES) {
      warnings.push('logo-too-large');
      continue;
    }
    const bytes = toBytes(carrier);
    if (!bytes) continue;
    if (bytes.length > SITE_MAX_LOGO_BYTES || assetBytes + bytes.length > SITE_MAX_ASSET_TOTAL_BYTES) {
      warnings.push('logo-too-large');
      continue;
    }
    assetBytes += bytes.length;
    assets.push({ url, bytes, mime: str(row.mime ?? row.type).trim().toLowerCase() });
  }

  let finalUrl = str(raw.finalUrl).trim();
  if (finalUrl.length > 0) {
    const check = normalizeSiteUrl(finalUrl);
    if (check.ok) {
      finalUrl = check.url;
    } else {
      // A redirect that lands somewhere unfetchable is not a reason to lose the
      // read: relative URLs resolve against the address asked for instead, which
      // is where they resolved before the redirect anyway.
      finalUrl = requestedUrl;
      warnings.push('final-url-invalid');
    }
  } else {
    finalUrl = requestedUrl;
  }

  // Four spellings for one fact, for the same reason the asset carrier has
  // three: each transport already ships the name it ships, and a shared coercer
  // that knows all of them beats making one of them rename a field.
  const screenshot = toBytes(
    raw.screenshot ?? raw.screenshotPng ?? raw.screenshotDataUrl ?? raw.screenshotBase64,
  );
  const result: SiteFetchResult = { html, cssTexts, assets, finalUrl };
  if (screenshot) result.screenshot = screenshot;
  // One truncation is one fact however many sheets it took to hit the ceiling.
  return { result, warnings: [...new Set(warnings)] };
}

// ── Pairing logo bytes onto the URLs the parser found (pure) ─────────────────

/** Absolute form of `url` against `base`, for comparing two spellings of one
 *  address. Unresolvable input compares as itself. */
function absolute(url: string, base: string): string {
  const v = url.trim();
  if (v.length === 0) return '';
  try { return new URL(v, base).href; } catch { return v; }
}

/**
 * The logo URLs `extractSite` ranked, carrying the bytes the transport brought.
 *
 * Order is the parser's and is not re-ranked: it already knows that an
 * `apple-touch-icon` beats a favicon beats an `og:image` beats a header `<img>`,
 * and a byte count is not evidence about which mark is the real one.
 *
 * A URL with no matching asset still travels, without bytes. That is a real
 * candidate to a caller that can act on a URL (a Tauri shell can fetch it; a
 * report can quote it) and it is honest about what happened - dropping it would
 * quietly turn "the transport did not fetch this one" into "the page did not
 * have one". Bytes are kept only when they sniff as an image and fit under
 * {@link SITE_MAX_LOGO_BYTES}; anything else keeps the URL and reports why.
 */
export function pairLogoAssets(
  logoUrls: readonly string[],
  assets: readonly SiteAsset[],
  opts: { baseUrl?: string; max?: number } = {},
): { candidates: SiteLogoCandidate[]; warnings: SiteScanWarning[] } {
  const base = opts.baseUrl ?? '';
  const asked = Number(opts.max);
  const max = Number.isFinite(asked) ? Math.max(0, Math.min(Math.trunc(asked), SITE_MAX_LOGOS)) : SITE_MAX_LOGOS;
  const warnings = new Set<SiteScanWarning>();

  const byUrl = new Map<string, SiteAsset>();
  for (const asset of assets ?? []) {
    const key = absolute(asset.url, base || asset.url);
    if (key.length === 0 || byUrl.has(key)) continue;
    byUrl.set(key, asset);
  }

  const candidates: SiteLogoCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of logoUrls ?? []) {
    if (candidates.length >= max) break;
    const url = typeof raw === 'string' ? raw.trim() : '';
    if (url.length === 0) continue;
    const key = absolute(url, base || url);
    if (seen.has(key)) continue;
    seen.add(key);

    const asset = byUrl.get(key);
    if (!asset) { candidates.push({ url }); continue; }
    if (asset.bytes.length > SITE_MAX_LOGO_BYTES) {
      warnings.add('logo-too-large');
      candidates.push({ url });
      continue;
    }
    const mime = sniffImageMime(asset.bytes);
    if (!mime) {
      warnings.add('logo-not-image');
      candidates.push({ url });
      continue;
    }
    candidates.push({ url, bytes: asset.bytes, mime });
  }

  return { candidates, warnings: [...warnings] };
}

// ── Letting a screenshot speak without shouting (pure) ───────────────────────

const totalWeight = (census: DesignCensus): number =>
  census.colors.reduce((sum, c) => sum + (Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0), 0);

/**
 * The screenshot census rescaled so it and the stylesheet census carry the same
 * total weight.
 *
 * `census.ts` states the rule this bends, and here it is: weights are
 * occurrence counts and are never normalised, because rescaling one source's
 * counts against another's is a claim about relative importance that no source
 * makes. That rule holds between sources that count the same KIND of thing. Here
 * they do not: the stylesheet census counts DECLARATIONS (tens), the screenshot
 * counts PIXELS (hundreds of thousands). Merging those raw is itself the claim - 
 * that one pixel weighs what one declaration weighs - and it costs the whole
 * declared palette, because the tray takes the top candidates by weight and a
 * page's own background would fill every slot.
 *
 * So the two are given equal voice and nothing else is touched: order and
 * proportion WITHIN each source survive exactly, only the units are matched.
 * With no declared colours to balance against there is nothing to swamp, and the
 * screenshot passes through unscaled.
 */
export function balanceShotWeights(base: DesignCensus, shot: DesignCensus): DesignCensus {
  const baseTotal = totalWeight(base);
  const shotTotal = totalWeight(shot);
  if (baseTotal <= 0 || shotTotal <= 0 || shotTotal === baseTotal) return shot;
  const factor = baseTotal / shotTotal;
  return { ...shot, colors: shot.colors.map(c => ({ ...c, weight: c.weight * factor })) };
}

// ── Transports ───────────────────────────────────────────────────────────────

/**
 * The optional native member the Tauri bridge overrides add.
 *
 * Named structurally rather than declared on `NetAPI`, because the web bridge
 * NEVER implements it and a contract member that one shell must be trusted not
 * to provide is worse than a presence probe. The leading underscore says the
 * same thing: this is a shell-private extension of the bridge, not part of the
 * tool-facing `HostV1` surface.
 */
interface NativeSiteFetchNet {
  _siteFetch?: (url: string, opts?: { timeoutMs?: number }) => Promise<unknown>;
}

/**
 * The capture bridge's site half, read STRUCTURALLY.
 *
 * Two reasons, and the second is the one that matters. It keeps this module
 * loading whether or not that bridge has grown the pair yet (no probe means no
 * announced protocol, which means no extension transport). And it keeps the
 * extension's wire protocol - request type, reply type, id field, payload shape
 * - in exactly ONE file, next to the `capture` request that shares the relay,
 * rather than restated here where it can silently disagree. It did disagree,
 * and the failure was a 60 s wait blamed on the site.
 */
const captureExt = captureBridge as {
  hasSiteCapture?: () => boolean;
  createExtensionSiteTransport?: () => {
    read(url: string, options?: { screenshot?: boolean; timeoutMs?: number }): Promise<unknown>;
  };
};

/**
 * The extension transport: one page read in a background tab the extension owns.
 *
 * An ADAPTER, not an implementation - the bridge owns the relay, this owns the
 * shape the scan reads. Two things happen on the way through: the answer goes
 * through `coerceFetchResult`, the single place a wire payload becomes a typed
 * one for both transports (and the single place the caps are enforced), and no
 * screenshot is asked for. section 9 offers the page AS PAINTED as a bonus census, but
 * the extension paints one through a DevTools attach, which shows the person a
 * "being debugged" banner: a second, unannounced thing for one press of a
 * button whose sentence promised a read. It is carried when it arrives, so
 * asking for it later is a one-word change in this function.
 */
function createExtensionSiteTransport(): SiteTransport | null {
  const make = captureExt.createExtensionSiteTransport;
  if (typeof make !== 'function') return null;
  const bridge = make();
  return {
    kind: 'extension',
    label: 'extension-tab',
    async fetchSite(url, opts) {
      const raw = await bridge.read(url, opts?.timeoutMs ? { timeoutMs: opts.timeoutMs } : {});
      return coerceFetchResult(raw, url).result;
    },
  };
}

/** The native transport over whatever native fetch was found. */
function createNativeSiteTransport(
  fetchSite: (url: string, opts?: { timeoutMs?: number }) => Promise<unknown>,
  thisArg?: unknown,
): SiteTransport {
  return {
    kind: 'native',
    label: 'native-fetch',
    async fetchSite(url, opts) {
      const raw = await fetchSite.call(thisArg, url, opts);
      return coerceFetchResult(raw, url).result;
    },
  };
}

/** The narrow slice of Tauri's IPC this needs. */
type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/**
 * Tauri's own IPC entry point, read off the global rather than imported.
 *
 * The same feature detection `lib/instance-choice.ts`'s `isTauriShell()` does,
 * reading the same internal, and it is deliberately not an import: the web
 * shell is its own repository and cannot import a Tauri shell's module, and
 * `@tauri-apps/api` does not resolve here at all (the Tauri shells are not npm
 * workspaces). A global costs nothing to read and is true at runtime.
 */
function tauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') return null;
  const internals = (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  return typeof invoke === 'function' ? (invoke as TauriInvoke) : null;
}

/**
 * The Tauri shells' `site_fetch` command, as a plain fetch function.
 *
 * Command name and argument spelling are the contract with
 * `shells/tauri-{desktop,mobile}/src-tauri/src/site_fetch.rs`: Tauri maps a
 * camelCase key onto the command's snake_case parameter, so `timeoutMs` here is
 * `timeout_ms` there, and the Rust clamps it into its own range. Nothing checks
 * the two sides against each other, so a rename there is a rename here.
 *
 * A shell whose native side predates the command rejects on the press rather
 * than hiding the tile. That is the honest failure: an error on the thing the
 * person chose to do, not a feature that silently is not there.
 */
function tauriSiteFetch(invoke: TauriInvoke): (url: string, opts?: { timeoutMs?: number }) => Promise<unknown> {
  return (url, opts) => {
    const timeoutMs = Number(opts?.timeoutMs);
    return invoke('site_fetch', Number.isFinite(timeoutMs) && timeoutMs > 0 ? { url, timeoutMs } : { url });
  };
}

/**
 * The way this device can read a page, or `null`.
 *
 * `null` is required: section 9's decision is that the Website source exists only
 * where a real transport does, and the source picker must not render the tile
 * otherwise. There is no third branch to add later - a server fetch was ruled
 * out, not deferred.
 *
 * Native wins when both exist. It is a plain HTTP client with no CORS, CSP or
 * tab lifecycle in the way, and it does not borrow a browser the person is
 * using; the extension path is the fallback that makes the feature reachable
 * without installing a desktop app.
 *
 * THREE PROBES, IN ORDER, and the second is the one that saves the feature:
 *
 *  1. `host.net._siteFetch` - an optional bridge member a shell's overrides may
 *     add. First because a shell that went to the trouble of providing one
 *     knows something this module does not.
 *  2. Tauri's `__TAURI_INTERNALS__.invoke` global → the `site_fetch` command.
 *     The build-time override that was supposed to supply (1) is keyed on a
 *     FILENAME and there is no web-shell file with that name, so it never fires
 * - and its failure mode is silence: no throw, just a Website tile that
 *     never appears on the two shells the capabilities page names as the way to
 *     get one. A probe that owns no filename cannot miss that way.
 *  3. The extension, if it announced a site protocol this build speaks.
 *
 * Probing only. Nothing is fetched, no tab is opened and no permission is asked
 * for by asking this question.
 */
export function detectSiteTransport(host: HostV1 | null | undefined): SiteTransport | null {
  const net = host?.net as (NativeSiteFetchNet | undefined);
  const native = net?._siteFetch;
  if (typeof native === 'function') return createNativeSiteTransport(native, net);

  const invoke = tauriInvoke();
  if (invoke) return createNativeSiteTransport(tauriSiteFetch(invoke));

  try {
    const probe = captureExt.hasSiteCapture;
    if (typeof probe === 'function' && probe()) return createExtensionSiteTransport();
  } catch {
    // A probe that throws is a probe that says no.
  }
  return null;
}

// ── The scan ─────────────────────────────────────────────────────────────────

/** Why a scan produced nothing. Each maps to the caller's own sentence. */
export type SiteScanRefusal =
  | SiteUrlRefusal
  /** No transport was passed - the tile should not have rendered. */
  | 'no-transport'
  /** The transport answered with an error. `detail` carries its own words. */
  | 'fetch-failed'
  /** Nothing came back inside the deadline. */
  | 'timeout'
  /** The transport succeeded and the page had no markup to read. */
  | 'empty-page';

/** A part of the read that was partial or skipped. Never fatal. */
export type SiteScanWarning =
  | 'html-truncated'
  | 'css-truncated'
  /** A transport carried more prefetched files than {@link SITE_MAX_ASSETS}. */
  | 'assets-truncated'
  | 'final-url-invalid'
  /** A screenshot arrived but could not be decoded here (no DOM, or bad bytes). */
  | 'screenshot-failed'
  /** A logo's bytes were not an image by their own leading bytes. */
  | 'logo-not-image'
  /** A logo's bytes were over {@link SITE_MAX_LOGO_BYTES}. */
  | 'logo-too-large';

/** Progress phases, for a caller that shows a line while the read runs. */
export type SiteScanPhase = 'fetch' | 'read' | 'paint' | 'done';

export type SiteScanResult =
  | {
      kind: 'scanned';
      census: DesignCensus;
      logoCandidates: SiteLogoCandidate[];
      siteName?: string;
      /** Families a `fonts.googleapis.com` link asked for, in discovery order. */
      googleFamilies: string[];
      /** Where the read actually landed, after any redirect. */
      finalUrl: string;
      /** That address's host - the provenance chip, and the consent noun. */
      siteHost: string;
      transport: SiteTransport['kind'];
      /** True when the transport painted the page and its colours were read. */
      usedScreenshot: boolean;
      warnings: SiteScanWarning[];
    }
  | { kind: 'refused'; reason: SiteScanRefusal; detail?: string; limit?: number };

const errText = (err: unknown): string => String((err as { message?: unknown })?.message ?? err);

/**
 * A screenshot's painted colours as a census, or null.
 *
 * section 9's bonus, and the reason it is worth the code: a stylesheet only declares
 * what a stylesheet can declare. A wordmark set in a webfont, a hero drawn into
 * a canvas, a brand colour that only exists inside a background image - none of
 * those appear in `extract-site.ts`'s output at all, and all of them are in the
 * pixels.
 *
 * The decoder is imported on demand (it drags in the bitmap/codec chunk, exactly
 * as `views/start.ts` does for a dropped image) and only where a DOM exists - 
 * decoding needs a canvas, so a headless run skips straight to the warning
 * rather than loading a codec that cannot work.
 */
async function screenshotCensus(bytes: Uint8Array, label: string): Promise<DesignCensus | null> {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return null;
  try {
    const { sampleImageFile } = await import('../../image-sample.ts');
    const type = sniffImageMime(bytes) ?? 'image/png';
    const img = await sampleImageFile(new Blob([bytes as unknown as BlobPart], { type }));
    const cloud = imageColorCloud(img.data, img.width, img.height, {
      space: img.space,
      maxPoints: SITE_MAX_SHOT_COLORS,
    });
    return censusFromImageCloud(cloud, label);
  } catch {
    return null;
  }
}

/**
 * Read one page into design-system material: a census, logo candidates, the
 * site's own name, and the Google families it asks for.
 *
 * The order of operations is the privacy posture in code. The address is
 * validated first, so a refusal costs no fetch; the transport is then called
 * ONCE, for that one address; and everything after it is local parsing. Nothing
 * here retries, follows a link, or reaches a second origin.
 *
 * Failures are return values, always. The caller renders `reason` through its
 * own `t()`; `detail` is a transport's own words and belongs in a log, not in a
 * sentence built for a person.
 *
 * @param transport   from {@link detectSiteTransport} - injected so tests fake it
 * @param url         whatever the person typed; validated here, not by the caller
 * @param onProgress  optional phase reporter; its errors can never abort a scan
 */
export async function scanWebsite(
  transport: SiteTransport | null | undefined,
  url: string,
  onProgress?: (phase: SiteScanPhase) => void,
  opts: { timeoutMs?: number; host?: HostV1 | null } = {},
): Promise<SiteScanResult> {
  const progress = (phase: SiteScanPhase): void => {
    try { onProgress?.(phase); } catch { /* a reporter's problem, not the scan's */ }
  };
  const log = (level: 'warn' | 'debug', msg: string, ctx?: object): void => {
    try { opts.host?.log?.(level, msg, ctx); } catch { /* logging must never be fatal */ }
  };

  const check = normalizeSiteUrl(url);
  if (!check.ok) {
    return check.reason === 'url-too-long'
      ? { kind: 'refused', reason: check.reason, limit: SITE_MAX_URL_CHARS }
      : { kind: 'refused', reason: check.reason };
  }
  if (!transport || typeof transport.fetchSite !== 'function') {
    return { kind: 'refused', reason: 'no-transport' };
  }

  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : SITE_TIMEOUT_MS;

  progress('fetch');
  let answer: unknown;
  try {
    // The transport owns the deadline; this race is the backstop for one that
    // never answers at all, and it loses by `TIMEOUT_GRACE_MS` to a transport
    // reporting its own timeout, whose reason is the better one.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs + TIMEOUT_GRACE_MS);
    });
    try {
      answer = await Promise.race([transport.fetchSite(check.url, { timeoutMs }), deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    const detail = errText(err);
    log('warn', 'website source: fetch failed', { host: check.siteHost, detail });
    return /timeout|timed out|abort/i.test(detail)
      ? { kind: 'refused', reason: 'timeout' }
      : { kind: 'refused', reason: 'fetch-failed', detail };
  }

  const { result, warnings: coerceWarnings } = coerceFetchResult(answer, check.url);
  if (result.html.trim().length === 0) return { kind: 'refused', reason: 'empty-page' };

  progress('read');
  const warnings = new Set<SiteScanWarning>(coerceWarnings);
  const extract = extractSite({
    html: result.html,
    cssTexts: result.cssTexts,
    baseUrl: result.finalUrl,
  });

  const paired = pairLogoAssets(extract.logoUrls, result.assets, { baseUrl: result.finalUrl });
  for (const w of paired.warnings) warnings.add(w);

  let census = extract.census;
  let usedScreenshot = false;
  if (result.screenshot) {
    progress('paint');
    const shot = await screenshotCensus(result.screenshot, census.source.label);
    if (shot) {
      // The site census leads the merge, so the merged provenance and name stay
      // the page's own rather than the picture of it.
      census = mergeCensus([census, balanceShotWeights(census, shot)]);
      usedScreenshot = true;
    } else {
      warnings.add('screenshot-failed');
      log('debug', 'website source: screenshot not read', { host: check.siteHost });
    }
  }

  progress('done');
  const out: SiteScanResult = {
    kind: 'scanned',
    census,
    logoCandidates: paired.candidates,
    googleFamilies: extract.googleFamilies,
    finalUrl: result.finalUrl,
    siteHost: hostOf(result.finalUrl) || check.siteHost,
    transport: transport.kind,
    usedScreenshot,
    warnings: [...warnings],
  };
  if (extract.siteName) out.siteName = extract.siteName;
  return out;
}
