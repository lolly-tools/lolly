// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const chart = fileURLToPath(new URL('../deploy/helm/profiles/sovereign/', import.meta.url));
const fixture = JSON.parse(readFileSync(`${chart}fixture.values.json`, 'utf8'));
const names = ['web', 'mcp', 'ca', 'penpot', 'edge'] as const;
const digest = `sha256:${'01'.repeat(32)}`;
for (const [tool, args] of [
  ['helm', ['version', '--short']],
  ['python3', ['-c', 'import yaml']],
  ['caddy', ['version']],
] as const) {
  const result = spawnSync(tool, [...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${tool} is required for this explicit integration lane`);
}

interface Container {
  name: string;
  image: string;
  securityContext: Record<string, unknown>;
  resources: { requests: Record<string, string>; limits: Record<string, string> };
  env?: { name: string; value: string }[];
  envFrom?: { secretRef: { name: string } }[];
  volumeMounts: { name: string; mountPath: string; readOnly?: boolean; subPath?: string }[];
}
interface Pod {
  nodeName?: string;
  hostNetwork?: boolean;
  dnsPolicy?: string;
  automountServiceAccountToken: boolean;
  securityContext: Record<string, unknown>;
  imagePullSecrets?: { name: string }[];
  containers: Container[];
  volumes: {
    name: string;
    emptyDir?: { sizeLimit: string };
    persistentVolumeClaim?: { claimName: string; readOnly: boolean };
    secret?: { secretName: string };
  }[];
}
interface Resource {
  kind: string;
  metadata: { name: string; namespace?: string; labels?: Record<string, string> };
  data?: Record<string, string>;
  spec: {
    replicas: number;
    strategy: { type: string };
    template: { metadata: { annotations: Record<string, string> }; spec: Pod };
    type: string;
    ports: { port: number }[];
    ingress: { from: { ipBlock: { cidr: string } }[] }[];
    matchConstraints: { resourceRules: { resources: string[] }[] };
    validations: { expression: string; message: string }[];
    matchResources: { namespaceSelector: { matchLabels: Record<string, string> } };
    validationActions: string[];
  };
}
function values() {
  return structuredClone(fixture);
}
function template(input = values()) {
  return spawnSync(
    'helm',
    ['template', 'fixture', chart, '--namespace', 'lolly-public', '-f', '-'],
    {
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 2 * 1024 * 1024,
    }
  );
}
function render(input = values()): Resource[] {
  const result = template(input);
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const parsed = spawnSync(
    'python3',
    ['-c', 'import json,sys,yaml; print(json.dumps(list(yaml.safe_load_all(sys.stdin))))'],
    { input: result.stdout, encoding: 'utf8', timeout: 10_000 }
  );
  assert.equal(parsed.status, 0, parsed.stderr);
  return JSON.parse(parsed.stdout).filter(Boolean) as Resource[];
}
function deployment(resources: Resource[], component: string) {
  const resource = resources.find(
    (r) =>
      r.kind === 'Deployment' && r.metadata.labels?.['app.kubernetes.io/component'] === component
  );
  assert.ok(resource, `missing ${component}`);
  return resource;
}
function container(pod: Pod) {
  assert.equal(pod.containers.length, 1);
  const first = pod.containers[0];
  assert.ok(first);
  return first;
}
function env(c: Container) {
  return Object.fromEntries((c.env ?? []).map((item) => [item.name, item.value]));
}
function refuses(input: typeof fixture, message: RegExp) {
  const result = template(input);
  assert.notEqual(result.status, 0, 'accepted an unsafe or incomplete configuration');
  assert.match(result.stderr, message);
}

test('sovereign chart refuses unconfigured deployment and requires reviewed exact inputs', () => {
  refuses({}, /host|digest|Acknowledged|proxyAddresses/);
  for (const address of ['10.42.0.0/16', '*', 'proxy.example', '256.1.1.1', '01.2.3.4']) {
    const input = values();
    input.edge.proxyAddresses = [address];
    refuses(input, /proxyAddresses|IPv4/);
  }
  for (const host of [
    'https://public.example',
    'public.example/path',
    'public.example:443',
    '*.example',
  ]) {
    const input = values();
    input.public.host = host;
    refuses(input, /host/);
  }
  const same = values();
  same.private.host = same.public.host;
  refuses(same, /must be distinct/);
  const redirect = values();
  redirect.private.redirectHosts = [redirect.public.host];
  refuses(redirect, /must be unique/);
  const secret = values();
  secret.components.ca.existingSecret = secret.components.mcp.existingSecret;
  refuses(secret, /different existingSecret/);
  const acknowledged = values();
  acknowledged.edge.hostNetworkAcknowledged = false;
  refuses(acknowledged, /hostNetworkAcknowledged/);
});

test('four public services and one edge have single ownership and bounded storage/resources', () => {
  const resources = render();
  assert.equal(resources.filter((r) => r.kind === 'Deployment').length, 5);
  assert.equal(resources.filter((r) => r.kind === 'Service').length, 4);
  assert.equal(
    resources.some((r) => r.kind === 'Secret' || r.kind === 'PersistentVolumeClaim'),
    false
  );
  let memory = 0;
  for (const name of names) {
    const deploymentResource = deployment(resources, name);
    assert.equal(deploymentResource.spec.replicas, 1);
    assert.equal(deploymentResource.spec.strategy.type, 'Recreate');
    const pod = deploymentResource.spec.template.spec;
    const c = container(pod);
    assert.equal(pod.automountServiceAccountToken, false);
    assert.deepEqual(pod.securityContext.seccompProfile, { type: 'RuntimeDefault' });
    assert.equal(c.securityContext.allowPrivilegeEscalation, false);
    assert.equal(c.securityContext.readOnlyRootFilesystem, true);
    assert.deepEqual(
      c.securityContext.capabilities,
      name === 'edge' ? { drop: ['ALL'], add: ['NET_BIND_SERVICE'] } : { drop: ['ALL'] }
    );
    for (const reservation of [c.resources.requests, c.resources.limits]) {
      for (const key of ['cpu', 'memory', 'ephemeral-storage']) assert.ok(reservation[key]);
    }
    memory += Number.parseInt(c.resources.limits.memory ?? '', 10);
    assert.ok(pod.volumes.find((v) => v.name === 'tmp')?.emptyDir?.sizeLimit);
    if (name !== 'edge') assert.equal(pod.hostNetwork, undefined);
  }
  assert.equal(memory, 1600);
  for (const service of resources.filter((r) => r.kind === 'Service')) {
    assert.equal(service.spec.type, 'ClusterIP');
    assert.deepEqual(
      service.spec.ports.map((p) => p.port),
      [80]
    );
  }
});

test('MCP and CA receive separate secrets with explicit production/auth/limiter controls', () => {
  const resources = render();
  const mcp = container(deployment(resources, 'mcp').spec.template.spec);
  const ca = container(deployment(resources, 'ca').spec.template.spec);
  assert.deepEqual(mcp.envFrom, [{ secretRef: { name: 'mcp-fixture' } }]);
  assert.deepEqual(ca.envFrom, [{ secretRef: { name: 'ca-fixture' } }]);
  assert.equal(env(mcp).LOLLY_MCP_PUBLIC_ORIGIN, 'https://public.example');
  assert.equal(
    env(mcp).LOLLY_MCP_ALLOWED_ORIGINS,
    'https://public.example,https://private.example'
  );
  assert.equal(env(mcp).LOLLY_LIVE_ORIGINS, 'https://public.example');
  for (const flag of [
    'LOLLY_MCP_ALLOW_ANONYMOUS',
    'LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT',
    'LOLLY_MCP_PRIVATE_FILES',
  ]) {
    assert.equal(env(mcp)[flag], '0');
  }
  assert.equal(env(mcp).LOLLY_WEB_BASE, '');
  assert.equal(env(mcp).LOLLY_MCP_TRUSTED_PROXIES, '192.0.2.10,::ffff:192.0.2.10');
  assert.equal(env(ca).CA_TRUSTED_PROXIES, env(mcp).LOLLY_MCP_TRUSTED_PROXIES);
  assert.equal(env(ca).CA_ALLOW_IN_MEMORY_RATE_LIMIT, '0');
  assert.equal(env(ca).CA_DEV_FAKE_PROVIDER, '0');
  for (const name of ['web', 'penpot', 'edge']) {
    assert.equal(container(deployment(resources, name).spec.template.spec).envFrom, undefined);
  }
});

test('models use the verified existing PVC read-only with no new HTTP service', () => {
  const input = values();
  input.models.subPath = 'release/current';
  const resources = render(input);
  const web = deployment(resources, 'web').spec.template;
  assert.equal(web.metadata.annotations['lolly.tools/models-release'], input.models.release);
  assert.deepEqual(web.spec.volumes.find((v) => v.name === 'models')?.persistentVolumeClaim, {
    claimName: 'models-fixture',
    readOnly: true,
  });
  assert.deepEqual(
    container(web.spec).volumeMounts.find((m) => m.name === 'models'),
    {
      name: 'models',
      mountPath: '/usr/share/nginx/html/models',
      readOnly: true,
      subPath: 'release/current',
    }
  );
  for (const subPath of ['..', '/absolute', 'release/../other', 'release//other']) {
    const invalid = values();
    invalid.models.subPath = subPath;
    refuses(invalid, /subPath/);
  }
});

test('all images are immutable and registry credentials apply to both namespaces', () => {
  const input = values();
  input.imagePullSecrets = [{ name: 'registry-fixture' }];
  const resources = render(input);
  for (const name of names) {
    const c = container(deployment(resources, name).spec.template.spec);
    assert.equal(c.image.endsWith(`@${digest}`), true);
    assert.deepEqual(deployment(resources, name).spec.template.spec.imagePullSecrets, [
      { name: 'registry-fixture' },
    ]);
    for (const bad of ['', 'latest', `sha256:${'AB'.repeat(32)}`, false]) {
      const invalid = values();
      (name === 'edge' ? invalid.edge : invalid.components[name]).image.digest = bad;
      refuses(invalid, /digest/);
    }
  }
});

test('scratch volumes reject unbounded or CPU-like quantities', () => {
  for (const name of names) {
    for (const tmpSize of ['', '0', '-1Gi', '128m', '1.5Gi', false]) {
      const invalid = values();
      (name === 'edge' ? invalid.edge : invalid.components[name]).tmpSize = tmpSize;
      refuses(invalid, /tmpSize/);
    }
  }
});

test('edge policy scopes a fail-closed constrained host-network exception', () => {
  const resources = render();
  const edge = deployment(resources, 'edge');
  const pod = edge.spec.template.spec;
  assert.equal(edge.metadata.namespace, 'lolly-edge');
  assert.equal(pod.hostNetwork, true);
  assert.equal(pod.nodeName, 'fixture-node');
  assert.equal(pod.dnsPolicy, 'ClusterFirstWithHostNet');
  assert.deepEqual(
    pod.volumes.flatMap((v) => (v.secret ? [v.secret.secretName] : [])),
    ['public-tls', 'private-tls']
  );
  const policy = resources.find((r) => r.kind === 'ValidatingAdmissionPolicy');
  const binding = resources.find((r) => r.kind === 'ValidatingAdmissionPolicyBinding');
  assert.ok(policy);
  assert.ok(binding);
  assert.deepEqual(binding.spec.validationActions, ['Deny']);
  assert.deepEqual(binding.spec.matchResources.namespaceSelector.matchLabels, {
    'kubernetes.io/metadata.name': 'lolly-edge',
  });
  assert.ok(
    policy.spec.matchConstraints.resourceRules.some((rule) =>
      rule.resources.includes('pods/ephemeralcontainers')
    )
  );
  const expressions = policy.spec.validations.map((v) => v.expression).join('\n');
  for (const boundary of [
    'hostNetwork',
    'fixture-node',
    'NET_BIND_SERVICE',
    'RuntimeDefault',
    'automountServiceAccountToken',
    'ephemeralContainers',
    'dyn(c.resources).requests',
    'dyn(v.emptyDir).sizeLimit',
    'p.hostPort == p.containerPort',
    'volumeMounts',
    digest,
  ]) {
    assert.ok(expressions.includes(boundary), boundary);
  }
  for (const network of resources.filter((r) => r.kind === 'NetworkPolicy')) {
    assert.deepEqual(
      network.spec.ingress.flatMap((i) => i.from.map((peer) => peer.ipBlock.cidr)),
      ['192.0.2.10/32']
    );
  }
});

test('mapped-only proxy measurements still restrict ingress to the exact IPv4 peer', () => {
  const input = values();
  input.edge.proxyAddresses = ['::ffff:192.0.2.10'];
  for (const network of render(input).filter((r) => r.kind === 'NetworkPolicy')) {
    assert.deepEqual(
      network.spec.ingress.flatMap((i) => i.from.map((peer) => peer.ipBlock.cidr)),
      ['192.0.2.10/32']
    );
  }
});

function adapt(resources: Resource[]) {
  const directory = mkdtempSync(join(tmpdir(), 'lolly-sovereign-caddy-'));
  try {
    for (const resource of resources.filter(
      (r) => r.kind === 'ConfigMap' && r.metadata.namespace === 'lolly-edge'
    )) {
      for (const [name, contents] of Object.entries(resource.data ?? {})) {
        writeFileSync(join(directory, name), contents.replaceAll('/etc/lolly/', `${directory}/`));
      }
    }
    const result = spawnSync(
      'caddy',
      ['adapt', '--config', join(directory, 'Caddyfile'), '--adapter', 'caddyfile'],
      {
        env: {
          ...process.env,
          LOLLY_PUBLIC_HOST: 'public.example',
          LOLLY_PRIVATE_HOST: 'private.example',
          LOLLY_PUBLIC_REDIRECT_HOSTS: 'www.public.example',
          LOLLY_PRIVATE_REDIRECT_HOSTS: 'www.private.example',
        },
        encoding: 'utf8',
        timeout: 10_000,
      }
    );
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('actual Caddy accepts combined host routes with explicit outgoing socket binding', () => {
  const config = adapt(render());
  const configText = JSON.stringify(config);
  for (const service of ['mcp', 'ca', 'penpot', 'web']) {
    assert.ok(configText.includes(`fixture-${service}.lolly-public.svc.cluster.local:80`));
  }
  assert.ok(configText.includes('lolly-work.lolly-private.svc.cluster.local:80'));
  assert.ok(configText.includes('lolly-live-relay.lolly-private.svc.cluster.local:8790'));
  assert.ok(configText.includes('"local_address":"192.0.2.10"'));
  assert.ok(configText.includes('/live/editor'));
  assert.ok(configText.includes('/api/fetch-image'));
  assert.ok(configText.includes('/api/penpot/rpc/import-binfile'));
  assert.ok(configText.includes('public.example'));
  assert.ok(configText.includes('private.example'));
  assert.doesNotMatch(configText, /127\.0\.0\.1:8790|https:\/\/lolly\.tools/);
});

test('automatic ACME persists certificates in the edge PVC and needs no renewal service', () => {
  const input = values();
  input.edge.tls = { mode: 'acme', email: 'team@example.com', existingClaim: 'caddy-data' };
  input.public.tlsSecret = '';
  input.private.tlsSecret = '';
  const resources = render(input);
  const edge = deployment(resources, 'edge').spec.template.spec;
  assert.deepEqual(edge.volumes.find((v) => v.name === 'caddy-data')?.persistentVolumeClaim, {
    claimName: 'caddy-data',
  });
  assert.equal(
    edge.volumes.some((v) => v.secret),
    false
  );
  assert.deepEqual(
    container(edge).volumeMounts.find((m) => m.name === 'caddy-data'),
    { name: 'caddy-data', mountPath: '/data' }
  );
  assert.equal(env(container(edge)).XDG_DATA_HOME, '/data');
  assert.equal(resources.filter((r) => r.kind === 'Deployment').length, 5);
  const config = JSON.stringify(adapt(resources));
  assert.ok(config.includes('team@example.com'));
  assert.doesNotMatch(config, /\/tls\/public|\/tls\/private/);
  const invalid = values();
  invalid.edge.tls = { mode: 'acme' };
  refuses(invalid, /email|existingClaim/);
});

test('public anonymous and browser behavior need explicit reviewed configuration', () => {
  const input = values();
  input.components.mcp.allowAnonymous = true;
  input.components.mcp.webBase = 'https://public.example';
  const mcp = container(deployment(render(input), 'mcp').spec.template.spec);
  assert.equal(env(mcp).LOLLY_MCP_ALLOW_ANONYMOUS, '1');
  assert.equal(env(mcp).LOLLY_WEB_BASE, 'https://public.example');
  assert.equal(env(mcp).LOLLY_MCP_PRIVATE_FILES, '0');
  assert.equal(env(mcp).LOLLY_BROWSER_NO_SANDBOX, '0');
  assert.equal(env(mcp).LOLLY_BROWSER_MAX_CONCURRENCY, '1');
  assert.equal(env(mcp).LOLLY_BROWSER_MAX_QUEUE, '4');
  for (const base of [
    'http://public.example',
    'https://other.example',
    'https://public.example/path',
  ]) {
    const invalid = values();
    invalid.components.mcp.webBase = base;
    refuses(invalid, /webBase/);
  }
});

test('optional browser profile has bounded scratch and resources without extra privileges', () => {
  const parsed = spawnSync(
    'python3',
    ['-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin)))'],
    { input: readFileSync(`${chart}browser.values.yaml`, 'utf8'), encoding: 'utf8' }
  );
  assert.equal(parsed.status, 0, parsed.stderr);
  const input = values();
  const overlay = JSON.parse(parsed.stdout).components.mcp;
  Object.assign(input.components.mcp, overlay, {
    image: { ...input.components.mcp.image, ...overlay.image },
    webBase: 'https://public.example',
  });
  const pod = deployment(render(input), 'mcp').spec.template.spec;
  const mcp = container(pod);
  assert.equal(mcp.resources.requests.memory, '256Mi');
  assert.equal(mcp.resources.limits.memory, '2048Mi');
  assert.equal(mcp.resources.limits.cpu, '2');
  assert.equal(pod.volumes.find((volume) => volume.name === 'tmp')?.emptyDir?.sizeLimit, '512Mi');
  assert.equal(
    pod.securityContext.seccompProfile &&
      (pod.securityContext.seccompProfile as { type: string }).type,
    'RuntimeDefault'
  );
  assert.equal(mcp.securityContext.allowPrivilegeEscalation, false);
  assert.deepEqual(mcp.securityContext.capabilities, { drop: ['ALL'] });
  assert.equal(env(mcp).LOLLY_BROWSER_NO_SANDBOX, '0');
  assert.equal(env(mcp).LOLLY_MCP_ALLOW_ANONYMOUS, '0');
});
