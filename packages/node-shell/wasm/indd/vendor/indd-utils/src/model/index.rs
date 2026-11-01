//! The index: one object of class 0x13004, its sections (class 0x13005)
//! and the topic records inside them. See `docs/format/index.md`.

use super::Reader;
use crate::Error;
use crate::object::Cursor;

/// Index object, section and page reference classes.
pub mod class {
    pub const INDEX: u32 = 0x13004;
    pub const SECTION: u32 = 0x13005;
    pub const PAGE_REFERENCE: u32 = 0x13006;
}

mod chunk {
    /// Index: its sections.
    pub const SECTIONS: u32 = 0x13005;
    /// Section: its topic records.
    pub const TOPICS: u32 = 0x13007;
}

/// The document's index.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Index {
    pub uid: u32,
    /// The level-1 topics, section by section.
    pub topics: Vec<Topic>,
}

/// An index topic.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Topic {
    pub name: String,
    pub sort_order: String,
    /// The page references (class 0x13006) of this topic.
    pub refs: Vec<u32>,
    pub children: Vec<Topic>,
}

/// A u32 length in UTF-16 units, then text segments.
fn counted(c: &mut Cursor) -> Result<String, Error> {
    let n = c.u32()? as usize;
    if n == 0 {
        Ok(String::new())
    } else {
        c.segments(n)
    }
}

/// The topic records of a section (chunk 0x13007), as a tree. The
/// records are depth first; each has its level (1 for a top topic).
fn read_topics(c: &mut Cursor) -> Result<Vec<Topic>, Error> {
    let top = c.u32()? as usize;
    c.u16()?;
    let n = c.u32()? as usize;
    // The open topics, one per level.
    let mut stack: Vec<Topic> = Vec::new();
    let mut out = Vec::new();
    // Close open topics until `depth` remain.
    fn close(stack: &mut Vec<Topic>, out: &mut Vec<Topic>, depth: usize) {
        while stack.len() > depth {
            let Some(t) = stack.pop() else { return };
            match stack.last_mut() {
                Some(p) => p.children.push(t),
                None => out.push(t),
            }
        }
    }
    for _ in 0..n {
        c.u16()?;
        let level = c.u16()? as usize;
        if level == 0 || level > stack.len() + 1 {
            return Err(Error::Corrupt(format!("index topic of level {level}")));
        }
        c.u32()?;
        let name = counted(c)?;
        let sort_order = counted(c)?;
        let m = c.u32()? as usize;
        if m > c.remaining() / 4 {
            return Err(Error::Corrupt(format!("{m} page references")));
        }
        let refs = (0..m).map(|_| c.u32()).collect::<Result<_, _>>()?;
        // The cross references of the topic (class 0x13007), then a u32.
        let k = c.u32()? as usize;
        if k > c.remaining() / 4 {
            return Err(Error::Corrupt(format!("{k} cross references")));
        }
        c.skip(4 * k + 4)?;
        close(&mut stack, &mut out, level - 1);
        stack.push(Topic {
            name,
            sort_order,
            refs,
            children: Vec::new(),
        });
    }
    close(&mut stack, &mut out, 0);
    if out.len() != top || c.remaining() != 0 {
        return Err(Error::Corrupt(format!(
            "{} top topics, {top} expected, {} bytes left",
            out.len(),
            c.remaining()
        )));
    }
    Ok(out)
}

impl Reader<'_> {
    /// The document's index, if it has one. A section whose topics cannot
    /// be read is left out with a warning.
    pub(super) fn index(&self) -> Result<Option<Index>, Error> {
        if self.enc().big_endian() {
            return Ok(None);
        }
        let mut found = self
            .db
            .classes()
            .iter()
            .filter(|(_, c)| *c == class::INDEX)
            .map(|&(u, _)| u);
        let Some(uid) = found.next() else {
            return Ok(None);
        };
        if found.next().is_some() {
            self.warn("more than one index; only the first is written".into());
        }
        let Some(d) = self.chunk(uid, chunk::SECTIONS)? else {
            return Ok(Some(Index {
                uid,
                topics: Vec::new(),
            }));
        };
        let mut c = self.cursor(&d);
        c.u16()?;
        let n = c.u16()? as usize;
        let sections: Vec<u32> = (0..n).map(|_| c.u32()).collect::<Result<_, _>>()?;
        let mut topics = Vec::new();
        for s in sections {
            if self.class(s) != Some(class::SECTION) {
                continue;
            }
            if let Some(d) = self.chunk(s, chunk::TOPICS)? {
                match read_topics(&mut self.cursor(&d)) {
                    Ok(t) => topics.extend(t),
                    Err(e) => self.warn(format!("index section {s} left out: {e}")),
                }
            }
        }
        Ok(Some(Index { uid, topics }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::object::Encoding;

    fn record(d: &mut Vec<u8>, level: u16, subs: u32, name: &str, refs: &[u32]) {
        d.extend([0, 1]);
        d.extend(level.to_le_bytes());
        d.extend(subs.to_le_bytes());
        d.extend((name.len() as u32).to_le_bytes());
        d.extend((0x4000 | name.len() as u16).to_le_bytes());
        d.extend(name.as_bytes());
        d.extend(0u32.to_le_bytes());
        d.extend((refs.len() as u32).to_le_bytes());
        for r in refs {
            d.extend(r.to_le_bytes());
        }
        d.extend([0; 8]);
    }

    #[test]
    fn builds_the_topic_tree() {
        let mut d = Vec::new();
        d.extend(2u32.to_le_bytes());
        d.extend(0u16.to_le_bytes());
        d.extend(4u32.to_le_bytes());
        record(&mut d, 1, 1, "a", &[7]);
        record(&mut d, 2, 1, "b", &[]);
        record(&mut d, 3, 0, "c", &[8, 9]);
        record(&mut d, 1, 0, "d", &[]);
        let enc = Encoding::default();
        let t = read_topics(&mut enc.cursor(&d)).unwrap();
        assert_eq!(t.len(), 2);
        assert_eq!((t[0].name.as_str(), &t[0].refs[..]), ("a", &[7][..]));
        assert_eq!(t[0].children[0].children[0].refs, vec![8, 9]);
        assert_eq!(t[1].name, "d");
        // A topic with a cross reference: u32 1, its UID, u32 0.
        let mut x = Vec::new();
        x.extend(1u32.to_le_bytes());
        x.extend(0u16.to_le_bytes());
        x.extend(1u32.to_le_bytes());
        record(&mut x, 1, 0, "s", &[]);
        x.truncate(x.len() - 8);
        x.extend(1u32.to_le_bytes());
        x.extend(0xC6Du32.to_le_bytes());
        x.extend(0u32.to_le_bytes());
        let t = read_topics(&mut enc.cursor(&x)).unwrap();
        assert_eq!(t[0].name, "s");
        // A level that skips one is an error.
        let mut bad = d[..10].to_vec();
        bad[6..10].copy_from_slice(&1u32.to_le_bytes());
        record(&mut bad, 2, 0, "x", &[]);
        assert!(read_topics(&mut enc.cursor(&bad)).is_err());
    }
}
