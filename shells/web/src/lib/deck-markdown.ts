// SPDX-License-Identifier: MPL-2.0
/** Slide separators and directives are meaningful outside fenced code only. */
export function markdownDeckRows(text: string): Record<string, unknown>[] {
  const source = String(text).replace(/\r\n?/g, '\n').replace(/^\uFEFF?[ \t]*\n?---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/, '');
  const rows: Record<string, unknown>[] = [];
  let lines: string[] = [], row: Record<string, unknown> = {}, fence = '', length = 0;
  function flush(): void {
    const content = lines.join('\n').trim();
    if (content || Object.keys(row).length) rows.push({ ...row, layout: row.layout ?? (row.media1 ? 'full' : 'auto'), content });
    lines = []; row = {};
  }
  for (const raw of source.split('\n')) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(raw)?.[1];
    if (marker) {
      if (!fence) { fence = marker[0]!; length = marker.length; }
      else if (marker[0] === fence && marker.length >= length) fence = '';
      lines.push(raw); continue;
    }
    if (!fence) {
      if (/^\s*---\s*$/.test(raw)) { flush(); continue; }
      const bg = /^bg\s*:\s*(#[0-9a-fA-F]{3,8})\s*$/i.exec(raw.trim());
      const layout = /^layout\s*:\s*([a-z0-9]+)\s*$/i.exec(raw.trim());
      if (bg) { row.bg = bg[1]; continue; }
      if (layout) { row.layout = layout[1]; continue; }
      const image = /^!\[[^\]]*\]\(([^)]+)\)\s*$/.exec(raw.trim());
      if (image && !row.media1) { row.media1 = { url: image[1] }; continue; }
      const inlineImage = /!\[[^\]]*\]\(([^)]+)\)/.exec(raw);
      if (inlineImage && !row.media1) row.media1 = { url: inlineImage[1] };
    }
    lines.push(raw);
  }
  flush();
  return rows.length ? rows.slice(0, 40) : [{ layout: 'auto', content: '' }];
}
