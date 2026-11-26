// SPDX-License-Identifier: MPL-2.0
//! SVG path data for outlined words, read strictly.
//!
//! The engine outlines each run with the host's `text.toPath`, which writes absolute
//! `M`, `L`, `Q`, `C` and `Z` commands. This reader also takes their relative forms and
//! `H`, `V`, `S` and `T`, because `translateTextPath` may rewrite a run. Arcs are
//! refused: no outliner writes one, and an arc would need a conversion of its own.
//! A malformed number or command refuses the run rather than drawing the part before the fault.

use tiny_skia::PathBuilder;

/// Why a run's path data was refused.
#[derive(Debug, PartialEq, Eq)]
pub enum PathDataError {
    /// A character that is not a command, a number or a separator.
    Syntax,
    /// An arc, which no outliner writes.
    Arc,
    /// More segments than the page's budget allows.
    Budget,
    /// A coordinate outside the finite range admission allows.
    Range,
}

struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn skip_separators(&mut self) {
        while self.at < self.bytes.len() && matches!(self.bytes[self.at], b' ' | b'\t' | b'\n' | b'\r' | b',') {
            self.at += 1;
        }
    }

    fn peek_command(&mut self) -> Option<u8> {
        self.skip_separators();
        let c = *self.bytes.get(self.at)?;
        if c.is_ascii_alphabetic() && c != b'e' && c != b'E' {
            Some(c)
        } else {
            None
        }
    }

    fn at_number(&mut self) -> bool {
        self.skip_separators();
        matches!(self.bytes.get(self.at), Some(c) if c.is_ascii_digit() || *c == b'-' || *c == b'+' || *c == b'.')
    }

    /// One number in the SVG grammar: sign, digits, a fraction and an exponent.
    fn number(&mut self) -> Result<f64, PathDataError> {
        self.skip_separators();
        let start = self.at;
        let b = self.bytes;
        let mut i = self.at;
        if i < b.len() && (b[i] == b'-' || b[i] == b'+') {
            i += 1;
        }
        let mut digits = 0;
        while i < b.len() && b[i].is_ascii_digit() {
            i += 1;
            digits += 1;
        }
        if i < b.len() && b[i] == b'.' {
            i += 1;
            while i < b.len() && b[i].is_ascii_digit() {
                i += 1;
                digits += 1;
            }
        }
        if digits == 0 {
            return Err(PathDataError::Syntax);
        }
        if i < b.len() && (b[i] == b'e' || b[i] == b'E') {
            let mut j = i + 1;
            if j < b.len() && (b[j] == b'-' || b[j] == b'+') {
                j += 1;
            }
            let exp_start = j;
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            if j == exp_start {
                return Err(PathDataError::Syntax);
            }
            i = j;
        }
        self.at = i;
        let text = core::str::from_utf8(&b[start..i]).map_err(|_| PathDataError::Syntax)?;
        let value: f64 = text.parse().map_err(|_| PathDataError::Syntax)?;
        if !value.is_finite() || value.abs() > 1e6 {
            return Err(PathDataError::Range);
        }
        Ok(value)
    }
}

/// Append the path data `d`, moved by `(dx, dy)`, to `builder`. `budget` counts down
/// one per segment; it is shared across the page.
pub fn append_path_data(builder: &mut PathBuilder, d: &str, dx: f64, dy: f64, budget: &mut usize) -> Result<(), PathDataError> {
    let mut r = Reader { bytes: d.as_bytes(), at: 0 };
    let (mut cx, mut cy) = (0.0f64, 0.0f64);
    let (mut sx, mut sy) = (0.0f64, 0.0f64);
    // The last control point, for the smooth forms.
    let mut last_cubic: Option<(f64, f64)> = None;
    let mut last_quad: Option<(f64, f64)> = None;
    let mut command: Option<u8> = None;
    let out = |x: f64, y: f64| -> (f32, f32) { ((x + dx) as f32, (y + dy) as f32) };
    let spend = |budget: &mut usize| -> Result<(), PathDataError> {
        if *budget == 0 {
            return Err(PathDataError::Budget);
        }
        *budget -= 1;
        Ok(())
    };
    loop {
        if let Some(c) = r.peek_command() {
            r.at += 1;
            command = Some(c);
        } else if r.at >= r.bytes.len() {
            break;
        } else if !r.at_number() || command.is_none() {
            return Err(PathDataError::Syntax);
        }
        let c = command.ok_or(PathDataError::Syntax)?;
        let relative = c.is_ascii_lowercase();
        let (ox, oy) = if relative { (cx, cy) } else { (0.0, 0.0) };
        match c.to_ascii_uppercase() {
            b'M' => {
                let x = r.number()? + ox;
                let y = r.number()? + oy;
                spend(budget)?;
                let (px, py) = out(x, y);
                builder.move_to(px, py);
                cx = x;
                cy = y;
                sx = x;
                sy = y;
                last_cubic = None;
                last_quad = None;
                // Further pairs after a move are lines, in the same relative or absolute form.
                command = Some(if relative { b'l' } else { b'L' });
            }
            b'L' => {
                let x = r.number()? + ox;
                let y = r.number()? + oy;
                spend(budget)?;
                let (px, py) = out(x, y);
                builder.line_to(px, py);
                cx = x;
                cy = y;
                last_cubic = None;
                last_quad = None;
            }
            b'H' => {
                let x = r.number()? + ox;
                spend(budget)?;
                let (px, py) = out(x, cy);
                builder.line_to(px, py);
                cx = x;
                last_cubic = None;
                last_quad = None;
            }
            b'V' => {
                let y = r.number()? + oy;
                spend(budget)?;
                let (px, py) = out(cx, y);
                builder.line_to(px, py);
                cy = y;
                last_cubic = None;
                last_quad = None;
            }
            b'C' | b'S' => {
                let (x1, y1) = if c.eq_ignore_ascii_case(&b'C') {
                    (r.number()? + ox, r.number()? + oy)
                } else {
                    match last_cubic {
                        Some((lx, ly)) => (2.0 * cx - lx, 2.0 * cy - ly),
                        None => (cx, cy),
                    }
                };
                let x2 = r.number()? + ox;
                let y2 = r.number()? + oy;
                let x = r.number()? + ox;
                let y = r.number()? + oy;
                spend(budget)?;
                let (a, b) = out(x1, y1);
                let (e, f) = out(x2, y2);
                let (g, h) = out(x, y);
                builder.cubic_to(a, b, e, f, g, h);
                last_cubic = Some((x2, y2));
                last_quad = None;
                cx = x;
                cy = y;
            }
            b'Q' | b'T' => {
                let (x1, y1) = if c.eq_ignore_ascii_case(&b'Q') {
                    (r.number()? + ox, r.number()? + oy)
                } else {
                    match last_quad {
                        Some((lx, ly)) => (2.0 * cx - lx, 2.0 * cy - ly),
                        None => (cx, cy),
                    }
                };
                let x = r.number()? + ox;
                let y = r.number()? + oy;
                spend(budget)?;
                let (a, b) = out(x1, y1);
                let (g, h) = out(x, y);
                builder.quad_to(a, b, g, h);
                last_quad = Some((x1, y1));
                last_cubic = None;
                cx = x;
                cy = y;
            }
            b'Z' => {
                spend(budget)?;
                builder.close();
                cx = sx;
                cy = sy;
                last_cubic = None;
                last_quad = None;
                // A number straight after a close is a syntax error.
                command = None;
            }
            b'A' => return Err(PathDataError::Arc),
            _ => return Err(PathDataError::Syntax),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(d: &str) -> Result<usize, PathDataError> {
        let mut b = PathBuilder::new();
        let mut budget = 1000;
        append_path_data(&mut b, d, 0.0, 0.0, &mut budget)?;
        Ok(1000 - budget)
    }

    #[test]
    fn reads_the_outliner_forms() {
        assert_eq!(read("M1,2 L3,4 Q5,6 7,8 C1,2 3,4 5,6Z"), Ok(5));
        assert_eq!(read("M0 0h10v10H0z"), Ok(5));
        assert_eq!(read("m1 1 2 2 3 3"), Ok(3));
        assert_eq!(read("M1e2-1.5.5.5"), Ok(2));
        assert_eq!(read(""), Ok(0));
    }

    #[test]
    fn refuses_what_it_does_not_read() {
        assert_eq!(read("M0 0 A1 1 0 0 1 2 2"), Err(PathDataError::Arc));
        assert_eq!(read("M0 0 L1"), Err(PathDataError::Syntax));
        assert_eq!(read("1 2"), Err(PathDataError::Syntax));
        assert_eq!(read("M0 0 X"), Err(PathDataError::Syntax));
        assert_eq!(read("M0 0 Z 1 2"), Err(PathDataError::Syntax));
        assert_eq!(read("M1e999 0"), Err(PathDataError::Range));
        assert_eq!(read("M1e 0"), Err(PathDataError::Syntax));
        let mut b = PathBuilder::new();
        let mut budget = 2;
        assert_eq!(append_path_data(&mut b, "M0 0L1 1L2 2", 0.0, 0.0, &mut budget), Err(PathDataError::Budget));
    }
}
