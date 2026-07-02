// SPDX-License-Identifier: MPL-2.0
// ── SUSE palette (canonical: shells/web/src/palette.js) ───────────────────────
export var PINE = '#0c322c', FOG = '#efefef', WHITE = '#ffffff', DETAIL = '#6f6f6f';
export var BAND_PALETTE = ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'];

// Theme / density / preset tables (seed inputs via the hook-patch mechanism).
export var THEMES = {
  'suse-light': { nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c', background: '#ffffff', detail: '#6f6f6f', bandPalette: ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'] },
  'suse-dark':  { nodeFill: '#0c322c', nodeStroke: '#90ebcd', nodeText: '#ffffff', edgeColor: '#90ebcd', background: '#0c322c', detail: '#9fc7bb', bandPalette: ['#14463d', '#1c5a4e', '#247060', '#2e8573'] },
  'blueprint':  { nodeFill: '#0a2540', nodeStroke: '#7fd4ff', nodeText: '#eaf6ff', edgeColor: '#7fd4ff', background: '#0a2540', detail: '#9fc2dd', bandPalette: ['#10314f', '#163c5e', '#1c476d', '#22527c'] },
  'mono':       { nodeFill: '#ffffff', nodeStroke: '#111111', nodeText: '#111111', edgeColor: '#111111', background: '#ffffff', detail: '#666666', bandPalette: ['#eeeeee', '#e2e2e2', '#d6d6d6', '#cacaca'] },
  'mint':       { nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c', background: '#eafaf4', detail: '#6f6f6f', bandPalette: ['#90ebcd', '#bff1ea', '#d8f3ec', '#effbf7'] }
};
export var DENSITY = {
  compact:     { rowGap: 34,  siblingGap: 16, cardScale: 0.85 },
  cozy:        { rowGap: 56,  siblingGap: 30, cardScale: 1.0 },
  comfortable: { rowGap: 84,  siblingGap: 44, cardScale: 1.1 },
  spacious:    { rowGap: 120, siblingGap: 64, cardScale: 1.25 }
};
export var PRESETS = {
  'org-classic':    { diagramType: 'org', orgDir: 'down', theme: 'suse-light', density: 'cozy' },
  'layercake-mint': { diagramType: 'layercake', theme: 'mint', density: 'cozy' },
  'process-lr':     { diagramType: 'process', flowDir: 'right', theme: 'suse-light', arrowHead: 'triangle', density: 'cozy' },
  'blueprint':      { diagramType: 'process', theme: 'blueprint', gridBg: 'grid', density: 'comfortable' },
  'mono':           { theme: 'mono', density: 'cozy' }
};
export var VALID_TYPES = { org: 1, layercake: 1, process: 1, timeline: 1, cycle: 1, pyramid: 1, kanban: 1, matrix: 1, mindmap: 1, gantt: 1 };

// empty-state placeholder (type + source aware, faint sample sketch) hints.
export var EMPTY_HINTS = {
  org: 'Add cards — set each card\'s “Reports to” to build the tree',
  mindmap: 'Add cards — set “Parent” to branch out from the centre',
  layercake: 'Add cards and layers to stack your layercake',
  process: 'Add cards and flow arrows to lay out your process',
  timeline: 'Add cards in order — each one is a milestone on the spine',
  cycle: 'Add stages in order — they loop around a ring',
  pyramid: 'Add tiers top→bottom to stack a pyramid / funnel',
  kanban: 'Add cards and set each card\'s “Group” to a column',
  matrix: 'Add items and place each in a quadrant',
  gantt: 'Add tasks with a start + length to lay bars on a time axis'
};
export var SOURCE_HINTS = { text: 'Type a diagram — the field shows the syntax', ascii: 'Draw boxes with +  -  | and arrows with ->  ^  v', mermaid: 'Paste Mermaid: graph LR  /  A[Client] --> B(API)', table: 'Paste rows: id,label,parent  (or from,to,label)' };
