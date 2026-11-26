// SPDX-License-Identifier: MPL-2.0
/** A finite local specimen run. No model download, account access or publication. */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { cpus, platform, release, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { integratedLoudness } from '../engine/src/audio-loudness.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { colorToHex, createTokenSet } from '../engine/src/tokens.ts';
import { serializeUrlState } from '../engine/src/url-mode.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { packWav, parseWav } from '../engine/src/wav.ts';
import { mixSequenceAudio } from '../packages/node-shell/src/sequence-audio.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import {
  createNodeSpeechAPI,
  modelFilePath,
  resolveModelsDir,
  SPEECH_MODEL_FILES,
} from '../packages/node-shell/src/speech.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import {
  buildLollyFile,
  LOLLY_PROJECT_TOOL_ID,
  readLollyFile,
} from '../shells/web/src/lib/lolly-pack.ts';
import type {} from './media-study/browser.ts';
import {
  costSummary,
  type StudyAttempt,
  type StudyLedger,
  unknownCosts,
} from './media-study/records.ts';
import { reviewPage, type SpecimenResult } from './media-study/report.ts';
import {
  type Colours,
  captions,
  corpus,
  designBoxes,
  musicQuery,
  webVtt,
} from './media-study/specimens.ts';
import { type ProjectSpecSession, specToProject } from './pack-project.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write(
      'node scripts/media-study.ts [--out=<new-directory>] [--models=<existing-model-directory>] [--video=all|representative|none]\n'
    );
    return;
  }
  if (args.some((a) => !/^--(out|models|video)=.+$/.test(a)))
    throw new Error('Unknown option. Use --help.');
  const option = (key: string) =>
    args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const videoMode = option('video') ?? 'representative';
  if (!['all', 'representative', 'none'].includes(videoMode))
    throw new Error('--video must be all, representative or none.');
  const startedAt = new Date().toISOString();
  const cancellation = new AbortController();
  const cancel = () =>
    cancellation.abort(new Error('Study interrupted; completed evidence is retained.'));
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const runId = startedAt.replace(/[:.]/g, '-');
  const out = resolve(option('out') ?? join(ROOT, 'plans', 'artifacts', '358', runId));
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out); // A run never overwrites retained evidence.
  process.stdout.write(`Study output: ${out}\n`);
  const corpusBytes = await readFile(join(ROOT, 'examples/open-media/corpus.json'));
  const tokensBytes = await readFile(join(ROOT, corpus.identity.designSystem));
  const tokens = JSON.parse(tokensBytes.toString());
  const set = createTokenSet(tokens, { theme: 'light' });
  const colours = Object.fromEntries(
    ['primary', 'secondary', 'surface', 'text', 'muted'].map((key) => {
      const colour = colorToHex(set.resolve(`color.semantic.${key}`));
      if (!colour) throw new Error(`Missing design-system colour: ${key}`);
      return [key, colour];
    })
  ) as unknown as Colours;
  const ledger: StudyLedger = {
    version: 1,
    runId,
    startedAt,
    environment: {
      engine: ENGINE_VERSION,
      gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
      sourceDiffSha256: sha(execFileSync('git', ['diff', 'HEAD'], { cwd: ROOT })),
      node: process.version,
      os: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      memoryBytes: totalmem(),
      corpusSha256: sha(corpusBytes),
      tokensSha256: sha(tokensBytes),
      lockfileSha256: sha(await readFile(join(ROOT, 'pnpm-lock.yaml'))),
      voice: corpus.identity.voice,
      voiceSpeed: corpus.identity.voiceSpeed,
      speechRuntime: 'local Kokoro via createNodeSpeechAPI',
      videoMode,
      unmeasuredSetup: [
        'Creative authoring',
        'Implementation',
        'Model and dependency provisioning',
        'Human review',
      ],
      caution:
        'First-in-process is not a cold machine or cold filesystem cache. Development intermediates have no export credentials.',
    },
    attempts: [],
    costs: [],
    decisions: [],
    publications: [],
  };
  const results: SpecimenResult[] = [];
  const sessions: ProjectSpecSession[] = [];
  const retained = new Map<string, { path: string; sha256: string; bytes: number }>();
  const save = async (name: string, bytes: Uint8Array | string) => {
    await writeFile(join(out, name), bytes);
    const artifact = {
      path: name,
      sha256: sha(bytes),
      bytes: typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.byteLength,
    };
    retained.set(name, artifact);
    return artifact;
  };
  const checkpoint = async () => {
    await writeFile(join(out, 'ledger.json.tmp'), json(ledger));
    await rename(join(out, 'ledger.json.tmp'), join(out, 'ledger.json'));
    await save('index.html', reviewPage(ledger, results));
    await writeFile(
      join(out, 'manifest.json'),
      json({
        version: 1,
        runId,
        state: 'candidate',
        environment: ledger.environment,
        files: [...retained.values()],
        costSummary: costSummary(ledger),
        review: 'pending',
        publication: 'not-requested',
      })
    );
  };
  const observed = new Set<string>();
  async function attempt<T>(
    editionId: string,
    outputId: string,
    operation: string,
    action: (record: StudyAttempt) => Promise<T>
  ): Promise<T | null> {
    cancellation.signal.throwIfAborted();
    const start = performance.now();
    const record: StudyAttempt = {
      id: `${runId}-${ledger.attempts.length + 1}`,
      editionId,
      outputId,
      operation,
      startedAt: new Date().toISOString(),
      endedAt: '',
      elapsedMs: 0,
      condition: observed.has(operation) ? 'warm' : 'first-in-process',
      outcome: 'running',
      findings: [],
      artifacts: [],
    };
    observed.add(operation);
    ledger.attempts.push(record);
    await checkpoint();
    let result: T | null = null;
    const timeout = setTimeout(
      () => cancellation.abort(new Error(`Study operation exceeded three minutes: ${operation}`)),
      180_000
    );
    try {
      result = await action(record);
      cancellation.signal.throwIfAborted();
      record.outcome = 'succeeded';
    } catch (error) {
      record.outcome = 'failed';
      record.findings.push(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
    record.endedAt = new Date().toISOString();
    record.elapsedMs = performance.now() - start;
    ledger.costs.push(...unknownCosts(record));
    await checkpoint();
    process.stdout.write(
      `${record.outcome}: ${editionId}/${outputId} ${Math.round(record.elapsedMs)} ms${record.findings.length ? ` (${record.findings.join('; ')})` : ''}\n`
    );
    return result;
  }
  await save('corpus.json', corpusBytes);
  await save('design-system.json', tokensBytes);
  await save(
    'review-template.json',
    json({
      version: 1,
      runId,
      state: 'pending',
      reviewer: null,
      method: corpus.review.method,
      questions: corpus.review.questions,
      observations: [],
      decisions: [],
    })
  );
  await checkpoint();
  const setup = await attempt('setup', 'renderer', 'setup', async (record) => {
    const bundled = await build({
      entryPoints: [join(ROOT, 'scripts/media-study/browser.ts')],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'chrome120',
      loader: { '.css': 'empty' },
      define: { 'process.env.NODE_ENV': '"production"' },
      logLevel: 'silent',
      metafile: true,
    });
    const bundle = bundled.outputFiles[0]!.text;
    record.artifacts.push(await save('renderer.js', bundle));
    const inputs = await Promise.all(
      Object.keys(bundled.metafile.inputs)
        .sort()
        .map(async (file) =>
          file.startsWith('(disabled):')
            ? { path: file, state: 'disabled-by-browser-package-map' }
            : { path: file, sha256: sha(await readFile(resolve(ROOT, file))) }
        )
    );
    record.artifacts.push(await save('renderer-inputs.json', json(inputs)));
    record.artifacts.push(
      await save(
        'runner-inputs.json',
        json(
          await Promise.all(
            [
              'scripts/media-study.ts',
              'scripts/media-study/records.ts',
              'scripts/media-study/specimens.ts',
              'scripts/media-study/report.ts',
              'packages/node-shell/src/speech.ts',
              'packages/node-shell/src/sequence-audio.ts',
              'community/design/tool.json',
              'community/design/hooks.js',
              'community/design/template.html',
            ].map(async (path) => ({ path, sha256: sha(await readFile(join(ROOT, path))) }))
          )
        )
      )
    );
    const fonts = [
      ['Outfit', 'Outfit-latin[wght].woff2'],
      ['SUSE', 'SUSE[wght].woff2'],
    ];
    const fontCss: string[] = [];
    for (const [family, file] of fonts) {
      const bytes = await readFile(join(ROOT, 'shells/web/public/fonts', file!));
      record.artifacts.push(await save(file!, bytes));
      fontCss.push(
        `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${bytes.toString('base64')});font-weight:100 900}`
      );
    }
    for (const file of ['OFL-SUSE.txt', 'OFL-Outfit.txt'])
      record.artifacts.push(
        await save(file, await readFile(join(ROOT, 'shells/web/public/fonts', file)))
      );
    return { bundle, fontCss: fontCss.join('\n') };
  });
  if (!setup) throw new Error(`Renderer setup failed; evidence retained at ${out}`);
  const server = createServer((request, response) => {
    if (request.url === '/renderer.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(setup.bundle);
    } else if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        '<!doctype html><html><head><title>Local media study</title></head><body><script type="module" src="/renderer.js"></script></body></html>'
      );
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('auto') });
  const dom = new JSDOM('<!doctype html><body></body>');
  try {
    ledger.environment.browser = browser.version();
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.goto(`http://127.0.0.1:${port}`);
    await page.waitForFunction(() => !!window.mediaStudy);
    const tool = await loadTool('design', (path) =>
      readFile(join(ROOT, 'community', path), 'utf8')
    );
    const host = await createCliBridge({ dom, tokensDocument: tokens, catalogAssets: [] });
    const speech = createNodeSpeechAPI({
      ...(option('models') ? { modelsDir: resolve(option('models')!) } : {}),
    });
    if (!speech)
      throw new Error('The local speech runtime is unavailable. Install workspace dependencies.');
    cancellation.signal.addEventListener(
      'abort',
      () => {
        void browser.close();
      },
      { once: true }
    );
    await attempt('setup', 'speech-models', 'setup', async (record) => {
      const directory = resolveModelsDir({
        ...(option('models') ? { modelsDir: resolve(option('models')!) } : {}),
      });
      const models = await Promise.all(
        SPEECH_MODEL_FILES.kokoro.map(async (pin) => {
          const bytes = await readFile(modelFilePath(directory, 'kokoro', pin.path));
          return { path: pin.path, bytes: bytes.byteLength, sha256: sha(bytes) };
        })
      );
      record.artifacts.push(await save('speech-models.json', json(models)));
    });
    const hydrate = async (boxes: Record<string, unknown>[]) => {
      const runtime = await createRuntime(tool, host, {
        boxes: boxes as never,
      });
      if (runtime.hookErrors.length)
        throw new Error(`Design hooks: ${JSON.stringify(runtime.hookErrors)}`);
      return runtime.getHydrated();
    };
    for (const story of corpus.stories) {
      const spoken = await attempt(story.id, `${story.id}-speech`, 'speech', async (record) => {
        const result = await speech.synthesize(story.script, {
          voice: corpus.identity.voice,
          speed: corpus.identity.voiceSpeed,
          signal: cancellation.signal,
        });
        const cues = captions(result.words, result.granularity);
        if (result.duration > 60 || result.duration < 5)
          throw new Error(`Narration outside study bounds: ${result.duration} seconds`);
        record.artifacts.push(
          await save(
            `${story.id}-speech.wav`,
            packWav({ channels: [result.pcm], sampleRate: result.sampleRate })
          )
        );
        record.artifacts.push(
          await save(
            `${story.id}-timing.json`,
            json({
              voice: corpus.identity.voice,
              speed: corpus.identity.voiceSpeed,
              duration: result.duration,
              sampleRate: result.sampleRate,
              granularity: result.granularity,
              words: result.words,
            })
          )
        );
        record.artifacts.push(await save(`${story.id}.vtt`, webVtt(cues, 0.5)));
        return { ...result, cues };
      });
      if (!spoken) continue;
      const seconds = Math.ceil((spoken.duration + 2) * 24) / 24;
      for (const mode of corpus.modes) {
        const id = `${story.id}-${mode.id}`;
        const candidate = await attempt(story.id, id, 'music-and-mix', async (record) => {
          const music = await page.evaluate(
            ({ query, seconds }) => window.mediaStudy.music(query, seconds),
            { query: musicQuery(story, mode), seconds }
          );
          const bedBytes = Buffer.from(music.wav, 'base64');
          const bed = parseWav(bedBytes);
          const plan = {
            totalSec: seconds,
            clips: [{ id: 'speech', startMs: 500, durMs: spoken.duration * 1000 }],
            bed: { id: 'bed', volume: mode.bedVolume, duck: mode.duck, fadeIn: 0.3, fadeOut: 1.5 },
            normalize: -16,
          };
          const mix = mixSequenceAudio(plan, {
            speech: { channels: [spoken.pcm], sampleRate: spoken.sampleRate },
            bed,
          });
          if (mix.warnings.length || !mix.hasBed || !mix.hasClipAudio)
            throw new Error(`Mix incomplete: ${mix.warnings.join('; ')}`);
          const mixBytes = packWav(mix);
          const facts = {
            settings: music.state,
            canonical: music.canonical,
            originalTrackSeconds: music.onceSeconds,
            excerptSeconds: seconds,
            ending:
              'A retained excerpt with a 1.5 second mix fade; no claim of a composed cadence.',
            speechTiming: spoken.granularity,
            mixPlan: plan,
            mixIntegratedLufs: integratedLoudness(mix.channels, mix.sampleRate),
            bedIntegratedLufs: integratedLoudness(bed.channels, bed.sampleRate),
            sampleRate: mix.sampleRate,
            review: 'pending',
            sourceTypes: ['procedural music: no trained model', 'AI speech: local Kokoro'],
          };
          record.artifacts.push(
            await save(`${id}-bed.wav`, bedBytes),
            await save(`${id}-mix.wav`, mixBytes),
            await save(
              `${id}.lofi.json`,
              json({
                kind: 'lolly-lofi-tune',
                version: 2,
                mood: music.state.mood,
                seed: music.state.seed,
                generator: music.canonical,
              })
            ),
            await save(`${id}-recipe.json`, json(facts))
          );
          return { music, mixBytes, facts };
        });
        if (!candidate) continue;
        const sample: SpecimenResult = {
          id,
          storyId: story.id,
          modeId: mode.id,
          musicLink: `https://lolly.tools/#/music?${candidate.music.canonical}`,
          bed: `${id}-bed.wav`,
          mix: `${id}-mix.wav`,
          still: `${id}.png`,
          facts: candidate.facts,
        };
        const visual = await attempt(story.id, `${id}-visual`, 'design-still', async (record) => {
          const stillBoxes = designBoxes(story, mode, colours);
          const motionBoxes = designBoxes(
            story,
            mode,
            colours,
            seconds,
            spoken.cues,
            `data:audio/wav;base64,${Buffer.from(candidate.mixBytes).toString('base64')}`
          );
          record.artifacts.push(
            await save(
              `${id}.design.json`,
              json({
                toolId: 'design',
                values: { boxes: motionBoxes },
                sourceTypes: candidate.facts.sourceTypes,
              })
            )
          );
          await page.evaluate(({ html, css }) => window.mediaStudy.mount(html, css), {
            html: await hydrate(stillBoxes),
            css: `${setup.fontCss}\n${tool.styles ?? ''}`,
          });
          await page.evaluate(() => document.fonts.ready);
          const png = await page.locator('.lolly-frame-page, .artboard').first().screenshot();
          record.artifacts.push(await save(`${id}.png`, png));
          sessions.push({
            key: id,
            toolId: 'design',
            label: `${story.title} / ${mode.label}`,
            values: { boxes: motionBoxes },
          });
          const boxInput = tool.manifest.inputs.find((i) => i.id === 'boxes');
          if (!boxInput) throw new Error('Design no longer declares boxes.');
          sample.designLink = `https://lolly.tools/#/tool/design?${serializeUrlState([{ ...boxInput, value: stillBoxes as never }], { width: 960, height: 540 })}`;
          return motionBoxes;
        });
        if (!visual) continue;
        results.push(sample);
        const chosen = corpus.modes[corpus.stories.indexOf(story)]!.id === mode.id;
        if (videoMode === 'all' || (videoMode === 'representative' && chosen)) {
          await attempt(story.id, `${id}-video`, 'design-video', async (record) => {
            await page.evaluate(({ html, css }) => window.mediaStudy.mount(html, css), {
              html: await hydrate(visual),
              css: `${setup.fontCss}\n${tool.styles ?? ''}`,
            });
            await page.evaluate(() => document.fonts.ready);
            const movie = await page.evaluate(
              (seconds) => window.mediaStudy.video(seconds),
              seconds
            );
            record.artifacts.push(await save(`${id}.webm`, Buffer.from(movie.data, 'base64')));
            sample.video = `${id}.webm`;
            sample.facts = { ...sample.facts, video: movie.facts };
          });
        }
      }
    }
    if (sessions.length)
      await attempt('package', 'editable-project', 'package', async (record) => {
        const { project, warnings } = specToProject(
          { name: 'Lolly open media candidates', sessions },
          (id) =>
            id === 'design'
              ? { version: tool.manifest.version, inputs: tool.manifest.inputs.map((i) => i.id) }
              : null,
          () => null
        );
        if (warnings.length) throw new Error(warnings.join('; '));
        const built = await buildLollyFile({
          kind: 'project',
          toolId: LOLLY_PROJECT_TOOL_ID,
          session: null,
          name: project.name,
          project,
          userAssets: [],
          appVersion: `Lolly ${ENGINE_VERSION}`,
          engineVersion: ENGINE_VERSION,
          creator: { createdWith: `Lolly ${ENGINE_VERSION}`, createdAt: startedAt },
        });
        const bytes = new Uint8Array(await built.blob.arrayBuffer());
        const reopened = await readLollyFile(bytes);
        if (reopened.project?.sessions.length !== sessions.length)
          throw new Error('The project did not reopen with every specimen.');
        record.artifacts.push(await save('candidates.lolly', bytes));
      });
  } finally {
    await browser.close();
    dom.window.close();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    await checkpoint();
  }
  if (ledger.attempts.some((a) => a.outcome === 'failed')) process.exitCode = 1;
  process.stdout.write(`Review packet: ${join(out, 'index.html')}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
