// SPDX-License-Identifier: MPL-2.0
/** The cheap test for "might this text carry an emoji", on its own so the runtime can ask without loading the pinned tables. */

/**
 * Surrogate pairs (which covers the regional indicators), variation selector 16,
 * zero-width joiner, the keycap mark and the BMP emoji ranges. Written in escapes so
 * the source file carries no invisible characters. A trigger only: `segmentEmojiText`
 * decides what is really an emoji, so this may say yes to text that turns out to hold
 * none and must never say no to text that holds one. Accented letters, typographic
 * punctuation and most scripts say no here, so they load no tables and no pack.
 */
export const EMOJI_TEXT_TRIGGER = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u200D\u20E3\uFE0F\u00A9\u00AE\u203C\u2049\u2122\u2139\u2194-\u21AA\u231A-\u231B\u2328\u23CF-\u23FA\u24C2\u25AA-\u25FE\u2600-\u27BF\u2934-\u2935\u2B00-\u2BFF\u3030\u303D\u3297\u3299]/;

/** Exposed for tests and for a host that wants the same pre-check. */
export const emojiTextTrigger = (text: string): boolean => EMOJI_TEXT_TRIGGER.test(text);
