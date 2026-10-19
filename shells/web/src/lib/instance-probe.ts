// SPDX-License-Identifier: MPL-2.0
/**
 * Pure helpers for components/instance-sheet.ts's connect flow - split out of
 * that module (rather than defined inline) so they stay importable with no
 * DOM/CSS/mountModal dependency: instance-sheet.ts has a top-level `import
 * '../styles/parts/instance-sheet.css'` for its dialog chrome, which a plain
 * `node --test` run can't load (unknown ".css" extension under ESM) - these
 * two have no such import, so instance-sheet.test.ts can exercise them
 * directly without pulling that in.
 */
import { instanceFetch, normalizeInstanceBase } from './instance.ts';

/** Why an address was refused, for the sheet to say in the reader's language. */
export type UrlProblem = 'invalid' | 'not-https' | 'credentials';
export type UrlValidation = { ok: true; base: string } | { ok: false; message: string; reason: UrlProblem };

/** Validate + normalize a typed instance URL for display - turns
 *  normalizeInstanceBase's throw into a result the render loop can branch on
 *  without a try/catch at every call site. The message on failure is that
 *  function's own: lib/instance.ts has no i18n dependency, so its thrown
 *  strings stay untranslated - the same treatment profile.ts already gives a
 *  thrown backup-import error (err.message passed straight through). */
export function validateInstanceUrl(input: string): UrlValidation {
  const candidate = /^[^/:\s]+\.[^/:\s]+(?::\d+)?(?:\/[^\s]*)?$/.test(input.trim()) ? `https://${input.trim()}` : input;
  try {
    return { ok: true, base: normalizeInstanceBase(candidate) };
  } catch (e) {
    // The reason is read from the address, not from the thrown English text, so the
    // sheet can say it in the reader's language (plan 320 J2).
    let reason: UrlProblem = 'invalid';
    try {
      const u = new URL(candidate.trim());
      if (u.protocol !== 'https:') reason = 'not-https';
      else if (u.username || u.password) reason = 'credentials';
    } catch { /* not an address at all */ }
    return { ok: false, message: e instanceof Error ? e.message : String(e), reason };
  }
}

export type ProbeOutcome =
  | { ok: true; toolCount: number }
  | { ok: false; reason: 'http'; status: number }
  | { ok: false; reason: 'parse' }
  | { ok: false; reason: 'shape' };

/** What a deployment's OPTIONAL instance manifest (`GET /api/v1/instance`)
 *  tells a shell before anyone signs in. `found: false` is NOT an error - a
 *  plain Lolly deployment has no manifest, and the connect flow proceeds on
 *  the catalog probe alone. */
export type ManifestOutcome =
  | { found: true; name: string; accessMode?: string; providerName?: string; engineVersion?: string; packUrl?: string }
  | { found: false };

/** Shape a fetched /api/v1/instance response. Tolerant by construction: any
 *  non-200, non-JSON, or nameless body reads as "no manifest" - never as a
 *  failure - so the optional control plane can never block a connect. */
export function shapeInstanceManifest(status: number, ok: boolean, body: unknown): ManifestOutcome {
  if (!ok || status !== 200 || !body || typeof body !== 'object') return { found: false };
  const m = body as {
    name?: unknown; accessMode?: unknown; providerName?: unknown;
    engineVersion?: unknown; connect?: { packUrl?: unknown };
  };
  if (typeof m.name !== 'string' || !m.name) return { found: false };
  return {
    found: true,
    name: m.name,
    ...(typeof m.accessMode === 'string' ? { accessMode: m.accessMode } : {}),
    ...(typeof m.providerName === 'string' && m.providerName ? { providerName: m.providerName } : {}),
    ...(typeof m.engineVersion === 'string' ? { engineVersion: m.engineVersion } : {}),
    ...(typeof m.connect?.packUrl === 'string' ? { packUrl: m.connect.packUrl } : {}),
  };
}

/** Shape a fetched /catalog/tools/index.json response into a probe outcome.
 *  `body` is the already-parsed JSON (or undefined if parsing failed). Kept
 *  pure - no fetch, no i18n - so this classification and the render layer's
 *  (translated) copy for each reason stay independently testable. */
export function shapeProbeResult(status: number, ok: boolean, body: unknown): ProbeOutcome {
  if (!ok) return { ok: false, reason: 'http', status };
  if (body === undefined || body === null) return { ok: false, reason: 'parse' };
  const tools = (body as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) return { ok: false, reason: 'shape' };
  return { ok: true, toolCount: tools.length };
}

/** A Work manifest is discoverable before its private catalog is readable. */
export function isAccountInstance(manifest: ManifestOutcome): boolean {
  return manifest.found && ['open', 'gated', 'per-tool'].includes(manifest.accessMode ?? '');
}

export interface ProbedInstance {
  base: string;
  toolCount: number | null;
  manifest: ManifestOutcome;
}

/** Public discovery first; private content is read only after sign-in. */
export async function probeConnection(base: string): Promise<{ ok: true; instance: ProbedInstance } | Exclude<ProbeOutcome, { ok: true }>> {
  let manifest: ManifestOutcome = { found: false };
  try {
    const response = await instanceFetch(`${base}/api/v1/instance`);
    let body: unknown;
    try { body = await response.json(); } catch { /* not a manifest */ }
    manifest = shapeInstanceManifest(response.status, response.ok, body);
  } catch { /* static deployments need only the catalog */ }
  if (isAccountInstance(manifest)) return { ok: true, instance: { base, toolCount: null, manifest } };
  const response = await instanceFetch(`${base}/catalog/tools/index.json`);
  let body: unknown;
  try { body = await response.json(); } catch { /* shapeProbeResult reports the refusal */ }
  const outcome = shapeProbeResult(response.status, response.ok, body);
  return outcome.ok ? { ok: true, instance: { base, toolCount: outcome.toolCount, manifest } } : outcome;
}

/** Web accounts work at the workspace origin, with its own first-party cookie. */
export function workspaceAppUrl(base: string, hash: string): string {
  const target = `${normalizeInstanceBase(base)}/`;
  return hash.startsWith('#/team/') ? target + hash : target;
}
