// SPDX-License-Identifier: MPL-2.0
//! Admission: the page this crate draws faithfully, or every reason it does not.
//!
//! Each reason has a stable code (`REFUSAL_CODES`), the operation it belongs to and
//! a sentence. Nothing is dropped or approximated to make a page drawable: a feature
//! outside this slice refuses the page, and the caller hands the page to a renderer
//! that draws the feature (the browser tier). Every input is bounded before work
//! that grows with the input.

pub use crate::geometry::Outline;
use crate::geometry::{box_inside, push_outline, ring};
use crate::input::{self, Area, Input, Op, Paint, Stroke, DRAW_VERSION, INPUT_FORMAT, INPUT_VERSION};
use crate::path_data::{append_path_data, PathDataError};
use crate::picture::{base64, decode, Decoded, PictureRefusal};
use std::collections::HashMap;
use tiny_skia::{BlendMode, FillRule, LineCap, LineJoin, Path, PathBuilder, StrokeDash};

/// The largest input document read, in bytes.
pub const MAX_INPUT_BYTES: usize = 64 * 1024 * 1024;
/// The largest output side, and the most output pixels, drawn.
pub const MAX_SIDE: u32 = 8192;
pub const MAX_PIXELS: u64 = 32 * 1024 * 1024;
/// Operations on one page (the engine's `DESIGN_RASTER_MAX_OPS`).
pub const MAX_OPS: usize = 1024;
/// Path segments across the page: authored curves, outline commands and decorations.
pub const MAX_SEGMENTS: usize = 1_048_576;
/// Bytes of outline path data in one run, and across the page.
pub const MAX_RUN_PATH_BYTES: usize = 1024 * 1024;
pub const MAX_PAGE_PATH_BYTES: usize = 16 * 1024 * 1024;
/// Stops in one gradient (the engine's `DESIGN_RASTER_MAX_STOPS`).
pub const MAX_STOPS: usize = 256;
/// Points in one row's clip polygon (the engine's `DESIGN_RASTER_MAX_CLIP_POINTS`).
pub const MAX_CLIP_POINTS: usize = 64;
/// Dashes in one stroke (the engine's `DESIGN_RASTER_MAX_DASHES`).
pub const MAX_DASHES: f64 = 4096.0;
/// Lines and runs of one text block.
pub const MAX_LINES: usize = 10_000;
pub const MAX_RUNS: usize = 100_000;
/// The largest coordinate magnitude, stroke width and identifier length read.
pub const MAX_COORD: f64 = 1e6;
pub const MAX_STROKE: f64 = 1e4;
pub const MAX_ID: usize = 256;
/// Reasons kept for one page; the rest are counted.
pub const MAX_REFUSALS: usize = 256;

/// Every refusal code, in a stable order. A code is never renamed or reused.
pub const REFUSAL_CODES: &[&str] = &[
    "input-bytes",
    "input-json",
    "input-field",
    "input-format",
    "input-version",
    "draw-version",
    "output-size",
    "output-dpi",
    "output-proportions",
    "page-size",
    "page-clip",
    "finding",
    "budget-ops",
    "budget-path",
    "budget-dash",
    "id",
    "unknown-op",
    "preview-op",
    "compatibility-reading",
    "geometry",
    "opacity",
    "pose",
    "row-clip",
    "row-clip-mirrored",
    "blend",
    "shadow",
    "blur",
    "picture",
    "shape",
    "unknown-shape",
    "corner-radii",
    "unknown-paint",
    "paint",
    "paint-order",
    "path-gradient",
    "colour",
    "gradient",
    "stroke",
    "stroke-sides",
    "stroke-align",
    "pen-stroke-side",
    "stroke-style",
    "stroke-dash",
    "box-dash",
    "gradient-under-translucent-border",
    "words",
    "text-unlaid",
    "live-text",
    "outline",
    "decoration",
    "frame-edge",
    "picture-missing",
    "picture-type",
    "picture-vector",
    "picture-unreadable",
    "picture-size",
    "picture-depth",
    "picture-colour",
    "picture-orientation",
    "picture-motion",
];

/// One reason a page is not drawn here.
#[derive(Debug, Clone, PartialEq)]
pub struct Refusal {
    pub code: &'static str,
    /// The operation's row id, or empty for the page.
    pub id: String,
    pub detail: String,
}

/// A straight sRGB colour with its alpha, each 0 to 1.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rgba(pub f32, pub f32, pub f32, pub f32);

#[derive(Debug, Clone)]
pub struct GradientStop {
    pub offset: f32,
    pub color: Rgba,
}

/// What a step paints with, in the operation's own coordinates.
#[derive(Debug, Clone)]
pub enum Ink {
    Solid(Rgba),
    /// A decoded picture (`Plan::pictures[index]`) laid on `rect` (x, y, w, h).
    Picture {
        index: usize,
        rect: [f64; 4],
    },
    Linear {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        stops: Vec<GradientStop>,
    },
    /// An ellipse centred at `cx`, `cy` with radii `rx`, `ry`, to its edge at offset 1.
    Radial {
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
        stops: Vec<GradientStop>,
    },
}

#[derive(Debug, Clone)]
pub enum Draw {
    Fill {
        path: Path,
        rule: FillRule,
    },
    /// An axis-aligned rectangle: x, y, w, h. Drawn with exact edge coverage where the
    /// transform keeps it axis-aligned, as Skia draws a rectangle.
    Rect([f64; 4]),
    /// A centred stroke along a pen path, drawn by tiny-skia's port of Skia's stroker,
    /// which also draws a stroke under a device pixel wide as Skia does.
    Stroke {
        path: Path,
        width: f32,
        cap: LineCap,
        join: LineJoin,
        dash: Option<StrokeDash>,
        /// A stroke kept inside (true) or outside (false) a closed outline: drawn twice as
        /// wide and clipped to that side of the outline, read with this rule, as the SVG
        /// writer and the canvas draw it.
        side: Option<(bool, FillRule)>,
    },
}

#[derive(Debug, Clone)]
pub struct Step {
    pub draw: Draw,
    pub ink: Ink,
    /// Clipped to the operation's text clip (`Item::words_clip`).
    pub words: bool,
    /// Further clips, each an outline in the operation's own coordinates (a picture's
    /// element and box where they are not plain rectangles).
    pub clips: Vec<Outline>,
}

#[derive(Debug, Clone)]
pub struct Item {
    pub id: String,
    /// Group opacity, 0 to 1. Below 1 the item is drawn on its own layer first.
    pub opacity: f32,
    /// The pose about the box centre as an affine matrix `[a, b, c, d, e, f]`
    /// (x' = a x + c y + e, y' = b x + d y + f), in page units.
    pub pose: [f64; 6],
    /// Another row's silhouette, in page coordinates (not posed).
    pub row_clip: Option<Path>,
    /// What the words are clipped to, in the operation's own coordinates; absent when
    /// no glyph reaches the clip's edge.
    pub words_clip: Option<Outline>,
    pub steps: Vec<Step>,
    /// Blend, layer blur and shadows, drawn as CSS composites them.
    pub effects: Effects,
}

/// A shadow: its offset in the operation's own coordinates, its Gaussian deviation in page
/// units and its colour.
#[derive(Debug, Clone, Copy)]
pub struct Shadow {
    pub dx: f64,
    pub dy: f64,
    pub sigma: f64,
    pub color: Rgba,
}

/// An operation's effects, in CSS's order: a box shadow is part of the element's own
/// painting; the layer blur, then the drop shadow, filter the whole posed element; the
/// group is laid on the page with its opacity and blend mode. A text shadow follows the words.
#[derive(Debug, Clone, Default)]
pub struct Effects {
    pub blend: Option<BlendMode>,
    /// The layer blur's deviation in page units, 0 for none.
    pub blur: f64,
    /// A box shadow and the box outline it follows (drawn only outside that outline).
    pub box_shadow: Option<(Shadow, Outline)>,
    pub drop: Option<Shadow>,
    pub text: Option<Shadow>,
}

impl Effects {
    /// Whether the operation must be drawn on a layer of its own before it reaches the page.
    pub fn layered(&self) -> bool {
        self.blend.is_some() || self.blur > 0.0 || self.box_shadow.is_some() || self.drop.is_some()
    }
}

#[derive(Debug, Clone)]
pub struct Plan {
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub dpi: Option<f64>,
    pub page_width: f64,
    pub page_height: f64,
    /// Device pixels per page unit, across and down.
    pub scale: (f64, f64),
    /// The ground under a page with no frame operation.
    pub ground: Rgba,
    pub frame: Option<Item>,
    pub page_clip: Option<Outline>,
    pub items: Vec<Item>,
    /// The decoded pictures the steps paint with.
    pub pictures: Vec<Decoded>,
}

struct Admit<'a> {
    refusals: Vec<Refusal>,
    dropped: usize,
    segments: usize,
    path_bytes: usize,
    res: f64,
    resources: HashMap<&'a str, &'a input::Resource>,
    decoded: HashMap<&'a str, Result<usize, PictureRefusal>>,
    pictures: Vec<Decoded>,
    picture_pixels: u64,
}

impl Admit<'_> {
    fn refuse(&mut self, code: &'static str, id: &str, detail: impl Into<String>) {
        debug_assert!(REFUSAL_CODES.contains(&code), "unlisted refusal code {code}");
        if self.refusals.len() < MAX_REFUSALS {
            let id: String = id.chars().take(MAX_ID).collect();
            self.refusals.push(Refusal { code, id, detail: detail.into() });
        } else {
            self.dropped += 1;
        }
    }

    fn spend(&mut self, n: usize, id: &str) -> bool {
        self.segments = self.segments.saturating_add(n);
        if self.segments > MAX_SEGMENTS {
            self.refuse("budget-path", id, format!("the page holds more than {MAX_SEGMENTS} path segments"));
            return false;
        }
        true
    }
}

fn finite(v: f64) -> bool {
    v.is_finite() && v.abs() <= MAX_COORD
}

fn unit(v: f64) -> bool {
    v.is_finite() && (0.0..=1.0).contains(&v)
}

fn hex_digit(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

/// `#rrggbb`, the only spelling a resolved page writes for a paint.
fn rrggbb(s: &str) -> Option<[u8; 3]> {
    let b = s.as_bytes();
    if b.len() != 7 || b[0] != b'#' {
        return None;
    }
    let mut out = [0u8; 3];
    for (i, o) in out.iter_mut().enumerate() {
        *o = hex_digit(b[1 + i * 2])? * 16 + hex_digit(b[2 + i * 2])?;
    }
    Some(out)
}

/// What a run's own colour draws in, as the SVG writer reads it: a value matching
/// `#` and three to eight hex digits is used; anything else falls back to the ink.
/// Three, four, six and eight digits are CSS colours; five and seven are not.
enum RunColour {
    Ink,
    Own(Rgba),
    Unreadable,
}

fn run_colour(s: Option<&str>) -> RunColour {
    let Some(s) = s else { return RunColour::Ink };
    let b = s.as_bytes();
    if b.len() < 4 || b.len() > 9 || b[0] != b'#' || !b[1..].iter().all(|c| hex_digit(*c).is_some()) {
        return RunColour::Ink;
    }
    let d: Vec<u8> = b[1..].iter().map(|c| hex_digit(*c).unwrap_or(0)).collect();
    let (r, g, bl, a) = match d.len() {
        3 => (d[0] * 17, d[1] * 17, d[2] * 17, 255),
        4 => (d[0] * 17, d[1] * 17, d[2] * 17, d[3] * 17),
        6 => (d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5], 255),
        8 => (d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5], d[6] * 16 + d[7]),
        _ => return RunColour::Unreadable,
    };
    RunColour::Own(Rgba(r as f32 / 255.0, g as f32 / 255.0, bl as f32 / 255.0, a as f32 / 255.0))
}

fn rgba(rgb: [u8; 3], alpha: f64) -> Rgba {
    Rgba(rgb[0] as f32 / 255.0, rgb[1] as f32 / 255.0, rgb[2] as f32 / 255.0, alpha as f32)
}

/// `cos` and `sin` of a turn in degrees: exact at the quarter turns, as Skia snaps
/// them, and otherwise from libm, which gives the same bits on every machine.
fn turn(deg: f64) -> (f64, f64) {
    let q = deg / 90.0;
    if q == libm::trunc(q) {
        let k = (libm::fmod(q, 4.0) + 4.0) % 4.0;
        return match k as i32 {
            0 => (1.0, 0.0),
            1 => (0.0, 1.0),
            2 => (-1.0, 0.0),
            _ => (0.0, -1.0),
        };
    }
    let r = deg * core::f64::consts::PI / 180.0;
    (libm::cos(r), libm::sin(r))
}

/// The pose about the box centre: translate, rotate, mirror, translate back.
fn pose_matrix(op: &Op) -> [f64; 6] {
    let Some(p) = op.pose else { return [1.0, 0.0, 0.0, 1.0, 0.0, 0.0] };
    let (c, s) = turn(p.rot);
    let (fx, fy) = (if p.flip_h { -1.0 } else { 1.0 }, if p.flip_v { -1.0 } else { 1.0 });
    let (a, b, cc, d) = (c * fx, s * fx, -s * fy, c * fy);
    let (cx, cy) = (op.bbox.x + op.bbox.w / 2.0, op.bbox.y + op.bbox.h / 2.0);
    [a, b, cc, d, cx - (a * cx + cc * cy), cy - (b * cx + d * cy)]
}

/// Gradient stops as tiny-skia reads them. CSS blends neighbouring stops premultiplied
/// and tiny-skia blends them straight; the two differ only where a pair changes both
/// colour and opacity, so such a pair is sampled 32 times with premultiplied colours,
/// as the resvg route does (packages/node-shell/src/design-still.ts).
fn stops_of(a: &mut Admit, id: &str, stops: &[input::Stop]) -> Option<Vec<GradientStop>> {
    if stops.len() < 2 || stops.len() > MAX_STOPS {
        a.refuse("gradient", id, format!("a gradient with {} stops (2 to {MAX_STOPS} are read)", stops.len()));
        return None;
    }
    let mut read: Vec<(f64, [u8; 3], f64)> = Vec::with_capacity(stops.len());
    for s in stops {
        let Some(rgb) = rrggbb(&s.color) else {
            a.refuse("colour", id, format!("a gradient stop colour \"{}\" that is not #rrggbb", truncate(&s.color)));
            return None;
        };
        if !unit(s.offset) || !unit(s.opacity) || read.last().is_some_and(|l| s.offset < l.0) {
            a.refuse("gradient", id, "a gradient stop out of order or out of range");
            return None;
        }
        read.push((s.offset, rgb, s.opacity));
    }
    const SAMPLES: usize = 32;
    let mut out = Vec::new();
    let put = |out: &mut Vec<GradientStop>, offset: f64, rgb: [f64; 3], alpha: f64| {
        out.push(GradientStop {
            offset: offset as f32,
            color: Rgba((rgb[0] / 255.0) as f32, (rgb[1] / 255.0) as f32, (rgb[2] / 255.0) as f32, alpha as f32),
        });
    };
    let f = |c: [u8; 3]| [c[0] as f64, c[1] as f64, c[2] as f64];
    put(&mut out, read[0].0, f(read[0].1), read[0].2);
    for pair in read.windows(2) {
        let (p, q) = (pair[0], pair[1]);
        let both = p.2 != q.2 && p.1 != q.1;
        let n = if both { SAMPLES } else { 1 };
        for k in 1..=n {
            let t = k as f64 / n as f64;
            let alpha = p.2 + (q.2 - p.2) * t;
            let rgb = if !both {
                if k == n {
                    f(q.1)
                } else {
                    f(p.1)
                }
            } else if alpha > 0.0 {
                let mut c = [0.0; 3];
                for (i, v) in c.iter_mut().enumerate() {
                    *v = (f(p.1)[i] * p.2 * (1.0 - t) + f(q.1)[i] * q.2 * t) / alpha;
                }
                c
            } else if t < 0.5 {
                f(q.1)
            } else {
                f(p.1)
            };
            put(&mut out, p.0 + (q.0 - p.0) * t, rgb, alpha);
        }
    }
    Some(out)
}

fn truncate(s: &str) -> String {
    s.chars().take(64).collect()
}

/// The box outline an area or shape names, or a refusal.
fn outline_of(a: &mut Admit, id: &str, bbox: input::DrawBox, shape: &input::Shape, what: &str) -> Option<Outline> {
    if ![bbox.x, bbox.y, bbox.w, bbox.h].iter().all(|v| finite(*v)) || bbox.w <= 0.0 || bbox.h <= 0.0 {
        a.refuse("geometry", id, format!("{what} with no finite size"));
        return None;
    }
    match shape.kind.as_str() {
        "ellipse" => {
            if shape.radius.is_some()
                || shape.corners.is_some()
                || shape.contours.is_some()
                || shape.even_odd.is_some()
                || shape.commands.is_some()
            {
                a.refuse("shape", id, format!("{what}: an ellipse with fields an ellipse does not have"));
                return None;
            }
            Some(Outline { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, ellipse: true, radius: 0.0, corners: None })
        }
        "rect" => {
            // Eight radii of their own: the engine writes them for the edges of a border of
            // unequal sides (`strokeRing`), each corner across then down from the top left.
            let corners = match &shape.corners {
                None => None,
                Some(c) if c.len() == 8 && c.iter().all(|v| v.is_finite() && *v >= 0.0 && *v <= MAX_COORD) => {
                    Some([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]])
                }
                Some(_) => {
                    a.refuse("corner-radii", id, format!("{what}: corner radii other than eight finite lengths"));
                    return None;
                }
            };
            if shape.contours.is_some() || shape.even_odd.is_some() || shape.commands.is_some() {
                a.refuse("shape", id, format!("{what}: a rectangle with path fields"));
                return None;
            }
            let r = shape.radius.unwrap_or(f64::NAN);
            if !r.is_finite() || r < 0.0 || r > bbox.w.min(bbox.h) / 2.0 + 1e-9 {
                a.refuse("shape", id, format!("{what}: a corner radius outside the box"));
                return None;
            }
            Some(Outline { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h, ellipse: false, radius: r.min(bbox.w.min(bbox.h) / 2.0), corners })
        }
        "path" => {
            a.refuse("shape", id, format!("{what} is a path where a rectangle or ellipse is read"));
            None
        }
        other => {
            a.refuse("unknown-shape", id, format!("{what}: an unknown shape kind \"{}\"", truncate(other)));
            None
        }
    }
}

fn area_of(a: &mut Admit, id: &str, area: &Area, what: &str) -> Option<Outline> {
    outline_of(a, id, area.bbox, &area.shape, what)
}

fn outline_path(o: &Outline, res: f64) -> Option<Path> {
    let mut b = PathBuilder::new();
    push_outline(&mut b, o, res).then_some(())?;
    b.finish()
}

enum ReadPaint {
    Color(Rgba),
    Linear { x1: f64, y1: f64, x2: f64, y2: f64, stops: Vec<input::Stop> },
    Radial { stops: Vec<input::Stop> },
}

fn read_paint(a: &mut Admit, id: &str, p: &Paint) -> Option<ReadPaint> {
    let geometry = [p.x1, p.y1, p.x2, p.y2];
    match p.kind.as_str() {
        "color" => {
            if geometry.iter().any(Option::is_some) || p.stops.is_some() {
                a.refuse("paint", id, "a colour paint with gradient fields");
                return None;
            }
            let Some(rgb) = p.color.as_deref().and_then(rrggbb) else {
                a.refuse("colour", id, format!("a paint colour \"{}\" that is not #rrggbb", truncate(p.color.as_deref().unwrap_or(""))));
                return None;
            };
            let alpha = p.opacity.unwrap_or(1.0);
            if !unit(alpha) {
                a.refuse("paint", id, "a paint opacity outside 0 to 1");
                return None;
            }
            Some(ReadPaint::Color(rgba(rgb, alpha)))
        }
        "linear" => {
            if p.color.is_some() || p.opacity.is_some() {
                a.refuse("paint", id, "a linear gradient with colour fields");
                return None;
            }
            let [Some(x1), Some(y1), Some(x2), Some(y2)] = geometry else {
                a.refuse("paint", id, "a linear gradient without its line");
                return None;
            };
            if ![x1, y1, x2, y2].iter().all(|v| finite(*v)) || (x1 == x2 && y1 == y2) {
                a.refuse("gradient", id, "a linear gradient line of no length or outside the page");
                return None;
            }
            let Some(stops) = &p.stops else {
                a.refuse("paint", id, "a gradient without stops");
                return None;
            };
            Some(ReadPaint::Linear {
                x1,
                y1,
                x2,
                y2,
                stops: stops.iter().map(|s| input::Stop { offset: s.offset, color: s.color.clone(), opacity: s.opacity }).collect(),
            })
        }
        "radial" => {
            if p.color.is_some() || p.opacity.is_some() || geometry.iter().any(Option::is_some) {
                a.refuse("paint", id, "a radial gradient with fields it does not have");
                return None;
            }
            let Some(stops) = &p.stops else {
                a.refuse("paint", id, "a gradient without stops");
                return None;
            };
            Some(ReadPaint::Radial {
                stops: stops.iter().map(|s| input::Stop { offset: s.offset, color: s.color.clone(), opacity: s.opacity }).collect(),
            })
        }
        other => {
            a.refuse("unknown-paint", id, format!("an unknown paint kind \"{}\"", truncate(other)));
            None
        }
    }
}

fn stroke_colour(a: &mut Admit, id: &str, s: &Stroke) -> Option<Rgba> {
    let Some(rgb) = rrggbb(&s.color) else {
        a.refuse("colour", id, format!("a stroke colour \"{}\" that is not #rrggbb", truncate(&s.color)));
        return None;
    };
    let alpha = s.opacity.unwrap_or(1.0);
    if !unit(alpha) || !s.width.is_finite() || s.width <= 0.0 || s.width > MAX_STROKE {
        a.refuse("stroke", id, "a stroke opacity outside 0 to 1, or a width outside what is read");
        return None;
    }
    Some(rgba(rgb, alpha))
}

/// A gradient over `tile`, the box CSS sizes a background image to.
fn gradient_ink(a: &mut Admit, id: &str, paint: ReadPaint, tile: &Outline) -> Option<Ink> {
    match paint {
        ReadPaint::Color(c) => Some(Ink::Solid(c)),
        ReadPaint::Linear { x1, y1, x2, y2, stops } => Some(Ink::Linear { x1, y1, x2, y2, stops: stops_of(a, id, &stops)? }),
        ReadPaint::Radial { stops } => Some(Ink::Radial {
            cx: tile.x + tile.w / 2.0,
            cy: tile.y + tile.h / 2.0,
            rx: tile.w * core::f64::consts::FRAC_1_SQRT_2,
            ry: tile.h * core::f64::consts::FRAC_1_SQRT_2,
            stops: stops_of(a, id, &stops)?,
        }),
    }
}

/// An approximate length of a path's control polygon, an upper bound on its arc length.
fn polygon_length(path: &Path) -> f64 {
    let mut len = 0.0f64;
    let mut at = (0.0f32, 0.0f32);
    let mut start = at;
    let dist = |p: (f32, f32), q: (f32, f32)| -> f64 {
        let (dx, dy) = ((q.0 - p.0) as f64, (q.1 - p.1) as f64);
        (dx * dx + dy * dy).sqrt()
    };
    for seg in path.segments() {
        match seg {
            tiny_skia::PathSegment::MoveTo(p) => {
                at = (p.x, p.y);
                start = at;
            }
            tiny_skia::PathSegment::LineTo(p) => {
                len += dist(at, (p.x, p.y));
                at = (p.x, p.y);
            }
            tiny_skia::PathSegment::QuadTo(c, p) => {
                len += dist(at, (c.x, c.y)) + dist((c.x, c.y), (p.x, p.y));
                at = (p.x, p.y);
            }
            tiny_skia::PathSegment::CubicTo(c1, c2, p) => {
                len += dist(at, (c1.x, c1.y)) + dist((c1.x, c1.y), (c2.x, c2.y)) + dist((c2.x, c2.y), (p.x, p.y));
                at = (p.x, p.y);
            }
            tiny_skia::PathSegment::Close => {
                len += dist(at, start);
                at = start;
            }
        }
    }
    len
}

/// A cubic whose control points sit a third and two thirds along its chord is a line,
/// as the engine's `toSvgPathData` writes it (`isStraight` in engine/src/geom/path.ts).
fn straight(k: &[f64; 8]) -> bool {
    let (dx, dy) = (k[6] - k[0], k[7] - k[1]);
    let len = hypot(dx, dy);
    if len < 1e-9 {
        return false;
    }
    [(k[2], k[3], 1.0 / 3.0), (k[4], k[5], 2.0 / 3.0)]
        .iter()
        .all(|&(px, py, want)| hypot(px - (k[0] + dx * want), py - (k[1] + dy * want)) <= 1e-9 * len.max(1.0))
}

/// `Math.hypot` as V8 computes it (engine/src/geom/portable-math.ts), in exactly rounded operations.
fn hypot(x: f64, y: f64) -> f64 {
    let (a, b) = (x.abs(), y.abs());
    let m = if a > b { a } else { b };
    if m == 0.0 {
        return 0.0;
    }
    let (p, q) = (a / m, b / m);
    (p * p + q * q).sqrt() * m
}

/// A pen shape's contours as one path, every contour closed when `close_all` (a fill).
fn contours_path(a: &mut Admit, id: &str, contours: &[input::Contour], close_all: bool) -> Option<Option<Path>> {
    let total: usize = contours.iter().map(|c| c.curves.len() + 2).sum();
    if !a.spend(total, id) {
        return None;
    }
    let mut b = PathBuilder::new();
    for c in contours {
        let Some(first) = c.curves.first() else { continue };
        if !c.curves.iter().all(|k| k.iter().all(|v| finite(*v))) {
            a.refuse("geometry", id, "a path coordinate that is not finite or is outside the page");
            return None;
        }
        b.move_to(first[0] as f32, first[1] as f32);
        for k in &c.curves {
            if straight(k) {
                b.line_to(k[6] as f32, k[7] as f32);
            } else {
                b.cubic_to(k[2] as f32, k[3] as f32, k[4] as f32, k[5] as f32, k[6] as f32, k[7] as f32);
            }
        }
        if c.closed || close_all {
            b.close();
        }
    }
    Some(b.finish())
}

/// Where CSS draws a picture inside its element: the engine's `pictureRect`
/// (engine/src/design-draw.ts) step for step, with JavaScript's `Math.round`.
fn picture_rect(p: &input::Picture, iw: f64, ih: f64) -> [f64; 4] {
    let js_round = |v: f64| libm::floor(v + 0.5);
    let a = p.area;
    let contain = (a.w / iw).min(a.h / ih);
    let scale = match p.fit.as_str() {
        "cover" => (a.w / iw).max(a.h / ih),
        "none" => 1.0,
        "scale-down" => contain.min(1.0),
        _ => contain,
    };
    let (w, h) = if p.fit == "fill" { (a.w, a.h) } else { (iw * scale, ih * scale) };
    let x = a.x + ((a.w - w) * p.x) / 100.0;
    let y = a.y + ((a.h - h) * p.y) / 100.0;
    let (left, top, right, bottom) = (js_round(x), js_round(y), js_round(x + w), js_round(y + h));
    let ox = a.x + (a.w * p.x) / 100.0;
    let oy = a.y + (a.h * p.y) / 100.0;
    let z = p.zoom;
    [ox + (left - ox) * z, oy + (top - oy) * z, (right - left) * z, (bottom - top) * z]
}

/// The most picture pixels one page decodes.
pub const MAX_PAGE_PICTURE_PIXELS: u64 = 64 * 1024 * 1024;

/// A picture as the SVG writer draws it: laid out by `picture_rect`, clipped to its element
/// (unless the box's own clip lies inside a plain square element) and then to the box. A
/// plain rectangular clip narrows the drawn rectangle; a rounded or elliptical one is a mask.
fn picture_steps(a: &mut Admit, id: &str, p: &input::Picture, steps: &mut Vec<Step>) {
    if !matches!(p.fit.as_str(), "contain" | "cover" | "fill" | "none" | "scale-down") {
        a.refuse("picture", id, format!("a picture fit \"{}\" Design does not write", truncate(&p.fit)));
        return;
    }
    let pa = p.area;
    let placed = [p.x, p.y].iter().all(|v| v.is_finite() && (0.0..=100.0).contains(v))
        && p.zoom.is_finite()
        && p.zoom > 0.0
        && p.zoom <= 100.0
        && [pa.x, pa.y, pa.w, pa.h].iter().all(|v| finite(*v))
        && pa.w >= 0.0
        && pa.h >= 0.0;
    if !placed {
        a.refuse("picture", id, "a picture placed outside the page or zoomed beyond what Design writes");
        return;
    }
    let element = area_of(a, id, &p.element, "the picture's element");
    let clip = match &p.clip {
        Some(c) => match area_of(a, id, c, "the picture's clip") {
            Some(o) => Some(o),
            None => return,
        },
        None => None,
    };
    let Some(element) = element else { return };
    let Some(resource) = a.resources.get(p.reference.as_str()).copied() else {
        a.refuse("picture-missing", id, "a picture whose bytes the input does not carry");
        return;
    };
    let index = match a.decoded.get(p.reference.as_str()) {
        Some(done) => done.clone(),
        None => {
            let result = match base64(&resource.data) {
                None => Err(PictureRefusal { code: "picture-unreadable", detail: "picture data that is not standard base64".into() }),
                Some(bytes) => decode(&bytes).and_then(|d| {
                    a.picture_pixels += d.width as u64 * d.height as u64;
                    if a.picture_pixels > MAX_PAGE_PICTURE_PIXELS {
                        return Err(PictureRefusal {
                            code: "picture-size",
                            detail: format!("more than {MAX_PAGE_PICTURE_PIXELS} picture pixels on the page"),
                        });
                    }
                    a.pictures.push(d);
                    Ok(a.pictures.len() - 1)
                }),
            };
            a.decoded.insert(resource.reference.as_str(), result.clone());
            result
        }
    };
    let index = match index {
        Ok(i) => i,
        Err(r) => {
            a.refuse(r.code, id, r.detail);
            return;
        }
    };
    let (iw, ih) = (a.pictures[index].width as f64, a.pictures[index].height as f64);
    if let Some(n) = &p.natural {
        if n.width != iw || n.height != ih {
            a.refuse("picture-size", id, format!("a picture of {iw} x {ih} that the engine placed as {} x {}", n.width, n.height));
            return;
        }
    }
    let rect = picture_rect(p, iw, ih);
    let mut visible = [rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]];
    let square = !element.ellipse && element.radius == 0.0;
    let mut outlines = Vec::new();
    if !(clip.is_some() && square && p.zoom >= 1.0) {
        outlines.push(element);
    }
    outlines.extend(clip);
    let mut clips = Vec::new();
    for o in outlines {
        if !o.ellipse && o.radius == 0.0 {
            visible = [visible[0].max(o.x), visible[1].max(o.y), visible[2].min(o.x + o.w), visible[3].min(o.y + o.h)];
        } else {
            clips.push(o);
        }
    }
    if visible[2] <= visible[0] || visible[3] <= visible[1] {
        return;
    }
    if a.spend(8, id) {
        steps.push(Step {
            draw: Draw::Rect([visible[0], visible[1], visible[2] - visible[0], visible[3] - visible[1]]),
            ink: Ink::Picture { index, rect },
            words: false,
            clips,
        });
    }
}

/// The CSS blend mode keywords Design writes, as tiny-skia names them.
fn blend_mode(name: &str) -> Option<BlendMode> {
    Some(match name {
        "multiply" => BlendMode::Multiply,
        "screen" => BlendMode::Screen,
        "overlay" => BlendMode::Overlay,
        "darken" => BlendMode::Darken,
        "lighten" => BlendMode::Lighten,
        "color-dodge" => BlendMode::ColorDodge,
        "color-burn" => BlendMode::ColorBurn,
        "hard-light" => BlendMode::HardLight,
        "soft-light" => BlendMode::SoftLight,
        "difference" => BlendMode::Difference,
        "exclusion" => BlendMode::Exclusion,
        "hue" => BlendMode::Hue,
        "saturation" => BlendMode::Saturation,
        "color" => BlendMode::Color,
        "luminosity" => BlendMode::Luminosity,
        _ => return None,
    })
}

/// An operation's blend, layer blur and shadow, read as the engine's `effectsOf` writes them.
fn effects_of(a: &mut Admit, op: &Op, is_frame: bool) -> Effects {
    let id = op.id.as_str();
    let mut fx = Effects::default();
    if is_frame && (op.blend.is_some() || op.shadow.is_some() || op.blur.is_some()) {
        a.refuse("shadow", id, "a frame with a blend, blur or shadow of its own");
        return fx;
    }
    match op.blend.as_deref() {
        None | Some("normal") => {}
        Some(name) => match blend_mode(name) {
            Some(m) => fx.blend = Some(m),
            None => a.refuse("blend", id, format!("the blend mode \"{}\", which CSS does not name", truncate(name))),
        },
    }
    if let Some(b) = op.blur {
        if !b.is_finite() || !(0.0..=300.0).contains(&b) {
            a.refuse("blur", id, "a layer blur outside 0 to 300");
        } else {
            fx.blur = b;
        }
    }
    if let Some(sh) = &op.shadow {
        let Some(rgb) = rrggbb(&sh.color) else {
            a.refuse("colour", id, format!("a shadow colour \"{}\" that is not #rrggbb", truncate(&sh.color)));
            return fx;
        };
        let alpha = sh.opacity.unwrap_or(1.0);
        if !unit(alpha)
            || !finite(sh.dx)
            || !finite(sh.dy)
            || sh.dx.abs() > 1000.0
            || sh.dy.abs() > 1000.0
            || !sh.blur.is_finite()
            || !(0.0..=600.0).contains(&sh.blur)
        {
            a.refuse("shadow", id, "a shadow offset, blur or opacity outside what Design writes");
            return fx;
        }
        let color = rgba(rgb, alpha);
        match sh.target.as_str() {
            // CSS box-shadow and text-shadow take half the blur as the deviation; drop-shadow takes the blur.
            "box" => match &op.outline {
                Some(shape) => {
                    if let Some(o) = outline_of(a, id, op.bbox, shape, "the shadow's outline") {
                        fx.box_shadow = Some((Shadow { dx: sh.dx, dy: sh.dy, sigma: sh.blur / 2.0, color }, o));
                    }
                }
                None => a.refuse("shadow", id, "a box shadow without the outline it follows"),
            },
            "content" => fx.drop = Some(Shadow { dx: sh.dx, dy: sh.dy, sigma: sh.blur, color }),
            "text" => fx.text = Some(Shadow { dx: sh.dx, dy: sh.dy, sigma: sh.blur / 2.0, color }),
            other => a.refuse("shadow", id, format!("an unknown shadow target \"{}\"", truncate(other))),
        }
    } else if op.outline.is_some() {
        a.refuse("shape", id, "a shadow outline without a shadow");
    }
    fx
}

/// One operation as an item, or None once the operation is refused.
fn item(a: &mut Admit, op: &Op, is_frame: bool) -> Option<Item> {
    let id = op.id.as_str();
    let before = a.refusals.len() + a.dropped;
    if op.id.chars().count() > MAX_ID {
        a.refuse("id", id, format!("a row id longer than {MAX_ID} characters"));
    }
    match op.op.as_str() {
        "shape" => {}
        "image" | "text" => {
            a.refuse("preview-op", id, format!("an {} operation of the preview reading; Design pages hold shape operations", op.op));
            return None;
        }
        other => {
            a.refuse("unknown-op", id, format!("an unknown operation \"{}\"", truncate(other)));
            return None;
        }
    }
    if op.compatibility.is_some() || op.fill_rule.is_some() {
        a.refuse("compatibility-reading", id, "a compatibility reading (Lottie, Penpot or PPTX), not Design's own");
    }
    if op.reference.is_some() || op.fit.is_some() || op.label.is_some() || op.text.is_some() {
        a.refuse("shape", id, "a shape operation with image or text operation fields");
    }
    let b = op.bbox;
    if ![b.x, b.y, b.w, b.h].iter().all(|v| finite(*v)) || b.w <= 0.0 || b.h <= 0.0 {
        a.refuse("geometry", id, "a box with no finite size");
        return None;
    }
    if !op.opacity.is_finite() || !(0.0..=100.0).contains(&op.opacity) {
        a.refuse("opacity", id, "an opacity outside 0 to 100");
    }
    if let Some(p) = op.pose {
        if !finite(p.rot) {
            a.refuse("pose", id, "a turn that is not finite");
        }
        if is_frame {
            a.refuse("pose", id, "a turned or mirrored frame");
        }
    }
    let mut row_clip = None;
    if let Some(clip) = &op.clip {
        if is_frame {
            a.refuse("row-clip", id, "a frame clipped by another row");
        } else if clip.points.len() < 3 || clip.points.len() > MAX_CLIP_POINTS || !clip.points.iter().all(|p| finite(p[0]) && finite(p[1]))
        {
            a.refuse(
                "row-clip",
                id,
                format!("a clip polygon of {} points (3 to {MAX_CLIP_POINTS} finite points are read)", clip.points.len()),
            );
        } else if op.pose.is_some_and(|p| p.flip_h || p.flip_v) {
            a.refuse("row-clip-mirrored", id, "a clip on a mirrored row, which Design draws mirrored about the box");
        } else {
            let mut pb = PathBuilder::new();
            pb.move_to(clip.points[0][0] as f32, clip.points[0][1] as f32);
            for p in &clip.points[1..] {
                pb.line_to(p[0] as f32, p[1] as f32);
            }
            pb.close();
            a.spend(clip.points.len() + 1, id);
            row_clip = pb.finish();
        }
    }
    let effects = effects_of(a, op, is_frame);
    let (Some(shape), Some(fills)) = (&op.shape, &op.fills) else {
        a.refuse("shape", id, "a shape operation without its shape or fills");
        return None;
    };
    let res = a.res;
    let mut steps: Vec<Step> = Vec::new();
    let mut words_clip: Option<Outline> = None;
    if shape.kind == "path" {
        if is_frame {
            a.refuse("shape", id, "a frame drawn as a path");
            return None;
        }
        if shape.radius.is_some() || shape.corners.is_some() {
            a.refuse("shape", id, "a path with rectangle fields");
        }
        if shape.commands.is_some() {
            a.refuse("compatibility-reading", id, "a path that keeps Lottie commands");
        }
        let (Some(contours), Some(even_odd)) = (&shape.contours, shape.even_odd) else {
            a.refuse("shape", id, "a path without its contours or fill rule");
            return None;
        };
        if op.words.is_some() {
            a.refuse("words", id, "words on a path, which Design does not draw");
        }
        if fills.len() > 1 {
            a.refuse("paint-order", id, "a path with more than one fill");
        }
        let mut fill_ink = None;
        if let Some(p) = fills.first() {
            match read_paint(a, id, p)? {
                ReadPaint::Color(c) => fill_ink = Some(c),
                _ => a.refuse("path-gradient", id, "a gradient on a path, which Design does not paint"),
            }
        }
        let rule = if even_odd { FillRule::EvenOdd } else { FillRule::Winding };
        if let Some(c) = fill_ink {
            if let Some(path) = contours_path(a, id, contours, true)? {
                steps.push(Step { draw: Draw::Fill { path, rule }, ink: Ink::Solid(c), words: false, clips: Vec::new() });
            }
        }
        if let Some(s) = &op.stroke {
            let colour = stroke_colour(a, id, s);
            // The engine keeps a stroke to one side only on closed contours, and the SVG writer
            // clips the outside with the even-odd rule.
            let side = match s.align.as_deref() {
                None | Some("center") => Some(None),
                Some("inside") => Some(Some((true, if even_odd { FillRule::EvenOdd } else { FillRule::Winding }))),
                Some("outside") => Some(Some((false, FillRule::EvenOdd))),
                Some(other) => {
                    a.refuse("pen-stroke-side", id, format!("an unknown pen stroke side \"{}\"", truncate(other)));
                    None
                }
            };
            let cap = match s.cap.as_deref().unwrap_or("butt") {
                "butt" => Some(LineCap::Butt),
                "round" => Some(LineCap::Round),
                "square" => Some(LineCap::Square),
                _ => None,
            };
            let join = match s.join.as_deref().unwrap_or("miter") {
                "miter" => Some(LineJoin::Miter),
                "round" => Some(LineJoin::Round),
                "bevel" => Some(LineJoin::Bevel),
                _ => None,
            };
            if cap.is_none() || join.is_none() {
                a.refuse("stroke-style", id, "a stroke cap or join that SVG does not name");
            }
            let dash = match &s.dash {
                None => Some(None),
                Some(d) if d.len() == 2 && d.iter().all(|v| v.is_finite() && *v >= 0.0 && *v <= MAX_STROKE) && d[0] + d[1] > 0.0 => {
                    match StrokeDash::new(vec![d[0] as f32, d[1] as f32], 0.0) {
                        Some(dash) => Some(Some((d[0] + d[1], dash))),
                        None => {
                            a.refuse("stroke-dash", id, "a dash pattern tiny-skia cannot draw");
                            None
                        }
                    }
                }
                Some(_) => {
                    a.refuse("stroke-dash", id, "a dash pattern other than one dash and one gap");
                    None
                }
            };
            if let (Some(colour), Some(cap), Some(join), Some(dash), Some(side)) = (colour, cap, join, dash, side) {
                if let Some(path) = contours_path(a, id, contours, false)? {
                    if let Some((period, _)) = &dash {
                        if polygon_length(&path) / period > MAX_DASHES {
                            a.refuse("budget-dash", id, format!("a dashed stroke of more than {MAX_DASHES} dashes"));
                        }
                    }
                    steps.push(Step {
                        draw: Draw::Stroke { path, width: s.width as f32, cap, join, dash: dash.map(|(_, d)| d), side },
                        ink: Ink::Solid(colour),
                        words: false,
                        clips: Vec::new(),
                    });
                }
            }
        }
        if let Some(p) = &op.picture {
            picture_steps(a, id, p, &mut steps);
        }
    } else {
        let o = outline_of(a, id, b, shape, "the box")?;
        if fills.len() > 2 {
            a.refuse("paint-order", id, "more than a colour and a gradient");
        }
        let mut read = Vec::new();
        for p in fills.iter().take(2) {
            read.push(read_paint(a, id, p)?);
        }
        if read.len() == 2 && (!matches!(read[0], ReadPaint::Color(_)) || matches!(read[1], ReadPaint::Color(_))) {
            a.refuse("paint-order", id, "fills other than a colour under a gradient");
        }
        if read.len() == 1 && is_frame && !matches!(read[0], ReadPaint::Color(_)) {
            a.refuse("paint-order", id, "a frame without its own colour");
        }
        // A border: its colour, its four widths and the part of each width outside the box.
        let mut border: Option<(Rgba, [f64; 4], f64)> = None;
        if let Some(s) = &op.stroke {
            let colour = stroke_colour(a, id, s);
            let out = match s.align.as_deref() {
                Some("inside") => Some(0.0),
                Some("center") => Some(0.5),
                Some("outside") => Some(1.0),
                None => {
                    a.refuse("stroke-align", id, "a centred box outline of the preview reading");
                    None
                }
                Some(other) => {
                    a.refuse("stroke-align", id, format!("an unknown stroke alignment \"{}\"", truncate(other)));
                    None
                }
            };
            let sides = match &s.sides {
                None => Some([s.width; 4]),
                Some(v) if v.len() == 4 && v.iter().all(|w| w.is_finite() && (0.0..=MAX_STROKE).contains(w)) => {
                    Some([v[0], v[1], v[2], v[3]])
                }
                Some(_) => {
                    a.refuse("stroke-sides", id, "per-side widths other than four finite widths");
                    None
                }
            };
            if s.dash.is_some() {
                a.refuse("box-dash", id, "a dashed box outline of the preview reading");
            }
            if s.cap.is_some() || s.join.is_some() {
                a.refuse("stroke-style", id, "a box border with a cap or join");
            }
            if let (Some(c), Some(out), Some(sides)) = (colour, out, sides) {
                border = Some((c, sides, out));
                if c.3 < 1.0 && out == 0.0 && read.iter().any(|p| !matches!(p, ReadPaint::Color(_))) {
                    a.refuse(
                        "gradient-under-translucent-border",
                        id,
                        "a gradient under a translucent border, where CSS repeats the gradient into the border",
                    );
                }
            }
        }
        // The border's outer edge and the padding box inside it, where the gradient tile, the
        // picture and the words sit (the engine's `strokeRing` and `paddingArea`).
        let (outer, inner) = match border {
            Some((_, sides, out)) => ring(&o, out, sides),
            None => (o, Some(o)),
        };
        let tile = inner.unwrap_or(Outline {
            x: outer.x + outer.w / 2.0,
            y: outer.y + outer.h / 2.0,
            w: 0.0,
            h: 0.0,
            ellipse: o.ellipse,
            radius: 0.0,
            corners: None,
        });
        // What the background covers: the box under an inside border and the padding box under a
        // centred or outside one, as the SVG writer paints it. Under an opaque inside border on a
        // curved box the background is inset by half the border, Chromium's background bleed
        // avoidance (`BackgroundRoundedRectAdjustedForBleedAvoidance`), so the outer edge is
        // anti-aliased once rather than twice.
        let painted = match border {
            Some((colour, sides, out)) if out == 0.0 && colour.3 >= 1.0 && o.curved() => ring(&o, 0.0, sides.map(|v| v / 2.0)).1,
            Some((_, _, out)) if out > 0.0 => inner,
            _ => Some(o),
        };
        if !a.spend(16, id) {
            return None;
        }
        if let Some(painted) = painted.filter(|p| p.w > 0.0 && p.h > 0.0) {
            let outline = outline_path(&painted, res);
            for p in read {
                let Some(ink) = gradient_ink(a, id, p, &tile) else { continue };
                let draw = if !painted.curved() {
                    Draw::Rect([painted.x, painted.y, painted.w, painted.h])
                } else if let Some(path) = &outline {
                    Draw::Fill { path: path.clone(), rule: FillRule::Winding }
                } else {
                    continue;
                };
                steps.push(Step { draw, ink, words: false, clips: Vec::new() });
            }
        }
        if let Some((colour, _, _)) = border {
            // A CSS border: the ring between its outer edge and the padding box.
            let mut pb = PathBuilder::new();
            push_outline(&mut pb, &outer, res);
            if let Some(hole) = &inner {
                push_outline(&mut pb, hole, res);
            }
            if let Some(path) = pb.finish() {
                steps.push(Step {
                    draw: Draw::Fill { path, rule: FillRule::EvenOdd },
                    ink: Ink::Solid(colour),
                    words: false,
                    clips: Vec::new(),
                });
            }
        }
        // CSS paints a box's picture over its background and border, under its words.
        if let Some(p) = &op.picture {
            picture_steps(a, id, p, &mut steps);
        }
        if let Some(words) = &op.words {
            if is_frame {
                a.refuse("words", id, "words on a frame");
            } else {
                let clip = tile;
                if let Some(glyph_bounds) = words_steps(a, id, &b, words, &mut steps) {
                    let margin = 1.0 / res;
                    if !glyph_bounds.iter().all(|g| box_inside(*g, &clip, margin)) {
                        // Measured: words a rounded box clips (the text fidelity page's
                        // overflow row) stay inside the word bands, so they are drawn.
                        words_clip = Some(clip);
                    }
                }
            }
        }
    }
    if a.refusals.len() + a.dropped > before {
        return None;
    }
    Some(Item { id: op.id.clone(), opacity: (op.opacity / 100.0) as f32, pose: pose_matrix(op), row_clip, words_clip, steps, effects })
}

/// The steps that draw a row's words, in CSS's order per run: the underline, the
/// glyphs, the strike, then underline pieces in another ink. Returns the bounds of
/// everything drawn (x0, y0, x1, y1 each), for the clip test.
fn words_steps(a: &mut Admit, id: &str, b: &input::DrawBox, words: &input::Words, steps: &mut Vec<Step>) -> Option<Vec<[f64; 4]>> {
    let Some(layout) = &words.layout else {
        a.refuse("text-unlaid", id, "words that the engine has not laid out");
        return None;
    };
    let Some(outlines) = &words.outlines else {
        a.refuse("live-text", id, "words that are not outlined, which this crate would have to shape");
        return None;
    };
    let Some(ink_rgb) = rrggbb(&words.ink) else {
        a.refuse("colour", id, format!("an ink \"{}\" that is not #rrggbb", truncate(&words.ink)));
        return None;
    };
    let ink_alpha = words.ink_opacity.unwrap_or(1.0);
    if !unit(ink_alpha) {
        a.refuse("words", id, "an ink opacity outside 0 to 1");
        return None;
    }
    let ink = rgba(ink_rgb, ink_alpha);
    if layout.lines.len() > MAX_LINES || layout.lines.iter().map(|l| l.runs.len()).sum::<usize>() > MAX_RUNS {
        a.refuse("budget-path", id, format!("a text block of more than {MAX_LINES} lines or {MAX_RUNS} runs"));
        return None;
    }
    if outlines.len() != layout.lines.len() || outlines.iter().zip(&layout.lines).any(|(o, l)| o.len() != l.runs.len()) {
        a.refuse("words", id, "outlines that do not match the laid-out lines and runs");
        return None;
    }
    let matches = |lens: Vec<usize>| lens.len() == layout.lines.len() && lens.iter().zip(&layout.lines).all(|(n, l)| *n == l.runs.len());
    if words.strikes.as_ref().is_some_and(|s| !matches(s.iter().map(Vec::len).collect())) {
        a.refuse("decoration", id, "strikes that do not match the laid-out lines and runs");
        return None;
    }
    if words.underlines.as_ref().is_some_and(|u| !matches(u.iter().map(Vec::len).collect())) {
        a.refuse("decoration", id, "underlines that do not match the laid-out lines and runs");
        return None;
    }
    let mut bounds = Vec::new();
    let rect = |a: &mut Admit, steps: &mut Vec<Step>, bounds: &mut Vec<[f64; 4]>, x: f64, y: f64, w: f64, h: f64, colour: Rgba| -> bool {
        if ![x, y, w, h].iter().all(|v| finite(*v)) || w < 0.0 || h < 0.0 {
            a.refuse("decoration", id, "a decoration outside the page");
            return false;
        }
        if w > 0.0 && h > 0.0 {
            if !a.spend(5, id) {
                return false;
            }
            steps.push(Step { draw: Draw::Rect([x, y, w, h]), ink: Ink::Solid(colour), words: true, clips: Vec::new() });
            bounds.push([x, y, x + w, y + h]);
        }
        true
    };
    for (li, line) in layout.lines.iter().enumerate() {
        if !finite(line.x) || !finite(line.baseline) {
            a.refuse("words", id, "a line placed outside the page");
            return None;
        }
        for (ri, run) in line.runs.iter().enumerate() {
            if !finite(run.x) || !run.width.is_finite() {
                a.refuse("words", id, "a run placed outside the page");
                return None;
            }
            // The SVG writer applies the ink's opacity only to paint spelled as the ink itself.
            let run_ink = match run_colour(run.color.as_deref()) {
                RunColour::Ink => ink,
                RunColour::Own(c) if run.color.as_deref() == Some(words.ink.as_str()) => Rgba(c.0, c.1, c.2, c.3 * ink_alpha as f32),
                RunColour::Own(c) => c,
                RunColour::Unreadable => {
                    a.refuse(
                        "colour",
                        id,
                        format!("a run colour \"{}\" that is not a CSS hex colour", truncate(run.color.as_deref().unwrap_or(""))),
                    );
                    return None;
                }
            };
            let ox = b.x + line.x + run.x;
            let oy = b.y + line.baseline;
            let Some(outline) = outlines[li][ri].as_deref() else {
                if run.text.is_empty() {
                    continue;
                }
                a.refuse("live-text", id, "a run the engine could not outline, which this crate would have to shape");
                return None;
            };
            let underline = words.underlines.as_ref().and_then(|u| u[li][ri].as_ref());
            let span_paint = |span: &input::UnderlineSpan| -> Option<Rgba> {
                match &span.ink {
                    None => Some(run_ink),
                    Some(s) if *s == words.ink => Some(ink),
                    Some(s) => match run_colour(Some(s)) {
                        RunColour::Own(c) => Some(c),
                        RunColour::Ink => Some(ink),
                        RunColour::Unreadable => None,
                    },
                }
            };
            let under = |a: &mut Admit, steps: &mut Vec<Step>, bounds: &mut Vec<[f64; 4]>, own_ink: bool| -> bool {
                let Some(u) = underline else { return true };
                for span in &u.spans {
                    if span.ink.is_none() != own_ink || span.width.is_nan() || span.width <= 0.0 {
                        continue;
                    }
                    let Some(paint) = span_paint(span) else {
                        a.refuse("colour", id, "an underline colour that is not a CSS hex colour");
                        return false;
                    };
                    if !rect(a, steps, bounds, ox + span.x, oy + u.y, span.width, u.height, paint) {
                        return false;
                    }
                }
                true
            };
            if !under(a, steps, &mut bounds, true) {
                return None;
            }
            if !outline.is_empty() {
                if outline.len() > MAX_RUN_PATH_BYTES {
                    a.refuse("budget-path", id, format!("a run outline longer than {MAX_RUN_PATH_BYTES} bytes"));
                    return None;
                }
                a.path_bytes += outline.len();
                if a.path_bytes > MAX_PAGE_PATH_BYTES {
                    a.refuse("budget-path", id, format!("outlines longer than {MAX_PAGE_PATH_BYTES} bytes on the page"));
                    return None;
                }
                let mut pb = PathBuilder::new();
                let mut budget = MAX_SEGMENTS.saturating_sub(a.segments);
                let before = budget;
                match append_path_data(&mut pb, outline, ox, oy, &mut budget) {
                    Ok(()) => {}
                    Err(PathDataError::Budget) => {
                        a.refuse("budget-path", id, format!("the page holds more than {MAX_SEGMENTS} path segments"));
                        return None;
                    }
                    Err(e) => {
                        a.refuse("outline", id, format!("a run outline this crate cannot read ({e:?})"));
                        return None;
                    }
                }
                a.segments += before - budget;
                if let Some(path) = pb.finish() {
                    let r = path.bounds();
                    bounds.push([r.left() as f64, r.top() as f64, r.right() as f64, r.bottom() as f64]);
                    steps.push(Step {
                        draw: Draw::Fill { path, rule: FillRule::Winding },
                        ink: Ink::Solid(run_ink),
                        words: true,
                        clips: Vec::new(),
                    });
                }
            }
            if let Some(s) = words.strikes.as_ref().and_then(|s| s[li][ri].as_ref()) {
                if s.width > 0.0 && !rect(a, steps, &mut bounds, ox, oy + s.y, s.width, s.height, run_ink) {
                    return None;
                }
            }
            if !under(a, steps, &mut bounds, false) {
                return None;
            }
        }
    }
    Some(bounds)
}

/// Read an input document and admit it, or return every reason it is refused.
pub fn admit_json(bytes: &[u8]) -> Result<Plan, Vec<Refusal>> {
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(vec![Refusal {
            code: "input-bytes",
            id: String::new(),
            detail: format!("an input of more than {MAX_INPUT_BYTES} bytes"),
        }]);
    }
    let input: Input = match serde_json::from_slice(bytes) {
        Ok(v) => v,
        Err(e) => {
            let message = e.to_string();
            let code = if message.contains("unknown field") { "input-field" } else { "input-json" };
            return Err(vec![Refusal { code, id: String::new(), detail: message.chars().take(512).collect() }]);
        }
    };
    admit(&input)
}

/// Admit a read input document.
pub fn admit(input: &Input) -> Result<Plan, Vec<Refusal>> {
    let mut a = Admit {
        refusals: Vec::new(),
        dropped: 0,
        segments: 0,
        path_bytes: 0,
        res: 1.0,
        resources: HashMap::new(),
        decoded: HashMap::new(),
        pictures: Vec::new(),
        picture_pixels: 0,
    };
    if input.resources.len() > MAX_OPS {
        a.refuse("picture", "", format!("{} pictures (at most {MAX_OPS})", input.resources.len()));
        return Err(a.refusals);
    }
    for r in &input.resources {
        if a.resources.insert(r.reference.as_str(), r).is_some() {
            a.refuse("picture", "", "two pictures with one reference");
            return Err(a.refusals);
        }
    }
    if input.format != INPUT_FORMAT {
        a.refuse("input-format", "", format!("the format \"{}\", not \"{INPUT_FORMAT}\"", truncate(&input.format)));
    }
    if input.version != INPUT_VERSION {
        a.refuse("input-version", "", format!("input version {}, not {INPUT_VERSION}", input.version));
    }
    let page = &input.page;
    if input.draw_version != DRAW_VERSION || page.version != DRAW_VERSION as f64 {
        a.refuse(
            "draw-version",
            "",
            format!("drawing operations of version {} and {}, not {DRAW_VERSION}", input.draw_version, page.version),
        );
    }
    if !a.refusals.is_empty() {
        return Err(a.refusals);
    }
    let out = &input.output;
    let whole = |v: f64| v.is_finite() && v == libm::trunc(v) && v >= 1.0 && v <= MAX_SIDE as f64;
    if !whole(out.width) || !whole(out.height) || (out.width as u64) * (out.height as u64) > MAX_PIXELS {
        a.refuse(
            "output-size",
            "",
            format!("an output of {} x {} (whole pixels, at most {MAX_SIDE} a side and {MAX_PIXELS} in all)", out.width, out.height),
        );
    }
    if out.dpi.is_some_and(|d| !d.is_finite() || !(1.0..=9600.0).contains(&d)) {
        a.refuse("output-dpi", "", "a resolution outside 1 to 9600 dpi");
    }
    if !page.width.is_finite() || !page.height.is_finite() || page.width < 1.0 || page.height < 1.0 || page.width > 1e5 || page.height > 1e5
    {
        a.refuse("page-size", "", "a page size outside 1 to 100000");
    }
    if !a.refusals.is_empty() {
        return Err(a.refusals);
    }
    // The browser tier scales a page to the export's width; another shape is anchored and
    // cropped there, which this crate does not copy (designStillSize in design-still.ts).
    if (out.height - page.height * (out.width / page.width)).abs() > 0.5 {
        a.refuse(
            "output-proportions",
            "",
            format!("an output of {} x {} for a page of {} x {}", out.width, out.height, page.width, page.height),
        );
    }
    let scale = (out.width / page.width, out.height / page.height);
    a.res = scale.0.max(scale.1);
    for f in &page.findings {
        a.refuse("finding", &f.id, format!("the engine reports {}", truncate(&f.feature)));
    }
    if page.ops.len() > MAX_OPS {
        a.refuse("budget-ops", "", format!("{} operations (at most {MAX_OPS})", page.ops.len()));
        return Err(a.refusals);
    }
    let ground = if page.background.is_empty() {
        Rgba(1.0, 1.0, 1.0, 1.0)
    } else if let Some(rgb) = rrggbb(&page.background) {
        rgba(rgb, 1.0)
    } else {
        a.refuse("colour", "", format!("a page ground \"{}\" that is not #rrggbb", truncate(&page.background)));
        Rgba(1.0, 1.0, 1.0, 1.0)
    };
    let page_clip = page.clip.as_ref().and_then(|c| {
        let before = a.refusals.len();
        let o = area_of(&mut a, page.frame.as_ref().map_or("", |f| f.id.as_str()), c, "the frame's clip");
        for r in &mut a.refusals[before..] {
            r.code = "page-clip";
        }
        o
    });
    let frame = page.frame.as_ref().and_then(|f| {
        // Measured on the two board fidelity pages without their pictures: a row whose region
        // reaches the frame's rounded corner differs over 24 levels on 0.68% of it (0.79% with
        // the background inset under the border; band 0.5%), every such pixel on the frame's
        // outer arc. Against the exact covered area the browser over-covers that edge (mean
        // +0.094 and +0.055 alpha) and leaves a faint shadow outside the corner the document
        // does not have, so the browser is not the more faithful side; but this crate cannot
        // match it inside the bands, so the frame is refused. Square frames have no such edge.
        if f.shape.as_ref().is_some_and(|s| s.kind == "ellipse" || s.radius.is_some_and(|r| r > 0.0)) {
            a.refuse(
                "frame-edge",
                &f.id,
                "a rounded or elliptical frame, whose outer edge tiny-skia and the browser tier draw differently",
            );
        }
        let framed = item(&mut a, f, true)?;
        if f.bbox.x != 0.0 || f.bbox.y != 0.0 || f.bbox.w != page.width || f.bbox.h != page.height || f.opacity != 100.0 {
            a.refuse("geometry", &f.id, "a frame operation that does not fill the page");
            return None;
        }
        Some(framed)
    });
    let mut items = Vec::with_capacity(page.ops.len());
    for op in &page.ops {
        if let Some(i) = item(&mut a, op, false) {
            items.push(i);
        }
    }
    if a.dropped > 0 {
        let n = a.dropped;
        a.refusals.push(Refusal { code: "finding", id: String::new(), detail: format!("{n} more reasons not listed") });
    }
    if !a.refusals.is_empty() {
        return Err(a.refusals);
    }
    Ok(Plan {
        pixel_width: out.width as u32,
        pixel_height: out.height as u32,
        dpi: out.dpi,
        page_width: page.width,
        page_height: page.height,
        scale,
        ground,
        frame,
        page_clip,
        items,
        pictures: a.pictures,
    })
}
