// SPDX-License-Identifier: MPL-2.0
//! Bounded RGBA8 LUT reference. The byte ABI uses owned allocations without raw memory access.
#![deny(unsafe_code)]

use std::collections::BTreeMap;
use std::sync::Mutex;

const MAX_PIXELS: usize = 8 * 1024 * 1024;
const MAX_ALLOCATION: usize = 32 * 1024 * 1024;
const MAX_ALLOCATED: usize = 80 * 1024 * 1024;

struct Allocations {
    buffers: BTreeMap<usize, Vec<u8>>,
    bytes: usize,
}
static ALLOCATIONS: Mutex<Allocations> = Mutex::new(Allocations { buffers: BTreeMap::new(), bytes: 0 });

#[allow(unsafe_code)] // Only the exported symbol name; the function uses safe owned buffers.
#[no_mangle]
pub extern "C" fn lolly_alloc(length: usize) -> usize {
    let mut state = ALLOCATIONS.lock().unwrap_or_else(|error| error.into_inner());
    if length == 0 || length > MAX_ALLOCATION || state.bytes + length > MAX_ALLOCATED { return 0; }
    let mut bytes = Vec::new();
    if bytes.try_reserve_exact(length).is_err() { return 0; }
    bytes.resize(length, 0);
    let pointer = bytes.as_ptr() as usize;
    state.bytes += length;
    state.buffers.insert(pointer, bytes);
    pointer
}

#[allow(unsafe_code)] // Only the exported symbol name.
#[no_mangle]
pub extern "C" fn lolly_free(pointer: usize) {
    let mut state = ALLOCATIONS.lock().unwrap_or_else(|error| error.into_inner());
    if let Some(bytes) = state.buffers.remove(&pointer) { state.bytes -= bytes.len(); }
}

#[allow(unsafe_code)] // Only the exported symbol name.
#[no_mangle]
pub extern "C" fn lolly_allocated_bytes() -> usize {
    ALLOCATIONS.lock().unwrap_or_else(|error| error.into_inner()).bytes
}

pub struct Lut<'a> {
    pub kind: u32,
    pub size: usize,
    pub samples: &'a [f32],
    pub min: [f64; 3],
    pub max: [f64; 3],
}

fn sample(lut: &Lut<'_>, rgb: [f64; 3]) -> [f64; 3] {
    let mut p = [0.0; 3];
    for ch in 0..3 {
        let span = lut.max[ch] - lut.min[ch];
        let span = if span == 0.0 { 1.0 } else { span };
        p[ch] = ((rgb[ch] - lut.min[ch]) / span).clamp(0.0, 1.0) * (lut.size - 1) as f64;
    }
    if lut.kind == 0 {
        let mut out = [0.0; 3];
        for ch in 0..3 {
            let first = p[ch].floor() as usize;
            let second = (first + 1).min(lut.size - 1);
            let f = p[ch] - first as f64;
            out[ch] = lut.samples[first * 3 + ch] as f64 * (1.0 - f) + lut.samples[second * 3 + ch] as f64 * f;
        }
        return out;
    }
    let cell = p.map(|value| (value.floor() as usize).min(lut.size - 2));
    let [x, y, z] = [p[0] - cell[0] as f64, p[1] - cell[1] as f64, p[2] - cell[2] as f64];
    let sx = 3;
    let sy = lut.size * 3;
    let sz = lut.size * lut.size * 3;
    let base = ((cell[2] * lut.size + cell[1]) * lut.size + cell[0]) * 3;
    let (weights, a, b) = if x >= y {
        if y >= z { ([1.0 - x, x - y, y - z, z], base + sx, base + sx + sy) }
        else if x >= z { ([1.0 - x, x - z, z - y, y], base + sx, base + sx + sz) }
        else { ([1.0 - z, z - x, x - y, y], base + sz, base + sx + sz) }
    } else if z >= y { ([1.0 - z, z - y, y - x, x], base + sz, base + sy + sz) }
    else if z >= x { ([1.0 - y, y - z, z - x, x], base + sy, base + sy + sz) }
    else { ([1.0 - y, y - x, x - z, z], base + sy, base + sx + sy) };
    let last = base + sx + sy + sz;
    let mut out = [0.0; 3];
    for ch in 0..3 {
        out[ch] = weights[0] * lut.samples[base + ch] as f64
            + weights[1] * lut.samples[a + ch] as f64
            + weights[2] * lut.samples[b + ch] as f64
            + weights[3] * lut.samples[last + ch] as f64;
    }
    out
}

pub fn grade_rgba(pixels: &mut [u8], lut: &Lut<'_>, intensity: f64) -> Result<(), &'static str> {
    if pixels.len() % 4 != 0 || pixels.len() / 4 > MAX_PIXELS || !intensity.is_finite() { return Err("invalid frame"); }
    if lut.kind > 1 || !(2..=129).contains(&lut.size) { return Err("invalid grid"); }
    let expected = if lut.kind == 0 { lut.size * 3 } else { lut.size.pow(3) * 3 };
    if lut.samples.len() != expected || lut.samples.iter().any(|v| !v.is_finite() || v.abs() > 64.0) { return Err("invalid samples"); }
    for ch in 0..3 {
        if !lut.min[ch].is_finite() || !lut.max[ch].is_finite() || lut.min[ch].abs() > 1e6 || lut.max[ch].abs() > 1e6 { return Err("invalid domain"); }
        if lut.min[ch] != lut.max[ch] && lut.min[ch] as f32 == lut.max[ch] as f32 { return Err("narrow domain"); }
    }
    let amount = intensity.clamp(0.0, 1.0);
    if amount == 0.0 { return Ok(()); }
    for pixel in pixels.chunks_exact_mut(4) {
        let rgb = [pixel[0] as f64 / 255.0, pixel[1] as f64 / 255.0, pixel[2] as f64 / 255.0];
        let graded = sample(lut, rgb);
        for ch in 0..3 {
            let original = pixel[ch] as f64;
            let next = if amount == 1.0 { 255.0 * graded[ch] } else { original + (255.0 * graded[ch] - original) * amount };
            pixel[ch] = next.clamp(0.0, 255.0).round_ties_even() as u8;
        }
    }
    Ok(())
}

#[allow(unsafe_code)] // Only the exported symbol name.
#[no_mangle]
pub extern "C" fn lolly_grade_lut(pixels_pointer: usize, lut_pointer: usize, kind: u32, size: usize,
    intensity: f64, min_r: f64, min_g: f64, min_b: f64, max_r: f64, max_g: f64, max_b: f64) -> u32 {
    let mut state = ALLOCATIONS.lock().unwrap_or_else(|error| error.into_inner());
    if pixels_pointer == lut_pointer { return 1; }
    let Some(mut pixels) = state.buffers.remove(&pixels_pointer) else { return 1; };
    let result = (|| {
        let table = state.buffers.get(&lut_pointer).ok_or("unknown table")?;
        if table.len() % 4 != 0 { return Err("unaligned table"); }
        let mut samples = Vec::new();
        samples.try_reserve_exact(table.len() / 4).map_err(|_| "allocation")?;
        for bytes in table.chunks_exact(4) { samples.push(f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])); }
        grade_rgba(&mut pixels, &Lut { kind, size, samples: &samples,
            min: [min_r, min_g, min_b], max: [max_r, max_g, max_b] }, intensity)
    })();
    state.buffers.insert(pixels_pointer, pixels);
    if result.is_ok() { 0 } else { 2 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_lut_rounds_ties_to_even_and_keeps_alpha() {
        let samples = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
        let lut = Lut { kind: 0, size: 2, samples: &samples, min: [0.0; 3], max: [1.0; 3] };
        let mut pixels = [0, 10, 255, 0, 20, 40, 60, 137];
        grade_rgba(&mut pixels, &lut, 1.0).unwrap();
        assert_eq!(pixels, [128, 128, 128, 0, 128, 128, 128, 137]);
    }

    #[test]
    fn rejected_input_does_not_change_pixels() {
        let lut = Lut { kind: 1, size: 129, samples: &[], min: [0.0; 3], max: [1.0; 3] };
        let mut pixels = [1, 2, 3, 4];
        assert!(grade_rgba(&mut pixels, &lut, 1.0).is_err());
        assert_eq!(pixels, [1, 2, 3, 4]);
        assert_eq!(lolly_grade_lut(0, 0, 1, 2, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0), 1);
        assert_eq!(lolly_alloc(MAX_ALLOCATION + 1), 0);
    }
}
