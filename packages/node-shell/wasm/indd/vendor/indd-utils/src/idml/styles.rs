//! `Resources/Styles.xml`: paragraph, character, object, table and cell
//! styles, their style groups, and the root styles every IDML has.
//!
//! Evidence: `docs/format/objects.md` (styles and style groups),
//! `attributes.md`, `tables.md` and `idml-values.md`.

use super::spread::{BASELINE_RELATIVE, FIRST_BASELINE, JUSTIFY, POINTS, SIZING};
use super::*;

/// `KeyboardShortcut` and `ExtendedKeyboardShortcut` of a style, from its
/// stored key (`docs/format/objects.md`, style shortcuts). `None` where the
/// samples do not show the value.
pub(super) fn style_shortcut(
    s: &crate::model::Style,
    platform: Option<u16>,
) -> (Option<String>, Option<String>) {
    let Some((key, low, high)) = s.shortcut else {
        return (None, None);
    };
    if key == 0 {
        return (Some("0 0".into()), Some("0 0 0".into()));
    }
    let ch = key & 0xFFFF;
    let mods = u32::from(low) + 256 * u32::from(high);
    match key >> 16 {
        0xC000 if (0x30..=0x39).contains(&ch) => {
            let d = ch - 0x30;
            // The key code follows the platform of the last session (an
            // edition rule, objects.md, style shortcuts).
            let code = match platform {
                Some(3) => Some(96 + d),
                Some(0) => Some(82 + d + u32::from(d >= 8)),
                _ => None,
            };
            (code.map(|c| format!("{mods} {c}")), Some("0 0 0".into()))
        }
        0x8000 => (Some("0 0".into()), Some(format!("{mods} {ch} 1"))),
        _ => (None, None),
    }
}

pub(super) fn group_paths(doc: &Document) -> std::collections::HashMap<u32, Vec<String>> {
    fn walk(
        doc: &Document,
        g: &StyleGroup,
        path: &[String],
        out: &mut std::collections::HashMap<u32, Vec<String>>,
    ) {
        for &c in &g.children {
            out.insert(c, path.to_vec());
            if let Some(sub) = doc.style_groups.get(&c) {
                let mut p = path.to_vec();
                p.push(sub.name.clone());
                out.insert(c, p.clone());
                walk(doc, sub, &p, out);
            }
        }
    }
    let mut out = std::collections::HashMap::new();
    for g in doc.style_groups.values().filter(|g| g.root.is_some()) {
        walk(doc, g, &[], &mut out);
    }
    out
}

/// Leaves out the list property that IDML does not write on the root
/// paragraph style and on `TextDefault`: an empty `TabList` before DOM 8
/// (attributes.md, root styles and text defaults).
pub(super) fn root_lists(props: &mut Vec<Property>, major: u32) {
    props.retain(|(n, _, v)| {
        let empty = matches!(v, PropValue::List(l) if l.is_empty());
        !(empty && *n == "TabList" && major < 8)
    });
}

impl Writer<'_> {
    /// Observed values of a root style (see `values`) that are not in
    /// `written` (attributes) or `props` (Properties children): attributes,
    /// Properties children and other child elements.
    pub(super) fn root_values(
        &self,
        tag: &str,
        written: &[&str],
        props: &[Property],
    ) -> (Vec<(String, String)>, Vec<Node>, Vec<Node>) {
        let node = values::root_style(tag, self.doc.version.major);
        let attrs = node
            .attrs
            .into_iter()
            .filter(|(k, _)| !written.contains(&k.as_str()))
            .collect();
        let mut extra_props = Vec::new();
        let mut children = Vec::new();
        for c in node.children {
            if c.tag == "Properties" {
                extra_props.extend(
                    c.children
                        .into_iter()
                        .filter(|p| !props.iter().any(|(n, _, _)| *n == p.tag)),
                );
            } else {
                children.push(c);
            }
        }
        (attrs, extra_props, children)
    }

    /// A cell or table style other than the root style.
    pub(super) fn table_style_element(
        &self,
        x: &mut Xml,
        tag: &str,
        s: &crate::model::TableStyle,
        styles: &BTreeMap<u32, crate::model::TableStyle>,
    ) {
        x.start(tag)
            .attr("Self", self.table_style_ref(tag, s))
            .attr("Name", self.table_style_name(s));
        let attrs = if tag == "CellStyle" {
            let mut a = self.cell_attrs(&s.attrs);
            // The IDML schema has no `WritingDirection` on cell styles.
            a.retain(|(n, _)| *n != "WritingDirection");
            a.extend(self.cell_style_edge_attrs(&s.attrs));
            a
        } else {
            self.table_attrs(&s.attrs, true)
        };
        for (k, v) in attrs {
            x.attr(k, v);
        }
        if tag == "TableStyle" {
            self.caption_position(x, &s.attrs);
        }
        // Values every IDML has on these styles (idml-values.md).
        if let Some(n) = values::element(tag, self.doc.version.major) {
            x.attrs_missing(n.attrs.iter());
        }
        if tag == "CellStyle" {
            // A style without its own paragraph style has none, whatever
            // its based-on style has (tables.md).
            match s
                .attrs
                .get(CELL_STYLE_PARAGRAPH_STYLE)
                .and_then(Value::as_u32)
            {
                Some(p) if self.doc.styles.contains_key(&p) => {
                    x.attr("AppliedParagraphStyle", self.style_ref(Some(p), true));
                }
                Some(_) => {}
                None => {
                    x.attr(
                        "AppliedParagraphStyle",
                        "ParagraphStyle/$ID/[No paragraph style]",
                    );
                }
            }
        }
        if let Some(base) = s.based_on.and_then(|b| styles.get(&b)) {
            // A root style is written as a string.
            let prop = if base.builtin && base.based_on.is_none() {
                ("BasedOn", "string", self.table_style_name(base).into())
            } else {
                ("BasedOn", "object", self.table_style_ref(tag, base).into())
            };
            Self::properties(x, &[prop]);
        }
        x.end();
    }

    /// A root cell or table style. The root table style takes the values
    /// of its attribute list, and from DOM 11 its text and graphic cell
    /// values (tables.md).
    pub(super) fn root_table_style(&self, x: &mut Xml, tag: &str, name: &str) {
        let (attrs, props, children) = self.root_values(tag, &[], &[]);
        x.start(tag)
            .attr("Self", format!("{tag}/$ID/{name}"))
            .attr("Name", builtin_key(name));
        for (k, v) in &attrs {
            x.attr(k, v);
        }
        let root = self
            .doc
            .table_styles
            .values()
            .find(|s| s.builtin && s.based_on.is_none() && s.name == name);
        if tag == "TableStyle"
            && let Some(root) = root
        {
            for (k, v) in self.table_attrs(&root.attrs, true) {
                x.attr(k, v);
            }
            self.caption_position(x, &root.attrs);
            if self.doc.version.major >= 11 {
                for &(id, k, kind) in TEXT_CELL_ATTRS.iter().chain(GRAPHIC_CELL_ATTRS) {
                    if let Some(v) = root.attrs.get(id).and_then(|v| self.value_text(kind, v)) {
                        x.attr(k, v);
                    }
                }
            }
        }
        Self::properties_with(x, &[], &props);
        for c in &children {
            c.write(x);
        }
        x.end();
    }

    /// `CaptionPosition` of a table style from DOM 21.5, from its own
    /// attribute 0x1047D only (tables.md, caption position).
    fn caption_position(&self, x: &mut Xml, attrs: &crate::model::Attrs) {
        if self.dom_version() < (21, 5) {
            return;
        }
        let position = match attrs.get(TABLE_STYLE_CAPTION_POSITION) {
            None => "AfterTable",
            Some(Value::Enum(1)) => "BeforeTable",
            Some(_) => return,
        };
        x.attr("CaptionPosition", position);
    }

    /// `CellStyle/...` or `TableStyle/...` reference of a style.
    pub(super) fn table_style_ref(&self, tag: &str, s: &crate::model::TableStyle) -> String {
        format!("{tag}/{}", self_name(&self.table_style_name(s)))
    }

    pub(super) fn table_style_name(&self, s: &crate::model::TableStyle) -> String {
        self.grouped_name(s.uid, &s.name, s.builtin)
    }

    /// The reference for an applied cell style UID; 0 is `[None]`.
    pub(super) fn cell_style_ref(&self, uid: u32) -> Option<String> {
        if uid == 0 {
            return Some("CellStyle/$ID/[None]".into());
        }
        self.doc
            .cell_styles
            .get(&uid)
            .map(|s| self.table_style_ref("CellStyle", s))
    }

    pub(super) fn styles(&self) -> String {
        let doc = self.doc;
        let mut x = Xml::new();
        self.package_root(&mut x, "Styles");
        let root_of = |kind: u32| doc.style_groups.values().find(|g| g.root == Some(kind));
        for paragraph in [false, true] {
            let (group_tag, tag, sub_tag) = if paragraph {
                (
                    "RootParagraphStyleGroup",
                    "ParagraphStyle",
                    "ParagraphStyleGroup",
                )
            } else {
                (
                    "RootCharacterStyleGroup",
                    "CharacterStyle",
                    "CharacterStyleGroup",
                )
            };
            let root = root_of(if paragraph {
                root_kind::PARAGRAPH
            } else {
                root_kind::CHARACTER
            });
            x.start(group_tag).attr(
                "Self",
                root.map_or(group_tag.to_string(), |g| uref(Some(g.uid))),
            );
            let mut written = std::collections::HashSet::new();
            if let Some(root) = root {
                self.style_group_children(&mut x, root, tag, sub_tag, &mut written);
            }
            // Styles not listed in a group (such as a built-in root
            // style). Some documents have two style objects with the same
            // name, which would give two elements with the same `Self`;
            // the first is written.
            let mut refs: std::collections::HashSet<String> = written
                .iter()
                .map(|&u| self.style_ref(Some(u), paragraph))
                .collect();
            for s in doc.styles.values().filter(|s| s.paragraph == paragraph) {
                if !written.contains(&s.uid) && refs.insert(self.style_ref(Some(s.uid), paragraph))
                {
                    self.style_element(&mut x, s, tag);
                }
            }
            x.end();
        }
        self.toc_styles(&mut x);
        for (tag, kind, style, name) in [
            ("RootCellStyleGroup", root_kind::CELL, "CellStyle", "[None]"),
            (
                "RootTableStyleGroup",
                root_kind::TABLE,
                "TableStyle",
                "[No table style]",
            ),
        ] {
            let root = root_of(kind);
            let id = root.map_or(tag.to_string(), |g| uref(Some(g.uid)));
            x.start(tag).attr("Self", id);
            self.root_table_style(&mut x, style, name);
            let styles = if style == "CellStyle" {
                &doc.cell_styles
            } else {
                &doc.table_styles
            };
            // Styles and style groups listed in the root group first, then
            // any other styles; the root style is written above.
            let mut seen = std::collections::HashSet::new();
            if let Some(r) = styles
                .values()
                .find(|s| s.builtin && s.based_on.is_none() && s.name == name)
            {
                seen.insert(self.table_style_ref(style, r));
            }
            if let Some(root) = root {
                self.table_style_group_children(&mut x, root, style, styles, &mut seen);
            }
            for s in styles.values() {
                if seen.insert(self.table_style_ref(style, s)) {
                    self.table_style_element(&mut x, style, s, styles);
                }
            }
            x.end();
        }
        let object_root = root_of(root_kind::OBJECT);
        x.start("RootObjectStyleGroup").attr(
            "Self",
            object_root.map_or("RootObjectStyleGroup".to_string(), |g| uref(Some(g.uid))),
        );
        for os in doc.object_styles.values() {
            let name = self.grouped_name(os.uid, &os.name, os.builtin);
            let root = os.builtin && os.name == "[None]" && os.based_on.is_none();
            let mut node = self.object_style_node(os, root);
            if !root
                && let Some(r) = doc
                    .object_styles
                    .values()
                    .find(|s| Self::is_root_object_style(s))
            {
                let (settings, left_out) = transparency::style_settings(self, os, r);
                // Before the effects categories, as IDML has them.
                let at = node
                    .children
                    .iter()
                    .position(|c| c.tag == "ObjectStyleObjectEffectsCategorySettings")
                    .unwrap_or(node.children.len());
                node.children.splice(at..at, settings);
                for (effect, attr, v) in left_out {
                    self.warnings.borrow_mut().push(format!(
                        "object style {}: {effect} {attr} {v} is outside the IDML range; left out",
                        os.uid
                    ));
                }
            }
            x.start("ObjectStyle")
                .attr("Self", format!("ObjectStyle/{}", self_name(&name)))
                .attr("Name", &name);
            for (k, v) in &node.attrs {
                x.attr(k, v);
            }
            // The values of every object style from DOM 21.2 (objects.md,
            // object style settings).
            if self.dom_version() >= (21, 2) {
                x.attr("EpubAriaLabel", "")
                    .attr("EpubAriaLabelSourceType", "NoneARIALabel");
            }
            let mut props: Vec<Node> = node
                .child("Properties")
                .map_or(Vec::new(), |p| p.children.clone());
            if !root && let Some(base) = os.based_on.and_then(|b| doc.object_styles.get(&b)) {
                // The root "[None]" is written as a string.
                let (ty, text) = if base.builtin && base.name == "[None]" {
                    ("string", builtin_key(&base.name))
                } else {
                    (
                        "object",
                        format!(
                            "ObjectStyle/{}",
                            self_name(&self.grouped_name(base.uid, &base.name, base.builtin))
                        ),
                    )
                };
                props.insert(
                    0,
                    Node {
                        tag: "BasedOn".into(),
                        attrs: vec![("type".into(), ty.into())],
                        text: Some(text),
                        children: Vec::new(),
                    },
                );
            }
            if !props.is_empty() {
                x.start("Properties");
                for p in &props {
                    p.write(&mut x);
                }
                x.end();
            }
            for c in node.children.iter().filter(|c| c.tag != "Properties") {
                c.write(&mut x);
            }
            x.end();
        }
        x.end();
        // The trap presets every IDML has (idml-values.md).
        for n in values::list("TrapPreset", self.doc.version.major) {
            n.write(&mut x);
        }
        x.end();
        x.finish()
    }

    /// Whether swatch `uid` puts ink on the page: a swatch other than
    /// `None` and `Paper`, and not a white process colour (CMYK 0 0 0 0 or
    /// RGB 255 255 255; objects.md, object style overprint).
    pub(super) fn carries_ink(&self, uid: u32) -> bool {
        let Some(r) = self.doc.swatches.get(&uid) else {
            return false;
        };
        if r == "Swatch/None" || r == "Color/Paper" {
            return false;
        }
        use crate::model::color::Space;
        !self.doc.colors.iter().any(|c| {
            c.uid == uid
                && c.model == 0
                && match c.space {
                    Space::Cmyk => c.values.iter().all(|&v| v == 0.0),
                    Space::Rgb => c.values.iter().all(|&v| v == 1.0),
                    _ => false,
                }
        })
    }

    /// Whether the swatch with IDML reference `r` puts ink on the page
    /// (`carries_ink`).
    pub(super) fn reference_carries_ink(&self, r: &str) -> bool {
        self.doc
            .swatches
            .iter()
            .find(|(_, s)| s.as_str() == r)
            .is_some_and(|(&uid, _)| self.carries_ink(uid))
    }

    /// `OverprintFill`, `OverprintStroke` and `OverprintGap` of an object
    /// style or the page item defaults: where the colour carries ink (never
    /// on the root style), and from 21.4 always (objects.md, object style
    /// overprint; preferences.md, page item defaults).
    pub(super) fn overprint_attrs(&self, attrs: &Attrs, root: bool) -> Vec<(&'static str, String)> {
        let mut out = Vec::new();
        for (name, color, tint, overprint) in [
            ("OverprintFill", 0x6E68, 0x6E69, 0x6E6A),
            ("OverprintStroke", 0x6E64, 0x6E66, 0x6E67),
            ("OverprintGap", 0x6E89, 0x6E8A, 0x6E8B),
        ] {
            let Some(v) = attrs.get(overprint).and_then(Value::as_u32) else {
                continue;
            };
            let ink = || {
                let tint = attrs.get(tint).and_then(Value::as_f64);
                attrs
                    .get(color)
                    .and_then(Value::as_u32)
                    .is_some_and(|c| self.carries_ink(c))
                    && tint != Some(0.0)
            };
            if v <= 1 && (self.saved_by((21, 4)) || (!root && ink())) {
                out.push((name, (v == 1).to_string()));
            }
        }
        out
    }

    /// An object style as a values node: the values every exported IDML
    /// has on such a style (`idml-values.md`), with the values read from
    /// the INDD in their place. See `docs/format/objects.md`.
    pub(super) fn object_style_node(&self, os: &crate::model::ObjectStyle, root: bool) -> Node {
        let major = self.doc.version.major;
        let version = (major, self.doc.version.minor);
        let mut node = if root {
            values::root_style("ObjectStyle", major)
        } else {
            values::object_style(major)
        };
        // Every object style has the preferences' baseline frame grid
        // colour (preferences.md, baseline frame grid colour).
        if let Some(c) = self
            .doc
            .prefs
            .baseline_frame_grid_color
            .and_then(frame_grid_color)
            && let Some(b) = node
                .children
                .iter_mut()
                .find(|c| c.tag == "BaselineFrameGridOption")
        {
            set_property(b, c);
        }
        // The export options of the version (idml-values.md), with the
        // style's alternative text and tagging (objects.md, object export
        // options), in place of those of the value files.
        node.children.retain(|c| c.tag != "ObjectExportOption");
        if let Some(e) = export::object_export_option(
            self.doc.version,
            os.export_options.as_ref(),
            None,
            &Default::default(),
            export::Owner::Style,
        ) {
            node.children.insert(0, e);
        }
        // The transform values the style sets, where IDML has the element
        // (objects.md, object style settings).
        let transform: Vec<_> = [
            "TransformAttrX",
            "TransformAttrY",
            "TransformAttrHeight",
            "TransformAttrWidth",
        ]
        .into_iter()
        .zip(os.transform)
        .filter_map(|(name, v)| Some((name, num(v?))))
        .collect();
        if !transform.is_empty() && node.child("TransformAttributeOption").is_some() {
            node.set(&["TransformAttributeOption"], transform);
        }
        // Flex paddings and gaps; without the chunk 12 and 20 (objects.md,
        // object style settings).
        if node.child("FlexLayoutAttributeOption").is_some() {
            let v = os
                .flex_spacing
                .unwrap_or([12.0, 12.0, 12.0, 12.0, 20.0, 20.0]);
            let names = [
                "FlexPaddingTop",
                "FlexPaddingRight",
                "FlexPaddingBottom",
                "FlexPaddingLeft",
                "FlexGapRow",
                "FlexGapColumn",
            ];
            node.set(
                &["FlexLayoutAttributeOption"],
                names.into_iter().zip(v).map(|(n, v)| (n, num(v))).collect(),
            );
        }
        let mut attrs = self.item_attr_values(&os.attrs);
        for (id, name) in [
            (0x551E, "GradientFillAngle"),
            (0x5524, "GradientStrokeAngle"),
        ] {
            if let Some(v) = os.attrs.get(id).and_then(Value::as_f64) {
                attrs.push((name, num(v)));
            }
        }
        if let Some(g) = self.named_grid_ref(os.named_grid) {
            attrs.push(("AppliedNamedGrid", g));
        }
        attrs.extend(self.overprint_attrs(&os.attrs, root));
        for (name, value) in export_flags(os.export.as_ref(), |v| self.saved_by(v), false) {
            attrs.push((name, value.into()));
        }
        match os.paragraph_style {
            // No chunk 0x1B946 is no style too (objects.md, object styles).
            Some(0) | None => attrs.push(("AppliedParagraphStyle", "n".into())),
            Some(p) if self.doc.styles.contains_key(&p) => {
                attrs.push(("AppliedParagraphStyle", self.style_ref(Some(p), true)))
            }
            _ => {}
        }
        // Chunk 0x1B94D; without it, false. The root style has none
        // (objects.md, object style settings).
        // A style without a keyboard shortcut (objects.md, object style
        // settings); other keys are not decoded.
        if !root && os.shortcut_key == Some(0) {
            attrs.push(("KeyboardShortcut", "0 0".into()));
        }
        if !root {
            let on = os.apply_next == Some(1);
            if matches!(os.apply_next, None | Some(0 | 1)) {
                attrs.push(("ApplyNextParagraphStyle", on.to_string()));
            }
        }
        let mut effects = Vec::new();
        // The root `[None]` has no `Enable…` attributes and no effects
        // category settings in IDML (objects.md, object style settings).
        if let Some(on) = os.enabled.as_ref().filter(|_| !root) {
            // Each attribute is true when its category ID is in the list,
            // from the version on which IDML has it. Where several IDs
            // are present or absent together in every sample, the
            // attribute is written only when they agree.
            // See `docs/format/objects.md`, object style settings.
            type Since = (u32, u32);
            const CATEGORIES: &[(&[u32], Since, &[&str])] = &[
                (&[0x1B933], (7, 0), &["EnableFill"]),
                (&[0x1B934], (7, 0), &["EnableStroke"]),
                (
                    &[0x1B935, 0x1B936],
                    (7, 0),
                    &["EnableStrokeAndCornerOptions"],
                ),
                (&[0x1B93E], (7, 0), &["EnableTextFrameGeneralOptions"]),
                (&[0xADC8], (7, 0), &["EnableTextFrameBaselineOptions"]),
                (&[0xADC9], (8, 0), &["EnableTextFrameAutoSizingOptions"]),
                (&[0x1B940], (7, 0), &["EnableStoryOptions"]),
                (&[0x1B960], (7, 0), &["EnableFrameFittingOptions"]),
                (&[0x1B93F], (7, 0), &["EnableParagraphStyle"]),
                (&[0xADCB], (15, 1), &["EnableTextFrameColumnRuleOptions"]),
                (&[0xCA2F], (7, 0), &["EnableAnchoredObjectOptions"]),
                (
                    &[0x1B942, 0x37C8, 0x37C9],
                    (7, 0),
                    &["EnableTextWrapAndOthers"],
                ),
                (&[0xADCA], (12, 0), &["EnableTextFrameFootnoteOptions"]),
                (
                    &[0x6EA1, 0x6EA2, 0x6EA3, 0x6EA4, 0x6EA5, 0x6EA6, 0x6EA7],
                    (13, 0),
                    &["EnableTransformAttributes"],
                ),
                (
                    &[0x1B97A, 0x1B97C, 0x1B97D, 0x1B97E],
                    (9, 0),
                    &[
                        "EnableExportTagging",
                        "EnableObjectExportAltTextOptions",
                        "EnableObjectExportEpubOptions",
                        "EnableObjectExportTaggedPdfOptions",
                    ],
                ),
            ];
            for (ids, since, names) in CATEGORIES {
                let first = on.contains(&ids[0]);
                if version >= *since && ids.iter().all(|i| on.contains(i) == first) {
                    for name in *names {
                        attrs.push((name, first.to_string()));
                    }
                }
            }
            // The effects categories: transparency of the object, and of
            // its fill, stroke and content together.
            effects.push((
                "ObjectStyleObjectEffectsCategorySettings",
                on.contains(&0x1B937),
            ));
            let parts = [0x1B948, 0x1B950, 0x1B958];
            let first = on.contains(&parts[0]);
            if parts.iter().all(|i| on.contains(i) == first) {
                for tag in [
                    "ObjectStyleFillEffectsCategorySettings",
                    "ObjectStyleStrokeEffectsCategorySettings",
                    "ObjectStyleContentEffectsCategorySettings",
                ] {
                    effects.push((tag, first));
                }
            }
        }
        node.set(&[], attrs);
        for (tag, on) in effects {
            node.set(&[tag], vec![("EnableTransparency", on.to_string())]);
        }
        if let Some(fr) = &os.frame {
            let mut tf = Vec::new();
            if let Some(n) = fr.column_count {
                tf.push(("TextColumnCount", n.to_string()));
            }
            if let Some(v) = fr.column_gutter {
                tf.push(("TextColumnGutter", num(v)));
            }
            if let Some(v) = fr.column_fixed_width {
                tf.push(("TextColumnFixedWidth", num(v)));
            }
            // Fields of the text frame settings that use the frame codes
            // (objects.md, object style settings).
            if let Some(v) = fr.vertical_balance_columns {
                tf.push(("VerticalBalanceColumns", v.to_string()));
            }
            if let Some(v) = fr.use_fixed_width {
                tf.push(("UseFixedColumnWidth", v.to_string()));
            }
            if let Some(v) = fr
                .vertical_justification
                .and_then(|c| JUSTIFY.get(c as usize))
            {
                tf.push(("VerticalJustification", v.to_string()));
            }
            if let Some(v) = fr
                .first_baseline_offset
                .and_then(|c| FIRST_BASELINE.get(c as usize))
            {
                tf.push(("FirstBaselineOffset", v.to_string()));
            }
            if major >= 8
                && let Some((ty, point)) = fr.auto_sizing
                && let (Some(ty), Some(point)) =
                    (SIZING.get(ty as usize), POINTS.get(point as usize))
            {
                tf.push(("AutoSizingType", ty.to_string()));
                tf.push(("AutoSizingReferencePoint", point.to_string()));
            }
            if major >= 8
                && let Some(v) = fr.no_line_breaks
            {
                tf.push(("UseNoLineBreaksForAutoSizing", v.to_string()));
            }
            if major >= 8
                && let Some(([use_height, use_width], [height, width])) = fr.minimum_sizes
            {
                tf.push(("UseMinimumHeightForAutoSizing", use_height.to_string()));
                tf.push(("MinimumHeightForAutoSizing", num(height)));
                tf.push(("UseMinimumWidthForAutoSizing", use_width.to_string()));
                tf.push(("MinimumWidthForAutoSizing", num(width)));
            }
            let mut footnote = Vec::new();
            if let Some((span, min, between)) = fr.footnotes
                && span <= 1
            {
                let span = (span == 1).to_string();
                // In `TextFramePreference` from 13.1 (objects.md, object
                // style settings).
                if self.saved_by((13, 1)) {
                    tf.push(("FootnotesSpanAcrossColumns", span.clone()));
                    tf.push(("FootnotesMinimumSpacing", num(min)));
                    tf.push(("FootnotesSpaceBetween", num(between)));
                }
                footnote = vec![
                    ("SpanFootnotesAcross", span),
                    ("MinimumSpacingOption", num(min)),
                    ("SpaceBetweenFootnotes", num(between)),
                ];
            }
            if let Some((width, color, tint)) = fr.column_rule {
                let color = match color {
                    0 => Some("n".to_string()),
                    c => self.doc.swatches.get(&c).cloned(),
                };
                tf.push(("ColumnRuleStrokeWidth", num(width)));
                if let Some(c) = color {
                    tf.push(("ColumnRuleStrokeColor", c));
                }
                tf.push(("ColumnRuleStrokeTint", num(tint)));
            }
            node.set(&["TextFramePreference"], tf);
            // Only the top inset is shown apart from the others; the list is
            // written when all four are equal.
            if let Some([a, b, c, e]) = fr.insets
                && a == b
                && b == c
                && c == e
            {
                let props = node.set(&["TextFramePreference", "Properties"], Vec::new());

                props.children.retain(|c| c.tag != "InsetSpacing");
                props.children.push(Node {
                    tag: "InsetSpacing".into(),
                    attrs: vec![("type".into(), "list".into())],
                    text: None,
                    children: (0..4)
                        .map(|_| Node {
                            tag: "ListItem".into(),
                            attrs: vec![("type".into(), "unit".into())],
                            text: Some(num(a)),
                            children: Vec::new(),
                        })
                        .collect(),
                });
            }
            // The style's baseline frame grid (objects.md, baseline frame
            // grid of text frames); the colour stays the preferences'.
            if let Some(g) = fr.baseline_grid
                && node.child("BaselineFrameGridOption").is_some()
            {
                let mut attrs = vec![
                    ("UseCustomBaselineFrameGrid", g.use_custom.to_string()),
                    ("StartingOffsetForBaselineFrameGrid", num(g.start)),
                ];
                if let Some(r) = BASELINE_RELATIVE
                    .get(g.relative as usize)
                    .copied()
                    .flatten()
                {
                    attrs.push(("BaselineFrameGridRelativeOption", r.to_string()));
                }
                attrs.push(("BaselineFrameGridIncrement", num(g.increment)));
                node.set(&["BaselineFrameGridOption"], attrs);
            }
            if !footnote.is_empty() && node.child("TextFrameFootnoteOptionsObject").is_some() {
                node.set(&["TextFrameFootnoteOptionsObject"], footnote);
            }
        }
        // Every object style has it from 13.1 (idml-values.md, object
        // styles other than the root).
        if self.saved_by((13, 1)) {
            node.merge(&Node {
                tag: "ObjectStyle".into(),
                children: vec![Node {
                    tag: "TextFramePreference".into(),
                    attrs: vec![("FootnotesEnableOverrides".into(), "false".into())],
                    ..Node::default()
                }],
                ..Node::default()
            });
        }
        let mut story = Vec::new();
        if let Some(st) = &os.story {
            match st.frame_type {
                0 => story.push(("FrameType", "Unknown".to_string())),
                1 => story.push(("FrameType", "TextFrameType".to_string())),
                2 => story.push(("FrameType", "FrameGridType".to_string())),
                _ => {}
            }
            match st.orientation {
                0 => story.push(("StoryOrientation", "Unknown".to_string())),
                1 => story.push(("StoryOrientation", "Horizontal".to_string())),
                _ => {}
            }
            story.push(("OpticalMarginSize", num(st.optical_size)));
            match st.optical_alignment {
                0 => story.push(("OpticalMarginAlignment", "false".to_string())),
                1 => story.push(("OpticalMarginAlignment", "true".to_string())),
                _ => {}
            }
        }
        match os.direction {
            Some(1) => story.push(("StoryDirection", "LeftToRightDirection".into())),
            Some(0) | None => story.push(("StoryDirection", "UnknownDirection".into())),
            _ => {}
        }
        node.set(&["StoryPreference"], story);
        // The u16 at 40 of the wrap chunk: 0 for `ApplyToMasterPageOnly`;
        // without the chunk, false (objects.md, object style settings).
        if node.child("TextWrapPreference").is_some() {
            match os.text_wrap.as_ref().map(|w| w.master_flag) {
                Some(1) | None => {
                    node.set(
                        &["TextWrapPreference"],
                        vec![("ApplyToMasterPageOnly", "false".into())],
                    );
                }
                Some(0) => {
                    node.set(
                        &["TextWrapPreference"],
                        vec![("ApplyToMasterPageOnly", "true".into())],
                    );
                }
                _ => {}
            }
        }
        if let Some(mode) = text_wrap_mode(os.text_wrap.as_ref()) {
            node.set(&["TextWrapPreference"], vec![("TextWrapMode", mode.into())]);
            node.set(
                &["TextWrapPreference", "Properties", "TextWrapOffset"],
                text_wrap_offsets(os.text_wrap.as_ref()),
            );
            // A style without chunk 0x3777 has the default contour
            // (objects.md, object style settings).
            let c = os.contour.unwrap_or(Contour::DEFAULT);
            if let Some(t) = contour_type(c.kind) {
                let mut attrs = vec![("ContourType", t.into())];
                if let Some(inside) = c.inside_edges {
                    attrs.push(("IncludeInsideEdges", inside.to_string()));
                }
                attrs.push(("ContourPathName", "$ID/".into()));
                if self.dom_version() >= (21, 4) {
                    attrs.extend(CONTOUR_PARAMS.map(|(k, v)| (k, v.into())));
                }
                node.set(&["TextWrapPreference", "ContourOption"], attrs);
            }
        }
        let all: Vec<u32> = FITTING_ATTRS.iter().map(|(id, ..)| *id).collect();
        node.set(
            &["FrameFittingOption"],
            fitting_attrs(self, &os.fitting, &all),
        );
        if let Some(d) = &os.anchor {
            node.set(&["AnchoredObjectSetting"], anchored_settings(d));
        }
        node
    }

    /// The cell or table styles and style groups of a style group, in
    /// its order. `seen` holds the `Self` of the styles written: some
    /// documents have two style objects with the same name, and the first
    /// is written.
    fn table_style_group_children(
        &self,
        x: &mut Xml,
        g: &StyleGroup,
        tag: &str,
        styles: &BTreeMap<u32, crate::model::TableStyle>,
        seen: &mut std::collections::HashSet<String>,
    ) {
        for &c in &g.children {
            if let Some(sub) = self.doc.style_groups.get(&c) {
                let sub_tag = format!("{tag}Group");
                let name = self.group_name(sub);
                x.start(&sub_tag)
                    .attr("Self", format!("{sub_tag}/$ID/{}", self_name(&name)))
                    .attr("Name", builtin_key(&name));
                self.table_style_group_children(x, sub, tag, styles, seen);
                x.end();
            } else if let Some(s) = styles.get(&c)
                && seen.insert(self.table_style_ref(tag, s))
            {
                self.table_style_element(x, tag, s, styles);
            }
        }
    }

    /// The IDML name of a style group: the names of the groups on its
    /// path and its own (objects.md, style groups).
    fn group_name(&self, g: &StyleGroup) -> String {
        self.group_path.get(&g.uid).map_or_else(
            || style_path([g.name.as_str()]),
            |p| style_path(p.iter().map(String::as_str)),
        )
    }

    pub(super) fn style_group_children(
        &self,
        x: &mut Xml,
        g: &StyleGroup,
        tag: &str,
        sub_tag: &str,
        written: &mut std::collections::HashSet<u32>,
    ) {
        for &c in &g.children {
            if let Some(sub) = self.doc.style_groups.get(&c) {
                let name = self.group_name(sub);
                x.start(sub_tag)
                    .attr("Self", format!("{sub_tag}/$ID/{}", self_name(&name)))
                    .attr("Name", builtin_key(&name));
                self.style_group_children(x, sub, tag, sub_tag, written);
                x.end();
            } else if let Some(s) = self.doc.styles.get(&c) {
                self.style_element(x, s, tag);
                written.insert(c);
            }
        }
    }

    /// Whether the list attribute `id` (nested, line or GREP styles) of a
    /// paragraph style has items: the first style in its based-on chain that
    /// has the attribute decides. An empty list is stored as a 0 count.
    pub(super) fn inherited_list(&self, s: &Style, id: u32) -> bool {
        let mut cur = Some(s);
        for _ in 0..32 {
            let Some(st) = cur else { break };
            if let Some(v) = st.attrs.get(id) {
                return matches!(v, Value::StyleList { count, .. } if *count != 0);
            }
            cur = st.based_on.and_then(|b| self.doc.styles.get(&b));
        }
        false
    }

    pub(super) fn style_element(&self, x: &mut Xml, s: &Style, tag: &str) {
        let doc = self.doc;
        let paragraph = s.paragraph;
        let name = self.grouped_name(s.uid, &s.name, s.builtin);
        let (mut plain, mut props) = self.text_attrs_of(&s.attrs, !paragraph);
        if paragraph {
            // The schema allows KerningValue on character styles only.
            plain.retain(|(k, _)| *k != "KerningValue");
        }
        let is_root = s.builtin && s.based_on.is_none() && s.name.starts_with("[No ");
        if is_root {
            // The root paragraph style has no `NextStyle` and no
            // `AllNestedStyles`, and an empty `TabList` only from DOM 8
            // (attributes.md, root styles and text defaults).
            props.retain(|(n, ..)| *n != "AllNestedStyles");
            root_lists(&mut props, doc.version.major);
        }
        x.start(tag)
            .attr("Self", self.style_ref(Some(s.uid), paragraph))
            .attr("Name", &name);
        if paragraph && !is_root {
            x.attr("NextStyle", self.style_ref(s.next.or(Some(s.uid)), true));
        }
        for (k, v) in &plain {
            x.attr(k, v);
        }
        x.attr("Imported", s.imported.to_string());
        let v = doc.version;
        // From 11.2 every style has a unique ID: the stored GUID, else
        // `$ID/` (objects.md, styles).
        if self.saved_by((11, 2)) {
            x.attr("StyleUniqueId", s.unique_id.as_deref().unwrap_or("$ID/"));
        }
        if paragraph && (v.major >= 10 || (v.major == 8 && v.minor >= 1)) {
            for (id, name) in [
                (0x1B75, "EmptyNestedStyles"),
                (0x1BBB, "EmptyLineStyles"),
                (0x1BBA, "EmptyGrepStyles"),
            ] {
                x.attr(name, (!self.inherited_list(s, id)).to_string());
            }
        }
        for (name, value) in export_flags(s.export.as_ref(), |v| self.saved_by(v), true) {
            x.attr(name, value);
        }
        // Root styles also get the values every exported IDML has on them;
        // values read from the INDD take precedence.
        let mut extra = Vec::new();
        if is_root {
            let written: Vec<&str> = plain.iter().map(|(k, _)| *k).collect();
            let (attrs, more, _) = self.root_values(tag, &written, &props);
            for (k, v) in &attrs {
                if !x.has_attr(k) {
                    x.attr(k, v);
                }
            }
            extra = more;
        } else {
            let (short, extended) = style_shortcut(s, doc.last_session_platform);
            if let Some(k) = short {
                x.attr("KeyboardShortcut", k);
            }
            if v.major >= 15
                && let Some(e) = extended
            {
                x.attr("ExtendedKeyboardShortcut", e);
            }
        }
        if !is_root && let Some(n) = values::element(tag, doc.version.major) {
            // Other styles get the values every IDML has on them.
            x.attrs_missing(n.attrs.iter());
            x.attrs_missing(values::when_written(tag, doc.version.major).iter());
            if let Some(p) = n.child("Properties") {
                extra = p.children.clone();
            }
        }
        // The style's preview colour (objects.md, styles) in place of the
        // observed one; the root styles have none.
        if !is_root && let Some(c) = s.preview_color {
            let node = match c {
                None => Some(Node {
                    tag: "PreviewColor".into(),
                    attrs: vec![("type".into(), "enumeration".into())],
                    text: Some("Nothing".into()),
                    children: Vec::new(),
                }),
                Some(rgb) => ui_color_property("PreviewColor", rgb),
            };
            if let Some(n) = node {
                match extra.iter_mut().find(|e| e.tag == "PreviewColor") {
                    Some(e) => *e = n,
                    None => extra.push(n),
                }
            }
        }
        if let Some(base) = s.based_on.and_then(|b| doc.styles.get(&b)) {
            // The root "[No ... style]" is written as a string.
            let root = base.builtin && base.name.starts_with("[No ");
            if root {
                props.insert(0, ("BasedOn", "string", style_name(base).into()));
            } else {
                props.insert(
                    0,
                    (
                        "BasedOn",
                        "object",
                        self.style_ref(Some(base.uid), paragraph).into(),
                    ),
                );
            }
        }
        Self::properties_with(x, &props, &extra);
        self.export_tag_maps(x, s);
        x.end();
    }

    /// The export tag maps of a paragraph or character style, with the
    /// style's split and CSS flags (`docs/format/objects.md`, styles). Maps
    /// with attributes are left out: none occurs in the corpus.
    fn export_tag_maps(&self, x: &mut Xml, s: &Style) {
        let Some(e) = &s.export else { return };
        let flags = export_flags(Some(e), |v| self.saved_by(v), true);
        let flag = |name: &str| flags.iter().find(|(n, _)| *n == name).map(|(_, v)| *v);
        for m in e.maps.iter().filter(|m| m.attributes.is_empty()) {
            x.start("StyleExportTagMap")
                .attr(
                    "Self",
                    format!("{}StyleExportTagMapn{}", uref(Some(s.uid)), m.export_type),
                )
                .attr("ExportType", &m.export_type)
                .attr("ExportTag", &m.tag)
                .attr("ExportClass", &m.class)
                .attr("ExportAttributes", "");
            for name in ["SplitDocument", "EmitCss"] {
                if let Some(f) = flag(name) {
                    x.attr(name, f);
                }
            }
            x.end();
        }
    }
}

/// `SplitDocument`, `EmitCss` and `IncludeClass` of a paragraph or
/// character style (`text`) or an object style: the first three u16
/// flags of chunk 0x28F0, or `false`, `true`, `true` without the chunk.
/// IDML has `SplitDocument` (text styles only) and `EmitCss` when 10.1
/// saved the document, `IncludeClass` when 13.0 did (`saved_by`;
/// `docs/format/objects.md`, styles).
pub(super) fn export_flags(
    export: Option<&crate::model::StyleExport>,
    saved_by: impl Fn((u32, u32)) -> bool,
    text: bool,
) -> Vec<(&'static str, &'static str)> {
    let flags = match export {
        Some(e) => e.flags.as_slice(),
        None => &[0, 1, 1],
    };
    let since = [(10, 1), (10, 1), (13, 0)];
    ["SplitDocument", "EmitCss", "IncludeClass"]
        .into_iter()
        .zip(since)
        .zip(flags)
        .filter(|((name, since), _)| saved_by(*since) && (text || *name != "SplitDocument"))
        .filter_map(|((name, _), v)| match v {
            0 => Some((name, "false")),
            1 => Some((name, "true")),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::export_flags;
    use crate::model::StyleExport;

    #[test]
    fn export_flags_follow_the_saving_version() {
        let e = StyleExport {
            maps: Vec::new(),
            flags: vec![1, 0, 0, 7],
        };
        let saved = |v: (u32, u32)| move |since: (u32, u32)| v >= since;
        assert!(export_flags(Some(&e), saved((10, 0)), true).is_empty());
        assert_eq!(
            export_flags(Some(&e), saved((12, 0)), true),
            [("SplitDocument", "true"), ("EmitCss", "false")]
        );
        assert_eq!(
            export_flags(Some(&e), saved((13, 0)), false),
            [("EmitCss", "false"), ("IncludeClass", "false")]
        );
        assert_eq!(
            export_flags(None, saved((13, 0)), true),
            [
                ("SplitDocument", "false"),
                ("EmitCss", "true"),
                ("IncludeClass", "true")
            ]
        );
    }
}
