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
/// than half the short side) unless it is an ellipse. `corners`, when present, are eight
/// radii (each corner across then down, clockwise from the top left) and win over `radius`;
/// a border of unequal sides gives its edges such corners.
#[derive(Debug, Clone, Copy)]
pub struct Outline {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub ellipse: bool,
    pub radius: f64,
    pub corners: Option<[f64; 8]>,
}

impl Outline {
    /// The eight corner radii, from `corners` or the one `radius`.
    pub fn radii(&self) -> [f64; 8] {
        self.corners.unwrap_or([self.radius; 8])
    }

    /// Whether any edge of the outline is curved.
    pub fn curved(&self) -> bool {
        self.ellipse || self.radii().iter().any(|r| *r > 0.0)
    }
}

/// A rectangle outline from eight radii: one radius when all eight agree.
pub fn rect_with(x: f64, y: f64, w: f64, h: f64, c: [f64; 8]) -> Outline {
    if c.iter().all(|v| *v == c[0]) {
        Outline { x, y, w, h, ellipse: false, radius: c[0], corners: None }
    } else {
        Outline { x, y, w, h, ellipse: false, radius: c.iter().cloned().fold(f64::INFINITY, f64::min), corners: Some(c) }
    }
}

/// A border's two edges, as the engine's `strokeRing` (engine/src/design-stroke.ts) gives
/// them: `out` is the part of each width outside the outline (0 inside, one half centred, 1
/// outside). A rounded corner grows by the outside part of its adjacent widths, and its inner
/// edge is the outer radius less the width on that axis, never below zero. The inner edge
/// is None once the border fills the box.
pub fn ring(o: &Outline, out: f64, sides: [f64; 4]) -> (Outline, Option<Outline>) {
    let i = 1.0 - out;
    let [t, r, b, l] = sides.map(|v| v.max(0.0));
    let (ox, oy, ow, oh) = (o.x - l * out, o.y - t * out, o.w + (l + r) * out, o.h + (t + b) * out);
    let (ix, iy, iw, ih) = (o.x + l * i, o.y + t * i, o.w - (l + r) * i, o.h - (t + b) * i);
    let hole = iw > 0.0 && ih > 0.0;
    if o.ellipse {
        let outer = Outline { x: ox, y: oy, w: ow, h: oh, ellipse: true, radius: 0.0, corners: None };
        return (outer, hole.then_some(Outline { x: ix, y: iy, w: iw, h: ih, ellipse: true, radius: 0.0, corners: None }));
    }
    let c = o.radii();
    let across = [l, r, r, l];
    let down = [t, t, b, b];
    let side = |k: usize| if k.is_multiple_of(2) { across[k >> 1] } else { down[k >> 1] };
    let outer_c: [f64; 8] = std::array::from_fn(|k| if c[k] > 0.0 { c[k] + side(k) * out } else { 0.0 });
    let inner_c: [f64; 8] = std::array::from_fn(|k| (outer_c[k] - side(k)).max(0.0));
    (rect_with(ox, oy, ow, oh, outer_c), hole.then(|| rect_with(ix, iy, iw, ih, inner_c)))
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

/// A rectangle whose corners have radii of their own, clockwise from the top edge.
fn push_corners(builder: &mut PathBuilder, o: &Outline, c: [f64; 8], res: f64) -> bool {
    let Outline { x, y, w, h, .. } = *o;
    // CSS scales every radius down by one factor when two on a side overlap.
    let f = [w / (c[0] + c[2]), h / (c[3] + c[5]), w / (c[4] + c[6]), h / (c[7] + c[1])].iter().fold(1.0f64, |m, v| {
        if v.is_finite() && *v < m {
            *v
        } else {
            m
        }
    });
    let c = c.map(|v| v * f);
    let sharp = |rx: f64, ry: f64| !(rx > 0.0 && ry > 0.0);
    let (tl, tr, br, bl) = ((c[0], c[1]), (c[2], c[3]), (c[4], c[5]), (c[6], c[7]));
    let corner = |b: &mut PathBuilder, (rx, ry): (f64, f64), cx: f64, cy: f64, q: usize| -> bool {
        if sharp(rx, ry) {
            return true;
        }
        let Some(qs) = quarters(rx, ry, res) else { return false };
        put_quarter(b, &qs[q], cx, cy);
        true
    };
    let at = |(rx, ry): (f64, f64)| if sharp(rx, ry) { (0.0, 0.0) } else { (rx, ry) };
    builder.move_to((x + at(tl).0) as f32, y as f32);
    builder.line_to((x + w - at(tr).0) as f32, y as f32);
    if !corner(builder, tr, x + w - tr.0, y + tr.1, 3) {
        return false;
    }
    builder.line_to((x + w) as f32, (y + h - at(br).1) as f32);
    if !corner(builder, br, x + w - br.0, y + h - br.1, 0) {
        return false;
    }
    builder.line_to((x + at(bl).0) as f32, (y + h) as f32);
    if !corner(builder, bl, x + bl.0, y + h - bl.1, 1) {
        return false;
    }
    builder.line_to(x as f32, (y + at(tl).1) as f32);
    if !corner(builder, tl, x + tl.0, y + tl.1, 2) {
        return false;
    }
    builder.close();
    true
}

/// The outline appended to `builder` as one closed contour.
pub fn push_outline(builder: &mut PathBuilder, o: &Outline, res: f64) -> bool {
    let Outline { x, y, w, h, ellipse, radius, corners } = *o;
    if !(w > 0.0 && h > 0.0) {
        return false;
    }
    if let (Some(c), false) = (corners, ellipse) {
        return push_corners(builder, o, c, res);
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
    let Outline { x, y, w, h, ellipse, .. } = *o;
    // Corners of their own are judged by the largest, which only ever says "not inside" more often.
    let radius = o.radii().iter().cloned().fold(0.0, f64::max);
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
        assert!(push_outline(&mut b, &Outline { x: 10.0, y: 20.0, w: 100.0, h: 50.0, ellipse: false, radius: 12.0, corners: None }, 1.0));
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
        let square = |ellipse, radius| Outline { x: 0.0, y: 0.0, w: 100.0, h: 100.0, ellipse, radius, corners: None };
        assert!(box_inside([20.0, 20.0, 80.0, 80.0], &square(false, 0.0), 1.0));
        assert!(!box_inside([0.0, 0.0, 10.0, 10.0], &square(false, 30.0), 0.0));
        assert!(!box_inside([0.0, 45.0, 10.0, 55.0], &square(true, 0.0), 1.0));
    }
}
