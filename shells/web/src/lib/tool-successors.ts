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

const CARRY: Record<string, Carry> = {
  'meeting-planner': meetingPlannerToTimezone,
  'org-chart': flowChartToDesign,
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
