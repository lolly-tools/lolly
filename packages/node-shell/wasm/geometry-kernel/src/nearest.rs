// SPDX-License-Identifier: MPL-2.0
//! Port of engine/src/geom/bezier.ts's nearest solver, preserving arithmetic order and thresholds.

pub type Cubic = [f64; 8];

#[derive(Debug, Clone, Copy)]
pub struct Nearest {
    pub t: f64,
    pub x: f64,
    pub y: f64,
    pub distance: f64,
}

pub(crate) fn eval(c: &Cubic, t: f64) -> [f64; 2] {
    let mt = 1.0 - t;
    let a = mt * mt * mt;
    let b = 3.0 * mt * mt * t;
    let d = 3.0 * mt * t * t;
    let e = t * t * t;
    [
        a * c[0] + b * c[2] + d * c[4] + e * c[6],
        a * c[1] + b * c[3] + d * c[5] + e * c[7],
    ]
}

fn poly_eval(co: &[f64; 6], n: usize, t: f64) -> f64 {
    let mut value = 0.0;
    for i in (0..=n).rev() {
        value = value * t + co[i];
    }
    value
}

fn poly_eval_d(co: &[f64; 6], n: usize, t: f64) -> (f64, f64) {
    let mut value = co[n];
    let mut slope = 0.0;
    for i in (0..n).rev() {
        slope = slope * t + value;
        value = value * t + co[i];
    }
    (value, slope)
}

fn root_in_bracket(
    co: &[f64; 6],
    n: usize,
    lo: f64,
    hi: f64,
    flo: f64,
    fhi: f64,
    f_tol: f64,
) -> f64 {
    let (mut a, mut b, mut fa, mut fb) = (lo, hi, flo, fhi);
    let mut t = a + ((b - a) * fa) / (fa - fb);
    if !(t > a && t < b) {
        t = (a + b) / 2.0;
    }
    for i in 0..80 {
        let (f, df) = poly_eval_d(co, n, t);
        if f == 0.0 || f.abs() <= f_tol {
            return t;
        }
        if (f < 0.0) == (fa < 0.0) {
            a = t;
            fa = f;
        } else {
            b = t;
            fb = f;
        }
        if b - a <= 4e-16 {
            break;
        }
        let mut next = if df != 0.0 { t - f / df } else { f64::NAN };
        if !(next > a && next < b) {
            next = a + ((b - a) * fa) / (fa - fb);
        }
        if (i >= 8 && (i & 1) == 0) || !(next > a && next < b) {
            next = (a + b) / 2.0;
        }
        if next == t {
            break;
        }
        t = next;
    }
    t.clamp(0.0, 1.0)
}

fn roots_in_01(
    co: &[f64; 6],
    len: usize,
    with_critical: bool,
    minima_only: bool,
) -> ([f64; 16], usize) {
    let mut out = [0.0; 16];
    let mut scale = 0.0;
    for value in &co[..len] {
        if value.abs() > scale {
            scale = value.abs();
        }
    }
    if scale <= 0.0 || !scale.is_finite() {
        return (out, 0);
    }
    let mut n = len - 1;
    while n > 0 && co[n].abs() <= scale * 1e-14 {
        n -= 1;
    }
    if n < 1 {
        return (out, 0);
    }
    let f_tol = scale * 8e-16;
    if n == 1 {
        let t = -co[0] / co[1];
        if (0.0..=1.0).contains(&t) {
            out[0] = t;
            return (out, 1);
        }
        return (out, 0);
    }
    if n == 2 {
        let (cc, bb, aa) = (co[0], co[1], co[2]);
        let disc = bb * bb - 4.0 * aa * cc;
        if disc < 0.0 {
            return (out, 0);
        }
        let s = disc.sqrt();
        let r1 = (-bb - if bb < 0.0 { -s } else { s }) / 2.0;
        let t1 = r1 / aa;
        let t2 = if r1 != 0.0 { cc / r1 } else { t1 };
        let (lo, hi) = (t1.min(t2), t1.max(t2));
        let mut count = 0;
        if (0.0..=1.0).contains(&lo) {
            out[count] = lo;
            count += 1;
        }
        if hi > lo && (0.0..=1.0).contains(&hi) {
            out[count] = hi;
            count += 1;
        }
        return (out, count);
    }
    let mut dc = [0.0; 6];
    for i in 1..=n {
        dc[i - 1] = co[i] * i as f64;
    }
    let (knots, nk) = roots_in_01(&dc, n, false, false);
    let mut count = 0;
    let mut pt = 0.0;
    let mut pf = poly_eval(co, n, 0.0);
    if pf == 0.0 {
        out[count] = 0.0;
        count += 1;
    }
    for i in 0..=nk {
        let k = if i < nk { knots[i] } else { 1.0 };
        if k <= pt {
            pt = k;
            continue;
        }
        let f = poly_eval(co, n, k);
        if f == 0.0 {
            out[count] = k;
            count += 1;
        } else if (pf < 0.0 && f > 0.0) || (pf > 0.0 && f < 0.0 && !minima_only) {
            out[count] = root_in_bracket(co, n, pt, k, pf, f, f_tol);
            count += 1;
        }
        pt = k;
        pf = f;
    }
    if with_critical {
        for knot in &knots[..nk] {
            out[count] = *knot;
            count += 1;
        }
    }
    (out, count)
}

pub fn nearest(c: &Cubic, px: f64, py: f64) -> Nearest {
    let ax = -c[0] + 3.0 * c[2] - 3.0 * c[4] + c[6];
    let ay = -c[1] + 3.0 * c[3] - 3.0 * c[5] + c[7];
    let bx = 3.0 * c[0] - 6.0 * c[2] + 3.0 * c[4];
    let by = 3.0 * c[1] - 6.0 * c[3] + 3.0 * c[5];
    let dx = -3.0 * c[0] + 3.0 * c[2];
    let dy = -3.0 * c[1] + 3.0 * c[3];
    let fx = c[0] - px;
    let fy = c[1] - py;
    let aa = ax * ax + ay * ay;
    let ab = ax * bx + ay * by;
    let ad = ax * dx + ay * dy;
    let af = ax * fx + ay * fy;
    let bb = bx * bx + by * by;
    let bd = bx * dx + by * dy;
    let bf = bx * fx + by * fy;
    let dd = dx * dx + dy * dy;
    let df = dx * fx + dy * fy;
    let q = [
        df,
        dd + 2.0 * bf,
        3.0 * (bd + af),
        4.0 * ad + 2.0 * bb,
        5.0 * ab,
        3.0 * aa,
    ];
    let (mut candidates, count) = roots_in_01(&q, 6, true, true);
    candidates[count] = 0.0;
    candidates[count + 1] = 1.0;
    let mut best = Nearest {
        t: 0.0,
        x: c[0],
        y: c[1],
        distance: f64::INFINITY,
    };
    let mut best_d2 = f64::INFINITY;
    for candidate in &candidates[..count + 2] {
        let t = if *candidate >= 0.0 {
            candidate.min(1.0)
        } else {
            0.0
        };
        let [x, y] = eval(c, t);
        let d2 = (x - px) * (x - px) + (y - py) * (y - py);
        if d2 < best_d2 {
            best_d2 = d2;
            best = Nearest {
                t,
                x,
                y,
                distance: 0.0,
            };
        }
    }
    best.distance = best_d2.sqrt();
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoints_and_degenerate_curves() {
        let c = [1.0; 8];
        let r = nearest(&c, 4.0, 5.0);
        assert_eq!((r.t, r.x, r.y, r.distance), (0.0, 1.0, 1.0, 5.0));
        let line = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 100.0, 0.0];
        let r = nearest(&line, 50.0, 10.0);
        assert!((r.t - 0.5_f64.cbrt()).abs() < 1e-10);
        assert!((r.distance - 10.0).abs() < 1e-10);
    }
    #[test]
    fn loop_reproducer_keeps_the_correct_basin() {
        let c = [
            158.5518, 54.1091, 110.9633, 109.922, 83.2758, 14.6683, 117.2366, 72.005,
        ];
        assert!(nearest(&c, 115.03178392553899, 68.35394304497076).distance < 6e-6);
    }
}
