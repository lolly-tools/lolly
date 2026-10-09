// SPDX-License-Identifier: MPL-2.0
/** Bounded process ownership includes Xcode's separately grouped build scripts. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventEmitter } from 'node:events';

export interface ProcessFact { pid: number; parent: number; group: number; born: string; executable: string }
export interface BuildLease { binding: string; actors: ProcessFact[] }
export const IOS_BUILD_MS = 1_800_000;

export function processFacts(): ProcessFact[] {
  const reply = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,lstart=,comm='], { encoding: 'utf8', timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
  assert.ok(!reply.error && reply.status === 0, 'Build process ownership cannot be inspected.');
  return reply.stdout.split('\n').filter(Boolean).map(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.+)$/);
    assert.ok(match, 'The local process identity format is unavailable.');
    return { pid: Number(match[1]), parent: Number(match[2]), group: Number(match[3]), born: match[4]!.replace(/\s+/g, ' '), executable: match[5]! };
  });
}
export const sameProcess = (a: ProcessFact, b: ProcessFact): boolean => a.pid === b.pid && a.born === b.born && a.executable === b.executable && a.group === b.group;

export function collectOwnedProcesses(known: ProcessFact[], current: ProcessFact[], additional: ProcessFact[] = []): ProcessFact[] {
  const result = new Map(known.map(row => [row.pid, row]));
  for (const row of additional) if (current.some(now => sameProcess(row, now))) result.set(row.pid, row);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of current) {
      const parent = result.get(row.parent);
      if (!result.has(row.pid) && parent && current.some(now => sameProcess(parent, now))) { result.set(row.pid, row); changed = true; }
    }
  }
  return [...result.values()];
}

async function leaseFacts(directory: string, binding: string): Promise<ProcessFact[]> {
  const files = (await readdir(directory)).filter(file => /^[a-f0-9-]{36}\.json$/.test(file));
  assert.ok(files.length <= 8192, 'The owned build process journal exceeded its bound.');
  return (await Promise.all(files.map(async file => {
    const bytes = await readFile(join(directory, file)); assert.ok(bytes.length <= 8192);
    const lease = JSON.parse(bytes.toString()) as BuildLease;
    assert.equal(lease.binding, binding, 'A process lease belongs to another build.');
    assert.ok(Array.isArray(lease.actors) && lease.actors.length <= 4);
    for (const actor of lease.actors) {
      for (const id of [actor.pid, actor.parent, actor.group]) assert.ok(Number.isSafeInteger(id) && id > 0, 'The owned process ID is invalid.');
      assert.ok(typeof actor.born === 'string' && actor.born.length <= 128 && typeof actor.executable === 'string' && actor.executable.length <= 4096);
    }
    return lease.actors;
  }))).flat();
}

export interface ProcessRun {
  command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv; stdio: ['ignore' | 'inherit', number | 'inherit', number | 'inherit'];
  leases: string; binding: string; deadline: number;
  supervise?: boolean;
  protectedGroup?: number;
}

function signalAlive(known: ProcessFact[], current: ProcessFact[], signal: NodeJS.Signals, kill: (pid: number, signal: NodeJS.Signals) => void): void {
  for (const row of known) if (current.some(now => sameProcess(row, now))) {
    try { kill(row.pid, signal); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}
const delay = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
export async function stopOwnedBuild(known: ProcessFact[], inspect = processFacts, kill: (pid: number, signal: NodeJS.Signals) => void = (pid, signal) => { process.kill(pid, signal); }, pause = delay): Promise<void> {
  const alive = () => { const current = inspect(); known = collectOwnedProcesses(known, current); return known.some(row => current.some(now => sameProcess(row, now))); };
  signalAlive(known, inspect(), 'SIGTERM', kill);
  for (let i = 0; i < 10; i++) {
    if (!alive()) return;
    await pause(100);
  }
  signalAlive(known, inspect(), 'SIGKILL', kill);
  for (let i = 0; i < 30; i++) {
    if (!alive()) return;
    await pause(100);
  }
  throw new Error('An owned build descendant remains after bounded teardown; retain the process journal.');
}

/** A wrapper lease also binds its own group leader, covering detached scripts. */
async function publishLease(run: ProcessRun, childPid: number): Promise<ProcessFact[]> {
  const current = processFacts();
  const actor = current.find(row => row.pid === process.pid), child = current.find(row => row.pid === childPid);
  const actors = [run.supervise ? undefined : actor, child].filter((row): row is ProcessFact => Boolean(row));
  if (actor && !run.supervise) {
    const leader = current.find(row => row.pid === actor.group);
    // Never adopt the caller's ordinary shell group. Wrappers are launched by
    // an owned detached builder; a direct CLI invocation has no such authority.
    if (process.env.CARGO_LOLLY_IOS_BUILD_BINDING === run.binding && leader && leader.pid !== actor.pid && leader.group !== run.protectedGroup) actors.push(leader);
  }
  const path = join(run.leases, randomUUID());
  await writeFile(path + '.tmp', JSON.stringify({ binding: run.binding, actors }), { flag: 'wx', mode: 0o600 });
  await rename(path + '.tmp', path + '.json');
  return child ? [child] : [];
}

export async function runOwnedBuild(run: ProcessRun, signals: Pick<EventEmitter, 'on' | 'off'> = process): Promise<number> {
  assert.ok(run.deadline > Date.now() && run.deadline - Date.now() <= IOS_BUILD_MS, 'The unchanged build deadline is invalid or expired.');
  const child = spawn(run.command, run.args, { cwd: run.cwd, env: run.env, stdio: run.stdio, detached: true });
  let known: ProcessFact[] = [], status: number | undefined, failure: Error | undefined;
  child.once('exit', code => { status = code ?? 1; }); child.once('error', error => { failure = error; });
  assert.ok(child.pid && child.pid > 0, 'The owned builder did not start.');
  const interrupted = () => { failure = new Error('Owned archive build interrupted.'); };
  signals.on('SIGTERM', interrupted); signals.on('SIGINT', interrupted);
  try {
    known = await publishLease(run, child.pid);
    while (status === undefined && !failure) {
      known = collectOwnedProcesses(known, processFacts(), run.supervise ? await leaseFacts(run.leases, run.binding) : []).filter(row => row.pid !== process.pid && row.group !== run.protectedGroup);
      if (Date.now() >= run.deadline) throw new Error('The unchanged 30-minute archive build deadline expired.');
      await delay(100);
    }
    if (failure) throw failure;
    return status ?? 1;
  } finally {
    signals.off('SIGTERM', interrupted); signals.off('SIGINT', interrupted);
    let journalFailed = false;
    try { known = collectOwnedProcesses(known, processFacts(), run.supervise ? await leaseFacts(run.leases, run.binding) : []).filter(row => row.pid !== process.pid && row.group !== run.protectedGroup); }
    catch { journalFailed = true; }
    await stopOwnedBuild(known);
    await writeFile(join(run.leases, `${randomUUID()}.json`), JSON.stringify({ binding: run.binding, actors: [], teardown: journalFailed ? 'known owned descendants exited; invalid journal needs inspection' : 'all observed owned descendants exited', observed: known.length }), { flag: 'wx', mode: 0o600 });
    assert.equal(journalFailed, false, 'The ownership journal is incomplete; unknown actors were preserved for inspection.');
  }
}
