// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned VectorCraft image tracer.
//!
//! The raw ABI is `image_trace_alloc`, `_free`, `_run`, `_result_ptr` and `_result_len`.
//! `_run(ptr, len, op)` takes a request buffer and a preset number, and leaves either a
//! JSON result (return 0) or a plain-English error message (return 1) for the host to read.
//!
//! Request layout: width as u32 little-endian, height as u32 little-endian, then
//! `width * height * 4` bytes of straight-alpha RGBA, top row first. The module decodes no
//! image formats: the shell hands over pixels it already decoded.
//!
//! The module imports nothing from the host. There is no clock, no random source and no
//! thread: the tracer's serial path is the only path, and its k-means seeds are fixed, so
//! the same pixels and preset give the same bytes every time.
#![deny(unsafe_op_in_unsafe_fn)]

use serde::Serialize;
use std::cell::RefCell;
use std::collections::BTreeMap;
use vectorcraft_trace::{Raster, TraceError, TraceParams, TraceResult, preset, trace_within};

/// Largest request buffer: the header plus a full-size raster.
const MAX_PIXELS: u64 = 4 * 1024 * 1024;
const MAX_INPUT: usize = 8 + (MAX_PIXELS as usize) * 4;
const MAX_OUTPUT: usize = 64 * 1024 * 1024;
/// Most anchor points one trace may make before it is refused.
const MAX_ANCHORS: usize = 300_000;

const OP_LOGO: u32 = 1;
const OP_ILLUSTRATION: u32 = 2;
const OP_LINE_ART: u32 = 3;
const OP_CENTRELINE: u32 = 4;

#[derive(Default)]
struct State {
    inputs: BTreeMap<usize, Vec<u8>>,
    output: Vec<u8>,
    allocated: usize,
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

#[derive(Serialize)]
struct Out {
    w: u32,
    h: u32,
    paths: Vec<OutPath>,
}

#[derive(Serialize)]
struct OutPath {
    /// Fill colour, or stroke colour when `s` is present.
    c: [u8; 3],
    /// Stroke width in pixels. Absent for a filled shape.
    #[serde(skip_serializing_if = "Option::is_none")]
    s: Option<f64>,
    /// Subpaths: each is `[closed, x, y, inX, inY, outX, outY, ...]`, one anchor per six numbers.
    d: Vec<Vec<f64>>,
}

fn params_for(op: u32) -> Result<TraceParams, String> {
    let name = match op {
        OP_LOGO => "Flat Logo",
        OP_ILLUSTRATION => "Auto Color",
        OP_LINE_ART => "Line Art",
        OP_CENTRELINE => "Outline",
        _ => return Err("Unknown trace preset".into()),
    };
    preset(name).ok_or_else(|| "Unknown trace preset".to_string())
}

fn message(err: TraceError) -> String {
    match err {
        TraceError::NotFlat { .. } => "This image has gradients or photo tones, so it cannot trace as a logo. Try the illustration preset.".into(),
        TraceError::TooComplex { .. } => "This image makes too many points to trace. Try a smaller image, or the logo or line art preset.".into(),
        TraceError::Cancelled => "The trace was cancelled.".into(),
        TraceError::Empty => "The image is empty.".into(),
        TraceError::TooLarge { .. } => "The image is too large to trace.".into(),
        other => other.to_string(),
    }
}

/// Round to 1/100 pixel so the output is short and identical everywhere.
fn r2(v: f64) -> f64 {
    let v = (v * 100.0).round() / 100.0;
    if v == 0.0 { 0.0 } else { v }
}

fn encode(result: &TraceResult) -> Vec<OutPath> {
    let subpath = |sp: &vectorcraft_geom::SubPath| {
        let mut v = Vec::with_capacity(1 + sp.anchors.len() * 6);
        v.push(if sp.closed { 1.0 } else { 0.0 });
        for a in &sp.anchors {
            for n in [a.p.x, a.p.y, a.h_in.x, a.h_in.y, a.h_out.x, a.h_out.y] {
                v.push(r2(n.clamp(-1.0e6, 1.0e6)));
            }
        }
        v
    };
    result
        .paths
        .iter()
        .map(|p| OutPath {
            c: p.color,
            s: p.stroke.map(r2),
            d: p.path.subpaths.iter().filter(|sp| !sp.anchors.is_empty()).map(subpath).collect(),
        })
        .filter(|p| !p.d.is_empty())
        .collect()
}

fn run_trace(bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    if bytes.len() < 8 {
        return Err("The trace request is too short.".into());
    }
    let width = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    let height = u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
    if width == 0 || height == 0 {
        return Err("The image is empty.".into());
    }
    let pixels = u64::from(width) * u64::from(height);
    if pixels > MAX_PIXELS {
        return Err(format!(
            "The image is {width} by {height} pixels, more than the {} million pixels Trace image takes. Scale it down first.",
            MAX_PIXELS / (1024 * 1024)
        ));
    }
    let rgba = &bytes[8..];
    if rgba.len() as u64 != pixels * 4 {
        return Err(format!("The pixel data does not match a {width} by {height} image."));
    }
    let params = params_for(op)?;
    let raster = Raster::new(width, height, rgba.to_vec()).map_err(message)?;
    let result = trace_within(&raster, &params, MAX_ANCHORS).map_err(message)?;
    let out = Out { w: width, h: height, paths: encode(&result) };
    let json = serde_json::to_vec(&out).map_err(|e| e.to_string())?;
    if json.len() > MAX_OUTPUT {
        return Err("The traced result is too large. Try a smaller image.".into());
    }
    Ok(json)
}

#[unsafe(no_mangle)]
pub extern "C" fn image_trace_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) {
            return 0;
        }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes);
        s.allocated += length;
        ptr
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn image_trace_free(ptr: usize) {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if let Some(b) = s.inputs.remove(&ptr) {
            s.allocated -= b.len();
        }
    });
}

#[unsafe(no_mangle)]
pub extern "C" fn image_trace_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s
            .inputs
            .get(&ptr)
            .filter(|b| b.len() == length)
            .ok_or_else(|| "Invalid request buffer".to_string())
            .and_then(|b| run_trace(b, op));
        match result {
            Ok(out) => {
                s.output = out;
                0
            }
            Err(e) => {
                s.output = e.into_bytes();
                1
            }
        }
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn image_trace_result_ptr() -> usize {
    STATE.with(|s| s.borrow().output.as_ptr() as usize)
}

#[unsafe(no_mangle)]
pub extern "C" fn image_trace_result_len() -> usize {
    STATE.with(|s| s.borrow().output.len())
}
