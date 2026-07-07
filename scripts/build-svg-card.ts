#!/usr/bin/env node
/**
 * Animated SVG card generator.
 *
 * A handful of tools are, at heart, a self-contained animated inline SVG driven by
 * pure CSS `@keyframes` (no JS, no hooks, no assets) — e.g. bag-video's posed Geeko
 * and digi-ad's scene loop. For those, the most PERFORMANT gallery preview isn't a
 * raster APNG/GIF or a <video>, but the tool's own vector artwork shipped as a
 * committed `tools/<id>/card.svg`: it animates natively inside the gallery's <img>
 * (CSS animations run in an <img>-referenced SVG), is GPU-composited, pauses when
 * off-screen, and is a few KB instead of hundreds.
 *
 * This renders the tool's template with a set of inputs (the engine's real Handlebars
 * `hydrate`, so the output is byte-faithful to what the tool shows), lifts the resolved
 * <svg> + <style>, and re-wraps them as a standalone animated SVG (the <style> moves
 * INSIDE the root svg so its keyframes ship with it; an optional background <rect> stands
 * in for the HTML .scene backdrop the file no longer has). It writes:
 *   • tools/<id>/card.svg      — the DEFAULT inputs, the gallery card (a brand backdrop)
 *   • tools/<id>/look<i>.svg   — one per manifest example (`looks: true`), the example
 *                                carousel slides; each is TRANSPARENT so it composites on
 *                                the tile, and each is picked up as a committed look
 *                                override by build-preview-bundle.ts (which inlines it) and
 *                                skipped by build-previews.ts (so `npm run previews` can't
 *                                clobber it). Run `npm run build:catalog` afterwards.
 *
 *   node scripts/build-svg-card.ts <toolId> [<toolId> ...]
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { hydrate, buildInputModel } from '../engine/src/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;

// Per-tool preview config: the backdrop colour the standalone card SVG paints itself (the
// tool's HTML container supplies it live; a lifted <svg> has no parent to inherit from),
// any non-default input overrides that make the DEFAULT look the best teaser, and whether
// to ALSO emit a transparent animated SVG per manifest example (`looks`).
//
// ONLY for tools whose canvas is a self-contained animated inline <svg> with no JS/hooks/
// assets. bag-video qualifies. digi-ad does NOT — it's HTML/CSS <div> scenes + hooks.js,
// so it has no <svg> to lift; an animated card for it would need the raster (APNG) route.
const CARDS: Record<string, { bg: string; overrides?: Record<string, unknown>; looks?: boolean }> = {
  'bag-video': { bg: '#0c322c', looks: true },
  // Pose Geeko: default pose is transparent + eyes-open; the card is a clean geeko that
  // composites on the tile and gently breathes (its `idle` default is on). Card only —
  // its example carousel keeps its manual-pose looks.
  'pose-geeko': { bg: 'transparent' },
};

/**
 * Hydrate the template with `values` and lift its <svg> + <style> into ONE standalone
 * animated SVG string. `bg` paints a backdrop rect (skip for a transparent look). The
 * <style> moves inside the root <svg> so its @keyframes travel with the file and animate
 * natively in an <img>.
 */
function liftStandaloneSvg(
  manifest: Record<string, unknown>,
  template: string,
  values: Record<string, unknown>,
  bg: string | null,
  toolId: string,
): string {
  const html = hydrate(template, values, { raw: true });
  if (html.includes('{{')) throw new Error(`${toolId}: unresolved Handlebars remain`);

  // Pull the <style> block, then REMOVE it from the html before locating the <svg>. A CSS
  // comment can contain literal "<svg>"/"<g>"/"<style>" text (e.g. docs about the export),
  // which would otherwise fool the greedy svg/style regexes into starting at the fake tag.
  // Strip CSS comments from the lifted stylesheet too — non-functional, smaller, and it
  // dodges the same landmine (a "</style>" in a comment would close the injected block early).
  const styleBlock = (html.match(/<style[^>]*>[\s\S]*?<\/style>/) || [''])[0];
  let style = styleBlock.replace(/^<style[^>]*>/, '').replace(/<\/style>\s*$/, '');
  style = style.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{2,}/g, '\n').trim();

  const body = html.replace(styleBlock, '');                   // style gone → its comments can't fool the match
  const svgMatch = body.match(/<svg[\s\S]*<\/svg>/);           // outermost real svg span
  if (!svgMatch) throw new Error(`${toolId}: no <svg> in rendered template`);
  let svg = svgMatch[0];

  // Standalone requirements: an explicit namespace, and a viewBox so the art has an intrinsic
  // coordinate box — an <img>/tile with no matching width/height STRETCHES a viewBox-less SVG.
  const openEnd = svg.indexOf('>');
  let openTag = svg.slice(0, openEnd);
  if (!/xmlns=/.test(openTag)) openTag = openTag.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  const viewBox = (openTag.match(/viewBox="([^"]+)"/) || [, ''])[1]!;
  if (!viewBox) throw new Error(`${toolId}: lifted <svg> has no viewBox — the card would stretch in the tile`);
  // A viewBox alone is NOT enough: Safari's <img> reports a 300×150 fallback intrinsic for a
  // width/height-less SVG, so height:auto makes a 2:1 box and the art STRETCHES to fill it.
  // Emit explicit width/height (the viewBox extent) so every browser gets the true ratio.
  if (!/\swidth\s*=\s*"[0-9]/.test(openTag)) {
    const vbParts = viewBox.trim().split(/[\s,]+/);
    openTag = openTag.replace(/^<svg/, `<svg width="${vbParts[2]}" height="${vbParts[3]}"`);
  }
  svg = openTag + svg.slice(openEnd);

  // Inject the keyframe stylesheet INSIDE the root svg (so the animation travels with the
  // file); paint the backdrop the lifted markup lost only when an OPAQUE colour is given
  // (a transparent/none bg composites on the gallery tile). Order: bg rect (behind
  // everything), then style, then the original children.
  const paint = bg && bg !== 'transparent' && bg !== 'none';
  const bgRect = !paint ? ''
    : viewBox
      ? `<rect x="${viewBox.split(/\s+/)[0]}" y="${viewBox.split(/\s+/)[1]}" width="100%" height="100%" fill="${bg}"/>`
      : `<rect width="100%" height="100%" fill="${bg}"/>`;
  // Escape `&` and `<` in the lifted CSS: a standalone SVG is parsed as strict XML (resvg AND
  // the browser's <img>/<object> loaders), where a raw `&` (e.g. in a comment "Scale & …", or
  // a CSS-nesting `&`) or `<` is a fatal "malformed entity". Escaping keeps the <style> valid
  // PCDATA in EVERY context — XML img/object AND an innerHTML inline — where CDATA would break
  // the latter (HTML parsers treat `<![CDATA[` as a bogus comment and drop the CSS). The XML/
  // HTML parser un-escapes before the CSS parser runs, so the stylesheet is byte-identical.
  const styleXml = style.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const inner = `\n<style>${styleXml}</style>\n${bgRect}\n`;
  svg = svg.replace(/>/, '>' + inner);   // after the opening tag
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`;
}

/** Same shape as featured-row.ts resolveExamples / build-preview-bundle.ts resolveLooks. */
function resolveExamples(manifest: Record<string, any>): Array<{ values?: Record<string, unknown> }> {
  return manifest.examples ?? manifest.featured?.variants ?? [];
}

function buildCard(toolId: string): void {
  const cfg = CARDS[toolId];
  if (!cfg) throw new Error(`no card config for ${toolId}`);
  const dir = join(ROOT, 'tools', toolId);
  const manifest = JSON.parse(readFileSync(join(dir, 'tool.json'), 'utf8'));
  const template = readFileSync(join(dir, 'template.html'), 'utf8');

  // Default input values, exactly as the tool opens with — via the engine's own model
  // builder so vector/synthetic defaults resolve identically to the live tool.
  const defaults = Object.fromEntries(buildInputModel(manifest, {}).map((m) => [m.id, m.value]));

  const out = liftStandaloneSvg(manifest, template, { ...defaults, ...(cfg.overrides ?? {}) }, cfg.bg, toolId);
  const file = join(dir, 'card.svg');
  writeFileSync(file, out);
  console.log(`✓ ${toolId}: wrote ${file.replace(ROOT, '')} (${(out.length / 1024).toFixed(1)} KB)`);

  if (!cfg.looks) return;
  // One transparent animated SVG per manifest example → the example-carousel slides.
  const examples = resolveExamples(manifest);
  examples.forEach((ex, i) => {
    if (!ex.values || typeof ex.values !== 'object') return;
    const lookOut = liftStandaloneSvg(manifest, template, { ...defaults, ...ex.values }, null, toolId);
    const lookFile = join(dir, `look${i}.svg`);
    writeFileSync(lookFile, lookOut);
    // build-preview-bundle prefers a look<i>.svg over a look<i>.png/.webp, but drop a stale
    // raster sibling (e.g. a superseded APNG) so the tool dir carries exactly one look form.
    for (const ext of ['png', 'webp']) {
      const stale = join(dir, `look${i}.${ext}`);
      if (existsSync(stale)) unlinkSync(stale);
    }
    console.log(`  ↳ look${i} (${JSON.stringify(ex.values)}) — ${(lookOut.length / 1024).toFixed(1)} KB`);
  });
}

const ids = process.argv.slice(2);
if (!ids.length) { console.error('usage: node scripts/build-svg-card.ts <toolId> [...]'); process.exit(1); }
for (const id of ids) {
  if (!existsSync(join(ROOT, 'tools', id))) { console.error(`✗ ${id}: no such tool`); continue; }
  try { buildCard(id); } catch (e) { console.error(`✗ ${id}: ${(e as Error).message}`); }
}
