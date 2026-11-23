// SPDX-License-Identifier: MPL-2.0
//! The Node binding of `lolly-render` (plan 371, M3b slice 3).
//!
//! Thin on purpose: the envelope comes in as a string or a Buffer, and a result object
//! comes out with `ok` set. A drawn page carries its PNG (or straight RGBA8 with its
//! size); a refused page carries the stable code and sentence of its first reason and
//! the full list, never a thrown string the caller must parse. A panic inside the
//! renderer is caught here and returned as an `internal` refusal, so the Node process
//! keeps running. The `...Async` forms do the work on the libuv thread pool, so a render
//! never blocks the event loop. The limits are the core crate's own: an envelope over
//! `MAX_INPUT_BYTES` is refused before the renderer sees a byte.
//!
//! This crate holds only what Node-API needs: napi-rs's macros expand to unsafe calls,
//! so it cannot forbid unsafe code; `lolly-render` itself still does.

use lolly_render::admit::{MAX_INPUT_BYTES, MAX_PIXELS, MAX_SIDE};
use napi::bindgen_prelude::{AsyncTask, Buffer, Either};
use napi::{Env, Task};
use napi_derive::napi;
use std::panic::{catch_unwind, AssertUnwindSafe};

/// The code a caught panic is reported under. The core crate never returns this code.
pub const INTERNAL: &str = "internal";

/// One reason a page was not drawn.
#[napi(object)]
pub struct Refusal {
    pub code: String,
    /// The operation's row id, or empty for the page.
    pub id: String,
    pub detail: String,
}

/// What a render gives back. `ok` decides which fields are set.
#[napi(object)]
pub struct RenderResult {
    pub ok: bool,
    /// The PNG, from `renderPng`.
    pub png: Option<Buffer>,
    /// Straight RGBA8 rows, from `renderRgba`; the size is also set by `admit`.
    pub rgba: Option<Buffer>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// The first reason's code and sentence when `ok` is false.
    pub code: Option<String>,
    pub detail: Option<String>,
    /// Every reason, in order, when `ok` is false.
    pub refusals: Vec<Refusal>,
}

/// The work's own result, built off the JavaScript thread. Public only because the
/// thread-pool task's type includes this one; JavaScript sees `RenderResult`.
pub enum Outcome {
    Png(Vec<u8>),
    Rgba { width: u32, height: u32, rgba: Vec<u8> },
    Admitted { width: u32, height: u32 },
    Refused(Vec<(String, String, String)>),
}

fn refused(code: &str, detail: &str) -> Outcome {
    Outcome::Refused(vec![(code.to_string(), String::new(), detail.to_string())])
}

fn too_large() -> Outcome {
    refused("input-bytes", &format!("an input of more than {MAX_INPUT_BYTES} bytes"))
}

fn run(input: &[u8], rgba: bool) -> Outcome {
    if input.len() > MAX_INPUT_BYTES {
        return too_large();
    }
    guarded(|| {
        if rgba {
            lolly_render::render_json(input).map(|d| Outcome::Rgba { width: d.width, height: d.height, rgba: d.rgba })
        } else {
            lolly_render::render_png(input).map(Outcome::Png)
        }
    })
}

/// One render with any panic caught and turned into an `internal` refusal.
fn guarded(draw: impl FnOnce() -> Result<Outcome, Vec<lolly_render::Refusal>>) -> Outcome {
    match catch_unwind(AssertUnwindSafe(draw)) {
        Ok(Ok(outcome)) => outcome,
        Ok(Err(reasons)) => Outcome::Refused(reasons.into_iter().map(|r| (r.code.to_string(), r.id, r.detail)).collect()),
        Err(payload) => {
            let why = payload
                .downcast_ref::<&str>()
                .map(|s| s.to_string())
                .or_else(|| payload.downcast_ref::<String>().cloned())
                .unwrap_or_default();
            refused(INTERNAL, &format!("the renderer stopped on an internal error ({why}); nothing was drawn"))
        }
    }
}

fn to_js(outcome: Outcome) -> RenderResult {
    let none = RenderResult { ok: false, png: None, rgba: None, width: None, height: None, code: None, detail: None, refusals: Vec::new() };
    match outcome {
        Outcome::Png(png) => RenderResult { ok: true, png: Some(png.into()), ..none },
        Outcome::Rgba { width, height, rgba } => {
            RenderResult { ok: true, rgba: Some(rgba.into()), width: Some(width), height: Some(height), ..none }
        }
        Outcome::Admitted { width, height } => RenderResult { ok: true, width: Some(width), height: Some(height), ..none },
        Outcome::Refused(list) => RenderResult {
            code: list.first().map(|r| r.0.clone()),
            detail: list.first().map(|r| r.2.clone()),
            refusals: list.into_iter().map(|(code, id, detail)| Refusal { code, id, detail }).collect(),
            ..none
        },
    }
}

/// The envelope's bytes, copied once so the work owns them, or the size refusal.
fn bytes_of(envelope: &Either<String, Buffer>) -> Result<Vec<u8>, Outcome> {
    let bytes: &[u8] = match envelope {
        Either::A(s) => s.as_bytes(),
        Either::B(b) => b,
    };
    if bytes.len() > MAX_INPUT_BYTES {
        return Err(too_large());
    }
    Ok(bytes.to_vec())
}

/// Draw a page as a PNG, on the calling thread.
#[napi]
pub fn render_png(envelope: Either<String, Buffer>) -> RenderResult {
    to_js(bytes_of(&envelope).map_or_else(|refusal| refusal, |input| run(&input, false)))
}

/// Draw a page as straight RGBA8 with its size, on the calling thread.
#[napi]
pub fn render_rgba(envelope: Either<String, Buffer>) -> RenderResult {
    to_js(bytes_of(&envelope).map_or_else(|refusal| refusal, |input| run(&input, true)))
}

/// Read and check a page without drawing it: `ok` with the pixel size it would draw at,
/// or the refusals. As cheap as reading the JSON, so a caller can ask before it renders.
#[napi]
pub fn admit(envelope: Either<String, Buffer>) -> RenderResult {
    to_js(bytes_of(&envelope).map_or_else(
        |refusal| refusal,
        |input| {
            guarded(|| {
                lolly_render::admit_json(&input).map(|plan| Outcome::Admitted { width: plan.pixel_width, height: plan.pixel_height })
            })
        },
    ))
}

/// Straight RGBA8 rows of the stated size, checked before they are copied, or the reason not.
fn pixels_of(rgba: &Buffer, width: u32, height: u32) -> Result<Vec<u8>, Outcome> {
    if width == 0 || height == 0 || width > MAX_SIDE || height > MAX_SIDE || width as u64 * height as u64 > MAX_PIXELS {
        return Err(refused(
            "output-size",
            &format!("pixels of {width} x {height}, outside 1 to {MAX_SIDE} a side and {MAX_PIXELS} in all"),
        ));
    }
    if rgba.len() as u64 != width as u64 * height as u64 * 4 {
        return Err(refused("output-size", &format!("{} bytes of pixels for {width} x {height}", rgba.len())));
    }
    Ok(rgba.to_vec())
}

/// Encode straight RGBA8 rows as a PNG with the crate's encoder (adaptive filters,
/// deflate level 6), without a resolution chunk: for a caller that changes the pixels
/// after drawing them (the Lolly Imprint) and finishes the file itself.
#[napi]
pub fn encode_png(rgba: Buffer, width: u32, height: u32) -> RenderResult {
    to_js(
        pixels_of(&rgba, width, height)
            .map_or_else(|refusal| refusal, |data| guarded(|| Ok(Outcome::Png(lolly_render::encode_png(&data, width, height, None))))),
    )
}

/// Pixels checked against their stated size, waiting to be encoded.
pub struct Pixels {
    data: Vec<u8>,
    width: u32,
    height: u32,
}

/// One encode waiting for, or running on, the libuv thread pool.
pub struct EncodeTask {
    work: Option<Result<Pixels, Outcome>>,
}

impl Task for EncodeTask {
    type Output = Outcome;
    type JsValue = RenderResult;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(match self.work.take() {
            Some(Ok(p)) => guarded(|| Ok(Outcome::Png(lolly_render::encode_png(&p.data, p.width, p.height, None)))),
            Some(Err(refusal)) => refusal,
            None => refused(INTERNAL, "the encode was started twice; nothing was written"),
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(to_js(output))
    }
}

/// `encodePng` on the libuv thread pool.
#[napi]
pub fn encode_png_async(rgba: Buffer, width: u32, height: u32) -> AsyncTask<EncodeTask> {
    AsyncTask::new(EncodeTask { work: Some(pixels_of(&rgba, width, height).map(|data| Pixels { data, width, height })) })
}

/// One render waiting for, or running on, the libuv thread pool.
pub struct RenderTask {
    work: Option<Result<Vec<u8>, Outcome>>,
    rgba: bool,
}

impl Task for RenderTask {
    type Output = Outcome;
    type JsValue = RenderResult;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(match self.work.take() {
            Some(Ok(input)) => run(&input, self.rgba),
            Some(Err(refusal)) => refusal,
            None => refused(INTERNAL, "the render was started twice; nothing was drawn"),
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(to_js(output))
    }
}

fn task(envelope: Either<String, Buffer>, rgba: bool) -> AsyncTask<RenderTask> {
    AsyncTask::new(RenderTask { work: Some(bytes_of(&envelope)), rgba })
}

/// `renderPng` on the libuv thread pool; resolves with the same result object.
#[napi]
pub fn render_png_async(envelope: Either<String, Buffer>) -> AsyncTask<RenderTask> {
    task(envelope, false)
}

/// `renderRgba` on the libuv thread pool; resolves with the same result object.
#[napi]
pub fn render_rgba_async(envelope: Either<String, Buffer>) -> AsyncTask<RenderTask> {
    task(envelope, true)
}

/// The renderer this build records, in the core crate's own words.
#[napi]
pub fn renderer() -> String {
    lolly_render::RENDERER.to_string()
}

/// Every stable refusal code, in order: the core crate's, then `internal`.
#[napi]
pub fn refusal_codes() -> Vec<String> {
    lolly_render::REFUSAL_CODES.iter().chain(std::iter::once(&INTERNAL)).map(|c| c.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn codes(outcome: &Outcome) -> Vec<String> {
        match outcome {
            Outcome::Refused(list) => list.iter().map(|r| r.0.clone()).collect(),
            _ => Vec::new(),
        }
    }

    #[test]
    fn a_panic_is_an_internal_refusal() {
        let outcome = guarded(|| panic!("a test panic"));
        assert_eq!(codes(&outcome), ["internal"]);
        if let Outcome::Refused(list) = outcome {
            assert!(list[0].2.contains("a test panic"), "{}", list[0].2);
        }
        let owned = guarded(|| panic!("{}", String::from("an owned message")));
        assert_eq!(codes(&owned), ["internal"]);
    }

    #[test]
    fn refusals_keep_their_codes_in_order() {
        assert_eq!(codes(&run(b"{", false)), ["input-json"]);
        assert_eq!(codes(&run(b"", true)), ["input-json"]);
    }

    #[test]
    fn a_fixture_draws_the_same_pixels_as_png_and_rgba() {
        let fixture = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../lolly-render/tests/fixtures/shapes.json")).unwrap();
        let Outcome::Png(png) = run(&fixture, false) else { panic!("not drawn") };
        assert_eq!(&png[1..4], b"PNG");
        let Outcome::Rgba { width, height, rgba } = run(&fixture, true) else { panic!("not drawn") };
        assert_eq!(rgba.len(), (width * height * 4) as usize);
        assert_eq!(png, lolly_render::encode_png(&rgba, width, height, Some(96.0)));
    }

    #[test]
    fn encoding_pixels_writes_the_crate_png_without_a_resolution() {
        let fixture = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../lolly-render/tests/fixtures/shapes.json")).unwrap();
        let Outcome::Rgba { width, height, rgba } = run(&fixture, true) else { panic!("not drawn") };
        let encoded = lolly_render::encode_png(&rgba, width, height, None);
        assert!(!encoded.windows(4).any(|w| w == b"pHYs"));
        assert_eq!(&encoded[1..4], b"PNG");
    }

    #[test]
    fn every_refusal_code_is_listed_once() {
        let mut all: Vec<&str> = lolly_render::REFUSAL_CODES.to_vec();
        all.push(INTERNAL);
        let mut sorted = all.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), all.len());
    }
}
