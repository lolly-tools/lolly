// SPDX-License-Identifier: MPL-2.0
/**
 * The shell's built-in send-target providers, registered once, ON DEMAND - the
 * first time an export panel mounts (views/tool-actions.ts). Each target is
 * individually DORMANT until its own config exists (its `available()` gate - e.g.
 * gdrive needs a Google OAuth client id), so registering all of them costs nothing
 * on a plain build: the panel consults sendTargetsFor() and renders exactly nothing.
 *
 * Which is why the driver modules are `await import()`ed here rather than
 * imported statically, and why nothing calls this from boot any more (plans/155
 * Task 3.3): as static imports they welded ~59 KB of OAuth/upload code (nextcloud-send
 * alone is 25 KB) onto the boot graph for a capability that first matters when an
 * export panel opens - and for most builds, never.
 *
 * Organisation-owned targets use their own stable registry ids, so late built-in
 * registration cannot replace them even when both use the same provider kind. This is
 * intentional: an instance destination supplements rather than confiscates a person's
 * own connection.
 *
 * Adding a provider = one driver module exposing a SendTarget (see
 * lib/google-drive.ts for the reference shape: config gate, popup OAuth via
 * public/oauth-return.html, upload, viewable-link outcome) + one line here.
 * Keep `kind` ids aligned with the lolly-work provider vocabulary
 * ('dropbox', 'o365', …) so both worlds speak the same names.
 */
import { registerSendTarget } from './send-target.ts';
import { listConnections } from './provider-connections.ts';

/** The one-shot promise every caller shares. */
let registered: Promise<void> | null = null;

/**
 * Register the built-ins once and resolve when the registry is ready to be READ -
 * meaning both the targets and the connection cache their availability gate reads
 * synchronously (see below). Callers await this before rendering send destinations,
 * and every later caller reuses the same promise, so a second export panel costs
 * nothing. A failed run is not cached: the rejection propagates and the next caller
 * retries, since a driver chunk that lost the network once may well arrive next time.
 */
export function ensureBuiltinSendTargets(): Promise<void> {
  registered ??= registerBuiltinSendTargets().catch((err: unknown) => {
    registered = null;
    throw err;
  });
  return registered;
}

export async function registerBuiltinSendTargets(): Promise<void> {
  const [gdrive, dropbox, onedrive, s3, nextcloud, penpot, mastodon, bluesky, discord, linkedin, wallpaper] = await Promise.all([
    import('./google-drive.ts'),
    import('./dropbox-send.ts'),
    import('./onedrive-send.ts'),
    import('./s3-send.ts'),
    import('./nextcloud-send.ts'),
    // Penpot (plans/173): renders into a design file's media library, via the
    // app-origin proxy - the one target whose bytes cross a Lolly server.
    import('./penpot-send.ts'),
    // The publish tier (plans/129 WP5): post-shaped destinations.
    import('./mastodon-send.ts'),
    import('./bluesky-send.ts'),
    import('./discord-send.ts'),
    // Desktop-only (plans/129 WP4b): LinkedIn's token endpoint demands a client
    // secret and offers PKCE to partner apps only, so its gate is the shell.
    import('./linkedin-send.ts'),
    // Desktop-shell wallpaper (plans/174): no connection, no network - the XDG
    // portal previews and the user confirms.
    import('./wallpaper-send.ts'),
  ]);
  registerSendTarget(gdrive.googleDriveSendTarget());
  registerSendTarget(dropbox.dropboxSendTarget());
  registerSendTarget(onedrive.oneDriveSendTarget());
  registerSendTarget(s3.s3SendTarget());
  registerSendTarget(nextcloud.nextcloudSendTarget());
  registerSendTarget(penpot.penpotSendTarget());
  registerSendTarget(mastodon.mastodonSendTarget());
  registerSendTarget(bluesky.blueskySendTarget());
  registerSendTarget(discord.discordSendTarget());
  registerSendTarget(linkedin.linkedinSendTarget());
  registerSendTarget(wallpaper.wallpaperSendTarget());
  // Connection-gated kinds (s3, webdav, mastodon, bluesky, discord, linkedin) gate on
  // hasConnection(), a SYNC read of the in-memory cache, so a saved connection only
  // surfaces in the export panel (without a /profile visit first) once that cache is
  // warm. AWAIT the warm-up rather than firing provider-connections' fire-and-forget
  // primeConnections(): registering at boot left seconds before anything read the
  // registry and the difference was invisible, but the caller now re-renders the
  // panel the moment this resolves - resolve early and it re-renders against a cold
  // cache, dropping exactly the connections the user saved. Never fatal: no IDB just
  // means no stored connections to find.
  await listConnections().catch(() => { /* no IDB - nothing to warm */ });
}
