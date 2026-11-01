//! Animation: motion presets, timing lists of spreads and buttons, and
//! the animation settings of page items.
//!
//! Evidence: `docs/format/objects.md`, animation and timing.

use super::*;

/// A motion preset (class 0x20517, chunk 0x20532).
#[derive(Debug, Clone, PartialEq)]
pub struct MotionPreset {
    pub uid: u32,
    pub name: Name,
    /// The preset's XML (IDML `Properties/Contents`).
    pub contents: String,
}

/// One timing list of a spread or button (chunks 0x2056D and 0x2056E).
#[derive(Debug, Clone, PartialEq)]
pub struct TimingList {
    /// Trigger code: 1 on page load, 5 on click, 6 on release, 7 on
    /// rollover.
    pub trigger: u32,
    pub groups: Vec<TimingGroup>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TimingGroup {
    pub plays: u32,
    pub targets: Vec<TimingTarget>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TimingTarget {
    pub uid: u32,
    pub role: u32,
    pub action: u32,
    /// Delay in seconds.
    pub delay: f64,
}

/// The animation of a page item (chunk 0x2055F).
#[derive(Debug, Clone, PartialEq)]
pub struct Animation {
    pub custom: bool,
    /// The motion preset's UID.
    pub preset: u32,
    /// Seconds.
    pub duration: f64,
    /// Design option code: 0 from current appearance, 2 to current
    /// location.
    pub design: u32,
    pub plays: u32,
    /// Ease code: 0 none, 4 custom.
    pub ease: u32,
    pub offsets: [f64; 2],
    /// Motion path key frames: frame, x, y.
    pub path: Vec<(u32, f64, f64)>,
    /// Points of a motion path without key frames.
    pub points: Vec<(f64, f64)>,
    /// Animated properties by stored name, with their keys (frame,
    /// value).
    pub properties: Vec<(String, Vec<(u32, f64)>)>,
}

fn at_end(c: &Cursor) -> Result<(), Error> {
    if c.remaining() == 0 {
        Ok(())
    } else {
        Err(Error::Corrupt(format!(
            "{} bytes left after the data at {}",
            c.remaining(),
            c.pos()
        )))
    }
}

/// A text string: u32 length in UTF-16 code units, then segments.
fn text(c: &mut Cursor) -> Result<String, Error> {
    let n = c.u32()? as usize;
    c.segments(n)
}

impl TimingList {
    /// The timing lists of chunk 0x2056D or 0x2056E, which must parse to
    /// its end.
    pub fn read_all(c: &mut Cursor) -> Result<Vec<TimingList>, Error> {
        parse_timing(c)
    }
}

impl Animation {
    /// The animation in chunk 0x2055F longer than two bytes, which must
    /// parse to its end.
    pub fn read(c: &mut Cursor) -> Result<Animation, Error> {
        parse_animation(c)
    }
}

fn parse_timing(c: &mut Cursor) -> Result<Vec<TimingList>, Error> {
    let lists = c.u32()?;
    let mut out = Vec::new();
    for _ in 0..lists {
        let trigger = c.u32()?;
        let groups = c.u32()?;
        let mut list = TimingList {
            trigger,
            groups: Vec::new(),
        };
        for _ in 0..groups {
            let n = c.u32()?;
            let mut targets = Vec::new();
            for _ in 0..n {
                let uid = c.u32()?;
                let role = c.u32()?;
                let action = c.u32()?;
                c.u32()?;
                let delay = c.f64()?;
                targets.push(TimingTarget {
                    uid,
                    role,
                    action,
                    delay,
                });
            }
            let plays = c.u32()?;
            c.u16()?;
            list.groups.push(TimingGroup { plays, targets });
        }
        out.push(list);
    }
    at_end(c)?;
    Ok(out)
}

fn parse_animation(c: &mut Cursor) -> Result<Animation, Error> {
    c.u16()?;
    let custom = c.u16()? == 1;
    let preset = c.u32()?;
    let duration = c.f64()?;
    // Frames per second and frames.
    c.skip(8)?;
    let design = c.u32()?;
    c.u32()?;
    let plays = c.u32()?;
    c.u16()?;
    let ease = c.u32()?;
    let offsets = [c.f64()?, c.f64()?];
    let mut path = Vec::new();
    for _ in 0..c.u32()? {
        let frame = c.u32()?;
        c.u32()?;
        path.push((frame, c.f64()?, c.f64()?));
    }
    let mut points = Vec::new();
    for _ in 0..c.u32()? {
        c.u32()?;
        points.push((c.f64()?, c.f64()?));
    }
    let mut properties = Vec::new();
    for _ in 0..c.u32()? {
        let name = text(c)?;
        text(c)?;
        let mut keys = Vec::new();
        for _ in 0..c.u32()? {
            let frame = c.u32()?;
            c.u32()?;
            keys.push((frame, c.f64()?));
        }
        properties.push((name, keys));
    }
    at_end(c)?;
    Ok(Animation {
        custom,
        preset,
        duration,
        design,
        plays,
        ease,
        offsets,
        path,
        points,
        properties,
    })
}

impl Reader<'_> {
    /// The timing lists of a spread or button in chunk `id`; none, with a
    /// warning, if the chunk does not parse.
    pub(super) fn timing(&self, uid: u32, id: u32) -> Vec<TimingList> {
        let d = match self.chunk(uid, id) {
            Ok(Some(d)) => d,
            Ok(None) => return Vec::new(),
            Err(e) => {
                self.warn(format!("object {uid}: timing left out: {e}"));
                return Vec::new();
            }
        };
        parse_timing(&mut self.cursor(&d)).unwrap_or_else(|e| {
            self.warn(format!("object {uid}: timing left out: {e}"));
            Vec::new()
        })
    }

    /// The animation of a page item; `None` without one, or with a
    /// warning if chunk 0x2055F does not parse.
    pub(super) fn animation(&self, uid: u32) -> Option<Animation> {
        let d = match self.chunk(uid, chunk::ANIMATION) {
            Ok(Some(d)) if d.len() > 2 => d,
            Ok(_) => return None,
            Err(e) => {
                self.warn(format!("item {uid}: animation left out: {e}"));
                return None;
            }
        };
        parse_animation(&mut self.cursor(&d))
            .map_err(|e| self.warn(format!("item {uid}: animation left out: {e}")))
            .ok()
    }

    /// The motion presets listed in chunk 0x2053E of the preferences
    /// object, in that order. A preset that cannot be read is left out
    /// with a warning.
    pub(super) fn motion_presets(&self) -> Vec<MotionPreset> {
        let Some(&(prefs, _)) = self
            .db
            .classes()
            .iter()
            .find(|(_, c)| *c == class::PREFERENCES)
        else {
            return Vec::new();
        };
        let uids = match self.uid_list(prefs, chunk::PRESET_LIST) {
            Ok(u) => u,
            Err(e) => {
                self.warn(format!("motion presets left out: {e}"));
                return Vec::new();
            }
        };
        let mut out = Vec::new();
        for uid in uids {
            let read = || -> Result<MotionPreset, Error> {
                if self.class(uid) != Some(class::MOTION_PRESET) {
                    return Err(Error::Corrupt("not a motion preset".into()));
                }
                let d = self.required(uid, chunk::PRESET_DATA)?;
                let mut c = self.cursor(&d);
                let contents = text(&mut c)?;
                c.skip(4)?;
                c.name()?;
                let name = c.name()?;
                at_end(&c)?;
                Ok(MotionPreset {
                    uid,
                    name,
                    contents,
                })
            };
            match read() {
                Ok(p) => out.push(p),
                Err(e) => self.warn(format!("motion preset {uid} left out: {e}")),
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncated_chunks_do_not_parse() {
        let le = Encoding::default();
        // One list, one group, one target (objects.md).
        let mut t = Vec::new();
        for v in [1u32, 1, 1, 1, 0x463, 0x20503, 0x20501, 0] {
            t.extend_from_slice(&v.to_le_bytes());
        }
        t.extend_from_slice(&0f64.to_le_bytes());
        t.extend_from_slice(&1u32.to_le_bytes());
        t.extend_from_slice(&0u16.to_le_bytes());
        assert_eq!(parse_timing(&mut le.cursor(&t)).unwrap().len(), 1);
        for n in 0..t.len() {
            assert!(parse_timing(&mut le.cursor(&t[..n])).is_err());
        }
        let mut longer = t.clone();
        longer.push(0);
        assert!(parse_timing(&mut le.cursor(&longer)).is_err());
        // A count that the data cannot hold.
        let huge = [0xFF, 0xFF, 0xFF, 0xFF, 1, 0, 0, 0];
        assert!(parse_animation(&mut le.cursor(&huge)).is_err());
        assert!(parse_timing(&mut le.cursor(&huge)).is_err());
    }
}
