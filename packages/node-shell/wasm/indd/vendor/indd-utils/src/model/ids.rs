//! Class, chunk and strand IDs and the enumeration codes the model reads.
//!
//! Evidence: each constant's section in `docs/format/` (mostly
//! `objects.md`).

/// Class IDs.
pub mod class {
    pub const DOCUMENT: u32 = 0xE01;
    pub const SPREAD: u32 = 0x501;
    pub const MASTER_SPREAD: u32 = 0x1401;
    pub const SPREAD_LAYER: u32 = 0x301;
    pub const LAYER: u32 = 0x302;
    pub const PAGE: u32 = 0x50F;
    pub const SPLINE_ITEM: u32 = 0x6201;
    pub const GROUP: u32 = 0x401;
    pub const MULTI_COLUMN_FRAME: u32 = 0x263;
    pub const FRAME_COLUMN: u32 = 0x227;
    pub const FRAME_LIST: u32 = 0x228;
    pub const STORY: u32 = 0x201;
    pub const STYLE: u32 = 0x205;
    pub const SECTION: u32 = 0x4C01;
    pub const IMAGE: u32 = 0x1702;
    pub const PDF: u32 = 0x2501;
    pub const EPS: u32 = 0x6601;
    pub const SVG: u32 = 0x6639;
    /// Text kept from a placed EPS or PDF graphic (IDML `EPSText`).
    pub const EPS_TEXT: u32 = 0x660B;
    /// Text on the path of a shape or frame (IDML `TextPath`).
    pub const TEXT_PATH: u32 = 0xB320;
    /// A placed InDesign page (IDML `ImportedPage`).
    pub const IMPORTED_PAGE: u32 = 0x6607;
    /// A placed movie and sound (IDML `Movie`, `Sound`).
    pub const MOVIE: u32 = 0x14801;
    pub const SOUND: u32 = 0x14F01;
    /// The column of a text path's multi-column frame.
    pub const TEXT_PATH_COLUMN: u32 = 0xB318;
    /// A plain byte stream, such as the file of an embedded graphic.
    pub const RAW_DATA: u32 = 0x129;
    /// A graphic's screen preview; chunk 0x119 names its raw data object.
    pub const PREVIEW: u32 = 0x1708;
    pub const FONT_FAMILY: u32 = 0x3E03;
    pub const LANGUAGE: u32 = 0x2D07;
    pub const TOC_STYLE: u32 = 0x11605;
    /// Custom stroke styles (`attributes.md`, custom stroke styles).
    pub const DASHED_STROKE_STYLE: u32 = 0x5A43;
    pub const STRIPED_STROKE_STYLE: u32 = 0xB016;
    pub const NAMED_GRID: u32 = 0xCD12;
    /// A motion preset (IDML `MotionPreset`).
    pub const MOTION_PRESET: u32 = 0x20517;
    pub const ASSIGNMENT: u32 = 0x1BE01;
    /// An article (objects.md, articles).
    pub const ARTICLE: u32 = 0x21B01;
    pub const SMOOTH_SHADE: u32 = 0x5533;
    /// Form fields and multi-state objects (IDML `Button`, `CheckBox`,
    /// `RadioButton`, `TextBox`, `ComboBox`, `SignatureField`,
    /// `MultiStateObject`).
    pub const BUTTON: u32 = 0x1450C;
    pub const CHECK_BOX: u32 = 0x1450D;
    pub const RADIO_BUTTON: u32 = 0x1450E;
    pub const TEXT_BOX: u32 = 0x1450F;
    pub const COMBO_BOX: u32 = 0x14511;
    pub const SIGNATURE_FIELD: u32 = 0x14512;
    pub const MULTI_STATE: u32 = 0x145D8;
    /// Holds an item anchored in text.
    pub const ANCHOR: u32 = 0x262;
    /// A footnote, owned by a story at its reference (U+0004).
    pub const FOOTNOTE: u32 = 0x24F;
    /// An InDesign note, owned by a story at its anchor (U+FEFF).
    pub const NOTE: u32 = 0xA429;
    /// Deleted text of a tracked change, owned by the character after the
    /// deletion.
    pub const DELETED_TEXT: u32 = 0xA40A;
    /// An index marker, owned by a story at its U+FEFF.
    pub const INDEX_MARKER: u32 = 0x13006;
    /// The endnote story (`IsEndnoteStory`).
    pub const ENDNOTE_STORY: u32 = 0x2801;
    /// An endnote, owned by a story at its reference (U+0004).
    pub const ENDNOTE: u32 = 0x2805;
    /// The text range of an endnote in the endnote story.
    pub const ENDNOTE_RANGE: u32 = 0x2804;
    pub const TEXT_VARIABLE_INSTANCE: u32 = 0xCA64;
    pub const TEXT_VARIABLE: u32 = 0xCAB4;
    pub const STYLE_ROOT_GROUP: u32 = 0xCA8C;
    pub const STYLE_GROUP: u32 = 0xCA8B;
    pub const OBJECT_STYLE: u32 = 0x1B901;
    pub const OBJECT_STYLE_ROOT_GROUP: u32 = 0x1B972;
    pub const CELL_STYLE_ROOT_GROUP: u32 = 0x20241;
    pub const TABLE_STYLE_ROOT_GROUP: u32 = 0x1044F;
    /// Document-wide preferences.
    pub const PREFERENCES: u32 = 0x2202;
    /// A numbering list.
    pub const NUMBERING_LIST: u32 = 0x1A483;
    pub const GUIDE: u32 = 0x3301;
    pub const XML_TAG: u32 = 0xBF19;
    /// A colour used in the interface (XML tags).
    pub const UI_COLOR: u32 = 0x1F11;
    /// A colour profile: its name (chunk 0x13C).
    pub const COLOR_PROFILE: u32 = 0x7D03;
    /// Page item defaults.
    pub const ITEM_DEFAULTS: u32 = 0x6E07;
    /// The page item attribute list that items take the attributes
    /// they do not store from (chunk 0x6E03).
    pub const ITEM_BASE: u32 = 0x6E02;
    /// The wrap path of an item's text wrap (chunk 0x3703 at offset 4).
    pub const TEXT_WRAP_PATH: u32 = 0x3702;
    /// Links of a linked story and of a linked page item (`LinkClassID`
    /// is the class of the link object).
    pub const STORY_LINK: u32 = 0x21D03;
    pub const PAGE_ITEM_LINK: u32 = 0x21D32;
    /// Import options of placed Word and Excel files (story chunk 0x12202).
    pub const WORD_IMPORT_OPTIONS: u32 = 0x12210;
    pub const EXCEL_IMPORT_OPTIONS: u32 = 0x12213;
}

/// Chunk IDs.
pub mod chunk {
    pub const DOC_SPREADS: u32 = 0x501;
    pub const DOC_MASTER_SPREADS: u32 = 0x1401;
    pub const DOC_LAYERS: u32 = 0x301;
    pub const DOC_ACTIVE_LAYER: u32 = 0x313;
    pub const DOC_STORIES: u32 = 0x222;
    /// Note: user name and times.
    pub const NOTE: u32 = 0xA412;
    /// Index marker: its `Id` in the last u32.
    pub const INDEX_MARKER: u32 = 0x13009;
    /// Endnote: the UID of its range.
    pub const ENDNOTE_RANGE_OF: u32 = 0x22616;
    /// Endnote range: the UID of its endnote.
    pub const RANGE_ENDNOTE: u32 = 0x2261A;
    pub const DOC_SECTIONS: u32 = 0x4C01;
    /// Document users: u32 count, then per user a flag byte, the name
    /// and u32 colour.
    pub const DOC_USERS: u32 = 0xA443;
    /// Document save history: u32 count, then one record per session.
    pub const DOC_HISTORY: u32 = 0x1D8;
    /// Document label: u16 0x7B7B, u32 count, flagged key and value strings.
    pub const DOC_LABEL: u32 = 0x1630B;
    /// Preferences: u32 default numbering list, u16 count, list UIDs, i32 -1.
    pub const NUMBERING_LISTS: u32 = 0x1A49B;
    /// Numbering list: flagged name, then u8 flags.
    pub const NUMBERING_LIST_INFO: u32 = 0x1A49A;
    pub const SPREAD_CHILDREN: u32 = 0x503;
    pub const SPREAD_TRANSFORM: u32 = 0x56E;
    pub const SPREAD_BINDING: u32 = 0x1B8;
    pub const SPREAD_LAYER_LAYER: u32 = 0x302;
    pub const SPREAD_LAYER_CHILDREN: u32 = 0x303;
    pub const LAYER_PROPS: u32 = 0x304;
    /// u16 0 if document pages may shuffle across the spread.
    pub const SPREAD_SHUFFLE: u32 = 0x1A8;
    /// Flattener settings of a spread.
    pub const SPREAD_FLATTENER: u32 = 0x10833;
    /// Page transition of a spread: u32 type code, u32, u32 direction code.
    pub const SPREAD_TRANSITION: u32 = 0x2050C;
    /// Tab orders: u32 count, then per page u32 page and a UID list.
    pub const SPREAD_TAB_ORDERS: u32 = 0x14580;
    /// u16 0 if a master spread hides the items of its own master.
    pub const MASTER_SHOW_ITEMS: u32 = 0x140D;
    /// u32 story of a master spread's primary text frame.
    pub const MASTER_PRIMARY_STORY: u32 = 0x140A;
    /// Overridden master page items: u32 count, two UID lists.
    pub const PAGE_OVERRIDES: u32 = 0x1404;
    /// Layout grid use: six bytes, u32 grid starting point code, then
    /// u16 1 to use the master's grid.
    pub const PAGE_GRID_USE: u32 = 0xCD04;
    /// Layout rule: u32, then u32 code.
    pub const PAGE_LAYOUT_RULE: u32 = 0x563;
    /// Page colour: u32 0 none, 1 the master's, else an interface colour.
    pub const PAGE_COLOR: u32 = 0x5FF;
    pub const PAGE_MASTER: u32 = 0x140F;
    pub const PAGE_TRANSFORM: u32 = 0x5CC;
    pub const PAGE_BOUNDS: u32 = 0x5DD;
    /// Page bounds in files from InDesign 3.0 and 4.0.
    pub const OLD_PAGE_BOUNDS: u32 = 0x154;
    pub const PAGE_MARGINS: u32 = 0x51A;
    pub const PAGE_COLUMNS: u32 = 0x528;
    pub const PAGE_GRID: u32 = 0xCD02;
    pub const ITEM_TRANSFORM: u32 = 0x151;
    /// A form field's states: u32 active state ID, u32 count, then per
    /// state u32 ID, u16 enabled, u16 key, u16.
    pub const FORM_STATES: u32 = 0x14521;
    /// A form field's state items: u32 spread, u32 parent, u32 count,
    /// then per state u32 key, u32 count and the item UIDs.
    pub const FORM_STATE_ITEMS: u32 = 0x14526;
    /// A form field's transform (six f64) when it has states.
    pub const FORM_TRANSFORM: u32 = 0x14527;
    /// Text on a path of a shape or frame: u32 text path UID (0 for
    /// none), then its settings.
    pub const ITEM_TEXT_PATH: u32 = 0xB30A;
    /// Text path: u32, u32, UID list holding its multi-column frame.
    pub const TEXT_PATH_FRAME: u32 = 0xB334;
    /// EPS text: its text record (IDML `EPSTextData`).
    pub const EPS_TEXT_DATA: u32 = 0x6611;
    /// EPS text: four f64 (IDML `EPSTextAttributeBounds`), then other
    /// fields.
    pub const EPS_TEXT_ATTR_BOUNDS: u32 = 0x6612;
    /// A group's transform when it has no chunk 0x151.
    pub const GROUP_TRANSFORM: u32 = 0x40D;
    /// u16 1 for a frame meant for a graphic.
    pub const ITEM_CONTENT: u32 = 0x1623;
    /// The item's layer position before it was grouped: i32 at 4.
    pub const ITEM_GROUPING_LAYER: u32 = 0x324;
    pub const ITEM_PATHS: u32 = 0x162B;
    pub const ITEM_HIERARCHY: u32 = 0x15B;
    /// u32: 1 when a master page item cannot be overridden.
    pub const ITEM_ALLOW_OVERRIDES: u32 = 0x142D;
    pub const COLUMN_FRAME_LIST: u32 = 0x220;
    pub const FRAME_LIST_FRAMES: u32 = 0x205;
    pub const STORY_STRANDS: u32 = 0x223;
    /// The table of contents (class 0x8C20) that made a story.
    pub const STORY_TOC: u32 = 0x8C40;
    /// Story title: a flag byte and an in-object string.
    pub const STORY_TITLE: u32 = 0xA44C;
    /// Story direction: u16, 1 for right to left.
    pub const STORY_DIRECTION: u32 = 0x50F96;
    /// Optical margin: u16, f64 size, u16, u16 alignment, u16.
    pub const STORY_OPTICAL_MARGIN: u32 = 0x2EE;
    /// Linked story options: 6 bytes, u32 `ApplyStyleMappings`.
    pub const STORY_LINK_OPTIONS: u32 = 0x21D12;
    /// Style mappings of a story or of the preferences: five lists.
    pub const STYLE_MAPPINGS: u32 = 0x21D30;
    /// u32 UID of the import options of placed text, u32.
    pub const STORY_IMPORT_OPTIONS: u32 = 0x12202;
    /// Word import options: 19 u32.
    pub const WORD_IMPORT_OPTIONS: u32 = 0x12210;
    /// Excel import options.
    pub const EXCEL_IMPORT_OPTIONS: u32 = 0x12213;
    /// Style mapping preferences of placed text: u32 p, u32 c, names.
    pub const STYLE_MAPPING_PREFS: u32 = 0x12216;
    /// Document: link source IDs, u32, u32 count, (ID, UID) pairs.
    pub const LINK_SOURCE_IDS: u32 = 0x21D06;
    /// The TOC style of a table of contents.
    pub const TOC_STYLE_OF: u32 = 0x11613;
    /// Name of a dashed and of a striped stroke style: flag byte, string.
    pub const DASHED_STROKE_NAME: u32 = 0x5A48;
    pub const STRIPED_STROKE_NAME: u32 = 0xB023;
    /// Dashed stroke style: u32 count, f64 lengths, u16 corner, u32 cap.
    pub const DASHED_STROKE: u32 = 0x5A4F;
    /// Striped stroke style: u32 count, pairs of f64 (start, width).
    pub const STRIPED_STROKE: u32 = 0xB002;
    pub const TOC_STYLE: u32 = 0x11605;
    pub const NAMED_GRID: u32 = 0xCD28;
    /// The named grid of a story or object style: u16 1, then the named
    /// grid UID; u16 0 for none.
    pub const APPLIED_NAMED_GRID: u32 = 0xCD32;
    pub const STRAND_DATA: u32 = 0x261;
    pub const STRAND_RUNS: u32 = 0x262;
    pub const STYLE_INFO: u32 = 0x230;
    pub const ITEM_ATTRS: u32 = 0x6E03;
    pub const STYLE_ATTRS: u32 = 0x23F;
    /// Style export settings: tag maps, then u16 flags.
    pub const STYLE_EXPORT: u32 = 0x28F0;
    pub const LANGUAGE_NAME: u32 = 0x2D0F;
    /// The quotes of a language.
    pub const LANGUAGE_QUOTES: u32 = 0x2D26;
    /// The name of an assignment, then two strings.
    pub const ASSIGNMENT_NAME: u32 = 0x1BE1B;
    /// The articles of the document, in order: a UID list.
    pub const DOC_ARTICLES: u32 = 0x21B03;
    /// The name of an article: a flag byte and an in-object string.
    pub const ARTICLE_NAME: u32 = 0x13C;
    /// The members of an article, in order: a UID list of page items.
    pub const ARTICLE_MEMBERS: u32 = 0x21B02;
    /// A group's article children list (IDML `ArticleChildrenList`).
    pub const GROUP_ARTICLE_CHILDREN: u32 = 0x21B05;
    pub const ANCHOR_CHILDREN: u32 = 0x2C8;
    /// Anchored object settings, of an anchor or an object style.
    pub const ANCHOR_SETTINGS: u32 = 0x2800;
    pub const MASTER_NAME: u32 = 0x1402;
    pub const STYLE_ROOT_CHILDREN: u32 = 0x28DC;
    pub const STYLE_GROUP_CHILDREN: u32 = 0x28D3;
    pub const STYLE_GROUP_NAME: u32 = 0x28D2;
    pub const OBJECT_STYLE_INFO: u32 = 0x1B907;
    pub const OBJECT_STYLE_ROOT_CHILDREN: u32 = 0x1B95A;
    pub const ITEM_OBJECT_STYLE: u32 = 0x1B916;
    /// Page item name: u8 1 if a built-in key, then an in-object string.
    pub const ITEM_NAME: u32 = 0x2C10;
    /// The same for a group.
    pub const GROUP_NAME: u32 = 0x418;
    /// Group label: u16 0x7B7B, u32 count, flagged key and value strings.
    pub const GROUP_LABEL: u32 = 0x2C0B;
    /// Label of a button or multi-state object, as `GROUP_LABEL`.
    pub const FORM_LABEL: u32 = 0x14582;
    /// Label of a movie and of a sound, as `GROUP_LABEL`.
    pub const MOVIE_LABEL: u32 = 0x1480C;
    pub const SOUND_LABEL: u32 = 0x14F03;
    /// Playback settings of a movie or sound: typed key lists.
    pub const MEDIA_SETTINGS: u32 = 0x14004;
    /// u16, then u32 shape code: 1 line, 2 or 3 rectangle, 4 or 5
    /// oval, 0 or 6 to 8 polygon, 9 none.
    pub const ITEM_SHAPE: u32 = 0x6204;
    /// u32 1 if the page item is locked.
    pub const ITEM_LOCKED: u32 = 0x2C2D;
    /// u16 0 if the page item is hidden.
    pub const ITEM_VISIBLE: u32 = 0x2C32;
    /// Override of a master page item: u32 master item, then a list of
    /// attribute IDs.
    pub const ITEM_OVERRIDE: u32 = 0x1424;
    /// Interface change counts: u32 count *n*, then *n* pairs of u32.
    pub const ITEM_PARENT_CHANGES: u32 = 0x21D4E;
    pub const ITEM_TARGET_CHANGES: u32 = 0x21D50;
    pub const ITEM_UPDATED_CHANGES: u32 = 0x21D53;
    /// u8 layout constraint flags.
    pub const ITEM_LAYOUT_CONSTRAINTS: u32 = 0x22228;
    /// Export options: alternative text, actual text, tagging.
    pub const ITEM_EXPORT: u32 = 0x1E206;
    /// Generated alternative text: error flag, crop rectangle, AI flag.
    pub const ITEM_ALT_TEXT_ERROR: u32 = 0x1E260;
    pub const ITEM_ALT_TEXT_CROP: u32 = 0x1E261;
    pub const ITEM_AI_ALT_TEXT: u32 = 0x1E262;
    /// Export size settings: a list of keys and string values.
    pub const ITEM_EXPORT_SIZE: u32 = 0x1E22B;
    pub const ROOT_GROUP_KIND: u32 = 0x28C2;
    pub const SECTION_INFO: u32 = 0x4C02;
    pub const DOCUMENT_PREFERENCES: u32 = 0x533;
    /// Shading of a pasted smooth shade.
    pub const SMOOTH_SHADE: u32 = 0x5532;
    pub const SMOOTH_SHADE_NAME: u32 = 0x5531;
    /// Index sort groups, in the preferences object.
    pub const INDEX_GROUPS: u32 = 0x1307E;
    pub const XML_TAG_NAME: u32 = 0xBF2F;
    pub const XML_TAG_COLOR: u32 = 0x117;
    /// Bullet characters, in the preferences object.
    pub const BULLETS: u32 = 0x1A488;
    /// Baseline frame grid of a multi-column frame (24 bytes).
    pub const FRAME_BASELINE_GRID: u32 = 0x2834;
    pub const FRAME_COLUMNS: u32 = 0x2D1;
    pub const FRAME_COLUMN_RULE: u32 = 0x22646;
    pub const FRAME_FOOTNOTES: u32 = 0x22608;
    pub const FRAME_IGNORE_WRAP: u32 = 0x3730;
    /// Frame grid of a multi-column frame: u16 1 at 0 for a frame grid.
    pub const FRAME_GRID: u32 = 0xCD41;
    /// Inset spacing of a text frame (on the frame, not its columns).
    pub const FRAME_INSET: u32 = 0x3723;
    pub const FRAME_JUSTIFICATION: u32 = 0x2CE;
    /// Matrix of a multi-column frame; its first four values give the
    /// text orientation.
    pub const FRAME_TEXT_TRANSFORM: u32 = 0x2DE;
    pub const GRAPHIC_BOUNDS: u32 = 0x1633;
    /// Links of an object (graphic, story, page item): 4 bytes, u32
    /// count, link UIDs.
    pub const GRAPHIC_LINK: u32 = 0x8CBC;
    /// u32 object of class 0x8C01 that images of InDesign 2.0 to 5.0 name
    /// (0 = none).
    pub const OLD_GRAPHIC_LINK: u32 = 0x8C1B;
    pub const LINK_INFO: u32 = 0x8C9B;
    pub const LINK_RESOURCE_URI: u32 = 0x8C92;
    /// u32 PDF identifier of a link.
    pub const LINK_PDF_IDENTIFIER: u32 = 0x1B6;
    /// Pasted image without a link: u32 raw data object.
    pub const IMAGE_DATA: u32 = 0x8C23;
    /// Pasted PDF without a link: u32 raw data object.
    pub const PDF_DATA: u32 = 0x2521;
    /// u32 preview object (class 0x1708) of a placed graphic.
    pub const GRAPHIC_PREVIEW: u32 = 0x170D;
    /// u32 raw data object of a preview.
    pub const PREVIEW_DATA: u32 = 0x119;
    pub const SWATCH_NAME: u32 = 0x1F30;
    pub const TEXT_WRAP: u32 = 0x3703;
    /// Of a wrap path: u32 owner item, u32 0, u16 custom path flag.
    pub const TEXT_WRAP_PATH_INFO: u32 = 0x3709;
    pub const CONTOUR_OPTION: u32 = 0x373D;
    pub const CLIPPING_PATH: u32 = 0x2C1A;
    /// Image properties: record list (pixels, colour space, resolution).
    pub const IMAGE_PROPERTIES: u32 = 0x1708;
    /// Colour profile of an image: u32 code, then a name.
    pub const IMAGE_PROFILE: u32 = 0x7C0F;
    /// Image import options: clipping path flag, alpha channel name.
    pub const IMAGE_IMPORT: u32 = 0x1714;
    /// Vector colour policies of a PDF or EPS: four u32.
    pub const VECTOR_POLICIES: u32 = 0x7C42;
    /// PDF placement: page number, transparent background, crop.
    pub const PDF_PLACEMENT: u32 = 0x251B;
    /// Placed InDesign page: u32 page index at 0, other fields.
    pub const IMPORTED_PAGE_INFO: u32 = 0x2505;
    /// Channels of an image: u32 count, then flag byte and name of each.
    pub const IMAGE_CHANNELS: u32 = 0x177C;
    /// Layers of an image, PDF or imported page.
    pub const GRAPHIC_LAYERS: u32 = 0x177A;
    /// Applied layer comp of an image (i32 at 4).
    pub const LAYER_COMP: u32 = 0x9209;
    /// Frame fitting attributes of an object style (u16 count, records).
    pub const OBJECT_STYLE_FITTING: u32 = 0x1B956;
    /// Page item attributes of an object style (u16 count, records).
    pub const OBJECT_STYLE_ATTRS: u32 = 0x1B92B;
    pub const OBJECT_STYLE_TRANSPARENCY: u32 = 0x1B92C;
    pub const OBJECT_STYLE_FRAME: u32 = 0x1B924;
    pub const OBJECT_STYLE_STORY: u32 = 0x285B;
    pub const OBJECT_STYLE_DIRECTION: u32 = 0x50F28;
    pub const OBJECT_STYLE_WRAP: u32 = 0x3776;
    /// Flex layout settings (78 bytes): six f64 at 30, paddings and gaps.
    pub const OBJECT_STYLE_FLEX: u32 = 0x1E244;
    pub const OBJECT_STYLE_CONTOUR: u32 = 0x3777;
    pub const OBJECT_STYLE_ENABLED: u32 = 0x1B92E;
    pub const OBJECT_STYLE_PARAGRAPH_STYLE: u32 = 0x1B946;
    /// u16 1 when an object style applies the next paragraph style.
    pub const OBJECT_STYLE_APPLY_NEXT: u32 = 0x1B94D;
    /// Size and position of an object style's transform attributes.
    pub const OBJECT_STYLE_TRANSFORM: u32 = 0x1E234;
    pub const GUIDE: u32 = 0x3308;
    /// Preferences: u32 count, then the motion preset UIDs.
    pub const PRESET_LIST: u32 = 0x2053E;
    /// Motion preset: contents, 4 bytes, an empty name, the name.
    pub const PRESET_DATA: u32 = 0x20532;
    /// Timing lists of a spread (and, empty, of most page items).
    pub const SPREAD_TIMING: u32 = 0x2056D;
    /// Timing lists of a button.
    pub const BUTTON_TIMING: u32 = 0x2056E;
    /// A form field's behaviours: u32 group count, then per group u32
    /// event code, u32 count and the behaviour UIDs.
    pub const FORM_BEHAVIORS: u32 = 0x15601;
    /// A behaviour's label, with the layout of the document label.
    pub const BEHAVIOR_LABEL: u32 = 0x156E1;
    /// Animation of a page item; `00 00` for none.
    pub const ANIMATION: u32 = 0x2055F;
}

/// Kinds of strand run data (first u32 of chunk 0x262).
pub mod strand {
    pub const TEXT: u32 = 0x202;
    pub const CHARACTER_STYLE: u32 = 0x203;
    pub const PARAGRAPH_STYLE: u32 = 0x204;
    /// Objects owned by text positions (anchored items, tables, ...).
    pub const OWNED_ITEMS: u32 = 0x209;
    /// Which object (story, or table and cell) each stretch of text belongs to.
    pub const TEXT_OWNER: u32 = 0x2A4;
    /// Tracked changes: user, kind and time of each change.
    pub const CHANGES: u32 = 0xA466;
    /// A copy of the ruby attributes, which IDML does not use
    /// (`objects.md`, ruby strand).
    pub const RUBY: u32 = 0x420D;
}

/// Text wrap mode codes.
pub mod wrap_mode {
    pub const NONE: u32 = 0;
    pub const JUMP_OBJECT: u32 = 1;
    pub const BOUNDING_BOX: u32 = 3;
    pub const CONTOUR: u32 = 6;
}

/// Values of chunk 0x28C2, the kind of a root style group.
pub mod root_kind {
    pub const PARAGRAPH: u32 = 0xCA0C;
    pub const CHARACTER: u32 = 0xCA0D;
    pub const OBJECT: u32 = 0x1B924;
    pub const TABLE: u32 = 0xB668;
    pub const CELL: u32 = 0xB669;
}

/// Page number style codes of sections.
pub mod numbering {
    pub const ARABIC: u32 = 0x4C15;
    pub const LOWER_ROMAN: u32 = 0x4C17;
    /// Chinese numerals, written digit by digit.
    pub const KANJI: u32 = 0x4C12;
    pub const DOUBLE_LEADING_ZEROS: u32 = 0x4C13;
    pub const UPPER_ROMAN: u32 = 0x4C16;
    pub const LOWER_LETTERS: u32 = 0x4C19;
    pub const SINGLE_LEADING_ZEROS: u32 = 0x4C1A;
}
