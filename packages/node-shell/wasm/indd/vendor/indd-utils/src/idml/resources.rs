//! `Resources/Graphic.xml` (colours, tints, gradients, inks, stroke styles),
//! `Resources/Fonts.xml` and `Resources/Preferences.xml`.
//!
//! Evidence: `docs/format/objects.md` (swatches), `fonts.md`,
//! `preferences.md` and `idml-values.md`.

use super::*;

/// Preference elements of `Resources/Preferences.xml` that `model::prefs`
/// supplies values for.
pub(super) const PREFERENCE_TAGS: &[&str] = &[
    "ViewPreference",
    "MarginPreference",
    "TextFramePreference",
    "AnchoredObjectSetting",
    "GridPreference",
    "GuidePreference",
    "DocumentPreference",
    "TextPreference",
    "PasteboardPreference",
    "XMLPreference",
    "PrintPreference",
    "PrintBookletPrintPreference",
    "PrintBookletOption",
    "IndexHeaderSetting",
    "ChapterNumberPreference",
    "DictionaryPreference",
    "EPubExportPreference",
    "TransparencyPreference",
    "LayoutAdjustmentPreference",
    "StoryPreference",
    "TextWrapPreference",
    "CjkGridPreference",
    "MojikumiUiPreference",
    "XMLImportPreference",
    "HTMLExportPreference",
    "EPubFixedLayoutExportPreference",
];

/// Preference values that no INDD field holds and nearly every reference
/// IDML has: (element, attribute, value, first DOM version). See
/// `docs/format/idml-values.md`, defaults.
const PREFERENCE_DEFAULTS: &[(&str, &str, &str, (u32, u32))] = &[
    ("PrintPreference", "TilingType", "Auto", (0, 0)),
    ("TextPreference", "HighlightKeeps", "false", (0, 0)),
    (
        "TextPreference",
        "HighlightSubstitutedFonts",
        "true",
        (0, 0),
    ),
    ("ViewPreference", "GuideSnaptoZone", "4", (0, 0)),
    ("ViewPreference", "ShowNotes", "true", (0, 0)),
    ("XMLExportPreference", "ViewAfterExport", "false", (0, 0)),
    (
        "DocumentPreference",
        "SpreadHiddenVisibility",
        "false",
        (20, 0),
    ),
];

/// A tree of preference values as a `Node`.
fn pref_node(n: &crate::model::prefs::PrefNode) -> Node {
    Node {
        tag: n.tag.to_string(),
        attrs: n
            .attrs
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect(),
        text: None,
        children: n.children.iter().map(pref_node).collect(),
    }
}

impl Writer<'_> {
    /// `SwatchColorGroupReference` of each swatch in a colour group: the
    /// `ColorGroupSwatch` that names it. See `docs/format/objects.md`.
    pub(super) fn group_swatches(&self) -> std::collections::HashMap<String, String> {
        let mut out = std::collections::HashMap::new();
        for g in &self.doc.color_groups {
            for (n, s) in g.swatches.iter().enumerate() {
                if let Some(r) = self.doc.swatches.get(s) {
                    out.entry(r.clone())
                        .or_insert_with(|| format!("{}ColorGroupSwatch{n:x}", uref(Some(g.uid))));
                }
            }
        }
        out
    }

    /// `Resources/Graphic.xml`. `refs` are the references to unnamed
    /// colours and gradients in the other parts of the package: IDML
    /// writes an unnamed colour or gradient only when something refers to
    /// it or the page item defaults name it (`docs/format/objects.md`,
    /// colours).
    pub(super) fn graphic(&self, refs: &std::collections::HashSet<String>) -> String {
        use crate::model::color::class;
        let mut x = Xml::new();
        self.package_root(&mut x, "Graphic");
        let groups = self.group_swatches();
        let named = |class_id: u32| -> std::collections::HashSet<u32> {
            let prefs = &self.doc.prefs;
            prefs
                .item_default_entries
                .iter()
                .filter(|e| e.0 == class_id)
                .flat_map(|e| [e.1, e.2])
                .chain(
                    prefs
                        .item_default_swatches
                        .iter()
                        .filter(|e| e.0 == class_id)
                        .map(|e| e.1),
                )
                .collect()
        };
        let gradients: Vec<_> = {
            let named = named(class::GRADIENT);
            self.doc
                .gradients
                .iter()
                .filter(|g| {
                    !g.name.is_empty() || named.contains(&g.uid) || refs.contains(&g.reference())
                })
                .collect()
        };
        // Colours that the stops of any gradient, written or not, and the
        // tints refer to.
        let mut used: std::collections::HashSet<u32> = named(class::COLOR);
        used.extend(
            self.doc
                .gradients
                .iter()
                .flat_map(|g| g.stops.iter().map(|s| s.color)),
        );
        used.extend(self.doc.tints.iter().map(|(t, ..)| t.base));
        let colors = self.doc.colors.iter().filter(|c| {
            !c.name.is_empty() || used.contains(&c.uid) || refs.contains(&c.reference())
        });
        // IDML names the colour group swatch of every swatch from DOM 12
        // on (`n` for none).
        let group_ref = |x: &mut Xml, reference: &str| {
            if self.doc.version.major >= 12 {
                x.attr(
                    "SwatchColorGroupReference",
                    groups.get(reference).map_or("n", String::as_str),
                );
            }
        };
        for c in colors {
            let name = c.idml_name();
            let mut attrs = vec![("Self", c.reference())];
            if let Some(model) = c.model_name() {
                attrs.push(("Model", model.into()));
            }
            attrs.extend([
                ("Space", c.space_name().into()),
                ("ColorValue", nums(&c.idml_values())),
                ("ColorOverride", c.override_name().into()),
            ]);
            // Values that follow the model (idml-values.md, keyed values).
            let keyed: Vec<(String, String)> = c
                .model_name()
                .and_then(|m| values::keyed("Color", m))
                .map(|n| n.attrs.into_iter().filter(|(k, _)| k != "Model").collect())
                .unwrap_or_default();
            let mut attrs: Vec<(String, String)> = attrs
                .into_iter()
                .map(|(k, v)| (k.to_string(), v))
                .chain(keyed)
                .collect();
            attrs.extend([
                ("Name".to_string(), name),
                ("ColorEditable".to_string(), c.editable.to_string()),
                ("ColorRemovable".to_string(), c.removable.to_string()),
                ("Visible".to_string(), c.visible.to_string()),
            ]);
            if let Some((space, values)) = c.idml_alternate() {
                attrs.push(("AlternateSpace".to_string(), space.into()));
                attrs.push(("AlternateColorValue".to_string(), nums(&values)));
            }
            if let Some(id) = c.creator {
                attrs.push(("SwatchCreatorID".to_string(), id.to_string()));
            }
            if self.doc.version.major >= 16 {
                let hsb = c.space == crate::model::color::Space::Hsb;
                attrs.push(("ConvertToHsb".to_string(), hsb.to_string()));
            }
            x.start("Color");
            for (k, v) in &attrs {
                x.attr(k, v);
            }
            group_ref(&mut x, &c.reference());
            x.end();
        }
        // The schema puts inks after the colours.
        for i in &self.doc.inks {
            let mut attrs = vec![
                ("Self", format!("Ink/{}", self_name(&i.name.idml()))),
                ("Name", i.name.idml()),
                ("Angle", num(i.angle)),
            ];
            if let Some(c) = i.convert_to_process {
                attrs.push(("ConvertToProcess", c.to_string()));
            }
            attrs.push(("Frequency", num(i.frequency)));
            if let Some(d) = i.neutral_density {
                attrs.push(("NeutralDensity", num(d)));
            }
            attrs.push(("TrapOrder", i.trap_order.to_string()));
            x.start("Ink");
            for (k, v) in &attrs {
                x.attr(k, v);
            }
            // The values every IDML has on an ink (idml-values.md).
            x.attrs_missing(self.observed("Ink").iter());
            x.end();
        }
        // Mixed ink groups, then mixed inks sorted by name in code point
        // order (objects.md, mixed inks).
        let mut mixed: Vec<_> = self.doc.mixed_inks.iter().collect();
        mixed.sort_by(|a, b| (!a.group, &a.name).cmp(&(!b.group, &b.name)));
        let list = |items: Vec<String>| items.join(" ");
        for m in mixed {
            let source = m
                .base
                .and_then(|g| self.doc.mixed_inks.iter().find(|n| n.uid == g))
                .unwrap_or(m);
            let inks: Vec<&crate::model::Ink> = source
                .inks
                .iter()
                .filter_map(|u| self.doc.inks.iter().find(|i| i.uid == *u))
                .collect();
            let spots: Vec<&crate::model::Color> = source
                .spots
                .iter()
                .filter_map(|u| self.doc.colors.iter().find(|c| c.uid == *u))
                .collect();
            if inks.len() != source.inks.len() || spots.len() != source.spots.len() {
                continue;
            }
            let reference = m.reference();
            x.start(if m.group { "MixedInkGroup" } else { "MixedInk" })
                .attr("Self", &reference)
                .attr("Model", "Mixedinkmodel");
            if !m.group {
                x.attr("Space", "MixedInk");
            }
            x.attr(
                "InkList",
                list(
                    inks.iter()
                        .map(|i| format!("Ink/{}", self_name(&i.name.idml()).replace(' ', "%20")))
                        .collect(),
                ),
            );
            if !m.group {
                x.attr(
                    "InkPercentages",
                    list(
                        m.percentages
                            .iter()
                            .map(|p| format!("{}", p * 100.0))
                            .collect(),
                    ),
                );
                let base = m
                    .base
                    .and_then(|g| self.doc.swatches.get(&g).cloned())
                    .unwrap_or_else(|| "n".into());
                x.attr("BaseColor", base);
            }
            x.attr(
                "InkNameList",
                list(
                    inks.iter()
                        .map(|i| i.name.idml().replace(' ', "%20"))
                        .collect(),
                ),
            )
            .attr(
                "MixedInkSpotColorNameList",
                list(
                    spots
                        .iter()
                        .map(|c| c.idml_name().replace(' ', "%20"))
                        .collect(),
                ),
            )
            .attr(
                "MixedInkSpotColorList",
                list(
                    spots
                        .iter()
                        .map(|c| c.reference().replace(' ', "%20"))
                        .collect(),
                ),
            )
            .attr("Name", &m.name)
            .attr("ColorEditable", m.editable.to_string())
            .attr("ColorRemovable", m.removable.to_string())
            .attr("Visible", m.visible.to_string());
            if let Some(id) = m.creator {
                x.attr("SwatchCreatorID", id.to_string());
            }
            group_ref(&mut x, &reference);
            x.end();
        }
        // The pasted smooth shades, in UID order: the document's constant
        // shade, and each axial shade that something refers to or the
        // page item defaults name. Each has the values every IDML has on
        // one of its kind (idml-values.md); its contents are the stored
        // fields in big-endian order (objects.md, pasted smooth shades).
        let named_shades = named(crate::model::class::SMOOTH_SHADE);
        // UID, contents type, matrix, contents, name.
        type Shade<'s> = (
            u32,
            &'s str,
            Option<&'s [f64; 6]>,
            Vec<u8>,
            &'s Option<(bool, String)>,
        );
        let mut shades: Vec<Shade> = Vec::new();
        if let Some(shade) = &self.doc.constant_shade {
            let mut data = shade.count.to_be_bytes().to_vec();
            for v in shade.values {
                data.extend(v.to_be_bytes());
            }
            shades.push((shade.uid, "ConstantShade", None, data, &shade.name));
        }
        for a in &self.doc.axial_shades {
            let reference = format!("PastedSmoothShade/{}", uref(Some(a.uid)));
            if refs.contains(&reference) || named_shades.contains(&a.uid) {
                shades.push((
                    a.uid,
                    "AxialShade",
                    Some(&a.matrix),
                    a.data.clone(),
                    &a.name,
                ));
            }
        }
        shades.sort_by_key(|s| s.0);
        for (uid, kind, matrix, data, name) in shades {
            let Some(node) = values::keyed("PastedSmoothShade", kind) else {
                continue;
            };
            let reference = format!("PastedSmoothShade/{}", uref(Some(uid)));
            x.start("PastedSmoothShade")
                .attr("Self", &reference)
                .attr("ContentsType", kind);
            if let Some(m) = matrix {
                x.attr("ContentsMatrix", nums(m));
            }
            if let Some((builtin, name)) = name {
                let name = if *builtin {
                    builtin_key(name)
                } else {
                    name.clone()
                };
                x.attr("Name", name);
            }
            x.attrs_missing(node.attrs.iter());
            group_ref(&mut x, &reference);
            x.start("Properties")
                .start("Contents")
                .cdata(&base64_lines(&data), CDATA_SECTION)
                .end()
                .end();
            x.end();
        }
        for (t, reference, name) in &self.doc.tints {
            let base = self.doc.swatches.get(&t.base).cloned().unwrap_or_default();
            x.start("Tint")
                .attr("Self", reference)
                .attr("TintValue", num(t.value))
                .attr("BaseColor", base)
                .attr("Name", name)
                .attr("ColorOverride", t.override_name());
            // The alternate colour of the base colour (objects.md, tints).
            if let Some((space, values)) = self
                .doc
                .colors
                .iter()
                .find(|c| c.uid == t.base)
                .and_then(|c| c.idml_alternate())
            {
                x.attr("AlternateSpace", space)
                    .attr("AlternateColorValue", nums(&values));
            }
            group_ref(&mut x, reference);
            x.attrs_missing(self.observed("Tint").iter());
            x.end();
        }
        x.start("Swatch")
            .attr("Self", "Swatch/None")
            .attr("Name", "None")
            .attr("ColorEditable", "false")
            .attr("ColorRemovable", "false")
            .attr("Visible", "true");
        group_ref(&mut x, "Swatch/None");
        x.attrs_missing(self.observed("Swatch").iter());
        x.end();
        // The schema requires gradients after the swatches.
        for g in gradients {
            x.start("Gradient")
                .attr("Self", g.reference())
                .attr("Type", if g.kind == 2 { "Radial" } else { "Linear" })
                .attr("Name", g.idml_name())
                .attr("ColorEditable", g.editable.to_string())
                .attr("ColorRemovable", g.removable.to_string())
                .attr("Visible", g.visible.to_string());
            group_ref(&mut x, &g.reference());
            x.attrs_missing(self.observed("Gradient").iter());
            for (i, stop) in g.stops.iter().enumerate() {
                let color = self
                    .doc
                    .swatches
                    .get(&stop.color)
                    .cloned()
                    .unwrap_or_else(|| "Color/Black".into());
                x.start("GradientStop")
                    .attr("Self", format!("{}GradientStop{i}", uref(Some(g.uid))))
                    .attr("StopColor", color)
                    .attr("Location", num(round(stop.location * 100.0)));
                if let Some(m) = g.idml_midpoint(i) {
                    x.attr("Midpoint", num(m));
                }
                x.end();
            }
            x.end();
        }
        for name in BUILTIN_STROKE_STYLES {
            x.empty(
                "StrokeStyle",
                &[
                    ("Self", format!("StrokeStyle/$ID/{name}")),
                    ("Name", builtin_key(name)),
                ],
            );
        }
        // Custom stroke styles, in UID order (attributes.md, custom
        // stroke styles).
        for st in &self.doc.stroke_styles {
            if st.dashed {
                x.start("DashedStrokeStyle")
                    .attr("Self", custom_stroke_ref(st))
                    .attr("DashArray", nums(&st.values));
                if st.corner == 3 {
                    x.attr("StrokeCornerAdjustment", "DashesAndGaps");
                }
                if let Some(cap) = end_cap(st.cap) {
                    x.attr("EndCap", cap);
                }
            } else {
                let stripes: Vec<f64> = st.values.iter().map(|v| v * 100.0).collect();
                x.start("StripedStrokeStyle")
                    .attr("Self", custom_stroke_ref(st))
                    .attr("StripeArray", nums(&stripes));
            }
            x.attr("Name", &st.name).end();
        }
        x.end();
        x.finish()
    }

    /// Font families and their fonts. See docs/format/fonts.md.
    pub(super) fn fonts(&self) -> String {
        let mut x = Xml::new();
        self.package_root(&mut x, "Fonts");
        // InDesign 7.0 up to build 522 writes every PostScript name as a
        // built-in key; builds 535 and later do not (fonts.md).
        let postscript_key = self.doc.last_session_version == Some((7, 0))
            && self.doc.last_session_build.is_some_and(|b| b <= 522);
        for f in self.doc.fonts.values() {
            let id = format!("di{:x}", f.uid);
            let (family, base) = self.family_names(f);
            x.start("FontFamily")
                .attr("Self", &id)
                .attr("Name", &family);
            // From DOM 21 a font's `Name` drops the spaces that end its
            // family's name; its `Self` keeps them (fonts.md).
            let named = if self.doc.version.major >= 21 {
                family.trim_end()
            } else {
                family.as_str()
            };
            for font in &f.fonts {
                // A font with an empty style name is named `Regular`, and
                // its `Self` has the family name alone (fonts.md).
                let (name, key) = if font.style.is_empty() {
                    (format!("{named} Regular"), base.clone())
                } else {
                    (
                        format!("{named} {}", font.style),
                        format!("{base} {}", font.style),
                    )
                };
                let style = if font.style_builtin {
                    builtin_key(&font.style)
                } else {
                    font.style.clone()
                };
                x.start("Font")
                    .attr("Self", format!("{id}Fontn{key}"))
                    .attr("FontFamily", &base)
                    .attr("Name", &name)
                    .attr(
                        "PostScriptName",
                        if postscript_key && !font.postscript_name.is_empty() {
                            builtin_key(&font.postscript_name)
                        } else {
                            font.postscript_name.clone()
                        },
                    )
                    .attr("FontStyleName", &style);
                if let Some(t) = font.type_name() {
                    x.attr("FontType", t);
                }
                // The schema's `xsd:int`; one file stores 0xFFFFFFFF (fonts.md).
                if let Ok(w) = i32::try_from(f.writing_script) {
                    x.attr("WritingScript", w.to_string());
                }
                x.attr("FullName", &font.full_name)
                    .attr("FullNameNative", &font.full_name_native)
                    .attr("FontStyleNameNative", &font.style_native)
                    // `$ID/` in every Font of the corpus IDML files but
                    // those of missing fonts (idml-values.md).
                    .attr(
                        "PlatformName",
                        font.platform_name.as_deref().unwrap_or("$ID/"),
                    )
                    .attr("Version", &font.version);
                // IDML from InDesign before 9.2 has no TypekitID (fonts.md).
                let v = &self.doc.version;
                if (v.major, v.minor) >= (9, 2) {
                    x.attr("TypekitID", font.typekit_id.idml());
                }
                x.end();
            }
            x.end();
        }
        // Composite fonts in UID order (fonts.md, composite fonts).
        let mut fonts: Vec<_> = self.doc.composite_fonts.iter().collect();
        fonts.sort_by_key(|c| c.uid);
        for cf in fonts {
            let name = cf.name.idml();
            x.start("CompositeFont")
                .attr("Self", format!("CompositeFont/{}", self_name(&name)))
                .attr("Name", &name);
            for (k, e) in cf.entries.iter().enumerate() {
                let [size, shift, horizontal, vertical] = e.numbers;
                x.start("CompositeFontEntry")
                    .attr("Self", uref(Some(e.uid)))
                    .attr("Name", e.name.idml())
                    .attr("FontStyle", e.font_style.idml())
                    .attr("RelativeSize", num(size))
                    .attr("HorizontalScale", num(horizontal))
                    .attr("VerticalScale", num(vertical));
                // The first entry is the base font, without characters.
                if k > 0 {
                    x.attr("CustomCharacters", e.characters());
                }
                match e.locked {
                    0 => {
                        x.attr("Locked", "false");
                    }
                    1 => {
                        x.attr("Locked", "true");
                    }
                    _ => {}
                }
                match e.scale {
                    [1, 1, 1, 1] => {
                        x.attr("ScaleOption", "true");
                    }
                    [0, 0, 0, 0] => {
                        x.attr("ScaleOption", "false");
                    }
                    _ => {}
                }
                x.attr("BaselineShift", num(shift));
                if let Some(f) = self.doc.fonts.get(&e.font_family) {
                    Self::properties(
                        &mut x,
                        &[("AppliedFont", "string", self.family_names(f).0.into())],
                    );
                }
                x.end();
            }
            x.end();
        }
        x.end();
        x.finish()
    }

    /// `FootnoteOption` from chunk 0x2820 (footnotes.md). The values
    /// that never vary come from the generated value files.
    fn footnote_option(&self) -> Node {
        let major = self.doc.version.major;
        let mut n = Node {
            tag: "FootnoteOption".into(),
            ..Node::default()
        };
        let attr = |n: &mut Node, k: &str, v: String| n.attrs.push((k.to_string(), v));
        let Some(f) = &self.doc.prefs.footnotes else {
            // Without the chunk every IDML has these values (footnotes.md,
            // footnote options).
            if major >= 12 {
                attr(&mut n, "EnableStraddling", "true".into());
            }
            attr(&mut n, "FootnoteTextStyle", self.style_ref(None, true));
            for (k, v) in [
                ("StartAt", "1"),
                ("Prefix", ""),
                ("Suffix", ""),
                (
                    "FootnoteMarkerStyle",
                    "CharacterStyle/$ID/[No character style]",
                ),
                ("SeparatorText", "\t"),
                ("SpaceBetween", "0"),
                ("Spacer", "0"),
                ("FootnoteMinimumFirstBaselineOffset", "0"),
                ("EosPlacement", "false"),
                ("NoSplitting", "false"),
            ] {
                attr(&mut n, k, v.into());
            }
            for prefix in ["Rule", "ContinuingRule"] {
                for (k, v) in [
                    ("On", "true"),
                    ("LineWeight", "1"),
                    ("Tint", "100"),
                    ("GapTint", "100"),
                    ("LeftIndent", "0"),
                    ("Width", if prefix == "Rule" { "72" } else { "288" }),
                    ("Offset", "0"),
                ] {
                    attr(&mut n, &format!("{prefix}{k}"), v.into());
                }
            }
            let text_prop = |name: String, ty: &str, text: &str| Node {
                tag: name,
                attrs: vec![("type".into(), ty.into())],
                text: Some(text.into()),
                ..Node::default()
            };
            let mut props: Vec<Node> = [
                ("FootnoteNumberingStyle", "Arabic"),
                ("RestartNumbering", "DontRestart"),
                ("ShowPrefixSuffix", "NoPrefixSuffix"),
                ("MarkerPositioning", "SuperscriptMarker"),
            ]
            .into_iter()
            .map(|(k, v)| text_prop(k.into(), "enumeration", v))
            .collect();
            for prefix in ["Rule", "ContinuingRule"] {
                for (k, v) in [
                    ("Type", "StrokeStyle/$ID/Solid"),
                    ("Color", "Color/Black"),
                    ("GapColor", "Swatch/None"),
                ] {
                    props.push(text_prop(format!("{prefix}{k}"), "object", v));
                }
            }
            n.children.push(Node {
                tag: "Properties".into(),
                children: props,
                ..Node::default()
            });
            return n;
        };
        let bool_text = |b: bool| b.to_string();
        if major >= 12
            && let Some(s) = f.tail.as_ref().and_then(|t| t.straddling)
        {
            attr(&mut n, "EnableStraddling", bool_text(s));
        }
        attr(&mut n, "StartAt", f.start_at.to_string());
        attr(&mut n, "Prefix", f.prefix.clone());
        attr(&mut n, "Suffix", f.suffix.clone());
        attr(
            &mut n,
            "FootnoteTextStyle",
            self.style_ref(Some(f.text_style), true),
        );
        attr(
            &mut n,
            "FootnoteMarkerStyle",
            self.style_ref(Some(f.marker_style), false),
        );
        attr(&mut n, "SeparatorText", f.separator.clone());
        attr(&mut n, "SpaceBetween", num(f.space_between));
        attr(&mut n, "Spacer", num(f.spacer));
        if let Some(t) = &f.tail {
            attr(
                &mut n,
                "FootnoteMinimumFirstBaselineOffset",
                num(t.minimum_first_baseline),
            );
        }
        match f.eos_placement {
            0 => attr(&mut n, "EosPlacement", "false".into()),
            1 => attr(&mut n, "EosPlacement", "true".into()),
            _ => {}
        }
        let mut props: Vec<Node> = Vec::new();
        let mut prop = |name: &str, ty: &str, text: String| {
            props.push(Node {
                tag: name.to_string(),
                attrs: vec![("type".into(), ty.into())],
                text: Some(text),
                ..Node::default()
            })
        };
        let numbering = match f.numbering {
            0xCA07 => Some("Arabic"),
            0xCA0A => Some("Symbols"),
            0xCA58 => Some("Asterisks"),
            _ => None,
        };
        if let Some(v) = numbering {
            prop("FootnoteNumberingStyle", "enumeration", v.into());
        }
        let restart = match f.restart {
            0 => Some("DontRestart"),
            1 => Some("PageRestart"),
            _ => None,
        };
        if let Some(v) = restart {
            prop("RestartNumbering", "enumeration", v.into());
        }
        let prefix_suffix = match f.prefix_suffix {
            0 => Some("NoPrefixSuffix"),
            1 => Some("PrefixSuffixReference"),
            3 => Some("PrefixSuffixBoth"),
            _ => None,
        };
        if let Some(v) = prefix_suffix {
            prop("ShowPrefixSuffix", "enumeration", v.into());
        }
        let marker = match f.marker {
            (1, 0) => Some("SuperscriptMarker"),
            (0, 0) => Some("NormalMarker"),
            (0, 1) => Some("RubyMarker"),
            _ => None,
        };
        if let Some(v) = marker {
            prop("MarkerPositioning", "enumeration", v.into());
        }
        if let Some(t) = &f.tail {
            attr(&mut n, "NoSplitting", bool_text(t.no_splitting));
            for (r, name) in t.rules.iter().zip(["Rule", "ContinuingRule"]) {
                attr(&mut n, &format!("{name}On"), bool_text(r.on));
                attr(&mut n, &format!("{name}LineWeight"), num(r.weight));
                attr(&mut n, &format!("{name}Tint"), num(r.tint));
                attr(&mut n, &format!("{name}GapTint"), num(r.gap_tint));
                attr(&mut n, &format!("{name}LeftIndent"), num(r.left_indent));
                attr(&mut n, &format!("{name}Width"), num(r.width));
                attr(&mut n, &format!("{name}Offset"), num(r.offset));
                if let Some((_, s)) = STROKE_TYPES.iter().find(|(k, _)| *k == r.stroke) {
                    prop(
                        &format!("{name}Type"),
                        "object",
                        format!("StrokeStyle/$ID/{s}"),
                    );
                }
                for (uid, suffix) in [(r.color, "Color"), (r.gap_color, "GapColor")] {
                    if let Some(sw) = self.doc.swatches.get(&uid) {
                        prop(&format!("{name}{suffix}"), "object", sw.clone());
                    }
                }
            }
        }
        if !props.is_empty() {
            n.children.push(Node {
                tag: "Properties".into(),
                children: props,
                ..Node::default()
            });
        }
        n
    }

    /// The attributes of `IndexOptions` (`docs/format/preferences.md`,
    /// index options). A style is named by its name alone, among the
    /// styles outside style groups; without such a style, IDML names the
    /// root style.
    fn index_options(&self, o: &crate::model::prefs::IndexOptions) -> Vec<(&'static str, String)> {
        let style = |name: &str, paragraph: bool| match self.doc.styles.values().find(|s| {
            s.paragraph == paragraph
                && s.name == name
                && self.group_path.get(&s.uid).is_none_or(|p| p.is_empty())
        }) {
            Some(s) => self.style_ref(Some(s.uid), paragraph),
            None if paragraph => "ParagraphStyle/$ID/[No paragraph style]".into(),
            None => "CharacterStyle/$ID/[No character style]".into(),
        };
        let mut out = vec![
            ("Title", o.title.clone()),
            ("TitleStyle", style(&o.title_style, true)),
            ("ReplaceExistingIndex", o.replace_existing.to_string()),
            ("IncludeBookDocuments", o.include_book_documents.to_string()),
            (
                "IncludeSectionHeadings",
                o.include_section_headings.to_string(),
            ),
        ];
        for (name, text) in [
            "FollowingTopicSeparator",
            "BetweenPageNumbersSeparator",
            "BetweenEntriesSeparator",
            "BeforeCrossReferenceSeparator",
            "PageRangeSeparator",
            "EntryEndSeparator",
        ]
        .into_iter()
        .zip(&o.separators)
        {
            // IDML writes the en dash of the page range as `^=`.
            let text = if name == "PageRangeSeparator" {
                text.replace('\u{2013}', "^=")
            } else {
                text.clone()
            };
            out.push((name, text));
        }
        for (i, (name, s)) in [
            "Level1Style",
            "Level2Style",
            "Level3Style",
            "Level4Style",
            "SectionHeadingStyle",
            "PageNumberStyle",
            "CrossReferenceStyle",
            "CrossReferenceTopicStyle",
        ]
        .into_iter()
        .zip(&o.styles)
        .enumerate()
        {
            out.push((name, style(s, i < 5)));
        }
        out
    }

    /// The index title, where one is known, and the separator between
    /// entries of a document without index options. Both follow the
    /// edition that made the document (preferences.md, index options).
    fn index_title(&self) -> Option<(Option<&'static str>, &'static str)> {
        // The title follows the edition that saved the document, where
        // its black name shows it (objects.md, saving edition).
        let saved = self.saving_edition().and_then(|e| {
            Some(match e {
                Edition::English | Edition::German | Edition::French | Edition::Dutch => "Index",
                Edition::Korean => "색인",
                Edition::Japanese | Edition::Chinese => "索引",
                Edition::Italian => "Indice",
                Edition::Czech => "Rejstřík",
                Edition::Portuguese => "Índice",
                Edition::Russian => "Указатель",
                Edition::Other => return None,
            })
        });
        let edition = match self.edition() {
            Some(e) => e,
            None => {
                let e = self.saving_edition()?;
                let separator = if e == Edition::Japanese { "、" } else { "; " };
                return Some((saved, separator));
            }
        };
        let (title, separator) = self.assigned_index_title(edition);
        Some((saved.or(title), separator))
    }

    /// The index title and separator by the edition of the assignment
    /// name (preferences.md, index options).
    fn assigned_index_title(&self, edition: Edition) -> (Option<&'static str>, &'static str) {
        let japanese_session = self.japanese_session() == Some(true);
        match edition {
            Edition::Japanese => (Some("索引"), "、"),
            Edition::Chinese => (Some("索引"), "; "),
            Edition::Korean => (Some("색인"), "; "),
            Edition::English if japanese_session => (None, "; "),
            Edition::English | Edition::French | Edition::German | Edition::Dutch => {
                (Some("Index"), "; ")
            }
            Edition::Italian => (Some("Indice"), "; "),
            _ => (None, "; "),
        }
    }

    pub(super) fn preferences(&self) -> String {
        let mut x = Xml::new();
        self.package_root(&mut x, "Preferences");
        // Values every exported IDML has (docs/format/idml-values.md);
        // values read from the INDD take precedence.
        let mut nodes = values::preferences(self.doc.version.major);
        // DOM 7 IDML has no EPUB and HTML export preferences
        // (idml-values.md, preferences).
        if self.doc.version.major < 8 {
            nodes.retain(|n| {
                !matches!(
                    n.tag.as_str(),
                    "EPubExportPreference" | "HTMLExportPreference"
                )
            });
        }
        // Values every IDML of the version has in the larger corpus, where
        // the file above has none.
        for n in &mut nodes {
            if let Some(e) =
                values::element(&format!("Preferences/{}", n.tag), self.doc.version.major)
            {
                n.merge(&e);
            }
        }
        // Object styles named by the page item defaults must be in the
        // package.
        let styles: std::collections::HashSet<String> = self
            .doc
            .object_styles
            .keys()
            .filter_map(|&u| self.object_style_ref(u))
            .collect();
        for n in nodes.iter_mut().filter(|n| n.tag == "PageItemDefault") {
            n.attrs
                .retain(|(k, v)| !k.ends_with("ObjectStyle") || styles.contains(v));
        }
        // Observed values the INDD contradicts but the converter cannot
        // replace: (element, attribute).
        let mut drop: Vec<(&str, &str)> = Vec::new();
        let mut set = |tag: &str, ours: Vec<(&str, String)>| {
            let i = match nodes.iter().position(|n| n.tag == tag) {
                Some(i) => i,
                None => {
                    nodes.push(Node {
                        tag: tag.to_string(),
                        ..Node::default()
                    });
                    nodes.len() - 1
                }
            };
            let node = &mut nodes[i];
            node.attrs
                .retain(|(k, _)| !ours.iter().any(|(o, _)| o == k));
            let rest = std::mem::take(&mut node.attrs);
            node.attrs = ours.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
            node.attrs.extend(rest);
        };
        if let Some(p) = &self.doc.preferences {
            const INTENT: [&str; 3] = ["PrintIntent", "WebIntent", "MobileIntent"];
            let [top, bottom, inside, outside] = p.bleed;
            let mut ours = vec![
                ("PageHeight", num(p.page_height)),
                ("PageWidth", num(p.page_width)),
                ("FacingPages", p.facing_pages.to_string()),
                ("DocumentBleedTopOffset", num(top)),
                ("DocumentBleedBottomOffset", num(bottom)),
                ("DocumentBleedInsideOrLeftOffset", num(inside)),
                ("DocumentBleedOutsideOrRightOffset", num(outside)),
            ];
            if let Some(i) = INTENT.get(p.intent as usize) {
                ours.push(("Intent", i.to_string()));
            }
            // Every sample's IDML has `LeftToRight`; a code the samples do
            // not show leaves the attribute out.
            match p.page_binding {
                0 => ours.push(("PageBinding", "LeftToRight".into())),
                1 => ours.push(("PageBinding", "RightToLeft".into())),
                _ => drop.push(("DocumentPreference", "PageBinding")),
            }
            set("DocumentPreference", ours);
        }
        // Guide locations are measured from the ruler origin (see `guide`).
        set(
            "ViewPreference",
            vec![("RulerOrigin", self.doc.prefs.ruler_origin.idml().into())],
        );
        // Values read from the preferences object (`model::prefs`).
        let prefs = &self.doc.prefs;
        let mut ours: Vec<Node> = Vec::new();
        fn ours_of(ours: &mut Vec<Node>, tag: &str) -> usize {
            match ours.iter().position(|n| n.tag == tag) {
                Some(i) => i,
                None => {
                    ours.push(Node {
                        tag: tag.to_string(),
                        ..Node::default()
                    });
                    ours.len() - 1
                }
            }
        }
        for v in prefs
            .values
            .iter()
            .filter(|v| PREFERENCE_TAGS.contains(&v.element))
        {
            let i = ours_of(&mut ours, v.element);
            ours[i].attrs.push((v.name.to_string(), v.value.clone()));
        }
        // The column rule (DOM 15 on) and footnote values (13.1 on) of the
        // default text frame settings, as on frames (objects.md, text frame
        // preferences of the document).
        let version = (self.doc.version.major, self.doc.version.minor);
        if version.0 >= 15 {
            let i = ours_of(&mut ours, "TextFramePreference");
            let (width, color) = match prefs.frame_column_rule {
                Some((w, 0)) => (w, Some("n".to_string())),
                Some((w, c)) => (w, self.doc.swatches.get(&c).cloned()),
                None => (1.0, Some("Color/Black".to_string())),
            };
            ours[i]
                .attrs
                .push(("ColumnRuleStrokeWidth".into(), num(width)));
            if let Some(c) = color {
                ours[i].attrs.push(("ColumnRuleStrokeColor".into(), c));
            }
        }
        if self.saved_by((13, 1)) {
            let i = ours_of(&mut ours, "TextFramePreference");
            let (span, min, between) = prefs.frame_footnotes.unwrap_or((false, 12.0, 6.0));
            ours[i].attrs.extend([
                ("FootnotesEnableOverrides".into(), "false".into()),
                ("FootnotesSpanAcrossColumns".into(), span.to_string()),
                ("FootnotesMinimumSpacing".into(), num(min)),
                ("FootnotesSpaceBetween".into(), num(between)),
            ]);
        }
        if let Some(d) = &prefs.anchor {
            let i = ours_of(&mut ours, "AnchoredObjectSetting");
            ours[i].attrs.extend(
                anchored_settings(d)
                    .into_iter()
                    .map(|(k, v)| (k.to_string(), v)),
            );
        }
        if let Some(a) = &prefs.item_defaults {
            let i = ours_of(&mut ours, "PageItemDefault");
            let mut values = self.item_default_values(a);
            let stroke = values
                .iter()
                .find(|(k, _)| *k == "StrokeType")
                .map(|(_, v)| v.clone());
            values.retain(|(k, _)| dash_written(k, stroke.as_deref()));
            values.extend(self.overprint_attrs(a, false));
            ours[i]
                .attrs
                .extend(values.into_iter().map(|(k, v)| (k.to_string(), v)));
            let all: Vec<u32> = FITTING_ATTRS.iter().map(|(id, ..)| *id).collect();
            let mut fitting = fitting_attrs(self, a, &all);
            // Every IDML has all seven; a value the list lacks is code or
            // number 0 (preferences.md, page item defaults).
            for (&(id, name, _), zero) in
                FITTING_ATTRS
                    .iter()
                    .zip(["false", "0", "0", "0", "0", "None", "TopLeftAnchor"])
            {
                if a.get(id).is_none() {
                    fitting.push((name, zero.to_string()));
                }
            }
            let i = ours_of(&mut ours, "FrameFittingOption");
            ours[i]
                .attrs
                .extend(fitting.into_iter().map(|(k, v)| (k.to_string(), v)));
        }
        for (tag, name, data) in &prefs.print_records {
            let mut text = base64_lines(data);
            // IDML ends a last line of full length with a line feed.
            if text.rsplit('\n').next().is_some_and(|l| l.len() == 76) {
                text.push('\n');
            }
            let i = ours_of(&mut ours, tag);
            ours[i].attrs.push((name.to_string(), builtin_key(&text)));
        }
        for (tag, name, value) in &prefs.props {
            let mut n = Node {
                tag: name.to_string(),
                ..Node::default()
            };
            match value {
                PrefProp::Text(ty, text) => {
                    n.attrs.push(("type".into(), ty.to_string()));
                    n.text = Some(text.clone());
                }
                PrefProp::Attrs(a) => {
                    n.attrs = a.iter().map(|(k, v)| (k.to_string(), v.clone())).collect();
                }
                PrefProp::Nodes(children) => {
                    n.children = children.iter().map(pref_node).collect();
                }
            }
            let i = ours_of(&mut ours, tag);
            match ours[i].children.iter_mut().find(|c| c.tag == "Properties") {
                Some(p) => p.children.push(n),
                None => ours[i].children.insert(
                    0,
                    Node {
                        tag: "Properties".into(),
                        children: vec![n],
                        ..Node::default()
                    },
                ),
            }
        }
        for &(tag, name, rgb) in &prefs.colors {
            if !PREFERENCE_TAGS.contains(&tag) {
                continue;
            }
            if let Some(p) = ui_color_property(name, rgb) {
                let i = ours_of(&mut ours, tag);
                match ours[i].children.iter_mut().find(|c| c.tag == "Properties") {
                    Some(props) => props.children.push(p),
                    None => ours[i].children.insert(
                        0,
                        Node {
                            tag: "Properties".into(),
                            children: vec![p],
                            ..Node::default()
                        },
                    ),
                }
            }
        }
        if let Some(a) = &prefs.text_defaults {
            let (mut plain, mut props) = self.text_attrs(a);
            // The schema allows KerningValue on character styles only.
            plain.retain(|(k, _)| *k != "KerningValue");
            super::styles::root_lists(&mut props, self.doc.version.major);
            let i = ours_of(&mut ours, "TextDefault");
            ours[i]
                .attrs
                .extend(plain.into_iter().map(|(k, v)| (k.to_string(), v)));
            if !props.is_empty() {
                ours[i].children.push(Node {
                    tag: "Properties".into(),
                    children: props.iter().map(prop_node).collect(),
                    ..Node::default()
                });
            }
        }
        // Default styles (preferences.md, default styles).
        for (uid, paragraph, name) in [
            (prefs.default_styles[0], true, "AppliedParagraphStyle"),
            (prefs.default_styles[1], false, "AppliedCharacterStyle"),
        ] {
            let value = match uid {
                Some(u)
                    if self
                        .doc
                        .styles
                        .get(&u)
                        .is_some_and(|s| s.paragraph == paragraph) =>
                {
                    Some(self.style_ref(Some(u), paragraph))
                }
                Some(0) if paragraph => Some("ParagraphStyle/$ID/[No paragraph style]".into()),
                Some(0) => Some("CharacterStyle/$ID/[No character style]".into()),
                _ => None,
            };
            if let Some(v) = value {
                let i = ours_of(&mut ours, "TextDefault");
                ours[i].attrs.push((name.into(), v));
            }
        }
        if let Some(uids) = prefs.default_object_styles {
            for (u, name) in uids.into_iter().zip([
                "AppliedGraphicObjectStyle",
                "AppliedTextObjectStyle",
                "AppliedGridObjectStyle",
            ]) {
                if let Some(r) = self.object_style_ref(u) {
                    let i = ours_of(&mut ours, "PageItemDefault");
                    ours[i].attrs.push((name.into(), r));
                }
            }
        }
        for (tag, g, count) in &prefs.grids {
            let i = ours_of(&mut ours, tag);
            let n = &mut ours[i];
            n.attrs.push(("FontStyle".into(), g.font_style.clone()));
            let [size, character_aki, line_aki, h_scale, v_scale] = g.numbers;
            for (name, v) in [
                ("PointSize", size),
                ("CharacterAki", character_aki),
                ("LineAki", line_aki),
                ("HorizontalScale", h_scale * 100.0),
                ("VerticalScale", v_scale * 100.0),
            ] {
                n.attrs.push((name.into(), num(v)));
            }
            if let Some(c) = count {
                n.attrs.push(("CharacterCountSize".into(), num(*c)));
            }
            if let Some(f) = self.doc.fonts.get(&g.font) {
                let p = prop_node(&("AppliedFont", "string", self.family_names(f).0.into()));
                match n.children.iter_mut().find(|c| c.tag == "Properties") {
                    Some(props) => props.children.push(p),
                    None => n.children.insert(
                        0,
                        Node {
                            tag: "Properties".into(),
                            children: vec![p],
                            ..Node::default()
                        },
                    ),
                }
            }
        }
        if let Some(o) = &prefs.index_options {
            let i = ours_of(&mut ours, "IndexOptions");
            ours[i].attrs.extend(
                self.index_options(o)
                    .into_iter()
                    .map(|(k, v)| (k.to_string(), v)),
            );
        } else {
            // Without the chunk every IDML has these values; the title and
            // the separator follow the language of the last session
            // (`preferences.md`, index options). Other languages have
            // different titles.
            let i = ours_of(&mut ours, "IndexOptions");
            let paragraph = "ParagraphStyle/$ID/[No paragraph style]";
            let character = "CharacterStyle/$ID/[No character style]";
            for (k, v) in [
                ("TitleStyle", paragraph),
                ("ReplaceExistingIndex", "true"),
                ("IncludeBookDocuments", "false"),
                ("IncludeHiddenEntries", "false"),
                ("IndexFormat", "NestedFormat"),
                ("IncludeSectionHeadings", "true"),
                ("IncludeEmptyIndexSections", "false"),
                ("Level1Style", paragraph),
                ("Level2Style", paragraph),
                ("Level3Style", paragraph),
                ("Level4Style", paragraph),
                ("SectionHeadingStyle", paragraph),
                ("PageNumberStyle", character),
                ("CrossReferenceStyle", character),
                ("CrossReferenceTopicStyle", character),
                ("FollowingTopicSeparator", "  "),
                ("PageRangeSeparator", "^="),
                ("BetweenPageNumbersSeparator", ", "),
                ("BeforeCrossReferenceSeparator", ". "),
                ("EntryEndSeparator", ""),
            ] {
                ours[i].attrs.push((k.into(), v.into()));
            }
            if let Some((title, separator)) = self.index_title() {
                if let Some(t) = title {
                    ours[i].attrs.push(("Title".into(), t.into()));
                }
                ours[i]
                    .attrs
                    .push(("BetweenEntriesSeparator".into(), separator.into()));
            }
        }
        // Without chunk 0x7006 the snap zone follows the ruler units and
        // the edition that made the document (preferences.md, layout
        // adjustment).
        if !prefs
            .values
            .iter()
            .any(|v| v.element == "LayoutAdjustmentPreference" && v.name == "SnapZone")
            && let Some(edition) = self.edition()
        {
            let metric = prefs.values.iter().any(|v| {
                v.element == "ViewPreference"
                    && v.name == "HorizontalMeasurementUnits"
                    && matches!(v.value.as_str(), "Millimeters" | "Centimeters")
            });
            let zone = if metric || edition != Edition::English {
                "0.70866141732283"
            } else {
                "2"
            };
            let i = ours_of(&mut ours, "LayoutAdjustmentPreference");
            ours[i].attrs.push(("SnapZone".into(), zone.into()));
        }
        // The contour of new graphics (preferences.md, text wrap).
        if let Some(t) = prefs.contour.and_then(|c| contour_type(c.kind)) {
            let i = ours_of(&mut ours, "TextWrapPreference");
            let mut attrs = vec![("ContourType", t.into())];
            if self.dom_version() >= (21, 4) {
                attrs.extend(CONTOUR_PARAMS.map(|(k, v)| (k, v.into())));
            }
            ours[i].set(&["ContourOption"], attrs);
        }
        ours.push(self.footnote_option());
        if let Some(c) = prefs.baseline_frame_grid_color.and_then(frame_grid_color) {
            let i = ours_of(&mut ours, "BaselineFrameGridOption");
            set_property(&mut ours[i], c);
        }
        for mut n in ours {
            match nodes.iter_mut().find(|m| m.tag == n.tag) {
                Some(m) => {
                    n.merge(m);
                    *m = n;
                }
                None => nodes.push(n),
            }
        }
        for (tag, attr) in drop {
            if let Some(n) = nodes.iter_mut().find(|n| n.tag == tag) {
                n.attrs.retain(|(k, _)| k != attr);
            }
        }
        for &(tag, name, value, from) in PREFERENCE_DEFAULTS {
            if self.dom_version() < from {
                continue;
            }
            if let Some(n) = nodes.iter_mut().find(|n| n.tag == tag)
                && n.attr(name).is_none()
            {
                n.attrs.push((name.into(), value.into()));
            }
        }
        for n in &nodes {
            n.write(&mut x);
        }
        x.end();
        x.finish()
    }
}
