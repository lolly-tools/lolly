#!/usr/bin/env node
/**
 * dev:web orchestrator.
 *
 * Runs the full local dev environment AND keeps the deploy artifacts fresh, so what
 * you see in dev is what ships. It runs three things:
 *
 *   1. docs/build.js --watch  — rebuilds the /info site on docs changes
 *   2. vite (shells/web)      — the web shell dev server (HMR)
 *   3. build-previews.js      — once the dev server answers, generates any MISSING
 *                               tool previews (catalog/previews/<id>.svg|png) against
 *                               the live dev server, in the background. This is the one
 *                               deploy artifact a plain build never produces, so the
 *                               gallery shows real cards in dev and the previews are
 *                               ready for a deploy. `--skip-existing` makes repeat starts
 *                               near-instant; run `npm run previews` to force a full
 *                               regenerate (e.g. after changing a tool's look).
 *
 * Vite auto-increments the port if the default is busy, so we read the chosen URL from
 * its output rather than hard-coding it. Ctrl-C tears all three down.
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
let shuttingDown = false;

function start(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  child.on('error', (e) => console.error(`✗ ${cmd} ${args.join(' ')}: ${e.message}`));
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// 1. /info site watcher.
start('node', ['docs/build.js', '--watch']);

// 2. vite dev server — pipe stdout so we can discover the port, but forward every
// byte so vite's own pretty output still shows.
const vite = spawn('npm', ['--workspace', 'shells/web', 'run', 'dev'], {
  cwd: ROOT,
  stdio: ['inherit', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});
children.push(vite);
vite.on('exit', (code) => shutdown(code ?? 0));

// 3. Kick off the missing-previews pass the moment vite reports its local URL.
let previewsLaunched = false;
const STRIP_ANSI = /\x1b\[[0-9;]*m/g;

function launchPreviews(url) {
  if (previewsLaunched || shuttingDown) return;
  previewsLaunched = true;
  console.log(`\n[dev:web] generating any missing tool previews against ${url} …`);
  start('node', ['scripts/build-previews.js', `--url=${url}`, '--skip-existing']);
}

vite.stdout.on('data', (chunk) => {
  process.stdout.write(chunk); // keep vite's output visible
  if (previewsLaunched) return;
  const m = chunk.toString().replace(STRIP_ANSI, '').match(/Local:\s+(http:\/\/\S+?)\/?\s/);
  if (m) launchPreviews(m[1].replace(/\/$/, ''));
});

// Fallback: if the port line is never matched, try vite's default after a grace
// period. waitForServer inside build-previews.js handles a not-yet-ready server,
// and fails gracefully (without touching dev) if the guess is wrong.
setTimeout(() => launchPreviews('http://localhost:5173'), 8000);
