// SPDX-License-Identifier: MPL-2.0
//! Exact arithmetic used by the source-specific fitter and its tight-box verifier.
use crate::nearest::{eval, Cubic};
#[cfg(feature = "fitting")]
use crate::offset_error::norm;
use crate::ray::Box;

pub fn derivative(c: &Cubic, t: f64) -> [f64; 2] {
    let mt = 1.0 - t;
    let (a, b, d) = (3.0 * mt * mt, 6.0 * mt * t, 3.0 * t * t);
    [
        a * (c[2] - c[0]) + b * (c[4] - c[2]) + d * (c[6] - c[4]),
        a * (c[3] - c[1]) + b * (c[5] - c[3]) + d * (c[7] - c[5]),
    ]
}
#[cfg(feature = "fitting")]
pub fn second(c: &Cubic, t: f64) -> [f64; 2] {
    let mt = 1.0 - t;
    [
        6.0 * mt * (c[4] - 2.0 * c[2] + c[0]) + 6.0 * t * (c[6] - 2.0 * c[4] + c[2]),
        6.0 * mt * (c[5] - 2.0 * c[3] + c[1]) + 6.0 * t * (c[7] - 2.0 * c[5] + c[3]),
    ]
}
pub fn split(c: &Cubic, t: f64) -> [Cubic; 2] {
    let ax = c[0] + (c[2] - c[0]) * t;
    let ay = c[1] + (c[3] - c[1]) * t;
    let bx = c[2] + (c[4] - c[2]) * t;
    let by = c[3] + (c[5] - c[3]) * t;
    let cx = c[4] + (c[6] - c[4]) * t;
    let cy = c[5] + (c[7] - c[5]) * t;
    let dx = ax + (bx - ax) * t;
    let dy = ay + (by - ay) * t;
    let ex = bx + (cx - bx) * t;
    let ey = by + (cy - by) * t;
    let fx = dx + (ex - dx) * t;
    let fy = dy + (ey - dy) * t;
    [
        [c[0], c[1], ax, ay, dx, dy, fx, fy],
        [fx, fy, ex, ey, cx, cy, c[6], c[7]],
    ]
}
pub fn sub(c: &Cubic, t0: f64, t1: f64) -> Cubic {
    if t0 == 0.0 && t1 == 1.0 {
        return *c;
    }
    if t0 > t1 {
        return sub(c, t1, t0);
    }
    let right = if t0 > 0.0 { split(c, t0)[1] } else { *c };
    if t1 >= 1.0 {
        return right;
    }
    let t = if t0 > 0.0 { (t1 - t0) / (1.0 - t0) } else { t1 };
    split(&right, t)[0]
}
#[cfg(feature = "fitting")]
pub fn line(x0: f64, y0: f64, x1: f64, y1: f64) -> Cubic {
    [
        x0,
        y0,
        x0 + (x1 - x0) / 3.0,
        y0 + (y1 - y0) / 3.0,
        x0 + (2.0 * (x1 - x0)) / 3.0,
        y0 + (2.0 * (y1 - y0)) / 3.0,
        x1,
        y1,
    ]
}
#[cfg(feature = "fitting")]
pub fn is_line(c: &Cubic) -> bool {
    let (dx, dy) = (c[6] - c[0], c[7] - c[1]);
    let len = norm(dx, dy);
    let flat = if len < 1e-12 {
        norm(c[2] - c[0], c[3] - c[1]).max(norm(c[4] - c[0], c[5] - c[1]))
    } else {
        (((c[2] - c[0]) * dy - (c[3] - c[1]) * dx).abs() / len)
            .max(((c[4] - c[0]) * dy - (c[5] - c[1]) * dx).abs() / len)
    };
    flat <= 1e-9
}
fn quadratic(a: f64, b: f64, c: f64, out: &mut Vec<f64>) {
    let scale = a.abs().max(b.abs()).max(c.abs());
    if !(scale > 0.0) {
        return;
    }
    if a.abs() <= 1e-14 * scale {
        if b.abs() > 1e-14 * scale {
            let t = -c / b;
            if t > 0.0 && t < 1.0 {
                out.push(t);
            }
        }
        return;
    }
    let disc = b * b - 4.0 * a * c;
    if disc < 0.0 {
        return;
    }
    let s = disc.sqrt();
    let q = -0.5 * (b + if b < 0.0 { -s } else { s });
    let r1 = q / a;
    let r2 = if q != 0.0 { c / q } else { r1 };
    if r1 > 0.0 && r1 < 1.0 {
        out.push(r1);
    }
    if r2 != r1 && r2 > 0.0 && r2 < 1.0 {
        out.push(r2);
    }
}
pub fn bounds(c: &Cubic) -> Box {
    let mut b = [
        c[0].min(c[6]),
        c[1].min(c[7]),
        c[0].max(c[6]),
        c[1].max(c[7]),
    ];
    let mut ts = Vec::with_capacity(4);
    for off in [0, 1] {
        let (p0, p1, p2, p3) = (c[off], c[2 + off], c[4 + off], c[6 + off]);
        quadratic(
            3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3),
            6.0 * (p0 - 2.0 * p1 + p2),
            3.0 * (p1 - p0),
            &mut ts,
        );
    }
    ts.sort_by(|a, b| a.partial_cmp(b).unwrap());
    for t in ts {
        let p = eval(c, t);
        if p[0] < b[0] {
            b[0] = p[0];
        }
        if p[0] > b[2] {
            b[2] = p[0];
        }
        if p[1] < b[1] {
            b[1] = p[1];
        }
        if p[1] > b[3] {
            b[3] = p[1];
        }
    }
    b
}
