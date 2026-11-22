// SPDX-License-Identifier: MPL-2.0
//! A plain PNG writer: IHDR, an optional pHYs, one zlib stream of filtered rows, IEND.
//!
//! The filter for each row is chosen by the usual smallest-sum rule, and the zlib
//! stream comes from miniz_oxide, which is plain integer code. The same pixels give
//! the same file on every machine. The finishing the web shell does (Imprint, sRGB
//! profile, XMP, provenance text, Content Credential) stays with the caller.

const CRC_TABLE: [u32; 256] = {
    let mut table = [0u32; 256];
    let mut n = 0;
    while n < 256 {
        let mut c = n as u32;
        let mut k = 0;
        while k < 8 {
            c = if c & 1 != 0 { 0xedb8_8320 ^ (c >> 1) } else { c >> 1 };
            k += 1;
        }
        table[n] = c;
        n += 1;
    }
    table
};

fn crc32(parts: &[&[u8]]) -> u32 {
    let mut c = 0xffff_ffffu32;
    for part in parts {
        for &b in *part {
            c = CRC_TABLE[((c ^ b as u32) & 0xff) as usize] ^ (c >> 8);
        }
    }
    c ^ 0xffff_ffff
}

fn chunk(out: &mut Vec<u8>, kind: &[u8; 4], body: &[u8]) {
    out.extend_from_slice(&(body.len() as u32).to_be_bytes());
    out.extend_from_slice(kind);
    out.extend_from_slice(body);
    out.extend_from_slice(&crc32(&[kind, body]).to_be_bytes());
}

fn paeth(a: u8, b: u8, c: u8) -> u8 {
    let p = a as i16 + b as i16 - c as i16;
    let pa = (p - a as i16).abs();
    let pb = (p - b as i16).abs();
    let pc = (p - c as i16).abs();
    if pa <= pb && pa <= pc {
        a
    } else if pb <= pc {
        b
    } else {
        c
    }
}

/// Straight (not premultiplied) RGBA8 rows as a PNG. `dpi` adds a pHYs chunk in pixels per metre.
pub fn encode_rgba(rgba: &[u8], width: u32, height: u32, dpi: Option<f64>) -> Vec<u8> {
    let stride = width as usize * 4;
    debug_assert_eq!(rgba.len(), stride * height as usize);
    let mut filtered = Vec::with_capacity((stride + 1) * height as usize);
    let mut candidate = vec![0u8; stride];
    let mut best = vec![0u8; stride];
    let zero = vec![0u8; stride];
    for y in 0..height as usize {
        let row = &rgba[y * stride..(y + 1) * stride];
        let up = if y == 0 { &zero[..] } else { &rgba[(y - 1) * stride..y * stride] };
        let mut best_kind = 0u8;
        let mut best_cost = u64::MAX;
        for kind in 0u8..5 {
            for i in 0..stride {
                let left = if i >= 4 { row[i - 4] } else { 0 };
                let corner = if i >= 4 { up[i - 4] } else { 0 };
                let predictor = match kind {
                    0 => 0,
                    1 => left,
                    2 => up[i],
                    3 => ((left as u16 + up[i] as u16) / 2) as u8,
                    _ => paeth(left, up[i], corner),
                };
                candidate[i] = row[i].wrapping_sub(predictor);
            }
            let cost: u64 = candidate.iter().map(|&v| (v as i8).unsigned_abs() as u64).sum();
            if cost < best_cost {
                best_cost = cost;
                best_kind = kind;
                best.copy_from_slice(&candidate);
            }
        }
        filtered.push(best_kind);
        filtered.extend_from_slice(&best);
    }
    let compressed = miniz_oxide::deflate::compress_to_vec_zlib(&filtered, 6);
    let mut out = Vec::with_capacity(compressed.len() + 128);
    out.extend_from_slice(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]);
    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.extend_from_slice(&[8, 6, 0, 0, 0]);
    chunk(&mut out, b"IHDR", &ihdr);
    if let Some(dpi) = dpi {
        // Pixels per metre, rounded as the engine's insertPngPhys rounds them.
        let ppm = libm::round(dpi / 0.0254) as u32;
        let mut phys = Vec::with_capacity(9);
        phys.extend_from_slice(&ppm.to_be_bytes());
        phys.extend_from_slice(&ppm.to_be_bytes());
        phys.push(1);
        chunk(&mut out, b"pHYs", &phys);
    }
    chunk(&mut out, b"IDAT", &compressed);
    chunk(&mut out, b"IEND", &[]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc_matches_the_png_reference() {
        // The CRC of the IEND chunk type is fixed by the PNG specification.
        assert_eq!(crc32(&[b"IEND"]), 0xae42_6082);
    }

    #[test]
    fn writes_a_readable_header() {
        let png = encode_rgba(&[255, 0, 0, 255, 0, 0, 255, 128], 2, 1, Some(96.0));
        assert_eq!(&png[..8], &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]);
        assert_eq!(&png[12..16], b"IHDR");
        assert_eq!(&png[33 + 4..33 + 8], b"pHYs");
        // 96 dpi is 3780 pixels per metre.
        assert_eq!(&png[33 + 8..33 + 12], &3780u32.to_be_bytes());
        assert_eq!(&png[png.len() - 8..png.len() - 4], b"IEND");
    }
}
