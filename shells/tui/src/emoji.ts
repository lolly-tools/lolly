// SPDX-License-Identifier: MPL-2.0
/**
 * Emoji for export formats + tool categories (gallery cards, tool header, export box).
 *
 * ALIGNMENT RULE - the cards are a fixed-width grid, so a glyph whose terminal width ≠
 * Ink's `string-width` drifts the borders. TWO traps:
 *   1. Variation selectors (`️`/VS16) - e.g. 🖼️ measures 1 but renders 2. Never use them.
 *   2. Codepoints OUTSIDE U+1F300–1F5FF - dingbats like ✨ (U+2728) and post-2016 emoji
 *      (🧾 🧩) render width-1 in some terminals/fonts even though string-width says 2.
 * So every glyph below is a single Unicode-6.0 (2010) emoji in U+1F300–1F5FF-ish - the
 * set every terminal reliably draws double-wide. Keep it that way.
 */
const FMT: Record<string, string> = {
  png: '📷', jpg: '📷', jpeg: '📷', webp: '📷', avif: '📷', tiff: '📷', 'cmyk-tiff': '📷', gif: '📷',
  svg: '📐', eps: '📐', 'eps-cmyk': '📐', emf: '📐',
  pdf: '📄', 'pdf-cmyk': '📄',
  html: '🌐', md: '📝', txt: '📝',
  json: '📋', csv: '📋',
  webm: '🎬', mp4: '🎬',
  ico: '🔳', ics: '📅', vcf: '👤', zip: '📦',
};

const CAT: Record<string, string> = {
  everyone: '👥', designer: '🎨', event: '🎫', utility: '🔧',
};

// Per-tool NAME-line icon (by tool id) - a specific emoji for the TYPE of each tool.
// Kept single-codepoint + mostly within U+1F300–1F5FF so the fixed-width card borders stay
// aligned. Two intentional exceptions: `tool-logo` uses the 🐧💚🦎 ligature (the SUSE brand
// font renders it as the logo), and `pose-geeko` uses 🦎 (the Geeko) - both font/width
// trade-offs on a single card. Unmapped tools fall back to the category emoji.
const TOOL: Record<string, string> = {
  'color-block': '🔷', 'dynamic-layout': '📰', 'quotes': '💬', 'meeting-planner': '💼',
  'snippet': '💻', 'qr-code': '🔳', 'tool-logo': '🐧💚🦎',
  'email-signature': '📧', 'chart-creator': '📊', 'color-palette': '🎨',
  'countdown-timer': '🕐', 'url-shot': '📸', 'strip-data': '🔒',
  'text-helper': '📝', 'event-name-badge': '📛', 'wayfinding-signage': '🚏', 'brand-lockup': '🔖',
  'digi-ad': '📺', 'calendar-ics': '📅', 'compress-pdf': '📉', 'multi-page-pdf': '📚',
  'filter': '🌗', 'logo-wall': '🏁', 'diagram-builder': '🔗',
  'logo-lockup-partner': '🏢', 'icon': '💠', 'design': '📐', 'lottie-digi-ad': '🎬',
  'pose-geeko': '🦎', 'voice-recorder': '🎤', 'top-tail-recorder': '📹',
};

export const fmtEmoji = (f: string | undefined): string => (f ? FMT[f.toLowerCase()] : undefined) ?? '📄';
export const catEmoji = (c: string | undefined): string => (c ? CAT[c.toLowerCase()] : undefined) ?? '📁';
/** The tool's NAME-line icon: its specific per-tool emoji, else the category emoji. */
export const toolIcon = (id: string | undefined, category: string | undefined): string =>
  (id ? TOOL[id] : undefined) ?? catEmoji(category);
