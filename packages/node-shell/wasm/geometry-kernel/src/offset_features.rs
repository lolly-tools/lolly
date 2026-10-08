// SPDX-License-Identifier: MPL-2.0
//! Source feature clustering and degree-12 offset cusp isolation, preserving parameter order.
use crate::fit_cubic::is_line;
use crate::nearest::Cubic;
use crate::offset_error::norm;
use crate::roots::solve;
pub const MIN_SPAN: f64 = 1e-4;

fn polynomials(c: &Cubic) -> ([f64; 3], [f64; 5]) {
    let px2 = 3.0 * (-c[0] + 3.0 * c[2] - 3.0 * c[4] + c[6]);
    let px1 = 2.0 * (3.0 * c[0] - 6.0 * c[2] + 3.0 * c[4]);
    let px0 = -3.0 * c[0] + 3.0 * c[2];
    let py2 = 3.0 * (-c[1] + 3.0 * c[3] - 3.0 * c[5] + c[7]);
    let py1 = 2.0 * (3.0 * c[1] - 6.0 * c[3] + 3.0 * c[5]);
    let py0 = -3.0 * c[1] + 3.0 * c[3];
    (
        [
            px0 * py1 - px1 * py0,
            2.0 * (px0 * py2 - px2 * py0),
            px1 * py2 - px2 * py1,
        ],
        [
            px0 * px0 + py0 * py0,
            2.0 * (px1 * px0 + py1 * py0),
            px1 * px1 + 2.0 * px2 * px0 + py1 * py1 + 2.0 * py2 * py0,
            2.0 * (px2 * px1 + py2 * py1),
            px2 * px2 + py2 * py2,
        ],
    )
}
fn mul(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut out = vec![0.0; a.len() + b.len() - 1];
    for (i, x) in a.iter().enumerate() {
        for (j, y) in b.iter().enumerate() {
            out[i + j] += x * y;
        }
    }
    out
}
fn scale(a: &[f64], k: f64) -> Vec<f64> {
    a.iter().map(|v| v * k).collect()
}
fn sub(a: &[f64], b: &[f64]) -> Vec<f64> {
    (0..a.len().max(b.len()))
        .map(|i| a.get(i).unwrap_or(&0.0) - b.get(i).unwrap_or(&0.0))
        .collect()
}
fn isolate(
    b: &[f64],
    t0: f64,
    t1: f64,
    depth: usize,
    out: &mut Vec<f64>,
    budget: &mut usize,
) -> Result<(), ()> {
    // A raw-operation work ceiling refuses the whole result, without truncating the search.
    if *budget == 0 {
        return Err(());
    }
    *budget -= 1;
    let (mut changes, mut prev) = (0, 0);
    for &v in b {
        if v == 0.0 {
            continue;
        }
        let s = if v > 0.0 { 1 } else { -1 };
        if prev != 0 && s != prev {
            changes += 1;
        }
        prev = s;
    }
    if changes == 0 {
        return Ok(());
    }
    if depth >= 40 || (changes == 1 && t1 - t0 < 1e-7) {
        if out.len() == 256 {
            return Err(());
        }
        out.push((t0 + t1) / 2.0);
        return Ok(());
    }
    let mut rows = [[0.0; 13]; 13];
    rows[0][..b.len()].copy_from_slice(b);
    for level in 1..b.len() {
        for i in 0..b.len() - level {
            rows[level][i] = (rows[level - 1][i] + rows[level - 1][i + 1]) / 2.0;
        }
    }
    let (mut lo, mut hi) = ([0.0; 13], [0.0; 13]);
    for level in 0..b.len() {
        lo[level] = rows[level][0];
        hi[b.len() - 1 - level] = rows[level][b.len() - 1 - level];
    }
    let mid = (t0 + t1) / 2.0;
    isolate(&lo[..b.len()], t0, mid, depth + 1, out, budget)?;
    isolate(&hi[..b.len()], mid, t1, depth + 1, out, budget)
}
fn roots(poly: &[f64]) -> Result<Vec<f64>, ()> {
    let mut largest: f64 = 0.0;
    for v in poly {
        largest = largest.max(v.abs());
    }
    if !(largest > 0.0) || !largest.is_finite() {
        return Ok(Vec::new());
    }
    let a: Vec<_> = poly.iter().map(|v| v / largest).collect();
    let mut degree = a.len() - 1;
    while degree > 0 && a[degree].abs() < 1e-12 {
        degree -= 1;
    }
    if degree == 0 {
        return Ok(Vec::new());
    }
    let mut rows = [[0.0; 13]; 13];
    for i in 0..=degree {
        rows[i][0] = 1.0;
        for k in 1..=i {
            rows[i][k] = (rows[i][k - 1] * (i - k + 1) as f64) / k as f64;
        }
    }
    let mut b = [0.0; 13];
    for k in 0..=degree {
        for i in 0..=k {
            b[k] += (rows[k][i] / rows[degree][i]) * a[i];
        }
    }
    let mut out = Vec::with_capacity(16);
    isolate(&b[..degree + 1], 0.0, 1.0, 0, &mut out, &mut 4096)?;
    Ok(out)
}
pub fn cuts(c: &Cubic) -> Result<Vec<f64>, ()> {
    if is_line(c) {
        return Ok(Vec::new());
    }
    let (a, d) = polynomials(c);
    let mut features: Vec<(f64, bool)> = Vec::with_capacity(16);
    let r = solve([0.0, a[2], a[1], a[0]]);
    for &t in &r.ts[..r.count] {
        features.push((t, true));
    }
    let ext = sub(
        &scale(&mul(&[a[1], 2.0 * a[2]], &d), 2.0),
        &scale(&mul(&a, &[d[1], 2.0 * d[2], 3.0 * d[3], 4.0 * d[4]]), 3.0),
    );
    for t in roots(&ext)? {
        features.push((t, false));
    }
    let speed_scale = 3.0
        * norm(c[2] - c[0], c[3] - c[1])
            .max(norm(c[4] - c[2], c[5] - c[3]))
            .max(norm(c[6] - c[4], c[7] - c[5]))
            .max(1e-12);
    let r = solve([4.0 * d[4], 3.0 * d[3], 2.0 * d[2], d[1]]);
    for &t in &r.ts[..r.count] {
        let speed = ((((d[4] * t + d[3]) * t + d[2]) * t + d[1]) * t + d[0])
            .max(0.0)
            .sqrt();
        if speed < 1e-6 * speed_scale {
            features.push((t, true));
        }
    }
    features.retain(|(t, _)| *t > MIN_SPAN && *t < 1.0 - MIN_SPAN);
    features.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    let (mut out, mut i) = (Vec::with_capacity(16), 0);
    while i < features.len() {
        let mut j = i;
        while j + 1 < features.len() && features[j + 1].0 - features[i].0 <= MIN_SPAN {
            j += 1;
        }
        let at = features[i..=j]
            .iter()
            .find(|f| f.1)
            .unwrap_or(&features[i])
            .0;
        if out.is_empty() || at - out[out.len() - 1] > MIN_SPAN / 2.0 {
            out.push(at);
        }
        i = j + 1;
    }
    Ok(out)
}
pub fn breaks(c: &Cubic, distance: f64) -> Result<Vec<f64>, ()> {
    let mut out = cuts(c)?;
    let (a, d) = polynomials(c);
    let poly = sub(
        &mul(&mul(&d, &d), &d),
        &scale(&mul(&a, &a), distance * distance),
    );
    for t in roots(&poly)? {
        if !(t > MIN_SPAN) || !(t < 1.0 - MIN_SPAN) {
            continue;
        }
        let speed2 = (((d[4] * t + d[3]) * t + d[2]) * t + d[1]) * t + d[0];
        if !(speed2 > 0.0) {
            continue;
        }
        let num = (a[2] * t + a[1]) * t + a[0];
        if (1.0 - (distance * num) / (speed2 * speed2.sqrt())).abs() < 0.5 {
            out.push(t);
        }
    }
    out.sort_by(|a, b| a.partial_cmp(b).unwrap());
    out.truncate(256);
    out.retain(|t| t.is_finite() && *t > 1e-9 && *t < 1.0 - 1e-9);
    let mut clean = Vec::with_capacity(out.len());
    for t in out {
        if clean.is_empty() || t - clean[clean.len() - 1] >= 1e-9 {
            clean.push(t);
        }
    }
    Ok(clean)
}
