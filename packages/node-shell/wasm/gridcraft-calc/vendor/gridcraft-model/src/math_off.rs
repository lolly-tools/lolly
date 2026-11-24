//! Lolly change: this file stands in for the `gridcraft-math` crate, which this copy does not
//! carry. Upstream lays equations out with RaTeX, which brings twenty more crates. Lolly's module
//! evaluates formulas and never draws a shape, so here an equation is never laid out: `layout`
//! always answers with an error, and `EquationCache` keeps that answer like any other.
//! The names and types match the part of `gridcraft-math` that this crate reads.
#![allow(dead_code)]

use std::ops::Range;

/// Longest equation source, in bytes, as in `gridcraft-math`.
pub const MAX_SOURCE_BYTES: usize = 4096;

/// The answer for a source over [`MAX_SOURCE_BYTES`], worded as in `gridcraft-math`.
pub static SOURCE_TOO_LONG: std::sync::LazyLock<MathError> =
    std::sync::LazyLock::new(|| MathError { span: None, message: format!("An equation can be at most {MAX_SOURCE_BYTES} bytes long.") });

/// Why an equation could not be laid out.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MathError {
    pub span: Option<Range<usize>>,
    pub message: String,
}

/// A laid-out equation. This copy never makes one.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct MathList {
    pub items: Vec<Item>,
}

/// Upstream also has `Path`; a rule here carries no geometry because nothing is ever drawn.
#[derive(Clone, Debug, PartialEq)]
pub enum Item {
    Glyph(Glyph),
    Rule,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Glyph {
    pub ch: char,
}

/// Always an error: equations are not laid out in this copy.
pub fn layout(latex: &str) -> Result<MathList, MathError> {
    if latex.len() > MAX_SOURCE_BYTES {
        return Err(SOURCE_TOO_LONG.clone());
    }
    Err(MathError { span: None, message: "Equations are not laid out in this copy of GridCraft.".to_string() })
}
