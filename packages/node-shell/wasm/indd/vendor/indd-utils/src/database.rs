//! The object database stored in the database pages. See
//! `docs/format/database.md`.
//!
//! Every object has a UID and a byte stream. The streams are found through
//! a B+ tree keyed by (UID, segment). These structures are little-endian
//! in every file, whatever the byte order of the object data.

use std::collections::BTreeMap;

use crate::audit::Recorder;
use crate::container::PAGE_SIZE;
use crate::object::Encoding;
use crate::{Container, Error};

/// Page types, from the u32 at 0xFF4 of every database page.
pub mod page_type {
    pub const ALLOC_DIR: u32 = 2;
    pub const ALLOC_BITMAP: u32 = 3;
    pub const LOGICAL_DIR: u32 = 4;
    pub const LOGICAL_TABLE: u32 = 5;
    pub const TREE_LEAF: u32 = 6;
    pub const TREE_INTERIOR: u32 = 7;
    pub const DATA: u32 = 8;
    pub const SLOTTED: u32 = 9;
}

const TRAILER_TYPE: usize = 0xFF4;
const TABLE_START: usize = 0x80;
const TABLE_ENTRIES: usize = 989;
const SLOT_FOOTER: usize = 0xFDC;

// Fields of the active master page.
const MASTER_LOGICAL_DIR: usize = 0x3A8;
/// Three u32 tree roots (logical pages): objects, classes, unclassed UIDs.
const MASTER_TREE_ROOTS: usize = 0xB7C;
/// Three u64 entry counts, in the same order as the roots.
const MASTER_TREE_COUNTS: usize = 0xB88;

/// Largest segment stored on a data page.
pub const SEGMENT_MAX: u32 = 0xF70;

const SLOT_CONTINUES: u16 = 0x8000;

/// One leaf entry of the object tree: part `segment` (1-based) of object `uid`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Entry {
    pub segment: u32,
    pub uid: u32,
    /// Either a byte count (segment on a data page), or `slot << 16 | count`
    /// (segment in a slotted page).
    pub length: u32,
    /// Physical page for data-page segments, logical page for slotted ones.
    pub page: u32,
}

impl Entry {
    pub fn is_slotted(&self) -> bool {
        self.length >> 16 != 0
    }

    pub fn len(&self) -> usize {
        if self.is_slotted() {
            (self.length & 0xFFFF) as usize
        } else {
            self.length as usize
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

pub struct Database<'a> {
    bytes: &'a [u8],
    logical: BTreeMap<u32, u32>,
    entries: Vec<Entry>,
    /// (UID, class ID), sorted by UID.
    classes: Vec<(u32, u32)>,
    /// UIDs listed in the third tree. They have no class entry.
    unclassed: Vec<u32>,
    /// The encoding of object data.
    encoding: Encoding,
    /// Records reads for `indd audit`.
    recorder: Option<Recorder>,
}

fn corrupt(msg: impl Into<String>) -> Error {
    Error::Corrupt(msg.into())
}

impl<'a> Database<'a> {
    pub fn open(container: &Container<'a>) -> Result<Database<'a>, Error> {
        let master = container.active * PAGE_SIZE;
        let mut db = Database {
            bytes: container.bytes,
            logical: BTreeMap::new(),
            entries: Vec::new(),
            classes: Vec::new(),
            unclassed: Vec::new(),
            encoding: Encoding::of(&container.header),
            recorder: None,
        };
        let directory = db.u32(master + MASTER_LOGICAL_DIR)?;
        let db_pages = container.master().db_pages;
        if directory >= db_pages {
            return Err(Error::NoDatabase {
                db_pages,
                directory,
            });
        }
        db.read_logical_table(directory)?;
        let mut trees: [Vec<Entry>; 3] = Default::default();
        for (i, tree) in trees.iter_mut().enumerate() {
            let root = db.u32(master + MASTER_TREE_ROOTS + 4 * i)?;
            let expected = db.u32(master + MASTER_TREE_COUNTS + 8 * i)? as usize;
            db.walk(root, 0, tree)?;
            if tree.len() != expected {
                return Err(corrupt(format!(
                    "tree {i} has {} entries, master page says {expected}",
                    tree.len()
                )));
            }
        }
        let [entries, classes, unclassed] = trees;
        db.entries = entries;
        db.classes = classes.iter().map(|e| (e.uid, e.length)).collect();
        db.unclassed = unclassed.iter().map(|e| e.uid).collect();
        Ok(db)
    }

    fn u16(&self, offset: usize) -> Result<u16, Error> {
        self.bytes
            .get(offset..)
            .and_then(<[u8]>::first_chunk)
            .map(|&b| u16::from_le_bytes(b))
            .ok_or_else(|| corrupt(format!("read past end of file at {offset:#x}")))
    }

    fn u32(&self, offset: usize) -> Result<u32, Error> {
        self.bytes
            .get(offset..)
            .and_then(<[u8]>::first_chunk)
            .map(|&b| u32::from_le_bytes(b))
            .ok_or_else(|| corrupt(format!("read past end of file at {offset:#x}")))
    }

    pub fn page_type(&self, page: u32) -> Result<u32, Error> {
        self.u32(page as usize * PAGE_SIZE + TRAILER_TYPE)
    }

    fn expect_type(&self, page: u32, expected: u32) -> Result<usize, Error> {
        let actual = self.page_type(page)?;
        if actual != expected {
            return Err(corrupt(format!(
                "page {page} has type {actual}, expected {expected}"
            )));
        }
        Ok(page as usize * PAGE_SIZE)
    }

    fn read_logical_table(&mut self, dir_page: u32) -> Result<(), Error> {
        let dir = self.expect_type(dir_page, page_type::LOGICAL_DIR)?;
        for j in 0..TABLE_ENTRIES {
            let table_page = self.u32(dir + TABLE_START + 4 * j)?;
            if table_page == 0 {
                continue;
            }
            let table = self.expect_type(table_page, page_type::LOGICAL_TABLE)?;
            for i in 0..TABLE_ENTRIES {
                let physical = self.u32(table + TABLE_START + 4 * i)?;
                if physical != 0 {
                    self.logical
                        .insert((j * TABLE_ENTRIES + i) as u32, physical);
                }
            }
        }
        Ok(())
    }

    /// Physical page for a logical page number.
    pub fn physical(&self, logical: u32) -> Result<u32, Error> {
        self.logical
            .get(&logical)
            .copied()
            .ok_or_else(|| corrupt(format!("logical page {logical} is not mapped")))
    }

    fn walk(&self, logical: u32, depth: usize, out: &mut Vec<Entry>) -> Result<(), Error> {
        if depth > 32 {
            return Err(corrupt("object tree is too deep"));
        }
        let page = self.physical(logical)?;
        let base = page as usize * PAGE_SIZE;
        let count = self.u32(base)? as usize;
        match self.page_type(page)? {
            page_type::TREE_LEAF => {
                for i in 0..count {
                    let o = base + 4 + 16 * i;
                    out.push(Entry {
                        segment: self.u32(o)?,
                        uid: self.u32(o + 4)?,
                        length: self.u32(o + 8)?,
                        page: self.u32(o + 12)?,
                    });
                }
            }
            page_type::TREE_INTERIOR => {
                // child, then (segment, uid) key and child, repeated.
                let mut children = vec![self.u32(base + 4)?];
                for i in 1..count {
                    children.push(self.u32(base + 4 + 12 * i)?);
                }
                for child in children {
                    self.walk(child, depth + 1, out)?;
                }
            }
            other => {
                return Err(corrupt(format!("tree page {page} has type {other}")));
            }
        }
        Ok(())
    }

    /// Leaf entries in (UID, segment) order.
    pub fn entries(&self) -> &[Entry] {
        &self.entries
    }

    /// Class ID of object `uid`.
    pub fn class_of(&self, uid: u32) -> Option<u32> {
        self.classes
            .binary_search_by_key(&uid, |&(u, _)| u)
            .ok()
            .map(|i| self.classes[i].1)
    }

    /// All (UID, class ID) pairs, sorted by UID.
    pub fn classes(&self) -> &[(u32, u32)] {
        &self.classes
    }

    /// UIDs that have no class (listed in the third tree).
    pub fn unclassed(&self) -> &[u32] {
        &self.unclassed
    }

    fn read_slotted(
        &self,
        mut logical: u32,
        mut slot: u16,
        mut len: usize,
        out: &mut Vec<u8>,
    ) -> Result<(), Error> {
        // Each continuation holds at least one byte and fewer than `len`,
        // so `len` falls with every record and a cycle of pointers ends.
        loop {
            let base = self.expect_type(self.physical(logical)?, page_type::SLOTTED)?;
            let pointer = (base + SLOT_FOOTER)
                .checked_sub(4 * slot as usize)
                .ok_or_else(|| corrupt(format!("slot {slot} is outside its page")))?;
            let offset = base + self.u32(pointer)? as usize;
            let record_len = self.u16(offset)? as usize;
            let id = self.u16(offset + 2)?;
            if id & !SLOT_CONTINUES != slot {
                return Err(corrupt(format!(
                    "slot {slot} of logical page {logical} holds record {id:#x}"
                )));
            }
            let record = self
                .bytes
                .get(offset + 4..offset + record_len)
                .ok_or_else(|| corrupt(format!("record at {offset:#x} runs past end of file")))?;
            if id & SLOT_CONTINUES == 0 {
                let data = record.get(..len).ok_or_else(|| {
                    corrupt(format!("record at {offset:#x} is shorter than {len}"))
                })?;
                out.extend_from_slice(data);
                return Ok(());
            }
            // A continued record starts with a pointer to the rest:
            // `slot << 16` and a logical page, as in a leaf entry.
            if record.len() < 8 {
                return Err(corrupt(format!(
                    "continued record at {offset:#x} is too short"
                )));
            }
            // `record` starts at `offset + 4` and is at least 8 bytes long.
            let next = self.u32(offset + 4)?;
            let next_page = self.u32(offset + 8)?;

            let here = &record[8..];
            if here.is_empty() || here.len() >= len || next & 0xFFFF != 0 {
                return Err(corrupt(format!("bad continuation at {offset:#x}")));
            }
            out.extend_from_slice(here);
            len -= here.len();
            logical = next_page;
            slot = (next >> 16) as u16;
        }
    }

    fn read_entry(&self, e: &Entry, out: &mut Vec<u8>) -> Result<(), Error> {
        if e.is_slotted() {
            return self.read_slotted(e.page, (e.length >> 16) as u16, e.len(), out);
        }
        if e.length > SEGMENT_MAX {
            return Err(corrupt(format!(
                "segment of {} bytes on a data page",
                e.length
            )));
        }
        let base = self.expect_type(e.page, page_type::DATA)?;
        out.extend_from_slice(&self.bytes[base..base + e.len()]);
        Ok(())
    }

    /// The UIDs of all objects, in ascending order.
    pub fn uids(&self) -> impl Iterator<Item = u32> + '_ {
        self.entries
            .iter()
            .enumerate()
            .filter(|(i, e)| *i == 0 || self.entries[i - 1].uid != e.uid)
            .map(|(_, e)| e.uid)
    }

    /// Object `uid` with its class, or `None` if it has no data.
    pub fn get(&self, uid: u32) -> Result<Option<crate::Object>, Error> {
        Ok(self.object(uid)?.map(|bytes| crate::Object {
            uid,
            class: self.class_of(uid),
            bytes,
            encoding: self.encoding,
            recorder: self.recorder.clone(),
        }))
    }

    /// Record what is read from this database's objects (`indd audit`).
    pub fn set_recorder(&mut self, recorder: Recorder) {
        self.recorder = Some(recorder);
    }

    /// The recorder set with [`Database::set_recorder`].
    pub fn recorder(&self) -> Option<&Recorder> {
        self.recorder.as_ref()
    }

    /// The encoding of object data in this database.
    pub fn encoding(&self) -> Encoding {
        self.encoding
    }

    /// The complete byte stream of object `uid`, or `None` if it doesn't exist.
    pub fn object(&self, uid: u32) -> Result<Option<Vec<u8>>, Error> {
        let start = self.entries.partition_point(|e| e.uid < uid);
        let parts = self.entries[start..].iter().take_while(|e| e.uid == uid);
        let mut out = Vec::new();
        let mut found = false;
        for (i, e) in parts.enumerate() {
            if e.segment as usize != i + 1 {
                return Err(corrupt(format!(
                    "object {uid} is missing segment {}",
                    i + 1
                )));
            }
            self.read_entry(e, &mut out)?;
            found = true;
        }
        Ok(found.then_some(out))
    }
}

/// File images built in code, for tests of the layers above the database.
#[cfg(test)]
pub(crate) mod synthetic {
    use super::*;

    /// A file image with one data page per object, starting at page 1.
    pub fn image(objects: &[(u32, u32, Vec<u8>)]) -> Vec<u8> {
        let mut bytes = vec![0u8; PAGE_SIZE * (objects.len() + 1)];
        for (i, (_, _, data)) in objects.iter().enumerate() {
            assert!(data.len() <= SEGMENT_MAX as usize);
            let base = (i + 1) * PAGE_SIZE;
            bytes[base..base + data.len()].copy_from_slice(data);
            bytes[base + TRAILER_TYPE..base + TRAILER_TYPE + 4]
                .copy_from_slice(&page_type::DATA.to_le_bytes());
        }
        bytes
    }

    /// The database of an image made by [`image`] from the same objects
    /// (UID, class, chunk bytes).
    pub fn database<'a>(bytes: &'a [u8], objects: &[(u32, u32, Vec<u8>)]) -> Database<'a> {
        let mut entries: Vec<Entry> = objects
            .iter()
            .enumerate()
            .map(|(i, (uid, _, data))| Entry {
                segment: 1,
                uid: *uid,
                length: data.len() as u32,
                page: i as u32 + 1,
            })
            .collect();
        entries.sort_by_key(|e| e.uid);
        let mut classes: Vec<(u32, u32)> = objects.iter().map(|o| (o.0, o.1)).collect();
        classes.sort_unstable();
        Database {
            bytes,
            logical: BTreeMap::new(),
            entries,
            classes,
            unclassed: Vec::new(),
            encoding: Encoding::default(),
            recorder: None,
        }
    }

    /// An object of class `class` made of chunks (ID, data), in
    /// `encoding`.
    pub fn object(
        uid: u32,
        class: u32,
        chunks: &[(u32, Vec<u8>)],
        encoding: Encoding,
    ) -> crate::Object {
        let mut bytes = Vec::new();
        for (id, data) in chunks {
            bytes.extend_from_slice(&encoding.u32_bytes(*id));
            bytes.extend_from_slice(&encoding.u32_bytes(data.len() as u32));
            bytes.extend_from_slice(data);
        }
        crate::Object {
            uid,
            class: Some(class),
            bytes,
            encoding,
            recorder: None,
        }
    }

    /// A flag byte and an in-object string of single-byte characters, as
    /// stored in `encoding` (in big-endian data the string tag comes
    /// before the flag; `docs/format/big-endian.md`).
    pub fn flagged_string(encoding: Encoding, flag: u8, s: &str) -> Vec<u8> {
        let tag = encoding.string_tag();
        let mut out = if encoding.big_endian() {
            vec![tag, flag, 0]
        } else {
            vec![flag, tag, 0]
        };
        out.extend_from_slice(&encoding.u16_bytes(s.len() as u16));
        if !s.is_empty() {
            out.extend_from_slice(&encoding.u16_bytes(0x4000 | s.len() as u16));
            out.extend_from_slice(s.as_bytes());
        }
        out
    }

    /// Object bytes made of chunks (ID, data).
    pub fn chunks(chunks: &[(u32, Vec<u8>)]) -> Vec<u8> {
        let mut out = Vec::new();
        for (id, data) in chunks {
            out.extend_from_slice(&id.to_le_bytes());
            out.extend_from_slice(&(data.len() as u32).to_le_bytes());
            out.extend_from_slice(data);
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entry_lengths() {
        let data = Entry {
            segment: 1,
            uid: 5,
            length: 0xF70,
            page: 214,
        };
        assert!(!data.is_slotted());
        assert_eq!(data.len(), 0xF70);
        let slotted = Entry {
            segment: 1,
            uid: 2,
            length: 0x0002_0010,
            page: 4,
        };
        assert!(slotted.is_slotted());
        assert_eq!(slotted.len(), 0x10);
    }

    /// A database whose logical page 7 is physical page 1, a slotted page
    /// with one record in slot 1 at offset 0x10.
    fn slotted(record: &[u8]) -> Vec<u8> {
        let mut bytes = vec![0u8; PAGE_SIZE * 2];
        let base = PAGE_SIZE;
        bytes[base + TRAILER_TYPE..base + TRAILER_TYPE + 4]
            .copy_from_slice(&page_type::SLOTTED.to_le_bytes());
        bytes[base + SLOT_FOOTER - 4..base + SLOT_FOOTER].copy_from_slice(&0x10u32.to_le_bytes());
        bytes[base + 0x10..base + 0x10 + record.len()].copy_from_slice(record);
        bytes
    }

    fn slotted_db(bytes: &[u8]) -> Database<'_> {
        Database {
            bytes,
            logical: BTreeMap::from([(7, 1)]),
            entries: Vec::new(),
            classes: Vec::new(),
            unclassed: Vec::new(),
            encoding: Encoding::default(),
            recorder: None,
        }
    }

    /// A continued record whose pointer leads back to itself.
    fn cyclic_record(fragment: &[u8]) -> Vec<u8> {
        let mut r = Vec::new();
        r.extend_from_slice(&((12 + fragment.len()) as u16).to_le_bytes());
        r.extend_from_slice(&(1 | SLOT_CONTINUES).to_le_bytes());
        r.extend_from_slice(&(1u32 << 16).to_le_bytes());
        r.extend_from_slice(&7u32.to_le_bytes());
        r.extend_from_slice(fragment);
        r
    }

    #[test]
    fn cyclic_continuations_end_with_an_error() {
        for fragment in [&[][..], &[1][..]] {
            let bytes = slotted(&cyclic_record(fragment));
            let db = slotted_db(&bytes);
            let mut out = Vec::new();
            assert!(db.read_slotted(7, 1, 100, &mut out).is_err());
            assert!(out.len() < 100);
        }
    }

    #[test]
    fn large_slot_numbers_are_an_error() {
        let bytes = slotted(&cyclic_record(&[1]));
        let db = slotted_db(&bytes);
        assert!(db.read_slotted(7, 0xFFFF, 4, &mut Vec::new()).is_err());
    }

    #[test]
    fn synthetic_database_reads_objects() {
        let objects = [(5, 9, synthetic::chunks(&[(0x10, vec![1, 2, 3])]))];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        assert_eq!(db.class_of(5), Some(9));
        let o = db.get(5).unwrap().unwrap();
        assert_eq!(o.chunk(0x10), Some(&[1u8, 2, 3][..]));
    }
}
