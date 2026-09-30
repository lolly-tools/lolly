// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import { brandRuleDisposition, checkBrandRules, constrainBrandPoster, type BrandExample, type BrandFacts } from '../../../../../engine/src/brand-rules.ts';
import type { InputValue } from '../../../../../engine/src/inputs.ts';
import { sha256Hex } from '../../../../../engine/src/bytes.ts';
import { ENGINE_VERSION } from '../../../../../engine/src/version.ts';
import { inspectProduction } from '../../../../../engine/src/production.ts';
import { collectBrowserProduction } from '../../bridge/production.ts';
import { resolveVectorFont, refreshFontRegistry } from '../../bridge/font-registry.ts';
import { renderedFontRuns } from '../../bridge/font-coverage.ts';
import { brandFontStack } from '../../brand-vars.ts';
import { getTool, renderRowToBlob } from '../../pro/render-export.ts';
import { createDraftHost } from './draft-host.ts';
import { brandExample, type ExampleText } from './brand-examples.ts';
import { prepareDesignTool } from '../design-tool-compile.ts';
import type { CompiledDesignTool } from '../../../../../engine/src/design-tool/compiler.ts';

export interface ExampleCheck { label: string; state: 'pass' | 'fail' | 'unknown'; detail: string }
export interface ExampleFont { family: string; weight: string; text: string; files: Array<{ sha256: string; variations: string[] }>; missing: number | null }
const digest = (value: unknown): Promise<string> => sha256Hex(new TextEncoder().encode(JSON.stringify(value)));

/** Resolve and shape the mounted text; do not infer font identity from a PNG. */
async function fontFacts(root: Element, host: HostV1, signal: AbortSignal): Promise<{ fonts: ExampleFont[]; checks: ExampleCheck[] }> {
  refreshFontRegistry();
  const fonts: ExampleFont[] = [], checks: ExampleCheck[] = [];
  const runs = renderedFontRuns(root);
  for (const run of runs) {
    signal.throwIfAborted();
    try {
      const font = await resolveVectorFont(run.style, run.text);
      if (!font?.face || !host.text) throw new Error('Font bytes or shaping are unavailable.');
      const files = await Promise.all([{ fontUrl: font.url, variations: font.variations }, ...(font.fallbacks ?? [])].map(async source => {
        const response = await fetch(source.fontUrl, { signal, cache: 'no-cache' });
        if (!response.ok) throw new Error('A font file could not be read.');
        return { sha256: await sha256Hex(new Uint8Array(await response.arrayBuffer())), variations: source.variations ?? [] };
      }));
      // Paragraph separators are layout controls, not glyphs. Shape each line.
      const shaped = await Promise.all(run.text.split(/\r\n?|\n|\u2028|\u2029/).filter(line => line.trim()).map(line => host.text!.toPath({ text: line.replaceAll('\t', ' '), fontUrl: font.url, fontSize: 16, variations: font.variations, fallbackFonts: font.fallbacks })));
      const missing = shaped.some(line => line.notdef === undefined) ? null : shaped.reduce((sum, line) => sum + (line.notdef ?? 0), 0);
      fonts.push({ family: font.face.family, weight: String(run.style.fontWeight ?? '400'), text: run.text, files, missing });
    } catch (error) { signal.throwIfAborted(); checks.push({ label: 'Font identity', state: 'unknown', detail: (error as Error).message }); }
  }
  if (fonts.length) {
    checks.push({ label: 'Font bytes', state: 'pass', detail: `${fonts.length} text runs resolved to named files with SHA-256 identities.` });
    const missing = fonts.reduce((sum, font) => sum + (font.missing ?? 0), 0);
    checks.push({ label: 'Glyph coverage', state: missing ? 'fail' : fonts.some(font => font.missing === null) ? 'unknown' : 'pass', detail: missing ? `${missing} glyphs are missing from the resolved fonts.` : 'Shaped the actual example text, including its font subsets. Browser fallback is not certified.' });
  } else checks.push({ label: 'Glyph coverage', state: 'unknown', detail: 'No resolvable text runs were observed.' });
  return { fonts, checks };
}

function layoutFacts(root: HTMLElement): ExampleCheck {
  const texts = [...root.querySelectorAll<HTMLElement>('.lolly-box-text')];
  let measured = 0, overflow = 0;
  const issues: string[] = [];
  for (const text of texts) {
    const box = text.closest<HTMLElement>('[data-box-id]');
    if (!box?.clientWidth || !box.clientHeight || !text.textContent?.trim()) continue;
    measured++;
    // Match the reusable tool's layout guard. Glyph ascent may extend beyond a
    // line box without overflowing its layout, so Range bounds are not a fit test.
    if (text.scrollWidth > box.clientWidth + 1 || text.scrollHeight > box.clientHeight + 1) {
      overflow++;
      issues.push(`“${text.textContent.trim().slice(0, 40)}” needs ${text.scrollWidth} × ${text.scrollHeight} px; its box provides ${box.clientWidth} × ${box.clientHeight} px.`);
    }
  }
  if (!texts.length) {
    const bounds = root.getBoundingClientRect();
    for (const text of root.querySelectorAll('svg text')) {
      const rect = text.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      measured++;
      if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) overflow++;
    }
  }
  return { label: 'Text fit', state: !measured ? 'unknown' : overflow ? 'fail' : 'pass', detail: !measured ? 'No measurable text bounds were found.' : `${measured} text objects measured; ${overflow} exceed their layout bounds. ${issues.join(' ')} Glyph overhang, chart label collisions and general composition are not checked.` };
}

/** Every run starts fresh and binds mounted observations to the bytes it produces. */
export async function renderBrandExample(base: HostV1, doc: unknown, system: BrandSystemV1, mode: string, id: BrandExample, text: ExampleText, signal: AbortSignal, packagePoster = false, include?: ReadonlySet<string>) {
  const example = await brandExample(id, doc, system, mode, text);
  const tool = await getTool(example.toolId);
  const sourceSha256 = await digest({ doc, mode, values: example.values, system, template: id });
  const host = createDraftHost(base, example.renderDoc, mode);
  let inputs: Record<string, InputValue> = {};
  let fonts: ExampleFont[] = [], checks: ExampleCheck[] = [], rules = checkBrandRules(system, doc, { tool: id, mode, output: 'png' }, {});
  let compiled: CompiledDesignTool | undefined;
  const assets: Array<{ id: string; sha256: string }> = [];
  const render = host.export.render;
  host.export.render = async (node, format, options) => {
    if (!(node instanceof HTMLElement)) throw new Error('The mounted example is unavailable.');
    signal.throwIfAborted();
    node.style.setProperty('--font-brand', brandFontStack(example.family, 'sans-serif') ?? 'sans-serif');
    node.style.setProperty('--font-display', 'var(--font-brand)');
    await document.fonts.ready;
    const observed = await fontFacts(node, base, signal);
    fonts = observed.fonts; checks = [...observed.checks, layoutFacts(node)];
    const facts: BrandFacts = {};
    if (!fonts.length || observed.checks.some(check => check.state !== 'pass')) delete facts.type;
    else if (fonts.every(font => font.family.toLowerCase() === example.family.toLowerCase())) facts.type = { value: example.family };
    else facts.type = { value: [...new Set(fonts.map(font => font.family))].join(', ') };
    if (example.titleId) {
      const boxes = Array.isArray(inputs.boxes) ? inputs.boxes as Array<Record<string, unknown>> : [];
      const accent = boxes.find(box => box.id === (id === 'brand-poster' ? example.titleId : example.accentId));
      if (accent) facts.accent = { value: accent[id === 'brand-poster' ? 'fg' : 'bg'] };
      const title = node.querySelector(`[data-box-id="${example.titleId}"] .lolly-box-text`);
      const body = node.querySelector(`[data-box-id="${example.bodyId}"] .lolly-box-text`);
      if (title) facts.heading = { value: title.textContent ?? '' }; else delete facts.heading;
      if (body) facts.body = { value: body.textContent ?? '' }; else delete facts.body;
      const device = boxes.find(box => box.id === 'brand-device');
      if (device?.image) facts.device = { value: typeof device.image === 'string' ? device.image : (device.image as { id?: string }).id, fixed: true };
    } else {
      facts.accent = { value: inputs.paletteSeed };
      const heading = node.querySelector('[data-canvas-input="heading"]');
      if (heading) facts.heading = { value: typeof inputs.heading === 'string' ? inputs.heading : undefined };
    }
    if (facts.device) {
      const image = node.querySelector<HTMLImageElement>('[data-box-id="brand-device"] img');
      try {
        if (!image) throw new Error('Missing image');
        await image.decode();
        const response = await fetch(image.currentSrc || image.src, { signal });
        if (!response.ok) throw new Error('Artwork bytes unavailable');
        assets.push({ id: String(facts.device.value), sha256: await sha256Hex(new Uint8Array(await response.arrayBuffer())) });
      } catch { signal.throwIfAborted(); delete facts.device; }
    }
    rules = checkBrandRules(system, doc, { tool: id, mode, output: 'png' }, facts);
    if (packagePoster && example.draft && example.fields) {
      if (brandRuleDisposition(rules) !== 'checked' || checks.some(check => check.state !== 'pass')) throw new Error('Resolve the poster’s required rules, fonts and text bounds before making a reusable tool. You can still download an unchecked example as a draft.');
      const draft = constrainBrandPoster(example.draft, rules, example.fields);
      draft.formats = ['png'];
      draft.description = 'A fixed poster layout with the selected brand rules. Only the listed inputs can change. Rules apply to this packaged revision; future brand edits need a new tool file.';
      compiled = await prepareDesignTool(draft, node, host, { signal, include });
    }
    return render(node, format, options);
  };
  const result = await renderRowToBlob({ toolId: example.toolId, values: example.values }, host, { format: 'png', width: example.width, height: example.height, thumbnail: true, previewPage: true, watermark: false, embedMeta: false, c2pa: false, signal, observeInputs(values) { inputs = values; } });
  signal.throwIfAborted();
  const contextSha256 = await digest({ engine: ENGINE_VERSION, manifest: tool.manifest, template: tool.template, styles: tool.styles, hooks: tool.hooksSource, fonts, assets, width: example.width, height: example.height });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const report = await inspectProduction(bytes, { profile: 'lolly/production-still-v1', id, revision: sourceSha256, format: 'png', width: example.width, height: example.height, pages: 1, alpha: 'any', sourceSha256, contextSha256, requirements: [] }, collectBrowserProduction, { signal, resolved: { sourceSha256, contextSha256, records: { example: id, mode, engine: ENGINE_VERSION, brandSystem: system, brandRules: rules, brandRuleDisposition: brandRuleDisposition(rules), fonts, assets, mountedChecks: checks, scope: 'Mounted example observations bound to this PNG. Font identity is resolved source identity, not an independent pixel readback. Colour rules check the mounted accent input, not every painted colour. Chart heading length checks the mounted input; label clipping is a separate layout check.' } } });
  const disposition = brandRuleDisposition(rules);
  const state = disposition === 'blocked' || checks.some(check => check.state === 'fail') || report.checks.some(check => check.state === 'fail') ? 'blocked' : disposition === 'draft' || checks.some(check => check.state === 'unknown') || report.checks.some(check => check.state === 'undetermined') ? 'draft' : 'checked';
  const labels: Record<string, [string, string]> = {
    format: ['PNG format', 'Read back the exported file format.'], readability: ['Readable file', 'Decoded the exported PNG.'],
    width: ['Output width', `Expected ${example.width} pixels.`], height: ['Output height', `Expected ${example.height} pixels.`], pages: ['Single image', 'Expected one image.'],
    source: ['Brand revision', 'This report records the source revision used for the example.'], context: ['Renderer and resources', 'This report records the renderer, fonts and artwork used for the example.'],
  };
  const outputChecks: ExampleCheck[] = report.checks.map(check => ({ label: labels[check.id]?.[0] ?? check.id, state: check.state === 'undetermined' ? 'unknown' : check.state, detail: check.state === 'pass' ? labels[check.id]?.[1] ?? check.reason : check.reason }));
  return { id, blob: result.blob, report, rules, checks: [...checks, ...outputChecks], fonts, state, compiled };
}
export type BrandExampleProof = Awaited<ReturnType<typeof renderBrandExample>>;
