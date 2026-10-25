# Policy and governance

This page is for the brand or design-system admin who sets the rules members work within:
which tools each group sees, which inputs they may change, which shell features they get and
how to keep all of it as one reviewable document. A typical rule: sales can change the
headline, but not the logo.

Governance is data, held on the server, edited live and exportable as one document. It never
forks the pack's `tool.json`: the open-source tool definition stays untouched, and Work lays
its rules over that definition. Everything here is live-editable in the console (**This Deploy → Tools**,
**This Deploy → Feature flags** and **Grants**) and reaches connected shells on their next
poll.

![Tool policy: lock a preset, restrict choices or hide an input entirely, per group](shots/tool-policy.svg)

## Tool overlays

Each tool has one versioned overlay, saved with `PUT /api/v1/policy/overlays/:toolId` under
`policy.edit`. That action is admin by default and can be granted to a brand group, so a brand
team can govern inputs without holding the admin role. Saving records the before and after in
the audit log and clears the render cache for exactly the affected renders.

### Per-input access

`inputAccess` maps an input id (or `*` as the default) to an ordered list of rules. The first
rule whose groups match the person wins, and no match means `editable`.

::: figure work-governance-rule-order
Work reads one input's rules from the top and stops at the first group that matches.
:::

| Level | Effect |
|---|---|
| `editable` | a normal input |
| `choice` | restricted to `allow: [...]` |
| `locked` | replaced by `value`; the person never supplies it |
| `hidden` | removed from the schema entirely |

```json
"inputAccess": {
  "logo": [
    { "groups": ["brand-team"], "level": "editable" },
    { "groups": ["*"], "level": "locked", "value": "lolly/logo/primary" }
  ],
  "discount": [
    { "groups": ["sales-managers"], "level": "editable" },
    { "groups": ["*"], "level": "hidden" }
  ]
}
```

Enforcement happens on the server, before rendering. A locked input supplied by a caller is a
`422 INPUT_LOCKED`, and the locked value is used whatever the request said. The same pure
functions filter the schema the shell sees, so the interface and the enforcement cannot
disagree.

Give the overlay a `name` and a rule an optional `reason`, and a person meets an answer instead
of a dead control. The resolved access carries `by` (the overlay name) and `reason` into
`org-config`, where the shell prints them under the input, and into the `422` body as
`{ "error": { "code": "INPUT_LOCKED", "input": "bg", "by": "...", "reason": "..." } }`, so an
agent driving a render reads the same explanation. Both are optional, and an unnamed overlay
attributes nothing.

Guests are a special case: governing an input at all locks it for them
([guest write authority](permissions.md#guest-write-authority)).

### Visibility

```json
"visibility": { "groups": ["brand-team", "marketing"] }
```

A tool with a `visibility` block is **absent** from the catalog feed for anyone outside those
groups: not greyed out, not hidden in the client. `*` means everyone.

### The enforce block

| Key | Values | Status today |
|---|---|---|
| `formats` | for example `["svg","png"]` | Enforced: restricts output formats. |
| `watermark` | `always` | Enforced: every render carries the [PREVIEW watermark](sharing.md#preview-watermarking). |
| `watermark` | `never` | Enforced: no render carries the watermark, including a render made for a share link or preview that would otherwise ask for one. |
| `watermark` | `until-approved` | Stored, not linked to approval state yet: it behaves like no rule, so only a render made for a share link or preview carries the watermark. Set `always` if you need the watermark on every render. |
| `defaults` | input values | Stored, not applied to a tool's initial inputs by org-config or the render paths. Locked presets do enforce values. |
| `c2pa`, `escalation` | | Declared in the overlay type, refused by the write paths. Signing is instance-wide through `render.c2pa` ([Configure Work export signing](c2pa.md)), and chain binding works as [Approvals](approvals.md) describes. |

The console offers **Always watermark**, **Never watermark** and **No rule** for new edits. An
existing `until-approved` setting is kept with a warning that it is not enforced. Stored fields
the policy writer cannot keep, such as `enforce.escalation`, block a console save with an
explanation rather than being silently removed.

::: details Using the policy editor
- The console keeps saved format restrictions and input defaults when you edit inputs,
  visibility or watermarking.
- An unchanged preset or choice keeps its saved type, including strings that look like
  numbers. Enter a JSON array for choices that contain commas or typed values, for example
  `["blue, green", "42", 42]`. Comma-separated simple choices still work.
- An explicitly edited blank preset locks to an empty string.
- Remove a rule with **Remove**. Clearing its groups is an error, not an implicit deletion.
- Enter group names containing commas as a JSON array, for example
  `["Sales, EMEA", "brand"]`; unchanged group lists are kept.
- **Move up** and **Move down** order an input's rules. New exceptions are inserted before the
  first rule for everyone, and the editor warns when an earlier rule covers the same groups.
- Closing, switching tools or leaving with a draft offers **Keep editing** or **Discard
  changes**, and leaving the page also triggers the browser's unsaved-changes warning. A failed
  save keeps the draft.
- The form does not protect against another administrator replacing the same policy at the
  same moment; the API is a full replacement.
:::

![Preview-as-group: the exact role, permissions and governance a set of groups would receive](shots/preview-as-group.svg)

Before you rely on a rule, preview what a group will see ([Checking your
work](permissions.md#checking-your-work)).

## Design systems and injectables

Two more tabs in **This Deploy** govern what members work with:

- **Design system** chooses which installed design system the deployment serves, and connects
  its published rules to tool inputs. Rules from a managed design system combine with the
  overlays on this page, and organisation locks, choices, formats and permissions stay
  authoritative. See [Design-system administration](design-system-administration.md#managed-production-rules).
- **Injectables** publishes assets and tools into members' shells, under
  `catalog.injectable.manage`. The routes are in the [API reference](api.md).

## Profile governance

Identity fields the identity provider owns are managed, not editable. `claimMap` decides which
claim fills `firstname`, `lastname`, `email` and `title`, and those fields reach the shell as
`mode: locked, source: idp`, which draws the padlocks in the shell's profile view. The person
keeps every field your organisation has no opinion about.

## Feature flags

Work governs the shell's per-person feature toggles it knows about, for the whole instance,
with two settings per flag:

| Setting | Values | Meaning |
|---|---|---|
| `default` | `on`, `off` or unset | what a person who has not chosen gets; unset inherits the shell's built-in default |
| `visibility` | `show` or `hide` | whether the person sees the toggle at all; hiding removes the control while the default still applies |

![The Feature flags tab: a default and a visibility for each governed flag](shots/feature-flags.svg)

Governable today (the ids are the shell's own):

| Flag | Built-in default | What it is |
|---|---|---|
| `neurospicy` | on | a calmer, lower-stimulation interface with an optional focus-music dock |
| `jelly-effects` | on | a soft squish on chrome controls; respects reduced motion and never touches output |
| `strip-upload-metadata` | off | strips EXIF and GPS from uploaded images (Content Credentials are kept either way) |
| `export-preflight` | off | the export panel's prepress card: bleed, resolution, ink coverage and plate counts |
| `private-collab` | on | the device-to-device invite and accept for editing together; force it off and hide it to route collaboration through Work only |
| `nearby-discovery` | on | mDNS discovery of nearby Lolly devices for handing over collab invites (native shells only) |

`GET /api/v1/policy/flags` and `PUT /api/v1/policy/flags/:flagId` use the same `policy.edit`
gate. The `off` and `hide` combination is how a seasonal surprise ships dark: stage it now, flip
the default on the day, and it appears without ever having shown a switch.

**Managed AI** is different: it is a service execution switch with a deployment approval
ceiling, and it has no personal override. See [Manage organisation AI policy](ai-policy.md).

## Policy-as-code

One canonical document holds the whole governance state, serialized deterministically so that
logically equal states hash the same:

- grants;
- tool overlays;
- approval chains;
- catalog-provider **configuration and exposure** (never credentials, runtime state or the
  enable switch);
- feature-flag governance;
- your catalog metadata **definitions** (`catalogFields`), the fields you file assets under
  ([catalog](catalog.md#org-defined-metadata)). The per-asset values are not policy and never
  appear in the document;
- hidden catalog tags (`tagRules`), one entry per scope: `*` for the whole catalog or
  `provider:<id>` for one provider ([catalog](catalog.md#hiding-tags)). The key is left out
  when nothing is hidden, so an earlier export hashes the same.

```bash
lw export --out governance.json                # GET /api/v1/config/export
lw apply governance.json --dry-run             # POST /api/v1/config/apply?dryRun=1 - shows the diff
lw apply governance.json                       # apply
lw apply governance.json --prune               # also delete store-only entries
```

The diff reports create, update, delete and unchanged per category, and the response carries
the document hash. Two guards apply:

- A document that creates or removes a grant on an owner-only action needs the **owner** role
  (`403 OWNER_ONLY_ACTION`), as described in [the escalation
  guard](permissions.md#the-escalation-guard).
- Entries a config-managed catalog provider owns are conflicts, not overwrites
  (`409 CONFIG_MANAGED`): edit `instance.json` and redeploy instead.

Pruning a `catalogFields` entry removes the **definition** only. Values already filed under it
survive, hidden from every served surface until the definition comes back, so a taxonomy change
never destroys the data filed under a field.

### Seeding at boot

```bash
LW_SEED_CONFIG=./governance.json npm start
```

Seeding is idempotent, so it is safe to leave set. It is trusted (it needs filesystem access),
so it bypasses the owner-only HTTP guard and may seed owner-only grants. It still never enables
a provider or stores a credential, because neither is in the document. Seeding brings a fresh
deployment up already governed, and makes governance reviewable and promotable between
environments, for example from version control.

## Related

- Who may edit any of this: [Roles and grants](permissions.md)
- What a connected shell receives: [Checking your work](permissions.md#checking-your-work)
- Provider exposure rules: [Catalog and content](catalog.md)
