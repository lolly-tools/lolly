// SPDX-License-Identifier: MPL-2.0
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, watch } from 'node:fs';
import {
  readFile,
  readdir,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
  stat,
  open,
  realpath,
} from 'node:fs/promises';
import { basename, dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { ENGINE_VERSION, parseBatchCsv, toCSV } from '@lolly/engine';
import { contentRoots } from '@lolly-tools/node-shell/content-roots';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
import { resolveStateDir } from '@lolly-tools/node-shell/state-dir';
import { readToolFile, loadToolOrThrow } from './run.ts';
import { describeEnvironment, formatReadiness } from './environment.ts';
import { emitResult } from './envelope.ts';
import { usageError, EXIT, exitCodeFor } from './exit-codes.ts';
import { batchSlug } from './batch.ts';
import type { BatchRowRecord } from './batch.ts';

export interface ProductionBatchOptions {
  outDir: string;
  jobs?: number;
  rows?: number[];
  expectedPlan?: string;
  strict?: boolean;
  dryRun?: boolean;
  preflight?: boolean;
  resume?: boolean;
  watch?: boolean;
  journal?: string;
  keepGoing?: boolean;
  json?: boolean;
}
interface Job {
  row: number;
  toolId: string;
  toolVersion: string;
  error?: string;
  exit?: number;
  reuseReason: string;
  provenance?: Record<string, string | null>;
  format: string;
  prefix: string;
  outputPattern: string;
  csv: string;
  fingerprint: string;
  reusable: boolean;
  files: string[];
  readiness: ReturnType<typeof formatReadiness>;
}
interface JournalRow extends BatchRowRecord {
  toolVersion?: string;
  provenance?: Record<string, string | null>;
  reuseReason?: string;
  fingerprint: string;
  outputHash?: string;
  reused?: boolean;
  reusable?: boolean;
  report?: unknown;
}
interface Snapshot {
  engine: string;
  cli: string;
  node: string;
  profile: string;
  contentHash: string;
  renderer: string;
  source: { path: string; sha256: string };
}
interface Journal {
  version: 1;
  context: string;
  snapshot: Snapshot;
  rows: JournalRow[];
  cancelled: boolean;
  sourceChanged: boolean;
}
const within = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
const digest = (text: string): string => createHash('sha256').update(text).digest('hex');

async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Hash actual content, not generated asset checksums that might be stale. */
async function treeHash(paths: string[]): Promise<string> {
  const hash = createHash('sha256');
  const seen = new Set<string>();
  async function visit(path: string): Promise<void> {
    path = resolve(path);
    if (!existsSync(path)) return;
    const canonical = await realpath(path);
    if (seen.has(canonical)) return;
    seen.add(canonical);
    const info = await stat(path);
    if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) {
        if (entry === 'node_modules' || entry === '.git') continue;
        await visit(join(path, entry));
      }
    } else if (info.isFile()) hash.update(path).update(await fileHash(path));
  }
  for (const path of paths) await visit(path);
  return hash.digest('hex');
}

export async function planProductionBatch(
  path: string,
  options: ProductionBatchOptions
): Promise<{ jobs: Job[]; context: string; snapshot: Snapshot }> {
  const csvText = await readFile(path, 'utf8');
  const rows = parseBatchCsv(csvText);
  if (!rows.length) throw usageError('The batch has no data rows.', 'EMPTY_BATCH');
  const roots = contentRoots();
  const environment = await describeEnvironment();
  for (const source of [
    ...roots.toolRoots,
    roots.catalogRoot,
    ...roots.assetRoots.map((root) => root.dir),
  ]) {
    if (within(source, resolve(options.outDir)))
      throw usageError(
        '--out-dir must be outside tool and catalog source directories.',
        'BAD_INPUT'
      );
  }
  const root = repoRoot();
  const contentHash = await treeHash([
    ...roots.toolRoots,
    roots.catalogRoot,
    ...roots.assetRoots.map((root) => root.dir),
    join(resolveStateDir().dir, 'design-systems'),
    join(root, 'engine/src'),
    join(root, 'packages/node-shell/src'),
    join(root, 'shells/cli/src'),
    join(root, 'pnpm-lock.yaml'),
    join(root, 'shells/web/public/fonts'),
    join(root, 'packages/node-shell/wasm'),
    fileURLToPath(new URL('../../../engine/src', import.meta.url)),
    fileURLToPath(new URL('../../../packages/node-shell/src', import.meta.url)),
    fileURLToPath(new URL('../package.json', import.meta.url)),
    dirname(fileURLToPath(import.meta.url)),
  ]);
  const context = digest(
    JSON.stringify({
      contentHash,
      cli: environment.cli,
      profile: roots.profile,
      engine: ENGINE_VERSION,
      node: process.versions,
      cwd: process.cwd(),
    })
  );
  const snapshot: Snapshot = {
    engine: ENGINE_VERSION,
    cli: environment.cli,
    node: process.versions.node,
    profile: roots.profile,
    contentHash,
    renderer: environment.renderer,
    source: { path: resolve(path), sha256: digest(csvText) },
  };
  const pad = Math.max(2, String(rows.length).length);
  const jobs: Job[] = [];
  for (const [index, row] of rows.entries()) {
    const files: string[] = [];
    try {
      const tool = await loadToolOrThrow(row.toolId, readToolFile);
      const cells: Record<string, unknown> = {
        ...row.params,
        toolId: row.toolId,
        ...(row.format ? { format: row.format } : {}),
        ...(row.filename ? { filename: row.filename } : {}),
        ...(row.width ? { width: row.width } : {}),
        ...(row.height ? { height: row.height } : {}),
        ...(row.unit ? { unit: row.unit } : {}),
        ...(row.dpi ? { dpi: row.dpi } : {}),
      };
      const external: string[] = [];
      for (const input of tool.manifest.inputs) {
        if (input.type !== 'file') continue;
        const keys = [input.id, `input.${input.id}`, ...(input.urlKey ? [input.urlKey] : [])];
        for (const key of keys) {
          const value = row.params[key];
          if (value && value !== '-') {
            files.push(resolve(value));
            external.push(await fileHash(resolve(value)));
          }
          if (value === '-')
            throw usageError(
              'Production batch workers need file paths, not shared stdin.',
              'BAD_INPUT'
            );
        }
      }
      for (const flag of [
        'user-profile',
        'file',
        'rate-card',
        'production',
        'production-reference',
      ]) {
        if (flag === 'file' && tool.manifest.id !== 'design') continue;
        const value = row.params[flag];
        if (value) {
          files.push(resolve(value));
          external.push(await fileHash(resolve(value)));
        }
      }
      const format = row.format ?? tool.manifest.render.formats[0] ?? 'svg';
      const requires = tool.manifest.requires ?? [];
      // Network, live media, models and composition can depend on facts outside this snapshot.
      const qualifiedFormat =
        environment.nativeFormats.includes(format.toLowerCase()) ||
        !!tool.manifest.hooks?.exportFile;
      const externalAssets = tool.manifest.inputs.some(
        (input) =>
          ['asset', 'blocks'].includes(input.type) &&
          /(?:https?|cms|net|file):|user\//i.test(
            [
              row.params[input.id],
              row.params[`input.${input.id}`],
              input.urlKey ? row.params[input.urlKey] : '',
            ].join(' ')
          )
      );
      const signing =
        row.params['sign-key'] ||
        row.params['sign-cert'] ||
        process.env.LOLLY_SIGN_KEY ||
        process.env.LOLLY_SIGN_CERT;
      const structured = row.params.inputs !== undefined || row.params.document !== undefined;
      const reusable =
        qualifiedFormat &&
        !externalAssets &&
        !signing &&
        !structured &&
        (!tool.manifest.hooks || tool.manifest.isolate === true) &&
        !tool.manifest.network?.allowlist?.length &&
        !tool.manifest.composes?.length &&
        !(tool.manifest.capabilities ?? []).some((cap) =>
          ['camera', 'microphone', 'screen', 'capture'].includes(cap)
        ) &&
        requires.every((api) => ['tokens', 'text', 'images', 'pdf'].includes(api));
      jobs.push({
        row: index + 1,
        toolId: row.toolId,
        toolVersion: tool.manifest.version,
        format,
        reuseReason: reusable
          ? 'Mounted content, source and named files are fingerprinted.'
          : 'External services, structured assets, signing identity or renderer dependencies are not fully captured; this row is rerun.',
        provenance: {
          policy: 'bare-unless-requested',
          c2pa: row.params.c2pa ?? null,
          imprint: row.params.imprint ?? null,
          durable: row.params.durable ?? null,
        },
        prefix: String(index + 1).padStart(pad, '0'),
        outputPattern: join(
          resolve(options.outDir),
          `${String(index + 1).padStart(pad, '0')}-${row.filename ? batchSlug(row.filename.replace(/\.[^.]+$/, '')) : tool.manifest.hooks?.exportFile ? '*' : batchSlug(row.toolId)}.${tool.manifest.hooks?.exportFile ? '*' : format}`
        ),
        csv: toCSV(Object.keys(cells), [cells]),
        fingerprint: digest(JSON.stringify({ context, cells, external })),
        reusable,
        files,
        readiness: formatReadiness([format], environment),
      });
    } catch (error) {
      const format = row.format ?? 'svg';
      jobs.push({
        row: index + 1,
        toolId: row.toolId,
        toolVersion: 'unknown',
        format,
        prefix: String(index + 1).padStart(pad, '0'),
        outputPattern: join(
          resolve(options.outDir),
          `${String(index + 1).padStart(pad, '0')}-${batchSlug(row.filename ?? row.toolId)}.${format}`
        ),
        csv: '',
        fingerprint: digest(JSON.stringify({ context, row })),
        reusable: false,
        files,
        reuseReason: 'Planning failed.',
        error: (error as Error).message,
        exit: exitCodeFor(error),
        readiness: [
          { format, state: 'unavailable', tier: 'native', reason: (error as Error).message },
        ],
      });
    }
  }
  return { jobs, context, snapshot };
}

function workerPath(): string {
  for (const name of ['./batch-worker.js', './batch-worker.ts']) {
    const path = fileURLToPath(new URL(name, import.meta.url));
    if (existsSync(path)) return path;
  }
  throw new Error('The production batch worker is missing from this installation.');
}

async function atomicJournal(path: string, journal: Journal): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}

async function waitForChanges(files: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const watchers: ReturnType<typeof watch>[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      process.off('SIGINT', done);
      process.off('SIGTERM', done);
    };
    const done = (): void => {
      cleanup();
      resolve();
    };
    const fail = (error: Error): void => {
      cleanup();
      reject(error);
    };
    process.once('SIGINT', done);
    process.once('SIGTERM', done);
    try {
      for (const file of new Set(files)) {
        let directory = dirname(file);
        while (!existsSync(directory) && dirname(directory) !== directory)
          directory = dirname(directory);
        const target = relative(directory, file).split(sep)[0];
        const watcher = watch(directory, (_event, name) => {
          if (name?.toString() !== target) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(done, 250);
        });
        watcher.once('error', fail);
        watchers.push(watcher);
      }
    } catch (error) {
      fail(error as Error);
    }
  });
}

async function acquireLock(
  path: string,
  recover: boolean
): Promise<Awaited<ReturnType<typeof open>>> {
  try {
    const handle = await open(path, 'wx', 0o600);
    try {
      await handle.writeFile(String(process.pid));
      return handle;
    } catch (error) {
      await handle.close();
      await rm(path, { force: true });
      throw error;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !recover)
      throw usageError(
        'Another batch may own this output directory. Check .lolly-batch.lock before retrying.',
        'BATCH_BUSY'
      );
  }
  const recoveryPath = `${path}.recovery`;
  let recovery: Awaited<ReturnType<typeof open>>;
  try {
    recovery = await open(recoveryPath, 'wx', 0o600);
  } catch {
    throw usageError(
      'Another process is checking the batch lock. Inspect its .recovery PID before retrying.',
      'BATCH_BUSY'
    );
  }
  try {
    await recovery.writeFile(String(process.pid));
    if (!existsSync(path)) return await acquireLock(path, false);
    const before = await stat(path);
    if (before.size > 32 || (process.getuid && before.uid !== process.getuid()))
      throw usageError('The batch lock cannot be safely recovered.', 'BATCH_BUSY');
    const text = (await readFile(path, 'utf8')).trim();
    const pid = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(pid) || pid <= 0)
      throw usageError('The batch lock has no valid owner PID.', 'BATCH_BUSY');
    let dead = false;
    try {
      process.kill(pid, 0);
    } catch (error) {
      dead = (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
    const current = await stat(path);
    if (
      !dead ||
      current.ino !== before.ino ||
      current.dev !== before.dev ||
      current.mtimeMs !== before.mtimeMs ||
      current.size !== before.size
    )
      throw usageError('A batch still owns this output directory.', 'BATCH_BUSY');
    await rm(path);
    return await acquireLock(path, false);
  } finally {
    await recovery.close();
    await rm(recoveryPath, { force: true });
  }
}

async function releaseLock(lock: Awaited<ReturnType<typeof open>>, path: string): Promise<void> {
  const owned = await lock.stat();
  try {
    const current = await stat(path);
    if (current.ino === owned.ino && current.dev === owned.dev) await rm(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  } finally {
    await lock.close();
  }
}

export async function productionBatchCli(
  input: string,
  options: ProductionBatchOptions
): Promise<number> {
  const path = resolve(input),
    outDir = resolve(options.outDir);
  const jobsCount = options.jobs ?? 1;
  if (!Number.isInteger(jobsCount) || jobsCount < 1 || jobsCount > 8)
    throw usageError('--jobs must be an integer from 1 to 8.', 'BAD_INPUT');
  if (options.watch && options.json)
    throw usageError(
      '--watch uses terminal progress. Run separate --json jobs for one result per invocation.',
      'CONFLICTING_FLAGS'
    );
  const journalPath = resolve(options.journal ?? join(outDir, '.lolly-batch.json'));
  const children = new Set<ChildProcess>();
  const killTimers = new Map<ChildProcess, ReturnType<typeof setTimeout>>();
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  const lockPath = join(outDir, '.lolly-batch.lock');
  let signalCode = 0;
  const interrupt = (code: number): void => {
    signalCode = code;
    for (const child of children) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      timer.unref();
      killTimers.set(child, timer);
    }
  };
  const sigint = (): void => interrupt(130),
    sigterm = (): void => interrupt(143);
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  try {
    do {
      let planned: Awaited<ReturnType<typeof planProductionBatch>>;
      try {
        planned = await planProductionBatch(path, options);
      } catch (error) {
        if (!options.watch || signalCode) throw error;
        process.stderr.write(
          `Batch source error: ${(error as Error).message}. Waiting for the CSV to change.\n`
        );
        await waitForChanges([path]);
        continue;
      }
      const planId = digest(
        JSON.stringify({
          outDir,
          context: planned.context,
          jobs: planned.jobs.map((job) => job.fingerprint),
        })
      );
      if (options.expectedPlan && options.expectedPlan !== planId)
        throw usageError(
          'The batch changed since review. Plan it again before running.',
          'PLAN_CHANGED'
        );
      if (options.rows) {
        const selected = new Set(options.rows);
        if (
          !selected.size ||
          [...selected].some(
            (row) => !Number.isInteger(row) || row < 1 || row > planned.jobs.length
          )
        )
          throw usageError('--rows must name valid 1-based row numbers.', 'BAD_INPUT');
        planned.jobs = planned.jobs.filter((job) => selected.has(job.row));
      }
      if (signalCode) return signalCode;
      if (options.dryRun) {
        const result = {
          dryRun: true,
          outDir,
          jobs: planned.jobs.map(({ csv: _csv, files: _files, ...job }) => job),
          context: planned.context,
          snapshot: planned.snapshot,
          planId,
        };
        if (options.json) await emitResult(result);
        else process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        return 0;
      }
      await mkdir(outDir, { recursive: true });
      if (!lock) {
        lock = await acquireLock(lockPath, !!(options.resume || options.watch));
      }
      if (
        journalPath === path ||
        planned.jobs.some(
          (job) => job.files.includes(journalPath) || job.outputPattern === journalPath
        )
      )
        throw usageError('The journal must not replace a batch input file.', 'BAD_INPUT');
      let prior: Journal | null = null;
      if (options.resume || options.watch) {
        try {
          const value = JSON.parse(await readFile(journalPath, 'utf8')) as Journal;
          if (value.version === 1 && Array.isArray(value.rows))
            prior = {
              ...value,
              rows: value.rows.filter(
                (row) =>
                  row &&
                  typeof row === 'object' &&
                  typeof row.row === 'number' &&
                  typeof row.fingerprint === 'string' &&
                  typeof row.output === 'string' &&
                  typeof row.outputHash === 'string'
              ),
            };
        } catch {
          /* A missing or invalid journal causes fresh renders. */
        }
      }
      const journal: Journal = {
        version: 1,
        context: planned.context,
        snapshot: planned.snapshot,
        rows: [],
        cancelled: false,
        sourceChanged: false,
      };
      const stage = await mkdtemp(join(outDir, '.lolly-batch-'));
      let cursor = 0,
        failed = false,
        fatal = false;
      let journalWrite = Promise.resolve();
      const persist = (): Promise<void> => {
        journalWrite = journalWrite.then(() => atomicJournal(journalPath, journal));
        return journalWrite;
      };
      async function runJob(job: Job): Promise<void> {
        if (job.error) {
          journal.rows.push({
            row: job.row,
            toolId: job.toolId,
            format: job.format,
            fingerprint: job.fingerprint,
            ok: false,
            exit: job.exit ?? 2,
            error: job.error,
            reusable: false,
          });
          failed = true;
          await persist();
          return;
        }
        const old = prior?.rows?.find(
          (row) =>
            row.row === job.row && row.fingerprint === job.fingerprint && row.ok && row.reusable
        );
        if (
          !options.preflight &&
          job.reusable &&
          old?.output &&
          relative(outDir, old.output) &&
          within(outDir, old.output) &&
          existsSync(old.output) &&
          (await fileHash(old.output)) === old.outputHash
        ) {
          journal.rows.push({ ...old, reused: true });
          await persist();
          return;
        }
        const dir = join(stage, job.prefix);
        await mkdir(dir);
        const csv = join(dir, 'job.csv');
        await writeFile(csv, job.csv, { mode: 0o600 });
        let stdout = '',
          stderr = '';
        const child = spawn(
          process.execPath,
          [
            workerPath(),
            csv,
            dir,
            ...(options.preflight ? ['--preflight'] : []),
            ...(options.strict ? ['--strict'] : []),
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        children.add(child);
        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
          if (stdout.length > 4 * 1024 * 1024) child.kill('SIGTERM');
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr = (stderr + chunk.toString()).slice(-12000);
        });
        const exit = await new Promise<number>((resolve, reject) => {
          child.once('error', reject);
          child.once('close', (code) => resolve(code ?? (signalCode || 1)));
        }).finally(() => {
          children.delete(child);
          const timer = killTimers.get(child);
          if (timer) clearTimeout(timer);
          killTimers.delete(child);
        });
        let row: JournalRow;
        try {
          const envelope = JSON.parse(stdout) as { result?: unknown; error?: { message?: string } };
          if (options.preflight) {
            row = {
              row: job.row,
              toolId: job.toolId,
              format: job.format,
              ok: exit === 0,
              exit,
              fingerprint: job.fingerprint,
              report: envelope.result,
              error: exit ? (envelope.error?.message ?? 'Preflight reported findings.') : undefined,
              reusable: false,
            };
            journal.rows.push(row);
            if (!row.ok) failed = true;
            await persist();
            return;
          }
          const record = (envelope.result as { rows: BatchRowRecord[] }).rows[0];
          if (!record) throw new Error('Worker returned no row result.');
          if (record.ok && exit !== 0) throw new Error(`Worker exited ${exit} after rendering.`);
          row = {
            ...record,
            row: job.row,
            fingerprint: job.fingerprint,
            reusable: job.reusable,
            toolVersion: job.toolVersion,
            provenance: job.provenance,
            reuseReason: job.reuseReason,
          };
          if (row.ok && row.output) {
            const name = `${job.prefix}-${basename(row.output).replace(/^\d+-/, '')}`;
            const output = join(outDir, name);
            if (!within(dir, row.output))
              throw new Error('Worker output is outside its staging directory.');
            await rename(row.output, output);
            row.output = output;
            row.outputHash = await fileHash(output);
          }
        } catch (error) {
          row = {
            row: job.row,
            toolId: job.toolId,
            format: job.format,
            ok: false,
            exit: exit || 1,
            fingerprint: job.fingerprint,
            error: signalCode ? 'Cancelled' : `${(error as Error).message} ${stderr}`,
          };
        }
        journal.rows.push(row);
        if (!row.ok) failed = true;
        process.stderr.write(`row ${job.row}: ${row.ok ? row.output : row.error}\n`);
        await persist();
      }
      try {
        const settled = await Promise.allSettled(
          Array.from({ length: Math.min(jobsCount, planned.jobs.length) }, async () => {
            while (!signalCode && !fatal && (!failed || options.keepGoing)) {
              const job = planned.jobs[cursor++];
              if (!job) return;
              try {
                await runJob(job);
              } catch (error) {
                fatal = true;
                throw error;
              }
            }
          })
        );
        const rejected = settled.find((result) => result.status === 'rejected');
        if (rejected?.status === 'rejected') throw rejected.reason;
        if (!signalCode) {
          try {
            const after = await planProductionBatch(path, options);
            if (options.rows)
              after.jobs = after.jobs.filter((job) => options.rows?.includes(job.row));
            if (
              after.context !== planned.context ||
              after.jobs.some(
                (job, index) => job.fingerprint !== planned.jobs[index]?.fingerprint
              ) ||
              after.jobs.length !== planned.jobs.length
            ) {
              journal.sourceChanged = true;
              journal.rows.forEach((row) => {
                row.reusable = false;
              });
            }
          } catch {
            journal.sourceChanged = true;
            journal.rows.forEach((row) => {
              row.reusable = false;
            });
          }
        }
        journal.cancelled = !!signalCode;
        journal.rows.sort((a, b) => a.row - b.row);
        await persist();
      } finally {
        await rm(stage, { recursive: true, force: true });
      }
      const severity = [
        0,
        EXIT.USAGE,
        EXIT.FAILED,
        EXIT.UNAVAILABLE_HERE,
        EXIT.REFUSED,
        EXIT.AUTH,
        EXIT.INTERNAL,
      ];
      const exit =
        signalCode ||
        journal.rows.reduce(
          (worst, row) => (severity.indexOf(row.exit) > severity.indexOf(worst) ? row.exit : worst),
          0
        );
      const result = {
        rows: journal.rows,
        summary: {
          total: planned.jobs.length,
          ok: journal.rows.filter((row) => row.ok).length,
          failed: journal.rows.filter((row) => !row.ok).length,
          rendered: options.preflight
            ? 0
            : journal.rows.filter((row) => row.ok && !row.reused).length,
          ...(options.preflight ? { checked: journal.rows.length } : {}),
          reused: journal.rows.filter((row) => row.reused).length,
          aborted: journal.rows.length < planned.jobs.length || !!signalCode,
        },
        outDir,
        journal: journalPath,
        sourceChanged: journal.sourceChanged,
      };
      if (!options.watch && lock) {
        const ownedLock = lock;
        lock = undefined;
        await releaseLock(ownedLock, lockPath);
      }
      if (options.json) await emitResult(result, exit);
      if (!options.watch || signalCode) return exit;
      if (journal.sourceChanged) {
        process.stderr.write('Source changed during the batch; replanning.\n');
        continue;
      }
      process.stderr.write('Watching the CSV and its file inputs. Ctrl-C stops.\n');
      await waitForChanges([path, ...planned.jobs.flatMap((job) => job.files)]);
    } while (!signalCode);
    return signalCode;
  } finally {
    process.off('SIGINT', sigint);
    process.off('SIGTERM', sigterm);
    if (lock) await releaseLock(lock, lockPath);
  }
}
