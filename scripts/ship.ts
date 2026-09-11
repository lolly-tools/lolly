#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Deploy every target in scripts/data/ship-targets.json, gate first.
 *
 *   pnpm run ship              # PREVIEW -> first-load check -> promote what passed
 *   pnpm run ship --preview    # stop at the preview URL: no check, no promote
 *   pnpm run ship --prod       # straight to production, no preview (hotfix hatch)
 *   pnpm run ship --no-gate    # only when the gate already passed on this exact code
 *
 * Ported from `ship()`, `verify_deploy()`, `wait_ready()` and the `vercel_*` driver
 * in scripts/subrepo/loldev, which the subrepo collapse (plan 244) removed. The
 * commit-and-push half of `loldev ship` died with the submodules: there is one
 * repository now, so pushing is `git push` and not something a deploy script owns.
 *
 * THE GATE IS NOT OPTIONAL BY DEFAULT. scripts/gate.ts runs first and a failure
 * stops everything before a byte is uploaded, which is what the bash did
 * (`gtg … || { err "gtg failed - not deploying"; return 1; }`). `--no-gate` exists
 * for re-pushing a deploy-config fix on code the gate already passed.
 *
 * SUCCESS IS NEVER A CLI EXIT CODE. It is read from the host's own ready state, then
 * bound to OUR deployment id serving the domain, and verifyDeploy asserts the brand
 * on it afterwards. A dropped upload that created no deployment is retried; a build
 * error or a timeout is a real, reported failure. Each of those rules is there
 * because the simpler version of it was wrong in production: a held log stream that
 * dropped on a flaky link once failed a ship whose build had succeeded, and a
 * missing project env once put the blank brand on a live domain under a green
 * banner.
 *
 * THE DRIVER INDIRECTION STAYS. ship() is host-agnostic: it orchestrates
 * publish -> wait for ready -> bind success to deployment identity -> verify the
 * live brand, and dispatches every host-specific step to a driver picked per target
 * (the optional `driver` field, default 'vercel'). The internal-IT adapter for the
 * SUSE-IT migration already uses it, so a new target is an adapter plus a field
 * rather than a rewrite here.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { gate } from './gate.ts';
import { banner, err, info, ok, phase, rule, site, step, tally, warn } from './lib/log.ts';
import { type ShipTarget, shipTargets, shipTeam } from './lib/ship-targets.ts';

const ROOT = repoRoot();

/** Max seconds to wait for a build to reach a terminal state. */
const WAIT_READY_TIMEOUT = Number(process.env.LOLLY_WAIT_READY_TIMEOUT ?? 900);
/** Seconds between ready-state polls. */
const WAIT_READY_POLL = Number(process.env.LOLLY_WAIT_READY_POLL ?? 15);
/** Max seconds for the production domain to repoint to our deployment. */
const ALIAS_FLIP_TIMEOUT = Number(process.env.LOLLY_ALIAS_FLIP_TIMEOUT ?? 120);
/** Bounded upload retries, for a finalize POST that drops before it creates one. */
const DEPLOY_UPLOAD_TRIES = Number(process.env.LOLLY_DEPLOY_UPLOAD_TRIES ?? 3);

type Mode = 'prod' | 'preview';

/**
 * What every driver has to implement. All progress goes to stderr; the returned
 * values are the only contract.
 *
 * The handle is opaque to ship() with one exception: on the default path it is also
 * handed to scripts/check-first-load.ts, which fetches it, so a driver that wants
 * that path has to return a reachable https URL rather than an internal id.
 */
interface Driver {
  /** Scope credentials/host for this target. May do nothing. */
  setup(target: ShipTarget): void;
  /** Clear whatever setup() set. May do nothing. */
  teardown(): void;
  /** Deploy the local tree. Returns a deployment HANDLE, or null when no
   *  deployment was CREATED. Owns transport and any retry. */
  publish(target: ShipTarget, mode: Mode): string | null;
  /** The handle's canonical deployment id. */
  identity(handle: string): string;
  /** Poll to a terminal state: 'ready', 'failed' or 'timeout', plus the last
   *  token seen for the message. Transient errors keep polling. */
  waitReady(handle: string): { outcome: 'ready' | 'failed' | 'timeout'; state: string };
  /** The deployment id the DOMAIN currently serves - the production flip gate. */
  promotedId(domain: string): string;
  /** True when the handle serves 200 - the preview gate. */
  liveness(handle: string): boolean;
  /** Make the handle's deployment the one the domain serves, without rebuilding
   *  it. Only the default preview path calls this. */
  promote(handle: string): boolean;
  /** Optional: print how to read the failed build's logs. */
  logsHint?(handle: string): void;
}

function sleepSync(seconds: number): void {
  // A deploy poll is the one place a blocking wait is the simplest correct thing:
  // there is nothing else for this process to do, and Atomics.wait needs no timer.
  const buf = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buf, 0, 0, Math.max(0, seconds) * 1000);
}

/** Run a command, capturing stdout. Empty string on any failure. */
function capture(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : '';
}

// --- vercel driver ----------------------------------------------------------

/**
 * One field from `vercel inspect <target> --json`. --json is machine readable: the
 * human table prints a title-case '● Ready', NOT the API token READY, so never grep
 * the human output. `target` is a deployment URL or https://<domain>.
 */
function inspectField(target: string, field: string): string {
  const out = capture('npx', ['--yes', 'vercel', 'inspect', target, '--json']);
  if (!out) return '';
  try {
    const v = (JSON.parse(out) as Record<string, unknown>)[field];
    return v == null ? '' : String(v);
  } catch {
    return '';
  }
}

/** Newest PRODUCTION deployment URL for the scoped project, or '' on none. */
function newestProdUrl(): string {
  const out = capture('npx', ['--yes', 'vercel', 'ls', '--prod']);
  return /https:\/\/[a-z0-9-]+\.vercel\.app/.exec(out)?.[0] ?? '';
}

/**
 * Poll a deployment to a terminal state. Anything that is not an exact
 * READY / ERROR / CANCELED token - QUEUED, INITIALIZING, BUILDING, UPLOADING, an
 * empty read, a failed inspect, an unrecognised token - means keep polling, so a
 * transient inspect hiccup is never misread as a build failure.
 */
function waitReady(url: string): { outcome: 'ready' | 'failed' | 'timeout'; state: string } {
  let waited = 0;
  let state = '';
  while (waited < WAIT_READY_TIMEOUT) {
    state = inspectField(url, 'readyState');
    if (state === 'READY') return { outcome: 'ready', state };
    if (state === 'ERROR' || state === 'CANCELED') return { outcome: 'failed', state };
    process.stderr.write(`    build state: ${state || 'querying'} (${waited}s/${WAIT_READY_TIMEOUT}s)\n`);
    sleepSync(WAIT_READY_POLL);
    waited += WAIT_READY_POLL;
  }
  return { outcome: 'timeout', state };
}

const vercelDriver: Driver = {
  setup(target) {
    process.env.VERCEL_ORG_ID = shipTeam();
    process.env.VERCEL_PROJECT_ID = target.project;
  },
  teardown() {
    delete process.env.VERCEL_ORG_ID;
    delete process.env.VERCEL_PROJECT_ID;
  },
  identity(handle) {
    return inspectField(handle, 'id');
  },
  waitReady,
  promotedId(domain) {
    return inspectField(`https://${domain}`, 'id');
  },
  liveness(handle) {
    return spawnSync('curl', ['-fsI', '--max-time', '30', handle], { stdio: 'ignore' }).status === 0;
  },
  // Point the production domain at an ALREADY-BUILT deployment - the one that just
  // passed the first-load check - rather than deploying again, so the bytes that
  // were measured are the bytes that go live. The build being promoted resolved the
  // project's PREVIEW environment, which is why every brand-critical variable is
  // pinned per-deploy in publish() (--build-env for the build, --env for the
  // function's own runtime) instead of being trusted from the dashboard; verifyDeploy
  // still asserts the live brand on the domain afterwards, and ship() only calls this
  // once our deployment's identity is known.
  promote(handle) {
    return spawnSync('npx', ['--yes', 'vercel', 'promote', handle, '--yes'], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
    }).status === 0;
  },
  logsHint(handle) {
    process.stderr.write(
      `  logs:  VERCEL_ORG_ID=${shipTeam()} VERCEL_PROJECT_ID=${process.env.VERCEL_PROJECT_ID ?? '<id>'}` +
      ` npx vercel inspect ${handle} --logs\n`,
    );
  },
  publish(target, mode) {
    // Only the production path can adopt a lost deployment (newestProdUrl lists
    // production deployments), so only that path pays for the snapshot `vercel ls`.
    const snapshot = mode === 'prod' ? newestProdUrl() : '';
    for (let attempt = 1; attempt <= DEPLOY_UPLOAD_TRIES; attempt++) {
      step(`uploading + building on Vercel (LOLLY_PROFILE=${target.profile} · ${mode} · upload ${attempt}/${DEPLOY_UPLOAD_TRIES})`);
      const args = ['--yes', 'vercel', 'deploy'];
      if (mode === 'prod') args.push('--prod');
      // No --archive by default, the same choice loldev's vercel_publish made on purpose:
      // an archive is one blob Vercel cannot content-dedupe, so the ~1.3 GB of gitignored
      // ONNX models under shells/web/public/models would re-upload in full on every
      // deploy instead of once. The repo hook that insists on --archive inspects an
      // agent's own Bash command line, never this subprocess. LOLLY_SHIP_ARCHIVE=1 adds
      // the flag for a deploy where the file count matters more than the re-upload.
      if (process.env.LOLLY_SHIP_ARCHIVE) args.push('--archive=tgz');
      // The brand is pinned per-deploy so the repo is the source of truth regardless
      // of dashboard or local state. LOLLY_CLI_DEPLOY marks these in build logs.
      // ONNXRUNTIME_NODE_INSTALL_CUDA=skip: onnxruntime-node's postinstall fetches a
      // CUDA payload from a CDN that Vercel's build network cannot always reach
      // (a timeout killed a production build on 2026-08-10), and the GPU execution
      // provider is useless in a serverless build. It is also set as project env on
      // both projects; this flag is the backstop if that is ever lost.
      // `--env` as well as `--build-env` for the brand: since the subrepo collapse the
      // MCP function resolves the content profile at REQUEST time (services/mcp/src/paths.ts
      // asks the resolver on first use), so a build-only value would render the right
      // site and then serve /tool/*.svg out of whichever profile the function falls back
      // to. One deploy, one brand, both phases.
      args.push(
        '--build-env', `LOLLY_PROFILE=${target.profile}`,
        '--env', `LOLLY_PROFILE=${target.profile}`,
        '--build-env', 'LOLLY_CLI_DEPLOY=1',
        '--build-env', 'ONNXRUNTIME_NODE_INSTALL_CUDA=skip',
        '--yes',
      );
      // The CLI holds the build-log stream, so a ship shows the build happening. Its
      // exit code is read only as "was a deployment CREATED", never as the build's
      // outcome - ship() takes that from the ready state, because a held log stream
      // can still drop on a flaky link.
      const r = spawnSync('npx', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const log = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      process.stderr.write(log);
      // The deployment URL is the *.vercel.app host, never the vercel.com Inspect
      // dashboard link (which `vercel inspect` cannot resolve). Take the FIRST match:
      // the whole build log follows the CLI's own "Preview:/Production: https://…"
      // line, so the last match in the stream is not guaranteed to be ours.
      const url = /https:\/\/[a-z0-9-]+\.vercel\.app/.exec(log)?.[0] ?? '';
      if (url) return url;

      // No URL. A finalize POST likely dropped before creating the deployment. Give a
      // just-queued deploy a few seconds to surface (`ls` is eventually consistent),
      // adopt it if one appeared, else retry the upload.
      warn(`no deployment URL (exit ${r.status ?? 'signal'}) - checking whether one was created`);
      // Adoption is PRODUCTION-ONLY. newestProdUrl lists production deployments, so in
      // preview mode the newest one it can see belongs to somebody else's ship, not
      // ours - and since the default path PROMOTES whatever this returns, adopting a
      // stranger's deployment would put it on the domain.
      if (mode === 'prod') {
        for (let retry = 1; retry <= 5; retry++) {
          const found = newestProdUrl();
          if (found && found !== snapshot) {
            warn(`adopted ${found} (stdout lost; a new deployment exists)`);
            return found;
          }
          sleepSync(6);
        }
      }
      warn('no deployment created - retrying the upload');
    }
    return null;
  },
};

// --- internal_it driver (reference for the SUSE-IT migration) ---------------
// Dormant until a target's `driver` field is 'internal_it'. It implements the same
// contract, so ship() drives it unchanged. Model: build dist/ LOCALLY with the brand
// pinned, rsync it to a fresh release directory on the host over SSH, then swap the
// `current` symlink nginx serves atomically (zero downtime; rollback = repoint the
// symlink). Readiness and IDENTITY both come from the site's own /precache.json
// `version`, which the web build already emits - there is no server-side build to
// wait on, so the poll confirms the live version is ours, which covers rsync and CDN
// propagation and is exactly the identity binding the contract wants.
//
// Configure with LOLLY_IT_SSH (ssh target), LOLLY_IT_RELEASES (releases directory)
// and LOLLY_IT_CURRENT (the symlink nginx serves). All three are required.
//
// TODO(IT): the api/ functions (mcp, ca) need a Node runtime on the host, a systemd
// unit or a container. This driver ships the static site, so wire the functions into
// publish() after the rsync and reload their service. A push-swap model also has no
// throwaway preview URL, so --preview only 200-checks the domain and the default
// preview path would check a site this driver has already made live: use --prod here
// until IT offers real previews.
let itDomain = '';

function itLiveVersion(domain: string): string {
  const out = capture('curl', ['-fsS', '--max-time', '20', `https://${domain}/precache.json`]);
  try {
    return String((JSON.parse(out) as { version?: unknown }).version ?? '');
  } catch {
    return '';
  }
}

const internalItDriver: Driver = {
  setup(target) {
    itDomain = target.domain;
  },
  teardown() {
    itDomain = '';
  },
  identity(handle) {
    return handle; // the handle already IS the release id
  },
  promote() {
    return true; // the atomic `current` swap in publish() already promoted it
  },
  promotedId(domain) {
    return itLiveVersion(domain);
  },
  liveness() {
    return spawnSync('curl', ['-fsI', '--max-time', '30', `https://${itDomain}`], { stdio: 'ignore' }).status === 0;
  },
  logsHint() {
    process.stderr.write(`  logs:  ssh ${process.env.LOLLY_IT_SSH ?? '<host>'} -- journalctl -u lolly --since -10min\n`);
  },
  publish(target) {
    const ssh = process.env.LOLLY_IT_SSH;
    const releases = process.env.LOLLY_IT_RELEASES;
    const current = process.env.LOLLY_IT_CURRENT;
    if (!ssh || !releases || !current) {
      err('internal_it: set LOLLY_IT_SSH / LOLLY_IT_RELEASES / LOLLY_IT_CURRENT');
      return null;
    }
    step(`building dist/ locally for profile '${target.profile}'`);
    const build = spawnSync('pnpm', ['run', 'build:web'], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, LOLLY_PROFILE: target.profile },
    });
    if (build.status !== 0) return null;
    let releaseId = '';
    try {
      const precache = JSON.parse(readFileSync(join(ROOT, 'shells/web/dist/precache.json'), 'utf8')) as { version?: unknown };
      releaseId = String(precache.version ?? '');
    } catch { /* reported below */ }
    if (!releaseId) {
      err('internal_it: no dist/precache.json version - the build is incomplete');
      return null;
    }
    const dest = `${releases}/${releaseId}`;
    step(`rsync dist/ -> ${ssh}:${dest}`);
    // -a is required here, not a nicety: the release tree has to keep its modes.
    if (spawnSync('rsync', ['-a', '--delete', join(ROOT, 'shells/web/dist') + '/', `${ssh}:${dest}/`], {
      stdio: ['ignore', 'inherit', 'inherit'],
    }).status !== 0) return null;
    step(`atomic swap ${current} -> ${dest}`);
    if (spawnSync('ssh', [ssh, '--', `ln -sfn '${dest}' '${current}'`], {
      stdio: ['ignore', 'inherit', 'inherit'],
    }).status !== 0) return null;
    return releaseId;
  },
  /** Poll until the domain serves OUR release id. A push deploy has no async build
   *  to error, so only 'ready' or 'timeout' occur. */
  waitReady(handle) {
    let waited = 0;
    while (waited < WAIT_READY_TIMEOUT) {
      const live = itLiveVersion(itDomain);
      if (live === handle) return { outcome: 'ready', state: 'READY' };
      process.stderr.write(`    live version ${live || 'none'} (want ${handle} · ${waited}s)\n`);
      sleepSync(WAIT_READY_POLL);
      waited += WAIT_READY_POLL;
    }
    return { outcome: 'timeout', state: '' };
  },
};

const DRIVERS: Record<string, Driver> = { vercel: vercelDriver, internal_it: internalItDriver };

// --- the shared post-deploy brand assertion ---------------------------------

/**
 * Assert the live domain is serving the brand its target declares.
 *
 * The brand a project builds is governed by its LOLLY_PROFILE, and a missing or
 * mistyped value once shipped the blank brand to lolly.tools while ship() printed a
 * green banner. This reads the freshly-deployed domain's catalog and fails the ship
 * when the live tool count does not match the count the declared profile serves.
 * Production only: a preview deploy gets a throwaway URL and never updates the
 * domain alias, so there is nothing to assert.
 */
export function verifyDeploy(target: ShipTarget): boolean {
  // Resolved from the TARGET's profile, not from whatever profile this checkout
  // happens to resolve to: the two are routinely different, and the count is the
  // whole assertion.
  const expected = expectedToolCount(target.profile);
  if (!expected) {
    warn(`verify: cannot read the expected catalog for profile '${target.profile}' - skipping the brand assertion for ${target.domain}`);
    return true;
  }
  step(`verifying ${target.domain} is serving the '${target.profile}' brand (expecting ${expected} tools)`);
  let got = '';
  for (let tries = 0; tries < 6; tries++) {
    const body = capture('curl', ['-fsS', '--max-time', '30', `https://${target.domain}/catalog/tools/index.json`]);
    let actual = '';
    try {
      actual = String(((JSON.parse(body) as { tools?: unknown[] }).tools ?? []).length);
    } catch { /* transient; retried below */ }
    if (actual) got = actual;
    if (actual === expected) {
      ok(`verify: ${target.domain} serving '${target.profile}' - ${actual} tools live`);
      return true;
    }
    sleepSync(5);
  }
  // ship() only calls this AFTER confirming the domain already resolves to our READY
  // deployment, so an unreadable catalog here is a transient CDN or network blip
  // rather than a wrong brand. Do not hard-fail a live deploy on it.
  if (!got) {
    warn(`verify: could not read ${target.domain}/catalog - the deploy is live and READY, brand unconfirmed`);
    return true;
  }
  err(`verify: ${target.domain} shipped the WRONG brand - expected profile '${target.profile}' (${expected} tools) but the live catalog shows '${got}'`);
  err(`  check this project's LOLLY_PROFILE env: VERCEL_ORG_ID=${shipTeam()} VERCEL_PROJECT_ID=${target.project} npx vercel env ls`);
  return false;
}

/** Tool count in a named profile's committed index, or null when unreadable. */
function expectedToolCount(profile: string): string | null {
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as {
      profiles: Record<string, { catalog: string }>;
    };
    const entry = cfg.profiles[profile];
    if (!entry) return null;
    const index = JSON.parse(readFileSync(join(ROOT, entry.catalog, 'tools/index.json'), 'utf8')) as {
      tools?: unknown[];
    };
    return String((index.tools ?? []).length);
  } catch {
    return null;
  }
}

// --- ship -------------------------------------------------------------------

interface Options { mode: Mode; promote: boolean; runGate: boolean; label: string }

function parseArgs(argv: string[]): Options {
  const preview = argv.includes('--preview');
  const prod = argv.includes('--prod') || argv.includes('--production');
  const runGate = !argv.includes('--no-gate');
  if (prod) {
    if (preview) warn('--prod and --preview both given - --prod wins, deploying straight to production');
    return { mode: 'prod', promote: false, runGate, label: 'PRODUCTION (direct)' };
  }
  if (preview) return { mode: 'preview', promote: false, runGate, label: 'PREVIEW' };
  return { mode: 'preview', promote: true, runGate, label: 'PREVIEW -> first-load check -> PROMOTE' };
}

export function ship(argv: string[] = process.argv.slice(2)): boolean {
  const opts = parseArgs(argv);
  banner('🍭', 'lolly ship', `gate, then deploy every target · ${opts.label}`);

  if (opts.runGate) {
    if (!gate()) {
      err('gate failed - not deploying');
      return false;
    }
  } else {
    phase('⏩', 'Build gate');
    warn('skipped (--no-gate) - only correct when the gate already passed on this exact code');
  }

  const shipped: string[] = [];
  const failed: string[] = [];
  const targets = shipTargets();

  for (const target of targets) {
    const name = target.driver ?? 'vercel';
    const driver = DRIVERS[name];
    if (!driver) {
      err(`unknown deploy driver '${name}' for target ${target.name}`);
      failed.push(`${target.name} -> ${target.domain} (unknown driver '${name}')`);
      continue;
    }
    phase('🚀', `Deploy -> ${name} (${target.name} -> ${target.domain}, ${target.profile} · ${opts.label})`);

    // Per-target scope. Every path out of the loop body tears it down, so the scope
    // never leaks between targets.
    driver.setup(target);
    try {
      const handle = driver.publish(target, opts.mode);
      if (!handle) {
        err(`${name} published no deployment: ${target.name}`);
        failed.push(`${target.name} -> ${target.domain} (upload failed)`);
        continue;
      }
      const ourId = driver.identity(handle);

      step(`waiting for ${target.name} to build (${handle} · ready state <= ${Math.round(WAIT_READY_TIMEOUT / 60)}m)`);
      const { outcome, state } = driver.waitReady(handle);
      if (outcome === 'failed') {
        err(`build FAILED: ${target.name} - deployment ${state}`);
        driver.logsHint?.(handle);
        failed.push(`${target.name} -> ${target.domain} (build ${state})`);
        continue;
      }
      if (outcome === 'timeout') {
        // No confirmed READY. Fail CLOSED: do not rescue this via the domain brand
        // check, because on a same-brand redeploy the PREVIOUS deployment already
        // serves the right brand, so a brand match would falsely pass a stuck build.
        err(`build did not reach READY within ${WAIT_READY_TIMEOUT}s: ${target.name} (last: ${state || 'unknown'}) - raise LOLLY_WAIT_READY_TIMEOUT`);
        driver.logsHint?.(handle);
        failed.push(`${target.name} -> ${target.domain} (build timeout)`);
        continue;
      }
      ok(`${target.name} build READY (${ourId})`);

      if (opts.mode === 'preview') {
        // There is no domain alias to assert yet: READY plus a 200 from the handle is
        // as far as a preview gets on its own. A preview behind Vercel's deployment
        // protection answers 401 to an unauthenticated fetch, so it fails HERE,
        // loudly, and never reaches the first-load check.
        if (!driver.liveness(handle)) {
          err(`${target.name} is READY but not serving ${handle}`);
          failed.push(`${target.name} -> ${handle} (READY but not serving)`);
          continue;
        }
        if (!opts.promote) {
          shipped.push(`${target.name} -> ${handle}`);
          continue;
        }

        // The check that makes the preview worth doing: Lighthouse against the
        // deployment about to become production. Anything non-zero - a blown budget,
        // a missing check-first-load.ts, no resolvable Lighthouse - stops this target
        // here. Fail CLOSED: an unmeasured first load is not a passed one, and the
        // cost of being wrong is a slow production site.
        step(`first-load check: node scripts/check-first-load.ts ${handle}`);
        const smoke = spawnSync('node', [join(ROOT, 'scripts/check-first-load.ts'), handle], {
          cwd: ROOT,
          stdio: ['ignore', 'inherit', 'inherit'],
        });
        if (smoke.status !== 0) {
          err(`first-load budgets FAILED for ${target.name} - NOT promoting; ${target.domain} still serves its previous deployment`);
          info(`the preview is up at ${handle} - iterate against it, then ship again`);
          failed.push(`${target.name} -> ${target.domain} (first-load check failed, not promoted)`);
          continue;
        }
        ok('first-load budgets passed');

        step(`promoting the checked deployment -> ${target.domain}`);
        if (!driver.promote(handle)) {
          err(`promote FAILED for ${target.name} - ${target.domain} still serves its previous deployment`);
          failed.push(`${target.name} -> ${target.domain} (checked, promote failed)`);
          continue;
        }
        // Falls through into the production gates below on purpose: a promote is a
        // request, not proof, so the domain still has to be seen serving OUR
        // deployment id and OUR brand.
      }

      // Production (deployed straight, or just promoted): wait for the domain to
      // resolve to OUR deployment id before the brand check. Otherwise verifyDeploy
      // could read the PREVIOUS same-brand deployment and pass while ours is not yet
      // live. This is what binds success to deployment IDENTITY.
      let waited = 0;
      let live = '';
      while (waited < ALIAS_FLIP_TIMEOUT) {
        live = driver.promotedId(target.domain);
        if (live === ourId) break;
        sleepSync(6);
        waited += 6;
      }
      if (live !== ourId) {
        err(`${target.domain} did not promote to our deployment within ${ALIAS_FLIP_TIMEOUT}s (ours=${ourId}, live=${live || 'none'})`);
        failed.push(`${target.name} -> ${target.domain} (built READY but never promoted)`);
        continue;
      }
      if (verifyDeploy(target)) shipped.push(`${target.domain}  ·  ${handle}`);
      else failed.push(`${target.name} -> ${target.domain} (deployed, but the WRONG brand is live)`);
    } finally {
      driver.teardown();
    }
  }

  console.log('');
  rule();
  if (!failed.length) tally(true, `🎉  Shipped!  ·  ${targets.length} site(s) live`);
  else tally(false, `✗  ${failed.length}/${targets.length} site(s) failed to deploy`);
  for (const line of shipped) site(line);
  for (const line of failed) err(line);
  rule();
  return !failed.length;
}

function main(): void {
  if (!ship()) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
