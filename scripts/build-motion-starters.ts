// SPDX-License-Identifier: MPL-2.0
/** Build editable motion starters with the same recipes as the canvas picker. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { choreograph } from '../shells/web/src/views/choreograph.ts';
import type { LaunchRecipe } from '../shells/web/src/views/launch-choreograph.ts';
import { serialiseKf } from '../engine/src/keyframes.ts';

type Row = Record<string, string | number | boolean | object>;
const root = new URL('../community/', import.meta.url);
const looks = [
  { id: 'motion-warm', name: 'Motion · Warm editorial', description: 'Soft highlights and warm colour, with grain off for repeating clips.', values: { filmLook: 'portrait', temperature: 4, contrast: 8, highlights: -12, shadows: 8, saturation: 95, grain: 0, vignette: 0 } },
  { id: 'motion-clean', name: 'Motion · Clean colour', description: 'A small contrast lift and clear colour for product clips.', values: { filmLook: 'none', contrast: 6, highlights: -8, shadows: 4, saturation: 105, grain: 0, vignette: 0 } },
  { id: 'motion-mono', name: 'Motion · Editorial mono', description: 'Black and white with open shadows and no moving grain.', values: { filmLook: 'bw', contrast: 12, highlights: -10, shadows: 10, saturation: 100, grain: 0, vignette: 0 } },
];
const photoUrl = 'https://lolly.tools/tool/darkroom.png?' + new URLSearchParams(Object.entries(looks[0]!.values).map(([k, v]) => [k, String(v)])).toString();
const text = (id: string, x: number, y: number, w: number, h: number, size: number, copy: string): Row => ({ id, kind: 'text', x, y, w, h, text: copy, font: 'display', fontSize: size, weight: '600', fg: 'var(--brand-text, #17201c)', bg: 'transparent', fitText: true, lineHeight: 1.05, pad: 0 });
const base = (id: string): Row[] => JSON.parse(readFileSync(new URL(`design/templates/${id}.json`, root), 'utf8')).values.boxes.map((row: Row) => {
  const { kf, lane, start, dur, ...still } = row;
  return still;
});
const editorial = base('launch-editorial');
for (const row of editorial) if (row.text) row.text = ({ eyebrow: 'STUDIO NOTES  /  ISSUE 01', 'headline-a': 'Keep the look.', 'headline-b': 'Give it motion.', support: 'A clear message.\nA little room to breathe.', closing: 'Your next chapter starts here.' } as Record<string, string>)[String(row.id)] ?? String(row.text);
const features = base('launch-cascade');
for (const row of features) if (row.text) row.text = ({ eyebrow: 'THREE THINGS TO KNOW', headline: 'One idea. Three reasons.', 'benefit-0': 'Made to fit.', 'benefit-1': 'Easy to change.', 'benefit-2': 'Ready to share.', closing: 'Discover the details.' } as Record<string, string>)[String(row.id)] ?? String(row.text);
const photo: Row[] = [
  { id: 'ground', kind: 'box', x: 0, y: 0, w: 1920, h: 1080, bg: 'var(--brand-surface, #ffffff)', locked: true },
  { id: 'photo', kind: 'image', x: 1060, y: 80, w: 780, h: 920, image: { id: photoUrl }, fit: 'cover' },
  text('eyebrow', 100, 120, 840, 64, 32, 'IN THE FRAME'),
  text('headline', 100, 320, 860, 380, 144, 'A look worth\nkeeping.'),
  text('support', 100, 820, 800, 110, 40, 'Change the image. Keep the rhythm.'),
  { id: 'rule', kind: 'box', x: 100, y: 245, w: 120, h: 12, bg: 'var(--brand-primary, #286447)', shape: 'pill' },
];
const starters: Array<{ id: string; name: string; description: string; recipe: LaunchRecipe; rows: Row[]; beats: string[] }> = [
  { id: 'motion-editorial-loop', name: 'Motion · Editorial loop', description: 'Readable type and a geometric mark with gentle repeating movement. Replace the artwork or apply the same recipe to imported layers.', recipe: 'drift-loop', rows: editorial, beats: ['Read the message', 'Drift gently', 'Return to the opening pose'] },
  { id: 'motion-feature-loop', name: 'Motion · Feature cards', description: 'Three grouped cards assemble, hold and return. Card surfaces and their text move together.', recipe: 'assemble-loop', rows: features, beats: ['Assemble the cards', 'Hold the details', 'Unwind and repeat'] },
  { id: 'motion-photo-loop', name: 'Motion · Photo title', description: 'A graded Darkroom image beside editable type. Replace the image with your own photo or a Darkroom share link.', recipe: 'drift-loop', rows: photo, beats: ['Show the photograph', 'Keep the title readable', 'Return and repeat'] },
];
for (const entry of starters) {
  const values = (ms: number) => {
    const moving = entry.rows.filter(row => !row.locked);
    const plan = choreograph(moving.map(row => ({ id: String(row.id), group: String(row.group ?? ''), z: Number(row.z) || 0, cx: Number(row.x) + Number(row.w) / 2, cy: Number(row.y) + Number(row.h) / 2, w: Number(row.w), h: Number(row.h) })), { w: 1920, h: 1080 }, { showcase: entry.recipe, durationMs: ms, camera: false, float: false });
    const tracks = new Map(plan.boxes.map(row => [row.id, serialiseKf(row.keys)]));
    return { background: '{color.semantic.surface}', projectFps: '30', boxes: entry.rows.map(row => tracks.has(String(row.id)) ? { ...row, lane: 'seq', start: 0, dur: ms / 1000, kf: tracks.get(String(row.id)) } : row) };
  };
  writeFileSync(new URL(`design/templates/${entry.id}.json`, root), JSON.stringify({ id: entry.id, name: entry.name, category: 'Motion', description: entry.description, motion: { collection: 'Motion', recipe: entry.recipe, durationMs: 6000, posterMs: 3000, beats: entry.beats }, values: values(6000), presets: [{ id: 'short', name: '4 second loop', values: values(4000) }, { id: 'long', name: '8 second loop', values: values(8000) }] }, null, 2) + '\n');
}
mkdirSync(fileURLToPath(new URL('darkroom/templates/', root)), { recursive: true });
for (const look of looks) writeFileSync(new URL(`darkroom/templates/${look.id}.json`, root), JSON.stringify({ ...look, category: 'Motion looks' }, null, 2) + '\n');
console.log('Built three motion layouts and three reusable photo looks.');
