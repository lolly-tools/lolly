// SPDX-License-Identifier: MPL-2.0
/** Supported DTCG composite fields. Unknown properties remain source data. */
export const TOKEN_COMPOSITE_FIELDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  typography: { fontFamily: 'fontFamily', fontSize: 'dimension', fontWeight: 'fontWeight', letterSpacing: 'dimension', lineHeight: 'number' },
  shadow: { color: 'color', offsetX: 'dimension', offsetY: 'dimension', blur: 'dimension', spread: 'dimension' },
  border: { color: 'color', width: 'dimension', style: 'strokeStyle' },
  transition: { duration: 'duration', delay: 'duration', timingFunction: 'cubicBezier' },
  gradientStop: { color: 'color', position: 'number' },
  strokeStyle: { dashArray: 'dimension', lineCap: 'string' },
};

export const compositeElementType = (type: string | null): string | null => type === 'gradient' ? 'gradientStop' : type;

/** Reference expectations share the resolver's bounded field walk. */
export function tokenReferenceUses(value: unknown, type: string | null): { path: string; type: string | null }[] {
  const refs: { path: string; type: string | null }[] = [];
  let nodes = 0;
  function walk(v: unknown, expected: string | null, depth: number): void {
    if (++nodes > 4096 || depth > 32) return;
    if (typeof v === 'string' && /^\{[^{}]+\}$/.test(v)) refs.push({ path: v.slice(1, -1), type: expected });
    else if (Array.isArray(v)) for (const child of v) walk(child, compositeElementType(expected), depth + 1);
    else if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      if (!key.startsWith('$')) walk(child, TOKEN_COMPOSITE_FIELDS[expected ?? '']?.[key] ?? null, depth + 1);
    }
  }
  walk(value, type, 0);
  return refs;
}
