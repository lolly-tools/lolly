// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const nginx = read('deploy/docker/public.nginx.conf');
const caddy = read('deploy/docker/public.caddy');
const compose = read('deploy/docker/public.compose.yml');
const vercel = JSON.parse(read('vercel.json')) as {
  rewrites: { source: string; destination: string }[];
};

test('public VM preserves every fixed static alias in the public route contract', () => {
  for (const { source, destination } of vercel.rewrites) {
    if (
      !destination.startsWith('/view/') &&
      ![
        '/design',
        '/docs',
        '/agents.md',
        '/llms.txt',
        '/llms-full.txt',
        '/openapi.json',
        '/.well-known/lolly.json',
        '/robots.txt',
      ].includes(source)
    )
      continue;
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const location = nginx.match(new RegExp(`location = ${escaped} \\{([^}]+)\\}`));
    assert.ok(location, `Missing fixed alias ${source}`);
    assert.ok(location[1]?.includes(`try_files ${destination} =404;`), source);
  }
  assert.match(nginx, /location = \/t\/layout-studio \{ return 308 \/design\$is_args\$args; \}/);
  assert.match(
    nginx,
    /location = \/sitemap\.xml \{ return 308 \/info\/sitemap\.xml\$is_args\$args; \}/
  );
});

test('public VM refuses missing reserved static files and hides operator metadata', () => {
  for (const prefix of ['info', 'catalog', 'icons', 't', 'view']) {
    const location = nginx.match(new RegExp(`location /${prefix}/ \\{([^}]+)\\}`));
    assert.ok(location?.[1]?.includes('=404;'), prefix);
    assert.ok(!location?.[1]?.includes('/index.html;'), prefix);
  }
  assert.match(nginx, /location ~ \(\^\|\/\)\\\. \{ return 404; \}/);
  assert.match(nginx, /location \/docs\/ \{ return 404; \}/);
  assert.match(nginx, /location \/\.well-known\/ \{ return 404; \}/);
  assert.match(caddy, /@reserved path \/api \/api\/\* \/live \/live\/\* \/tool \/tool\/\*/);
  assert.match(caddy, /handle @reserved \{\s+respond "Not found" 404/);
});

test('public VM uses bounded public services with no private mounts or access opt-ins', () => {
  const services = compose.split(/^ {2}(?=\w+:)/m).slice(1);
  assert.equal(services.length, 4);
  for (const block of services) {
    assert.match(block, /image: \$\{LOLLY_PUBLIC_\w+_IMAGE:\?Set the qualified/);
    assert.match(block, /ports: \["127\.0\.0\.1:\d+:\d+"\]/);
    assert.match(block, /read_only: true/);
    assert.match(block, /cap_drop: \[ALL\]/);
    assert.match(block, /no-new-privileges:true/);
    assert.match(block, /mem_limit: [1-9]\d*m/);
    assert.match(block, /cpus: "[01]\.\d+"/);
    assert.match(block, /pids_limit: [1-9]\d*/);
    assert.match(block, /tmpfs: \["\/tmp:size=[1-9]\d*m,mode=1777"\]/);
  }
  assert.match(compose, /LOLLY_MCP_ALLOW_ANONYMOUS: \$\{LOLLY_PUBLIC_MCP_ALLOW_ANONYMOUS:-0\}/);
  assert.match(compose, /LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT: "0"/);
  assert.match(compose, /CA_ALLOW_IN_MEMORY_RATE_LIMIT: "0"/);
  assert.match(compose, /CA_DEV_FAKE_PROVIDER: "0"/);
  assert.match(compose, /LOLLY_MCP_PRIVATE_FILES: "0"/);
  assert.match(compose, /LOLLY_MCP_PUBLIC_ORIGIN: https:\/\/\$\{LOLLY_PUBLIC_HOST:/);
  assert.match(compose, /LOLLY_MCP_TRUSTED_PROXIES: \$\{LOLLY_PUBLIC_PROXY_PEER:\?/);
  assert.doesNotMatch(compose, /brands\/suse|LW_|postgres|\bVERCEL\b|docker\.sock/);
  assert.match(compose, /target: \/usr\/share\/nginx\/html\/models\s+read_only: true/);
  assert.match(compose, /create_host_path: false/);
});

test('public web image relay setting is optional and public content remains the default', () => {
  const dockerfile = read('deploy/docker/web.Dockerfile');
  assert.match(dockerfile, /^ARG VITE_LIVE_RELAY=$/m);
  assert.match(dockerfile, /^ENV VITE_LIVE_RELAY=\$\{VITE_LIVE_RELAY\}$/m);
  assert.match(dockerfile, /^ARG LOLLY_PROFILE=lolly-start$/m);
  assert.match(dockerfile, /id=LOLLY_CATALOG_SIGNING_KEY[^\n]*required=true/);
  assert.match(dockerfile, /id=VITE_CATALOG_PUBLIC_KEY_JWK[^\n]*required=true/);
});

test('web dependency fetch is source-independent but bootstrap, linking and signing always use full source', () => {
  const instructions = read('deploy/docker/web.Dockerfile').replace(/^\s*#.*$/gm, '');
  const stages = instructions.split(/^FROM /m).slice(1);
  assert.equal(stages.length, 3);
  const deps = stages[0]!; const build = stages[1]!;
  assert.match(deps, /node:26-bookworm@sha256:[a-f0-9]{64} AS deps/);
  assert.match(deps, /npm install --global pnpm@11\.26\.0/);
  assert.match(deps, /^COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml \.\/$/m);
  assert.match(deps, /^RUN pnpm fetch$/m);
  assert.doesNotMatch(deps, /COPY \.|brands\/|community\/|pnpm install|LOLLY_CATALOG_SIGNING_KEY/);
  assert.match(build, /^deps AS build/);
  assert.ok(build.indexOf('COPY . .') < build.indexOf('pnpm install --offline --frozen-lockfile --prod=false'));
  assert.ok(build.indexOf('pnpm install --offline --frozen-lockfile --prod=false') < build.indexOf('pnpm run build:web:release'));
  assert.doesNotMatch(instructions, /--ignore-scripts|LOLLY_SKIP_BOOTSTRAP_CHECK/);
  const manifest = JSON.parse(read('package.json')) as { scripts: { preinstall: string } };
  assert.equal(manifest.scripts.preinstall, 'node scripts/check-bootstrap.ts');
  const workspace = read('pnpm-workspace.yaml');
  for (const line of workspace.split('\n').filter(line => /^ {2}- /.test(line))) assert.ok(read(`${line.slice(4)}/package.json`));
});

test('browser image is optional, lockfile-scoped and retains sandbox/auth defaults', () => {
  const source = read('deploy/docker/mcp-browser.Dockerfile');
  assert.match(source, /FROM node:26-bookworm-slim@sha256:[a-f0-9]{64}/);
  assert.match(source, /ARG LOLLY_PROFILE=lolly-start/);
  assert.match(
    source,
    /env -u PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD node services\/mcp\/scripts\/install-browser.ts --force/
  );
  assert.match(source, /COPY --from=build \/opt\/lolly-browsers \/opt\/lolly-browsers/);
  assert.match(source, /install-browser.ts --with-deps/);
  assert.match(source, /USER node/);
  assert.match(source, /ENV XDG_CONFIG_HOME=\/tmp\/config/);
  assert.match(source, /ENV XDG_CACHE_HOME=\/tmp\/cache/);
  assert.doesNotMatch(
    source,
    /LOLLY_BROWSER_NO_SANDBOX=1|LOLLY_MCP_ALLOW_ANONYMOUS=1|LOLLY_MCP_TOKEN=/
  );
  assert.match(compose, /LOLLY_BROWSER_NO_SANDBOX: \$\{LOLLY_PUBLIC_BROWSER_NO_SANDBOX:-0\}/);
  assert.match(compose, /LOLLY_WEB_BASE: \$\{LOLLY_PUBLIC_WEB_BASE:-\}/);
  assert.match(compose, /LOLLY_BROWSER_MAX_CONCURRENCY: "1"/);
});

/**
 * One job's block from a workflow, by its id under `jobs:`. The block ends where the
 * next two-space key or two-space comment begins. This file runs in a sparse
 * checkout with no dependencies installed, so it reads the YAML as text.
 */
function workflowJob(workflow: string, id: string): string {
  const start = workflow.indexOf(`\n  ${id}:\n`);
  assert.ok(start >= 0, `no ${id} job`);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}(?:#|[a-z0-9-]+:\n)/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

function normalCiSource(alter?: (run: Record<string, unknown>, inventory: { total_count: number; jobs: Record<string, unknown>[] }) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-normal-ci-'));
  try {
    const run = { id: 123, run_attempt: 2, status: 'completed', conclusion: 'success', head_sha: archiveSource, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', repository: { full_name: 'owner/lolly' }, head_repository: { full_name: 'owner/lolly' } };
    const inventory = { total_count: 2, jobs: [
      { id: 1, run_id: 123, name: 'typecheck', status: 'completed', conclusion: 'success' },
      { id: 2, run_id: 123, name: 'verified instance shell', status: 'completed', conclusion: 'skipped' },
    ] as Record<string, unknown>[] };
    alter?.(run, inventory);
    writeFileSync(join(directory, 'normal-ci-run.json'), JSON.stringify(run));
    writeFileSync(join(directory, 'normal-ci-jobs.json'), JSON.stringify(inventory));
    const script = workflowJob(read('.github/workflows/deployment-suse.yml'), 'source-qualification').match(/node --input-type=module <<'JS'\n([\s\S]*?)\n\s+JS/)?.[1];
    assert.ok(script, 'execute the maintained normal CI source guard');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, RUNNER_TEMP: directory, CI_RUN: '123', EXPECTED_SOURCE: archiveSource, GITHUB_REPOSITORY: 'owner/lolly' }, encoding: 'utf8', timeout: 5000,
    });
    return { status: result.status, stderr: result.stderr, receipt: result.status === 0 ? JSON.parse(readFileSync(join(directory, 'normal-ci-source.json'), 'utf8')) : null };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('public candidates require exact successful normal main CI and its complete attempt inventory', () => {
  const result = normalCiSource();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.receipt, { version: 1, source: archiveSource, ciRun: 123, ciAttempt: 2, workflow: '.github/workflows/ci.yml', jobCount: 2 });
  const refusals: [string, NonNullable<Parameters<typeof normalCiSource>[0]>][] = [
    ['wrong run', run => { run.id = 124; }], ['string run', run => { run.id = '123'; }], ['wrong SHA', run => { run.head_sha = 'b'.repeat(40); }],
    ['wrong workflow', run => { run.path = '.github/workflows/deployment-suse.yml'; }],
    ['PR', run => { run.event = 'pull_request'; }], ['other branch', run => { run.head_branch = 'feature'; }],
    ['other repo', run => { run.repository = { full_name: 'fork/lolly' }; }],
    ['fork source', run => { run.head_repository = { full_name: 'fork/lolly' }; }],
    ['unfinished', run => { run.status = 'in_progress'; }], ['failed', run => { run.conclusion = 'failure'; }],
    ['invalid attempt', run => { run.run_attempt = 0; }],
    ['incomplete jobs', (_run, inventory) => { inventory.total_count++; }],
    ['empty jobs', (_run, inventory) => { inventory.jobs = []; inventory.total_count = 0; }],
    ['duplicate jobs', (_run, inventory) => { inventory.jobs[1]!.id = 1; }],
    ['wrong job run', (_run, inventory) => { inventory.jobs[0]!.run_id = 124; }],
    ['unfinished job', (_run, inventory) => { inventory.jobs[0]!.status = 'in_progress'; }],
    ['failed job', (_run, inventory) => { inventory.jobs[0]!.conclusion = 'failure'; }],
    ['unknown skip', (_run, inventory) => { inventory.jobs[0]!.conclusion = 'skipped'; }],
    ['only skips', (_run, inventory) => { inventory.jobs = [inventory.jobs[1]!]; inventory.total_count = 1; }],
  ];
  for (const [name, alter] of refusals) {
    const refused = normalCiSource(alter); assert.notEqual(refused.status, 0, name); assert.equal(refused.receipt, null, name);
  }
  const job = workflowJob(read('.github/workflows/deployment-suse.yml'), 'source-qualification');
  assert.match(job, /actions\/runs\/\$CI_RUN\/attempts\/\$ci_attempt\/jobs\?per_page=100/);
  assert.match(job, /git merge-base --is-ancestor "\$EXPECTED_SOURCE" refs\/remotes\/origin\/main/);
  assert.match(job, /test "\$GITHUB_SHA" = "\$EXPECTED_SOURCE"/);
  assert.doesNotMatch(job, /secrets\.|packages: write|docker (?:push|build)/);
});

test('signed public candidate pin must match the valid existing repository public coordinates', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' });
  const other = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' });
  const web = workflowJob(read('.github/workflows/deployment-suse.yml'), 'web-image');
  const script = web.match(/node --input-type=module -e '\n([\s\S]*?)\n\s+'/)?.[1]; assert.ok(script);
  const directory = mkdtempSync(join(tmpdir(), 'lolly-public-pin-'));
  try {
    const cases = [[key, key, true], [{ ...key, ext: true }, key, true], [key, other, false], [key, {}, false],
      [{ ...key, d: 'private' }, key, false], [key, { ...key, d: 'private' }, false],
      [{ ...key, x: 'invalid' }, { ...key, x: 'invalid' }, false]] as const;
    for (const [submitted, existing, accepted] of cases) {
      const root = mkdtempSync(join(directory, 'case-')); const receipts = join(root, 'lolly-image-receipts');
      // The real preflight creates this directory before its pin-only program.
      mkdirSync(receipts);
      const result: SpawnSyncReturns<string> = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, RUNNER_TEMP: root, VITE_CATALOG_PUBLIC_KEY_JWK: JSON.stringify(submitted), EXISTING_PUBLIC_KEY_JWK: JSON.stringify(existing) }, encoding: 'utf8', timeout: 5000,
      });
      assert.equal(result.status === 0, accepted, result.stderr);
      if (accepted) assert.deepEqual(JSON.parse(readFileSync(join(receipts, 'public.jwk.json'), 'utf8')), key);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('web build exports only dependency cache and always reruns the signed source stage', () => {
  const web = workflowJob(read('.github/workflows/deployment-suse.yml'), 'web-image');
  const step = web.slice(web.indexOf('- name: Build the exact public web image'), web.indexOf('- name: Verify the actual image catalog'));
  const script = step.split('        run: |\n')[1]?.replace(/^ {10}/gm, ''); assert.ok(script);
  assert.match(script, /sha256sum package\.json pnpm-lock\.yaml pnpm-workspace\.yaml deploy\/docker\/web\.Dockerfile/);
  assert.match(script, /--driver docker-container/);
  assert.match(script, /image=moby\/buildkit:v0\.34\.0@sha256:b059f8d7226d0b326bc871af489a5dddf65e36af4d20d14251b072974d9ee87c/);
  const directory = mkdtempSync(join(tmpdir(), 'lolly-dependency-cache-'));
  try {
    for (const failure of ['', 'create', 'fetch']) {
      const root = mkdtempSync(join(directory, 'case-')); mkdirSync(join(root, 'deploy/docker'), { recursive: true });
      mkdirSync(join(root, 'lolly-image-receipts'));
      for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'deploy/docker/web.Dockerfile']) writeFileSync(join(root, file), 'synthetic input\n');
      const mock = `
        uname() { printf '%s\\n' x86_64; }
        sha256sum() { "$NODE_EXEC" --input-type=module -e '
          import {createHash} from "node:crypto"; import {readFileSync} from "node:fs";
          const files=process.argv.slice(1); for(const file of files.length?files:[null]) {
            process.stdout.write(createHash("sha256").update(readFileSync(file??0)).digest("hex")+"  "+(file??"-")+"\\n");
          }
        ' "$@"; }
        docker() {
          "$NODE_EXEC" --input-type=module -e 'import {appendFileSync} from "node:fs"; appendFileSync(process.env.TRACE,JSON.stringify(process.argv.slice(1))+"\\n");' "$@"
          if [[ "$FAIL" == create && "$1" == buildx && "$2" == create ]]; then return 1; fi
          if [[ "$FAIL" == fetch && "$1" == buildx && "$2" == build && "$*" == *"--target deps"* ]]; then return 1; fi
        }
      `;
      const result: SpawnSyncReturns<string> = spawnSync('bash', ['-c', mock + script], { cwd: root, env: {
        ...process.env, NODE_EXEC: process.execPath, TRACE: join(root, 'calls.jsonl'), FAIL: failure, RUNNER_TEMP: root,
        LOLLY_CATALOG_SIGNING_KEY: 'synthetic-not-a-key', REGISTRY_TOKEN: 'synthetic-not-a-token', GITHUB_ACTOR: 'fixture',
        GITHUB_REPOSITORY_OWNER: 'Owner', GITHUB_REPOSITORY: 'Owner/lolly', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', EXPECTED_SOURCE: archiveSource,
      }, encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status === 0, failure === '', result.stderr);
      const calls = readFileSync(join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]);
      const builds = calls.filter(args => args[0] === 'buildx' && args[1] === 'build');
      assert.equal(calls.some(args => args[1] === 'rm'), failure !== 'create', 'remove only an acquired builder');
      if (failure === 'create') { assert.equal(builds.length, 0); continue; }
      const deps = builds[0]!; assert.ok(deps.includes('--target')); assert.equal(deps[deps.indexOf('--target') + 1], 'deps');
      assert.ok(deps.includes('--cache-to')); assert.doesNotMatch(deps.join(' '), /--secret|--build-arg|--load|suse/);
      assert.match(deps[deps.indexOf('--cache-to') + 1]!, /^type=registry,ref=ghcr\.io\/owner\/lolly-web-deps-cache:neutral-node26-pnpm11-amd64-[a-f0-9]{64},mode=max$/);
      assert.equal(builds.length, failure === 'fetch' ? 1 : 2);
      if (failure) continue;
      const release = builds[1]!; assert.ok(release.includes('--load')); assert.ok(release.includes('--cache-from'));
      assert.equal(release[release.indexOf('--no-cache-filter') + 1], 'build'); assert.ok(!release.includes('--cache-to'));
      assert.ok(release.includes('LOLLY_PROFILE=lolly-start')); assert.ok(release.includes('id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY'));
      const receipt = JSON.parse(readFileSync(join(root, 'lolly-image-receipts/dependency-cache.json'), 'utf8'));
      assert.equal(receipt.scope, 'public-neutral'); assert.equal(receipt.target, 'deps');
      assert.equal(receipt.sourceExported, false); assert.equal(receipt.signingExported, false); assert.equal(receipt.releaseStageCache, false);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('native image publication is opt-in and follows source, catalog and sandbox qualification', () => {
  const workflow = read('.github/workflows/deployment-suse.yml');
  const web = workflowJob(workflow, 'web-image');
  const services = workflowJob(workflow, 'service-images');
  const browser = workflowJob(workflow, 'mcp-browser-image');
  for (const job of [web, services, browser]) {
    assert.match(job, /github.event_name == 'workflow_dispatch' && inputs.build_images == true/);
    assert.match(job, /needs: \[chart, public-vm, source-qualification(?:, [a-z-]+)?\]/);
    assert.match(job, /test "\$GITHUB_SHA" = "\$EXPECTED_SOURCE"/);
    assert.match(job, /submodules: false/);
    assert.doesNotMatch(job, /seccomp=unconfined|--privileged|SYS_ADMIN|LOLLY_BROWSER_NO_SANDBOX=1/);
  }
  for (const job of [web, services]) {
    assert.match(job, /--read-only --cap-drop ALL --security-opt no-new-privileges:true/);
  }
  // Only the web image is signed, so only its job sees the signing key.
  assert.match(web, /secrets.LOLLY_CATALOG_SIGNING_KEY/);
  assert.match(web, /--secret id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY/);
  assert.match(web, /verify-release-catalog.ts/);
  assert.ok(web.indexOf('verify-release-catalog.ts') < web.indexOf('docker push "$remote"'));
  for (const job of [services, browser]) {
    assert.doesNotMatch(job, /LOLLY_CATALOG_SIGNING_KEY|VITE_CATALOG_PUBLIC_KEY_JWK/);
  }
  // CA and Penpot boot and publish without any web shell; only the browser image
  // waits for the probe shell.
  assert.match(services, /needs: \[chart, public-vm, source-qualification\]\n/);
  assert.match(services, /for service in ca penpot; do/);
  assert.doesNotMatch(services, /probe-web-shell|lolly-probe-web|mcp-browser/);
  assert.match(browser, /needs: \[chart, public-vm, source-qualification, probe-web-shell\]\n/);
  assert.match(browser, /--read-only --cap-drop ALL --security-opt no-new-privileges:true/);
  assert.match(browser, /--env LOLLY_BROWSER_NO_SANDBOX=0/);
  assert.match(
    browser,
    /--security-opt "seccomp=\$GITHUB_WORKSPACE\/deploy\/docker\/seccomp\/public-browser-sandbox.json"/
  );
  assert.ok(browser.indexOf('public-image-probe.ts') < browser.indexOf('docker push "$remote"'));
  // The probe's web shell is this run's unsigned build of the same source, checked
  // before use and never pushed.
  const fixture = workflowJob(workflow, 'probe-web-shell');
  assert.match(fixture, /run: pnpm run build:web\n/);
  assert.match(fixture, /release: false/);
  assert.match(fixture, /retention-days: 1/);
  assert.doesNotMatch(fixture, /LOLLY_CATALOG_SIGNING_KEY|VITE_CATALOG_PUBLIC_KEY_JWK|packages: write|docker push/);
  assert.match(browser, /receipt.source !== process.env.EXPECTED_SOURCE \|\| receipt.runId !== process.env.GITHUB_RUN_ID \|\| receipt.runAttempt !== attempt \|\| receipt.release !== false/);
  assert.match(fixture, /name: unsigned-probe-web-shell-attempt-\$\{\{ github.run_attempt \}\}/);
  assert.match(browser, /name: unsigned-probe-web-shell-attempt-\$\{\{ github.run_attempt \}\}/);
  assert.match(browser, /src=\$RUNNER_TEMP\/lolly-probe-web,dst=\/qualification-web,readonly/);
  const diagnosis = browser.slice(
    browser.indexOf('- name: Retain bounded unqualified'),
    browser.indexOf('- name: Report tool drift')
  );
  assert.match(diagnosis, /failure\(\) && steps\.native_probe\.outcome == 'failure'/);
  assert.match(diagnosis, /qualified: false, promotionAllowed: false/);
  assert.match(diagnosis, /retention-days: 1/);
  assert.doesNotMatch(diagnosis, /docker push|REGISTRY_TOKEN|CA_ROOT_KEY/);
  // Production MCP drives the shell at its webBase, not the probe shell: the drift
  // against that shell is reported, after the probe, and never blocks publication.
  const pairing = browser.slice(
    browser.indexOf('- name: Report tool drift'),
    browser.indexOf('- name: Publish only the qualified MCP browser image digest')
  );
  assert.ok(browser.indexOf('- name: Report tool drift') > browser.indexOf('public-image-probe.ts'));
  assert.match(pairing, /continue-on-error: true/);
  assert.match(pairing, /node deploy\/docker\/web-pairing.ts --tools "\$RUNNER_TEMP\/lolly-mcp-tools" --web-base "\$PAIRED_WEB_BASE"/);
  assert.doesNotMatch(pairing, /docker push|REGISTRY_TOKEN/);
  assert.match(browser, /PAIRED_WEB_BASE: \$\{\{ inputs.paired_web_base \}\}/);
  assert.match(browser, /\[\[ "\$PAIRED_WEB_BASE" =~ \^https:\/\/\[a-z0-9.-\]\+\(:\[0-9\]\+\)\?\$ \]\]/);
  // Each archive image needs its own passing job and the unchanged content checks.
  const archive = workflowJob(workflow, 'archive-qualified-images');
  assert.match(archive, /if\(web==='success'\)/);
  assert.match(archive, /if\(gate!=='success'\) throw Error/);
  assert.match(archive, /if\(mcp==='success'\)/);
  assert.match(archive, /if\(probe!=='success'\) throw Error/);
  assert.match(archive, /mcp-browser\) artifact="public-candidate-mcp-browser-receipts-attempt-\$qualification_attempt"/);
  assert.match(archive, /web\) artifact="public-candidate-web-receipts-attempt-\$qualification_attempt"/);
  assert.match(archive, /--name "\$artifact" --dir "\$RUNNER_TEMP\/receipts\/\$service"/);
  assert.match(archive, /withheld:selection\.withheld,notSelected:selection\.notSelected,notQualified:selection\.notQualified/);
  assert.match(archive, /release\.source!==process\.env\.SOURCE_SHA \|\| release\.runId!==process\.env\.QUALIFICATION_RUN \|\| release\.runAttempt!==qualification\.attempt \|\| !release\.neutralProfile/);
  assert.match(archive, /actions\/runs\/\$QUALIFICATION_RUN\/attempts\/\$qualification_attempt\/jobs\?per_page=100/);
  assert.match(archive, /qualificationAttempt:qualification\.attempt/);
  for (const [job, artifact] of [['web-image', 'web'], ['mcp-browser-image', 'mcp-browser']]) {
    assert.match(workflowJob(workflow, job!), new RegExp(`name: public-candidate-${artifact}-receipts-attempt-\\$\\{\\{ github.run_attempt \\}\\}`));
  }
  assert.match(archive, /config\.config\.Labels\['org.opencontainers.image.revision'\]!==release\.source/);
  assert.match(archive, /manifest\.config\.digest!==receipt\.imageId/);
  assert.match(archive, /await hash\(raw\+'\/'\+blob\.digest\.slice\(7\)\)!==blob\.digest\.slice\(7\)/);
  // The archive finds each job by its display name, so the jobs must carry those exact names.
  assert.match(browser, /name: Opt-in native public MCP browser image \(not gated on WebGPU\)\n/);
  assert.match(web, /name: Opt-in native public web image \(gated on the WebGPU table\)\n/);
  assert.match(workflowJob(workflow, 'web-release-gate'), /name: WebGPU release gate \(web shell image only\)\n/);
});

test('public preparation scopes keep full as the default and web updates independent of services', () => {
  const workflow = read('.github/workflows/deployment-suse.yml');
  assert.match(workflow, /release_scope:\n(?:.*\n){3}\s+options: \[full, web, services-docs\]\n\s+default: full/);
  const webJobs = ['web-release-gate', 'web-image'];
  const independentJobs = ['probe-web-shell', 'service-images', 'mcp-browser-image', 'info-docs'];
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const scope of ['full', 'web', 'services-docs', 'unknown']) {
      for (const buildImages of [false, true]) {
        for (const id of [...webJobs, ...independentJobs]) {
          const condition = workflowJob(workflow, id).match(/^\s+if: (.+)$/m)?.[1];
          assert.ok(condition);
          const expression = condition.replaceAll('github.event_name', 'event').replaceAll('inputs.build_images', 'buildImages')
            .replaceAll('inputs.release_scope', 'scope').replaceAll('needs.web-release-gate.outputs.allowed', 'allowed');
          const evaluate = new Function('event', 'buildImages', 'scope', 'allowed', `return (${expression});`) as (event: string, buildImages: boolean, scope: string, allowed: string) => boolean;
          const selected = event === 'workflow_dispatch' && buildImages
            && (scope === 'full' || scope === (webJobs.includes(id) ? 'web' : 'services-docs'));
          assert.equal(evaluate(event, buildImages, scope, 'true'), selected, `${event}/${scope}/${buildImages}/${id}`);
          if (id === 'web-image') assert.equal(evaluate(event, buildImages, scope, 'false'), false);
        }
      }
    }
  }
  const validation = workflowJob(workflow, 'chart').match(/case "\$RELEASE_SCOPE" in[\s\S]*?esac/)?.[0];
  assert.ok(validation);
  for (const scope of ['full', 'web', 'services-docs', 'unknown', '']) {
    const result: SpawnSyncReturns<string> = spawnSync('bash', ['-c', validation], { env: { ...process.env, RELEASE_SCOPE: scope }, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status === 0, ['full', 'web', 'services-docs'].includes(scope), result.stderr);
  }
  assert.match(workflowJob(workflow, 'web-image'), /docker buildx build --load --no-cache-filter build --platform linux\/amd64/);
  for (const id of ['service-images', 'mcp-browser-image']) {
    assert.match(workflowJob(workflow, id), /docker buildx build --load --no-cache --platform linux\/amd64/);
  }
});

const archiveNames = {
  chart: 'Public chart render and schema checks', route: 'Public VM route and security acceptance',
  source: 'Reviewed main CI source',
  web: 'Opt-in native public web image (gated on the WebGPU table)', gate: 'WebGPU release gate (web shell image only)',
  mcp: 'Opt-in native public MCP browser image (not gated on WebGPU)', probe: 'Unsigned web shell for the MCP browser probe (never published)',
};
const archiveSource = 'a'.repeat(40);
function archiveSelection(outcomes: Partial<Record<keyof typeof archiveNames, string>>, alter?: (run: Record<string, unknown>, inventory: { total_count: number; jobs: Record<string, unknown>[] }) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-image-selection-'));
  try {
    const run = { id: 123, run_attempt: 2, status: 'completed', head_sha: archiveSource, path: '.github/workflows/deployment-suse.yml', event: 'workflow_dispatch' };
    const jobs = Object.entries(archiveNames).map(([id, name], index) => ({ id: index + 1, run_id: 123, run_attempt: 2, name, status: 'completed', conclusion: outcomes[id as keyof typeof archiveNames] ?? 'success' }));
    const inventory = { total_count: jobs.length, jobs: jobs as Record<string, unknown>[] };
    alter?.(run, inventory);
    writeFileSync(join(directory, 'run.json'), JSON.stringify(run)); writeFileSync(join(directory, 'jobs.json'), JSON.stringify(inventory));
    const job = workflowJob(read('.github/workflows/deployment-suse.yml'), 'archive-qualified-images');
    const preflight = job.match(/node --input-type=module -e '\n([\s\S]*?)\n\s+'/)?.[1]; assert.ok(preflight);
    const env = { ...process.env, RUNNER_TEMP: directory, SOURCE_SHA: archiveSource, QUALIFICATION_RUN: '123' };
    const initial = spawnSync(process.execPath, ['--input-type=module', '-e', preflight], { env, encoding: 'utf8', timeout: 5000 });
    if (initial.status !== 0) return { status: initial.status, stderr: initial.stderr, selection: null };
    assert.equal(initial.stdout, '2');
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'qualification-run.json'), 'utf8')), { runId: '123', source: archiveSource, attempt: 2 });
    const script = job.match(/node --input-type=module <<'JS'\n([\s\S]*?)\n\s+JS/)?.[1];
    assert.ok(script, 'execute the maintained archive selector');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env, encoding: 'utf8', timeout: 5000,
    });
    return { status: result.status, stderr: result.stderr, selection: result.status === 0 ? JSON.parse(readFileSync(join(directory, 'image-selection.json'), 'utf8')) as { qualified: string[]; withheld: string[]; notSelected: string[]; notQualified: Record<string, string> } : null };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('archive selection exports only the observed qualified web and MCP subset', () => {
  const full = archiveSelection({}); assert.equal(full.status, 0, full.stderr);
  assert.deepEqual(full.selection, { qualified: ['web', 'mcp-browser'], withheld: [], notSelected: [], notQualified: {} });
  const web = archiveSelection({ mcp: 'skipped', probe: 'skipped' }); assert.equal(web.status, 0, web.stderr);
  assert.deepEqual(web.selection, { qualified: ['web'], withheld: [], notSelected: ['mcp-browser'], notQualified: {} });
  const services = archiveSelection({ web: 'skipped', gate: 'skipped' }); assert.equal(services.status, 0, services.stderr);
  assert.deepEqual(services.selection, { qualified: ['mcp-browser'], withheld: [], notSelected: ['web'], notQualified: {} });
  const withheld = archiveSelection({ web: 'skipped' }); assert.equal(withheld.status, 0, withheld.stderr);
  assert.deepEqual(withheld.selection, { qualified: ['mcp-browser'], withheld: ['web'], notSelected: [], notQualified: {} });
  const failedWeb = archiveSelection({ web: 'failure' }); assert.equal(failedWeb.status, 0, failedWeb.stderr);
  assert.deepEqual(failedWeb.selection?.notQualified, { web: 'failure' });
  const cancelledMcp = archiveSelection({ mcp: 'cancelled' }); assert.equal(cancelledMcp.status, 0, cancelledMcp.stderr);
  assert.deepEqual(cancelledMcp.selection?.qualified, ['web']); assert.deepEqual(cancelledMcp.selection?.notQualified, { 'mcp-browser': 'cancelled' });
  const failedProbe = archiveSelection({ mcp: 'skipped', probe: 'failure' }); assert.equal(failedProbe.status, 0, failedProbe.stderr);
  assert.deepEqual(failedProbe.selection?.qualified, ['web']); assert.deepEqual(failedProbe.selection?.notSelected, []);
  assert.deepEqual(failedProbe.selection?.notQualified, { 'mcp-browser': 'skipped' });
});

test('archive selection refuses stale source, incomplete jobs, missing prerequisites and empty output', () => {
  const refusals: [string, Partial<Record<keyof typeof archiveNames, string>>, Parameters<typeof archiveSelection>[1]][] = [
    ['wrong source', {}, run => { run.head_sha = 'b'.repeat(40); }],
    ['unfinished run', {}, run => { run.status = 'in_progress'; }],
    ['wrong event', {}, run => { run.event = 'push'; }],
    ['wrong workflow', {}, run => { run.path = '.github/workflows/ci.yml'; }],
    ['wrong run', {}, run => { run.id = 124; }],
    ['missing attempt', {}, run => { delete run.run_attempt; }],
    ['wrong attempt type', {}, run => { run.run_attempt = '2'; }],
    ['invalid attempt', {}, run => { run.run_attempt = 0; }],
    ['partial inventory', {}, (_run, inventory) => { inventory.total_count++; }],
    ['duplicate job', {}, (_run, inventory) => { inventory.jobs.push({ ...inventory.jobs[0] }); inventory.total_count++; }],
    ['duplicate job ID', {}, (_run, inventory) => { inventory.jobs[1]!.id = inventory.jobs[0]!.id; }],
    ['missing job', {}, (_run, inventory) => { inventory.jobs.pop(); inventory.total_count--; }],
    ['unfinished job', {}, (_run, inventory) => { inventory.jobs[0]!.status = 'in_progress'; }],
    ['cross-attempt job', {}, (_run, inventory) => { inventory.jobs[0]!.run_attempt = 1; }],
    ['cross-run job', {}, (_run, inventory) => { inventory.jobs[0]!.run_id = 124; }],
    ['failed chart', { chart: 'failure' }, undefined], ['failed route', { route: 'failure' }, undefined],
    ['unqualified main CI source', { source: 'skipped' }, undefined],
    ['web without gate', { gate: 'skipped' }, undefined], ['MCP without probe', { probe: 'skipped' }, undefined],
    ['neither selected', { web: 'skipped', gate: 'skipped', mcp: 'skipped', probe: 'skipped' }, undefined],
    ['web withheld and MCP failed', { web: 'skipped', mcp: 'failure' }, undefined],
  ];
  for (const [name, outcomes, alter] of refusals) { const result = archiveSelection(outcomes, alter); assert.notEqual(result.status, 0, name); assert.equal(result.selection, null, name); }
});

test('archive receipt admission refuses missing and cross-attempt release identities before registry operations', () => {
  const job = workflowJob(read('.github/workflows/deployment-suse.yml'), 'archive-qualified-images');
  const programs = [...job.matchAll(/node --input-type=module <<'JS'\n([\s\S]*?)\n\s+JS/g)];
  assert.equal(programs.length, 2);
  // Execute the unchanged admission prefix before registry and OCI export operations.
  const prefix = programs[1]![1]!.split('const evidence=')[0]!;
  assert.match(prefix, /release\.runAttempt!==qualification\.attempt/);
  const script = `${prefix}\nconsole.log(JSON.stringify({attempt:qualification.attempt,qualified:Object.keys(releases)}));`;
  const directory = mkdtempSync(join(tmpdir(), 'lolly-archive-attempt-'));
  try {
    const cases: [string, (binding: Record<string, unknown>, release: Record<string, unknown>) => void, boolean][] = [
      ['matched', () => {}, true], ['old attempt', (_binding, release) => { release.runAttempt = 1; }, false],
      ['missing attempt', (_binding, release) => { delete release.runAttempt; }, false],
      ['string attempt', (_binding, release) => { release.runAttempt = '2'; }, false],
      ['wrong run', (_binding, release) => { release.runId = '124'; }, false],
      ['wrong source', (_binding, release) => { release.source = 'b'.repeat(40); }, false],
      ['non-neutral', (_binding, release) => { release.neutralProfile = false; }, false],
      ['missing initial attempt', binding => { delete binding.attempt; }, false],
      ['invalid initial attempt', binding => { binding.attempt = 0; }, false],
    ];
    for (const [name, alter, accepted] of cases) {
      const root = mkdtempSync(join(directory, 'case-')); const binding = { runId: '123', source: archiveSource, attempt: 2 };
      writeFileSync(join(root, 'image-selection.json'), JSON.stringify({ qualified: ['web', 'mcp-browser'] }));
      for (const service of ['web', 'mcp-browser']) {
        const release = { source: archiveSource, runId: '123', runAttempt: 2, neutralProfile: true };
        if (service === 'mcp-browser') alter(binding, release);
        const receipts = join(root, 'receipts', service); mkdirSync(receipts, { recursive: true });
        writeFileSync(join(receipts, 'release.json'), JSON.stringify(release));
      }
      writeFileSync(join(root, 'qualification-run.json'), JSON.stringify(binding));
      const result: SpawnSyncReturns<string> = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, RUNNER_TEMP: root, SOURCE_SHA: archiveSource, QUALIFICATION_RUN: '123' }, encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status === 0, accepted, `${name}: ${result.stderr}`);
      if (accepted) assert.deepEqual(JSON.parse(result.stdout), { attempt: 2, qualified: ['web', 'mcp-browser'] });
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('candidate receipt writers and the unsigned MCP probe bind a positive exact attempt', () => {
  const workflow = read('.github/workflows/deployment-suse.yml');
  const directory = mkdtempSync(join(tmpdir(), 'lolly-candidate-attempt-'));
  try {
    for (const [id, service] of [['web-image', 'web'], ['mcp-browser-image', 'mcp-browser']]) {
      const job = workflowJob(workflow, id!); const publish = job.slice(job.indexOf('- name: Publish only the qualified'));
      const script = publish.match(/node --input-type=module -e '\n([\s\S]*?)\n\s+'/)?.[1]; assert.ok(script);
      for (const attempt of ['2', '', '0', '1.5']) {
        const root = mkdtempSync(join(directory, 'case-')); const receipts = join(root, 'lolly-image-receipts'); mkdirSync(receipts);
        writeFileSync(join(receipts, `${service}.json`), JSON.stringify({ Id: `sha256:${'a'.repeat(64)}`, Config: { Labels: { 'org.opencontainers.image.revision': archiveSource } }, Os: 'linux', Architecture: 'amd64', RepoDigests: [`ghcr.io/owner/lolly-${service}@sha256:${'b'.repeat(64)}`] }));
        const result: SpawnSyncReturns<string> = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, RUNNER_TEMP: root, EXPECTED_SOURCE: archiveSource, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: attempt }, encoding: 'utf8', timeout: 5000 });
        assert.equal(result.status === 0, attempt === '2', result.stderr);
        if (attempt === '2') assert.equal(JSON.parse(readFileSync(join(receipts, 'release.json'), 'utf8')).runAttempt, 2);
      }
    }
    const browser = workflowJob(workflow, 'mcp-browser-image'); const unpack = browser.slice(browser.indexOf('- name: Unpack the probe web shell'), browser.indexOf('- name: Require restricted native sandbox'));
    const script = unpack.match(/node --input-type=module -e '\n([\s\S]*?)\n\s+'/)?.[1]; assert.ok(script);
    for (const attempt of [2, 1, '2', null]) {
      const root = mkdtempSync(join(directory, 'probe-')); const artifact = join(root, 'lolly-probe-web-artifact'); mkdirSync(artifact);
      writeFileSync(join(artifact, 'source.json'), JSON.stringify({ source: archiveSource, runId: '123', runAttempt: attempt, release: false }));
      const result: SpawnSyncReturns<string> = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, RUNNER_TEMP: root, EXPECTED_SOURCE: archiveSource, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' }, encoding: 'utf8', timeout: 5000 });
      assert.equal(result.status === 0, attempt === 2, result.stderr);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Compose browser overlay requires a verified seccomp file and preserves isolation', () => {
  const overlay = read('deploy/docker/public-browser.compose.yml');
  assert.match(overlay, /seccomp=\$\{LOLLY_PUBLIC_BROWSER_SECCOMP_FILE:\?Set the verified/);
  assert.doesNotMatch(overlay, /no-new-privileges/);
  assert.match(compose, /no-new-privileges:true/);
  assert.doesNotMatch(overlay, /unconfined|privileged:|cap_add|no-sandbox/);
  assert.doesNotMatch(compose, /seccomp=/);
  const probe = read('deploy/docker/public-image-probe.ts');
  assert.match(probe, /page.goto\('chrome:\/\/sandbox'\)/);
  assert.match(probe, /Layer 1 Sandbox/);
  assert.match(probe, /Seccomp-BPF sandbox supports TSYNC/);
  assert.match(probe, /for \(const format of \['svg', 'png', 'pdf'\]\)/);
});
