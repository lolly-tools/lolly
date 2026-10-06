// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { designBrief } from '../../../../engine/src/design-brief.ts';

/** Brief from the same token snapshot the open editor renders. */
export async function designLiveContext(host: HostV1, fields: unknown[]): Promise<{ brief: unknown; [key: string]: unknown }> {
  const snapshot = await host.tokens?.snapshot?.();
  const brief = designBrief(snapshot?.document ?? null, null, { ...(snapshot?.system?.label ? { name: snapshot.system.label } : {}), ...(snapshot?.selection.theme ? { theme: snapshot.selection.theme } : {}) });
  return { brief, designSystem: snapshot?.system ?? null, designVersion: snapshot?.version ?? null, themeSelection: snapshot?.selection ?? null, layerFields: structuredClone(fields), imagePlacement: { field: 'image', supports: ['catalog asset id', 'inline data image'], coordinates: '$in makes coordinates relative to the named artboard' } };
}
