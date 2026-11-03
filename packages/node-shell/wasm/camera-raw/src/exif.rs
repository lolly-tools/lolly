// SPDX-License-Identifier: MPL-2.0
//! A small, bounds-checked EXIF reader for the capture facts the raw crate does not expose:
//! ISO, exposure time, aperture and orientation. It reads a TIFF-structured raw directly, or the
//! EXIF segment of an embedded JPEG (Fujifilm RAF and others keep their capture data there).

#[derive(Default, Debug, Clone, PartialEq)]
pub struct Exif {
    pub make: Option<String>,
    pub model: Option<String>,
    pub iso: Option<u32>,
    pub exposure_time: Option<f64>,
    pub f_number: Option<f64>,
    pub orientation: Option<u16>,
}

const TAG_MAKE: u16 = 0x010F;
const TAG_MODEL: u16 = 0x0110;
const TAG_ORIENTATION: u16 = 0x0112;
const TAG_EXIF_IFD: u16 = 0x8769;
const TAG_EXPOSURE_TIME: u16 = 0x829A;
const TAG_F_NUMBER: u16 = 0x829D;
const TAG_ISO: u16 = 0x8827;
const TAG_ISO_SPEED: u16 = 0x8833;
const MAX_ENTRIES: usize = 512;

struct Reader<'a> { bytes: &'a [u8], little: bool }

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Option<Self> {
        let little = match bytes.get(0..2)? { b"II" => true, b"MM" => false, _ => return None };
        Some(Reader { bytes, little })
    }
    fn u16(&self, at: usize) -> Option<u16> {
        let b: [u8; 2] = self.bytes.get(at..at.checked_add(2)?)?.try_into().ok()?;
        Some(if self.little { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
    }
    fn u32(&self, at: usize) -> Option<u32> {
        let b: [u8; 4] = self.bytes.get(at..at.checked_add(4)?)?.try_into().ok()?;
        Some(if self.little { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    }
    /// Offset of `tag`'s entry in the IFD at `ifd`, with its type, count and value offset.
    fn find(&self, ifd: usize, tag: u16) -> Option<(u16, usize, usize)> {
        let count = usize::from(self.u16(ifd)?).min(MAX_ENTRIES);
        for i in 0..count {
            let at = ifd.checked_add(2)?.checked_add(i.checked_mul(12)?)?;
            if self.u16(at)? != tag { continue; }
            let kind = self.u16(at + 2)?;
            let n = self.u32(at + 4)? as usize;
            let size: usize = match kind { 1 | 2 | 6 | 7 => 1, 3 | 8 => 2, 4 | 9 | 11 => 4, 5 | 10 | 12 => 8, _ => return None };
            let total = size.checked_mul(n)?;
            let value = if total <= 4 { at + 8 } else { self.u32(at + 8)? as usize };
            self.bytes.get(value..value.checked_add(total)?)?;
            return Some((kind, n, value));
        }
        None
    }
    fn uint(&self, ifd: usize, tag: u16) -> Option<u32> {
        let (kind, _, at) = self.find(ifd, tag)?;
        match kind { 1 | 7 => self.bytes.get(at).map(|v| u32::from(*v)), 3 => self.u16(at).map(u32::from), 4 => self.u32(at), _ => None }
    }
    fn rational(&self, ifd: usize, tag: u16) -> Option<f64> {
        let (kind, _, at) = self.find(ifd, tag)?;
        if kind != 5 { return None; }
        let (n, d) = (self.u32(at)?, self.u32(at + 4)?);
        (d != 0).then(|| f64::from(n) / f64::from(d)).filter(|v| v.is_finite())
    }
    fn ascii(&self, ifd: usize, tag: u16) -> Option<String> {
        let (kind, n, at) = self.find(ifd, tag)?;
        if kind != 2 { return None; }
        let raw = self.bytes.get(at..at + n.min(256))?;
        let text = String::from_utf8_lossy(raw);
        let text = text.trim_end_matches('\0').trim();
        (!text.is_empty()).then(|| text.to_string())
    }
}

/// The capture facts of a TIFF-structured file (DNG, CR2, NEF, ARW, ORF, RW2, PEF).
pub fn read_tiff(bytes: &[u8]) -> Option<Exif> {
    let r = Reader::new(bytes)?;
    let ifd0 = r.u32(4)? as usize;
    r.u16(ifd0)?;
    let mut out = Exif {
        make: r.ascii(ifd0, TAG_MAKE),
        model: r.ascii(ifd0, TAG_MODEL),
        orientation: r.uint(ifd0, TAG_ORIENTATION).and_then(|o| u16::try_from(o).ok()).filter(|o| (1..=8).contains(o)),
        ..Exif::default()
    };
    if let Some(exif) = r.uint(ifd0, TAG_EXIF_IFD).map(|v| v as usize) {
        out.exposure_time = r.rational(exif, TAG_EXPOSURE_TIME).filter(|v| *v > 0.0);
        out.f_number = r.rational(exif, TAG_F_NUMBER).filter(|v| *v > 0.0);
        // 65535 means "see the standard output sensitivity tags": ISOSpeed carries the real value.
        let standard = r.uint(exif, TAG_ISO).filter(|v| *v != 0 && *v != 65535);
        let speed = r.uint(exif, TAG_ISO_SPEED).filter(|v| *v != 0);
        out.iso = standard.or(speed);
    }
    Some(out)
}

/// The capture facts in a JPEG's EXIF segment.
pub fn read_jpeg(jpeg: &[u8]) -> Option<Exif> {
    if jpeg.get(0..2)? != [0xFF, 0xD8] { return None; }
    let mut at = 2usize;
    for _ in 0..64 {
        if *jpeg.get(at)? != 0xFF { return None; }
        let marker = *jpeg.get(at + 1)?;
        if marker == 0xFF { at += 1; continue; }
        if marker == 0xDA || marker == 0xD9 { return None; }
        let len = usize::from(u16::from_be_bytes([*jpeg.get(at + 2)?, *jpeg.get(at + 3)?]));
        if len < 2 { return None; }
        let body = jpeg.get(at + 4..at.checked_add(2 + len)?)?;
        if marker == 0xE1 && body.starts_with(b"Exif\0\0") { return read_tiff(&body[6..]); }
        at = at.checked_add(2 + len)?;
    }
    None
}
