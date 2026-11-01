//! The values of an applied object style that a page item is compared
//! with. IDML writes some values of a page item only when they differ
//! from its object style (`docs/format/objects.md`, page item settings and
//! text frame preferences).

use super::*;

/// The effective values of an object style as the converter writes them:
/// its own, then those of the styles it is based on, then the root
/// `[None]`.
#[derive(Debug, Default)]
pub(super) struct StyleValues {
    /// Page item attributes (`FillColor`, `StrokeWeight`, …).
    pub item: Vec<(String, String)>,
    /// `TextFramePreference` attributes.
    pub frame: Vec<(String, String)>,
    /// The style's category list (chunk 0x1B92E); `None` without it.
    pub enabled: Option<Vec<u32>>,
    /// Transparency attributes (chunk 0x1B92C) by attribute-list ID.
    pub transparency: Vec<(u32, crate::model::Value)>,
    /// Footnote values of the text frame settings (span, minimum
    /// spacing, space between).
    pub footnote: Option<(bool, f64, f64)>,
    /// Baseline frame grid of the text frame settings.
    pub baseline: Option<crate::model::BaselineGrid>,
    /// Insets of the text frame settings, in stored order.
    pub insets: Option<[f64; 4]>,
}

impl StyleValues {
    pub(super) fn item(&self, name: &str) -> Option<&str> {
        self.item
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }

    pub(super) fn transparency(&self, id: u32) -> Option<&crate::model::Value> {
        self.transparency
            .iter()
            .find(|(i, _)| *i == id)
            .map(|(_, v)| v)
    }

    pub(super) fn frame(&self, name: &str) -> Option<&str> {
        self.frame
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.as_str())
    }
}

/// Whether two IDML values are the same: equal text, or numbers equal to
/// 6 significant digits (as `tools/compare.py` compares them).
pub(super) fn same_value(a: &str, b: &str) -> bool {
    if a == b {
        return true;
    }
    match (a.parse::<f64>(), b.parse::<f64>()) {
        (Ok(x), Ok(y)) => (x - y).abs() <= 5e-7 * x.abs().max(y.abs()),
        _ => false,
    }
}

fn add_missing(to: &mut Vec<(String, String)>, from: &[(String, String)]) {
    for (k, v) in from {
        if !to.iter().any(|(n, _)| n == k) {
            to.push((k.clone(), v.clone()));
        }
    }
}

impl Writer<'_> {
    /// Whether `os` is the root object style `[None]`.
    pub(super) fn is_root_object_style(os: &crate::model::ObjectStyle) -> bool {
        os.builtin && os.name == "[None]" && os.based_on.is_none()
    }

    /// The effective values of object style `uid`, or `None` if the
    /// document has no such style.
    pub(super) fn style_values(&self, uid: u32) -> Option<std::rc::Rc<StyleValues>> {
        if let Some(v) = self.style_values.borrow().get(&uid) {
            return Some(v.clone());
        }
        let styles = &self.doc.object_styles;
        let os = styles.get(&uid)?;
        let root = styles.values().find(|s| Self::is_root_object_style(s));
        let mut out = StyleValues {
            enabled: os.enabled.clone(),
            ..StyleValues::default()
        };
        let mut seen = std::collections::HashSet::new();
        let mut cur = Some(os);
        while let Some(s) = cur {
            if !seen.insert(s.uid) {
                break;
            }
            let is_root = Self::is_root_object_style(s);
            let node = self.object_style_node(s, is_root);
            add_missing(&mut out.item, &node.attrs);
            for (id, v) in &s.transparency.values {
                if out.transparency.iter().all(|(i, _)| i != id) {
                    out.transparency.push((*id, v.clone()));
                }
            }
            // A style without text frame settings takes them from the
            // style it is based on.
            if let Some(f) = &s.frame {
                if out.footnote.is_none()
                    && let Some((span, a, b)) = f.footnotes
                {
                    out.footnote = Some((span == 1, a, b));
                }
                if out.baseline.is_none() {
                    out.baseline = f.baseline_grid;
                }
                if out.insets.is_none() {
                    out.insets = f.insets;
                }
            }
            if (s.frame.is_some() || is_root)
                && let Some(t) = node.child("TextFramePreference")
            {
                add_missing(&mut out.frame, &t.attrs);
            }
            cur = match s.based_on.and_then(|b| styles.get(&b)) {
                Some(b) => Some(b),
                None if !is_root => root,
                None => None,
            };
        }
        // A chain with no text frame settings: the style's own written
        // values.
        if out.frame.is_empty()
            && let Some(t) = self
                .object_style_node(os, false)
                .child("TextFramePreference")
        {
            out.frame = t.attrs.clone();
        }
        let v = std::rc::Rc::new(out);
        self.style_values.borrow_mut().insert(uid, v.clone());
        Some(v)
    }
}

#[cfg(test)]
mod tests {
    use super::same_value;

    #[test]
    fn compares_numbers_to_six_digits() {
        assert!(same_value("12", "12.0000001"));
        assert!(same_value("Swatch/None", "Swatch/None"));
        assert!(!same_value("0", "1e-13"));
        assert!(!same_value("12", "12.01"));
        assert!(!same_value("TopAlign", "CenterAlign"));
    }
}
