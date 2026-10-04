// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-access.ts - the pure decisions behind "People with access" (plan 74 scope
 * change): the invite policy read from org-config, who sees the People panel and how
 * much of it, which save a team document offers by project role, the "Edited by"
 * line, and reading several addresses out of one field.
 *
 * Also the plans/75 additions: the password tick's starting state, the lines under a
 * waiting invitation and an access request, and the sentences for answering one.
 *
 * Run directly:  node --test shells/web/src/org/team-access.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  invitePolicy, peopleAccess, teamSaveChoice, canWriteProject, isManagerPlus, activityLabel,
  parseInviteEmails, inviteLinkKind, inviteResultText, shownInviteStatus, waitingAddresses, peopleMessage, roleLabel, inviteRoleOf,
  sessionCountLabel, teamPickerEmpty, conflictCopy, longRelTime, passwordTickDefault, dayLabel, invitationLines,
  requestAskText, requestAskedText, requestAnsweredText, requestRefusalText, roleHelpText,
} = await import('./team-access.ts');

const NOW = Date.parse('2026-10-02T12:00:00Z');

test('invitePolicy: absent on an older instance, defaults filled in on a newer one', () => {
  assert.equal(invitePolicy(null), null);
  assert.equal(invitePolicy({ can: { 'user.invite': true } }), null, 'no invites block: no people UI');
  const quiet = { workspace: '', passwordSetup: false, passwordDomains: [], askToEdit: false };
  assert.deepEqual(invitePolicy({ can: { 'user.invite': true }, invites: {} }), {
    canInvite: true, domains: [], maxTtlHours: 720, projectRoles: ['viewer', 'editor', 'manager'], ...quiet,
  });
  assert.deepEqual(invitePolicy({ invites: { domains: [' Acme.com ', 'acme.com', 7, ''], maxTtlHours: 48, projectRoles: ['manager', 'owner', 'viewer'] } }), {
    canInvite: false, domains: ['acme.com'], maxTtlHours: 48, projectRoles: ['viewer', 'manager'], ...quiet,
  }, 'owner is never offered; order is fixed; bad entries dropped');
  assert.equal(invitePolicy({ invites: { maxTtlHours: -1 } })!.maxTtlHours, 720);
  assert.deepEqual(invitePolicy({ invites: { projectRoles: [] } })!.projectRoles, []);
});

test('roles: who manages, who writes', () => {
  assert.equal(isManagerPlus('owner'), true);
  assert.equal(isManagerPlus('manager'), true);
  assert.equal(isManagerPlus('editor'), false);
  assert.equal(isManagerPlus(undefined), false);
  assert.equal(canWriteProject('viewer'), false);
  assert.equal(canWriteProject('editor'), true);
  assert.equal(canWriteProject(undefined), true, 'unknown role: the server decides');
  assert.equal(inviteRoleOf('owner'), undefined);
  assert.equal(inviteRoleOf('editor'), 'editor');
  assert.equal(roleLabel('manager'), 'Manager');
});

test('peopleAccess: any member reads the list, owners and managers manage', () => {
  const inviter = invitePolicy({ can: { 'user.invite': true }, invites: {} });
  const noInvite = invitePolicy({ can: { 'user.invite': false }, invites: {} });
  assert.equal(peopleAccess('owner', null), 'hidden', 'older instance: nothing');
  assert.equal(peopleAccess('owner', noInvite), 'manage');
  assert.equal(peopleAccess('manager', noInvite), 'manage');
  // Seeing who shares a project is not tied to inviting new people to the instance.
  assert.equal(peopleAccess('editor', noInvite), 'read');
  assert.equal(peopleAccess('viewer', noInvite), 'read');
  assert.equal(peopleAccess('editor', inviter), 'read');
  assert.equal(peopleAccess('viewer', inviter), 'read');
  assert.equal(peopleAccess(undefined, inviter), 'hidden', 'role not known yet');
});

test('teamSaveChoice: viewers get a copy, editors save changes', () => {
  const all = { hasDocument: true, canEdit: true, canSave: true };
  assert.equal(teamSaveChoice('editor', all), 'save-changes');
  assert.equal(teamSaveChoice('owner', all), 'save-changes');
  assert.equal(teamSaveChoice(undefined, all), 'save-changes');
  assert.equal(teamSaveChoice('viewer', all), 'save-copy');
  assert.equal(teamSaveChoice('viewer', { ...all, canSave: false }), 'none');
  assert.equal(teamSaveChoice('editor', { ...all, canEdit: false }), 'save-copy');
  assert.equal(teamSaveChoice('editor', { ...all, hasDocument: false }), 'none');
});

test('activityLabel: name and time, time only, or nothing', () => {
  assert.equal(activityLabel({ updatedByName: 'Ana', updatedAt: '2026-10-02T09:00:00Z' }, NOW), 'Edited by Ana, 3h ago');
  assert.equal(activityLabel({ updatedAt: '2026-10-02T11:59:30Z' }, NOW), 'just now');
  assert.equal(activityLabel({ updatedByName: '  Ana ' }, NOW), 'Edited by Ana');
  assert.equal(activityLabel({ updatedByName: '', updatedAt: 'not a date' }, NOW), '');
  assert.equal(activityLabel({}, NOW), '');
});

test('parseInviteEmails: several separators, angle brackets, duplicates, mistakes', () => {
  assert.deepEqual(parseInviteEmails('ana@acme.com, bo@acme.com;cy@x.org\nANA@acme.com'), {
    emails: ['ana@acme.com', 'bo@acme.com', 'cy@x.org'], invalid: [],
  });
  assert.deepEqual(parseInviteEmails('Ana Lee <ana@acme.com> bo@'), { emails: ['ana@acme.com'], invalid: ['bo@'] });
  assert.deepEqual(parseInviteEmails('   '), { emails: [], invalid: [] });
  assert.deepEqual(parseInviteEmails('ana@localhost'), { emails: [], invalid: ['ana@localhost'] });
  assert.deepEqual(parseInviteEmails('ana@acme.com bo@acme.com'), { emails: ['ana@acme.com', 'bo@acme.com'], invalid: [] }, 'spaces separate addresses');
  assert.deepEqual(parseInviteEmails('"Lee, Ana" <ana@acme.com>, Bo <bo@acme.com>'), { emails: ['ana@acme.com', 'bo@acme.com'], invalid: [] });
});

test('parseInviteEmails: a word with no @ is reported, not dropped', () => {
  assert.deepEqual(parseInviteEmails('ana@acme.com, bob.acme.com'), { emails: ['ana@acme.com'], invalid: ['bob.acme.com'] });
  assert.deepEqual(parseInviteEmails('ana@acme.com bob'), { emails: ['ana@acme.com'], invalid: ['bob'] });
  // A display name without angle brackets is not an address either.
  assert.deepEqual(parseInviteEmails('Ana ana@acme.com'), { emails: ['ana@acme.com'], invalid: ['Ana'] });
});

test('inviteResultText: each refusal code gets a sentence, an unknown one never shows', () => {
  assert.equal(inviteResultText('added'), 'Added');
  assert.equal(inviteResultText('invited'), 'Invited');
  assert.equal(inviteResultText('already'), 'Already has access');
  assert.equal(inviteResultText('refused'), 'Not added');
  assert.equal(inviteResultText('refused', 'invalid-email'), 'Not added. That address is not valid.');
  assert.equal(inviteResultText('refused', 'account-disabled'), 'Not added. That account is turned off.');
  assert.equal(inviteResultText('refused', 'invites-not-allowed'), 'Not added. You can only add people who already use this instance.');
  assert.equal(inviteResultText('refused', 'domain-not-allowed', ['acme.com', 'acme.org']), 'Not added. Addresses must be at acme.com, acme.org.');
  assert.equal(inviteResultText('refused', 'domain-not-allowed'), 'Not added. That address is outside the allowed domains.');
  assert.match(inviteResultText('refused', 'invitation-accepted'), /already joined with another address/);
  assert.equal(inviteResultText('refused', 'invitation-changed'), 'Not added. Their invitation changed. Try again.');
  assert.equal(inviteResultText('refused', 'some-new-code'), 'Not added', 'an unknown code is not echoed');
  for (const code of ['invalid-email', 'invites-not-allowed', 'some-new-code']) {
    assert.ok(!inviteResultText('refused', code).includes(code));
  }
});

test('inviteResultText: the codes lolly-work added after the first list get their own sentence', () => {
  // `invitations-off`: the instance's sign-in reads no invitations, so a new address cannot join.
  assert.equal(inviteResultText('refused', 'invitations-off'), 'Not added. This instance does not take invitations for new people.');
  // `unavailable`: what a caller without user.invite gets instead of a code that would say an account exists.
  assert.equal(inviteResultText('refused', 'unavailable'), 'Not added. Ask an admin of this instance to add them.');
  for (const code of ['invitations-off', 'unavailable']) assert.notEqual(inviteResultText('refused', code), 'Not added');
});

test('peopleMessage reads the instance code where one status means several things', () => {
  assert.match(peopleMessage(429, 'invite'), /Try again later/);
  assert.equal(peopleMessage(409, 'invite', 'PROJECT_ARCHIVED'), 'This project is archived. Restore it before inviting people.');
  assert.equal(peopleMessage(409, 'invite'), 'This project is archived. Restore it before inviting people.', 'an invite only answers 409 for that');
  assert.equal(peopleMessage(403, 'change', 'ROLE_NOT_ALLOWED'), 'This instance does not give that role. Choose another role.');
  assert.equal(peopleMessage(403, 'invite', 'ROLE_NOT_ALLOWED'), 'This instance does not give that role. Choose another role.');
  assert.match(peopleMessage(403, 'change', 'FORBIDDEN'), /cannot change who has access/);
  assert.match(peopleMessage(409, 'change', 'PROJECT_OWNER'), /Could not make that change/);
});

test('peopleMessage says what happened', () => {
  assert.match(peopleMessage(403, 'load'), /do not have access/);
  assert.match(peopleMessage(403, 'change'), /cannot change who has access/);
  assert.match(peopleMessage(0, 'invite'), /could not be reached/);
  assert.match(peopleMessage(400, 'invite'), /Check the addresses/);
  assert.match(peopleMessage(404, 'load'), /no longer on this instance/);
  // A change that finds no member or invitation: the project itself is still there.
  assert.equal(peopleMessage(404, 'change'), 'That person or invitation has already changed.');
});

test('sessionCountLabel: one session, otherwise sessions', () => {
  assert.equal(sessionCountLabel(1), '1 session');
  assert.equal(sessionCountLabel(0), '0 sessions');
  assert.equal(sessionCountLabel(2), '2 sessions');
});

test('teamPickerEmpty: a creator is told to create a project, anyone else who can help', () => {
  assert.deepEqual(teamPickerEmpty({ listed: 0, canCreate: true }), {
    placeholder: 'No team projects yet', note: 'Create a project to save this document.', offerNew: true,
  });
  assert.deepEqual(teamPickerEmpty({ listed: 0, canCreate: false }), {
    placeholder: 'No team projects yet', note: 'Ask a teammate to add you to a project.', offerNew: false,
  });
  // Projects exist but every one is view-only: the line says so, the next step is the same.
  assert.deepEqual(teamPickerEmpty({ listed: 3, canCreate: true }), {
    placeholder: 'No projects you can save to', note: 'Create a project to save this document.', offerNew: true,
  });
  // A viewer in projects who cannot create one needs edit access, not another invitation.
  assert.equal(teamPickerEmpty({ listed: 3, canCreate: false }).note, 'Ask a project owner for edit access.');
});

test('conflictCopy: names who saved and when, and falls back without a name', () => {
  const ago = new Date(NOW - 2 * 60_000).toISOString();
  assert.deepEqual(conflictCopy({ updatedByName: 'Bea Teammate', updatedAt: ago }, false, NOW, 'en'), {
    title: 'Bea Teammate saved a newer version 2 minutes ago',
    message: 'Open their version, or save yours as a new copy in the same project.',
    open: 'Open theirs',
    copy: 'Save mine as a copy',
  });
  assert.equal(conflictCopy({ updatedByName: ' Bea ' }, false, NOW).title, 'Bea saved a newer version', 'no time: name only');
  assert.equal(conflictCopy({ updatedAt: ago }, false, NOW).title, 'Someone saved a newer version', 'no name: the old copy');
  assert.equal(conflictCopy({ updatedByName: '  ', updatedAt: ago }, false, NOW).title, 'Someone saved a newer version');
  assert.match(conflictCopy({ updatedByName: 'Bea', updatedAt: ago }, false, NOW).message, /^Open their version/);
  assert.equal(conflictCopy({ updatedByName: 'Bea', updatedAt: ago }, true, NOW).title, 'Check the version first', 'no revision: never claims who saved after');
});

test('conflictCopy: the reader\'s own save elsewhere is not a teammate\'s', () => {
  const ago = new Date(NOW - 2 * 60_000).toISOString();
  assert.deepEqual(conflictCopy({ updatedByName: 'Andy Owner', updatedAt: ago, updatedByYou: true }, false, NOW, 'en'), {
    title: 'You saved a newer version 2 minutes ago',
    message: 'That save came from another window or device. Open that version, or save this one as a new copy in the same project.',
    open: 'Open that version',
    copy: 'Save this as a copy',
  });
  assert.equal(conflictCopy({ updatedByName: 'Andy Owner', updatedByYou: true }, false, NOW).title, 'You saved a newer version');
  assert.equal(conflictCopy({ updatedByName: 'Andy Owner', updatedAt: ago, updatedByYou: false }, false, NOW, 'en').title, 'Andy Owner saved a newer version 2 minutes ago');
  // Without a revision there is still nothing to compare, whoever saved.
  assert.equal(conflictCopy({ updatedByYou: true }, true, NOW).title, 'Check the version first');
});

test('longRelTime: whole words for a sentence, from the locale\'s own data', () => {
  const at = (ms: number): string => new Date(NOW - ms).toISOString();
  assert.equal(longRelTime(at(20_000), NOW, 'en'), 'just now');
  assert.equal(longRelTime(at(40 * 60_000), NOW, 'en'), '40 minutes ago');
  assert.equal(longRelTime(at(60 * 60_000), NOW, 'en'), '1 hour ago');
  assert.equal(longRelTime(at(30 * 3_600_000), NOW, 'en'), 'yesterday');
  assert.equal(longRelTime(at(9 * 86_400_000), NOW, 'en'), 'last week');
  assert.equal(longRelTime(at(100 * 86_400_000), NOW, 'en'), '3 months ago');
  assert.equal(longRelTime(at(400 * 86_400_000), NOW, 'en'), 'last year');
  assert.equal(longRelTime(at(40 * 60_000), NOW, 'de'), 'vor 40 Minuten');
  assert.equal(longRelTime(undefined, NOW, 'en'), '');
  assert.equal(longRelTime('not a date', NOW, 'en'), '');
  // A future time (clock skew) reads as now, never as "in 5 minutes".
  assert.equal(longRelTime(new Date(NOW + 5 * 60_000).toISOString(), NOW, 'en'), 'just now');
});

test("inviteLinkKind: an 'already' address with an invitation waiting counts as invited", () => {
  const waiting = waitingAddresses([{ email: ' Cy@Acme.com ' }]);
  assert.equal(shownInviteStatus({ email: 'cy@acme.com', status: 'already' }, waiting), 'already-invited');
  assert.equal(shownInviteStatus({ email: 'bo@acme.com', status: 'already' }, waiting), 'already');
  assert.equal(shownInviteStatus({ email: 'cy@acme.com', status: 'added' }, waiting), 'added');
  assert.equal(inviteLinkKind([{ email: 'cy@acme.com', status: 'already' }], waiting), 'invited');
  assert.equal(inviteLinkKind([{ email: 'bo@acme.com', status: 'added' }, { email: 'cy@acme.com', status: 'already' }], waiting), 'invited');
  assert.equal(inviteLinkKind([{ email: 'bo@acme.com', status: 'already' }], waiting), 'already');
  assert.equal(inviteResultText('already-invited'), 'Already invited');
});

test('inviteLinkKind: the invite link only when someone got an invitation', () => {
  assert.equal(inviteLinkKind([{ status: 'invited' }, { status: 'added' }]), 'invited');
  assert.equal(inviteLinkKind([{ status: 'added' }, { status: 'already' }]), 'added');
  assert.equal(inviteLinkKind([{ status: 'already' }]), 'already');
  assert.equal(inviteLinkKind([{ status: 'already' }, { status: 'refused' }]), 'already');
  assert.equal(inviteLinkKind([{ status: 'refused' }]), 'none');
  assert.equal(inviteLinkKind([]), 'none');
});

test('invitePolicy: the workspace name, the password link and access requests (plans/75)', () => {
  const policy = invitePolicy({
    can: { 'user.invite': true },
    instance: { name: ' lolly.ing ' },
    invites: { passwordSetup: true, passwordDomains: ['SUSE.com', ' suse.com', 3] },
    requests: { project: true },
  })!;
  assert.equal(policy.workspace, 'lolly.ing');
  assert.equal(policy.passwordSetup, true);
  assert.deepEqual(policy.passwordDomains, ['suse.com']);
  assert.equal(policy.askToEdit, true);
  // Only a literal true turns either on: an older instance sends neither.
  const older = invitePolicy({ invites: { passwordSetup: 'yes' }, requests: { project: 1 } })!;
  assert.equal(older.passwordSetup, false);
  assert.equal(older.askToEdit, false);
  assert.equal(invitePolicy({ instance: { name: 42 }, invites: {} })!.workspace, '');
});

test('passwordTickDefault: ticked only when every address is at a password domain', () => {
  const domains = ['suse.com'];
  assert.equal(passwordTickDefault(['sam@suse.com'], domains), true);
  assert.equal(passwordTickDefault(['sam@SUSE.com', 'ana@suse.com'], domains), true);
  assert.equal(passwordTickDefault(['sam@suse.com', 'bo@gmail.com'], domains), false, 'one address outside: the person decides');
  assert.equal(passwordTickDefault(['sam@mail.suse.com'], domains), false, 'the exact domain, as the instance matches it');
  assert.equal(passwordTickDefault([], domains), false, 'nothing typed yet');
  assert.equal(passwordTickDefault(['sam@suse.com'], []), false, 'no password domains');
});

// The day in this machine's time zone, the way the panel shows a day.
const day = (iso: string, lang = 'en'): string => new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(Date.parse(iso));

test('invitationLines: the end day, opened or waiting, and who invited', () => {
  assert.equal(dayLabel('2026-11-01T12:00:00Z', 'en'), day('2026-11-01T12:00:00Z'));
  assert.match(dayLabel('2026-11-01T12:00:00Z', 'en'), /^(Oct 31|Nov 1|Nov 2), 2026$/);
  assert.deepEqual(invitationLines({ status: 'pending', expiresAt: '2026-11-01T12:00:00Z', invitedByName: ' Ana ' }, NOW, 'en'), {
    ends: `Ends ${day('2026-11-01T12:00:00Z')}`, state: 'Waiting', by: 'Invited by Ana',
  });
  assert.equal(invitationLines({ status: 'pending', openedAt: '2026-10-02T10:00:00Z' }, NOW, 'en').state, 'Opened 2 hours ago');
  assert.deepEqual(invitationLines({ status: 'expired', expiresAt: '2026-09-30T12:00:00Z', openedAt: '2026-09-01T10:00:00Z' }, NOW, 'en'), {
    ends: `Ended ${day('2026-09-30T12:00:00Z')}`, state: 'Expired', by: '',
  }, 'an expired one says so, whether or not it was opened');
  assert.deepEqual(invitationLines({ status: 'pending' }, NOW, 'en'), { ends: '', state: 'Waiting', by: '' }, 'an older instance sends no dates');
  assert.equal(dayLabel('not a date', 'en'), '');
  assert.equal(dayLabel('2026-11-01T12:00:00Z', 'de'), day('2026-11-01T12:00:00Z', 'de'));
  assert.match(dayLabel('2026-11-01T12:00:00Z', 'de'), /^\d\d\.1[01]\.2026$/, 'the reader\'s own date order');
});

test('requests: what was asked, when, and the answer sentences', () => {
  assert.equal(requestAskText('editor'), 'Asks to edit');
  assert.equal(requestAskText('viewer'), 'Asks to view');
  assert.equal(requestAskedText('2026-10-02T09:00:00Z', NOW, 'en'), 'Asked 3 hours ago');
  assert.equal(requestAskedText(undefined, NOW, 'en'), '');
  assert.equal(requestAnsweredText('approve', 'editor'), 'Approved as Editor.');
  assert.equal(requestAnsweredText('decline', 'editor'), 'Declined.');
  assert.equal(roleHelpText(), 'Viewers open and copy. Editors save changes. Managers also add people.');
});

test('requestRefusalText: who answered first, or why this person cannot answer', () => {
  assert.equal(requestRefusalText(409, { status: 'approved', answeredBy: 'Priya', answerRole: 'editor' }), 'Priya already approved this as Editor.');
  assert.equal(requestRefusalText(409, { status: 'declined', answeredBy: 'Priya' }), 'Priya already declined this.');
  assert.equal(requestRefusalText(409, { status: 'withdrawn' }), 'This request was withdrawn.');
  assert.equal(requestRefusalText(409, { status: 'expired' }), 'This request has ended.');
  assert.equal(requestRefusalText(409, { status: 'superseded' }), 'This request has ended.');
  assert.equal(requestRefusalText(409, { status: 'approved' }), 'This request has ended.', 'no name: never a blank where the name goes');
  assert.equal(requestRefusalText(409), 'This request has ended.');
  assert.equal(requestRefusalText(404), 'This request has ended.');
  assert.equal(requestRefusalText(403, { status: 'open' }), 'You can no longer answer this request.');
  assert.equal(requestRefusalText(0), 'Could not answer the request. Try again.');
  assert.equal(requestRefusalText(500), 'Could not answer the request. Try again.');
});

test('peopleMessage: a new link has its own daily limit and treats a missing invitation as a change', () => {
  assert.equal(peopleMessage(429, 'link'), 'That is a lot of new links for one day. Try again tomorrow.');
  assert.equal(peopleMessage(404, 'link'), 'That person or invitation has already changed.');
  assert.match(peopleMessage(429, 'invite'), /addresses for one hour/);
});
