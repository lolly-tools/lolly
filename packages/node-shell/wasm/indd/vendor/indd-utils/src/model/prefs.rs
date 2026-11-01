//! Document preferences read from the preferences object (class 0x2202):
//! colour settings, view, grid, guide and document setup values, the
//! watermark and the text defaults. See `docs/format/preferences.md`.

use super::{Attrs, Contour, Reader, chunk, class};
use crate::Error;
use crate::audit::List;
use crate::object::{Cursor, Encoding, builtin_key};

/// A value for an element of `Resources/Preferences.xml` or a document
/// setting in `designmap.xml`.
#[derive(Debug, Clone, PartialEq)]
pub struct PrefValue {
    /// IDML element (`ViewPreference`, `Document`, ...).
    pub element: &'static str,
    /// Attribute name.
    pub name: &'static str,
    pub value: String,
}

/// Preference values read from the INDD.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Prefs {
    pub values: Vec<PrefValue>,
    /// Interface colours: element, `Properties` child, red, green, blue.
    pub colors: Vec<(&'static str, &'static str, [f64; 3])>,
    /// The text defaults (chunk 0x23F, a text attribute list).
    pub text_defaults: Option<Attrs>,
    /// Default anchored object settings (chunk 0x2800, as object styles
    /// have).
    pub anchor: Option<super::AnchorSettings>,
    /// Page item defaults (class 0x6E07), a page item attribute list.
    pub item_defaults: Option<Attrs>,
    /// The values of page item attributes that an item does not store
    /// (class 0x6E02, chunk 0x6E03; attributes.md).
    pub item_base: Option<Attrs>,
    /// The entries of the two tables around that list: class, UID, UID
    /// (`objects.md`, page item defaults).
    pub item_default_entries: Vec<(u32, u32, u32)>,
    /// The swatches that chunk 0x6E06 of the page item defaults names:
    /// class and UID (`objects.md`, page item defaults).
    pub item_default_swatches: Vec<(u32, u32)>,
    /// `Properties` children: element, name, value.
    pub props: Vec<(&'static str, &'static str, PrefProp)>,
    /// Records of the print settings, written in base64.
    pub print_records: Vec<PrintBlob>,
    /// Footnote options (chunk 0x2820).
    pub footnotes: Option<FootnoteOptions>,
    /// Endnote options (chunk 0x2261E).
    pub endnotes: Option<EndnoteOptions>,
    /// Index options (chunk 0x13010).
    pub index_options: Option<IndexOptions>,
    /// Default paragraph and character style UIDs (chunks 0x28D4 and
    /// 0x28D5, u32 at 8).
    pub default_styles: [Option<u32>; 2],
    /// The contour of new placed graphics (chunk 0x373F, else
    /// `Contour::DEFAULT`; `preferences.md`, text wrap).
    pub contour: Option<Contour>,
    /// Default graphic, text and grid object style UIDs (chunk 0x1B959).
    pub default_object_styles: Option<[u32; 3]>,
    /// Layout and story grid defaults: element, grid settings and, for
    /// the story grid, `CharacterCountSize`.
    pub grids: Vec<(&'static str, super::GridData, Option<f64>)>,
    /// The colour of baseline frame grids, for the preferences and every
    /// object style.
    pub baseline_frame_grid_color: Option<FrameGridColor>,
    /// Column rule of the default text frame settings (chunk 0x22646, as
    /// frames): f64 width at 28, u32 swatch UID at 36.
    pub frame_column_rule: Option<(f64, u32)>,
    /// Footnote settings of the default text frame settings (chunk
    /// 0x22608, as frames): u16 span at 2, f64 minimum spacing at 4, f64
    /// space between at 12.
    pub frame_footnotes: Option<(bool, f64, f64)>,
    /// `ViewPreference` `RulerOrigin` (chunk 0x808).
    pub ruler_origin: RulerOrigin,
}

/// The point guide locations are measured from (`preferences.md`, ruler
/// origin; `objects.md`, guides).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RulerOrigin {
    #[default]
    Spread,
    Page,
    Spine,
}

impl RulerOrigin {
    /// The IDML enumeration value.
    pub fn idml(self) -> &'static str {
        match self {
            RulerOrigin::Spread => "SpreadOrigin",
            RulerOrigin::Page => "PageOrigin",
            RulerOrigin::Spine => "SpineOrigin",
        }
    }
}

/// The colour of baseline frame grids (`preferences.md`, baseline frame
/// grid colour).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FrameGridColor {
    /// An interface colour object.
    Rgb([f64; 3]),
    Charcoal,
    LightBlue,
}

/// The document's endnote options (preferences chunk 0x2261E). See
/// `docs/format/footnotes.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct EndnoteOptions {
    pub title: String,
    pub title_style: u32,
    /// Numbering style code.
    pub numbering: u32,
    pub start_at: u32,
    /// Restart code.
    pub restart: u32,
    /// Marker positioning code.
    pub positioning: u32,
    pub marker_style: u32,
    pub text_style: u32,
    pub separator: String,
    /// The last five fields: two u32, two strings, a u32. They hold one
    /// value in every sample.
    pub rest: (u32, u32, String, String, u32),
}

/// A u32 length in UTF-16 units, then text segments (chunks 0x2820 and
/// 0x2261E).
fn counted_string(c: &mut Cursor) -> Result<String, Error> {
    let n = c.u32()? as usize;
    if n == 0 {
        Ok(String::new())
    } else {
        c.segments(n)
    }
}

impl EndnoteOptions {
    pub fn read(enc: Encoding, d: &[u8]) -> Result<EndnoteOptions, Error> {
        let mut c = enc.cursor(d);
        Ok(EndnoteOptions {
            title: counted_string(&mut c)?,
            title_style: c.u32()?,
            numbering: c.u32()?,
            start_at: c.u32()?,
            restart: c.u32()?,
            positioning: c.u32()?,
            marker_style: c.u32()?,
            text_style: c.u32()?,
            separator: counted_string(&mut c)?,
            rest: (
                c.u32()?,
                c.u32()?,
                counted_string(&mut c)?,
                counted_string(&mut c)?,
                c.u32()?,
            ),
        })
    }
}

/// The document's footnote options (preferences chunk 0x2820). See
/// `docs/format/footnotes.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct FootnoteOptions {
    pub marker_style: u32,
    pub text_style: u32,
    /// Numbering style code.
    pub numbering: u32,
    pub start_at: u32,
    /// Restart code.
    pub restart: u16,
    /// Superscript and ruby flags of the marker.
    pub marker: (u16, u16),
    pub space_between: f64,
    pub spacer: f64,
    /// u16 at 40: `EosPlacement`.
    pub eos_placement: u16,
    /// Prefix and suffix display code.
    pub prefix_suffix: u16,
    pub prefix: String,
    pub suffix: String,
    pub separator: String,
    /// The fields after the strings, when the tail has a known length.
    pub tail: Option<FootnoteTail>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FootnoteTail {
    pub no_splitting: bool,
    /// f64 at 4: `FootnoteMinimumFirstBaselineOffset`.
    pub minimum_first_baseline: f64,
    /// `EnableStraddling`; only in the 174-byte tail.
    pub straddling: Option<bool>,
    /// The rule and the continuing rule.
    pub rules: [FootnoteRule; 2],
}

/// A footnote rule block (78 bytes).
#[derive(Debug, Clone, PartialEq)]
pub struct FootnoteRule {
    pub on: bool,
    /// Stroke type code.
    pub stroke: u32,
    pub color: u32,
    pub weight: f64,
    pub tint: f64,
    pub gap_color: u32,
    pub gap_tint: f64,
    pub left_indent: f64,
    pub width: f64,
    pub offset: f64,
}

impl FootnoteOptions {
    /// Read chunk 0x2820; `tail` is `None` when its tail has a length not
    /// seen.
    pub fn read(enc: Encoding, d: &[u8]) -> Result<FootnoteOptions, Error> {
        let mut c = enc.cursor(d);
        let marker_style = c.u32()?;
        let text_style = c.u32()?;
        let numbering = c.u32()?;
        let start_at = c.u32()?;
        let restart = c.u16()?;
        let superscript = c.u16()?;
        c.skip(2)?;
        let ruby = c.u16()?;
        let space_between = c.f64()?;
        let spacer = c.f64()?;
        let eos_placement = c.u16()?;
        let prefix_suffix = c.u16()?;
        let prefix = counted_string(&mut c)?;
        let suffix = counted_string(&mut c)?;
        let separator = counted_string(&mut c)?;
        let t = c.remaining();
        let tail = if t == 172 || t == 174 {
            let tail = c.bytes(t)?;
            let rule_at = if t == 174 { 18 } else { 16 };
            let rule = |at: usize| -> Result<FootnoteRule, Error> {
                let mut r = enc.cursor(&tail[at..at + 78]);
                let on = r.u16()? != 0;
                let stroke = r.u32()?;
                r.skip(4)?;
                let color = r.u32()?;
                let weight = r.f64()?;
                let tint = r.f64()?;
                r.skip(2)?;
                let gap_color = r.u32()?;
                let gap_tint = r.f64()?;
                r.skip(2)?;
                Ok(FootnoteRule {
                    on,
                    stroke,
                    color,
                    weight,
                    tint,
                    gap_color,
                    gap_tint,
                    left_indent: r.f64()?,
                    width: r.f64()?,
                    offset: r.f64()?,
                })
            };
            Some(FootnoteTail {
                no_splitting: enc.u16_at(tail, 0) != Some(0),
                minimum_first_baseline: enc.f64_at(tail, 4).unwrap_or_default(),
                straddling: (t == 174).then(|| enc.u16_at(tail, 12) != Some(0)),
                rules: [rule(rule_at)?, rule(rule_at + 78)?],
            })
        } else {
            None
        };
        Ok(FootnoteOptions {
            marker_style,
            text_style,
            numbering,
            start_at,
            restart,
            marker: (superscript, ruby),
            space_between,
            spacer,
            eos_placement,
            prefix_suffix,
            prefix,
            suffix,
            separator,
            tail,
        })
    }
}

/// A record of the print settings, written in base64: element, attribute
/// (`PrintRecord`, `PaperSizeSelector`) and bytes.
pub type PrintBlob = (&'static str, &'static str, Vec<u8>);

/// The value of a `Properties` child of a preference element.
#[derive(Debug, Clone, PartialEq)]
pub enum PrefProp {
    /// Text of the given IDML type (`string`, `enumeration`).
    Text(&'static str, String),
    /// An empty element with these attributes.
    Attrs(Vec<(&'static str, String)>),
    /// An element with these children.
    Nodes(Vec<PrefNode>),
}

/// An element in a tree of preference values.
#[derive(Debug, Clone, PartialEq)]
pub struct PrefNode {
    pub tag: &'static str,
    pub attrs: Vec<(&'static str, String)>,
    pub children: Vec<PrefNode>,
}

/// The index options (preferences chunk 0x13010). See
/// `docs/format/preferences.md`, index options.
#[derive(Debug, Clone, PartialEq)]
pub struct IndexOptions {
    pub title: String,
    /// Name of the title's paragraph style.
    pub title_style: String,
    pub replace_existing: bool,
    pub include_book_documents: bool,
    pub include_section_headings: bool,
    /// `FollowingTopicSeparator`, `BetweenPageNumbersSeparator`,
    /// `BetweenEntriesSeparator`, `BeforeCrossReferenceSeparator`,
    /// `PageRangeSeparator`, `EntryEndSeparator`.
    pub separators: [String; 6],
    /// Style names: `Level1Style` to `Level4Style` and
    /// `SectionHeadingStyle` (paragraph styles), then `PageNumberStyle`,
    /// `CrossReferenceStyle` and `CrossReferenceTopicStyle` (character
    /// styles).
    pub styles: [String; 8],
}

impl IndexOptions {
    pub fn read(enc: Encoding, d: &[u8]) -> Result<IndexOptions, Error> {
        let mut c = enc.cursor(d);
        let title = counted_string(&mut c)?;
        let title_style = flagged(&mut c)?.1;
        let replace_existing = c.u8()? == 1;
        let include_book_documents = c.u8()? == 1;
        flagged(&mut c)?;
        let include_section_headings = c.bytes(14)?[10] == 1;
        let mut separators: [String; 6] = Default::default();
        for s in &mut separators {
            *s = counted_string(&mut c)?;
        }
        let mut styles: [String; 8] = Default::default();
        for s in &mut styles {
            *s = flagged(&mut c)?.1;
        }
        Ok(IndexOptions {
            title,
            title_style,
            replace_existing,
            include_book_documents,
            include_section_headings,
            separators,
            styles,
        })
    }
}

/// The index header setting (preferences chunk 0x1300E): its attributes
/// and the groups of `ListOfIndexHeaderGroup`. See
/// `docs/format/preferences.md`, index header setting.
fn index_header(enc: Encoding, d: &[u8]) -> Result<(Vec<PrefValue>, Vec<PrefNode>), Error> {
    const E: &str = "IndexHeaderSetting";
    let key = |(flag, text): (u8, String)| {
        if flag == 1 { builtin_key(&text) } else { text }
    };
    let mut c = enc.cursor(d);
    let mut values = Vec::new();
    let mut set = |name: &'static str, value: String| {
        values.push(PrefValue {
            element: E,
            name,
            value,
        })
    };
    set("HeaderSetName", key(flagged(&mut c)?));
    set("HeaderSetLanguage", c.u16()?.to_string());
    set("IndexHeaderSetHandler", c.u32()?.to_string());
    set("IndexHeaderSetGroupValue", c.u32()?.to_string());
    set("IndexHeaderSetGroupOptionValue", c.u32()?.to_string());
    c.u16()?;
    let groups = c.u32()?;
    let mut list = Vec::new();
    for _ in 0..groups {
        let internal = key(flagged(&mut c)?);
        let ui = key(flagged(&mut c)?);
        let document = builtin_key(&counted_string(&mut c)?);
        let visible = c.u16()? == 1;
        let n = c.u32()?;
        let mut sections = Vec::new();
        for _ in 0..n {
            let sorting = builtin_key(&counted_string(&mut c)?);
            let header = builtin_key(&counted_string(&mut c)?);
            let ui = key(flagged(&mut c)?);
            let language = c.u16()?;
            sections.push(PrefNode {
                tag: "SectionHeaderType",
                attrs: vec![
                    ("SortingHeaderString", sorting),
                    ("DocumentHeaderString", header),
                    ("UIHeaderString", ui),
                    ("Language", language.to_string()),
                ],
                children: Vec::new(),
            });
        }
        list.push(PrefNode {
            tag: "IndexHeaderGroupType",
            attrs: vec![
                ("InternalName", internal),
                ("UIString", ui),
                ("DocumentString", document),
                ("Visibility", visible.to_string()),
            ],
            children: vec![PrefNode {
                tag: "SectionHeaderArray",
                attrs: Vec::new(),
                children: sections,
            }],
        });
    }
    if c.remaining() != 0 {
        return Err(Error::Corrupt(format!(
            "index header setting: {} bytes left",
            c.remaining()
        )));
    }
    Ok((values, list))
}

/// Chapter number format codes (chunk 0x1A4C4).
fn chapter_format(code: u32) -> Option<&'static str> {
    Some(match code {
        0x1A477 => "1, 2, 3, 4...",
        0x1A47A => "A, B, C, D...",
        0x1A479 => "i, ii, iii, iv...",
        0x1A473 => "001,002,003...",
        _ => return None,
    })
}

/// A flagged in-object string: a flag byte (1 for a built-in key) and the
/// string.
fn flagged(c: &mut Cursor) -> Result<(u8, String), Error> {
    let flag = c.u8()?;
    Ok((flag, c.string()?))
}

/// Attributes of the print settings that `PrintBookletPrintPreference`
/// does not have (`docs/format/preferences.md`, print settings).
const NOT_IN_BOOKLET: [&str; 6] = [
    "PrintSpreads",
    "Thumbnails",
    "Tile",
    "TilingOverlap",
    "ThumbnailsPerPage",
    "IncludeSlugToPrint",
];

/// A built-in key or plain text: flag 1 gives `$ID/` and the key, flag 0
/// the text; other flags give nothing.
fn key_or_text((flag, text): (u8, String)) -> Option<String> {
    match flag {
        1 => Some(builtin_key(&text)),
        0 => Some(text),
        _ => None,
    }
}

/// Print settings (chunk 0xA4C, and 0xAF2 for booklets): see
/// `docs/format/preferences.md`, print settings. The two chunks have one
/// layout: a head of fields and strings, then fixed blocks with strings
/// between them, then the paper size selector.
fn print_prefs(
    enc: Encoding,
    d: &[u8],
    element: &'static str,
    values: &mut Vec<PrefValue>,
    props: &mut Vec<(&'static str, &'static str, PrefProp)>,
    records: &mut Vec<PrintBlob>,
) -> Result<(), Error> {
    let booklet = element == "PrintBookletPrintPreference";
    let mut set = |name: &'static str, value: String| {
        if !(booklet && NOT_IN_BOOKLET.contains(&name)) {
            values.push(PrefValue {
                element,
                name,
                value,
            })
        }
    };
    let mut c = enc.cursor(d);
    let has_record = c.u8()? != 0;
    c.u8()?;
    let n = c.u32()? as usize;
    records.push((element, "PrintRecord", c.bytes(n)?.to_vec()));
    let device = if has_record {
        c.u16()?;
        c.u32()?
    } else {
        c.u16()?;
        0
    };
    set("DeviceType", device.to_string());
    let preset = flagged(&mut c)?;
    let to = c.u32()?;
    let printer = flagged(&mut c)?;
    flagged(&mut c)?;
    let ppd = flagged(&mut c)?;
    let ppd_file = flagged(&mut c)?;
    let mut prop = |name: &'static str, ty: &'static str, text: String| {
        props.push((element, name, PrefProp::Text(ty, text)))
    };
    match (preset.0, preset.1.as_str()) {
        (1, "kPrSt_DefaultName") => prop("ActivePrinterPreset", "enumeration", "Default".into()),
        (1, "") => prop("ActivePrinterPreset", "enumeration", "Custom".into()),
        (1, _) => {}
        (_, name) => prop("ActivePrinterPreset", "string", name.into()),
    }
    let prepress = (printer.0, printer.1.as_str()) == (1, "kPrepress File");
    match (printer.0, printer.1.as_str()) {
        (1, "kPrepress File") => prop("Printer", "enumeration", "PostscriptFile".into()),
        (1, "") => prop("Printer", "string", "$ID/".into()),
        (1, _) => {}
        (_, name) => prop("Printer", "string", name.into()),
    }
    match (ppd.0, ppd.1.as_str()) {
        (1, "kDevice Independent") if prepress => {
            prop("PPD", "enumeration", "DeviceIndependent".into())
        }
        (1, "kDevice Independent") => prop("PPD", "string", builtin_key("kDevice Independent")),
        (1, "") => prop("PPD", "string", "$ID/".into()),
        (1, _) => {}
        (_, name) => prop("PPD", "string", name.into()),
    }
    set("PrintTo", to.to_string());
    set("PrintToDisk", (to == 2).to_string());
    let file = if ppd_file.0 == 1 {
        builtin_key(&ppd_file.1)
    } else {
        ppd_file.1
    };
    set("PPDFile", file);
    match c.u32()? {
        2 => set("PostScriptLevel", "Level2".into()),
        3 => set("PostScriptLevel", "Level3".into()),
        _ => {}
    }
    set("PrintResolution", num(c.f64()?));
    let mut rect = |name: &'static str, c: &mut Cursor| -> Result<(), Error> {
        let mut a = Vec::new();
        for side in ["Left", "Top", "Right", "Bottom"] {
            a.push((side, num_half_even(c.f64()?)));
        }
        props.push((element, name, PrefProp::Attrs(a)));
        Ok(())
    };
    rect("PaperSizeRect", &mut c)?;
    rect("ImageablePaperSizeRect", &mut c)?;
    let size = c.i32()?;
    let name = flagged(&mut c)?;
    let paper = match size {
        -3 => Some(("string", name.1)),
        -2 => Some(("enumeration", "DefinedByDriver".to_string())),
        -1 => Some(("enumeration", "Custom".to_string())),
        _ => None,
    };
    if let Some((ty, text)) = paper {
        props.push((element, "PaperSize", PrefProp::Text(ty, text)));
    }
    let mut enums: Vec<(&'static str, &'static str)> = Vec::new();
    let f = |b: &[u8], o: usize| enc.cursor(&b[o..]).f64().map(num);
    let flag = |v: u8| match v {
        0 => Some("false".to_string()),
        1 => Some("true".to_string()),
        _ => None,
    };
    let set_flag = |set: &mut dyn FnMut(&'static str, String), name, v: u8| {
        if let Some(v) = flag(v) {
            set(name, v);
        }
    };

    // Block A: paper ranges, orientation, copies.
    let a = c.bytes(126)?;
    set("PaperWidthRange", format!("{} {}", f(a, 8)?, f(a, 16)?));
    set("PaperHeightRange", format!("{} {}", f(a, 32)?, f(a, 40)?));
    set("PaperOffsetRange", format!("{} {}", f(a, 56)?, f(a, 64)?));
    match enc.cursor(&a[84..]).u16()? {
        0 => set("PrintPageOrientation", "Portrait".into()),
        1 => set("PrintPageOrientation", "Landscape".into()),
        _ => {}
    }
    set("Copies", enc.cursor(&a[104..]).u32()?.to_string());
    set_flag(&mut set, "PrintBlankPages", a[118]);
    // The page range: 0 at A+122 is `AllPages`; with 2 IDML has none,
    // whatever the page range text holds.
    if !booklet && enc.cursor(&a[122..]).u16()? == 0 {
        props.push((
            element,
            "PageRange",
            PrefProp::Text("enumeration", "AllPages".into()),
        ));
    }
    flagged(&mut c)?;

    // Block B: spreads, colour output, composite screening.
    let b = c.bytes(30)?;
    set_flag(&mut set, "PrintSpreads", b[4]);
    let output = match b[6] {
        0 => Some("CompositeGray"),
        1 => Some("CompositeRGB"),
        2 => Some("CompositeCMYK"),
        5 => Some("CompositeLeaveUnchanged"),
        _ => None,
    };
    if let Some(o) = output {
        set("ColorOutput", o.into());
        set("PreserveColorNumbers", (o != "CompositeRGB").to_string());
    }
    set_flag(&mut set, "TextAsBlack", b[10]);
    set("CompositeAngle", f(b, 14)?);
    set("CompositeFrequency", f(b, 22)?);
    if let Some(v) = key_or_text(flagged(&mut c)?) {
        set("CompositeScreening", v);
    }
    if let Some(v) = key_or_text(flagged(&mut c)?) {
        set("SeparationScreening", v);
    }

    // Block C: scaling and page position.
    let s = c.bytes(25)?;
    match s[0] {
        0 => enums.push(("ScaleMode", "ScaleToFit")),
        1 => enums.push(("ScaleMode", "ScaleWidthHeight")),
        _ => {}
    }
    set_flag(&mut set, "ScaleProportional", s[4]);
    set("ScaleWidth", f(s, 6)?);
    set("ScaleHeight", f(s, 14)?);
    match s[22] {
        0 => enums.push(("PagePosition", "UpperLeft")),
        3 => enums.push(("PagePosition", "Centered")),
        _ => {}
    }
    flagged(&mut c)?;

    // Block D: tiling, thumbnails, graphics and fonts.
    let g = c.bytes(48)?;
    if g[0] <= 2 {
        set("Tile", (g[0] == 1).to_string());
        set("Thumbnails", (g[0] == 2).to_string());
    }
    set("TilingOverlap", f(g, 8)?);
    match g[16] {
        2 => enums.push(("ThumbnailsPerPage", "K1x2")),
        4 => enums.push(("ThumbnailsPerPage", "K2x2")),
        9 => enums.push(("ThumbnailsPerPage", "K3x3")),
        _ => {}
    }
    match g[20] {
        0 => enums.push(("SendImageData", "AllImageData")),
        1 => enums.push(("SendImageData", "OptimizedSubsampling")),
        _ => {}
    }
    match g[24] {
        0 => enums.push(("DataFormat", "Binary")),
        1 => enums.push(("DataFormat", "ASCII")),
        _ => {}
    }
    set("BitmapResolution", enc.cursor(&g[30..]).u16()?.to_string());
    match g[42] {
        0 => enums.push(("FontDownloading", "None")),
        1 => enums.push(("FontDownloading", "Complete")),
        2 => enums.push(("FontDownloading", "Subset")),
        _ => {}
    }
    set_flag(&mut set, "DownloadPPDFonts", g[46]);
    let mark_type = match flagged(&mut c)? {
        (1, k) if k.is_empty() => Some("Default"),
        (1, k) if k == "kJMarksWithCircle" => Some("JMarkWithCircle"),
        _ => None,
    };

    // Block E: printer marks, bleed, slug, colour profile.
    let e = c.bytes(72)?;
    match e[0] {
        1 => enums.push(("MarkLineWeight", "P25pt")),
        2 => enums.push(("MarkLineWeight", "P50pt")),
        4 => enums.push(("MarkLineWeight", "P07mm")),
        5 => enums.push(("MarkLineWeight", "P10mm")),
        _ => {}
    }
    set("MarkOffset", f(e, 4)?);
    let marks = [
        ("CropMarks", e[12]),
        ("PageInformationMarks", e[14]),
        ("ColorBars", e[16]),
        ("RegistrationMarks", e[18]),
        ("BleedMarks", e[20]),
    ];
    for (name, v) in marks {
        set_flag(&mut set, name, v);
    }
    if marks.iter().all(|(_, v)| *v <= 1) {
        set(
            "AllPrinterMarks",
            marks.iter().all(|(_, v)| *v == 1).to_string(),
        );
    }
    set_flag(&mut set, "UseDocumentBleedToPrint", e[22]);
    set("BleedTop", f(e, 24)?);
    set_flag(&mut set, "BleedChain", e[32]);
    set("BleedInside", f(e, 34)?);
    set("BleedBottom", f(e, 42)?);
    set("BleedOutside", f(e, 50)?);
    set_flag(&mut set, "IncludeSlugToPrint", e[58]);
    let profile = match e[68] {
        0 => Some("PostScriptCMS"),
        1 => Some("UseDocument"),
        _ => None,
    };
    flagged(&mut c)?;
    c.skip(4)?;
    flagged(&mut c)?;

    // Block G: screen frequencies and angles of the inks.
    let k = c.bytes(98)?;
    for (o, name) in [
        (12, "CyanFrequency"),
        (20, "CyanAngle"),
        (30, "MagentaFrequency"),
        (38, "MagentaAngle"),
        (48, "YellowFrequency"),
        (56, "YellowAngle"),
        (66, "BlackFrequency"),
        (74, "BlackAngle"),
        (82, "SpotFrequency"),
        (90, "SpotAngle"),
    ] {
        set(name, f(k, o)?);
    }
    let preset = match flagged(&mut c)? {
        (1, key) => Some(builtin_key(&key)),
        (3, name) if name == "[High Resolution]" || name == "[Vysoké rozlišení]" => {
            Some(builtin_key("kFlSt_HighDefaultName"))
        }
        _ => None,
    };
    if let Some(p) = preset {
        set("FlattenerPresetName", p);
    }

    // The paper size selector.
    c.skip(6)?;
    let n = c.u32()? as usize;
    records.push((element, "PaperSizeSelector", c.bytes(n)?.to_vec()));

    for (name, v) in enums {
        set(name, v.into());
    }
    for (name, v) in [("MarkType", mark_type), ("Profile", profile)] {
        if let Some(v) = v {
            props.push((element, name, PrefProp::Text("enumeration", v.into())));
        }
    }
    Ok(())
}

/// Chunks of the preferences object.
mod id {
    pub const VIEW: u32 = 0x1202;
    pub const BASELINE_GRID: u32 = 0x55F;
    pub const DOCUMENT_GRID: u32 = 0x545;
    pub const BASELINE_GRID_SHOWN: u32 = 0x56A;
    pub const GUIDES_LOCKED: u32 = 0x569;
    pub const COLUMN_GUIDES_LOCKED: u32 = 0x56B;
    pub const SHOW_FRAME_EDGES: u32 = 0x593;
    pub const SHOW_RULERS: u32 = 0x803;
    pub const RULER_ORIGIN: u32 = 0x808;
    pub const SHOW_INVISIBLES: u32 = 0xCAC7;
    pub const COLOR_PROFILES: u32 = 0x7C04;
    pub const COLOR_INTENT: u32 = 0x7C08;
    pub const COLOR_POLICIES: u32 = 0x7C44;
    pub const WATERMARK: u32 = 0x16344;
    pub const TEXT: u32 = 0x280;
    /// Baseline frame grid settings: u32 at 20 an interface colour or 0.
    pub const BASELINE_FRAME_GRID: u32 = 0x2834;
    pub const SMART_TEXT_REFLOW: u32 = 0x28BE;
    pub const MARGINS: u32 = 0x550;
    pub const COLUMNS: u32 = 0x555;
    pub const ANCHOR: u32 = 0x2800;
    /// Footnote options.
    pub const FOOTNOTE_OPTIONS: u32 = 0x2820;
    /// Endnote options.
    pub const ENDNOTE_OPTIONS: u32 = 0x2261E;
    pub const PRINT: u32 = 0xA4C;
    pub const PRINT_BOOKLET: u32 = 0xAF2;
    /// Booklet options: page range, margins.
    pub const BOOKLET_OPTIONS: u32 = 0xAF0;
    pub const PASTEBOARD: u32 = 0x5D2;
    pub const XML_TAGS: u32 = 0xBF4F;
    pub const GRIDS_IN_BACK: u32 = 0x567;
    pub const TEXT_WRAP: u32 = 0x3768;
    /// The chunk of the page item defaults object (class 0x6E07).
    pub const ITEM_DEFAULTS: u32 = 0x6E07;
    /// Page item defaults: 16 bytes, then three entries of u16 and u32
    /// UID (an object of class 0x5533, a gradient and a colour).
    pub const ITEM_DEFAULT_SWATCHES: u32 = 0x6E06;
    /// Name of a colour profile object (class 0x7D03).
    pub const PROFILE_NAME: u32 = 0x13C;
    /// Index options.
    pub const INDEX_OPTIONS: u32 = 0x13010;
    /// Index header setting.
    pub const INDEX_HEADER: u32 = 0x1300E;
    /// Chapter numbering.
    pub const CHAPTER_NUMBER: u32 = 0x1A4C4;
    /// Present when hyphenation and spelling use the document's
    /// dictionary.
    pub const DICTIONARY: u32 = 0x2806;
    /// EPUB export options.
    pub const EPUB: u32 = 0x21A1A;
    /// HTML export options.
    pub const HTML: u32 = 0x21A19;
    /// Fixed layout EPUB export options.
    pub const EPUB_FIXED_LAYOUT: u32 = 0x21A25;
    /// Publish Online export options.
    pub const PUBLISH: u32 = 0x21A20;
    /// Adjust layout options.
    pub const ADJUST_LAYOUT: u32 = 0x7020;
    pub const DEFAULT_PARAGRAPH_STYLE: u32 = 0x28D4;
    pub const DEFAULT_CHARACTER_STYLE: u32 = 0x28D5;
    pub const DEFAULT_OBJECT_STYLES: u32 = 0x1B959;
    pub const LAYOUT_GRID: u32 = 0xCD2F;
    pub const STORY_GRID: u32 = 0xCD2E;
    /// Present when new documents have a master text frame.
    pub const MASTER_TEXT_FRAME: u32 = 0x59C;
    pub const BLENDING_SPACE: u32 = 0x1081F;
    pub const ALLOW_PAGE_SHUFFLE: u32 = 0x5A6;
    pub const GUIDES_SHOWN: u32 = 0x568;
    pub const SNAP: u32 = 0x55A;
    pub const GUIDES: u32 = 0x53F;
    pub const ZERO_POINT: u32 = 0x54A;
    pub const LAYOUT_ADJUSTMENT: u32 = 0x7006;
    pub const SHOW_TEXT_THREADS: u32 = 0xCA0B;
    pub const DOCUMENT_GRID_SHOWN: u32 = 0x566;
    pub const STYLE_PREVIEW: u32 = 0xCAF3;
    pub const HIGHLIGHT_HJ_VIOLATIONS: u32 = 0xCA62;
    pub const HIGHLIGHT_CUSTOM_SPACING: u32 = 0xCAD3;
    pub const HIGHLIGHT_SUBSTITUTED_GLYPHS: u32 = 0xCAD4;
    pub const SNAP_TO_LAYOUT_GRID: u32 = 0xCD14;
    pub const SHOW_ALL_LAYOUT_GRIDS: u32 = 0xCD1C;
    pub const SHOW_ALL_FRAME_GRIDS: u32 = 0xCD1D;
    pub const SHOW_CHARACTER_COUNT: u32 = 0xCD1E;
    /// i16 `MojikumiUiSettings`.
    pub const MOJIKUMI_UI: u32 = 0x42DB;
    /// u32 1 where the tagged PDF structure follows the articles.
    pub const ARTICLE_ORDER: u32 = 0x11C69;
    /// XML import options: u32 count of key and value pairs.
    pub const XML_IMPORT: u32 = 0x1BC0B;
    /// Story settings, as the story chunk 0x2EE.
    pub const STORY: u32 = 0x2EE;
    /// Text wrap of new page items: the page item chunk 0x3703 without
    /// the path UID.
    pub const ITEM_TEXT_WRAP: u32 = 0x3720;
    /// Contour of new placed graphics: the layout of page item chunk
    /// 0x373D.
    pub const ITEM_CONTOUR: u32 = 0x373F;
}

/// Interface colours that preferences without their chunk have
/// (`docs/format/preferences.md`).
mod ui {
    pub const LIGHT_GRAY: [f64; 3] = [0.73, 0.73, 0.73];
    pub const MAGENTA: [f64; 3] = [1.0, 0.31, 1.0];
    pub const FIESTA: [f64; 3] = [0.97, 0.35, 0.42];
    pub const GRID_BLUE: [f64; 3] = [0.48, 0.73, 0.85];
    pub const LAVENDER: [f64; 3] = [0.6, 0.6, 1.0];
    pub const VIOLET: [f64; 3] = [0.6, 0.2, 1.0];
}

/// `CreateLinkToXML` from the XML import options (chunk 0x1BC0B): a u32
/// count of key and value pairs, each a u32 length in UTF-16 units and
/// text segments. No pairs is `false`; key `XMediaUI_CreateLink` with
/// value `1` is `true`. `None` where the pairs cannot be read or lack the
/// key.
fn xml_import_link(enc: Encoding, d: &[u8]) -> Option<bool> {
    let mut c = enc.cursor(d);
    let n = c.u32().ok()?;
    for _ in 0..n {
        let len = c.u32().ok()? as usize;
        let key = c.segments(len).ok()?;
        let len = c.u32().ok()? as usize;
        let value = c.segments(len).ok()?;
        if key == "XMediaUI_CreateLink" {
            return Some(value == "1");
        }
    }
    (n == 0).then_some(false)
}

/// The EPUB metadata strings, in the order of chunks 0x21A1A and 0x21A25.
const EPUB_METADATA: [&str; 6] = [
    "EpubTitle",
    "EpubCreator",
    "EpubDate",
    "EpubDescription",
    "EpubRights",
    "EpubSubject",
];

/// A flagged string as IDML writes a style name: `$ID/` before the text of
/// a built-in name (flag 1).
fn style_name((flag, text): (u8, String)) -> String {
    if flag == 1 {
        format!("$ID/{text}")
    } else {
        text
    }
}

/// `ImageExportResolution` of a stored resolution in ppi.
fn resolution(ppi: u32) -> Option<&'static str> {
    match ppi {
        72 => Some("Ppi72"),
        150 => Some("Ppi150"),
        _ => None,
    }
}

/// Values of the EPUB export options (chunk 0x21A1A), or `None` for a
/// layout the samples do not show. Two blocks have lengths that differ
/// between versions; the layout read is the one that ends exactly at the
/// chunk's end (preferences.md, EPUB export).
fn epub_export(enc: Encoding, d: &[u8]) -> Option<Vec<(&'static str, String)>> {
    let read = |b2: usize, b3: usize| -> Result<Vec<(&'static str, String)>, Error> {
        let mut c = enc.cursor(d);
        let mut out = Vec::new();
        let mut code = |name, v: u32, codes: &[(u32, &'static str)]| {
            if let Some((_, s)) = codes.iter().find(|(k, _)| *k == v) {
                out.push((name, s.to_string()));
            }
        };
        code("Version", c.u32()?, &[(0, "Epub2"), (1, "Epub3")]);
        code(
            "ExportOrder",
            c.u32()?,
            &[(1, "LayoutOrder"), (2, "ArticlePanelOrder")],
        );
        code(
            "EpubCover",
            c.u32()?,
            &[(0, "None"), (1, "FirstPage"), (2, "ExternalImage")],
        );
        out.push(("CoverImageFile", flagged(&mut c)?.1));
        c.u16()?;
        let toc = flagged(&mut c)?;
        out.push(("UseTocStyle", (!toc.1.is_empty()).to_string()));
        out.push(("TocStyleName", style_name(toc)));
        match c.u16()? {
            0 => out.push(("BreakDocument", "false".into())),
            1 => out.push(("BreakDocument", "true".into())),
            _ => {}
        }
        out.push(("ParagraphStyleName", style_name(flagged(&mut c)?)));
        c.skip(46)?;
        out.push(("EpubPublisher", flagged(&mut c)?.1));
        out.push(("Id", flagged(&mut c)?.1));
        c.skip(b2 - 50)?;
        let mut b = enc.cursor(c.bytes(50)?);
        // Four settings change together in every sample.
        match b.u16()? {
            0 => out.extend([
                ("PreserveLayoutAppearence", "false".to_string()),
                ("FootnotePlacement", "FootnoteInsidePopup".into()),
                ("UseExistingImageOnExport", "true".into()),
                ("UseOriginalImageOnExport", "true".into()),
            ]),
            1 => out.extend([
                ("PreserveLayoutAppearence", "true".to_string()),
                ("FootnotePlacement", "FootnoteAfterStory".into()),
                ("UseExistingImageOnExport", "false".into()),
                ("UseOriginalImageOnExport", "false".into()),
            ]),
            _ => {}
        }
        if let Some(r) = resolution(u32::from(b.u16()?)) {
            out.push(("ImageExportResolution", r.into()));
        }
        b.u16()?;
        match b.u16()? {
            0 => out.push(("CustomImageSizeOption", "SizeFixed".into())),
            1 => out.push(("CustomImageSizeOption", "SizeRelativeToTextFlow".into())),
            _ => {}
        }
        if !flagged(&mut c)?.1.is_empty() {
            return Err(Error::Corrupt("EPUB export: string not empty".into()));
        }
        let block = c.bytes(b3)?;
        let font = enc.u16_at(block, if b3 == 26 { 14 } else { 10 });
        match font {
            Some(0) => out.push(("EmbedFont", "false".into())),
            Some(1) => out.push(("EmbedFont", "true".into())),
            _ => {}
        }
        if c.remaining() > 0 {
            for name in EPUB_METADATA {
                out.push((name, flagged(&mut c)?.1));
            }
        }
        if c.remaining() > 0 {
            return Err(Error::Corrupt("EPUB export: bytes left".into()));
        }
        Ok(out)
    };
    [(50, 20), (50, 22), (50, 26), (52, 20), (52, 22), (52, 26)]
        .into_iter()
        .find_map(|(b2, b3)| read(b2, b3).ok())
}

/// Values of the HTML export options (chunk 0x21A19): u32 at 4, u16 at
/// 48 and 54, and after byte 98 a string, 6 bytes (10 from InDesign 17),
/// two strings, a u16 and the u16 `PreserveLocalOverride`.
fn html_export(enc: Encoding, d: &[u8]) -> Vec<(&'static str, String)> {
    let mut out = Vec::new();
    match enc.u32_at(d, 4) {
        Some(1) => out.push(("ExportOrder", "LayoutOrder".to_string())),
        Some(2) => out.push(("ExportOrder", "ArticlePanelOrder".to_string())),
        _ => {}
    }
    for (o, name) in [
        (48, "ViewDocumentAfterExport"),
        (54, "PreserveLayoutAppearence"),
    ] {
        match enc.u16_at(d, o) {
            Some(0) => out.push((name, "false".into())),
            Some(1) => out.push((name, "true".into())),
            _ => {}
        }
    }
    let local = |gap: usize| -> Result<u16, Error> {
        let mut c = enc.cursor(d);
        c.skip(98)?;
        flagged(&mut c)?;
        c.skip(gap)?;
        flagged(&mut c)?;
        flagged(&mut c)?;
        c.u16()?;
        c.u16()
    };
    match local(6).or_else(|_| local(10)) {
        Ok(0) => out.push(("PreserveLocalOverride", "false".into())),
        Ok(1) => out.push(("PreserveLocalOverride", "true".into())),
        _ => {}
    }
    out
}

/// Values of the fixed layout EPUB export options (chunk 0x21A25), read
/// to the chunk's end; `None` if the layout does not end there.
fn fixed_layout_export(enc: Encoding, d: &[u8]) -> Option<Vec<(&'static str, String)>> {
    let read = || -> Result<Vec<(&'static str, String)>, Error> {
        let mut c = enc.cursor(d);
        let mut out = Vec::new();
        match c.u32()? {
            0 => out.push(("EpubCover", "None".to_string())),
            1 => out.push(("EpubCover", "FirstPage".to_string())),
            2 => out.push(("EpubCover", "ExternalImage".to_string())),
            _ => {}
        }
        out.push(("CoverImageFile", flagged(&mut c)?.1));
        c.u16()?;
        out.push(("TocStyleName", style_name(flagged(&mut c)?)));
        c.u16()?;
        out.push(("EpubPublisher", flagged(&mut c)?.1));
        out.push(("Id", flagged(&mut c)?.1));
        c.skip(16)?;
        flagged(&mut c)?;
        c.skip(12)?;
        for name in EPUB_METADATA {
            out.push((name, flagged(&mut c)?.1));
        }
        // The page range: empty in every sample.
        flagged(&mut c)?;
        let tail = c.bytes(12)?;
        match enc.u32_at(tail, 8) {
            Some(0) => out.push(("EpubNavigationStyles", "NoNavigation".into())),
            Some(2) => out.push(("EpubNavigationStyles", "TocStyleNavigation".into())),
            Some(3) => out.push(("EpubNavigationStyles", "BookmarksNavigation".into())),
            _ => {}
        }
        if c.remaining() > 0 {
            return Err(Error::Corrupt("fixed layout export: bytes left".into()));
        }
        Ok(out)
    };
    read().ok()
}

/// Values of the Publish Online export options (chunk 0x21A20), read to
/// the chunk's end; `None` if the layout does not end there.
fn publish_export(enc: Encoding, d: &[u8]) -> Option<Vec<(&'static str, String)>> {
    let read = || -> Result<Vec<(&'static str, String)>, Error> {
        let mut c = enc.cursor(d);
        c.skip(8)?;
        let mut out = Vec::new();
        for name in ["PublishFileName", "PublishDescription", "PublishPageRange"] {
            out.push((name, flagged(&mut c)?.1));
        }
        c.skip(16)?;
        flagged(&mut c)?;
        c.skip(7)?;
        flagged(&mut c)?;
        c.skip(5)?;
        out.push(("CoverPage", style_name(flagged(&mut c)?)));
        if c.remaining() > 0 {
            return Err(Error::Corrupt("publish export: bytes left".into()));
        }
        Ok(out)
    };
    read().ok()
}

/// The EPUB accessibility attributes, in IDML order.
const EPUB_ACCESSIBILITY: [&str; 9] = [
    "EpubAccessibilityFeature",
    "EpubAccessibilityHazard",
    "EpubAccessibilityMode",
    "EpubAccessibilityModeSufficient",
    "EpubAccessibilitySummary",
    "EpubAccessibilityConformsTo",
    "EpubAccessibilityCertifiedBy",
    "EpubAccessibilityCredentials",
    "EpubAccessibilityReportLink",
];

/// The EPUB identifier of documents without EPUB export options.
const EPUB_ID: &str = "urn:uuid:29d919dd-24f5-4384-be78-b447c9dc299b";

/// Measurement unit codes (`ViewPreference`).
fn unit(code: u32) -> Option<&'static str> {
    Some(match code {
        0x1201 => "Points",
        0x1202 => "Picas",
        0x1203 => "Inches",
        0x1205 => "Millimeters",
        0x1206 => "Centimeters",
        0x120B => "Pixels",
        0x5101 => "Ha",
        0x510F => "Q",
        _ => return None,
    })
}

/// Colour management policy codes: four characters, stored reversed.
fn policy(code: &[u8]) -> Option<&'static str> {
    Some(match code {
        b" ffo" => "ColorPolicyOff",
        b"serp" => "PreserveEmbeddedProfiles",
        b"lidp" => "CombinationOfPreserveAndSafeCmyk",
        b"vnoc" => "ConvertToWorkingSpace",
        _ => return None,
    })
}

fn num(v: f64) -> String {
    crate::idml::num(v)
}

/// A number as IDML writes the paper rectangles of the print settings:
/// the digits of the shortest form that reads back, the last one rounded
/// half to even from the exact value (583.2000122070312, where the
/// shortest form is …313).
fn num_half_even(v: f64) -> String {
    if v == 0.0 || !v.is_finite() {
        return num(v);
    }
    // As many digits as the shortest form that reads back, rounded half
    // to even from the exact value.
    let shortest = format!("{v:e}");
    let n = shortest
        .split('e')
        .next()
        .unwrap_or("")
        .chars()
        .filter(|c| c.is_ascii_digit())
        .count()
        .max(1);
    let e = format!("{v:.*e}", n - 1);
    let (mant, exp) = e.split_once('e').unwrap_or((&e, "0"));
    let exp: i32 = exp.parse().unwrap_or(0);
    let neg = mant.starts_with('-');
    let digits: String = mant.chars().filter(|c| c.is_ascii_digit()).collect();
    let point = exp + 1;
    let mut out = if point <= 0 {
        format!("0.{}{}", "0".repeat((-point) as usize), digits)
    } else if point as usize >= digits.len() {
        format!("{}{}", digits, "0".repeat(point as usize - digits.len()))
    } else {
        format!(
            "{}.{}",
            &digits[..point as usize],
            &digits[point as usize..]
        )
    };
    if out.contains('.') {
        out = out.trim_end_matches('0').trim_end_matches('.').to_string();
    }
    if neg {
        out.insert(0, '-');
    }
    out
}

impl Reader<'_> {
    pub(super) fn prefs(&self, version: crate::header::Version) -> Result<Prefs, Error> {
        let major = version.major;
        let mut values = Vec::new();
        let mut colors = Vec::new();
        let mut text_defaults = None;
        let mut props = Vec::new();
        // The layouts below are those of InDesign CS5 (7.0) and later in
        // little-endian files: the versions the corpus pairs show.
        if major < 7 || self.enc().big_endian() {
            return Ok(Prefs::default());
        }
        let Some(&(uid, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Ok(Prefs::default());
        };
        let get = |id: u32| self.chunk(uid, id);
        // The code of the last session of the save history (document UID
        // 1): 0x0101 for a Japanese or other CJK edition. Values without a
        // chunk follow it (preferences.md, values of the exporting edition).
        let cjk = self.last_session(1).map(|(code, _)| code == 0x0101);
        let mut set = |element: &'static str, name: &'static str, value: String| {
            values.push(PrefValue {
                element,
                name,
                value,
            })
        };
        // A u16 flag; `absent` is the value of documents without the chunk.
        let flag = |id: u32, absent: bool| -> Result<Option<String>, Error> {
            Ok(match get(id)? {
                Some(d) if d.len() == 2 => match self.cursor(&d).u16()? {
                    0 => Some("false".into()),
                    1 => Some("true".into()),
                    _ => None,
                },
                Some(_) => None,
                None => Some(absent.to_string()),
            })
        };

        // Colour settings.
        if let Some(d) = get(id::COLOR_POLICIES)?.filter(|d| d.len() == 12) {
            if let Some(v) = policy(&d[4..8]) {
                set("Document", "RGBPolicy", v.into());
            }
            if let Some(v) = policy(&d[8..12]) {
                set("Document", "CMYKPolicy", v.into());
            }
        }
        if let Some(d) = get(id::COLOR_PROFILES)? {
            let mut c = self.cursor(&d);
            c.u16()?;
            let n = c.u32()? as usize;
            c.skip(4 * n)?;
            if c.u32()? >= 2 {
                for name in ["RGBProfile", "CMYKProfile"] {
                    let profile = c.u32()?;
                    let value = if profile == 0 {
                        Some("$ID/".to_string())
                    } else if self.class(profile) == Some(class::COLOR_PROFILE) {
                        match self.chunk(profile, id::PROFILE_NAME)? {
                            Some(s) if s.len() > 1 => self.cursor(&s[1..]).string().ok(),
                            _ => None,
                        }
                    } else {
                        None
                    };
                    if let Some(v) = value {
                        set("Document", name, v);
                    }
                }
            }
        }
        let intent = match get(id::COLOR_INTENT)? {
            None => Some("UseColorSettings"),
            Some(d) if d.len() >= 4 => match self.cursor(&d[2..]).u16()? {
                0 => Some("Perceptual"),
                2 => Some("RelativeColorimetric"),
                11 => Some("UseColorSettings"),
                _ => None,
            },
            Some(_) => None,
        };
        if let Some(i) = intent {
            for name in [
                "SolidColorIntent",
                "AfterBlendingIntent",
                "DefaultImageIntent",
            ] {
                set("Document", name, i.into());
            }
        }

        // View settings.
        if let Some(d) = get(id::VIEW)?.filter(|d| d.len() == 56) {
            let mut c = self.cursor(&d);
            let units: Vec<u32> = (0..6).map(|_| c.u32()).collect::<Result<_, _>>()?;
            for (i, names) in [
                &["HorizontalMeasurementUnits"][..],
                &["VerticalMeasurementUnits"],
                &["TypographicMeasurementUnits"],
                &["TextSizeMeasurementUnits"],
                &["PrintDialogMeasurementUnits"],
                &["LineMeasurementUnits", "StrokeMeasurementUnits"],
            ]
            .into_iter()
            .enumerate()
            {
                if let Some(u) = unit(units[i]) {
                    for name in names {
                        set("ViewPreference", name, u.into());
                    }
                }
            }
            for name in [
                "HorizontalCustomPoints",
                "VerticalCustomPoints",
                "CursorKeyIncrement",
                "PointsPerInch",
            ] {
                set("ViewPreference", name, num(c.f64()?));
            }
        }
        for (id, absent, element, name) in [
            (
                id::SHOW_FRAME_EDGES,
                true,
                "ViewPreference",
                "ShowFrameEdges",
            ),
            (id::SHOW_RULERS, true, "ViewPreference", "ShowRulers"),
            (
                id::BASELINE_GRID_SHOWN,
                false,
                "GridPreference",
                "BaselineGridShown",
            ),
            (id::GUIDES_LOCKED, false, "GuidePreference", "GuidesLocked"),
            (
                id::COLUMN_GUIDES_LOCKED,
                true,
                "DocumentPreference",
                "ColumnGuideLocked",
            ),
            (
                id::SHOW_INVISIBLES,
                false,
                "TextPreference",
                "ShowInvisibles",
            ),
            (id::GRIDS_IN_BACK, true, "GridPreference", "GridsInBack"),
            (
                id::DOCUMENT_GRID_SHOWN,
                false,
                "GridPreference",
                "DocumentGridShown",
            ),
            (
                id::STYLE_PREVIEW,
                false,
                "TextPreference",
                "EnableStylePreviewMode",
            ),
            (
                id::SHOW_ALL_FRAME_GRIDS,
                true,
                "CjkGridPreference",
                "ShowAllFrameGrids",
            ),
            (
                id::SHOW_CHARACTER_COUNT,
                true,
                "CjkGridPreference",
                "ShowCharacterCount",
            ),
        ] {
            if let Some(v) = flag(id, absent)? {
                set(element, name, v);
            }
        }
        // The highlight flags are `false` without their chunk, except in
        // a few documents that no stored value separates (preferences.md,
        // flags in their own chunks).
        for (id, element, name) in [
            (
                id::HIGHLIGHT_HJ_VIOLATIONS,
                "TextPreference",
                "HighlightHjViolations",
            ),
            (
                id::HIGHLIGHT_CUSTOM_SPACING,
                "TextPreference",
                "HighlightCustomSpacing",
            ),
            (
                id::HIGHLIGHT_SUBSTITUTED_GLYPHS,
                "TextPreference",
                "HighlightSubstitutedGlyphs",
            ),
        ] {
            if let Some(v) = flag(id, false)? {
                set(element, name, v);
            }
        }
        // Flags whose documents without the chunk do not have one value.
        for (id, element, name) in [
            (
                id::SNAP_TO_LAYOUT_GRID,
                "CjkGridPreference",
                "SnapToLayoutGrid",
            ),
            (
                id::SHOW_ALL_LAYOUT_GRIDS,
                "CjkGridPreference",
                "ShowAllLayoutGrids",
            ),
        ] {
            if get(id)?.is_some()
                && let Some(v) = flag(id, false)?
            {
                set(element, name, v);
            }
        }
        match get(id::MOJIKUMI_UI)? {
            Some(d) => {
                if let Some(v) = self.enc().u16_at(&d, 0) {
                    set(
                        "MojikumiUiPreference",
                        "MojikumiUiSettings",
                        (v as i16).to_string(),
                    );
                }
            }
            None => set("MojikumiUiPreference", "MojikumiUiSettings", "16383".into()),
        }
        // Chunk 0x11C69 changes both values; which one it stores is not
        // known (preferences.md, single-chunk preferences).
        let articles = match get(id::ARTICLE_ORDER)? {
            None => Some(false),
            Some(d) => (self.enc().u32_at(&d, 0) == Some(1)).then_some(true),
        };
        if let Some(a) = articles {
            let order = if a { "UseArticles" } else { "UseXMLStructure" };
            set("TaggedPDFPreference", "StructureOrder", order.into());
            set(
                "DictionaryPreference",
                "RecomposeWhenChanged",
                (!a).to_string(),
            );
        }
        if let Some(d) = get(id::XML_IMPORT)?
            && let Some(link) = xml_import_link(self.enc(), &d)
        {
            set("XMLImportPreference", "CreateLinkToXML", link.to_string());
        }
        // Story settings of new text frames: u16 at 12 optical margin
        // alignment, u16 at 14 frame type, f64 at 2 optical margin size.
        match get(id::STORY)? {
            Some(d) if d.len() == 16 => {
                let u = |o: usize| self.enc().u16_at(&d, o);
                match u(12) {
                    Some(0) => set("StoryPreference", "OpticalMarginAlignment", "false".into()),
                    Some(1) => set("StoryPreference", "OpticalMarginAlignment", "true".into()),
                    _ => {}
                }
                match u(14) {
                    Some(0) => set("StoryPreference", "FrameType", "TextFrameType".into()),
                    Some(1) => set("StoryPreference", "FrameType", "FrameGridType".into()),
                    _ => {}
                }
                if let Some(size) = self.enc().f64_at(&d, 2) {
                    set("StoryPreference", "OpticalMarginSize", num(size));
                }
            }
            Some(_) => {}
            None => {
                set("StoryPreference", "OpticalMarginAlignment", "false".into());
                set("StoryPreference", "FrameType", "TextFrameType".into());
                // 13 Q where text sizes are in Q, 12 pt otherwise, as
                // IDML writes them (preferences.md, story settings).
                let q = get(id::VIEW)?
                    .filter(|d| d.len() == 56)
                    .and_then(|d| self.enc().u32_at(&d, 12))
                    .map(|u| unit(u) == Some("Q"));
                match q {
                    Some(true) => set(
                        "StoryPreference",
                        "OpticalMarginSize",
                        "9.2125984251969".into(),
                    ),
                    Some(false) => set("StoryPreference", "OpticalMarginSize", "12".into()),
                    None => {}
                }
            }
        }
        // Text wrap of new page items: u32 mode, four f64 offsets (left,
        // top, right, bottom), u32 1 where the wrap applies everywhere.
        let wrap = match get(id::ITEM_TEXT_WRAP)? {
            Some(d) if d.len() == 40 => {
                let mut c = self.cursor(&d);
                let mode = c.u32()?;
                let offsets = [c.f64()?, c.f64()?, c.f64()?, c.f64()?];
                let everywhere = c.u32()?;
                Some((Some(mode), offsets, Some(everywhere)))
            }
            Some(_) => None,
            None => Some((Some(0), [0.0; 4], Some(1))),
        };
        if let Some((mode, [left, top, right, bottom], everywhere)) = wrap {
            let mode = match mode {
                Some(0) => Some("None"),
                Some(1) => Some("JumpObjectTextWrap"),
                Some(3) => Some("BoundingBoxTextWrap"),
                Some(6) => Some("Contour"),
                _ => None,
            };
            if let Some(m) = mode {
                set("TextWrapPreference", "TextWrapMode", m.into());
            }
            match everywhere {
                Some(0) => set("TextWrapPreference", "ApplyToMasterPageOnly", "true".into()),
                Some(1) => set(
                    "TextWrapPreference",
                    "ApplyToMasterPageOnly",
                    "false".into(),
                ),
                _ => {}
            }
            props.push((
                "TextWrapPreference",
                "TextWrapOffset",
                PrefProp::Attrs(vec![
                    ("Top", num(top)),
                    ("Left", num(left)),
                    ("Bottom", num(bottom)),
                    ("Right", num(right)),
                ]),
            ));
        }
        // The story orientation of new text frames: byte 116 of the text
        // preferences.
        if let Some(d) = get(id::TEXT)? {
            match d.get(116) {
                Some(0) => set("StoryPreference", "StoryOrientation", "Horizontal".into()),
                Some(1) => set("StoryPreference", "StoryOrientation", "Vertical".into()),
                _ => {}
            }
        }

        // Document setup beyond `DocumentPreferences`.
        if let Some(d) = get(chunk::DOCUMENT_PREFERENCES)?
            && let Some(l) = super::settings::SetupLayout::of(d.len())
        {
            let f = |o: usize| self.cursor(&d[o..]).f64();
            let b = |o: usize| (d[o] != 0).to_string();
            let s = l.slug;
            set(
                "DocumentPreference",
                "DocumentBleedUniformSize",
                b(l.bleed_uniform),
            );
            set("DocumentPreference", "SlugInsideOrLeftOffset", num(f(s)?));
            set("DocumentPreference", "SlugTopOffset", num(f(s + 8)?));
            set(
                "DocumentPreference",
                "SlugRightOrOutsideOffset",
                num(f(s + 16)?),
            );
            set("DocumentPreference", "SlugBottomOffset", num(f(s + 24)?));
            set(
                "DocumentPreference",
                "DocumentSlugUniformSize",
                b(l.slug_uniform),
            );
        }

        // Values without a field follow the edition of the last session of
        // the save history (preferences.md, values of the exporting
        // edition).
        let japanese_session = self.last_session(1).map(|(code, _)| code == 0x0101);
        // Text preferences and the default text frame columns.
        let mut baseline_frame_grid_color = None;
        if let Some(d) = get(id::TEXT)?.filter(|d| d.len() >= 174) {
            // Bytes 168 and 170 are `UseCidMojikumi` and
            // `UseNewVerticalScaling` in an order not known; they are
            // equal in every sample.
            if d[168] == d[170] && d[168] <= 1 {
                let on = (d[168] == 1).to_string();
                set("TextPreference", "UseCidMojikumi", on.clone());
                set("TextPreference", "UseNewVerticalScaling", on);
            }
            let ui = get(id::BASELINE_FRAME_GRID)?.and_then(|g| self.enc().u32_at(&g, 20));
            baseline_frame_grid_color = match (ui, japanese_session) {
                (Some(u), _) if u != 0 => self.ui_color(u)?.map(FrameGridColor::Rgb),
                (_, Some(true)) => Some(FrameGridColor::Charcoal),
                (_, Some(false)) => Some(FrameGridColor::LightBlue),
                _ => None,
            };
            let f = |o: usize| self.cursor(&d[o..]).f64();
            let b = |o: usize| (d[o] != 0).to_string();
            for (o, name) in [
                (0, "SmallCap"),
                (8, "SuperscriptSize"),
                (16, "SubscriptSize"),
                (24, "SuperscriptPosition"),
                (32, "SubscriptPosition"),
                (88, "LeadingKeyIncrement"),
                (96, "BaselineShiftKeyIncrement"),
            ] {
                set("TextPreference", name, num(f(o)?));
            }
            set(
                "TextPreference",
                "KerningKeyIncrement",
                num(f(104)? * 1000.0),
            );
            set("TextPreference", "TypographersQuotes", b(118));
            set("TextPreference", "LinkTextFilesWhenImporting", b(130));
            set("TextPreference", "UseParagraphLeading", b(162));
            if d.len() >= 212 {
                set("TextPreference", "QuoteCharactersRotatedInVertical", b(184));
            }
            if d.len() >= 214 {
                set("TextPreference", "ShapeIndicAndLatinWithHarbuzz", b(212));
            }
            set("TextFramePreference", "TextColumnGutter", num(f(40)?));
            set(
                "TextFramePreference",
                "TextColumnCount",
                self.cursor(&d[112..]).u32()?.to_string(),
            );
            const BASELINE: [&str; 5] = [
                "LeadingOffset",
                "AscentOffset",
                "CapHeight",
                "EmboxHeight",
                "XHeight",
            ];
            if let Some(v) = BASELINE.get(d[142] as usize) {
                set("TextFramePreference", "FirstBaselineOffset", v.to_string());
            }
        }
        match get(id::SMART_TEXT_REFLOW)? {
            Some(d) if d.len() >= 14 => {
                let b = |o: usize| (d[o] != 0).to_string();
                set("TextPreference", "SmartTextReflow", b(4));
                set("TextPreference", "LimitToMasterTextFrames", b(6));
                set("TextPreference", "DeleteEmptyPages", b(8));
                set("TextPreference", "PreserveFacingPageSpreads", b(10));
                if d.len() >= 16 {
                    set("TextPreference", "SmartTextReflowSync", b(12));
                }
            }
            Some(_) => {}
            None => {
                set("TextPreference", "SmartTextReflow", "false".into());
                set("TextPreference", "LimitToMasterTextFrames", "true".into());
                set("TextPreference", "DeleteEmptyPages", "false".into());
                set(
                    "TextPreference",
                    "PreserveFacingPageSpreads",
                    "false".into(),
                );
            }
        }

        // Default margins and columns of new pages.
        let margins = match get(id::MARGINS)? {
            Some(d) if d.len() >= 32 => {
                let f = |o: usize| self.cursor(&d[o..]).f64();
                Some([f(0)?, f(8)?, f(16)?, f(24)?])
            }
            Some(_) => None,
            None => Some([36.0; 4]),
        };
        if let Some([left, top, right, bottom]) = margins {
            set("MarginPreference", "Left", num(left));
            set("MarginPreference", "Top", num(top));
            set("MarginPreference", "Right", num(right));
            set("MarginPreference", "Bottom", num(bottom));
        }
        let columns = match get(id::COLUMNS)? {
            Some(d) if d.len() >= 12 => Some((self.cursor(&d).u32()?, self.cursor(&d[4..]).f64()?)),
            Some(_) => None,
            // 5 mm after a CJK session, 12 pt otherwise.
            None => Some((
                1,
                if cjk == Some(true) {
                    14.173228346456694
                } else {
                    12.0
                },
            )),
        };
        if let Some((count, gutter)) = columns {
            set("MarginPreference", "ColumnCount", count.to_string());
            set("MarginPreference", "ColumnGutter", num(gutter));
        }
        // Column direction: u16 at 12 of the column chunk; without it,
        // the story orientation of new frames (preferences.md, columns).
        let direction = match get(id::COLUMNS)? {
            Some(d) if d.len() >= 14 => self.enc().u16_at(&d, 12).map(u32::from),
            Some(_) => None,
            None => get(id::TEXT)?
                .and_then(|d| d.get(116).copied())
                .map(u32::from),
        };
        let direction = match direction {
            Some(0) => Some("Horizontal"),
            Some(1) => Some("Vertical"),
            _ => None,
        };
        if let Some(dir) = direction {
            set("DocumentPreference", "ColumnDirection", dir.into());
            set("MarginPreference", "ColumnDirection", dir.into());
        }
        let anchor = get(id::ANCHOR)?;

        // Pasteboard: f64 horizontal and vertical margins.
        let pasteboard = match get(id::PASTEBOARD)? {
            Some(d) if d.len() >= 16 => {
                let f = |o: usize| self.cursor(&d[o..]).f64();
                Some((f(0)?, f(8)?))
            }
            Some(_) => None,
            None => Some((-1.0, 72.0)),
        };
        if let Some((h, v)) = pasteboard {
            set(
                "PasteboardPreference",
                "PasteboardMargins",
                format!("{} {}", num(h), num(v)),
            );
            set("PasteboardPreference", "MinimumSpaceAboveAndBelow", num(v));
        }
        // From DOM 9 the chunk has 34 bytes, byte 32 the theme colour flag.
        match get(id::PASTEBOARD)? {
            Some(d) if d.len() == 34 => match d[32] {
                0 => set(
                    "PasteboardPreference",
                    "MatchPreviewBackgroundToThemeColor",
                    "false".into(),
                ),
                1 => set(
                    "PasteboardPreference",
                    "MatchPreviewBackgroundToThemeColor",
                    "true".into(),
                ),
                _ => {}
            },
            None if major >= 9 => set(
                "PasteboardPreference",
                "MatchPreviewBackgroundToThemeColor",
                "false".into(),
            ),
            _ => {}
        }
        // Text wrap: u8 at 0, 2 and, in 6-byte chunks, 4.
        if let Some(d) = get(id::TEXT_WRAP)?.filter(|d| d.len() >= 3) {
            set(
                "TextPreference",
                "AbutTextToTextWrap",
                (d[0] != 0).to_string(),
            );
            set("TextPreference", "ZOrderTextWrap", (d[2] != 0).to_string());
            if d.len() >= 6 {
                set(
                    "TextPreference",
                    "HonourTextIndentsWithTextWrap",
                    (d[4] != 0).to_string(),
                );
            }
        }
        // Default XML tags: name (u32 length, text segments) and u32 UID of
        // an interface colour, for story, table, (untagged), cell, image.
        if let Some(d) = get(id::XML_TAGS)? {
            let mut c = self.cursor(&d);
            for (name, color) in [
                (Some("DefaultStoryTagName"), "DefaultStoryTagColor"),
                (Some("DefaultTableTagName"), "DefaultTableTagColor"),
                (None, ""),
                (Some("DefaultCellTagName"), "DefaultCellTagColor"),
                (Some("DefaultImageTagName"), "DefaultImageTagColor"),
            ] {
                let n = c.u32()? as usize;
                let tag = c.segments(n)?;
                let ui = c.u32()?;
                if let Some(name) = name {
                    set("XMLPreference", name, tag);
                    if let Some(rgb) = self.ui_color(ui)? {
                        colors.push(("XMLPreference", color, rgb));
                    }
                }
            }
        }
        // Page item defaults: a table (u32, u32, u32 n, n 12-byte
        // entries), a page item attribute list, and a second table of the
        // same layout (objects.md, page item defaults).
        let mut item_default_entries = Vec::new();
        let item_defaults = match self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::ITEM_DEFAULTS)
        {
            Some(&(u, _)) => match self.chunk(u, id::ITEM_DEFAULTS)? {
                Some(d) => {
                    let mut c = self.cursor(&d);
                    let mut table = |c: &mut crate::object::Cursor| -> Result<(), Error> {
                        c.skip(8)?;
                        let n = c.u32()? as usize;
                        for _ in 0..n {
                            item_default_entries.push((c.u32()?, c.u32()?, c.u32()?));
                        }
                        Ok(())
                    };
                    match table(&mut c) {
                        Ok(()) => {
                            let attrs = self.attrs_or_warn(
                                || format!("page item defaults {u}"),
                                Attrs::parse_at(&mut c, List::Item, self.db.recorder()),
                            );
                            if attrs.is_some() && c.remaining() > 0 && table(&mut c).is_err() {
                                self.warn(format!(
                                    "page item defaults {u}: the second table is not complete"
                                ));
                            }
                            attrs
                        }
                        Err(_) => None,
                    }
                }
                None => None,
            },
            None => None,
        };

        // The attributes of items that do not store them (attributes.md,
        // values an item does not store).
        let item_base = match self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::ITEM_BASE)
        {
            Some(&(u, _)) => match self.chunk(u, crate::model::ids::chunk::ITEM_ATTRS)? {
                Some(d) => self.attrs_or_warn(
                    || format!("page item attribute base {u}"),
                    Attrs::parse(self.enc(), &d, List::Item, self.db.recorder()),
                ),
                None => None,
            },
            None => None,
        };

        // The swatches of chunk 0x6E06 of the page item defaults.
        let mut item_default_swatches = Vec::new();
        if let Some(&(u, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::ITEM_DEFAULTS)
            && let Some(d) = self.chunk(u, id::ITEM_DEFAULT_SWATCHES)?
            && d.len() == 34
        {
            let mut c = self.cursor(&d[16..]);
            for _ in 0..3 {
                c.u16()?;
                let uid = c.u32()?;
                if let Some(cls) = self.class(uid) {
                    item_default_swatches.push((cls, uid));
                }
            }
        }

        // Print settings.
        let mut print_records = Vec::new();
        for (id, element) in [
            (id::PRINT, "PrintPreference"),
            (id::PRINT_BOOKLET, "PrintBookletPrintPreference"),
        ] {
            if let Some(d) = get(id)? {
                let (mut v, mut p, mut r) = (Vec::new(), Vec::new(), Vec::new());
                // A layout the corpus does not show leaves the element as
                // observed.
                if print_prefs(self.enc(), &d, element, &mut v, &mut p, &mut r).is_ok() {
                    for pv in v {
                        set(pv.element, pv.name, pv.value);
                    }
                    // Stored Japanese marks are `Default` unless the last
                    // session was a CJK edition's (preferences.md, print
                    // settings).
                    if cjk == Some(false) {
                        for (_, name, value) in &mut p {
                            if *name == "MarkType"
                                && let PrefProp::Text(_, v) = value
                                && v == "JMarkWithCircle"
                            {
                                *v = "Default".into();
                            }
                        }
                    }
                    props.extend(p);
                    print_records.extend(r);
                }
            }
        }

        // Booklet options: u32, a flagged string (not mapped), 4 bytes,
        // then the four margins.
        let booklet = match get(id::BOOKLET_OPTIONS)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                (|| -> Result<[f64; 4], Error> {
                    c.u32()?;
                    flagged(&mut c)?;
                    c.skip(4)?;
                    Ok([c.f64()?, c.f64()?, c.f64()?, c.f64()?])
                })()
            }
            None => Ok([36.0; 4]),
        };
        if let Ok(m) = booklet {
            for (name, v) in ["TopMargin", "BottomMargin", "LeftMargin", "RightMargin"]
                .into_iter()
                .zip(m)
            {
                set("PrintBookletOption", name, num(v));
            }
        }

        // Default styles: u32 UIDs; the default is the third.
        let mut default_styles = [None, None];
        for (i, id) in [id::DEFAULT_PARAGRAPH_STYLE, id::DEFAULT_CHARACTER_STYLE]
            .into_iter()
            .enumerate()
        {
            default_styles[i] = get(id)?.and_then(|d| self.enc().u32_at(&d, 8));
        }
        let default_object_styles = get(id::DEFAULT_OBJECT_STYLES)?.and_then(|d| {
            let u = |o| self.enc().u32_at(&d, o);
            Some([u(8)?, u(12)?, u(16)?])
        });
        // Layout and story grids: as page chunk 0xCD02; the story grid
        // continues with u32 0 and f64 `CharacterCountSize`.
        let mut grids = Vec::new();
        for (id, element) in [
            (id::LAYOUT_GRID, "LayoutGridDataInformation"),
            (id::STORY_GRID, "StoryGridDataInformation"),
        ] {
            if let Some(d) = get(id)? {
                let mut c = self.cursor(&d);
                let read = (|| -> Result<(super::GridData, Option<f64>), Error> {
                    let g = super::GridData::read(&mut c)?;
                    let count = if element == "StoryGridDataInformation" {
                        c.u32()?;
                        Some(c.f64()?)
                    } else {
                        None
                    };
                    Ok((g, count))
                })();
                if let Ok((g, count)) = read {
                    grids.push((element, g, count));
                }
            }
        }
        // Master text frame: the chunk is there when it is on.
        let master = get(id::MASTER_TEXT_FRAME)?.is_some().to_string();
        set("DocumentPreference", "MasterTextFrame", master.clone());
        if major >= 8 {
            set("DocumentPreference", "CreatePrimaryTextFrame", master);
        }
        match get(id::BLENDING_SPACE)? {
            None => set("TransparencyPreference", "BlendingSpace", "CMYK".into()),
            Some(d) => match self.enc().u32_at(&d, 0) {
                Some(2) => set("TransparencyPreference", "BlendingSpace", "RGB".into()),
                Some(3) => set("TransparencyPreference", "BlendingSpace", "CMYK".into()),
                _ => {}
            },
        }
        // Guides, grids, pasteboard: flags and interface colours.
        let bool_at = |d: &[u8], o: usize| match d.get(o) {
            Some(0) => Some("false".to_string()),
            Some(1) => Some("true".to_string()),
            _ => None,
        };
        if let Some(v) = get(id::ALLOW_PAGE_SHUFFLE)?.and_then(|d| bool_at(&d, 0)) {
            set("DocumentPreference", "AllowPageShuffle", v);
        }
        match get(id::GUIDES_SHOWN)? {
            None => set("GuidePreference", "GuidesShown", "true".into()),
            Some(d) => {
                if let Some(v) = bool_at(&d, 0) {
                    set("GuidePreference", "GuidesShown", v);
                }
            }
        }
        match get(id::SNAP)? {
            None => {
                set("GuidePreference", "GuidesSnapto", "true".into());
                set("GridPreference", "DocumentGridSnapto", "false".into());
            }
            Some(d) => {
                if let Some(v) = bool_at(&d, 0) {
                    set("GuidePreference", "GuidesSnapto", v);
                }
                if let Some(v) = bool_at(&d, 2) {
                    set("GridPreference", "DocumentGridSnapto", v);
                }
            }
        }
        let ui_color = |colors: &mut Vec<(&'static str, &'static str, [f64; 3])>,
                        element: &'static str,
                        name: &'static str,
                        uid: Option<u32>| {
            if let Some(uid) = uid
                && let Ok(Some(rgb)) = self.ui_color(uid)
            {
                colors.push((element, name, rgb));
            }
        };
        if let Some(d) = get(id::GUIDES)? {
            if let Some(v) = bool_at(&d, 0) {
                set("GuidePreference", "GuidesInBack", v);
            }
            ui_color(
                &mut colors,
                "GuidePreference",
                "RulerGuidesColor",
                self.enc().u32_at(&d, 18),
            );
        }
        if let Some(d) = get(id::BASELINE_GRID)? {
            ui_color(
                &mut colors,
                "GridPreference",
                "BaselineColor",
                self.enc().u32_at(&d, 30),
            );
            match d.get(34) {
                Some(0) => set(
                    "GridPreference",
                    "BaselineGridRelativeOption",
                    "TopOfPageOfBaselineGridRelativeOption".into(),
                ),
                Some(1) => set(
                    "GridPreference",
                    "BaselineGridRelativeOption",
                    "TopOfMarginOfBaselineGridRelativeOption".into(),
                ),
                _ => {}
            }
        }
        for (id, at, element, name, absent) in [
            (
                id::DOCUMENT_GRID,
                32,
                "GridPreference",
                "GridColor",
                Some(ui::LIGHT_GRAY),
            ),
            (
                id::MARGINS,
                36,
                "DocumentPreference",
                "MarginGuideColor",
                Some(ui::MAGENTA),
            ),
            (
                id::COLUMNS,
                18,
                "DocumentPreference",
                "ColumnGuideColor",
                japanese_session.map(|j| if j { ui::LAVENDER } else { ui::VIOLET }),
            ),
        ] {
            match get(id)? {
                Some(d) => ui_color(&mut colors, element, name, self.enc().u32_at(&d, at)),
                None => {
                    if let Some(rgb) = absent {
                        colors.push((element, name, rgb));
                    }
                }
            }
        }
        match get(id::PASTEBOARD)? {
            Some(d) => {
                for (at, name) in [
                    (20, "BleedGuideColor"),
                    (24, "SlugGuideColor"),
                    (28, "PreviewBackgroundColor"),
                ] {
                    ui_color(
                        &mut colors,
                        "PasteboardPreference",
                        name,
                        self.enc().u32_at(&d, at),
                    );
                }
            }
            None => {
                for (name, rgb) in [
                    ("BleedGuideColor", ui::FIESTA),
                    ("SlugGuideColor", ui::GRID_BLUE),
                    ("PreviewBackgroundColor", ui::LIGHT_GRAY),
                ] {
                    colors.push(("PasteboardPreference", name, rgb));
                }
            }
        }
        match get(id::ZERO_POINT)? {
            None => set("Document", "ZeroPoint", "0 0".into()),
            Some(d) => {
                if let (Some(x), Some(y)) = (self.enc().f64_at(&d, 0), self.enc().f64_at(&d, 8)) {
                    set("Document", "ZeroPoint", format!("{} {}", num(x), num(y)));
                }
            }
        }
        match get(id::LAYOUT_ADJUSTMENT)? {
            Some(d) => {
                if let Some(v) = bool_at(&d, 0) {
                    set("LayoutAdjustmentPreference", "EnableLayoutAdjustment", v);
                }
                if let Some(z) = self.enc().f64_at(&d, 12) {
                    set("LayoutAdjustmentPreference", "SnapZone", num(z));
                }
            }
            None => set(
                "LayoutAdjustmentPreference",
                "EnableLayoutAdjustment",
                "false".into(),
            ),
        }
        if (major, version.minor) >= (21, 1) {
            let shown =
                get(id::SHOW_TEXT_THREADS)?.is_some_and(|d| self.enc().u16_at(&d, 0) == Some(1));
            set("ViewPreference", "ShowTextThreads", shown.to_string());
        }

        // Index header setting.
        if let Some(d) = get(id::INDEX_HEADER)? {
            match index_header(self.enc(), &d) {
                Ok((v, list)) => {
                    for pv in v {
                        set(pv.element, pv.name, pv.value);
                    }
                    props.push((
                        "IndexHeaderSetting",
                        "ListOfIndexHeaderGroup",
                        PrefProp::Nodes(list),
                    ));
                }
                Err(e) => self.warn(format!("index header setting left out: {e}")),
            }
        }
        // Chapter numbering: u32 format code, u32 source, u32 number, u16.
        let chapter = get(id::CHAPTER_NUMBER)?;
        if chapter.is_none() {
            props.push((
                "ChapterNumberPreference",
                "ChapterNumberFormat",
                PrefProp::Text("string", "1, 2, 3, 4...".into()),
            ));
            set(
                "ChapterNumberPreference",
                "ChapterNumberSource",
                "ContinueFromPreviousDocument".into(),
            );
            set("ChapterNumberPreference", "ChapterNumber", "1".into());
        }
        if let Some(d) = chapter.filter(|d| d.len() >= 12) {
            let mut c = self.cursor(&d);
            let (format, source, number) = (c.u32()?, c.u32()?, c.u32()?);
            if let Some(f) = chapter_format(format) {
                props.push((
                    "ChapterNumberPreference",
                    "ChapterNumberFormat",
                    PrefProp::Text("string", f.into()),
                ));
            }
            match source {
                1 => set(
                    "ChapterNumberPreference",
                    "ChapterNumberSource",
                    "UserDefined".into(),
                ),
                3 => set(
                    "ChapterNumberPreference",
                    "ChapterNumberSource",
                    "ContinueFromPreviousDocument".into(),
                ),
                _ => {}
            }
            set(
                "ChapterNumberPreference",
                "ChapterNumber",
                number.to_string(),
            );
        }
        // Dictionary: the chunk is there when composition uses the
        // document's dictionary.
        let composition = match get(id::DICTIONARY)? {
            Some(_) => "UseDocument",
            None => "Both",
        };
        set("DictionaryPreference", "Composition", composition.into());
        // EPUB and HTML export, from DOM 8 (preferences.md, EPUB, HTML
        // and Publish Online export).
        if major >= 8 {
            let v = (major, version.minor);
            // Every IDML of DOM 8 and 9 has it (preferences.md, EPUB,
            // HTML and Publish Online export).
            if major <= 9 {
                set(
                    "EPubExportPreference",
                    "ViewDocumentAfterExport",
                    "true".into(),
                );
            }
            match get(id::EPUB)? {
                Some(d) => match epub_export(self.enc(), &d) {
                    Some(e) => {
                        for (name, value) in e {
                            let since = match name {
                                "FootnotePlacement" | "UseOriginalImageOnExport" => (9, 2),
                                n if EPUB_METADATA.contains(&n)
                                    || n == "UseExistingImageOnExport" =>
                                {
                                    (10, 0)
                                }
                                _ => (8, 0),
                            };
                            if v >= since {
                                set("EPubExportPreference", name, value);
                            }
                        }
                    }
                    None => {
                        // A layout the samples do not show: the version and
                        // the identifier, the string that starts `urn:uuid:`.
                        match self.cursor(&d).u32()? {
                            0 => set("EPubExportPreference", "Version", "Epub2".into()),
                            1 => set("EPubExportPreference", "Version", "Epub3".into()),
                            _ => {}
                        }
                        if let Some((_, _, id)) =
                            super::strings::find_flagged_string(self.enc(), &d, 4, |s| {
                                s.starts_with("urn:uuid:")
                            })
                        {
                            set("EPubExportPreference", "Id", id);
                        }
                    }
                },
                None => {
                    let epub3 = v >= (18, 1);
                    let version = if epub3 { "Epub3" } else { "Epub2" };
                    let size = if v >= (21, 1) {
                        "SizeRelativeToTextFlow"
                    } else {
                        "SizeFixed"
                    };
                    for (name, value) in [
                        ("Version", version),
                        ("Id", EPUB_ID),
                        ("TocStyleName", "$ID/"),
                        ("UseTocStyle", "false"),
                        ("ExportOrder", "LayoutOrder"),
                        ("EpubCover", "FirstPage"),
                        ("CoverImageFile", ""),
                        ("BreakDocument", "false"),
                        ("ParagraphStyleName", "$ID/NormalParagraphStyle"),
                        ("EpubPublisher", ""),
                        ("PreserveLayoutAppearence", "true"),
                        ("ImageExportResolution", "Ppi150"),
                        ("CustomImageSizeOption", size),
                        ("EmbedFont", "true"),
                    ] {
                        set("EPubExportPreference", name, value.into());
                    }
                    if v >= (9, 2) {
                        set(
                            "EPubExportPreference",
                            "FootnotePlacement",
                            "FootnoteAfterStory".into(),
                        );
                        set(
                            "EPubExportPreference",
                            "UseOriginalImageOnExport",
                            "false".into(),
                        );
                    }
                    if v >= (10, 0) {
                        for name in EPUB_METADATA {
                            set("EPubExportPreference", name, String::new());
                        }
                        set(
                            "EPubExportPreference",
                            "UseExistingImageOnExport",
                            "false".into(),
                        );
                    }
                }
            }
            match get(id::HTML)? {
                Some(d) => {
                    for (name, value) in html_export(self.enc(), &d) {
                        set("HTMLExportPreference", name, value);
                    }
                }
                None => {
                    for (name, value) in [
                        ("ExportOrder", "LayoutOrder"),
                        ("ViewDocumentAfterExport", "true"),
                        ("PreserveLayoutAppearence", "false"),
                        ("PreserveLocalOverride", "true"),
                    ] {
                        set("HTMLExportPreference", name, value.into());
                    }
                }
            }
        }
        // EPUB accessibility from INDD 19.3, page navigation from 19.4
        // (preferences.md, EPUB accessibility). No sample has a value.
        let v = (major, version.minor);
        if v >= (19, 3) {
            for name in EPUB_ACCESSIBILITY {
                set("EPubExportPreference", name, String::new());
                set("EPubFixedLayoutExportPreference", name, String::new());
            }
        }
        if v >= (19, 4) {
            set(
                "EPubExportPreference",
                "EpubCreatePageNavigation",
                "true".into(),
            );
        }
        // Fixed layout EPUB export, from DOM 10.
        if major >= 10 {
            match get(id::EPUB_FIXED_LAYOUT)? {
                Some(d) => {
                    for (name, value) in fixed_layout_export(self.enc(), &d).unwrap_or_default() {
                        set("EPubFixedLayoutExportPreference", name, value);
                    }
                }
                None => {
                    for (name, value) in [
                        ("EpubCover", "FirstPage"),
                        ("CoverImageFile", ""),
                        ("TocStyleName", "$ID/"),
                        ("EpubPublisher", ""),
                        ("Id", EPUB_ID),
                        ("EpubNavigationStyles", "NoNavigation"),
                    ] {
                        set("EPubFixedLayoutExportPreference", name, value.into());
                    }
                    for name in EPUB_METADATA {
                        set("EPubFixedLayoutExportPreference", name, String::new());
                    }
                }
            }
        }
        // Adjust layout (designmap), from DOM 14: u16 flags at 0, 4 and 24
        // of the 26-byte chunk. Without it the writer decides
        // `EnableAdjustLayout` by the save history.
        if major >= 14
            && let Some(d) = get(id::ADJUST_LAYOUT)?.filter(|d| d.len() == 26)
        {
            for (o, name) in [
                (0, "EnableAdjustLayout"),
                (4, "AllowFontSizeAndLeadingAdjustment"),
                (24, "EnableAutoAdjustMargins"),
            ] {
                match self.enc().u16_at(&d, o) {
                    Some(0) => set("AdjustLayoutPreference", name, "false".into()),
                    Some(1) => set("AdjustLayoutPreference", name, "true".into()),
                    _ => {}
                }
            }
        }
        // Publish Online export (designmap), from DOM 11.
        if major >= 11 {
            match get(id::PUBLISH)? {
                Some(d) => {
                    for (name, value) in publish_export(self.enc(), &d).unwrap_or_default() {
                        set("PublishExportPreference", name, value);
                    }
                }
                None => {
                    for (name, value) in [
                        ("PublishFileName", ""),
                        ("PublishDescription", ""),
                        ("PublishPageRange", ""),
                        ("CoverPage", "$ID/"),
                    ] {
                        set("PublishExportPreference", name, value.into());
                    }
                }
            }
        }

        // Grids.
        if let Some(d) = get(id::BASELINE_GRID)?.filter(|d| d.len() >= 26) {
            let f = |o: usize| self.cursor(&d[o..]).f64();
            set("GridPreference", "BaselineDivision", num(f(2)?));
            set("GridPreference", "BaselineStart", num(f(10)?));
            set(
                "GridPreference",
                "BaselineViewThreshold",
                num(f(18)? * 100.0),
            );
        }
        let (h, hs, v, vs) = match get(id::DOCUMENT_GRID)? {
            Some(d) if d.len() >= 32 => {
                let f = |o: usize| self.cursor(&d[o..]).f64();
                let u = |o: usize| self.cursor(&d[o..]).u32();
                (f(8)?, u(16)?, f(20)?, u(28)?)
            }
            Some(_) => (f64::NAN, 0, f64::NAN, 0),
            // 20 mm and 10 after a CJK session, 72 pt and 8 otherwise.
            None if cjk == Some(true) => (56.69291338582678, 10, 56.69291338582678, 10),
            None => (72.0, 8, 72.0, 8),
        };
        if !h.is_nan() {
            set("GridPreference", "HorizontalGridlineDivision", num(h));
            set(
                "GridPreference",
                "HorizontalGridSubdivision",
                hs.to_string(),
            );
            set("GridPreference", "VerticalGridlineDivision", num(v));
            set("GridPreference", "VerticalGridSubdivision", vs.to_string());
        }

        // Watermark: u32 and u16 fields, then the font family and style
        // (u32 length, then text segments), the point size and the UID
        // of an interface colour.
        if let Some(d) = get(id::WATERMARK)?.filter(|d| d.len() > 10) {
            let mut c = self.cursor(&d[10..]);
            let n = c.u32()? as usize;
            let family = c.segments(n)?;
            let n = c.u32()? as usize;
            let style = c.segments(n)?;
            let _size = c.u32()?;
            let color = c.u32()?;
            set("WatermarkPreference", "WatermarkFontFamily", family);
            set("WatermarkPreference", "WatermarkFontStyle", style);
            if let Some(rgb) = self.ui_color(color)? {
                colors.push(("WatermarkPreference", "WatermarkFontColor", rgb));
            }
        }

        // Text defaults: a text attribute list, as styles have.
        if let Some(d) = get(chunk::STYLE_ATTRS)?.filter(|d| d.len() >= 2) {
            let mut c = self.cursor(&d);
            let n = c.u16()? as usize;
            text_defaults = self.attrs_or_warn(
                || "text defaults".into(),
                Attrs::parse_text(&mut c, n, List::Style, self.db.recorder()),
            );
        }
        let frame_column_rule = get(chunk::FRAME_COLUMN_RULE)?
            .and_then(|d| Some((self.enc().f64_at(&d, 28)?, self.enc().u32_at(&d, 36)?)));
        let frame_footnotes = get(chunk::FRAME_FOOTNOTES)?.and_then(|d| {
            Some((
                self.enc().u16_at(&d, 2)? == 1,
                self.enc().f64_at(&d, 4)?,
                self.enc().f64_at(&d, 12)?,
            ))
        });
        // u16 code; without the chunk (or with a code the samples do not
        // show) the origin is the spread.
        let ruler_origin = match get(id::RULER_ORIGIN)? {
            Some(d) if d.len() == 2 => match self.cursor(&d).u16()? {
                1 => RulerOrigin::Page,
                2 => RulerOrigin::Spine,
                _ => RulerOrigin::Spread,
            },
            _ => RulerOrigin::Spread,
        };
        Ok(Prefs {
            ruler_origin,
            baseline_frame_grid_color,
            frame_column_rule,
            frame_footnotes,
            values,
            colors,
            text_defaults,
            anchor: Some(match anchor {
                Some(d) => super::AnchorSettings::read(self.enc(), &d),
                None => super::AnchorSettings::absent(),
            }),
            item_defaults,
            item_base,
            item_default_entries,
            item_default_swatches,
            props,
            print_records,
            footnotes: match get(id::FOOTNOTE_OPTIONS)? {
                Some(d) => match FootnoteOptions::read(self.enc(), &d) {
                    Ok(f) => {
                        if f.tail.is_none() {
                            self.warn(format!(
                                "footnote options of {} bytes are not known; rule settings left out",
                                d.len()
                            ));
                        }
                        Some(f)
                    }
                    Err(e) => {
                        self.warn(format!("footnote options left out: {e}"));
                        None
                    }
                },
                None => None,
            },
            default_styles,
            contour: match get(id::ITEM_CONTOUR)? {
                Some(d) => Contour::read(self.enc(), &d),
                None => Some(Contour::DEFAULT),
            },
            default_object_styles,
            grids,
            index_options: match get(id::INDEX_OPTIONS)? {
                Some(d) => match IndexOptions::read(self.enc(), &d) {
                    Ok(o) => Some(o),
                    Err(e) => {
                        self.warn(format!("index options left out: {e}"));
                        None
                    }
                },
                None => None,
            },
            endnotes: match get(id::ENDNOTE_OPTIONS)? {
                Some(d) => match EndnoteOptions::read(self.enc(), &d) {
                    Ok(e) => Some(e),
                    Err(e) => {
                        self.warn(format!("endnote options left out: {e}"));
                        None
                    }
                },
                None => None,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_footnote_options() {
        let enc = Encoding::default();
        let mut d = Vec::new();
        for v in [0x10u32, 0x20, 0xCA07, 4] {
            d.extend(v.to_le_bytes());
        }
        for v in [0u16, 1, 0, 0] {
            d.extend(v.to_le_bytes());
        }
        d.extend(0.72f64.to_le_bytes());
        d.extend(7.2f64.to_le_bytes());
        d.extend([0, 0, 0, 0]);
        // Prefix and suffix empty, separator a tab.
        d.extend(0u32.to_le_bytes());
        d.extend(0u32.to_le_bytes());
        d.extend(1u32.to_le_bytes());
        d.extend([0x01, 0x40, b'\t']);
        let mut tail = vec![0u8; 174];
        tail[0] = 1;
        tail[12] = 1;
        // The rule block at 18: on, solid, weight 0.5.
        tail[18] = 1;
        tail[20..24].copy_from_slice(&0x5A29u32.to_le_bytes());
        tail[32..40].copy_from_slice(&0.5f64.to_le_bytes());
        d.extend(tail);
        let f = FootnoteOptions::read(enc, &d).unwrap();
        assert_eq!((f.start_at, f.space_between, f.spacer), (4, 0.72, 7.2));
        assert_eq!((f.marker, f.separator.as_str()), ((1, 0), "\t"));
        let t = f.tail.unwrap();
        assert!(t.no_splitting && t.straddling == Some(true));
        assert!(t.rules[0].on && !t.rules[1].on);
        assert_eq!((t.rules[0].stroke, t.rules[0].weight), (0x5A29, 0.5));
    }

    /// A flagged in-object string of single-byte text.
    fn fstr(d: &mut Vec<u8>, flag: u8, text: &str) {
        d.extend([flag, 2, 0]);
        d.extend((text.len() as u16).to_le_bytes());
        if !text.is_empty() {
            d.extend((0x4000 | text.len() as u16).to_le_bytes());
            d.extend(text.as_bytes());
        }
    }

    #[test]
    fn reads_print_settings() {
        let enc = Encoding::default();
        let mut d = vec![1, 0];
        d.extend(3u32.to_le_bytes());
        d.extend([1, 2, 3]);
        d.extend(0u16.to_le_bytes());
        d.extend(7u32.to_le_bytes());
        fstr(&mut d, 1, "kPrSt_DefaultName");
        d.extend(2u32.to_le_bytes());
        fstr(&mut d, 1, "kPrepress File");
        fstr(&mut d, 1, "");
        fstr(&mut d, 1, "kDevice Independent");
        fstr(&mut d, 0, "file.ppd");
        d.extend(3u32.to_le_bytes());
        d.extend(2400f64.to_le_bytes());
        for v in [0.0, 0.0, 612.0, 792.0, 0.0, 0.0, 612.0, 792.0] {
            d.extend(f64::to_le_bytes(v));
        }
        d.extend((-1i32).to_le_bytes());
        fstr(&mut d, 1, "");
        let mut a = vec![0u8; 126];
        a[84] = 1;
        a[104] = 2;
        let a_at = d.len();
        d.extend(a);
        fstr(&mut d, 1, "");
        let mut b = vec![0u8; 30];
        b[6] = 1;
        b[14..22].copy_from_slice(&45f64.to_le_bytes());
        d.extend(b);
        fstr(&mut d, 1, "kDefault");
        fstr(&mut d, 0, "71 lpi / 600 dpi");
        let mut s = vec![0u8; 25];
        s[22] = 3;
        d.extend(s);
        fstr(&mut d, 0, "");
        let mut g = vec![0u8; 48];
        g[0] = 2;
        g[16] = 4;
        g[30..32].copy_from_slice(&300u16.to_le_bytes());
        g[42] = 2;
        d.extend(g);
        fstr(&mut d, 1, "kJMarksWithCircle");
        let mut e = vec![0u8; 72];
        e[0] = 4;
        for o in [12, 14, 16, 18, 20] {
            e[o] = 1;
        }
        e[24..32].copy_from_slice(&9f64.to_le_bytes());
        e[58] = 1;
        d.extend(e);
        fstr(&mut d, 1, "");
        d.extend([0; 4]);
        fstr(&mut d, 1, "");
        let mut k = vec![0u8; 98];
        k[20..28].copy_from_slice(&15f64.to_le_bytes());
        d.extend(k);
        fstr(&mut d, 3, "[High Resolution]");
        d.extend([0; 6]);
        d.extend(2u32.to_le_bytes());
        d.extend([9, 9]);
        d.extend(0u32.to_le_bytes());

        let (mut values, mut props, mut records) = (Vec::new(), Vec::new(), Vec::new());
        print_prefs(
            enc,
            &d,
            "PrintPreference",
            &mut values,
            &mut props,
            &mut records,
        )
        .unwrap();
        let get = |n: &str| {
            values
                .iter()
                .find(|v| v.name == n)
                .map(|v| v.value.as_str())
        };
        assert_eq!(get("DeviceType"), Some("7"));
        assert_eq!(get("PrintToDisk"), Some("true"));
        assert_eq!(get("PrintPageOrientation"), Some("Landscape"));
        assert_eq!(get("Copies"), Some("2"));
        assert_eq!(get("ColorOutput"), Some("CompositeRGB"));
        assert_eq!(get("PreserveColorNumbers"), Some("false"));
        assert_eq!(get("CompositeAngle"), Some("45"));
        assert_eq!(get("CompositeScreening"), Some("$ID/kDefault"));
        assert_eq!(get("SeparationScreening"), Some("71 lpi / 600 dpi"));
        assert_eq!(get("ScaleMode"), Some("ScaleToFit"));
        assert_eq!(get("PagePosition"), Some("Centered"));
        assert_eq!(
            (get("Tile"), get("Thumbnails")),
            (Some("false"), Some("true"))
        );
        assert_eq!(get("ThumbnailsPerPage"), Some("K2x2"));
        assert_eq!(get("BitmapResolution"), Some("300"));
        assert_eq!(get("FontDownloading"), Some("Subset"));
        assert_eq!(get("MarkLineWeight"), Some("P07mm"));
        assert_eq!(get("AllPrinterMarks"), Some("true"));
        assert_eq!(get("BleedTop"), Some("9"));
        assert_eq!(get("IncludeSlugToPrint"), Some("true"));
        assert_eq!(get("CyanAngle"), Some("15"));
        assert_eq!(
            get("FlattenerPresetName"),
            Some("$ID/kFlSt_HighDefaultName")
        );
        let prop = |n: &str| props.iter().find(|p| p.1 == n).map(|p| p.2.clone());
        assert_eq!(
            prop("PPD"),
            Some(PrefProp::Text("enumeration", "DeviceIndependent".into()))
        );
        assert_eq!(
            prop("MarkType"),
            Some(PrefProp::Text("enumeration", "JMarkWithCircle".into()))
        );
        assert_eq!(
            prop("Profile"),
            Some(PrefProp::Text("enumeration", "PostScriptCMS".into()))
        );
        assert_eq!(
            prop("PageRange"),
            Some(PrefProp::Text("enumeration", "AllPages".into()))
        );
        assert_eq!(
            records,
            vec![
                ("PrintPreference", "PrintRecord", vec![1, 2, 3]),
                ("PrintPreference", "PaperSizeSelector", vec![9, 9]),
            ]
        );

        // Booklets have no tiling, thumbnail or slug settings.
        let (mut values, mut props, mut records) = (Vec::new(), Vec::new(), Vec::new());
        print_prefs(
            enc,
            &d,
            "PrintBookletPrintPreference",
            &mut values,
            &mut props,
            &mut records,
        )
        .unwrap();
        assert!(!values.iter().any(|v| NOT_IN_BOOKLET.contains(&v.name)));
        assert!(values.iter().any(|v| v.name == "ColorOutput"));
        assert!(!props.iter().any(|p| p.1 == "PageRange"));

        // Page range code 2: IDML has no `PageRange`.
        d[a_at + 122] = 2;
        let (mut values, mut props, mut records) = (Vec::new(), Vec::new(), Vec::new());
        print_prefs(
            enc,
            &d,
            "PrintPreference",
            &mut values,
            &mut props,
            &mut records,
        )
        .unwrap();
        assert!(!props.iter().any(|p| p.1 == "PageRange"));
    }

    /// A u32 length and single-byte text segments.
    fn cstr(d: &mut Vec<u8>, text: &str) {
        d.extend((text.chars().count() as u32).to_le_bytes());
        for ch in text.chars() {
            let u = ch as u32;
            if u < 0x100 {
                d.extend(0x4001u16.to_le_bytes());
                d.push(u as u8);
            } else {
                d.extend(0x8001u16.to_le_bytes());
                d.extend((u as u16).to_le_bytes());
            }
        }
    }

    #[test]
    fn reads_index_header_setting() {
        let enc = Encoding::default();
        let mut d = Vec::new();
        fstr(&mut d, 1, "");
        d.extend(256u16.to_le_bytes());
        for v in [77882u32, 0, 0] {
            d.extend(v.to_le_bytes());
        }
        d.extend(1u16.to_le_bytes());
        d.extend(1u32.to_le_bytes());
        fstr(&mut d, 0, "kIndexGroup_Symbol");
        fstr(&mut d, 1, "kIndexGroup_Symbol");
        cstr(&mut d, "");
        d.extend(0u16.to_le_bytes());
        d.extend(1u32.to_le_bytes());
        cstr(&mut d, "A");
        cstr(&mut d, "");
        fstr(&mut d, 1, "kIndexSection_A");
        d.extend(256u16.to_le_bytes());
        let (values, list) = index_header(enc, &d).unwrap();
        assert_eq!(values[0].value, "$ID/");
        assert_eq!(values[2].value, "77882");
        let g = &list[0];
        assert_eq!(g.attrs[0], ("InternalName", "kIndexGroup_Symbol".into()));
        assert_eq!(g.attrs[1], ("UIString", "$ID/kIndexGroup_Symbol".into()));
        assert_eq!(g.attrs[3], ("Visibility", "false".into()));
        let sec = &g.children[0].children[0];
        assert_eq!(sec.attrs[0], ("SortingHeaderString", "$ID/A".into()));
        assert_eq!(
            sec.attrs[2],
            ("UIHeaderString", "$ID/kIndexSection_A".into())
        );
        // Bytes after the last section are an error.
        d.push(0);
        assert!(index_header(enc, &d).is_err());
    }

    #[test]
    fn reads_index_options() {
        let enc = Encoding::default();
        let mut d = Vec::new();
        cstr(&mut d, "Index");
        fstr(&mut d, 1, "Index Title");
        d.extend([1, 0]);
        fstr(&mut d, 0, "");
        let mut b = [0u8; 14];
        b[10] = 1;
        d.extend(b);
        for sep in ["  ", ", ", "; ", ". ", "\u{2013}", ""] {
            cstr(&mut d, sep);
        }
        for i in 0..8 {
            fstr(&mut d, 0, &format!("S{i}"));
        }
        d.extend([0; 4]);
        let o = IndexOptions::read(enc, &d).unwrap();
        assert_eq!(
            (o.title.as_str(), o.title_style.as_str()),
            ("Index", "Index Title")
        );
        assert!(o.replace_existing && !o.include_book_documents && o.include_section_headings);
        assert_eq!(o.separators[4], "\u{2013}");
        assert_eq!(o.styles[7], "S7");
    }

    #[test]
    fn rounds_shortest_digits_half_even() {
        assert_eq!(num_half_even(f64::from(583.2_f32)), "583.2000122070312");
        assert_eq!(num_half_even(f64::from(841.92_f32)), "841.9199829101562");
        assert_eq!(num_half_even(612.0), "612");
        assert_eq!(num_half_even(0.0), "0");
        assert_eq!(num_half_even(-12.5), "-12.5");
        assert_eq!(num_half_even(0.0625), "0.0625");
        assert_eq!(num_half_even(f64::from(16.6_f32)), "16.600000381469727");
    }

    #[test]
    fn reads_the_xml_import_link() {
        let enc = Encoding::default();
        let mut d = 2u32.to_le_bytes().to_vec();
        for (k, v) in [("XMediaUI_SparseImport", "0"), ("XMediaUI_CreateLink", "1")] {
            cstr(&mut d, k);
            cstr(&mut d, v);
        }
        assert_eq!(xml_import_link(enc, &d), Some(true));
        assert_eq!(xml_import_link(enc, &[0; 4]), Some(false));
        // A pair cut short.
        assert_eq!(xml_import_link(enc, &d[..d.len() - 3]), None);
    }

    #[test]
    fn reads_the_epub_export_layout_that_ends_the_chunk() {
        let enc = Encoding::default();
        let mut d = Vec::new();
        for v in [1u32, 2, 0] {
            d.extend(v.to_le_bytes());
        }
        fstr(&mut d, 0, "");
        d.extend([1, 0]);
        fstr(&mut d, 0, "TOC");
        d.extend([1, 0]);
        fstr(&mut d, 1, "NormalParagraphStyle");
        d.extend([0; 46]);
        fstr(&mut d, 0, "Pub");
        fstr(&mut d, 0, "urn:uuid:x");
        let mut block = [0u8; 50];
        block[2] = 72;
        block[6] = 1;
        d.extend(block);
        fstr(&mut d, 0, "");
        let mut tail = [0u8; 26];
        tail[14] = 1;
        d.extend(tail);
        for s in ["T", "C", "D", "Desc", "R", "S"] {
            fstr(&mut d, 0, s);
        }
        let e = epub_export(enc, &d).unwrap();
        let get = |k: &str| e.iter().find(|(n, _)| *n == k).map(|(_, v)| v.as_str());
        assert_eq!(get("Version"), Some("Epub3"));
        assert_eq!(get("ExportOrder"), Some("ArticlePanelOrder"));
        assert_eq!(get("EpubCover"), Some("None"));
        assert_eq!(get("UseTocStyle"), Some("true"));
        assert_eq!(get("BreakDocument"), Some("true"));
        assert_eq!(get("ParagraphStyleName"), Some("$ID/NormalParagraphStyle"));
        assert_eq!(get("FootnotePlacement"), Some("FootnoteInsidePopup"));
        assert_eq!(get("ImageExportResolution"), Some("Ppi72"));
        assert_eq!(get("CustomImageSizeOption"), Some("SizeRelativeToTextFlow"));
        assert_eq!(get("EmbedFont"), Some("true"));
        assert_eq!(get("EpubSubject"), Some("S"));
        // A chunk that no layout reads to its end.
        assert!(epub_export(enc, &d[..d.len() - 1]).is_none());
    }
}
