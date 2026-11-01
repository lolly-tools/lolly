// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the PDF accessibility checker taken from PdfCraft.
//!
//! The raw ABI is `pdf_a11y_alloc`, `_free`, `_run`, `_result_ptr` and `_result_len`. `_run`
//! takes an operation number so a later PDF operation can join this module instead of
//! shipping another. Operation 1 reads a PDF and returns the rule report as JSON. The module
//! reads only. It writes no PDF, tags nothing and fixes nothing, and it imports nothing from
//! the host.
#![deny(unsafe_op_in_unsafe_fn)]

use pdfcraft_a11y::{Options, Status, check_with_applicability};
use pdfcraft_cos::{CosError, Document};
use serde::Serialize;
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::sync::Arc;

const MAX_INPUT: usize = 256 * 1024 * 1024;
const MAX_OUTPUT: usize = 16 * 1024 * 1024;

const OP_CHECK: u32 = 1;

#[derive(Default)]
struct State {
    inputs: BTreeMap<usize, Vec<u8>>,
    output: Vec<u8>,
    allocated: usize,
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

#[derive(Serialize)]
struct WireFinding {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<usize>,
    message: String,
    pattern: &'static str,
    values: Vec<(&'static str, String)>,
    #[serde(skip_serializing_if = "Option::is_none")]
    object: Option<[u32; 2]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bbox: Option<[f64; 4]>,
}

#[derive(Serialize)]
struct WireRule {
    id: &'static str,
    category: &'static str,
    manual: bool,
    /// False when the rule had nothing to look at in this file (Passed then means nothing was wrong,
    /// not that something was checked).
    applies: bool,
    status: &'static str,
    findings: Vec<WireFinding>,
}

#[derive(Serialize)]
struct WireReport {
    v: u32,
    pages: usize,
    rules: Vec<WireRule>,
}

fn status_name(status: Status) -> &'static str {
    match status {
        Status::Passed => "passed",
        Status::Failed => "failed",
        Status::Manual => "manual",
        Status::Skipped => "skipped",
    }
}

fn open_error(error: &CosError) -> String {
    match error {
        CosError::NotPdf => "not-pdf: The file is not a PDF.".into(),
        CosError::NeedsPassword | CosError::WrongPassword => "encrypted: The PDF needs a password, so it was not checked.".into(),
        CosError::Security(detail) => format!("encrypted: The PDF uses security this check cannot open ({detail})."),
        other => format!("damaged: The PDF could not be read ({other})."),
    }
}

fn run_check(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let doc = Document::open(Arc::new(bytes.to_vec())).map_err(|e| open_error(&e))?;
    let (report, applies) = check_with_applicability(&doc, &Options::default());
    let rules: Vec<WireRule> = report
        .results
        .iter()
        .map(|result| WireRule {
            id: result.rule.id(),
            category: result.rule.category().label(),
            manual: result.rule.manual(),
            applies: applies.contains(&result.rule),
            status: status_name(result.status),
            findings: result
                .findings
                .iter()
                .map(|f| WireFinding {
                    page: f.page,
                    message: f.message.clone(),
                    pattern: f.pattern,
                    values: f.values.clone(),
                    object: f.object.map(|o| [o.num, u32::from(o.generation)]),
                    bbox: f.bbox,
                })
                .collect(),
        })
        .collect();
    let out = serde_json::to_vec(&WireReport { v: 1, pages: pdfcraft_a11y::page_count(&doc), rules }).map_err(|e| e.to_string())?;
    if out.len() > MAX_OUTPUT {
        return Err("damaged: The report is larger than the byte budget.".into());
    }
    Ok(out)
}

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    if bytes.len() > MAX_INPUT {
        return Err("damaged: The PDF exceeds the 256 MB input limit.".into());
    }
    match op {
        OP_CHECK => run_check(bytes),
        _ => Err("Unknown operation".into()),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn pdf_a11y_alloc(length: usize) -> usize {
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
pub extern "C" fn pdf_a11y_free(ptr: usize) {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if let Some(b) = s.inputs.remove(&ptr) {
            s.allocated -= b.len();
        }
    });
}
#[unsafe(no_mangle)]
pub extern "C" fn pdf_a11y_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = s.inputs.get(&ptr).filter(|b| b.len() == length).ok_or_else(|| "Invalid request buffer".to_string()).and_then(|b| dispatch(b, op));
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
pub extern "C" fn pdf_a11y_result_ptr() -> usize {
    STATE.with(|s| s.borrow().output.as_ptr() as usize)
}
#[unsafe(no_mangle)]
pub extern "C" fn pdf_a11y_result_len() -> usize {
    STATE.with(|s| s.borrow().output.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_pdf() -> Vec<u8> {
        let bodies = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>"];
        let mut out = b"%PDF-1.7\n".to_vec();
        let mut offsets = Vec::new();
        for (i, b) in bodies.iter().enumerate() {
            offsets.push(out.len());
            out.extend_from_slice(format!("{} 0 obj\n{b}\nendobj\n", i + 1).as_bytes());
        }
        let xref = out.len();
        out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", bodies.len() + 1).as_bytes());
        for o in offsets {
            out.extend_from_slice(format!("{o:010} 00000 n \n").as_bytes());
        }
        out.extend_from_slice(format!("trailer << /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n", bodies.len() + 1).as_bytes());
        out
    }

    #[test]
    fn reports_every_default_rule_for_an_untagged_page() {
        let json: serde_json::Value = serde_json::from_slice(&dispatch(&tiny_pdf(), OP_CHECK).expect("report")).expect("json");
        assert_eq!(json["pages"], 1);
        let rules = json["rules"].as_array().expect("rules");
        assert_eq!(rules.len(), 32);
        let status = |id: &str| rules.iter().find(|r| r["id"] == id).map(|r| r["status"].clone()).expect("rule");
        assert_eq!(status("tagged-pdf"), "failed");
        assert_eq!(status("logical-reading-order"), "manual");
        assert_eq!(status("color-contrast"), "skipped");
        let applies = |id: &str| rules.iter().find(|r| r["id"] == id).map(|r| r["applies"].clone()).expect("rule");
        assert_eq!(applies("tagged-pdf"), true);
        assert_eq!(applies("table-rows"), false);
        assert_eq!(applies("field-descriptions"), false);
    }

    #[test]
    fn refuses_what_is_not_a_pdf_and_unknown_operations() {
        assert!(dispatch(b"hello", OP_CHECK).expect_err("not a pdf").starts_with("not-pdf:"));
        assert!(dispatch(&tiny_pdf(), 9).is_err());
    }
}
