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
import { normalizeInstanceBase } from './instance.ts';

export type UrlValidation = { ok: true; base: string } | { ok: false; message: string };

/** Validate + normalize a typed instance URL for display - turns
 *  normalizeInstanceBase's throw into a result the render loop can branch on
 *  without a try/catch at every call site. The message on failure is that
 *  function's own: lib/instance.ts has no i18n dependency, so its thrown
 *  strings stay untranslated - the same treatment profile.ts already gives a
 *  thrown backup-import error (err.message passed straight through). */
export function validateInstanceUrl(input: string): UrlValidation {
  try {
    return { ok: true, base: normalizeInstanceBase(input) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
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
