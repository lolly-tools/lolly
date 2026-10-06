// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { readAuthorDeclaration } from './asset-authorship.ts';

export function siteCatalogAssets(host: HostV1): Promise<AssetRef[]> {
  const api = host.assets as HostV1['assets'] & { _queryMetadata?(): Promise<AssetRef[]> };
  return api._queryMetadata?.() ?? api.query({});
}

/** Page metadata rather than sending an entire catalog or saved project to the agent. */
export function sitePage<T>(items: T[], args: Record<string, unknown>) {
  const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 30);
  return { items: items.slice(offset, offset + limit), total: items.length,
    ...(offset + limit < items.length ? { nextOffset: offset + limit } : {}) };
}
export function siteMatches(query: unknown, values: unknown[]): boolean {
  if (typeof query !== 'string') return true;
  const haystack = values.flatMap(value => Array.isArray(value) ? value : [value]).filter(value => typeof value === 'string').join(' ').toLocaleLowerCase();
  return query.toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

/** JSON facts have a total budget; binary files and disposable URLs stay in the shell. */
export function siteData(value: unknown, budget = 60_000): unknown {
  let remaining = budget;
  let truncated = false;
  const visit = (item: unknown, depth: number): unknown => {
    if (remaining <= 0 || depth > 10) { truncated = true; return '[truncated]'; }
    if (typeof item === 'string') {
      if (/^(data:|blob:)/i.test(item)) return '[file on device]';
      const result = item.slice(0, Math.min(4000, remaining)); remaining -= result.length;
      if (result.length < item.length) { truncated = true; return `${result}[truncated]`; }
      return result;
    }
    if (typeof item === 'boolean' || typeof item === 'number' || item === null) { remaining -= 16; return item; }
    if (Array.isArray(item)) { if (item.length > 100) truncated = true; return item.slice(0, 100).map(child => visit(child, depth + 1)); }
    if (item && typeof item === 'object') {
      if (ArrayBuffer.isView(item) || item instanceof ArrayBuffer || item instanceof Blob) return '[file on device]';
      return Object.fromEntries(Object.entries(item).slice(0, 100).flatMap(([key, child]) => {
        remaining -= key.length;
        return child === undefined || typeof child === 'function' ? [] : [[key, visit(child, depth + 1)]];
      }));
    }
    return null;
  };
  const result = visit(value, 0);
  return truncated && result && typeof result === 'object' && !Array.isArray(result) ? { ...result, truncated: true } : result;
}

export function siteInputs(model: InputModelItem[], current: boolean) {
  return model.map(item => {
    const { value, control: _control, isDirty: _dirty, ...definition } = item;
    return { ...definition, ...(current ? { value: item.type === 'file' ? { selected: !!value } : value } : {}) };
  });
}

/** Declarations and verification answer different questions and keep separate fields. */
export function siteAsset(ref: AssetRef, scope: string) {
  const meta = ref.meta ?? {};
  return { id: ref.id, scope, source: ref.source, type: ref.type, format: ref.format, formats: meta.formats ?? [ref.format],
    name: typeof meta.name === 'string' ? meta.name : ref.id,
    tags: Array.isArray(meta.tags) ? meta.tags.filter(tag => typeof tag === 'string') : [],
    version: ref.version ?? null, checksum: ref.checksum ?? null, width: ref.width ?? null, height: ref.height ?? null,
    size: meta.size ?? meta.bytes ?? null,
    description: meta.description ?? null, license: meta.license ?? null, attribution: meta.attribution ?? null,
    rights: meta.rights ?? null, aiDisclosure: { kind: meta.aiGenerated ?? null, declaredByUser: meta.aiOriginsDeclared === true },
    authorDeclaration: readAuthorDeclaration(meta), credentials: { verification: 'not-checked' },
  };
}
