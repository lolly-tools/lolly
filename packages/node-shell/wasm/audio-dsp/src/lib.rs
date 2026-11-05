// SPDX-License-Identifier: MPL-2.0
//! Bounded byte-oriented WASM interface to the pinned FilmCraft audio DSP crate.
//!
//! One module, many operations. The raw ABI is `audio_dsp_alloc`, `_free`, `_run`,
//! `_result_ptr` and `_result_len`; `_run` takes an operation number. The module
//! imports nothing from the host and reads no clock or random source, so the same
//! bytes in give the same bytes out in every runtime.
//!
//! Wire format, request and reply alike: a little-endian `u32` JSON length, the JSON
//! header, then raw little-endian `f32` samples. Multi-channel samples are planar:
//! all frames of channel 0, then channel 1, and so on. Long recordings are fed in
//! chunks through sessions (a loudness meter or an effect chain), so memory stays
//! bounded and the result does not depend on where the chunks were cut.
#![deny(unsafe_op_in_unsafe_fn)]

use filmcraft_audio_dsp::effects::{ClickRemover, DeEsser, DeHum, DeNoise, DeReverb};
use filmcraft_audio_dsp::loudness::LoudnessMeter;
use filmcraft_audio_dsp::sync::{SyncOptions, find_offset};
use filmcraft_audio_dsp::AudioEffect;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;

const MAX_INPUT: usize = 160 * 1024 * 1024;
const MAX_OUTPUT: usize = 160 * 1024 * 1024;
const MAX_HEADER: usize = 64 * 1024;
const MAX_SESSIONS: usize = 8;
const MAX_CHANNELS: usize = 8;
const MAX_CHAIN: usize = 8;
const MAX_SYNC_SAMPLES: usize = 12 * 1024 * 1024;
const MIN_RATE: f64 = 8_000.0;
const MAX_RATE: f64 = 192_000.0;

const OP_METER_OPEN: u32 = 1;
const OP_METER_PUSH: u32 = 2;
const OP_METER_READ: u32 = 3;
const OP_FX_OPEN: u32 = 4;
const OP_FX_PROCESS: u32 = 5;
const OP_FX_FLUSH: u32 = 6;
const OP_SYNC: u32 = 7;
const OP_CLOSE: u32 = 8;

struct Meter {
    meter: LoudnessMeter,
    channels: usize,
    sub_len: usize,
    fed: u64,
    series: bool,
}

enum Stage {
    DeHum(DeHum),
    DeNoise(DeNoise),
    DeEsser(DeEsser),
    DeReverb(DeReverb),
    Declick(ClickRemover),
}

impl Stage {
    fn fx(&mut self) -> &mut dyn AudioEffect {
        match self {
            Stage::DeHum(e) => e,
            Stage::DeNoise(e) => e,
            Stage::DeEsser(e) => e,
            Stage::DeReverb(e) => e,
            Stage::Declick(e) => e,
        }
    }
}

struct Chain {
    stages: Vec<Stage>,
    channels: usize,
    /// Output samples still to discard so the chain's delay does not shift the audio.
    to_drop: usize,
    latency: usize,
}

enum Session {
    Meter(Meter),
    Chain(Chain),
}

#[derive(Default)]
struct State {
    inputs: BTreeMap<usize, Vec<u8>>,
    output: Vec<u8>,
    allocated: usize,
    next: u32,
    sessions: BTreeMap<u32, Session>,
}
thread_local! { static STATE: RefCell<State> = RefCell::new(State::default()); }

// ---------------------------------------------------------------- wire helpers

fn split(bytes: &[u8]) -> Result<(&[u8], &[u8]), String> {
    let head: [u8; 4] = bytes.get(..4).and_then(|b| b.try_into().ok()).ok_or("Request is too short")?;
    let n = u32::from_le_bytes(head) as usize;
    if n > MAX_HEADER { return Err("Request header is too large".into()); }
    let json = bytes.get(4..4 + n).ok_or("Request header is truncated")?;
    Ok((json, &bytes[4 + n..]))
}

fn header<'a, T: Deserialize<'a>>(json: &'a [u8]) -> Result<T, String> {
    serde_json::from_slice(json).map_err(|e| format!("Invalid request: {e}"))
}

/// Little-endian f32 samples to planar channels. Non-finite samples become silence so one
/// bad sample cannot poison a running meter.
fn planar(data: &[u8], channels: usize) -> Result<Vec<Vec<f32>>, String> {
    if data.len() % 4 != 0 { return Err("Sample data is not a whole number of floats".into()); }
    let total = data.len() / 4;
    if channels == 0 || total % channels != 0 { return Err("Sample count does not divide by the channel count".into()); }
    let frames = total / channels;
    Ok((0..channels).map(|c| {
        data[c * frames * 4..(c + 1) * frames * 4].chunks_exact(4)
            .map(|b| { let v = f32::from_le_bytes([b[0], b[1], b[2], b[3]]); if v.is_finite() { v } else { 0.0 } })
            .collect()
    }).collect())
}

fn reply<T: Serialize>(head: &T, channels: &[Vec<f32>]) -> Result<Vec<u8>, String> {
    let json = serde_json::to_vec(head).map_err(|e| e.to_string())?;
    let samples: usize = channels.iter().map(Vec::len).sum();
    if 4 + json.len() + samples * 4 > MAX_OUTPUT { return Err("Result exceeds the byte budget".into()); }
    let mut out = Vec::with_capacity(4 + json.len() + samples * 4);
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&json);
    for c in channels { for v in c { out.extend_from_slice(&v.to_le_bytes()); } }
    Ok(out)
}

fn finite(x: f64) -> Option<f64> { if x.is_finite() { Some(x) } else { None } }

fn check_rate(rate: f64) -> Result<f64, String> {
    if rate.is_finite() && (MIN_RATE..=MAX_RATE).contains(&rate) && rate.fract() == 0.0 { Ok(rate) } else { Err("Sample rate must be a whole number from 8000 to 192000".into()) }
}
fn check_channels(n: usize) -> Result<usize, String> {
    if (1..=MAX_CHANNELS).contains(&n) { Ok(n) } else { Err("Channel count must be 1 to 8".into()) }
}

// ---------------------------------------------------------------- loudness

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MeterOpen { sample_rate: f64, channels: usize, #[serde(default)] series: bool }

#[derive(Serialize)]
struct Handle { handle: u32 }

#[derive(Deserialize)]
struct HandleReq { handle: u32 }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MeterRead {
    frames: u64,
    momentary: Option<f64>,
    short_term: Option<f64>,
    integrated: Option<f64>,
    loudness_range: Option<f64>,
    max_momentary: Option<f64>,
    max_short_term: Option<f64>,
    sample_peak_db: Option<f64>,
    true_peak_db: Option<f64>,
}

#[derive(Serialize)]
struct Blocks { blocks: usize }

fn open_session(s: &mut State, session: Session) -> Result<u32, String> {
    if s.sessions.len() >= MAX_SESSIONS { return Err("Too many open sessions".into()); }
    s.next = s.next.wrapping_add(1).max(1);
    let id = s.next;
    s.sessions.insert(id, session);
    Ok(id)
}

fn meter_open(s: &mut State, json: &[u8]) -> Result<Vec<u8>, String> {
    let req: MeterOpen = header(json)?;
    let rate = check_rate(req.sample_rate)?;
    let channels = check_channels(req.channels)?;
    let sub_len = ((rate * 0.1).round() as usize).max(1);
    let id = open_session(s, Session::Meter(Meter { meter: LoudnessMeter::new(rate, channels), channels, sub_len, fed: 0, series: req.series }))?;
    reply(&Handle { handle: id }, &[])
}

fn meter_push(s: &mut State, json: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let req: HandleReq = header(json)?;
    let Some(Session::Meter(m)) = s.sessions.get_mut(&req.handle) else { return Err("Unknown loudness meter".into()) };
    let chans = planar(data, m.channels)?;
    let frames = chans[0].len();
    let mut series: Vec<f32> = Vec::new();
    let mut pos = 0usize;
    while pos < frames {
        let to_boundary = m.sub_len - (m.fed % m.sub_len as u64) as usize;
        let take = to_boundary.min(frames - pos);
        let slices: Vec<&[f32]> = chans.iter().map(|c| &c[pos..pos + take]).collect();
        m.meter.process(&slices);
        m.fed += take as u64;
        pos += take;
        if m.series && m.fed % m.sub_len as u64 == 0 {
            series.push(m.meter.momentary() as f32);
            series.push(m.meter.short_term() as f32);
        }
    }
    let blocks = series.len() / 2;
    reply(&Blocks { blocks }, &[series])
}

fn meter_read(s: &mut State, json: &[u8]) -> Result<Vec<u8>, String> {
    let req: HandleReq = header(json)?;
    let Some(Session::Meter(m)) = s.sessions.get(&req.handle) else { return Err("Unknown loudness meter".into()) };
    let sum = m.meter.summary();
    reply(&MeterRead {
        frames: m.fed,
        momentary: finite(m.meter.momentary()),
        short_term: finite(m.meter.short_term()),
        integrated: finite(sum.integrated_lufs),
        loudness_range: finite(sum.loudness_range_lu),
        max_momentary: finite(sum.max_momentary_lufs),
        max_short_term: finite(sum.max_short_term_lufs),
        sample_peak_db: finite(sum.sample_peak_dbfs),
        true_peak_db: finite(sum.true_peak_dbtp),
    }, &[])
}

// ---------------------------------------------------------------- repair chain

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FxOpen { sample_rate: f64, channels: usize, chain: Vec<StageSpec> }

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StageSpec { id: String, #[serde(default)] params: BTreeMap<String, f64> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FxOpened { handle: u32, latency: usize }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FxOut { frames: usize, clicks_repaired: usize }

fn build_stage(spec: &StageSpec, rate: f32, channels: usize) -> Result<Stage, String> {
    let mut stage = match spec.id.as_str() {
        "dehum" => Stage::DeHum(DeHum::new(rate, channels)),
        "denoise" => Stage::DeNoise(DeNoise::new(rate, channels)),
        "deesser" => Stage::DeEsser(DeEsser::new(rate, channels)),
        "dereverb" => Stage::DeReverb(DeReverb::new(rate, channels)),
        "declick" => Stage::Declick(ClickRemover::new(rate, channels)),
        other => return Err(format!("Unknown repair stage: {other}")),
    };
    let fx = stage.fx();
    for (name, value) in &spec.params {
        if !value.is_finite() || !fx.set_param(name, *value as f32) { return Err(format!("Unknown parameter {name} for {}", spec.id)); }
    }
    Ok(stage)
}

fn fx_open(s: &mut State, json: &[u8]) -> Result<Vec<u8>, String> {
    let req: FxOpen = header(json)?;
    let rate = check_rate(req.sample_rate)?;
    let channels = check_channels(req.channels)?;
    if req.chain.is_empty() || req.chain.len() > MAX_CHAIN { return Err("A repair chain holds 1 to 8 stages".into()); }
    let mut stages = Vec::with_capacity(req.chain.len());
    for spec in &req.chain { stages.push(build_stage(spec, rate as f32, channels)?); }
    let latency = stages.iter_mut().map(|st| st.fx().latency()).sum();
    let id = open_session(s, Session::Chain(Chain { stages, channels, to_drop: latency, latency }))?;
    reply(&FxOpened { handle: id, latency }, &[])
}

fn run_chain(chain: &mut Chain, mut bufs: Vec<Vec<f32>>) -> Result<Vec<u8>, String> {
    {
        let mut refs: Vec<&mut [f32]> = bufs.iter_mut().map(|b| b.as_mut_slice()).collect();
        for stage in &mut chain.stages { stage.fx().process(&mut refs); }
    }
    let drop = chain.to_drop.min(bufs[0].len());
    chain.to_drop -= drop;
    for b in &mut bufs { b.drain(..drop); }
    let clicks = chain.stages.iter().map(|st| if let Stage::Declick(c) = st { c.repaired } else { 0 }).sum();
    reply(&FxOut { frames: bufs[0].len(), clicks_repaired: clicks }, &bufs)
}

fn fx_process(s: &mut State, json: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let req: HandleReq = header(json)?;
    let Some(Session::Chain(c)) = s.sessions.get_mut(&req.handle) else { return Err("Unknown repair chain".into()) };
    let bufs = planar(data, c.channels)?;
    run_chain(c, bufs)
}

fn fx_flush(s: &mut State, json: &[u8]) -> Result<Vec<u8>, String> {
    let req: HandleReq = header(json)?;
    let Some(Session::Chain(c)) = s.sessions.get_mut(&req.handle) else { return Err("Unknown repair chain".into()) };
    let bufs = vec![vec![0.0f32; c.latency]; c.channels];
    if c.latency == 0 { return reply(&FxOut { frames: 0, clicks_repaired: 0 }, &vec![Vec::new(); c.channels]); }
    run_chain(c, bufs)
}

// ---------------------------------------------------------------- clip sync

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SyncReq { sample_rate: f64, frames_a: usize, #[serde(default)] max_lag: Option<i64> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncOut { lag: i64, lag_fine: f64, confidence: f32, distinct: f32, inverted: bool, reliable: bool }

fn sync(json: &[u8], data: &[u8]) -> Result<Vec<u8>, String> {
    let req: SyncReq = header(json)?;
    let rate = check_rate(req.sample_rate)? as u32;
    if data.len() % 4 != 0 { return Err("Sample data is not a whole number of floats".into()); }
    let total = data.len() / 4;
    if req.frames_a > total { return Err("Clip A is longer than the data".into()); }
    let frames_b = total - req.frames_a;
    if req.frames_a > MAX_SYNC_SAMPLES || frames_b > MAX_SYNC_SAMPLES { return Err("A clip is too long to align in one pass".into()); }
    let decode = |bytes: &[u8]| -> Vec<f32> {
        bytes.chunks_exact(4).map(|b| { let v = f32::from_le_bytes([b[0], b[1], b[2], b[3]]); if v.is_finite() { v } else { 0.0 } }).collect()
    };
    let a = decode(&data[..req.frames_a * 4]);
    let b = decode(&data[req.frames_a * 4..]);
    let opts = SyncOptions { max_lag: req.max_lag, ..SyncOptions::default() };
    match find_offset(&a, &b, rate, &opts) {
        Some(r) => reply(&Some(SyncOut { lag: r.lag, lag_fine: r.lag_fine, confidence: r.confidence, distinct: r.distinct, inverted: r.inverted, reliable: r.reliable() }), &[]),
        None => reply(&Option::<SyncOut>::None, &[]),
    }
}

// ---------------------------------------------------------------- dispatch and ABI

fn dispatch(s: &mut State, bytes: &[u8], op: u32) -> Result<Vec<u8>, String> {
    let (json, data) = split(bytes)?;
    match op {
        OP_METER_OPEN => meter_open(s, json),
        OP_METER_PUSH => meter_push(s, json, data),
        OP_METER_READ => meter_read(s, json),
        OP_FX_OPEN => fx_open(s, json),
        OP_FX_PROCESS => fx_process(s, json, data),
        OP_FX_FLUSH => fx_flush(s, json),
        OP_SYNC => sync(json, data),
        OP_CLOSE => {
            let req: HandleReq = header(json)?;
            if s.sessions.remove(&req.handle).is_none() { return Err("Unknown session".into()); }
            reply(&serde_json::json!({}), &[])
        }
        _ => Err("Unknown operation".into()),
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn audio_dsp_alloc(length: usize) -> usize {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        if length == 0 || length > MAX_INPUT.saturating_sub(s.allocated) { return 0; }
        let mut bytes = vec![0; length];
        let ptr = bytes.as_mut_ptr() as usize;
        s.inputs.insert(ptr, bytes); s.allocated += length; ptr
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn audio_dsp_free(ptr: usize) {
    STATE.with(|s| { let mut s = s.borrow_mut(); if let Some(b) = s.inputs.remove(&ptr) { s.allocated -= b.len(); } });
}
#[unsafe(no_mangle)]
pub extern "C" fn audio_dsp_run(ptr: usize, length: usize, op: u32) -> u32 {
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        s.output = Vec::new();
        let Some(input) = s.inputs.remove(&ptr).filter(|b| b.len() == length) else { return fail(&mut s, "Invalid request buffer") };
        s.allocated -= input.len();
        let result = dispatch(&mut s, &input, op);
        match result { Ok(out) => { s.output = out; 0 }, Err(e) => fail(&mut s, &e) }
    })
}
fn fail(s: &mut State, message: &str) -> u32 { s.output = message.as_bytes().to_vec(); 1 }
#[unsafe(no_mangle)]
pub extern "C" fn audio_dsp_result_ptr() -> usize { STATE.with(|s| s.borrow().output.as_ptr() as usize) }
#[unsafe(no_mangle)]
pub extern "C" fn audio_dsp_result_len() -> usize { STATE.with(|s| s.borrow().output.len()) }

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    fn req(json: &str, chans: &[&[f32]]) -> Vec<u8> {
        let mut out = (json.len() as u32).to_le_bytes().to_vec();
        out.extend_from_slice(json.as_bytes());
        for c in chans { for v in *c { out.extend_from_slice(&v.to_le_bytes()); } }
        out
    }
    fn call(s: &mut State, op: u32, json: &str, chans: &[&[f32]]) -> (serde_json::Value, Vec<f32>) {
        let out = dispatch(s, &req(json, chans), op).expect("ok");
        let (j, d) = split(&out).expect("split");
        (serde_json::from_slice(j).expect("json"), d.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect())
    }
    fn sine(freq: f64, amp: f64, sr: u32, secs: f64, phase: f64) -> Vec<f32> {
        (0..(secs * sr as f64) as usize).map(|i| (amp * (2.0 * PI * freq * i as f64 / sr as f64 + phase).sin()) as f32).collect()
    }

    #[test]
    fn stereo_997_sine_reads_minus_20_lufs() {
        let mut s = State::default();
        let x = sine(997.0, 0.1, 48_000, 10.0, 0.0);
        let (h, _) = call(&mut s, OP_METER_OPEN, r#"{"sampleRate":48000,"channels":2}"#, &[]);
        let id = h["handle"].as_u64().expect("handle");
        call(&mut s, OP_METER_PUSH, &format!(r#"{{"handle":{id}}}"#), &[&x, &x]);
        let (r, _) = call(&mut s, OP_METER_READ, &format!(r#"{{"handle":{id}}}"#), &[]);
        let i = r["integrated"].as_f64().expect("integrated");
        assert!((i + 20.0).abs() < 0.01, "integrated {i}");
        assert!(r["loudnessRange"].as_f64().expect("lra") < 0.05);
        assert!((r["momentary"].as_f64().expect("m") + 20.0).abs() < 0.01);
        assert!((r["shortTerm"].as_f64().expect("s") + 20.0).abs() < 0.01);
    }

    #[test]
    fn intersample_peak_is_found() {
        let mut s = State::default();
        let x = sine(12_000.0, 0.9, 48_000, 5.0, PI / 4.0);
        let (h, _) = call(&mut s, OP_METER_OPEN, r#"{"sampleRate":48000,"channels":1}"#, &[]);
        let id = h["handle"].as_u64().expect("handle");
        call(&mut s, OP_METER_PUSH, &format!(r#"{{"handle":{id}}}"#), &[&x]);
        let (r, _) = call(&mut s, OP_METER_READ, &format!(r#"{{"handle":{id}}}"#), &[]);
        let analytic = 20.0 * 0.9f64.log10();
        assert!((r["truePeakDb"].as_f64().expect("tp") - analytic).abs() < 0.1);
        assert!(r["samplePeakDb"].as_f64().expect("sp") < analytic - 2.5, "sample peak should sit near -3 dBFS");
    }

    #[test]
    fn meter_is_chunk_invariant_and_series_counts_blocks() {
        let x = sine(440.0, 0.2, 48_000, 3.0, 0.0);
        let mut whole = State::default();
        let mut cut = State::default();
        let open = r#"{"sampleRate":48000,"channels":1,"series":true}"#;
        let a = call(&mut whole, OP_METER_OPEN, open, &[]).0["handle"].as_u64().expect("h");
        let b = call(&mut cut, OP_METER_OPEN, open, &[]).0["handle"].as_u64().expect("h");
        let (_, sa) = call(&mut whole, OP_METER_PUSH, &format!(r#"{{"handle":{a}}}"#), &[&x]);
        let mut sb = Vec::new();
        for piece in x.chunks(3333) { sb.extend(call(&mut cut, OP_METER_PUSH, &format!(r#"{{"handle":{b}}}"#), &[piece]).1); }
        assert_eq!(sa.len(), 60, "30 blocks of 100 ms, two values each");
        assert_eq!(sa.iter().map(|v| v.to_bits()).collect::<Vec<_>>(), sb.iter().map(|v| v.to_bits()).collect::<Vec<_>>());
        let ra = call(&mut whole, OP_METER_READ, &format!(r#"{{"handle":{a}}}"#), &[]).0;
        let rb = call(&mut cut, OP_METER_READ, &format!(r#"{{"handle":{b}}}"#), &[]).0;
        assert_eq!(ra, rb);
    }

    fn noisy(n: usize) -> Vec<f32> {
        let mut seed = 0x9E37_79B9_7F4A_7C15u64;
        (0..n).map(|i| {
            seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17;
            let w = ((seed >> 11) as f64 / (1u64 << 53) as f64 * 2.0 - 1.0) as f32;
            0.2 * (2.0 * PI as f32 * 220.0 * i as f32 / 48_000.0).sin() * (1.0 + (i as f32 / 9_000.0).sin()) + 0.02 * w
        }).collect()
    }

    fn run_chain_in(chunk: usize, x: &[f32]) -> Vec<f32> {
        let mut s = State::default();
        let open = r#"{"sampleRate":48000,"channels":1,"chain":[{"id":"declick"},{"id":"dehum","params":{"frequency":0}},{"id":"denoise","params":{"reduction":12}},{"id":"dereverb"},{"id":"deesser"}]}"#;
        let h = call(&mut s, OP_FX_OPEN, open, &[]).0["handle"].as_u64().expect("h");
        let mut out = Vec::new();
        for piece in x.chunks(chunk) { out.extend(call(&mut s, OP_FX_PROCESS, &format!(r#"{{"handle":{h}}}"#), &[piece]).1); }
        out.extend(call(&mut s, OP_FX_FLUSH, &format!(r#"{{"handle":{h}}}"#), &[]).1);
        out
    }

    #[test]
    fn chain_keeps_length_and_ignores_chunking() {
        let x = noisy(48_000);
        let a = run_chain_in(48_000, &x);
        let b = run_chain_in(1_777, &x);
        assert_eq!(a.len(), x.len());
        assert_eq!(a.iter().map(|v| v.to_bits()).collect::<Vec<_>>(), b.iter().map(|v| v.to_bits()).collect::<Vec<_>>());
        assert!(a.iter().all(|v| v.is_finite()));
    }

    #[test]
    fn declick_repairs_a_spike() {
        let mut x = sine(300.0, 0.3, 48_000, 1.0, 0.0);
        x[20_000] += 0.9;
        let mut s = State::default();
        let h = call(&mut s, OP_FX_OPEN, r#"{"sampleRate":48000,"channels":1,"chain":[{"id":"declick"}]}"#, &[]).0["handle"].as_u64().expect("h");
        let (_, mut out) = call(&mut s, OP_FX_PROCESS, &format!(r#"{{"handle":{h}}}"#), &[&x]);
        let (tail, rest) = call(&mut s, OP_FX_FLUSH, &format!(r#"{{"handle":{h}}}"#), &[]);
        out.extend(rest);
        assert!(tail["clicksRepaired"].as_u64().unwrap_or(0) >= 1, "the spike should count as one repaired click");
        assert_eq!(out.len(), x.len());
        let before = (x[20_000] - 0.3 * (2.0 * PI as f32 * 300.0 * 20_000.0 / 48_000.0).sin()).abs();
        let after = (out[20_000] - 0.3 * (2.0 * PI as f32 * 300.0 * 20_000.0 / 48_000.0).sin()).abs();
        assert!(after < before * 0.2, "spike {before} left {after}");
    }

    #[test]
    fn sync_finds_a_known_lag() {
        let mut seed = 7u64;
        let a: Vec<f32> = (0..96_000).map(|_| { seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17; ((seed >> 11) as f64 / (1u64 << 53) as f64 * 2.0 - 1.0) as f32 * 0.3 }).collect();
        let lag = 12_345usize;
        let b: Vec<f32> = a[lag..lag + 48_000].to_vec();
        let mut s = State::default();
        let (r, _) = call(&mut s, OP_SYNC, r#"{"sampleRate":48000,"framesA":96000}"#, &[&a, &b]);
        assert_eq!(r["lag"], lag as i64);
        assert_eq!(r["reliable"], true);
    }

    #[test]
    fn refuses_bad_requests() {
        let mut s = State::default();
        assert!(dispatch(&mut s, b"nope", OP_METER_OPEN).is_err());
        assert!(dispatch(&mut s, &req(r#"{"sampleRate":48000,"channels":99}"#, &[]), OP_METER_OPEN).is_err());
        assert!(dispatch(&mut s, &req(r#"{"sampleRate":48000,"channels":1,"chain":[{"id":"reverb"}]}"#, &[]), OP_FX_OPEN).is_err());
        assert!(dispatch(&mut s, &req(r#"{"sampleRate":48000,"channels":1,"chain":[{"id":"dehum","params":{"bogus":1}}]}"#, &[]), OP_FX_OPEN).is_err());
        assert!(dispatch(&mut s, &req(r#"{"handle":9}"#, &[]), OP_METER_READ).is_err());
        assert!(dispatch(&mut s, &req("{}", &[]), 99).is_err());
    }
}
