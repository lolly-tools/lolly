//! Spreads, pages, page settings, guides, layers, sections and UI colours,
//! and the page layout that pages take from their masters.
//!
//! Evidence: `docs/format/objects.md` (spreads, pages, guides, layers,
//! sections) and `big-endian.md` (older page chunks).

use super::*;

#[derive(Debug, Clone, PartialEq)]
pub struct Layer {
    pub uid: u32,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    /// The hidden layer that holds pages; not written to IDML.
    pub internal: bool,
    /// The other settings, when chunk 0x304 has the layout of the samples.
    pub settings: Option<LayerSettings>,
}

/// Layer settings in chunk 0x304. See `docs/format/objects.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct LayerSettings {
    pub printable: bool,
    pub lock_guides: bool,
    pub ui: bool,
    pub ignore_wrap: bool,
    /// The layer colour (an interface colour object).
    pub color: Option<[f64; 3]>,
}

/// A colour setting that names an interface colour (class 0x1F11), or
/// one of two codes. See `docs/format/objects.md`.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum UiColorRef {
    /// Code 1, or no chunk: the colour of the master.
    #[default]
    UseMaster,
    /// Code 0.
    Nothing,
    Rgb([f64; 3]),
    /// Any other value.
    Unknown,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Page {
    pub uid: u32,
    /// Left, top, right, bottom in page coordinates.
    pub bounds: [f64; 4],
    pub transform: Matrix,
    pub master: Option<u32>,
    pub master_transform: Matrix,
    /// Margins and columns (chunks 0x51A and 0x528). After
    /// `resolve_page_layout`, these are the values in effect: the page's
    /// own, or its master page's.
    pub margins: Option<Margins>,
    pub columns: Option<Columns>,
    /// Layout grid settings (chunk 0xCD02).
    pub grid: Option<GridData>,
    pub settings: PageSettings,
}

/// Settings of a page. See `docs/format/objects.md`, page settings.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct PageSettings {
    /// Master page items overridden on the page, each with its override
    /// (0 for none), from chunk 0x1404.
    pub overrides: Vec<(u32, u32)>,
    /// Chunk 0xCD04: whether the page uses its master's layout grid.
    pub use_master_grid: Option<bool>,
    /// Chunk 0xCD04: the layout grid starting point code (u32 at 0).
    pub grid_start: Option<u32>,
    /// Layout rule code (chunk 0x563); `None` without the chunk.
    pub layout_rule: Option<u32>,
    pub color: UiColorRef,
    /// Page items in tab order (the spread's chunk 0x14580).
    pub tab_order: Vec<u32>,
}

/// Page margins from chunk 0x51A: four f64 (left, top, right, bottom),
/// then u16 1 if the page has its own margins, 0 if it uses its master
/// page's.
#[derive(Debug, Clone, PartialEq)]
pub struct Margins {
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub own: bool,
}

/// Page columns from chunk 0x528: u32 count *n*, *n* f64 column edge
/// positions, f64 gutter, then u16 1 if the page has its own columns.
#[derive(Debug, Clone, PartialEq)]
pub struct Columns {
    pub positions: Vec<f64>,
    pub gutter: f64,
    pub own: bool,
    /// The last u16 of the chunk: 1 for vertical columns, 0 horizontal.
    pub direction: Option<u16>,
}

/// Layout grid settings of a page (chunk 0xCD02): u32 font family, a flag
/// byte, the font style as an in-object string, five f64 and four u32.
/// See `docs/format/objects.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct GridData {
    pub font: u32,
    /// The font style as IDML writes it (`$ID/` for a built-in key).
    pub font_style: String,
    pub numbers: [f64; 5],
    pub codes: [u32; 4],
}

/// A named grid (class 0xCD12).
#[derive(Debug, Clone, PartialEq)]
pub struct NamedGrid {
    pub uid: u32,
    pub builtin: bool,
    pub name: String,
    /// Its own layout grid settings (chunk 0xCD02), if it has them.
    pub grid: Option<GridData>,
}

impl GridData {
    /// Layout grid settings at the cursor, as in chunk 0xCD02.
    pub fn read(c: &mut Cursor) -> Result<GridData, Error> {
        let font = c.u32()?;
        let font_style = c.name()?.idml();
        let numbers = [c.f64()?, c.f64()?, c.f64()?, c.f64()?, c.f64()?];
        let codes = [c.u32()?, c.u32()?, c.u32()?, c.u32()?];
        Ok(GridData {
            font,
            font_style,
            numbers,
            codes,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Spread {
    pub uid: u32,
    /// Master spreads only: name prefix (for example "A") and base name.
    pub master_name: Option<(String, String)>,
    pub transform: Matrix,
    pub binding_location: u32,
    pub pages: Vec<Page>,
    pub items: Vec<PageItem>,
    pub guides: Vec<Guide>,
    /// Chunk 0x1A8: `None` without it.
    pub shuffle: Option<u16>,
    /// The line art and text and the gradient and mesh resolutions in
    /// chunk 0x10833, when it is there.
    pub flattener_resolution: Option<[f64; 2]>,
    /// Master spreads: chunk 0x140D.
    pub show_master_items: Option<u16>,
    /// Master spreads: the story of the primary text frame (chunk
    /// 0x140A); `None` without the chunk.
    pub primary_story: Option<u32>,
    /// Page transition type and direction codes (chunk 0x2050C, u32 at 0
    /// and 8); `None` without the chunk.
    pub transition: Option<(u32, u32)>,
    /// Timing lists (chunk 0x2056D).
    pub timing: Vec<TimingList>,
}

/// A ruler guide (class 0x3301, chunk 0x3308). See `docs/format/objects.md`.
#[derive(Debug, Clone, PartialEq)]
pub struct Guide {
    pub uid: u32,
    pub horizontal: bool,
    /// Position in spread coordinates: y for a horizontal guide, x for a
    /// vertical one.
    pub position: f64,
    /// The page the guide belongs to, or the spread.
    pub owner: u32,
    pub fit_to_page: bool,
    /// Stored view threshold (0.05 in every sample).
    pub view_threshold: f64,
    /// Colour code (6 in every sample).
    pub color: u32,
    /// 0 ruler guide, 1 liquid guide; none in 40-byte records.
    pub guide_type: Option<u32>,
    /// Document layer.
    pub layer: u32,
    /// Chunk 0x2C2D, as for page items.
    pub locked: bool,
    /// f64 at 44 of the 52-byte record (`GuideZone`).
    pub zone: Option<f64>,
    /// Chunk 0x1424, as for page items.
    pub overridden: Option<(u32, Vec<u32>)>,
}

/// Numbering of a section.
#[derive(Debug, Clone, PartialEq)]
pub struct Section {
    pub uid: u32,
    /// The section's first page; `None` for the first section, which
    /// starts at the first page of the document.
    pub page: Option<u32>,
    pub continue_numbering: bool,
    /// `IncludeSectionPrefix`: page names start with the prefix.
    pub include_prefix: bool,
    pub start: u32,
    /// Page number style code (see `numbering`).
    pub style: u32,
    /// `SectionPrefix` and `Marker`; empty if the chunk is missing.
    pub prefix: String,
    pub marker: String,
    /// The alternate layout name after the numbers, with the flag byte
    /// before it (1: a built-in key); `None` if the chunk ends before it.
    pub alternate_layout: Option<(u8, String)>,
}

/// A master page's applied master and its own margins and columns.
pub(super) type MasterPageLayout = (Option<u32>, Option<Margins>, Option<Columns>);

/// Replace the margins and columns that pages take from their master page
/// (flag 0) with the values in effect on that master page. A page's master
/// page is the page at the same position, counted from the left, in its
/// applied master spread, or that spread's only page. See
/// `docs/format/objects.md`.
pub(super) fn resolve_page_layout(spreads: &mut [Spread], masters: &mut [Spread]) {
    fn left_to_right(s: &Spread) -> Vec<usize> {
        let mut order: Vec<usize> = (0..s.pages.len()).collect();
        order.sort_by(|&a, &b| s.pages[a].transform.0[4].total_cmp(&s.pages[b].transform.0[4]));
        order
    }
    fn master_page(
        raw: &HashMap<u32, Vec<MasterPageLayout>>,
        master: Option<u32>,
        index: usize,
    ) -> Option<(usize, &MasterPageLayout)> {
        let pages = raw.get(&master?)?;
        let i = if pages.len() == 1 { 0 } else { index };
        pages.get(i).map(|p| (i, p))
    }
    fn effective<T: Clone>(
        raw: &HashMap<u32, Vec<MasterPageLayout>>,
        get: fn(&MasterPageLayout) -> (Option<&T>, bool),
        page: &MasterPageLayout,
        index: usize,
        depth: usize,
    ) -> Option<T> {
        let (own, is_own) = get(page);
        if is_own || depth > 8 {
            return own.cloned();
        }
        match master_page(raw, page.0, index) {
            Some((i, m)) => effective(raw, get, m, i, depth + 1).or_else(|| own.cloned()),
            None => own.cloned(),
        }
    }
    let raw: HashMap<u32, Vec<MasterPageLayout>> = masters
        .iter()
        .map(|s| {
            let pages = left_to_right(s)
                .into_iter()
                .map(|i| {
                    let p = &s.pages[i];
                    (p.master, p.margins.clone(), p.columns.clone())
                })
                .collect();
            (s.uid, pages)
        })
        .collect();
    fn margins(p: &MasterPageLayout) -> (Option<&Margins>, bool) {
        (p.1.as_ref(), p.1.as_ref().is_some_and(|m| m.own))
    }
    fn columns(p: &MasterPageLayout) -> (Option<&Columns>, bool) {
        (p.2.as_ref(), p.2.as_ref().is_some_and(|c| c.own))
    }
    for s in spreads.iter_mut().chain(masters.iter_mut()) {
        for (index, i) in left_to_right(s).into_iter().enumerate() {
            let p = &mut s.pages[i];
            let layout = (p.master, p.margins.clone(), p.columns.clone());
            p.margins = effective(&raw, margins, &layout, index, 0);
            p.columns = effective(&raw, columns, &layout, index, 0);
        }
    }
}

impl<'a> Reader<'a> {
    /// An interface colour (class 0x1F11): chunk 0x1F01 holds u32 space
    /// (5 = RGB), u16 count and the components as f64 fractions.
    pub(super) fn ui_color(&self, uid: u32) -> Result<Option<[f64; 3]>, Error> {
        if self.class(uid) != Some(class::UI_COLOR) {
            return Ok(None);
        }
        let Some(d) = self.chunk(uid, color::chunk::COLOR_VALUE)? else {
            return Ok(None);
        };
        let mut c = self.cursor(&d);
        if c.u32()? != 5 || c.u16()? != 3 {
            return Ok(None);
        }
        Ok(Some([c.f64()?, c.f64()?, c.f64()?]))
    }

    pub(super) fn section(&self, uid: u32) -> Result<Section, Error> {
        let mut section = Section {
            uid,
            page: None,
            continue_numbering: true,
            include_prefix: false,
            start: 1,
            style: numbering::ARABIC,
            prefix: String::new(),
            marker: String::new(),
            alternate_layout: None,
        };
        // u8, string (prefix), u8, string (marker), u32 first page, u32
        // page number start, u32 numbering style, u32 continue, u16 0, u16
        // include prefix, then u8 and string (alternate layout).
        if let Some(d) = self.chunk(uid, chunk::SECTION_INFO)? {
            let mut c = self.cursor(&d);
            let parsed = (|| -> Result<(String, String, [u32; 4]), Error> {
                c.u8()?;
                let prefix = c.string()?;
                c.u8()?;
                let marker = c.string()?;
                Ok((prefix, marker, [c.u32()?, c.u32()?, c.u32()?, c.u32()?]))
            })();
            if let Ok((prefix, marker, [page, start, style, cont])) = parsed {
                section.page = uid_or_none(page);
                section.start = start;
                section.style = style;
                section.continue_numbering = cont != 0;
                section.prefix = prefix;
                section.marker = marker;
                section.alternate_layout = (|| -> Result<(u8, String), Error> {
                    c.u16()?;
                    section.include_prefix = c.u16()? != 0;
                    let flag = c.flag()?;
                    Ok((flag, c.string()?))
                })()
                .ok();
            }
        }
        if ![
            numbering::ARABIC,
            numbering::LOWER_ROMAN,
            numbering::KANJI,
            numbering::DOUBLE_LEADING_ZEROS,
            numbering::UPPER_ROMAN,
            numbering::LOWER_LETTERS,
            numbering::SINGLE_LEADING_ZEROS,
        ]
        .contains(&section.style)
        {
            self.warn(format!(
                "section {uid}: page number style {:#x} is not known; left out",
                section.style
            ));
        }
        Ok(section)
    }

    /// A document layer; `internal` for the first layer of the document's
    /// list.
    pub(super) fn layer(&self, uid: u32, internal: bool) -> Result<Layer, Error> {
        let data = self.required(uid, chunk::LAYER_PROPS)?;
        let mut c = self.cursor(&data);
        let locked = c.u16()? != 0;
        let visible = c.u16()? != 0;
        c.skip(14)?;
        // A string follows, at offset 19 in all corpus pairs; elsewhere
        // search for the tag (objects.md, layers).
        let name = match data.get(19) {
            Some(2) if !self.enc().big_endian() => self.cursor(&data[19..]).string()?,
            _ => find_string(self.enc(), &data, 18)?,
        };
        let settings = self.layer_settings(&data)?;
        Ok(Layer {
            uid,
            internal,
            name,
            visible,
            locked,
            settings,
        })
    }

    /// The settings in chunk 0x304 when the name is at offset 19, as in
    /// all corpus pairs: u16 printable at 4, u16 lock guides at 6, u32
    /// colour at 10, u16 UI at 14; after the name, u16 ignore wrap.
    pub(super) fn layer_settings(&self, data: &[u8]) -> Result<Option<LayerSettings>, Error> {
        if self.enc().big_endian() || data.len() < 23 || data[19] != 2 {
            return Ok(None);
        }
        let mut c = self.cursor(&data[19..]);
        c.string()?;
        let ignore_wrap = c.u16()? != 0;
        let flag = |at: usize| self.enc().u16_at(data, at).is_some_and(|v| v != 0);
        let color = match self.enc().u32_at(data, 10) {
            Some(u) => self.ui_color(u)?,
            None => None,
        };
        Ok(Some(LayerSettings {
            printable: flag(4),
            lock_guides: flag(6),
            ui: flag(14),
            ignore_wrap,
            color,
        }))
    }

    /// A colour setting: 0 none, 1 the master's, else an interface colour.
    pub(super) fn ui_color_ref(&self, code: u32) -> Result<UiColorRef, Error> {
        Ok(match code {
            0 => UiColorRef::Nothing,
            1 => UiColorRef::UseMaster,
            u => match self.ui_color(u)? {
                Some(rgb) => UiColorRef::Rgb(rgb),
                None => UiColorRef::Unknown,
            },
        })
    }

    pub(super) fn spread(&self, uid: u32) -> Result<Spread, Error> {
        let transform = match self.chunk(uid, chunk::SPREAD_TRANSFORM)? {
            Some(d) => Matrix::read(&mut self.cursor(&d))?,
            None => Matrix::IDENTITY,
        };
        let binding_location = match self.chunk(uid, chunk::SPREAD_BINDING)? {
            Some(d) => self.cursor(&d).u32()?,
            None => 0,
        };
        let master_name = match self.chunk(uid, chunk::MASTER_NAME)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                c.u8()?;
                let prefix = c.string()?;
                c.u8()?;
                let base = c.string()?;
                Some((prefix, base))
            }
            None => None,
        };
        let children = self.required(uid, chunk::SPREAD_CHILDREN)?;
        let mut c = self.cursor(&children);
        c.skip(8)?;
        let spread_layers = c.u32_list()?;
        let mut pages = Vec::new();
        let mut items = Vec::new();
        let mut guides = Vec::new();
        for sl in spread_layers {
            let layer = match self.chunk(sl, chunk::SPREAD_LAYER_LAYER)? {
                Some(d) => self.cursor(&d).u32()?,
                None => 0,
            };
            for child in self.children(sl, chunk::SPREAD_LAYER_CHILDREN)? {
                match self.class(child) {
                    Some(class::PAGE) => pages.push(self.page(child)?),
                    Some(class::GUIDE) => guides.extend(self.guide(child, layer)?),
                    _ => {
                        if let Some(item) = self.page_item(child, Some(layer))? {
                            items.push(item);
                        }
                    }
                }
            }
        }
        if let Some(d) = self.chunk(uid, chunk::SPREAD_TAB_ORDERS)? {
            let mut c = self.cursor(&d);
            let n = c.u32()?;
            for _ in 0..n {
                let page = c.u32()?;
                let order = c.u32_list()?;
                if let Some(p) = pages.iter_mut().find(|p| p.uid == page) {
                    p.settings.tab_order = order;
                }
            }
        }
        let flattener_resolution = match self.chunk(uid, chunk::SPREAD_FLATTENER)? {
            // f64 at 28 line art and text, at 20 gradient and mesh.
            Some(d) => match (self.enc().f64_at(&d, 28), self.enc().f64_at(&d, 20)) {
                (Some(line_art), Some(gradient)) => Some([line_art, gradient]),
                _ => None,
            },
            None => None,
        };
        let short = |id: u32| -> Result<Option<u16>, Error> {
            Ok(self.chunk(uid, id)?.and_then(|d| self.enc().u16_at(&d, 0)))
        };
        let transition = self
            .chunk(uid, chunk::SPREAD_TRANSITION)?
            .and_then(|d| Some((self.enc().u32_at(&d, 0)?, self.enc().u32_at(&d, 8)?)));
        Ok(Spread {
            transition,
            timing: self.timing(uid, chunk::SPREAD_TIMING),
            uid,
            master_name,
            transform,
            binding_location,
            pages,
            items,
            guides,
            shuffle: short(chunk::SPREAD_SHUFFLE)?,
            flattener_resolution,
            show_master_items: short(chunk::MASTER_SHOW_ITEMS)?,
            primary_story: self
                .chunk(uid, chunk::MASTER_PRIMARY_STORY)?
                .and_then(|d| self.enc().u32_at(&d, 0)),
        })
    }

    /// A ruler guide from chunk 0x3308: f64 position, u32 owner (page or
    /// spread), u16 orientation (1 horizontal), f64 view threshold, u32
    /// colour, u16 fit to page, f64, u32, u32 guide type, f64. Records of
    /// 40 bytes, from InDesign 3.0 to 7.0, end before the guide type.
    pub(super) fn guide(&self, uid: u32, layer: u32) -> Result<Option<Guide>, Error> {
        let Some(d) = self.chunk(uid, chunk::GUIDE)? else {
            return Ok(None);
        };
        if d.len() != 40 && d.len() < 52 {
            self.warn(format!(
                "guide {uid}: guide record of {} bytes is not known; left out",
                d.len()
            ));
            return Ok(None);
        }
        let f = |o: usize| self.cursor(&d[o..]).f64();
        let u = |o: usize| self.cursor(&d[o..]).u32();
        let h = |o: usize| self.cursor(&d[o..]).u16();
        Ok(Some(Guide {
            uid,
            position: f(0)?,
            owner: u(8)?,
            horizontal: h(12)? == 1,
            view_threshold: f(14)?,
            color: u(22)?,
            fit_to_page: h(26)? == 1,
            guide_type: if d.len() >= 52 { Some(u(40)?) } else { None },
            layer,
            locked: self
                .chunk(uid, chunk::ITEM_LOCKED)?
                .is_some_and(|d| self.enc().u32_at(&d, 0) == Some(1)),
            zone: if d.len() >= 52 { Some(f(44)?) } else { None },
            overridden: match self.chunk(uid, chunk::ITEM_OVERRIDE)? {
                Some(o) => {
                    let mut c = self.cursor(&o);
                    let master = c.u32()?;
                    Some((master, c.u32_list()?))
                }
                None => None,
            },
        }))
    }

    pub(super) fn page(&self, uid: u32) -> Result<Page, Error> {
        // Files from InDesign 3.0 and 4.0 store the transform and bounds in
        // the chunks page items use (docs/format/big-endian.md).
        let transform = match self.chunk(uid, chunk::PAGE_TRANSFORM)? {
            Some(d) => d,
            None => self.required(uid, chunk::ITEM_TRANSFORM)?,
        };
        let transform = Matrix::read(&mut self.cursor(&transform))?;
        let b = match self.chunk(uid, chunk::PAGE_BOUNDS)? {
            Some(d) => d,
            None => self.required(uid, chunk::OLD_PAGE_BOUNDS)?,
        };
        let mut c = self.cursor(&b);
        let bounds = [c.f64()?, c.f64()?, c.f64()?, c.f64()?];
        let (master, master_transform) = match self.chunk(uid, chunk::PAGE_MASTER)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                let m = c.u32()?;
                c.skip(2)?;
                // The matrix is missing in files from InDesign 3.0 and 4.0.
                let t = match c.remaining() {
                    0 => Matrix::IDENTITY,
                    _ => Matrix::read(&mut c)?,
                };
                (uid_or_none(m), t)
            }
            None => (None, Matrix::IDENTITY),
        };
        let margins = match self.chunk(uid, chunk::PAGE_MARGINS)? {
            Some(d) if d.len() >= 34 => {
                let mut c = self.cursor(&d);
                Some(Margins {
                    left: c.f64()?,
                    top: c.f64()?,
                    right: c.f64()?,
                    bottom: c.f64()?,
                    own: c.u16()? == 1,
                })
            }
            _ => None,
        };
        let columns = match self.chunk(uid, chunk::PAGE_COLUMNS)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                let n = c.u32()? as usize;
                if n > d.len() / 8 {
                    return Err(Error::Corrupt(format!("page {uid}: {n} column positions")));
                }
                let positions = (0..n).map(|_| c.f64()).collect::<Result<Vec<_>, _>>()?;
                let gutter = c.f64()?;
                let own = c.u16()? == 1;
                // A u16, then the column direction.
                let direction = c.u16().and_then(|_| c.u16()).ok();
                Some(Columns {
                    positions,
                    gutter,
                    own,
                    direction,
                })
            }
            None => None,
        };
        let grid = match self.chunk(uid, chunk::PAGE_GRID)? {
            Some(d) => Some(GridData::read(&mut self.cursor(&d))?),
            None => None,
        };
        // u32 count, then (unless it is 0) the two lists.
        let overrides = match self.chunk(uid, chunk::PAGE_OVERRIDES)? {
            Some(d) if self.enc().u32_at(&d, 0).is_some_and(|n| n > 0) => {
                let mut c = self.cursor(&d[4..]);
                let items = c.u32_list()?;
                let with = c.u32_list()?;
                items.into_iter().zip(with).collect()
            }
            _ => Vec::new(),
        };
        let settings = PageSettings {
            overrides,
            use_master_grid: self
                .chunk(uid, chunk::PAGE_GRID_USE)?
                .and_then(|d| self.enc().u16_at(&d, 4))
                .map(|v| v != 0),
            grid_start: self
                .chunk(uid, chunk::PAGE_GRID_USE)?
                .and_then(|d| self.enc().u32_at(&d, 0)),
            layout_rule: self
                .chunk(uid, chunk::PAGE_LAYOUT_RULE)?
                .and_then(|d| self.enc().u32_at(&d, 4)),
            color: match self
                .chunk(uid, chunk::PAGE_COLOR)?
                .and_then(|d| self.enc().u32_at(&d, 0))
            {
                Some(code) => self.ui_color_ref(code)?,
                None => UiColorRef::UseMaster,
            },
            tab_order: Vec::new(),
        };
        Ok(Page {
            uid,
            bounds,
            transform,
            master,
            master_transform,
            margins,
            columns,
            grid,
            settings,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::synthetic::flagged_string;

    #[test]
    fn reads_layout_grids_with_a_built_in_font_style() {
        let enc = Encoding::default();
        let mut d = enc.u32_bytes(7).to_vec();
        d.extend(flagged_string(enc, 1, ""));
        for f in [9.5, -0.25, 8.0, 1.0, 1.0] {
            d.extend(enc.f64_bytes(f));
        }
        for u in [3, 0, 3, 1] {
            d.extend(enc.u32_bytes(u));
        }
        let g = GridData::read(&mut enc.cursor(&d)).unwrap();
        assert_eq!(g.font, 7);
        assert_eq!(g.font_style, "$ID/");
        assert_eq!(g.numbers, [9.5, -0.25, 8.0, 1.0, 1.0]);
        assert_eq!(g.codes, [3, 0, 3, 1]);
    }
}
