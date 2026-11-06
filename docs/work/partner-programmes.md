# Partner programmes

This page is for the admin who gives outside partners a way into Lolly Work: distributors,
software partners, resellers, agencies, or whatever your organisation calls the people it works
with. A partner programme is your own name for one kind of partner, and it decides what that
kind of partner gets. Lolly Work has no fixed list of partner types.

Someone in a programme sees only what their programmes include. Your own people are unaffected.

## What a programme does

Each programme wraps one group, `programme-<id>`, and everyone in that group is in the
programme. For a person in any programme:

- **Tools.** Only the tools a programme includes appear: in the gallery, in the tool files, in
  server renders and to agents. A tool shared with everyone through its overlay's visibility does
  not reach them.
- **Assets.** They get your design system's tokens, fonts and palettes, because every tool
  draws with them. Beyond those, only the assets in collections a programme includes, and any
  submitted asset or connected provider whose groups list the programme's group. An asset,
  collection or provider shared with everyone does not reach them.
- **Everything else shared with everyone** stays internal too: announcements sent to everyone,
  projects shared with everyone in the workspace, and injectables for everyone.

Admins and owners are never narrowed, so trying a programme out on your own account cannot lock
you out.

## Create a programme

In the console, open **Partner programmes**, type a name such as "Resellers, EMEA" and press
**Create programme**. The id comes from the name and never changes, so the group stays the same
when you rename the programme later.

Managing programmes needs `programme.manage`, which admins have and which can be granted to a
group, for example a partner team:

```bash
lw grants add group:partner-team programme.manage '*' --effect allow
```

## Choose what it gets

Open a programme with **Choose what they get**:

- **Tools.** Tick the tools its people may open. Each tick is a `tool.use` allow grant for the
  programme's group, listed in **Grants** and in the governance document like any other grant.
- **Collections.** Tick the collections whose assets reach the programme. A ticked collection
  gives its assets to the programme's people even when your own people need a group to see them.
  Each tick adds the programme's group to the collection's groups, so the collection stays
  visible to everyone it reached before.

To give one asset to a programme without a collection, submit it with the programme's group,
for example `lw catalog submit ./price-sheet.pdf --name "Price sheet" --groups programme-resellers-emea`.
Anyone with `programme.manage` may submit into a programme's group without joining the programme.
To give a whole connected provider, add the programme's group to the provider's exposure groups.

Per-input locks work for programmes as for any group: add a rule for `programme-<id>` in the
tool's overlay ([Policy and governance](governance.md#per-input-access)).

## Companies

A programme can hold companies: the partner organisations in it, such as one reseller or one
distributor. Add one under **Companies** on the programme's page. Each company has a group,
`company-<id>`, shown by its name in the console, so an input rule, a collection or a grant can
point at one company the way it points at a whole programme. A person can be added to a company when they
are added to the programme.

## Add people

**Add people** on the programme's page takes a pasted list or a CSV file's text, one address per
line, optionally followed by a name, a company and an end date, separated by commas:

```
email,name,company,ends
ana@partner.example,Ana Silva,Northwind IT,2027-06-30
bo@partner.example
```

**Preview** shows what each line will do before anything happens: new and to be invited, already
signing in and to be added, already in with nothing to do, or not possible, with the reason (an
address that is not one, a company the programme does not have, an end date that has passed, a
line listed twice). **Add** then does it in one step and shows a result for each line. Adding the
same list again changes nothing. People who already sign in are added at once. Everyone else gets
an invitation carrying the programme's and company's groups, open until their end date or for at
most 366 days. Lolly Work sends no email, so send the invite messages from **People** →
**Invitations**, or send one message telling everyone to sign in.

People also join a programme through its group:

- **One at a time.** In **People**, invite someone or open a person who already signs in, and
  tick the programme, shown as "*Programme name* (partner programme)".
- **From your identity provider.** A provider group or a SCIM group with the same name puts people
  in the programme the same way.

Joining a programme also adds the `partner` group. Leaving a programme keeps it, so a former
partner sees only your design system's essentials rather than everything internal. To make an
account internal, remove `partner` from that person in **People**.

## End dates

An end date on a line ends that person's access through the programme at the end of that day,
in UTC, without anyone having to remember. The server checks every minute, takes the programme's
and company's groups off the account, keeps the `partner` group and withdraws an invitation the
line made that nobody has accepted. Each ending is audited as `programme.member.end`. A
deployment that runs as serverless functions calls `POST /api/v1/programmes/sweep` on a schedule
instead.

## See what they get

**See what they get** opens Preview for the programme's group, before anyone is invited. Preview
shows the tools the programme can open, the number and kinds of assets it gets, its collections
and a sample of asset names, along with its permissions and the input rules it meets. It asks the
same code the app does, so what you see is what they get.

## A person in two programmes

Someone in two programmes gets the tools and assets of both. Where both programmes have an input
rule for the same input, the stricter rule wins: hidden, then locked, then a restricted choice,
then editable. Two restricted choices keep only the values both allow. This matches grants, where
a deny wins over an allow. Rules for your own groups keep the order you wrote them in.

## When someone leaves

Removing a person from a programme takes its tools and assets away on their next request. Links
they made to assets, collections or tools stop working at the same moment
(`410 LINK_MAKER_NO_ACCESS`), because a partner's link only ever hands on what their programmes
still include.

### End a partnership

**End this partnership** on the programme's page, or `POST /api/v1/programmes/exit` with a
programme, a company or a list of addresses, first shows what ending it does: the accounts, the
projects each owns, the links each made and the invitations still open. Choose what happens to
their projects:

- **Move their projects to me, read-only** (the default): you become the owner and the projects
  are archived, so the work stays and nobody edits it further.
- **Move their projects to me, editable.**
- **Leave their projects where they are.**

Confirming then, in one step, disables each account and signs it out everywhere, revokes the
links, agent tokens and password links each person made, ends their memberships and withdraws the
open invitations. Only partner accounts are touched: an internal account in a list is shown as
left alone. Each account is audited as `user.offboard` and the whole step as `programme.exit`.

Deleting a programme removes its grants, takes its group off every collection and deletes the
group. Its people keep the `partner` group.

## API and audit

```
GET    /api/v1/programmes                         # programme.manage: every programme, with its tools, collections and people
GET    /api/v1/programmes/:id
PUT    /api/v1/programmes/:id                     # { name, description?, tools?, collections? }: create or replace
DELETE /api/v1/programmes/:id
PUT    /api/v1/programmes/:id/companies/:company  # { name }
DELETE /api/v1/programmes/:id/companies/:company
GET    /api/v1/programmes/:id/people              # people, companies and open invitations
POST   /api/v1/programmes/:id/people              # { text } or { rows }: a preview; add "apply": true to do it
POST   /api/v1/programmes/exit                    # { programme | company | emails, projects?, transferTo? }: a preview; "apply": true does it
POST   /api/v1/programmes/sweep                   # end the memberships whose end date has passed
```

A `PUT` that leaves out `tools` or `collections` keeps what the programme had. Each change is
audited as `programme.create`, `programme.edit` or `programme.delete` with the before and after,
and each grant and collection change it makes is audited as its own `grant.create`,
`grant.delete` or `catalog.collection.edit`, with `via: "programme:<id>"`.

Adding people is audited per person as `programme.member.add` (with the account or invitation,
never the address), and companies as `programme.company.create`, `.edit` and `.delete`.

## Not yet

Admitting everyone at a partner's verified domain, a programme's folder in a connected provider,
partner company profiles with their own logos, agent tokens for a programme and templates
published to a programme are planned.

## Related

- Who can do what: [Roles and grants](permissions.md)
- Locking inputs per group: [Policy and governance](governance.md)
- Collections: [Catalog and content](catalog.md#collections)
- Inviting people: [Invite people and handle requests](invitations.md)
