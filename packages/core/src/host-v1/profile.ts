// SPDX-License-Identifier: MPL-2.0

import type { AssetRef } from './asset-ref.ts';

// ─── Profile ────────────────────────────────────────────────────────────────

/**
 * A template the person saved from a tool (plans/226): a reusable starting point that
 * joins the tool's shipped templates in its "New from template" chooser and in the
 * Projects Templates collection. `values` is the full document snapshot minus the
 * per-document identity keys (`__label`, `__toolId`, `__toolVersion`,
 * `__export_filename`) and minus any `file` input (bytes are not a seed); the
 * `__export_*` settings stay so a template opens at the size, format and dpi it was
 * saved at. Asset inputs keep their refs, exactly as a saved session does.
 */
export interface UserTemplateRecord {
  id: string;
  /** The tool this template seeds. */
  toolId: string;
  name: string;
  /** One optional line, shown under the name in the chooser and the collection. */
  description?: string;
  values: Record<string, unknown>;
  /** Which design system the template was made with - the active record's id and label
   *  at save time, the same stamp a session carries. Display only, never a filter. */
  designSystem?: { id: string; label: string };
  /** The template ref this one was copied from ("Make a copy" of a shipped starter):
   *  `"<toolId>:<tid>"` or `"user:<id>"`. Display only. */
  from?: string;
  /** Legacy field from the 2026-08 "variation" card: the base template this one
   *  descended from. Read for grouping older records, never written any more. */
  variationOf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileAPI {
  get(): Promise<Profile>;
  /** Subscribe to profile changes (e.g. user updates headshot mid-session). */
  subscribe(fn: (p: Profile) => void): () => void;
}

export interface Profile {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  /** Job title / role line - a `bindToProfile` target for signature, badge and
   *  card tools (which today take it as a per-tool input). Optional like every
   *  field here; a deployment with a directory/IdP may populate it centrally. */
  title?: string;
  /** Organisation / company line - the creator's org, used for shared-file
   *  provenance (the `.lolly` creator block, plans/114). Optional like every field
   *  here; on a control-plane instance the shell derives it from the instance name
   *  when unset. Gated by `useDetails` at the point it is embedded, same as name. */
  org?: string;
  /** "Use my details" opt-in - gates embedding author/contact into export
   *  provenance (see engine/src/metadata.ts). */
  useDetails?: boolean;
  /** True once the user has dismissed (or acted on) the gallery's first-visit
   * personalisation nudge - the one-time prompt to opt into `useDetails`. Rides
   *  the profile (not device storage) so the prompt is per-user, not per-device. */
  personalizeNudgeDismissed?: boolean;
  /** True once the user has dismissed (or acted on) the gallery's one-time
   * offline-downloads nudge - the prompt pointing at Profile → Available
   *  offline. Deliberately RE-CLEARED by the web shell when the PWA is
   *  installed (`appinstalled`): installing reads as "I have the app now", and
   *  the app must say "not all of it, yet" once more before the user finds out
   *  the hard way on a plane. */
  offlineNudgeDismissed?: boolean;
  city?: string;
  country?: string;
  headshot?: AssetRef; // Yes - the user's headshot is an AssetRef too.
  custom?: Record<string, string>;
  /** Local UI feature flags, keyed by flag id (default ON when unset). */
  featureFlags?: Record<string, boolean>;
  /** Accessibility preferences - all opt-in, default off (unset = the regular
   *  experience, byte-for-byte). Shells apply them to their own chrome only;
   *  a tool's rendered output is never affected (motion/type inside the render
   *  canvas is the user's creative output, not app chrome). */
  a11y?: {
    /** Tame chrome animations/transitions even when the OS doesn't ask for it. */
    reduceMotion?: boolean;
    /** Stronger foreground/border contrast for the app chrome. */
    highContrast?: boolean;
    /** Larger app-chrome type (never scales the tool canvas or exports). */
    largeText?: boolean;
  };
  /** How the app itself dresses - the shell's OWN use of the design system,
   *  which is secondary to what a design system is for (tools and exports).
   *  Additive + optional: absent means the defaults below, so a profile without
   *  it is byte-identical to today. Shells mirror it to their own device storage
   *  for the pre-paint restore, exactly as `a11y` and the theme do. */
  appearance?: {
    /** Take the app's accent from the design system's primary colour (plans/182
     *  section 5.6). Default ON when unset - the reward loop after a first
     *  colour is worth keeping; a person who wants neutral chrome turns it off.
     *  Never reaches a tool canvas or an export: those follow the design system
     *  whatever this says. */
    followDesignSystem?: boolean;
  };
  /** Nearby-discovery preferences (plans/110). Additive + optional, so a profile
   *  without it is byte-identical to today. The only PERSISTED visibility mode is
   * `standing` ("always visible on networks I join") - an opt-in for trusted LANs;
   *  the ordinary timed "visible for 10 minutes" window is runtime state and never
   *  stored. Even `standing` advertises only while the app is running. */
  nearby?: {
    /** Keep advertising discoverable whenever the app runs, without re-arming a
     * timed window each time. Default (unset) is off - a device is discoverable
     *  only during an explicit timed window. */
    standing?: boolean;
  };
  /** Tool ids the user has starred - the gallery's "Favourites" collection. Rides
   *  the profile so it persists across reloads and travels in the portable backup. */
  favourites?: string[];
  /** Tool ids the user has hidden from the gallery/utilities grids ("Hide tool").
   *  Same per-user overlay idea as `hiddenAssets`: the tool stays installed and
   * deep links keep working - this only removes its tile from the browse surfaces,
   *  behind a "Show hidden tools" reveal. Utility VIEW cards (app routes, not tools)
   *  share the store under their `view:<id>` namespaced key, mirroring how
   *  `favourites` stars them. Tolerant of ids that no longer resolve. */
  hiddenTools?: string[];
  /** One-shot marker that the brand's shipped default-hidden TOOL set (`defaultHiddenTools`
   *  in the catalog index) has been established for this profile. Until it's set, those
   *  defaults are merged into `hiddenTools` at load; the user's first hide/un-hide bakes the
   *  current set in and sets this true, so their later un-hides stick and the defaults never
   *  re-apply. The tool twin of `catalogDefaultsSeeded` (which covers the asset overlay). */
  hiddenToolsSeeded?: boolean;
  /** Templates the person saved from tools (plans/226). Each rides the profile like
   *  `folders` do, so they persist, back up and restore with everything else here. */
  userTemplates?: UserTemplateRecord[];
  /** SHIPPED templates the person hid from the chooser, the gallery's About dialog and
   *  the Projects Templates collection, as refs `"<toolId>:<tid>"`. The tool's file is
   *  never deleted (the same per-user overlay as `hiddenTools` / `hiddenAssets`: the only
   *  honest "delete" for synced content); `?template=` deep links, MCP and the CLI keep
   *  working. Tolerant of a ref that no longer resolves. */
  hiddenTemplates?: string[];
  /** One-shot marker that the brand's `defaultHiddenTemplates` (catalog asset index)
   *  have been established for this profile - the `hiddenToolsSeeded` mechanism, for
   *  templates: merged at load until set, then the stored set is authoritative. */
  hiddenTemplatesSeeded?: boolean;
  /** Per-tool "Start with" for a blank fresh open (plans/226): tool id → `"blank"` (open
   *  on the manifest defaults, no chooser) or a template ref (`"<toolId>:<tid>"` or
   *  `"user:<id>"`, seeded directly, no chooser). Absent = ask (the chooser). Applies to
   *  the interactive blank open and the Projects quick-add only - never to a link that
   *  carries its own intent, and never to URL mode, the CLI or MCP, which always render
   *  the manifest default. A ref that stops resolving is cleared by the shell. */
  templateStart?: Record<string, string>;
  /** Asset ids the user has starred - the Catalog's asset "Favourites", surfaced as a
   *  pinned collapsible section at the top of every asset picker. Distinct from
   *  `favourites` (TOOL ids). Keyed by the base asset id (theme suffix stripped). */
  favouriteAssets?: string[];
  /** Refs the user has starred in the Projects view - folders, saved sessions, or folder
   *  images. Distinct from `favourites` (TOOL ids) and `favouriteAssets` (catalog ids): these
   *  are the user's OWN project refs. Surfaced as a favourites strip at the top of Projects. */
  favouriteProjects?: string[];
  /** Per-user category override for the Catalog + picker grouping: base asset id →
   *  library group key (e.g. 'backgrounds'). Layers over the tag-derived category so a
   *  user can reclassify e.g. a headshot as a background. Immutable catalog tags are
   * never mutated - this is the per-user overlay. */
  assetCategories?: Record<string, string>;
  /**
   * Per-user cover art for an audio asset: base asset id → a RECIPE, not pixels.
   *
   * Every audio asset already gets a generated look - a waveform shape and a brand
   * colour derived deterministically from its id - and that is the product. This is the
   * opt-in override for the handful of tracks a user cares enough about to style, so a
   * favourite gets something closer to an album cover.
   *
   * The value is `"<shape>"` or `"<shape>:<colourIndex>"`, deliberately NOT a hex and
   * NOT an image:
   *   - STRUCTURE IS FROZEN. The shape is the user's choice and nothing may change it;
   *     a rebrand must never turn their blob into a ring.
   *   - COLOUR RE-RESOLVES. The index points into the ACTIVE brand's colour pool, so a
   *     cover re-skins with the brand and keeps mixing with its surroundings. That is
   *     the intended behaviour, not drift.
   * Storing a baked hex would freeze the paint too and strand the cover on an old brand;
   * storing an image would also cost bytes and stop it re-rendering crisply at any size.
   *
   * Keyed by BASE asset id, like the overlays above, and tolerant of an id that vanishes
   * on a catalog rebuild. Absent for the overwhelming majority of assets, by design.
   */
  audioCovers?: Record<string, string>;
  /** Base asset ids the user has hidden from THEIR catalogue + every picker. The
   *  shared/immutable catalog file is never deleted; this is a per-user "hide from my
   *  view" overlay (the only honest "delete" for a read-only catalog asset). Tolerant
   *  of an id that vanishes on a future catalog rebuild. */
  hiddenAssets?: string[];
  /** One-shot marker that the shipped Catalog defaults (e.g. the default-hidden asset
   *  set) have been established for this profile. Until it's set, the shell merges those
   *  defaults into the user's overlay at load; once the user first edits the overlay it's
   *  baked in and set true, so their later un-hides stick and the defaults never re-apply. */
  catalogDefaultsSeeded?: boolean;
  /** UI/content language as a canonical short code (see engine/src/lang.ts's
   * LANGS) - 'es'|'de'|'fr'|'zh'|'ja'|'vi', or unset for English. Written by the
   *  welcome-dialog and profile-card language pickers; mirrored to `localStorage
   *  'lang'` for a pre-paint read, and a legal `bindToProfile: "lang"` target. */
  lang?: string;
  /** Auto-save each finished render into the personal library (the 'renders'
   *  tag) as it downloads. Default ON: unset means enabled, only an explicit
   *  `false` turns it off. Shells save the exact credentialed bytes the user
   *  received, deduped by checksum, so a re-download of the same file never
   *  stacks a second copy. Set from Profile like the a11y prefs (never
   *  localStorage). */
  saveRenders?: boolean;
  /** Export home (plans/138 Tier A1): a connected provider KIND ('dropbox',
   *  's3', …) the user pinned as "my exports live here". When set, every finished
   *  export ALSO auto-sends to it over the same send-target driver a manual send
   *  uses. Unset = no home (the default). Names a kind only; the connection itself
   *  is device-local, so on a device that lacks it the home is simply inert. */
  exportHome?: string;
}
