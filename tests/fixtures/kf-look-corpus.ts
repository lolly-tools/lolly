// SPDX-License-Identifier: MPL-2.0
/**
 * A Design document that uses every legacy keyframe channel and none of the appearance
 * channels (plans/328), across the box kinds and strokes the renderer draws differently:
 * fills, inside / centred / outside strokes, per-side widths, dashed strokes, rounded and
 * pill shapes, pen paths with and without arrowheads, a text box and boxes with no track.
 * tests/kf-look-hook.test.ts renders it and pins the bytes the renderer wrote before
 * the appearance channels existed.
 */
const DIAMOND = '1!catmull-rom!1_.5!0_1!.5_.5!1_0!.5';
const LINE = '1!line!0_0!0_1!1';

export const LEGACY_CORPUS: Record<string, unknown>[] = [
  { id: 'r1', kind: 'box', x: 10, y: 20, w: 200, h: 120, shape: 'rect', bg: '#ff6600', stroke: '#112233', strokeW: 3,
    start: 0, dur: 4, kf: 't0_x0_y0_s1_r0_o1*t1000_eo_x40_y-12_s1.2_r15_o0.5*t2000_x80_y0_s1_r0_o1' },
  { id: 'r2', kind: 'box', x: 300, y: 20, w: 160, h: 160, shape: 'rounded', radius: 24, bg: 'var(--brand-primary, #1e293b)',
    stroke: '#ffffff', strokeW: 6, strokeAlign: 'outside', start: 0.5, dur: 3, kf: 't0_z0_b0*t800_z120_b4*t1600_z0_b0', z: 20 },
  { id: 'r3', kind: 'box', x: 500, y: 20, w: 220, h: 100, shape: 'rect', bg: '#00b10f', stroke: '#000000', strokeW: 4,
    strokeTop: 8, strokeLeft: 0, strokeDash: 'dashed', start: 1, dur: 2, kf: 't0_w220_h100*t900_ev_w300_h140' },
  { id: 'r4', kind: 'box', x: 10, y: 200, w: 300, h: 80, shape: 'pill', bg: '#3366ff', stroke: '#ffcc00', strokeW: 2,
    strokeAlign: 'center', kf: 't0_rx0_ry0*t600_rx20_ry-15*t1200_eh_rx0_ry0', start: 0, dur: 2 },
  { id: 'r5', kind: 'box', x: 400, y: 220, w: 120, h: 120, shape: 'ellipse', bg: '#ffffff', opacity: 80,
    start: 2, dur: 1, kf: 't0_o0*t500_o1' },
  { id: 'p1', kind: 'path', x: 600, y: 200, w: 200, h: 150, shape: 'rect', bg: '#30ba78', stroke: '#11141f', strokeW: 4,
    fillRule: 'nonzero', path: DIAMOND, start: 0, dur: 3, kf: 't0_x0_s1*t1500_eb(0.32)(0)(0.67)(1)_x30_s0.8' },
  { id: 'p2', kind: 'path', x: 50, y: 400, w: 300, h: 100, stroke: '#ff0055', strokeW: 5, path: LINE,
    headEnd: 'triangle', start: 0, dur: 2, kf: 't0_o0*t400_o1' },
  { id: 'p3', kind: 'path', x: 400, y: 400, w: 160, h: 160, bg: '#ffeeaa', stroke: '#224466', strokeW: 3,
    strokeAlign: 'inside', path: DIAMOND, start: 0, dur: 2, kf: 't0_r0*t2000_r360' },
  { id: 't1', kind: 'text', x: 600, y: 420, w: 260, h: 60, text: 'Hello motion', fg: '#111111', fontSize: 32,
    start: 0, dur: 3, kf: 't0_y20_o0*t600_eo_y0_o1' },
  { id: 's1', kind: 'box', x: 900, y: 20, w: 100, h: 100, shape: 'rounded', radius: 12, bg: '#cccccc', stroke: '#333333', strokeW: 2 },
  { id: 's2', kind: 'path', x: 900, y: 200, w: 120, h: 80, bg: '#aaccee', stroke: '#001122', strokeW: 2, path: DIAMOND },
];
