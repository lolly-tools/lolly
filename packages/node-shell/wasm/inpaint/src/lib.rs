// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned PatchMatch inpainting kernel.
//!
//! The raw ABI is `inpaint_alloc`, `_free`, `_run`, `_result_ptr` and `_result_len`. The module
//! imports nothing from the host and uses no clock or random source, so the same request always
//! gives the same bytes.
//!
//! Request (little-endian): `width u32`, `height u32`, `patch_radius u32` (0 means the default,
//! 3; otherwise 1 to 8), `reserved u32` (must be 0), then `width * height * 4` RGBA bytes with
//! straight alpha, then `width * height` mask bytes where any non-zero byte marks a pixel to fill.
//!
//! Response on success: `width * height * 4` RGBA bytes. Pixels outside the mask are copied from
//! the request unchanged. Pixels inside the mask are re-estimated from the unmasked pixels.
//! Response on failure: a short UTF-8 message and a non-zero status.
//!
//! Only a window around the mask (the mask's bounding box plus context on every side) is
//! processed, so a small mark on a large photo costs the window and not the whole image.
#![deny(unsafe_op_in_unsafe_fn)]

use lightcraft_inpaint::{CompleteParams, complete};
use std::cell::RefCell;
use std::collections::BTreeMap;

/// Largest image the module accepts, in pixels (4096 x 4096).
pub const MAX_PIXELS: usize = 16 * 1024 * 1024;
const HEADER: usize = 16;
const MAX_INPUT: usize = HEADER + MAX_PIXELS * 5;
const DEFAULT_RADIUS: usize = 3;
const MAX_RADIUS: usize = 8;
/// Context kept on each side of the mask: half its larger extent, at least this many pixels.
const MIN_MARGIN: usize = 48;
/// Largest processed window, in pixels. A window costs about 115 bytes per pixel.
pub const MAX_WINDOW_PIXELS: usize = 13_000_000;

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

fn u32_at(b: &[u8], at: usize) -> u32 { u32::from_le_bytes([b[at], b[at + 1], b[at + 2], b[at + 3]]) }

/// Fill the masked pixels of an RGBA image. See the module docs for the wire format.
pub fn inpaint(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() < HEADER { return Err("Request is too short".into()); }
    if bytes.len() > MAX_INPUT { return Err("Request is too large".into()); }
    let (w, h) = (u32_at(bytes, 0) as usize, u32_at(bytes, 4) as usize);
    let radius = u32_at(bytes, 8) as usize;
    if u32_at(bytes, 12) != 0 { return Err("Reserved field must be zero".into()); }
    if w == 0 || h == 0 { return Err("Image is empty".into()); }
    let n = w.checked_mul(h).filter(|n| *n <= MAX_PIXELS).ok_or("Image is over the pixel cap")?;
    if radius > MAX_RADIUS { return Err("Patch radius is out of range".into()); }
    if bytes.len() != HEADER + n * 5 { return Err("Request length does not match the image size".into()); }
    let rgba = &bytes[HEADER..HEADER + n * 4];
    let mask = &bytes[HEADER + n * 4..];

    let (mut x0, mut y0, mut x1, mut y1) = (w, h, 0usize, 0usize);
    for y in 0..h {
        let row = &mask[y * w..(y + 1) * w];
        if let Some(first) = row.iter().position(|m| *m != 0) {
            let last = row.iter().rposition(|m| *m != 0).unwrap_or(first);
            x0 = x0.min(first); x1 = x1.max(last + 1);
            y0 = y0.min(y); y1 = y1.max(y + 1);
        }
    }
    let mut out = rgba.to_vec();
    if x1 <= x0 { return Ok(out); }

    let margin = MIN_MARGIN.max((x1 - x0).max(y1 - y0) / 2);
    let (wx0, wy0) = (x0.saturating_sub(margin), y0.saturating_sub(margin));
    let (wx1, wy1) = ((x1 + margin).min(w), (y1 + margin).min(h));
    let (ww, wh) = (wx1 - wx0, wy1 - wy0);
    if ww * wh > MAX_WINDOW_PIXELS { return Err("The masked area spans too much of the image".into()); }
    let opaque = (0..wh).all(|y| (0..ww).all(|x| rgba[((wy0 + y) * w + wx0 + x) * 4 + 3] == 255));
    let ch = if opaque { 3 } else { 4 };

    let mut img = Vec::with_capacity(ww * wh * ch);
    let mut hole = Vec::with_capacity(ww * wh);
    for y in 0..wh {
        for x in 0..ww {
            let i = (wy0 + y) * w + wx0 + x;
            for c in 0..ch { img.push(f32::from(rgba[i * 4 + c]) / 255.0); }
            hole.push(mask[i] != 0);
        }
    }
    let params = CompleteParams { patch_radius: if radius == 0 { DEFAULT_RADIUS } else { radius }, ..CompleteParams::default() };
    let filled = complete(ww, wh, ch, &img, &hole, &params).ok_or("There is nothing outside the mask to copy from")?;
    for y in 0..wh {
        for x in 0..ww {
            let wi = y * ww + x;
            if !hole[wi] { continue; }
            let i = (wy0 + y) * w + wx0 + x;
            for c in 0..ch { out[i * 4 + c] = (filled[wi * ch + c] * 255.0).round().clamp(0.0, 255.0) as u8; }
        }
    }
    Ok(out)
}

#[unsafe(no_mangle)]
pub extern "C" fn inpaint_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn inpaint_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn inpaint_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = if op != 1 { Err("Unknown operation".to_string()) } else {
            s.inputs.get(&ptr).filter(|b| b.len() == length).ok_or_else(|| "Invalid request buffer".to_string()).and_then(|b| inpaint(b))
        };
        match result { Ok(out) => { s.output = out; 0 }, Err(e) => { s.output = e.into_bytes(); 1 } }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn inpaint_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn inpaint_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }
#[unsafe(no_mangle)]
pub extern "C" fn inpaint_release_result() { STATE.with(|s| s.borrow_mut().output = Vec::new()); }

#[cfg(test)]
mod tests {
    use super::*;

    fn request(w: u32, h: u32, rgba: &[u8], mask: &[u8]) -> Vec<u8> {
        let mut v = Vec::new();
        for x in [w, h, 0, 0] { v.extend_from_slice(&x.to_le_bytes()); }
        v.extend_from_slice(rgba); v.extend_from_slice(mask); v
    }

    #[test]
    fn rejects_bad_requests() {
        assert!(inpaint(b"short").is_err());
        assert!(inpaint(&request(0, 4, &[], &[])).is_err());
        assert!(inpaint(&request(2, 2, &[0; 15], &[0; 4])).is_err());
        let mut bad = request(2, 2, &[0; 16], &[0; 4]); bad[12] = 1;
        assert!(inpaint(&bad).is_err());
        let over = request(4097, 4096, &[], &[]);
        assert!(inpaint(&over).unwrap_err().contains("cap"));
    }

    #[test]
    fn empty_mask_returns_input() {
        let rgba: Vec<u8> = (0..64).collect();
        assert_eq!(inpaint(&request(4, 4, &rgba, &[0; 16])).unwrap(), rgba);
    }

    #[test]
    fn full_mask_is_an_error() {
        assert!(inpaint(&request(4, 4, &[9; 64], &[1; 16])).is_err());
    }
}
