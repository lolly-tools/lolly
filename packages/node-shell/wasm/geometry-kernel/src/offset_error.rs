// SPDX-License-Identifier: MPL-2.0
//! Complete independent offset verification; original sample order, nearest solve and refinement limits.
use crate::nearest::{eval, nearest, Cubic};
use crate::ray::Box;

pub const MAX_CURVES: usize = 32;
const ERROR_SAMPLES: usize = 12;
const MAX_ERROR_DEPTH: usize = 20;
const ERROR_BUDGET: usize = 512;
type Point = [f64; 2];

// V8's two-argument norm in exactly rounded operations; the engine's `pmath.hypot` is the same formula.
pub(crate) fn norm(x: f64, y: f64) -> f64 {
    let (a, b) = (x.abs(), y.abs());
    let m = a.max(b);
    if m == 0.0 {
        return 0.0;
    }
    ((a / m) * (a / m) + (b / m) * (b / m)).sqrt() * m
}

pub(crate) fn tangent(c: &Cubic, t: f64) -> Option<Point> {
    let mt = 1.0 - t;
    let (a, b, d) = (3.0 * mt * mt, 6.0 * mt * t, 3.0 * t * t);
    let x = a * (c[2] - c[0]) + b * (c[4] - c[2]) + d * (c[6] - c[4]);
    let y = a * (c[3] - c[1]) + b * (c[5] - c[3]) + d * (c[7] - c[5]);
    let len = norm(x, y);
    if len > 1e-12 {
        return Some([x / len, y / len]);
    }
    let legs = if t < 0.5 {
        [[c[4] - c[0], c[5] - c[1]], [c[6] - c[0], c[7] - c[1]]]
    } else {
        [[c[6] - c[2], c[7] - c[3]], [c[6] - c[0], c[7] - c[1]]]
    };
    for [x, y] in legs {
        let len = norm(x, y);
        if len > 1e-12 {
            return Some([x / len, y / len]);
        }
    }
    None
}

fn sagitta(a: Point, m: Point, b: Point) -> f64 {
    let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
    let len = norm(dx, dy);
    if len < 1e-12 {
        return norm(m[0] - a[0], m[1] - a[1]);
    }
    ((m[0] - a[0]) * dy - (m[1] - a[1]) * dx).abs() / len
}

struct Verification<'a> {
    src: Cubic,
    curves: &'a [Cubic],
    boxes: &'a [Box],
    distance: f64,
    tol: f64,
    budget: usize,
    worst: [f64; 2],
}
impl Verification<'_> {
    fn measure(&mut self, u: f64) -> Option<Point> {
        let tan = tangent(&self.src, u)?;
        let p = eval(&self.src, u);
        let want = [p[0] - self.distance * tan[1], p[1] + self.distance * tan[0]];
        if u > 0.0 && u < 1.0 {
            let mut best = f64::INFINITY;
            for (c, b) in self.curves.iter().zip(self.boxes) {
                let dx = (b[0] - want[0]).max(0.0).max(want[0] - b[2]);
                let dy = (b[1] - want[1]).max(0.0).max(want[1] - b[3]);
                if norm(dx, dy) >= best {
                    continue;
                }
                let e = nearest(c, want[0], want[1]).distance;
                if e < best {
                    best = e;
                }
            }
            if best > self.worst[0] {
                self.worst = [best, u];
            }
        }
        Some(want)
    }

    fn refine(&mut self, u0: f64, u1: f64, w0: Option<Point>, w1: Option<Point>, depth: usize) {
        if self.budget == 0 || depth >= MAX_ERROR_DEPTH {
            return;
        }
        self.budget -= 1;
        let um = (u0 + u1) / 2.0;
        let wm = self.measure(um);
        let (Some(a), Some(b), Some(m)) = (w0, w1, wm) else {
            return;
        };
        if sagitta(a, m, b) <= self.tol {
            return;
        }
        self.refine(u0, um, w0, wm, depth + 1);
        self.refine(um, u1, wm, w1, depth + 1);
    }
}

pub fn verify(src: Cubic, curves: &[Cubic], boxes: &[Box], distance: f64, tol: f64) -> [f64; 2] {
    let mut state = Verification {
        src,
        curves,
        boxes,
        distance,
        tol,
        budget: ERROR_BUDGET,
        worst: [0.0, 0.5],
    };
    let mut prev = state.measure(0.0);
    for i in 1..=ERROR_SAMPLES {
        let u = i as f64 / ERROR_SAMPLES as f64;
        let here = state.measure(u);
        state.refine(u - 1.0 / ERROR_SAMPLES as f64, u, prev, here, 0);
        prev = here;
    }
    state.worst
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_line_and_missing_normal() {
        let src = [0.0, 0.0, 10.0, 0.0, 20.0, 0.0, 30.0, 0.0];
        let fit = [0.0, 6.0, 10.0, 6.0, 20.0, 6.0, 30.0, 6.0];
        let found = verify(src, &[fit], &[[0.0, 6.0, 30.0, 6.0]], 6.0, 0.01);
        assert!(found[0] < 1e-12 && found[1] > 0.0 && found[1] < 1.0);
        assert_eq!(
            verify([1.0; 8], &[fit], &[[0.0, 6.0, 30.0, 6.0]], 6.0, 0.01),
            [0.0, 0.5]
        );
        assert_eq!(norm(3.0, 4.0), 5.0);
        assert_eq!(norm(0.0, -0.0), 0.0);
    }
}
