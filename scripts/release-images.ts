#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Admission for .github/workflows/release-images.yml.
 *
 * That workflow promotes the exact candidate digests one deployment-suse.yml run
 * built, booted and pushed. It signs each digest, attests an SPDX SBOM and SLSA
 * provenance, then tags the same digest with the release version. This file makes
 * every decision about what may be promoted. It reads only the files the workflow
 * fetched into $RUNNER_TEMP/release-images and never contacts a registry, signs
 * or tags anything itself.
 *
 *   node scripts/release-images.ts request     the inputs and the source's declared version
 *   node scripts/release-images.ts attempt     the qualification run; prints its attempt
 *   node scripts/release-images.ts qualify     its job inventory; lists receipt artifacts
 *   node scripts/release-images.ts receipts    the receipts; writes plan.json and plan.tsv
 *   node scripts/release-images.ts image <n>   the registry manifest, config and any tag
 *   node scripts/release-images.ts provenance <n>
 *   node scripts/release-images.ts manifest    images.json for the GitHub release
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const IMAGES = ['web', 'mcp', 'mcp-browser', 'ca', 'penpot'] as const;
export type ImageName = (typeof IMAGES)[number];

/** Display names of the candidate workflow's jobs, as its run inventory reports them. */
export const JOBS = {
  chart: 'Public chart render and schema checks',
  route: 'Public VM route and security acceptance',
  source: 'Reviewed main CI source',
  gate: 'WebGPU release gate (web shell image only)',
  web: 'Opt-in native public web image (gated on the WebGPU table)',
  mcp: 'Opt-in native public MCP image (browser-free)',
  probe: 'Unsigned web shell for the MCP browser probe (never published)',
  browser: 'Opt-in native public MCP browser image (not gated on WebGPU)',
  services: 'Opt-in native public service images (CA, Penpot)',
} as const;
type JobKey = keyof typeof JOBS;

const PREREQUISITES: JobKey[] = ['chart', 'route', 'source'];

interface ImageRule {
  /** Jobs that must have succeeded in the qualifying attempt. */
  jobs: JobKey[];
  /** Receipt artifact name before its -attempt-N suffix. */
  artifact: string;
  /** Every image that job's release.json lists. */
  siblings: ImageName[];
  dockerfile: string;
}

const RULES: Record<ImageName, ImageRule> = {
  web: { jobs: ['gate', 'web'], artifact: 'public-candidate-web-receipts', siblings: ['web'], dockerfile: 'deploy/docker/web.Dockerfile' },
  mcp: { jobs: ['mcp'], artifact: 'public-candidate-mcp-receipts', siblings: ['mcp'], dockerfile: 'deploy/docker/mcp.Dockerfile' },
  'mcp-browser': { jobs: ['probe', 'browser'], artifact: 'public-candidate-mcp-browser-receipts', siblings: ['mcp-browser'], dockerfile: 'deploy/docker/mcp-browser.Dockerfile' },
  ca: { jobs: ['services'], artifact: 'public-candidate-service-receipts', siblings: ['ca', 'penpot'], dockerfile: 'deploy/docker/ca.Dockerfile' },
  penpot: { jobs: ['services'], artifact: 'public-candidate-service-receipts', siblings: ['ca', 'penpot'], dockerfile: 'deploy/docker/penpot.Dockerfile' },
};

export const CANDIDATE_WORKFLOW = '.github/workflows/deployment-suse.yml';
export const PROFILE = 'lolly-start';
export const PLATFORM = 'linux/amd64';
export const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const MANIFEST_TYPES = new Set(['application/vnd.docker.distribution.manifest.v2+json', 'application/vnd.oci.image.manifest.v1+json']);

type Json = Record<string, unknown>;

function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
}
function sha256(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function parse(text: string, what: string): Json {
  try { return object(JSON.parse(text)); } catch { throw new Error(`${what} is not JSON`); }
}

export interface ReleaseRequest {
  version: string;
  run: string;
  source: string;
  images: ImageName[];
  /** owner/name, exactly as in GITHUB_REPOSITORY. */
  repository: string;
  /** Lower-case registry namespace. */
  owner: string;
}

/** The dispatch inputs, refused unless each is exact. */
export function parseRequest(env: NodeJS.ProcessEnv): ReleaseRequest {
  const version = env.RELEASE_VERSION ?? '';
  require(version.length <= 64 && VERSION.test(version), 'The version must be a semantic version such as 1.1.1');
  const run = env.QUALIFICATION_RUN ?? '';
  require(/^[1-9][0-9]{0,19}$/.test(run) && Number.isSafeInteger(Number(run)), 'The qualification run must be a run ID');
  const source = env.EXPECTED_SOURCE ?? '';
  require(SHA.test(source), 'The expected source must be a full 40-hex commit');
  const repository = env.GITHUB_REPOSITORY ?? '';
  require(REPOSITORY.test(repository), 'Unknown repository');
  const owner = repository.split('/')[0]!.toLowerCase();
  const requested = (env.RELEASE_IMAGES ?? '').trim().split(/[\s,]+/).filter(Boolean);
  require(requested.length > 0, 'Name at least one image to promote');
  require(new Set(requested).size === requested.length, 'An image is named twice');
  for (const name of requested) require((IMAGES as readonly string[]).includes(name), `Unknown image ${name}; expected ${IMAGES.join(', ')}`);
  return { version, run, source, repository, owner, images: IMAGES.filter(image => requested.includes(image)) };
}

/** The product version the source declares; the desktop app and both charts must agree. */
export function declaredVersion(files: { tauri: string; chart: string; sovereign: string }): string {
  const product = parse(files.tauri, 'tauri.conf.json').version;
  const appVersion = (chart: string) => /^appVersion: "([^"]+)"$/m.exec(chart)?.[1];
  require(typeof product === 'string' && VERSION.test(product), 'The source declares no product version');
  require(appVersion(files.chart) === product, 'The Helm chart appVersion differs from the product version');
  require(appVersion(files.sovereign) === product, 'The sovereign chart appVersion differs from the product version');
  return product;
}

export interface QualificationRun { attempt: number; startedOn: string; finishedOn: string }

/** The completed workflow_dispatch run of the candidate workflow on main for this source. */
export function admitRun(value: unknown, request: ReleaseRequest): QualificationRun {
  const run = object(value);
  require(run.id === Number(request.run), 'The run differs from the requested qualification run');
  require(run.path === CANDIDATE_WORKFLOW, `The run is not ${CANDIDATE_WORKFLOW}`);
  require(run.event === 'workflow_dispatch' && run.head_branch === 'main', 'The run is not a dispatch from main');
  require(run.head_sha === request.source, 'The run qualified a different source');
  require(object(run.repository).full_name === request.repository && object(run.head_repository).full_name === request.repository, 'The run belongs to another repository');
  require(run.status === 'completed', 'The run has not completed');
  require(positive(run.run_attempt), 'The run has no valid attempt');
  require(typeof run.run_started_at === 'string' && typeof run.updated_at === 'string', 'The run has no start or finish time');
  return { attempt: run.run_attempt, startedOn: run.run_started_at, finishedOn: run.updated_at };
}

/**
 * The receipt artifacts to download, after the complete job inventory of that
 * attempt shows every prerequisite and every job behind a requested image passed.
 */
export function qualifiedArtifacts(value: unknown, request: ReleaseRequest, attempt: number): string[] {
  const inventory = object(value);
  const jobs = Array.isArray(inventory.jobs) ? inventory.jobs.map(object) : [];
  require(jobs.length > 0 && jobs.length <= 100 && inventory.total_count === jobs.length, 'Incomplete job inventory');
  const ids = new Set<number>();
  const outcomes = new Map<string, unknown>();
  for (const job of jobs) {
    require(positive(job.id) && !ids.has(job.id), 'Invalid or duplicate job ID');
    require(job.run_id === Number(request.run), 'A job belongs to another run');
    require(job.run_attempt === undefined || job.run_attempt === attempt, 'A job belongs to another attempt');
    require(typeof job.name === 'string' && job.name.length > 0 && !outcomes.has(job.name), 'Missing or duplicate job name');
    require(job.status === 'completed', 'A job has not completed');
    ids.add(job.id);
    outcomes.set(job.name, job.conclusion);
  }
  const passed = (key: JobKey, why: string) => {
    const conclusion = outcomes.get(JOBS[key]);
    require(conclusion === 'success', `${why}: "${JOBS[key]}" ${conclusion === undefined ? 'is not in the run' : `concluded ${String(conclusion)}`}`);
  };
  for (const key of PREREQUISITES) passed(key, 'A deployment prerequisite did not pass');
  for (const image of request.images) for (const key of RULES[image].jobs) passed(key, `Run ${request.run} did not qualify ${image}`);
  return [...new Set(request.images.map(image => `${RULES[image].artifact}-attempt-${attempt}`))];
}

/** The last JSON document in a receipt; a few receipts begin with a logged line. */
function finalJson(text: string, what: string): Json {
  const start = text.startsWith('{') ? 0 : text.lastIndexOf('\n{') + 1;
  require(start === 0 ? text.startsWith('{') : start > 0, `${what} holds no JSON receipt`);
  return parse(text.slice(start), what);
}

/** RFC 7638 thumbprint, the key ID a release catalog records. */
export function keyThumbprint(key: Json): string {
  return createHash('sha256').update(JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y })).digest('base64url');
}

export interface Evidence { name: string; sha256: string }
export interface ImagePlan {
  image: ImageName;
  repository: string;
  digest: string;
  imageId: string;
  dockerfile: string;
  artifact: string;
  evidence: Evidence[];
}

/** Read one receipt file of one artifact, or undefined when it is absent. */
export type ReceiptReader = (artifact: string, file: string) => string | undefined;

/**
 * Each requested image's digest from its own job's receipts, with the boot,
 * render, probe and pin evidence that job recorded before it pushed.
 */
export function admitReceipts(request: ReleaseRequest, attempt: number, read: ReceiptReader, publicPin: string | undefined): ImagePlan[] {
  return request.images.map(image => {
    const rule = RULES[image];
    const artifact = `${rule.artifact}-attempt-${attempt}`;
    const evidence: Evidence[] = [];
    const file = (name: string): string => {
      const text = read(artifact, name);
      require(typeof text === 'string', `${artifact} has no ${name}`);
      evidence.push({ name: `${artifact}/${name}`, sha256: sha256(text) });
      return text;
    };
    const release = parse(file('release.json'), 'release.json');
    require(release.source === request.source && release.runId === request.run, `${image}: the receipt names another source or run`);
    require(release.runAttempt === attempt, `${image}: the receipt names another attempt`);
    require(release.neutralProfile === true, `${image}: the receipt does not record the neutral profile`);
    const images = object(release.images);
    require(JSON.stringify(Object.keys(images).sort()) === JSON.stringify([...rule.siblings].sort()), `${image}: the receipt lists other images`);
    const entry = object(images[image]);
    const repository = `ghcr.io/${request.owner}/lolly-${image}`;
    const reference = typeof entry.digest === 'string' ? entry.digest : '';
    const digest = reference.slice(repository.length + 1);
    require(reference === `${repository}@${digest}` && DIGEST.test(digest), `${image}: the receipt digest is not in ${repository}`);
    require(typeof entry.imageId === 'string' && DIGEST.test(entry.imageId), `${image}: the receipt has no image ID`);
    require(entry.platform === PLATFORM && entry.source === request.source, `${image}: the receipt names another platform or source`);
    require(JSON.stringify(parse(file(`${image}.json`), `${image}.json`)) === JSON.stringify(entry), `${image}: ${image}.json differs from release.json`);
    if (image === 'web') {
      const boot = parse(file('web-boot.json'), 'web-boot.json');
      require(boot.serviceBootPassed === true && object(boot.results).web === 200, 'web: the boot check did not pass');
      require(typeof publicPin === 'string' && publicPin.length > 0, 'web: the repository public pin is not available');
      const pin = parse(publicPin, 'the repository public pin');
      const packaged = parse(file('public.jwk.json'), 'public.jwk.json');
      require(pin.d === undefined && packaged.d === undefined && ['kty', 'crv', 'x', 'y'].every(field => typeof pin[field] === 'string' && packaged[field] === pin[field]), 'web: the image was packaged for another public pin');
      const catalog = parse(file('catalog.json'), 'catalog.json');
      require(catalog.verified === true && catalog.keyId === keyThumbprint(pin), 'web: the image catalog was not verified against the repository pin');
    } else if (image === 'mcp') {
      const boot = parse(file('mcp-boot.json'), 'mcp-boot.json');
      const results = object(boot.results);
      require(boot.serviceBootPassed === true && results.readyz === 200 && results.unavailableAdmissionRefused === 503, 'mcp: the boot check did not pass');
      require(parse(file('mcp-render.json'), 'mcp-render.json').browserFreeRenderPassed === true, 'mcp: the browser-free render did not pass');
    } else if (image === 'mcp-browser') {
      const probe = finalJson(file('native-probe.json'), 'native-probe.json');
      require(probe.nativeImageProbePassed === true && probe.chromiumSandbox === true, 'mcp-browser: the sandboxed browser probe did not pass');
    } else {
      require(parse(file('service-boot.json'), 'service-boot.json').serviceBootPassed === true, `${image}: the boot check did not pass`);
    }
    return { image, repository, digest, imageId: entry.imageId, dockerfile: rule.dockerfile, artifact, evidence };
  });
}

/**
 * The registry's copy of a planned digest: the manifest bytes hash to that digest,
 * it is one linux/amd64 image whose labels name this source, profile, title and
 * version, and the release tag is unused or already points at the same digest.
 */
export function admitImage(plan: ImagePlan, request: ReleaseRequest, manifestBytes: Uint8Array, configBytes: Uint8Array, existingTag?: string): void {
  require(`sha256:${sha256(manifestBytes)}` === plan.digest, `${plan.image}: the registry manifest differs from the qualified digest`);
  const manifest = parse(Buffer.from(manifestBytes).toString('utf8'), 'The registry manifest');
  require(manifest.schemaVersion === 2 && MANIFEST_TYPES.has(String(manifest.mediaType)), `${plan.image}: the qualified digest is not a single-platform image manifest`);
  const config = object(manifest.config);
  require(config.digest === plan.imageId && config.digest === `sha256:${sha256(configBytes)}`, `${plan.image}: the image configuration differs from the receipt`);
  const image = parse(Buffer.from(configBytes).toString('utf8'), 'The image configuration');
  require(`${String(image.os)}/${String(image.architecture)}` === PLATFORM, `${plan.image}: the image is not ${PLATFORM}`);
  const labels = object(object(image.config).Labels);
  const expected: Record<string, string> = {
    'org.opencontainers.image.revision': request.source,
    'org.opencontainers.image.source': `https://github.com/${request.repository}`,
    'org.opencontainers.image.title': `lolly-${plan.image}`,
    'org.opencontainers.image.version': request.version,
    'org.lolly.profile': PROFILE,
  };
  for (const [label, value] of Object.entries(expected)) {
    require(labels[label] === value, `${plan.image}: label ${label} is ${JSON.stringify(labels[label])}, expected ${JSON.stringify(value)}`);
  }
  require(typeof labels['org.opencontainers.image.created'] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(labels['org.opencontainers.image.created']), `${plan.image}: the image has no creation label`);
  if (existingTag !== undefined) {
    require(existingTag.trim() === plan.digest, `${plan.repository}:${request.version} already names another digest; a release tag never moves`);
  }
}

/**
 * SLSA v1 provenance for one digest. It states what the qualification run did:
 * which workflow on main built which Dockerfile from which commit, and which
 * receipts that run recorded. This workflow signs it after rechecking those
 * receipts; the certificate identifies this workflow, not the builder.
 */
export function provenance(plan: ImagePlan, request: ReleaseRequest, run: QualificationRun): Json {
  const server = 'https://github.com';
  return {
    buildDefinition: {
      buildType: `${server}/${request.repository}/blob/main/deploy/docker/README.md#published-images`,
      externalParameters: {
        workflow: { repository: `${server}/${request.repository}`, path: CANDIDATE_WORKFLOW, ref: 'refs/heads/main' },
        source: request.source,
        dockerfile: plan.dockerfile,
        profile: PROFILE,
        platform: PLATFORM,
      },
      internalParameters: { candidateTag: `candidate-${request.source}`, image: plan.image },
      resolvedDependencies: [{ uri: `git+${server}/${request.repository}@refs/heads/main`, digest: { gitCommit: request.source } }],
    },
    runDetails: {
      builder: { id: `${server}/actions/runner/github-hosted` },
      metadata: {
        invocationId: `${server}/${request.repository}/actions/runs/${request.run}/attempts/${run.attempt}`,
        startedOn: run.startedOn,
        finishedOn: run.finishedOn,
      },
      byproducts: plan.evidence.map(item => ({ name: item.name, digest: { sha256: item.sha256 } })),
    },
  };
}

export interface ReleaseContext { promotionRun: string; promotionAttempt: number; identity: string }

/** images.json: what the GitHub release lists for each promoted image. */
export function imagesManifest(request: ReleaseRequest, run: QualificationRun, plans: ImagePlan[], context: ReleaseContext, attestations: Record<string, { sbom: string; provenance: string }>): Json {
  require(/^https:\/\/github\.com\/[^@\s]+\/\.github\/workflows\/release-images\.yml@refs\/heads\/main$/.test(context.identity), 'Unexpected signing identity');
  return {
    version: 1,
    release: request.version,
    source: request.source,
    profile: PROFILE,
    qualificationRun: request.run,
    qualificationAttempt: run.attempt,
    promotionRun: context.promotionRun,
    promotionAttempt: context.promotionAttempt,
    signing: { issuer: OIDC_ISSUER, identity: context.identity },
    images: plans.map(plan => {
      const files = attestations[plan.image];
      require(files, `${plan.image} has no attestation files`);
      return {
        name: plan.image,
        repository: plan.repository,
        tag: request.version,
        digest: plan.digest,
        reference: `${plan.repository}:${request.version}@${plan.digest}`,
        platform: PLATFORM,
        attestations: {
          sbom: { predicateType: 'https://spdx.dev/Document', sha256: files.sbom },
          provenance: { predicateType: 'https://slsa.dev/provenance/v1', sha256: files.provenance },
        },
      };
    }),
  };
}

function main(argv: string[], env: NodeJS.ProcessEnv): void {
  require(typeof env.RUNNER_TEMP === 'string' && env.RUNNER_TEMP.length > 0, 'RUNNER_TEMP is not set');
  const root = join(env.RUNNER_TEMP, 'release-images');
  const at = (...parts: string[]) => join(root, ...parts);
  const json = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
  const request = parseRequest(env);
  const image = (name: string | undefined): ImagePlan => {
    const plan = (json(at('plan.json')) as ImagePlan[]).find(item => item.image === name);
    require(plan, `${String(name)} is not in the release plan`);
    return plan;
  };
  const [command, name] = argv;
  switch (command) {
    case 'request': {
      const version = declaredVersion({
        tauri: readFileSync(at('source/shells/tauri-desktop/src-tauri/tauri.conf.json'), 'utf8'),
        chart: readFileSync(at('source/deploy/helm/Chart.yaml'), 'utf8'),
        sovereign: readFileSync(at('source/deploy/helm/profiles/sovereign/Chart.yaml'), 'utf8'),
      });
      require(version === request.version, `The source declares ${version}, not ${request.version}`);
      mkdirSync(root, { recursive: true });
      writeFileSync(at('request.json'), JSON.stringify(request, null, 2) + '\n');
      return;
    }
    case 'attempt':
      process.stdout.write(String(admitRun(json(at('run.json')), request).attempt));
      return;
    case 'qualify': {
      const { attempt } = admitRun(json(at('run.json')), request);
      writeFileSync(at('artifacts.txt'), qualifiedArtifacts(json(at('jobs.json')), request, attempt).join('\n') + '\n');
      return;
    }
    case 'receipts': {
      const { attempt } = admitRun(json(at('run.json')), request);
      qualifiedArtifacts(json(at('jobs.json')), request, attempt);
      const read: ReceiptReader = (artifact, file) => {
        const path = at('receipts', artifact, file);
        return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
      };
      const plans = admitReceipts(request, attempt, read, env.EXISTING_PUBLIC_KEY_JWK);
      writeFileSync(at('plan.json'), JSON.stringify(plans, null, 2) + '\n');
      writeFileSync(at('plan.tsv'), plans.map(plan => [plan.image, plan.repository, plan.digest].join('\t')).join('\n') + '\n');
      return;
    }
    case 'image': {
      const plan = image(name);
      const existing = at('images', plan.image, 'existing-tag');
      admitImage(plan, request, readFileSync(at('images', plan.image, 'manifest.json')), readFileSync(at('images', plan.image, 'config.json')),
        existsSync(existing) ? readFileSync(existing, 'utf8') : undefined);
      return;
    }
    case 'provenance': {
      const plan = image(name);
      const run = admitRun(json(at('run.json')), request);
      writeFileSync(at('images', plan.image, 'provenance.json'), JSON.stringify(provenance(plan, request, run), null, 2) + '\n');
      return;
    }
    case 'manifest': {
      const run = admitRun(json(at('run.json')), request);
      const plans = json(at('plan.json')) as ImagePlan[];
      const attestations = Object.fromEntries(plans.map(plan => [plan.image, {
        sbom: sha256(readFileSync(at('images', plan.image, 'sbom.spdx.json'))),
        provenance: sha256(readFileSync(at('images', plan.image, 'provenance.json'))),
      }]));
      const attempt = Number(env.GITHUB_RUN_ATTEMPT);
      require(positive(attempt) && /^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? ''), 'Invalid promotion run');
      const manifest = imagesManifest(request, run, plans, {
        promotionRun: env.GITHUB_RUN_ID!, promotionAttempt: attempt, identity: `${env.GITHUB_SERVER_URL}/${env.GITHUB_WORKFLOW_REF}`,
      }, attestations);
      writeFileSync(at('images.json'), JSON.stringify(manifest, null, 2) + '\n');
      return;
    }
    default:
      throw new Error('Usage: release-images.ts request|attempt|qualify|receipts|image <name>|provenance <name>|manifest');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2), process.env);
  } catch (error) {
    process.stderr.write(`Release refused: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
