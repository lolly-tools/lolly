// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { legacyDeploymentError, normalizedDeploymentDomain, vercelDeploymentError } from '../scripts/lib/deployment-policy.ts';
import { type ShipTarget, shipProfiles, shipTargetError, shipTargets } from '../scripts/lib/ship-targets.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OTHER_PROJECT = 'prj_independentModelHost';
const OTHER_TEAM = 'team_independentOrganisation';
const RETIRED_PROJECTS = [
  'prj_13zlzrOV2VHeK0CGUCyHGx4cPLu7',
  'prj_v86NfwZ1ls7v4SvSQFPJxUQZYRMW',
  'prj_35faMWKpIv5tWrDGSLwkzY7MFhIG',
];
const MANAGED_DOMAINS = [
  'lolly.tools', 'lolly.ing', 'lolly.work', 'lolly.art', 'lolly.free', 'lolly.to', 'lolly.sh', 'vml.ai',
];
const otherTarget: ShipTarget = {
  name: 'other', project: OTHER_PROJECT, profile: 'lolly-start', domain: 'models.example.org', driver: 'vercel',
};

function environment(bin: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`, LOLLY_ROOT: ROOT };
  for (const name of ['LOLLY_MODELS_VERCEL', 'LOLLY_MODELS_DOMAIN', 'VERCEL_PROJECT_ID', 'VERCEL_ORG_ID']) delete env[name];
  return env;
}

test('managed targets retain catalog coverage without a Vercel production identity', () => {
  assert.deepEqual(shipProfiles(), ['lolly-demo']);
  assert.equal(shipTargets()[0]?.driver, 'k3s');
  assert.equal(shipTargets()[0]?.project, 'lolly-public');
  assert.match(shipTargetError(shipTargets()[0]!, '') ?? '', /operator-managed K3s/);
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(config.git.deploymentEnabled, false);
});

test('reserved domains and old project IDs cannot use either legacy ship driver', () => {
  for (const driver of ['vercel', 'internal_it']) {
    for (const domain of MANAGED_DOMAINS) {
      for (const alias of [domain, `WWW.${domain.toUpperCase()}.`, `assets.${domain}`, ` ${domain}. `]) {
        assert.match(shipTargetError({ ...otherTarget, driver, domain: alias }, OTHER_TEAM) ?? '', /UpCloud/);
      }
    }
    for (const project of RETIRED_PROJECTS) {
      for (const alias of [project, ` ${project.toUpperCase()} `]) {
        assert.match(shipTargetError({ ...otherTarget, driver, project: alias }, OTHER_TEAM) ?? '', /retired/);
      }
    }
  }
});

test('explicit independent targets remain available and implicit drivers fail closed', () => {
  assert.equal(shipTargetError(otherTarget, OTHER_TEAM), null);
  assert.equal(shipTargetError({ ...otherTarget, driver: 'internal_it', project: 'independent-releases' }, ''), null);
  assert.match(shipTargetError({ ...otherTarget, driver: '' }, OTHER_TEAM) ?? '', /explicit supported/);
  assert.match(shipTargetError({ ...otherTarget, driver: undefined as unknown as string }, OTHER_TEAM) ?? '', /explicit supported/);
  assert.match(shipTargetError({ ...otherTarget, driver: 'unsupported' }, OTHER_TEAM) ?? '', /explicit supported/);
  assert.match(shipTargetError(otherTarget, '') ?? '', /team ID/);
  assert.match(shipTargetError({ ...otherTarget, project: '' }, OTHER_TEAM) ?? '', /project ID/);
  // The separate lolli.li model host is not part of this team's retirement inventory.
  assert.equal(vercelDeploymentError({ domain: 'lolli.li', project: OTHER_PROJECT }, OTHER_TEAM), null);
});

test('target hostnames reject URL, port, path and malformed aliases', () => {
  assert.equal(normalizedDeploymentDomain(' WWW.LOLLY.TOOLS. '), 'www.lolly.tools');
  for (const domain of ['https://lolly.tools', 'lolly.tools:443', 'lolly.tools/path', 'lolly.tools..', 'lolly .tools', 'localhost', '']) {
    assert.equal(normalizedDeploymentDomain(domain), null, domain);
    assert.notEqual(legacyDeploymentError({ domain, project: OTHER_PROJECT }), null, domain);
  }
});

test('every real ship mode refuses before invoking gate or deployment commands', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-retirement-ship-'));
  try {
    const bin = join(dir, 'bin');
    const trace = join(dir, 'commands');
    mkdirSync(bin);
    for (const name of ['pnpm', 'npx', 'rsync', 'ssh', 'curl']) {
      writeFileSync(join(bin, name), '#!/bin/sh\nprintf invoked >> "$COMMAND_TRACE"\nexit 97\n', { mode: 0o700 });
    }
    for (const args of [[], ['--preview'], ['--prod'], ['--production'], ['--no-gate'], ['--prod', '--no-gate'], ['--preview', '--no-gate'], ['--preview', '--prod', '--no-gate']]) {
      const result = spawnSync(process.execPath, [join(ROOT, 'scripts/ship.ts'), ...args], {
        cwd: ROOT, env: { ...environment(bin), COMMAND_TRACE: trace }, encoding: 'utf8', timeout: 10_000,
      });
      assert.equal(result.status, 1, `${args.join(' ')}: ${result.stderr}`);
      assert.match(result.stderr, /operator-managed K3s/);
      assert.equal(existsSync(trace), false, `commands ran for ${args.join(' ')}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('model adapter rejects incomplete or retired opt-ins before touching its assembly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-retirement-models-'));
  try {
    const host = join(dir, 'deploy/models-host');
    const bin = join(dir, 'bin');
    const trace = join(dir, 'commands');
    mkdirSync(join(host, 'models'), { recursive: true });
    mkdirSync(join(dir, 'scripts/lib'), { recursive: true });
    mkdirSync(join(dir, 'shells/web/public/models'), { recursive: true });
    mkdirSync(bin);
    writeFileSync(join(host, 'models/keep.bin'), 'keep');
    writeFileSync(join(dir, 'shells/web/public/models/sample.bin'), 'model');
    copyFileSync(join(ROOT, 'deploy/models-host/deploy.sh'), join(host, 'deploy.sh'));
    copyFileSync(join(ROOT, 'scripts/lib/deployment-policy.ts'), join(dir, 'scripts/lib/deployment-policy.ts'));
    const symlinkMode = spawnSync(process.execPath, [
      '--preserve-symlinks-main', join(dir, 'scripts/lib/deployment-policy.ts'),
      'WWW.LOLLY.TOOLS.', OTHER_PROJECT, OTHER_TEAM,
    ], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(symlinkMode.status, 1, symlinkMode.stderr);
    assert.match(symlinkMode.stderr, /UpCloud/);
    writeFileSync(join(bin, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$VERCEL_PROJECT_ID" "$VERCEL_ORG_ID" "$*" > "$COMMAND_TRACE"\n', { mode: 0o700 });
    const explicit = {
      LOLLY_MODELS_VERCEL: '1', LOLLY_MODELS_DOMAIN: otherTarget.domain,
      VERCEL_PROJECT_ID: OTHER_PROJECT, VERCEL_ORG_ID: OTHER_TEAM,
    };
    const invalid: NodeJS.ProcessEnv[] = [{}, { ...explicit, LOLLY_MODELS_VERCEL: '' }];
    for (const key of Object.keys(explicit)) invalid.push({ ...explicit, [key]: '' });
    for (const project of RETIRED_PROJECTS) invalid.push({ ...explicit, VERCEL_PROJECT_ID: ` ${project.toUpperCase()} ` });
    for (const domain of MANAGED_DOMAINS) invalid.push({ ...explicit, LOLLY_MODELS_DOMAIN: `WWW.${domain.toUpperCase()}.` });
    for (const settings of invalid) {
      const result = spawnSync('bash', [join(host, 'deploy.sh')], {
        cwd: dir, env: { ...environment(bin), ...settings, COMMAND_TRACE: trace }, encoding: 'utf8', timeout: 10_000,
      });
      assert.equal(result.status, 1, `${JSON.stringify(settings)}: ${result.stderr}`);
      assert.equal(readFileSync(join(host, 'models/keep.bin'), 'utf8'), 'keep');
      assert.equal(existsSync(trace), false);
    }
    const result = spawnSync('bash', [join(host, 'deploy.sh')], {
      cwd: dir, env: { ...environment(bin), ...explicit, COMMAND_TRACE: trace }, encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(host, 'models/keep.bin')), false);
    assert.equal(readFileSync(join(host, 'models/sample.bin'), 'utf8'), 'model');
    assert.equal(statSync(join(host, 'models/sample.bin')).ino, statSync(join(dir, 'shells/web/public/models/sample.bin')).ino);
    assert.equal(readFileSync(trace, 'utf8'), `${OTHER_PROJECT}\n${OTHER_TEAM}\nvercel deploy --prod --archive=tgz --yes\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// One job's block from a workflow file: from `  <id>:` to the next top-level job.
function workflowJob(workflow: string, id: string): string {
  const start = workflow.indexOf(`\n  ${id}:\n`);
  assert.ok(start >= 0, `no ${id} job`);
  const rest = workflow.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}(?:#|[a-z0-9-]+:\n)/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('every lolly.tools build uses the ship target profile, and the packaged apps keep lolly-start', () => {
  const profile = shipTargets().find(target => target.name === 'lolly-public')?.profile;
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
  assert.equal(profile, 'lolly-demo');
  const workflow = read('.github/workflows/deployment-suse.yml');
  assert.match(workflowJob(workflow, 'web-frontend'), new RegExp(`^ +profile: ${profile}$`, 'm'));
  for (const job of ['web-image', 'mcp-image', 'mcp-browser-image']) {
    assert.match(workflowJob(workflow, job), new RegExp(`--build-arg LOLLY_PROFILE=${profile} `));
  }
  for (const job of ['web-image', 'service-images', 'mcp-image', 'mcp-browser-image']) {
    assert.match(workflowJob(workflow, job), new RegExp(`--label org\\.lolly\\.profile=${profile} `));
  }
  for (const job of ['probe-web-shell', 'info-docs']) {
    assert.match(workflowJob(workflow, job), new RegExp(`^ +LOLLY_PROFILE: ${profile}$`, 'm'));
  }
  for (const job of ['web-frontend', 'web-image', 'probe-web-shell', 'service-images', 'mcp-image', 'mcp-browser-image', 'info-docs']) {
    assert.doesNotMatch(workflowJob(workflow, job), /lolly-start/, `${job} still builds with lolly-start`);
  }
  // The whole file, not only the jobs listed above: a receipt check that dropped its
  // LOLLY_PROFILE would fall back to lolly-start at dispatch, so every profile
  // the file sets must be the ship profile and lolly-start must not appear at all.
  assert.doesNotMatch(workflow, /lolly-start/);
  const profiles = [...workflow.matchAll(/LOLLY_PROFILE[=:] ?([a-z0-9-]+)|org\.lolly\.profile=([a-z0-9-]+)|^ +profile: ([a-z0-9-]+)$/gm)]
    .map(m => m[1] ?? m[2] ?? m[3]);
  assert.ok(profiles.length >= 10, `expected every lolly.tools job to set a profile, found ${profiles.length}`);
  assert.deepEqual([...new Set(profiles)], [profile]);
  const reusable = read('.github/workflows/release-frontend.yml');
  assert.match(reusable, /^ {6}profile:\n {8}required: false\n {8}type: string\n {8}default: lolly-start$/m);
  assert.match(reusable, /^ {2}LOLLY_PROFILE: \$\{\{ inputs\.profile \}\}$/m);
  assert.equal(reusable.match(/brands\/\$\{\{ inputs\.profile \}\}\/catalog\/tools/g)?.length, 2);
  assert.doesNotMatch(reusable, /brands\/lolly-start\//);
  // The packaged apps call the same workflow and must keep its lolly-start default.
  for (const app of ['desktop-extra', 'linux-rpm', 'flatpak', 'ios-release', 'linux-arm64', 'macos-intel']) {
    const caller = read(`.github/workflows/${app}.yml`);
    assert.match(caller, /uses: \.\/\.github\/workflows\/release-frontend\.yml/, `${app} no longer calls release-frontend.yml`);
    assert.doesNotMatch(caller, /^ +profile: /m, `${app} must not pass a profile`);
  }
  // The web build's origin guard: the ship profile canonicalises to the target's domain.
  const target = shipTargets().find(t => t.name === 'lolly-public');
  const vite = readFileSync(join(ROOT, 'shells/web/vite.config.js'), 'latin1');
  const canon = vite.match(/const CANON_BY_PROFILE = \{([^}]*)\}/)?.[1] ?? '';
  assert.match(canon, new RegExp(`'${profile}': '${target?.domain?.replace(/\./g, '\\.')}'`), 'the shipped profile keeps the canonical-origin guard');
});
