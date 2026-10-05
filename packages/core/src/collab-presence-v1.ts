// SPDX-License-Identifier: MPL-2.0
import type { Presence } from './canvas-op-v1.ts';
import { readCanvasPreview, type CanvasPreview } from './canvas-interaction-v1.ts';
import { decodeCanvasAsset, encodeCanvasAsset } from './canvas-asset-v1.ts';
import { readAgentPresence } from './agent-presence-v1.ts';

/** Presence is ephemeral; its version and sequence are independent of edit clocks. */
export const PRESENCE_VERSION = 1;
export type PresenceState = Omit<Presence, 'cursor' | 'selection'> &
  Partial<Pick<Presence, 'cursor' | 'selection'>> & {
    /** Unit coordinates in the named document surface, before its view transform. */
    readonly surface?: { readonly id: string; readonly space: 'unit' };
    readonly preview?: CanvasPreview;
  };
export interface PresenceFrame {
  readonly v?: number;
  readonly from: string;
  readonly epoch?: string;
  readonly seq: number;
  readonly state: PresenceState | null;
  readonly away?: boolean;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function str(v: unknown, max = 256): string | undefined {
  if (typeof v !== 'string') return undefined;
  let out = '';
  for (const ch of v) {
    const code = ch.codePointAt(0)!;
    if (code < 32 || code >= 127 && code <= 159) continue;
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out || undefined;
}
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const ids = (v: unknown): string[] => Array.isArray(v)
  ? v.slice(0, 200).map(x => str(x)).filter((x): x is string => !!x) : [];

/** Copy only known bounded fields. Missing/invalid cursor means no cursor. */
export function sanitizePresenceState(raw: unknown, identity?: { userId: string; name: string }): PresenceState {
  const s = object(raw) ? raw : {};
  const out: { -readonly [K in keyof PresenceState]: PresenceState[K] } = {
    userId: identity?.userId ?? str(s.userId) ?? '', name: identity?.name ?? str(s.name) ?? '',
    color: typeof s.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '',
    selection: ids(s.selection),
  };
  if (object(s.cursor) && finite(s.cursor.x, 0, 1) && finite(s.cursor.y, 0, 1))
    out.cursor = { x: s.cursor.x, y: s.cursor.y };
  if (object(s.surface) && s.surface.space === 'unit' && str(s.surface.id))
    out.surface = { id: str(s.surface.id)!, space: 'unit' };
  for (const key of ['focus', 'location', 'following', 'chat'] as const) {
    const value = str(s[key], key === 'chat' ? 64 : 256);
    if (value) out[key] = value;
  }
  if (object(s.viewport) && finite(s.viewport.x, -1e6, 1e6) && finite(s.viewport.y, -1e6, 1e6)
      && finite(s.viewport.zoom, 0.001, 1e6))
    out.viewport = { x: s.viewport.x, y: s.viewport.y, zoom: s.viewport.zoom };
  if (object(s.drag) && Array.isArray(s.drag.dxy) && finite(s.drag.dxy[0], -1e6, 1e6) && finite(s.drag.dxy[1], -1e6, 1e6))
    out.drag = { ids: ids(s.drag.ids), dxy: [s.drag.dxy[0], s.drag.dxy[1]] };
  const preview = readCanvasPreview(s.preview);
  if (preview) out.preview = preview;
  const headshot = typeof s.headshot === 'string' && s.headshot.length <= 512 ? decodeCanvasAsset(s.headshot) : null;
  if (headshot && ['raster', 'vector'].includes(headshot.type)) out.headshot = encodeCanvasAsset(headshot)!;
  if (Array.isArray(s.agents)) out.agents = readAgentPresence(s.agents);
  return out;
}

/** The caller supplies the authenticated connection identity; payload `from` is never authority. */
export function readPresenceFrame(raw: unknown, bound: { from: string; epoch: string; seq: number; userId: string; name: string }): PresenceFrame | null {
  if (!object(raw)) return null;
  const wrapped = Object.hasOwn(raw, 'state');
  if (wrapped && raw.state !== null && !object(raw.state)) return null;
  if (wrapped && raw.v !== undefined && raw.v !== PRESENCE_VERSION) return null;
  if (wrapped && (!Number.isSafeInteger(raw.seq) || (raw.seq as number) < 0)) return null;
  return { v: PRESENCE_VERSION, from: bound.from, epoch: bound.epoch,
    seq: wrapped ? raw.seq as number : bound.seq,
    state: wrapped && raw.state === null ? null : sanitizePresenceState(wrapped ? raw.state : raw, bound),
    away: wrapped && raw.away === true };
}
