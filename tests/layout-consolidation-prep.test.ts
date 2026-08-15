// SPDX-License-Identifier: MPL-2.0
/**
 * Design — the consolidation-prep parity gaps (plans/104 §9.2's P1 side-fix note +
 * the retirement inventory: Sequence Studio retires into Design, so Design
 * has to grow the three capabilities its manifest was missing BEFORE the tool goes away).
 *
 * Run with: node --import ./tests/css-stub.mjs --test "tests/layout-consolidation-prep.test.ts"
 * (also collected by `npm test`). No framework — node:test.
 *
 * Everything here reads the SHIPPED artefacts off disk, per brand pack, and — for the head
 * gate — drives the real `hooks.js` through the real engine. Nothing is re-implemented.
 *
 * What is actually at risk, one section each:
 *
 * 1. **The wire format.** `boxes.fields` order IS the compact-URL wire format and is
 *    append-only forever (`lib/blocks-url.ts`), so `linkOf` had to land at slot 71, after
 *    `kf` at 70 — not inserted beside the other machine-managed fields where it reads
 *    better. Slots 69–71 are pinned so a "tidy-up" that reorders them fails here rather
 *    than silently re-pointing every link ever shared.
 * 2. **The capability declarations.** `canvas.linkField` (A/V detach), the reconciled
 *    `canvas.import.formats` and the `clip`/`card` add-kinds are what the shell reads to
 *    light up the affordances — `canDetach()` in views/timeline-panel.ts gates on the
 *    manifest alone, so the declaration IS the feature. Each is asserted to be coherent
 *    (a linkField that names a declared field; seeds whose kind/lane are values the
 *    manifest's own selects can express), not merely present. The ONE declaration held
 *    back is `import.mode: 'scenes'` — it is not inert, it would replace Design's
 *    editable design import outright, so G2 pins its ABSENCE and says why.
 * 3. **Both packs, independently.** The two brand copies diverge legitimately (fonts, an
 *    animated-SVG block), so every assertion runs over each copy rather than over "the"
 *    manifest, and the private brands/suse half skips cleanly on a public checkout.
 * 4. **The head whitelist.** `headKind()` in hooks.js now uses an own-property lookup, so
 *    the Object.prototype keys a hand-edited URL can carry (`headEnd=constructor`) fall to
 *    'none' instead of reaching the engine, which draws a triangle for any name it does
 *    not recognise. Asserted through a real render, with a legal value rendered alongside
 *    so the test cannot pass by drawing nothing at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { makeConnectorsApi } from '../engine/src/connectors.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Both brand variants ship the tool and a manifest change has to land in both. Gate the
 *  private brands/suse copy on the SOURCE pack being mounted, per the house rule
 *  (tests/README.md, "Private brand content"): a public checkout skips the SUSE half
 *  cleanly, but with the pack mounted a missing tool dir FAILS — a renamed or deleted
 *  variant must not be able to turn this suite green. */
const SUSE_MOUNTED = existsSync(join(ROOT, 'brands', 'suse', 'tools'));
if (SUSE_MOUNTED) {
  assert.ok(existsSync(join(ROOT, 'brands', 'suse', 'tools', 'design', 'tool.json')),
    'brands/suse/tools/design is missing — the pack is mounted, so the tool was renamed or deleted');
}
const BRANDS: readonly string[] = SUSE_MOUNTED ? ['lolly-start', 'suse'] : ['lolly-start'];
const packDir = (brand: string): string => join(ROOT, 'brands', brand, 'tools');

interface FieldSpec { id: string; type?: string; label?: string; default?: unknown; showFor?: string[] }
interface AddKind { id: string; label?: string; seed?: Record<string, unknown> }
interface BoxesInput {
  id: string;
  fields?: FieldSpec[];
  canvas?: Record<string, any>;
}

function boxesInput(brand: string): BoxesInput {
  const raw = JSON.parse(readFileSync(join(packDir(brand), 'design', 'tool.json'), 'utf8'));
  const i = (raw.inputs as BoxesInput[]).find((x) => x.id === 'boxes');
  assert.ok(i, `${brand}: no boxes input`);
  return i!;
}
const fieldsOf = (brand: string): FieldSpec[] => boxesInput(brand).fields || [];
const canvasOf = (brand: string): Record<string, any> => {
  const c = boxesInput(brand).canvas;
  assert.ok(c, `${brand}: boxes input declares no canvas block`);
  return c!;
};
const addKindsOf = (brand: string): AddKind[] => {
  const k = canvasOf(brand).addKinds;
  assert.ok(Array.isArray(k) && k.length, `${brand}: no addKinds`);
  return k as AddKind[];
};
/** The declared `value`s of a select sub-field — what a seed is allowed to say. */
function optionValues(brand: string, fieldId: string): string[] {
  const f = fieldsOf(brand).find((x) => x.id === fieldId) as (FieldSpec & { options?: { value: string }[] }) | undefined;
  assert.ok(f, `${brand}: no ${fieldId} sub-field`);
  return (f!.options || []).map((o) => String(o.value));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The wire format — linkOf is APPENDED, at slot 71
// ─────────────────────────────────────────────────────────────────────────────

test('boxes.fields tail: z/kf/linkOf then the deck fields — appended, never reordered', () => {
  for (const brand of BRANDS) {
    const fields = fieldsOf(brand);
    // The historical wire-format tail (pre-presentation): z/kf/linkOf at 69-71, UNMOVED —
    // so every link shared before the deck fields still decodes into the same columns.
    assert.deepEqual(fields.slice(69, 72).map((f) => f.id), ['z', 'kf', 'linkOf'],
      `${brand}: the compact-blocks tail moved — every link ever shared decodes into the wrong columns`);
    // The presentation-mode deck fields (plan 112) were APPENDED after linkOf — slots 72-76,
    // never squeezed in behind it — so `notes` is now the tail. This pin extends the same
    // append-only guard to them: a later field must land at 77, not shift these.
    assert.deepEqual(fields.slice(72).map((f) => f.id), ['presentAudio', 'build', 'state', 'matchOf', 'notes'],
      `${brand}: a deck field was inserted out of order — appended slots must stay put`);
    assert.equal(fields.length, 77, `${brand}: expected 77 sub-fields, got ${fields.length}`);
    assert.equal(fields[fields.length - 1]!.id, 'notes', `${brand}: notes is not the tail`);
    // Ids are unique — an accidental second `linkOf` would give the codec two columns of
    // the same name and the shell would read whichever it found first.
    assert.equal(new Set(fields.map((f) => f.id)).size, fields.length, `${brand}: duplicate sub-field id`);
  }
});

test('linkOf is machine-managed: text, empty default, showFor [] (never in the sidebar)', () => {
  for (const brand of BRANDS) {
    const f = fieldsOf(brand).find((x) => x.id === 'linkOf');
    assert.ok(f, `${brand}: no linkOf sub-field`);
    assert.equal(f!.type, 'text', `${brand}: linkOf must be a text field — it stores a box id`);
    assert.equal(f!.default, '', `${brand}: linkOf must default to "" (unlinked)`);
    // `showFor: []` is the whole reason the field can exist without changing the UI: the
    // timeline writes it on both sides of a detach, and no `showFor` value can match, so
    // it never renders a control. A missing or non-empty showFor puts a raw box id in the
    // inspector for the user to mistype.
    assert.ok(Array.isArray(f!.showFor) && f!.showFor!.length === 0,
      `${brand}: linkOf.showFor must be [] — got ${JSON.stringify(f!.showFor)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The capability declarations the shell reads
// ─────────────────────────────────────────────────────────────────────────────

test('G1 — canvas.linkField names the linkOf sub-field, so A/V detach lights up', () => {
  for (const brand of BRANDS) {
    const cv = canvasOf(brand);
    assert.equal(cv.linkField, 'linkOf', `${brand}: canvas.linkField is the detach opt-in`);
    // The name has to resolve, or the panel writes a link into a column the codec drops.
    assert.ok(fieldsOf(brand).some((f) => f.id === cv.linkField),
      `${brand}: canvas.linkField names "${cv.linkField}", which is not a declared sub-field`);
    // canDetach() also needs an `audio` add-kind (the vocabulary a detached sound is born
    // into) — the manifest half of that gate, asserted here so a dropped audio kind shows
    // up as "detach silently stopped working" rather than a mystery.
    const audio = addKindsOf(brand).find((k) => k.id === 'audio');
    assert.ok(audio, `${brand}: no audio add-kind — canDetach() cannot mint the detached box`);
    assert.equal(audio!.seed?.kind, 'audio', `${brand}: the audio add-kind must seed kind:"audio"`);
  }
});

test('G2 — canvas.import lists the full design-format set, and scenes mode stays UNDECLARED', () => {
  // The formats are RECONCILED with Sequence Studio's, not replaced: dropping one would
  // quietly retire an import path users already have.
  const EXPECTED = ['svg', 'penpot', 'pdf', 'ai', 'idml'];
  for (const brand of BRANDS) {
    const imp = canvasOf(brand).import;
    assert.ok(imp, `${brand}: no canvas.import block`);
    for (const f of EXPECTED) {
      assert.ok((imp.formats || []).includes(f), `${brand}: import.formats lost "${f}"`);
    }
    // `import.mode: "scenes"` is the ONE prep declaration that is not inert: free-canvas
    // gates on it alone (`importScenesMode`, views/free-canvas.ts) and Design's
    // timeCfg is always non-null, so declaring it here would flip EVERY Design
    // design import — timed or not — from "editable boxes + artboard resize + the Penpot
    // components-as-templates offer" to "one flat image clip per frame". That is the
    // tool's flagship import path and the shipped docs promise it by name
    // (docs/design-import.md: "the artboard resizes to the file's frame and every layer
    // becomes an editable box"), while the schema's own note says to "omit for editors
    // whose import replaces the board". The merged tool needs BOTH, so the mode lands
    // with the import-panel choice that lets a user pick, not before it.
    assert.equal(imp.mode, undefined,
      `${brand}: import.mode must stay undeclared until the import panel offers "as scenes" vs "replace the board" — declaring it converts every design import to flat image clips`);
    // …but the canvas must be READY for it: scene-mode import is only meaningful on a
    // time-capable canvas (free-canvas needs all ten time sub-fields for timeCfg), so the
    // remaining gap when that choice ships is UI, never the manifest.
    for (const key of ['startField', 'durField', 'clipInField', 'speedField', 'enterField',
      'exitField', 'enterMsField', 'exitMsField', 'muteField', 'laneField']) {
      assert.ok(canvasOf(brand)[key], `${brand}: canvas.${key} missing — scenes mode would be inert`);
    }
  }
});

test('P1 — the CAMERA add-kind is back, inside the timed group, seeding kind:"camera"', () => {
  // M0 gated it out of all three manifests on purpose (§9.2): the wire and the hooks'
  // marker shipped, but no affordance could CREATE a camera until P1 wired the
  // inspector and the canvas gestures. This is that re-add, and it is the only thing
  // standing between a user and the depth camera.
  //
  // Placed at the END of the timed group (audio, clip, card, camera) rather than
  // immediately after `audio` as §9.2 sketched: the sketch predates the clip/card pair
  // the safe-pack inserted, and G3 below pins those three as one adjacent group because
  // the timeline's add menu reads in manifest order. Same group, same reading, no pin
  // broken.
  for (const brand of BRANDS) {
    const kinds = addKindsOf(brand);
    const cam = kinds.find((k) => k.id === 'camera');
    assert.ok(cam, `${brand}: no "camera" add-kind — nothing in the UI can create a scene camera`);
    assert.equal(cam!.label, 'Camera');
    assert.deepEqual(cam!.seed, { kind: 'camera' }, `${brand}: a camera is its KIND and nothing else`);
    assert.ok(optionValues(brand, 'kind').includes('camera'),
      `${brand}: the camera add-kind seeds a kind the manifest's own select does not declare`);
    const ids = kinds.map((k) => k.id);
    assert.equal(ids.indexOf('camera') - ids.indexOf('card'), 1,
      `${brand}: the camera sits with the timed kinds — order was ${ids.join(',')}`);
  }

  // (The THIRD COPY was Sequence Studio in `community/`. It has been RETIRED into Design
  // (plans/104), so §9.2's "three manifests" is now the two brand copies above.)
});

test('G3 — the magnetic-row seeds (clip, card) ship beside the existing media kinds', () => {
  for (const brand of BRANDS) {
    const kinds = addKindsOf(brand);
    const byId = new Map(kinds.map((k) => [k.id, k]));

    const clip = byId.get('clip');
    assert.ok(clip, `${brand}: no "clip" add-kind`);
    assert.equal(clip!.label, 'Clip');
    assert.deepEqual(clip!.seed, { kind: 'image', lane: 'seq', fit: 'cover' }, `${brand}: clip seed`);

    const card = byId.get('card');
    assert.ok(card, `${brand}: no "card" add-kind`);
    assert.equal(card!.label, 'Card');
    assert.equal(card!.seed?.kind, 'box', `${brand}: card seeds a box`);
    assert.equal(card!.seed?.lane, 'seq', `${brand}: card is born on the sequence lane`);
    assert.equal(card!.seed?.dur, 2.5, `${brand}: card seeds a 2.5s duration`);
    assert.equal(card!.seed?.bg, '#14181d', `${brand}: card seeds its own dark fill`);

    // Sequence Studio's third kind is deliberately NOT carried across: "tool" seeded a
    // plain image and duplicated what the asset picker already does from a Lolly link.
    assert.ok(!byId.has('tool'), `${brand}: the "tool" add-kind was dropped on purpose — do not re-add it`);

    // Adjacency to the existing video/audio entries: the timeline's add menu shows the
    // list in manifest order, so the timed kinds have to read as one group.
    const ids = kinds.map((k) => k.id);
    assert.equal(ids.indexOf('card') - ids.indexOf('clip'), 1, `${brand}: clip and card must be adjacent`);
    assert.ok(Math.abs(ids.indexOf('clip') - ids.indexOf('audio')) === 1,
      `${brand}: the clip/card pair must sit next to the audio kind — order was ${ids.join(',')}`);

    // A seed may only say things the manifest's own selects can express, or the box is
    // born carrying a value its render drops.
    for (const k of [clip!, card!]) {
      assert.ok(optionValues(brand, 'kind').includes(String(k.seed?.kind)),
        `${brand}: ${k.id} seeds kind "${k.seed?.kind}", not a declared option`);
      assert.ok(optionValues(brand, 'lane').includes(String(k.seed?.lane)),
        `${brand}: ${k.id} seeds lane "${k.seed?.lane}", not a declared option`);
    }
    assert.ok(optionValues(brand, 'fit').includes(String(clip!.seed?.fit)),
      `${brand}: clip seeds fit "${clip!.seed?.fit}", not a declared option`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The head whitelist — through the REAL hooks, per brand pack
// ─────────────────────────────────────────────────────────────────────────────

/** A two-node diagonal line in the wire codec hooks.js decodes. Heads are drawn only on a
 *  single OPEN contour, so a closed seed shape would make every assertion below vacuous. */
const PATH_LINE = '1!line!0_0!0_1!1';

/**
 * Mount one path box against the REAL geometry + connector primitives. `baseHost()` carries
 * neither, and a head comes out of `host.connectors.pathHeadSvg`, so without them the hook's
 * feature detection correctly draws nothing — and the prototype-key test would pass against
 * a tool that cannot decorate at all.
 */
async function mountPath(brand: string, box: Record<string, unknown>): Promise<string> {
  const fetchFile = (path: string) => readFile(join(packDir(brand), path), 'utf8');
  // loadTool validates against schemas/tool.schema.json AND enforces the manifest's
  // engineVersion range against the running ENGINE_VERSION — so this call is also the
  // "the edited manifest still loads" assertion.
  const tool: any = await loadTool('design', fetchFile);
  const host = baseHost({ geom: makeGeomApi(), connectors: makeConnectorsApi() });
  const rt = await createRuntime(tool, host, {
    boxes: [{
      id: 'p1', kind: 'path', x: 10, y: 20, w: 200, h: 100, rot: 0,
      path: PATH_LINE, bg: '', stroke: '#c8102e', strokeW: 5, opacity: 100, ...box,
    }] as never,
  } as never);
  assert.deepEqual(rt.hookErrors ?? [], [], `${brand}: hook errors`);
  const m = /<svg class="lolly-box-path"[\s\S]*?<\/svg>/.exec(rt.getHydrated() as string);
  assert.ok(m, `${brand}: the path box drew no <svg> of its own`);
  return m![0];
}

/** The head fragments: everything the engine appended after the shaft `<path>`. */
const headsOf = (svg: string): string => svg.slice(svg.indexOf('</path>') + '</path>'.length, -'</svg>'.length);

test('the six legal head values still draw, in both packs', async () => {
  for (const brand of BRANDS) {
    assert.equal(headsOf(await mountPath(brand, { headEnd: 'none' })), '',
      `${brand}: "none" is a legal value that draws nothing`);
    for (const kind of ['triangle', 'open', 'circle', 'diamond', 'bar']) {
      assert.notEqual(headsOf(await mountPath(brand, { headEnd: kind })), '',
        `${brand}: headEnd=${kind} drew nothing — the whitelist rejected a value it must accept`);
    }
  }
});

test('a head value outside the closed six draws nothing — including Object.prototype keys', async () => {
  // The point of the own-property posture. A bare `HEAD_KINDS[v]` truthiness test lets
  // `constructor`/`__proto__`/`toString`/`valueOf` through, because every object literal
  // inherits them truthy — and the engine draws a triangle for any name it does not
  // recognise, so `?headEnd=constructor` in a hand-edited URL would decorate a path the
  // manifest's own option list has no way to express.
  for (const brand of BRANDS) {
    for (const junk of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty',
      'isPrototypeOf', 'zzz', 'arrow', 'Triangle', '<script>']) {
      assert.equal(headsOf(await mountPath(brand, { headEnd: junk })), '',
        `${brand}: headEnd=${junk} must draw nothing`);
      assert.equal(headsOf(await mountPath(brand, { headStart: junk })), '',
        `${brand}: headStart=${junk} must draw nothing`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The migrated teaching content — Sequence Studio's four examples, additively
// ─────────────────────────────────────────────────────────────────────────────
//
// Sequence Studio taught its motion model through four example looks. Two of them became
// Design TEMPLATES (launch-teaser, feature-tour — "New from template" starting
// points, values in tools/<id>/templates/<tid>.json) and two became manifest EXAMPLES
// (the gallery's preview strip). Three things about that port can silently rot, and none
// of them is covered by validate-catalog:
//
//   • **The dropped `orientation`.** Sequence Studio carried an `orientation` select that
//     sized its canvas; Design has no such input, and NEITHER a template seed nor an
//     example look can express canvas dimensions (a template's `values` is patched into the
//     runtime by input id — views/tool.ts — and Design declares only `background` +
//     `boxes`; the canvas comes from `render.width/height`). So every composition was
//     re-laid-out against the 1080×1080 default, exactly as templates/video.json already
//     was. A box that drifts back outside that box is content the user never sees, and
//     nothing else in the repo would notice.
//   • **Undeclared keys are INERT, not loud.** validate-catalog checks example values
//     against the declared inputs/sub-fields, but templates get NO such check, and NEITHER
//     is checked against a select's option list. A stray `orientation`, or a `font: "sans"`
//     in the SUSE pack (whose faces are SUSE/SUSE Mono), renders as the field's default
//     with no error anywhere.
//   • **Both packs, independently** — same rule as every section above.
//
// Asset refs are asserted absent because these are pure text/box compositions: a look that
// grew an asset id would have to resolve in BOTH catalogs, and a public checkout has no
// suse/* assets at all.

/** Canvas the compositions must fit: the tool's own declared render box. */
function renderBoxOf(brand: string): { width: number; height: number } {
  const raw = JSON.parse(readFileSync(join(packDir(brand), 'design', 'tool.json'), 'utf8'));
  const r = raw.render ?? {};
  assert.equal(typeof r.width, 'number', `${brand}: render.width`);
  assert.equal(typeof r.height, 'number', `${brand}: render.height`);
  return { width: r.width as number, height: r.height as number };
}

const inputIdsOf = (brand: string): string[] => {
  const raw = JSON.parse(readFileSync(join(packDir(brand), 'design', 'tool.json'), 'utf8'));
  return (raw.inputs as { id: string }[]).map((i) => i.id);
};

const examplesOf = (brand: string): { label?: string; values: Record<string, any> }[] => {
  const raw = JSON.parse(readFileSync(join(packDir(brand), 'design', 'tool.json'), 'utf8'));
  return (raw.examples ?? []) as { label?: string; values: Record<string, any> }[];
};

const templateOf = (brand: string, tid: string): Record<string, any> => {
  const p = join(packDir(brand), 'design', 'templates', `${tid}.json`);
  assert.ok(existsSync(p), `${brand}: templates/${tid}.json is missing`);
  // Parses as JSON or this throws — that IS the "it still parses" assertion.
  return JSON.parse(readFileSync(p, 'utf8')) as Record<string, any>;
};

/** One composition's `values`, checked the way nothing else in the repo checks it. */
function assertComposition(brand: string, where: string, values: Record<string, any>): void {
  const inputIds = new Set(inputIdsOf(brand));
  for (const key of Object.keys(values)) {
    assert.ok(inputIds.has(key),
      `${brand} ${where}: values key "${key}" is not a declared input — it seeds nothing ` +
      `(Sequence Studio's "orientation" is the one this is here to catch)`);
  }
  const fields = new Map(fieldsOf(brand).map((f) => [f.id, f as FieldSpec & { type?: string; options?: { value: unknown }[] }]));
  const { width, height } = renderBoxOf(brand);
  const boxes = values.boxes as Record<string, unknown>[];
  assert.ok(Array.isArray(boxes) && boxes.length > 0, `${brand} ${where}: no boxes`);
  boxes.forEach((b, n) => {
    for (const [k, v] of Object.entries(b)) {
      const f = fields.get(k);
      assert.ok(f, `${brand} ${where}: box[${n}] key "${k}" is not a declared sub-field`);
      assert.notEqual(f!.type, 'asset',
        `${brand} ${where}: box[${n}] carries an asset ref ("${k}") — these compositions are text/box only`);
      const opts = f!.options;
      if (Array.isArray(opts) && opts.length) {
        assert.ok(opts.some((o) => String(o.value) === String(v)),
          `${brand} ${where}: box[${n}] ${k}=${JSON.stringify(v)} is not a declared option of that select`);
      }
    }
    // The orientation drop, made concrete: every box lands inside the default canvas.
    const x = Number(b.x), y = Number(b.y), w = Number(b.w), h = Number(b.h);
    assert.ok(x >= 0 && y >= 0, `${brand} ${where}: box[${n}] starts off-canvas at ${x},${y}`);
    assert.ok(x + w <= width && y + h <= height,
      `${brand} ${where}: box[${n}] runs to ${x + w}×${y + h}, outside the ${width}×${height} canvas — ` +
      `a landscape/portrait composition was re-imported without re-laying it out`);
  });
}

test('the two migrated Video templates ship in both packs, in the Video category', () => {
  const EXPECTED: Record<string, { name: string; boxes: number }> = {
    'launch-teaser': { name: 'Launch teaser', boxes: 4 },
    'feature-tour': { name: 'Feature tour', boxes: 5 },
  };
  for (const brand of BRANDS) {
    for (const [tid, want] of Object.entries(EXPECTED)) {
      const t = templateOf(brand, tid);
      // `id` is the reserved `?template=<id>` contract — it must match the filename.
      assert.equal(t.id, tid, `${brand}: templates/${tid}.json declares id "${t.id}"`);
      assert.equal(t.name, want.name, `${brand}: ${tid} name`);
      assert.equal(t.category, 'Video', `${brand}: ${tid} must group with the Video template`);
      assert.equal(typeof t.description, 'string', `${brand}: ${tid} needs a one-line description`);
      assert.ok(t.values && typeof t.values === 'object', `${brand}: ${tid} carries no values`);
      assert.equal((t.values.boxes as unknown[]).length, want.boxes,
        `${brand}: ${tid} box count changed — a beat was added or lost`);
      assertComposition(brand, `templates/${tid}.json`, t.values);
    }
  }
});

test('design ships exactly the two migrated example looks, in both packs', () => {
  const EXPECTED: { label: string; boxes: number }[] = [
    { label: 'Three steps', boxes: 4 },
    { label: 'Quote cutaway', boxes: 3 },
  ];
  for (const brand of BRANDS) {
    const looks = examplesOf(brand);
    assert.equal(looks.length, 2,
      `${brand}: expected the 2 migrated looks, got ${looks.length} — the gallery strip renders each one live`);
    looks.forEach((look, i) => {
      assert.equal(look.label, EXPECTED[i]!.label, `${brand}: example ${i} label`);
      assert.equal((look.values.boxes as unknown[]).length, EXPECTED[i]!.boxes,
        `${brand}: example ${i} box count changed`);
      assertComposition(brand, `examples[${i}]`, look.values);
    });
  }
});

test('each pack uses its OWN typeface, never the other pack\'s — the copies diverge by brand', () => {
  // The one field where a file-copy between packs (instead of a per-copy edit) shows up:
  // lolly-start declares sans/mono, brands/suse declares SUSE/SUSE Mono. The option-list
  // check above already fails a cross-pack value; this asserts the positive case so an
  // empty/absent `font` cannot pass by saying nothing.
  for (const brand of BRANDS) {
    const legal = new Set(optionValues(brand, 'font'));
    const seen = new Set<string>();
    const comps: Record<string, any>[] = [
      ...['launch-teaser', 'feature-tour'].map((tid) => templateOf(brand, tid).values),
      ...examplesOf(brand).map((e) => e.values),
    ];
    for (const values of comps) {
      for (const b of values.boxes as Record<string, unknown>[]) {
        if (b.font !== undefined) seen.add(String(b.font));
      }
    }
    assert.ok(seen.size > 0, `${brand}: no migrated box names a font at all`);
    for (const f of seen) assert.ok(legal.has(f), `${brand}: migrated content names font "${f}"`);
  }
});
