// SPDX-License-Identifier: MPL-2.0
//! Owned fitting results; validated requests and atomic output delivery.
use crate::offset_fit::{pieces, Piece, MAX_PIECES};
use crate::{number, usable, STATE};
use std::collections::BTreeMap;
use std::sync::Mutex;

struct Fits {
    next: i32,
    count: usize,
    results: BTreeMap<i32, Vec<Piece>>,
}
static FITS: Mutex<Fits> = Mutex::new(Fits {
    next: 1,
    count: 0,
    results: BTreeMap::new(),
});

/// Eight controls, distance and tolerance. Positive handle; -1 invalid, -2 ownership/work limit.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_fit_create(query: usize) -> i32 {
    let q = {
        let state = STATE.lock().unwrap_or_else(|e| e.into_inner());
        let Some(bytes) = state.buffers.get(&query) else {
            return -1;
        };
        if bytes.len() != 80 {
            return -1;
        }
        let mut q = [0.0; 10];
        for (i, word) in bytes.chunks_exact(8).enumerate() {
            q[i] = number(word);
            if !usable(q[i]) {
                return -1;
            }
        }
        if q[9] <= 0.0 {
            return -1;
        }
        q
    };
    {
        let fits = FITS.lock().unwrap_or_else(|e| e.into_inner());
        if fits.results.len() >= 8 || fits.next == i32::MAX {
            return -2;
        }
    }
    let mut src = [0.0; 8];
    src.copy_from_slice(&q[..8]);
    let Ok(result) = pieces(src, q[8], q[9]) else {
        return -2;
    };
    // Generated controls may exceed input admission; reject the whole operation explicitly.
    if result.iter().any(|p| {
        p.curve.iter().any(|v| !v.is_finite())
            || p.start
                .iter()
                .chain(&p.end)
                .flatten()
                .any(|v| !v.is_finite())
    }) {
        return -3;
    }
    let mut fits = FITS.lock().unwrap_or_else(|e| e.into_inner());
    if fits.results.len() >= 8
        || fits.next == i32::MAX
        || fits.count + result.len() > 2 * MAX_PIECES
    {
        return -2;
    }
    let id = fits.next;
    fits.next += 1;
    fits.count += result.len();
    fits.results.insert(id, result);
    id
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_fit_len(id: i32) -> i32 {
    let fits = FITS.lock().unwrap_or_else(|e| e.into_inner());
    fits.results.get(&id).map_or(-1, |r| r.len() as i32)
}
/// Records: controls[8], start flag/x/y, end flag/x/y. No writes before every shape check.
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_fit_read(id: i32, output: usize) -> i32 {
    let fits = FITS.lock().unwrap_or_else(|e| e.into_inner());
    let Some(result) = fits.results.get(&id) else {
        return 1;
    };
    let mut state = STATE.lock().unwrap_or_else(|e| e.into_inner());
    let Some(out) = state.buffers.get_mut(&output) else {
        return 1;
    };
    if out.len() != result.len() * 112 {
        return 2;
    }
    for (i, p) in result.iter().enumerate() {
        let mut record = [0.0; 14];
        record[..8].copy_from_slice(&p.curve);
        if let Some(d) = p.start {
            record[8] = 1.0;
            record[9..11].copy_from_slice(&d);
        }
        if let Some(d) = p.end {
            record[11] = 1.0;
            record[12..14].copy_from_slice(&d);
        }
        for (j, value) in record.iter().enumerate() {
            let offset = i * 112 + j * 8;
            out[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
        }
    }
    0
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_fit_free(id: i32) {
    let mut fits = FITS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(result) = fits.results.remove(&id) {
        fits.count -= result.len();
    }
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_fit_count() -> usize {
    FITS.lock().unwrap_or_else(|e| e.into_inner()).results.len()
}
#[allow(unsafe_code)] // Exported symbol name only.
#[no_mangle]
pub extern "C" fn geom_offset_fit_pieces() -> usize {
    FITS.lock().unwrap_or_else(|e| e.into_inner()).count
}
