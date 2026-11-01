//! Tables. See `docs/format/tables.md`.

use std::collections::BTreeMap;

use super::{Attrs, PageItem, Reader, TextRun, Value};
use crate::Error;
use crate::audit::{List, Recorder};
use crate::object::{Cursor, Encoding};

pub mod class {
    pub const CELL_STYLE: u32 = 0x2021A;
    pub const TABLE_STYLE: u32 = 0xB63F;
    /// Owned by the U+0016 character where a table sits in its story.
    pub const TABLE_ANCHOR: u32 = 0xB651;
    pub const TABLE: u32 = 0xB608;
    /// Owns the cell strand (row groups with cell records).
    pub const CELL_STRAND_OWNER: u32 = 0xB606;
    /// The content of a graphic cell.
    pub const GRAPHIC_CELL: u32 = 0x1046B;
}

pub mod chunk {
    pub const ANCHOR_TABLE: u32 = 0xB67D;
    pub const TABLE_SIZE: u32 = 0xB608;
    pub const TABLE_ROWS: u32 = 0xB616;
    pub const TABLE_COLUMNS: u32 = 0xB617;
    pub const TABLE_PARTS: u32 = 0xB6FB;
    /// u32 applied table style, u32 (not identified).
    pub const TABLE_STYLE: u32 = 0xB6FC;
    /// Local table attributes: u16 count, attributes.
    pub const TABLE_ATTRS: u32 = 0xB668;
    /// Attributes of a cell style: u16 count, attributes.
    pub const CELL_STYLE_ATTRS: u32 = 0x20253;
    /// Attributes of a table style: u16 count, attributes.
    pub const TABLE_STYLE_ATTRS: u32 = 0xB667;
    /// Children of the root cell style group: u32, u32, UID list.
    pub const CELL_STYLE_ROOT_CHILDREN: u32 = 0x2024E;
    /// Children of the root table style group: u32, u32, UID list.
    pub const TABLE_STYLE_ROOT_CHILDREN: u32 = 0x104E5;
    /// u16 table direction: 0 left to right, 1 right to left.
    pub const TABLE_DIRECTION: u32 = 0x50F65;
    /// Page items of a graphic cell object: u32, u32, UID list.
    pub const GRAPHIC_CELL_ITEMS: u32 = 0x10466;
}

/// Attribute IDs in table data.
pub mod attr {
    pub const COLUMN_WIDTH: u32 = 0xB60D;
    pub const ROW_HEIGHT: u32 = 0xB60C;
    pub const ROW_MIN_HEIGHT: u32 = 0xB66E;
    /// A grid position that starts a text cell; its second value is the
    /// cell's layout record.
    pub const CELL: u32 = 0xB666;
    /// A grid position that starts a graphic cell; the u32 at byte 70 of
    /// its first value is the graphic cell object.
    pub const GRAPHIC_CELL: u32 = 0x10469;
    /// A grid position covered by a merged cell.
    pub const COVERED: u32 = 0xB614;
}

#[derive(Debug, Clone, PartialEq)]
pub struct Row {
    pub height: Option<f64>,
    pub min_height: Option<f64>,
    /// The row group's attributes (`AutoGrow`, `StartRow`, ...).
    pub attrs: Attrs,
}

/// What a cell holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CellKind {
    Text,
    Graphic,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Cell {
    /// Cell ID, local to the table (IDML `Self` suffix `i<hex>`).
    pub id: u32,
    pub row: usize,
    pub column: usize,
    pub row_span: usize,
    pub column_span: usize,
    pub kind: CellKind,
    /// Text area width of the cell's layout record; `None` for a cell
    /// that was never laid out.
    pub width: Option<f64>,
    pub runs: Vec<TextRun>,
    /// The page items of a graphic cell.
    pub items: Vec<PageItem>,
    /// The cell's attribute set (index into `Table::formats`), if it has
    /// one.
    pub format: Option<usize>,
}

/// An attribute set shared by a run of cells in a row group.
#[derive(Debug, Clone, PartialEq)]
pub struct CellFormat {
    /// Local cell attributes (insets, fill, edge strokes, ...).
    pub attrs: Attrs,
    /// Applied cell style priority (IDML `AppliedCellStylePriority`).
    pub style_priority: u32,
    /// Applied cell style UID, 0 for none.
    pub style: u32,
}

/// A cell or table style (class 0x2021A or 0xB63F).
#[derive(Debug, Clone, PartialEq)]
pub struct TableStyle {
    pub uid: u32,
    pub name: String,
    /// The name is a built-in key, written with `$ID/` in IDML.
    pub builtin: bool,
    pub based_on: Option<u32>,
    pub attrs: Attrs,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Table {
    pub uid: u32,
    /// Applied table style.
    pub style: Option<u32>,
    /// Local table attributes.
    pub attrs: Attrs,
    /// Right to left (chunk 0x50F65 is 1).
    pub right_to_left: bool,
    pub header_rows: u32,
    pub footer_rows: u32,
    pub rows: Vec<Row>,
    pub columns: Vec<f64>,
    pub cells: Vec<Cell>,
    /// The attribute sets of the cell strand.
    pub formats: Vec<CellFormat>,
    /// Per grid row, the attribute set (index into `formats`) of each
    /// grid position.
    pub grid: Vec<Vec<Option<usize>>>,
}

/// Attribute IDs of the effective text cell values (tables.md).
pub mod text_cell {
    pub const LEFT_INSET: u32 = 0xB62B;
    pub const TOP_INSET: u32 = 0xB62C;
    pub const RIGHT_INSET: u32 = 0xB62D;
    pub const BOTTOM_INSET: u32 = 0xB62E;
    /// `ClipContentToCell` / `ClipContentToTextCell`.
    pub const CLIP: u32 = 0xB6DE;
}

/// Table style attributes that name the cell style of a table region,
/// and the flags that make a region use the body's cell style.
mod region {
    pub const HEADER: (u32, u32) = (0x10450, 0x10457);
    pub const FOOTER: (u32, u32) = (0x10451, 0x10458);
    pub const BODY: u32 = 0x10452;
    pub const LEFT_COLUMN: (u32, u32) = (0x10453, 0x10459);
    pub const RIGHT_COLUMN: (u32, u32) = (0x10454, 0x1045A);
}

/// The cell and table styles of a document, for values that tables and
/// cells inherit (tables.md, "Values in effect").
pub struct TableStyles<'a> {
    cells: &'a BTreeMap<u32, TableStyle>,
    tables: &'a BTreeMap<u32, TableStyle>,
    /// The root table style `[No table style]`.
    root: Option<&'a TableStyle>,
}

impl<'a> TableStyles<'a> {
    pub fn new(
        cells: &'a BTreeMap<u32, TableStyle>,
        tables: &'a BTreeMap<u32, TableStyle>,
    ) -> Self {
        let root = tables
            .values()
            .find(|s| s.builtin && s.based_on.is_none() && s.name == "[No table style]");
        TableStyles {
            cells,
            tables,
            root,
        }
    }

    /// A style and the styles it is based on, without cycles.
    fn chain(styles: &'a BTreeMap<u32, TableStyle>, uid: Option<u32>) -> Vec<&'a TableStyle> {
        let mut out: Vec<&TableStyle> = Vec::new();
        let mut next = uid;
        while let Some(u) = next {
            match styles.get(&u) {
                Some(s) if !out.iter().any(|x| x.uid == u) => {
                    out.push(s);
                    next = s.based_on;
                }
                _ => break,
            }
        }
        out
    }

    /// The table style chain of a table: its style, the styles that is
    /// based on, and the root table style.
    fn table_chain(&self, style: Option<u32>) -> Vec<&'a TableStyle> {
        let mut out = Self::chain(self.tables, style);
        if let Some(r) = self.root
            && !out.iter().any(|s| s.uid == r.uid)
        {
            out.push(r);
        }
        out
    }

    /// A value of a cell style or of the styles it is based on.
    pub fn cell_style_value(&self, uid: u32, id: u32) -> Option<&'a Value> {
        Self::chain(self.cells, Some(uid))
            .into_iter()
            .find_map(|s| s.attrs.get(id))
    }
}

/// Groups of rows or columns sharing attributes: u32 group count; per
/// group u32 count, u16, u16 attribute count, attributes, 8 bytes.
fn groups(
    enc: Encoding,
    data: &[u8],
    recorder: Option<&Recorder>,
) -> Result<Vec<(usize, Attrs)>, Error> {
    let mut c = enc.cursor(data);
    let n = c.u32()?;
    let mut out = Vec::new();
    for _ in 0..n {
        let count = c.u32()? as usize;
        c.u16()?;
        let na = c.u16()? as usize;
        let attrs = Attrs::parse_text(&mut c, na, List::Table, recorder)?;
        c.skip(8)?;
        out.push((count, attrs));
    }
    Ok(out)
}

fn f64_attr(a: &Attrs, id: u32) -> Option<f64> {
    a.get(id).and_then(Value::as_f64)
}

/// One grid position from the cell strand.
struct Position {
    id: u32,
    /// The kind of cell the position starts; `None` for a position
    /// covered by a merged cell.
    starts: Option<CellKind>,
    /// Text area width of the layout record of a text cell.
    width: Option<f64>,
    /// The graphic cell object of a graphic cell.
    content: Option<u32>,
    /// Attribute set, an index into the table's formats.
    format: Option<usize>,
}

impl Reader<'_> {
    /// An attribute list stored as a u16 count and records.
    fn counted_attrs(&self, uid: u32, id: u32) -> Result<Attrs, Error> {
        Ok(match self.chunk(uid, id)? {
            Some(d) if d.len() >= 2 => {
                let mut c = self.cursor(&d);
                let n = c.u16()? as usize;
                Attrs::parse_text(&mut c, n, List::Table, self.db.recorder())?
            }
            _ => Attrs::default(),
        })
    }

    /// A cell or table style: name and base from chunk 0x230 (as for text
    /// styles), attributes from `attrs_chunk`.
    pub(super) fn table_style(
        &self,
        uid: u32,
        attrs_chunk: u32,
    ) -> Result<Option<TableStyle>, Error> {
        let Some(data) = self.chunk(uid, super::chunk::STYLE_INFO)? else {
            return Ok(None);
        };
        let based_on = self.cursor(&data[4.min(data.len())..]).u32()?;
        // A flag byte (1 = built-in name), then a non-empty in-object string.
        let Some((_, builtin, name)) =
            super::find_flagged_string(self.enc(), &data, 12, |n| !n.is_empty())
        else {
            return Ok(None);
        };
        Ok(Some(TableStyle {
            uid,
            name,
            builtin,
            based_on: super::uid_or_none(based_on),
            attrs: self.counted_attrs(uid, attrs_chunk)?,
        }))
    }

    /// The table owned by a table anchor object, without cell text.
    pub(super) fn table_of_anchor(&self, anchor: u32) -> Result<Option<Table>, Error> {
        let Some(d) = self.chunk(anchor, chunk::ANCHOR_TABLE)? else {
            return Ok(None);
        };
        let uid = self.cursor(&d).u32()?;
        if self.class(uid) != Some(class::TABLE) {
            return Ok(None);
        }
        self.table(uid).map(Some)
    }

    fn table(&self, uid: u32) -> Result<Table, Error> {
        let size = self.required(uid, chunk::TABLE_SIZE)?;
        let mut c = self.cursor(&size);
        let nrows = c.u32()? as usize;
        let ncols = c.u32()? as usize;
        let header_rows = c.u32()?;
        let footer_rows = c.u32()?;

        let column_groups = match self.chunk(uid, chunk::TABLE_COLUMNS)? {
            Some(d) => groups(self.enc(), &d, self.db.recorder())?,
            None => Vec::new(),
        };
        let row_groups = match self.chunk(uid, chunk::TABLE_ROWS)? {
            Some(d) => groups(self.enc(), &d, self.db.recorder())?,
            None => Vec::new(),
        };
        // The cell data has a row of grid positions for every table row,
        // and a column count no larger than its widest row (every corpus
        // table). Larger counts are damage; checking them before
        // allocating keeps a damaged count from sizing the vectors below.
        let (grid, formats) = self.cell_grid(uid)?;
        let widest = grid.iter().map(Vec::len).max().unwrap_or(0);
        if nrows > grid.len() || ncols > widest {
            return Err(Error::Corrupt(format!(
                "table {uid} has {nrows} rows and {ncols} columns, but its cells \
                 fill {} rows and {widest} columns",
                grid.len()
            )));
        }

        let mut columns = Vec::with_capacity(ncols);
        for (count, a) in column_groups {
            let w = f64_attr(&a, attr::COLUMN_WIDTH).unwrap_or(0.0);
            let count = count.min(ncols - columns.len());
            columns.extend(std::iter::repeat_n(w, count));
        }
        columns.resize(ncols, columns.last().copied().unwrap_or(0.0));
        let mut rows = Vec::with_capacity(nrows);
        for (count, a) in row_groups {
            let row = Row {
                height: f64_attr(&a, attr::ROW_HEIGHT),
                min_height: f64_attr(&a, attr::ROW_MIN_HEIGHT),
                attrs: a,
            };
            let count = count.min(nrows - rows.len());
            rows.extend(std::iter::repeat_n(row, count));
        }
        rows.resize(
            nrows,
            Row {
                height: None,
                min_height: None,
                attrs: Attrs::default(),
            },
        );

        let mut cells = cells_from_grid(&grid);
        // Cells are in the order of the positions that start them.
        let contents = grid.iter().flatten().filter(|p| p.starts.is_some());
        for (cell, pos) in cells.iter_mut().zip(contents) {
            if let Some(content) = pos.content {
                cell.items = self.graphic_cell_items(content)?;
            }
        }
        let grid = grid
            .into_iter()
            .map(|row| row.into_iter().map(|p| p.format).collect())
            .collect();
        let style = match self.chunk(uid, chunk::TABLE_STYLE)? {
            Some(d) => super::uid_or_none(self.cursor(&d).u32()?),
            None => None,
        };
        let attrs = self.counted_attrs(uid, chunk::TABLE_ATTRS)?;
        let right_to_left = match self.chunk(uid, chunk::TABLE_DIRECTION)? {
            Some(d) => self.cursor(&d).u16()? == 1,
            None => false,
        };
        Ok(Table {
            uid,
            style,
            attrs,
            right_to_left,
            header_rows,
            footer_rows,
            rows,
            columns,
            cells,
            formats,
            grid,
        })
    }

    /// The page items of a graphic cell object (class 0x1046B), listed in
    /// its chunk 0x10466 (tables.md).
    fn graphic_cell_items(&self, content: u32) -> Result<Vec<PageItem>, Error> {
        if self.class(content) != Some(class::GRAPHIC_CELL) {
            return Ok(Vec::new());
        }
        let mut items = Vec::new();
        for child in self.children(content, chunk::GRAPHIC_CELL_ITEMS)? {
            items.extend(self.page_item(child, None)?);
        }
        Ok(items)
    }

    /// Grid positions by row, from the cell strand's row groups, and the
    /// attribute sets they refer to.
    #[allow(clippy::type_complexity)]
    fn cell_grid(&self, table: u32) -> Result<(Vec<Vec<Position>>, Vec<CellFormat>), Error> {
        let parts = self.required(table, chunk::TABLE_PARTS)?;
        let mut c = self.cursor(&parts);
        let n = c.u32()?;
        let mut owner = None;
        for _ in 0..n {
            let u = c.u32()?;
            if c.u32()? == class::CELL_STRAND_OWNER {
                owner = Some(u);
            }
        }
        let mut grid = Vec::new();
        let mut all_formats = Vec::new();
        let Some(owner) = owner else {
            return Ok((grid, all_formats));
        };
        let Some(list) = self.chunk(owner, super::chunk::STRAND_DATA)? else {
            return Ok((grid, all_formats));
        };
        let mut lc = self.cursor(&list);
        let count = lc.u16()?;
        for _ in 0..count {
            lc.u32()?;
            let data = self.required(lc.u32()?, super::chunk::STRAND_RUNS)?;
            let mut r = self.cursor(&data);
            r.skip(8)?;
            let groups = r.u16()?;
            for _ in 0..groups {
                let size = r.u32()? as usize;
                let mut g = self.cursor(r.bytes(size)?);
                // Attribute sets, each shared by a run of columns: u32
                // number of columns, u16 1 if attributes follow (u16 count,
                // attributes), u32 cell style priority, u32 cell style.
                let sets = g.u32()?;
                let mut formats = Vec::new();
                for _ in 0..sets {
                    let columns = g.u32()? as usize;
                    let attrs = if g.u16()? != 0 {
                        let na = g.u16()? as usize;
                        Attrs::parse_text(&mut g, na, List::Cell, self.db.recorder())?
                    } else {
                        Attrs::default()
                    };
                    let style_priority = g.u32()?;
                    let style = g.u32()?;
                    all_formats.push(CellFormat {
                        attrs,
                        style_priority,
                        style,
                    });
                    // A row of this group has at most one position per
                    // four bytes, so later formats would never be used.
                    let room = (size / 4).saturating_sub(formats.len());
                    formats.extend(std::iter::repeat_n(
                        all_formats.len() - 1,
                        columns.min(room),
                    ));
                }
                let nr = g.u32()?;
                let mut ids = Vec::new();
                for _ in 0..nr {
                    let k = g.u32()?;
                    ids.push((0..k).map(|_| g.u32()).collect::<Result<Vec<_>, _>>()?);
                }
                let nrec = g.u32()?;
                for (i, row_ids) in ids.into_iter().enumerate() {
                    if i as u32 >= nrec {
                        break;
                    }
                    let n = g.u16()? as usize;
                    let raw = raw_attrs(&mut g, n)?;
                    // A row record with fewer attribute records than
                    // positions leaves the last positions covered.
                    let row = row_ids
                        .into_iter()
                        .enumerate()
                        .map(|(k, id)| {
                            let (aid, values) =
                                raw.get(k).map_or((0, &[][..]), |(a, v)| (*a, &v[..]));
                            let value = |i: usize| values.get(i).map_or(&[][..], Vec::as_slice);
                            Position {
                                id,
                                starts: match aid {
                                    attr::CELL => Some(CellKind::Text),
                                    attr::GRAPHIC_CELL => Some(CellKind::Graphic),
                                    _ => None,
                                },
                                width: (aid == attr::CELL)
                                    .then(|| layout_width(self.enc(), value(1)))
                                    .flatten(),
                                content: (aid == attr::GRAPHIC_CELL)
                                    .then(|| self.enc().u32_at(value(0), 70))
                                    .flatten(),
                                format: formats.get(k).copied(),
                            }
                        })
                        .collect();
                    grid.push(row);
                }
            }
        }
        Ok((grid, all_formats))
    }
}

/// An attribute ID and the raw payload of each of its values.
type RawAttr = (u32, Vec<Vec<u8>>);

/// Attribute records keeping the raw payload of each value.
fn raw_attrs(c: &mut Cursor, n: usize) -> Result<Vec<RawAttr>, Error> {
    let enc = c.encoding();
    let mut out = Vec::with_capacity(n);
    for _ in 0..n {
        let id = c.u32()?;
        let size = c.u16()? as usize;
        let payload = c.bytes(size)?;
        let mut p = enc.cursor(payload);
        let mut values = Vec::new();
        if size >= 2 {
            let count = p.u16()?;
            for _ in 0..count {
                p.u32()?;
                let len = p.u16()? as usize;
                values.push(p.bytes(len)?.to_vec());
            }
        }
        out.push((id, values));
    }
    Ok(out)
}

/// Text area width of a cell's layout record: u32 flags, u32 parcel
/// count (and one more u32 if the low four flag bits are 0xF), then per
/// parcel u32 flags (and one more u32 if bit 31 is set), 16 bytes, f64
/// width, f64 height. `None` for a cell never laid out (no parcels) or a
/// record too short.
fn layout_width(enc: Encoding, v: &[u8]) -> Option<f64> {
    let mut c = enc.cursor(v);
    let flags = c.u32().ok()?;
    if c.u32().ok()? == 0 {
        return None;
    }
    if flags & 0xF == 0xF {
        c.u32().ok()?;
    }
    if c.u32().ok()? & 0x8000_0000 != 0 {
        c.u32().ok()?;
    }
    c.skip(16).ok()?;
    c.f64().ok()
}

/// The cells of the grid, each 1 × 1 until `Table::resolve_spans`.
fn cells_from_grid(grid: &[Vec<Position>]) -> Vec<Cell> {
    let mut cells = Vec::new();
    for (r, row) in grid.iter().enumerate() {
        for (c, pos) in row.iter().enumerate() {
            let Some(kind) = pos.starts else { continue };
            cells.push(Cell {
                id: pos.id,
                row: r,
                column: c,
                row_span: 1,
                column_span: 1,
                kind,
                width: pos.width,
                runs: Vec::new(),
                items: Vec::new(),
                format: pos.format,
            });
        }
    }
    cells
}

impl Table {
    /// The attribute set of a cell.
    pub fn format(&self, cell: &Cell) -> Option<&CellFormat> {
        cell.format.and_then(|i| self.formats.get(i))
    }

    /// The attribute sets of the grid positions along each edge of a
    /// cell, in the order left, right, top, bottom: the positions of its
    /// first column, last column, first row and last row. `None` for a
    /// position without a set.
    pub fn edge_formats(&self, cell: &Cell) -> [Vec<Option<&CellFormat>>; 4] {
        let at = |r: usize, c: usize| {
            self.grid
                .get(r)
                .and_then(|row| row.get(c).copied().flatten())
                .and_then(|i| self.formats.get(i))
        };
        let rows = cell.row..cell.row + cell.row_span;
        let columns = cell.column..cell.column + cell.column_span;
        let last_row = cell.row + cell.row_span - 1;
        let last_column = cell.column + cell.column_span - 1;
        [
            rows.clone().map(|r| at(r, cell.column)).collect(),
            rows.map(|r| at(r, last_column)).collect(),
            columns.clone().map(|c| at(cell.row, c)).collect(),
            columns.map(|c| at(last_row, c)).collect(),
        ]
    }

    /// The value in effect for the table: its own attributes, then its
    /// table style, the styles that is based on, and the root table
    /// style.
    pub fn value<'a>(&'a self, id: u32, styles: &TableStyles<'a>) -> Option<&'a Value> {
        self.attrs.get(id).or_else(|| {
            styles
                .table_chain(self.style)
                .into_iter()
                .find_map(|s| s.attrs.get(id))
        })
    }

    /// The region cell style of a cell starting at `row` and `column` and
    /// spanning `span` columns; `None` if the region has none (UID 0).
    fn region_style(
        &self,
        row: usize,
        column: usize,
        span: usize,
        styles: &TableStyles,
    ) -> Option<u32> {
        let chain = styles.table_chain(self.style);
        let get = |id: u32| chain.iter().find_map(|s| s.attrs.get(id)?.as_u32());
        let nrows = self.rows.len();
        let region = if row < self.header_rows as usize {
            Some(region::HEADER)
        } else if self.footer_rows > 0 && row + self.footer_rows as usize >= nrows {
            Some(region::FOOTER)
        } else if column == 0 {
            Some(region::LEFT_COLUMN)
        } else if column + span >= self.columns.len() {
            Some(region::RIGHT_COLUMN)
        } else {
            None
        };
        let id = match region {
            Some((style, same_as_body)) if get(same_as_body) != Some(1) => style,
            _ => region::BODY,
        };
        get(id).filter(|&u| u != 0)
    }

    /// The value in effect for a cell: its attribute set, its cell style
    /// (and the styles that is based on), the cell style of its table
    /// region, then the table's value.
    pub fn cell_value<'a>(
        &'a self,
        cell: &Cell,
        id: u32,
        styles: &TableStyles<'a>,
    ) -> Option<&'a Value> {
        self.cell_value_at(cell, cell.column_span, id, styles)
    }

    fn cell_value_at<'a>(
        &'a self,
        cell: &Cell,
        span: usize,
        id: u32,
        styles: &TableStyles<'a>,
    ) -> Option<&'a Value> {
        let format = self.format(cell);
        format
            .and_then(|f| f.attrs.get(id))
            .or_else(|| {
                format
                    .filter(|f| f.style != 0)
                    .and_then(|f| styles.cell_style_value(f.style, id))
            })
            .or_else(|| {
                self.region_style(cell.row, cell.column, span, styles)
                    .and_then(|u| styles.cell_style_value(u, id))
            })
            .or_else(|| self.value(id, styles))
    }

    /// Set the cells' column and row spans (tables.md, "Spans"). A
    /// cell's column span is the number of columns, up to the next cell
    /// in its row, whose widths best match its laid-out width plus its
    /// left and right insets; its row span takes the rows below whose
    /// positions under it are covered and not yet taken.
    pub fn resolve_spans(&mut self, styles: &TableStyles) {
        let nrows = self.rows.len().min(self.grid.len());
        let mut starts: Vec<Vec<bool>> = self.grid.iter().map(|r| vec![false; r.len()]).collect();
        for c in &self.cells {
            starts[c.row][c.column] = true;
        }
        let mut taken: Vec<Vec<bool>> = starts.clone();
        let mut spans = Vec::with_capacity(self.cells.len());
        for cell in &self.cells {
            let row = &starts[cell.row];
            let run = 1 + row[cell.column + 1..].iter().take_while(|s| !**s).count();
            let span = match cell.width.filter(|&w| w > 0.0) {
                Some(w) => {
                    let inset = |n: usize, id: u32| {
                        self.cell_value_at(cell, n, id, styles)
                            .and_then(Value::as_f64)
                            .unwrap_or(0.0)
                    };
                    let mut best = (1, f64::INFINITY);
                    let mut sum = 0.0;
                    for n in 1..=run {
                        sum += self
                            .columns
                            .get(cell.column + n - 1)
                            .copied()
                            .unwrap_or(0.0);
                        let target =
                            w + inset(n, text_cell::LEFT_INSET) + inset(n, text_cell::RIGHT_INSET);
                        let d = (sum - target).abs();
                        if d < best.1 {
                            best = (n, d);
                        }
                    }
                    best.0
                }
                None => run,
            };
            for t in &mut taken[cell.row][cell.column..cell.column + span] {
                *t = true;
            }
            spans.push(span);
        }
        for (cell, span) in self.cells.iter_mut().zip(spans) {
            cell.column_span = span;
            let cols = cell.column..cell.column + span;
            let mut rows = 1;
            for row in taken.iter_mut().take(nrows).skip(cell.row + 1) {
                match row.get_mut(cols.clone()) {
                    Some(p) if p.iter().all(|t| !t) => p.fill(true),
                    _ => break,
                }
                rows += 1;
            }
            cell.row_span = rows;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::synthetic;

    #[test]
    fn counts_larger_than_the_cell_data_are_an_error() {
        let mut size = Vec::new();
        for v in [0x7FFF_FFFFu32, 0x7FFF_FFFF, 0, 0] {
            size.extend_from_slice(&v.to_le_bytes());
        }
        let chunks = synthetic::chunks(&[
            (chunk::TABLE_SIZE, size),
            (chunk::TABLE_PARTS, 0u32.to_le_bytes().to_vec()),
            (chunk::TABLE_ROWS, {
                // One group of 2^31 rows with no attributes.
                let mut d = 1u32.to_le_bytes().to_vec();
                d.extend_from_slice(&0x7FFF_FFFFu32.to_le_bytes());
                d.extend_from_slice(&[0; 12]);
                d
            }),
        ]);
        let objects = [(5, class::TABLE, chunks)];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        assert!(reader.table(5).is_err());
    }

    fn le(v: u32) -> Vec<u8> {
        v.to_le_bytes().to_vec()
    }

    /// One attribute record: ID, u16 size, u16 value count, then values
    /// (u32 type 0, u16 length, data).
    fn record(id: u32, values: &[&[u8]]) -> Vec<u8> {
        let mut payload = (values.len() as u16).to_le_bytes().to_vec();
        for v in values {
            payload.extend(le(0));
            payload.extend((v.len() as u16).to_le_bytes());
            payload.extend(*v);
        }
        let mut d = le(id);
        d.extend((payload.len() as u16).to_le_bytes());
        d.extend(payload);
        d
    }

    /// A row or column group list with one group of `count` sharing one
    /// f64 attribute.
    fn one_group(count: u32, id: u32, value: f64) -> Vec<u8> {
        let mut d = le(1);
        d.extend(le(count));
        d.extend(0u16.to_le_bytes());
        d.extend(1u16.to_le_bytes());
        d.extend(record(id, &[&value.to_le_bytes()]));
        d.extend([0; 8]);
        d
    }

    /// The second value of a cell record, a layout record with one
    /// parcel whose flags have bit 31 set: text area width at 32 and
    /// height at 40.
    fn geometry(w: f64, h: f64) -> Vec<u8> {
        let mut g = le(0);
        g.extend(le(1));
        g.extend(le(0x8000_0000));
        g.extend([0; 20]);
        g.extend(w.to_le_bytes());
        g.extend(h.to_le_bytes());
        g
    }

    #[test]
    fn reads_the_layout_width() {
        let enc = Encoding::default();
        assert_eq!(layout_width(enc, &geometry(12.5, 3.0)), Some(12.5));
        // An extra u32 after the count (flags 0xF), none after the parcel
        // flags: the width is at 32 again.
        let mut g = le(0xF);
        g.extend(le(1));
        g.extend(le(0));
        g.extend(le(0));
        g.extend([0; 16]);
        g.extend(7.0f64.to_le_bytes());
        assert_eq!(layout_width(enc, &g), Some(7.0));
        // Never laid out.
        assert_eq!(layout_width(enc, &[0; 8]), None);
    }

    fn no_styles() -> BTreeMap<u32, TableStyle> {
        BTreeMap::new()
    }

    /// A 2 × 3 table: row 0 has a cell spanning columns 0–1 (its text
    /// area is wider than one column) and a cell in column 2; row 1 has
    /// three cells, the first with a cell format.
    fn table_objects() -> Vec<(u32, u32, Vec<u8>)> {
        let mut size = Vec::new();
        for v in [2u32, 3, 1, 0] {
            size.extend(le(v));
        }
        let mut parts = le(1);
        parts.extend(le(7));
        parts.extend(le(class::CELL_STRAND_OWNER));
        let mut strand = 1u16.to_le_bytes().to_vec();
        strand.extend(le(0));
        strand.extend(le(8));
        // Row group: one cell format for one column, then two rows of
        // positions with their records.
        let mut g = le(1);
        g.extend(le(1));
        g.extend(1u16.to_le_bytes());
        g.extend(1u16.to_le_bytes());
        g.extend(record(0xB63E, &[&50.0f64.to_le_bytes()]));
        g.extend(le(2));
        g.extend(le(0x11));
        g.extend(le(2));
        for row in [[1u32, 2, 3], [4, 5, 6]] {
            g.extend(le(3));
            for id in row {
                g.extend(le(id));
            }
        }
        g.extend(le(2));
        let cell = |w, h| record(attr::CELL, &[&[], &geometry(w, h)]);
        let covered = record(attr::COVERED, &[&[], &[]]);
        g.extend(3u16.to_le_bytes());
        g.extend(cell(190.0, 15.0));
        g.extend(covered);
        g.extend(cell(90.0, 15.0));
        g.extend(3u16.to_le_bytes());
        for _ in 0..3 {
            g.extend(cell(90.0, 15.0));
        }
        let mut runs = vec![0; 8];
        runs.extend(1u16.to_le_bytes());
        runs.extend(le(g.len() as u32));
        runs.extend(g);
        let strand_data = super::super::chunk::STRAND_DATA;
        let strand_runs = super::super::chunk::STRAND_RUNS;
        vec![
            (
                5,
                class::TABLE,
                synthetic::chunks(&[
                    (chunk::TABLE_SIZE, size),
                    (chunk::TABLE_PARTS, parts),
                    (
                        chunk::TABLE_COLUMNS,
                        one_group(3, attr::COLUMN_WIDTH, 100.0),
                    ),
                    (chunk::TABLE_ROWS, one_group(2, attr::ROW_HEIGHT, 20.0)),
                    (chunk::TABLE_STYLE, le(0x30)),
                ]),
            ),
            (
                7,
                class::CELL_STRAND_OWNER,
                synthetic::chunks(&[(strand_data, strand)]),
            ),
            (8, 0x1, synthetic::chunks(&[(strand_runs, runs)])),
        ]
    }

    #[test]
    fn reads_rows_columns_and_cell_spans() {
        let objects = table_objects();
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        let reader = Reader::new(&db);
        let mut t = reader.table(5).unwrap();
        let none = no_styles();
        t.resolve_spans(&TableStyles::new(&none, &none));
        assert_eq!((t.header_rows, t.footer_rows, t.style), (1, 0, Some(0x30)));
        assert_eq!(t.columns, [100.0; 3]);
        assert_eq!(t.rows.len(), 2);
        assert_eq!(t.rows[1].height, Some(20.0));
        let cells: Vec<_> = t
            .cells
            .iter()
            .map(|c| (c.id, c.row, c.column, c.row_span, c.column_span))
            .collect();
        assert_eq!(
            cells,
            [
                (1, 0, 0, 1, 2),
                (3, 0, 2, 1, 1),
                (4, 1, 0, 1, 1),
                (5, 1, 1, 1, 1),
                (6, 1, 2, 1, 1)
            ]
        );
        // The cell format applies to the first column of each row.
        let f = t.format(&t.cells[0]).unwrap();
        assert_eq!((f.style_priority, f.style), (2, 0x11));
        assert_eq!(f.attrs.get(0xB63E), Some(&Value::Double(50.0)));
        assert!(t.format(&t.cells[1]).is_none());
    }

    #[test]
    fn spans_take_the_best_width_then_the_free_rows_below() {
        let pos = |id, width: Option<f64>| Position {
            id,
            starts: (id != 0).then_some(CellKind::Text),
            width,
            content: None,
            format: None,
        };
        // Cell 1 is 20 wide (two columns of 10) and covers the row below;
        // cell 5 was never laid out and spans the covered position to its
        // right.
        let grid = vec![
            vec![pos(1, Some(20.0)), pos(0, None), pos(3, None)],
            vec![pos(0, None), pos(0, None), pos(4, None)],
            vec![pos(6, Some(5.0)), pos(5, None), pos(0, None)],
        ];
        let row = Row {
            height: None,
            min_height: None,
            attrs: Attrs::default(),
        };
        let mut t = Table {
            uid: 1,
            style: None,
            attrs: Attrs::default(),
            right_to_left: false,
            header_rows: 0,
            footer_rows: 0,
            rows: vec![row; 3],
            columns: vec![10.0; 3],
            cells: cells_from_grid(&grid),
            formats: Vec::new(),
            grid: vec![vec![None; 3]; 3],
        };
        let none = no_styles();
        t.resolve_spans(&TableStyles::new(&none, &none));
        let spans: Vec<_> = t
            .cells
            .iter()
            .map(|c| (c.id, c.row_span, c.column_span))
            .collect();
        assert_eq!(
            spans,
            [(1, 2, 2), (3, 1, 1), (4, 1, 1), (6, 1, 1), (5, 1, 2)]
        );
    }
}
