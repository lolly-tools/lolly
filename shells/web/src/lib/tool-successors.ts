// SPDX-License-Identifier: MPL-2.0
/**
 * Where a retired tool's work continues. A retired tool keeps its id and keeps opening
 * (a tool id is a permanent contract), and its manifest gives its successor in
 * `replacedBy`. This module answers the address of that successor, with what the person
 * had in the old tool carried across where the two tools' inputs can be matched.
 *
 * A tool with no entry here opens its successor at the successor's own start.
 */

type Values = Record<string, unknown>;
type Carry = (values: Values) => Values;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Meeting Planner into Timezone: each teammate becomes a place labelled with their
 * name, the host city leads the list and is the clock the meeting time is read on,
 * and the early and late hours stay marked, as Meeting Planner always drew them.
 * Pure, exported for tests.
 */
export function meetingPlannerToTimezone(values: Values): Values {
  const host = text(values.city);
  const people = (Array.isArray(values.people) ? values.people : [])
    .map((row) => ({ label: text((row as Values | null)?.name), place: text((row as Values | null)?.city) }))
    .filter((row) => row.place);
  const locations = [
    ...(host && !people.some((row) => row.place.toLowerCase() === host.toLowerCase()) ? [{ label: '', place: host }] : []),
    ...people,
  ];
  const when = text(values.meetingTime);
  const live = values.liveClock === true || values.liveClock === 'true';
  return {
    ...(locations.length ? { locations } : {}),
    ...(text(values.eventName) ? { heading: text(values.eventName) } : {}),
    ...(when && !live ? { timeMode: 'fixed', eventTime: when } : {}),
    ...(host ? { referenceZone: host } : {}),
    showHourQuality: true,
    ...(typeof values.showNight === 'boolean' ? { showNight: values.showNight } : {}),
    ...(typeof values.showBorders === 'boolean' ? { showBorders: values.showBorders } : {}),
    ...(typeof values.showGraticule === 'boolean' ? { showGrid: values.showGraticule } : {}),
  };
}

const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A card's initials, as Flow Chart drew them: the first and last word of its first line. */
function initialsOf(textValue: string): string {
  const first = (textValue.split('\n')[0] ?? '').replace(/\{[^|{}]*\|/g, '').replace(/[{}*_]/g, '').trim();
  const words = first.split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return ((words[0]![0] ?? '') + (words.length > 1 ? words[words.length - 1]![0] ?? '' : '')).toUpperCase();
}

/** Dark or light ink for a colour: read from a hex, or from the hex a `var()` falls back to. */
function inkOn(color: string): string {
  const hex = /#([0-9a-f]{6})\b/i.exec(color)?.[1];
  if (!hex) return '#0c322c';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 150 ? '#0c322c' : '#ffffff';
}

/**
 * Flow Chart into Design. The two tools keep the same kind of document (a list of
 * boxes, with connectors as paths bound to boxes by id), so text, shapes, pictures and
 * connectors travel as they are. Flow Chart's one kind of its own is the card: a
 * ground, a picture or initials, and words, drawn as one box. In Design a card is those
 * three parts in a group, set out by Flow Chart's own measurements, and the ground
 * keeps the card's id so every connector stays attached. The layers arrive loose on a
 * canvas the size of Flow Chart's, with no artboard, because that is the arrangement in
 * which Design draws a connector between two boxes. Pure, exported for tests.
 */
export function flowChartToDesign(values: Values): Values {
  const rows = (Array.isArray(values.boxes) ? values.boxes : []).filter((row): row is Values => !!row && typeof row === 'object');
  const boxes: Values[] = [];
  for (const row of rows) {
    const kind = text(row.kind) || 'card';
    if (kind !== 'card') {
      // Design's `layout` is a different setting (flex and grid), so the card layout goes.
      const { layout: _layout, accent: _accent, ...rest } = row;
      boxes.push({ ...rest, kind });
      continue;
    }
    const id = text(row.id) || `card-${boxes.length}`;
    const group = `${id}-card`;
    const x = num(row.x, 0), y = num(row.y, 0), w = Math.max(1, num(row.w, 1)), h = Math.max(1, num(row.h, 1));
    const pad = Math.round(clamp(num(row.pad, 16), 0, 400));
    const gap = clamp(Math.round(pad * 0.9), 6, 20);
    const layout = ['row', 'icon', 'stacked', 'plain'].includes(text(row.layout)) ? text(row.layout) : 'row';
    const accent = text(row.accent) || '#30ba78';
    const image = row.image && typeof row.image === 'object' ? row.image : null;
    const words = typeof row.text === 'string' ? row.text : '';
    const part = { rot: num(row.rot, 0), group };
    boxes.push({ id: group, kind: 'group', name: initialsOf(words) ? (words.split('\n')[0] ?? '').replace(/\{[^|{}]*\||[{}]/g, '') : 'Card', x, y, w, h, rot: 0 });
    // The ground keeps the card's id: connectors are bound to that id.
    boxes.push({
      id, kind: 'box', x, y, w, h, ...part, shape: text(row.shape) || 'rounded', radius: num(row.radius, 12), bg: text(row.bg),
      ...(row.opacity !== undefined ? { opacity: row.opacity } : {}),
      ...(row.shadow ? { shadow: row.shadow, shadowColor: row.shadowColor, shadowX: row.shadowX, shadowY: row.shadowY, shadowBlur: row.shadowBlur } : {}),
    });
    // Where the picture or the initials sit, by the card's layout.
    let media: { x: number; y: number; w: number; h: number; shape: string; radius: number } | null = null;
    let wordsBox = { x: x + pad, y: y + pad, w: Math.max(1, w - 2 * pad), h: Math.max(1, h - 2 * pad) };
    if (layout === 'plain') {
      if (image) boxes.push({ id: `${id}-picture`, kind: 'image', x, y, w, h, ...part, image, fit: text(row.fit) || 'cover', shape: text(row.shape) || 'rounded', radius: num(row.radius, 12) });
    } else if (layout === 'stacked') {
      const bandH = clamp(Math.round((h - 2 * pad) * 0.55), 36, Math.max(36, h - 2 * pad - 24));
      media = { x: x + pad, y: y + pad, w: Math.max(1, w - 2 * pad), h: bandH, shape: 'rounded', radius: Math.round(clamp(num(row.radius, 12), 0, 60) * 0.7) };
      wordsBox = { x: x + pad, y: y + pad + bandH + gap, w: Math.max(1, w - 2 * pad), h: Math.max(1, h - 2 * pad - bandH - gap) };
    } else {
      const side = layout === 'icon' ? clamp(Math.min(h - 2 * pad, 56), 20, 72) : clamp(h - 2 * pad, 24, Math.min(h, Math.floor(w * 0.5)));
      media = { x: x + pad, y: y + Math.round((h - side) / 2), w: side, h: side, shape: layout === 'icon' ? 'rounded' : 'ellipse', radius: layout === 'icon' ? Math.round(side * 0.28) : 0 };
      wordsBox = { x: x + pad + side + gap, y: y + pad, w: Math.max(1, w - 2 * pad - side - gap), h: Math.max(1, h - 2 * pad) };
    }
    if (media && image) {
      boxes.push({ id: `${id}-picture`, kind: 'image', ...media, ...part, image, fit: layout === 'icon' ? text(row.fit) || 'contain' : 'cover' });
    } else if (media) {
      boxes.push({ id: `${id}-mark`, kind: 'box', ...media, ...part, bg: accent });
      const initials = initialsOf(words);
      if (initials) boxes.push({
        id: `${id}-initials`, kind: 'text', x: media.x, y: media.y, w: media.w, h: media.h, ...part, text: initials, fg: inkOn(accent),
        fontSize: Math.round(media.h * 0.42), align: 'center', valign: 'middle', weight: '600', font: text(row.font) || 'sans', pad: 0,
      });
    }
    if (words) boxes.push({
      id: `${id}-words`, kind: 'text', ...wordsBox, ...part, text: words, fg: text(row.fg), fontSize: num(row.fontSize, 30),
      align: text(row.align) || 'left', valign: layout === 'stacked' ? 'top' : text(row.valign) || 'middle', weight: text(row.weight) || '500',
      font: text(row.font) || 'sans', lineHeight: num(row.lineHeight, 1.15), pad: 0,
      ...(row.tracking !== undefined ? { tracking: row.tracking } : {}),
    });
  }
  // Connectors go under the cards in the layer order. A bound line is painted in its own
  // layer whatever its place in the list, but its box spans both of its cards, and on
  // top that box took the press meant for a card.
  const bound = (row: Values): boolean => row.kind === 'path' && (text(row.bindStart) !== '' || text(row.bindEnd) !== '');
  const ordered = [...boxes.filter(bound), ...boxes.filter((row) => !bound(row))];
  return { boxes: ordered, ...(text(values.background) ? { background: values.background } : {}), width: 1600, height: 1000 };
}

/** Voice Recorder's two card styles, as the ground and text colours its stylesheet drew. */
const VOICE_CARD: Record<string, { bg: string; ink: string }> = {
  dark: { bg: '#11141f', ink: '#fafbfe' },
  light: { bg: '#fafbfe', ink: '#11141f' },
};

/**
 * Voice Recorder into Audiogram. The name becomes the card's title, the card style
 * becomes Audiogram's background and text colours, a chosen accent becomes the
 * visualiser colour, and the two coaching choices keep their ids. An accent left empty
 * stays empty, so Audiogram draws its own default from the design system. A take that
 * was recorded and not saved is not a value and does not travel. Pure, exported for tests.
 */
export function voiceRecorderToAudiogram(values: Values): Values {
  const card = VOICE_CARD[text(values.theme) || 'dark'];
  const target = text(values.targetLevel);
  const tips = values.showTips === 'true' ? true : values.showTips === 'false' ? false : values.showTips;
  return {
    ...(text(values.title) ? { title: text(values.title) } : {}),
    ...(card ? { bg: card.bg, ink: card.ink } : {}),
    ...(text(values.accent) ? { accent: text(values.accent) } : {}),
    ...(['soft', 'normal', 'loud'].includes(target) ? { targetLevel: target } : {}),
    ...(typeof tips === 'boolean' ? { showTips: tips } : {}),
  };
}

const record = (value: unknown): Values => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : {});
const flag = (value: unknown, fallback: boolean): boolean =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : fallback;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const degrees = (rad: number): number => (rad * 180) / Math.PI;
/** An angle folded into -180 to 180, the range 3D Studio's sliders hold. */
const fold180 = (angle: number): number => round3(((((angle + 180) % 360) + 360) % 360) - 180);

const fields = (id: string, group: Record<string, number>): Values =>
  Object.fromEntries(Object.entries(group).map(([field, value]) => [`${id}.${field}`, value]));

/** The longest side a model is drawn at in 3D Studio, in studio units. */
const STUDIO_SPAN = 3.25;
/** How far 3D Studio's camera stands from its target at zoom 1. */
const STUDIO_DISTANCE = 11.3;
/**
 * The height of each 3D sample model as a share of its longest side, measured from the
 * file. 3D aimed its camera at the middle of the model; 3D Studio stands the model on the
 * floor and aims at a height, so the height is what places the target.
 */
export const THREE_D_SAMPLE_HEIGHT: Record<string, number> = { duck: 0.8954, cat: 0.5691 };

/**
 * 3D's seven lighting scenes as the nearest 3D Studio settings. 3D Studio has four rigs
 * of three lights and no hemisphere light or coloured point lights, so none of these is
 * the same picture; each keeps what its scene was known for.
 */
export const THREE_D_SCENES: Record<string, Values> = {
  // Low contrast with a bright fill: Soft cuts the key and lifts the fill.
  'soft-glow': { studio: 'soft', environment: 'room' },
  // One white key and an even fill: Dramatic with the contrast turned well down.
  plain: { studio: 'dramatic', drama: 0.35, environment: 'room' },
  // A warm sun under a cool sky: Warm tints the key, and the window environment is daylight.
  natural: { studio: 'warm', drama: 0.5, environment: 'window' },
  // A strong key with a clear fill and bright reflections: little contrast, softbox panels.
  'bright-studio': { studio: 'dramatic', drama: 0.15, environment: 'softbox' },
  // A hard key over a dark room: the most contrast Dramatic has. Its blue fill is not kept.
  'serious-studio': { studio: 'dramatic', drama: 1, environment: 'room' },
  // Coloured lights on a gradient: Electric is the one rig with a coloured fill. The magenta light is not kept.
  'fun-gradient': { studio: 'electric', drama: 0.4, environment: 'room' },
  // A green key: Dramatic with the key light in the same green.
  'suse-green': { studio: 'dramatic', drama: 0.5, environment: 'room', keyColor: '#8ff0c0' },
};

/** 3D turned a model yaw first, then pitch, then roll; 3D Studio turns x, then y, then z. The same pose in 3D Studio's order. */
export function threeDRotation(pitch: number, yaw: number, roll: number): { x: number; y: number; z: number } {
  const [cx, sx, cy, sy, cz, sz] = [pitch, yaw, roll].flatMap((angle) => [Math.cos(radians(angle)), Math.sin(radians(angle))]) as [number, number, number, number, number, number];
  const m11 = cy * cz + sy * sx * sz, m12 = sy * sx * cz - cy * sz, m13 = sy * cx;
  const m22 = cx * cz, m23 = -sx, m32 = sy * sz + cy * sx * cz, m33 = cy * cx;
  const y = Math.asin(clamp(m13, -1, 1));
  const free = Math.abs(m13) < 0.9999999;
  const x = free ? Math.atan2(-m23, m33) : Math.atan2(m32, m22);
  const z = free ? Math.atan2(-m12, m11) : 0;
  // Adding zero turns a negative zero into zero, so a model that was not turned carries 0.
  return { x: round3(degrees(x)) + 0, y: round3(degrees(y)) + 0, z: round3(degrees(z)) + 0 };
}

/**
 * 3D into 3D Studio. Only a sample model travels: an uploaded model lived in memory and
 * was never part of a saved document. The camera is carried as the place it stood, worked
 * out from the two tools' own framing rules (3D stood `0.8 * size / tan(fov / 2) / zoom`
 * from the model, 3D Studio stands `11.3 / zoom` from its target, and both draw a model
 * 3.25 studio units across here). Every camera move but the whole turn becomes camera
 * keys, because keys can hold 3D's exact start and end views where 3D Studio's own moves
 * travel different distances. The lighting scene becomes the nearest rig
 * (`THREE_D_SCENES`). Pure, exported for tests.
 */
export function threeDToStudio(values: Values): Values {
  const sample = text(values.model) === 'cat' ? 'cat' : 'duck';
  const cam = record(values.camera), rot = record(values.modelRotate), mov = record(values.modelTranslate);
  const scale = clamp(num(record(values.modelScale).scale, 1), 0.1, 5);
  const baseFov = clamp(num(cam.fov, 45), 20, 90);
  const lens = (fov: number): number => round3(clamp(fov, 15, 80));
  // The camera keeps its distance: 3D measured it with the pose's own lens, whatever a key's lens was.
  const zoomOf = (zoom: number): number =>
    round3(clamp((STUDIO_DISTANCE * Math.tan(radians(baseFov) / 2) * Math.max(0.1, zoom)) / (0.8 * STUDIO_SPAN), 0.05, 3));
  const panOf = (pan: number): number => round3(clamp(pan, -1, 1) * STUDIO_SPAN * 0.5);
  const targetY = round3((STUDIO_SPAN * THREE_D_SAMPLE_HEIGHT[sample]! * scale) / 2);
  const base = {
    azimuth: fold180(num(cam.rotation, 35)),
    elevation: round3(clamp(num(cam.tilt, 12), -60, 80)),
    fov: lens(baseFov),
    zoom: zoomOf(num(cam.zoom, 1.3)),
    pan: panOf(num(cam.pan, 0)),
  };
  type View = { azimuth: number; elevation: number; fov: number; zoom: number; pan: number };
  const key = (at: number, view: View): Values => ({
    at: round3(clamp(at, 0, 100)), azimuth: round3(view.azimuth), elevation: view.elevation, fov: view.fov, zoom: view.zoom,
    panX: view.pan, panY: targetY, panZ: 0, focusDistance: 0,
  });
  const seconds = clamp(num(values.duration, 5), 1, 30);
  const loop = flag(values.loop, true);
  const ease = text(values.easing) === 'linear' ? 'linear' : 'smooth';
  const move = text(values.cameraMove) || 'orbit';
  const oldZoom = num(cam.zoom, 1.3);
  // Looping, 3D ran every move there and back at a constant speed and ignored the easing.
  const thereAndBack = (from: View, to: View): Values =>
    loop
      ? { cameraMotion: 'keys', cameraKeys: [key(0, from), key(50, to), key(100, from)], cameraEase: 'linear', cameraLoop: true }
      : { cameraMotion: 'keys', cameraKeys: [key(0, from), key(100, to)], cameraEase: ease, cameraLoop: false };
  let motion: Values = { cameraMotion: 'still' };
  let duration = seconds;
  if (move === 'orbit') motion = { cameraMotion: 'orbit', cameraEase: loop ? 'linear' : ease, cameraLoop: loop };
  else if (move === 'arc') motion = thereAndBack({ ...base, azimuth: base.azimuth - 45 }, { ...base, azimuth: base.azimuth + 45 });
  else if (move === 'dolly-in') motion = thereAndBack({ ...base, zoom: zoomOf(oldZoom * 0.6) }, { ...base, zoom: zoomOf(oldZoom * 1.2) });
  else if (move === 'dolly-out') motion = thereAndBack({ ...base, zoom: zoomOf(oldZoom * 1.2) }, { ...base, zoom: zoomOf(oldZoom * 0.6) });
  else if (move === 'push-in')
    motion = thereAndBack(
      { ...base, zoom: zoomOf(oldZoom * 0.6), fov: lens(baseFov * 1.15) },
      { ...base, zoom: zoomOf(oldZoom * 1.35), fov: lens(baseFov * 0.9) },
    );
  else if (move === 'custom') {
    const rows = (Array.isArray(values.cameraKeyframes) ? values.cameraKeyframes : [])
      .map((row) => record(row))
      .map((row) => ({
        time: num(row.time, 0),
        linear: text(row.easing) === 'linear',
        view: {
          azimuth: clamp(num(row.rotation, 0), -720, 720),
          elevation: round3(clamp(num(row.tilt, 12), -60, 80)),
          fov: lens(num(row.fov, 45)),
          zoom: zoomOf(num(row.zoom, 1)),
          pan: panOf(num(row.pan, 0)),
        },
      }))
      .sort((a, b) => a.time - b.time);
    const first = rows[0], last = rows[rows.length - 1];
    const span = first && last ? last.time - first.time : 0;
    // One easing for the whole path: linear only when every leg was.
    const pathEase = rows.slice(1).every((row) => row.linear) ? 'linear' : 'smooth';
    if (first && rows.length === 1) {
      // One key was a held view, so the view is the camera.
      Object.assign(base, first.view, { azimuth: fold180(first.view.azimuth) });
    } else if (first && span > 0 && loop && rows.length * 2 - 1 <= 12) {
      // Looping, 3D ran the path there and back inside its own length.
      duration = clamp(span, 1, 30);
      const forward = rows.map((row) => key(((row.time - first.time) / span) * 50, row.view));
      const back = rows.slice(0, -1).reverse().map((row) => key(100 - ((row.time - first.time) / span) * 50, row.view));
      motion = { cameraMotion: 'keys', cameraKeys: [...forward, ...back], cameraEase: pathEase, cameraLoop: true };
    } else if (first && span > 0) {
      // Played once, in its own time, then held: key times become shares of the loop.
      const length = loop ? clamp(span, 1, 30) : seconds;
      if (loop) duration = length;
      motion = {
        cameraMotion: 'keys',
        cameraKeys: rows.slice(0, 12).map((row) => key(((row.time - first.time) / length) * 100, row.view)),
        cameraEase: pathEase,
        cameraLoop: loop,
      };
    }
  }
  const transparent = flag(values.transparentBg, true);
  const shadows = flag(values.shadows, true);
  const scene = text(values.scene) || 'soft-glow';
  const gradient = scene === 'fun-gradient';
  const tinted = flag(values.applyTint, false) && text(values.tint);
  return {
    source: 'model',
    modelAsset: `lolly/3d/${sample}`,
    ...(THREE_D_SCENES[scene] ?? THREE_D_SCENES['soft-glow']),
    // Both tools' own starting strengths are taken as the same light: 1 in 3D, 0.4 here.
    environmentIntensity: round3(clamp(num(values.envIntensity, 1) * 0.4, 0, 3)),
    environmentRotation: fold180(num(values.envRotation, 0)),
    exposure: round3(clamp(num(values.exposure, 1), 0.1, 4)),
    // On transparency 3D still drew the contact shadow, which is 3D Studio's object with shadow.
    outputMode: transparent ? (shadows ? 'object-shadow' : 'object') : 'scene',
    backdrop: gradient ? 'gradient' : 'solid',
    ...(text(values.background) ? { background: text(values.background) } : {}),
    ...(gradient && text(values.bgColor2) ? { background2: text(values.bgColor2), backdropStrength: 1 } : {}),
    shadowOpacity: shadows ? 0.28 : 0,
    // 3D replaced every surface colour with the tint; a colour pair of one colour does the same.
    ...(tinted ? { materialMode: 'pair', colorA: tinted, colorB: tinted, finishA: 'satin', finishB: 'satin' } : { materialMode: 'source' }),
    // A group of numbers travels in a link one field at a time, as `camera.zoom=2`.
    ...fields('camera', { azimuth: base.azimuth, elevation: base.elevation, fov: base.fov, zoom: base.zoom, panX: base.pan, panY: 0, panZ: 0 }),
    ...fields('target', { x: 0, y: targetY, z: 0 }),
    ...fields('rotation', threeDRotation(num(rot.pitch, 0), num(rot.yaw, 0), num(rot.tilt, 0))),
    ...fields('position', {
      x: round3(clamp(num(mov.x, 0) * STUDIO_SPAN, -5, 5)),
      y: round3(clamp(num(mov.y, 0) * STUDIO_SPAN, -5, 5)),
      z: round3(clamp(num(mov.z, 0) * STUDIO_SPAN, -5, 5)),
    }),
    ...fields('transform', { scale: round3(scale) }),
    motion: 'still',
    ...motion,
    duration,
    playClip: flag(values.playClip, true),
    clipIndex: Math.round(clamp(num(values.clipIndex, 0), 0, 12)),
  };
}

const CARRY: Record<string, Carry> = {
  'meeting-planner': meetingPlannerToTimezone,
  'org-chart': flowChartToDesign,
  'voice-recorder': voiceRecorderToAudiogram,
  '3d': threeDToStudio,
};

/** The successor's address for a document open in the retired tool `from`. Lists and
 *  tables travel as JSON, which every tool link accepts. */
export function successorHref(from: string, to: string, values: Values): string {
  const carried = CARRY[from]?.(values) ?? {};
  const params = new URLSearchParams();
  for (const [id, value] of Object.entries(carried)) {
    params.set(id, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));
  }
  const query = params.toString();
  return `#/tool/${encodeURIComponent(to)}${query ? `?${query}` : ''}`;
}
