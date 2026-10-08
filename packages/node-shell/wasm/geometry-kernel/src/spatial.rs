// SPDX-License-Identifier: MPL-2.0
//! Ordered proximity candidates using the existing start/midpoint/end cell traversal.
use crate::nearest::{eval, Cubic};
use std::collections::{hash_map::DefaultHasher, HashMap};
use std::hash::BuildHasherDefault;

pub const MAX_CURVES: usize = 8_000;
pub const MAX_PAIRS: usize = 65_536;
const MAX_VISITS: usize = 4_000_000;

fn round_js(value: f64) -> f64 {
    let lo = value.floor();
    let rounded = if value - lo < 0.5 { lo } else { lo + 1.0 };
    if rounded == 0.0 {
        0.0
    } else {
        rounded
    }
}
fn key(x: f64, y: f64) -> (u64, u64) {
    // Stringified JS numbers identify finite values, with both zero signs sharing a key.
    (
        if x == 0.0 { 0 } else { x.to_bits() },
        if y == 0.0 { 0 } else { y.to_bits() },
    )
}

pub fn pairs(curves: &[Cubic], weld: f64, limit: usize) -> Result<Vec<[u32; 2]>, ()> {
    if curves.len() > MAX_CURVES || limit == 0 || limit > MAX_PAIRS {
        return Err(());
    }
    let cell = (weld * 4.0).max(1e-12);
    let mut cells = Vec::new();
    let mut seen = Vec::new();
    let mut out = Vec::new();
    cells.try_reserve_exact(curves.len()).map_err(|_| ())?;
    seen.try_reserve_exact(curves.len()).map_err(|_| ())?;
    out.try_reserve_exact(limit).map_err(|_| ())?;
    seen.resize(curves.len(), 0u32);
    let mut buckets: HashMap<(u64, u64), Vec<u32>, BuildHasherDefault<DefaultHasher>> =
        HashMap::default();
    buckets.try_reserve(curves.len() * 3).map_err(|_| ())?;
    for (i, curve) in curves.iter().enumerate() {
        let mid = eval(curve, 0.5);
        let points =
            [curve[0], curve[1], mid[0], mid[1], curve[6], curve[7]].map(|v| round_js(v / cell));
        for at in [0, 2, 4] {
            let bucket = buckets.entry(key(points[at], points[at + 1])).or_default();
            if bucket.last() != Some(&(i as u32)) {
                bucket.try_reserve(1).map_err(|_| ())?;
                bucket.push(i as u32);
            }
        }
        cells.push(points);
    }
    let mut visits = 0;
    for (i, points) in cells.iter().enumerate() {
        let stamp = (i + 1) as u32;
        for at in [0, 2, 4] {
            for ox in -1..=1 {
                for oy in -1..=1 {
                    let Some(bucket) =
                        buckets.get(&key(points[at] + ox as f64, points[at + 1] + oy as f64))
                    else {
                        continue;
                    };
                    for &j in bucket {
                        visits += 1;
                        if visits > MAX_VISITS {
                            return Err(());
                        }
                        if j as usize <= i || seen[j as usize] == stamp {
                            continue;
                        }
                        seen[j as usize] = stamp;
                        if out.len() == limit {
                            return Err(());
                        }
                        out.push([i as u32, j]);
                    }
                }
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn negative_half_cells_and_large_integer_cells_match_js() {
        assert_eq!(round_js(-0.5), 0.0);
        assert_eq!(round_js(-1.5), -1.0);
        assert_eq!(round_js(0.5), 1.0);
        assert_eq!(round_js(1e21), 1e21);
        let curves = [[-2.0; 8], [2.0; 8], [-6.0; 8]];
        assert_eq!(pairs(&curves, 1.0, 10).unwrap(), vec![[0, 2], [0, 1]]);
        assert!(pairs(&[[0.0; 8]; 4], 1.0, 5).is_err());
    }
}
