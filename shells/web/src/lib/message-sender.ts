// SPDX-License-Identifier: MPL-2.0
/** Who may talk to the app over postMessage.
 *
 * The document surface (`lolly:document`) hands back the whole open document and the
 * editor channel (`lolly:ui`) changes what the editor shows, so both answer only two
 * senders: this app's own origin, and the page that embeds this one. Which pages may
 * embed the app is the deployment's `frame-ancestors` decision. Pages the app frames
 * itself (web page boxes, the Sandbox's opaque preview, anything a user's code runs
 * in) are neither, so they can never read the document or steer the editor. An opaque
 * sender (`null`) or one with no origin is refused outright, because a reply cannot be
 * addressed to it without falling back to `'*'`. */
export interface MessageHost {
  location?: { origin?: string };
  parent?: unknown;
}

export function isTrustedSender(event: { origin?: string; source?: unknown }, win: MessageHost): boolean {
  const origin = event.origin;
  if (!origin || origin === 'null') return false;
  if (win.location?.origin && origin === win.location.origin) return true;
  const embedded = win.parent != null && win.parent !== win;
  return embedded && event.source != null && event.source === win.parent;
}
