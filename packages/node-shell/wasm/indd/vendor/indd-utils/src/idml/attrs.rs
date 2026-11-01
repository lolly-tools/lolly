//! Attribute tables: which IDML attribute or property each INDD attribute
//! ID of a text, page item, cell or table attribute list becomes, and the
//! kind of its value; and the IDML form of structured values the model
//! decodes (tab lists, nested styles, bullet characters, anchored object
//! settings).
//!
//! Evidence: `docs/format/attributes.md`, `tables.md` (cell and table
//! attributes) and `objects.md` (anchored object settings).

use super::*;
use crate::model::AnchorSettings;
use crate::model::attrs::{Delimiter, GrepStyle, LineStyle, NestedStyle, TabStop};

/// Frame fitting attributes of page items and object styles, in the
/// order IDML writes them (`docs/format/objects.md`).
pub(super) const FITTING_ATTRS: [(u32, &str, Kind); 7] = [
    (0x6E83, "AutoFit", Kind::Enum(&[(0, "false"), (1, "true")])),
    (0x6E7E, "LeftCrop", Kind::Number),
    (0x6E7F, "TopCrop", Kind::Number),
    (0x6E80, "RightCrop", Kind::Number),
    (0x6E81, "BottomCrop", Kind::Number),
    (
        0x6E7C,
        "FittingOnEmptyFrame",
        Kind::Enum(&[
            (0, "None"),
            (1, "ContentToFrame"),
            (2, "Proportionally"),
            (3, "FillProportionally"),
        ]),
    ),
    (
        0x6E7D,
        "FittingAlignment",
        Kind::Enum(&[
            (0, "TopLeftAnchor"),
            (1, "TopCenterAnchor"),
            (3, "LeftCenterAnchor"),
            (4, "CenterAnchor"),
        ]),
    ),
];

/// The anchored object settings of `anchored_settings`.
pub(super) const ANCHORED_SETTINGS: [&str; 10] = [
    "AnchoredPosition",
    "SpineRelative",
    "PinPosition",
    "AnchorPoint",
    "HorizontalAlignment",
    "HorizontalReferencePoint",
    "VerticalAlignment",
    "VerticalReferencePoint",
    "AnchorXoffset",
    "AnchorYoffset",
];

/// IDML attributes of anchored object settings, in IDML order, for the
/// codes the samples show. See `docs/format/objects.md`, anchored object
/// settings.
pub(super) fn anchored_settings(a: &AnchorSettings) -> Vec<(&'static str, String)> {
    let code = |v: Option<u16>, codes: &[(u16, &'static str)]| {
        v.and_then(|v| codes.iter().find(|(c, _)| *c == v).map(|(_, s)| *s))
    };
    let point = match a.point {
        Some((0, 2)) => Some("BottomRightAnchor"),
        Some((2, 2)) => Some("BottomLeftAnchor"),
        Some((2, 0)) => Some("TopLeftAnchor"),
        Some((0, 0)) => Some("TopRightAnchor"),
        Some((2, 1)) => Some("LeftCenterAnchor"),
        _ => None,
    };
    let bool_codes: &[(u16, &str)] = &[(0, "false"), (1, "true")];
    let named = [
        (
            "AnchoredPosition",
            code(
                a.position,
                &[(0, "InlinePosition"), (1, "Anchored"), (2, "AboveLine")],
            ),
        ),
        ("SpineRelative", code(a.spine_relative, bool_codes)),
        ("PinPosition", code(a.pin, bool_codes)),
        ("AnchorPoint", point),
        (
            "HorizontalAlignment",
            code(
                a.horizontal_alignment,
                &[(0, "RightAlign"), (1, "CenterAlign"), (2, "LeftAlign")],
            ),
        ),
        (
            "HorizontalReferencePoint",
            code(
                a.horizontal_reference,
                &[
                    (1, "TextFrame"),
                    (2, "PageMargins"),
                    (3, "PageEdge"),
                    (4, "AnchorLocation"),
                ],
            ),
        ),
        (
            "VerticalAlignment",
            code(
                a.vertical_alignment,
                &[(0, "TopAlign"), (1, "CenterAlign"), (2, "BottomAlign")],
            ),
        ),
        (
            "VerticalReferencePoint",
            code(
                a.vertical_reference,
                &[
                    (2, "PageMargins"),
                    (3, "PageEdge"),
                    (4, "LineBaseline"),
                    (6, "Capheight"),
                ],
            ),
        ),
    ];
    let mut out: Vec<(&'static str, String)> = named
        .into_iter()
        .filter_map(|(k, v)| Some((k, v?.to_string())))
        .collect();
    out.extend(a.x_offset.map(|x| ("AnchorXoffset", num(x))));
    out.extend(a.y_offset.map(|y| ("AnchorYoffset", num(y))));
    out
}

/// Frame fitting attributes of `attrs` with IDs in `ids`, in IDML order.
pub(super) fn fitting_attrs(w: &Writer, attrs: &Attrs, ids: &[u32]) -> Vec<(&'static str, String)> {
    FITTING_ATTRS
        .iter()
        .filter(|(id, ..)| ids.contains(id))
        .filter_map(|&(id, name, kind)| Some((name, w.value_text(kind, attrs.get(id)?)?)))
        .collect()
}

/// IDML `TextWrapMode` of a text wrap; no wrap is `None`. `None` for a
/// mode without evidence. See `docs/format/objects.md`, text wrap.
pub(super) fn text_wrap_mode(wrap: Option<&TextWrap>) -> Option<&'static str> {
    match wrap.map(|w| w.mode) {
        None | Some(wrap_mode::NONE) => Some("None"),
        Some(wrap_mode::JUMP_OBJECT) => Some("JumpObjectTextWrap"),
        Some(wrap_mode::BOUNDING_BOX) => Some("BoundingBoxTextWrap"),
        Some(wrap_mode::CONTOUR) => Some("Contour"),
        Some(_) => None,
    }
}

/// IDML `TextWrapSide` of the side code of a text wrap; `None` for a code
/// without evidence. See `docs/format/objects.md`, text wrap.
pub(super) fn text_wrap_side(code: u16) -> Option<&'static str> {
    Some(match code {
        0 => "BothSides",
        1 => "LeftSide",
        2 => "RightSide",
        3 => "SideTowardsSpine",
        4 => "SideAwayFromSpine",
        5 => "LargestArea",
        _ => return None,
    })
}

/// IDML `ContourType` of a contour code (`Contour::kind`); `None` for a
/// code not decoded. See `docs/format/objects.md`, text wrap.
pub(super) fn contour_type(code: u32) -> Option<&'static str> {
    Some(match code {
        0 => "BoundingBox",
        1 => "DetectEdges",
        2 => "AlphaChannel",
        3 => "PhotoshopPath",
        4 => "GraphicFrame",
        5 => "SameAsClipping",
        6 => "SelectSubject",
        _ => return None,
    })
}

/// The `ContourOption` of a text wrap. See `docs/format/objects.md`, text
/// wrap, contour.
#[derive(Debug, Clone, PartialEq)]
pub(super) struct ContourOption {
    /// Type and inside edges; `None` for a frame whose object style turns
    /// the text wrap category on, which has only `ContourPathName`.
    pub contour: Option<Contour>,
    /// `ContourPathName`: `$ID/` or the name of an alpha channel.
    pub path_name: String,
    /// Whether to write `CONTOUR_PARAMS` with a contour type (DOM 21.4 on).
    pub params: bool,
}

/// The contour parameters of every typed `ContourOption` from DOM 21.4
/// (`docs/format/objects.md`, text wrap, contour).
pub(super) const CONTOUR_PARAMS: [(&str, &str); 4] = [
    ("ContourTolerance", "5"),
    ("ContourThreshold", "25"),
    ("ContourAlphaIndex", "0"),
    ("ContourPathIndex", "-1"),
];

/// IDML `TextWrapOffset` attributes of a text wrap (0 without one).
pub(super) fn text_wrap_offsets(wrap: Option<&TextWrap>) -> Vec<(&'static str, String)> {
    let [left, top, right, bottom] = wrap.map_or([0.0; 4], |w| w.offsets);
    vec![
        ("Top", num(top)),
        ("Left", num(left)),
        ("Bottom", num(bottom)),
        ("Right", num(right)),
    ]
}

/// Corner option codes (`docs/format/attributes.md` and `objects.md`).
pub(super) const CORNER_OPTIONS: &[(u32, &str)] = &[
    (0, "None"),
    (0x5A15, "RoundedCorner"),
    (0x5A16, "InverseRoundedCorner"),
    (0x5A17, "InsetCorner"),
    (0x5A18, "BevelCorner"),
    (0x5A19, "FancyCorner"),
];

/// Codes of built-in stroke styles, the same in page item, object style,
/// text, cell and table lists. See `docs/format/attributes.md`.
pub(super) const STROKE_TYPES: &[(u32, &str)] = &[
    (0x5A29, "Solid"),
    (0x5A2A, "Dashed"),
    (0x5A37, "Canned Dashed 4x4"),
    (0x5A38, "Canned Dashed 3x2"),
    (0x5A39, "Canned Dotted"),
    (0x5A3A, "Wavy"),
    (0x5A3B, "Straight Hash"),
    (0x5A3C, "Right Slant Hash"),
    (0x5A3E, "White Diamond"),
    (0x5A3F, "Japanese Dots"),
    (0xB004, "ThinThin"),
    (0xB005, "ThinThick"),
    (0xB006, "ThickThin"),
    (0xB007, "ThickThick"),
    (0xB009, "ThickThinThick"),
    (0xB01A, "Triple_Stroke"),
];

/// Whether a dash attribute (`StrokeDashAndGap`, `StrokeCornerAdjustment`)
/// is written: IDML has them only where the stroke type in effect is
/// `Dashed` (attributes.md, dashes).
pub(super) fn dash_written(name: &str, stroke_type: Option<&str>) -> bool {
    !matches!(name, "StrokeDashAndGap" | "StrokeCornerAdjustment")
        || stroke_type == Some("StrokeStyle/$ID/Dashed")
}

/// The stroke type code of a custom stroke style, stored with its UID.
pub(super) const CUSTOM_STROKE_TYPE: u32 = 0x5A42;

/// The `Self` of a custom stroke style.
pub(super) fn custom_stroke_ref(st: &crate::model::StrokeStyle) -> String {
    let kind = if st.dashed {
        "DashedStrokeStyle"
    } else {
        "StripedStrokeStyle"
    };
    format!("{kind}/{}", self_name(&st.name))
}

/// IDML `EndCap` of an end cap code (attribute 0x6E6B).
pub(super) fn end_cap(code: u32) -> Option<&'static str> {
    Some(match code {
        0 => "ButtEndCap",
        1 => "RoundEndCap",
        2 => "ProjectingEndCap",
        _ => return None,
    })
}

/// The stroke styles every corpus IDML lists in `Graphic.xml`, in order.
/// See `docs/format/idml-values.md`.
pub(super) const BUILTIN_STROKE_STYLES: &[&str] = &[
    "Triple_Stroke",
    "ThickThinThick",
    "ThinThickThin",
    "ThickThick",
    "ThickThin",
    "ThinThick",
    "ThinThin",
    "Japanese Dots",
    "White Diamond",
    "Left Slant Hash",
    "Right Slant Hash",
    "Straight Hash",
    "Wavy",
    "Canned Dotted",
    "Canned Dashed 3x2",
    "Canned Dashed 4x4",
    "Dashed",
    "Solid",
];

/// Value of the kerning attribute (0x1B13) for no manual kerning; IDML
/// writes it `1e+11`. Every root paragraph style stores it.
pub(super) const KERNING_NONE: f64 = 1e8;

/// Text attributes: ID, IDML name, kind, written in `<Properties>`.
/// See `docs/format/attributes.md` for the evidence behind each entry.
pub(super) const TEXT_ATTRS: &[(u32, &str, Kind, bool)] = &[
    (0x1B01, "FillColor", Kind::Swatch, false),
    (0x1B02, "FontStyle", Kind::String, false),
    (0x1B03, "PointSize", Kind::Number, false),
    (0x1B06, "HorizontalScale", Kind::Percent, false),
    (0x1B08, "Ligatures", Kind::Equals(1), false),
    (
        0x1B07,
        "KerningMethod",
        Kind::Enum(&[
            (15972, "$ID/Metrics"),
            (79875, "$ID/Optical"),
            (0x3E65, "$ID/Metrics - Roman Only"),
            (0x221, "$ID/None"),
        ]),
        false,
    ),
    (0x1B0A, "StrokeWeight", Kind::Number, false),
    (0x1B0B, "Tracking", Kind::Scale(1000.0), false),
    (0x1B13, "KerningValue", Kind::Kerning, false),
    (
        0x1B0C,
        "Composer",
        Kind::Enum(&[
            (0x2001, "HL Single"),
            (0x2002, "HL Composer"),
            (0x2078, "HL Composer Optyca"),
            (0x2079, "HL Single Optyca"),
            (0x2010, "HL Composer J"),
            (0x2011, "HL Single J"),
        ]),
        false,
    ),
    (0x1B0D, "DropCapCharacters", Kind::Number, false),
    (0x1B0E, "DropCapLines", Kind::Number, false),
    (0x1B10, "BaselineShift", Kind::Number, false),
    (
        0x1B11,
        "Capitalization",
        Kind::Enum(&[
            (0, "Normal"),
            (1, "SmallCaps"),
            (2, "AllCaps"),
            (3, "CapToSmallCap"),
            (4, "LowerCase"),
        ]),
        false,
    ),
    (0x1B12, "StrokeColor", Kind::Swatch, false),
    (0x1B15, "VerticalScale", Kind::Percent, false),
    (0x1B16, "LeftIndent", Kind::Number, false),
    (0x1B17, "RightIndent", Kind::Number, false),
    (0x1B18, "FirstLineIndent", Kind::Number, false),
    (0x1B1A, "AutoLeading", Kind::Percent, false),
    (0x1B1B, "Leading", Kind::Leading, true),
    (0x1B1D, "AppliedLanguage", Kind::Language, false),
    (0x1B1F, "Hyphenation", Kind::Equals(3), false),
    (0x1B24, "NoBreak", Kind::Equals(1), false),
    (0x1B25, "HyphenationZone", Kind::Number, false),
    (0x1B26, "SpaceBefore", Kind::Number, false),
    (0x1B27, "SpaceAfter", Kind::Number, false),
    (0x1B29, "TabList", Kind::TabList, true),
    (0x1B2A, "Underline", Kind::Equals(1), false),
    (0x1B2B, "AppliedFont", Kind::Font, true),
    (0x42AE, "OpenTypeFeatures", Kind::Features, true),
    (
        0x1B2C,
        "OTFFigureStyle",
        Kind::Enum(&[
            (0, "TabularLining"),
            (1, "ProportionalOldstyle"),
            (2, "ProportionalLining"),
            (3, "TabularOldstyle"),
            (4, "Default"),
        ]),
        false,
    ),
    (0x1B2E, "MaximumWordSpacing", Kind::Percent, false),
    (0x1B2F, "MinimumWordSpacing", Kind::Percent, false),
    (0x1B31, "MaximumLetterSpacing", Kind::Percent, false),
    (0x1B32, "MinimumLetterSpacing", Kind::Percent, false),
    (
        0x1B37,
        "StartParagraph",
        Kind::Enum(&[
            (0, "Anywhere"),
            (1, "NextColumn"),
            (2, "NextPage"),
            (3, "NextFrame"),
            (4, "NextOddPage"),
        ]),
        false,
    ),
    (
        0x1B3C,
        "Position",
        Kind::Enum(&[
            (0, "Normal"),
            (1, "Superscript"),
            (2, "Subscript"),
            (3, "OTSuperscript"),
            (4, "OTSubscript"),
            (5, "OTNumerator"),
            (6, "OTDenominator"),
        ]),
        false,
    ),
    (0x1B40, "KeepLinesTogether", Kind::Equals(1), false),
    (0x1B42, "FillTint", Kind::Number, false),
    (0x1B46, "GradientFillAngle", Kind::Number, false),
    (0x1B48, "GradientFillLength", Kind::Number, false),
    (0x1B4A, "GradientFillStart", Kind::Point, false),
    (0x1B4D, "RuleAboveLineWeight", Kind::Number, false),
    (0x1B4F, "RuleAboveOffset", Kind::Number, false),
    (0x1B50, "RuleAboveLeftIndent", Kind::Number, false),
    (0x1B51, "RuleAboveRightIndent", Kind::Number, false),
    (
        0x1B52,
        "RuleAboveWidth",
        Kind::Enum(&[(1, "ColumnWidth"), (2, "TextWidth")]),
        false,
    ),
    (0x1B53, "RuleBelowColor", Kind::SwatchOrText, true),
    (0x1B54, "RuleBelowLineWeight", Kind::Number, false),
    (0x1B55, "RuleBelowTint", Kind::Number, false),
    (0x1B56, "RuleBelowOffset", Kind::Number, false),
    (0x1B5D, "RuleBelow", Kind::Equals(1), false),
    (
        0x1B6A,
        "ParagraphBreakType",
        Kind::Enum(&[
            (0, "Anywhere"),
            (1, "NextColumn"),
            (2, "NextPage"),
            (3, "NextFrame"),
            (4, "NextOddPage"),
        ]),
        false,
    ),
    (
        0x1B6B,
        "SingleWordJustification",
        Kind::Enum(&[(0, "LeftAlign"), (3, "FullyJustified")]),
        false,
    ),
    (0x1B75, "AllNestedStyles", Kind::NestedStyles, true),
    (0x1BBA, "AllGREPStyles", Kind::GrepStyles, true),
    (0x1BBB, "AllLineStyles", Kind::LineStyles, true),
    (
        0x42C0,
        "TreatIdeographicSpaceAsSpace",
        Kind::Equals(1),
        false,
    ),
    (
        0x50F18,
        "DiacriticPosition",
        Kind::Enum(&[(4, "OpentypePosition"), (5, "OpentypePositionFromBaseline")]),
        false,
    ),
    (0x4221, "Mojikumi", Kind::CjkSet, true),
    (0x4224, "KinsokuSet", Kind::CjkSet, true),
    (
        0x1B7E,
        "Justification",
        Kind::Enum(&[
            (0, "LeftAlign"),
            (1, "CenterAlign"),
            (2, "RightAlign"),
            (3, "FullyJustified"),
            (4, "LeftJustified"),
            (5, "CenterJustified"),
            (6, "RightJustified"),
            (8, "ToBindingSide"),
            (9, "AwayFromBindingSide"),
        ]),
        false,
    ),
    (0x1B80, "DropcapDetail", Kind::Number, false),
    (0x1B8C, "OTFContextualAlternate", Kind::Equals(1), false),
    (0x1B8D, "UnderlineColor", Kind::SwatchOrText, true),
    (0x1B91, "UnderlineOffset", Kind::Number, false),
    (0x1B94, "UnderlineWeight", Kind::Number, false),
    (0x1BB7, "MiterLimit", Kind::Number, false),
    (
        0x1BB9,
        "EndJoin",
        Kind::Enum(&[(0, "MiterEndJoin"), (1, "RoundEndJoin")]),
        false,
    ),
    (
        0x1BBD,
        "SpanColumnType",
        Kind::Enum(&[(0, "SingleColumn"), (1, "SpanColumns"), (2, "SplitColumns")]),
        false,
    ),
    (
        0x1BBE,
        "SpanSplitColumnCount",
        Kind::NumberOr(1.0, "All", "short"),
        true,
    ),
    (0x1BBF, "SplitColumnInsideGutter", Kind::Number, false),
    (0x1BC4, "SpanColumnMinSpaceAfter", Kind::Number, false),
    (0x1BD2, "ParagraphShadingColor", Kind::Swatch, true),
    (0x1BD3, "ParagraphShadingTint", Kind::Number, false),
    (0x1BD6, "ParagraphShadingOn", Kind::Equals(1), false),
    (0x1BDB, "ParagraphShadingTopOffset", Kind::Number, false),
    (0x1BDC, "ParagraphShadingBottomOffset", Kind::Number, false),
    (0x1BF6, "ParagraphBorderColor", Kind::Swatch, true),
    (0x1BFA, "ParagraphBorderGapColor", Kind::SwatchOrNone, true),
    (0x1BF9, "ParagraphBorderOn", Kind::Equals(1), false),
    (0x1DF03, "ParagraphBorderTopOffset", Kind::Number, false),
    (
        0x1DF12,
        "ParagraphShadingTopLeftCornerRadius",
        Kind::Number,
        false,
    ),
    (
        0x1DF14,
        "ParagraphShadingBottomLeftCornerRadius",
        Kind::Number,
        false,
    ),
    (0x1DF04, "ParagraphBorderBottomOffset", Kind::Number, false),
    (
        0x1DF21,
        "SameParaStyleSpacing",
        Kind::NumberOr(-1.0, "SetIgnore", "unit"),
        true,
    ),
    (0x4265, "GridAlignFirstLineOnly", Kind::Equals(1), false),
    (0x425E, "Tatechuyoko", Kind::Equals(1), false),
    (0x4279, "ShataiDegreeAngle", Kind::Scale(100.0), false),
    (0x427A, "ShataiAdjustTsume", Kind::Equals(1), false),
    (0x427B, "ShataiAdjustRotation", Kind::Equals(1), false),
    (0x422D, "RubyFlag", Kind::NonZero, false),
    (0x422E, "RubyString", Kind::Text, false),
    (
        0x4266,
        "GridAlignment",
        Kind::Enum(&[
            (0, "None"),
            (1, "AlignBaseline"),
            (2, "AlignEmTop"),
            (3, "AlignEmCenter"),
        ]),
        false,
    ),
    (
        0x1A401,
        "BulletsAndNumberingListType",
        Kind::Enum(&[(0, "NoList"), (1, "BulletList"), (2, "NumberedList")]),
        false,
    ),
    (0x1A406, "BulletChar", Kind::BulletChar, true),
    (0x1A413, "BulletsFont", Kind::FontOrNone, true),
    (0x1A414, "BulletsFontStyle", Kind::StringOrNothing, true),
    (0x1A417, "AppliedNumberingList", Kind::NumberingList, true),
    (0x1A419, "NumberingContinue", Kind::Equals(1), false),
    (0x1A41F, "BulletsCharacterStyle", Kind::CharacterStyle, true),
    (
        0x1A420,
        "NumberingCharacterStyle",
        Kind::CharacterStyle,
        true,
    ),
    (0x1A423, "NumberingExpression", Kind::String, false),
    // Paragraph and character attributes of audit-unknowns 4.12
    // (attributes.md, more paragraph and character attributes).
    (0x1B14, "HyphenateLadderLimit", Kind::Number, false),
    (0x1B68, "HyphenateLastWord", Kind::Bool, false),
    (0x1B85, "HyphenateAcrossColumns", Kind::Bool, false),
    (0x1B22, "HyphenateCapitalizedWords", Kind::Bool, false),
    (0x1B34, "MaximumGlyphScaling", Kind::Percent, false),
    (0x1B35, "MinimumGlyphScaling", Kind::Percent, false),
    (0x1B33, "DesiredGlyphScaling", Kind::Percent, false),
    (0x1B20, "HyphenateAfterFirst", Kind::Number, false),
    (0x1B23, "HyphenateWordsLongerThan", Kind::Number, false),
    (0x1B39, "KeepWithNext", Kind::Number, false),
    (0x1B2D, "DesiredWordSpacing", Kind::Percent, false),
    (0x1B21, "HyphenateBeforeLast", Kind::Number, false),
    (0x1B30, "DesiredLetterSpacing", Kind::Percent, false),
    (0x1B38, "KeepAllLinesTogether", Kind::Bool, false),
    (
        0x1B3E,
        "CharacterAlignment",
        Kind::Enum(&[
            (0, "AlignBaseline"),
            (1, "AlignEmCenter"),
            (2, "AlignEmBottom"),
            (3, "AlignEmTop"),
            (4, "AlignICFTop"),
            (5, "AlignICFBottom"),
        ]),
        false,
    ),
    (
        0x1B09,
        "PageNumberType",
        Kind::Enum(&[
            (0, "AutoPageNumber"),
            (2, "NextPageNumber"),
            (3, "TextVariable"),
        ]),
        false,
    ),
    (0x1B5E, "CustomGlyph", Kind::GlyphName, true),
    (0x1B4C, "RuleAboveColor", Kind::SwatchOrText, true),
    (0x1B5C, "RuleAbove", Kind::Bool, false),
    (0x1B83, "HyphenWeight", Kind::Number, false),
    (
        0x1B71,
        "RuleAboveType",
        Kind::Builtin("StrokeStyle/$ID/", STROKE_TYPES),
        true,
    ),
    (
        0x1B95,
        "UnderlineType",
        Kind::Builtin("StrokeStyle/$ID/", STROKE_TYPES),
        true,
    ),
    (
        0x1B72,
        "RuleBelowType",
        Kind::Builtin("StrokeStyle/$ID/", STROKE_TYPES),
        true,
    ),
    (
        0x1B9D,
        "StrikeThroughType",
        Kind::Builtin("StrokeStyle/$ID/", STROKE_TYPES),
        true,
    ),
    (
        0x1A40B,
        "NumberingFormat",
        Kind::EnumString(&[
            (0x1A477, "1, 2, 3, 4..."),
            (0x1A478, "I, II, III, IV..."),
            (0x1A479, "i, ii, iii, iv..."),
            (0x1A47A, "A, B, C, D..."),
            (0x1A47B, "a, b, c, d..."),
            (0x1A497, "01,02,03..."),
            (0x1A4A7, "$ID/Circle Numbering"),
            (0, "None"),
        ]),
        true,
    ),
    (
        0x1B73,
        "BalanceRaggedLines",
        Kind::Enum(&[(0, "NoBalancing"), (1, "VeeShape")]),
        true,
    ),
    (
        0x1A422,
        "NumberingAlignment",
        Kind::Enum(&[(0, "LeftAlign"), (2, "RightAlign")]),
        false,
    ),
    (
        0x1A421,
        "BulletsAlignment",
        Kind::Enum(&[(0, "LeftAlign"), (1, "CenterAlign"), (2, "RightAlign")]),
        false,
    ),
    (0x1B4E, "RuleAboveTint", Kind::Number, false),
    (
        0x50F29,
        "ParagraphDirection",
        Kind::Enum(&[(0, "LeftToRightDirection"), (1, "RightToLeftDirection")]),
        false,
    ),
    (
        0x50F2A,
        "ParagraphJustification",
        Kind::Enum(&[
            (0, "DefaultJustification"),
            (6, "NaskhKashidaJustificationFrac"),
        ]),
        false,
    ),
    (
        0x50F1F,
        "CharacterDirection",
        Kind::Enum(&[
            (0, "DefaultDirection"),
            (1, "LeftToRightDirection"),
            (2, "RightToLeftDirection"),
        ]),
        false,
    ),
    (
        0x50F11,
        "DigitsType",
        Kind::Enum(&[(0, "DefaultDigits"), (2, "HindiDigits")]),
        false,
    ),
    (0x1A418, "NumberingLevel", Kind::Number, false),
    (0x1A424, "BulletsTextAfter", Kind::String, false),
    (0x1A41D, "NumberingApplyRestartPolicy", Kind::Bool, false),
    (
        0x1BB8,
        "StrokeAlignment",
        Kind::Enum(&[(0, "CenterAlignment"), (2, "OutsideAlignment")]),
        false,
    ),
    (
        0x4297,
        "LeadingModel",
        Kind::Enum(&[
            (0, "LeadingModelRoman"),
            (1, "LeadingModelAkiBelow"),
            (2, "LeadingModelAkiAbove"),
            (3, "LeadingModelCenter"),
        ]),
        false,
    ),
    (0x1BC1, "KeepWithPrevious", Kind::Bool, false),
    (0x1B93, "UnderlineTint", Kind::Number, false),
    (0x1B8E, "UnderlineGapColor", Kind::SwatchOrText, true),
    (0x1B77, "RuleAboveGapColor", Kind::SwatchOrText, true),
    (0x1B96, "StrikeThroughColor", Kind::SwatchOrText, true),
    (0x426C, "Rensuuji", Kind::Bool, false),
    (0x4295, "OTFProportionalMetrics", Kind::Bool, false),
    (0x1B57, "RuleBelowLeftIndent", Kind::Number, false),
    (0x1B58, "RuleBelowRightIndent", Kind::Number, false),
    (
        0x1B59,
        "RuleBelowWidth",
        Kind::Enum(&[(1, "ColumnWidth"), (2, "TextWidth")]),
        false,
    ),
    (0x1B86, "KeepRuleAboveInFrame", Kind::Bool, false),
    (0x1B6F, "OTFTitling", Kind::Bool, false),
    (0x1B6E, "OTFDiscretionaryLigature", Kind::Bool, false),
    (0x1BCA, "OTFSwash", Kind::Bool, false),
    (0x1B89, "OTFStylisticSets", Kind::Number, false),
    (0x1B44, "OverprintFill", Kind::Bool, false),
    (0x1B92, "UnderlineOverprint", Kind::Bool, false),
    (0x1B8F, "UnderlineGapOverprint", Kind::Bool, false),
    (0x1B3D, "StrikeThru", Kind::Bool, false),
    (0x1B9A, "StrikeThroughOffset", Kind::Number, false),
    (0x1B9E, "StrikeThroughWeight", Kind::Number, false),
    (0x1B9C, "StrikeThroughTint", Kind::Number, false),
    (0x1B78, "RuleAboveGapTint", Kind::Number, false),
    (0x1B4B, "Skew", Kind::Number, false),
    (0x1B65, "LastLineIndent", Kind::Number, false),
    (
        0x1B81,
        "PositionalForm",
        Kind::Enum(&[(0, "None"), (1, "Calculate"), (2, "Initial")]),
        false,
    ),
    (0x1B87, "IgnoreEdgeAlignment", Kind::Bool, false),
    (
        0x42AD,
        "GlyphForm",
        Kind::Enum(&[
            (0, "None"),
            (2, "ExpertForm"),
            (5, "MonospacedHalfWidthForm"),
            (9, "ProportionalWidthForm"),
            (10, "FullWidthForm"),
        ]),
        false,
    ),
    (0x4222, "LeadingAki", Kind::Number, false),
    (0x4223, "TrailingAki", Kind::Number, false),
    (
        0x4225,
        "KinsokuType",
        Kind::Enum(&[
            (0, "KinsokuPushInFirst"),
            (2, "KinsokuPushOutOnly"),
            (3, "KinsokuPrioritizeAdjustmentAmount"),
        ]),
        false,
    ),
    (
        0x4226,
        "KinsokuHangType",
        Kind::Enum(&[
            (0, "None"),
            (1, "KinsokuHangRegular"),
            (2, "KinsokuHangForce"),
        ]),
        false,
    ),
    (0x4227, "BunriKinshi", Kind::Bool, false),
    (0x421D, "Tsume", Kind::Number, false),
    (0x42A6, "CjkGridTracking", Kind::Bool, false),
    (0x422C, "RubyOpenTypePro", Kind::Bool, false),
    (0x422F, "RubyFontSize", Kind::Number, false),
    (0x4248, "KentenFontSize", Kind::Number, false),
    (
        0x4232,
        "RubyType",
        Kind::Enum(&[(0, "GroupRuby"), (1, "PerCharacterRuby")]),
        false,
    ),
    (
        0x4247,
        "KentenKind",
        Kind::Enum(&[
            (0, "None"),
            (1, "KentenSesameDot"),
            (5, "KentenSmallBlackCircle"),
        ]),
        false,
    ),
    // Ruby, kenten and warichu (attributes.md, ruby, kenten and warichu).
    (
        0x4231,
        "RubyAlignment",
        Kind::Enum(&[(1, "RubyCenter"), (2, "RubyRight"), (4, "RubyJIS")]),
        false,
    ),
    (
        0x4235,
        "RubyParentSpacing",
        Kind::Enum(&[
            (0, "RubyParentNoAdjustment"),
            (1, "RubyParentBothSides"),
            (2, "RubyParent121Aki"),
        ]),
        false,
    ),
    (
        0x423C,
        "RubyParentOverhangAmount",
        Kind::Enum(&[
            (0, "None"),
            (1, "RubyOverhangOneRuby"),
            (5, "RubyOverhangNoLimit"),
        ]),
        false,
    ),
    (
        0x423A,
        "RubyPosition",
        Kind::Enum(&[(0, "AboveRight"), (1, "BelowLeft")]),
        false,
    ),
    (0x4239, "RubyYOffset", Kind::Number, false),
    (0x423F, "RubyParentScalingPercent", Kind::Percent, false),
    (0x423E, "RubyAutoScaling", Kind::Bool, false),
    (0x423B, "RubyAutoAlign", Kind::Bool, false),
    (0x42B1, "RubyAutoTcyDigits", Kind::Number, false),
    (0x42B2, "RubyAutoTcyIncludeRoman", Kind::Bool, false),
    (0x4236, "RubyXScale", Kind::Percent, false),
    (0x424C, "KentenXScale", Kind::Percent, false),
    (
        0x4281,
        "WarichuAlignment",
        Kind::Enum(&[(0, "LeftAlign"), (7, "Auto")]),
        false,
    ),
    (0x427D, "Warichu", Kind::Bool, false),
    (0x427E, "WarichuLines", Kind::Number, false),
    (0x427F, "WarichuSize", Kind::Percent, false),
    (0x4280, "WarichuLineSpacing", Kind::Number, false),
    (0x4234, "RubyFontStyle", Kind::EmptyAsNothing, true),
    (0x424B, "KentenFontStyle", Kind::EmptyAsNothing, true),
    (0x1DF1F, "MergeConsecutiveParaBorders", Kind::Bool, false),
    (0x1DF1A, "ParagraphBorderTopLineWeight", Kind::Number, false),
    (
        0x1DF1B,
        "ParagraphBorderBottomLineWeight",
        Kind::Number,
        false,
    ),
    (
        0x1DF1C,
        "ParagraphBorderLeftLineWeight",
        Kind::Number,
        false,
    ),
    (
        0x1DF1D,
        "ParagraphBorderRightLineWeight",
        Kind::Number,
        false,
    ),
    (0x1DF01, "ParagraphBorderLeftOffset", Kind::Number, false),
    (0x1DF02, "ParagraphBorderRightOffset", Kind::Number, false),
    (0x1BF7, "ParagraphBorderTint", Kind::Number, false),
    (
        0x1DF16,
        "ParagraphBorderStrokeEndCap",
        Kind::Enum(&[(0, "ButtEndCap"), (1, "RoundEndCap")]),
        false,
    ),
    (
        0x1DF17,
        "ParagraphBorderWidth",
        Kind::Enum(&[(0, "ColumnWidth"), (1, "TextWidth")]),
        false,
    ),
    (
        0x1DF20,
        "ProviderHyphenationStyle",
        Kind::Enum(&[(0, "HyphAll"), (3, "HyphPreferredAesthetic")]),
        false,
    ),
    (0x1BD9, "ParagraphShadingLeftOffset", Kind::Number, false),
    (0x1BDA, "ParagraphShadingRightOffset", Kind::Number, false),
    (
        0x1BD5,
        "ParagraphShadingWidth",
        Kind::Enum(&[(0, "ColumnWidth"), (1, "TextWidth")]),
        false,
    ),
    (0x1BD7, "ParagraphShadingClipToFrame", Kind::Bool, false),
    (0x1BD4, "ParagraphShadingOverprint", Kind::Bool, false),
    (
        0x1BFD,
        "ParagraphBorderType",
        Kind::Builtin("StrokeStyle/$ID/", STROKE_TYPES),
        true,
    ),
    (0x1B3A, "KeepFirstLines", Kind::Number, false),
    (0x1B3B, "KeepLastLines", Kind::Number, false),
    (0x42C1, "AllowArbitraryHyphenation", Kind::Bool, false),
    (0x4264, "GridGyoudori", Kind::Number, false),
    (0x4268, "RotateSingleByteCharacters", Kind::Bool, false),
    (0x4261, "AutoTcy", Kind::Number, false),
    (0x42A3, "ScaleAffectsLineHeight", Kind::Bool, false),
    (0x4233, "RubyFont", Kind::FontOrNone, true),
    (0x4257, "KentenFillColor", Kind::SwatchOrText, true),
    // Placed by the order of the attribute list and the payload type
    // (attributes.md, attributes placed by order).
    (0x1B41, "StrokeTint", Kind::Number, false),
    (0x1B43, "OverprintStroke", Kind::Bool, false),
    (0x1B45, "GradientStrokeAngle", Kind::Number, false),
    (0x1B47, "GradientStrokeLength", Kind::Number, false),
    (0x1B49, "GradientStrokeStart", Kind::Point, false),
    (0x1B5A, "RuleAboveOverprint", Kind::Bool, false),
    (0x1B5B, "RuleBelowOverprint", Kind::Bool, false),
    (0x1B6C, "OTFOrdinal", Kind::Bool, false),
    (0x1B6D, "OTFFraction", Kind::Bool, false),
    (0x1B79, "RuleAboveGapOverprint", Kind::Bool, false),
    (0x1B7B, "RuleBelowGapColor", Kind::SwatchOrText, true),
    (0x1B7C, "RuleBelowGapTint", Kind::Number, false),
    (0x1B7D, "RuleBelowGapOverprint", Kind::Bool, false),
    (0x1B82, "OTFMark", Kind::Bool, false),
    (0x1B84, "OTFLocale", Kind::Bool, false),
    (0x1B88, "OTFSlashedZero", Kind::Bool, false),
    (0x1B8A, "OTFHistorical", Kind::Bool, false),
    (0x1B90, "UnderlineGapTint", Kind::Number, false),
    (0x1B97, "StrikeThroughGapColor", Kind::SwatchOrText, true),
    (0x1B98, "StrikeThroughGapOverprint", Kind::Bool, false),
    (0x1B99, "StrikeThroughGapTint", Kind::Number, false),
    (0x1B9B, "StrikeThroughOverprint", Kind::Bool, false),
    (0x1BC0, "SplitColumnOutsideGutter", Kind::Number, false),
    (0x1BC3, "SpanColumnMinSpaceBefore", Kind::Number, false),
    (
        0x1BD8,
        "ParagraphShadingSuppressPrinting",
        Kind::Bool,
        false,
    ),
    (0x1BF8, "ParagraphBorderOverprint", Kind::Bool, false),
    (0x1BFB, "ParagraphBorderGapTint", Kind::Number, false),
    (0x1BFC, "ParagraphBorderGapOverprint", Kind::Bool, false),
    (0x4237, "RubyYScale", Kind::Percent, false),
    (0x4238, "RubyXOffset", Kind::Number, false),
    (0x423D, "RubyOverhang", Kind::Bool, false),
    (0x4240, "RubyFill", Kind::SwatchOrText, true),
    (0x4241, "RubyTint", Kind::Number, false),
    (
        0x4242,
        "RubyOverprintFill",
        Kind::Enum(&[(0xFFFF, "Auto")]),
        false,
    ),
    (0x4243, "RubyStroke", Kind::SwatchOrText, true),
    (0x4244, "RubyStrokeTint", Kind::Number, false),
    (
        0x4245,
        "RubyOverprintStroke",
        Kind::Enum(&[(0xFFFF, "Auto")]),
        false,
    ),
    (0x4246, "RubyWeight", Kind::Number, false),
    (0x424A, "KentenFont", Kind::FontOrNone, true),
    (0x424D, "KentenYScale", Kind::Percent, false),
    (0x424F, "KentenPlacement", Kind::Number, false),
    (
        0x4250,
        "KentenAlignment",
        Kind::Enum(&[(1, "AlignKentenCenter")]),
        false,
    ),
    (
        0x4251,
        "KentenPosition",
        Kind::Enum(&[(0, "AboveRight")]),
        false,
    ),
    (
        0x4252,
        "KentenCustomCharacter",
        Kind::Enum(&[(0, "")]),
        false,
    ),
    (
        0x4253,
        "KentenCharacterSet",
        Kind::Enum(&[(0, "CharacterInput")]),
        false,
    ),
    (0x4258, "KentenTint", Kind::Number, false),
    (
        0x4259,
        "KentenOverprintFill",
        Kind::Enum(&[(0xFFFF, "Auto")]),
        false,
    ),
    (0x425A, "KentenStrokeColor", Kind::SwatchOrText, true),
    (0x425B, "KentenStrokeTint", Kind::Number, false),
    (
        0x425C,
        "KentenOverprintStroke",
        Kind::Enum(&[(0xFFFF, "Auto")]),
        false,
    ),
    (0x425D, "KentenWeight", Kind::Number, false),
    (0x425F, "TatechuyokoXOffset", Kind::Number, false),
    (0x4260, "TatechuyokoYOffset", Kind::Number, false),
    (0x4262, "AutoTcyIncludeRoman", Kind::Bool, false),
    (0x4263, "Jidori", Kind::Number, false),
    (0x4267, "CharacterRotation", Kind::Number, false),
    (0x4278, "ShataiMagnification", Kind::Number, false),
    (0x428E, "WarichuCharsBeforeBreak", Kind::Number, false),
    (0x428F, "WarichuCharsAfterBreak", Kind::Number, false),
    (0x4294, "OTFHVKana", Kind::Bool, false),
    (0x4296, "OTFRomanItalics", Kind::Bool, false),
    (0x42A4, "ParagraphGyoudori", Kind::Bool, false),
    (0x42B3, "RubyAutoTcyAutoScale", Kind::Bool, false),
    (0x1A407, "NumberingStartAt", Kind::Number, false),
    (
        0x1A41E,
        "NumberingRestartPolicies",
        Kind::RestartPolicies,
        true,
    ),
    (
        0x1DF05,
        "ParagraphBorderStrokeEndJoin",
        Kind::Enum(&[(0, "MiterEndJoin")]),
        false,
    ),
    (
        0x1DF06,
        "ParagraphBorderTopLeftCornerOption",
        Kind::Enum(&[(0, "None")]),
        false,
    ),
    (
        0x1DF07,
        "ParagraphBorderTopRightCornerOption",
        Kind::Enum(&[(0, "None")]),
        false,
    ),
    (
        0x1DF08,
        "ParagraphBorderBottomLeftCornerOption",
        Kind::Enum(&[(0, "None")]),
        false,
    ),
    (
        0x1DF09,
        "ParagraphBorderBottomRightCornerOption",
        Kind::Enum(&[(0, "None")]),
        false,
    ),
    (0x1DF1E, "ParagraphBorderDisplayIfSplits", Kind::Bool, false),
    (
        0x50F15,
        "Kashidas",
        Kind::Enum(&[(0, "DefaultKashidas")]),
        false,
    ),
    (0x50F2B, "ParagraphKashidaWidth", Kind::Number, false),
    (0x50F2F, "XOffsetDiacritic", Kind::Number, false),
    (0x50F30, "YOffsetDiacritic", Kind::Number, false),
    (0x50F3C, "OTFOverlapSwash", Kind::Bool, false),
    (0x50F3D, "OTFStylisticAlternate", Kind::Bool, false),
    (0x50F3E, "OTFJustificationAlternate", Kind::Bool, false),
    (0x50F3F, "OTFStretchedAlternate", Kind::Bool, false),
    (
        0x50F40,
        "KeyboardDirection",
        Kind::Enum(&[(0, "DefaultDirection"), (1, "LeftToRightDirection")]),
        false,
    ),
];

/// Paragraph shading corner option codes.
const SHADING_CORNERS: &[(u32, &str)] = &[
    (0, "None"),
    (0x5A15, "RoundedCorner"),
    (0x5A18, "BevelCorner"),
];

/// Text attributes whose IDs have the same value in every sample, so the
/// ID of each attribute is not known: IDs, IDML names, value kind. A group
/// is written only when all its IDs are present with the same value. See
/// `docs/format/attributes.md`, paragraph borders and shading.
const TIED_TEXT_ATTRS: &[(&[u32], &[&str], Kind)] = &[
    (
        &[0x1DF0A, 0x1DF0B, 0x1DF0C, 0x1DF0D],
        &[
            "ParagraphBorderTopLeftCornerRadius",
            "ParagraphBorderTopRightCornerRadius",
            "ParagraphBorderBottomLeftCornerRadius",
            "ParagraphBorderBottomRightCornerRadius",
        ],
        Kind::Number,
    ),
    (
        &[0x1DF13, 0x1DF15],
        &[
            "ParagraphShadingTopRightCornerRadius",
            "ParagraphShadingBottomRightCornerRadius",
        ],
        Kind::Number,
    ),
    (
        &[0x1DF0E, 0x1DF10],
        &[
            "ParagraphShadingTopLeftCornerOption",
            "ParagraphShadingBottomLeftCornerOption",
        ],
        Kind::Enum(SHADING_CORNERS),
    ),
    (
        &[0x1DF0F, 0x1DF11],
        &[
            "ParagraphShadingTopRightCornerOption",
            "ParagraphShadingBottomRightCornerOption",
        ],
        Kind::Enum(SHADING_CORNERS),
    ),
];

/// Pairs of text attributes that change together: the two IDs, the two
/// IDML names, and the IDML values of each known pair of codes. See
/// `docs/format/attributes.md`, paragraph borders and shading.
#[allow(clippy::type_complexity)]
const PAIRED_TEXT_ATTRS: &[([u32; 2], [&str; 2], &[([u32; 2], [&str; 2])])] = &[
    (
        [0x1BDD, 0x1BDE],
        ["ParagraphShadingTopOrigin", "ParagraphShadingBottomOrigin"],
        &[
            ([0, 0], ["AscentTopOrigin", "DescentBottomOrigin"]),
            ([3, 2], ["EmBoxTopOrigin", "EmBoxBottomOrigin"]),
            ([1, 1], ["BaselineTopOrigin", "BaselineBottomOrigin"]),
        ],
    ),
    (
        [0x1DF18, 0x1DF19],
        ["ParagraphBorderTopOrigin", "ParagraphBorderBottomOrigin"],
        &[
            ([0, 0], ["AscentTopOrigin", "DescentBottomOrigin"]),
            ([3, 2], ["EmBoxTopOrigin", "EmBoxBottomOrigin"]),
        ],
    ),
];

/// An attribute written as a `<Properties>` child: name, type, value.
pub(super) type Property = (&'static str, &'static str, PropValue);

/// One field of a record in a list property: name, type, text.
pub(super) type Field = (&'static str, &'static str, String);

/// The value of a `<Properties>` child.
pub(super) enum PropValue {
    Text(String),
    /// Records, each written as a `ListItem` (type `list`).
    List(Vec<Vec<Field>>),
    /// Lists, each written as a `ListItem` of type `list` holding one
    /// `ListItem` per value (type, text).
    Lists(Vec<Vec<(&'static str, String)>>),
    /// An empty element with these attributes and no `type`.
    Attributes(Vec<(&'static str, String)>),
}

impl From<String> for PropValue {
    fn from(s: String) -> PropValue {
        PropValue::Text(s)
    }
}

/// Page item attributes: attribute-list ID, IDML name, value kind.
/// See `docs/format/attributes.md` for the evidence behind each entry.
pub(super) const ITEM_ATTRS: &[(u32, &str, Kind)] = &[
    (0x6E68, "FillColor", Kind::Swatch),
    (0x6E69, "FillTint", Kind::Tint),
    (0x6E64, "StrokeColor", Kind::Swatch),
    (0x6E65, "StrokeWeight", Kind::Number),
    (0x6E6D, "MiterLimit", Kind::Number),
    (0x6E6F, "CornerOption", Kind::Enum(CORNER_OPTIONS)),
    (0x6E70, "CornerRadius", Kind::Number),
    (0x6E70, "TopLeftCornerRadius", Kind::Number),
    (0x6E94, "TopRightCornerRadius", Kind::Number),
    (0x6E92, "BottomLeftCornerRadius", Kind::Number),
    (0x6E93, "BottomRightCornerRadius", Kind::Number),
    (0x6E6F, "TopLeftCornerOption", Kind::Enum(CORNER_OPTIONS)),
    (0x6E91, "TopRightCornerOption", Kind::Enum(CORNER_OPTIONS)),
    (0x6E8F, "BottomLeftCornerOption", Kind::Enum(CORNER_OPTIONS)),
    (
        0x6E90,
        "BottomRightCornerOption",
        Kind::Enum(CORNER_OPTIONS),
    ),
    (0x551F, "GradientFillLength", Kind::Number),
    (0x5520, "GradientFillStart", Kind::Point),
    (0x5525, "GradientStrokeLength", Kind::Number),
    (0x5526, "GradientStrokeStart", Kind::Point),
    (
        0x6E6E,
        "StrokeType",
        Kind::Builtin("StrokeStyle/$ID/", STROKE_TYPES),
    ),
    (
        0x6E8C,
        "StrokeAlignment",
        Kind::Enum(&[
            (0, "CenterAlignment"),
            (1, "InsideAlignment"),
            (2, "OutsideAlignment"),
        ]),
    ),
    (0x6E66, "StrokeTint", Kind::Tint),
    (0x5A35, "StrokeDashAndGap", Kind::Dashes),
    (0x5A35, "StrokeCornerAdjustment", Kind::DashCorner),
    (0x6E89, "GapColor", Kind::Swatch),
    (0x6E8A, "GapTint", Kind::Tint),
    (
        0x6E6B,
        "EndCap",
        Kind::Enum(&[
            (0, "ButtEndCap"),
            (1, "RoundEndCap"),
            (2, "ProjectingEndCap"),
        ]),
    ),
    (
        0x6E6C,
        "EndJoin",
        Kind::Enum(&[
            (0, "MiterEndJoin"),
            (1, "RoundEndJoin"),
            (2, "BevelEndJoin"),
        ]),
    ),
    (0x6E71, "LeftLineEnd", Kind::Enum(LINE_ENDS)),
    (0x6E72, "RightLineEnd", Kind::Enum(LINE_ENDS)),
    (
        0x6E84,
        "ArrowHeadAlignment",
        Kind::Enum(&[(0, "InsidePath"), (1, "OutsidePath")]),
    ),
];

/// Line end codes of 0x6E71 and 0x6E72 (attributes.md, line ends).
const LINE_ENDS: &[(u32, &str)] = &[
    (0, "None"),
    (0x5A03, "SimpleArrowHead"),
    (0x5A04, "SimpleWideArrowHead"),
    (0x5A05, "TriangleArrowHead"),
    (0x5A06, "TriangleWideArrowHead"),
    (0x5A07, "BarbedArrowHead"),
    (0x5A08, "CurvedArrowHead"),
    (0x5A09, "CircleArrowHead"),
    (0x5A0A, "CircleSolidArrowHead"),
    (0x5A0C, "SquareSolidArrowHead"),
    (0x5A0D, "BarArrowHead"),
];

/// Attributes of `PageItemDefault` beyond the page item table
/// (`docs/format/preferences.md`, page item defaults).
pub(super) const ITEM_DEFAULT_ATTRS: &[(u32, &str, Kind)] = &[
    (0x551E, "GradientFillAngle", Kind::Number),
    (0x5524, "GradientStrokeAngle", Kind::Number),
    (0x6E78, "Nonprinting", Kind::Bool),
    (0x6E95, "LeftArrowHeadScale", Kind::Number),
    (0x6E96, "RightArrowHeadScale", Kind::Number),
];

/// Gradient attributes every page item has: attribute-list ID (0 for
/// none, `GradientStroke...` of groups), IDML name, value without the
/// attribute. Fill and stroke start and length are in `ITEM_ATTRS`. See
/// `docs/format/objects.md`, page item settings.
pub(super) const GRADIENT_ATTRS: &[(u32, &str, &str)] = &[
    (0x5520, "GradientFillStart", "0 0"),
    (0x551F, "GradientFillLength", "0"),
    (0x551E, "GradientFillAngle", "0"),
    (0x5526, "GradientStrokeStart", "0 0"),
    (0x5525, "GradientStrokeLength", "0"),
    (0x5524, "GradientStrokeAngle", "0"),
    (0x5522, "GradientFillHiliteLength", "0"),
    (0x5523, "GradientFillHiliteAngle", "0"),
    (0x5528, "GradientStrokeHiliteLength", "0"),
    (0x5529, "GradientStrokeHiliteAngle", "0"),
];

/// IDML `HorizontalLayoutConstraints` and `VerticalLayoutConstraints` of
/// layout constraint flags (chunk 0x22228): bits 4 to 6 and 0 to 2, each
/// set for `FixedDimension`. `None` if another bit is set.
pub(super) fn layout_constraints(flags: u8) -> Option<(String, String)> {
    if flags & 0x88 != 0 {
        return None;
    }
    let side = |bits: u8| {
        (0..3)
            .map(|i| {
                if bits & (1 << i) != 0 {
                    "FixedDimension"
                } else {
                    "FlexibleDimension"
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    };
    Some((side(flags >> 4), side(flags & 7)))
}

/// Numbers separated by spaces.
pub(super) fn join_numbers(v: &[u32]) -> String {
    v.iter().map(u32::to_string).collect::<Vec<_>>().join(" ")
}

/// Cell attributes of a cell attribute set other than the edges: ID,
/// IDML attributes, kind. IDML names that start with `Text` are written
/// from DOM 11 only. See `docs/format/tables.md`.
pub(super) const CELL_ATTRS: &[(u32, &[&str], Kind)] = &[
    (0xB62C, &["TextTopInset", "TopInset"], Kind::Number),
    (0xB62B, &["TextLeftInset", "LeftInset"], Kind::Number),
    (0xB62E, &["TextBottomInset", "BottomInset"], Kind::Number),
    (0xB62D, &["TextRightInset", "RightInset"], Kind::Number),
    (0x10470, &["GraphicLeftInset"], Kind::Number),
    (0x10471, &["GraphicTopInset"], Kind::Number),
    (0x10472, &["GraphicRightInset"], Kind::Number),
    (0x10473, &["GraphicBottomInset"], Kind::Number),
    (0xB63D, &["FillColor"], Kind::Swatch),
    (0xB63E, &["FillTint"], Kind::Number),
    (0xB639, &["OverprintFill"], Kind::Enum(&[(0, "false")])),
    (
        0xB677,
        &["VerticalJustification"],
        Kind::Enum(&[
            (0, "TopAlign"),
            (1, "CenterAlign"),
            (2, "BottomAlign"),
            (3, "JustifyAlign"),
        ]),
    ),
    (
        0xB676,
        &["FirstBaselineOffset"],
        Kind::Enum(&[
            (0, "LeadingOffset"),
            (1, "AscentOffset"),
            (3, "EmboxHeight"),
        ]),
    ),
    (0xB6E1, &["WritingDirection"], Kind::Enum(&[(1, "true")])),
    (0xB675, &["RotationAngle"], Kind::Number),
    (0xB6DE, &["ClipContentToCell"], Kind::Enum(&[(0, "false")])),
    (
        0xB6DC,
        &["DiagonalLineStrokeOverprint"],
        Kind::Enum(&[(0, "false")]),
    ),
];

/// Cell edge attributes: the IDs for the left, right, top and bottom
/// edge, the IDML attributes for the same edges, and the kind. See
/// `docs/format/tables.md`.
pub(super) const CELL_EDGE_ATTRS: &[([u32; 4], [&str; 4], Kind)] = &[
    (
        [0xB645, 0xB646, 0xB647, 0xB648],
        [
            "LeftEdgeStrokeWeight",
            "RightEdgeStrokeWeight",
            "TopEdgeStrokeWeight",
            "BottomEdgeStrokeWeight",
        ],
        Kind::Number,
    ),
    (
        [0xB64D, 0xB64E, 0xB64F, 0xB650],
        [
            "LeftEdgeStrokeType",
            "RightEdgeStrokeType",
            "TopEdgeStrokeType",
            "BottomEdgeStrokeType",
        ],
        Kind::StrokeType,
    ),
    (
        [0xB649, 0xB64B, 0xB64A, 0xB64C],
        [
            "LeftEdgeStrokeColor",
            "RightEdgeStrokeColor",
            "TopEdgeStrokeColor",
            "BottomEdgeStrokeColor",
        ],
        Kind::Swatch,
    ),
    (
        [0xB6A8, 0xB6A9, 0xB6AA, 0xB6AB],
        [
            "LeftEdgeStrokeTint",
            "RightEdgeStrokeTint",
            "TopEdgeStrokeTint",
            "BottomEdgeStrokeTint",
        ],
        Kind::EdgeTint,
    ),
    (
        CELL_EDGE_PRIORITY,
        [
            "LeftEdgeStrokePriority",
            "RightEdgeStrokePriority",
            "TopEdgeStrokePriority",
            "BottomEdgeStrokePriority",
        ],
        Kind::Integer,
    ),
    (
        [0x1040F, 0x10410, 0x10411, 0x10412],
        [
            "LeftEdgeStrokeGapTint",
            "RightEdgeStrokeGapTint",
            "TopEdgeStrokeGapTint",
            "BottomEdgeStrokeGapTint",
        ],
        Kind::EdgeTint,
    ),
    (
        [0x10420, 0x10421, 0x10422, 0x10423],
        [
            "LeftEdgeStrokeGapColor",
            "RightEdgeStrokeGapColor",
            "TopEdgeStrokeGapColor",
            "BottomEdgeStrokeGapColor",
        ],
        Kind::Swatch,
    ),
    (
        [0xB6BA, 0xB6BB, 0xB6BC, 0xB6BD],
        [
            "LeftEdgeStrokeOverprint",
            "RightEdgeStrokeOverprint",
            "TopEdgeStrokeOverprint",
            "BottomEdgeStrokeOverprint",
        ],
        Kind::Enum(&[(0, "false")]),
    ),
    (
        [0x10431, 0x10432, 0x10433, 0x10434],
        [
            "LeftEdgeStrokeGapOverprint",
            "RightEdgeStrokeGapOverprint",
            "TopEdgeStrokeGapOverprint",
            "BottomEdgeStrokeGapOverprint",
        ],
        Kind::Enum(&[(0, "false")]),
    ),
];

/// Edge stroke priority IDs (left, right, top, bottom).
pub(super) const CELL_EDGE_PRIORITY: [u32; 4] = [0xB6F9, 0xB6FA, 0xB6FB, 0xB6FC];

/// The edge of a cell style that each cell edge ID gives: cell left is
/// style top, right is bottom, top is right, bottom is left (indices
/// into the left, right, top, bottom order).
pub(super) const CELL_STYLE_EDGE: [usize; 4] = [2, 3, 1, 0];

/// Table and table style attributes: ID, IDML attribute, kind.
/// See `docs/format/tables.md`.
pub(super) const TABLE_ATTRS: &[(u32, &str, Kind)] = &[
    (0xB662, "SpaceBefore", Kind::Number),
    (0xB663, "SpaceAfter", Kind::Number),
    (0xB686, "StartRowStrokeCount", Kind::Integer),
    (0xB687, "EndRowStrokeCount", Kind::Integer),
    (0xB68C, "StartColumnStrokeCount", Kind::Integer),
    (0xB68D, "EndColumnStrokeCount", Kind::Integer),
    (0xB67D, "StartRowFillCount", Kind::Integer),
    (0xB67E, "EndRowFillCount", Kind::Integer),
    (0xB684, "StartRowStrokeColor", Kind::Swatch),
    (0xB685, "EndRowStrokeColor", Kind::Swatch),
    (0xB68A, "StartColumnStrokeColor", Kind::Swatch),
    (0xB68B, "EndColumnStrokeColor", Kind::Swatch),
    (0xB690, "StartRowStrokeWeight", Kind::Number),
    (0xB691, "EndRowStrokeWeight", Kind::Number),
    (0xB692, "StartColumnStrokeWeight", Kind::Number),
    (0xB693, "EndColumnStrokeWeight", Kind::Number),
    (0xB688, "StartRowStrokeType", Kind::StrokeType),
    (0xB689, "EndRowStrokeType", Kind::StrokeType),
    (0xB6B4, "StartRowStrokeTint", Kind::Number),
    (0xB6B5, "EndRowStrokeTint", Kind::Number),
    (0xB6B6, "StartColumnStrokeTint", Kind::Number),
    (0xB6B7, "EndColumnStrokeTint", Kind::Number),
    (0xB683, "ColumnFillsPriority", Kind::Enum(&[(0, "false")])),
    (0xB67B, "StartRowFillColor", Kind::Swatch),
    (0xB67C, "EndRowFillColor", Kind::Swatch),
    (0xB67F, "StartColumnFillColor", Kind::Swatch),
    (0xB680, "EndColumnFillColor", Kind::Swatch),
    (0xB6B0, "StartRowFillTint", Kind::Number),
    (0xB6B1, "EndRowFillTint", Kind::Number),
    (0xB6B2, "StartColumnFillTint", Kind::Number),
    (0xB6B3, "EndColumnFillTint", Kind::Number),
    (0xB695, "SkipFirstAlternatingFillRows", Kind::Integer),
    (0xB6E2, "SkipFirstAlternatingStrokeRows", Kind::Integer),
];

/// The graphic cell values of tables and table styles.
pub(super) const GRAPHIC_CELL_ATTRS: &[(u32, &str, Kind)] = &[
    (0x10470, "GraphicLeftInset", Kind::Number),
    (0x10471, "GraphicTopInset", Kind::Number),
    (0x10472, "GraphicRightInset", Kind::Number),
    (0x10473, "GraphicBottomInset", Kind::Number),
    (
        0x10478,
        "ClipContentToGraphicCell",
        Kind::Enum(&[(0, "false")]),
    ),
];

/// Attributes of tables that table styles do not have (the IDML schema
/// has none of them on `TableStyle`).
pub(super) const TABLE_ONLY_ATTRS: &[(u32, &str, Kind)] = &[
    (0xB62B, "LeftInset", Kind::Number),
    (0xB62C, "TopInset", Kind::Number),
    (0xB62D, "RightInset", Kind::Number),
    (0xB62E, "BottomInset", Kind::Number),
    (0x10408, "BreakHeaders", Kind::Enum(&[(2, "OncePerPage")])),
];

/// Attributes of table styles that tables do not have: the region cell
/// styles and flags.
pub(super) const TABLE_STYLE_ONLY_ATTRS: &[(u32, &str, Kind)] = &[
    (0x10450, "HeaderRegionCellStyle", Kind::CellStyle),
    (0x10451, "FooterRegionCellStyle", Kind::CellStyle),
    (0x10452, "BodyRegionCellStyle", Kind::CellStyle),
    (0x10453, "LeftColumnRegionCellStyle", Kind::CellStyle),
    (0x10454, "RightColumnRegionCellStyle", Kind::CellStyle),
    (
        0x10457,
        "HeaderRegionSameAsBodyRegion",
        Kind::Enum(&[(0, "false"), (1, "true")]),
    ),
    (
        0x10458,
        "FooterRegionSameAsBodyRegion",
        Kind::Enum(&[(0, "false"), (1, "true")]),
    ),
    (
        0x10459,
        "LeftColumnRegionSameAsBodyRegion",
        Kind::Enum(&[(0, "false"), (1, "true")]),
    ),
    (
        0x1045A,
        "RightColumnRegionSameAsBodyRegion",
        Kind::Enum(&[(0, "false"), (1, "true")]),
    ),
];

/// Table attribute groups whose IDs always have the same value in the
/// samples, so which ID is which attribute is not known: written only
/// when every ID is present with the same value. IDs, IDML attributes,
/// kind, and whether only tables (not table styles) have them.
pub(super) const TABLE_GROUPS: &[(&[u32], &[&str], Kind, bool)] = &[
    (
        &[0xB653, 0xB656, 0xB659, 0xB65C],
        &[
            "TopBorderStrokeWeight",
            "LeftBorderStrokeWeight",
            "BottomBorderStrokeWeight",
            "RightBorderStrokeWeight",
        ],
        Kind::Number,
        false,
    ),
    (
        &[0xB654, 0xB657, 0xB65A, 0xB65D],
        &[
            "TopBorderStrokeColor",
            "LeftBorderStrokeColor",
            "BottomBorderStrokeColor",
            "RightBorderStrokeColor",
        ],
        Kind::Swatch,
        false,
    ),
    (
        &[0xB655, 0xB658, 0xB65B, 0xB65E],
        &[
            "TopBorderStrokeType",
            "LeftBorderStrokeType",
            "BottomBorderStrokeType",
            "RightBorderStrokeType",
        ],
        Kind::StrokeType,
        false,
    ),
    (
        &[0xB6AC, 0xB6AD, 0xB6AE, 0xB6AF],
        &[
            "TopBorderStrokeTint",
            "LeftBorderStrokeTint",
            "BottomBorderStrokeTint",
            "RightBorderStrokeTint",
        ],
        Kind::Number,
        false,
    ),
    (
        &[0x10429, 0x1042A, 0x1042B, 0x1042C],
        &[
            "TopBorderStrokeGapColor",
            "LeftBorderStrokeGapColor",
            "BottomBorderStrokeGapColor",
            "RightBorderStrokeGapColor",
        ],
        Kind::Swatch,
        false,
    ),
    (
        &[0xB68E, 0xB68F],
        &["StartColumnStrokeType", "EndColumnLineStyle"],
        Kind::StrokeType,
        false,
    ),
    (
        &[0x1040A, 0x1040B],
        &["SkipFirstHeader", "SkipLastFooter"],
        Kind::Enum(&[(1, "true")]),
        true,
    ),
];

/// The text cell values of tables, rows, columns and cells: ID, IDML
/// attribute, kind. See `docs/format/tables.md`.
pub(super) const TEXT_CELL_ATTRS: &[(u32, &str, Kind)] = &[
    (0xB62C, "TextTopInset", Kind::Number),
    (0xB62B, "TextLeftInset", Kind::Number),
    (0xB62E, "TextBottomInset", Kind::Number),
    (0xB62D, "TextRightInset", Kind::Number),
    (0xB6DE, "ClipContentToTextCell", Kind::Bool),
];

/// Row group attributes: ID, IDML attribute, kind.
/// See `docs/format/tables.md`.
pub(super) const ROW_ATTRS: &[(u32, &str, Kind)] = &[
    (0xB69F, "AutoGrow", Kind::Bool),
    (
        0x10407,
        "StartRow",
        Kind::Enum(&[(0, "Anywhere"), (2, "NextColumn")]),
    ),
    (0xB6A1, "KeepWithNextRow", Kind::Enum(&[(0, "false")])),
];

/// Caption position of a table style: u16 1 = `BeforeTable`.
pub(super) const TABLE_STYLE_CAPTION_POSITION: u32 = 0x1047D;

/// Paragraph style of a cell style.
pub(super) const CELL_STYLE_PARAGRAPH_STYLE: u32 = 0x10463;

/// Stroke style code of a cell edge that has no stroke type (IDML `n`).
pub(super) const CELL_NO_STROKE_TYPE: u32 = 0x1040C;

/// Records of a `TabList`. `None` for an alignment code without evidence.
/// See `docs/format/attributes.md`.
pub(super) fn tab_list(stops: &[TabStop]) -> Option<Vec<Vec<Field>>> {
    stops
        .iter()
        .map(|t| {
            let alignment = match t.alignment {
                0 => "LeftAlign",
                1 => "CenterAlign",
                2 => "RightAlign",
                3 => "CharacterAlign",
                _ => return None,
            };
            // Only stops aligned on a character store one; IDML writes `.`
            // for the others (attributes.md, tab stops).
            let character = t.character.clone().unwrap_or_else(|| ".".into());
            Some(vec![
                ("Alignment", "enumeration", alignment.to_string()),
                ("AlignmentCharacter", "string", character),
                ("Leader", "string", t.leader.clone()),
                ("Position", "unit", num(t.position)),
            ])
        })
        .collect()
}

/// `BulletChar` attributes. See `docs/format/attributes.md`.
pub(super) fn bullet_char(kind: u32, value: u32) -> Option<PropValue> {
    let kind = match kind {
        0 => "UnicodeOnly",
        1 => "UnicodeWithFont",
        2 => "GlyphWithFont",
        _ => return None,
    };
    Some(PropValue::Attributes(vec![
        ("BulletCharacterType", kind.into()),
        ("BulletCharacterValue", value.to_string()),
    ]))
}

/// `NumberingRestartPolicies` attributes of the two stored word triples
/// seen in the corpus. See `docs/format/attributes.md`.
pub(super) fn restart_policies(words: [u32; 3]) -> Option<PropValue> {
    let (policy, level) = match words {
        [0, 0, 0] => ("AnyPreviousLevel", "0"),
        [1, 1, 1] => ("AfterSpecificLevel", "1"),
        _ => return None,
    };
    Some(PropValue::Attributes(vec![
        ("RestartPolicy", policy.into()),
        ("LowerLevel", level.into()),
        ("UpperLevel", level.into()),
    ]))
}

/// The IDML field of a nested style delimiter.
pub(super) fn delimiter_field(d: &Delimiter) -> Field {
    let enumeration = |v: &str| ("Delimiter", "enumeration", v.to_string());
    match d {
        Delimiter::Dropcap => enumeration("Dropcap"),
        Delimiter::AnyWord => enumeration("AnyWord"),
        Delimiter::AnyCharacter => enumeration("AnyCharacter"),
        Delimiter::Tabs => enumeration("Tabs"),
        Delimiter::EndNestedStyle => enumeration("EndNestedStyle"),
        Delimiter::Digits => enumeration("Digits"),
        Delimiter::Sentence => enumeration("Sentence"),
        Delimiter::Repeat => enumeration("Repeat"),
        Delimiter::Character(c) => ("Delimiter", "string", c.clone()),
    }
}

/// Sets `KerningMethod` in `plain` for a run list with manual kerning; see
/// [`Writer::run_attrs`].
fn manual_kerning(attrs: &Attrs, plain: &mut Vec<(&'static str, String)>) {
    if attrs.get(0x1B07).is_none()
        || attrs.get(0x1B13).and_then(Value::as_f64) == Some(KERNING_NONE)
    {
        return;
    }
    let Some(i) = plain.iter().position(|(n, _)| *n == "KerningValue") else {
        return;
    };
    let method = if plain[i].1 == "0" {
        "$ID/None"
    } else {
        "$ID/Manual"
    };
    match plain.iter_mut().find(|(n, _)| *n == "KerningMethod") {
        Some(m) => m.1 = method.into(),
        None => plain.insert(i, ("KerningMethod", method.into())),
    }
}

impl Writer<'_> {
    /// IDML attributes and properties for a text attribute list.
    pub(super) fn text_attrs(&self, attrs: &Attrs) -> (Vec<(&'static str, String)>, Vec<Property>) {
        self.text_attrs_of(attrs, false)
    }

    /// Like [`Writer::text_attrs`], for the attributes of a story run: a
    /// run that stores both a kerning method and a manual kerning value
    /// has the method `$ID/Manual`, or `$ID/None` for a value of 0,
    /// whatever method is stored (`docs/format/attributes.md`, kerning).
    pub(super) fn run_attrs(&self, attrs: &Attrs) -> (Vec<(&'static str, String)>, Vec<Property>) {
        let (mut plain, props) = self.text_attrs(attrs);
        manual_kerning(attrs, &mut plain);
        (plain, props)
    }

    /// Like [`Writer::text_attrs`]; a character style (`character_style`)
    /// names a composite font by its family name (`docs/format/fonts.md`,
    /// composite fonts as applied fonts).
    pub(super) fn text_attrs_of(
        &self,
        attrs: &Attrs,
        character_style: bool,
    ) -> (Vec<(&'static str, String)>, Vec<Property>) {
        let mut plain = Vec::new();
        let mut props = Vec::new();
        for &(id, name, kind, in_props) in TEXT_ATTRS {
            let kind = match kind {
                Kind::Font if character_style => Kind::FamilyName,
                k => k,
            };
            // IDML has `MergeConsecutiveParaBorders` from version 13.1
            // (attributes.md).
            if id == 0x1DF1F && !self.saved_by((13, 1)) {
                continue;
            }
            let Some(v) = attrs.get(id) else { continue };
            let out = self.value(kind, v);
            if out.is_none() && kind.is_code() {
                attrs.unknown_code(id, v);
            }
            if let Some((ty, value)) = out {
                if in_props {
                    props.push((name, ty, value));
                } else if let PropValue::Text(text) = value {
                    plain.push((name, text));
                }
            }
        }
        for &(ids, names, kind) in TIED_TEXT_ATTRS {
            let Some(v) = attrs.get(ids[0]) else { continue };
            if ids[1..].iter().any(|&id| attrs.get(id) != Some(v)) {
                continue;
            }
            match self.value(kind, v) {
                Some((_, PropValue::Text(text))) => {
                    plain.extend(names.iter().map(|&n| (n, text.clone())));
                }
                Some(_) => {}
                None if kind.is_code() => attrs.unknown_code(ids[0], v),
                None => {}
            }
        }
        for &(ids, names, known) in PAIRED_TEXT_ATTRS {
            let (Some(a), Some(b)) = (attrs.get(ids[0]), attrs.get(ids[1])) else {
                continue;
            };
            let codes = [a.as_u32(), b.as_u32()];
            match known
                .iter()
                .find(|(c, _)| codes == [Some(c[0]), Some(c[1])])
            {
                Some((_, values)) => {
                    plain.push((names[0], values[0].to_string()));
                    plain.push((names[1], values[1].to_string()));
                }
                None => attrs.unknown_code(ids[0], a),
            }
        }
        // An empty font style is written as the style of the list's font
        // family named `Regular`, else of its first font
        // (`docs/format/attributes.md`, empty font styles).
        if let Some(style) = plain
            .iter_mut()
            .find(|(n, v)| *n == "FontStyle" && v.is_empty())
            .map(|(_, v)| v)
            && let Some(f) = attrs
                .get(0x1B2B)
                .and_then(Value::as_u32)
                .and_then(|u| self.doc.fonts.get(&u))
            && let Some(font) = f
                .fonts
                .iter()
                .find(|x| x.style == "Regular")
                .or(f.fonts.first())
        {
            style.clone_from(&font.style);
        }
        (plain, props)
    }

    /// Records of an `AllNestedStyles` list. See `docs/format/attributes.md`.
    pub(super) fn nested_styles(&self, styles: &[NestedStyle]) -> Vec<Vec<Field>> {
        styles
            .iter()
            .map(|n| {
                vec![
                    self.applied_character_style(n.style),
                    delimiter_field(&n.delimiter),
                    ("Repetition", "long", n.repetition.to_string()),
                    ("Inclusive", "boolean", n.inclusive.to_string()),
                ]
            })
            .collect()
    }

    /// Records of an `AllGREPStyles` list. See `docs/format/attributes.md`.
    pub(super) fn grep_styles(&self, styles: &[GrepStyle]) -> Vec<Vec<Field>> {
        styles
            .iter()
            .map(|g| {
                vec![
                    self.applied_character_style(g.style),
                    ("GrepExpression", "string", g.expression.clone()),
                ]
            })
            .collect()
    }

    /// Records of an `AllLineStyles` list. `RepeatLast` is −1 in every
    /// sample and has no stored field (`docs/format/attributes.md`).
    pub(super) fn line_styles(&self, styles: &[LineStyle]) -> Vec<Vec<Field>> {
        styles
            .iter()
            .map(|l| {
                vec![
                    self.applied_character_style(l.style),
                    ("LineCount", "long", l.lines.to_string()),
                    ("RepeatLast", "long", "-1".into()),
                ]
            })
            .collect()
    }

    fn applied_character_style(&self, uid: u32) -> Field {
        (
            "AppliedCharacterStyle",
            "object",
            self.style_ref(Some(uid).filter(|&u| u != 0), false),
        )
    }

    /// Page item attributes from an attribute list, as IDML values.
    pub(super) fn item_attr_values(&self, attrs: &Attrs) -> Vec<(&'static str, String)> {
        self.attr_values(attrs, ITEM_ATTRS)
    }

    /// IDML attributes of the page item defaults list.
    pub(super) fn item_default_values(&self, attrs: &Attrs) -> Vec<(&'static str, String)> {
        let mut out = self.attr_values(attrs, ITEM_ATTRS);
        out.extend(self.attr_values(attrs, ITEM_DEFAULT_ATTRS));
        out
    }

    /// IDML attributes of a table or (`style`) table style attribute
    /// list.
    pub(super) fn table_attrs(&self, attrs: &Attrs, style: bool) -> Vec<(&'static str, String)> {
        let mut out = self.attr_values(attrs, TABLE_ATTRS);
        out.extend(self.attr_values(attrs, GRAPHIC_CELL_ATTRS));
        out.extend(self.attr_values(
            attrs,
            if style {
                TABLE_STYLE_ONLY_ATTRS
            } else {
                TABLE_ONLY_ATTRS
            },
        ));
        for &(ids, names, kind, table_only) in TABLE_GROUPS {
            if style && table_only {
                continue;
            }
            let Some(first) = attrs.get(ids[0]) else {
                continue;
            };
            if !ids[1..].iter().all(|&id| attrs.get(id) == Some(first)) {
                continue;
            }
            match self.value_text(kind, first) {
                Some(t) => out.extend(names.iter().map(|&n| (n, t.clone()))),
                None if kind.is_code() => attrs.unknown_code(ids[0], first),
                None => {}
            }
        }
        out
    }

    /// IDML attributes of a cell attribute set other than its edges.
    /// Some cell attributes are written as two IDML attributes.
    pub(super) fn cell_attrs(&self, attrs: &Attrs) -> Vec<(&'static str, String)> {
        let mut out = Vec::new();
        for &(id, names, kind) in CELL_ATTRS {
            let Some(v) = attrs.get(id) else { continue };
            match self.value_text(kind, v) {
                Some(t) => {
                    for &name in names {
                        // Text cell values exist from DOM 11 (tables.md).
                        if self.doc.version.major >= 11 || !name.starts_with("Text") {
                            out.push((name, t.clone()));
                        }
                    }
                }
                None if kind.is_code() => attrs.unknown_code(id, v),
                None => {}
            }
        }
        out
    }

    /// The edge attributes of a cell. An edge value is written when every
    /// grid position along the edge has it, with the same value; the
    /// priority comes from the cell's own set (tables.md, "Cell edges").
    pub(super) fn cell_edge_attrs(&self, t: &Table, c: &Cell) -> Vec<(&'static str, String)> {
        let edges = t.edge_formats(c);
        let own = t.format(c);
        let spans = [false, c.column_span > 1, false, c.row_span > 1];
        let mut values: Vec<[Option<String>; 4]> = Vec::new();
        for &(ids, _, kind) in CELL_EDGE_ATTRS {
            let mut row: [Option<String>; 4] = Default::default();
            for e in 0..4 {
                let id = ids[e];
                let value = if ids == CELL_EDGE_PRIORITY {
                    let v = own.and_then(|f| f.attrs.get(id));
                    if v.is_none()
                        && spans[e]
                        && edges[e]
                            .iter()
                            .any(|f| f.is_some_and(|f| f.attrs.get(id).is_some()))
                    {
                        row[e] = Some("1".into());
                        continue;
                    }
                    v
                } else {
                    let mut vs = edges[e].iter().map(|f| f.and_then(|f| f.attrs.get(id)));
                    let first = vs.next().flatten();
                    first.filter(|&v| vs.all(|w| w == Some(v)))
                };
                let Some(v) = value else { continue };
                match self.value_text(kind, v) {
                    Some(text) => row[e] = Some(text),
                    None if kind.is_code() => {
                        if let Some(f) = own {
                            f.attrs.unknown_code(id, v);
                        }
                    }
                    None => {}
                }
            }
            values.push(row);
        }
        Self::edge_values(&mut values);
        Self::edge_list(values)
    }

    /// Edge values as IDML attributes, by edge (left, top, right, bottom).
    /// `values` follows `CELL_EDGE_ATTRS`.
    fn edge_list(mut values: Vec<[Option<String>; 4]>) -> Vec<(&'static str, String)> {
        let mut out = Vec::new();
        for e in [0, 2, 1, 3] {
            for (row, &(_, names, _)) in values.iter_mut().zip(CELL_EDGE_ATTRS) {
                if let Some(v) = row[e].take() {
                    out.push((names[e], v));
                }
            }
        }
        out
    }

    /// Edge values of a cell written as IDML writes them: a weight is 0
    /// when the edge's colour is the `None` swatch. `values` follows
    /// `CELL_EDGE_ATTRS` (weights first, colours third).
    fn edge_values(values: &mut [[Option<String>; 4]]) {
        let (weights, rest) = values.split_at_mut(1);
        for (weight, color) in weights[0].iter_mut().zip(&rest[1]) {
            if color.as_deref() == Some("Swatch/None") && weight.is_some() {
                *weight = Some("0".into());
            }
        }
    }

    /// The edge attributes of a cell style: the cell edge IDs, each
    /// written for the rotated style edge (`CELL_STYLE_EDGE`).
    pub(super) fn cell_style_edge_attrs(&self, attrs: &Attrs) -> Vec<(&'static str, String)> {
        let mut values: Vec<[Option<String>; 4]> = Vec::new();
        for &(ids, _, kind) in CELL_EDGE_ATTRS {
            let mut row: [Option<String>; 4] = Default::default();
            // Styles keep their stored tints and weights (tables.md).
            let kind = match kind {
                Kind::EdgeTint => Kind::Number,
                k => k,
            };
            for e in 0..4 {
                let Some(v) = attrs.get(ids[e]) else { continue };
                match self.value_text(kind, v) {
                    Some(text) => row[CELL_STYLE_EDGE[e]] = Some(text),
                    None if kind.is_code() => attrs.unknown_code(ids[e], v),
                    None => {}
                }
            }
            values.push(row);
        }
        Self::edge_list(values)
    }

    /// The gradient attributes of a page item: its own, or, for a group,
    /// the values all its children have. See `docs/format/objects.md`.
    pub(super) fn gradients(item: &PageItem) -> Vec<(&'static str, String)> {
        // A form field has the values of the items it shows, as a group
        // has those of its children (objects.md, form fields).
        let shown: Vec<&PageItem> = match &item.kind {
            ItemKind::Group => item.children.iter().collect(),
            ItemKind::Form(f) if f.kind.has_states() => {
                f.states.iter().flat_map(|s| &s.items).collect()
            }
            ItemKind::Form(_) => item.children.iter().collect(),
            _ => Vec::new(),
        };
        if matches!(item.kind, ItemKind::Group | ItemKind::Form(_)) {
            let kids: Vec<_> = shown.into_iter().map(Self::gradients).collect();
            return GRADIENT_ATTRS
                .iter()
                .filter_map(|&(_, name, _)| {
                    let mut values = kids
                        .iter()
                        .map(|k| k.iter().find(|(n, _)| *n == name).map(|(_, v)| v));
                    let first = values.next()??;
                    values
                        .all(|v| v == Some(first))
                        .then(|| (name, first.clone()))
                })
                .collect();
        }
        Self::gradient_values(&item.attrs)
    }

    /// The gradient attributes of an attribute list, with the defaults
    /// for those it lacks.
    pub(super) fn gradient_values(attrs: &Attrs) -> Vec<(&'static str, String)> {
        GRADIENT_ATTRS
            .iter()
            .map(|&(id, name, default)| {
                let v = match attrs.get(id) {
                    Some(Value::Point(x, y)) => Some(nums(&[*x, *y])),
                    Some(v) => v.as_f64().map(num),
                    None => None,
                };
                (name, v.unwrap_or_else(|| default.to_string()))
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_anchored_object_settings_field_by_field() {
        let mut d = vec![0u8; 62];
        d[0..8].copy_from_slice(&(-3.5f64).to_le_bytes());
        for (o, v) in [
            (40, 1u16),
            (42, 2),
            (44, 6),
            (46, 2),
            (48, 0),
            (50, 1),
            (52, 1),
            (54, 1),
            (56, 0),
        ] {
            d[o..o + 2].copy_from_slice(&v.to_le_bytes());
        }
        let a = crate::model::AnchorSettings::read(crate::object::Encoding::default(), &d);
        let get = |k: &str| {
            anchored_settings(&a)
                .into_iter()
                .find(|(n, _)| *n == k)
                .map(|(_, v)| v)
        };
        assert_eq!(get("AnchoredPosition").as_deref(), Some("Anchored"));
        assert_eq!(
            get("HorizontalReferencePoint").as_deref(),
            Some("PageMargins")
        );
        assert_eq!(get("VerticalReferencePoint").as_deref(), Some("Capheight"));
        assert_eq!(get("AnchorPoint").as_deref(), Some("LeftCenterAnchor"));
        assert_eq!(get("HorizontalAlignment").as_deref(), Some("RightAlign"));
        assert_eq!(get("VerticalAlignment").as_deref(), Some("CenterAlign"));
        assert_eq!(get("SpineRelative").as_deref(), Some("true"));
        assert_eq!(get("PinPosition").as_deref(), Some("false"));
        assert_eq!(get("AnchorYoffset").as_deref(), Some("-3.5"));
        // A short chunk gives the fields it has.
        let short =
            crate::model::AnchorSettings::read(crate::object::Encoding::default(), &d[..44]);
        assert_eq!(anchored_settings(&short).len(), 4);
    }

    #[test]
    fn writes_tab_stops() {
        let stop = |position, alignment, leader: &str| crate::model::attrs::TabStop {
            position,
            alignment,
            character: None,
            leader: leader.into(),
        };
        let stops = tab_list(&[stop(12.0, 0, ""), stop(237.5, 2, ".")]).unwrap();
        assert_eq!(stops[0][0].2, "LeftAlign");
        assert_eq!(stops[0][3].2, "12");
        assert_eq!(stops[1][0].2, "RightAlign");
        assert_eq!(stops[1][2].2, ".");
        assert_eq!(stops[1][3].2, "237.5");
        // Unknown alignment code.
        assert!(tab_list(&[stop(12.0, 4, "")]).is_none());
    }

    #[test]
    fn writes_tied_and_paired_text_attributes() {
        let doc = Document::default();
        let w = Writer::for_test(&doc);
        let list = |values: Vec<(u32, Value)>| {
            let mut a = Attrs::default();
            a.values = values;
            a
        };
        let border = [0x1DF0A, 0x1DF0B, 0x1DF0C, 0x1DF0D];
        let (plain, _) = w.text_attrs(&list(
            border
                .iter()
                .map(|&id| (id, Value::Double(4.5)))
                .chain([(0x1BDD, Value::Enum(3)), (0x1BDE, Value::Enum(2))])
                .collect(),
        ));
        assert!(plain.contains(&("ParagraphBorderBottomRightCornerRadius", "4.5".into())));
        assert!(plain.contains(&("ParagraphShadingTopOrigin", "EmBoxTopOrigin".into())));
        assert!(plain.contains(&("ParagraphShadingBottomOrigin", "EmBoxBottomOrigin".into())));
        // Unequal tied values and unknown pairs are left out.
        let (plain, _) = w.text_attrs(&list(vec![
            (0x1DF13, Value::Double(1.0)),
            (0x1DF15, Value::Double(2.0)),
            (0x1BDD, Value::Enum(0)),
            (0x1BDE, Value::Enum(2)),
        ]));
        assert!(plain.is_empty());
    }

    #[test]
    fn writes_manual_kerning_of_runs() {
        let doc = Document::default();
        let w = Writer::for_test(&doc);
        let run = |kerning: f64| {
            let mut a = Attrs::default();
            a.values = vec![
                (0x1B07, Value::Ref(79875)),
                (0x1B13, Value::Double(kerning)),
            ];
            w.run_attrs(&a).0
        };
        let get = |plain: &[(&str, String)], name: &str| {
            plain
                .iter()
                .find(|(n, _)| *n == name)
                .map(|(_, v)| v.clone())
        };
        let p = run(-0.2318);
        assert_eq!(get(&p, "KerningMethod").as_deref(), Some("$ID/Manual"));
        assert_eq!(get(&p, "KerningValue").as_deref(), Some("-232"));
        let p = run(-7e-18);
        assert_eq!(get(&p, "KerningMethod").as_deref(), Some("$ID/None"));
        assert_eq!(get(&p, "KerningValue").as_deref(), Some("0"));
        // No manual kerning keeps the stored method.
        let p = run(KERNING_NONE);
        assert_eq!(get(&p, "KerningMethod").as_deref(), Some("$ID/Optical"));
        assert_eq!(get(&p, "KerningValue").as_deref(), Some("1e+11"));
        // Styles keep the stored method.
        let mut a = Attrs::default();
        a.values = vec![(0x1B07, Value::Ref(79875)), (0x1B13, Value::Double(0.05))];
        let p = w.text_attrs(&a).0;
        assert_eq!(get(&p, "KerningMethod").as_deref(), Some("$ID/Optical"));
        assert_eq!(get(&p, "KerningValue").as_deref(), Some("50"));
    }

    #[test]
    fn writes_composite_fonts_and_grep_styles() {
        let mut doc = Document::default();
        doc.fonts.insert(
            5,
            crate::model::FontFamily {
                uid: 5,
                name: "<4E2D><6587>".into(),
                builtin: false,
                native_name: String::new(),
                fonts: Vec::new(),
                writing_script: 0,
            },
        );
        doc.composite_fonts.push(crate::model::CompositeFont {
            uid: 9,
            name: crate::model::Name {
                builtin: false,
                name: "\u{4E2D}\u{6587}".into(),
            },
            entries: Vec::new(),
        });
        let w = Writer::for_test(&doc);
        let grep = |items| Value::StyleList {
            count: 1,
            items: Some(crate::model::attrs::StyleItems::Grep(items)),
        };
        let mut a = Attrs::default();
        a.values = vec![
            (0x1B2B, Value::Ref(5)),
            (
                0x1BBA,
                grep(vec![GrepStyle {
                    style: 0,
                    expression: "@|#".into(),
                }]),
            ),
            (
                0x1BBB,
                Value::StyleList {
                    count: 0,
                    items: Some(crate::model::attrs::StyleItems::Line(Vec::new())),
                },
            ),
        ];
        let (_, props) = w.text_attrs(&a);
        let names: Vec<&str> = props.iter().map(|p| p.0).collect();
        // An empty line style list is left out.
        assert_eq!(names, ["AppliedFont", "AllGREPStyles"]);
        assert_eq!(props[0].1, "object");
        assert!(matches!(&props[0].2, PropValue::Text(t) if t == "CompositeFont/\u{4E2D}\u{6587}"));
        let PropValue::List(items) = &props[1].2 else {
            panic!("not a list");
        };
        assert_eq!(items[0][1], ("GrepExpression", "string", "@|#".into()));
        // A character style names the composite font by its family name.
        let (_, props) = w.text_attrs_of(&a, true);
        assert_eq!(props[0].1, "string");
    }

    #[test]
    fn names_the_neutral_language_without_id_prefix() {
        let mut doc = Document::default();
        doc.languages.insert(3, "Neutral".into());
        doc.languages.insert(4, "English: USA".into());
        let w = Writer::for_test(&doc);
        let lang = |u| w.value_text(Kind::Language, &Value::Ref(u));
        assert_eq!(lang(3).as_deref(), Some("[No Language]"));
        assert_eq!(lang(4).as_deref(), Some("$ID/English: USA"));
    }

    #[test]
    fn writes_ruby_and_warichu_attributes() {
        let doc = Document::default();
        let w = Writer::for_test(&doc);
        let mut a = Attrs::default();
        a.values = vec![
            (0x423B, Value::Enum(0)),
            (0x4281, Value::Enum(7)),
            (0x427F, Value::Double(0.5)),
            (0x4231, Value::Enum(3)),
            (0x4234, Value::String(String::new())),
            (0x424B, Value::String("Regular".into())),
        ];
        let (plain, props) = w.text_attrs(&a);
        assert!(plain.contains(&("RubyAutoAlign", "false".into())));
        assert!(plain.contains(&("WarichuAlignment", "Auto".into())));
        assert!(plain.contains(&("WarichuSize", "50".into())));
        // Code 3 of `RubyAlignment` has no IDML value.
        assert!(!plain.iter().any(|(k, _)| *k == "RubyAlignment"));
        // An empty font style is `Nothing`; another is left out.
        let names: Vec<&str> = props.iter().map(|p| p.0).collect();
        assert_eq!(names, ["RubyFontStyle"]);
        assert!(matches!(&props[0].2, PropValue::Text(t) if t == "Nothing"));
    }

    #[test]
    fn writes_attributes_placed_by_order() {
        // A style list: u32 ID, u16 size, then u16 value count, u32 type,
        // u16 length and the value.
        let words: Vec<u8> = [1u32; 3].iter().flat_map(|w| w.to_le_bytes()).collect();
        let mut d = 7u16.to_le_bytes().to_vec();
        for (id, ty, value) in [
            (0x4241u32, 0x1BB1u32, (-1f64).to_le_bytes().to_vec()),
            (0x4242, 0x1BBB, 0xFFFFu16.to_le_bytes().to_vec()),
            (0x1B49, 0x1B22, [0u8; 16].to_vec()),
            (0x1B7B, 0x1B05, 0u32.to_le_bytes().to_vec()),
            (0x50F40, 0x50F2E, 1u32.to_le_bytes().to_vec()),
            (0x1A41E, 0x1A4A6, words),
            // An empty list of nested styles.
            (0x1B75, 0x1B75, 0u32.to_le_bytes().to_vec()),
        ] {
            d.extend(id.to_le_bytes());
            d.extend((8 + value.len() as u16).to_le_bytes());
            d.extend(1u16.to_le_bytes());
            d.extend(ty.to_le_bytes());
            d.extend((value.len() as u16).to_le_bytes());
            d.extend(value);
        }
        let mut c = crate::object::Encoding::default().cursor(&d);
        let n = c.u16().unwrap() as usize;
        let a = Attrs::parse_text(&mut c, n, crate::audit::List::Style, None).unwrap();
        let doc = Document::default();
        let w = Writer::for_test(&doc);
        let (plain, props) = w.text_attrs(&a);
        assert!(plain.contains(&("RubyTint", "-1".into())));
        assert!(plain.contains(&("RubyOverprintFill", "Auto".into())));
        assert!(plain.contains(&("GradientStrokeStart", "0 0".into())));
        assert!(plain.contains(&("KeyboardDirection", "LeftToRightDirection".into())));
        let names: Vec<&str> = props.iter().map(|p| p.0).collect();
        assert_eq!(names, ["RuleBelowGapColor", "NumberingRestartPolicies"]);
        assert_eq!(props[0].1, "string");
        assert!(matches!(&props[0].2, PropValue::Text(t) if t == "Text Color"));
        assert!(matches!(&props[1].2, PropValue::Attributes(a)
            if a[0] == ("RestartPolicy", "AfterSpecificLevel".into()) && a[2].1 == "1"));
    }

    #[test]
    fn writes_one_alternate_glyph_feature() {
        let doc = Document::default();
        let w = Writer::for_test(&doc);
        let mut a = Attrs::default();
        a.values = vec![(0x42AE, Value::Features(vec![("nalt".into(), 8)]))];
        let (_, props) = w.text_attrs(&a);
        assert_eq!(props.len(), 1);
        assert_eq!((props[0].0, props[0].1), ("OpenTypeFeatures", "list"));
        let PropValue::Lists(lists) = &props[0].2 else {
            panic!("not a list of lists");
        };
        assert_eq!(
            lists,
            &[vec![("string", "$ID/nalt".into()), ("long", "8".into())]]
        );
        // An empty list (as styles store) and several features are left out.
        for f in [vec![], vec![("aalt".into(), 1), ("ss01".into(), 1)]] {
            a.values = vec![(0x42AE, Value::Features(f))];
            assert!(w.text_attrs(&a).1.is_empty());
        }
    }

    #[test]
    fn writes_cell_edges_along_the_edge() {
        use crate::model::table::{Cell, CellFormat, CellKind, Row, Table};
        let mut doc = Document::default();
        doc.swatches.insert(9, "Swatch/None".into());
        doc.swatches.insert(10, "Color/u10".into());
        let w = Writer::for_test(&doc);
        let format = |values: Vec<(u32, Value)>| {
            let mut attrs = Attrs::default();
            attrs.values = values;
            CellFormat {
                attrs,
                style_priority: 0,
                style: 0,
            }
        };
        // A cell spanning two columns. Both positions have a top weight
        // of 2 with the None colour and the same bottom colour; its own
        // set has a left tint of -1 and a priority on the left only; the
        // covered position has a right colour and priority.
        let formats = vec![
            format(vec![
                (0xB647, Value::Double(2.0)),
                (0xB64A, Value::Ref(9)),
                (0xB6A8, Value::Double(-1.0)),
                (0xB6F9, Value::Int(3)),
                (0xB64C, Value::Ref(10)),
            ]),
            format(vec![
                (0xB647, Value::Double(2.0)),
                (0xB64A, Value::Ref(9)),
                (0xB64B, Value::Ref(10)),
                (0xB6FA, Value::Int(5)),
                (0xB64C, Value::Ref(10)),
            ]),
        ];
        let cell = Cell {
            id: 1,
            row: 0,
            column: 0,
            row_span: 1,
            column_span: 2,
            kind: CellKind::Text,
            width: None,
            runs: Vec::new(),
            items: Vec::new(),
            format: Some(0),
        };
        let t = Table {
            uid: 1,
            style: None,
            attrs: Attrs::default(),
            right_to_left: false,
            header_rows: 0,
            footer_rows: 0,
            rows: vec![Row {
                height: None,
                min_height: None,
                attrs: Attrs::default(),
            }],
            columns: vec![10.0, 10.0],
            cells: vec![cell.clone()],
            formats,
            grid: vec![vec![Some(0), Some(1)]],
        };
        let mut got = w.cell_edge_attrs(&t, &cell);
        got.sort();
        let want: Vec<(&str, String)> = vec![
            ("BottomEdgeStrokeColor", "Color/u10".into()),
            ("LeftEdgeStrokeTint", "100".into()),
            ("LeftEdgeStrokePriority", "3".into()),
            ("RightEdgeStrokeColor", "Color/u10".into()),
            ("RightEdgeStrokePriority", "1".into()),
            ("TopEdgeStrokeColor", "Swatch/None".into()),
            ("TopEdgeStrokeWeight", "0".into()),
        ];
        let mut want = want;
        want.sort();
        assert_eq!(got, want);
    }

    #[test]
    fn writes_bullet_char() {
        let Some(PropValue::Attributes(a)) = bullet_char(0, 0x2022) else {
            panic!("not written");
        };
        assert_eq!(a[0].1, "UnicodeOnly");
        assert_eq!(a[1].1, "8226");
        assert!(bullet_char(3, 0x2022).is_none());
    }
}
