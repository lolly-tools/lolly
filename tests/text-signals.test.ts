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
