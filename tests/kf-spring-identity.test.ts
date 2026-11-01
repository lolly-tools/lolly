// SPDX-License-Identifier: MPL-2.0
/**
 * Springs and design-system eases (plans/329) are additive: a document that uses neither
 * must evaluate, serialise and export exactly as it did before 1.295.
 *
 * The corpus below holds every shipped curve, custom beziers, holds, overshoot on the
 * appearance channels and a camera track. Its evaluation over time, its canonical wire,
 * its CSS readouts, its subdivisions and its dotLottie compile are hashed, and the hash
 * was recorded on engine 1.290.0, before any of the spring code existed. A change that
 * moves one bit of an ordinary document fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMockHost } from '@lolly-tools/core';
import type { ExportOpts, HostV1 } from '../engine/src/bridge/host-v1.ts';
import { exportDesignLottie } from '../engine/src/design-lottie.ts';
import { readLottie } from '../engine/src/dotlottie.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import {
  KF_EASE_TOKENS, evaluateKf, kfEaseAt, kfEaseCss, kfEaseName, kfEasePoints, kfEaseToken,
  parseKf, serialiseKf, subdivideKfEase,
} from '../engine/src/keyframes.ts';

const TRACKS = [
  't0_x0_y0*t1000_x200_y-40',
  't0_eo_x0_s1*t600_ev_x120_s1.4*t1400_ea_x-30_s0.6*t2000_x0_s1',
  't0_eb(0.32)(0)(0.67)(1)_r0*t900_eb(0.1)(2.4)(0.3)(-0.8)_r180*t1800_r360',
  't0_eh_z0*t500_es_z140*t1200_ek_z0',
  't0_o0*t300_ev_o1*t1200_eh_o1*t1500_o0',
  // Overshoot on the appearance channels: the curve leaves the clamp range here today.
  't0_ev_cl0.9_ca0.1_cb-0.1_ts0_te0*t800_cl0.99_ca-0.2_cb0.3_ts0.2_te1',
  't0_ea_lw0_cr40*t700_lw12_cr0',
  't0_eio_x0_y0_z0_p1200_f0_a0*t1500_eo_x40_y-20_z-600_p900_f300_a0.6*t3000_x0_y0_z0_p1200_f0_a0',
  't0_el_v0*t2000_v2',
  't0_w100_h80*t1000_ev_w320_h40',
];

function host(): HostV1 {
  const h = createMockHost();
  h.geom = makeGeomApi();
  return h;
}

test('a document with no springs and no design-system eases is byte-identical to 1.290', async () => {
  const out: unknown[] = [];
  for (const raw of TRACKS) {
    const track = parseKf(raw);
    out.push(serialiseKf(track));
    const end = track[track.length - 1]!.t;
    for (let t = -50; t <= end + 50; t += 13.7) out.push(evaluateKf(track, t));
  }
  for (const tok of [...KF_EASE_TOKENS, 'eh', 'eb(0.32)(0)(0.67)(1)', 'eb(0.1)(2.4)(0.3)(-0.8)']) {
    out.push(kfEaseCss(tok), kfEaseName(tok), kfEasePoints(tok), kfEaseToken(kfEaseCss(tok)));
    for (let u = 0; u <= 1; u += 0.0625) out.push(kfEaseAt(tok, u));
    for (const lam of [0.1, 0.37, 0.5, 0.81]) out.push(subdivideKfEase(tok, lam));
  }
  const boxes = TRACKS.slice(0, 3).map((kf, i) => ({
    id: `b${i}`, kind: 'box', x: 20 + i * 60, y: 30, w: 80, h: 60, bg: '#e85d75', start: 0, dur: 3, lane: 'seq', kf,
  }));
  boxes.push({ id: 'look', kind: 'box', x: 10, y: 120, w: 120, h: 80, bg: '#2a6fdb', stroke: '#111111', strokeW: 4, radius: 12, start: 0, dur: 3, lane: 'seq', kf: TRACKS[5]! } as never);
  const opts: ExportOpts = { width: 400, height: 300, sourceDocument: { toolId: 'design', values: { background: 'transparent', projectFps: 30, boxes } } };
  const pkg = readLottie(new Uint8Array(await (await exportDesignLottie(opts, host())).arrayBuffer()));
  out.push(pkg.animations[0]!.animation);
  const hash = createHash('sha256').update(JSON.stringify(out)).digest('hex');
  assert.equal(hash, '1514e429ef6071c9d387ce66015eefe9ffb89e7158a58b94483a700ae2bcc1ef');
});
