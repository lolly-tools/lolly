// SPDX-License-Identifier: MPL-2.0
//! Owned complete pair searches, including caller-specified bounded work controls.
use crate::clip_common::{Cubic, MAX_HITS};
use crate::clip_search::{intersect, Limits, ResultPair};
use crate::{number, usable, STATE};
use std::collections::BTreeMap;
use std::sync::Mutex;

struct Results {
    next: i32,
    hits: usize,
    values: BTreeMap<i32, ResultPair>,
}
static RESULTS: Mutex<Results> = Mutex::new(Results {
    next: 1,
    hits: 0,
    values: BTreeMap::new(),
});

/// Controls[16], tolerance, initial/overrun/stalled limits. Positive handle or atomic refusal.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_clip_create(query: usize) -> i32 {
    let q = {
        let state = STATE.lock().unwrap_or_else(|e| e.into_inner());
        let Some(bytes) = state.buffers.get(&query) else {
            return -1;
        };
        if bytes.len() != 160 {
            return -1;
        }
        let mut q = [0.0; 20];
        for (i, word) in bytes.chunks_exact(8).enumerate() {
            q[i] = number(word);
        }
        if q[..17].iter().any(|v| !usable(*v)) || q[16] <= 0.0 {
            return -1;
        }
        // Admission includes the existing wide-baseline and ceiling-sweep test controls.
        for (i, cap) in [(17, 10_000_000.0), (18, 262_144.0), (19, 65_536.0)] {
            if !q[i].is_finite() || q[i] < 0.0 || q[i] > cap || q[i].fract() != 0.0 {
                return -1;
            }
        }
        q
    };
    {
        let state = RESULTS.lock().unwrap_or_else(|e| e.into_inner());
        if state.values.len() >= 8 || state.next == i32::MAX {
            return -2;
        }
    }
    let (mut a, mut b): (Cubic, Cubic) = ([0.0; 8], [0.0; 8]);
    a.copy_from_slice(&q[..8]);
    b.copy_from_slice(&q[8..16]);
    let Ok(result) = intersect(
        a,
        b,
        q[16],
        Limits {
            initial: q[17] as usize,
            overrun: q[18] as usize,
            stalled: q[19] as usize,
        },
    ) else {
        return -2;
    };
    if result.hits.len() > MAX_HITS + 1
        || result.hits.iter().any(|h| {
            [h.t1, h.t2, h.x, h.y]
                .iter()
                .chain(h.dir.iter())
                .any(|v| !v.is_finite())
        })
    {
        return -3;
    }
    let mut state = RESULTS.lock().unwrap_or_else(|e| e.into_inner());
    if state.values.len() >= 8
        || state.next == i32::MAX
        || state.hits + result.hits.len() > 8 * (MAX_HITS + 1)
    {
        return -2;
    }
    let id = state.next;
    state.next += 1;
    state.hits += result.hits.len();
    state.values.insert(id, result);
    id
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_clip_len(id: i32) -> i32 {
    RESULTS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .values
        .get(&id)
        .map_or(-1, |r| r.hits.len() as i32)
}
/// Header: reached,nodes,overrun,searched,overrunNodes,ceiling. Hits: t1,t2,x,y,dir flag/value.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_clip_read(id: i32, output: usize) -> i32 {
    let results = RESULTS.lock().unwrap_or_else(|e| e.into_inner());
    let Some(result) = results.values.get(&id) else {
        return 1;
    };
    let mut state = STATE.lock().unwrap_or_else(|e| e.into_inner());
    let Some(out) = state.buffers.get_mut(&output) else {
        return 1;
    };
    if out.len() != 48 + result.hits.len() * 48 {
        return 2;
    }
    let c = &result.counts;
    for (i, v) in [
        c.reached as u8 as f64,
        c.nodes as f64,
        c.overrun as u8 as f64,
        c.searched as u8 as f64,
        c.overrun_nodes as f64,
        c.ceiling as u8 as f64,
    ]
    .into_iter()
    .enumerate()
    {
        out[i * 8..i * 8 + 8].copy_from_slice(&v.to_le_bytes());
    }
    for (i, h) in result.hits.iter().enumerate() {
        for (j, v) in [
            h.t1,
            h.t2,
            h.x,
            h.y,
            h.dir.is_some() as u8 as f64,
            h.dir.unwrap_or(0.0),
        ]
        .into_iter()
        .enumerate()
        {
            let offset = 48 + i * 48 + j * 8;
            out[offset..offset + 8].copy_from_slice(&v.to_le_bytes());
        }
    }
    0
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_clip_free(id: i32) {
    let mut state = RESULTS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(result) = state.values.remove(&id) {
        state.hits -= result.hits.len();
    }
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_clip_count() -> usize {
    RESULTS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .values
        .len()
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_clip_hits() -> usize {
    RESULTS.lock().unwrap_or_else(|e| e.into_inner()).hits
}
