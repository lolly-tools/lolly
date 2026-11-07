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
when you rename the programme later. On the programme's page, **Owning team** is the group
inside your organisation that runs the programme; when a partnership ends, its people's projects
go to that team.

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
To give one folder of it, use [Provider folders](#provider-folders).

Per-input locks work for programmes as for any group: add a rule for `programme-<id>` in the
tool's overlay ([Policy and governance](governance.md#per-input-access)).

## Provider folders

**Provider folders** on the programme's page gives one folder of a connected source, and
everything inside it, to the programme or to one company in it, until an optional end date. Its
people then get those files even when the source is otherwise for your own people, and nothing
else from that source. Choose the source, then the folder: the list shows every folder the
source's last sync found, with how many files each holds.

Nothing is chosen at first, and **All of it** comes last, so pressing the button without looking
never gives the whole source away. When the folder you choose holds other folders, the line
above the button lists them, for example "This includes Internal (2) and Internal/Roadmaps (1)",
so you can check what comes with your choice before you press the button.

The folder decides everywhere a partner meets those files: the catalog, the files themselves,
links they make and search. A file outside the folder answers as if it did not exist for them.
When the end date passes, the files go at once. Deleting a company or a programme removes its
folders. A source enabled a moment ago is listed as syncing until its first sync finishes.

Each source reports folders in its own way: S3 and Dropbox by key prefix, WebDAV and
OneDrive/SharePoint by directory, Brandfolder by section. Google Drive reads one folder unless
you turn on `recursive` ([Google Drive](providers/gdrive.md)).

Licence records do not decide what a provider folder carries yet. That comes with
licence-aware exposure, which will apply the same rule to collections, folders, links and
downloads.

## Companies

A programme can hold companies: the partner organisations in it, such as one reseller or one
distributor. Add one under **Companies** on the programme's page. Each company has a group,
`company-<id>`, shown by its name in the console, so an input rule, a collection or a grant can
point at one company the way it points at a whole programme. A person can be added to a company when they
are added to the programme. A collection, an instance asset or a connected provider shared with a
company's group reaches that company's people and nobody else's. A company's input rule overrides
its programme's rule, which is how one company gets an exception
([Input rules for partners](#input-rules-for-partners)).

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
same list again changes nothing. People who already sign in are added at once, and a company the
line gives them is set too. Everyone else gets an invitation carrying the programme's and
company's groups, open until their end date or for at most 366 days.

Lolly Work sends no email, so the result offers one message for everyone the list invited: where
to sign in, the sign-ins on offer, the end date and your `instance.inviteNote`, with a copy
button. Send it once by email or chat. Each person's own invite link stays in **People** →
**Invitations** for anyone you would rather invite one by one.

The programme's **People** list shows everyone in it: who signs in, and who is invited and has not
signed in yet, with their company and end date. End dates read as the day in UTC, for example
"Ends 30 Jun 2027 (UTC)".

People also join a programme through its group:

- **One at a time.** In **People**, invite someone or open a person who already signs in, and
  tick the programme, shown as "*Programme name* (partner programme)".
- **From your identity provider.** A provider group or a SCIM group with the same name puts people
  in the programme the same way.

Joining a programme also adds the `partner` group. Leaving a programme keeps it, so a former
partner sees only your design system's essentials rather than everything internal. To make an
account internal, remove `partner` from that person in **People**.

## Add people by domain

Under **Domains** on the programme's page, add a partner's domain, such as `northwind.example`,
with an optional company and end date. Anyone who signs in with an address at that domain then
joins the programme and the company, without an invitation each. Only an address the sign-in
provider has verified counts. A claimed address never does, and the exact domain is matched, so
`emea.northwind.example` needs its own entry.

**Preview** first lists the people at that domain who already sign in here. Partner accounts
(people who are, or were, in a programme) show whether each joins now, joins later or does not
join, with the reason. Everyone else is listed apart as **Already in this workspace as staff: will
not join**, with the count. Then choose how the domain is proved:

- **Proved by DNS** (the usual way). You get a TXT record for the partner to publish in their DNS:

  ```
  _lolly-work.northwind.example  TXT  "lw-verify=<token>"
  ```

  The domain shows **Waiting for the DNS record** until Lolly Work finds the record. Lolly Work
  looks every hour, and **Check now** looks straight away. Once found, the domain shows **DNS
  verified** and is looked up again every day. If a later lookup finds the record gone, the domain shows **Paused**:
  nobody new joins through it until the record is back, and people already in keep their access.
  A lookup that fails for another reason, such as a timeout, changes nothing.
- **On your say-so.** The domain is active at once and shows **Admin-asserted**, with your name, the
  date and the reason you give. All three go in Audit as `programme.domain.assert`. Use this when
  the partner cannot publish a DNS record, for example while a contract is being signed. A domain
  waiting for its record has **Activate without DNS** for the same override, and an admin-asserted
  domain has **Prove by DNS instead** to move it to DNS proof.

Two kinds of domain are refused either way: public mail domains, such as `gmail.com` or
`outlook.com`, where anyone can have an address; and your own domains, which are your workspace's
address, a domain a sign-in provider is limited to, and the domains of your owners' and admins'
addresses. People at a public mail domain are added by list instead.

When a domain becomes active, the partner accounts at it join at once, if a provider has verified
their address, and the rest of them join at their next sign-in. People who sign in for the first
time with an address there join too. A person joins through a domain once, so removing someone from
the programme in **People** sticks.

Staff are never moved by a domain on its own. Joining a programme limits someone to its tools and
assets, so an account that already signs in here and is not a partner keeps its access when you add
its domain, at that moment and at every later sign-in. That protects your own people when a domain
also carries staff: a second corporate domain, a subsidiary, or a domain in
`idp.admission.domains`. When you do mean to move them, for example while moving a partner from
`idp.admission.domains` to a domain here, tick **Also move these accounts into the programme as
partners** in the preview. The move is recorded in Audit as `programme.domain.move-staff`, with the
accounts moved. A partner domain never lets staff in on its own either, so revoking a staff
member's invitation still stops their sign-in.

Lolly Work never adds a domain's programme to an admin, an owner, a disabled account or an account
your SCIM connector manages: SCIM decides for the people it manages. With single sign-on, the
programme and company are added on top of the groups the provider sends.

**Remove** stops new people joining through a domain. People who already joined stay until you end
their access or their end date passes. The programme's **People** list says who joined through a
domain.

## End dates

An end date on a line, or on a domain, ends access through the programme at the end of that day,
in UTC, without anyone having to remember. The server checks every minute, takes the programme's
and company's groups off the account, keeps the `partner` group and withdraws an invitation the
line made that nobody has accepted. Each ending is audited as `programme.member.end`. A domain's
end date also stops anyone new joining through it, audited as `programme.domain.rule.end`. A
deployment that runs as serverless functions calls `POST /api/v1/programmes/sweep` on a schedule
instead.

## See what they get

**See what they get** opens Preview for the programme's group, before anyone is invited. Preview
shows the tools the programme can open, the number and kinds of assets it gets, its collections
and a sample of asset names, along with its permissions and the input rules it meets. It asks the
same code the app does, so what you see is what they get.

## A person in two programmes

Someone in two programmes gets the tools and assets of both.

## Input rules for partners

For someone in a programme, the order you wrote a tool's input rules in never decides. Three rules
apply instead:

- **A company's rule overrides its programme's rule.** The company is the more specific scope. If
  Resellers locks the price and Northwind IT, a company in Resellers, has a rule that leaves the
  price editable, Northwind's people can edit the price and every other reseller cannot, whichever
  rule comes first.
- **Across programmes, the stricter result wins**: hidden, then locked, then a restricted choice,
  then editable. Two restricted choices keep only the values both allow. This matches grants, where
  a deny wins over an allow. Someone in two programmes, each with a company, gets each programme
  worked out with its company first, then the stricter of the two.
- **A programme or company rule beats a rule for everyone** (`*`) or for one of your own groups.

Rules for your own people keep the order you wrote them in. When two partner rules are equally
strict, the one written first counts.

**Preview** shows, for each input, which rule decided and why, for example "Decided by the rule
for Northwind IT, a company in Resellers, which overrides the rule for Resellers". Only admins see
this. A partner sees the input locked, limited or editable, with no line about the rule.

## When someone leaves

Removing a person from a programme takes its tools and assets away on their next request. Links
they made to assets, collections or tools stop working at the same moment
(`410 LINK_MAKER_NO_ACCESS`), because a partner's link only ever hands on what their programmes
still include.

### End a partnership

**End this partnership** on the programme's page, or `POST /api/v1/programmes/exit` with a
programme, a company, a domain or a list of addresses, first shows what ending it does: the
accounts, the projects each owns, the links each made, the invitations still open and the domains
that stop letting people join. Choose what happens to their projects:

- **Move their projects to the owning team, read-only** (the default when the programme has an
  owning team): the person who made the programme becomes the owner (you, when that account
  cannot hold work), the team gets them as viewers and the projects are archived, so the work
  stays and nobody edits it further.
- **Move their projects to me, read-only** (the default when there is no owning team).
- **Move their projects to me, editable.**
- **Leave their projects where they are.**

Confirming then, in one step, first withdraws those domains (a whole domain when you chose one,
or the programme's or company's entries on every domain otherwise), so nobody new joins while the
rest runs. It then disables each account and signs it out everywhere, revokes the
links, agent tokens and password links each person made, ends their memberships and withdraws the
open invitations. Only partner accounts are touched: an internal account in a list is shown as
left alone. Each account is audited as `user.offboard` and the whole step as `programme.exit`.

Deleting a programme removes its grants, takes its group off every collection and deletes the
group. Its people keep the `partner` group.

## API and audit

```
GET    /api/v1/programmes                         # programme.manage: every programme, with its tools, collections and people
GET    /api/v1/programmes/:id
PUT    /api/v1/programmes/:id                     # { name, description?, team?, tools?, collections? }: create or replace
DELETE /api/v1/programmes/:id
PUT    /api/v1/programmes/:id/companies/:company  # { name }
DELETE /api/v1/programmes/:id/companies/:company
GET    /api/v1/programmes/:id/people              # people, companies and open invitations
POST   /api/v1/programmes/:id/people              # { text } or { rows }: a preview; add "apply": true to do it
POST   /api/v1/programmes/exit                    # { programme | company | domain | emails, projects?, transferTo? }: a preview; "apply": true does it
                                                  # projects: team-readonly, me-readonly, me or keep
POST   /api/v1/programmes/sweep                   # end what has passed its end date, and look up the domains that are due
GET    /api/v1/partner-domains[?programme=<id>]   # every partner domain, its proof, the record to publish and its programmes
PUT    /api/v1/partner-domains/:domain            # { programme?, company?, endsAt?, proof?: "txt" | "admin", reason?, dryRun?, moveStaff? }
POST   /api/v1/partner-domains/:domain/check      # look the TXT record up now
DELETE /api/v1/partner-domains/:domain[?programme=<id>]
GET    /api/v1/programmes/:id/folders             # its provider folders, and every folder each source's last sync found, with counts
PUT    /api/v1/programmes/:id/folders             # { provider, path, company?, endsAt? }; the whole source is path "" with whole: true
DELETE /api/v1/programmes/:id/folders?provider=&path=&company=
```

A `PUT` that leaves out `tools` or `collections` keeps what the programme had. Each change is
audited as `programme.create`, `programme.edit` or `programme.delete` with the before and after,
and each grant and collection change it makes is audited as its own `grant.create`,
`grant.delete` or `catalog.collection.edit`, with `via: "programme:<id>"`.

Adding people is audited per person as `programme.member.add` (with the account or invitation,
never the address, and `via: "domain"` with the domain for someone who joined through one), and
companies as `programme.company.create`, `.edit` and `.delete`. Domains are audited as
`programme.domain.add`, `.rule`, `.assert`, `.proof`, `.verify`, `.pause`, `.move-staff` and
`.remove`. Provider folders are audited as `programme.folder.add`, `.edit`, `.remove` and `.end`.

The same steps from the command line:

```bash
lw people import resellers-emea roster.csv            # a preview; add --apply to do it
lw domains add northwind.example --programme resellers-emea --company northwind --ends 2027-06-30
lw domains add northwind.example --programme resellers-emea --assert --reason "Agreement 4411"
lw domains add northwind.example --programme resellers-emea --dry-run      # staff are listed with their ids
lw domains add northwind.example --programme resellers-emea --move-staff <id,id>
lw domains check northwind.example
lw folders add partner-dam Partners/EMEA --programme resellers-emea --company northwind --ends 2027-06-30
lw folders --programme resellers-emea                 # its folders, with counts
lw people exit --domain northwind.example             # a preview; add --apply to do it
```

## Not yet

Partner company profiles with their own logos, agent tokens for a programme and templates
published to a programme are planned.

## Related

- Who can do what: [Roles and grants](permissions.md)
- Locking inputs per group: [Policy and governance](governance.md)
- Collections: [Catalog and content](catalog.md#collections)
- Inviting people: [Invite people and handle requests](invitations.md)
