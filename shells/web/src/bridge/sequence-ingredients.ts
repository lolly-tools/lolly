// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-ingredients.ts - the export-side gather that keeps a timeline clip's
 * Content Credentials attached to the film it ends up inside (plans/130).
 *
 * WHAT IT IS FOR. `renderFormat` stamps ONE container-level credential onto a
 * finished sequence, and that credential is only honest if it names what the film
 * was made of. A camera-shot clip, an AI-generated clip and a licensed catalog
 * track each arrive carrying their own signed manifest; unless those manifests are
 * copied forward as ingredients, an export launders every one of them away and the
 * result reads as if it were authored from nothing.
 *
 * WHY IT IS A MODULE AND NOT FOUR LINES IN THE RENDERER. `renderSequenceAuthored`
 * cannot be reached headlessly - its frame loop is canvas, WebCodecs and
 * dom-to-image, and it is covered by the Playwright tier. Everything decided here
 * is policy (which source of truth wins, what a failure costs, when a scan is too
 * expensive to be worth attempting), and policy that cannot be run in a test is
 * policy that rots. So the two IO seams arrive as injected functions and this file
 * owns no globals: sequence-render.ts supplies the real ones, a node test supplies
 * fakes.
 *
 * THE RESOLUTION ORDER IS NOT AN OPTIMISATION. `credentialForUrl` is asked first
 * because for the sources most likely to BE credentialed it is the only answer that
 * exists at all: an upload's stored pixels were re-encoded at ingest, so its C2PA
 * store no longer sits in the bytes the timeline plays - it was kept beside the
 * record and is reachable only by asset id. Scanning that clip's URL finds nothing,
 * every time. The byte scan is the fallback for the sources with no id to find: a
 * catalog clip served over http, or a file dropped straight onto the timeline.
 *
 * EVERY CLIP IS A COMPONENT, NEVER A PARENT. The embedder defaults an ingredient
 * with no relationship to `parentOf`, and that is the wrong word twice over here: a
 * film is not derived FROM one clip, it is composed WITH all of them (the same case
 * the SVG/PDF walker stamps `componentOf` on for a bitmap it inlines), and C2PA
 * allows at most one `parentOf` ingredient per claim - so a two-clip timeline
 * written the default way reports multipleParents and the whole credential reads as
 * invalid, which is worse than carrying no ingredients at all.
 *
 * BEST-EFFORT, ALWAYS. Carrying no credential is the ordinary case, and an
 * unreadable one is not the user's problem at the moment they asked for a film.
 * Every failure path - a fetch that 404s, bytes that sniff as nothing, a store that
 * will not parse, a dependency that throws - resolves to "no ingredient" and the
 * export carries on. Nothing in this file throws.
 *
 * Run its tests with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/sequence-ingredients.test.ts
 */
import { extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
import type { IngredientCredential } from '@lolly-tools/core/host-v1';
import { MAX_CREDENTIAL_SCAN_BYTES } from './assets.ts';

/**
 * One media source a sequence draws on - a timeline clip, or the export bar's
 * music bed. `kind` records which, so a caller can build the list the way the
 * timeline reads it (and so a bed, which is not a layer at all, is not silently
 * indistinguishable from one in a log).
 */
export interface SequenceIngredientSource {
  kind: 'video' | 'audio';
  url: string;
}

/** The IO this gather refuses to own, so it can be run in Node. */
export interface SequenceIngredientDeps {
  /**
   * The preserved store for a URL, found by asset id. The FIRST question asked,
   * and for a user upload the only one with an answer - see the module header.
   */
  credentialForUrl?: (url: string) => Promise<{ store: Uint8Array; format: string } | null>;
  /**
   * The source's bytes, for the scan fallback. `null` for "not worth reading".
   *
   * `answered` reports whether `credentialForUrl` came back with a store for this
   * URL, and it is there so a caller can only skip the read when the id route
   * genuinely had something to say. "The bridge can name this URL" is not the same
   * claim: a stored record with no credential on it answers null, and for those
   * sources the manifest is in the bytes.
   */
  fetchBytes?: (url: string, answered: boolean) => Promise<Uint8Array | null>;
  /** Refuse to scan anything bigger. Defaults to the asset bridge's own cap. */
  maxScanBytes?: number;
}

/**
 * Resolve every source's credential and push what it finds into `sink`.
 *
 * `sink` is `ExportOpts._ingredientSink`, which `renderFormat` folds into
 * `opts.ingredients` after the render returns - dropping anything whose
 * `activeLabel` the runtime already supplied, so a design box gathered twice (once
 * from its declared asset input, once from the DOM) is listed once. Sources are
 * deduped by URL here, and against the sink's existing labels, because the same
 * clip placed twice on a timeline is one ingredient, not two.
 *
 * Sequential rather than parallel on purpose: the scan fallback fetches whole
 * media files, and a timeline can hold several of them. Firing every fetch at once
 * would spike memory in exactly the case the byte cap exists to protect.
 */
export async function gatherSequenceIngredients(
  sources: SequenceIngredientSource[],
  sink: IngredientCredential[],
  deps: SequenceIngredientDeps = {},
): Promise<void> {
  if (!Array.isArray(sources) || sources.length === 0 || !Array.isArray(sink)) return;
  const cap = deps.maxScanBytes ?? MAX_CREDENTIAL_SCAN_BYTES;
  const seenUrls = new Set<string>();
  const seenLabels = new Set(sink.map((i) => i?.activeLabel).filter(Boolean));
  for (const src of sources) {
    const url = src?.url;
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    const ing = await ingredientForUrl(url, cap, deps);
    if (!ing || seenLabels.has(ing.activeLabel)) continue;
    seenLabels.add(ing.activeLabel);
    // The relationship is set HERE, on the way into the sink, so no route out of
    // ingredientForUrl can forget it - see the module header for why a clip is a
    // component and never a parent.
    sink.push({ ...ing, relationship: 'componentOf' });
  }
}

/** One source, both routes, every failure swallowed. */
async function ingredientForUrl(
  url: string, cap: number, deps: SequenceIngredientDeps,
): Promise<IngredientCredential | null> {
  // A procedural bed (`zzfxm:<seed>` - engine/src/zzfxm-ref.ts's scheme; a string
  // test to keep this module import-free) is composed, not stored: there are no
  // bytes to scan and no credential to find, and fetching the scheme only produces
  // the browser's own "cannot load" console error before the catches below.
  if (url.startsWith('zzfxm:')) return null;
  // Whether the id route ANSWERED - not whether its answer parsed. Passed to the
  // scan below because a null answer is not an answer: a stored record that never
  // had a credential written onto it (a video job's own output, a voice upload the
  // picker's scan skips) resolves to an id and to nothing, and those bytes are
  // exactly where the manifest still is.
  let answered = false;
  try {
    const cred = await deps.credentialForUrl?.(url);
    if (cred?.store) {
      answered = true;
      const ing = prepareC2paIngredientFromStore(cred.store, cred.format);
      // A store that will not parse falls through to the scan rather than
      // returning here: the two routes read different bytes, so one of them
      // failing says nothing about the other. The scan is told the id route
      // answered, so a caller that knows both reads land on the same bytes may
      // still decline; what no caller may decline is a NULL answer.
      if (ing) return ing;
    }
  } catch { /* an unreadable credential must never fail an export */ }
  try {
    const bytes = await deps.fetchBytes?.(url, answered);
    // The cap is checked again even though the real `fetchBytes` already applies
    // it: the dependency is injectable, and a gather that trusted its caller to
    // stay under budget would be a cap in name only.
    if (!bytes || bytes.length === 0 || bytes.length > cap) return null;
    const ex = extractC2paStore(bytes);
    return ex ? prepareC2paIngredientFromStore(ex.store, ex.format) : null;
  } catch {
    return null;
  }
}
