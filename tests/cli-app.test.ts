// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly app` as a process: the order of events around the server and the browser.
 *
 * The browser is a shell script named by LOLLY_BROWSER that records its arguments and
 * then exits at once, fails, or stays, so no real browser opens and no real profile is
 * touched (HOME and XDG_DATA_HOME point into the test's own directory). The server's
 * own rules are covered in packages/node-shell/test/web-app-server.test.ts.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

import { RESERVED_SUBCOMMANDS } from '../shells/cli/src/args.ts';
import { APP_HELP } from '../shells/cli/src/app.ts';
import { needsContentRoot } from '../shells/cli/src/content-root.ts';
import { APP_DEFAULT_PORT, probePort } from '../packages/node-shell/src/web-app-server.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const WORK = mkdtempSync(join(tmpdir(), 'lolly-app-cli-'));
const WEB = join(WORK, 'web');
const ARGS_LOG = join(WORK, 'browser-args.log');
const PID_FILE = join(WORK, 'browser.pid');
const BROWSER = join(WORK, 'fake-browser.sh');

mkdirSync(WEB);
writeFileSync(join(WEB, 'index.html'), '<!doctype html><title>shell</title>');
writeFileSync(join(WEB, 'precache.json'), JSON.stringify({ version: 'cli-test', groups: {} }));
writeFileSync(BROWSER, [
  '#!/bin/sh',
  `printf '%s\\n' "$*" >> "${ARGS_LOG}"`,
  'case "$FAKE_BROWSER" in',
  '  fail) exit 7 ;;',
  `  stay) echo $$ > "${PID_FILE}"; exec sleep 60 ;;`,
  'esac',
  'exit 0',
  '',
].join('\n'));
chmodSync(BROWSER, 0o755);

const running = new Set<ChildProcess>();
after(() => {
  for (const child of running) child.kill('SIGKILL');
  if (existsSync(PID_FILE)) { try { process.kill(Number(readFileSync(PID_FILE, 'utf8'))); } catch { /* already gone */ } }
  rmSync(WORK, { recursive: true, force: true });
});

const env = (mode: string): NodeJS.ProcessEnv => ({
  ...process.env, LOLLY_BROWSER: BROWSER, FAKE_BROWSER: mode, HOME: WORK, XDG_DATA_HOME: join(WORK, 'xdg'), NO_COLOR: '1',
});

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>(done => server.close(() => done()));
  return port;
}

interface Launched { child: ChildProcess; stderr: () => string; exit: Promise<number | null> }

function launch(args: string[], mode: string): Launched {
  const child = spawn(process.execPath, ['shells/cli/bin/lolly.ts', 'app', ...args], { cwd: ROOT, env: env(mode), stdio: ['ignore', 'pipe', 'pipe'] });
  running.add(child);
  let stderr = '';
  let stdout = '';
  child.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  child.stdout!.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  const exit = new Promise<number | null>(done => child.once('exit', (code) => {
    running.delete(child);
    assert.equal(stdout, '', 'lolly app writes nothing to stdout');
    done(code);
  }));
  return { child, stderr: () => stderr, exit };
}

async function until(what: string, check: () => boolean | Promise<boolean>, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(done => setTimeout(done, 50));
  }
  assert.fail(`timed out waiting for ${what}`);
}

const serving = (port: number) => async (): Promise<boolean> => (await probePort(port, 300)).kind === 'lolly';
const loggedLaunches = (): string[] => (existsSync(ARGS_LOG) ? readFileSync(ARGS_LOG, 'utf8').trim().split('\n') : []);

test('app is a reserved word that needs no tools or catalog, on the fixed default port', () => {
  assert.ok((RESERVED_SUBCOMMANDS as readonly string[]).includes('app'));
  assert.equal(needsContentRoot('app'), false);
  assert.equal(APP_DEFAULT_PORT, 47474);
  const help = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'app', '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.equal(help.stdout, APP_HELP);
  assert.match(APP_HELP, /LOLLY_BROWSER/);
});

test('a directory with no index.html, a bad port and a stray argument are usage errors', () => {
  const run = (args: string[]) => spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'app', ...args], { cwd: ROOT, encoding: 'utf8', env: env('exit') });
  const noApp = run([`--dir=${WORK}`]);
  assert.equal(noApp.status, 2);
  assert.match(noApp.stderr, /no index\.html/);
  for (const port of ['80', 'abc', '70000']) assert.equal(run([`--dir=${WEB}`, `--port=${port}`]).status, 2, port);
  assert.equal(run([`--dir=${WEB}`, 'extra']).status, 2);
  assert.deepEqual(loggedLaunches(), [], 'no browser is started for a refused invocation');
});

test('a port held by another program stops the command and points at --port', async () => {
  const other = createServer((_req, res) => res.end('not lolly'));
  await new Promise<void>(done => other.listen(0, '127.0.0.1', done));
  const { port } = other.address() as AddressInfo;
  try {
    const run = launch([`--dir=${WEB}`, `--port=${port}`], 'exit');
    assert.equal(await run.exit, 3);
    assert.match(run.stderr(), new RegExp(`Port ${port} .*in use by another program`));
    assert.match(run.stderr(), /--port=<n>/);
    assert.deepEqual(loggedLaunches(), [], 'no window opens on a port Lolly does not hold');
  } finally {
    await new Promise<void>(done => other.close(() => done()));
  }
});

test('a browser that fails to start ends the command with exit 1 and frees the port', async () => {
  const port = await freePort();
  const run = launch([`--dir=${WEB}`, `--port=${port}`], 'fail');
  assert.equal(await run.exit, 1);
  assert.match(run.stderr(), /stopped as soon as it started \(exit 7\)/);
  assert.equal((await probePort(port, 300)).kind, 'foreign');
  rmSync(ARGS_LOG, { force: true });
});

test('a browser that hands the window off keeps the server up until SIGTERM', async () => {
  const port = await freePort();
  const run = launch(['--dir', WEB, '--port', String(port)], 'exit');
  await until('the server', serving(port));
  await until('the keep-serving note', () => /keeps serving/.test(run.stderr()));
  assert.deepEqual(loggedLaunches(), [[
    `--app=http://127.0.0.1:${port}/`,
    '--class=tools.lolly.Desktop',
    `--user-data-dir=${process.platform === 'darwin' ? join(WORK, 'Library', 'Application Support', 'lolly-browser-app') : join(WORK, 'xdg', 'lolly')}/browser`,
    '--no-first-run',
    '--no-default-browser-check',
  ].join(' ')]);
  run.child.kill('SIGTERM');
  assert.equal(await run.exit, 0);
  assert.equal((await probePort(port, 300)).kind, 'foreign', 'the port is free again');
  rmSync(ARGS_LOG, { force: true });
});

test('SIGINT closes the server as cleanly as SIGTERM', async () => {
  const port = await freePort();
  const run = launch([`--dir=${WEB}`, `--port=${port}`], 'exit');
  await until('the keep-serving note', () => /keeps serving/.test(run.stderr()));
  run.child.kill('SIGINT');
  assert.equal(await run.exit, 0);
  rmSync(ARGS_LOG, { force: true });
});

test('a second launch opens a window on the running Lolly; closing the browser ends the first', async () => {
  const port = await freePort();
  const first = launch([`--dir=${WEB}`, `--port=${port}`], 'stay');
  await until('the server', serving(port));
  await until('the browser', () => existsSync(PID_FILE));
  const started = Date.now();

  const second = launch([`--dir=${WEB}`, `--port=${port}`], 'exit');
  assert.equal(await second.exit, 0);
  assert.match(second.stderr(), /already running/);
  await until('the second window', () => loggedLaunches().length === 2);
  assert.equal(loggedLaunches()[1]!.split(' ')[0], `--app=http://127.0.0.1:${port}/`);
  assert.equal((await probePort(port, 300)).kind, 'lolly', 'the first launcher is still serving');

  // A browser that has been open for a while and then closes is the ordinary end.
  await new Promise(done => setTimeout(done, Math.max(0, 2700 - (Date.now() - started))));
  process.kill(Number(readFileSync(PID_FILE, 'utf8')));
  assert.equal(await first.exit, 0);
  assert.equal((await probePort(port, 300)).kind, 'foreign', 'the server stopped with the browser');
  rmSync(PID_FILE, { force: true });
});
