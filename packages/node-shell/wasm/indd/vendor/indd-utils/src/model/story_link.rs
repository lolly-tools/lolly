//! Links, style mappings and import options of linked stories and of
//! stories placed from Word or Excel files.
//!
//! Evidence: `docs/format/objects.md`, story links and placed text.

use super::*;

/// A style mapping (chunk 0x21D30): names as stored and the rule code.
#[derive(Debug, Clone, PartialEq)]
pub struct StyleMapping {
    pub source: String,
    pub destination: String,
    /// 0 `StyleMappingRule`, 1 `GroupMappingRule`, 2
    /// `StyleToGroupMappingRule`.
    pub rule: u32,
}

/// The style mappings of a story or of the document (chunk 0x21D30).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StyleMappings {
    pub paragraph: Vec<StyleMapping>,
    pub character: Vec<StyleMapping>,
    /// Entries in lists 3 to 5, which no sample fills.
    pub other: usize,
}

/// Import options of placed text (story chunk 0x12202).
#[derive(Debug, Clone, PartialEq)]
pub enum ImportOptions {
    /// Chunk 0x12210 of the options object.
    Word([u32; 19]),
    Excel(ExcelOptions),
}

/// Excel import options (chunk 0x12213 of the options object).
#[derive(Debug, Clone, PartialEq)]
pub struct ExcelOptions {
    /// u32 at 16: 0 formatted, 1 unformatted table.
    pub table: u32,
    /// The sheet name, range and the string after them, as IDML writes
    /// them.
    pub sheet: String,
    pub range: String,
    pub view: String,
}

/// The settings of a linked or placed story (`StoryChunks`).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct StoryLinkChunks {
    /// The story's link (chunk 0x8CBC).
    pub link: Option<Link>,
    /// Chunk 0x21D12: `ApplyStyleMappings`.
    pub apply_style_mappings: Option<bool>,
    pub mappings: StyleMappings,
    pub import: Option<ImportOptions>,
    /// Chunk 0x12216: paragraph and character style names.
    pub mapping_prefs: Option<(Vec<String>, Vec<String>)>,
}

/// Smallest stored size of a style mapping: two kind bytes, two empty
/// strings, the rule.
const MAPPING_MIN: usize = 1 + 4 + 1 + 4 + 4;

/// Chunk 0x21D30: five lists of mappings, each bounded by the data left.
pub(super) fn style_mappings(c: &mut Cursor) -> Result<StyleMappings, Error> {
    let mut out = StyleMappings::default();
    for list in 0..5 {
        let n = c.u32()? as usize;
        if n > c.remaining() / MAPPING_MIN {
            return Err(Error::Corrupt(format!("{n} style mappings")));
        }
        for _ in 0..n {
            c.flag()?;
            let source = c.string()?;
            c.flag()?;
            let destination = c.string()?;
            let rule = c.u32()?;
            let m = StyleMapping {
                source,
                destination,
                rule,
            };
            match list {
                0 => out.paragraph.push(m),
                1 => out.character.push(m),
                _ => out.other += 1,
            }
        }
    }
    Ok(out)
}

impl Reader<'_> {
    /// The link of a story, its options, style mappings and import
    /// options. A part that cannot be read is left out with a warning.
    pub(super) fn story_link_chunks(&self, uid: u32) -> Result<StoryLinkChunks, Error> {
        let mut out = StoryLinkChunks::default();
        if let Some(d) = self.chunk(uid, chunk::GRAPHIC_LINK)?
            && d.len() >= 12
        {
            let mut c = self.cursor(&d[4..]);
            if c.u32()? >= 1 {
                let link = c.u32()?;
                out.link = self.link(link)?.map(|(l, _)| l);
                if out.link.is_none() {
                    self.warn(format!("story {uid}: link {link} cannot be read; left out"));
                }
            }
        }
        out.apply_style_mappings = self
            .chunk(uid, chunk::STORY_LINK_OPTIONS)?
            .and_then(|d| self.enc().u32_at(&d, 6))
            .map(|v| v != 0);
        if let Some(d) = self.chunk(uid, chunk::STYLE_MAPPINGS)? {
            match style_mappings(&mut self.cursor(&d)) {
                Ok(m) => out.mappings = m,
                Err(e) => self.warn(format!("story {uid}: style mappings left out: {e}")),
            }
        }
        out.import = self.import_options(uid).unwrap_or_else(|e| {
            self.warn(format!("story {uid}: import options left out: {e}"));
            None
        });
        if let Some(d) = self.chunk(uid, chunk::STYLE_MAPPING_PREFS)? {
            match self.mapping_prefs(&d) {
                Ok(p) => out.mapping_prefs = Some(p),
                Err(e) => self.warn(format!(
                    "story {uid}: style mapping preferences left out: {e}"
                )),
            }
        }
        Ok(out)
    }

    /// Chunk 0x12216: u32 p, u32 c, then 2p and 2c names.
    fn mapping_prefs(&self, d: &[u8]) -> Result<(Vec<String>, Vec<String>), Error> {
        let mut c = self.cursor(d);
        let p = c.u32()? as usize;
        let n = c.u32()? as usize;
        // A name takes at least a flag byte and 4 bytes of string header.
        if p.saturating_add(n) > c.remaining() / 10 {
            return Err(Error::Corrupt(format!("{p} and {n} style mappings")));
        }
        let mut names = |count: usize| -> Result<Vec<String>, Error> {
            (0..2 * count).map(|_| Ok(c.name()?.name)).collect()
        };
        let paragraph = names(p)?;
        let character = names(n)?;
        Ok((paragraph, character))
    }

    /// The import options object that story chunk 0x12202 names.
    fn import_options(&self, uid: u32) -> Result<Option<ImportOptions>, Error> {
        let Some(options) = self
            .chunk(uid, chunk::STORY_IMPORT_OPTIONS)?
            .and_then(|d| self.enc().u32_at(&d, 0))
            .filter(|&u| u != 0)
        else {
            return Ok(None);
        };
        match self.class(options) {
            Some(class::WORD_IMPORT_OPTIONS) => {
                let Some(d) = self.chunk(options, chunk::WORD_IMPORT_OPTIONS)? else {
                    return Ok(None);
                };
                let mut c = self.cursor(&d);
                let mut s = [0u32; 19];
                for v in &mut s {
                    *v = c.u32()?;
                }
                Ok(Some(ImportOptions::Word(s)))
            }
            Some(class::EXCEL_IMPORT_OPTIONS) => {
                let Some(d) = self.chunk(options, chunk::EXCEL_IMPORT_OPTIONS)? else {
                    return Ok(None);
                };
                let mut c = self.cursor(&d);
                c.skip(16)?;
                let table = c.u32()?;
                c.skip(4)?;
                let sheet = c.name()?.idml();
                let range = c.name()?.idml();
                let view = c.name()?.idml();
                Ok(Some(ImportOptions::Excel(ExcelOptions {
                    table,
                    sheet,
                    range,
                    view,
                })))
            }
            _ => Ok(None),
        }
    }

    /// Document chunk 0x21D06: link source ID by story or page item UID.
    pub(super) fn link_source_ids(&self) -> Result<BTreeMap<u32, u32>, Error> {
        let mut out = BTreeMap::new();
        let Some(d) = self.chunk(DOC, chunk::LINK_SOURCE_IDS)? else {
            return Ok(out);
        };
        let mut c = self.cursor(&d);
        c.skip(4)?;
        let n = (c.u32()? as usize).min(c.remaining() / 8);
        for _ in 0..n {
            let id = c.u32()?;
            out.insert(c.u32()?, id);
        }
        Ok(out)
    }

    /// Chunk 0x21D30 of the preferences object.
    pub(super) fn document_style_mappings(&self) -> StyleMappings {
        let Some(&(uid, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return StyleMappings::default();
        };
        match self.chunk(uid, chunk::STYLE_MAPPINGS) {
            Ok(Some(d)) => style_mappings(&mut self.cursor(&d)).unwrap_or_else(|e| {
                self.warn(format!("document style mappings left out: {e}"));
                StyleMappings::default()
            }),
            _ => StyleMappings::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::header::ByteOrder;

    fn enc() -> Encoding {
        Encoding::new(
            ByteOrder::Little,
            Version {
                major: 10,
                minor: 1,
            },
        )
    }

    fn string(out: &mut Vec<u8>, kind: u8, s: &str) {
        out.extend_from_slice(&[kind, 2, 0]);
        let units: Vec<u16> = s.encode_utf16().collect();
        out.extend_from_slice(&(units.len() as u16).to_le_bytes());
        if !units.is_empty() {
            out.push(units.len() as u8);
            out.push(0x40);
            out.extend(units.iter().map(|&u| u as u8));
        }
    }

    #[test]
    fn reads_paragraph_and_character_mappings() {
        let mut d = Vec::new();
        d.extend_from_slice(&1u32.to_le_bytes());
        string(&mut d, 2, "A:*");
        string(&mut d, 2, "B:*");
        d.extend_from_slice(&1u32.to_le_bytes());
        d.extend_from_slice(&1u32.to_le_bytes());
        string(&mut d, 3, "x");
        string(&mut d, 2, "y");
        d.extend_from_slice(&0u32.to_le_bytes());
        d.extend_from_slice(&[0; 12]);
        let m = style_mappings(&mut enc().cursor(&d)).unwrap();
        assert_eq!(m.paragraph.len(), 1);
        assert_eq!(m.paragraph[0].source, "A:*");
        assert_eq!(m.paragraph[0].rule, 1);
        assert_eq!(m.character[0].source, "x");
        assert_eq!(m.character[0].destination, "y");
        assert_eq!(m.other, 0);
        // A count larger than the data is an error, not a long loop.
        let mut d = u32::MAX.to_le_bytes().to_vec();
        d.extend_from_slice(&[0; 20]);
        assert!(style_mappings(&mut enc().cursor(&d)).is_err());
    }
}
