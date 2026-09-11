// SPDX-License-Identifier: MPL-2.0
/**
 * Tiny HTML responses for the OAuth popup. The completion page posts the
 * enrollment token to the opener - targetOrigin is the allowlisted origin
 * carried in the signed state, never '*' - and closes itself. The token is
 * deliberately not rendered anywhere a human could copy it from; the visible
 * fallback just says to return to Lolly.
 */

// JSON.stringify plus <-escaping so embedded values are inert inside <script>.
const js = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const shell = (title, body, script = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: SUSE, system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #0c322c; color: #efefef; text-align: center; }
  main { padding: 2rem; max-width: 26rem; }
  h1 { font-size: 1.3rem; margin: 0 0 0.5rem; }
  p { color: #b7c8c4; line-height: 1.5; }
</style>
</head>
<body>
<main>${body}</main>
${script}</body>
</html>
`;

/** Deliver { source: 'lolly-ca', type: 'enroll-token', token } to the app, then close.
 *  TWO channels, same payload: under the app's cross-origin isolation
 *  (COOP: same-origin) the opener handle is severed once this popup has been
 *  through the provider's cross-origin pages, so BroadcastChannel is the
 *  same-origin path that still reaches it (both ends must carry the same
 *  isolation headers - the handler sets them on this response). Non-isolated
 *  browsers keep working through the opener path. */
export function completionPage({ token, origin }) {
  const script = `<script>
(function () {
  var payload = ${js({ source: 'lolly-ca', type: 'enroll-token', token })};
  var delivered = false;
  try {
    var bc = new BroadcastChannel('lolly-ca');
    bc.postMessage(payload);
    bc.close();
    delivered = true;
  } catch (e) { /* no BroadcastChannel - the opener path below covers it */ }
  try {
    if (window.opener) {
      window.opener.postMessage(payload, ${js(origin)});
      delivered = true;
    }
  } catch (e) { /* fall through to the visible message */ }
  if (delivered) window.close();
})();
</script>
`;
  return shell('Lolly - verified', `<h1>You&#39;re verified</h1>
<p>Return to Lolly to finish setting up Content Credentials. You can close this window.</p>`, script);
}

/** Human-readable failure page for the popup (no script, no token). */
export function errorPage(message) {
  return shell('Lolly - sign-in failed', `<h1>Sign-in didn&#39;t complete</h1>
<p>${escapeHtml(message)}</p>
<p>Close this window and try again from Lolly.</p>`);
}
