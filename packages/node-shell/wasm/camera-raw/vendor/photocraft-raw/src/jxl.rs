//! JPEG XL-compressed DNG tiles and strips (Adobe DNG Specification 1.7, Compression 52546).
//!
//! Lolly's build leaves the JPEG XL decoder out. Upstream decodes these segments with the
//! native `jxl-oxide` crate and already reports them as unsupported on wasm32; this copy takes
//! that unsupported path on every target, so the dependency is not vendored.

use crate::Limits;
use crate::error::{RawError, Result};

pub(crate) fn decode(_src: &[u8], _w: usize, _h: usize, _samples: usize, _bits: u32, _float_scale: Option<f32>, _limits: &Limits) -> Result<Vec<u16>> {
    Err(RawError::unsupported("JPEG XL-compressed DNG (DNG 1.7) is not supported; export the file as a lossless or Deflate DNG"))
}
