//! Which rules had something to check (Lolly addition, not in upstream).
//!
//! The checker reports a rule as Passed when it finds nothing wrong, including when there was
//! nothing to look at: the table rules in a file with no tables, the form rules in a file with no
//! fields, every structure rule in an untagged file. Calling that a pass would overstate what was
//! checked, so this lists the rules that did have something to examine.

use std::collections::BTreeSet;

use pdfcraft_cos::{Dict, Document, ObjRef};
use pdfcraft_model::Page;

use crate::content::Scan;
use crate::structure::Seen;
use crate::Rule;

const MULTIMEDIA: &[&[u8]] = &[b"Screen", b"Movie", b"Sound", b"RichMedia", b"3D"];

/// The subtypes of the annotations on a page, popups left out.
fn subtypes(doc: &Document, page: &Page) -> Vec<Vec<u8>> {
    let annots = page.dict.get(b"Annots").map(|a| doc.resolve(a)).and_then(|a| a.as_array().cloned()).unwrap_or_default();
    annots
        .iter()
        .filter_map(|x| x.as_ref().and_then(|r: ObjRef| doc.get(r).as_dict().cloned()))
        .filter_map(|d: Dict| d.name(b"Subtype").map(<[u8]>::to_vec))
        .filter(|s| s.as_slice() != b"Popup")
        .collect()
}

pub(crate) fn rules(doc: &Document, pages: &[Page], list: &[usize], scan: &Scan, tagged: bool, seen: &Seen) -> BTreeSet<Rule> {
    let mut out: BTreeSet<Rule> = [Rule::ImageOnly, Rule::TaggedPdf, Rule::PrimaryLanguage, Rule::Title, Rule::TaggedContent].into_iter().collect();
    if doc.permissions().is_some() {
        out.insert(Rule::PermissionFlag);
    }
    if pages.len() > 20 {
        out.insert(Rule::Bookmarks);
    }
    if scan.fonts.values().any(|f| !f.is_empty()) {
        out.insert(Rule::CharacterEncoding);
    }
    let kinds: Vec<Vec<u8>> = list.iter().filter_map(|&p| pages.get(p)).flat_map(|p| subtypes(doc, p)).collect();
    if !kinds.is_empty() {
        out.insert(Rule::TabOrder);
    }
    if kinds.iter().any(|k| k.as_slice() == b"Widget") {
        out.insert(Rule::TaggedFormFields);
        out.insert(Rule::FieldDescriptions);
    }
    if kinds.iter().any(|k| MULTIMEDIA.contains(&k.as_slice())) {
        out.insert(Rule::TaggedMultimedia);
    }
    if kinds.iter().any(|k| k.as_slice() != b"Widget" && !MULTIMEDIA.contains(&k.as_slice()) && k.as_slice() != b"PrinterMark") {
        out.insert(Rule::TaggedAnnotations);
    }
    if tagged {
        let table = [Rule::TableRows, Rule::TableCells, Rule::TableHeaders, Rule::TableRegularity, Rule::TableSummary];
        let list_rules = [Rule::ListItems, Rule::LblLBody];
        let alt = [Rule::NestedAltText, Rule::AltTextAssociated, Rule::AltTextHidesAnnotation];
        let groups: [(bool, &[Rule]); 6] = [
            (seen.figure, &[Rule::FiguresAltText]),
            (seen.formula, &[Rule::OtherElementsAltText]),
            (seen.alt, &alt),
            (seen.table, &table),
            (seen.list, &list_rules),
            (seen.heading, &[Rule::HeadingNesting]),
        ];
        for (present, rules) in groups {
            if present {
                out.extend(rules.iter().copied());
            }
        }
    }
    // Manual rules are never "applicable" in this sense: a person judges them.
    out
}
