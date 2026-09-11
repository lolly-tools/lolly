// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly speak` and `lolly transcribe` - the discovery surface for `host.speech`
 * in the terminal.
 *
 *   lolly speak "Hello there" --out=hello.wav
 *   lolly speak "Hello there" --voice=af_heart --speed=0.9 --json
 *   lolly transcribe hello.wav --json
 *
 * Both are thin wrappers: every number they print comes from the same
 * `createNodeSpeechAPI()` a tool's hook reaches through `host.speech`, so what a
 * script sees here is what a headless render sees. Nothing is downloaded - a
 * model that is not staged refuses with the `lolly models fetch` command and its
 * size, which is the module's own refusal text passed straight through.
 *
 * stdout discipline (contract section 0): `speak` puts the WAV where `--out` says
 * (`-` for stdout) and its summary on stderr; `transcribe` puts the transcript
 * text on stdout, because that IS the payload. `--json` replaces the human text
 * with one envelope on stdout, so `speak --out=x.wav --json | jq .result.words`
 * reads the word timings while the audio goes to the file.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packWav } from '@lolly/engine';
import { createNodeSpeechAPI } from '@lolly-tools/node-shell/speech';
import type { SpeechProgress } from '@lolly-tools/core/host-v1';
import { EXIT, unavailableHere, usageError } from './exit-codes.ts';
import { isOn } from './args.ts';
import { note, writeOut } from './output.ts';

/** The message for a machine with no inference runtime installed. Exit 3
 *  (UNAVAILABLE_HERE) is the retry-on-another-runner code: the request was
 *  well formed, this installation just cannot serve it. */
const NO_RUNTIME =
  'On-device speech needs @huggingface/transformers and onnxruntime-node, which are not '
  + 'installed here. Run `pnpm install` at the repo root (they ship with the workspace), '
  + 'then try again.';

const NO_PHONEMIZER =
  'Speech synthesis needs the eSpeak phonemizer (the `phonemizer` package), which is not '
  + 'installed here. Transcription (`lolly transcribe`) does not need it and still works.';

/**
 * Progress to stderr, at whole percents so a long clip does not scroll a
 * thousand lines. `note()` respects --quiet.
 *
 * `work` is the verb for the non-download phase: SpeechProgress calls it
 * 'synthesis' in both directions (one enum, shared by the contract), so the
 * caller names what is actually happening rather than telling someone waiting on
 * a transcript that we are synthesizing.
 */
function progressToStderr(work: string): (p: SpeechProgress) => void {
  let last = -1;
  return (p: SpeechProgress): void => {
    const pct = Math.round((p.fraction ?? 0) * 100);
    if (pct === last) return;
    last = pct;
    note(`${p.phase === 'download' ? 'loading model' : work} ${pct}%`);
  };
}

export interface SpeakOptions {
  voice?: string;
  speed?: string;
  out?: string;
  json?: boolean;
}

export async function speakCli(text: string, opts: SpeakOptions = {}): Promise<number> {
  if (!text.trim()) {
    throw usageError('usage: lolly speak "<text>" [--voice=bf_lily] [--speed=1] [--out=clip.wav]', 'MISSING_ARGUMENT');
  }
  const speech = createNodeSpeechAPI({});
  if (!speech) throw unavailableHere(NO_RUNTIME, 'CAPABILITY_UNAVAILABLE');
  if (!speech.isAvailable()) throw unavailableHere(NO_PHONEMIZER, 'CAPABILITY_UNAVAILABLE');

  const speed = opts.speed === undefined ? undefined : Number(opts.speed);
  if (speed !== undefined && !Number.isFinite(speed)) {
    throw usageError(`--speed must be a number (got "${opts.speed}").`, 'BAD_FLAG_VALUE');
  }
  const out = opts.out ?? 'speech.wav';
  if (out === '-' && opts.json) {
    throw usageError('--out=- writes the WAV to stdout, so --json has nowhere to go. Name a file, or drop --json.', 'CONFLICTING_FLAGS');
  }

  const result = await speech.synthesize(text, {
    ...(opts.voice ? { voice: opts.voice } : {}),
    ...(speed === undefined ? {} : { speed }),
    onProgress: progressToStderr('speaking'),
  });
  // int16 is what a speech clip wants: half the bytes, and Kokoro's output sits
  // inside -1..1 so nothing clips.
  const wav = packWav({ channels: [result.pcm], sampleRate: result.sampleRate });

  if (out === '-') {
    await writeOut(wav);
  } else {
    await writeFile(out, wav);
  }

  if (opts.json) {
    const { emitResult } = await import('./envelope.ts');
    await emitResult({
      output: out,
      voice: opts.voice ?? 'bf_lily',
      speed: speed ?? 1,
      sampleRate: result.sampleRate,
      duration: result.duration,
      granularity: result.granularity,
      words: result.words,
      script: result.script,
    });
    return EXIT.OK;
  }
  note(
    `${result.duration.toFixed(2)}s, ${result.words.length} ${result.granularity} span(s)`
    + `${out === '-' ? '' : ` → ${out}`}`,
  );
  return EXIT.OK;
}

export async function transcribeCli(file: string, opts: { json?: boolean; lang?: string } = {}): Promise<number> {
  if (!file) throw usageError('usage: lolly transcribe <clip.wav> [--lang=en] [--json]', 'MISSING_ARGUMENT');
  const speech = createNodeSpeechAPI({});
  if (!speech) throw unavailableHere(NO_RUNTIME, 'CAPABILITY_UNAVAILABLE');

  // A path typed at a shell is relative to the WORKING DIRECTORY. host.speech
  // reads an AudioSource, where a bare path is a catalog-relative asset (the
  // audio.ts rule a tool's hook needs), so the RUNNER resolves the file it was
  // handed before the API ever sees it.
  const transcript = await speech.transcribe(resolve(file), {
    ...(opts.lang ? { lang: opts.lang } : {}),
    onProgress: progressToStderr('reading the clip'),
  });

  if (opts.json) {
    const { emitResult } = await import('./envelope.ts');
    await emitResult(transcript);
    return EXIT.OK;
  }
  // The transcript IS the payload, so it goes to stdout and nothing else does.
  await writeOut(`${transcript.text}\n`);
  return EXIT.OK;
}

/** Read the two commands' flags off a parsed flag map. Kept here so bin/lolly.ts
 *  stays a router. */
export function speakOptions(flags: Record<string, string>): SpeakOptions {
  // `--output` is the CLI's frozen spelling for "where the file goes" and refuses
  // its bare form; `--out` is the short alias this command documents. Both here
  // means the caller wrote two answers to one question, which is never guessed at.
  if (flags.output !== undefined && flags.out !== undefined && flags.output !== flags.out) {
    throw usageError('--out and --output name the same thing and disagree here. Give one.', 'CONFLICTING_FLAGS');
  }
  const out = flags.output ?? flags.out;
  return {
    ...(flags.voice ? { voice: flags.voice } : {}),
    ...(flags.speed !== undefined ? { speed: flags.speed } : {}),
    ...(out !== undefined ? { out } : {}),
    json: isOn(flags.json),
  };
}
