// SPDX-License-Identifier: MPL-2.0
//! The drawn corpus pages, byte for byte.
//!
//! `tests/corpus/` holds the 48 pages of the plan 371 corpus that the crate draws, as the
//! Node host compiled them (profile lolly-demo: the shipped Design templates, the drawing
//! fidelity pages, the GPU parity pages and test fixtures). Their pictures are the CC0
//! sample pictures of the lolly-demo catalog, read from the tree by path (`pictures.json`)
//! and checked by digest rather than copied in. `SHA256SUMS` records the PNG each page draws
//! to on macOS arm64. Any machine that draws a different PNG fails this test, and the
//! failure lists every page that differs.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// SHA-256 (FIPS 180-4), small and plain, so the test needs no hashing crate.
fn sha256(data: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
        0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
        0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
        0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
        0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&((data.len() as u64) * 8).to_be_bytes());
    for block in msg.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (x, y) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *x = x.wrapping_add(y);
        }
    }
    h.iter().map(|v| format!("{v:08x}")).collect()
}

/// Standard base64 with padding, the form the input envelope reads.
fn base64(data: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let n = (chunk[0] as u32) << 16 | (*chunk.get(1).unwrap_or(&0) as u32) << 8 | *chunk.get(2).unwrap_or(&0) as u32;
        for k in 0..4 {
            out.push(if k <= chunk.len() { A[(n >> (18 - 6 * k) & 63) as usize] as char } else { '=' });
        }
    }
    out
}

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

#[test]
fn sha256_and_base64_match_their_references() {
    assert_eq!(sha256(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert_eq!(sha256(b""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert_eq!(base64(b"hello"), "aGVsbG8=");
    assert_eq!(base64(b"hi"), "aGk=");
}

#[test]
fn every_drawn_corpus_page_writes_its_recorded_bytes() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/corpus");
    let sums = std::fs::read_to_string(dir.join("SHA256SUMS")).expect("tests/corpus/SHA256SUMS");
    let pictures: Value = serde_json::from_str(&std::fs::read_to_string(dir.join("pictures.json")).unwrap()).unwrap();
    let mut differ = Vec::new();
    let mut checked = 0;
    for line in sums.lines().filter(|l| !l.trim().is_empty()) {
        let (want, file) = line.split_once("  ").expect("a SHA256SUMS line");
        let name = file.trim_end_matches(".png");
        let mut page: Value = serde_json::from_str(&std::fs::read_to_string(dir.join(format!("{name}.json"))).unwrap()).unwrap();
        if let Some(list) = pictures.get(name).and_then(Value::as_array) {
            let mut resources = Vec::new();
            for p in list {
                let path = root().join(p["path"].as_str().unwrap());
                let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("{name}: cannot read {}: {e}", path.display()));
                assert_eq!(sha256(&bytes), p["sha256"].as_str().unwrap(), "{name}: the picture {} is not the one recorded", path.display());
                resources.push(json!({ "ref": p["ref"], "type": p["type"], "data": base64(&bytes) }));
            }
            page["resources"] = Value::Array(resources);
        }
        let input = serde_json::to_vec(&page).unwrap();
        match lolly_render::render_png(&input) {
            Ok(png) => {
                let got = sha256(&png);
                if got != want {
                    differ.push(format!("{name}: recorded {want}, drew {got}"));
                }
            }
            Err(r) => differ.push(format!("{name}: refused {r:?}")),
        }
        checked += 1;
    }
    assert_eq!(checked, 48, "the corpus holds the 48 drawn pages");
    assert!(differ.is_empty(), "{} of {checked} pages differ from the bytes recorded on macOS arm64:\n{}", differ.len(), differ.join("\n"));
}
