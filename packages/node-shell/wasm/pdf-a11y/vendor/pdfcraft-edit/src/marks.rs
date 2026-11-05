//! The page-mark kinds `place` tags streams with, and the number formatters it writes with.
//! The mark settings, token expansion and drawing of upstream's `marks.rs` are not part of this copy.

use super::Object;

/// The kinds of page marks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarkKind {
    HeaderFooter,
    Watermark,
    Background,
}

impl MarkKind {
    pub(crate) fn tag(self) -> &'static str {
        match self {
            MarkKind::HeaderFooter => "HeaderFooter",
            MarkKind::Watermark => "Watermark",
            MarkKind::Background => "Background",
        }
    }
}

pub(crate) fn matrix_number(value: f64) -> String {
    let mut bytes = Vec::new();
    pdfcraft_cos::serialize(&Object::Real(value), &mut bytes);
    String::from_utf8_lossy(&bytes).into_owned()
}

pub(crate) fn n(v: f64) -> String {
    let s = format!("{:.3}", if v.abs() < 5e-4 { 0.0 } else { v });
    let s = s.trim_end_matches('0').trim_end_matches('.');
    if s == "-0" { "0".into() } else { s.into() }
}
