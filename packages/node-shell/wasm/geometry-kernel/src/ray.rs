// SPDX-License-Identifier: MPL-2.0
//! Complete ordered castRay port; the shell supplies the same reach and line norm.
use crate::{nearest, roots};
use nearest::Cubic;

pub const MAX_RANGES: usize = 4096;
pub type Box = [f64; 4];
pub type Query = [f64; 12];
pub type Range = (usize, usize, f64, f64);

fn sign(value: f64) -> f64 {
    if value > 0.0 {
        1.0
    } else if value < 0.0 {
        -1.0
    } else {
        value
    }
}
fn tangent(c: &Cubic, t: f64) -> [f64; 2] {
    let mt = 1.0 - t;
    let a = 3.0 * mt * mt;
    let b = 6.0 * mt * t;
    let d = 3.0 * t * t;
    [
        a * (c[2] - c[0]) + b * (c[4] - c[2]) + d * (c[6] - c[4]),
        a * (c[3] - c[1]) + b * (c[5] - c[3]) + d * (c[7] - c[5]),
    ]
}
fn in_bundle(ranges: &[Range], ci: usize, t: f64) -> bool {
    let first = ranges.partition_point(|r| r.0 < ci);
    for range in &ranges[first..] {
        if range.0 != ci {
            break;
        }
        if t >= range.2 - 1e-6 && t <= range.3 + 1e-6 {
            return true;
        }
    }
    false
}

pub fn cast(curves: &[Cubic], boxes: &[Box], q: Query, ranges: &[Range]) -> [f64; 4] {
    let [px, py, ux, uy, near, reach, len, ref_x, ref_y, has_ref, completing, mut work] = q;
    let complete = completing == 1.0;
    let has_ref = has_ref == 1.0;
    let twin = near * 100.0;
    let qx = px + ux * reach;
    let qy = py + uy * reach;
    let nx = -uy;
    let ny = ux;
    let hit_tol =
        near.max(64.0 * f64::EPSILON * px.abs().max(py.abs()).max(qx.abs()).max(qy.abs()).max(1.0));
    let look = hit_tol.max(4.0 * twin).max(near * 32.0);
    let rx0 = px.min(qx) - look;
    let rx1 = px.max(qx) + look;
    let ry0 = py.min(qy) - look;
    let ry1 = py.max(qy) + look;
    let x0 = px - ux * reach;
    let y0 = py - uy * reach;
    let dx = qx - x0;
    let dy = qy - y0;
    let line_nx = -dy / len;
    let line_ny = dx / len;
    let mut far = 0.0;
    let mut net = 0.0;
    let mut ok = true;
    for (ci, (c, b)) in curves.iter().zip(boxes).enumerate() {
        if work <= 0.0 {
            return [far, net, 0.0, work];
        }
        work -= 1.0;
        if b[2] < rx0 || b[0] > rx1 || b[3] < ry0 || b[1] > ry1 {
            continue;
        }
        if (nx * (c[0] - px) + ny * (c[1] - py)).abs() < near
            && (nx * (c[2] - px) + ny * (c[3] - py)).abs() < near
            && (nx * (c[4] - px) + ny * (c[5] - py)).abs() < near
            && (nx * (c[6] - px) + ny * (c[7] - py)).abs() < near
        {
            ok = false;
            if !complete {
                return [far, net, 0.0, work];
            }
            continue;
        }
        work -= 8.0;
        let mut distances = [0.0; 4];
        for i in 0..4 {
            distances[i] = line_nx * (c[i * 2] - x0) + line_ny * (c[i * 2 + 1] - y0);
        }
        let [d0, d1, d2, d3] = distances;
        let found = roots::solve([
            -d0 + 3.0 * d1 - 3.0 * d2 + d3,
            3.0 * d0 - 6.0 * d1 + 3.0 * d2,
            -3.0 * d0 + 3.0 * d1,
            d0,
        ]);
        for i in 0..found.count {
            let t = found.ts[i];
            let p = nearest::eval(c, t);
            let u = ((p[0] - x0) * dx + (p[1] - y0) * dy) / (len * len);
            if u < -hit_tol / len || u > 1.0 + hit_tol / len {
                continue;
            }
            let s = (u * 2.0 - 1.0) * reach;
            if s < -look {
                continue;
            }
            let tg = tangent(c, t);
            let off = s.abs();
            if !ranges.is_empty() && has_ref && off <= 4.0 * twin && in_bundle(ranges, ci, t) {
                net += sign(tg[0] * ref_x + tg[1] * ref_y);
                continue;
            }
            if has_ref && off <= near {
                net += sign(tg[0] * ref_x + tg[1] * ref_y);
                continue;
            }
            let cr = found.dirs[i];
            if s < 0.0 {
                if off <= near * 32.0 && !complete {
                    return [far, net, 0.0, work];
                }
                continue;
            }
            let sideless = cr == 0.0;
            if sideless || t < 1e-7 || t > 1.0 - 1e-7 || (has_ref && off <= near * 32.0) {
                ok = false;
                if !complete {
                    return [far, net, 0.0, work];
                }
                if sideless || t > 1.0 - 1e-7 {
                    continue;
                }
            }
            far += if cr > 0.0 { 1.0 } else { -1.0 };
        }
    }
    [far, net, if ok { 1.0 } else { 0.0 }, work]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn crossings_and_work_prefix_are_preserved() {
        let curves = [[1.0, -1.0, 1.0, -0.5, 1.0, 0.5, 1.0, 1.0]];
        let boxes = [[1.0, -1.0, 1.0, 1.0]];
        let mut q = [
            0.0, 0.0, 1.0, 0.0, 1e-9, 10.0, 20.0, 0.0, 0.0, 0.0, 0.0, 100.0,
        ];
        assert_eq!(cast(&curves, &boxes, q, &[]), [1.0, 0.0, 1.0, 91.0]);
        q[11] = 0.0;
        assert_eq!(cast(&curves, &boxes, q, &[]), [0.0, 0.0, 0.0, 0.0]);
        q[11] = 1.0;
        assert_eq!(cast(&curves, &boxes, q, &[]), [1.0, 0.0, 1.0, -8.0]);
    }
}
