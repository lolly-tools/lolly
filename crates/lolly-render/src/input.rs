// SPDX-License-Identifier: MPL-2.0
//! The input contract: a versioned JSON form of the engine's `DesignDrawPage`.
//!
//! Every object is read with `deny_unknown_fields`, so a field this version does not
//! know refuses the whole page instead of being skipped. Kinds that the engine spells
//! as strings (`op`, a paint's `kind`, a shape's `kind`) are read as strings and
//! settled by admission (`admit.rs`), which names the refusal. Three members are
//! read whole and never interpreted: a text block's measure spec, its layout's
//! measure and each run's face. The engine has already laid out and outlined the
//! words from them, and the drawing reads only the outlines and their placement.

use serde::Deserialize;
use serde_json::Value;

/// The value of `format` this crate reads.
pub const INPUT_FORMAT: &str = "lolly-render-input";
/// The input contract's version.
pub const INPUT_VERSION: u32 = 1;
/// The drawing operations' version (`DESIGN_DRAW_VERSION` in engine/src/design-draw.ts).
pub const DRAW_VERSION: u32 = 0;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    pub format: String,
    pub version: u32,
    #[serde(rename = "drawVersion")]
    pub draw_version: u32,
    pub output: Output,
    pub page: Page,
    /// The pictures the page places, by their reference, as the engine embedded them.
    #[serde(default)]
    pub resources: Vec<Resource>,
}

/// One picture's bytes: `ref` is the operation's picture reference, `type` the type the
/// host read (the crate reads the type from the bytes), `data` standard padded base64.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Resource {
    #[serde(rename = "ref")]
    pub reference: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub data: String,
}

/// The pixel size to draw at. The page is scaled to fill it; `dpi` only goes into
/// the PNG's resolution chunk.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Output {
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub dpi: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    pub version: f64,
    pub width: f64,
    pub height: f64,
    pub background: String,
    #[serde(default)]
    pub frame: Option<Op>,
    #[serde(default)]
    pub clip: Option<Area>,
    pub ops: Vec<Op>,
    pub findings: Vec<Finding>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Finding {
    pub id: String,
    pub feature: String,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(deny_unknown_fields)]
pub struct DrawBox {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// One drawing operation. `op` is `shape`, `image` or `text`; the last two are the
/// preview reading's operations, which this crate refuses.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Op {
    pub op: String,
    pub id: String,
    #[serde(rename = "box")]
    pub bbox: DrawBox,
    pub opacity: f64,
    #[serde(default)]
    pub pose: Option<Pose>,
    #[serde(default)]
    pub clip: Option<RowClip>,
    #[serde(default)]
    pub blend: Option<String>,
    #[serde(default)]
    pub shadow: Option<Shadow>,
    #[serde(default)]
    pub blur: Option<f64>,
    #[serde(default)]
    pub outline: Option<Shape>,
    #[serde(default)]
    pub picture: Option<Picture>,
    #[serde(default)]
    pub words: Option<Words>,
    // A shape operation.
    #[serde(default)]
    pub shape: Option<Shape>,
    #[serde(default)]
    pub fills: Option<Vec<Paint>>,
    #[serde(default)]
    pub stroke: Option<Stroke>,
    #[serde(default, rename = "fillRule")]
    pub fill_rule: Option<String>,
    #[serde(default)]
    pub compatibility: Option<String>,
    // An image or text operation of the preview reading, read only to be refused.
    #[serde(default, rename = "ref")]
    pub reference: Option<String>,
    #[serde(default)]
    pub fit: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub text: Option<Value>,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(deny_unknown_fields)]
pub struct Pose {
    pub rot: f64,
    #[serde(rename = "flipH")]
    pub flip_h: bool,
    #[serde(rename = "flipV")]
    pub flip_v: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RowClip {
    pub points: Vec<[f64; 2]>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Shadow {
    pub target: String,
    pub dx: f64,
    pub dy: f64,
    pub blur: f64,
    pub color: String,
    #[serde(default)]
    pub opacity: Option<f64>,
}

/// `rect` (with `radius`, and `corners` for radii that differ), `ellipse`, or `path`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Shape {
    pub kind: String,
    #[serde(default)]
    pub radius: Option<f64>,
    #[serde(default)]
    pub corners: Option<Vec<f64>>,
    #[serde(default)]
    pub contours: Option<Vec<Contour>>,
    #[serde(default, rename = "evenOdd")]
    pub even_odd: Option<bool>,
    #[serde(default)]
    pub commands: Option<Value>,
}

/// One authored contour: cubic curves, each `[x0, y0, x1, y1, x2, y2, x3, y3]` in page coordinates.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Contour {
    pub curves: Vec<[f64; 8]>,
    pub closed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Area {
    #[serde(rename = "box")]
    pub bbox: DrawBox,
    pub shape: Shape,
}

/// `color`, `linear` or `radial`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Paint {
    pub kind: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub opacity: Option<f64>,
    #[serde(default)]
    pub x1: Option<f64>,
    #[serde(default)]
    pub y1: Option<f64>,
    #[serde(default)]
    pub x2: Option<f64>,
    #[serde(default)]
    pub y2: Option<f64>,
    #[serde(default)]
    pub stops: Option<Vec<Stop>>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stop {
    pub offset: f64,
    pub color: String,
    pub opacity: f64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stroke {
    pub color: String,
    #[serde(default)]
    pub opacity: Option<f64>,
    pub width: f64,
    #[serde(default)]
    pub cap: Option<String>,
    #[serde(default)]
    pub join: Option<String>,
    #[serde(default)]
    pub dash: Option<Vec<f64>>,
    #[serde(default)]
    pub align: Option<String>,
    #[serde(default)]
    pub sides: Option<Vec<f64>>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Picture {
    #[serde(rename = "ref")]
    pub reference: String,
    pub fit: String,
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
    pub area: DrawBox,
    pub element: Area,
    #[serde(default)]
    pub clip: Option<Area>,
    pub label: String,
    #[serde(default)]
    pub natural: Option<Natural>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Natural {
    pub width: f64,
    pub height: f64,
}

/// A row's words as the engine laid them out and outlined them.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Words {
    /// The measure spec the layout was made from; read whole, never interpreted.
    pub spec: Value,
    pub align: String,
    pub ink: String,
    #[serde(default, rename = "inkOpacity")]
    pub ink_opacity: Option<f64>,
    #[serde(default)]
    pub layout: Option<Layout>,
    #[serde(default)]
    pub outlines: Option<Vec<Vec<Option<String>>>>,
    #[serde(default)]
    pub strikes: Option<Vec<Vec<Option<Strike>>>>,
    #[serde(default)]
    pub underlines: Option<Vec<Vec<Option<Underline>>>>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Layout {
    /// The measure the lines came from; read whole, never interpreted.
    pub measure: Value,
    pub lines: Vec<Line>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Line {
    pub baseline: f64,
    pub x: f64,
    pub width: f64,
    pub runs: Vec<Run>,
    #[serde(default)]
    pub hanging: Option<Vec<Run>>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Run {
    pub text: String,
    pub x: f64,
    pub width: f64,
    /// The face the run was shaped in; read whole, never interpreted.
    pub face: Value,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub underline: Option<bool>,
    #[serde(default)]
    pub strike: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Strike {
    pub y: f64,
    pub height: f64,
    pub width: f64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Underline {
    pub y: f64,
    pub height: f64,
    pub spans: Vec<UnderlineSpan>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UnderlineSpan {
    pub x: f64,
    pub width: f64,
    #[serde(default)]
    pub ink: Option<String>,
}
