// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import type { EnrollmentTrustBundle } from '../../../../engine/src/enrollment.ts';
import { configuredVerifyOptions } from './valid-verification.ts';

const trust: EnrollmentTrustBundle = {
  version: 1, roots: [new Uint8Array([1])],
  issuers: new Map([['available', new Uint8Array([2])], ['unavailable', new Uint8Array([3])]]),
  providers: {}, defaultLifetimeSeconds: 3600, maxLifetimeSeconds: 7200,
  crlMaxAgeSeconds: 1800, unifiedCrl: false,
};

test('verification retains managed trust when a status read fails and retries next time', async () => {
  const manifest = new Uint8Array([4]);
  const calls: string[] = [];
  const crl = new Uint8Array([5]);
  const read = async (issuer: string, received: EnrollmentTrustBundle): Promise<Uint8Array> => {
    calls.push(issuer);
    assert.equal(received, trust);
    if (issuer === 'unavailable') throw new Error('status unavailable');
    return crl;
  };
  const options = await configuredVerifyOptions(manifest, trust, read);
  assert.equal(options.enrollmentTrust, trust, 'failure cannot fall back to unmanaged identity trust');
  assert.deepEqual(options.enrollmentCrls, { available: crl });
  assert.equal(options.externalManifest, manifest);
  assert.equal(options.trustAnchors!.at(-1), trust.roots[0]);
  await configuredVerifyOptions(undefined, trust, read);
  assert.deepEqual(calls, ['available', 'unavailable', 'available', 'unavailable']);
});

test('unmanaged verification keeps public roots without fetching status or inventing a manifest', async () => {
  const options = await configuredVerifyOptions(undefined, null, async () => { throw new Error('must not fetch'); });
  assert.ok(options.trustAnchors!.length > 0);
  assert.equal('enrollmentTrust' in options, false);
  assert.equal('enrollmentCrls' in options, false);
  assert.equal('externalManifest' in options, false);
});
