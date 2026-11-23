// SPDX-License-Identifier: MPL-2.0
//! Small malformed inputs, each refused with the code it must give.
//!
//! `tests/malformed/manifest.json` lists each file (the whole input the crate reads),
//! the codes its refusal must hold, first code first, and why the input is malformed.
//! A malformed input that draws, panics or refuses under another code fails the test.

use serde_json::Value;
use std::path::Path;

#[test]
fn every_malformed_input_is_refused_with_its_code() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("malformed");
    let manifest: Value = serde_json::from_slice(&std::fs::read(dir.join("manifest.json")).unwrap()).unwrap();
    let cases = manifest["cases"].as_array().unwrap();
    assert!(cases.len() >= 40, "the corpus keeps its cases");
    let mut wrong = Vec::new();
    for case in cases {
        let file = case["file"].as_str().unwrap();
        let expected: Vec<&str> = case["codes"].as_array().unwrap().iter().map(|c| c.as_str().unwrap()).collect();
        let bytes = std::fs::read(dir.join(file)).unwrap();
        match lolly_render::render_png(&bytes) {
            Ok(_) => wrong.push(format!("{file}: drawn, expected {expected:?}")),
            Err(refusals) => {
                let codes: Vec<&str> = refusals.iter().map(|r| r.code).collect();
                if codes.first() != expected.first() || !expected.iter().all(|c| codes.contains(c)) {
                    wrong.push(format!("{file}: refused {codes:?}, expected {expected:?}"));
                }
                assert!(codes.iter().all(|c| lolly_render::REFUSAL_CODES.contains(c)), "{file}: an unlisted code in {codes:?}");
            }
        }
    }
    assert!(wrong.is_empty(), "{} of {} cases:\n{}", wrong.len(), cases.len(), wrong.join("\n"));
}
