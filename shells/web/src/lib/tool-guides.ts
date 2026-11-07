// SPDX-License-Identifier: MPL-2.0
/**
 * From a tool to its docs (plan 354 D6). docs/manifest.json lists, on each page, the
 * tools that page guides; build:info writes that list for each locale to
 * /info[/<lang>]/tool-guides.json, with every page title and section heading in the
 * reader's language. The tool view reads it once to decide whether the help button
 * shows, and the help dialog (components/tool-guide.ts) and Design's Lolly menu turn a
 * tool's rows into "Read the guide" links into the in-app reader.
 *
 * Fetched once per session and locale, and quiet when it fails: offline, or a build
 * without /info, simply means no rows, and the help button stays as it was.
 */
import { currentLang, docsAppHref, type Lang } from '../i18n.ts';
import { docsBase } from './search/docs-index.ts';

/** One row, as docs/build.ts writes it: page path, section anchor ('' for the page),
 *  page title, section heading ('' for the page). */
export interface ToolGuideRow { p: string; a: string; t: string; h: string }

const cache = new Map<Lang, Promise<Record<string, ToolGuideRow[]>>>();

function isRow(v: unknown): v is ToolGuideRow {
  const r = v as Partial<ToolGuideRow> | null;
  return !!r && typeof r.p === 'string' && typeof r.a === 'string' && typeof r.t === 'string' && typeof r.h === 'string' && !!r.p && !!r.t;
}

async function fetchGuides(lang: Lang): Promise<Record<string, ToolGuideRow[]>> {
  try {
    const res = await fetch(`${docsBase(lang)}/tool-guides.json`);
    if (!res.ok) return {};
    const body = (await res.json()) as { tools?: Record<string, unknown> };
    const out: Record<string, ToolGuideRow[]> = {};
    for (const [id, rows] of Object.entries(body?.tools ?? {})) {
      if (Array.isArray(rows)) out[id] = rows.filter(isRow);
    }
    return out;
  } catch {
    return {};
  }
}

/** The "Read the guide" rows for one tool, in order; [] when there are none. */
export async function toolGuideRows(toolId: string): Promise<ToolGuideRow[]> {
  const lang = currentLang();
  let p = cache.get(lang);
  if (!p) { p = fetchGuides(lang); cache.set(lang, p); }
  return Object.hasOwn(await p, toolId) ? (await p)[toolId]! : [];
}

/** The in-app reader route for a row, at its section when it has one (the reader reads
 *  `?h=` and scrolls that heading into view). */
export function toolGuideHref(row: ToolGuideRow): string {
  const href = docsAppHref(row.p);
  return row.a ? `${href}?h=${encodeURIComponent(row.a)}` : href;
}

/** A row's words: the section and its page, or the page alone. */
export function toolGuideLabel(row: ToolGuideRow): { title: string; page: string } {
  return row.h ? { title: row.h, page: row.t } : { title: row.t, page: '' };
}

/** Test seam: forget the fetched lists. */
export function _resetToolGuides(): void {
  cache.clear();
}
