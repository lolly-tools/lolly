// SPDX-License-Identifier: MPL-2.0

// ─── Network ────────────────────────────────────────────────────────────────

export interface NetAPI {
  /** Allowlisted fetch. The host may deny based on tool manifest. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
