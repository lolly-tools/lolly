// SPDX-License-Identifier: MPL-2.0
/**
 * The two reads lib/butterchurn-viz.ts makes of the web shell's focus-music
 * player (lib/neurospicy.ts). The editor frame has no such player: the
 * visualiser is always given the song's own analyser, so these say "nothing
 * playing" and the player itself stays out of the bundle.
 */
export function getNeurospicyAnalyser(): AnalyserNode | null {
  return null;
}
export function neurospicySignalState(): 'live' | 'idle' | 'connecting' | 'unanalysable' {
  return 'idle';
}
