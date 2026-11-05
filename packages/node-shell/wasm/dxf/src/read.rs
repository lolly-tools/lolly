// SPDX-License-Identifier: MPL-2.0
//! Group codes to a bounded, flat entity list.
//!
//! The tag reader (the vendored `cadcraft-dxf` crate) turns the file into (code, value) pairs.
//! This module is Lolly's own mapping from those pairs to the entities a floor plan needs. It was
//! written from Autodesk's published DXF Reference. Nothing is drawn here: the TypeScript
//! flattener in `engine/src/dxf-import.ts` turns the list into paths and text boxes.
//!
//! Every list is capped, and a cap that is hit is named in `notes` rather than hidden.

use cadcraft_dxf::{Tag, Value};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::ops::Range;

pub const MAX_TAGS: usize = 2_000_000;
pub const MAX_ENTITIES: usize = 250_000;
pub const MAX_BLOCKS: usize = 10_000;
pub const MAX_LAYERS: usize = 10_000;
pub const MAX_STYLES: usize = 2_000;
/// Vertices, control points and fit points kept across the whole file.
pub const MAX_POINTS: usize = 3_000_000;
pub const MAX_POINTS_PER_ENTITY: usize = 100_000;
pub const MAX_TEXT_BYTES: usize = 16 * 1024;
pub const MAX_NAME_BYTES: usize = 256;
pub const MAX_SKIPPED_KINDS: usize = 64;
pub const MAX_NOTES: usize = 32;

#[derive(Serialize, Default)]
pub struct Ent {
    pub t: &'static str,
    /// Layer index into `layers`.
    pub l: u32,
    /// Colour as stored (group 62): 0 by block, 256 by layer, negative for a layer that is off.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c: Option<i64>,
    /// True colour (group 420), 0xRRGGBB.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tc: Option<u32>,
    /// Extrusion (the normal that defines the entity's own plane), only when it is not +Z.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub n: Option<[f64; 3]>,
    /// First point: line start, centre, insertion point, text position.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub p: Option<[f64; 3]>,
    /// Second point: line end, ellipse major axis end (relative), text alignment point.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub q: Option<[f64; 3]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r: Option<f64>,
    /// Arc start and end angle in degrees, or ellipse start and end parameter in radians.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub a0: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub a1: Option<f64>,
    /// Ellipse minor to major ratio.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub k: Option<f64>,
    /// Polyline vertices (x, y, bulge) or spline control points (x, y, weight).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub v: Vec<[f64; 3]>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub fit: Vec<[f64; 3]>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub kn: Vec<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deg: Option<i64>,
    /// Closed (polyline flag 1, spline flag 1).
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub cl: bool,
    /// Spline flags (group 70).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fl: Option<i64>,
    /// Block name for an INSERT.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sz: Option<f64>,
    /// Rotation in degrees.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rot: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cols: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dy: Option<f64>,
    /// Text contents, raw (MTEXT formatting codes are interpreted by the flattener).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx: Option<String>,
    /// Text height.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<f64>,
    /// Text style index into `styles`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub st: Option<u32>,
    /// TEXT relative X scale.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xs: Option<f64>,
    /// TEXT oblique angle in degrees.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ob: Option<f64>,
    /// TEXT horizontal justification (72) or MTEXT attachment point (71).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ha: Option<i64>,
    /// TEXT vertical justification (73, or 74 on ATTRIB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub va: Option<i64>,
    /// MTEXT reference rectangle width.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wd: Option<f64>,
    /// TEXT generation flags (2 backward, 4 upside down).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gn: Option<i64>,
}

#[derive(Serialize)]
pub struct LayerOut {
    pub n: String,
    pub c: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tc: Option<u32>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub off: bool,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub fz: bool,
}

#[derive(Serialize)]
pub struct StyleOut {
    pub n: String,
    /// Primary font file (group 3), as the file names it.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub f: String,
    /// Big font file (group 4).
    #[serde(skip_serializing_if = "String::is_empty")]
    pub b: String,
    /// TrueType typeface name the style records in its extended data, when it has one.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub tt: String,
}

#[derive(Serialize)]
pub struct BlockOut {
    pub n: String,
    pub bx: f64,
    pub by: f64,
    pub e: Vec<Ent>,
}

#[derive(Serialize)]
pub struct XrefOut {
    pub n: String,
    pub path: String,
}

#[derive(Serialize, Default)]
pub struct PaperOut {
    pub n: u64,
    pub types: BTreeMap<String, u64>,
}

#[derive(Serialize, Default)]
pub struct Out {
    /// Output schema version.
    pub v: u32,
    pub fmt: &'static str,
    pub acadver: String,
    pub cp: String,
    /// `$INSUNITS`, 0 when the file declares none.
    pub u: i64,
    /// `$MEASUREMENT`: 0 English, 1 metric.
    pub ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ext: Option<[f64; 4]>,
    pub tags: usize,
    pub layers: Vec<LayerOut>,
    pub styles: Vec<StyleOut>,
    pub blocks: Vec<BlockOut>,
    pub e: Vec<Ent>,
    pub paper: PaperOut,
    pub skipped: BTreeMap<String, u64>,
    pub xrefs: Vec<XrefOut>,
    pub notes: Vec<String>,
}

fn txt(t: &Tag) -> &str {
    match &t.value {
        Value::Str(s) | Value::Hex(s) => s,
        _ => "",
    }
}

/// One record: the tags after a group 0, with its type name.
struct Rec<'a> {
    kind: &'a str,
    tags: &'a [Tag],
}

impl<'a> Rec<'a> {
    fn f(&self, code: i32) -> Option<f64> {
        self.tags.iter().find(|t| t.code == code).map(Tag::f64)
    }
    fn i(&self, code: i32) -> Option<i64> {
        self.tags.iter().find(|t| t.code == code).map(Tag::i64)
    }
    fn s(&self, code: i32) -> Option<&'a str> {
        self.tags.iter().find(|t| t.code == code).map(txt)
    }
    fn all_f(&self, code: i32) -> impl Iterator<Item = f64> + 'a {
        self.tags.iter().filter(move |t| t.code == code).map(Tag::f64)
    }
    fn point(&self, cx: i32) -> Option<[f64; 3]> {
        let x = self.f(cx)?;
        Some([x, self.f(cx + 10).unwrap_or(0.0), self.f(cx + 20).unwrap_or(0.0)])
    }
}

fn records(tags: &[Tag], range: Range<usize>) -> Vec<Rec<'_>> {
    let mut out: Vec<Rec<'_>> = Vec::new();
    let mut start: Option<(usize, &str)> = None;
    for i in range.clone() {
        let Some(t) = tags.get(i) else { break };
        if t.code == 0 {
            if let Some((s, kind)) = start.take() {
                out.push(Rec { kind, tags: tags.get(s + 1..i).unwrap_or(&[]) });
            }
            start = Some((i, txt(t)));
        }
    }
    if let Some((s, kind)) = start {
        out.push(Rec { kind, tags: tags.get(s + 1..range.end.min(tags.len())).unwrap_or(&[]) });
    }
    out
}

/// Section name and the tag range between its name and its ENDSEC.
fn sections(tags: &[Tag]) -> Vec<(String, Range<usize>)> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < tags.len() {
        if tags[i].code == 0 && txt(&tags[i]) == "SECTION" {
            let name = tags.get(i + 1).filter(|t| t.code == 2).map(|t| txt(t).to_ascii_uppercase()).unwrap_or_default();
            let start = i + 2;
            let mut j = start;
            while j < tags.len() && !(tags[j].code == 0 && txt(&tags[j]) == "ENDSEC") {
                j += 1;
            }
            out.push((name, start.min(tags.len())..j));
            i = j + 1;
        } else {
            i += 1;
        }
    }
    out
}

fn clip(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

struct Ctx {
    layer_ix: HashMap<String, u32>,
    style_ix: HashMap<String, u32>,
    out: Out,
    entities: usize,
    points: usize,
}

impl Ctx {
    fn note(&mut self, text: &str) {
        if self.out.notes.len() < MAX_NOTES && !self.out.notes.iter().any(|n| n == text) {
            self.out.notes.push(text.to_string());
        }
    }
    fn layer(&mut self, name: &str, c: i64, tc: Option<u32>, off: bool, fz: bool) -> u32 {
        let name = clip(name, MAX_NAME_BYTES);
        let key = name.to_ascii_uppercase();
        if let Some(&i) = self.layer_ix.get(&key) {
            return i;
        }
        if self.out.layers.len() >= MAX_LAYERS {
            self.note("Layer limit reached: later layers were folded into layer 0.");
            return 0;
        }
        let i = self.out.layers.len() as u32;
        self.out.layers.push(LayerOut { n: name, c, tc, off, fz });
        self.layer_ix.insert(key, i);
        i
    }
    fn style(&mut self, name: &str) -> Option<u32> {
        self.style_ix.get(&clip(name, MAX_NAME_BYTES).to_ascii_uppercase()).copied()
    }
    fn skip(&mut self, kind: &str) {
        let key = if self.out.skipped.contains_key(kind) || self.out.skipped.len() < MAX_SKIPPED_KINDS { clip(kind, 32) } else { "(other)".to_string() };
        *self.out.skipped.entry(key).or_insert(0) += 1;
    }
    /// Reserve `n` points; false when the whole-file or per-entity point cap would be passed.
    fn take_points(&mut self, n: usize) -> bool {
        if n > MAX_POINTS_PER_ENTITY || self.points + n > MAX_POINTS {
            self.note("Point limit reached: the largest polylines and splines were left out.");
            return false;
        }
        self.points += n;
        true
    }
}

fn header(tags: &[Tag], range: Range<usize>, cx: &mut Ctx) {
    let mut i = range.start;
    while i < range.end {
        let t = &tags[i];
        if t.code == 9 {
            let name = txt(t).to_ascii_uppercase();
            let mut j = i + 1;
            while j < range.end && tags[j].code != 9 {
                j += 1;
            }
            let vals = &tags[i + 1..j];
            let first = |code: i32| vals.iter().find(|v| v.code == code);
            match name.as_str() {
                "$ACADVER" => cx.out.acadver = first(1).map(|v| clip(txt(v), 16)).unwrap_or_default(),
                "$DWGCODEPAGE" => cx.out.cp = first(3).map(|v| clip(txt(v), 32)).unwrap_or_default(),
                "$INSUNITS" => cx.out.u = first(70).map(Tag::i64).unwrap_or(0),
                "$MEASUREMENT" => cx.out.ms = first(70).map(Tag::i64).unwrap_or(0),
                "$EXTMIN" | "$EXTMAX" => {
                    if let (Some(x), Some(y)) = (first(10), first(20)) {
                        let e = cx.out.ext.get_or_insert([f64::NAN; 4]);
                        if name == "$EXTMIN" {
                            e[0] = x.f64();
                            e[1] = y.f64();
                        } else {
                            e[2] = x.f64();
                            e[3] = y.f64();
                        }
                    }
                }
                _ => {}
            }
            i = j;
        } else {
            i += 1;
        }
    }
    if cx.out.ext.is_some_and(|e| e.iter().any(|v| !v.is_finite())) {
        cx.out.ext = None;
    }
}

fn tables(tags: &[Tag], range: Range<usize>, cx: &mut Ctx) {
    for r in records(tags, range) {
        match r.kind {
            "LAYER" => {
                let name = r.s(2).unwrap_or("0");
                let aci = r.i(62).unwrap_or(7);
                let flags = r.i(70).unwrap_or(0);
                let tc = r.i(420).filter(|v| (0..=0xFF_FFFF).contains(v)).map(|v| v as u32);
                cx.layer(name, aci.abs(), tc, aci < 0, flags & 1 != 0);
            }
            "STYLE" => {
                if cx.out.styles.len() >= MAX_STYLES {
                    cx.note("Text style limit reached.");
                    continue;
                }
                let name = clip(r.s(2).unwrap_or(""), MAX_NAME_BYTES);
                // The typeface of a TrueType style rides in extended data after `1001 ACAD`.
                let mut tt = String::new();
                if let Some(at) = r.tags.iter().position(|t| t.code == 1001 && txt(t).eq_ignore_ascii_case("ACAD")) {
                    if let Some(face) = r.tags.get(at + 1..).and_then(|rest| rest.iter().take_while(|t| t.code != 1001).find(|t| t.code == 1000)) {
                        tt = clip(txt(face), MAX_NAME_BYTES);
                    }
                }
                let i = cx.out.styles.len() as u32;
                cx.style_ix.entry(name.to_ascii_uppercase()).or_insert(i);
                cx.out.styles.push(StyleOut { n: name, f: clip(r.s(3).unwrap_or(""), MAX_NAME_BYTES), b: clip(r.s(4).unwrap_or(""), MAX_NAME_BYTES), tt });
            }
            _ => {}
        }
    }
}

fn base(t: &'static str, r: &Rec<'_>, cx: &mut Ctx) -> Ent {
    let layer = cx.layer(r.s(8).unwrap_or("0"), 7, None, false, false);
    let n = match (r.f(210), r.f(220), r.f(230)) {
        (None, None, None) => None,
        (x, y, z) => {
            let v = [x.unwrap_or(0.0), y.unwrap_or(0.0), z.unwrap_or(1.0)];
            if v[0] == 0.0 && v[1] == 0.0 && v[2] == 1.0 { None } else { Some(v) }
        }
    };
    Ent {
        t,
        l: layer,
        c: r.i(62),
        tc: r.i(420).filter(|v| (0..=0xFF_FFFF).contains(v)).map(|v| v as u32),
        n,
        ..Ent::default()
    }
}

fn polyline_flags_skip(flags: i64) -> bool {
    // Polygon mesh (16) and polyface mesh (64) are surfaces, not floor-plan linework.
    flags & (16 | 64) != 0
}

fn lw_polyline(r: &Rec<'_>, cx: &mut Ctx) -> Option<Ent> {
    let mut verts: Vec<[f64; 3]> = Vec::new();
    for t in r.tags {
        match t.code {
            10 => {
                if verts.len() >= MAX_POINTS_PER_ENTITY {
                    cx.note("Point limit reached: the largest polylines and splines were left out.");
                    return None;
                }
                verts.push([t.f64(), 0.0, 0.0]);
            }
            20 => {
                if let Some(v) = verts.last_mut() {
                    v[1] = t.f64();
                }
            }
            42 => {
                if let Some(v) = verts.last_mut() {
                    v[2] = t.f64();
                }
            }
            _ => {}
        }
    }
    if verts.len() < 2 || !cx.take_points(verts.len()) {
        return None;
    }
    let mut e = base("LWPOLYLINE", r, cx);
    e.cl = r.i(70).unwrap_or(0) & 1 != 0;
    e.v = verts;
    Some(e)
}

fn polyline(r: &Rec<'_>, verts: &[Rec<'_>], cx: &mut Ctx) -> Option<Ent> {
    let flags = r.i(70).unwrap_or(0);
    if polyline_flags_skip(flags) {
        cx.skip("POLYLINE (mesh)");
        return None;
    }
    let mut pts: Vec<[f64; 3]> = Vec::new();
    for v in verts {
        let vf = v.i(70).unwrap_or(0);
        // 16 marks a spline frame control point of a fitted curve. The other vertices are on the curve.
        if vf & 16 != 0 {
            continue;
        }
        if pts.len() >= MAX_POINTS_PER_ENTITY {
            cx.note("Point limit reached: the largest polylines and splines were left out.");
            return None;
        }
        pts.push([v.f(10).unwrap_or(0.0), v.f(20).unwrap_or(0.0), v.f(42).unwrap_or(0.0)]);
    }
    if flags & 2 != 0 {
        cx.note("Some polylines were marked as curve-fit; the file's own vertices are drawn without extra smoothing.");
    }
    if pts.len() < 2 || !cx.take_points(pts.len()) {
        return None;
    }
    let mut e = base("POLYLINE", r, cx);
    e.cl = flags & 1 != 0;
    e.v = pts;
    Some(e)
}

fn spline(r: &Rec<'_>, cx: &mut Ctx) -> Option<Ent> {
    let flags = r.i(70).unwrap_or(0);
    let mut ctrl: Vec<[f64; 3]> = Vec::new();
    let mut fit: Vec<[f64; 3]> = Vec::new();
    let mut weights: Vec<f64> = Vec::new();
    for t in r.tags {
        match t.code {
            10 | 11 => {
                let list = if t.code == 10 { &mut ctrl } else { &mut fit };
                if list.len() >= MAX_POINTS_PER_ENTITY {
                    cx.note("Point limit reached: the largest polylines and splines were left out.");
                    return None;
                }
                list.push([t.f64(), 0.0, 1.0]);
            }
            20 => {
                if let Some(v) = ctrl.last_mut() {
                    v[1] = t.f64();
                }
            }
            21 => {
                if let Some(v) = fit.last_mut() {
                    v[1] = t.f64();
                }
            }
            41 => {
                if weights.len() < MAX_POINTS_PER_ENTITY {
                    weights.push(t.f64());
                }
            }
            _ => {}
        }
    }
    for (i, w) in weights.iter().enumerate() {
        if let Some(c) = ctrl.get_mut(i) {
            c[2] = if *w > 0.0 { *w } else { 1.0 };
        }
    }
    let mut knots: Vec<f64> = r.all_f(40).take(MAX_POINTS_PER_ENTITY + 64).collect();
    if ctrl.is_empty() && fit.len() < 2 {
        return None;
    }
    if !cx.take_points(ctrl.len() + fit.len() + knots.len()) {
        return None;
    }
    let mut e = base("SPLINE", r, cx);
    e.deg = r.i(71);
    e.fl = Some(flags);
    e.cl = flags & 1 != 0;
    e.v = ctrl;
    e.fit = fit;
    e.kn = std::mem::take(&mut knots);
    Some(e)
}

fn text_entity(kind: &'static str, r: &Rec<'_>, cx: &mut Ctx) -> Option<Ent> {
    let text = r.s(1).unwrap_or("");
    if text.trim().is_empty() {
        return None;
    }
    // An attribute with the invisible flag is not drawn.
    if kind == "ATTRIB" && r.i(70).unwrap_or(0) & 1 != 0 {
        return None;
    }
    let mut e = base(if kind == "ATTRIB" { "TEXT" } else { kind }, r, cx);
    e.p = r.point(10);
    e.q = if r.f(11).is_some() { r.point(11) } else { None };
    e.tx = Some(clip(text, MAX_TEXT_BYTES));
    e.h = r.f(40);
    e.st = r.s(7).and_then(|s| cx.style(s));
    e.rot = r.f(50);
    if kind == "MTEXT" {
        // The text is split into 250-character chunks: groups 3 first, then the last one in group 1.
        let mut full = String::new();
        for t in r.tags.iter().filter(|t| t.code == 3) {
            if full.len() > MAX_TEXT_BYTES {
                break;
            }
            full.push_str(txt(t));
        }
        full.push_str(text);
        e.tx = Some(clip(&full, MAX_TEXT_BYTES));
        e.wd = r.f(41);
        e.ha = r.i(71);
        // A direction vector replaces the rotation angle.
        if let (Some(x), Some(y)) = (r.f(11), r.f(21)) {
            e.rot = Some(y.atan2(x).to_degrees());
        }
        e.q = None;
    } else {
        e.xs = r.f(41);
        e.ob = r.f(51);
        e.gn = r.i(71);
        e.ha = r.i(72);
        e.va = if kind == "ATTRIB" { r.i(74) } else { r.i(73) };
    }
    Some(e)
}

/// Whether `rec` closes a following-records group (POLYLINE vertices, INSERT attributes).
fn is_seqend(r: &Rec<'_>) -> bool {
    r.kind == "SEQEND"
}

fn map_entities(recs: &[Rec<'_>], in_block: bool, out: &mut Vec<Ent>, cx: &mut Ctx) {
    let mut i = 0;
    while i < recs.len() {
        let r = &recs[i];
        i += 1;
        if matches!(r.kind, "VERTEX" | "SEQEND") {
            continue;
        }
        // Entities drawn in paper space are counted, not imported, in the main entity list.
        if !in_block && r.i(67).unwrap_or(0) == 1 {
            cx.out.paper.n += 1;
            if cx.out.paper.types.len() < MAX_SKIPPED_KINDS || cx.out.paper.types.contains_key(r.kind) {
                *cx.out.paper.types.entry(clip(r.kind, 32)).or_insert(0) += 1;
            }
            if matches!(r.kind, "POLYLINE" | "INSERT") {
                while i < recs.len() && !is_seqend(&recs[i]) && matches!(recs[i].kind, "VERTEX" | "ATTRIB") {
                    i += 1;
                }
                if i < recs.len() && is_seqend(&recs[i]) {
                    i += 1;
                }
            }
            continue;
        }
        if cx.entities >= MAX_ENTITIES {
            cx.note("Entity limit reached: later entities were left out.");
            break;
        }
        let mut made: Vec<Ent> = Vec::new();
        match r.kind {
            "LINE" => {
                if let (Some(p), Some(q)) = (r.point(10), r.point(11)) {
                    let mut e = base("LINE", r, cx);
                    e.p = Some(p);
                    e.q = Some(q);
                    made.push(e);
                }
            }
            "CIRCLE" | "ARC" => {
                if let (Some(p), Some(rad)) = (r.point(10), r.f(40)) {
                    let mut e = base(if r.kind == "ARC" { "ARC" } else { "CIRCLE" }, r, cx);
                    e.p = Some(p);
                    e.r = Some(rad);
                    if r.kind == "ARC" {
                        e.a0 = Some(r.f(50).unwrap_or(0.0));
                        e.a1 = Some(r.f(51).unwrap_or(360.0));
                    }
                    made.push(e);
                }
            }
            "ELLIPSE" => {
                if let (Some(p), Some(q)) = (r.point(10), r.point(11)) {
                    let mut e = base("ELLIPSE", r, cx);
                    e.p = Some(p);
                    e.q = Some(q);
                    e.k = Some(r.f(40).unwrap_or(1.0));
                    e.a0 = Some(r.f(41).unwrap_or(0.0));
                    e.a1 = Some(r.f(42).unwrap_or(std::f64::consts::TAU));
                    made.push(e);
                }
            }
            "LWPOLYLINE" => made.extend(lw_polyline(r, cx)),
            "POLYLINE" => {
                let start = i;
                while i < recs.len() && recs[i].kind == "VERTEX" {
                    i += 1;
                }
                let verts = &recs[start..i];
                if i < recs.len() && is_seqend(&recs[i]) {
                    i += 1;
                }
                made.extend(polyline(r, verts, cx));
            }
            "SPLINE" => made.extend(spline(r, cx)),
            "TEXT" | "MTEXT" => made.extend(text_entity(if r.kind == "TEXT" { "TEXT" } else { "MTEXT" }, r, cx)),
            "INSERT" => {
                let mut atts: Vec<&Rec<'_>> = Vec::new();
                if r.i(66).unwrap_or(0) != 0 {
                    while i < recs.len() && recs[i].kind == "ATTRIB" {
                        atts.push(&recs[i]);
                        i += 1;
                    }
                    if i < recs.len() && is_seqend(&recs[i]) {
                        i += 1;
                    }
                }
                if let Some(name) = r.s(2) {
                    let mut e = base("INSERT", r, cx);
                    e.nm = Some(clip(name, MAX_NAME_BYTES));
                    e.p = Some(r.point(10).unwrap_or([0.0; 3]));
                    e.sx = r.f(41);
                    e.sy = r.f(42);
                    e.sz = r.f(43);
                    e.rot = r.f(50);
                    e.cols = r.i(70);
                    e.rows = r.i(71);
                    e.dx = r.f(44);
                    e.dy = r.f(45);
                    made.push(e);
                }
                for a in atts {
                    made.extend(text_entity("ATTRIB", a, cx));
                }
            }
            // A dimension's lines, arrows and text live in an anonymous block it names in group 2.
            "DIMENSION" => {
                if let Some(name) = r.s(2).filter(|n| !n.is_empty()) {
                    let mut e = base("INSERT", r, cx);
                    e.nm = Some(clip(name, MAX_NAME_BYTES));
                    e.p = Some([0.0; 3]);
                    made.push(e);
                } else {
                    cx.skip("DIMENSION");
                }
            }
            "ATTRIB" | "ATTDEF" => {
                cx.skip(r.kind);
            }
            other => cx.skip(other),
        }
        for e in made {
            if cx.entities >= MAX_ENTITIES {
                break;
            }
            cx.entities += 1;
            out.push(e);
        }
    }
}

fn blocks(tags: &[Tag], range: Range<usize>, cx: &mut Ctx) {
    let recs = records(tags, range);
    let mut i = 0;
    while i < recs.len() {
        if recs[i].kind != "BLOCK" {
            i += 1;
            continue;
        }
        let head = &recs[i];
        i += 1;
        let start = i;
        while i < recs.len() && recs[i].kind != "ENDBLK" {
            i += 1;
        }
        let body = &recs[start..i];
        let name = clip(head.s(2).or_else(|| head.s(3)).unwrap_or(""), MAX_NAME_BYTES);
        let flags = head.i(70).unwrap_or(0);
        let lower = name.to_ascii_lowercase();
        if flags & (4 | 8) != 0 {
            cx.out.xrefs.push(XrefOut { n: name, path: clip(head.s(1).unwrap_or(""), 1024) });
            continue;
        }
        if lower.starts_with("*paper_space") {
            for b in body {
                cx.out.paper.n += 1;
                *cx.out.paper.types.entry(clip(b.kind, 32)).or_insert(0) += 1;
            }
            continue;
        }
        if lower.starts_with("*model_space") {
            let mut extra = Vec::new();
            map_entities(body, true, &mut extra, cx);
            cx.out.e.extend(extra);
            continue;
        }
        if cx.out.blocks.len() >= MAX_BLOCKS {
            cx.note("Block limit reached: later block definitions were left out.");
            continue;
        }
        let mut ents = Vec::new();
        map_entities(body, true, &mut ents, cx);
        cx.out.blocks.push(BlockOut { n: name, bx: head.f(10).unwrap_or(0.0), by: head.f(20).unwrap_or(0.0), e: ents });
    }
}

/// Read DXF bytes into the flat list.
pub fn read(bytes: &[u8]) -> Result<Out, String> {
    let binary = cadcraft_dxf::is_binary(bytes);
    let tags = cadcraft_dxf::parse_with_limit(bytes, MAX_TAGS).map_err(|e| match e {
        cadcraft_dxf::DxfError::TooLarge { limit, .. } => format!("This drawing has more than {limit} DXF group codes, which is more than this importer reads."),
        other => format!("Not a readable DXF file: {other}"),
    })?;
    let secs = sections(&tags);
    if secs.is_empty() {
        return Err("Not a readable DXF file: it has no sections.".into());
    }
    let mut cx = Ctx {
        layer_ix: HashMap::new(),
        style_ix: HashMap::new(),
        out: Out { v: 1, fmt: if binary { "binary" } else { "ascii" }, tags: tags.len(), ..Out::default() },
        entities: 0,
        points: 0,
    };
    cx.layer("0", 7, None, false, false);
    for (name, range) in &secs {
        if name == "HEADER" {
            header(&tags, range.clone(), &mut cx);
        }
    }
    for (name, range) in &secs {
        if name == "TABLES" {
            tables(&tags, range.clone(), &mut cx);
        }
    }
    for (name, range) in &secs {
        if name == "BLOCKS" {
            blocks(&tags, range.clone(), &mut cx);
        }
    }
    for (name, range) in &secs {
        if name == "ENTITIES" {
            let recs = records(&tags, range.clone());
            let mut ents = Vec::new();
            map_entities(&recs, false, &mut ents, &mut cx);
            cx.out.e.extend(ents);
        }
    }
    Ok(cx.out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dxf(body: &str) -> Vec<u8> {
        format!("0\nSECTION\n2\nENTITIES\n{body}0\nENDSEC\n0\nEOF\n").into_bytes()
    }

    #[test]
    fn line_circle_arc() {
        let out = read(&dxf("0\nLINE\n8\nWALLS\n10\n0\n20\n0\n11\n5\n21\n5\n0\nCIRCLE\n8\n0\n10\n1\n20\n2\n40\n3\n0\nARC\n10\n0\n20\n0\n40\n2\n50\n10\n51\n80\n")).unwrap();
        assert_eq!(out.e.len(), 3);
        assert_eq!(out.e[0].t, "LINE");
        assert_eq!(out.layers[out.e[0].l as usize].n, "WALLS");
        assert_eq!(out.e[1].r, Some(3.0));
        assert_eq!(out.e[2].a1, Some(80.0));
    }

    #[test]
    fn lwpolyline_bulge_and_close() {
        let out = read(&dxf("0\nLWPOLYLINE\n90\n3\n70\n1\n10\n0\n20\n0\n42\n0.5\n10\n4\n20\n0\n10\n4\n20\n3\n")).unwrap();
        let e = &out.e[0];
        assert!(e.cl);
        assert_eq!(e.v.len(), 3);
        assert_eq!(e.v[0][2], 0.5);
        assert_eq!(e.v[1], [4.0, 0.0, 0.0]);
    }

    #[test]
    fn polyline_vertices_and_seqend() {
        let out = read(&dxf("0\nPOLYLINE\n66\n1\n70\n1\n0\nVERTEX\n10\n0\n20\n0\n0\nVERTEX\n10\n2\n20\n0\n42\n1\n0\nVERTEX\n10\n2\n20\n2\n0\nSEQEND\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n")).unwrap();
        assert_eq!(out.e.len(), 2);
        assert_eq!(out.e[0].v.len(), 3);
        assert_eq!(out.e[0].v[1][2], 1.0);
    }

    #[test]
    fn paper_space_is_counted_not_imported() {
        let out = read(&dxf("0\nLINE\n67\n1\n10\n0\n20\n0\n11\n1\n21\n1\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n")).unwrap();
        assert_eq!(out.e.len(), 1);
        assert_eq!(out.paper.n, 1);
        assert_eq!(out.paper.types.get("LINE"), Some(&1));
    }

    #[test]
    fn unsupported_entities_are_counted() {
        let out = read(&dxf("0\nHATCH\n8\n0\n0\nHATCH\n8\n0\n0\nSOLID\n8\n0\n")).unwrap();
        assert!(out.e.is_empty());
        assert_eq!(out.skipped.get("HATCH"), Some(&2));
        assert_eq!(out.skipped.get("SOLID"), Some(&1));
    }

    #[test]
    fn blocks_xrefs_and_insert() {
        let src = "0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nDOOR\n10\n1\n20\n1\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n0\n0\nENDBLK\n0\nBLOCK\n2\nSITE\n70\n4\n1\nsite.dwg\n0\nENDBLK\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nINSERT\n2\nDOOR\n10\n5\n20\n5\n41\n2\n50\n90\n0\nENDSEC\n0\nEOF\n";
        let out = read(src.as_bytes()).unwrap();
        assert_eq!(out.blocks.len(), 1);
        assert_eq!(out.blocks[0].n, "DOOR");
        assert_eq!(out.blocks[0].bx, 1.0);
        assert_eq!(out.xrefs[0].n, "SITE");
        assert_eq!(out.xrefs[0].path, "site.dwg");
        assert_eq!(out.e[0].nm.as_deref(), Some("DOOR"));
        assert_eq!(out.e[0].sx, Some(2.0));
    }

    #[test]
    fn header_units_and_style_typeface() {
        let src = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1027\n9\n$INSUNITS\n70\n4\n9\n$EXTMIN\n10\n0\n20\n0\n30\n0\n9\n$EXTMAX\n10\n9\n20\n8\n30\n0\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nSTYLE\n0\nSTYLE\n2\nPLAN\n3\narial.ttf\n4\n\n1001\nACAD\n1000\nArial\n1071\n0\n0\nSTYLE\n2\nOLD\n3\ntxt.shx\n0\nENDTAB\n0\nENDSEC\n0\nEOF\n";
        let out = read(src.as_bytes()).unwrap();
        assert_eq!(out.u, 4);
        assert_eq!(out.acadver, "AC1027");
        assert_eq!(out.ext, Some([0.0, 0.0, 9.0, 8.0]));
        assert_eq!(out.styles[0].tt, "Arial");
        assert_eq!(out.styles[1].f, "txt.shx");
    }

    #[test]
    fn text_and_mtext() {
        let out = read(&dxf("0\nTEXT\n7\nSTANDARD\n10\n1\n20\n2\n40\n0.2\n1\nKitchen\n72\n1\n11\n2\n21\n2\n0\nMTEXT\n10\n0\n20\n0\n40\n0.3\n41\n4\n71\n5\n3\nHello \n1\nWorld\n")).unwrap();
        assert_eq!(out.e[0].tx.as_deref(), Some("Kitchen"));
        assert_eq!(out.e[0].ha, Some(1));
        assert_eq!(out.e[1].tx.as_deref(), Some("Hello World"));
        assert_eq!(out.e[1].wd, Some(4.0));
    }

    #[test]
    fn spline_and_ellipse() {
        let out = read(&dxf("0\nSPLINE\n70\n8\n71\n3\n40\n0\n40\n0\n40\n0\n40\n0\n40\n1\n40\n1\n40\n1\n40\n1\n10\n0\n20\n0\n10\n1\n20\n2\n10\n2\n20\n2\n10\n3\n20\n0\n0\nELLIPSE\n10\n0\n20\n0\n11\n4\n21\n0\n40\n0.5\n41\n0\n42\n6.283185307179586\n")).unwrap();
        assert_eq!(out.e[0].v.len(), 4);
        assert_eq!(out.e[0].kn.len(), 8);
        assert_eq!(out.e[1].k, Some(0.5));
    }

    #[test]
    fn dimension_becomes_an_insert_of_its_block() {
        let out = read(&dxf("0\nDIMENSION\n2\n*D1\n10\n0\n20\n0\n")).unwrap();
        assert_eq!(out.e[0].t, "INSERT");
        assert_eq!(out.e[0].nm.as_deref(), Some("*D1"));
    }

    #[test]
    fn rejects_garbage() {
        assert!(read(b"").is_err());
        assert!(read(b"hello\nworld\n").is_err());
        assert!(read(b"0\nEOF\n").is_err());
    }

    #[test]
    fn tag_cap_is_reported() {
        let mut s = String::from("0\nSECTION\n2\nENTITIES\n");
        for _ in 0..(MAX_TAGS / 2 + 10) {
            s.push_str("0\nLINE\n10\n0\n");
        }
        let err = read(s.as_bytes()).err().expect("too large");
        assert!(err.contains("more than"));
    }
}
