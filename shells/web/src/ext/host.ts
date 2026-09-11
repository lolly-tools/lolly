// SPDX-License-Identifier: MPL-2.0
/**
 * ext/host - the INERT control-plane injection hook.
 *
 * The component-hydration analog of src/org/index.ts. Core ships this EMPTY: a
 * served control-plane (or community) bundle needs a way to call into the shell's
 * registry from the realm it was loaded into, and this exposes exactly one global
 * function for that - `window.lolly.registerExtension` - and NOTHING ELSE. It is
 * NOT a bundle loader and NOT a sandbox: it neither fetches nor evaluates any code.
 * Delivery (getting a bundle into the realm) is each channel's job; this is only
 * the door the bundle knocks on once it is already running.
 *
 * DORMANCY: nothing here runs until `installExtensionHost()` is called - and plain
 * core never calls it (a deployment's optional org seam does, in the member
 * branch). With it uncalled, `globalThis.lolly` is untouched, no extension can be
 * injected, and the shell is byte-identical to a build without this module.
 *
 * TRUST: an injected component runs in the shell realm, same reach as a tool
 * `hooks.js` - not sandboxed. Control-plane bundles are org-trusted; community
 * bundles are opt-in by the deployer at their own risk (and still pass the
 * governance opt-in gate in lib/extensions.ts before they hydrate). See the header
 * of @lolly-tools/core/extension-v1.
 */

import { registerExtension } from '../lib/extensions.ts';
import type { Extension, ExtensionChannel, Disposer } from '@lolly-tools/core/extension-v1';

interface LollyGlobal {
  registerExtension?: (ext: Extension<any, HTMLElement>, channel?: ExtensionChannel) => Disposer;
}

let installed = false;

/**
 * Install the inert injection hook: expose `globalThis.lolly.registerExtension`
 * for a served bundle to call. Idempotent. Called ONLY by a deployment's optional
 * control-plane seam - never on the plain-OSS boot path.
 */
export function installExtensionHost(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { lolly?: LollyGlobal };
  g.lolly ??= {};
  g.lolly.registerExtension = (ext, channel: ExtensionChannel = 'control-plane') =>
    registerExtension(ext, channel);
}

/** Whether the hook has been installed (for a governance/debug surface). */
export function isExtensionHostInstalled(): boolean {
  return installed;
}

/** TEST-ONLY: uninstall the hook back to the dormant default. */
export function _resetExtensionHostForTests(): void {
  installed = false;
  try {
    const g = globalThis as unknown as { lolly?: LollyGlobal };
    if (g.lolly) delete g.lolly.registerExtension;
  } catch { /* ignore */ }
}
