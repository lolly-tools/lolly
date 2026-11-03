// SPDX-License-Identifier: MPL-2.0
//! Colour helpers for the adapter: the ProPhoto gamma 1.8 decode, the ProPhoto to sRGB display
//! conversion, and orientation of the camera JPEG used for the colour fit.

pub type Mat3 = [[f64; 3]; 3];

/// ProPhoto RGB (ROMM, D50) to XYZ D50.
const PROPHOTO_TO_XYZ: Mat3 = [[0.7976749, 0.1351917, 0.0313534], [0.2880402, 0.7118741, 0.0000857], [0.0, 0.0, 0.8252100]];
/// sRGB primaries adapted to D50 (Bradford) to XYZ D50.
const SRGB_D50_TO_XYZ: Mat3 = [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]];
/// Adobe RGB (1998) to linear sRGB, both D65.
pub const ADOBE_TO_SRGB: Mat3 = [[1.3982832, -0.3982832, 0.0], [0.0, 1.0, 0.0], [0.0, -0.0429383, 1.0429383]];
/// Display P3 to linear sRGB, both D65.
pub const P3_TO_SRGB: Mat3 = [[1.2249401, -0.2249404, 0.0], [-0.0420569, 1.0420571, 0.0], [-0.0196376, -0.0786361, 1.0982735]];

pub fn mul(a: &Mat3, b: &Mat3) -> Mat3 {
    let mut o = [[0.0; 3]; 3];
    for i in 0..3 { for j in 0..3 { o[i][j] = (0..3).map(|k| a[i][k] * b[k][j]).sum(); } }
    o
}

pub fn invert(m: &Mat3) -> Option<Mat3> {
    let c = |r: usize, c: usize| m[r][c];
    let det = c(0, 0) * (c(1, 1) * c(2, 2) - c(1, 2) * c(2, 1)) - c(0, 1) * (c(1, 0) * c(2, 2) - c(1, 2) * c(2, 0)) + c(0, 2) * (c(1, 0) * c(2, 1) - c(1, 1) * c(2, 0));
    if det.abs() < 1e-12 { return None; }
    let d = 1.0 / det;
    Some([
        [(c(1, 1) * c(2, 2) - c(1, 2) * c(2, 1)) * d, (c(0, 2) * c(2, 1) - c(0, 1) * c(2, 2)) * d, (c(0, 1) * c(1, 2) - c(0, 2) * c(1, 1)) * d],
        [(c(1, 2) * c(2, 0) - c(1, 0) * c(2, 2)) * d, (c(0, 0) * c(2, 2) - c(0, 2) * c(2, 0)) * d, (c(0, 2) * c(1, 0) - c(0, 0) * c(1, 2)) * d],
        [(c(1, 0) * c(2, 1) - c(1, 1) * c(2, 0)) * d, (c(0, 1) * c(2, 0) - c(0, 0) * c(2, 1)) * d, (c(0, 0) * c(1, 1) - c(0, 1) * c(1, 0)) * d],
    ])
}

/// Linear ProPhoto RGB to linear sRGB.
pub fn prophoto_to_srgb() -> Mat3 {
    // The constants are well conditioned, so the inverse always exists.
    let inv = invert(&SRGB_D50_TO_XYZ).unwrap_or([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]);
    mul(&inv, &PROPHOTO_TO_XYZ)
}

/// The sRGB transfer function, linear 0..1 to encoded 0..1.
pub fn srgb_encode(v: f64) -> f64 {
    let v = v.clamp(0.0, 1.0);
    if v <= 0.003_130_8 { 12.92 * v } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 }
}
/// The sRGB transfer function, encoded 0..1 to linear 0..1.
pub fn srgb_decode(v: f64) -> f64 {
    if v <= 0.040_45 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) }
}

/// Turn RGB8 upright for a TIFF orientation 1..=8; returns the new width and height.
pub fn orient(rgb: Vec<u8>, w: usize, h: usize, o: u16) -> (Vec<u8>, usize, usize) {
    if o <= 1 || o > 8 || rgb.len() != w * h * 3 { return (rgb, w, h); }
    let swap = o >= 5;
    let (nw, nh) = if swap { (h, w) } else { (w, h) };
    let mut out = vec![0u8; rgb.len()];
    for y in 0..h {
        for x in 0..w {
            // Destination of source pixel (x, y) per TIFF orientation.
            let (dx, dy) = match o {
                2 => (w - 1 - x, y),
                3 => (w - 1 - x, h - 1 - y),
                4 => (x, h - 1 - y),
                5 => (y, x),
                6 => (h - 1 - y, x),
                7 => (h - 1 - y, w - 1 - x),
                _ => (y, w - 1 - x),
            };
            let (s, d) = ((y * w + x) * 3, (dy * nw + dx) * 3);
            out[d..d + 3].copy_from_slice(&rgb[s..s + 3]);
        }
    }
    (out, nw, nh)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prophoto_white_is_srgb_white() {
        let m = prophoto_to_srgb();
        for row in m { assert!((row.iter().sum::<f64>() - 1.0).abs() < 1e-3, "{row:?}"); }
    }

    #[test]
    fn orientation_six_turns_a_landscape_clockwise() {
        // 2x1: A B  -> rotated 90 clockwise becomes 1x2: A over B.
        let (out, w, h) = orient(vec![1, 1, 1, 2, 2, 2], 2, 1, 6);
        assert_eq!((w, h), (1, 2));
        assert_eq!(out, vec![1, 1, 1, 2, 2, 2]);
        let (out, ..) = orient(vec![1, 1, 1, 2, 2, 2], 2, 1, 3);
        assert_eq!(out, vec![2, 2, 2, 1, 1, 1]);
    }
}
