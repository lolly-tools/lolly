// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned PSD format library.
#![deny(unsafe_op_in_unsafe_fn)]

use photocraft_psd::{PsdFile, SectionType};
use serde::Serialize;
use std::cell::RefCell;
use std::collections::BTreeMap;

const MAX_INPUT: usize = 64 * 1024 * 1024;
const MAX_DECODE: usize = 128 * 1024 * 1024;
const MAX_META: usize = 2 * 1024 * 1024;

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

#[derive(Serialize)]
struct Span { offset: usize, length: usize }
#[derive(Serialize)]
struct Channel { id: i16, data: Span }
#[derive(Serialize)]
struct Block { key: String, data: Span }
#[derive(Serialize)]
struct Mask { x: i32, y: i32, width: usize, height: usize, default_color: u8, flags: u8, data: Span }
#[derive(Serialize)]
struct Layer {
    name: String, x: i32, y: i32, width: usize, height: usize,
    opacity: u8, blend: String, visible: bool, clipped: bool, section: u32,
    channels: Vec<Channel>, blocks: Vec<Block>, mask: Option<Mask>,
}
#[derive(Serialize)]
struct Metadata {
    version: u16, width: u32, height: u32, depth: u16, mode: u16, channels: u16,
    merged_alpha: bool, icc: Option<Span>, composite: Option<Span>, layers: Vec<Layer>,
}

fn append(payload: &mut Vec<u8>, bytes: &[u8], budget: usize) -> Result<Span, String> {
    if bytes.len() > budget.saturating_sub(payload.len()) { return Err("PSD output exceeds the byte budget".into()); }
    let span = Span { offset: payload.len(), length: bytes.len() };
    payload.extend_from_slice(bytes);
    Ok(span)
}
fn decoded_size(width: usize, height: usize, depth: u16, channels: usize) -> Result<usize, String> {
    width.checked_mul(height).and_then(|n| n.checked_mul(usize::from(depth / 8)))
        .and_then(|n| n.checked_mul(channels)).ok_or_else(|| "PSD sample count overflow".into())
}
fn dispatch(bytes: &[u8], op: u32, requested: usize) -> Result<Vec<u8>, String> {
    if bytes.len() > MAX_INPUT { return Err("PSD input exceeds 64 MB".into()); }
    let budget = requested.min(MAX_DECODE);
    if budget == 0 { return Err("PSD byte budget must be positive".into()); }
    let file = PsdFile::from_bytes(bytes).map_err(|e| e.to_string())?;
    if file.layers().len() > 1024 { return Err("PSD contains more than 1024 layers".into()); }
    if op == 0 {
        let out = file.to_bytes().map_err(|e| e.to_string())?;
        if out.len() > MAX_INPUT { return Err("PSD round trip exceeds 64 MB".into()); }
        return Ok(out);
    }
    if op != 1 && op != 2 && op != 3 { return Err("Unknown PSD operation".into()); }
    let h = &file.header;
    if op >= 2 && !matches!(h.depth, 8 | 16 | 32) { return Err("PSD preview supports 8, 16 and 32-bit samples".into()); }
    let mut payload = Vec::new();
    let icc = file.icc_profile().map(|b| append(&mut payload, b, budget)).transpose()?;
    let mut meta = Metadata {
        version: h.version.as_u16(), width: h.width, height: h.height, depth: h.depth,
        mode: h.color_mode.as_u16(), channels: h.channels, merged_alpha: file.merged_has_alpha(),
        icc, composite: None, layers: Vec::new(),
    };
    if op >= 2 {
        let size = decoded_size(h.width as usize, h.height as usize, h.depth, h.channels as usize)?;
        if size > budget.saturating_sub(payload.len()) { return Err("PSD composite exceeds the byte budget".into()); }
        let samples = file.decode_merged().map_err(|e| e.to_string())?;
        meta.composite = Some(append(&mut payload, &samples, budget)?);
    }
    for rec in file.layers() {
        if op == 3 { break; }
        let width = rec.rect.width().max(0) as usize;
        let height = rec.rect.height().max(0) as usize;
        let section = match rec.section_type() {
            SectionType::OpenFolder => 1, SectionType::ClosedFolder => 2,
            SectionType::BoundingDivider => 3, _ => 0,
        };
        let mut layer = Layer {
            name: rec.name(), x: rec.rect.left, y: rec.rect.top, width, height,
            opacity: rec.opacity, blend: String::from_utf8_lossy(&rec.blend_mode.key()).into_owned(),
            visible: rec.is_visible(), clipped: rec.clipping != 0, section,
            channels: Vec::new(), blocks: Vec::new(), mask: None,
        };
        if layer.name.len() > 65536 || rec.blocks.len() > 256 { return Err("PSD layer metadata exceeds limits".into()); }
        for block in &rec.blocks {
            layer.blocks.push(Block {
                key: String::from_utf8_lossy(&block.key).into_owned(),
                data: append(&mut payload, &block.data, budget)?,
            });
        }
        if op == 2 && section == 0 && width > 0 && height > 0 {
            for ch in rec.channels.iter().filter(|c| c.id >= -1) {
                let size = decoded_size(width, height, h.depth, 1)?;
                if size > budget.saturating_sub(payload.len()) { return Err("PSD layer samples exceed the byte budget".into()); }
                let samples = rec.decode_channel(ch.id, h.depth, h.version).map_err(|e| e.to_string())?;
                layer.channels.push(Channel { id: ch.id, data: append(&mut payload, &samples, budget)? });
            }
            if let Some(mask) = rec.layer_mask().filter(|m| m.flags & 2 == 0)
                && rec.channels.iter().any(|c| c.id == -2)
            {
                let mw = mask.rect.width().max(0) as usize;
                let mh = mask.rect.height().max(0) as usize;
                let size = decoded_size(mw, mh, h.depth, 1)?;
                if size > budget.saturating_sub(payload.len()) { return Err("PSD mask exceeds the byte budget".into()); }
                let data = rec.decode_channel(-2, h.depth, h.version).map_err(|e| e.to_string())?;
                layer.mask = Some(Mask { x: mask.rect.left, y: mask.rect.top, width: mw, height: mh,
                    default_color: mask.default_color, flags: mask.flags, data: append(&mut payload, &data, budget)? });
            }
        }
        meta.layers.push(layer);
    }
    let json = serde_json::to_vec(&meta).map_err(|e| e.to_string())?;
    if json.len() > MAX_META { return Err("PSD metadata exceeds 2 MB".into()); }
    let mut out = Vec::with_capacity(4 + json.len() + payload.len());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&json);
    out.extend_from_slice(&payload);
    Ok(out)
}

#[unsafe(no_mangle)]
pub extern "C" fn adobe_psd_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn adobe_psd_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn adobe_psd_run(ptr: usize, length: usize, op: u32, budget: usize) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s.inputs.get(&ptr).filter(|b| b.len() == length)
            .ok_or_else(|| "Invalid PSD input buffer".to_string()).and_then(|b| dispatch(b, op, budget));
        match result { Ok(out) => { s.output = out; 0 }, Err(e) => { s.output = e.into_bytes(); 1 } }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn adobe_psd_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn adobe_psd_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }
