//! Hostile-input tests: whatever the input, a conversion returns a package
//! or an error. It never panics and never runs without end.
//!
//! The inputs are damaged copies of two kinds of documents:
//!
//! - Synthetic databases, built from a seed with the test-only
//!   [`synthetic`] builder. Their objects have the classes and chunks the
//!   model reads, with data shaped like UID lists, child lists, attribute
//!   lists, strings and numbers, or random bytes. They go through the
//!   model and the IDML writer.
//! - The fixture files of `tests/fixtures/files/` (fetched with
//!   `tools/fetch_fixtures.py`), skipped if absent. They go through
//!   [`crate::convert`].
//!
//! Each input is truncated at many lengths and has bytes flipped at many
//! positions, chosen by a pseudo-random generator with a fixed seed, so
//! every run checks the same cases. A case fails if it panics or takes
//! longer than [`CASE_LIMIT`].
//!
//! The default sweep (about 1,600 cases) takes a few seconds. Larger
//! sweeps:
//!
//! ```sh
//! INDD_HOSTILE_SCALE=40 cargo test --lib hostile
//! INDD_HOSTILE_SEED=7 INDD_HOSTILE_SCALE=40 cargo test --lib hostile
//! ```
//!
//! `INDD_HOSTILE_SCALE` multiplies the number of cases; `INDD_HOSTILE_SEED`
//! changes the seed. A debug build also catches arithmetic overflow; at
//! scale 40 it takes about 75 s on 16 cores. A failure names the seed and
//! the case, so it can be repeated.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use crate::database::synthetic;
use crate::model::{attrs::ty, chunk, class};
use crate::{Database, Version};

/// The longest a single conversion may take. A conversion of the largest
/// fixture takes about 0.1 s in a debug build.
const CASE_LIMIT: Duration = Duration::from_secs(20);

/// The model sources whose hexadecimal constants are the class, chunk and
/// attribute IDs the synthetic objects are made of. Every hexadecimal
/// literal of 3 to 6 digits counts: a superset of the IDs is harmless.
const SOURCES: [&str; 26] = [
    include_str!("model/animation.rs"),
    include_str!("model/behavior.rs"),
    include_str!("model/attrs.rs"),
    include_str!("model/cjk.rs"),
    include_str!("model/color.rs"),
    include_str!("model/document.rs"),
    include_str!("model/font.rs"),
    include_str!("model/hyperlink.rs"),
    include_str!("model/ids.rs"),
    include_str!("model/item.rs"),
    include_str!("model/media.rs"),
    include_str!("model/mod.rs"),
    include_str!("model/prefs.rs"),
    include_str!("model/reader.rs"),
    include_str!("model/settings.rs"),
    include_str!("model/spread.rs"),
    include_str!("model/story.rs"),
    include_str!("model/story_link.rs"),
    include_str!("model/strings.rs"),
    include_str!("model/style.rs"),
    include_str!("model/table.rs"),
    include_str!("model/variable.rs"),
    include_str!("model/xml.rs"),
    include_str!("model/xmp.rs"),
    include_str!("model/xref.rs"),
    include_str!("idml/attrs.rs"),
];

/// SplitMix64: a small, deterministic pseudo-random generator.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// A number in `0..n` (0 if `n` is 0).
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n.max(1) as u64) as usize
    }

    fn pick<T: Copy>(&mut self, xs: &[T]) -> T {
        xs[self.below(xs.len())]
    }

    fn byte(&mut self) -> u8 {
        self.next() as u8
    }
}

fn env_number(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn scale() -> usize {
    env_number("INDD_HOSTILE_SCALE", 1).max(1) as usize
}

fn seed() -> u64 {
    env_number("INDD_HOSTILE_SEED", 0x1DD)
}

/// The hexadecimal literals of 3 to 6 digits in `text`.
fn hex_literals(text: &str) -> impl Iterator<Item = u32> + '_ {
    text.split("0x").skip(1).filter_map(|rest| {
        let digits: String = rest
            .chars()
            .take_while(|c| c.is_ascii_hexdigit() || *c == '_')
            .filter(|c| *c != '_')
            .collect();
        (3..=6)
            .contains(&digits.len())
            .then(|| u32::from_str_radix(&digits, 16).ok())
            .flatten()
    })
}

/// The constants of each `pub mod NAME` block (`class`, `chunk`).
fn block_ids(name: &str) -> Vec<u32> {
    let head = format!("pub mod {name} ");
    let mut out = Vec::new();
    for text in SOURCES {
        let mut inside = false;
        for line in text.lines() {
            let line = line.trim();
            if line.starts_with(&head) {
                inside = true;
            } else if inside && line == "}" {
                inside = false;
            } else if inside && line.starts_with("pub const") {
                out.extend(hex_literals(line));
            }
        }
    }
    out
}

fn sorted(mut ids: Vec<u32>) -> Vec<u32> {
    ids.sort_unstable();
    ids.dedup();
    ids
}

/// What synthetic objects are made of.
struct Ids {
    /// Class IDs: the `class` blocks and the `CLASS` constants.
    classes: Vec<u32>,
    /// Chunk IDs: the `chunk` blocks.
    chunks: Vec<u32>,
    /// Every hexadecimal literal of the sources, among them the
    /// attribute IDs.
    all: Vec<u32>,
}

impl Ids {
    fn new() -> Ids {
        let mut classes = block_ids("class");
        for text in SOURCES {
            for line in text.lines() {
                if line.trim().starts_with("pub const CLASS:") {
                    classes.extend(hex_literals(line));
                }
            }
        }
        Ids {
            classes: sorted(classes),
            chunks: sorted(block_ids("chunk")),
            all: sorted(SOURCES.iter().flat_map(|t| hex_literals(t)).collect()),
        }
    }
}

/// A builder of synthetic object data.
struct Gen<'a> {
    rng: Rng,
    ids: &'a Ids,
    /// The highest UID of the document.
    uids: u32,
}

impl Gen<'_> {
    fn u32(&mut self, out: &mut Vec<u8>, v: u32) {
        out.extend_from_slice(&v.to_le_bytes());
    }

    /// A UID of the document, sometimes one that is missing or invalid.
    fn uid(&mut self) -> u32 {
        match self.rng.below(16) {
            0 => 0,
            1 => u32::MAX,
            2 => self.uids + 1 + self.rng.below(4) as u32,
            _ => 1 + self.rng.below(self.uids as usize) as u32,
        }
    }

    /// A count: usually small, sometimes far larger than the data.
    fn count(&mut self) -> u32 {
        match self.rng.below(32) {
            0 => u32::MAX,
            1 => 0x10000 + self.rng.below(0x10000) as u32,
            _ => self.rng.below(6) as u32,
        }
    }

    fn uid_list(&mut self, out: &mut Vec<u8>) {
        let n = self.count();
        self.u32(out, n);
        for _ in 0..n.min(8) {
            let u = self.uid();
            self.u32(out, u);
        }
    }

    /// An attribute list: count, then records of attribute ID, size and
    /// values (count, then type, length and data).
    fn attrs(&mut self, out: &mut Vec<u8>, short: bool) {
        let n = self.count();
        if short {
            out.extend_from_slice(&(n as u16).to_le_bytes());
        } else {
            self.u32(out, n);
        }
        for _ in 0..n.min(8) {
            let id = self.rng.pick(&self.ids.all);
            self.u32(out, id);
            let mut record = Vec::new();
            let values = self.rng.below(3) as u16;
            record.extend_from_slice(&values.to_le_bytes());
            for _ in 0..values {
                let t =
                    self.rng
                        .pick(&[ty::DOUBLE, ty::INT, ty::ENUM, ty::POINT, ty::REF, ty::CODE]);
                let len = self.rng.pick(&[0, 2, 4, 8, 16, 28]);
                let data = self.numbers(len);
                record.extend_from_slice(&t.to_le_bytes());
                record.extend_from_slice(&(data.len() as u16).to_le_bytes());
                record.extend_from_slice(&data);
            }
            out.extend_from_slice(&(record.len() as u16).to_le_bytes());
            out.extend_from_slice(&record);
        }
    }

    /// `len` bytes of numbers: UIDs, IDs, counts, doubles or random bytes.
    fn numbers(&mut self, len: usize) -> Vec<u8> {
        let mut out = Vec::new();
        while out.len() < len {
            match self.rng.below(6) {
                0 => {
                    let u = self.uid();
                    self.u32(&mut out, u);
                }
                1 => {
                    let id = self.rng.pick(&self.ids.all);
                    self.u32(&mut out, id);
                }
                2 => {
                    let n = self.count();
                    self.u32(&mut out, n);
                }
                3 => {
                    let v = self
                        .rng
                        .pick(&[0.0, 1.0, -72.5, 1e300, f64::NAN, f64::INFINITY]);
                    out.extend_from_slice(&f64::to_le_bytes(v));
                }
                _ => out.push(self.rng.byte()),
            }
        }
        out.truncate(len);
        out
    }

    /// Chunk data of one of the shapes the readers expect, or random.
    fn chunk_data(&mut self) -> Vec<u8> {
        let mut out = Vec::new();
        match self.rng.below(9) {
            0 => self.uid_list(&mut out),
            1 => {
                // A child list: parent, owner, then a UID list.
                let (parent, owner) = (self.uid(), self.uid());
                self.u32(&mut out, parent);
                self.u32(&mut out, owner);
                self.uid_list(&mut out);
            }
            2 => self.attrs(&mut out, false),
            3 => self.attrs(&mut out, true),
            4 => {
                let flag = self.rng.below(3) as u8;
                let name = self
                    .rng
                    .pick(&["", "A", "[None]", "Basic Paragraph", "$ID/x"]);
                out = synthetic::flagged_string(crate::Encoding::default(), flag, name);
                let len = self.rng.below(24);
                let tail = self.numbers(len);

                out.extend_from_slice(&tail);
            }
            5 | 6 => {
                let len = self.rng.below(96);
                out = self.numbers(len);
            }
            7 => {
                let len = self.rng.below(64);
                out = (0..len).map(|_| self.rng.byte()).collect();
            }
            _ => {}
        }
        out
    }

    /// The chunks of an object: up to 40, most with the IDs of the
    /// model's `chunk` blocks, the others with any ID of the sources.
    fn object(&mut self) -> Vec<u8> {
        let chunks: Vec<(u32, Vec<u8>)> = (0..self.rng.below(41))
            .map(|_| {
                let id = if self.rng.below(5) == 0 {
                    self.rng.pick(&self.ids.all)
                } else {
                    self.rng.pick(&self.ids.chunks)
                };
                (id, self.chunk_data())
            })
            .collect();
        let mut bytes = synthetic::chunks(&chunks);
        bytes.truncate(crate::database::SEGMENT_MAX as usize);
        bytes
    }
}

type Objects = Vec<(u32, u32, Vec<u8>)>;

/// A synthetic document: the document object (UID 1) and up to 48 other
/// objects. The document's lists are well formed and name objects of the
/// classes they hold; spreads hold spread layers, which hold pages and
/// page items. Every object also has chunks of any shape, and the
/// objects outside this tree have any class.
fn document(seed: u64, ids: &Ids) -> Objects {
    let mut g = Gen {
        rng: Rng(seed),
        ids,
        uids: 0,
    };
    g.uids = 8 + g.rng.below(41) as u32;
    let mut classes: Vec<u32> = (2..=g.uids).map(|_| g.rng.pick(&ids.classes)).collect();
    // Structural chunks by object, before the others so that they are
    // the ones read.
    let mut structure: Vec<Vec<(u32, Vec<u8>)>> = vec![Vec::new(); classes.len() + 1];
    let mut free: Vec<u32> = (2..=g.uids).collect();
    let mut take = |g: &mut Gen, n: usize| -> Vec<u32> {
        (0..n.min(free.len()))
            .map(|_| free.swap_remove(g.rng.below(free.len())))
            .collect()
    };
    let list = |uids: &[u32]| -> Vec<u8> {
        let mut d = (uids.len() as u32).to_le_bytes().to_vec();
        uids.iter()
            .for_each(|u| d.extend_from_slice(&u.to_le_bytes()));
        d
    };
    let mut doc = Vec::new();
    for (chunk, class) in [
        (chunk::DOC_LAYERS, class::LAYER),
        (chunk::DOC_SPREADS, class::SPREAD),
        (chunk::DOC_MASTER_SPREADS, class::MASTER_SPREAD),
        (chunk::DOC_STORIES, class::STORY),
        (chunk::DOC_SECTIONS, class::SECTION),
        (chunk::DOC_ARTICLES, class::ARTICLE),
    ] {
        let n = g.rng.below(4);
        let members = take(&mut g, n);
        for &uid in &members {
            classes[uid as usize - 2] = class;
        }
        doc.push((chunk, list(&members)));
    }
    // Spread layers, and the pages and page items on them.
    for i in 0..classes.len() {
        if ![class::SPREAD, class::MASTER_SPREAD].contains(&classes[i]) {
            continue;
        }
        let n = 1 + g.rng.below(2);
        let layers = take(&mut g, n);
        let mut children = vec![0; 8];
        children.extend(list(&layers));
        structure[i].push((chunk::SPREAD_CHILDREN, children));
        for sl in layers {
            classes[sl as usize - 2] = class::SPREAD_LAYER;
            let n = 1 + g.rng.below(4);
            let items = take(&mut g, n);
            for &item in &items {
                classes[item as usize - 2] = g.rng.pick(&[
                    class::PAGE,
                    class::GROUP,
                    class::SPLINE_ITEM,
                    class::MULTI_COLUMN_FRAME,
                    class::GUIDE,
                    class::IMAGE,
                ]);
                let mut attrs = Vec::new();
                g.attrs(&mut attrs, false);
                structure[item as usize - 2].push((chunk::ITEM_ATTRS, attrs));
            }
            let mut children = vec![0; 8];
            children.extend(list(&items));
            structure[sl as usize - 2].push((chunk::SPREAD_LAYER_CHILDREN, children));
        }
    }
    // A few other chunks of any shape: the document may fail to read.
    for _ in 0..g.rng.below(3) {
        let id = g.rng.pick(&ids.chunks);
        doc.push((id, g.chunk_data()));
    }
    let mut objects = vec![(1, class::DOCUMENT, synthetic::chunks(&doc))];
    for ((uid, class), mut chunks) in (2..).zip(classes).zip(structure) {
        if class == class::LAYER {
            // Layers are read with the document, which fails without
            // their settings: two u16 flags, 14 bytes, then the name.
            let mut props = vec![0, 0, 1, 0];
            props.extend_from_slice(&g.numbers(14));
            props.extend(synthetic::flagged_string(
                crate::Encoding::default(),
                0,
                "Layer 1",
            ));
            let tail = 2 + g.rng.below(8);
            props.extend_from_slice(&g.numbers(tail));
            chunks.push((chunk::LAYER_PROPS, props));
        }
        let mut data = synthetic::chunks(&chunks);
        data.extend(g.object());
        data.truncate(crate::database::SEGMENT_MAX as usize);
        objects.push((uid, class, data));
    }
    objects
}

/// Convert a synthetic database: the model, then the IDML writer.
fn convert_database(db: &Database, version: Version) {
    let Ok(doc) = crate::model::Reader::new(db).document(version) else {
        return;
    };
    let _ = crate::idml::write(&doc, "hostile.indd", std::io::sink());
}

/// Flip `n` bytes of `bytes` within `range`.
fn flip(rng: &mut Rng, bytes: &mut [u8], range: std::ops::Range<usize>, n: usize) {
    if range.is_empty() {
        return;
    }
    for _ in 0..n {
        let i = range.start + rng.below(range.len());
        bytes[i] ^= 1 + rng.byte() % 255;
    }
}

/// One case: a description that repeats it, and the conversion.
type Case = (String, Box<dyn FnOnce() + Send>);

/// The case each thread is running, and since when.
type Running = Vec<Mutex<Option<(String, Instant)>>>;

/// The damaged copies of synthetic document `n`.
fn synthetic_cases(seed: u64, n: u64, ids: &Arc<Ids>) -> Vec<Case> {
    let doc_seed = seed ^ n.wrapping_mul(0xA24B_AED4_963E_E407);
    let mut rng = Rng(doc_seed ^ 0x5EED);
    let versions = [3, 4, 5, 7, 9, 13, 16, 20, 21];
    let mut cases: Vec<Case> = Vec::new();
    for k in 0..8 {
        let ids = Arc::clone(ids);
        let version = Version {
            major: rng.pick(&versions),
            minor: 0,
        };
        let case_seed = rng.next();
        let what = format!(
            "synthetic document {n} (seed {seed}), case {k}, version {}",
            version.major
        );
        cases.push((
            what,
            Box::new(move || {
                let mut objects = document(doc_seed, &ids);
                let mut rng = Rng(case_seed);
                match k {
                    // As built.
                    0 => {}
                    // One object truncated.
                    1..=3 => {
                        let i = rng.below(objects.len());
                        let len = rng.below(objects[i].2.len() + 1);
                        objects[i].2.truncate(len);
                    }
                    // Bytes flipped across the objects.
                    4..=6 => {
                        for _ in 0..1 + rng.below(8) {
                            let i = rng.below(objects.len());
                            let len = objects[i].2.len();
                            flip(&mut rng, &mut objects[i].2, 0..len, 1);
                        }
                    }
                    // The file image truncated: objects past the end are
                    // missing or cut short.
                    _ => {
                        let mut bytes = synthetic::image(&objects);
                        bytes.truncate(rng.below(bytes.len() + 1));
                        let db = synthetic::database(&bytes, &objects);
                        convert_database(&db, version);
                        return;
                    }
                }
                let bytes = synthetic::image(&objects);
                let db = synthetic::database(&bytes, &objects);
                convert_database(&db, version);
            }),
        ));
    }
    cases
}

/// The damaged copies of a fixture file.
fn fixture_cases(seed: u64, name: &str, bytes: Arc<Vec<u8>>, scale: usize) -> Vec<Case> {
    let mut rng = Rng(seed
        ^ name
            .bytes()
            .fold(0u64, |h, b| h.wrapping_mul(31) ^ u64::from(b)));
    let len = bytes.len();
    let page = crate::container::PAGE_SIZE;
    let mut cases: Vec<Case> = Vec::new();
    // Truncations: at the structure boundaries, and anywhere.
    let mut cuts = vec![0, 1, 15, 16, 0x100, page - 1, page, 2 * page, 2 * page + 1];
    cuts.extend([len / 2, len.saturating_sub(page), len.saturating_sub(1)]);
    cuts.extend((0..16 * scale).map(|_| rng.below(len)));
    for cut in cuts.into_iter().filter(|&c| c < len) {
        let bytes = Arc::clone(&bytes);
        let name = name.to_string();
        cases.push((
            format!("{name} truncated to {cut} bytes"),
            Box::new(move || {
                let _ = crate::convert(&bytes[..cut], &name);
            }),
        ));
    }
    // Flips: one or more bytes, a quarter of the cases in the header and
    // master pages, the others anywhere.
    for k in 0..48 * scale {
        let n = rng.pick(&[1, 1, 2, 4, 16, 64]);
        let range = if k % 4 == 0 {
            0..len.min(2 * page)
        } else {
            0..len
        };
        let case_seed = rng.next();
        let bytes = Arc::clone(&bytes);
        let name = name.to_string();
        cases.push((
            format!("{name} with {n} bytes flipped (seed {seed}, case {k})"),
            Box::new(move || {
                let mut copy = bytes.to_vec();
                flip(&mut Rng(case_seed), &mut copy, range, n);
                let _ = crate::convert(&copy, &name);
            }),
        ));
    }
    cases
}

/// Run `cases` on several threads. Fail if any panics, or if one takes
/// longer than [`CASE_LIMIT`]; a case that runs without end is left
/// behind on its thread.
fn run(cases: Vec<Case>) {
    let total = cases.len();
    let queue = Arc::new(Mutex::new(cases.into_iter().enumerate()));
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get());
    let running: Arc<Running> = Arc::new((0..threads).map(|_| Mutex::new(None)).collect());
    let failures = Arc::new(Mutex::new(Vec::new()));
    let finished = Arc::new(AtomicUsize::new(0));
    for t in 0..threads {
        let (queue, running, failures, finished) = (
            Arc::clone(&queue),
            Arc::clone(&running),
            Arc::clone(&failures),
            Arc::clone(&finished),
        );
        std::thread::spawn(move || {
            loop {
                let next = queue.lock().unwrap_or_else(PoisonError::into_inner).next();
                let Some((_, (what, case))) = next else {
                    break;
                };
                *running[t].lock().unwrap_or_else(PoisonError::into_inner) =
                    Some((what.clone(), Instant::now()));
                if let Err(e) = catch_unwind(AssertUnwindSafe(case)) {
                    let msg = e
                        .downcast_ref::<&str>()
                        .map(|s| s.to_string())
                        .or_else(|| e.downcast_ref::<String>().cloned())
                        .unwrap_or_default();
                    failures
                        .lock()
                        .unwrap_or_else(PoisonError::into_inner)
                        .push(format!("{what}: panicked: {msg}"));
                }
                *running[t].lock().unwrap_or_else(PoisonError::into_inner) = None;
            }
            finished.fetch_add(1, Ordering::SeqCst);
        });
    }
    while finished.load(Ordering::SeqCst) < threads {
        for slot in running.iter() {
            if let Some((what, start)) = &*slot.lock().unwrap_or_else(PoisonError::into_inner) {
                let took = start.elapsed();
                assert!(took < CASE_LIMIT, "{what}: still running after {took:?}");
            }
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let failures = failures.lock().unwrap_or_else(PoisonError::into_inner);
    assert!(
        failures.is_empty(),
        "{} of {total} cases failed:\n{}",
        failures.len(),
        failures[..failures.len().min(20)].join("\n")
    );
}

#[test]
fn synthetic_ids_are_found() {
    let ids = Ids::new();
    assert!(ids.classes.contains(&class::STORY));
    assert!(ids.classes.contains(&crate::model::color::class::COLOR));
    assert!(ids.classes.contains(&crate::model::xref::CLASS));
    assert!(!ids.classes.contains(&chunk::STRAND_DATA));
    assert!(ids.chunks.contains(&chunk::STRAND_DATA));
    assert!(ids.chunks.contains(&crate::model::color::chunk::COLOR_NAME));
    assert!(ids.all.contains(&crate::model::attrs::OPACITY_STOPS[0]));
}

#[test]
fn hostile_synthetic_documents() {
    let ids = Arc::new(Ids::new());
    let seed = seed();
    let cases = (0..150 * scale() as u64)
        .flat_map(|n| synthetic_cases(seed, n, &ids))
        .collect();
    run(cases);
}

#[test]
fn hostile_fixture_files() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/files");
    let Ok(dirs) = std::fs::read_dir(&root) else {
        eprintln!("tests/fixtures/files/ not present; skipping");
        return;
    };
    let mut files: Vec<_> = dirs
        .flatten()
        .filter_map(|d| std::fs::read_dir(d.path()).ok())
        .flat_map(|d| d.flatten().map(|e| e.path()))
        .filter(|p| {
            p.extension()
                .is_some_and(|e| e.eq_ignore_ascii_case("indd") || e.eq_ignore_ascii_case("indt"))
        })
        .collect();
    files.sort();
    let (seed, scale) = (seed(), scale());
    let mut cases = Vec::new();
    for path in files {
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned());
        let (Some(name), Ok(bytes)) = (name, std::fs::read(&path)) else {
            continue;
        };
        cases.extend(fixture_cases(seed, &name, Arc::new(bytes), scale));
    }
    run(cases);
}
