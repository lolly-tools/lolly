//! The page and contiguous-object layout of an INDD file. See
//! `docs/format/container.md`.

use crate::{ByteOrder, Error, Header};

/// INDD files are made of pages of this size.
pub const PAGE_SIZE: usize = 4096;

/// Starts every contiguous object header.
pub const CONTIG_HEADER_GUID: [u8; 16] = [
    0xDE, 0x39, 0x39, 0x79, 0x51, 0x88, 0x4B, 0x6C, 0x8E, 0x63, 0xEE, 0xF8, 0xAE, 0xE0, 0xDD, 0x38,
];

/// Starts every contiguous object trailer.
pub const CONTIG_TRAILER_GUID: [u8; 16] = [
    0xFD, 0xCE, 0xDB, 0x70, 0xF7, 0x86, 0x4B, 0x4F, 0xA4, 0xD3, 0xC7, 0x28, 0xB3, 0x41, 0x71, 0x06,
];

const MARKER_LEN: usize = 32;
const SEQUENCE_OFFSET: usize = 0x108;
const DB_PAGES_OFFSET: usize = 0x118;
const XMP_START: &[u8] = b"<?xpacket begin=";

/// The little-endian u32 at `offset`. The callers check the length first;
/// like slice indexing, this panics if `bytes` is too short.
fn le_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(std::array::from_fn(|i| bytes[offset + i]))
}

/// The little-endian u64 at `offset`; see [`le_u32`].
fn le_u64(bytes: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(std::array::from_fn(|i| bytes[offset + i]))
}

/// One of the two master pages at the start of the file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MasterPage {
    /// Generation number. The master page with the higher value is active.
    pub sequence: u64,
    /// Number of database pages, including the two master pages. The
    /// contiguous objects start right after them.
    pub db_pages: u32,
}

impl MasterPage {
    fn parse(page: &[u8]) -> MasterPage {
        MasterPage {
            sequence: le_u64(page, SEQUENCE_OFFSET),
            db_pages: le_u32(page, DB_PAGES_OFFSET),
        }
    }
}

/// A copy of one database object, stored as a contiguous byte stream after
/// the database pages.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ContigObject<'a> {
    /// File offset of the object's header marker.
    pub offset: usize,
    pub uid: u32,
    pub class_id: u32,
    pub data: &'a [u8],
}

#[derive(Debug, Clone)]
pub struct Container<'a> {
    pub(crate) bytes: &'a [u8],
    pub header: Header,
    /// Index (0 or 1) of the active master page.
    pub active: usize,
    pub masters: [MasterPage; 2],
}

impl<'a> Container<'a> {
    pub fn parse(bytes: &'a [u8]) -> Result<Container<'a>, Error> {
        // The signature first, so that a short file of another kind is
        // reported as not an INDD file.
        let first = Header::parse(&bytes[..bytes.len().min(PAGE_SIZE)])?;
        if bytes.len() < 2 * PAGE_SIZE {
            return Err(Error::Truncated {
                needed: 2 * PAGE_SIZE,
                got: bytes.len(),
            });
        }
        Header::parse(&bytes[PAGE_SIZE..2 * PAGE_SIZE])?;
        let masters = [
            MasterPage::parse(&bytes[..PAGE_SIZE]),
            MasterPage::parse(&bytes[PAGE_SIZE..2 * PAGE_SIZE]),
        ];
        let active = usize::from(masters[1].sequence > masters[0].sequence);
        // Every complete file holds at least its database pages
        // (container.md).
        let needed = masters[active].db_pages as usize * PAGE_SIZE;
        if bytes.len() < needed {
            return Err(Error::Truncated {
                needed,
                got: bytes.len(),
            });
        }
        let header = if active == 0 {
            first
        } else {
            Header::parse(&bytes[PAGE_SIZE..2 * PAGE_SIZE])?
        };
        Ok(Container {
            bytes,
            header,
            active,
            masters,
        })
    }

    pub fn database(&self) -> Result<crate::Database<'a>, Error> {
        crate::Database::open(self)
    }

    pub fn master(&self) -> MasterPage {
        self.masters[self.active]
    }

    /// File offset where the contiguous objects start.
    pub fn contig_start(&self) -> usize {
        self.master().db_pages as usize * PAGE_SIZE
    }

    pub fn contig_objects(&self) -> ContigObjects<'a> {
        ContigObjects {
            bytes: self.bytes,
            pos: self.contig_start(),
            done: false,
        }
    }

    /// The XMP packet, from `<?xpacket begin=` to the end of the packet.
    pub fn xmp(&self) -> Result<Option<&'a [u8]>, Error> {
        for obj in self.contig_objects() {
            if let Some(packet) = xmp_packet(obj?.data, self.header.byte_order) {
                return Ok(Some(packet));
            }
        }
        Ok(None)
    }
}

/// An XMP object is a u32 packet length followed by the packet. Some files
/// store the length in the other byte order, so both are accepted. The
/// packet can be shorter than the object: the rest is left over from an
/// earlier, longer packet (`docs/format/container.md`).
fn xmp_packet(data: &[u8], order: ByteOrder) -> Option<&[u8]> {
    if data.len() < 4 + XMP_START.len() {
        return None;
    }
    let room = data.len() - 4;
    let len = order.read_u32(data, 0) as usize;
    let swapped = order.read_u32(data, 0).swap_bytes() as usize;
    let len = [len, swapped]
        .into_iter()
        .find(|&n| n == room)
        .or_else(|| [len, swapped].into_iter().find(|&n| n <= room))?;
    let packet = &data[4..4 + len];
    packet.starts_with(XMP_START).then_some(packet)
}

pub struct ContigObjects<'a> {
    bytes: &'a [u8],
    pos: usize,
    done: bool,
}

impl<'a> Iterator for ContigObjects<'a> {
    type Item = Result<ContigObject<'a>, Error>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }
        let b = self.bytes;
        let start = self.pos;
        // The objects end at the first position without a header marker.
        // What follows is padding, sometimes with stale bytes from earlier saves.
        if start + MARKER_LEN > b.len() || b[start..start + 16] != CONTIG_HEADER_GUID {
            self.done = true;
            return None;
        }
        let uid = le_u32(b, start + 16);
        let class_id = le_u32(b, start + 20);
        let len = le_u32(b, start + 24) as usize;
        let data_start = start + MARKER_LEN;
        let trailer = data_start + len;
        let valid = trailer + MARKER_LEN <= b.len()
            && b[trailer..trailer + 16] == CONTIG_TRAILER_GUID
            && le_u32(b, trailer + 16) == uid
            && le_u32(b, trailer + 24) as usize == len;
        if !valid {
            self.done = true;
            return Some(Err(Error::BadContigObject { offset: start }));
        }
        self.pos = trailer + MARKER_LEN;
        Some(Ok(ContigObject {
            offset: start,
            uid,
            class_id,
            data: &b[data_start..trailer],
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::header::SIGNATURE;

    fn master(sequence: u64, db_pages: u32) -> Vec<u8> {
        let mut p = vec![0u8; PAGE_SIZE];
        p[..16].copy_from_slice(&SIGNATURE);
        p[0x10..0x18].copy_from_slice(b"DOCUMENT");
        p[0x18] = 1;
        p[0x1D] = 20;
        p[SEQUENCE_OFFSET..SEQUENCE_OFFSET + 8].copy_from_slice(&sequence.to_le_bytes());
        p[DB_PAGES_OFFSET..DB_PAGES_OFFSET + 4].copy_from_slice(&db_pages.to_le_bytes());
        p
    }

    fn contig(uid: u32, data: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        for guid in [CONTIG_HEADER_GUID, CONTIG_TRAILER_GUID] {
            if guid == CONTIG_TRAILER_GUID {
                out.extend_from_slice(data);
            }
            out.extend_from_slice(&guid);
            out.extend_from_slice(&uid.to_le_bytes());
            out.extend_from_slice(&0xC000_0000u32.to_le_bytes());
            out.extend_from_slice(&(data.len() as u32).to_le_bytes());
            out.extend_from_slice(&u32::MAX.to_le_bytes());
        }
        out
    }

    fn file(seq: [u64; 2], objects: &[Vec<u8>]) -> Vec<u8> {
        let mut f = master(seq[0], 3);
        f.extend(master(seq[1], 3));
        f.extend(vec![0u8; PAGE_SIZE]);
        for o in objects {
            f.extend_from_slice(o);
        }
        f.resize(f.len().next_multiple_of(PAGE_SIZE), 0);
        f
    }

    fn xmp_object(packet: &[u8]) -> Vec<u8> {
        let mut data = (packet.len() as u32).to_le_bytes().to_vec();
        data.extend_from_slice(packet);
        contig(7, &data)
    }

    #[test]
    fn reports_missing_database_pages_as_truncated() {
        let mut f = master(1, 129);
        f.extend(master(0, 129));
        f.extend(vec![0u8; PAGE_SIZE]);
        assert!(matches!(
            Container::parse(&f),
            Err(Error::Truncated { needed, got }) if needed == 129 * PAGE_SIZE && got == 3 * PAGE_SIZE
        ));
    }

    #[test]
    fn reports_short_file_of_another_kind_as_not_indd() {
        assert!(matches!(
            Container::parse(b"%PDF-1.5 a short file of another kind"),
            Err(Error::NotIndd)
        ));
    }

    #[test]
    fn picks_master_with_higher_sequence() {
        let f = file([4, 5], &[]);
        assert_eq!(Container::parse(&f).unwrap().active, 1);
        let f = file([9, 8], &[]);
        assert_eq!(Container::parse(&f).unwrap().active, 0);
    }

    #[test]
    fn finds_xmp_after_other_objects() {
        let packet = b"<?xpacket begin=\"\" id=\"x\"?><x/>";
        let f = file([1, 2], &[contig(1, b"other"), xmp_object(packet)]);
        let c = Container::parse(&f).unwrap();
        assert_eq!(c.contig_objects().count(), 2);
        assert_eq!(c.xmp().unwrap(), Some(&packet[..]));
    }

    #[test]
    fn xmp_packet_ignores_leftover_bytes() {
        let packet = b"<?xpacket begin=\"\" id=\"x\"?><x/>";
        let mut data = (packet.len() as u32).to_le_bytes().to_vec();
        data.extend_from_slice(packet);
        data.extend_from_slice(b"stale tail of an older packet");
        let f = file([1, 2], &[contig(7, &data)]);
        let c = Container::parse(&f).unwrap();
        assert_eq!(c.xmp().unwrap(), Some(&packet[..]));
    }

    #[test]
    fn stops_at_padding() {
        let f = file([1, 2], &[contig(1, b"abc")]);
        let objs: Vec<_> = Container::parse(&f).unwrap().contig_objects().collect();
        assert_eq!(objs.len(), 1);
        assert_eq!(objs[0].as_ref().unwrap().data, b"abc");
    }

    #[test]
    fn reports_bad_trailer() {
        let mut obj = contig(1, b"abc");
        obj[32 + 3] ^= 0xFF; // corrupt trailer GUID
        let f = file([1, 2], &[obj]);
        let c = Container::parse(&f).unwrap();
        let first = c.contig_objects().next().unwrap();
        assert!(matches!(first, Err(Error::BadContigObject { offset }) if offset == 3 * PAGE_SIZE));
    }
}
