// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const chart = fileURLToPath(new URL('../deploy/helm/', import.meta.url));
const lean = `${chart}profiles/lean.yaml`;
const components = ['web', 'mcp', 'ca'] as const;
type Component = (typeof components)[number];
const helmAvailable = spawnSync('helm', ['version', '--short']).status === 0;
const yamlAvailable = spawnSync('python3', ['-c', 'import yaml']).status === 0;
const skip = !helmAvailable
  ? 'Helm is required to exercise rendered deployments'
  : !yamlAvailable
    ? 'Python with PyYAML is required to inspect rendered deployments'
    : false;
const allEnabled = {
  web: {},
  mcp: { enabled: true },
  ca: { enabled: true, existingSecret: 'fixture-ca' },
};

interface Container {
  image: string;
  resources: {
    requests: Record<string, string>;
    limits: Record<string, string>;
  };
  securityContext: Record<string, unknown>;
  env?: { name: string; value?: string; valueFrom?: Record<string, unknown> }[];
  envFrom?: Record<string, unknown>[];
  volumeMounts: { name: string; mountPath: string }[];
}

interface Pod {
  imagePullSecrets?: { name: string }[];
  automountServiceAccountToken: boolean;
  securityContext: Record<string, unknown>;
  containers: Container[];
  volumes: { name: string; emptyDir: Record<string, string> }[];
}

interface Resource {
  kind: string;
  metadata: { labels?: Record<string, string> };
  spec: { replicas: number; template: { spec: Pod } };
}

function template(values: Record<string, unknown> = {}, profile?: string) {
  const args = ['template', 'fixture', chart];
  if (profile) args.push('--values', profile);
  args.push('--values', '-');
  return spawnSync('helm', args, {
    input: JSON.stringify(values),
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

function render(values: Record<string, unknown> = {}, profile?: string): Resource[] {
  const result = template(values, profile);
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const parsed = spawnSync(
    'python3',
    ['-c', 'import json,sys,yaml; print(json.dumps(list(yaml.safe_load_all(sys.stdin))))'],
    { input: result.stdout, encoding: 'utf8', timeout: 10_000 }
  );
  assert.equal(parsed.status, 0, parsed.stderr || String(parsed.error));
  return JSON.parse(parsed.stdout).filter(Boolean) as Resource[];
}

function deployment(resources: Resource[], component: Component) {
  const resource = resources.find(
    (item) =>
      item.kind === 'Deployment' &&
      item.metadata.labels?.['app.kubernetes.io/component'] === component
  );
  assert.ok(resource, `missing ${component} deployment`);
  return resource.spec;
}

test('public chart keeps default replicas, tags, volumes and backend opt-in', { skip }, () => {
  const defaultResources = render();
  assert.equal(defaultResources.filter((item) => item.kind === 'Deployment').length, 1);
  assert.equal(deployment(defaultResources, 'web').replicas, 2);
  const enabled = render(allEnabled);
  for (const component of components) {
    const spec = deployment(enabled, component);
    assert.equal(spec.replicas, 2);
    assert.equal(
      spec.template.spec.containers[0].image,
      `ghcr.io/lolly-tools/lolly-${component}:0.1.0`
    );
    for (const volume of spec.template.spec.volumes) assert.deepEqual(volume.emptyDir, {});
    assert.equal(
      spec.template.spec.containers[0].resources.requests['ephemeral-storage'],
      undefined
    );
  }
});

for (const component of components) {
  test(`${component} renders an immutable digest instead of the configured tag`, { skip }, () => {
    const digest = `sha256:${'ab'.repeat(32)}`;
    const resources = render({
      ...allEnabled,
      [component]: {
        ...allEnabled[component],
        image: { repository: `registry.example.com/lolly-${component}`, tag: 'ignored', digest },
      },
    });
    assert.equal(
      deployment(resources, component).template.spec.containers[0].image,
      `registry.example.com/lolly-${component}@${digest}`
    );
    const tagged = render({
      ...allEnabled,
      [component]: {
        ...allEnabled[component],
        image: { tag: 'release-20261006', digest: '' },
      },
    });
    assert.equal(
      deployment(tagged, component).template.spec.containers[0].image,
      `ghcr.io/lolly-tools/lolly-${component}:release-20261006`
    );
  });

  test(`${component} refuses malformed and non-string digests before deployment`, { skip }, () => {
    const invalid = [
      'latest',
      `sha256:${'ab'.repeat(31)}`,
      `sha256:${'AB'.repeat(32)}`,
      `sha512:${'ab'.repeat(32)}`,
      `sha256:${'ab'.repeat(32)}\n`,
      false,
      0,
      null,
      ['sha256'],
    ];
    for (const digest of invalid) {
      const result = template({
        ...allEnabled,
        [component]: {
          ...allEnabled[component],
          image: { digest },
        },
      });
      assert.notEqual(result.status, 0, `accepted ${JSON.stringify(digest)}`);
      assert.match(result.stderr, /image\.digest/);
    }
    const result = template({
      ...allEnabled,
      [component]: {
        ...allEnabled[component],
        image: {
          repository: 'registry.example.com/lolly@old',
          digest: `sha256:${'ab'.repeat(32)}`,
        },
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /image\.repository/);
  });
}

test('lean profile reserves bounded resources without enabling backend services', { skip }, () => {
  assert.equal(render({}, lean).filter((item) => item.kind === 'Deployment').length, 1);
  const resources = render(allEnabled, lean);
  const expected = {
    web: {
      requests: { cpu: '25m', memory: '32Mi', 'ephemeral-storage': '64Mi' },
      limits: { cpu: '250m', memory: '128Mi', 'ephemeral-storage': '256Mi' },
    },
    mcp: {
      requests: { cpu: '50m', memory: '128Mi', 'ephemeral-storage': '128Mi' },
      limits: { cpu: '1', memory: '512Mi', 'ephemeral-storage': '1Gi' },
    },
    ca: {
      requests: { cpu: '25m', memory: '64Mi', 'ephemeral-storage': '32Mi' },
      limits: { cpu: '250m', memory: '256Mi', 'ephemeral-storage': '128Mi' },
    },
  };
  for (const component of components) {
    const spec = deployment(resources, component);
    assert.equal(spec.replicas, 1);
    assert.deepEqual(spec.template.spec.containers[0].resources, expected[component]);
    const expectedSizes =
      component === 'mcp' ? ['512Mi'] : component === 'web' ? ['64Mi', '64Mi'] : ['64Mi'];
    assert.deepEqual(
      spec.template.spec.volumes.map((volume) => volume.emptyDir.sizeLimit),
      expectedSizes
    );
    assert.ok(spec.template.spec.volumes.every((volume) => volume.emptyDir.medium === undefined));
  }
});

test('every component can bound scratch volumes and refuses invalid storage quantities', {
  skip,
}, () => {
  const resources = render({
    web: { tmp: { sizeLimit: '128Mi' }, cache: { sizeLimit: '32M' } },
    mcp: { enabled: true, tmp: { sizeLimit: '1Gi' } },
    ca: { enabled: true, existingSecret: 'fixture-ca', tmp: { sizeLimit: '4096' } },
  });
  assert.deepEqual(
    deployment(resources, 'web').template.spec.volumes.map((v) => v.emptyDir),
    [{ sizeLimit: '32M' }, { sizeLimit: '128Mi' }]
  );
  assert.deepEqual(deployment(resources, 'mcp').template.spec.volumes[0].emptyDir, {
    sizeLimit: '1Gi',
  });
  assert.deepEqual(deployment(resources, 'ca').template.spec.volumes[0].emptyDir, {
    sizeLimit: '4096',
  });
  for (const component of components) {
    for (const sizeLimit of ['0', '-1Gi', '128m', '1.5Gi', false, 0]) {
      const result = template({
        ...allEnabled,
        [component]: {
          ...allEnabled[component],
          tmp: { sizeLimit },
        },
      });
      assert.notEqual(result.status, 0, `${component} accepted ${JSON.stringify(sizeLimit)}`);
      assert.match(result.stderr, /tmp\/cache\.sizeLimit/);
    }
  }
});

test('registry pull secrets and runtime security survive the lean profile', { skip }, () => {
  const resources = render(
    {
      ...allEnabled,
      imagePullSecrets: [{ name: 'application-registry' }],
      mcp: {
        enabled: true,
        extraEnvFrom: [{ secretRef: { name: 'mcp-provider-config' } }],
      },
    },
    lean
  );
  for (const component of components) {
    const pod = deployment(resources, component).template.spec;
    assert.deepEqual(pod.imagePullSecrets, [{ name: 'application-registry' }]);
    assert.equal(pod.automountServiceAccountToken, false);
    assert.deepEqual(pod.securityContext, {
      runAsNonRoot: true,
      seccompProfile: { type: 'RuntimeDefault' },
    });
    assert.deepEqual(pod.containers[0].securityContext, {
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      capabilities: { drop: ['ALL'] },
    });
  }
  assert.deepEqual(deployment(resources, 'mcp').template.spec.containers[0].envFrom, [
    { secretRef: { name: 'mcp-provider-config' } },
  ]);
  const caEnv = deployment(resources, 'ca').template.spec.containers[0].env ?? [];
  for (const key of ['CA_SERVICE_SECRET', 'CA_ROOT_KEY_PEM', 'CA_ROOT_CERT_PEM']) {
    assert.deepEqual(caEnv.find((item) => item.name === key)?.valueFrom, {
      secretKeyRef: { name: 'fixture-ca', key },
    });
  }
  assert.equal(
    resources.some((item) => item.kind === 'Secret'),
    false
  );
});

test('packaged chart contains the lean profile', { skip }, () => {
  const directory = mkdtempSync(`${tmpdir()}/lolly-helm-profile-`);
  try {
    const packed = spawnSync('helm', ['package', chart, '--destination', directory], {
      encoding: 'utf8',
    });
    assert.equal(packed.status, 0, packed.stderr);
    const archives = readdirSync(directory).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1);
    const listed = spawnSync('tar', ['-tzf', `${directory}/${archives[0]}`], { encoding: 'utf8' });
    assert.equal(listed.status, 0, listed.stderr);
    assert.ok(listed.stdout.split('\n').includes('lolly/profiles/lean.yaml'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
