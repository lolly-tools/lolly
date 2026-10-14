// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { CATALOG_SIG_ALG, signCatalogEnvelope } from '../engine/src/catalog-integrity.ts';
import { prepareStaticDelivery } from '../scripts/build-delivery.ts';
import { catalogToolFiles, materializeCatalogDelivery, publishCatalogIndexes } from '../scripts/materialize-catalog-delivery.ts';
import { writeFrontendReceipt } from '../scripts/release-frontend-receipt.ts';

const source = 'a'.repeat(40);
const repo = fileURLToPath(new URL('../', import.meta.url));
const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicMaterial = JSON.stringify(pair.publicKey.export({ format: 'jwk' }));
const privateMaterial = pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const dockerfile = readFileSync(join(repo, 'deploy/docker/web.Dockerfile'), 'utf8');
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function put(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

async function artifact(root: string): Promise<void> {
  put(root, 'index.html', '<!doctype html><title>sample</title>');
  put(root, '.well-known/lolly.json', '{"name":"sample"}');
  put(root, 'tools/demo/tool.json', '{"id":"demo"}');
  put(root, 'tools/demo/template.html', '<main>sample</main>');
  put(root, 'tools/demo/lib/component.js', '/* sample library */');
  put(root, 'catalog/tools/index.json', '{"tools":[{"id":"demo"}]}');
  put(root, 'catalog/tools/index.slim.json', '{"tools":[{"id":"demo"}]}');
  put(root, 'catalog/assets/index.json', '{"assets":[]}');
  const materialized = await materializeCatalogDelivery(root);
  const privateKey = await crypto.subtle.importKey('jwk', pair.privateKey.export({ format: 'jwk' }), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const envelope = await signCatalogEnvelope({ alg: CATALOG_SIG_ALG, keyId: 'fixture', signedAt: '2026-10-13T00:00:00.000Z',
    files: catalogToolFiles(join(root, 'tools')), toolDirs: materialized.toolDirs,
    indexHash: digest(join(root, 'catalog/tools/index.json')), slimHash: digest(join(root, 'catalog/tools/index.slim.json')),
    assetIndexHash: digest(join(root, 'catalog/assets/index.json')),
  }, privateKey);
  publishCatalogIndexes(root, envelope, materialized.files);
  put(root, 'catalog/tools/index.sig.json', JSON.stringify(envelope));
  prepareStaticDelivery(root);
  writeFrontendReceipt(root, source, 'web', 'lolly-start', privateMaterial, publicMaterial);
}

test('image verifier runs without dependencies or signing keys and rejects changed artifact inventories', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-image-verification-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const original = join(directory, 'original');
  await artifact(original);
  const run = /^RUN --network=none ([\s\S]+?)(?=\n\nFROM)/m.exec(dockerfile)?.[1]?.replace(/\\\n\s*/g, ' ');
  assert.ok(run);
  const cases: [string, (root: string, env: NodeJS.ProcessEnv) => void, boolean][] = [
    ['original', () => {}, true],
    ['wrong source', (_root, env) => { env.LOLLY_RELEASE_SOURCE = 'b'.repeat(40); }, false],
    ['wrong profile', (_root, env) => { env.LOLLY_PROFILE = 'other'; }, false],
    ['wrong key', (_root, env) => { env.VITE_CATALOG_PUBLIC_KEY_JWK = JSON.stringify(generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' })); }, false],
    ['changed page', root => { writeFileSync(join(root, 'index.html'), '<title>updated</title>'); }, false],
    ['changed hidden file', root => { writeFileSync(join(root, '.well-known/lolly.json'), '{}'); }, false],
    ['extra hidden file', root => { writeFileSync(join(root, '.extra'), 'sample'); }, false],
    ['missing delivery file', root => { rmSync(join(root, '.delivery-etags.conf')); }, false],
    ['changed library', root => { const path = join(root, 'tools/demo/lib/component.js'); chmodSync(path, 0o644); writeFileSync(path, '/* changed library */'); }, false],
    ['symbolic link', root => { symlinkSync(join(root, 'index.html'), join(root, 'linked.html')); }, false],
  ];
  for (const [name, change, accepted] of cases) {
    const stage = mkdtempSync(join(directory, 'stage-'));
    for (const line of dockerfile.split('\n').filter(line => line.startsWith('COPY ') && !line.includes('--from='))) {
      if (line.includes('/etc/nginx/')) continue;
      const parts = line.split(/\s+/).slice(1), destination = parts.pop()!;
      for (const path of parts) {
        const target = destination.endsWith('/') ? join(stage, destination, path.split('/').at(-1)!) : join(stage, destination);
        mkdirSync(dirname(target), { recursive: true }); cpSync(join(repo, path), target);
      }
    }
    const root = join(stage, 'release-frontend');
    cpSync(original, root, { recursive: true });
    const env: NodeJS.ProcessEnv = { PATH: dirname(process.execPath) + ':' + process.env.PATH,
      LOLLY_RELEASE_SOURCE: source, LOLLY_PROFILE: 'lolly-start', VITE_CATALOG_PUBLIC_KEY_JWK: publicMaterial };
    change(root, env);
    const result: SpawnSyncReturns<string> = spawnSync('sh', ['-c', run], { cwd: stage, env, encoding: 'utf8', timeout: 15_000 });
    assert.equal(result.status === 0, accepted, `${name}: ${result.stderr}`);
  }
});

test('web compilation and signing have separate jobs and complete artifact transport', () => {
  const workflow = parse(readFileSync(join(repo, '.github/workflows/release-frontend.yml'), 'utf8'));
  const compile = workflow.jobs.compile;
  assert.equal(compile.environment, undefined);
  assert.ok(!JSON.stringify(compile).includes('LOLLY_CATALOG_SIGNING_KEY'));
  for (const job of [workflow.jobs['source-catalog'], workflow.jobs['sign-artifact']]) {
    assert.equal(job.environment, 'release-catalog-signing');
    for (const step of job.steps) assert.doesNotMatch(step.run ?? '', /\b(?:npm|pnpm|cargo|vite|tauri|docker)\b/);
  }
  for (const job of [compile, workflow.jobs['sign-artifact']]) {
    const upload = job.steps.find((step: any) => step.uses?.startsWith('actions/upload-artifact'));
    assert.equal(upload.with['include-hidden-files'], true);
  }
  const final = workflow.jobs['sign-artifact'].steps;
  const delivery = final.findIndex((step: any) => step.run?.includes('build-delivery.ts'));
  const receipt = final.findIndex((step: any) => step.run?.includes('release-frontend-receipt.ts') && step.env?.LOLLY_CATALOG_SIGNING_KEY);
  assert.ok(delivery >= 0 && receipt > delivery);
  assert.equal(final[delivery].env?.LOLLY_CATALOG_SIGNING_KEY, undefined);
  const deployment = parse(readFileSync(join(repo, '.github/workflows/deployment-suse.yml'), 'utf8'));
  assert.ok(deployment.jobs['web-frontend'].needs.includes('source-qualification'));
  assert.ok(deployment.jobs['web-frontend'].needs.includes('web-release-gate'));
  assert.ok(!JSON.stringify(deployment.jobs['web-image']).includes('LOLLY_CATALOG_SIGNING_KEY'));
});
