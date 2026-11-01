//! Text forms of IDML values: numbers, matrices, base64 data, object
//! references, escaped names, UI colours and `<Properties>` children. These
//! follow the IDML specification; they hold no INDD facts.

use super::*;
use crate::model::xmp::{XmpDate, civil_from_days, day_of_year};

/// The IDML name of an XML tag colour (red, green, blue fractions);
/// `None` for colours without evidence. See `docs/format/objects.md`.
pub(super) fn xml_tag_color(rgb: [f64; 3]) -> Option<&'static str> {
    ui_color_name(rgb)
}

/// The IDML name of an interface colour (class 0x1F11) by its red, green
/// and blue fractions. See `docs/format/objects.md`, interface colours.
pub(super) fn ui_color_name(rgb: [f64; 3]) -> Option<&'static str> {
    const NAMES: [([f64; 3], &str); 29] = [
        ([0.31, 0.6, 1.0], "LightBlue"),
        ([1.0, 0.0, 0.0], "Red"),
        ([0.31, 1.0, 0.31], "Green"),
        ([0.0, 0.0, 1.0], "Blue"),
        ([1.0, 1.0, 0.31], "Yellow"),
        ([1.0, 0.31, 1.0], "Magenta"),
        ([0.0, 1.0, 1.0], "Cyan"),
        ([0.5, 0.5, 0.5], "Gray"),
        ([0.0, 0.0, 0.0], "Black"),
        ([0.6, 0.0, 0.0], "BrickRed"),
        ([1.0, 0.6, 0.0], "Gold"),
        ([1.0, 0.4, 0.0], "Orange"),
        ([0.0, 0.33, 0.0], "DarkGreen"),
        ([0.6, 0.6, 1.0], "Lavender"),
        ([0.67, 0.64, 0.71], "Charcoal"),
        ([0.6, 0.2, 1.0], "Violet"),
        ([1.0, 1.0, 1.0], "White"),
        ([1.0, 0.6, 0.8], "Pink"),
        ([0.61, 0.87, 0.61], "GridGreen"),
        ([0.0, 0.0, 0.53], "DarkBlue"),
        ([0.6, 0.8, 0.0], "GrassGreen"),
        ([0.81, 0.51, 0.71], "Lipstick"),
        ([1.0, 0.71, 0.42], "GridOrange"),
        ([0.97, 0.35, 0.42], "Fiesta"),
        ([0.0, 0.6, 0.6], "Teal"),
        ([0.73, 0.73, 0.73], "LightGray"),
        ([0.48, 0.73, 0.85], "GridBlue"),
        ([1.0, 0.6, 0.6], "Peach"),
        ([0.6, 0.0, 0.2], "Burgundy"),
    ];
    NAMES
        .iter()
        .find(|(c, _)| c.iter().zip(rgb).all(|(a, b)| (a - b).abs() < 1e-4))
        .map(|(_, n)| *n)
}

/// The `PageColor` property of a page colour.
pub(super) fn page_color(c: &UiColorRef) -> Option<Node> {
    let name = match c {
        UiColorRef::UseMaster => "UseMasterColor",
        UiColorRef::Nothing => "Nothing",
        UiColorRef::Rgb(rgb) => return ui_color_property("PageColor", *rgb),
        _ => return None,
    };
    Some(Node {
        tag: "PageColor".into(),
        attrs: vec![("type".into(), "enumeration".into())],
        text: Some(name.into()),
        children: Vec::new(),
    })
}

/// The `BaselineFrameGridColor` property of a baseline frame grid colour
/// (preferences.md, baseline frame grid colour).
pub(super) fn frame_grid_color(c: crate::model::prefs::FrameGridColor) -> Option<Node> {
    use crate::model::prefs::FrameGridColor;
    let name = match c {
        FrameGridColor::Rgb(rgb) => return ui_color_property("BaselineFrameGridColor", rgb),
        FrameGridColor::Charcoal => "Charcoal",
        FrameGridColor::LightBlue => "LightBlue",
    };
    Some(Node {
        tag: "BaselineFrameGridColor".into(),
        attrs: vec![("type".into(), "enumeration".into())],
        text: Some(name.into()),
        children: Vec::new(),
    })
}

/// Put `property` in the `Properties` of `node`, in place of a property
/// of the same name.
pub(super) fn set_property(node: &mut Node, property: Node) {
    let i = match node.children.iter().position(|c| c.tag == "Properties") {
        Some(i) => i,
        None => {
            node.children.insert(
                0,
                Node {
                    tag: "Properties".into(),
                    ..Node::default()
                },
            );
            0
        }
    };
    let props = &mut node.children[i].children;
    match props.iter_mut().find(|c| c.tag == property.tag) {
        Some(c) => *c = property,
        None => props.push(property),
    }
}

/// A `Properties` child as a values node.
pub(super) fn prop_node(p: &Property) -> Node {
    let (name, ty, value) = p;
    let mut n = Node {
        tag: name.to_string(),
        ..Node::default()
    };
    if !ty.is_empty() {
        n.attrs.push(("type".into(), ty.to_string()));
    }
    match value {
        PropValue::Text(t) => n.text = Some(t.clone()),
        PropValue::Attributes(a) => {
            n.attrs
                .extend(a.iter().map(|(k, v)| (k.to_string(), v.clone())));
        }
        PropValue::List(items) => {
            for item in items {
                n.children.push(Node {
                    tag: "ListItem".into(),
                    attrs: vec![("type".into(), "record".into())],
                    children: item
                        .iter()
                        .map(|(f, t, text)| Node {
                            tag: f.to_string(),
                            attrs: vec![("type".into(), t.to_string())],
                            text: Some(text.clone()),
                            children: Vec::new(),
                        })
                        .collect(),
                    text: None,
                });
            }
        }
        PropValue::Lists(lists) => {
            for list in lists {
                n.children.push(Node {
                    tag: "ListItem".into(),
                    attrs: vec![("type".into(), "list".into())],
                    children: list
                        .iter()
                        .map(|(t, text)| Node {
                            tag: "ListItem".into(),
                            attrs: vec![("type".into(), t.to_string())],
                            text: Some(text.clone()),
                            children: Vec::new(),
                        })
                        .collect(),
                    text: None,
                });
            }
        }
    }
    n
}

/// A `Properties` child for an interface colour: its name as an
/// enumeration, or, for a colour of whole 255ths without a name, the three
/// numbers as a list. `None` for other colours.
pub(super) fn ui_color_property(tag: &str, rgb: [f64; 3]) -> Option<Node> {
    if let Some(name) = ui_color_name(rgb) {
        return Some(Node {
            tag: tag.into(),
            attrs: vec![("type".into(), "enumeration".into())],
            text: Some(name.into()),
            children: Vec::new(),
        });
    }
    let whole: Vec<f64> = rgb.iter().map(|v| (v * 255.0).round()).collect();
    if whole
        .iter()
        .zip(rgb)
        .any(|(w, v)| (w / 255.0 - v).abs() > 1e-6)
    {
        return None;
    }
    Some(Node {
        tag: tag.into(),
        attrs: vec![("type".into(), "list".into())],
        text: None,
        children: whole
            .iter()
            .map(|w| Node {
                tag: "ListItem".into(),
                attrs: vec![("type".into(), "double".into())],
                text: Some(num(*w)),
                children: Vec::new(),
            })
            .collect(),
    })
}

/// A number as IDML text: the shortest decimal that reads back as the same
/// value. When two decimals of that length read back as the value, IDML
/// takes the one nearest to the exact value, with ties to the even digit
/// (`150.23599243164062`, where Rust's shortest form has `…063`). Numbers
/// below 1e-4 are written with an exponent of at least two digits
/// (`5.684341886080802e-14`), all others in plain notation; see
/// `docs/format/idml-values.md`, number format. IDML keeps negative zero
/// (`1 -0 -0 1 0 0`). IDML has no text for NaN or infinity; they are
/// written as 0, which keeps the package valid.
pub fn num(v: f64) -> String {
    if !v.is_finite() {
        return "0".to_string();
    }
    if v == 0.0 {
        return if v.is_sign_negative() { "-0" } else { "0" }.into();
    }
    // The shortest digits that read back as v, then the decimal of that
    // length nearest to the exact value (`{:.*e}` rounds ties to even),
    // if it also reads back as v.
    let shortest = format!("{v:e}");
    let Some((mantissa, _)) = shortest.split_once('e') else {
        return format!("{v}");
    };
    let len = mantissa.chars().filter(char::is_ascii_digit).count();
    let nearest = format!("{:.*e}", len.saturating_sub(1), v);
    let sci = if nearest.parse::<f64>() == Ok(v) {
        nearest
    } else {
        shortest
    };
    let Some((mantissa, exp)) = sci.split_once('e') else {
        return format!("{v}");
    };
    let Ok(exp) = exp.parse::<i32>() else {
        return format!("{v}");
    };
    let (sign, mantissa) = match mantissa.strip_prefix('-') {
        Some(m) => ("-", m),
        None => ("", mantissa),
    };
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let digits = digits.trim_end_matches('0');
    let digits = if digits.is_empty() { "0" } else { digits };
    let text = if exp < -4 {
        let (first, rest) = digits.split_at(1);
        let point = if rest.is_empty() { "" } else { "." };
        format!("{first}{point}{rest}e-{:02}", -exp)
    } else if exp < 0 {
        format!("0.{}{digits}", "0".repeat((-exp - 1) as usize))
    } else {
        // The decimal point goes after `exp + 1` digits.
        let point = exp as usize + 1;
        if point >= digits.len() {
            format!("{digits}{}", "0".repeat(point - digits.len()))
        } else {
            let (int, frac) = digits.split_at(point);
            format!("{int}.{frac}")
        }
    };
    format!("{sign}{text}")
}

/// A link time (FILETIME: 100 ns intervals since 1601-01-01 UTC) as IDML
/// writes it, `YYYY-MM-DDTHH:MM:SS` in the local time of the computer that
/// exported the IDML. The INDD does not store that time zone; the offset
/// is taken from the XMP date nearest in day of the year (ties: the
/// latest date), or UTC without XMP dates. See `docs/format/objects.md`,
/// link times.
pub(super) fn link_time(filetime: u64, dates: &[XmpDate]) -> String {
    let utc = (filetime / 10_000_000) as i64 - 11_644_473_600;
    let day = day_of_year(utc);
    let distance = |d: &XmpDate| (day_of_year(d.utc) - day).abs();
    let offset = dates
        .iter()
        .min_by(|a, b| distance(a).cmp(&distance(b)).then(b.utc.cmp(&a.utc)))
        .map_or(0, |d| d.offset);
    let local = utc + offset;
    let (year, month, day) = civil_from_days(local.div_euclid(86_400));
    let secs = local.rem_euclid(86_400);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}",
        secs / 3600,
        secs / 60 % 60,
        secs % 60
    )
}

/// Round away binary noise from scaled values (0.8 * 100 = 80.00000000000001).
pub(crate) fn round(v: f64) -> f64 {
    (v * 1e9).round() / 1e9
}

pub(super) fn nums(v: &[f64]) -> String {
    v.iter().map(|&x| num(x)).collect::<Vec<_>>().join(" ")
}

pub(super) fn matrix(m: &Matrix) -> String {
    nums(&m.0)
}

/// Characters per CDATA section of embedded file data, as in InDesign's
/// IDML export.
pub(super) const CDATA_SECTION: usize = 262_144;

/// Base64 (RFC 4648, with padding) in lines of 76 characters separated by
/// line feeds, as IDML writes embedded file data.
pub(super) fn base64_lines(data: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const LINE: usize = 76;
    let encoded_len = data.len().div_ceil(3) * 4;
    let mut out = String::with_capacity(encoded_len + encoded_len / LINE);
    let mut column = 0;
    for group in data.chunks(3) {
        let b = [
            group[0],
            group.get(1).copied().unwrap_or(0),
            group.get(2).copied().unwrap_or(0),
        ];
        let n = (b[0] as u32) << 16 | (b[1] as u32) << 8 | b[2] as u32;
        if column == LINE {
            out.push('\n');
            column = 0;
        }
        for i in 0..4 {
            let c = if i <= group.len() {
                ALPHABET[(n >> (18 - 6 * i) & 0x3F) as usize] as char
            } else {
                '='
            };
            out.push(c);
        }
        column += 4;
    }
    out
}

pub(super) fn uref(uid: Option<u32>) -> String {
    uid.map_or("n".into(), |u| format!("u{u:x}"))
}

/// Name as used in a style's `Self` and in references: `$ID/` for built-ins.
pub(super) fn style_name(s: &Style) -> String {
    if s.builtin {
        builtin_key(&s.name)
    } else {
        s.name.clone()
    }
}

/// A text variable name as IDML writes it: control characters (U+001B in
/// the built-in cross-reference variables) become `<?AID 00xx?>`.
pub(super) fn variable_name(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for c in name.chars() {
        if (c as u32) < 0x20 {
            out.push_str(&format!("<?AID {:04x}?>", c as u32));
        } else {
            out.push(c);
        }
    }
    out
}

/// Escape a name for use in a `Self` reference (`:` separates style
/// groups there).
/// Names joined into the IDML name of a style or style group: `:`
/// between them, and `\\:` for a `:` inside one (objects.md, style
/// groups).
pub(super) fn style_path<'a>(names: impl IntoIterator<Item = &'a str>) -> String {
    names
        .into_iter()
        .map(|n| n.replace(':', "\\:"))
        .collect::<Vec<_>>()
        .join(":")
}

pub(super) fn self_name(name: &str) -> String {
    name.replace('%', "%25")
        .replace(':', "%3a")
        .replace('\r', "%0d")
}

impl Writer<'_> {
    pub(super) fn properties(x: &mut Xml, props: &[Property]) {
        Self::properties_with(x, props, &[]);
    }

    /// `<Properties>` with `props`, then the elements in `extra`.
    pub(super) fn properties_with(x: &mut Xml, props: &[Property], extra: &[Node]) {
        if props.is_empty() && extra.is_empty() {
            return;
        }
        x.start("Properties");
        for (name, ty, value) in props {
            x.start(name);
            if !ty.is_empty() {
                x.attr("type", *ty);
            }
            match value {
                PropValue::Attributes(attrs) => {
                    for (k, v) in attrs {
                        x.attr(k, v);
                    }
                }
                PropValue::Text(text) => {
                    x.text(text);
                }
                PropValue::List(items) => {
                    for item in items {
                        x.start("ListItem").attr("type", "record");
                        for (field, ty, text) in item {
                            x.start(field).attr("type", *ty).text(text).end();
                        }
                        x.end();
                    }
                }
                PropValue::Lists(lists) => {
                    for list in lists {
                        x.start("ListItem").attr("type", "list");
                        for (ty, text) in list {
                            x.start("ListItem").attr("type", *ty).text(text).end();
                        }
                        x.end();
                    }
                }
            }
            x.end();
        }
        for n in extra {
            n.write(x);
        }
        x.end();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_a_colon_inside_a_style_or_group_name() {
        let name = style_path(["a: b", "c"]);
        assert_eq!(name, "a\\: b:c");
        assert_eq!(self_name(&name), "a\\%3a b%3ac");
    }

    #[test]
    fn sets_the_baseline_frame_grid_colour() {
        use crate::model::prefs::FrameGridColor;
        let mut node = Node {
            tag: "BaselineFrameGridOption".into(),
            ..Node::default()
        };
        set_property(
            &mut node,
            frame_grid_color(FrameGridColor::LightBlue).unwrap(),
        );
        set_property(
            &mut node,
            frame_grid_color(FrameGridColor::Charcoal).unwrap(),
        );
        let props = &node.children[0];
        assert_eq!(props.tag, "Properties");
        assert_eq!(props.children.len(), 1);
        assert_eq!(props.children[0].text.as_deref(), Some("Charcoal"));
    }

    #[test]
    fn numbers_without_text_are_written_as_zero() {
        assert_eq!(num(1.5), "1.5");
        assert_eq!(num(f64::NAN), "0");
        assert_eq!(num(f64::INFINITY), "0");
        assert_eq!(num(f64::NEG_INFINITY), "0");
    }

    #[test]
    fn formats_numbers_like_idml() {
        assert_eq!(num(205.2), "205.2");
        assert_eq!(num(-0.0), "-0");
        assert_eq!(num(1.0), "1");
        assert_eq!(num(-89.99999999999999), "-89.99999999999999");
    }

    #[test]
    #[allow(clippy::excessive_precision)]
    fn rounds_17_digit_ties_to_even() {
        assert_eq!(num(150.235992431640625), "150.23599243164062");
        assert_eq!(num(22.3404083251953125), "22.340408325195312");
        assert_eq!(num(19.6667022705078125), "19.666702270507812");
        assert_eq!(num(-150.235992431640625), "-150.23599243164062");
        // Values with 16 digits or fewer keep their shortest form.
        assert_eq!(num(0.2779084995276255), "0.2779084995276255");
        assert_eq!(num(1e20), "100000000000000000000");
        assert_eq!(num(0.1 + 0.2), "0.30000000000000004");
        // Ties at fewer digits, and small numbers with an exponent.
        assert_eq!(num(0.125), "0.125");
        assert_eq!(num(5.684341886080802e-14), "5.684341886080802e-14");
        assert_eq!(num(1.8897456811828306e-05), "1.8897456811828306e-05");
        assert_eq!(num(1e-5), "1e-05");
        assert_eq!(num(0.0001), "0.0001");
        for v in [1.0 / 3.0, 2.0 / 3.0, 1e-7 / 3.0, 123456.789e3 / 7.0] {
            assert_eq!(num(v).parse::<f64>().unwrap(), v);
        }
    }

    #[test]
    fn encodes_base64_in_lines() {
        assert_eq!(base64_lines(b""), "");
        assert_eq!(base64_lines(b"f"), "Zg==");
        assert_eq!(base64_lines(b"fo"), "Zm8=");
        assert_eq!(base64_lines(b"foobar"), "Zm9vYmFy");
        let lines = base64_lines(&[0xFF; 58]);
        assert_eq!(lines.split('\n').map(str::len).collect::<Vec<_>>(), [76, 4]);
        assert!(base64_lines(&[0xFF; 57]).find('\n').is_none());
    }
}
