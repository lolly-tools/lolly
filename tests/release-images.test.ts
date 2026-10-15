// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  IMAGES, JOBS, admitImage, admitReceipts, admitRun, declaredVersion, imagesManifest, keyThumbprint, parseRequest, provenance,
  qualifiedArtifacts, type ImageName, type ReceiptReader, type ReleaseRequest,
} from '../scripts/release-images.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const repository = 'lolly-tools/lolly';
const source = 'a'.repeat(40);
const env = { RELEASE_VERSION: '1.1.1', QUALIFICATION_RUN: '123', EXPECTED_SOURCE: source, GITHUB_REPOSITORY: repository, RELEASE_IMAGES: 'web mcp mcp-browser ca penpot' };
const request = parseRequest(env);
const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pin = (() => { const { kty, crv, x, y } = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' }); return { kty, crv, x, y }; })();
const pinText = JSON.stringify(pin);

function qualificationRun(alter?: (run: Record<string, unknown>) => void) {
  const run: Record<string, unknown> = {
    id: 123, path: '.github/workflows/deployment-suse.yml', event: 'workflow_dispatch', head_branch: 'main', head_sha: source,
    repository: { full_name: repository }, head_repository: { full_name: repository }, status: 'completed', conclusion: 'success',
    run_attempt: 2, run_started_at: '2026-10-15T10:00:00Z', updated_at: '2026-10-15T11:00:00Z',
  };
  alter?.(run);
  return run;
}
function inventory(outcomes: Partial<Record<keyof typeof JOBS, string | null>> = {}) {
  const jobs = Object.entries(JOBS).filter(([key]) => outcomes[key as keyof typeof JOBS] !== null).map(([key, name], index) => ({
    id: index + 1, run_id: 123, run_attempt: 2, name, status: 'completed', conclusion: outcomes[key as keyof typeof JOBS] ?? 'success',
  }));
  return { total_count: jobs.length, jobs: jobs as Record<string, unknown>[] };
}

/** One image as the candidate job pushed it: config, manifest and its digest. */
function registryImage(image: ImageName, labels: Record<string, string> = {}) {
  const config = Buffer.from(JSON.stringify({ os: 'linux', architecture: 'amd64', config: { Labels: {
    'org.opencontainers.image.revision': source, 'org.opencontainers.image.source': `https://github.com/${repository}`,
    'org.opencontainers.image.title': `lolly-${image}`, 'org.opencontainers.image.version': '1.1.1',
    'org.opencontainers.image.created': '2026-10-15T09:00:00Z', 'org.lolly.profile': 'lolly-start', ...labels,
  } } }));
  const manifest = Buffer.from(JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
    config: { mediaType: 'application/vnd.docker.container.image.v1+json', size: config.length, digest: `sha256:${sha256(config)}` }, layers: [] }));
  return { config, manifest, digest: `sha256:${sha256(manifest)}`, imageId: `sha256:${sha256(config)}` };
}
const registry = Object.fromEntries(IMAGES.map(image => [image, registryImage(image)])) as Record<ImageName, ReturnType<typeof registryImage>>;

/** Receipt artifacts exactly as the candidate jobs write them, keyed by artifact then file. */
function receipts(alter?: (files: Record<string, Record<string, unknown>>) => void): Record<string, Record<string, string>> {
  const entry = (image: ImageName) => ({ imageId: registry[image].imageId, digest: `ghcr.io/lolly-tools/lolly-${image}@${registry[image].digest}`, platform: 'linux/amd64', source });
  const release = (images: ImageName[]) => ({ source, runId: '123', runAttempt: 2, neutralProfile: true, images: Object.fromEntries(images.map(image => [image, entry(image)])), candidateRuntimeQualified: false });
  const files: Record<string, Record<string, unknown>> = {
    'public-candidate-web-receipts-attempt-2': {
      'release.json': release(['web']), 'web.json': entry('web'), 'web-boot.json': { serviceBootPassed: true, results: { web: 200 } },
      'public.jwk.json': pin, 'catalog.json': { verified: true, files: 3, tools: 1, indexSha256: 'b'.repeat(64), keyId: keyThumbprint(pin) },
    },
    'public-candidate-mcp-receipts-attempt-2': {
      'release.json': release(['mcp']), 'mcp.json': entry('mcp'),
      'mcp-boot.json': { serviceBootPassed: true, results: { readyz: 200, healthz: 200, oauthMetadata: 200, missingAuthRefused: 401, unavailableAdmissionRefused: 503, badOriginRefused: 403 } },
      'mcp-render.json': { browserFreeRenderPassed: true, renders: {}, browserFormatRefused: 'pdf' },
    },
    'public-candidate-mcp-browser-receipts-attempt-2': {
      'release.json': release(['mcp-browser']), 'mcp-browser.json': entry('mcp-browser'),
      'native-probe.json': { nativeImageProbePassed: true, chromiumSandbox: true, candidateRuntimeQualified: false },
    },
    'public-candidate-service-receipts-attempt-2': {
      'release.json': release(['ca', 'penpot']), 'ca.json': entry('ca'), 'penpot.json': entry('penpot'),
      'service-boot.json': { serviceBootPassed: true, results: { unconfiguredCA: 404, penpot: 200 }, actualCAEnrollmentQualified: false },
    },
  };
  alter?.(files);
  const text = Object.fromEntries(Object.entries(files).map(([artifact, contents]) => [artifact, Object.fromEntries(Object.entries(contents).map(([name, value]) => [name, JSON.stringify(value, null, 2)]))]));
  // The browser probe's receipt begins with the engine's logged catalog line.
  const probe = text['public-candidate-mcp-browser-receipts-attempt-2']!;
  probe['native-probe.json'] = 'catalog integrity: unsigned catalog (tool code is not signature-verified)\n' + probe['native-probe.json'];
  return text;
}
const reader = (files: Record<string, Record<string, string>>): ReceiptReader => (artifact, file) => files[artifact]?.[file];
const plans = () => admitReceipts(request, 2, reader(receipts()), pinText);

test('release requests name an exact version, run, source and known images', () => {
  assert.deepEqual(request, { version: '1.1.1', run: '123', source, repository, owner: 'lolly-tools', images: ['web', 'mcp', 'mcp-browser', 'ca', 'penpot'] });
  assert.deepEqual(parseRequest({ ...env, RELEASE_IMAGES: 'penpot,ca  web', GITHUB_REPOSITORY: 'Lolly-Tools/lolly' }).images, ['web', 'ca', 'penpot']);
  assert.equal(parseRequest({ ...env, GITHUB_REPOSITORY: 'Lolly-Tools/lolly' }).owner, 'lolly-tools');
  assert.equal(parseRequest({ ...env, RELEASE_VERSION: '1.2.0-rc.1' }).version, '1.2.0-rc.1');
  const refusals: [string, Record<string, string>][] = [
    ['v prefix', { RELEASE_VERSION: 'v1.1.1' }], ['partial version', { RELEASE_VERSION: '1.1' }], ['leading zero', { RELEASE_VERSION: '01.1.1' }],
    ['latest', { RELEASE_VERSION: 'latest' }], ['build metadata', { RELEASE_VERSION: '1.1.1+abc' }], ['empty version', { RELEASE_VERSION: '' }],
    ['run name', { QUALIFICATION_RUN: 'latest' }], ['zero run', { QUALIFICATION_RUN: '0' }], ['short source', { EXPECTED_SOURCE: 'abc123' }],
    ['upper-case source', { EXPECTED_SOURCE: 'A'.repeat(40) }], ['no images', { RELEASE_IMAGES: ' ' }], ['unknown image', { RELEASE_IMAGES: 'web lolly-work-server' }],
    ['duplicate image', { RELEASE_IMAGES: 'web web' }], ['bad repository', { GITHUB_REPOSITORY: 'lolly' }],
  ];
  for (const [name, change] of refusals) assert.throws(() => parseRequest({ ...env, ...change }), Error, name);
});

test('the release version must be the product version the source declares in every place', () => {
  const tauri = JSON.stringify({ version: '1.1.1' });
  const chart = 'apiVersion: v2\nversion: 0.2.1\nappVersion: "1.1.1"\n';
  assert.equal(declaredVersion({ tauri, chart, sovereign: chart }), '1.1.1');
  assert.throws(() => declaredVersion({ tauri, chart: chart.replace('1.1.1', '1.1.0'), sovereign: chart }), /Helm chart appVersion/);
  assert.throws(() => declaredVersion({ tauri, chart, sovereign: chart.replace('1.1.1', '1.1.0') }), /sovereign chart/);
  assert.throws(() => declaredVersion({ tauri: '{}', chart, sovereign: chart }), /no product version/);
  // The checked-in source agrees with itself today.
  const version = declaredVersion({ tauri: read('shells/tauri-desktop/src-tauri/tauri.conf.json'), chart: read('deploy/helm/Chart.yaml'), sovereign: read('deploy/helm/profiles/sovereign/Chart.yaml') });
  assert.match(version, /^\d+\.\d+\.\d+/);
});

test('only a completed main dispatch of the candidate workflow for this source can qualify', () => {
  assert.deepEqual(admitRun(qualificationRun(), request), { attempt: 2, startedOn: '2026-10-15T10:00:00Z', finishedOn: '2026-10-15T11:00:00Z' });
  const refusals: [string, (run: Record<string, unknown>) => void][] = [
    ['other run', run => { run.id = 124; }], ['string run', run => { run.id = '123'; }],
    ['other workflow', run => { run.path = '.github/workflows/ci.yml'; }], ['push event', run => { run.event = 'push'; }],
    ['other branch', run => { run.head_branch = 'feature'; }], ['other source', run => { run.head_sha = 'b'.repeat(40); }],
    ['fork', run => { run.head_repository = { full_name: 'fork/lolly' }; }], ['other repository', run => { run.repository = { full_name: 'fork/lolly' }; }],
    ['unfinished', run => { run.status = 'in_progress'; }], ['no attempt', run => { delete run.run_attempt; }], ['zero attempt', run => { run.run_attempt = 0; }],
    ['no times', run => { delete run.run_started_at; }],
  ];
  for (const [name, alter] of refusals) assert.throws(() => admitRun(qualificationRun(alter), request), Error, name);
});

test('each requested image needs its own passing jobs in the complete inventory of that attempt', () => {
  assert.deepEqual(qualifiedArtifacts(inventory(), request, 2), [
    'public-candidate-web-receipts-attempt-2', 'public-candidate-mcp-receipts-attempt-2',
    'public-candidate-mcp-browser-receipts-attempt-2', 'public-candidate-service-receipts-attempt-2',
  ]);
  // A services-only run withheld the web image and skipped its gate; the rest can still be promoted.
  const services = parseRequest({ ...env, RELEASE_IMAGES: 'mcp mcp-browser ca penpot' });
  assert.equal(qualifiedArtifacts(inventory({ gate: 'skipped', web: 'skipped' }), services, 2).length, 3);
  const refusals: [string, ReturnType<typeof inventory>, ReleaseRequest?][] = [
    ['withheld web', inventory({ web: 'skipped' })], ['web without gate', inventory({ gate: 'skipped' })],
    ['failed MCP', inventory({ mcp: 'failure' })], ['run before the MCP job', inventory({ mcp: null })],
    ['browser without probe', inventory({ probe: 'failure' })], ['cancelled browser', inventory({ browser: 'cancelled' })],
    ['skipped services', inventory({ services: 'skipped' })], ['failed chart', inventory({ chart: 'failure' })],
    ['failed route', inventory({ route: 'failure' })], ['unqualified main CI', inventory({ source: 'skipped' })],
    ['missing prerequisite', inventory({ source: null })],
  ];
  for (const [name, jobs, wanted] of refusals) assert.throws(() => qualifiedArtifacts(jobs, wanted ?? request, 2), Error, name);
  const tampered: [string, (jobs: ReturnType<typeof inventory>) => void][] = [
    ['partial inventory', jobs => { jobs.total_count++; }], ['empty', jobs => { jobs.jobs = []; jobs.total_count = 0; }],
    ['duplicate ID', jobs => { jobs.jobs[1]!.id = jobs.jobs[0]!.id; }], ['duplicate name', jobs => { jobs.jobs.push({ ...jobs.jobs[3], id: 99 }); jobs.total_count++; }],
    ['other run', jobs => { jobs.jobs[0]!.run_id = 124; }], ['other attempt', jobs => { jobs.jobs[0]!.run_attempt = 1; }],
    ['unfinished', jobs => { jobs.jobs[0]!.status = 'in_progress'; }],
  ];
  for (const [name, alter] of tampered) { const jobs = inventory(); alter(jobs); assert.throws(() => qualifiedArtifacts(jobs, request, 2), Error, name); }
});

test('receipts bind each digest to this source, run, attempt, neutral profile and its qualification evidence', () => {
  const admitted = plans();
  assert.deepEqual(admitted.map(plan => [plan.image, plan.repository, plan.digest]), IMAGES.map(image => [image, `ghcr.io/lolly-tools/lolly-${image}`, registry[image].digest]));
  assert.equal(admitted.find(plan => plan.image === 'web')!.evidence.length, 5);
  assert.ok(admitted.every(plan => plan.evidence.every(item => /^public-candidate-[a-z-]+-attempt-2\/[a-z.-]+\.json$/.test(item.name) && /^[a-f0-9]{64}$/.test(item.sha256))));
  const refusals: [string, (files: Record<string, Record<string, unknown>>) => void][] = [
    ['other source', files => { (files['public-candidate-web-receipts-attempt-2']!['release.json'] as Record<string, unknown>).source = 'b'.repeat(40); }],
    ['other run', files => { (files['public-candidate-mcp-receipts-attempt-2']!['release.json'] as Record<string, unknown>).runId = '124'; }],
    ['other attempt', files => { (files['public-candidate-service-receipts-attempt-2']!['release.json'] as Record<string, unknown>).runAttempt = 1; }],
    ['string attempt', files => { (files['public-candidate-service-receipts-attempt-2']!['release.json'] as Record<string, unknown>).runAttempt = '2'; }],
    ['branded profile', files => { (files['public-candidate-web-receipts-attempt-2']!['release.json'] as Record<string, unknown>).neutralProfile = false; }],
    ['other registry', files => {
      const release = files['public-candidate-mcp-receipts-attempt-2']!['release.json'] as { images: { mcp: { digest: string } } };
      release.images.mcp.digest = release.images.mcp.digest.replace('ghcr.io/lolly-tools/', 'ghcr.io/someone/');
    }],
    ['other image repository', files => {
      const release = files['public-candidate-mcp-receipts-attempt-2']!['release.json'] as { images: { mcp: { digest: string } } };
      release.images.mcp.digest = release.images.mcp.digest.replace('lolly-mcp@', 'lolly-mcp-browser@');
    }],
    ['extra image', files => {
      const release = files['public-candidate-mcp-receipts-attempt-2']!['release.json'] as { images: Record<string, unknown> };
      release.images.web = release.images.mcp;
    }],
    ['arm64', files => { ((files['public-candidate-web-receipts-attempt-2']!['release.json'] as { images: { web: Record<string, unknown> } }).images.web).platform = 'linux/arm64'; }],
    ['image receipt differs', files => { (files['public-candidate-web-receipts-attempt-2']!['web.json'] as Record<string, unknown>).imageId = `sha256:${'c'.repeat(64)}`; }],
    ['web boot failed', files => { files['public-candidate-web-receipts-attempt-2']!['web-boot.json'] = { serviceBootPassed: false }; }],
    ['other pin', files => { files['public-candidate-web-receipts-attempt-2']!['public.jwk.json'] = { ...pin, x: 'other' }; }],
    ['private pin', files => { files['public-candidate-web-receipts-attempt-2']!['public.jwk.json'] = { ...pin, d: 'private' }; }],
    ['other catalog key', files => { (files['public-candidate-web-receipts-attempt-2']!['catalog.json'] as Record<string, unknown>).keyId = 'other'; }],
    ['unverified catalog', files => { (files['public-candidate-web-receipts-attempt-2']!['catalog.json'] as Record<string, unknown>).verified = false; }],
    ['MCP admission open', files => { (files['public-candidate-mcp-receipts-attempt-2']!['mcp-boot.json'] as { results: Record<string, number> }).results.unavailableAdmissionRefused = 200; }],
    ['MCP render missing', files => { delete files['public-candidate-mcp-receipts-attempt-2']!['mcp-render.json']; }],
    ['browser probe failed', files => { (files['public-candidate-mcp-browser-receipts-attempt-2']!['native-probe.json'] as Record<string, unknown>).nativeImageProbePassed = false; }],
    ['unsandboxed browser', files => { (files['public-candidate-mcp-browser-receipts-attempt-2']!['native-probe.json'] as Record<string, unknown>).chromiumSandbox = false; }],
    ['service boot failed', files => { (files['public-candidate-service-receipts-attempt-2']!['service-boot.json'] as Record<string, unknown>).serviceBootPassed = false; }],
    ['missing receipt', files => { delete files['public-candidate-service-receipts-attempt-2']!['release.json']; }],
  ];
  for (const [name, alter] of refusals) assert.throws(() => admitReceipts(request, 2, reader(receipts(alter)), pinText), Error, name);
  assert.throws(() => admitReceipts(request, 2, reader(receipts()), undefined), /public pin/);
  assert.throws(() => admitReceipts(request, 3, reader(receipts()), pinText), /no release\.json/);
  // Promoting only the services needs no web pin.
  assert.equal(admitReceipts(parseRequest({ ...env, RELEASE_IMAGES: 'ca penpot' }), 2, reader(receipts()), undefined).length, 2);
});

test('the registry copy must be the qualified single-platform image with release labels and an unused tag', () => {
  const plan = (image: ImageName) => plans().find(item => item.image === image)!;
  for (const image of IMAGES) admitImage(plan(image), request, registry[image].manifest, registry[image].config);
  admitImage(plan('web'), request, registry.web.manifest, registry.web.config, `${registry.web.digest}\n`);
  assert.throws(() => admitImage(plan('web'), request, registry.web.manifest, registry.web.config, registry.ca.digest), /never moves/);
  assert.throws(() => admitImage(plan('web'), request, registry.ca.manifest, registry.ca.config), /differs from the qualified digest/);
  const index = Buffer.from(JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: [] }));
  assert.throws(() => admitImage({ ...plan('web'), digest: `sha256:${sha256(index)}` }, request, index, registry.web.config), /single-platform/);
  assert.throws(() => admitImage(plan('web'), request, registry.web.manifest, registry.ca.config), /configuration differs/);
  const relabelled: [string, Record<string, string>][] = [
    ['SUSE profile', { 'org.lolly.profile': 'suse' }], ['other version', { 'org.opencontainers.image.version': '1.1.0' }],
    ['other title', { 'org.opencontainers.image.title': 'lolly-ca' }], ['other source', { 'org.opencontainers.image.revision': 'b'.repeat(40) }],
    ['other repository', { 'org.opencontainers.image.source': 'https://github.com/fork/lolly' }], ['no creation time', { 'org.opencontainers.image.created': '' }],
  ];
  for (const [name, labels] of relabelled) {
    const copy = registryImage('web', labels);
    const files = receipts(all => {
      const release = all['public-candidate-web-receipts-attempt-2']!['release.json'] as { images: { web: { digest: string; imageId: string } } };
      release.images.web.digest = `ghcr.io/lolly-tools/lolly-web@${copy.digest}`; release.images.web.imageId = copy.imageId;
      all['public-candidate-web-receipts-attempt-2']!['web.json'] = release.images.web;
    });
    const relabelledPlan = admitReceipts(parseRequest({ ...env, RELEASE_IMAGES: 'web' }), 2, reader(files), pinText)[0]!;
    assert.throws(() => admitImage(relabelledPlan, request, copy.manifest, copy.config), /label/, name);
  }
});

test('provenance and images.json name the qualification run, the source and this workflow identity', () => {
  const run = admitRun(qualificationRun(), request);
  const web = plans()[0]!;
  const predicate = provenance(web, request, run) as { buildDefinition: Record<string, any>; runDetails: Record<string, any> };
  assert.deepEqual(predicate.buildDefinition.externalParameters.workflow, { repository: 'https://github.com/lolly-tools/lolly', path: '.github/workflows/deployment-suse.yml', ref: 'refs/heads/main' });
  assert.equal(predicate.buildDefinition.externalParameters.dockerfile, 'deploy/docker/web.Dockerfile');
  assert.equal(predicate.buildDefinition.externalParameters.profile, 'lolly-start');
  assert.deepEqual(predicate.buildDefinition.resolvedDependencies, [{ uri: 'git+https://github.com/lolly-tools/lolly@refs/heads/main', digest: { gitCommit: source } }]);
  assert.equal(predicate.runDetails.metadata.invocationId, 'https://github.com/lolly-tools/lolly/actions/runs/123/attempts/2');
  assert.deepEqual(predicate.runDetails.byproducts.map((item: { name: string }) => item.name), web.evidence.map(item => item.name));
  assert.match(predicate.buildDefinition.buildType, /deploy\/docker\/README\.md#published-images$/);
  assert.match(read('deploy/docker/README.md'), /^## Published images$/m);
  const identity = 'https://github.com/lolly-tools/lolly/.github/workflows/release-images.yml@refs/heads/main';
  const files = Object.fromEntries(IMAGES.map(image => [image, { sbom: 'd'.repeat(64), provenance: 'e'.repeat(64) }]));
  const manifest = imagesManifest(request, run, plans(), { promotionRun: '456', promotionAttempt: 1, identity }, files) as { images: Record<string, unknown>[]; signing: unknown };
  assert.deepEqual(manifest.signing, { issuer: 'https://token.actions.githubusercontent.com', identity });
  assert.deepEqual(manifest.images[0], {
    name: 'web', repository: 'ghcr.io/lolly-tools/lolly-web', tag: '1.1.1', digest: registry.web.digest,
    reference: `ghcr.io/lolly-tools/lolly-web:1.1.1@${registry.web.digest}`, platform: 'linux/amd64',
    attestations: { sbom: { predicateType: 'https://spdx.dev/Document', sha256: 'd'.repeat(64) }, provenance: { predicateType: 'https://slsa.dev/provenance/v1', sha256: 'e'.repeat(64) } },
  });
  assert.throws(() => imagesManifest(request, run, plans(), { promotionRun: '456', promotionAttempt: 1, identity: identity.replace('refs/heads/main', 'refs/heads/feature') }, files), /signing identity/);
});

const workflowText = read('.github/workflows/release-images.yml');
const workflow = parseYaml(workflowText) as { on: Record<string, any>; permissions: Record<string, string>; concurrency: Record<string, unknown>; jobs: Record<string, any> };
const promote = workflow.jobs.promote as { if: string; permissions: Record<string, string>; env: Record<string, string>; steps: { name?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, string> }[] };
const step = (name: string) => { const found = promote.steps.find(item => item.name === name); assert.ok(found?.run, name); return found; };

test('only a reviewed main dispatch can promote, with no more than signing, package and run-reading rights', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs), ['qualification_run', 'expected_source', 'version', 'images']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['promote']);
  assert.equal(promote.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && github.repository == 'lolly-tools/lolly'");
  assert.deepEqual(promote.permissions, { contents: 'read', actions: 'read', packages: 'write', 'id-token': 'write' });
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.match(String(promote.steps[0]!.with!.ref), /^\$\{\{ github\.sha \}\}$/);
  assert.equal(promote.steps[0]!.with!['persist-credentials'], false);
  const cosign = promote.steps.find(item => item.uses?.startsWith('sigstore/cosign-installer@'));
  assert.equal(cosign?.uses, 'sigstore/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6');
  assert.match(workflowText, /sigstore\/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6 # v4\.1\.2/);
  assert.equal(cosign?.with?.['cosign-release'], 'v3.0.6');
  // Nothing here builds, pushes or rewrites an image; the tag reuses the manifest bytes.
  assert.doesNotMatch(workflowText, /docker (?:buildx )?build|docker push|imagetools create|--force|secrets\./);
  assert.match(step('Require a main source that declares this version').run!, /git merge-base --is-ancestor "\$EXPECTED_SOURCE" refs\/remotes\/origin\/main/);
  assert.match(step('Require a main source that declares this version').run!, /test "\$GITHUB_REF" = refs\/heads\/main/);
});

test('downloaded tools are checked against pinned digests before they are unpacked or run', () => {
  const install = step('Install the pinned registry and SBOM tools').run!;
  for (const tool of ['crane', 'syft']) {
    const check = install.indexOf(`echo "$${tool.toUpperCase()}_LINUX_X64_SHA256  $RUNNER_TEMP/${tool}.tar.gz" | sha256sum --check`);
    assert.ok(check > 0, tool);
    assert.ok(check < install.indexOf(`tar -xzf "$RUNNER_TEMP/${tool}.tar.gz"`), tool);
    assert.match(promote.env[`${tool.toUpperCase()}_LINUX_X64_SHA256`]!, /^[a-f0-9]{64}$/);
    assert.match(promote.env[`${tool.toUpperCase()}_VERSION`]!, /^\d+\.\d+\.\d+$/);
  }
  const sign = promote.steps.findIndex(item => item.name === 'Sign and attest each qualified digest');
  assert.ok(promote.steps.findIndex(item => item.name === 'Install the pinned registry and SBOM tools') < sign);
  assert.ok(sign < promote.steps.findIndex(item => item.name === 'Tag each signed digest with the release version'));
});

/**
 * Run the workflow's own steps in order inside a throwaway repository, with
 * recording stand-ins for gh, docker, crane, syft and cosign.
 */
function rehearse(options: { version?: string; offMain?: boolean; existingTag?: (digest: string) => string | undefined; images?: string } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-release-images-'));
  const repo = join(directory, 'repo'), bin = join(directory, 'bin'), fixtures = join(directory, 'fixtures'), runner = join(directory, 'runner');
  for (const path of [repo, bin, fixtures, runner]) mkdirSync(path, { recursive: true });
  const git = (...args: string[]) => {
    const result = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  };
  git('init', '-q');
  for (const path of ['scripts', 'shells/tauri-desktop/src-tauri', 'deploy/helm/profiles/sovereign']) mkdirSync(join(repo, path), { recursive: true });
  copyFileSync(new URL('../scripts/release-images.ts', import.meta.url), join(repo, 'scripts/release-images.ts'));
  writeFileSync(join(repo, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), JSON.stringify({ version: '1.1.1' }));
  for (const chart of ['deploy/helm/Chart.yaml', 'deploy/helm/profiles/sovereign/Chart.yaml']) writeFileSync(join(repo, chart), 'apiVersion: v2\nappVersion: "1.1.1"\n');
  git('add', '.'); git('commit', '-qm', 'release'); const head = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', head);
  let expected = head;
  if (options.offMain) { writeFileSync(join(repo, 'unreviewed'), 'x'); git('add', '.'); git('commit', '-qm', 'unreviewed'); expected = git('rev-parse', 'HEAD'); }
  // Fixtures keyed to the throwaway source.
  const images = registryFor(expected);
  writeFileSync(join(fixtures, 'run.json'), JSON.stringify(qualificationRun(run => { run.head_sha = expected; })));
  writeFileSync(join(fixtures, 'jobs.json'), JSON.stringify(inventory()));
  for (const [artifact, contents] of Object.entries(receiptsFor(expected, images))) {
    mkdirSync(join(fixtures, 'artifacts', artifact), { recursive: true });
    for (const [name, text] of Object.entries(contents)) writeFileSync(join(fixtures, 'artifacts', artifact, name), text);
  }
  for (const [image, copy] of Object.entries(images)) {
    mkdirSync(join(fixtures, 'registry', image), { recursive: true });
    writeFileSync(join(fixtures, 'registry', image, 'manifest.json'), copy.manifest);
    writeFileSync(join(fixtures, 'registry', image, 'config.json'), copy.config);
    const existing = options.existingTag?.(copy.digest);
    writeFileSync(join(fixtures, 'registry', image, 'tags'), `candidate-${expected}\n${existing ? `${options.version ?? '1.1.1'}\n` : ''}`);
    if (existing) writeFileSync(join(fixtures, 'registry', image, 'tag-digest'), existing);
  }
  const trace = join(directory, 'trace.jsonl');
  const record = `"$NODE_EXEC" -e 'require("node:fs").appendFileSync(process.env.TRACE, JSON.stringify([require("node:path").basename(process.argv[1]), ...process.argv.slice(2)]) + "\\n")' "$0" "$@"`;
  const tools: Record<string, string> = {
    docker: `${record}\ncat >/dev/null || true`,
    gh: `${record}
if [[ "$1" == api && "$2" == */attempts/2/jobs* ]]; then cat "$FIXTURES/jobs.json"
elif [[ "$1" == api ]]; then cat "$FIXTURES/run.json"
elif [[ "$1 $2" == "run download" ]]; then name=; dir=; while (($#)); do case "$1" in --name) name=$2; shift;; --dir) dir=$2; shift;; esac; shift; done; mkdir -p "$dir"; cp "$FIXTURES/artifacts/$name/"* "$dir/"
else exit 9; fi`,
    crane: `${record}
image() { [[ "$1" =~ lolly-([a-z-]+)[@:] ]] && printf '%s' "\${BASH_REMATCH[1]}"; }
case "$1" in
  manifest) cat "$FIXTURES/registry/$(image "$2")/manifest.json" ;;
  config) cat "$FIXTURES/registry/$(image "$2")/config.json" ;;
  ls) [[ "$2" =~ lolly-([a-z-]+)$ ]] && cat "$FIXTURES/registry/\${BASH_REMATCH[1]}/tags" ;;
  digest) cat "$FIXTURES/registry/$(image "$2")/tag-digest" ;;
  tag) printf '%s' "\${2#*@}" > "$FIXTURES/registry/$(image "$2")/tag-digest" ;;
  *) exit 9 ;;
esac`,
    syft: `${record}
for arg in "$@"; do case "$arg" in spdx-json=*) printf '%s' '{"spdxVersion":"SPDX-2.3","packages":[]}' > "\${arg#spdx-json=}" ;; esac; done`,
    cosign: `${record}
case "$1" in verify|verify-attestation) printf '[]\\n' ;; esac`,
  };
  for (const [name, body] of Object.entries(tools)) { writeFileSync(join(bin, name), `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`); chmodSync(join(bin, name), 0o755); }
  const stepEnv = {
    ...process.env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`, NODE_EXEC: process.execPath, TRACE: trace, FIXTURES: fixtures,
    RUNNER_TEMP: runner, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: repository, GITHUB_ACTOR: 'fixture', GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_WORKFLOW_REF: 'lolly-tools/lolly/.github/workflows/release-images.yml@refs/heads/main', GITHUB_RUN_ID: '456', GITHUB_RUN_ATTEMPT: '1',
    QUALIFICATION_RUN: '123', EXPECTED_SOURCE: expected, RELEASE_VERSION: options.version ?? '1.1.1', RELEASE_IMAGES: options.images ?? 'web mcp mcp-browser ca penpot',
    EXISTING_PUBLIC_KEY_JWK: pinText, REGISTRY_TOKEN: 'synthetic-not-a-token', COSIGN_YES: 'true',
  };
  const steps = ['Require a main source that declares this version', 'Recheck the qualification run, its jobs and its receipts',
    'Sign and attest each qualified digest', 'Tag each signed digest with the release version'];
  let failed: { step: string; result: SpawnSyncReturns<string> } | undefined;
  for (const name of steps) {
    const result = spawnSync('bash', ['-c', step(name).run!], { cwd: repo, env: stepEnv, encoding: 'utf8', timeout: 30_000 });
    if (result.status !== 0) { failed = { step: name, result }; break; }
  }
  const calls = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]) : [];
  const outputs = join(runner, 'release-images');
  const imagesJson = existsSync(join(outputs, 'images.json')) ? JSON.parse(readFileSync(join(outputs, 'images.json'), 'utf8')) : null;
  const provenanceFile = join(outputs, 'images', 'mcp', 'provenance.json');
  const mcpProvenance = existsSync(provenanceFile) ? JSON.parse(readFileSync(provenanceFile, 'utf8')) : null;
  rmSync(directory, { recursive: true, force: true });
  return { failed, calls, imagesJson, mcpProvenance, images, source: expected };
}
function registryFor(sourceSha: string) {
  return Object.fromEntries(IMAGES.map(image => {
    const copy = registryImage(image, { 'org.opencontainers.image.revision': sourceSha });
    return [image, copy];
  })) as Record<ImageName, ReturnType<typeof registryImage>>;
}
function receiptsFor(sourceSha: string, images: Record<ImageName, ReturnType<typeof registryImage>>) {
  const text = receipts(files => {
    for (const contents of Object.values(files)) {
      const release = contents['release.json'] as { source: string; images: Record<string, { digest: string; imageId: string; source: string }> };
      release.source = sourceSha;
      for (const [image, entry] of Object.entries(release.images)) {
        entry.source = sourceSha; entry.digest = `ghcr.io/lolly-tools/lolly-${image}@${images[image as ImageName].digest}`; entry.imageId = images[image as ImageName].imageId;
        contents[`${image}.json`] = entry;
      }
    }
  });
  return text;
}

test('a rehearsal of the workflow signs, attests and verifies every digest before it tags any', () => {
  const run = rehearse();
  assert.equal(run.failed, undefined, run.failed ? `${run.failed.step}: ${run.failed.result.stderr}` : '');
  const commands = run.calls.map(call => call.slice(0, 3).join(' '));
  const firstTag = commands.findIndex(command => command.startsWith('crane tag'));
  assert.ok(firstTag > 0);
  assert.ok(commands.slice(firstTag).every(command => !command.startsWith('cosign') && !command.startsWith('syft')), 'nothing is signed after tagging begins');
  for (const image of IMAGES) {
    const reference = `ghcr.io/lolly-tools/lolly-${image}@${run.images[image].digest}`;
    const order = ['crane manifest', 'crane config', 'syft scan', 'cosign sign', 'cosign attest', 'cosign verify', 'crane tag']
      .map(prefix => run.calls.findIndex(call => call.slice(0, 2).join(' ') === prefix && call.some(arg => arg === reference || arg === `registry:${reference}`)));
    assert.ok(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1]!)), `${image}: ${JSON.stringify(order)}`);
    assert.deepEqual(run.calls.filter(call => call[0] === 'cosign' && call.includes(reference)).map(call => call[1] === 'attest' || call[1] === 'verify-attestation' ? `${call[1]} ${call[call.indexOf('--type') + 1]}` : call[1]),
      ['sign', 'attest spdxjson', 'attest slsaprovenance1', 'verify', 'verify-attestation spdxjson', 'verify-attestation slsaprovenance1']);
    const tag = run.calls.find(call => call[0] === 'crane' && call[1] === 'tag' && call[2] === reference);
    assert.deepEqual(tag, ['crane', 'tag', reference, '1.1.1']);
  }
  for (const call of run.calls.filter(item => item[0] === 'cosign' && item[1]?.startsWith('verify'))) {
    assert.equal(call[call.indexOf('--certificate-identity') + 1], 'https://github.com/lolly-tools/lolly/.github/workflows/release-images.yml@refs/heads/main');
    assert.equal(call[call.indexOf('--certificate-oidc-issuer') + 1], 'https://token.actions.githubusercontent.com');
  }
  assert.ok(run.calls.some(call => call[0] === 'gh' && call[1] === 'run' && call.includes('public-candidate-mcp-receipts-attempt-2')));
  assert.equal(run.imagesJson.source, run.source);
  assert.deepEqual(run.imagesJson.images.map((image: { name: string; reference: string }) => [image.name, image.reference]),
    IMAGES.map(image => [image, `ghcr.io/lolly-tools/lolly-${image}:1.1.1@${run.images[image].digest}`]));
  assert.equal(run.mcpProvenance.buildDefinition.externalParameters.dockerfile, 'deploy/docker/mcp.Dockerfile');
  assert.equal(run.mcpProvenance.buildDefinition.resolvedDependencies[0].digest.gitCommit, run.source);
});

test('a rehearsal refuses another version, an unreviewed source and a moved release tag without tagging', () => {
  const version = rehearse({ version: '1.1.2' });
  assert.equal(version.failed?.step, 'Require a main source that declares this version');
  assert.match(version.failed!.result.stderr, /declares 1\.1\.1, not 1\.1\.2/);
  const offMain = rehearse({ offMain: true });
  assert.equal(offMain.failed?.step, 'Require a main source that declares this version');
  // A release tag already pointing at this digest is accepted; one pointing elsewhere is refused.
  const same = rehearse({ existingTag: digest => digest, images: 'web' });
  assert.equal(same.failed, undefined, same.failed?.result.stderr ?? '');
  const moved = rehearse({ existingTag: () => `sha256:${'f'.repeat(64)}` });
  assert.equal(moved.failed?.step, 'Sign and attest each qualified digest');
  assert.match(moved.failed!.result.stderr, /never moves/);
  for (const run of [version, offMain, moved]) {
    assert.ok(!run.calls.some(call => call[0] === 'crane' && call[1] === 'tag'), 'no tag moved');
  }
  assert.ok(!moved.calls.some(call => call[0] === 'cosign'), 'a refused image is never signed');
});

test('the docker README documents the published repositories, verification, mirroring and model layout', () => {
  const readme = read('deploy/docker/README.md');
  const section = readme.slice(readme.indexOf('## Published images'));
  for (const image of IMAGES) assert.ok(section.includes(`ghcr.io/lolly-tools/lolly-${image}`), image);
  assert.match(section, /cosign verify /);
  assert.match(section, /--certificate-identity https:\/\/github\.com\/lolly-tools\/lolly\/\.github\/workflows\/release-images\.yml@refs\/heads\/main/);
  assert.match(section, /skopeo copy --all --preserve-digests/);
  assert.match(section, /\/usr\/share\/nginx\/html\/models/);
  assert.match(section, /<family>@<hash16>/);
});
