// SPDX-License-Identifier: MPL-2.0
/**
 * Design kit templates (plan 147 T10 / M4) - the multi-artboard packs.
 *
 * A "kit" is a `design` template with N frames, not a tool: the social profile
 * kit, the meeting background and the launch kit ship as
 * community/design/templates/*.json and ride engine 1.148's per-artboard
 * fan-out. Nothing else pins them, so this suite mounts the REAL design tool
 * from the community pack and drives every kit seed - base values and each
 * preset overlay - through the engine with the shared baseHost.
 *
 * What is pinned here:
 *  - each kit file parses, its id equals its basename, and every value key is
 *    a real design input (a retired id would only show up in the chooser);
 *  - every seed hydrates with no hook error (the hook reports through
 *    host.log, it never throws, so the log is what a failure looks like);
 *  - the frame count and the box count survive - a kit is only a kit while it
 *    still has all its artboards, and each artboard's content stays attached
 *    to its frame (a stray `frame` id would render the box on the pasteboard,
 *    outside every exported page);
 *  - the artboard sizes the plan names (LinkedIn 1584x396, X 1500x500, GitHub
 *    1280x640, YouTube 2048x1152, avatar 800x800, the call 1920x1080, the
 *    README banner 1280x320, the release card 1080x1080) are what renders;
 *  - the meeting background keeps the camera centre clear: no box overlaps the
 *    middle band a seated speaker occupies. That rule is the whole point of
 *    the layout, and a diff of coordinates does not show it.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-kit-templates.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// Load from the SOURCE pack, not the gitignored tools/ profile view, so the
// suite is profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'design', 'tool.json')),
    'community/design/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('design', fetchFile);

const KITS = ['social-profile-kit', 'meeting-background', 'launch-kit'] as const;

interface Box {
  id: string; kind: string; frame?: string;
  x: number; y: number; w: number; h: number;
  bg?: string; fg?: string; opacity?: number;
}
interface Seed { label: string; boxes: Box[] }

function kit(id: string): any {
  const file = join(COMMUNITY, 'design', 'templates', `${id}.json`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Base values plus every preset overlay, the way the chooser merges them. */
function seeds(id: string): Seed[] {
  const t = kit(id);
  const out: Seed[] = [{ label: `${id} base`, boxes: t.values.boxes }];
  for (const p of t.presets ?? []) {
    out.push({ label: `${id} preset ${p.id}`, boxes: { ...t.values, ...p.values }.boxes });
  }
  return out;
}

/** Render one seed, collecting anything the hook logged. */
async function render(boxes: Box[]): Promise<{ html: string; logs: string[] }> {
  const logs: string[] = [];
  const host = baseHost({ log: (...args: unknown[]) => logs.push(args.map(String).join(' ')) });
  const rt = await createRuntime(tool, host, { boxes } as Record<string, any>);
  return { html: rt.getHydrated() as string, logs };
}

const frames = (boxes: Box[]) => boxes.filter(b => b.kind === 'frame');
const children = (boxes: Box[]) => boxes.filter(b => b.kind !== 'frame');

/** The frame a child belongs to, by its stored `frame` id. */
const frameOf = (boxes: Box[], b: Box) => frames(boxes).find(f => f.id === String(b.frame));

/** Frame-local rect: the hook subtracts the frame origin, so this is what paints. */
function local(boxes: Box[], b: Box) {
  const f = frameOf(boxes, b)!;
  return { x: b.x - f.x, y: b.y - f.y, w: b.w, h: b.h, fw: f.w, fh: f.h };
}

/** The brand token a `var(--brand-x, #hex)` value names, or the raw string. */
const tokenOf = (v: string | undefined) => /^var\(\s*(--[\w-]+)/.exec(String(v ?? ''))?.[1] ?? String(v ?? '');

/**
 * What a box is painted ON: the nearest EARLIER opaque sibling in the same frame
 * that fully covers it, else the frame's own fill. Array order is paint order
 * (frameGroupsFor walks the boxes array), so "earlier" means "underneath".
 */
function groundToken(boxes: Box[], i: number): string {
  const b = boxes[i]!;
  const f = frameOf(boxes, b)!;
  for (let j = i - 1; j >= 0; j--) {
    const u = boxes[j]!;
    if (u.kind === 'frame' || String(u.frame) !== String(b.frame)) continue;
    if (u.opacity !== undefined && u.opacity < 100) continue; // a wash is not a ground
    if (u.x <= b.x && u.y <= b.y && u.x + u.w >= b.x + b.w && u.y + u.h >= b.y + b.h) {
      return tokenOf(u.bg);
    }
  }
  return tokenOf(f.bg);
}

test('every kit file is a well-formed template', { skip: SKIP }, async () => {
  const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));
  for (const id of KITS) {
    const t = kit(id);
    assert.equal(t.id, id, `${id}.json: id must equal the basename`);
    assert.ok(typeof t.name === 'string' && t.name, `${id}: missing name`);
    assert.ok(typeof t.description === 'string' && t.description, `${id}: missing description`);
    for (const seedKeys of [t.values, ...(t.presets ?? []).map((p: any) => p.values)]) {
      for (const key of Object.keys(seedKeys)) {
        assert.ok(ids.has(key), `${id} seeds "${key}", which is not a design input`);
      }
    }
    for (const p of t.presets ?? []) {
      assert.ok(typeof p.id === 'string' && p.id, `${id}: a preset has no id`);
      assert.ok(typeof p.name === 'string' && p.name, `${id}: preset "${p.id}" has no name`);
    }
  }
});

test('every kit seed hydrates into its artboards', { skip: SKIP }, async () => {
  for (const id of KITS) {
    for (const { label, boxes } of seeds(id)) {
      assert.ok(Array.isArray(boxes) && boxes.length > 0, `${label}: no boxes`);
      const ids = new Set(boxes.map(b => b.id));
      assert.equal(ids.size, boxes.length, `${label}: duplicate box ids`);
      const frameIds = new Set(frames(boxes).map(b => b.id));
      for (const b of children(boxes)) {
        assert.ok(frameIds.has(String(b.frame)),
          `${label}: box "${b.id}" names frame "${b.frame}", which is not an artboard (it would render on the pasteboard, outside every exported page)`);
      }

      const { html, logs } = await render(boxes);
      assert.deepEqual(logs, [], `${label} surfaced a hook error`);
      const pages = html.match(/data-pdf-page/g) ?? [];
      assert.equal(pages.length, frames(boxes).length, `${label}: one page per artboard`);
      const drawn = html.match(/data-box-id="/g) ?? [];
      assert.equal(drawn.length, children(boxes).length, `${label}: every box draws`);
      // A kit that renders blank boards is worse than no kit.
      for (const b of children(boxes).filter(c => c.kind === 'text')) {
        assert.ok(html.includes(`data-box-id="${b.id}"`), `${label}: text box "${b.id}" is missing`);
      }
    }
  }
});

test('the artboards keep the sizes the kits promise', { skip: SKIP }, async () => {
  const expected: Record<string, Record<string, [number, number]>> = {
    'social-profile-kit': {
      linkedin: [1584, 396], 'x-header': [1500, 500], github: [1280, 640],
      youtube: [2048, 1152], avatar: [800, 800],
    },
    'meeting-background': { call: [1920, 1080] },
    'launch-kit': { 'readme-banner': [1280, 320], 'release-card': [1080, 1080] },
  };
  for (const id of KITS) {
    for (const { label, boxes } of seeds(id)) {
      const got: Record<string, [number, number]> = {};
      for (const f of frames(boxes)) got[f.id] = [f.w, f.h];
      assert.deepEqual(got, expected[id], `${label}: artboard sizes drifted`);
      // Artboards must not overlap each other on the canvas, or the editor
      // shows one board sitting on top of the next.
      const list = frames(boxes);
      for (const a of list) {
        for (const b of list) {
          if (a === b) continue;
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          assert.ok(apart, `${label}: artboards "${a.id}" and "${b.id}" overlap`);
        }
      }
    }
  }
});

test('every child is authored in the canvas coordinate space, not its frame\'s', { skip: SKIP }, async () => {
  // A child's x/y are CANVAS coordinates; the hook subtracts the frame origin. Author a
  // row as if the numbers were frame-local and it paints at a large negative offset,
  // clipped away entirely - and every other assertion in this file still passes, because
  // the box div is emitted either way. Text must land wholly inside its board; a
  // decorative shape may bleed off the edge, but it has to touch the board at all.
  for (const id of KITS) {
    for (const { label, boxes } of seeds(id)) {
      for (const b of children(boxes)) {
        const r = local(boxes, b);
        const touches = r.x < r.fw && r.y < r.fh && r.x + r.w > 0 && r.y + r.h > 0;
        assert.ok(touches,
          `${label}: "${b.id}" resolves to frame-local ${r.x},${r.y} on a ${r.fw}x${r.fh} board - it paints nowhere (canvas coordinates read as frame-local?)`);
        if (b.kind !== 'text') continue;
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= r.fw && r.y + r.h <= r.fh,
          `${label}: text box "${b.id}" runs from ${r.x},${r.y} to ${r.x + r.w},${r.y + r.h} on a ${r.fw}x${r.fh} board - the frame clips it`);
      }
    }
  }
});

test('nothing is painted in a colour its own ground already uses', { skip: SKIP }, async () => {
  // A kit is only finished while every word can be read. Recolour one preset and a
  // headline can go brand-text on brand-primary - invisible, and no render assertion
  // notices, because the markup is identical either way.
  const READABLE: Record<string, string[]> = {
    '--brand-primary': ['--brand-on-primary'],
    '--brand-on-primary': ['--brand-primary', '--brand-text'],
    '--brand-surface': ['--brand-text', '--brand-muted', '--brand-primary'],
  };
  for (const id of KITS) {
    for (const { label, boxes } of seeds(id)) {
      boxes.forEach((b, i) => {
        if (b.kind === 'frame') return;
        const ground = groundToken(boxes, i);
        if (b.kind === 'text') {
          const ok = READABLE[ground];
          assert.ok(ok, `${label}: "${b.id}" sits on an unrecognised ground "${ground}"`);
          assert.ok(ok.includes(tokenOf(b.fg)),
            `${label}: text "${b.id}" is ${tokenOf(b.fg)} on ${ground} - one of ${ok.join(' / ')} is what reads there`);
          return;
        }
        // A shape has no text to read, so the rule is only that it is not its ground.
        if (b.opacity !== undefined && b.opacity < 100) return; // a wash is meant to blend
        assert.notEqual(tokenOf(b.bg), ground,
          `${label}: "${b.id}" is ${tokenOf(b.bg)} on ${ground} - it cannot be seen`);
      });
    }
  }
});

test('the LinkedIn banner keeps its lower left clear of the profile photo', { skip: SKIP }, async () => {
  // LinkedIn overlays the profile photo on the banner's lower left, exactly as X does on
  // its header - which is why the X board's content is right-aligned. The LinkedIn board
  // answers the same overlay by sitting above it.
  const PHOTO_TOP = 280; // frame-local y the overlaid photo reaches up to on a 396-tall banner
  for (const { label, boxes } of seeds('social-profile-kit')) {
    for (const b of children(boxes).filter(c => String(c.frame) === 'linkedin')) {
      const r = local(boxes, b);
      assert.ok(r.y + r.h <= PHOTO_TOP,
        `${label}: "${b.id}" reaches y ${r.y + r.h} on the LinkedIn banner - the profile photo covers everything below ${PHOTO_TOP}`);
    }
  }
});

test('the meeting background leaves the camera centre clear', { skip: SKIP }, async () => {
  // The band a seated speaker occupies in a 1920x1080 frame: from a third in
  // to two thirds across, top to bottom. Content is allowed to the left of it
  // and in the corners, never behind the head and shoulders.
  const SAFE = { x0: 640, x1: 1280, y0: 0, y1: 1080 };
  for (const { label, boxes } of seeds('meeting-background')) {
    for (const b of children(boxes)) {
      const clear = b.x + b.w <= SAFE.x0 || b.x >= SAFE.x1 || b.y + b.h <= SAFE.y0 || b.y >= SAFE.y1;
      assert.ok(clear, `${label}: "${b.id}" sits in the camera centre`);
    }
  }
});
