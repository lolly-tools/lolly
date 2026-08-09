// SPDX-License-Identifier: MPL-2.0
/**
 * Native site transport, shared by BOTH Tauri shells — the JS half of the
 * Design System studio's website source (plans/97 §9 / SS9).
 *
 * The studio never fetches a site itself. It asks a TRANSPORT for one, and there
 * are exactly two (plan 97 §9, decision resolved: no server fetch, ever): this
 * one, backed by the Rust `site_fetch` command, and the Chrome extension's
 * `lolly-capture/site`. Both hand back the same four things — page HTML,
 * stylesheet text, prefetched icon/og bytes, and the address the HTML really
 * came from — which then go through ONE parser,
 * shells/web/src/lib/design-system/extract-site.ts. Nothing here parses; nothing
 * here decides what to install. That is what keeps the two transports from
 * drifting into two different ideas of what a website contains.
 *
 * Where the capability is absent the studio does not render the Website tile at
 * all. This module is therefore never a fallback and never a stub: if it is
 * loaded, the transport is real.
 *
 * WHY THIS FILE LIVES IN THE PARENT REPO, AND WHY IT TAKES AN `invoke` ADAPTER
 * Same reason as its neighbour state-fs.ts, which set the pattern. Desktop and
 * mobile are separate submodule repos and neither may import from the other, so
 * shared logic belongs in the parent repo — but the parent cannot resolve
 * `@tauri-apps/api` (the Tauri shells are deliberately not npm workspaces, so
 * that package exists only inside each shell's own node_modules). The dependency
 * is inverted: each shell imports `invoke` itself and passes it in, and its
 * `bridge-overrides/site-fetch.ts` is a three-line platform seam. The adapter is
 * also what makes the shape below testable without a Tauri runtime.
 *
 * The directory is named `bridge-overrides/` like the per-shell ones so the
 * tooling keyed on the `shells/<shell>/bridge-overrides` wildcard keeps covering
 * it (the tracker + DNS-resolver greps in docs/verify-yourself.md, the Biome
 * exclusion). Anything that lists the two shells' override dirs LITERALLY still
 * needs this one added by hand.
 *
 * WHAT ACTUALLY WIRES THIS UP TODAY — READ THIS BEFORE TRUSTING THE FILE
 * Nothing in the web shell imports this module, and that is deliberate as of
 * 2026-08-09. The live path is a runtime probe INSIDE the web shell:
 * `detectSiteTransport` in shells/web/src/lib/design-system/sources/website.ts
 * reads the same `__TAURI_INTERNALS__.invoke` global `tauriInvoke()` reads below
 * and invokes the same `site_fetch` command. It has to own its own copy rather
 * than import this one, because shells/web is a separate submodule repository
 * and may not import from the parent repo's tauri-shared — an import that
 * resolves in the umbrella and not in a clone of the web shell is not a
 * dependency, it is a trap.
 *
 * So this module is the BUILD-TIME seam, and it is currently unwired:
 *   • Each shell's vite.config.js maps the bridge module basename `site-fetch`
 *     to its own three-line seam file, exactly as it maps `state` and
 *     `capture` — but that plugin only rewrites an import made from inside a
 *     `bridge/` directory, and there is no `shells/web/src/bridge/site-fetch.ts`
 *     for it to intercept. The key matches nothing. Add that web module (whose
 *     job would be to hand the transport to `host.net._siteFetch`, the optional
 *     member website.ts probes FIRST) and this path lights up unchanged.
 *   • Until then, deleting this file would cost nothing at runtime and lose the
 *     seam. Keeping it is a bet that the explicit bridge member is the better
 *     long-term wiring; the runtime probe is what makes the feature work in the
 *     meantime.
 *
 * The two-path design was right and the reason still stands: the override map
 * is keyed on a FILENAME, and the vite config's own comments record that exact
 * wiring silently breaking once before (the map was keyed on `.js` after the
 * bridge moved to `.ts`, so every override missed and the shell shipped web
 * IndexedDB state). Here it would fail OPEN — no throw, just a Website tile
 * that never appears on the one platform it is meant to work on. What was wrong
 * was assuming a probe nobody calls is a probe that cannot miss.
 */

/** How long the native side may spend on one request. See the Rust default. */
export interface SiteFetchOptions {
  timeoutMs?: number;
}

/** One prefetched byte payload (an icon, an og:image), base64 in `data`. */
export interface SiteAsset {
  /** Absolute address the bytes came from — the key that matches a logo
   *  candidate extract-site.ts derived from the same HTML. */
  url: string;
  /** Content-Type as the server sent it, parameters stripped; '' when absent. */
  mime: string;
  /** Base64 (RFC 4648). */
  data: string;
}

/** Exactly what extract-site.ts needs, plus the bytes the logos room wants. */
export interface SiteFetchResult {
  html: string;
  cssTexts: string[];
  assets: SiteAsset[];
  /** Post-redirect address — pass as extract-site.ts's `baseUrl`. */
  finalUrl: string;
}

/**
 * A way to read one website. `kind` is what the studio names in its consent
 * line before the button is pressed: 'native' reads as "the app fetches {host}
 * directly", 'extension' as "the extension reads {host} in a background tab".
 * Two transports, two honest sentences, never a generic one.
 */
export interface SiteTransport {
  readonly kind: 'native' | 'extension';
  fetchSite(url: string, opts?: SiteFetchOptions): Promise<SiteFetchResult>;
}

/** The narrow slice of `@tauri-apps/api`'s invoke this needs. */
export type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Matches DEFAULT_TIMEOUT_MS in the Rust. Kept here too so a caller that reads
 *  this value and a caller that omits the option see the same number. */
export const DEFAULT_SITE_TIMEOUT_MS = 15_000;

/** Slack over the native deadline before the JS side gives up on its own.
 *  The Rust bounds itself at twice the per-request timeout; this only catches a
 *  command that never resolves at all, so the studio can never hang. */
const WATCHDOG_SLACK_MS = 5_000;

/** Command name — must match `#[tauri::command] pub async fn site_fetch` in both
 *  shells' src-tauri/src/site_fetch.rs. Nothing checks the two sides against
 *  each other, so a rename there is a rename here. */
const COMMAND = 'site_fetch';

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Narrow the IPC payload. It comes from our own Rust, not from the site, so this
 * is not a trust boundary — it is a version boundary: a desktop app updated
 * ahead of (or behind) its frontend must degrade to a thinner result rather than
 * throw a TypeError deep inside the parser.
 */
function normalizeResult(raw: unknown, requestedUrl: string): SiteFetchResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const cssTexts = Array.isArray(r.cssTexts) ? r.cssTexts.filter((t): t is string => typeof t === 'string') : [];
  const assets = Array.isArray(r.assets)
    ? r.assets
        .map((a) => {
          const o = (a ?? {}) as Record<string, unknown>;
          return { url: asString(o.url), mime: asString(o.mime), data: asString(o.data) };
        })
        .filter((a) => a.url.length > 0 && a.data.length > 0)
    : [];
  return {
    html: asString(r.html),
    cssTexts,
    assets,
    // Falling back to the requested URL keeps relative hrefs resolvable even if
    // an older native side never sent one.
    finalUrl: asString(r.finalUrl) || requestedUrl,
  };
}

/** The native side rejects with a plain String; keep it, wrapped as an Error. */
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const msg = typeof e === 'string' ? e : String(e);
  return new Error(msg.length > 0 ? msg : 'The site could not be read.');
}

/**
 * Build the transport over an injected `invoke`.
 *
 * Nothing is fetched until `fetchSite` is called, and `fetchSite` is only ever
 * called from the studio's button. Constructing this is free and silent, which
 * is what lets a shell wire it at boot without that being a network act.
 */
export function createNativeSiteTransport(invoke: InvokeFn): SiteTransport {
  return {
    kind: 'native',
    async fetchSite(url: string, opts?: SiteFetchOptions): Promise<SiteFetchResult> {
      const timeoutMs = Number.isFinite(opts?.timeoutMs) ? Number(opts?.timeoutMs) : DEFAULT_SITE_TIMEOUT_MS;

      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const guard = new Promise<never>((_, reject) => {
        watchdog = setTimeout(
          () => reject(new Error('The site did not answer in time.')),
          timeoutMs * 2 + WATCHDOG_SLACK_MS,
        );
      });

      try {
        // Tauri maps camelCase argument keys onto the command's snake_case
        // parameters, so `timeoutMs` here is `timeout_ms` there.
        const raw = await Promise.race([invoke(COMMAND, { url, timeoutMs }), guard]);
        return normalizeResult(raw, url);
      } catch (e) {
        throw toError(e);
      } finally {
        clearTimeout(watchdog);
      }
    },
  };
}

/**
 * Tauri's own IPC entry point, read off the global rather than imported.
 *
 * Same feature detection as lib/instance-choice.ts's isTauriShell(), reading the
 * same internal. Using the global keeps this module free of `@tauri-apps/api`,
 * which is what lets the parent repo own it AND lets a web-shell module import
 * it directly (see the header's path 2).
 */
export function tauriInvoke(): InvokeFn | null {
  if (typeof window === 'undefined') return null;
  const internals = (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  return typeof invoke === 'function' ? (invoke as InvokeFn) : null;
}

/**
 * The native transport when this is a Tauri shell, otherwise null.
 *
 * A synchronous, zero-cost verdict — the same shape of answer
 * `hasCaptureExtension()` gives for the other transport, so the studio can
 * decide at boot whether the Website tile exists without a probe that could
 * itself be a network act.
 *
 * It answers for the RUNTIME, not for the build: a Tauri shell whose native side
 * predates the `site_fetch` command returns a transport whose first call
 * rejects. That is the honest failure (an error on the press the user chose)
 * rather than a silently missing tile, and both shells ship the command as of
 * this change.
 *
 * NOT CALLED BY THE WEB SHELL — see the header. The equivalent probe lives in
 * `sources/website.ts`, because a submodule cannot import across the repo
 * boundary. This one stays for a caller inside the Tauri shells themselves.
 */
export function nativeSiteTransport(): SiteTransport | null {
  const invoke = tauriInvoke();
  return invoke ? createNativeSiteTransport(invoke) : null;
}
