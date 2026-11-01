//! Document-level settings and lists: document preferences, bullets,
//! colour group order, index groups, smooth shades, named grids, document
//! users and languages.
//!
//! Evidence: `docs/format/objects.md` and `preferences.md`.

use super::*;

/// A numbering list (class 0x1A483).
#[derive(Debug, Clone, PartialEq)]
pub struct NumberingList {
    pub uid: u32,
    /// The name as IDML writes it.
    pub name: String,
    pub across_stories: bool,
    pub across_documents: bool,
}

/// A pasted smooth shade with a constant shading. See
/// `docs/format/objects.md`, pasted smooth shades.
#[derive(Debug, Clone, PartialEq)]
pub struct ConstantShade {
    pub uid: u32,
    pub count: u32,
    pub values: [f64; 3],
    /// Flag (built-in key) and name.
    pub name: Option<(bool, String)>,
}

/// A pasted smooth shade with an axial shading. See
/// `docs/format/objects.md`, pasted smooth shades.
#[derive(Debug, Clone, PartialEq)]
pub struct AxialShade {
    pub uid: u32,
    /// The six f64 at offset 4 of chunk 0x5532.
    pub matrix: [f64; 6],
    /// The shading data with every field big-endian, as IDML `Contents`
    /// holds it.
    pub data: Vec<u8>,
    /// Flag (built-in key) and name.
    pub name: Option<(bool, String)>,
}

/// Document setup, from chunk 0x533 of the preferences object.
#[derive(Debug, Clone, PartialEq)]
pub struct DocumentPreferences {
    pub page_width: f64,
    pub page_height: f64,
    pub facing_pages: bool,
    /// Top, bottom, inside, outside (stored as inside, top, outside, bottom).
    pub bleed: [f64; 4],
    /// 0 print, 1 web, 2 mobile.
    pub intent: u32,
    /// Page binding (u16 at 64): 0 left to right, 1 right to left.
    pub page_binding: u16,
}

/// Where the fields of the document setup chunk (0x533) are: the
/// 146-byte layout (or longer) and the 126-byte layout of InDesign 7.0
/// and 7.5, which has 16 bytes before the page size and its fields from
/// the facing pages flag on 20 bytes earlier. See
/// `docs/format/preferences.md`, document setup.
pub(super) struct SetupLayout {
    pub page: usize,
    pub facing: usize,
    pub binding: usize,
    /// Inside, top, outside and bottom bleeds, 8 bytes apart.
    pub bleed: usize,
    pub bleed_uniform: usize,
    /// Inside, top, outside and bottom slugs, 8 bytes apart.
    pub slug: usize,
    pub slug_uniform: usize,
    pub intent: usize,
}

impl SetupLayout {
    pub(super) fn of(len: usize) -> Option<SetupLayout> {
        let (page, shift) = match len {
            126 => (16, 20),
            n if n >= 146 => (0, 0),
            _ => return None,
        };
        Some(SetupLayout {
            page,
            facing: 58 - shift,
            binding: 64 - shift,
            bleed: 70 - shift,
            bleed_uniform: 102 - shift,
            slug: 104 - shift,
            slug_uniform: 136 - shift,
            intent: 142 - shift,
        })
    }
}

/// A language object (class 0x2D07), chunk 0x2D0F. See
/// `docs/format/objects.md`, languages.
#[derive(Debug, Clone, PartialEq)]
pub struct Language {
    pub uid: u32,
    pub name: String,
    pub primary: String,
    pub sub: String,
    pub id: u16,
    /// The spelling and hyphenation vendors, each with its flag byte.
    pub vendors: Option<[(u8, String); 2]>,
    /// Single and double quotes (chunk 0x2D26), where the language has
    /// them.
    pub quotes: Option<(String, String)>,
}

/// A bullet character of the document's list (IDML `ABullet`): u32
/// character type, u32 character value, u32 font family (0 = none), the
/// font style as a flag byte and string, then a byte (0 in every sample).
#[derive(Debug, Clone, PartialEq)]
pub struct Bullet {
    /// 0 `UnicodeOnly`, 1 `UnicodeWithFont`, 2 `GlyphWithFont`.
    pub kind: u32,
    pub value: u32,
    pub font: u32,
    pub font_style: Name,
}

impl<'a> Reader<'a> {
    /// The bullet characters in the preferences object (chunk 0x1A488):
    /// u16 1, u32 count, then the bullets.
    pub(super) fn bullets(&self) -> Result<Vec<Bullet>, Error> {
        let Some(&(uid, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Ok(Vec::new());
        };
        let Some(d) = self.chunk(uid, chunk::BULLETS)? else {
            return Ok(Vec::new());
        };
        let mut c = self.cursor(&d);
        if c.u16()? != 1 {
            return Ok(Vec::new());
        }
        let n = c.u32()?;
        let mut out = Vec::new();
        for _ in 0..n {
            let kind = c.u32()?;
            let value = c.u32()?;
            let font = c.u32()?;
            let font_style = c.name()?;
            // 0, or 1 and four bytes of unknown meaning (objects.md).
            match c.u8()? {
                0 => {}
                1 => c.skip(4)?,
                other => {
                    return Err(Error::Corrupt(format!(
                        "bullet font style followed by {other} at {}",
                        c.pos() - 1
                    )));
                }
            }
            out.push(Bullet {
                kind,
                value,
                font,
                font_style,
            });
        }
        Ok(out)
    }

    /// The colour groups listed in the preferences object (chunk 0x1F61).
    pub(super) fn color_group_order(&self) -> Result<Vec<u32>, Error> {
        let Some(&(uid, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Ok(Vec::new());
        };
        self.uid_list(uid, color::chunk::COLOR_GROUPS)
    }

    pub(super) fn document_preferences(&self) -> Result<Option<DocumentPreferences>, Error> {
        let Some(&(uid, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Ok(None);
        };
        let Some(d) = self.chunk(uid, chunk::DOCUMENT_PREFERENCES)? else {
            return Ok(None);
        };
        let Some(l) = SetupLayout::of(d.len()) else {
            self.warn(format!(
                "document preferences of {} bytes are not known; left out",
                d.len()
            ));
            return Ok(None);
        };
        let f = |o: usize| self.cursor(&d[o..]).f64();
        let u = |o: usize| self.cursor(&d[o..]).u32();
        let binding = self.cursor(&d[l.binding..]).u16()?;
        if binding > 1 {
            self.warn(format!(
                "document preferences: page binding code {binding} is not known; left out"
            ));
        }
        let b = l.bleed;
        Ok(Some(DocumentPreferences {
            page_width: f(l.page)?,
            page_height: f(l.page + 8)?,
            facing_pages: d[l.facing] == 2,
            bleed: [f(b + 8)?, f(b + 24)?, f(b)?, f(b + 16)?],
            intent: u(l.intent)?,
            page_binding: binding,
        }))
    }

    /// The document's users, from chunk 0xA443 of the document.
    pub(super) fn users(&self, doc: u32) -> Result<Vec<(u8, String)>, Error> {
        let Some(d) = self.chunk(doc, chunk::DOC_USERS)? else {
            return Ok(Vec::new());
        };
        let mut c = self.cursor(&d);
        let n = c.u32()?;
        if n as usize > d.len() / 9 {
            return Err(Error::Corrupt(format!("{n} document users")));
        }
        (0..n)
            .map(|_| {
                let flag = c.flag()?;
                let name = c.string()?;
                c.u32()?;
                Ok((flag, name))
            })
            .collect()
    }

    /// The numbering lists (preferences chunk 0x1A49B): the default list
    /// first, then the others in stored order. A list whose chunk cannot
    /// be read is left out with a warning. See `docs/format/objects.md`.
    pub(super) fn numbering_lists(&self) -> Result<Vec<NumberingList>, Error> {
        let Some(&(prefs, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Ok(Vec::new());
        };
        let Some(d) = self.chunk(prefs, chunk::NUMBERING_LISTS)? else {
            return Ok(Vec::new());
        };
        let mut c = self.cursor(&d);
        let default = c.u32()?;
        let n = c.u16()? as usize;
        let mut uids = vec![default];
        for _ in 0..n {
            uids.push(c.u32()?);
        }
        let mut out = Vec::new();
        for uid in uids {
            if self.class(uid) != Some(class::NUMBERING_LIST) {
                continue;
            }
            let Some(d) = self.chunk(uid, chunk::NUMBERING_LIST_INFO)? else {
                continue;
            };
            let mut c = self.cursor(&d);
            let read = (|| -> Result<NumberingList, Error> {
                let name = c.name()?.idml();
                let flags = c.bytes(3)?;
                Ok(NumberingList {
                    uid,
                    name,
                    across_stories: flags[0] == 1,
                    across_documents: flags[2] == 1,
                })
            })();
            match read {
                Ok(l) => out.push(l),
                Err(e) => self.warn(format!("numbering list {uid} left out: {e}")),
            }
        }
        Ok(out)
    }

    /// The label of an object (chunk 0x1630B of the document): u16 0x7B7B,
    /// u32 count, then key and value of each pair as a flag byte and an
    /// in-object string. IDML writes the strings as stored, whatever the
    /// flag. See `docs/format/objects.md`.
    pub(super) fn label(&self, uid: u32) -> Result<Vec<(String, String)>, Error> {
        match self.chunk(uid, chunk::DOC_LABEL)? {
            Some(d) => self.label_at(&d, 0),
            None => Ok(Vec::new()),
        }
    }

    /// The label of a page item: in chunk 0x6204 after the shape code
    /// (u16, u32) for frames and shapes, in chunk 0x2C0B for groups and in
    /// chunk 0x14582 for buttons and multi-state objects, with the layout
    /// of the document label. No label without the bytes.
    /// See `docs/format/objects.md`, page item labels.
    pub(super) fn item_label(
        &self,
        uid: u32,
        cls: Option<u32>,
    ) -> Result<Vec<(String, String)>, Error> {
        let (id, at) = match cls {
            Some(class::SPLINE_ITEM) => (chunk::ITEM_SHAPE, 6),
            Some(class::GROUP) => (chunk::GROUP_LABEL, 0),
            Some(class::BUTTON | class::MULTI_STATE) => (chunk::FORM_LABEL, 0),
            Some(class::MOVIE) => (chunk::MOVIE_LABEL, 0),
            Some(class::SOUND) => (chunk::SOUND_LABEL, 0),
            _ => return Ok(Vec::new()),
        };
        match self.chunk(uid, id)? {
            Some(d) if d.len() > at => self.label_at(&d, at),
            _ => Ok(Vec::new()),
        }
    }

    /// A label from byte `at` of `d`: u16 0x7B7B, u32 count, then flagged
    /// key and value strings.
    pub(super) fn label_at(&self, d: &[u8], at: usize) -> Result<Vec<(String, String)>, Error> {
        let mut c = self.cursor(d);
        c.skip(at)?;
        if c.u16()? != 0x7B7B {
            return Err(Error::Corrupt("label of unknown layout".into()));
        }
        let n = c.u32()? as usize;
        if n > d.len() / 8 {
            return Err(Error::Corrupt(format!("{n} label pairs")));
        }
        (0..n)
            .map(|_| Ok((c.name()?.name, c.name()?.name)))
            .collect()
    }

    /// The code and application version string of the last record of
    /// the save history (chunk 0x1D8 of the document): u32 count, then
    /// per session u16 kind, u16 platform, two u16, u16 code, a flag byte
    /// and the application version string, u16 build and a FILETIME (two
    /// u32). `None` when the chunk is missing or empty or does not parse.
    /// See `docs/format/objects.md`, save history.
    pub(super) fn last_session(&self, doc: u32) -> Option<(u16, String)> {
        self.last_record(doc)
            .map(|(_, code, version)| (code, version))
    }

    /// The platform (the second u16) of the last record of the save
    /// history: 0 or 3 (`objects.md`, save history).
    pub(super) fn last_session_platform(&self, doc: u32) -> Option<u16> {
        self.last_record(doc).map(|(platform, ..)| platform)
    }

    /// Platform, code and version string of the last save history record.
    fn last_record(&self, doc: u32) -> Option<(u16, u16, String)> {
        let d = self.chunk(doc, chunk::DOC_HISTORY).ok()??;
        let mut c = self.cursor(&d);
        let n = c.u32().ok()? as usize;
        // A record with an empty string has 25 bytes.
        if n == 0 || n > d.len() / 25 {
            return None;
        }
        let mut last = None;
        for _ in 0..n {
            c.u16().ok()?;
            let platform = c.u16().ok()?;
            c.u16().ok()?;
            c.u16().ok()?;
            let code = c.u16().ok()?;
            c.flag().ok()?;
            let version = c.string().ok()?;
            c.u16().ok()?;
            c.u32().ok()?;
            c.u32().ok()?;
            last = Some((platform, code, version));
        }
        last
    }

    /// The script byte of the last document user's name: the second byte
    /// of its in-object string (`objects.md`, document users). Only read
    /// in little-endian files.
    pub(super) fn users_script(&self, doc: u32) -> Option<u8> {
        if self.enc().big_endian() {
            return None;
        }
        let d = self.chunk(doc, chunk::DOC_USERS).ok()??;
        let mut c = self.cursor(&d);
        let mut last = None;
        for _ in 0..c.u32().ok()? {
            c.flag().ok()?;
            last = d.get(c.pos() + 1).copied();
            c.string().ok()?;
            c.u32().ok()?;
        }
        last
    }

    /// The index sort groups of the preferences object, chunk 0x1307E:
    /// name, include flag and header variant of each group, in stored
    /// order. Empty when the chunk does not parse to its end. See
    /// `docs/format/objects.md`, index sort options.
    pub(super) fn index_groups(&self) -> Vec<(String, bool, Option<String>)> {
        let Some(&(uid, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Vec::new();
        };
        let Ok(Some(d)) = self.chunk(uid, chunk::INDEX_GROUPS) else {
            return Vec::new();
        };
        if self.enc().big_endian() {
            return Vec::new();
        }
        match index_groups(&mut self.cursor(&d)) {
            Ok(g) => g,
            Err(e) => {
                self.warn(format!("index sort options left out: {e}"));
                Vec::new()
            }
        }
    }

    /// The first pasted smooth shade (class 0x5533) whose chunk 0x5532
    /// holds a constant shade: 92 bytes, with u32 28 at offset 60 and then
    /// a u32 and three f64. See `docs/format/objects.md`.
    pub(super) fn constant_shade(&self) -> Option<ConstantShade> {
        let mut uids: Vec<u32> = self
            .db
            .classes()
            .iter()
            .filter(|&&(_, c)| c == class::SMOOTH_SHADE)
            .map(|&(u, _)| u)
            .collect();
        uids.sort_unstable();
        uids.into_iter().find_map(|uid| {
            let d = self.chunk(uid, chunk::SMOOTH_SHADE).ok()??;
            if d.len() != 92 || self.enc().u32_at(&d, 60) != Some(28) {
                return None;
            }
            Some(ConstantShade {
                uid,
                count: self.enc().u32_at(&d, 64)?,
                values: [
                    self.enc().f64_at(&d, 68)?,
                    self.enc().f64_at(&d, 76)?,
                    self.enc().f64_at(&d, 84)?,
                ],
                name: self.shade_name(uid),
            })
        })
    }

    /// The name of a pasted smooth shade (chunk 0x5531): flag and name.
    fn shade_name(&self, uid: u32) -> Option<(bool, String)> {
        let n = self.chunk(uid, chunk::SMOOTH_SHADE_NAME).ok()??;
        let mut c = self.cursor(&n);
        let builtin = c.flag().ok()? == 1;
        Some((builtin, c.string().ok()?))
    }

    /// The pasted smooth shades (class 0x5533) whose chunk 0x5532 holds an
    /// axial shading (type 5 at offset 56), in UID order. A shading whose
    /// data does not follow the known grammar is left out with a warning.
    /// See `docs/format/objects.md`, pasted smooth shades.
    pub(super) fn axial_shades(&self) -> Vec<AxialShade> {
        let mut uids: Vec<u32> = self
            .db
            .classes()
            .iter()
            .filter(|&&(_, c)| c == class::SMOOTH_SHADE)
            .map(|&(u, _)| u)
            .collect();
        uids.sort_unstable();
        let mut out = Vec::new();
        for uid in uids {
            let Ok(Some(d)) = self.chunk(uid, chunk::SMOOTH_SHADE) else {
                continue;
            };
            let enc = self.enc();
            if d.len() < 64 || enc.u32_at(&d, 56) != Some(5) {
                continue;
            }
            let n = enc.u32_at(&d, 60).unwrap_or(0) as usize;
            let read = (|| -> Result<AxialShade, Error> {
                if d.len() != 64 + n {
                    return Err(Error::Corrupt(format!(
                        "{} bytes of shading data in a chunk of {}",
                        n,
                        d.len()
                    )));
                }
                let mut c = self.cursor(&d[4..]);
                let mut matrix = [0.0; 6];
                for m in &mut matrix {
                    *m = c.f64()?;
                }
                Ok(AxialShade {
                    uid,
                    matrix,
                    data: axial_shading_be(enc, &d[64..])?,
                    name: self.shade_name(uid),
                })
            })();
            match read {
                Ok(s) => out.push(s),
                Err(e) => self.warn(format!("pasted smooth shade {uid} left out: {e}")),
            }
        }
        out
    }

    /// The named grids, in UID order: built-in key, name and the grid's
    /// own settings (chunk 0xCD02, which only grids made by the user
    /// have; objects.md, named grids).
    pub(super) fn named_grids(&self) -> Vec<NamedGrid> {
        let mut out = Vec::new();
        for &(uid, cls) in self.db.classes() {
            if cls != class::NAMED_GRID {
                continue;
            }
            let read = (|| -> Result<Option<NamedGrid>, Error> {
                let Some(d) = self.chunk(uid, chunk::NAMED_GRID)? else {
                    return Ok(None);
                };
                let mut c = self.cursor(&d);
                c.u32()?;
                let builtin = c.flag()? == 1;
                let name = c.string()?;
                let grid = match self.chunk(uid, chunk::PAGE_GRID)? {
                    Some(d) => Some(GridData::read(&mut self.cursor(&d))?),
                    None => None,
                };
                Ok(Some(NamedGrid {
                    uid,
                    builtin,
                    name,
                    grid,
                }))
            })();
            match read {
                Ok(Some(g)) => out.push(g),
                Ok(None) => {}
                Err(e) => self.warn(format!("named grid {uid} left out: {e}")),
            }
        }
        out
    }

    /// The named grid applied to a story or object style (chunk 0xCD32;
    /// objects.md, named grids): `Some(None)` for none (no chunk or u16
    /// 0), `Some(Some(uid))` for a grid, `None` for another layout.
    pub(super) fn applied_named_grid(&self, uid: u32) -> Result<Option<Option<u32>>, Error> {
        let Some(d) = self.chunk(uid, chunk::APPLIED_NAMED_GRID)? else {
            return Ok(Some(None));
        };
        let enc = self.enc();
        Ok(match enc.u16_at(&d, 0) {
            Some(0) => Some(None),
            Some(1) => enc.u32_at(&d, 2).map(Some),
            _ => None,
        })
    }
}

impl<'a> Reader<'a> {
    /// A language object (class 0x2D07): its name, and the full language
    /// if the rest of chunk 0x2D0F can be read. `None` if it has no name.
    pub(super) fn language(&self, uid: u32) -> Result<Option<(String, Option<Language>)>, Error> {
        let Some(d) = self.chunk(uid, chunk::LANGUAGE_NAME)? else {
            return Ok(None);
        };
        if d.len() <= 1 {
            return Ok(None);
        }
        let mut c = self.cursor(&d);
        c.flag()?;
        let name = c.string()?;
        // Then the primary and secondary names, u16 ID, and two vendors
        // (flag, u32, string).
        let rest = (|| -> Result<_, Error> {
            c.flag()?;
            let primary = c.string()?;
            c.flag()?;
            let sub = c.string()?;
            let id = c.u16()?;
            let mut vendor = || -> Result<(u8, String), Error> {
                let flag = c.u8()?;
                c.u32()?;
                Ok((flag, c.string()?))
            };
            let spelling = vendor()?;
            let hyphenation = vendor()?;
            Ok((primary, sub, id, [spelling, hyphenation]))
        })();
        // Quotes (chunk 0x2D26): flag byte, the language name, then the
        // two single and the two double quotes as UTF-16 units.
        let quotes = match self.chunk(uid, chunk::LANGUAGE_QUOTES)? {
            Some(q) => (|| -> Result<(String, String), Error> {
                let mut c = self.cursor(&q);
                c.flag()?;
                c.string()?;
                let mut unit = || -> Result<char, Error> {
                    char::from_u32(u32::from(c.u16()?))
                        .ok_or_else(|| Error::Corrupt("quote is not a character".into()))
                };
                let single: String = [unit()?, unit()?].into_iter().collect();
                let double: String = [unit()?, unit()?].into_iter().collect();
                Ok((single, double))
            })()
            .ok(),
            None => None,
        };
        let language = rest.ok().map(|(primary, sub, id, vendors)| Language {
            uid,
            name: name.clone(),
            primary,
            sub,
            id,
            vendors: Some(vendors),
            quotes,
        });
        Ok(Some((name, language)))
    }
}

/// A u32 length in UTF-16 units, then text segments.
fn counted_string(c: &mut crate::object::Cursor) -> Result<String, Error> {
    let n = c.u32()? as usize;
    if n == 0 {
        Ok(String::new())
    } else {
        c.segments(n)
    }
}

/// The groups of chunk 0x1307E (`objects.md`, index sort options): for
/// each, a flagged name, u8 include, u8, u16 header variant (an index into
/// the variant list), u16 and its header variants with their sections.
/// Returns name, include and the name of the chosen variant (the first
/// string of its record) of each group.
fn index_groups(
    c: &mut crate::object::Cursor,
) -> Result<Vec<(String, bool, Option<String>)>, Error> {
    let count = c.u32()?;
    let mut out = Vec::new();
    for _ in 0..count {
        c.u8()?;
        let name = c.string()?;
        let include = c.u8()? != 0;
        c.u8()?;
        let variant = c.u16()?;
        c.u16()?;
        let mut chosen = None;
        for i in 0..c.u32()? {
            c.u8()?;
            let variant_name = c.string()?;
            if i == u32::from(variant) {
                chosen = Some(variant_name);
            }
            c.u8()?;
            c.string()?;
            counted_string(c)?;
            c.skip(2)?;
            for _ in 0..c.u32()? {
                counted_string(c)?;
                counted_string(c)?;
                c.u8()?;
                c.string()?;
                c.u16()?;
            }
        }
        out.push((name, include, chosen));
    }
    if c.remaining() != 0 {
        return Err(Error::Corrupt(format!("{} bytes left", c.remaining())));
    }
    Ok(out)
}

/// The data of an axial shading with each field in big-endian order, as
/// IDML `Contents` holds it. `data` must follow the grammar of
/// `docs/format/objects.md`, pasted smooth shades, to its end, with the
/// values every sample has where the grammar names one.
fn axial_shading_be(enc: Encoding, data: &[u8]) -> Result<Vec<u8>, Error> {
    let mut c = enc.cursor(data);
    let mut out = Vec::with_capacity(data.len());
    let bad = |what: &str, v: u32| Error::Corrupt(format!("shading {what} {v} is not known"));
    fn u16s(c: &mut Cursor, out: &mut Vec<u8>, n: usize) -> Result<(), Error> {
        for _ in 0..n {
            out.extend(c.u16()?.to_be_bytes());
        }
        Ok(())
    }
    fn u32_be(c: &mut Cursor, out: &mut Vec<u8>) -> Result<u32, Error> {
        let v = c.u32()?;
        out.extend(v.to_be_bytes());
        Ok(v)
    }
    fn f64s(c: &mut Cursor, out: &mut Vec<u8>, n: usize) -> Result<(), Error> {
        if n > c.remaining() / 8 {
            return Err(Error::Corrupt(format!("{n} shading numbers")));
        }
        for _ in 0..n {
            out.extend(c.f64()?.to_be_bytes());
        }
        Ok(())
    }
    let expect = |c: &mut Cursor, out: &mut Vec<u8>, what: &str, v: u32| {
        let got = u32_be(c, out)?;
        if got == v {
            Ok(())
        } else {
            Err(bad(what, got))
        }
    };
    f64s(&mut c, &mut out, 6)?;
    u16s(&mut c, &mut out, 4)?;
    expect(&mut c, &mut out, "colour space", 2)?;
    let functions = u32_be(&mut c, &mut out)? as usize;
    if functions > c.remaining() / 50 {
        return Err(Error::Corrupt(format!("{functions} shading functions")));
    }
    for _ in 0..functions {
        expect(&mut c, &mut out, "function type", 0)?;
        expect(&mut c, &mut out, "function inputs", 1)?;
        expect(&mut c, &mut out, "function outputs", 1)?;
        // Domain and range: u16, u32 count, pairs of f64; encode: u32,
        // u32 count, pairs; decode: u32 count, pairs.
        for lead in [2, 2, 4, 0] {
            match lead {
                2 => u16s(&mut c, &mut out, 1)?,
                4 => {
                    u32_be(&mut c, &mut out)?;
                }
                _ => {}
            }
            let n = u32_be(&mut c, &mut out)? as usize;
            f64s(&mut c, &mut out, n.saturating_mul(2))?;
        }
        u16s(&mut c, &mut out, 1)?;
        u32_be(&mut c, &mut out)?;
        expect(&mut c, &mut out, "bits per sample", 8)?;
        let samples = u32_be(&mut c, &mut out)? as usize;
        out.extend(c.bytes(samples)?);
    }
    expect(&mut c, &mut out, "extend code", 4)?;
    f64s(&mut c, &mut out, 6)?;
    expect(&mut c, &mut out, "end code", 2)?;
    u16s(&mut c, &mut out, 2)?;
    if c.remaining() != 0 {
        return Err(Error::Corrupt(format!(
            "{} bytes after the shading data",
            c.remaining()
        )));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::synthetic;
    use crate::object::Encoding;

    /// A save history with one record per code.
    fn history(codes: &[u16]) -> Vec<u8> {
        let mut d = (codes.len() as u32).to_le_bytes().to_vec();
        for &code in codes {
            for v in [7u16, 0, 10, 0, code] {
                d.extend_from_slice(&v.to_le_bytes());
            }
            d.extend(synthetic::flagged_string(
                Encoding::default(),
                1,
                "16.1.0.20",
            ));
            d.extend_from_slice(&20u16.to_le_bytes());
            d.extend_from_slice(&[0; 8]);
        }
        d
    }

    fn last_code(chunk: Option<Vec<u8>>) -> Option<u16> {
        let chunks = synthetic::chunks(
            &chunk
                .into_iter()
                .map(|d| (chunk::DOC_HISTORY, d))
                .collect::<Vec<_>>(),
        );
        let objects = [(1, class::DOCUMENT, chunks)];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        Reader::new(&db).last_session(1).map(|(code, _)| code)
    }

    fn applied_grid(chunk: Option<Vec<u8>>) -> Option<Option<u32>> {
        let chunks = synthetic::chunks(
            &chunk
                .into_iter()
                .map(|d| (chunk::APPLIED_NAMED_GRID, d))
                .collect::<Vec<_>>(),
        );
        let objects = [(1, class::DOCUMENT, chunks)];
        let bytes = synthetic::image(&objects);
        let db = synthetic::database(&bytes, &objects);
        Reader::new(&db).applied_named_grid(1).unwrap()
    }

    #[test]
    fn reads_the_applied_named_grid() {
        let grid = [1u16.to_le_bytes().as_slice(), &0x2Au32.to_le_bytes()].concat();
        assert_eq!(applied_grid(Some(grid)), Some(Some(0x2A)));
        assert_eq!(applied_grid(Some(0u16.to_le_bytes().to_vec())), Some(None));
        assert_eq!(applied_grid(None), Some(None));
        assert_eq!(applied_grid(Some(2u16.to_le_bytes().to_vec())), None);
        assert_eq!(applied_grid(Some(1u16.to_le_bytes().to_vec())), None);
    }

    #[test]
    fn reads_a_shape_label_as_stored() {
        let enc = Encoding::default();
        let mut d = [1u16.to_le_bytes().as_slice(), &3u32.to_le_bytes()].concat();
        d.extend_from_slice(&0x7B7Bu16.to_le_bytes());
        d.extend_from_slice(&1u32.to_le_bytes());
        d.extend(synthetic::flagged_string(enc, 1, "Key"));
        d.extend(synthetic::flagged_string(enc, 0, "Value"));
        let label = |d: Vec<u8>| {
            let objects = [(
                2,
                class::SPLINE_ITEM,
                synthetic::chunks(&[(chunk::ITEM_SHAPE, d)]),
            )];
            let bytes = synthetic::image(&objects);
            let db = synthetic::database(&bytes, &objects);
            Reader::new(&db)
                .item_label(2, Some(class::SPLINE_ITEM))
                .ok()
        };
        let pair = vec![("Key".to_string(), "Value".to_string())];
        assert_eq!(label(d.clone()), Some(pair));
        assert_eq!(label(d[..6].to_vec()), Some(Vec::new()));
        d.truncate(d.len() - 1);
        assert_eq!(label(d), None);
    }

    #[test]
    fn reads_the_code_of_the_last_session() {
        assert_eq!(last_code(Some(history(&[0x0100, 0x0101]))), Some(0x0101));
        assert_eq!(last_code(Some(history(&[0x0101, 0x0100]))), Some(0x0100));
        assert_eq!(last_code(Some(history(&[]))), None);
        assert_eq!(last_code(None), None);
        let mut cut = history(&[0x0101]);
        cut.pop();
        assert_eq!(last_code(Some(cut)), None);
    }
}

#[cfg(test)]
mod shading_tests {
    use super::*;

    /// The fields of an axial shading with one sampled function, as
    /// (width, value) pairs: 2, 4 or 8 bytes, or 1 for a sample byte.
    fn fields() -> Vec<(usize, u64)> {
        let f = |v: f64| (8, v.to_bits());
        let mut v = vec![f(0.0), f(0.0), f(1.0), f(0.0), f(0.0), f(1.0)];
        v.extend([(2, 1), (2, 0), (2, 1), (2, 0), (4, 2), (4, 1)]);
        v.extend([(4, 0), (4, 1), (4, 1)]);
        for lead in [2, 2, 4, 0] {
            if lead > 0 {
                v.push((lead, 0));
            }
            v.extend([(4, 1), f(0.0), f(1.0)]);
        }
        v.extend([(2, 0), (4, 2), (4, 8), (4, 2), (1, 0x10), (1, 0xF0)]);
        v.extend([(4, 4), f(1.0), f(0.0), f(0.0), f(1.0), f(0.0), f(0.0)]);
        v.extend([(4, 2), (2, 1), (2, 1)]);
        v
    }

    fn bytes(fields: &[(usize, u64)], big: bool) -> Vec<u8> {
        let mut out = Vec::new();
        for &(w, v) in fields {
            let b = if big {
                v.to_be_bytes()
            } else {
                v.to_le_bytes()
            };
            out.extend(if big { &b[8 - w..] } else { &b[..w] });
        }
        out
    }

    #[test]
    fn writes_an_axial_shading_big_endian() {
        let f = fields();
        let le = bytes(&f, false);
        let got = axial_shading_be(Encoding::default(), &le).unwrap();
        assert_eq!(got, bytes(&f, true));
        // A byte left over, or a colour space other than 2, is refused.
        let mut long = le.clone();
        long.push(0);
        assert!(axial_shading_be(Encoding::default(), &long).is_err());
        let mut space = le;
        space[56] = 3;
        assert!(axial_shading_be(Encoding::default(), &space).is_err());
    }
}
