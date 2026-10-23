# Team projects

This page is for members and project managers who share work through Lolly Work. A
**project** is a folder of saved tool sessions; a **session** is one tool with its inputs,
saved so colleagues can open the same work. Both live in the instance's store, so a session
saved on a laptop opens on a phone after sign-in.

By the end you will know who sees a project, what each project role allows, how saving and
shared files work, and what happens when two people save at once.

## Who sees a project

Each project is either **private** (its owner and the people added to it) or shared with one
or more **groups**. A member sees a project they own, one they were added to or one shared
with any group they belong to. Admins and owners see every project. Group membership is the
member's effective set: groups from the identity provider plus local groups added in the
console.

When Lolly offers a visibility choice, it reads the list from `sharing.groups` in
`GET /api/v1/org-config`. That list holds the member's own groups, sorted, minus the groups
that make someone an admin or owner: the names under `admin` and `owner` in `idp.roleGroups`,
or the literal `admin` and `owner` when that role has no mapping. Admins and owners already
see every project, so sharing with their groups adds nobody. Other role groups stay in the
list: approvers, authors, members and viewers see a team project only through its groups, so a
project shared with the author group reaches every author. An empty list means the member can
only make private projects. `can['project.create']` in the same document says whether to offer
**New project** at all. Both are hints for the interface; the routes below still decide.

**Archiving.** Archiving a project hides it from `GET /api/v1/projects`, so it drops out of
Lolly's team list and save picker. The console's Projects view asks with `?archived=1`, lists
archived projects with **Restore** and live ones with **Archive**. Both send
`PATCH /api/v1/projects/:id` with `{"archived": false}` or `{"archived": true}`, from a
manager of the project.

**Handing a project on.** Changing the owner (`ownerId`) needs the current owner or
`project.manage`. The previous owner stays on the project as a manager, audited as
`project.member.add` with `via: 'transfer'`, so they can still work there, leave or be
removed. A previous owner whose account is disabled is not kept, so offboarding (disable, then
transfer) leaves no row that re-enabling the account would bring back.

## People and roles

Everyone who can see a project has one role on it, and the highest that applies wins.

::: figure work-team-projects-roles
Each project role adds to the one below it; the workspace role and deny grants still apply on top.
:::

| Role | Who has it | What they may do |
|---|---|---|
| owner | the person who created the project, or the one it was handed to | everything below, and hand the project on |
| manager | added as manager; or anyone holding `project.manage` (admins and owners by default) on a project they can see | rename, change visibility, archive, delete anyone's session, add, change and remove people, invite |
| editor | added as editor; a member of one of the project's groups; any admin or owner | create sessions, save changes, delete their own sessions |
| commenter | added as commenter; a group, or everyone signed in to the workspace, given Commenter | everything a viewer may, and comment even where viewers may not; never changes artwork |
| viewer | added as viewer | open the project and its sessions, read revisions and comment unless the project turns off viewer comments |

A member of a project's group acts as an editor. Adding someone gives them a role even on a
private project. The workspace role still applies on top: an account with the workspace
`viewer` role cannot save, whatever its project role, and a deny grant on `session.edit` or
`project.manage` holds here as anywhere else ([Roles and grants](permissions.md)). A viewer who
tries to save gets `403 READ_ONLY`; someone who cannot see the project gets `403 FORBIDDEN`.

Live editing follows the same roles. A viewer joins a room as an observer, and only an editor
or higher holds a writer seat or invites others into the room. A guest-edit link to a session
needs editor on its project, when the link is made and again on every gesture and keepalive of
each guest it let in. Removing the person who made the link from the project, making them a
viewer, or making the project private ends those guests' seats.

**Managing people.** Each row of `GET /api/v1/projects` and the document from
`GET /api/v1/sessions/:id` carry `myRole`, the caller's effective project role, so Lolly can
show the right controls.

- `GET /api/v1/projects/:id/members` lists the owner and everyone added, for anyone who can
  see the project. Managers also see each person's email and the open invitations that carry
  the project.
- For everyone else, a person with no first or last name is shown by the part of their address
  before the "@", never the whole address. The same applies to `updatedByName` in the project
  and session lists.
- Managers change a role with `PATCH /api/v1/projects/:id/members/:userId` and remove someone
  with `DELETE` on the same path.
- Anyone may remove themselves, which is how to leave a project; the caller's own row carries
  `isMe: true`. The owner has no member role and cannot be removed; hand the project on first.

Inviting people, invite links and requests for access are on [Invite people and handle
requests](invitations.md#invite-people-to-a-project).

### Who can see who has access

The members list marks each row with where the access comes from. Everyone on the project sees
the owner (`via: 'owner'`) and the explicit members (`via: 'member'`). Only the project's
managers also see the other ways in, in a separate `effective` list, so no client offers a role
select or **Remove** for access the project cannot take away:

| Row | `via` | `role` | Who sees it |
|---|---|---|---|
| Someone in one of the project's visibility groups | `group`, with `group` giving its name | the level the group gives; their full level for an admin or owner caller | the project's managers who are in that group, or are an admin or owner |
| Someone in a user-made share group | `custom-group`, with `group` giving its name | the level from visible grants; their full level for an admin or owner caller | managers who belong to that group, or are an admin or owner |
| A workspace admin or owner who is not otherwise on the project | `admin` | Editor, or Manager while they hold `project.manage` | managers who are themselves an admin or owner |

That access comes from a group or a workspace role, so it changes with the project's
visibility and share settings or in the directory, not in the members list.

- The rows never carry an email address, and names never fall back to one.
- A manager who is not an admin learns only that admins can open the project
  (`adminAccess: 'note'`), never who they are. Anyone who may create a project manages it, so
  listing the admins there would show any member what `GET /api/v1/users` refuses them. For
  the same reason that caller sees a group row at the level their shared groups give, never a
  stronger level from a hidden group or an admin role.
- A project can be made visible to any group, so group rows are listed only for groups the
  caller is in (an admin or owner sees them all). Making a project visible to a group never
  reads that group's people out.
- Disabled accounts, expired group grants and user-made groups disabled by policy are left
  out, and the list stops at 200 people (`effectiveTruncated: true`).
- Instance-wide access appears as `instanceAudience: { role }`, capped by
  `policy.sharing.instance.maxRole` and Editor, without listing the directory. It is absent
  when instance sharing is off, and only managers receive the summary.

The list also says whether the caller may hand the project on (`canTransfer`), by the same test
the transfer applies: the project's owner, or a holder of `project.manage`. Lolly offers
**Make owner** only then, so an admin denied `project.manage` is not offered it and a member
granted it is.

## Saving from Lolly

Signed in to an instance, the Share dialog offers a **Team** section:

- **Save to a team project** picks a project, or creates one with the chosen visibility, then
  saves the current tool and inputs as a new session (`POST /api/v1/projects/:id/sessions`).
- **Save changes** writes an opened team session back (`PUT /api/v1/sessions/:id`) with the
  revision it was opened at.
- **Copy team link** copies the session's [team link](#team-links).

A session body may be up to 4 MiB, enough for a large Design document; a larger one is refused
with `413`. Images uploaded on one device are stored on that device. Where shared files are on,
saving to a team project copies the images a session uses into the project's files, so the
session opens elsewhere with them. Where they are off, the session opens elsewhere without
those images, and Lolly warns about that when you save.

| To | You need |
|---|---|
| Create a session | editor on the project and `session.create` |
| Save changes | editor on the project and `session.edit` |
| Delete a session | `session.delete`, editor on the project and either to be the person who created it or a manager of the project |

Admins and owners hold `project.manage` by default, so a deny grant on it also stops them
deleting a colleague's session. Being able to see and edit a team project is not enough on its
own, so a colleague's session stays put. Deletion leaves a tombstone, so a stale copy cannot
bring the session back.

### When two people save the same session

Session writes compare and set on `rev`. When someone else saved since you opened the session,
your save answers `409 CONFLICT` with the newer version in `current`, and nothing is
overwritten. Lolly then offers a choice: open their version, or save yours as a new session so
both survive. Every refused save is recorded as `session.conflict` in the audit log (ids and
revisions only, never input values). The routes are in the [API
reference](api.md#projects-and-sessions).

## Shared files

A project can hold files: the images and other uploads its sessions use, kept by the instance
so every member gets the same bytes. A session refers to a file by the asset id
`user/team/<fileId>`.

Shared files are on when `policy.projectFiles.enabled` is `true` (the default) and the instance
keeps its data in PostgreSQL. On the memory store they are always off, because an upload would
vanish with the process. `sharing.projectFiles` in `GET /api/v1/org-config` says which, and
while files are off every file route answers `404`.

| Who | May |
|---|---|
| anyone who can see the project (viewer and up) | list the project's files and download them |
| editor and up, with `session.create` | upload a file to a project that is not archived. Service tokens cannot |
| editor and up, with `session.edit` | rename a finished file in a project that is not archived; the bytes and id stay the same, so sessions that use the file still open. Service tokens cannot |
| the person who uploaded the file | delete it, or cancel their own unfinished upload |
| manager and up (owner, manager member, `project.manage`) | delete any file in the project |

**How an upload works.** An upload is reserved first, then sent in parts of 1 MiB, then
finished. Each part is checked against the digest declared at the start, and the whole file is
checked before it is listed. Only finished files are listed, newest first, and only the
uploader can send parts or finish an upload. An unfinished upload expires 15 minutes after it
starts or after its last accepted part, and at the latest 24 hours after it starts
(`policy.projectFiles.uploadTtlHours`), so an upload a closed tab left behind stops holding
room within minutes. Once it is an hour past its expiry it is removed with its parts, when
someone next starts an upload or when retention runs. The protocol is in [Resumable
uploads](resumable-uploads.md).

**Limits**, from `policy.projectFiles` ([configuration](configuration.md#policy)):

- one file: 25 MiB by default (`maxFileBytes`), never more than 4 GiB;
- one project: 128 MiB of files (`projectBudgetBytes`);
- the whole instance: 256 MiB of files (`instanceBudgetBytes`);
- one person: 16 unfinished uploads at a time, declaring twice the largest file in all;
- one person's downloads: twice the instance budget a day.

Finished files and unexpired unfinished uploads both count, each at its size plus 4 KiB for its
database rows, so many tiny files fill a budget too. The defaults suit a small hosted
PostgreSQL, which holds the file bytes as well. The file list reports `projectUsedBytes` and
`instanceRemainingBytes` so Lolly can say how much room is left.

**Deleting.** Deleting a file that a live session in the project still uses is refused with
`409 FILE_IN_USE`, listing those sessions, because the session would otherwise open without
the file. A manager can delete it anyway with `?force=1`. Every finished upload is audited as
`project.file-upload`, every rename as `project.file-rename`, and every delete or cancel as
`project.file-delete`. A person's finished files block erasing their account, like their
sessions do; their unfinished uploads are removed when the account is erased. The routes are
in the [API reference](api.md#project-files).

### Shared subfolders

Subfolders belong to their project and take its membership. Viewers can browse folders and
their contents; editors can create folders, rename them and move sessions or finished files
between them. A move changes only the folder listing, so open documents, their links and the
assets they use keep working. Personal folders stay on the person's device until they choose
to share them.

## Who changed what

Project rows in `GET /api/v1/projects` carry `updatedAt` and `updatedByName`: the newest of the
last session save and the last rename, visibility or archive change, and the name of the person
who made it (`null` when nobody has changed the project since it was created). Session rows in
`GET /api/v1/projects/:id/sessions` carry `updatedByName` beside `updatedBy`. Lolly shows these
in its lists, so a team working one after another can see who saved last.

## Team links

A team project opens at `<app>/#/team/project/<projectId>`, which shows Lolly's Team projects
view on that project. A team session opens at `<app>/#/team/<sessionId>`: Lolly loads the
session, opens its tool with the saved inputs and remembers the revision for the next save.

The link carries only the session id, and opening one needs the same visibility as reading the
session through the API. A signed-out reader goes through the sign-in gate first and returns to
the session afterwards. Collaboration invites in the inbox use this link too.

A link to a comment thread adds `?thread=<threadId>`:
`<app>/#/team/<sessionId>?thread=<threadId>`. Lolly opens the session, connects and shows that
thread. The link grants nothing: someone who cannot open the session sees the usual refusal
and can [ask for access](invitations.md#asking-for-access), and the thread opens once access is
approved.

Before moving a project to another Work instance, [Preview a project
transfer](project-portability.md) lists everything the move would involve.
