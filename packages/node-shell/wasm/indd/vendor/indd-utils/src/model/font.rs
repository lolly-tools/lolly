//! Font families (class 0x3E03). See `docs/format/fonts.md`.

use crate::Error;
use crate::object::{Encoding, Name, Object, builtin_key};

pub mod chunk {
    /// Family name and font records.
    pub const FAMILY: u32 = 0x3E05;
    /// Typekit IDs of the first fonts of the family.
    pub const TYPEKIT_IDS: u32 = 0x3EEB;
}

/// A font family and the fonts of it that the document records.
#[derive(Debug, Clone, PartialEq)]
pub struct FontFamily {
    pub uid: u32,
    pub name: String,
    /// The name is a built-in key (written with `$ID/`).
    pub builtin: bool,
    /// The family name in the font's own script.
    pub native_name: String,
    pub fonts: Vec<Font>,
    /// IDML `WritingScript` of every font in the family.
    pub writing_script: u32,
}

impl FontFamily {
    /// The family name with each `<hhhh>` escape (four hexadecimal digits
    /// of a UTF-16 code unit) replaced by its character
    /// (`docs/format/fonts.md`, composite fonts as applied fonts).
    pub fn unescaped_name(&self) -> String {
        let mut units = Vec::new();
        let mut rest = self.name.as_str();
        while let Some(i) = rest.find('<') {
            units.extend(rest[..i].encode_utf16());
            let unit = rest
                .get(i + 1..i + 6)
                .filter(|t| t.ends_with('>') && t[..4].bytes().all(|b| b.is_ascii_hexdigit()))
                .and_then(|t| u16::from_str_radix(&t[..4], 16).ok());
            match unit {
                Some(u) => {
                    units.push(u);
                    rest = &rest[i + 6..];
                }
                None => {
                    units.push(u16::from(b'<'));
                    rest = &rest[i + 1..];
                }
            }
        }
        units.extend(rest.encode_utf16());
        String::from_utf16_lossy(&units)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Font {
    pub style: String,
    /// The style is a built-in key (a missing font's `FontStyleName`).
    pub style_builtin: bool,
    pub postscript_name: String,
    pub full_name: String,
    /// `FontStyleNameNative` as IDML writes it.
    pub style_native: String,
    pub full_name_native: String,
    /// Font type code (see [`Font::type_name`]).
    pub font_type: u32,
    pub version: String,
    /// IDML `TypekitID`; the empty built-in key when the font has none.
    pub typekit_id: Name,
    /// IDML `PlatformName` of a font in a missing-font record.
    pub platform_name: Option<String>,
}

impl Font {
    /// IDML `FontType` for the type code, if known.
    pub fn type_name(&self) -> Option<&'static str> {
        match self.font_type {
            0 => Some("Type1"),
            1 => Some("TrueType"),
            3 => Some("ATC"),
            6 => Some("OpenTypeCFF"),
            7 => Some("OpenTypeCID"),
            8 => Some("OpenTypeTT"),
            0xFFFF_FFFF => Some("Unknown"),
            _ => None,
        }
    }
}

impl FontFamily {
    pub fn read(uid: u32, obj: &Object) -> Result<Option<FontFamily>, Error> {
        let Some(data) = obj.chunk(chunk::FAMILY) else {
            return Ok(None);
        };
        // Files from InDesign 3.0 and 4.0 use older font records; one is
        // taken only if it reads the chunk to its end.
        let mut family = match parse(obj.encoding, uid, data, Record::Current) {
            Ok(f) => f,
            Err(e) => parse(obj.encoding, uid, data, Record::Version4)
                .or_else(|_| parse(obj.encoding, uid, data, Record::Version3))
                .map_err(|_| e)?,
        };
        if let Some(ids) = obj.chunk(chunk::TYPEKIT_IDS) {
            for (font, id) in family.fonts.iter_mut().zip(typekit_ids(obj.encoding, ids)?) {
                font.typekit_id = id;
            }
        }
        Ok(Some(family))
    }
}

/// Layouts of the font record.
#[derive(Clone, Copy, PartialEq)]
enum Record {
    Current,
    /// The PostScript name is a u8 and a string.
    Version4,
    /// As `Version4`, without the version.
    Version3,
}

/// Record kind (byte 0 of chunk 0x3E05) of a family whose fonts are
/// missing.
const MISSING: u8 = 3;

/// Record kind of a family that refers to another family.
const REFERENCE: u8 = 2;

/// A record of kind 2 in chunk 0x3E05: u8 2, u8, u32 UID of another font
/// family, u16 count of the font entries that follow. Returns the UID and
/// the count. See `docs/format/fonts.md`, families that refer to another.
pub fn reference(enc: Encoding, data: &[u8]) -> Option<(u32, u16)> {
    let mut c = enc.cursor(data);
    if c.u8().ok()? != REFERENCE {
        return None;
    }
    c.u8().ok()?;
    Some((c.u32().ok()?, c.u16().ok()?))
}

impl FontFamily {
    /// The family that a record of kind 2 makes of the family it refers
    /// to: the same name, fonts and writing script, with the font type
    /// `Unknown`, no version and no Typekit ID.
    pub fn referring(&self, uid: u32) -> FontFamily {
        FontFamily {
            uid,
            fonts: self
                .fonts
                .iter()
                .map(|f| Font {
                    font_type: 0xFFFF_FFFF,
                    version: String::new(),
                    typekit_id: Name {
                        builtin: true,
                        name: String::new(),
                    },
                    ..f.clone()
                })
                .collect(),
            ..self.clone()
        }
    }
}

/// Chunk 0x3E05: u8 record kind, u8, flagged name, flagged native name, 6
/// bytes, u16 font count, font records, u32 writing script. A missing-font
/// record has other font records (`missing_fonts`).
fn parse(enc: Encoding, uid: u32, data: &[u8], record: Record) -> Result<FontFamily, Error> {
    let mut c = enc.cursor(data);
    let kind = c.u8()?;
    c.u8()?;
    let builtin = c.flag()? == 1;
    let name = c.string()?;
    c.flag()?;
    let native_name = c.string()?;
    if kind == MISSING && record == Record::Current {
        return Ok(FontFamily {
            uid,
            name,
            builtin,
            native_name,
            fonts: missing_fonts(&mut c)?,
            writing_script: 0,
        });
    }
    c.skip(6)?;
    let count = c.u16()?;
    let mut fonts = Vec::with_capacity(count as usize);
    for _ in 0..count {
        c.skip(1)?;
        let style = c.string()?;
        let postscript_name = if record != Record::Current {
            c.skip(1)?;
            c.string()?
        } else {
            let n = c.u16()? as usize;
            c.bytes(n)?.iter().map(|&b| b as char).collect()
        };
        c.skip(1)?;
        let full_name = c.string()?;
        let native_builtin = c.flag()? == 1;
        let style_native = c.string()?;
        let style_native = if native_builtin {
            builtin_key(&style_native)
        } else {
            style_native
        };
        c.skip(1)?;
        let full_name_native = c.string()?;
        let font_type = c.u32()?;
        let n = match record {
            Record::Version3 => 0,
            _ => c.u32()? as usize,
        };
        let version = if n == 0 {
            String::new()
        } else {
            c.segments(n)?
        };
        fonts.push(Font {
            style,
            style_builtin: false,
            postscript_name,
            full_name,
            style_native,
            full_name_native,
            font_type,
            version,
            typekit_id: Name {
                builtin: true,
                name: String::new(),
            },
            platform_name: None,
        });
    }
    let writing_script = c.u32()?;
    if record != Record::Current && c.remaining() != 0 {
        return Err(Error::Corrupt(format!("font family {uid}: unknown record")));
    }
    Ok(FontFamily {
        uid,
        name,
        builtin,
        native_name,
        fonts,
        writing_script,
    })
}

/// The fonts of a missing-font record, after the native name: 6 zero
/// bytes and no fonts, or 4 bytes, u16 count and per font three flagged
/// strings (style, platform name, style) and 10 bytes. The record must
/// end there. See `docs/format/fonts.md`, missing fonts.
fn missing_fonts(c: &mut crate::object::Cursor) -> Result<Vec<Font>, Error> {
    if c.remaining() == 6 {
        c.skip(6)?;
        return Ok(Vec::new());
    }
    c.skip(4)?;
    let count = c.u16()?;
    let mut fonts = Vec::new();
    for _ in 0..count {
        let style = c.name()?;
        let platform = c.name()?;
        c.name()?;
        c.skip(10)?;
        fonts.push(Font {
            style: style.name,
            style_builtin: style.builtin,
            postscript_name: String::new(),
            full_name: String::new(),
            style_native: platform.idml(),
            full_name_native: String::new(),
            font_type: 0xFFFF_FFFF,
            version: String::new(),
            typekit_id: Name {
                builtin: true,
                name: String::new(),
            },
            platform_name: Some(platform.idml()),
        });
    }
    if c.remaining() != 0 {
        return Err(Error::Corrupt("missing-font record: bytes left".into()));
    }
    Ok(fonts)
}

/// Chunk 0x3EEB: u32 count, then per font a flag byte (1 = `$ID/` key)
/// and a string.
fn typekit_ids(enc: Encoding, data: &[u8]) -> Result<Vec<Name>, Error> {
    let mut c = enc.cursor(data);
    let n = c.u32()?;
    (0..n).map(|_| c.name()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn string(s: &str) -> Vec<u8> {
        let mut v = vec![2, 0];
        v.extend((s.len() as u16).to_le_bytes());
        if !s.is_empty() {
            v.extend((0x4000u16 | s.len() as u16).to_le_bytes());
            v.extend(s.as_bytes());
        }
        v
    }

    #[test]
    fn parses_a_family() {
        let mut d = vec![1, 0, 0];
        d.extend(string("Myriad Pro"));
        d.push(0);
        d.extend(string("Myriad Pro"));
        d.extend([0, 0, 0, 0, 0xFF, 0xFF, 1, 0]);
        d.push(1);
        d.extend(string("Bold"));
        d.extend(14u16.to_le_bytes());
        d.extend(b"MyriadPro-Bold");
        for s in ["Myriad Pro Bold", "Bold", "Myriad Pro Bold"] {
            d.push(0);
            d.extend(string(s));
        }
        d.extend(6u32.to_le_bytes());
        d.extend(11u32.to_le_bytes());
        d.extend(0x400Bu16.to_le_bytes());
        d.extend(b"Version 2.1");
        d.extend(1u32.to_le_bytes());
        let f = parse(
            crate::object::Encoding::default(),
            0x9E,
            &d,
            Record::Current,
        )
        .unwrap();
        assert_eq!(f.name, "Myriad Pro");
        assert_eq!(f.writing_script, 1);
        let font = &f.fonts[0];
        assert_eq!(font.style, "Bold");
        assert_eq!(font.postscript_name, "MyriadPro-Bold");
        assert_eq!(font.full_name, "Myriad Pro Bold");
        assert_eq!(font.type_name(), Some("OpenTypeCFF"));
        assert_eq!(font.version, "Version 2.1");
    }

    #[test]
    fn reads_a_record_that_refers_to_another_family() {
        let enc = Encoding::default();
        assert_eq!(
            reference(enc, &[2, 0, 0x7f, 5, 0, 0, 0, 0]),
            Some((0x57f, 0))
        );
        assert_eq!(reference(enc, &[1, 0, 0x7f, 5, 0, 0, 0, 0]), None);
        assert_eq!(reference(enc, &[2, 0, 0x7f]), None);
    }

    #[test]
    fn reads_typekit_ids() {
        let mut d = 2u32.to_le_bytes().to_vec();
        d.push(1);
        d.extend(string(""));
        d.push(0);
        d.extend(string("TkD-1-ab"));
        assert_eq!(
            typekit_ids(crate::object::Encoding::default(), &d)
                .unwrap()
                .iter()
                .map(Name::idml)
                .collect::<Vec<_>>(),
            ["$ID/", "TkD-1-ab"]
        );
    }

    #[test]
    fn parses_a_missing_font_record() {
        let mut d = vec![3, 0, 1];
        d.extend(string("Aptos"));
        d.push(1);
        d.extend(string("Aptos"));
        d.extend([0; 4]);
        d.extend(1u16.to_le_bytes());
        for s in ["Regular", "Aptos", "Regular"] {
            d.push(1);
            d.extend(string(s));
        }
        d.extend([0; 8]);
        d.extend(2u16.to_le_bytes());
        let f = parse(Encoding::default(), 0x9E, &d, Record::Current).unwrap();
        assert!(f.builtin);
        let font = &f.fonts[0];
        assert_eq!((font.style.as_str(), font.style_builtin), ("Regular", true));
        assert_eq!(font.platform_name.as_deref(), Some("$ID/Aptos"));
        assert_eq!(font.type_name(), Some("Unknown"));
        // Without fonts: 6 zero bytes end the record.
        let mut d = vec![3, 0, 0];
        d.extend(string("Gone"));
        d.push(0);
        d.extend(string(""));
        d.extend([0; 6]);
        let f = parse(Encoding::default(), 0x9E, &d, Record::Current).unwrap();
        assert!(f.fonts.is_empty());
    }
}
