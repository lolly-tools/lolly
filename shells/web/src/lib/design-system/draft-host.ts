// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createTokenSet } from '../../../../../engine/src/tokens.ts';

/** A scoped host for the trusted, fixed poster proof. This is not a hook sandbox. */
export function createDraftHost(base: HostV1, document: unknown, theme: string): HostV1 {
  const draft = structuredClone(document);
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
      get: async () => createTokenSet(structuredClone(draft), { theme }),
      colors: async () => structuredClone(createTokenSet(draft, { theme }).colors()),
      resolve: async ref => structuredClone(createTokenSet(draft, { theme }).resolve(ref)),
      themes: async () => createTokenSet(draft).themes(),
      snapshot: async () => ({ document: structuredClone(draft), system: null, version: null, selection: { theme } }),
    },
    color: base.color, geom: base.geom, connectors: base.connectors, text: base.text,
  };
}
