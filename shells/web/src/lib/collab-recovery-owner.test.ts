// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-recovery-owner.ts: the one reader and writer of a recovery copy's owner tag.
 *
 * Run directly:  node --test shells/web/src/lib/collab-recovery-owner.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://work.test/#/tool/design' });
globalThis.location = dom.window.location as unknown as Location;

const {
  RECOVERY_OWNER_KEY, RECOVERY_SLOT_PREFIX, ownsRecoveryCopy, recoveryOrigin, recoveryOwner, recoveryOwnerTag, withoutRecoveryOwner,
} = await import('./collab-recovery-owner.ts');
const { _setBaseForTests } = await import('./instance.ts');

const AT = '2026-10-07T12:00:00.000Z';

test('the key and the slot prefix are the ones the recovery view writes', () => {
  assert.equal(RECOVERY_OWNER_KEY, '__collabRecovery');
  assert.equal(RECOVERY_SLOT_PREFIX, 'collab-recovery:');
});

test('recoveryOwner reads the tag, and only a well-formed one', () => {
  const tag = { origin: 'https://work.test', account: 'u1', at: AT };
  assert.deepEqual(recoveryOwner({ x: 1, [RECOVERY_OWNER_KEY]: tag }), tag);
  assert.equal(recoveryOwner({ __label: 'Canvas' }), null, 'an untagged copy belongs to nobody we can tell');
  assert.equal(recoveryOwner({ [RECOVERY_OWNER_KEY]: { origin: 'https://work.test', account: 'u1' } }), null, 'no time');
  assert.equal(recoveryOwner({ [RECOVERY_OWNER_KEY]: { origin: 'https://work.test', account: 'u1', at: 'soon' } }), null);
  assert.equal(recoveryOwner({ __workspace: 'https://work.test', __account: 'u1' }), null, 'tags this reader never wrote');
  assert.equal(recoveryOwner(null), null);
});

test('ownsRecoveryCopy matches the workspace (trailing slashes aside) and the account id', () => {
  const copy = { [RECOVERY_OWNER_KEY]: { origin: 'https://work.test/', account: 'u1', at: AT } };
  assert.equal(ownsRecoveryCopy(copy, 'https://work.test', 'u1'), true);
  assert.equal(ownsRecoveryCopy(copy, 'https://work.test//', 'u1'), true);
  assert.equal(ownsRecoveryCopy(copy, 'https://other.test', 'u1'), false);
  assert.equal(ownsRecoveryCopy(copy, 'https://work.test', 'u2'), false);
  assert.equal(ownsRecoveryCopy(copy, 'https://work.test', undefined), false, 'no member, no copies');
  const paired = { [RECOVERY_OWNER_KEY]: { origin: 'https://work.test', account: '', at: AT } };
  assert.equal(ownsRecoveryCopy(paired, 'https://work.test', ''), false, 'a private pairing\'s copy is no member\'s');
  assert.equal(recoveryOrigin(' https://work.test/sub/ '), 'https://work.test/sub');
});

test('recoveryOwnerTag uses the workspace base, else the page origin', () => {
  _setBaseForTests('');
  assert.deepEqual(recoveryOwnerTag('u1', new Date(AT)), { origin: 'https://work.test', account: 'u1', at: AT });
  _setBaseForTests('https://lolly.example/team');
  assert.deepEqual(recoveryOwnerTag('u1', new Date(AT)), { origin: 'https://lolly.example/team', account: 'u1', at: AT });
  _setBaseForTests('');
  const copy = { headline: 'Hi', [RECOVERY_OWNER_KEY]: recoveryOwnerTag('u1') };
  assert.equal(ownsRecoveryCopy(copy, location.origin, 'u1'), true, 'a copy written now is found by the same member');
});

test('withoutRecoveryOwner drops the tag and keeps the work', () => {
  assert.deepEqual(withoutRecoveryOwner({ headline: 'Hi', __label: 'Canvas', [RECOVERY_OWNER_KEY]: { origin: 'x', account: 'y', at: AT } }), { headline: 'Hi', __label: 'Canvas' });
});
