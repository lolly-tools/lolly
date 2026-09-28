// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's Emoji section (plans/252): seed a set, show the control, keep
 * the runtime, the address bar and the canvas in step.
 *
 * A separate module from setup.ts for one reason worth stating: setup.ts cannot be
 * loaded outside a bundler, so nothing in it can be tested. Everything here is
 * reachable from a test with a fake runtime and a fake host, which is why the
 * seeding order, the visibility rule and the write-back all live here rather than
 * in the mount.
 *
 * The section is CHROME, not an input. It sits outside `#tool-inputs` because
 * renderInputs wipes that container on every model change, and it is offered by
 * the runtime rather than by a tool manifest: every tool gets the service, so
 * every tool gets the control.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiSetInfoV1, EmojiStyleV1 } from '@lolly-tools/core/emoji-v1';
import { emojiParams } from '../../../../../engine/src/emoji-style.ts';
import { isDefaultEmojiStyle } from '../../../../../engine/src/emoji-default.ts';
import type { EmojiPaletteEntry } from '../../../../../engine/src/emoji-style.ts';
import type { EmojiParamPair } from '../../lib/emoji-prefs.ts';
import { mountEmojiStyle } from '../../lib/emoji-runtime-style.ts';
export { emojiStyleFrom } from '../../lib/emoji-runtime-style.ts';
import { notifyEmojiDocument, setEmojiDocumentPort } from './emoji-doc.ts';

/** What the section reads off each pass. The counts are what make the section
 *  honest: `present` is a host capability, not a fact about this render. */
export interface EmojiSectionState {
  present: boolean;
  replaced: number;
  unresolved: number;
  style: EmojiStyleV1 | null;
}

/** The slice of the runtime this section drives. Structural, so a test needs no mount. */
export interface EmojiSectionRuntime {
  emojiCredits?(): string;
  readonly emoji: EmojiSectionState;
  onEmojiChange(fn: (state: EmojiSectionState) => void): () => void;
  setEmojiStyle(style: EmojiStyleV1 | null): Promise<void>;
  applyEmojiToDom(node: unknown, opts?: { track?: boolean; idScope?: string }): Promise<unknown>;
}

export interface EmojiSectionOpts {
  /** The mounted view, holding `#emoji-section` and `#emoji-section-body`. */
  root: ParentNode;
  host: HostV1;
  runtime: EmojiSectionRuntime;
  /** The set named by the link, when it named one. */
  url?: EmojiParamPair | null;
  /** The set the saved session was made with, when it was saved with one. */
  session?: EmojiParamPair | null;
  /** The live canvas, so a change redraws what is on screen. */
  canvas?: () => Element | null;
  /**
   * Called whenever the chosen style changes, INCLUDING the first seed, so the
   * view can write the two reserved params, stamp the session and mark the params
   * dirty. The view owns the address bar; this module never touches it. `params`
   * is the same style spelled as the reserved pair, so every writer carries the
   * exact bytes a link, a session stamp and the CLI all parse.
   */
  onStyle(style: EmojiStyleV1 | null, params: EmojiParamPair | null): void;
}

export interface EmojiSection {
  /** The style in force, or null while no set is chosen. */
  readonly style: EmojiStyleV1 | null;
  destroy(): void;
}

/**
 * Show the section only when the host can load sets, HAS at least one, and this
 * render is actually about emoji - a set was chosen, or the text on the canvas
 * carries emoji. `present` alone is a host capability, not a fact about the
 * render, so gating on it put a permanent Emoji section on the QR code tool.
 *
 * A shell with no packs offers nothing rather than an empty promise: there is no
 * set on this device to choose.
 */
export function showEmojiSection(state: EmojiSectionState, setCount: number): boolean {
  if (!state.present || setCount < 1) return false;
  return state.replaced + state.unresolved > 0 || Boolean(state.style && !isDefaultEmojiStyle(state.style));
}

export async function mountEmojiSection(opts: EmojiSectionOpts): Promise<EmojiSection> {
  const { host, root, runtime } = opts;
  const section = root.querySelector<HTMLDetailsElement>('#emoji-section');
  const body = root.querySelector<HTMLElement>('#emoji-section-body');
  let style: EmojiStyleV1 | null = null;
  let destroyed = false;
  const initialStyle = JSON.stringify(runtime.emoji.style);

  const sets = host.emoji ? await host.emoji.sets().catch(() => [] as EmojiSetInfoV1[]) : [];
  const swatches = host.tokens ? await host.tokens.colors().catch(() => []) : [];
  const palette: EmojiPaletteEntry[] = swatches.map(swatch => ({ id: swatch.ref, hex: swatch.value }));

  // Link, saved session, brand, personal preference, then the runtime default.
  // An explicit document choice always wins over a seed for new work. The tool view
  // resolved the same way before creating the runtime (mountEmojiStyle), so applying
  // it below normally finds the style already in force and costs nothing.
  const seeded = await mountEmojiStyle(host, { url: opts.url ?? null, session: opts.session ?? null });
  const announce = (next: EmojiStyleV1 | null): void => opts.onStyle(next, next ? emojiParams(next) : { emoji: 'none', emojifx: '' });

  let control: { update(next: EmojiStyleV1 | null): void; destroy(): void } | null = null;
  // The runtime also receives choices from generic text fields and table cells.
  // Observe those here so links, sessions and the document dock stay in step.
  const sync = (next: EmojiStyleV1 | null): void => {
    if (destroyed || JSON.stringify(style) === JSON.stringify(next)) return;
    style = next;
    control?.update(next);
    announce(next);
    notifyEmojiDocument();
  };
  const commit = (next: EmojiStyleV1 | null): void => {
    void runtime.setEmojiStyle(next).then(() => sync(runtime.emoji.style)).catch(error => {
      host.log('error', String(error instanceof Error ? error.message : error));
      control?.update(style);
    });
  };

  // Registered before the sidebar check below, because the surfaces that need it
  // most are the ones with NO sidebar: the design tool and Doc Studio render no
  // aside at all, so the Document dock is the only control they have.
  setEmojiDocumentPort({ value: () => style, set: (next) => commit(next), credits: () => runtime.emojiCredits?.() ?? '' });
  const release = (): void => setEmojiDocumentPort(null);

  style = JSON.stringify(runtime.emoji.style) !== initialStyle
    ? runtime.emoji.style : seeded !== undefined ? seeded : runtime.emoji.style;
  if (style || seeded !== undefined) {
    await runtime.setEmojiStyle(style);
    announce(style);
    notifyEmojiDocument();
  }

  const offStyle = runtime.onEmojiChange((state) => sync(state.style));

  if (!section || !body) {
    return { get style() { return style; }, destroy() { destroyed = true; offStyle(); release(); } };
  }

  const { mountEmojiStyleControl, EMOJI_SPECIMEN } = await import('../../components/emoji-style-control.ts');

  /**
   * The specimen is drawn by the runtime's own DOM pass over a detached element,
   * so the five characters on screen are the same bytes an export would place.
   * It is chrome, not the render, so it is untracked and takes an id scope of its
   * own: a tracked walk would describe five characters instead of the canvas and
   * would become the tree the next set change redraws. The canvas is redrawn
   * afterwards because the change has to show.
   */
  const specimen = async (): Promise<string> => {
    const scratch = document.createElement('div');
    scratch.textContent = EMOJI_SPECIMEN;
    await runtime.applyEmojiToDom(scratch, { track: false, idScope: 'x' });
    const html = scratch.innerHTML;
    const canvas = opts.canvas?.();
    if (canvas) await runtime.applyEmojiToDom(canvas);
    return html;
  };

  control = mountEmojiStyleControl(body, {
    host,
    mode: 'document',
    credits: () => runtime.emojiCredits?.() ?? '',
    value: style,
    // The seed above already read both, so the control is handed them rather
    // than asking the catalog a second time.
    sets,
    palette,
    onChange: (next) => commit((next && 'primary' in next ? next : null) as EmojiStyleV1 | null),
    specimen,
  });

  // Opened once, the first time a render shows a placeholder with no set chosen.
  // Without it the canvas carries unexplained grey squares and the only sentence
  // that explains them is inside a collapsed section.
  let prompted = false;
  const apply = (state: EmojiSectionState): void => {
    if (destroyed || !section) return;
    section.hidden = !showEmojiSection(state, sets.length);
    if (!section.hidden && !prompted && !state.style && state.unresolved > 0) {
      prompted = true;
      section.open = true;
    }
  };
  apply(runtime.emoji);
  const off = runtime.onEmojiChange(apply);

  return {
    get style() { return style; },
    destroy() {
      destroyed = true;
      release();
      off();
      offStyle();
      control?.destroy();
    },
  };
}
