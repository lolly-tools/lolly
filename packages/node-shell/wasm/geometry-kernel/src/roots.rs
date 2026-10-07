// SPDX-License-Identifier: MPL-2.0
//! Float64 port of geom/intersect.ts cubicRoots01, including direction merging.

pub const MAX_BATCH: usize = 4096;
pub const MAX_COEFFICIENT: f64 = 1e100;
pub const RECORD_BYTES: usize = 72;
const T_EPS: f64 = 1e-9;

#[derive(Clone, Copy, Default)]
pub struct Roots {
    pub count: usize,
    pub ts: [f64; 4],
    pub dirs: [f64; 4],
}

fn clamp(t: f64) -> f64 {
    // Math.max(0, t) produces positive zero even when t is negative zero.
    if t <= 0.0 {
        0.0
    } else if t >= 1.0 {
        1.0
    } else {
        t
    }
}

pub fn solve([a, b, c, d]: [f64; 4]) -> Roots {
    let scale = a.abs().max(b.abs()).max(c.abs()).max(d.abs());
    let mut out = Roots::default();
    if scale <= 0.0 || !scale.is_finite() {
        return out;
    }
    let tiny = 32.0 * f64::EPSILON * scale;
    let mut cuts = [-T_EPS, 1.0 + T_EPS, 0.0, 0.0];
    let mut nc = 2;
    let qa = 3.0 * a;
    let qb = 2.0 * b;
    let qc = c;
    if qa.abs() > 1e-300 {
        let disc = qb * qb - 4.0 * qa * qc;
        if disc >= 0.0 {
            let sq = disc.sqrt();
            let q = -0.5 * (qb + if qb < 0.0 { -sq } else { sq });
            let r0 = if q != 0.0 { q / qa } else { -qb / (2.0 * qa) };
            let r1 = if q != 0.0 { qc / q } else { r0 };
            if r0 > -T_EPS && r0 < 1.0 + T_EPS {
                cuts[nc] = r0;
                nc += 1;
            }
            if q != 0.0 && r1 > -T_EPS && r1 < 1.0 + T_EPS {
                cuts[nc] = r1;
                nc += 1;
            }
        }
    } else if qb.abs() > 1e-300 {
        let r = -qc / qb;
        if r > -T_EPS && r < 1.0 + T_EPS {
            cuts[nc] = r;
            nc += 1;
        }
    }
    for i in 1..nc {
        let v = cuts[i];
        let mut j = i;
        while j > 0 && cuts[j - 1] > v {
            cuts[j] = cuts[j - 1];
            j -= 1;
        }
        cuts[j] = v;
    }
    let mut vals = [0.0; 4];
    for i in 0..nc {
        let v = ((a * cuts[i] + b) * cuts[i] + c) * cuts[i] + d;
        vals[i] = if v.abs() <= tiny { 0.0 } else { v };
    }
    let mut i = 0;
    while i < nc {
        if vals[i] != 0.0 {
            i += 1;
            continue;
        }
        let mut j = i;
        while j + 1 < nc && vals[j + 1] == 0.0 {
            j += 1;
        }
        let before = if i > 0 { vals[i - 1] } else { 0.0 };
        let after = if j + 1 < nc { vals[j + 1] } else { 0.0 };
        let t = (cuts[i] + cuts[j]) / 2.0;
        if (-T_EPS..=1.0 + T_EPS).contains(&t) {
            out.ts[out.count] = clamp(t);
            out.dirs[out.count] = if before < 0.0 && after > 0.0 {
                1.0
            } else if before > 0.0 && after < 0.0 {
                -1.0
            } else {
                0.0
            };
            out.count += 1;
        }
        i = j + 1;
    }
    for i in 1..nc {
        let lo = cuts[i - 1];
        let hi = cuts[i];
        let flo = vals[i - 1];
        let fhi = vals[i];
        if flo == 0.0 || fhi == 0.0 || (flo < 0.0) == (fhi < 0.0) {
            continue;
        }
        let mut x0 = lo;
        let mut x1 = hi;
        let mut f0 = flo;
        let mut t = (lo + hi) / 2.0;
        for _ in 0..80 {
            let ft = ((a * t + b) * t + c) * t + d;
            if ft == 0.0 {
                break;
            }
            if (ft < 0.0) == (f0 < 0.0) {
                x0 = t;
                f0 = ft;
            } else {
                x1 = t;
            }
            if x1 - x0 <= 4e-16 {
                break;
            }
            let slope = (3.0 * a * t + 2.0 * b) * t + c;
            let mut next = if slope != 0.0 {
                t - ft / slope
            } else {
                (x0 + x1) / 2.0
            };
            if !(next > x0 && next < x1) {
                next = (x0 + x1) / 2.0;
            }
            t = next;
        }
        if (-T_EPS..=1.0 + T_EPS).contains(&t) {
            out.ts[out.count] = clamp(t);
            out.dirs[out.count] = if fhi > 0.0 { 1.0 } else { -1.0 };
            out.count += 1;
        }
    }
    for i in 1..out.count {
        let t = out.ts[i];
        let g = out.dirs[i];
        let mut j = i;
        while j > 0 && out.ts[j - 1] > t {
            out.ts[j] = out.ts[j - 1];
            out.dirs[j] = out.dirs[j - 1];
            j -= 1;
        }
        out.ts[j] = t;
        out.dirs[j] = g;
    }
    let mut merged = Roots::default();
    for i in 0..out.count {
        if merged.count == 0 || out.ts[i] - merged.ts[merged.count - 1] > 1e-9 {
            merged.ts[merged.count] = out.ts[i];
            merged.dirs[merged.count] = out.dirs[i];
            merged.count += 1;
        } else {
            let sum = merged.dirs[merged.count - 1] + out.dirs[i];
            merged.dirs[merged.count - 1] = if sum > 0.0 {
                1.0
            } else if sum < 0.0 {
                -1.0
            } else {
                0.0
            };
        }
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn isolated_roots_and_directions() {
        let roots = solve([1.0, -1.6, 0.73, -0.09]);
        assert_eq!(roots.count, 3);
        for (actual, expected) in roots.ts.iter().zip([0.2, 0.5, 0.9]) {
            assert!((actual - expected).abs() < 1e-12);
        }
        assert_eq!(&roots.dirs[..3], &[1.0, -1.0, 1.0]);
        let double = solve([1.0, -1.6, 0.8, -0.128]);
        assert_eq!(double.count, 2);
        assert_eq!(&double.dirs[..2], &[0.0, 1.0]);
        assert_eq!(solve([0.0; 4]).count, 0);
        assert_eq!(solve([0.0, 0.0, 1.0, -0.5]).ts[0], 0.5);
        assert_eq!(
            solve([0.0, 0.0, 1000.0000000000002, 1.1102230246251565e-16]).ts[0],
            0.0
        );
    }
}
