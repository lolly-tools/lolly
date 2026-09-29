// SPDX-License-Identifier: MPL-2.0
/** Markdown groups and bounded compositions, shared by slide tools and shells. */
import type { SlideMasterV1 } from '@lolly-tools/core';

export interface SlideCellBox { x: number; y: number; w: number; h: number }
export interface SlideTextGroup { heading: string; body: string; ordinal?: string }
export interface SlideMarkdownContent { title: string; intro: string; groups: SlideTextGroup[]; ordered: boolean }
export interface SlideComposition {
  id: string;
  name: string;
  kind: 'cards' | 'columns' | 'steps' | 'text' | 'quote';
  columns: number;
  cells: SlideCellBox[];
  fontSize: number;
  titleSize: number;
  titleBox: SlideCellBox;
  introBox: SlideCellBox;
  warning: string;
}
export interface SlideCompositionOptions {
  master?: SlideMasterV1;
  aspect?: number;
  recipe?: string;
}

/** Normalised cells; the last row is centred without creating empty components. */
export function slideGridCells(count: number, columns: number, box: SlideCellBox): SlideCellBox[] {
  count = Math.max(1, Math.min(12, Math.round(count) || 1));
  columns = Math.max(1, Math.min(count, 4, Math.round(columns) || 1));
  const rows = Math.ceil(count / columns);
  const gapX = Math.min(.025, box.w / columns * .08), gapY = .025;
  const w = (box.w - gapX * (columns - 1)) / columns;
  const h = (box.h - gapY * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns), used = Math.min(columns, count - row * columns);
    return { x: box.x + (i % columns + (columns - used) / 2) * (w + gapX), y: box.y + row * (h + gapY), w, h };
  });
}

/** Fence-aware line classification keeps code, indentation and tables in their group. */
function linesOf(markdown: string): { raw: string; structural: boolean }[] {
  let fence = '', length = 0;
  return String(markdown).replace(/\r\n?/g, '\n').split('\n').map(raw => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(raw)?.[1];
    const structural = !fence && !marker;
    if (marker && !fence) { fence = marker[0]!; length = marker.length; }
    else if (marker && marker[0] === fence && marker.length >= length) fence = '';
    return { raw, structural };
  });
}

function listGroup(lines: string[], ordinal?: string): SlideTextGroup {
  const first = lines[0]!.replace(/^\s*(?:[-+*]|\d+[.)])\s+/, '');
  const label = /^\*\*([^*]+)\*\*\s*[:–-]?\s*(.*)$/.exec(first);
  // Remove the parent item's indent only. Nested bullets remain nested Markdown.
  const indent = /^\s*(?:[-+*]|\d+[.)])\s+/.exec(lines[0]!)![0].length;
  const rest = lines.slice(1).map(line => line.startsWith(' '.repeat(indent)) ? line.slice(indent) : line).join('\n');
  return { heading: label?.[1] ?? '', body: [label ? label[2] : first, rest].filter(Boolean).join('\n').trim(), ...(ordinal ? { ordinal } : {}) };
}

export function parseSlideMarkdown(markdown: string): SlideMarkdownContent {
  const lines = linesOf(markdown);
  let title = '';
  const first = lines.findIndex(l => l.raw.trim());
  if (first >= 0 && lines[first]!.structural) {
    const heading = /^#{1,3}\s+(.*)$/.exec(lines[first]!.raw);
    if (heading) { title = heading[1]!; lines.splice(first, 1); }
  }
  const headings = lines.flatMap((l, i) => l.structural && /^#{2,3}\s+/.test(l.raw) ? [{ i, level: /^#+/.exec(l.raw)![0].length }] : []);
  const level = Math.min(...headings.map(h => h.level));
  const sections = headings.filter(h => h.level === level).map(h => h.i);
  if (sections.length >= 2) {
    const groups = sections.map((start, k) => ({
      heading: lines[start]!.raw.replace(/^#{2,3}\s+/, ''),
      body: lines.slice(start + 1, sections[k + 1] ?? lines.length).map(l => l.raw).join('\n').trim(),
    }));
    return { title, intro: lines.slice(0, sections[0]).map(l => l.raw).join('\n').trim(), groups, ordered: false };
  }
  const bullets = lines.flatMap((l, i) => {
    const match = l.structural && /^([ \t]*)(?:[-+*]|\d+[.)])\s+/.exec(l.raw);
    return match ? [{ i, indent: match[1]!.replace(/\t/g, '  ').length }] : [];
  });
  const indent = Math.min(...bullets.map(b => b.indent));
  const items = bullets.filter(b => b.indent === indent).map(b => b.i);
  // A table or code block mixed with peer bullets keeps its original reading order.
  const complex = lines.some(l => !l.structural && l.raw.trim() || /^\s*\|/.test(l.raw));
  if (items.length >= 2 && !complex && !sections.length) {
    const ordered = items.every(i => /^\d+[.)]/.test(lines[i]!.raw.trimStart()));
    return {
      title, intro: lines.slice(0, items[0]).map(l => l.raw).join('\n').trim(), ordered,
      groups: items.map((start, k) => listGroup(lines.slice(start, items[k + 1] ?? lines.length).map(l => l.raw), ordered ? /^\d+/.exec(lines[start]!.raw.trimStart())![0] : undefined)),
    };
  }
  const body = lines.map(l => l.raw).join('\n').trim();
  return { title, intro: '', groups: body ? [{ heading: '', body }] : [], ordered: false };
}

function plainLength(text: string): number { return text.replace(/[*#`_]/g, '').length; }

/** Rank geometry by group count and estimated density; renderers verify real font metrics. */
export function slideCompositions(content: SlideMarkdownContent, options: SlideCompositionOptions = {}): SlideComposition[] {
  const master = options.master, aspect = options.aspect && options.aspect > 0 ? options.aspect : 16 / 9;
  const base = master?.archetypes.find(a => a.id === 'content');
  const titleBox = base?.placeholders.find(p => p.role === 'title')?.box ?? { x: .055, y: .055, w: .89, h: .13 };
  const body = { ...(base?.placeholders.find(p => p.role === 'body')?.box ?? { x: .055, y: .23, w: .89, h: .61 }) };
  const height = master?.size.height || 720;
  const fontSize = (master?.typeScale.body || 26) / height;
  const titleSize = (master?.typeScale.title || 42) / height;
  const introH = content.intro ? Math.min(.17, .055 + plainLength(content.intro) / (aspect * 1300)) : 0;
  const introBox = { x: body.x, y: body.y, w: body.w, h: introH };
  body.y += introH; body.h -= introH;
  const count = content.groups.length;
  if (count < 2 || count > 12) {
    const quote = count === 1 && /^>/.test(content.groups[0]!.body);
    return [{ id: quote ? 'flow-quote' : 'flow-text', name: quote ? 'Quote' : 'Title and text', kind: quote ? 'quote' : 'text', columns: 1, cells: [body], fontSize, titleSize, titleBox, introBox, warning: count > 12 ? 'Split this content across slides for readable text.' : '' }];
  }
  const ideal = count === 2 ? 2 : count === 4 ? 2 : count <= 9 ? 3 : 4;
  const ranked: { plan: SlideComposition; score: number }[] = [];
  for (const columns of [1, 2, 3, 4]) {
    if (columns > count || Math.ceil(count / columns) > 4) continue;
    for (const kind of content.ordered ? ['steps', 'columns'] as const : ['cards', 'columns'] as const) {
      let cells = slideGridCells(count, columns, body);
      const concise = count <= 3 && content.groups.every(g => !g.heading && g.body.length < 120);
      const size = concise ? Math.min(titleSize * .8, fontSize * 1.3) : fontSize * (count >= 9 ? .85 : 1);
      let overflow = 0, tallest = 0;
      for (let i = 0; i < count; i++) {
        const group = content.groups[i]!, cell = cells[i]!;
        const width = (cell.w - (kind === 'cards' ? .03 : .012)) * aspect;
        const chars = Math.max(8, width / (size * .5));
        const lines = group.body.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(plainLength(line) / chars)), 0);
        const need = (lines + (group.heading ? Math.ceil(plainLength(group.heading) / chars) * 1.35 + .6 : 0) + (kind === 'steps' ? 1.6 : 0)) * size * 1.3;
        tallest = Math.max(tallest, need);
        overflow += Math.max(0, need / (cell.h - .04) - 1);
      }
      // Short groups get compact panels with breathing room around the composition.
      const rows = Math.ceil(count / columns);
      const usedHeight = Math.min(body.h, Math.max(.26, tallest + .055) * rows + .025 * (rows - 1));
      cells = slideGridCells(count, columns, { ...body, y: body.y + (body.h - usedHeight) * .4, h: usedHeight });
      ranked.push({ plan: { id: `flow-${kind}-${count}-${columns}`, name: `${columns} ${columns === 1 ? 'column' : 'columns'}${Math.ceil(count / columns) > 1 ? ` × ${Math.ceil(count / columns)} rows` : ''} · ${kind}`, kind, columns, cells, fontSize: size, titleSize, titleBox, introBox, warning: overflow > .5 ? 'Dense content: check the fit or split this slide.' : '' }, score: overflow * 20 + Math.abs(columns - ideal) + (kind === 'columns' ? .15 : 0) });
    }
  }
  return ranked.sort((a, b) => a.score - b.score).map(r => r.plan);
}

export function composeSlideMarkdown(markdown: string, options: SlideCompositionOptions = {}): { content: SlideMarkdownContent; plan: SlideComposition; choices: SlideComposition[] } {
  let content = parseSlideMarkdown(markdown);
  const overBudget = content.groups.length > 12;
  // Preserve the full source when a slide exceeds the component budget.
  if (overBudget) content = { ...content, intro: '', groups: [{ heading: '', body: String(markdown).replace(/^#{1,3}\s+[^\n]*\n?/, '') }] };
  const choices = slideCompositions(content, options);
  if (overBudget) for (const choice of choices) choice.warning = 'Split this content across slides for readable text.';
  const saved = /^flow-(cards|columns|steps)-\d+-(\d)$/.exec(options.recipe ?? '');
  return { content, choices, plan: choices.find(c => c.id === options.recipe) ?? choices.find(c => saved && c.kind === saved[1] && c.columns === Number(saved[2])) ?? choices[0]! };
}
