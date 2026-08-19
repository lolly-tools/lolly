// SPDX-License-Identifier: MPL-2.0
/**
 * "Humanize" a text asset - a DETERMINISTIC, on-device clean-up of the AI artifacts a
 * text-signal analysis flags, plus a tidy of the typography to house style. This is the
 * MECHANICAL half of what a tool like blader/humanizer does; the SEMANTIC half (rewriting
 * AI vocabulary, "serves as"→"is", breaking tricolons) needs a text-generation model, and
 * Lolly runs none on-device - so those tells are HIGHLIGHTED for a person to reword (via
 * the text-signal marks), never rewritten here.
 *
 * NOT provenance laundering: it removes invisible characters, leaked model-scaffolding
 * tokens, and curly-quote / em-dash noise - privacy and typography hygiene - and it never
 * touches a C2PA credential (a plain text asset carries none) or claims the result is
 * human-written. Text in, cleaned text plus a change report out. Pure, DOM-free.
 *
 * PROVENANCE RULE (Andy): this is a DETERMINISTIC edit, so it is NOT AI-generated and
 * carries NO genAI flag - the same rule matte follows (it removes, it does not invent).
 * The result is a plain edit of the original, kept as a C2PA ingredient. If a future
 * option runs a MODEL to rewrite the wording, THAT path MUST stamp `aiGenerated` in the
 * ingredient so the genAI provenance follows the asset wherever it is used. This module
 * runs no model, so it never stamps one.
 */
import { MODEL_FINGERPRINTS } from './claudisms.ts';

/** One class of change the clean-up made, for a "what changed" summary. */
export interface HumanizeChange {
  kind: string;
  label: string;
  count: number;
}

export interface HumanizeResult {
  text: string;
  changes: HumanizeChange[];
}

/**
 * Deterministically clean the mechanical AI artifacts + tidy typography. Idempotent:
 * running it on already-clean text changes nothing and reports no changes.
 */
export function humanizeText(input: string): HumanizeResult {
  let text = input;
  const changes: HumanizeChange[] = [];
  const apply = (re: RegExp, repl: string, kind: string, label: string): void => {
    const g = re.flags.includes('g') ? re : new RegExp(re.source, `${re.flags}g`);
    let n = 0;
    text = text.replace(g, () => { n += 1; return repl; });
    if (n > 0) changes.push({ kind, label, count: n });
  };

  // 1. Leaked model-scaffolding tokens (oaicite, [span_1], grok_card, ChatML tags, …). The
  //    highest-value strip: they name the model AND are pure noise. A structural one
  //    (\nAssistant:, a ```tool_code fence) may match a leading newline - keep it, so lines
  //    are not glued together. Summed into one change naming the models seen.
  let fpCount = 0;
  const fpModels = new Set<string>();
  for (const fp of MODEL_FINGERPRINTS) {
    // Honor the co-occurrence gate: a token too weak to convict alone (a lone
    // line-start "Assistant:" in a credits list) must not be stripped either.
    if (fp.requires && !new RegExp(fp.requires.source, fp.requires.flags.replace('g', '')).test(text)) continue;
    const g = fp.re.flags.includes('g') ? fp.re : new RegExp(fp.re.source, `${fp.re.flags}g`);
    text = text.replace(g, (m) => { fpCount += 1; fpModels.add(fp.model); return m.startsWith('\n') ? '\n' : ''; });
  }
  if (fpCount > 0) changes.push({ kind: 'fingerprint', label: `Model scaffolding tokens (${[...fpModels].join(', ')})`, count: fpCount });

  // 2. Invisible / hidden characters. ZWJ/ZWNJ (U+200C/D) are KEPT - they are load-carrying
  //    in emoji sequences and Arabic/Indic shaping - so only the never-legitimate set goes.
  apply(/[​⁠﻿᠎­]/g, '', 'invisible', 'Invisible / zero-width characters');
  apply(/[\u{E0000}-\u{E007F}]/gu, '', 'tag-char', 'Hidden tag characters');
  apply(/[‭‮]/g, '', 'bidi', 'Bidirectional override characters');
  apply(/[\u{E0100}-\u{E01EF}]/gu, '', 'variation', 'Unusual variation selectors');

  // 3. Typography → house style.
  apply(/—/g, ' - ', 'em-dash', 'Em-dashes to " - "');
  // En-dash to " - " EXCEPT a numeric range (3–5 / pp.3–5 stay).
  apply(/(?<!\d)\s*–\s*(?!\d)/g, ' - ', 'en-dash', 'En-dashes to " - "');
  apply(/[‘’]/g, "'", 'curly-apos', 'Curly apostrophes to straight');
  apply(/[“”]/g, '"', 'curly-quote', 'Curly quotes to straight');
  apply(/…/g, '...', 'ellipsis', 'Unicode ellipsis to "..."');
  // Non-breaking space to a normal space, minus the French carve-out (before high
  // punctuation, where French wants the NBSP).
  apply(/ (?![;:!?»])/g, ' ', 'nbsp', 'Non-breaking spaces to a space');

  // 4. Tidy the whitespace the strips can leave behind.
  apply(/[ \t]{2,}/g, ' ', 'multi-space', 'Collapsed repeated spaces');
  apply(/[ \t]+$/gm, '', 'trailing-space', 'Removed trailing whitespace');

  return { text, changes };
}
