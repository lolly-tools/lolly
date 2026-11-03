//! Lolly's trimmed copy of pdfcraft-xfa: XFA detection and removal only.
//!
//! Redaction needs two things from the XFA crate. One is to know whether a form is XFA, and the
//! other is to take the XFA packets out once redaction is applied, since they mirror the field
//! values that were just removed. The template parser, the layout engine, the scripting runtime
//! and the picture, image and data modules of the upstream crate are not part of this copy.
//! `xfa_shape`, `strip` and `drop_usage_rights` are upstream's code. `strip` no longer counts the
//! datasets that no field held, and it does not parse an XDP envelope to name its packets.

#![allow(dead_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::unimplemented, clippy::todo, clippy::unreachable)]

use pdfcraft_cos::{Dict, Document, ObjRef, Object};

mod strip;
pub use strip::{Stripped, XfaShape, strip, xfa_shape};

/// Private key on generated fields: the template's SOM path, so data can be put back.
pub const SOM_KEY: &[u8] = b"PCSom";
/// Private key on the AcroForm: what laying the form out produced.
pub const LAYOUT_KEY: &[u8] = b"PCXfaLayout";
/// Private key on generated push buttons whose template has a click script.
pub const CLICK_KEY: &[u8] = b"PCXfaClick";
/// Private key on the fields generated to name a signature field by its SOM path.
pub const NODE_KEY: &[u8] = b"PCXfaNode";
/// On a push button generated for an XFA image field.
pub const IMAGE_FIELD_KEY: &[u8] = b"PCXfaImage";
/// The AcroForm key that held the script overrides of a laid-out form.
pub const OVERRIDES_KEY: &[u8] = b"PCXfaOverrides";

#[derive(Debug, thiserror::Error)]
pub enum XfaError {
    #[error("{0}")]
    Cos(#[from] pdfcraft_cos::CosError),
}
