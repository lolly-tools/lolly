// SPDX-License-Identifier: MPL-2.0
//! Portable float64 scalar maths for the TypeScript geometry.
//!
//! Each export calls the pinned toolchain's own float64 function, the same code the
//! portable fitting artifact links. The module imports nothing from its host, so
//! every JavaScript engine that loads these bytes computes the same bits.

#[no_mangle]
pub extern "C" fn math_sin(x: f64) -> f64 {
    x.sin()
}
#[no_mangle]
pub extern "C" fn math_cos(x: f64) -> f64 {
    x.cos()
}
#[no_mangle]
pub extern "C" fn math_tan(x: f64) -> f64 {
    x.tan()
}
#[no_mangle]
pub extern "C" fn math_acos(x: f64) -> f64 {
    x.acos()
}
#[no_mangle]
pub extern "C" fn math_cbrt(x: f64) -> f64 {
    x.cbrt()
}
#[no_mangle]
pub extern "C" fn math_log2(x: f64) -> f64 {
    x.log2()
}
#[no_mangle]
pub extern "C" fn math_pow(x: f64, y: f64) -> f64 {
    x.powf(y)
}
/// Two arguments in the JavaScript order, `Math.atan2(y, x)`.
#[no_mangle]
pub extern "C" fn math_atan2(y: f64, x: f64) -> f64 {
    y.atan2(x)
}
