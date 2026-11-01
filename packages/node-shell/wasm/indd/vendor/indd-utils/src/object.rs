//! The contents of database objects. See `docs/format/objects.md`.
//!
//! Most objects are a sequence of chunks: u32 chunk ID, u32 length, data.
//! Some objects (embedded files, the XMP packet) are plain byte streams.

use crate::audit::Recorder;
use crate::{ByteOrder, Error, Header, Version};

/// How the object data of one file is encoded: its byte order
/// (`docs/format/objects.md`) and the first byte of its in-object strings.
/// Every decoder of object data takes it from the [`Object`] or [`Cursor`]
/// it reads, so files of different encodings can be read at the same time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Encoding {
    big_endian: bool,
    string_tag: u8,
}

impl Default for Encoding {
    /// Little-endian, from InDesign 3.0 or later.
    fn default() -> Encoding {
        Encoding {
            big_endian: false,
            string_tag: 2,
        }
    }
}

macro_rules! decoders {
    ($($name:ident, $at:ident, $enc:ident: $t:ty;)*) => {$(
        /// Decode object data in this byte order.
        pub fn $name(self, b: [u8; size_of::<$t>()]) -> $t {
            if self.big_endian { <$t>::from_be_bytes(b) } else { <$t>::from_le_bytes(b) }
        }
        /// Decode the value at `offset`, if `b` is long enough.
        pub fn $at(self, b: &[u8], offset: usize) -> Option<$t> {
            let end = offset.checked_add(size_of::<$t>())?;
            Some(self.$name(b.get(offset..end)?.try_into().ok()?))
        }
        /// Encode a value as object data in this byte order.
        pub fn $enc(self, v: $t) -> [u8; size_of::<$t>()] {
            if self.big_endian { v.to_be_bytes() } else { v.to_le_bytes() }
        }
    )*};
}

impl Encoding {
    /// The encoding of a file with this byte order and version. In-object
    /// strings start with 1 in files from InDesign 2.0, with 2 in later
    /// files (`docs/format/objects.md`).
    pub fn new(order: ByteOrder, version: Version) -> Encoding {
        Encoding {
            big_endian: order == ByteOrder::Big,
            string_tag: if version.major <= 2 { 1 } else { 2 },
        }
    }

    /// The encoding of the file with this header.
    pub fn of(header: &Header) -> Encoding {
        Encoding::new(header.byte_order, header.version)
    }

    pub fn big_endian(self) -> bool {
        self.big_endian
    }

    /// The first byte of an in-object string.
    pub fn string_tag(self) -> u8 {
        self.string_tag
    }

    /// A cursor over object data in this encoding.
    pub fn cursor(self, data: &[u8]) -> Cursor<'_> {
        Cursor {
            data,
            pos: 0,
            tag_read: false,
            enc: self,
        }
    }

    decoders! {
        u16_from, u16_at, u16_bytes: u16;
        i16_from, i16_at, i16_bytes: i16;
        u32_from, u32_at, u32_bytes: u32;
        i32_from, i32_at, i32_bytes: i32;
        f64_from, f64_at, f64_bytes: f64;
    }

    /// Split an object's bytes into chunks. `None` if the bytes are not a
    /// chunk sequence.
    pub fn chunks(self, bytes: &[u8]) -> Option<Vec<Chunk<'_>>> {
        let mut out = Vec::new();
        let mut pos = 0;
        while pos < bytes.len() {
            let head = bytes.get(pos..pos + 8)?;
            let id = self.u32_at(head, 0)?;
            let len = self.u32_at(head, 4)? as usize;
            let data = bytes.get(pos + 8..(pos + 8).checked_add(len)?)?;
            out.push(Chunk { id, data });
            pos += 8 + len;
        }
        Some(out)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Chunk<'a> {
    pub id: u32,
    pub data: &'a [u8],
}

/// A decoded object: its UID, class and chunks.
#[derive(Debug, Clone)]
pub struct Object {
    pub uid: u32,
    pub class: Option<u32>,
    pub bytes: Vec<u8>,
    /// The encoding of the file the object comes from.
    pub encoding: Encoding,
    /// The recorder of the database the object comes from.
    pub recorder: Option<Recorder>,
}

impl Object {
    pub fn chunks(&self) -> Option<Vec<Chunk<'_>>> {
        self.encoding.chunks(&self.bytes)
    }

    /// A cursor over `data` (normally a chunk of this object) in the
    /// object's encoding.
    pub fn cursor<'d>(&self, data: &'d [u8]) -> Cursor<'d> {
        self.encoding.cursor(data)
    }

    /// Data of the first chunk with this ID.
    pub fn chunk(&self, id: u32) -> Option<&[u8]> {
        if let Some(r) = &self.recorder {
            r.chunk_read(self.uid, id);
        }
        self.chunks()?
            .into_iter()
            .find(|c| c.id == id)
            .map(|c| c.data)
    }
}

/// A name stored as a flag byte and an in-object string. A flag of 1
/// marks an InDesign built-in key, which IDML writes with `$ID/` before
/// it (`docs/format/objects.md`).
#[derive(Debug, Clone, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Name {
    pub builtin: bool,
    pub name: String,
}

impl Name {
    /// The name as IDML writes it.
    pub fn idml(&self) -> String {
        if self.builtin {
            builtin_key(&self.name)
        } else {
            self.name.clone()
        }
    }
}

/// How IDML writes the InDesign built-in key `key`: `$ID/key`.
pub fn builtin_key(key: &str) -> String {
    format!("$ID/{key}")
}

/// Cursor over object data in one [`Encoding`]. Make one with
/// [`Encoding::cursor`] or [`Object::cursor`].
#[derive(Debug, Clone)]
pub struct Cursor<'a> {
    data: &'a [u8],
    pos: usize,
    /// Big-endian data: [`Cursor::flag`] has read the tag of the next
    /// string.
    tag_read: bool,
    enc: Encoding,
}

fn short(what: &str, pos: usize) -> Error {
    Error::Corrupt(format!("chunk data ends while reading {what} at {pos}"))
}

impl<'a> Cursor<'a> {
    /// The encoding of the data.
    pub fn encoding(&self) -> Encoding {
        self.enc
    }

    /// A cursor over other data in the same encoding.
    pub fn sub<'d>(&self, data: &'d [u8]) -> Cursor<'d> {
        self.enc.cursor(data)
    }

    pub fn pos(&self) -> usize {
        self.pos
    }

    pub fn remaining(&self) -> usize {
        self.data.len() - self.pos
    }

    pub fn bytes(&mut self, n: usize) -> Result<&'a [u8], Error> {
        let out = self
            .data
            .get(self.pos..self.pos + n)
            .ok_or_else(|| short("bytes", self.pos))?;
        self.pos += n;
        Ok(out)
    }

    /// The next `N` bytes, as an array.
    fn array<const N: usize>(&mut self) -> Result<[u8; N], Error> {
        let out = *self
            .data
            .get(self.pos..)
            .and_then(<[u8]>::first_chunk)
            .ok_or_else(|| short("bytes", self.pos))?;
        self.pos += N;
        Ok(out)
    }

    pub fn skip(&mut self, n: usize) -> Result<(), Error> {
        self.bytes(n).map(|_| ())
    }

    pub fn u8(&mut self) -> Result<u8, Error> {
        Ok(self.bytes(1)?[0])
    }

    pub fn u16(&mut self) -> Result<u16, Error> {
        Ok(self.enc.u16_from(self.array()?))
    }

    pub fn u32(&mut self) -> Result<u32, Error> {
        Ok(self.enc.u32_from(self.array()?))
    }

    pub fn i32(&mut self) -> Result<i32, Error> {
        Ok(self.enc.i32_from(self.array()?))
    }

    pub fn f64(&mut self) -> Result<f64, Error> {
        Ok(self.enc.f64_from(self.array()?))
    }

    /// A u32 count followed by that many u32 values.
    pub fn u32_list(&mut self) -> Result<Vec<u32>, Error> {
        let n = self.u32()? as usize;
        if n > self.remaining() / 4 {
            return Err(Error::Corrupt(format!(
                "list of {n} at {} is too long",
                self.pos
            )));
        }
        (0..n).map(|_| self.u32()).collect()
    }

    /// Text made of `chars` UTF-16 code units, stored as segments. Each
    /// segment is a u16 header, flags in the top two bits and a count in
    /// the rest: 0x4000 = single-byte characters, 0x8000 = UTF-16 code
    /// units.
    pub fn segments(&mut self, chars: usize) -> Result<String, Error> {
        Ok(String::from_utf16_lossy(&self.segment_units(chars)?))
    }

    /// Like [`Cursor::segments`], but returns the UTF-16 code units, so a
    /// surrogate pair split between two runs can be joined by the caller.
    pub fn segment_units(&mut self, chars: usize) -> Result<Vec<u16>, Error> {
        // Each unit takes at least one byte, which bounds the capacity of
        // a damaged count.
        let mut units: Vec<u16> = Vec::with_capacity(chars.min(self.remaining()));
        while units.len() < chars {
            let header = self.u16()?;
            let n = (header & 0x3FFF) as usize;
            match header & 0xC000 {
                0x4000 => units.extend(self.bytes(n)?.iter().map(|&b| b as u16)),
                0x8000 => {
                    for _ in 0..n {
                        units.push(self.u16()?);
                    }
                }
                _ => {
                    return Err(Error::Corrupt(format!(
                        "unknown text segment header {header:#06x} at {}",
                        self.pos - 2
                    )));
                }
            }
            if n == 0 {
                return Err(Error::Corrupt(format!(
                    "empty text segment at {}",
                    self.pos - 2
                )));
            }
        }
        if units.len() != chars {
            return Err(Error::Corrupt(format!(
                "text segments hold {} units, expected {chars}",
                units.len()
            )));
        }
        Ok(units)
    }

    /// The flag byte before a string (see [`Cursor::string`]).
    pub fn flag(&mut self) -> Result<u8, Error> {
        let tag = self.enc.string_tag;
        if self.enc.big_endian && self.data.get(self.pos) == Some(&tag) && self.remaining() >= 2 {
            self.tag_read = true;
            self.pos += 2;
            return Ok(self.data[self.pos - 1]);
        }
        self.u8()
    }

    /// A flag byte (see [`Cursor::flag`]), 1 for a built-in key, and a
    /// string.
    pub fn name(&mut self) -> Result<Name, Error> {
        let builtin = self.flag()? == 1;
        Ok(Name {
            builtin,
            name: self.string()?,
        })
    }

    /// A string stored inside object data: u8 2 (1 in files from InDesign
    /// 2.0, see [`Encoding::new`]), a u8 whose meaning is unknown (usually
    /// 0), u16 length in UTF-16 code units, then segments.
    ///
    /// The byte before the 2 is often a flag (1 = the string is a built-in
    /// key), and the two bytes form a u16 with the 2 in the high byte. In
    /// big-endian data the 2 therefore comes first: read such a flag with
    /// [`Cursor::flag`]. If the caller skipped the byte before the string
    /// instead, the 2 is that byte (`docs/format/big-endian.md`).
    pub fn string(&mut self) -> Result<String, Error> {
        let start = self.pos;
        let expected = self.enc.string_tag;
        if self.enc.big_endian {
            if !std::mem::take(&mut self.tag_read) {
                let before = start.checked_sub(1).map(|i| self.data[i]);
                if before != Some(expected) && self.u8()? != expected {
                    return Err(Error::Corrupt(format!("no string tag at {start}")));
                }
                // The flag.
                self.u8()?;
            }
        } else {
            let tag = self.u8()?;
            if tag != expected {
                return Err(Error::Corrupt(format!(
                    "string tag {tag} at {start}, expected {expected}"
                )));
            }
        }
        self.u8()?;
        let n = self.u16()? as usize;
        if n == 0 {
            return Ok(String::new());
        }
        self.segments(n)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_chunks() {
        let mut b = Vec::new();
        b.extend_from_slice(&0x501u32.to_le_bytes());
        b.extend_from_slice(&2u32.to_le_bytes());
        b.extend_from_slice(&[7, 8]);
        b.extend_from_slice(&0x15bu32.to_le_bytes());
        b.extend_from_slice(&0u32.to_le_bytes());
        let le = Encoding::default();
        let c = le.chunks(&b).unwrap();
        assert_eq!(c.len(), 2);
        assert_eq!(
            c[0],
            Chunk {
                id: 0x501,
                data: &[7, 8]
            }
        );
        assert!(c[1].data.is_empty());
        assert!(le.chunks(&b[..b.len() - 1]).is_none());
    }

    #[test]
    fn decodes_mixed_segments() {
        let le = Encoding::default();
        // "WOMEN’S\r": 5 single-byte, 1 UTF-16, 2 single-byte.
        let data = [
            0x05, 0x40, b'W', b'O', b'M', b'E', b'N', 0x01, 0x80, 0x19, 0x20, 0x02, 0x40, b'S',
            b'\r',
        ];
        assert_eq!(le.cursor(&data).segments(8).unwrap(), "WOMEN\u{2019}S\r");
    }

    #[test]
    fn decodes_object_string() {
        let le = Encoding::default();
        let data = [
            2, 0, 7, 0, 7, 0x40, b'R', b'e', b'g', b'u', b'l', b'a', b'r',
        ];
        assert_eq!(le.cursor(&data).string().unwrap(), "Regular");
    }

    #[test]
    fn decodes_version_2_string() {
        let le = Encoding::new(ByteOrder::Little, Version { major: 2, minor: 0 });
        let data = [1, 0, 5, 0, 5, 0x40, b'R', b'o', b'm', b'a', b'n'];
        assert_eq!(le.cursor(&data).string().unwrap(), "Roman");
        let data = [2, 0, 5, 0, 5, 0x40, b'R', b'o', b'm', b'a', b'n'];
        assert!(le.cursor(&data).string().is_err());
    }

    #[test]
    fn decodes_big_endian_data() {
        let be = Encoding::new(ByteOrder::Big, Version { major: 4, minor: 0 });
        // A colour name from the InDesign 4.0 fixture: 2, flag 0, 0, length
        // 5, then a single-byte segment, and a u32 after it.
        let data = [
            2, 0, 0, 0, 5, 0x40, 5, b'B', b'l', b'a', b'c', b'k', 0, 0, 0, 0x0A,
        ];
        let mut c = be.cursor(&data);
        assert_eq!(c.flag().unwrap(), 0);
        assert_eq!(c.string().unwrap(), "Black");
        assert_eq!(c.u32().unwrap(), 10);
        // Code that skips the flag byte skips the 2 instead.
        let mut c = be.cursor(&data);
        c.skip(1).unwrap();
        assert_eq!(c.string().unwrap(), "Black");
        // UTF-16 code units are big-endian too.
        let data = [0x80, 0x01, 0x5C, 0x0F];
        assert_eq!(be.cursor(&data).segments(1).unwrap(), "\u{5C0F}");
    }
}
