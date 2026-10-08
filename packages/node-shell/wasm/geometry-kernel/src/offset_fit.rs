// SPDX-License-Identifier: MPL-2.0
//! Complete offset pieces, retaining fitting, independent verification and source-end directions.
use crate::fit_candidates::{endpoint, fit_one, try_line};
use crate::fit_cubic::{bounds, derivative, is_line, line, second, split, sub};
use crate::nearest::{eval, Cubic};
use crate::offset_error::{norm, tangent, verify};
use crate::offset_features::{breaks, cuts, MIN_SPAN};
pub const MAX_PIECES: usize = 16_384;
pub const GL16: [[f64; 2]; 16] = [
    [0.1894506104550685, -0.0950125098376374],
    [0.1894506104550685, 0.0950125098376374],
    [0.1826034150449236, -0.2816035507792589],
    [0.1826034150449236, 0.2816035507792589],
    [0.1691565193950025, -0.4580167776572274],
    [0.1691565193950025, 0.4580167776572274],
    [0.1495959888165767, -0.6178762444026438],
    [0.1495959888165767, 0.6178762444026438],
    [0.1246289712555339, -0.7554044083550030],
    [0.1246289712555339, 0.7554044083550030],
    [0.0951585116824928, -0.8656312023878318],
    [0.0951585116824928, 0.8656312023878318],
    [0.0622535239386479, -0.9445750230732326],
    [0.0622535239386479, 0.9445750230732326],
    [0.0271524594117541, -0.9894009349916499],
    [0.0271524594117541, 0.9894009349916499],
];
#[derive(Clone, Copy, Default)]
pub struct Sample {
    pub x: f64,
    pub y: f64,
    pub tx: f64,
    pub ty: f64,
}
#[derive(Clone, Copy)]
pub struct Source {
    pub c: Cubic,
    pub distance: f64,
}
impl Source {
    pub fn sample(self, t: f64) -> Sample {
        let p = eval(&self.c, t);
        let d1 = derivative(&self.c, t);
        let s = norm(d1[0], d1[1]);
        if s > 1e-12 {
            let d2 = second(&self.c, t);
            let k = 1.0 - (self.distance * (d1[0] * d2[1] - d1[1] * d2[0])) / (s * s * s);
            return Sample {
                x: p[0] - (self.distance * d1[1]) / s,
                y: p[1] + (self.distance * d1[0]) / s,
                tx: k * d1[0],
                ty: k * d1[1],
            };
        }
        if let Some(tan) = tangent(&self.c, t) {
            Sample {
                x: p[0] - self.distance * tan[1],
                y: p[1] + self.distance * tan[0],
                ..Sample::default()
            }
        } else {
            Sample {
                x: p[0],
                y: p[1],
                ..Sample::default()
            }
        }
    }
    pub fn moments(self, t0: f64, t1: f64) -> [f64; 2] {
        let (mid, half) = (0.5 * (t0 + t1), 0.5 * (t1 - t0));
        let (mut area, mut x, mut y) = (0.0, 0.0, 0.0);
        for [w, xi] in GL16 {
            let s = self.sample(mid + xi * half);
            let wa = w * s.tx * s.y;
            area += wa;
            x += s.x * wa;
            y += s.y * wa;
        }
        area *= half;
        x *= half;
        y *= half;
        let (s0, s1) = (self.sample(t0), self.sample(t1));
        let (x0, y0, dx, dy) = (s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
        area -= dx * (y0 + 0.5 * dy);
        let dy3 = dy / 3.0;
        x -= dx * (x0 * y0 + 0.5 * (x0 * dy + y0 * dx) + dy3 * dx);
        y -= dx * (y0 * y0 + y0 * dy + dy3 * dy);
        x -= x0 * area;
        y = 0.5 * y - y0 * area;
        let chord = norm(dx, dy);
        [
            area,
            if chord > 0.0 {
                (dx * x + dy * y) / chord
            } else {
                0.0
            },
        ]
    }
}
pub struct Piece {
    pub curve: Cubic,
    pub start: Option<[f64; 2]>,
    pub end: Option<[f64; 2]>,
}
fn adaptive(src: Source, t0: f64, t1: f64, tol: f64, out: &mut Vec<Cubic>) {
    let mut pending = Vec::with_capacity(32);
    pending.push((t0, t1, 0));
    while let Some((a, z, depth)) = pending.pop() {
        let span = (z - a).abs();
        let start = endpoint(src, a, 1.0, span);
        let end = endpoint(src, z, -1.0, span);
        let (dx, dy) = (end.x - start.x, end.y - start.y);
        if dx * dx + dy * dy <= tol * tol {
            if let Some(c) = try_line(src, a, z, tol, start, end) {
                out.push(c);
                continue;
            }
        }
        if let Some(c) = fit_one(src, a, z, tol) {
            out.push(c);
            continue;
        }
        let mid = 0.5 * (a + z);
        if depth >= 20 || out.len() + pending.len() + 2 > 32 || !(mid > a && mid < z) {
            out.push(line(start.x, start.y, end.x, end.y));
            continue;
        }
        pending.push((mid, z, depth + 1));
        pending.push((a, mid, depth + 1));
    }
}
fn fit(src: Source, tol: f64) -> Result<Vec<Cubic>, ()> {
    let mut endpoints = vec![0.0];
    endpoints.extend(breaks(&src.c, src.distance)?);
    endpoints.push(1.0);
    let mut out = Vec::with_capacity(32);
    for range in endpoints.windows(2) {
        if out.len() >= 32 {
            break;
        }
        if range[1] > range[0] {
            adaptive(src, range[0], range[1], tol, &mut out);
        }
    }
    Ok(out)
}
fn push_run(src: &Cubic, fitted: &[Cubic], out: &mut Vec<Piece>) -> Result<(), ()> {
    if out.len() + fitted.len() > MAX_PIECES {
        return Err(());
    }
    out.try_reserve(fitted.len()).map_err(|_| ())?;
    for (i, &curve) in fitted.iter().enumerate() {
        out.push(Piece {
            curve,
            start: if i == 0 { tangent(src, 0.0) } else { None },
            end: if i == fitted.len() - 1 {
                tangent(src, 1.0)
            } else {
                None
            },
        });
    }
    Ok(())
}
fn independent(src: Cubic, fit: &[Cubic], d: f64, tol: f64) -> [f64; 2] {
    let boxes: Vec<_> = fit.iter().map(bounds).collect();
    verify(src, fit, &boxes, d, tol)
}
fn span(src: Cubic, d: f64, tol: f64, depth: usize, out: &mut Vec<Piece>) -> Result<(), ()> {
    if tangent(&src, 0.0).is_none() || tangent(&src, 1.0).is_none() {
        return Ok(());
    }
    if is_line(&src) {
        let (dx, dy) = (src[6] - src[0], src[7] - src[1]);
        let len = norm(dx, dy);
        if len > 1e-12 {
            let (nx, ny) = ((-d * dy) / len, (d * dx) / len);
            let c = [
                src[0] + nx,
                src[1] + ny,
                src[2] + nx,
                src[3] + ny,
                src[4] + nx,
                src[5] + ny,
                src[6] + nx,
                src[7] + ny,
            ];
            if independent(src, &[c], d, tol)[0] <= tol {
                return push_run(&src, &[c], out);
            }
        }
    }
    let fitted = fit(
        Source {
            c: src,
            distance: d,
        },
        tol,
    )?;
    if fitted.is_empty() {
        return Ok(());
    }
    // Preserve the existing depth-eight delivery rule, including its verification bypass.
    if depth >= 8 {
        return push_run(&src, &fitted, out);
    }
    let worst = independent(src, &fitted, d, tol);
    if worst[0] <= tol {
        return push_run(&src, &fitted, out);
    }
    let t = if worst[1] > MIN_SPAN && worst[1] < 1.0 - MIN_SPAN {
        worst[1]
    } else {
        0.5
    };
    let [a, b] = split(&src, t);
    span(a, d, tol, depth + 1, out)?;
    span(b, d, tol, depth + 1, out)
}
pub fn pieces(c: Cubic, distance: f64, tol: f64) -> Result<Vec<Piece>, ()> {
    let mut out = Vec::new();
    if distance.abs() < 1e-12 {
        push_run(&c, &[c], &mut out)?;
        return Ok(out);
    }
    let mut endpoints = vec![0.0];
    endpoints.extend(cuts(&c)?);
    endpoints.push(1.0);
    for range in endpoints.windows(2) {
        span(
            sub(&c, range[0], range[1]),
            distance,
            tol.max(1e-9),
            0,
            &mut out,
        )?;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn output_cap_refuses_without_truncating_a_run() {
        let src = [0.0, 0.0, 10.0, 0.0, 20.0, 0.0, 30.0, 0.0];
        let mut out = Vec::new();
        push_run(&src, &vec![src; MAX_PIECES], &mut out).unwrap();
        assert!(push_run(&src, &[src], &mut out).is_err());
        assert_eq!(out.len(), MAX_PIECES);
    }
    #[test]
    fn straight_and_missing_normal() {
        let c = [0.0, 0.0, 10.0, 0.0, 20.0, 0.0, 30.0, 0.0];
        let out = pieces(c, 6.0, 0.01).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].curve, [0.0, 6.0, 10.0, 6.0, 20.0, 6.0, 30.0, 6.0]);
        assert_eq!(out[0].start, Some([1.0, 0.0]));
        assert!(pieces([1.0; 8], 6.0, 0.01).unwrap().is_empty());
        let smooth = pieces(
            [0.0, 0.0, 60.0, 200.0, 200.0, -80.0, 260.0, 60.0],
            20.0,
            0.001,
        )
        .unwrap();
        assert!(!smooth.is_empty() && smooth.len() < 32);
    }
}
