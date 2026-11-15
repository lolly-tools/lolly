#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * The listening samples on the music genre pages (/info/music/<slug>/): one short M4A
 * per genre, rendered through the music generator's own code and signed the way its
 * Download signs, so each sample carries the same Content Credentials a person's
 * download does (lib/music-render.ts credentialMusicFile: procedural, no AI,
 * algorithmic media, the style and the seed).
 *
 *   node scripts/build-music-samples.ts             # render every recipe whose file is missing or stale
 *   node scripts/build-music-samples.ts --search    # try seeds, keep the best-measuring one, then render
 *   node scripts/build-music-samples.ts --only=jazz,dnb --force
 *
 * Options:
 *   --search        for each genre (or --only), render the excerpt from seeds 1 to --seeds
 *                   (default 6), measure each, keep the best and write the recipe
 *   --seeds=<n>     how many seeds --search tries
 *   --only=a,b      genre ids to work on
 *   --force         re-render and re-sign even when the file matches its recipe
 *   --url=<origin>  use a running Vite dev server of the web shell instead of starting one
 *   --parallel=<n>  pages rendering at once (default 3)
 *
 * Why pre-rendered files: the app needs WebGPU and a person's own device to compose,
 * while a crawler, a browser without WebGPU and a reader on a slow connection can all
 * play a 200 KB AAC file in a plain <audio> element. The recipe (genre, seed, length,
 * the bar the excerpt opens on) is committed beside the audio, so every file can be
 * rendered again and the page's "Make your own" link opens the same track.
 *
 * How a sample is cut: the track is the generator's default 64 bars. The excerpt is
 * anchored on the first drop (the chorus in the band genres, the bloom, the swell, the
 * montuno), or on the full groove in the Lofi moods (docs/music-pages.ts excerptAnchor).
 * The station starts `warmupBars` bars before the anchor (the generator's own seek,
 * LofiSettings.startBar), so reverbs and echoes are already ringing, and the sample
 * opens up to one bar before the anchor, so the build's last bar carries into the drop.
 * A short fade in, a longer fade out, then AAC at the recipe's bitrate (encodeM4a, the
 * generator's encoder), then the Content Credentials.
 *
 * Choosing a seed by its measurements (--search): each candidate's excerpt is measured
 * before encoding (RMS, peak, the quietest 400 ms after the anchor, how much the anchor
 * lifts the music over the lead-in, the share under 150 Hz and the stereo correlation).
 * A candidate whose music drops out after the anchor (a block 18 dB under the sample's
 * RMS) or that clips is set aside; of the rest, the one with the fullest music after
 * the anchor and the clearest lift into the anchor is kept. The numbers are written to
 * the recipe so a listener can check them, and a seed can be changed by hand: edit
 * docs/music/samples.json and run the script again.
 *
 * Needs Google Chrome (Playwright channel "chrome"): AAC encoding in WebCodecs comes
 * from the platform's encoder, which Playwright's own Chromium does not carry.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { chromium, type Browser, type Page } from 'playwright';
import { LOFI_MOODS, lofiSectionName, type LofiMood, type LofiSection } from '../engine/src/lofi-compose.ts';
import { ANCHOR_SECTIONS, GENRE_SLUG, type ExcerptSpec, type SampleMeasures, type SampleRecipe, type SampleSet } from '../docs/music-pages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES_JSON = join(ROOT, 'docs', 'music', 'samples.json');
const SAMPLES_DIR = join(ROOT, 'docs', 'music', 'samples');
const WEB_DIR = join(ROOT, 'shells', 'web');

/** How every sample is cut and encoded, unless samples.json already says otherwise. */
const DEFAULT_EXCERPT: ExcerptSpec = { seconds: 20, fadeIn: 0.5, fadeOut: 2.5, bitrate: 80_000, maxLeadIn: 2.6, warmupBars: 2 };
const BARS = 64;

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
};
const SEARCH = flag('search') !== undefined;
const FORCE = flag('force') !== undefined;
const SEEDS = Number(flag('seeds') ?? 6);
const PARALLEL = Math.max(1, Number(flag('parallel') ?? 3));
const ONLY = (flag('only') ?? '').split(',').map(s => s.trim()).filter(Boolean);
for (const id of ONLY) if (!(LOFI_MOODS as readonly string[]).includes(id)) throw new Error(`Unknown genre id: ${id}`);
const MOODS: LofiMood[] = ONLY.length ? (ONLY as LofiMood[]) : [...LOFI_MOODS];

function readSet(): SampleSet {
  if (!existsSync(SAMPLES_JSON)) return { version: 1, excerpt: DEFAULT_EXCERPT, samples: [] };
  return JSON.parse(readFileSync(SAMPLES_JSON, 'utf8')) as SampleSet;
}
function writeSet(set: SampleSet): void {
  const order = new Map(LOFI_MOODS.map((m, i) => [m, i]));
  set.samples.sort((a, b) => (order.get(a.style) ?? 0) - (order.get(b.style) ?? 0));
  mkdirSync(dirname(SAMPLES_JSON), { recursive: true });
  writeFileSync(SAMPLES_JSON, `${JSON.stringify(set, null, 2)}\n`);
}
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

// ── the dev server ──────────────────────────────────────────────────────────
async function freePort(): Promise<number> {
  return await new Promise((done, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address() as { port: number }; s.close(() => done(port)); });
  });
}
async function startServer(): Promise<{ origin: string; stop: () => void }> {
  const given = flag('url');
  if (given) return { origin: given.replace(/\/$/, ''), stop: () => {} };
  const port = await freePort();
  const child: ChildProcess = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: WEB_DIR, env: { ...process.env, LOLLY_PROFILE: process.env.LOLLY_PROFILE ?? 'lolly-demo' }, stdio: 'ignore',
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${origin}/src/lib/music-state.ts`)).ok) return { origin, stop: () => child.kill() }; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  child.kill();
  throw new Error('The web shell dev server did not start within a minute.');
}

// ── in the page ─────────────────────────────────────────────────────────────
interface Rendered {
  anchorBar: number; anchorSection: string; bpm: number; key: string;
  measured: SampleMeasures; bytes?: string; declaration?: string;
}

/** Render one excerpt in the page: the generator's station, its encoder and its signing. */
async function renderInPage(page: Page, origin: string, style: LofiMood, seed: number, ex: ExcerptSpec, encode: boolean): Promise<Rendered> {
  return await page.evaluate(async ({ origin, style, seed, bars, ex, encode, prefer }) => {
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ `${origin}${path}`);
    const [ms, st, enc, mr, gi] = await Promise.all([
      load('/src/lib/music-state.ts'), load('/src/lib/lofi-station.ts'), load('/src/lib/audio-encode.ts'),
      load('/src/lib/music-render.ts'), load('/src/lib/genre-icons.ts'),
    ]);
    const state = ms.parseMusicState(`style=${style}&seed=${seed}&bars=${bars}`);
    const track = ms.composeTrack(state) as Array<{ section: string; tune: { bpm: number; key: string; beats?: number } }>;
    const times = ms.barTimes(track) as { starts: number[]; total: number };
    const sections = track.map(b => b.section);
    // docs/music-pages.ts excerptAnchor, which the page cannot import: the first of these sections.
    let anchor = 0;
    for (const want of prefer) { const at = sections.indexOf(want); if (at > 0) { anchor = at; break; } }
    const startBar = Math.max(0, anchor - ex.warmupBars);
    const origin0 = times.starts[startBar]!;
    const anchorAt = times.starts[anchor]! - origin0;
    const barLen = anchor > 0 ? times.starts[anchor]! - times.starts[anchor - 1]! : 0;
    const leadIn = Math.min(barLen, ex.maxLeadIn, anchorAt);
    const from = anchorAt - leadIn;
    const seconds = from + ex.seconds + 0.25;
    const rate = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    const station = new st.LofiStation(ctx, ctx.destination, state.seed, { ...ms.trackSettings(state, startBar), quality: 'high' }, state.mix);
    const buf: AudioBuffer = await st.renderStation(ctx, station, seconds);
    const n = Math.round(ex.seconds * rate);
    const off = Math.round(from * rate);
    const chans = [0, 1].map(c => buf.getChannelData(c).slice(off, off + n));
    // Measure before the fades, on the music as it played.
    const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -120);
    let sum = 0, peak = 0, lr = 0, ll = 0, rr = 0, lowSum = 0, lp = [0, 0];
    const k = 1 - Math.exp(-2 * Math.PI * 150 / rate);
    for (let i = 0; i < n; i++) {
      const l = chans[0]![i]!, r = chans[1]![i]!;
      sum += l * l + r * r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
      lr += l * r; ll += l * l; rr += r * r;
      lp[0]! += k * (l - lp[0]!); lp[1]! += k * (r - lp[1]!);
      lowSum += lp[0]! * lp[0]! + lp[1]! * lp[1]!;
    }
    const rms = Math.sqrt(sum / (2 * n));
    const block = Math.round(0.4 * rate);
    const leadEnd = Math.round(leadIn * rate);
    let dip = 0, after = 0, afterN = 0, before = 0, beforeN = 0;
    for (let s = 0; s + block <= n; s += block) {
      let e = 0;
      for (let i = s; i < s + block; i++) e += chans[0]![i]! ** 2 + chans[1]![i]! ** 2;
      if (s + block <= leadEnd) { before += e; beforeN += block; continue; }
      if (s >= leadEnd && s + block <= n - Math.round(ex.fadeOut * rate)) {
        after += e; afterN += block;
        dip = Math.min(dip, db(Math.sqrt(e / (2 * block))) - db(rms));
      }
    }
    const measured = {
      rmsDb: +db(rms).toFixed(1), peakDb: +db(peak).toFixed(1), dipDb: +dip.toFixed(1),
      liftDb: beforeN && afterN ? +(db(Math.sqrt(after / (2 * afterN))) - db(Math.sqrt(before / (2 * beforeN)))).toFixed(1) : 0,
      lowDb: +(db(Math.sqrt(lowSum / (2 * n))) - db(rms)).toFixed(1),
      stereo: +(lr / Math.sqrt(ll * rr || 1)).toFixed(2),
    };
    const out: any = {
      anchorBar: anchor, anchorSection: sections[anchor],
      bpm: track[0]!.tune.bpm, key: track[0]!.tune.key, measured,
    };
    if (!encode) return out;
    // The fades: a raised cosine in, and out over the last seconds.
    const fi = Math.round(ex.fadeIn * rate), fo = Math.round(ex.fadeOut * rate);
    for (const ch of chans) {
      for (let i = 0; i < fi; i++) ch[i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / fi);
      for (let i = 0; i < fo; i++) ch[n - 1 - i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / fo);
    }
    const pcm = { sampleRate: rate, channels: chans };
    const blob: Blob = await enc.encodeM4a(pcm, { bitrate: ex.bitrate });
    // The credential's title as the generator's Download writes it (views/music-studio.ts
    // trackName), marked as a sample.
    const name = `${gi.genreTitle(style)} · ${track[0]!.tune.key} · ${track[0]!.tune.bpm} bpm · ${seed} · sample`;
    const signed = await mr.credentialMusicFile(undefined, blob, 'm4a', state, name);
    const bytes = new Uint8Array(await signed.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out.bytes = btoa(bin);
    out.declaration = signed.declaration;
    return out;
  }, { origin, style, seed, bars: BARS, ex, encode, prefer: [...ANCHOR_SECTIONS] }) as Rendered;
}

/** A candidate's score: the fullest music after the anchor and the clearest lift into the
 *  anchor, with any drop-out or clip set aside. */
function score(m: SampleMeasures): number {
  if (m.dipDb < -18 || m.peakDb > -0.1) return -Infinity;
  return m.rmsDb + 0.5 * Math.min(m.liftDb, 8);
}

async function main(): Promise<void> {
  const set = readSet();
  const ex = set.excerpt ?? DEFAULT_EXCERPT;
  const server = await startServer();
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const pages: Page[] = [];
    for (let i = 0; i < PARALLEL; i++) {
      const page = await (await browser.newContext()).newPage();
      page.on('pageerror', e => console.warn(`  page error: ${e.message.slice(0, 200)}`));
      await page.goto(`${server.origin}/favicon.ico`);
      pages.push(page);
    }
    const renderWith = async (page: Page, style: LofiMood, seed: number, encode: boolean): Promise<Rendered> => {
      try {
        const r = await renderInPage(page, server.origin, style, seed, ex, encode);
        return { ...r, anchorSection: lofiSectionName(style, r.anchorSection as LofiSection) };
      } catch (e) {
        throw new Error(`${style} seed ${seed}: ${(e as Error).message}`);
      }
    };
    const work = [...MOODS];
    const recipes = new Map(set.samples.map(s => [s.style, s]));
    const jobs: Array<() => Promise<void>> = [];
    for (const style of work) {
      jobs.push(async () => {
        const page = pages.pop()!;
        try {
          let recipe = recipes.get(style);
          if (SEARCH) {
            let best: { seed: number; s: number; r: Rendered } | null = null;
            for (let seed = 1; seed <= SEEDS; seed++) {
              const r = await renderWith(page, style, seed, false);
              const s = score(r.measured);
              console.log(`  ${style.padEnd(14)} seed ${String(seed).padStart(2)}  ${fmt(r.measured)}  score ${Number.isFinite(s) ? s.toFixed(1) : 'set aside'}`);
              if (!best || s > best.s) best = { seed, s, r };
            }
            recipe = { ...(recipe ?? blankRecipe(style)), seed: best!.seed };
          }
          if (!recipe) { console.log(`  ${style}: no recipe (run with --search)`); return; }
          const file = join(SAMPLES_DIR, recipe.file);
          const fresh = existsSync(file) && sha256(readFileSync(file)) === recipe.sha256 && !FORCE && !SEARCH;
          if (fresh) { console.log(`✓ ${style}: ${recipe.file} matches its recipe`); return; }
          const r = await renderWith(page, style, recipe.seed, true);
          const bytes = Buffer.from(r.bytes!, 'base64');
          mkdirSync(SAMPLES_DIR, { recursive: true });
          writeFileSync(file, bytes);
          recipes.set(style, {
            ...recipe, bars: BARS, anchorBar: r.anchorBar, anchorSection: r.anchorSection, bpm: r.bpm, key: r.key,
            bytes: bytes.length, sha256: sha256(bytes), declaration: r.declaration ?? '', measured: r.measured,
          });
          console.log(`✚ ${style}: seed ${recipe.seed}, ${r.anchorSection} at bar ${r.anchorBar + 1}, ${(bytes.length / 1024).toFixed(0)} KB  ${fmt(r.measured)}`);
          writeSet({ version: 1, excerpt: ex, samples: [...recipes.values()] });
        } finally {
          pages.push(page);
        }
      });
    }
    await runPool(jobs, PARALLEL);
    const all = [...recipes.values()];
    const total = all.reduce((n, s) => n + (s.bytes || 0), 0);
    console.log(`\n${all.length} samples, ${(total / 1e6).toFixed(2)} MB in docs/music/samples/`);
  } finally {
    await browser?.close();
    server.stop();
  }
}

function blankRecipe(style: LofiMood): SampleRecipe {
  return {
    style, seed: 1, bars: BARS, anchorBar: 0, anchorSection: '', bpm: 0, key: '', file: `${GENRE_SLUG[style]}.m4a`,
    bytes: 0, sha256: '', declaration: '',
    measured: { rmsDb: 0, peakDb: 0, dipDb: 0, liftDb: 0, lowDb: 0, stereo: 0 },
  };
}
const fmt = (m: SampleMeasures): string =>
  `rms ${m.rmsDb} dB  peak ${m.peakDb}  dip ${m.dipDb}  lift ${m.liftDb}  low ${m.lowDb}  stereo ${m.stereo}`;

async function runPool(jobs: Array<() => Promise<void>>, n: number): Promise<void> {
  let next = 0;
  const failures: string[] = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      try { await job(); } catch (e) { failures.push((e as Error).message); console.error(`✗ ${(e as Error).message}`); }
    }
  }));
  if (failures.length) { process.exitCode = 1; }
}

await main();
