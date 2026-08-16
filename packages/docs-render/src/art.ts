// Banked-art composition primitives, moved out of docs/docs-art.ts so the shared
// renderer (render.ts's mdToHtml/buildFigure) can compose figures without depending on
// the docs submodule. The FILESYSTEM parts (resolveDocsArt/inlineDocsArt/stripArtForInline)
// stay in docs/docs-art.ts and reach the renderer through DocsRenderContext.art(); these
// two are pure string builders. See plan this-is-a-very-sparkling-eich, M0b.

/**
 * Parse a `::: figure <id>` fence label to the figure id, or null.
 *
 * The id line is CANONICAL: it is the same token in all 27 locale copies of the page.
 * A translator never has to know what it means, and an edit to it never strands 26
 * sidecars (the shot-recipe rule). Everything inside the fence is ordinary prose.
 */
export function parseFigureFence(label: string): string | null {
  const m = /^figure\s+(\S+)$/.exec(label.trim());
  return m ? m[1]! : null;
}

/**
 * A figure: the artwork, then a caption carrying the prose AND the credential line for
 * the file that artwork came from. A figure is CONTENT, not decoration. The surrounding
 * prose carries the point, the caption names it, and the artwork declares its own
 * semantics: no `aria-hidden`, no invented label.
 */
export function figureBlock(parts: { art: string; caption: string; credential: string; src: string }): string {
  const caption = `${parts.caption}${parts.credential}`;
  return `<figure class="docs-figure" data-art="${parts.src}">`
    + `<div class="docs-figure-art">${parts.art}</div>`
    // An empty <figcaption> would promise a caption and give none. If the artifact has
    // no readable credential and the fence held no prose, render the artwork alone.
    + (caption ? `<figcaption>${caption}</figcaption>` : '')
    + `</figure>`;
}
