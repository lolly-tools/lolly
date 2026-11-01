//! IDML package writer.
//!
//! `write` builds one `Writer` and asks it for each package part. The parts
//! are written by `impl Writer` blocks in the child modules: `designmap`,
//! `resources` (graphics, fonts, preferences), `styles`, `spread` and
//! `story`. `attrs` holds the attribute tables and value decoders, `format`
//! the text forms of values, `pages` page numbering, `values` the values
//! every IDML has, and `transparency` the effect settings.

mod animation;
mod applied;
mod attrs;
mod designmap;
mod export;
mod format;
mod graphic;
mod kind;
mod media;
mod pages;
mod resources;
mod spread;
mod story;
mod story_link;
mod styles;
mod transparency;
mod values;
mod xml;
pub mod zip;

use attrs::*;
pub use format::num;
pub(crate) use format::round;
use format::*;
use kind::Kind;
use pages::*;
use styles::*;

use std::collections::BTreeMap;

use crate::model::prefs::{PrefProp, RulerOrigin};
use crate::model::{
    Alternative, Attrs, Behavior, BehaviorKind, ChangeEntry, Contour, Document, Form, FormKind,
    Graphic, GraphicKind, Guide, ItemKind, ItemProps, Link, Matrix, Note, Orientation, Page,
    PageItem, Path, Section, Shape, SourceRange, Spread, Story, Style, StyleGroup, Table,
    TextFramePreferences, TextRun, TextSource, TextVariable, TextWrap, UiColorRef, Value,
    XmlElement, XmlMarker,
    hyperlink::DestinationKind,
    numbering, root_kind,
    table::{Cell, CellKind, TableStyles},
    variable::Instance,
    wrap_mode,
    xml::Key as XmlKey,
};

use crate::object::builtin_key;
use values::Node;
use xml::Xml;

const PACKAGING_NS: &str = "http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging";
const MIMETYPE: &str = "application/vnd.adobe.indesign-idml-package";

struct Writer<'a> {
    doc: &'a Document,
    dom: String,
    /// Document file name.
    name: String,
    /// Names of the enclosing style groups of each style or group UID.
    group_path: std::collections::HashMap<u32, Vec<String>>,
    /// Values left out while writing, reported with the model's warnings.
    warnings: std::cell::RefCell<Vec<String>>,
    /// For each document page, the section that starts its alternate
    /// layout (`alternate_layouts`).
    page_layouts: Vec<u32>,
    /// For each document page, its section and page number.
    page_sections: Vec<(Section, u32)>,
    /// Observed attributes by element path (`values::element_attrs`).
    observed: std::cell::RefCell<std::collections::HashMap<String, Observed>>,
    /// Effective values of object styles, by UID (`applied`).
    style_values:
        std::cell::RefCell<std::collections::HashMap<u32, std::rc::Rc<applied::StyleValues>>>,
    /// The `Self` of the index topic of each page reference UID.
    topics: std::collections::HashMap<u32, String>,
    /// The anchored object settings of the anchored items being written,
    /// innermost last: items inside them carry the settings too.
    anchors: std::cell::RefCell<Vec<crate::model::AnchorSettings>>,
    /// UIDs a `TimingTarget` can refer to (`timing_targets`).
    timing_targets: std::cell::OnceCell<std::collections::HashSet<u32>>,
    /// UIDs of the movies and sounds written (`written_media`).
    media_uids: std::cell::OnceCell<std::collections::HashSet<u32>>,
}

/// Attributes observed on an element path (`values::element_attrs`).
type Observed = std::rc::Rc<Vec<(String, String)>>;

impl Writer<'_> {
    /// The `DOMVersion` written, as (major, minor).
    pub(super) fn dom_version(&self) -> (u32, u32) {
        let mut parts = self.dom.split('.').map(|p| p.parse().unwrap_or(0));
        (parts.next().unwrap_or(0), parts.next().unwrap_or(0))
    }

    /// Whether the document's version, or the application version of its
    /// last session, is at least `v`. IDML follows the exporting
    /// application, which can be later than the version in the header
    /// (objects.md, save history).
    pub(super) fn saved_by(&self, v: (u32, u32)) -> bool {
        let d = &self.doc.version;
        (d.major, d.minor) >= v || self.doc.last_session_version.is_some_and(|s| s >= v)
    }

    /// The edition that made the document, by the language of the name of
    /// its first assignment (`docs/format/objects.md`, assignments).
    pub(super) fn edition(&self) -> Option<Edition> {
        Some(match self.doc.assignment_name.as_deref()? {
            "Unassigned InCopy Content" => Edition::English,
            "Contenu InCopy non affecté" => Edition::French,
            "Nicht zugewiesener InCopy-Inhalt" => Edition::German,
            "Niet toegewezen InCopy-inhoud" => Edition::Dutch,
            "Contenuto InCopy non assegnato" => Edition::Italian,
            "할당되지 않은 InCopy 내용" => Edition::Korean,
            "アサインされていない InCopy の内容" => Edition::Japanese,
            "未指定的 InCopy 內容" | "未指定的 InCopy 内容" => Edition::Chinese,
            _ => Edition::Other,
        })
    }

    /// The edition that saved the document, by the black name of the XMP
    /// packet (`docs/format/objects.md`, saving edition).
    pub(super) fn saving_edition(&self) -> Option<Edition> {
        Some(match self.doc.black_name.as_deref()? {
            "Black" => Edition::English,
            "검정" => Edition::Korean,
            "黒" => Edition::Japanese,
            "黑色" => Edition::Chinese,
            "Schwarz" => Edition::German,
            "Noir" => Edition::French,
            "Nero" => Edition::Italian,
            "Zwart" => Edition::Dutch,
            "Černá" => Edition::Czech,
            "Preto" => Edition::Portuguese,
            "Черный" => Edition::Russian,
            _ => Edition::Other,
        })
    }

    /// Whether the last session in the save history was one of a
    /// Japanese or Chinese edition (code 0x0101); `None` when the history
    /// cannot be read. Values that follow the exporting InDesign's
    /// language depend on it (`docs/format/objects.md`, save history).
    pub(super) fn japanese_session(&self) -> Option<bool> {
        self.doc.last_session_code.map(|c| c == 0x0101)
    }

    /// The attributes every IDML of the document's version has on the
    /// elements on `path` (`docs/format/idml-values.md`).
    fn observed(&self, path: &str) -> Observed {
        self.observed
            .borrow_mut()
            .entry(path.to_string())
            .or_insert_with(|| {
                std::rc::Rc::new(values::element_attrs(path, self.doc.version.major))
            })
            .clone()
    }

    fn package_root(&self, x: &mut Xml, kind: &str) {
        x.start(&format!("idPkg:{kind}"))
            .attr("xmlns:idPkg", PACKAGING_NS)
            .attr("DOMVersion", &self.dom);
    }

    /// The IDML `Name` of a style: the names of its style groups and its
    /// own, joined by `:`, with a `:` inside a name written `\:`, and
    /// `$ID/` first for a built-in style. Its `Self` is this name escaped
    /// with `self_name` (`docs/format/objects.md`, style groups).
    fn grouped_name(&self, uid: u32, name: &str, builtin: bool) -> String {
        let groups = self.group_path.get(&uid).map_or(&[][..], Vec::as_slice);
        let joined = style_path(groups.iter().map(String::as_str).chain([name]));
        if builtin {
            builtin_key(&joined)
        } else {
            joined
        }
    }

    /// The name IDML gives a font family, and the name its fonts' names
    /// are made from: the native name when the family's writing script is
    /// the script of the document users, and `$ID/` first for a built-in
    /// name (`docs/format/fonts.md`, family names).
    fn family_names(&self, f: &crate::model::font::FontFamily) -> (String, String) {
        let native = self
            .doc
            .users_script
            .is_some_and(|s| s != 0 && u32::from(s) == f.writing_script)
            && !f.native_name.is_empty()
            && f.native_name != f.name;
        let base = if native { &f.native_name } else { &f.name };
        let idml = if f.builtin {
            builtin_key(base)
        } else {
            base.clone()
        };
        (idml, base.clone())
    }

    /// The composite font a font family stands for: the one whose name is
    /// the family's name, with `<hhhh>` escapes decoded
    /// (`docs/format/fonts.md`, composite fonts as applied fonts).
    fn composite_font_of(
        &self,
        f: &crate::model::font::FontFamily,
    ) -> Option<&crate::model::CompositeFont> {
        if self.doc.composite_fonts.is_empty() {
            return None;
        }
        let name = f.unescaped_name();
        self.doc
            .composite_fonts
            .iter()
            .find(|c| c.name.name == name)
    }

    fn style_ref(&self, uid: Option<u32>, paragraph: bool) -> String {
        let prefix = if paragraph {
            "ParagraphStyle"
        } else {
            "CharacterStyle"
        };
        match uid.and_then(|u| self.doc.styles.get(&u)) {
            Some(s) => format!(
                "{prefix}/{}",
                self_name(&self.grouped_name(s.uid, &s.name, s.builtin))
            ),
            None if paragraph => "ParagraphStyle/$ID/NormalParagraphStyle".into(),
            None => "CharacterStyle/$ID/[No character style]".into(),
        }
    }
}

/// The language of the InDesign edition that made a document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Edition {
    English,
    French,
    German,
    Dutch,
    Italian,
    Korean,
    Japanese,
    Chinese,
    Czech,
    Portuguese,
    Russian,
    Other,
}

impl Edition {
    /// The name this edition gives an unknown document user; Chinese
    /// documents show two (`objects.md`, saving edition).
    pub(super) fn unknown_user(self) -> &'static [&'static str] {
        match self {
            Edition::English => &["Unknown User Name"],
            Edition::Korean => &["알 수 없는 사용자 이름"],
            Edition::Japanese => &["不明なユーザー名"],
            Edition::Chinese => &["不明的使用者名稱", "未知用户名"],
            Edition::German => &["Unbekannter Benutzername"],
            Edition::French => &["Nom d'utilisateur inconnu"],
            Edition::Italian => &["Nome ut. sconosciuto"],
            Edition::Dutch => &["Onbekende gebruikersnaam"],
            Edition::Czech => &["Neznámé jméno uživatele"],
            Edition::Portuguese => &["Nome de usuário desconhecido"],
            Edition::Russian => &["Неизвестное имя пользователя"],
            Edition::Other => &[],
        }
    }

    /// The name this edition gives a behaviour with the built-in name
    /// `key`, where a sample shows it (`objects.md`, button behaviours).
    pub(super) fn behavior_name(self, key: &str) -> Option<&'static str> {
        let key = key.strip_prefix("$$$/Forms Action/")?;
        Some(match (self, key) {
            (Edition::English, "GoTo Anchor") => "Go To Destination",
            (Edition::Korean, "GoTo Anchor") => "대상으로 이동",
            (Edition::Korean, "GoTo First Page") => "첫 페이지로 이동",
            (Edition::Korean, "GoTo Next Page") => "다음 페이지로 이동",
            (Edition::Korean, "GoTo Previous Page") => "이전 페이지로 이동",
            (Edition::Korean, "GoTo Next View") => "다음 보기로 이동",
            (Edition::Korean, "SwitchToMSOState") => "상태로 이동",
            (Edition::Korean, "SwitchToNextMSOState") => "다음 상태로 이동",
            (Edition::Korean, "SwitchToPrevMSOState") => "이전 상태로 이동",
            (Edition::Chinese, "GoTo First Page") => "跳至第一頁",
            (Edition::Chinese, "GoTo Next Page") => "跳至下一頁",
            (Edition::Chinese, "GoTo Previous Page") => "跳至上一頁",
            (Edition::Chinese, "GoTo Page") => "跳至頁面",
            (Edition::Chinese, "GoTo URL") => "前往 URL",
            (Edition::Chinese, "SwitchToMSOState") => "跳至狀態",
            (Edition::Chinese, "SwitchToNextMSOState") => "跳至下一個狀態",
            (Edition::Chinese, "SwitchToPrevMSOState") => "跳至上一個狀態",
            (Edition::Chinese, "Movie") => "影片",
            (Edition::Chinese, "Sound") => "聲音",
            (Edition::Chinese, "Show/Hide Fields") => "顯示/隱藏欄位",
            (Edition::Chinese, "Open File") => "開啟檔案",
            (Edition::Chinese, "Submit Form") => "送出表格",
            (Edition::Chinese, "Reset Form") => "清除表格",
            (Edition::Chinese, "Print Form") => "列印表格",
            _ => return None,
        })
    }
}

/// The `DOMVersion` of the application that saved the document last, by
/// the save history, else by the header (`idml-values.md`, DOM version).
/// Several releases keep the DOM version of an earlier one.
fn dom_version(doc: &Document) -> String {
    let header = (doc.version.major, doc.version.minor);
    let (major, minor) = doc
        .last_session_version
        .filter(|v| v.0 == header.0)
        .unwrap_or(header);
    let minor = match (major, minor) {
        (9, 1 | 2) | (11, 1) | (14, 3) | (17, 1..=4) | (18, 1..=4) | (19, 1 | 2) | (20, 1) => 0,
        (16, 3 | 4) => 2,
        (20, 5) => 4,
        _ => minor,
    };
    format!("{major}.{minor}")
}

/// Write `doc` as an IDML package. `name` is the document name (file
/// name). Returns warnings about values left out because the IDML schema
/// does not allow them.
pub fn write(doc: &Document, name: &str, out: impl std::io::Write) -> std::io::Result<Vec<String>> {
    let w = Writer {
        doc,
        dom: dom_version(doc),
        name: name.to_string(),
        group_path: group_paths(doc),
        warnings: Default::default(),
        observed: Default::default(),
        style_values: Default::default(),
        page_layouts: alternate_layouts(doc).1,
        page_sections: page_sections(doc),
        topics: designmap::topic_refs(doc),
        anchors: Default::default(),
        timing_targets: Default::default(),
        media_uids: Default::default(),
    };
    let mut files: BTreeMap<String, String> = BTreeMap::new();
    files.insert(
        "META-INF/container.xml".into(),
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n\t<rootfiles>\n\t\t<rootfile full-path=\"designmap.xml\" media-type=\"text/xml\">\n\t\t</rootfile>\n\t</rootfiles>\n</container>".into(),
    );
    files.insert("designmap.xml".into(), w.designmap(name));
    files.insert("Resources/Fonts.xml".into(), w.fonts());
    files.insert("Resources/Styles.xml".into(), w.styles());
    files.insert("Resources/Preferences.xml".into(), w.preferences());
    files.insert("XML/BackingStory.xml".into(), w.backing_story());
    files.insert("XML/Tags.xml".into(), w.tags());
    let names = page_names(doc);
    let mut unused = 0;
    for s in &doc.master_spreads {
        files.insert(
            format!("MasterSpreads/MasterSpread_u{:x}.xml", s.uid),
            w.spread(s, true, &mut unused, &names),
        );
    }
    let mut page_index = 0;
    for s in &doc.spreads {
        files.insert(
            format!("Spreads/Spread_u{:x}.xml", s.uid),
            w.spread(s, false, &mut page_index, &names),
        );
    }
    for s in &doc.stories {
        files.insert(format!("Stories/Story_u{:x}.xml", s.uid), w.story(s));
    }
    // Unnamed colours and gradients are written only where the other
    // parts refer to them (objects.md, colours), so the graphic part is
    // written last.
    let refs = swatch_refs(files.values().map(String::as_str));
    files.insert("Resources/Graphic.xml".into(), w.graphic(&refs));
    let mut z = zip::ZipWriter::new(out);
    z.add("mimetype", MIMETYPE.as_bytes())?;
    for (path, content) in &files {
        z.add(path, content.as_bytes())?;
    }
    z.finish()?;
    Ok(w.warnings.into_inner())
}

/// The `Color/u…` and `Gradient/u…` references in the package parts: an
/// attribute value or element text that is such a reference.
fn swatch_refs<'a>(parts: impl Iterator<Item = &'a str>) -> std::collections::HashSet<String> {
    let mut out = std::collections::HashSet::new();
    for part in parts {
        for prefix in ["Color/u", "Gradient/u", "PastedSmoothShade/u"] {
            for (i, _) in part.match_indices(prefix) {
                if i == 0 || !matches!(part.as_bytes()[i - 1], b'"' | b'>') {
                    continue;
                }
                let rest = &part[i + prefix.len()..];
                let hex = rest.bytes().take_while(u8::is_ascii_hexdigit).count();
                if hex > 0 && matches!(rest.as_bytes().get(hex), Some(b'"' | b'<')) {
                    out.insert(part[i..i + prefix.len() + hex].to_string());
                }
            }
        }
    }
    out
}

#[cfg(test)]
impl<'a> Writer<'a> {
    /// A writer for `doc` with no derived state, for unit tests.
    pub(super) fn for_test(doc: &'a Document) -> Writer<'a> {
        Writer {
            doc,
            dom: "20.0".into(),
            name: String::new(),
            group_path: Default::default(),
            warnings: Default::default(),
            observed: Default::default(),
            style_values: Default::default(),
            page_layouts: Vec::new(),
            page_sections: Vec::new(),
            topics: Default::default(),
            anchors: Default::default(),
            timing_targets: Default::default(),
            media_uids: Default::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::swatch_refs;

    #[test]
    fn finds_unnamed_swatch_references() {
        let part = r#"<A FillColor="Color/u1f" B="Color/u2x" C="Gradient/uab"><P>Color/u9</P><Q>xColor/u8</Q></A>"#;
        let refs = swatch_refs([part].into_iter());
        let mut v: Vec<_> = refs.into_iter().collect();
        v.sort();
        assert_eq!(v, ["Color/u1f", "Color/u9", "Gradient/uab"]);
    }
}
