// SPDX-License-Identifier: MPL-2.0
/** Process transport shared by terminal workflows and the batch review. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
const stopping = new WeakSet<ChildProcess>();

export function terminalCliEntry(): string {
  for (const name of ['../../cli/bin/lolly.ts', './cli.js']) {
    const path = fileURLToPath(new URL(name, import.meta.url));
    if (existsSync(path)) return path;
  }
  throw new Error('The CLI is missing beside this TUI installation.');
}

export function stopCliProcess(child: ChildProcess | null): void {
  if (!child?.pid || stopping.has(child)) return;
  stopping.add(child);
  try {
    if (process.platform === 'win32') child.kill('SIGTERM');
    else process.kill(-child.pid, 'SIGTERM');
    const timer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid!, 'SIGKILL');
      } catch {
        /* Already stopped. */
      }
    }, 10000);
    timer.unref();
    child.once('close', () => clearTimeout(timer));
  } catch {
    /* Already stopped. */
  }
}

export function startCliProcess(args: string[]): ChildProcessByStdio<null, Readable, Readable> {
  return spawn(process.execPath, [terminalCliEntry(), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
}
