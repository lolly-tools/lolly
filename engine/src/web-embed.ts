// SPDX-License-Identifier: MPL-2.0
/**
 * Web page boxes (plan 288): what a Design box may frame, and in what form. Pure and
 * DOM-free; nothing here touches the network.
 *
 * A web box stores the link as the person gave it (its `web` field). This module turns
 * that into what a frame loads, or refuses it, and every shell asks it before a frame
 * exists, so web, desktop, CLI and MCP agree on what is embeddable:
 *
 *   - a LOLLY link (this app's origin, or lolly.tools) to a tool route becomes a
 *     same-origin frame of that tool in `iframe` mode: the output only, keeping nothing
 *     (the Sandbox is the case that matters most: a live code demo with no network);
 *   - a known PROVIDER link becomes that provider's embed form, the way tldraw does it:
 *     store the original, render the transformed (YouTube `watch` to its no-cookie
 *     embed, CodePen `pen` to `embed`, and so on);
 *   - any other `https:` page is framed as it is, with the strictest sandbox;
 *   - `http:` only for this machine's own dev servers (localhost, 127.0.0.1, [::1]).
 *
 * Refused outright: credentials in the URL, any scheme but http(s), `data:`/`blob:`
 * (which would run as this app), and same-origin paths outside tools and documentation. A
 * site known to forbid framing comes back with `refuses`, and the UI tells the author
 * before anyone tries. `HOSTED_FRAME_ORIGINS` is the list the hosted web CSP names in
 * `frame-src` (plan 288 D2): a test pins the two together, and the shell uses it to say
 * "this deployment's security policy blocks this site" instead of showing a blank frame.
 */

import { DEFAULT_REFERENCE_SITES, matchTrustedSite } from './trusted-sites.ts';

export type WebEmbedKind = 'lolly' | 'provider' | 'page';

export interface WebEmbed {
  /** The link as given, trimmed; a pasted `<iframe>` snippet is reduced to its `src`. */
  source: string;
  /** What the frame loads. */
  src: string;
  kind: WebEmbedKind;
  /** `sandbox`, `lolly`, `youtube`, …, or `page` for an unknown site. */
  provider: string;
  /** Plain words for the UI and the frame's accessible title: "YouTube video". */
  label: string;
  /** The host a person recognises (no `www.`). */
  host: string;
  /** The `sandbox` attribute, or null for a same-origin Lolly frame, which runs as the app. */
  sandbox: string | null;
  /** The `allow` (Permissions-Policy) attribute. */
  allow: string;
  /** Width over height for a newly added box. */
  aspect: number;
  /** Default layout width in CSS pixels, when the page should be laid out wider than the box. */
  viewport?: number;
  /** The site is known to forbid framing (X-Frame-Options / frame-ancestors). */
  refuses?: boolean;
  /** Author-written code runs there: as open as any site for the hosted CSP (plan 288 D2). */
  authorCode?: boolean;
  /** Only Chromium can run it (StackBlitz WebContainers). */
  chromiumOnly?: boolean;
  /** A dev server on this machine. */
  loopback?: boolean;
  /** Same origin as the app. */
  sameOrigin: boolean;
}

export interface WebEmbedContext {
  /** The app's own origin, e.g. `https://lolly.tools` or `http://localhost:5173`. */
  appOrigin: string;
  /** When given, a Lolly link must name a tool this build ships. */
  knownTool?: (id: string) => boolean;
}

/** Named players and reference sources in the hosted frame policy, pinned by tests. */
export const HOSTED_FRAME_ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.loom.com',
  'https://www.google.com',
  'https://www.figma.com',
  'https://wikipedia.org',
  ...DEFAULT_REFERENCE_SITES.map(site => `https://${site}`),
] as const;

/** Origins a Lolly link may come from besides the app's own. */
const LOLLY_ORIGINS = new Set(['https://lolly.tools']);

const MAX_URL = 16_384;
const PAGE_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';
const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';
const PLAYER_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
/** Export and download triggers never ride into a framed tool. */
const LOLLY_DROP = /^(format|export|copy|output|download|filename|nostage|full|options|present|kiosk|slot|iframe)(=|$)/;

/** Sites that forbid being framed (checked 2026-09-30). The UI shows their poster and
 *  an "Open in new tab" instead of a frame that would stay blank. */
const REFUSERS = new Set([
  'github.com', 'gist.github.com', 'colab.research.google.com', 'x.com', 'twitter.com',
  'developer.mozilla.org', 'stackoverflow.com', 'news.ycombinator.com', 'play.grafana.org',
]);

/** Parse a pasted link or `<iframe>` snippet. Null when it cannot be framed safely. */
export function parseWebEmbed(input: unknown, ctx: WebEmbedContext): WebEmbed | null {
  if (typeof input !== 'string') return null;
  let source = input.trim();
  if (!source || source.length > MAX_URL) return null;
  if (/^<iframe[\s>]/i.test(source)) {
    const m = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(source);
    const raw = m ? (m[1] ?? m[2] ?? m[3] ?? '') : '';
    source = raw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (!source) return null;
  }
  // A bare domain ("youtube.com/watch?v=…") is a link without its scheme.
  // A dev server typed as `localhost:3000` must be caught first: the URL parser would read
  // `localhost:` as a scheme.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$|\?|#)/i.test(source)) source = 'http://' + source;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(source) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/|$|\?|#)/i.test(source)) source = 'https://' + source;
  let url: URL;
  try { url = new URL(source); } catch { return null; }
  if (url.username || url.password) return null;
  const loopback = LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;

  let app: URL | null = null;
  try { app = new URL(ctx.appOrigin); } catch { app = null; }
  const sameOrigin = !!app && url.origin === app.origin;
  if (sameOrigin || LOLLY_ORIGINS.has(url.origin)) {
    return lollyEmbed(source, url, ctx, app) ?? lollyDocs(source, url, app) ?? null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const provider = providerEmbed(url, host);
  if (provider) return { source, sameOrigin: false, host, ...provider };
  const refuses = REFUSERS.has(host) || (host === 'docs.google.com' && !/\/(embed|pub)(\/|\?|$)/.test(url.pathname));
  return {
    source, src: url.href, kind: 'page', provider: 'page', sameOrigin: false,
    label: loopback ? `Dev server on ${url.host}` : `Page on ${host}`, host,
    sandbox: PAGE_SANDBOX,
    allow: loopback ? 'fullscreen; clipboard-write; local-network-access' : 'fullscreen; clipboard-write',
    aspect: 16 / 10, viewport: 1280,
    ...(refuses ? { refuses: true } : {}),
    ...(loopback ? { loopback: true } : {}),
  };
}

/** Documentation is a controlled static page, never a privileged application route. */
function lollyDocs(source: string, url: URL, app: URL | null): WebEmbed | undefined {
  const path = /^\/info\/?$/.test(url.pathname) ? '/info/index.html' : url.pathname;
  if (!/^\/info\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/.test(path)) return undefined;
  const origin = app?.origin ?? url.origin;
  return {
    source, src: `${origin}${path}${url.search}${url.hash}`, kind: 'page', provider: 'lolly-docs',
    label: 'Lolly documentation', host: new URL(origin).host, sameOrigin: true,
    sandbox: PAGE_SANDBOX, allow: 'fullscreen; clipboard-write', aspect: 16 / 10, viewport: 1280,
  };
}

function lollyEmbed(source: string, url: URL, ctx: WebEmbedContext, app: URL | null): WebEmbed | undefined {
  // Only the tool routes: an arbitrary same-origin path (an API route, a catalog file)
  // would run with the app's full privileges and is never a web page box.
  // Parsed here rather than through tool-url's parseToolUrl, whose 4 KB cap is right for
  // an image link but too small for a Sandbox link carrying a whole demo's code.
  const hash = /^#\/?tool\/([a-z0-9][a-z0-9-]*[a-z0-9])(?:\?(.*))?$/.exec(url.hash);
  const path = /^\/t\/([a-z0-9][a-z0-9-]*[a-z0-9])\/?$/.exec(url.pathname);
  const ref = hash ? { toolId: hash[1]!, query: hash[2] ?? '' } : path ? { toolId: path[1]!, query: url.search.replace(/^\?/, '') } : null;
  if (!ref) return undefined;
  if (ctx.knownTool && !ctx.knownTool(ref.toolId)) return undefined;
  const kept = ref.query.split('&').filter((p) => p && !LOLLY_DROP.test(p));
  kept.push('iframe');
  const origin = app ? app.origin : url.origin;
  const isSandbox = ref.toolId === 'sandbox';
  return {
    source, kind: 'lolly', provider: isSandbox ? 'sandbox' : 'lolly', sameOrigin: true,
    src: `${origin}/#/tool/${ref.toolId}?${kept.join('&')}`,
    label: isSandbox ? 'Sandbox demo' : `Lolly ${ref.toolId}`,
    host: app ? app.host : url.host,
    sandbox: null,
    allow: 'fullscreen; clipboard-write',
    aspect: 16 / 10,
  };
}

type ProviderPart = Omit<WebEmbed, 'source' | 'host' | 'sameOrigin'>;

function player(provider: string, label: string, src: string, aspect = 16 / 9): ProviderPart {
  return { kind: 'provider', provider, label, src, sandbox: PLAYER_SANDBOX, allow: PLAYER_ALLOW, aspect };
}
function codeSite(provider: string, label: string, src: string, extra: Partial<ProviderPart> = {}): ProviderPart {
  return { kind: 'provider', provider, label, src, sandbox: PAGE_SANDBOX, allow: 'fullscreen; clipboard-write', aspect: 4 / 3, authorCode: true, ...extra };
}

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

/** YouTube's `t` parameter: `90`, `90s`, `1m30s`, `1h2m3s`. */
function ytSeconds(t: string | null): number {
  if (!t) return 0;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) : 0;
}

function providerEmbed(url: URL, host: string): ProviderPart | null {
  const segs = url.pathname.split('/').filter(Boolean);
  switch (host) {
    case 'youtube.com': case 'youtube-nocookie.com': case 'youtu.be': {
      const id = host === 'youtu.be' ? segs[0]
        : segs[0] === 'watch' || url.pathname === '/watch' ? url.searchParams.get('v')
          : (segs[0] === 'embed' || segs[0] === 'shorts' || segs[0] === 'live') ? segs[1] : null;
      if (!id || !YT_ID.test(id)) return null;
      const start = ytSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
      // enablejsapi lets a presenting deck pause a kept player when its slide is left.
      const q = new URLSearchParams({ rel: '0', enablejsapi: '1' });
      if (start > 0) q.set('start', String(start));
      const list = url.searchParams.get('list');
      if (list && /^[A-Za-z0-9_-]+$/.test(list)) q.set('list', list);
      return player('youtube', 'YouTube video', `https://www.youtube-nocookie.com/embed/${id}?${q}`);
    }
    case 'vimeo.com': case 'player.vimeo.com': {
      const id = host === 'player.vimeo.com' ? (segs[0] === 'video' ? segs[1] : null) : segs.find((s) => /^\d+$/.test(s));
      if (!id || !/^\d+$/.test(id)) return null;
      const q = new URLSearchParams();
      const hash = host === 'vimeo.com' ? segs[segs.indexOf(id) + 1] : url.searchParams.get('h');
      if (hash && /^[a-f0-9]+$/i.test(hash)) q.set('h', hash);
      const t = /#t=([\dhms]+)/.exec(url.hash)?.[1];
      return player('vimeo', 'Vimeo video', `https://player.vimeo.com/video/${id}${q.size ? `?${q}` : ''}${t ? `#t=${t}` : ''}`);
    }
    case 'loom.com': {
      const id = (segs[0] === 'share' || segs[0] === 'embed') ? segs[1] : null;
      if (!id || !/^[a-f0-9]{16,64}$/i.test(id)) return null;
      return player('loom', 'Loom video', `https://www.loom.com/embed/${id}`);
    }
    case 'google.com': case 'maps.google.com': {
      if (!(host === 'maps.google.com' || segs[0] === 'maps')) return null;
      if (segs[0] === 'maps' && segs[1] === 'embed' && url.searchParams.get('pb')) {
        return player('google-maps', 'Google map', `https://www.google.com/maps/embed?pb=${encodeURIComponent(url.searchParams.get('pb')!)}`, 4 / 3);
      }
      const q = url.searchParams.get('q');
      if (!q) return null;
      return player('google-maps', 'Google map', `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`, 4 / 3);
    }
    case 'figma.com': {
      if (!['file', 'design', 'proto', 'board', 'slides', 'deck'].includes(segs[0] ?? '')) return null;
      const q = new URLSearchParams({ embed_host: 'lolly', url: url.href });
      return { ...player('figma', 'Figma file', `https://www.figma.com/embed?${q}`, 16 / 10), allow: 'fullscreen; clipboard-write' };
    }
    case 'codepen.io': {
      const i = segs.findIndex((s) => s === 'pen' || s === 'full' || s === 'details' || s === 'embed');
      if (i !== 1 || !segs[0] || !segs[2]) return null;
      return codeSite('codepen', 'CodePen', `https://codepen.io/${segs[0]}/embed/${segs[2]}?default-tab=result`);
    }
    case 'stackblitz.com': {
      if (segs[0] !== 'edit' || !segs[1]) return null;
      const q = new URLSearchParams(url.search); q.set('embed', '1');
      return codeSite('stackblitz', 'StackBlitz project', `https://stackblitz.com/edit/${segs[1]}?${q}`, { chromiumOnly: true });
    }
    case 'codesandbox.io': {
      const id = segs[0] === 's' || segs[0] === 'embed' ? segs[1] : segs[0] === 'p' && segs[1] === 'sandbox' ? segs[2] : null;
      if (!id) return null;
      return codeSite('codesandbox', 'CodeSandbox', `https://codesandbox.io/embed/${id}`);
    }
    case 'jsfiddle.net': {
      if (!segs[0] || !segs[1]) return null;
      return codeSite('jsfiddle', 'JSFiddle', `https://jsfiddle.net/${segs[0]}/${segs[1]}/embedded/result/`);
    }
    case 'observablehq.com': {
      const path = segs[0] === 'embed' ? segs.slice(1) : segs;
      if (!path[0]?.startsWith('@') || !path[1]) return null;
      return codeSite('observable', 'Observable notebook', `https://observablehq.com/embed/${path[0]}/${path[1]}`, { aspect: 16 / 10 });
    }
    case 'asciinema.org': {
      if (segs[0] !== 'a' || !segs[1]) return null;
      return { ...player('asciinema', 'Terminal recording', `https://asciinema.org/a/${segs[1]}/iframe`, 16 / 10), allow: 'fullscreen' };
    }
    default:
      return null;
  }
}

/** True when the hosted web CSP lets this frame load (plan 288 D2): the app's own origin,
 *  or one of the named player origins. */
export function allowedOnHostedWeb(embed: Pick<WebEmbed, 'src' | 'sameOrigin'>): boolean {
  if (embed.sameOrigin) return true;
  try { return (HOSTED_FRAME_ORIGINS as readonly string[]).includes(new URL(embed.src).origin)
    || !!matchTrustedSite(embed.src, DEFAULT_REFERENCE_SITES); } catch { return false; }
}
