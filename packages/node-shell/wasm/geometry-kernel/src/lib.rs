// SPDX-License-Identifier: MPL-2.0
//! Bounded owned path handles and byte buffers; no host I/O and no raw-memory dereferences.
#![deny(unsafe_code)]
#[cfg(feature = "clipping")]
mod clip_abi;
#[cfg(feature = "clipping")]
mod clip_common;
#[cfg(feature = "clipping")]
mod clip_scan;
#[cfg(feature = "clipping")]
mod clip_search;
#[cfg(feature = "fitting")]
mod fit_abi;
#[cfg(feature = "fitting")]
mod fit_candidates;
#[cfg(any(feature = "fitting", feature = "clipping"))]
mod fit_cubic;
#[cfg(feature = "fitting")]
mod fit_math;
#[cfg(feature = "fitting")]
mod fit_metric;
mod nearest;
mod offset_error;
#[cfg(feature = "fitting")]
mod offset_features;
#[cfg(feature = "fitting")]
mod offset_fit;
mod ray;
mod roots;
mod spatial;

use nearest::Cubic;
use std::collections::BTreeMap;
use std::sync::Mutex;

const MAX_CURVES: usize = 16_000;
const MAX_RESIDENT_CURVES: usize = 32_000;
const MAX_PATHS: usize = 8;
const MAX_BUFFERS: usize = 32;
const MAX_BUFFER: usize = 2 * 1024 * 1024;
const MAX_BUFFER_BYTES: usize = 4 * 1024 * 1024;
const MAX_QUERIES: usize = 64;
const MAX_WORK: usize = 262_144;
const MAX_COORD: f64 = 1e9;

struct State {
    buffers: BTreeMap<usize, Vec<u8>>,
    bytes: usize,
    paths: BTreeMap<i32, Vec<Cubic>>,
    ray_boxes: BTreeMap<i32, Vec<ray::Box>>,
    curves: usize,
    next: i32,
}
static STATE: Mutex<State> = Mutex::new(State {
    buffers: BTreeMap::new(),
    bytes: 0,
    paths: BTreeMap::new(),
    ray_boxes: BTreeMap::new(),
    curves: 0,
    next: 1,
});

fn usable(value: f64) -> bool {
    value.is_finite() && value.abs() <= MAX_COORD
}
fn number(bytes: &[u8]) -> f64 {
    let mut word = [0; 8];
    word.copy_from_slice(bytes);
    f64::from_le_bytes(word)
}

#[allow(unsafe_code)] // Exported symbol name only; the body owns its buffers.
#[no_mangle]
pub extern "C" fn geom_alloc(length: usize) -> usize {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if length == 0
        || length > MAX_BUFFER
        || state.bytes + length > MAX_BUFFER_BYTES
        || state.buffers.len() >= MAX_BUFFERS
    {
        return 0;
    }
    let mut bytes = Vec::new();
    if bytes.try_reserve_exact(length).is_err() {
        return 0;
    }
    bytes.resize(length, 0);
    let pointer = bytes.as_ptr() as usize;
    state.bytes += length;
    state.buffers.insert(pointer, bytes);
    pointer
}

#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_free(pointer: usize) {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(bytes) = state.buffers.remove(&pointer) {
        state.bytes -= bytes.len();
    }
}

/// Positive immutable handle; -1 invalid input, -2 admission/allocation failure.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_path_create(pointer: usize) -> i32 {
    path_create(pointer, false)
}

#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_ray_path_create(pointer: usize) -> i32 {
    path_create(pointer, true)
}

fn path_create(pointer: usize, indexed: bool) -> i32 {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    let Some(bytes) = state.buffers.get(&pointer) else {
        return -1;
    };
    let stride = if indexed { 96 } else { 64 };
    if bytes.is_empty() || bytes.len() % stride != 0 {
        return -1;
    }
    let count = bytes.len() / stride;
    if count > MAX_CURVES
        || state.curves + count > MAX_RESIDENT_CURVES
        || state.paths.len() >= MAX_PATHS
        || state.next == i32::MAX
    {
        return -2;
    }
    let mut curves = Vec::new();
    if curves.try_reserve_exact(count).is_err() {
        return -2;
    }
    let mut boxes = Vec::new();
    if indexed && boxes.try_reserve_exact(count).is_err() {
        return -2;
    }
    for curve in bytes.chunks_exact(stride) {
        let mut c = [0.0; 8];
        for (i, word) in curve[..64].chunks_exact(8).enumerate() {
            c[i] = number(word);
            if !usable(c[i]) {
                return -1;
            }
        }
        curves.push(c);
        if indexed {
            let mut b = [0.0; 4];
            for (i, word) in curve[64..].chunks_exact(8).enumerate() {
                b[i] = number(word);
                if !usable(b[i]) {
                    return -1;
                }
            }
            if b[0] > b[2] || b[1] > b[3] {
                return -1;
            }
            boxes.push(b);
        }
    }
    let id = state.next;
    state.next += 1;
    state.curves += count;
    state.paths.insert(id, curves);
    if indexed {
        state.ray_boxes.insert(id, boxes);
    }
    id
}

#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_path_free(id: i32) {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(curves) = state.paths.remove(&id) {
        state.curves -= curves.len();
    }
    state.ray_boxes.remove(&id);
}

/// Query pairs in, [curve index,t,x,y,distance] float64 records out. No partial output on refusal.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_nearest_batch(id: i32, queries: usize, output: usize) -> i32 {
    let mut guard = STATE.lock().unwrap_or_else(|error| error.into_inner());
    let state = &mut *guard;
    if queries == output {
        return 1;
    }
    let Some(query_bytes) = state.buffers.get(&queries) else {
        return 1;
    };
    if query_bytes.is_empty() || query_bytes.len() % 16 != 0 {
        return 2;
    }
    let count = query_bytes.len() / 16;
    let Some(curves) = state.paths.get(&id) else {
        return 1;
    };
    if count > MAX_QUERIES || count * curves.len() > MAX_WORK {
        return 3;
    }
    let mut points = [[0.0; 2]; MAX_QUERIES];
    for (i, point) in query_bytes.chunks_exact(16).enumerate() {
        let x = number(&point[..8]);
        let y = number(&point[8..]);
        if !usable(x) || !usable(y) {
            return 2;
        }
        points[i] = [x, y];
    }
    let Some(out) = state.buffers.get_mut(&output) else {
        return 1;
    };
    if out.len() != count * 40 {
        return 2;
    }
    for (query, [x, y]) in points[..count].iter().enumerate() {
        let mut best = nearest::nearest(&curves[0], *x, *y);
        let mut index = 0;
        for (i, curve) in curves.iter().enumerate().skip(1) {
            let found = nearest::nearest(curve, *x, *y);
            if found.distance < best.distance {
                best = found;
                index = i;
            }
        }
        for (i, value) in [index as f64, best.t, best.x, best.y, best.distance]
            .iter()
            .enumerate()
        {
            let offset = query * 40 + i * 8;
            out[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
        }
    }
    0
}

#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_buffer_bytes() -> usize {
    STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .bytes
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_path_count() -> usize {
    STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .paths
        .len()
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_curve_count() -> usize {
    STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .curves
}

/// Pair count on success; -1 unknown handle/buffer, -2 invalid input, -3 bounded refusal.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_near_pairs(id: i32, weld: f64, output: usize) -> i32 {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if !weld.is_finite() || weld <= 0.0 || weld > MAX_COORD {
        return -2;
    }
    let Some(curves) = state.paths.get(&id) else {
        return -1;
    };
    let Some(out) = state.buffers.get(&output) else {
        return -1;
    };
    if out.is_empty() || out.len() % 8 != 0 {
        return -2;
    }
    let limit = out.len() / 8;
    let Ok(pairs) = spatial::pairs(curves, weld, limit) else {
        return -3;
    };
    let out = state.buffers.get_mut(&output).unwrap();
    for (index, pair) in pairs.iter().enumerate() {
        for (word, value) in pair.iter().enumerate() {
            let offset = index * 8 + word * 4;
            out[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
        }
    }
    pairs.len() as i32
}

/// [a,b,c,d] float64 records in; [count,(t,dir)*4] records out. Refusal is atomic.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_cubic_roots_batch(input: usize, output: usize) -> i32 {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if input == output {
        return 1;
    }
    let Some(bytes) = state.buffers.get(&input) else {
        return 1;
    };
    if bytes.is_empty() || bytes.len() % 32 != 0 {
        return 2;
    }
    let count = bytes.len() / 32;
    if count > roots::MAX_BATCH {
        return 3;
    }
    let Some(out) = state.buffers.get(&output) else {
        return 1;
    };
    if out.len() != count * roots::RECORD_BYTES {
        return 2;
    }
    let mut coefficients = Vec::new();
    if coefficients.try_reserve_exact(count).is_err() {
        return 3;
    }
    for record in bytes.chunks_exact(32) {
        let mut polynomial = [0.0; 4];
        for (i, word) in record.chunks_exact(8).enumerate() {
            polynomial[i] = number(word);
            if !polynomial[i].is_finite() || polynomial[i].abs() > roots::MAX_COEFFICIENT {
                return 2;
            }
        }
        coefficients.push(polynomial);
    }
    let out = state.buffers.get_mut(&output).unwrap();
    for (i, polynomial) in coefficients.into_iter().enumerate() {
        let found = roots::solve(polynomial);
        let record = &mut out[i * roots::RECORD_BYTES..(i + 1) * roots::RECORD_BYTES];
        record[..8].copy_from_slice(&(found.count as f64).to_le_bytes());
        for j in 0..4 {
            let offset = 8 + j * 16;
            record[offset..offset + 8].copy_from_slice(&found.ts[j].to_le_bytes());
            record[offset + 8..offset + 16].copy_from_slice(&found.dirs[j].to_le_bytes());
        }
    }
    0
}

/// One complete indexed cast; [far,net,ok,remaining work] float64 output, atomic refusal.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_ray_cast(id: i32, query: usize, bundle: usize, output: usize) -> i32 {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if query == output || bundle == output || query == bundle {
        return 1;
    }
    let Some(bytes) = state.buffers.get(&query) else {
        return 1;
    };
    if bytes.len() != 96 {
        return 2;
    }
    let Some(out) = state.buffers.get(&output) else {
        return 1;
    };
    if out.len() != 32 {
        return 2;
    }
    let Some(curves) = state.paths.get(&id) else {
        return 1;
    };
    let Some(boxes) = state.ray_boxes.get(&id) else {
        return 1;
    };
    let mut q = [0.0; 12];
    for (i, word) in bytes.chunks_exact(8).enumerate() {
        q[i] = number(word);
        if !q[i].is_finite() {
            return 2;
        }
    }
    if !usable(q[0])
        || !usable(q[1])
        || q[2].abs() > 1.0
        || q[3].abs() > 1.0
        || !(0.99..=1.01).contains(&(q[2] * q[2] + q[3] * q[3]))
        || q[4] <= 0.0
        || q[4] > MAX_COORD
        || q[5] < 1.0
        || q[5] > 1e12
        || q[6] < 1e-12
        || q[6] > 1e12
        || q[7].abs() > 1e12
        || q[8].abs() > 1e12
        || (q[9] != 0.0 && q[9] != 1.0)
        || (q[10] != 0.0 && q[10] != 1.0)
        || q[11].abs() > 200_000_000.0
        || q[11].fract() != 0.0
    {
        return 2;
    }
    let mut ranges = Vec::new();
    if bundle != 0 {
        let Some(bytes) = state.buffers.get(&bundle) else {
            return 1;
        };
        if bytes.is_empty() || bytes.len() % 24 != 0 {
            return 2;
        }
        if bytes.len() / 24 > ray::MAX_RANGES {
            return 3;
        }
        if ranges.try_reserve_exact(bytes.len() / 24).is_err() {
            return 3;
        }
        for (order, record) in bytes.chunks_exact(24).enumerate() {
            let ci = number(&record[..8]);
            let t0 = number(&record[8..16]);
            let t1 = number(&record[16..24]);
            if !ci.is_finite()
                || ci < 0.0
                || ci.fract() != 0.0
                || ci >= curves.len() as f64
                || !t0.is_finite()
                || !t1.is_finite()
                || t0 < 0.0
                || t1 > 1.0
                || t0 > t1
            {
                return 2;
            }
            ranges.push((ci as usize, order, t0, t1));
        }
        ranges.sort_unstable_by_key(|range| (range.0, range.1));
    }
    let found = ray::cast(curves, boxes, q, &ranges);
    let out = state.buffers.get_mut(&output).unwrap();
    for (i, value) in found.iter().enumerate() {
        out[i * 8..i * 8 + 8].copy_from_slice(&value.to_le_bytes());
    }
    0
}

/// Complete independent offset verification; source/distance/tolerance plus indexed fitted pieces.
/// Returns [maximum error, source parameter]; every refusal leaves output untouched.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_error(query: usize, fitted: usize, output: usize) -> i32 {
    let mut state = STATE.lock().unwrap_or_else(|error| error.into_inner());
    if query == fitted || query == output || fitted == output {
        return 1;
    }
    let Some(bytes) = state.buffers.get(&query) else {
        return 1;
    };
    if bytes.len() != 80 {
        return 2;
    }
    let mut q = [0.0; 10];
    for (i, word) in bytes.chunks_exact(8).enumerate() {
        q[i] = number(word);
        if !usable(q[i]) {
            return 2;
        }
    }
    if q[9] <= 0.0 {
        return 2;
    }
    let Some(bytes) = state.buffers.get(&fitted) else {
        return 1;
    };
    if bytes.is_empty() || bytes.len() % 96 != 0 {
        return 2;
    }
    let count = bytes.len() / 96;
    if count > offset_error::MAX_CURVES {
        return 3;
    }
    let Some(out) = state.buffers.get(&output) else {
        return 1;
    };
    if out.len() != 16 {
        return 2;
    }
    let mut curves = [[0.0; 8]; offset_error::MAX_CURVES];
    let mut boxes = [[0.0; 4]; offset_error::MAX_CURVES];
    for (i, record) in bytes.chunks_exact(96).enumerate() {
        for (j, word) in record[..64].chunks_exact(8).enumerate() {
            curves[i][j] = number(word);
            if !usable(curves[i][j]) {
                return 2;
            }
        }
        for (j, word) in record[64..].chunks_exact(8).enumerate() {
            boxes[i][j] = number(word);
            if !usable(boxes[i][j]) {
                return 2;
            }
        }
        if boxes[i][0] > boxes[i][2] || boxes[i][1] > boxes[i][3] {
            return 2;
        }
    }
    let mut src = [0.0; 8];
    src.copy_from_slice(&q[..8]);
    let found = offset_error::verify(src, &curves[..count], &boxes[..count], q[8], q[9]);
    let out = state.buffers.get_mut(&output).unwrap();
    for (i, value) in found.iter().enumerate() {
        out[i * 8..i * 8 + 8].copy_from_slice(&value.to_le_bytes());
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn allocation_ceiling_and_unknown_handles() {
        assert_eq!(geom_alloc(MAX_BUFFER + 1), 0);
        assert_eq!(geom_path_create(0), -1);
        assert_eq!(geom_nearest_batch(99, 0, 0), 1);
        let pointer = geom_alloc(64);
        assert_ne!(pointer, 0);
        let handle = geom_path_create(pointer);
        assert!(handle > 0);
        geom_path_free(handle);
        geom_free(pointer);
        assert_eq!(geom_curve_count(), 0);
        assert_eq!(geom_buffer_bytes(), 0);
    }
}
