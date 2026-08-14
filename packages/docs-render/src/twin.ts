// Markdown-twin transforms. The build emits a verbatim markdown twin at
// /info/<slug>.md alongside each English HTML page (indexed by /info/llms.txt) —
// the agent-readable face of the docs. These pure string transforms strip the
// build-only markup (front-matter, figure fences, provenance pills, technology
// logos) so an agent reading the twin gets clean prose, and derive the one-line
// page description for llms.txt. All are pure (no filesystem, no module globals),
// which is why they live in the shared package.

// No docs source carries front-matter today; strip a leading YAML block anyway so
// a build-time-only header added later never leaks into the published twin.
export function stripFrontMatter(md: string): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? md.slice(m[0].length) : md;
}

/**
 * The markdown twin has no build step to inline art into, so a `::: figure <id>`
 * fence there is a reference to something the reader cannot see, wrapped around the
 * only part of it they can — the caption. Unwrap to the caption prose, which was
 * always written to read as a sentence about the point being made.
 *
 * The id is not carried into the twin as text: it names a file the twin does not
 * publish, and an agent reading `::: figure trust-chain` would be reading build
 * plumbing, not documentation.
 */
export function unwrapFigureFences(md: string): string {
  return md.replace(/^::: figure\s+\S+[ \t]*\r?\n([\s\S]*?)^:::[ \t]*\r?\n?/gm, (_m, caption: string) => caption);
}

// The twin is markdown, so it carries no CSS to turn a provenance marker into a
// pill — an agent reading it would get `%file{the-flood.webp}` as literal noise
// around the very words that matter. Unwrap to the plain text; the sentence was
// always written to read without them.
export function unwrapProvenanceMarkers(md: string): string {
  let out = md;
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(/%(?:entity|sig|act|file|detail)\{([^{}]*)\}/g, '$1');
    if (next === out) break;
    out = next;
  }
  return out;
}

// The twin is markdown, and a technology mark is pure decoration — the word it sits
// beside already says which thing is meant. An agent reading /info/build-guide.md
// gains nothing from `<!--l:helm-->` and loses nothing without it, so the marker is
// removed outright rather than unwrapped (there is no text inside it to keep). Both
// forms go: the inline `<!--l:key-->` and the whole-line `<!--lb:key key-->` block.
// tests/docs-logos.test.ts holds the line.
export function stripLogoMarkers(md: string): string {
  return md.replace(/<!--lb:[a-z0-9 -]+-->\n?/g, '').replace(/<!--l:[a-z0-9-]+-->/g, '');
}

// A standalone provenance credential line (`%file{…} %entity{…} …`) is page
// furniture: on the page it renders as a row of pills. In the agent-readable
// twin we keep the credit but move it into an HTML comment, markers unwrapped —
// so an agent still sees the provenance, the twin ships no raw `%kind{` noise
// (tests/docs-provenance-pills.test.ts), AND the narration excludes it: a
// comment-only line extracts to empty spoken text, exactly as the SOURCE
// pipeline (scripts/lib/docs-spoken-text.ts) skips the same `%file{…}` line — so
// the audio and the player's twin-derived follow-along block map exclude the
// identical set and the highlight never drifts off a spoken block. Comment
// FIRST (the detection keys on the raw markers), then a whole-doc unwrap mops up
// any inline markers on ordinary prose lines.
export function commentStandaloneProvenanceLines(md: string): string {
  return md
    .split('\n')
    .map((l) => /^\s*%(?:file|entity|act|detail|sig)\{/.test(l)
      ? `<!-- ${unwrapProvenanceMarkers(l).trim()} -->`
      : l)
    .join('\n');
}

// One-sentence description for a page's llms.txt line, derived from the first
// body sentence of its English markdown so the listing can never drift from the
// docs themselves. Skips headings, blockquotes, lists/tables, raw HTML (the
// README hero <img>), and emphasis-only metadata lines (privacy's "*Last
// updated*"), then flattens inline markdown to plain text.
//
// HTML COMMENTS ARE REMOVED WHOLE, before the split into blocks, and that order is
// the fix rather than a tidy-up. The per-block skip below can only test whether a
// block STARTS with "<", so it catches a one-paragraph comment and misses a comment
// containing a blank line: the second paragraph reads as ordinary prose and becomes
// the page's public description. That is not hypothetical - favourites.md opens with
// a multi-paragraph authoring note, and this page's <meta name="description"> and OG
// card were shipping its second paragraph ("Two separate storage facts are
// load-bearing here…") as the page summary. Our docs pages carry these notes by
// convention (the SHOT NOTE blocks are everywhere), so the extractor has to treat a
// comment as invisible the way a markdown renderer does, not as a block shaped a
// particular way.
export function mdDescription(md: string): string {
  const blocks = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\n\s*\n/);
  for (const block of blocks) {
    const line = block.trim().split('\n').map(l => l.trim()).join(' ');
    if (!line || /^#{1,6} /.test(line) || line.startsWith('>') || line.startsWith('<')) continue;
    if (/^-{3,}$/.test(line) || /^\s*[-*] /.test(line) || line.startsWith('|')) continue;
    if (/^\*[^*]+\*$/.test(line) || /^!\[[^\]]*\]\([^)]+\)$/.test(line)) continue;
    const plain = line
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    const sentence = plain.match(/^.*?[.!?](?=\s|$)/);
    return (sentence ? sentence[0] : plain).trim();
  }
  return '';
}
