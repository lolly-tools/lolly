// SPDX-License-Identifier: MPL-2.0
/** Compile a frozen, resolved linear sequence without a player or a DOM. */
import { evaluateKf, kfChannelsUsed, kfEaseIsSpring, kfEasePoints, kfPathCurves, parseKf, type KfChannel, type KfTrack } from './keyframes.ts';
import { kfExportKeys } from './kf-bake.ts';
import { isKfLookChannel } from './kf-look.ts';
import { lookFeatureName } from './lottie-look.ts';
import { admitLottieAnimation, lottieNumber, lottieObject, type LottieAnimation, type LottieObject, type LottieValue } from './lottie-model.ts';
import { independentLottieAxes, separateLottiePosition } from './lottie-properties.ts';

export interface LottieSequenceLayer {
  name: string; x: number; y: number; w: number; h: number;
  rotation: number; opacity: number; startMs: number; durationMs: number;
  kf?: string;
  content: { kind: 'animation'; animation: LottieAnimation; clipInMs: number; speed: number; fit: 'contain' | 'cover' }
    | { kind: 'shape'; shapes: LottieObject[] }
    | { kind: 'image'; data: string; width: number; height: number; fit: 'contain' | 'cover' };
}
export interface LottieSequence {
  width: number; height: number; fps: number; durationMs: number;
  /** Back to front, matching the editor's paint order. */
  layers: LottieSequenceLayer[];
}
export const lottieStatic = (value: LottieValue): LottieObject => ({ a: 0, k: value });
export function lottieTransform(x = 0, y = 0): LottieObject {
  return { a: lottieStatic([0, 0, 0]), p: lottieStatic([x, y, 0]), s: lottieStatic([100, 100, 100]), r: lottieStatic(0), o: lottieStatic(100) };
}
/** Frame-domain values change rate; time-remap values remain seconds. */
export function retimeLottie(source: LottieAnimation, fps: number, prefix: string): LottieAnimation {
  const copy = structuredClone(source);
  const ratio = fps / source.fr;
  const ids = new Map((copy.assets ?? []).map((asset, index) => [String(asset.id), `${prefix}-asset-${index}`]));
  function properties(object: LottieObject): void {
    if (object.a === 1 && Array.isArray(object.k)) for (const item of object.k) {
      const key = lottieObject(item, 'Lottie keyframe');
      if (typeof key.t === 'number') key.t *= ratio;
    }
    for (const child of Object.values(object)) {
      if (Array.isArray(child)) for (const item of child) {
        if (item && typeof item === 'object' && !Array.isArray(item)) properties(item);
      }
      else if (child && typeof child === 'object') properties(child);
    }
  }
  function layers(list: LottieObject[]): void {
    for (const layer of list) {
      for (const key of ['ip', 'op', 'st']) if (typeof layer[key] === 'number') layer[key] *= ratio;
      if (typeof layer.refId === 'string') layer.refId = ids.get(layer.refId) ?? layer.refId;
      const transform = layer.ks as LottieObject | undefined;
      if (transform?.p) transform.p = separateLottiePosition(transform.p as LottieObject);
      for (const [key, name] of [['a', 'anchor'], ['s', 'scale']]) {
        if (transform?.[key!] && independentLottieAxes(transform[key!] as LottieObject)) throw new Error(`${layer.nm ?? 'Layer'}: independent ${name} axis curves are not portable across dotLottie players. Use matching axis curves or movie export.`);
      }
      properties(layer);
    }
  }
  layers(copy.layers);
  for (const asset of copy.assets ?? []) {
    asset.id = ids.get(String(asset.id))!;
    if (Array.isArray(asset.layers)) layers(asset.layers as LottieObject[]);
    if (typeof asset.fr === 'number') asset.fr = fps;
  }
  copy.ip *= ratio; copy.op *= ratio; copy.fr = fps;
  // Source markers are not sequence markers and do not affect the picture.
  delete copy.markers;
  return copy;
}
function channel(track: KfTrack, key: KfChannel, fps: number, startMs: number, base: number, multiplier = 1, replace = false): LottieObject {
  // Springs are baked into frame keys and design-system eases resolved (plans/329); every
  // other key is the authored one, at the same frame as before.
  const keys = kfExportKeys(track, key, fps, startMs);
  if (!keys.length) return lottieStatic(base);
  const value = (n: number) => replace ? n * multiplier : base + n * multiplier;
  return { a: 1, k: keys.map((item, index) => {
    const next = keys[index + 1];
    const points = key === 'o' ? [0, 0, 1, 1] : kfEasePoints(item.ease) ?? [0, 0, 1, 1];
    return {
      t: item.f, s: [value(item.v)],
      ...(next ? { e: [value(next.v)], ...(item.ease === 'eh' ? { h: 1 } : { o: { x: points[0]!, y: points[1]! }, i: { x: points[2]!, y: points[3]! } }) } : {}),
    };
  }) };
}
/**
 * Position as ONE property with native spatial tangents (plans/330), for a track whose
 * travel curves. Lottie can only carry `to`/`ti` on a combined position, so the curve
 * needs x and y keyed together; a track that keys them apart is refused with the layer's
 * name. A straight segment carries no tangents, so it interpolates per axis exactly as the
 * separate properties did. Players walk a curve by arc length and hold at its ends, so a
 * curved segment whose ease leaves the 0 to 1 range is written one key per frame instead,
 * the way a keyed colour is: the file then carries Lolly's own travel frame by frame. A
 * spring segment (plans/329), curved or straight, is written frame by frame the same way,
 * since no bezier carries it; a design-system ease writes the curve its token has now.
 */
function pathPosition(layer: LottieSequenceLayer, track: KfTrack, fps: number): LottieObject {
  const bx = layer.x + layer.w / 2, by = layer.y + layer.h / 2;
  const keys = track.map((key, index) => ({ key, index })).filter(({ key }) => key.v.x !== undefined || key.v.y !== undefined);
  if (keys.some(({ key }) => key.v.x === undefined || key.v.y === undefined)) {
    throw new Error(`${layer.name}: a curved motion path in dotLottie needs x and y keyed together. Key both on each position keyframe, or use video export.`);
  }
  const curves = kfPathCurves(track);
  const frame = (ms: number) => (layer.startMs + ms) * fps / 1000;
  const at = (ms: number): number[] => {
    const p = evaluateKf(track, ms, ['x', 'y']);
    return [bx + (p.x ?? 0), by + (p.y ?? 0), 0];
  };
  const out: LottieObject[] = [];
  keys.forEach(({ key, index }, n) => {
    const s = [bx + key.v.x!, by + key.v.y!, 0];
    const next = keys[n + 1];
    if (!next) { out.push({ t: frame(key.t), s }); return; }
    const e = [bx + next.key.v.x!, by + next.key.v.y!, 0];
    if (key.ease === 'eh') { out.push({ t: frame(key.t), s, e, h: 1 }); return; }
    const points = kfEasePoints(key.ease) ?? [0, 0, 1, 1];
    const curved = curves.get(index) === next.index;
    if (kfEaseIsSpring(key.ease) || (curved && [points[1]!, points[3]!].some(y => y < 0 || y > 1))) {
      const times = [key.t];
      for (let f = Math.floor(frame(key.t)) + 1; f < frame(next.key.t); f++) times.push(f * 1000 / fps - layer.startMs);
      times.forEach((ms, j) => {
        const to = times[j + 1];
        out.push({ t: frame(ms), s: at(ms), e: to === undefined ? e : at(to), o: { x: 0, y: 0 }, i: { x: 1, y: 1 } });
      });
      return;
    }
    out.push({
      t: frame(key.t), s, e, o: { x: points[0]!, y: points[1]! }, i: { x: points[2]!, y: points[3]! },
      ...(curved ? { to: [key.ho?.[0] ?? 0, key.ho?.[1] ?? 0, 0], ti: [next.key.hi?.[0] ?? 0, next.key.hi?.[1] ?? 0, 0] } : {}),
    });
  });
  return { a: 1, k: out };
}
function pose(layer: LottieSequenceLayer, fps: number): LottieObject {
  const track = parseKf(layer.kf);
  // Appearance keys (plans/328) are written into a shape layer's own shapes by
  // `animateLottieLook`; on a picture or a Lottie clip there is nothing to colour or trim.
  const used = kfChannelsUsed(track);
  const look = used.filter(key => isKfLookChannel(key));
  if (look.length && layer.content.kind !== 'shape') {
    throw new Error(`${layer.name}: dotLottie cannot animate the ${[...new Set(look.map(lookFeatureName))].join(', ')} of an image or animation clip. Use video export.`);
  }
  const unsupported = used.filter(key => !['x', 'y', 's', 'r', 'o'].includes(key) && !isKfLookChannel(key));
  if (unsupported.length) throw new Error(`${layer.name}: dotLottie does not support outer ${unsupported.join(', ')} keys. Use video export.`);
  const scale = channel(track, 's', fps, layer.startMs, 100, 100, true);
  if (scale.a === 1 && Array.isArray(scale.k)) for (const item of scale.k) {
    const key = item as LottieObject;
    for (const field of ['s', 'e']) if (Array.isArray(key[field])) key[field] = [key[field][0]!, key[field][0]!, 100];
  } else scale.k = [100, 100, 100];
  return {
    a: lottieStatic([layer.w / 2, layer.h / 2, 0]),
    p: kfPathCurves(track).size
      ? pathPosition(layer, track, fps)
      : { s: true, x: channel(track, 'x', fps, layer.startMs, layer.x + layer.w / 2), y: channel(track, 'y', fps, layer.startMs, layer.y + layer.h / 2), z: lottieStatic(0) },
    s: scale, r: channel(track, 'r', fps, layer.startMs, layer.rotation),
    o: channel(track, 'o', fps, layer.startMs, layer.opacity * 100, 100, true),
  };
}
export function compileLottieSequence(snapshot: LottieSequence): LottieAnimation {
  const w = lottieNumber(snapshot.width, 'Sequence width', 1, 16384);
  const h = lottieNumber(snapshot.height, 'Sequence height', 1, 16384);
  const fr = lottieNumber(snapshot.fps, 'Sequence frame rate', 1, 240);
  const duration = lottieNumber(snapshot.durationMs, 'Sequence duration', 1, 3600000);
  const op = duration * fr / 1000;
  if (snapshot.layers.length > 1000) throw new Error('dotLottie: sequence layer limit exceeded.');
  const assets: LottieObject[] = [], layers: LottieObject[] = [];
  let resourceBytes = 0;
  snapshot.layers.forEach((layer, index) => {
    for (const field of ['x', 'y', 'rotation'] as const) lottieNumber(layer[field], `${layer.name} ${field}`, -100000, 100000);
    for (const field of ['w', 'h'] as const) lottieNumber(layer[field], `${layer.name} ${field}`, 0.01, 16384);
    lottieNumber(layer.opacity, `${layer.name} opacity`, 0, 1);
    lottieNumber(layer.startMs, `${layer.name} start`, 0, 3600000);
    lottieNumber(layer.durationMs, `${layer.name} duration`, 1, 3600000);
    const prefix = `clip-${index}`;
    const ip = layer.startMs * fr / 1000, end = Math.min(op, (layer.startMs + layer.durationMs) * fr / 1000);
    const content = layer.content;
    resourceBytes += JSON.stringify(content).length;
    if (resourceBytes > 128 * 1024 * 1024) throw new Error('dotLottie: composed resources exceed 128 MiB. Shorten the sequence or use smaller sources.');
    if (content.kind === 'shape') {
      layers.unshift({ ty: 4, ind: index + 1, nm: layer.name, ip, op: end, st: 0, ks: pose(layer, fr), shapes: structuredClone(content.shapes) });
      return;
    }
    let inner: LottieObject;
    {
      const width = content.kind === 'animation' ? content.animation.w : content.width;
      const height = content.kind === 'animation' ? content.animation.h : content.height;
      const factor = (content.fit === 'cover' ? Math.max : Math.min)(layer.w / width, layer.h / height);
      const transform = lottieTransform((layer.w - width * factor) / 2, (layer.h - height * factor) / 2);
      transform.s = lottieStatic([factor * 100, factor * 100, 100]);
      if (content.kind === 'animation') {
        lottieNumber(content.clipInMs, `${layer.name} trim`, 0, 3600000);
        lottieNumber(content.speed, `${layer.name} speed`, 0.25, 4);
        const source = retimeLottie(content.animation, fr, prefix);
        assets.push(...source.assets ?? [], { id: `${prefix}-source`, w: source.w, h: source.h, layers: source.layers });
        const first = content.animation.ip / content.animation.fr + content.clipInMs / 1000;
        const sourceEnd = content.animation.op / content.animation.fr;
        if (first + layer.durationMs * content.speed / 1000 > sourceEnd + 0.001) throw new Error(`${layer.name}: clip extends past the source animation. Trim its duration before dotLottie export.`);
        inner = { ty: 0, ind: 1, refId: `${prefix}-source`, w: width, h: height, ip: 0, op, st: 0, sr: 1, ks: transform,
          tm: { a: 1, k: [{ t: ip, s: [first], e: [first + layer.durationMs * content.speed / 1000], o: { x: 0, y: 0 }, i: { x: 1, y: 1 } }, { t: (layer.startMs + layer.durationMs) * fr / 1000, s: [first + layer.durationMs * content.speed / 1000] }] } };
      } else {
        assets.push({ id: `${prefix}-image`, w: width, h: height, p: content.data, u: '', e: 1 });
        inner = { ty: 2, ind: 1, refId: `${prefix}-image`, ip: 0, op, st: 0, ks: transform };
      }
    }
    assets.push({ id: prefix, w: layer.w, h: layer.h, layers: [inner] });
    layers.unshift({ ty: 0, ind: index + 1, nm: layer.name, refId: prefix, w: layer.w, h: layer.h, ip, op: end, st: 0, sr: 1, ks: pose(layer, fr) });
  });
  return admitLottieAnimation({ v: '5.13.0', nm: 'Lolly Sequence', ddd: 0, w, h, fr, ip: 0, op, assets, layers });
}
