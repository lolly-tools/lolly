// SPDX-License-Identifier: MPL-2.0
/**
 * Whether a tool's export carries Content Credentials by default - shared by the
 * tool view's export sheet (views/tool-actions.ts) and the offscreen batch/zip
 * renderer (pro/render-export.ts), so a file rendered through "Render selection" /
 * "Download all" / the /pro grid is signed exactly like the same file rendered with
 * the tool's own Export button.
 *
 * The RULE now lives in the engine (engine/src/provenance-defaults.ts): off for
 * on-device privacy utilities (their output is the user's OWN file and must never be
 * stamped with provenance - a validated invariant) and for a tool that explicitly
 * opts out with render.c2pa:false. It moved there when the CLI adopted the same
 * default (plans/73-cli-ga-contract.md section 12 O2, 2026-08-01) - one implementation, so a
 * file made in the app and the same file made from the terminal cannot disagree
 * about whether it is signed.
 *
 * This module stays as the web shell's import site so nothing above it had to move.
 * A ?c2pa= link/save default (or an explicit caller option) still overrides at the
 * call sites.
 */
import { c2paDefaultOn as engineC2paDefaultOn } from '../../../../engine/src/provenance-defaults.ts';
import type { ToolManifest } from '../../../../engine/src/loader.js';

export function c2paDefaultOn(manifest: ToolManifest): boolean {
  return engineC2paDefaultOn(manifest as Parameters<typeof engineC2paDefaultOn>[0]);
}
