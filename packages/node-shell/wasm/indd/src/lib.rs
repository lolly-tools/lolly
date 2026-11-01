// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned INDD to IDML converter.
//!
//! The host copies INDD bytes in, runs one conversion and copies the result out.
//! A successful result is `u32 le warning-json-length`, the warning JSON (an array
//! of strings) and the IDML zip. A failure is a UTF-8 message.
#![deny(unsafe_op_in_unsafe_fn)]

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::io::{self, Write};

/// Largest INDD file accepted.
const MAX_INPUT: usize = 128 * 1024 * 1024;
/// Largest IDML package produced.
const MAX_OUTPUT: usize = 128 * 1024 * 1024;
/// Largest document name kept.
const MAX_NAME: usize = 256;
/// Warnings returned, their length each and their combined JSON size.
const MAX_WARNINGS: usize = 500;
const MAX_WARNING_CHARS: usize = 400;
const MAX_WARNING_JSON: usize = 128 * 1024;

const STATUS_OK: u32 = 0;
const STATUS_FAILED: u32 = 1;
const STATUS_LIMIT: u32 = 2;

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

/// A sink that refuses bytes past a fixed size, so a hostile file cannot grow the package.
struct Capped { bytes: Vec<u8>, over: bool }
impl Write for Capped {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if buf.len() > MAX_OUTPUT - self.bytes.len() {
            self.over = true;
            return Err(io::Error::other("IDML output limit"));
        }
        self.bytes.extend_from_slice(buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> io::Result<()> { Ok(()) }
}

fn json_string(text: &str, out: &mut String) {
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn warnings_json(warnings: &[indd::Warning]) -> String {
    let mut out = String::from("[");
    let mut kept = 0;
    for warning in warnings.iter().take(MAX_WARNINGS) {
        let text: String = warning.message().chars().take(MAX_WARNING_CHARS).collect();
        if out.len() + text.len() * 6 + 8 > MAX_WARNING_JSON { break; }
        if kept > 0 { out.push(','); }
        json_string(&text, &mut out);
        kept += 1;
    }
    if kept < warnings.len() {
        if kept > 0 { out.push(','); }
        json_string(&format!("{} further converter warnings were left out.", warnings.len() - kept), &mut out);
    }
    out.push(']');
    out
}

fn dispatch(bytes: &[u8], name: &[u8]) -> Result<Vec<u8>, (u32, String)> {
    if bytes.len() > MAX_INPUT { return Err((STATUS_LIMIT, "INDD input exceeds 128 MB".into())); }
    let name: String = String::from_utf8_lossy(&name[..name.len().min(MAX_NAME)]).chars().take(MAX_NAME).collect();
    let mut sink = Capped { bytes: Vec::new(), over: false };
    let result = indd::convert_into(bytes, &name, &mut sink);
    if sink.over { return Err((STATUS_LIMIT, "The converted IDML exceeds 128 MB".into())); }
    let warnings = result.map_err(|e| (STATUS_FAILED, e.to_string()))?;
    let json = warnings_json(&warnings);
    let mut out = Vec::with_capacity(4 + json.len() + sink.bytes.len());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(json.as_bytes());
    out.extend_from_slice(&sink.bytes);
    Ok(out)
}

#[unsafe(no_mangle)]
pub extern "C" fn indd_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn indd_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
/// Convert the INDD bytes at `ptr` (from `indd_alloc`). The name buffer is optional: pass 0, 0 for none.
#[unsafe(no_mangle)]
pub extern "C" fn indd_run(ptr: usize, length: usize, name_ptr: usize, name_length: usize) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = match s.inputs.get(&ptr).filter(|b| b.len() == length) {
            None => Err((STATUS_FAILED, "Invalid INDD input buffer".to_string())),
            Some(input) => {
                let name: &[u8] = if name_ptr == 0 && name_length == 0 { b"document.indd" }
                    else { match s.inputs.get(&name_ptr).filter(|b| b.len() == name_length) { Some(n) => n, None => &[] } };
                dispatch(input, name)
            }
        };
        match result {
            Ok(out) => { s.output = out; STATUS_OK }
            Err((status, message)) => { s.output = message.into_bytes(); status }
        }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn indd_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn indd_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }
