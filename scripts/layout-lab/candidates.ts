// SPDX-License-Identifier: MPL-2.0
import { neutralSlideMaster } from '../../engine/src/rebrand-design-system.ts';
import { scoreArchetypes } from '../../engine/src/rebrand-archetype.ts';
import { seedFrame } from '../../engine/src/slide-master.ts';
import { designTextFit } from '../../engine/src/deck-compile.ts';
import type { DesignBoxRowV1, LayoutFeaturesV1 } from '../../packages/core/src/rebrand-v1.ts';
import type { Candidate, SlideBrief } from './types.ts';

const DESCRIPTIONS: Record<string, string> = {
  title: 'Opening title with space beneath for a subtitle.',
  'title-only': 'A single title, with no other content.',
  section: 'A short heading dividing sections of a presentation.',
  'main-point': 'One main statement for emphasis.',
  content: 'Title above a continuous passage of text. Suitable for explanations and dense copy.',
  agenda: 'Title above a meeting agenda or list of discussion topics.',
  'two-column': 'Two related passages presented side by side with equal weight.',
  comparison: 'Two alternatives presented side by side for comparison or choosing between options.',
  'columns-2': 'Two independent topics, each with a heading and description.',
  'columns-3': 'Three independent benefits or ideas with equal emphasis, arranged in columns.',
  'columns-4': 'Four independent benefits or ideas with equal emphasis, arranged in columns.',
  'grid-2x2': 'Four equal priorities or principles in a balanced two by two grid.',
  'steps-3': 'Three actions in sequence, numbered in the order the reader should follow.',
  'steps-4': 'Four actions in sequence, numbered in the order the reader should follow.',
  timeline: 'Milestones in chronological order, with dates above their descriptions.',
  'numbered-rows': 'A numbered vertical sequence of up to four actions with headings and descriptions.',
  'agenda-numbered': 'Up to five meeting agenda topics or short items in a numbered vertical list.',
  split: 'An explanation beside a large picture in a separate panel.',
  'image-and-text': 'A large picture on the left with an explanatory passage on the right.',
  visual: 'A title above a large picture with no accompanying body passage.',
};

export function validateBrief(input: unknown): SlideBrief {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected one slide brief.');
  const b = input as Record<string, unknown>;
  const bounded = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
  if (!bounded(b.id, 120) || !b.id || !bounded(b.title, 300) || !bounded(b.request, 600)) throw new Error('Invalid slide id, title or request.');
  if (!Array.isArray(b.blocks) || b.blocks.length > 6) throw new Error('Use at most six content blocks.');
  const ids = new Set<string>([`${b.id}.title`]);
  const blocks = b.blocks.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid content block.');
    const row = value as Record<string, unknown>;
    if (!bounded(row.id, 120) || !row.id || ids.has(row.id) || !bounded(row.heading, 160) || !bounded(row.text, 4000)) throw new Error('Invalid or duplicate content block.');
    ids.add(row.id);
    return { id: row.id, heading: row.heading, text: row.text };
  });
  let image: SlideBrief['image'];
  if (b.image !== undefined) {
    if (!b.image || typeof b.image !== 'object') throw new Error('Invalid image.');
    const row = b.image as Record<string, unknown>;
    if (!bounded(row.id, 120) || !row.id || ids.has(row.id) || !bounded(row.description, 500)) throw new Error('Invalid image reference.');
    image = { id: row.id, description: row.description };
  }
  const brief = { id: b.id, title: b.title, request: b.request, blocks, ...(image ? { image } : {}) };
  if (JSON.stringify(brief).length > 9000) throw new Error('The slide brief is too large.');
  return brief;
}

function featuresFor(b: SlideBrief): LayoutFeaturesV1 {
  const text = [b.title, ...b.blocks.flatMap(r => [r.heading, r.text])].join(' ');
  return {
    slideId: b.id, counts: { title: b.title ? 1 : 0, body: b.blocks.length, photo: b.image ? 1 : 0 },
    imageAreaShare: b.image ? 0.4 : 0, chartPresent: false, tablePresent: false,
    distinctLeftEdges: Math.min(2, b.blocks.length), equalSiblingBoxes: b.blocks.length,
    textParagraphs: b.blocks.length + 1, textWords: text.trim().split(/\s+/u).length,
  };
}

function fillCandidate(b: SlideBrief, id: string): Candidate | null {
  const master = neutralSlideMaster();
  const seeded = seedFrame(master, id, { frameId: b.id, x: 0, y: 0 });
  if (!seeded) return null;
  const all = seeded.layers.filter(row => !row.furniture);
  const images = all.filter(row => row.kind === 'image');
  if (images.length !== (b.image ? 1 : 0)) return null;
  const bodies = all.filter(row => row.role === 'body');
  const groups = seeded.cells ?? [];
  if (!b.blocks.length && bodies.length) return null;
  if (b.blocks.length && !bodies.length) return null;
  if (groups.length) {
    const flexible = ['numbered-rows', 'agenda-numbered', 'timeline'].includes(id);
    if (b.blocks.length > groups.length || (!flexible && b.blocks.length !== groups.length)) return null;
  } else if (bodies.length > 1 && bodies.length !== b.blocks.length) return null;

  const bindings: Record<string, string[]> = Object.create(null);
  const write = (row: DesignBoxRowV1 | undefined, text: string, sourceIds: string[]): void => {
    if (!row) return;
    row.text = text;
    for (const source of sourceIds) {
      bindings[source] ??= [];
      bindings[source].push(String(row.id));
    }
  };
  write(all.find(r => r.role === 'title'), b.title, [`${b.id}.title`]);
  if (groups.length) {
    for (const [i, block] of b.blocks.entries()) {
      const rows = all.filter(row => groups[i]!.layerIds.includes(String(row.id)));
      const label = rows.find(r => r.role === 'label');
      write(label, block.heading, block.heading ? [block.id] : []);
      write(rows.find(r => r.role === 'body'), label ? block.text : [block.heading, block.text].filter(Boolean).join('\n'), [block.id]);
      write(rows.find(r => r.role === 'number'), String(i + 1), []);
    }
  } else if (bodies.length === 1) {
    write(bodies[0], b.blocks.map(r => [r.heading, r.text].filter(Boolean).join('\n')).join('\n\n'), b.blocks.map(r => r.id));
  } else {
    for (const [i, row] of bodies.entries()) {
      const block = b.blocks[i]!;
      write(row, [block.heading, block.text].filter(Boolean).join('\n'), [block.id]);
    }
  }
  if (b.image) {
    images[0]!.image = b.image.id;
    images[0]!.name = b.image.description;
    bindings[b.image.id] = [String(images[0]!.id)];
  }
  const sourceIds = [`${b.id}.title`, ...b.blocks.map(r => r.id), ...(b.image ? [b.image.id] : [])];
  if (sourceIds.some(source => !bindings[source]?.length)) return null;
  const layers = all.filter(row => row.kind === 'image' || (typeof row.text === 'string' && row.text.length > 0));
  const overflow = layers.filter(row => row.kind === 'text' && designTextFit(row).needed > Number(row.h) + 0.5).map(row => String(row.id));
  const name = master.archetypes.find(a => a.id === id)!.name;
  seeded.frame.bg = '#ffffff';
  return {
    id, name, description: DESCRIPTIONS[id]!, ruleScore: 0, ruleReasons: [], overflow, bindings, frame: seeded.frame,
    compiled: {
      id: b.id, sourceSlideId: b.id, name: b.title, width: master.size.width, height: master.size.height,
      archetype: id, masterId: master.id, layers: [seeded.frame, ...layers], furnitureLayerIds: [], placeholderLayerIds: [],
    },
  };
}

export function prepareCandidates(brief: SlideBrief, sourceFeatures?: LayoutFeaturesV1): { eligible: Candidate[]; rejected: Candidate[] } {
  const b = validateBrief(brief);
  const master = neutralSlideMaster();
  const scores = scoreArchetypes(sourceFeatures ?? featuresFor(b), master, {
    coverSlide: b.blocks.length === 0 && !b.image,
    needs: { title: 1, body: b.blocks.length, visual: b.image ? 1 : 0 },
  });
  const candidates = Object.keys(DESCRIPTIONS).map(id => fillCandidate(b, id)).filter((c): c is Candidate => c !== null);
  for (const c of candidates) {
    const score = scores.find(s => s.id === c.id);
    c.ruleScore = score?.score ?? 0;
    c.ruleReasons = score?.reasons ?? [];
  }
  candidates.sort((a, z) => z.ruleScore - a.ruleScore || a.id.localeCompare(z.id));
  return { eligible: candidates.filter(c => !c.overflow.length).slice(0, 8), rejected: candidates.filter(c => c.overflow.length > 0) };
}

export function inputKey(brief: SlideBrief, candidates: Candidate[]): string {
  const text = JSON.stringify([brief, candidates.map(c => c.id)]);
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
}
