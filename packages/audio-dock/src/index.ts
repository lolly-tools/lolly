// SPDX-License-Identifier: MPL-2.0
// @lolly-tools/audio-dock: the shared, dependency-free audio-dock UI shell.
//
// ONE collapsible dock (Full / Compact / Mini) that the Lolly web app drives
// (music / internet radio / atmosphere soundbeds). The static /info docs site's
// page narration was a second host until it was removed on 2026-10-08. The shell
// owns DOM, collapse, capability-gated sections, and a guarded viz backdrop. It
// delegates ALL audio to a `DockHost` the host implements. It imports nothing but
// its own types + CSS, so a static page can bundle it without the SPA module graph.
//
// See plan this-is-a-very-sparkling-eich ("unified audio dock", Phase 2) and
// memory docs-in-app-shared-renderer. This is Phase 2a: the package only. The
// live players (neuro-dock.ts, neurospicy.ts) migrate onto it in later phases by
// implementing DockHost.

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
  DockBrandMark,
  DockVizPreset,
  DockVizTheme,
  DockVizTransition,
  DockVolume,
  DockRepeat,
  DockPlacement,
  DockPlacementStore,
  AudioDockOptions,
} from './types.ts';
