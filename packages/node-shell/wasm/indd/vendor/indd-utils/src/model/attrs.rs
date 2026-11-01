//! Attribute lists (chunk 0x6E03 and others). See `docs/format/objects.md`.
//!
//! A list is a u32 count, then records: u32 attribute ID, u16 payload size,
//! payload. The payload is a u16 value count and that many values, each a
//! u32 type, u16 length and data. The first value is the attribute's value.

use crate::Error;
use crate::audit::{List, Recorder};
use crate::object::{Cursor, Encoding};

/// Value type codes.
pub mod ty {
    pub const DOUBLE: u32 = 0x6E68;
    pub const INT: u32 = 0x6E67;
    pub const ENUM: u32 = 0x6E65;
    pub const POINT: u32 = 0x6E69;
    pub const REF: u32 = 0x117;
    /// A built-in item code, the second value after a reference of 0.
    pub const CODE: u32 = 0x6E64;
    /// A flag byte and an in-object string.
    pub const STRING: u32 = 0x1B02;
    pub const FORM_STRING: u32 = 0x1451F;
    /// The u16 caption position code of a table style (tables.md).
    pub const CAPTION_POSITION: u32 = 0x22E1F;
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Double(f64),
    Int(i32),
    Enum(u16),
    Ref(u32),
    Point(f64, f64),
    /// A reference followed by a built-in code (value type 0x6E64), as in
    /// a stroke type: the reference is 0 for a built-in style.
    RefOrCode(u32, u32),
    /// Two u32, as in a cell edge stroke type: a code and 0.
    Words(u32, u32),
    /// Three u32, as in a numbering restart policy.
    Words3([u32; 3]),
    /// A flag byte, then an in-object string.
    String(String),
    /// u32 length in characters, then text segments.
    Text(String),
    /// A tab list.
    TabList(Vec<TabStop>),
    /// A list of nested, line or GREP styles: u32 count, then records.
    /// `items` is `None` if the records cannot be decoded.
    StyleList {
        count: u32,
        items: Option<StyleItems>,
    },
    /// u32 bullet character type and u32 character value.
    BulletChar {
        kind: u32,
        value: u32,
    },
    /// Dash and gap lengths of a stroke and the corner adjustment code
    /// (page item attribute 0x5A35).
    Dashes(Vec<f64>, u16),
    /// A custom glyph: its name (the glyph ID that follows is not used).
    Glyph(String),
    /// OpenType features chosen for single glyphs: four-character feature
    /// tag and the number of the alternate (attribute 0x42AE).
    Features(Vec<(String, u32)>),
    /// Opacity gradient stops: location (0–1), absolute position of the
    /// midpoint to the next stop (0–1), opacity in percent.
    Stops(Vec<[f64; 3]>),
    /// A value whose layout is not known: its type code and bytes.
    Other(u32, Vec<u8>),
}

/// A tab stop. See `docs/format/attributes.md`, tab lists.
#[derive(Debug, Clone, PartialEq)]
pub struct TabStop {
    pub position: f64,
    /// 0 left, 1 centre, 2 right, 3 on a character.
    pub alignment: u16,
    /// The character of a stop aligned on one (code 3).
    pub character: Option<String>,
    pub leader: String,
}

/// The decoded records of a style list.
#[derive(Debug, Clone, PartialEq)]
pub enum StyleItems {
    Nested(Vec<NestedStyle>),
    Grep(Vec<GrepStyle>),
    Line(Vec<LineStyle>),
}

/// A GREP style: the character style it applies (0 for none) to the text
/// that the expression matches. See `docs/format/attributes.md`, GREP
/// styles.
#[derive(Debug, Clone, PartialEq)]
pub struct GrepStyle {
    pub style: u32,
    pub expression: String,
}

/// A line style: the character style it applies (0 for none) to a number
/// of lines. See `docs/format/attributes.md`, line styles.
#[derive(Debug, Clone, PartialEq)]
pub struct LineStyle {
    pub style: u32,
    pub lines: u32,
}

/// A nested style: the character style it applies (0 for none) and up to
/// where. See `docs/format/attributes.md`, nested styles.
#[derive(Debug, Clone, PartialEq)]
pub struct NestedStyle {
    pub style: u32,
    pub delimiter: Delimiter,
    pub repetition: u32,
    pub inclusive: bool,
}

/// Where a nested style ends.
#[derive(Debug, Clone, PartialEq)]
pub enum Delimiter {
    /// `^c`: the drop cap.
    Dropcap,
    /// `^w`
    AnyWord,
    /// `^?`
    AnyCharacter,
    /// `^t`
    Tabs,
    /// `^p`
    EndNestedStyle,
    /// `^9`
    Digits,
    /// `^S`
    Sentence,
    /// `^L`: repeat the previous styles.
    Repeat,
    /// A single character.
    Character(String),
}

/// Delimiter, repetition and inclusiveness of a nested style's delimiter
/// code: `^c`, or `(d)` / `[d]` followed by an optional count. `None` for
/// codes without evidence. See `docs/format/attributes.md`, nested styles.
pub fn nested_delimiter(code: &str) -> Option<(Delimiter, u32, bool)> {
    if code == "^c" {
        return Some((Delimiter::Dropcap, 1, true));
    }
    let (inclusive, close) = match code.chars().next()? {
        '(' => (true, ')'),
        '[' => (false, ']'),
        _ => return None,
    };
    let end = code.rfind(close)?;
    let inner = &code[1..end];
    let count = &code[end + 1..];
    let repetition = if count.is_empty() {
        1
    } else {
        count.parse().ok()?
    };
    let delimiter = match inner {
        "^c" => Delimiter::Dropcap,
        "^w" => Delimiter::AnyWord,
        "^?" => Delimiter::AnyCharacter,
        "^t" => Delimiter::Tabs,
        "^p" => Delimiter::EndNestedStyle,
        "^9" => Delimiter::Digits,
        "^S" => Delimiter::Sentence,
        "^L" => Delimiter::Repeat,
        _ if inner.chars().count() == 1 && inner != "^" => Delimiter::Character(inner.to_string()),
        _ => return None,
    };
    Some((delimiter, repetition, inclusive))
}

impl Value {
    pub fn as_f64(&self) -> Option<f64> {
        match *self {
            Value::Double(v) => Some(v),
            Value::Int(v) => Some(v as f64),
            Value::Enum(v) => Some(v as f64),
            _ => None,
        }
    }

    pub fn as_ref(&self) -> Option<u32> {
        match *self {
            Value::Ref(v) => Some(v),
            _ => None,
        }
    }

    /// Integer value of a reference, integer or enumeration.
    pub fn as_u32(&self) -> Option<u32> {
        match *self {
            Value::Ref(v) => Some(v),
            Value::Int(v) => Some(v as u32),
            Value::Enum(v) => Some(v as u32),
            _ => None,
        }
    }

    /// A string value.
    pub fn as_string(&self) -> Option<String> {
        match self {
            Value::String(s) => Some(s.clone()),
            _ => None,
        }
    }

    /// The code `indd audit` reports for a value without an IDML value:
    /// its integer, the code of a reference-or-code or the first of two
    /// or three words.
    pub fn code(&self) -> Option<u32> {
        match *self {
            Value::RefOrCode(_, code) | Value::Words(code, _) | Value::Words3([code, ..]) => {
                Some(code)
            }
            _ => self.as_u32(),
        }
    }
}

/// Attribute IDs and values, the kind of list they come from and the
/// recorder of the database they come from (for `indd audit`).
#[derive(Debug, Clone, Default)]
pub struct Attrs {
    pub values: Vec<(u32, Value)>,
    pub list: List,
    recorder: Option<Recorder>,
}

/// Lists are equal when their values and kinds are.
impl PartialEq for Attrs {
    fn eq(&self, other: &Attrs) -> bool {
        self.values == other.values && self.list == other.list
    }
}

impl Attrs {
    pub fn get(&self, id: u32) -> Option<&Value> {
        let v = self.values.iter().find(|(a, _)| *a == id).map(|(_, v)| v);
        if v.is_some()
            && let Some(r) = &self.recorder
        {
            r.attr_read(self.list, id);
        }
        v
    }

    /// Report a value of attribute `id` that has no IDML value to
    /// `indd audit`: its code (see [`Value::code`]).
    pub fn unknown_code(&self, id: u32, v: &Value) {
        if let Some(r) = &self.recorder {
            r.unknown_code(self.list, id, v.code().unwrap_or(u32::MAX));
        }
    }

    /// A page item list (chunk 0x6E03): u32 count, then records.
    pub fn parse(
        enc: Encoding,
        data: &[u8],
        list: List,
        recorder: Option<&Recorder>,
    ) -> Result<Attrs, Error> {
        let mut c = enc.cursor(data);
        let n = c.u32()? as usize;
        Attrs::records(&mut c, n, decode, list, recorder)
    }

    /// A page item attribute list (u32 count, records) at the cursor,
    /// which is left after the list.
    pub fn parse_at(
        c: &mut Cursor,
        list: List,
        recorder: Option<&Recorder>,
    ) -> Result<Attrs, Error> {
        let n = c.u32()? as usize;
        Attrs::records(c, n, decode, list, recorder)
    }

    /// A page item attribute list with a u16 count, as object styles hold.
    pub fn parse_short(
        enc: Encoding,
        data: &[u8],
        list: List,
        recorder: Option<&Recorder>,
    ) -> Result<Attrs, Error> {
        let mut c = enc.cursor(data);
        let n = c.u16()? as usize;
        Attrs::records(&mut c, n, decode, list, recorder)
    }

    /// A text attribute list: `count` records at the cursor. Values are
    /// decoded by their attribute's layout (see `text_layout`).
    pub fn parse_text(
        c: &mut Cursor,
        count: usize,
        list: List,
        recorder: Option<&Recorder>,
    ) -> Result<Attrs, Error> {
        Attrs::records(c, count, decode_text, list, recorder)
    }

    fn records(
        c: &mut Cursor,
        n: usize,
        decode: fn(Encoding, u32, u32, &[u8]) -> Value,
        list: List,
        recorder: Option<&Recorder>,
    ) -> Result<Attrs, Error> {
        let enc = c.encoding();
        let mut out = Vec::with_capacity(n.min(1024));
        for _ in 0..n {
            let id = c.u32()?;
            let size = c.u16()? as usize;
            let mut p = enc.cursor(c.bytes(size)?);
            // A record without values (for example a merged-cell marker).
            if size < 2 {
                continue;
            }
            let count = p.u16()?;
            let mut first = None;
            for i in 0..count {
                let t = p.u32()?;
                let len = p.u16()? as usize;
                let data = p.bytes(len)?;
                match (i, &first) {
                    (0, _) => first = Some(decode(enc, id, t, data)),
                    (1, Some(Value::Ref(r))) if t == ty::CODE && len == 4 => {
                        if let Some(code) = enc.u32_at(data, 0) {
                            first = Some(Value::RefOrCode(*r, code));
                        }
                    }
                    _ => {}
                }
            }
            if let Some(v) = first {
                out.push((id, v));
            }
        }
        if let Some(r) = recorder {
            r.attrs_parsed(list, out.iter().map(|(id, _)| *id));
        }
        Ok(Attrs {
            values: out,
            list,
            recorder: recorder.cloned(),
        })
    }
}

/// How the value of a text, table or cell attribute is laid out, for the
/// attributes whose value is not a single number. See
/// `docs/format/attributes.md` and `tables.md`.
#[derive(Clone, Copy)]
enum Layout {
    /// Two f64.
    Point,
    /// A flag byte and an in-object string.
    String,
    /// u32 length, then text segments.
    Text,
    TabList,
    NestedStyles,
    GrepStyles,
    LineStyles,
    BulletChar,
    /// Two u32.
    Words,
    /// Three u32.
    Words3,
    /// u32 reference (0 for a built-in) and u32 code.
    RefOrCode,
    /// u16 length, that many bytes of a glyph name, u32 glyph ID.
    Glyph,
    /// u16 count, then per feature four tag bytes and a u32 number.
    Features,
}

fn text_layout(id: u32) -> Option<Layout> {
    Some(match id {
        0x1B49 | 0x1B4A => Layout::Point,
        // Ruby and kenten font styles are strings too (attributes.md,
        // ruby, kenten and warichu).
        0x1B02 | 0x1A414 | 0x1A423 | 0x1A424 | 0x4234 | 0x424B => Layout::String,
        // Stroke types of rules, underline, strikethrough and paragraph
        // borders.
        0x1B71 | 0x1B72 | 0x1B95 | 0x1B9D | 0x1BFD => Layout::RefOrCode,
        0x422E => Layout::Text,
        0x1B29 => Layout::TabList,
        0x1B75 => Layout::NestedStyles,
        0x1BBA => Layout::GrepStyles,
        0x1BBB => Layout::LineStyles,
        0x1A406 => Layout::BulletChar,
        0x1A41E => Layout::Words3,
        0x1B5E => Layout::Glyph,
        0x42AE => Layout::Features,
        // Stroke types of cell edges, table borders, rows and columns
        // (tables.md).
        0xB64D | 0xB64E | 0xB64F | 0xB650 | 0xB655 | 0xB658 | 0xB65B | 0xB65E | 0xB688 | 0xB689
        | 0xB68E | 0xB68F => Layout::Words,
        _ => return None,
    })
}

/// A text, table or cell attribute value. Values of the attributes in
/// [`text_layout`] are decoded by their layout (`Other` if they do not
/// fit it); the others are numbers of 8, 4 or 2 bytes.
fn decode_text(enc: Encoding, id: u32, t: u32, data: &[u8]) -> Value {
    let Some(layout) = text_layout(id) else {
        let number = match data.len() {
            8 => enc.f64_at(data, 0).map(Value::Double),
            4 => enc.u32_at(data, 0).map(Value::Ref),
            2 => enc.u16_at(data, 0).map(Value::Enum),
            _ => None,
        };
        return number.unwrap_or_else(|| Value::Other(t, data.to_vec()));
    };
    let mut c = enc.cursor(data);
    let value = match layout {
        Layout::Point if data.len() == 16 => {
            (|| Ok::<_, Error>(Value::Point(c.f64()?, c.f64()?)))().ok()
        }
        Layout::Point => None,
        Layout::String => (|| {
            c.flag()?;
            c.string()
        })()
        .ok()
        .map(Value::String),
        Layout::Text => (|| {
            let n = c.u32()? as usize;
            c.segments(n)
        })()
        .ok()
        .map(Value::Text),
        Layout::TabList => tab_list(&mut c).map(Value::TabList),
        Layout::NestedStyles | Layout::GrepStyles | Layout::LineStyles => {
            c.u32().ok().map(|count| Value::StyleList {
                count,
                items: style_items(layout, &mut enc.cursor(data)),
            })
        }
        Layout::BulletChar if data.len() == 8 => (|| {
            Ok::<_, Error>(Value::BulletChar {
                kind: c.u32()?,
                value: c.u32()?,
            })
        })()
        .ok(),
        Layout::BulletChar => None,
        Layout::Words => (|| Ok::<_, Error>(Value::Words(c.u32()?, c.u32()?)))().ok(),
        Layout::Words3 if data.len() == 12 => {
            (|| Ok::<_, Error>(Value::Words3([c.u32()?, c.u32()?, c.u32()?])))().ok()
        }
        Layout::Words3 => None,
        Layout::RefOrCode if data.len() == 8 => {
            (|| Ok::<_, Error>(Value::RefOrCode(c.u32()?, c.u32()?)))().ok()
        }
        Layout::RefOrCode => None,
        Layout::Glyph => (|| {
            let n = c.u16().ok()? as usize;
            let name = c.bytes(n).ok()?.to_vec();
            c.u32().ok()?;
            if c.remaining() != 0 {
                return None;
            }
            String::from_utf8(name).ok()
        })()
        .map(Value::Glyph),
        Layout::Features => features(&mut c).map(Value::Features),
    };
    value.unwrap_or_else(|| Value::Other(t, data.to_vec()))
}

/// The features of attribute 0x42AE (`docs/format/attributes.md`,
/// alternate glyphs): the tag bytes are in reading order in either byte
/// order. `None` unless every tag is printable ASCII and the features
/// fill the value exactly.
fn features(c: &mut Cursor) -> Option<Vec<(String, u32)>> {
    let n = c.u16().ok()? as usize;
    let mut out = Vec::with_capacity(n.min(c.remaining() / 8));
    for _ in 0..n {
        let tag = c.bytes(4).ok()?;
        if !tag.iter().all(|b| (0x20..0x7F).contains(b)) {
            return None;
        }
        let tag = String::from_utf8(tag.to_vec()).ok()?;
        out.push((tag, c.u32().ok()?));
    }
    (c.remaining() == 0).then_some(out)
}

/// A tab list: u16 count, then per stop f64 position, u16 alignment (for
/// code 3 followed by the alignment character as a UTF-16 unit), u16
/// leader length and the leader in UTF-16 code units. `None` unless the
/// stops fill the value exactly.
fn tab_list(c: &mut Cursor) -> Option<Vec<TabStop>> {
    let n = c.u16().ok()?;
    let mut out = Vec::new();
    for _ in 0..n {
        let position = c.f64().ok()?;
        let alignment = c.u16().ok()?;
        let character = match alignment {
            3 => Some(String::from_utf16_lossy(&[c.u16().ok()?])),
            _ => None,
        };
        let len = c.u16().ok()? as usize;
        let units = (0..len)
            .map(|_| c.u16())
            .collect::<Result<Vec<_>, _>>()
            .ok()?;
        out.push(TabStop {
            position,
            alignment,
            character,
            leader: String::from_utf16_lossy(&units),
        });
    }
    (c.remaining() == 0).then_some(out)
}

/// The records of a style list: u32 count, then per record a u32
/// character style and
/// - nested styles: u32 length and the delimiter code as text segments;
/// - GREP styles: u32 length and the expression as text segments;
/// - line styles: u32 line count.
///
/// `None` unless every record can be read (every nested delimiter is
/// known) and the records fill the value exactly.
fn style_items(layout: Layout, c: &mut Cursor) -> Option<StyleItems> {
    fn text(c: &mut Cursor) -> Option<String> {
        match c.u32().ok()? as usize {
            0 => Some(String::new()),
            len => c.segments(len).ok(),
        }
    }
    let n = c.u32().ok()?;
    let mut nested = Vec::new();
    let mut grep = Vec::new();
    let mut line = Vec::new();
    for _ in 0..n {
        let style = c.u32().ok()?;
        match layout {
            Layout::NestedStyles => {
                let (delimiter, repetition, inclusive) = nested_delimiter(&text(c)?)?;
                nested.push(NestedStyle {
                    style,
                    delimiter,
                    repetition,
                    inclusive,
                });
            }
            Layout::GrepStyles => grep.push(GrepStyle {
                style,
                expression: text(c)?,
            }),
            _ => line.push(LineStyle {
                style,
                lines: c.u32().ok()?,
            }),
        }
    }
    if c.remaining() != 0 {
        return None;
    }
    Some(match layout {
        Layout::NestedStyles => StyleItems::Nested(nested),
        Layout::GrepStyles => StyleItems::Grep(grep),
        _ => StyleItems::Line(line),
    })
}

/// Page item attributes whose value is a list of opacity gradient stops:
/// u32 count, then three f64 per stop. See `docs/format/transparency.md`.
pub const OPACITY_STOPS: [u32; 3] = [0x1EB8C, 0x1EB95, 0x1EB9E];

/// The page item attribute of a stroke's dashes and gaps: 8 bytes (0 in
/// every sample), u32 count, that many f64, u16 corner adjustment. See
/// `docs/format/attributes.md`, dashes.
pub const DASHES: u32 = 0x5A35;

fn decode(enc: Encoding, id: u32, t: u32, data: &[u8]) -> Value {
    let f = |o: usize| enc.f64_at(data, o);
    if id == DASHES
        && let Some(n) = enc.u32_at(data, 8).map(|n| n as usize)
        && data.len().checked_sub(14) == n.checked_mul(8)
        && let Some(v) = (0..n).map(|i| f(12 + 8 * i)).collect::<Option<Vec<_>>>()
        && let Some(corner) = enc.u16_at(data, 12 + 8 * n)
    {
        return Value::Dashes(v, corner);
    }
    if OPACITY_STOPS.contains(&id)
        && let Some(n) = enc.u32_at(data, 0).map(|n| n as usize)
        && n > 0
        && data.len() == 4 + n * 24
        && let Some(stops) = (0..n)
            .map(|i| {
                let at = |k: usize| f(4 + (3 * i + k) * 8);
                Some([at(0)?, at(1)?, at(2)?])
            })
            .collect::<Option<Vec<_>>>()
    {
        return Value::Stops(stops);
    }
    let value = match (t, data.len()) {
        (ty::DOUBLE, 8) => f(0).map(Value::Double),
        (ty::INT, 4) => enc.i32_at(data, 0).map(Value::Int),
        (ty::ENUM | ty::CAPTION_POSITION, 2) => enc.u16_at(data, 0).map(Value::Enum),
        (ty::REF, 4) => enc.u32_at(data, 0).map(Value::Ref),
        (ty::POINT, 16) => f(0).zip(f(8)).map(|(x, y)| Value::Point(x, y)),
        // A flag byte and an in-object string, as form fields store their
        // names (objects.md, form fields).
        (ty::STRING | ty::FORM_STRING, _) => (|| {
            let mut c = enc.cursor(data);
            c.flag()?;
            Ok::<_, Error>(Value::String(c.string()?))
        })()
        .ok(),
        // Other 4-byte types are references or codes (for example a
        // corner effect ID); keep the number.
        (_, 4) => enc.u32_at(data, 0).map(Value::Ref),
        _ => None,
    };
    value.unwrap_or_else(|| Value::Other(t, data.to_vec()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_stroke_weight() {
        // One attribute: 0x6E65 = double 0.25, plus a 6-byte trailer value.
        let mut d = 1u32.to_le_bytes().to_vec();
        d.extend_from_slice(&0x6E65u32.to_le_bytes());
        d.extend_from_slice(&28u16.to_le_bytes());
        d.extend_from_slice(&2u16.to_le_bytes());
        d.extend_from_slice(&ty::DOUBLE.to_le_bytes());
        d.extend_from_slice(&8u16.to_le_bytes());
        d.extend_from_slice(&0.25f64.to_le_bytes());
        d.extend_from_slice(&0x6E63u32.to_le_bytes());
        d.extend_from_slice(&6u16.to_le_bytes());
        d.extend_from_slice(&[0; 6]);
        let a = Attrs::parse(Encoding::default(), &d, List::Item, None).unwrap();
        assert_eq!(a.get(0x6E65), Some(&Value::Double(0.25)));
    }

    #[test]
    fn decodes_dashes_and_glyph_names() {
        let enc = Encoding::default();
        // 8 bytes, count 2, two f64, corner code 3.
        let mut d = vec![0; 8];
        d.extend_from_slice(&2u32.to_le_bytes());
        d.extend_from_slice(&4.0f64.to_le_bytes());
        d.extend_from_slice(&2.0f64.to_le_bytes());
        d.extend_from_slice(&3u16.to_le_bytes());
        assert_eq!(
            decode(enc, DASHES, 0x5A36, &d),
            Value::Dashes(vec![4.0, 2.0], 3)
        );
        // A count that does not fit the length is not a dash list.
        d[8] = 3;
        assert!(matches!(decode(enc, DASHES, 0x5A36, &d), Value::Other(..)));
        let mut g = 5u16.to_le_bytes().to_vec();
        g.extend_from_slice(b"a.alt");
        g.extend_from_slice(&7u32.to_le_bytes());
        assert_eq!(
            decode_text(enc, 0x1B5E, 0x1B26, &g),
            Value::Glyph("a.alt".into())
        );
        assert!(matches!(
            decode_text(enc, 0x1B5E, 0x1B26, &g[..6]),
            Value::Other(..)
        ));
    }

    #[test]
    fn decodes_alternate_glyph_features_in_both_byte_orders() {
        use crate::header::{ByteOrder, Version};
        let le = Encoding::default();
        let mut d = 1u16.to_le_bytes().to_vec();
        d.extend_from_slice(b"aalt");
        d.extend_from_slice(&2u32.to_le_bytes());
        let aalt = Value::Features(vec![("aalt".into(), 2)]);
        assert_eq!(decode_text(le, 0x42AE, 0x42DF, &d), aalt);
        let be = Encoding::new(ByteOrder::Big, Version { major: 4, minor: 0 });
        let mut b = 1u16.to_be_bytes().to_vec();
        b.extend_from_slice(b"aalt");
        b.extend_from_slice(&2u32.to_be_bytes());
        assert_eq!(decode_text(be, 0x42AE, 0x42DF, &b), aalt);
        // A style stores an empty list.
        assert_eq!(
            decode_text(le, 0x42AE, 0x42DF, &[0, 0]),
            Value::Features(Vec::new())
        );
        // A count larger than the data, or a tag that is not text.
        d[0] = 2;
        assert!(matches!(
            decode_text(le, 0x42AE, 0x42DF, &d),
            Value::Other(..)
        ));
        d[0] = 1;
        d[2] = 0;
        assert!(matches!(
            decode_text(le, 0x42AE, 0x42DF, &d),
            Value::Other(..)
        ));
    }

    #[test]
    fn parses_a_stroke_type_code() {
        // 0x6E6E: reference 0, code 0x5A39, then the 6-byte trailer value.
        let mut d = 1u32.to_le_bytes().to_vec();
        d.extend_from_slice(&0x6E6Eu32.to_le_bytes());
        d.extend_from_slice(&34u16.to_le_bytes());
        d.extend_from_slice(&3u16.to_le_bytes());
        for (t, v) in [(ty::REF, 0u32), (ty::CODE, 0x5A39)] {
            d.extend_from_slice(&t.to_le_bytes());
            d.extend_from_slice(&4u16.to_le_bytes());
            d.extend_from_slice(&v.to_le_bytes());
        }
        d.extend_from_slice(&0x6E63u32.to_le_bytes());
        d.extend_from_slice(&6u16.to_le_bytes());
        d.extend_from_slice(&[0; 6]);
        let a = Attrs::parse(Encoding::default(), &d, List::Item, None).unwrap();
        assert_eq!(a.get(0x6E6E), Some(&Value::RefOrCode(0, 0x5A39)));
    }

    /// One text attribute record: ID, then a single value of type 0.
    fn text_record(id: u32, value: &[u8]) -> Vec<u8> {
        let mut d = id.to_le_bytes().to_vec();
        d.extend_from_slice(&(8 + value.len() as u16).to_le_bytes());
        d.extend_from_slice(&1u16.to_le_bytes());
        d.extend_from_slice(&0u32.to_le_bytes());
        d.extend_from_slice(&(value.len() as u16).to_le_bytes());
        d.extend_from_slice(value);
        d
    }

    fn text_value(id: u32, value: &[u8]) -> Value {
        let d = text_record(id, value);
        let a =
            Attrs::parse_text(&mut Encoding::default().cursor(&d), 1, List::Text, None).unwrap();
        a.get(id).unwrap().clone()
    }

    #[test]
    fn decodes_tab_stops() {
        // Two stops: 12 pt left aligned, 237.5 pt right aligned with "." leader.
        let mut b = 2u16.to_le_bytes().to_vec();
        b.extend(12f64.to_le_bytes());
        b.extend([0, 0, 0, 0]);
        b.extend(237.5f64.to_le_bytes());
        b.extend([2, 0, 1, 0, b'.', 0]);
        let Value::TabList(stops) = text_value(0x1B29, &b) else {
            panic!("not a tab list");
        };
        assert_eq!(stops.len(), 2);
        assert_eq!((stops[0].position, stops[0].alignment), (12.0, 0));
        assert_eq!(
            (
                stops[1].position,
                stops[1].alignment,
                stops[1].leader.as_str()
            ),
            (237.5, 2, ".")
        );
        assert_eq!(text_value(0x1B29, &[0, 0]), Value::TabList(Vec::new()));
        // A stop cut short.
        assert!(matches!(text_value(0x1B29, &b[..20]), Value::Other(..)));
        // A stop aligned on a comma stores the character after the code.
        let mut c = 1u16.to_le_bytes().to_vec();
        c.extend(337f64.to_le_bytes());
        c.extend([3, 0, b',', 0, 1, 0, b'.', 0]);
        let Value::TabList(stops) = text_value(0x1B29, &c) else {
            panic!("not a tab list");
        };
        assert_eq!(stops[0].character.as_deref(), Some(","));
        assert_eq!(stops[0].leader, ".");
    }

    #[test]
    fn decodes_nested_style_delimiters() {
        let d = |c| nested_delimiter(c);
        assert_eq!(d("^c"), Some((Delimiter::Dropcap, 1, true)));
        assert_eq!(d("[.]"), Some((Delimiter::Character(".".into()), 1, false)));
        assert_eq!(d("(:)"), Some((Delimiter::Character(":".into()), 1, true)));
        assert_eq!(d("(^w)5"), Some((Delimiter::AnyWord, 5, true)));
        assert_eq!(d("(^?)"), Some((Delimiter::AnyCharacter, 1, true)));
        assert_eq!(d("(^c)"), Some((Delimiter::Dropcap, 1, true)));
        assert_eq!(d("[^t]"), Some((Delimiter::Tabs, 1, false)));
        assert_eq!(d("(^L)2"), Some((Delimiter::Repeat, 2, true)));
        assert_eq!(d("(^x)"), None);
        assert_eq!(d("^t"), None);
    }

    #[test]
    fn decodes_nested_styles() {
        // One style: character style 7 up to and including 2 words.
        let mut b = 1u32.to_le_bytes().to_vec();
        b.extend(7u32.to_le_bytes());
        b.extend(5u32.to_le_bytes());
        b.extend([5, 0x40, b'(', b'^', b'w', b')', b'2']);
        let nested = vec![NestedStyle {
            style: 7,
            delimiter: Delimiter::AnyWord,
            repetition: 2,
            inclusive: true,
        }];
        assert_eq!(
            text_value(0x1B75, &b),
            Value::StyleList {
                count: 1,
                items: Some(StyleItems::Nested(nested))
            }
        );
        // The same record as a GREP style: the code is the expression.
        assert_eq!(
            text_value(0x1BBA, &b),
            Value::StyleList {
                count: 1,
                items: Some(StyleItems::Grep(vec![GrepStyle {
                    style: 7,
                    expression: "(^w)2".into()
                }]))
            }
        );
        // A line style: character style 7 for 3 lines; a byte too many
        // leaves the records undecoded.
        let mut l = 1u32.to_le_bytes().to_vec();
        l.extend(7u32.to_le_bytes());
        l.extend(3u32.to_le_bytes());
        assert_eq!(
            text_value(0x1BBB, &l),
            Value::StyleList {
                count: 1,
                items: Some(StyleItems::Line(vec![LineStyle { style: 7, lines: 3 }]))
            }
        );
        l.push(0);
        assert_eq!(
            text_value(0x1BBB, &l),
            Value::StyleList {
                count: 1,
                items: None
            }
        );
    }

    #[test]
    fn decodes_bullet_chars_and_strings() {
        let b = [0, 0, 0, 0, 0x22, 0x20, 0, 0];
        assert_eq!(
            text_value(0x1A406, &b),
            Value::BulletChar {
                kind: 0,
                value: 0x2022
            }
        );
        // Font style: flag byte, then an in-object string.
        let b = [0, 2, 0, 4, 0, 4, 0x40, b'B', b'o', b'l', b'd'];
        assert_eq!(text_value(0x1B02, &b), Value::String("Bold".into()));
        // Ruby font style: an empty string whose second byte is 1.
        let b = [0, 2, 1, 0, 0];
        assert_eq!(text_value(0x4234, &b), Value::String(String::new()));
        // Ruby text: u32 length, then segments.
        let b = [2, 0, 0, 0, 2, 0x40, b'a', b'b'];
        assert_eq!(text_value(0x422E, &b), Value::Text("ab".into()));
        // Other attributes are numbers by length.
        assert_eq!(
            text_value(0x1B03, &12f64.to_le_bytes()),
            Value::Double(12.0)
        );
    }

    #[test]
    fn decodes_opacity_stops() {
        let mut v = 2u32.to_le_bytes().to_vec();
        for f in [0.15, 0.5, 100.0, 0.85, 1.0, 0.0f64] {
            v.extend(f.to_le_bytes());
        }
        let mut d = 1u32.to_le_bytes().to_vec();
        d.extend(0x1EB8Cu32.to_le_bytes());
        d.extend((8 + v.len() as u16).to_le_bytes());
        d.extend(1u16.to_le_bytes());
        d.extend(0u32.to_le_bytes());
        d.extend((v.len() as u16).to_le_bytes());
        d.extend(&v);
        let a = Attrs::parse(Encoding::default(), &d, List::Item, None).unwrap();
        assert_eq!(
            a.get(0x1EB8C),
            Some(&Value::Stops(vec![[0.15, 0.5, 100.0], [0.85, 1.0, 0.0]]))
        );
    }
}
