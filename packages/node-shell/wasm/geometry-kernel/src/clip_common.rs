// SPDX-License-Identifier: MPL-2.0
//! Arithmetic shared by retained clipping and its stalled-contact scan.
pub(crate) use crate::fit_cubic::{bounds, derivative, split, sub};
use crate::nearest::nearest;
pub(crate) use crate::nearest::{eval, Cubic, Nearest};
pub(crate) use crate::offset_error::norm;

pub const TOUCH: f64 = 1e-12;
pub const FOOT_SPEED: f64 = 1e-3;
pub const MAX_HITS: usize = 128;
#[derive(Clone, Copy, Debug)]
pub struct Hit {
    pub t1: f64,
    pub t2: f64,
    pub x: f64,
    pub y: f64,
    pub dir: Option<f64>,
}
impl Hit {
    pub fn new(t1: f64, t2: f64, x: f64, y: f64) -> Self {
        Self {
            t1,
            t2,
            x,
            y,
            dir: None,
        }
    }
}
pub fn reverse(c: &Cubic) -> Cubic {
    [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]]
}
pub fn hull(c: &Cubic) -> [f64; 4] {
    [
        c[0].min(c[2]).min(c[4]).min(c[6]),
        c[1].min(c[3]).min(c[5]).min(c[7]),
        c[0].max(c[2]).max(c[4]).max(c[6]),
        c[1].max(c[3]).max(c[5]).max(c[7]),
    ]
}
pub fn overlap(a: [f64; 4], b: [f64; 4], eps: f64) -> bool {
    a[0] - eps <= b[2] && b[0] - eps <= a[2] && a[1] - eps <= b[3] && b[1] - eps <= a[3]
}
pub fn flat(c: &Cubic) -> f64 {
    let (dx, dy) = (c[6] - c[0], c[7] - c[1]);
    let len = norm(dx, dy);
    if len < 1e-12 {
        return norm(c[2] - c[0], c[3] - c[1]).max(norm(c[4] - c[0], c[5] - c[1]));
    }
    (((c[2] - c[0]) * dy - (c[3] - c[1]) * dx).abs() / len)
        .max(((c[4] - c[0]) * dy - (c[5] - c[1]) * dx).abs() / len)
}
#[derive(Clone, Copy)]
pub struct Fat {
    pub nx: f64,
    pub ny: f64,
    pub c0: f64,
    pub lo: f64,
    pub hi: f64,
}
pub fn fat(c: &Cubic) -> Option<Fat> {
    let (mut dx, mut dy) = (c[6] - c[0], c[7] - c[1]);
    if norm(dx, dy) < 1e-12 {
        dx = c[4] - c[0];
        dy = c[5] - c[1];
        if norm(dx, dy) < 1e-12 {
            return None;
        }
    }
    let len = norm(dx, dy);
    let (nx, ny) = (-dy / len, dx / len);
    let c0 = nx * c[0] + ny * c[1];
    let d1 = nx * c[2] + ny * c[3] - c0;
    let d2 = nx * c[4] + ny * c[5] - c0;
    let k = if d1 * d2 > 0.0 { 3.0 / 4.0 } else { 4.0 / 9.0 };
    Some(Fat {
        nx,
        ny,
        c0,
        lo: k * 0.0_f64.min(d1).min(d2),
        hi: k * 0.0_f64.max(d1).max(d2),
    })
}
pub fn clip(c: &Cubic, fat: Fat, cut: f64, test: f64) -> Option<[f64; 2]> {
    let mut pts = [[0.0; 2]; 4];
    for i in 0..4 {
        pts[i] = [
            i as f64 / 3.0,
            fat.nx * c[2 * i] + fat.ny * c[2 * i + 1] - fat.c0,
        ];
    }
    let mut range = [f64::INFINITY, f64::NEG_INFINITY];
    let mut add = |t: f64| {
        range[0] = range[0].min(t);
        range[1] = range[1].max(t);
    };
    for sign in [-1.0, 1.0] {
        let mut h = [[0.0; 2]; 4];
        let mut n = 0;
        for p in pts {
            while n >= 2 {
                let (o, a) = (h[n - 2], h[n - 1]);
                if sign * ((a[0] - o[0]) * (p[1] - o[1]) - (a[1] - o[1]) * (p[0] - o[0])) > 0.0 {
                    break;
                }
                n -= 1;
            }
            h[n] = p;
            n += 1;
        }
        for level in [fat.lo - cut, fat.hi + cut] {
            for i in 1..n {
                let (a, b) = (h[i - 1], h[i]);
                if (a[1] - level) * (b[1] - level) <= 0.0 && (b[1] - a[1]).abs() > 1e-18 {
                    add(a[0] + ((level - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
                }
            }
        }
    }
    if pts[0][1] >= fat.lo - test && pts[0][1] <= fat.hi + test {
        add(0.0);
    }
    if pts[3][1] >= fat.lo - test && pts[3][1] <= fat.hi + test {
        add(1.0);
    }
    if range[0] == f64::INFINITY {
        return None;
    }
    range[0] = 0.0_f64.max(range[0]);
    range[1] = 1.0_f64.min(range[1]);
    if range[1] < range[0] {
        None
    } else {
        Some(range)
    }
}
pub fn within(c: &Cubic, fat: Fat, pad: f64) -> bool {
    (0..4).all(|i| {
        let d = fat.nx * c[2 * i] + fat.ny * c[2 * i + 1] - fat.c0;
        d >= fat.lo - pad && d <= fat.hi + pad
    })
}
pub fn coincide(a: &Cubic, b: &Cubic, tol: f64) -> bool {
    (0..4).all(|i| norm(a[2 * i] - b[2 * i], a[2 * i + 1] - b[2 * i + 1]) <= tol)
}
pub fn reach(c: &Cubic) -> f64 {
    norm(c[2] - c[0], c[3] - c[1])
        .max(norm(c[4] - c[0], c[5] - c[1]))
        .max(norm(c[6] - c[0], c[7] - c[1]))
}
pub fn size(a: &Cubic, b: &Cubic) -> f64 {
    let (x, y) = (bounds(a), bounds(b));
    1.0_f64
        .max(x[2].max(y[2]) - x[0].min(y[0]))
        .max(x[3].max(y[3]) - x[1].min(y[1]))
}
pub fn magnitude(a: &Cubic, b: &Cubic) -> f64 {
    a.iter().chain(b).fold(0.0_f64, |m, v| m.max(v.abs()))
}
pub fn polished(c: &Cubic, x: f64, y: f64) -> Nearest {
    let n = nearest(c, x, y);
    let (mut t, mut best, mut worse, mut prev) = (n.t, n, 0, n.distance);
    for _ in 0..64 {
        let (p, d1) = (eval(c, t), derivative(c, t));
        let mt = 1.0 - t;
        let d2 = [
            6.0 * (mt * (c[4] - 2.0 * c[2] + c[0]) + t * (c[6] - 2.0 * c[4] + c[2])),
            6.0 * (mt * (c[5] - 2.0 * c[3] + c[1]) + t * (c[7] - 2.0 * c[5] + c[3])),
        ];
        let f = (p[0] - x) * d1[0] + (p[1] - y) * d1[1];
        let df = d1[0] * d1[0] + d1[1] * d1[1] + (p[0] - x) * d2[0] + (p[1] - y) * d2[1];
        if !(df.abs() > 0.0) {
            break;
        }
        let step = f / df;
        if !(step.abs() > 4.0 * f64::EPSILON) {
            break;
        }
        let tn = 1.0_f64.min(0.0_f64.max(t - step));
        if tn == t {
            break;
        }
        let pn = eval(c, tn);
        let dn = norm(pn[0] - x, pn[1] - y);
        if dn < best.distance {
            best = Nearest {
                t: tn,
                x: pn[0],
                y: pn[1],
                distance: dn,
            };
        }
        if !(dn < prev) {
            worse += 1;
            if worse >= 2 {
                break;
            }
        } else {
            worse = 0;
        }
        prev = dn;
        t = tn;
    }
    if best.distance < n.distance {
        best
    } else {
        n
    }
}
pub fn dedupe(list: Vec<Hit>, tol: f64) -> Vec<Hit> {
    let mut out: Vec<Hit> = Vec::with_capacity(MAX_HITS + 1);
    for i in list {
        if !out.iter().any(|o| {
            norm(o.x - i.x, o.y - i.y) <= tol * 8.0
                && (o.t1 - i.t1).abs() <= 1e-6 + tol
                && (o.t2 - i.t2).abs() <= 1e-6 + tol
        }) {
            out.push(i);
        }
    }
    out.sort_by(|a, b| a.t1.partial_cmp(&b.t1).unwrap());
    out
}
