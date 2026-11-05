//! Button behaviours: the behaviour list of a form field (chunk 0x15601)
//! and one object per behaviour.
//!
//! Evidence: `docs/format/objects.md`, button behaviours.

use super::*;

/// One behaviour of a form field.
#[derive(Debug, Clone, PartialEq)]
pub struct Behavior {
    pub uid: u32,
    /// Event code of its group: 0x15602 mouse down, 0x15603 mouse up,
    /// 0x15604 mouse enter.
    pub event: u32,
    pub enabled: bool,
    /// The name: a built-in key (`$$$/Forms Action/…`) in every sample.
    pub name: Name,
    /// Chunk 0x156E1.
    pub label: Vec<(String, String)>,
    pub kind: BehaviorKind,
}

/// The type of a behaviour, with its own fields. Zoom codes: 0 inherit
/// zoom, 2 fit window. Operation codes: 0 play, 1 stop.
#[derive(Debug, Clone, PartialEq)]
pub enum BehaviorKind {
    FirstPage {
        zoom: u32,
    },
    NextPage {
        zoom: u32,
    },
    PreviousPage {
        zoom: u32,
    },
    NextView {
        zoom: u32,
    },
    /// `page` is the page index, from 0.
    Page {
        page: u32,
        zoom: u32,
    },
    Anchor {
        file: String,
        anchor: u32,
        zoom: u32,
    },
    /// `None` for a URL stored as a built-in key (flag 1).
    Url(Option<String>),
    OpenFile(String),
    SubmitForm(Option<String>),
    ClearForm,
    PrintForm,
    /// Field UID and whether the field is shown (else hidden).
    ShowHide(Vec<(u32, bool)>),
    /// `state` is the state ID of a go to state behaviour.
    State {
        mso: u32,
        state: i32,
    },
    NextState {
        mso: u32,
    },
    PreviousState {
        mso: u32,
    },
    /// `point` is missing in files from InDesign 3.0.
    Movie {
        item: u32,
        operation: u32,
        point: Option<i32>,
    },
    Sound {
        item: u32,
        operation: u32,
    },
}

impl BehaviorKind {
    /// The IDML element.
    pub fn element(&self) -> &'static str {
        match self {
            BehaviorKind::FirstPage { .. } => "GotoFirstPageBehavior",
            BehaviorKind::NextPage { .. } => "GotoNextPageBehavior",
            BehaviorKind::PreviousPage { .. } => "GotoPreviousPageBehavior",
            BehaviorKind::NextView { .. } => "GotoNextViewBehavior",
            BehaviorKind::Page { .. } => "GotoPageBehavior",
            BehaviorKind::Anchor { .. } => "GotoAnchorBehavior",
            BehaviorKind::Url(_) => "GotoURLBehavior",
            BehaviorKind::OpenFile(_) => "OpenFileBehavior",
            BehaviorKind::SubmitForm(_) => "SubmitFormBehavior",
            BehaviorKind::ClearForm => "ClearFormBehavior",
            BehaviorKind::PrintForm => "PrintFormBehavior",
            BehaviorKind::ShowHide(_) => "ShowHideFieldsBehavior",
            BehaviorKind::State { .. } => "GotoStateBehavior",
            BehaviorKind::NextState { .. } => "GotoNextStateBehavior",
            BehaviorKind::PreviousState { .. } => "GotoPreviousStateBehavior",
            BehaviorKind::Movie { .. } => "MovieBehavior",
            BehaviorKind::Sound { .. } => "SoundBehavior",
        }
    }
}

/// The behaviour classes and their data chunks.
/// Go to last page (0x15614), view zoom (0x156E8) and animation
/// (0x1562F) have no paired sample and are not read.
const CLASSES: [(u32, u32); 17] = [
    (0x15613, 0x15614),
    (0x15615, 0x1561A),
    (0x15616, 0x1561B),
    (0x1561B, 0x15622),
    (0x1562C, 0x1562C),
    (0x15636, 0x15634),
    (0x15664, 0x15650),
    (0x1566E, 0x1565A),
    (0x15678, 0x15664),
    (0x156D3, 0x156F0),
    (0x156DD, 0x15703),
    (0x156F4, 0x1571C),
    (0x15625, 0x156DE),
    (0x1563F, 0x1566D),
    (0x15643, 0x1567D),
    (0x15660, 0x15680),
    (0x156F9, 0x15721),
];

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

/// The groups of chunk 0x15601: u32 group count, then per group u32
/// event code, u32 count and the behaviour UIDs. Returns (event, UID)
/// in group order.
fn parse_list(c: &mut Cursor) -> Result<Vec<(u32, u32)>, Error> {
    let groups = c.u32()? as usize;
    if groups > c.remaining() / 8 {
        return Err(Error::Corrupt(format!("{groups} behaviour groups")));
    }
    let mut out = Vec::new();
    for _ in 0..groups {
        let event = c.u32()?;
        let n = c.u32()? as usize;
        if n > c.remaining() / 4 {
            return Err(Error::Corrupt(format!("{n} behaviours in a group")));
        }
        for _ in 0..n {
            out.push((event, c.u32()?));
        }
    }
    at_end(c)?;
    Ok(out)
}

/// Page navigation fields: u32 navigation kind, u32 page index (go to
/// page only), u32 zoom. Returns the page index and the zoom.
fn navigation(c: &mut Cursor, page: bool) -> Result<(u32, u32), Error> {
    c.u32()?;
    let index = if page { c.u32()? } else { 0 };
    Ok((index, c.u32()?))
}

/// A URL: flag byte and in-object string; `None` for a built-in key.
fn url(c: &mut Cursor) -> Result<Option<String>, Error> {
    let name = c.name()?;
    Ok((!name.builtin).then_some(name.name))
}

/// A behaviour's data chunk, of class `cls`: u32 owner, u32 type code, the
/// name (flag byte, string), u16 enabled, then the type's fields.
fn parse_data(c: &mut Cursor, cls: u32) -> Result<(Name, bool, BehaviorKind), Error> {
    c.u32()?;
    c.u32()?;
    let name = c.name()?;
    let enabled = c.u16()? != 0;
    let kind = match cls {
        0x15613 => BehaviorKind::FirstPage {
            zoom: navigation(c, false)?.1,
        },
        0x15615 => BehaviorKind::NextPage {
            zoom: navigation(c, false)?.1,
        },
        0x15616 => BehaviorKind::PreviousPage {
            zoom: navigation(c, false)?.1,
        },
        0x156DD => BehaviorKind::NextView {
            zoom: navigation(c, false)?.1,
        },
        0x15625 => {
            let (page, zoom) = navigation(c, true)?;
            BehaviorKind::Page { page, zoom }
        }
        0x156D3 => {
            c.flag()?;
            let file = c.string()?;
            let anchor = c.u32()?;
            let zoom = c.u32()?;
            BehaviorKind::Anchor { file, anchor, zoom }
        }
        0x1561B => BehaviorKind::Url(url(c)?),
        0x15678 => {
            c.flag()?;
            BehaviorKind::OpenFile(c.string()?)
        }
        0x1566E => {
            c.u32()?;
            BehaviorKind::SubmitForm(url(c)?)
        }
        0x15664 => BehaviorKind::ClearForm,
        0x156F9 => BehaviorKind::PrintForm,
        0x15636 => {
            let n = c.u32()? as usize;
            if n > c.remaining() / 8 {
                return Err(Error::Corrupt(format!("{n} fields to show or hide")));
            }
            let mut fields = Vec::with_capacity(n);
            for _ in 0..n {
                let uid = c.u32()?;
                let action = c.u32()?;
                if action > 1 {
                    return Err(Error::Corrupt(format!("show/hide action {action}")));
                }
                fields.push((uid, action == 1));
            }
            BehaviorKind::ShowHide(fields)
        }
        0x1563F | 0x15643 | 0x15660 => {
            let mso = c.u32()?;
            c.u32()?;
            c.u16()?;
            c.u16()?;
            let state = c.i32()?;
            match cls {
                0x1563F => BehaviorKind::State { mso, state },
                0x15643 => BehaviorKind::NextState { mso },
                _ => BehaviorKind::PreviousState { mso },
            }
        }
        0x1562C => {
            let item = c.u32()?;
            let operation = c.u32()?;
            let point = if c.remaining() > 0 {
                Some(c.i32()?)
            } else {
                None
            };
            BehaviorKind::Movie {
                item,
                operation,
                point,
            }
        }
        0x156F4 => {
            let item = c.u32()?;
            let operation = c.u32()?;
            c.f64()?;
            c.u32()?;
            BehaviorKind::Sound { item, operation }
        }
        _ => return Err(Error::Corrupt(format!("class {cls:#x} is not a behaviour"))),
    };
    at_end(c)?;
    Ok((name, enabled, kind))
}

impl Reader<'_> {
    /// The behaviours of form field `uid` in the order of chunk 0x15601.
    /// A behaviour that cannot be read is left out with a warning.
    pub(super) fn behaviors(&self, uid: u32) -> Vec<Behavior> {
        let list = match self.chunk(uid, chunk::FORM_BEHAVIORS) {
            Ok(Some(d)) => parse_list(&mut self.cursor(&d)),
            Ok(None) => return Vec::new(),
            Err(e) => Err(e),
        };
        let list = match list {
            Ok(l) => l,
            Err(e) => {
                self.warn(format!("form field {uid}: behaviours left out: {e}"));
                return Vec::new();
            }
        };
        let mut out = Vec::with_capacity(list.len());
        for (event, b) in list {
            match self.behavior(b, event) {
                Ok(Some(b)) => out.push(b),
                Ok(None) => {}
                Err(e) => self.warn(format!("behaviour {b} left out: {e}")),
            }
        }
        out
    }

    /// Behaviour `uid`; `None`, with a warning, for a class that is not
    /// read.
    fn behavior(&self, uid: u32, event: u32) -> Result<Option<Behavior>, Error> {
        let cls = self.class(uid);
        let Some(&(cls, data)) = CLASSES.iter().find(|(c, ..)| Some(*c) == cls) else {
            self.warn(match cls {
                Some(c) => format!("behaviour {uid} left out: class {c:#x} is not read"),
                None => format!("behaviour {uid} left out: no object"),
            });
            return Ok(None);
        };
        let d = self.required(uid, data)?;
        let (name, enabled, kind) = parse_data(&mut self.cursor(&d), cls)?;
        let label = match self.chunk(uid, chunk::BEHAVIOR_LABEL)? {
            Some(d) => self.label_at(&d, 0)?,
            None => Vec::new(),
        };
        Ok(Some(Behavior {
            uid,
            event,
            enabled,
            name,
            label,
            kind,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::synthetic::flagged_string;

    #[test]
    fn behaviors_parse_and_truncated_data_does_not() {
        let le = Encoding::default();
        let mut list = Vec::new();
        for v in [2u32, 0x15603, 2, 0x10, 0x11, 0x15604, 1, 0x12] {
            list.extend_from_slice(&v.to_le_bytes());
        }
        assert_eq!(
            parse_list(&mut le.cursor(&list)).unwrap(),
            [(0x15603, 0x10), (0x15603, 0x11), (0x15604, 0x12)]
        );
        for n in 0..list.len() {
            assert!(parse_list(&mut le.cursor(&list[..n])).is_err());
        }
        // A show/hide behaviour: hide 0x20, show 0x21.
        let mut d = Vec::new();
        for v in [0x400u32, 0x15607] {
            d.extend_from_slice(&v.to_le_bytes());
        }
        d.extend(flagged_string(le, 1, "$$$/Forms Action/Show/Hide Fields"));
        d.extend_from_slice(&1u16.to_le_bytes());
        for v in [2u32, 0x20, 0, 0x21, 1] {
            d.extend_from_slice(&v.to_le_bytes());
        }
        let (name, enabled, kind) = parse_data(&mut le.cursor(&d), 0x15636).unwrap();
        assert!(name.builtin && enabled);
        assert_eq!(
            kind,
            BehaviorKind::ShowHide(vec![(0x20, false), (0x21, true)])
        );
        for n in 0..d.len() {
            assert!(parse_data(&mut le.cursor(&d[..n]), 0x15636).is_err());
        }
        // A count that the data cannot hold.
        let huge = [0xFF, 0xFF, 0xFF, 0xFF, 1, 0, 0, 0];
        assert!(parse_list(&mut le.cursor(&huge)).is_err());
    }
}
