//! A small XML writer that indents with tabs, like InDesign's IDML export.
//!
//! The attributes of an open start tag are kept until the tag is closed,
//! so an element can never get an attribute twice: [`Xml::attr`] sets a
//! value (replacing an earlier one in place), and [`Xml::attrs_missing`]
//! adds observed values only for attributes the element does not have.
//! Values set with `attr` therefore take precedence over observed values
//! whatever the order of the calls.

use std::fmt::Write;

pub struct Xml {
    out: String,
    stack: Vec<String>,
    /// The current element's start tag is still open (`<x a="b"`).
    open: bool,
    /// The current element has text content, so its end tag is not indented.
    inline: bool,
    /// Attributes of the open start tag, in order, with their escaped
    /// values.
    attrs: Vec<(String, String)>,
}

/// Whether XML 1.0 allows `c` (control characters aside): not U+FFFE or
/// U+FFFF. Rust `char`s are never surrogates.
pub(super) fn xml_char(c: char) -> bool {
    !matches!(c, '\u{FFFE}' | '\u{FFFF}')
}

pub fn escape_attr(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\t' => out.push_str("&#x9;"),
            '\n' => out.push_str("&#xa;"),
            '\r' => out.push_str("&#xd;"),
            c if (c as u32) < 0x20 || !xml_char(c) => {}
            c => out.push(c),
        }
    }
    out
}

impl Default for Xml {
    fn default() -> Self {
        Self::new()
    }
}

impl Xml {
    pub fn new() -> Xml {
        Xml {
            out: String::from("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"),
            stack: Vec::new(),
            open: false,
            inline: false,
            attrs: Vec::new(),
        }
    }

    /// Write the attributes of the open start tag.
    fn flush_attrs(&mut self) {
        for (k, v) in self.attrs.drain(..) {
            let _ = write!(self.out, " {k}=\"{v}\"");
        }
    }

    fn close_start(&mut self) {
        if self.open {
            self.flush_attrs();
            self.out.push('>');
            self.open = false;
        }
    }

    fn indent(&mut self) {
        self.out.push('\n');
        for _ in 0..self.stack.len() {
            self.out.push('\t');
        }
    }

    /// A processing instruction at the current position.
    pub fn pi(&mut self, text: &str) -> &mut Self {
        self.close_start();
        if self.stack.is_empty() {
            let _ = writeln!(self.out, "<?{text}?>");
        } else {
            let _ = write!(self.out, "<?{text}?>");
        }
        self
    }

    pub fn start(&mut self, name: &str) -> &mut Self {
        self.close_start();
        if !self.stack.is_empty() && !self.inline {
            self.indent();
        }
        let _ = write!(self.out, "<{name}");
        self.stack.push(name.to_string());
        self.open = true;
        self.inline = false;
        self.attrs.clear();
        self
    }

    /// Set attribute `name` of the open start tag. An attribute the tag
    /// already has keeps its position and gets this value.
    pub fn attr(&mut self, name: &str, value: impl AsRef<str>) -> &mut Self {
        debug_assert!(self.open, "attribute outside a start tag");
        let value = escape_attr(value.as_ref());
        match self.attrs.iter_mut().find(|(k, _)| k == name) {
            Some(a) => a.1 = value,
            None => self.attrs.push((name.to_string(), value)),
        }
        self
    }

    /// Set attribute `name` when there is a value.
    pub fn attr_opt(&mut self, name: &str, value: Option<impl AsRef<str>>) -> &mut Self {
        if let Some(v) = value {
            self.attr(name, v);
        }
        self
    }

    /// Remove attribute `name` from the open start tag.
    pub fn remove_attr(&mut self, name: &str) -> &mut Self {
        self.attrs.retain(|(k, _)| k != name);
        self
    }

    /// Whether the open start tag has attribute `name`.
    pub fn has_attr(&self, name: &str) -> bool {
        self.open && self.attrs.iter().any(|(k, _)| k == name)
    }

    /// Add the attributes the open start tag does not have (observed
    /// values). A later [`Xml::attr`] with the same name replaces them.
    pub fn attrs_missing<'a>(
        &mut self,
        attrs: impl IntoIterator<Item = &'a (String, String)>,
    ) -> &mut Self {
        for (k, v) in attrs {
            if !self.has_attr(k) {
                self.attr(k, v);
            }
        }
        self
    }

    /// Text content. Characters below U+0020 other than tab and line feed
    /// become `<?ACE n?>`, with the code in hex as IDML writes it (U+0018,
    /// the automatic page number, is `<?ACE 18?>`).
    pub fn text(&mut self, s: &str) -> &mut Self {
        self.close_start();
        self.inline = true;
        for ch in s.chars() {
            match ch {
                '&' => self.out.push_str("&amp;"),
                '<' => self.out.push_str("&lt;"),
                '>' => self.out.push_str("&gt;"),
                '\t' | '\n' => self.out.push(ch),
                c if (c as u32) < 0x20 => {
                    let _ = write!(self.out, "<?ACE {:x}?>", c as u32);
                }
                c if !xml_char(c) => {}
                c => self.out.push(c),
            }
        }
        self
    }

    /// Text content as CDATA sections of at most `section` characters
    /// each. `s` must not contain `]]>`.
    pub fn cdata(&mut self, s: &str, section: usize) -> &mut Self {
        self.close_start();
        self.inline = true;
        let mut rest = s;
        while !rest.is_empty() {
            let mut n = section.min(rest.len());
            while !rest.is_char_boundary(n) {
                n -= 1;
            }
            let _ = write!(self.out, "<![CDATA[{}]]>", &rest[..n]);
            rest = &rest[n..];
        }
        self
    }

    /// Close the current element. Every `end` follows its `start` in the
    /// writer's code, whatever the input; an `end` with no open element
    /// is a writer bug, fails a debug assertion, and writes nothing in a
    /// release build.
    pub fn end(&mut self) -> &mut Self {
        debug_assert!(!self.stack.is_empty(), "end without start");
        let Some(name) = self.stack.pop() else {
            return self;
        };

        if self.open {
            self.flush_attrs();
            self.out.push_str(" />");
            self.open = false;
        } else {
            if !self.inline {
                self.indent();
            }
            let _ = write!(self.out, "</{name}>");
        }
        self.inline = false;
        self
    }

    /// An element with only attributes.
    pub fn empty(&mut self, name: &str, attrs: &[(&str, String)]) -> &mut Self {
        self.start(name);
        for (k, v) in attrs {
            self.attr(k, v);
        }
        self.end()
    }

    pub fn finish(mut self) -> String {
        while !self.stack.is_empty() {
            self.end();
        }
        self.out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_nested_elements() {
        let mut x = Xml::new();
        x.start("a").attr("k", "1 < 2").start("b").end();
        x.start("c").text("hi & bye").end().end();
        let s = x.finish();
        assert!(
            s.ends_with("<a k=\"1 &lt; 2\">\n\t<b />\n\t<c>hi &amp; bye</c>\n</a>"),
            "{s}"
        );
    }

    #[test]
    fn adds_only_missing_attributes() {
        let mut x = Xml::new();
        x.start("a").attr("k", "1");
        let more = [
            ("k".to_string(), "2".to_string()),
            ("m".to_string(), "3".to_string()),
        ];
        x.attrs_missing(&more).end();
        assert!(x.finish().ends_with("<a k=\"1\" m=\"3\" />"));
    }

    #[test]
    fn attributes_set_after_observed_values_replace_them() {
        let mut x = Xml::new();
        let observed = [
            ("k".to_string(), "observed".to_string()),
            ("m".to_string(), "3".to_string()),
        ];
        x.start("a")
            .attrs_missing(&observed)
            .attr("k", "read")
            .end();
        assert!(x.finish().ends_with("<a k=\"read\" m=\"3\" />"));
    }

    #[test]
    fn control_characters_become_processing_instructions() {
        let mut x = Xml::new();
        x.start("Content").text("a\u{18}b").end();
        assert!(x.finish().ends_with("<Content>a<?ACE 18?>b</Content>"));
    }

    #[test]
    fn leaves_out_noncharacters_xml_forbids() {
        let mut x = Xml::new();
        x.start("a").attr("k", "x\u{FFFE}\u{FFFD}\u{FFFF}y");
        x.text("p\u{FFFF}q").end();
        assert!(x.finish().ends_with("<a k=\"x\u{FFFD}y\">pq</a>"));
    }

    #[test]
    fn splits_cdata_sections() {
        let mut x = Xml::new();
        x.start("Contents").cdata("abcde", 2).end();
        assert!(
            x.finish()
                .ends_with("\n<Contents><![CDATA[ab]]><![CDATA[cd]]><![CDATA[e]]></Contents>")
        );
    }
}
