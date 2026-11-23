// SPDX-License-Identifier: MPL-2.0
//! Seeded mutation runs over each picture decoder and over pictures placed on a page.
//!
//! Bytes reach the crate from a shell now (the Node binding), so every decoder is fed
//! mutated files: flipped bytes, cut files, inserted runs, copied runs and length fields
//! set to extremes. Each mutation must decode, or refuse with a code, promptly; a panic
//! fails the test. The seeds in `tests/seeds` are 16 x 12 pictures written by Pillow
//! 12.3.0 (libjpeg-turbo and libwebp): baseline and progressive JPEG, PNG with alpha,
//! and lossy, lossless and alpha WebP. `LOLLY_RENDER_FUZZ_ITERS` sets the mutations per
//! seed (default 1500); the run in the plan 371 evidence used 50,000.
//!
//! The same seeds feed the JavaScript harness through the Node binding
//! (tests/fuzz/lolly-render-targets.ts at the repo root), which the parser inventory lists.

use std::time::{Duration, Instant};

const SEEDS: &[(&str, &[u8])] = &[
    ("tiny.png", include_bytes!("seeds/tiny.png")),
    ("tiny.jpg", include_bytes!("seeds/tiny.jpg")),
    ("tiny-progressive.jpg", include_bytes!("seeds/tiny-progressive.jpg")),
    ("tiny-lossy.webp", include_bytes!("seeds/tiny-lossy.webp")),
    ("tiny-lossless.webp", include_bytes!("seeds/tiny-lossless.webp")),
    ("tiny-alpha.webp", include_bytes!("seeds/tiny-alpha.webp")),
];

/// The most time one small mutated picture may take to decode or refuse.
const BUDGET: Duration = Duration::from_secs(2);

struct XorShift(u64);
impl XorShift {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: usize) -> usize {
        if n == 0 {
            0
        } else {
            (self.next() % n as u64) as usize
        }
    }
}

fn iterations() -> usize {
    std::env::var("LOLLY_RENDER_FUZZ_ITERS").ok().and_then(|v| v.parse().ok()).unwrap_or(1500)
}

/// One to four of: a byte changed, a run cut, a run inserted, a run copied, a 32-bit field set to an extreme.
fn mutate(seed: &[u8], rng: &mut XorShift) -> Vec<u8> {
    const EXTREMES: [u32; 6] = [0, 1, 0x7fff_ffff, 0xffff_ffff, 0x0001_0000, 0x4000_0000];
    let mut out = seed.to_vec();
    for _ in 0..=rng.below(4) {
        if out.is_empty() {
            out.push(0);
        }
        match rng.below(6) {
            0 => {
                let at = rng.below(out.len());
                out[at] = (rng.next() & 0xff) as u8;
            }
            1 => {
                let at = rng.below(out.len());
                out[at] ^= 1 << rng.below(8);
            }
            2 => {
                let at = rng.below(out.len());
                let len = rng.below(32).min(out.len() - at);
                out.drain(at..at + len);
            }
            3 => {
                let at = rng.below(out.len() + 1);
                let run: Vec<u8> = (0..rng.below(32)).map(|_| (rng.next() & 0xff) as u8).collect();
                out.splice(at..at, run);
            }
            4 => {
                let from = rng.below(out.len());
                let len = rng.below(64).min(out.len() - from);
                let piece = out[from..from + len].to_vec();
                let at = rng.below(out.len() + 1);
                out.splice(at..at, piece);
            }
            _ => {
                if out.len() >= 4 {
                    let at = rng.below(out.len() - 3);
                    let value = EXTREMES[rng.below(EXTREMES.len())];
                    let bytes = if rng.below(2) == 0 { value.to_be_bytes() } else { value.to_le_bytes() };
                    out[at..at + 4].copy_from_slice(&bytes);
                }
            }
        }
    }
    out
}

#[test]
fn every_seed_decodes() {
    for (name, bytes) in SEEDS {
        let decoded = lolly_render::picture::decode(bytes).unwrap_or_else(|r| panic!("{name}: {} {}", r.code, r.detail));
        assert_eq!((decoded.width, decoded.height), (16, 12), "{name}");
        assert_eq!(decoded.rgba.len(), 16 * 12 * 4, "{name}");
    }
}

#[test]
fn mutated_pictures_decode_or_refuse_promptly() {
    let iters = iterations();
    for (index, (name, seed)) in SEEDS.iter().enumerate() {
        let mut rng = XorShift(0x2545_f491_4f6c_dd1d ^ ((index as u64 + 1) * 0x9e37_79b9));
        let (mut decoded, mut refused) = (0usize, std::collections::BTreeMap::<&str, usize>::new());
        for iter in 0..iters {
            let bytes = mutate(seed, &mut rng);
            let started = Instant::now();
            match lolly_render::picture::decode(&bytes) {
                Ok(picture) => {
                    assert!(picture.width >= 1 && picture.height >= 1, "{name} #{iter}: an empty picture");
                    assert!(
                        picture.width <= lolly_render::picture::MAX_PICTURE_SIDE
                            && picture.height <= lolly_render::picture::MAX_PICTURE_SIDE
                    );
                    assert_eq!(picture.rgba.len(), picture.width as usize * picture.height as usize * 4, "{name} #{iter}");
                    decoded += 1;
                }
                Err(refusal) => {
                    assert!(lolly_render::REFUSAL_CODES.contains(&refusal.code), "{name} #{iter}: {} is not a listed code", refusal.code);
                    *refused.entry(refusal.code).or_default() += 1;
                }
            }
            assert!(started.elapsed() < BUDGET, "{name} #{iter}: {} bytes took {:?}", bytes.len(), started.elapsed());
        }
        eprintln!("{name}: {iters} mutations, {decoded} decoded, refused {refused:?}");
    }
}

/// The page every picture fuzz case is placed on: one image box filling a 64 x 48 frame.
fn page_with(bytes: &[u8], declared: &str) -> Vec<u8> {
    let page = serde_json::json!({
        "format": "lolly-render-input", "version": 1, "drawVersion": 0,
        "output": { "width": 64, "height": 48, "dpi": 96 },
        "page": {
            "version": 0, "width": 64, "height": 48, "background": "#ffffff", "findings": [],
            "frame": { "id": "f", "box": { "x": 0, "y": 0, "w": 64, "h": 48 }, "opacity": 100, "op": "shape", "shape": { "kind": "rect", "radius": 0 }, "fills": [{ "kind": "color", "color": "#ffffff" }] },
            "ops": [{ "id": "pic", "box": { "x": 4, "y": 4, "w": 56, "h": 40 }, "opacity": 100, "op": "shape",
                "shape": { "kind": "rect", "radius": 0 }, "fills": [],
                "picture": { "ref": "p", "fit": "cover", "x": 50, "y": 50, "zoom": 1,
                    "area": { "x": 4, "y": 4, "w": 56, "h": 40 },
                    "element": { "box": { "x": 4, "y": 4, "w": 56, "h": 40 }, "shape": { "kind": "rect", "radius": 0 } },
                    "clip": { "box": { "x": 4, "y": 4, "w": 56, "h": 40 }, "shape": { "kind": "rect", "radius": 0 } },
                    "label": "Picture not available here", "natural": { "width": 16, "height": 12 } } }]
        },
        "resources": [{ "ref": "p", "type": declared, "data": base64(bytes) }]
    });
    serde_json::to_vec(&page).unwrap()
}

fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (chunk[0] as u32) << 16 | (*chunk.get(1).unwrap_or(&0) as u32) << 8 | *chunk.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(ALPHABET[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

#[test]
fn the_picture_page_draws_each_seed() {
    for (name, bytes) in SEEDS {
        let declared = if name.ends_with(".png") {
            "image/png"
        } else if name.ends_with(".jpg") {
            "image/jpeg"
        } else {
            "image/webp"
        };
        let drawn = lolly_render::render_png(&page_with(bytes, declared));
        assert!(drawn.is_ok(), "{name}: {:?}", drawn.err().map(|r| r.iter().map(|r| r.code).collect::<Vec<_>>()));
    }
}

#[test]
fn mutated_pictures_on_a_page_are_drawn_or_refused() {
    let iters = iterations() / 5;
    let mut rng = XorShift(0x853c_49e6_748f_ea9b);
    for (name, seed) in SEEDS {
        for iter in 0..iters {
            let bytes = mutate(seed, &mut rng);
            let started = Instant::now();
            match lolly_render::render_png(&page_with(&bytes, "image/png")) {
                Ok(png) => assert_eq!(&png[1..4], b"PNG", "{name} #{iter}"),
                Err(refusals) => assert!(refusals.iter().all(|r| lolly_render::REFUSAL_CODES.contains(&r.code)), "{name} #{iter}"),
            }
            assert!(started.elapsed() < BUDGET, "{name} #{iter}: took {:?}", started.elapsed());
        }
    }
}
