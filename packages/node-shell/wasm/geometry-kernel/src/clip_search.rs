// SPDX-License-Identifier: MPL-2.0
//! Ordered whole-pair intersection, initial search and complete overrun handoff.
use crate::clip_common::*;
use crate::clip_scan;
use crate::nearest::nearest;
use crate::roots::solve;

#[derive(Clone, Copy)]
pub struct Limits {
    pub initial: usize,
    pub overrun: usize,
    pub stalled: usize,
}
#[derive(Default, Clone, Copy)]
pub struct Counts {
    pub reached: bool,
    pub nodes: usize,
    pub overrun: bool,
    pub searched: bool,
    pub overrun_nodes: usize,
    pub ceiling: bool,
}
pub struct ResultPair {
    pub hits: Vec<Hit>,
    pub counts: Counts,
}
struct Work {
    nodes: usize,
    limit: usize,
    over: bool,
}
pub struct Search {
    pub a: Cubic,
    pub b: Cubic,
    pub out: Vec<Hit>,
    pub stalled: Vec<[f64; 4]>,
    pub pad: f64,
    pub size: f64,
    twin: i32,
    ar: Cubic,
    br: Cubic,
    nodes: usize,
    over: bool,
    limits: Limits,
    failed: bool,
}
fn emit(out: &mut Vec<Hit>, swap: bool, t1: f64, t2: f64, x: f64, y: f64) {
    out.push(if swap {
        Hit::new(t2, t1, x, y)
    } else {
        Hit::new(t1, t2, x, y)
    });
}
fn initial(
    a: &Cubic,
    b: &Cubic,
    r: [f64; 4],
    tol: f64,
    depth: usize,
    out: &mut Vec<Hit>,
    work: &mut Work,
    swap: bool,
) {
    if work.over {
        return;
    }
    work.nodes += 1;
    if work.nodes > work.limit {
        work.over = true;
        return;
    }
    if out.len() > 128 || depth > 60 {
        return;
    }
    if !overlap(hull(a), hull(b), tol) {
        return;
    }
    let s1 = norm(a[6] - a[0], a[7] - a[1]) + flat(a);
    let s2 = norm(b[6] - b[0], b[7] - b[1]) + flat(b);
    if s1 <= tol && s2 <= tol {
        let p = eval(a, 0.5);
        emit(
            out,
            swap,
            (r[0] + r[1]) / 2.0,
            (r[2] + r[3]) / 2.0,
            p[0],
            p[1],
        );
        return;
    }
    let Some([lo, hi]) = fat(b).map_or(Some([0.0, 1.0]), |f| clip(a, f, 0.0, 1e-12)) else {
        return;
    };
    if hi - lo > 0.8 {
        if s1 >= s2 {
            let [left, right] = split(a, 0.5);
            let mid = (r[0] + r[1]) / 2.0;
            initial(
                &left,
                b,
                [r[0], mid, r[2], r[3]],
                tol,
                depth + 1,
                out,
                work,
                swap,
            );
            initial(
                &right,
                b,
                [mid, r[1], r[2], r[3]],
                tol,
                depth + 1,
                out,
                work,
                swap,
            );
        } else {
            let [left, right] = split(b, 0.5);
            let mid = (r[2] + r[3]) / 2.0;
            initial(
                a,
                &left,
                [r[0], r[1], r[2], mid],
                tol,
                depth + 1,
                out,
                work,
                swap,
            );
            initial(
                a,
                &right,
                [r[0], r[1], mid, r[3]],
                tol,
                depth + 1,
                out,
                work,
                swap,
            );
        }
        return;
    }
    let piece = sub(a, lo, hi);
    initial(
        b,
        &piece,
        [
            r[2],
            r[3],
            r[0] + (r[1] - r[0]) * lo,
            r[0] + (r[1] - r[0]) * hi,
        ],
        tol,
        depth + 1,
        out,
        work,
        !swap,
    );
}
fn stall(s: &mut Search, swap: bool, r: [f64; 4]) {
    if s.stalled.len() >= s.limits.stalled {
        return;
    }
    if s.stalled.try_reserve(1).is_err() {
        s.failed = true;
        return;
    }
    s.stalled
        .push(if swap { [r[2], r[3], r[0], r[1]] } else { r });
}
fn shallow(s: &Search, swap: bool, a: f64, b: f64) -> bool {
    if (a <= TOUCH || a >= 1.0 - TOUCH) && (b <= TOUCH || b >= 1.0 - TOUCH) {
        return false;
    }
    let d1 = derivative(&s.a, if swap { b } else { a });
    let d2 = derivative(&s.b, if swap { a } else { b });
    let (l1, l2) = (norm(d1[0], d1[1]), norm(d2[0], d2[1]));
    if !(l1 > FOOT_SPEED * s.size && l2 > FOOT_SPEED * s.size) {
        return true;
    }
    (d1[0] * d2[1] - d1[1] * d2[0]).abs() < 1e-3 * l1 * l2
}
fn coincident_twin(
    s: &Search,
    swap: bool,
    c: &Cubic,
    lo: f64,
    hi: f64,
    tol: f64,
) -> Option<[f64; 2]> {
    let other = if swap { &s.a } else { &s.b };
    if coincide(c, &sub(other, lo, hi), tol) {
        return Some([lo, hi]);
    }
    if coincide(c, &reverse(&sub(other, 1.0 - hi, 1.0 - lo)), tol) {
        Some([1.0 - hi, 1.0 - lo])
    } else {
        None
    }
}
fn overrun(a: &Cubic, b: &Cubic, r: [f64; 4], tol: f64, depth: usize, s: &mut Search, swap: bool) {
    if s.failed {
        return;
    }
    if s.nodes >= s.limits.overrun {
        s.over = true;
        return;
    }
    s.nodes += 1;
    if s.out.len() > MAX_HITS {
        return;
    }
    if !overlap(hull(a), hull(b), tol + 16.0 * s.pad) {
        return;
    }
    if depth > 60 {
        stall(s, swap, r);
        return;
    }
    let res = tol.max(s.pad);
    let s1 = norm(a[6] - a[0], a[7] - a[1]) + flat(a);
    let s2 = norm(b[6] - b[0], b[7] - b[1]) + flat(b);
    if s1 <= res && s2 <= res {
        let (m1, m2) = ((r[0] + r[1]) / 2.0, (r[2] + r[3]) / 2.0);
        let (p, q) = (eval(a, 0.5), eval(b, 0.5));
        let apart = norm(p[0] - q[0], p[1] - q[1]);
        if apart > res {
            if apart <= 1000.0 * tol {
                stall(s, swap, r);
            }
            return;
        }
        if shallow(s, swap, m1, m2) {
            stall(s, swap, r);
        } else {
            emit(&mut s.out, swap, m1, m2, p[0], p[1]);
        }
        return;
    }
    let f = fat(b);
    if f.is_none() && s2 <= res {
        let p = eval(b, 0.5);
        let n = nearest(a, p[0], p[1]);
        if n.distance > tol + s2 {
            if n.distance <= 1000.0 * tol {
                stall(s, swap, r);
            }
            return;
        }
        let (m1, m2) = (r[0] + (r[1] - r[0]) * n.t, (r[2] + r[3]) / 2.0);
        if shallow(s, swap, m1, m2) {
            stall(s, swap, r);
        } else {
            emit(&mut s.out, swap, m1, m2, n.x, n.y);
        }
        return;
    }
    let Some([lo, hi]) = f.map_or(Some([0.0, 1.0]), |fat| clip(a, fat, s.pad, s.pad)) else {
        return;
    };
    if hi - lo > 0.8 {
        if s.twin != 0 && twin_node(s, swap, a, r, tol) {
            return;
        }
        if s1 > 16.0 * tol && s2 > 16.0 * tol {
            if let Some(twin) = coincident_twin(s, swap, a, r[0], r[1], tol) {
                stall(s, swap, [r[0], r[1], r[2].min(twin[0]), r[3].max(twin[1])]);
                return;
            }
        }
        if let Some(fat2) = f {
            if s1 > 16.0 * res
                && s2 > 16.0 * res
                && within(a, fat2, res)
                && flat(a) <= res
                && flat(b) <= res
                && fat(a).is_some_and(|fat1| within(b, fat1, res))
            {
                stall(s, swap, r);
                return;
            }
        }
        if s1 >= s2 {
            let [left, right] = split(a, 0.5);
            let mid = (r[0] + r[1]) / 2.0;
            overrun(&left, b, [r[0], mid, r[2], r[3]], tol, depth + 1, s, swap);
            overrun(&right, b, [mid, r[1], r[2], r[3]], tol, depth + 1, s, swap);
        } else {
            let [left, right] = split(b, 0.5);
            let mid = (r[2] + r[3]) / 2.0;
            overrun(a, &left, [r[0], r[1], r[2], mid], tol, depth + 1, s, swap);
            overrun(a, &right, [r[0], r[1], mid, r[3]], tol, depth + 1, s, swap);
        }
        return;
    }
    let piece = sub(a, lo, hi);
    overrun(
        b,
        &piece,
        [
            r[2],
            r[3],
            r[0] + (r[1] - r[0]) * lo,
            r[0] + (r[1] - r[0]) * hi,
        ],
        tol,
        depth + 1,
        s,
        !swap,
    );
}
fn may_lie(c: &Cubic, f: Option<Fat>, x: f64, y: f64, pad: f64) -> bool {
    let b = hull(c);
    if x < b[0] - pad || x > b[2] + pad || y < b[1] - pad || y > b[3] + pad {
        return false;
    }
    f.is_none_or(|f| {
        let d = f.nx * x + f.ny * y - f.c0;
        d >= f.lo - pad && d <= f.hi + pad
    })
}
fn shared_run(a: &Cubic, b: &Cubic, tol: f64) -> Option<Vec<Hit>> {
    let eps = tol.max(magnitude(a, b) * 64.0 * f64::EPSILON);
    let (mut on_b, mut on_a, mut shared) = ([None; 2], [None; 2], 0);
    for t in 0..2 {
        for u in 0..2 {
            if on_b[t].is_some() {
                continue;
            }
            if norm(a[6 * t] - b[6 * u], a[6 * t + 1] - b[6 * u + 1]) <= eps {
                on_b[t] = Some(u as f64);
                if on_a[u].is_none() {
                    on_a[u] = Some(t as f64);
                }
                shared += 1;
            }
        }
    }
    let (f1, f2) = (fat(a), fat(b));
    let try1 = [0, 1].map(|t| on_b[t].is_none() && may_lie(b, f2, a[6 * t], a[6 * t + 1], eps));
    let try2 = [0, 1].map(|u| on_a[u].is_none() && may_lie(a, f1, b[6 * u], b[6 * u + 1], eps));
    if shared + try1.iter().filter(|v| **v).count() + try2.iter().filter(|v| **v).count() < 2 {
        return None;
    }
    for t in 0..2 {
        if try1[t] {
            let n = nearest(b, a[6 * t], a[6 * t + 1]);
            if n.distance <= eps {
                on_b[t] = Some(n.t);
            }
        }
    }
    for u in 0..2 {
        if try2[u] {
            let n = nearest(a, b[6 * u], b[6 * u + 1]);
            if n.distance <= eps {
                on_a[u] = Some(n.t);
            }
        }
    }
    let (mut a0, mut a1, mut b0, mut b1, mut count) = (1.0_f64, 0.0_f64, 1.0_f64, 0.0_f64, 0);
    for (t, u) in on_b
        .iter()
        .enumerate()
        .filter_map(|(t, u)| u.map(|u| (t as f64, u)))
        .chain(
            on_a.iter()
                .enumerate()
                .filter_map(|(u, t)| t.map(|t| (t, u as f64))),
        )
    {
        a0 = a0.min(t);
        a1 = a1.max(t);
        b0 = b0.min(u);
        b1 = b1.max(u);
        count += 1;
    }
    if count < 2 || !(a1 - a0 > 1e-9 && b1 - b0 > 1e-9) {
        return None;
    }
    let (sa, sb) = (sub(a, a0, a1), sub(b, b0, b1));
    if reach(&sa) <= eps || reach(&sb) <= eps {
        return None;
    }
    for forward in [true, false] {
        if [0.0, 1.0 / 3.0, 2.0 / 3.0, 1.0].iter().all(|t| {
            let (p, q) = (
                eval(&sa, *t),
                eval(&sb, if forward { *t } else { 1.0 - *t }),
            );
            (p[0] - q[0]).abs() <= eps && (p[1] - q[1]).abs() <= eps
        }) {
            let (p, q) = (eval(a, a0), eval(a, a1));
            return Some(vec![
                Hit::new(a0, if forward { b0 } else { b1 }, p[0], p[1]),
                Hit::new(a1, if forward { b1 } else { b0 }, q[0], q[1]),
            ]);
        }
    }
    None
}
fn binom(n: usize, k: usize) -> f64 {
    const ROWS: [[f64; 11]; 11] = [
        [1., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.],
        [1., 1., 0., 0., 0., 0., 0., 0., 0., 0., 0.],
        [1., 2., 1., 0., 0., 0., 0., 0., 0., 0., 0.],
        [1., 3., 3., 1., 0., 0., 0., 0., 0., 0., 0.],
        [1., 4., 6., 4., 1., 0., 0., 0., 0., 0., 0.],
        [1., 5., 10., 10., 5., 1., 0., 0., 0., 0., 0.],
        [1., 6., 15., 20., 15., 6., 1., 0., 0., 0., 0.],
        [1., 7., 21., 35., 35., 21., 7., 1., 0., 0., 0.],
        [1., 8., 28., 56., 70., 56., 28., 8., 1., 0., 0.],
        [1., 9., 36., 84., 126., 126., 84., 36., 9., 1., 0.],
        [1., 10., 45., 120., 210., 252., 210., 120., 45., 10., 1.],
    ];
    ROWS[n][k]
}
fn bern_mul(p: &[f64], q: &[f64]) -> [f64; 11] {
    let (m, n) = (p.len() - 1, q.len() - 1);
    let mut out = [0.0; 11];
    for i in 0..=m {
        for j in 0..=n {
            out[i + j] += ((binom(m, i) * binom(n, j)) / binom(m + n, i + j)) * p[i] * q[j];
        }
    }
    out
}
fn bern_runs(c: [f64; 11], t0: f64, t1: f64, depth: usize, out: &mut Vec<f64>) -> Result<(), ()> {
    let (mut lo, mut hi) = (f64::INFINITY, f64::NEG_INFINITY);
    for v in c {
        if v < lo {
            lo = v;
        }
        if v > hi {
            hi = v;
        }
    }
    if lo > 0.0 {
        return Ok(());
    }
    if hi <= 0.0 || depth >= 12 {
        if out.last() == Some(&t0) {
            *out.last_mut().unwrap() = t1;
        } else {
            out.try_reserve(2).map_err(|_| ())?;
            out.extend([t0, t1]);
        }
        return Ok(());
    }
    let (mut left, mut right, mut w) = ([0.0; 11], [0.0; 11], c);
    left[0] = w[0];
    right[10] = w[10];
    for k in 1..11 {
        for i in 0..11 - k {
            w[i] = (w[i] + w[i + 1]) * 0.5;
        }
        left[k] = w[0];
        right[10 - k] = w[10 - k];
    }
    let mid = (t0 + t1) / 2.0;
    bern_runs(left, t0, mid, depth + 1, out)?;
    bern_runs(right, mid, t1, depth + 1, out)
}
fn twin_node(s: &mut Search, swap: bool, c: &Cubic, r: [f64; 4], tol: f64) -> bool {
    let w = if swap {
        if s.twin == 1 {
            s.a
        } else {
            s.ar
        }
    } else if s.twin == 1 {
        s.b
    } else {
        s.br
    };
    let (mlo, mhi) = if s.twin == 1 {
        (r[2], r[3])
    } else {
        (1.0 - r[3], 1.0 - r[2])
    };
    let (lo, hi) = (r[0].min(mlo), r[1].max(mhi));
    let half = (hi - lo) * 0.5;
    let (r0, r1) = (0.0_f64.max(lo - half), 1.0_f64.min(hi + half));
    if !(r1 > r0) {
        return false;
    }
    let q = sub(&w, r0, r1);
    let k = 3.0 / (r1 - r0);
    let d = [
        [(q[2] - q[0]) * k, (q[3] - q[1]) * k],
        [(q[4] - q[2]) * k, (q[5] - q[3]) * k],
        [(q[6] - q[4]) * k, (q[7] - q[5]) * k],
    ];
    let (mut ux, mut uy) = (d[0][0] + d[1][0] + d[2][0], d[0][1] + d[1][1] + d[2][1]);
    let ul = norm(ux, uy);
    if !(ul > 0.0) {
        return false;
    }
    ux /= ul;
    uy /= ul;
    let mut vlo = f64::INFINITY;
    for [dx, dy] in d {
        let along = dx * ux + dy * uy;
        if !(along >= 0.5 * norm(dx, dy)) || along < FOOT_SPEED * s.size {
            return false;
        }
        if along < vlo {
            vlo = along;
        }
    }
    let kappa = 2.0
        * norm(d[1][0] - d[0][0], d[1][1] - d[0][1])
            .max(norm(d[2][0] - d[1][0], d[2][1] - d[1][1]))
        / ((r1 - r0) * vlo * vlo);
    let m = sub(&w, r[0], r[1]);
    let dx = [c[0] - m[0], c[2] - m[2], c[4] - m[4], c[6] - m[6]];
    let dy = [c[1] - m[1], c[3] - m[3], c[5] - m[5], c[7] - m[7]];
    let mut t = 0.0_f64;
    for i in 0..4 {
        t = t.max(norm(dx[i], dy[i]));
    }
    let rho = tol + t;
    if kappa * rho * rho > 0.35 * tol {
        return false;
    }
    let ex = [
        3.0 * (m[2] - m[0]),
        3.0 * (m[4] - m[2]),
        3.0 * (m[6] - m[4]),
    ];
    let ey = [
        3.0 * (m[3] - m[1]),
        3.0 * (m[5] - m[3]),
        3.0 * (m[7] - m[5]),
    ];
    let pa = bern_mul(&ex, &dy);
    let pb = bern_mul(&ey, &dx);
    let mut p = [0.0; 6];
    for i in 0..6 {
        p[i] = pa[i] - pb[i];
    }
    let sa = bern_mul(&ex, &ex);
    let sb = bern_mul(&ey, &ey);
    let mut speeds = [0.0; 5];
    for i in 0..5 {
        speeds[i] = sa[i] + sb[i];
    }
    let speed = bern_mul(&speeds, &[1.0; 7]);
    let thr2 = (1.5 * tol) * (1.5 * tol);
    let pp = bern_mul(&p, &p);
    let mut poly = [0.0; 11];
    for i in 0..11 {
        poly[i] = pp[i] - thr2 * speed[i];
    }
    let mut runs = Vec::new();
    if bern_runs(poly, 0.0, 1.0, 0, &mut runs).is_err() {
        s.failed = true;
        return true;
    }
    let delta = rho / vlo;
    for pair in runs.chunks_exact(2) {
        let (a, b) = (
            r[0] + (r[1] - r[0]) * pair[0],
            r[0] + (r[1] - r[0]) * pair[1],
        );
        let (w0, w1) = (0.0_f64.max(a - delta), 1.0_f64.min(b + delta));
        stall(
            s,
            swap,
            if s.twin == 1 {
                [a, b, w0, w1]
            } else {
                [a, b, 1.0 - w1, 1.0 - w0]
            },
        );
    }
    true
}
fn chord(c: &Cubic, u: f64) -> f64 {
    let (dx, dy) = (c[6] - c[0], c[7] - c[1]);
    let l2 = dx * dx + dy * dy;
    if l2 < 1e-24 {
        return u;
    }
    let g = [
        0.0,
        ((c[2] - c[0]) * dx + (c[3] - c[1]) * dy) / l2,
        ((c[4] - c[0]) * dx + (c[5] - c[1]) * dy) / l2,
        1.0,
    ];
    if (g[1] - 1.0 / 3.0).abs() < 1e-12 && (g[2] - 2.0 / 3.0).abs() < 1e-12 {
        return u;
    }
    let roots = solve([
        -g[0] + 3.0 * g[1] - 3.0 * g[2] + g[3],
        3.0 * g[0] - 6.0 * g[1] + 3.0 * g[2],
        -3.0 * g[0] + 3.0 * g[1],
        g[0] - u,
    ]);
    if roots.count == 0 {
        return u;
    }
    let (mut best, mut err) = (roots.ts[0], f64::INFINITY);
    for t in roots.ts[..roots.count].iter().copied() {
        let mt = 1.0 - t;
        let v = mt * mt * mt * g[0]
            + 3.0 * mt * mt * t * g[1]
            + 3.0 * mt * t * t * g[2]
            + t * t * t * g[3];
        if (v - u).abs() < err {
            err = (v - u).abs();
            best = t;
        }
    }
    best
}
fn line_cubic(line: &Cubic, c: &Cubic, tol: f64, flipped: bool) -> Vec<Hit> {
    let (dx, dy) = (line[6] - line[0], line[7] - line[1]);
    let len = norm(dx, dy);
    let mut out = Vec::with_capacity(4);
    if len < 1e-12 {
        return out;
    }
    let (nx, ny) = (-dy / len, dx / len);
    let mut d = [0.0; 4];
    for i in 0..4 {
        d[i] = nx * (c[2 * i] - line[0]) + ny * (c[2 * i + 1] - line[1]);
    }
    let roots = solve([
        -d[0] + 3.0 * d[1] - 3.0 * d[2] + d[3],
        3.0 * d[0] - 6.0 * d[1] + 3.0 * d[2],
        -3.0 * d[0] + 3.0 * d[1],
        d[0],
    ]);
    for i in 0..roots.count {
        let t = roots.ts[i];
        let p = eval(c, t);
        let u = ((p[0] - line[0]) * dx + (p[1] - line[1]) * dy) / (len * len);
        if u < -tol / len || u > 1.0 + tol / len {
            continue;
        }
        let u = chord(line, 1.0_f64.min(0.0_f64.max(u)));
        let mut hit = if flipped {
            Hit::new(t, u, p[0], p[1])
        } else {
            Hit::new(u, t, p[0], p[1])
        };
        if !flipped {
            hit.dir = Some(roots.dirs[i]);
        }
        out.push(hit);
    }
    dedupe(out, tol)
}
pub fn intersect(a: Cubic, b: Cubic, tol: f64, limits: Limits) -> Result<ResultPair, ()> {
    let mut counts = Counts::default();
    if !overlap(bounds(&a), bounds(&b), tol) {
        return Ok(ResultPair {
            hits: Vec::new(),
            counts,
        });
    }
    let (l1, l2) = (flat(&a) <= tol, flat(&b) <= tol);
    if l1 && l2 {
        let (rx, ry, sx, sy) = (a[6] - a[0], a[7] - a[1], b[6] - b[0], b[7] - b[1]);
        let denom = rx * sy - ry * sx;
        let mut hits = Vec::with_capacity(1);
        if denom.abs() >= 1e-14 {
            let (qx, qy) = (b[0] - a[0], b[1] - a[1]);
            let (t, u) = ((qx * sy - qy * sx) / denom, (qx * ry - qy * rx) / denom);
            if t >= -1e-9 && t <= 1.0 + 1e-9 && u >= -1e-9 && u <= 1.0 + 1e-9 {
                let (tc, uc) = (1.0_f64.min(0.0_f64.max(t)), 1.0_f64.min(0.0_f64.max(u)));
                hits.push(Hit::new(
                    chord(&a, tc),
                    chord(&b, uc),
                    a[0] + rx * tc,
                    a[1] + ry * tc,
                ));
            }
        }
        return Ok(ResultPair { hits, counts });
    }
    if l1 || l2 {
        return Ok(ResultPair {
            hits: if l1 {
                line_cubic(&a, &b, tol, false)
            } else {
                line_cubic(&b, &a, tol, true)
            },
            counts,
        });
    }
    let mut out = Vec::with_capacity(MAX_HITS + 1);
    let mut work = Work {
        nodes: 0,
        limit: limits.initial,
        over: false,
    };
    initial(
        &a,
        &b,
        [0.0, 1.0, 0.0, 1.0],
        tol,
        0,
        &mut out,
        &mut work,
        false,
    );
    counts.reached = true;
    counts.nodes = work.nodes;
    if !work.over {
        return Ok(ResultPair {
            hits: dedupe(out, tol),
            counts,
        });
    }
    counts.overrun = true;
    if let Some(hits) = shared_run(&a, &b, tol) {
        return Ok(ResultPair { hits, counts });
    }
    let size = size(&a, &b);
    let ar = reverse(&a);
    let br = reverse(&b);
    let twin = if coincide(&a, &b, 1e-4 * size) {
        1
    } else if coincide(&a, &br, 1e-4 * size) {
        -1
    } else {
        0
    };
    let mut s = Search {
        a,
        b,
        out: Vec::with_capacity(MAX_HITS + 1),
        stalled: Vec::new(),
        pad: 1e-12_f64.max(magnitude(&a, &b) * 64.0 * f64::EPSILON),
        size,
        twin,
        ar,
        br,
        nodes: 0,
        over: false,
        limits,
        failed: false,
    };
    overrun(&a, &b, [0.0, 1.0, 0.0, 1.0], tol, 0, &mut s, false);
    if s.failed {
        return Err(());
    }
    counts.searched = true;
    counts.overrun_nodes = s.nodes;
    counts.ceiling = s.over;
    if !s.stalled.is_empty() {
        clip_scan::scan(&a, &b, &s.stalled, tol, &mut s.out)?;
    }
    Ok(ResultPair {
        hits: dedupe(s.out, tol),
        counts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    const LIMITS: Limits = Limits {
        initial: 16_384,
        overrun: 131_072,
        stalled: 65_536,
    };
    #[test]
    fn ordinary_pair_uses_initial_search() {
        let a = [0.0, 0.0, 55.23, 0.0, 100.0, 44.77, 100.0, 100.0];
        let b = [100.0, 0.0, 44.77, 0.0, 0.0, 44.77, 0.0, 100.0];
        let r = intersect(a, b, 1e-9, LIMITS).unwrap();
        assert_eq!(r.hits.len(), 1);
        assert!(r.counts.reached && !r.counts.overrun);
        assert!(r.counts.nodes > 0 && r.counts.nodes <= LIMITS.initial);
    }
    #[test]
    fn zero_budgets_preserve_handoff_and_ceiling() {
        let a = [0.0, 0.0, 55.23, 0.0, 100.0, 44.77, 100.0, 100.0];
        let b = [100.0, 0.0, 44.77, 0.0, 0.0, 44.77, 0.0, 100.0];
        let r = intersect(
            a,
            b,
            1e-9,
            Limits {
                initial: 0,
                overrun: 0,
                ..LIMITS
            },
        )
        .unwrap();
        assert!(r.hits.is_empty());
        assert!(r.counts.reached && r.counts.overrun && r.counts.searched && r.counts.ceiling);
        assert_eq!(r.counts.nodes, 1);
        assert_eq!(r.counts.overrun_nodes, 0);
    }
    #[test]
    fn shared_run_returns_before_overrun_search() {
        let a = [0.0, 0.0, 30.0, 30.0, 70.0, 30.0, 100.0, 0.0];
        let r = intersect(
            a,
            a,
            1e-9,
            Limits {
                initial: 0,
                ..LIMITS
            },
        )
        .unwrap();
        assert_eq!(r.hits.len(), 2);
        assert_eq!(r.hits[0].t1, 0.0);
        assert_eq!(r.hits[1].t1, 1.0);
        assert!(r.counts.overrun && !r.counts.searched);
        assert_eq!(r.counts.overrun_nodes, 0);
    }
}
