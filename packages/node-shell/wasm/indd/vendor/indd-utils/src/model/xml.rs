//! The XML structure: elements, the markers that place them in story text,
//! and the content they tag. See `docs/format/xml.md`.

use std::collections::BTreeMap;

use crate::Error;
use crate::object::Encoding;

pub mod class {
    /// Node type of the document node, the parent of the root element.
    pub const DOCUMENT_NODE: u32 = 0xBF2F;
    /// Node type of an element.
    pub const ELEMENT: u32 = 0xBF34;
    /// The story strand that holds the positions of the story's markers.
    pub const MARKER_STRAND: u32 = 0x2B8;
    /// A child of a page item that stands for it as tagged content.
    pub const CONTENT_HOLDER: u32 = 0x2C65;
}

pub mod chunk {
    /// Of a story: u32 first page of the story's node store.
    pub const STORE: u32 = 0x16126;
    /// Of a store page (class 0x1610A): the nodes.
    pub const PAGE: u32 = 0x16127;
    /// Of a node: tag, content, parent, the node itself and its children.
    pub const NODE: u32 = 0xBF0D;
    /// Of a node: start and end marker IDs.
    pub const MARKERS: u32 = 0x1032;
    /// Of the marker strand: the markers' positions.
    pub const MARKER_TREE: u32 = 0xCA57;
    /// Of the document, a story or a content holder: the node it belongs
    /// to, as u32 store and u32 node ID.
    pub const NODE_REF: u32 = 0xBF14;
}

/// A node is named by the story whose store holds it and its ID there.
pub type Key = (u32, u32);

const NONE: u32 = 0xFFFF_FFFF;

#[derive(Debug, Clone, PartialEq)]
pub struct Node {
    pub key: Key,
    /// The document node (the root element's parent), not an element.
    pub document: bool,
    /// Tag UID (class 0xBF19); 0 for the document node.
    pub tag: u32,
    /// UID of the tagged content (a story or a content holder), or 0.
    pub content: u32,
    pub parent: Key,
    pub children: Vec<Key>,
    /// Start marker ID.
    pub start: Option<u32>,
    /// End marker ID; `None` for an element that is a single marker.
    pub end: Option<u32>,
    /// The element's attributes: name and value.
    pub attributes: Vec<(String, String)>,
}

/// Read the nodes of a store, following the pages from `first_page`.
pub fn read_store(
    enc: Encoding,
    first_page: u32,
    mut page_data: impl FnMut(u32) -> Result<Option<Vec<u8>>, Error>,
) -> Result<Vec<Node>, Error> {
    let mut out = Vec::new();
    let mut page = first_page;
    let mut seen = Vec::new();
    while page != 0 && !seen.contains(&page) {
        seen.push(page);
        let Some(data) = page_data(page)? else { break };
        page = read_page(enc, &data, &mut out)?;
    }
    Ok(out)
}

/// One store page (chunk 0x16127): u32 next page, u32 previous page, u32
/// story, u32, u32 *n*, *n* node IDs, u32 node count, then the nodes, each
/// u32 type, u32 size and the node data. Returns the next page.
fn read_page(enc: Encoding, data: &[u8], out: &mut Vec<Node>) -> Result<u32, Error> {
    let mut c = enc.cursor(data);
    let next = c.u32()?;
    c.skip(12)?;
    let n = c.u32()? as usize;
    c.skip(4 * n)?;
    let count = c.u32()?;
    for _ in 0..count {
        let kind = c.u32()?;
        let size = c.u32()? as usize;
        let body = c.bytes(size)?;
        if kind == class::DOCUMENT_NODE || kind == class::ELEMENT {
            out.push(parse_node(enc, kind, body)?);
        }
    }
    Ok(next)
}

/// Node data: u16 count, then that many (u32 ID, u32 length, data) parts.
fn parse_node(enc: Encoding, kind: u32, body: &[u8]) -> Result<Node, Error> {
    let mut c = enc.cursor(body);
    let n = c.u16()?;
    let mut node = None;
    let mut markers = (NONE, NONE);
    for _ in 0..n {
        let id = c.u32()?;
        let len = c.u32()? as usize;
        let data = c.bytes(len)?;
        match id {
            chunk::NODE => node = Some(data),
            chunk::MARKERS if len >= 8 => {
                let mut m = enc.cursor(data);
                markers = (m.u32()?, m.u32()?);
            }
            _ => {}
        }
    }
    let data = node.ok_or_else(|| Error::Corrupt("XML node without chunk 0xBF0D".into()))?;
    let child_list_ends = |c: &mut crate::object::Cursor| {
        c.skip(16).is_ok()
            && c.u32()
                .is_ok_and(|k| (k as usize).checked_mul(8) == Some(c.remaining()))
    };
    let mut c = enc.cursor(data);
    let tag = c.u32()?;
    let content = c.u32()?;
    // u32 tag, u32 content, 22 bytes that end with the attribute count
    // (20 bytes in a file from InDesign 4.0, 4 in one from 3.0, without
    // attributes), the attributes, parent, self, child list (xml.md).
    let attributes = attributes(&mut enc.cursor(&data[8.min(data.len())..]));
    let mut c = match attributes {
        Some((_, at)) => {
            let mut c = enc.cursor(data);
            c.skip(8 + at)?;
            c
        }
        None => {
            let fixed = [22, 20, 4]
                .into_iter()
                .find(|&n| {
                    let mut c = enc.cursor(data);
                    c.skip(n + 8).is_ok() && child_list_ends(&mut c)
                })
                .ok_or_else(|| Error::Corrupt("XML node of unknown layout".into()))?;
            c.skip(fixed)?;
            c
        }
    };
    let mut key = || -> Result<Key, Error> { Ok((c.u32()?, c.u32()?)) };
    let parent = key()?;
    let me = key()?;
    let count = c.u32()? as usize;
    if count > c.remaining() / 8 {
        return Err(Error::Corrupt("XML node child list is too long".into()));
    }
    let children = (0..count)
        .map(|_| Ok((c.u32()?, c.u32()?)))
        .collect::<Result<Vec<_>, Error>>()?;
    let marker = |m: u32| (m != NONE).then_some(m);
    Ok(Node {
        key: me,
        document: kind == class::DOCUMENT_NODE,
        tag,
        content,
        parent,
        children,
        start: marker(markers.0),
        end: marker(markers.1),
        attributes: attributes.map(|(a, _)| a).unwrap_or_default(),
    })
}

/// The attributes of an element node, after tag and content: 18 bytes
/// not identified, u32 count, then per attribute u32 name length and the
/// name as text segments, u16 (not identified), u32 value length and the
/// value. Returns them and the size read, when one or more attributes
/// are followed by a child list that ends the part (xml.md).
fn attributes(c: &mut crate::object::Cursor) -> Option<(Vec<(String, String)>, usize)> {
    c.skip(18).ok()?;
    let n = c.u32().ok()? as usize;
    if n == 0 || n > c.remaining() / 10 {
        return None;
    }
    let start = c.pos();
    let text = |c: &mut crate::object::Cursor| {
        let len = c.u32().ok()? as usize;
        if len > c.remaining() {
            return None;
        }
        c.segments(len).ok()
    };
    let mut out = Vec::with_capacity(n);
    for _ in 0..n {
        let name = text(c)?;
        c.u16().ok()?;
        let value = text(c)?;
        out.push((name, value));
    }
    let size = 22 + (c.pos() - start);
    c.skip(16).ok()?;
    let k = c.u32().ok()? as usize;
    (k.checked_mul(8) == Some(c.remaining())).then_some((out, size))
}

/// The marker tree (chunk 0xCA57): marker ID to character position. A u16
/// that is 0 for an empty tree, then the nodes in preorder, each u16, u32
/// value, u32 marker ID, u32 length (1), u16 flags (1 = has a left child,
/// 2 = has a right child). The root's value is its position; a left child
/// is *value* before its parent, a right child *value* after it.
pub fn marker_positions(enc: Encoding, data: &[u8]) -> Result<BTreeMap<u32, usize>, Error> {
    let bad = || Error::Corrupt("XML marker tree is inconsistent".into());
    let mut out = BTreeMap::new();
    let mut c = enc.cursor(data);
    if c.u16()? == 0 {
        return Ok(out);
    }
    // (parent position, side): side 0 for the root, -1 left, 1 right.
    let mut stack: Vec<(i64, i8)> = vec![(0, 0)];
    while let Some((parent, side)) = stack.pop() {
        c.skip(2)?;
        let value = c.u32()? as i64;
        let marker = c.u32()?;
        c.skip(4)?;
        let flags = c.u16()?;
        let pos = match side {
            0 => value,
            -1 => parent - value,
            _ => parent + value,
        };
        if pos < 0 || flags > 3 {
            return Err(bad());
        }
        out.insert(marker, pos as usize);
        if flags & 2 != 0 {
            stack.push((pos, 1));
        }
        if flags & 1 != 0 {
            stack.push((pos, -1));
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree_node(value: u32, marker: u32, flags: u16) -> Vec<u8> {
        let mut v = vec![1, 0];
        v.extend(value.to_le_bytes());
        v.extend(marker.to_le_bytes());
        v.extend(1u32.to_le_bytes());
        v.extend(flags.to_le_bytes());
        v
    }

    #[test]
    fn marker_positions_are_relative_to_the_parent() {
        // Root marker 9 at 8; left child 5 at 7 with left child 6 at 2;
        // right child 7 at 9.
        let mut d = vec![1, 0];
        d.extend(tree_node(8, 9, 3));
        d.extend(tree_node(1, 5, 1));
        d.extend(tree_node(5, 6, 0));
        d.extend(tree_node(1, 7, 0));
        d.extend([0x37, 0, 0, 0, 0, 0, 0, 0]);
        let got: Vec<_> = marker_positions(crate::object::Encoding::default(), &d)
            .unwrap()
            .into_iter()
            .collect();
        assert_eq!(got, [(5, 7), (6, 2), (7, 9), (9, 8)]);
        assert!(
            marker_positions(
                crate::object::Encoding::default(),
                &[0, 0, 1, 0, 0, 0, 0, 0, 0, 0]
            )
            .unwrap()
            .is_empty()
        );
    }

    #[test]
    fn reads_an_element_node() {
        let mut node = Vec::new();
        node.extend(0xFCu32.to_le_bytes()); // tag
        node.extend(0xE4u32.to_le_bytes()); // content
        node.extend([0xFF; 4]);
        node.extend(1u32.to_le_bytes());
        node.extend(1u32.to_le_bytes());
        node.extend([0, 0, 2, 0, 0, 0, 0, 0, 0, 0]);
        for v in [0x9C, 0xF, 0x9C, 0x1F, 1, 0xE4, 4] {
            node.extend((v as u32).to_le_bytes());
        }
        let mut body = 2u16.to_le_bytes().to_vec();
        body.extend(chunk::MARKERS.to_le_bytes());
        body.extend(8u32.to_le_bytes());
        body.extend(0x26u32.to_le_bytes());
        body.extend(NONE.to_le_bytes());
        body.extend(chunk::NODE.to_le_bytes());
        body.extend((node.len() as u32).to_le_bytes());
        body.extend(&node);
        let n = parse_node(crate::object::Encoding::default(), class::ELEMENT, &body).unwrap();
        assert_eq!(n.key, (0x9C, 0x1F));
        assert_eq!(n.parent, (0x9C, 0xF));
        assert_eq!(n.children, [(0xE4, 4)]);
        assert_eq!(
            (n.tag, n.content, n.start, n.end),
            (0xFC, 0xE4, Some(0x26), None)
        );
        assert!(!n.document);
    }

    #[test]
    fn reads_the_attributes_of_an_element_node() {
        let text = |s: &str| {
            let mut v = (s.len() as u32).to_le_bytes().to_vec();
            v.extend((0x4000 | s.len() as u16).to_le_bytes());
            v.extend(s.as_bytes());
            v
        };
        let mut node = Vec::new();
        node.extend(0xFCu32.to_le_bytes());
        node.extend(0u32.to_le_bytes());
        node.extend([0xFF; 4]);
        node.extend([0; 14]);
        node.extend(1u32.to_le_bytes()); // one attribute
        node.extend(text("href"));
        node.extend(0u16.to_le_bytes());
        node.extend(text("x.html"));
        for v in [0x9C, 0xF, 0x9C, 0x1F, 0] {
            node.extend((v as u32).to_le_bytes());
        }
        let mut body = 1u16.to_le_bytes().to_vec();
        body.extend(chunk::NODE.to_le_bytes());
        body.extend((node.len() as u32).to_le_bytes());
        body.extend(&node);
        let n = parse_node(crate::object::Encoding::default(), class::ELEMENT, &body).unwrap();
        assert_eq!(n.attributes, [("href".to_string(), "x.html".to_string())]);
        assert_eq!((n.key, n.parent), ((0x9C, 0x1F), (0x9C, 0xF)));
        assert!(n.children.is_empty());
    }
}
