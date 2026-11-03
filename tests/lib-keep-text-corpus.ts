// SPDX-License-Identifier: MPL-2.0
/**
 * A generated corpus of small PDFs for Keep text, and an oracle that reads a result's content
 * streams with a tokenizer of its own. The oracle shares no code with the shipped checker: it
 * knows the font (Courier, 600 units a glyph), the image placements and the rectangles because
 * the generator wrote them, so it can say exactly what sits under a box.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, StandardFonts, decodePDFRawStream, rgb } from 'pdf-lib';

export interface Bar { page: number; x: number; y: number; w: number; h: number }
export interface Placed { x0: number; y0: number; x1: number; y1: number }
export interface Corpus {
  bytes: Uint8Array;
  bars: Bar[];
  /** Text lines: left x, baseline y (top-left space), size, string. */
  lines: { x: number; y: number; size: number; text: string }[];
  images: { rect: Placed; w: number; h: number }[];
  rects: Placed[];
}

export const PAGE_W = 300, PAGE_H = 400;

/** A small deterministic generator (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['alpha', 'SECRET', 'ledger', 'Account', '4521-77', 'north', 'budget', 'Jane', 'Doe', 'memo', 'q3', 'plan'];

export async function makeCorpusPdf(seed: number): Promise<Corpus> {
  const r = prng(seed);
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Courier);
  const lines: Corpus['lines'] = [], images: Corpus['images'] = [], rects: Placed[] = [];
  // Rectangles first, so text and pictures paint over them.
  for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
    const x = 10 + r() * 180, y = 10 + r() * 330, w = 20 + r() * 100, h = 10 + r() * 60;
    page.drawRectangle({ x, y: PAGE_H - y - h, width: w, height: h, color: rgb(r(), r(), r()) });
    rects.push({ x0: x, y0: y, x1: x + w, y1: y + h });
  }
  for (let i = 0, n = Math.floor(r() * 3); i < n; i++) {
    const w = 8 + Math.floor(r() * 12), h = 8 + Math.floor(r() * 12);
    const px = new Uint8Array(w * h * 3).map(() => 1 + Math.floor(r() * 254));
    const stream = doc.context.flateStream(px, { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 });
    const ref = doc.context.register(stream);
    const name = `Im${i + 1}`;
    const x = 10 + r() * 200, y = 10 + r() * 300, dw = 30 + r() * 60, dh = 30 + r() * 60;
    page.node.setXObject(PDFName.of(name), ref);
    page.pushOperators(...[]);
    const ctx = doc.context;
    const cs = ctx.flateStream(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${(PAGE_H - y - dh).toFixed(2)} cm /${name} Do Q\n`);
    page.node.addContentStream(ctx.register(cs));
    images.push({ rect: { x0: x, y0: y, x1: x + dw, y1: y + dh }, w, h });
  }
  for (let i = 0, n = 3 + Math.floor(r() * 4); i < n; i++) {
    const size = pick([10, 12, 14]);
    const text = Array.from({ length: 2 + Math.floor(r() * 3) }, () => pick(WORDS)).join(' ');
    const x = 10 + r() * 60, y = 30 + r() * 350;
    page.drawText(text, { x, y: PAGE_H - y, size, font, color: rgb(0, 0, 0) });
    lines.push({ x, y, size, text });
  }
  const bars: Bar[] = [];
  for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
    const anchor = r() < 0.6 && lines.length ? pick(lines) : null;
    if (anchor) {
      const from = Math.floor(r() * anchor.text.length), len = 1 + Math.floor(r() * 8);
      bars.push({ page: 1, x: anchor.x + from * 0.6 * anchor.size - 1, y: anchor.y - anchor.size * 0.85, w: len * 0.6 * anchor.size + 2, h: anchor.size * 1.15 });
    } else {
      bars.push({ page: 1, x: r() * 220, y: r() * 340, w: 20 + r() * 80, h: 10 + r() * 50 });
    }
  }
  return { bytes: new Uint8Array(await doc.save({ useObjectStreams: false })), bars, lines, images, rects };
}

// ─── the oracle ───────────────────────────────────────────────────────────────

type Tok = { t: 'num'; v: number } | { t: 'str'; v: Uint8Array } | { t: 'name'; v: string } | { t: 'arr'; v: Tok[] } | { t: 'op'; v: string };

export function tokenize(src: Uint8Array): Tok[] {
  let i = 0;
  const n = src.length;
  const ws = (c: number) => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
  const delim = (c: number) => [40, 41, 60, 62, 91, 93, 47, 37].includes(c);
  const read = (until?: number): Tok[] => {
    const out: Tok[] = [];
    while (i < n) {
      const c = src[i]!;
      if (ws(c)) { i++; continue; }
      if (c === 37) { while (i < n && src[i] !== 10 && src[i] !== 13) i++; continue; }
      if (c === 91) { i++; out.push({ t: 'arr', v: read(93) }); continue; }
      if (c === 93) { i++; if (until === 93) return out; continue; }
      if (c === 40) {
        i++; let depth = 1; const bytes: number[] = [];
        while (i < n && depth) {
          const d = src[i++]!;
          if (d === 92) {
            const e = src[i++]!;
            if (e >= 48 && e <= 55) { let v = e - 48; for (let k = 0; k < 2 && src[i]! >= 48 && src[i]! <= 55; k++) v = v * 8 + src[i++]! - 48; bytes.push(v & 255); }
            else bytes.push(e === 110 ? 10 : e === 114 ? 13 : e === 116 ? 9 : e);
          } else if (d === 40) { depth++; bytes.push(d); }
          else if (d === 41) { depth--; if (depth) bytes.push(d); }
          else bytes.push(d);
        }
        out.push({ t: 'str', v: Uint8Array.from(bytes) }); continue;
      }
      if (c === 60 && src[i + 1] !== 60) {
        i++; let hex = '';
        while (i < n && src[i] !== 62) hex += String.fromCharCode(src[i++]!);
        i++; hex = hex.replace(/\s/g, ''); if (hex.length % 2) hex += '0';
        out.push({ t: 'str', v: Uint8Array.from(hex.match(/../g)?.map(h => parseInt(h, 16)) ?? []) }); continue;
      }
      if (c === 60 || c === 62) { i += 2; continue; }
      if (c === 47) { i++; const s = i; while (i < n && !ws(src[i]!) && !delim(src[i]!)) i++; out.push({ t: 'name', v: new TextDecoder('latin1').decode(src.subarray(s, i)) }); continue; }
      const s = i; while (i < n && !ws(src[i]!) && !delim(src[i]!)) i++;
      const word = new TextDecoder('latin1').decode(src.subarray(s, i));
      if (!word) { i++; continue; }
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) out.push({ t: 'num', v: Number(word) }); else out.push({ t: 'op', v: word });
    }
    return out;
  };
  return read();
}

type M = [number, number, number, number, number, number];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

export interface Seen {
  glyphs: { ch: string; x0: number; y0: number; x1: number; y1: number }[];
  fills: { rect: Placed; clips: Placed[][] }[];
  images: { name: string; rect: Placed }[];
}

/** What a page's content stream paints, in top-left space. Courier only, as the generator wrote. */
export function readPage(content: Uint8Array): Seen {
  const toks = tokenize(content);
  const seen: Seen = { glyphs: [], fills: [], images: [] };
  let ctm: M = [1, 0, 0, 1, 0, 0], tm: M = [1, 0, 0, 1, 0, 0], tlm: M = tm, size = 12, leading = 0;
  const stack: { ctm: M; clips: Placed[][] }[] = [];
  let clips: Placed[][] = [];
  let args: Tok[] = [];
  let path: Placed[] = [], pendingClip = false;
  let points: [number, number][] = [];
  const closeSubpath = () => {
    if (!points.length) return;
    const xs = points.map(p => p[0]), ys = points.map(p => flipY(p[1]));
    path.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
    points = [];
  };
  const flipY = (y: number) => PAGE_H - y;
  const toPage = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const show = (bytes: Uint8Array) => {
    for (const code of bytes) {
      const m = mul(tm, ctm);
      const adv = 0.6 * size;
      const [ax, ay] = toPage(m, 0, -0.2 * size), [bx, by] = toPage(m, adv, 0.8 * size);
      seen.glyphs.push({ ch: String.fromCharCode(code), x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: flipY(Math.max(ay, by)), y1: flipY(Math.min(ay, by)) });
      tm = mul([1, 0, 0, 1, adv, 0], tm);
    }
  };
  const nums = () => args.filter((a): a is { t: 'num'; v: number } => a.t === 'num').map(a => a.v);
  for (const tok of toks) {
    if (tok.t !== 'op') { args.push(tok); continue; }
    const a = nums();
    switch (tok.v) {
      case 'q': stack.push({ ctm, clips }); break;
      case 'Q': { const s = stack.pop(); if (s) { ctm = s.ctm; clips = s.clips; } break; }
      case 'cm': if (a.length === 6) ctm = mul(a as M, ctm); break;
      case 'BT': tm = tlm = [1, 0, 0, 1, 0, 0]; break;
      case 'Tf': size = a[0] ?? size; break;
      case 'TL': leading = a[0] ?? 0; break;
      case 'Tm': if (a.length === 6) tm = tlm = a as M; break;
      case 'Td': tlm = mul([1, 0, 0, 1, a[0]!, a[1]!], tlm); tm = tlm; break;
      case 'TD': leading = -a[1]!; tlm = mul([1, 0, 0, 1, a[0]!, a[1]!], tlm); tm = tlm; break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; break;
      case 'Tj': { const s = args.find(x => x.t === 'str'); if (s?.t === 'str') show(s.v); break; }
      case 'TJ': {
        const arr = args.find(x => x.t === 'arr');
        if (arr?.t === 'arr') for (const el of arr.v) {
          if (el.t === 'str') show(el.v); else if (el.t === 'num') tm = mul([1, 0, 0, 1, (-el.v / 1000) * size, 0], tm);
        }
        break;
      }
      case 're': {
        if (a.length === 4) {
          const [x, y, w, h] = a as [number, number, number, number];
          const [p, q] = toPage(ctm, x, y), [p2, q2] = toPage(ctm, x + w, y + h);
          path.push({ x0: Math.min(p, p2), x1: Math.max(p, p2), y0: flipY(Math.max(q, q2)), y1: flipY(Math.min(q, q2)) });
        }
        break;
      }
      case 'm': closeSubpath(); if (a.length === 2) points.push(toPage(ctm, a[0]!, a[1]!)); break;
      case 'l': if (a.length === 2) points.push(toPage(ctm, a[0]!, a[1]!)); break;
      case 'h': break;
      case 'W': case 'W*': pendingClip = true; break;
      case 'f': case 'F': case 'f*': case 'B': case 'b': case 'B*':
        closeSubpath();
        for (const r of path) seen.fills.push({ rect: r, clips: clips.map(c => c.slice()) });
        if (pendingClip) clips = [...clips, path];
        path = []; pendingClip = false; break;
      case 'n': closeSubpath(); if (pendingClip) clips = [...clips, path]; path = []; pendingClip = false; break;
      case 'S': case 's': points = []; path = []; pendingClip = false; break;
      case 'Do': {
        const name = args.find(x => x.t === 'name');
        if (name?.t === 'name') {
          const [p, q] = toPage(ctm, 0, 0), [p2, q2] = toPage(ctm, 1, 1);
          seen.images.push({ name: name.v, rect: { x0: Math.min(p, p2), x1: Math.max(p, p2), y0: flipY(Math.max(q, q2)), y1: flipY(Math.min(q, q2)) } });
        }
        break;
      }
      default: break;
    }
    args = [];
  }
  return seen;
}

export const cross = (a: Placed, b: Placed, by = 0.01): boolean => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > by && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > by;

/** Whether a path-fill reaches a box: some sample point inside both is not cut out by an even-odd clip pair. */
export function fillReaches(f: Seen['fills'][number], bar: Placed): boolean {
  const common = { x0: Math.max(f.rect.x0, bar.x0), y0: Math.max(f.rect.y0, bar.y0), x1: Math.min(f.rect.x1, bar.x1), y1: Math.min(f.rect.y1, bar.y1) };
  if (common.x1 <= common.x0 || common.y1 <= common.y0) return false;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = common.x0 + ((i + 0.5) / 8) * (common.x1 - common.x0), y = common.y0 + ((j + 0.5) / 8) * (common.y1 - common.y0);
    const inRect = (r: Placed) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
    // Each clip is a list of rectangles taken even-odd: inside when an odd number contain the point.
    if (f.clips.every(c => c.filter(inRect).length % 2 === 1)) return true;
  }
  return false;
}

/** All problems found under the boxes in a result, by the oracle's reading. */
export async function oracle(output: Uint8Array, corpus: Corpus): Promise<{ survivors: string[]; keptGlyphs: number; clearGlyphs: number }> {
  const doc = await PDFDocument.load(output, { updateMetadata: false });
  const page = doc.getPage(0);
  const ctx = doc.context;
  const contents = ctx.lookup(page.node.get(PDFName.of('Contents')));
  const refs = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of('Contents'))!];
  const parts: Uint8Array[] = [];
  for (const r of refs) { const s = ctx.lookup(r); if (s instanceof PDFRawStream) parts.push(decodePDFRawStream(s).decode(), Uint8Array.of(10)); }
  const total = parts.reduce((n, p) => n + p.length, 0), content = new Uint8Array(total);
  let at = 0; for (const p of parts) { content.set(p, at); at += p.length; }
  const seen = readPage(content);
  const bars = corpus.bars.map(b => ({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h }));
  const survivors: string[] = [];
  for (const g of seen.glyphs) if (g.ch.trim() && bars.some(b => cross(g, b, 0.5))) survivors.push(`glyph ${g.ch}`);
  for (const f of seen.fills) if (bars.some(b => fillReaches(f, b))) {
    // The burned boxes are fills too: skip a fill that is exactly a box.
    if (bars.some(b => Math.abs(f.rect.x0 - b.x0) < 0.7 && Math.abs(f.rect.x1 - b.x1) < 0.7 && Math.abs(f.rect.y0 - b.y0) < 0.7 && Math.abs(f.rect.y1 - b.y1) < 0.7)) continue;
    survivors.push('vector');
  }
  // Pictures: every sample under a box must be zero.
  const xobjects = ctx.lookup(ctx.lookup(page.node.get(PDFName.of('Resources')) as PDFRef)?.constructor === PDFDict ? (ctx.lookup(page.node.get(PDFName.of('Resources'))) as PDFDict).get(PDFName.of('XObject')) : undefined);
  for (const im of seen.images) {
    if (!bars.some(b => cross(im.rect, b))) continue;
    const ref = xobjects instanceof PDFDict ? xobjects.get(PDFName.of(im.name)) : undefined;
    const stream = ref ? ctx.lookup(ref) : undefined;
    if (!(stream instanceof PDFRawStream)) { survivors.push('image unreadable'); continue; }
    const W = (stream.dict.get(PDFName.of('Width')) as PDFNumber).asNumber(), H = (stream.dict.get(PDFName.of('Height')) as PDFNumber).asNumber();
    const data = decodePDFRawStream(stream).decode();
    for (const b of bars) {
      const o = { x0: Math.max(im.rect.x0, b.x0 + 0.05), y0: Math.max(im.rect.y0, b.y0 + 0.05), x1: Math.min(im.rect.x1, b.x1 - 0.05), y1: Math.min(im.rect.y1, b.y1 - 0.05) };
      if (o.x1 <= o.x0 || o.y1 <= o.y0) continue;
      const i0 = Math.floor(((o.x0 - im.rect.x0) / (im.rect.x1 - im.rect.x0)) * W), i1 = Math.ceil(((o.x1 - im.rect.x0) / (im.rect.x1 - im.rect.x0)) * W) - 1;
      const j0 = Math.floor(((o.y0 - im.rect.y0) / (im.rect.y1 - im.rect.y0)) * H), j1 = Math.ceil(((o.y1 - im.rect.y0) / (im.rect.y1 - im.rect.y0)) * H) - 1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let c = 0; c < 3; c++) if (data[(j * W + i) * 3 + c] !== 0) { survivors.push('image pixel'); j = j1 + 1; i = i1 + 1; break; }
    }
  }
  // Non-vacuity: glyphs well clear of every box (2pt margin) must still be there.
  let clearGlyphs = 0, keptGlyphs = 0;
  for (const line of corpus.lines) {
    for (let k = 0; k < line.text.length; k++) {
      const x0 = line.x + k * 0.6 * line.size;
      const g = { x0: x0 - 2, x1: x0 + 0.6 * line.size + 2, y0: line.y - 0.8 * line.size - 2, y1: line.y + 0.2 * line.size + 2 };
      if (line.text[k] === ' ' || bars.some(b => cross(g, b))) continue;
      clearGlyphs++;
      if (seen.glyphs.some(s => s.ch === line.text[k] && Math.abs(s.x0 - x0) < 0.6 && Math.abs(s.y1 - line.y - 0.2 * line.size) < 0.6)) keptGlyphs++;
    }
  }
  return { survivors, keptGlyphs, clearGlyphs };
}
