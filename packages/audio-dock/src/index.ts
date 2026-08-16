// SPDX-License-Identifier: MPL-2.0
// @lolly-tools/audio-dock: the shared, dependency-free audio-dock UI shell.
//
// ONE collapsible dock (Full / Compact / Mini) that TWO hosts drive: the Lolly
// web app (music / internet radio / atmosphere soundbeds) and the static /info
// docs site (page narration). The shell owns DOM, collapse, capability-gated
// sections, and a guarded viz backdrop. It delegates ALL audio to a `DockHost`
// the host implements. It imports nothing but its own types + CSS, so the static
// site can bundle it without pulling in the SPA module graph.
//
// See plan this-is-a-very-sparkling-eich ("unified audio dock", Phase 2) and
// memory docs-in-app-shared-renderer. This is Phase 2a: the package only. The
// live players (neuro-dock.ts, neurospicy.ts, docs/player/player.ts) migrate onto
// it in later phases by implementing DockHost.

export { createAudioDock } from './dock.ts';
export { DOCK_CSS, DOCK_STYLE_ID } from './styles.ts';
export type {
  DockHost,
  DockCapabilities,
  DockController,
  DockCollapse,
  DockSectionId,
  DockSource,
  DockSourceKind,
  DockSources,
  DockAttribution,
  DockNowPlaying,
  DockNarration,
  DockNarrationPlayer,
  DockAtmosphere,
  DockAtmosphereLayer,
  DockViz,
  DockVizPreset,
  DockVizTheme,
  DockVizTransition,
  DockVolume,
  DockRepeat,
  DockPlacement,
  DockPlacementStore,
  AudioDockOptions,
} from './types.ts';
