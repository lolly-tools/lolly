// SPDX-License-Identifier: MPL-2.0
//! The crate against engine-made pages: what it draws, the bytes it writes, and what it refuses.
//!
//! The fixtures are `DesignDrawPage`s the engine compiled from the drawing fidelity
//! pages and the GPU parity gradient page (tests/helpers/design-fidelity.ts and
//! tests/helpers/design-webgpu-fixture.ts), with their words laid out and outlined
//! by the Node host, in the lolly-render envelope. `pictures` is the pictures fidelity
//! page without its vector picture, its PNG pictures carried as resources.

use serde_json::{json, Value};

const FIXTURES: &[(&str, &str)] = &[
    ("shapes", include_str!("fixtures/shapes.json")),
    ("paths", include_str!("fixtures/paths.json")),
    ("dashes", include_str!("fixtures/dashes.json")),
    ("gradients", include_str!("fixtures/gradients.json")),
    ("underlines", include_str!("fixtures/underlines.json")),
    ("pictures", include_str!("fixtures/pictures.json")),
];

/// FNV-1a over 64 bits: a pin on the exact bytes, not a security measure.
fn fnv1a(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x0100_0000_01b3);
    }
    h
}

/// The PNG bytes each fixture draws to, measured on macOS arm64 and pinned. The build
/// uses no SIMD and no platform float functions, so every machine must write these bytes.
const PINNED: &[(&str, u64)] = &[
    ("shapes", 0x35838686f63985f5),
    ("paths", 0x342dfc2adc7cc6f5),
    ("dashes", 0x82a9456c1bdea88e),
    ("gradients", 0x3c9c15d3a159975f),
    ("underlines", 0xe74acc9aa3eae242),
    ("pictures", 0x7ed2e43123b884af),
];

fn codes(result: Result<Vec<u8>, Vec<lolly_render::Refusal>>) -> Vec<&'static str> {
    match result {
        Ok(_) => vec![],
        Err(refusals) => refusals.iter().map(|r| r.code).collect(),
    }
}

fn with(name: &str, change: impl FnOnce(&mut Value)) -> Vec<u8> {
    let source = FIXTURES.iter().find(|(n, _)| *n == name).unwrap().1;
    let mut v: Value = serde_json::from_str(source).unwrap();
    change(&mut v);
    serde_json::to_vec(&v).unwrap()
}

#[test]
fn every_fixture_is_drawn_and_the_bytes_are_pinned() {
    let mut report = Vec::new();
    let mut moved = Vec::new();
    for (name, source) in FIXTURES {
        let png = lolly_render::render_png(source.as_bytes()).unwrap_or_else(|r| panic!("{name} refused: {r:?}"));
        let again = lolly_render::render_png(source.as_bytes()).unwrap();
        assert_eq!(png, again, "{name}: the same input gave different bytes");
        let hash = fnv1a(&png);
        report.push(format!("(\"{name}\", 0x{hash:016x}),"));
        if PINNED.iter().find(|(n, _)| n == name).map(|p| p.1) != Some(hash) {
            moved.push(*name);
        }
    }
    eprintln!("{}", report.join("\n"));
    assert!(moved.is_empty(), "the PNG bytes moved for {moved:?}; every machine must write the pinned bytes");
}

#[test]
fn the_png_has_the_page_size_and_its_resolution() {
    let png = lolly_render::render_png(FIXTURES[0].1.as_bytes()).unwrap();
    assert_eq!(&png[12..16], b"IHDR");
    assert_eq!(u32::from_be_bytes(png[16..20].try_into().unwrap()), 640);
    assert_eq!(u32::from_be_bytes(png[20..24].try_into().unwrap()), 400);
    assert_eq!(&png[37..41], b"pHYs");
}

#[test]
fn a_larger_output_scales_the_page() {
    let input = with("shapes", |v| v["output"] = json!({ "width": 1280, "height": 800 }));
    let drawn = lolly_render::render_json(&input).unwrap();
    assert_eq!((drawn.width, drawn.height), (1280, 800));
    // The first rectangle's middle is its fill at either size.
    let at = |x: usize, y: usize| &drawn.rgba[(y * 1280 + x) * 4..(y * 1280 + x) * 4 + 4];
    assert_eq!(at(160, 110), &[0xd9, 0x48, 0x0f, 0xff]);
}

#[test]
fn what_this_slice_does_not_draw_is_refused_by_name() {
    let refused = |name: &str, change: fn(&mut Value)| codes(lolly_render::render_png(&with(name, change)));
    assert_eq!(refused("shapes", |v| v["page"]["extra"] = json!(1)), ["input-field"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["glow"] = json!(true)), ["input-field"]);
    assert_eq!(refused("shapes", |v| v["format"] = json!("svg")), ["input-format"]);
    assert_eq!(refused("shapes", |v| v["drawVersion"] = json!(1)), ["draw-version"]);
    assert_eq!(refused("shapes", |v| v["output"]["width"] = json!(0)), ["output-size"]);
    assert_eq!(refused("shapes", |v| v["output"] = json!({ "width": 8192, "height": 8192 })), ["output-size"]);
    assert_eq!(refused("shapes", |v| v["output"]["height"] = json!(200)), ["output-proportions"]);
    assert_eq!(refused("shapes", |v| v["page"]["findings"] = json!([{ "id": "rect", "feature": "fit-text" }])), ["finding"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["op"] = json!("image")), ["preview-op"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["op"] = json!("sparkle")), ["unknown-op"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["shape"]["kind"] = json!("star")), ["unknown-shape"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["fills"][0]["kind"] = json!("conic")), ["unknown-paint"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["fills"][0]["color"] = json!("var(--brand-primary)")), ["colour"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["blend"] = json!("multiply")), ["blend"]);
    assert_eq!(
        refused("shapes", |v| v["page"]["ops"][0]["shadow"] = json!({ "target": "box", "dx": 0, "dy": 4, "blur": 8, "color": "#000000" })),
        ["shadow"]
    );
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["blur"] = json!(4)), ["blur"]);
    assert_eq!(refused("shapes", |v| v["page"]["ops"][0]["shape"]["corners"] = json!([1, 1, 2, 2, 3, 3, 4, 4])), ["corner-radii"]);
    assert_eq!(refused("shapes", |v| v["page"]["frame"]["shape"]["radius"] = json!(24)), ["frame-edge"]);
    let picture = json!({
        "ref": "lolly/logo/primary", "fit": "contain", "x": 50, "y": 50, "zoom": 1,
        "area": { "x": 20, "y": 20, "w": 120, "h": 70 },
        "element": { "box": { "x": 20, "y": 20, "w": 120, "h": 70 }, "shape": { "kind": "rect", "radius": 0 } },
        "label": "Logo"
    });
    assert_eq!(codes(lolly_render::render_png(&with("shapes", |v| v["page"]["ops"][0]["picture"] = picture))), ["picture-missing"]);
    // A vector picture is resvg's to draw; the type is read from the bytes, not the declared type.
    let svg = with("pictures", |v| {
        for r in v["resources"].as_array_mut().unwrap() {
            r["data"] = json!("PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLz4=");
        }
    });
    assert!(codes(lolly_render::render_png(&svg)).iter().all(|c| *c == "picture-vector"));
    let unread = with("pictures", |v| v["resources"][0]["data"] = json!("not base64!"));
    assert!(codes(lolly_render::render_png(&unread)).contains(&"picture-unreadable"));
    // A word the engine could not outline would have to be shaped here, so the page is refused.
    let live = with("underlines", |v| {
        let ops = v["page"]["ops"].as_array_mut().unwrap();
        let op = ops.iter_mut().find(|op| op.get("words").is_some()).unwrap();
        op["words"]["outlines"][0][0] = Value::Null;
    });
    assert_eq!(codes(lolly_render::render_png(&live)), ["live-text"]);
    // Malformed JSON is refused, never partly read.
    let source = FIXTURES[0].1.as_bytes();
    assert_eq!(codes(lolly_render::render_png(&source[..source.len() / 2])), ["input-json"]);
}

#[test]
fn every_refusal_code_is_listed_once() {
    let mut seen = std::collections::HashSet::new();
    for code in lolly_render::REFUSAL_CODES {
        assert!(seen.insert(code), "{code} is listed twice");
        assert!(code.chars().all(|c| c.is_ascii_lowercase() || c == '-'), "{code} is not a lowercase code");
    }
}

/// A small deterministic generator, so the mutation run is the same on every machine.
struct XorShift(u64);
impl XorShift {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n.max(1) as u64) as usize
    }
}

/// Mutated documents never panic: each is admitted and drawn, or refused with reasons.
#[test]
fn mutated_documents_are_drawn_or_refused_without_a_panic() {
    let mut rng = XorShift(0x9e37_79b9_7f4a_7c15);
    let extremes: &[&[u8]] =
        &[b"1e308", b"-1e308", b"0", b"-0", b"1e-320", b"8193", b"4294967296", b"null", b"\"\"", b"[]", b"{}", b"true"];
    let mut drawn = 0usize;
    for (_, source) in FIXTURES {
        let base = source.as_bytes();
        for _ in 0..400 {
            let mut doc = base.to_vec();
            for _ in 0..=rng.below(3) {
                match rng.below(4) {
                    0 => {
                        let at = rng.below(doc.len());
                        doc[at] = (rng.next() & 0xff) as u8;
                    }
                    1 => {
                        let at = rng.below(doc.len());
                        let len = rng.below(16).min(doc.len() - at);
                        doc.drain(at..at + len);
                    }
                    2 => {
                        // Replace a number with an extreme value.
                        let digits: Vec<usize> = doc.iter().enumerate().filter(|(_, c)| c.is_ascii_digit()).map(|(i, _)| i).collect();
                        if let Some(&at) = digits.get(rng.below(digits.len())) {
                            let mut end = at;
                            while end < doc.len() && (doc[end].is_ascii_digit() || doc[end] == b'.') {
                                end += 1;
                            }
                            let value = extremes[rng.below(extremes.len())];
                            doc.splice(at..end, value.iter().copied());
                        }
                    }
                    _ => {
                        let at = rng.below(doc.len());
                        let from = rng.below(doc.len());
                        let len = rng.below(64).min(doc.len() - from);
                        let piece: Vec<u8> = doc[from..from + len].to_vec();
                        doc.splice(at..at, piece);
                    }
                }
            }
            if let Ok(plan) = lolly_render::admit_json(&doc) {
                if (plan.pixel_width as u64) * (plan.pixel_height as u64) <= 1 << 20 {
                    let drawn_page = lolly_render::render_plan(&plan).expect("an admitted plan draws");
                    assert_eq!(drawn_page.rgba.len(), (plan.pixel_width * plan.pixel_height * 4) as usize);
                    drawn += 1;
                }
            }
        }
    }
    assert!(drawn > 0, "some mutations still describe a drawable page");
}
