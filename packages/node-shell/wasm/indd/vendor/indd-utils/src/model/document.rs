//! The `Document` model and `Reader::document`, which reads the document
//! object and every class the converter knows into it.
//!
//! Evidence: `docs/format/objects.md` (document object and classes).

use super::*;

/// The XML structure of the document.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct XmlStructure {
    /// The backing story, IDML `XmlStory`.
    pub story: Option<Story>,
    pub elements: BTreeMap<xml::Key, XmlElement>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Document {
    pub version: Version,
    pub layers: Vec<Layer>,
    pub active_layer: Option<u32>,
    /// Document users (chunk 0xA443): flag byte and name.
    pub users: Vec<(u8, String)>,
    /// The script byte of the last document user's name.
    pub users_script: Option<u8>,
    /// The code of the last session in the save history (chunk 0x1D8):
    /// 0x0101 for a session of a Japanese or Chinese edition.
    pub last_session_code: Option<u16>,
    /// Major and minor version of the application of the last session in
    /// the save history (`16.1.0.20` gives 16, 1).
    pub last_session_version: Option<(u32, u32)>,
    /// The third number of that version (`16.1.0.20` gives 0).
    pub last_session_patch: Option<u32>,
    /// The fourth number of that version, the build (`16.1.0.20` gives 20).
    pub last_session_build: Option<u32>,
    /// The platform of the last session: 0 or 3.
    pub last_session_platform: Option<u16>,
    /// The document's label (chunk 0x1630B): key and value, as IDML
    /// writes them.
    pub label: Vec<(String, String)>,
    /// The numbering lists, the default list first.
    pub numbering_lists: Vec<NumberingList>,
    /// Index sort groups (preferences chunk 0x1307E), in order: name,
    /// include flag and the name of the header variant.
    pub index_groups: Vec<(String, bool, Option<String>)>,
    /// The index (class 0x13004) and its topics.
    pub index: Option<super::index::Index>,
    /// The constant shade the document lists (the class 0x5533 object of
    /// lowest UID with a constant shade in chunk 0x5532): its UID and its
    /// u32 and three f64; and its name (chunk 0x5531: a flag byte, 1 for
    /// a built-in key, and the name).
    pub constant_shade: Option<ConstantShade>,
    /// The pasted smooth shades with an axial shading, in UID order.
    pub axial_shades: Vec<AxialShade>,
    /// Assignment objects (class 0x1BE01), in UID order.
    pub assignments: Vec<u32>,
    /// The name of the first assignment, in the language of the edition
    /// that made the document.
    pub assignment_name: Option<String>,
    /// Articles, in the order of document chunk 0x21B03.
    pub articles: Vec<Article>,
    /// Named grids (class 0xCD12, chunk 0xCD28: u32, a flag byte, 1 for
    /// a built-in key, and the name), in UID order.
    pub named_grids: Vec<NamedGrid>,
    /// Motion presets, in the order of chunk 0x2053E of the preferences.
    pub motion_presets: Vec<MotionPreset>,
    pub spreads: Vec<Spread>,
    pub master_spreads: Vec<Spread>,
    pub stories: Vec<Story>,
    pub styles: BTreeMap<u32, Style>,
    pub toc_styles: Vec<TocStyle>,
    /// Custom stroke styles, in UID order.
    pub stroke_styles: Vec<StrokeStyle>,
    pub colors: Vec<Color>,
    /// Mixed inks and mixed ink groups, in UID order.
    pub mixed_inks: Vec<MixedInk>,
    /// Tint swatches, with their IDML reference and name.
    pub tints: Vec<(Tint, String, String)>,
    pub gradients: Vec<Gradient>,
    /// IDML reference (`Color/...`, `Swatch/None`) for each swatch UID.
    pub swatches: BTreeMap<u32, String>,
    /// Font families by UID.
    pub fonts: BTreeMap<u32, FontFamily>,
    /// The language objects (class 0x2D07) in UID order.
    pub language_list: Vec<Language>,
    /// Language name (IDML `AppliedLanguage` without `$ID/`) for each
    /// language UID.
    pub languages: BTreeMap<u32, String>,
    /// Style groups, including the root groups (empty name).
    pub style_groups: BTreeMap<u32, StyleGroup>,
    pub object_styles: BTreeMap<u32, ObjectStyle>,
    pub cell_styles: BTreeMap<u32, TableStyle>,
    pub table_styles: BTreeMap<u32, TableStyle>,
    pub sections: Vec<Section>,
    pub text_variables: Vec<TextVariable>,
    pub hyperlinks: Vec<Hyperlink>,
    pub text_sources: BTreeMap<u32, TextSource>,
    pub page_item_sources: Vec<PageItemSource>,
    pub destinations: Vec<Destination>,
    pub bookmarks: BTreeMap<u32, Bookmark>,
    /// All bookmarks in document order (document chunk 0x13501).
    pub bookmark_order: Vec<u32>,
    /// Cross-reference formats, by UID.
    pub cross_reference_formats: BTreeMap<u32, CrossReferenceFormat>,
    /// Problems that did not stop the conversion (content left out).
    pub warnings: Vec<String>,
    pub preferences: Option<DocumentPreferences>,
    /// Other preference values (`prefs.rs`).
    pub prefs: prefs::Prefs,
    pub composite_fonts: Vec<CompositeFont>,
    /// Kinsoku and mojikumi tables, in UID order.
    pub cjk_tables: Vec<CjkTable>,
    /// Inks, in UID order.
    pub inks: Vec<Ink>,
    /// Colour groups in document order, the root group first.
    pub color_groups: Vec<ColorGroup>,
    /// The bullet characters offered for lists (preferences chunk 0x1A488).
    pub bullets: Vec<Bullet>,
    /// XML tags (class 0xBF19).
    pub xml_tags: Vec<XmlTag>,
    pub xml: XmlStructure,
    /// The dates of the XMP packet that have a UTC offset; link times are
    /// written with their offsets (`objects.md`, link times).
    pub xmp_dates: Vec<super::xmp::XmpDate>,
    /// The black swatch's name in the XMP packet: the language of the
    /// edition that saved the document (`objects.md`, saving edition).
    pub black_name: Option<String>,
    /// `LinkResourceId` by story or text frame UID (document chunk
    /// 0x21D06).
    pub link_source_ids: BTreeMap<u32, u32>,
    /// Document style mappings (chunk 0x21D30 of the preferences).
    pub style_mappings: StyleMappings,
}

/// An article (class 0x21B01): its name (chunk 0x13C) and the UIDs of
/// its member page items (chunk 0x21B02), in order.
#[derive(Debug, Clone, PartialEq)]
pub struct Article {
    pub uid: u32,
    pub name: String,
    pub members: Vec<u32>,
}

/// The stories of the text frames anchored in `story`, in text order
/// (nested items included).
fn anchored_stories(story: &Story) -> Vec<u32> {
    fn walk(items: &[PageItem], out: &mut Vec<u32>) {
        for i in items {
            if let ItemKind::TextFrame { story: Some(s), .. } = i.kind {
                out.push(s);
            }
            walk(&i.children, out);
        }
    }
    let mut out = Vec::new();
    for items in story.anchors.values() {
        walk(items, &mut out);
    }
    out
}

impl Document {
    /// Read the dates and the black name of the XMP packet. IDML names a
    /// tint of black with the black name (`objects.md`, saving edition).
    pub fn read_xmp(&mut self, packet: &[u8]) {
        self.xmp_dates = super::xmp::dates(packet);
        let Some(black) = self.colors.iter().find(|c| c.reference() == "Color/Black") else {
            return;
        };
        let values = black.idml_values();
        let others: Vec<&str> = self
            .colors
            .iter()
            .filter(|c| c.uid != black.uid)
            .map(|c| c.name.as_str())
            .collect();
        let colorants = super::xmp::colorants(packet);
        self.black_name =
            super::xmp::black_name(&colorants, (black.space_name(), &values), &others);
        let (Some(name), uid, bracket) = (&self.black_name, black.uid, black.color_override == 2)
        else {
            return;
        };
        if !bracket {
            return;
        }
        for (t, reference, idml) in &mut self.tints {
            if t.base == uid {
                *idml = t.named(&format!("[{name}]"));
                *reference = Tint::reference_of(idml);
                self.swatches.insert(t.uid, reference.clone());
            }
        }
    }
}

/// An XML tag: its name and colour (red, green, blue).
pub type XmlTag = (String, Option<[f64; 3]>);

/// The objects read from the class list, before they are put together
/// into the `Document`.
#[derive(Default)]
struct ClassObjects {
    styles: BTreeMap<u32, Style>,
    colors: Vec<Color>,
    mixed_inks: Vec<MixedInk>,
    tints: Vec<Tint>,
    gradients: Vec<Gradient>,
    swatches: BTreeMap<u32, String>,
    fonts: BTreeMap<u32, FontFamily>,
    languages: BTreeMap<u32, String>,
    language_list: Vec<Language>,
    style_groups: BTreeMap<u32, StyleGroup>,
    object_styles: BTreeMap<u32, ObjectStyle>,
    cell_styles: BTreeMap<u32, TableStyle>,
    table_styles: BTreeMap<u32, TableStyle>,
    text_variables: Vec<TextVariable>,
    hyperlinks: Vec<Hyperlink>,
    text_sources: BTreeMap<u32, TextSource>,
    page_item_sources: Vec<PageItemSource>,
    destinations: Vec<Destination>,
    bookmarks: BTreeMap<u32, Bookmark>,
    cross_reference_formats: BTreeMap<u32, CrossReferenceFormat>,
    /// Composite fonts: UID, name and entry UIDs.
    composite_fonts: Vec<(u32, Name, Vec<u32>)>,
    composite_entries: HashMap<u32, CompositeFontEntry>,
    cjk_tables: Vec<CjkTable>,
    xml_tags: Vec<XmlTag>,
    xml_tag_names: HashMap<u32, String>,
    inks: Vec<Ink>,
    color_groups: HashMap<u32, ColorGroup>,
}

/// The UID of the document object.
pub(super) const DOC: u32 = 1;

impl<'a> Reader<'a> {
    /// Read the document object and every class the converter knows.
    /// An object that cannot be read is left out with a warning; the
    /// warnings are in `Document::warnings`.
    pub fn document(&self, version: Version) -> Result<Document, Error> {
        self.major.set(version.major);
        // The first layer of the list is the internal layer, whatever its
        // name (objects.md, layers).
        let layers = self
            .uid_list(DOC, chunk::DOC_LAYERS)?
            .into_iter()
            .enumerate()
            .map(|(i, uid)| self.layer(uid, i == 0))
            .collect::<Result<Vec<_>, _>>()?;
        let active_layer = self
            .chunk(DOC, chunk::DOC_ACTIVE_LAYER)?
            .map(|d| self.cursor(&d).u32())
            .transpose()?;
        let (spreads, master_spreads) = self.document_spreads()?;
        let mut stories = self.document_stories()?;
        let xml_story = self.xml_story()?;
        // Stories of text frames anchored in the XML backing story are not
        // in the document's list; IDML writes them after the listed ones
        // (objects.md, stories).
        if let Some(x) = &xml_story {
            let mut known: std::collections::HashSet<u32> = stories.iter().map(|s| s.uid).collect();
            known.insert(x.uid);
            let mut next = anchored_stories(x);
            next.reverse();
            while let Some(uid) = next.pop() {
                if !known.insert(uid) || !matches!(self.class(uid), Some(class::STORY)) {
                    continue;
                }
                match self.story(uid) {
                    Ok(s) => {
                        let mut more = anchored_stories(&s);
                        more.reverse();
                        next.extend(more);
                        stories.push(s);
                    }
                    Err(e) => self.warn(format!("story {uid} left out: {e}")),
                }
            }
        }
        let mut objects = self.class_objects()?;
        // Cell spans depend on insets that cells inherit from styles.
        let table_styles = table::TableStyles::new(&objects.cell_styles, &objects.table_styles);
        for story in &mut stories {
            for t in story.tables.values_mut() {
                t.resolve_spans(&table_styles);
            }
        }
        for story in &mut stories {
            story.orientation = self.story_orientation(story.uid);
        }
        let xml = XmlStructure {
            story: xml_story,
            elements: self.xml_elements(&objects.xml_tag_names)?,
        };
        let tints = self.tints(&mut objects);
        prune_style_groups(&mut objects.style_groups, |m| self.warn(m));
        let preferences = self.document_preferences()?;
        let prefs = self.prefs(version)?;
        let toc_styles = self.toc_styles(version);
        let stroke_styles = self.stroke_styles();
        let named_grids = self.named_grids();
        let motion_presets = self.motion_presets();
        let index_groups = self.index_groups();
        let index = self.index().unwrap_or_else(|e| {
            self.warn(format!("index left out: {e}"));
            None
        });
        let constant_shade = self.constant_shade();
        let axial_shades = self.axial_shades();
        // Page item fills refer to axial shades by UID (objects.md,
        // pasted smooth shades).
        for a in &axial_shades {
            objects
                .swatches
                .insert(a.uid, format!("PastedSmoothShade/u{:x}", a.uid));
        }
        let assignments = self.assignments();
        // The name of the first assignment: a flag byte and a string at the
        // start of chunk 0x1BE1B (objects.md, assignments).
        let assignment_name = match assignments.first() {
            Some(&u) => self
                .chunk(u, chunk::ASSIGNMENT_NAME)
                .ok()
                .flatten()
                .and_then(|d| {
                    let mut c = self.cursor(&d);
                    c.flag().ok()?;
                    c.string().ok()
                }),
            None => None,
        };
        let articles = self.articles();
        let users_script = self.users_script(DOC);
        let last_session = self.last_session(DOC);
        let last_session_platform = self.last_session_platform(DOC);
        let last_session_code = last_session.as_ref().map(|(c, _)| *c);
        let session_number = |i: usize| {
            last_session
                .as_ref()
                .and_then(|(_, v)| v.split('.').nth(i)?.parse::<u32>().ok())
        };
        let last_session_version = session_number(0).zip(session_number(1));
        let last_session_patch = session_number(2);
        let last_session_build = session_number(3);
        let numbering_lists = self.numbering_lists().unwrap_or_else(|e| {
            self.warn(format!("numbering lists left out: {e}"));
            Vec::new()
        });
        let label = self.label(DOC).unwrap_or_else(|e| {
            self.warn(format!("document label left out: {e}"));
            Vec::new()
        });
        let users = self.users(DOC).unwrap_or_else(|e| {
            self.warn(format!("document users left out: {e}"));
            Vec::new()
        });
        let sections = self
            .uid_list(DOC, chunk::DOC_SECTIONS)?
            .into_iter()
            .map(|uid| self.section(uid))
            .collect::<Result<Vec<_>, _>>()?;
        let bookmark_order = match self.chunk(DOC, hyperlink::chunk::DOCUMENT_LISTS)? {
            Some(d) => hyperlink::document_bookmarks(self.enc(), &d, version.major)?,
            None => Vec::new(),
        };
        let composite_fonts = objects
            .composite_fonts
            .into_iter()
            .map(|(uid, name, entries)| CompositeFont {
                uid,
                name,
                entries: entries
                    .iter()
                    .filter_map(|e| objects.composite_entries.get(e).cloned())
                    .collect(),
            })
            .collect();
        let color_groups = self
            .color_group_order()?
            .into_iter()
            .filter_map(|u| objects.color_groups.remove(&u))
            .collect();
        let bullets = self.bullets()?;
        let link_source_ids = self.link_source_ids().unwrap_or_else(|e| {
            self.warn(format!("link source IDs left out: {e}"));
            BTreeMap::new()
        });
        let style_mappings = self.document_style_mappings();
        Ok(Document {
            version,
            layers,
            active_layer,
            spreads,
            master_spreads,
            stories,
            styles: objects.styles,
            colors: objects.colors,
            mixed_inks: objects.mixed_inks,
            tints,
            gradients: objects.gradients,
            swatches: objects.swatches,
            fonts: objects.fonts,
            languages: objects.languages,
            language_list: objects.language_list,
            toc_styles,
            stroke_styles,
            named_grids,
            motion_presets,
            index_groups,
            index,
            constant_shade,
            axial_shades,
            assignments,
            assignment_name,
            articles,
            style_groups: objects.style_groups,
            object_styles: objects.object_styles,
            cell_styles: objects.cell_styles,
            table_styles: objects.table_styles,
            users,
            users_script,
            last_session_code,
            last_session_version,
            last_session_patch,
            last_session_build,
            last_session_platform,
            label,
            numbering_lists,
            sections,
            text_variables: objects.text_variables,
            hyperlinks: objects.hyperlinks,
            text_sources: objects.text_sources,
            page_item_sources: objects.page_item_sources,
            destinations: objects.destinations,
            bookmarks: objects.bookmarks,
            bookmark_order,
            cross_reference_formats: objects.cross_reference_formats,
            preferences,
            prefs,
            composite_fonts,
            cjk_tables: objects.cjk_tables,
            inks: objects.inks,
            color_groups,
            bullets,
            xml_tags: objects.xml_tags,
            xml,
            xmp_dates: Vec::new(),
            black_name: None,
            link_source_ids,
            style_mappings,
            // Last, so that it holds every warning of the model.
            warnings: self.warnings.borrow().clone(),
        })
    }

    /// The spreads and master spreads of the document, with the page
    /// layout of each page resolved. A spread that cannot be read is left
    /// out with a warning.
    fn document_spreads(&self) -> Result<(Vec<Spread>, Vec<Spread>), Error> {
        let mut spreads =
            self.each_or_warn("spread", chunk::DOC_SPREADS, |u| self.spread(u).map(Some))?;
        let mut master_spreads =
            self.each_or_warn("master spread", chunk::DOC_MASTER_SPREADS, |u| {
                self.spread(u).map(Some)
            })?;
        resolve_page_layout(&mut spreads, &mut master_spreads);
        Ok((spreads, master_spreads))
    }

    /// The stories the document lists. A story that cannot be read is
    /// left out with a warning.
    fn document_stories(&self) -> Result<Vec<Story>, Error> {
        self.each_or_warn("story", chunk::DOC_STORIES, |uid| match self.class(uid) {
            Some(class::STORY | class::ENDNOTE_STORY) => self.story(uid).map(Some),
            _ => Ok(None),
        })
    }

    /// Read each object of the document's UID list `list` with `read`.
    /// An object that cannot be read is left out with a warning that
    /// calls it `what`.
    fn each_or_warn<T>(
        &self,
        what: &str,
        list: u32,
        read: impl Fn(u32) -> Result<Option<T>, Error>,
    ) -> Result<Vec<T>, Error> {
        let mut out = Vec::new();
        for uid in self.uid_list(DOC, list)? {
            match read(uid) {
                Ok(Some(t)) => out.push(t),
                Ok(None) => {}
                Err(e) => self.warn(format!("{what} {uid} left out: {e}")),
            }
        }
        Ok(out)
    }

    /// The backing story of the XML structure: the document's chunk
    /// 0xBF14 names it and the document node.
    fn xml_story(&self) -> Result<Option<Story>, Error> {
        Ok(match self.chunk(DOC, xml::chunk::NODE_REF)? {
            Some(d) if d.len() >= 4 => {
                let s = self.cursor(&d).u32()?;
                match self.class(s) {
                    Some(class::STORY) => self
                        .story(s)
                        .map_err(|e| self.warn(format!("XML story {s} left out: {e}")))
                        .ok(),
                    _ => None,
                }
            }
            _ => None,
        })
    }

    /// Assignment objects (class 0x1BE01), in UID order.
    fn assignments(&self) -> Vec<u32> {
        let mut a: Vec<u32> = self
            .db
            .classes()
            .iter()
            .filter(|&&(_, c)| c == class::ASSIGNMENT)
            .map(|&(u, _)| u)
            .collect();
        a.sort_unstable();
        a
    }

    /// The articles listed in document chunk 0x21B03, each once. A listed
    /// object that is not an article is skipped; an article without a
    /// readable name or member list is left out with a warning.
    pub(super) fn articles(&self) -> Vec<Article> {
        let order = self.uid_list(DOC, chunk::DOC_ARTICLES).unwrap_or_else(|e| {
            self.warn(format!("articles left out: {e}"));
            Vec::new()
        });
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for uid in order {
            if self.class(uid) != Some(class::ARTICLE) || !seen.insert(uid) {
                continue;
            }
            match self.article(uid) {
                Ok(Some(a)) => out.push(a),
                Ok(None) => self.warn(format!("article {uid} left out: no name")),
                Err(e) => self.warn(format!("article {uid} left out: {e}")),
            }
        }
        out
    }

    fn article(&self, uid: u32) -> Result<Option<Article>, Error> {
        let obj = self.object(uid)?;
        let Some(d) = obj.chunk(chunk::ARTICLE_NAME) else {
            return Ok(None);
        };
        let mut c = self.cursor(d);
        c.flag()?;
        let name = c.string()?;
        let members = match obj.chunk(chunk::ARTICLE_MEMBERS) {
            Some(d) => self.cursor(d).u32_list()?,
            None => Vec::new(),
        };
        Ok(Some(Article { uid, name, members }))
    }

    /// Read every object of the class list whose class the converter
    /// knows. An object that cannot be read is left out with a warning.
    fn class_objects(&self) -> Result<ClassObjects, Error> {
        let mut out = ClassObjects::default();
        for &(uid, cls) in self.db.classes() {
            if self.db.object(uid)?.is_none() {
                continue;
            }
            if let Err(e) = self.class_object(&mut out, uid, cls) {
                self.warn(format!("object {uid} (class {cls:#x}) left out: {e}"));
            }
        }
        Ok(out)
    }

    /// Read one object of the class list into `out`.
    fn class_object(&self, out: &mut ClassObjects, uid: u32, cls: u32) -> Result<(), Error> {
        match cls {
            class::STYLE_ROOT_GROUP
            | class::OBJECT_STYLE_ROOT_GROUP
            | class::CELL_STYLE_ROOT_GROUP
            | class::TABLE_STYLE_ROOT_GROUP => {
                out.style_groups.insert(uid, self.style_root_group(uid)?);
            }
            class::STYLE_GROUP => {
                out.style_groups.insert(uid, self.style_group(uid)?);
            }
            class::OBJECT_STYLE => {
                if let Some(s) = self.object_style(uid)? {
                    out.object_styles.insert(uid, s);
                }
            }
            class::STYLE => {
                if let Some(style) = self.style(uid)? {
                    out.styles.insert(uid, style);
                }
            }
            table::class::CELL_STYLE => {
                if let Some(s) = self.table_style(uid, table::chunk::CELL_STYLE_ATTRS)? {
                    out.cell_styles.insert(uid, s);
                }
            }
            table::class::TABLE_STYLE => {
                if let Some(s) = self.table_style(uid, table::chunk::TABLE_STYLE_ATTRS)? {
                    out.table_styles.insert(uid, s);
                }
            }
            color::class::COLOR => self.color_object(out, uid)?,
            color::class::SWATCH_NONE => {
                out.swatches.insert(uid, "Swatch/None".into());
            }
            color::class::GRADIENT => {
                if let Some(g) = self.gradient(uid)? {
                    out.swatches.insert(uid, g.reference());
                    out.gradients.push(g);
                }
            }
            class::FONT_FAMILY => {
                if let Some(f) = self.font_family(uid)? {
                    out.fonts.insert(uid, f);
                }
            }
            class::TEXT_VARIABLE => {
                if let Some(v) = TextVariable::read(uid, &*self.object(uid)?)? {
                    out.text_variables.push(v);
                }
            }
            hyperlink::class::HYPERLINK => {
                if let Some(h) = Hyperlink::read(uid, &*self.object(uid)?, self.major.get())? {
                    out.hyperlinks.push(h);
                }
            }
            hyperlink::class::TEXT_SOURCE => {
                if let Some(s) = TextSource::read(uid, &*self.object(uid)?)? {
                    out.text_sources.insert(uid, s);
                }
            }
            hyperlink::class::PAGE_ITEM_SOURCE => {
                if let Some(s) = PageItemSource::read(uid, &*self.object(uid)?)? {
                    out.page_item_sources.push(s);
                }
            }
            hyperlink::class::PAGE_DESTINATION
            | hyperlink::class::URL_DESTINATION
            | hyperlink::class::EXTERNAL_PAGE_DESTINATION
            | hyperlink::class::TEXT_DESTINATION => {
                if let Some(d) = self.destination(uid, cls)? {
                    out.destinations.push(d);
                }
            }
            xref::CLASS => {
                if let Some(f) = CrossReferenceFormat::read(uid, &*self.object(uid)?)? {
                    out.cross_reference_formats.insert(uid, f);
                }
            }
            hyperlink::class::BOOKMARK => {
                if let Some(b) = Bookmark::read(uid, &*self.object(uid)?)? {
                    out.bookmarks.insert(uid, b);
                }
            }
            cjk::class::COMPOSITE_FONT => {
                if let Some((name, entries)) = CompositeFont::read(&*self.object(uid)?)? {
                    out.composite_fonts.push((uid, name, entries));
                }
            }
            cjk::class::COMPOSITE_FONT_ENTRY => {
                if let Some(e) = CompositeFontEntry::read(uid, &*self.object(uid)?)? {
                    out.composite_entries.insert(uid, e);
                }
            }
            c if c == cjk::class::MOJIKUMI
                || c == cjk::class::CUSTOM_MOJIKUMI
                || cjk::class::KINSOKU.contains(&c) =>
            {
                if let Some(t) = CjkTable::read(uid, c, &*self.object(uid)?)? {
                    out.cjk_tables.push(t);
                }
            }
            color::class::INK => {
                if let Some(i) = self.ink(uid)? {
                    out.inks.push(i);
                }
            }
            color::class::COLOR_GROUP => {
                if let Some(g) = ColorGroup::read(uid, &*self.object(uid)?)? {
                    out.color_groups.insert(uid, g);
                }
            }
            class::XML_TAG => {
                if let Some((name, color)) = self.xml_tag(uid)? {
                    out.xml_tag_names.insert(uid, name.clone());
                    out.xml_tags.push((name, color));
                }
            }
            class::LANGUAGE => {
                if let Some((name, language)) = self.language(uid)? {
                    out.languages.insert(uid, name);
                    out.language_list.extend(language);
                }
            }
            _ => {}
        }
        Ok(())
    }

    /// A colour object (class 0x200): a colour or a tint.
    fn color_object(&self, out: &mut ClassObjects, uid: u32) -> Result<(), Error> {
        let obj = self.object(uid)?;
        if let Some(c) = Color::read(uid, &obj)? {
            // A member of a mixed ink group takes its inks from the group.
            let group = match obj.chunk(color::chunk::TINT_BASE) {
                Some(d) if c.space == color::Space::Other(9) => {
                    let g = self.cursor(d).u32()?;
                    if g != uid && self.class(g) == Some(color::class::COLOR) {
                        Some(self.object(g)?)
                    } else {
                        None
                    }
                }
                _ => None,
            };
            if let Some(m) = MixedInk::read(&c, &obj, group.as_deref())? {
                out.swatches.insert(uid, m.reference());
                out.mixed_inks.push(m);
                return Ok(());
            }
            if c.model_name().is_none() {
                self.warn(format!(
                    "colour {uid}: colour model code {} is not known; left out",
                    c.model
                ));
            }
            out.swatches.insert(uid, c.reference());
            out.colors.push(c);
        } else if let Some(t) = Tint::read(uid, &obj)? {
            out.tints.push(t);
        }
        Ok(())
    }

    /// A gradient, with a warning for each midpoint IDML cannot hold.
    fn gradient(&self, uid: u32) -> Result<Option<Gradient>, Error> {
        let Some(g) = Gradient::read(uid, &*self.object(uid)?)? else {
            return Ok(None);
        };
        for i in 1..g.stops.len() {
            if g.idml_midpoint(i).is_none() {
                self.warn(format!(
                    "gradient {uid}: midpoint before stop {i} is not \
                     within 13–87 %; left out"
                ));
            }
        }
        Ok(Some(g))
    }

    /// A font family. If its fonts cannot be read, the family keeps its
    /// name, which text formatting refers to.
    fn font_family(&self, uid: u32) -> Result<Option<FontFamily>, Error> {
        // A family that refers to another (fonts.md).
        if let Some((target, count)) = self
            .chunk(uid, font::chunk::FAMILY)?
            .and_then(|d| font::reference(self.enc(), &d))
        {
            let family = match self.class(target) {
                Some(class::FONT_FAMILY) if target != uid => {
                    let object = self.object(target)?;
                    match object.chunk(font::chunk::FAMILY) {
                        Some(d) if font::reference(self.enc(), d).is_none() => {
                            FontFamily::read(target, &object).ok().flatten()
                        }
                        _ => None,
                    }
                }
                _ => None,
            };
            let Some(family) = family else {
                self.warn(format!(
                    "font family {uid}: refers to family {target}, which cannot be read; left out"
                ));
                return Ok(None);
            };
            if count != 0 {
                self.warn(format!(
                    "font family {uid}: refers to family {target} and lists {count} \
                     fonts of its own; fonts left out"
                ));
                return Ok(Some(FontFamily {
                    fonts: Vec::new(),
                    ..family.referring(uid)
                }));
            }
            return Ok(Some(family.referring(uid)));
        }
        match FontFamily::read(uid, &*self.object(uid)?) {
            Ok(Some(f)) => {
                if i32::try_from(f.writing_script).is_err() {
                    self.warn(format!(
                        "font family {uid}: writing script {:#x} is not an IDML \
                         integer; left out",
                        f.writing_script
                    ));
                }
                Ok(Some(f))
            }
            Ok(None) => Ok(None),
            Err(e) => {
                self.warn(format!("font family {uid}: fonts left out: {e}"));
                Ok(match self.chunk(uid, font::chunk::FAMILY)? {
                    Some(d) => Some(FontFamily {
                        uid,
                        name: find_string(self.enc(), &d, 0)?,
                        builtin: false,
                        native_name: String::new(),
                        fonts: Vec::new(),
                        writing_script: 0,
                    }),
                    None => None,
                })
            }
        }
    }

    /// A page, URL, external page or text destination.
    fn destination(&self, uid: u32, cls: u32) -> Result<Option<Destination>, Error> {
        let mut d = Destination::read(uid, cls, &*self.object(uid)?)?;
        // The file name of an external page destination is the last part
        // of its link's URI (hyperlinks.md).
        if let Some(hyperlink::DestinationKind::ExternalPage {
            link: Some(link),
            file_name,
            ..
        }) = d.as_mut().map(|d| &mut d.kind)
            && let Some((l, _)) = self.link(*link)?
        {
            *file_name = l
                .uri
                .rsplit('/')
                .next()
                .filter(|n| !n.is_empty())
                .map(percent_decode);
        }
        if let Some(hyperlink::DestinationKind::Page { zoom: None, .. }) =
            d.as_ref().map(|d| &d.kind)
        {
            self.warn(format!(
                "destination {uid}: view zoom is outside 5–4000 %; left out"
            ));
        }
        Ok(d)
    }

    /// An ink, with a warning if its neutral density cannot be written.
    fn ink(&self, uid: u32) -> Result<Option<Ink>, Error> {
        let i = Ink::read(uid, &*self.object(uid)?)?;
        if i.as_ref().is_some_and(|i| i.neutral_density.is_none()) {
            self.warn(format!(
                "ink {uid}: neutral density is outside 0.001–10; left out"
            ));
        }
        Ok(i)
    }

    /// The tint swatches, with their IDML reference and name. Each tint
    /// is added to `objects.swatches`; a tint whose base colour has no
    /// name is left out with a warning.
    fn tints(&self, objects: &mut ClassObjects) -> Vec<(Tint, String, String)> {
        let mut tints = Vec::new();
        for t in std::mem::take(&mut objects.tints) {
            match objects
                .colors
                .iter()
                .find(|c| c.uid == t.base && !c.name.is_empty())
            {
                Some(base) => {
                    let reference = t.reference(base);
                    objects.swatches.insert(t.uid, reference.clone());
                    tints.push((t.clone(), reference, t.idml_name(base)));
                }
                None => self.warn(format!(
                    "tint {}: left out: base colour {} has no name",
                    t.uid, t.base
                )),
            }
        }
        tints
    }

    /// An XML tag (class 0xBF19): its name and colour. Chunk 0xBF2F: u32
    /// length, then the name as text segments; chunk 0x117: the UID of
    /// the tag's colour.
    fn xml_tag(&self, uid: u32) -> Result<Option<XmlTag>, Error> {
        let Some(d) = self.chunk(uid, chunk::XML_TAG_NAME)? else {
            return Ok(None);
        };
        let mut c = self.cursor(&d);
        let n = c.u32()? as usize;
        // Files from InDesign 2.0 to 4.0 hold a flag byte and an in-object
        // string instead.
        let name = match c.segments(n) {
            Ok(name) => name,
            Err(_) => {
                let mut c = self.cursor(&d);
                c.flag()?;
                c.string()?
            }
        };
        let color = match self.chunk(uid, chunk::XML_TAG_COLOR)? {
            Some(d) if d.len() >= 4 => self.ui_color(self.cursor(&d).u32()?)?,
            _ => None,
        };
        Ok(Some((name, color)))
    }
}

/// `s` with `%xx` escapes replaced by their bytes, read as UTF-8.
pub(crate) fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%'
            && let Some(v) = s
                .get(i + 1..i + 3)
                .and_then(|h| u8::from_str_radix(h, 16).ok())
        {
            out.push(v);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod percent_tests {
    use super::percent_decode;

    #[test]
    fn decodes_percent_escapes() {
        assert_eq!(percent_decode("Ch%201%20%C3%A9.indd"), "Ch 1 é.indd");
        assert_eq!(percent_decode("100%"), "100%");
    }
}
