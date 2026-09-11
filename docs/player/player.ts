// SPDX-License-Identifier: MPL-2.0
/**
 * The docs "Listen to this page" player - Phase 2c: migrated onto the shared
 * @lolly-tools/audio-dock shell, so the published /info docs use the SAME dock
 * component as the app (one component everywhere).
 *
 * This file is now a thin ENTRY POINT: it owns the singleton lifecycle (a second
 * Listen press focuses the open dock, never stacks a twin) and hands the shell a
 * dependency-free narration `DockHost` (docs/player/narration-host.ts) that ports
 * the old player's logic - audio-index.json resolution, cues/markdown-twin
 * follow-along, speed, cross-page playlist, Media Session. The shell renders the
 * whole dock (transport, scrub, caption, Follow-along, Speed, the AI disclosure)
 * and draws its OWN built-in 2D frequency backdrop from the host's analyser tap - 
 * so the /info bundle never pulls in butterchurn.
 *
 * ISOLATION (hard constraint): /info is a SEPARATE document that must NOT import
 * the SPA module graph. audio-dock is the only shared dependency, imported by a
 * RELATIVE path (`../../packages/audio-dock/src/index.ts`) - the same way
 * docs/build.ts imports `../packages/docs-render` - and esbuild-bundled into
 * /info/docs-player.js by docs/build.ts's bundleDocsPlayer. The shell is
 * dependency-free by design, so it bundles cleanly; nothing here reaches into
 * shells/web.
 *
 * Delivered as /info/docs-player.js, imported lazily on the first press of a
 * page's Listen button (or on arrival, when the previous page's auto-advance left
 * a hand-off in sessionStorage - see docs/build.ts's LISTEN_SCRIPT).
 */
import { createAudioDock, type DockController } from '../../packages/audio-dock/src/index.ts';
import { createDocsNarrationHost, type DocsNarrationHost } from './narration-host.ts';
import { createDocsTtsHost, type DocsTtsHost } from './tts-host.ts';

/** Either narration host satisfies DockHost and offers play()/destroy(); the dock
 *  drives them identically. Produced audio is preferred; device voice is the
 *  fallback that lets a Listen pill work on every page (plan 131 B.3). */
type NarrationHost = DocsNarrationHost | DocsTtsHost;

export interface OpenOpts {
  slug: string;
  title: string;
  /** Start playback immediately (the Listen press, or an auto-advance arrival). */
  autoplay?: boolean;
  /** The Listen button, so closing the dock can hand focus back. */
  trigger?: HTMLElement | null;
}

// The single open dock, if any. A second Listen press focuses it rather than
// building a twin.
let active: { controller: DockController; host: NarrationHost; trigger: HTMLElement | null } | null = null;
// Claimed for the async gap between "resolve the track" and "mount the dock", so
// two quick presses can't both fetch and build a twin.
let opening = false;

/** Entry point the pages' Listen loader calls. */
export async function openDocsPlayer(opts: OpenOpts): Promise<void> {
  if (active) {
    if (opts.autoplay) void active.host.play();
    focusPlay(active.controller);
    return;
  }
  if (opening) return;
  opening = true;

  let host: NarrationHost | null = null;
  try {
    // Produced audio wins where it exists (the polished front-door voice); every
    // other page falls back to the reader's own device voice (plan 131 B.3).
    host = await createDocsNarrationHost({ slug: opts.slug, title: opts.title });
    if (!host) host = createDocsTtsHost({ slug: opts.slug, title: opts.title });
  } finally {
    opening = false;
  }
  if (!host) return; // no produced audio, no device voice, or nothing speakable - mount nothing
  // A concurrent open won the slot while we awaited: stand this one down.
  if (active) { host.destroy(); return; }

  // The PAGE-level styles (follow-along highlight + heading seek cursor) ride
  // beside the bundle as /info/docs-player.css. The DOCK's own CSS is injected by
  // the shell; this link is only the on-page bits. Linked once, before the dock
  // appears, so the first highlight paints styled.
  ensurePageStyles();

  const trigger = opts.trigger ?? null;
  const controller = createAudioDock({
    host,
    // Narration + the built-in analyser backdrop. No music/atmosphere/rich-viz, so
    // the dock renders as a narration player and never bundles a host renderer.
    capabilities: { narration: true, viz: true },
    collapse: 'full',
    mount: document.body,
    // The dock inherits /info's [data-theme] tokens (font + brand accent) from
    // :root, so it themes for free; DOCK_CSS is injected by the shell itself.
    onClose: () => close(),
  });
  active = { controller, host, trigger };

  if (opts.autoplay) void host.play();
  focusPlay(controller);
}

/** Tear the open dock down: destroy the shell + host, hand focus back to the
 *  Listen button. Wired to the dock's × close button via onClose. */
function close(): void {
  if (!active) return;
  const { controller, host, trigger } = active;
  active = null;
  try { controller.destroy(); } catch { /* already gone */ }
  try { host.destroy(); } catch { /* already gone */ }
  trigger?.focus();
}

function focusPlay(controller: DockController): void {
  controller.el.querySelector<HTMLElement>('[data-play]')?.focus();
}

/** Link the page-level player stylesheet once (idempotent). */
function ensurePageStyles(): void {
  if (document.querySelector('link[href="/info/docs-player.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/info/docs-player.css';
  document.head.appendChild(link);
}
