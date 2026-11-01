//! Composite fonts, kinsoku tables and mojikumi tables (CJK typography).
//! See `docs/format/fonts.md` and `docs/format/objects.md`.

use crate::Error;
use crate::object::{Cursor, Name};

pub mod class {
    pub const COMPOSITE_FONT: u32 = 0xCB02;
    pub const COMPOSITE_FONT_ENTRY: u32 = 0xCB03;
    /// Kinsoku tables: hard, soft, Korean, Simplified Chinese, Traditional
    /// Chinese and custom.
    pub const KINSOKU: [u32; 6] = [0x4209, 0x420A, 0x42B4, 0x42B5, 0x42B6, CUSTOM_KINSOKU];
    pub const CUSTOM_KINSOKU: u32 = 0x4204;
    pub const MOJIKUMI: u32 = 0x4206;
    pub const CUSTOM_MOJIKUMI: u32 = 0x4203;
}

pub mod chunk {
    pub const COMPOSITE_FONT: u32 = 0xCB02;
    pub const COMPOSITE_FONT_ENTRY: u32 = 0xCB03;
    /// Name of a kinsoku or mojikumi table: flag byte and string.
    pub const TABLE_NAME: u32 = 0x100B;
    /// Character lists of a custom kinsoku table.
    pub const KINSOKU_CHARS: u32 = 0x4214;
    /// Spacing settings of a custom mojikumi table.
    pub const MOJIKUMI_AKI: u32 = 0x420A;
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompositeFont {
    pub uid: u32,
    pub name: Name,
    /// Entries, in IDML order.
    pub entries: Vec<CompositeFontEntry>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompositeFontEntry {
    pub uid: u32,
    pub name: Name,
    pub font_family: u32,
    pub font_style: Name,
    /// Four f64: relative size, baseline shift, then the horizontal and
    /// vertical scale (100 in every sample, so their order is not shown).
    pub numbers: [f64; 4],
    /// The u16 after the numbers: 1 for `Locked="true"`, 0 for false.
    pub locked: u16,
    /// Character ranges as (first, last) code points.
    pub ranges: Vec<(u32, u32)>,
    /// The four u16 after the ranges: all 1 for `ScaleOption="true"`, all 0
    /// for false.
    pub scale: [u16; 4],
}

/// A code point stored as one UTF-16 unit or a surrogate pair.
fn code_point(c: &mut Cursor) -> Result<u32, Error> {
    let hi = c.u16()? as u32;
    if (0xD800..0xDC00).contains(&hi) {
        let lo = c.u16()? as u32;
        Ok(0x10000 + ((hi - 0xD800) << 10) + (lo.wrapping_sub(0xDC00) & 0x3FF))
    } else {
        Ok(hi)
    }
}

impl CompositeFontEntry {
    /// Chunk 0xCB03: name, u32 font family, font style, four f64, u16
    /// locked, u16 range count, ranges (first, last, first), four u16.
    pub fn read(uid: u32, obj: &crate::Object) -> Result<Option<CompositeFontEntry>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::COMPOSITE_FONT_ENTRY) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let name = c.name()?;
        let font_family = c.u32()?;
        let font_style = c.name()?;
        let numbers = [c.f64()?, c.f64()?, c.f64()?, c.f64()?];
        let locked = c.u16()?;
        let n = c.u16()?;
        let mut ranges = Vec::new();
        for _ in 0..n {
            let first = code_point(&mut c)?;
            let last = code_point(&mut c)?;
            code_point(&mut c)?;
            ranges.push((first, last));
        }
        let scale = [c.u16()?, c.u16()?, c.u16()?, c.u16()?];
        Ok(Some(CompositeFontEntry {
            uid,
            name,
            font_family,
            font_style,
            numbers,
            locked,
            ranges,
            scale,
        }))
    }

    /// The characters of the ranges, in order (IDML `CustomCharacters`).
    pub fn characters(&self) -> String {
        self.ranges
            .iter()
            .flat_map(|&(a, b)| (a..=b).filter_map(char::from_u32))
            .collect()
    }
}

impl CompositeFont {
    /// Chunk 0xCB02: four flagged strings (the name first), a u32 and a
    /// u16 not identified, then a u16 count and the entry UIDs, which end
    /// the chunk. In files from InDesign 3.0 four zero bytes come before
    /// the name (`big-endian.md`). A chunk of another layout gives the
    /// first u16 count after the name whose UIDs end the chunk. Returns
    /// the name and the entry UIDs.
    pub fn read(obj: &crate::Object) -> Result<Option<(Name, Vec<u32>)>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::COMPOSITE_FONT) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let name = match c.name() {
            Ok(name) => name,
            Err(e) if d.starts_with(&[0; 4]) => {
                c = enc.cursor(d);
                c.skip(4)?;
                c.name().map_err(|_| e)?
            }
            Err(e) => return Err(e),
        };
        let start = c.pos();
        let structured = (|| -> Result<Option<Vec<u32>>, Error> {
            for _ in 0..3 {
                c.name()?;
            }
            c.u32()?;
            c.u16()?;
            let n = c.u16()? as usize;
            if c.remaining() != 4 * n {
                return Ok(None);
            }
            Ok(Some(
                (0..n).map(|_| c.u32()).collect::<Result<Vec<_>, _>>()?,
            ))
        })();
        if let Ok(Some(entries)) = structured {
            return Ok(Some((name, entries)));
        }
        let Some(p) = (start..d.len().saturating_sub(1)).find(|&p| {
            let n = enc.u16_from([d[p], d[p + 1]]) as usize;
            n > 0 && p + 2 + 4 * n == d.len()
        }) else {
            return Ok(Some((name, Vec::new())));
        };
        let mut c = enc.cursor(&d[p..]);
        let n = c.u16()?;
        let entries = (0..n).map(|_| c.u32()).collect::<Result<Vec<_>, _>>()?;
        Ok(Some((name, entries)))
    }
}

/// A kinsoku or mojikumi table.
#[derive(Debug, Clone, PartialEq)]
pub struct CjkTable {
    pub uid: u32,
    pub mojikumi: bool,
    pub name: Name,
    /// The character lists of a custom kinsoku table: cannot begin a line,
    /// cannot end a line, (not identified), hanging punctuation, cannot be
    /// separated.
    pub chars: Option<[String; 5]>,
    /// The settings of a custom mojikumi table.
    pub custom_mojikumi: Option<MojikumiSettings>,
}

/// The settings of a custom mojikumi table (chunk 0x420A). See
/// `docs/format/objects.md`, custom mojikumi tables.
#[derive(Debug, Clone, PartialEq)]
pub struct MojikumiSettings {
    /// The `kMojikumiDefaultName<n>` code of the table it is based on; 0
    /// for none.
    pub based_on: u16,
    pub entries: Vec<AkiEntry>,
}

/// One spacing entry of a custom mojikumi table.
#[derive(Debug, Clone, PartialEq)]
pub struct AkiEntry {
    pub target_class: u16,
    pub side_class: u16,
    pub minimum: f64,
    pub desired: f64,
    pub maximum: f64,
    pub compression_priority: u16,
    pub aki_does_not_float: bool,
    pub side_is_after_target: bool,
}

/// A u16 that holds 0 or 1.
fn bool16(c: &mut Cursor) -> Result<bool, Error> {
    match c.u16()? {
        0 => Ok(false),
        1 => Ok(true),
        v => Err(Error::Corrupt(format!("mojikumi flag {v} is not 0 or 1"))),
    }
}

impl MojikumiSettings {
    /// Chunk 0x420A: u32, u32, u32 entry count, 34 bytes per entry, two
    /// u32 not identified and the u16 code of the table it is based on.
    pub fn read(enc: crate::object::Encoding, d: &[u8]) -> Result<MojikumiSettings, Error> {
        let mut c = enc.cursor(d);
        c.skip(8)?;
        let n = c.u32()? as usize;
        if Some(d.len()) != n.checked_mul(34).and_then(|m| m.checked_add(22)) {
            return Err(Error::Corrupt(format!(
                "mojikumi settings of {} bytes for {n} entries",
                d.len()
            )));
        }
        let mut entries = Vec::with_capacity(n);
        for _ in 0..n {
            entries.push(AkiEntry {
                target_class: c.u16()?,
                side_class: c.u16()?,
                minimum: c.f64()?,
                desired: c.f64()?,
                maximum: c.f64()?,
                compression_priority: c.u16()?,
                aki_does_not_float: bool16(&mut c)?,
                side_is_after_target: bool16(&mut c)?,
            });
        }
        c.skip(8)?;
        let based_on = c.u16()?;
        Ok(MojikumiSettings { based_on, entries })
    }
}

impl CjkTable {
    pub fn read(uid: u32, cls: u32, obj: &crate::Object) -> Result<Option<CjkTable>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::TABLE_NAME) else {
            return Ok(None);
        };
        let name = enc.cursor(d).name()?;
        let chars = match obj.chunk(chunk::KINSOKU_CHARS) {
            Some(d) if cls == class::CUSTOM_KINSOKU => {
                let mut c = enc.cursor(d);
                let counts = [c.u16()?, c.u16()?, c.u16()?, c.u16()?, c.u16()?];
                let mut lists: [String; 5] = Default::default();
                for (list, n) in lists.iter_mut().zip(counts) {
                    let units = (0..n).map(|_| c.u16()).collect::<Result<Vec<_>, _>>()?;
                    *list = String::from_utf16_lossy(&units);
                }
                Some(lists)
            }
            _ => None,
        };
        let custom_mojikumi = if cls == class::CUSTOM_MOJIKUMI {
            let d = obj
                .chunk(chunk::MOJIKUMI_AKI)
                .ok_or_else(|| Error::Corrupt("mojikumi table without settings".into()))?;
            Some(MojikumiSettings::read(enc, d)?)
        } else {
            None
        };
        Ok(Some(CjkTable {
            uid,
            mojikumi: cls == class::MOJIKUMI || cls == class::CUSTOM_MOJIKUMI,
            name,
            chars,
            custom_mojikumi,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::synthetic::{flagged_string, object};
    use crate::object::Encoding;
    use crate::{ByteOrder, Version};

    fn big_endian() -> Encoding {
        Encoding::new(ByteOrder::Big, Version { major: 4, minor: 0 })
    }

    /// Chunk 0xCB03 of a composite font entry in `enc`: the Kanji entry,
    /// font family 7, style "W3", a BMP range and a range of surrogate
    /// pairs, scale option on.
    fn entry_chunk(enc: Encoding) -> Vec<u8> {
        let mut d = flagged_string(enc, 1, "Kanji");
        d.extend(enc.u32_bytes(7));
        d.extend(flagged_string(enc, 0, "W3"));
        for f in [100.0, 0.0, 100.0, 100.0] {
            d.extend(enc.f64_bytes(f));
        }
        d.extend(enc.u16_bytes(1));
        d.extend(enc.u16_bytes(2));
        // (first, last, first): U+4E00–U+4E01, then U+20000–U+20001.
        for u in [0x4E00u16, 0x4E01, 0x4E00] {
            d.extend(enc.u16_bytes(u));
        }
        for pair in [[0xD840u16, 0xDC00], [0xD840, 0xDC01], [0xD840, 0xDC00]] {
            for u in pair {
                d.extend(enc.u16_bytes(u));
            }
        }
        for _ in 0..4 {
            d.extend(enc.u16_bytes(1));
        }
        d
    }

    #[test]
    fn reads_composite_font_entries_in_either_byte_order() {
        for enc in [Encoding::default(), big_endian()] {
            let obj = object(
                0x60,
                class::COMPOSITE_FONT_ENTRY,
                &[(chunk::COMPOSITE_FONT_ENTRY, entry_chunk(enc))],
                enc,
            );
            let e = CompositeFontEntry::read(0x60, &obj).unwrap().unwrap();
            assert_eq!(e.name.idml(), "$ID/Kanji");
            assert_eq!((e.font_family, e.font_style.idml()), (7, "W3".into()));
            assert_eq!(e.numbers, [100.0, 0.0, 100.0, 100.0]);
            assert_eq!(e.ranges, [(0x4E00, 0x4E01), (0x20000, 0x20001)]);
            assert_eq!(e.scale, [1; 4]);
            assert_eq!(e.characters(), "\u{4E00}\u{4E01}\u{20000}\u{20001}");
        }
    }

    #[test]
    fn composite_fonts_of_version_3_have_four_bytes_before_the_name() {
        for enc in [Encoding::default(), big_endian()] {
            let mut d = vec![0; 4];
            d.extend(flagged_string(enc, 1, "[No composite font]"));
            d.extend([0; 6]);
            d.extend(enc.u16_bytes(1));
            d.extend(enc.u32_bytes(0x55));
            let obj = object(
                0x54,
                class::COMPOSITE_FONT,
                &[(chunk::COMPOSITE_FONT, d)],
                enc,
            );
            let (name, entries) = CompositeFont::read(&obj).unwrap().unwrap();
            assert_eq!(name.idml(), "$ID/[No composite font]");
            assert_eq!(entries, [0x55]);
        }
    }

    #[test]
    fn composite_fonts_end_with_their_entry_list() {
        let enc = Encoding::default();
        let mut d = flagged_string(enc, 1, "[No composite font]");
        // Fields not identified, then two entry UIDs.
        d.extend([9, 9, 9, 9, 9]);
        d.extend(enc.u16_bytes(2));
        d.extend(enc.u32_bytes(0x60));
        d.extend(enc.u32_bytes(0x61));
        let obj = object(
            0x5F,
            class::COMPOSITE_FONT,
            &[(chunk::COMPOSITE_FONT, d)],
            enc,
        );
        let (name, entries) = CompositeFont::read(&obj).unwrap().unwrap();
        assert!(name.builtin);
        assert_eq!(name.name, "[No composite font]");
        assert_eq!(entries, [0x60, 0x61]);
    }

    #[test]
    fn reads_composite_fonts_by_their_four_names() {
        let enc = Encoding::default();
        let mut d = flagged_string(enc, 0, "Font A");
        d.extend(flagged_string(enc, 0, ""));
        d.extend(flagged_string(enc, 0, "ATC-416e6f74686572basic"));
        d.extend(flagged_string(enc, 0, "Font A"));
        d.extend(enc.u32_bytes(0));
        d.extend(enc.u16_bytes(0));
        d.extend(enc.u16_bytes(2));
        d.extend(enc.u32_bytes(0x60));
        d.extend(enc.u32_bytes(0x61));
        let obj = object(
            0x5F,
            class::COMPOSITE_FONT,
            &[(chunk::COMPOSITE_FONT, d)],
            enc,
        );
        let (name, entries) = CompositeFont::read(&obj).unwrap().unwrap();
        assert_eq!(name.idml(), "Font A");
        assert_eq!(entries, [0x60, 0x61]);
    }

    #[test]
    fn reads_custom_mojikumi_settings() {
        for enc in [Encoding::default(), big_endian()] {
            let mut d = enc.u32_bytes(26).to_vec();
            d.extend(enc.u32_bytes(0));
            d.extend(enc.u32_bytes(1));
            d.extend(enc.u16_bytes(1));
            d.extend(enc.u16_bytes(23));
            for f in [0.5, 0.25, 1.0] {
                d.extend(enc.f64_bytes(f));
            }
            d.extend(enc.u16_bytes(2));
            d.extend(enc.u16_bytes(0));
            d.extend(enc.u16_bytes(1));
            d.extend([0; 8]);
            d.extend(enc.u16_bytes(16));
            let m = MojikumiSettings::read(enc, &d).unwrap();
            assert_eq!(m.based_on, 16);
            assert_eq!(
                m.entries,
                [AkiEntry {
                    target_class: 1,
                    side_class: 23,
                    minimum: 0.5,
                    desired: 0.25,
                    maximum: 1.0,
                    compression_priority: 2,
                    aki_does_not_float: false,
                    side_is_after_target: true,
                }]
            );
            // A length that does not fit the entry count.
            assert!(MojikumiSettings::read(enc, &d[..d.len() - 1]).is_err());
            // A flag other than 0 or 1.
            let mut bad = d.clone();
            bad[12 + 32..12 + 34].copy_from_slice(&enc.u16_bytes(2));
            assert!(MojikumiSettings::read(enc, &bad).is_err());
        }
    }

    #[test]
    fn reads_custom_kinsoku_characters() {
        let enc = Encoding::default();
        let lists = ["、。", "（", "", "、", "—"];
        let mut chars = Vec::new();
        for l in lists {
            chars.extend(enc.u16_bytes(l.encode_utf16().count() as u16));
        }
        for l in lists {
            for u in l.encode_utf16() {
                chars.extend(enc.u16_bytes(u));
            }
        }
        let obj = object(
            0x70,
            class::CUSTOM_KINSOKU,
            &[
                (chunk::TABLE_NAME, flagged_string(enc, 0, "Mine")),
                (chunk::KINSOKU_CHARS, chars),
            ],
            enc,
        );
        let t = CjkTable::read(0x70, class::CUSTOM_KINSOKU, &obj)
            .unwrap()
            .unwrap();
        assert!(!t.mojikumi && !t.name.builtin);
        assert_eq!(t.name.name, "Mine");
        assert_eq!(t.chars, Some(lists.map(String::from)));
        // A mojikumi table has no character lists.
        let obj = object(
            0x71,
            class::MOJIKUMI,
            &[(
                chunk::TABLE_NAME,
                flagged_string(enc, 1, "kMojikumiDefaultName1"),
            )],
            enc,
        );
        let t = CjkTable::read(0x71, class::MOJIKUMI, &obj)
            .unwrap()
            .unwrap();
        assert!(t.mojikumi && t.name.builtin && t.chars.is_none());
    }
}
