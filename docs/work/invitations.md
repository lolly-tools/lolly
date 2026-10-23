# Invite people and handle requests

This page is for admins and project managers who bring people into Lolly Work, and for
anyone who answers a request to join or a request for access. Work sends no email: it gives
you a personal link and a ready-to-send message, and you send them yourself by chat or email.

::: timeline
- <!--i:usercheck--> **Invite an address.** From the console's People view for the whole workspace, or from a project's People panel in Lolly.
- <!--i:link--> **Send the link.** Copy the invite link, or the ready-to-send message, and send it yourself.
- <!--i:globe--> **They open the link.** The page says who invited them, to what, and which address to sign in with.
- <!--i:check--> **They sign in with that address.** Work accepts the invitation and opens the project, or the workspace.
:::

## Two ways to invite

| | Workspace invitation | Project invite |
|---|---|---|
| Where | **Invite people** on the console's People view, `lw invite add`, or `POST /api/v1/invitations` ([API](api.md#invitations)) | **People with access** in Lolly's Share dialog or Team projects view, or `POST /api/v1/projects/:id/invite` |
| Who | holders of `user.invite` (admins and owners by default) | managers of the project, within the [invite policy](#invite-policy) |
| Gives | admission, plus optional local groups | admission, plus a role on the project |
| An address that already has an account | joins the ticked groups at once (`status: "applied"`) | becomes a project member at once (`added`) |

Both write one invitation per address. An address has at most one active invitation, and
every project that invites it is added to that same invitation.

**Which account holds an address.** Work treats an address as an account's only when the
account has shown it holds the address: a sign-in whose provider verified it, a source the operator
vouches for (the reverse proxy, or a provider set to `emailVerification: "trusted"`), or an
accepted invitation for that address. A project invite also counts an account provisioned with no
sign-in yet. An account whose sign-in only claimed the address is treated as if the address
had no account: it gets an invitation, which a verified sign-in has to accept.

## Invite people to the workspace

An invitation identifies one address, stored lowercased, plus optional local groups and an
optional end date of at most 366 days. Inviting an address that already has an active
invitation returns that invitation unchanged, so to change its groups or end date, revoke it
and invite again.

At each sign-in, while `idp.admission.invitations` is not `false`, the server looks up the
active invitation for the email:

- A pending invitation admits a verified email until its end date. An expired or revoked
  invitation admits nobody: the reason is `not-invited` unless a list admits the person.
- On the first admitted sign-in the invitation is marked accepted, and its groups are added to
  the person's local groups. A provider group or role group that an owner named, and that is
  not in the local registry yet, is created there. This happens once: if an admin later
  removes the person from a group, the next sign-in does not add it back.
- Groups go only to an account the invitation came before. An account that already existed
  when the invitation was written keeps its groups, and the acceptance records
  `groupsNotApplied: "existing-account"`.
- An accepted invitation keeps admitting that email until someone revokes the invitation. Revoking blocks
  the person's next sign-in unless `emails` or `domains` admit them. A session already open
  stays open; disable the person to end that session.
- An unverified email never takes an invitation.
- With no `idp.admission` block everyone is admitted anyway, and a verified invited email
  still gets its invitation's groups at the first sign-in.

Attaching groups to an invitation assigns groups, so it carries the same controls as editing
a person's local groups:

- The inviter needs `grant.edit` as well as `user.invite`, and each group must be in the local
  registry.
- No group may map to a role above the inviter's own. An owner group is owner-only, and so is
  a group holding a grant for an owner-only action.
- An address that already belongs to an account joins the groups at once, under the same
  controls. That is refused for your own account, a disabled one, and an owner's unless an
  owner is inviting.
- Only an owner may name a provider group or role group that is not in the registry. That is
  how a second owner joins an instance whose provider sends no groups: an owner invites them
  into the owner group, which the console offers to owners.
- Only an owner may revoke an accepted invitation that belongs to an owner.

Erasing an account deletes the invitation it accepted, and any other invitation for that
address when no other account carries it, so nothing keeps admitting the erased address.

## Invite people to a project

In Lolly, **People with access** lists the people on a project and **Invite by email** adds
more. The request is `POST /api/v1/projects/:id/invite` with `{"emails": [...], "role":
"viewer" | "commenter" | "editor" | "manager", "passwordSetup": false}`, from a manager of the
project. Each address gets one result:

| Result | Meaning |
|---|---|
| `added` | The address belongs to an account, which becomes a member now and finds "*name* shared *project* with you" in their inbox. |
| `invited` | The address has no account yet. An invitation carrying the project is created, or the address's open invitation gains the project. The result carries `invitationId`, the address's own invite link for this project (`link`) and the end date (`expiresAt`). |
| `already` | Nothing to do: the person already has this role or a higher one, or owns the project. |
| `refused` | With a `reason`, listed below. |

For `invited`, at their first sign-in the person joins every project the invitation carries,
each only while the person who added it is still an enabled account that manages that project
and may still invite people, and the role is still one the policy gives. An entry that fails
is skipped and audited (`invite.project.skip`), so removing or offboarding a manager also
stops the invitations they had pending.

A role is raised by inviting again with a higher one, and only lowered on purpose through the
members route ([Team projects](team-projects.md#people-and-roles)).

::: details Refusal reasons
- `invalid-email`.
- `account-disabled`, shown only to a caller who holds `user.invite`.
- `invites-not-allowed`: the invite policy does not let you invite new people.
- `domain-not-allowed`.
- `invitations-off`: `idp.admission.invitations` is `false`, so sign-in would never read an
  invitation.
- `invitation-accepted`: the address's invitation was already used. Shown only to a caller who
  holds `user.invite`; everyone else reads `unavailable`.
- `invitation-changed`: someone else changed the invitation at the same moment; try again.
:::

Which addresses have an account is directory knowledge, which members do not otherwise get.
A caller without `user.invite` is never told that an account is disabled: that address is
handled as if it had no account. Such a caller may send at most 100 addresses an hour
(`429 RATE_LIMITED`), counted per server process. Sharing still shows them who already has
an account, because that person appears on the project; the hourly limit stops this being run
over a list.

The inbox message goes out once, when the person is first added. Raising their role sends
nothing, and removing and re-adding them never brings back a message they dismissed. Each
person may send at most 200 of these messages a day; past that the person is still added, and
the audit row records the message as held.

**The message to send.** The response carries `link`, the project's address in Lolly
(`<baseUrl>/#/team/project/<projectId>`, or `<appUrl>/...` when `instance.appUrl` is set), and
`message`: the workspace name, the inviter's name, the sign-ins on offer and
`instance.inviteNote`. Each invited address gets **Copy invite message** in the People panel:
the inviter, the project and the role, the invite link on its own line, which sign-ins to use
("Sign in as … with Google or GitHub."), "Open the link to set your password." when the link
may set one, the end date and the invite note. Someone who is already a member can use the
plain project `link`.

**Pending invitations.** Managers see the project's pending invitations in the People panel,
each with its end date, whether it was opened and who invited the person, and the actions
**Copy link**, **Copy message**, **New link** and **Revoke**. An invitation that expired in
the last 30 days stays listed as Expired with **Invite again**.

**Withdrawing.** `DELETE /api/v1/projects/:id/invitations/:invitationId` takes the project off
the invitation. When a project invite created the invitation (`createdVia: "project"`) and no
project is left on it, the invitation is revoked too, so the address can no longer sign in
through that invitation. An invitation made in the console only loses the project: whether it still admits
the person is an admin's decision in People. An invitation accepted in the meantime is never
revoked by this route.

**No one is listed twice.** When a person becomes a member or the owner of a project, by an
invite, by accepting an invitation for another of their addresses or by a transfer, the
project comes off any pending invitation for an address they hold. A project-made invitation
left with no projects and no groups is revoked. Both are audited (`invite.project.remove`,
`invite.revoke`, with `via: "membership"`). Two invitations stay open with the project gone:
one made in the console, and one for an account that has not signed in yet, which may be how
that person gets in the first time.

A person can also come to hold an invited address without accepting anything, for example by
adding a sign-in for that address from their profile. The members list leaves such an
invitation out only while accepting it would change nothing. When it carries a higher role
than the person has on the project, it stays listed, because their next sign-in with that
address raises them to that role. A manager who does not want that withdraws the invitation.

## Invite links

Every pending invitation has a personal link, `<baseUrl>/l/invite/<token>`, and each project
on the invitation has a link of its own. Admins copy the workspace link from the console's
Invitations table (**Copy link**, or **Copy message**). Managers copy a project's link from
that project's People panel in Lolly.

The link identifies the invitation and never admits anyone by itself: the person still signs
in, with the invited address. The token is signed, not stored ([the
API](api.md#invite-links-and-access-requests)), so every inviter who added a project to an
invitation can copy a working link at any time.

**The invite page.** Opening a link shows a page with no script. It says who invited the
person, to which project and with which role, which address to use, and when the invitation
ends:

- The heading shows the inviter and the project ("Ana invited you to Brand refresh"), or the
  workspace for a workspace link ("Ana invited you to Example Studio"). Each link shows its own
  project only, never the others the invitation carries. An archived project is shown as a
  workspace invite.
- A line explains the role: "On Example Studio, as an Editor. Editors can open and save work
  in Brand refresh."
- The address is masked: "Sign in with the address this invitation was sent to:
  an•••@example.com". A screen reader hears "an address at example.com that starts with an".
- The end date, as a relative time and a UTC date ("Ends in 30 days (2 Nov, UTC).").
- One button per sign-in: **Set a password** first when the link may set one, then one button
  per OpenID Connect or GitHub provider, then **Sign in with email and password** when the
  address already has a password.
- When GitHub is configured, a line saying that every verified address on the GitHub account
  counts.
- `instance.inviteNote`, when set, for example which sign-ins to use when an organisation
  blocks Google.
- Inside an in-app browser (a mail, chat or social app's own web view, where Google sign-in
  can fail), a hint to open the link in Safari or Chrome, with the link to copy.

The page never contains the full invited address, the inviter's email, the project name in
the `<title>` (always "Invitation to" and the instance name) or `og:` and `twitter:` preview
tags, so a link pasted into a chat previews as nothing in particular. Reading the page changes
nothing: a link preview or a mail scanner that fetches it does not mark the invitation
opened. It is marked opened when someone presses a sign-in button.

| State | Status | The page |
|---|---|---|
| Pending, signed out | 200 | the invite page above |
| Pending, signed in with the invited address | 200 | "You are signed in as …" and **Join Brand refresh** (**Accept invitation** for a workspace link), which accepts and opens the project |
| Pending, signed in as another account | 200 | "You are signed in as another account", sign-in buttons that ask for an account, and [Use this account instead?](#using-another-account) |
| Accepted by the reader | 200 | "You are already in" and **Open Brand refresh** |
| Accepted by someone else, or signed out | 200 | "This invitation was already used", with **Sign in** |
| Ended (pending past its end date) | 410 | "This invitation has ended. … Ask Ana for a new link." |
| Unknown, malformed, revoked or replaced | 410 | "This link no longer works", the same page for every cause |

**Signing in from the page.** A sign-in button posts to `POST /api/auth/invite`. The server
records the first opening (`invite.open`), then starts that sign-in with the invitation
carried in the signed `state` the provider hands back; the token itself never goes to the
provider. An OpenID Connect provider also gets `login_hint` with the invited address, so its
account picker offers the right account first. GitHub takes no hint, and the email and
password form says which address to use without filling it in. When the sign-in comes back:

- **The address matches.** The sign-in finishes as usual, the invitation is accepted, and
  Lolly opens on the project (`/#/team/project/<id>`), or on `/` for a workspace link.
- **Another address, not admitted.** The page "This is not the invited account" (403) shows
  both addresses (the invited one masked) and offers **Use a different account** and [Ask to
  use this account](#using-another-account). No account is written. The audit log gets
  `auth.denied` (reason `not-invited`, with `invitationId`) and `invite.wrong-account` with
  `admitted: false`.
- **Another address that is admitted anyway** (already a member). The person is signed in and
  sees the signed-in wrong-account page (200) instead of the app, with `invite.wrong-account`
  and `admitted: true`.

If the invitation was revoked, replaced or accepted by someone else while the person was at
the provider, the sign-in finishes as a plain one and opens `/`.

### Setting a password from the link

For people who will sign in with [email and password](identity.md#email-and-password), an
admin or owner can let the invite link set the password, so they send one link instead of an
invitation and a password link. The tick is **Can set a password** on **Invite people** in the
console and on Lolly's invite form. It is offered only to an admin or owner while a
`password` entry is configured, and it starts ticked when every address on the invite is at a
domain in `policy.invites.passwordDomains`.

The invite page then shows **Set a password** first. Pressing it works only when all of these
hold, checked at that moment:

- a `password` entry is still configured;
- the invitation is pending and has not ended;
- the address has no password yet;
- the person who invited them (the project entry's inviter, otherwise the invitation's) could
  still issue a password link for the address, under the same rules as **Copy sign-in link**
  (owner-only addresses, a disabled or demoted inviter).

The server then issues a one-time password link valid for an hour (audited as
`auth.password.link.issue` with `via: "invitation"`) and shows the set-password form,
including the optional name. Setting the password signs the person in and opens the project.
If any check fails, the invite page shows "This invitation can no longer set a password. Sign
in another way, or ask Ana for a sign-in link."

::: warning Send a password-setting link privately
Until a password is set, whoever holds the link can set it for the address. Send it to the
person directly, not in a shared channel. Once a password exists, the link offers only the
ordinary sign-ins.
:::

### New link and Invite again

**New link** (in the console, or on a pending row in a project's People panel) raises the
invitation's link version. Every link copied before, from any project and from the console,
then shows "This link no longer works", and the invitation's "Opened" mark is cleared. Use it
when a link went to the wrong place. Each invitation gets at most 10 new links a day. The
project route is `POST /api/v1/projects/:id/invitations/:invitationId/link`.

**Invite again** is for an expired or revoked invitation. It writes a new invitation for the
same address, with the same projects (and in the console the same groups) and a new link. The
console needs `user.invite` and the usual group controls; a project needs a manager who may
invite new people (`POST /api/v1/projects/:id/invitations/:invitationId/reinvite`).

### GitHub addresses

GitHub accounts often carry several verified addresses, such as a personal primary address and a
work address. For invitations, and only for invitations, a GitHub sign-in counts every
verified address on the account (up to 10, never the `users.noreply.github.com` commit
address). A person invited at their work address can therefore sign in with a personal GitHub
account that has the work address verified on it, and the console shows "Accepted as" the
primary address.

Everything else still uses the primary address alone: the `emails` and `domains` lists, the
address stored on the account, and joining an existing person by email. A secondary address
at a listed domain does not admit anyone. An account admitted through a secondary address
stays admitted, device sign-ins included, while the invitation it accepted is not revoked.

## Invite policy

`policy.invites` decides who may invite **new** people and on what terms. The keys and their
defaults are in [instance configuration](configuration.md#policy):

- `allow`: `owners`, `admins` (the default) or `members`. Inviting through a project also
  needs manager on that project, whatever the tier.
- `domains`: when not empty, a new address must be at one of these domains.
- `maxTtlHours`: how long an invitation made from a project stays open. Adding a project to an
  existing invitation keeps its end date, and the console sets its own.
- `projectRoles`: which project roles may be given (by default all four: viewer, commenter,
  editor and manager).
- `passwordDomains`: domains whose addresses usually sign in with a password, so **Can set a
  password** starts ticked. It only suggests; the tick stays an admin's choice.

The tier and the domain list apply to every invitation that lets a new person in: from a
project, from the console and from `lw invite add`. Sharing a project with someone who already
has an account, or giving their account groups in the console, needs manager on the project
(or the console's own checks) and an allowed role.

Lolly reads `can['user.invite']` and `invites` (`domains`, `maxTtlHours`, `projectRoles`,
`passwordSetup` and `passwordDomains`) from `GET /api/v1/org-config`, so it offers only what
the server accepts. Older servers send neither, and Lolly then hides inviting. The policy is
part of the instance configuration, so changing it means editing the configuration and
redeploying.

## Requests

People can ask for a way in. Every request reaches the right people as an inbox notice, and
the person asking learns nothing about the workspace or project until someone approves.

| Request | Who can file one | Who answers | Switch |
|---|---|---|---|
| [Ask to join](#asking-to-join) | someone who signed in but is not invited | everyone who may invite new people | `policy.requests.join` (off by default) |
| [Use another account](#using-another-account) | someone who opened an invite link with a different account | everyone who may invite new people, and the link project's managers when the person already has an account | follows the invitation, so always on |
| [Ask for access](#asking-for-access) | a member who opened a project or session they cannot see, or a viewer who wants to edit | the project's owner and managers | `policy.requests.project` (on by default) |

Requests expire after `policy.requests.ttlDays` (14 days by default), and so do their notices.

### Asking to join

A person who signed in but is not invited sees the refusal page ("Example Studio is invite
only"). With `policy.requests.join` on, the page also offers **Ask to join**: "Ask the admins
of Example Studio to let sam.k@example.net in.", with an optional note of up to 280
characters. The request carries the address the sign-in just verified, never a typed one.
With it off, the page says to ask the person who invited them to invite this address. Other
refusals (a disabled account, an unverified email, a `hostedDomain` or `tenantId` mismatch)
never offer the request.

- **Who answers.** Every enabled account that may invite new people (`policy.invites.allow`;
  by default, admins and owners). They see the request in the Requests card on the console's
  People view and in their inbox.
- **Approve.** Needs an approver who may invite new people, and an address at a domain
  `policy.invites.domains` allows. It writes an invitation for the address (`createdVia:
  "request"`), so the person is admitted at their next sign-in, and gives the approver a
  message to send ("You can now sign in to Example Studio. Open https://work.example.com and
  sign in as … with GitHub."). An address that already has an account needs nothing more.
- **While it is open**, signing in again shows "You asked to join 3 hours ago. An admin of
  Example Studio has not answered yet." with **Withdraw request**.
- **Declined**, the page says so for 7 days, with the date, and hides the form until then.
- **Limits.** One open request per address, 3 per address in 30 days, and at most
  `policy.requests.joinOpenMax` open requests to join and to use another account across the
  instance. Past a limit the same "Request sent" page shows and nothing is stored
  (`access.request.held`).
- **Closed by an invitation.** Inviting the address, or the person accepting an invitation,
  closes the open request.

While people email is off, the "Request sent" page says "Example Studio does not send email
yet. Sign in again later: once an admin approves, you are in."

### Using another account

An invitation is for the invited address only. When someone opens an invite link and signs in
with another account, the wrong-account page lets them ask: "Ana decides whether
sam.k@example.net can use this invitation." The signed-in page asks "Use this account
instead?", shown when the reader is not the inviter and has less than the invitation gives.

This files a request of kind `switch`. It goes to the admins who may invite new people and,
when the person already has an account, also to the managers of the link's project. Their
notice carries a warning: "Someone with the invitation for an•••@… signed in as … Approve only
if you know the address belongs to them."

- **For an existing account** (the signed-in case), approving adds that account to each
  project on the invitation that the approver manages, and gives it the invitation's groups
  only when the approver holds `grant.edit`. Those entries come off the invitation, and a
  project-made invitation left with nothing is revoked.
- **For an address with no account** (the refused case), approving revokes the old invitation,
  so its links stop working, and writes a new one for the signed-in address with the same
  projects, end date and, when the approver may grant them, groups. The person is admitted at
  their next sign-in. One invitation never admits two people.
- Approving needs the invitation to be still pending; otherwise the request closes as expired.
  Each invitation takes at most 3 such requests a day.

### Asking for access

Someone who opens a project or session link they cannot open sees "You do not have access to
this team project." and can **Ask for access**: they choose **Can view** or **Can edit** and
may add a note of up to 280 characters. A viewer can **Ask to edit** the same way, from Share,
Team and from the People panel. Both file a request of kind `project`, with
`POST /api/v1/projects/:id/access-requests` or, from a session link,
`POST /api/v1/sessions/:id/access-requests` ([the
API](api.md#invite-links-and-access-requests)).

Filing never tells the requester anything about the project. The answer is the same `202`
whether the project exists, is archived, the person already has that access, a request is
already open, or requests are switched off. The requester never learns who manages a project
until someone approves.

**Who answers.** The project's owner and its managers, when at least one of them is an enabled
account. Otherwise, everyone who manages the project through `project.manage` (admins and
owners). They get an inbox notice, "Sam asks to edit Brand refresh", and see the request under
**Asking for access** in the project's People panel. The approver is checked again on every
list and answer, against the project stored on the request.

- **Approve** with a role, by default the one asked for. The role must be one
  `policy.invites.projectRoles` allows and one the approver could give directly. The person is
  added to the project and gets a notice, "Andy gave you edit access to Brand refresh", with
  **Open**. Approving fails when the project was archived (`PROJECT_ARCHIVED`) or the
  requester's account was disabled (`REQUESTER_UNAVAILABLE`); the request then closes as
  expired.
- **Decline.** The requester gets "Your request for Brand refresh was not approved".
- **Withdraw.** The requester can withdraw an open request.
- **Already handled.** When two approvers answer at once, one wins. The other sees who
  answered and how ("Priya already approved this"), and nothing changes.
- **Access another way.** When the person is added with that role or a higher one, by an
  invite, a share or an accepted invitation, their open requests for it close as
  `superseded`, with no second notice.
- **Limits.** One open request per person and project, and 20 requests a day per requester
  (`429 RATE_LIMITED` past that).

## Notices

Every step above reaches people through their inbox. The server writes these notices in one
place (`server/src/notify/people.ts`), in English, naming people by name and never by email to
anyone who could not already see the address.

| `data.kind` | Goes to | Title |
|---|---|---|
| `access-request` | the people who may answer it | "Sam asks to edit Brand refresh", "… asks to view …", "Sam asks to join Example Studio", or "Sam asks to use their own account for an invitation", with the address, the sign-in and the note in the body, and **Review** |
| `access-answer` | the requester | "Andy gave you edit access to Brand refresh" with **Open**, or "Your request for Brand refresh was not approved" |
| `invite-accepted` | each person who invited them (at most 5) | "Sam accepted your invitation", with **Open** (the project) or **Open People** (the console) |
| `invite-skipped` | the invitee | "Your invitation to Brand refresh no longer works", when the person who added the project can no longer add people to it, or the project was archived |
| `welcome` | the invitee, on accepting | "Welcome to Example Studio", with the inviter and, for a project, its name, the role and **Open** |
| `comment-mention` | a person mentioned in a comment | "Ana mentioned you in Spring poster", with the start of the newest message and **Open thread** |
| `comment-reply` | the people in a comment thread when someone replies | "Ana replied in Spring poster", or "New replies in Spring poster: 3", with **Open thread** |

- A request notice has `kind: "request"` and severity `action`; the others have
  `kind: "notice"`. Each carries `data.at`, the time it happened, and the ids a client needs
  (`requestId`, `projectId`, `invitationId` and so on).
- A request notice disappears when the request is answered, withdrawn, superseded or expires.
  The others stay until dismissed, and an answer or acceptance notice for 30 days at most.
- The inbox stops showing a share or a collaboration invite once the person can no longer see
  its project (an invite also once its session is deleted), and a project access request once
  they no longer manage that project.

**Comment notices** (`kind: "comment"`, id `cn_…`) work differently. There is one per person
per thread, updated as replies arrive. It stores no text and no names: the inbox writes the
title, the excerpt and participant labels each time it is read, so an edited or deleted
message never lingers there. It is shown only while the person can still open the document and
read its comments. Dismissing it removes it until the next reply, and reading the thread in
Lolly removes it too. The [API reference](api.md#approvals-and-inbox) has the details.

**How Lolly shows them.** `GET /api/v1/inbox` answers with an `ETag` and an `unread` count, and
`304` when nothing changed. Lolly checks it when the tab comes back into view (at most once a
minute) and every 60 seconds while it is visible. The banner shows one message at a time, and
the next after a dismiss. **View all** opens the inbox, where project requests have **Approve**
(with a role) and **Decline**. Requests to join and to use another account are answered in the
console.

Notices are not emailed yet. `notify.people.email` is the switch for that, off by default, and
this release sends no people email even with it on ([emailing people
notices](configuration.md#emailing-people-notices)). Until then, copy invite messages and
links and send them yourself.

::: details Audit actions for invitations and requests
- `invite.create`: payload `email`, `groups`, `expiresAt`, `via` (`console`, `project`,
  `request` or `reinvite`), `from` for an invitation made again, and `passwordSetup`.
- `invite.link`: a new link; payload `email` and `version`.
- `invite.open`: actor `anonymous`, the first sign-in started from a link; payload `provider`
  and `idp`.
- `invite.wrong-account`: payload the signed-in `email`, `provider`, `idp` and `admitted`.
- `invite.revoke`: payload `email` and `was`, the status before revoking.
- `invite.accept`: actor the new member; payload `provider`, `idp`, `email`, `groups`, `via`
  (`sign-in`, `join` or `link`), and `createdGroups` when the sign-in created local groups, or
  `groupsNotApplied` when the account came before the invitation or is the inviter's own.
- `invite.project.skip`, `invite.project.remove`.
- `access.request`, `access.request.held`, `access.approve`, `access.decline`,
  `access.withdraw` and `access.supersede`. A request's note is recorded only as its length.

Each `invite.*` row has subject `invitation:<id>`. The full list of `access.*` rows is in [the
API](api.md#invite-links-and-access-requests).
:::
