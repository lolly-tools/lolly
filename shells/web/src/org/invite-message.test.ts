// SPDX-License-Identifier: MPL-2.0
/**
 * org/invite-message.ts - the message a manager copies to send with an invite link
 * (plans/75 J4 step 3): who invited whom to what, the link on its own line, which
 * address and sign-ins to use, the password line, the end day and the workspace's
 * note; a share leaves out the sign-in, password and end lines.
 *
 * Run directly:  node --test shells/web/src/org/invite-message.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { inviteMessage, orList } = await import('./invite-message.ts');

// The end day in this machine's time zone, the way the message gives the day.
const ENDS = `This invitation ends on ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(Date.parse('2026-11-02T12:00:00Z'))}.`;

const BASE = {
  inviter: 'Andy',
  workspace: 'lolly.ing',
  project: 'Summit deck',
  role: 'editor' as const,
  email: 'sam@suse.com',
  link: 'https://lolly.ing/l/invite/abc.def',
  providers: ['Google', 'GitHub'],
  expiresAt: '2026-11-02T12:00:00Z',
  lang: 'en',
};

test('a project invitation: every line, in order', () => {
  assert.equal(inviteMessage({ ...BASE, kind: 'invited', note: 'If your organisation blocks Google sign-in (for example @suse.com), use GitHub or email and password.' }), [
    'Andy invited you to Summit deck on lolly.ing. Your role: Editor.',
    'https://lolly.ing/l/invite/abc.def',
    'Sign in as sam@suse.com with Google or GitHub.',
    ENDS,
    'If your organisation blocks Google sign-in (for example @suse.com), use GitHub or email and password.',
  ].join('\n'));
});

test('a link that sets a password says so, before the end day', () => {
  const lines = inviteMessage({ ...BASE, kind: 'invited', passwordSetup: true }).split('\n');
  assert.deepEqual(lines.slice(2), [
    'Sign in as sam@suse.com with Google or GitHub.',
    'Open the link to set your password.',
    ENDS,
  ]);
});

test('a share leaves out the sign-in, password and end lines, and keeps the note', () => {
  assert.equal(inviteMessage({ ...BASE, kind: 'shared', passwordSetup: true, note: 'Hello from the team.' }), [
    'Andy shared Summit deck with you on lolly.ing. Your role: Editor.',
    'https://lolly.ing/l/invite/abc.def',
    'Hello from the team.',
  ].join('\n'));
});

test('without a project, the workspace alone; without sign-ins or a date, those lines are left out', () => {
  assert.equal(inviteMessage({ ...BASE, project: undefined, providers: [], expiresAt: undefined, kind: 'invited' }), [
    'Andy invited you to lolly.ing.',
    'https://lolly.ing/l/invite/abc.def',
  ].join('\n'));
  assert.equal(inviteMessage({ ...BASE, project: '  ', role: undefined, providers: [' ', ''], expiresAt: 'soon', kind: 'invited', note: '  ' }).split('\n').length, 2);
});

test('the sign-ins are joined as the language joins "or"', () => {
  assert.equal(orList(['Google'], 'en'), 'Google');
  assert.equal(orList(['Google', 'GitHub', 'Email and password'], 'en'), 'Google, GitHub, or Email and password');
  assert.equal(orList(['Google', 'GitHub'], 'de'), 'Google oder GitHub');
  assert.equal(inviteMessage({ ...BASE, kind: 'invited', lang: 'de' }).split('\n')[2], 'Sign in as sam@suse.com with Google oder GitHub.');
});

test('names and notes go in as text: nothing in them is read as markup or a placeholder', () => {
  const text = inviteMessage({ ...BASE, inviter: '<b>Eve</b>', project: '{workspace}', kind: 'invited', note: '<script>x</script>' });
  assert.match(text, /^<b>Eve<\/b> invited you to \{workspace\} on lolly\.ing\./);
  assert.ok(text.endsWith('<script>x</script>'));
  assert.doesNotMatch(text, /&lt;|&amp;/, 'plain text: never escaped for HTML');
});
