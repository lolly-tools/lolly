//! Lolly's trimmed copy of pdfcraft-edit. Redaction uses `stamp` (draw the boxes into a page) and
//! `flatten` (turn form fields into page content). The text editor, the added-content layer, the
//! image tools, the header, footer and watermark commands and the script shapers of the upstream
//! crate are not part of this copy. The rest of this header is upstream's description of how page
//! marks are stored.
//!
//! **How marks are stored.** Each mark is one content stream appended to (or, for content behind
//! the page, inserted after the backgrounds at the start of) the page's `/Contents`, drawn in
//! display space (after `/Rotate`) and wrapped in a marked-content artifact (§14.8.2.2) so
//! readers and screen readers skip it:
//! `/Artifact <</Type /Pagination /Subtype /Header /PCMark /HeaderFooter>> BDC … EMC`. The
//! `/PCMark` entry (also in the stream dictionary) names the kind of mark, which is how Update and
//! Remove find them again without decompressing page content. When
//! anything is drawn on top, the page's original content is wrapped in `q … Q` (two tiny streams)
//! so its graphics state cannot reach the mark. The closing stream also ends known unfinished
//! marked-content sequences before the new mark.
//!
//! Text uses standard Helvetica (WinAnsi) added to the page resources as `/PCHelv`; headers and
//! footers may use standard Times (`/PCTimes`) or Courier (`/PCCour`) instead (#3754).

#![allow(dead_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::unimplemented, clippy::todo, clippy::unreachable)]

use pdfcraft_cos::{Dict, Document, ObjRef, Object, Stream};
use pdfcraft_fonts::{literal, win_ansi};

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum EditError {
    /// Holds the 0-based index; the message names the 1-based page a user counts (#1550).
    #[error("page {} does not exist", .0.saturating_add(1))]
    NoSuchPage(usize),
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Cos(#[from] pdfcraft_cos::CosError),
}

pub type Rgb = [f64; 3];

mod flatten;
pub use flatten::{flatten, flatten_fill_sign};
mod marks;
mod place;

use marks::n;
use place::{check, page_list, place_tagged};
pub use place::{stamp, undrawable_message};

/// Redaction follows form XObjects this deep, the same limit upstream's text reader uses.
pub mod text {
    pub const MAX_FORM_DEPTH: usize = 50;
}
