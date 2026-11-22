// SPDX-License-Identifier: MPL-2.0
//! Pictures: embedded PNG, JPEG and WebP decoded to straight RGBA8, or refused by name.
//!
//! The type is read from the bytes, never from the declared type. Every decoder is pure
//! Rust and runs the same code on every machine: png (integer inflate and unfiltering),
//! zune-jpeg built without its x86 and neon features (scalar integer IDCT, libjpeg-style
//! fancy upsampling, fixed-point colour conversion) and image-webp (integer VP8 and VP8L
//! decoding). Only pictures that draw as sRGB at eight bits a channel are admitted: a
//! colour profile that is not sRGB, PNG chromaticities or gamma of their own, sixteen bits a
//! channel, CMYK, an Exif turn and animation each refuse with a code, because the browser
//! applies them and this crate does not. A vector picture refuses: drawing SVG is resvg's
//! job and its fidelity is not shown.

/// Bytes of one encoded picture.
pub const MAX_PICTURE_BYTES: usize = 32 * 1024 * 1024;
/// A picture's longest side, and its pixels.
pub const MAX_PICTURE_SIDE: u32 = 8192;
pub const MAX_PICTURE_PIXELS: u64 = 16 * 1024 * 1024;

/// A decoded picture: straight (not premultiplied) RGBA8, row by row.
#[derive(Debug, Clone)]
pub struct Decoded {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// Why a picture is not drawn here: a stable code and a sentence.
#[derive(Debug, Clone, PartialEq)]
pub struct PictureRefusal {
    pub code: &'static str,
    pub detail: String,
}

fn refuse(code: &'static str, detail: impl Into<String>) -> PictureRefusal {
    PictureRefusal { code, detail: detail.into() }
}

/// Standard base64 with padding, as `Buffer.toString('base64')` writes it; anything else is None.
pub fn base64(s: &str) -> Option<Vec<u8>> {
    let b = s.as_bytes();
    if !b.len().is_multiple_of(4) {
        return None;
    }
    let value = |c: u8| -> Option<u32> {
        Some(match c {
            b'A'..=b'Z' => (c - b'A') as u32,
            b'a'..=b'z' => (c - b'a' + 26) as u32,
            b'0'..=b'9' => (c - b'0' + 52) as u32,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        })
    };
    let mut out = Vec::with_capacity(b.len() / 4 * 3);
    for (i, chunk) in b.chunks(4).enumerate() {
        let last = i == b.len() / 4 - 1;
        let pad = chunk.iter().rev().take_while(|&&c| c == b'=').count();
        if pad > 2 || (pad > 0 && !last) {
            return None;
        }
        let mut n = 0u32;
        for (k, &c) in chunk.iter().enumerate() {
            let v = if k >= 4 - pad { 0 } else { value(c)? };
            n = (n << 6) | v;
        }
        let bytes = [(n >> 16) as u8, (n >> 8) as u8, n as u8];
        out.extend_from_slice(&bytes[..3 - pad]);
    }
    Some(out)
}

fn check_size(width: u32, height: u32) -> Result<(), PictureRefusal> {
    if width == 0
        || height == 0
        || width > MAX_PICTURE_SIDE
        || height > MAX_PICTURE_SIDE
        || width as u64 * height as u64 > MAX_PICTURE_PIXELS
    {
        return Err(refuse(
            "picture-size",
            format!("a picture of {width} x {height} (at most {MAX_PICTURE_SIDE} a side and {MAX_PICTURE_PIXELS} pixels)"),
        ));
    }
    Ok(())
}

/// One tag of an ICC profile by its signature.
fn icc_tag<'a>(icc: &'a [u8], sig: &[u8; 4]) -> Option<&'a [u8]> {
    if icc.len() < 132 {
        return None;
    }
    let count = (u32::from_be_bytes(icc[128..132].try_into().ok()?) as usize).min(256);
    for i in 0..count {
        let at = 132 + i * 12;
        if at + 12 > icc.len() {
            break;
        }
        if &icc[at..at + 4] != sig {
            continue;
        }
        let offset = u32::from_be_bytes(icc[at + 4..at + 8].try_into().ok()?) as usize;
        let size = u32::from_be_bytes(icc[at + 8..at + 12].try_into().ok()?) as usize;
        return icc.get(offset..offset.checked_add(size)?);
    }
    None
}

fn s15(b: &[u8]) -> f64 {
    i32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64 / 65536.0
}

/// A tone curve (`curv` or `para`) at one half, or NaN when it cannot be read.
fn tone_at_half(tag: Option<&[u8]>) -> f64 {
    let Some(t) = tag else { return f64::NAN };
    if t.len() < 12 {
        return f64::NAN;
    }
    match &t[0..4] {
        b"curv" => {
            let count = u32::from_be_bytes([t[8], t[9], t[10], t[11]]) as usize;
            if count == 0 {
                return 0.5;
            }
            if count == 1 {
                return if t.len() >= 14 { libm::pow(0.5, u16::from_be_bytes([t[12], t[13]]) as f64 / 256.0) } else { f64::NAN };
            }
            if t.len() < 12 + count * 2 {
                return f64::NAN;
            }
            let at = 0.5 * (count - 1) as f64;
            let lo = at as usize;
            let hi = (lo + 1).min(count - 1);
            let f = at - lo as f64;
            let v = |i: usize| u16::from_be_bytes([t[12 + i * 2], t[13 + i * 2]]) as f64;
            (v(lo) * (1.0 - f) + v(hi) * f) / 65535.0
        }
        b"para" => {
            let function = u16::from_be_bytes([t[8], t[9]]);
            let n = ((t.len() - 12) / 4).min(7);
            let mut p = [f64::NAN, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0];
            for (i, v) in p.iter_mut().enumerate().take(n) {
                *v = s15(&t[12 + i * 4..]);
            }
            let [g, a, b, c, d, e, f] = p;
            let x = 0.5;
            match function {
                0 => libm::pow(x, g),
                1 => {
                    if x >= -b / a {
                        libm::pow(a * x + b, g)
                    } else {
                        0.0
                    }
                }
                2 => {
                    if x >= -b / a {
                        libm::pow(a * x + b, g) + c
                    } else {
                        c
                    }
                }
                3 => {
                    if x >= d {
                        libm::pow(a * x + b, g)
                    } else {
                        c * x
                    }
                }
                4 => {
                    if x >= d {
                        libm::pow(a * x + b, g) + e
                    } else {
                        c * x + f
                    }
                }
                _ => f64::NAN,
            }
        }
        _ => f64::NAN,
    }
}

/// Whether an ICC profile draws as sRGB: its colorants within 0.003 of sRGB's (D50) and each
/// tone curve within 0.01 of sRGB's at one half (0.214), read from the numbers and never the
/// description. The same test as the resvg route (`isSrgbProfile` in design-still.ts).
pub fn is_srgb_profile(icc: &[u8]) -> bool {
    let colorants: [(&[u8; 4], [f64; 3]); 3] =
        [(b"rXYZ", [0.4361, 0.2225, 0.0139]), (b"gXYZ", [0.3851, 0.7169, 0.0971]), (b"bXYZ", [0.1431, 0.0606, 0.7141])];
    for (sig, want) in colorants {
        let Some(tag) = icc_tag(icc, sig) else { return false };
        if tag.len() < 20 || &tag[0..4] != b"XYZ " {
            return false;
        }
        if (0..3).any(|k| (s15(&tag[8 + k * 4..]) - want[k]).abs() > 0.003) {
            return false;
        }
    }
    [b"rTRC", b"gTRC", b"bTRC"].iter().all(|sig| (tone_at_half(icc_tag(icc, sig)) - 0.214).abs() <= 0.01)
}

fn png(bytes: &[u8]) -> Result<Decoded, PictureRefusal> {
    let unreadable = |e: png::DecodingError| refuse("picture-unreadable", format!("a PNG picture that cannot be read ({e})"));
    let mut decoder = png::Decoder::new_with_limits(std::io::Cursor::new(bytes), png::Limits { bytes: (MAX_PICTURE_PIXELS * 8) as usize });
    decoder.set_transformations(png::Transformations::EXPAND);
    let mut reader = decoder.read_info().map_err(unreadable)?;
    let info = reader.info();
    check_size(info.width, info.height)?;
    if info.bit_depth == png::BitDepth::Sixteen {
        return Err(refuse("picture-depth", "a PNG picture of sixteen bits a channel, which this crate does not draw"));
    }
    if info.animation_control.is_some() {
        return Err(refuse("picture-motion", "an animated PNG picture"));
    }
    if let Some(icc) = &info.icc_profile {
        if !is_srgb_profile(icc) {
            return Err(refuse("picture-colour", "a PNG picture with a colour profile other than sRGB, which the browser applies"));
        }
    } else if info.srgb.is_none() {
        if info.chrm_chunk.is_some() {
            return Err(refuse("picture-colour", "a PNG picture with chromaticities of its own, which the browser applies"));
        }
        // 45455 is sRGB's gamma written as PNG writes it.
        if info.gama_chunk.is_some_and(|g| (g.into_scaled() as i64 - 45455).abs() > 100) {
            return Err(refuse("picture-colour", "a PNG picture with a gamma of its own, which the browser applies"));
        }
    }
    // cICP names wide-gamut and HDR encodings; only sRGB's own code points (1, 13) are read.
    if info.coding_independent_code_points.as_ref().is_some_and(|c| c.color_primaries != 1 || c.transfer_function != 13)
        || info.mastering_display_color_volume.is_some()
        || info.content_light_level.is_some()
    {
        return Err(refuse("picture-colour", "a PNG picture with wide-gamut or HDR colour, which this crate does not draw"));
    }
    let mut buf = vec![0u8; reader.output_buffer_size().ok_or_else(|| refuse("picture-size", "a PNG picture too large to decode"))?];
    let out = reader.next_frame(&mut buf).map_err(unreadable)?;
    if out.bit_depth != png::BitDepth::Eight {
        return Err(refuse("picture-depth", "a PNG picture that does not expand to eight bits a channel"));
    }
    let (w, h) = (out.width as usize, out.height as usize);
    let mut rgba = Vec::with_capacity(w * h * 4);
    for y in 0..h {
        let line = &buf[y * out.line_size..y * out.line_size + out.line_size];
        for x in 0..w {
            match out.color_type {
                png::ColorType::Rgba => rgba.extend_from_slice(&line[x * 4..x * 4 + 4]),
                png::ColorType::Rgb => rgba.extend_from_slice(&[line[x * 3], line[x * 3 + 1], line[x * 3 + 2], 255]),
                png::ColorType::GrayscaleAlpha => rgba.extend_from_slice(&[line[x * 2], line[x * 2], line[x * 2], line[x * 2 + 1]]),
                png::ColorType::Grayscale => rgba.extend_from_slice(&[line[x], line[x], line[x], 255]),
                png::ColorType::Indexed => return Err(refuse("picture-unreadable", "a palette PNG picture that did not expand")),
            }
        }
    }
    Ok(Decoded { width: out.width, height: out.height, rgba })
}

/// The Exif orientation in a JPEG's APP1 or a WebP's EXIF chunk (the TIFF body), or 1.
fn exif_orientation(tiff: &[u8]) -> u16 {
    let t = if tiff.starts_with(b"Exif\0\0") { &tiff[6..] } else { tiff };
    if t.len() < 8 {
        return 1;
    }
    let big = match &t[0..2] {
        b"MM" => true,
        b"II" => false,
        _ => return 1,
    };
    let u16_at = |i: usize| -> Option<u16> {
        let b = t.get(i..i + 2)?;
        Some(if big { u16::from_be_bytes([b[0], b[1]]) } else { u16::from_le_bytes([b[0], b[1]]) })
    };
    let u32_at = |i: usize| -> Option<u32> {
        let b = t.get(i..i + 4)?;
        Some(if big { u32::from_be_bytes([b[0], b[1], b[2], b[3]]) } else { u32::from_le_bytes([b[0], b[1], b[2], b[3]]) })
    };
    let Some(ifd) = u32_at(4) else { return 1 };
    let ifd = ifd as usize;
    let Some(count) = u16_at(ifd) else { return 1 };
    for i in 0..count.min(512) as usize {
        let at = ifd + 2 + i * 12;
        if u16_at(at) == Some(0x0112) {
            return u16_at(at + 8).unwrap_or(1);
        }
    }
    1
}

fn jpeg(bytes: &[u8]) -> Result<Decoded, PictureRefusal> {
    use zune_core::bytestream::ZCursor;
    use zune_core::colorspace::ColorSpace;
    use zune_core::options::DecoderOptions;
    let options = DecoderOptions::default()
        .set_max_width(MAX_PICTURE_SIDE as usize)
        .set_max_height(MAX_PICTURE_SIDE as usize)
        .jpeg_set_out_colorspace(ColorSpace::RGBA);
    let mut decoder = zune_jpeg::JpegDecoder::new_with_options(ZCursor::new(bytes), options);
    decoder.decode_headers().map_err(|e| refuse("picture-unreadable", format!("a JPEG picture that cannot be read ({e:?})")))?;
    let info = decoder.info().ok_or_else(|| refuse("picture-unreadable", "a JPEG picture without a frame header"))?;
    check_size(info.width as u32, info.height as u32)?;
    match decoder.input_colorspace() {
        Some(ColorSpace::YCbCr) | Some(ColorSpace::Luma) | Some(ColorSpace::RGB) => {}
        other => return Err(refuse("picture-type", format!("a JPEG picture in {other:?}, which this crate does not draw"))),
    }
    if let Some(exif) = decoder.exif() {
        if exif_orientation(exif) != 1 {
            return Err(refuse("picture-orientation", "a JPEG picture turned by its Exif orientation, which the browser applies"));
        }
    }
    if let Some(icc) = decoder.icc_profile() {
        if !is_srgb_profile(&icc) {
            return Err(refuse("picture-colour", "a JPEG picture with a colour profile other than sRGB, which the browser applies"));
        }
    }
    let rgba = decoder.decode().map_err(|e| refuse("picture-unreadable", format!("a JPEG picture that cannot be decoded ({e:?})")))?;
    if rgba.len() != info.width as usize * info.height as usize * 4 {
        return Err(refuse("picture-unreadable", "a JPEG picture that decoded to the wrong size"));
    }
    Ok(Decoded { width: info.width as u32, height: info.height as u32, rgba })
}

fn webp(bytes: &[u8]) -> Result<Decoded, PictureRefusal> {
    let unreadable = |e: image_webp::DecodingError| refuse("picture-unreadable", format!("a WebP picture that cannot be read ({e})"));
    let mut decoder = image_webp::WebPDecoder::new(std::io::Cursor::new(bytes)).map_err(unreadable)?;
    decoder.set_memory_limit((MAX_PICTURE_PIXELS * 8) as usize);
    let (w, h) = decoder.dimensions();
    check_size(w, h)?;
    if decoder.is_animated() {
        return Err(refuse("picture-motion", "an animated WebP picture"));
    }
    if let Some(icc) = decoder.icc_profile().map_err(unreadable)? {
        if !is_srgb_profile(&icc) {
            return Err(refuse("picture-colour", "a WebP picture with a colour profile other than sRGB, which the browser applies"));
        }
    }
    if let Some(exif) = decoder.exif_metadata().map_err(unreadable)? {
        if exif_orientation(&exif) != 1 {
            return Err(refuse("picture-orientation", "a WebP picture turned by its Exif orientation, which the browser applies"));
        }
    }
    let alpha = decoder.has_alpha();
    let size = decoder.output_buffer_size().ok_or_else(|| refuse("picture-size", "a WebP picture too large to decode"))?;
    let mut buf = vec![0u8; size];
    decoder.read_image(&mut buf).map_err(unreadable)?;
    let rgba = if alpha { buf } else { buf.chunks_exact(3).flat_map(|p| [p[0], p[1], p[2], 255]).collect() };
    Ok(Decoded { width: w, height: h, rgba })
}

/// Decode one picture's bytes, or say why it is not drawn here.
pub fn decode(bytes: &[u8]) -> Result<Decoded, PictureRefusal> {
    if bytes.len() > MAX_PICTURE_BYTES {
        return Err(refuse("picture-size", format!("a picture of more than {MAX_PICTURE_BYTES} bytes")));
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return png(bytes);
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return jpeg(bytes);
    }
    if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return webp(bytes);
    }
    if bytes.starts_with(b"GIF8") {
        return Err(refuse("picture-type", "a GIF picture, which this slice does not draw"));
    }
    let head = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]);
    if head.trim_start_matches('\u{feff}').trim_start().starts_with('<') {
        return Err(refuse("picture-vector", "a vector picture, which is resvg's to draw and whose fidelity is not shown"));
    }
    Err(refuse("picture-type", "a picture of a type this crate does not read"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_reads_only_the_standard_padded_form() {
        assert_eq!(base64("aGVsbG8=").as_deref(), Some(&b"hello"[..]));
        assert_eq!(base64("aGk=").as_deref(), Some(&b"hi"[..]));
        assert_eq!(base64("YQ==").as_deref(), Some(&b"a"[..]));
        assert_eq!(base64(""), Some(vec![]));
        assert_eq!(base64("aGVsbG8"), None);
        assert_eq!(base64("aGV sbG8="), None);
        assert_eq!(base64("a=Vs"), None);
    }

    #[test]
    fn the_type_is_read_from_the_bytes() {
        assert_eq!(decode(b"<svg xmlns='http://www.w3.org/2000/svg'/>").unwrap_err().code, "picture-vector");
        assert_eq!(decode(b"GIF89a....").unwrap_err().code, "picture-type");
        assert_eq!(decode(b"not a picture").unwrap_err().code, "picture-type");
        assert_eq!(decode(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).unwrap_err().code, "picture-unreadable");
    }

    /// A PNG with one chunk added after IHDR.
    fn with_chunk(kind: &[u8; 4], body: &[u8]) -> Vec<u8> {
        let png = crate::png_out::encode_rgba(&[255, 0, 0, 255, 0, 0, 255, 128], 2, 1, None);
        let mut out = png[..33].to_vec();
        out.extend_from_slice(&(body.len() as u32).to_be_bytes());
        out.extend_from_slice(kind);
        out.extend_from_slice(body);
        out.extend_from_slice(&crate::png_out::crc32(&[kind, body]).to_be_bytes());
        out.extend_from_slice(&png[33..]);
        out
    }

    #[test]
    fn a_plain_png_decodes_and_one_with_its_own_colour_refuses() {
        let plain = decode(&crate::png_out::encode_rgba(&[255, 0, 0, 255, 0, 0, 255, 128], 2, 1, None)).unwrap();
        assert_eq!((plain.width, plain.height, plain.rgba.clone()), (2, 1, vec![255, 0, 0, 255, 0, 0, 255, 128]));
        assert_eq!(decode(&with_chunk(b"gAMA", &100_000u32.to_be_bytes())).unwrap_err().code, "picture-colour");
        assert!(decode(&with_chunk(b"gAMA", &45_455u32.to_be_bytes())).is_ok());
        assert!(decode(&with_chunk(b"sRGB", &[0])).is_ok());
        assert_eq!(decode(&with_chunk(b"acTL", &[0, 0, 0, 2, 0, 0, 0, 0])).unwrap_err().code, "picture-motion");
    }

    #[test]
    fn exif_orientation_reads_both_byte_orders() {
        let mut big = b"MM\0\x2a\0\0\0\x08\0\x01".to_vec();
        big.extend_from_slice(&[0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0]);
        assert_eq!(exif_orientation(&big), 6);
        let mut little = b"II\x2a\0\x08\0\0\0\x01\0".to_vec();
        little.extend_from_slice(&[0x12, 0x01, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
        assert_eq!(exif_orientation(&little), 1);
    }
}
