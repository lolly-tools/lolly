//! Links, style mappings and import options of linked stories and of
//! stories placed from Word or Excel files.
//!
//! Evidence: `docs/format/objects.md`, story links and placed text.

use super::*;
use crate::model::{ExcelOptions, ImportOptions, StyleMappings};

/// A `Properties` child of type `list` holding one typed `ListItem` per
/// value.
fn typed_list(tag: &str, items: Vec<(&str, String)>) -> Node {
    Node {
        tag: tag.into(),
        attrs: vec![("type".into(), "list".into())],
        text: None,
        children: items
            .into_iter()
            .map(|(ty, text)| Node {
                tag: "ListItem".into(),
                attrs: vec![("type".into(), ty.into())],
                text: Some(text),
                children: Vec::new(),
            })
            .collect(),
    }
}

/// `ResolveStyleClash` of Word import options.
fn style_clash(code: u32) -> Option<&'static str> {
    match code {
        0 => Some("ResolveClashUseExisting"),
        2 => Some("ResolveClashAutoRename"),
        _ => None,
    }
}

/// The items of `WordRTFImportPreferences` from the 19 u32 of chunk
/// 0x12210: 20 items from version 14, 19 before. Items without a stored
/// field have the value of every sample. `None` for an unknown code.
fn word_items(s: &[u32; 19], major: u32) -> Option<Vec<(&'static str, String)>> {
    let flag = |i: usize| ("boolean", (s[i] != 0).to_string());
    let constant = |v: bool| ("boolean", v.to_string());
    let page_breaks = match s[5] {
        0 => "PageBreak",
        2 => "None",
        _ => return None,
    };
    let mut items = vec![
        flag(0),
        flag(1),
        ("enumeration", page_breaks.into()),
        constant(true),
        ("enumeration", "UnformattedTable".into()),
        flag(8),
        flag(9),
        constant(false),
        ("enumeration", style_clash(s[11])?.into()),
        ("enumeration", style_clash(s[12])?.into()),
        flag(14),
        flag(15),
        flag(16),
        flag(17),
    ];
    if major >= 14 {
        items.push(constant(false));
    }
    items.extend([
        constant(true),
        constant(true),
        ("long", s[4].to_string()),
        constant(false),
        constant(false),
    ]);
    Some(items)
}

/// The items of `ExcelImportPreferences`. Items without a stored field
/// have the value of every sample. `None` for an unknown table code.
fn excel_items(e: &ExcelOptions) -> Option<Vec<(&'static str, String)>> {
    let table = match e.table {
        0 => "ExcelFormattedTable",
        1 => "ExcelUnformattedTable",
        _ => return None,
    };
    Some(vec![
        ("enumeration", "Spreadsheet".into()),
        ("long", "3".into()),
        ("boolean", "false".into()),
        ("enumeration", table.into()),
        ("boolean", "true".into()),
        ("boolean", "true".into()),
        ("string", e.view.clone()),
        ("string", e.sheet.clone()),
        ("string", e.range.clone()),
        ("long", "1".into()),
    ])
}

/// A style mapping name: a group name with `:*` after it.
fn group(name: &str, group: bool) -> String {
    if group {
        format!("{name}:*")
    } else {
        name.to_string()
    }
}

impl Writer<'_> {
    /// `<Properties>` of a story placed from a Word or Excel file: its
    /// import options, then its style mapping preferences.
    pub(super) fn story_link_properties(&self, x: &mut Xml, s: &Story) {
        let linked = &s.settings.linked;
        let mut nodes = Vec::new();
        match &linked.import {
            Some(ImportOptions::Word(w)) => match word_items(w, self.doc.version.major) {
                Some(items) => nodes.push(typed_list("WordRTFImportPreferences", items)),
                None => self.warn(format!(
                    "story {}: Word import options with an unknown code left out",
                    s.uid
                )),
            },
            Some(ImportOptions::Excel(e)) => match excel_items(e) {
                Some(items) => nodes.push(typed_list("ExcelImportPreferences", items)),
                None => self.warn(format!(
                    "story {}: Excel import options with an unknown code left out",
                    s.uid
                )),
            },
            None => {}
        }
        if let Some((paragraph, character)) = &linked.mapping_prefs
            && !(paragraph.is_empty() && character.is_empty())
        {
            let list = |names: &[String]| {
                typed_list(
                    "ListItem",
                    names.iter().map(|n| ("string", n.clone())).collect(),
                )
            };
            nodes.push(Node {
                tag: "StyleMappingPreferences".into(),
                attrs: vec![("type".into(), "list".into())],
                text: None,
                children: vec![list(paragraph), list(character)],
            });
        }
        Self::properties_with(x, &[], &nodes);
    }

    /// `LinkedStoryOption` of a story with a link and chunk 0x21D12. The
    /// first three values have no identified field (constant in every
    /// sample).
    pub(super) fn linked_story_option(x: &mut Xml, s: &Story) {
        let linked = &s.settings.linked;
        if let (Some(apply), Some(_)) = (linked.apply_style_mappings, &linked.link) {
            x.empty(
                "LinkedStoryOption",
                &[
                    ("UpdateWhileSaving", "false".into()),
                    ("WarnOnUpdateOfEditedStory", "true".into()),
                    ("RemoveForcedLineBreaks", "false".into()),
                    ("ApplyStyleMappings", apply.to_string()),
                ],
            );
        }
    }

    /// `ParaStyleMapping` and `CharStyleMapping` elements of the story or
    /// document whose `Self` is `owner`. A mapping with an unknown rule
    /// and the lists whose element is not known are left out with a
    /// warning.
    pub(super) fn style_mappings(&self, x: &mut Xml, owner: &str, m: &StyleMappings) {
        for (tag, list) in [
            ("ParaStyleMapping", &m.paragraph),
            ("CharStyleMapping", &m.character),
        ] {
            for (i, e) in list.iter().enumerate() {
                // A group name ends in `:*` (objects.md, style mappings).
                let (rule, source_group, destination_group) = match e.rule {
                    0 => ("StyleMappingRule", false, false),
                    1 => ("GroupMappingRule", true, true),
                    2 => ("StyleToGroupMappingRule", false, true),
                    r => {
                        self.warn(format!("{owner}: {tag} {i} with rule {r} left out"));
                        continue;
                    }
                };
                x.empty(
                    tag,
                    &[
                        ("Self", format!("{owner}{tag}{i}")),
                        ("SourceStyleName", group(&e.source, source_group)),
                        (
                            "DestinationStyleName",
                            group(&e.destination, destination_group),
                        ),
                        ("MappingRuleType", rule.into()),
                    ],
                );
            }
        }
        if m.other > 0 {
            self.warn(format!(
                "{owner}: {} table or cell style mappings left out",
                m.other
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_options_have_19_items_before_version_14() {
        let mut s = [0u32; 19];
        s[4] = 2;
        s[11] = 2;
        let old = word_items(&s, 12).unwrap();
        let new = word_items(&s, 14).unwrap();
        assert_eq!((old.len(), new.len()), (19, 20));
        assert_eq!(new[8].1, "ResolveClashAutoRename");
        assert_eq!(new[17], ("long", "2".into()));
        assert_eq!(old[16], ("long", "2".into()));
        s[5] = 1;
        assert!(word_items(&s, 14).is_none());
    }
}
