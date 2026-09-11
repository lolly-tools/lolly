// SPDX-License-Identifier: MPL-2.0
//! Native reword generation (plans/127) - runs SmolLM2-360M-Instruct on native
//! ONNX Runtime, the desktop answer to the browser's wasm floor (WebGPU is the
//! web path; native CPU measures 0.4-1.4 s per sample on an M-series host where
//! single-thread wasm took minutes).
//!
//! The JS side (lib/reworder.ts's Tauri probe) owns consent + download and
//! materialises the staged model set into
//! app-data/models/reword/smollm2-360m-instruct/ (via `reword_put_file`); this
//! side loads from there and never downloads. The session and tokenizer are
//! cached per model dir, one generation at a time per engine.
//!
//! The PROMPT is not authored here: the engine's `buildRewordMessages` is the
//! source of truth, and JS passes the system prompt + sentence in. This module
//! only applies SmolLM2's ChatML template (verified against the staged
//! tokenizer_config.json at staging time, plans/127 WP4):
//!   <|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{sentence}
//!   <|im_end|>\n<|im_start|>assistant\n
//! and samples with temperature/top-p. Raw candidate strings go back to JS,
//! where the engine's deterministic gate (`rewordCandidates`) decides what a
//! person may ever see - sample before the gate, on every shell.
//!
//! Every sample is watermarked (`wm_add_green_bias` below): the green-list
//! scheme of Kirchenbauer et al. (arXiv:2301.10226), mirroring the engine's
//! text-watermark.ts constants so /verify's detector reads native and web
//! generations identically.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use ort::session::Session;
use ort::value::Tensor;
use rand::Rng;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};
use tokenizers::Tokenizer;

/// The staged file set - the ONLY names `reword_put_file` accepts (a stray
/// header must not escape the model dir). Mirrors REWORD_MODEL_FILES in
/// shells/web/src/lib/reword-models.ts.
const MODEL_FILES: [&str; 6] = [
    "config.json",
    "generation_config.json",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "onnx/model_q4.onnx",
];

const MODEL_DIR: &str = "models/reword/smollm2-360m-instruct";
/// `<|im_end|>` - generation_config.json's eos_token_id, pinned at staging.
const EOS_TOKEN_ID: u32 = 2;

struct Engine {
    session: Mutex<Session>,
    tokenizer: Tokenizer,
    /// Number of `past_key_values.*` layers, read off the session's inputs.
    layers: usize,
    kv_heads: usize,
    head_dim: usize,
}

type EngineMap = Mutex<HashMap<PathBuf, Arc<Engine>>>;
static ENGINES: OnceLock<EngineMap> = OnceLock::new();

fn engines() -> &'static EngineMap {
    ENGINES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn model_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?
        .join(MODEL_DIR))
}

fn engine_for(root: &Path) -> Result<Arc<Engine>, String> {
    let key = root.to_path_buf();
    let mut cache = engines().lock().map_err(|_| "engine cache poisoned".to_string())?;
    if let Some(e) = cache.get(&key) {
        return Ok(Arc::clone(e));
    }
    let tokenizer = Tokenizer::from_file(root.join("tokenizer.json"))
        .map_err(|e| format!("load tokenizer: {e}"))?;
    let session = Session::builder()
        .map_err(|e| format!("ort builder: {e}"))?
        .commit_from_file(root.join("onnx").join("model_q4.onnx"))
        .map_err(|e| format!("load model: {e}"))?;

    // Read the KV-cache geometry off the graph itself (past_key_values.N.key is
    // [batch, kv_heads, past_len, head_dim]; heads + head_dim are static in the
    // export, past_len is dynamic) so a re-quantised or upgraded export never
    // silently runs with stale constants.
    let mut layers = 0usize;
    let mut kv_heads = 5usize;
    let mut head_dim = 64usize;
    for input in &session.inputs {
        if !input.name.starts_with("past_key_values.") {
            continue;
        }
        if input.name.ends_with(".key") {
            layers += 1;
            if let ort::value::ValueType::Tensor { shape, .. } = &input.input_type {
                if shape.len() == 4 {
                    if shape[1] > 0 { kv_heads = shape[1] as usize; }
                    if shape[3] > 0 { head_dim = shape[3] as usize; }
                }
            }
        }
    }
    if layers == 0 {
        return Err("model has no past_key_values inputs - not a merged decoder export".into());
    }

    let engine = Arc::new(Engine { session: Mutex::new(session), tokenizer, layers, kv_heads, head_dim });
    cache.insert(key, Arc::clone(&engine));
    Ok(engine)
}

/// SmolLM2's ChatML - see the module docs; the system prompt comes from JS.
fn chat_prompt(system: &str, sentence: &str) -> String {
    format!(
        "<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{sentence}<|im_end|>\n<|im_start|>assistant\n"
    )
}

// ── The green-list watermark (Kirchenbauer et al., arXiv:2301.10226) ─────────
// Mirrors engine/src/text-watermark.ts's REWORD_WATERMARK exactly - same hash,
// same key, same gamma/delta - so text generated HERE is verifiable by the
// web shell's tokenizer-side detector. The pinned vectors in
// tests/text-watermark.test.ts are re-asserted in this file's tests; change
// either side only together with the other.

const WM_KEY: u32 = 0x4c4f_4c4c; // 'LOLL'
/// gamma 0.25 as a hash cut: 0.25 * 2^32.
const WM_GAMMA_CUT: u32 = 0x4000_0000;
const WM_DELTA: f32 = 6.0;

/// 32-bit finalizer - the engine's `mix32`, bit for bit.
fn wm_mix32(mut x: u32) -> u32 {
    x ^= x >> 16;
    x = x.wrapping_mul(0x21f0_aaad);
    x ^= x >> 15;
    x = x.wrapping_mul(0x735a_2d97);
    x ^ (x >> 15)
}

/// Add the watermark bias to one next-token logits row, given the previous
/// token id. Runs BEFORE temperature/top-p (`sample_top_p` divides by the
/// temperature itself), matching the web worker's logits processor.
fn wm_add_green_bias(logits: &mut [f32], prev: u32) {
    let seed = wm_mix32(prev ^ WM_KEY);
    for (i, l) in logits.iter_mut().enumerate() {
        if wm_mix32(seed ^ (i as u32)) < WM_GAMMA_CUT {
            *l += WM_DELTA;
        }
    }
}

/// Temperature + nucleus (top-p) sampling over one logits row. Pure; the rng is
/// injected so tests run seeded.
fn sample_top_p<R: Rng>(logits: &[f32], temperature: f32, top_p: f32, rng: &mut R) -> u32 {
    let t = temperature.max(1e-3);
    // Softmax with max-subtraction, then sort descending and keep the nucleus.
    let max = logits.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    let mut probs: Vec<(u32, f32)> = logits
        .iter()
        .enumerate()
        .map(|(i, &l)| (i as u32, ((l - max) / t).exp()))
        .collect();
    let sum: f32 = probs.iter().map(|(_, p)| p).sum();
    for p in &mut probs {
        p.1 /= sum;
    }
    probs.sort_unstable_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let mut kept = 0usize;
    let mut acc = 0f32;
    for (i, (_, p)) in probs.iter().enumerate() {
        kept = i + 1;
        acc += p;
        if acc >= top_p {
            break;
        }
    }
    let nucleus = &probs[..kept.max(1)];
    let total: f32 = nucleus.iter().map(|(_, p)| p).sum();
    let mut roll = rng.gen_range(0f32..total.max(f32::MIN_POSITIVE));
    for (id, p) in nucleus {
        if roll < *p {
            return *id;
        }
        roll -= p;
    }
    nucleus[0].0
}

/// One layer's owned KV state.
type KvState = Vec<(Vec<f32>, Vec<f32>)>;

struct StepOut {
    next_logits: Vec<f32>,
    kv: KvState,
}

/// Run one decoder step: `tokens` new tokens against `past_len` cached ones.
/// The first `masked_prefix` cache rows are the zeroed PREFILL DUMMY (ort
/// rc.10's Tensor::from_array refuses zero-length dimensions, so an empty
/// past cannot be expressed) - their attention-mask stays 0 forever, so they
/// contribute nothing, and position ids count REAL tokens only.
fn step(
    session: &mut Session,
    eng: &Engine,
    tokens: &[i64],
    past_len: usize,
    masked_prefix: usize,
    kv: &KvState,
) -> Result<StepOut, String> {
    let cur = tokens.len();
    let total = past_len + cur;
    let real_past = past_len - masked_prefix;
    let input_ids = Tensor::from_array(([1usize, cur], tokens.to_vec()))
        .map_err(|e| format!("input_ids: {e}"))?;
    let mut mask = vec![1i64; total];
    for m in mask.iter_mut().take(masked_prefix) {
        *m = 0;
    }
    let attention_mask = Tensor::from_array(([1usize, total], mask))
        .map_err(|e| format!("attention_mask: {e}"))?;
    let position_ids = Tensor::from_array((
        [1usize, cur],
        (real_past..real_past + cur).map(|p| p as i64).collect::<Vec<_>>(),
    ))
    .map_err(|e| format!("position_ids: {e}"))?;

    let mut inputs: Vec<(String, ort::session::SessionInputValue)> = vec![
        ("input_ids".to_string(), input_ids.into()),
        ("attention_mask".to_string(), attention_mask.into()),
        ("position_ids".to_string(), position_ids.into()),
    ];
    for (l, (k, v)) in kv.iter().enumerate() {
        let shape = [1usize, eng.kv_heads, past_len, eng.head_dim];
        let key = Tensor::from_array((shape, k.clone())).map_err(|e| format!("past key {l}: {e}"))?;
        let val = Tensor::from_array((shape, v.clone())).map_err(|e| format!("past value {l}: {e}"))?;
        inputs.push((format!("past_key_values.{l}.key"), key.into()));
        inputs.push((format!("past_key_values.{l}.value"), val.into()));
    }

    let outputs = session.run(inputs).map_err(|e| format!("ort run: {e}"))?;

    let (shape, logits) = outputs["logits"]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("extract logits: {e}"))?;
    let vocab = *shape.last().ok_or("empty logits shape")? as usize;
    let last = logits.len() - vocab;
    let next_logits = logits[last..].to_vec();

    let mut next_kv: KvState = Vec::with_capacity(eng.layers);
    for l in 0..eng.layers {
        let (_, k) = outputs[format!("present.{l}.key").as_str()]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("extract present key {l}: {e}"))?;
        let (_, v) = outputs[format!("present.{l}.value").as_str()]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("extract present value {l}: {e}"))?;
        next_kv.push((k.to_vec(), v.to_vec()));
    }
    Ok(StepOut { next_logits, kv: next_kv })
}

fn generate(
    root: PathBuf,
    system: String,
    sentence: String,
    count: usize,
    max_new: usize,
    temperature: f32,
    top_p: f32,
) -> Result<Vec<String>, String> {
    let eng = engine_for(&root)?;
    let mut session = eng.session.lock().map_err(|_| "session lock poisoned".to_string())?;

    let prompt = chat_prompt(&system, &sentence);
    let encoding = eng
        .tokenizer
        .encode(prompt, false)
        .map_err(|e| format!("encode: {e}"))?;
    let prompt_ids: Vec<i64> = encoding.get_ids().iter().map(|&t| t as i64).collect();

    // Prefill ONCE, then every sample continues from a clone of that state -
    // the prompt is the expensive half of a short generation. The one-row
    // zeroed dummy past (masked out forever - see `step`) stands in for the
    // empty cache ort rc.10 cannot express.
    const DUMMY: usize = 1;
    let dummy: KvState = (0..eng.layers)
        .map(|_| {
            let row = vec![0f32; eng.kv_heads * DUMMY * eng.head_dim];
            (row.clone(), row)
        })
        .collect();
    let prefill = step(&mut session, &eng, &prompt_ids, DUMMY, DUMMY, &dummy)?;

    let mut rng = rand::thread_rng();
    let mut out = Vec::with_capacity(count);
    for _ in 0..count {
        let mut kv = prefill.kv.clone();
        let mut past = DUMMY + prompt_ids.len();
        let mut logits = prefill.next_logits.clone();
        let mut ids: Vec<u32> = Vec::new();
        let mut prev = prompt_ids.last().copied().unwrap_or(0) as u32;
        for _ in 0..max_new {
            wm_add_green_bias(&mut logits, prev);
            let tok = sample_top_p(&logits, temperature, top_p, &mut rng);
            if tok == EOS_TOKEN_ID {
                break;
            }
            ids.push(tok);
            prev = tok;
            let next = step(&mut session, &eng, &[tok as i64], past, DUMMY, &kv)?;
            past += 1;
            kv = next.kv;
            logits = next.next_logits;
        }
        let text = eng
            .tokenizer
            .decode(&ids, true)
            .map_err(|e| format!("decode: {e}"))?;
        out.push(text);
    }
    Ok(out)
}

/// Is the full staged set on disk? The JS probe turns this into the
/// ready / need-download states the consent UI shows.
#[tauri::command]
pub fn reword_probe(app: AppHandle) -> Result<bool, String> {
    let root = model_root(&app)?;
    Ok(MODEL_FILES.iter().all(|f| root.join(f).exists()))
}

/// Materialise ONE staged file (raw request body; `x-file` names it). The name
/// must be in MODEL_FILES - never a path a header invented.
#[tauri::command]
pub async fn reword_put_file(app: AppHandle, request: Request<'_>) -> Result<Response, String> {
    let file = request
        .headers()
        .get("x-file")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or("missing header x-file")?;
    if !MODEL_FILES.contains(&file.as_str()) {
        return Err(format!("not a reword model file: {file}"));
    }
    let bytes = match request.body() {
        InvokeBody::Raw(b) => b.clone(),
        InvokeBody::Json(_) => return Err("reword_put_file expects a raw request body".into()),
    };
    let path = model_root(&app)?.join(&file);
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("mkdir {}: {e}", dir.display()))?;
    }
    std::fs::write(&path, bytes).map_err(|e| format!("write {}: {e}", path.display()))?;
    Ok(Response::new(Vec::new()))
}

/// Sample `count` raw rewrite candidates for one sentence. The engine gate on
/// the JS side judges them - this returns the model's words verbatim.
#[tauri::command]
pub async fn reword_generate(
    app: AppHandle,
    system: String,
    sentence: String,
    count: Option<usize>,
    max_new_tokens: Option<usize>,
    temperature: Option<f32>,
    top_p: Option<f32>,
) -> Result<Vec<String>, String> {
    let root = model_root(&app)?;
    if !MODEL_FILES.iter().all(|f| root.join(f).exists()) {
        return Err("reword model not on disk - stage it first".into());
    }
    let count = count.unwrap_or(3).clamp(1, 6);
    let max_new = max_new_tokens.unwrap_or(96).clamp(8, 256);
    let temperature = temperature.unwrap_or(0.8);
    let top_p = top_p.unwrap_or(0.9);
    tauri::async_runtime::spawn_blocking(move || {
        generate(root, system, sentence, count, max_new, temperature, top_p)
    })
    .await
    .map_err(|e| format!("reword task panicked: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    #[test]
    fn chat_prompt_is_the_staged_chatml_template() {
        let p = chat_prompt("Be brief.", "A sentence.");
        assert_eq!(
            p,
            "<|im_start|>system\nBe brief.<|im_end|>\n<|im_start|>user\nA sentence.<|im_end|>\n<|im_start|>assistant\n"
        );
    }

    #[test]
    fn sampling_is_greedy_at_tiny_temperature_and_respects_the_nucleus() {
        let mut rng = StdRng::seed_from_u64(7);
        let logits = vec![0.0f32, 5.0, 1.0, -2.0];
        // Near-zero temperature: the argmax dominates the nucleus entirely.
        for _ in 0..16 {
            assert_eq!(sample_top_p(&logits, 1e-3, 0.9, &mut rng), 1);
        }
        // A tight nucleus can only ever return its members.
        let peaked = vec![4.0f32, 4.1, -10.0, -10.0];
        for _ in 0..64 {
            let t = sample_top_p(&peaked, 1.0, 0.6, &mut rng);
            assert!(t == 0 || t == 1, "token {t} escaped the nucleus");
        }
    }

    #[test]
    fn watermark_hash_matches_the_engine_pinned_vectors() {
        // tests/text-watermark.test.ts pins the same values - the cross-language
        // contract that keeps desktop rewords verifiable on the web detector.
        assert_eq!(wm_mix32(0), 0);
        assert_eq!(wm_mix32(1), 0x86d2_fa73);
        assert_eq!(wm_mix32(0xdead_beef), 0x2a2a_caf2);
        let green = |prev: u32, tok: u32| wm_mix32(wm_mix32(prev ^ WM_KEY) ^ tok) < WM_GAMMA_CUT;
        assert!(green(1234, 4));
        assert!(!green(1234, 5678));
        assert!(!green(49151, 42));
    }

    #[test]
    fn watermark_bias_moves_roughly_a_quarter_of_the_vocabulary() {
        let mut logits = vec![0f32; 4096];
        wm_add_green_bias(&mut logits, 77);
        assert!(logits.iter().all(|&l| l == 0.0 || l == WM_DELTA));
        let frac = logits.iter().filter(|&&l| l == WM_DELTA).count() as f32 / 4096.0;
        assert!((frac - 0.25).abs() < 0.03, "green fraction {frac}");
    }

    #[test]
    fn put_file_names_are_allowlisted() {
        assert!(MODEL_FILES.contains(&"onnx/model_q4.onnx"));
        assert!(!MODEL_FILES.contains(&"../../evil"));
    }

    /// The full native loop against the REAL staged model. Ignored by default -
    /// run with the model dir on this machine:
    ///   LOLLY_REWORD_MODEL_DIR=…/shells/web/public/models/reword/smollm2-360m-instruct \
    ///     cargo test --lib reword -- --ignored
    #[test]
    #[ignore]
    fn generates_against_the_staged_model() {
        let dir = std::env::var("LOLLY_REWORD_MODEL_DIR").expect("set LOLLY_REWORD_MODEL_DIR");
        let out = generate(
            PathBuf::from(dir),
            "You rewrite sentences. Reply with the rewritten sentence only.".into(),
            "It is important to note that our solution leverages cutting-edge technology in order to deliver outstanding results.".into(),
            2,
            48,
            0.8,
            0.9,
        )
        .expect("generation");
        assert_eq!(out.len(), 2);
        assert!(out.iter().all(|s| !s.trim().is_empty()), "got {out:?}");
    }
}
