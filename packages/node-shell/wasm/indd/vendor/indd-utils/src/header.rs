//! The fixed header at the start of every INDD file. See `docs/format/header.md`.

use crate::Error;

/// The 16 bytes every INDD file starts with.
pub const SIGNATURE: [u8; 16] = [
    0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D,
];

/// Number of bytes [`Header::parse`] needs.
pub const HEADER_LEN: usize = 0x25;

const KIND_OFFSET: usize = 0x10;
const BYTE_ORDER_OFFSET: usize = 0x18;
const MAJOR_OFFSET: usize = 0x1D;
const MINOR_OFFSET: usize = 0x21;
/// Where files from InDesign 1.0 and 1.5 have the `DOCUMENT` tag. They do
/// not start with the signature (`docs/format/header.md`).
const LEGACY_KIND_OFFSET: usize = 0x5C;

/// Number of bytes [`Header::parse`] needs to recognise every layout.
pub const PROBE_LEN: usize = LEGACY_KIND_OFFSET + 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ByteOrder {
    Little,
    Big,
}

impl ByteOrder {
    /// The u32 at `offset` in this byte order.
    ///
    /// # Panics
    ///
    /// If `bytes` is shorter than `offset + 4`.
    pub fn read_u32(self, bytes: &[u8], offset: usize) -> u32 {
        let b: [u8; 4] = std::array::from_fn(|i| bytes[offset + i]);
        match self {
            ByteOrder::Little => u32::from_le_bytes(b),
            ByteOrder::Big => u32::from_be_bytes(b),
        }
    }
}

/// InDesign application version that last saved the file.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct Version {
    pub major: u32,
    pub minor: u32,
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}", self.major, self.minor)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Header {
    /// ASCII tag after the signature. `DOCUMENT` in every file seen so far.
    pub kind: [u8; 8],
    pub byte_order: ByteOrder,
    pub version: Version,
}

impl Header {
    pub fn parse(bytes: &[u8]) -> Result<Header, Error> {
        if bytes.len() < HEADER_LEN {
            return Err(Error::Truncated {
                needed: HEADER_LEN,
                got: bytes.len(),
            });
        }
        if bytes[..16] != SIGNATURE {
            if bytes.get(LEGACY_KIND_OFFSET..LEGACY_KIND_OFFSET + 8) == Some(b"DOCUMENT") {
                return Err(Error::Unsupported("InDesign 1.x file layout"));
            }
            return Err(Error::NotIndd);
        }
        let byte_order = match bytes[BYTE_ORDER_OFFSET] {
            1 => ByteOrder::Little,
            2 => ByteOrder::Big,
            other => return Err(Error::UnknownByteOrder(other)),
        };
        Ok(Header {
            kind: std::array::from_fn(|i| bytes[KIND_OFFSET + i]),

            byte_order,
            version: Version {
                major: byte_order.read_u32(bytes, MAJOR_OFFSET),
                minor: byte_order.read_u32(bytes, MINOR_OFFSET),
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header_bytes(order: u8, major: [u8; 4], minor: [u8; 4]) -> Vec<u8> {
        let mut b = vec![0u8; HEADER_LEN];
        b[..16].copy_from_slice(&SIGNATURE);
        b[KIND_OFFSET..KIND_OFFSET + 8].copy_from_slice(b"DOCUMENT");
        b[BYTE_ORDER_OFFSET] = order;
        b[MAJOR_OFFSET..MAJOR_OFFSET + 4].copy_from_slice(&major);
        b[MINOR_OFFSET..MINOR_OFFSET + 4].copy_from_slice(&minor);
        b
    }

    #[test]
    fn little_endian_version() {
        let h = Header::parse(&header_bytes(1, [21, 0, 0, 0], [3, 0, 0, 0])).unwrap();
        assert_eq!(h.byte_order, ByteOrder::Little);
        assert_eq!(
            h.version,
            Version {
                major: 21,
                minor: 3
            }
        );
        assert_eq!(&h.kind, b"DOCUMENT");
    }

    #[test]
    fn big_endian_version() {
        let h = Header::parse(&header_bytes(2, [0, 0, 0, 3], [0, 0, 0, 0])).unwrap();
        assert_eq!(h.byte_order, ByteOrder::Big);
        assert_eq!(h.version, Version { major: 3, minor: 0 });
    }

    #[test]
    fn rejects_wrong_signature() {
        let mut b = header_bytes(1, [0; 4], [0; 4]);
        b[0] = 0;
        assert!(matches!(Header::parse(&b), Err(Error::NotIndd)));
    }

    #[test]
    fn reports_version_1_layout() {
        let mut b = vec![0u8; 0x80];
        b[LEGACY_KIND_OFFSET..LEGACY_KIND_OFFSET + 8].copy_from_slice(b"DOCUMENT");
        assert!(matches!(Header::parse(&b), Err(Error::Unsupported(_))));
    }

    #[test]
    fn rejects_unknown_byte_order() {
        let b = header_bytes(7, [0; 4], [0; 4]);
        assert!(matches!(Header::parse(&b), Err(Error::UnknownByteOrder(7))));
    }

    #[test]
    fn rejects_short_input() {
        assert!(matches!(
            Header::parse(&SIGNATURE),
            Err(Error::Truncated { .. })
        ));
    }
}
