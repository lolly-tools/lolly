// SPDX-License-Identifier: MPL-2.0
//! The CPU path: an admitted plan drawn with tiny-skia, the Rust port of Skia's CPU
//! rasteriser, in the order the engine's SVG writer paints the operations.
//!
//! Each operation follows CSS's order for an element: its clip and group opacity sit
//! outside its pose, in page coordinates; its fills, border and words are drawn inside
//! the pose. An operation that fades as a group is drawn on a layer of its own and
//! laid onto the page once, the way Chromium composites a faded element.

use crate::admit::{Draw, Ink, Item, Outline, Plan, Rgba, Step};
use crate::blur;
use crate::geometry::push_outline;
use tiny_skia::{
    BlendMode, Color, ColorU8, FillRule, FilterQuality, GradientStop, LinearGradient, Mask, Paint, PathBuilder, Pattern, Pixmap,
    PixmapPaint, Point, RadialGradient, Rect, Shader, SpreadMode, Transform,
};

/// How a picture is sampled when it is scaled (slice 2 evidence).
pub const PICTURE_FILTER: FilterQuality = FilterQuality::Bilinear;

fn color(c: Rgba) -> Option<Color> {
    Color::from_rgba(c.0, c.1, c.2, c.3)
}

fn shader<'a>(ink: &Ink, pictures: &'a [Pixmap]) -> Option<Shader<'a>> {
    let stops = |s: &[crate::admit::GradientStop]| -> Option<Vec<GradientStop>> {
        s.iter().map(|g| Some(GradientStop::new(g.offset, color(g.color)?))).collect()
    };
    match ink {
        Ink::Solid(c) => Some(Shader::SolidColor(color(*c)?)),
        Ink::Picture { index, rect } => {
            let p = pictures.get(*index)?;
            let (iw, ih) = (p.width() as f64, p.height() as f64);
            let place = Transform::from_row((rect[2] / iw) as f32, 0.0, 0.0, (rect[3] / ih) as f32, rect[0] as f32, rect[1] as f32);
            Some(Pattern::new(p.as_ref(), SpreadMode::Pad, PICTURE_FILTER, 1.0, place))
        }
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

fn step(target: &mut Pixmap, s: &Step, transform: Transform, mask: Option<&Mask>, pictures: &[Pixmap]) {
    let Some(shader) = shader(&s.ink, pictures) else { return };
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

/// A step's own clips (a picture's rounded element or box) inside `base`, or None when it has none.
fn clipped(s: &Step, base: Option<&Mask>, posed: Transform, w: u32, h: u32, res: f64) -> Option<Mask> {
    let mut mask: Option<Mask> = None;
    for o in &s.clips {
        mask = outline_mask(o, posed, w, h, res, mask.as_ref().or(base));
    }
    mask
}

/// Straight RGBA8 pictures as tiny-skia's premultiplied pixmaps.
fn pixmaps(plan: &Plan) -> Option<Vec<Pixmap>> {
    plan.pictures
        .iter()
        .map(|d| {
            let mut p = Pixmap::new(d.width, d.height)?;
            for (px, c) in p.pixels_mut().iter_mut().zip(d.rgba.chunks_exact(4)) {
                *px = ColorU8::from_rgba(c[0], c[1], c[2], c[3]).premultiply();
            }
            Some(p)
        })
        .collect()
}

/// Draw one item onto `target`, inside `outer` (the frame's clip) when given.
/// A shadow's colour over `src`'s alpha, blurred by `sigma` device pixels.
fn shadow_of(src: &Pixmap, color: Rgba, sigma: f64) -> Option<Pixmap> {
    let (w, h) = (src.width() as usize, src.height() as usize);
    let mut out = Pixmap::new(src.width(), src.height())?;
    let c = ColorU8::from_rgba(
        (color.0 * 255.0 + 0.5) as u8,
        (color.1 * 255.0 + 0.5) as u8,
        (color.2 * 255.0 + 0.5) as u8,
        (color.3 * 255.0 + 0.5) as u8,
    );
    for (o, p) in out.pixels_mut().iter_mut().zip(src.pixels()) {
        let a = (p.alpha() as u32 * c.alpha() as u32 + 127) / 255;
        *o = ColorU8::from_rgba(c.red(), c.green(), c.blue(), a as u8).premultiply();
    }
    let reach = (sigma * 3.0) as usize + 3;
    if let Some(area) = blur::painted_area(out.data(), w, h, reach) {
        blur::blur(out.data_mut(), w, h, sigma, area);
    }
    Some(out)
}

/// `layer` laid on `dest` moved by the device offset of the shadow's `(dx, dy)` under `posed`.
fn lay_offset(dest: &mut Pixmap, layer: &Pixmap, posed: Transform, dx: f64, dy: f64, mask: Option<&Mask>) {
    let ox = posed.sx as f64 * dx + posed.kx as f64 * dy;
    let oy = posed.ky as f64 * dx + posed.sy as f64 * dy;
    let whole = ox == libm::round(ox) && oy == libm::round(oy);
    let paint = PixmapPaint {
        opacity: 1.0,
        blend_mode: BlendMode::SourceOver,
        quality: if whole { FilterQuality::Nearest } else { FilterQuality::Bilinear },
    };
    dest.draw_pixmap(0, 0, layer.as_ref(), &paint, Transform::from_translate(ox as f32, oy as f32), mask);
}

/// The item's steps drawn onto `dest`, each inside `base(step)` and its own clips; the
/// words, when they cast a text shadow, drawn as one group with their shadow under them.
#[allow(clippy::too_many_arguments)]
fn steps_onto(dest: &mut Pixmap, it: &Item, posed: Transform, words: Option<&Mask>, other: Option<&Mask>, pictures: &[Pixmap], res: f64) {
    let (w, h) = (dest.width(), dest.height());
    let shadowed = it.effects.text.filter(|_| it.steps.iter().any(|s| s.words));
    for s in it.steps.iter().filter(|s| !(s.words && shadowed.is_some())) {
        let base = if s.words && it.words_clip.is_some() { words } else { other };
        let own = clipped(s, base, posed, w, h, res);
        step(dest, s, posed, if s.clips.is_empty() { base } else { own.as_ref() }, pictures);
    }
    if let Some(sh) = shadowed {
        // CSS text-shadow: the words' own silhouette, offset and blurred, under the words, the
        // whole group inside the words' clip.
        let (Some(mut group), Some(mut glyphs)) = (Pixmap::new(w, h), Pixmap::new(w, h)) else { return };
        for s in it.steps.iter().filter(|s| s.words) {
            step(&mut glyphs, s, posed, None, pictures);
        }
        if let Some(shadow) = shadow_of(&glyphs, sh.color, sh.sigma * res) {
            lay_offset(&mut group, &shadow, posed, sh.dx, sh.dy, None);
        }
        group.draw_pixmap(0, 0, glyphs.as_ref(), &PixmapPaint::default(), Transform::identity(), None);
        let mask = if it.words_clip.is_some() { words } else { other };
        dest.draw_pixmap(0, 0, group.as_ref(), &PixmapPaint::default(), Transform::identity(), mask);
    }
}

fn item(target: &mut Pixmap, layer: &mut Option<Pixmap>, plan: &Plan, pictures: &[Pixmap], it: &Item, outer: Option<&Mask>) {
    if it.opacity.is_nan() || it.opacity <= 0.0 || it.steps.is_empty() {
        return;
    }
    let (w, h) = (target.width(), target.height());
    let res = plan.scale.0.max(plan.scale.1);
    let base = compose(plan.scale, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
    let posed = compose(plan.scale, it.pose);
    // Only a row clip needs a mask of its own; otherwise the frame's is used as it is.
    let own: Option<Mask> = match &it.row_clip {
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
        None => None,
    };
    let item_mask: Option<&Mask> = own.as_ref().or(outer);
    let fx = &it.effects;
    if it.opacity >= 1.0 && !fx.layered() {
        let words = it.words_clip.as_ref().and_then(|o| outline_mask(o, posed, w, h, res, item_mask));
        steps_onto(target, it, posed, words.as_ref(), item_mask, pictures, res);
        return;
    }
    // On a layer of its own: the box shadow, the steps, the layer blur and the drop shadow,
    // then laid on the page once with the group's opacity and blend mode, inside its clips.
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
    if let Some((sh, o)) = &fx.box_shadow {
        // CSS box-shadow: the box outline moved and blurred, seen only outside the box.
        let mut moved = *o;
        moved.x += sh.dx;
        moved.y += sh.dy;
        if let (Some(mut shadow), Some(mut pb)) = (Pixmap::new(w, h), Some(PathBuilder::new())) {
            push_outline(&mut pb, &moved, res);
            if let (Some(path), Some(paint)) = (pb.finish(), color(sh.color)) {
                let paint = Paint { shader: Shader::SolidColor(paint), anti_alias: true, ..Paint::default() };
                shadow.fill_path(&path, &paint, FillRule::Winding, posed, None);
                let reach = (sh.sigma * res * 3.0) as usize + 3;
                if let Some(area) = blur::painted_area(shadow.data(), w as usize, h as usize, reach) {
                    blur::blur(shadow.data_mut(), w as usize, h as usize, sh.sigma * res, area);
                }
                if let Some(mut outside) = outline_mask(o, posed, w, h, res, None) {
                    outside.invert();
                    canvas.draw_pixmap(0, 0, shadow.as_ref(), &PixmapPaint::default(), Transform::identity(), Some(&outside));
                }
            }
        }
    }
    steps_onto(canvas, it, posed, words.as_ref(), None, pictures, res);
    if fx.blur > 0.0 {
        let reach = (fx.blur * res * 3.0) as usize + 3;
        if let Some(area) = blur::painted_area(canvas.data(), w as usize, h as usize, reach) {
            blur::blur(canvas.data_mut(), w as usize, h as usize, fx.blur * res, area);
        }
    }
    if let Some(sh) = &fx.drop {
        // CSS drop-shadow: the filtered element's silhouette, moved and blurred, under it.
        if let (Some(shadow), Some(mut group)) = (shadow_of(canvas, sh.color, sh.sigma * res), Pixmap::new(w, h)) {
            lay_offset(&mut group, &shadow, posed, sh.dx, sh.dy, None);
            group.draw_pixmap(0, 0, canvas.as_ref(), &PixmapPaint::default(), Transform::identity(), None);
            *canvas = group;
        }
    }
    let paint = PixmapPaint { opacity: it.opacity, blend_mode: fx.blend.unwrap_or(BlendMode::SourceOver), quality: FilterQuality::Nearest };
    target.draw_pixmap(0, 0, canvas.as_ref(), &paint, Transform::identity(), item_mask);
}

/// Draw an admitted plan. The result is premultiplied RGBA8, tiny-skia's own pixel format.
pub fn draw(plan: &Plan) -> Option<Pixmap> {
    let mut target = Pixmap::new(plan.pixel_width, plan.pixel_height)?;
    let mut layer: Option<Pixmap> = None;
    let pictures = pixmaps(plan)?;
    match &plan.frame {
        Some(frame) => item(&mut target, &mut layer, plan, &pictures, frame, None),
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
        item(&mut target, &mut layer, plan, &pictures, it, page_mask.as_ref());
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
