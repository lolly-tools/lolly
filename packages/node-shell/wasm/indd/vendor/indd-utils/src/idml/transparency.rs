//! Transparency settings of page items and object styles. See `docs/format/transparency.md`.

use super::applied::StyleValues;
use super::kind::Kind;
use super::values::Node;
use super::xml::Xml;
use super::{Writer, num};
use crate::model::{Attrs, Value};

/// Blend mode codes: the index in the schema's `BlendMode` enumeration
/// (`docs/format/transparency.md`, blend mode codes).
const BLEND_MODES: &[(u32, &str)] = &[
    (0, "Normal"),
    (1, "Multiply"),
    (2, "Screen"),
    (3, "Overlay"),
    (4, "SoftLight"),
    (5, "HardLight"),
    (6, "ColorDodge"),
    (7, "ColorBurn"),
    (8, "Darken"),
    (9, "Lighten"),
    (10, "Difference"),
    (11, "Exclusion"),
    (12, "Hue"),
    (13, "Saturation"),
    (14, "Color"),
    (15, "Luminosity"),
];

/// Transparency elements, in the order the schema lists them.
const SETTINGS: &[&str] = &[
    "TransparencySetting",
    "StrokeTransparencySetting",
    "FillTransparencySetting",
];

/// Effect elements of a setting, in schema order.
const EFFECTS: &[&str] = &[
    "BlendingSetting",
    "DropShadowSetting",
    "FeatherSetting",
    "InnerShadowSetting",
    "OuterGlowSetting",
    "InnerGlowSetting",
    "BevelAndEmbossSetting",
    "SatinSetting",
    "GradientFeatherSetting",
];

/// Where an attribute of `ATTRS` is written.
#[derive(Clone, Copy, PartialEq)]
enum On {
    /// Page items and object styles.
    Both,
    /// Object styles only: the IDs are shown by object style samples
    /// alone (`docs/format/transparency.md`, object styles).
    Styles,
}

/// Attribute-list ID, setting, effect, IDML attribute, value kind and
/// where it is written; in the schema's attribute order within each
/// effect.
const ATTRS: &[(u32, &str, &str, &str, Kind, On)] = &[
    (
        0x10817,
        "TransparencySetting",
        "BlendingSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Both,
    ),
    (
        0x10816,
        "TransparencySetting",
        "BlendingSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Both,
    ),
    (
        0x10819,
        "TransparencySetting",
        "BlendingSetting",
        "IsolateBlending",
        Kind::Bool,
        On::Both,
    ),
    (
        0x1081A,
        "TransparencySetting",
        "DropShadowSetting",
        "Mode",
        Kind::Enum(&[(0, "None"), (1, "Drop")]),
        On::Both,
    ),
    (
        0x1081F,
        "TransparencySetting",
        "DropShadowSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Both,
    ),
    (
        0x1081E,
        "TransparencySetting",
        "DropShadowSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Both,
    ),
    (
        0x1081B,
        "TransparencySetting",
        "DropShadowSetting",
        "XOffset",
        Kind::Range(-1000.0, 1000.0),
        On::Both,
    ),
    (
        0x1081C,
        "TransparencySetting",
        "DropShadowSetting",
        "YOffset",
        Kind::Range(-1000.0, 1000.0),
        On::Both,
    ),
    (
        0x10820,
        "TransparencySetting",
        "DropShadowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Both,
    ),
    (
        0x1084A,
        "TransparencySetting",
        "DropShadowSetting",
        "Spread",
        Kind::Range(0.0, 100.0),
        On::Both,
    ),
    (
        DROP_SHADOW_COLOR,
        "TransparencySetting",
        "DropShadowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Both,
    ),
    (
        KNOCKED_OUT,
        "TransparencySetting",
        "DropShadowSetting",
        "KnockedOut",
        Kind::Bool,
        On::Both,
    ),
    (
        0x10821,
        "TransparencySetting",
        "FeatherSetting",
        "Mode",
        Kind::Enum(&[(0, "None"), (3, "Standard")]),
        On::Styles,
    ),
    (
        0x1084D,
        "TransparencySetting",
        "InnerShadowSetting",
        "Applied",
        Kind::Bool,
        On::Both,
    ),
    (
        0x1084E,
        "TransparencySetting",
        "InnerShadowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Both,
    ),
    (
        0x10850,
        "TransparencySetting",
        "InnerShadowSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x10852,
        "TransparencySetting",
        "InnerShadowSetting",
        "Distance",
        Kind::Range(0.0, 1000.0),
        On::Both,
    ),
    (
        0x10855,
        "TransparencySetting",
        "InnerShadowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Both,
    ),
    (
        0x10857,
        "TransparencySetting",
        "OuterGlowSetting",
        "Applied",
        Kind::Bool,
        On::Both,
    ),
    (
        0x10858,
        "TransparencySetting",
        "OuterGlowSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Both,
    ),
    (
        0x10859,
        "TransparencySetting",
        "OuterGlowSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Both,
    ),
    (
        0x1085B,
        "TransparencySetting",
        "OuterGlowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Both,
    ),
    (
        0x1085D,
        "TransparencySetting",
        "OuterGlowSetting",
        "Spread",
        Kind::Range(0.0, 100.0),
        On::Both,
    ),
    (
        0x1085E,
        "TransparencySetting",
        "OuterGlowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Both,
    ),
    (
        0x1085F,
        "TransparencySetting",
        "InnerGlowSetting",
        "Applied",
        Kind::Bool,
        On::Both,
    ),
    (
        0x10860,
        "TransparencySetting",
        "InnerGlowSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Both,
    ),
    (
        0x10866,
        "TransparencySetting",
        "InnerGlowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Both,
    ),
    (
        0x10875,
        "TransparencySetting",
        "BevelAndEmbossSetting",
        "ShadowColor",
        Kind::Swatch,
        On::Styles,
    ),
    (
        0x1EB8A,
        "TransparencySetting",
        "GradientFeatherSetting",
        "Applied",
        Kind::Bool,
        On::Both,
    ),
    (
        0x1EB8D,
        "TransparencySetting",
        "GradientFeatherSetting",
        "Angle",
        Kind::Range(-180.0, 180.0),
        On::Both,
    ),
    (
        0x1EB8E,
        "TransparencySetting",
        "GradientFeatherSetting",
        "Length",
        Kind::Number,
        On::Both,
    ),
    (
        0x1EB8F,
        "TransparencySetting",
        "GradientFeatherSetting",
        "GradientStart",
        Kind::Point,
        On::Both,
    ),
    (
        0x1EB91,
        "TransparencySetting",
        "GradientFeatherSetting",
        "HiliteAngle",
        Kind::Number,
        On::Both,
    ),
    (
        0x1EB92,
        "TransparencySetting",
        "GradientFeatherSetting",
        "HiliteLength",
        Kind::Number,
        On::Both,
    ),
    (
        0x10892,
        "StrokeTransparencySetting",
        "BlendingSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Styles,
    ),
    (
        0x108AF,
        "StrokeTransparencySetting",
        "OuterGlowSetting",
        "Applied",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x108B1,
        "StrokeTransparencySetting",
        "OuterGlowSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x108B3,
        "StrokeTransparencySetting",
        "OuterGlowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Styles,
    ),
    (
        0x108B5,
        "StrokeTransparencySetting",
        "OuterGlowSetting",
        "Spread",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x1EB93,
        "StrokeTransparencySetting",
        "GradientFeatherSetting",
        "Applied",
        Kind::Bool,
        On::Both,
    ),
    (
        0x1EB96,
        "StrokeTransparencySetting",
        "GradientFeatherSetting",
        "Angle",
        Kind::Range(-180.0, 180.0),
        On::Both,
    ),
    (
        0x1EB97,
        "StrokeTransparencySetting",
        "GradientFeatherSetting",
        "Length",
        Kind::Number,
        On::Both,
    ),
    (
        0x1EB98,
        "StrokeTransparencySetting",
        "GradientFeatherSetting",
        "GradientStart",
        Kind::Point,
        On::Both,
    ),
    (
        0x108D9,
        "FillTransparencySetting",
        "BlendingSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Styles,
    ),
    (
        0x108D8,
        "FillTransparencySetting",
        "BlendingSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Both,
    ),
    (
        0x108DC,
        "FillTransparencySetting",
        "DropShadowSetting",
        "Mode",
        Kind::Enum(&[(0, "None"), (1, "Drop")]),
        On::Styles,
    ),
    (
        0x108DD,
        "FillTransparencySetting",
        "DropShadowSetting",
        "XOffset",
        Kind::Range(-1000.0, 1000.0),
        On::Styles,
    ),
    (
        0x108DE,
        "FillTransparencySetting",
        "DropShadowSetting",
        "YOffset",
        Kind::Range(-1000.0, 1000.0),
        On::Styles,
    ),
    (
        0x108E5,
        "FillTransparencySetting",
        "DropShadowSetting",
        "UseGlobalLight",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x108EC,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "Applied",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x108ED,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Styles,
    ),
    (
        0x108EF,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x108F0,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "Angle",
        Kind::Range(-180.0, 180.0),
        On::Styles,
    ),
    (
        0x108F1,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "Distance",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x108F3,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "ChokeAmount",
        Kind::Number,
        On::Styles,
    ),
    (
        0x108F4,
        "FillTransparencySetting",
        "InnerShadowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x108F6,
        "FillTransparencySetting",
        "OuterGlowSetting",
        "Applied",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x108F7,
        "FillTransparencySetting",
        "OuterGlowSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Styles,
    ),
    (
        0x108FA,
        "FillTransparencySetting",
        "OuterGlowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Styles,
    ),
    (
        0x108FD,
        "FillTransparencySetting",
        "OuterGlowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x108FE,
        "FillTransparencySetting",
        "InnerGlowSetting",
        "Applied",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x108FF,
        "FillTransparencySetting",
        "InnerGlowSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Styles,
    ),
    (
        0x1EB00,
        "FillTransparencySetting",
        "InnerGlowSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x1EB02,
        "FillTransparencySetting",
        "InnerGlowSetting",
        "EffectColor",
        Kind::Swatch,
        On::Styles,
    ),
    (
        0x1EB05,
        "FillTransparencySetting",
        "InnerGlowSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x1EB07,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "Applied",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x1EB0C,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x1EB0D,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "Soften",
        Kind::Number,
        On::Styles,
    ),
    (
        0x1EB0E,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "Angle",
        Kind::Range(-180.0, 180.0),
        On::Styles,
    ),
    (
        0x1EB0F,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "Altitude",
        Kind::Number,
        On::Styles,
    ),
    (
        0x1EB13,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "HighlightOpacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x1EB16,
        "FillTransparencySetting",
        "BevelAndEmbossSetting",
        "ShadowOpacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x1EB17,
        "FillTransparencySetting",
        "SatinSetting",
        "Applied",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x1EB18,
        "FillTransparencySetting",
        "SatinSetting",
        "EffectColor",
        Kind::Swatch,
        On::Styles,
    ),
    (
        0x1EB19,
        "FillTransparencySetting",
        "SatinSetting",
        "BlendMode",
        Kind::Enum(BLEND_MODES),
        On::Styles,
    ),
    (
        0x1EB1A,
        "FillTransparencySetting",
        "SatinSetting",
        "Opacity",
        Kind::Range(0.0, 100.0),
        On::Styles,
    ),
    (
        0x1EB1B,
        "FillTransparencySetting",
        "SatinSetting",
        "Angle",
        Kind::Range(-180.0, 180.0),
        On::Styles,
    ),
    (
        0x1EB1C,
        "FillTransparencySetting",
        "SatinSetting",
        "Distance",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x1EB1D,
        "FillTransparencySetting",
        "SatinSetting",
        "Size",
        Kind::Range(0.0, 1000.0),
        On::Styles,
    ),
    (
        0x1EB1E,
        "FillTransparencySetting",
        "SatinSetting",
        "InvertEffect",
        Kind::Bool,
        On::Styles,
    ),
    (
        0x1EB9C,
        "FillTransparencySetting",
        "GradientFeatherSetting",
        "Applied",
        Kind::Bool,
        On::Both,
    ),
    (
        0x1EB9F,
        "FillTransparencySetting",
        "GradientFeatherSetting",
        "Angle",
        Kind::Range(-180.0, 180.0),
        On::Both,
    ),
    (
        0x1EBA0,
        "FillTransparencySetting",
        "GradientFeatherSetting",
        "Length",
        Kind::Number,
        On::Both,
    ),
    (
        0x1EBA1,
        "FillTransparencySetting",
        "GradientFeatherSetting",
        "GradientStart",
        Kind::Point,
        On::Both,
    ),
];

/// Opacity gradient stops of a gradient feather, per setting.
const STOPS: &[(u32, &str)] = &[
    (0x1EB8C, "TransparencySetting"),
    (0x1EB95, "StrokeTransparencySetting"),
    (0x1EB9E, "FillTransparencySetting"),
];

/// The applied flag of each effect whose colour is written only when the
/// effect is applied.
const COLOR_APPLIED: &[(&str, u32)] = &[("InnerShadowSetting", 0x1084D)];

/// The drop shadow's `EffectColor`. Where the object style stores no
/// swatch (0), IDML writes the item's colour, except for the one item
/// whose colour is Black; the converter leaves Black out there, as the
/// samples do not show why (`docs/format/transparency.md`, drop shadow
/// colour).
const DROP_SHADOW_COLOR: u32 = 0x10837;

/// The drop shadow's `KnockedOut`. An item or object style chain that
/// does not store it has `true` (`docs/format/transparency.md`, drop
/// shadow knockout).
const KNOCKED_OUT: u32 = 0x1EB6F;

/// The value of an attribute that an item or style chain does not store,
/// where the samples show one.
fn unstored(id: u32) -> Option<&'static Value> {
    const TRUE: Value = Value::Enum(1);
    (id == KNOCKED_OUT).then_some(&TRUE)
}

/// An effect element: name, attributes and opacity stops.
type Effect = (&'static str, Vec<(&'static str, String)>, Vec<Stop>);

/// One opacity gradient stop, as IDML writes it.
#[derive(Debug, PartialEq)]
struct Stop {
    opacity: f64,
    location: f64,
    /// Relative position of the midpoint between the previous stop and
    /// this one, in percent; `None` for the first stop.
    midpoint: Option<f64>,
}

/// Opacity stops as IDML writes them, from the stops of the attribute
/// list (location, absolute midpoint position, opacity). `None` for no
/// stops, or two stops at the same location (the midpoint is undefined).
fn stops(raw: &[[f64; 3]]) -> Option<Vec<Stop>> {
    if raw.is_empty() || (1..raw.len()).any(|i| raw[i][0] == raw[i - 1][0]) {
        return None;
    }
    Some(
        raw.iter()
            .enumerate()
            .map(|(i, &[location, _, opacity])| {
                let midpoint = (i > 0).then(|| {
                    let [prev, mid, _] = raw[i - 1];
                    (mid - prev) / (location - prev) * 100.0
                });
                Stop {
                    opacity,
                    location: super::round(location * 100.0),
                    midpoint,
                }
            })
            .collect(),
    )
}

/// What the values of a list are compared with.
#[derive(Clone, Copy)]
enum Base<'a> {
    /// A page item's values: those of its object style, if it has one.
    Item(Option<&'a StyleValues>),
    /// An object style's values: those of the root style `[None]`.
    Root(&'a Attrs),
}

/// A value left out because it is outside the schema's range: effect,
/// attribute, value.
type LeftOut = (&'static str, &'static str, f64);

/// The setting elements of `attrs`, with the values that differ from
/// `base` in any digit (all values of an item without a style), and an
/// effect element only when one of its values or its opacity stops
/// differ. `owner` is the `Self` of the item or style, which names the
/// opacity stops.
fn settings(w: &Writer, attrs: &Attrs, base: Base, owner: &str) -> (Vec<Node>, Vec<LeftOut>) {
    let mut left_out = Vec::new();
    let mut out = Vec::new();
    for &setting in SETTINGS {
        let mut effects: Vec<Effect> = Vec::new();
        for &effect in EFFECTS {
            let mut values = Vec::new();
            for &(id, s, e, name, kind, on) in ATTRS {
                if s != setting || e != effect {
                    continue;
                }
                let (v, base_value, has_base) = match base {
                    Base::Item(style) => {
                        if on == On::Styles {
                            continue;
                        }
                        if matches!(kind, Kind::Swatch)
                            && let Some(&(_, applied)) =
                                COLOR_APPLIED.iter().find(|(e, _)| *e == effect)
                            && attrs.get(applied).and_then(Value::as_u32) != Some(1)
                        {
                            continue;
                        }
                        (
                            attrs.get(id).or_else(|| style.and_then(|_| unstored(id))),
                            style.and_then(|s| s.transparency(id).or_else(|| unstored(id))),
                            style.is_some(),
                        )
                    }
                    // Only IDs that both lists hold (object styles,
                    // chunk 0x1B92C).
                    Base::Root(root) => match (attrs.get(id), root.get(id)) {
                        (Some(v), Some(r)) => (Some(v), Some(r), true),
                        _ => continue,
                    },
                };
                let Some(v) = v else {
                    continue;
                };
                if let Kind::Range(lo, hi) = kind
                    && let Some(f) = v.as_f64()
                    && !(lo..=hi).contains(&f)
                {
                    left_out.push((effect, name, f));
                    continue;
                }
                match w.value_text(kind, v) {
                    Some(t) => {
                        let base_text = base_value.and_then(|b| w.value_text(kind, b));
                        let same = base_text.as_ref().is_some_and(|b| *b == t);
                        let unshown = id == DROP_SHADOW_COLOR
                            && has_base
                            && base_text.is_none()
                            && t == "Color/Black";
                        if !same && !unshown {
                            values.push((name, t));
                        }
                    }
                    None if kind.is_code() => attrs.unknown_code(id, v),
                    None => {}
                }
            }
            let stop_list = if effect == "GradientFeatherSetting" {
                STOPS
                    .iter()
                    .find(|(_, s)| *s == setting)
                    .and_then(|&(id, _)| {
                        let base_stops = match base {
                            Base::Item(style) => style.and_then(|s| s.transparency(id)),
                            Base::Root(root) => root.get(id),
                        };
                        match attrs.get(id) {
                            Some(Value::Stops(raw))
                                if !matches!(base_stops, Some(Value::Stops(st)) if st == raw) =>
                            {
                                stops(raw)
                            }
                            _ => None,
                        }
                    })
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            if !values.is_empty() || !stop_list.is_empty() {
                effects.push((effect, values, stop_list));
            }
        }
        if effects.is_empty() {
            continue;
        }
        let children = effects
            .into_iter()
            .map(|(effect, values, stop_list)| Node {
                tag: effect.into(),
                attrs: values.into_iter().map(|(n, v)| (n.into(), v)).collect(),
                text: None,
                children: stop_list
                    .iter()
                    .enumerate()
                    .map(|(i, s)| {
                        let mut attrs = vec![
                            (
                                "Self".to_string(),
                                format!("{owner}{setting}1{effect}1OpacityGradientStop{i}"),
                            ),
                            ("Opacity".into(), num(s.opacity)),
                            ("Location".into(), num(s.location)),
                        ];
                        if let Some(m) = s.midpoint {
                            attrs.push(("Midpoint".into(), num(m)));
                        }
                        Node {
                            tag: "OpacityGradientStop".into(),
                            attrs,
                            ..Node::default()
                        }
                    })
                    .collect(),
            })
            .collect();
        out.push(Node {
            tag: setting.into(),
            children,
            ..Node::default()
        });
    }
    (out, left_out)
}

/// Write the transparency settings of a page item: the values that
/// differ from the object style `style` (all values without a style).
/// `item` is the item's `Self`. Returns the values left out because they
/// are outside the schema's range.
pub(super) fn write(
    w: &Writer,
    x: &mut Xml,
    attrs: &Attrs,
    style: Option<&StyleValues>,
    item: &str,
) -> Vec<LeftOut> {
    let (nodes, left_out) = settings(w, attrs, Base::Item(style), item);
    for n in &nodes {
        n.write(x);
    }
    left_out
}

/// The transparency settings of object style `os`: the values that
/// differ from those of the root style `[None]`, whatever the style is
/// based on (`docs/format/transparency.md`, object styles). None for an
/// InDesign 4.0 document, whose lists have another layout.
pub(super) fn style_settings(
    w: &Writer,
    os: &crate::model::ObjectStyle,
    root: &crate::model::ObjectStyle,
) -> (Vec<Node>, Vec<LeftOut>) {
    if w.doc.version.major <= 4 {
        return (Vec::new(), Vec::new());
    }
    settings(
        w,
        &os.transparency,
        Base::Root(&root.transparency),
        &super::uref(Some(os.uid)),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_opacity_stops() {
        // Two stops: location 0.15, midpoint at 0.5, opacity 100; location
        // 0.85, midpoint 1, opacity 0.
        let s = stops(&[[0.15, 0.5, 100.0], [0.85, 1.0, 0.0]]).unwrap();
        assert_eq!(s.len(), 2);
        assert_eq!(
            (s[0].opacity, s[0].location, s[0].midpoint),
            (100.0, 15.0, None)
        );
        assert_eq!(s[1].location, 85.0);
        assert!((s[1].midpoint.unwrap() - 50.0).abs() < 1e-9);
        assert_eq!(stops(&[]), None);
    }

    #[test]
    fn stops_at_one_location_are_not_read() {
        assert_eq!(stops(&[[0.5, 0.5, 100.0], [0.5, 1.0, 0.0]]), None);
    }

    #[test]
    fn style_values_are_compared_with_the_root() {
        let mut doc = crate::model::Document::default();
        doc.swatches.insert(0xB, "Color/Black".into());
        doc.swatches.insert(0x20, "Color/u20".into());
        let w = Writer::for_test(&doc);
        let list = |values: Vec<(u32, Value)>| {
            let mut a = Attrs::default();
            a.values = values;
            a
        };
        let root = list(vec![
            (0x10816, Value::Double(100.0)),
            (DROP_SHADOW_COLOR, Value::Ref(0)),
            (0x108D8, Value::Double(100.0)),
            (0x1EB8C, Value::Stops(Vec::new())),
        ]);
        let style = |color: u32| {
            list(vec![
                (0x10816, Value::Double(30.0)),
                (DROP_SHADOW_COLOR, Value::Ref(color)),
                (0x108D8, Value::Double(100.0)),
                // Not in the root's list.
                (0x10817, Value::Int(1)),
                (
                    0x1EB8C,
                    Value::Stops(vec![[0.0, 0.5, 100.0], [1.0, 1.0, 0.0]]),
                ),
            ])
        };
        let (nodes, _) = settings(&w, &style(0xB), Base::Root(&root), "u2a");
        assert_eq!(nodes.len(), 1);
        let t = &nodes[0];
        assert_eq!(t.tag, "TransparencySetting");
        assert_eq!(
            t.child("BlendingSetting").unwrap().attrs,
            [("Opacity".to_string(), "30".to_string())]
        );
        // Black is left out where the root stores no swatch.
        assert!(t.child("DropShadowSetting").is_none());
        let g = t.child("GradientFeatherSetting").unwrap();
        assert_eq!(
            g.children[1].attr("Self"),
            Some("u2aTransparencySetting1GradientFeatherSetting1OpacityGradientStop1")
        );
        let (nodes, _) = settings(&w, &style(0x20), Base::Root(&root), "u2a");
        assert_eq!(
            nodes[0]
                .child("DropShadowSetting")
                .unwrap()
                .attr("EffectColor"),
            Some("Color/u20")
        );
    }
}
