// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned CADCraft DXF tag reader.
//!
//! The raw ABI is `dxf_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr` and `_result_len`.
//! Operation 1 reads an ASCII or binary DXF file (R12 to 2018) and returns one JSON document: a
//! flat entity list with layers, text styles, block definitions and a plain account of what was
//! left out. The module imports nothing from the host and keeps no state between runs.
#![deny(unsafe_op_in_unsafe_fn)]

mod read;

use std::cell::RefCell;
use std::collections::BTreeMap;

pub const MAX_INPUT: usize = 32 * 1024 * 1024;
pub const MAX_OUTPUT: usize = 48 * 1024 * 1024;
const OP_READ: u32 = 1;

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

pub fn read_json(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() > MAX_INPUT { return Err("The DXF file is larger than the 32 MB this importer reads.".into()); }
    let out = read::read(bytes)?;
    let json = serde_json::to_vec(&out).map_err(|e| e.to_string())?;
    if json.len() > MAX_OUTPUT { return Err("The drawing is too large to import: its entity list passes 48 MB.".into()); }
    Ok(json)
}

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    match op {
        OP_READ => read_json(bytes),
        _ => Err("Unknown operation".into()),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn dxf_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn dxf_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn dxf_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s.inputs.get(&ptr).filter(|b| b.len() == length)
            .ok_or_else(|| "Invalid request buffer".to_string()).and_then(|b| dispatch(b, op));
        match result { Ok(out) => { s.output = out; 0 }, Err(e) => { s.output = e.into_bytes(); 1 } }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn dxf_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn dxf_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn json_round_trip() {
        let out = read_json(b"0\nSECTION\n2\nENTITIES\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n0\nENDSEC\n0\nEOF\n").unwrap();
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        assert_eq!(v["e"][0]["t"], "LINE");
        assert_eq!(v["fmt"], "ascii");
    }
    #[test]
    fn errors_are_plain() {
        assert!(read_json(b"nope").is_err());
    }
}
