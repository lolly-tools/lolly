// SPDX-License-Identifier: MPL-2.0
// Canonical formatting helpers, shared across views.
//
// These used to be copy-pasted (in divergent forms) across gallery, folder
// tiles, profile, device-info and tool-inputs - some capped at MB, some showed
// GB, and the zero case rendered as '', '0 KB' or '0 B' depending on the file.
// This module is the single source of truth: GB/TB-capable byte formatting with
// one zero-form ('0 B'), plus the shared relative-time and data-URL helpers.

/** Human-readable byte size. GB/TB-capable; zero/invalid renders as '0 B'. */
export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${i === 0 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** Compact relative time ("just now", "5m ago", …); '' for empty/invalid. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24; if (d < 7) return `${Math.round(d)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Inline SVG markup → a `data:image/svg+xml` URL usable as an <img> src. */
export function svgDataUrl(svgText: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgText);
}

/** Read a Blob into a base64 `data:` URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/**
 * Compact count for tight badges: 1105 → "1.1K", 7 → "7". Intl's compact
 * notation (locale-aware - German says "1,1 Tsd."), one fraction digit at
 * most. Callers keep the exact number in a title/aria-label.
 */
export function compactCount(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}
