// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned camera raw decoder.
//!
//! The host copies the raw file in, runs one development and copies the result out. The pixel
//! buffer and a small JSON description are separate results (`camera_raw_result_*` and
//! `camera_raw_meta_*`). A failure puts a UTF-8 message in the pixel result and returns a non-zero
//! status. Nothing here keeps a clock, a random source or an import.
#![deny(unsafe_op_in_unsafe_fn)]

mod color;
mod exif;

use std::cell::RefCell;
use std::collections::BTreeMap;

use photocraft_raw as raw;

/// Largest raw file accepted.
const MAX_INPUT: usize = 192 * 1024 * 1024;
/// The module is linked with a 512 MiB memory ceiling; keep clear of it for the stack and heap slack.
const MEMORY_BUDGET: usize = 480 * 1024 * 1024;
/// Largest sensor accepted, in pixels, and the largest single buffer the decoder may allocate.
const MAX_PIXELS: u64 = 64 * 1000 * 1000;
const MAX_BUFFER: u64 = 256 * 1024 * 1024;
/// Allowance for the decoder's tables and bands, which the checks below do not itemise.
const WORKING_SLACK: usize = 24 * 1024 * 1024;
/// Smallest preview long edge preferred for the colour fit.
const FIT_EDGE: u32 = 512;
const MAX_WARNINGS: usize = 24;

pub const STATUS_OK: u32 = 0;
pub const STATUS_FAILED: u32 = 1;
pub const STATUS_LIMIT: u32 = 2;
/// A recognised raw variant the decoder cannot read; `MODE_PREVIEW` may still open its JPEG preview.
pub const STATUS_UNSUPPORTED: u32 = 3;
pub const STATUS_NOT_RAW: u32 = 4;

/// Linear ProPhoto RGB, 16-bit, three samples per pixel, little-endian.
pub const MODE_LINEAR16: u32 = 0;
/// sRGB-encoded 8-bit RGBA for display.
pub const MODE_DISPLAY8: u32 = 1;
/// The camera's embedded JPEG preview as sRGB 8-bit RGBA (not sensor data).
pub const MODE_PREVIEW8: u32 = 2;
/// Format and capture facts only, no pixels.
pub const MODE_PROBE: u32 = 3;

/// `Packed` holds bytes packed two to a `u16` word (little-endian), so display output can reuse the 16-bit frame in place.
enum Pixels { None, U8(Vec<u8>), U16(Vec<u16>), Packed(Vec<u16>, usize) }

#[derive(Default)]
struct State { inputs: BTreeMap<usize, Vec<u8>>, allocated: usize, pixels: Option<Pixels>, meta: Vec<u8>, message: Vec<u8> }
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

type Fail = (u32, String);

fn mib(bytes: usize) -> usize { bytes.div_ceil(1024 * 1024) }

fn map_error(e: raw::RawError) -> Fail {
    match e {
        raw::RawError::NotRaw => (STATUS_NOT_RAW, "This file is not a camera raw file.".into()),
        raw::RawError::Unsupported(m) => (STATUS_UNSUPPORTED, m),
        raw::RawError::Malformed(m) => (STATUS_FAILED, format!("This raw file is damaged or inconsistent: {m}")),
        raw::RawError::LimitExceeded(m) => (STATUS_LIMIT, format!("This raw file is larger than the 512 MiB on-device limit allows: {m}")),
    }
}

// ---- JSON ----

fn json_str(text: &str, out: &mut String) {
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}
fn json_num(v: f64, out: &mut String) {
    if v.is_finite() { out.push_str(&format!("{v}")); } else { out.push_str("null"); }
}
fn json_opt<T>(v: Option<T>, out: &mut String, f: impl FnOnce(T, &mut String)) {
    match v { Some(v) => f(v, out), None => out.push_str("null") }
}
fn json_list(values: &[f64], out: &mut String) {
    out.push('[');
    for (i, v) in values.iter().enumerate() { if i > 0 { out.push(','); } json_num(*v, out); }
    out.push(']');
}
fn flat(m: &raw::Mat3) -> Vec<f64> { m.iter().flatten().copied().collect() }

// ---- preview decoding ----

struct Rgb8 { rgb: Vec<u8>, width: usize, height: usize }

/// How a decoded preview is read: sRGB, or one of two wider spaces named by its profile or the raw's EXIF.
#[derive(Clone, Copy, PartialEq)]
enum PreviewSpace { Srgb, Adobe, P3 }

fn space_of(icc: Option<&[u8]>, stated: Option<raw::PreviewColorSpace>) -> PreviewSpace {
    if let Some(icc) = icc {
        let has = |needle: &[u8]| icc.windows(needle.len()).any(|w| w == needle);
        if has(b"Adobe RGB") { return PreviewSpace::Adobe; }
        if has(b"Display P3") { return PreviewSpace::P3; }
        return PreviewSpace::Srgb;
    }
    if stated == Some(raw::PreviewColorSpace::AdobeRgb) { PreviewSpace::Adobe } else { PreviewSpace::Srgb }
}

fn to_srgb8(rgb: &mut [u8], space: PreviewSpace) {
    if space == PreviewSpace::Srgb { return; }
    let (matrix, adobe) = if space == PreviewSpace::Adobe { (color::ADOBE_TO_SRGB, true) } else { (color::P3_TO_SRGB, false) };
    let decode: Vec<f64> = (0..256).map(|i| { let v = i as f64 / 255.0; if adobe { v.powf(2.199_218_75) } else { color::srgb_decode(v) } }).collect();
    for px in rgb.chunks_exact_mut(3) {
        let lin = [decode[usize::from(px[0])], decode[usize::from(px[1])], decode[usize::from(px[2])]];
        for k in 0..3 {
            let v = matrix[k][0] * lin[0] + matrix[k][1] * lin[1] + matrix[k][2] * lin[2];
            px[k] = (color::srgb_encode(v) * 255.0 + 0.5) as u8;
        }
    }
}

/// Decode one embedded JPEG to upright sRGB 8-bit RGB within `budget` bytes of working memory.
fn decode_preview(raw_bytes: &[u8], jpeg: &[u8], budget: usize) -> Result<Rgb8, String> {
    use zune_core::{bytestream::ZCursor, colorspace::ColorSpace, options::DecoderOptions};
    let options = DecoderOptions::default().jpeg_set_out_colorspace(ColorSpace::RGB).set_max_width(1 << 15).set_max_height(1 << 15);
    let mut dec = zune_jpeg::JpegDecoder::new_with_options(ZCursor::new(jpeg), options);
    dec.decode_headers().map_err(|e| format!("the embedded preview header does not read: {e:?}"))?;
    let info = dec.info().ok_or("the embedded preview has no header")?;
    let (w, h) = (usize::from(info.width), usize::from(info.height));
    let need = w.checked_mul(h).and_then(|n| n.checked_mul(6)).ok_or("the embedded preview is too large")?;
    if need > budget { return Err(format!("the embedded {w}x{h} preview does not fit in memory")); }
    let icc = dec.icc_profile();
    let mut rgb = dec.decode().map_err(|e| format!("the embedded preview does not decode: {e:?}"))?;
    if rgb.len() != w * h * 3 { return Err("the embedded preview is not 8-bit RGB".into()); }
    to_srgb8(&mut rgb, space_of(icc.as_deref(), raw::embedded_preview_color_space(raw_bytes)));
    // The JPEG's own EXIF orientation wins; otherwise the raw's applies (previews are stored as the sensor reads out).
    let own = exif::read_jpeg(jpeg).and_then(|e| e.orientation);
    let o = own.or_else(|| raw::orientation(raw_bytes)).unwrap_or(1);
    let (rgb, width, height) = color::orient(rgb, w, h, o);
    Ok(Rgb8 { rgb, width, height })
}

/// The preview to fit against: the smallest at least `FIT_EDGE` long, else the largest.
fn fit_preview<'a>(previews: &'a [raw::Preview<'a>]) -> Option<&'a raw::Preview<'a>> {
    let long = |p: &raw::Preview| p.width.max(p.height);
    previews.iter().filter(|p| long(p) >= FIT_EDGE).min_by_key(|p| long(p)).or_else(|| previews.iter().max_by_key(|p| long(p)))
}

/// Fit the colour to the camera JPEG. `Err` says why there is no fit.
fn fit(bytes: &[u8], sensor: &raw::Sensor, opts: &raw::DevelopOptions, budget: usize) -> Result<raw::CameraLook, String> {
    let previews = raw::embedded_previews(bytes);
    let pick = fit_preview(&previews).ok_or("no embedded JPEG preview")?;
    let img = decode_preview(bytes, pick.jpeg, budget)?;
    raw::fit_look(sensor, opts, &raw::Reference { width: img.width as u32, height: img.height as u32, rgb: &img.rgb }).map_err(|e| e.0)
}

// ---- development ----

fn demosaic_of(id: u32) -> raw::Demosaic {
    match id { 1 => raw::Demosaic::Mhc, 2 => raw::Demosaic::Bilinear, _ => raw::Demosaic::Ahd }
}

struct Described<'a> {
    format: &'a str,
    make: Option<&'a str>,
    model: Option<&'a str>,
    width: usize,
    height: usize,
    exif: &'a exif::Exif,
    orientation: Option<u16>,
    baseline_exposure: Option<f64>,
    wb: Option<([f64; 3], bool, Option<[f64; 3]>)>,
    color: ColorFacts<'a>,
    cfa: Option<&'a str>,
    encoding: &'a str,
    demosaic: Option<&'a str>,
    preview_only: bool,
    warnings: &'a [String],
}

struct ColorFacts<'a> {
    exact: bool,
    method: &'a str,
    delta_e: Option<(f64, f64)>,
    sensor: Option<&'a raw::Sensor>,
    to_xyz: Option<raw::Mat3>,
}

fn describe(d: &Described) -> String {
    let mut o = String::from("{\"schema\":1,\"format\":");
    json_str(d.format, &mut o);
    o.push_str(",\"make\":"); json_opt(d.make.or(d.exif.make.as_deref()), &mut o, |v, o| json_str(v, o));
    o.push_str(",\"model\":"); json_opt(d.model.or(d.exif.model.as_deref()), &mut o, |v, o| json_str(v, o));
    o.push_str(&format!(",\"width\":{},\"height\":{}", d.width, d.height));
    o.push_str(",\"iso\":"); json_opt(d.exif.iso, &mut o, |v, o| o.push_str(&v.to_string()));
    o.push_str(",\"exposureTime\":"); json_opt(d.exif.exposure_time, &mut o, json_num);
    o.push_str(",\"fNumber\":"); json_opt(d.exif.f_number, &mut o, json_num);
    o.push_str(",\"baselineExposure\":"); json_opt(d.baseline_exposure, &mut o, json_num);
    o.push_str(",\"orientation\":"); json_opt(d.orientation, &mut o, |v, o| o.push_str(&v.to_string()));
    o.push_str(",\"orientationApplied\":"); o.push_str(if d.encoding == "none" { "false" } else { "true" });
    o.push_str(",\"whiteBalance\":");
    match &d.wb {
        Some((mult, as_shot, neutral)) => {
            o.push_str("{\"source\":"); json_str(if *as_shot { "as-shot" } else { "estimated" }, &mut o);
            o.push_str(",\"multipliers\":"); json_list(mult, &mut o);
            o.push_str(",\"asShotNeutral\":"); json_opt(neutral.as_ref(), &mut o, |v, o| json_list(v, o));
            o.push('}');
        }
        None => o.push_str("null"),
    }
    o.push_str(",\"color\":{\"exact\":"); o.push_str(if d.color.exact { "true" } else { "false" });
    o.push_str(",\"label\":"); json_str(if d.color.exact { "exact colour" } else { "approximate colour" }, &mut o);
    o.push_str(",\"method\":"); json_str(d.color.method, &mut o);
    o.push_str(",\"deltaE\":"); json_opt(d.color.delta_e.map(|v| v.0), &mut o, json_num);
    o.push_str(",\"deltaEFallback\":"); json_opt(d.color.delta_e.map(|v| v.1), &mut o, json_num);
    o.push_str(",\"cameraToXyzD50\":"); json_opt(d.color.to_xyz.as_ref(), &mut o, |m, o| json_list(&flat(m), o));
    o.push_str(",\"analogBalance\":");
    json_opt(d.color.sensor.and_then(|s| s.color.analog_balance), &mut o, |v, o| json_list(&v, o));
    o.push_str(",\"calibrations\":[");
    if let Some(s) = d.color.sensor {
        for (i, c) in s.color.calibrations.iter().enumerate() {
            if i > 0 { o.push(','); }
            o.push_str("{\"temperature\":"); json_num(c.temperature, &mut o);
            o.push_str(",\"colorMatrix\":"); json_list(&flat(&c.color_matrix), &mut o);
            o.push_str(",\"forwardMatrix\":"); json_opt(c.forward_matrix.as_ref(), &mut o, |m, o| json_list(&flat(m), o));
            o.push_str(",\"cameraCalibration\":"); json_list(&flat(&c.camera_calibration), &mut o);
            o.push('}');
        }
    }
    o.push_str("]},\"cfa\":"); json_opt(d.cfa, &mut o, |v, o| json_str(v, o));
    o.push_str(",\"demosaic\":"); json_opt(d.demosaic, &mut o, |v, o| json_str(v, o));
    o.push_str(",\"encoding\":"); json_str(d.encoding, &mut o);
    o.push_str(",\"previewOnly\":"); o.push_str(if d.preview_only { "true" } else { "false" });
    o.push_str(",\"warnings\":[");
    for (i, w) in d.warnings.iter().take(MAX_WARNINGS).enumerate() {
        if i > 0 { o.push(','); }
        json_str(&w.chars().take(400).collect::<String>(), &mut o);
    }
    o.push_str("]}");
    o
}

fn rgba_from_rgb(rgb: Vec<u8>) -> Vec<u8> {
    let mut out = Vec::with_capacity(rgb.len() / 3 * 4);
    for px in rgb.chunks_exact(3) { out.extend_from_slice(&[px[0], px[1], px[2], 255]); }
    out
}

/// Gamma 1.8 ProPhoto samples to display RGBA, in place: pixel `i` is read from words `3i..3i+3` and
/// written to words `2i..2i+2`, which never overtakes data not yet read. Returns the RGBA byte count.
fn display_in_place(buf: &mut Vec<u16>) -> usize {
    let m = color::prophoto_to_srgb();
    let lin: Vec<f32> = (0..=65535u32).map(|v| (f64::from(v) / 65535.0).powf(1.8) as f32).collect();
    let enc: Vec<u8> = (0..=4095u32).map(|i| (color::srgb_encode(f64::from(i) / 4095.0) * 255.0 + 0.5) as u8).collect();
    let mf: [[f32; 3]; 3] = m.map(|r| r.map(|v| v as f32));
    let n = buf.len() / 3;
    for i in 0..n {
        let c = [lin[usize::from(buf[3 * i])], lin[usize::from(buf[3 * i + 1])], lin[usize::from(buf[3 * i + 2])]];
        let mut px = [0u8; 3];
        for (k, row) in mf.iter().enumerate() {
            let v = (row[0] * c[0] + row[1] * c[1] + row[2] * c[2]).clamp(0.0, 1.0);
            px[k] = enc[(v * 4095.0 + 0.5) as usize];
        }
        buf[2 * i] = u16::from(px[0]) | (u16::from(px[1]) << 8);
        buf[2 * i + 1] = u16::from(px[2]) | (255 << 8);
    }
    buf.truncate(2 * n);
    4 * n
}

/// Gamma 1.8 ProPhoto samples to linear ProPhoto, in place.
fn linearise(rgb: &mut [u16]) {
    let lin: Vec<u16> = (0..=65535u32).map(|v| ((f64::from(v) / 65535.0).powf(1.8) * 65535.0 + 0.5) as u16).collect();
    for v in rgb { *v = lin[usize::from(*v)]; }
}

fn probe(bytes: &[u8]) -> Result<(Pixels, String), Fail> {
    let format = raw::identify(bytes).ok_or_else(|| map_error(raw::RawError::NotRaw))?;
    let mut e = exif::read_tiff(bytes).unwrap_or_default();
    if e.iso.is_none() && e.exposure_time.is_none() {
        if let Some(p) = raw::embedded_preview(bytes) { if let Some(j) = exif::read_jpeg(p.jpeg) { e.iso = j.iso; e.exposure_time = j.exposure_time; e.f_number = j.f_number; e.make = e.make.or(j.make); e.model = e.model.or(j.model); } }
    }
    let orientation = raw::orientation(bytes).or(e.orientation);
    let d = Described { format: format.name(), make: None, model: None, width: 0, height: 0, exif: &e, orientation, baseline_exposure: None, wb: None,
        color: ColorFacts { exact: false, method: "unknown", delta_e: None, sensor: None, to_xyz: None }, cfa: None, encoding: "none", demosaic: None, preview_only: false, warnings: &[] };
    Ok((Pixels::None, describe(&d)))
}

fn preview8(bytes: &[u8], mut warnings: Vec<String>) -> Result<(Pixels, String), Fail> {
    let format = raw::identify(bytes).ok_or_else(|| map_error(raw::RawError::NotRaw))?;
    let previews = raw::embedded_previews(bytes);
    let mut by_size: Vec<&raw::Preview> = previews.iter().collect();
    by_size.sort_by_key(|p| std::cmp::Reverse(u64::from(p.width) * u64::from(p.height)));
    let budget = MEMORY_BUDGET.saturating_sub(bytes.len() + WORKING_SLACK);
    let mut last = String::from("This raw file has no embedded JPEG preview to open instead.");
    for p in by_size {
        match decode_preview(bytes, p.jpeg, budget) {
            Ok(img) => {
                let mut e = exif::read_tiff(bytes).unwrap_or_default();
                if let Some(j) = exif::read_jpeg(p.jpeg) { e.iso = e.iso.or(j.iso); e.exposure_time = e.exposure_time.or(j.exposure_time); e.f_number = e.f_number.or(j.f_number); e.make = e.make.or(j.make); e.model = e.model.or(j.model); }
                warnings.push(format!("Opened the camera's embedded {}x{} JPEG preview, not the raw sensor data.", p.width, p.height));
                let (w, h) = (img.width, img.height);
                let d = Described { format: format.name(), make: None, model: None, width: w, height: h, exif: &e, orientation: raw::orientation(bytes).or(e.orientation), baseline_exposure: None, wb: None,
                    color: ColorFacts { exact: false, method: "camera-jpeg", delta_e: None, sensor: None, to_xyz: None }, cfa: None, encoding: "srgb-8-rgba", demosaic: None, preview_only: true, warnings: &warnings };
                return Ok((Pixels::U8(rgba_from_rgb(img.rgb)), describe(&d)));
            }
            Err(m) => last = m,
        }
    }
    Err((STATUS_UNSUPPORTED, last))
}

fn develop(bytes: &[u8], mode: u32, demosaic_id: u32) -> Result<(Pixels, String), Fail> {
    let format = raw::identify(bytes).ok_or_else(|| map_error(raw::RawError::NotRaw))?;
    let limits = raw::Limits { max_width: 1 << 16, max_height: 1 << 16, max_pixels: MAX_PIXELS, max_alloc: MAX_BUFFER };
    let sensor = raw::decode(bytes, &limits).map_err(map_error)?;
    let crop = sensor.crop.width.saturating_mul(sensor.crop.height);
    let sensor_bytes = sensor.data.len().saturating_mul(2);
    let display = mode == MODE_DISPLAY8;
    let need = bytes.len().saturating_add(sensor_bytes).saturating_add(crop.saturating_mul(6)).saturating_add(WORKING_SLACK);
    if need > MEMORY_BUDGET {
        return Err((STATUS_LIMIT, format!("This {} megapixel raw file needs about {} MiB to develop; the on-device limit is 512 MiB. Export a smaller DNG or a JPEG from your camera software.", crop.div_ceil(1_000_000), mib(need))));
    }
    let mut warnings: Vec<String> = Vec::new();
    let mut opts = raw::DevelopOptions { demosaic: demosaic_of(demosaic_id), limits, ..Default::default() };
    let mono = sensor.is_monochrome();
    let needs_fit = sensor.color.calibrations.is_empty() && !mono;
    let mut look_facts: Option<(f64, f64, raw::Mat3)> = None;
    if needs_fit {
        let spare = MEMORY_BUDGET.saturating_sub(need);
        match fit(bytes, &sensor, &opts, spare) {
            Ok(look) => { look_facts = Some((look.delta_e, look.delta_e_fallback, look.to_xyz)); opts.camera_look = Some(look); }
            Err(why) => warnings.push(format!("Approximate colour: no fit to the camera's JPEG ({why}); a neutral rendering is used.")),
        }
    }
    let dev = raw::develop_sensor(&sensor, &opts).map_err(map_error)?;
    let raw::Developed { width, height, mut rgb, info, warnings: dev_warnings } = dev;
    warnings.extend(dev_warnings);

    let has_profile = !sensor.tone_curve.is_empty();
    let (exact, method) = if mono { (true, "monochrome") }
        else if look_facts.is_some() { (false, "embedded-jpeg-fit") }
        else if !sensor.color.calibrations.is_empty() { (true, "dng-matrices") }
        else if has_profile { (false, "camera-profile") }
        else { (false, "neutral-fallback") };
    if !exact { warnings.insert(0, "Approximate colour: this format has no embedded colour matrices, so the colour is an estimate.".into()); }

    let mut e = exif::read_tiff(bytes).unwrap_or_default();
    if e.iso.is_none() && e.exposure_time.is_none() {
        if let Some(j) = raw::embedded_preview(bytes).and_then(|p| exif::read_jpeg(p.jpeg)) { e.iso = j.iso; e.exposure_time = j.exposure_time; e.f_number = j.f_number; }
    }
    let as_shot = sensor.color.as_shot_neutral.is_some() || sensor.color.as_shot_white_xy.is_some() || sensor.camera_wb.is_some();
    let neutral = sensor.color.as_shot_neutral;
    let d = Described {
        format: format.name(), make: info.make.as_deref(), model: info.model.as_deref(), width: width as usize, height: height as usize, exif: &e,
        orientation: Some(info.orientation), baseline_exposure: Some(info.baseline_exposure),
        wb: if mono { None } else { Some((info.wb_multipliers, as_shot, neutral)) },
        color: ColorFacts { exact, method, delta_e: look_facts.as_ref().map(|l| (l.0, l.1)), sensor: Some(&sensor), to_xyz: look_facts.map(|l| l.2) },
        cfa: info.cfa.as_deref(), encoding: if display { "srgb-8-rgba" } else { "linear-prophoto-16" }, demosaic: Some(opts.demosaic.id()), preview_only: false, warnings: &warnings,
    };
    let meta = describe(&d);
    drop(d);
    drop(sensor);
    if display {
        let bytes = display_in_place(&mut rgb);
        Ok((Pixels::Packed(rgb, bytes), meta))
    } else {
        linearise(&mut rgb);
        Ok((Pixels::U16(rgb), meta))
    }
}

fn dispatch(bytes: &[u8], mode: u32, demosaic_id: u32) -> Result<(Pixels, String), Fail> {
    if bytes.len() > MAX_INPUT { return Err((STATUS_LIMIT, format!("Choose a raw file smaller than {} MiB for on-device development.", MAX_INPUT / 1024 / 1024))); }
    match mode {
        MODE_LINEAR16 | MODE_DISPLAY8 => develop(bytes, mode, demosaic_id),
        MODE_PREVIEW8 => preview8(bytes, Vec::new()),
        MODE_PROBE => probe(bytes),
        _ => Err((STATUS_FAILED, "Unknown camera raw mode.".into())),
    }
}

// ---- C ABI ----

#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = Vec::new();
        if bytes.try_reserve_exact(length).is_err() { return 0; }
        bytes.resize(length, 0);
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes);
        s.allocated += length;
        ptr
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}

/// Develop the raw file at `ptr` (from `camera_raw_alloc`). `mode` is one of the `MODE_` values and
/// `demosaic` is 0 for the best method (AHD), 1 for MHC and 2 for the fastest.
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_run(ptr: usize, length: usize, mode: u32, demosaic: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.pixels = None; s.meta = Vec::new(); s.message = Vec::new();
        let result = match s.inputs.get(&ptr).filter(|b| b.len() == length) {
            None => Err((STATUS_FAILED, "Invalid camera raw input buffer".to_string())),
            Some(input) => dispatch(input, mode, demosaic),
        };
        match result {
            Ok((pixels, meta)) => { s.pixels = Some(pixels); s.meta = meta.into_bytes(); STATUS_OK }
            Err((status, message)) => { s.message = message.into_bytes(); status }
        }
    })
}

/// Drop the last result so its memory is free for the next file.
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_release() {
    STATE.with(|s| { let mut s = s.borrow_mut(); s.pixels = None; s.meta = Vec::new(); s.message = Vec::new(); });
}

#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_result_ptr() -> usize {
    STATE.with(|s| match &s.borrow().pixels {
        Some(Pixels::U8(v)) => v.as_ptr() as usize,
        Some(Pixels::U16(v) | Pixels::Packed(v, _)) => v.as_ptr() as usize,
        _ => 0,
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_result_len() -> usize {
    STATE.with(|s| match &s.borrow().pixels { Some(Pixels::U8(v)) => v.len(), Some(Pixels::U16(v)) => v.len() * 2, Some(Pixels::Packed(_, bytes)) => *bytes, _ => 0 })
}
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_meta_ptr() -> usize { STATE.with(|s| s.borrow().meta.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_meta_len() -> usize { STATE.with(|s| s.borrow().meta.len()) }
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_message_ptr() -> usize { STATE.with(|s| s.borrow().message.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn camera_raw_message_len() -> usize { STATE.with(|s| s.borrow().message.len()) }
