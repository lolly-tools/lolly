//! Page numbering: the pages of each section, page names in the section's
//! number style, and the pages of alternate layouts.
//!
//! Evidence: `docs/format/objects.md` (sections and pages).

use super::*;

/// UIDs of the document pages, in order.
pub(super) fn document_pages(doc: &Document) -> Vec<u32> {
    doc.spreads
        .iter()
        .flat_map(|s| &s.pages)
        .map(|p| p.uid)
        .collect()
}

/// Sections in page order, each with the index of its first page and its
/// length in pages. A section whose first page is not a document page is
/// left out.
pub(super) fn section_ranges(doc: &Document) -> Vec<(&Section, usize, usize)> {
    let pages = document_pages(doc);
    if pages.is_empty() {
        return Vec::new();
    }
    let mut starts: Vec<(usize, &Section)> = doc
        .sections
        .iter()
        .filter_map(|s| match s.page {
            None => Some((0, s)),
            Some(p) => pages.iter().position(|&u| u == p).map(|i| (i, s)),
        })
        .collect();
    starts.sort_by_key(|&(i, _)| i);
    starts.dedup_by_key(|&mut (i, _)| i);
    (0..starts.len())
        .map(|k| {
            let (i, s) = starts[k];
            let end = starts.get(k + 1).map_or(pages.len(), |&(j, _)| j);
            (s, i, end - i)
        })
        .collect()
}

/// The IDML `AlternateLayout` of a section: its name, with `$ID/` before
/// a built-in key.
pub(super) fn alternate_layout_name(s: &Section) -> Option<String> {
    s.alternate_layout.as_ref().map(|(flag, name)| match flag {
        1 => builtin_key(name),
        _ => name.clone(),
    })
}

/// For each section of `section_ranges`, the number of pages from its
/// start to the start of the next alternate layout (a section with a
/// layout name) or the end of the document; and for each document page,
/// the section that starts its alternate layout. See
/// `docs/format/objects.md`, sections.
pub(super) fn alternate_layouts(doc: &Document) -> (Vec<usize>, Vec<u32>) {
    let ranges = section_ranges(doc);
    let total: usize = ranges.iter().map(|&(_, _, n)| n).sum();
    let starts: Vec<(usize, u32)> = ranges
        .iter()
        .filter(|(s, _, _)| alternate_layout_name(s).is_some_and(|n| !n.is_empty() && n != "$ID/"))
        .map(|&(s, i, _)| (i, s.uid))
        .collect();
    let lengths = ranges
        .iter()
        .map(|&(_, i, _)| {
            starts
                .iter()
                .find(|&&(j, _)| j > i)
                .map_or(total, |&(j, _)| j)
                - i
        })
        .collect();
    let first = ranges.first().map(|(s, _, _)| s.uid);
    let pages = (0..total)
        .filter_map(|p| {
            starts
                .iter()
                .rev()
                .find(|&&(j, _)| j <= p)
                .map(|&(_, u)| u)
                .or(first)
        })
        .collect();
    (lengths, pages)
}

/// IDML `PageNumberStyle` of a section's style code.
pub(super) fn number_style(code: u32) -> Option<&'static str> {
    match code {
        numbering::ARABIC => Some("Arabic"),
        numbering::LOWER_ROMAN => Some("LowerRoman"),
        numbering::KANJI => Some("Kanji"),
        numbering::DOUBLE_LEADING_ZEROS => Some("DoubleLeadingZeros"),
        numbering::UPPER_ROMAN => Some("UpperRoman"),
        numbering::LOWER_LETTERS => Some("LowerLetters"),
        numbering::SINGLE_LEADING_ZEROS => Some("SingleLeadingZeros"),
        _ => None,
    }
}

/// Lower-case Roman numeral of `n` (1 or more).
pub(super) fn lower_roman(mut n: u32) -> String {
    const DIGITS: [(u32, &str); 13] = [
        (1000, "m"),
        (900, "cm"),
        (500, "d"),
        (400, "cd"),
        (100, "c"),
        (90, "xc"),
        (50, "l"),
        (40, "xl"),
        (10, "x"),
        (9, "ix"),
        (5, "v"),
        (4, "iv"),
        (1, "i"),
    ];
    let mut out = String::new();
    for (value, digits) in DIGITS {
        while n >= value {
            out.push_str(digits);
            n -= value;
        }
    }
    out
}

fn upper_roman(n: u32) -> String {
    lower_roman(n).to_uppercase()
}

fn single_leading_zeros(n: u32) -> String {
    format!("{n:02}")
}

fn double_leading_zeros(n: u32) -> String {
    format!("{n:03}")
}

/// The letter of `n` from 1 to 26; other numbers as Arabic numbers, as no
/// sample shows them.
fn lower_letter(n: u32) -> String {
    match n {
        1..=26 => char::from(b'a' + (n - 1) as u8).to_string(),
        _ => n.to_string(),
    }
}

/// Chinese numeral of `n`, digit by digit (10 is 一〇), as the folios of
/// a sample with that style show.
pub(super) fn kanji_digits(n: u32) -> String {
    const DIGITS: [char; 10] = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    n.to_string()
        .bytes()
        .map(|b| DIGITS[usize::from(b - b'0')])
        .collect()
}

/// The name of each document page: its number (see `page_numbers`) in
/// its section's style, after the section prefix if the section includes
/// it (objects.md, master spread names and sections).
pub(super) fn page_names(doc: &Document) -> Vec<String> {
    let numbers = page_numbers(doc);
    let mut out: Vec<String> = numbers.iter().map(u32::to_string).collect();
    for (s, first, length) in section_ranges(doc) {
        let name: fn(u32) -> String = match s.style {
            numbering::LOWER_ROMAN => lower_roman,
            numbering::KANJI => kanji_digits,
            numbering::UPPER_ROMAN => upper_roman,
            numbering::SINGLE_LEADING_ZEROS => single_leading_zeros,
            numbering::DOUBLE_LEADING_ZEROS => double_leading_zeros,
            numbering::LOWER_LETTERS => lower_letter,
            _ => |n| n.to_string(),
        };
        for i in (first..first + length).filter(|&i| numbers[i] > 0) {
            out[i] = name(numbers[i]);
            if s.include_prefix {
                out[i].insert_str(0, &s.prefix);
            }
        }
    }
    out
}

/// The section and page number of each document page.
pub(super) fn page_sections(doc: &Document) -> Vec<(Section, u32)> {
    let numbers = page_numbers(doc);
    let mut out = Vec::new();
    for (s, first, length) in section_ranges(doc) {
        for &n in numbers.iter().skip(first).take(length) {
            out.push((s.clone(), n));
        }
    }
    out
}

/// The number shown on each document page, from the sections. The
/// section at the first page starts at its start number even when it
/// continues numbering (from the previous document of a book). Pages
/// not covered by a section are numbered by their position.
pub(super) fn page_numbers(doc: &Document) -> Vec<u32> {
    let count = document_pages(doc).len();
    let mut out: Vec<u32> = (1..=count as u32).collect();
    let mut next: Option<u32> = None;
    for (s, first, length) in section_ranges(doc) {
        let mut number = match next {
            Some(n) if s.continue_numbering => n,
            None if s.continue_numbering && first > 0 => first as u32 + 1,
            _ => s.start,
        };
        for n in out.iter_mut().skip(first).take(length) {
            *n = number;
            number += 1;
        }
        next = Some(number);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_pages_by_section() {
        use crate::model::{Page, Section, Spread, numbering};
        let page = |uid| Page {
            uid,
            bounds: [0.0; 4],
            transform: Matrix::IDENTITY,
            master: None,
            master_transform: Matrix::IDENTITY,
            margins: None,
            columns: None,
            grid: None,
            settings: Default::default(),
        };
        let section = |uid, page, continue_numbering, start| Section {
            uid,
            page,
            continue_numbering,
            include_prefix: false,
            start,
            style: numbering::ARABIC,
            prefix: String::new(),
            marker: String::new(),
            alternate_layout: None,
        };
        let doc = Document {
            spreads: vec![Spread {
                uid: 1,
                master_name: None,
                transform: Matrix::IDENTITY,
                binding_location: 0,
                pages: (10..16).map(page).collect(),
                items: Vec::new(),
                guides: Vec::new(),
                shuffle: None,
                flattener_resolution: None,
                show_master_items: None,
                primary_story: None,
                transition: None,
                timing: Vec::new(),
            }],
            // Listed out of page order, as in some samples.
            sections: vec![
                section(1, None, true, 1),
                section(3, Some(14), true, 9),
                section(2, Some(12), false, 1),
            ],
            ..Document::default()
        };
        assert_eq!(page_numbers(&doc), [1, 2, 1, 2, 3, 4]);
        let ranges: Vec<_> = section_ranges(&doc)
            .iter()
            .map(|(s, first, len)| (s.uid, *first, *len))
            .collect();
        assert_eq!(ranges, [(1, 0, 2), (2, 2, 2), (3, 4, 2)]);
        let mut doc = doc;
        doc.sections[0].style = numbering::LOWER_ROMAN;
        assert_eq!(page_names(&doc), ["i", "ii", "1", "2", "3", "4"]);
        // The first section starts at its start number even when it
        // continues numbering; a section that includes its prefix puts
        // it before each page name.
        doc.sections[0].start = 5;
        doc.sections[2].prefix = "B-".into();
        doc.sections[2].include_prefix = true;
        assert_eq!(page_numbers(&doc), [5, 6, 1, 2, 3, 4]);
        assert_eq!(page_names(&doc), ["v", "vi", "B-1", "B-2", "3", "4"]);
    }

    #[test]
    fn names_pages_in_lower_roman() {
        assert_eq!(lower_roman(1), "i");
        assert_eq!(lower_roman(4), "iv");
        assert_eq!(lower_roman(12), "xii");
        assert_eq!(lower_roman(49), "xlix");
        assert_eq!(lower_roman(1994), "mcmxciv");
    }

    #[test]
    fn names_pages_in_kanji_digits() {
        assert_eq!(kanji_digits(8), "八");
        assert_eq!(kanji_digits(10), "一〇");
        assert_eq!(kanji_digits(102), "一〇二");
    }
}
