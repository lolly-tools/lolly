// SPDX-License-Identifier: MPL-2.0
import { useEffect, useRef, useState } from 'react';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Panel } from '../components/Panel.tsx';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { defaultExportDir } from '../store.ts';

function stopChild(child: ChildProcess | null): void {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') child.kill('SIGTERM');
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    /* Already stopped. */
  }
}

interface QueueJob {
  row: number;
  toolId: string;
  format: string;
  outputPattern: string;
  readiness: Array<{ state: string; reason: string }>;
}
interface QueuePlan {
  planId: string;
  jobs: QueueJob[];
}
interface QueueResult {
  row: number;
  ok: boolean;
  output?: string;
  error?: string;
  reused?: boolean;
  report?: unknown;
}

function cliEntry(): string {
  for (const name of ['../../../cli/bin/lolly.ts', './cli.js']) {
    const path = fileURLToPath(new URL(name, import.meta.url));
    if (existsSync(path)) return path;
  }
  throw new Error('The CLI is missing beside this TUI installation.');
}

/** A review surface over the CLI production runner, with one isolated owner per run. */
export function BatchQueue({ onBack }: { onBack: () => void }) {
  const { cols, rows } = useTermSize();
  const [path, setPath] = useState('');
  const [outDir, setOutDir] = useState(defaultExportDir());
  const [editing, setEditing] = useState<'path' | 'output' | null>('path');
  const [plan, setPlan] = useState<QueuePlan | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<QueueResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('Choose a CSV/TSV batch. Enter plans it without exporting.');
  const [busy, setBusy] = useState(false);
  const child = useRef<ChildProcess | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    const stop = (): void => {
      stopChild(child.current);
    };
    process.on('exit', stop);
    return () => {
      alive.current = false;
      stop();
      process.off('exit', stop);
    };
  }, []);

  async function run(mode: 'plan' | 'preflight' | 'render'): Promise<void> {
    if (child.current) return;
    setEditing(null);
    setBusy(true);
    setStatus(mode === 'plan' ? 'Reading dependencies...' : 'Starting workers...');
    try {
      const args = [
        cliEntry(),
        'batch',
        path,
        `--out-dir=${outDir}`,
        '--jobs=2',
        '--keep-going',
        '--json',
      ];
      if (mode === 'plan') args.push('--dry-run');
      else {
        if (!plan) throw new Error('Plan the batch first.');
        if (plan.jobs.every((job) => excluded.has(job.row)))
          throw new Error('Select at least one row.');
        args.push(
          `--expect-plan=${plan.planId}`,
          `--rows=${plan.jobs
            .filter((job) => !excluded.has(job.row))
            .map((job) => job.row)
            .join(',')}`
        );
        args.push(mode === 'preflight' ? '--preflight' : '--resume');
      }
      const processChild = spawn(process.execPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
      child.current = processChild;
      let stdout = '';
      processChild.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (stdout.length > 8 * 1024 * 1024) processChild.kill('SIGTERM');
      });
      processChild.stderr.on('data', (data: Buffer) => {
        if (alive.current) setStatus(data.toString().trim().split('\n').at(-1) ?? '');
      });
      const code = await new Promise<number>((resolve, reject) => {
        processChild.once('error', reject);
        processChild.once('close', (code) => resolve(code ?? 1));
      });
      if (!alive.current) return;
      if (!stdout.trim() && code !== 0)
        throw new Error(
          'Batch cancelled or stopped before a report. Review the journal before resuming.'
        );
      const envelope = JSON.parse(stdout) as {
        ok: boolean;
        result?: QueuePlan & { rows?: QueueResult[]; journal?: string };
        error?: { message?: string };
      };
      if (mode === 'plan' && envelope.result) {
        setPlan(envelope.result);
        setExcluded(new Set());
        setResults([]);
        setSelected(0);
        setStatus('Review dependencies and outputs. Space excludes a row.');
      } else if (envelope.result) {
        setResults(envelope.result.rows ?? []);
        setStatus(
          `${code === 0 ? 'Completed' : 'Stopped with findings'}. Receipt: ${envelope.result.journal ?? ''}`
        );
      } else throw new Error(envelope.error?.message ?? `CLI exited ${code}.`);
    } catch (error) {
      if (alive.current) setStatus((error as Error).message);
    } finally {
      child.current = null;
      if (alive.current) setBusy(false);
    }
  }

  useInput((input, key) => {
    if (busy) {
      if (input === 'c' || key.escape) {
        stopChild(child.current);
        setStatus('Cancelling workers...');
      }
      return;
    }
    if (editing) {
      if (key.escape) setEditing(null);
      return;
    }
    if (key.escape || input === 'q') {
      onBack();
      return;
    }
    if (input === 'i') {
      setEditing('path');
      return;
    }
    if (input === 'o') {
      setEditing('output');
      return;
    }
    if (input === 'n') {
      void run('plan');
      return;
    }
    if (input === 'r' && plan) {
      void run('render');
      return;
    }
    if (input === 'p' && plan) {
      void run('preflight');
      return;
    }
    if (key.upArrow || input === 'k') setSelected((value) => Math.max(0, value - 1));
    if (key.downArrow || input === 'j')
      setSelected((value) => Math.min(Math.max(0, (plan?.jobs.length ?? 0) - 1), value + 1));
    if (input === ' ' && plan?.jobs[selected]) {
      const row = plan.jobs[selected]!.row;
      setExcluded((value) => {
        const next = new Set(value);
        if (next.has(row)) next.delete(row);
        else next.add(row);
        return next;
      });
    }
  });
  const pageSize = Math.max(1, rows - 13);
  const start = Math.max(0, selected - pageSize + 1);
  const current = plan?.jobs[selected];
  const result = results.find((result) => result.row === current?.row);
  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Text bold>Production batch review</Text>
      <Box>
        <Text>CSV: </Text>
        {editing === 'path' ? (
          <TextInput
            value={path}
            onChange={(value) => {
              setPath(value);
              setPlan(null);
            }}
            onSubmit={() => {
              void run('plan');
            }}
          />
        ) : (
          <Text wrap="truncate-end">{path || '(choose a file)'}</Text>
        )}
      </Box>
      <Box>
        <Text>Output: </Text>
        {editing === 'output' ? (
          <TextInput
            value={outDir}
            onChange={(value) => {
              setOutDir(value);
              setPlan(null);
            }}
            onSubmit={() => setEditing(null)}
          />
        ) : (
          <Text wrap="truncate-end">{outDir}</Text>
        )}
      </Box>
      <Panel title="Planned jobs" width={cols} height={Math.max(5, rows - 7)} active>
        {(plan?.jobs ?? []).slice(start, start + pageSize).map((job, index) => (
          <Text
            key={job.row}
            color={start + index === selected ? theme.accentName : theme.dim}
            wrap="truncate-end"
          >
            {start + index === selected ? '> ' : '  '}
            {excluded.has(job.row) ? '[skip]' : '[run]'} {job.row} {job.toolId} / {job.format}{' '}
            {results.find((result) => result.row === job.row)?.ok ? 'OK' : ''}
          </Text>
        ))}
        <Text color={theme.dim} wrap="truncate-end">
          {current?.outputPattern ?? 'Enter a file path to prepare a review.'}
        </Text>
        <Text wrap="truncate-end">
          {result?.error ??
            current?.readiness.map((item) => `${item.state}: ${item.reason}`).join('; ') ??
            ''}
        </Text>
        {result?.report ? (
          <Text wrap="truncate-end">
            Preflight:{' '}
            {JSON.stringify((result.report as { counts?: unknown }).counts ?? result.report)}
          </Text>
        ) : null}
      </Panel>
      <Text wrap="truncate-end">{status}</Text>
      <Text wrap="truncate-end">
        {busy
          ? 'c cancel / esc cancel'
          : 'n plan / p preflight / r run/resume / space exclude / i file / o output / esc back'}
      </Text>
    </Box>
  );
}
