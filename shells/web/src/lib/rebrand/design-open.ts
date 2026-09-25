// SPDX-License-Identifier: MPL-2.0
/**
 * Opening a new Design document for a compiled deck (plan 274 section 2.1 step 5).
 *
 * `design-handoff.ts` owns the order of events (pages first, then the document, then
 * the record); this module owns the two moves it cannot make without a browser: going
 * to a fresh Design document, and laying the pages down on that document once it has
 * mounted. `designOpener(host)` answers both as the `navigate` and `importer` pair
 * `RebrandControllerDepsV1["design"]` names.
 *
 * How a fresh document gets its id. A Design session is saved under a slot, and a
 * fresh `#/tool/design` has none until its first save (`views/tool-actions/saving.ts`
 * and the automatic history both mint `design:<something>` then). The project has to
 * record the id before that save happens, so the slot is minted here and named in the
 * route: `#/tool/design?slot=<id>`. A slot with no saved record opens as a new
 * document (`views/tool-session-open.ts` falls back to the route's own values), skips
 * the template chooser (the fresh-open ladder in `views/tool/setup.ts` only runs with
 * no slot), and every later save is written under this id.
 *
 * How the pages reach the mounted document. The same one-shot pattern the drop
 * router's `takePendingDesignImport` uses: `navigate` leaves a waiter here, and the
 * canvas takes it on mount (`views/free-canvas.ts`, beside the pending design import)
 * and answers with a handle on itself: the runtime the handoff marker is held
 * against, and a function that runs `importAsArtboards` with supplied pages. Nothing
 * polls the page. A document that never mounts is given up on after
 * `REBRAND_DESIGN_OPEN_TIMEOUT_MS`, and the waiter is withdrawn so a later Design
 * mount cannot take it.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { tRaw } from '../../i18n.ts';
import type { RebrandControllerDepsV1 } from './controller-api.ts';
import type { DesignHandoffFrameV1, DesignHandoffImportOutcomeV1, DesignHandoffSessionV1 } from './design-handoff.ts';

/** The one tool that takes a compiled deck. */
export const REBRAND_DESIGN_TOOL_ID = 'design';

/** How long a Design mount may take before the open is abandoned: the tool load's own 15 s budget, twice, plus the chunk. */
export const REBRAND_DESIGN_OPEN_TIMEOUT_MS = 45_000;

/** What the mounted Design canvas hands back to the waiter. */
export interface RebrandDesignMountV1 {
  /** The tool runtime: the object `views/tool/setup.ts` reads the handoff marker off at save time. */
  owner: object;
  /** Lay the pages down as artboards on this document, keeping their ids when asked. */
  lay(
    frames: DesignHandoffFrameV1[],
    opts: { keepIds: boolean; onWarning: (message: string) => void },
  ): Promise<DesignHandoffImportOutcomeV1>;
}

/** The waiter a Design mount takes: the document name to apply, and where to send the handle. */
export interface PendingRebrandDesignV1 {
  /** The project name, which becomes the document's save and export name. */
  name: string;
  attach(mount: RebrandDesignMountV1): void;
}

interface Waiter extends PendingRebrandDesignV1 {
  toolId: string;
  reject(error: Error): void;
}

let waiting: Waiter | null = null;

/** Is a compiled deck waiting for a Design mount? A peek, not a take. */
export function hasPendingRebrandDesign(): boolean {
  return waiting !== null;
}

/**
 * The waiter, for the canvas that mounted `toolId`. Single use: taken once, cleared on
 * read. Another tool's canvas leaves it where it is, so a free-canvas tool that happens
 * to mount first never swallows a deck meant for Design.
 */
export function takePendingRebrandDesign(toolId: string | undefined): PendingRebrandDesignV1 | null {
  const current = waiting;
  if (!current || toolId !== current.toolId) return null;
  waiting = null;
  return { name: current.name, attach: current.attach };
}

/** What the opener needs from its surroundings. Tests pass their own; the shell uses the defaults. */
export interface DesignOpenerOptionsV1 {
  /** Go to a route, as a new history entry. Default: `navigateTo` from `nav.ts`. */
  go?: (hash: string) => void;
  /** Step back from the document just opened. Default: `history.back()`. */
  back?: () => void;
  /** A new, unused Design slot. Default: `design:<uuid>`. */
  mintSlot?: () => string;
  timeoutMs?: number;
}

function defaultSlot(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${REBRAND_DESIGN_TOOL_ID}:${uuid}`;
}

async function defaultGo(hash: string): Promise<void> {
  const { navigateTo } = await import('../../nav.ts');
  navigateTo(hash);
}

/** The route of a fresh Design document saved under `slot`. */
export const designRouteFor = (slot: string): string => `#/tool/${REBRAND_DESIGN_TOOL_ID}?slot=${encodeURIComponent(slot)}`;

/**
 * The `navigate` and `importer` pair for `openCompiledDeckInDesign`.
 *
 * `navigate` mints the slot, leaves the waiter, goes to the document and resolves once
 * the canvas has mounted and attached: `{ id, owner, close }`. `importer` lays the
 * pages down on that same document. `close` steps back from a document the pages
 * could not reach and forgets its slot, so no empty session is left behind.
 */
export function designOpener(
  host: Pick<HostV1, 'state'>,
  options: DesignOpenerOptionsV1 = {},
): RebrandControllerDepsV1['design'] {
  const go = options.go ?? ((hash: string) => void defaultGo(hash));
  const back = options.back ?? (() => globalThis.history?.back());
  const mintSlot = options.mintSlot ?? defaultSlot;
  const timeoutMs = options.timeoutMs ?? REBRAND_DESIGN_OPEN_TIMEOUT_MS;
  let mounted: { slot: string; mount: RebrandDesignMountV1 } | null = null;

  const navigate = async (open: { name: string; frames: number }): Promise<DesignHandoffSessionV1> => {
    const slot = mintSlot();
    mounted = null;
    const mount = await new Promise<RebrandDesignMountV1>((resolve, reject) => {
      // A newer open replaces an older one that never mounted; the older one is told.
      waiting?.reject(new Error(tRaw('A newer Design document replaced this one.')));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter: Waiter = {
        toolId: REBRAND_DESIGN_TOOL_ID,
        name: open.name,
        attach: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          if (waiting === waiter) waiting = null;
          reject(error);
        },
      };
      timer = setTimeout(() => waiter.reject(new Error(tRaw('Design did not open in time.'))), timeoutMs);
      waiting = waiter;
      go(designRouteFor(slot));
    });
    mounted = { slot, mount };
    return {
      id: slot,
      owner: mount.owner,
      close: async () => {
        if (mounted?.slot === slot) mounted = null;
        back();
        // The document may have written a recovery record while the import ran.
        await host.state.delete(slot).catch(() => undefined);
      },
    };
  };

  const importer = async (
    frames: DesignHandoffFrameV1[],
    opts: { keepIds: boolean; onWarning: (message: string) => void },
  ): Promise<DesignHandoffImportOutcomeV1> => {
    if (!mounted) throw new Error(tRaw('The Design document is not open.'));
    return mounted.mount.lay(frames, opts);
  };

  return { navigate, importer };
}
