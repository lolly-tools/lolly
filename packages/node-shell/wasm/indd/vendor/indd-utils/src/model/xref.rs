//! Cross-reference formats (class 0x1355E). See
//! `docs/format/cross-references.md`.

use crate::Error;
use crate::object::{Encoding, Name, Object};

pub const CLASS: u32 = 0x1355E;
pub const CHUNK: u32 = 0x13593;

/// Building block type codes and their IDML `BlockType`.
pub const BLOCK_TYPES: &[(u32, &str)] = &[
    (0, "CustomStringBuildingBlock"),
    (3, "PageNumberBuildingBlock"),
    (4, "FullParagraphBuildingBlock"),
    (5, "ParagraphNumberBuildingBlock"),
    (6, "ParagraphTextBuildingBlock"),
    (7, "BookmarkNameBuildingBlock"),
];

#[derive(Debug, Clone, PartialEq)]
pub struct CrossReferenceFormat {
    pub uid: u32,
    pub name: String,
    /// The format's u32 character style field; 0 in every sample.
    pub character_style: u32,
    pub blocks: Vec<BuildingBlock>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BuildingBlock {
    pub kind: u32,
    /// The 10 bytes after the type are all 0, as in every sample.
    pub zero_fields: bool,
    /// `CustomText`.
    pub text: Name,
}

impl BuildingBlock {
    pub fn type_name(&self) -> Option<&'static str> {
        BLOCK_TYPES.iter().find(|t| t.0 == self.kind).map(|t| t.1)
    }
}

impl CrossReferenceFormat {
    pub fn read(uid: u32, obj: &Object) -> Result<Option<CrossReferenceFormat>, Error> {
        let Some(d) = obj.chunk(CHUNK) else {
            return Ok(None);
        };
        parse(obj.encoding, uid, d).map(Some)
    }
}

/// Chunk 0x13593: flag byte and name, u32 character style, u16, u32 block
/// count, blocks: u32 type, 10 bytes, flag byte and custom text.
fn parse(enc: Encoding, uid: u32, data: &[u8]) -> Result<CrossReferenceFormat, Error> {
    let mut c = enc.cursor(data);
    c.u8()?;
    let name = c.string()?;
    let character_style = c.u32()?;
    c.skip(2)?;
    let n = c.u32()?;
    let mut blocks = Vec::new();
    for _ in 0..n {
        let kind = c.u32()?;
        let zero_fields = c.bytes(10)?.iter().all(|&b| b == 0);
        let text = c.name()?;
        blocks.push(BuildingBlock {
            kind,
            zero_fields,
            text,
        });
    }
    Ok(CrossReferenceFormat {
        uid,
        name,
        character_style,
        blocks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn string(s: &str) -> Vec<u8> {
        let mut v = vec![2, 0];
        v.extend((s.len() as u16).to_le_bytes());
        if !s.is_empty() {
            v.extend((0x4000u16 | s.len() as u16).to_le_bytes());
            v.extend(s.as_bytes());
        }
        v
    }

    #[test]
    fn parses_a_format() {
        let mut d = vec![2];
        d.extend(string("Page Number"));
        d.extend(0u32.to_le_bytes());
        d.extend(0u16.to_le_bytes());
        d.extend(2u32.to_le_bytes());
        d.extend(0u32.to_le_bytes());
        d.extend([0; 10]);
        d.push(2);
        d.extend(string("page "));
        d.extend(3u32.to_le_bytes());
        d.extend([0; 10]);
        d.push(1);
        d.extend(string(""));
        let f = parse(crate::object::Encoding::default(), 0xA7, &d).unwrap();
        assert_eq!(f.name, "Page Number");
        assert_eq!(f.blocks.len(), 2);
        assert_eq!(f.blocks[0].text.idml(), "page ");
        assert_eq!(f.blocks[1].type_name(), Some("PageNumberBuildingBlock"));
        assert_eq!(f.blocks[1].text.idml(), "$ID/");
        assert!(f.blocks[1].zero_fields);
    }
}
