// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTextSignals } from '../engine/src/text-signals.ts';

// A long, English, lexicon-heavy paragraph (>= 40 words) - the "reads as AI" case.
const LLM_PARAGRAPH =
  "In today's ever-evolving landscape it's important to note that we must delve into the " +
  'rich tapestry of modern tools. A robust and seamless approach will foster a holistic ' +
  'workflow. This underscores a pivotal shift, and it showcases how teams can leverage ' +
  'comprehensive systems to garner real results across the board every single day.';

// A long, English, plain-human paragraph with varied sentence lengths and no tells.
const HUMAN_PARAGRAPH =
  'The cat sat. Yesterday I walked to the market and bought some very ripe tomatoes for ' +
  'dinner. It rained. My neighbour waved at me from across the street while carrying a ' +
  'heavy bag of groceries up the stairs. We talked for a while about nothing much at all, ' +
  'then I went home and made soup.';

test('digital text with a zero-width character flags an invisible-char artifact', () => {
  const r = analyzeTextSignals('hello\u200bworld this is a normal looking sentence', { source: 'digital' });
  const f = r.findings.find((x) => x.kind === 'invisible-char');
  assert.ok(f, 'expected an invisible-char finding');
  assert.equal(f?.tier, 'artifact');
  assert.ok(r.band !== 'none');
});

test('Unicode tag characters read as a strong signal', () => {
  const r = analyzeTextSignals('a normal sentence with \u{E0041}\u{E0042} hidden tags', { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'tag-chars'));
  assert.equal(r.band, 'strong');
});

test('a Latin/Cyrillic mixed-script word is a homoglyph tell', () => {
  // "paypal" with a Cyrillic 'а' (U+0430) in place of the Latin 'a'.
  const r = analyzeTextSignals('please sign in at pаypal to continue', { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'mixed-script'));
});

test('OCR-sourced text NEVER returns an artifact finding and sets pixelSourced', () => {
  // Same zero-width character, but read from an image: the byte-level layer is gone.
  const r = analyzeTextSignals('hello\u200bworld with an invisible char', { source: 'ocr' });
  assert.equal(r.pixelSourced, true);
  assert.ok(r.findings.every((x) => x.tier !== 'artifact'), 'OCR must not surface artifact tells');
});

test('an English AI-lexicon paragraph reaches at least notable, with a low-confidence generic guess', () => {
  const r = analyzeTextSignals(LLM_PARAGRAPH, { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'ai-vocabulary' || x.kind === 'ai-phrasing'));
  assert.ok(r.band === 'notable' || r.band === 'strong');
  assert.ok(r.score >= 45, `granular score should be notable+, got ${r.score}`);
  assert.ok(r.styleGuess, 'expected a style guess at notable+');
  assert.equal(r.styleGuess?.confidence, 'low');
  assert.equal(r.styleGuess?.family, 'generic-LLM');
});

test('a leaked model fingerprint names the model with HIGH confidence, on any source', () => {
  const gpt = analyzeTextSignals('An ordinary looking sentence that happens to carry a leaked oaicite turn0search1 token in it.', { source: 'digital' });
  assert.ok(gpt.findings.some((x) => x.kind === 'model-fingerprint'));
  assert.equal(gpt.styleGuess?.confidence, 'high');
  assert.match(gpt.styleGuess?.family ?? '', /OpenAI/);
  assert.ok(gpt.score >= 72, 'a fingerprint is a strong signal');
  // Fingerprints survive OCR (a visible token), unlike byte-level tells.
  const ocr = analyzeTextSignals('read from an image with a [span_1] token left in', { source: 'ocr' });
  assert.equal(ocr.styleGuess?.family, 'Gemini (Google)');
  assert.equal(ocr.styleGuess?.confidence, 'high');
});

test('distinctive Claude tics best-guess Claude (low confidence)', () => {
  const claude = 'The layout is load-bearing here and earns its keep across the board. The shape of the whole thing is structurally different, and at its core it does the heavy lifting. That is the throughline. Where the design sits matters. These are the key takeaways worth naming, and it is the whole game when you pressure-test it today.';
  const r = analyzeTextSignals(claude, { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'claude-tell'));
  assert.equal(r.styleGuess?.family, 'Claude');
  assert.equal(r.styleGuess?.confidence, 'low');
});

test('the score is granular and monotone with evidence', () => {
  const none = analyzeTextSignals(HUMAN_PARAGRAPH, { source: 'digital' }).score;
  const some = analyzeTextSignals(LLM_PARAGRAPH, { source: 'digital' }).score;
  const strong = analyzeTextSignals('leaked oaicite token here in otherwise plain text.', { source: 'digital' }).score;
  assert.equal(none, 0);
  assert.ok(some > none && some < strong, `expected ${none} < ${some} < ${strong}`);
  assert.ok(strong <= 100);
});

test('a plain human paragraph does not read as AI', () => {
  const r = analyzeTextSignals(HUMAN_PARAGRAPH, { source: 'digital' });
  assert.ok(['none', 'weak'].includes(r.band), `expected none/weak, got ${r.band}`);
  assert.equal(r.styleGuess, undefined);
});

test('BIAS GUARD: short text is never judged, even with lexicon words', () => {
  const r = analyzeTextSignals("Delve into the rich tapestry, it's important to note.", { source: 'digital' });
  assert.equal(r.band, 'none');
  assert.ok(!r.findings.some((x) => x.tier === 'heuristic'));
});

test('BIAS GUARD: long non-English text is never judged by heuristics', () => {
  const cyrillic = 'привет мир как у тебя дела сегодня всё хорошо спасибо большое за помощь и внимание '.repeat(3);
  const r = analyzeTextSignals(cyrillic, { source: 'digital' });
  assert.equal(r.band, 'none');
  assert.ok(!r.findings.some((x) => x.tier === 'heuristic'));
});

test('empty text is none with no findings', () => {
  const r = analyzeTextSignals('', { source: 'digital' });
  assert.equal(r.band, 'none');
  assert.equal(r.findings.length, 0);
  assert.equal(r.styleGuess, undefined);
});

// ── v2: heat temperatures, chatbot boilerplate, heat map, doc kinds ──────────

test('every finding carries a heat temperature, graded by confidence', () => {
  const r = analyzeTextSignals(`${LLM_PARAGRAPH} And a leaked oaicite token.`, { source: 'digital' });
  assert.ok(r.findings.length > 0);
  for (const f of r.findings) {
    assert.ok(f.heat > 0 && f.heat <= 1, `heat in (0,1] for ${f.kind}`);
  }
  const fp = r.findings.find((f) => f.kind === 'model-fingerprint');
  const vocab = r.findings.find((f) => f.kind === 'ai-vocabulary');
  assert.ok(fp && vocab && fp.heat > vocab.heat, 'a fingerprint runs hotter than a style tell');
});

test('chatbot boilerplate is flagged with NO length floor', () => {
  const r = analyzeTextSignals('As an AI language model, I cannot help with that request.', { source: 'digital' });
  const f = r.findings.find((x) => x.kind === 'chatbot-leftover');
  assert.ok(f, 'expected a chatbot-leftover finding on a short text');
  assert.ok(r.band !== 'none');
});

test('stacked distinct chatbot phrases can reach strong (unlike pure style)', () => {
  const text = 'As an AI language model, I cannot browse the internet. My knowledge cutoff is early 2025. '
    + 'I hope this helps! Let me know if you have any questions. Would you like me to draft it?';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(r.score >= 72, `stacked boilerplate should read strong, got ${r.score}`);
});

test('QUOTED chatbot phrases are a human writing ABOUT AI - not flagged', () => {
  const r = analyzeTextSignals('The bot replied "As an AI language model, I cannot do that" and we laughed.', { source: 'digital' });
  assert.ok(!r.findings.some((x) => x.kind === 'chatbot-leftover'));
});

test('unfilled template placeholders are an artifact-tier tell', () => {
  const r = analyzeTextSignals('Dear [Insert Name Here], welcome to INSERT_COMPANY_NAME.', { source: 'digital' });
  const f = r.findings.find((x) => x.kind === 'template-placeholder');
  assert.ok(f, 'expected a template-placeholder finding');
  assert.equal(f?.tier, 'artifact');
});

test('em-dashes are judged by DENSITY, not bare count', () => {
  const filler = 'plain ordinary words fill this long sentence about the weather and the garden today. ';
  const sparse = `one\u2014two here. ${filler.repeat(12)} three\u2014four more. ${filler.repeat(12)} five\u2014six end.`;
  const r = analyzeTextSignals(sparse, { source: 'digital' });
  assert.ok(!r.findings.some((x) => x.kind === 'em-dash-density'), '3 em-dashes across ~250 words is normal prose');
});

test('a long text gets a rolling-window heatmap', () => {
  const r = analyzeTextSignals(`${HUMAN_PARAGRAPH} ${LLM_PARAGRAPH} ${HUMAN_PARAGRAPH}`, { source: 'digital' });
  assert.ok(r.heatmap, 'expected a heatmap on a 100+ word text');
  assert.ok((r.heatmap?.cells.length ?? 0) >= 2);
  for (const c of r.heatmap?.cells ?? []) {
    assert.ok(c.heat >= 0 && c.heat <= 1);
    assert.ok(c.length > 0);
  }
});

test('SANDWICH: an AI-dense region inside long human writing surfaces as ai-span', () => {
  const human = 'I walked the dog early because rain was coming. The bakery had sold out of rye again so I tried the seeded loaf instead. '
    + 'My sister rang about the weekend and we argued gently about who would drive. Nothing else happened worth writing down, which suited me fine. ';
  const ai = "It's important to note that we must delve into the rich tapestry of this vibrant, ever-evolving landscape. "
    + 'A seamless, holistic approach will foster transformative synergies and showcase a testament to groundbreaking innovation, '
    + "underscoring the pivotal, multifaceted interplay of comprehensive solutions. Let's explore how to leverage and harness this myriad of cutting-edge, meticulous tools. ";
  const r = analyzeTextSignals(human.repeat(4) + ai.repeat(2) + human.repeat(4), { source: 'digital' });
  const span = r.findings.find((f) => f.kind === 'ai-span');
  assert.ok(span, 'expected an ai-span finding for the hot middle region');
  assert.ok(span?.spans?.[0], 'the ai-span should locate the region');
});

test('CODE doc-kind: AI words in string literals do not flag; comments do', () => {
  const mkCode = (comment: string) => [
    'export function greet(name) {',
    `  // ${comment}`,
    '  const label = "delve tapestry testament seamless holistic pivotal";',
    '  const other = process(label);',
    '  if (!other) { return null; }',
    '  for (const x of list) { emit(x); }',
    '  return { label, other };',
    '}',
    'export const config = { retries: 3, mode: "fast" };',
    'function process(v) { return v.trim(); }',
    'const list = [1, 2, 3].map((n) => n * 2);',
  ].join('\n');
  const clean = analyzeTextSignals(mkCode('validate the input before use'), { source: 'digital' });
  assert.equal(clean.docKind, 'code');
  assert.ok(!clean.findings.some((f) => f.kind === 'ai-vocabulary'), 'string literals must not flag in code');
  const chatty = analyzeTextSignals(mkCode('As an AI language model, I cannot verify this logic.'), { source: 'digital' });
  assert.ok(chatty.findings.some((f) => f.kind === 'chatbot-leftover'), 'chatbot boilerplate in a comment still flags');
});

test('new fingerprints: think tags, ChatML, link params, PUA delimiters, antml', () => {
  const cases: Array<[string, RegExp]> = [
    ['reasoning trace <think> some chain of thought </think> left in', /reasoning model/],
    ['raw dump with <|im_start|>assistant in it', /ChatML/],
    ['see https://example.com/?utm_source=chatgpt.com for more', /OpenAI/],
    [`stripped citation left ${'\u{E200}'} behind`, /OpenAI/],
    [`a pasted <${'antml'}:invoke> fragment`, /Anthropic/], // concatenated so the literal tag never appears in this file
  ];
  for (const [text, family] of cases) {
    const r = analyzeTextSignals(text, { source: 'digital' });
    assert.ok(r.findings.some((f) => f.kind === 'model-fingerprint'), `fingerprint expected for: ${text}`);
    assert.match(r.styleGuess?.family ?? '', family);
    assert.equal(r.styleGuess?.confidence, 'high');
  }
});

test('soft hyphens between letters (PDF/Word residue) are NOT an invisible-char tell', () => {
  const r = analyzeTextSignals('a per\u00adfectly ordi\u00adnary hyphen\u00aded document line', { source: 'digital' });
  assert.ok(!r.findings.some((f) => f.kind === 'invisible-char'), 'discretionary hyphenation is human copy residue');
});

test('the style guess carries ranked candidates', () => {
  const claude = 'The layout is load-bearing here and earns its keep across the board. The shape of the whole thing is structurally different, and at its core it does the heavy lifting. That is the throughline. Where the design sits matters. These are the key takeaways worth naming, and it is the whole game when you pressure-test it today.';
  const r = analyzeTextSignals(claude, { source: 'digital' });
  assert.equal(r.styleGuess?.family, 'Claude');
  assert.ok((r.styleGuess?.candidates?.length ?? 0) >= 1);
  assert.equal(r.styleGuess?.candidates?.[0]?.family, 'Claude');
});

test('LEXICON_VERSION is exported for persisted-analysis invalidation', async () => {
  const { LEXICON_VERSION } = await import('../engine/src/text-signals.ts');
  assert.ok(typeof LEXICON_VERSION === 'number' && LEXICON_VERSION >= 2);
});

// ── v2 review fixes: false-positive regressions (each was a CONFIRMED defect) ──

test('FP: ordinary code identifiers never trip a model fingerprint', () => {
  const py = [
    'def send_mail(recipient, attached_file):',
    '    msg = build(recipient)',
    '    if attached_file:',
    '        msg.attach(attached_file)',
    '    return smtp.send(msg)',
    'class Doc:',
    '    contentReference = None',
    '    def getContentReference(self):',
    '        return self.contentReference',
  ].join('\n');
  const r = analyzeTextSignals(py, { source: 'digital' });
  assert.ok(!r.findings.some((f) => f.kind === 'model-fingerprint'),
    `hand-written code must not be branded: ${JSON.stringify(r.styleGuess)}`);
});

test('FP: an "Assistant:" credits line alone is not Claude - the Human: pair is required', () => {
  const credits = 'Director: Maria Holt\nAssistant: James Lee\nProducer: Chen Wu\nEditor: Sam Reid';
  const r = analyzeTextSignals(credits, { source: 'digital' });
  assert.ok(!r.findings.some((f) => f.kind === 'model-fingerprint'));
  const transcript = 'Human: what is the capital of France?\n\nAssistant: The capital of France is Paris.';
  const t2 = analyzeTextSignals(transcript, { source: 'digital' });
  assert.ok(t2.findings.some((f) => f.kind === 'model-fingerprint' && /Anthropic/.test(f.model ?? '')));
});

test('FP: a courteous human email full of polite closers stays weak at most', () => {
  const email = 'Hi team, I hope this email finds you well. The Q3 numbers are attached, and let me know if you have any '
    + 'questions about the northeast figures. Would you like me to set up a call for Thursday? Feel free to reach out '
    + 'before then if anything looks off. Thanks, Dana';
  const r = analyzeTextSignals(email, { source: 'digital' });
  assert.ok(r.score < 45, `polite human email must stay below notable, got ${r.score}`);
});

test('FP: a markdown README with a fenced code block is NOT docKind code - its prose still flags', () => {
  const readme = [
    '# widget-tool',
    '',
    'A small helper for widgets.',
    '',
    '```js',
    'import { widget } from "widget-tool";',
    'const w = widget({ size: 3 });',
    'w.spin();',
    'const out = w.render();',
    'export default out;',
    'const extra = 1;',
    'const more = 2;',
    '```',
    '',
    'As an AI language model, I cannot test this locally, but the API should work as shown.',
    'I hope this helps! Let me know if you would like me to expand any section.',
  ].join('\n');
  const r = analyzeTextSignals(readme, { source: 'digital' });
  assert.notEqual(r.docKind, 'code');
  assert.ok(r.findings.some((f) => f.kind === 'chatbot-leftover'), 'the pasted-chatbot README must still flag');
});

test('FP: Greek-letter units in engineering prose are not homoglyph artifacts', () => {
  const r = analyzeTextSignals('The pulse width is 5μs and the series resistor is 10kΩ, so ΔT stays under two degrees.', { source: 'digital' });
  assert.ok(!r.findings.some((f) => f.kind === 'mixed-script'), 'μ, Ω and Δ are not Latin-confusable');
});

test('FP: a leading UTF-8 BOM alone is an encoder signature, not a signal', () => {
  const r = analyzeTextSignals('\ufeffJust a perfectly ordinary sentence about the garden and the weather today.', { source: 'digital' });
  assert.ok(!r.findings.some((f) => f.kind === 'invisible-char'));
  assert.equal(r.band, 'none');
});

test('FP: one "Great question!" is counted once, in one bucket, and stays below notable', () => {
  const text = 'Great question! The committee met on Tuesday and agreed to move the fence line two metres north. '
    + 'Minutes were taken by Ellen and the vote passed four to one after a short discussion about drainage.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(r.score < 45, `one greeting must stay below notable, got ${r.score}`);
  assert.ok(!r.findings.some((f) => f.kind === 'ai-phrasing' && /great question/i.test(f.detail ?? '')));
});

test('FP: template-placeholder never fires on code (INSERT_BEFORE is a constant)', () => {
  const js = [
    'export const INSERT_BEFORE = 1;',
    'export const INSERT_AFTER = 2;',
    'function place(node, mode) {',
    '  if (mode === INSERT_BEFORE) { node.before(); }',
    '  else { node.after(); }',
    '  return node;',
    '}',
    'const modes = [INSERT_BEFORE, INSERT_AFTER];',
    'export default place;',
  ].join('\n');
  const r = analyzeTextSignals(js, { source: 'digital' });
  assert.equal(r.docKind, 'code');
  assert.ok(!r.findings.some((f) => f.kind === 'template-placeholder'));
});

// ── claudism-pass identifiers (Matthias Eckermann, github.com/mge1512/skill-claudism-pass, CC0) ──

test('claudism-pass tells lean the guess to Claude', () => {
  const text = 'Sit with that for a moment, because what struck me most is the part everyone misses. '
    + 'The only thing that matters is how you hold the tension between speed and care. '
    + 'Everyone I\'ve worked with eventually learns this. This matters because the stakes compound over time, and that is where it gets tricky for most teams.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  const claude = r.findings.find((f) => f.kind === 'claude-tell');
  assert.ok(claude, 'expected claude-tell hits from the claudism-pass identifiers');
  assert.equal(r.styleGuess?.family, 'Claude');
});

test('mixed US/British spelling across two pairs is a consistency tell', () => {
  const text = 'The colour palette ships with twelve presets, and you can organize the color tokens into folders. '
    + 'Pick a scheme, then analyse the contrast results in the side panel before you export anything. '
    + 'The colour checker runs locally and the report is organised by severity for the whole document.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  const f = r.findings.find((x) => x.kind === 'spelling-variant-mix');
  assert.ok(f, 'color/colour and organize/organise both flip, so the mix should flag');
});

test('a variant word inside backticks never counts toward the spelling mix', () => {
  const text = 'The colour palette is organised into groups and every swatch honours the theme you pick. '
    + 'Set the CSS `color` property and the `text-align: center` rule in your stylesheet to match. '
    + 'The colours update live as you drag, and the organiser keeps favourites pinned to the top row.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(!r.findings.some((x) => x.kind === 'spelling-variant-mix'),
    'a consistently British document quoting CSS keywords must not flag');
});

test('a single mixed pair is not enough - two or more pairs must flip', () => {
  const text = 'We planned the colour scheme on Monday and agreed the color tokens would ship this week. '
    + 'The rest of the plan held: the schedule did not move, the venue stayed booked, and the caterer '
    + 'confirmed the menu for both evenings without any changes at all.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(!r.findings.some((x) => x.kind === 'spelling-variant-mix'));
});

test('LEXICON_VERSION reflects the claudism-pass additions', async () => {
  const { LEXICON_VERSION } = await import('../engine/src/text-signals.ts');
  assert.ok(LEXICON_VERSION >= 3);
});

// ── vendor family tells (plans/126 WP: ChatGPT/Gemini/DeepSeek leans) ────────

test('a ChatGPT-leaning document leans the guess to ChatGPT', () => {
  const text = [
    'The team spirit and camaraderie were palpable from the first standup of the sprint.',
    '- **Key Point:** ship the smallest useful slice first',
    '- **Second Point:** measure before optimising anything at all',
    "Here's the kicker: the slowest part was never the database in any of our tests.",
    'No fluff. No filler. Just results.',
    'Want me to expand any of these sections?',
  ].join('\n');
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.equal(r.styleGuess?.family, 'ChatGPT (OpenAI)', JSON.stringify(r.styleGuess));
  assert.equal(r.styleGuess?.confidence, 'low');
});

test('a Gemini-leaning document leans the guess to Gemini', () => {
  const text = 'However, it is crucial to acknowledge that the rollout requires a multi-pronged approach. '
    + 'A closer examination reveals that the multifaceted nature of the migration was underestimated by the '
    + 'planning group, and the second phase will therefore need a longer runway than the first one did.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.equal(r.styleGuess?.family, 'Gemini (Google)', JSON.stringify(r.styleGuess));
  assert.equal(r.styleGuess?.confidence, 'low');
});

test('identity boilerplate fingerprints name Gemini and Grok, but QUOTED mentions never do', () => {
  const gem = analyzeTextSignals('The reply began: I am a large language model, trained by Google, and went on from there.', { source: 'digital' });
  assert.equal(gem.styleGuess?.family, 'Gemini (Google)');
  assert.equal(gem.styleGuess?.confidence, 'high');
  const grok = analyzeTextSignals('It signed off with built by xAI at the bottom of the page.', { source: 'digital' });
  assert.match(grok.styleGuess?.family ?? '', /Grok/);
  const quoted = analyzeTextSignals('The article noted that "I\'m Grok" is the bot\'s stock reply to identity questions.', { source: 'digital' });
  assert.ok(!quoted.findings.some((f) => f.kind === 'model-fingerprint'), 'a quoted identity string is journalism, not a leak');
});

test('the family competition still resolves a near-tie to generic-LLM', () => {
  // One Claude tic + one ChatGPT tic in the same text: neither clearly wins.
  const text = 'The design is load-bearing for the whole flow, and the camaraderie on the team kept the '
    + 'review cycle honest across three drafts. We shipped the final version on Thursday after the summit.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  if (r.styleGuess) {
    assert.equal(r.styleGuess.family, 'generic-LLM', JSON.stringify(r.styleGuess.candidates));
  }
});

test('PERF: unterminated comment openers scan linearly, not quadratically', () => {
  const text = '/*x;\n'.repeat(52000); // ~256KB, the picker ingest cap; docKind detects as code
  const t0 = performance.now();
  analyzeTextSignals(text, { source: 'digital' });
  const ms = performance.now() - t0;
  assert.ok(ms < 1000, `256KB of unterminated openers took ${Math.round(ms)}ms (was ~1400ms quadratic)`);
});

test('the "beside it" pointer feeds the Claude-phrasing score; spatial help text does not', () => {
  const pointer = analyzeTextSignals(
    'Every claim on the page comes with the mechanism that enforces it beside it. There is ' +
    'no second, richer configuration behind it, and the principle above it still applies to ' +
    'every export we make for customers across the whole year.',
    { source: 'digital' },
  );
  const tell = pointer.findings.find((f) => f.kind === 'claude-tell');
  assert.ok(tell, 'expected a Claude-phrasing finding');
  assert.match(tell!.detail ?? '', /pointer/);

  const spatial = analyzeTextSignals(
    'Open the export panel. The format menu sits at the top, with the size field below it. ' +
    'Pick a preset, then press the Download button beside it. On a phone the preview moves ' +
    'and the controls stack above it instead.',
    { source: 'digital' },
  );
  assert.ok(!spatial.findings.some((f) => f.kind === 'claude-tell'), 'spatial help text must not read as a Claude tell');
});

// ── Lexicon 8: chat-answer layout, serial lists, precision clean-up ──────────
// Every fixture below is synthetic. The thresholds come from the corpus-v4 dev
// split (plans/287); these tests pin the shapes, not the corpus.

const spanText = (text: string, f: { spans?: Array<{ index: number; length: number }> } | undefined): string[] =>
  (f?.spans ?? []).map((s) => text.slice(s.index, s.index + s.length));

const CHAT_PLAIN = [
  'Here is an assessment of the two hosting options, with a recommendation at the end.',
  '',
  '1. Managed hosting',
  'Strengths:',
  'Fast Setup: The provider handles patching, backups and certificates, so a small team can launch in a day.',
  'Predictable Billing: Plans are priced per site, which keeps the monthly cost easy to forecast.',
  'Weaknesses:',
  'Limited Control: You cannot tune the web server or install system packages beyond the approved list.',
  '',
  '2. Self-hosting',
  'Strengths:',
  'Full Flexibility: Every layer of the stack can be configured to match unusual workloads.',
  'Weaknesses:',
  'Operational Load: Someone on the team has to own upgrades, monitoring and incident response.',
  '',
  'Which one should you pick?',
  '',
  'Bottom line: choose managed hosting unless a specific requirement forces you to run the servers yourself.',
].join('\n');

test('chat-structure: a plain-text chat answer is located label by label, heading by heading', () => {
  const r = analyzeTextSignals(CHAT_PLAIN, { source: 'digital' });
  const f = r.findings.find((x) => x.kind === 'chat-structure');
  assert.ok(f, 'expected a chat-structure finding');
  assert.equal(f!.tier, 'heuristic');
  const spans = spanText(CHAT_PLAIN, f);
  // The label with its colon, never the sentence that follows the label.
  for (const s of ['Fast Setup:', 'Predictable Billing:', 'Limited Control:', 'Full Flexibility:', 'Operational Load:', 'Bottom line:']) {
    assert.ok(spans.includes(s), `expected the label span ${s}`);
  }
  // Headings, numbered section titles and the question heading: the whole line is matched.
  for (const s of ['Strengths:', 'Weaknesses:', '1. Managed hosting', '2. Self-hosting', 'Which one should you pick?']) {
    assert.ok(spans.includes(s), `expected the line span ${s}`);
  }
  assert.ok(!spans.some((s) => s.includes('The provider handles')), 'a span must not run into the sentence');
  assert.ok(r.band !== 'none');
});

test('chat-structure: the Markdown bold-label form spans the bold markers and the colon', () => {
  const md = [
    '## Overview',
    '',
    '- **Fast Setup:** The provider handles patching, backups and certificates for you.',
    '- **Predictable Billing:** Plans are priced per site, so the cost is easy to forecast.',
    '- __Limited Control__: You cannot tune the web server beyond the approved settings.',
    '',
    '## Bottom line',
    '',
    'Pick the managed plan unless you need root access to the machines.',
  ].join('\n');
  const f = analyzeTextSignals(md, { source: 'digital' }).findings.find((x) => x.kind === 'chat-structure');
  assert.deepEqual(spanText(md, f), ['## Overview', '**Fast Setup:**', '**Predictable Billing:**', '__Limited Control__:', '## Bottom line']);
});

test('chat-structure: carriage-return line ends are read the same way', () => {
  const r = analyzeTextSignals(CHAT_PLAIN.replace(/\n/g, '\r\n'), { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'chat-structure'));
});

test('chat-structure HUMAN: an interview transcript repeats its speaker labels and does not fire', () => {
  const text = [
    'Interview notes, recorded on the 4th.',
    'Maria: I started at the depot when I was nineteen and never really left.',
    'Tom: What kept you there through the bad years after the closure scare?',
    'Maria: Mostly the people, and the fact that the work was close to home.',
    'Tom: Did the new owners change how the shifts were planned for everyone?',
    'Maria: They did, and not for the better if you ask most of the drivers.',
  ].join('\n');
  assert.ok(!analyzeTextSignals(text, { source: 'digital' }).findings.some((x) => x.kind === 'chat-structure'));
});

test('chat-structure HUMAN: a learner essay with "First reason:" lines does not fire', () => {
  const text = [
    'Some people think students should have a phone in the class, but I disagree with this idea.',
    '',
    'First reason: the phone take the attention of the students and they do not listen the teacher.',
    'Second reason: many students play games in the class and this is not good for the grades.',
    'Third reason: the parents pay for the school and they want that the children learn.',
    'Example: my cousin use the phone all day and now he repeat the year in his school.',
  ].join('\n');
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(!r.findings.some((x) => x.kind === 'chat-structure'), JSON.stringify(r.findings.map((f) => f.kind)));
});

test('chat-structure HUMAN: a structured abstract, an API reference and a numbered paper do not fire', () => {
  const abstract = [
    'Objective: To measure how quickly the dune front retreats after the breakwater was removed.',
    'Methods: Forty stations were surveyed monthly over three winters with a total station.',
    'Results: Retreat averaged nearly two metres per year, highest beside the old breakwater.',
    'Conclusions: Storm frequency explains about half of the variation between winters.',
  ].join('\n');
  const api = [
    '### ttl',
    'Type: `number`',
    'Default: `60000`',
    'Note: the lifetime is measured in milliseconds, not seconds, and applies to every entry.',
    '### max',
    'Type: `number`',
    'Default: `Infinity`',
    'Note: when the cache is full the oldest entry is dropped first, which keeps memory bounded.',
  ].join('\n');
  const paper = [
    '1. Introduction',
    'Coastal erosion has accelerated along the northern shoreline since the breakwater was removed.',
    'We measured the retreat of the dune front at forty stations over three winters.',
    '',
    '2. Methods',
    'Each station was surveyed monthly, and storm events were logged from the tide gauge.',
    'Retreat rates were fitted with a mixed model that treats each station as a random effect.',
    '',
    '3. Results',
    'Retreat averaged nearly two metres per year, with the largest losses near the old breakwater.',
    'Storm frequency explained about half of the variation between winters.',
  ].join('\n');
  for (const [name, text] of [['abstract', abstract], ['api', api], ['paper', paper]] as const) {
    const r = analyzeTextSignals(text, { source: 'digital' });
    assert.ok(!r.findings.some((x) => x.kind === 'chat-structure'), `${name} must not read as a chat layout`);
  }
});

test('chat-structure HUMAN: one heading or two labels alone are ordinary structure', () => {
  const oneHeading = 'Summary\n\nThe council approved the new bus timetable on Monday after a short debate about the late services, '
    + 'and the changes start next month once the drivers have been briefed on the revised routes.';
  const twoLabels = 'Venue Change: The meeting moves to the library annex because the hall is being repainted this week.\n'
    + 'Start Time: We begin half an hour later than usual so the caretaker can open the side door for us.';
  for (const text of [oneHeading, twoLabels]) {
    assert.ok(!analyzeTextSignals(text, { source: 'digital' }).findings.some((x) => x.kind === 'chat-structure'));
  }
});

test('list-triads: serial lists packed densely are located list by list', () => {
  const text = 'The plan covers hiring, training, and retention for the new depot. It sets budgets, owners, and deadlines '
    + 'for each phase, and it names risks, mitigations, and fallbacks in plain terms. Managers review scope, cost, or timing '
    + 'every month, while staff raise safety, comfort, and workload issues in a shared log. Results feed the next quarter.';
  const f = analyzeTextSignals(text, { source: 'digital' }).findings.find((x) => x.kind === 'list-triads');
  assert.ok(f, 'expected a list-triads finding');
  const spans = spanText(text, f);
  assert.ok(spans.includes('hiring, training, and retention'), JSON.stringify(spans));
  assert.ok(spans.includes('scope, cost, or timing'), JSON.stringify(spans));
  assert.ok(spans.every((s) => s.length < 60), 'each span is the list, not its sentence');
});

test('list-triads HUMAN: a couple of serial lists in ordinary prose do not fire', () => {
  const text = 'We packed bread, cheese, and apples for the walk and set off before the fog lifted. The path climbed slowly '
    + 'through the beech wood and out onto the open ridge, where the wind picked up and the view finally opened. '
    + 'By noon we could see the reservoir, the old mill, and the church tower. We ate lunch behind a wall and walked '
    + 'down the long way, past the quarry and the farm shop, arriving home tired and happy just before dark.';
  assert.ok(!analyzeTextSignals(text, { source: 'digital' }).findings.some((x) => x.kind === 'list-triads'));
});

test('chatbot preamble: "Here is an evaluation of…" at a sentence start is a soft leftover', () => {
  const text = 'You asked about the three vendors. Here is an evaluation of their strengths and weaknesses across '
    + 'support, pricing and roadmap, followed by a short recommendation for a team of your size and budget.';
  const f = analyzeTextSignals(text, { source: 'digital' }).findings.find((x) => x.kind === 'chatbot-leftover');
  assert.ok(f, 'expected a chatbot-leftover finding');
  assert.deepEqual(spanText(text, f), ['Here is an evaluation']);
  assert.ok(f!.weight < 1, 'the widened preamble carries the soft weight');
});

test('chatbot preamble HUMAN: "Here is a list" and "Here\'s an example" are ordinary writing', () => {
  const text = 'Thanks for coming to the allotment meeting. Here is a list of the plots that still need a tenant, and '
    + "here's an example of the new watering rota, which starts on the first of the month for everyone.";
  assert.ok(!analyzeTextSignals(text, { source: 'digital' }).findings.some((x) => x.kind === 'chatbot-leftover'));
});

test('chatbot preamble: a hard compliance opener is not counted again by the soft preamble', () => {
  const text = 'Certainly! Here is a draft of the announcement for the spring fair, with the dates and the stall prices filled in.';
  const f = analyzeTextSignals(text, { source: 'digital' }).findings.find((x) => x.kind === 'chatbot-leftover');
  assert.ok(f);
  assert.match(f!.detail ?? '', /^1 assistant-conversation phrase left/, f!.detail ?? 'no detail');
  assert.deepEqual(spanText(text, f), ['Certainly! Here is']);
});

test('"Based on an evaluation of…" counts only as the opening of the document', () => {
  const opening = 'Based on an evaluation of the vendor (vendor.example), they operate as a small specialist firm with a '
    + 'narrow focus on platform teams, internal tooling and the developer experience of mid-sized companies.';
  const f = analyzeTextSignals(opening, { source: 'digital' }).findings.find((x) => x.kind === 'chatbot-leftover');
  assert.deepEqual(spanText(opening, f), ['Based on an evaluation of the vendor (vendor.example),']);
  const midway = 'The vendor runs a small specialist practice. Based on the evaluation we ran in May, it suits teams that '
    + 'already have a platform group and a clear budget for outside research over the coming year.';
  assert.ok(!analyzeTextSignals(midway, { source: 'digital' }).findings.some((x) => x.kind === 'chatbot-leftover'));
});

test('negative parallelism needs the limiting adverb or the reframing subject', () => {
  const structure = (s: string) => analyzeTextSignals(s, { source: 'digital' }).findings.find((x) => x.kind === 'ai-structure');
  const filler = ' The rest of this note covers the timetable for the spring term and the room changes.';
  assert.ok(structure(`The change is not just a new logo, but a new way of working with customers.${filler}`));
  assert.ok(structure(`It's not a rebrand, it's a reset of how the whole team talks to people.${filler}`));
  // Ordinary contrast from a human writer: no structure finding.
  assert.equal(structure(`I did not like the ending, but the first half was gripping and the cast was strong.${filler}`), undefined);
  assert.equal(structure(`We are not in the office on Friday, but the phones are diverted to the duty manager.${filler}`), undefined);
});

test('removed tells: "in conclusion", "at the end of the day", curly quotes and emoji headings no longer score', () => {
  const essay = 'In conclusion, I think at the end of the day the students should choose their own subjects, because they '
    + 'know what they like and what they are good at, and the school can help them with good advice.';
  const r = analyzeTextSignals(essay, { source: 'digital' });
  assert.ok(!r.findings.some((x) => x.kind === 'ai-phrasing'), JSON.stringify(r.findings));
  const curly = '“Yes,” she said. “We’ll go at six.” He didn’t argue… The car’s tank was full, and the map’s folds held. '
    + 'They left the town before the light changed and reached the coast by the middle of the afternoon.';
  assert.ok(!analyzeTextSignals(curly, { source: 'digital' }).findings.some((x) => x.kind === 'smart-punctuation'));
  const readme = '# 🚀 Quick start\n\n- 📦 Install the package from npm and import it.\n- 🛠 Configure the two options in your build file.\n'
    + '\nThat is all you need for a first build of the site on your own machine today.';
  assert.ok(!analyzeTextSignals(readme, { source: 'digital' }).findings.some((x) => x.kind === 'ai-structure'));
});

test('vocabulary: a participle in an "-ing" clause counts once, as structure', () => {
  const text = 'The council approved the plan on Monday, highlighting the need for more buses on the late routes '
    + 'and a better timetable for the school runs across the northern estates of the town this winter.';
  const r = analyzeTextSignals(text, { source: 'digital' });
  assert.ok(r.findings.some((x) => x.kind === 'ai-structure'));
  assert.ok(!r.findings.some((x) => x.kind === 'ai-vocabulary'), 'the same word must not score in two families');
  // Outside such a clause the participles are vocabulary hits as usual.
  const vocab = analyzeTextSignals(`${text} Ensuring the funding matters. Enhancing the service matters. Highlighting the cost matters.`, { source: 'digital' })
    .findings.find((x) => x.kind === 'ai-vocabulary');
  assert.equal(vocab?.spans?.length, 3);
});

test('uniform-burstiness needs ten even sentences, and verse line breaks are not sentences', () => {
  const s = 'The committee met in the small hall to review the budget for the coming year.';
  const has = (t: string) => analyzeTextSignals(t, { source: 'digital' }).findings.some((x) => x.kind === 'uniform-burstiness');
  assert.ok(has(Array(10).fill(s).join(' ')));
  assert.ok(!has(Array(6).fill(s).join(' ')), 'six even sentences are not enough any more');
  const verse = Array(12).fill('the slow grey river turns beneath the willow trees').join('\n');
  assert.ok(!has(verse), 'metre makes verse lines even; that is not a model signal');
});

test('uniform-paragraphs needs six even paragraphs; the five-paragraph essay shape does not fire', () => {
  const p = 'Students learn more when the school day starts later, because they sleep longer and arrive ready to work. '
    + 'Teachers also notice fewer late arrivals and calmer classrooms in the first lesson of the morning.';
  const has = (n: number) => analyzeTextSignals(Array(n).fill(p).join('\n\n'), { source: 'digital' }).findings.some((x) => x.kind === 'uniform-paragraphs');
  assert.equal(has(5), false);
  assert.equal(has(6), true);
});

test('the Verify evidence report maps chat-structure to one weak-clue family with located labels', async () => {
  const { forensicTextFindings } = await import('../engine/src/forensic/text.ts');
  const findings = forensicTextFindings({
    id: '1', width: 0, height: 0, text: CHAT_PLAIN, source: 'digital', complete: true, lines: [], shapes: [],
  });
  const f = findings.find((x) => x.family === 'chat-structure');
  assert.ok(f, 'expected a chat-structure evidence finding');
  assert.equal(f!.contribution, 'weak-clue');
  const located = f!.locations.map((l) => (l.span ? CHAT_PLAIN.slice(l.span.index, l.span.index + l.span.length) : ''));
  assert.ok(located.includes('Fast Setup:'));
});

test('PERF: the line and list patterns stay linear on adversarial 64 KiB input', () => {
  const cases = [
    'Label Word Here: '.repeat(4000),
    'a, b, c, d, e, f, g, '.repeat(3100),
    `${'A'.repeat(65000)}:`,
    'Strengths:\n1. A\n'.repeat(4000),
  ];
  for (const text of cases) {
    const t0 = performance.now();
    analyzeTextSignals(text.slice(0, 65_536), { source: 'digital' });
    const ms = performance.now() - t0;
    assert.ok(ms < 1500, `took ${Math.round(ms)}ms`);
  }
});
