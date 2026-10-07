// SPDX-License-Identifier: MPL-2.0
/** Export already qualified public registry bytes; never build or transfer credentials. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { createGunzip } from 'node:zlib';

const names = ['web', 'mcp-browser', 'ca', 'penpot'] as const;
const sha = /^sha256:[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;
const maximumArchiveBytes = 2 * 1024 ** 3;
interface Descriptor {
  digest: string;
  size: number;
  mediaType: string;
}
interface Image {
  digest: string;
  imageId: string;
  source: string;
  platform: string;
}
interface Release {
  source: string;
  runId: string;
  neutralProfile: boolean;
  images: Record<string, Image>;
}
interface Manifest {
  schemaVersion: number;
  mediaType: string;
  config: Descriptor;
  layers: Descriptor[];
}
interface ImageConfig {
  os: string;
  architecture: string;
  config: { Labels: Record<string, string>; Env?: string[]; User?: string };
  rootfs: { type: string; diff_ids: string[] };
}
const hash = (bytes: Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function validateRelease(release: Release, source: string, run: string, owner: string) {
  assert.match(source, commit);
  assert.match(run, /^[1-9][0-9]{0,19}$/);
  assert.match(owner, /^[a-z0-9-]+$/);
  assert.equal(release.source, source);
  assert.equal(release.runId, run);
  assert.equal(release.neutralProfile, true);
  assert.deepEqual(Object.keys(release.images).sort(), [...names].sort());
  for (const name of names) {
    const image = release.images[name];
    assert.ok(image);
    assert.equal(image.source, source);
    assert.equal(image.platform, 'linux/amd64');
    assert.match(image.imageId, sha);
    assert.ok(image.digest.startsWith(`ghcr.io/${owner}/lolly-${name}@`));
    assert.match(image.digest.split('@')[1] ?? '', sha);
  }
}
export function validateConfig(config: ImageConfig, source: string) {
  assert.equal(config.os, 'linux');
  assert.equal(config.architecture, 'amd64');
  assert.equal(config.config.Labels['org.opencontainers.image.revision'], source);
  assert.equal(config.config.Labels['org.lolly.profile'], 'lolly-start');
  assert.ok(config.config.User && !['root', '0', '0:0'].includes(config.config.User));
  for (const variable of config.config.Env ?? []) {
    assert.doesNotMatch(
      variable.split('=')[0] ?? '',
      /^(GH_TOKEN|GITHUB_TOKEN|LOLLY_CATALOG_SIGNING_KEY|LOLLY_MCP_TOKEN|LOLLY_MCP_SIGNING_SECRET|CA_ROOT_KEY_PEM|CA_SERVICE_SECRET)$/
    );
  }
  assert.equal(config.rootfs.type, 'layers');
  assert.ok(config.rootfs.diff_ids.length > 0);
  for (const digest of config.rootfs.diff_ids) assert.match(digest, sha);
}
function descriptor(value: Descriptor) {
  assert.match(value.digest, sha);
  assert.ok(
    Number.isSafeInteger(value.size) && value.size > 0 && value.size <= maximumArchiveBytes
  );
}
function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 2 * 1024 ** 2 });
  assert.equal(result.status, 0, `${command} failed`);
  return result.stdout;
}

async function main() {
  const env = process.env;
  const source = env.QUALIFIED_SOURCE ?? '';
  const nativeRun = env.QUALIFIED_RUN ?? '';
  const expectedOperator = env.EXPECTED_SOURCE ?? '';
  assert.match(expectedOperator, commit);
  assert.equal(env.GITHUB_SHA, expectedOperator);
  assert.equal(run('git', ['rev-parse', 'HEAD']).trim(), expectedOperator);
  assert.equal(env.BUILD_IMAGES, 'false');
  const repository = env.GITHUB_REPOSITORY ?? '';
  assert.match(repository, /^[a-zA-Z0-9-]+\/lolly$/);
  const owner = repository.split('/')[0]?.toLowerCase();
  assert.ok(owner);
  assert.ok(env.GH_TOKEN && env.GITHUB_ACTOR && env.RUNNER_TEMP);
  assert.match(source, commit);
  assert.match(nativeRun, /^[1-9][0-9]{0,19}$/);
  const directory = join(env.RUNNER_TEMP, 'lolly-qualified-image-export');
  await mkdir(directory, { mode: 0o700 });
  const api = async (path: string) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        authorization: `Bearer ${env.GH_TOKEN}`,
        'user-agent': 'lolly-qualified-image-export',
      },
      signal: AbortSignal.timeout(30_000),
    });
    assert.ok(response.ok, `GitHub metadata request failed (${response.status})`);
    return response;
  };
  const workflow = await (await api('actions/workflows/deployment-suse.yml')).json();
  const qualification = await (await api(`actions/runs/${nativeRun}`)).json();
  assert.equal(qualification.workflow_id, workflow.id);
  assert.equal(qualification.head_repository.full_name, repository);
  assert.equal(qualification.head_sha, source);
  assert.equal(qualification.event, 'workflow_dispatch');
  assert.equal(qualification.status, 'completed');
  assert.equal(qualification.conclusion, 'success');
  const jobs = await (await api(`actions/runs/${nativeRun}/jobs?per_page=100`)).json();
  const native = jobs.jobs.find(
    (job: { name: string }) => job.name === 'Opt-in native public candidate images'
  );
  assert.equal(native?.conclusion, 'success');
  for (const name of [
    'Verify the actual image catalog against the supplied public pin',
    'Require restricted native sandbox and actual public exports',
    'Publish only qualified image digests',
  ]) {
    assert.equal(
      native.steps.find((step: { name: string }) => step.name === name)?.conclusion,
      'success',
      name
    );
  }
  const artifacts = await (await api(`actions/runs/${nativeRun}/artifacts`)).json();
  const artifact = artifacts.artifacts.find(
    (item: { name: string }) => item.name === 'public-candidate-image-receipts'
  );
  assert.ok(
    artifact &&
      !artifact.expired &&
      artifact.size_in_bytes > 0 &&
      artifact.size_in_bytes < 1024 ** 2
  );
  const zip = Buffer.from(await (await api(`actions/artifacts/${artifact.id}/zip`)).arrayBuffer());
  assert.ok(zip.length < 1024 ** 2);
  const zipPath = join(directory, 'native-receipts.zip');
  await writeFile(zipPath, zip, { mode: 0o600 });
  const members = run('unzip', ['-Z1', zipPath]).trim().split('\n');
  assert.ok(members.length <= 16);
  const allowedMembers = new Set([
    'web.json',
    'mcp-browser.json',
    'ca.json',
    'penpot.json',
    'catalog.json',
    'native-probe.json',
    'public.jwk.json',
    'release.json',
    'service-boot.json',
  ]);
  for (const member of members)
    assert.ok(allowedMembers.has(member), 'Unknown qualification receipt member');
  const receipt = async (name: string) => {
    assert.ok(members.includes(name));
    const raw = run('unzip', ['-p', zipPath, name]);
    await writeFile(join(directory, name), raw, { mode: 0o600 });
    return raw;
  };
  const release = JSON.parse(await receipt('release.json')) as Release;
  validateRelease(release, source, nativeRun, owner);
  const catalog = JSON.parse(await receipt('catalog.json'));
  assert.equal(catalog.verified, true);
  assert.equal(catalog.tools, 67);
  const publicKey = JSON.parse(await receipt('public.jwk.json'));
  const suppliedPublicKey = JSON.parse(env.VITE_CATALOG_PUBLIC_KEY_JWK ?? '');
  for (const key of [publicKey, suppliedPublicKey]) {
    assert.equal(key.kty, 'EC');
    assert.equal(key.crv, 'P-256');
    assert.equal(key.d, undefined);
  }
  assert.equal(publicKey.x, suppliedPublicKey.x);
  assert.equal(publicKey.y, suppliedPublicKey.y);
  const probeRaw = await receipt('native-probe.json');
  const probeStart = probeRaw.indexOf('{');
  assert.ok(probeStart >= 0);
  assert.ok(
    [
      '',
      'catalog integrity: unsigned catalog (tool code is not signature-verified) - expected for a local or dev catalog',
    ].includes(probeRaw.slice(0, probeStart).trim())
  );
  const probe = JSON.parse(probeRaw.slice(probeStart));
  for (const key of [
    'nativeImageProbePassed',
    'publicRelayWebSocketQualified',
    'crossDocumentRefused',
    'readOnlyGrantEnforced',
    'invalidInvitationRefused',
    'missingAuthRefused',
    'unavailableAdmissionRefused',
    'badOriginRefused',
    'privateFilesDisabled',
    'chromiumSandbox',
  ])
    assert.equal(probe[key], true, key);
  assert.equal(probe.mcpMetaTools, 21);
  assert.equal(probe.catalogRecipes, 67);
  assert.equal(probe.matchedPublicFiles, catalog.files);
  for (const format of ['svg', 'png', 'pdf']) assert.ok(probe.renders[format].bytes > 100);
  assert.match(probe.sandboxDiagnostics, /Layer 1 Sandbox\s+Namespace/);

  const oci = join(directory, 'oci');
  const blobDirectory = join(oci, 'blobs', 'sha256');
  await mkdir(blobDirectory, { recursive: true, mode: 0o700 });
  const stored = new Map<string, number>();
  const manifests: Record<string, unknown> = {};
  const imageRecords: Record<string, unknown> = {};
  const index: { schemaVersion: number; mediaType: string; manifests: unknown[] } = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.index.v1+json',
    manifests: [],
  };
  for (const name of names) {
    const image = release.images[name];
    assert.ok(image);
    const [reference, imageDigest] = image.digest.split('@');
    assert.ok(reference && imageDigest);
    const packageName = reference.replace('ghcr.io/', '');
    const tokenResponse: Response = await fetch(
      `https://ghcr.io/token?service=ghcr.io&scope=repository:${packageName}:pull`,
      {
        headers: {
          authorization: `Basic ${Buffer.from(`${env.GITHUB_ACTOR}:${env.GH_TOKEN}`).toString('base64')}`,
        },
        signal: AbortSignal.timeout(30_000),
      }
    );
    assert.ok(tokenResponse.ok, `Scoped registry authorization failed (${tokenResponse.status})`);
    const authorization: string = `Bearer ${(await tokenResponse.json()).token}`;
    const get = async (path: string): Promise<Response> => {
      const response = await fetch(`https://ghcr.io/v2/${packageName}/${path}`, {
        headers: {
          authorization,
          accept:
            'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json',
        },
        signal: AbortSignal.timeout(120_000),
      });
      assert.ok(response.ok, `Pinned registry object unavailable (${response.status})`);
      return response;
    };
    const manifestBytes = Buffer.from(await (await get(`manifests/${imageDigest}`)).arrayBuffer());
    assert.ok(manifestBytes.length < 1024 ** 2);
    assert.equal(hash(manifestBytes), imageDigest);
    const manifest = JSON.parse(manifestBytes.toString()) as Manifest;
    assert.equal(manifest.schemaVersion, 2);
    assert.ok(manifest.config && manifest.layers);
    assert.ok(
      [
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.docker.distribution.manifest.v2+json',
      ].includes(manifest.mediaType)
    );
    await writeFile(join(blobDirectory, imageDigest.slice(7)), manifestBytes, { mode: 0o600 });
    stored.set(imageDigest, manifestBytes.length);
    descriptor(manifest.config);
    assert.equal(manifest.config.digest, image.imageId);
    const configBytes = Buffer.from(
      await (await get(`blobs/${manifest.config.digest}`)).arrayBuffer()
    );
    assert.equal(configBytes.length, manifest.config.size);
    assert.equal(hash(configBytes), manifest.config.digest);
    const config = JSON.parse(configBytes.toString()) as ImageConfig;
    validateConfig(config, source);
    assert.equal(config.rootfs.diff_ids.length, manifest.layers.length);
    await writeFile(join(blobDirectory, manifest.config.digest.slice(7)), configBytes, {
      mode: 0o600,
    });
    stored.set(manifest.config.digest, configBytes.length);
    for (const [layerIndex, layer] of manifest.layers.entries()) {
      descriptor(layer);
      assert.ok(layer.mediaType.endsWith('gzip'));
      const path = join(blobDirectory, layer.digest.slice(7));
      if (!stored.has(layer.digest)) {
        const response = await get(`blobs/${layer.digest}`);
        assert.ok(response.body);
        let size = 0;
        const compressedHash = createHash('sha256');
        await pipeline(
          Readable.fromWeb(response.body as never),
          new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              size += chunk.length;
              compressedHash.update(chunk);
              callback(
                size > layer.size ? new Error('Registry blob exceeded its descriptor') : null,
                chunk
              );
            },
          }),
          createWriteStream(path, { mode: 0o600, flags: 'wx' })
        );
        assert.equal(size, layer.size);
        assert.equal(`sha256:${compressedHash.digest('hex')}`, layer.digest);
        stored.set(layer.digest, size);
        assert.ok([...stored.values()].reduce((sum, value) => sum + value, 0) <= 3 * 1024 ** 3);
      }
      const expandedHash = createHash('sha256');
      let expandedSize = 0;
      await pipeline(
        createReadStream(path),
        createGunzip(),
        new Writable({
          write(chunk: Buffer, _encoding, callback) {
            expandedSize += chunk.length;
            expandedHash.update(chunk);
            callback(
              expandedSize > 4 * 1024 ** 3 ? new Error('Expanded layer exceeded bound') : null
            );
          },
        })
      );
      assert.equal(`sha256:${expandedHash.digest('hex')}`, config.rootfs.diff_ids[layerIndex]);
    }
    manifests[name] = {
      digest: imageDigest,
      mediaType: manifest.mediaType,
      bytes: manifestBytes.length,
      config: manifest.config,
      layers: manifest.layers,
    };
    imageRecords[name] = {
      ...image,
      manifestVerified: true,
      configVerified: true,
      rootfsDiffIdsVerified: true,
      runtimeUser: config.config.User,
      rootfsDiffIds: config.rootfs.diff_ids,
    };
    index.manifests.push({
      mediaType: manifest.mediaType,
      digest: imageDigest,
      size: manifestBytes.length,
      platform: { os: 'linux', architecture: 'amd64' },
      annotations: { 'org.opencontainers.image.ref.name': `${reference}:qualified-${source}` },
    });
  }
  await writeFile(join(oci, 'index.json'), JSON.stringify(index), { mode: 0o600 });
  await writeFile(join(oci, 'oci-layout'), '{"imageLayoutVersion":"1.0.0"}', { mode: 0o600 });
  const archive = join(directory, 'public-images.oci.tar.gz');
  run('tar', ['-czf', archive, '-C', oci, '.']);
  const archiveSize = (await stat(archive)).size;
  assert.ok(archiveSize <= maximumArchiveBytes);
  const archiveHash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) archiveHash.update(chunk);
  await writeFile(join(directory, 'registry-manifests.json'), JSON.stringify(manifests, null, 2), {
    mode: 0o600,
  });
  const transport = {
    operatorSource: expectedOperator,
    applicationSource: source,
    qualifiedRun: nativeRun,
    sourceRunSucceeded: true,
    publicPinPreserved: true,
    images: imageRecords,
    archive: {
      name: 'public-images.oci.tar.gz',
      bytes: archiveSize,
      sha256: archiveHash.digest('hex'),
    },
    registryCredentialsIncluded: false,
    rebuilt: false,
    candidateRuntimeQualified: false,
  };
  await writeFile(join(directory, 'transport.json'), JSON.stringify(transport, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      exported: true,
      applicationSource: source,
      images: names.length,
      compressedBytes: archiveSize,
      registryCredentialsIncluded: false,
      rebuilt: false,
    })
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
