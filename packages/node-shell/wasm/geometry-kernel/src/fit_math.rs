// SPDX-License-Identifier: MPL-2.0
//! Scalar fitting maths from the pinned toolchain, with no host imports.
//!
//! The engine's TypeScript geometry calls the same compiled functions through
//! `packages/node-shell/wasm/portable-math`, so the two implementations give the
//! same bits in every JavaScript engine.

pub fn sin(x: f64) -> f64 {
    x.sin()
}
pub fn cos(x: f64) -> f64 {
    x.cos()
}
pub fn acos(x: f64) -> f64 {
    x.acos()
}
pub fn cbrt(x: f64) -> f64 {
    x.cbrt()
}
pub fn atan2(y: f64, x: f64) -> f64 {
    y.atan2(x)
}

// Qualification exports call the same functions, so tests can compare them with the engine module.
macro_rules! export_scalar {
    ($export:ident, $name:ident) => {
        #[allow(unsafe_code)] // Exported symbol name only; scalar arithmetic owns no memory.
        #[no_mangle]
        pub extern "C" fn $export(x: f64) -> f64 {
            $name(x)
        }
    };
}
export_scalar!(geom_math_sin, sin);
export_scalar!(geom_math_cos, cos);
export_scalar!(geom_math_acos, acos);
export_scalar!(geom_math_cbrt, cbrt);
#[allow(unsafe_code)] // Exported symbol name only; no pointers or callbacks.
#[no_mangle]
pub extern "C" fn geom_math_atan2(y: f64, x: f64) -> f64 {
    atan2(y, x)
}

// The fitter's angles give s in [-1,1]. Preserve JS half-tie rounding and signed zero.
pub fn mod2pi(th: f64) -> f64 {
    let s = th * (0.5 / std::f64::consts::PI);
    let floor = s.floor();
    let rounded = if s >= -0.5 && s < 0.0 {
        -0.0
    } else if s - floor < 0.5 {
        floor
    } else {
        floor + 1.0
    };
    2.0 * std::f64::consts::PI * (s - rounded)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn angle_half_ties_follow_javascript_rounding() {
        assert_eq!(mod2pi(std::f64::consts::PI), -std::f64::consts::PI);
        assert_eq!(mod2pi(-std::f64::consts::PI), -std::f64::consts::PI);
        assert_eq!(mod2pi(-0.0).to_bits(), 0.0_f64.to_bits());
    }
}
