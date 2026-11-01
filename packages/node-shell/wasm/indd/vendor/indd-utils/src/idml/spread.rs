//! Spreads and master spreads: pages, guides, page items with their paths,
//! frame settings, text wrap and fitting, and placed graphics.
//!
//! Evidence: `docs/format/objects.md`, `attributes.md` and
//! `transparency.md`.

use super::*;

/// The top-left corner of a spread's pages in spread coordinates: the
/// smallest left and top edge of any page (0, 0 without pages).
pub(super) fn spread_origin(pages: &[Page]) -> (f64, f64) {
    let corners = pages.iter().map(|p| {
        let [a, b, c, d, tx, ty] = p.transform.0;
        let (l, t) = (p.bounds[0], p.bounds[1]);
        (a * l + c * t + tx, b * l + d * t + ty)
    });
    corners
        .reduce(|(l0, t0), (l1, t1)| (l0.min(l1), t0.min(t1)))
        .unwrap_or((0.0, 0.0))
}

/// The bounding box of a spread's pages (min x, min y, max x, max y), from
/// the corners of each page through its transform.
fn pages_extent(pages: &[Page]) -> Option<[f64; 4]> {
    pages
        .iter()
        .flat_map(|p| {
            let [a, b, c, d, tx, ty] = p.transform.0;
            let [l, t, r, bo] = p.bounds;
            [(l, t), (r, t), (l, bo), (r, bo)]
                .map(|(x, y)| (a * x + c * y + tx, b * x + d * y + ty))
        })
        .fold(None, |acc: Option<[f64; 4]>, (x, y)| {
            Some(match acc {
                None => [x, y, x, y],
                Some([x0, y0, x1, y1]) => [x0.min(x), y0.min(y), x1.max(x), y1.max(y)],
            })
        })
}

/// The IDML element of a form field kind.
fn form_tag(kind: FormKind) -> &'static str {
    match kind {
        FormKind::Button => "Button",
        FormKind::CheckBox => "CheckBox",
        FormKind::RadioButton => "RadioButton",
        FormKind::TextBox => "TextBox",
        FormKind::ComboBox => "ComboBox",
        FormKind::SignatureField => "SignatureField",
        FormKind::MultiState => "MultiStateObject",
    }
}

/// `Statetype` of a button, check box or radio button state, by state ID
/// (objects.md, form fields).
fn state_type(id: u32) -> Option<&'static str> {
    Some(match id {
        0 => "Up",
        1 => "Rollover",
        2 => "Down",
        3 => "UpOn",
        4 => "UpOff",
        6 => "RolloverOff",
        7 => "DownOn",
        8 => "DownOff",
        _ => return None,
    })
}

/// Page item attributes that IDML writes only when they differ from the
/// applied object style (attributes.md, page item attributes).
const STYLE_COMPARED: &[&str] = &[
    "FillColor",
    "FillTint",
    "StrokeColor",
    "StrokeWeight",
    "MiterLimit",
    "CornerOption",
    "CornerRadius",
    "TopLeftCornerRadius",
    "TopRightCornerRadius",
    "BottomLeftCornerRadius",
    "BottomRightCornerRadius",
    "TopLeftCornerOption",
    "TopRightCornerOption",
    "BottomLeftCornerOption",
    "BottomRightCornerOption",
    "StrokeType",
    "StrokeAlignment",
    "StrokeTint",
    "StrokeDashAndGap",
    "StrokeCornerAdjustment",
    "GapColor",
    "GapTint",
    "EndCap",
    "EndJoin",
    "LeftLineEnd",
    "RightLineEnd",
    "ArrowHeadAlignment",
];

/// An overprint attribute with the IDs of its colour, the IDML name of
/// the colour, the IDs of the tint and its name, and the ID of the flag.
type Overprint = (&'static str, u32, &'static str, u32, &'static str, u32);

/// The overprint attributes of page items (objects.md, page item
/// overprint).
const OVERPRINT: [Overprint; 2] = [
    (
        "OverprintFill",
        0x6E68,
        "FillColor",
        0x6E69,
        "FillTint",
        0x6E6A,
    ),
    (
        "OverprintStroke",
        0x6E64,
        "StrokeColor",
        0x6E66,
        "StrokeTint",
        0x6E67,
    ),
];

/// Whether an object style whose category list is `on` turns off the
/// category of a fill, stroke or corner attribute: `EnableFill` (0x1B933)
/// for the fill, `EnableStroke` (0x1B934) for the stroke colour,
/// `EnableStrokeAndCornerOptions` (0x1B935 and 0x1B936) for the other
/// stroke and corner attributes, both for the stroke type, tint and gap
/// (attributes.md, values an item does not store).
fn category_off(name: &str, on: &[u32]) -> bool {
    let off = |id: u32| !on.contains(&id);
    let corners = off(0x1B935) && off(0x1B936);
    match name {
        "FillColor" | "FillTint" | "OverprintFill" => off(0x1B933),
        "StrokeColor" | "OverprintStroke" => off(0x1B934),
        "StrokeType" | "StrokeTint" | "GapColor" | "GapTint" => off(0x1B934) && corners,
        _ => corners,
    }
}

/// Whether the item stores a tint (`FillTint`, `StrokeTint`, `GapTint`)
/// of 100. IDML writes it as −1, but it differs from a style value of −1
/// (attributes.md, strokes).
fn full_tint(item: &PageItem, name: &str) -> bool {
    let id = match name {
        "FillTint" => 0x6E69,
        "StrokeTint" => 0x6E66,
        "GapTint" => 0x6E8A,
        _ => return false,
    };
    item.attrs.get(id).and_then(Value::as_f64) == Some(100.0)
}

/// The category of a `TextFramePreference` attribute: the ID that turns
/// it on in an object style's category list (objects.md, text frame
/// preferences).
fn frame_category(name: &str) -> Option<u32> {
    Some(match name {
        "TextColumnCount"
        | "TextColumnGutter"
        | "TextColumnFixedWidth"
        | "UseFixedColumnWidth"
        | "UseFlexibleColumnWidth"
        | "TextColumnMaxWidth"
        | "VerticalJustification"
        | "VerticalThreshold"
        | "IgnoreWrap"
        | "VerticalBalanceColumns" => 0x1B93E,
        "FirstBaselineOffset" | "MinimumFirstBaselineOffset" => 0xADC8,
        n if n.starts_with("Footnotes") => 0xADCA,
        n if n.starts_with("ColumnRule") => 0xADCB,
        n if n.contains("AutoSizing") => 0xADC9,
        _ => return None,
    })
}

/// `TextFramePreference` attributes that IDML writes on every frame of
/// the version, whatever the object style (objects.md, text frame
/// preferences). `InsetSpacing` (DOM 11 on) is written separately.
fn frame_always(name: &str, major: u32) -> bool {
    match name {
        "TextColumnMaxWidth" => major >= 8,
        "TextColumnCount" => major >= 10,
        _ => false,
    }
}

/// Whether `paths` is a plain rectangle: one path of exactly four
/// straight points joined by horizontal and vertical sides in the frame's
/// inner coordinates (objects.md, text frame preferences).
fn plain_rectangle(paths: &[Path]) -> bool {
    let [path] = paths else {
        return false;
    };
    // The coordinates of one side can differ in the last digit.
    let eq = |a: f64, b: f64| (a - b).abs() <= 1e-4;
    let pts = &path.points;
    pts.len() == 4
        && pts
            .iter()
            .all(|p| p.left == p.anchor && p.right == p.anchor)
        && (0..4).all(|i| {
            let (a, b) = (pts[i].anchor, pts[(i + 1) % 4].anchor);
            eq(a.0, b.0) || eq(a.1, b.1)
        })
}

/// `AutoSizingReferencePoint` codes of frames and object styles.
pub(super) const POINTS: [&str; 9] = [
    "TopLeftPoint",
    "TopCenterPoint",
    "TopRightPoint",
    "LeftCenterPoint",
    "CenterPoint",
    "RightCenterPoint",
    "BottomLeftPoint",
    "BottomCenterPoint",
    "BottomRightPoint",
];
/// `PageTransitionType` codes of spreads (objects.md, spreads).
const TRANSITION_TYPES: [(u32, &str); 6] = [
    (0, "None"),
    (0x205C8, "BlindsTransition"),
    (0x205CA, "CombTransition"),
    (0x205CC, "DissolveTransition"),
    (0x205CF, "PushTransition"),
    (0x205D0, "SplitTransition"),
];
/// `PageTransitionDirection` codes of spreads.
const TRANSITION_DIRECTIONS: [(u32, &str); 4] = [
    (0, "NotApplicable"),
    (1, "Down"),
    (0xB, "Horizontal"),
    (0xD, "HorizontalIn"),
];
/// `BaselineFrameGridRelativeOption` codes (objects.md, baseline frame
/// grid of text frames).
pub(super) const BASELINE_RELATIVE: [Option<&str>; 4] = [
    Some("TopOfPage"),
    Some("TopOfMargin"),
    Some("TopOfFrame"),
    Some("TopOfInset"),
];
/// `VerticalJustification` codes.
pub(super) const JUSTIFY: [&str; 4] = ["TopAlign", "CenterAlign", "BottomAlign", "JustifyAlign"];
/// `FirstBaselineOffset` codes (objects.md, text frame preferences).
pub(super) const FIRST_BASELINE: [&str; 5] = [
    "LeadingOffset",
    "AscentOffset",
    "CapHeight",
    "EmboxHeight",
    "XHeight",
];
/// `AutoSizingType` codes.
pub(super) const SIZING: [&str; 5] = [
    "Off",
    "HeightOnly",
    "WidthOnly",
    "HeightAndWidth",
    "HeightAndWidthProportionally",
];

impl Writer<'_> {
    /// A `TextPath` (`docs/format/objects.md`, text on a path).
    fn text_path(&self, x: &mut Xml, t: &crate::model::TextPath) {
        x.start("TextPath")
            .attr("Self", uref(Some(t.uid)))
            .attr("ParentStory", uref(t.story));
        if t.default_codes {
            x.attr("PathAlignment", "CenterPathAlignment")
                .attr("TextAlignment", "BaselineTextAlignment")
                .attr("PathEffect", "RainbowPathEffect");
        }
        x.attr(
            "FlipPathEffect",
            if t.flipped { "Flipped" } else { "NotFlipped" },
        );
        if t.default_codes {
            x.attr("PathSpacing", "0");
        }
        x.attr("StartBracket", num(t.start))
            .attr("EndBracket", num(t.end))
            .attr("PreviousTextFrame", uref(t.previous))
            .attr("NextTextFrame", uref(t.next));
        x.end();
    }

    /// The `Properties` of EPS text: `PathBoundingBox`, `EPSTextData` and
    /// `EPSTextAttributeBounds` (`docs/format/objects.md`, EPS text).
    fn eps_text_properties(x: &mut Xml, e: &crate::model::EpsText) {
        let [left, top, right, bottom] = e.path_bounds;
        x.start("Properties");
        x.empty(
            "PathBoundingBox",
            &[
                ("Left", num(left)),
                ("Top", num(top)),
                ("Right", num(right)),
                ("Bottom", num(bottom)),
            ],
        );
        x.start("EPSTextData")
            .cdata(&base64_lines(&e.data), CDATA_SECTION)
            .end();
        let [left, top, right, bottom] = e.attr_bounds;
        x.empty(
            "EPSTextAttributeBounds",
            &[
                ("Top", num(top)),
                ("Left", num(left)),
                ("Bottom", num(bottom)),
                ("Right", num(right)),
            ],
        );
        x.end();
    }

    /// A `Label` element with one `KeyValuePair` per pair; nothing
    /// without pairs.
    pub(super) fn label(x: &mut Xml, label: &[(String, String)]) {
        if label.is_empty() {
            return;
        }
        x.start("Label");
        for (k, v) in label {
            x.empty("KeyValuePair", &[("Key", k.clone()), ("Value", v.clone())]);
        }
        x.end();
    }

    /// The `PathGeometry` element of `paths`, without `Properties`.
    pub(super) fn path_geometry_element(x: &mut Xml, paths: &[Path]) {
        Self::geometry_paths(x, "PathGeometry", paths);
    }

    /// Element `tag` with one `GeometryPathType` per path.
    pub(super) fn geometry_paths(x: &mut Xml, tag: &str, paths: &[Path]) {
        x.start(tag);
        for p in paths {
            x.start("GeometryPathType")
                .attr("PathOpen", p.open.to_string());
            x.start("PathPointArray");
            for pt in &p.points {
                x.empty(
                    "PathPointType",
                    &[
                        ("Anchor", nums(&[pt.anchor.0, pt.anchor.1])),
                        ("LeftDirection", nums(&[pt.left.0, pt.left.1])),
                        ("RightDirection", nums(&[pt.right.0, pt.right.1])),
                    ],
                );
            }
            x.end().end();
        }
        x.end();
    }

    /// `TextFramePreference` of a text frame. IDML writes an attribute
    /// only when its category is off in the frame's object style or its
    /// value differs from the style's, apart from a few attributes it
    /// always writes (objects.md, text frame preferences). `style` is the
    /// applied style's values; without a style every value is written.
    /// `plain` is whether the frame is a plain rectangle without a corner
    /// option.
    pub(super) fn text_frame_preference(
        &self,
        x: &mut Xml,
        p: &TextFramePreferences,
        style: Option<&applied::StyleValues>,
        plain: bool,
    ) {
        let v = self.doc.version;
        let major = v.major;
        let swatch = |u: u32| match u {
            0 => Some("n".to_string()),
            u => self.doc.swatches.get(&u).cloned(),
        };
        let mut attrs: Vec<(&str, String)> = vec![
            ("TextColumnCount", p.column_count.to_string()),
            ("TextColumnGutter", num(p.column_gutter)),
            ("TextColumnFixedWidth", num(p.column_fixed_width)),
        ];
        if let Some(v) = FIRST_BASELINE.get(p.first_baseline_offset as usize) {
            attrs.push(("FirstBaselineOffset", v.to_string()));
        }
        if let Some(v) = JUSTIFY.get(p.vertical_justification as usize) {
            attrs.push(("VerticalJustification", v.to_string()));
        }
        attrs.push((
            "VerticalBalanceColumns",
            p.vertical_balance_columns.to_string(),
        ));
        if let Some(v) = p.auto_sizing_type.and_then(|c| SIZING.get(c as usize)) {
            attrs.push(("AutoSizingType", v.to_string()));
        }
        if let Some(v) = p
            .auto_sizing_reference_point
            .and_then(|c| POINTS.get(c as usize))
        {
            attrs.push(("AutoSizingReferencePoint", v.to_string()));
        }
        if let Some(w) = p.max_width {
            attrs.push(("TextColumnMaxWidth", num(w)));
        }
        attrs.push(("UseFixedColumnWidth", p.use_fixed_width.to_string()));
        if let Some(([use_height, use_width], [height, width], no_breaks)) = p.minimum_sizes {
            attrs.push(("UseMinimumHeightForAutoSizing", use_height.to_string()));
            attrs.push(("MinimumHeightForAutoSizing", num(height)));
            attrs.push(("UseMinimumWidthForAutoSizing", use_width.to_string()));
            attrs.push(("MinimumWidthForAutoSizing", num(width)));
            attrs.push(("UseNoLineBreaksForAutoSizing", no_breaks.to_string()));
        }
        // Without the chunk, `false` (objects.md, text frame preferences).
        attrs.push(("IgnoreWrap", p.ignore_wrap.unwrap_or(false).to_string()));
        // 0 on every frame of the samples; IDML writes it by the baseline
        // category rule below (objects.md, text frame preferences).
        attrs.push(("MinimumFirstBaselineOffset", "0".into()));
        // Values every IDML of the version has where it writes them; they
        // also say from which version the column rule and footnote
        // settings exist (idml-values.md). Footnote values from 13.1.
        let written = values::when_written("TextFrame/TextFramePreference", major);
        let has = |k: &str| written.iter().any(|(n, _)| n == k);
        let footnotes = self.saved_by((13, 1));
        if has("ColumnRuleOffset") {
            let (width, color) = match p.column_rule {
                Some((w, c)) => (w, swatch(c)),
                // Without the chunk (objects.md).
                None => (1.0, Some("Color/Black".to_string())),
            };
            attrs.push(("ColumnRuleStrokeWidth", num(width)));
            if let Some(c) = color {
                attrs.push(("ColumnRuleStrokeColor", c));
            }
            attrs.push((
                "ColumnRuleOverride",
                (p.column_rule_override == Some(true)).to_string(),
            ));
        }
        if has("FootnotesEnableOverrides") && footnotes {
            let [spacing, between] = p.footnotes.unwrap_or([12.0, 6.0]);
            attrs.push(("FootnotesSpanAcrossColumns", p.footnote_span.to_string()));
            attrs.push(("FootnotesMinimumSpacing", num(spacing)));
            attrs.push(("FootnotesSpaceBetween", num(between)));
        }
        for (k, val) in written.iter() {
            if !footnotes && k.starts_with("Footnotes") {
                continue;
            }
            if !attrs.iter().any(|(n, _)| n == k) {
                attrs.push((k.as_str(), val.clone()));
            }
        }
        if let Some(s) = style {
            attrs.retain(|(k, val)| {
                frame_always(k, major)
                    || !s
                        .enabled
                        .as_ref()
                        .is_some_and(|on| frame_category(k).is_some_and(|c| on.contains(&c)))
                    || !s.frame(k).is_some_and(|sv| applied::same_value(sv, val))
            });
        }
        // A category is off when the applied style's list lacks its ID, or
        // the frame has no style (objects.md, text frame preferences).
        let off =
            |id: u32| style.is_none_or(|s| !s.enabled.as_ref().is_some_and(|on| on.contains(&id)));
        let footnote_options = self.frame_footnote_options(p, style, off(0xADCA));
        let baseline = self.frame_baseline_grid(p, style, off(0xADC8));
        // Before DOM 11 a frame that is not a plain rectangle always has
        // insets; those of a plain rectangle follow the rule of the general
        // attributes: written where they differ from the style's, in any
        // order, or the style turns the category off (objects.md, text
        // frame preferences).
        let sorted = |mut v: [f64; 4]| {
            v.sort_by(f64::total_cmp);
            v
        };
        let insets = major >= 11
            || !plain
            || off(0x1B93E)
            || style.is_some_and(|s| sorted(s.insets.unwrap_or([0.0; 4])) != sorted(p.inset));
        // Before DOM 11 IDML gives a frame without values no element.
        if !attrs.is_empty() || insets {
            x.start("TextFramePreference");
            for (k, val) in attrs {
                x.attr(k, val);
            }
            if insets {
                let [top, left, bottom, right] = p.inset;
                let item = |tag: &str, v: f64| Node {
                    tag: tag.into(),
                    attrs: vec![("type".into(), "unit".into())],
                    text: Some(num(v)),
                    children: Vec::new(),
                };
                // A frame that is not a plain rectangle has one number,
                // whatever its four insets (objects.md, text frame
                // preferences).
                let node = if !plain {
                    item("InsetSpacing", p.inset_single)
                } else {
                    Node {
                        tag: "InsetSpacing".into(),
                        attrs: vec![("type".into(), "list".into())],
                        text: None,
                        children: [top, left, bottom, right]
                            .map(|v| item("ListItem", v))
                            .into(),
                    }
                };
                Self::properties_with(x, &[], &[node]);
            }
            x.end();
        }
        if let Some(n) = baseline {
            n.write(x);
        }
        if let Some(o) = footnote_options {
            x.empty("TextFrameFootnoteOptionsObject", &o);
        }
    }

    /// `TextFrameFootnoteOptionsObject` of a text frame: from DOM 12, when
    /// the footnote category is off or the frame's footnote values differ
    /// from its style's (footnotes.md, text frame footnote options).
    fn frame_footnote_options(
        &self,
        p: &TextFramePreferences,
        style: Option<&applied::StyleValues>,
        off: bool,
    ) -> Option<[(&'static str, String); 4]> {
        if self.doc.version.major < 12 {
            return None;
        }
        // Without chunk 0x22608 the values are false, 12 and 6.
        let [min, between] = p.footnotes.unwrap_or([12.0, 6.0]);
        let (span, smin, sbetween) = style.and_then(|s| s.footnote).unwrap_or((false, 12.0, 6.0));
        let differ = p.footnote_span != span
            || !applied::same_value(&num(min), &num(smin))
            || !applied::same_value(&num(between), &num(sbetween));
        (off || differ).then(|| {
            [
                ("EnableOverrides", "false".to_string()),
                ("SpanFootnotesAcross", p.footnote_span.to_string()),
                ("MinimumSpacingOption", num(min)),
                ("SpaceBetweenFootnotes", num(between)),
            ]
        })
    }

    /// `BaselineFrameGridOption` of a text frame: every value when the
    /// baseline category is off, else the values that differ from the
    /// style's; `None` when there is nothing to write (objects.md,
    /// baseline frame grid of text frames).
    fn frame_baseline_grid(
        &self,
        p: &TextFramePreferences,
        style: Option<&applied::StyleValues>,
        all: bool,
    ) -> Option<Node> {
        use crate::model::BaselineGrid;
        let g = p.baseline_grid.unwrap_or(BaselineGrid::DEFAULT);
        let sg = style
            .and_then(|s| s.baseline)
            .unwrap_or(BaselineGrid::DEFAULT);
        let mut n = Node {
            tag: "BaselineFrameGridOption".into(),
            ..Node::default()
        };
        let mut push = |differs: bool, k: &str, v: String| {
            if all || differs {
                n.attrs.push((k.into(), v));
            }
        };
        push(
            g.use_custom != sg.use_custom,
            "UseCustomBaselineFrameGrid",
            g.use_custom.to_string(),
        );
        push(
            !applied::same_value(&num(g.start), &num(sg.start)),
            "StartingOffsetForBaselineFrameGrid",
            num(g.start),
        );
        if let Some(r) = BASELINE_RELATIVE
            .get(g.relative as usize)
            .copied()
            .flatten()
        {
            push(
                g.relative != sg.relative,
                "BaselineFrameGridRelativeOption",
                r.to_string(),
            );
        }
        push(
            !applied::same_value(&num(g.increment), &num(sg.increment)),
            "BaselineFrameGridIncrement",
            num(g.increment),
        );
        if all || g.color != sg.color {
            let color = if g.color == 0 {
                self.doc
                    .prefs
                    .baseline_frame_grid_color
                    .and_then(frame_grid_color)
            } else {
                p.baseline_rgb
                    .and_then(|rgb| ui_color_property("BaselineFrameGridColor", rgb))
            };
            if let Some(c) = color {
                set_property(&mut n, c);
            }
        }
        (!n.attrs.is_empty() || !n.children.is_empty()).then_some(n)
    }

    /// `TextWrapPreference` from an item's text wrap chunk and contour. An
    /// item without the chunk has no wrap. Values not identified yet are
    /// left out: the whole element for an unknown mode, and the side and
    /// inverse settings for flags other than 1.
    pub(super) fn text_wrap_preference(
        x: &mut Xml,
        wrap: Option<&TextWrap>,
        contour: Option<ContourOption>,
    ) {
        let Some(mode) = text_wrap_mode(wrap) else {
            return;
        };
        x.start("TextWrapPreference");
        // `Inverse` is false on every item of the samples
        // (objects.md, text wrap).
        x.attr("Inverse", "false");
        match wrap {
            None => {
                x.attr("ApplyToMasterPageOnly", "false")
                    .attr("TextWrapSide", "BothSides");
            }
            Some(w) => {
                x.attr("ApplyToMasterPageOnly", (w.master_flag == 0).to_string());
                if let Some(side) = text_wrap_side(w.side) {
                    x.attr("TextWrapSide", side);
                }
            }
        }
        x.attr("TextWrapMode", mode);
        x.start("Properties");
        // IDML has the wrap path only when it is custom (objects.md, text
        // wrap); the schema puts it before `TextWrapOffset`.
        if let Some(w) = wrap
            && w.mode != wrap_mode::NONE
            && !w.custom_path.is_empty()
        {
            Self::path_geometry_element(x, &w.custom_path);
        }
        x.empty("TextWrapOffset", &text_wrap_offsets(wrap));
        x.end();
        if let Some(o) = contour {
            // A type code without a sample leaves the contour out.
            let typed = o
                .contour
                .map(|c| contour_type(c.kind).map(|t| (t, c.inside_edges)));
            if typed != Some(None) {
                x.start("ContourOption");
                if let Some(Some((t, inside))) = typed {
                    x.attr("ContourType", t);
                    if let Some(inside) = inside {
                        x.attr("IncludeInsideEdges", inside.to_string());
                    }
                }
                x.attr("ContourPathName", &o.path_name);
                if o.params && o.contour.is_some() {
                    for (k, v) in CONTOUR_PARAMS {
                        x.attr(k, v);
                    }
                }
                x.end();
            }
        }
        x.end();
    }

    /// The name, visibility, lock and the other settings every page item
    /// has; `nested` for an item inside another page item, which IDML
    /// writes without `Locked`. See `docs/format/objects.md`.
    pub(super) fn item_settings(&self, x: &mut Xml, item: &PageItem, nested: bool) {
        let locked = (!nested).then_some(item.props.locked);
        self.settings(x, &item.props, locked);
        for (name, v) in Self::gradients(item) {
            if !x.has_attr(name) {
                x.attr(name, v);
            }
        }
    }

    /// The settings of `ItemProps` (page items and placed graphics):
    /// `Locked` only when `locked` is given. See `docs/format/objects.md`,
    /// page item settings.
    pub(super) fn settings(&self, x: &mut Xml, p: &ItemProps, locked: Option<bool>) {
        let name = match &p.name {
            Some(n) if n.builtin => builtin_key(&n.name),
            Some(n) => n.name.clone(),
            None => "$ID/".into(),
        };
        x.attr("Name", name)
            .attr("Visible", (!p.hidden).to_string());
        if let Some(l) = locked {
            x.attr("Locked", l.to_string());
        }
        if let Some(a) = p.allow_overrides {
            x.attr("AllowOverrides", a.to_string());
        }
        if self.doc.version.major >= 8 {
            for (name, counts) in [
                "ParentInterfaceChangeCount",
                "TargetInterfaceChangeCount",
                "LastUpdatedInterfaceChangeCount",
            ]
            .into_iter()
            .zip(&p.change_counts)
            {
                x.attr(name, join_numbers(counts));
            }
            let overridden = match &p.overridden {
                Some((master, ids)) if *master != 0 => join_numbers(ids),
                _ => String::new(),
            };
            x.attr("OverriddenPageItemProps", overridden);
            if let Some((h, v)) = layout_constraints(p.layout_constraints.unwrap_or(0x22)) {
                x.attr("HorizontalLayoutConstraints", h)
                    .attr("VerticalLayoutConstraints", v);
            }
        }
    }

    /// The `AppliedObjectStyle` reference of an object style UID.
    pub(super) fn object_style_ref(&self, uid: u32) -> Option<String> {
        let os = self.doc.object_styles.get(&uid)?;
        let name = self.grouped_name(os.uid, &os.name, os.builtin);
        Some(format!("ObjectStyle/{}", self_name(&name)))
    }

    /// `nested` for an item inside another page item; `outer` is the
    /// transform from the item's parent to the spread (for anchored items,
    /// to the anchor).
    pub(super) fn page_item(&self, x: &mut Xml, item: &PageItem, nested: bool, outer: &Matrix) {
        let tag = match &item.kind {
            // A frame of the endnote story (footnotes.md).
            ItemKind::TextFrame { story: Some(s), .. }
                if self.doc.stories.iter().any(|t| t.uid == *s && t.is_endnote) =>
            {
                "EndnoteTextFrame"
            }
            ItemKind::TextFrame { .. } => "TextFrame",
            ItemKind::Group => "Group",
            ItemKind::Shape(Shape::Rectangle) => "Rectangle",
            ItemKind::Shape(Shape::Oval) => "Oval",
            ItemKind::Shape(Shape::Polygon) => "Polygon",
            ItemKind::Shape(Shape::GraphicLine) => "GraphicLine",
            ItemKind::EpsText(_) => "EPSText",
            ItemKind::Form(f) => form_tag(f.kind),
        };
        x.start(tag).attr("Self", uref(Some(item.uid)));
        if let Some(list) = &item.article_children {
            // Only the group's own children: a reference to an item that is
            // not written would dangle.
            let (kept, dropped): (Vec<u32>, Vec<u32>) = list
                .iter()
                .partition(|u| item.children.iter().any(|c| c.uid == **u));
            if !dropped.is_empty() {
                self.warnings.borrow_mut().push(format!(
                    "group {}: article children {dropped:?} left out: not written in the group",
                    item.uid
                ));
            }
            let refs: Vec<String> = kept.iter().map(|&u| uref(Some(u))).collect();
            x.attr("ArticleChildrenList", refs.join(" "));
        }
        if let ItemKind::TextFrame {
            story,
            previous,
            next,
            ..
        } = &item.kind
        {
            x.attr("ParentStory", uref(*story))
                .attr("PreviousTextFrame", uref(*previous))
                .attr("NextTextFrame", uref(*next))
                .attr("ContentType", "TextType");
            // The ID that links to this frame name it by (objects.md,
            // story links).
            if let Some(id) = self.doc.link_source_ids.get(&item.uid) {
                x.attr("LinkResourceId", id.to_string());
            }
        } else if let ItemKind::Shape(_) = item.kind {
            let content = if item.graphics.is_empty() && !item.props.graphic_frame {
                "Unassigned"
            } else {
                "GraphicType"
            };
            x.attr("ContentType", content);
        }
        let applied = item.object_style.and_then(|u| self.style_values(u));
        // A category that the item's object style (not the root) turns
        // off: IDML writes the item's values of that category even where
        // they equal the style's (attributes.md, values an item does not
        // store).
        let on = match (&applied, item.object_style) {
            (Some(a), Some(u))
                if !self
                    .doc
                    .object_styles
                    .get(&u)
                    .is_some_and(Self::is_root_object_style) =>
            {
                a.enabled.as_deref()
            }
            _ => None,
        };
        let forced = |name: &str| on.is_some_and(|on| category_off(name, on));
        // A form field's fill, stroke and corner values are not those of
        // its attribute list (objects.md, form fields).
        let form = matches!(item.kind, ItemKind::Form(_));
        let own = if form {
            Vec::new()
        } else {
            self.item_attr_values(&item.attrs)
        };
        // The stroke type in effect decides the dash attributes.
        let stroke_type = (tag != "Group")
            .then(|| {
                self.values_in_effect(item)
                    .into_iter()
                    .find(|(n, ..)| *n == "StrokeType")
                    .map(|(_, v, _)| v)
            })
            .flatten();
        for (name, v) in own {
            if !dash_written(name, stroke_type.as_deref()) {
                continue;
            }
            // Fill, stroke and corner values equal to the object style's
            // are left out (attributes.md, page item attributes).
            let same = STYLE_COMPARED.contains(&name)
                && !forced(name)
                && !full_tint(item, name)
                && applied
                    .as_ref()
                    .and_then(|s| s.item(name))
                    .is_some_and(|s| applied::same_value(s, &v));
            if !same {
                x.attr(name, v);
            }
        }
        // A fill, stroke or corner attribute that the item does not store
        // has the value of the document's base list; IDML writes it where
        // it differs from the object style's, and always for an item
        // without an object style (attributes.md, values an item does not
        // store). Groups vary.
        if tag != "Group"
            && !form
            && (applied.is_some() || item.object_style.is_none())
            && let Some(base) = &self.doc.prefs.item_base
        {
            let mut rest = base.clone();
            rest.values.retain(|(id, _)| item.attrs.get(*id).is_none());
            for (name, v) in self.item_attr_values(&rest) {
                // IDML writes no corner attributes for EPS text.
                if tag == "EPSText" && name.contains("Corner")
                    || !dash_written(name, stroke_type.as_deref())
                {
                    continue;
                }
                let write = match &applied {
                    Some(a) => a
                        .item(name)
                        .is_some_and(|s| forced(name) || !applied::same_value(s, &v)),
                    None => true,
                };
                if STYLE_COMPARED.contains(&name) && write {
                    x.attr(name, v);
                }
            }
        }
        // A group stores none of these values; IDML gives it the value
        // all its children have in effect (attributes.md, groups).
        if tag == "Group" {
            let shared = self.shared_values(item);
            for name in STYLE_COMPARED {
                let Some((v, full)) = shared
                    .iter()
                    .find(|(n, ..)| n == name)
                    .map(|(_, v, f)| (v, *f))
                else {
                    continue;
                };
                let write = forced(name)
                    || full
                    || applied
                        .as_ref()
                        .and_then(|a| a.item(name))
                        .is_none_or(|s| !applied::same_value(s, v));
                if write {
                    x.attr(name, v.clone());
                }
            }
        }
        if tag == "Group" {
            for overprint @ (name, ..) in OVERPRINT {
                let style = applied.as_ref().and_then(|a| a.item(name));
                if let Some(Some(v)) = self.overprint_in_effect(item, overprint)
                    && v.to_string() != style.unwrap_or("false")
                {
                    x.attr(name, v.to_string());
                }
            }
        } else if !form {
            self.item_overprint(x, item, applied.as_deref(), &forced);
        }
        // An item without an object style refers to none, `n`
        // (attributes.md, values an item does not store). Where a form
        // field with states keeps its style is not known.
        let style_ref = item.object_style.and_then(|u| self.object_style_ref(u));
        if !form || style_ref.is_some() {
            x.attr(
                "AppliedObjectStyle",
                style_ref.unwrap_or_else(|| "n".into()),
            );
        }
        // Only items directly on a spread have `ItemLayer` (objects.md,
        // page item settings).
        if let Some(layer) = item.layer.filter(|_| !nested) {
            x.attr("ItemLayer", uref(Some(layer)));
        }
        x.attr("ItemTransform", matrix(&item.transform));
        // From 21.4; -1 without the chunk (objects.md, page item settings).
        if self.saved_by((21, 4)) {
            if let Some(layer) = item.props.grouping_layer {
                x.attr("BeforeGroupingLayerReference", uref(Some(layer)));
            }
            x.attr(
                "BeforeGroupingLayerPosition",
                item.props.grouping_layer_position.unwrap_or(-1).to_string(),
            );
        }
        self.item_settings(x, item, nested);
        if let ItemKind::Form(f) = &item.kind {
            Self::form_attrs(x, f);
        }
        // An endnote text frame has the values of a text frame.
        let observed = if tag == "EndnoteTextFrame" {
            "TextFrame"
        } else {
            tag
        };
        x.attrs_missing(self.observed(observed).iter());
        // A form field has the bounds of what it shows in place of paths
        // (objects.md, form fields).
        let (bounds, paths) = match &item.kind {
            ItemKind::Form(f) => (f.bounds, &[][..]),
            _ => (None, &item.paths[..]),
        };
        if !item.label.is_empty() || bounds.is_some() || !paths.is_empty() {
            x.start("Properties");
            Self::label(x, &item.label);
            if let Some([l, t, r, b]) = bounds {
                x.empty(
                    "PathBoundingBox",
                    &[
                        ("Left", num(l)),
                        ("Top", num(t)),
                        ("Right", num(r)),
                        ("Bottom", num(b)),
                    ],
                );
            }
            if !paths.is_empty() {
                Self::path_geometry_element(x, paths);
            }
            x.end();
        }
        // A frame grid (objects.md, frame grids).
        if let ItemKind::TextFrame {
            preferences: Some(p),
            ..
        } = &item.kind
            && p.frame_grid
        {
            let count = self
                .doc
                .prefs
                .grids
                .iter()
                .find(|(tag, ..)| *tag == "StoryGridDataInformation")
                .and_then(|(_, _, c)| *c);
            if let Some(c) = count {
                x.empty(
                    "GridDataInformation",
                    &[
                        ("GridView", "GridViewEnum".into()),
                        ("CharacterCountLocation", "BottomAlign".into()),
                        ("CharacterCountSize", num(c)),
                    ],
                );
            }
        }
        for t in &item.text_paths {
            self.text_path(x, t);
        }
        if let ItemKind::EpsText(e) = &item.kind {
            Self::eps_text_properties(x, e);
        }
        if let ItemKind::TextFrame {
            preferences: Some(p),
            ..
        } = &item.kind
        {
            let plain = plain_rectangle(&item.paths)
                && self
                    .values_in_effect(item)
                    .iter()
                    .all(|(n, v, _)| !n.ends_with("CornerOption") || v == "None");
            self.text_frame_preference(x, p, applied.as_deref(), plain);
        }
        let frame = matches!(
            item.kind,
            ItemKind::Shape(Shape::Rectangle | Shape::Oval | Shape::Polygon)
        );
        if frame {
            self.frame_fitting(x, item);
        }
        // EPS text and form fields have no export options (objects.md,
        // EPS text and form fields).
        if !matches!(item.kind, ItemKind::EpsText(_) | ItemKind::Form(_))
            && let Some(n) = export::object_export_option(
                self.doc.version,
                item.export.as_ref(),
                item.props.export_size_type,
                &item.props.generated_alt,
                if tag == "Group" {
                    export::Owner::Group
                } else {
                    export::Owner::Item
                },
            )
        {
            n.write(x);
        }
        // IDML writes the anchor settings that differ from the object
        // style's, which is not known for a form field with states; all of
        // them where the style turns the category off (objects.md,
        // anchored object settings).
        let unknown_style = form && item.object_style.is_none();
        // An item inside an anchored item has the anchor's settings
        // (objects.md, anchored object settings).
        let inherited = (nested && item.anchor.is_none())
            .then(|| self.anchors.borrow().last().cloned())
            .flatten();
        if let Some(d) = item
            .anchor
            .as_ref()
            .or(inherited.as_ref())
            .filter(|_| !unknown_style)
        {
            let style = item
                .object_style
                .and_then(|u| self.doc.object_styles.get(&u));
            let off = style
                .and_then(|s| s.enabled.as_ref())
                .is_some_and(|on| !on.contains(&0xCA2F));
            let style = style.and_then(|s| s.anchor.as_ref()).filter(|_| !off);
            let mut attrs: Vec<(&str, String)> = anchored_settings(d)
                .into_iter()
                .filter(|a| style.is_none_or(|s| !anchored_settings(s).contains(a)))
                .collect();
            // A complete element has two more values (idml-values.md,
            // anchored object settings of page items).
            if ANCHORED_SETTINGS
                .iter()
                .all(|n| attrs.iter().any(|(k, _)| k == n))
            {
                attrs.push(("LockPosition", "false".into()));
                attrs.push(("AnchorSpaceAbove", "0".into()));
            }
            if !attrs.is_empty() {
                x.empty("AnchoredObjectSetting", &attrs);
            }
        }
        // A frame has the contour of its graphic, unless its object style
        // turns the text wrap category on (objects.md, text wrap).
        let style_wrap =
            on.is_some_and(|on| [0x1B942, 0x37C8, 0x37C9].iter().all(|id| on.contains(id)));
        let contour = match item.graphics.as_slice() {
            [g] if style_wrap => self
                .graphic_contour(g)
                .map(|o| ContourOption { contour: None, ..o }),
            [g] => self.graphic_contour(g),
            _ => None,
        };
        Self::text_wrap_preference(x, item.text_wrap.as_ref(), contour);
        if frame {
            // The values every IDML has (idml-values.md, page items).
            let observed = self.observed(&format!("{tag}/InCopyExportOption"));
            if !observed.is_empty() {
                x.start("InCopyExportOption");
                x.attrs_missing(observed.iter());
                x.end();
            }
        }
        for (effect, attr, v) in transparency::write(
            self,
            x,
            &item.attrs,
            applied.as_deref(),
            &uref(Some(item.uid)),
        ) {
            self.warnings.borrow_mut().push(format!(
                "item {}: {effect} {attr} {v} is outside the IDML range; left out",
                item.uid
            ));
        }
        // IDML writes a multi-state object's animation after its states
        // (objects.md, animation settings); the schema allows a button's
        // only before its timing and states.
        let multi_state = matches!(&item.kind, ItemKind::Form(f) if f.kind == FormKind::MultiState);
        if !multi_state && let Some(a) = &item.animation {
            self.animation_setting(x, item.uid, a);
        }
        if let ItemKind::Form(f) = &item.kind {
            self.timing_setting(x, &uref(Some(item.uid)), &f.timing);
        }
        if let Some(a) = &item.anchor {
            self.anchors.borrow_mut().push(a.clone());
        }
        for child in &item.children {
            self.page_item(x, child, true, &item.transform.then(outer));
        }
        if item.anchor.is_some() {
            self.anchors.borrow_mut().pop();
        }
        if let ItemKind::Form(f) = &item.kind {
            self.form_states(x, item, f, &item.transform.then(outer));
            self.form_behaviors(x, item, f);
        }
        if multi_state && let Some(a) = &item.animation {
            self.animation_setting(x, item.uid, a);
        }
        for g in &item.graphics {
            self.placed_graphic(x, g, &item.transform.then(outer));
        }
        for m in &item.media {
            self.media(x, m, &item.transform.then(outer));
        }
        x.end();
    }

    /// The fill, stroke and corner values (`STYLE_COMPARED`) a page item
    /// has in effect, with the stored-100 tint flag: its own value, else
    /// the document's base list value where IDML writes it, else its
    /// object style's. A group has the value all its children share; a
    /// form field has none (attributes.md, groups).
    fn values_in_effect(&self, item: &PageItem) -> Vec<(&'static str, String, bool)> {
        match item.kind {
            ItemKind::Group => return self.shared_values(item),
            ItemKind::Form(_) => return Vec::new(),
            _ => {}
        }
        let applied = item.object_style.and_then(|u| self.style_values(u));
        let on = match (&applied, item.object_style) {
            (Some(a), Some(u))
                if !self
                    .doc
                    .object_styles
                    .get(&u)
                    .is_some_and(Self::is_root_object_style) =>
            {
                a.enabled.as_deref()
            }
            _ => None,
        };
        let own = self.item_attr_values(&item.attrs);
        let base = match &self.doc.prefs.item_base {
            Some(b) if applied.is_some() || item.object_style.is_none() => {
                let mut rest = b.clone();
                rest.values.retain(|(id, _)| item.attrs.get(*id).is_none());
                self.item_attr_values(&rest)
            }
            _ => Vec::new(),
        };
        let mut out: Vec<(&'static str, String, bool)> = Vec::new();
        for &name in STYLE_COMPARED {
            if matches!(item.kind, ItemKind::EpsText(_)) && name.contains("Corner") {
                continue;
            }
            // StrokeType comes before the dash attributes in the list.
            let stroke = out
                .iter()
                .find(|(n, ..)| *n == "StrokeType")
                .map(|(_, v, _)| v.as_str());
            if !dash_written(name, stroke) {
                continue;
            }
            let style = applied.as_ref().and_then(|a| a.item(name));
            if let Some((_, v)) = own.iter().find(|(n, _)| *n == name) {
                out.push((name, v.clone(), full_tint(item, name)));
                continue;
            }
            if let Some((_, b)) = base.iter().find(|(n, _)| *n == name) {
                let forced = on.is_some_and(|on| category_off(name, on));
                let written = applied.is_none()
                    || style.is_some_and(|s| forced || !applied::same_value(s, b));
                if written {
                    out.push((name, b.clone(), false));
                    continue;
                }
            }
            if let Some(s) = style {
                out.push((name, s.to_string(), false));
            }
        }
        out
    }

    /// The overprint flag of `overprint` (an `OVERPRINT` entry) that a
    /// page item has in effect: its own flag, else its object style's
    /// value, else `false`. Before 21.4 an item whose fill or stroke puts
    /// no ink on the page has none (`Some(None)`). A group
    /// has the flag that all its children with one share, `Some(None)`
    /// when none has one; `None` when they differ, and for a form field
    /// (objects.md, page item overprint).
    fn overprint_in_effect(&self, item: &PageItem, overprint: Overprint) -> Option<Option<bool>> {
        match item.kind {
            ItemKind::Group => {
                let mut shared = None;
                for c in &item.children {
                    match (self.overprint_in_effect(c, overprint)?, shared) {
                        (None, _) => {}
                        (Some(v), None) => shared = Some(v),
                        (Some(v), Some(s)) if v == s => {}
                        _ => return None,
                    }
                }
                Some(shared)
            }
            ItemKind::Form(_) => None,
            _ => {
                let applied = item.object_style.and_then(|u| self.style_values(u));
                if !self.saved_by((21, 4)) && !self.puts_ink(item, applied.as_deref(), overprint) {
                    return Some(None);
                }
                match item.attrs.get(overprint.5).and_then(Value::as_u32) {
                    Some(v @ 0..=1) => Some(Some(v == 1)),
                    Some(_) => None,
                    None => Some(Some(
                        applied.as_ref().and_then(|a| a.item(overprint.0)) == Some("true"),
                    )),
                }
            }
        }
    }

    /// The values of `values_in_effect` that all children of `group`
    /// have. EPS text has no corner values and is left out for those.
    fn shared_values(&self, group: &PageItem) -> Vec<(&'static str, String, bool)> {
        let children: Vec<_> = group
            .children
            .iter()
            .map(|c| {
                (
                    matches!(c.kind, ItemKind::EpsText(_)),
                    self.values_in_effect(c),
                )
            })
            .collect();
        let mut out = Vec::new();
        for &name in STYLE_COMPARED {
            let mut shared: Option<(String, bool)> = None;
            let mut all = true;
            let mut any = false;
            for (eps, values) in &children {
                if *eps && name.contains("Corner") {
                    continue;
                }
                any = true;
                match values.iter().find(|(n, ..)| *n == name) {
                    Some((_, v, full)) => match &mut shared {
                        None => shared = Some((v.clone(), *full)),
                        Some((s, f)) if applied::same_value(s, v) => *f &= *full,
                        Some(_) => all = false,
                    },
                    None => all = false,
                }
            }
            if all
                && any
                && let Some((v, full)) = shared
            {
                out.push((name, v, full));
            }
        }
        out
    }

    /// The attributes of a form field that its attribute list holds
    /// (objects.md, form fields).
    fn form_attrs(x: &mut Xml, f: &Form) {
        if let Some(n) = &f.name {
            x.attr("Name", n);
        }
        let flag = |v: bool| v.to_string();
        let attrs: [(&str, Option<String>); 7] = [
            ("Description", f.description.clone()),
            ("ExportValue", f.export_value.clone()),
            (
                "Required",
                f.required
                    .filter(|_| !matches!(f.kind, FormKind::Button | FormKind::MultiState))
                    .map(flag),
            ),
            ("Multiline", f.multiline.map(flag)),
            ("Scrollable", f.scrollable.map(flag)),
            ("FontSize", f.font_size.map(num)),
            (
                "AppliedFont",
                f.font.as_ref().map(|(family, _)| family.clone()),
            ),
        ];
        for (name, v) in attrs {
            if let Some(v) = v {
                x.attr(name, v);
            }
        }
        if let Some((_, Some(style))) = &f.font {
            x.attr("FontStyle", style);
        }
    }

    /// The `State` elements of a form field with the items each shows
    /// (objects.md, form fields). `outer` is the field's transform to
    /// the spread.
    fn form_states(&self, x: &mut Xml, item: &PageItem, f: &Form, outer: &Matrix) {
        for s in &f.states {
            let statetype = if f.kind == FormKind::MultiState {
                ("long", s.id.to_string())
            } else {
                match state_type(s.id) {
                    Some(t) => ("enumeration", t.to_string()),
                    None => {
                        self.warnings.borrow_mut().push(format!(
                            "item {}: state type {} is not known; state left out",
                            item.uid, s.id
                        ));
                        continue;
                    }
                }
            };
            x.start("State")
                .attr("Self", format!("{}i{:x}", uref(Some(item.uid)), s.id))
                .attr("Active", s.active.to_string())
                .attr("Enabled", s.enabled.to_string());
            x.start("Properties")
                .start("Statetype")
                .attr("type", statetype.0)
                .text(&statetype.1)
                .end()
                .end();
            for i in &s.items {
                self.page_item(x, i, true, outer);
            }
            x.end();
        }
    }

    /// The behaviours of a button, after its states, in stored order
    /// (objects.md, button behaviours). Only buttons have behaviours in
    /// the samples; those of other fields are left out with a warning.
    fn form_behaviors(&self, x: &mut Xml, item: &PageItem, f: &Form) {
        if f.behaviors.is_empty() {
            return;
        }
        if f.kind != FormKind::Button {
            self.warnings.borrow_mut().push(format!(
                "item {}: behaviours of a {:?} left out",
                item.uid, f.kind
            ));
            return;
        }
        for b in &f.behaviors {
            self.behavior(x, b);
        }
    }

    fn behavior(&self, x: &mut Xml, b: &Behavior) {
        let warn = |what: &str, code: u32| {
            self.warnings.borrow_mut().push(format!(
                "behaviour {}: {what} code {code} is not known; left out",
                b.uid
            ))
        };
        let zoom = |code: u32| match code {
            0 => Some("InheritZoom"),
            2 => Some("FitWindow"),
            _ => {
                warn("zoom", code);
                None
            }
        };
        let operation = |code: u32, codes: &[&'static str]| {
            let op = codes.get(code as usize).copied();
            if op.is_none() {
                warn("operation", code);
            }
            op
        };
        let refs = |show: bool, fields: &[(u32, bool)]| {
            fields
                .iter()
                .filter(|(_, s)| *s == show)
                .map(|(u, _)| uref(Some(*u)))
                .collect::<Vec<_>>()
                .join(" ")
        };
        let media = |uid: u32| self.written_media().contains(&uid).then(|| uref(Some(uid)));
        x.start(b.kind.element()).attr("Self", uref(Some(b.uid)));
        // Constants without a stored field (objects.md, button
        // behaviours): `AnchorName`, `GoBackOnRollOff`,
        // `LoopsToNextOrPrevious`.
        let mut properties: Option<(&str, String)> = None;
        match &b.kind {
            BehaviorKind::FirstPage { zoom: z }
            | BehaviorKind::NextPage { zoom: z }
            | BehaviorKind::PreviousPage { zoom: z }
            | BehaviorKind::NextView { zoom: z } => {
                x.attr_opt("ZoomSetting", zoom(*z));
            }
            BehaviorKind::Page { page, zoom: z } => {
                x.attr_opt("ZoomSetting", zoom(*z))
                    .attr("PageNumber", (u64::from(*page) + 1).to_string());
            }
            BehaviorKind::Anchor {
                file,
                anchor,
                zoom: z,
            } => {
                x.attr("AnchorName", "$ID/")
                    .attr_opt("ZoomSetting", zoom(*z))
                    .attr("FilePath", file);
                let item = if file.is_empty() { 0 } else { *anchor };
                properties = Some(("AnchorItem", item.to_string()));
            }
            BehaviorKind::Url(url) | BehaviorKind::SubmitForm(url) => {
                x.attr_opt("URL", url.as_deref());
            }
            BehaviorKind::OpenFile(file) => {
                x.attr("FilePath", file);
            }
            BehaviorKind::ClearForm | BehaviorKind::PrintForm => {}
            BehaviorKind::ShowHide(fields) => {
                x.attr("FieldsToHide", refs(false, fields))
                    .attr("FieldsToShow", refs(true, fields));
            }
            BehaviorKind::State { mso, state } => {
                x.attr("AssociatedMultiStateObject", uref(Some(*mso)))
                    .attr("GoBackOnRollOff", "false");
                properties = Some(("Statetype", state.to_string()));
            }
            BehaviorKind::NextState { mso } | BehaviorKind::PreviousState { mso } => {
                x.attr("AssociatedMultiStateObject", uref(Some(*mso)))
                    .attr("LoopsToNextOrPrevious", "true");
            }
            // `MovieItem` and `SoundItem` name a `Movie` or `Sound` of the
            // package; another UID is left out.
            BehaviorKind::Movie {
                item,
                operation: o,
                point,
            } => {
                x.attr_opt("MovieItem", media(*item))
                    .attr_opt("NavigationPointID", point.map(|p| p.to_string()))
                    .attr_opt("Operation", operation(*o, &["Play"]));
            }
            BehaviorKind::Sound { item, operation: o } => {
                x.attr_opt("SoundItem", media(*item))
                    .attr_opt("Operation", operation(*o, &["Play", "Stop"]));
            }
        }
        let name = if b.name.builtin {
            self.saving_edition()
                .and_then(|e| e.behavior_name(&b.name.name))
                .map(str::to_string)
        } else {
            Some(b.name.name.clone())
        };
        x.attr_opt("Name", name)
            .attr("EnableBehavior", b.enabled.to_string());
        let event = match b.event {
            0x15602 => Some("MouseDown"),
            0x15603 => Some("MouseUp"),
            0x15604 => Some("MouseEnter"),
            code => {
                warn("event", code);
                None
            }
        };
        x.attr_opt("BehaviorEvent", event);
        if properties.is_some() || !b.label.is_empty() {
            x.start("Properties");
            if let Some((tag, value)) = &properties {
                x.start(tag).attr("type", "long").text(value).end();
            }
            Self::label(x, &b.label);
            x.end();
        }
        x.end();
    }

    /// Whether the fill or stroke of `overprint` (an `OVERPRINT` entry)
    /// puts ink on the page: the colour (the item's, else its object
    /// style's) carries ink and the tint is not 0 (objects.md, page item
    /// overprint).
    fn puts_ink(
        &self,
        item: &PageItem,
        applied: Option<&applied::StyleValues>,
        (_, color, color_name, tint, tint_name, _): Overprint,
    ) -> bool {
        let ink = match item.attrs.get(color).and_then(Value::as_u32) {
            Some(c) => self.carries_ink(c),
            None => applied
                .and_then(|a| a.item(color_name))
                .is_some_and(|r| self.reference_carries_ink(r)),
        };
        let tint = match item.attrs.get(tint).and_then(Value::as_f64) {
            Some(t) => Some(t),
            None => applied
                .and_then(|a| a.item(tint_name))
                .and_then(|t| t.parse().ok()),
        };
        ink && tint != Some(0.0)
    }

    /// `OverprintFill` and `OverprintStroke` of a page item, where its
    /// fill or stroke puts ink on the page (objects.md, page item
    /// overprint).
    fn item_overprint(
        &self,
        x: &mut Xml,
        item: &PageItem,
        applied: Option<&applied::StyleValues>,
        forced: &dyn Fn(&str) -> bool,
    ) {
        for overprint @ (name, .., flag) in OVERPRINT {
            if !self.puts_ink(item, applied, overprint) {
                continue;
            }
            let style = applied.and_then(|a| a.item(name));
            let value = match item.attrs.get(flag).and_then(Value::as_u32) {
                Some(v @ 0..=1) => (v == 1).to_string(),
                Some(_) => continue,
                None if forced(name) => "false".to_string(),
                None => continue,
            };
            if forced(name) || style != Some(value.as_str()) {
                x.attr(name, value);
            }
        }
    }

    /// `FrameFittingOption` of a rectangle, oval or polygon. When the
    /// object style, the root `[None]` included, turns the fitting
    /// category off, IDML writes all seven values: the item's where it
    /// stores them, else the style's. Otherwise it writes the item's values
    /// that differ from the style's; a style other than the root without a
    /// category list (older files) gives all its values when none differ.
    /// See `docs/format/objects.md`.
    pub(super) fn frame_fitting(&self, x: &mut Xml, item: &PageItem) {
        let style = item
            .object_style
            .and_then(|u| self.doc.object_styles.get(&u));
        let all: Vec<u32> = FITTING_ATTRS.iter().map(|(id, ..)| *id).collect();
        let off = style
            .and_then(|s| s.enabled.as_ref())
            .is_some_and(|on| !on.contains(&0x1B960));
        let attrs = if let Some(s) = style.filter(|_| off) {
            let mut merged = s.fitting.clone();
            merged
                .values
                .retain(|(id, _)| item.attrs.get(*id).is_none());
            merged.values.extend(
                item.attrs
                    .values
                    .iter()
                    .filter(|(id, _)| all.contains(id))
                    .cloned(),
            );
            fitting_attrs(self, &merged, &all)
        } else {
            let differ: Vec<u32> = all
                .iter()
                .copied()
                .filter(|&id| {
                    item.attrs
                        .get(id)
                        .is_some_and(|v| style.and_then(|s| s.fitting.get(id)) != Some(v))
                })
                .collect();
            if !differ.is_empty() {
                fitting_attrs(self, &item.attrs, &differ)
            } else {
                match style {
                    Some(s) if s.enabled.is_none() && !Self::is_root_object_style(s) => {
                        fitting_attrs(self, &s.fitting, &all)
                    }
                    _ => Vec::new(),
                }
            }
        };
        if !attrs.is_empty() {
            x.empty("FrameFittingOption", &attrs);
        }
    }

    /// The point a guide's `Location` is measured from, by the ruler
    /// origin: the top-left corner of the spread's pages (`origin`); with
    /// `PageOrigin` the corner of the guide's own page; with
    /// `SpineOrigin` a vertical guide on a spread of two pages is
    /// measured from the left edge of the right page.
    /// See `docs/format/objects.md`.
    fn guide_origin(
        &self,
        s: &Spread,
        page: &Page,
        g: &Guide,
        own_page: bool,
        origin: (f64, f64),
    ) -> (f64, f64) {
        match self.doc.prefs.ruler_origin {
            RulerOrigin::Page if own_page => spread_origin(std::slice::from_ref(page)),
            RulerOrigin::Spine if !g.horizontal && s.pages.len() == 2 => {
                let left = |q: &Page| spread_origin(std::slice::from_ref(q)).0;
                let right = left(&s.pages[0]).max(left(&s.pages[1]));
                (right, origin.1)
            }
            _ => origin,
        }
    }

    /// A ruler guide. `origin` is the point IDML measures `Location`
    /// from (see `guide_origin`) and `shift` the spread's translation;
    /// `page_index` is IDML `PageIndex`. See `docs/format/objects.md`.
    pub(super) fn guide(
        x: &mut Xml,
        g: &Guide,
        origin: (f64, f64),
        shift: (f64, f64),
        page_index: i64,
    ) {
        // Both points are taken to pasteboard coordinates before the
        // difference, which reproduces IDML's rounding (a location of 0
        // rather than 1e-13).
        let (from, by) = if g.horizontal {
            (origin.1, shift.1)
        } else {
            (origin.0, shift.0)
        };
        x.start("Guide")
            .attr("Self", uref(Some(g.uid)))
            .attr(
                "Orientation",
                if g.horizontal {
                    "Horizontal"
                } else {
                    "Vertical"
                },
            )
            .attr("Location", num((g.position + by) - (from + by)))
            .attr("FitToPage", g.fit_to_page.to_string());
        // The only stored value in the samples, with the only IDML value.
        if g.view_threshold == 0.05 {
            x.attr("ViewThreshold", "5");
        }
        if g.layer != 0 {
            x.attr("ItemLayer", uref(Some(g.layer)));
        }
        match g.guide_type {
            Some(0) => {
                x.attr("GuideType", "Ruler");
            }
            Some(1) => {
                x.attr("GuideType", "Liquid");
            }
            _ => {}
        }
        x.attr("Locked", g.locked.to_string())
            .attr("PageIndex", page_index.to_string());
        if let Some(z) = g.zone {
            x.attr("GuideZone", num(z));
        }
        if let Some((master, ids)) = &g.overridden {
            let ids = if *master == 0 {
                String::new()
            } else {
                join_numbers(ids)
            };
            x.attr("OverriddenPageItemProps", ids);
        } else if g.zone.is_some() {
            x.attr("OverriddenPageItemProps", "");
        }
        if g.color == 6 {
            Self::properties(
                x,
                &[("GuideColor", "enumeration", "Cyan".to_string().into())],
            );
        }
        x.end();
    }

    /// The settings of a page: its tab order, overridden master items,
    /// layout grid use, layout rule and colour, and the values every IDML
    /// of the version has. See `docs/format/objects.md`, page settings.
    pub(super) fn page_settings(&self, x: &mut Xml, p: &Page, section: Option<&(Section, u32)>) {
        let st = &p.settings;
        let tab: Vec<String> = st.tab_order.iter().map(|&u| uref(Some(u))).collect();
        x.attr("TabOrder", tab.join(" "));
        let overrides: Vec<String> = st
            .overrides
            .iter()
            .flat_map(|&(item, with)| [uref(Some(item)), uref((with != 0).then_some(with))])
            .collect();
        x.attr("OverrideList", overrides.join(" "));
        // Codes 0 and 4 only; the others are in no pair (objects.md, page
        // settings).
        match st.grid_start {
            Some(0) => {
                x.attr("GridStartingPoint", "TopOutside");
            }
            Some(4) => {
                x.attr("GridStartingPoint", "CenterVertical");
            }
            _ => {}
        }
        if let Some(v) = st.use_master_grid {
            x.attr("UseMasterGrid", v.to_string());
        }
        if self.doc.version.major >= 8 {
            const RULES: [&str; 6] = [
                "",
                "Recenter",
                "ObjectBased",
                "Scale",
                "GuideBased",
                "UseMaster",
            ];
            match st.layout_rule {
                None => {
                    x.attr("LayoutRule", "Off");
                }
                Some(code) => {
                    if let Some(r) = RULES.get(code as usize).filter(|r| !r.is_empty()) {
                        x.attr("LayoutRule", *r);
                    }
                }
            }
        }
        x.attrs_missing(self.observed("Page").iter());
        let mut props: Vec<Node> = page_color(&st.color).into_iter().collect();
        // A document page describes its numbering: section prefix, style,
        // continue, include prefix, page number (from DOM 20 twice) and
        // marker.
        if let Some((s, number)) = section
            && let Some(style) = number_style(s.style)
        {
            let item = |ty: &str, text: String| Node {
                tag: "ListItem".into(),
                attrs: vec![("type".into(), ty.into())],
                text: Some(text),
                children: Vec::new(),
            };
            let mut items = vec![
                item("string", s.prefix.clone()),
                // IDML writes the prefix again in place of this style
                // (objects.md, master spread names and sections).
                if s.style == crate::model::numbering::SINGLE_LEADING_ZEROS {
                    item("string", s.prefix.clone())
                } else {
                    item("enumeration", style.into())
                },
                item("boolean", s.continue_numbering.to_string()),
                item("boolean", s.include_prefix.to_string()),
                item("long", number.to_string()),
            ];
            if self.doc.version.major >= 20 {
                items.push(item("long", number.to_string()));
            }
            // A return in the marker is a paragraph separator here.
            items.push(item("string", s.marker.replace('\r', "\u{2029}")));
            props.push(Node {
                tag: "Descriptor".into(),
                attrs: vec![("type".into(), "list".into())],
                text: None,
                children: items,
            });
        }
        Self::properties_with(x, &[], &props);
    }

    /// `MarginPreference` and `GridDataInformation` of a page. Margins
    /// and columns are those in effect (see `resolve_page_layout`). The
    /// grid values that are the same in every sample are written only
    /// when the stored value is that one. See `docs/format/objects.md`.
    pub(super) fn page_layout(&self, x: &mut Xml, p: &Page) {
        if let (Some(m), Some(c)) = (&p.margins, &p.columns) {
            let mut attrs = vec![
                ("ColumnCount", (c.positions.len() / 2).to_string()),
                ("ColumnGutter", num(c.gutter)),
                ("Top", num(m.top)),
                ("Bottom", num(m.bottom)),
                ("Left", num(m.left)),
                ("Right", num(m.right)),
            ];
            // The last u16 of the columns chunk (objects.md, page settings).
            match c.direction {
                Some(0) => attrs.push(("ColumnDirection", "Horizontal".into())),
                Some(1) => attrs.push(("ColumnDirection", "Vertical".into())),
                _ => {}
            }
            attrs.push(("ColumnsPositions", nums(&c.positions)));
            x.empty("MarginPreference", &attrs);
        }
        if let Some(g) = &p.grid {
            self.grid_data(x, g);
        }
    }

    /// `GridDataInformation` of layout grid settings (chunk 0xCD02).
    pub(super) fn grid_data(&self, x: &mut Xml, g: &crate::model::GridData) {
        x.start("GridDataInformation")
            .attr("FontStyle", &g.font_style);
        // `PointSize`, `CharacterAki` and `LineAki` are located; the
        // scales are written only when they have the value of every sample
        // (objects.md, layout grid).
        let [size, character_aki, line_aki, h_scale, v_scale] = g.numbers;
        for (name, value, observed, scale) in [
            ("PointSize", size, None, 1.0),
            ("CharacterAki", character_aki, None, 1.0),
            ("LineAki", line_aki, None, 1.0),
            ("HorizontalScale", h_scale, Some(1.0), 100.0),
            ("VerticalScale", v_scale, Some(1.0), 100.0),
        ] {
            if observed.is_none_or(|o| value == o) {
                x.attr(name, num(value * scale));
            }
        }
        if g.codes == [3, 0, 3, 1] {
            x.attr("LineAlignment", "LeftOrTopLineJustify")
                .attr("GridAlignment", "AlignEmCenter")
                .attr("CharacterAlignment", "AlignEmCenter");
        }
        if let Some(f) = self.doc.fonts.get(&g.font) {
            Self::properties(
                x,
                &[("AppliedFont", "string", self.family_names(f).0.into())],
            );
        }
        x.end();
    }

    /// `page_index` counts the document pages written so far; `names`
    /// gives each document page its name (see `page_names`).
    pub(super) fn spread(
        &self,
        s: &Spread,
        master: bool,
        page_index: &mut usize,
        names: &[String],
    ) -> String {
        let mut x = Xml::new();
        let kind = if master { "MasterSpread" } else { "Spread" };
        self.package_root(&mut x, kind);
        x.start(kind)
            .attr("Self", uref(Some(s.uid)))
            .attr("PageCount", s.pages.len().to_string());
        let origin = spread_origin(&s.pages);
        let major = self.doc.version.major;
        if !master {
            x.attr("BindingLocation", s.binding_location.to_string());
        }
        x.attr("ItemTransform", matrix(&s.transform));
        let (prefix, base) = s
            .master_name
            .clone()
            .unwrap_or_else(|| ("A".into(), "Master".into()));
        if master {
            x.attr("Name", format!("{prefix}-{base}"))
                .attr("NamePrefix", &prefix)
                .attr("BaseName", &base);
            match s.show_master_items {
                None => {
                    x.attr("ShowMasterItems", "true");
                }
                Some(0) => {
                    x.attr("ShowMasterItems", "false");
                }
                Some(_) => {}
            }
        } else {
            // Page transitions (objects.md, spreads); without the chunk,
            // none.
            let (ty, dir) = s.transition.unwrap_or((0, 0));
            if let Some(t) = TRANSITION_TYPES.iter().find(|(c, _)| *c == ty) {
                x.attr("PageTransitionType", t.1);
            }
            if let Some(d) = TRANSITION_DIRECTIONS.iter().find(|(c, _)| *c == dir) {
                x.attr("PageTransitionDirection", d.1);
            }
            match s.shuffle {
                Some(0) => {
                    x.attr("AllowPageShuffle", "true");
                }
                Some(1) | None => {
                    x.attr("AllowPageShuffle", "false");
                }
                Some(_) => {}
            }
        }
        x.attrs_missing(self.observed(kind).iter());
        if master
            && major >= 8
            && let Some(f) = primary_text_frame(s)
        {
            x.attr("PrimaryTextFrame", f);
        }
        // A master spread has the colour its pages share (objects.md).
        if master
            && let Some(first) = s.pages.first()
            && s.pages
                .iter()
                .all(|p| p.settings.color == first.settings.color)
            && let Some(n) = page_color(&first.settings.color)
        {
            x.start("Properties");
            n.write(&mut x);
            x.end();
        }
        if !master && let Some(mut fp) = values::element("Spread/FlattenerPreference", major) {
            // Without the flattener chunk, IDML has 400 and 400 after a
            // session of a Japanese or Chinese edition, otherwise 300 and
            // 150 (`objects.md`, flattener settings).
            let res = s.flattener_resolution.or(match self.japanese_session() {
                Some(true) => Some([400.0, 400.0]),
                Some(false) => Some([300.0, 150.0]),
                None => None,
            });
            if let Some([line_art, gradient]) = res {
                fp.attrs
                    .insert(0, ("GradientAndMeshResolution".into(), num(gradient)));
                fp.attrs
                    .insert(0, ("LineArtAndTextResolution".into(), num(line_art)));
            }
            fp.write(&mut x);
        }
        self.timing_setting(&mut x, &uref(Some(s.uid)), &s.timing);
        for p in &s.pages {
            let name = if master {
                prefix.clone()
            } else {
                *page_index += 1;
                names
                    .get(*page_index - 1)
                    .cloned()
                    .unwrap_or_else(|| page_index.to_string())
            };
            // Master pages have none (`n`).
            let layout = if master {
                None
            } else {
                self.page_layouts.get(*page_index - 1).copied()
            };
            let [x0, y0, x1, y1] = p.bounds;
            x.start("Page")
                .attr("Self", uref(Some(p.uid)))
                .attr("Name", name)
                .attr("GeometricBounds", nums(&[y0, x0, y1, x1]))
                .attr("ItemTransform", matrix(&p.transform))
                // A master page can itself be based on a master.
                .attr("AppliedMaster", uref(p.master))
                .attr("MasterPageTransform", matrix(&p.master_transform));
            if self.doc.version.major >= 8 {
                x.attr("AppliedAlternateLayout", uref(layout));
            }
            let section = if master {
                None
            } else {
                self.page_sections.get(*page_index - 1)
            };
            self.page_settings(&mut x, p, section);
            // A guide belongs to a page, or to the spread; IDML writes a
            // spread's guides in its first page.
            let first = p.uid == s.pages[0].uid;
            // Pages count from the spine: left of it -1, -2, ..., right of
            // it 1, 2, ...; a master spread's spine is at its left edge.
            let position = s.pages.iter().position(|q| q.uid == p.uid).unwrap_or(0) as i64;
            let binding = if master { 0 } else { s.binding_location as i64 };
            let from_spine = if position < binding {
                position - binding
            } else {
                position - binding + 1
            };
            let extent = pages_extent(&s.pages);
            let shift = (s.transform.0[4], s.transform.0[5]);
            for g in &s.guides {
                let own_page = s.pages.iter().any(|q| q.uid == g.owner);
                // IDML leaves out a guide of the spread that lies outside
                // the spread's pages (objects.md, guides).
                let outside = !own_page
                    && extent.is_some_and(|[x0, y0, x1, y1]| {
                        let (lo, hi) = if g.horizontal { (y0, y1) } else { (x0, x1) };
                        g.position < lo - 1e-6 || g.position > hi + 1e-6
                    });
                if outside {
                    continue;
                }
                if g.owner == p.uid || (first && !own_page) {
                    let index = if own_page { from_spine } else { 0 };
                    let from = self.guide_origin(s, p, g, own_page, origin);
                    Self::guide(&mut x, g, from, shift, index);
                }
            }
            self.page_layout(&mut x, p);
            x.end();
        }
        for item in &s.items {
            self.page_item(&mut x, item, false, &s.transform);
        }
        x.end();
        x.finish()
    }
}

/// `PrimaryTextFrame` of a master spread: `n` without a primary story,
/// otherwise the spread's first text frame of that story; `None` if the
/// spread has no such frame (objects.md, primary text frame).
fn primary_text_frame(s: &Spread) -> Option<String> {
    fn find(items: &[PageItem], story: u32) -> Option<u32> {
        items.iter().find_map(|i| match i.kind {
            ItemKind::TextFrame {
                story: Some(st),
                previous: None,
                ..
            } if st == story => Some(i.uid),
            _ => find(&i.children, story),
        })
    }
    match s.primary_story {
        None | Some(0) => Some("n".into()),
        Some(story) => find(&s.items, story).map(|u| uref(Some(u))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Encoding;
    use crate::header::{ByteOrder, Version};
    use crate::model::PathPoint;

    #[test]
    fn stroke_categories_turn_off_their_own_attributes() {
        // Only EnableStrokeAndCornerOptions off.
        let on = [0x1B933, 0x1B934];
        assert!(category_off("StrokeWeight", &on));
        assert!(category_off("TopLeftCornerRadius", &on));
        assert!(!category_off("StrokeColor", &on));
        assert!(!category_off("StrokeType", &on));
        assert!(!category_off("FillColor", &on));
        // Fill and both stroke categories off.
        assert!(category_off("StrokeType", &[]));
        assert!(category_off("FillTint", &[]));
    }

    #[test]
    fn plain_rectangles_have_exactly_four_points() {
        let path = |pts: &[(f64, f64)]| {
            vec![Path {
                points: pts
                    .iter()
                    .map(|&a| PathPoint {
                        anchor: a,
                        left: a,
                        right: a,
                        kind: 2,
                    })
                    .collect(),
                open: false,
            }]
        };
        let rect = [(0.0, 0.0), (10.0, 0.0), (10.0, 5.0), (0.0, 5.0)];
        assert!(plain_rectangle(&path(&rect)));
        // Corners a last digit apart.
        assert!(plain_rectangle(&path(&[
            (0.0, 0.0),
            (10.0, 1e-9),
            (10.0, 5.0),
            (1e-9, 5.0),
        ])));
        // A point on a side, a repeated first point.
        assert!(!plain_rectangle(&path(&[
            (0.0, 0.0),
            (4.0, 0.0),
            (10.0, 0.0),
            (10.0, 5.0),
            (0.0, 5.0),
        ])));
        let mut closed = rect.to_vec();
        closed.push(rect[0]);
        assert!(!plain_rectangle(&path(&closed)));
        // A rotated rectangle, a triangle, a crossed path.
        assert!(!plain_rectangle(&path(&[
            (0.0, 0.0),
            (4.0, 3.0),
            (1.0, 7.0),
            (-3.0, 4.0)
        ])));
        assert!(!plain_rectangle(&path(&rect[..3])));
        assert!(!plain_rectangle(&path(&[
            (0.0, 0.0),
            (10.0, 5.0),
            (10.0, 0.0),
            (0.0, 5.0)
        ])));
        // A curved side, two paths.
        let mut curved = path(&rect);
        curved[0].points[1].right = (12.0, 2.0);
        assert!(!plain_rectangle(&curved));
        let mut two = path(&rect);
        two.extend(path(&rect));
        assert!(!plain_rectangle(&two));
    }

    #[test]
    fn primary_text_frame_needs_a_first_frame_of_the_story() {
        let mut s = Spread {
            uid: 1,
            master_name: None,
            transform: Matrix::IDENTITY,
            binding_location: 0,
            pages: Vec::new(),
            items: Vec::new(),
            guides: Vec::new(),
            shuffle: None,
            flattener_resolution: None,
            show_master_items: None,
            primary_story: None,
            transition: None,
            timing: Vec::new(),
        };
        assert_eq!(primary_text_frame(&s).as_deref(), Some("n"));
        s.primary_story = Some(0);
        assert_eq!(primary_text_frame(&s).as_deref(), Some("n"));
        // A story without a frame on the spread.
        s.primary_story = Some(5);
        assert_eq!(primary_text_frame(&s), None);
    }

    #[test]
    fn writes_wrap_offsets_by_side() {
        let wrap = TextWrap {
            mode: wrap_mode::BOUNDING_BOX,
            offsets: [1.0, 2.0, 3.0, 4.0],
            master_flag: 0,
            side: 5,
            path_uid: 0,
            custom_path: Vec::new(),
        };
        let mut x = Xml::new();
        Writer::text_wrap_preference(&mut x, Some(&wrap), None);
        let out = x.finish();
        assert!(out.contains("TextWrapMode=\"BoundingBoxTextWrap\""));
        assert!(out.contains("ApplyToMasterPageOnly=\"true\" TextWrapSide=\"LargestArea\""));
        assert!(out.contains("<TextWrapOffset Top=\"2\" Left=\"1\" Bottom=\"4\" Right=\"3\" />"));
        assert!(!out.contains("ContourOption"));
        assert!(!out.contains("PathGeometry"));

        // A custom wrap path comes first in `Properties`.
        let pt = |a| PathPoint {
            anchor: a,
            left: a,
            right: a,
            kind: 2,
        };
        let path = Path {
            points: vec![pt((0.0, 0.0)), pt((1.5, 0.0)), pt((1.5, 2.0))],
            open: false,
        };
        let custom = TextWrap {
            custom_path: vec![path],
            ..wrap
        };
        let mut x = Xml::new();
        Writer::text_wrap_preference(&mut x, Some(&custom), None);
        let out = x.finish();
        let at = out.find("<PathGeometry>").unwrap();
        assert!(out.find("<Properties>").unwrap() < at);
        assert!(out[at..].contains("<PathPointType Anchor=\"1.5 2\""));
        assert!(out.find("</PathGeometry>").unwrap() < out.find("<TextWrapOffset").unwrap());
    }

    #[test]
    fn reads_and_writes_contours() {
        let enc = Encoding::new(ByteOrder::Little, Version::default());
        let mut chunk = [0u8; 29];
        chunk[0] = 2;
        chunk[17] = 1;
        let alpha = Contour::read(enc, &chunk).unwrap();
        assert_eq!(alpha.inside_edges, Some(true));
        // A damaged chunk is left out.
        assert_eq!(Contour::read(enc, &chunk[..17]), None);
        let write_with = |contour: Option<Contour>, path_name: &str, params: bool| {
            let mut x = Xml::new();
            let o = ContourOption {
                contour,
                path_name: path_name.into(),
                params,
            };
            Writer::text_wrap_preference(&mut x, None, Some(o));
            x.finish()
        };
        let write = |contour, path_name| write_with(contour, path_name, false);
        let out = write(Some(alpha), "Alpha 1");
        let at = out
            .find(
                "<ContourOption ContourType=\"AlphaChannel\" IncludeInsideEdges=\"true\" \
                 ContourPathName=\"Alpha 1\" />",
            )
            .unwrap();
        // The schema puts `ContourOption` after `Properties`.
        assert!(out.find("</Properties>").unwrap() < at);
        // A frame whose object style turns the wrap category on.
        assert!(write(None, "$ID/").contains("<ContourOption ContourPathName=\"$ID/\" />"));
        // DOM 21.4 on: the parameters follow a contour type only.
        assert!(write_with(Some(Contour::DEFAULT), "$ID/", true).contains(
            "ContourPathName=\"$ID/\" ContourTolerance=\"5\" ContourThreshold=\"25\" \
             ContourAlphaIndex=\"0\" ContourPathIndex=\"-1\" />"
        ));
        assert!(
            write_with(None, "$ID/", true).contains("<ContourOption ContourPathName=\"$ID/\" />")
        );
        // An unknown code leaves the contour out.
        let unknown = Contour {
            kind: 7,
            inside_edges: Some(false),
        };
        assert!(!write(Some(unknown), "$ID/").contains("ContourOption"));
    }

    #[test]
    fn measures_guides_from_spread_origin() {
        use crate::model::Page;
        let page = |uid, tx| Page {
            uid,
            bounds: [0.0, 0.0, 612.0, 792.0],
            transform: Matrix([1.0, 0.0, 0.0, 1.0, tx, -396.0]),
            master: None,
            master_transform: Matrix::IDENTITY,
            margins: None,
            columns: None,
            grid: None,
            settings: Default::default(),
        };
        let origin = spread_origin(&[page(1, -612.0), page(2, 0.0)]);
        assert_eq!(origin, (-612.0, -396.0));
        let guide = Guide {
            uid: 0x2299,
            horizontal: true,
            position: 339.5,
            owner: 2,
            fit_to_page: true,
            view_threshold: 0.05,
            color: 6,
            guide_type: Some(0),
            layer: 0xcc,
            locked: false,
            zone: Some(1.0),
            overridden: None,
        };
        let mut x = Xml::new();
        Writer::guide(&mut x, &guide, origin, (0.0, 0.0), -1);
        let out = x.finish();
        assert!(
            out.contains("Orientation=\"Horizontal\" Location=\"735.5\""),
            "{out}"
        );
        assert!(
            out.contains("ItemLayer=\"ucc\" GuideType=\"Ruler\""),
            "{out}"
        );
        assert!(out.contains("<GuideColor type=\"enumeration\">Cyan</GuideColor>"));
        assert!(out.contains("PageIndex=\"-1\" GuideZone=\"1\""), "{out}");
        let vertical = Guide {
            horizontal: false,
            position: 28.0,
            ..guide
        };
        let mut x = Xml::new();
        Writer::guide(&mut x, &vertical, origin, (0.0, 0.0), 1);
        assert!(x.finish().contains("Location=\"640\""));
        // A guide on the origin: through the spread's translation the
        // difference is 0, as in IDML, not -1.1e-13.
        let on_edge = Guide {
            position: -600.0,
            ..vertical
        };
        let mut x = Xml::new();
        let edge = (20.0000000000001 - 620.0, 0.0);
        Writer::guide(&mut x, &on_edge, edge, (-5.684341886080802e-14, 0.0), 1);
        assert!(x.finish().contains("Location=\"0\""));
    }
}
