// SPDX-License-Identifier: MPL-2.0
/**
 * send-target - a generic registry for cloud DESTINATIONS an export can be
 * sent to, straight from the export panel.
 *
 * The sibling of session-source / share-sections / export-policy: a neutral
 * seam, EMPTY by default, so a plain build renders the export panel exactly as
 * before - no card, no buttons, no network capability. What fills it:
 *
 *   - Built-in providers (send-targets-builtin.ts, one boot call in main.ts),
 *     each individually DORMANT until its config exists - e.g. the Google
 *     Drive target only reports available() once a Google OAuth client id is
 *     configured (lib/google-drive.ts). Config presence IS the feature flag:
 *     no id, no button, byte-identical behaviour.
 *   - A deployment's optional control plane (src/org/) can register fixed,
 *     organisation-owned targets beside the person's own connections.
 *
 * Provider `kind` ids deliberately reuse the lolly-work provider vocabulary
 * (PROVIDER_KINDS: 'gdrive', 'dropbox', 'o365', …) so the individual OAuth
 * targets here and the control plane's federated catalog providers speak the
 * same names. The two layers stay independent: these are per-USER, browser-
 * side OAuth destinations for finished exports; the control plane's providers
 * are per-instance catalog sources.
 *
 * Multiple targets can be live at once (including a personal S3 connection and
 * several organisation-owned S3 destinations), so unlike session-source this
 * registry holds a set. `id` is the destination identity; old drivers omit it
 * and retain the original last-registration-per-kind behaviour.
 *
 * One user-facing gate sits over the whole set: a CONNECTOR_FLAGS kill switch
 * per provider kind (feature-flags.ts, all ON by default). sendTargetsFor()
 * reads it at call time, so switching Google Drive off in /profile withdraws it
 * from every "send to" surface - the export panel, the share sheet, and the
 * export-home auto-send, which all resolve through here - with no reload.
 */

import { connectorEnabled } from '../feature-flags.ts';

/** One finished export, as handed to a target. */
export interface SendPayload {
  bytes: Uint8Array;
  /** Filename base (no extension enforced; targets may append/strip). */
  name: string;
  /** The export format id ('emf', 'png', …), lowercase. */
  format: string;
  mime: string;
  /** What `prepare` chose, verbatim (a Penpot project + file name, …). Absent
   *  when the target has no `prepare`, or a surface skipped it. */
  choice?: Record<string, unknown>;
}

/** What a completed send gives the UI to show. */
export interface SendOutcome {
  /** Where the file landed, when the provider has a viewable URL. */
  url?: string;
  /** Short, already-localised link/status label ("Open in Google Drawings"). */
  label: string;
}

export type SendSource = 'export' | 'asset';

export interface SendTarget {
  /** Stable registry identity. Defaults to `kind` for existing personal
   *  drivers. Organisation targets use an instance-scoped destination id so
   *  they never replace a person's connection of the same provider kind. */
  id?: string;
  /** Provider id, aligned with lolly-work's PROVIDER_KINDS ('gdrive', …). */
  kind: string;
  /** Ownership boundary. Organisation targets are governed by instance policy,
   *  so a personal connector kill-switch never silently withdraws them. */
  scope?: 'personal' | 'organization';
  /** Short, already-localised provider name ("Google Drive"). */
  label: string;
  /** Export formats this target accepts (lowercase); absent = every format. */
  formats?: readonly string[];
  /** Surfaces that may offer this destination. Absent = both, preserving the
   *  original behaviour. Governed delivery is export-only: catalog assets are
   *  not implicitly promoted into organisation publishing routes. */
  sources?: readonly SendSource[];
  /** Ask the export surface for a Lolly Content Credential on the exact bytes
   *  it sends. Used by governed delivery's server-side provenance gate. */
  requiresCredential?: boolean;
  /** Cheap render-time gate: is this target usable on this build/shell right
   *  now (config present, platform capable)? Never triggers auth or network. */
  available(): boolean;
  /** Already-localised button label for one format; absent = `Send to <label>`. */
  actionLabel?(format: string): string;
  /** Already-localised one-liner about scope/privacy, shown as the card's title
   *  tooltip ("Lolly can only see files it created …"). */
  hint?: string;
  /** Ask the user where this is going, BEFORE anything renders - every send
   *  surface awaits it first, so the destination question comes while the
   *  export is still a choice rather than after a wait the user did not ask
   *  for. Resolves the chosen values (handed back as `SendPayload.choice`), or
   *  null when the user cancelled: the surface then shows nothing and sends
   *  nothing. `ctx.anchor` is the element the send was started from, for a
   *  target that wants to anchor its picker. Targets without a `prepare`
   *  behave exactly as before. */
  prepare?(
    payload: Omit<SendPayload, 'bytes'> & { bytes?: Uint8Array },
    ctx?: { anchor?: HTMLElement | null },
  ): Promise<Record<string, unknown> | null>;
  /** Perform the send. May run an interactive OAuth popup. Rejects with a
   *  user-presentable message on failure (including a cancelled sign-in). */
  send(payload: SendPayload): Promise<SendOutcome>;
}

const targets = new Map<string, SendTarget>();

/** Stable identity used by DOM surfaces and registry operations. */
export function sendTargetId(target: SendTarget): string {
  return target.id ?? target.kind;
}

/** Register (or replace, by stable id) one destination. */
export function registerSendTarget(t: SendTarget): void {
  targets.set(sendTargetId(t), t);
}

/** Remove one destination by its stable id (or kind for legacy drivers). */
export function unregisterSendTarget(id: string): void {
  targets.delete(id);
}

/** The destinations currently offered for one export format, in registration
 *  order. Empty (the default) = the export panel shows nothing. A provider the
 *  user switched off in Feature flags is excluded here, so no caller needs its
 *  own check. */
export function sendTargetsFor(format: string, source: SendSource = 'export'): SendTarget[] {
  const f = format.toLowerCase();
  return [...targets.values()].filter(t =>
    (t.scope === 'organization' || connectorEnabled(t.kind)) &&
    t.available() &&
    (!t.sources || t.sources.includes(source)) &&
    (!t.formats || t.formats.includes(f)));
}
