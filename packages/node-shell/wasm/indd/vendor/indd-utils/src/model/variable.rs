//! Text variables: definitions (class 0xCAB4) and their instances in text
//! (class 0xCA64). See `docs/format/text-variables.md`.

use crate::Error;
use crate::object::{Cursor, Encoding, Object};

pub mod chunk {
    /// Definition: name, text, type and settings.
    pub const DEFINITION: u32 = 0x28BD;
    /// Instance: flag byte and the name of its variable.
    pub const INSTANCE_NAME: u32 = 0x100B;
}

/// Variable type codes and their IDML `VariableType`.
pub const TYPES: &[(u32, &str)] = &[
    (0xCAA1, "OutputDateType"),
    (0xCAA3, "CustomTextType"),
    (0xCAA6, "FileNameType"),
    (0xCAA8, "LastPageNumberType"),
    (0xCAA9, "ChapterNumberType"),
    (0xCAAA, "MatchParagraphStyleType"),
    (0xCAAB, "ModificationDateType"),
    (0xCAAC, "CreationDateType"),
    (0xCAB5, "XrefPageNumberType"),
    (0xCAB6, "XrefChapterNumberType"),
    (0xCAC0, "LiveCaptionType"),
];

#[derive(Debug, Clone, PartialEq)]
pub struct TextVariable {
    pub uid: u32,
    pub name: String,
    /// Type code (see [`TYPES`]).
    pub kind: u32,
    /// The date format of date variables; the contents of custom text
    /// variables (not proven, see the format notes).
    pub text: String,
    /// Paragraph style of a running header (`MatchParagraphStyleType`).
    pub style: Option<u32>,
    /// The fields not identified hold the values every corpus sample of
    /// this type has, so the IDML settings are those of the samples.
    pub as_in_samples: bool,
    /// The settings after the type code, where they parse to the end of
    /// the chunk.
    pub settings: Option<Settings>,
}

/// The settings of a definition (`text-variables.md`, settings): three
/// u32, then the text before and after the value.
#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub a: u32,
    pub b: u32,
    pub c: u32,
    pub before: String,
    pub after: String,
}

impl TextVariable {
    pub fn type_name(&self) -> Option<&'static str> {
        TYPES.iter().find(|t| t.0 == self.kind).map(|t| t.1)
    }

    pub fn read(uid: u32, obj: &Object) -> Result<Option<TextVariable>, Error> {
        let Some(data) = obj.chunk(chunk::DEFINITION) else {
            return Ok(None);
        };
        parse(obj.encoding, uid, data).map(Some)
    }
}

/// u32 length and text segments.
fn counted(c: &mut Cursor) -> Result<String, Error> {
    match c.u32()? as usize {
        0 => Ok(String::new()),
        n => c.segments(n),
    }
}

/// Chunk 0x28BD: name, text, u32 type, then 20 bytes.
fn parse(enc: Encoding, uid: u32, data: &[u8]) -> Result<TextVariable, Error> {
    let mut c = enc.cursor(data);
    let name = counted(&mut c)?;
    let text = counted(&mut c)?;
    let kind = c.u32()?;
    let settings = {
        let mut s = c.clone();
        (|| -> Result<Settings, Error> {
            let (a, b, c3) = (s.u32()?, s.u32()?, s.u32()?);
            let before = counted(&mut s)?;
            let after = counted(&mut s)?;
            if s.remaining() != 0 {
                return Err(Error::Corrupt("text variable settings".into()));
            }
            Ok(Settings {
                a,
                b,
                c: c3,
                before,
                after,
            })
        })()
        .ok()
    };
    let rest = c.bytes(c.remaining())?;
    let zero = |r: &[u8]| r.iter().all(|&b| b == 0);
    let mut style = None;
    let as_in_samples = rest.len() == 20
        && match kind {
            // Dates: the first u32 is 0 or 0xCAB3 in the samples.
            0xCAA1 | 0xCAAB | 0xCAAC => {
                (zero(&rest[..4]) || enc.u32_at(rest, 0) == Some(0xCAB3)) && zero(&rest[4..])
            }
            0xCAC0 => enc.u32_at(rest, 0) == Some(0x8C64) && zero(&rest[4..]),
            0xCAAA => {
                style = enc.u32_at(rest, 4);

                zero(&rest[..4]) && zero(&rest[8..])
            }
            _ => zero(rest) && text.is_empty(),
        };
    Ok(TextVariable {
        uid,
        name,
        kind,
        text,
        style: style.filter(|&s| s != 0),
        as_in_samples,
        settings,
    })
}

/// A text variable placed in text (U+0018 owning a class 0xCA64 object).
#[derive(Debug, Clone, PartialEq)]
pub struct Instance {
    pub uid: u32,
    /// Name of the variable it shows.
    pub name: String,
}

impl Instance {
    pub fn read(uid: u32, obj: &Object) -> Result<Instance, Error> {
        let enc = obj.encoding;
        let name = match obj.chunk(chunk::INSTANCE_NAME) {
            Some(d) if d.len() > 1 => {
                let mut c = enc.cursor(d);
                c.flag()?;
                c.string()?
            }
            _ => String::new(),
        };
        Ok(Instance { uid, name })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn counted_text(s: &str) -> Vec<u8> {
        let mut v = (s.len() as u32).to_le_bytes().to_vec();
        if !s.is_empty() {
            v.extend((0x4000u16 | s.len() as u16).to_le_bytes());
            v.extend(s.as_bytes());
        }
        v
    }

    #[test]
    fn parses_a_date_variable() {
        let mut d = counted_text("Output Date");
        d.extend(counted_text("dd.MM.yy"));
        d.extend(0xCAA1u32.to_le_bytes());
        d.extend([0xB3, 0xCA, 0, 0]);
        d.extend([0; 16]);
        let v = parse(crate::object::Encoding::default(), 0x84, &d).unwrap();
        assert_eq!(v.name, "Output Date");
        assert_eq!(v.text, "dd.MM.yy");
        assert_eq!(v.type_name(), Some("OutputDateType"));
        assert!(v.as_in_samples);
    }

    #[test]
    fn reads_the_running_header_style() {
        let mut d = counted_text("Running Header");
        d.extend(counted_text(""));
        d.extend(0xCAAAu32.to_le_bytes());
        d.extend([0; 4]);
        d.extend(0x81u32.to_le_bytes());
        d.extend([0; 12]);
        let v = parse(crate::object::Encoding::default(), 0x89, &d).unwrap();
        assert_eq!(v.style, Some(0x81));
        assert!(v.as_in_samples);
        // Another value in a field not identified.
        let last = d.len() - 1;
        d[last] = 1;
        assert!(
            !parse(crate::object::Encoding::default(), 0x89, &d)
                .unwrap()
                .as_in_samples
        );
    }
}
