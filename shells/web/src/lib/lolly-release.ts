// SPDX-License-Identifier: MPL-2.0
/**
 * The Lolly release this web app ships in, read from its package.json, which
 * tests/release-version-sync.test.ts keeps equal to the app's release version
 * (the desktop app's tauri.conf.json). The engine keeps its own version
 * (ENGINE_VERSION); this is the number a person installs.
 *
 * Imported lazily by the paths that record the version, so the boot chunk carries none of this module.
 */
import pkg from '../../package.json' with { type: 'json' };

export const LOLLY_RELEASE: string = pkg.version;
