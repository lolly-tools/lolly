// SPDX-License-Identifier: MPL-2.0

// ─── State ──────────────────────────────────────────────────────────────────

export interface StateAPI {
  /** Save the current tool's input state. Keyed by tool id + a slot name. */
  save(slot: string, data: object): Promise<void>;
  load(slot: string): Promise<object | null>;
  list(): Promise<StateEntry[]>;
  delete(slot: string): Promise<void>;
}

export interface StateEntry {
  slot: string;
  toolId: string;
  toolVersion: string;
  updatedAt: string; // ISO
  label?: string; // user-given name
}
