//! Hyperlinks, their text sources and destinations, and bookmarks. See
//! `docs/format/hyperlinks.md`.

use std::collections::BTreeMap;

use crate::Error;
use crate::object::{Encoding, Object};

pub mod class {
    pub const HYPERLINK: u32 = 0x13501;
    pub const TEXT_SOURCE: u32 = 0x13502;
    pub const PAGE_ITEM_SOURCE: u32 = 0x13503;
    /// Text and paragraph destinations.
    pub const TEXT_DESTINATION: u32 = 0x13504;
    pub const PAGE_DESTINATION: u32 = 0x13505;
    pub const URL_DESTINATION: u32 = 0x13506;
    /// A page of another document.
    pub const EXTERNAL_PAGE_DESTINATION: u32 = 0x13552;
    pub const BOOKMARK: u32 = 0x1354C;
    /// An item owned by a story at the position of a text destination.
    pub const DESTINATION_OWNER: u32 = 0x1353C;
    /// InDesign 5.0: items owned by a story at the first and the last
    /// character of a text source.
    pub const SOURCE_START: u32 = 0x13508;
    pub const SOURCE_END: u32 = 0x1353B;
    /// A story strand that holds text ranges in a tree.
    pub const RANGE_STRAND: u32 = 0xCA1C;
    /// A node of a range tree.
    pub const RANGE_NODE: u32 = 0xCA1E;
}

pub mod chunk {
    /// Document: lists of text sources, hyperlinks and bookmarks.
    pub const DOCUMENT_LISTS: u32 = 0x13501;
    pub const HYPERLINK: u32 = 0x13502;
    /// Hyperlink: appearance.
    pub const HYPERLINK_APPEARANCE: u32 = 0x13553;
    /// Hyperlink: a destination in another document.
    pub const OTHER_DOCUMENT: u32 = 0x1359F;
    pub const TEXT_SOURCE: u32 = 0x13504;
    pub const TEXT_SOURCE_RANGE: u32 = 0x1352E;
    /// Text source: alternative destination (sources made by a table of
    /// contents).
    pub const TEXT_SOURCE_ALTERNATIVE: u32 = 0x135B7;
    /// Text source: a cross-reference source, with its format.
    pub const CROSS_REFERENCE: u32 = 0x135A0;
    /// Page item source: hidden and name.
    pub const PAGE_ITEM_SOURCE: u32 = 0x13505;
    /// Page item source: the page item.
    pub const PAGE_ITEM_SOURCE_ITEM: u32 = 0x13525;
    pub const PAGE_DESTINATION: u32 = 0x13507;
    pub const PAGE_DESTINATION_VIEW: u32 = 0x13527;
    pub const URL_DESTINATION: u32 = 0x13509;
    /// External page destination: hidden, name and key.
    pub const EXTERNAL_PAGE_DESTINATION: u32 = 0x13580;
    /// External page destination: page index from 0.
    pub const EXTERNAL_PAGE_INDEX: u32 = 0x1B8;
    /// Text destination: hidden, name and key.
    pub const TEXT_DESTINATION: u32 = 0x13508;
    /// Text destination: owner UID and kind.
    pub const TEXT_DESTINATION_OWNER: u32 = 0x13526;
    /// Destination owner: the destination UID.
    pub const OWNER_DESTINATION: u32 = 0x1352B;
    /// Destination owner in InDesign 5.0: the destination UID at offset 8.
    pub const OWNER_DESTINATION_5: u32 = 0x1351E;
    /// Text source in InDesign 5.0: start and end marker UIDs.
    pub const SOURCE_MARKERS: u32 = 0x13524;
    /// URL destination: the URL.
    pub const URL: u32 = 0x100B;
    pub const BOOKMARK: u32 = 0x13547;
    /// Range strand: the first page of its tree.
    pub const RANGE_TREE: u32 = 0x16126;
    /// Range tree page: links and nodes.
    pub const RANGE_PAGE: u32 = 0x16127;
}

#[derive(Debug, Clone, PartialEq)]
pub struct Hyperlink {
    pub uid: u32,
    pub name: String,
    pub source: u32,
    pub hidden: bool,
    /// `DestinationUniqueKey`, shared with the destination; `None` in
    /// InDesign 5.0 files.
    pub key: Option<u32>,
    /// The destination UID (InDesign 5.0 files, which have no keys).
    pub destination: Option<u32>,
    /// Destination kind (u32 at offset 12 of chunk 0x13502).
    pub kind: u32,
    /// Chunk 0x13553 has the pattern of every corpus hyperlink, whose
    /// `Visible`, `Width`, `BorderStyle` and `BorderColor` are one value.
    pub appearance_known: bool,
    /// Byte 10 of chunk 0x13553 (`Highlight`), when the pattern holds.
    pub highlight: Option<u8>,
    /// Chunk 0x1359F: the destination is in another document.
    pub other_document: bool,
}

/// Destination kinds of a hyperlink (u32 at offset 12 of chunk 0x13502).
pub mod kind {
    /// No destination in this document.
    pub const NONE: u32 = 2000;
    /// A page in another document.
    pub const EXTERNAL_PAGE: u32 = 2004;
}

#[derive(Debug, Clone, PartialEq)]
pub struct TextSource {
    pub uid: u32,
    pub name: String,
    pub hidden: bool,
    pub character_style: Option<u32>,
    /// Chunk 0x135B7: `AlternativeDestination`.
    pub alternative: Option<Alternative>,
    /// Chunk 0x135A0: the source is a `CrossReferenceSource` with this
    /// cross-reference format.
    pub format: Option<u32>,
}

/// An alternative destination of a text source (chunk 0x135B7).
#[derive(Debug, Clone, PartialEq)]
pub struct Alternative {
    /// Type code; 2 is a table of contents anchor, the only one seen.
    pub kind: u32,
    pub anchor_name: String,
    pub index_marker: u32,
    pub page_number: String,
    pub level: u32,
}

impl Alternative {
    /// The type code of a table of contents anchor (`TocTextAnchor`).
    const TOC_ANCHOR: u32 = 2;

    pub fn is_toc_anchor(&self) -> bool {
        self.kind == Self::TOC_ANCHOR
    }

    fn read(enc: Encoding, d: &[u8]) -> Result<Alternative, Error> {
        let mut c = enc.cursor(d);
        let kind = c.u32()?;
        let anchor_name = c.name()?.name;
        let index_marker = c.u32()?;
        let n = c.u32()? as usize;
        let page_number = if n == 0 {
            String::new()
        } else {
            c.segments(n)?
        };
        Ok(Alternative {
            kind,
            anchor_name,
            index_marker,
            page_number,
            level: c.u32()?,
        })
    }
}

/// A page item that is a hyperlink source (class 0x13503).
#[derive(Debug, Clone, PartialEq)]
pub struct PageItemSource {
    pub uid: u32,
    pub name: String,
    pub hidden: bool,
    pub item: u32,
}

impl PageItemSource {
    pub fn read(uid: u32, obj: &Object) -> Result<Option<PageItemSource>, Error> {
        let enc = obj.encoding;
        let (Some(d), Some(i)) = (
            obj.chunk(chunk::PAGE_ITEM_SOURCE),
            obj.chunk(chunk::PAGE_ITEM_SOURCE_ITEM),
        ) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let hidden = c.u8()? != 0;
        c.skip(5)?;
        let name = c.name()?.name;
        Ok(Some(PageItemSource {
            uid,
            name,
            hidden,
            item: enc.cursor(i).u32()?,
        }))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum DestinationKind {
    Page {
        page: u32,
        /// View zoom as a fraction (1 = 100 %). `None` when outside the
        /// 5–4000 % the IDML schema allows (0 in some files).
        zoom: Option<f64>,
        /// View setting code.
        view: u32,
        /// `ViewBounds`: left, top, right, bottom.
        bounds: Option<[f64; 4]>,
    },
    Url {
        url: String,
    },
    /// A page of another document (`HyperlinkExternalPageDestination`).
    ExternalPage {
        /// Page index from 0.
        page_index: u32,
        zoom: Option<f64>,
        view: u32,
        bounds: Option<[f64; 4]>,
        /// The link to the other document (chunk 0x1359F).
        link: Option<u32>,
        /// The last part of the linked document's path, decoded.
        file_name: Option<String>,
    },
    /// A position in story text (`HyperlinkTextDestination`).
    Text,
    /// A paragraph (`ParagraphDestination`), the target of
    /// cross-references.
    Paragraph,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Destination {
    pub uid: u32,
    pub name: String,
    pub hidden: bool,
    /// `DestinationUniqueKey`; `None` in InDesign 5.0 files, whose
    /// destination chunks end after the name.
    pub key: Option<u32>,
    pub kind: DestinationKind,
}

impl Destination {
    /// The IDML `Self` (and reference) of the destination.
    pub fn reference(&self) -> String {
        let escaped = self
            .name
            .replace('%', "%25")
            .replace(':', "%3a")
            .replace('\r', "%0d");
        match self.kind {
            DestinationKind::Page { .. } => format!("HyperlinkPageDestination/{escaped}"),
            DestinationKind::Url { .. } => format!("HyperlinkURLDestination/{escaped}"),
            DestinationKind::ExternalPage { .. } => format!("u{:x}", self.uid),
            DestinationKind::Text => format!("HyperlinkTextDestination/{escaped}"),
            DestinationKind::Paragraph => format!("ParagraphDestination/{escaped}"),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Bookmark {
    pub uid: u32,
    pub name: String,
    /// The parent bookmark, or the document (UID 1).
    pub parent: u32,
    pub children: Vec<u32>,
    pub destination: u32,
}

/// Chunk 0x13553 of every corpus hyperlink, apart from byte 6 (not
/// identified) and byte 10 (`Highlight`).
const APPEARANCE: [u8; 18] = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/// Whether chunk 0x13553 has the corpus pattern; its `Highlight` byte if so.
fn appearance(data: Option<&[u8]>) -> Option<u8> {
    let d = data?;
    let known = d.len() == APPEARANCE.len()
        && d.iter()
            .zip(APPEARANCE)
            .enumerate()
            .all(|(i, (&b, a))| i == 6 || i == 10 || b == a);
    known.then_some(d[10])
}

impl Hyperlink {
    /// The kind says the hyperlink has no destination in this document.
    pub fn kind_is_none(&self) -> bool {
        self.kind == kind::NONE
    }

    /// The hyperlink points at a page of another document.
    pub fn to_external_page(&self) -> bool {
        self.kind == kind::EXTERNAL_PAGE
    }

    /// Read a hyperlink of a document of major version `major`.
    pub fn read(uid: u32, obj: &Object, major: u32) -> Result<Option<Hyperlink>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::HYPERLINK) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let source = c.u32()?;
        c.skip(2)?;
        let hidden = c.u16()? != 0;
        // InDesign 5.0: the destination UID twice, then the kind;
        // later: the key, the kind and a u32 not identified.
        let (key, destination, kind) = if major <= 5 {
            let dest = c.u32()?;
            c.skip(4)?;
            (None, (dest != 0).then_some(dest), c.u32()?)
        } else {
            let key = c.u32()?;
            let kind = c.u32()?;
            c.skip(4)?;
            (Some(key), None, kind)
        };
        c.skip(4)?;
        let name = c.name()?.name;
        let highlight = appearance(obj.chunk(chunk::HYPERLINK_APPEARANCE));
        Ok(Some(Hyperlink {
            uid,
            name,
            source,
            hidden,
            key,
            destination,
            kind,
            appearance_known: highlight.is_some(),
            highlight,
            other_document: obj.chunk(chunk::OTHER_DOCUMENT).is_some(),
        }))
    }
}

impl TextSource {
    pub fn read(uid: u32, obj: &Object) -> Result<Option<TextSource>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::TEXT_SOURCE) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let hidden = c.u8()? != 0;
        c.skip(5)?;
        let name = c.name()?.name;
        let character_style = match obj.chunk(chunk::TEXT_SOURCE_RANGE) {
            Some(r) => {
                let mut c = enc.cursor(r);
                c.skip(8)?;
                Some(c.u32()?).filter(|&s| s != 0)
            }
            None => None,
        };
        Ok(Some(TextSource {
            uid,
            name,
            hidden,
            character_style,
            alternative: obj
                .chunk(chunk::TEXT_SOURCE_ALTERNATIVE)
                .map(|d| Alternative::read(enc, d))
                .transpose()?,
            format: match obj.chunk(chunk::CROSS_REFERENCE) {
                Some(d) => {
                    // u32 1, two strings, u32 format UID.
                    let mut c = enc.cursor(d);
                    c.skip(4)?;
                    c.name()?;
                    c.name()?;
                    Some(c.u32()?)
                }
                None => None,
            },
        }))
    }
}

impl Destination {
    pub fn read(uid: u32, class: u32, obj: &Object) -> Result<Option<Destination>, Error> {
        let enc = obj.encoding;
        let id = match class {
            class::PAGE_DESTINATION => chunk::PAGE_DESTINATION,
            class::EXTERNAL_PAGE_DESTINATION => chunk::EXTERNAL_PAGE_DESTINATION,
            class::TEXT_DESTINATION => chunk::TEXT_DESTINATION,
            _ => chunk::URL_DESTINATION,
        };
        let Some(d) = obj.chunk(id) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let hidden = c.u8()? != 0;
        c.skip(1)?;
        let name = c.name()?.name;
        let key = if c.remaining() >= 4 {
            Some(c.u32()?)
        } else {
            None
        };
        let kind = if class == class::TEXT_DESTINATION {
            // Chunk 0x13526: owner UID, u16 kind (InDesign 5.0: the owner
            // UID alone).
            let owner = obj.chunk(chunk::TEXT_DESTINATION_OWNER);
            match owner.map(|d| enc.u16_at(d, 4)) {
                Some(Some(0) | None) => DestinationKind::Text,
                Some(Some(1)) => DestinationKind::Paragraph,
                _ => return Ok(None),
            }
        } else if class == class::PAGE_DESTINATION || class == class::EXTERNAL_PAGE_DESTINATION {
            // Chunk 0x13527: page UID, zoom, view setting, bounds.
            let Some(v) = obj.chunk(chunk::PAGE_DESTINATION_VIEW) else {
                return Ok(None);
            };
            let mut c = enc.cursor(v);
            let page = c.u32()?;
            let zoom = Some(c.f64()?).filter(|z| (0.05..=40.0).contains(z));
            let view = c.u32()?;
            let bounds = if c.remaining() >= 32 {
                Some([c.f64()?, c.f64()?, c.f64()?, c.f64()?])
            } else {
                None
            };
            if class == class::PAGE_DESTINATION {
                DestinationKind::Page {
                    page,
                    zoom,
                    view,
                    bounds,
                }
            } else {
                let Some(page_index) = obj
                    .chunk(chunk::EXTERNAL_PAGE_INDEX)
                    .and_then(|d| enc.u32_at(d, 0))
                else {
                    return Ok(None);
                };
                DestinationKind::ExternalPage {
                    page_index,
                    zoom,
                    view,
                    bounds,
                    link: obj
                        .chunk(chunk::OTHER_DOCUMENT)
                        .and_then(|d| enc.u32_at(d, 8))
                        .filter(|&u| u != 0),
                    file_name: None,
                }
            }
        } else {
            let url = match obj.chunk(chunk::URL) {
                Some(u) => enc.cursor(u).name()?.name,
                None => name.clone(),
            };
            DestinationKind::Url { url }
        };
        Ok(Some(Destination {
            uid,
            name,
            hidden,
            key,
            kind,
        }))
    }
}

impl Bookmark {
    pub fn read(uid: u32, obj: &Object) -> Result<Option<Bookmark>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::BOOKMARK) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let name = c.name()?.name;
        c.skip(4)?;
        let parent = c.u32()?;
        let children = c.u32_list()?;
        let destination = c.u32()?;
        Ok(Some(Bookmark {
            uid,
            name,
            parent,
            children,
            destination,
        }))
    }
}

/// The bookmark list in document chunk 0x13501. From InDesign 6.0: u32,
/// u16, then UID lists of text sources, hyperlinks and bookmarks. In 3.0
/// to 5.0 files: UID lists of text sources, destinations, hyperlinks and
/// bookmarks (`docs/format/hyperlinks.md`).
pub fn document_bookmarks(enc: Encoding, data: &[u8], major: u32) -> Result<Vec<u32>, Error> {
    let mut c = enc.cursor(data);
    if major <= 5 {
        for _ in 0..3 {
            c.u32_list()?;
        }
        return c.u32_list();
    }
    c.skip(6)?;
    c.u32_list()?;
    c.u32_list()?;
    c.u32_list()
}

/// A stretch of story text that is a hyperlink text source.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SourceRange {
    /// UTF-16 offset in the story text.
    pub start: usize,
    pub len: usize,
    pub source: u32,
    /// Written as a child of the paragraph range, around character
    /// ranges, rather than inside one character range.
    pub paragraph: bool,
}

/// One node of a range tree.
struct Node {
    parent: u32,
    left: u32,
    right: u32,
    value: u32,
    len: u32,
    source: u32,
}

/// Read the nodes of one range tree page (chunk 0x16127) into `nodes`, by
/// node index. Returns the next page's UID (0 for none).
fn read_page(enc: Encoding, data: &[u8], nodes: &mut BTreeMap<u32, Node>) -> Result<u32, Error> {
    let mut c = enc.cursor(data);
    let next = c.u32()?;
    c.skip(12)?;
    let n = c.u32()? as usize;
    c.skip(4 * n)?;
    let count = c.u32()?;
    for _ in 0..count {
        let class = c.u32()?;
        let size = c.u32()? as usize;
        let body = c.bytes(size)?;
        if class != class::RANGE_NODE || size != 60 {
            continue;
        }
        let mut b = enc.cursor(body);
        b.skip(12)?;
        let mut refs = [0u32; 4];
        for r in &mut refs {
            let object = b.u32()?;
            let index = b.u32()?;
            *r = if object == 0 { 0 } else { index };
        }
        let [parent, me, left, right] = refs;
        nodes.insert(
            me,
            Node {
                parent,
                left,
                right,
                value: b.u32()?,
                len: b.u32()?,
                source: b.u32()?,
            },
        );
    }
    Ok(next)
}

/// The text ranges held in the range tree of a strand. Each node's start
/// is stored relative to its parent: a left child starts `value` before
/// its parent, a right child `value` after it; the root's value is its
/// start.
pub fn source_ranges(
    enc: Encoding,
    first_page: u32,
    mut page_data: impl FnMut(u32) -> Result<Option<Vec<u8>>, Error>,
) -> Result<Vec<SourceRange>, Error> {
    let mut nodes = BTreeMap::new();
    let mut page = first_page;
    let mut seen = Vec::new();
    while page != 0 && !seen.contains(&page) {
        seen.push(page);
        let Some(data) = page_data(page)? else { break };
        page = read_page(enc, &data, &mut nodes)?;
    }
    let mut out = Vec::new();
    let roots: Vec<u32> = nodes
        .iter()
        .filter(|(_, n)| n.parent == 0)
        .map(|(&k, _)| k)
        .collect();
    let bad = || Error::Corrupt("range tree is inconsistent".into());
    for root in roots {
        let mut stack = vec![(root, nodes[&root].value as i64)];
        while let Some((k, pos)) = stack.pop() {
            if out.len() > nodes.len() {
                return Err(bad());
            }
            let n = nodes.get(&k).ok_or_else(bad)?;
            if pos < 0 {
                return Err(bad());
            }
            out.push(SourceRange {
                start: pos as usize,
                len: n.len as usize,
                source: n.source,
                paragraph: false,
            });
            if n.left != 0 {
                let l = nodes.get(&n.left).ok_or_else(bad)?;
                stack.push((n.left, pos - l.value as i64));
            }
            if n.right != 0 {
                let r = nodes.get(&n.right).ok_or_else(bad)?;
                stack.push((n.right, pos + r.value as i64));
            }
        }
    }
    out.sort_by_key(|r| r.start);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(
        parent: u32,
        me: u32,
        left: u32,
        right: u32,
        value: u32,
        len: u32,
        src: u32,
    ) -> Vec<u8> {
        let mut v = class::RANGE_NODE.to_le_bytes().to_vec();
        v.extend(60u32.to_le_bytes());
        v.extend([1, 0, 0xE4, 0xCA, 0, 0, 0x32, 0, 0, 0, 0, 0]);
        for r in [parent, me, left, right] {
            v.extend((if r == 0 { 0u32 } else { 0x61 }).to_le_bytes());
            v.extend(r.to_le_bytes());
        }
        for x in [value, len, src, 0] {
            v.extend(x.to_le_bytes());
        }
        v
    }

    #[test]
    fn reads_alternative_destination() {
        let enc = Encoding::default();
        let mut d = 2u32.to_le_bytes().to_vec();
        d.extend(crate::database::synthetic::flagged_string(enc, 2, "a1"));
        d.extend(0u32.to_le_bytes());
        d.extend(2u32.to_le_bytes());
        d.extend([0x02, 0x40, 0x08, b'7']);
        d.extend(3u32.to_le_bytes());
        let a = Alternative::read(enc, &d).unwrap();
        assert!(a.is_toc_anchor());
        assert_eq!(
            (a.anchor_name.as_str(), a.page_number.as_str(), a.level),
            ("a1", "\u{8}7", 3)
        );
    }

    #[test]
    fn appearance_pattern_gives_the_highlight() {
        let mut d = APPEARANCE;
        d[6] = 0x1D;
        d[10] = 1;
        assert_eq!(appearance(Some(&d)), Some(1));
        d[3] = 1;
        assert_eq!(appearance(Some(&d)), None);
        assert_eq!(appearance(Some(&d[..17])), None);
        assert_eq!(appearance(None), None);
    }

    #[test]
    fn positions_are_relative_to_the_parent() {
        // Root at 260; left child 138 before it, right child 120 after.
        let mut page = Vec::new();
        for x in [0u32, 0, 0x61, 185, 3, 1, 2, 3, 3] {
            page.extend(x.to_le_bytes());
        }
        page.extend(node(2, 1, 0, 0, 138, 22, 0xA));
        page.extend(node(0, 2, 1, 3, 260, 38, 0xB));
        page.extend(node(2, 3, 0, 0, 120, 15, 0xC));
        let ranges = source_ranges(crate::object::Encoding::default(), 7, |_| {
            Ok(Some(page.clone()))
        })
        .unwrap();
        let got: Vec<_> = ranges.iter().map(|r| (r.start, r.len, r.source)).collect();
        assert_eq!(got, [(122, 22, 0xA), (260, 38, 0xB), (380, 15, 0xC)]);
    }
}
