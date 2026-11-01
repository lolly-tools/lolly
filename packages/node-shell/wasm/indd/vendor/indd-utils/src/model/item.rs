//! Page items: geometry (transforms and paths), groups, frames and shapes,
//! their settings, text wrap, text frame preferences, placed graphics and
//! links.
//!
//! Evidence: `docs/format/objects.md` (page items, graphics, links),
//! `attributes.md` (page item attributes) and `transparency.md`.

use super::*;

/// A 2D affine transform `[a b c d tx ty]`, as in IDML `ItemTransform`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Matrix(pub [f64; 6]);

impl Matrix {
    pub const IDENTITY: Matrix = Matrix([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);

    /// This transform followed by `outer` (points are row vectors, as
    /// in IDML).
    pub fn then(&self, outer: &Matrix) -> Matrix {
        let [a, b, c, d, e, f] = self.0;
        let [p, q, r, s, t, u] = outer.0;
        Matrix([
            a * p + b * r,
            a * q + b * s,
            c * p + d * r,
            c * q + d * s,
            e * p + f * r + t,
            e * q + f * s + u,
        ])
    }

    pub(super) fn read(c: &mut Cursor) -> Result<Matrix, Error> {
        let mut m = [0.0; 6];
        for v in &mut m {
            *v = c.f64()?;
        }
        Ok(Matrix(m))
    }
}

pub type Point = (f64, f64);

#[derive(Debug, Clone, PartialEq)]
pub struct PathPoint {
    pub anchor: Point,
    pub left: Point,
    pub right: Point,
    /// The stored point type: 2 a corner without direction points, 0 or
    /// 1 a point with them.
    pub kind: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Path {
    pub points: Vec<PathPoint>,
    pub open: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Shape {
    Rectangle,
    Oval,
    Polygon,
    GraphicLine,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ItemKind {
    TextFrame {
        story: Option<u32>,
        previous: Option<u32>,
        next: Option<u32>,
        preferences: Option<TextFramePreferences>,
    },
    Shape(Shape),
    Group,
    /// Text kept from a placed EPS or PDF graphic (class 0x660B).
    EpsText(EpsText),
    /// A form field or multi-state object.
    Form(Form),
}

/// The kind of a form field (`docs/format/objects.md`, form fields).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormKind {
    Button,
    CheckBox,
    RadioButton,
    TextBox,
    ComboBox,
    SignatureField,
    MultiState,
}

impl FormKind {
    fn of(class: Option<u32>) -> Option<FormKind> {
        Some(match class? {
            class::BUTTON => FormKind::Button,
            class::CHECK_BOX => FormKind::CheckBox,
            class::RADIO_BUTTON => FormKind::RadioButton,
            class::TEXT_BOX => FormKind::TextBox,
            class::COMBO_BOX => FormKind::ComboBox,
            class::SIGNATURE_FIELD => FormKind::SignatureField,
            class::MULTI_STATE => FormKind::MultiState,
            _ => return None,
        })
    }

    /// Kinds whose appearance is a list of states rather than child
    /// items.
    pub fn has_states(self) -> bool {
        matches!(
            self,
            FormKind::Button | FormKind::CheckBox | FormKind::RadioButton | FormKind::MultiState
        )
    }
}

/// A form field or multi-state object (`docs/format/objects.md`, form
/// fields). Its fill, stroke and other page item values are in the
/// item's attribute list.
#[derive(Debug, Clone, PartialEq)]
pub struct Form {
    pub kind: FormKind,
    pub states: Vec<FormState>,
    /// The bounds of the paths of the items it shows, in its own
    /// coordinates: left, top, right, bottom.
    pub bounds: Option<[f64; 4]>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub export_value: Option<String>,
    pub required: Option<bool>,
    pub multiline: Option<bool>,
    pub scrollable: Option<bool>,
    pub font_size: Option<f64>,
    /// Font family and style of a text box.
    pub font: Option<(String, Option<String>)>,
    /// Timing lists of a button (chunk 0x2056E).
    pub timing: Vec<TimingList>,
    /// Behaviours in the order of chunk 0x15601.
    pub behaviors: Vec<Behavior>,
}

/// One state of a form field.
#[derive(Debug, Clone, PartialEq)]
pub struct FormState {
    /// The state ID, which gives the state type.
    pub id: u32,
    pub active: bool,
    pub enabled: bool,
    pub items: Vec<PageItem>,
}

/// The settings of EPS text (`docs/format/objects.md`, EPS text).
#[derive(Debug, Clone, PartialEq)]
pub struct EpsText {
    /// Chunk 0x6611 as IDML writes it (`EPSTextData`): big-endian, with
    /// two fields left out.
    pub data: Vec<u8>,
    /// Chunk 0x154: left, top, right, bottom (`PathBoundingBox`).
    pub path_bounds: [f64; 4],
    /// The first four f64 of chunk 0x6612, in the same order
    /// (`EPSTextAttributeBounds`).
    pub attr_bounds: [f64; 4],
}

#[derive(Debug, Clone, PartialEq)]
pub struct PageItem {
    pub uid: u32,
    /// Placed graphics (images, PDF, EPS, SVG) inside a frame.
    pub graphics: Vec<Graphic>,
    /// Placed movies and sounds inside a frame. They are not graphics:
    /// the frame's content type and contour do not depend on them.
    pub media: Vec<Media>,
    pub kind: ItemKind,
    pub transform: Matrix,
    pub paths: Vec<Path>,
    /// Document layer; `None` for items anchored in text.
    pub layer: Option<u32>,
    /// Local formatting (fill, stroke, corners, ...).
    pub attrs: Attrs,
    pub object_style: Option<u32>,
    pub children: Vec<PageItem>,
    /// Text wrap (chunk 0x3703); `None` if the item has none.
    pub text_wrap: Option<TextWrap>,
    /// Anchored object settings (chunk 0x2800 of the anchor), for an item
    /// anchored in text.
    pub anchor: Option<AnchorSettings>,
    pub props: ItemProps,
    /// Export options (chunk 0x1E206); `None` without the chunk.
    pub export: Option<ExportOptions>,
    /// Text on the item's path (chunk 0xB30A).
    pub text_paths: Vec<TextPath>,
    /// Script label: key and value pairs, in stored order.
    pub label: Vec<(String, String)>,
    /// Animation (chunk 0x2055F).
    pub animation: Option<Animation>,
    /// A group's article children list (chunk 0x21B05), in stored order;
    /// `None` without the chunk.
    pub article_children: Option<Vec<u32>>,
}

/// Text on the path of a shape or frame (class 0xB320). See
/// `docs/format/objects.md`, text on a path.
#[derive(Debug, Clone, PartialEq)]
pub struct TextPath {
    pub uid: u32,
    pub story: Option<u32>,
    pub previous: Option<u32>,
    pub next: Option<u32>,
    /// `FlipPathEffect`.
    pub flipped: bool,
    pub start: f64,
    pub end: f64,
    /// The three codes at 8 of chunk 0xB30A are those of every sample
    /// (`CenterPathAlignment`, `BaselineTextAlignment`,
    /// `RainbowPathEffect`, `PathSpacing` 0).
    pub default_codes: bool,
}

/// Alternative text and tagging settings of a page item (chunk 0x1E206).
/// See `docs/format/objects.md`, object export options.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ExportOptions {
    /// Source codes: 0 custom, 5 XML structure, 6 XMP (actual text only),
    /// 8 decorative image (alternative text only).
    pub alt_source: u32,
    pub alt_text: Name,
    /// The namespace prefix and property path of the metadata property.
    pub alt_metadata: [Name; 2],
    pub actual_source: u32,
    pub actual_text: Name,
    pub actual_metadata: [Name; 2],
    /// 0 tag from structure, 1 artifact.
    pub tag_type: u32,
}

/// Generated alternative text of a page item (chunks 0x1E260 to
/// 0x1E262). See `docs/format/objects.md`, object export options.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct GeneratedAltText {
    /// Chunk 0x1E260 is 1.
    pub error: bool,
    /// Chunk 0x1E262 is 1.
    pub ai: bool,
    /// The four f64 of chunk 0x1E261, unless all are 0.
    pub crop: Option<[f64; 4]>,
}

/// Settings every page item has. See `docs/format/objects.md`, page item
/// settings.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ItemProps {
    /// The name (chunk 0x2C10, of a group 0x418); `None` without the
    /// chunk.
    pub name: Option<ItemName>,
    /// Chunk 0x2C32 is 0.
    pub hidden: bool,
    /// Chunk 0x2C2D is 1.
    pub locked: bool,
    /// `AllowOverrides`, for items of master spreads only: `false` when
    /// chunk 0x142D is 1 (`docs/format/objects.md`).
    pub allow_overrides: Option<bool>,
    /// Layout constraint flags (chunk 0x22228).
    pub layout_constraints: Option<u8>,
    /// The parent, target and last updated interface change counts
    /// (chunks 0x21D4E, 0x21D50, 0x21D53), each a list of numbers.
    pub change_counts: [Vec<u32>; 3],
    /// The overridden master page item (0 for none) and the IDs of the
    /// attributes overridden (chunk 0x1424).
    pub overridden: Option<(u32, Vec<u32>)>,
    /// Chunk 0x1623 is 1: a frame for a graphic (`ContentType`
    /// `GraphicType` without a graphic).
    pub graphic_frame: bool,
    /// The i32 at 4 of chunk 0x324: the layer position before grouping
    /// (`objects.md`, page item settings).
    pub grouping_layer_position: Option<i32>,
    /// The layer named by the u32 at 0 of chunk 0x324, a spread layer
    /// resolved to its layer (`objects.md`, page item settings).
    pub grouping_layer: Option<u32>,
    pub generated_alt: GeneratedAltText,
    /// The value of key `CustomSizeType` of chunk 0x1E22B (`objects.md`,
    /// export options).
    pub export_size_type: Option<u32>,
}

/// A page item name: a built-in key or a name given by the user.
#[derive(Debug, Clone, PartialEq)]
pub struct ItemName {
    pub builtin: bool,
    pub name: String,
}

/// Text wrap settings of a page item or graphic (chunk 0x3703).
#[derive(Debug, Clone, PartialEq)]
pub struct TextWrap {
    /// Wrap mode code (see `wrap_mode`).
    pub mode: u32,
    /// The four offsets: left, top, right, bottom.
    pub offsets: [f64; 4],
    /// The u16 at offset 40: 0 for `ApplyToMasterPageOnly`, 1 otherwise.
    pub master_flag: u16,
    /// The u16 at offset 42: the `TextWrapSide` code (`TEXT_WRAP_SIDES`
    /// of the writer).
    pub side: u16,
    /// The u32 at offset 4: the wrap path object (class 0x3702), 0 for
    /// none.
    pub path_uid: u32,
    /// The wrap path when its object is flagged custom; empty otherwise
    /// and for object styles.
    pub custom_path: Vec<Path>,
}

/// A list of keys with string values (chunk 0x1E22B): u32 count; per
/// entry a u32-counted key in text segments, a flag byte, two bytes, a u16
/// value count and the values, each a u8 length, a u8 and that many bytes.
fn key_values(c: &mut Cursor) -> Result<Vec<(String, Vec<String>)>, Error> {
    let n = c.u32()?;
    let mut out = Vec::new();
    for _ in 0..n {
        let len = c.u32()? as usize;
        let key = c.segments(len)?;
        c.skip(3)?;
        let count = c.u16()?;
        let mut values = Vec::new();
        for _ in 0..count {
            let m = c.u8()? as usize;
            c.u8()?;
            values.push(String::from_utf8_lossy(c.bytes(m)?).into_owned());
        }
        out.push((key, values));
    }
    Ok(out)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphicKind {
    Image,
    Pdf,
    Eps,
    Svg,
    /// A placed InDesign page (class 0x6607).
    ImportedPage,
}

/// A link (class 0x8C42, 0x21D03 or 0x21D32) and its link resource
/// (class 0x8C41). See `docs/format/objects.md`, links.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Link {
    pub uid: u32,
    /// The class of the link object (`LinkClassID`); 0 for unknown.
    pub class: u32,
    /// `LinkResourceURI`, for example `file:/Users/me/image.jpg`.
    pub uri: String,
    /// The linked file is stored in the document (`StoredState="Embedded"`).
    pub embedded: bool,
    /// Chunk 0x8C92, u32 at URI+8 is 3 (`StoredState="Contained"`).
    pub contained: bool,
    /// Chunk 0x8C9B, u32 at 12: 0 when the linked file was modified.
    pub modified: Option<bool>,
    /// Chunk 0x8C9B, u16 at 20: 1 when the link is shown.
    pub shown: Option<bool>,
    /// The import stamp (`file <time> <size>`); `None` when empty.
    pub stamp: Option<String>,
    /// The file's modification time and the time it was placed or
    /// updated, as FILETIME (100 ns since 1601-01-01 UTC).
    pub times: Option<[u64; 2]>,
    /// Chunk 0x1B6 of the link.
    pub pdf_identifier: Option<u32>,
    /// The file size of the resource: high and low u32.
    pub size: Option<[u32; 2]>,
    /// The format name of the resource (`JPEG`, `Photoshop`, ...).
    pub format: Option<String>,
}

/// The bytes of a file stored in the document, if there is one.
pub(super) type EmbeddedFile = Option<Vec<u8>>;

/// The contour of a text wrap: chunk 0x373D of placed graphics, 0x373F of
/// the preferences and 0x3777 of object styles (29 bytes each). See
/// `docs/format/objects.md`, text wrap.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Contour {
    /// Contour type code (u32 at 0).
    pub kind: u32,
    /// `IncludeInsideEdges` (u8 at 17); `None` for a byte other than 0 or 1.
    pub inside_edges: Option<bool>,
}

impl Contour {
    /// The contour of a graphic without chunk 0x373D and of preferences
    /// without chunk 0x373F: `SameAsClipping` without inside edges.
    pub const DEFAULT: Contour = Contour {
        kind: 5,
        inside_edges: Some(false),
    };

    /// A contour chunk; `None` if it is shorter than 18 bytes.
    pub fn read(enc: Encoding, data: &[u8]) -> Option<Contour> {
        Some(Contour {
            kind: enc.u32_at(data, 0)?,
            inside_edges: match *data.get(17)? {
                0 => Some(false),
                1 => Some(true),
                _ => None,
            },
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Graphic {
    pub uid: u32,
    pub kind: GraphicKind,
    pub transform: Matrix,
    /// Left, top, right, bottom in the graphic's own coordinates.
    pub bounds: [f64; 4],
    pub link: Option<Link>,
    /// The graphic's file, when the document holds it: an embedded link or
    /// a graphic pasted without a link (for some images, their preview's
    /// data, and then `preview` is `None`). IDML writes it as `Contents`.
    pub contents: Option<Vec<u8>>,
    /// The raw data object of InDesign's screen preview of a graphic whose
    /// file the document does not hold (chunk 0x170D, then chunk 0x119 of
    /// the preview object). IDML has no place for it.
    pub preview: Option<u32>,
    pub text_wrap: Option<TextWrap>,
    /// The contour of the text wrap (chunk 0x373D).
    pub contour: Option<Contour>,
    /// Clipping path settings (chunk 0x2C1A), if stored.
    pub clipping: Option<ClippingPath>,
    /// The clipping path (the graphic's chunk 0x162B), read only for a
    /// clipping type other than 0.
    pub clipping_paths: Vec<Path>,
    /// Name, visibility, change counts and the other page item settings.
    pub props: ItemProps,
    /// Chunk 0x1B916.
    pub object_style: Option<u32>,
    /// The attribute list (chunk 0x6E03).
    pub attrs: Attrs,
    /// Image properties (chunk 0x1708 of an image).
    pub image: Option<ImageProperties>,
    /// Colour profile code (chunk 0x7C0F, u32 at 0).
    pub profile: Option<u32>,
    /// Grey, RGB, grey again and CMYK vector policy codes of a PDF or EPS
    /// (chunk 0x7C42, four u32); only the RGB and CMYK codes are known.
    pub vector_policies: Option<[u32; 4]>,
    /// PDF placement (chunk 0x251B): page number, transparent background
    /// byte, crop code.
    pub pdf: Option<(u32, u8, u32)>,
    /// Layers of an image, PDF or imported page (chunk 0x177A).
    pub layers: Option<GraphicLayers>,
    /// Applied layer comp (chunk 0x9209, i32 at 4).
    pub layer_comp: Option<i32>,
    /// Image import options (chunk 0x1714): apply the Photoshop clipping
    /// path, alpha channel name.
    pub import: Option<(bool, Name)>,
    /// The name of the image's first alpha channel (chunk 0x177C), which
    /// an `AlphaChannel` contour uses.
    pub alpha_channel: Option<String>,
    /// The index of a placed InDesign page (chunk 0x2505, u32 at 0).
    pub page_index: Option<u32>,
}

/// The first channel name of chunk 0x177C: u32 channel count, then per
/// channel a flag byte and a string (objects.md, text wrap, contour).
/// `None` without a channel or with a damaged chunk.
fn alpha_channel(enc: Encoding, d: &[u8]) -> Option<String> {
    let mut c = enc.cursor(d);
    if c.u32().ok()? == 0 {
        return None;
    }
    c.flag().ok()?;
    c.string().ok().filter(|s| !s.is_empty())
}

/// Image properties (chunk 0x1708): u32 count, then records of u32 key,
/// u32 length *n*, u8, *n* bytes. See `docs/format/objects.md`, image
/// properties.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ImageProperties {
    /// Key 0x67: 1 grey, 2 RGB, 4 CMYK.
    pub color_space: Option<u32>,
    /// Key 0x6F (a colour table) is present.
    pub indexed: bool,
    /// Keys 0x6C and 0x6D, 16.16 fixed point.
    pub resolution: Option<[f64; 2]>,
    /// Key 0x7D: the name of the image's clipping path, when its bytes are
    /// printable ASCII (the encoding of other bytes is not known).
    pub clipping_path_name: Option<String>,
}

/// Layers of a placed graphic (chunk 0x177A).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct GraphicLayers {
    /// The u16 at 0 is 1.
    pub option: bool,
    /// In IDML order.
    pub layers: Vec<GraphicLayer>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GraphicLayer {
    pub name: Name,
    pub id: u32,
    pub original_visibility: bool,
    pub current_visibility: bool,
    /// The parent layer's ID, −1 for a top-level layer.
    pub parent: i32,
    /// 0x01 separator, 0x04 effects layer, 0x08 locked.
    pub flags: u32,
}

/// Clipping path settings of a graphic (chunk 0x2C1A, 37 bytes): u32 type
/// at 0, f64 tolerance at 4, f64 inset at 12, u8 threshold at 20, i16
/// index at 23, u8 flags at 25 (0x02 = use the high-resolution image,
/// 0x01 and 0x08 = invert the path and restrict it to the frame). See
/// `docs/format/objects.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct ClippingPath {
    pub kind: u32,
    pub tolerance: f64,
    pub inset: f64,
    pub threshold: u8,
    pub index: i16,
    pub flags: u8,
}

/// Text frame settings, from the frame's multi-column frame object.
#[derive(Debug, Clone, PartialEq)]
pub struct TextFramePreferences {
    pub column_count: u32,
    pub column_gutter: f64,
    pub column_fixed_width: f64,
    /// First baseline offset code (chunk 0x2CE, u16 at 0): 0 LeadingOffset,
    /// 1 AscentOffset, 2 CapHeight, 3 EmboxHeight.
    pub first_baseline_offset: u16,
    pub vertical_justification: u16,
    pub vertical_balance_columns: bool,
    /// Chunk 0x2CE u16 at 22 and 24; `None` for a chunk of 22 to 27
    /// bytes, which has no auto-sizing fields.
    pub auto_sizing_type: Option<u16>,
    pub auto_sizing_reference_point: Option<u16>,
    /// Chunk 0x2D1: u8 at 12 and, in 40-byte chunks, f64 at 32.
    pub use_fixed_width: bool,
    pub max_width: Option<f64>,
    /// Chunk 0x2CE (48 bytes): u16 at 26 and f64 at 28 (minimum height),
    /// u16 at 36 and f64 at 38 (minimum width), u16 at 46 (no line
    /// breaks).
    pub minimum_sizes: Option<([bool; 2], [f64; 2], bool)>,
    /// Chunk 0x3730: u16 ignore text wrap.
    pub ignore_wrap: Option<bool>,
    /// Column rule (chunk 0x22646): f64 width at 28, u32 colour at 36.
    pub column_rule: Option<(f64, u32)>,
    /// Column rule override: u32 at 0 of chunk 0x22646, 1 for true.
    pub column_rule_override: Option<bool>,
    /// Footnote options (chunk 0x22608): u16, u16 span across columns,
    /// f64 minimum spacing, f64 space between.
    pub footnotes: Option<[f64; 2]>,
    /// Chunk 0x22608, u16 at 2: footnotes span across columns.
    pub footnote_span: bool,
    /// Baseline frame grid (chunk 0x2834); `None` without the chunk.
    pub baseline_grid: Option<BaselineGrid>,
    /// The interface colour that the grid's colour UID names.
    pub baseline_rgb: Option<[f64; 3]>,
    /// Inset spacing (the frame's chunk 0x3723): top, left, bottom, right.
    pub inset: [f64; 4],
    /// The f64 at 0 of the frame's chunk 0x3723: the inset spacing of a
    /// frame that is not a plain rectangle.
    pub inset_single: f64,
    /// A frame grid (chunk 0xCD41 starts with u16 1).
    pub frame_grid: bool,
}

/// Baseline frame grid settings: chunk 0x2834 of a multi-column frame,
/// and the text frame settings of an object style at 82
/// (`docs/format/objects.md`, baseline frame grid of text frames).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BaselineGrid {
    /// u16 at 0, 1 = true: `UseCustomBaselineFrameGrid`.
    pub use_custom: bool,
    /// f64 at 2: `StartingOffsetForBaselineFrameGrid`.
    pub start: f64,
    /// u16 at 10: `BaselineFrameGridRelativeOption` code.
    pub relative: u16,
    /// f64 at 12: `BaselineFrameGridIncrement`.
    pub increment: f64,
    /// u32 at 20: UID of an interface colour; 0 for the document's colour.
    pub color: u32,
}

impl BaselineGrid {
    /// The values of a frame or style without the settings.
    pub const DEFAULT: BaselineGrid = BaselineGrid {
        use_custom: false,
        start: 0.0,
        relative: 3,
        increment: 12.0,
        color: 0,
    };

    pub(super) fn read(enc: Encoding, d: &[u8], at: usize) -> Option<BaselineGrid> {
        Some(BaselineGrid {
            use_custom: enc.u16_at(d, at)? == 1,
            start: enc.f64_at(d, at + 2)?,
            relative: enc.u16_at(d, at + 10)?,
            increment: enc.f64_at(d, at + 12)?,
            color: enc.u32_at(d, at + 20)?,
        })
    }
}

/// Groups nested deeper than this are left out, with a warning, so that a
/// damaged file cannot exhaust the stack.
pub(super) const MAX_ITEM_DEPTH: usize = 100;

/// The IDML element of a frame or shape. `shape` is the u16 flag and the
/// u32 shape code of chunk 0x6204: with flag 1 the code decides; with
/// flag 0 or without the chunk, the path. See `docs/format/objects.md`,
/// page items.
pub(super) fn classify(paths: &[Path], shape: Option<(u16, u32)>) -> Shape {
    if let Some((1, code)) = shape {
        return match code {
            1 => Shape::GraphicLine,
            2 | 3 => Shape::Rectangle,
            4 | 5 => Shape::Oval,
            _ => Shape::Polygon,
        };
    }
    let [path] = paths else {
        return Shape::Polygon;
    };
    let corners = path
        .points
        .iter()
        .all(|p| p.left == p.anchor && p.right == p.anchor);
    if path.open && path.points.len() == 2 && corners {
        return Shape::GraphicLine;
    }
    if !path.open && path.points.len() == 4 && corners {
        let xs: Vec<f64> = path.points.iter().map(|p| p.anchor.0).collect();
        let ys: Vec<f64> = path.points.iter().map(|p| p.anchor.1).collect();
        let distinct = |v: &[f64]| {
            let mut v: Vec<i64> = v.iter().map(|x| (x * 1e6).round() as i64).collect();
            v.sort_unstable();
            v.dedup();
            v.len()
        };
        if distinct(&xs) == 2 && distinct(&ys) == 2 {
            return Shape::Rectangle;
        }
    }
    if !path.open
        && path.points.len() == 4
        && path
            .points
            .iter()
            .all(|p| p.left != p.anchor && p.kind == 0)
        && oval_anchors(path)
    {
        return Shape::Oval;
    }
    Shape::Polygon
}

/// Whether the second and fourth anchors of a four-point path lie on the
/// midpoint of the first and third, along the axis on which those two
/// differ (within 1e-8).
fn oval_anchors(path: &Path) -> bool {
    let a: Vec<(f64, f64)> = path.points.iter().map(|p| p.anchor).collect();
    let [p0, p1, p2, p3] = a[..] else {
        return false;
    };
    let on = |m: f64, u: f64, v: f64| (u - m).abs() <= 1e-8 && (v - m).abs() <= 1e-8;
    if (p0.0 - p2.0).abs() < (p0.1 - p2.1).abs() {
        on((p0.1 + p2.1) / 2.0, p1.1, p3.1)
    } else {
        on((p0.0 + p2.0) / 2.0, p1.0, p3.0)
    }
}

impl<'a> Reader<'a> {
    /// Text orientation of a multi-column frame (chunk 0x2DE): the
    /// identity gives horizontal text, the rotation 0 1 −1 0 vertical
    /// text (`docs/format/objects.md`). `None` without the chunk;
    /// `Some(None)` for another matrix.
    pub(super) fn frame_orientation(&self, mcf: u32) -> Result<Option<Option<Orientation>>, Error> {
        let Some(d) = self.chunk(mcf, chunk::FRAME_TEXT_TRANSFORM)? else {
            return Ok(None);
        };
        if d.len() < 48 {
            return Ok(Some(None));
        }
        let Matrix([a, b, c, dd, _, _]) = Matrix::read(&mut self.cursor(&d))?;
        Ok(Some(match [a, b, c, dd] {
            [1.0, 0.0, 0.0, 1.0] => Some(Orientation::Horizontal),
            [0.0, 1.0, -1.0, 0.0] => Some(Orientation::Vertical),
            _ => None,
        }))
    }

    /// Text frame settings of frame `frame`, from its multi-column frame
    /// `mcf` and the frame itself.
    pub(super) fn text_frame_preferences(
        &self,
        frame: u32,
        mcf: u32,
    ) -> Result<Option<TextFramePreferences>, Error> {
        let Some(cols) = self.chunk(mcf, chunk::FRAME_COLUMNS)? else {
            return Ok(None);
        };
        // A frame without chunk 0x2CE has codes 0, reference point 4 and
        // no minimum sizes (objects.md, text frame preferences).
        let just = match self.chunk(mcf, chunk::FRAME_JUSTIFICATION)? {
            Some(d) => d,
            None => {
                let mut d = vec![0u8; 48];
                d[24..26].copy_from_slice(&self.enc().u16_bytes(4));
                d
            }
        };
        if cols.len() < 22 || just.len() < 22 {
            return Ok(None);
        }
        let auto_sizing = just.len() >= 26;
        let baseline_grid = self
            .chunk(mcf, chunk::FRAME_BASELINE_GRID)?
            .and_then(|d| BaselineGrid::read(self.enc(), &d, 0));
        let baseline_rgb = match baseline_grid {
            Some(g) if g.color != 0 => self.ui_color(g.color)?,
            _ => None,
        };
        let minimum_sizes = (just.len() >= 48).then(|| {
            let flag = |at| self.enc().u16_at(&just, at).is_some_and(|v| v != 0);
            (
                [flag(26), flag(36)],
                [
                    self.enc().f64_at(&just, 28).unwrap_or(0.0),
                    self.enc().f64_at(&just, 38).unwrap_or(0.0),
                ],
                flag(46),
            )
        });
        let rule_chunk = self.chunk(mcf, chunk::FRAME_COLUMN_RULE)?;
        let column_rule = match &rule_chunk {
            Some(d) => match (self.enc().f64_at(d, 28), self.enc().u32_at(d, 36)) {
                (Some(w), Some(c)) => Some((w, c)),
                _ => None,
            },
            None => None,
        };
        let footnote_chunk = self.chunk(mcf, chunk::FRAME_FOOTNOTES)?;
        let footnotes = match &footnote_chunk {
            Some(d) => match (self.enc().f64_at(d, 4), self.enc().f64_at(d, 12)) {
                (Some(a), Some(b)) => Some([a, b]),
                _ => None,
            },
            None => None,
        };
        // The frame's chunk 0x3723: f64, u32, then four f64: left, top,
        // right, bottom.
        let (inset, inset_single) = match self.chunk(frame, chunk::FRAME_INSET)? {
            Some(d) if d.len() >= 44 => {
                let f = |at| self.enc().f64_at(&d, at).unwrap_or(0.0);
                ([f(20), f(12), f(36), f(28)], f(0))
            }
            _ => ([0.0; 4], 0.0),
        };
        Ok(Some(TextFramePreferences {
            column_count: self.cursor(&cols).u32()?,
            column_gutter: self.cursor(&cols[4..]).f64()?,
            column_fixed_width: self.cursor(&cols[14..]).f64()?,
            first_baseline_offset: self.cursor(&just).u16()?,
            vertical_justification: self.cursor(&just[2..]).u16()?,
            vertical_balance_columns: self.cursor(&just[20..]).u16()? != 0,
            auto_sizing_type: auto_sizing.then(|| self.enc().u16_at(&just, 22)).flatten(),
            auto_sizing_reference_point: auto_sizing
                .then(|| self.enc().u16_at(&just, 24))
                .flatten(),
            use_fixed_width: cols.get(12).is_some_and(|&b| b != 0),
            max_width: if cols.len() >= 40 {
                self.enc().f64_at(&cols, 32)
            } else {
                None
            },
            minimum_sizes,
            ignore_wrap: self
                .chunk(mcf, chunk::FRAME_IGNORE_WRAP)?
                .and_then(|d| self.enc().u16_at(&d, 0))
                .map(|v| v != 0),
            column_rule,
            column_rule_override: rule_chunk
                .as_ref()
                .and_then(|d| self.enc().u32_at(d, 0))
                .map(|v| v == 1),
            footnotes,
            footnote_span: footnote_chunk.and_then(|d| self.enc().u16_at(&d, 2)) == Some(1),
            baseline_grid,
            baseline_rgb,
            inset,
            inset_single,
            frame_grid: self
                .chunk(mcf, chunk::FRAME_GRID)?
                .and_then(|d| self.enc().u16_at(&d, 0))
                == Some(1),
        }))
    }

    /// The settings every page item has (`ItemProps`).
    pub(super) fn item_props(&self, uid: u32) -> Result<ItemProps, Error> {
        let name_chunk = if self.class(uid) == Some(class::GROUP) {
            chunk::GROUP_NAME
        } else {
            chunk::ITEM_NAME
        };
        let name = match self.chunk(uid, name_chunk)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                let builtin = c.flag()? == 1;
                Some(ItemName {
                    builtin,
                    name: c.string()?,
                })
            }
            None => None,
        };
        let counts = |id: u32| -> Result<Vec<u32>, Error> {
            let Some(d) = self.chunk(uid, id)? else {
                return Ok(Vec::new());
            };
            let mut c = self.cursor(&d);
            let n = c.u32()? as usize;
            if n > d.len() / 8 {
                return Err(Error::Corrupt(format!("item {uid}: {n} change counts")));
            }
            (0..2 * n).map(|_| c.u32()).collect()
        };
        let overridden = match self.chunk(uid, chunk::ITEM_OVERRIDE)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                let master = c.u32()?;
                Some((master, c.u32_list()?))
            }
            None => None,
        };
        // A form field with states names its spread in chunk 0x14526.
        let on_master = match self.chunk(uid, chunk::ITEM_HIERARCHY)? {
            Some(d) => Some(d),
            None => self.chunk(uid, chunk::FORM_STATE_ITEMS)?,
        }
        .and_then(|d| self.enc().u32_at(&d, 0))
        .is_some_and(|s| self.class(s) == Some(class::MASTER_SPREAD));
        let allow_overrides = if on_master {
            Some(
                self.chunk(uid, chunk::ITEM_ALLOW_OVERRIDES)?
                    .and_then(|d| self.enc().u32_at(&d, 0))
                    != Some(1),
            )
        } else {
            None
        };
        Ok(ItemProps {
            name,
            allow_overrides,
            hidden: self
                .chunk(uid, chunk::ITEM_VISIBLE)?
                .is_some_and(|d| d.len() >= 2 && self.cursor(&d).u16().ok() == Some(0)),
            locked: self
                .chunk(uid, chunk::ITEM_LOCKED)?
                .is_some_and(|d| d.len() >= 4 && self.cursor(&d).u32().ok() == Some(1)),
            layout_constraints: self
                .chunk(uid, chunk::ITEM_LAYOUT_CONSTRAINTS)?
                .and_then(|d| d.first().copied()),
            change_counts: [
                counts(chunk::ITEM_PARENT_CHANGES)?,
                counts(chunk::ITEM_TARGET_CHANGES)?,
                counts(chunk::ITEM_UPDATED_CHANGES)?,
            ],
            overridden,
            graphic_frame: self
                .chunk(uid, chunk::ITEM_CONTENT)?
                .is_some_and(|d| d.len() >= 2 && self.cursor(&d).u16().ok() == Some(1)),
            grouping_layer_position: self
                .chunk(uid, chunk::ITEM_GROUPING_LAYER)?
                .and_then(|d| self.enc().i32_at(&d, 4)),
            grouping_layer: self.grouping_layer(uid)?,
            generated_alt: self.generated_alt(uid)?,
            export_size_type: match self.chunk(uid, chunk::ITEM_EXPORT_SIZE)? {
                Some(d) => key_values(&mut self.cursor(&d)).ok().and_then(|kv| {
                    kv.into_iter()
                        .find(|(k, _)| k == "CustomSizeType")?
                        .1
                        .first()?
                        .parse()
                        .ok()
                }),
                None => None,
            },
        })
    }

    fn generated_alt(&self, uid: u32) -> Result<GeneratedAltText, Error> {
        let flag = |id| -> Result<bool, Error> {
            Ok(self.chunk(uid, id)?.and_then(|d| self.enc().u16_at(&d, 0)) == Some(1))
        };
        let crop = self.chunk(uid, chunk::ITEM_ALT_TEXT_CROP)?.and_then(|d| {
            let r = [0, 8, 16, 24].map(|o| self.enc().f64_at(&d, o));
            let r = [r[0]?, r[1]?, r[2]?, r[3]?];
            r.iter().any(|&v| v != 0.0).then_some(r)
        });
        Ok(GeneratedAltText {
            error: flag(chunk::ITEM_ALT_TEXT_ERROR)?,
            ai: flag(chunk::ITEM_AI_ALT_TEXT)?,
            crop,
        })
    }

    /// The layer of chunk 0x324: a layer UID itself, a spread layer's
    /// layer (its chunk 0x302), else none.
    fn grouping_layer(&self, uid: u32) -> Result<Option<u32>, Error> {
        let Some(mut layer) = self
            .chunk(uid, chunk::ITEM_GROUPING_LAYER)?
            .and_then(|d| self.enc().u32_at(&d, 0))
        else {
            return Ok(None);
        };
        if layer != 0 && self.class(layer) == Some(class::SPREAD_LAYER) {
            layer = match self.chunk(layer, chunk::SPREAD_LAYER_LAYER)? {
                Some(d) => self.enc().u32_at(&d, 0).unwrap_or(0),
                None => 0,
            };
        }
        Ok((layer != 0 && self.class(layer) == Some(class::LAYER)).then_some(layer))
    }

    /// The export options of a page item (chunk 0x1E206): the alternative
    /// text and actual text, each a u32 source and three flagged strings
    /// (text, metadata namespace prefix, property path), then the u32
    /// tagging type. The rest of the chunk is not decoded.
    pub(super) fn export_options(&self, uid: u32) -> Result<Option<ExportOptions>, Error> {
        let Some(d) = self.chunk(uid, chunk::ITEM_EXPORT)? else {
            return Ok(None);
        };
        let mut c = self.cursor(&d);
        let alt_source = c.u32()?;
        let alt_text = c.name()?;
        let alt_metadata = [c.name()?, c.name()?];
        let actual_source = c.u32()?;
        let actual_text = c.name()?;
        let actual_metadata = [c.name()?, c.name()?];
        Ok(Some(ExportOptions {
            alt_source,
            alt_text,
            alt_metadata,
            actual_source,
            actual_text,
            actual_metadata,
            tag_type: c.u32()?,
        }))
    }

    /// Text wrap of a page item or graphic, from chunk 0x3703: u32 mode,
    /// u32 contour path object, four f64 offsets, u16 master page flag,
    /// u16 side.
    pub(super) fn text_wrap(&self, uid: u32) -> Result<Option<TextWrap>, Error> {
        let mut wrap = self.wrap_chunk(uid, chunk::TEXT_WRAP)?;
        if let Some(w) = &mut wrap {
            w.custom_path = self.custom_wrap_path(uid, w.path_uid)?;
        }
        Ok(wrap)
    }

    /// The paths (chunk 0x162B) of wrap path object `path` when chunk
    /// 0x3709 flags it custom (u16 at offset 8 = 1); see
    /// `docs/format/objects.md`, text wrap. A path that cannot be read is
    /// left out with a warning.
    fn custom_wrap_path(&self, uid: u32, path: u32) -> Result<Vec<Path>, Error> {
        if path == 0 || self.class(path) != Some(class::TEXT_WRAP_PATH) {
            return Ok(Vec::new());
        }
        let Some(d) = self.chunk(path, chunk::TEXT_WRAP_PATH_INFO)? else {
            return Ok(Vec::new());
        };
        if d.len() != 10 || self.cursor(&d[8..]).u16()? != 1 {
            return Ok(Vec::new());
        }
        match self.paths(path) {
            Ok(mut paths) => {
                paths.retain(|p| !p.points.is_empty());
                Ok(paths)
            }
            Err(e) => {
                self.warn(format!("item {uid}: text wrap path not read ({e})"));
                Ok(Vec::new())
            }
        }
    }

    /// A text wrap record in chunk `id` of object `uid`.
    pub(super) fn wrap_chunk(&self, uid: u32, id: u32) -> Result<Option<TextWrap>, Error> {
        let Some(d) = self.chunk(uid, id)? else {
            return Ok(None);
        };
        if d.len() < 44 {
            return Ok(None);
        }
        let mut c = self.cursor(&d);
        let mode = c.u32()?;
        let path_uid = c.u32()?;
        let offsets = [c.f64()?, c.f64()?, c.f64()?, c.f64()?];
        let master_flag = c.u16()?;
        let side = c.u16()?;
        if !matches!(
            mode,
            wrap_mode::NONE | wrap_mode::JUMP_OBJECT | wrap_mode::BOUNDING_BOX | wrap_mode::CONTOUR
        ) {
            self.warn(format!(
                "item {uid}: text wrap mode {mode} is not known; left out"
            ));
        }
        Ok(Some(TextWrap {
            mode,
            offsets,
            master_flag,
            side,
            path_uid,
            custom_path: Vec::new(),
        }))
    }

    pub(super) fn paths(&self, uid: u32) -> Result<Vec<Path>, Error> {
        let Some(data) = self.chunk(uid, chunk::ITEM_PATHS)? else {
            return Ok(Vec::new());
        };
        let mut c = self.cursor(&data);
        let n = c.u32()?;
        let mut paths = Vec::new();
        for _ in 0..n {
            let count = c.u32()?;
            let mut points = Vec::new();
            for _ in 0..count {
                let kind = c.u32()?;
                let p = match kind {
                    2 => {
                        let a = (c.f64()?, c.f64()?);
                        PathPoint {
                            anchor: a,
                            left: a,
                            right: a,
                            kind,
                        }
                    }
                    0 | 1 => {
                        let left = (c.f64()?, c.f64()?);
                        let anchor = (c.f64()?, c.f64()?);
                        let right = (c.f64()?, c.f64()?);
                        PathPoint {
                            anchor,
                            left,
                            right,
                            kind,
                        }
                    }
                    other => {
                        return Err(Error::Corrupt(format!(
                            "object {uid}: unknown path point type {other}"
                        )));
                    }
                };
                points.push(p);
            }
            let open = c.u16()? != 0;
            paths.push(Path { points, open });
        }
        Ok(paths)
    }

    /// A page item and the items it contains. An item that cannot be
    /// read, contains itself or is nested more than [`MAX_ITEM_DEPTH`]
    /// deep is left out with a warning.
    pub(super) fn page_item(
        &self,
        uid: u32,
        layer: Option<u32>,
    ) -> Result<Option<PageItem>, Error> {
        let cls = self.class(uid);
        if cls != Some(class::SPLINE_ITEM)
            && cls != Some(class::GROUP)
            && cls != Some(class::EPS_TEXT)
            && FormKind::of(cls).is_none()
        {
            return Ok(None);
        }
        {
            let path = self.item_path.borrow();
            if path.contains(&uid) {
                drop(path);
                self.warn(format!("item {uid} contains itself; left out"));
                return Ok(None);
            }
            if path.len() >= MAX_ITEM_DEPTH {
                drop(path);
                self.warn(format!(
                    "item {uid} is nested more than {MAX_ITEM_DEPTH} deep; left out"
                ));
                return Ok(None);
            }
        }
        self.item_path.borrow_mut().push(uid);
        let item = self.page_item_contents(uid, cls, layer);
        self.item_path.borrow_mut().pop();
        // An item that cannot be read is left out, like other objects.
        Ok(item.unwrap_or_else(|e| {
            self.warn(format!("item {uid} left out: {e}"));
            None
        }))
    }

    pub(super) fn page_item_contents(
        &self,
        uid: u32,
        cls: Option<u32>,
        layer: Option<u32>,
    ) -> Result<Option<PageItem>, Error> {
        let form = FormKind::of(cls);
        let states = form.is_some_and(FormKind::has_states);
        // Groups without chunk 0x151 have their transform in chunk 0x40D,
        // form fields with states in chunk 0x14527.
        let transform = match self.chunk(uid, chunk::ITEM_TRANSFORM)? {
            Some(d) => Matrix::read(&mut self.cursor(&d))?,
            None => {
                let other = if states {
                    chunk::FORM_TRANSFORM
                } else {
                    chunk::GROUP_TRANSFORM
                };
                match self.chunk(uid, other)? {
                    Some(d) if (states || cls == Some(class::GROUP)) && d.len() >= 48 => {
                        Matrix::read(&mut self.cursor(&d))?
                    }
                    _ => Matrix::IDENTITY,
                }
            }
        };
        let child_uids = if states {
            Vec::new()
        } else {
            self.children(uid, chunk::ITEM_HIERARCHY)?
        };
        let mut children = Vec::new();
        let mut graphics = Vec::new();
        let mut media = Vec::new();
        let mut text_column = None;
        let mut frame_prefs = None;
        let mut frame_mcf = None;
        for &child in &child_uids {
            if let Some(g) = self.graphic(child)? {
                graphics.push(g);
            } else if let Some(m) = self.media(child)? {
                media.push(m);
            } else if self.class(child) == Some(class::MULTI_COLUMN_FRAME) {
                frame_prefs = self.text_frame_preferences(uid, child)?;
                frame_mcf = Some(child);
                text_column = self
                    .children(child, chunk::ITEM_HIERARCHY)?
                    .into_iter()
                    .find(|&c| self.class(c) == Some(class::FRAME_COLUMN));
            } else if let Some(item) = self.page_item(child, layer)? {
                children.push(item);
            }
        }
        let paths = self.paths(uid)?;
        let attrs = match self.chunk(uid, chunk::ITEM_ATTRS)? {
            Some(d) => self
                .attrs_or_warn(
                    || format!("item {uid}"),
                    Attrs::parse(self.enc(), &d, List::Item, self.db.recorder()),
                )
                .unwrap_or_default(),
            None => Attrs::default(),
        };
        let object_style = match self.chunk(uid, chunk::ITEM_OBJECT_STYLE)? {
            Some(d) => uid_or_none(self.cursor(&d).u32()?),
            None => None,
        };
        let kind = if let Some(kind) = form {
            let states = if states {
                self.form_states(uid, kind, layer)?
            } else {
                Vec::new()
            };
            let mut f = form_field(kind, states, &attrs, &children);
            if kind == FormKind::Button {
                f.timing = self.timing(uid, chunk::BUTTON_TIMING);
            }
            f.behaviors = self.behaviors(uid);
            ItemKind::Form(f)
        } else if cls == Some(class::GROUP) {
            ItemKind::Group
        } else if cls == Some(class::EPS_TEXT) {
            ItemKind::EpsText(self.eps_text(uid)?)
        } else if let Some(column) = text_column {
            let mut kind = self.text_frame_links(column)?;
            if let ItemKind::TextFrame {
                preferences, story, ..
            } = &mut kind
            {
                *preferences = frame_prefs;
                if let (Some(story), Some(mcf)) = (*story, frame_mcf)
                    && let Some(o) = self.frame_orientation(mcf)?
                {
                    self.frame_orientations
                        .borrow_mut()
                        .entry(story)
                        .or_default()
                        .push(o);
                }
            }
            kind
        } else {
            let shape = self
                .chunk(uid, chunk::ITEM_SHAPE)?
                .and_then(|d| Some((self.enc().u16_at(&d, 0)?, self.enc().u32_at(&d, 2)?)));
            ItemKind::Shape(classify(&paths, shape))
        };
        Ok(Some(PageItem {
            uid,
            graphics,
            media,
            kind,
            transform,
            paths,
            layer,
            attrs,
            object_style,
            children,
            text_wrap: self.text_wrap(uid)?,
            anchor: None,
            props: self.item_props(uid).unwrap_or_else(|e| {
                self.warn(format!("item {uid}: settings left out: {e}"));
                ItemProps::default()
            }),
            export: self.export_options(uid).unwrap_or_else(|e| {
                self.warn(format!("item {uid}: export options left out: {e}"));
                None
            }),
            text_paths: self
                .text_path(uid)
                .unwrap_or_else(|e| {
                    self.warn(format!("item {uid}: text on its path left out: {e}"));
                    None
                })
                .into_iter()
                .collect(),
            label: self.item_label(uid, cls).unwrap_or_else(|e| {
                self.warn(format!("item {uid}: label left out: {e}"));
                Vec::new()
            }),
            animation: self.animation(uid),
            article_children: if cls == Some(class::GROUP) {
                self.uid_list_or_none(uid, chunk::GROUP_ARTICLE_CHILDREN)
                    .unwrap_or_else(|e| {
                        self.warn(format!("group {uid}: article children list left out: {e}"));
                        None
                    })
            } else {
                None
            },
        }))
    }

    /// The states of a form field (chunks 0x14521 and 0x14526) with the
    /// items each shows. A state whose key has no entry in chunk 0x14526
    /// shows nothing. See `docs/format/objects.md`, form fields.
    fn form_states(
        &self,
        uid: u32,
        kind: FormKind,
        layer: Option<u32>,
    ) -> Result<Vec<FormState>, Error> {
        let Some(d) = self.chunk(uid, chunk::FORM_STATES)? else {
            return Ok(Vec::new());
        };
        let mut c = self.cursor(&d);
        let active = c.u32()?;
        let n = c.u32()? as usize;
        if n > c.remaining() / 10 {
            return Err(Error::Corrupt(format!("form field {uid}: {n} states")));
        }
        let mut entries = Vec::with_capacity(n);
        for _ in 0..n {
            let id = c.u32()?;
            let enabled = c.u16()?;
            let key = c.u16()?;
            c.u16()?;
            entries.push((id, enabled, key));
        }
        let mut lists: Vec<(u32, Vec<u32>)> = Vec::new();
        if let Some(d) = self.chunk(uid, chunk::FORM_STATE_ITEMS)? {
            let mut c = self.cursor(&d);
            c.skip(8)?;
            let n = c.u32()? as usize;
            if n > c.remaining() / 8 {
                return Err(Error::Corrupt(format!("form field {uid}: {n} state lists")));
            }
            for _ in 0..n {
                let key = c.u32()?;
                lists.push((key, c.u32_list()?));
            }
        }
        let mut out = Vec::with_capacity(n);
        for (id, enabled, key) in entries {
            let mut items = Vec::new();
            for &child in lists
                .iter()
                .filter(|(k, _)| *k == u32::from(key))
                .flat_map(|(_, l)| l)
            {
                if let Some(mut item) = self.page_item(child, layer)? {
                    // A state's group without a name of its own has the
                    // name of its state type.
                    if item.kind == ItemKind::Group
                        && item
                            .props
                            .name
                            .as_ref()
                            .is_none_or(|n| n.builtin && n.name.is_empty())
                        && let Some(name) = state_group_name(kind, id)
                    {
                        item.props.name = Some(ItemName {
                            builtin: true,
                            name: name.into(),
                        });
                    }
                    items.push(item);
                }
            }
            out.push(FormState {
                id,
                active: id == active,
                enabled: enabled != 0,
                items,
            });
        }
        Ok(out)
    }

    /// The text on the path of an item (chunk 0xB30A): u32 text path UID,
    /// u32, three codes (8 bytes), u8 flip at 16, f64 start at 18 and end
    /// at 26. The story and thread come from the column (class 0xB318) of
    /// the text path's multi-column frame (chunk 0xB334). See
    /// `docs/format/objects.md`, text on a path.
    fn text_path(&self, uid: u32) -> Result<Option<TextPath>, Error> {
        let Some(d) = self.chunk(uid, chunk::ITEM_TEXT_PATH)? else {
            return Ok(None);
        };
        let mut c = self.cursor(&d);
        let path = c.u32()?;
        if path == 0 || self.class(path) != Some(class::TEXT_PATH) {
            return Ok(None);
        }
        c.u32()?;
        let codes = c.bytes(8)?;
        let default_codes = self.enc().u16_at(codes, 0) == Some(1)
            && self.enc().u16_at(codes, 2) == Some(4)
            && self.enc().u32_at(codes, 4) == Some(3);
        let flipped = c.u8()? == 1;
        c.u8()?;
        let start = c.f64()?;
        let end = c.f64()?;
        let column = self
            .children(path, chunk::TEXT_PATH_FRAME)?
            .into_iter()
            .filter(|&m| self.class(m) == Some(class::MULTI_COLUMN_FRAME))
            .map(|m| self.children(m, chunk::ITEM_HIERARCHY))
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .flatten()
            .find(|&col| self.class(col) == Some(class::TEXT_PATH_COLUMN));
        let (story, previous, next) = match column.map(|col| self.text_frame_links(col)) {
            Some(Ok(ItemKind::TextFrame {
                story,
                previous,
                next,
                ..
            })) => (story, previous, next),
            Some(Err(e)) => return Err(e),
            _ => (None, None, None),
        };
        Ok(Some(TextPath {
            uid: path,
            story,
            previous,
            next,
            flipped,
            start,
            end,
            default_codes,
        }))
    }

    /// The settings of EPS text (class 0x660B). See
    /// `docs/format/objects.md`, EPS text.
    fn eps_text(&self, uid: u32) -> Result<EpsText, Error> {
        let four = |id: u32| -> Result<[f64; 4], Error> {
            let d = self
                .chunk(uid, id)?
                .ok_or_else(|| Error::Corrupt(format!("EPS text {uid}: no chunk {id:#x}")))?;
            let mut c = self.cursor(&d);
            Ok([c.f64()?, c.f64()?, c.f64()?, c.f64()?])
        };
        let data = self
            .chunk(uid, chunk::EPS_TEXT_DATA)?
            .ok_or_else(|| Error::Corrupt(format!("EPS text {uid}: no text record")))?;
        Ok(EpsText {
            data: eps_text_data(self.enc(), &data)?,
            path_bounds: four(chunk::OLD_PAGE_BOUNDS)?,
            attr_bounds: four(chunk::EPS_TEXT_ATTR_BOUNDS)?,
        })
    }

    pub(super) fn graphic(&self, uid: u32) -> Result<Option<Graphic>, Error> {
        let kind = match self.class(uid) {
            Some(class::IMAGE) => GraphicKind::Image,
            Some(class::PDF) => GraphicKind::Pdf,
            Some(class::EPS) => GraphicKind::Eps,
            Some(class::SVG) => GraphicKind::Svg,
            Some(class::IMPORTED_PAGE) => GraphicKind::ImportedPage,
            _ => return Ok(None),
        };
        let transform = match self.chunk(uid, chunk::ITEM_TRANSFORM)? {
            Some(d) => Matrix::read(&mut self.cursor(&d))?,
            None => Matrix::IDENTITY,
        };
        let bounds = match self.chunk(uid, chunk::GRAPHIC_BOUNDS)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                [c.f64()?, c.f64()?, c.f64()?, c.f64()?]
            }
            None => [0.0; 4],
        };
        let link = match self.chunk(uid, chunk::GRAPHIC_LINK)? {
            Some(d) if d.len() >= 12 => self.link(self.cursor(&d[8..]).u32()?)?,
            _ => None,
        };
        let (link, contents) = match link {
            Some((link, data)) => (Some(link), data),
            None => {
                let id = match kind {
                    // EPS graphics name their data as images do
                    // (objects.md, embedded graphics).
                    GraphicKind::Image | GraphicKind::Eps => Some(chunk::IMAGE_DATA),
                    GraphicKind::Pdf => Some(chunk::PDF_DATA),
                    _ => None,
                };
                let data = match id {
                    Some(id) => match self.chunk(uid, id)? {
                        Some(d) if d.len() >= 4 => self.raw_data(self.cursor(&d).u32()?)?,
                        _ => None,
                    },
                    None => None,
                };
                // An image that names no raw data object holds its file in
                // its preview, unless it names an old link object
                // (objects.md, images that keep their file in their preview).
                let data = match data {
                    None if kind == GraphicKind::Image && !self.old_link(uid)? => {
                        match self.preview(uid).ok().flatten() {
                            Some(p) => self.raw_data(p)?,
                            None => None,
                        }
                    }
                    data => data,
                };
                (None, data)
            }
        };
        let clipping = match self.chunk(uid, chunk::CLIPPING_PATH)? {
            Some(d) if d.len() >= 26 => {
                let f = |o: usize| self.cursor(&d[o..]).f64();
                Some(ClippingPath {
                    kind: self.cursor(&d).u32()?,
                    tolerance: f(4)?,
                    inset: f(12)?,
                    threshold: d[20],
                    index: self.enc().i16_from([d[23], d[24]]),
                    flags: d[25],
                })
            }
            _ => None,
        };
        let clipping_paths = match &clipping {
            Some(c) if c.kind != 0 => self.paths(uid).unwrap_or_else(|e| {
                self.warn(format!("graphic {uid}: clipping path not read ({e})"));
                Vec::new()
            }),
            _ => Vec::new(),
        };
        // A preview that can't be read is left out; the graphic is still
        // read.
        let preview = match contents {
            Some(_) => None,
            None => self.preview(uid).ok().flatten(),
        };
        Ok(Some(Graphic {
            uid,
            kind,
            transform,
            bounds,
            link,
            contents,
            preview,
            text_wrap: self.text_wrap(uid)?,
            contour: match self.chunk(uid, chunk::CONTOUR_OPTION)? {
                Some(d) => Contour::read(self.enc(), &d),
                None => None,
            },
            clipping,
            clipping_paths,
            props: self.item_props(uid).unwrap_or_else(|e| {
                self.warn(format!("graphic {uid}: settings left out: {e}"));
                ItemProps::default()
            }),
            object_style: match self.chunk(uid, chunk::ITEM_OBJECT_STYLE)? {
                Some(d) if d.len() >= 4 => uid_or_none(self.cursor(&d).u32()?),
                _ => None,
            },
            attrs: match self.chunk(uid, chunk::ITEM_ATTRS)? {
                Some(d) => self
                    .attrs_or_warn(
                        || format!("graphic {uid}"),
                        Attrs::parse(self.enc(), &d, List::Item, self.db.recorder()),
                    )
                    .unwrap_or_default(),
                None => Attrs::default(),
            },
            image: match self.chunk(uid, chunk::IMAGE_PROPERTIES)? {
                Some(d) if kind == GraphicKind::Image => self.image_properties(&d),
                _ => None,
            },
            profile: match self.chunk(uid, chunk::IMAGE_PROFILE)? {
                Some(d) if d.len() >= 4 => Some(self.cursor(&d).u32()?),
                _ => None,
            },
            vector_policies: match self.chunk(uid, chunk::VECTOR_POLICIES)? {
                Some(d) if d.len() >= 16 => {
                    let mut c = self.cursor(&d);
                    Some([c.u32()?, c.u32()?, c.u32()?, c.u32()?])
                }
                _ => None,
            },
            pdf: match self.chunk(uid, chunk::PDF_PLACEMENT)? {
                Some(d) if d.len() >= 12 => {
                    Some((self.cursor(&d).u32()?, d[6], self.cursor(&d[8..]).u32()?))
                }
                _ => None,
            },
            layers: match self.chunk(uid, chunk::GRAPHIC_LAYERS)? {
                Some(d) => self.graphic_layers(&d).unwrap_or_else(|e| {
                    self.warn(format!("graphic {uid}: layers left out: {e}"));
                    None
                }),
                None => None,
            },
            layer_comp: match self.chunk(uid, chunk::LAYER_COMP)? {
                Some(d) if d.len() >= 8 => Some(self.cursor(&d[4..]).i32()?),
                _ => None,
            },
            import: match self.chunk(uid, chunk::IMAGE_IMPORT)? {
                Some(d) if d.len() >= 9 => {
                    let mut c = self.cursor(&d[4..]);
                    let clipping = c.u16()?;
                    c.u16()?;
                    match (clipping, c.name()) {
                        (0 | 1, Ok(name)) => Some((clipping == 1, name)),
                        _ => None,
                    }
                }
                _ => None,
            },
            alpha_channel: match self.chunk(uid, chunk::IMAGE_CHANNELS)? {
                Some(d) if kind == GraphicKind::Image => alpha_channel(self.enc(), &d),
                _ => None,
            },
            page_index: match self.chunk(uid, chunk::IMPORTED_PAGE_INFO)? {
                Some(d) if kind == GraphicKind::ImportedPage => self.enc().u32_at(&d, 0),
                _ => None,
            },
        }))
    }

    /// Image properties from chunk 0x1708; `None` if the record list is
    /// cut short.
    fn image_properties(&self, d: &[u8]) -> Option<ImageProperties> {
        let mut c = self.cursor(d);
        let n = c.u32().ok()?;
        let mut p = ImageProperties::default();
        let mut resolution = [None, None];
        for _ in 0..n {
            let key = c.u32().ok()?;
            let len = c.u32().ok()? as usize;
            c.u8().ok()?;
            let data = c.bytes(len).ok()?;
            let value = || (len >= 4).then(|| self.cursor(data).u32().ok()).flatten();
            match key {
                0x67 => p.color_space = value(),
                0x6C => resolution[0] = value().map(|v| f64::from(v) / 65536.0),
                0x6D => resolution[1] = value().map(|v| f64::from(v) / 65536.0),
                0x6F => p.indexed = true,
                // u8 length n, n bytes of name, then 6 bytes.
                0x7D => {
                    p.clipping_path_name = data
                        .split_first()
                        .and_then(|(&n, rest)| rest.get(..usize::from(n)))
                        .filter(|b| !b.is_empty() && b.iter().all(|c| (0x20..0x7F).contains(c)))
                        .map(|b| b.iter().map(|&c| char::from(c)).collect());
                }
                _ => {}
            }
        }
        if let [Some(h), Some(v)] = resolution {
            p.resolution = Some([h, v]);
        }
        Some(p)
    }

    /// Layers of a placed graphic (chunk 0x177A): u16 option flag, 8
    /// bytes, u32 count, then per layer a flagged name, u32 ID, u32
    /// original and current visibility, i32 parent ID and u32 flags.
    fn graphic_layers(&self, d: &[u8]) -> Result<Option<GraphicLayers>, Error> {
        let mut c = self.cursor(d);
        let option = c.u16()? == 1;
        c.skip(8)?;
        let n = c.u32()? as usize;
        if n > d.len() / 20 {
            return Err(Error::Corrupt(format!("{n} graphic layers")));
        }
        let mut layers = Vec::with_capacity(n);
        for _ in 0..n {
            let name = c.name()?;
            layers.push(GraphicLayer {
                name,
                id: c.u32()?,
                original_visibility: c.u32()? == 1,
                current_visibility: c.u32()? == 1,
                parent: c.i32()?,
                flags: c.u32()?,
            });
        }
        Ok(Some(GraphicLayers { option, layers }))
    }

    /// The bytes of raw data object `uid` (`None` if `uid` is not one).
    pub(super) fn raw_data(&self, uid: u32) -> Result<EmbeddedFile, Error> {
        if uid == 0 || self.class(uid) != Some(class::RAW_DATA) {
            return Ok(None);
        }
        if let Some(r) = self.db.recorder() {
            r.object_read(uid);
        }
        self.db.object(uid)
    }

    /// Whether image `uid` names an object in chunk 0x8C1B, as images of
    /// InDesign 2.0 to 5.0 do. Their preview is not used as `Contents`.
    fn old_link(&self, uid: u32) -> Result<bool, Error> {
        Ok(match self.chunk(uid, chunk::OLD_GRAPHIC_LINK)? {
            Some(d) if d.len() >= 4 => self.cursor(&d).u32()? != 0,
            _ => false,
        })
    }

    /// The raw data object of graphic `uid`'s preview, if it names one.
    /// The data object itself is not read.
    fn preview(&self, uid: u32) -> Result<Option<u32>, Error> {
        let object = match self.chunk(uid, chunk::GRAPHIC_PREVIEW)? {
            Some(d) if d.len() >= 4 => self.cursor(&d).u32()?,
            _ => return Ok(None),
        };
        if object == 0 || self.class(object) != Some(class::PREVIEW) {
            return Ok(None);
        }
        let data = match self.chunk(object, chunk::PREVIEW_DATA)? {
            Some(d) if d.len() >= 4 => self.cursor(&d).u32()?,
            _ => return Ok(None),
        };
        Ok((self.class(data) == Some(class::RAW_DATA)).then_some(data))
    }

    /// A link, the URI of its resource and, for an embedded link, the
    /// embedded file. Fields after the URI that are cut short are left
    /// out (`None`).
    pub(super) fn link(&self, uid: u32) -> Result<Option<(Link, EmbeddedFile)>, Error> {
        if uid == 0 || self.db.object(uid)?.is_none() {
            return Ok(None);
        }
        let Some(info) = self.chunk(uid, chunk::LINK_INFO)? else {
            return Ok(None);
        };
        if info.len() < 12 {
            return Ok(None);
        }
        let resource = self.cursor(&info[8..]).u32()?;
        let mut link = Link {
            uid,
            class: self.class(uid).unwrap_or(0),
            ..Link::default()
        };
        let mut data = None;
        if let Some(d) = self.chunk(resource, chunk::LINK_RESOURCE_URI)?
            && d.len() >= 5
        {
            let mut c = self.cursor(&d);
            c.u8()?;
            let n = c.u32()? as usize;
            link.uri = String::from_utf8_lossy(c.bytes(n.min(c.remaining()))?).into_owned();
            // After the URI: 8 bytes, the stored state (3 for contained
            // content), then the UID of the embedded file's raw data
            // object (0 for a normal link).
            if c.remaining() >= 16 {
                c.skip(8)?;
                link.contained = c.u32()? == 3;
                data = self.raw_data(c.u32()?)?;
                // Then the stamp, the modification time, the file size,
                // a byte and the format name.
                let rest = (|| -> Result<_, Error> {
                    let n = c.u32()? as usize;
                    c.segments(n)?;
                    c.skip(8)?;
                    let size = [c.u32()?, c.u32()?];
                    let format = c.name()?.name;
                    Ok((size, format))
                })();
                if let Ok((size, format)) = rest {
                    link.size = Some(size);
                    link.format = Some(format);
                }
            }
        }
        link.embedded = data.is_some();
        let mut c = self.cursor(&info);
        let head = (|| -> Result<_, Error> {
            c.skip(12)?;
            let modified = c.u32()?;
            c.skip(4)?;
            let shown = c.u16()?;
            c.skip(10)?;
            Ok((modified, shown))
        })();
        if let Ok((modified, shown)) = head {
            link.modified = match modified {
                0 => Some(true),
                1 => Some(false),
                _ => None,
            };
            link.shown = match shown {
                0 => Some(false),
                1 => Some(true),
                _ => None,
            };
            let stamp = (|| -> Result<_, Error> {
                let n = c.u32()? as usize;
                let stamp = c.segments(n)?;
                let mut time = || -> Result<u64, Error> {
                    let high = c.u32()?;
                    Ok(u64::from(high) << 32 | u64::from(c.u32()?))
                };
                let times = [time()?, time()?];
                Ok((stamp, times))
            })();
            if let Ok((stamp, times)) = stamp {
                link.stamp = (!stamp.is_empty()).then_some(stamp);
                link.times = Some(times);
            }
        }
        link.pdf_identifier = match self.chunk(uid, chunk::LINK_PDF_IDENTIFIER)? {
            Some(d) if d.len() >= 4 => Some(self.cursor(&d).u32()?),
            _ => None,
        };
        Ok(Some((link, data)))
    }

    /// Story and threading of the text frame owning `column`.
    pub(super) fn text_frame_links(&self, column: u32) -> Result<ItemKind, Error> {
        let none = ItemKind::TextFrame {
            story: None,
            previous: None,
            next: None,
            preferences: None,
        };
        let Some(d) = self.chunk(column, chunk::COLUMN_FRAME_LIST)? else {
            return Ok(none);
        };
        let list = self.cursor(&d).u32()?;
        let Some(d) = self.chunk(list, chunk::FRAME_LIST_FRAMES)? else {
            return Ok(none);
        };
        let mut c = self.cursor(&d);
        let story = uid_or_none(c.u32()?);
        let columns = c.u32_list()?;
        // Columns belong to frames: column -> multi-column frame -> spline item.
        let frame_of = |col: u32| -> Result<Option<u32>, Error> {
            let Some(h) = self.chunk(col, chunk::ITEM_HIERARCHY)? else {
                return Ok(None);
            };
            let mcf = self.cursor(&h[4..]).u32()?;
            let Some(h) = self.chunk(mcf, chunk::ITEM_HIERARCHY)? else {
                return Ok(None);
            };
            Ok(uid_or_none(self.cursor(&h[4..]).u32()?))
        };
        let mut frames: Vec<u32> = Vec::new();
        for col in columns.iter().copied() {
            if let Some(f) = frame_of(col)?
                && frames.last() != Some(&f)
            {
                frames.push(f);
            }
        }
        let me = frame_of(column)?;
        let pos = me.and_then(|m| frames.iter().position(|&f| f == m));
        Ok(ItemKind::TextFrame {
            story,
            previous: pos.and_then(|i| i.checked_sub(1)).map(|i| frames[i]),
            next: pos.and_then(|i| frames.get(i + 1).copied()),
            preferences: None,
        })
    }
}

/// The text record of EPS text (chunk 0x6611) as IDML `EPSTextData`
/// writes it: in big-endian byte order, with the u32 at 72 and at 78 of
/// the 210-byte tail left out. Layout: u32 version, flagged in-object
/// string (font name), nine f64, flagged in-object string (text), tail.
/// See `docs/format/objects.md`, EPS text.
/// The built-in name of a state's group that has no name of its own, by
/// state ID (`docs/format/objects.md`, form fields).
fn state_group_name(kind: FormKind, id: u32) -> Option<&'static str> {
    if kind == FormKind::MultiState {
        return None;
    }
    Some(match id {
        0 => "$$$/StateType/Normal",
        1 => "$$$/StateType/Over",
        2 => "$$$/StateType/Down",
        3 => "$$$/StateType/NormalOn",
        4 => "$$$/StateType/NormalOff",
        6 => "$$$/StateType/OverOff",
        7 => "$$$/StateType/DownOn",
        8 => "$$$/StateType/DownOff",
        _ => return None,
    })
}

/// The settings of a form field from its attribute list, and the bounds
/// of the items it shows (`docs/format/objects.md`, form fields).
fn form_field(
    kind: FormKind,
    states: Vec<FormState>,
    attrs: &Attrs,
    children: &[PageItem],
) -> Form {
    let text = |id: u32| match attrs.get(id) {
        Some(Value::String(s)) => Some(s.clone()),
        _ => None,
    };
    let flag = |id: u32| attrs.get(id).and_then(Value::as_u32).map(|v| v != 0);
    let text_box = kind == FormKind::TextBox;
    let shown: Vec<&PageItem> = if kind.has_states() {
        states.iter().flat_map(|s| &s.items).collect()
    } else {
        children.iter().collect()
    };
    let bounds = shown
        .into_iter()
        .filter_map(|i| item_bounds(i, 0))
        .reduce(|[l, t, r, b], [l1, t1, r1, b1]| [l.min(l1), t.min(t1), r.max(r1), b.max(b1)]);
    let font = match text(0x1455F) {
        Some(family) if text_box => Some((family, text(0x14542))),
        _ => None,
    };
    Form {
        kind,
        states,
        bounds,
        name: text(0x14534),
        description: text(0x14535),
        export_value: text(0x14550)
            .filter(|_| matches!(kind, FormKind::CheckBox | FormKind::RadioButton)),
        required: flag(0x1453D),
        multiline: flag(0x14552).filter(|_| text_box),
        scrollable: flag(0x14553).filter(|_| text_box),
        font_size: attrs
            .get(0x14540)
            .and_then(Value::as_f64)
            .filter(|_| matches!(kind, FormKind::TextBox | FormKind::ComboBox)),
        font,
        timing: Vec::new(),
        behaviors: Vec::new(),
    }
}

/// The parameters in (0, 1) where a cubic Bézier curve has a horizontal
/// or vertical tangent.
fn curve_extrema(p: &[(f64, f64); 4]) -> Vec<f64> {
    let mut out = Vec::new();
    for k in 0..2 {
        let v = |i: usize| if k == 0 { p[i].0 } else { p[i].1 };
        // The derivative divided by 3: a t² + b t + c.
        let a = -v(0) + 3.0 * v(1) - 3.0 * v(2) + v(3);
        let b = 2.0 * (v(0) - 2.0 * v(1) + v(2));
        let c = v(1) - v(0);
        if a.abs() < 1e-12 {
            if b.abs() > 1e-12 {
                out.push(-c / b);
            }
        } else {
            let disc = b * b - 4.0 * a * c;
            if disc >= 0.0 {
                let r = disc.sqrt();
                out.push((-b + r) / (2.0 * a));
                out.push((-b - r) / (2.0 * a));
            }
        }
    }
    out.retain(|t| *t > 0.0 && *t < 1.0);
    out
}

fn cubic_point(p: &[(f64, f64); 4], t: f64) -> (f64, f64) {
    let u = 1.0 - t;
    let w = [u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t];
    (
        (0..4).map(|i| w[i] * p[i].0).sum(),
        (0..4).map(|i| w[i] * p[i].1).sum(),
    )
}

/// The bounds of `item` in its parent's coordinates: the box around its
/// paths (their curves, not only the anchor points) and, for a group or
/// a form field, the boxes of the items it shows, with its corners
/// through the item's transform.
fn item_bounds(item: &PageItem, depth: usize) -> Option<[f64; 4]> {
    if depth > MAX_ITEM_DEPTH {
        return None;
    }
    let mut bounds: Option<[f64; 4]> = None;
    let mut add = |(x, y): (f64, f64)| {
        bounds = Some(match bounds {
            None => [x, y, x, y],
            Some([l, t, r, b]) => [l.min(x), t.min(y), r.max(x), b.max(y)],
        });
    };
    for path in &item.paths {
        let n = path.points.len();
        let segments = if path.open { n.saturating_sub(1) } else { n };
        for p in &path.points {
            add(p.anchor);
        }
        // The curve between two anchors can reach beyond them.
        for i in 0..segments {
            let (p, q) = (&path.points[i], &path.points[(i + 1) % n]);
            let ctrl = [p.anchor, p.right, q.left, q.anchor];
            for t in curve_extrema(&ctrl) {
                add(cubic_point(&ctrl, t));
            }
        }
    }
    // The items in a frame do not count; those of a group or a form
    // field do.
    let inner: Vec<&PageItem> = match &item.kind {
        ItemKind::Group => item.children.iter().collect(),
        ItemKind::Form(f) if f.kind.has_states() => {
            f.states.iter().flat_map(|s| &s.items).collect()
        }
        ItemKind::Form(_) => item.children.iter().collect(),
        _ => Vec::new(),
    };
    for child in inner {
        if let Some([l, t, r, b]) = item_bounds(child, depth + 1) {
            add((l, t));
            add((r, b));
        }
    }
    let [l, t, r, b] = bounds?;
    let [a, bb, c, d, tx, ty] = item.transform.0;
    let at = |x: f64, y: f64| (a * x + c * y + tx, bb * x + d * y + ty);
    let corners = [at(l, t), at(r, t), at(l, b), at(r, b)];
    let xs = corners.map(|p| p.0);
    let ys = corners.map(|p| p.1);
    Some([
        xs.into_iter().fold(f64::INFINITY, f64::min),
        ys.into_iter().fold(f64::INFINITY, f64::min),
        xs.into_iter().fold(f64::NEG_INFINITY, f64::max),
        ys.into_iter().fold(f64::NEG_INFINITY, f64::max),
    ])
}

pub(super) fn eps_text_data(enc: Encoding, d: &[u8]) -> Result<Vec<u8>, Error> {
    let mut c = enc.cursor(d);
    let mut out = c.u32()?.to_be_bytes().to_vec();
    let string = |c: &mut crate::object::Cursor, out: &mut Vec<u8>| -> Result<(), Error> {
        let (flag, tag) = if enc.big_endian() {
            let tag = c.u8()?;
            (c.u8()?, tag)
        } else {
            let flag = c.u8()?;
            (flag, c.u8()?)
        };
        if tag != enc.string_tag() {
            return Err(Error::Corrupt(format!("EPS text: string tag {tag}")));
        }
        let script = c.u8()?;
        let n = c.u16()? as usize;
        out.extend([tag, flag, script]);
        out.extend((n as u16).to_be_bytes());
        let mut left = n;
        while left > 0 {
            let header = c.u16()?;
            let count = (header & 0x3FFF) as usize;
            if count == 0 || count > left {
                return Err(Error::Corrupt("EPS text: bad text segment".into()));
            }
            out.extend(header.to_be_bytes());
            match header & 0xC000 {
                0x4000 => out.extend(c.bytes(count)?),
                0x8000 => {
                    for _ in 0..count {
                        out.extend(c.u16()?.to_be_bytes());
                    }
                }
                _ => return Err(Error::Corrupt("EPS text: bad text segment".into())),
            }
            left -= count;
        }
        Ok(())
    };
    string(&mut c, &mut out)?;
    for _ in 0..9 {
        out.extend(c.f64()?.to_be_bytes());
    }
    string(&mut c, &mut out)?;
    if c.remaining() != 210 {
        return Err(Error::Corrupt(format!(
            "EPS text: tail of {} bytes, expected 210",
            c.remaining()
        )));
    }
    let tail = c.bytes(210)?;
    let mut t = enc.cursor(tail);
    out.extend(t.u32()?.to_be_bytes());
    out.extend(&tail[4..72]);
    t.skip(72)?;
    out.extend(t.u16()?.to_be_bytes());
    out.extend(&tail[82..]);
    Ok(out)
}

#[cfg(test)]
mod eps_text_tests {
    use super::*;
    use crate::database::synthetic::flagged_string;

    #[test]
    fn writes_the_eps_text_record_big_endian() {
        let enc = Encoding::default();
        let mut d = 0x0001_0002u32.to_le_bytes().to_vec();
        d.extend(flagged_string(enc, 1, "Helv"));
        for i in 0..9 {
            d.extend((i as f64).to_le_bytes());
        }
        d.extend(flagged_string(enc, 1, "Hi"));
        let mut tail = vec![0u8; 210];
        tail[0] = 16;
        tail[72] = 0xAA; // left out
        tail[76] = 1;
        tail[78] = 14; // left out
        tail[100] = 0x55;
        d.extend(&tail);
        let out = eps_text_data(enc, &d).unwrap();
        assert_eq!(out.len(), d.len() - 8);
        assert_eq!(&out[..4], &[0, 1, 0, 2]);
        assert_eq!(
            &out[4..15],
            &[2, 1, 0, 0, 4, 0x40, 4, b'H', b'e', b'l', b'v']
        );
        assert_eq!(&out[15..23], &0f64.to_be_bytes());
        assert_eq!(&out[23..31], &1f64.to_be_bytes());
        let t = &out[out.len() - 202..];
        assert_eq!(&t[..4], &[0, 0, 0, 16]);
        assert_eq!(&t[72..74], &[0, 1]);
        assert_eq!(t[74 + 100 - 82], 0x55);
        assert!(eps_text_data(enc, &d[..d.len() - 1]).is_err());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::object::Encoding;

    #[test]
    fn reads_the_first_alpha_channel() {
        use crate::header::{ByteOrder, Version};
        for order in [ByteOrder::Little, ByteOrder::Big] {
            let version = Version {
                major: 18,
                ..Version::default()
            };
            let enc = Encoding::new(order, version);
            let mut d = enc.u32_bytes(1).to_vec();
            // Flag 3, string tag 2, script byte 3.
            d.extend(match order {
                ByteOrder::Little => [3, 2, 3],
                ByteOrder::Big => [2, 3, 3],
            });
            d.extend(enc.u16_bytes(7));
            d.extend(enc.u16_bytes(0x4007));
            d.extend(b"Alpha 1");
            d.extend([0; 18]);
            assert_eq!(
                alpha_channel(enc, &d).as_deref(),
                Some("Alpha 1"),
                "{order:?}"
            );
            assert_eq!(alpha_channel(enc, &d[..12]), None);
            assert_eq!(alpha_channel(enc, &enc.u32_bytes(0)), None);
        }
    }

    #[test]
    fn reads_export_size_keys() {
        let enc = Encoding::default();
        let mut d = enc.u32_bytes(2).to_vec();
        for (key, values) in [("CustomSizeType", &["2"][..]), ("CustomSizeValue", &[][..])] {
            d.extend(enc.u32_bytes(key.len() as u32));
            d.extend(enc.u16_bytes(0x4000 | key.len() as u16));
            d.extend(key.bytes());
            d.extend([0, 2, 3]);
            d.extend(enc.u16_bytes(values.len() as u16));
            for v in values {
                d.extend([v.len() as u8, 0x40]);
                d.extend(v.bytes());
            }
        }
        let kv = key_values(&mut enc.cursor(&d)).unwrap();
        assert_eq!(kv[0], ("CustomSizeType".to_string(), vec!["2".to_string()]));
        assert!(kv[1].1.is_empty());
        assert!(key_values(&mut enc.cursor(&d[..d.len() - 3])).is_err());
    }
}

#[cfg(test)]
mod preview_tests {
    use super::*;
    use crate::database::synthetic;

    #[test]
    fn graphics_without_their_file_name_their_preview() {
        let uid = |n: u32| n.to_le_bytes().to_vec();
        let objects = [
            // An EPS graphic without its file: the preview chain ends in a
            // raw data object.
            (
                10,
                class::EPS,
                synthetic::chunks(&[(chunk::GRAPHIC_PREVIEW, uid(11))]),
            ),
            (
                11,
                class::PREVIEW,
                synthetic::chunks(&[(chunk::PREVIEW_DATA, uid(12))]),
            ),
            (12, class::RAW_DATA, b"preview".to_vec()),
            // The chunk names something other than a preview object.
            (
                13,
                class::IMAGE,
                synthetic::chunks(&[(chunk::GRAPHIC_PREVIEW, uid(12))]),
            ),
            // The document holds the file: its preview is not needed.
            (
                14,
                class::IMAGE,
                synthetic::chunks(&[
                    (chunk::IMAGE_DATA, uid(12)),
                    (chunk::GRAPHIC_PREVIEW, uid(11)),
                ]),
            ),
            // A preview object that can't be read: two first segments.
            (15, class::PREVIEW, Vec::new()),
            (15, class::PREVIEW, Vec::new()),
            (
                16,
                class::IMAGE,
                synthetic::chunks(&[(chunk::GRAPHIC_PREVIEW, uid(15))]),
            ),
            // An image that names an old link object (class 0x8C01): its
            // preview is only a preview.
            (
                18,
                class::IMAGE,
                synthetic::chunks(&[
                    (chunk::OLD_GRAPHIC_LINK, uid(19)),
                    (chunk::GRAPHIC_PREVIEW, uid(11)),
                ]),
            ),
            (19, 0x8C01, Vec::new()),
            // An image without a link that names no raw data object holds
            // its file in its preview.
            (
                17,
                class::IMAGE,
                synthetic::chunks(&[
                    (chunk::IMAGE_DATA, uid(0)),
                    (chunk::GRAPHIC_PREVIEW, uid(11)),
                ]),
            ),
        ];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let preview = |uid| reader.graphic(uid).unwrap().unwrap().preview;
        assert_eq!(preview(10), Some(12));
        assert_eq!(preview(13), None);
        assert_eq!(preview(14), None);
        // A damaged preview is left out; the graphic is still read.
        assert_eq!(preview(16), None);
        assert_eq!(reader.graphic(16).unwrap().unwrap().contents, None);
        let image = reader.graphic(17).unwrap().unwrap();
        assert_eq!(image.contents.as_deref(), Some(&b"preview"[..]));
        assert_eq!(image.preview, None);
        assert_eq!(reader.graphic(10).unwrap().unwrap().contents, None);
        let image = reader.graphic(18).unwrap().unwrap();
        assert_eq!(image.contents, None);
        assert_eq!(image.preview, Some(12));
    }
}
