//! Reader for INDD files, the native document format of Adobe® InDesign®.
//!
//! The format is undocumented. Everything this crate knows about it is
//! recorded in `docs/format/`; see `CLEANROOM.md` for how it was learned.
//!
//! The main entry points convert an INDD file to IDML:
//!
//! ```no_run
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! let conversion = indd::convert_file("brochure.indd")?;
//! std::fs::write("brochure.idml", &conversion.idml)?;
//! for warning in &conversion.warnings {
//!     eprintln!("warning: {warning}");
//! }
//! # Ok(())
//! # }
//! ```
//!
//! Bytes that are not an INDD file give an error:
//!
//! ```
//! let bytes = vec![0u8; 4096];
//! let err = indd::convert(&bytes, "empty.indd").unwrap_err();
//! assert!(matches!(err, indd::Error::NotIndd));
//! ```
//!
//! A conversion keeps no global or thread-local state, so documents can be
//! converted on several threads at once. Lower layers are public for tools
//! that inspect files: [`Header`], [`Container`], [`Database`], [`Object`]
//! and the [`model`].

#![forbid(unsafe_code)]
// Malformed input gives an error or a warning, never a panic. Unit tests
// may unwrap and panic.
#![cfg_attr(
    not(test),
    deny(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::panic,
        clippy::unimplemented,
        clippy::todo,
        clippy::unreachable
    )
)]

pub mod audit;

pub mod container;
pub mod database;
pub mod header;
#[cfg(test)]
mod hostile;

pub mod idml;
pub mod model;
pub mod object;

pub use container::{Container, ContigObject, MasterPage};
pub use database::{Database, Entry};
pub use header::{ByteOrder, Header, Version};
pub use object::{Chunk, Cursor, Encoding, Name, Object};

#[derive(Debug)]
pub enum Error {
    Io(std::io::Error),
    /// The file does not start with the INDD signature.
    NotIndd,
    /// The file is shorter than its header or its database pages say.
    Truncated {
        needed: usize,
        got: usize,
    },
    UnknownByteOrder(u8),
    /// A contiguous object's trailer does not match its header.
    BadContigObject {
        offset: usize,
    },
    /// The database structures are inconsistent.
    Corrupt(String),
    /// A valid file using a feature this crate does not read yet.
    Unsupported(&'static str),
    /// The file has the master pages but not the object database they
    /// point to (a file stripped to its metadata).
    NoDatabase {
        db_pages: u32,
        directory: u32,
    },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Io(e) => write!(f, "{e}"),
            Error::NotIndd => write!(f, "not an INDD file"),
            Error::Truncated { needed, got } => {
                write!(f, "file truncated: need {needed} bytes, got {got}")
            }
            Error::UnknownByteOrder(b) => write!(f, "unknown byte-order flag {b:#04x}"),
            Error::BadContigObject { offset } => {
                write!(
                    f,
                    "contiguous object at {offset:#x} has no matching trailer"
                )
            }
            Error::Corrupt(msg) => write!(f, "corrupt database: {msg}"),
            Error::Unsupported(what) => write!(f, "not supported yet: {what}"),
            Error::NoDatabase {
                db_pages,
                directory,
            } => write!(
                f,
                "no object database: the page directory is page {directory}, \
                 but the file has only {db_pages} database pages"
            ),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

/// Read only the header of the file at `path`.
pub fn read_header(path: impl AsRef<std::path::Path>) -> Result<Header, Error> {
    use std::io::Read;
    let mut buf = [0u8; header::PROBE_LEN];
    let mut f = std::fs::File::open(path)?;
    let mut got = 0;
    while got < buf.len() {
        match f.read(&mut buf[got..])? {
            0 => break,
            n => got += n,
        }
    }
    Header::parse(&buf[..got])
}

/// A problem that did not stop a conversion: content that was left out
/// or could not be converted exactly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Warning {
    message: String,
}

impl Warning {
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl std::fmt::Display for Warning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

/// The result of a conversion: the IDML package, the warnings and the
/// previews of linked graphics.
#[derive(Debug, Clone)]
pub struct Conversion {
    /// The IDML package (a ZIP file).
    pub idml: Vec<u8>,
    pub warnings: Vec<Warning>,
    /// InDesign's previews of the graphics whose file the document does
    /// not hold (see [`Preview`]).
    pub previews: Vec<Preview>,
}

/// InDesign's screen preview of placed graphics whose file the document
/// does not hold, such as linked images. IDML has no place for it, so it is
/// not in the package; an application can show it when the linked file is
/// missing (`docs/format/objects.md`, graphic previews).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Preview {
    /// The `Self` in the package of each graphic with this preview.
    pub graphics: Vec<String>,
    /// The preview file as stored: TIFF, JPEG, PNG or GIF.
    pub data: Vec<u8>,
}

/// Convert INDD bytes to an IDML package. `name` is the document name the
/// package records (normally the INDD file name).
///
/// The conversion keeps no state outside its own call, so documents can
/// be converted on several threads at once.
pub fn convert(indd: &[u8], name: &str) -> Result<Conversion, Error> {
    let mut idml = Vec::new();
    let mut previews = Vec::new();
    let warnings = convert_with(indd, name, &mut idml, None, Some(&mut previews))?;
    Ok(Conversion {
        idml,
        warnings,
        previews,
    })
}

/// Convert the INDD file at `path`. The package records the file name as
/// the document name.
pub fn convert_file(path: impl AsRef<std::path::Path>) -> Result<Conversion, Error> {
    let path = path.as_ref();
    let indd = std::fs::read(path)?;
    let name = path
        .file_name()
        .map_or_else(|| path.to_string_lossy(), |n| n.to_string_lossy());
    convert(&indd, &name)
}

/// Convert INDD bytes to an IDML package written to `out`, and return the
/// warnings. See [`convert`]; the previews are not returned, and their
/// data is not read.
pub fn convert_into(
    indd: &[u8],
    name: &str,
    out: impl std::io::Write,
) -> Result<Vec<Warning>, Error> {
    convert_with(indd, name, out, None, None)
}

/// [`convert_into`], recording what the conversion reads (for `indd audit`)
/// and reading the previews of linked graphics into `previews`.
fn convert_with(
    indd: &[u8],
    name: &str,
    out: impl std::io::Write,
    recorder: Option<audit::Recorder>,
    previews: Option<&mut Vec<Preview>>,
) -> Result<Vec<Warning>, Error> {
    let container = Container::parse(indd)?;
    let mut db = container.database()?;
    if let Some(r) = recorder {
        db.set_recorder(r);
    }
    let mut doc = model::Reader::new(&db).document(container.header.version)?;
    // A damaged XMP packet only loses the time zone of link times and
    // the black name.
    if let Ok(Some(packet)) = container.xmp() {
        doc.read_xmp(packet);
    }
    let mut warnings = doc.warnings.clone();
    warnings.extend(idml::write(&doc, name, out)?);
    if let Some(previews) = previews {
        *previews = read_previews(&db, &doc, &mut warnings);
    }
    Ok(warnings
        .into_iter()
        .map(|message| Warning { message })
        .collect())
}

/// The previews of the document's graphics, one per preview file. The
/// graphics are those of every page item the package holds (on spreads and
/// master spreads, anchored in text (cell text included), in graphic cells,
/// in groups and in the states of form fields) and the posters of their
/// movies and sounds.
fn read_previews(db: &Database, doc: &model::Document, warnings: &mut Vec<String>) -> Vec<Preview> {
    let mut graphics: std::collections::BTreeMap<u32, Vec<String>> = Default::default();
    let mut items: Vec<&model::PageItem> = doc
        .spreads
        .iter()
        .chain(&doc.master_spreads)
        .flat_map(|s| &s.items)
        .chain(
            doc.stories
                .iter()
                .flat_map(|s| s.anchors.values().flatten()),
        )
        .chain(
            doc.stories
                .iter()
                .flat_map(|s| s.tables.values())
                .flat_map(|t| &t.cells)
                .flat_map(|c| &c.items),
        )
        .collect();
    while let Some(item) = items.pop() {
        for g in item
            .graphics
            .iter()
            .chain(item.media.iter().filter_map(|m| m.poster.as_ref()))
        {
            if let Some(data) = g.preview {
                graphics
                    .entry(data)
                    .or_default()
                    .push(format!("u{:x}", g.uid));
            }
        }
        items.extend(&item.children);
        if let model::ItemKind::Form(f) = &item.kind {
            items.extend(f.states.iter().flat_map(|s| &s.items));
        }
    }
    graphics
        .into_iter()
        .filter_map(|(uid, graphics)| match db.object(uid) {
            Ok(data) => data.map(|data| Preview { graphics, data }),
            Err(e) => {
                warnings.push(format!("preview {uid}: left out: {e}"));
                None
            }
        })
        .collect()
}
