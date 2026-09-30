// SPDX-License-Identifier: MPL-2.0
import type { HostV1, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import { createTokenSet } from '../../../../../engine/src/tokens.ts';
import { resolveTokenSelection } from '../../../../../engine/src/token-selection.ts';

/** A scoped host for the trusted, fixed poster proof. This is not a hook sandbox. */
export function createDraftHost(base: HostV1, document: unknown, selection: string | TokenResolveOptions): HostV1 {
  const draft = structuredClone(document);
  const opts = typeof selection === 'string' ? { theme: selection } : selection;
  const choices = resolveTokenSelection(draft, opts).choices;
  const snapshotDocument = structuredClone(draft);
  if (snapshotDocument && typeof snapshotDocument === 'object' && !Array.isArray(snapshotDocument)) {
    const doc = snapshotDocument as Record<string, unknown>;
    doc.$metadata = { ...(doc.$metadata as object ?? {}), activeThemeSelection: choices };
  }
  const state = new Map<string, object>();
  const refuse = async (): Promise<never> => { throw new Error('Draft previews cannot write to your library or device.'); };
  return {
    version: base.version, shell: base.shell,
    profile: { get: async () => ({}), subscribe: () => () => {} },
    assets: {
      get: (...args) => base.assets.get(...args),
      query: (...args) => base.assets.query(...args),
      isAvailable: id => base.assets.isAvailable(id),
      ...(base.assets.bytes ? { bytes: base.assets.bytes.bind(base.assets) } : {}),
      pick: refuse,
    },
    state: {
      save: async (slot, data) => { state.set(slot, structuredClone(data)); },
      load: async slot => structuredClone(state.get(slot) ?? null),
      delete: async slot => { state.delete(slot); },
      list: async () => [...state.keys()].map(slot => ({ slot, toolId: 'design', toolVersion: 'draft', updatedAt: '1970-01-01T00:00:00.000Z', })),
    },
    clipboard: { writeText: refuse, writeImage: refuse },
    export: { render: (...args) => base.export.render(...args), download: refuse, file: refuse, imprint: refuse },
    log: (...args) => base.log(...args),
    tokens: {
      // A fresh resolver prevents consumers mutating this frozen render context.
      get: async () => createTokenSet(structuredClone(draft), opts),
      colors: async () => structuredClone(createTokenSet(draft, opts).colors()),
      resolve: async ref => structuredClone(createTokenSet(draft, opts).resolve(ref)),
      themes: async () => createTokenSet(draft).themes(),
      snapshot: async () => ({ document: structuredClone(snapshotDocument), system: null, version: null, selection: { theme: opts.theme, choices } }),
    },
    color: base.color, geom: base.geom, connectors: base.connectors, text: base.text,
  };
}
