// SPDX-License-Identifier: MPL-2.0
/**
 * A prepared file and the state of getting it to the user (plans/236).
 *
 * Rendering and delivering are two different jobs, and a browser only reports on
 * one of them. `host.export.download` resolves once an anchor has been CLICKED;
 * nothing tells the page whether a file reached disk, and in at least one normal
 * Chrome profile it silently did not (shells/web/design/component-download-
 * diagnostics-2026-09-06.md). So the bytes a render produced must outlive that
 * click: a user who saw "ready" and got no file has to be able to ask for the same
 * file again without paying for a second render, a second provenance stamp or a
 * second ZIP encryption.
 *
 * This is the one shell-owned model every result surface holds. It owns the exact
 * final Blob and filename, and one explicit state:
 *
 *   ready      the bytes exist; nothing has been asked of the browser yet, OR a
 *              save was cancelled (a cancelled save leaves the file ready - it is
 *              never "saved" and never quietly starts another download)
 *   saving     a delivery is in flight; a second click is a no-op until it settles
 *   requested  an anchor download was clicked. That is all an anchor can prove.
 *   saved      a picker or native write CLOSED. The only state that may say Saved.
 *   failed     the delivery threw. The bytes are still here; retry is still valid.
 *
 * Generation errors never reach this object: a result only exists once bytes do,
 * so a failed save cannot discard a successful render. `retry()` re-delivers the
 * same bytes the ordinary way (anchor on web, native on the shells); `save()` goes
 * through the browser picker and must be called from the user's own click, because
 * the picker spends that click's activation and there is no await before it.
 *
 * `dispose()` releases the file. Every callback that outlives it is ignored, so a
 * late resolution after the owner unmounted, or after a newer export replaced this
 * one, cannot repaint a surface that no longer means this file.
 */
import type { DeliveryOutcome } from '../bridge/export-save-picker.ts';
import type { Deliver } from './deliver-file.ts';

export type { DeliveryOutcome, Deliver };

export type DeliveryState = 'ready' | 'saving' | 'requested' | 'saved' | 'failed';

export interface PreparedFile {
  /** The exact bytes that were (or will be) handed to the browser. Never rebuilt. */
  readonly blob: Blob;
  readonly filename: string;
  /** What this file IS, in the user's words ("Export from 12:04"). Shown beside the
   *  retry so a retry cannot pass for a newer export of edits made since. */
  readonly label: string;
}

export type DeliveryListener = (result: DeliveryResult) => void;

export class DeliveryResult {
  #file: PreparedFile | null;
  #state: DeliveryState = 'ready';
  #error: string | null = null;
  #lastOutcome: DeliveryOutcome | null = null;
  #busy = false;
  #disposed = false;
  readonly #listeners = new Set<DeliveryListener>();
  readonly #deliver: Deliver;
  readonly #picker: Deliver | null;

  /**
   * `deliver` is the ordinary path (anchor on web, native on the shells). `picker`
   * is a path that lets the user CHOOSE where the file lands and can confirm the
   * write closed - the browser picker, or the desktop shell's native dialog
   * (lib/deliver-file.ts chooseLocationDeliver). Null where neither exists, and
   * then `canSave` is false and no surface offers a dialog it cannot open.
   */
  constructor(file: PreparedFile, deliver: Deliver, picker: Deliver | null = null) {
    this.#file = file;
    this.#deliver = deliver;
    this.#picker = picker;
  }

  get file(): PreparedFile | null { return this.#file; }
  /** Whether a location-choosing save path exists for this result. */
  get canSave(): boolean { return this.#picker !== null; }
  get state(): DeliveryState { return this.#state; }
  /** The delivery error, when state is 'failed'. Never a generation error. */
  get error(): string | null { return this.#error; }
  /** The most recent settled outcome - lets a surface say "Save cancelled" while the
   *  state, correctly, went back to 'ready'. */
  get lastOutcome(): DeliveryOutcome | null { return this.#lastOutcome; }
  get busy(): boolean { return this.#busy; }
  get disposed(): boolean { return this.#disposed; }

  subscribe(listener: DeliveryListener): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  /** Deliver the same bytes again the ordinary way. Never regenerates anything. */
  retry(): Promise<DeliveryOutcome | null> { return this.#run(this.#deliver); }

  /** Save through the location-choosing path. Call directly from the user's click:
   *  a browser picker opens synchronously, before anything could spend that
   *  activation. Resolves null where no such path exists (`canSave` is false). */
  save(): Promise<DeliveryOutcome | null> {
    return this.#picker ? this.#run(this.#picker) : Promise.resolve(null);
  }

  /** Record a delivery that already happened outside this object - the first
   *  hand-over an export makes itself, before its result exists - so the surface
   *  starts in the honest state rather than pretending nothing was asked yet. */
  recordOutcome(outcome: DeliveryOutcome): void {
    if (this.#disposed) return;
    this.#lastOutcome = outcome;
    this.#set(outcome === 'cancelled' ? 'ready' : outcome, null);
  }

  /** Record a delivery that threw outside this object. A DELIVERY error, never a
   *  generation one: the bytes exist and stay retained, so retry remains valid. */
  recordFailure(error: string): void {
    if (this.#disposed) return;
    this.#lastOutcome = null;
    this.#set('failed', error);
  }

  /** Release the retained file. Late callbacks from an in-flight delivery are dropped. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#file = null;
    this.#listeners.clear();
  }

  // Deliberately no `await` before `fn` is invoked: a picker must open inside the
  // click that asked for it. Overlapping calls are refused while one is settling
  // (double-click cannot start two writes); a settled call after dispose changes
  // nothing, so a surface that has moved on is never repainted for the old file.
  async #run(fn: Deliver): Promise<DeliveryOutcome | null> {
    const file = this.#file;
    if (this.#disposed || this.#busy || !file) return null;
    this.#busy = true;
    this.#set('saving', null);
    let outcome: DeliveryOutcome | null = null;
    try {
      outcome = await fn(file.blob, file.filename);
      if (this.#disposed) return null;
      this.#lastOutcome = outcome;
      // A cancelled save is not a failure and not a save: the file is simply still ready.
      this.#set(outcome === 'cancelled' ? 'ready' : outcome, null);
    } catch (err) {
      if (this.#disposed) return null;
      this.#lastOutcome = null;
      this.#set('failed', err instanceof Error ? err.message : String(err));
    } finally {
      this.#busy = false;
      if (!this.#disposed) this.#emit();
    }
    return outcome;
  }

  #set(state: DeliveryState, error: string | null): void {
    this.#state = state;
    this.#error = error;
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener(this);
  }
}
