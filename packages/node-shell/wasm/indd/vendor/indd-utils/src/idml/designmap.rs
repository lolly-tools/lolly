//! `designmap.xml`: the document element and the document-level elements
//! written there (languages, colour groups, TOC styles, cross-reference
//! formats, hyperlinks, bookmarks, text variables, index options, sections).
//!
//! Evidence: `docs/format/objects.md`, `hyperlinks.md`,
//! `cross-references.md`, `text-variables.md` and `idml-values.md`.

use super::*;

/// IDML `HeaderType` of an index group by the name of its header variant;
/// a variant named like its group has none (objects.md, index sort
/// options).
pub(super) fn index_header_type(group: &str, variant: &str) -> Option<&'static str> {
    Some(match variant {
        "IDX_Basic" => "BasicLatin",
        "IDX_Spanish" => "Spanish",
        "IDX_Czech" => "Czech",
        "IDX_Russian" => "Russian",
        "IDX_AllHira" => "HiraganaAll",
        "IDX_ChinesePinyin" => "ChinesePinyin",
        "IDX_ChineseStroke" => "ChineseStrokeCount",
        "IDX_KoreanConsonant" => "KoreanConsonant",
        v if v == group => "Nothing",
        _ => return None,
    })
}

/// Languages whose hyphenation vendor is never stored in the corpus: IDML
/// writes `$ID/` for their empty vendor (objects.md, languages).
const NO_HYPHENATION_VENDOR: &[&str] = &[
    "Albanian",
    "Arabic",
    "Byelorussian",
    "Chinese: Hong Kong",
    "Chinese: Simplified",
    "Chinese: Taiwan",
    "Chinese: Traditional",
    "Icelandic",
    "Japanese",
    "Korean",
    "Neutral",
    "Vietnamese",
    "cy_GB",
    "en_US+Medical",
    "eu_ES",
    "fo_FO",
    "fy_NL",
    "ga_IE",
    "gl_ES",
    "gv_GB",
    "ko_KR",
    "la_VA",
    "lb_LU",
    "mk_MK",
    "mn_MN",
    "ms_MY",
    "ne_NE",
    "oc_FR",
    "sr_RS",
    "sr_RS-Cyr",
    "sr_RS-Lat",
    "tk_TM",
    "uz_UZ",
];

/// Languages whose spelling vendor is never stored in the corpus.
const NO_SPELLING_VENDOR: &[&str] = &[
    "Albanian",
    "Byelorussian",
    "Chinese: Hong Kong",
    "Chinese: Simplified",
    "Chinese: Taiwan",
    "Chinese: Traditional",
    "Icelandic",
    "Japanese",
    "Korean",
    "Neutral",
    "cy_GB",
    "eu_ES",
    "fo_FO",
    "fy_NL",
    "ga_IE",
    "gl_ES",
    "gv_GB",
    "la_VA",
    "lb_LU",
    "mk_MK",
    "mn_MN",
    "ms_MY",
    "ne_NE",
    "oc_FR",
    "sr_RS",
    "sr_RS-Cyr",
    "sr_RS-Lat",
    "tk_TM",
    "uz_UZ",
];

/// Quotes of a language without chunk 0x2D26 that the value files lack.
/// Every Romanian language without the chunk has these, but those with it
/// differ (idml-values.md, language quotes). The others are defaults: a
/// few references have other quotes, which no stored field explains
/// (idml-values.md, defaults).
const QUOTES_WITHOUT_CHUNK: &[(&str, &str, &str)] = &[
    ("Romanian", "\u{201A}\u{2019}", "\u{201E}\u{201D}"),
    ("Korean", "''", "\"\""),
    ("Japanese", "''", "\"\""),
    ("Hebrew", "''", "\"\""),
];

impl Writer<'_> {
    /// Values of designmap settings that follow the InDesign that saved the
    /// document last, as the save history gives it (`preferences.md`,
    /// values of the exporting edition). They apply where the INDD gives
    /// none.
    fn exporter_values(&self, tag: &str) -> Vec<(&'static str, &'static str)> {
        let header = (self.doc.version.major, self.doc.version.minor);
        let last = self.doc.last_session_version.unwrap_or(header);
        match tag {
            "PublishExportPreference" => {
                let mut out = Vec::new();
                if last == (11, 0) {
                    out.push(("ImageExportResolution", "Ppi72"));
                } else if last >= (11, 1) {
                    out.push(("ImageExportResolution", "Ppi96"));
                }
                if last >= (11, 2) {
                    out.push(("PublishPdf", "false"));
                }
                out
            }
            "AdjustLayoutPreference" => {
                let early_14 =
                    last == (14, 0) && matches!(self.doc.last_session_patch, Some(0 | 1));
                vec![
                    (
                        "EnableAdjustLayout",
                        if early_14 { "true" } else { "false" },
                    ),
                    ("AllowFontSizeAndLeadingAdjustment", "false"),
                    ("EnableAutoAdjustMargins", "false"),
                ]
            }
            // Without chunk 0x16344 the font follows the language of the
            // assignment name (preferences.md, watermark).
            "WatermarkPreference" => {
                let font = match self.doc.assignment_name.as_deref() {
                    Some("未指定的 InCopy 內容") => Some(("Adobe Ming Std", "L")),
                    _ => match self.edition() {
                        Some(Edition::English) => Some(("Minion Pro", "Regular")),
                        Some(Edition::Korean) => Some(("Adobe Myungjo Std", "M")),
                        Some(Edition::Japanese) => Some(("Kozuka Mincho Pro", "R")),
                        _ => None,
                    },
                };
                font.map_or_else(Vec::new, |(family, style)| {
                    vec![
                        ("WatermarkFontFamily", family),
                        ("WatermarkFontStyle", style),
                    ]
                })
            }
            _ => Vec::new(),
        }
    }

    pub(super) fn designmap(&self, name: &str) -> String {
        let doc = self.doc;
        let mut x = Xml::new();
        x.pi(&format!(
            "aid style=\"50\" type=\"document\" readerVersion=\"6.0\" featureSet=\"257\" product=\"{}\" ",
            self.dom
        ));
        // The stories, then the backing story.
        let stories: Vec<String> = doc
            .stories
            .iter()
            .chain(&doc.xml.story)
            .map(|s| uref(Some(s.uid)))
            .collect();
        x.start("Document")
            .attr("xmlns:idPkg", PACKAGING_NS)
            .attr("DOMVersion", &self.dom)
            .attr("Self", "d")
            .attr("StoryList", stories.join(" "));
        // `Name` from DOM 13 (idml-values.md, document attributes).
        if doc.version.major >= 13 {
            x.attr("Name", name);
        }
        x.attr("ZeroPoint", "0 0");
        if let Some(l) = doc.active_layer {
            x.attr("ActiveLayer", uref(Some(l)));
        }
        // Colour settings (`model::prefs`).
        for v in doc.prefs.values.iter().filter(|v| v.element == "Document") {
            x.attr(v.name, &v.value);
        }
        // `false` in every corpus IDML (docs/format/idml-values.md).
        x.attr("AccurateLABSpots", "false");
        // The MathML settings every IDML of DOM 20 has, and of 20.4
        // (idml-values.md, document attributes).
        let mathml = self.dom_version() >= (20, 0);
        if mathml {
            x.attr("AppliedMathMLFontSize", "10")
                .attr("AppliedMathMLRgbColor", "0 0 0")
                .attr("TintValue", "100");
        }
        if self.dom_version() >= (20, 4) {
            x.attr("PreferMathMLInEpubExport", "false");
        }
        if !doc.label.is_empty() || mathml {
            x.start("Properties");
            Self::label(&mut x, &doc.label);
            if mathml {
                x.start("AppliedMathMLSwatch")
                    .attr("type", "enumeration")
                    .text("Nothing")
                    .end();
            }
            x.end();
        }
        self.languages(&mut x);
        x.empty("idPkg:Graphic", &[("src", "Resources/Graphic.xml".into())]);
        x.empty("idPkg:Fonts", &[("src", "Resources/Fonts.xml".into())]);
        // Kinsoku tables, then mojikumi tables, as the schema orders them.
        for mojikumi in [false, true] {
            for t in doc.cjk_tables.iter().filter(|t| t.mojikumi == mojikumi) {
                let tag = if mojikumi {
                    "MojikumiTable"
                } else {
                    "KinsokuTable"
                };
                let name = t.name.idml();
                x.start(tag)
                    .attr("Self", format!("{tag}/{}", self_name(&name)))
                    .attr("Name", &name);
                if let Some([begin, end, _, hanging, together]) = &t.chars {
                    x.attr("CantBeginLineChars", begin)
                        .attr("CantEndLineChars", end)
                        .attr("HangingPunctuationChars", hanging)
                        .attr("CantBeSeparatedChars", together);
                }
                if let Some(m) = &t.custom_mojikumi {
                    custom_mojikumi(&mut x, m);
                }
                x.end();
            }
        }
        x.empty("idPkg:Styles", &[("src", "Resources/Styles.xml".into())]);
        // The numbering lists, the default first (objects.md, numbering
        // lists). Without them, the default list every corpus IDML has
        // (idml-values.md), which the root paragraph style refers to.
        let default = [crate::model::NumberingList {
            uid: 0,
            name: "$ID/[Default]".into(),
            across_stories: false,
            across_documents: false,
        }];
        let lists = if doc.numbering_lists.is_empty() {
            &default[..]
        } else {
            &doc.numbering_lists[..]
        };
        for l in lists {
            x.empty(
                "NumberingList",
                &[
                    ("Self", format!("NumberingList/{}", self_name(&l.name))),
                    ("Name", l.name.clone()),
                    ("ContinueNumbersAcrossStories", l.across_stories.to_string()),
                    (
                        "ContinueNumbersAcrossDocuments",
                        l.across_documents.to_string(),
                    ),
                ],
            );
        }
        let major = doc.version.major;
        // Elements every IDML of the version has, with the values they
        // all have (idml-values.md), in the order of the IDML files.
        let singleton = |x: &mut Xml, tag: &str| {
            // Every IDML from 7.5 has the tagged PDF settings, none of 7.0
            // (preferences.md, tagged PDF).
            // Every IDML from DOM 10.1 has the fixed-layout HTML export
            // settings, none of 10.0, and from DOM 21.1 the HTML5 export
            // settings, with the values all of them have (idml-values.md,
            // document elements).
            let present = values::present(&format!("Document/{tag}"), major).or_else(|| {
                let since = match tag {
                    "TaggedPDFPreference" => (major, doc.version.minor) >= (7, 5),
                    "HTMLFXLExportPreference" => self.dom_version() >= (10, 1),
                    "Html5ExportPreference" => self.dom_version() >= (21, 1),
                    _ => false,
                };
                since.then(|| {
                    values::element(&format!("Document/{tag}"), major).unwrap_or_else(|| Node {
                        tag: tag.to_string(),
                        attrs: match tag {
                            "Html5ExportPreference" => vec![
                                ("TextExportFormat".into(), "HtmlTag".into()),
                                ("CopyFonts".into(), "false".into()),
                            ],
                            _ => Vec::new(),
                        },
                        ..Node::default()
                    })
                })
            });
            if let Some(n) = present {
                // Values read from the INDD (`model::prefs`) first.
                let mut ours = match tag {
                    "EndnoteOption" => self.endnote_option(),
                    _ => None,
                }
                .unwrap_or_else(|| Node {
                    tag: n.tag.clone(),
                    ..Node::default()
                });
                for v in doc.prefs.values.iter().filter(|v| v.element == tag) {
                    ours.attrs.push((v.name.to_string(), v.value.clone()));
                }
                for (k, v) in self.exporter_values(tag) {
                    if !ours.attrs.iter().any(|(a, _)| a == k) {
                        ours.attrs.push((k.to_string(), v.to_string()));
                    }
                }
                let colors: Vec<Node> = doc
                    .prefs
                    .colors
                    .iter()
                    .filter(|c| c.0 == tag)
                    .filter_map(|&(_, name, rgb)| ui_color_property(name, rgb))
                    .collect();
                if !colors.is_empty() {
                    ours.children.push(Node {
                        tag: "Properties".into(),
                        children: colors,
                        ..Node::default()
                    });
                }
                ours.merge(&n);
                ours.write(x);
            }
        };
        // A named grid without settings of its own has those of the
        // document's layout grid (objects.md, named grids).
        let layout_grid = doc
            .prefs
            .grids
            .iter()
            .find(|(tag, ..)| *tag == "LayoutGridDataInformation")
            .map(|(_, g, _)| g);
        for ng in &doc.named_grids {
            x.start("NamedGrid")
                .attr("Self", Self::named_grid_self(ng))
                .attr("Name", Self::named_grid_name(ng));
            if let Some(g) = ng.grid.as_ref().or(layout_grid) {
                self.grid_data(&mut x, g);
            }
            x.end();
        }
        for p in &doc.motion_presets {
            Self::motion_preset(&mut x, p);
        }
        singleton(&mut x, "ConditionalTextPreference");
        x.empty(
            "idPkg:Preferences",
            &[("src", "Resources/Preferences.xml".into())],
        );
        for tag in [
            "EndnoteOption",
            "TextFrameFootnoteOptionsObject",
            "LinkedStoryOption",
            "LinkedPageItemOption",
            "WatermarkPreference",
            "TaggedPDFPreference",
            "AdjustLayoutPreference",
            "HTMLFXLExportPreference",
            "PublishExportPreference",
            "Html5ExportPreference",
        ] {
            singleton(&mut x, tag);
        }
        self.text_variables(&mut x);
        x.empty("idPkg:Tags", &[("src", "XML/Tags.xml".into())]);
        for l in doc.layers.iter().filter(|l| !l.internal) {
            x.start("Layer")
                .attr("Self", uref(Some(l.uid)))
                .attr("Name", &l.name)
                .attr("Visible", l.visible.to_string())
                .attr("Locked", l.locked.to_string());
            let mut color = None;
            if let Some(st) = &l.settings {
                x.attr("IgnoreWrap", st.ignore_wrap.to_string())
                    .attr("LockGuides", st.lock_guides.to_string())
                    .attr("UI", st.ui.to_string())
                    .attr("Printable", st.printable.to_string());
                color = st.color.and_then(|c| ui_color_property("LayerColor", c));
            }
            x.attrs_missing(self.observed("Layer").iter());
            if let Some(c) = color {
                Self::properties_with(&mut x, &[], &[c]);
            }
            x.end();
        }
        for s in &doc.master_spreads {
            x.empty(
                "idPkg:MasterSpread",
                &[(
                    "src",
                    format!("MasterSpreads/MasterSpread_u{:x}.xml", s.uid),
                )],
            );
        }
        for s in &doc.spreads {
            x.empty(
                "idPkg:Spread",
                &[("src", format!("Spreads/Spread_u{:x}.xml", s.uid))],
            );
        }
        let pages = document_pages(doc);
        let (layout_lengths, _) = alternate_layouts(doc);
        for (k, (section, first, length)) in section_ranges(doc).into_iter().enumerate() {
            x.start("Section")
                .attr("Self", uref(Some(section.uid)))
                .attr("Length", length.to_string())
                .attr("Name", &section.prefix)
                .attr("ContinueNumbering", section.continue_numbering.to_string())
                .attr("IncludeSectionPrefix", section.include_prefix.to_string())
                .attr("Marker", &section.marker)
                .attr("PageStart", uref(Some(pages[first])));
            if doc.version.major >= 8
                && let Some(name) = alternate_layout_name(section)
            {
                x.attr("AlternateLayoutLength", layout_lengths[k].to_string())
                    .attr("AlternateLayout", name);
            }
            // The pagination values of DOM 8 (idml-values.md, sections).
            if let Some(n) = values::element("Section", doc.version.major) {
                x.attrs_missing(n.attrs.iter());
            }
            // IDML gives a start number only to sections that restart
            // numbering.
            if !section.continue_numbering {
                x.attr("PageNumberStart", section.start.to_string());
            }
            x.attr("SectionPrefix", &section.prefix);
            if let Some(style) = number_style(section.style) {
                x.start("Properties")
                    .start("PageNumberStyle")
                    .attr("type", "enumeration")
                    .text(style)
                    .end()
                    .end();
            }
            x.end();
        }
        // Document users. IDML names `$ID/Unknown User Name` a user whose
        // name is the saving edition's name for an unknown user; without
        // the edition, a user with flag 2. The colours are left out
        // (docs/format/objects.md, document users and saving edition).
        let unknown = self.saving_edition().map(Edition::unknown_user);
        for (i, (flag, name)) in doc.users.iter().enumerate() {
            let placeholder = match unknown {
                Some(names) => names.contains(&name.as_str()),
                None => *flag == 2,
            };
            let name = if placeholder {
                "$ID/Unknown User Name"
            } else {
                name.as_str()
            };
            x.empty(
                "DocumentUser",
                &[
                    ("Self", format!("dDocumentUser{i:x}")),
                    ("UserName", name.into()),
                ],
            );
        }
        self.cross_reference_formats(&mut x);
        if let Some(index) = &doc.index {
            index_xml(&mut x, index);
        }
        x.empty(
            "idPkg:BackingStory",
            &[("src", "XML/BackingStory.xml".into())],
        );
        for s in &doc.stories {
            x.empty(
                "idPkg:Story",
                &[("src", format!("Stories/Story_u{:x}.xml", s.uid))],
            );
        }
        self.style_mappings(&mut x, "d", &doc.style_mappings);
        self.hyperlinks(&mut x);
        self.color_groups(&mut x);
        for (i, b) in doc.bullets.iter().enumerate() {
            const KINDS: [&str; 3] = ["UnicodeOnly", "UnicodeWithFont", "GlyphWithFont"];
            let Some(kind) = KINDS.get(b.kind as usize) else {
                continue;
            };
            let font = match b.font {
                0 => "$ID/".to_string(),
                f => match doc.fonts.get(&f) {
                    Some(f) => self.family_names(f).0,
                    None => continue,
                },
            };
            x.start("ABullet")
                .attr("Self", format!("dABullet{i:x}"))
                .attr("CharacterType", *kind)
                .attr("CharacterValue", b.value.to_string());
            Self::properties(
                &mut x,
                &[
                    ("BulletsFont", "string", font.into()),
                    ("BulletsFontStyle", "string", b.font_style.idml().into()),
                ],
            );
            x.end();
        }
        // Index sort options: the groups in their order, with the header
        // type each group and header variant has in IDML (objects.md).
        for (i, (name, include, variant)) in doc.index_groups.iter().enumerate() {
            x.start("IndexingSortOption")
                .attr("Self", format!("dIndexingSortOptionn{name}"))
                .attr("Name", builtin_key(name))
                .attr("Include", include.to_string())
                .attr("Priority", i.to_string());
            if let Some(h) = variant.as_deref().and_then(|v| index_header_type(name, v)) {
                x.attr("HeaderType", h);
            }
            x.end();
        }
        // InCopy assignments: the values every IDML has on them; the name
        // depends on the computer that exported the IDML (objects.md).
        if let Some(n) = values::element("Assignment", doc.version.major) {
            for &uid in &doc.assignments {
                let mut a = n.clone();
                a.attrs.insert(0, ("Self".into(), uref(Some(uid))));
                a.write(&mut x);
            }
        }
        self.articles(&mut x);
        x.end();
        x.finish()
    }

    /// Articles, after the assignments (objects.md, articles).
    /// `ArticleExportStatus` has no stored field; it is `true` in every
    /// reference (idml-values.md, defaults). A member that is not written
    /// as an element is left out with a warning.
    fn articles(&self, x: &mut Xml) {
        if self.doc.articles.is_empty() {
            return;
        }
        let written = self.written_items();
        for a in &self.doc.articles {
            let id = uref(Some(a.uid));
            x.start("Article")
                .attr("Self", id.as_str())
                .attr("Name", a.name.as_str())
                .attr("ArticleExportStatus", "true");
            let mut i = 0;
            for &m in &a.members {
                if !written.contains(&m) {
                    self.warnings.borrow_mut().push(format!(
                        "article {}: member {m} left out: not written",
                        a.uid
                    ));
                    continue;
                }
                x.start("ArticleMember")
                    .attr("Self", format!("{id}ArticleMember{i}"))
                    .attr("ItemRef", uref(Some(m)));
                x.end();
                i += 1;
            }
            x.end();
        }
    }

    /// The IDML reference of a TOC style.
    fn named_grid_name(ng: &crate::model::NamedGrid) -> String {
        if ng.builtin {
            builtin_key(&ng.name)
        } else {
            ng.name.clone()
        }
    }

    fn named_grid_self(ng: &crate::model::NamedGrid) -> String {
        format!("NamedGrid/{}", self_name(&Self::named_grid_name(ng)))
    }

    /// `AppliedNamedGrid` of a story or object style: `n` for none, the
    /// grid's `Self` for a grid of the document, `None` otherwise
    /// (objects.md, named grids).
    pub(super) fn named_grid_ref(&self, applied: Option<Option<u32>>) -> Option<String> {
        match applied? {
            None => Some("n".into()),
            Some(uid) => self
                .doc
                .named_grids
                .iter()
                .find(|g| g.uid == uid)
                .map(Self::named_grid_self),
        }
    }

    pub(super) fn toc_style_ref(t: &crate::model::TocStyle) -> String {
        let name = if t.builtin {
            builtin_key(&t.name)
        } else {
            t.name.clone()
        };
        format!("TOCStyle/{}", self_name(&name))
    }

    /// Table of contents styles, without their entries. See
    /// `docs/format/objects.md`, table of contents styles.
    pub(super) fn toc_styles(&self, x: &mut Xml) {
        for t in &self.doc.toc_styles {
            let name = if t.builtin {
                builtin_key(&t.name)
            } else {
                t.name.clone()
            };
            x.start("TOCStyle")
                .attr("Self", Self::toc_style_ref(t))
                .attr(
                    "TitleStyle",
                    self.style_ref((t.title_style != 0).then_some(t.title_style), true),
                )
                .attr("Title", &t.title)
                .attr("Name", &name)
                .attr("IncludeBookDocuments", t.include_book_documents.to_string())
                .attr("CreateBookmarks", t.create_bookmarks.to_string());
            let major = self.doc.version.major;
            let flag = |i: usize| t.flags.get(i).copied();
            match flag(0) {
                Some(0) => {
                    x.attr("SetStoryDirection", "Horizontal");
                }
                Some(1) => {
                    x.attr("SetStoryDirection", "Vertical");
                }
                _ => {}
            }
            match flag(1) {
                Some(0) => {
                    x.attr("NumberedParagraphs", "IncludeFullParagraph");
                }
                Some(2) => {
                    x.attr("NumberedParagraphs", "ExcludeNumbers");
                }
                _ => {}
            }
            if major >= 9
                && let Some(v) = flag(2)
            {
                x.attr("MakeAnchor", (v != 0).to_string());
            }
            if major >= 13
                && let Some(v) = flag(3)
            {
                x.attr("RemoveForcedLineBreak", (v != 0).to_string());
            }
            x.attrs_missing(self.observed("TOCStyle").iter());
            x.attrs_missing(values::when_written("TOCStyle", major).iter());
            let observed = self.observed("TOCStyleEntry");
            for (i, e) in t.entries.iter().enumerate() {
                self.toc_entry(x, t.uid, i, e, &observed);
            }
            x.end();
        }
    }

    /// An entry of a table of contents style (`objects.md`, table of
    /// contents styles).
    fn toc_entry(
        &self,
        x: &mut Xml,
        toc: u32,
        i: usize,
        e: &crate::model::TocEntry,
        observed: &[(String, String)],
    ) {
        let name = e.name.replace('\u{E00B}', ":");
        let name = if e.builtin {
            format!("$ID/{name}")
        } else {
            name
        };
        let position = match e.page_number_position {
            0 => Some("AfterEntry"),
            1 => Some("BeforeEntry"),
            2 => Some("None"),
            _ => None,
        };
        x.start("TOCStyleEntry")
            .attr("Self", format!("u{toc:x}TOCStyleEntry{i:x}"))
            .attr("Name", name)
            .attr("Level", e.level.to_string());
        if let Some(p) = position {
            x.attr("PageNumberPosition", p);
        }
        x.attr("Separator", toc_separator(&e.separator));
        x.attrs_missing(observed.iter());
        let style = |uid: u32, paragraph: bool, same: &str| -> Option<(&'static str, String)> {
            if uid == 0 {
                return Some(("string", same.to_string()));
            }
            self.doc.styles.get(&uid)?;
            let r = self.style_ref(Some(uid), paragraph);
            Some(match r.split_once('/') {
                Some((_, root @ ("$ID/[No paragraph style]" | "$ID/[No character style]"))) => {
                    ("string", root.to_string())
                }
                _ => ("object", r),
            })
        };
        let props: Vec<_> = [
            (
                "FormatStyle",
                style(e.format_style, true, "$ID/kSameStyleWithBracket"),
            ),
            (
                "PageNumberStyle",
                style(e.page_number_style, false, "$ID/[Same Style]"),
            ),
            (
                "SeparatorStyle",
                style(e.separator_style, false, "$ID/[Same Style]"),
            ),
        ]
        .into_iter()
        .filter_map(|(k, v)| v.map(|v| (k, v)))
        .collect();
        if !props.is_empty() {
            x.start("Properties");
            for (k, (ty, v)) in props {
                x.start(k).attr("type", ty).text(&v).end();
            }
            x.end();
        }
        x.end();
    }

    /// The document's languages, in UID order. See
    /// `docs/format/objects.md`, languages.
    pub(super) fn languages(&self, x: &mut Xml) {
        let mut list: Vec<_> = self.doc.language_list.iter().collect();
        list.sort_by_key(|l| l.uid);
        for l in list {
            // The language without one is `Neutral` in the INDD.
            let neutral = l.name == "Neutral";
            let name = |s: &str| {
                if neutral {
                    "$ID/[No Language]".to_string()
                } else {
                    builtin_key(s)
                }
            };
            let full = name(&l.name);
            x.start("Language")
                .attr("Self", format!("Language/{}", self_name(&full)))
                .attr("Name", &full);
            // The quotes stored with the language, else those every IDML
            // has for its name (objects.md, languages).
            if let Some((single, double)) = &l.quotes {
                x.attr("SingleQuotes", single).attr("DoubleQuotes", double);
            } else if let Some(q) = values::keyed("Language", &full) {
                for k in ["SingleQuotes", "DoubleQuotes"] {
                    if let Some(v) = q.attr(k) {
                        x.attr(k, v);
                    }
                }
            } else if let Some((_, single, double)) =
                QUOTES_WITHOUT_CHUNK.iter().find(|(n, ..)| *n == l.name)
            {
                x.attr("SingleQuotes", *single)
                    .attr("DoubleQuotes", *double);
            }
            x.attr("PrimaryLanguageName", name(&l.primary))
                .attr("SublanguageName", name(&l.sub))
                .attr("Id", l.id.to_string());
            if let Some([(sf, spelling), (hf, hyphenation)]) = &l.vendors {
                let vendor = |flag: u8, text: &str, without: &[&str]| match flag {
                    1 => Some(text.to_string()),
                    0 if text.is_empty() && without.contains(&l.name.as_str()) => {
                        Some("$ID/".to_string())
                    }
                    3 => Some("$ID/".to_string()),
                    10 => Some(builtin_key(text)),
                    _ => None,
                };
                if let Some(v) = vendor(*hf, hyphenation, NO_HYPHENATION_VENDOR) {
                    x.attr("HyphenationVendor", v);
                }
                if let Some(v) = vendor(*sf, spelling, NO_SPELLING_VENDOR) {
                    x.attr("SpellingVendor", v);
                }
            }
            x.end();
        }
    }

    /// Colour groups and their swatches. See `docs/format/objects.md`.
    pub(super) fn color_groups(&self, x: &mut Xml) {
        for (i, g) in self.doc.color_groups.iter().enumerate() {
            // Named by UID before DOM 11.3 (objects.md, colour groups).
            let id = if self.dom_version() < (11, 3) {
                uref(Some(g.uid))
            } else {
                format!("ColorGroup/{}", self_name(&g.name))
            };
            x.start("ColorGroup")
                .attr("Self", id)
                .attr("Name", &g.name)
                .attr("IsRootColorGroup", (i == 0).to_string());
            for (n, s) in g.swatches.iter().enumerate() {
                if let Some(r) = self.doc.swatches.get(s) {
                    x.empty(
                        "ColorGroupSwatch",
                        &[
                            (
                                "Self",
                                format!("{}ColorGroupSwatch{n:x}", uref(Some(g.uid))),
                            ),
                            ("SwatchItemRef", r.clone()),
                        ],
                    );
                }
            }
            x.end();
        }
    }

    /// Cross-reference formats. See docs/format/cross-references.md.
    pub(super) fn cross_reference_formats(&self, x: &mut Xml) {
        for f in self.doc.cross_reference_formats.values() {
            let id = uref(Some(f.uid));
            x.start("CrossReferenceFormat")
                .attr("Self", &id)
                .attr("Name", &f.name);
            if f.character_style == 0 {
                x.attr("AppliedCharacterStyle", "n");
            }
            for (i, b) in f.blocks.iter().enumerate() {
                let Some(kind) = b.type_name() else { continue };
                x.start("BuildingBlock")
                    .attr("Self", format!("{id}BuildingBlock{i}"))
                    .attr("BlockType", kind);
                if b.zero_fields {
                    x.attr("AppliedCharacterStyle", "n");
                }
                x.attr("CustomText", b.text.idml());
                if b.zero_fields {
                    x.attr("AppliedDelimiter", "$ID/")
                        .attr("IncludeDelimiter", "false");
                }
                x.end();
            }
            x.end();
        }
    }

    /// `EndnoteOption` from chunk 0x2261E (footnotes.md).
    fn endnote_option(&self) -> Option<Node> {
        let mut n = Node {
            tag: "EndnoteOption".into(),
            ..Node::default()
        };
        let Some(e) = self.doc.prefs.endnotes.as_ref() else {
            // Without the chunk the styles are the defaults (149 of 149).
            // The separator and the marker position follow the language
            // of the last session; the title differs between languages and
            // versions (footnotes.md, endnote options).
            n.attrs
                .push(("EndnoteMarkerStyle".into(), self.style_ref(None, false)));
            n.attrs
                .push(("EndnoteTextStyle".into(), self.style_ref(None, true)));
            // The title and the marker position follow the saving edition
            // where the black name shows it (objects.md, saving edition).
            let saved = self.saving_edition();
            let title = saved.and_then(|e| {
                Some(match e {
                    Edition::English => "Endnotes",
                    Edition::Korean => "미주",
                    Edition::Japanese => match self.dom_version().0 {
                        ..=13 => "文末脚注",
                        19.. => "後注",
                        _ => return None,
                    },
                    Edition::German => "Endnoten",
                    Edition::French => "Notes de fin",
                    Edition::Italian => "Note di chiusura",
                    Edition::Dutch => "Eindnoten",
                    _ => return None,
                })
            });
            if let Some(t) = title {
                n.attrs.insert(0, ("EndnoteTitle".into(), t.into()));
            }
            if let Some(japanese) = self.japanese_session() {
                let (separator, mut position) = if japanese {
                    ("\u{3000}", "RubyMarker")
                } else {
                    ("\t", "SuperscriptMarker")
                };
                if let Some(e) = saved.filter(|e| *e != Edition::Other) {
                    position = if e == Edition::Japanese {
                        "RubyMarker"
                    } else {
                        "SuperscriptMarker"
                    };
                }
                n.attrs
                    .push(("EndnoteSeparatorText".into(), separator.into()));
                n.children.push(Node {
                    tag: "Properties".into(),
                    children: vec![Node {
                        tag: "EndnoteMarkerPositioning".into(),
                        attrs: vec![("type".into(), "enumeration".into())],
                        text: Some(position.into()),
                        ..Node::default()
                    }],
                    ..Node::default()
                });
            }
            return Some(n);
        };
        let mut attr = |k: &str, v: String| n.attrs.push((k.to_string(), v));
        attr("EndnoteTitle", e.title.clone());
        attr(
            "EndnoteTitleStyle",
            self.style_ref(Some(e.title_style), true),
        );
        attr("StartEndnoteNumberAt", e.start_at.to_string());
        attr(
            "EndnoteMarkerStyle",
            self.style_ref(Some(e.marker_style), false),
        );
        attr("EndnoteTextStyle", self.style_ref(Some(e.text_style), true));
        attr("EndnoteSeparatorText", e.separator.clone());
        let mut props = Vec::new();
        let mut prop = |name: &str, v: &str| {
            props.push(Node {
                tag: name.to_string(),
                attrs: vec![("type".into(), "enumeration".into())],
                text: Some(v.to_string()),
                ..Node::default()
            })
        };
        if e.numbering == 0xCA07 {
            prop("EndnoteNumberingStyle", "Arabic");
        }
        if e.restart == 0 {
            prop("RestartEndnoteNumbering", "Continuous");
        }
        match e.positioning {
            1 => prop("EndnoteMarkerPositioning", "SuperscriptMarker"),
            3 => prop("EndnoteMarkerPositioning", "RubyMarker"),
            _ => {}
        }
        // The last fields hold one value in every sample: the generated
        // value file supplies it (`idml-values.md`).
        n.children.push(Node {
            tag: "Properties".into(),
            children: props,
            ..Node::default()
        });
        Some(n)
    }

    /// Hyperlink text sources written in the stories.
    pub(super) fn written_sources(&self) -> std::collections::HashSet<u32> {
        self.doc
            .stories
            .iter()
            .flat_map(|s| &s.sources)
            .map(|r| r.source)
            .filter(|u| self.doc.text_sources.contains_key(u))
            .collect()
    }

    /// UIDs of the text and paragraph destinations written in stories.
    pub(super) fn written_text_destinations(&self) -> std::collections::HashSet<u32> {
        self.doc
            .stories
            .iter()
            .flat_map(|s| s.text_destinations.values().flatten())
            .map(|d| d.uid)
            .collect()
    }

    /// UIDs of the page items written.
    pub(super) fn written_items(&self) -> std::collections::HashSet<u32> {
        self.written_page_items().iter().map(|i| i.uid).collect()
    }

    /// The page items written: on spreads and master spreads, in groups,
    /// anchored in stories and in graphic cells.
    pub(super) fn written_page_items(&self) -> Vec<&PageItem> {
        let doc = self.doc;
        let mut out = Vec::new();
        let mut stack: Vec<&PageItem> = doc
            .spreads
            .iter()
            .chain(&doc.master_spreads)
            .flat_map(|s| &s.items)
            .chain(
                doc.stories
                    .iter()
                    .flat_map(|s| s.anchors.values().flatten()),
            )
            .chain(
                doc.stories
                    .iter()
                    .flat_map(|s| s.tables.values())
                    .flat_map(|t| &t.cells)
                    .flat_map(|c| &c.items),
            )
            .collect();
        while let Some(item) = stack.pop() {
            out.push(item);
            stack.extend(&item.children);
        }
        out
    }

    /// Destinations, hyperlinks and bookmarks, in schema order. See
    /// docs/format/hyperlinks.md.
    pub(super) fn hyperlinks(&self, x: &mut Xml) {
        let doc = self.doc;
        // Text and paragraph destinations are written in the stories, at
        // their position; only those found there can be referred to.
        let in_text = self.written_text_destinations();
        let mut dests: Vec<_> = doc
            .destinations
            .iter()
            .filter(|d| {
                !matches!(d.kind, DestinationKind::Text | DestinationKind::Paragraph)
                    || in_text.contains(&d.uid)
            })
            .collect();
        // Schema order: page, URL, external page destinations; each sorted
        // by key.
        dests.sort_by_key(|d| {
            let rank = match d.kind {
                DestinationKind::Page { .. } => 0,
                DestinationKind::Url { .. } => 1,
                _ => 2,
            };
            (rank, d.key)
        });
        let view_setting = |x: &mut Xml, view: u32, zoom: Option<f64>| {
            match view {
                0 => {
                    x.attr("ViewSetting", "Fixed");
                }
                1 => {
                    x.attr("ViewSetting", "FitWindow");
                }
                _ => {}
            }
            if let Some(zoom) = zoom {
                x.attr("ViewPercentage", num(zoom * 100.0));
            }
        };
        for d in &dests {
            let mut bounds = None;
            match &d.kind {
                DestinationKind::Page {
                    page,
                    zoom,
                    view,
                    bounds: b,
                } => {
                    // NameManually is true on every corpus page
                    // destination (hyperlinks.md).
                    x.start("HyperlinkPageDestination")
                        .attr("Self", d.reference())
                        .attr("Name", &d.name)
                        .attr("NameManually", "true")
                        .attr("DestinationPage", uref(Some(*page)));
                    view_setting(x, *view, *zoom);
                    bounds = *b;
                }
                DestinationKind::Url { url } => {
                    x.start("HyperlinkURLDestination")
                        .attr("Self", d.reference())
                        .attr("Name", &d.name)
                        .attr("DestinationURL", url);
                }
                DestinationKind::ExternalPage {
                    page_index,
                    zoom,
                    view,
                    bounds: b,
                    file_name,
                    ..
                } => {
                    x.start("HyperlinkExternalPageDestination")
                        .attr("Self", d.reference());
                    // The name is not stored; IDML makes it from the file
                    // name and the page (shown for the Fixed view only).
                    if let (0, Some(f)) = (view, file_name) {
                        x.attr("Name", format!("{f} - Page {} [Fixed]", page_index + 1));
                    }
                    x.attr("DestinationPageIndex", (page_index + 1).to_string());
                    view_setting(x, *view, *zoom);
                    bounds = *b;
                }
                DestinationKind::Text | DestinationKind::Paragraph => continue,
            }
            x.attr("Hidden", d.hidden.to_string())
                .attr_opt("DestinationUniqueKey", d.key.map(|k| k.to_string()));
            if let Some([left, top, right, bottom]) = bounds {
                // IDML writes the unset bounds (1e256) in exponent form.
                let n = |v: f64| if v == 1e256 { "1e+256".into() } else { num(v) };
                x.start("Properties")
                    .start("ViewBounds")
                    .attr("Top", n(top))
                    .attr("Left", n(left))
                    .attr("Bottom", n(bottom))
                    .attr("Right", n(right))
                    .end()
                    .end();
            }
            x.end();
        }
        let items = self.written_items();
        let mut sources = self.written_sources();
        for s in &doc.page_item_sources {
            if !items.contains(&s.item) {
                continue;
            }
            x.start("HyperlinkPageItemSource")
                .attr("Self", uref(Some(s.uid)))
                .attr("Name", &s.name)
                .attr("SourcePageItem", uref(Some(s.item)))
                .attr("Hidden", s.hidden.to_string())
                .end();
            sources.insert(s.uid);
        }
        let mut links: Vec<_> = doc.hyperlinks.iter().collect();
        links.sort_by_key(|h| h.uid);
        for h in links {
            // A hyperlink into another document has a destination that is
            // not converted: IDML writes it as a list, which is left out.
            // Otherwise the destination with the same key; `n` for a
            // hyperlink without one (hyperlinks.md).
            let dest = if h.other_document {
                None
            } else if let Some(d) = dests.iter().find(|d| match h.destination {
                Some(u) => d.uid == u,
                None => h.key.is_some() && d.key == h.key,
            }) {
                Some(d.reference())
            } else if h.kind_is_none() {
                Some("n".to_string())
            } else {
                continue;
            };
            if h.source == 0 || !sources.contains(&h.source) {
                continue;
            }
            x.start("Hyperlink")
                .attr("Self", uref(Some(h.uid)))
                .attr("Name", &h.name)
                .attr("Source", uref(Some(h.source)));
            if h.appearance_known {
                x.attr("Visible", "false");
                match h.highlight {
                    Some(0) => {
                        x.attr("Highlight", "None");
                    }
                    Some(1) => {
                        x.attr("Highlight", "Invert");
                    }
                    _ => {}
                }
                x.attr("Width", "Thin").attr("BorderStyle", "Solid");
            }
            x.attr("Hidden", h.hidden.to_string())
                .attr_opt("DestinationUniqueKey", h.key.map(|k| k.to_string()));
            x.start("Properties");
            // Black on every corpus hyperlink with the known appearance,
            // apart from those to a page of another document.
            if h.appearance_known && !h.to_external_page() {
                x.start("BorderColor")
                    .attr("type", "enumeration")
                    .text("Black")
                    .end();
            }
            if let Some(d) = dest {
                x.start("Destination").attr("type", "object").text(&d).end();
            }
            x.end().end();
        }
        let top = doc
            .bookmark_order
            .iter()
            .filter_map(|u| doc.bookmarks.get(u))
            .filter(|b| !doc.bookmarks.contains_key(&b.parent));
        for b in top {
            self.bookmark(x, b, 0, &in_text);
        }
    }

    pub(super) fn bookmark(
        &self,
        x: &mut Xml,
        b: &crate::model::Bookmark,
        depth: usize,
        in_text: &std::collections::HashSet<u32>,
    ) {
        let doc = self.doc;
        let Some(dest) = doc.destinations.iter().find(|d| d.uid == b.destination) else {
            return;
        };
        if matches!(
            dest.kind,
            DestinationKind::Text | DestinationKind::Paragraph
        ) && !in_text.contains(&dest.uid)
        {
            return;
        }
        x.start("Bookmark")
            .attr("Self", uref(Some(b.uid)))
            .attr("Name", &b.name)
            .attr("Destination", dest.reference());
        if depth < 64 {
            for c in b.children.iter().filter_map(|u| doc.bookmarks.get(u)) {
                self.bookmark(x, c, depth + 1, in_text);
            }
        }
        x.end();
    }

    /// `TextVariable` elements, sorted by name as in every corpus IDML.
    /// See docs/format/text-variables.md.
    pub(super) fn text_variables(&self, x: &mut Xml) {
        let mut vars: Vec<_> = self.doc.text_variables.iter().collect();
        vars.sort_by(|a, b| a.name.cmp(&b.name));
        for v in vars {
            let name = variable_name(&v.name);
            x.start("TextVariable")
                .attr("Self", format!("dTextVariablen{name}"))
                .attr("Name", &name);
            if let Some(t) = v.type_name() {
                x.attr("VariableType", t);
            }
            self.variable_preference(x, v);
            x.end();
        }
    }

    /// The settings element of a text variable. Attributes other than the
    /// date format and the running header's style are not located in the
    /// INDD; they are written only for variables whose unidentified fields
    /// hold the values of every corpus sample, and then with the values
    /// those samples have in IDML.
    pub(super) fn variable_preference(&self, x: &mut Xml, v: &TextVariable) {
        let same = v.as_in_samples;
        // The text before and after the value, from the settings
        // (text-variables.md, settings).
        let text = |x: &mut Xml, name: &str| match &v.settings {
            Some(st) => {
                let t = if name == "TextBefore" {
                    &st.before
                } else {
                    &st.after
                };
                x.attr(name, t.replace('\u{3000}', "^("));
            }
            None if same => {
                x.attr(name, "");
            }
            None => {}
        };
        match v.kind {
            0xCAA1 | 0xCAAB | 0xCAAC => {
                x.start("DateVariablePreference");
                text(x, "TextBefore");
                x.attr("Format", &v.text);
                text(x, "TextAfter");
                x.end();
            }
            0xCAAA => {
                x.start("MatchParagraphStylePreference");
                text(x, "TextBefore");
                text(x, "TextAfter");
                x.attr("AppliedParagraphStyle", self.style_ref(v.style, true));
                if let Some(st) = &v.settings {
                    match st.c {
                        0 => {
                            x.attr("SearchStrategy", "FirstOnPage");
                        }
                        1 => {
                            x.attr("SearchStrategy", "LastOnPage");
                        }
                        _ => {}
                    }
                    match st.a {
                        0 | 0xCAC9 => {
                            x.attr("ChangeCase", "None");
                        }
                        0xCAD0 => {
                            x.attr("ChangeCase", "Sentencecase");
                        }
                        _ => {}
                    }
                }
                // Every corpus sample is `false`; no field is known for it
                // (text-variables.md, running headers).
                if same || v.settings.as_ref().is_some_and(|st| st.c <= 1) {
                    x.attr("DeleteEndPunctuation", "false");
                }
                x.end();
            }
            // Chapter numbers: the format code is the first u32
            // (text-variables.md, settings).
            0xCAA9 if v.settings.is_some() => {
                let format = match v.settings.as_ref().map(|st| st.a) {
                    Some(0) => Some("Current"),
                    Some(0x4C15) => Some("Arabic"),
                    _ => None,
                };
                x.start("ChapterNumberVariablePreference");
                text(x, "TextBefore");
                if let Some(f) = format {
                    x.attr("Format", f);
                }
                text(x, "TextAfter");
                x.end();
            }
            _ if !same => {}
            0xCAA3 => {
                x.start("CustomTextVariablePreference")
                    .start("Properties")
                    .start("Contents")
                    .attr("type", "string")
                    .end()
                    .end()
                    .end();
            }
            0xCAA6 => {
                x.empty(
                    "FileNameVariablePreference",
                    &[
                        ("TextBefore", String::new()),
                        ("IncludePath", "false".into()),
                        ("IncludeExtension", "false".into()),
                        ("TextAfter", String::new()),
                    ],
                );
            }
            0xCAA8 => {
                x.empty(
                    "PageNumberVariablePreference",
                    &[
                        ("TextBefore", String::new()),
                        ("Format", "Current".into()),
                        ("TextAfter", String::new()),
                        ("Scope", "SectionScope".into()),
                    ],
                );
            }

            0xCAC0 => {
                x.empty(
                    "CaptionMetadataVariablePreference",
                    &[
                        ("TextBefore", String::new()),
                        ("MetadataProviderName", "$ID/#LinkInfoNameStr".into()),
                        ("TextAfter", String::new()),
                    ],
                );
            }
            _ => {}
        }
    }

    /// Whether a text frame of a master spread shows story `story`.
    fn on_master(&self, story: u32) -> bool {
        fn has(items: &[crate::model::PageItem], story: u32) -> bool {
            items.iter().any(|i| {
                matches!(i.kind, ItemKind::TextFrame { story: Some(s), .. } if s == story)
                    || has(&i.children, story)
            })
        }
        self.doc.master_spreads.iter().any(|s| has(&s.items, story))
    }

    /// A text variable instance in place of its U+0018.
    pub(super) fn variable_instance(&self, x: &mut Xml, v: &Instance, story: u32) {
        let name = variable_name(&v.name);
        x.start("TextVariableInstance")
            .attr("Self", uref(Some(v.uid)))
            .attr("Name", &name);
        // The displayed text is not stored. A file name variable with the
        // sample settings shows the document's name without extension; a
        // running header on a master page shows the variable's name, and a
        // chapter number in the current format the document's number,
        // each between the text before and after (text-variables.md,
        // result text).
        let def = self.doc.text_variables.iter().find(|d| d.name == v.name);
        let around = |d: &TextVariable, t: &str| {
            d.settings
                .as_ref()
                .map(|s| format!("{}{t}{}", s.before, s.after))
        };
        let result = match def {
            Some(d) if d.kind == 0xCAA6 && d.as_in_samples => Some(
                self.name
                    .strip_suffix(".indd")
                    .unwrap_or(&self.name)
                    .to_string(),
            ),
            Some(d) if d.kind == 0xCAAA && self.on_master(story) => {
                around(d, &format!("<{}>", d.name))
            }
            Some(d) if d.kind == 0xCAA9 && d.settings.as_ref().is_some_and(|s| s.a == 0) => self
                .doc
                .prefs
                .values
                .iter()
                .find(|p| p.element == "ChapterNumberPreference" && p.name == "ChapterNumber")
                .and_then(|p| around(d, &p.value)),
            _ => None,
        };
        if let Some(r) = result {
            x.attr("ResultText", r);
        }
        x.attr("AssociatedTextVariable", format!("dTextVariablen{name}"));
        x.end();
    }
}

/// The `Self` of a topic: its parent's `Self`, `Topicn` and its name
/// (`docs/format/index.md`).
fn topic_self(parent: &str, t: &crate::model::index::Topic) -> String {
    format!("{parent}Topicn{}", t.name)
}

/// The `Index` element and its topics.
fn index_xml(x: &mut Xml, index: &crate::model::index::Index) {
    fn topic(x: &mut Xml, parent: &str, t: &crate::model::index::Topic) {
        let me = topic_self(parent, t);
        x.start("Topic")
            .attr("Self", &me)
            .attr("SortOrder", &t.sort_order)
            .attr("Name", &t.name);
        for c in &t.children {
            topic(x, &me, c);
        }
        x.end();
    }
    let me = uref(Some(index.uid));
    x.start("Index").attr("Self", &me);
    for t in &index.topics {
        topic(x, &me, t);
    }
    x.end();
}

/// The `Self` of the topic of each page reference, by page reference UID.
pub(super) fn topic_refs(doc: &Document) -> std::collections::HashMap<u32, String> {
    fn walk(
        out: &mut std::collections::HashMap<u32, String>,
        parent: &str,
        t: &crate::model::index::Topic,
    ) {
        let me = topic_self(parent, t);
        for &r in &t.refs {
            out.insert(r, me.clone());
        }
        for c in &t.children {
            walk(out, &me, c);
        }
    }
    let mut out = std::collections::HashMap::new();
    if let Some(index) = &doc.index {
        let me = uref(Some(index.uid));
        for t in &index.topics {
            walk(&mut out, &me, t);
        }
    }
    out
}

/// `BasedOnMojikumiSet` and the spacing entries of a custom mojikumi
/// table (objects.md, custom mojikumi tables). A code without a known
/// table name leaves the attribute out.
fn custom_mojikumi(x: &mut Xml, m: &crate::model::cjk::MojikumiSettings) {
    let based_on = match m.based_on {
        0 => Some("Nothing"),
        n => super::kind::builtin_cjk_table(&format!("kMojikumiDefaultName{n}")),
    };
    if let Some(b) = based_on {
        x.attr("BasedOnMojikumiSet", b);
    }
    x.start("Properties").start("OverrideMojikumiAkiList");
    for e in &m.entries {
        x.empty(
            "OverrideMojikumiAkiType",
            &[
                ("TargetMojikumiClass", e.target_class.to_string()),
                ("SideMojikumiClass", e.side_class.to_string()),
                ("SideIsAfterTarget", e.side_is_after_target.to_string()),
                ("Minimum", num(e.minimum)),
                ("Desired", num(e.desired)),
                ("Maximum", num(e.maximum)),
                ("CompressionPriority", e.compression_priority.to_string()),
                ("AkiDoesNotFloat", e.aki_does_not_float.to_string()),
            ],
        );
    }
    x.end();
    x.end();
}

/// A TOC entry separator as IDML writes it: `$ID/`, then the text with
/// tab, U+0008, line feed, em space and em dash as `^t`, `^y`, `^n`, `^m`
/// and `^_` (`objects.md`, table of contents styles).
fn toc_separator(s: &str) -> String {
    let mut out = String::from("$ID/");
    for ch in s.chars() {
        match ch {
            '\t' => out.push_str("^t"),
            '\u{8}' => out.push_str("^y"),
            '\n' => out.push_str("^n"),
            '\u{2003}' => out.push_str("^m"),
            '\u{2014}' => out.push_str("^_"),
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::variable::Settings;

    #[test]
    fn writes_running_header_punctuation() {
        let doc = Document::default();
        let w = Writer::for_test(&doc);
        let header = |c, as_in_samples| {
            let v = TextVariable {
                uid: 0x89,
                name: "Running Header".into(),
                kind: 0xCAAA,
                text: String::new(),
                style: None,
                as_in_samples,
                settings: Some(Settings {
                    a: 0xCAC9,
                    b: 0,
                    c,
                    before: String::new(),
                    after: String::new(),
                }),
            };
            let mut x = Xml::new();
            w.variable_preference(&mut x, &v);
            x.finish()
        };
        let out = header(1, false);
        assert!(out.contains("ChangeCase=\"None\""));
        assert!(out.contains("DeleteEndPunctuation=\"false\""));
        // An unknown search strategy may be a flag for it.
        assert!(!header(0x40, false).contains("DeleteEndPunctuation"));
    }
}
