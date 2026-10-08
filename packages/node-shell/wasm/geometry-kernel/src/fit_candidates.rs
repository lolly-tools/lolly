// SPDX-License-Identifier: MPL-2.0
//! Moment-constrained cubic candidates, including complex near misses and original arm ranking.
use crate::fit_math::{acos, atan2, cbrt, cos, mod2pi, sin};
use crate::fit_metric::CurveDist;
use crate::nearest::Cubic;
use crate::offset_error::norm;
use crate::offset_fit::{Sample, Source};

fn copysign(mag: f64, sign: f64) -> f64 {
    mag.abs().copysign(sign)
}
fn quadratic(c0: f64, c1: f64, c2: f64) -> Vec<f64> {
    let (sc0, sc1) = (c0 / c2, c1 / c2);
    if !sc0.is_finite() || !sc1.is_finite() {
        let root = -c0 / c1;
        if root.is_finite() {
            return vec![root];
        }
        return if c0 == 0.0 && c1 == 0.0 {
            vec![0.0]
        } else {
            vec![]
        };
    }
    let arg = sc1 * sc1 - 4.0 * sc0;
    let root1 = if !arg.is_finite() {
        -sc1
    } else if arg < 0.0 {
        return vec![];
    } else if arg == 0.0 {
        return vec![-0.5 * sc1];
    } else {
        -0.5 * (sc1 + copysign(arg.sqrt(), sc1))
    };
    let root2 = sc0 / root1;
    if !root2.is_finite() {
        return vec![root1];
    }
    if root2 > root1 {
        vec![root1, root2]
    } else {
        vec![root2, root1]
    }
}
fn cubic(c0: f64, c1: f64, c2: f64, c3: f64) -> Vec<f64> {
    let (recip, third) = (1.0 / c3, 1.0 / 3.0);
    let (s2, s1, s0) = (c2 * (third * recip), c1 * (third * recip), c0 * recip);
    if !(s0.is_finite() && s1.is_finite() && s2.is_finite()) {
        return quadratic(c0, c1, c2);
    }
    let d0 = -s2 * s2 + s1;
    let d1 = -s1 * s2 + s0;
    let d2 = s2 * s0 - s1 * s1;
    let disc = 4.0 * d0 * d2 - d1 * d1;
    let de = -2.0 * s2 * d0 + d1;
    if disc < 0.0 {
        let (sq, r) = ((-0.25 * disc).sqrt(), -0.5 * de);
        return vec![cbrt(r + sq) + cbrt(r - sq) - s2];
    }
    if disc == 0.0 {
        let t1 = copysign((-d0).sqrt(), de);
        return vec![t1 - s2, -2.0 * t1 - s2];
    }
    let th = atan2(disc.sqrt(), -de) * third;
    let (thc, ss3) = (cos(th), sin(th) * 3.0_f64.sqrt());
    let t = 2.0 * (-d0).sqrt();
    vec![
        t * thc - s2,
        t * 0.5 * (-thc + ss3) - s2,
        t * 0.5 * (-thc - ss3) - s2,
    ]
}
fn dominant(g: f64, h: f64) -> f64 {
    let (q, r) = ((-1.0 / 3.0) * g, 0.5 * h);
    let mut x = if r == 0.0 {
        if g > 0.0 {
            0.0
        } else {
            (-g).sqrt()
        }
    } else if r * r < q * q * q {
        let t = r / (q * q * q).sqrt();
        -2.0 * q.sqrt() * copysign(cos(acos(t.abs()) * (1.0 / 3.0)), t)
    } else {
        let a = cbrt(-r - copysign((r * r - q * q * q).sqrt(), r));
        if a == 0.0 {
            0.0
        } else {
            a + q / a
        }
    };
    let mut f = (x * x + g) * x + h;
    let scale = (x * x * x).abs().max((g * x).abs()).max(h.abs());
    if f.abs() < 2.22045e-16 * scale {
        return x;
    }
    for _ in 0..8 {
        let df = 3.0 * x * x + g;
        if df == 0.0 {
            break;
        }
        let nx = x - f / df;
        let nf = (nx * nx + g) * nx + h;
        if nf == 0.0 {
            return nx;
        }
        if nf.abs() >= f.abs() {
            break;
        }
        x = nx;
        f = nf;
    }
    x
}
fn eps_rel(raw: f64, reference: f64) -> f64 {
    if reference == 0.0 {
        raw.abs()
    } else {
        ((raw - reference) / reference).abs()
    }
}
fn eps_q(v: [f64; 4], a: f64, b: f64, c: f64) -> f64 {
    let [a1, b1, a2, b2] = v;
    eps_rel(a1 + a2, a) + eps_rel(b1 + a1 * a2 + b2, b) + eps_rel(b1 * a2 + a1 * b2, c)
}
fn eps_t(v: [f64; 4], a: f64, b: f64, c: f64, d: f64) -> f64 {
    eps_q(v, a, b, c) + eps_rel(v[1] * v[3], d)
}
fn quartic(a: f64, b: f64, c: f64, d: f64) -> Option<[[f64; 2]; 2]> {
    let disc = 9.0 * a * a - 24.0 * b;
    let s = if disc >= 0.0 {
        (-2.0 * b) / (3.0 * a + copysign(disc.sqrt(), a))
    } else {
        -0.25 * a
    };
    let ap = a + 4.0 * s;
    let bp = b + 3.0 * s * (a + 2.0 * s);
    let cp = c + s * (2.0 * b + s * (3.0 * a + 4.0 * s));
    let dp = d + s * (c + s * (b + s * (a + s)));
    let gp = ap * cp - 4.0 * dp - (1.0 / 3.0) * bp * bp;
    let hp =
        (ap * cp + 8.0 * dp - (2.0 / 9.0) * bp * bp) * (1.0 / 3.0) * bp - cp * cp - ap * ap * dp;
    if !gp.is_finite() || !hp.is_finite() {
        return None;
    }
    let phi = dominant(gp, hp);
    if !phi.is_finite() {
        return None;
    }
    let l1 = a * 0.5;
    let l3 = (1.0 / 6.0) * b + 0.5 * phi;
    let delt2 = c - a * l3;
    let d2c1 = (2.0 / 3.0) * b - phi - l1 * l1;
    let l2c1 = (0.5 * delt2) / d2c1;
    let l2c2 = (2.0 * (d - l3 * l3)) / delt2;
    let d2c2 = (0.5 * delt2) / l2c2;
    let (mut d2, mut l2, mut best_eps) = (0.0, 0.0, 0.0);
    for (i, [cd, cl]) in [[d2c1, l2c1], [d2c2, l2c2], [d2c1, l2c2]]
        .into_iter()
        .enumerate()
    {
        let e = eps_rel(cd + l1 * l1 + 2.0 * l3, b)
            + eps_rel(2.0 * (cd * cl + l1 * l3), c)
            + eps_rel(cd * cl * cl + l3 * l3, d);
        if i == 0 || e < best_eps {
            d2 = cd;
            l2 = cl;
            best_eps = e;
        }
    }
    let (mut a1, mut b1, mut a2, mut b2);
    if d2 < 0.0 {
        let sq = (-d2).sqrt();
        a1 = l1 + sq;
        b1 = l3 + sq * l2;
        a2 = l1 - sq;
        b2 = l3 - sq * l2;
        if b2.abs() < b1.abs() {
            b2 = d / b1;
        } else if b2.abs() > b1.abs() {
            b1 = d / b2;
        }
        if a1.abs() != a2.abs() {
            let (o1, o2) = (a1, a2);
            let alts = if o1.abs() < o2.abs() {
                [
                    [a - o2, o2],
                    [(c - b1 * o2) / b2, o2],
                    [(b - b2 - b1) / o2, o2],
                ]
            } else {
                [
                    [o1, a - o1],
                    [o1, (c - o1 * b2) / b1],
                    [o1, (b - b2 - b1) / o1],
                ]
            };
            let (mut best_q, mut has) = (0.0, false);
            for [t1, t2] in alts {
                if !t1.is_finite() || !t2.is_finite() {
                    continue;
                }
                let e = eps_q([t1, b1, t2, b2], a, b, c);
                if !has || e < best_q {
                    a1 = t1;
                    a2 = t2;
                    best_q = e;
                    has = true;
                }
            }
        }
    } else if d2 == 0.0 {
        let d3 = d - l3 * l3;
        let sq = (-d3).sqrt();
        a1 = l1;
        b1 = l3 + sq;
        a2 = l1;
        b2 = l3 - sq;
        if b1.abs() > b2.abs() {
            b2 = d / b1;
        } else if b2.abs() > b1.abs() {
            b1 = d / b2;
        }
    } else {
        return None;
    }
    let mut eps = eps_t([a1, b1, a2, b2], a, b, c, d);
    for _ in 0..8 {
        if eps == 0.0 {
            break;
        }
        let f0 = b1 * b2 - d;
        let f1 = b1 * a2 + a1 * b2 - c;
        let f2 = b1 + a1 * a2 + b2 - b;
        let f3 = a1 + a2 - a;
        let k1 = a1 - a2;
        let det = b1 * b1 - b1 * (a2 * k1 + 2.0 * b2) + b2 * (a1 * k1 + b2);
        if det == 0.0 {
            break;
        }
        let inv = 1.0 / det;
        let k2 = b2 - b1;
        let k3 = b1 * a2 - a1 * b2;
        let na1 = a1 - inv * (k1 * f0 + k2 * f1 + k3 * f2 - (b1 * k2 + a1 * k3) * f3);
        let nb1 = b1 - inv * ((a1 * k1 + k2) * f0 - b1 * k1 * f1 - b1 * k2 * f2 - b1 * k3 * f3);
        let na2 = a2 - inv * (-k1 * f0 - k2 * f1 - k3 * f2 + (a2 * k3 + b2 * k2) * f3);
        let nb2 = b2 - inv * (-(a2 * k1 + k2) * f0 + b2 * k1 * f1 + b2 * k2 * f2 + b2 * k3 * f3);
        let ne = eps_t([na1, nb1, na2, nb2], a, b, c, d);
        if !(ne < eps) {
            break;
        }
        a1 = na1;
        b1 = nb1;
        a2 = na2;
        b2 = nb2;
        eps = ne;
    }
    Some([[a1, b1], [a2, b2]])
}

pub fn endpoint(src: Source, t: f64, dir: f64, span: f64) -> Sample {
    let s = src.sample(t);
    let (mut tx, mut ty) = (s.tx, s.ty);
    let len = norm(tx, ty);
    let mut step = span * 1e-7;
    if len > 1e-12 {
        let p = src.sample((t + dir * step).clamp(0.0, 1.0));
        let pl = norm(p.tx, p.ty);
        if pl > 1e-12 {
            let sine = (tx * p.ty - ty * p.tx).abs() / (len * pl);
            let cosine = (tx * p.tx + ty * p.ty) / (len * pl);
            if cosine < 0.0 || sine > 0.02 {
                tx = p.tx;
                ty = p.ty;
            }
        }
        return Sample { tx, ty, ..s };
    }
    for _ in 0..6 {
        if !(norm(tx, ty) < 1e-12) {
            break;
        }
        let p = src.sample((t + dir * step).clamp(0.0, 1.0));
        tx = p.tx;
        ty = p.ty;
        if norm(tx, ty) < 1e-12 {
            tx = p.x - s.x;
            ty = p.y - s.y;
        }
        step *= 8.0;
    }
    Sample { tx, ty, ..s }
}
struct Frame {
    sx: f64,
    sy: f64,
    ex: f64,
    ey: f64,
    th: f64,
    th0: f64,
    th1: f64,
    chord: f64,
    chord2: f64,
    area: f64,
    mx: f64,
}
fn frame(src: Source, t0: f64, t1: f64) -> Option<Frame> {
    let span = (t1 - t0).abs();
    let start = endpoint(src, t0, 1.0, span);
    let end = endpoint(src, t1, -1.0, span);
    let (dx, dy) = (end.x - start.x, end.y - start.y);
    let chord2 = dx * dx + dy * dy;
    if !(chord2 > 0.0) || !chord2.is_finite() {
        return None;
    }
    let chord = chord2.sqrt();
    let th = atan2(dy, dx);
    let th0 = mod2pi(atan2(start.ty, start.tx) - th);
    let th1 = mod2pi(th - atan2(end.ty, end.tx));
    let [area, moment] = src.moments(t0, t1);
    if !area.is_finite() || !moment.is_finite() {
        return None;
    }
    Some(Frame {
        sx: start.x,
        sy: start.y,
        ex: end.x,
        ey: end.y,
        th,
        th0,
        th1,
        chord,
        chord2,
        area: area / chord2,
        mx: moment / (chord2 * chord),
    })
}
struct Candidate {
    c: Cubic,
    d0: f64,
    d1: f64,
}
fn map(f: &Frame, d0: f64, d1: f64) -> Candidate {
    let (cs, sn) = (cos(f.th) * f.chord, sin(f.th) * f.chord);
    let place = |ux: f64, uy: f64| [f.sx + cs * ux - sn * uy, f.sy + sn * ux + cs * uy];
    let p1 = place(d0 * cos(f.th0), d0 * sin(f.th0));
    let p2 = place(1.0 - d1 * cos(f.th1), d1 * sin(f.th1));
    Candidate {
        c: [f.sx, f.sy, p1[0], p1[1], p2[0], p2[1], f.ex, f.ey],
        d0,
        d1,
    }
}
fn candidates(f: &Frame) -> Vec<Candidate> {
    let (s0, c0, s1, c1) = (sin(f.th0), cos(f.th0), sin(f.th1), cos(f.th1));
    let (area, mx) = (f.area, f.mx);
    let a4 = -9.0
        * c0
        * (((2.0 * s1 * c1 * c0 + s0 * (2.0 * c1 * c1 - 1.0)) * c0 - 2.0 * s1 * c1) * c0
            - c1 * c1 * s0);
    let a3 = 12.0
        * ((((c1 * (30.0 * area * c1 - s1) - 15.0 * area) * c0 + 2.0 * s0
            - c1 * s0 * (c1 + 30.0 * area * s1))
            * c0
            + c1 * (s1 - 15.0 * area * c1))
            * c0
            - s0 * c1 * c1);
    let a2 = 12.0
        * ((((70.0 * mx + 15.0 * area) * s1 * s1
            + c1 * (9.0 * s1 - 70.0 * c1 * mx - 5.0 * c1 * area))
            * c0
            - 5.0 * s0 * s1 * (3.0 * s1 - 4.0 * c1 * (7.0 * mx + area)))
            * c0
            - c1 * (9.0 * s1 - 70.0 * c1 * mx - 5.0 * c1 * area));
    let a1 = 16.0
        * (((12.0 * s0 - 5.0 * c0 * (42.0 * mx - 17.0 * area)) * s1
            - 70.0 * c1 * (3.0 * mx - area) * s0
            - 75.0 * c0 * c1 * area * area)
            * s1
            - 75.0 * c1 * c1 * area * area * s0);
    let a0 = 80.0 * s1 * (42.0 * s1 * mx - 25.0 * area * (s1 - c1 * area));
    let mut roots = Vec::with_capacity(4);
    if a4.abs() > 1e-12 {
        if let Some(quads) = quartic(a3 / a4, a2 / a4, a1 / a4, a0 / a4) {
            for [qc1, qc0] in quads {
                let qr = quadratic(qc0, qc1, 1.0);
                if qr.is_empty() {
                    roots.push(-0.5 * qc1);
                } else {
                    roots.extend(qr);
                }
            }
        }
    } else if a3.abs() > 1e-12 {
        roots.extend(cubic(a0, a1, a2, a3));
    } else if a2.abs() > 1e-12 || a1.abs() > 1e-12 || a0.abs() > 1e-12 {
        roots.extend(quadratic(a0, a1, a2));
    } else {
        return vec![map(f, 1.0 / 3.0, 1.0 / 3.0)];
    }
    let s01 = s0 * c1 + s1 * c0;
    let mut out = Vec::with_capacity(4);
    for root in roots {
        if !root.is_finite() {
            continue;
        }
        let (mut d0, mut d1);
        if root > 0.0 {
            d0 = root;
            d1 = (root * s0 - area * (10.0 / 3.0)) / (0.5 * root * s01 - s1);
            if !(d1 > 0.0) {
                d0 = s1 / s01;
                d1 = 0.0;
            }
        } else {
            d0 = 0.0;
            d1 = s0 / s01;
        }
        if !(d0 >= 0.0) || !(d1 >= 0.0) || !d0.is_finite() || !d1.is_finite() {
            continue;
        }
        out.push(map(f, d0, d1));
    }
    out
}
pub fn try_line(
    src: Source,
    t0: f64,
    t1: f64,
    tol: f64,
    start: Sample,
    end: Sample,
) -> Option<Cubic> {
    let acc2 = tol * tol;
    let dt = (t1 - t0) / 8.0;
    let (dx, dy) = (end.x - start.x, end.y - start.y);
    let len2 = dx * dx + dy * dy;
    for i in 0..7 {
        let p = src.sample(t0 + (i + 1) as f64 * dt);
        let u = if len2 > 0.0 {
            (((p.x - start.x) * dx + (p.y - start.y) * dy) / len2).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let (x, y) = (start.x + dx * u - p.x, start.y + dy * u - p.y);
        if x * x + y * y > acc2 {
            return None;
        }
    }
    Some(crate::fit_cubic::line(start.x, start.y, end.x, end.y))
}
pub fn fit_one(src: Source, t0: f64, t1: f64, tol: f64) -> Option<Cubic> {
    let f = frame(src, t0, t1)?;
    let acc2 = tol * tol;
    if f.chord2 <= acc2 {
        return try_line(
            src,
            t0,
            t1,
            tol,
            Sample {
                x: f.sx,
                y: f.sy,
                ..Sample::default()
            },
            Sample {
                x: f.ex,
                y: f.ey,
                ..Sample::default()
            },
        );
    }
    let mut d = CurveDist::new(src, t0, t1);
    let (mut best, mut best_err2) = (None, f64::INFINITY);
    for cand in candidates(&f) {
        let err2 = d.eval(&cand.c, acc2);
        if !err2.is_finite() {
            continue;
        }
        let penalty = |d: f64| 1.0 + (d - 0.65).max(0.0) * 2.0;
        let arm = penalty(cand.d0).max(penalty(cand.d1));
        let pen = err2 * (arm * arm);
        if pen < acc2 && pen < best_err2 {
            best = Some(cand.c);
            best_err2 = pen;
        }
    }
    best
}
