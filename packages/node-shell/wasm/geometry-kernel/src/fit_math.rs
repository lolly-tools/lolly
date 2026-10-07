// SPDX-License-Identifier: MPL-2.0
//! Scalar fitting maths: host-reference imports or the pinned WASM toolchain implementation.

#[cfg(all(target_arch = "wasm32", not(feature = "portable-math")))]
#[allow(unsafe_code)] // WASM calls only these typed scalar imports; no pointers cross them.
mod host {
    #[link(wasm_import_module = "lolly_math")]
    extern "C" {
        pub fn sin(x: f64) -> f64;
        pub fn cos(x: f64) -> f64;
        pub fn acos(x: f64) -> f64;
        pub fn cbrt(x: f64) -> f64;
        pub fn atan2(y: f64, x: f64) -> f64;
    }
}
macro_rules! scalar {
    ($name:ident) => {
        pub fn $name(x: f64) -> f64 {
            #[cfg(all(target_arch = "wasm32", not(feature = "portable-math")))]
            #[allow(unsafe_code)] // Scalar call to the fixed pure host mathematics interface.
            unsafe {
                host::$name(x)
            }
            #[cfg(any(not(target_arch = "wasm32"), feature = "portable-math"))]
            {
                x.$name()
            }
        }
    };
}
scalar!(sin);
scalar!(cos);
scalar!(acos);
scalar!(cbrt);
pub fn atan2(y: f64, x: f64) -> f64 {
    #[cfg(all(target_arch = "wasm32", not(feature = "portable-math")))]
    #[allow(unsafe_code)] // Two scalar arguments, with the JavaScript order preserved.
    unsafe {
        host::atan2(y, x)
    }
    #[cfg(any(not(target_arch = "wasm32"), feature = "portable-math"))]
    {
        y.atan2(x)
    }
}

// Qualification exports use the same functions as the retained fitter, with no host calls.
#[cfg(feature = "portable-math")]
macro_rules! export_scalar {
    ($export:ident, $name:ident) => {
        #[allow(unsafe_code)] // Exported symbol name only; scalar arithmetic owns no memory.
        #[no_mangle]
        pub extern "C" fn $export(x: f64) -> f64 {
            $name(x)
        }
    };
}
#[cfg(feature = "portable-math")]
export_scalar!(geom_math_sin, sin);
#[cfg(feature = "portable-math")]
export_scalar!(geom_math_cos, cos);
#[cfg(feature = "portable-math")]
export_scalar!(geom_math_acos, acos);
#[cfg(feature = "portable-math")]
export_scalar!(geom_math_cbrt, cbrt);
#[cfg(feature = "portable-math")]
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
