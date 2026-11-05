//! Stories: text, paragraph and character runs, anchored objects, tables,
//! text variables, orientation and XML markers.
//!
//! Evidence: `docs/format/objects.md` (stories and strands),
//! `attributes.md`, `tables.md` and `xml.md`.

use super::*;

/// A stretch of story text with one paragraph style and one character style.
#[derive(Debug, Clone, PartialEq)]
pub struct TextRun {
    /// UTF-16 offset of the run in the story text.
    pub start: usize,
    pub text: String,
    pub paragraph_style: Option<u32>,
    pub character_style: Option<u32>,
    /// Local paragraph formatting.
    pub paragraph_attrs: Attrs,
    /// Local character formatting.
    pub character_attrs: Attrs,
    /// Index of the paragraph-style run record that holds the run. IDML
    /// starts a paragraph range at every record, even between records with
    /// the same formatting (objects.md, stories).
    pub paragraph_run: usize,
}

/// An index marker: a page reference (class 0x13006) owned by a U+FEFF.
/// See `docs/format/index.md`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct IndexMarker {
    pub uid: u32,
    /// `Id`: the u32 at 26 of a 30-byte chunk 0x13009.
    pub id: Option<u32>,
    /// The first 14 bytes of chunk 0x13009 are those of every sample,
    /// whose IDML has `PageReferenceType="CurrentPage"`.
    pub current_page: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Story {
    pub uid: u32,
    pub runs: Vec<TextRun>,
    /// Page items anchored in the text, by UTF-16 offset of their U+FFFC.
    pub anchors: BTreeMap<usize, Vec<PageItem>>,
    /// Tables, by UTF-16 offset of their U+0016.
    pub tables: BTreeMap<usize, Table>,
    /// Text variable instances, by UTF-16 offset of their U+0018.
    pub text_variables: BTreeMap<usize, variable::Instance>,
    /// Hyperlink text sources, sorted by start.
    pub sources: Vec<SourceRange>,
    /// XML markers, by UTF-16 offset of their U+FEFF.
    pub xml_markers: BTreeMap<usize, XmlMarker>,
    /// Footnotes, by UTF-16 offset of their reference (U+0004).
    pub footnotes: BTreeMap<usize, Footnote>,
    /// InDesign notes, by UTF-16 offset of their anchor (U+FEFF).
    pub notes: BTreeMap<usize, Note>,
    /// Deleted texts of tracked changes, by UTF-16 offset of the character
    /// that follows the deletion.
    pub deletions: BTreeMap<usize, Vec<Deletion>>,
    /// Tracked-change runs (strand run kind 0xA466) that have entries,
    /// sorted by start.
    pub changes: Vec<ChangeRun>,
    /// Index markers (`PageReference`), by UTF-16 offset of their
    /// U+FEFF.
    pub index_markers: BTreeMap<usize, IndexMarker>,
    /// Endnote references, by UTF-16 offset of their U+0004: the endnote
    /// UID and the UID of its range.
    pub endnotes: BTreeMap<usize, (u32, u32)>,
    /// The story is the endnote story (class 0x2801).
    pub is_endnote: bool,
    /// Endnote text ranges (in the endnote story), sorted by start; each
    /// lies within one text run. `source` is the range UID.
    pub endnote_ranges: Vec<EndnoteRange>,
    /// Text and paragraph destinations, by UTF-16 offset of their U+FEFF.
    pub text_destinations: BTreeMap<usize, Vec<Destination>>,
    /// The XML element whose content is this story.
    pub xml_element: Option<xml::Key>,
    /// Text orientation, from the frames that show the story; `None` when
    /// it has no frame or its frames disagree.
    pub orientation: Option<Orientation>,
    /// The TOC style that made the story (chunk 0x8C40).
    pub toc_style: Option<u32>,
    /// Story settings in their own chunks.
    pub settings: StoryChunks,
}

/// Settings of a story stored in its own chunks (`docs/format/objects.md`,
/// stories). `None` where the story has no chunk.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StoryChunks {
    /// `StoryTitle` as IDML writes it (chunk 0xA44C).
    pub title: Option<String>,
    /// Chunk 0x50F96: u16.
    pub direction: Option<u16>,
    /// Chunk 0x2EE: `OpticalMarginSize` and the alignment u16.
    pub optical_margin: Option<(f64, u16)>,
    /// Chunk 0x2EE: the text orientation u16 at 0 and the frame type u16
    /// at 14.
    pub layout: Option<(u16, u16)>,
    /// Chunk 0xCD02: the layout grid of a frame grid story.
    pub grid: Option<GridData>,
    /// Chunk 0xCD32: the applied named grid (`Reader::applied_named_grid`).
    pub named_grid: Option<Option<u32>>,
    /// Link, style mappings and import options of a linked or placed
    /// story.
    pub linked: StoryLinkChunks,
}

/// A footnote: its text runs, at their offsets in the story text, which
/// holds the footnote text after the story's own (footnotes.md).
#[derive(Debug, Clone, PartialEq)]
pub struct Footnote {
    pub uid: u32,
    pub runs: Vec<TextRun>,
}

/// An InDesign note: its text runs, at their offsets in the story text,
/// and chunk 0xA412 (`docs/format/objects.md`, notes).
#[derive(Debug, Clone, PartialEq)]
pub struct Note {
    pub uid: u32,
    pub runs: Vec<TextRun>,
    pub user: String,
    /// Creation and modification times (FILETIME, UTC).
    pub created: u64,
    pub modified: u64,
}

/// Deleted text of a tracked change (class 0xA40A): its text runs, at
/// their offsets in the story text.
#[derive(Debug, Clone, PartialEq)]
pub struct Deletion {
    pub uid: u32,
    pub runs: Vec<TextRun>,
}

/// A run of the tracked-change strand (run kind 0xA466).
#[derive(Debug, Clone, PartialEq)]
pub struct ChangeRun {
    /// UTF-16 offset and length.
    pub start: usize,
    pub len: usize,
    pub entries: Vec<ChangeEntry>,
}

/// One entry of a tracked-change run.
#[derive(Debug, Clone, PartialEq)]
pub struct ChangeEntry {
    /// 1: a deletion at the start of the run; 2: the run was inserted.
    pub kind: u16,
    pub user: String,
    /// FILETIME, UTC.
    pub time: u64,
}

impl ChangeEntry {
    pub fn is_deletion(&self) -> bool {
        self.kind == 1
    }

    pub fn is_insertion(&self) -> bool {
        self.kind == 2
    }
}

/// The text of an endnote in the endnote story.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EndnoteRange {
    /// UTF-16 offset in the story text.
    pub start: usize,
    pub len: usize,
    /// The range object (class 0x2804).
    pub uid: u32,
    /// The endnote it belongs to (class 0x2805).
    pub endnote: u32,
}

/// Text orientation of a story (IDML `StoryOrientation`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Orientation {
    Horizontal,
    Vertical,
}

/// What an XML marker character (U+FEFF) in story text stands for.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum XmlMarker {
    /// The start of an element that holds the text up to its end marker.
    Start(xml::Key),
    End(xml::Key),
    /// An element that is a single marker; its content is elsewhere.
    Placeholder(xml::Key),
    /// A marker that IDML does not write: the start of the document node,
    /// or a marker of an element that is left out.
    Hidden,
}

/// An XML element that can be written, with its IDML values.
#[derive(Debug, Clone, PartialEq)]
pub struct XmlElement {
    /// IDML `Self`.
    pub name: String,
    /// Tag name (IDML `MarkupTag` without `XMLTag/`).
    pub tag: String,
    /// UID written as `XMLContent`.
    pub content: Option<u32>,
    /// The content is a story.
    pub story_content: bool,
    /// Attribute names and values, in stored order.
    pub attributes: Vec<(String, String)>,
}

/// The UTF-16 offset of each character of `text`, where a surrogate pair is
/// one character, followed by the length of `text`.
pub(super) fn char_offsets(text: &[u16]) -> Vec<usize> {
    let mut out = Vec::with_capacity(text.len() + 1);
    let mut i = 0;
    while i < text.len() {
        out.push(i);
        let pair = (0xD800..0xDC00).contains(&text[i])
            && text
                .get(i + 1)
                .is_some_and(|u| (0xDC00..0xE000).contains(u));
        i += if pair { 2 } else { 1 };
    }
    out.push(text.len());
    out
}

/// Combine text with paragraph-style and character-style run lengths
/// (counted in UTF-16 code units) into runs with both styles constant.
pub(super) type StyleRun = (usize, u32, Attrs);

pub(super) fn split_runs(
    utf16: &[u16],
    para: &[StyleRun],
    chars: &[StyleRun],
    extra: &[usize],
) -> Vec<TextRun> {
    let mut cuts: Vec<usize> = vec![0, utf16.len()];
    cuts.extend(extra.iter().map(|&c| c.min(utf16.len())));
    for list in [para, chars] {
        let mut pos = 0;
        for (len, _, _) in list {
            pos += len;
            cuts.push(pos.min(utf16.len()));
        }
    }
    cuts.sort_unstable();
    cuts.dedup();
    let run_at = |list: &[StyleRun], at: usize| -> Option<(Option<u32>, Attrs, usize)> {
        let mut pos = 0;
        for (k, (len, style, attrs)) in list.iter().enumerate() {
            if at < pos + len {
                return Some((uid_or_none(*style), attrs.clone(), k));
            }
            pos += len;
        }
        None
    };
    cuts.windows(2)
        .filter(|w| w[0] < w[1])
        .map(|w| {
            let (paragraph_style, paragraph_attrs, paragraph_run) =
                run_at(para, w[0]).unwrap_or_default();
            let (character_style, character_attrs, _) = run_at(chars, w[0]).unwrap_or_default();
            TextRun {
                start: w[0],
                text: String::from_utf16_lossy(&utf16[w[0]..w[1]]),
                paragraph_style,
                character_style,
                paragraph_attrs,
                character_attrs,
                paragraph_run,
            }
        })
        .collect()
}

impl<'a> Reader<'a> {
    /// The text orientation shared by all frames of a story. A story
    /// whose frames disagree, or have an orientation that is not known,
    /// gets none, with a warning.
    pub(super) fn story_orientation(&self, story: u32) -> Option<Orientation> {
        let map = self.frame_orientations.borrow();
        let frames = map.get(&story)?;
        let first = frames[0];
        if first.is_none() || frames.iter().any(|&o| o != first) {
            self.warn(format!(
                "story {story}: text orientation of its frames is not known or differs; written as horizontal"
            ));
            return None;
        }
        first
    }

    pub(super) fn story(&self, uid: u32) -> Result<Story, Error> {
        let data = self.required(uid, chunk::STORY_STRANDS)?;
        let mut c = self.cursor(&data);
        c.skip(6)?;
        let mut strands = vec![c.u32()?];
        strands.extend(c.u32_list()?);
        let mut text: Vec<u16> = Vec::new();
        let mut para: Vec<StyleRun> = Vec::new();
        let mut chars: Vec<StyleRun> = Vec::new();
        let mut owned: Vec<(usize, u32, u32)> = Vec::new();
        // (start, length, entries) of the tracked-change runs.
        let mut changes: Vec<(usize, usize, Vec<ChangeEntry>)> = Vec::new();
        // (start, length, owner, cell) for each stretch of text.
        let mut owners: Vec<(usize, usize, u32, u32)> = Vec::new();
        let mut sources = Vec::new();
        let mut marker_strand = None;
        for strand in strands {
            // A strand without data occurs in a file from InDesign 3.0.
            if self.db.object(strand)?.is_none() {
                continue;
            }
            if self.class(strand) == Some(xml::class::MARKER_STRAND) {
                marker_strand = Some(strand);
            }
            if self.class(strand) == Some(hyperlink::class::RANGE_STRAND)
                && let Some(tree) = self.chunk(strand, hyperlink::chunk::RANGE_TREE)?
                && let Some(first) = self.enc().u32_at(&tree, 0)
            {
                let pages = |uid| self.chunk(uid, hyperlink::chunk::RANGE_PAGE);
                match hyperlink::source_ranges(self.enc(), first, pages) {
                    Ok(r) => sources.extend(r),
                    Err(e) => self.warn(format!("story {uid}: hyperlink sources left out: {e}")),
                }
            }
            let Some(list) = self.chunk(strand, chunk::STRAND_DATA)? else {
                continue;
            };
            let mut c = self.cursor(&list);
            let n = c.u16()?;
            let mut base = 0usize;
            for _ in 0..n {
                let data_len = c.u32()? as usize;
                let data_uid = c.u32()?;
                let runs = self.required(data_uid, chunk::STRAND_RUNS)?;
                let mut r = self.cursor(&runs);
                let kind = r.u32()?;
                r.skip(4)?;
                let count = r.u16()?;
                let mut pos = base;
                base += data_len;
                for _ in 0..count {
                    let size = r.u32()? as usize;
                    let rec = r.bytes(size)?;
                    let mut rc = self.cursor(rec);
                    let len = rc.u32()? as usize;
                    let start = pos;
                    pos += len;
                    match kind {
                        strand::OWNED_ITEMS => {
                            let n = rc.u16()?;
                            for _ in 0..n {
                                let class = rc.u32()?;
                                let item = rc.u32()?;
                                owned.push((start, class, item));
                            }
                        }
                        strand::TEXT => {
                            text.extend(rc.segment_units(len)?);
                        }
                        strand::TEXT_OWNER => {
                            let owner = rc.u32()?;
                            let cell = rc.u32()?;
                            owners.push((start, len, owner, cell));
                        }
                        strand::CHANGES => {
                            let n = rc.u16()?;
                            let mut entries = Vec::new();
                            for _ in 0..n {
                                rc.flag()?;
                                let user = rc.string()?;
                                let kind = rc.u16()?;
                                let time = (u64::from(rc.u32()?) << 32) | u64::from(rc.u32()?);
                                rc.skip(2)?;
                                entries.push(ChangeEntry { kind, user, time });
                            }
                            if !entries.is_empty() {
                                changes.push((start, len, entries));
                            }
                        }
                        strand::PARAGRAPH_STYLE | strand::CHARACTER_STYLE => {
                            let style = rc.u32()?;
                            let n = rc.u16()? as usize;
                            let attrs = self
                                .attrs_or_warn(
                                    || format!("story {uid}, text formatting"),
                                    Attrs::parse_text(&mut rc, n, List::Text, self.db.recorder()),
                                )
                                .unwrap_or_default();
                            let list = if kind == strand::PARAGRAPH_STYLE {
                                &mut para
                            } else {
                                &mut chars
                            };
                            list.push((len, style, attrs));
                        }
                        strand::RUBY => {}
                        _ => {
                            if let Some(r) = self.db.recorder() {
                                r.unknown_strand_kind(kind)
                            }
                        }
                    }
                }
            }
        }
        // InDesign 5.0 text sources: items owned at their first and last
        // character (hyperlinks.md).
        if self.major.get() <= 5 {
            let ends: HashMap<u32, usize> = owned
                .iter()
                .filter(|o| o.1 == hyperlink::class::SOURCE_END)
                .map(|o| (o.2, o.0))
                .collect();
            for &(pos, cls, item) in &owned {
                if cls != hyperlink::class::SOURCE_START {
                    continue;
                }
                if let Some(&(source, end)) = self.source_markers()?.get(&item)
                    && let Some(&last) = ends.get(&end)
                    && last >= pos
                {
                    sources.push(SourceRange {
                        start: pos,
                        len: last + 1 - pos,
                        source,
                        paragraph: false,
                    });
                }
            }
        }
        // Text records count UTF-16 code units, every other strand counts
        // characters (a surrogate pair is one position). Convert the
        // positions to UTF-16 offsets.
        let offsets = char_offsets(&text);
        let unit = |p: usize| match offsets.get(p) {
            Some(&u) => u,
            None => text.len() + (p + 1 - offsets.len()),
        };
        let to_units = |list: Vec<StyleRun>| -> Vec<StyleRun> {
            let mut at = 0;
            list.into_iter()
                .map(|(len, style, attrs)| {
                    let n = unit(at + len) - unit(at);
                    at += len;
                    (n, style, attrs)
                })
                .collect()
        };
        let para = to_units(para);
        let chars = to_units(chars);
        let owned: Vec<_> = owned
            .into_iter()
            .map(|(p, cls, item)| (unit(p), cls, item))
            .collect();
        let owners: Vec<_> = owners
            .into_iter()
            .map(|(p, len, owner, cell)| (unit(p), unit(p + len) - unit(p), owner, cell))
            .collect();
        let changes: Vec<ChangeRun> = changes
            .into_iter()
            .map(|(p, len, entries)| ChangeRun {
                start: unit(p),
                len: unit(p + len) - unit(p),
                entries,
            })
            .collect();
        for r in &mut sources {
            let start = unit(r.start);
            r.len = unit(r.start + r.len) - start;
            r.start = start;
        }
        let xml_markers = match self.story_xml(uid, marker_strand, &unit) {
            Ok(m) => m,
            Err(e) => {
                self.warn(format!("story {uid}: XML structure left out: {e}"));
                BTreeMap::new()
            }
        };
        let xml_element = match self.chunk(uid, xml::chunk::NODE_REF)? {
            Some(d) if d.len() >= 8 => {
                let mut c = self.cursor(&d);
                Some((c.u32()?, c.u32()?))
            }
            _ => None,
        };
        let mut anchors: BTreeMap<usize, Vec<PageItem>> = BTreeMap::new();
        let mut tables: BTreeMap<usize, Table> = BTreeMap::new();
        let mut text_variables = BTreeMap::new();
        let mut text_destinations: BTreeMap<usize, Vec<Destination>> = BTreeMap::new();
        let mut footnotes: BTreeMap<usize, Footnote> = BTreeMap::new();
        let mut endnotes = BTreeMap::new();
        let mut notes: BTreeMap<usize, Note> = BTreeMap::new();
        let mut index_markers = BTreeMap::new();
        let mut deletions: BTreeMap<usize, Vec<Deletion>> = BTreeMap::new();
        for (pos, cls, item) in owned {
            match cls {
                class::ENDNOTE => {
                    // Chunk 0x22616: the endnote's range.
                    if let Some(range) = self
                        .chunk(item, chunk::ENDNOTE_RANGE_OF)?
                        .and_then(|d| self.enc().u32_at(&d, 0))
                        .and_then(uid_or_none)
                    {
                        endnotes.insert(pos, (item, range));
                    }
                }
                class::NOTE => {
                    let d = self.required(item, chunk::NOTE)?;
                    let mut c = self.cursor(&d);
                    let n = c.u32()? as usize;
                    let user = if n == 0 {
                        String::new()
                    } else {
                        c.segments(n)?
                    };
                    let mut filetime = || -> Result<u64, Error> {
                        Ok((u64::from(c.u32()?) << 32) | u64::from(c.u32()?))
                    };
                    let created = filetime()?;
                    let modified = filetime()?;
                    notes.insert(
                        pos,
                        Note {
                            uid: item,
                            runs: Vec::new(),
                            user,
                            created,
                            modified,
                        },
                    );
                }
                class::DELETED_TEXT => {
                    deletions.entry(pos).or_default().push(Deletion {
                        uid: item,
                        runs: Vec::new(),
                    });
                }
                class::INDEX_MARKER => {
                    // `Id` is the last u32 of chunk 0x13009 when the chunk
                    // has 30 bytes; IDML has no `Id` for a 26-byte chunk.
                    // Its first 14 bytes give the type (index.md).
                    let d = self.chunk(item, chunk::INDEX_MARKER)?;
                    let id = d
                        .as_deref()
                        .filter(|d| d.len() == 30)
                        .and_then(|d| self.enc().u32_at(d, 26));
                    let current_page = d.as_deref().is_some_and(|d| {
                        let e = self.enc();
                        (
                            e.u32_at(d, 0),
                            e.u16_at(d, 4),
                            e.u32_at(d, 6),
                            e.u32_at(d, 10),
                        ) == (Some(1), Some(0), Some(1), Some(0))
                    });
                    index_markers.insert(
                        pos,
                        IndexMarker {
                            uid: item,
                            id,
                            current_page,
                        },
                    );
                }
                class::FOOTNOTE => {
                    footnotes.insert(
                        pos,
                        Footnote {
                            uid: item,
                            runs: Vec::new(),
                        },
                    );
                }
                hyperlink::class::DESTINATION_OWNER => {
                    // The owner names its destination (hyperlinks.md).
                    let dest = match self.chunk(item, hyperlink::chunk::OWNER_DESTINATION)? {
                        Some(d) => self.enc().u32_at(&d, 0),
                        // InDesign 5.0.
                        None => self
                            .chunk(item, hyperlink::chunk::OWNER_DESTINATION_5)?
                            .and_then(|d| self.enc().u32_at(&d, 8)),
                    }
                    .and_then(uid_or_none);
                    if let Some(dest) = dest
                        && let Some(d) = Destination::read(
                            dest,
                            hyperlink::class::TEXT_DESTINATION,
                            &*self.object(dest)?,
                        )?
                    {
                        text_destinations.entry(pos).or_default().push(d);
                    }
                }
                class::TEXT_VARIABLE_INSTANCE => {
                    let v = variable::Instance::read(item, &*self.object(item)?)?;
                    text_variables.insert(pos, v);
                }
                class::ANCHOR => {
                    let settings = self
                        .chunk(item, chunk::ANCHOR_SETTINGS)?
                        .map(|d| AnchorSettings::read(self.enc(), &d));
                    for child in self.children(item, chunk::ANCHOR_CHILDREN)? {
                        if let Some(mut pi) = self.page_item(child, None)? {
                            pi.anchor = settings.clone();
                            anchors.entry(pos).or_default().push(pi);
                        }
                    }
                }
                table::class::TABLE_ANCHOR => {
                    // A table that cannot be read is left out, with a
                    // warning, rather than failing the whole document.
                    match self.table_of_anchor(item) {
                        Ok(Some(t)) => {
                            tables.insert(pos, t);
                        }
                        Ok(None) => {}
                        Err(e) => self.warn(format!("story {uid}: table left out: {e}")),
                    }
                }
                _ => {}
            }
        }
        let cuts: Vec<usize> = owners.iter().map(|o| o.0).collect();
        let all = split_runs(&text, &para, &chars, &cuts);
        // Text not owned by the story belongs to footnotes and table cells.
        let owner_at = |at: usize| {
            owners
                .iter()
                .find(|o| at >= o.0 && at < o.0 + o.1)
                .map(|o| (o.2, o.3))
        };
        let mut runs = Vec::new();
        for run in all {
            match owner_at(run.start) {
                Some((owner, _))
                    if let Some(f) = footnotes.values_mut().find(|f| f.uid == owner) =>
                {
                    f.runs.push(run);
                }
                Some((owner, _)) if let Some(n) = notes.values_mut().find(|n| n.uid == owner) => {
                    n.runs.push(run);
                }
                Some((owner, _))
                    if let Some(d) = deletions.values_mut().flatten().find(|d| d.uid == owner) =>
                {
                    d.runs.push(run);
                }
                Some((owner, cell)) if owner != uid => {
                    if let Some(t) = tables.values_mut().find(|t| t.uid == owner)
                        && let Some(c) = t.cells.iter_mut().find(|c| c.id == cell)
                    {
                        c.runs.push(run);
                    }
                }
                _ => runs.push(run),
            }
        }
        // The range tree of the endnote story also holds the endnotes'
        // ranges (footnotes.md).
        let (ranges, rest): (Vec<SourceRange>, Vec<SourceRange>) = sources
            .into_iter()
            .partition(|r| self.class(r.source) == Some(class::ENDNOTE_RANGE));
        let mut sources = rest;
        let mut endnote_ranges = Vec::new();
        for r in ranges {
            let endnote = self
                .chunk(r.source, chunk::RANGE_ENDNOTE)?
                .and_then(|d| self.enc().u32_at(&d, 0))
                .and_then(uid_or_none);
            let inside = runs.iter().any(|t| {
                r.start >= t.start && r.start + r.len <= t.start + t.text.encode_utf16().count()
            });
            match endnote {
                Some(endnote) if inside && r.len > 0 => endnote_ranges.push(EndnoteRange {
                    start: r.start,
                    len: r.len,
                    uid: r.source,
                    endnote,
                }),
                _ => self.warn(format!(
                    "story {uid}: endnote range {} spans several text ranges; left out",
                    r.source
                )),
            }
        }
        endnote_ranges.sort_by_key(|r| r.start);
        // IDML writes a text source inside one character range, or as a
        // child of a paragraph range around several character ranges
        // (hyperlinks.md, extent and placement).
        sources.sort_by_key(|r| r.start);
        let cell_lists = tables
            .values()
            .flat_map(|t| t.cells.iter().map(|c| c.runs.as_slice()));
        let footnote_lists = footnotes.values().map(|f| f.runs.as_slice());
        let note_lists = notes.values().map(|n| n.runs.as_slice());
        let deletion_lists = deletions.values().flatten().map(|d| d.runs.as_slice());
        let lists: Vec<&[TextRun]> = std::iter::once(runs.as_slice())
            .chain(cell_lists)
            .chain(footnote_lists)
            .chain(note_lists)
            .chain(deletion_lists)
            .collect();
        sources.retain_mut(|r| {
            if r.len == 0 {
                return false;
            }
            let end = r.start + r.len;
            let run_end = |t: &TextRun| t.start + t.text.encode_utf16().count();
            // The runs that hold the first and the last character.
            let found = lists.iter().find_map(|list| {
                let a = list.iter().position(|t| r.start >= t.start && r.start < run_end(t))?;
                let b = list.iter().position(|t| end > t.start && end <= run_end(t))?;
                (a <= b).then(|| &list[a..=b])
            });
            let Some(span) = found else {
                self.warn(format!(
                    "story {uid}: hyperlink source {} spans several text ranges; left out",
                    r.source
                ));
                return false;
            };
            let first = &span[0];
            let one_paragraph = span.windows(2).all(|w| run_end(&w[0]) == w[1].start)
                && span.iter().all(|t| {
                    (t.paragraph_style, &t.paragraph_attrs)
                        == (first.paragraph_style, &first.paragraph_attrs)
                });
            if !one_paragraph {
                self.warn(format!(
                    "story {uid}: hyperlink source {} spans several paragraph style ranges; left out",
                    r.source
                ));
                return false;
            }
            // The schema allows no text directly in a cross-reference
            // source: one that holds more than a text variable instance is
            // written around a character range.
            let cross_reference = self
                .chunk(r.source, hyperlink::chunk::CROSS_REFERENCE)
                .ok()
                .flatten()
                .is_some();
            let variable_only = r.len == 1 && text_variables.contains_key(&r.start);
            r.paragraph = span.len() > 1 || cross_reference && !variable_only;
            if r.paragraph {
                if xml_markers
                    .range(r.start..end)
                    .any(|(_, m)| !matches!(m, XmlMarker::Hidden))
                {
                    self.warn(format!(
                        "story {uid}: hyperlink source {} holds an XML marker; left out",
                        r.source
                    ));
                    return false;
                }
                return true;
            }
            // The IDML schema allows no page item inside a text source
            // written in a character range.
            if anchors.range(r.start..end).next().is_some() {
                self.warn(format!(
                    "story {uid}: hyperlink source {} holds an anchored object; left out",
                    r.source
                ));
                return false;
            }
            true
        });
        let margin = self.chunk(uid, chunk::STORY_OPTICAL_MARGIN)?;
        Ok(Story {
            uid,
            runs,
            anchors,
            tables,
            text_variables,
            sources,
            xml_markers,
            footnotes,
            notes,
            deletions,
            changes,
            index_markers,
            endnotes,
            is_endnote: self.class(uid) == Some(class::ENDNOTE_STORY),
            endnote_ranges,
            text_destinations,
            xml_element,
            orientation: None,
            // The story names an object (class 0x8C20) whose chunk 0x11613
            // is the TOC style.
            settings: StoryChunks {
                title: match self.chunk(uid, chunk::STORY_TITLE)? {
                    Some(d) => {
                        let mut c = self.cursor(&d);
                        Some(c.name()?.idml())
                    }
                    None => None,
                },
                direction: self
                    .chunk(uid, chunk::STORY_DIRECTION)?
                    .and_then(|d| self.enc().u16_at(&d, 0)),
                optical_margin: margin
                    .as_ref()
                    .and_then(|d| Some((self.enc().f64_at(d, 2)?, self.enc().u16_at(d, 12)?))),
                layout: margin
                    .as_ref()
                    .and_then(|d| Some((self.enc().u16_at(d, 0)?, self.enc().u16_at(d, 14)?))),
                grid: match self.chunk(uid, chunk::PAGE_GRID)? {
                    Some(d) => Some(GridData::read(&mut self.cursor(&d))?),
                    None => None,
                },
                named_grid: self.applied_named_grid(uid)?,
                linked: self.story_link_chunks(uid).unwrap_or_else(|e| {
                    self.warn(format!(
                        "story {uid}: link and import options left out: {e}"
                    ));
                    StoryLinkChunks::default()
                }),
            },
            toc_style: match self
                .chunk(uid, chunk::STORY_TOC)?
                .and_then(|d| self.enc().u32_at(&d, 0))
                .and_then(uid_or_none)
            {
                Some(toc) => self
                    .chunk(toc, chunk::TOC_STYLE_OF)?
                    .and_then(|d| self.enc().u32_at(&d, 0))
                    .and_then(uid_or_none),
                None => None,
            },
        })
    }

    /// InDesign 5.0 text sources by their start marker: (source UID, end
    /// marker UID), from chunk 0x13524 of every text source.
    fn source_markers(&self) -> Result<&HashMap<u32, (u32, u32)>, Error> {
        if let Some(m) = self.source_markers.get() {
            return Ok(m);
        }
        let mut m = HashMap::new();
        for &(uid, cls) in self.db.classes() {
            if cls != hyperlink::class::TEXT_SOURCE || self.db.object(uid)?.is_none() {
                continue;
            }
            if let Some(d) = self.chunk(uid, hyperlink::chunk::SOURCE_MARKERS)?
                && let (Some(start), Some(end)) =
                    (self.enc().u32_at(&d, 0), self.enc().u32_at(&d, 4))
            {
                m.insert(start, (uid, end));
            }
        }
        Ok(self.source_markers.get_or_init(|| m))
    }

    /// Read the XML nodes stored with story `uid` and place their markers.
    /// `unit` converts a character position to a UTF-16 offset.
    pub(super) fn story_xml(
        &self,
        uid: u32,
        marker_strand: Option<u32>,
        unit: &dyn Fn(usize) -> usize,
    ) -> Result<BTreeMap<usize, XmlMarker>, Error> {
        let mut out = BTreeMap::new();
        let first = match self.chunk(uid, xml::chunk::STORE)? {
            Some(d) if d.len() >= 4 => self.cursor(&d).u32()?,
            _ => return Ok(out),
        };
        let positions = match marker_strand.map(|s| self.chunk(s, xml::chunk::MARKER_TREE)) {
            Some(r) => match r? {
                Some(d) => xml::marker_positions(self.enc(), &d)?,
                None => BTreeMap::new(),
            },
            None => BTreeMap::new(),
        };
        let nodes = match xml::read_store(self.enc(), first, |p| self.chunk(p, xml::chunk::PAGE)) {
            Ok(n) => n,
            Err(e) => {
                // The markers are not text even when their nodes cannot be
                // read (xml.md).
                self.warn(format!("story {uid}: XML structure left out: {e}"));
                return Ok(positions
                    .values()
                    .map(|&p| (unit(p), XmlMarker::Hidden))
                    .collect());
            }
        };
        if nodes.is_empty() {
            return Ok(out);
        }
        for node in nodes {
            let at = |m: Option<u32>| m.and_then(|m| positions.get(&m)).map(|&p| unit(p));
            let (start, end) = (at(node.start), at(node.end));
            if node.start.is_some() != start.is_some() || node.end.is_some() != end.is_some() {
                self.warn(format!(
                    "story {uid}: XML node {:?} left out: marker not found",
                    node.key
                ));
            } else if node.document {
                if let Some(s) = start {
                    out.insert(s, XmlMarker::Hidden);
                }
            } else {
                match (start, end) {
                    (Some(s), Some(e)) => {
                        out.insert(s, XmlMarker::Start(node.key));
                        out.insert(e, XmlMarker::End(node.key));
                    }
                    (Some(s), None) => {
                        out.insert(s, XmlMarker::Placeholder(node.key));
                    }
                    _ => {}
                }
            }
            self.xml_nodes.borrow_mut().insert(node.key, node);
        }
        Ok(out)
    }

    /// The XML elements that can be written: those whose parents lead to
    /// the document node and whose tag is known. See `docs/format/xml.md`.
    pub(super) fn xml_elements(
        &self,
        tags: &HashMap<u32, String>,
    ) -> Result<BTreeMap<xml::Key, XmlElement>, Error> {
        let nodes = self.xml_nodes.borrow();
        let mut out = BTreeMap::new();
        for (key, node) in nodes.iter().filter(|(_, n)| !n.document) {
            // `Self`: "d", then "i" and the hex ID of each element from the
            // root down to this one.
            let mut path = vec![key.1];
            let mut parent = node.parent;
            let mut reached = false;
            while let Some(p) = nodes.get(&parent) {
                if p.document {
                    reached = true;
                    break;
                }
                if path.len() > nodes.len() {
                    break;
                }
                path.push(p.key.1);
                parent = p.parent;
            }
            let Some(tag) = tags.get(&node.tag) else {
                self.warn(format!(
                    "XML element {key:?} left out: tag {} unknown",
                    node.tag
                ));
                continue;
            };
            if !reached {
                self.warn(format!("XML element {key:?} left out: no path to the root"));
                continue;
            }
            let name = path.iter().rev().fold(String::from("d"), |mut s, id| {
                s.push_str(&format!("i{id:x}"));
                s
            });
            let (content, story_content) = match self.class(node.content) {
                _ if node.content == 0 => (None, false),
                Some(class::STORY) => (Some(node.content), true),
                // A content holder stands for its parent page item.
                Some(xml::class::CONTENT_HOLDER) => {
                    match self.chunk(node.content, chunk::ITEM_HIERARCHY)? {
                        Some(d) if d.len() >= 8 => {
                            (uid_or_none(self.cursor(&d[4..]).u32()?), false)
                        }
                        _ => (None, false),
                    }
                }
                c => {
                    self.warn(format!(
                        "XML element {key:?}: content {} of class {c:x?} left out",
                        node.content
                    ));
                    (None, false)
                }
            };
            out.insert(
                *key,
                XmlElement {
                    name,
                    tag: tag.clone(),
                    content,
                    story_content,
                    attributes: node.attributes.clone(),
                },
            );
        }
        Ok(out)
    }
}
