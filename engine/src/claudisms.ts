// SPDX-License-Identifier: MPL-2.0
/**
 * AI writing-tell patterns for the text-signal analyzer (engine/src/text-signals.ts).
 *
 * Three bodies of intelligence, at three confidence levels:
 *
 *  1. MODEL_FINGERPRINTS - leaked tool/citation scaffolding tokens that near-CERTAINLY
 *     name a specific model (Wikipedia "Signs of AI writing", the markup-artifact list):
 *     `oaicite`/`turn0search0` = ChatGPT, `[span_1]` = Gemini, `grok_card` = Grok, and so
 *     on. These are artifacts, not style, so a match is HIGH-confidence model attribution.
 *
 *  2. CLAUDE_TELLS - the phrase and structure tics curated from correcting CLAUDE's own
 *     output (claudisms.ai + scripts/check-docs-vernacular.ts BANNED_PHRASES). A match
 *     best-guesses CLAUDE (low confidence - style names no model with certainty).
 *
 *  3. AI_WORDS / AI_PHRASES / AI_STRUCTURE - the GENERIC base from Wikipedia "Signs of AI
 *     writing" + the AI-vocabulary frequency studies (words 50-269x over human rates): stock
 *     puffery, and the structure tells (copula-avoidance, `-ing` editorializing, negative
 *     parallelism). These fire for any LLM (family 'generic-LLM').
 *
 *  4. CHATBOT_ARTIFACTS - verbatim assistant-register boilerplate ("As an AI…",
 *     refusal/policy phrases, "I hope this helps") left in a document. Phrase-level
 *     evidence a chat answer was pasted; scored in its own bucket above stylometry.
 *
 *  5. FAMILY_TELLS - the per-family style lists the attribution best-guess competes
 *     over (Claude's curated list today; other families join as differentiators land).
 *
 *  6-8. SPELLING_VARIANTS, the chat-answer layout patterns (CHAT_*) and the serial-list
 *     pattern (LIST_TRIAD): data for the document-level checks in text-signals.ts,
 *     which count them per document rather than per match.
 *
 * Kept SEPARATE from the enforcement gate (which bans for style and carries ALLOW/EXEMPT
 * for domain terms) - this list is tuned for DETECTION signal. Pure data: regexes and
 * word lists, no logic. `\b` word boundaries and `gi`/`giu` flags where a span is wanted.
 * Bump LEXICON_VERSION (bottom of this file) on ANY list change - persisted analyses
 * key off it. Refresh sources: Wikipedia "Signs of AI writing" (actively maintained),
 * Matthias Eckermann's claudism-pass skill (github.com/mge1512/skill-claudism-pass),
 * the humanizer pattern catalogue, and the system-prompt-leak collections.
 *
 * Reference: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
 */

/** A named pattern; `re` should be global (`g`) so the analyzer can walk every span. */
export interface Tell {
  re: RegExp;
  label: string;
}

/** A leaked scaffolding token that identifies a specific model. */
export interface ModelFingerprint {
  re: RegExp;
  /** The model this token near-certainly came from, for the attribution. */
  model: string;
  label: string;
  /** When present, the text must ALSO match this for the fingerprint to count -
   *  the co-occurrence gate for tokens too weak to convict alone (e.g. a
   *  line-start "Assistant:" needs a line-start "Human:" somewhere too). */
  requires?: RegExp;
}

// ── 1. Model-fingerprint artifacts (near-certain model ID) ────────────────────
export const MODEL_FINGERPRINTS: ModelFingerprint[] = [
  { re: /\boaicite\b/gi, model: 'ChatGPT (OpenAI)', label: 'OpenAI citation token (oaicite)' },
  { re: /\boai_citation[:\d]/g, model: 'ChatGPT (OpenAI)', label: 'OpenAI citation token (oai_citation)' },
  // The real leaked artifact is `:contentReference[oaicite:N]{index=N}` - the bracket
  // context is required, because bare `contentReference` is an ordinary identifier
  // in hand-written code (a Java bean field must never convict its author).
  { re: /contentReference\[oaicite/g, model: 'ChatGPT (OpenAI)', label: 'OpenAI contentReference token' },
  { re: /\bturn\d+(?:search|news|view|image|forecast)\d+\b/gi, model: 'ChatGPT (OpenAI)', label: 'OpenAI tool-call token' },
  // The invisible-delimiter form: when the private-use wrappers are stripped, the
  // visible husk reads citeturn0search1 / videoturn1view0 - one glued token.
  { re: /\b(?:cite|video|navlist)turn\d+\w+?\d+\b/gi, model: 'ChatGPT (OpenAI)', label: 'OpenAI tool-call token' },
  { re: /\battributableIndex\b/gi, model: 'ChatGPT (OpenAI)', label: 'OpenAI attribution token' },
  { re: /\bfilecite\w*/gi, model: 'ChatGPT (OpenAI)', label: 'OpenAI file-citation token' },
  // The INVISIBLE citation delimiters (private-use U+E200-U+E206) that wrap
  // ChatGPT's citeturn… tokens: stripping the visible token leaves these behind.
  { re: /[\uE200-\uE206]/g, model: 'ChatGPT (OpenAI)', label: 'OpenAI private-use citation delimiter' },
  // Code-interpreter / browsing citations: 【8†L12-L15】 lenticular brackets.
  // Both OpenAI's file-browsing tool and DeepSeek leak this form, so the family hedges.
  { re: /【\d+†[^】\n]{0,60}】/g, model: 'ChatGPT or DeepSeek', label: 'lenticular citation token' },
  { re: /:::writing\{/g, model: 'ChatGPT (OpenAI)', label: 'ChatGPT canvas marker' },
  // ChatML tags exist only in raw model I/O - but the format is shared by
  // fine-tunes and Qwen, so the family is named rather than one product.
  { re: /<\|im_(?:start|sep|end)\|>/g, model: 'a ChatML-format model (OpenAI/Qwen)', label: 'ChatML scaffolding tag' },
  { re: /<\|endoftext\|>/g, model: 'a GPT-family model (OpenAI)', label: 'GPT end-of-text token' },
  // Link parameters the chat UIs stamp on copied URLs: the URL came out of that product.
  { re: /utm_source=(?:chatgpt\.com|openai)/g, model: 'ChatGPT (OpenAI)', label: 'ChatGPT link parameter' },
  { re: /utm_source=copilot\.com/g, model: 'Microsoft Copilot', label: 'Copilot link parameter' },
  { re: /\[\^\d+\^\]/g, model: 'Microsoft Copilot', label: 'Copilot citation marker' },
  { re: /referrer=grok\.com/g, model: 'Grok (xAI)', label: 'Grok link parameter' },
  { re: /\[cite:\s*\d+\]/gi, model: 'Gemini (Google)', label: 'Gemini citation token' },
  { re: /\[cite_start\]/gi, model: 'Gemini (Google)', label: 'Gemini citation token' },
  { re: /\[span_\d+\]/gi, model: 'Gemini (Google)', label: 'Gemini span token' },
  { re: /```tool_(?:code|outputs)\b/g, model: 'Gemini (Google)', label: 'Gemini tool_code fence' },
  { re: /googleusercontent\.com\/[a-z_]*content\/\d/gi, model: 'Gemini (Google)', label: 'Gemini placeholder link' },
  { re: /grok_(?:card|render_citation_card_json)|render_inline_citation|<xaiArtifact\b/gi, model: 'Grok (xAI)', label: 'Grok render token' },
  // Bracketed form only: bare `attached_file` is a common human variable name.
  { re: /ppl-ai-file-upload|\[attached_file:?\d*\]/gi, model: 'Perplexity', label: 'Perplexity upload token' },
  // [INST] is shared by Llama-2 and Mistral prompt formats; <<SYS>> pins Llama-2.
  { re: /\[\/?INST\]/g, model: 'Llama or Mistral (Meta/Mistral)', label: 'Llama/Mistral instruction tag' },
  { re: /<<\/?SYS>>/g, model: 'Llama (Meta)', label: 'Llama system tag' },
  { re: /<\|(?:start_header_id|eot_id)\|>/g, model: 'Llama (Meta)', label: 'Llama-3 header tag' },
  // Claude's tool-use scaffolding namespace leaking into a paste.
  { re: /<\/?antml:/g, model: 'Claude (Anthropic)', label: 'Claude tool-scaffolding tag' },
  // First-person identity boilerplate. The analyzer skips QUOTED fingerprint
  // matches, so an article quoting the assistant does not convict itself.
  { re: /\bI(?:'m| am) (?:just )?a (?:large )?language model,? (?:trained by|from) Google\b/gi, model: 'Gemini (Google)', label: 'Gemini self-identification' },
  { re: /still learning how to answer this question[^.\n]{0,60}try Google Search/gi, model: 'Gemini (Google)', label: 'Gemini refusal boilerplate' },
  { re: /\bI'?m Grok\b|\bbuilt by xAI\b/g, model: 'Grok (xAI)', label: 'Grok self-identification' },
  // Reasoning-trace tags leak when a chain-of-thought model's raw output is pasted.
  { re: /<\/?think>/g, model: 'a reasoning model (DeepSeek-R1-style)', label: 'reasoning think tag' },
  // Transcript scaffolding: Claude's classic turn format leaking into a paste.
  // BOTH halves must appear - "Assistant: <name>" alone is ordinary human writing
  // (film credits, staff rosters, org charts), so the co-occurrence gate requires
  // a line-start "Human:" too before this counts.
  { re: /(?:^|\n)Assistant:[ \t]/g, requires: /(?:^|\n)Human:[ \t]/, model: 'Claude (Anthropic)', label: 'Claude transcript scaffolding' },
];

// ── The "beside it" pointer (Andy, 2026-10-01) ─────────────────────────────────
// "beside it", "next to it", "in front of it", "behind it", "above it" and "below it"
// used as a vague pointer: "each claim has a mechanism behind it", "with the reason
// beside it". The reader has to work out what "it" is and where. Spatial writing
// keeps these phrases legitimately ("the field above it", "the backdrop behind it"),
// so a hit does not count when its sentence names a layout or physical element from
// the list below. Shared by this lexicon and the docs, comment and UI-copy gates
// (scripts/check-docs-vernacular.ts), so the detector and the gates agree.
export const SPATIAL_CONTEXT_WORDS: readonly string[] = [
  // Interface parts
  'button', 'field', 'chip', 'badge', 'icon', 'label', 'preview', 'panel', 'pane', 'sidebar',
  'rail', 'toolbar', 'bar', 'strip', 'slider', 'wheel', 'swatch', 'canvas', 'layer', 'screen',
  'window', 'dialog', 'modal', 'menu', 'tab', 'row', 'column', 'card', 'tile', 'grid', 'cell',
  'image', 'photo', 'picture', 'thumbnail', 'logo', 'heading', 'headline', 'title', 'caption',
  'box', 'frame', 'slide', 'toggle', 'checkbox', 'dropdown', 'input', 'cursor', 'pointer',
  'arrow', 'dot', 'pill', 'handle', 'ruler', 'header', 'footer', 'sheet', 'stage', 'viewport',
  'dock', 'popover', 'tooltip', 'overlay', 'scrollbar', 'table', 'map', 'pin', 'marker',
  'link', 'qr',
  // Scenes and the physical world
  'scene', 'camera', 'light', 'backdrop', 'background', 'subject', 'mesh', 'floor', 'wall',
  // No 'person' or 'people': "the people behind it" is the figurative use itself.
  'sky', 'horizon', 'room', 'building', 'street', 'road', 'car', 'tree', 'door', 'shelf', 'desk', 'chair', 'monitor', 'display', 'poster', 'sign', 'phone', 'tablet',
  // Placement words
  'sit', 'sits', 'sitting', 'stack', 'stacked', 'drag', 'dragged', 'painted', 'drawn', 'pinned',
  'docked', 'placed', 'positioned', 'aligned', 'overlaid', 'scroll', 'scrolled', 'hover',
  'top', 'bottom', 'left', 'corner', 'edge', 'margin',
  // Source layout and geometry, for code comments: "the loop below it", "the vertex beside it"
  'line', 'loop', 'call', 'function', 'block', 'statement', 'comment', 'branch', 'case',
  'element', 'node', 'child', 'sibling', 'vertex', 'segment', 'curve', 'glyph', 'letter',
];
const SPATIAL_WORD = `(?:${SPATIAL_CONTEXT_WORDS.join('|')})(?:e?s)?`;
/**
 * The pointer phrase, skipped when the same sentence (no `.`, `!`, `?` or line break
 * in between) names a spatial word before or after it. Pass 'gi' for span walking,
 * 'i' for a per-line `test()`.
 */
export function spatialPointerRe(flags = 'gi'): RegExp {
  return new RegExp(
    String.raw`\b(?:beside|next to|in front of|behind|above|below) it\b` +
      String.raw`(?<!\b${SPATIAL_WORD}\b[^.!?\n]*)(?![^.!?\n]*\b${SPATIAL_WORD}\b)`,
    flags,
  );
}

// ── 2. Claude-leaning tics (best-guess Claude) ────────────────────────────────
// The distinctive ones Andy flagged in CLAUDE's output. The generic stock phrases live
// in AI_PHRASES instead, so they do not tip the guess to Claude on their own.
export const CLAUDE_TELLS: Tell[] = [
  { re: /\bload-bearing\b/gi, label: '"load-bearing"' },
  { re: /\bearns? its keep\b/gi, label: '"earns its keep"' },
  { re: /\bheavy lifting\b/gi, label: '"heavy lifting"' },
  { re: /\bphysically cannot\b/gi, label: '"physically cannot"' },
  { re: /\bit deserves\b/gi, label: '"it deserves"' },
  { re: /\bthe shape of\b/gi, label: 'abstract "the shape of"' },
  { re: /\bwhere \S+ (?:sits|fits)\b/gi, label: '"where X sits/fits"' },
  { re: /\bat its core\b/gi, label: '"at its core"' },
  { re: /\b(?:structurally|foundationally|fundamentally) [a-z]+\b/gi, label: '"structurally X" hedge' },
  { re: /\bthroughline\b/gi, label: '"throughline"' },
  { re: /\b(?:north star|true north)\b/gi, label: '"north star"' },
  { re: /\bpressure[- ]test/gi, label: '"pressure-test"' },
  { re: /\bright[- ]siz(?:e|es|ed|ing)\b/gi, label: '"right-size"' },
  { re: /\b(?:the whole (?:game|ballgame)|the entire point)\b/gi, label: 'totalising "the whole game"' },
  { re: /\bseen this movie before\b/gi, label: '"seen this movie before"' },
  { re: /\bwhere it gets (?:interesting|tricky|hard|fun)\b/gi, label: '"where it gets interesting"' },
  // From Matthias Eckermann's claudism-pass scanner
  // (github.com/mge1512/skill-claudism-pass, CC0; claudisms.ai banlist): reflective
  // pose, manufactured emphasis, placement metaphors, false intimacy, announcing.
  { re: /\bsit with (?:that|this|it)\b/gi, label: 'reflective "sit with it"' },
  { re: /\b(?:struck me most|stuck with me)\b/gi, label: 'manufactured "struck me most"' },
  { re: /\bhold(?:s|ing)? the tension\b/gi, label: '"hold the tension"' },
  { re: /\bthe only thing that matters\b/gi, label: 'totalising "the only thing that matters"' },
  { re: /\beveryone I'?ve (?:worked|talked|spoken) with\b/gi, label: 'false intimacy "everyone I\'ve worked with"' },
  { re: /\bthis matters because\b/gi, label: 'announcing "this matters because"' },
  { re: /\bworth naming\b/gi, label: '"worth naming"' },
  { re: /\blessons learned\b/gi, label: '"lessons learned"' },
  { re: /\bkey takeaways?\b/gi, label: '"key takeaways"' },
  // The copula flourish: "the X is Y here." - a subject redefined and hedged with "here".
  { re: /(?<=[\w'’] )(?<!there )is (?:not )?(?:the|a|an) [\w'’-]+(?: [\w'’-]+){0,2} here[.,!?:;]/gi, label: 'the "…is Y here." flourish' },
  // The trailing "here," aside (Andy, 2026-09-24): "The risk here, though, is…",
  // "What matters here, then, …" - "here" as the last word before a comma, used
  // as a pointer at the argument rather than a place. The literal senses are
  // left out (over/right/in/out/up/down/near/back here, come/get/stay/live here,
  // click/tap here, from here) and so is the copula flourish above, which already
  // scores "is the X here," so one span never counts twice.
  // Lexicon 8 (corpus-v4 dev split): the bare "here," form fired on 1.0% of human
  // documents against 0.5% of AI ones, almost all of them the place sense ("they're
  // all here, and"). It now needs the parenthetical adverb that makes it a pointer:
  // "here, though," / "here, then," / "here, of course,".
  { re: /(?<=[\w'’] )(?<!\b(?:over|right|in|out|up|down|near|back|from|around|come|came|get|got|getting|stay|stayed|live|lived|living|work|worked|click|tap|start|sit|wait|stop) )(?<!\b(?:is|are|was|were) (?:not )?(?:the|a|an) [\w'’-]+(?: [\w'’-]+){0,2} )here,(?=[ \t]+(?:though|then|of course|however|again|really|admittedly|frankly|honestly|incidentally|by contrast|in particular|in practice|at least|arguably),)/gi, label: 'the "…here," aside' },
  // Abstract-register nouns Andy flagged (2026-08-21): bookkeeping and machine
  // words applied to ideas. Weak on their own - the frames are scoped so each
  // word's literal senses (accounting, physics, data layout) stay out, and
  // density weighting keeps any single hit quiet.
  { re: /\bledgers? of\b|\ba (?:running|living|quiet|small|single) ledger\b|\bkeeps? a ledger\b/gi, label: 'abstract "ledger"' },
  { re: /\bmachinery of\b|\bthe [\w-]+ machinery\b/gi, label: 'abstract "machinery"' },
  { re: /(?<!\b(?:quantum|fluid|orbital|classical|statistical|celestial|auto) )\bmechanics of\b/gi, label: 'abstract "mechanics of"' },
  { re: /\bsurviv(?:e|es|ed|ing) (?:contact with|scrutiny|translation|the (?:cut|edit|rewrite|transition|retelling|journey))\b|\bwhat survives\b/gi, label: 'figurative "survives"' },
  { re: /\bstructure of the (?:argument|essay|answer|response|conversation|thinking|reasoning|claim|story|prose|piece|writing|work|problem)\b/gi, label: 'abstract "structure of the argument"' },
  { re: spatialPointerRe('gi'), label: '"beside it" / "behind it" pointer' },
  // From the docs gate's claudism list (scripts/check-docs-vernacular.ts), kept in step
  // with it (Andy, 2026-10-01). Left out on purpose, because ordinary human writing uses
  // them too often for a score: "say so", "in X terms", figurative "lands", "the X
  // fits", "names" as a verb, "what X is worth", a sentence that ends in "it", and the
  // house-style domain rules (transcribe, admissible, survivable, honesty note, the
  // code-comment self-references).
  { re: /\bworth knowing\b/gi, label: '"worth knowing"' },
  { re: /\bnow says so\b/gi, label: '"now says so"' },
  { re: /\bbrings? (?:me|us) back to\b/gi, label: '"brings us back to"' },
  { re: /\banchors? it\b/gi, label: '"anchors it" (prose verb)' },
  // The short assertion tacked on after a comma: ", in full", ", by design", ", end to end".
  { re: /,\s+(?:in full|in short|by design|on purpose|deliberately|end[- ]to[- ]end|for real|full stop|every time|nothing (?:more|less)|no (?:more|less)|for good|and nothing else|by construction|no exceptions|plain and simple|simple as that|once and for all|precisely|honestly|byte[- ]for[- ]byte|in one place|and that(?:'s| is) (?:it|all))(?=[*_"'’”]*(?:[.,;:!?)]|\s+-\s|\s*$))/gim, label: 'short assertion after a comma (", in full")' },
  // A heading that ends in "it" ("How to hold us to it"): markdown or HTML headings.
  { re: /^\s{0,3}#{1,6}\s.*(?<![\w.'’`-])[Ii]t[\s*_"'’”)\]?!.:]*$|<h[1-6]\b[^>]*>(?:(?!<\/h[1-6]).)*?(?<![\w.'’`-])[Ii]t[\s*_"'’”)\]?!.:]*<\/h[1-6]>/gm, label: 'heading that ends in "it"' },
];

// ── 3a. Generic AI vocabulary (Wikipedia + frequency studies) ─────────────────
// Distinctive, over-represented words. The most common (key/additionally/valuable) are
// left out to keep human prose from tripping it; density weighting handles the rest.
// Lexicon 8, measured on the corpus-v4 dev split (1,430 human, 5,234 AI documents):
// 'ensuring', 'enhancing' and 'highlighting' joined (one human document each, 47, 18
// and 26 AI documents). The words that left, or were tested and kept out, are listed
// with their measurements in AI_WORDS_LEFT_OUT below. A participle that already opens
// an "-ing" editorializing clause is scored there, not here as well.
export const AI_WORDS: string[] = [
  'delve', 'delving', 'delved', 'tapestry', 'testament', 'boasts', 'boasting', 'bolster',
  'bolstered', 'underscore', 'underscores', 'underscoring', 'intricate', 'intricacies',
  'meticulous', 'meticulously', 'pivotal', 'showcase', 'showcases', 'showcasing', 'nestled',
  'renowned', 'groundbreaking', 'seamlessly', 'holistic', 'myriad', 'plethora',
  'elevate', 'elevating', 'embark', 'harness', 'harnessing', 'garner', 'garnered', 'resonate',
  'resonates', 'resonating', 'captivate', 'captivating', 'commendable', 'noteworthy',
  'invaluable', 'multifaceted', 'transformative', 'cutting-edge', 'paramount', 'cornerstone',
  'unwavering', 'exemplifies', 'fostering', 'vibrant', 'nuanced', 'comprehensive',
  'unlock', 'unlocking', 'leveraging', 'interplay',
  'empower', 'empowering', 'streamline', 'streamlining', 'revolutionize', 'revolutionizing',
  'unleash', 'unparalleled', 'burgeoning', 'game-changer', 'game-changing',
  'ensuring', 'enhancing', 'highlighting',
];

/**
 * Words measured on the corpus-v4 dev split and kept OUT of AI_WORDS, so a later
 * pass does not add them back without new evidence. Human / AI document rates:
 * the first three were in the list and fired as often on human as on AI text
 * (0.7/0.8%, 0.3/0.4%, 0.3/0.2%); the next seven had a human domain above 5%
 * (abstracts 8%, abstracts 9%, READMEs 6%, READMEs 13%, abstracts 7%, abstracts and
 * learner essays 9% and 6%) or no AI hits at all; the last two were excluded by design
 * before lexicon 8 and still are.
 */
export const AI_WORDS_LEFT_OUT: readonly string[] = [
  'leverage', 'foster', 'seamless',
  'crucial', 'robust', 'ensure', 'align', 'moreover', 'furthermore', 'actionable',
  'additionally', 'key',
];

// ── 3b. Generic AI phrases / puffery / signposting (Wikipedia) ────────────────
export const AI_PHRASES: Tell[] = [
  { re: /\bit'?s (?:important|worth) (?:to note|noting|mentioning)\b/gi, label: '"it\'s important/worth to note"' },
  { re: /\bit is (?:important|worth) (?:to note|noting|mentioning)\b/gi, label: '"it is important/worth to note"' },
  // "in conclusion" and the end-of-the-day idiom were removed in lexicon 8: on the
  // corpus-v4 dev split they fired more on human writing than on AI writing (3.8%
  // against 2.4%, 0.5% against 0.1%), and "in conclusion" alone reached 24% of the
  // learner essays, the taught connector of non-native writers.
  { re: /\bin summary\b/gi, label: '"in summary"' },
  { re: /\bwhen it comes to\b/gi, label: '"when it comes to"' },
  { re: /\ba testament to\b/gi, label: '"a testament to"' },
  { re: /\b(?:stands|serves) as a (?:testament|reminder)\b/gi, label: '"stands as a testament"' },
  { re: /\bplays? a (?:crucial|vital|significant|key|pivotal) role\b/gi, label: '"plays a crucial role"' },
  { re: /\bunderscores? its importance\b/gi, label: '"underscores its importance"' },
  { re: /\brich (?:tapestry|history|cultural heritage)\b/gi, label: '"rich tapestry"' },
  { re: /\bleaves? a lasting\b/gi, label: '"leaves a lasting"' },
  { re: /\bindelible mark\b/gi, label: '"indelible mark"' },
  { re: /\bdeeply rooted\b/gi, label: '"deeply rooted"' },
  { re: /\bcontinues to (?:captivate|inspire|shape|evolve)\b/gi, label: '"continues to captivate"' },
  { re: /\bin today'?s (?:world|era|fast-paced|digital)/gi, label: '"in today\'s world"' },
  { re: /\bnavigating the (?:complexities|landscape|world|challenges)\b/gi, label: '"navigating the complexities"' },
  { re: /\bshed(?:s|ding)? light on\b/gi, label: '"shed light on"' },
  { re: /\bpav(?:e|es|ed|ing) the way\b/gi, label: '"pave the way"' },
  { re: /\bdiv(?:e|es|ing) (?:into|deeper)\b/gi, label: '"dive into/deeper"' },
  { re: /\bcannot be overstated\b/gi, label: '"cannot be overstated"' },
  { re: /\bvaluable insights?\b/gi, label: '"valuable insights"' },
  // The enthusiastic-greeting tell lives in CHATBOT_SOFT only - listing it here
  // too scored the same span in two buckets at once.
  { re: /\blet'?s (?:break it down|explore|dive in|dive into|turn to|unpack)\b/gi, label: 'signposting "let\'s explore"' },
  { re: /\bthe future (?:looks|is) bright\b/gi, label: 'generic ending ("the future looks bright")' },
  { re: /\bwould be (?:complete|remiss) without\b/gi, label: '"would be complete/remiss without"' },
  { re: /\blook no further\b/gi, label: '"look no further"' },
  { re: /\bever-(?:evolving|changing|expanding|growing)\b/gi, label: '"ever-evolving"' },
  { re: /\b(?:digital|competitive|evolving|modern|business|technological|existing|wider|current) landscape\b/gi, label: '"…landscape" puffery' },
  { re: /\bin the realm of\b/gi, label: '"in the realm of"' },
  { re: /\btake (?:it|this|your [\w-]+) to the next level\b/gi, label: '"to the next level"' },
  { re: /\bunlock(?:ing)? the (?:full )?(?:power|potential|possibilit(?:y|ies))\b/gi, label: '"unlock the potential"' },
  { re: /\bwhat sets [\w' -]{2,25} apart\b/gi, label: '"what sets X apart"' },
  { re: /\bit'?s (?:crucial|essential) to (?:note|remember|understand)\b/gi, label: '"it\'s crucial to note"' },
  { re: /\bhere'?s the thing\b/gi, label: 'fake-candid "here\'s the thing"' },
  { re: /\bthe real question is\b/gi, label: '"the real question is"' },
  { re: /\bdon'?t get me wrong\b/gi, label: '"don\'t get me wrong"' },
  { re: /\bexciting times lie ahead\b/gi, label: 'generic ending ("exciting times lie ahead")' },
  { re: /\bhere'?s what you need to know\b/gi, label: '"here\'s what you need to know"' },
  { re: /\bparadigm shift\b/gi, label: '"paradigm shift"' },
  { re: /\bstrategic imperative\b/gi, label: '"strategic imperative"' },
  // From the docs gate's claudism list (scripts/check-docs-vernacular.ts): generic
  // stock phrasing, so it counts here rather than tipping the guess to Claude.
  { re: /\bdeep[ -]dives?\b/gi, label: '"deep dive"' },
  { re: /\btreasure trove\b/gi, label: '"treasure trove"' },
  { re: /\b(?:the )?bar is (?:high|higher|low|lower)\b|\brais(?:e|es|ed|ing) the bar\b/gi, label: '"raise the bar" metaphor' },
  { re: /\b(?:reflecting a broader trend|marking a significant shift)\b/gi, label: '"reflecting a broader trend"' },
  { re: /\bmoving on to\b/gi, label: 'signposting "moving on to"' },
  // Bare "worth noting"; the "it's worth noting" form is scored by the entries above.
  { re: /(?<!\bit'?s |\bit is )\bworth noting\b/gi, label: '"worth noting"' },
  { re: /\blean(?:s|ing|ed)? into (?:the|it|this|that|your|our|their)\b/gi, label: '"lean into"' },
];

// ── 6. US/British spelling variant pairs (the consistency tell) ───────────────
// A human writes in ONE spelling tradition; a model (or a document stitched from
// model output) flips mid-text. From the variant-pairs idea in Matthias
// Eckermann's claudism-pass scanner (github.com/mge1512/skill-claudism-pass).
// Each entry is [US form, British form, label]; the analyzer flags a MIX
// of two or more pairs, never a single word. The licence pair is deliberately
// absent (UK English legitimately uses licence-the-noun and license-the-verb).
export const SPELLING_VARIANTS: Array<{ us: RegExp; uk: RegExp; label: string }> = [
  { us: /\bcolor(?:s|ed|ing|ful)?\b/gi, uk: /\bcolour(?:s|ed|ing|ful)?\b/gi, label: 'color/colour' },
  { us: /\borganiz(?:e|es|ed|ing|ation|ations)\b/gi, uk: /\borganis(?:e|es|ed|ing|ation|ations)\b/gi, label: 'organize/organise' },
  { us: /\banalyz(?:e|es|ed|ing)\b/gi, uk: /\banalys(?:e|es|ed|ing)\b/gi, label: 'analyze/analyse' },
  { us: /\bbehaviors?\b/gi, uk: /\bbehaviours?\b/gi, label: 'behavior/behaviour' },
  { us: /\bcenter(?:s|ed|ing)?\b/gi, uk: /\bcentre(?:s|d)?\b/gi, label: 'center/centre' },
  { us: /\bfavorites?\b/gi, uk: /\bfavourites?\b/gi, label: 'favorite/favourite' },
  { us: /\boptimiz(?:e|es|ed|ing|ation)\b/gi, uk: /\boptimis(?:e|es|ed|ing|ation)\b/gi, label: 'optimize/optimise' },
  { us: /\brecogniz(?:e|es|ed|ing)\b/gi, uk: /\brecognis(?:e|es|ed|ing)\b/gi, label: 'recognize/recognise' },
  { us: /\bflavors?\b/gi, uk: /\bflavours?\b/gi, label: 'flavor/flavour' },
];

// ── 3c. Generic AI STRUCTURE / grammar tells (Wikipedia) ──────────────────────
export const AI_STRUCTURE: Tell[] = [
  // Negative parallelism: "not just X, but Y" / "it's not X, it's Y". Lexicon 8 dropped
  // the bare "not X, but Y" form, which fired on 3.6% of human documents against 4.1%
  // of AI ones (reviews 13%, learner essays 6%): ordinary contrast, not a tell. The
  // limiting adverb, or a subject that sets up the reframe, is now required (human
  // 0.8%, AI 2.4%).
  { re: /\bnot (?:just|only|merely|simply) [^,.\n]{2,40},\s+(?:but|it'?s|it is)\b|\b(?:it|this|that)(?:'s|’s| is) not (?:about )?[^,.\n]{2,40}[,;]\s+(?:it'?s|it’s|it is|but)\b|\b(?:it|this|that) isn(?:'|’)?t (?:about )?[^,.\n]{2,40}[,;]\s+(?:it'?s|it’s|it is|but)\b/gi, label: 'negative parallelism ("not X, but Y")' },
  { re: /\bnot (?:just|only|merely) [^,.\n]{2,40}\bbut also\b/gi, label: 'negative parallelism ("not just X, but also Y")' },
  // Present-participle editorializing clause attributing significance.
  { re: /,\s+(?:highlighting|emphasizing|underscoring|reflecting|showcasing|symbolizing|demonstrating|illustrating|ensuring|cultivating|fostering|encompassing|enhancing) \b/gi, label: '"-ing" editorializing clause' },
  // Copula-avoidance verbs standing in for "is/are".
  { re: /\b(?:serves|stands|functions) as\b/gi, label: 'copula-avoidance ("serves as")' },
  // Label-colon lists (bold or plain) are counted by the chat-structure patterns
  // below (CHAT_LABEL_LINE), which need several distinct labels in one document.
  // The emoji-decorated heading and emoji-bulleted list tells were removed in lexicon
  // 8: they fired on 5% of the human READMEs in corpus-v4 and on no AI document.
  // Audience-pandering false dichotomy: "whether you're a X or a Y".
  { re: /\bwhether you'?re an? [^,.\n]{2,30} or an?\b/gi, label: '"whether you\'re a… or a…"' },
];

// ── 4. Chatbot boilerplate left in a document (assistant-register artifacts) ──
// Verbatim assistant-conversation content, in TWO grades. CHATBOT_ARTIFACTS is
// the HARD list - identity disclosures, compliance openers, refusal/policy
// boilerplate, capability and knowledge-cutoff disclaimers. Nobody human writes
// "As an AI language model" in a brochure, so these weigh above stylometry (own
// scoring bucket, no length floor - the phrase is its own guard). CHATBOT_SOFT
// is the polite-close grade: phrases chatbots END on but humans also genuinely
// write ("I hope this helps", "feel free to reach out") - real signal in bulk,
// never conviction alone, so the analyzer weighs them far lower with their own
// small cap. An ordinary human business email full of polite closers must never
// read as strong.
export const CHATBOT_ARTIFACTS: Tell[] = [
  { re: /\bas an? (?:AI|artificial intelligence|large language model|language model|AI (?:assistant|model))\b/gi, label: '"As an AI…" self-identification' },
  { re: /\bI(?:'m| am) (?:just )?an? (?:AI|artificial intelligence|large language model|language model)\b/gi, label: '"I am an AI" self-identification' },
  { re: /(?:^|\n)[ \t]*(?:Sure|Certainly|Absolutely|Of course)[!,.][ \t]+(?:Here(?:'s| is| are)|I(?:'ve| have) (?:created|drafted|outlined|prepared|put together))/g, label: 'compliance opener ("Certainly! Here is…")' },
  { re: /(?:^|\n)[ \t]*Here(?:'s| is) an? (?:draft|outline|version|summary|example|breakdown|overview|template) (?:of|for)\b/gi, label: '"Here is a draft of…" intro' },
  { re: /\bI(?:'m| am) sorry,? but I (?:can'?t|cannot|am unable to)\b/gi, label: 'refusal boilerplate' },
  { re: /\bI (?:can'?t|cannot|am unable to) (?:fulfill|fulfil|comply with|assist with|help with) (?:that|this) request\b/gi, label: 'refusal boilerplate' },
  { re: /\b(?:against|violates?|contrary to) my (?:safety |ethical |core )?(?:guidelines|policies|principles|programming)\b/gi, label: 'policy-citation boilerplate' },
  { re: /\bI (?:do not|don'?t) have (?:access to real[- ]time|real[- ]time access|the ability to browse|access to the internet|personal (?:opinions|experiences|preferences|feelings))\b/gi, label: 'capability disclaimer' },
  { re: /\bI (?:cannot|can'?t) browse the internet\b/gi, label: 'capability disclaimer' },
  { re: /\b(?:my|the) knowledge (?:cutoff|cut-?off)\b/gi, label: 'knowledge-cutoff disclaimer' },
  { re: /\bas of my (?:last|latest|most recent) (?:knowledge )?(?:update|training)\b/gi, label: 'knowledge-cutoff disclaimer' },
];

// Polite closers: chatbot-favoured but genuinely human too. Low weight, own cap.
export const CHATBOT_SOFT: Tell[] = [
  { re: /\bI hope this (?:helps|email finds you well|information (?:is|was) helpful|is what you(?:'re| are) looking for)\b/gi, label: '"I hope this helps" sign-off' },
  { re: /\blet me know if you(?:'d like| would like| have any| need|r| want)\b/gi, label: '"let me know if…" sign-off' },
  { re: /\bwould you like me to\b/gi, label: '"Would you like me to…" offer' },
  { re: /\bfeel free to (?:reach out|ask|adjust|modify|customize|customise|tweak)\b/gi, label: '"feel free to…" close' },
  { re: /\bgreat question[.!]/gi, label: '"Great question!"' },
  { re: /\byou(?:'re| are) absolutely right\b/gi, label: '"You\'re absolutely right"' },
  { re: /\bnot (?:a substitute|meant as a substitute) for professional (?:medical|legal|financial)? ?advice\b/gi, label: 'professional-advice disclaimer' },
  { re: /\bconsult (?:with )?a (?:qualified|licensed) (?:medical |legal |financial |healthcare )?(?:professional|provider|attorney|physician)\b/gi, label: 'consult-a-professional hedge' },
  // The assistant presenting its deliverable at a sentence start: "Here is an
  // evaluation of…", "Here's a structured assessment." Wider than the hard
  // "Here is a draft of…" entry above (any sentence start, up to two adjectives,
  // more nouns), so it is graded soft: on the corpus-v4 dev split it matched no
  // human document, but "Here is a list" (one human hit) and "Here's an example"
  // (five) are ordinary writing and stay out. A span the hard entry already
  // scored is not counted again.
  { re: /(?<=(?:^|[\n.!?:])["”’')*_]{0,3}[ \t]{0,8})Here(?:'s|’s| is) (?:a|an|the|my) (?:[\w-]+,? ){0,2}(?:evaluation|analysis|assessment|review|comparison|overview|breakdown|summary|look|rundown|guide|plan|draft|outline|framework|checklist|sample|template|version|approach|description)\b/gi, label: '"Here is an evaluation of…" preamble' },
  // A document that opens on its own sourcing: "Based on an evaluation of X, …",
  // "Based on the information provided, …". Only at the very start of the text;
  // mid-document "Based on the results, …" is ordinary report writing. No
  // corpus-v4 document of either kind opens this way, so it carries the soft grade.
  { re: /^[\s\uFEFF]{0,8}Based on (?:an|the|my|your|available|current) (?:[\w-]+ ){0,2}(?:evaluation|analysis|assessment|review|research|search|information|details|description|data|knowledge|sources|context|findings|evidence|understanding)\b(?:[^.!?\n]|\.(?=\S)){0,140}?,/g, label: 'opening "Based on an evaluation of…" framing' },
];

// ── 5. Per-family style tells (attribution best-guess, always low confidence) ──
// One entry per model family whose OUTPUT STYLE is distinctive enough to lean a
// guess. Claude's list is curated in this repo; other families join as their
// differentiators are established. The analyzer scores each family's tells
// independently and only leans to a family that clearly outscores the rest -
// otherwise the guess stays 'generic-LLM'. Style never names a model with
// certainty; only a MODEL_FINGERPRINTS match may do that.
export interface FamilyTells {
  family: string;
  tells: Tell[];
}

// ChatGPT-leaning tics. Sources: Reinhart et al. PNAS 2025 (per-model lexical
// fingerprints: camaraderie/palpable at 100-150x human rates in GPT-4o, while
// Llama over-uses DIFFERENT words), the ICML 2025 idiosyncrasies study (bold
// enumeration labels are ChatGPT's habit specifically; Claude's count clusters
// at zero), and the documented GPT-5 "Want me to…?" closer (OpenAI later tuned
// it). Every entry is a LEAN for the attribution guess, never a conviction.
export const CHATGPT_TELLS: Tell[] = [
  { re: /\bcamaraderie\b/gi, label: '"camaraderie" (GPT-favoured)' },
  { re: /\bpalpable\b/gi, label: '"palpable" (GPT-favoured)' },
  // The single bold label ("**Key Point:** …") left this list in lexicon 8: one
  // occurrence fired on 10% of the human READMEs in corpus-v4 against 0.4% of AI
  // documents. A run of distinct labels, bold or plain, is the chat-structure
  // pattern now (CHAT_LABEL_LINE), counted once per document.
  // The follow-up-offer closer at a line end - a chat habit left in a document.
  { re: /(?:^|\n)(?:Do you )?[Ww]ant me to [^?\n]{3,80}\?[ \t]*$/gm, label: '"Want me to…?" closer' },
  { re: /\bhere'?s the kicker\b/gi, label: '"here\'s the kicker"' },
  // Staccato triads: "No fluff. No filler. Just results."
  { re: /\bNo \w[^.\n]{0,20}\. No \w[^.\n]{0,20}\. Just \w/g, label: 'staccato "No X. No Y. Just Z."' },
];

// Gemini-leaning tics (community-curated Wikipedia signs + comparative writeups).
// The identity strings live in MODEL_FINGERPRINTS; these are style leans only.
export const GEMINI_TELLS: Tell[] = [
  { re: /\bHowever, it is (?:crucial|important) to acknowledge\b/gi, label: '"However, it is crucial to acknowledge"' },
  { re: /\brequires? a multi-pronged approach\b/gi, label: '"a multi-pronged approach"' },
  { re: /\bA closer examination reveals\b/gi, label: '"A closer examination reveals"' },
  { re: /\bthe multifaceted nature of\b/gi, label: '"the multifaceted nature of"' },
];

// DeepSeek-leaning tics. The lenticular citation form is a FINGERPRINT (shared
// with OpenAI's file tool, hedged there); these are the softer residue tells.
export const DEEPSEEK_TELLS: Tell[] = [
  // Full-width CJK punctuation glued into Latin prose - tokeniser residue.
  { re: /(?<=[a-zA-Z]) ?[，。；] ?(?=[a-zA-Z])/g, label: 'CJK punctuation inside English text' },
  // A near-verbatim R1 reasoning-summary phrase with essentially no human rate.
  { re: /\baha moment (?:I can|worth) flag(?:ging)?\b/gi, label: 'reasoning-summary residue' },
];

export const FAMILY_TELLS: FamilyTells[] = [
  { family: 'Claude', tells: CLAUDE_TELLS },
  { family: 'ChatGPT (OpenAI)', tells: CHATGPT_TELLS },
  { family: 'Gemini (Google)', tells: GEMINI_TELLS },
  { family: 'DeepSeek', tells: DEEPSEEK_TELLS },
];

// ── 7. Chat-answer scaffolding (the chat-structure family, weak) ──────────────
// The layout a chat answer is pasted in: a run of "Label: sentence" lines, short
// headings such as "Strengths" / "Bottom line", "1. As a Research Partner" section
// titles and a stand-alone question as a heading. Plain-text copies keep this shape
// after the Markdown is gone, so these are read line by line in text-signals.ts,
// which also holds the counting rules. One family: the parts are four views of one
// layout, so they are counted once.

/** A label line: optional indent, bullet or number, an optional bold or underscore
 *  wrapper, a 1-6 word label that starts with a capital, a colon and the rest of the
 *  line. Groups: 1 = opening wrapper, 2 = the label, 3 = the text after the colon.
 *  Applied to one line at a time (no `g`, no `m`). */
export const CHAT_LABEL_LINE =
  /^[ \t]{0,3}(?:(?:[-*•+]|\d{1,2}[.)])[ \t]+)?(\*\*|__)?([A-Z][A-Za-z0-9'’&/+-]*(?:[ \t]+[A-Za-z0-9'’&/+()-]+){0,5}?)(?:\*\*|__)?:(?:\*\*|__)?[ \t]+(.+)$/;

/** Labels that are ordinary human structure, never counted: ordinal and essay
 *  markers (learner essays write "First reason: …"), notes and warnings, the
 *  sections of a structured abstract, API reference fields, mail headers and recipe
 *  fields. Compared case-insensitively against the whole label. */
export const CHAT_LABEL_STOP =
  /^(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|finally|lastly|next|then|also|example|examples|e\.g|note|notes|nb|n\.b|ps|p\.s|caution|warning|important|tip|hint|update|edit|source|sources|q|a|question|answer|objective|objectives|aim|aims|purpose|background|method|methods|result|results|conclusion|conclusions|significance|design|setting|settings|participants|introduction|findings|discussion|context|motivation|type|types|default|returns|return|params|parameters|arguments|usage|syntax|see also|license|licence|author|authors|maintainer|maintainers|version|date|time|from|to|subject|cc|bcc|re|fwd|tl;dr|tldr|disclaimer|ingredients|directions|instructions|serves|yield|prep time|cook time|total time)$/i;
/** A label containing one of these words is an essay or document marker, not a
 *  chat label ("Second reason: …", "Step 3: …", "Part two: …"). */
export const CHAT_LABEL_STOP_WORD = /\b(?:reason|step|part|chapter|section|figure|table|appendix)\b/i;

/** Short headings chat answers organise themselves under. A line counts when, after
 *  Markdown markers, numbering and a trailing colon are stripped, it is exactly one
 *  of these (case-insensitive). From the task brief plus the headings the 108 fresh
 *  chat answers in corpus-v4 use; none appears as a heading in its human documents
 *  except "considerations" (one README). Paper section names (introduction,
 *  conclusion, limitations, results) are left out. */
export const CHAT_SCAFFOLD_HEADINGS: readonly string[] = [
  'strengths', 'weaknesses', 'pros', 'cons', 'pros and cons', 'advantages', 'disadvantages',
  'trade-offs', 'tradeoffs', 'caveats', 'red flags', 'considerations', 'key considerations',
  'key takeaways', 'key takeaway', 'takeaways', 'key points', 'key factors', 'key differences',
  'key evaluation criteria', 'recommendation', 'recommendations', 'my recommendation',
  'overview', 'summary', 'overall summary', 'in summary', 'in short', 'short answer',
  'the short answer', 'tl;dr', 'tldr', 'bottom line', 'the bottom line', 'verdict',
  'final verdict', 'overall assessment', 'final thoughts', 'next steps', 'tips',
  'practical tips', 'final tips', 'common pitfalls', 'pitfalls to avoid', 'common mistakes',
  'rule of thumb', 'what to expect', 'how to prepare', 'why it matters', 'why this matters',
  'things to consider', 'questions to ask',
];

/** A numbered section title on its own line: "1. As a Research Partner",
 *  "## 2) Data protection". Groups: 1 = the number, 2 = the title. Counted only as
 *  a run starting at 1 with body text under each title. */
export const CHAT_NUMBERED_TITLE =
  /^[ \t]{0,3}(?:#{1,6}[ \t]+)?(?:\*\*|__)?(\d{1,2})[.)][ \t]+(?:\*\*|__)?([A-Z][^.!?:;\n]{1,70}?)(?:\*\*|__)?[ \t]*$/;

/** A short question standing alone as a heading ("Who would be a better partner?").
 *  Group 1 = the question. Verse and FAQ pages have these too, so they only add
 *  locations when other chat structure is present, never count on their own. */
export const CHAT_QUESTION_HEADING =
  /^[ \t]{0,3}(?:#{1,6}[ \t]+)?(?:\*\*|__)?([A-Z][^.!?\n]{2,80}\?)(?:\*\*|__)?[ \t]*$/;

// ── 8. Serial lists ("X, Y, and Z"), the list-triads family (weak) ────────────
// One serial list: the last word of the first item, a middle item, "and" or "or",
// and the first word of the last item. With the serial comma the middle item may
// run to three words ("reservoir, the old mill, and the church"); without it, to
// two, because "the way, past the quarry and the farm" is a clause, not a list.
// The span covers the list rather than its sentence. Scored on density against
// the human 99th percentile of the corpus-v4 dev split, by document length, in
// text-signals.ts.
export const LIST_TRIAD =
  /(?<![\p{L}\p{N}'’&/-])[\p{L}\p{N}][\p{L}\p{N}'’&/-]*, (?:[\p{L}\p{N}][\p{L}\p{N}'’&/-]*(?: [\p{L}\p{N}][\p{L}\p{N}'’&/-]*){0,2}, |[\p{L}\p{N}][\p{L}\p{N}'’&/-]*(?: [\p{L}\p{N}][\p{L}\p{N}'’&/-]*)? )(?:and|or) [\p{L}\p{N}][\p{L}\p{N}'’&/-]*(?![\p{L}\p{N}'’&/-])/gu;

/**
 * Bumped on ANY change to the lists in this module. Consumers that PERSIST an
 * analysis (e.g. a catalog asset's stored AI-signal note) key it by this, so a
 * stored verdict from an older lexicon is recomputed rather than trusted.
 */
export const LEXICON_VERSION = 9;
