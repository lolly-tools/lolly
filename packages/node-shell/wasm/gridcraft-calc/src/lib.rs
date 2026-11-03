// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned GridCraft calculation engine.
//!
//! The raw ABI is `gridcraft_calc_alloc`, `_free`, `_run`, `_result_ptr` and `_result_len`.
//! `_run` takes an operation number. Operation 1 recalculates a set of sheets, operation 2
//! lists the function library. The module imports nothing from the host. The only inputs
//! that vary with time or chance are the request's `now` (milliseconds since the Unix epoch)
//! and `seed`, so the same request always produces the same bytes.
#![deny(unsafe_op_in_unsafe_fn)]

use gridcraft_calc::Calc;
use gridcraft_core::{CellError, CellRef, Value, date};
use gridcraft_model::{Cell, Formula, Sheet, Workbook};
use serde::Deserialize;
use serde_json::{Map, Number, Value as Json, json};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::sync::Arc;

const MAX_INPUT: usize = 16 * 1024 * 1024;
const MAX_OUTPUT: usize = 32 * 1024 * 1024;
const MAX_SHEETS: usize = 64;
const MAX_CELLS: usize = 400_000;
const MAX_FORMULAS: usize = 100_000;
const MAX_TEXT_BYTES: usize = 32 * 1024;
const MAX_FORMULA_CHARS: usize = 8192;
const MAX_NAME_CHARS: usize = 31;

const OP_EVALUATE: u32 = 1;
const OP_FUNCTIONS: u32 = 2;

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

#[derive(Deserialize)]
struct Request {
    #[serde(default)]
    now: Option<f64>,
    #[serde(default)]
    seed: Option<u64>,
    #[serde(default)]
    date1904: bool,
    sheets: Vec<SheetIn>,
}

#[derive(Deserialize)]
struct SheetIn { name: String, cells: Vec<CellIn> }

/// One cell: 0-based `r` and `c`, a constant `v` (number, text, boolean, `{"e":"#N/A"}` or null),
/// and an optional formula `f` without its leading `=`.
#[derive(Deserialize)]
struct CellIn {
    r: u32,
    c: u32,
    #[serde(default)]
    v: Json,
    #[serde(default)]
    f: Option<String>,
    /// The formula was saved by a program without dynamic arrays: see [`legacy`].
    #[serde(default)]
    l: bool,
}

fn value_in(v: &Json) -> Result<Value, String> {
    Ok(match v {
        Json::Null => Value::Empty,
        Json::Bool(b) => Value::Bool(*b),
        Json::Number(n) => match n.as_f64() { Some(x) if x.is_finite() => Value::number(x), _ => return Err("Cell value must be finite".into()) },
        Json::String(s) if s.len() > MAX_TEXT_BYTES => return Err("Cell text is too long".into()),
        Json::String(s) => Value::text(s.as_str()),
        Json::Object(o) => match o.get("e").and_then(Json::as_str).and_then(CellError::parse) {
            Some(e) => Value::Error(e),
            None => return Err("Cell value object must be an error such as {\"e\":\"#N/A\"}".into()),
        },
        Json::Array(_) => return Err("Cell value cannot be a list".into()),
    })
}

fn value_out(v: &Value) -> Json {
    match v {
        Value::Empty => Json::Null,
        Value::Number(n) => Number::from_f64(*n).map_or(Json::Null, Json::Number),
        Value::Text(t) => Json::String(t.to_string()),
        Value::Bool(b) => Json::Bool(*b),
        Value::Error(e) => json!({ "e": e.as_str() }),
        Value::Array(a) => a.data.first().map_or(Json::Null, value_out),
    }
}

/// Function names whose result changes between calculations, plus the reference functions Excel
/// also treats as volatile.
fn is_volatile_name(name: &str) -> bool {
    matches!(name, "OFFSET" | "INDIRECT" | "INFO" | "CELL") || gridcraft_functions::lookup(name).is_some_and(|f| f.volatile)
}

/// Rewrites a formula the way Excel reads one saved before dynamic arrays: wherever one value is
/// wanted and a range is given (an operand, a scalar function argument, the result), the range
/// is cut down to the cell in the formula's own row or column with `@`. The formula then never
/// spills, and reads the same as it did in the program that saved it.
fn legacy(expr: gridcraft_formula::Expr) -> gridcraft_formula::Expr {
    use gridcraft_formula::{BinOp, Expr, UnOp};
    fn at(e: Expr) -> Expr {
        match e {
            Expr::Ref(_) | Expr::Name(_) | Expr::Struct(_) => Expr::Unary(UnOp::At, Box::new(e)),
            Expr::Paren(inner) => Expr::Paren(Box::new(at(*inner))),
            other => other,
        }
    }
    let inner = expr.map(&mut |x| match x {
        Expr::Binary(op, a, b) if !matches!(op, BinOp::Range | BinOp::Union | BinOp::Intersect) => Expr::Binary(op, Box::new(at(*a)), Box::new(at(*b))),
        Expr::Unary(op @ (UnOp::Neg | UnOp::Plus | UnOp::Percent), x) => Expr::Unary(op, Box::new(at(*x))),
        Expr::Call(name, args) => {
            let spec = gridcraft_functions::lookup(&name);
            let args = args.into_iter().enumerate().map(|(i, a)| if spec.is_some_and(|s| s.is_scalar_arg(i)) { at(a) } else { a }).collect();
            Expr::Call(name, args)
        }
        other => other,
    });
    Expr::Unary(UnOp::At, Box::new(inner))
}

fn uses_volatile(expr: &gridcraft_formula::Expr) -> bool {
    let mut found = false;
    expr.walk(&mut |e| { if let gridcraft_formula::Expr::Call(name, _) = e && is_volatile_name(name) { found = true; } });
    found
}

fn evaluate(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let req: Request = serde_json::from_slice(bytes).map_err(|e| format!("Invalid request: {e}"))?;
    if req.sheets.is_empty() || req.sheets.len() > MAX_SHEETS { return Err("A request needs between 1 and 64 sheets".into()); }
    let total: usize = req.sheets.iter().map(|s| s.cells.len()).sum();
    if total > MAX_CELLS { return Err("Too many cells in one request".into()); }
    if req.sheets.iter().map(|s| s.cells.iter().filter(|c| c.f.is_some()).count()).sum::<usize>() > MAX_FORMULAS { return Err("Too many formulas in one request".into()); }
    let mut seen: Vec<String> = Vec::new();
    for s in &req.sheets {
        let lower = s.name.to_lowercase();
        if s.name.is_empty() || s.name.chars().count() > MAX_NAME_CHARS || s.name.contains(['\\', '/', '?', '*', '[', ']', ':']) { return Err("A sheet name is not valid".into()); }
        if seen.contains(&lower) { return Err("Two sheets share a name".into()); }
        seen.push(lower);
    }
    date::set_now_ms(req.now);
    let mut wb = Workbook::new();
    if req.date1904 { wb.date_system = date::DateSystem::D1904; }
    wb.sheets = req.sheets.iter().map(|s| Arc::new(Sheet::new(s.name.as_str()))).collect();
    let mut bad: BTreeMap<(usize, u32, u32), String> = BTreeMap::new();
    let mut direct_volatile: BTreeMap<(usize, u32, u32), bool> = BTreeMap::new();
    let mut volatile = false;
    for (si, s) in req.sheets.iter().enumerate() {
        for c in &s.cells {
            let at = CellRef::new(c.r, c.c);
            if !at.is_valid() { return Err("A cell address is outside the sheet".into()); }
            let cell = match &c.f {
                Some(f) => {
                    if f.chars().count() > MAX_FORMULA_CHARS { return Err("A formula is too long".into()); }
                    let body = f.strip_prefix('=').unwrap_or(f);
                    match gridcraft_formula::parse(body) {
                        Ok(expr) => {
                            let v = uses_volatile(&expr);
                            volatile |= v;
                            direct_volatile.insert((si, c.r, c.c), v);
                            Cell::formula(Formula::from_expr(if c.l { legacy(expr) } else { expr }))
                        }
                        Err(e) => {
                            bad.insert((si, c.r, c.c), e.to_string());
                            Cell::value(Value::Error(CellError::Name))
                        }
                    }
                }
                None => Cell::value(value_in(&c.v)?),
            };
            if let Some(sheet) = wb.sheet_mut(si) { sheet.set_cell(at, cell); }
        }
    }
    let mut calc = Calc::new();
    calc.set_seed(req.seed.unwrap_or(0));
    calc.recalc_all(&mut wb);

    let mut sheets_out = Vec::with_capacity(req.sheets.len());
    let mut size = 64usize;
    for (si, s) in req.sheets.iter().enumerate() {
        let Some(sheet) = wb.sheet(si) else { continue };
        let mut cells: Vec<Json> = Vec::new();
        let mut seen_at: std::collections::BTreeSet<(u32, u32)> = std::collections::BTreeSet::new();
        for c in s.cells.iter().filter(|c| c.f.is_some()) {
            let mut o = Map::new();
            o.insert("r".into(), c.r.into());
            o.insert("c".into(), c.c.into());
            if let Some(msg) = bad.get(&(si, c.r, c.c)) {
                o.insert("v".into(), json!({ "e": CellError::Name.as_str() }));
                o.insert("bad".into(), Json::String(msg.clone()));
            } else {
                o.insert("v".into(), value_out(&sheet.value(CellRef::new(c.r, c.c))));
                if direct_volatile.get(&(si, c.r, c.c)).copied().unwrap_or(false) { o.insert("vol".into(), Json::Bool(true)); }
            }
            seen_at.insert((c.r, c.c));
            size += 48;
            cells.push(Json::Object(o));
        }
        // Cells a dynamic-array formula spilled into.
        for (anchor, range) in &sheet.spill_ranges {
            for at in range.iter().filter(|a| a != anchor) {
                if seen_at.insert((at.row, at.col)) {
                    let mut o = Map::new();
                    o.insert("r".into(), at.row.into());
                    o.insert("c".into(), at.col.into());
                    o.insert("v".into(), value_out(&sheet.value(at)));
                    o.insert("spill".into(), Json::Bool(true));
                    size += 48;
                    cells.push(Json::Object(o));
                }
            }
        }
        if size > MAX_OUTPUT { return Err("Calculated output exceeds the byte budget".into()); }
        sheets_out.push(json!({ "cells": cells }));
    }
    let out = json!({ "sheets": sheets_out, "volatile": volatile, "circular": calc.circular.len() });
    serde_json::to_vec(&out).map_err(|e| e.to_string())
}

fn functions() -> Result<Vec<u8>, String> {
    let list: Vec<Json> = gridcraft_functions::all().iter().map(|f| {
        let mut o = Map::new();
        o.insert("name".into(), f.name.into());
        o.insert("min".into(), f.min_args.into());
        if f.max_args != usize::MAX { o.insert("max".into(), f.max_args.into()); }
        o.insert("category".into(), format!("{:?}", f.category).into());
        if f.volatile || is_volatile_name(f.name) { o.insert("volatile".into(), Json::Bool(true)); }
        Json::Object(o)
    }).chain(gridcraft_calc::SPECIAL_FUNCTIONS.iter().filter(|name| gridcraft_functions::lookup(name).is_none()).map(|name| {
        // Functions the evaluator implements itself, such as IF, LET and OFFSET: any number of arguments as far as this list knows.
        let mut o = Map::new();
        o.insert("name".into(), (*name).into());
        o.insert("min".into(), 0.into());
        o.insert("category".into(), "Special".into());
        if is_volatile_name(name) { o.insert("volatile".into(), Json::Bool(true)); }
        Json::Object(o)
    })).collect();
    serde_json::to_vec(&list).map_err(|e| e.to_string())
}

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    if bytes.len() > MAX_INPUT { return Err("Request exceeds 16 MB".into()); }
    match op {
        OP_EVALUATE => evaluate(bytes),
        OP_FUNCTIONS => functions(),
        _ => Err("Unknown operation".into()),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn gridcraft_calc_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn gridcraft_calc_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn gridcraft_calc_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s.inputs.get(&ptr).filter(|b| b.len() == length)
            .ok_or_else(|| "Invalid request buffer".to_string()).and_then(|b| dispatch(b, op));
        match result { Ok(out) => { s.output = out; 0 }, Err(e) => { s.output = e.into_bytes(); 1 } }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn gridcraft_calc_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn gridcraft_calc_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }

#[cfg(test)]
mod tests {
    use super::*;

    /// The injected clock is process-wide, so tests that set it take turns.
    static TURN: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn run(req: Json, op: u32) -> Json {
        let _turn = TURN.lock().unwrap_or_else(|e| e.into_inner());
        let bytes = serde_json::to_vec(&req).unwrap();
        serde_json::from_slice(&dispatch(&bytes, op).unwrap()).unwrap()
    }
    fn cell(out: &Json, sheet: usize, r: u32, c: u32) -> Json {
        out["sheets"][sheet]["cells"].as_array().unwrap().iter().find(|x| x["r"] == r && x["c"] == c).unwrap()["v"].clone()
    }

    #[test]
    fn sums_and_cross_sheet_references() {
        let out = run(json!({ "sheets": [
            { "name": "A", "cells": [{ "r": 0, "c": 0, "v": 2 }, { "r": 1, "c": 0, "v": 3 }, { "r": 2, "c": 0, "f": "SUM(A1:A2)" }] },
            { "name": "B", "cells": [{ "r": 0, "c": 0, "f": "A!A3*2" }] },
        ]}), OP_EVALUATE);
        assert_eq!(cell(&out, 0, 2, 0), json!(5.0));
        assert_eq!(cell(&out, 1, 0, 0), json!(10.0));
    }

    #[test]
    fn clock_and_seed_are_injected() {
        let req = |now: f64, seed: u64| json!({ "now": now, "seed": seed, "sheets": [{ "name": "S", "cells": [
            { "r": 0, "c": 0, "f": "NOW()" }, { "r": 1, "c": 0, "f": "RAND()" }, { "r": 2, "c": 0, "f": "RANDBETWEEN(1,1000000)" },
        ]}]});
        let a = run(req(1_700_000_000_000.0, 7), OP_EVALUATE);
        let b = run(req(1_700_000_000_000.0, 7), OP_EVALUATE);
        let c = run(req(1_700_000_060_000.0, 8), OP_EVALUATE);
        assert_eq!(a, b);
        assert_ne!(cell(&a, 0, 0, 0), cell(&c, 0, 0, 0));
        assert_ne!(cell(&a, 0, 1, 0), cell(&c, 0, 1, 0));
        assert_eq!(a["volatile"], json!(true));
        assert_eq!(a["sheets"][0]["cells"][0]["vol"], json!(true));
    }

    #[test]
    fn legacy_formulas_intersect_instead_of_spilling() {
        let cells = |l: bool| json!({ "sheets": [{ "name": "S", "cells": [
            { "r": 0, "c": 0, "v": 1 }, { "r": 1, "c": 0, "v": 2 }, { "r": 2, "c": 0, "v": 3 },
            { "r": 1, "c": 1, "f": "A1:A3", "l": l }, { "r": 1, "c": 2, "f": "A1:A3*10", "l": l }, { "r": 1, "c": 3, "f": "SUM(A1:A3)", "l": l },
        ]}]});
        let dynamic = run(cells(false), OP_EVALUATE);
        let old = run(cells(true), OP_EVALUATE);
        assert_eq!(cell(&old, 0, 1, 1), json!(2.0));
        assert_eq!(cell(&old, 0, 1, 2), json!(20.0));
        assert_eq!(cell(&old, 0, 1, 3), json!(6.0));
        assert_eq!(cell(&dynamic, 0, 1, 1), json!(1.0), "a dynamic formula starts its spill at the top of the range");
        assert!(old["sheets"][0]["cells"].as_array().unwrap().iter().all(|c| c["spill"].is_null()));
    }

    #[test]
    fn malformed_formula_is_reported_per_cell() {
        let out = run(json!({ "sheets": [{ "name": "S", "cells": [{ "r": 0, "c": 0, "f": "SUM(1," }, { "r": 1, "c": 0, "f": "1+1" }] }] }), OP_EVALUATE);
        assert!(out["sheets"][0]["cells"][0]["bad"].is_string());
        assert_eq!(cell(&out, 0, 1, 0), json!(2.0));
    }

    #[test]
    fn requests_are_refused_cleanly() {
        for bad in [json!({ "sheets": [] }), json!({ "sheets": [{ "name": "a/b", "cells": [] }] }), json!({ "sheets": [{ "name": "S", "cells": [{ "r": 2000000, "c": 0, "v": 1 }] }] }),
            json!({ "sheets": [{ "name": "S", "cells": [{ "r": 0, "c": 0, "v": [1] }] }] })] {
            assert!(dispatch(&serde_json::to_vec(&bad).unwrap(), OP_EVALUATE).is_err());
        }
        assert!(dispatch(b"not json", OP_EVALUATE).is_err());
        assert!(dispatch(b"{}", 99).is_err());
    }

    #[test]
    fn function_library_is_listed() {
        let list = run(json!({}), OP_FUNCTIONS);
        assert!(list.as_array().unwrap().len() > 400);
    }
}
