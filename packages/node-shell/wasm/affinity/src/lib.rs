// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned Affinity document reader.
//!
//! Operation 1 reads the container header, the embedded preview PNG and basic document facts.
//! Operation 2 returns the whole document model as JSON, with every picture encoded as PNG or
//! kept as the original JPEG or PNG. Both answer `u32 le json length`, the JSON and a payload
//! the JSON points into by offset and length. A failure is a UTF-8 message.
#![deny(unsafe_op_in_unsafe_fn)]

use serde::Serialize;
use std::cell::RefCell;
use std::collections::BTreeMap;
use vectorcraft_affinity as af;
use vectorcraft_affinity::model::{self, Document, Effect, Image, Kind, Node, Path, Pixels, Spread};
use vectorcraft_affinity::paint::{Align as StrokeAlign, Cap, Color, GradientKind, Join, Paint, Stroke};

/// Largest document accepted.
const MAX_INPUT: usize = 96 * 1024 * 1024;
/// Largest payload of pictures returned.
const MAX_PAYLOAD: usize = 128 * 1024 * 1024;
/// Largest model JSON returned.
const MAX_JSON: usize = 48 * 1024 * 1024;
/// Archive extraction limits and the pixel budget of the model read.
const MAX_ENTRY: usize = 96 * 1024 * 1024;
const MAX_TOTAL: usize = 256 * 1024 * 1024;
const MAX_PIXELS: u64 = 32 * 1024 * 1024;
const MAX_WARNINGS: usize = 200;

const OP_INSPECT: u32 = 1;
const OP_MODEL: u32 = 2;

const STATUS_OK: u32 = 0;
const STATUS_FAILED: u32 = 1;
const STATUS_LIMIT: u32 = 2;

type Fail = (u32, String);

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, output: Vec<u8>, allocated: usize }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

#[derive(Serialize, Clone, Copy)]
struct Span { o: usize, l: usize }

type Rect = [f64; 4];
fn rect(r: &model::Rect) -> Rect { [r.x0, r.y0, r.x1, r.y1] }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Facts {
    container: u16,
    flags: u16,
    saved: u32,
    preview: Option<PreviewFacts>,
    preview_error: Option<String>,
    document: Option<DocFacts>,
    document_error: Option<String>,
}
#[derive(Serialize)]
struct PreviewFacts { width: u32, height: u32, png: Span }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DocFacts {
    dpi: f64,
    spreads: usize,
    pages: usize,
    artboards: usize,
    masters: usize,
    layers: usize,
    width: f64,
    height: f64,
    saved_by: Option<String>,
    warnings: Vec<String>,
}

fn count(nodes: &[Node], artboards: &mut usize, layers: &mut usize) {
    for n in nodes {
        *layers += 1;
        if matches!(n.kind, Kind::Artboard { .. }) { *artboards += 1; }
        count(&n.children, artboards, layers);
    }
}

fn warnings_of(doc: &Document) -> Vec<String> {
    doc.warnings.iter().take(MAX_WARNINGS).map(|w| w.chars().take(300).collect()).collect()
}

fn doc_facts(doc: &Document) -> DocFacts {
    let (mut artboards, mut layers) = (0, 0);
    let (mut x0, mut y0, mut x1, mut y1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    let mut pages = 0;
    for s in &doc.spreads {
        count(&s.nodes, &mut artboards, &mut layers);
        pages += s.pages.len().max(1);
        x0 = x0.min(s.bounds.x0); y0 = y0.min(s.bounds.y0); x1 = x1.max(s.bounds.x1); y1 = y1.max(s.bounds.y1);
    }
    let (width, height) = if x1 >= x0 && y1 >= y0 { (x1 - x0, y1 - y0) } else { (0.0, 0.0) };
    DocFacts {
        dpi: doc.dpi, spreads: doc.spreads.len(), pages, artboards, masters: doc.masters.len(), layers, width, height,
        saved_by: doc.saved_by.clone().map(|s| s.chars().take(80).collect()),
        warnings: warnings_of(doc),
    }
}

fn envelope(json: &impl Serialize, payload: &[u8]) -> Result<Vec<u8>, Fail> {
    let json = serde_json::to_vec(json).map_err(|e| (STATUS_FAILED, e.to_string()))?;
    if json.len() > MAX_JSON { return Err((STATUS_LIMIT, "The Affinity model is too large to return".into())); }
    let mut out = Vec::with_capacity(4 + json.len() + payload.len());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&json);
    out.extend_from_slice(payload);
    Ok(out)
}

fn limits() -> af::Limits { af::Limits { max_entry: MAX_ENTRY, max_total: MAX_TOTAL } }

fn fail_of(e: af::Error) -> Fail {
    (if matches!(e, af::Error::Limit(_)) { STATUS_LIMIT } else { STATUS_FAILED }, e.to_string())
}

fn inspect(bytes: &[u8]) -> Result<Vec<u8>, Fail> {
    let header = af::container::header(bytes).map_err(fail_of)?;
    let mut payload = Vec::new();
    let (mut preview, mut preview_error) = (None, None);
    match af::preview(bytes) {
        Ok(p) => {
            preview = Some(PreviewFacts { width: p.width, height: p.height, png: Span { o: 0, l: p.png.len() } });
            payload.extend_from_slice(p.png);
        }
        Err(e) => preview_error = Some(e.to_string()),
    }
    // No pixel layer is decoded for the facts, so a large photo document answers quickly.
    let (mut document, mut document_error) = (None, None);
    match model::read_within(bytes, limits(), 0) {
        Ok(doc) => document = Some(doc_facts(&doc)),
        Err(e) => document_error = Some(e.to_string()),
    }
    if preview.is_none() && document.is_none() {
        return Err((STATUS_FAILED, document_error.or(preview_error).unwrap_or_else(|| "Unreadable Affinity file".into())));
    }
    let facts = Facts { container: header.version, flags: header.flags, saved: header.saved, preview, preview_error, document, document_error };
    envelope(&facts, &payload)
}

// ---- model JSON ----

#[derive(Serialize)]
#[serde(tag = "model", rename_all = "lowercase")]
enum ColorJ {
    Rgb { r: f64, g: f64, b: f64, a: f64 },
    Cmyk { c: f64, m: f64, y: f64, k: f64, a: f64 },
    Gray { v: f64, a: f64 },
    Lab { l: f64, a: f64, b: f64, alpha: f64 },
}
fn color(c: &Color) -> ColorJ {
    match *c {
        Color::Rgb { r, g, b, a } => ColorJ::Rgb { r, g, b, a },
        Color::Cmyk { c, m, y, k, a } => ColorJ::Cmyk { c, m, y, k, a },
        Color::Gray { v, a } => ColorJ::Gray { v, a },
        Color::Lab { l, a, b, alpha } => ColorJ::Lab { l, a, b, alpha },
    }
}
#[derive(Serialize)]
struct StopJ { o: f64, c: ColorJ, bias: f64 }
#[derive(Serialize)]
#[serde(tag = "t", rename_all = "lowercase")]
enum PaintJ {
    None,
    Solid { c: ColorJ },
    Gradient { k: &'static str, stops: Vec<StopJ>, tf: [f64; 6] },
}
fn paint(p: &Paint) -> PaintJ {
    match p {
        Paint::None => PaintJ::None,
        Paint::Solid(c) => PaintJ::Solid { c: color(c) },
        Paint::Gradient(g) => PaintJ::Gradient {
            k: match g.kind { GradientKind::Linear => "linear", GradientKind::Radial => "radial", GradientKind::Conical => "conical" },
            stops: g.stops.iter().map(|s| StopJ { o: s.offset, c: color(&s.color), bias: s.bias }).collect(),
            tf: g.transform.0,
        },
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StrokeJ {
    paint: PaintJ, width: f64, cap: &'static str, join: &'static str, miter: f64, align: &'static str,
    dash: Option<(Vec<f64>, f64)>, behind: bool,
}
fn stroke(s: &Stroke) -> StrokeJ {
    StrokeJ {
        paint: paint(&s.paint), width: s.width,
        cap: match s.cap { Cap::Butt => "butt", Cap::Round => "round", Cap::Square => "square" },
        join: match s.join { Join::Miter => "miter", Join::Round => "round", Join::Bevel => "bevel" },
        miter: s.miter_limit,
        align: match s.align { StrokeAlign::Center => "center", StrokeAlign::Inside => "inside", StrokeAlign::Outside => "outside" },
        dash: s.dash.clone(), behind: s.behind,
    }
}
#[derive(Serialize)]
struct SubJ { s: [f64; 2], c: Vec<[f64; 6]>, z: bool }
fn path(p: &Path) -> Vec<SubJ> {
    p.subpaths.iter().map(|s| SubJ {
        s: [s.start.x, s.start.y],
        c: s.segments.iter().map(|g| [g[0].x, g[0].y, g[1].x, g[1].y, g[2].x, g[2].y]).collect(),
        z: s.closed,
    }).collect()
}
#[derive(Serialize)]
struct ImageJ {
    w: u32, h: u32, tf: [f64; 6],
    /// `png`, `jpeg` or `other`: how the bytes at `data` are encoded.
    enc: &'static str,
    cmyk: bool,
    data: Option<Span>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ParaJ { align: &'static str, left: f64, right: f64, first: f64, before: f64, after: f64, leading: Option<f64>, auto_leading: f64 }
fn align(a: model::Align) -> &'static str {
    match a { model::Align::Left => "left", model::Align::Center => "center", model::Align::Right => "right", model::Align::Justify => "justify" }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunJ {
    text: String, postscript: String, family: String, weight: i64, italic: bool, features: Vec<String>,
    all_caps: bool, underline: bool, strike: bool, size: f64, tracking: f64, h_scale: f64, leading: Option<f64>,
    fill: PaintJ, stroke: Option<StrokeJ>, para: ParaJ,
}
fn run(r: &model::TextRun) -> RunJ {
    RunJ {
        text: r.text.clone(), postscript: r.postscript.clone(), family: r.family.clone(), weight: r.weight, italic: r.italic,
        features: r.features.clone(), all_caps: r.all_caps, underline: r.underline, strike: r.strikethrough, size: r.size,
        tracking: r.tracking, h_scale: r.h_scale, leading: r.leading, fill: paint(&r.fill), stroke: r.stroke.as_ref().map(stroke),
        para: ParaJ {
            align: align(r.paragraph.align), left: r.paragraph.left, right: r.paragraph.right, first: r.paragraph.first,
            before: r.paragraph.space_before, after: r.paragraph.space_after, leading: r.paragraph.leading, auto_leading: r.paragraph.auto_leading,
        },
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CellJ { runs: Vec<RunJ>, inset: [f64; 4], valign: &'static str, merged_left: bool }
#[derive(Serialize)]
#[serde(tag = "t", rename_all = "camelCase")]
enum KindJ {
    Layer,
    Group,
    #[serde(rename_all = "camelCase")]
    Artboard { rect: Rect, path: Vec<SubJ>, even_odd: bool, background: Vec<PaintJ>, strokes: Vec<StrokeJ> },
    #[serde(rename_all = "camelCase")]
    Shape { path: Vec<SubJ>, fills: Vec<PaintJ>, strokes: Vec<StrokeJ>, even_odd: bool },
    #[serde(rename_all = "camelCase")]
    Text { runs: Vec<RunJ>, align: &'static str, anchor: [f64; 2], frame: Option<Rect>, tf: [f64; 6], text_tf: [f64; 6] },
    #[serde(rename_all = "camelCase")]
    Table {
        columns: Vec<f64>, rows: Vec<f64>, cells: Vec<CellJ>, vertical: Vec<Option<StrokeJ>>, horizontal: Vec<Option<StrokeJ>>,
        tf: [f64; 6], text_tf: [f64; 6],
    },
    Image(ImageJ),
    #[serde(rename_all = "camelCase")]
    Master { master: usize, page: usize, master_page: usize, count: usize },
    Unsupported,
}
#[derive(Serialize)]
#[serde(tag = "t", rename_all = "camelCase")]
enum EffectJ {
    Shadow { inner: bool, c: ColorJ, opacity: f64, radius: f64, distance: f64, angle: f64 },
    Glow { c: ColorJ, opacity: f64, radius: f64 },
    Outline { c: ColorJ, opacity: f64, width: f64, align: u16 },
    Bevel { size: f64 },
    Overlay { paint: PaintJ, opacity: f64, blend: String },
}
fn effect(e: &Effect) -> EffectJ {
    match e {
        Effect::DropShadow { color: c, opacity, radius, distance, angle } => EffectJ::Shadow { inner: false, c: color(c), opacity: *opacity, radius: *radius, distance: *distance, angle: *angle },
        Effect::InnerShadow { color: c, opacity, radius, distance, angle } => EffectJ::Shadow { inner: true, c: color(c), opacity: *opacity, radius: *radius, distance: *distance, angle: *angle },
        Effect::OuterGlow { color: c, opacity, radius } => EffectJ::Glow { c: color(c), opacity: *opacity, radius: *radius },
        Effect::Outline { color: c, opacity, width, align } => EffectJ::Outline { c: color(c), opacity: *opacity, width: *width, align: *align },
        Effect::Bevel { size, .. } => EffectJ::Bevel { size: *size },
        Effect::ColorOverlay { color: c, opacity, blend } => EffectJ::Overlay { paint: PaintJ::Solid { c: color(c) }, opacity: *opacity, blend: format!("{blend:?}") },
        Effect::GradientOverlay { gradient, opacity, blend } => EffectJ::Overlay { paint: paint(&Paint::Gradient(gradient.clone())), opacity: *opacity, blend: format!("{blend:?}") },
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeJ {
    class: String, name: String, visible: bool, locked: bool, opacity: f64, blend: String, kind: KindJ,
    mask: Option<Vec<SubJ>>, pixel_mask: Option<ImageJ>, effects: Vec<EffectJ>, children: Vec<NodeJ>,
}
#[derive(Serialize)]
struct SpreadJ { bounds: Rect, pages: Vec<Rect>, transparent: bool, nodes: Vec<NodeJ> }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelJ {
    dpi: f64, saved_by: Option<String>, warnings: Vec<String>, cmyk_profile: bool, spreads: Vec<SpreadJ>, masters: Vec<SpreadJ>,
}

struct Out { payload: Vec<u8> }
impl Out {
    fn add(&mut self, bytes: &[u8]) -> Result<Span, Fail> {
        if bytes.len() > MAX_PAYLOAD.saturating_sub(self.payload.len()) {
            return Err((STATUS_LIMIT, "The pictures in this Affinity file exceed the 128 MB return limit".into()));
        }
        let span = Span { o: self.payload.len(), l: bytes.len() };
        self.payload.extend_from_slice(bytes);
        Ok(span)
    }
    fn image(&mut self, img: &Image) -> Result<ImageJ, Fail> {
        let (w, h) = (img.width, img.height);
        let base = |enc, cmyk, data| ImageJ { w, h, tf: img.transform.0, enc, cmyk, data };
        match &img.pixels {
            Pixels::Encoded(bytes) => {
                let enc = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { "png" } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) { "jpeg" } else { "other" };
                let data = if enc == "other" { None } else { Some(self.add(bytes)?) };
                Ok(base(enc, false, data))
            }
            Pixels::Rgba8(px) => Ok(base("png", false, Some(self.png(px, w, h)?))),
            Pixels::Cmyka8(px) => {
                // The document's CMYK profile is not applied here; inks are mixed plainly.
                let mut rgba = Vec::with_capacity(px.len() / 5 * 4);
                for p in px.chunks_exact(5) {
                    let k = 1.0 - f64::from(p[3]) / 255.0;
                    let ch = |i: usize| (255.0 * (1.0 - f64::from(p[i]) / 255.0) * k).round().clamp(0.0, 255.0) as u8;
                    rgba.extend_from_slice(&[ch(0), ch(1), ch(2), p[4]]);
                }
                Ok(base("png", true, Some(self.png(&rgba, w, h)?)))
            }
        }
    }
    fn png(&mut self, rgba: &[u8], w: u32, h: u32) -> Result<Span, Fail> {
        use image::ImageEncoder;
        if rgba.len() as u64 != u64::from(w) * u64::from(h) * 4 { return Err((STATUS_FAILED, "A picture in this Affinity file has the wrong size".into())); }
        let mut buf = Vec::new();
        image::codecs::png::PngEncoder::new_with_quality(&mut buf, image::codecs::png::CompressionType::Fast, image::codecs::png::FilterType::Sub)
            .write_image(rgba, w, h, image::ExtendedColorType::Rgba8)
            .map_err(|e| (STATUS_FAILED, e.to_string()))?;
        self.add(&buf)
    }
}

fn kind(out: &mut Out, k: &Kind) -> Result<KindJ, Fail> {
    Ok(match k {
        Kind::Layer => KindJ::Layer,
        Kind::Group => KindJ::Group,
        Kind::Artboard { rect: r, path: p, even_odd, background, strokes } => KindJ::Artboard {
            rect: rect(r), path: path(p), even_odd: *even_odd, background: background.iter().map(paint).collect(), strokes: strokes.iter().map(stroke).collect(),
        },
        Kind::Shape { path: p, fills, strokes, even_odd } => KindJ::Shape {
            path: path(p), fills: fills.iter().map(paint).collect(), strokes: strokes.iter().map(stroke).collect(), even_odd: *even_odd,
        },
        Kind::Text(t) => KindJ::Text {
            runs: t.runs.iter().map(run).collect(), align: align(t.align), anchor: [t.anchor.x, t.anchor.y], frame: t.frame.as_ref().map(rect),
            tf: t.transform.0, text_tf: t.text_transform.0,
        },
        Kind::Table(t) => KindJ::Table {
            columns: t.columns.clone(), rows: t.rows.clone(),
            cells: t.cells.iter().map(|c| CellJ {
                runs: c.runs.iter().map(run).collect(), inset: c.inset, merged_left: c.merged_left,
                valign: match c.valign { model::VAlign::Top => "top", model::VAlign::Center => "center", model::VAlign::Bottom => "bottom" },
            }).collect(),
            vertical: t.vertical.iter().map(|s| s.as_ref().map(stroke)).collect(),
            horizontal: t.horizontal.iter().map(|s| s.as_ref().map(stroke)).collect(),
            tf: t.transform.0, text_tf: t.text_transform.0,
        },
        Kind::Image(img) => KindJ::Image(out.image(img)?),
        Kind::MasterInstance { master, page, master_page, count } => KindJ::Master { master: *master, page: *page, master_page: *master_page, count: *count },
        Kind::Unsupported => KindJ::Unsupported,
    })
}

fn node(out: &mut Out, n: &Node, depth: usize) -> Result<NodeJ, Fail> {
    if depth > 128 { return Err((STATUS_LIMIT, "Layers are nested too deeply".into())); }
    let mut children = Vec::with_capacity(n.children.len());
    for c in &n.children { children.push(node(out, c, depth + 1)?); }
    Ok(NodeJ {
        class: String::from_utf8_lossy(&n.class.0.to_be_bytes()).into_owned(),
        name: n.name.chars().take(256).collect(), visible: n.visible, locked: n.locked, opacity: n.opacity,
        blend: format!("{:?}", n.blend), kind: kind(out, &n.kind)?, mask: n.mask.as_ref().map(path),
        pixel_mask: match &n.pixel_mask { Some(i) => Some(out.image(i)?), None => None },
        effects: n.effects.iter().map(effect).collect(), children,
    })
}

fn spread(out: &mut Out, s: &Spread) -> Result<SpreadJ, Fail> {
    let mut nodes = Vec::with_capacity(s.nodes.len());
    for n in &s.nodes { nodes.push(node(out, n, 0)?); }
    Ok(SpreadJ { bounds: rect(&s.bounds), pages: s.pages.iter().map(rect).collect(), transparent: s.transparent, nodes })
}

fn model_op(bytes: &[u8]) -> Result<Vec<u8>, Fail> {
    let doc = model::read_within(bytes, limits(), MAX_PIXELS).map_err(fail_of)?;
    let mut out = Out { payload: Vec::new() };
    let mut spreads = Vec::new();
    for s in &doc.spreads { spreads.push(spread(&mut out, s)?); }
    let mut masters = Vec::new();
    for s in &doc.masters { masters.push(spread(&mut out, s)?); }
    let mut warnings = warnings_of(&doc);
    if doc.cmyk_profile.is_some() { warnings.push("CMYK pixel layers are shown without the document's colour profile.".into()); }
    let m = ModelJ { dpi: doc.dpi, saved_by: doc.saved_by.clone().map(|s| s.chars().take(80).collect()), warnings, cmyk_profile: doc.cmyk_profile.is_some(), spreads, masters };
    envelope(&m, &out.payload)
}

fn dispatch(bytes: &[u8], op: u32) -> Result<Vec<u8>, Fail> {
    if bytes.len() > MAX_INPUT { return Err((STATUS_LIMIT, "The Affinity file exceeds 96 MB".into())); }
    match op {
        OP_INSPECT => inspect(bytes),
        OP_MODEL => model_op(bytes),
        _ => Err((STATUS_FAILED, "Unknown Affinity operation".into())),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn affinity_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn affinity_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn affinity_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let result = match s.inputs.get(&ptr).filter(|b| b.len() == length) {
            None => Err((STATUS_FAILED, "Invalid Affinity input buffer".to_string())),
            Some(input) => dispatch(input, op),
        };
        match result {
            Ok(out) => { s.output = out; STATUS_OK }
            Err((status, message)) => { s.output = message.into_bytes(); status }
        }
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn affinity_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn affinity_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }
