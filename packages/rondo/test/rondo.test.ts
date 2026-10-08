// SPDX-License-Identifier: MPL-2.0
/**
 * @lolly-tools/rondo: the vm path renders what upstream renders, and contains what
 * a hostile song tries.
 *
 * The reference is upstream's ALL-NATIVE render (no vm), recorded by
 * `node scripts/build-rondo.ts --golden` into fixtures/golden.json. A default run
 * checks a spread of examples; LOLLY_RONDO_FULL=1 checks all 39 in both languages.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderRondo, RONDO_LIMITS, StagedError, type RondoPcm } from '../src/index.ts';
import type { RondoLimits } from '../src/limits.ts';
import { parseStaged } from '../src/staged.ts';

const here = new URL('.', import.meta.url);
const stageSource = readFileSync(new URL('../generated/stage.js', here), 'utf8');
const { examples } = JSON.parse(readFileSync(new URL('fixtures/examples.json', here), 'utf8')) as {
  examples: { name: string; js: string; rondo?: string }[];
};
const golden = JSON.parse(readFileSync(new URL('fixtures/golden.json', here), 'utf8')) as {
  cycles: number;
  pcm: Record<string, { js?: string; rondo?: string }>;
};

const env = { stageSource };
const pcmHash = (p: RondoPcm): string =>
  createHash('sha256')
    .update(new Uint8Array(p.left.buffer, p.left.byteOffset, p.left.byteLength))
    .update(new Uint8Array(p.right.buffer, p.right.byteOffset, p.right.byteLength))
    .digest('hex');

const example = (name: string) => {
  const e = examples.find((x) => x.name === name);
  assert.ok(e, `fixture has the "${name}" example`);
  return e;
};

/** Render N cycles exactly the way the golden reference did. */
async function renderCycles(source: string, lang: 'js' | 'rondo', cycles: number): Promise<RondoPcm> {
  // Read the tempo first, then ask for exactly cycles / cps seconds.
  const probe = await renderRondo({ source, lang, seconds: 0.05 }, env);
  return renderRondo({ source, lang, seconds: cycles / probe.cps }, env);
}

const FULL = process.env.LOLLY_RONDO_FULL === '1';
// Buses and sidechain, a custom-free wavetable, macros, sample slicing: one of each path.
const SPREAD = ['club', 'wavetable lead', 'macros', 'chop'];

for (const e of FULL ? examples : SPREAD.map(example)) {
  for (const lang of ['js', 'rondo'] as const) {
    const source = lang === 'js' ? e.js : e.rondo;
    const want = golden.pcm[e.name]?.[lang];
    if (!source || !want) continue;
    test(`vm render matches upstream's native render: ${e.name} (${lang})`, async () => {
      const pcm = await renderCycles(source, lang, golden.cycles);
      assert.equal(pcmHash(pcm), want);
      assert.equal(pcm.run.executionClass, 'vm');
      assert.equal(pcm.lang, lang);
    });
  }
}

const tiny = `const beep = synth(({ note, gate, adsr, sine }) => sine(note.freq).mul(adsr(gate, { a: 0.01, d: 0.1, s: 0.5, r: 0.1 })))
p('beep', note('c4 e4 g4 c5').sound('beep'))
setCps(1)`;

test('an explicit length renders exactly that many seconds', async () => {
  const pcm = await renderRondo({ source: tiny, seconds: 2.5 }, env);
  assert.equal(pcm.left.length, Math.round(2.5 * RONDO_LIMITS.sampleRate));
  assert.equal(pcm.cycles, 3);
  assert.ok(pcm.left.some((x) => x !== 0), 'the render is not silent');
});

test('with no length asked, an arranged rondo song renders its own arrangement', async () => {
  const src = example('arrangement').rondo;
  assert.ok(src);
  const pcm = await renderRondo({ source: src, lang: 'rondo' }, env);
  assert.ok(pcm.cycles > RONDO_LIMITS.defaultCycles, `arrangement length ${pcm.cycles} cycles`);
  assert.equal(pcm.seconds, pcm.cycles / pcm.cps);
});

test('auto picks the language the way upstream sniffs it', async () => {
  const r = await renderRondo({ source: example('acid').rondo as string, seconds: 0.1 }, env);
  assert.equal(r.lang, 'rondo');
  const j = await renderRondo({ source: tiny, seconds: 0.1 }, env);
  assert.equal(j.lang, 'js');
});

test('a part the render cannot play is named, not passed off as silence', async () => {
  const mic = await renderRondo({ source: example('live mic').js, seconds: 1 }, env);
  assert.deepEqual(mic.findings.find((f) => f.code === 'rondo.part.mic')?.parts, ['breath', 'talkbox']);
  const sung = await renderRondo({ source: example('singing').js, seconds: 1 }, env);
  assert.ok(sung.findings.some((f) => f.code === 'rondo.part.sing' && f.parts.length > 0));
});

test('the vm has no clock and no entropy: Math.random is seeded, so a render repeats', async () => {
  const src = `const beep = synth(({ note, gate, adsr, sine }) => sine(note.freq).mul(adsr(gate, { a: 0.01, d: 0.1, s: 0.5, r: 0.1 })))
const chosen = ['c4', 'e4', 'g4', 'b4'][Math.floor(Math.random() * 4)] + ' ' + (Date.now() === 0 ? 'c5' : 'c3')
p('beep', note(chosen).sound('beep'))
setCps(1)`;
  const a = await renderRondo({ source: src, seconds: 1 }, env);
  const b = await renderRondo({ source: src, seconds: 1 }, env);
  assert.equal(pcmHash(a), pcmHash(b));
});

// ---- containment -------------------------------------------------------------

const rejects = (source: string, code: RegExp, limits: Partial<RondoLimits> = {}) =>
  assert.rejects(renderRondo({ source, seconds: 1 }, { stageSource, limits }), (e: unknown) => {
    const c = (e as { code?: string }).code ?? '';
    assert.match(c, code, `error code was "${c}": ${(e as Error).message}`);
    return true;
  });

test('a song cannot reach the network, the process or a module loader', async () => {
  await rejects(`fetch('https://example.com'); ${tiny}`, /^rondo\.(evaluate|vm\.error)$/);
  await rejects(`globalThis.process.exit(1); ${tiny}`, /^rondo\.(evaluate|vm\.error)$/);
  await rejects(`require('fs'); ${tiny}`, /^rondo\.(evaluate|vm\.error)$/);
  await rejects(`const x = await import('node:fs'); ${tiny}`, /^rondo\.(evaluate|vm\.error)$/);
  await rejects(`if (typeof XMLHttpRequest !== 'undefined' || typeof WebSocket !== 'undefined' || typeof indexedDB !== 'undefined') throw new Error('host leaked'); throw new Error('contained')`, /^rondo\.evaluate$/);
});

test('a loop at the top level stops at the prepare deadline', async () => {
  await rejects('while (true) {}', /^rondo\.vm\.timeout$/, { prepareBudgetMs: 400 });
});

test('a loop inside a pattern stops at the schedule deadline', async () => {
  // Evaluation queries this pattern 42 times and one scheduled cycle 89 more
  // (measured), so the loop starts only once scheduling is under way.
  const src = `let queried = 0
const beep = synth(({ note, gate, sine }) => sine(note.freq).mul(gate))
p('beep', note('c4 e4').filterValues(() => { if (++queried > 60) while (true) {} return true }).sound('beep'))`;
  const started = Date.now();
  await rejects(src, /^rondo\.vm\.timeout$/, { scheduleBaseMs: 300, scheduleMsPerSecond: 0 });
  assert.ok(Date.now() - started < 5000, 'stopped by the schedule deadline, not the prepare one');
});

test('runaway memory and recursion end with a named error', async () => {
  await rejects('const a = []; while (true) a.push(new Array(1e6).fill(1))', /^rondo\.vm\.(memory|timeout)$/, { vmMemoryBytes: 32 * 1024 * 1024 });
  await rejects('function f(n) { return f(n + 1) + 1 } f(0)', /^rondo\.vm\.stack$|^rondo\.evaluate$/);
});

test('a song that rewrites JSON to forge the staged data is caught by the validator', async () => {
  const forged = JSON.stringify({
    ok: true, cps: 1,
    synths: { __map: [['x', { graph: { nodes: [{ id: 0, type: 'evil', inputs: {} }], out: 0, params: [] } }]] },
    events: { __map: [] }, buses: { __map: [] }, sends: [],
  });
  const src = `${tiny}
const realStringify = JSON.stringify
JSON.stringify = (v, r) => (v && v.synths ? ${JSON.stringify(forged)} : realStringify(v, r))`;
  await rejects(src, /^rondo\.staged\.invalid$/);
});

// ---- the validator on its own -----------------------------------------------

const minimal = () => ({
  ok: true,
  cps: 0.5,
  synths: { __map: [['s', { graph: { nodes: [{ id: 0, type: 'sine', inputs: { freq: 440 } }, { id: 1, type: 'out', inputs: { in: { node: 0 } } }], out: 1, params: [] } }]] },
  events: { __map: [['s', [{ time: 0, type: 'noteOn', note: 60, velocity: 1 }, { time: 0.5, type: 'noteOff', note: 60 }]]] },
  buses: { __map: [] },
  sends: [],
});

test('the validator accepts plain staged data', () => {
  const song = parseStaged(JSON.stringify(minimal()), 2);
  assert.equal(song.synths.size, 1);
  assert.equal(song.events.get('s')?.length, 2);
});

test('the validator refuses what it cannot vouch for', () => {
  const bad = (mutate: (o: Record<string, any>) => void, why: string) => {
    const o = minimal() as Record<string, any>;
    mutate(o);
    assert.throws(() => parseStaged(JSON.stringify(o), 2), StagedError, why);
  };
  bad((o) => { o.extra = 1; }, 'an unknown top-level field');
  bad((o) => { o.cps = 100; }, 'an impossible tempo');
  bad((o) => { o.synths.__map[0][1].graph.nodes[0].type = 'shell'; }, 'an unknown node type');
  bad((o) => { o.synths.__map[0][1].graph.out = 7; }, 'a graph whose out is missing');
  bad((o) => { o.events.__map[0][1][0].note = { __num: 'NaN' }; }, 'a NaN note');
  bad((o) => { o.events.__map[0][1][0].time = 1e9; }, 'an event far past the window');
  bad((o) => { o.synths.__map[0][1].graph.nodes[0].config = { deep: [[[[[[[[[[1]]]]]]]]]] }; }, 'config nested too deep');
  bad((o) => { o.synths.__map[0][1].maxVoices = 10_000; }, 'a voice count past the limit');
  assert.throws(() => parseStaged('{"ok":true,"__proto__":{"polluted":1}}', 2), StagedError, 'a prototype key');
  assert.throws(() => parseStaged('x'.repeat(RONDO_LIMITS.maxStagedChars + 1), 2), StagedError, 'an oversized result');
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
