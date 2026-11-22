// SPDX-License-Identifier: MPL-2.0
//! Outlines built the way Skia builds them, so the edges land where Chromium's do.
//!
//! Skia writes an oval or a rounded rectangle's corners as conics of weight one over
//! root two and turns each conic into quadratic curves, judged against a quarter of a
//! device pixel. tiny-skia does the same conversion, but against the coordinates it is
//! given. These helpers build each curve at device size (`res`, the device pixels per
//! page unit) and scale it back, so the number of quadratic pieces matches the
//! device, as it does in Chromium.

use tiny_skia::{PathBuilder, Rect};

/// A rectangle, rounded rectangle or ellipse: a box, and a corner radius (already no more
/// than half the short side) unless it is an ellipse.
#[derive(Debug, Clone, Copy)]
pub struct Outline {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub ellipse: bool,
    pub radius: f64,
}

/// A quadratic piece: control point, then end point.
type Quad = (f32, f32, f32, f32);

/// The four quarters of an ellipse of radii `rx`, `ry` centred on the origin, in page
/// units, clockwise on screen from the right: bottom right, bottom left, top left, top right.
fn quarters(rx: f64, ry: f64, res: f64) -> Option<[Vec<Quad>; 4]> {
    let (dx, dy) = ((rx * res) as f32, (ry * res) as f32);
    let rect = Rect::from_xywh(-dx, -dy, dx + dx, dy + dy)?;
    let mut builder = PathBuilder::new();
    builder.push_oval(rect);
    let path = builder.finish()?;
    let mut quads: Vec<Quad> = Vec::new();
    for segment in path.segments() {
        match segment {
            tiny_skia::PathSegment::MoveTo(_) | tiny_skia::PathSegment::Close => {}
            tiny_skia::PathSegment::QuadTo(c, p) => quads.push((c.x, c.y, p.x, p.y)),
            // push_oval writes only conics turned into quadratics.
            _ => return None,
        }
    }
    if quads.is_empty() || !quads.len().is_multiple_of(4) {
        return None;
    }
    let per = quads.len() / 4;
    let back = (1.0 / res) as f32;
    let scaled: Vec<Quad> = quads.iter().map(|&(a, b, c, d)| (a * back, b * back, c * back, d * back)).collect();
    Some([scaled[0..per].to_vec(), scaled[per..2 * per].to_vec(), scaled[2 * per..3 * per].to_vec(), scaled[3 * per..].to_vec()])
}

fn put_quarter(builder: &mut PathBuilder, quarter: &[Quad], cx: f64, cy: f64) {
    let (x, y) = (cx as f32, cy as f32);
    for &(a, b, c, d) in quarter {
        builder.quad_to(a + x, b + y, c + x, d + y);
    }
}

/// The outline appended to `builder` as one closed contour.
pub fn push_outline(builder: &mut PathBuilder, o: &Outline, res: f64) -> bool {
    let Outline { x, y, w, h, ellipse, radius } = *o;
    if !(w > 0.0 && h > 0.0) {
        return false;
    }
    if ellipse {
        let Some(q) = quarters(w / 2.0, h / 2.0, res) else { return false };
        let (cx, cy) = (x + w / 2.0, y + h / 2.0);
        builder.move_to((x + w) as f32, cy as f32);
        for quarter in &q {
            put_quarter(builder, quarter, cx, cy);
        }
        builder.close();
        return true;
    }
    let r = radius.min(w / 2.0).min(h / 2.0);
    if r <= 0.0 {
        builder.move_to(x as f32, y as f32);
        builder.line_to((x + w) as f32, y as f32);
        builder.line_to((x + w) as f32, (y + h) as f32);
        builder.line_to(x as f32, (y + h) as f32);
        builder.close();
        return true;
    }
    let Some(q) = quarters(r, r, res) else { return false };
    let (right, bottom) = (x + w, y + h);
    builder.move_to(right as f32, (y + r) as f32);
    if bottom - r > y + r {
        builder.line_to(right as f32, (bottom - r) as f32);
    }
    put_quarter(builder, &q[0], right - r, bottom - r);
    if right - r > x + r {
        builder.line_to((x + r) as f32, bottom as f32);
    }
    put_quarter(builder, &q[1], x + r, bottom - r);
    if bottom - r > y + r {
        builder.line_to(x as f32, (y + r) as f32);
    }
    put_quarter(builder, &q[2], x + r, y + r);
    if right - r > x + r {
        builder.line_to((right - r) as f32, y as f32);
    }
    put_quarter(builder, &q[3], right - r, y + r);
    builder.close();
    true
}

/// Whether the box `b` (x0, y0, x1, y1) lies inside the outline grown by nothing and
/// shrunk by `margin`: the outline is convex, so its corners decide.
pub fn box_inside(b: [f64; 4], o: &Outline, margin: f64) -> bool {
    let Outline { x, y, w, h, ellipse, radius } = *o;
    let (x, y, w, h) = (x + margin, y + margin, w - 2.0 * margin, h - 2.0 * margin);
    if !(w > 0.0 && h > 0.0) {
        return false;
    }
    let corners = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]];
    corners.iter().all(|&[px, py]| {
        if px < x || py < y || px > x + w || py > y + h {
            return false;
        }
        if ellipse {
            let dx = (px - x - w / 2.0) / (w / 2.0);
            let dy = (py - y - h / 2.0) / (h / 2.0);
            return dx * dx + dy * dy <= 1.0;
        }
        let r = (radius - margin).max(0.0).min(w / 2.0).min(h / 2.0);
        let cx = px.max(x + r).min(x + w - r);
        let cy = py.max(y + r).min(y + h - r);
        (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_rounded_rectangle_is_one_closed_contour_inside_its_box() {
        let mut b = PathBuilder::new();
        assert!(push_outline(&mut b, &Outline { x: 10.0, y: 20.0, w: 100.0, h: 50.0, ellipse: false, radius: 12.0 }, 1.0));
        let path = b.finish().unwrap();
        let bounds = path.bounds();
        assert_eq!((bounds.left(), bounds.top(), bounds.right(), bounds.bottom()), (10.0, 20.0, 110.0, 70.0));
    }

    #[test]
    fn more_device_pixels_give_more_pieces() {
        let few = quarters(10.0, 10.0, 1.0).unwrap();
        let many = quarters(10.0, 10.0, 8.0).unwrap();
        assert!(many[0].len() >= few[0].len());
        // Each quarter ends where the next begins: bottom, then left, then top, then right.
        let end = few[0].last().unwrap();
        assert!((end.2 - 0.0).abs() < 1e-4 && (end.3 - 10.0).abs() < 1e-4);
    }

    #[test]
    fn box_inside_reads_the_corners() {
        let square = |ellipse, radius| Outline { x: 0.0, y: 0.0, w: 100.0, h: 100.0, ellipse, radius };
        assert!(box_inside([20.0, 20.0, 80.0, 80.0], &square(false, 0.0), 1.0));
        assert!(!box_inside([0.0, 0.0, 10.0, 10.0], &square(false, 30.0), 0.0));
        assert!(!box_inside([0.0, 45.0, 10.0, 55.0], &square(true, 0.0), 1.0));
    }
}
