// SPDX-License-Identifier: MPL-2.0
//! Whole stalled-zone scan, preserving gap budgets, orientation and contact refinement.
use crate::clip_common::*;

#[derive(Clone, Copy)]
struct Gap {
    t: f64,
    u: f64,
    g: f64,
    d: f64,
    sp: f64,
    nx: f64,
    ny: f64,
    o: f64,
    px: f64,
    py: f64,
    qx: f64,
    qy: f64,
}
struct Scan<'a> {
    a: &'a Cubic,
    b: &'a Cubic,
    tol: f64,
    out: &'a mut Vec<Hit>,
    noise: f64,
    budget: i32,
    size: f64,
    share: usize,
}
struct Zone {
    samples: Vec<Gap>,
    a0: f64,
    a1: f64,
    b0: f64,
    b1: f64,
    reach: f64,
}
impl Zone {
    fn empty() -> Self {
        Self {
            samples: Vec::new(),
            a0: 0.0,
            a1: 0.0,
            b0: 0.0,
            b1: 0.0,
            reach: 0.0,
        }
    }
}
fn capacity<T>(n: usize) -> Result<Vec<T>, ()> {
    let mut v = Vec::new();
    v.try_reserve_exact(n).map_err(|_| ())?;
    Ok(v)
}
fn push<T>(v: &mut Vec<T>, x: T) -> Result<(), ()> {
    v.try_reserve(1).map_err(|_| ())?;
    v.push(x);
    Ok(())
}
fn append<T>(a: &mut Vec<T>, b: &mut Vec<T>) -> Result<(), ()> {
    a.try_reserve_exact(b.len()).map_err(|_| ())?;
    a.append(b);
    Ok(())
}
fn copy<T: Copy>(a: &[T]) -> Result<Vec<T>, ()> {
    let mut v = capacity(a.len())?;
    v.extend_from_slice(a);
    Ok(v)
}
// Index sorting retains equal-key order and reserves scratch explicitly, including for owned zones.
fn sort<T>(v: &mut [T], key: impl Fn(&T) -> f64) -> Result<(), ()> {
    let mut order = capacity(v.len())?;
    order.extend(0..v.len());
    order.sort_unstable_by(|i, j| {
        key(&v[*i])
            .partial_cmp(&key(&v[*j]))
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| i.cmp(j))
    });
    let mut target = capacity(v.len())?;
    target.resize(v.len(), 0);
    for (to, from) in order.into_iter().enumerate() {
        target[from] = to;
    }
    for i in 0..v.len() {
        while target[i] != i {
            let j = target[i];
            v.swap(i, j);
            target.swap(i, j);
        }
    }
    Ok(())
}
fn root(p: &mut [usize], mut i: usize) -> usize {
    while p[i] != i {
        p[i] = p[p[i]];
        i = p[i];
    }
    i
}
fn stretches(r: &[[f64; 4]]) -> Result<(Vec<usize>, Vec<usize>), ()> {
    let n = r.len();
    let mut parent = capacity(n)?;
    parent.extend(0..n);
    let mut order = copy(&parent)?;
    order.sort_unstable_by(|i, j| {
        r[*i][0]
            .partial_cmp(&r[*j][0])
            .unwrap()
            .then_with(|| i.cmp(j))
    });
    for k in 0..n {
        let i = order[k];
        let reach = TOUCH + 64.0 * (r[i][1] - r[i][0]).min(r[i][3] - r[i][2]);
        for &j in &order[k + 1..] {
            if r[j][0] > r[i][1] + reach {
                break;
            }
            if r[j][2] <= r[i][3] + reach && r[i][2] <= r[j][3] + reach {
                let ri = root(&mut parent, i);
                let rj = root(&mut parent, j);
                parent[ri] = rj;
            }
        }
    }
    let mut index = capacity(n)?;
    index.resize(n, usize::MAX);
    let mut counts = capacity(n)?;
    for &i in &order {
        let g = root(&mut parent, i);
        if index[g] == usize::MAX {
            index[g] = counts.len();
            counts.push(0usize);
        }
        counts[index[g]] += 1;
    }
    let mut ranges = capacity(counts.len() + 1)?;
    let mut start = 0;
    for c in &mut counts {
        ranges.push(start);
        let size = *c;
        *c = start;
        start += size;
    }
    ranges.push(start);
    let mut members = capacity(n)?;
    members.resize(n, 0);
    for i in order {
        let g = index[root(&mut parent, i)];
        members[counts[g]] = i;
        counts[g] += 1;
    }
    Ok((members, ranges))
}
fn end_direction(c: &Cubic, end: usize) -> [f64; 2] {
    if end == 0 {
        for i in [2, 4, 6] {
            let d = [c[i] - c[0], c[i + 1] - c[1]];
            if d[0] != 0.0 || d[1] != 0.0 {
                return d;
            }
        }
    } else {
        for i in [4, 2, 0] {
            let d = [c[6] - c[i], c[7] - c[i + 1]];
            if d[0] != 0.0 || d[1] != 0.0 {
                return d;
            }
        }
    }
    [0.0, 0.0]
}
fn gap(s: &mut Scan, t: f64) -> Option<Gap> {
    let budget = s.budget;
    s.budget -= 1;
    if budget <= 0 {
        return None;
    }
    let p = eval(s.a, t);
    let n = polished(s.b, p[0], p[1]);
    let mut d = if n.t <= 0.0 || n.t >= 1.0 {
        end_direction(s.b, if n.t <= 0.0 { 0 } else { 1 })
    } else {
        derivative(s.b, n.t)
    };
    if d[0] == 0.0 && d[1] == 0.0 {
        d = [s.b[6] - s.b[0], s.b[7] - s.b[1]];
    }
    let len = norm(d[0], d[1]);
    if !(len > 0.0) {
        return None;
    }
    Some(Gap {
        t,
        u: n.t,
        g: (d[0] * (p[1] - n.y) - d[1] * (p[0] - n.x)) / len,
        d: n.distance,
        sp: len / s.size,
        nx: -d[1] / len,
        ny: d[0] / len,
        o: 1.0,
        px: p[0],
        py: p[1],
        qx: n.x,
        qy: n.y,
    })
}
fn side(g: Gap) -> f64 {
    g.o * g.g
}
fn readable(s: &Scan, g: Gap) -> bool {
    g.g.abs() > s.noise && g.g.abs() >= 0.5 * g.d && g.sp >= FOOT_SPEED
}
fn orient(mut g: Gap, reference: Gap) -> Gap {
    g.o = if g.nx * (reference.o * reference.nx) + g.ny * (reference.o * reference.ny) < 0.0 {
        -1.0
    } else {
        1.0
    };
    g
}
fn orient_zone(s: &Scan, samples: &mut [Gap]) {
    let (mut px, mut py, mut o, mut have) = (0.0, 0.0, 1.0, false);
    for g in samples {
        if !readable(s, *g) {
            g.o = o;
            continue;
        }
        if !have {
            g.o = 1.0;
            px = g.nx;
            py = g.ny;
            o = 1.0;
            have = true;
            continue;
        }
        o = if g.nx * px + g.ny * py < 0.0 {
            -1.0
        } else {
            1.0
        };
        g.o = o;
        px = o * g.nx;
        py = o * g.ny;
    }
}
fn sample(s: &mut Scan, r: &[[f64; 4]], members: &[usize]) -> Result<Zone, ()> {
    let (mut a0, mut a1, mut b0, mut b1) = (1.0_f64, 0.0_f64, 1.0_f64, 0.0_f64);
    let mut bounds = capacity(2 * members.len())?;
    for &i in members {
        a0 = a0.min(r[i][0]);
        a1 = a1.max(r[i][1]);
        b0 = b0.min(r[i][2]);
        b1 = b1.max(r[i][3]);
        bounds.extend([r[i][0], r[i][1]]);
    }
    sort(&mut bounds, |v| *v)?;
    let cap = 2048.min(s.share);
    let step = (bounds.len() as f64 / cap as f64).ceil() as usize;
    let mut knots = capacity(cap + 1)?;
    for k in (0..bounds.len()).step_by(step) {
        knots.push(bounds[k]);
    }
    if knots.last() != bounds.last() {
        knots.push(*bounds.last().unwrap());
    }
    let per = 1.max(8.min(cap / knots.len()));
    let mut ts = capacity(1 + per * knots.len())?;
    ts.push(knots[0]);
    let mut prev = knots[0];
    for k in knots {
        if !(k > prev) {
            continue;
        }
        for j in 1..=per {
            ts.push(if j == per {
                k
            } else {
                prev + ((k - prev) * j as f64) / per as f64
            });
        }
        prev = k;
    }
    let mut samples = Vec::new();
    for t in ts {
        if let Some(g) = gap(s, t) {
            push(&mut samples, g)?;
        }
    }
    Ok(Zone {
        samples,
        a0,
        a1,
        b0,
        b1,
        reach: a1,
    })
}
fn sentinel(s: &mut Scan, from: f64, dir: f64) -> Option<Gap> {
    let clear = s.tol.max(s.noise);
    let mut last = None;
    for k in 0..=30 {
        let t =
            1.0_f64.min(0.0_f64.max(from + dir * 4.0 * f64::EPSILON * (1u64 << (2 * k)) as f64));
        let Some(g) = gap(s, t) else {
            return last;
        };
        last = Some(g);
        if g.g.abs() > clear || t == 0.0 || t == 1.0 {
            return Some(g);
        }
    }
    last
}
fn report(s: &mut Scan, g: Gap) {
    if s.out.len() > MAX_HITS
        || s.out
            .iter()
            .any(|h| (h.t1 - g.t).abs() <= 1e-6 && (h.t2 - g.u).abs() <= 1e-6)
    {
        return;
    }
    s.out.push(Hit::new(g.t, g.u, g.px, g.py));
}
fn one_touch(s: &mut Scan, a: Gap, b: Gap) -> bool {
    for k in 1..=7 {
        let Some(g) = gap(s, a.t + ((b.t - a.t) * k as f64) / 8.0) else {
            return true;
        };
        if g.g.abs() > s.tol {
            return false;
        }
        let g = orient(g, a);
        if readable(s, g) && readable(s, a) && (side(g) < 0.0) != (side(a) < 0.0) {
            return false;
        }
    }
    true
}
fn subzone(g: &Zone, samples: &[Gap], first: bool, last: bool) -> Result<Zone, ()> {
    let (mut b0, mut b1) = (1.0_f64, 0.0_f64);
    for s in samples {
        b0 = b0.min(s.u);
        b1 = b1.max(s.u);
    }
    Ok(Zone {
        samples: copy(samples)?,
        a0: if first { g.a0 } else { samples[0].t },
        a1: if last {
            g.a1
        } else {
            samples.last().unwrap().t
        },
        b0: if first { g.b0.min(b0) } else { b0 },
        b1: if last { g.b1.max(b1) } else { b1 },
        reach: if last {
            g.reach
        } else {
            samples.last().unwrap().t
        },
    })
}
fn split_zone(s: &Scan, g: Zone) -> Result<Vec<Zone>, ()> {
    if g.samples.len() < 3 {
        let mut v = capacity(1)?;
        v.push(g);
        return Ok(v);
    }
    let clear = s.tol.max(s.noise);
    let mut parts = Vec::new();
    let mut start = 0;
    for i in 1..g.samples.len() - 1 {
        let p = g.samples[i];
        if !(p.g.abs() > clear && readable(s, p)) {
            continue;
        }
        let back = (start + 1..i).rev().any(|k| g.samples[k].g.abs() <= clear);
        let ahead = (i + 1..g.samples.len() - 1).any(|k| g.samples[k].g.abs() <= clear);
        if !back || !ahead {
            continue;
        }
        let part = subzone(&g, &g.samples[start..=i], parts.is_empty(), false)?;
        push(&mut parts, part)?;
        start = i;
    }
    if parts.is_empty() {
        push(&mut parts, g)?;
    } else {
        push(&mut parts, subzone(&g, &g.samples[start..], false, true)?)?;
    }
    Ok(parts)
}
fn narrow(s: &mut Scan, lo: Gap, hi: Gap) -> Option<Gap> {
    let (mut a, mut fa, mut b, mut fb, mut stuck) = (lo.t, side(lo), hi.t, side(hi), 0);
    let mut at = None;
    let mut best = if lo.d <= hi.d { lo } else { hi };
    for _ in 0..100 {
        let mut t = (a * fb - b * fa) / (fb - fa);
        if !(t > a && t < b) {
            t = (a + b) / 2.0;
        }
        let Some(g) = gap(s, t) else {
            break;
        };
        let g = orient(g, lo);
        at = Some(g);
        if g.d < best.d {
            best = g;
        }
        if g.g.abs() <= s.noise || !readable(s, g) {
            break;
        }
        if (side(g) < 0.0) == (fa < 0.0) {
            a = t;
            fa = side(g);
            if stuck == -1 {
                fb /= 2.0;
            }
            stuck = -1;
        } else {
            b = t;
            fb = side(g);
            if stuck == 1 {
                fa /= 2.0;
            }
            stuck = 1;
        }
        if b - a <= 4.0 * f64::EPSILON {
            break;
        }
    }
    at.map(|at| if best.d <= at.d { best } else { at })
}
fn closest(s: &mut Scan, from: Gap, a: f64, b: f64) -> Gap {
    let r = 0.6180339887498949;
    let (mut lo, mut hi) = (a.max(from.t - (b - a) * 0.5), b.min(from.t + (b - a) * 0.5));
    let mut best = from;
    let (mut c, mut d) = (hi - r * (hi - lo), lo + r * (hi - lo));
    let (mut fc, mut fd) = (gap(s, c), gap(s, d));
    for _ in 0..40 {
        let (Some(gc), Some(gd)) = (fc, fd) else {
            break;
        };
        if !(hi - lo > 4.0 * f64::EPSILON) {
            break;
        }
        if gc.d < best.d {
            best = gc;
        }
        if gd.d < best.d {
            best = gd;
        }
        if gc.d <= gd.d {
            hi = d;
            d = c;
            fd = fc;
            c = hi - r * (hi - lo);
            fc = gap(s, c);
        } else {
            lo = c;
            c = d;
            fc = fd;
            d = lo + r * (hi - lo);
            fd = gap(s, d);
        }
    }
    if let Some(g) = fc {
        if g.d < best.d {
            best = g;
        }
    }
    if let Some(g) = fd {
        if g.d < best.d {
            best = g;
        }
    }
    best
}
fn refine(s: &mut Scan, lo: Gap, hi: Gap) {
    if s.out.len() > MAX_HITS {
        return;
    }
    let (u0, u1) = (lo.u.min(hi.u), lo.u.max(hi.u));
    if s.out
        .iter()
        .any(|h| h.t1 >= lo.t && h.t1 <= hi.t && h.t2 >= u0 && h.t2 <= u1)
    {
        return;
    }
    let (mut a, mut fa, mut b, mut fb, mut stuck) = (lo.t, side(lo), hi.t, side(hi), 0);
    let mut at = None;
    let mut best = if lo.d <= hi.d { lo } else { hi };
    for _ in 0..100 {
        let mut t = (a * fb - b * fa) / (fb - fa);
        if !(t > a && t < b) {
            t = (a + b) / 2.0;
        }
        let Some(g) = gap(s, t) else {
            break;
        };
        let g = orient(g, lo);
        at = Some(g);
        if g.d < best.d {
            best = g;
        }
        if g.g.abs() <= s.noise || !readable(s, g) {
            break;
        }
        if (side(g) < 0.0) == (fa < 0.0) {
            a = t;
            fa = side(g);
            if stuck == -1 {
                fb /= 2.0;
            }
            stuck = -1;
        } else {
            b = t;
            fb = side(g);
            if stuck == 1 {
                fa /= 2.0;
            }
            stuck = 1;
        }
        if b - a <= 4.0 * f64::EPSILON {
            break;
        }
    }
    if at.is_none() {
        return;
    }
    if best.d > s.tol {
        best = closest(s, best, a, b);
    }
    if best.d <= s.tol {
        s.out.push(Hit::new(best.t, best.u, best.px, best.py));
    }
}
fn end_contact(s: &mut Scan, curve: usize, end: usize) {
    if s.out.len() > MAX_HITS {
        return;
    }
    let (own, other) = if curve == 1 { (s.a, s.b) } else { (s.b, s.a) };
    let (x, y) = (own[6 * end], own[6 * end + 1]);
    let n = polished(other, x, y);
    if n.distance > s.tol {
        return;
    }
    let mut u = n.t;
    for e in 0..2 {
        if norm(other[6 * e] - x, other[6 * e + 1] - y) <= s.tol {
            u = e as f64;
        }
    }
    s.out.push(if curve == 1 {
        Hit::new(end as f64, u, x, y)
    } else {
        Hit::new(u, end as f64, n.x, n.y)
    });
}
fn run_end(s: &mut Scan, outside: Gap, inside: Gap) -> Gap {
    let (mut a, mut b, mut best) = (outside.t, inside.t, inside);
    for _ in 0..40 {
        if !((b - a).abs() > 4.0 * f64::EPSILON) {
            break;
        }
        let Some(g) = gap(s, (a + b) / 2.0) else {
            break;
        };
        if g.d <= s.tol * 0.9 {
            best = g;
            b = g.t;
        } else {
            a = g.t;
        }
    }
    best
}
fn report_run(s: &mut Scan, samples: &[Gap]) {
    let (Some(lo), Some(hi)) = (
        samples.iter().position(|g| g.d <= s.tol),
        samples.iter().rposition(|g| g.d <= s.tol),
    ) else {
        return;
    };
    if hi <= lo {
        return;
    }
    let a = if lo > 0 {
        run_end(s, samples[lo - 1], samples[lo])
    } else {
        samples[lo]
    };
    let b = if hi < samples.len() - 1 {
        run_end(s, samples[hi + 1], samples[hi])
    } else {
        samples[hi]
    };
    if norm(a.px - b.px, a.py - b.py) < 1e-3 * s.size || s.out.len() > MAX_HITS - 2 {
        return;
    }
    for g in [a, b] {
        if !s
            .out
            .iter()
            .any(|h| (h.t1 - g.t).abs() <= 1e-6 && (h.t2 - g.u).abs() <= 1e-6)
        {
            s.out.push(Hit::new(g.t, g.u, g.px, g.py));
        }
    }
}
fn parity(s: &mut Scan, g: &Zone, touches: &mut Vec<Gap>) -> Result<bool, ()> {
    let samples = &g.samples;
    if samples.len() < 2 {
        return Ok(false);
    }
    let (first, last) = (samples[0], *samples.last().unwrap());
    let clear = s.tol.max(s.noise);
    if !(first.g.abs() > clear && last.g.abs() > clear)
        || !(readable(s, first) && readable(s, last))
    {
        return Ok(false);
    }
    report_run(s, samples);
    let mut k = 0;
    for i in 1..samples.len() {
        if samples[i].d < samples[k].d {
            k = i;
        }
    }
    let mut best = samples[k];
    let odd = (side(first) < 0.0) != (side(last) < 0.0);
    if odd && best.d <= s.tol {
        let (mut lo, mut hi) = (k, k);
        while lo > 0 && samples[lo - 1].d <= s.tol {
            lo -= 1;
        }
        while hi < samples.len() - 1 && samples[hi + 1].d <= s.tol {
            hi += 1;
        }
        let mid = (samples[lo].t + samples[hi].t) / 2.0;
        for i in lo..=hi {
            if (samples[i].t - mid).abs() < (samples[k].t - mid).abs() {
                k = i;
            }
        }
        best = samples[k];
    }
    let (lo, hi) = (
        samples[k.saturating_sub(1)],
        samples[(k + 1).min(samples.len() - 1)],
    );
    if odd {
        if s.out.len() > MAX_HITS {
            return Ok(true);
        }
        let (mut prev, mut at, mut after) = (None, None, None);
        for &g in samples {
            if !readable(s, g) {
                continue;
            }
            if let Some(p) = prev {
                if (side(p) < 0.0) != (side(g) < 0.0) {
                    at = narrow(s, p, g);
                    after = Some(g);
                    break;
                }
            }
            prev = Some(g);
        }
        if let Some(at) = at {
            if at.d <= s.tol {
                best = at;
            }
        }
        let (u0, u1) = (lo.u.min(hi.u), lo.u.max(hi.u));
        if s.out
            .iter()
            .any(|h| h.t1 >= lo.t && h.t1 <= hi.t && h.t2 >= u0 && h.t2 <= u1)
        {
            return Ok(true);
        }
        if best.d > s.tol {
            best = closest(s, best, lo.t, hi.t);
        }
        if best.d > s.tol {
            if let (Some(at), Some(prev), Some(after)) = (at, prev, after) {
                best = closest(s, at, prev.t.min(after.t), prev.t.max(after.t));
            }
        }
        if best.d <= s.tol {
            s.out.push(Hit::new(best.t, best.u, best.px, best.py));
        }
        return Ok(true);
    }
    if best.d > s.tol {
        best = closest(s, best, lo.t, hi.t);
        if best.d > s.tol {
            return Ok(true);
        }
    }
    push(touches, best)?;
    Ok(true)
}
fn decide(
    s: &mut Scan,
    g: Zone,
    sides: &mut Vec<Vec<Gap>>,
    touches: &mut Vec<Gap>,
) -> Result<(), ()> {
    if !parity(s, &g, touches)? {
        let mut last = None;
        let mut run = Vec::new();
        let mut pending = Vec::new();
        for g in g.samples {
            if !readable(s, g) {
                push(&mut pending, g)?;
                continue;
            }
            if last.is_some_and(|p| (side(p) < 0.0) != (side(g) < 0.0)) {
                refine(s, last.unwrap(), g);
                push(sides, run)?;
                run = Vec::new();
            } else {
                append(&mut run, &mut pending)?;
            }
            pending.clear();
            push(&mut run, g)?;
            last = Some(g);
        }
        append(&mut run, &mut pending)?;
        push(sides, run)?;
    }
    if g.a0 <= TOUCH {
        end_contact(s, 1, 0);
    }
    if g.a1 >= 1.0 - TOUCH {
        end_contact(s, 1, 1);
    }
    if g.b0 <= TOUCH {
        end_contact(s, 2, 0);
    }
    if g.b1 >= 1.0 - TOUCH {
        end_contact(s, 2, 1);
    }
    Ok(())
}
fn touch_point(s: &mut Scan, samples: &[Gap]) -> Option<Gap> {
    if samples.len() < 3 {
        return None;
    }
    let noise = s.noise;
    let size = |g: Gap| if g.g.abs() <= noise { 0.0 } else { g.g.abs() };
    let mut k = 0;
    for i in 1..samples.len() {
        if size(samples[i]) < size(samples[k]) {
            k = i;
        }
    }
    let mut e = k;
    while e + 1 < samples.len() && size(samples[e + 1]) == size(samples[k]) {
        e += 1;
    }
    if k == 0 || e == samples.len() - 1 {
        return None;
    }
    let dip = size(samples[0]).min(size(*samples.last().unwrap())) - size(samples[k]);
    if !(dip > s.noise) {
        return None;
    }
    k = (k + e) >> 1;
    let mut best = samples[k];
    let r = 0.6180339887498949;
    let (mut lo, mut hi) = (samples[k - 1].t, samples[k + 1].t);
    let (mut c, mut d) = (hi - r * (hi - lo), lo + r * (hi - lo));
    let (mut fc, mut fd) = (gap(s, c), gap(s, d));
    for _ in 0..48 {
        let (Some(gc), Some(gd)) = (fc, fd) else {
            break;
        };
        if !(hi - lo > 4.0 * f64::EPSILON) {
            break;
        }
        if size(gc) < size(best) {
            best = gc;
        }
        if size(gd) < size(best) {
            best = gd;
        }
        if size(gc) <= size(gd) {
            hi = d;
            d = c;
            fd = fc;
            c = hi - r * (hi - lo);
            fc = gap(s, c);
        } else {
            lo = c;
            c = d;
            fc = fd;
            d = lo + r * (hi - lo);
            fd = gap(s, d);
        }
    }
    if let Some(g) = fc {
        if size(g) < size(best) {
            best = g;
        }
    }
    if let Some(g) = fd {
        if size(g) < size(best) {
            best = g;
        }
    }
    if norm(best.px - best.qx, best.py - best.qy) > s.tol {
        None
    } else {
        Some(best)
    }
}
pub fn scan(
    a: &Cubic,
    b: &Cubic,
    stalled: &[[f64; 4]],
    tol: f64,
    out: &mut Vec<Hit>,
) -> Result<(), ()> {
    let (members, ranges) = stretches(stalled)?;
    let n = ranges.len() - 1;
    let mut s = Scan {
        a,
        b,
        tol,
        out,
        size: size(a, b),
        noise: magnitude(a, b) * 64.0 * f64::EPSILON,
        budget: 16384,
        share: 16.max(16384 / 2 / n),
    };
    let clear = tol.max(s.noise);
    let mut zones: Vec<Zone> = capacity(n)?;
    for i in 0..n {
        zones.push(sample(&mut s, stalled, &members[ranges[i]..ranges[i + 1]])?);
    }
    sort(&mut zones, |g| g.a0)?;
    // Compact zones in place, retaining ownership without duplicating every zone allocation.
    let mut kept = 0;
    for read in 0..zones.len() {
        let mut g = std::mem::replace(&mut zones[read], Zone::empty());
        if kept > 0 && g.a0 <= zones[kept - 1].reach {
            let cur = &mut zones[kept - 1];
            append(&mut cur.samples, &mut g.samples)?;
            cur.a1 = cur.a1.max(g.a1);
            cur.b0 = cur.b0.min(g.b0);
            cur.b1 = cur.b1.max(g.b1);
            if cur.a1 > cur.reach {
                if let Some(r) = sentinel(&mut s, cur.a1, 1.0) {
                    push(&mut cur.samples, r)?;
                    cur.reach = r.t;
                } else {
                    cur.reach = 1.0;
                }
            }
            continue;
        }
        let l = if g.a0 > TOUCH {
            sentinel(&mut s, g.a0, -1.0)
        } else {
            None
        };
        let r = if g.a1 < 1.0 - TOUCH {
            sentinel(&mut s, g.a1, 1.0)
        } else {
            None
        };
        if let Some(l) = l {
            push(&mut g.samples, l)?;
            if l.t == 0.0 && l.g.abs() <= clear {
                g.a0 = 0.0;
            }
        }
        if let Some(r) = r {
            push(&mut g.samples, r)?;
            g.reach = r.t;
            if r.t == 1.0 && r.g.abs() <= clear {
                g.a1 = 1.0;
            }
        } else {
            g.reach = 1.0;
        }
        if g.b0 <= 1e-3 {
            g.b0 = 0.0;
        }
        if g.b1 >= 1.0 - 1e-3 {
            g.b1 = 1.0;
        }
        zones[kept] = g;
        kept += 1;
    }
    zones.truncate(kept);
    let mut sides = Vec::new();
    let mut touches = Vec::new();
    for mut g in zones {
        sort(&mut g.samples, |p| p.t)?;
        orient_zone(&s, &mut g.samples);
        for part in split_zone(&s, g)? {
            decide(&mut s, part, &mut sides, &mut touches)?;
        }
    }
    for run in sides {
        if let Some(at) = touch_point(&mut s, &run) {
            push(&mut touches, at)?;
        }
    }
    sort(&mut touches, |g| g.t)?;
    let mut kept = None;
    for at in touches {
        if let Some(old) = kept {
            if one_touch(&mut s, old, at) {
                if at.g.abs() < old.g.abs() {
                    kept = Some(at);
                }
                continue;
            }
            report(&mut s, old);
        }
        kept = Some(at);
    }
    if let Some(kept) = kept {
        report(&mut s, kept);
    }
    Ok(())
}
