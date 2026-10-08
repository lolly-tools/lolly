// SPDX-License-Identifier: MPL-2.0
//! Ordered normal-ray peaks and the high-curvature arc correspondence guard.
use crate::fit_cubic::derivative;
use crate::nearest::{eval, Cubic};
use crate::offset_error::norm;
use crate::offset_fit::{Sample, Source, GL16};
use crate::roots::solve;
const N: usize = 20;
const SPANS: usize = 21;
const INV_PHI: f64 = 0.6180339887498949;

#[derive(Clone, Copy)]
struct ArcTable {
    cum: [f64; 22],
    total: f64,
}
pub struct CurveDist {
    src: Source,
    samples: [Sample; N],
    ts: [f64; N],
    arc: Option<ArcTable>,
    spicy: bool,
    t0: f64,
    t1: f64,
    step: f64,
}
fn power(c: &Cubic) -> [f64; 6] {
    [
        3.0 * (c[2] - c[0]),
        3.0 * (c[3] - c[1]),
        3.0 * c[4] - 6.0 * c[2] + 3.0 * c[0],
        3.0 * c[5] - 6.0 * c[3] + 3.0 * c[1],
        c[6] - c[0] - 3.0 * (c[4] - c[2]),
        c[7] - c[1] - 3.0 * (c[5] - c[3]),
    ]
}
fn ray(c: &Cubic, q: &[f64; 6], s: Sample, miss: f64) -> f64 {
    let k0 = (c[0] - s.x) * s.tx + (c[1] - s.y) * s.ty;
    let k1 = q[0] * s.tx + q[1] * s.ty;
    let k2 = q[2] * s.tx + q[3] * s.ty;
    let k3 = q[4] * s.tx + q[5] * s.ty;
    let r = solve([k3, k2, k1, k0]);
    let mut best = miss;
    for &t in &r.ts[..r.count] {
        let p = eval(c, t);
        let (x, y) = (p[0] - s.x, p[1] - s.y);
        let e = x * x + y * y;
        if e < best {
            best = e;
        }
    }
    best
}
fn refine(f: impl Fn(f64) -> f64, a: f64, b: f64, acc2: f64) -> f64 {
    let (mut lo, mut hi) = (a, b);
    let (mut x1, mut x2) = (hi - INV_PHI * (hi - lo), lo + INV_PHI * (hi - lo));
    let (mut f1, mut f2) = (f(x1), f(x2));
    let mut best = if f1 > f2 { f1 } else { f2 };
    for _ in 0..12 {
        if !(best <= acc2) {
            return best;
        }
        if f1 > f2 {
            hi = x2;
            x2 = x1;
            f2 = f1;
            x1 = hi - INV_PHI * (hi - lo);
            f1 = f(x1);
            if f1 > best {
                best = f1;
            }
        } else {
            lo = x1;
            x1 = x2;
            f1 = f2;
            x2 = lo + INV_PHI * (hi - lo);
            f2 = f(x2);
            if f2 > best {
                best = f2;
            }
        }
    }
    best
}
fn arc_span(c: &Cubic, a: f64, b: f64) -> f64 {
    let (mid, half) = (0.5 * (a + b), 0.5 * (b - a));
    let mut sum = 0.0;
    for [w, xi] in GL16 {
        let d = derivative(c, mid + xi * half);
        sum += w * norm(d[0], d[1]);
    }
    sum * half
}
fn arc_table(c: &Cubic) -> ArcTable {
    let mut tab = ArcTable {
        cum: [0.0; 22],
        total: 0.0,
    };
    for i in 0..SPANS {
        tab.total += arc_span(c, i as f64 / SPANS as f64, (i + 1) as f64 / SPANS as f64);
        tab.cum[i + 1] = tab.total;
    }
    tab
}
fn arc_invert(c: &Cubic, tab: &ArcTable, target: f64) -> f64 {
    if !(tab.total > 0.0) {
        return 0.0;
    }
    let s = target.max(0.0).min(tab.total);
    let (mut lo, mut hi) = (0, SPANS);
    while hi - lo > 1 {
        let m = (lo + hi) >> 1;
        if tab.cum[m] <= s {
            lo = m;
        } else {
            hi = m;
        }
    }
    let h = 1.0 / SPANS as f64;
    let t_lo = lo as f64 * h;
    let t_hi = t_lo + h;
    let span_len = tab.cum[lo + 1] - tab.cum[lo];
    let mut t = if span_len > 0.0 {
        t_lo + h * ((s - tab.cum[lo]) / span_len)
    } else {
        t_lo
    };
    for _ in 0..3 {
        let f = tab.cum[lo] + arc_span(c, t_lo, t) - s;
        let d = derivative(c, t);
        let speed = norm(d[0], d[1]);
        if speed < 1e-12 {
            break;
        }
        let next = (t - f / speed).max(t_lo).min(t_hi);
        if (next - t).abs() < 1e-13 {
            t = next;
            break;
        }
        t = next;
    }
    t.max(0.0).min(1.0)
}
impl CurveDist {
    pub fn new(src: Source, t0: f64, t1: f64) -> Self {
        let mut d = Self {
            src,
            samples: [Sample::default(); N],
            ts: [0.0; N],
            arc: None,
            spicy: false,
            t0,
            t1,
            step: (t1 - t0) / (N + 1) as f64,
        };
        let (mut lx, mut ly, mut have) = (0.0, 0.0, false);
        for i in 0..N + 2 {
            let t = t0 + i as f64 * d.step;
            let s = src.sample(t);
            if have {
                let cross = s.tx * ly - s.ty * lx;
                let dot = s.tx * lx + s.ty * ly;
                if cross.abs() > 0.2 * dot.abs() {
                    d.spicy = true;
                }
            }
            lx = s.tx;
            ly = s.ty;
            have = true;
            if i > 0 && i < N + 1 {
                d.samples[i - 1] = s;
                d.ts[i - 1] = t;
            }
        }
        d
    }
    fn eval_ray(&self, c: &Cubic, acc2: f64) -> f64 {
        let q = power(c);
        let miss = acc2 + 1.0;
        let mut errs = [0.0; N];
        let mut best = 0.0;
        for (i, s) in self.samples.iter().enumerate() {
            let e = ray(c, &q, *s, miss);
            errs[i] = e;
            if e > best {
                best = e;
            }
            if best > acc2 {
                return f64::INFINITY;
            }
        }
        for i in 0..N {
            let e = errs[i];
            if i > 0 && errs[i - 1] > e {
                continue;
            }
            if i + 1 < N && errs[i + 1] > e {
                continue;
            }
            let v = refine(
                |t| ray(c, &q, self.src.sample(t), miss),
                if i > 0 { self.ts[i - 1] } else { self.t0 },
                if i + 1 < N { self.ts[i + 1] } else { self.t1 },
                acc2,
            );
            if v > best {
                best = v;
            }
            if !(best <= acc2) {
                return f64::INFINITY;
            }
        }
        best
    }
    fn source_arc(&self) -> ArcTable {
        let mut tab = ArcTable {
            cum: [0.0; 22],
            total: 0.0,
        };
        for i in 0..SPANS {
            let a = self.t0 + i as f64 * self.step;
            let b = self.t0 + (i + 1) as f64 * self.step;
            let (mid, half) = (0.5 * (a + b), 0.5 * (b - a));
            let mut sum = 0.0;
            for [w, xi] in GL16 {
                let s = self.src.sample(mid + xi * half);
                sum += w * norm(s.tx, s.ty);
            }
            tab.total += sum * half;
            tab.cum[i + 1] = tab.total;
        }
        tab
    }
    fn eval_arc(&mut self, c: &Cubic, acc2: f64) -> f64 {
        if self.arc.is_none() {
            self.arc = Some(self.source_arc());
        }
        let source = self.arc.unwrap();
        let tab = arc_table(c);
        let mut best = 0.0;
        for (i, s) in self.samples.iter().enumerate() {
            let total = if source.total == 0.0 || source.total.is_nan() {
                1.0
            } else {
                source.total
            };
            let fraction = source.cum[i + 1] / total;
            let p = eval(c, arc_invert(c, &tab, tab.total * fraction));
            let (x, y) = (p[0] - s.x, p[1] - s.y);
            let e = x * x + y * y;
            if e > best {
                best = e;
            }
            if best > acc2 {
                return f64::INFINITY;
            }
        }
        best
    }
    pub fn eval(&mut self, c: &Cubic, acc2: f64) -> f64 {
        let ray = self.eval_ray(c, acc2);
        if !ray.is_finite() {
            return f64::INFINITY;
        }
        if !self.spicy {
            return ray;
        }
        let arc = self.eval_arc(c, acc2);
        if arc > ray {
            arc
        } else {
            ray
        }
    }
}
