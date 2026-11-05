//! Colours and swatches. See `docs/format/objects.md`.

use crate::Error;
use crate::object::{Name, builtin_key};

pub mod class {
    pub const COLOR: u32 = 0x1F05;
    pub const SWATCH_NONE: u32 = 0x6E0B;
    pub const GRADIENT: u32 = 0x5503;
    pub const INK: u32 = 0x1F07;
    pub const COLOR_GROUP: u32 = 0x1F39;
}

pub mod chunk {
    /// Spot colours of a mixed ink: u32 count, then colour UIDs.
    pub const MIXED_INK_SPOTS: u32 = 0x102D;
    pub const COLOR_VALUE: u32 = 0x1F01;
    pub const COLOR_MODEL: u32 = 0x1F09;
    pub const COLOR_NAME: u32 = 0x1F10;
    /// Alternate colour: as 0x1F01.
    pub const COLOR_ALTERNATE: u32 = 0x1F0A;
    /// f64 tint value (−1 for colours), then u32 colour override.
    pub const COLOR_OVERRIDE: u32 = 0x1F24;
    /// Base colour of a tint.
    pub const TINT_BASE: u32 = 0x117;
    pub const GRADIENT_STOPS: u32 = 0x5503;
    pub const GRADIENT_NAME: u32 = 0x5505;
    pub const INK: u32 = 0x1F0D;
    pub const COLOR_GROUP_NAME: u32 = 0x13C;
    pub const COLOR_GROUP_SWATCHES: u32 = 0x1F60;
    /// In the preferences object: u32 list of the colour groups, the root
    /// group first.
    pub const COLOR_GROUPS: u32 = 0x1F61;
}

#[derive(Debug, Clone, PartialEq)]
pub struct GradientStop {
    pub color: u32,
    /// 0–1.
    pub location: f64,
    /// Position of the midpoint between this stop and the next one, 0–1,
    /// measured from the start of the gradient.
    pub midpoint: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Gradient {
    pub uid: u32,
    pub name: String,
    pub builtin_name: bool,
    /// 1 linear, 2 radial.
    pub kind: u32,
    pub stops: Vec<GradientStop>,
    pub editable: bool,
    pub removable: bool,
    pub visible: bool,
}

impl Gradient {
    pub fn reference(&self) -> String {
        if self.name.is_empty() {
            format!("Gradient/u{:x}", self.uid)
        } else {
            format!(
                "Gradient/{}",
                self.name
                    .replace('%', "%25")
                    .replace(':', "%3a")
                    .replace('\r', "%0d")
            )
        }
    }

    /// IDML `Midpoint` of stop `i` (from 1): the midpoint between stops
    /// `i`−1 and `i`, in percent of the distance between them. `None` for
    /// the first stop, and when the value is outside the 13–87 that IDML
    /// allows.
    pub fn idml_midpoint(&self, i: usize) -> Option<f64> {
        let (prev, stop) = (self.stops.get(i.checked_sub(1)?)?, self.stops.get(i)?);
        let m = (prev.midpoint - prev.location) / (stop.location - prev.location) * 100.0;
        // Rounded as IDML writes it, so that 12.9999999 counts as 13.
        let m = crate::idml::round(m);
        (13.0..=87.0).contains(&m).then_some(m)
    }

    pub fn idml_name(&self) -> String {
        if self.builtin_name {
            builtin_key(&self.name)
        } else {
            self.name.clone()
        }
    }

    pub fn read(uid: u32, obj: &crate::Object) -> Result<Option<Gradient>, Error> {
        let enc = obj.encoding;
        let (Some(stops), Some(name)) = (
            obj.chunk(chunk::GRADIENT_STOPS),
            obj.chunk(chunk::GRADIENT_NAME),
        ) else {
            return Ok(None);
        };
        let mut c = enc.cursor(stops);
        let n = c.u16()? as usize;
        let colors = (0..n).map(|_| c.u32()).collect::<Result<Vec<_>, _>>()?;
        let locations = (0..n).map(|_| c.f64()).collect::<Result<Vec<_>, _>>()?;
        let midpoints = (0..n).map(|_| c.f64()).collect::<Result<Vec<_>, _>>()?;
        let kind = c.u32()?;
        let mut nc = enc.cursor(name);
        let builtin_name = nc.flag()? == 1;
        let name = nc.string()?;
        let flags = nc.u32()?;
        Ok(Some(Gradient {
            uid,
            name,
            builtin_name,
            kind,
            stops: (0..n)
                .map(|i| GradientStop {
                    color: colors[i],
                    location: locations[i],
                    midpoint: midpoints[i],
                })
                .collect(),
            removable: flags & 1 != 0,
            visible: flags & 2 != 0,
            editable: flags & 4 != 0,
        }))
    }
}

/// A tint swatch: a colour object with a base colour and a tint value
/// instead of a name and colour values.
#[derive(Debug, Clone, PartialEq)]
pub struct Tint {
    pub uid: u32,
    pub base: u32,
    /// Percent.
    pub value: f64,
    pub color_override: u32,
}

impl Tint {
    pub fn read(uid: u32, obj: &crate::Object) -> Result<Option<Tint>, Error> {
        let enc = obj.encoding;
        if obj.chunk(chunk::COLOR_NAME).is_some() {
            return Ok(None);
        }
        let (Some(base), Some(tint)) = (
            obj.chunk(chunk::TINT_BASE),
            obj.chunk(chunk::COLOR_OVERRIDE),
        ) else {
            return Ok(None);
        };
        let base = enc.cursor(base).u32()?;
        let mut c = enc.cursor(tint);
        let value = c.f64()?;
        let color_override = c.u32()?;
        if base == 0 || value < 0.0 {
            return Ok(None);
        }
        Ok(Some(Tint {
            uid,
            base,
            value,
            color_override,
        }))
    }

    /// IDML `Name`: the base colour's name and the tint value, with the
    /// black swatch written as `[Black]`.
    pub fn idml_name(&self, base: &Color) -> String {
        if base.color_override == 2 {
            self.named(&format!("[{}]", base.name))
        } else {
            self.named(&base.name)
        }
    }

    /// The name of this tint of a colour written `base`.
    pub fn named(&self, base: &str) -> String {
        format!("{base} {}%", crate::idml::num(self.value))
    }

    pub fn reference(&self, base: &Color) -> String {
        Self::reference_of(&self.idml_name(base))
    }

    /// The `Tint/…` reference of a tint named `name`.
    pub fn reference_of(name: &str) -> String {
        format!(
            "Tint/{}",
            name.replace('%', "%25")
                .replace(':', "%3a")
                .replace('\r', "%0d")
        )
    }

    pub fn override_name(&self) -> &'static str {
        override_name(self.color_override)
    }
}

fn override_name(code: u32) -> &'static str {
    match code {
        1 => "Specialpaper",
        2 => "Specialblack",
        3 => "Specialregistration",
        4 => "Hiddenreserved",
        _ => "Normal",
    }
}

/// A mixed ink (a colour of model code 3, or a member of a mixed ink
/// group: colour space 9 and chunk 0x117) or a mixed ink group (model code
/// 3 with chunk 0x1F24). See `docs/format/objects.md`, mixed inks.
#[derive(Debug, Clone, PartialEq)]
pub struct MixedInk {
    pub uid: u32,
    pub name: String,
    pub group: bool,
    /// The group of a member.
    pub base: Option<u32>,
    /// Ink UIDs (chunk 0x1F09 after u32 3: count and UIDs), of the group
    /// for a member.
    pub inks: Vec<u32>,
    /// The fraction of each ink (chunk 0x1F01, colour space 9).
    pub percentages: Vec<f64>,
    /// Spot colour UIDs (chunk 0x102D), of the group for a member.
    pub spots: Vec<u32>,
    pub editable: bool,
    pub removable: bool,
    pub visible: bool,
    pub creator: Option<u32>,
}

impl MixedInk {
    /// The mixed ink of a colour read as `color`; `group` is the object of
    /// a member's group. `None` if `color` is not a mixed ink.
    pub fn read(
        color: &Color,
        obj: &crate::Object,
        group: Option<&crate::Object>,
    ) -> Result<Option<MixedInk>, Error> {
        let enc = obj.encoding;
        let base = match obj.chunk(chunk::TINT_BASE) {
            Some(d) if color.space == Space::Other(9) => Some(enc.cursor(d).u32()?),
            _ => None,
        };
        if color.model != 3 && base.is_none() {
            return Ok(None);
        }
        let source = if base.is_some() { group } else { Some(obj) };
        let Some(source) = source else {
            return Ok(None);
        };
        let Some(model) = source.chunk(chunk::COLOR_MODEL) else {
            return Ok(None);
        };
        let mut c = enc.cursor(model);
        if c.u32()? != 3 {
            return Ok(None);
        }
        let inks = c.u32_list()?;
        let spots = match source.chunk(chunk::MIXED_INK_SPOTS) {
            Some(d) => enc.cursor(d).u32_list()?,
            None => Vec::new(),
        };
        Ok(Some(MixedInk {
            uid: color.uid,
            name: color.name.clone(),
            group: base.is_none() && obj.chunk(chunk::COLOR_OVERRIDE).is_some(),
            base,
            inks,
            percentages: color.values.clone(),
            spots,
            editable: color.editable,
            removable: color.removable,
            visible: color.visible,
            creator: color.creator,
        }))
    }

    /// The IDML reference: `MixedInk/<name>` or `MixedInkGroup/<name>`,
    /// escaped as colour names.
    pub fn reference(&self) -> String {
        let kind = if self.group {
            "MixedInkGroup"
        } else {
            "MixedInk"
        };
        format!(
            "{kind}/{}",
            self.name
                .replace('%', "%25")
                .replace(':', "%3a")
                .replace('\r', "%0d")
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Space {
    Rgb,
    Cmyk,
    Lab,
    /// Hue, saturation and brightness as fractions; IDML writes the colour
    /// as RGB with `ConvertToHsb="true"`.
    Hsb,
    Other(u32),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Color {
    pub uid: u32,
    /// Empty for unnamed colours, which IDML names by UID.
    pub name: String,
    /// The name is an InDesign key, written with `$ID/` in IDML.
    pub builtin_name: bool,
    pub model: u32,
    pub space: Space,
    /// Component values as fractions (0–1) for RGB and CMYK.
    pub values: Vec<f64>,
    pub editable: bool,
    pub removable: bool,
    pub visible: bool,
    pub color_override: u32,
    /// `SwatchCreatorID`: the u32 at the end of chunk 0x1F10.
    pub creator: Option<u32>,
    /// The alternate colour (chunk 0x1F0A): space code and components.
    pub alternate: Option<(u32, Vec<f64>)>,
}

/// Red, green and blue fractions of a colour given as hue (a fraction of
/// a full turn), saturation and brightness: the hue picks the side of the
/// colour hexagon, saturation mixes towards white and brightness scales.
fn hsb_to_rgb(h: f64, s: f64, b: f64) -> [f64; 3] {
    let h6 = (h.rem_euclid(1.0)) * 6.0;
    let sector = h6.floor();
    let f = h6 - sector;
    let (p, q, t) = (b * (1.0 - s), b * (1.0 - s * f), b * (1.0 - s * (1.0 - f)));
    match sector as u32 {
        0 => [b, t, p],
        1 => [q, b, p],
        2 => [p, b, t],
        3 => [p, q, b],
        4 => [t, p, b],
        _ => [b, p, q],
    }
}

impl Color {
    /// The IDML reference for this colour (`Color/<name>` or `Color/u<hex>`).
    pub fn reference(&self) -> String {
        if self.name.is_empty() {
            format!("Color/u{:x}", self.uid)
        } else {
            format!(
                "Color/{}",
                self.name
                    .replace('%', "%25")
                    .replace(':', "%3a")
                    .replace('\r', "%0d")
            )
        }
    }

    /// The `Name` attribute.
    pub fn idml_name(&self) -> String {
        if self.builtin_name {
            builtin_key(&self.name)
        } else {
            self.name.clone()
        }
    }

    /// IDML `Model` of the stored model code; `None` for a code no
    /// sample shows (`docs/format/objects.md`).
    pub fn model_name(&self) -> Option<&'static str> {
        match self.model {
            0 => Some("Process"),
            1 => Some("Spot"),
            2 => Some("Registration"),
            _ => None,
        }
    }

    pub fn space_name(&self) -> &'static str {
        match self.space {
            Space::Rgb | Space::Hsb => "RGB",
            Space::Lab => "LAB",
            _ => "CMYK",
        }
    }

    /// Component values as IDML writes them: percentages for CMYK, 0–255
    /// for RGB, raw values otherwise.
    pub fn idml_values(&self) -> Vec<f64> {
        match self.space {
            Space::Cmyk => self.values.iter().map(|v| v * 100.0).collect(),
            Space::Rgb => self.values.iter().map(|v| v * 255.0).collect(),
            Space::Hsb => match self.values[..] {
                [h, s, b] => hsb_to_rgb(h, s, b).iter().map(|v| v * 255.0).collect(),
                _ => self.values.clone(),
            },
            _ => self.values.clone(),
        }
    }

    pub fn override_name(&self) -> &'static str {
        override_name(self.color_override)
    }

    pub fn read(uid: u32, obj: &crate::Object) -> Result<Option<Color>, Error> {
        let enc = obj.encoding;
        let (Some(name), Some(value)) =
            (obj.chunk(chunk::COLOR_NAME), obj.chunk(chunk::COLOR_VALUE))
        else {
            return Ok(None);
        };
        let mut c = enc.cursor(name);
        let builtin_name = c.flag()? == 1;
        let name_str = c.string()?;
        let flags = c.u32()?;
        // Two u32, then the creator.
        let creator = (c.remaining() >= 12)
            .then(|| -> Result<u32, Error> {
                c.skip(8)?;
                c.u32()
            })
            .transpose()?;
        let alternate = match obj.chunk(chunk::COLOR_ALTERNATE) {
            Some(d) => {
                let mut a = enc.cursor(d);
                let space = a.u32()?;
                let n = a.u16()?;
                Some((
                    space,
                    (0..n).map(|_| a.f64()).collect::<Result<Vec<_>, _>>()?,
                ))
            }
            None => None,
        };
        let mut v = enc.cursor(value);
        let space = match v.u32()? {
            5 => Space::Rgb,
            6 => Space::Cmyk,
            7 => Space::Lab,
            14 => Space::Hsb,
            other => Space::Other(other),
        };
        let n = v.u16()?;
        let values = (0..n).map(|_| v.f64()).collect::<Result<Vec<_>, _>>()?;
        let model = match obj.chunk(chunk::COLOR_MODEL) {
            Some(d) => enc.cursor(d).u32()?,
            None => 0,
        };
        let color_override = match obj.chunk(chunk::COLOR_OVERRIDE) {
            Some(d) if d.len() >= 12 => enc.cursor(&d[8..]).u32()?,
            _ => 0,
        };
        Ok(Some(Color {
            uid,
            name: name_str,
            builtin_name,
            model,
            space,
            values,
            removable: flags & 1 != 0,
            visible: flags & 2 != 0,
            editable: flags & 4 != 0,
            color_override,
            creator,
            alternate,
        }))
    }

    /// IDML `AlternateSpace` and `AlternateColorValue`: space code 3 or no
    /// chunk is none; 6 is CMYK (percentages), 7 LAB. `None` for another
    /// code.
    pub fn idml_alternate(&self) -> Option<(&'static str, Vec<f64>)> {
        match &self.alternate {
            None | Some((3, _)) => Some(("NoAlternateColor", Vec::new())),
            Some((6, v)) => Some(("CMYK", v.iter().map(|x| x * 100.0).collect())),
            Some((7, v)) => Some(("LAB", v.clone())),
            Some(_) => None,
        }
    }
}

/// An ink (class 0x1F07). Chunk 0x1F0D: flag byte and name, then fields
/// at offsets from the end of the name: f64 neutral density at 14, u32
/// trap order − 1 at 26, f64 frequency at 32, f64 angle at 40, u8 convert
/// to process at 56.
#[derive(Debug, Clone, PartialEq)]
pub struct Ink {
    pub uid: u32,
    pub name: Name,
    /// `None` when the stored value is outside the 0.001–10 the IDML
    /// schema allows (−1 in some files; `objects.md`).
    pub neutral_density: Option<f64>,
    pub trap_order: u32,
    pub frequency: f64,
    pub angle: f64,
    /// `ConvertToProcess`: u8 at 56 (1 `true`, 0 `false`).
    pub convert_to_process: Option<bool>,
}

impl Ink {
    pub fn read(uid: u32, obj: &crate::Object) -> Result<Option<Ink>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::INK) else {
            return Ok(None);
        };
        let mut c = enc.cursor(d);
        let name = c.name()?;
        let end = c.pos();
        if d.len() < end + 48 {
            return Ok(None);
        }
        let f = |o: usize| enc.cursor(&d[end + o..]).f64();
        Ok(Some(Ink {
            uid,
            name,
            neutral_density: Some(f(14)?).filter(|v| (0.001..=10.0).contains(v)),
            trap_order: enc.cursor(&d[end + 26..]).u32()? + 1,
            frequency: f(32)?,
            angle: f(40)?,
            convert_to_process: match d.get(end + 56) {
                Some(0) => Some(false),
                Some(1) => Some(true),
                _ => None,
            },
        }))
    }
}

/// A colour group (class 0x1F39): chunk 0x13C is a flag byte and the name,
/// chunk 0x1F60 a UID list of its swatches.
#[derive(Debug, Clone, PartialEq)]
pub struct ColorGroup {
    pub uid: u32,
    pub name: String,
    pub swatches: Vec<u32>,
}

impl ColorGroup {
    pub fn read(uid: u32, obj: &crate::Object) -> Result<Option<ColorGroup>, Error> {
        let enc = obj.encoding;
        let Some(d) = obj.chunk(chunk::COLOR_GROUP_NAME) else {
            return Ok(None);
        };
        let name = enc.cursor(&d[1.min(d.len())..]).string()?;
        let swatches = match obj.chunk(chunk::COLOR_GROUP_SWATCHES) {
            Some(d) => enc.cursor(d).u32_list()?,
            None => Vec::new(),
        };
        Ok(Some(ColorGroup {
            uid,
            name,
            swatches,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn color(name: &str, color_override: u32) -> Color {
        Color {
            uid: 0xb,
            name: name.into(),
            builtin_name: false,
            model: 0,
            space: Space::Cmyk,
            values: vec![0.0, 0.0, 0.0, 1.0],
            editable: false,
            removable: false,
            visible: true,
            color_override,
            creator: None,
            alternate: None,
        }
    }

    #[test]
    fn converts_hsb_to_rgb() {
        assert_eq!(hsb_to_rgb(0.0, 1.0, 1.0), [1.0, 0.0, 0.0]);
        assert_eq!(hsb_to_rgb(0.5, 1.0, 1.0), [0.0, 1.0, 1.0]);
        assert_eq!(hsb_to_rgb(0.25, 0.0, 0.5), [0.5, 0.5, 0.5]);
    }

    #[test]
    fn names_tints_after_their_base() {
        let t = Tint {
            uid: 0x3fa,
            base: 0xb,
            value: 40.0,
            color_override: 0,
        };
        assert_eq!(t.idml_name(&color("Black", 2)), "[Black] 40%");
        assert_eq!(t.reference(&color("Gold", 0)), "Tint/Gold 40%25");
    }

    #[test]
    fn gradient_midpoints_are_relative_to_the_gap() {
        let stop = |location, midpoint| GradientStop {
            color: 0,
            location,
            midpoint,
        };
        let g = Gradient {
            uid: 0x100,
            name: String::new(),
            builtin_name: false,
            kind: 1,
            // Stops at 0, 0.5, 0.5 and 1; the stored midpoints are positions
            // from the start of the gradient.
            stops: vec![
                stop(0.0, 0.25),
                stop(0.5, 0.5),
                stop(0.5, 0.95),
                stop(1.0, 1.0),
            ],
            removable: true,
            visible: true,
            editable: true,
        };
        assert_eq!(g.idml_midpoint(0), None);
        assert_eq!(g.idml_midpoint(1), Some(50.0));
        // No gap between two stops at the same location.
        assert_eq!(g.idml_midpoint(2), None);
        // 90 % is outside what IDML allows.
        assert_eq!(g.idml_midpoint(3), None);
    }
}
