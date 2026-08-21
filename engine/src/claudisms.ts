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
  // Abstract-register nouns Andy flagged (2026-08-21): bookkeeping and machine
  // words applied to ideas. Weak on their own - the frames are scoped so each
  // word's literal senses (accounting, physics, data layout) stay out, and
  // density weighting keeps any single hit quiet.
  { re: /\bledgers? of\b|\ba (?:running|living|quiet|small|single) ledger\b|\bkeeps? a ledger\b/gi, label: 'abstract "ledger"' },
  { re: /\bmachinery of\b|\bthe [\w-]+ machinery\b/gi, label: 'abstract "machinery"' },
  { re: /(?<!\b(?:quantum|fluid|orbital|classical|statistical|celestial|auto) )\bmechanics of\b/gi, label: 'abstract "mechanics of"' },
  { re: /\bsurviv(?:e|es|ed|ing) (?:contact with|scrutiny|translation|the (?:cut|edit|rewrite|transition|retelling|journey))\b|\bwhat survives\b/gi, label: 'figurative "survives"' },
  { re: /\bstructure of the (?:argument|essay|answer|response|conversation|thinking|reasoning|claim|story|prose|piece|writing|work|problem)\b/gi, label: 'abstract "structure of the argument"' },
];

// ── 3a. Generic AI vocabulary (Wikipedia + frequency studies) ─────────────────
// Distinctive, over-represented words. The most common (key/additionally/valuable) are
// left out to keep human prose from tripping it; density weighting handles the rest.
export const AI_WORDS: string[] = [
  'delve', 'delving', 'delved', 'tapestry', 'testament', 'boasts', 'boasting', 'bolster',
  'bolstered', 'underscore', 'underscores', 'underscoring', 'intricate', 'intricacies',
  'meticulous', 'meticulously', 'pivotal', 'showcase', 'showcases', 'showcasing', 'nestled',
  'renowned', 'groundbreaking', 'seamless', 'seamlessly', 'holistic', 'myriad', 'plethora',
  'elevate', 'elevating', 'embark', 'harness', 'harnessing', 'garner', 'garnered', 'resonate',
  'resonates', 'resonating', 'captivate', 'captivating', 'commendable', 'noteworthy',
  'invaluable', 'multifaceted', 'transformative', 'cutting-edge', 'paramount', 'cornerstone',
  'unwavering', 'exemplifies', 'foster', 'fostering', 'vibrant', 'nuanced', 'comprehensive',
  'unlock', 'unlocking', 'leverage', 'leveraging', 'interplay',
  'empower', 'empowering', 'streamline', 'streamlining', 'revolutionize', 'revolutionizing',
  'unleash', 'unparalleled', 'burgeoning', 'game-changer', 'game-changing',
];

// ── 3b. Generic AI phrases / puffery / signposting (Wikipedia) ────────────────
export const AI_PHRASES: Tell[] = [
  { re: /\bit'?s (?:important|worth) (?:to note|noting|mentioning)\b/gi, label: '"it\'s important/worth to note"' },
  { re: /\bit is (?:important|worth) (?:to note|noting|mentioning)\b/gi, label: '"it is important/worth to note"' },
  { re: /\bin conclusion\b/gi, label: '"in conclusion"' },
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
  { re: /\bat the end of the day\b/gi, label: '"at the end of the day"' },
  { re: /\bin today'?s (?:world|era|fast-paced|digital)/gi, label: '"in today\'s world"' },
  { re: /\bnavigating the (?:complexities|landscape|world|challenges)\b/gi, label: '"navigating the complexities"' },
  { re: /\bshed(?:s|ding)? light on\b/gi, label: '"shed light on"' },
  { re: /\bpav(?:e|es|ed|ing) the way\b/gi, label: '"pave the way"' },
  { re: /\bdiv(?:e|es|ing) (?:into|deeper)\b/gi, label: '"dive into/deeper"' },
  { re: /\bcannot be overstated\b/gi, label: '"cannot be overstated"' },
  { re: /\bvaluable insights?\b/gi, label: '"valuable insights"' },
  // The enthusiastic-greeting tell lives in CHATBOT_SOFT only - listing it here
  // too scored the same span in two buckets at once.
  { re: /\blet'?s (?:break it down|explore|dive in|dive into|unpack)\b/gi, label: 'signposting "let\'s explore"' },
  { re: /\bthe future (?:looks|is) bright\b/gi, label: 'generic ending ("the future looks bright")' },
  { re: /\bwould be (?:complete|remiss) without\b/gi, label: '"would be complete/remiss without"' },
  { re: /\blook no further\b/gi, label: '"look no further"' },
  { re: /\bever-(?:evolving|changing|expanding|growing)\b/gi, label: '"ever-evolving"' },
  { re: /\b(?:digital|competitive|evolving|modern|business|technological) landscape\b/gi, label: '"…landscape" puffery' },
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
  // Negative parallelism: "not just X, but Y" / "it's not X, it's Y".
  { re: /\b(?:it'?s |it is )?not (?:just |only |merely |simply )?[^,.\n]{2,40},\s+(?:but|it'?s|it is)\b/gi, label: 'negative parallelism ("not X, but Y")' },
  { re: /\bnot (?:just|only|merely) [^,.\n]{2,40}\bbut also\b/gi, label: 'negative parallelism ("not just X, but also Y")' },
  // Present-participle editorializing clause attributing significance.
  { re: /,\s+(?:highlighting|emphasizing|underscoring|reflecting|showcasing|symbolizing|demonstrating|illustrating|ensuring|cultivating|fostering|encompassing|enhancing) \b/gi, label: '"-ing" editorializing clause' },
  // Copula-avoidance verbs standing in for "is/are".
  { re: /\b(?:serves|stands|functions) as\b/gi, label: 'copula-avoidance ("serves as")' },
  // The bold-label colon list moved to CHATGPT_TELLS (ICML 2025 idiosyncrasies
  // study: ChatGPT bolds enumeration labels; Claude's count clusters at zero) -
  // one list per phrase, so it must not also live here.
  // Emoji-decorated headings / emoji-bulleted lists - chat-styled markdown.
  { re: /^[ \t]*#{1,6}[^\n]*\p{Extended_Pictographic}/gmu, label: 'emoji-decorated heading' },
  { re: /^[ \t]*[-*•][ \t]*\p{Extended_Pictographic}/gmu, label: 'emoji-bulleted list' },
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
  // The bold-label list: **Key Point:** as a bullet or mini-heading. Fires only
  // on raw markdown bytes (the literal asterisks gate it), so prose never trips.
  { re: /^[ \t]*(?:[-*•][ \t]+)?\*\*[A-Z][^*\n]{1,60}\*\*:/gm, label: 'bold label + colon list ("**Key Point:** …")' },
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

/**
 * Bumped on ANY change to the lists in this module. Consumers that PERSIST an
 * analysis (e.g. a catalog asset's stored AI-signal note) key it by this, so a
 * stored verdict from an older lexicon is recomputed rather than trusted.
 */
export const LEXICON_VERSION = 5;
