// SPDX-License-Identifier: MPL-2.0
/**
 * Draw a few glyphs of an emoji SET, for chrome that shows the set rather than a
 * document (plans/252, plan 253 section 7).
 *
 * TWO SOURCES, AND THE FIRST IS THE POINT. A pack bundle is 15 to 20 MB, which is
 * far too much to spend on a tile showing five glyphs, so the five are prepared at
 * build time by scripts/emoji-pack-specimens.ts and travel in the catalog entry
 * (`meta.emoji.specimen`). An entry that carries one draws with NO host call and no
 * download at all; the bundle then loads only when a document actually uses the set.
 * An entry with no specimen falls back to the old path - read the exact manifest
 * bytes through `host.emoji`, admit them with the engine's own reader, run the
 * engine's DOM pass over a detached element - so a pack registered before the bake,
 * or one a shell holds and the index does not describe, still draws.
 *
 * Either way there is no second renderer: baked markup came out of the same static
 * SVG subset the live pass uses, `shared.ts` only trusts it while
 * `meta.emoji.specimenOf` still matches the pack's checksum, and a set this device
 * cannot draw shows nothing rather than the machine's own emoji font.
 *
 * Two rules this module exists to keep.
 *
 * A tracked pass IS the render (see CLAUDE.md, Emoji), so every pass here is
 * untracked and takes an id scope of its own - placement ids are named after a
 * node's place in the tree it was handed, and two roots walked into one document
 * would otherwise mint the same id and paint each other's gradients. A baked
 * specimen carries the same per-pack prefix, minted by the script.
 *
 * The characters are never written into the live page. A tile paints before any
 * artwork is ready, so a specimen row that held the raw characters in the meantime
 * would be painted by the machine's own emoji font - exactly what choosing a set is
 * for. The fallback path's scratch element is detached; only finished artwork
 * reaches the document.
 */
import type { EmojiAPI } from '@lolly-tools/core/host-v1';
import type { EmojiPackPinV1, EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import type { EmojiDomNode } from '../../../../engine/src/emoji-dom.ts';
import type { EmojiArtworkCache, EmojiTextIO } from '../../../../engine/src/emoji-inline.ts';

/** The class the engine's own placements carry (`EMOJI_SPAN_CLASS` in
 *  engine/src/emoji-dom.ts), written out rather than imported: importing it would
 *  pull the emoji modules and their pinned Unicode table into the catalog chunk,
 *  which is the whole weight a baked specimen exists to avoid. The test pins the
 *  two together. */
const EMOJI_SPAN_CLASS = 'lolly-emoji';

/** One glyph's box on a specimen row. Square, because a row of five sits in a flex
 *  line at the row's own font size: the engine's per-glyph ink box and baseline
 *  offset describe a glyph inside a TEXT run, and there is no text run here. The
 *  artwork keeps its own aspect inside the box (an SVG viewBox letterboxes). */
const SPECIMEN_GLYPH_STYLE = 'display:inline-block;position:relative;width:1em;height:1em';

/** What the engine puts on placed artwork, so a baked glyph paints the same way. */
const SPECIMEN_ARTWORK_STYLE = 'display:block;width:100%;height:100%';

/** The five characters a specimen shows. Escapes, so this file carries no literal emoji. */
export const EMOJI_SPECIMEN_TEXT = '\u{1F600}\u{1F60D}\u{1F914}\u{1F60E}\u2764\uFE0F';

/** The id scope catalog chrome draws under - never `e`, which belongs to a canvas. */
export const EMOJI_SPECIMEN_SCOPE_PREFIX = 'cat';

/**
 * One scope per PACK, not one for the catalog.
 *
 * Placement ids are named after a node's place in the tree the pass was handed, so
 * every specimen starts at the beginning and two sets drawn under one scope would
 * mint the same ids - one set's gradient or clip path would then paint the other's
 * glyph, silently. Keying the scope to the pack's own checksum makes that
 * impossible. Two copies of the SAME set (a grid tile and the open sheet) do share
 * ids, and that is harmless: the elements they name are byte-identical artwork from
 * one pack.
 */
export const emojiSpecimenScope = (pin: EmojiPackPinV1): string =>
  `${EMOJI_SPECIMEN_SCOPE_PREFIX}_${pin.checksum.replace(/^sha256:/, '').slice(0, 8)}`;

/** The host slice this module needs. Narrow, so a test can stand in for it. */
export interface EmojiSpecimenHost {
  emoji?: EmojiAPI;
}

/**
 * The pass, in the one call a specimen makes. `track` is part of the call because
 * every caller of an emoji pass must state it; the engine's own pass has no
 * tracking to turn off (there is no runtime here to track for), so the default
 * implementation reads the scope and ignores the flag.
 */
export interface EmojiSpecimenPass {
  apply(node: unknown, opts: { track: false; idScope: string }): Promise<unknown>;
}

/** Finished artwork per pack, so a re-render repaints without touching the network.
 *  Nodes rather than markup: a caller clones them in, which is both cheaper than a
 *  re-parse and one less place that writes raw HTML into the page. */
const artworkByPin = new Map<string, Promise<Node[]>>();

const pinKey = (pin: EmojiPackPinV1): string => JSON.stringify([pin.id, pin.pin?.version, pin.checksum]);

/** The plain artwork of one set, with no brand treatment: a tile shows the set itself. */
const styleFor = (pin: EmojiPackPinV1): EmojiStyleV1 => ({
  schemaVersion: 1,
  primary: pin,
  fallbacks: [],
  metricsPolicy: 'inline-em-v1',
  treatment: { mode: 'original', strengthBps: 0 },
});

/**
 * The engine's own pass over one pinned pack, or null when this device does not
 * hold that exact release. Refusing is the point of pinning: a host with a newer
 * or older build of the same set answers nothing rather than a substitute.
 *
 * The FALLBACK path, for an entry that carries no baked specimen. The engine's
 * emoji modules are imported here rather than at the top of the file, so a catalog
 * that drew from baked specimens never loads them at all.
 */
export async function emojiPackPass(host: EmojiSpecimenHost, pin: EmojiPackPinV1): Promise<EmojiSpecimenPass | null> {
  const api = host.emoji;
  if (!api) return null;
  const bytes = await api.manifest(pin).catch(() => null);
  if (!bytes) return null;
  const [{ applyEmojiToDom }, { readEmojiPack }] = await Promise.all([
    import('../../../../engine/src/emoji-dom.ts'),
    import('../../../../engine/src/emoji-pack.ts'),
  ]);
  const read = await readEmojiPack(bytes, pin);
  if (!read.ok) return null;
  const pack = read.pack;
  const style = styleFor(pin);
  const cache: EmojiArtworkCache = new Map();
  const io: EmojiTextIO = {
    async loadArtwork(wanted, asset) {
      const artwork = await api.artwork(wanted, asset);
      if (!artwork) throw new Error(`emoji artwork missing: ${asset.id}`);
      return artwork;
    },
    // The contract types the parser's result as unknown so the SDK carries no DOM
    // types; narrowing it is the engine's job and the runtime does the same cast.
    parseXml: api.parseXml as EmojiTextIO['parseXml'],
  };
  return {
    apply: (node, opts) => applyEmojiToDom(node as EmojiDomNode, style, [pack], io, { cache, idScope: opts.idScope }),
  };
}

/**
 * One baked glyph as a node, or null when the markup is not artwork this may draw.
 *
 * Parsed as SVG, never as HTML: an XML parse runs nothing, and the root has to be
 * an `<svg>` the parser accepted whole. The markup is catalog content - authored in
 * this repository, produced by the engine's static SVG subset and checked against
 * the pack's checksum by scripts/check-emoji-packs.ts - which is the same standing
 * this shell gives every other catalog file it inlines.
 */
export function specimenGlyphNode(markup: string): Node | null {
  if (typeof markup !== 'string' || !markup.startsWith('<svg')) return null;
  let root: Element | null = null;
  try {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    if (parsed.getElementsByTagName('parsererror').length) return null;
    root = parsed.documentElement;
  } catch { return null; }
  if (root?.nodeName.toLowerCase() !== 'svg') return null;
  const artwork = document.importNode(root, true) as Element;
  artwork.setAttribute('aria-hidden', 'true');
  artwork.setAttribute('focusable', 'false');
  artwork.setAttribute('style', SPECIMEN_ARTWORK_STYLE);
  const span = document.createElement('span');
  span.className = EMOJI_SPAN_CLASS;
  // The ROW carries role="img" and the label saying which set draws these five, so
  // each glyph inside it is decoration. The live pass labels each span instead; a
  // role="img" element is a leaf to assistive tech either way.
  span.setAttribute('aria-hidden', 'true');
  span.setAttribute('style', SPECIMEN_GLYPH_STYLE);
  span.appendChild(artwork);
  return span;
}

/** Every baked glyph of one entry, in the order the script wrote them. Empty when
 *  the entry carries none, or when nothing in it parsed. */
export function bakedSpecimenNodes(specimen: Readonly<Record<string, string>> | null | undefined): Node[] {
  if (!specimen) return [];
  const out: Node[] = [];
  for (const markup of Object.values(specimen)) {
    const node = specimenGlyphNode(markup);
    if (node) out.push(node);
  }
  return out;
}

/**
 * Run one pass over a detached element and hand back the nodes it drew. An empty
 * list means the pass drew nothing, so a caller can tell "no artwork" from "some".
 */
export async function drawEmojiSpecimen(
  pass: EmojiSpecimenPass,
  idScope: string,
  text = EMOJI_SPECIMEN_TEXT,
): Promise<Node[]> {
  const scratch = document.createElement('span');
  scratch.textContent = text;
  await pass.apply(scratch, { track: false, idScope });
  const drawn = [...scratch.childNodes];
  // One text node back means the pass left the characters exactly as they were,
  // which is not artwork: hand back nothing rather than the raw characters.
  return drawn.length === 1 && drawn[0]!.nodeType === 3 ? [] : drawn;
}

export interface EmojiSpecimenOpts {
  text?: string;
  idScope?: string;
  /** Stand in for the engine-backed pass. Only a test passes this. */
  pass?: EmojiSpecimenPass | null;
}

/** One set to draw: the exact release, and the glyphs its catalog entry already
 *  carries. `shared.ts` builds this and hands over a specimen only while the entry's
 *  `specimenOf` still matches the pack's checksum. */
export interface EmojiSpecimenSource {
  pin: EmojiPackPinV1;
  specimen?: Readonly<Record<string, string>> | null;
}

/**
 * The specimen artwork for one set, prepared once per pack and kept for the life of
 * the page. A set whose entry carries baked glyphs needs no host and no download; a
 * set this device cannot draw either way gives an empty list, which every caller
 * treats as "leave the plain stub alone".
 */
export function emojiSpecimenArtwork(
  host: EmojiSpecimenHost,
  source: EmojiSpecimenSource,
  opts: EmojiSpecimenOpts = {},
): Promise<Node[]> {
  const { pin } = source;
  const key = pinKey(pin);
  let hit = artworkByPin.get(key);
  if (!hit) {
    hit = (async () => {
      // The baked glyphs first, and no host call at all when they draw: the point of
      // the bake is that a tile never pulls a 15 to 20 MB bundle for five glyphs.
      const baked = bakedSpecimenNodes(source.specimen);
      if (baked.length) return baked;
      const pass = opts.pass ?? await emojiPackPass(host, pin);
      if (!pass) return [];
      return await drawEmojiSpecimen(pass, opts.idScope ?? emojiSpecimenScope(pin), opts.text);
    })().catch(() => []);
    artworkByPin.set(key, hit);
  }
  return hit;
}

/** Drop the prepared artwork. For tests; nothing in the app re-reads a pinned pack. */
export function clearEmojiSpecimenCache(): void {
  artworkByPin.clear();
}

/** Where a mounted specimen is written, inside the element carrying `data-emoji-thumb`. */
export const EMOJI_SPECIMEN_SLOT = 'data-emoji-specimen';

/** Put one prepared set's artwork into a stub. Clones, so the same prepared nodes
 *  serve every tile and the open sheet at once. */
export function paintEmojiSpecimen(el: HTMLElement, artwork: readonly Node[]): void {
  const slot = el.querySelector<HTMLElement>(`[${EMOJI_SPECIMEN_SLOT}]`);
  if (!slot || !artwork.length) return;
  slot.replaceChildren(...artwork.map(node => node.cloneNode(true)));
  el.classList.add('is-drawn');
}

/**
 * Fill every `[data-emoji-thumb]` stub under `rootEl` with its set's own artwork,
 * on-screen gated.
 *
 * The lifecycle and the shape are lib/pdf-thumbs.ts's, for the same reasons: a
 * re-render replaces the elements the previous observer was holding, so the caller
 * destroys and re-mounts. The on-screen gate stays even though a baked specimen
 * needs no download: nothing is drawn for a tile nobody has scrolled to. An entry
 * with no bake keeps its stub. A tile never loads a whole set: the picker and the
 * Emoji section do that when a person chooses to use one.
 */
export function mountEmojiSpecimens(
  rootEl: HTMLElement,
  host: EmojiSpecimenHost,
  sourceFor: (id: string) => EmojiSpecimenSource | null,
  isCurrent: () => boolean,
): { destroy(): void } {
  let chain: Promise<void> = Promise.resolve();
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      io.unobserve(el);
      const source = sourceFor(el.dataset.emojiThumb ?? '');
      if (!source) continue;
      chain = chain.then(async () => {
        if (!isCurrent() || !el.isConnected) return;
        // A tile draws only what its entry already carries. A set with no baked glyphs,
        // such as a copy held on the device for offline use, keeps its plain stub:
        // reading and checking a whole set (8 to 38 MB each) for five glyphs froze the
        // page, once for every such tile in view.
        if (!bakedSpecimenNodes(source.specimen).length) return;
        const artwork = await emojiSpecimenArtwork(host, source);
        if (!isCurrent() || !el.isConnected) return;
        paintEmojiSpecimen(el, artwork);
      });
    }
  }, { rootMargin: '200px' });
  for (const el of rootEl.querySelectorAll<HTMLElement>('[data-emoji-thumb]')) {
    const source = sourceFor(el.dataset.emojiThumb ?? '');
    const ready = source ? artworkByPin.get(pinKey(source.pin)) : undefined;
    // Already prepared this session - paint it now rather than waiting for a scroll.
    if (ready) void ready.then(artwork => { if (el.isConnected && isCurrent()) paintEmojiSpecimen(el, artwork); });
    else io.observe(el);
  }
  return { destroy: () => io.disconnect() };
}
