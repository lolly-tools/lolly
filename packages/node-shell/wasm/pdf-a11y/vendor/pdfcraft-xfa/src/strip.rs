use crate::{CLICK_KEY, Dict, Document, IMAGE_FIELD_KEY, LAYOUT_KEY, NODE_KEY, ObjRef, OVERRIDES_KEY, Object, SOM_KEY, XfaError};

/// What [`strip`] took out, for the user to be told (the packets held more than the fields).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Stripped {
    /// The packets removed, by name (`template`, `datasets`, `config`, `signature`, …).
    pub packets: Vec<String>,
    /// Data values in the datasets no field held (what the form's data had that its fields
    /// didn't show); `None` when the template could not be read to tell.
    pub unbound_data: Option<usize>,
    /// Buttons whose click ran an XFA script, and image fields: they do nothing from now on.
    pub script_buttons: usize,
    pub image_fields: usize,
    /// What the layout left out (pictures, rows past the cap), now for good.
    pub layout_warnings: Vec<String>,
    /// Reader usage rights (`/Perms /UR3`) were removed: changing the form voids them anyway.
    pub usage_rights: bool,
    /// Private keys removed from field dictionaries (`/PCSom`, `/PCXfaClick`, …).
    pub field_keys: usize,
}

impl Stripped {
    /// What was dropped, as lines for the user (empty when nothing worth saying).
    pub fn notes(&self) -> Vec<String> {
        let mut out = Vec::new();
        if !self.packets.is_empty() {
            out.push(format!("The XFA was taken out of the form: its {} packet(s) are gone from the saved file", self.packets.join(", ")));
        }
        match self.unbound_data {
            Some(n) if n > 0 => out.push(format!("{n} value(s) the form's XFA data held that no field showed are gone with it")),
            None => out.push("The template could not be read, so data the fields didn't show may be gone with the XFA".into()),
            _ => {}
        }
        if self.script_buttons + self.image_fields > 0 {
            out.push(format!("{} button(s) that ran XFA scripts and {} image field(s) do nothing now", self.script_buttons, self.image_fields));
        }
        for w in &self.layout_warnings {
            out.push(format!("Kept as laid out: {w}"));
        }
        if self.usage_rights {
            out.push("Adobe Reader extended features were removed (changing the form voids them)".into());
        }
        out
    }
}

/// What a document's XFA entry says, from its dictionaries alone (no packet decoded).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct XfaShape {
    /// `/NeedsRendering true`: the form expects to be laid out from the template.
    pub needs_rendering: bool,
    /// The AcroForm has fields of its own.
    pub has_fields: bool,
    /// PdfCraft laid the form out (the layout mark is there).
    pub laid_out: bool,
}

impl XfaShape {
    /// Whether taking the XFA out leaves a form every viewer shows: the pages PdfCraft laid out
    /// (with their fields), or a static form's own pages and fields. A dynamic form that was
    /// never laid out has only placeholder pages: stripping it would leave nothing.
    pub fn strippable(self) -> bool {
        self.laid_out || (!self.needs_rendering && self.has_fields)
    }
}

/// The document's XFA entry, if any, without decoding a packet.
pub fn xfa_shape(doc: &Document) -> Option<XfaShape> {
    let root = doc.root()?;
    let catalog = doc.get(root);
    let catalog = catalog.as_dict()?;
    let acro = doc.resolve(catalog.get(b"AcroForm")?);
    let acro = acro.as_dict()?;
    acro.get(b"XFA")?;
    let bool_of = |v: Option<&Object>| matches!(v.map(|v| doc.resolve(v)).as_deref(), Some(Object::Bool(true)));
    let needs_rendering = bool_of(catalog.get(b"NeedsRendering")) || bool_of(acro.get(b"NeedsRendering"));
    let has_fields = acro.get(b"Fields").map(|f| doc.resolve(f)).and_then(|f| f.as_array().map(|a| !a.is_empty())).unwrap_or(false);
    Some(XfaShape { needs_rendering, has_fields, laid_out: acro.contains(LAYOUT_KEY) })
}

/// Most field dictionaries walked for their private keys.
const MAX_STRIP_FIELDS: usize = 1_000_000;

/// Take the XFA out of a document, leaving what every viewer shows: the pages as laid out
/// and, when the fields were kept, an ordinary AcroForm. The packets (template, data and
/// all), `/NeedsRendering`, the layout mark, the overrides and Reader usage rights go, and
/// the fields lose the private keys PdfCraft gave them. A flattened form (no fields left)
/// becomes a plain PDF; one with its fields becomes a static form that Adobe's viewers no
/// longer lay out again. What the packets held beyond the fields is counted in the report,
/// so the user can be told; the caller decides whether the form is one to strip
/// ([`XfaShape::strippable`]). A document without XFA is left as it is.
pub fn strip(doc: &mut Document) -> Result<Stripped, XfaError> {
    let mut out = Stripped::default();
    let Some(root) = doc.root() else { return Ok(out) };
    let Some(mut catalog) = doc.get(root).as_dict().cloned() else { return Ok(out) };
    let acro_obj = catalog.get(b"AcroForm").cloned();
    let Some(acro_obj) = acro_obj else { return Ok(out) };
    let Some(mut acro) = doc.resolve(&acro_obj).as_dict().cloned() else { return Ok(out) };
    let Some(xfa) = acro.get(b"XFA").cloned() else { return Ok(out) };
    // What is about to go, while it can still be read.
    let mut streams: Vec<ObjRef> = Vec::new();
    match &*doc.resolve(&xfa) {
        Object::Array(items) => {
            let mut i = 0;
            while i < items.len() {
                let name = items.get(i).and_then(|n| n.as_string()).map(|s| s.to_text());
                let stream = if name.is_some() { items.get(i + 1) } else { items.get(i) };
                if let Some(n) = &name {
                    out.packets.push(n.clone());
                }
                if let Some(r) = stream.and_then(Object::as_ref) {
                    streams.push(r);
                }
                i += if name.is_some() { 2 } else { 1 };
            }
        }
        Object::Stream(_) => {
            if let Some(r) = xfa.as_ref() {
                streams.push(r);
            }
            if out.packets.is_empty() {
                out.packets.push("xdp".into());
            }
        }
        _ => {}
    }
    acro.remove(b"XFA");
    for key in [b"NeedsRendering".as_slice(), LAYOUT_KEY, OVERRIDES_KEY] {
        acro.remove(key);
    }
    // The private keys on every field and widget, down the tree (each dictionary once).
    let fields = acro.get(b"Fields").map(|f| doc.resolve(f)).and_then(|f| f.as_array().cloned()).unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    let mut todo: Vec<ObjRef> = Vec::new();
    for r in fields.iter().filter_map(Object::as_ref) {
        if seen.insert(r) && seen.len() <= MAX_STRIP_FIELDS {
            todo.push(r);
        }
    }
    while let Some(r) = todo.pop() {
        let Some(d) = doc.get(r).as_dict().cloned() else { continue };
        if d.contains(CLICK_KEY) {
            out.script_buttons += 1;
        }
        if d.contains(IMAGE_FIELD_KEY) {
            out.image_fields += 1;
        }
        let private: Vec<Vec<u8>> =
            [SOM_KEY, CLICK_KEY, IMAGE_FIELD_KEY, NODE_KEY, b"PCItems".as_slice()].iter().filter(|k| d.contains(k)).map(|k| k.to_vec()).collect();
        if !private.is_empty() {
            out.field_keys += private.len();
            doc.update_dict(r, |d| {
                for k in &private {
                    d.remove(k);
                }
            })?;
        }
        if let Some(kids) = d.get(b"Kids").map(|k| doc.resolve(k)).and_then(|k| k.as_array().cloned()) {
            for k in kids.iter().filter_map(Object::as_ref) {
                if seen.insert(k) && seen.len() <= MAX_STRIP_FIELDS {
                    todo.push(k);
                }
            }
        }
    }
    match acro_obj.as_ref() {
        Some(r) => doc.set(r, Object::Dict(acro)),
        None => catalog.set(b"AcroForm".to_vec(), Object::Dict(acro)),
    }
    catalog.remove(b"NeedsRendering");
    out.usage_rights = drop_usage_rights(doc, &mut catalog);
    doc.set(root, Object::Dict(catalog));
    // The packet streams are referenced from nowhere else: freed, so an incremental save
    // doesn't carry an unreachable copy of the data.
    for r in streams {
        doc.free(r);
    }
    doc.require_full_save();
    Ok(out)
}

/// Take the usage rights (`/Perms /UR3`, or the older `/UR`) off a catalog, keeping the rest of
/// `/Perms` (a certification's `/DocMDP`). They are signed over the form as it was: once its
/// pages or fields change they are void, and a viewer may lock every field of a form whose
/// usage rights are void, so they go, and the caller says so. Whether there were any.
fn drop_usage_rights(doc: &mut Document, catalog: &mut Dict) -> bool {
    let Some(entry) = catalog.get(b"Perms").cloned() else { return false };
    let Some(mut perms) = doc.resolve(&entry).as_dict().cloned() else { return false };
    if !perms.contains(b"UR3") && !perms.contains(b"UR") {
        return false;
    }
    perms.remove(b"UR3");
    perms.remove(b"UR");
    match entry.as_ref() {
        _ if perms.is_empty() => {
            catalog.remove(b"Perms");
        }
        Some(r) => doc.set(r, Object::Dict(perms)),
        None => catalog.set(b"Perms".to_vec(), Object::Dict(perms)),
    }
    true
}
