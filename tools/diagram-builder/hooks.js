/**
 * Diagram Builder — org / tree / mindmap / layercake / process / timeline /
 * cycle / pyramid / funnel / kanban / matrix / gantt, from visual cards, a typed
 * text DSL, ASCII art, a Mermaid subset, or a pasted CSV/table.
 *
 * SVG-rooted tool: the whole scene is built as an <svg> STRING here and rendered
 * verbatim by the template ({{{diagramSvg}}}). Layout is pure JS, so it renders
 * identically in the browser and headless in the CLI. The one browser-only touch is
 * optional card images: in a browser they're embedded as a self-contained data URL
 * and measured for aspect; headless degrades gracefully.
 *
 * EXPORT SAFETY (verified 2026-06-30 against shells/web/src/bridge/export/ +
 * engine/src/{svg-path,emf}.js, correcting the older note here):
 *   - PDF walker (drawSvgVectorsInRegion) honours <path> (full M/L/H/V/C/S/Q/T/A/Z,
 *     fill + stroke + fill-rule + opacity), <line> (stroke ONLY, own attr), <rect>
 *     (fill + stroke), <circle> (fill + stroke), <text> (anchors start/mid/end, one
 *     run, SUSE/Helvetica), <image>. It DROPS <ellipse>/<polygon>/<polyline>/
 *     <marker>, stroke-dasharray, leaf transforms, and gradients.
 *   - EMF/EPS walker adds ellipse/polygon/polyline but is RGB-only, solid-pen only
 *     (no dasharray), skips <image>, and THROWS on non-SUSE fonts / letter-spacing.
 *   - SVG export is a verbatim passthrough; PNG is faithful (browser raster).
 * The portable subset we therefore stick to: shapes are fill+own-stroke <path>
 * (rounded-rect cards/bands, trapezoids, circle dots via 4 cubics), connectors are
 * <line>/<path> with own stroke, dashes/dots are REAL segment geometry (never
 * dasharray), arrowheads are computed filled <path>/<line> (never <marker> or
 * transforms), text is one SUSE run per line. No <ellipse>/<polygon>/<polyline>.
 *
 * Links are free-text IDs (not row indexes): a card references its parent/layer/
 * arrow endpoint by ID, resolved here. Unknown refs degrade gracefully.
 *
 * This is the ESM entry point (tool.json sets hooks.module = true). Everything but
 * the lifecycle glue below lives in ./lib/* , split along natural seams (constants,
 * small helpers, SVG primitives, images, shapes/cards, tree/group/sequence layouts,
 * arrows, DSL/Mermaid/table/ASCII parsing, preset seeding, scene composition). ES
 * modules have no ambient `host` global — it's threaded explicitly through
 * buildDiagram/parseMermaid/compute via the hook context instead.
 */
import { buildDiagram } from './lib/scene.js';
import { resolvePatches } from './lib/presets.js';
import { inputsFrom } from './lib/util.js';
import { errPlaceholder } from './lib/svg.js';

// ── lifecycle ────────────────────────────────────────────────────────────────────
async function compute(model, changedId, host) {
  var inp = inputsFrom(model);
  var patch = (changedId === 'preset' || changedId === 'theme' || changedId === 'density') ? resolvePatches(inp, changedId) : {};
  Object.keys(patch).forEach(function (k) { inp[k] = patch[k]; });
  var svg;
  try { svg = await buildDiagram(inp, host); }
  catch (e) {
    if (host && host.log) host.log('warn', 'diagram-builder: build failed', { error: String(e) });
    svg = errPlaceholder('Could not build this diagram.');
  }
  return Object.assign({ diagramSvg: svg }, patch);
}

export function onInit(ctx) { return compute(ctx.model, null, ctx.host); }
export function onInput(ctx) { return compute(ctx.model, ctx.id, ctx.host); }
