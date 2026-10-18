// SPDX-License-Identifier: MPL-2.0
/** reveal.js's own message API, as spoken by Slides.com and self-hosted decks. The deck
 * receives fixed navigation commands; its reports are read as a slide position only. */
export type RevealCommand = 'next' | 'prev' | 'up' | 'down' | 'getState';
export interface RevealDeckState { h: number; v: number; f: number | null }

/** reveal.js state reports are a few hundred bytes; anything far larger is not one. */
export const REVEAL_MESSAGE_LIMIT = 16_384;
const COMMANDS: ReadonlySet<string> = new Set(['next', 'prev', 'up', 'down', 'getState']);
const SLIDE_LIMIT = 9999;

/** reveal.js accepts only JSON text naming one of its methods. */
export function revealCommand(method: RevealCommand): string | null {
  return COMMANDS.has(method) ? JSON.stringify({ method, args: [] }) : null;
}

function pick(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, unknown> = Object.create(null);
  for (const key of keys) if (Object.hasOwn(value, key)) out[key] = (value as Record<string, unknown>)[key];
  return out;
}
function slideIndex(value: unknown, min: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(SLIDE_LIMIT, Math.max(min, value)) : null;
}

/** Read a reveal.js event or callback into a bounded position. The caller has already
 * checked that the message came from the deck's own frame and origin. */
export function readRevealMessage(data: unknown): RevealDeckState | null {
  if (typeof data !== 'string' || data.length > REVEAL_MESSAGE_LIMIT || !data.startsWith('{') || !data.endsWith('}')) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(data); } catch { return null; }
  const message = pick(parsed, ['namespace', 'eventName', 'state']);
  if (message?.namespace !== 'reveal' || typeof message.eventName !== 'string' || message.eventName.length > 64) return null;
  const state = pick(message.state, ['indexh', 'indexv', 'indexf']);
  if (!state) return null;
  const h = slideIndex(state.indexh, 0), v = state.indexv === undefined ? 0 : slideIndex(state.indexv, 0);
  if (h === null || v === null) return null;
  return { h, v, f: slideIndex(state.indexf, -1) };
}

export function sameRevealState(a: RevealDeckState | null, b: RevealDeckState | null): boolean {
  return !!a && !!b && a.h === b.h && a.v === b.v && a.f === b.f;
}

/** reveal.js numbers a vertical slide as `h.v`, counting from one. */
export function revealSlideLabel(state: RevealDeckState): string {
  return state.v > 0 ? `${state.h + 1}.${state.v + 1}` : String(state.h + 1);
}
