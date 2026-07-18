// SPDX-License-Identifier: MPL-2.0
/**
 * Minimal HostV1 stub for tool-contract tests that drive a REAL tool through
 * createRuntime. Provides only the required surface (profile / assets / log):
 * assets resolve every id to a recognisable "asset:<id>" URL so the hydrated
 * output reveals which asset a hook picked. Pass `overrides` to replace any
 * key (e.g. a recording assets stub) or add optional capabilities (tokens,
 * pptx, ...). Suites that need rich purpose-built stubs (data-transfer,
 * runtime-provenance, runtime-ingredients) keep them local instead.
 *
 * Not collected by the test glob (only *.test.ts is); tests/tsconfig.json's
 * `./**\/*` include still typechecks it.
 */
export function baseHost(overrides: Record<string, unknown> = {}): any {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id }) },
    log: () => {},
    ...overrides,
  };
}
