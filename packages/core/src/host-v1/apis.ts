// SPDX-License-Identifier: MPL-2.0
/**
 * The optional (additive) HostV1 APIs, as data.
 *
 * `HostV1` declares six required members (`profile`, `assets`, `state`,
 * `clipboard`, `export`, `log`) and a growing set of optional ones (`net`,
 * `tokens`, `text`, …), each added in a minor version and never removed. Until
 * now the only way a tool could say "I need `host.text`" was to call it and
 * fail inside a time-boxed hook. This list makes the optional surface
 * enumerable so:
 *
 * - a manifest can declare `requires: ['text', 'pdf']` and the runtime refuses
 *   to mount on a shell that lacks one, before any hook runs;
 * - a shell can enumerate what it actually provides (`presentApis(host)`) and
 *   a gallery can grey a tool out on that shell;
 * - the catalog validator can compare a tool's `host.*` use against what it
 *   declares.
 *
 * Add a name here in the same minor that adds the member to `HostV1`; the
 * type below is checked against the interface, so forgetting fails typecheck.
 */
import type { HostV1 } from './host.ts';

export const HOST_V1_OPTIONAL_APIS = [
  'net', 'tokens', 'text', 'pdf', 'pptx', 'capture', 'compose', 'media', 'scan', 'lift',
  'keyframes', 'recorder', 'audio', 'codec', 'layers', 'upscale', 'matte', 'ocr', 'speech',
  'viz', 'color', 'images', 'raster', 'geom', 'connectors', 'c2pa',
] as const;

export type HostApiName = (typeof HOST_V1_OPTIONAL_APIS)[number];

// Every name must be an optional member of HostV1, and every optional API
// member of HostV1 must be listed (a missing one is a typecheck error here).
type OptionalKeys = { [K in keyof HostV1]-?: undefined extends HostV1[K] ? K : never }[keyof HostV1];
type ApiKeys = Exclude<OptionalKeys, 'capabilities' | 'shell' | 'version'>;
type _ListedAreOptional = HostApiName extends ApiKeys ? true : never;
type _OptionalAreListed = ApiKeys extends HostApiName ? true : never;
const _check: [_ListedAreOptional, _OptionalAreListed] = [true, true];
void _check;

/** The optional APIs a host actually provides right now. */
export function presentApis(host: Partial<Record<HostApiName, unknown>> | null | undefined): HostApiName[] {
  if (!host) return [];
  return HOST_V1_OPTIONAL_APIS.filter((name) => host[name] !== undefined && host[name] !== null);
}

/** The declared `requires` a host cannot satisfy. Unknown names count as
 *  missing, so a typo in a manifest fails loudly instead of passing. */
export function missingRequires(
  requires: readonly string[] | undefined,
  host: Partial<Record<HostApiName, unknown>> | null | undefined,
): string[] {
  if (!requires?.length) return [];
  const present = new Set<string>(presentApis(host));
  return requires.filter((name) => !present.has(name));
}
