// SPDX-License-Identifier: MPL-2.0
/**
 * The order host.text.toPath shapes a run in, when that order is not simply left to
 * right.
 *
 * HarfBuzz shapes one direction and one script per buffer. Handed a whole line that
 * mixes them, it applies the first script it finds to everything: Latin inside Arabic
 * comes out reversed, digits too, and Arabic after a Latin word loses its joining.
 * So a line that holds right-to-left characters goes through the Unicode bidi algorithm
 * first (engine/src/text-unicode.ts, the same analysis text composition uses) and each
 * level and script run is shaped on its own, in visual order.
 *
 * A complex script mixed with another script needs the same split, for its shaping
 * rules rather than its order: Devanagari after a Latin word has to be shaped as
 * Devanagari.
 *
 * Text with neither, which is every purely left-to-right Latin, Greek, Cyrillic or CJK
 * run, returns null and shapes exactly as it always did, so its outlines keep their
 * bytes.
 */
import { analyzeTextBidi, reorderTextRuns, textBidiClass, textLineLevels, textScript, textScriptRuns } from '../../../engine/src/text-unicode.ts';

export type TextRunDirection = 'ltr' | 'rtl';

/** Bidi classes that put a right-to-left level into a line. */
const RTL_CLASSES = new Set(['R', 'AL', 'RLE', 'RLO', 'RLI']);
/** Scripts one general-purpose shaping pass draws correctly, whatever sits beside them. */
const SIMPLE_SCRIPTS = new Set(['Latn', 'Grek', 'Cyrl', 'Armn', 'Geor', 'Ethi', 'Cher', 'Cans', 'Copt', 'Ogam', 'Runr', 'Yiii', 'Hani', 'Hira', 'Kana', 'Hang', 'Bopo', 'Zyyy', 'Zinh', 'Zzzz']);
function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 127) return false;
  return true;
}

/** Does this text hold a character that reads right to left? */
export function hasRtlText(text: string): boolean {
  if (isAscii(text)) return false;
  for (const char of text) if (RTL_CLASSES.has(textBidiClass(char.codePointAt(0)!))) return true;
  return false;
}

/** The direction of the first strong character, which is what `dir="auto"` means. */
export function firstStrongDirection(text: string): TextRunDirection {
  if (isAscii(text)) return 'ltr';
  for (const char of text) {
    const cls = textBidiClass(char.codePointAt(0)!);
    if (cls === 'R' || cls === 'AL') return 'rtl';
    if (cls === 'L') return 'ltr';
  }
  return 'ltr';
}

/** Does this text hold a script whose letters change shape or place when shaped? */
export function hasComplexScript(text: string): boolean {
  if (isAscii(text)) return false;
  for (const char of text) if (!SIMPLE_SCRIPTS.has(textScript(char.codePointAt(0)!))) return true;
  return false;
}

/** The scripts in this text, as codes such as `Arab`, leaving out punctuation and digits. */
export function scriptsOf(text: string): string[] {
  const out = new Set<string>();
  for (const char of text) {
    const script = textScript(char.codePointAt(0)!);
    if (script !== 'Zyyy' && script !== 'Zinh' && script !== 'Zzzz') out.add(script);
  }
  return [...out];
}

function mixesComplexScript(text: string): boolean {
  if (isAscii(text)) return false;
  const scripts = textScriptRuns(text).map((run) => run.script).filter((script) => script !== 'Zyyy' && script !== 'Zinh' && script !== 'Zzzz');
  return scripts.length > 1 && scripts.some((script) => !SIMPLE_SCRIPTS.has(script));
}

export interface OrderedRun { start: number; end: number; rtl: boolean; script: string }

/**
 * The run's direction and script pieces in visual order, left to right, or null when
 * the text needs no splitting. `direction` is the paragraph's own direction; omitted, a
 * line takes it from its first strong character.
 */
export function orderedRuns(text: string, direction?: TextRunDirection): OrderedRun[] | null {
  if (direction !== 'rtl' && !hasRtlText(text) && !mixesComplexScript(text)) return null;
  try {
    const paragraph = analyzeTextBidi(text, direction ?? 'auto');
    const scripts = textScriptRuns(text);
    const out: OrderedRun[] = [];
    for (const level of reorderTextRuns(textLineLevels(paragraph, { start: 0, end: text.length }))) {
      const rtl = level.level % 2 === 1;
      const parts = scripts
        .filter((run) => run.start < level.end && run.end > level.start)
        .map((run) => ({ start: Math.max(run.start, level.start), end: Math.min(run.end, level.end), rtl, script: run.script }));
      out.push(...(rtl ? parts.reverse() : parts));
    }
    return out;
  } catch {
    // Text the analysis refuses (an unpaired surrogate) shapes as one run, as it always did.
    return null;
  }
}

export interface ShapingSegment { text: string; face: number; start: number; rtl?: boolean; script?: string }

/**
 * What toPath hands HarfBuzz, one buffer per entry and in pen order. `faces` splits a
 * piece of text by the font that can draw it, which each shell does over its own loaded
 * chain. `rtl` and `script` are present only on a split run; without them the shaper
 * guesses both from the text, which is right for text that needs no splitting.
 */
export function shapingSegments(
  text: string, direction: TextRunDirection | undefined,
  faces: (part: string) => Array<{ text: string; face: number }>,
): ShapingSegment[] {
  const ordered = orderedRuns(text, direction);
  if (!ordered) {
    let at = 0;
    return faces(text).map((seg) => { const start = at; at += seg.text.length; return { ...seg, start }; });
  }
  const out: ShapingSegment[] = [];
  for (const run of ordered) {
    let at = run.start;
    const parts = faces(text.slice(run.start, run.end)).map((seg) => {
      const start = at; at += seg.text.length;
      return { ...seg, start, rtl: run.rtl, script: run.script };
    });
    out.push(...(run.rtl ? parts.reverse() : parts));
  }
  return out;
}
