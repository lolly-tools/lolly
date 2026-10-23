# Roles and grants

This page is for the admin deciding who can do what in Lolly Work, and for anyone checking why
a person can or cannot do something. Work has two layers: a small fixed set of roles that
follow your directory groups, and grants that adjust a role for one group, one person or one
resource. When they disagree, deny wins.

::: figure work-permissions-ladder
Each role adds to the role below. Grants sit over the roles: any matching deny wins, then any matching allow, then the role default.
:::

![Fine-grained grants: per-group allow and deny layered on the role defaults, deny wins](shots/permissions-grants.svg)

## Roles

| Role | Comes from | Adds |
|---|---|---|
| `viewer` | a group mapped in `idp.roleGroups.viewer`, or a service token created with `--role viewer` | reading the catalog and sessions, joining live rooms, commenting |
| `member` | the default for anyone signed in, or a group mapped in `idp.roleGroups.member` | using tools, saving and sharing sessions, creating projects and groups, exporting, delivering to an organisation destination, making links |
| `author` | `idp.roleGroups.author`, or by default the group `author` | submitting assets to the catalog |
| `approver` | `idp.roleGroups.approver`, or by default the group `approver` | acting on approvals |
| `admin` | `idp.roleGroups.admin`, or by default the group `admin` | everything an author and an approver can do, plus running the catalog, policy, grants, links, telemetry, fleet, audit export, projects, server renders and invitations |
| `owner` | `idp.roleGroups.owner`, or by default the group `owner` | the [owner-only powers](#owner-only-powers) |
| `guest` | a guest-edit link | nothing: access comes entirely from the link |

A person's role comes from their effective group set (provider groups plus local groups): the
highest match in the order `owner`, `admin`, `approver`, `author`, `member`, `viewer`, using
the groups mapped in `idp.roleGroups`, or for the top four a group of the same name when that
role has no mapping, otherwise `member`. Mapping your own group names is on [Sign-in and
sessions](identity.md#groups-role).

::: details Every action by role
- **`viewer`**: `catalog.read`, `session.view`, `collab.join`, `comment.view`,
  `comment.create`, `comment.edit`.
- **`member`**: viewer, plus `tool.use`, `session.create`, `session.edit`, `session.delete`,
  `session.share`, `comment.resolve`, `comment.moderate`, `project.create`, `group.create`,
  `export.download`, `export.request`, `delivery.create`, `link.create`.
- **`author`**: member, plus `catalog.submit`.
- **`approver`**: member, plus `approval.act`.
- **`admin`**: author and approver, plus `catalog.publish`, `catalog.expire`, `catalog.hold`,
  `catalog.scan`, `catalog.edit`, `catalog.collection.manage`, `catalog.provider.read`,
  `catalog.provider.manage`, `brand.switch`, `catalog.injectable.manage`, `policy.edit`,
  `grant.edit`, `link.revoke`, `link.create-guest`, `message.send`, `telemetry.view`,
  `fleet.view`, `fleet.manage`, `audit.export`, `project.manage`, `project.archive`,
  `approval.assign`, `export.server`, `user.invite`.
- **`owner`**: admin, plus `instance.config`, `catalog.provider.credential`,
  `catalog.provider.publish`, `scim.manage`, `token.manage`.
- **`guest`**: nothing.

Every action's route is in the [API reference](api.md).
:::

Projects add a second, narrower layer: each person has a role on each project they can see
(owner, manager, editor, commenter or viewer), and project routes check both. Saving needs
`session.edit` and editor on that project; renaming, sharing and inviting need manager. The
project roles, where they come from and who can see who has access are in [Team
projects](team-projects.md#people-and-roles).

## Grants

A grant is a row of `(principal, action, resource, effect)` that overrides the role default in
either direction.

```bash
lw grants list
lw grants add group:brand policy.edit '*'            --effect allow
lw grants add group:contractors export.download 'tool:price-card' --effect deny
lw grants rm  group:brand policy.edit '*'
```

The same API sits behind `GET/POST/DELETE /api/v1/grants` and the console's **Grants** view,
so the console and CLI always offer the same things.

| Field | Form |
|---|---|
| `principal` | `group:<name>`, `user:<id>`, or `*` |
| `action` | any action id from the role list above |
| `resource` | a selector: `*`, `tool:<id>`, `tool:tag/<tag>`, `catalog:tag/<tag>`, `destination:<id>`, … |
| `effect` | `allow` or `deny` |

Grants take effect on the **next request**: there is no cache to clear and no restart. Every
change is audited.

::: details How evaluation works
`server/src/rbac/evaluate.ts` makes every decision, in a fixed order: any matching deny wins,
then any matching allow, then the role default. It never looks anything up itself. A resource
arrives as the set of selectors it satisfies, for example
`['tool:qr-code', 'tool:tag/external-facing', '*']`.
:::

### Explicit allow and the role default

Some decisions must tell "an explicit grant allows this" apart from "the caller's role happens
to allow this". Tool visibility is the example: the `member` default of `tool.use` would
otherwise show every governed tool. Those checks use the explicit-grant decision
(`grantDecision`), which returns `allow`, `deny` or `none`. It matters when you are working out
why a tool is or is not visible.

## Common recipes

### "Edit but not export"

The most common fine-grained request is two rows:

```bash
lw grants add group:contractors tool.use        'tool:campaign-banner' --effect allow
lw grants add group:contractors export.download 'tool:campaign-banner' --effect deny
```

The contractor opens the campaign banner tool and works on the banner. Deny wins over their member
default, so the file cannot leave as a download.

Tag selectors let the same pair cover a whole class of tools (`tool:tag/external-facing`)
instead of listing ids.

### Let a team contribute assets

`catalog.submit` is the action behind [catalog submit](catalog.md#submitting-an-asset), the one
route by which a member's file enters the catalog. The `author` role carries it, and one row
lets a team contribute while everyone else reads:

```bash
lw grants add group:design catalog.submit '*' --effect allow
```

There is no separate action for deciding a submission. When `policy.submit.chain` sets a
chain, the decision is an ordinary approval: eligibility is membership of the step's approver
groups plus separation of duties ([approvals](approvals.md)). How the review queue works is on
[Catalog and content](catalog.md#reviewing-what-was-submitted).

### Let a team curate metadata and versions

`catalog.edit` is the action behind [org-defined metadata](catalog.md#org-defined-metadata):
filling in the fields your organisation defines, and correcting an instance-owned asset's
name, description and tags. It sits with `admin` rather than `author`, because contributing an
asset and editing what the whole catalog says about one are different authorities.

```bash
lw grants add group:brand catalog.edit '*' --effect allow
```

Two things it does not give:

- **Defining** the fields is `policy.edit`, because a taxonomy is governance and lives in the
  [governance document](governance.md#policy-as-code).
- It reaches only assets the caller can already see. The editor asks the same exposure question
  that link minting asks, and a submission still under review is edited through the review
  queue instead.

The same action covers the file side of curation ([versions](catalog.md#versions)): replacing a
published asset's file with a new version, rolling back, deleting a stored version and retiring
an asset in favour of another (`replacedBy`). `catalog.submit` contributes an asset and
`catalog.edit` changes what an asset already in the catalog says or serves, which is why a
`policy.submit.chain` gates contributions and not versions.

<a id="curating-a-shareable-set-catalogcollectionmanage"></a>

### Let a team curate collections

`catalog.collection.manage` is the action behind [collections](catalog.md#collections):
creating a named, ordered set of catalog assets, choosing the groups that may see the set, and
deleting a set. The action sits with `admin` for the same reason `catalog.edit` does.

```bash
lw grants add group:brand catalog.collection.manage '*' --effect allow
```

Two rules close the gap a shared set could open:

- **A collection may only hold assets its curator can see.** A link to a collection hands its
  holder every member, so without this rule a curator with a narrowed grant could add assets
  they were never shown and read them back through a link. The check runs when the set is
  saved, where the curator can be told which id was refused.
- **Minting a link to a collection refuses any member the minter cannot see.** `link.create`
  is a member default while curating is an admin action, so this second check binds everyone
  who shares the set. A refusal reports how many members were unseen, never which ids.

Reading collections needs nothing extra: the per-caller catalog feed carries the collections a
caller's groups admit, with members narrowed to the assets that caller is already served.

### Narrow an organisation destination

`delivery.create` is the right to send to a fixed organisation destination, and every member
carries that right. A deny takes one destination away from a group:

```bash
lw grants add group:contractors delivery.create 'destination:campaign-archive' --effect deny
```

How destination grants, approval chains and automation outputs interact is on [Organisation
delivery destinations](delivery.md#who-may-send).

## Owner-only powers

Five actions stay with owners, so an admin can run the instance without being able to widen
their own authority:

| Action | What only an owner can do |
|---|---|
| `instance.config` | change the deployment configuration |
| `catalog.provider.credential` | store a provider credential, flip its enable switch and run the exit's cutover |
| `catalog.provider.publish` | publish Lolly exports out to a destination DAM, an outbound write to a third party |
| `scim.manage` | mint a SCIM provisioning token for your provider |
| `token.manage` | mint a service token for automation |

An admin can still shape a catalog provider and copy its files into the instance's own store.
An owner can hand any of these actions out per resource through a grant, but an admin cannot
grant one to themselves.

### The escalation guard

A grant that creates or removes any owner-only action needs the **owner** role, even though
editing grants is otherwise an admin action. Attempting it returns `403 OWNER_ONLY_ACTION`. The
same guard applies when a [governance document](governance.md#policy-as-code) is applied.

Only an owner may create or remove an owner-mapped local group, assign owner membership, or
change an owner account's local groups. The same applies to groups that hold owner-only
grants. Admins may manage groups within their own role.

## Guest write authority

Grants never evaluate a guest **as a principal**: `server/src/collab/guests.ts` imports nothing
from `rbac/`. A guest's ability to write in a live room comes from the **kind** of link that
admitted them. A `guest-edit` link gives a writer seat, and no other link kind admits a guest
at all.

That asymmetry is easy to trip over. A grant such as

```bash
lw grants add '*' session.edit '*' --effect deny
```

silences every **member's** write access in a live room (`mayEditCollab` calls `evaluate()`)
and reaches no guest, because a guest's writer or observer seat never runs `evaluate()` against
the guest's own principal.

**The exception is `link.create-guest`, evaluated against the inviter.** The gateway checks the
inviter's standing again on every gesture and every keepalive (`guestInviterStanding`, then
`mayCreateGuestLinks`, then `evaluate()`, in `gateway.ts`). An inviter who loses that action
stops minting links *and* loses the guests already holding them, so offboarding an inviter
removes their guests at once.

| Lever | Effect |
|---|---|
| An `inputAccess` rule ([governance](governance.md#per-input-access)) | Locks, hides or restricts one input for every guest, in every room, without naming anyone. Governing an input at all locks it for guests (below). |
| Revoking the link (`POST /api/v1/links/:id/revoke`) | Ends that guest's write access on their next gesture. The room reads the link again per gesture and per keepalive, the same cadence a member's grant revocation takes. |
| `guestLinks.enabled: false` ([configuration](configuration.md)) | The instance-wide switch. Stops new links *and* removes every guest already connected. |
| Taking `link.create-guest` off the **inviter** (a deny grant, a role change, leaving the group that carried it or disabling the account) | Removes every guest **that inviter** admitted, on the guest's next operation or keepalive, and leaves other people's guests alone. It covers links nobody can list. |

The `inputAccess` lever works one way for guests: governing an input **at all** locks it for
them. A guest carries only the synthetic `guests` group and never inherits the member-side
`editable` fallback (`vetoOps` and `inputIsGoverned`, `INPUT_LOCKED`), so even
`{"groups": ["guests"], "level": "editable"}` resolves to locked in a live room. An input with
**no** rules stays editable for everyone, guests included.

## Checking your work

Never guess what a person will see. Ask the same assembler the live client polls:

```bash
lw preview --groups marketing,contractors
```

The console's **Preview** view and `GET /api/v1/org-config/preview?groups=…` give the same
answer. The preview reports the resolved role, permissions, tool visibility, per-input
governance and profile policy for that set of groups. It runs through the production code path,
so it cannot drift from what the member actually receives.

That answer is the org-config document a connected shell polls, `GET /api/v1/org-config`: the
person's identity, role and permissions, tool and input governance, managed profile fields and
feature flags, filtered for their groups and tagged with an `ETag` tied to the policy version.
Profile fields that come from the identity provider arrive as `mode: locked, source: idp`,
which is what draws the padlocks in the shell's profile view.

## Related

- Locking individual tool inputs: [governance](governance.md)
- Who can approve what: [approvals](approvals.md)
- Exporting the whole grant set as one document: [governance](governance.md#policy-as-code)
