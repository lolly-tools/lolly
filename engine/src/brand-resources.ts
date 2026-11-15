// SPDX-License-Identifier: MPL-2.0
/** Asset dependencies in brand vocabulary, independent of labels and rule prose. */
import { TOKEN_EXT } from './token-ext.ts';

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);

/** Known role and sound resources are traversed; other extensions stay opaque. */
export function mapBrandResourceIds(doc: unknown, map: (id: string) => string): unknown {
  if (!record(doc) || !record(doc.$extensions)) return doc;
  const vendor = doc.$extensions[TOKEN_EXT];
  if (!record(vendor)) return doc;
  const resource = (ref: unknown): unknown =>
    record(ref) && ref.type === 'asset' && typeof ref.id === 'string'
      ? { ...ref, id: map(ref.id) }
      : ref;
  const next = { ...vendor };
  const system = vendor.brandSystem;
  if (record(system) && system.schemaVersion === 1 && Array.isArray(system.roles)) {
    next.brandSystem = {
      ...system,
      roles: system.roles.map((role) =>
        !record(role) || !Array.isArray(role.resources)
          ? role
          : { ...role, resources: role.resources.map(resource) }
      ),
    };
  }
  const sound = vendor.sonicProfile;
  if (record(sound) && sound.schemaVersion === 1 && Array.isArray(sound.contexts)) {
    next.sonicProfile = {
      ...sound,
      contexts: sound.contexts.map((context) =>
        !record(context)
          ? context
          : {
              ...context,
              ...(record(context.signature)
                ? {
                    signature: {
                      ...context.signature,
                      ...(context.signature.resource
                        ? { resource: resource(context.signature.resource) }
                        : {}),
                    },
                  }
                : {}),
              ...(Array.isArray(context.examples)
                ? {
                    examples: context.examples.map((example) =>
                      record(example)
                        ? { ...example, resource: resource(example.resource) }
                        : example
                    ),
                  }
                : {}),
            }
      ),
    };
  }
  return { ...doc, $extensions: { ...doc.$extensions, [TOKEN_EXT]: next } };
}

export function brandResourceAssetIds(doc: unknown): string[] {
  const ids = new Set<string>();
  mapBrandResourceIds(doc, (id) => {
    ids.add(id);
    return id;
  });
  return [...ids];
}
