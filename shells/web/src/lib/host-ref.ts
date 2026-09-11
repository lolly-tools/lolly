// SPDX-License-Identifier: MPL-2.0
/**
 * The live web host, for modules that need a host surface before any export has
 * happened. `bridge/index.ts` registers it once the bridge is built (its tokens
 * and assets APIs are eager; only the export bridge is lazy), and a module that
 * would otherwise reach for `bridge/export.ts`'s lazily-set `_host` reads it here
 * instead - the catalog's "Send to" modal, for one, runs before an export panel
 * ever opened. Null until the bridge exists (tests, or a very early boot).
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';

let ref: HostV1 | null = null;

export function setHostRef(host: HostV1): void { ref = host; }
export function getHostRef(): HostV1 | null { return ref; }
