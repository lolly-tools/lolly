// SPDX-License-Identifier: MPL-2.0

export interface ToolDesignSystemRecord {
  id: string;
  label: string;
}

export interface ToolDesignSystemRegistry {
  get(id: string): Promise<ToolDesignSystemRecord | null>;
  activeId(): Promise<string>;
}

interface DesignSystemMountHost {
  designSystems?: ToolDesignSystemRegistry;
  log?(level: 'warn', message: string): void;
  state: { list(): Promise<unknown[]> };
}

export interface ToolDesignSystemContext {
  registry: ToolDesignSystemRegistry | undefined;
  mountedSystemId: string | null;
  madeWith: ToolDesignSystemRecord | null;
}

/** Resolve the design-system requested by a link and the provenance of a saved slot. */
export async function prepareToolDesignSystemContext(
  host: DesignSystemMountHost,
  requestedId: string | null | undefined,
  slot: string | null | undefined,
): Promise<ToolDesignSystemContext> {
  const registry = host.designSystems;
  if (requestedId && registry) {
    try {
      const [wanted, activeId] = await Promise.all([registry.get(requestedId), registry.activeId()]);
      if (!wanted) {
        host.log?.('warn', `ds=${requestedId} names a design system that is not on this device - rendering with the active one`);
      } else if (wanted.id !== activeId) {
        const { switchDesignSystem } = await import('../lib/design-system/switch.ts');
        await switchDesignSystem(host as unknown as Parameters<typeof switchDesignSystem>[0], wanted.id, {
          noRemount: true,
        });
      }
    } catch {
      // Registry availability must never prevent a tool mount.
    }
  }

  const mountedSystemId = registry ? await registry.activeId().catch(() => null) : null;
  let madeWith: ToolDesignSystemRecord | null = null;
  if (slot && registry) {
    try {
      const entry = (await host.state.list()).find((candidate) => {
        const saved = candidate as { slot?: string };
        return saved.slot === slot;
      }) as { designSystem?: ToolDesignSystemRecord } | undefined;
      if (entry?.designSystem && entry.designSystem.id !== mountedSystemId) madeWith = entry.designSystem;
    } catch {
      // An unstamped or temporarily unavailable session has no notice to show.
    }
  }
  return { registry, mountedSystemId, madeWith };
}
