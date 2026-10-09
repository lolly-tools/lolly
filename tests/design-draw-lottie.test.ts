// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { compileDesignRow, type DrawShapeOp } from '../engine/src/design-draw.ts';
import { designDrawLottie } from '../engine/src/design-draw-lottie.ts';
import { fileURLToPath } from 'node:url';
import { createMockHost } from '@lolly-tools/core';
import type { ExportOpts, HostV1 } from '../engine/src/bridge/host-v1.ts';
import { exportDesignLottie } from '../engine/src/design-lottie.ts';
import { readLottie } from '../engine/src/dotlottie.ts';
import type { LottieObject } from '../engine/src/lottie-model.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';

/** Frozen legacy exporter from source267999267, retained before P3e-1.
 * This oracle never imports the new compiler or target emitter. */
const legacySource = `// SPDX-License-Identifier: MPL-2.0
/** Authored Design values into the shared sequence compiler, identical on every host. */
import type { AssetRef, ExportOpts, HostV1 } from './bridge/host-v1.ts';
import { bytesToBin } from './bytes.ts';
import { parseColorToSrgb8 } from './css-color.ts';
import { colorToHex } from './tokens.ts';
import { parseSvgPath } from './svg-path.ts';
import { imageDimensions } from './penpot-file.ts';
import { lottieImageMime, readLottie, selectLottie, writeDotLottie } from './dotlottie.ts';
import { compileLottieSequence, lottieStatic as fixed, type LottieSequenceLayer } from './lottie-sequence.ts';
import type { LottieObject } from './lottie-model.ts';
import { applyLottieEdits } from './lottie-edit.ts';
import { attributionCompanion } from './rights-attribution.ts';
import { checkCompanionReadback } from './rights-companion.ts';
import { parseSequenceMarks, sequenceRange } from './sequence-marks.ts';

type Box = Record<string, unknown>;
const num = (value: unknown, fallback = 0): number => value === '' || value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);
const yes = (value: unknown): boolean => value === true || value === 'true' || value === '1' || value === 1;
const authoredTime = (value: unknown): boolean => value !== '' && value != null && Number.isFinite(Number(value));
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(n, hi));

async function paint(value: unknown, host: HostV1): Promise<number[] | null> {
  let text = String(value ?? 'transparent');
  if (text === 'transparent' || text === 'none' || !text) return null;
  if (text.startsWith('{')) text = colorToHex(await host.tokens?.resolve(text)) ?? '';
  const variable = /^var\\(--brand-(primary|on-primary|secondary|surface|text|muted|edge)\\s*(?:,\\s*(.+))?\\)$/.exec(text);
  if (variable) text = colorToHex(await host.tokens?.resolve(\`{color.semantic.\${variable[1]}}\`)) ?? variable[2] ?? '';
  const rgba = parseColorToSrgb8(text);
  if (!rgba) throw new Error(\`dotLottie: colour \${String(value)} could not be resolved to a solid paint.\`);
  return [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3]];
}
function unsupported(box: Box): void {
  const name = String(box.name || box.id || 'Layer');
  const fail = (feature: string) => { throw new Error(\`\${name}: \${feature} is not supported by dotLottie export. Remove it or export video.\`); };
  if (String(box.text ?? '').trim() || box.kind === 'text') fail('text');
  if (box.pathPaint) fail('independent vector paint');
  if (box.kind === 'audio' || box.kind === 'camera' || box.kind === '3d') fail(String(box.kind));
  if (box.kind && !['box', 'path', 'image', 'frame'].includes(String(box.kind))) fail(String(box.kind));
  for (const field of ['grad', 'clip', 'bindStart', 'bindEnd', 'cls']) if (box[field]) fail(field);
  for (const field of ['blur', 'bgBlur', 'z', 'rx', 'ry']) if (num(box[field])) fail(field);
  for (const field of ['shadow', 'blend', 'enter', 'exit', 'hold', 'headStart', 'headEnd', 'split']) if (box[field] && box[field] !== 'none' && box[field] !== 'normal') fail(field);
  if (yes(box.flipH) || yes(box.flipV)) fail('mirroring');
  if (num(box.strokeW) > 0 && ((box.strokeDash && box.strokeDash !== 'solid') || box.strokeDashArray)) fail('dashed strokes');
}
async function shapes(box: Box, w: number, h: number, host: HostV1): Promise<LottieObject[]> {
  const out: LottieObject[] = [];
  const fill = await paint(box.bg, host), stroke = await paint(box.stroke, host);
  const sw = stroke ? Math.max(0, num(box.strokeW)) : 0;
  if (box.kind === 'path') {
    if (!box.path) return [];
    if (!host.geom) throw new Error('dotLottie path export needs host.geom.');
    const decoded = host.geom.decodeAuthored(String(box.path));
    if (!decoded.ok) throw new Error(\`Path \${String(box.id)}: \${decoded.message}\`);
    for (const src of decoded.value) {
      const nodes = src.nodes.map(node => ({ ...node, x: node.x * w, y: node.y * h,
        ...(node.hInX !== undefined ? { hInX: node.hInX * w } : {}), ...(node.hInY !== undefined ? { hInY: node.hInY * h } : {}),
        ...(node.hOutX !== undefined ? { hOutX: node.hOutX * w } : {}), ...(node.hOutY !== undefined ? { hOutY: node.hOutY * h } : {}),
      }));
      const result = host.geom.fromNodes({ ...src, nodes, decimals: 3 });
      if (!result.ok) throw new Error(\`Path \${String(box.id)}: \${result.message}\`);
      for (const path of parseSvgPath(result.d)) {
        const vertices: number[][] = [], incoming: number[][] = [], outgoing: number[][] = [];
        for (const segment of path.segments) {
          if (segment.op === 'C') {
            const previous = vertices.at(-1)!;
            outgoing[outgoing.length - 1] = [segment.x1 - previous[0]!, segment.y1 - previous[1]!];
          }
          vertices.push([segment.x, segment.y]);
          incoming.push(segment.op === 'C' ? [segment.x2 - segment.x, segment.y2 - segment.y] : [0, 0]); outgoing.push([0, 0]);
        }
        out.push({ ty: 'sh', ks: fixed({ v: vertices, i: incoming, o: outgoing, c: path.closed }) });
      }
    }
  } else {
    const ellipse = box.shape === 'circle' || box.shape === 'ellipse';
    if (!['rect', 'rounded', 'pill', 'circle', 'ellipse', ''].includes(String(box.shape ?? ''))) throw new Error(\`\${String(box.id)}: unsupported shape \${String(box.shape)}.\`);
    out.push({ ty: ellipse ? 'el' : 'rc', p: fixed([w / 2, h / 2]), s: fixed([Math.max(0, w - sw), Math.max(0, h - sw)]),
      ...(!ellipse ? { r: fixed(box.shape === 'pill' ? Math.min(w, h) / 2 : box.shape === 'rounded' ? Math.max(0, num(box.radius, 16) - sw / 2) : 0) } : {}), d: 1 });
  }
  if (fill) out.push({ ty: 'fl', c: fixed(fill), o: fixed(fill[3]! * 100), r: box.fillRule === 'evenodd' ? 2 : 1 });
  if (stroke && sw) out.push({ ty: 'st', c: fixed(stroke), o: fixed(stroke[3]! * 100), w: fixed(sw), lc: box.strokeCap === 'round' ? 2 : box.strokeCap === 'square' ? 3 : 1, lj: box.strokeJoin === 'round' ? 2 : box.strokeJoin === 'bevel' ? 3 : 1, ml: 4 });
  return out;
}
/** Freeze before IO; asset bytes resolve through the same pinned refs as other exports. */
export async function exportDesignLottie(opts: ExportOpts & { fps?: number }, host: HostV1): Promise<Blob> {
  if (opts.sourceDocument?.toolId !== 'design') throw new Error('dotLottie export needs an authored Design sequence.');
  if (opts.watermark) throw new Error('dotLottie cannot carry the requested visible watermark.');
  const values = structuredClone(opts.sourceDocument.values);
  if (values.customCss) throw new Error('dotLottie cannot reproduce custom CSS. Remove it or export video.');
  const boxes = (Array.isArray(values.boxes) ? values.boxes : []) as Box[];
  const visible = boxes.filter(box => !yes(box.hidden));
  const frames = visible.filter(box => box.kind === 'frame');
  if (frames.length > 1) throw new Error('dotLottie currently exports one artboard. Use one sequence artboard or export video.');
  const frame = frames[0];
  if (frame) unsupported(frame);
  const width = Math.round(num(frame?.w, num(opts.width, 1080))), height = Math.round(num(frame?.h, num(opts.height, 1080)));
  const ignored = boxes.filter(box => box.lane === 'seq' && yes(box.ignored) && authoredTime(box.dur));
  const start = (box: Box): number => {
    const s = clamp(num(box.start), 0, 3600);
    const removed = box.lane === 'seq' ? ignored.filter(other => num(other.start) < s - 1e-6).reduce((sum, other) => sum + clamp(num(other.dur), 0.1, 3600), 0) : 0;
    return Math.round(Math.max(0, s - removed) * 1000);
  };
  const content = visible.filter(box => box.kind !== 'frame' && !yes(box.ignored) && (!frame || String(box.frame) === String(frame.id)));
  const timed = content.filter(box => box.lane === 'seq' || authoredTime(box.start));
  const finite = timed.filter(box => authoredTime(box.dur));
  const durationMs = finite.length ? Math.max(...finite.map(box => start(box) + Math.round(clamp(num(box.dur), 0.1, 3600) * 1000))) : 5000;
  const layers: LottieSequenceLayer[] = [];
  const background = opts.background === 'transparent' || yes(values.transparentBg) ? null : await paint(frame?.bg ?? values.background, host);
  if (background) layers.push({ name: 'Background', x: 0, y: 0, w: width, h: height, rotation: 0, opacity: 1, startMs: 0, durationMs,
    content: { kind: 'shape', shapes: [{ ty: 'rc', p: fixed([width / 2, height / 2]), s: fixed([width, height]), r: fixed(0) }, { ty: 'fl', c: fixed(background), o: fixed(background[3]! * 100), r: 1 }] } });
  for (const box of content) {
    opts.signal?.throwIfAborted();
    unsupported(box);
    const layer: LottieSequenceLayer = {
      name: String(box.name || box.id || 'Layer'), x: Math.round(num(box.x)) - Math.round(num(frame?.x)), y: Math.round(num(box.y)) - Math.round(num(frame?.y)),
      w: Math.max(1, Math.round(num(box.w, 1))), h: Math.max(1, Math.round(num(box.h, 1))), rotation: Math.round(num(box.rot) * 10) / 10,
      opacity: clamp(num(box.opacity, 100), 0, 100) / 100, startMs: start(box), durationMs: authoredTime(box.dur) ? Math.round(clamp(num(box.dur), 0.1, 3600) * 1000) : durationMs - start(box),
      kf: String(box.kf ?? ''), content: { kind: 'shape', shapes: [] },
    };
    const ref = typeof box.image === 'string' && box.image ? await host.assets.get(box.image) : box.image as AssetRef | undefined;
    if (ref?.id) {
      if (ref.type !== 'lottie' && ref.type !== 'raster') throw new Error(\`\${layer.name}: \${ref.type} media needs video export.\`);
      if (ref.meta?.animated) throw new Error(\`\${layer.name}: animated raster media needs video export.\`);
      if (num(box.strokeW) || !['', 'rect'].includes(String(box.shape ?? '')) || await paint(box.bg, host)) throw new Error(\`\${layer.name}: remove the media border, shape or background before dotLottie export.\`);
      if ((box.imgpos && box.imgpos !== 'center') || box.imageFraming) throw new Error(\`\${layer.name}: dotLottie requires centred media fitting.\`);
      if (!host.assets.bytes) throw new Error('This shell cannot read the source asset bytes for dotLottie export.');
      const bytes = await host.assets.bytes(ref);
      opts.signal?.throwIfAborted();
      const fit = box.fit === 'cover' ? 'cover' : 'contain';
      if (ref.type === 'lottie') layer.content = { kind: 'animation', animation: await applyLottieEdits(selectLottie(readLottie(bytes), String(box.animationId || ref.meta?.lottieAnimationId || '') || undefined).animation, String(box.animationEdits ?? '')), clipInMs: Math.round(clamp(num(box.clipIn), 0, 3600) * 1000), speed: Math.round(clamp(num(box.speed, 1), 0.25, 4) * 100) / 100, fit };
      else {
        const mime = lottieImageMime(bytes), size = imageDimensions(bytes, mime);
        if (!size || size.w * size.h > 32000000) throw new Error(\`\${layer.name}: unreadable image or image exceeds 32 million pixels.\`);
        layer.content = { kind: 'image', data: \`data:\${mime};base64,\${btoa(bytesToBin(bytes))}\`, width: size.w, height: size.h, fit };
      }
    } else layer.content = { kind: 'shape', shapes: await shapes(box, layer.w, layer.h, host) };
    layers.push(layer);
  }
  const fps = num(opts.fps, num(values.projectFps, 30));
  let animation = compileLottieSequence({ width, height, fps, durationMs, layers });
  const range = sequenceRange(parseSequenceMarks(values.sequenceMarks), durationMs);
  if (range.fromMs || range.toMs < durationMs) animation = compileLottieSequence({ width, height, fps, durationMs: range.toMs - range.fromMs, layers: [{ name: 'Sequence range', x: 0, y: 0, w: width, h: height, rotation: 0, opacity: 1, startMs: 0, durationMs: range.toMs - range.fromMs, content: { kind: 'animation', animation, clipInMs: range.fromMs, speed: 1, fit: 'contain' } }] });
  const extras = opts.rights ? attributionCompanion(opts.rights.plan).files.map(file => ({ name: file.name, bytes: new TextEncoder().encode(file.text) })) : [];
  if (opts.meta) extras.push({ name: 'lolly-metadata.json', bytes: new TextEncoder().encode(JSON.stringify(opts.meta)) });
  const bytes = writeDotLottie(animation, extras);
  if (opts.rights?.onReceipt) opts.rights.onReceipt(await checkCompanionReadback(bytes, opts.rights.plan, opts.rights.fingerprint));
  return new Blob([bytes as BlobPart], { type: 'application/zip+dotlottie' });
}
`;
assert.equal(createHash('sha256').update(legacySource).digest('hex'), '4a9568b6e878d6ebde8fe05cf75751426fd8cb8f68798d3b6504d78f5cb0059d', 'the retained legacy source is immutable');
const bundled = await build({ stdin: { contents: legacySource, resolveDir: fileURLToPath(new URL('../engine/src/', import.meta.url)), sourcefile: 'legacy-design-lottie.ts', loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const legacy = (await import(`data:text/javascript;base64,${Buffer.from(`${bundled.outputFiles![0]!.text}\n//# sourceURL=legacy-design-lottie-oracle.mjs`).toString('base64')}`)).exportDesignLottie as typeof exportDesignLottie;
function hostForTest(): HostV1 {
  const host = createMockHost();
  host.geom = makeGeomApi();
  host.tokens = { get: async () => createTokenSet({}), colors: async () => [], themes: async () => [],
    resolve: async value => value === '{color.semantic.primary}' ? '#3478cc80' : null };
  return host;
}
const path = encodeAuthoredPaths([{ kind: 'cubic', closed: true, nodes: [
  { x: 0.1234567, y: 0.2345678, hOutX: 0.1456789, hOutY: 0.1678912 },
  { x: 0.8765432, y: 0.7654321, hInX: -0.1789123, hInY: -0.1456789 },
  { x: 0.3, y: 0.8 },
] }, { kind: 'cubic', closed: false, nodes: [{ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.9 }] }] as never)!;
const rows: Record<string, unknown>[] = [
  { id: 'rect', kind: 'box', shape: 'rect', x: 0.4999, y: -0.5001, w: 80.49, h: 31.5, bg: '#34567880', opacity: '50%' },
  { id: 'rounded-default', kind: 'box', shape: 'rounded', w: 30, h: 20, stroke: '#0000ff80', strokeW: 5 },
  { id: 'rounded-large', kind: 'box', shape: 'rounded', radius: 100, w: 11, h: 7, bg: 'var(--brand-primary, #ff0000)' },
  { id: 'pill', kind: 'box', shape: 'pill', w: 9, h: 5, stroke: '#000', strokeW: 12, strokeCap: 'square', strokeJoin: 'bevel' },
  { id: 'ellipse', kind: 'box', shape: 'ellipse', w: 73, h: 49, bg: 'rgba(10, 20, 30, 0.2)', opacity: -5, rot: -12.345 },
  { id: 'circle', kind: 'box', shape: 'circle', w: 25, h: 20, stroke: '#fff', strokeW: -2, opacity: 130 },
  { id: 'paths', kind: 'path', path, w: 57, h: 29, x: 4.51, y: 7.4, bg: '#112233', stroke: '#556677', strokeW: 1.2, fillRule: 'evenodd' },
  { id: 'empty-path', kind: 'path', path: '', w: 10, h: 20, bg: '#f00', stroke: '#fff', strokeW: 1 },
  { id: 'hidden-off', kind: 'box', shape: '', w: 10, h: 10, bg: '#ff0000', hidden: 'off' },
];
function options(boxes: Record<string, unknown>[]): ExportOpts {
  return { width: 120, height: 80, sourceDocument: { toolId: 'design', values: { background: 'transparent', projectFps: 60, boxes } } };
}
async function animation(exporter: typeof exportDesignLottie, boxes: Record<string, unknown>[], host = hostForTest()) {
  return readLottie(new Uint8Array(await (await exporter(options(boxes), host)).arrayBuffer())).animations[0]!.animation;
}
test('retained legacy oracle characterizes exact native vector output and rejects meaningful mutations', async () => {
  const expected = await animation(legacy, rows);
  const actual = await animation(exportDesignLottie, rows);
  assert.deepEqual(actual, expected);
  for (const field of ['geometry', 'paint', 'contour', 'opacity']) {
    const changed = structuredClone(expected);
    if (field === 'geometry') (((changed.layers[0]!.shapes as LottieObject[])[0]!.p as { k: number[] }).k)[0]! += 1;
    if (field === 'paint') (((changed.layers[0]!.shapes as LottieObject[])[1]!.c as { k: number[] }).k)[0] = 0;
    if (field === 'contour') (changed.layers.find(layer => layer.nm === 'paths')!.shapes as LottieObject[]).splice(0, 1);
    if (field === 'opacity') ((changed.layers[0]!.ks as LottieObject).o as { k: number }).k = 49;
    assert.throws(() => assert.deepEqual(changed, expected), field);
  }
});
test('legacy exact admission preserves hidden rows, malformed paths, shape errors and geometry refusals', async () => {
  for (const boxes of [
    [{ id: 'bad-path', kind: 'path', path: '%not-an-authored-path', w: 20, h: 20 }],
    [{ id: 'bad-shape', kind: 'box', shape: 'polygon', w: 20, h: 20 }],
    [{ id: 'bad-colour', kind: 'box', bg: 'not-a-colour', w: 20, h: 20 }],
    [{ id: 'text', kind: 'text', text: 'Hi', w: 20, h: 20 }],
    [{ id: 'independent', kind: 'path', pathPaint: '{"version":1}', w: 20, h: 20 }],
  ]) {
    const message = async (exporter: typeof exportDesignLottie) => {
      try { await exporter(options(boxes), hostForTest()); return 'unexpected success'; } catch (error) { return (error as Error).message; }
    };
    const expected = await message(legacy);
    assert.notEqual(expected, 'unexpected success');
    assert.equal(await message(exportDesignLottie), expected);
  }
  const hidden = [{ id: 'bad-shape', kind: 'box', shape: 'polygon', hidden: true, w: 20, h: 20 }];
  assert.deepEqual(await animation(exportDesignLottie, hidden), await animation(legacy, hidden));
  for (const missing of [false, true]) {
    const makeHost = () => {
      const host = hostForTest();
      if (missing) delete host.geom;
      else host.geom!.fromNodes = () => ({ ok: false, code: 'invalid-argument', message: 'owned geometry refusal' });
      return host;
    };
    const boxes = [{ id: 'refused', kind: 'path', path, w: 20, h: 20 }];
    let expected = '';
    try { await legacy(options(boxes), makeHost()); } catch (error) { expected = (error as Error).message; }
    assert.ok(expected);
    await assert.rejects(exportDesignLottie(options(boxes), makeHost()), { message: expected });
  }
});


test('the consumer reads only evaluated commands and paints, and refuses another reading or unsupported operations', () => {
  const row = { id: 'native', kind: 'box', shape: 'rounded', radius: 16, w: 20, h: 10, strokeW: 4 };
  const op = compileDesignRow(row, { x: 0, y: 0 }, { semantics: 'lottie-compat', lottieCompat: { fill: [1, 0, 0, 0.5], stroke: [0, 0, 1, 1] } }) as DrawShapeOp;
  const output = designDrawLottie(op), before = structuredClone(op);
  assert.deepEqual(op, before);
  row.radius = 200;
  assert.deepEqual(designDrawLottie(op), output, 'authored edits cannot change a frozen evaluation');
  const changed = structuredClone(op);
  if (changed.shape.kind === 'rect') changed.shape.radius += 1;
  assert.notDeepEqual(designDrawLottie(changed), output, 'the compiled geometry controls the result');
  assert.throws(() => designDrawLottie(compileDesignRow(row, { x: 0, y: 0 }) as DrawShapeOp), /named native-vector compatibility reading/);
  assert.throws(() => designDrawLottie({ ...op, blur: 1 }), /unsupported content/);
  assert.throws(() => designDrawLottie({ ...op, fills: [{ kind: 'radial', stops: [] }] }), /must be solid/);
  assert.throws(() => compileDesignRow(row, { x: 0, y: 0 }, { semantics: 'lottie-compat', lottieCompat: { fill: [NaN, 0, 0, 1], stroke: null } }), /resolved sRGB paint/);
  assert.throws(() => compileDesignRow({ ...row, text: 'cannot disappear' }, { x: 0, y: 0 }, { semantics: 'lottie-compat', lottieCompat: { fill: null, stroke: null } }), /text is not supported/);
});
test('custom geometry retains exact move-only and cubic command streams without a second path lowering', async () => {
  for (const d of ['M1.125 2.375', 'M0 0L1.111 2.222C1.222 2.333 1.777 2.999 3.001 4.002Z']) {
    const makeHost = () => {
      const host = hostForTest();
      host.geom!.fromNodes = () => ({ ok: true, d, contours: 1, curves: 1 });
      return host;
    };
    const boxes = [{ id: 'custom', kind: 'path', path, w: 20, h: 10, bg: '#123456', x: 100.2, y: -15.1 }];
    assert.deepEqual(await animation(exportDesignLottie, boxes, makeHost()), await animation(legacy, boxes, makeHost()));
  }
});
test('native shape coercion, empty paths and opaque frame membership preserve legacy outcomes', async () => {
  const boxes = [
    { id: 'frame', kind: 'frame', x: 12.6, y: -4.6, w: 120, h: 80, bg: '#12345680' },
    { id: 'array-shape', kind: 'box', shape: ['ellipse'], x: true, y: '', w: 10, h: 6, bg: '#f00', frame: 'frame', opacity: '50%' },
    { id: 'rounded', kind: 'box', shape: 'rounded', x: -0.1, w: 10, h: 6, radius: -5, stroke: '#fff', strokeW: 100, frame: 'frame' },
    { id: 'orphan', kind: 'box', shape: 'polygon', frame: 'other', w: 20, h: 20 },
    { id: 'empty', kind: 'path', path: '', bg: '#123456', frame: 'frame', w: 10, h: 10 },
  ];
  assert.deepEqual(await animation(exportDesignLottie, boxes), await animation(legacy, boxes));
});


test('a deterministic vector corpus retains exact legacy animation bytes after decoding', async () => {
  let state = 0x295e1;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const shapes = ['rect', 'rounded', 'pill', 'circle', 'ellipse', ''];
  const corpus = Array.from({ length: 180 }, (_, index) => ({
    id: `native-${index}`, kind: 'box', shape: shapes[index % shapes.length],
    x: random() * 100 - 20, y: random() * 100 - 20, w: random() * 80, h: random() * 80,
    bg: index % 3 ? `rgba(${index}, 34, 87, 0.1234567)` : 'transparent',
    stroke: index % 4 ? '#55779980' : 'none', strokeW: random() * 15 - 3,
    radius: index % 3 === 0 ? '' : random() * 100 - 10, opacity: index % 9 === 0 ? '50%' : random() * 150 - 20,
    rot: random() * 120 - 60, fillRule: index % 2 ? 'evenodd' : 'nonzero',
    strokeCap: ['butt', 'round', 'square', 'other'][index % 4], strokeJoin: ['miter', 'round', 'bevel', 'other'][index % 4],
  }));
  for (const kind of ['line', 'cubic', 'catmull-rom', 'bspline']) {
    const curve = encodeAuthoredPaths([{ kind, closed: true, nodes: [
      { x: 0.1234567, y: 0.2345678 }, { x: 0.8765432, y: 0.7654321 }, { x: 0.3, y: 0.8 }, { x: 0.05, y: 0.4 },
    ] }] as never)!;
    const box = { id: kind, kind: 'path', path: curve, w: 37.5, h: 25.4, stroke: '#12345680', strokeW: 2.5, bg: '#fedcba', fillRule: 'evenodd' };
    assert.deepEqual(await animation(exportDesignLottie, [box]), await animation(legacy, [box]), kind);
  }
  assert.deepEqual(await animation(exportDesignLottie, corpus), await animation(legacy, corpus));
});


test('each authored contour uses the existing geometry authority once, before emission', async () => {
  const host = hostForTest(), geometry = host.geom!;
  const lower = geometry.fromNodes;
  let calls = 0;
  geometry.fromNodes = source => { calls++; assert.equal(source.decimals, 3); return lower(source); };
  await animation(exportDesignLottie, [{ id: 'two-contours', kind: 'path', path, w: 40, h: 20, bg: '#f00' }], host);
  assert.equal(calls, 2);
});
