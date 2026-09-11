// SPDX-License-Identifier: MPL-2.0
/**
 * Feature flags - local, per-user toggles that tailor the gallery.
 *
 * Stored on the profile (`profile.featureFlags`, keyed by flag id) so they ride
 * the normal profile persistence and sync. Every flag defaults to ON when unset.
 *
 * CATEGORY_FLAGS hide a tool-category section from the gallery (nothing else);
 * CONNECTOR_FLAGS withdraw one outbound provider everywhere it is offered; the rest are
 * standalone feature toggles. (Batch/Pro is available to everyone now, so it is no longer a flag.)
 */

import type { Profile } from '@lolly-tools/core/host-v1';
// The registry leaf, NOT org/index.ts: this module is first-paint work, and that
// one edge dragged the whole control plane onto the preload set of every visit for
// a read that answers null on any deployment without one (see org/governance.ts).
import { orgFlagGovernance } from './org/governance.ts';

export interface FeatureFlag {
  id: string;
  label: string;
  /** The gallery `category` this flag shows/hides (category flags only). */
  category?: string;
  /** The send-target provider `kind` this flag allows/forbids (connector flags only). */
  connector?: string;
  /** Small badge shown beside the label in the profile view. */
  pill?: string;
  /** Default state when the user hasn't set it. Omitted ⇒ ON (the historic default for
   *  every flag). Set `false` for opt-IN flags that should start off. */
  default?: boolean;
  /** Optional explainer, surfaced via a small (i) icon beside the flag in the profile. */
  info?: string;
}

// label → the gallery `category` it shows/hides. (Categories live in tool.json.)
export const CATEGORY_FLAGS: readonly FeatureFlag[] = [
  { id: 'cat-everyone',  label: 'Tools for Everyone', category: 'everyone' },
  { id: 'cat-designer',  label: 'Designer Tools',     category: 'designer' },
  { id: 'cat-event',     label: 'Event Kit',          category: 'event'    },
  // id stays 'cat-developer' (a persisted key); only the user-facing label changed.
  { id: 'cat-developer', label: 'Offline Utilities',  category: 'utility'  },
];

// Outbound connectors - one kill switch per send-target provider kind. Every one
// DEFAULTS ON (`default` omitted, the historic opt-out shape), so a build behaves
// exactly as before until someone switches a provider off; each target is already
// dormant without its own config, so an on flag never adds a button by itself.
//
// The flag id carries the provider `kind` from the send-target vocabulary
// ('gdrive', 'dropbox', 'o365', …), which is what connectorEnabled() below looks
// up - and the id is a persisted key, so it never moves once shipped.
//
// Deliberately NOT in GOVERNED_FLAG_IDS: the control plane's GOVERNABLE_FLAGS
// (lolly-work policy/feature-flags.ts) carries no connector ids, and a governed
// flag whose server counterpart does not exist would report "inherit" over
// nothing. These stay purely local, like the category flags.
export const CONNECTOR_FLAGS: readonly FeatureFlag[] = [
  { id: 'conn-gdrive',   label: 'Google Drive',        connector: 'gdrive'   },
  { id: 'conn-dropbox',  label: 'Dropbox',             connector: 'dropbox'  },
  { id: 'conn-o365',     label: 'OneDrive',            connector: 'o365'     },
  { id: 'conn-s3',       label: 'S3 bucket',           connector: 's3'       },
  { id: 'conn-webdav',   label: 'Nextcloud / WebDAV',  connector: 'webdav'   },
  { id: 'conn-penpot',   label: 'Penpot',              connector: 'penpot'   },
  { id: 'conn-wallpaper', label: 'Wallpaper',           connector: 'wallpaper' },
  { id: 'conn-mastodon', label: 'Mastodon',            connector: 'mastodon' },
  { id: 'conn-bluesky',  label: 'Bluesky',             connector: 'bluesky'  },
  { id: 'conn-discord',  label: 'Discord',             connector: 'discord'  },
  { id: 'conn-linkedin', label: 'LinkedIn',            connector: 'linkedin' },
];

const CONNECTOR_BY_KIND = new Map(CONNECTOR_FLAGS.map(f => [f.connector!, f]));

/** May this provider kind be offered at all? The choke-point read behind every
 *  outbound surface: the send-target registry (lib/send-target.ts), the /profile
 *  connection rows, and the sync provider list. Synchronous and read at CALL time,
 *  so flipping a switch applies on the next render with no reload. A kind with no
 *  flag (an instance-registered target) is never gated. */
export function connectorEnabled(kind: string): boolean {
  const f = CONNECTOR_BY_KIND.get(kind);
  return !f || isFlagOnSync(f);
}

// Standalone feature toggles (not a gallery category, not Pro). Neurospicy Mode -
// the background focus-music player - is opt-out here (ON by default like every flag).
export const NEUROSPICY_FLAG: FeatureFlag = { id: 'neurospicy', label: 'Neurospicy Mode', pill: 'focus music' };

// Jelly effects - flag-gated soft-body chrome controls (the vendored Jelly UI web
// components, see lib/jelly.ts). The default is BRAND-AWARE, resolved at boot by
// setJellyDefault (main.ts): OFF on a locked brand build (SUSE - its chrome stays
// stock), ON for the customisable start profile (lolly-start). A user's explicit
// toggle always wins over the default. Turning it off reverts the upgraded
// controls to the plain CSS primitives and skips loading the bundle.
export const JELLY_FLAG: FeatureFlag = {
  id: 'jelly-effects',
  label: 'Jelly effects',
  pill: 'squishy',
  info: 'Gives some controls a soft, springy feel, starting with the switches on this page. Follows your theme and brand colours, respects reduced-motion, and never touches tool output.',
};

/** Set the Jelly flag's built-in default from the brand signal (main.ts, before
 *  hydrateFeatureFlags so the sync mirror bakes it in). Locked brand ⇒ false. */
export function setJellyDefault(on: boolean): void {
  JELLY_FLAG.default = on;
}

// Wobbly windows - the opt-in compiz-style wobble on the shell's draggable floating
// panels (lib/wobble.ts). Heritage: Compiz shipped the effect, much of it built at
// SUSE for the Novell Linux Desktop. Opt-IN (default OFF): unlike Jelly there is no
// brand-aware default, it starts off for everyone and a user opts in. Purely visual
// chrome that reads isFlagOnSync (default-aware) rather than flagEnabledSync; with the
// flag off no transform is ever written and the panels' own drag code is untouched.
export const WOBBLY_FLAG: FeatureFlag = {
  id: 'wobbly-windows',
  label: 'Wobbly windows',
  pill: 'wobbly',
  default: false,
  // Plain hyphen, no em-dash: house copy rule (see PRIVATE_COLLAB_FLAG). English
  // source is the key, so this moves with the 26 catalogs on the next corpus pass.
  info: 'Gives draggable panels like the export settings and the Neurospicy player a soft, springy wobble when you drag them, a nod to the classic Compiz effect SUSE helped build. Respects reduced-motion and never changes anything you make or export.',
};

// The MESH tier for wobbly windows (lib/wobble-mesh.ts) - the real spring-mesh curve on
// the GPU (a snapshot of the panel warped as a textured WebGL mesh, the true Compiz
// billow) instead of the affine skew. Opt-IN on top of WOBBLY_FLAG and capability-gated:
// active only when both flags are on AND the browser/GPU can do it (WebGL + Blink), else
// it silently falls back to the affine wobble. Purely visual chrome; never touches output.
export const WOBBLY_MESH_FLAG: FeatureFlag = {
  id: 'wobbly-mesh',
  label: 'Wobbly windows: mesh curve',
  pill: 'gpu',
  default: false,
  info: 'Curves draggable panels with a real spring mesh on the GPU, the full Compiz billow, for capable machines. Needs Wobbly windows on and a WebGL-capable Chromium browser; it falls back to the standard wobble anywhere else. Respects reduced-motion and never changes anything you make or export.',
};

// Opt-IN (default OFF): strip EXIF/XMP/GPS from images uploaded to the catalog. C2PA
// content credentials are ALWAYS preserved regardless - this only governs other metadata.
// Read by the upload pipeline (views/picker.ts storeUserUpload).
export const STRIP_UPLOAD_META_FLAG: FeatureFlag = {
  id: 'strip-upload-metadata',
  label: 'Strip metadata from uploads',
  pill: 'privacy',
  default: false,
  info: 'Removes EXIF, location (GPS) and other embedded metadata from images you upload. Content Credentials (C2PA provenance) are always preserved - a signed or AI-generated image keeps its credential either way.',
};

// Opt-IN (default OFF): the export panel's "Before you export" prepress card. A
// personal toggle since 2026-08-06 (it was control-plane-only before): anyone who
// prints can turn it on, and the DEFAULT stays off so an individual exporting a
// PNG for a chat message is never ambushed by prepress findings. A deployment
// keeps governance through the ordinary flag mechanism below (default it on for
// members, or hide the toggle), plus the legacy `can['export.preflight']`
// capability, which orgFlagGovernance maps onto this flag's default.
export const PREFLIGHT_FLAG: FeatureFlag = {
  id: 'export-preflight',
  label: 'Print preflight',
  pill: 'prepress',
  default: false,
  info: 'Checks a print export before you download: bleed, resolution, ink coverage and plate counts appear above the Download button. It never blocks an export.',
};

// Opt-IN (default OFF): Performance UI - a simplified, cheaper-to-paint chrome for weaker
// devices. When ON it strips the GPU-expensive chrome effects (backdrop blur, shadows,
// blend modes) and pauses decorative previews until hovered. Reflected onto <html> by
// applyPerfUi below; the whole effect is a single gated stylesheet (styles/parts/perf-ui.css),
// so with the flag OFF nothing matches and the UI is byte-identical - the a11y-prefs additive
// rule. Deliberately CHROME-ONLY: it never reaches the tool canvas or the export stages, so a
// render (and its export, whose geometry is shared with the CLI) is never altered.
export const PERFORMANCE_UI_FLAG: FeatureFlag = {
  id: 'perf-ui',
  label: 'Performance UI',
  pill: 'lighter',
  default: false,
  info: 'Simplifies the interface to paint faster on lower-powered devices: turns off the blur, shadows and blend effects in the app chrome, and animates previews only while you hover them. It never changes anything you make - your exports are identical either way.',
};

/** Reflect the Performance UI flag onto <html> so the gated stylesheet can apply. Absent
 *  attribute ⇒ full chrome (the default). Best-effort, like the localStorage mirror. */
export function applyPerfUi(on: boolean): void {
  try { document.documentElement.toggleAttribute('data-perf-ui', on); } catch { /* no DOM */ }
}

/** Synchronous read of the Performance UI flag, for JS sites that must decide whether to
 *  run expensive decorative work (rAF visualisers, live preview rasterisation, the Cover
 *  Flow fan). OFF by default, so an ungated caller behaves exactly as before. Pairs with
 *  a11y-prefs' prefersReducedMotion(): a decorative loop should idle on EITHER signal. */
export function perfUiOn(): boolean {
  return isFlagOnSync(PERFORMANCE_UI_FLAG);
}

// Opt-IN (default OFF): Performance HUD - a small, draggable, body-level diagnostic overlay
// showing live stats (FPS, this device's memory + CPU threads) for debugging and power
// users. SEPARATE from perf-ui: that flag LIGHTENS the chrome to paint faster, this one only
// OBSERVES and changes nothing. Mounted in the same body-level floating cluster as the job
// toast (lib/perf-hud.ts, via the job-toast boot hook and the profile toggle); with the flag
// OFF nothing mounts and no rAF loop runs, so the app is byte-identical (the opt-in rule).
// Its FPS loop is a diagnostic, so it runs while shown regardless of reduced-motion. Read
// synchronously by perfHudOn() below.
export const PERF_HUD_FLAG: FeatureFlag = {
  id: 'perf-hud',
  label: 'Performance HUD',
  pill: 'debug',
  default: false,
  info: 'Shows a small, draggable overlay with live performance stats - frames per second, plus this device’s memory and CPU threads - for debugging and power users. It only watches; it never changes anything you make or export.',
};

/** Synchronous read of the Performance HUD flag - the gate that decides whether to mount the
 *  diagnostic overlay and run its FPS loop. OFF by default, so with nothing stored nothing
 *  mounts and the app stays byte-identical. Pairs with mountPerfHud()/unmountPerfHud(). */
export function perfHudOn(): boolean {
  return isFlagOnSync(PERF_HUD_FLAG);
}

// ON by default since 2026-08-10: private collab (Track A, plans/100 section 6) - the P2P
// invite/accept ceremony that lets two devices co-edit a tool session directly, no
// account/server/CSP change. What this flag gates is the ENTRY POINTS to that
// ceremony, and only those: the Share-dialog row (lib/collab-share-private.ts), the
// opener behind it (collab/private-opener.ts), and the #/join + #/join-reply routes
// (collab/join-route.ts). It does NOT gate the mount that receives a connection - 
// installLiveCollabMount() runs unconditionally at module scope in main.ts and reads
// no flag, deliberately, because that mount is shared with the Track-B org provider
// (plans/100 section 5) and gating it on a Track-A flag would break the other track. The
// mount is inert until a ceremony hands it a CollabConnection, so the entry points
// are the whole door.
//
// It shipped opt-IN (default false, the PREFLIGHT_FLAG shape above) while the
// ceremony was being built. The `beta` pill stays - the ceremony IS young - but the
// switch now starts on, because being off cost the one person it was meant to
// protect: an invite link is received by someone who has never heard of the feature,
// and a default-off flag met them with "turn this on in your profile, then open the
// link again" at the only moment they had a reason to care. Nothing is on the wire
// because the flag is on. It buys a Share-dialog row and a working #/join route; a
// peer connection is opened only when a human presses "Start a collab" or accepts an
// invite (collab/private-opener.ts, collab/join-route.ts).
//
// Three reads make the new truth table hold, and none of them changed shape:
//   - no stored value (fresh profile, fresh device) ⇒ this default, so ON - 
//     `isFlagOn` and `isFlagOnSync` both resolve a MISSING value to `default`;
//   - a stored `false` still wins, so anyone who turned it off stays off;
//   - a control plane still forces the value in either direction (see
//     GOVERNED_FLAG_IDS below). lolly-work's policy/feature-flags.ts moved this id's
//     `builtinDefault` to true in the same change, so "inherit" stays honest.
export const PRIVATE_COLLAB_FLAG: FeatureFlag = {
  id: 'private-collab',
  label: 'Private collab',
  pill: 'beta',
  default: true,
  // Plain hyphen, not an em-dash: house copy rule for every translated string (the
  // dash is an AI tell, and the Latin-script catalogs are swept to match). The key is
  // the English source, so this sentence and the 26 catalog KEYS move together: the
  // 2026-08-10 rewrite (the "It starts on" clause) changed the key, so the hand-list
  // in scripts/i18n/extra-keys.spa.json moved with it and all 26 catalogs carry the
  // English source as their value until the next `--corpus spa` pass translates it.
  info: 'Lets you invite one other device to co-edit a tool session directly - no account, no server, works offline on the same network. It starts on, and nothing is shared until you start a collab. Anyone with the invite can join and edit until you close the session.',
};

// ON by default: nearby discovery (plans/110 section 3) - advertise/browse for other Lolly
// devices on the same network so an invite can be handed over by tapping a name instead
// of scanning a QR. Like PRIVATE_COLLAB_FLAG, this gates the ENTRY POINTS only (the
// ceremony's Nearby section and any share-sheet nearby rows). Registration of a provider
// is separate and Tauri-only (lib/nearby-boot.ts registers the LAN provider when the
// native runtime is present; a plain web build never has one, so the flag is moot there).
// Nothing advertises because the flag is on: advertising begins only when a human presses
// "Make me visible nearby". A stored `false` still wins; a control plane can force it
// fleet-wide (GOVERNED_FLAG_IDS below, mirrored in lolly-work policy/feature-flags.ts).
export const NEARBY_DISCOVERY_FLAG: FeatureFlag = {
  id: 'nearby-discovery',
  label: 'Nearby discovery',
  pill: 'beta',
  default: true,
  // Plain hyphen, house copy rule (see PRIVATE_COLLAB_FLAG). English source is the key.
  info: 'Lets nearby Lolly devices on the same network find each other, so you can start a collab or share files by tapping a name instead of scanning a code. You are never visible until you choose to be, and only for as long as you set - the ceremony still confirms the connection with matching plates.',
};

// The standalone flags this shell will honour governance for (default + visibility);
// category/Pro flags stay purely local.
//
// All five ids match the control plane's own GOVERNABLE_FLAGS (lolly-work
// `server/src/policy/feature-flags.ts`), `private-collab` included since it was added
// there - so an instance really can force this flag on or off fleet-wide, and hide the
// toggle with it (plan 100 section 6.3/section 11.24). The `builtinDefault` recorded server-side must
// keep matching each flag's `default` here, or an instance that chose "inherit" would be
// told the wrong thing; the two moved together on 2026-08-10 for `private-collab`.
export const GOVERNED_FLAG_IDS: readonly string[] = [NEUROSPICY_FLAG.id, JELLY_FLAG.id, WOBBLY_FLAG.id, WOBBLY_MESH_FLAG.id, STRIP_UPLOAD_META_FLAG.id, PREFLIGHT_FLAG.id, PRIVATE_COLLAB_FLAG.id, NEARBY_DISCOVERY_FLAG.id];

/** Whether the control plane has hidden a flag's user-facing toggle (a staged
 *  surprise, or a policy the deployment owns). Dormant ⇒ false. The resolved
 *  state still applies via flagEnabled/isFlagOn - hiding only drops the switch. */
export function flagHidden(id: string): boolean {
  return orgFlagGovernance(id)?.hidden === true;
}

/** A flag is ON unless it has been explicitly turned off - but a control plane can
 *  set the default (applied when the user hasn't chosen) and, for a hidden flag,
 *  force its default regardless of any stored value. Dormant ⇒ historic behaviour. */
export function flagEnabled(profile: Profile | null | undefined, id: string): boolean {
  const gov = orgFlagGovernance(id);
  const saved = profile?.featureFlags?.[id];
  if (gov?.hidden) return gov.default ?? saved !== false;
  if (saved !== undefined) return saved;
  return gov?.default ?? true;
}

/** Default-aware read: honours a flag's `default` (opt-in flags start off) when the user
 *  hasn't set it, the control plane's default over that, and the saved value once the
 *  user has chosen - unless the control plane hides the flag, when its default wins. */
export function isFlagOn(profile: Profile | null | undefined, flag: FeatureFlag): boolean {
  const gov = orgFlagGovernance(flag.id);
  const builtin = flag.default !== false;
  const saved = profile?.featureFlags?.[flag.id];
  if (gov?.hidden) return gov.default ?? builtin;
  if (saved !== undefined) return saved;
  return gov?.default ?? builtin;
}

// A synchronous localStorage mirror of profile.featureFlags, so surfaces that render
// OUTSIDE the profile-aware views - the Sound control's Neurospicy player, shown in
// gallery/catalog/projects popovers - can gate on a flag without awaiting the profile.
// Hydrated from the profile at boot; kept in sync on each toggle. Defaults ON (like
// flagEnabled), so an unhydrated mirror still shows opt-out features.
const FLAG_MIRROR_KEY = 'lolly:featureFlags';

// In-memory flag overrides - NEVER persisted. The ?neuro demo deep-link
// (lib/neuro-demo.ts) lights a flag for exactly one page load without touching the
// localStorage mirror or the profile; consulted BEFORE the mirror, so it also wins
// over the docs pipeline's capture-neutral pin (which forces the mirror copy off).
const memOverride = new Map<string, boolean>();
export function overrideFlagInMemory(id: string, on: boolean): void {
  memOverride.set(id, on);
}
export function hydrateFeatureFlags(profile: Profile | null | undefined): void {
  // Bake whatever governance is KNOWN at this moment into the mirror: seed an unset
  // governed flag with its instance default, and force a hidden flag to its default.
  // At boot that is usually nothing, because this runs before initOrg resolves the
  // control plane - which is why the synchronous reads below no longer rely on this
  // loop for governance and consult orgFlagGovernance themselves. Kept so the stored
  // key is not actively misleading, and so a later call (after governance is known)
  // writes the resolved values.
  const eff: Record<string, boolean> = { ...(profile?.featureFlags ?? {}) };
  for (const id of GOVERNED_FLAG_IDS) {
    const gov = orgFlagGovernance(id);
    if (!gov) continue;
    if (gov.hidden) { if (gov.default !== undefined) eff[id] = gov.default; }
    else if (eff[id] === undefined && gov.default !== undefined) eff[id] = gov.default;
  }
  // Bake non-ON built-in defaults for flags still unset after governance, so the
  // sync reads agree with isFlagOn: opt-in flags, and the brand-aware Jelly
  // default (setJellyDefault runs before this at boot). flagEnabledSync's own
  // fallback for a missing key stays ON, matching the historic flags. The guard is
  // `default === false`, so a default-ON flag is deliberately left with NO mirror
  // entry - which is what makes a fresh device read it as on (PRIVATE_COLLAB_FLAG
  // since 2026-08-10; it stays in this list because the list is "every standalone
  // flag", not "every opt-in one").
  for (const f of [NEUROSPICY_FLAG, JELLY_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, STRIP_UPLOAD_META_FLAG, PREFLIGHT_FLAG, PRIVATE_COLLAB_FLAG, NEARBY_DISCOVERY_FLAG, PERFORMANCE_UI_FLAG, PERF_HUD_FLAG]) {
    if (eff[f.id] === undefined && f.default === false) eff[f.id] = false;
  }
  try { localStorage.setItem(FLAG_MIRROR_KEY, JSON.stringify(eff)); } catch { /* best-effort */ }
}
/** The mirror as a plain record. Unreadable or blocked storage ⇒ empty, so the
 *  caller falls through to governance and then the built-in default rather than
 *  throwing. */
function readMirror(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FLAG_MIRROR_KEY) || '{}') as Record<string, boolean>;
  } catch { return {}; }
}

// Both synchronous reads below consult orgFlagGovernance LIVE rather than trusting
// the bake in hydrateFeatureFlags, because the bake cannot be trusted at the moment
// it runs. Boot calls hydrateFeatureFlags(profile) long before `await initOrg()`
// resolves the control plane (main.ts), so `orgConfigState` is still null and the
// loop above writes no governance entry at all - and hydrate runs exactly once per
// boot, rewriting the whole mirror from the profile, so nothing an earlier session
// baked survives either. Without the live read a governed flag whose built-in
// default is ON (private-collab) would fail OPEN for the entire session on a fleet
// that forced it off: no mirror entry, missing-key fallback ON, and the governed-off
// branch in #/join unreachable. The bake stays because it keeps the mirror honest
// for anything that reads the raw key, but it is no longer what makes governance
// hold. Both functions resolve in the same order as their profile-aware twins
// (flagEnabled / isFlagOn); the in-memory override still outranks all of it.
export function flagEnabledSync(id: string): boolean {
  const mem = memOverride.get(id);
  if (mem !== undefined) return mem;
  const gov = orgFlagGovernance(id);
  const saved = readMirror()[id];
  if (gov?.hidden) return gov.default ?? saved !== false;
  if (saved !== undefined) return saved;
  return gov?.default ?? true;
}
/** Default-aware synchronous read, for surfaces that render outside the
 *  profile-aware views. Unlike flagEnabledSync (whose missing-key fallback is ON,
 *  matching the historic opt-out flags), this honours the flag's own `default`, so
 *  an opt-in flag stays OFF when the mirror has no entry for it (fresh device,
 *  blocked localStorage) instead of failing open. Control-plane governance is read
 *  live (see above) and outranks the mirror; the in-memory override wins over both. */
export function isFlagOnSync(flag: FeatureFlag): boolean {
  const mem = memOverride.get(flag.id);
  if (mem !== undefined) return mem;
  const gov = orgFlagGovernance(flag.id);
  const builtin = flag.default !== false;
  const saved = readMirror()[flag.id];
  if (gov?.hidden) return gov.default ?? builtin;
  if (saved !== undefined) return saved;
  return gov?.default ?? builtin;
}

export function setFlagMirror(id: string, on: boolean): void {
  try {
    const m = readMirror();
    m[id] = on;
    localStorage.setItem(FLAG_MIRROR_KEY, JSON.stringify(m));
  } catch { /* best-effort */ }
}

/** Set of gallery categories to hide, given the profile's current flags. */
export function hiddenCategories(profile: Profile | null | undefined): Set<string | undefined> {
  return new Set(
    CATEGORY_FLAGS.filter(f => !flagEnabled(profile, f.id)).map(f => f.category),
  );
}
