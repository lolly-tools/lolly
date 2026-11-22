// SPDX-License-Identifier: MPL-2.0
//! The CPU path: an admitted plan drawn with tiny-skia, the Rust port of Skia's CPU
//! rasteriser, in the order the engine's SVG writer paints the operations.
//!
//! Each operation follows CSS's order for an element: its clip and group opacity sit
//! outside its pose, in page coordinates; its fills, border and words are drawn inside
//! the pose. An operation that fades as a group is drawn on a layer of its own and
//! laid onto the page once, the way Chromium composites a faded element.

use crate::admit::{Draw, Ink, Item, Outline, Plan, Rgba, Step};
use crate::geometry::push_outline;
use tiny_skia::{
    BlendMode, Color, FillRule, FilterQuality, GradientStop, LinearGradient, Mask, Paint, PathBuilder, Pixmap, PixmapPaint, Point,
    RadialGradient, Rect, Shader, SpreadMode, Transform,
};

fn color(c: Rgba) -> Option<Color> {
    Color::from_rgba(c.0, c.1, c.2, c.3)
}

fn shader(ink: &Ink) -> Option<Shader<'static>> {
    let stops = |s: &[crate::admit::GradientStop]| -> Option<Vec<GradientStop>> {
        s.iter().map(|g| Some(GradientStop::new(g.offset, color(g.color)?))).collect()
    };
    match ink {
        Ink::Solid(c) => Some(Shader::SolidColor(color(*c)?)),
        Ink::Linear { x1, y1, x2, y2, stops: s } => LinearGradient::new(
            Point::from_xy(*x1 as f32, *y1 as f32),
            Point::from_xy(*x2 as f32, *y2 as f32),
            stops(s)?,
            SpreadMode::Pad,
            Transform::identity(),
        ),
        Ink::Radial { cx, cy, rx, ry, stops: s } => RadialGradient::new(
            Point::from_xy(0.0, 0.0),
            0.0,
            Point::from_xy(0.0, 0.0),
            1.0,
            stops(s)?,
            SpreadMode::Pad,
            Transform::from_row(*rx as f32, 0.0, 0.0, *ry as f32, *cx as f32, *cy as f32),
        ),
    }
}

fn matrix(m: [f64; 6]) -> Transform {
    Transform::from_row(m[0] as f32, m[1] as f32, m[2] as f32, m[3] as f32, m[4] as f32, m[5] as f32)
}

/// `base` then `pose`, composed in double precision, then handed to tiny-skia.
fn compose(scale: (f64, f64), pose: [f64; 6]) -> Transform {
    let (sx, sy) = scale;
    matrix([sx * pose[0], sy * pose[1], sx * pose[2], sy * pose[3], sx * pose[4], sy * pose[5]])
}

fn outline_mask(o: &Outline, transform: Transform, width: u32, height: u32, res: f64, within: Option<&Mask>) -> Option<Mask> {
    let mut pb = PathBuilder::new();
    push_outline(&mut pb, o, res);
    let path = pb.finish()?;
    match within {
        Some(m) => {
            let mut m = m.clone();
            m.intersect_path(&path, FillRule::Winding, true, transform);
            Some(m)
        }
        None => {
            let mut m = Mask::new(width, height)?;
            m.fill_path(&path, FillRule::Winding, true, transform);
            Some(m)
        }
    }
}

fn step(target: &mut Pixmap, s: &Step, transform: Transform, mask: Option<&Mask>) {
    let Some(shader) = shader(&s.ink) else { return };
    let mut paint = Paint { shader, anti_alias: true, blend_mode: BlendMode::SourceOver, ..Paint::default() };
    match &s.draw {
        Draw::Fill { path, rule } => target.fill_path(path, &paint, *rule, transform, mask),
        Draw::Rect([x, y, w, h]) => {
            // Skia fills an axis-aligned rectangle with exact edge coverage; keep that
            // wherever the transform keeps the rectangle axis-aligned.
            if transform.kx == 0.0 && transform.ky == 0.0 {
                let (ax, bx) = ((*x as f32) * transform.sx + transform.tx, ((x + w) as f32) * transform.sx + transform.tx);
                let (ay, by) = ((*y as f32) * transform.sy + transform.ty, ((y + h) as f32) * transform.sy + transform.ty);
                if let Some(rect) = Rect::from_ltrb(ax.min(bx), ay.min(by), ax.max(bx), ay.max(by)) {
                    paint.shader.transform(transform);
                    target.fill_rect(rect, &paint, Transform::identity(), mask);
                }
            } else if let Some(rect) = Rect::from_xywh(*x as f32, *y as f32, *w as f32, *h as f32) {
                target.fill_path(&PathBuilder::from_rect(rect), &paint, FillRule::Winding, transform, mask);
            }
        }
        Draw::Stroke { path, width, cap, join, dash } => {
            let stroke = tiny_skia::Stroke { width: *width, miter_limit: 4.0, line_cap: *cap, line_join: *join, dash: dash.clone() };
            target.stroke_path(path, &paint, &stroke, transform, mask);
        }
    }
}

/// Draw one item onto `target`, inside `outer` (the frame's clip) when given.
fn item(target: &mut Pixmap, layer: &mut Option<Pixmap>, plan: &Plan, it: &Item, outer: Option<&Mask>) {
    if it.opacity.is_nan() || it.opacity <= 0.0 || it.steps.is_empty() {
        return;
    }
    let (w, h) = (target.width(), target.height());
    let res = plan.scale.0.max(plan.scale.1);
    let base = compose(plan.scale, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
    let posed = compose(plan.scale, it.pose);
    let item_mask: Option<Mask> = match &it.row_clip {
        Some(path) => {
            let mut m = match outer {
                Some(o) => o.clone(),
                None => match Mask::new(w, h) {
                    Some(m) => m,
                    None => return,
                },
            };
            if outer.is_some() {
                m.intersect_path(path, FillRule::Winding, true, base);
            } else {
                m.fill_path(path, FillRule::Winding, true, base);
            }
            Some(m)
        }
        None => outer.cloned(),
    };
    if it.opacity < 1.0 {
        let words = it.words_clip.as_ref().and_then(|o| outline_mask(o, posed, w, h, res, None));
        let canvas = match layer {
            Some(p) => {
                p.fill(Color::TRANSPARENT);
                p
            }
            None => match Pixmap::new(w, h) {
                Some(p) => layer.insert(p),
                None => return,
            },
        };
        for s in &it.steps {
            step(canvas, s, posed, if s.words { words.as_ref() } else { None });
        }
        let paint = PixmapPaint { opacity: it.opacity, blend_mode: BlendMode::SourceOver, quality: FilterQuality::Nearest };
        target.draw_pixmap(0, 0, canvas.as_ref(), &paint, Transform::identity(), item_mask.as_ref());
    } else {
        let words = it.words_clip.as_ref().and_then(|o| outline_mask(o, posed, w, h, res, item_mask.as_ref()));
        for s in &it.steps {
            let mask = if s.words && it.words_clip.is_some() { words.as_ref() } else { item_mask.as_ref() };
            step(target, s, posed, mask);
        }
    }
}

/// Draw an admitted plan. The result is premultiplied RGBA8, tiny-skia's own pixel format.
pub fn draw(plan: &Plan) -> Option<Pixmap> {
    let mut target = Pixmap::new(plan.pixel_width, plan.pixel_height)?;
    let mut layer: Option<Pixmap> = None;
    match &plan.frame {
        Some(frame) => item(&mut target, &mut layer, plan, frame, None),
        None => target.fill(color(plan.ground)?),
    }
    let res = plan.scale.0.max(plan.scale.1);
    let page_mask = match &plan.page_clip {
        Some(o) => {
            Some(outline_mask(o, compose(plan.scale, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]), plan.pixel_width, plan.pixel_height, res, None)?)
        }
        None => None,
    };
    for it in &plan.items {
        item(&mut target, &mut layer, plan, it, page_mask.as_ref());
    }
    Some(target)
}

/// Straight RGBA8 from tiny-skia's premultiplied pixels.
pub fn straight_rgba(pixmap: &Pixmap) -> Vec<u8> {
    let mut out = Vec::with_capacity(pixmap.pixels().len() * 4);
    for p in pixmap.pixels() {
        let c = p.demultiply();
        out.extend_from_slice(&[c.red(), c.green(), c.blue(), c.alpha()]);
    }
    out
}
