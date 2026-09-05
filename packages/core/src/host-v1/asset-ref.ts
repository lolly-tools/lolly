// SPDX-License-Identifier: MPL-2.0

// Re-export the AssetRef shape from the schema for convenience.
export interface AssetRef {
  source: 'library' | 'user' | 'remote';
  id: string;
  // 'profile' is an ICC colour profile the USER supplied (a press or display
  // profile, `user/profiles/<digest>`). It has no visual form - it is a gamut to
  // compare against, not something to place - so image surfaces filter it out
  // the same way they filter 'font' and 'tokens'.
  type:
    | 'vector'
    | 'raster'
    | 'video'
    | 'audio'
    | 'lottie'
    | 'model'
    | 'lut'
    | 'palette'
    | 'tokens'
    | 'font'
    | 'profile'
    | 'ratecard'
    | 'text'
    | 'data';
  format: string;
  url: string;
  width?: number;
  height?: number;
  version?: string;
  checksum?: string;
  // Free-form, host-populated. Conventional keys the engine/shells recognise:
  //   name       display label
  //   tags       string[] for filtering
  // animated true for an animated raster (gif/apng/animated-webp) - the frame
  //              badge marks it and exports know it flattens to a still
  //   posterUrl  a still fallback frame for a lottie or video (used for the
  //              <video poster> attribute and as the pre-play / export still)
  //   baked      true for a FROZEN composed render (engine bake.ts): the url is
  // a self-contained data: URL, resolved as-is on every mount - no
  //              compose depth consumed, never live-re-rendered
  //   bakedAt    epoch ms the bake happened
  // bakedFrom the canonical embed URL the bake rendered from - provenance
  //              for on-demand re-baking (absent when none could be minted)
  // durationMs playback length in milliseconds - video, audio, and lottie assets.
  //              Resolved at ingest (storeUserUpload probes it; a catalog asset
  //              authors it in asset.schema.json's per-format entry). Only ever
  // present when it resolved to a finite positive number - never 0
  //              or a bogus placeholder.
  // fps a lottie's frame rate (its `fr`), alongside its durationMs -
  //              not meaningful for video/audio.
  // aiSignals  a text asset's persisted AI-likelihood note from the engine's
  //              analyzeTextSignals: { v, band, score, source, family?,
  //              confidence? }. `v` is the LEXICON_VERSION that produced it -
  //              a stale v means recompute, never trust. A SIGNAL carried for
  //              the user's own confidence in an ingredient, never a verdict,
  //              and never written into signed provenance.
  meta?: Record<string, unknown>;
}
