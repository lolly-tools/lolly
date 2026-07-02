// SPDX-License-Identifier: MPL-2.0
// ── preset / theme / density seeding ─────────────────────────────────────────────
// Seeds run ONLY in reaction to the user changing the preset/theme/density select
// (compute is told the changed input id) — never on reload/onInit. So a seed never
// clobbers a manual edit the user made afterwards: re-opening a saved/shared diagram
// renders the persisted values as-is. The preset→theme→density cascade still resolves
// in a single change because each step reads `patch.X || inp.X`.
import { DENSITY, PRESETS, THEMES } from './constants.js';

export function resolvePatches(inp, changedId) {
  var patch = {};
  if (changedId === 'preset' && inp.preset && inp.preset !== 'custom') {
    var p = PRESETS[inp.preset];
    if (p) Object.keys(p).forEach(function (k) { patch[k] = p[k]; });
  }
  if (changedId === 'preset' || changedId === 'theme') {
    var theme = patch.theme || inp.theme;
    if (theme && theme !== 'custom') {
      var t = THEMES[theme];
      if (t) { patch.nodeFill = t.nodeFill; patch.nodeStroke = t.nodeStroke; patch.nodeText = t.nodeText; patch.edgeColor = t.edgeColor; patch.background = t.background; }
    }
  }
  if (changedId === 'preset' || changedId === 'density') {
    var density = patch.density || inp.density;
    if (density && density !== 'custom') {
      var d = DENSITY[density];
      if (d) { patch.rowGap = d.rowGap; patch.siblingGap = d.siblingGap; patch.cardScale = d.cardScale; }
    }
  }
  return patch;
}
