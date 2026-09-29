// SPDX-License-Identifier: MPL-2.0
import { framePreviewSvg } from '../../engine/src/frame-preview-svg.ts';
import { FIXTURES } from './fixtures.ts';
import { inputKey, prepareCandidates, validateBrief } from './candidates.ts';
import { resultFor, rulesRanking, scoreResult, summarize } from './ranking.ts';
import { METHODS, METHOD_NAMES, type Candidate, type ExperimentResult, type Method, type SlideBrief } from './types.ts';
import type { CorpusCase, CorpusIndex, CorpusRow } from './corpus.ts';
import type { LayoutFeaturesV1 } from '../../packages/core/src/rebrand-v1.ts';

function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const select = el<HTMLSelectElement>('fixture');
const request = el<HTMLTextAreaElement>('request');
const collection = el<HTMLSelectElement>('collection');
const filter = el<HTMLSelectElement>('corpus-filter');
const history: ExperimentResult[] = [];
let brief = structuredClone(FIXTURES[0]!.brief);
let candidates: Candidate[] = [];
let results: ExperimentResult[] = [];
let preview: Candidate | undefined;
let applied: Candidate | undefined;
let previous: Candidate | undefined;
let worker: Worker | undefined;
let pending: { id: number; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
let sequence = 0;
let runVersion = 0;
let busy = false;
let available = { embed: false, smol: false };
let corpus: CorpusIndex | null = null;
let currentCase: CorpusCase | undefined;
let blocked = false;
let selectionVersion = 0;
let caseFetch: AbortController | undefined;

function status(text: string): void { el('status').textContent = text; }
function setBusy(value: boolean): void {
  busy = value;
  el<HTMLButtonElement>('run').disabled = value || blocked;
  el<HTMLButtonElement>('suite').disabled = value || collection.value !== 'synthetic';
  el<HTMLButtonElement>('cancel').disabled = !value && !worker;
}
function cancel(): void {
  runVersion++;
  if (pending) { clearTimeout(pending.timer); pending.reject(new Error('Cancelled.')); pending = undefined; }
  worker?.terminate(); worker = undefined;
  setBusy(false);
  status('Stopped. Model memory released.');
}
function svg(candidate: Candidate): string {
  return framePreviewSvg(candidate.compiled, { assetHref: ref => currentCase?.picture?.id === ref ? `/corpus/pictures/${currentCase.picture.file}` : undefined, fonts: { brand: 'Arial' }, emptySlots: false });
}
function showPreview(candidate?: Candidate): void {
  preview = candidate;
  el('artboard').innerHTML = candidate ? svg(candidate) : '';
  if (!candidate) el('artboard').textContent = 'No layout passed the fit estimate. Shorten or divide the source content.';
  el('layout-name').textContent = candidate ? `${candidate.name}${candidate === applied ? ' · in use in this lab' : ' · preview'}` : 'No fitting candidate';
  el<HTMLButtonElement>('apply').disabled = !candidate || candidate === applied;
  el<HTMLButtonElement>('download').disabled = !candidate;
  for (const button of el('suggestions').querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.layout === candidate?.id));
}
function showRanking(result: ExperimentResult): void {
  const shown = result.valid ? result.ids : candidates.slice(0, 3).map(c => c.id);
  const strip = el('suggestions'); strip.replaceChildren();
  for (const id of shown) {
    const candidate = candidates.find(c => c.id === id);
    if (!candidate) continue;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion'; button.dataset.layout = id;
    button.innerHTML = svg(candidate);
    const label = document.createElement('span'); label.textContent = candidate.name; button.append(label);
    button.addEventListener('click', () => showPreview(candidate)); strip.append(button);
  }
  showPreview(candidates.find(c => c.id === shown[0]));
  el('fit-note').textContent = result.valid
    ? `${METHOD_NAMES[result.method]} · all displayed options preserve the content and pass the estimated fit check. Font shaping has not been verified.`
    : `${METHOD_NAMES[result.method]} did not return a valid recommendation. Showing layout rules. ${result.error ?? ''}`;
  el('raw').textContent = result.raw || result.error || (result.scores ? `Scores: ${result.scores.join(', ')}\nScores are not calibrated confidence.` : 'This method returns prepared layout IDs.');
  for (const button of el('results').querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.method === result.method));
}
function renderResults(): void {
  el('results').replaceChildren();
  for (const result of results) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'method'; button.dataset.method = result.method;
    const title = document.createElement('strong'); title.textContent = METHOD_NAMES[result.method];
    const answer = document.createElement('span'); answer.textContent = result.valid ? candidates.find(c => c.id === result.ids[0])?.name ?? '' : 'No valid recommendation';
    const time = document.createElement('small'); time.textContent = `${Math.round(result.inferenceMs)} ms inference · ${Math.round(result.loadMs)} ms load · ${result.backend}`;
    button.append(title, answer, time); button.addEventListener('click', () => showRanking(result)); el('results').append(button);
  }
}
function loadBrief(next: SlideBrief, features?: LayoutFeaturesV1): void {
  brief = validateBrief(next);
  const prepared = prepareCandidates(brief, features); candidates = prepared.eligible;
  request.value = brief.request;
  el<HTMLTextAreaElement>('brief-json').value = JSON.stringify(brief, null, 2);
  el('slide-title').textContent = brief.title;
  el('source').replaceChildren();
  for (const block of brief.blocks) {
    const div = document.createElement('div'); div.className = 'source-block';
    const title = document.createElement('strong'); title.textContent = block.heading;
    const text = document.createElement('p'); text.textContent = block.text;
    div.append(title, text); el('source').append(div);
  }
  el('checks').replaceChildren();
  for (const c of [...candidates, ...prepared.rejected]) {
    const p = document.createElement('p'); p.textContent = `${c.name}: ${c.overflow.length ? `${c.overflow.length} text boxes exceed the fit estimate` : 'content preserved; estimated fit passes'}`; el('checks').append(p);
  }
  results = [resultFor(brief, candidates, 'rules', rulesRanking(candidates), { backend: 'rules', loadMs: 0, inferenceMs: 0 })];
  applied = undefined; previous = undefined; el<HTMLButtonElement>('undo').disabled = true;
  renderResults(); showRanking(results[0]!);
}
function infer(method: Method): Promise<ExperimentResult> {
  worker ??= new Worker('/worker.js', { type: 'module' });
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending = undefined; worker?.terminate(); worker = undefined; reject(new Error('Inference timed out after two minutes. Model memory released.')); }, 120_000);
    pending = { id, reject, timer };
    worker!.onmessage = (event: MessageEvent<{ id: number; progress?: string; result?: ExperimentResult; error?: string }>): void => {
      const data = event.data;
      if (data.id !== pending?.id) return;
      if (data.progress) { status(`${METHOD_NAMES[method]}: ${data.progress}`); return; }
      clearTimeout(timer); pending = undefined;
      if (data.result) resolve(data.result); else reject(new Error(data.error ?? 'Worker returned no result.'));
    };
    worker!.onerror = (event): void => { clearTimeout(timer); pending = undefined; worker?.terminate(); worker = undefined; reject(new Error(event.message)); };
    worker!.postMessage({ id, brief, candidates, method });
  });
}
async function compare(version: number): Promise<void> {
  const key = inputKey(brief, candidates);
  results = [];
  for (const method of METHODS) {
    if (version !== runVersion) return;
    status(`${METHOD_NAMES[method]}: ${brief.title}`);
    const isAvailable = method === 'rules' || (method === 'embed' ? available.embed : available.smol);
    const result = method === 'rules' || !candidates.length
      ? resultFor(brief, candidates, method, rulesRanking(candidates), { backend: 'rules', loadMs: 0, inferenceMs: 0 })
      : isAvailable ? await infer(method)
        : resultFor(brief, candidates, method, { ids: [], valid: false, raw: '', error: 'Model files are not installed locally.' }, { backend: 'unavailable', loadMs: 0, inferenceMs: 0 });
    if (version !== runVersion || key !== inputKey(brief, candidates) || result.inputKey !== key) return;
    const fixture = FIXTURES.find(f => JSON.stringify(f.brief) === JSON.stringify(brief));
    const scored = scoreResult(result, fixture);
    results.push(scored); history.push(scored); renderResults(); showRanking(scored);
    el('summary').textContent = `${history.length} recorded runs. Results are saved only when you export a report.`;
  }
  status('Comparison complete. Select a method to inspect its recommendations.');
}
async function run(suite: boolean): Promise<void> {
  if (busy || blocked) return;
  const version = ++runVersion; setBusy(true);
  try {
    if (!suite) await compare(version);
    else for (const fixture of FIXTURES) {
      if (version !== runVersion) break;
      select.value = fixture.brief.id; loadBrief(structuredClone(fixture.brief));
      await compare(version);
    }
  } catch (error) { if (version === runVersion) status(error instanceof Error ? error.message : String(error)); }
  finally { if (version === runVersion) setBusy(false); }
}
function download(filename: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function corpusRows(): CorpusRow[] {
  return (corpus?.cases ?? []).filter(c => (collection.value === 'corpus' || collection.value === `deck:${c.deck}`)
    && (filter.value === 'all' || (filter.value === 'ocr' ? c.mode !== 'native' : filter.value === 'chart' ? c.categories.some(k => k === 'chart' || k === 'table') : c.status === filter.value)));
}
function showReference(one: CorpusCase): void {
  el('reference').hidden = false;
  el('reference-name').textContent = `${one.deck} · slide ${one.page}`;
  const image = el<HTMLImageElement>('reference-image'); image.hidden = !one.preview;
  if (one.preview) image.src = `/corpus/previews/${one.id}.png`; else image.removeAttribute('src');
  el('reference-note').textContent = `${one.mode === 'native' ? 'Native source objects' : 'Flattened slide'} · ${one.categories.join(', ')}. ${one.deck.endsWith('.pdf') ? 'PDF reference render.' : 'LibreOffice reference render; fonts and effects can differ from PowerPoint.'} Recommendations use the neutral master. ${one.picture ? 'The source picture is shown in the layout previews; exported inputs reference its ID without embedding bytes.' : ''}`;
  const reading = one.ocr;
  el('extraction-note').textContent = `${reading ? `OCR: ${reading.state}; ${reading.before} → ${reading.after} text objects, ${reading.calls} recogniser calls, ${reading.ms} ms. Recogniser confidence is not transcription accuracy. ` : ''}Rebrand structure proposal: ${one.baseline.layout ?? 'none'} (${one.baseline.band ?? 'none'}). ${one.baseline.reasons.join(' ')} Furniture classifications are unreviewed; excluded objects remain listed below.`;
  el('extraction-text').replaceChildren();
  for (const row of one.readout) {
    const p = document.createElement('p');
    p.textContent = `${row.excluded ? 'Excluded from brief' : 'Content'} · ${row.classification} · ${row.kind}: ${row.text || '(no editable text)'}`;
    el('extraction-text').append(p);
  }
  el('source-warnings').textContent = one.warnings.join('\n');
}
async function pickSlide(): Promise<void> {
  const version = ++selectionVersion;
  caseFetch?.abort(); cancel(); currentCase = undefined;
  blocked = collection.value !== 'synthetic'; setBusy(false);
  request.disabled = blocked; el('brief-editor').hidden = blocked;
  el('reference').hidden = true;
  if (collection.value === 'synthetic') {
    loadBrief(structuredClone(FIXTURES.find(f => f.brief.id === select.value)!.brief));
    status('Select a method or compare this slide.'); return;
  }
  candidates = []; results = []; renderResults(); showPreview(); el('suggestions').replaceChildren();
  el('source').replaceChildren(); el('checks').replaceChildren();
  el('slide-title').textContent = 'Loading source slide';
  el('fit-note').textContent = ''; request.value = '';
  el<HTMLButtonElement>('undo').disabled = true;
  if (!select.value) { el('slide-title').textContent = 'No slides match this filter'; status('Choose another filter.'); return; }
  caseFetch = new AbortController();
  try {
    const response = await fetch(`/corpus/cases/${select.value}.json`, { signal: caseFetch.signal });
    if (!response.ok) throw new Error('Could not read this local case.');
    const one = await response.json() as CorpusCase;
    if (version !== selectionVersion) return;
    currentCase = one; showReference(one);
    if (one.status === 'ready' && one.brief) {
      blocked = false; request.disabled = false; el('brief-editor').hidden = false;
      loadBrief(one.brief, one.features); setBusy(false);
      status('Real slide loaded. No accuracy label has been assigned.');
    } else {
      el('slide-title').textContent = one.title;
      el('artboard').textContent = 'This slide needs inspection before layout recommendations.';
      el('layout-name').textContent = 'Outside the first layout contract';
      el('fit-note').textContent = one.reasons.join(' ');
      status('Inspect the original and its extraction details above.');
    }
  } catch (error) { if (version === selectionVersion) status(error instanceof Error ? error.message : String(error)); }
}
function populateSlides(wanted?: string): void {
  select.replaceChildren();
  const rows = collection.value === 'synthetic'
    ? FIXTURES.map(f => ({ id: f.brief.id, label: f.brief.title }))
    : corpusRows().map(c => ({ id: c.id, label: `${c.page}. ${c.title} · ${c.mode}${c.status === 'inspect' ? ' · inspect' : ''}` }));
  for (const row of rows) { const option = document.createElement('option'); option.value = row.id; option.textContent = row.label; select.append(option); }
  if (wanted && rows.some(row => row.id === wanted)) select.value = wanted;
  el('corpus-controls').hidden = collection.value === 'synthetic';
  void pickSlide();
}
select.addEventListener('change', () => void pickSlide());
collection.addEventListener('change', () => populateSlides());
filter.addEventListener('change', () => populateSlides());
request.addEventListener('input', () => {
  if (busy) cancel(); else runVersion++;
  brief = { ...brief, request: request.value };
  el<HTMLTextAreaElement>('brief-json').value = JSON.stringify(brief, null, 2);
  results = [resultFor(brief, candidates, 'rules', rulesRanking(candidates), { backend: 'rules', loadMs: 0, inferenceMs: 0 })];
  renderResults(); showRanking(results[0]!);
});
el('edit').addEventListener('click', () => { try { const next = validateBrief(JSON.parse(el<HTMLTextAreaElement>('brief-json').value)); cancel(); loadBrief(next); status('Edited brief loaded with synthesized structural features. Source extraction is unchanged; this run is not labelled.'); } catch (error) { status(String(error)); } });
el('run').addEventListener('click', () => void run(false));
el('suite').addEventListener('click', () => void run(true));
el('cancel').addEventListener('click', cancel);
el('apply').addEventListener('click', () => { previous = applied; applied = preview; el<HTMLButtonElement>('undo').disabled = false; showPreview(applied); });
el('undo').addEventListener('click', () => { applied = previous; previous = undefined; el<HTMLButtonElement>('undo').disabled = true; showPreview(applied ?? candidates[0]); });
el('download').addEventListener('click', () => { if (preview) download('layout-design-inputs.json', { toolId: 'design', inputs: { boxes: preview.compiled.layers } }); });
el('report').addEventListener('click', () => download('layout-experiments.json', { version: 1, created: new Date().toISOString(), environment: { userAgent: navigator.userAgent, threads: navigator.hardwareConcurrency, isolated: crossOriginIsolated }, summary: summarize(history), results: history }));
addEventListener('pagehide', cancel);
populateSlides();
void fetch('/corpus').then(r => r.json()).then((data: CorpusIndex | null) => {
  corpus = data;
  if (!data) return;
  for (const row of [{ value: 'corpus', label: `Local corpus · ${data.cases.length} slides` }, ...[...new Set(data.cases.map(c => c.deck))].map(deck => ({ value: `deck:${deck}`, label: deck }))]) {
    const option = document.createElement('option'); option.value = row.value; option.textContent = row.label; collection.append(option);
  }
  const wanted = new URLSearchParams(location.search).get('case');
  const found = wanted ? data.cases.find(c => c.id === wanted) : undefined;
  if (found) { collection.value = `deck:${found.deck}`; populateSlides(found.id); }
}).catch(() => status('The optional local corpus could not be read.'));
void fetch('/config').then(r => r.json()).then((config: typeof available) => { available = config; status(`Local models: MiniLM ${config.embed ? 'ready' : 'missing'}, SmolLM ${config.smol ? 'ready' : 'missing'}.`); }).catch(() => status('Could not inspect local model files.'));
