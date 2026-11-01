//! Text, object and TOC styles and style groups.
//!
//! Evidence: `docs/format/objects.md` (styles, style groups, object
//! styles, TOC styles) and `attributes.md`.

use super::*;

#[derive(Debug, Clone, PartialEq)]
pub struct Style {
    pub uid: u32,
    pub name: String,
    /// The name is an InDesign built-in key, written with `$ID/` in IDML.
    pub builtin: bool,
    pub paragraph: bool,
    pub based_on: Option<u32>,
    pub next: Option<u32>,
    pub attrs: Attrs,
    /// The u16 after the kind, before the name (IDML `Imported`).
    pub imported: bool,
    /// The GUID string after the name in newer files (`StyleUniqueId`).
    pub unique_id: Option<String>,
    /// Keyboard shortcut: u32 key 10 bytes before the name's flag byte,
    /// then the two bytes 6 and 5 before it (`docs/format/objects.md`).
    pub shortcut: Option<(u32, u8, u8)>,
    /// Export settings (chunk 0x28F0); `None` without the chunk or when
    /// it does not parse.
    pub export: Option<StyleExport>,
    /// `PreviewColor`: the u32 14 bytes before the name's flag byte, 0
    /// for none or an interface colour (`docs/format/objects.md`, styles).
    /// `None` for another value or a shorter header.
    pub preview_color: Option<Option<[f64; 3]>>,
}

/// The export settings of a paragraph, character or object style (chunk
/// 0x28F0): tag maps, then u16 flags (`SplitDocument`, `EmitCss`,
/// `IncludeClass` and more in later versions for text styles; see
/// `docs/format/objects.md`, styles).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct StyleExport {
    pub maps: Vec<ExportTagMap>,
    pub flags: Vec<u16>,
}

/// An export tag map (`StyleExportTagMap`).
#[derive(Debug, Clone, PartialEq)]
pub struct ExportTagMap {
    pub export_type: String,
    pub tag: String,
    pub class: String,
    pub attributes: Vec<(String, String)>,
}

impl StyleExport {
    /// u32 map count; per map three strings (type, tag, class), a u32
    /// attribute count and that many pairs of strings; then u16 values to
    /// the end. Each string is a u32 length in UTF-16 units and text
    /// segments.
    pub fn read(enc: Encoding, d: &[u8]) -> Result<StyleExport, Error> {
        let mut c = enc.cursor(d);
        let string = |c: &mut Cursor| -> Result<String, Error> {
            match c.u32()? as usize {
                0 => Ok(String::new()),
                n if n <= c.remaining() => c.segments(n),
                n => Err(Error::Corrupt(format!("export tag map string of {n}"))),
            }
        };
        let n = c.u32()? as usize;
        if n > c.remaining() / 16 {
            return Err(Error::Corrupt(format!("{n} export tag maps")));
        }
        let mut maps = Vec::with_capacity(n);
        for _ in 0..n {
            let export_type = string(&mut c)?;
            let tag = string(&mut c)?;
            let class = string(&mut c)?;
            let k = c.u32()? as usize;
            if k > c.remaining() / 8 {
                return Err(Error::Corrupt(format!("{k} export tag attributes")));
            }
            let mut attributes = Vec::with_capacity(k);
            for _ in 0..k {
                attributes.push((string(&mut c)?, string(&mut c)?));
            }
            maps.push(ExportTagMap {
                export_type,
                tag,
                class,
                attributes,
            });
        }
        let mut flags = Vec::new();
        while c.remaining() >= 2 {
            flags.push(c.u16()?);
        }
        Ok(StyleExport { maps, flags })
    }
}

/// A table of contents style (class 0x11605), from chunk 0x11605: a flag
/// byte and the name, three u32 (the third the title style), a flag byte
/// and the title. See `docs/format/objects.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct TocStyle {
    pub uid: u32,
    pub name: String,
    pub builtin: bool,
    pub title: String,
    pub title_style: u32,
    /// u16 at 2 after the name.
    pub include_book_documents: bool,
    /// u32 at 4 after the name.
    pub create_bookmarks: bool,
    /// After a flag byte and a string: u16 at 2 numbered paragraphs, at 4
    /// make anchor and at 6 remove forced line breaks, where the chunk
    /// has them.
    pub flags: Vec<u16>,
    /// The entries (`objects.md`, table of contents styles); empty where
    /// they do not parse.
    pub entries: Vec<TocEntry>,
}

/// A custom stroke style. See `docs/format/attributes.md`, custom stroke
/// styles.
#[derive(Debug, Clone, PartialEq)]
pub struct StrokeStyle {
    pub uid: u32,
    /// Dashed (class 0x5A43) or striped (class 0xB016).
    pub dashed: bool,
    pub name: String,
    /// Dashed: dash and gap lengths in points. Striped: start and width of
    /// each stripe, as fractions of the stroke weight.
    pub values: Vec<f64>,
    /// Dashed: corner adjustment code and end cap code.
    pub corner: u16,
    pub cap: u32,
}

/// An entry of a table of contents style: a paragraph style the table
/// lists and how. See `docs/format/objects.md`, table of contents styles.
#[derive(Debug, Clone, PartialEq)]
pub struct TocEntry {
    /// The paragraph style's name, and whether it is a built-in key.
    pub name: String,
    pub builtin: bool,
    /// Paragraph style UID; 0 for the same style.
    pub format_style: u32,
    pub level: u32,
    /// 0 after the entry, 1 before it, 2 none.
    pub page_number_position: u16,
    /// Character style UIDs; 0 for the same style.
    pub page_number_style: u32,
    pub separator: String,
    pub separator_style: u32,
}

/// A style group: a root group of styles, or a named group in it.
#[derive(Debug, Clone, PartialEq)]
pub struct StyleGroup {
    pub uid: u32,
    /// Empty for root groups.
    pub name: String,
    /// Root groups: what they hold, from chunk 0x28C2 (see `root_kind`).
    pub root: Option<u32>,
    pub children: Vec<u32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObjectStyle {
    pub uid: u32,
    pub name: String,
    pub builtin: bool,
    pub based_on: Option<u32>,
    /// Frame fitting attributes (chunk 0x1B956), same IDs as on page items.
    pub fitting: Attrs,
    /// Page item attributes (chunk 0x1B92B): fill, stroke, corners.
    pub attrs: Attrs,
    /// Flex layout paddings (top, right, bottom, left) and gaps (row,
    /// column), from chunk 0x1E244; `None` without it.
    pub flex_spacing: Option<[f64; 6]>,
    /// Transparency attributes (chunk 0x1B92C), the IDs of page items.
    pub transparency: Attrs,
    /// Text frame settings (chunk 0x1B924).
    pub frame: Option<ObjectStyleFrame>,
    /// Story settings (chunk 0x285B).
    pub story: Option<StorySettings>,
    /// Story direction (chunk 0x50F28, u16).
    pub direction: Option<u16>,
    /// Text wrap (chunk 0x3776, the layout of chunk 0x3703).
    pub text_wrap: Option<TextWrap>,
    /// The contour of the text wrap (chunk 0x3777).
    pub contour: Option<Contour>,
    /// IDs of the setting categories the style turns on (chunk 0x1B92E).
    pub enabled: Option<Vec<u32>>,
    /// Paragraph style applied to text frames (chunk 0x1B946).
    pub paragraph_style: Option<u32>,
    /// The u32 after the name in chunk 0x1B907: the keyboard shortcut
    /// key, 0 for none.
    pub shortcut_key: Option<u32>,
    /// Chunk 0x1B94D, u16: 1 for `ApplyNextParagraphStyle="true"`.
    pub apply_next: Option<u16>,
    /// Anchored object settings (chunk 0x2800).
    pub anchor: Option<AnchorSettings>,
    /// Chunk 0xCD32: the applied named grid (`Reader::applied_named_grid`).
    pub named_grid: Option<Option<u32>>,
    /// Export settings (chunk 0x28F0).
    pub export: Option<StyleExport>,
    /// Alternative text and tagging settings (chunk 0x1E206, the layout
    /// of page items).
    pub export_options: Option<ExportOptions>,
    /// Transform attributes (chunk 0x1E234): X, Y, height and width, each
    /// `Some` when the style sets it.
    pub transform: [Option<f64>; 4],
}

/// Whether `s` has the form of a GUID as styles store it: lowercase
/// hexadecimal digits in groups of 8, 4, 4, 4 and 12, joined by hyphens.
fn is_guid(s: &str) -> bool {
    let groups: Vec<&str> = s.split('-').collect();
    groups.iter().map(|g| g.len()).eq([8, 4, 4, 4, 12])
        && groups.iter().all(|g| {
            g.bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
}

/// Style groups nested deeper than this are left out, with a warning.
pub(super) const MAX_GROUP_DEPTH: usize = 100;

/// Make the style groups a tree under their root groups, so that walking
/// them ends: a group listed a second time (in a cycle, or under a second
/// parent) or nested deeper than [`MAX_GROUP_DEPTH`] is removed from the
/// children of the group that lists it, with a warning.
pub(super) fn prune_style_groups(groups: &mut BTreeMap<u32, StyleGroup>, warn: impl Fn(String)) {
    let roots: Vec<u32> = groups
        .iter()
        .filter(|(_, g)| g.root.is_some())
        .map(|(&uid, _)| uid)
        .collect();
    let mut seen: std::collections::HashSet<u32> = roots.iter().copied().collect();
    let mut stack: Vec<(u32, usize)> = roots.iter().map(|&r| (r, 0)).collect();
    while let Some((uid, depth)) = stack.pop() {
        let Some(g) = groups.get_mut(&uid) else {
            continue;
        };
        let children = std::mem::take(&mut g.children);
        let mut kept = Vec::with_capacity(children.len());
        for c in children {
            if groups.contains_key(&c) {
                if !seen.insert(c) {
                    warn(format!(
                        "style group {c} is listed twice; left out of group {uid}"
                    ));
                    continue;
                }
                if depth + 1 > MAX_GROUP_DEPTH {
                    warn(format!(
                        "style group {c} is nested more than {MAX_GROUP_DEPTH} deep; left out"
                    ));
                    continue;
                }
                stack.push((c, depth + 1));
            }
            kept.push(c);
        }
        if let Some(g) = groups.get_mut(&uid) {
            g.children = kept;
        }
    }
}

impl<'a> Reader<'a> {
    pub(super) fn style(&self, uid: u32) -> Result<Option<Style>, Error> {
        let Some(data) = self.chunk(uid, chunk::STYLE_INFO)? else {
            return Ok(None);
        };
        let mut c = self.cursor(&data);
        let next = c.u32()?;
        let based_on = c.u32()?;
        // The header before the name is 4 bytes shorter in files from
        // InDesign 13 and earlier, so locate the name by its structure: a
        // flag byte (1 = built-in name), then an in-object string. Four
        // bytes before the flag, a u16 is 1 for paragraph styles and 0 for
        // character styles; the u16 after it is not identified.
        let Some((at, builtin, name)) = find_flagged_string(self.enc(), &data, 12, |_| true) else {
            return Err(Error::Corrupt(format!("style {uid}: no name")));
        };
        let paragraph = self.cursor(&data[at - 4..]).u16()? != 0;
        let imported = self.cursor(&data[at - 2..]).u16()? != 0;
        let shortcut = if at >= 10 {
            Some((
                self.cursor(&data[at - 10..]).u32()?,
                data[at - 6],
                data[at - 5],
            ))
        } else {
            None
        };
        // A GUID in a 36-character in-object string after the name's
        // string. The byte after the tag can have any value (objects.md,
        // styles).
        let unique_id = if self.enc().big_endian() {
            None
        } else {
            let mut c = self.cursor(&data[at..]);
            let end = at + c.name().map_or(0, |_| c.pos());
            data[end..]
                .windows(6)
                .position(|w| w[0] == 2 && w[2..] == [36, 0, 36, 0x40])
                .and_then(|i| self.cursor(&data[end + i..]).string().ok())
                .filter(|g| is_guid(g))
        };
        let preview_color = match (at >= 14)
            .then(|| self.enc().u32_at(&data, at - 14))
            .flatten()
        {
            Some(0) => Some(None),
            Some(u) => self.ui_color(u)?.map(Some),
            None => None,
        };
        let attrs = match self.chunk(uid, chunk::STYLE_ATTRS)? {
            Some(d) if d.len() >= 2 => {
                let mut c = self.cursor(&d);
                let n = c.u16()? as usize;
                self.attrs_or_warn(
                    || format!("style {uid}"),
                    Attrs::parse_text(&mut c, n, List::Style, self.db.recorder()),
                )
                .unwrap_or_default()
            }
            _ => Attrs::default(),
        };
        let export = self.style_export(uid)?;
        Ok(Some(Style {
            uid,
            name,
            builtin,
            paragraph,
            based_on: uid_or_none(based_on),
            next: uid_or_none(next),
            attrs,
            imported,
            unique_id,
            shortcut,
            export,
            preview_color,
        }))
    }

    /// The table of contents styles, in UID order.
    pub(super) fn toc_styles(&self, version: crate::header::Version) -> Vec<TocStyle> {
        let mut out = Vec::new();
        for &(uid, cls) in self.db.classes() {
            if cls != class::TOC_STYLE {
                continue;
            }
            let read = (|| -> Result<Option<TocStyle>, Error> {
                let Some(d) = self.chunk(uid, chunk::TOC_STYLE)? else {
                    return Ok(None);
                };
                let mut c = self.cursor(&d);
                let builtin = c.flag()? == 1;
                let name = c.string()?;
                c.u16()?;
                let include_book_documents = c.u16()? == 1;
                let create_bookmarks = c.u32()? == 1;
                let title_style = c.u32()?;
                c.flag()?;
                let title = c.string()?;
                c.flag()?;
                c.string()?;
                // Two u16 before version 9, three before 13, four from 13,
                // then the entries.
                let count = match version.major {
                    ..=8 => 2,
                    9..=12 => 3,
                    _ => 4,
                };
                let mut flags = Vec::new();
                while flags.len() < count && c.remaining() >= 2 {
                    flags.push(c.u16()?);
                }
                let entries = if c.remaining() >= 2 {
                    toc_entries(&mut c).unwrap_or_else(|_| {
                        self.warn(format!("TOC style {uid}: entries left out"));
                        Vec::new()
                    })
                } else {
                    Vec::new()
                };
                Ok(Some(TocStyle {
                    uid,
                    name,
                    builtin,
                    title,
                    title_style,
                    include_book_documents,
                    create_bookmarks,
                    flags,
                    entries,
                }))
            })();
            match read {
                Ok(Some(t)) => out.push(t),
                Ok(None) => {}
                Err(e) => self.warn(format!("TOC style {uid} left out: {e}")),
            }
        }
        out.sort_by_key(|t| t.uid);
        out
    }
}

/// The entries of a TOC style chunk after its fields: u16 count, then per
/// entry the style name (flag byte, string), a document path (flag byte,
/// string), u32 format style, u16 level, u16, u16 page number position, u32
/// page number style, u32-counted separator text, u32 separator style,
/// u16, a u32-counted text and a u16. The chunk must end after them.
fn toc_entries(c: &mut crate::object::Cursor) -> Result<Vec<TocEntry>, Error> {
    let n = c.u16()?;
    let mut out = Vec::new();
    for _ in 0..n {
        let builtin = c.flag()? == 1;
        let name = c.string()?;
        c.flag()?;
        c.string()?;
        let format_style = c.u32()?;
        let level = u32::from(c.u16()?);
        // 0 in every entry of the pairs; 1 in some entries of files
        // without one (objects.md, table of contents styles).
        c.u16()?;
        let page_number_position = c.u16()?;
        let page_number_style = c.u32()?;
        let len = c.u32()? as usize;
        let separator = c.segments(len)?;
        let separator_style = c.u32()?;
        c.u16()?;
        let len = c.u32()? as usize;
        c.segments(len)?;
        c.u16()?;
        out.push(TocEntry {
            name,
            builtin,
            format_style,
            level,
            page_number_position,
            page_number_style,
            separator,
            separator_style,
        });
    }
    if c.remaining() != 0 {
        return Err(Error::Corrupt("TOC entries do not fill the chunk".into()));
    }
    Ok(out)
}

impl<'a> Reader<'a> {
    /// The custom stroke styles, in UID order. A style whose chunks do not
    /// have the lengths of the documented layout is left out with a
    /// warning.
    pub(super) fn stroke_styles(&self) -> Vec<StrokeStyle> {
        let mut out = Vec::new();
        for &(uid, cls) in self.db.classes() {
            let dashed = match cls {
                class::DASHED_STROKE_STYLE => true,
                class::STRIPED_STROKE_STYLE => false,
                _ => continue,
            };
            let read = (|| -> Result<Option<StrokeStyle>, Error> {
                let (name_id, data_id) = if dashed {
                    (chunk::DASHED_STROKE_NAME, chunk::DASHED_STROKE)
                } else {
                    (chunk::STRIPED_STROKE_NAME, chunk::STRIPED_STROKE)
                };
                let (Some(n), Some(d)) = (self.chunk(uid, name_id)?, self.chunk(uid, data_id)?)
                else {
                    return Ok(None);
                };
                let mut c = self.cursor(&n);
                c.flag()?;
                let name = c.string()?;
                let mut c = self.cursor(&d);
                let count = c.u32()? as usize;
                let (values, extra) = if dashed { (count, 6) } else { (2 * count, 0) };
                if values.checked_mul(8).and_then(|v| v.checked_add(4 + extra)) != Some(d.len()) {
                    return Ok(None);
                }
                let values = (0..values)
                    .map(|_| c.f64())
                    .collect::<Result<Vec<_>, _>>()?;
                let (corner, cap) = if dashed { (c.u16()?, c.u32()?) } else { (0, 0) };
                Ok(Some(StrokeStyle {
                    uid,
                    dashed,
                    name,
                    values,
                    corner,
                    cap,
                }))
            })();
            match read {
                Ok(Some(s)) => out.push(s),
                Ok(None) | Err(_) => self.warn(format!("stroke style {uid} left out")),
            }
        }
        out.sort_by_key(|s| s.uid);
        out
    }

    /// A root style group (the root of paragraph and character, object,
    /// cell or table styles): its kind (chunk 0x28C2) and children.
    pub(super) fn style_root_group(&self, uid: u32) -> Result<StyleGroup, Error> {
        let kind = match self.chunk(uid, chunk::ROOT_GROUP_KIND)? {
            Some(d) => self.cursor(&d).u32()?,
            None => 0,
        };
        let mut children = Vec::new();
        for id in [
            chunk::STYLE_ROOT_CHILDREN,
            chunk::OBJECT_STYLE_ROOT_CHILDREN,
            table::chunk::CELL_STYLE_ROOT_CHILDREN,
            table::chunk::TABLE_STYLE_ROOT_CHILDREN,
        ] {
            if children.is_empty() {
                children = self.children(uid, id)?;
            }
        }
        Ok(StyleGroup {
            uid,
            name: String::new(),
            root: Some(kind),
            children,
        })
    }

    /// A named style group: a flag byte and the name, and its children.
    pub(super) fn style_group(&self, uid: u32) -> Result<StyleGroup, Error> {
        let name = match self.chunk(uid, chunk::STYLE_GROUP_NAME)? {
            Some(d) if d.len() > 1 => {
                let mut c = self.cursor(&d);
                c.flag()?;
                c.string()?
            }
            _ => String::new(),
        };
        let children = self.children(uid, chunk::STYLE_GROUP_CHILDREN)?;
        Ok(StyleGroup {
            uid,
            name,
            root: None,
            children,
        })
    }

    /// An object style. `None` if it has no info chunk (based-on style,
    /// flag byte and name).
    /// The export settings of a style (chunk 0x28F0), with a warning when
    /// they do not parse.
    fn style_export(&self, uid: u32) -> Result<Option<StyleExport>, Error> {
        Ok(self.chunk(uid, chunk::STYLE_EXPORT)?.and_then(|d| {
            match StyleExport::read(self.enc(), &d) {
                Ok(e) => Some(e),
                Err(e) => {
                    self.warn(format!("style {uid}: export settings: {e}; left out"));
                    None
                }
            }
        }))
    }

    pub(super) fn object_style(&self, uid: u32) -> Result<Option<ObjectStyle>, Error> {
        let Some(d) = self.chunk(uid, chunk::OBJECT_STYLE_INFO)? else {
            return Ok(None);
        };
        let mut c = self.cursor(&d);
        let based_on = c.u32()?;
        let builtin = c.flag()? == 1;
        let name = c.string()?;
        // The u32 after the name: the keyboard shortcut key.
        let shortcut_key = c.u32().ok();
        let u32_chunk = |id: u32| -> Result<Option<u32>, Error> {
            match self.chunk(uid, id)? {
                Some(d) if d.len() >= 4 => Ok(Some(self.cursor(&d).u32()?)),
                _ => Ok(None),
            }
        };
        Ok(Some(ObjectStyle {
            uid,
            name,
            builtin,
            based_on: uid_or_none(based_on),
            fitting: match self.chunk(uid, chunk::OBJECT_STYLE_FITTING)? {
                Some(d) => self
                    .attrs_or_warn(
                        || format!("object style {uid}, frame fitting"),
                        Attrs::parse_short(
                            self.enc(),
                            &d,
                            List::ObjectStyleFitting,
                            self.db.recorder(),
                        ),
                    )
                    .unwrap_or_default(),
                None => Attrs::default(),
            },
            attrs: match self.chunk(uid, chunk::OBJECT_STYLE_ATTRS)? {
                Some(d) => self
                    .attrs_or_warn(
                        || format!("object style {uid}"),
                        Attrs::parse_short(self.enc(), &d, List::ObjectStyle, self.db.recorder()),
                    )
                    .unwrap_or_default(),
                None => Attrs::default(),
            },
            transparency: match self.chunk(uid, chunk::OBJECT_STYLE_TRANSPARENCY)? {
                Some(d) => self
                    .attrs_or_warn(
                        || format!("object style {uid}, transparency"),
                        Attrs::parse_short(
                            self.enc(),
                            &d,
                            List::ObjectStyleTransparency,
                            self.db.recorder(),
                        ),
                    )
                    .unwrap_or_default(),
                None => Attrs::default(),
            },
            // The layout is known for these sizes only
            // (`docs/format/big-endian.md`).
            frame: match self.chunk(uid, chunk::OBJECT_STYLE_FRAME)? {
                Some(d) if !matches!(d.len(), 106 | 142 | 162 | 222) => {
                    self.warn(format!(
                        "object style {uid}: text frame settings of {} bytes are not known; left out",
                        d.len()
                    ));
                    None
                }
                d => d.map(|d| ObjectStyleFrame::read(self.enc(), &d)),
            },
            story: self
                .chunk(uid, chunk::OBJECT_STYLE_STORY)?
                .and_then(|d| StorySettings::read(self.enc(), &d)),
            direction: match self.chunk(uid, chunk::OBJECT_STYLE_DIRECTION)? {
                Some(d) if d.len() >= 2 => Some(self.cursor(&d).u16()?),
                _ => None,
            },
            text_wrap: self.wrap_chunk(uid, chunk::OBJECT_STYLE_WRAP)?,
            flex_spacing: match self.chunk(uid, chunk::OBJECT_STYLE_FLEX)? {
                Some(d) if d.len() == 78 => {
                    let f = |i: usize| self.enc().f64_at(&d, 30 + 8 * i);
                    (|| Some([f(0)?, f(1)?, f(2)?, f(3)?, f(4)?, f(5)?]))()
                }
                _ => None,
            },
            contour: match self.chunk(uid, chunk::OBJECT_STYLE_CONTOUR)? {
                Some(d) => Contour::read(self.enc(), &d),
                None => None,
            },
            enabled: match self.chunk(uid, chunk::OBJECT_STYLE_ENABLED)? {
                Some(d) => Some(self.cursor(&d).u32_list()?),
                None => None,
            },
            paragraph_style: u32_chunk(chunk::OBJECT_STYLE_PARAGRAPH_STYLE)?,
            shortcut_key,
            apply_next: self
                .chunk(uid, chunk::OBJECT_STYLE_APPLY_NEXT)?
                .and_then(|d| self.enc().u16_at(&d, 0)),
            anchor: Some(match self.chunk(uid, chunk::ANCHOR_SETTINGS)? {
                Some(d) => AnchorSettings::read(self.enc(), &d),
                None => AnchorSettings::absent(),
            }),
            named_grid: self.applied_named_grid(uid)?,
            export: self.style_export(uid)?,
            export_options: self.export_options(uid).unwrap_or_else(|e| {
                self.warn(format!("object style {uid}: export options left out: {e}"));
                None
            }),
            transform: match self.chunk(uid, chunk::OBJECT_STYLE_TRANSFORM)? {
                Some(d) => transform_options(self.enc(), &d),
                None => [None; 4],
            },
        }))
    }
}

/// Chunk 0x1E234 of an object style: u16 flags at 8, 10, 12 and 14 (1 when
/// the style sets X, Y, height and width), and those values as f64 at 16,
/// 24, 32 and 40. See `docs/format/objects.md`, object style settings.
fn transform_options(enc: crate::object::Encoding, d: &[u8]) -> [Option<f64>; 4] {
    std::array::from_fn(|i| {
        (enc.u16_at(d, 8 + 2 * i) == Some(1))
            .then(|| enc.f64_at(d, 16 + 8 * i))
            .flatten()
    })
}

/// Anchored object settings (chunk 0x2800, of an anchor, an object style
/// or the preferences). See `docs/format/objects.md`, anchored objects.
/// A field is `None` where the chunk is too short for it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct AnchorSettings {
    /// f64 at 0: `AnchorYoffset`.
    pub y_offset: Option<f64>,
    /// f64 at 16: `AnchorXoffset`.
    pub x_offset: Option<f64>,
    /// u16 at 40: `AnchoredPosition`.
    pub position: Option<u16>,
    /// u16 at 42: `HorizontalReferencePoint`.
    pub horizontal_reference: Option<u16>,
    /// u16 at 44: `VerticalReferencePoint`.
    pub vertical_reference: Option<u16>,
    /// u16 at 46 and 50: `AnchorPoint`.
    pub point: Option<(u16, u16)>,
    /// u16 at 48: `HorizontalAlignment`.
    pub horizontal_alignment: Option<u16>,
    /// u16 at 52: `VerticalAlignment`.
    pub vertical_alignment: Option<u16>,
    /// u16 at 54: `SpineRelative`.
    pub spine_relative: Option<u16>,
    /// u16 at 56: `PinPosition`.
    pub pin: Option<u16>,
}

impl AnchorSettings {
    pub fn read(enc: Encoding, d: &[u8]) -> AnchorSettings {
        let u = |o: usize| enc.u16_at(d, o);
        AnchorSettings {
            y_offset: enc.f64_at(d, 0),
            x_offset: enc.f64_at(d, 16),
            position: u(40),
            horizontal_reference: u(42),
            vertical_reference: u(44),
            point: u(46).zip(u(50)),
            horizontal_alignment: u(48),
            vertical_alignment: u(52),
            spine_relative: u(54),
            pin: u(56),
        }
    }

    /// The settings of preferences and object styles without the chunk
    /// (`objects.md`, anchored object settings).
    pub fn absent() -> AnchorSettings {
        AnchorSettings {
            y_offset: Some(0.0),
            x_offset: Some(0.0),
            position: Some(0),
            horizontal_reference: Some(1),
            vertical_reference: Some(4),
            point: Some((0, 2)),
            horizontal_alignment: Some(2),
            vertical_alignment: Some(0),
            spine_relative: Some(0),
            pin: Some(1),
        }
    }
}

/// Text frame settings of an object style (chunk 0x1B924), at the
/// offsets known for its sizes (106, 142, 162 and 222 bytes). Each field
/// is `None` if the chunk is too short for it. See
/// `docs/format/objects.md`, object styles.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ObjectStyleFrame {
    /// f64 at 0.
    pub column_fixed_width: Option<f64>,
    /// f64 at 8.
    pub column_gutter: Option<f64>,
    /// f64 insets at 34, 42, 50 and 58.
    pub insets: Option<[f64; 4]>,
    /// u32 at 66.
    pub column_count: Option<u32>,
    /// Footnotes: u16 span across columns at 144, f64 minimum spacing at
    /// 146 and f64 space between at 154.
    pub footnotes: Option<(u16, f64, f64)>,
    /// Column rule: f64 stroke width at 190, u32 colour at 198 (0 for
    /// none) and f64 tint at 210.
    pub column_rule: Option<(f64, u32, f64)>,
    /// u16 at 76: first baseline offset code, as for frames (the 106-byte
    /// layout too).
    pub first_baseline_offset: Option<u16>,
    /// The fields below are read from the 142-, 162- and 222-byte layouts.
    /// u16 at 32, 1 = true.
    pub vertical_balance_columns: Option<bool>,
    /// u16 at 70, 1 = true.
    pub use_fixed_width: Option<bool>,
    /// u16 at 74: vertical justification code, as for frames.
    pub vertical_justification: Option<u16>,
    /// u16 at 116 and 118: auto-sizing type and reference point codes, as
    /// for frames.
    pub auto_sizing: Option<(u16, u16)>,
    /// u16 at 120 and f64 at 122 (minimum height), u16 at 130 and f64 at
    /// 132 (minimum width).
    pub minimum_sizes: Option<([bool; 2], [f64; 2])>,
    /// u16 at 140, 1 = true: `UseNoLineBreaksForAutoSizing`.
    pub no_line_breaks: Option<bool>,
    /// Baseline frame grid at 82, in the layout of frames' chunk 0x2834.
    pub baseline_grid: Option<super::BaselineGrid>,
}

impl ObjectStyleFrame {
    pub(super) fn read(enc: Encoding, d: &[u8]) -> ObjectStyleFrame {
        let f = |o: usize| enc.f64_at(d, o);
        let long = d.len() >= 142;
        let flag = |o: usize| enc.u16_at(d, o).filter(|_| long).map(|v| v == 1);
        let code = |o: usize| enc.u16_at(d, o).filter(|_| long);
        ObjectStyleFrame {
            column_fixed_width: f(0),
            column_gutter: f(8),
            insets: (|| Some([f(34)?, f(42)?, f(50)?, f(58)?]))(),
            column_count: enc.u32_at(d, 66),
            footnotes: (|| Some((enc.u16_at(d, 144)?, f(146)?, f(154)?)))(),
            column_rule: (|| Some((f(190)?, enc.u32_at(d, 198)?, f(210)?)))(),
            first_baseline_offset: enc.u16_at(d, 76),
            vertical_balance_columns: flag(32),
            use_fixed_width: flag(70),
            vertical_justification: code(74),
            auto_sizing: (|| Some((code(116)?, code(118)?)))(),
            minimum_sizes: (|| Some(([flag(120)?, flag(130)?], [f(122)?, f(132)?])))(),
            no_line_breaks: flag(140),
            baseline_grid: super::BaselineGrid::read(enc, d, 82),
        }
    }
}

/// Story settings of an object style (chunk 0x285B), if the chunk has 16
/// bytes: u16 story orientation at 0, f64 optical margin size at 2, u16
/// optical margin alignment at 12 and u16 frame type at 14.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StorySettings {
    pub orientation: u16,
    pub optical_size: f64,
    pub optical_alignment: u16,
    pub frame_type: u16,
}

impl StorySettings {
    pub(super) fn read(enc: Encoding, d: &[u8]) -> Option<StorySettings> {
        Some(StorySettings {
            orientation: enc.u16_at(d, 0)?,
            optical_size: enc.f64_at(d, 2)?,
            optical_alignment: enc.u16_at(d, 12)?,
            frame_type: enc.u16_at(d, 14)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A u32 length and one segment of single-byte characters.
    fn export_string(enc: Encoding, s: &str) -> Vec<u8> {
        let mut d = enc.u32_bytes(s.len() as u32).to_vec();
        if !s.is_empty() {
            d.extend(enc.u16_bytes(0x4000 | s.len() as u16));
            d.extend(s.bytes());
        }
        d
    }

    #[test]
    fn reads_toc_entries() {
        use crate::database::synthetic::flagged_string;
        let be = Encoding::new(
            crate::header::ByteOrder::Big,
            crate::header::Version { major: 4, minor: 0 },
        );
        for enc in [Encoding::default(), be] {
            let mut d = enc.u16_bytes(1).to_vec();
            d.extend(flagged_string(enc, 1, "Heading"));
            d.extend(flagged_string(enc, 2, ""));
            d.extend(enc.u32_bytes(0x51));
            d.extend(enc.u16_bytes(2));
            d.extend(enc.u16_bytes(1));
            d.extend(enc.u16_bytes(2));
            d.extend(enc.u32_bytes(0));
            d.extend(export_string(enc, "\t"));
            d.extend(enc.u32_bytes(0x60));
            d.extend(enc.u16_bytes(0));
            d.extend(export_string(enc, "; "));
            d.extend(enc.u16_bytes(1));
            let e = toc_entries(&mut enc.cursor(&d)).unwrap();
            assert_eq!(e.len(), 1);
            assert_eq!((e[0].name.as_str(), e[0].builtin), ("Heading", true));
            assert_eq!((e[0].format_style, e[0].level), (0x51, 2));
            assert_eq!(e[0].page_number_position, 2);
            assert_eq!(
                (e[0].separator.as_str(), e[0].separator_style),
                ("\t", 0x60)
            );
            // Bytes after the entries: not read.
            d.push(0);
            assert!(toc_entries(&mut enc.cursor(&d)).is_err());
        }
    }

    #[test]
    fn reads_export_tag_maps_and_flags() {
        let enc = Encoding::default();
        let mut d = enc.u32_bytes(2).to_vec();
        for (ty, tag, class) in [("EPUB", "p", ""), ("PDF", "H3", "x")] {
            for s in [ty, tag, class] {
                d.extend(export_string(enc, s));
            }
            d.extend(enc.u32_bytes(0));
        }
        for f in [1u16, 0, 1, 0] {
            d.extend(enc.u16_bytes(f));
        }
        let e = StyleExport::read(enc, &d).unwrap();
        assert_eq!(e.maps.len(), 2);
        assert_eq!(
            (e.maps[1].export_type.as_str(), e.maps[1].tag.as_str()),
            ("PDF", "H3")
        );
        assert_eq!(e.maps[0].class, "");
        assert_eq!(e.flags, [1, 0, 1, 0]);
        assert!(StyleExport::read(enc, &enc.u32_bytes(1000)).is_err());
    }

    #[test]
    fn accepts_only_guids_as_unique_ids() {
        assert!(is_guid("0a1b2c3d-0000-4fff-8abc-0123456789ab"));
        assert!(!is_guid("myHorizontalScaleForEmDashSpaceAfter"));
        assert!(!is_guid("0A1B2C3D-0000-4FFF-8ABC-0123456789AB"));
    }
}
