// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned GridCraft number-format engine.
//!
//! One module, many operations. The raw ABI is `xlsx_numfmt_alloc`, `_free`, `_run`,
//! `_result_ptr` and `_result_len`; `_run` takes an operation number, so a later formula
//! engine can add operations here instead of shipping a second module.
//!
//! Operation 1 formats a batch of cell values with Excel number-format codes. The module
//! imports nothing from the host. The only time-dependent input is the optional `now`
//! field of a request (milliseconds since the Unix epoch), so output is deterministic.
#![deny(unsafe_op_in_unsafe_fn)]

use gridcraft_core::date::{self, DateSystem};
use gridcraft_core::Value;
use gridcraft_numfmt::{FormatKind, NumberFormat, format_value};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;

const MAX_INPUT: usize = 16 * 1024 * 1024;
const MAX_OUTPUT: usize = 32 * 1024 * 1024;
const MAX_CELLS: usize = 100_000;
const MAX_FORMATS: usize = 4096;
const MAX_TEXT_BYTES: usize = 32 * 1024;
const MAX_CODE_BYTES: usize = 1024;

const OP_FORMAT_BATCH: u32 = 1;

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

#[derive(Deserialize)]
#[serde(untagged)]
enum CellValue { Number(f64), Text(String) }

#[derive(Deserialize)]
struct Cell { v: CellValue, f: usize, d: u32 }

#[derive(Deserialize)]
struct Request {
    #[serde(default)]
    now: Option<f64>,
    formats: Vec<String>,
    cells: Vec<Cell>,
}

#[derive(Serialize)]
struct Formatted {
    t: String,
    k: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    i: Option<String>,
}

fn kind_name(kind: FormatKind) -> &'static str {
    match kind {
        FormatKind::General => "general",
        FormatKind::Number => "number",
        FormatKind::Currency => "currency",
        FormatKind::Accounting => "accounting",
        FormatKind::Date => "date",
        FormatKind::Time => "time",
        FormatKind::Percentage => "percentage",
        FormatKind::Fraction => "fraction",
        FormatKind::Scientific => "scientific",
        FormatKind::Text => "text",
        FormatKind::Special => "special",
        FormatKind::Custom => "custom",
    }
}

/// ISO 8601 text for a date-format cell whose section shows calendar parts, else `None`.
fn iso_for(fmt: &NumberFormat, n: f64, sys: DateSystem, shown: &str) -> Option<String> {
    let (calendar, clock) = fmt.date_shape(n)?;
    if !calendar || n < 0.0 || !n.is_finite() || shown.starts_with('#') { return None; }
    let dt = date::datetime_from_serial(sys, n)?;
    // Serial 0 ("1/0/1900") and the 1900 leap-year bug day (1900-02-29) have no real date.
    if dt.day < 1 || dt.month < 1 || dt.day > date::days_in_month(dt.year, dt.month) || !(0..=9999).contains(&dt.year) { return None; }
    let day = format!("{:04}-{:02}-{:02}", dt.year, dt.month, dt.day);
    Some(if clock { format!("{day}T{:02}:{:02}:{:02}", dt.hour, dt.minute, dt.second) } else { day })
}

fn format_batch(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let req: Request = serde_json::from_slice(bytes).map_err(|e| format!("Invalid request: {e}"))?;
    if req.cells.len() > MAX_CELLS { return Err("Too many cells in one batch".into()); }
    if req.formats.len() > MAX_FORMATS { return Err("Too many distinct format codes in one batch".into()); }
    if req.formats.iter().any(|c| c.len() > MAX_CODE_BYTES) { return Err("A format code is too long".into()); }
    date::set_now_ms(req.now);
    let formats: Vec<NumberFormat> = req.formats.iter().map(|c| NumberFormat::parse(c)).collect();
    let mut out: Vec<Formatted> = Vec::with_capacity(req.cells.len());
    let mut size = 2usize;
    for cell in &req.cells {
        let fmt = formats.get(cell.f).ok_or("Format index out of range")?;
        let sys = match cell.d { 1900 => DateSystem::D1900, 1904 => DateSystem::D1904, _ => return Err("Date system must be 1900 or 1904".into()) };
        let (value, number) = match &cell.v {
            CellValue::Number(n) if n.is_finite() => (Value::number(*n), Some(*n)),
            CellValue::Number(_) => return Err("Cell value must be finite".into()),
            CellValue::Text(t) if t.len() > MAX_TEXT_BYTES => return Err("Cell text is too long".into()),
            CellValue::Text(t) => (Value::text(t.as_str()), None),
        };
        let shown = format_value(&value, fmt, sys);
        let iso = number.and_then(|n| iso_for(fmt, n, sys, &shown.text));
        let k = if number.is_some() { kind_name(fmt.kind()) } else { "text" };
        size += shown.text.len() + 32 + iso.as_ref().map_or(0, String::len);
        if size > MAX_OUTPUT { return Err("Formatted output exceeds the byte budget".into()); }
        out.push(Formatted { t: shown.text, k, i: iso });
    }
    serde_json::to_vec(&out).map_err(|e| e.to_string())
}

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    if bytes.len() > MAX_INPUT { return Err("Request exceeds 16 MB".into()); }
    match op {
        OP_FORMAT_BATCH => format_batch(bytes),
        _ => Err("Unknown operation".into()),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn xlsx_numfmt_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn xlsx_numfmt_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn xlsx_numfmt_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s.inputs.get(&ptr).filter(|b| b.len() == length)
            .ok_or_else(|| "Invalid request buffer".to_string()).and_then(|b| dispatch(b, op));
        match result { Ok(out) => { s.output = out; 0 }, Err(e) => { s.output = e.into_bytes(); 1 } }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn xlsx_numfmt_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn xlsx_numfmt_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }

#[cfg(test)]
mod tests {
    use super::*;
    fn run(json: &str) -> serde_json::Value {
        serde_json::from_slice(&format_batch(json.as_bytes()).expect("ok")).expect("json")
    }
    #[test]
    fn dates_both_systems_and_iso() {
        let r = run(r#"{"formats":["yyyy-mm-dd","m/d/yyyy h:mm"],"cells":[{"v":45000,"f":0,"d":1900},{"v":45000,"f":0,"d":1904},{"v":45000.5,"f":1,"d":1900}]}"#);
        assert_eq!(r[0]["t"], "2023-03-15");
        assert_eq!(r[0]["i"], "2023-03-15");
        assert_eq!(r[1]["t"], "2027-03-16");
        assert_eq!(r[2]["i"], "2023-03-15T12:00:00");
        assert_eq!(r[0]["k"], "date");
    }
    #[test]
    fn rejects_bad_input() {
        assert!(format_batch(br#"{"formats":["0"],"cells":[{"v":1,"f":3,"d":1900}]}"#).is_err());
        assert!(format_batch(br#"{"formats":["0"],"cells":[{"v":1,"f":0,"d":1999}]}"#).is_err());
        assert!(format_batch(b"nope").is_err());
    }
    #[test]
    fn no_iso_for_fake_leap_day() {
        let r = run(r#"{"formats":["d-mmm-yy"],"cells":[{"v":60,"f":0,"d":1900},{"v":0,"f":0,"d":1900}]}"#);
        assert!(r[0].get("i").is_none() && r[1].get("i").is_none());
    }
}
