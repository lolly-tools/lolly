// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to two PdfCraft operations on a PDF.
//!
//! The raw ABI is `pdf_a11y_alloc`, `_free`, `_run`, `_result_ptr` and `_result_len`. `_run`
//! takes an operation number. Operation 1 reads a PDF and returns the accessibility rule report
//! as JSON; it reads only. Operation 2 removes the text, images and vector content under boxes
//! and returns a rewritten PDF with the boxes burned in. The module imports nothing from the host.
#![deny(unsafe_op_in_unsafe_fn)]

use pdfcraft_a11y::{Options, Status, check_with_applicability};
use pdfcraft_cos::{CosError, Dict, Document, Object, PdfString, SaveOptions};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::sync::Arc;

const MAX_INPUT: usize = 256 * 1024 * 1024;
const MAX_OUTPUT: usize = 16 * 1024 * 1024;

const OP_CHECK: u32 = 1;
const OP_REDACT: u32 = 2;
/// Most boxes one request may carry.
const MAX_BARS: usize = 10_000;

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

#[derive(Deserialize)]
struct WireBar {
    /// 1-based page number.
    page: u32,
    /// Left edge in points from the left of the MediaBox.
    x: f64,
    /// Top edge in points from the top of the MediaBox.
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Deserialize)]
struct RedactRequest {
    bars: Vec<WireBar>,
    /// Box colour, three numbers from 0 to 1.
    #[serde(default)]
    fill: Option<[f64; 3]>,
    /// Text drawn on each box. Standard-font characters only.
    #[serde(default)]
    label: String,
    /// Label colour, three numbers from 0 to 1.
    #[serde(default)]
    label_color: Option<[f64; 3]>,
    /// Remove metadata, attachments and other applications' private data as well.
    #[serde(default)]
    sanitize: bool,
}

#[derive(Serialize)]
struct RedactReport {
    v: u32,
    marks: usize,
    pages: usize,
    glyphs: usize,
    images_removed: usize,
    images_cleared: usize,
    paths_removed: usize,
    paths_clipped: usize,
    forms_rewritten: usize,
    forms_removed: usize,
    annotations: usize,
    fields: usize,
    tags: usize,
    xfa_removed: bool,
    sanitized: Vec<(&'static str, usize)>,
}

fn refusal(error: &impl std::fmt::Display) -> String {
    format!("refused: {error}")
}

/// A request is a 4-byte little-endian length, that many bytes of JSON, then the PDF.
fn split_request(bytes: &[u8]) -> Result<(&[u8], &[u8]), String> {
    let head: [u8; 4] = bytes.get(..4).and_then(|h| h.try_into().ok()).ok_or("bad-request: The request is too short.")?;
    let len = u32::from_le_bytes(head) as usize;
    let json = bytes.get(4..4 + len).ok_or("bad-request: The request header is cut short.")?;
    Ok((json, &bytes[4 + len..]))
}

fn rect_of(doc: &Document, page: &pdfcraft_model::Page) -> Option<[f64; 4]> {
    let v: Vec<f64> = doc.resolve(page.dict.get(b"MediaBox")?).as_array()?.iter().filter_map(|x| doc.resolve(x).as_f64()).collect();
    (v.len() == 4 && v.iter().all(|x| x.is_finite())).then(|| [v[0].min(v[2]), v[1].min(v[3]), v[0].max(v[2]), v[1].max(v[3])])
}

fn reals(values: &[f64]) -> Object {
    Object::Array(values.iter().map(|v| Object::Real(*v)).collect())
}

/// Add one Redact annotation, the mark `pdfcraft_redact::apply` turns into a burned box.
fn add_mark(doc: &mut Document, page: &pdfcraft_model::Page, rect: [f64; 4], fill: [f64; 3], label: &str, label_color: [f64; 3]) -> Result<(), String> {
    let [x0, y0, x1, y1] = rect;
    let mut mark = Dict::new();
    mark.set(b"Type".to_vec(), Object::name("Annot"));
    mark.set(b"Subtype".to_vec(), Object::name("Redact"));
    mark.set(b"Rect".to_vec(), reals(&rect));
    // Acrobat's quad order: top-left, top-right, bottom-left, bottom-right.
    mark.set(b"QuadPoints".to_vec(), reals(&[x0, y1, x1, y1, x0, y0, x1, y0]));
    mark.set(b"IC".to_vec(), reals(&fill));
    mark.set(b"C".to_vec(), reals(&fill));
    mark.set(b"F".to_vec(), Object::Int(4));
    mark.set(b"P".to_vec(), Object::Ref(page.obj));
    if !label.is_empty() {
        mark.set(b"OverlayText".to_vec(), PdfString::text(label));
        let [r, g, b] = label_color;
        mark.set(b"DA".to_vec(), PdfString::literal(format!("{r:.3} {g:.3} {b:.3} rg /Helv 0 Tf").into_bytes()));
        mark.set(b"Q".to_vec(), Object::Int(1));
    }
    let added = doc.add(Object::Dict(mark));
    let mut annots = doc.get(page.obj).as_dict().and_then(|d| d.get(b"Annots")).map(|a| doc.resolve(a)).and_then(|a| a.as_array().cloned()).unwrap_or_default();
    annots.push(Object::Ref(added));
    doc.update_dict(page.obj, |d| d.set(b"Annots".to_vec(), Object::Array(annots))).map_err(|e| refusal(&e))
}

fn run_redact(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let (json, pdf) = split_request(bytes)?;
    let request: RedactRequest = serde_json::from_slice(json).map_err(|e| format!("bad-request: {e}"))?;
    if request.bars.is_empty() {
        return Err("bad-request: There is nothing to remove, because no boxes were given.".into());
    }
    if request.bars.len() > MAX_BARS {
        return Err("bad-request: There are too many boxes in one request.".into());
    }
    let mut doc = Document::open(Arc::new(pdf.to_vec())).map_err(|e| open_error(&e))?;
    let pages = pdfcraft_model::pages(&doc);
    let fill = request.fill.unwrap_or([0.08, 0.09, 0.10]).map(|c| c.clamp(0.0, 1.0));
    let label_color = request.label_color.unwrap_or([1.0, 1.0, 1.0]).map(|c| c.clamp(0.0, 1.0));
    let label: String = request.label.chars().take(24).collect();
    for bar in &request.bars {
        let index = usize::try_from(bar.page).ok().and_then(|p| p.checked_sub(1)).filter(|p| *p < pages.len());
        let Some(index) = index else { return Err(format!("bad-request: A box names page {}, which this PDF does not have.", bar.page)) };
        if ![bar.x, bar.y, bar.w, bar.h].iter().all(|v| v.is_finite()) || bar.w <= 0.0 || bar.h <= 0.0 {
            return Err("bad-request: A box has no usable size.".into());
        }
        // Boxes are measured from the top-left of the MediaBox, which is how the page preview is drawn.
        let media = rect_of(&doc, &pages[index]).unwrap_or([0.0, 0.0, 612.0, 792.0]);
        let rect = [media[0] + bar.x, media[3] - bar.y - bar.h, media[0] + bar.x + bar.w, media[3] - bar.y];
        add_mark(&mut doc, &pages[index], rect, fill, &label, label_color)?;
    }
    let report = pdfcraft_redact::apply(&mut doc, None).map_err(|e| refusal(&e))?;
    let mut sanitized = Vec::new();
    if request.sanitize {
        use pdfcraft_redact::sanitize::{Hidden, remove_hidden};
        match remove_hidden(&mut doc, &[Hidden::Metadata, Hidden::Attachments, Hidden::PrivateData]) {
            Ok(done) => sanitized = done.into_iter().map(|(h, n)| (h.id(), n)).collect(),
            Err(pdfcraft_redact::RedactError::NothingToApply) => {}
            Err(e) => return Err(refusal(&e)),
        }
    }
    // A full rewrite, so nothing from an earlier revision or an unreachable object stays in the file.
    doc.require_full_save();
    let out = pdfcraft_cos::write_full(&doc, &SaveOptions::default()).map_err(|e| refusal(&e))?;
    let summary = RedactReport {
        v: 1,
        marks: report.marks,
        pages: report.pages,
        glyphs: report.glyphs,
        images_removed: report.images_removed,
        images_cleared: report.images_cleared,
        paths_removed: report.paths_removed,
        paths_clipped: report.paths_clipped,
        forms_rewritten: report.forms_rewritten,
        forms_removed: report.forms_removed,
        annotations: report.annotations,
        fields: report.fields,
        tags: report.tags,
        xfa_removed: report.xfa_removed,
        sanitized,
    };
    let head = serde_json::to_vec(&summary).map_err(|e| e.to_string())?;
    let mut framed = Vec::with_capacity(4 + head.len() + out.len());
    framed.extend_from_slice(&u32::try_from(head.len()).map_err(|e| e.to_string())?.to_le_bytes());
    framed.extend_from_slice(&head);
    framed.extend_from_slice(&out);
    Ok(framed)
}

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    if bytes.len() > MAX_INPUT {
        return Err("damaged: The PDF exceeds the 256 MB input limit.".into());
    }
    match op {
        OP_CHECK => run_check(bytes),
        OP_REDACT => run_redact(bytes),
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
