//! Value kinds: how a decoded attribute value becomes IDML text. The
//! attribute tables of text, page item, frame fitting, cell, table and
//! transparency attributes (`attrs.rs`, `transparency.rs`) all name one
//! of these kinds, and [`Writer::value`] converts every kind.
//!
//! Evidence for each table entry: `docs/format/attributes.md`,
//! `tables.md` and `transparency.md`.

use super::*;
use crate::model::Value;
use crate::model::attrs::StyleItems;

/// How an attribute value is written in IDML.
#[derive(Clone, Copy)]
pub(super) enum Kind {
    /// A number: an f64, an integer, an enumeration value or a 4-byte
    /// value.
    Number,
    /// A number the IDML schema limits to this range (inclusive); values
    /// outside it have no IDML value.
    Range(f64, f64),
    /// Stored as a fraction, written as the fraction times 100 with every
    /// digit of the product, as IDML writes it (`112.99999999999999`).
    Percent,
    /// Multiplied by the factor when written.
    Scale(f64),
    /// Manual kerning in ems, written in thousandths of an em rounded to
    /// a whole number (−0 as 0); 1e8, no manual kerning, is written
    /// `1e+11`.
    Kerning,
    /// An integer, written as such.
    Integer,
    /// A number, left out when 0.
    NonZero,
    /// A cell edge stroke or gap tint: −1 is written as 100.
    EdgeTint,
    /// A page item or object style tint: 100 is written as −1.
    Tint,
    /// The given value is written as the enumeration value, others as
    /// numbers of the given IDML type.
    NumberOr(f64, &'static str, &'static str),
    /// A leading: negative for `Auto`.
    Leading,
    /// True when the value equals the given code.
    Equals(u32),
    /// 0 false, 1 true; other codes are not known.
    Bool,
    /// An enumeration value by code.
    Enum(&'static [(u32, &'static str)]),
    /// A built-in style named by its code (reference 0), written as
    /// `<prefix><name>`.
    Builtin(&'static str, &'static [(u32, &'static str)]),
    /// A stroke style code in the first of two words; the second is 0.
    StrokeType,
    /// Two f64.
    Point,
    /// A swatch UID.
    Swatch,
    /// A swatch, or 0 for "Text Color".
    SwatchOrText,
    /// A swatch, or 0 for the swatch `None`.
    SwatchOrNone,
    /// A font family, or the composite font of that name as an object
    /// (`docs/format/fonts.md`, composite fonts as applied fonts).
    Font,
    /// A font family, written as its name also for a composite font.
    FamilyName,
    /// A font family, or 0 for none (`$ID/`).
    FontOrNone,
    /// A numbering list UID.
    NumberingList,
    /// Codes written as strings of type `string`.
    EnumString(&'static [(u32, &'static str)]),
    /// A string.
    String,
    /// A glyph name, written as `$ID/<name>`; left out when empty.
    GlyphName,
    /// One OpenType feature of a single glyph, written as a list of the
    /// tag (`$ID/<tag>`) and the number; other counts are left out.
    Features,
    /// Dash and gap lengths, separated by spaces.
    Dashes,
    /// The corner adjustment of a dash list: 3 `DashesAndGaps`.
    DashCorner,
    /// A string, or the empty string for `Nothing`.
    StringOrNothing,
    /// The empty string, written as `Nothing`; other strings are left out.
    EmptyAsNothing,
    /// Text; left out when empty.
    Text,
    /// A language object, written as `$ID/<name>`.
    Language,
    /// A character style reference.
    CharacterStyle,
    /// A cell style UID; 0 is written as `n`.
    CellStyle,
    /// A kinsoku or mojikumi set: 0 `Nothing`, a built-in table (written
    /// as its enumeration value) or a custom kinsoku table (an object).
    CjkSet,
    /// A list of tab stops (`TabList`).
    TabList,
    /// A list of nested styles (`AllNestedStyles`); left out when empty.
    NestedStyles,
    /// A list of GREP styles (`AllGREPStyles`); left out when empty.
    GrepStyles,
    /// A list of line styles (`AllLineStyles`); left out when empty.
    LineStyles,
    /// A bullet character (`BulletChar`).
    BulletChar,
    /// A numbering restart policy (`NumberingRestartPolicies`): three
    /// words, of which only the observed combinations are known.
    RestartPolicies,
}

impl Kind {
    /// Whether a value without an IDML value is reported to `indd audit`
    /// as an unknown code.
    pub(super) fn is_code(self) -> bool {
        matches!(
            self,
            Kind::Enum(_)
                | Kind::EnumString(_)
                | Kind::Builtin(..)
                | Kind::StrokeType
                | Kind::Bool
                | Kind::RestartPolicies
        )
    }
}

/// Built-in kinsoku and mojikumi tables observed in the corpus
/// (`docs/format/attributes.md`): table name and IDML enumeration value.
const BUILTIN_CJK_TABLES: [(&str, &str); 11] = [
    ("kHardKinsokuName", "HardKinsoku"),
    ("kSoftKinsokuName", "SoftKinsoku"),
    ("kKoreanKinsokuName", "KoreanKinsoku"),
    ("kSimpChineseKinsokuName", "SimplifiedChineseKinsoku"),
    ("kTradChineseKinsokuName", "TraditionalChineseKinsoku"),
    ("kMojikumiDefaultName1", "LineEndAllOneHalfEmEnum"),
    (
        "kMojikumiDefaultName2",
        "OneEmIndentLineEndUkeOneHalfEmEnum",
    ),
    ("kMojikumiDefaultName10", "LineEndAllOneEmEnum"),
    ("kMojikumiDefaultName14", "LineEndPeriodOneEmEnum"),
    ("kMojikumiDefaultName15", "TradChineseDefault"),
    ("kMojikumiDefaultName16", "SimpChineseDefault"),
];

/// The IDML enumeration value of a built-in kinsoku or mojikumi table.
pub(super) fn builtin_cjk_table(name: &str) -> Option<&'static str> {
    BUILTIN_CJK_TABLES
        .iter()
        .find(|(k, _)| *k == name)
        .map(|(_, e)| *e)
}

fn text(ty: &'static str, s: String) -> (&'static str, PropValue) {
    (ty, PropValue::Text(s))
}

impl Writer<'_> {
    /// The IDML type and value of `v` written as `kind`; `None` if it has
    /// no IDML value.
    pub(super) fn value(&self, kind: Kind, v: &Value) -> Option<(&'static str, PropValue)> {
        let swatch = |u: u32| self.doc.swatches.get(&u).cloned();
        let number = || v.as_f64().or(v.as_u32().map(f64::from));
        match kind {
            Kind::Number => number().map(|f| text("unit", num(f))),
            Kind::Range(lo, hi) => v
                .as_f64()
                .filter(|f| (lo..=hi).contains(f))
                .map(|f| text("unit", num(f))),
            Kind::Percent => v.as_f64().map(|f| text("unit", num(f * 100.0))),
            Kind::Scale(k) => v.as_f64().map(|f| text("unit", num(round(f * k)))),
            Kind::Kerning => v.as_f64().map(|f| {
                if f == KERNING_NONE {
                    text("unit", "1e+11".into())
                } else {
                    // Adding 0 turns −0 into 0.
                    text("unit", num((f * 1000.0).round() + 0.0))
                }
            }),
            Kind::Integer => v.as_u32().map(|u| text("long", u.to_string())),
            Kind::EdgeTint => {
                number().map(|f| text("unit", num(if f == -1.0 { 100.0 } else { f })))
            }
            Kind::Tint => number().map(|f| text("unit", num(if f == 100.0 { -1.0 } else { f }))),
            Kind::NonZero => v
                .as_u32()
                .filter(|&u| u != 0)
                .map(|u| text("long", u.to_string())),
            Kind::NumberOr(code, name, ty) => v.as_f64().map(|f| {
                if f == code {
                    text("enumeration", name.to_string())
                } else {
                    text(ty, num(f))
                }
            }),
            Kind::Leading => v.as_f64().map(|f| {
                if f < 0.0 {
                    text("enumeration", "Auto".into())
                } else {
                    text("unit", num(f))
                }
            }),
            Kind::Equals(t) => v.as_u32().map(|u| text("boolean", (u == t).to_string())),
            Kind::Bool => match v.as_u32()? {
                0 => Some(text("boolean", "false".into())),
                1 => Some(text("boolean", "true".into())),
                _ => None,
            },
            Kind::EnumString(map) => v
                .as_u32()
                .and_then(|u| map.iter().find(|(k, _)| *k == u))
                .map(|(_, n)| text("string", n.to_string())),
            Kind::Enum(map) => v
                .as_u32()
                .and_then(|u| map.iter().find(|(k, _)| *k == u))
                .map(|(_, n)| text("enumeration", n.to_string())),
            Kind::Builtin(prefix, map) => match v {
                Value::RefOrCode(0, code) => map
                    .iter()
                    .find(|(k, _)| k == code)
                    .map(|(_, n)| text("object", format!("{prefix}{n}"))),
                // A custom stroke style, by its UID (attributes.md, custom
                // stroke styles).
                Value::RefOrCode(r, CUSTOM_STROKE_TYPE) if map == STROKE_TYPES => self
                    .doc
                    .stroke_styles
                    .iter()
                    .find(|s| s.uid == *r)
                    .map(|s| text("object", custom_stroke_ref(s))),
                _ => None,
            },
            Kind::StrokeType => match *v {
                Value::Words(CELL_NO_STROKE_TYPE, 0) => Some(text("object", "n".into())),
                Value::Words(code, 0) => STROKE_TYPES
                    .iter()
                    .find(|(k, _)| *k == code)
                    .map(|(_, n)| text("object", format!("StrokeStyle/$ID/{n}"))),
                _ => None,
            },
            Kind::Point => match *v {
                Value::Point(x, y) => Some(text("unit", nums(&[x, y]))),
                _ => None,
            },
            Kind::Swatch => v.as_u32().and_then(swatch).map(|s| text("object", s)),
            Kind::SwatchOrText => match v.as_u32()? {
                0 => Some(text("string", "Text Color".into())),
                u => swatch(u).map(|s| text("object", s)),
            },
            Kind::SwatchOrNone => match v.as_u32()? {
                0 => Some(text("object", "Swatch/None".into())),
                u => swatch(u).map(|s| text("object", s)),
            },
            Kind::NumberingList => v
                .as_u32()
                .and_then(|u| self.doc.numbering_lists.iter().find(|l| l.uid == u))
                .map(|l| text("object", format!("NumberingList/{}", self_name(&l.name)))),
            Kind::Font => v.as_u32().and_then(|u| self.doc.fonts.get(&u)).map(|f| {
                match self.composite_font_of(f) {
                    Some(c) => text(
                        "object",
                        format!("CompositeFont/{}", self_name(&c.name.idml())),
                    ),
                    None => text("string", self.family_names(f).0),
                }
            }),
            Kind::FamilyName => v
                .as_u32()
                .and_then(|u| self.doc.fonts.get(&u))
                .map(|f| text("string", self.family_names(f).0)),
            Kind::FontOrNone => match v.as_u32()? {
                0 => Some(text("string", "$ID/".into())),
                u => self
                    .doc
                    .fonts
                    .get(&u)
                    .map(|f| text("string", self.family_names(f).0)),
            },
            Kind::String => v.as_string().map(|s| text("string", s)),
            Kind::Dashes => match v {
                Value::Dashes(d, _) => Some(text("unit", nums(d))),
                _ => None,
            },
            Kind::DashCorner => match v {
                Value::Dashes(_, 3) => Some(text("enumeration", "DashesAndGaps".into())),
                _ => None,
            },
            Kind::GlyphName => match v {
                Value::Glyph(name) if !name.is_empty() => {
                    Some(text("string", format!("$ID/{name}")))
                }
                _ => None,
            },
            Kind::Features => match v {
                Value::Features(f) if f.len() == 1 => Some((
                    "list",
                    PropValue::Lists(vec![vec![
                        ("string", format!("$ID/{}", f[0].0)),
                        ("long", f[0].1.to_string()),
                    ]]),
                )),
                _ => None,
            },
            Kind::StringOrNothing => v.as_string().map(|s| {
                if s.is_empty() {
                    text("enumeration", "Nothing".into())
                } else {
                    text("string", s)
                }
            }),
            Kind::EmptyAsNothing => v
                .as_string()
                .filter(|s| s.is_empty())
                .map(|_| text("enumeration", "Nothing".into())),
            Kind::Text => match v {
                Value::Text(t) if !t.is_empty() => Some(text("string", t.clone())),
                _ => None,
            },
            Kind::Language => v
                .as_u32()
                .and_then(|u| self.doc.languages.get(&u))
                // `Neutral` is `[No Language]` without `$ID/` (attributes.md,
                // languages).
                .map(|l| match l.as_str() {
                    "Neutral" => text("string", "[No Language]".into()),
                    l => text("string", builtin_key(l)),
                }),
            Kind::CharacterStyle => v
                .as_u32()
                .map(|u| text("object", self.style_ref(Some(u).filter(|&u| u != 0), false))),
            Kind::CellStyle => match v.as_u32()? {
                0 => Some(text("object", "n".into())),
                u => self
                    .doc
                    .cell_styles
                    .get(&u)
                    .map(|s| text("object", self.table_style_ref("CellStyle", s))),
            },
            Kind::CjkSet => {
                let u = v.as_u32()?;
                if u == 0 {
                    return Some(text("enumeration", "Nothing".into()));
                }
                let t = self.doc.cjk_tables.iter().find(|t| t.uid == u)?;
                if t.name.builtin {
                    return builtin_cjk_table(&t.name.name)
                        .map(|e| text("enumeration", e.to_string()));
                }
                let tag = match (t.mojikumi, &t.custom_mojikumi) {
                    (false, _) => "KinsokuTable",
                    (true, Some(_)) => "MojikumiTable",
                    (true, None) => return None,
                };
                Some(text("object", format!("{tag}/{}", self_name(&t.name.name))))
            }
            Kind::TabList => match v {
                Value::TabList(stops) => tab_list(stops).map(|l| ("list", PropValue::List(l))),
                _ => None,
            },
            Kind::NestedStyles => match v {
                Value::StyleList {
                    items: Some(StyleItems::Nested(n)),
                    ..
                } if !n.is_empty() => Some(("list", PropValue::List(self.nested_styles(n)))),
                _ => None,
            },
            Kind::GrepStyles => match v {
                Value::StyleList {
                    items: Some(StyleItems::Grep(g)),
                    ..
                } if !g.is_empty() => Some(("list", PropValue::List(self.grep_styles(g)))),
                _ => None,
            },
            Kind::LineStyles => match v {
                Value::StyleList {
                    items: Some(StyleItems::Line(l)),
                    ..
                } if !l.is_empty() => Some(("list", PropValue::List(self.line_styles(l)))),
                _ => None,
            },
            Kind::BulletChar => match *v {
                Value::BulletChar { kind, value } => bullet_char(kind, value).map(|a| ("", a)),
                _ => None,
            },
            Kind::RestartPolicies => match *v {
                Value::Words3(w) => restart_policies(w).map(|a| ("", a)),
                _ => None,
            },
        }
    }

    /// The IDML text of `v` written as `kind`, for a plain attribute.
    pub(super) fn value_text(&self, kind: Kind, v: &Value) -> Option<String> {
        match self.value(kind, v)?.1 {
            PropValue::Text(t) => Some(t),
            _ => None,
        }
    }

    /// The IDML values of the attributes of `attrs` listed in `table` (ID,
    /// IDML name, kind), in table order. Values without an IDML value are
    /// left out; unknown codes are reported to `indd audit`.
    pub(super) fn attr_values(
        &self,
        attrs: &Attrs,
        table: &[(u32, &'static str, Kind)],
    ) -> Vec<(&'static str, String)> {
        let mut out = Vec::new();
        for &(id, name, kind) in table {
            let Some(v) = attrs.get(id) else { continue };
            match self.value_text(kind, v) {
                Some(t) => out.push((name, t)),
                None if kind.is_code() => attrs.unknown_code(id, v),
                None => {}
            }
        }
        out
    }
}
