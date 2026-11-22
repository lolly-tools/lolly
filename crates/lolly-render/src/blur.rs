// SPDX-License-Identifier: MPL-2.0
//! A Gaussian blur as three box blurs, in integer arithmetic.
//!
//! The approximation is the one the SVG filter specification gives for `feGaussianBlur`
//! and the one Skia uses for large deviations: a box of `d = floor(sigma * 3 * sqrt(2 pi) / 4
//! + 0.5)` pixels, three times; for an even `d`, two boxes of `d` offset half a pixel each
//! way and one of `d + 1`. Each pass sums whole bytes and divides with rounding, so the
//! result is the same on every machine; no `exp` is evaluated anywhere.

/// `3 * sqrt(2 pi) / 4`, written out so no platform function computes it.
const BOX_FACTOR: f64 = 1.879_971_205_973_250_3;

/// The box widths and their offsets for one deviation in pixels: `(width, shift)`, where a
/// shift of -1 puts the box's extra pixel on the left and 1 on the right.
pub fn boxes(sigma: f64) -> Option<[(usize, i32); 3]> {
    if sigma.is_nan() || sigma <= 0.0 || !sigma.is_finite() {
        return None;
    }
    let d = libm::floor(sigma * BOX_FACTOR + 0.5) as usize;
    if d < 2 {
        // Under a pixel the passes would be identity boxes; Skia leaves such a blur out too.
        return None;
    }
    Some(if d % 2 == 1 { [(d, 0), (d, 0), (d, 0)] } else { [(d, -1), (d, 1), (d + 1, 0)] })
}

/// One box pass along a line of `n` RGBA8 pixels spaced `stride` bytes apart, from `src` to
/// `dst`. A window of even `width` reaches one pixel further on the side `shift` names.
fn pass(src: &[u8], dst: &mut [u8], n: usize, start: usize, stride: usize, width: usize, shift: i32) {
    let (left, right) = if width % 2 == 1 {
        ((width / 2) as isize, (width / 2) as isize)
    } else if shift < 0 {
        (width as isize / 2, width as isize / 2 - 1)
    } else {
        (width as isize / 2 - 1, width as isize / 2)
    };
    let half = (width / 2) as u32;
    let at = |i: isize, c: usize| -> u32 {
        if i < 0 || i >= n as isize {
            0
        } else {
            src[start + i as usize * stride + c] as u32
        }
    };
    let mut sums = [0u32; 4];
    for (c, sum) in sums.iter_mut().enumerate() {
        for k in -left..=right {
            *sum += at(k, c);
        }
    }
    for i in 0..n as isize {
        for (c, sum) in sums.iter_mut().enumerate() {
            dst[start + i as usize * stride + c] = ((*sum + half) / width as u32).min(255) as u8;
            *sum = *sum + at(i + right + 1, c) - at(i - left, c);
        }
    }
}

/// Blur the premultiplied RGBA8 `data` (`width` x `height`) in place with deviation `sigma`
/// pixels, inside the rectangle `area` (x0, y0, x1, y1), which the caller grows by the blur's
/// reach. Premultiplied values stay valid: every channel takes the same weights.
pub fn blur(data: &mut [u8], width: usize, height: usize, sigma: f64, area: [usize; 4]) {
    let Some(passes) = boxes(sigma) else { return };
    let [x0, y0, x1, y1] = [area[0].min(width), area[1].min(height), area[2].min(width), area[3].min(height)];
    if x0 >= x1 || y0 >= y1 {
        return;
    }
    let mut scratch = data.to_vec();
    let stride = width * 4;
    for &(w, shift) in &passes {
        for y in y0..y1 {
            pass(data, &mut scratch, x1 - x0, y * stride + x0 * 4, 4, w, shift);
        }
        for y in y0..y1 {
            data[y * stride + x0 * 4..y * stride + x1 * 4].copy_from_slice(&scratch[y * stride + x0 * 4..y * stride + x1 * 4]);
        }
    }
    for &(w, shift) in &passes {
        for x in x0..x1 {
            pass(data, &mut scratch, y1 - y0, y0 * stride + x * 4, stride, w, shift);
        }
        for y in y0..y1 {
            data[y * stride + x0 * 4..y * stride + x1 * 4].copy_from_slice(&scratch[y * stride + x0 * 4..y * stride + x1 * 4]);
        }
    }
}

/// The smallest rectangle holding every pixel with any alpha, grown by `reach` pixels.
pub fn painted_area(data: &[u8], width: usize, height: usize, reach: usize) -> Option<[usize; 4]> {
    let (mut x0, mut y0, mut x1, mut y1) = (usize::MAX, usize::MAX, 0, 0);
    for y in 0..height {
        for x in 0..width {
            if data[(y * width + x) * 4 + 3] != 0 {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x + 1);
                y1 = y1.max(y + 1);
            }
        }
    }
    if x0 == usize::MAX {
        return None;
    }
    Some([x0.saturating_sub(reach), y0.saturating_sub(reach), (x1 + reach).min(width), (y1 + reach).min(height)])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn box_widths_follow_the_svg_rule() {
        assert_eq!(boxes(0.5), None);
        assert_eq!(boxes(2.0), Some([(4, -1), (4, 1), (5, 0)]));
        assert_eq!(boxes(4.0), Some([(8, -1), (8, 1), (9, 0)]));
        assert_eq!(boxes(5.0), Some([(9, 0), (9, 0), (9, 0)]));
    }

    #[test]
    fn a_blur_keeps_the_total_and_spreads_a_point() {
        let (w, h) = (21, 21);
        let mut data = vec![0u8; w * h * 4];
        let centre = (10 * w + 10) * 4;
        data[centre..centre + 4].copy_from_slice(&[255, 255, 255, 255]);
        let mut big = vec![0u8; w * h * 4];
        for p in big.chunks_exact_mut(4) {
            p.copy_from_slice(&[200, 100, 50, 200]);
        }
        let flat = big.clone();
        blur(&mut big, w, h, 3.0, [0, 0, w, h]);
        // A flat field away from the edges stays flat.
        assert_eq!(&big[centre..centre + 4], &flat[centre..centre + 4]);
        blur(&mut data, w, h, 3.0, [0, 0, w, h]);
        assert!(data[centre + 3] > 0 && data[centre + 3] < 255);
        assert!(data[((10 * w) + 13) * 4 + 3] > 0, "the point spreads sideways");
    }
}
