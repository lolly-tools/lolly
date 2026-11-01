//! A minimal ZIP writer: stored (uncompressed) entries only, which is all
//! an IDML package needs. The first entry must be `mimetype`, stored.

use std::io::{self, Write};

fn crc32(data: &[u8]) -> u32 {
    static TABLE: std::sync::OnceLock<[u32; 256]> = std::sync::OnceLock::new();
    let table = TABLE.get_or_init(|| {
        let mut t = [0u32; 256];
        for (i, slot) in t.iter_mut().enumerate() {
            let mut c = i as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 {
                    0xEDB8_8320 ^ (c >> 1)
                } else {
                    c >> 1
                };
            }
            *slot = c;
        }
        t
    });
    let mut crc = !0u32;
    for &b in data {
        crc = table[((crc ^ b as u32) & 0xFF) as usize] ^ (crc >> 8);
    }
    !crc
}

struct Entry {
    name: String,
    crc: u32,
    size: u32,
    offset: u32,
}

pub struct ZipWriter<W: Write> {
    out: W,
    written: u32,
    entries: Vec<Entry>,
}

impl<W: Write> ZipWriter<W> {
    pub fn new(out: W) -> ZipWriter<W> {
        ZipWriter {
            out,
            written: 0,
            entries: Vec::new(),
        }
    }

    fn put(&mut self, bytes: &[u8]) -> io::Result<()> {
        self.out.write_all(bytes)?;
        self.written = self
            .written
            .checked_add(bytes.len() as u32)
            .ok_or_else(|| io::Error::other("package larger than 4 GB"))?;
        Ok(())
    }

    pub fn add(&mut self, name: &str, data: &[u8]) -> io::Result<()> {
        let crc = crc32(data);
        let size = u32::try_from(data.len()).map_err(|_| io::Error::other("entry too large"))?;
        let offset = self.written;
        let mut h = Vec::with_capacity(30 + name.len());
        h.extend_from_slice(&0x0403_4B50u32.to_le_bytes());
        h.extend_from_slice(&20u16.to_le_bytes()); // version needed
        h.extend_from_slice(&0x0800u16.to_le_bytes()); // UTF-8 names
        h.extend_from_slice(&0u16.to_le_bytes()); // stored
        h.extend_from_slice(&0u16.to_le_bytes()); // time
        h.extend_from_slice(&0x21u16.to_le_bytes()); // date: 1980-01-01
        h.extend_from_slice(&crc.to_le_bytes());
        h.extend_from_slice(&size.to_le_bytes());
        h.extend_from_slice(&size.to_le_bytes());
        h.extend_from_slice(&(name.len() as u16).to_le_bytes());
        h.extend_from_slice(&0u16.to_le_bytes());
        h.extend_from_slice(name.as_bytes());
        self.put(&h)?;
        self.put(data)?;
        self.entries.push(Entry {
            name: name.to_string(),
            crc,
            size,
            offset,
        });
        Ok(())
    }

    pub fn finish(mut self) -> io::Result<W> {
        let start = self.written;
        let entries = std::mem::take(&mut self.entries);
        for e in &entries {
            let mut h = Vec::with_capacity(46 + e.name.len());
            h.extend_from_slice(&0x0201_4B50u32.to_le_bytes());
            h.extend_from_slice(&20u16.to_le_bytes()); // made by
            h.extend_from_slice(&20u16.to_le_bytes()); // needed
            h.extend_from_slice(&0x0800u16.to_le_bytes());
            h.extend_from_slice(&0u16.to_le_bytes());
            h.extend_from_slice(&0u16.to_le_bytes());
            h.extend_from_slice(&0x21u16.to_le_bytes());
            h.extend_from_slice(&e.crc.to_le_bytes());
            h.extend_from_slice(&e.size.to_le_bytes());
            h.extend_from_slice(&e.size.to_le_bytes());
            h.extend_from_slice(&(e.name.len() as u16).to_le_bytes());
            h.extend_from_slice(&[0; 12]); // extra, comment, disk, attrs
            h.extend_from_slice(&e.offset.to_le_bytes());
            h.extend_from_slice(e.name.as_bytes());
            self.put(&h)?;
        }
        let size = self.written - start;
        let mut end = Vec::with_capacity(22);
        end.extend_from_slice(&0x0605_4B50u32.to_le_bytes());
        end.extend_from_slice(&[0; 4]);
        end.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        end.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        end.extend_from_slice(&size.to_le_bytes());
        end.extend_from_slice(&start.to_le_bytes());
        end.extend_from_slice(&0u16.to_le_bytes());
        self.put(&end)?;
        Ok(self.out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc32_matches_reference_value() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
    }

    #[test]
    fn writes_readable_archive_structure() {
        let mut z = ZipWriter::new(Vec::new());
        z.add("mimetype", b"application/vnd.adobe.indesign-idml-package")
            .unwrap();
        z.add("a/b.xml", b"<x/>").unwrap();
        let bytes = z.finish().unwrap();
        assert_eq!(&bytes[..4], b"PK\x03\x04");
        assert_eq!(&bytes[30..38], b"mimetype");
        let eocd = &bytes[bytes.len() - 22..];
        assert_eq!(&eocd[..4], b"PK\x05\x06");
        assert_eq!(u16::from_le_bytes([eocd[10], eocd[11]]), 2);
    }
}
