//! Placed movies and sounds (classes 0x14801 and 0x14F01): the child of a
//! frame, with playback settings in chunk 0x14004 and an optional poster
//! image.
//!
//! Evidence: `docs/format/objects.md`, movies and sounds.

use super::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaKind {
    Movie,
    Sound,
}

/// Playback settings (chunk 0x14004). A flag is true when its key is
/// stored with value 1.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct MediaSettings {
    /// Key 0x14000.
    pub name: Option<String>,
    /// Key 0x14002; empty without it.
    pub description: String,
    /// Key 0x14008; empty without it.
    pub controller_skin: String,
    /// Key 0x14003.
    pub custom_poster: bool,
    /// Key 0x14006.
    pub play_on_page_turn: bool,
    /// Key 0x1400C.
    pub show_controller: bool,
    /// Key 0x1400E: `MovieLoop` or `SoundLoop`.
    pub looped: bool,
    /// Key 0x14004.
    pub embed_in_pdf: bool,
    /// Key 0x1400D.
    pub stop_on_page_turn: bool,
}

/// A placed movie or sound.
#[derive(Debug, Clone, PartialEq)]
pub struct Media {
    pub uid: u32,
    pub kind: MediaKind,
    pub transform: Matrix,
    pub paths: Vec<Path>,
    /// Chunk 0x1633: left, top, right, bottom (`GraphicBounds`).
    pub bounds: [f64; 4],
    pub link: Option<Link>,
    pub settings: MediaSettings,
    pub props: ItemProps,
    pub object_style: Option<u32>,
    /// The attribute list (chunk 0x6E03).
    pub attrs: Attrs,
    pub text_wrap: Option<TextWrap>,
    pub label: Vec<(String, String)>,
    /// The poster: the first child that is a placed graphic.
    pub poster: Option<Graphic>,
}

/// Chunk 0x14004: list 1 (u32 count, then u32 key and u16 value per
/// entry), list 2 (u32 values), four lists that are empty in every
/// sample, then list 7 (u32 key, flagged string). Bytes after list 7 are
/// ignored. `Ok((settings, false))` when one of lists 3 to 6 is not empty:
/// the flags read so far, without the strings.
fn media_settings(enc: Encoding, d: &[u8]) -> Result<(MediaSettings, bool), Error> {
    let mut c = enc.cursor(d);
    let mut s = MediaSettings::default();
    for _ in 0..c.u32()? {
        let key = c.u32()?;
        let on = c.u16()? == 1;
        match key {
            0x14003 => s.custom_poster = on,
            0x14004 => s.embed_in_pdf = on,
            0x14006 => s.play_on_page_turn = on,
            0x1400C => s.show_controller = on,
            0x1400D => s.stop_on_page_turn = on,
            0x1400E => s.looped = on,
            _ => {}
        }
    }
    for _ in 0..c.u32()? {
        c.skip(8)?;
    }
    for _ in 0..4 {
        if c.u32()? != 0 {
            return Ok((s, false));
        }
    }
    for _ in 0..c.u32()? {
        let key = c.u32()?;
        c.flag()?;
        let text = c.string()?;
        match key {
            0x14000 => s.name = Some(text),
            0x14002 => s.description = text,
            0x14008 => s.controller_skin = text,
            _ => {}
        }
    }
    Ok((s, true))
}

impl Reader<'_> {
    /// The movie or sound `uid`; `None` for other classes.
    pub(super) fn media(&self, uid: u32) -> Result<Option<Media>, Error> {
        let cls = self.class(uid);
        let kind = match cls {
            Some(class::MOVIE) => MediaKind::Movie,
            Some(class::SOUND) => MediaKind::Sound,
            _ => return Ok(None),
        };
        let transform = match self.chunk(uid, chunk::ITEM_TRANSFORM)? {
            Some(d) => Matrix::read(&mut self.cursor(&d))?,
            None => Matrix::IDENTITY,
        };
        let bounds = match self.chunk(uid, chunk::GRAPHIC_BOUNDS)? {
            Some(d) => {
                let mut c = self.cursor(&d);
                [c.f64()?, c.f64()?, c.f64()?, c.f64()?]
            }
            None => [0.0; 4],
        };
        let link = match self.chunk(uid, chunk::GRAPHIC_LINK)? {
            Some(d) if d.len() >= 12 => self.link(self.cursor(&d[8..]).u32()?)?.map(|(l, _)| l),
            _ => None,
        };
        let settings = match self.chunk(uid, chunk::MEDIA_SETTINGS)? {
            Some(d) => match media_settings(self.enc(), &d) {
                Ok((s, true)) => s,
                Ok((s, false)) => {
                    self.warn(format!(
                        "media {uid}: playback settings of unknown layout; strings left out"
                    ));
                    s
                }
                Err(e) => {
                    self.warn(format!("media {uid}: playback settings left out: {e}"));
                    MediaSettings::default()
                }
            },
            None => MediaSettings::default(),
        };
        let mut poster = None;
        for child in self.children(uid, chunk::ITEM_HIERARCHY)? {
            if let Some(g) = self.graphic(child)? {
                poster = Some(g);
                break;
            }
        }
        Ok(Some(Media {
            uid,
            kind,
            transform,
            paths: self.paths(uid)?,
            bounds,
            link,
            settings,
            props: self.item_props(uid).unwrap_or_else(|e| {
                self.warn(format!("media {uid}: settings left out: {e}"));
                ItemProps::default()
            }),
            object_style: match self.chunk(uid, chunk::ITEM_OBJECT_STYLE)? {
                Some(d) if d.len() >= 4 => uid_or_none(self.cursor(&d).u32()?),
                _ => None,
            },
            attrs: match self.chunk(uid, chunk::ITEM_ATTRS)? {
                Some(d) => self
                    .attrs_or_warn(
                        || format!("media {uid}"),
                        Attrs::parse(self.enc(), &d, List::Item, self.db.recorder()),
                    )
                    .unwrap_or_default(),
                None => Attrs::default(),
            },
            text_wrap: self.text_wrap(uid)?,
            label: self.item_label(uid, cls).unwrap_or_else(|e| {
                self.warn(format!("media {uid}: label left out: {e}"));
                Vec::new()
            }),
            poster,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::synthetic::flagged_string;
    use crate::header::{ByteOrder, Version};

    /// Chunk 0x14004 with the given u16 keys, u32 keys, counts of lists 3
    /// to 6 and string keys.
    fn settings_chunk(
        enc: Encoding,
        flags: &[(u32, u16)],
        strings: &[(u32, &str)],
        middle: [u32; 4],
    ) -> Vec<u8> {
        let mut d = enc.u32_bytes(flags.len() as u32).to_vec();
        for &(k, v) in flags {
            d.extend(enc.u32_bytes(k));
            d.extend(enc.u16_bytes(v));
        }
        d.extend(enc.u32_bytes(1));
        d.extend(enc.u32_bytes(0x140FE));
        d.extend(enc.u32_bytes(5));
        for n in middle {
            d.extend(enc.u32_bytes(n));
        }
        d.extend(enc.u32_bytes(strings.len() as u32));
        for &(k, s) in strings {
            d.extend(enc.u32_bytes(k));
            d.extend(flagged_string(enc, 0, s));
        }
        d
    }

    #[test]
    fn reads_playback_settings() {
        for order in [ByteOrder::Little, ByteOrder::Big] {
            let enc = Encoding::new(
                order,
                Version {
                    major: 10,
                    ..Version::default()
                },
            );
            let d = settings_chunk(
                enc,
                &[(0x14003, 1), (0x1400E, 1), (0x14006, 0)],
                &[(0x14008, "SkinOverAll"), (0x14000, "clip.mp4")],
                [0; 4],
            );
            let (s, complete) = media_settings(enc, &d).unwrap();
            assert!(complete, "{order:?}");
            assert!(s.custom_poster && s.looped && !s.play_on_page_turn);
            assert_eq!(s.name.as_deref(), Some("clip.mp4"));
            assert_eq!(s.controller_skin, "SkinOverAll");
            assert_eq!(s.description, "");
            // Truncated.
            assert!(media_settings(enc, &d[..d.len() - 3]).is_err());
            // A list of unknown type: the flags, without the strings.
            let d = settings_chunk(enc, &[(0x14003, 1)], &[(0x14000, "a")], [0, 1, 0, 0]);
            let (s, complete) = media_settings(enc, &d).unwrap();
            assert!(!complete && s.custom_poster && s.name.is_none());
        }
    }
}
