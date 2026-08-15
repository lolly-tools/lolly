// @lolly-tools/docs-render — the shared, DOM-free docs render layer.
//
// Consumed by BOTH docs/build.ts (the static site generator) and the in-app live
// docs view (shells/web) so the two rendering paths can never drift. Everything
// here is string-in / string-out with no filesystem, DOM, or module-global state;
// build-time vs runtime differences are injected via DocsRenderContext (added in
// M0b). See plans: docs-in-app "one shared renderer, two consumers".

export { esc } from './esc.ts';
export {
  stripFrontMatter,
  unwrapFigureFences,
  unwrapProvenanceMarkers,
  stripLogoMarkers,
  commentStandaloneProvenanceLines,
  mdDescription,
} from './twin.ts';
export type {
  DocsRenderContext,
  CredentialFacts,
  CredentialAnatomy,
  CredentialRecipe,
  ShotResolution,
  ArtResolution,
  ShowcaseResolution,
} from './context.ts';
export {
  PROV_SEAL,
  parseCells,
  headingId,
  CONTENT_TOKEN,
  stripAuthoringComments,
  localeNum,
  approxCount,
} from './markdown.ts';
export { renderCredential, type CredentialRenderOpts } from './credential.ts';
export { inline, mdToHtml } from './render.ts';
export { parseFigureFence, figureBlock } from './art.ts';
