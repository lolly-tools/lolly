//! A document model built from database objects. See
//! `docs/format/objects.md` for the class and chunk layouts used here.
//!
//! `Reader` (`reader`) reads typed objects; `Reader::document` (`document`)
//! builds the `Document`. The areas it reads are in `spread` (spreads,
//! pages, layers, sections), `item` (page items and graphics), `story`,
//! `style`, `settings` (document-level settings and lists) and the other
//! child modules; `ids` holds the class and chunk IDs.

mod animation;
pub mod attrs;
mod behavior;
pub mod cjk;
pub mod color;
mod document;
pub mod font;
pub mod hyperlink;
mod ids;
pub mod index;
mod item;
mod media;
pub mod prefs;
mod reader;
mod settings;
mod spread;
mod story;
mod story_link;
mod strings;
mod style;
pub mod table;
pub mod variable;
pub mod xml;
pub mod xmp;
pub mod xref;

pub use animation::{Animation, MotionPreset, TimingGroup, TimingList, TimingTarget};
pub use behavior::{Behavior, BehaviorKind};
pub use document::*;
pub use ids::*;
pub use item::*;
pub use media::{Media, MediaKind, MediaSettings};
pub use reader::*;
pub use settings::*;
pub use spread::*;
pub use story::*;
pub use story_link::*;
use strings::*;
pub use style::*;

use std::collections::{BTreeMap, HashMap};

pub use crate::object::Name;
pub use attrs::{Attrs, Value};
pub use cjk::{CjkTable, CompositeFont, CompositeFontEntry};
pub use color::{Color, ColorGroup, Gradient, Ink, MixedInk, Tint};
pub use font::{Font, FontFamily};
pub use hyperlink::{
    Alternative, Bookmark, Destination, DestinationKind, Hyperlink, PageItemSource, SourceRange,
    TextSource,
};
pub use table::{Cell, CellFormat, Table, TableStyle};
pub use variable::TextVariable;
pub use xref::CrossReferenceFormat;

use crate::audit::List;
use crate::object::{Cursor, Encoding, Object};
use crate::{Database, Error, Version};

#[cfg(test)]
mod tests {
    use crate::database::synthetic;

    /// Chunk data of a child list: 8 bytes, then a u32 list.
    fn child_list(uids: &[u32]) -> Vec<u8> {
        let mut d = vec![0; 8];
        d.extend_from_slice(&(uids.len() as u32).to_le_bytes());
        for u in uids {
            d.extend_from_slice(&u.to_le_bytes());
        }
        d
    }

    fn group(uid: u32, children: &[u32]) -> (u32, u32, Vec<u8>) {
        let chunks = synthetic::chunks(&[(chunk::ITEM_HIERARCHY, child_list(children))]);
        (uid, class::GROUP, chunks)
    }

    #[test]
    fn grouping_layer_resolves_spread_layers() {
        let layer_chunk = |uid: u32| {
            let mut d = uid.to_le_bytes().to_vec();
            d.extend(1i32.to_le_bytes());
            synthetic::chunks(&[(chunk::ITEM_GROUPING_LAYER, d)])
        };
        // Item 10 names spread layer 21 of layer 20, item 11 layer 20,
        // item 12 group 10, item 13 nothing.
        let objects = [
            (10, class::GROUP, layer_chunk(21)),
            (11, class::GROUP, layer_chunk(20)),
            (12, class::GROUP, layer_chunk(10)),
            (13, class::GROUP, layer_chunk(0)),
            (20, class::LAYER, synthetic::chunks(&[])),
            (
                21,
                class::SPREAD_LAYER,
                synthetic::chunks(&[(chunk::SPREAD_LAYER_LAYER, 20u32.to_le_bytes().to_vec())]),
            ),
        ];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let layer = |uid| reader.item_props(uid).unwrap().grouping_layer;
        assert_eq!(layer(10), Some(20));
        assert_eq!(layer(11), Some(20));
        assert_eq!(layer(12), None);
        assert_eq!(layer(13), None);
        assert_eq!(
            reader.item_props(10).unwrap().grouping_layer_position,
            Some(1)
        );
    }

    #[test]
    fn groups_that_contain_themselves_are_left_out() {
        // Group 10 contains itself and group 11; group 11 contains 10.
        let objects = [group(10, &[10, 11]), group(11, &[10])];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let item = reader.page_item(10, None).unwrap().unwrap();
        assert_eq!(item.children.len(), 1);
        assert_eq!(item.children[0].uid, 11);
        assert!(item.children[0].children.is_empty());
        assert_eq!(reader.warnings.borrow().len(), 2);
    }

    #[test]
    fn deeply_nested_groups_are_left_out() {
        let n = 3 * MAX_ITEM_DEPTH as u32;
        let objects: Vec<_> = (1..=n)
            .map(|u| group(u, &[u + 1][..(u < n) as usize]))
            .collect();
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let mut item = reader.page_item(1, None).unwrap().unwrap();
        let mut depth = 1;
        while let Some(child) = item.children.pop() {
            item = child;
            depth += 1;
        }
        assert_eq!(depth, MAX_ITEM_DEPTH);
        assert_eq!(reader.warnings.borrow().len(), 1);
    }

    #[test]
    fn items_that_cannot_be_read_are_left_out() {
        // Group 10 holds group 11, whose transform is cut short, and
        // group 12, whose attribute list is.
        // Six bytes: a transform needs 48; an attribute list of 5
        // records needs more.
        let short = |uid, id| {
            let chunks = synthetic::chunks(&[(id, vec![5, 0, 0, 0, 0, 0])]);
            (uid, class::GROUP, chunks)
        };
        let objects = [
            group(10, &[11, 12]),
            short(11, chunk::ITEM_TRANSFORM),
            short(12, chunk::ITEM_ATTRS),
        ];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let item = reader.page_item(10, None).unwrap().unwrap();
        assert_eq!(item.children.len(), 1);
        assert_eq!(item.children[0].uid, 12);
        let warnings = reader.warnings.borrow();
        assert_eq!(warnings.len(), 2, "{warnings:?}");
        assert!(warnings[0].starts_with("item 11 left out"));
        assert!(warnings[1].starts_with("item 12: attribute list left out"));
    }

    #[test]
    fn reads_the_states_of_a_button() {
        let le = |v: &[u32]| v.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>();
        // States 0 (key 1, active) and 1 (key 2, not enabled).
        let mut states = le(&[0, 2, 0]);
        states.extend([1, 0, 1, 0, 0, 0]);
        states.extend(le(&[1]));
        states.extend([0, 0, 2, 0, 0, 0]);
        // Spread 5, parent 5; key 1 shows group 21, key 2 group 22.
        let items = le(&[5, 5, 2, 1, 1, 21, 2, 1, 22]);
        let mut transform = Vec::new();
        for v in [1.0f64, 0.0, 0.0, 1.0, 10.0, 20.0] {
            transform.extend(v.to_le_bytes());
        }
        // A square from (0, 0) to (4, 2), as four corner points.
        let mut path = le(&[1, 4]);
        for (x, y) in [(0.0f64, 0.0f64), (0.0, 2.0), (4.0, 2.0), (4.0, 0.0)] {
            path.extend(le(&[2]));
            path.extend(x.to_le_bytes());
            path.extend(y.to_le_bytes());
        }
        path.extend([0, 0]);
        let button = synthetic::chunks(&[
            (chunk::FORM_STATES, states),
            (chunk::FORM_STATE_ITEMS, items),
            (chunk::FORM_TRANSFORM, transform),
        ]);
        let shape = synthetic::chunks(&[(chunk::ITEM_PATHS, path)]);
        let objects = [
            (20, class::BUTTON, button),
            group(21, &[23]),
            group(22, &[]),
            (23, class::SPLINE_ITEM, shape),
        ];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let item = reader.page_item(20, None).unwrap().unwrap();
        assert_eq!(item.transform.0[4..], [10.0, 20.0]);
        let ItemKind::Form(f) = &item.kind else {
            panic!("{:?}", item.kind)
        };
        assert_eq!(f.kind, FormKind::Button);
        let got: Vec<_> = f
            .states
            .iter()
            .map(|s| {
                let names: Vec<_> = s.items.iter().map(|i| i.props.name.clone()).collect();
                (s.id, s.active, s.enabled, names)
            })
            .collect();
        let name = |n: &str| {
            Some(ItemName {
                builtin: true,
                name: n.into(),
            })
        };
        assert_eq!(
            got,
            [
                (0, true, true, vec![name("$$$/StateType/Normal")]),
                (1, false, false, vec![name("$$$/StateType/Over")]),
            ]
        );
        assert_eq!(f.bounds, Some([0.0, 0.0, 4.0, 2.0]));
    }

    #[test]
    fn style_group_cycles_are_cut() {
        let g = |uid, root, children: &[u32]| {
            (
                uid,
                StyleGroup {
                    uid,
                    name: String::new(),
                    root,
                    children: children.to_vec(),
                },
            )
        };
        // Root 1 holds groups 2 and 3 and style 50; 2 holds 3 and 1; 3 holds 2.
        let mut groups = BTreeMap::from([
            g(1, Some(root_kind::PARAGRAPH), &[2, 3, 50]),
            g(2, None, &[3, 1]),
            g(3, None, &[2]),
        ]);
        let warnings = std::cell::RefCell::new(Vec::new());
        prune_style_groups(&mut groups, |m| warnings.borrow_mut().push(m));
        assert_eq!(groups[&1].children, [2, 3, 50]);
        assert!(groups[&2].children.is_empty());
        assert!(groups[&3].children.is_empty());
        assert_eq!(warnings.borrow().len(), 3);
    }

    use super::*;

    #[test]
    fn pages_take_margins_from_master_page_at_same_position() {
        let margins = |top, own| Margins {
            left: 0.0,
            top,
            right: 0.0,
            bottom: 0.0,
            own,
        };
        let page = |uid, tx, master, m| Page {
            uid,
            bounds: [0.0; 4],
            transform: Matrix([1.0, 0.0, 0.0, 1.0, tx, 0.0]),
            master,
            master_transform: Matrix::IDENTITY,
            margins: Some(m),
            columns: None,
            grid: None,
            settings: Default::default(),
        };
        let spread = |uid, pages| Spread {
            uid,
            master_name: None,
            transform: Matrix::IDENTITY,
            binding_location: 0,
            pages,
            items: Vec::new(),
            guides: Vec::new(),
            shuffle: None,
            flattener_resolution: None,
            show_master_items: None,
            primary_story: None,
            transition: None,
            timing: Vec::new(),
        };
        // Master B (pages listed right to left) is based on master A.
        let mut masters = vec![
            spread(
                10,
                vec![
                    page(1, -100.0, None, margins(10.0, true)),
                    page(2, 0.0, None, margins(20.0, true)),
                ],
            ),
            spread(
                11,
                vec![
                    page(3, 0.0, Some(10), margins(0.0, false)),
                    page(4, -100.0, Some(10), margins(30.0, true)),
                ],
            ),
        ];
        let mut spreads = vec![spread(
            12,
            vec![
                page(5, -100.0, Some(11), margins(0.0, false)),
                page(6, 0.0, Some(11), margins(0.0, false)),
            ],
        )];
        resolve_page_layout(&mut spreads, &mut masters);
        let tops: Vec<f64> = spreads[0]
            .pages
            .iter()
            .map(|p| p.margins.as_ref().unwrap().top)
            .collect();
        assert_eq!(tops, [30.0, 20.0]);
    }

    #[test]
    fn counts_a_surrogate_pair_as_one_position() {
        let text: Vec<u16> = "a\u{1F93F}b".encode_utf16().collect();
        assert_eq!(char_offsets(&text), [0, 1, 3, 4]);
    }

    #[test]
    fn splits_runs_at_style_boundaries() {
        let text: Vec<u16> = "abcdef".encode_utf16().collect();
        let a = Attrs::default;
        let runs = split_runs(
            &text,
            &[(4, 10, a()), (2, 11, a())],
            &[(2, 20, a()), (4, 21, a())],
            &[],
        );
        let texts: Vec<_> = runs.iter().map(|r| r.text.as_str()).collect();
        assert_eq!(texts, ["ab", "cd", "ef"]);
        assert_eq!(runs[1].paragraph_style, Some(10));
        assert_eq!(runs[1].character_style, Some(21));
        assert_eq!(runs[2].paragraph_style, Some(11));
        assert_eq!((runs[1].paragraph_run, runs[2].paragraph_run), (0, 1));
    }

    #[test]
    fn classifies_shapes() {
        let corner = |x, y| PathPoint {
            anchor: (x, y),
            left: (x, y),
            right: (x, y),
            kind: 2,
        };
        let rect = Path {
            points: vec![
                corner(0., 0.),
                corner(0., 1.),
                corner(1., 1.),
                corner(1., 0.),
            ],
            open: false,
        };
        assert_eq!(
            classify(std::slice::from_ref(&rect), None),
            Shape::Rectangle
        );
        // With flag 1 the shape code decides; with flag 0 the path.
        assert_eq!(
            classify(std::slice::from_ref(&rect), Some((1, 7))),
            Shape::Polygon
        );
        assert_eq!(
            classify(std::slice::from_ref(&rect), Some((0, 4))),
            Shape::Rectangle
        );
        let diamond = Path {
            points: vec![
                corner(0., 1.),
                corner(1., 0.),
                corner(2., 1.),
                corner(1., 2.),
            ],
            open: false,
        };
        assert_eq!(classify(&[diamond], Some((0, 2))), Shape::Polygon);
        let line = Path {
            points: vec![corner(0., 0.), corner(3., 1.)],
            open: true,
        };
        assert_eq!(
            classify(std::slice::from_ref(&line), Some((0, 9))),
            Shape::GraphicLine
        );
        assert_eq!(classify(&[line], Some((1, 9))), Shape::Polygon);
        let curve = Path {
            points: vec![
                PathPoint {
                    left: (-1., 0.),
                    ..corner(0., 0.)
                },
                corner(3., 1.),
            ],
            open: true,
        };
        assert_eq!(classify(&[curve], None), Shape::Polygon);
        let smooth = |x, y, kind| PathPoint {
            anchor: (x, y),
            left: (x - 1., y),
            right: (x + 1., y),
            kind,
        };
        let round = |kind| Path {
            points: vec![
                smooth(0., 1., kind),
                smooth(1., 0., kind),
                smooth(2., 1., kind),
                smooth(1., 2., kind),
            ],
            open: false,
        };
        assert_eq!(classify(&[round(0)], None), Shape::Oval);
        assert_eq!(classify(&[round(1)], None), Shape::Polygon);
        // The second and fourth anchors must lie on the midpoint of the
        // first and third; the first and third need not.
        let mut off = round(0);
        off.points[1].anchor.0 += 1e-5;
        assert_eq!(classify(&[off], None), Shape::Polygon);
        let mut off = round(0);
        off.points[0].anchor.1 += 1e-3;
        assert_eq!(classify(&[off], None), Shape::Oval);
        assert_eq!(classify(&[round(1)], Some((1, 4))), Shape::Oval);
    }

    #[test]
    fn writes_articles_and_article_children() {
        let list = |uids: &[u32]| {
            let mut d = (uids.len() as u32).to_le_bytes().to_vec();
            uids.iter().for_each(|u| d.extend(u.to_le_bytes()));
            d
        };
        let name = |s| synthetic::flagged_string(Encoding::default(), 2, s);
        // The document lists article 5 twice and group 30, which is not an
        // article; article 7 is not listed. Member 99 is not written.
        let mut group30 = group(30, &[31, 32]);
        group30.2.extend(synthetic::chunks(&[(
            chunk::GROUP_ARTICLE_CHILDREN,
            list(&[32, 31]),
        )]));
        let objects = [
            (
                1,
                class::DOCUMENT,
                synthetic::chunks(&[(chunk::DOC_ARTICLES, list(&[5, 6, 30, 5]))]),
            ),
            (
                5,
                class::ARTICLE,
                synthetic::chunks(&[
                    (chunk::ARTICLE_NAME, name("Main")),
                    (chunk::ARTICLE_MEMBERS, list(&[30, 31, 99])),
                ]),
            ),
            (
                6,
                class::ARTICLE,
                synthetic::chunks(&[(chunk::ARTICLE_NAME, name("Side"))]),
            ),
            (
                7,
                class::ARTICLE,
                synthetic::chunks(&[(chunk::ARTICLE_NAME, name("Unlisted"))]),
            ),
            group30,
            group(31, &[]),
            group(32, &[]),
        ];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let articles = reader.articles();
        let item = reader.page_item(30, None).unwrap().unwrap();
        assert_eq!(item.article_children, Some(vec![32, 31]));
        assert_eq!(item.children[0].article_children, None);
        let doc = Document {
            articles,
            spreads: vec![Spread {
                uid: 2,
                master_name: None,
                transform: Matrix::IDENTITY,
                binding_location: 0,
                pages: Vec::new(),
                items: vec![item],
                guides: Vec::new(),
                shuffle: None,
                flattener_resolution: None,
                show_master_items: None,
                primary_story: None,
                transition: None,
                timing: Vec::new(),
            }],
            ..Document::default()
        };
        let mut out = Vec::new();
        let warnings = crate::idml::write(&doc, "a.indd", &mut out).unwrap();
        let out = String::from_utf8_lossy(&out);
        let articles = &out[out.find("<Article ").unwrap()..];
        let articles: String = articles[..articles.find("</Document>").unwrap()]
            .lines()
            .map(str::trim)
            .collect();
        assert_eq!(
            articles,
            "<Article Self=\"u5\" Name=\"Main\" ArticleExportStatus=\"true\">\
             <ArticleMember Self=\"u5ArticleMember0\" ItemRef=\"u1e\" />\
             <ArticleMember Self=\"u5ArticleMember1\" ItemRef=\"u1f\" />\
             </Article>\
             <Article Self=\"u6\" Name=\"Side\" ArticleExportStatus=\"true\" />"
        );
        assert!(out.contains("<Group Self=\"u1e\" ArticleChildrenList=\"u20 u1f\""));
        assert!(warnings.iter().any(|w| w.contains("member 99 left out")));
    }
}
