// SPDX-License-Identifier: MPL-2.0
/**
 * The lolly:// scheme, mapped onto the app's own routes (plans/174).
 *
 * A deep link is an app address with the site name taken for granted:
 * `lolly://<route>` is `https://lolly.tools/<route>`, and it is the string an OS
 * hands the installed app - a Raycast or Alfred "open URL" action, `open` /
 * `xdg-open` / `start` in a terminal, a .desktop Action, a GNOME Shell or KRunner
 * result, an Android or iOS link tap. Three sources feed it (the desktop poll loop
 * in linux-desktop-boot.ts, the Android LollyShare bridge and the iOS queue behind
 * drop-router.ts's initDeepLinkIntake) and all of them route through here, so the
 * grammar is decided once.
 *
 * `web+lolly:` is the same address in the one spelling a browser will hand an
 * installed PWA: a web app may only register a scheme in the `web+` namespace, so
 * the manifest's protocol_handlers entry claims `web+lolly` and the browser opens
 * `/?deep-link=web+lolly://…`. The prefix is stripped here and nothing else
 * changes - one grammar, two spellings, and a fourth source feeding it.
 *
 * The rule: a deep link may only open a route the app already owns. Tool forms
 * go through the engine's own recogniser (parseToolUrl: `t/<id>`, `tool/<id>`,
 * `tool/<id>.<ext>` and a bare `<id>`); everything else must start with a word
 * from APP_PATH_WORDS, the frozen route vocabulary of plan 171. A link that is
 * neither is refused with null, never forwarded. An OS-delivered string is
 * untrusted input, and "navigate wherever it says" is how a crafted link would
 * reach a route that was never meant to be linkable.
 */
import { APP_PATH_WORDS, parseToolUrl } from '../../../../engine/src/tool-url.ts';

const SCHEME_RE = /^(?:web\+)?lolly:\/\/+/i;
// The PWA spelling's prefix, stripped before anything reads the link.
const WEB_PREFIX_RE = /^web\+/i;
// lolly.art was retired on 2026-09-10 (a 308 to lolly.tools at the domain level); its
// links keep opening in the app here rather than bouncing through the web first.
const HOST_RE = /^(?:www\.)?lolly\.(?:tools|art)(?=[/?#]|$)\/?/i;
const WEB_HOSTS = new Set(['lolly.tools', 'www.lolly.tools', 'lolly.art', 'www.lolly.art']);
// The engine's own cap on a Lolly URL (tool-url.ts MAX_URL), so a link the engine
// would refuse is refused here too instead of becoming an oversized hash.
const MAX_LINK = 4096;

/**
 * `lolly://tool/qr-code?url=x` → `#/tool/qr-code?url=x`; `lolly://lab` → `#/lab`;
 * `lolly://verify?asset=…` → `#/verify?asset=…`. `web+lolly://lab` is the same
 * address (the PWA spelling). Null for anything else, including an https link
 * (only the scheme is a deep link) and a route word with no route.
 */
export function deepLinkToHash(link: string): string | null {
  if (typeof link !== 'string' || !SCHEME_RE.test(link)) return null;
  // One canonical string from here down, so the `web+` spelling cannot take a
  // looser path than the bare one - the engine's recogniser below only knows
  // `lolly:`, and every check runs against the same value.
  const canonical = link.replace(WEB_PREFIX_RE, '');
  const rest = canonical.replace(SCHEME_RE, '').replace(HOST_RE, '');
  if (!rest || rest.length > MAX_LINK || /[\s<>"'\\]/.test(rest)) return null;

  const tool = parseToolUrl(canonical);
  if (tool) {
    let query = tool.query;
    // An embed-form extension (`tool/qr-code.svg`) names a format the GUI reads
    // from the `format=` param, so carry it across unless the query already says.
    if (tool.format && !/(^|&)format=/.test(query)) {
      query = query ? `${query}&format=${tool.format}` : `format=${tool.format}`;
    }
    return `#/tool/${tool.toolId}${query ? `?${query}` : ''}`;
  }

  // A fragment inside a hash route means nothing, so it is dropped rather than
  // forwarded as a second '#'.
  const pathAndQuery = rest.split('#')[0] ?? '';
  const qi = pathAndQuery.indexOf('?');
  const path = (qi === -1 ? pathAndQuery : pathAndQuery.slice(0, qi)).replace(/\/+$/, '');
  const query = qi === -1 ? '' : pathAndQuery.slice(qi);
  const head = path.split('/')[0] ?? '';
  if (!head || !APP_PATH_WORDS.has(head)) return null;
  // `tool`/`t` with no valid id fell through parseToolUrl above: refuse rather than
  // open half an address.
  if (head === 'tool' || head === 't') return null;
  return `#/${path}${query}`;
}

/**
 * Turn a public Lolly web address into the equivalent installed-app address.
 * This is deliberately the inverse exposed by the Share dialog, not a general
 * scheme swap: foreign origins and app routes the deep-link allowlist would
 * refuse return null. Both the canonical `/t/<id>?…` share form and the older
 * `/#/tool/<id>?…` SPA form are accepted.
 */
export function toLollyAppLink(link: string): string | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !WEB_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  let route = `${url.pathname.replace(/^\/+/, '')}${url.search}`;
  // A root SPA address carries the actual app route in its hash. Canonical share
  // links use /t/<id>, but accepting this form makes copied address-bar links just
  // as useful and gives the helper a clean migration story for older bookmarks.
  if ((!route || route === '/') && url.hash.startsWith('#/')) route = url.hash.slice(2);
  if (!route) return null;
  const candidate = `lolly://${route}`;
  return deepLinkToHash(candidate) ? candidate : null;
}
