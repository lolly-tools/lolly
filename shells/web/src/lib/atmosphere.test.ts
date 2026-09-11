// SPDX-License-Identifier: MPL-2.0
/*
 * atmosphere.ts - the background-noise mixer under the Neurospicy player.
 *
 * Run directly:  node --test shells/web/src/lib/atmosphere.test.ts
 *
 * These drive the REAL module against a jsdom document and a fake AudioContext that
 * records what was built, started and stopped - so the promises the feature makes
 * are actually checked rather than assumed:
 *   - a layer only sounds when the user put it above zero, and stops at zero;
 *   - the master mute silences everything and un-muting restores exactly what was up;
 *   - levels reach the profile and survive a reload, including a hostile stored blob;
 *   - ambience connects to the DESTINATION, never to the music gain - that separation
 *     is the whole point (noise under music, mixed independently).
 * The DSP itself is covered by ambience-dsp.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/' });

// ── a fake Web Audio graph ───────────────────────────────────────────────────
class FakeParam {
  value = 0;
  targets: number[] = [];
  setTargetAtTime(v: number): void { this.value = v; this.targets.push(v); }
  cancelScheduledValues(): void { /* nothing scheduled in the fake */ }
}
class FakeNode {
  connectedTo: unknown[] = [];
  connect(dest: unknown): void { this.connectedTo.push(dest); }
  disconnect(): void { /* recorded via stopped/started instead */ }
}
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
}
class FakeBuffer {
  // Plain fields, not parameter properties: node runs this .ts by type-stripping,
  // which can't rewrite `constructor(public x)`.
  channels: Float32Array[];
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  copyToChannel(src: Float32Array, ch: number): void { this.channels[ch]!.set(src); }
}
class FakeAudioContext {
  // Low rate: these tests bake real PCM through the real DSP, and nothing here
  // depends on fidelity.
  sampleRate = 8000;
  currentTime = 0;
  state = 'running';
  destination = new FakeNode();
  sources: FakeSource[] = [];
  createGain(): FakeGain { return new FakeGain(); }
  createAnalyser(): FakeNode & { fftSize: number; smoothingTimeConstant: number } {
    return Object.assign(new FakeNode(), { fftSize: 0, smoothingTimeConstant: 0 });
  }
  createBufferSource(): FakeSource { const s = new FakeSource(); this.sources.push(s); return s; }
  createBuffer(ch: number, len: number, rate: number): FakeBuffer { return new FakeBuffer(ch, len, rate); }
  resume(): Promise<void> { return Promise.resolve(); }
}
(dom.window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;

globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
// Node has its own Event class, and jsdom's dispatchEvent refuses it - the module
// builds its cross-player notification with the ambient `Event`, so hand it jsdom's.
globalThis.Event = dom.window.Event;
// Interface sound defaults to MUTED for a new user, and mute is the master mute here
// - so an unmuted baseline is what these tests need.
localStorage.setItem('lolly:sfxMuted', '0');

const {
  setAtmosphereLevel, toggleAtmosphereLayer, atmosphereLevel, activeAtmosphereCount,
  applyAtmosphere, stopAtmosphere, isAtmospherePlaying, hydrateAtmosphere,
  getAtmosphere, rememberedLevel, setAtmospherePanelOpen, ATMOSPHERE_LAYERS,
} = await import('./atmosphere.ts');
const { neuroAudioContext } = await import('./neurospicy.ts');
const { setSfxMuted } = await import('./sfx.ts');

const ctx = neuroAudioContext() as unknown as FakeAudioContext;

/** A host that records what would be persisted to the profile. */
function fakeHost() {
  const saved: Record<string, unknown>[] = [];
  return {
    saved,
    host: {
      profile: {
        get: async (): Promise<object> => ({ firstname: 'Andy' }),
        set: async (p: object): Promise<unknown> => { saved.push(p as Record<string, unknown>); return p; },
      },
    },
  };
}

/** Let the lazy bake (a microtask + the synchronous DSP pass) land. */
const settle = async (): Promise<void> => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

/** Back to silence between tests, without carrying a stored blob forward. */
function reset(): void {
  stopAtmosphere();
  for (const l of ATMOSPHERE_LAYERS) setAtmosphereLevel(null, l.id, 0);
  ctx.sources.length = 0;
}

const sounding = (): FakeSource[] => ctx.sources.filter((s) => s.started && !s.stopped);

// ─── a layer sounds only when the user asks for it ───────────────────────────

test('nothing sounds until a level is set, and zero stops it again', async () => {
  reset();
  assert.equal(isAtmospherePlaying(), false, 'silent at rest');
  assert.equal(sounding().length, 0);

  setAtmosphereLevel(null, 'rain', 0.4);
  await settle();
  assert.equal(sounding().length, 1, 'one bed sounding');
  assert.equal(atmosphereLevel('rain'), 0.4);
  assert.equal(activeAtmosphereCount(), 1);
  const src = sounding()[0]!;
  assert.equal(src.loop, true, 'a bed must loop - it is a bed, not a clip');
  assert.ok(src.buffer, 'a real baked buffer is attached');

  setAtmosphereLevel(null, 'rain', 0);
  assert.equal(src.stopped, true, 'zero stops the source');
  assert.equal(atmosphereLevel('rain'), 0);
  assert.equal(isAtmospherePlaying(), false);
});

test('ambience connects to the destination, NOT through the music gain', async () => {
  reset();
  setAtmosphereLevel(null, 'pink', 0.5);
  await settle();
  const src = sounding()[0]!;
  // source → gain → destination. If the gain ever landed on the music graph's node
  // instead, the music volume slider would drag the ambience with it.
  const gain = src.connectedTo[0] as FakeGain;
  assert.ok(gain instanceof FakeGain, 'source feeds its own gain');
  assert.deepEqual(gain.connectedTo, [ctx.destination], 'that gain feeds the destination directly');
  reset();
});

test('layers stack - several beds sound at once, each with its own level', async () => {
  reset();
  setAtmosphereLevel(null, 'rain', 0.3);
  setAtmosphereLevel(null, 'brown', 0.6);
  setAtmosphereLevel(null, 'fire', 0.2);
  await settle();
  assert.equal(sounding().length, 3);
  assert.equal(activeAtmosphereCount(), 3);
  assert.deepEqual(
    [atmosphereLevel('rain'), atmosphereLevel('brown'), atmosphereLevel('fire')],
    [0.3, 0.6, 0.2],
  );
  reset();
});

test('a level change on a sounding layer moves its gain, it does not restart the bed', async () => {
  reset();
  setAtmosphereLevel(null, 'wind', 0.2);
  await settle();
  const src = sounding()[0]!;
  const gain = src.connectedTo[0] as FakeGain;
  setAtmosphereLevel(null, 'wind', 0.8);
  await settle();
  assert.equal(sounding().length, 1, 'still one source - no restart');
  assert.equal(sounding()[0], src, 'the SAME source');
  assert.equal(gain.gain.value, 0.8);
  reset();
});

// ─── the icon toggle remembers where you had it ──────────────────────────────

test('the icon toggle returns a layer to the level it last had', async () => {
  reset();
  setAtmosphereLevel(null, 'waves', 0.65);
  await settle();
  assert.equal(toggleAtmosphereLayer(null, 'waves'), 0, 'toggling off returns 0');
  assert.equal(atmosphereLevel('waves'), 0);
  assert.equal(rememberedLevel('waves'), 0.65, 'the level is remembered');
  const back = toggleAtmosphereLayer(null, 'waves');
  await settle();
  assert.equal(back, 0.65, 'toggling on returns to where the user had it');
  assert.equal(atmosphereLevel('waves'), 0.65);
  reset();
});

test('a layer never touched comes on at an audible default, not silent', () => {
  reset();
  const level = toggleAtmosphereLayer(null, 'white');
  assert.ok(level > 0 && level <= 1, `default level ${level} must be audible`);
  reset();
});

// ─── master mute ─────────────────────────────────────────────────────────────

test('muting silences every bed and un-muting restores exactly what was up', async () => {
  reset();
  setAtmosphereLevel(null, 'rain', 0.4);
  setAtmosphereLevel(null, 'brown', 0.7);
  await settle();
  assert.equal(sounding().length, 2);

  setSfxMuted(true);
  applyAtmosphere();
  assert.equal(sounding().length, 0, 'mute stops the sources');
  assert.equal(atmosphereLevel('rain'), 0.4, 'but the levels are KEPT');
  assert.equal(activeAtmosphereCount(), 2);

  setSfxMuted(false);
  applyAtmosphere();
  await settle();
  assert.equal(sounding().length, 2, 'un-mute brings back both');
  setSfxMuted(false);
  reset();
});

test('a level raised while muted stays silent until the mute lifts', async () => {
  reset();
  setSfxMuted(true);
  setAtmosphereLevel(null, 'fire', 0.5);
  await settle();
  assert.equal(sounding().length, 0, 'nothing sounds while muted');
  assert.equal(atmosphereLevel('fire'), 0.5, 'the intent is still recorded');
  setSfxMuted(false);
  applyAtmosphere();
  await settle();
  assert.equal(sounding().length, 1);
  reset();
});

// ─── persistence ─────────────────────────────────────────────────────────────

test('levels reach the profile and the local mirror', async () => {
  reset();
  const { host, saved } = fakeHost();
  setAtmosphereLevel(host, 'rain', 0.45);
  await settle();
  const last = saved.at(-1)!;
  assert.equal(last.firstname, 'Andy', 'the rest of the profile is preserved');
  assert.deepEqual((last.atmosphere as { levels: Record<string, number> }).levels, { rain: 0.45 });
  const mirror = JSON.parse(localStorage.getItem('lolly:atmosphere')!) as { levels: Record<string, number> };
  assert.deepEqual(mirror.levels, { rain: 0.45 });
  reset();
});

test('the panel fold is remembered too', () => {
  setAtmospherePanelOpen(true);
  assert.equal(getAtmosphere().open, true);
  assert.equal((JSON.parse(localStorage.getItem('lolly:atmosphere')!) as { open: boolean }).open, true);
  setAtmospherePanelOpen(false);
  assert.equal(getAtmosphere().open, false);
});

test('a hostile or corrupt stored blob degrades to silence, never to a broken mixer', () => {
  reset();
  hydrateAtmosphere({
    levels: { rain: 5, waves: -2, wind: 'loud', constructor: 1, __proto__: 1, notALayer: 0.5, fire: 0.3 },
    open: 'yes',
  });
  const s = getAtmosphere();
  // Only real layers survive: an over-range level clamps into range (a set-up worth
  // keeping, just impossible as stored), while a negative or non-numeric one is
  // simply off. Junk keys can't reach the mixer at all, because the whitelist
  // iterates OUR layer list rather than the stored object's keys.
  assert.deepEqual(s.levels, { rain: 1, fire: 0.3 }, 'clamped in range; unknown keys dropped');
  assert.equal(s.open, false, 'a non-boolean fold is not truthy-coerced');
  assert.equal(({} as Record<string, unknown>).notALayer, undefined, 'nothing was written to Object.prototype');
  reset();
});

test('a renamed layer keeps the level it was stored under', () => {
  reset();
  // The bed built as café babble came out sounding like windchimes and was renamed.
  // Anyone who already had it turned up must keep their level rather than finding
  // the layer silently at zero.
  hydrateAtmosphere({ levels: { cafe: 0.55 }, open: true });
  assert.equal(atmosphereLevel('chimes'), 0.55, 'the old key migrates to the new one');
  assert.equal(activeAtmosphereCount(), 1, 'and does not count twice');
  // An explicit NEW-key level always wins - a stale legacy key must not overwrite it.
  hydrateAtmosphere({ levels: { cafe: 0.2, chimes: 0.7 }, open: false });
  assert.equal(atmosphereLevel('chimes'), 0.7);
  reset();
});

test('hydration seeds the toggle memory, so a restored layer toggles back to ITS level', () => {
  reset();
  hydrateAtmosphere({ levels: { waves: 0.8 }, open: true });
  assert.equal(rememberedLevel('waves'), 0.8);
  reset();
});

test('stopAtmosphere silences everything but keeps the levels for next time', async () => {
  reset();
  setAtmosphereLevel(null, 'rain', 0.4);
  await settle();
  stopAtmosphere();
  assert.equal(sounding().length, 0);
  assert.equal(atmosphereLevel('rain'), 0.4, 'the set-up survives - this is a stop, not a reset');
  reset();
});
