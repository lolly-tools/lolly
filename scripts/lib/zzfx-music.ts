/**
 * Re-export shim. The ZzFX preset bank + ZzFXM composition helpers moved into
 * the ENGINE — engine/src/zzfx-compose.ts (1.60.0, barrel-exported) — so shells
 * can compose songs at runtime, not just the ingest/generator scripts. New code
 * should import from the engine; this path stays only so existing script
 * imports keep resolving.
 */
export {
  PRESETS, SCALES, mulberry32, patternSeconds, composeSong,
} from '../../engine/src/zzfx-compose.ts';
export type { PresetName, ScaleName, Archetype, SongSpec } from '../../engine/src/zzfx-compose.ts';
