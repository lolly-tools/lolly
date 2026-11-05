//! Smoke tests on the open-licensed sample files listed in
//! `tests/fixtures/manifest.json`. `tools/fetch_fixtures.py` downloads them
//! into the git-ignored `tests/fixtures/files/`. Each test passes without
//! checking anything when that directory is absent.

use std::path::{Path, PathBuf};

use indd::{ByteOrder, Version, read_header};

/// The fixture directory, or `None` (with a note) if it has not been fetched.
fn fixtures() -> Option<PathBuf> {
    // Lolly change: INDD_FIXTURES names a directory fetched by scripts/indd-corpus.ts.
    let root = std::env::var_os("INDD_FIXTURES")
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/files"));
    if root.is_dir() {
        Some(root)
    } else {
        eprintln!(
            "tests/fixtures/files/ not present; skipping \
             (fetch with `python3 -I tools/fetch_fixtures.py`)"
        );
        None
    }
}

#[test]
fn fixture_headers() {
    let Some(root) = fixtures() else {
        return;
    };
    let cases = [
        (
            "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
            ByteOrder::Big,
            3,
            0,
        ),
        ("scml-template/scml.indt", ByteOrder::Little, 7, 5),
        (
            "bootstrap3-template/bootstrap3-indesign-template.indd",
            ByteOrder::Little,
            9,
            2,
        ),
        (
            "lizdenys-minizine/indesign-minizine-template.indd",
            ByteOrder::Little,
            20,
            3,
        ),
        (
            "xmp-toolkit-bluesquare/BlueSquare.indd",
            ByteOrder::Big,
            4,
            0,
        ),
    ];
    for (rel, order, major, minor) in cases {
        let h = read_header(root.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"));
        assert_eq!(&h.kind, b"DOCUMENT", "{rel}");
        assert_eq!(h.byte_order, order, "{rel}");
        assert_eq!(h.version, Version { major, minor }, "{rel}");
    }
}

#[test]
fn rejects_non_indd_file() {
    let Some(root) = fixtures() else {
        return;
    };
    let err = read_header(root.join("opf-neddy-flyer/Neddy_Flyer_HeatherRyan.pdf")).unwrap_err();
    assert!(matches!(err, indd::Error::NotIndd));
}

#[test]
fn fixture_containers() {
    let Some(root) = fixtures() else {
        return;
    };
    for rel in [
        "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
        "scml-template/scml.indt",
        "bootstrap3-template/bootstrap3-indesign-template.indd",
        "lizdenys-minizine/indesign-minizine-template.indd",
        "xmp-toolkit-bluesquare/BlueSquare.indd",
    ] {
        let bytes = std::fs::read(root.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"));
        let c = indd::Container::parse(&bytes).unwrap_or_else(|e| panic!("{rel}: {e}"));
        assert!(c.contig_start() < bytes.len(), "{rel}");
        let xmp = c.xmp().unwrap().unwrap_or_else(|| panic!("{rel}: no XMP"));
        let xmp = String::from_utf8_lossy(xmp);
        assert!(
            xmp.contains("Adobe InDesign"),
            "{rel}: XMP has no InDesign creator"
        );
    }
}

#[test]
fn fixture_objects_read() {
    let Some(root) = fixtures() else {
        return;
    };
    for rel in [
        "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
        "xmp-toolkit-bluesquare/BlueSquare.indd",
        "scml-template/scml.indt",
        "bootstrap3-template/bootstrap3-indesign-template.indd",
        "lizdenys-minizine/indesign-minizine-template.indd",
    ] {
        let bytes = std::fs::read(root.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"));
        let c = indd::Container::parse(&bytes).unwrap();
        let db = c.database().unwrap_or_else(|e| panic!("{rel}: {e}"));
        let mut total = 0;
        for uid in db.uids() {
            total += db.object(uid).unwrap().unwrap().len();
        }
        assert!(total > 0, "{rel}: no object data");
    }
}

#[test]
fn big_endian_fixtures_convert() {
    let Some(root) = fixtures() else {
        return;
    };
    // InDesign 3.0 and 4.0. Neither has an IDML, so check values that can
    // be seen otherwise: the flyer's print PDF shows a letter-size page and
    // these headings; BlueSquare is a letter-size page with one blue square.
    // Fonts, the XML root element and colour names exercise big-endian
    // strings, and the font records of both versions.
    for (rel, expected) in [
        (
            "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
            &[
                "DOMVersion=\"3.0\"",
                "GeometricBounds=\"0 0 792 612\"",
                "<Content>Ned the Narcoleptic</Content>",
                "<Content>The Dream Job!</Content>",
                // A forced line break, as in the PDF.
                "<Content>Neddy Buys\u{2028}a New Pillow</Content>",
                "PostScriptName=\"Times-Roman\"",
                "MarkupTag=\"XMLTag/Root\"",
            ][..],
        ),
        (
            "xmp-toolkit-bluesquare/BlueSquare.indd",
            &[
                "DOMVersion=\"4.0\"",
                "GeometricBounds=\"0 0 792 612\"",
                "<Rectangle Self=\"uad\"",
                "PostScriptName=\"Times-Roman\"",
                "Version=\"5.0d10e1\"",
                "Name=\"C=100 M=90 Y=10 K=0\"",
                "MarkupTag=\"XMLTag/Root\"",
            ][..],
        ),
    ] {
        let bytes = std::fs::read(root.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"));
        let mut out = Vec::new();
        indd::convert_into(&bytes, "test.indd", &mut out).unwrap_or_else(|e| panic!("{rel}: {e}"));
        assert_eq!(&out[..4], b"PK\x03\x04", "{rel}");
        let text = String::from_utf8_lossy(&out);
        for e in expected {
            assert!(text.contains(e), "{rel}: no {e}");
        }
    }
}

#[test]
fn little_endian_fixtures_convert() {
    let Some(root) = fixtures() else {
        return;
    };
    for rel in [
        "scml-template/scml.indt",
        "bootstrap3-template/bootstrap3-indesign-template.indd",
        "lizdenys-minizine/indesign-minizine-template.indd",
    ] {
        let bytes = std::fs::read(root.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"));
        let mut out = Vec::new();
        indd::convert_into(&bytes, "test.indd", &mut out).unwrap_or_else(|e| panic!("{rel}: {e}"));
        assert_eq!(&out[..4], b"PK\x03\x04", "{rel}");
        assert_eq!(&out[30..38], b"mimetype", "{rel}: mimetype must be first");
        let text = String::from_utf8_lossy(&out);
        assert!(text.contains("designmap.xml"), "{rel}");
    }
}

/// Graphics whose file the document does not hold come with InDesign's
/// previews, which the package does not hold either (`docs/format/objects.md`,
/// graphic previews). The flyer has two images and the template one PDF,
/// each placed four times with one preview.
#[test]
fn linked_graphics_come_with_their_previews() {
    let Some(root) = fixtures() else {
        return;
    };
    for (rel, signatures) in [
        (
            "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
            &[&b"\xFF\xD8\xFF"[..], b"MM\0*"][..],
        ),
        (
            "bootstrap3-template/bootstrap3-indesign-template.indd",
            &[&b"II*\0"[..]][..],
        ),
    ] {
        let bytes = std::fs::read(root.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"));
        let c = indd::convert(&bytes, "test.indd").unwrap_or_else(|e| panic!("{rel}: {e}"));
        let text = String::from_utf8_lossy(&c.idml);
        assert_eq!(c.previews.len(), signatures.len(), "{rel}");
        for (p, signature) in c.previews.iter().zip(signatures) {
            assert!(p.data.starts_with(signature), "{rel}");
            assert_eq!(p.graphics.len(), 4, "{rel}");
            for g in &p.graphics {
                assert!(text.contains(&format!(" Self=\"{g}\"")), "{rel}: no {g}");
            }
        }
        // The package is the same as without previews.
        let mut idml = Vec::new();
        indd::convert_into(&bytes, "test.indd", &mut idml).unwrap();
        assert!(idml == c.idml, "{rel}: the previews changed the package");
    }
}

/// The InDesign 7.5 template has character styles whose kind field is
/// followed by a non-zero u16, the imported flag
/// (`docs/format/objects.md`, Styles).
#[test]
fn style_kind_is_a_u16() {
    let Some(root) = fixtures() else {
        return;
    };
    let bytes = std::fs::read(root.join("scml-template/scml.indt")).unwrap();
    let mut out = Vec::new();
    indd::convert_into(&bytes, "test.indd", &mut out).unwrap();
    let text = String::from_utf8_lossy(&out);
    assert!(text.contains(r#"<CharacterStyle Self="CharacterStyle/abbr" Name="abbr" "#));
    // The u16 after the kind is the imported flag.
    assert!(text.contains(r#"Name="abbr" Imported="true""#));
    assert!(!text.contains(r#"<CharacterStyle Self="ParagraphStyle/"#));
}

#[test]
fn audit_accounts_for_every_object() {
    let Some(root) = fixtures() else {
        return;
    };
    for rel in [
        "scml-template/scml.indt",
        "lizdenys-minizine/indesign-minizine-template.indd",
        "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
    ] {
        let bytes = std::fs::read(root.join(rel)).unwrap();
        let a = indd::audit::audit(&bytes, rel).unwrap_or_else(|e| panic!("{rel}: {e}"));
        assert_eq!(a.error, None, "{rel}");
        let c = indd::Container::parse(&bytes).unwrap();
        let db = c.database().unwrap();
        let with_data = db
            .uids()
            .filter(|&u| db.object(u).unwrap().is_some())
            .count();
        let audited: usize = a.classes.values().map(|c| c.objects).sum();
        assert_eq!(audited, with_data, "{rel}");
        // The document object is always read.
        assert!(a.classes[&Some(0xE01)].read > 0, "{rel}");
        // Auditing reports the same warnings as converting.
        let warnings: Vec<String> = indd::convert(&bytes, rel)
            .unwrap()
            .warnings
            .iter()
            .map(ToString::to_string)
            .collect();
        assert_eq!(a.warnings, warnings, "{rel}");
    }
}

/// Big- and little-endian files converted at the same time on several
/// threads give the same packages and warnings as converted one by one:
/// a conversion keeps no global or thread-local state.
#[test]
fn conversions_on_several_threads_are_independent() {
    let Some(root) = fixtures() else {
        return;
    };
    let files: Vec<Vec<u8>> = [
        "opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd",
        "scml-template/scml.indt",
        "xmp-toolkit-bluesquare/BlueSquare.indd",
        "lizdenys-minizine/indesign-minizine-template.indd",
    ]
    .iter()
    .map(|rel| std::fs::read(root.join(rel)).unwrap())
    .collect();
    let one_by_one: Vec<_> = files
        .iter()
        .map(|b| indd::convert(b, "test.indd").unwrap())
        .collect();
    let parallel: Vec<_> = std::thread::scope(|s| {
        let handles: Vec<_> = files
            .iter()
            .map(|b| s.spawn(move || indd::convert(b, "test.indd").unwrap()))
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    for (a, b) in one_by_one.iter().zip(&parallel) {
        assert_eq!(a.idml, b.idml);
        assert_eq!(a.warnings, b.warnings);
    }
}

#[test]
fn results_can_be_sent_between_threads() {
    fn send_sync<T: Send + Sync>() {}
    send_sync::<indd::Conversion>();
    send_sync::<indd::Error>();
}
