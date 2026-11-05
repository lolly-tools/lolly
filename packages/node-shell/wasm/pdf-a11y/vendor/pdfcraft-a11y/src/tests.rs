use std::sync::Arc;

use pdfcraft_cos::{Document, Object};

use super::*;

/// A PDF from object bodies (object n = bodies[n - 1]) and extra trailer entries.
fn pdf(bodies: &[String], trailer: &str) -> Document {
    let mut out = b"%PDF-1.7\n".to_vec();
    let mut offsets = Vec::new();
    for (i, b) in bodies.iter().enumerate() {
        offsets.push(out.len());
        out.extend_from_slice(format!("{} 0 obj\n{b}\nendobj\n", i + 1).as_bytes());
    }
    let xref = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", bodies.len() + 1).as_bytes());
    for o in offsets {
        out.extend_from_slice(format!("{o:010} 00000 n \n").as_bytes());
    }
    out.extend_from_slice(format!("trailer << /Size {} /Root 1 0 R {trailer} >>\nstartxref\n{xref}\n%%EOF\n", bodies.len() + 1).as_bytes());
    Document::open(Arc::new(out)).unwrap()
}

fn stream(data: &str) -> String {
    format!("<< /Length {} >>\nstream\n{data}\nendstream", data.len())
}

fn status(r: &Report, rule: Rule) -> Status {
    r.result(rule).unwrap().status
}

fn failed(r: &Report) -> Vec<Rule> {
    r.results.iter().filter(|x| x.status == Status::Failed).map(|x| x.rule).collect()
}

const FONT: &str = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";






#[test]
fn an_untagged_document_fails_the_document_rules() {
    let doc = pdf(
        &[
            "<< /Type /Catalog /Pages 2 0 R >>".into(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".into(),
            stream("BT /F1 12 Tf 20 100 Td (Hello) Tj ET 0 0 50 50 re f"),
            FONT.into(),
        ],
        "",
    );
    let r = check(&doc, &Options::default());
    assert_eq!(r.results.len(), 32);
    assert_eq!(failed(&r), [Rule::TaggedPdf, Rule::PrimaryLanguage, Rule::Title, Rule::TaggedContent]);
    assert_eq!(status(&r, Rule::ColorContrast), Status::Skipped, "off by default");
    assert_eq!(status(&r, Rule::LogicalReadingOrder), Status::Manual);
    assert_eq!(status(&r, Rule::ImageOnly), Status::Passed);
    assert_eq!(r.result(Rule::TaggedPdf).unwrap().findings.len(), 2);
    // Only the chosen rules run.
    let only = check(&doc, &Options { rules: [Rule::Title].into(), pages: None });
    assert_eq!((only.count(Status::Failed), only.count(Status::Skipped)), (1, 31));
}

/// `/MarkInfo /Marked` may be written as an indirect reference, like any value. The rule read the
/// reference itself and so reported a tagged document as untagged (#3671).
#[test]
fn marked_as_an_indirect_reference_still_counts_as_tagged() {
    let mut bodies = good();
    // The catalog is object 1; point /Marked at a new object holding `true`.
    let last = bodies.len() + 1;
    bodies[0] = bodies[0].replace("/MarkInfo << /Marked true >>", &format!("/MarkInfo << /Marked {last} 0 R >>"));
    bodies.push("true".into());
    let doc = pdf(&bodies, "");
    let report = check(&doc, &Options { rules: [Rule::TaggedPdf].into(), pages: None });
    assert_eq!(status(&report, Rule::TaggedPdf), Status::Passed, "{:?}", failed(&report));

    // A reference to a reference is followed too: the render inspector follows chains, so the
    // two readers of the flag would otherwise disagree about one file.
    let mut chain = good();
    let first = chain.len() + 1;
    chain[0] = chain[0].replace("/MarkInfo << /Marked true >>", &format!("/MarkInfo << /Marked {first} 0 R >>"));
    chain.push(format!("{} 0 R", first + 1));
    chain.push("true".into());
    let report = check(&pdf(&chain, ""), &Options { rules: [Rule::TaggedPdf].into(), pages: None });
    assert_eq!(status(&report, Rule::TaggedPdf), Status::Passed, "{:?}", failed(&report));

    // A reference that points at itself is no value, not a hang.
    let mut loops = good();
    let at = loops.len() + 1;
    loops[0] = loops[0].replace("/MarkInfo << /Marked true >>", &format!("/MarkInfo << /Marked {at} 0 R >>"));
    loops.push(format!("{at} 0 R"));
    let report = check(&pdf(&loops, ""), &Options { rules: [Rule::TaggedPdf].into(), pages: None });
    assert_eq!(status(&report, Rule::TaggedPdf), Status::Failed);

    // The direct form is unchanged, and a document with no flag at all still fails.
    assert_eq!(status(&check(&pdf(&good(), ""), &Options { rules: [Rule::TaggedPdf].into(), pages: None }), Rule::TaggedPdf), Status::Passed);
    let mut none = good();
    none[0] = none[0].replace("/MarkInfo << /Marked true >>", "");
    assert_eq!(status(&check(&pdf(&none, ""), &Options { rules: [Rule::TaggedPdf].into(), pages: None }), Rule::TaggedPdf), Status::Failed);
}

/// A tagged document that passes every automatic rule.
fn good() -> Vec<String> {
    vec![
        // 1 catalog, 2 pages, 3 page, 4 content, 5 font
        "<< /Type /Catalog /Pages 2 0 R /Lang (en-US) /MarkInfo << /Marked true >> /StructTreeRoot 6 0 R /ViewerPreferences << /DisplayDocTitle true >> >>".into(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Tabs /S /Annots [9 0 R 10 0 R] /StructParents 0 \
         /Resources << /Font << /F1 5 0 R >> /XObject << /Im 11 0 R >> >> >>"
            .into(),
        stream(
            "/H1 << /MCID 0 >> BDC BT /F1 12 Tf 20 180 Td (Title) Tj ET EMC \
             /Figure << /MCID 1 >> BDC q 10 0 0 10 20 120 cm /Im Do Q EMC \
             /Artifact BMC 0 0 200 2 re f EMC \
             /TH << /MCID 2 >> BDC BT (A) Tj ET EMC /TH << /MCID 3 >> BDC BT (B) Tj ET EMC \
             /TD << /MCID 4 >> BDC BT (1) Tj ET EMC /TD << /MCID 5 >> BDC BT (2) Tj ET EMC \
             /Lbl << /MCID 6 >> BDC BT (1.) Tj ET EMC /LBody << /MCID 7 >> BDC BT (Item) Tj ET EMC",
        ),
        FONT.into(),
        // 6 struct tree root, 7 Document element, 8 info
        "<< /Type /StructTreeRoot /K 7 0 R /RoleMap << /Heading1 /H1 >> >>".into(),
        "<< /S /Document /P 6 0 R /Pg 3 0 R /K [\
         << /S /Heading1 /Pg 3 0 R /K 0 >> \
         << /S /Figure /Pg 3 0 R /Alt (A red square) /K 1 >> \
         << /S /Table /Pg 3 0 R /A << /O /Table /Summary (Two columns) >> /K [\
            << /S /TR /K [ << /S /TH /K 2 >> << /S /TH /K 3 >> ] >> \
            << /S /TR /K [ << /S /TD /K 4 >> << /S /TD /K 5 >> ] >> ] >> \
         << /S /L /K [ << /S /LI /K [ << /S /Lbl /K 6 >> << /S /LBody /K 7 >> ] >> ] >> \
         << /S /Link /K << /Type /OBJR /Obj 9 0 R >> >> \
         << /S /Form /K << /Type /OBJR /Obj 10 0 R >> >> ] >>"
            .into(),
        "<< /Title (Quarterly report) >>".into(),
        // 9 link, 10 field, 11 image
        "<< /Type /Annot /Subtype /Link /Rect [20 20 80 40] /StructParent 1 >>".into(),
        "<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /TU (Your name) /Rect [20 60 120 80] /StructParent 2 >>".into(),
        "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\u{0}\nendstream"
            .into(),
    ]
}

#[test]
fn a_well_tagged_document_passes() {
    let doc = pdf(&good(), "/Info 8 0 R");
    let r = check(&doc, &Options::default());
    assert!(failed(&r).is_empty(), "{:?}", r.results.iter().filter(|x| x.status == Status::Failed).collect::<Vec<_>>());
    assert_eq!((r.count(Status::Manual), r.count(Status::Skipped), r.count(Status::Passed)), (5, 1, 26));
}

#[test]
fn structure_problems_are_found() {
    let mut objs = good();
    objs[6] = "<< /S /Document /P 6 0 R /Pg 3 0 R /K [\
         << /S /H1 /K 0 >> << /S /H3 /K 2 >> \
         << /S /Figure /K 1 >> \
         << /S /Sect /Alt (Outer) /K [ << /S /P /Alt (Inner) /K 3 >> ] >> \
         << /S /Div /Alt (Nothing) >> \
         << /S /P /Alt (Over a link) /K << /Type /OBJR /Obj 9 0 R >> >> \
         << /S /Formula /K 4 >> \
         << /S /Table /K [ << /S /TR /K [ << /S /TD /K 5 >> << /S /TD >> ] >> << /S /TR /K [ << /S /TD /K 6 >> ] >> ] >> \
         << /S /TD /K 7 >> << /S /LI >> << /S /LBody >> << /S /TR >> ] >>"
        .into();
    let doc = pdf(&objs, "/Info 8 0 R");
    let r = check(&doc, &Options::default());
    let mut want = vec![
        Rule::FiguresAltText,
        Rule::NestedAltText,
        Rule::AltTextAssociated,
        Rule::AltTextHidesAnnotation,
        Rule::OtherElementsAltText,
        Rule::TableRows,
        Rule::TableCells,
        Rule::TableHeaders,
        Rule::TableRegularity,
        Rule::TableSummary,
        Rule::ListItems,
        Rule::LblLBody,
        Rule::HeadingNesting,
    ];
    want.sort();
    let mut got = failed(&r);
    got.sort();
    assert_eq!(got, want);
    let h = &r.result(Rule::HeadingNesting).unwrap().findings[0].message;
    assert!(h.contains("H3") && h.contains("H1"), "{h}");
    assert!(r.result(Rule::TableRegularity).unwrap().findings[0].message.contains("between 1 and 2"));
}

#[test]
fn row_and_column_spans_keep_a_table_regular() {
    let mut objs = good();
    // Row 1: a cell spanning two rows and one spanning two columns; row 2 then has one cell.
    objs[6] = "<< /S /Document /P 6 0 R /K [ << /S /Table /A << /O /Table /Summary (s) >> /K [\
         << /S /TR /K [ << /S /TH /A << /O /Table /RowSpan 2 >> /K 0 >> << /S /TH /A [ << /O /Table /ColSpan 2 >> ] /K 1 >> ] >> \
         << /S /TR /K [ << /S /TD /K 2 >> << /S /TD /K 3 >> ] >> ] >> ] >>"
        .into();
    let r = check(&pdf(&objs, "/Info 8 0 R"), &Options { rules: [Rule::TableRegularity].into(), pages: None });
    assert_eq!(status(&r, Rule::TableRegularity), Status::Passed, "{:?}", r.result(Rule::TableRegularity));
}

/// A tagged document whose structure tree is the Document element `document` (object 3).
fn structure_doc(objects: &[String]) -> Document {
    let mut objs = vec!["<< /Type /Catalog /StructTreeRoot 2 0 R >>".to_string(), "<< /Type /StructTreeRoot /K 3 0 R >>".to_string()];
    objs.extend_from_slice(objects);
    pdf(&objs, "")
}









fn checked(doc: &Document, rules: &[Rule]) -> Report {
    check(doc, &Options { rules: rules.iter().copied().collect(), pages: None })
}

#[test]
fn figures_and_tables_past_the_old_element_cut_off_are_checked() {
    // Five thousand paragraphs, then a figure without alternate text and a table whose second row
    // is narrower than its first.
    let mut kids = vec!["<< /S /P >>".to_string(); 5_000];
    kids.push("<< /S /Figure >>".into());
    kids.push(
        "<< /S /Table /A << /O /Table /Summary (s) >> /K [ << /S /TR /K [ << /S /TD >> << /S /TD >> ] >> << /S /TR /K [ << /S /TD >> ] >> ] >>"
            .into(),
    );
    let doc = structure_doc(&[format!("<< /S /Document /K [{}] >>", kids.join(" "))]);
    let r = checked(&doc, &[Rule::FiguresAltText, Rule::TableRegularity]);
    assert_eq!(r.result(Rule::FiguresAltText).unwrap().findings.len(), 1);
    assert!(r.result(Rule::TableRegularity).unwrap().findings[0].message.contains("between 1 and 2"));
}

#[test]
fn findings_are_listed_in_document_order_not_in_the_order_they_close() {
    // Each element has alternate text but no content. The outer ones close last.
    let doc = structure_doc(&["<< /S /Document /K [ << /S /Sect /Alt (a) /K [ << /S /P /Alt (b) /K [ << /S /Div /Alt (c) >> ] >> ] >> ] >>".into()]);
    let r = checked(&doc, &[Rule::AltTextAssociated]);
    let kinds: Vec<&str> = r.result(Rule::AltTextAssociated).unwrap().findings.iter().map(|f| f.message.split(' ').next().unwrap_or("")).collect();
    assert_eq!(kinds, ["Sect", "P", "Div"]);
}

#[test]
fn a_rule_lists_its_first_findings_and_counts_the_rest() {
    let figures = vec!["<< /S /Figure >>".to_string(); 300].join(" ");
    let doc = structure_doc(&[format!("<< /S /Document /K [{figures}] >>")]);
    let r = checked(&doc, &[Rule::FiguresAltText]);
    let found = &r.result(Rule::FiguresAltText).unwrap().findings;
    assert_eq!(found.len(), 201);
    assert_eq!(found[200].message, "… and 100 more");
    assert!(found[..200].iter().all(|f| f.message == "Figure element: no alternate text"));
}

#[test]
fn cycles_shared_kids_and_missing_kids_are_read_once() {
    // Object 4 holds itself, a figure twice, and a missing object is listed too.
    let doc = structure_doc(&[
        "<< /S /Document /K [4 0 R 4 0 R 99 0 R] >>".into(),
        "<< /S /Sect /K [4 0 R 5 0 R 5 0 R] >>".into(),
        "<< /S /Figure >>".into(),
    ]);
    let r = checked(&doc, &[Rule::FiguresAltText]);
    assert_eq!(r.result(Rule::FiguresAltText).unwrap().findings.len(), 1);
}

#[test]
fn structure_findings_identify_indirect_elements_without_guessing_inline_objects() {
    let doc = structure_doc(&["<< /S /Document /K [4 0 R << /S /Figure >>] >>".into(), "<< /S /Figure >>".into()]);
    let r = checked(&doc, &[Rule::FiguresAltText]);
    let found = &r.result(Rule::FiguresAltText).unwrap().findings;
    assert_eq!(found.len(), 2);
    assert_eq!(found[0].object.map(|r| r.num), Some(4));
    assert_eq!(found[1].object, None);
}

#[test]
fn nesting_is_read_to_the_depth_limit_and_no_further() {
    // Sections, each the kid of the one before, ending in a figure without alternate text. The
    // figure is at depth `sections`; the walk reads depths up to 256.
    let figure_within = |sections: usize| {
        let mut objs: Vec<String> = (0..sections).map(|i| format!("<< /S /Sect /K {} 0 R >>", 4 + i)).collect();
        objs.push("<< /S /Figure >>".into());
        let r = checked(&structure_doc(&objs), &[Rule::FiguresAltText]);
        r.result(Rule::FiguresAltText).unwrap().findings.len()
    };
    assert_eq!(figure_within(250), 1, "within the depth limit");
    assert_eq!(figure_within(300), 0, "past the depth limit");
}

#[test]
fn arrays_nested_deeper_than_the_limit_are_not_read() {
    let nested = |n: usize| format!("<< /S /Document /K {}<< /S /Figure >>{} >>", "[".repeat(n), "]".repeat(n));
    let shallow = checked(&structure_doc(&[nested(100)]), &[Rule::FiguresAltText]);
    assert_eq!(shallow.result(Rule::FiguresAltText).unwrap().findings.len(), 1);
    let deep = checked(&structure_doc(&[nested(300)]), &[Rule::FiguresAltText]);
    assert_eq!(deep.result(Rule::FiguresAltText).unwrap().findings.len(), 0);
}

#[test]
fn a_long_list_of_marked_content_counts_as_content() {
    // The first paragraph holds 20,000 marked-content items, so its alternate text has content.
    let items = (0..20_000).map(|i| i.to_string()).collect::<Vec<_>>().join(" ");
    let doc = structure_doc(&[format!("<< /S /Document /K [ << /S /P /Alt (a) /K [{items}] >> << /S /P /Alt (b) >> ] >>")]);
    let r = checked(&doc, &[Rule::AltTextAssociated]);
    assert_eq!(r.result(Rule::AltTextAssociated).unwrap().findings.len(), 1);
}

#[test]
fn huge_spans_do_not_size_the_table() {
    // A row of 2,000 cells, each spanning 10,000 columns, then a row of one cell.
    let wide = vec!["<< /S /TD /A << /O /Table /ColSpan 10000 >> >>".to_string(); 2_000].join(" ");
    let doc = structure_doc(&[format!(
        "<< /S /Document /K [ << /S /Table /A << /O /Table /Summary (s) >> /K [ << /S /TR /K [{wide}] >> << /S /TR /K [ << /S /TD >> ] >> ] >> ] >>"
    )]);
    let r = checked(&doc, &[Rule::TableRegularity]);
    let found = &r.result(Rule::TableRegularity).unwrap().findings;
    assert_eq!(found[0].message, "Table element: rows have between 1 and 20000000 columns");
}

#[test]
fn row_spans_carry_past_their_row() {
    // Row 1: 3,000 cells, each spanning 10,000 rows. Row 2: 3,000 cells, which start after them.
    let row1 = vec!["<< /S /TD /A << /O /Table /RowSpan 10000 >> >>".to_string(); 3_000].join(" ");
    let row2 = vec!["<< /S /TD >>".to_string(); 3_000].join(" ");
    let doc = structure_doc(&[format!(
        "<< /S /Document /K [ << /S /Table /A << /O /Table /Summary (s) >> /K [ << /S /TR /K [{row1}] >> << /S /TR /K [{row2}] >> ] >> ] >>"
    )]);
    let r = checked(&doc, &[Rule::TableRegularity]);
    let found = &r.result(Rule::TableRegularity).unwrap().findings;
    assert_eq!(found[0].message, "Table element: rows have between 3000 and 6000 columns");
}

#[test]
fn spans_that_are_not_positive_integers_read_as_one() {
    // ColSpan -3 and 0 read as 1, and 2.0 reads as 2; the first row is 4 columns wide, the second 5.
    let doc = structure_doc(&[
        "<< /S /Document /K [ << /S /Table /A << /O /Table /Summary (s) >> /K [ \
         << /S /TR /K [ << /S /TD /A << /O /Table /ColSpan -3 >> >> << /S /TD /A << /O /Table /ColSpan 0 >> >> << /S /TD /A << /O /Table /ColSpan 2.0 >> >> ] >> \
         << /S /TR /K [ << /S /TD >> << /S /TD >> << /S /TD >> << /S /TD >> << /S /TD >> ] >> ] >> ] >>"
            .into(),
    ]);
    let r = checked(&doc, &[Rule::TableRegularity]);
    assert_eq!(r.result(Rule::TableRegularity).unwrap().findings[0].message, "Table element: rows have between 4 and 5 columns");
}

#[test]
fn page_content_and_annotation_problems_are_found() {
    let mut objs = good();
    // Untagged text, no tab order, an untagged link and a field without a tooltip.
    objs[2] = objs[2].replace("/Tabs /S ", "");
    objs[3] = stream("BT /F1 12 Tf (stray) Tj ET /P << /MCID 0 >> BDC BT (ok) Tj ET EMC");
    objs[8] = "<< /Type /Annot /Subtype /Link /Rect [20 20 80 40] >>".into();
    objs[9] = "<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /Rect [20 60 120 80] /StructParent 2 >>".into();
    let r = check(&pdf(&objs, "/Info 8 0 R"), &Options::default());
    let mut got = failed(&r);
    got.sort();
    assert_eq!(got, [Rule::TaggedContent, Rule::TaggedAnnotations, Rule::TabOrder, Rule::FieldDescriptions]);
    assert_eq!(r.result(Rule::TaggedContent).unwrap().findings[0].message, "Page 1: 1 untagged content item");
    assert!(r.result(Rule::FieldDescriptions).unwrap().findings[0].message.contains("\"name\""));
    assert_eq!(r.result(Rule::TaggedAnnotations).unwrap().findings[0].bbox, Some([20.0, 20.0, 80.0, 40.0]));
    assert_eq!(r.result(Rule::FieldDescriptions).unwrap().findings[0].bbox, Some([20.0, 60.0, 120.0, 80.0]));
}

#[test]
fn annotation_findings_only_locate_valid_rectangles() {
    let cases = [("[80 40 20 20]", Some([20.0, 20.0, 80.0, 40.0])), ("[20 20 20 40]", None), ("[20 20 80]", None), ("[20 20 80 (bad)]", None)];
    for (rect, expected) in cases {
        let mut objs = good();
        objs[8] = format!("<< /Type /Annot /Subtype /Link /Rect {rect} >>");
        let r = checked(&pdf(&objs, "/Info 8 0 R"), &[Rule::TaggedAnnotations]);
        assert_eq!(r.result(Rule::TaggedAnnotations).unwrap().findings[0].bbox, expected, "{rect}");
    }
}

#[test]
fn scans_identity_fonts_and_long_documents() {
    // An image-only page.
    let doc = pdf(
        &[
            "<< /Type /Catalog /Pages 2 0 R >>".into(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /XObject << /Im 5 0 R >> >> >>".into(),
            stream("q 200 0 0 200 0 0 cm /Im Do Q"),
            "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\u{0}\nendstream"
                .into(),
        ],
        "",
    );
    assert_eq!(status(&check(&doc, &Options::default()), Rule::ImageOnly), Status::Failed);
    // An Identity-H font without ToUnicode; 21 pages without bookmarks.
    let mut objs = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        format!("<< /Type /Pages /Kids [{}] /Count 21 >>", (0..21).map(|i| format!("{} 0 R", 6 + i)).collect::<Vec<_>>().join(" ")),
        stream("BT /F1 12 Tf <0001> Tj ET"),
        "<< /Type /Font /Subtype /Type0 /BaseFont /Custom /Encoding /Identity-H /DescendantFonts [5 0 R] >>".into(),
        "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Custom /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>".into(),
    ];
    for _ in 0..21 {
        objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 3 0 R /Resources << /Font << /F1 4 0 R >> >> >>".into());
    }
    let r = check(&pdf(&objs, ""), &Options::default());
    assert_eq!(status(&r, Rule::Bookmarks), Status::Failed);
    let enc = r.result(Rule::CharacterEncoding).unwrap();
    assert_eq!((enc.status, enc.findings.len()), (Status::Failed, 1), "each font once");
    assert!(enc.findings[0].message.contains("Custom"));
    // A page range limits the page rules.
    let some = check(&pdf(&objs, ""), &Options { pages: Some(vec![3]), ..Options::default() });
    assert_eq!(some.result(Rule::CharacterEncoding).unwrap().findings[0].page, Some(3));
}

fn cid_encoding_pdf(encoding: &str, system: &str, to_unicode: bool) -> Document {
    let unicode = if to_unicode { "/ToUnicode 7 0 R" } else { "" };
    pdf(
        &[
            "<< /Type /Catalog /Pages 2 0 R /MarkInfo << /Marked true >> >>".into(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".into(),
            stream("/P << /MCID 0 >> BDC BT /F1 12 Tf <002200230024> Tj ET EMC"),
            format!("<< /Type /Font /Subtype /Type0 /BaseFont /SyntheticCID /Encoding {encoding} /DescendantFonts [6 0 R] {unicode} >>"),
            format!("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /SyntheticCID /CIDSystemInfo {system} >>"),
            stream(
                "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /SyntheticUnicode def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange 3 beginbfchar <0022> <0041> <0023> <0042> <0024> <0043> endbfchar endcmap CMapName currentdict /CMap defineresource pop end end",
            ),
        ],
        "",
    )
}

#[test]
fn character_encoding_accepts_identity_cjk_collections() {
    for encoding in ["/Identity-H", "/Identity-V"] {
        for ordering in ["Japan1", "GB1", "CNS1", "Korea1", "KR"] {
            let system = format!("<< /Registry (Adobe) /Ordering ({ordering}) /Supplement 0 >>");
            let doc = cid_encoding_pdf(encoding, &system, false);
            let report = checked(&doc, &[Rule::CharacterEncoding]);
            let result = report.result(Rule::CharacterEncoding).unwrap();
            assert_eq!(result.status, Status::Passed, "{encoding}, Adobe-{ordering}: {:?}", result.findings);
            assert!(result.findings.is_empty());
        }
    }
}

#[test]
fn character_encoding_accepts_predefined_cmaps_without_a_known_collection() {
    // The predefined CMap and the descendant's character collection are alternative routes.
    let system = "<< /Registry (Private) /Ordering (Custom) /Supplement 0 >>";
    for name in [
        "GB-EUC-H",
        "GB-EUC-V",
        "GBK2K-H",
        "GBK2K-V",
        "UniGB-UTF16-H",
        "UniGB-UTF16-V",
        "B5pc-H",
        "B5pc-V",
        "UniCNS-UCS2-H",
        "UniCNS-UCS2-V",
        "83pv-RKSJ-H",
        "90pv-RKSJ-H",
        "90ms-RKSJ-H",
        "90ms-RKSJ-V",
        "H",
        "V",
        "UniJIS-UCS2-HW-H",
        "UniJIS-UCS2-HW-V",
        "KSCpc-EUC-H",
        "KSC-EUC-V",
        "KSCms-UHC-HW-H",
        "KSCms-UHC-HW-V",
        "UniKS-UTF16-H",
        "UniKS-UTF16-V",
        "UniAKR-UTF8-H",
        "UniAKR-UTF16-H",
        "UniAKR-UTF32-H",
    ] {
        let doc = cid_encoding_pdf(&format!("/{name}"), system, false);
        let report = checked(&doc, &[Rule::CharacterEncoding]);
        assert_eq!(status(&report, Rule::CharacterEncoding), Status::Passed, "{name}");
    }
}

#[test]
fn character_encoding_rejects_unknown_cmaps_and_foreign_collections() {
    for encoding in
        ["/Identity-H", "/Identity-V", "/Custom-H", "/UniCustom-UTF16-H", "/UniJIS-UCS2-HW-extra-H", "/83pv-RKSJ-V", "/KSCpc-EUC-V", "null"]
    {
        for system in [
            "<< /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>",
            "<< /Registry (Adobe) /Ordering (Custom) /Supplement 0 >>",
            "<< /Registry (Private) /Ordering (Japan1) /Supplement 0 >>",
            "<< /Registry (adobe) /Ordering (Japan1) /Supplement 0 >>",
            "<< /Ordering (Japan1) /Supplement 0 >>",
            "<< /Registry /Adobe /Ordering /Japan1 /Supplement 0 >>",
            "null",
        ] {
            let doc = cid_encoding_pdf(encoding, system, false);
            let report = checked(&doc, &[Rule::CharacterEncoding]);
            let result = report.result(Rule::CharacterEncoding).unwrap();
            assert_eq!(result.status, Status::Failed, "{encoding}, {system}");
            assert_eq!(result.findings.len(), 1);
            assert_eq!(result.findings[0].page, Some(0));
            assert!(result.findings[0].message.contains("SyntheticCID"));
        }
    }
    let doc = cid_encoding_pdf("/Identity-H", "<< /Registry (Private) /Ordering (Custom) /Supplement 0 >>", true);
    assert_eq!(status(&checked(&doc, &[Rule::CharacterEncoding]), Rule::CharacterEncoding), Status::Passed, "ToUnicode is still sufficient");
}

#[test]
fn character_encoding_resolves_indirect_cid_metadata() {
    use pdfcraft_cos::{Dict, ObjRef, PdfString};
    let mut doc = cid_encoding_pdf("/Identity-H", "null", false);
    let registry = doc.add(Object::String(PdfString::literal(b"Adobe".to_vec())));
    let ordering = doc.add(Object::String(PdfString::literal(b"Japan1".to_vec())));
    let mut system = Dict::new();
    system.set(b"Registry".to_vec(), Object::Ref(registry));
    system.set(b"Ordering".to_vec(), Object::Ref(ordering));
    let system = doc.add(Object::Dict(system));
    doc.update_dict(ObjRef::new(6, 0), |d| d.set(b"CIDSystemInfo".to_vec(), Object::Ref(system))).unwrap();
    let descendants = doc.add(Object::Array(vec![Object::Ref(ObjRef::new(6, 0))]));
    let encoding = doc.add(Object::Name(b"Identity-V".to_vec()));
    doc.update_dict(ObjRef::new(5, 0), |d| {
        d.set(b"DescendantFonts".to_vec(), Object::Ref(descendants));
        d.set(b"Encoding".to_vec(), Object::Ref(encoding));
    })
    .unwrap();
    let report = checked(&doc, &[Rule::CharacterEncoding]);
    assert_eq!(status(&report, Rule::CharacterEncoding), Status::Passed);
}

#[test]
fn rules_have_ids_and_the_report_lists_them() {
    assert_eq!(Rule::ALL.len(), 32);
    for r in Rule::ALL {
        assert_eq!(Rule::from_id(r.id()), Some(r));
    }
    let per: Vec<usize> = Category::ALL.iter().map(|c| Rule::ALL.iter().filter(|r| r.category() == *c).count()).collect();
    assert_eq!(per, [8, 9, 2, 5, 5, 2, 1]);
    let doc = pdf(&good(), "/Info 8 0 R");
    let report = check(&doc, &Options::default());
    let html = report_html(&report, "a<b>.pdf", "2026-10-02", "en", &in_english);
    assert!(html.contains("a&lt;b&gt;.pdf") && html.contains("Accessibility permission flag") && html.contains("Needs manual check: 5"));
    assert!(html.contains("<h3>Headings</h3>"));
    // In another language every word of ours is said in it, down to the `lang`; the file name is the
    // file's own and stays as it is.
    let other = report_html(&report, "a<b>.pdf", "2026-10-02", "es", &|w| format!("«{w}»"));
    assert!(other.contains("<html lang=\"es\">") && other.contains("<h3>«Headings»</h3>") && other.contains("a&lt;b&gt;.pdf"));
    assert!(!other.contains(">Headings<"), "an English heading is left in the report: {other}");
    let manual_only = Report { results: vec![RuleResult { rule: Rule::LogicalReadingOrder, status: Status::Manual, findings: Vec::new() }] };
    let manual_html = report_html(&manual_only, "review.pdf", "2026-10-02", "en", &in_english);
    assert!(manual_html.contains("<p>Needs manual check: 1</p>"));
    assert!(!manual_html.contains("no problems"));
    let all_passed = Report { results: vec![RuleResult { rule: Rule::LogicalReadingOrder, status: Status::Passed, findings: Vec::new() }] };
    let passed_html = report_html(&all_passed, "review.pdf", "2026-10-02", "en", &in_english);
    assert!(passed_html.contains("<p>The checker found no problems in this document.</p>"), "{passed_html}");
}

fn figures_doc() -> Document {
    pdf(
        &[
            "<< /Type /Catalog /Pages 2 0 R /MarkInfo << /Marked true >> /StructTreeRoot 5 0 R >>".into(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /StructParents 0 /Resources << /XObject << /Im 10 0 R >> >> >>"
                .into(),
            stream(
                "/Figure << /MCID 0 >> BDC q 40 0 0 20 10 150 cm /Im Do Q EMC \
                 /Photo << /MCID 1 >> BDC 100 100 50 30 re f EMC",
            ),
            "<< /Type /StructTreeRoot /K 6 0 R /ParentTree 9 0 R /RoleMap << /Photo /Figure >> >>".into(),
            "<< /S /Document /P 5 0 R /K [7 0 R 8 0 R] >>".into(),
            "<< /S /Figure /P 6 0 R /Pg 3 0 R /K 0 >>".into(),
            "<< /S /Photo /P 6 0 R /Pg 3 0 R /Alt (A bar) /K 1 >>".into(),
            "<< /Nums [0 [7 0 R 8 0 R]] >>".into(),
            "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\u{0}\nendstream"
                .into(),
        ],
        "",
    )
}

#[test]
fn figures_are_listed_with_their_alt_text_and_place() {
    let doc = figures_doc();
    let f = figures(&doc);
    assert_eq!(f.len(), 2, "role-mapped Photo counts");
    assert_eq!((f[0].page, f[0].alt.as_deref(), f[0].bbox), (Some(0), None, Some([10.0, 150.0, 50.0, 170.0])));
    assert_eq!((f[1].alt.as_deref(), f[1].bbox), (Some("A bar"), Some([100.0, 100.0, 150.0, 130.0])));
    let report = check(&doc, &Options { rules: [Rule::FiguresAltText].into(), pages: None });
    let finding = &report.result(Rule::FiguresAltText).unwrap().findings[0];
    assert_eq!((finding.object, finding.page, finding.bbox), (Some(f[0].obj), Some(0), f[0].bbox));
}















/// Marked-content stack reads while `f` runs.
fn mark_reads(f: impl FnOnce()) -> usize {
    MARK_READS.with(|c| c.set(0));
    f();
    MARK_READS.with(|c| c.get())
}

/// Page content nesting `depth` unmarked `BMC` blocks around a marked one, with `ops` operators inside.
fn deeply_nested_page(doc: &mut Document, depth: usize, ops: usize) -> pdfcraft_cos::Dict {
    use pdfcraft_cos::{Dict, Stream};
    let mut data = "/Figure << /MCID 0 >> BDC ".to_string();
    data.push_str(&"/X BMC ".repeat(depth));
    data.push_str(&"0 0 1 1 re f ".repeat(ops));
    data.push_str(&"EMC ".repeat(depth + 1));
    let content = doc.add(Stream::flate(Dict::new(), data.as_bytes()));
    [(b"Contents".to_vec(), Object::Ref(content))].into_iter().collect()
}

#[test]
fn figure_bounds_read_the_marked_content_state_in_constant_steps() {
    let mut doc = Document::new_empty();
    let page = deeply_nested_page(&mut doc, 5_000, 5_000);
    // No mark encloses figure 7, so a scan of the stack per operator reads all of it.
    let reads = mark_reads(|| {
        crate::alt::content_bboxes(&doc, &page, &std::collections::HashSet::from([7]));
    });
    assert!(reads <= 4 * 15_000, "{reads} stack reads");
}

#[test]
fn figure_bounds_take_one_pass_over_each_page() {
    let n = 50;
    let content: Vec<String> = (0..n).map(|i| format!("/Figure << /MCID {i} >> BDC {i} 0 1 1 re f EMC")).collect();
    let kids: Vec<String> = (0..n).map(|i| format!("{} 0 R", 6 + i)).collect();
    let mut objs: Vec<String> = vec![
        "<< /Type /Catalog /Pages 2 0 R /StructTreeRoot 5 0 R >>".into(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>".into(),
        stream(&content.join(" ")),
        format!("<< /Type /StructTreeRoot /K [{}] >>", kids.join(" ")),
    ];
    objs.extend((0..n).map(|i| format!("<< /S /Figure /Pg 3 0 R /K {i} >>")));
    let doc = pdf(&objs, "");
    BOUNDS_PASSES.with(|c| c.set(0));
    let f = figures(&doc);
    assert_eq!(BOUNDS_PASSES.with(|c| c.get()), 1, "page passes");
    assert_eq!(f.len(), n);
    assert!(f.iter().enumerate().all(|(i, f)| f.bbox == Some([i as f64, 0.0, i as f64 + 1.0, 1.0])));
}






/// The text of every `"…"` literal with a space in it, outside comments and byte strings.
fn sentences(source: &str) -> Vec<String> {
    let b = source.as_bytes();
    let (mut out, mut i) = (Vec::new(), 0);
    while i < b.len() {
        if b[i] == b'/' && b.get(i + 1) == Some(&b'/') {
            while i < b.len() && b[i] != b'\n' {
                i += 1;
            }
        } else if b[i] == b'"' {
            let byte_string = i > 0 && b[i - 1] == b'b';
            let start = i + 1;
            i = start;
            while i < b.len() && b[i] != b'"' {
                i += if b[i] == b'\\' { 2 } else { 1 };
            }
            // Quotes and backslashes are ASCII, so this never cuts a character in two.
            let text = source.get(start..i.min(b.len())).unwrap_or_default();
            if !byte_string && text.contains(' ') {
                out.push(text.replace("\\\"", "\""));
            }
            i += 1;
        } else {
            i += 1;
        }
    }
    out
}

/// Every sentence the rules can say is listed in `WORDINGS`, so an interface showing the report in
/// another language has something to translate. The two rule files hold no prose of their own, so a
/// literal with a space in it is a sentence a person reads.
#[test]
fn wordings_are_complete() {
    let mut missing = Vec::new();
    for source in [include_str!("content.rs"), include_str!("structure.rs")] {
        for sentence in sentences(source) {
            if !WORDINGS.contains(&sentence.as_str()) {
                missing.push(sentence);
            }
        }
    }
    assert!(missing.is_empty(), "add these to WORDINGS, and a translation of each to every interface: {missing:#?}");
}

/// Every word the report page says of its own is listed in `REPORT_WORDS`, and every word on that
/// list is one the page says: the page hands each over to `words` as a literal, so the two can be
/// read off one another.
#[test]
fn report_words_are_complete() {
    let source = include_str!("report.rs");
    let mut said = Vec::new();
    let mut rest = source;
    while let Some(at) = rest.find("words(\"") {
        rest = &rest[at + 7..];
        let Some(end) = rest.find('"') else { break };
        said.push(&rest[..end]);
        rest = &rest[end..];
    }
    let missing: Vec<&&str> = said.iter().filter(|word| !REPORT_WORDS.contains(word)).collect();
    assert!(missing.is_empty(), "add these to REPORT_WORDS, and a translation of each to every interface: {missing:#?}");
    let unsaid: Vec<&&str> = REPORT_WORDS.iter().filter(|word| !said.contains(word)).collect();
    assert!(unsaid.is_empty(), "REPORT_WORDS lists words the page no longer says: {unsaid:#?}");
}

/// `say` puts the values in, and what it puts in is never read as a hole of its own: a document that
/// names a font `{p}` cannot make a finding say which page it is on.
#[test]
fn say_fills_holes_once() {
    let values = [("{p}", "7".to_string()), ("{}", "{p} {n}".to_string())];
    assert_eq!(
        say("Font {} on page {p} doesn't map its characters to Unicode", &values),
        "Font {p} {n} on page 7 doesn't map its characters to Unicode"
    );
    // A hole with nothing for it, and a brace with nothing closing it, are left as they stand.
    assert_eq!(say("{a} {p} {", &values), "{a} 7 {");
}

/// A finding whose frame holds another wording says the whole thing in English, holes and all
/// filled, and still hands the interface the two wordings to translate.
#[test]
fn a_nested_finding_says_itself() {
    let values = vec![("{min}", "1".to_string()), ("{max}", "2".to_string()), ("{ty}", "Table".to_string()), ("{p}", "3".to_string())];
    let f = Finding::nested(Some(2), "{ty} element on page {p}: {what}", "rows have between {min} and {max} columns", values);
    assert_eq!(f.message, "Table element on page 3: rows have between 1 and 2 columns");
    assert_eq!(f.said(&in_english), f.message, "saying it in English is the message");
    // Both wordings are translated, each on its own, and the document's words are left alone.
    assert_eq!(f.said(&|w: &str| format!("«{w}»")), "«Table element on page 3: «rows have between 1 and 2 columns»»");
}


#[test]
fn repeated_content_references_share_one_decode_budget() {
    use pdfcraft_cos::{Dict, MAX_PAGE_DECODED, Object, Stream};
    let mut doc = Document::new_empty();
    let stream = doc.add(Stream::flate(Dict::new(), &vec![b' '; 1 << 20]));
    let page: Dict = [(b"Contents".to_vec(), Object::Array(vec![Object::Ref(stream); 300]))].into_iter().collect();
    let data = crate::alt::page_content(&doc, &page);
    assert!(data.len() <= MAX_PAGE_DECODED + 300, "{} bytes", data.len());
}


/// Text past the page's decode budget is unread, so a page that shows images and no text so far
/// can't be called image-only, nor its content all tagged.
#[test]
fn content_past_the_decode_budget_needs_a_manual_check() {
    use pdfcraft_cos::{Dict, ObjRef, Object, Stream};
    let mut doc = pdf(
        &[
            "<< /Type /Catalog /Pages 2 0 R >>".into(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".into(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /XObject << /Im 5 0 R >> /Font << /F1 6 0 R >> >> >>"
                .into(),
            stream("/Artifact BMC q 200 0 0 200 0 0 cm /Im Do Q EMC"),
            "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\u{0}\nendstream"
                .into(),
            FONT.into(),
        ],
        "",
    );
    let filler = doc.add(Stream::flate(Dict::new(), &vec![b' '; 1 << 20]));
    let text = doc.add(Stream::from_raw(Dict::new(), b"BT /F1 12 Tf 10 10 Td (Hello) Tj ET".to_vec()));
    let mut contents = vec![Object::Ref(ObjRef::new(4, 0))];
    contents.extend(std::iter::repeat_n(Object::Ref(filler), 256));
    contents.push(Object::Ref(text));
    doc.update_dict(ObjRef::new(3, 0), |p| p.set(b"Contents".to_vec(), Object::Array(contents))).unwrap();
    let report = check(&doc, &Options::default());
    assert_eq!(status(&report, Rule::ImageOnly), Status::Manual);
    assert_eq!(status(&report, Rule::TaggedContent), Status::Manual);
}

