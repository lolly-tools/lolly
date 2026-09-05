// SPDX-License-Identifier: MPL-2.0
/** Generate the deterministic Penpot companion for the Lolly UI token demo. */
import { statSync, writeFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { appSurfaceToPenpotDoc, buildPenpotEntries, type AppSurface } from '../engine/src/index.ts';
import { withLollyUiTokens } from '../shells/web/src/lib/lolly-ui-tokens.ts';

const output = new URL('../export-panel-and-neurospicy-player.penpot', import.meta.url);
const frame = (id: string, name: string, x: number): AppSurface['nodes'][number] => ({ type: 'frame', id, name, order: x ? 2 : 1, x, y: 0, w: 480, h: 820, background: '#f8fafc' });
const box = (id: string, parent: string, name: string, x: number, y: number, w: number, h: number, background: string, radius = 10): AppSurface['nodes'][number] => ({ type: 'rect', role: 'surface', id, frame: parent, name, x, y, w, h, background, radius });
const text = (id: string, parent: string, name: string, value: string, x: number, y: number, w: number, h: number, size = 14, weight = 400, color = '#0b1021'): AppSurface['nodes'][number] => ({ type: 'text', role: 'text', id, frame: parent, name, text: value, x, y, w, h, fontSize: size, weight, color, font: 'sans', align: 'left', valign: 'top', lineHeight: 1.25 });

const nodes: AppSurface['nodes'] = [
  frame('export', 'Export panel', 0), frame('player', 'Neurospicy player', 540),
  box('export-panel', 'export', 'Panel surface', 24, 24, 432, 772, '#ffffff', 16),
  text('export-title', 'export', 'Title', 'Export', 48, 52, 240, 34, 26, 700),
  text('export-sub', 'export', 'Description', 'Prepare an on-brand asset for delivery.', 48, 94, 330, 24, 14, 400, '#64748b'),
  text('format-label', 'export', 'Format label', 'FORMAT', 48, 144, 120, 18, 11, 700, '#64748b'),
  box('png', 'export', 'PNG selected', 48, 170, 184, 46, '#0c322c', 6), text('png-t', 'export', 'PNG', 'PNG', 64, 184, 60, 20, 14, 700, '#ffffff'),
  box('svg', 'export', 'SVG option', 244, 170, 164, 46, '#f1f5f9', 6), text('svg-t', 'export', 'SVG', 'SVG', 260, 184, 60, 20, 14, 600),
  text('size-label', 'export', 'Size label', 'SIZE', 48, 244, 120, 18, 11, 700, '#64748b'),
  box('width', 'export', 'Width field', 48, 270, 176, 46, '#ffffff', 6), text('width-t', 'export', 'Width value', '1920 px', 64, 284, 100, 20, 14, 600),
  box('height', 'export', 'Height field', 232, 270, 176, 46, '#ffffff', 6), text('height-t', 'export', 'Height value', '1080 px', 248, 284, 100, 20, 14, 600),
  box('delivery', 'export', 'Delivery option', 48, 376, 360, 52, '#f1f5f9', 10), text('delivery-t', 'export', 'Delivery label', 'Include brand metadata', 64, 392, 230, 20, 14, 500), box('toggle', 'export', 'Toggle', 358, 390, 34, 18, '#30ba78', 999),
  box('export-action', 'export', 'Export action', 48, 680, 360, 56, '#0c322c', 10), text('export-action-t', 'export', 'Export action label', 'Export PNG', 176, 698, 130, 24, 16, 700, '#ffffff'),
  box('player-panel', 'player', 'Panel surface', 564, 24, 432, 772, '#ffffff', 16),
  text('player-title', 'player', 'Title', 'Neurospicy player', 588, 52, 300, 34, 26, 700), text('player-sub', 'player', 'Description', 'Focus soundtrack and ambient controls.', 588, 94, 340, 24, 14, 400, '#64748b'),
  box('track', 'player', 'Track selector', 588, 144, 384, 56, '#f1f5f9', 10), text('track-t', 'player', 'Track', 'Deep focus · Lolly FM', 608, 162, 240, 20, 15, 600),
  box('meter', 'player', 'Audio meter', 588, 220, 384, 28, '#0c322c', 8), box('progress', 'player', 'Playback progress', 588, 266, 384, 6, '#e2e8f0', 999), box('progress-fill', 'player', 'Playback progress fill', 588, 266, 142, 6, '#30ba78', 999),
  box('previous', 'player', 'Previous', 652, 302, 42, 42, '#f1f5f9', 999), text('previous-t', 'player', 'Previous glyph', '‹', 666, 307, 18, 28, 24, 700),
  box('play', 'player', 'Play', 745, 292, 62, 62, '#0c322c', 999), text('play-t', 'player', 'Play glyph', '▶', 766, 309, 22, 26, 20, 700, '#ffffff'),
  box('next', 'player', 'Next', 858, 302, 42, 42, '#f1f5f9', 999), text('next-t', 'player', 'Next glyph', '›', 872, 307, 18, 28, 24, 700),
  text('music-label', 'player', 'Music label', 'MUSIC', 588, 394, 80, 18, 11, 700, '#64748b'), box('music-volume', 'player', 'Music volume', 588, 422, 384, 6, '#e2e8f0', 999), box('music-fill', 'player', 'Music volume fill', 588, 422, 270, 6, '#30ba78', 999),
  text('atmo-label', 'player', 'Atmosphere label', 'ATMOSPHERE', 588, 550, 160, 18, 11, 700, '#64748b'), box('rain', 'player', 'Rain row', 588, 576, 384, 48, '#f1f5f9', 10), text('rain-t', 'player', 'Rain label', 'Rain', 608, 590, 90, 20, 14, 600), box('rain-toggle', 'player', 'Rain enabled', 926, 590, 30, 18, '#30ba78', 999),
  box('exit', 'player', 'Exit action', 588, 680, 384, 56, '#f1f5f9', 10), text('exit-t', 'player', 'Exit action label', 'Exit Neurospicy mode', 698, 698, 190, 24, 16, 700),
];

const surface: AppSurface = {
  id: 'export-and-neurospicy-sample', name: 'Lolly — Export & Neurospicy UI', canvas: { w: 1020, h: 820 }, background: '#f8fafc', dataPolicy: 'sample', nodes,
};
const doc = appSurfaceToPenpotDoc(surface, {
  fonts: { sans: 'SUSE', mono: 'SUSE Mono' }, tokens: withLollyUiTokens(null),
  generatedBy: 'Lolly UI token coverage demo',
});
const build = buildPenpotEntries(doc, {
  uuid: (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; })(),
  now: () => '2026-09-04T12:00:00.000Z',
});
// fflate's synchronous writer takes bytes (not its browser helper's string
// entries). Normalise the JSON entries here so it cannot mistake a JSON string
// for a nested archive tree.
const archive = Object.fromEntries(Object.entries(build.entries).map(([path, content]) =>
  [path, typeof content === 'string' ? strToU8(content) : content],
));
writeFileSync(output, zipSync(archive));
console.log(`${output.pathname} (${statSync(output).size} bytes; ${nodes.length} editable shapes)`);
