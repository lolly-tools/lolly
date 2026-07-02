// SPDX-License-Identifier: MPL-2.0
/**
 * Capabilities THIS shell's bridge can fulfil — a subset of the tool.json
 * `capabilities` enum (see schemas/tool.schema.json). The host exposes this as
 * `host.capabilities`; the gallery and tool view disable tools whose declared
 * capabilities aren't all present here.
 *
 * This is the WEB set. Other shells override this module via their
 * bridge-overrides (e.g. the Tauri desktop shell adds 'capture' and 'filesystem')
 * so the SAME gallery/tool code gates the right tools per shell.
 */
import type { Capability } from '@lolly/engine';

export const PROVIDED_CAPABILITIES: readonly Capability[] = ['network', 'clipboard', 'wasm', 'compose'];
