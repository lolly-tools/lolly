// SPDX-License-Identifier: MPL-2.0
/** Portable feature gates shared by the browser writer and Node reader. */
export const LOLLY_LAYOUT_MIN_READER = 6;
export const LOLLY_HIERARCHY_MIN_READER = 7;

export interface LollyFeatureSources {
  toolId?: string;
  session?: unknown;
  project?: unknown;
  templates?: unknown;
  toolManifest?: unknown;
}

/** Inspect carried values and declarations within a single bounded budget. */
export function lollyFeatureReader(sources: LollyFeatureSources): number {
  const stack = [
    { value: sources.session, design: sources.toolId === 'design', declaration: false },
    { value: sources.project, design: false, declaration: false },
    { value: sources.templates, design: false, declaration: false },
    { value: sources.toolManifest, design: false, declaration: true },
  ];
  const seen = new WeakMap<object, number>();
  let visited = 0, pending = stack.length, reader = 1;
  while (stack.length) {
    if (++visited > 200000) return LOLLY_HIERARCHY_MIN_READER;
    const item = stack.pop()!;
    const value = item.value;
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof Blob) continue;
    const row = value as Record<string, unknown>;
    const canvas = row.canvas as Record<string, unknown> | undefined;
    const source = row.sourceTool as Record<string, unknown> | undefined;
    const design = item.design || row.__toolId === 'design' || row.toolId === 'design' ||
      item.declaration && (row.id === 'design' || source?.id === 'design' ||
        canvas?.groupField === 'group' && typeof canvas.textDocumentInput === 'string');
    const mode = 1 << (Number(design) + 2 * Number(item.declaration));
    if ((seen.get(value) || 0) & mode) continue;
    seen.set(value, (seen.get(value) || 0) | mode);
    if (row.layout === 'flex' || row.layout === 'grid' ||
      item.declaration && Array.isArray(row.requires) && row.requires.includes('layout')) reader = LOLLY_LAYOUT_MIN_READER;
    if (design && (row.kind === 'group' || typeof row.pageId === 'string' && !!row.pageId.trim() ||
      Array.isArray(row.pages) && row.pages.length > 0 ||
      item.declaration && (row.id === 'pages' && row.type === 'blocks' ||
        row.id === 'pageId' && row.type === 'text' ||
        row.id === 'kind' && Array.isArray(row.options) && row.options.some(option =>
          !!option && typeof option === 'object' && (option as Record<string, unknown>).value === 'group')))) {
      return LOLLY_HIERARCHY_MIN_READER;
    }
    for (const child of Object.values(row)) {
      if (++pending > 200000) return LOLLY_HIERARCHY_MIN_READER;
      stack.push({ value: child, design, declaration: item.declaration });
    }
  }
  return reader;
}
