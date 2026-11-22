// SPDX-License-Identifier: MPL-2.0
//! `lolly-render`: a Lolly Design page drawn from its drawing operations (plan 371, M3b).
//!
//! The input is the engine's `DesignDrawPage` in a versioned JSON envelope
//! (`input.rs`). Admission (`admit.rs`) either accepts the page whole or returns every
//! reason it is refused, each with a stable code; nothing outside this slice is
//! dropped or approximated. The CPU path (`draw.rs`) draws an admitted page with
//! tiny-skia built without SIMD and with libm, so the same input gives the same pixels,
//! and the same PNG bytes (`png_out.rs`), on every machine.
//!
//! This crate is not a default render route anywhere: no shell calls it yet.

#![forbid(unsafe_code)]

pub mod admit;
mod blur;
mod draw;
mod geometry;
pub mod input;
mod path_data;
pub mod picture;
mod png_out;

pub use admit::{admit_json, Plan, Refusal, REFUSAL_CODES};

/// The renderer this crate records, after the drawing operations' own version.
pub const RENDERER: &str = concat!("lolly-render-", env!("CARGO_PKG_VERSION"), "+tiny-skia-0.12.0-scalar");

/// A drawn page.
pub struct Rendered {
    pub width: u32,
    pub height: u32,
    /// Straight (not premultiplied) RGBA8, row by row.
    pub rgba: Vec<u8>,
}

/// Admit and draw an input document, or return every reason it is refused.
pub fn render_json(bytes: &[u8]) -> Result<Rendered, Vec<Refusal>> {
    let plan = admit_json(bytes)?;
    render_plan(&plan)
}

/// Draw an admitted plan.
pub fn render_plan(plan: &Plan) -> Result<Rendered, Vec<Refusal>> {
    let Some(pixmap) = draw::draw(plan) else {
        return Err(vec![Refusal { code: "output-size", id: String::new(), detail: "the output could not be allocated".into() }]);
    };
    Ok(Rendered { width: pixmap.width(), height: pixmap.height(), rgba: draw::straight_rgba(&pixmap) })
}

/// A drawn page as a plain PNG, with a resolution chunk when the input gives a dpi.
pub fn render_png(bytes: &[u8]) -> Result<Vec<u8>, Vec<Refusal>> {
    let plan = admit_json(bytes)?;
    let drawn = render_plan(&plan)?;
    Ok(png_out::encode_rgba(&drawn.rgba, drawn.width, drawn.height, plan.dpi))
}

/// Straight RGBA8 rows as a plain PNG.
pub fn encode_png(rgba: &[u8], width: u32, height: u32, dpi: Option<f64>) -> Vec<u8> {
    png_out::encode_rgba(rgba, width, height, dpi)
}
