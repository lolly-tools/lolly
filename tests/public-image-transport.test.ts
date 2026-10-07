// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateConfig,
  validateRelease,
} from '../deploy/docker/export-qualified-public-images.ts';
const source = '01'.repeat(20);
const digest = `sha256:${'02'.repeat(32)}`;
const fixture = () => ({
  source,
  runId: '123',
  neutralProfile: true,
  images: Object.fromEntries(
    ['web', 'mcp-browser', 'ca', 'penpot'].map((name) => [
      name,
      {
        source,
        platform: 'linux/amd64',
        imageId: digest,
        digest: `ghcr.io/owner/lolly-${name}@${digest}`,
      },
    ])
  ),
});
const config = () => ({
  os: 'linux',
  architecture: 'amd64',
  config: {
    User: '1000',
    Labels: { 'org.opencontainers.image.revision': source, 'org.lolly.profile': 'lolly-start' },
    Env: ['NODE_ENV=production'],
  },
  rootfs: { type: 'layers', diff_ids: [digest] },
});
test('transport accepts only the complete source-bound public release', () => {
  validateRelease(fixture(), source, '123', 'owner');
  for (const change of [
    (f: ReturnType<typeof fixture>) => {
      f.source = '03'.repeat(20);
    },
    (f: ReturnType<typeof fixture>) => {
      f.neutralProfile = false;
    },
    (f: ReturnType<typeof fixture>) => {
      f.runId = '124';
    },
    (f: ReturnType<typeof fixture>) => {
      delete f.images.web;
    },
    (f: ReturnType<typeof fixture>) => {
      f.images.work = {
        source,
        platform: 'linux/amd64',
        imageId: digest,
        digest: `ghcr.io/owner/lolly-work@${digest}`,
      };
    },
  ]) {
    const f = fixture();
    change(f);
    assert.throws(() => validateRelease(f, source, '123', 'owner'));
  }
});
test('transport refuses substituted repository, moving tags and platform/source mismatches', () => {
  for (const replacement of [
    `ghcr.io/attacker/lolly-web@${digest}`,
    'ghcr.io/owner/lolly-web:latest',
    `ghcr.io/owner/lolly-work@${digest}`,
  ]) {
    const f = fixture();
    assert.ok(f.images.web);
    f.images.web.digest = replacement;
    assert.throws(() => validateRelease(f, source, '123', 'owner'));
  }
  for (const field of ['source', 'platform', 'imageId'] as const) {
    const f = fixture();
    assert.ok(f.images.web);
    f.images.web[field] = 'wrong';
    assert.throws(() => validateRelease(f, source, '123', 'owner'));
  }
});
test('transport verifies nonroot neutral configs and rejects credential-bearing image environments', () => {
  validateConfig(config(), source);
  for (const key of [
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'LOLLY_CATALOG_SIGNING_KEY',
    'CA_ROOT_KEY_PEM',
    'CA_SERVICE_SECRET',
    'LOLLY_MCP_TOKEN',
  ]) {
    const f = config();
    f.config.Env.push(`${key}=synthetic`);
    assert.throws(() => validateConfig(f, source));
  }
  for (const user of ['', 'root', '0', '0:0']) {
    const f = config();
    f.config.User = user;
    assert.throws(() => validateConfig(f, source));
  }
  const wrong = config();
  wrong.config.Labels['org.lolly.profile'] = 'private';
  assert.throws(() => validateConfig(wrong, source));
});
