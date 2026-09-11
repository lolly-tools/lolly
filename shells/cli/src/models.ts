// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly models` - what on-device model files are here, and the one command that
 * downloads them.
 *
 *   lolly models ls                    # what is on disk, per family
 *   lolly models fetch kokoro --yes    # download the speech-synthesis model
 *   lolly models fetch upscale --yes   # download the enlargement models
 *
 * EVERY FAMILY WITH A NODE RUNNER IS HERE, because every refusal in this shell
 * names this command: `host.speech`, and the six ML runners in
 * packages/node-shell/src/ml/ (upscale, matte, ocr, ai-detect, reword, depth),
 * all end their refusal with `lolly models fetch <family>`. A family that
 * refuses with a command that then says "no model family called that" is worse
 * than no message at all.
 *
 * CONSENT BY DESIGN (plans/183 section 0.2). Nothing in this shell ever downloads a
 * model on its own: the runners refuse by name and print the command below, and
 * the command itself prints the total size BEFORE the first byte moves and then
 * waits for `--yes` or a typed "y". A family is 21 to 411 MB of someone else's
 * bandwidth; asking first is the whole point, and the biggest files are named in
 * the question so a 411 MB total is never a surprise.
 *
 * INTEGRITY. Every file is verified against its SHA-256 pin BEFORE it is
 * written, so a tampered or re-exported release cannot arrive unnoticed. The
 * pins are in packages/node-shell/src/speech.ts (kokoro, whisper) and
 * packages/node-shell/src/ml/model-pins.ts (the rest), each mirrored from the
 * matching scripts/fetch-*-models.ts and drift-tested against it. Downloads go
 * to a `.part` file and are renamed only after they verify, so an interrupted
 * fetch leaves nothing that looks complete.
 *
 * The mirror is https://lolli.li/models/, our own copy of the upstream releases;
 * $LOLLY_MODELS_BASE points the fetch somewhere else (an internal mirror, or a
 * file:// tree on an air-gapped machine).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { missingPinnedFiles, pinnedBytes, resolveModelsDir } from '@lolly-tools/node-shell/models-dir';
import type { ModelFilePin } from '@lolly-tools/node-shell/models-dir';
import { FAMILY_DIR, SPEECH_MODEL_FILES } from '@lolly-tools/node-shell/speech';
// The pins module, not the `ml` barrel: listing what is on disk must not load
// six model runners to do it.
import { ML_MODEL_FILES } from '@lolly-tools/node-shell/ml/model-pins';
import { EXIT, unavailableHere, usageError } from './exit-codes.ts';
import { writeOut } from './output.ts';

/** One registered family: what it is for, and what it is made of. */
interface FamilyEntry {
  /** The directory under the models root, which is also the mirror's path
   *  segment - `/models/<dir>/<file>`. */
  dir: string;
  /** What the family is FOR, so `models ls` reads as an answer, not a list. */
  purpose: string;
  /** Every file, relative to that directory. Empty when nothing is published. */
  files: readonly ModelFilePin[];
  /** Why there is nothing to fetch, when there is nothing to fetch. */
  unpublished?: string;
}

/**
 * The families this command knows. Every one of them has a Node runner that
 * refuses by naming `lolly models fetch <family>`, and the pins come from the
 * one place each family's files are declared, never re-typed here.
 */
const FAMILIES: Record<string, FamilyEntry> = {
  kokoro: {
    dir: FAMILY_DIR.kokoro,
    purpose: 'speech synthesis (lolly speak)',
    files: SPEECH_MODEL_FILES.kokoro,
  },
  whisper: {
    dir: FAMILY_DIR.whisper,
    purpose: 'transcription (lolly transcribe)',
    files: SPEECH_MODEL_FILES.whisper,
  },
  upscale: {
    dir: 'upscale',
    purpose: 'AI enlargement (lolly upscale)',
    files: ML_MODEL_FILES.upscale.files,
  },
  matte: {
    dir: 'matte',
    purpose: 'background removal (lolly matte)',
    files: ML_MODEL_FILES.matte.files,
  },
  ocr: {
    dir: 'ocr',
    purpose: 'text recognition (lolly ocr)',
    files: ML_MODEL_FILES.ocr.files,
  },
  'ai-detect': {
    dir: 'ai-detect',
    purpose: 'AI-text estimate (lolly detect-ai)',
    files: ML_MODEL_FILES['ai-detect'].files,
  },
  reword: {
    dir: 'reword',
    purpose: 'on-device rewrite (lolly reword)',
    files: ML_MODEL_FILES.reword.files,
  },
  depth: {
    dir: 'depth',
    purpose: 'depth map (lolly depth)',
    files: ML_MODEL_FILES.depth.files,
    unpublished: ML_MODEL_FILES.depth.unpublished,
  },
};

const DEFAULT_BASE = 'https://lolli.li/models';

function familyNames(): string[] {
  return Object.keys(FAMILIES);
}

function entryFor(family: string): FamilyEntry {
  const entry = FAMILIES[family];
  // Unreachable through asFamily; a throw rather than a non-null assertion so a
  // future caller that skips the check fails loudly instead of reading undefined.
  if (!entry) throw usageError(`no model family called "${family}"`, 'UNKNOWN_MODEL_FAMILY');
  return entry;
}

function asFamily(name: string | undefined): string {
  if (!name || !Object.hasOwn(FAMILIES, name)) {
    throw usageError(
      `usage: lolly models fetch <${familyNames().join('|')}> [--yes]`
      + (name ? `   (no model family called "${name}")` : ''),
      'UNKNOWN_MODEL_FAMILY',
    );
  }
  return name;
}

function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What `models ls` reports for one family, and what `fetch` measures against. */
interface FamilyReport {
  family: string;
  dir: string;
  files: number;
  present: number;
  missing: string[];
  bytesOnDisk: number;
  bytesTotal: number;
  published: boolean;
}

function familyReport(modelsDir: string, family: string): FamilyReport {
  const entry = entryFor(family);
  const dir = join(modelsDir, entry.dir);
  const missing = missingPinnedFiles(dir, entry.files);
  const missingSet = new Set(missing);
  return {
    family,
    dir,
    files: entry.files.length,
    present: entry.files.length - missing.length,
    missing,
    bytesOnDisk: pinnedBytes(entry.files.filter((p) => !missingSet.has(p.path))),
    bytesTotal: pinnedBytes(entry.files),
    published: !entry.unpublished,
  };
}

/** The try-this line a completed fetch ends on. */
const NEXT_STEP: Record<string, string> = {
  kokoro: 'lolly speak "hello there" --out=hello.wav',
  whisper: 'lolly transcribe clip.wav',
  upscale: 'lolly upscale photo.png --scale=4 --out=big.png',
  matte: 'lolly matte photo.png --out=cut.png',
  ocr: 'lolly ocr shot.png',
  'ai-detect': 'lolly detect-ai "<a paragraph of at least 50 words>"',
  reword: 'lolly reword "a sentence that could be shorter"',
};

/** The entry point bin/lolly.ts calls. Returns the process exit code. */
export async function modelsCli(
  args: string[], opts: { json?: boolean; yes?: boolean } = {},
): Promise<number> {
  const sub = args.find((a) => !a.startsWith('-')) ?? 'ls';
  if (sub === 'ls' || sub === 'list') return listModels(opts);
  if (sub === 'fetch') {
    const rest = args.slice(args.indexOf('fetch') + 1).filter((a) => !a.startsWith('-'));
    return fetchModels(asFamily(rest[0]), opts);
  }
  throw usageError(`usage: lolly models ls | lolly models fetch <${familyNames().join('|')}> [--yes]`, 'UNKNOWN_SUBCOMMAND');
}

async function listModels(opts: { json?: boolean }): Promise<number> {
  const dir = resolveModelsDir();
  const rows = familyNames().map((name) => familyReport(dir, name));
  if (opts.json) {
    const { emitResult } = await import('./envelope.ts');
    await emitResult({
      modelsDir: dir,
      families: rows.map((r) => ({
        ...r,
        purpose: entryFor(r.family).purpose,
        unpublished: entryFor(r.family).unpublished ?? null,
      })),
    });
    return EXIT.OK;
  }
  let text = `Model files under ${dir}\n`;
  for (const r of rows) {
    const state = !r.published
      ? 'not published yet'
      : r.missing.length === 0
        ? `complete (${mb(r.bytesTotal)})`
        : `${r.present}/${r.files} files, ${mb(r.bytesOnDisk)} of ${mb(r.bytesTotal)} - run  lolly models fetch ${r.family}`;
    text += `  ${r.family.padEnd(10)} ${entryFor(r.family).purpose.padEnd(34)} ${state}\n`;
  }
  text += '\nSet LOLLY_MODELS_DIR to read them from somewhere else.\n';
  await writeOut(text);
  return EXIT.OK;
}

async function fetchModels(family: string, opts: { json?: boolean; yes?: boolean }): Promise<number> {
  const dir = resolveModelsDir();
  const entry = entryFor(family);
  const familyPath = join(dir, entry.dir);

  // An unpublished family refuses BEFORE the network, and says why. Walking into
  // a 404 would look like an outage; this is a fact about the release.
  if (entry.unpublished) {
    throw unavailableHere(
      `${family}: ${entry.unpublished} Nothing was downloaded.`,
      'MODEL_NOT_PUBLISHED',
    );
  }

  const missing = new Set(missingPinnedFiles(familyPath, entry.files));
  const todo = entry.files.filter((p) => missing.has(p.path));
  const bytes = pinnedBytes(todo);
  const base = process.env.LOLLY_MODELS_BASE || DEFAULT_BASE;

  /** A `--json` run puts one envelope on stdout on EVERY path (contract section 5.2),
   *  including the paths where nothing was downloaded. */
  const report = async (downloaded: number, confirmed: boolean): Promise<void> => {
    if (!opts.json) return;
    const { emitResult } = await import('./envelope.ts');
    await emitResult({ ...familyReport(dir, family), confirmed, downloaded });
  };

  if (todo.length === 0) {
    process.stderr.write(`${family} is already here in full (${mb(pinnedBytes(entry.files))} under ${familyPath}).\n`);
    await report(0, true);
    return EXIT.OK;
  }

  // The size, up front, before a single byte moves - and the biggest files by
  // name, so a family whose total is one 324 MB face model and four small ones
  // says that in the question rather than in the progress meter afterwards.
  const biggest = [...todo].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
  const worthNaming = todo.length > 1 && (biggest[0]?.bytes ?? 0) > 8 * 1024 * 1024;
  process.stderr.write(
    `${family}: ${todo.length} file${todo.length === 1 ? '' : 's'} to download, ${mb(bytes)} (${bytes} bytes)\n`
    + (worthNaming ? `  biggest: ${biggest.map((p) => `${p.path} ${mb(p.bytes)}`).join(', ')}\n` : '')
    + `  from ${base}/${entry.dir}/\n  into ${familyPath}\n`,
  );
  if (!opts.yes && !(await confirm('Download now? [y/N] '))) {
    process.stderr.write('Nothing downloaded. Re-run with --yes to skip this question.\n');
    await report(0, false);
    return EXIT.OK;
  }

  let done = 0;
  for (const pin of todo) {
    const url = `${base}/${entry.dir}/${pin.path}`;
    const out = join(familyPath, ...pin.path.split('/'));
    process.stderr.write(`  ${pin.path} (${mb(pin.bytes)}) ...`);
    const res = await fetch(url);
    if (!res.ok) {
      process.stderr.write(' failed\n');
      process.stderr.write(`Download failed (${res.status} ${res.statusText}) for ${url}\n`);
      return EXIT.FAILED;
    }
    const body = new Uint8Array(await res.arrayBuffer());
    const actual = createHash('sha256').update(body).digest('hex');
    if (actual !== pin.sha256) {
      process.stderr.write(' REFUSED\n');
      process.stderr.write(
        `SHA-256 mismatch for ${family}/${pin.path}\n  pinned ${pin.sha256}\n  actual ${actual}\n`
        + `  ${body.byteLength === pin.bytes ? 'byte length matches the pin' : `byte length also differs: expected ${pin.bytes}, got ${body.byteLength}`}\n`
        + 'Nothing was written. This file is not the release Lolly pinned.\n',
      );
      return EXIT.REFUSED;
    }
    // Write aside, then rename: an interrupted fetch must never leave a
    // half-file that the presence check would later read as a model.
    mkdirSync(dirname(out), { recursive: true });
    const part = `${out}.part`;
    writeFileSync(part, body);
    renameSync(part, out);
    done += pin.bytes;
    process.stderr.write(` ok (${mb(done)} of ${mb(bytes)})\n`);
  }

  const left = missingPinnedFiles(familyPath, entry.files);
  await report(done, true);
  if (left.length) {
    process.stderr.write(`${family} is still incomplete: ${left.length} file(s) missing.\n`);
    return EXIT.FAILED;
  }
  const next = NEXT_STEP[family];
  process.stderr.write(`${family} is ready.${next ? `  Try:  ${next}` : ''}\n`);
  return EXIT.OK;
}

/**
 * Ask on the terminal. With no TTY there is nobody to ask, so this answers no
 * and the caller says how to proceed - a pipeline must never hang waiting on
 * input that will never arrive, and must never download 100 MB because nobody
 * objected.
 */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    process.stderr.write('Not a terminal, so there is nobody to ask.\n');
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
