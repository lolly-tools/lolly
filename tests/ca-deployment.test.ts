// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseAllDocuments } from 'yaml';

const root = new URL('../', import.meta.url).pathname;
const managed = { address: 'https://vault.example.test', mount: 'pki-device', auth: 'kubernetes', serviceAccountName: 'enrollment', kubernetesMount: 'kubernetes', kubernetesRole: 'enrollment', kubernetesAudience: 'vault-enrollment', trustJson: '{"version":1}', rolesJson: '{}', egress: [{ to: [{ ipBlock: { cidr: '192.0.2.10/32' } }], ports: [{ port: 443, protocol: 'TCP' }] }] };
function render(chart: string, values: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-ca-chart-'));
  try {
    writeFileSync(join(dir, 'values.json'), JSON.stringify(values));
    return spawnSync('helm', ['template', 'neutral', join(root, chart), '-f', join(dir, 'values.json')], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function inspect(result: ReturnType<typeof render>) {
  assert.equal(result.status, 0, result.stderr);
  return parseAllDocuments(result.stdout).filter(d => d.toJSON()).map(d => d.toJSON()) as any[];
}
for (const sovereign of [false, true]) {
  test(`${sovereign ? 'sovereign' : 'default'} managed CA manifest contains projected workload identity and restricted egress`, () => {
    const chart = sovereign ? 'deploy/helm/profiles/sovereign' : 'deploy/helm';
    const values = sovereign ? { ...JSON.parse(readFileSync(join(root, chart, 'fixture.values.json'), 'utf8')), components: { ...JSON.parse(readFileSync(join(root, chart, 'fixture.values.json'), 'utf8')).components, ca: { issuerMode: 'vault-pki', managed } } } : { ca: { enabled: true, existingSecret: 'enrollment-secrets', config: { issuerMode: 'vault-pki', managed } } };
    if (sovereign) {
      const original = JSON.parse(readFileSync(join(root, chart, 'fixture.values.json'), 'utf8'));
      values.components.ca = { ...original.components.ca, issuerMode: 'vault-pki', managed };
    }
    const docs = inspect(render(chart, values));
    const deployment = docs.find(d => d.kind === 'Deployment' && d.spec.template.spec.containers[0].name === 'ca');
    assert.ok(deployment);
    const pod = deployment.spec.template.spec;
    assert.equal(pod.serviceAccountName, 'enrollment');
    const environment = pod.containers[0].env;
    assert.ok(!environment.some((e: any) => e.name.startsWith('CA_ROOT_')));
    assert.ok(!pod.containers[0].envFrom);
    assert.equal(environment.find((e: any) => e.name === 'CA_ISSUER_MODE').value, 'vault-pki');
    const jwt = pod.volumes.find((v: any) => v.name === 'vault-jwt');
    assert.equal(jwt.projected.sources[0].serviceAccountToken.audience, 'vault-enrollment');
    assert.equal(jwt.projected.sources[0].serviceAccountToken.expirationSeconds, 600);
    const policy = docs.find(d => d.kind === 'NetworkPolicy' && d.spec.policyTypes.includes('Egress') && d.spec.podSelector.matchLabels['app.kubernetes.io/component'] === 'ca');
    assert.deepEqual(policy.spec.egress, managed.egress);
    assert.ok(!JSON.stringify(docs).includes('CA_ROOT_KEY_PEM'));
    const refused = render(chart, sovereign ? { ...values, components: { ...values.components, ca: { ...values.components.ca, managed: { ...managed, egress: [] } } } } : { ca: { ...values.ca, config: { issuerMode: 'vault-pki', managed: { ...managed, egress: [] } } } });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /egress/);
  });
}

test('managed chart rejects legacy authority material and unconfigured workload values', () => {
  assert.notEqual(render('deploy/helm', { ca: { enabled: true, existingSecret: 'enrollment-secrets', secrets: { rootKeyPem: 'sample' }, config: { issuerMode: 'vault-pki', managed } } }).status, 0);
  assert.notEqual(render('deploy/helm', { ca: { enabled: true, existingSecret: 'enrollment-secrets', config: { issuerMode: 'vault-pki', managed: {} } } }).status, 0);
});

test('CA runtime image copies the small certificate dependency closure and imports its handler', () => {
  const docker = readFileSync(join(root, 'deploy/docker/ca.Dockerfile'), 'utf8');
  for (const source of ['x509.ts', 'x509-read.ts', 'enrollment.ts', 'bytes.ts', 'der-read.ts']) assert.ok(docker.includes(`engine/src/${source}`));
  assert.match(docker, /await import\('\.\/services\/ca\/handler\.mjs'\)/);
  assert.ok(!docker.includes('COPY engine/src ./engine/src'));
});
