//! Read-only structure helpers: the structure elements, the figures and where their content is drawn.

use std::collections::{HashMap, HashSet};

use pdfcraft_content::Matrix;
use pdfcraft_cos::{DecodeBudget, Dict, Document, ObjRef, Object};

/// A Figure element (after the role map).
#[derive(Clone, Debug, PartialEq)]
pub struct Figure {
    pub obj: ObjRef,
    /// 0-based page of its content.
    pub page: Option<usize>,
    pub alt: Option<String>,
    /// Where its content is drawn, in user space (images, forms and paths it marks).
    pub bbox: Option<[f64; 4]>,
}

pub(crate) fn tree_root(doc: &Document) -> Option<Dict> {
    let cat = doc.root().and_then(|r| doc.get(r).as_dict().cloned())?;
    cat.get(b"StructTreeRoot").map(|o| doc.resolve(o)).and_then(|o| o.as_dict().cloned())
}

/// The standard type of a structure type through the role map.
pub(crate) fn standard(doc: &Document, role_map: &Dict, s: &[u8]) -> Vec<u8> {
    let mut t = s.to_vec();
    for _ in 0..12 {
        if crate::structure::is_standard(&t) {
            break;
        }
        match role_map.get(&t).map(|o| doc.resolve(o)).and_then(|o| o.as_name().map(<[u8]>::to_vec)) {
            Some(n) if n != t => t = n,
            _ => break,
        }
    }
    t
}

/// An indirect structure element and its nearest indirect parent in tree order.
#[allow(dead_code)]
pub(crate) struct Element {
    pub object: ObjRef,
    pub dict: Dict,
    pub page: Option<ObjRef>,
    pub parent: Option<ObjRef>,
    pub depth: usize,
}

/// Indirect structure elements in document order, with their page and hierarchy.
pub(crate) fn elements(doc: &Document) -> Vec<Element> {
    let Some(root) = tree_root(doc) else { return Vec::new() };
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let mut stack: Vec<(Object, Option<ObjRef>, Option<ObjRef>, usize)> =
        root.get(b"K").map(|k| vec![(k.clone(), None, None, 0)]).unwrap_or_default();
    while let Some((k, pg, parent, depth)) = stack.pop() {
        if out.len() > 1_000_000 {
            break;
        }
        match k {
            Object::Array(a) => stack.extend(a.into_iter().rev().map(|x| (x, pg, parent, depth))),
            Object::Ref(r) => {
                if !seen.insert(r) {
                    continue;
                }
                let Some(d) = doc.get(r).as_dict().cloned() else { continue };
                if d.contains(b"S") {
                    let pg = d.get(b"Pg").and_then(Object::as_ref).or(pg);
                    if let Some(kids) = d.get(b"K") {
                        stack.push((kids.clone(), pg, Some(r), depth.saturating_add(1)));
                    }
                    out.push(Element { object: r, dict: d, page: pg, parent, depth });
                }
            }
            Object::Dict(d) if d.contains(b"S") => {
                // Direct elements can't be addressed; their indirect children still can.
                let pg = d.get(b"Pg").and_then(Object::as_ref).or(pg);
                if let Some(kids) = d.get(b"K") {
                    stack.push((kids.clone(), pg, parent, depth));
                }
            }
            _ => {}
        }
    }
    out
}

/// The marked-content ids an element owns directly.
fn mcids(d: &Dict) -> Vec<i64> {
    let mut out = Vec::new();
    let mut push = |o: &Object| match o {
        Object::Int(n) => out.push(*n),
        Object::Dict(m) if m.name(b"Type") == Some(b"MCR") => {
            if let Some(n) = m.get(b"MCID").and_then(Object::as_int) {
                out.push(n)
            }
        }
        _ => {}
    };
    match d.get(b"K") {
        Some(Object::Array(a)) => a.iter().for_each(&mut push),
        Some(o) => push(o),
        None => {}
    }
    out
}

/// The page's named property lists (`/Resources /Properties`), which a `BDC` can name instead of
/// writing its property list inline.
fn page_properties(doc: &Document, page: &Dict) -> Dict {
    let res = page.get(b"Resources").map(|r| doc.resolve(r)).and_then(|r| r.as_dict().cloned()).unwrap_or_default();
    res.get(b"Properties").map(|p| doc.resolve(p)).and_then(|p| p.as_dict().cloned()).unwrap_or_default()
}

/// The marked-content id a `BDC` opens, whether its property list is inline or named in `props`.
fn bdc_mcid(doc: &Document, props: &Dict, op: &pdfcraft_content::Op) -> Option<i64> {
    match op.operands.get(1)? {
        Object::Dict(d) => d.get(b"MCID").and_then(Object::as_int),
        Object::Name(n) => props.get(n).map(|x| doc.resolve(x)).and_then(|x| x.as_dict().and_then(|d| d.get(b"MCID").and_then(Object::as_int))),
        _ => None,
    }
}

pub(crate) fn page_content(doc: &Document, page: &Dict) -> Vec<u8> {
    page_content_within(doc, page, &mut DecodeBudget::page())
}

/// The page's content streams, decoded against `budget` and joined with a space. Streams that
/// don't decode, or arrive after the budget is spent, are left out.
pub(crate) fn page_content_within(doc: &Document, page: &Dict, budget: &mut DecodeBudget) -> Vec<u8> {
    let Some(c) = page.get(b"Contents") else { return Vec::new() };
    let mut out = Vec::new();
    for data in budget.decode_contents(doc, c).into_iter().flatten() {
        out.extend_from_slice(&data);
        out.push(b' ');
    }
    out
}

fn union(a: Option<[f64; 4]>, b: [f64; 4]) -> [f64; 4] {
    match a {
        Some(a) => [a[0].min(b[0]), a[1].min(b[1]), a[2].max(b[2]), a[3].max(b[3])],
        None => b,
    }
}

/// An open marked-content sequence while bounds are gathered: its id, when it is one of those asked
/// for, and the bounds of what has been drawn in it so far.
struct Mark {
    id: Option<i64>,
    drawn: Option<[f64; 4]>,
}

/// Adds `b` to what the innermost open sequence has drawn.
fn draw(marks: &mut [Mark], b: [f64; 4]) {
    if let Some(m) = marks.last_mut() {
        m.drawn = Some(union(m.drawn, b));
    }
}

/// Closes the innermost open sequence: what it drew counts for its id and for the sequence around it.
fn close(marks: &mut Vec<Mark>, matching: &mut usize, out: &mut HashMap<i64, [f64; 4]>) {
    let Some(m) = marks.pop() else { return };
    if m.id.is_some() {
        *matching = matching.saturating_sub(1);
    }
    let Some(b) = m.drawn else { return };
    if let Some(id) = m.id {
        let e = out.entry(id).or_insert(b);
        *e = union(Some(*e), b);
    }
    draw(marks, b);
}

/// The page-space box a `Do` operator paints: a form's transformed `/BBox`, or the unit square for an image.
/// `None` when the operand is not a resolvable XObject or the form's box is malformed.
fn xobject_bbox(doc: &Document, xobjects: &Dict, op: &pdfcraft_content::Op, top: &Matrix) -> Option<[f64; 4]> {
    let r = op.name(0).and_then(|n| xobjects.get(n)).and_then(Object::as_ref)?;
    Some(match &*doc.get(r) {
        Object::Stream(s) if s.dict.name(b"Subtype") == Some(b"Form") => {
            let bb: Vec<f64> =
                s.dict.get(b"BBox").and_then(|b| b.as_array().map(|a| a.iter().filter_map(Object::as_f64).collect())).unwrap_or_default();
            let m = Matrix::from_operands(s.dict.get(b"Matrix").and_then(|m| m.as_array()).map(Vec::as_slice).unwrap_or(&[]))
                .unwrap_or(Matrix([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]));
            match bb[..] {
                [a, b, c, d] => m.then(top).bbox([a, b, c, d]),
                _ => return None,
            }
        }
        _ => top.bbox([0.0, 0.0, 1.0, 1.0]),
    })
}

/// Where each of the marked content `ids` is drawn on a page (images, forms and paths), in one pass
/// over the page. What a sequence draws counts for every sequence of `ids` around it too.
pub(crate) fn content_bboxes(doc: &Document, page: &Dict, ids: &HashSet<i64>) -> HashMap<i64, [f64; 4]> {
    let res = page.get(b"Resources").map(|r| doc.resolve(r)).and_then(|r| r.as_dict().cloned()).unwrap_or_default();
    let xobjects = res.get(b"XObject").map(|x| doc.resolve(x)).and_then(|x| x.as_dict().cloned()).unwrap_or_default();
    let props = page_properties(doc, page);
    #[cfg(test)]
    crate::BOUNDS_PASSES.with(|c| c.set(c.get() + 1));
    let mut ctm = vec![Matrix([1.0, 0.0, 0.0, 1.0, 0.0, 0.0])];
    // The open marked-content sequences, and how many of them are one of `ids`.
    let mut marks: Vec<Mark> = Vec::new();
    let mut matching = 0usize;
    let mut out = HashMap::new();
    let mut path: Vec<(f64, f64)> = Vec::new();
    for op in pdfcraft_content::parse(&page_content(doc, page)).ops {
        crate::count_mark_reads(1);
        let inside = matching > 0;
        let top = ctm.last().copied().unwrap_or(Matrix([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]));
        match op.op.as_slice() {
            b"q" => ctm.push(top),
            b"Q" if ctm.len() > 1 => {
                ctm.pop();
            }
            b"cm" => {
                if let Some(m) = Matrix::from_operands(&op.operands)
                    && let Some(t) = ctm.last_mut()
                {
                    *t = m.then(&top);
                }
            }
            b"BMC" => marks.push(Mark { id: None, drawn: None }),
            b"BDC" => {
                let id = bdc_mcid(doc, &props, &op).filter(|n| ids.contains(n));
                matching += usize::from(id.is_some());
                marks.push(Mark { id, drawn: None });
            }
            b"EMC" => close(&mut marks, &mut matching, &mut out),
            b"m" | b"l" => {
                if let Some([x, y]) = op.nums::<2>() {
                    path.push(top.apply(x, y));
                }
            }
            b"c" => {
                if let Some([_, _, _, _, x, y]) = op.nums::<6>() {
                    path.push(top.apply(x, y));
                }
            }
            b"re" => {
                if let Some([x, y, w, h]) = op.nums::<4>() {
                    let b = top.bbox([x, y, x + w, y + h]);
                    path.push((b[0], b[1]));
                    path.push((b[2], b[3]));
                }
            }
            b"f" | b"F" | b"f*" | b"B" | b"B*" | b"b" | b"b*" | b"S" | b"s" | b"n" => {
                if inside && !matches!(op.op.as_slice(), b"n") {
                    for (x, y) in &path {
                        draw(&mut marks, [*x, *y, *x, *y]);
                    }
                }
                path.clear();
            }
            b"Do" if inside => {
                let Some(unit) = xobject_bbox(doc, &xobjects, &op, &top) else { continue };
                draw(&mut marks, unit);
            }
            b"BI" if inside => draw(&mut marks, top.bbox([0.0, 0.0, 1.0, 1.0])),
            _ => {}
        }
    }
    while !marks.is_empty() {
        close(&mut marks, &mut matching, &mut out);
    }
    out
}

/// The figures, in document order.
pub fn figures(doc: &Document) -> Vec<Figure> {
    let Some(root) = tree_root(doc) else { return Vec::new() };
    let role_map = root.get(b"RoleMap").map(|o| doc.resolve(o)).and_then(|o| o.as_dict().cloned()).unwrap_or_default();
    let pages = pdfcraft_model::pages(doc);
    let index: HashMap<ObjRef, usize> = pages.iter().enumerate().map(|(i, p)| (p.obj, i)).collect();
    let figures: Vec<(Element, Option<usize>)> = elements(doc)
        .into_iter()
        .filter(|e| e.dict.name(b"S").is_some_and(|s| standard(doc, &role_map, s) == b"Figure"))
        .map(|e| {
            let page = e.page.and_then(|p| index.get(&p).copied());
            (e, page)
        })
        .collect();
    let mut wanted: HashMap<usize, HashSet<i64>> = HashMap::new();
    for (e, page) in &figures {
        if let Some(p) = page {
            wanted.entry(*p).or_default().extend(mcids(&e.dict));
        }
    }
    let bounds: HashMap<usize, HashMap<i64, [f64; 4]>> =
        wanted.into_iter().filter_map(|(p, ids)| Some((p, content_bboxes(doc, &pages.get(p)?.dict, &ids)))).collect();
    figures
        .into_iter()
        .map(|(e, page)| {
            let alt = e.dict.get(b"Alt").map(|o| doc.resolve(o)).and_then(|o| o.as_string().map(|s| s.to_text()));
            let on_page = page.and_then(|p| bounds.get(&p));
            let bbox = on_page.and_then(|b| mcids(&e.dict).iter().filter_map(|id| b.get(id)).fold(None, |acc, b| Some(union(acc, *b))));
            Figure { obj: e.object, page, alt, bbox }
        })
        .collect()
}

