# Partner programmes

This page is for the admin who gives outside partners a way into Lolly Work: distributors,
software partners, resellers, agencies, or whatever your organisation calls the people it works
with. A partner programme is your own name for one kind of partner, and it decides what that
kind of partner gets. Lolly Work has no fixed list of partner types.

Someone in a programme sees only what their programmes include. Your own people are unaffected.

This page is the reference. For the team that runs programmes day to day, [Run a partner
programme](run-a-partner-programme.md) is the guide: what partners get, and how to set up, run and
end a programme. It has a page for each subject: [co-branding and partner
kits](partner-co-branding.md), [templates](partner-templates.md), [approvals](partner-approvals.md),
[shared assets and licences](partner-shared-assets.md), [agents](partner-agents.md) and [people and
the partnership](partner-people.md).

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

### What partners can never do

One fixed list of actions is all a partner can ever be allowed, whatever a role default or a grant
says. It applies to everyone in a programme, to a programme's agent tokens and to an admin viewing
as a partner. The list: `catalog.read`, `tool.use`, `session.view`, `session.create`,
`session.edit`, `session.delete`, `session.share`, the `comment.*` actions, `collab.join`,
`project.create`, `export.download`, `export.request`, `export.server`, `link.create` and
`catalog.submit`.

Every other action is refused for partners. That covers the delegated admin actions, such as
`grant.edit`, `policy.edit`, `programme.manage`, `catalog.edit`, the collection and provider
actions, `link.revoke`, `link.create-guest`, `audit.export`, `message.send`, `approval.act`,
`user.invite`, `brand.*`, `instance.config` and `token.manage`. Two member defaults go as well:
`group.create`, because partners share through their company, and `delivery.create`, because a
delivery sends to your own destinations. So a partner's app offers no **New group** and no **Send
to**.

A grant that cannot apply to partners is marked. `GET /api/v1/grants` and the answer to a new grant
carry `partnerScope`: "Does not apply to partner programme members: `<action>` is not available to
partners."

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

A programme receives only the files you share with the programme. Share the logos and pictures
its templates use, for example as a logos collection ticked here, before you publish the templates. A template
that uses a file the programme was not given is incomplete for its partners, and with the
[licence gate](#licences) on, a server render that uses the file answers `422 ASSET_HELD`. The
programme's licence report lists each published template that uses a file one of its audiences
will not receive.

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

With the [licence gate](#licences) on, a folder's files reach partners only as their licence
records allow. When you choose a folder, the form says how many of its files have no licence
record, and **These files are ours** marks the folder as your own in the same save.

## Licences

The licence each file records can decide what reaches partners. One setting chooses,
`policy.catalog.partnerRights`:

- **`gate`.** A catalog file reaches a partner, or anyone holding a link a partner made, only when
  one of four things holds: its recorded licence lets the file be passed on, your team marked it as
  your own, its type is exempt or a programme manager chose to share that file anyway with that
  programme or company.
- **`report`.** Nothing partners receive changes. The licence report says what the gate would hold
  back, so you can prepare before you turn the gate on.

When the setting is absent, the instance decides once, at its first start on this release: a new
instance with no accounts yet gates, and an instance upgraded with accounts already in place
reports. The decision never changes by itself, and the setting always wins over the decision. The
report, the **Licences** card and the setup wizard's **Licence gate for partners** check give the
mode and the reason in one line, with the setting to change.

Your own people receive exactly what they did before, in either mode. Some files are exempt,
because every tool needs them or because they are yours by nature: tokens, fonts, palettes,
templates, rules tools, user tools and brand skills, plus a company's own files for that company.

**What the gate covers.** For a person or an agent token in a programme: the catalog feed, the
files themselves, browsing, search (including live results from a provider), the organisation
MCP's asset search and the links they make. A held file is simply absent, and nothing tells a
partner that more may come. A server render or compile that uses a held file, through a template's
values, the company's details or the caller's own values, answers `422 ASSET_HELD` with each file:
"This render uses a file that is not available to you: `<ids>`." In report mode, renders are
unchanged.

### Mark your own files

Most brand teams never recorded a licence on their own logos and photographs. A mark says once
that a set of files is your own, so they travel to partners:

- **One file** (`asset:<id>`), **a folder** of a connected source (`folder:<provider>/<path>`),
  **a whole source** (`provider:<id>`) or **a pack's id prefix** (`prefix:<prefix>/`).
- The holder starts as the workspace's name. The terms start as "Published by `<holder>` for the
  people and partner programmes of this workspace to use in their work. Not an open licence."
- A marked file travels as "Owner-published, not an open licence", and partners read that in its
  details. The mark is your own statement: "Recorded as `<holder>`'s own statement by `<name>` on
  `<date>`. Lolly does not check ownership."
- A mark reaches only files that declare nothing of their own. A file's own licence, a provider's
  value and a reviewed licence are never replaced. A licence record answers before any mark, and
  the narrowest mark wins: one file, then the deepest folder, then the source, then the longest
  prefix.
- Pack files that declare a licence identifier the rules do not read cannot take a mark. The report
  groups them by id prefix and says: "The owner can record these as owner-published in the pack, or
  the rules can be widened. Ask your Lolly administrator."

You can also **record the licence** of one file that records none, as your workspace's own record
of the licence. The declaration is kept exactly as typed. NC and ND licences are recognised, not
interpreted, so those files stay held. A file whose own record states a licence answers `409
LICENCE_RECORDED`. Marks and licence records need `catalog.edit`, and nothing is written back to a
provider.

```bash
lw catalog rights mark folder:partner-dam/Logos       # your own: the holder is your workspace's name
lw catalog rights licence ext/partner-dam/a1 CC-BY-4.0 --attribution "Photo by A. Person"
lw catalog rights                                      # the marks and records in force
```

### Share a held file anyway

Someone with `programme.manage` can choose to send held files to one programme or one company, up
to 200 files at a time, with an optional note. Each choice is remembered against the file's facts: a new version of the
file, a changed licence record or a new version of the rules retires the choice, and the report
lists the file as needing a new choice. A choice covers the file it names, never a file synced
later. Withdraw a choice at any time; ending a partnership withdraws its choices.

```
PUT /api/v1/programmes/resellers-emea/rights/choices
{ "assetIds": ["ext/partner-dam/a1"], "company": "northwind-it", "note": "The sponsor asked for the full set" }
```

Nothing is written unless every file qualifies: a file outside the audience's feed answers
`404 NOT_IN_FEED`, and one the gate does not hold `409 NOT_HELD`.

### Links, ZIPs and credits

- **A link a partner makes** carries only what their gated feed holds. A held file is refused when
  they make the link.
- **A link your own people make** leaves held files out, unless its maker chose them. A dry run
  (`POST /api/v1/links?dryRun=1`) lists what travels and what is held, with the reason, and writes
  nothing. Staff may then include held files with `includeHeld: true` and a note; partners cannot.
  A held file left out is never counted as "no longer available".
- **Every collection ZIP** a link serves starts with `CREDITS.txt` and `credits.json`, the same
  credits a `.lolly` pack carries. A held file a member of staff chose to carry is credited
  "included by the sender, who chose to carry bytes held back by default".
- **The collection link page** shows one credit line for a file whose licence asks for a credit,
  with the licence and the source.

### The Licences card

![The Licences card for Resellers, EMEA: the gate set in configuration, 1 of 17 files held back because its licence is not recorded, and the sources that travel, most of them exempt](shots/partner-licences.svg)

In this example one logo in the Partner logos collection records no licence, so the gate holds the
logo back: the row reads "Licence not recorded: 1". To send the logo, mark the file as your own
with **Mark** on its page in the catalog, which records the logo as owner-published, or choose
**Share anyway** for this programme.

The programme's **Licences** card shows, for one programme:

- the mode and its reason;
- what travels and what is held back, source by source, with the reason for each held file;
- **These are ours** on a folder or source row. The holder and terms are filled in, the sentence
  says the mark is your own statement and that Lolly does not check ownership, and one
  confirmation records the mark;
- **Share anyway** for one held file or several at once, with a note;
- **Shared anyway**, with who chose each file and when, and **Withdraw**;
- pack files held back, by id prefix, with what each declares;
- the published templates that start with files an audience will not receive, such as "Partner
  price sheet uses 2 files held back from Northwind IT";
- the links your people made that would lose files;
- the limits the server enforces.

Elsewhere in the console:

- **Preview**'s **Assets** card counts the files held back and the files that need a new choice,
  and lists the files shared anyway, with who chose each and when.
- An asset's page has a **Licence** row: what the file records and where the answer comes from
  (its own record, a licence record or a mark, with who stated it and when), with **Record
  licence**, **Mark** and **Unmark**.
- The **Collections** card has a **Travel** column, such as "8 of 10".
- A collection's link buttons run the dry run first. When files are held, choose **Make the link
  without them** or **Include them anyway**, with a note.

`lw programmes rights-report <programme>` and `GET /api/v1/programmes/:id/rights-report` give the
same report from a terminal, and `lw catalog rights` records marks and licences.

## Templates

A template gives a programme a ready piece to finish, such as a product data sheet where a reseller
adds only their price. Partners find it on their home, under **From** and your workspace's name, and
in the tool's **Start** chooser, and **Use** opens the template. Only what the template leaves open is offered;
everything else is simply not there, with no note about why.

![The Templates card for Resellers, EMEA: the Partner data sheet with its logo and details line taken from the company, a Pricing template and the switch that keeps Pricing to its templates](shots/partner-programme-templates.svg)

Publish one from the programme's **Templates** card. Anyone with `programme.manage` can, without
joining the programme. There are two kinds:

- **A template of one of your tools.** Save a template in the tool and submit it to the catalog,
  then choose it under **Publish a template**. Submitting needs `catalog.submit`, which authors and
  admins have; a programme manager without it asks a colleague on the brand team to submit the
  template, then publishes it from the card. Untick what partners may not change. The card
  counts what stays open, for example "Partners can change 1 of 9 inputs". With every input ticked
  there are no rules and partners can change everything. **Colourway and mode** sits below the
  inputs and starts ticked: partners may pick another of your brand's colourways and switch
  between light and dark, which moves every colour the tool takes from the design system. Untick
  it to keep the template's own.
- **A Share with rules file.** Make it in Design with **Share with rules**, download the `.lolly`
  file and upload it under **Publish a template**. The designer's own rules travel with the file:
  partners change only the objects the designer chose, plus the colourway and mode, which Design's
  rules leave open. Work keeps only the file's data and builds
  the tool again with this workspace's own Design, so no code from the file ever runs. A file made
  with another version of Lolly is rebuilt the same way, and its row says "Rebuilt with this
  workspace's Design". Files made from a tool other than Design are not taken yet.

**Who gets it** can be the whole programme, one of its companies, or several programmes.

**Takes from the company**, under **Change** on the template's row, fills inputs from each
company's details, such as its logo or its contact line, so partners never type them
([Company details in templates](#company-details-in-templates)).

**Published as your own.** When someone with `catalog.edit` publishes a template whose source is
your workspace's own work, Lolly Work records the workspace's owner-published mark on it, with the
default terms ([Licences](#licences)). Partners then read "Owner-published, not an open licence"
in the template's details. There is no mark when the source declares a licence, has a licence
record, came from a provider or was submitted by a partner, and a programme manager without
`catalog.edit` publishes the template unmarked. `ownerMark: false` at publish leaves the mark off,
and `ownerMark` on the template's `PUT` turns it on or off later. The console has no tick for the
mark yet.

When people in the programme can also open the template's tool on its own, the row says so. They
could then make the same piece outside the template's rules. To keep them inside, turn on the switch under
the row, for example **Partners use Pricing only through its published templates**. It is off by
default and set per programme and per tool. When it is on, the tool leaves their gallery and search, its
**Start** chooser offers only the templates published to them, with no blank canvas, and a server
render must name one of those templates. Copies they saved before keep opening. If any of a
person's programmes turns it on, the tool is templates only for that person, and Preview says which
programme turned the switch on.

### New versions and retiring

**New version** takes a newer template of the same tool, or a newer Share with rules file of the
same tool id. What happens to work partners already saved:

- A copy made from a tool template stays as it was. The next time it opens, the person is told a
  new version is ready. **Use new version** brings in what the template fixes and keeps what they
  changed. Without rules, the new version opens as a new document instead.
- A copy made from a Share with rules file opens on the newest version, with the person's entries
  kept, and a one-time notice tells them it was updated.

**Retire** takes a template off partners' homes and choosers at once. Copies already made keep
working and say it was retired; name a replacement and they offer the replacement. **Publish again** undoes a
retirement. To stop a template everywhere straight away, revoke it in the catalog.

### Rules on the server

Renders on the server follow the same rules. A render that asks for a template with
`template=inst/<id>` starts from the template's values and refuses, with `422 INPUT_LOCKED`, any
input the template fixes, and asks to change the colourway or mode (`ds`, `_themes`) when the
template keeps its own. A tool built from a Share with rules file refuses anything the designer
did not open the same way, and a value outside the designer's choices with `422 INPUT_NOT_ALLOWED`.
A template's rules can make a tool's own input rules stricter, never looser. A retired template
answers `410 TEMPLATE_RETIRED` with the replacement. When the tool is templates only for the
caller, a render that gives no template answers `422 TEMPLATE_REQUIRED` with the templates they
may use.

## Companies

A programme can hold companies: the partner organisations in it, such as one reseller or one
distributor. Add one under **Companies** on the programme's page. Each company has a group,
`company-<id>`, shown by its name in the console, so an input rule, a collection or a grant can
point at one company the way it points at a whole programme. A person can be added to a company when they
are added to the programme. A collection, an instance asset or a connected provider shared with a
company's group reaches that company's people and nobody else's. A company's input rule overrides
its programme's rule, which is how one company gets an exception
([Input rules for partners](#input-rules-for-partners)).

### Company details and logos

![Northwind IT's page in the console: its details at revision 4, its logos for light and dark surfaces and its mark, each previewed on both surfaces, and Contacts who may edit, off](shots/partner-company.svg)

Each company has a page of its own: open the programme, then the company under **Companies**. The
brand team sets the company up once, and its details and logos then go on every piece its people
and agents make from a template that takes them. Anyone with `programme.manage` can edit a
company without joining the programme.

- **Details.** Website, contact name, email and phone, an address of up to 6 lines, a currency as
  a three-letter ISO code and a tax note such as "Prices exclude VAT". **Save details** saves them
  as a numbered revision, and **Revision history** keeps every revision.
- **Logos.** **Logo for light surfaces**, **Logo for dark surfaces** and an optional **Mark**, a
  square mark for badges and small spaces. Each logo is previewed on both of your design
  system's surfaces, light and dark, which shows why a company needs a version for each: a logo
  made for light surfaces looks faint on the dark preview. A replaced logo becomes the next version of the same asset, and only that
  company's people and agent tokens receive its logos.

| Limit | Value |
| --- | --- |
| Logo file types | SVG or PNG. A JPEG is refused, because a logo needs a transparent background |
| SVG logo | Up to 512 KB |
| PNG logo | Up to 2 MB, and at least 400 pixels on its long side |
| Company name | 120 characters |
| Website | 500 characters |
| Contact name, email, phone | 120, 254 and 40 characters |
| Address | 600 characters on up to 6 lines |
| Tax note | 200 characters |
| Contacts who may edit | 50 |

**Checks on every logo.** An SVG is cleaned the same way the app cleans one, and stored cleaned.
An SVG with active content, such as a script, or with a reference to another file is refused
rather than quietly cleaned. Four things are flagged and never refused: no transparent
background, an SVG that only wraps a picture, parts that cleaning removed and ink below a 3:1
contrast on the surface the logo is for, read from your design system's surfaces. The page shows
these limits as the server enforces them.

From a terminal, the same set-up reads:

```bash
lw companies profile set resellers-emea northwind-it --field website=https://northwind.example/ \
    --field contact.name="Rita Ortiz" --field currency=EUR --field taxNote="Prices exclude VAT"
lw companies profile logo resellers-emea northwind-it light ./northwind-light.svg --dry-run   # checks only
lw companies profile history resellers-emea northwind-it                                  # every revision
```

### Contacts who may edit

**Contacts who may edit** is off by default: your team keeps the company's details. Tick **People
at Northwind IT may edit these details**, then tick the contacts, up to 50, among the company's
people who already sign in. Each of them gets **Edit** on their company card, with the same
fields and checks and the two logos; the mark stays with your team. A contact cannot rename the
company. A contact's change applies at once. To review contact changes first, tick **Changes by
contacts need approval** and choose an approval chain; this is off by default too. A change that
needs approval waits, one at a time, and applies on approval over whatever is current: the fields
the contact changed take the contact's values, and the others keep any change your team made
meanwhile. A change your team makes never waits.

### Company details in templates

A template, or a tool's policy, can take an input from the company's details. On the programme's
**Templates** card, press **Change** on a template, then choose a company field for each input
under **Takes from the company**. The tool policy editor has the same section. A picture input can
take the logo by mode, the logo for light surfaces, the logo for dark surfaces or the mark. A text,
long text or link input can take the company name, the website, the contact line, the contact
email, the phone, the address, the currency or the tax note. A row with bindings reads "From the
company:" followed by the inputs.

- **Fixed for partners.** An input the template takes from the company, and leaves out of what
  partners may change, is locked to the company's value. A Share with rules file locks every input
  it takes from the company. A locked input is not offered to partners at all; a server render
  that sends one answers `422 INPUT_LOCKED`. An input the template takes from the company and
  leaves open starts with the company's value, and partners may change that value.
- **Logo by mode.** The logo by mode is the light-surface logo in light mode and the dark-surface
  logo in dark mode, and follows the piece when the mode changes. A company with only one of the
  two gets that one in both.
- **Which company.** The person's only company. A server render can also tell from the template:
  the person's company that the template was published to. Otherwise someone in two companies gets
  no company values, and those inputs keep the template's values or the defaults. A field the
  company has not filled in leaves the template's own value.
- **Order.** On a server render a value comes from the first of: the person's own entry, unless the
  input is locked; the company's details; the template's values; the tool policy's defaults for the
  person's groups; the tool's default. In the app, a value a tool policy takes from the company and
  leaves open starts below the template's own values.
- **New work only.** A piece starts from these values. A file already exported keeps what it was
  made with.

Group defaults in a tool policy seed new work only when they are saved in the current
`[{ groups, values }]` shape. A policy that still holds defaults in the older flat shape applies
none of them, and the policy editor marks it, with a choice to apply them when you next save.

For example, to fill a data sheet's partner logo by mode and its details line from the contact:

```bash
lw templates set resellers-emea inst/7f3a… --bindings logo=logo,details=contact
```

The template's row then reads "From the company: Partner logo (Logo (by mode)), Details line
(Contact)".

### What partners see of their company

![The Northwind IT details sheet: the logo on light and dark backgrounds, then the website, contact, address, currency and tax note](shots/partner-company-sheet.svg)

A partner in one company sees their company's card first on their home, once the company has
details or when they may edit them: the logo on your design system's surface and
"Your details are on every piece". **Details** shows both logos on light and dark backgrounds,
then the website, contact, address, currency and tax note. A named contact also gets **Edit**, with
the limits listed. When an end date applies to the person, the card adds "Your access through
Resellers, EMEA ends on 21 November 2026", in UTC and in the reader's own date order. Nothing on
the card mentions a rule or a policy.

### Partner kits

A partner kit holds a company's own logo rules for use inside your work: its logos for light and
dark surfaces and its mark, up to 12 colours in named roles, and optional rules for clear space,
minimum size and allowed treatments. Lolly Work keeps one kit for each company, as a file only that
company's people and agents receive; a change is a new revision.

- **Import** a starting point from the company's tokens file (DTCG, Tokens Studio or Penpot), from
  a `.lolly` share, or from the inks of the company's SVG logos. An import proposes logos and
  colours only and stores nothing: Lolly does not know a partner's rules, so a person types clear
  space, minimum size and treatments. Whether your brand team or the partner's own designer does
  that depends on how you work together.
- **The logos** a kit pins must be the company's own logos from its page.
- **Who edits.** Anyone with `programme.manage`, and a contact who may edit the company's details.
  While contact changes need approval, a contact may change the kit only when kit review is on.
- **Kit review**, off by default. Kit changes apply at once until you turn on **Kit changes need
  approval** on the card, or choose a chain with
  `lw companies profile settings resellers-emea northwind-it --kit-chain <chain>` (`none` turns
  review off). Then every kit change, your team's or a contact's, waits for approval, and an
  approved change applies only onto the revision it was made against.
- **Ending.** Ending a partnership retires the kit, Reopen brings back the revision it retired, and
  deleting the company deletes the kit. With the licence gate on, a kit counts as the company's own
  file.

**The Partner kit card** on the company page, after **Logos**, keeps the kit in the console.
**Import** takes a tokens file or a `.lolly` share, dropped or chosen, and **Make from the logos**
reads colours from the company's SVG logos. An import is a proposal, and nothing is stored until
**Save**. You edit the label and the colours' names and roles, and type the placement rules: clear
space in mark heights, a minimum size in px and mm, and the allowed treatments. Lolly offers no
defaults, and an empty field stores no rule. The logo pins are read only. The card shows "Up to 12
colours, 64 KB, logos pinned by version", and **All limits** lists the rest. Preview as a company
shows the kit's line, such as "Northwind IT · revision 1". From a terminal,
`lw companies kit show|import|set|remove` does the same.

**In the app.** A partner in a company with a kit starts new work with the kit attached. The tool's
**Design system** section, or Lolly Design's inspector, reads "Partner kit: Northwind IT · revision
2", with **Detach**, and a piece without the kit offers "Attach Northwind IT's kit". The colour
field offers the kit's colours in a group under the company's name, and the picture picker offers
the kit's logos first. Lolly Design's checks and **Before you export** point out a mark smaller than
the kit allows, a mark inside another mark's clear space and a treatment the kit does not allow, for
example "Northwind IT's mark is 48 px high; the kit asks for at least 96 px.", with one sentence
for each thing they could not measure. A finding is for review and never blocks an export. The kit
is never a design system: your brand still leads, and the app's look stays the same. A piece's
attachment travels in its share link as `_kit`, and someone the kit is not served to sees the piece
without the kit. An export records the kit's id and the revision attached, beside the company
([The partner record in files](#the-partner-record-in-files)).

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
shows the tools the programme can open, its templates with what each lets them change, the number
and kinds of assets it gets, its collections and a sample of asset names, along with its
permissions and the input rules it meets. Under each template, Preview says why the rest is fixed.
It asks the same code the app does, so what you see is what they get. Anyone with
`programme.manage` can preview a programme and its companies.

**See what they get** on a company's page previews that company. Preview then adds the company's
card, with its details revision and every detail, and draws each template as the company gets it,
with the company's logo and details in place. A drawing is a watermarked preview and nothing is
saved. Policy editors may draw for any groups; programme managers only for a programme or company.
A template the groups do not get answers `404`. Under each input taken from the company, Preview
says where the value comes from, for example "Details line: set from Northwind IT's details
(contact), and fixed." Only admins see these lines.

### View as partner

Someone who manages a programme can open the app itself as one of its partners. In the app's
account menu, choose **View as partner…**, then the programme and, optionally, one company. The tab
reloads as that partner: their home, company card, templates and tools, with their locks and their
company's details. A banner reads "Viewing as Northwind IT · Resellers, EMEA" and "Changes are not
saved to the partner's account."; **Stop viewing** is the only way out, and Esc does not close the
banner.

- **One tab.** The view lives in that tab only and ends after an hour. Your other tabs stay your
  own, and the view keeps its own storage, so your saved work and settings are untouched.
- **Only what both of you may see.** The view shows what the partner gets, and never anything your
  own access leaves out beyond the viewed programme's and company's own files.
- **Downloads, saves and copies work.** A file made while viewing records the company it was made
  for, and the person who made it is you, never the partner.
- **Nothing else.** Every change to the partner's account is refused, first-run prompts are hidden
  and live collaboration stays closed: "Not while viewing as a partner".

Each view's start is audited as `programme.view-as`, and **Stop viewing** as
`programme.view-as.end`; a view that runs out after its hour simply ends.

## A person in two programmes

Someone in two programmes gets the tools and assets of both. Input rules combine as described
next. Someone in two companies may get no company details filled in
([Which company](#company-details-in-templates)), so put each person in one company where you can.

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

![The End this partnership card for everyone at Northwind IT, set to end at the close of a chosen day with a notice: Rita Ortiz and Nils Berg lose access, and the button schedules the end](shots/partner-end-dry-run.svg)

The **End this partnership** card on the programme's page, the same card on a company's page for
that company alone, or `POST /api/v1/programmes/exit` with a programme, a company, a domain or a
list of addresses, first shows what ending does, one table per kind: the people, with who stays
through another programme and who cannot be ended; their projects, share links and agent tokens;
the templates to retire; the folders, domain rules and licence choices to withdraw; and the open
invitations. Below the tables it says what ending does, how long Reopen is offered and who is
told when. Choose what happens to their projects:

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

Ending a programme or a company also covers what it owns:

- **People in another programme stay.** Someone who is also in another live programme keeps the
  account and leaves only this programme and company, audited as `programme.member.leave`. The
  preview lists them under who stays. A domain or list exit selects people rather than a programme,
  so it disables everyone it selects.
- **Templates** published only to the ended programme or company are retired, with no
  replacement. A template also published elsewhere keeps its other audiences.
- **Provider folders** given to the selection end.
- **Agent tokens** placed in the programme or company are revoked. A domain exit revokes the
  tokens of the one programme or company the domain feeds.
- **Share anyway choices** for the programme or company are withdrawn.
- **Accounts over the bound.** An account the offboarding bound of 1,000 rows refuses is listed as
  not ended, rather than counted as ended. The account still leaves the programme and company, so
  nothing shared with them reaches that account any more.

The programme or company is then **ended**, not deleted: a list import, a domain rule, a token
placement or a new company for it answers `409 PROGRAMME_ENDED`.
Every end keeps a receipt of what it did, which is what Reopen reads. The company's details and
their history stay, because files already made record them.

### End on a date, with a notice

An end can wait for a day you choose. In the End card, choose **At the end of a day** under when,
then the day; the button reads "Schedule the end for 30 November 2026". A domain always ends now.
The end runs at the end of that day in UTC, by the server's minute check, and is credited to the
person who scheduled the end. A programme or company holds one scheduled end at a time
(`409 EXIT_SCHEDULED`). The scheduled end shows on the programme's page, or the company's, with
**Change** for a new date or notice and **Cancel the end**. From a terminal,
`lw people exit --programme <id>` or `--company <id>` takes `--at YYYY-MM-DD`; the API takes `at`
on `POST /api/v1/programmes/exit`, and `PUT /api/v1/programmes/exits/:id` moves the date or, with
`at: "now"`, ends the partnership at once.

A notice goes out unless you untick **Tell them before the end** (`--no-notice`, or `notice:
false`). Each person whose
access ends is told in their notifications 14 days and again 1 day before the end, or at once when
the end is nearer, and by email too when [people's email](configuration.md#emailing-people-notices)
is set up. The notice reads "Your access through Resellers, EMEA ends on 21 November 2026", with
"Pieces you saved to team projects stay with `<workspace>`, read-only. Download anything you want
to keep before then." and **Open Projects**. Someone who stays through another programme reads
"Your access through your other programmes stays as it is." The person who scheduled the end is
told too. When the date moves, the end is cancelled or it runs early, the old notices leave
everyone's notifications. Unless the notice is off, their company card shows the date until then
([What partners see of their company](#what-partners-see-of-their-company)). A member's own end
date sends the same notice to that person.

### Reopen an end

An end made by mistake can be reopened from its receipt within 30 days. An ended programme or
company reads "Ended on 8 November 2026 by" and the name of the person who ended it, with the
receipt below as counts. While the 30 days run, the page offers **Reopen**, with **Give their
projects back** ticked. Reopen first shows who signs in again, what comes back and what stays
ended, then reopens in a second step. After the 30 days, the page says Reopen is no longer offered
and to add the people again by list. From a terminal, `lw people exits <programme>` lists a
programme's ends and `lw people reopen <exit>` previews; add `--apply` to reopen.

Reopening brings back the accounts that end disabled, their groups and memberships, the templates it retired, the
provider folders it ended (where their own end date is still ahead), the domain rules it withdrew
(where the domain's proof still holds) and the projects it moved, unless you pass
`--keep-projects`. Sessions, links, agent tokens and share anyway choices stay ended: people sign
in again, and you mint tokens and choose again. After 30 days the receipt stays as the record and
Reopen answers `409 REOPEN_CLOSED`.

Deleting a programme removes its grants, takes its group off every collection and deletes the
group. Its people keep the `partner` group. Deleting a company removes its grants, its collection
entries, its details with their history and its receipts, and revokes its logos; files already made
keep what they record.

## The partner record in files

A file a partner makes records the company and programme it was made for, beside your design
system and colourway ([The design-system record](/info/exporting.html#the-design-system-record)).

| Where | What is written |
| --- | --- |
| Content Credential | `partnerCompany`, `partnerCompanyLabel`, `partnerProfileRevision`, `partnerProgramme` and `partnerProgrammeLabel`, plus `partnerKit` and `partnerKitRevision` when a [partner kit](#partner-kits) is attached, and nothing more |
| XMP and SVG metadata | The same keys, as `lolly:PartnerCompany`, `lolly:PartnerKit` and so on |
| PDF keywords | "Partner: Northwind IT" |
| The export panel's **Design system** card | "Records: Lolly Demo · Colourway: Spearmint · Partner: Northwind IT (Resellers, EMEA)", and with a kit attached ", kit revision 2" after the partner |
| Lolly Verify | A **Partner** fact: "Northwind IT, Resellers, EMEA programme, details revision 3", and with a kit ", kit revision 2" ([What Lolly Verify checks](/info/what-verify-checks.html#partner)) |

**Never recorded:** the person, a contact's email or phone, the address, the currency, a token or
an agent's name or model. A kit is recorded by its id and revision only: never its colours, rules
or files. The kit keys are written only when the record holds the company and the piece carries
that company's kit.

The app records a company once it has details, with the revision of those details, so a file says
which details it was made with and the company page's history shows what that revision held; a
server render records the company with revision 0 before any details are saved. A programme with
no company records the programme alone: "Partner programme: Resellers, EMEA". Someone in two
companies records no company, and the programme alone when only one programme applies. Someone in
no programme records no partner. The **Design system** card's one switch leaves
the partner out together with the rest of the record.

A server render records the same keys in its Content Credential, so a file a partner's agent makes
over the API or MCP says what a file made in the app says. A durable render's record carries the
same words, for example `partner: "Partner: Northwind IT"`.

## Partners' agents

A partner's AI agent works through a service token placed in the programme, and in one company
when you choose one. The token is scoped exactly like that company's people: the same tools, files,
templates, input rules, company details and licence gate. Its files record the company and
programme, never the agent.

### Programme tokens

![The Agent tokens card for Northwind IT: Rita's agent with its limits, where each figure comes from, today's use and the expiry, then the form that mints a token with a label, a lifetime, what it may do and its limits](shots/partner-agent-tokens.svg)

Anyone with `programme.manage` for a programme issues its tokens from the **Agent tokens** card,
on the programme's page or on a company's page for that company. **Mint token** takes a label, the
company, the scopes, the days until the token expires and any limits, then shows the secret once,
with **Copy**. From a terminal or the API: `lw tokens add --programme resellers-emea --company
northwind --label "Rita's agent"`, or `POST /api/v1/programmes/:id/tokens`. A grant of `programme.manage` on `programme:<id>` lets its holder
manage that programme's tokens only. The server sets what the request cannot: the `automation`
role, the programme's and company's groups and the `partner` group. The secret appears once.

- **Scopes.** `render` and `catalog.read` by default; `documents` and `files` may be added, and so
  may `approvals.request` ([Approvals for agents](#approvals-for-agents)). `delivery` and
  `audit.read` are refused for programme tokens (`400 SCOPE_NOT_FOR_PROGRAMME`): a delivery sends
  to your own destinations, and the audit holds people's names.
- **Tools.** A list inside the programme's own, else `400 TOOL_NOT_IN_PROGRAMME`.
- **Expiry.** 90 days by default, between 1 and 365. The list marks a token with under 14 days
  left as expiring; no notice is sent.
- **Revoke** on the card, in two steps, or `lw tokens revoke <id> --programme <programme>`. A programme token is never
  moved out of its programme (`409 PROGRAMME_TOKEN`), only revoked. Ending the programme or company
  revokes its tokens.

An owner can also place an existing token in a programme with
`lw tokens programme <id> <programme> [--company <id>]`. Admin and owner tokens are never placed, because those roles are
never narrowed, and a token taken out keeps the `partner` group, so it never becomes an internal
token.

### Limits and usage

Every token placed in a programme meets three limits:

| Limit | Default | Set for a programme | Set for one token |
| --- | --- | --- | --- |
| Calls a minute | 120 | `lw programmes limits <id> --calls-per-minute <n>` | `lw tokens limits <id> --calls-per-minute <n>` |
| Renders a day, in UTC | 2,000 | `--renders-per-day <n>` | `--renders-per-day <n>` |
| Renders a month, in UTC | No cap | `--renders-per-month <n>` | `--renders-per-month <n>` |

The **Agent tokens** card shows each limit with where the figure comes from and today's use
against it, with what a limit turned away this week and when. **Change limits** sets a token's own
figures; a blank field takes the programme's. **Change the programme's limits** sets the figures
every token there starts with. The token's own figure wins, then its programme's, then the instance
default (`automation.tokenLimits`). `none` removes a cap and `default` takes the next level's figure.
Admins see each limit, where it comes from and today's use in the token list. A token over a limit
gets `429 RATE_LIMITED` or `429 BUDGET_EXHAUSTED` with plain words and the time to try again, such
as "This token has used its 2,000 renders for today. The budget renews at 00:00 UTC." A render the
budget cannot hold is refused whole. A token in no programme has no limits unless an owner sets
some.

![The Agent tokens card on the Limits and quotas tab: the default calls a minute and renders a day, their maxima and the token lifetime bounds, each with its source](shots/partner-limits-tokens.svg)

**What agents did**, on the same page, totals what each token did over the last 4 weeks or the
last 7 days, and **Download CSV** gives the same counts week by week or day by day. `lw programmes usage <programme>`
(`GET /api/v1/programmes/:id/usage`) counts what each token did,
by day or week, for up to 92 days: calls, renders (by tool, format and outcome for the renders
that keep a record, the durable ones), batches, deliveries,
approval requests and refusals by code, with totals per company and for the programme. `--csv` gives
the same as a spreadsheet. The counts hold no input values, prompts, titles, file names or agent
names.

![What agents did over the last 4 weeks: calls, renders, batches, deliveries, approvals and refusals for Rita's agent, for Northwind IT and for Resellers, EMEA, then renders by tool](shots/partner-agent-usage.svg)

### What an agent reads

The organisation MCP endpoint offers resources to a service token, each read counted as one call:

- `lolly-work://me`: the token's programme, company, scopes, tools, expiry, limits and today's use.
- `lolly-work://brand`, with `DESIGN.md` and the design tokens: your brand guidance. A published
  [brand page](/info/brand-page.html) supplies these when you serve one; otherwise Lolly Work writes
  them from your design system. Brand skills reach a partner's agent only when marked `public`.
- `lolly-work://partner/company` and its logos: the token's own company, never another.
- `lolly-work://partner/kit` and its logos, `lolly-work://partner/kit/logo/{surface}`: the partner
  kit of the token's own company. Both need `catalog.read`.
- `lolly-work://partner/templates`: the templates in the token's feed, with what each leaves open,
  what it takes from the company and whether it is retired.

The same answers are at `GET /api/v1/context/*` for REST callers. An agent can list, describe,
validate and render a published Share with rules template over MCP; a value the designer fixed
answers `422 INPUT_LOCKED`, and one outside the designer's choices `422 INPUT_NOT_ALLOWED`.

### Templates by purpose

An agent can ask for a piece by what the piece is for, with `resolve_intent`, rather than by tool.
A published template can state its purposes, written like the entries in a tool's `intents.json`:
the purpose, what it needs, the roles each input takes and the shapes it draws.
Set a template's purposes with **Purposes** on the programme's **Templates** card, which then
reads, for example, "This template is for: Promote · Banner, Social landscape", or with `intents`
on the template's `POST` or `PUT`; `null` clears them.

- Each purpose is checked against the template's rules, so a purpose cannot need something only a
  fixed input takes. A later change to what partners may change that would break a purpose is
  refused.
- An agent is offered the templates in its own feed where their purposes fit, and only the
  templates for a tool kept to its templates. A retired template is never offered.
- Inputs the company fills count as given, so an agent for Northwind IT is never asked for the
  partner's mark or the company name. An input the template fixes counts as given too.
- A Share with rules file brings its own rules and takes no purposes here.

`GET /api/v1/schema/:toolId?template=inst/<id>`, and `describe_tool` over MCP with `template`,
describe a render that starts from that template: its rules, its starting values and the company's
values.

### Approvals for agents

Approvals stay off for agents unless you turn them on. Give a programme token the
`approvals.request` scope and it may ask for review of one of its own finished renders, read its own
requests and withdraw them. Deciding stays with people. The request goes to the tool's bound
escalation chain, or else to a chain the programme lists (`approvalChains` on `PUT
/api/v1/programmes/:id`, with the programme's `name`); a partner's agent never reaches an internal
chain by name. A delivery to a destination that needs approval waits for the approval when the token
holds the scope, and is refused with `403 HUMAN_APPROVAL_REQUIRED` when it does not. The approver's
notice gives the company and the label you wrote on the token, for example "Northwind IT's agent
(Rita's agent) asked for your review", followed by the step. The approval card adds that an agent
asked, and that the file under review is the agent's own render, exactly as Lolly Work made the
file.

A tool's policy can also let one approval cover a template's variants: with `enforce.approvalCovers`
set to `template-variants`, approving one version of a published template that lists what partners
may change clears every partner's render from it, whatever the inputs the template leaves open, such
as the price or the logo. This is off by default. Set it in the tool's policy under **One approval
covers**: **This file only**, the default, or **Every file from one version of a published
template**. A new version, or a change to what is open or fixed, needs a new approval. A partner's
clean render from that template version then carries the template's approval record in its own
Content Credential: the approval, its date, the template's id and version and the fingerprint of the
example file the reviewer saw. It never holds this file's own fingerprint, a name or a person.
[Lolly Verify](/info/what-verify-checks.html#approval-and-intent-records) reads the record as
"Approved as a template: inst/price-sheet v3 (SVG)". A render that is still marked, one in a format
the approval did not cover and one from an instance with no signer carry no record.

## Limits and quotas

![The Partner programmes card on the Limits and quotas tab: each limit with its value and where the value comes from, such as the 30-day Reopen window and the 512 KB SVG logo size](shots/partner-limits.svg)

The deployment page's **Limits and quotas** tab, for people with `policy.edit`, lists the limits
Lolly Work enforces, grouped by area and read from the same figures the code enforces. The areas include rate limits,
request bodies, approvals and submissions, uploads and files, renders, agent tokens, sign-in
lifetimes and password lengths, live collaboration, document versions, sharing and access
requests, comments, storage, retention and purge, links, providers and partner programmes. Each limit shows its value in words and where the value comes from: **Configuration**,
**Environment** or **Built-in default**. A setting left at its default reads as built-in. For
partner programmes, the cards cover the logo and profile limits, the licence gate's mode, the
bounds on ending a partnership, the Reopen window, the notice days and the agent token defaults,
maxima and lifetime. `GET /api/v1/limits` (`policy.edit`) gives the same list. The panel covers every
limit a person meets. It leaves out timing cadences, clock skew tolerances, provider field lists
and caches.

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
GET    /api/v1/programmes/:id/templates           # its templates, and the catalog templates to publish from
POST   /api/v1/programmes/:id/templates           # { from, groups, editable? }: publish a catalog template
POST   /api/v1/programmes/:id/templates/rules-file?groups=   # the .lolly as the body
PUT    /api/v1/programmes/:id/templates/:asset    # { groups?, editable?, fixedTheme?, bindings?, ownerMark? }
POST   /api/v1/programmes/:id/templates/:asset/versions      # { from }, or a newer .lolly as the body
POST   /api/v1/programmes/:id/templates/:asset/retire        # { replacedBy? }
POST   /api/v1/programmes/:id/templates/:asset/restore
PUT    /api/v1/programmes/:id/templates-only/:tool         # { on }
PUT    /api/v1/policy/overlays/:toolId            # a tool policy; { bindings } takes inputs from the company

GET    /api/v1/programmes/:id/companies/:company/profile[?revision=N]   # a company's details, logos and settings
PUT    /api/v1/programmes/:id/companies/:company/profile                # { name?, website?, contact?, address?, currency?, taxNote?, revision? }
GET    /api/v1/programmes/:id/companies/:company/profile/history        # every revision
PUT    /api/v1/programmes/:id/companies/:company/profile/settings       # { editors, approvalChain, kitApprovalChain }
POST   /api/v1/programmes/:id/companies/:company/profile/logo?surface=light|dark|mark   # the file as the body; &dryRun=1 checks only
DELETE /api/v1/programmes/:id/companies/:company/profile/logo?surface=light|dark|mark
GET    /api/v1/me/company/profile                 # a partner's own company; PUT and /logo for a contact who may edit
GET    /api/v1/programmes/:id/companies/:company/kit         # the company's kit; PUT saves a revision, DELETE removes the kit
POST   /api/v1/programmes/:id/companies/:company/kit/import?from=tokens|lolly|logos   # a proposal; stores nothing
GET    /api/v1/me/company/kit                     # a partner's own kit; PUT and /import for a contact who may edit
POST   /api/v1/org-config/preview/render          # draw a template as a programme or company gets it, watermarked
POST   /api/v1/programmes/:id/view-as             # { company? }: start a view for one tab, for an hour
POST   /api/v1/view-as/end                        # { token }: end the view

GET    /api/v1/programmes/:id/rights-report       # the licence report
PUT    /api/v1/programmes/:id/rights/choices      # { assetIds, company?, note? }: share held files anyway; DELETE withdraws
GET    /api/v1/catalog/rights/marks               # catalog.edit; PUT { scope, holder?, terms?, note? } marks, DELETE ?scope= unmarks
GET    /api/v1/catalog/rights/licences            # catalog.edit; PUT { assetId, declaration, attribution?, note? }, DELETE ?assetId=
GET    /api/v1/catalog/rights/asset?id=           # one file's licence answer and where it comes from
GET    /api/v1/catalog/rights/coverage?scope=     # how many files a mark would cover
GET    /api/v1/catalog/rights/collections         # what each collection carries to partners
POST   /api/v1/links?dryRun=1                     # what a link would carry and hold back; staff add includeHeld: true and a note

GET    /api/v1/programmes/:id/exits               # its ends and its companies', newest first, with whether Reopen is offered;
                                                  # a scheduled end carries its endsAt, notice and projects
GET    /api/v1/programmes/exits/:exit             # one receipt
PUT    /api/v1/programmes/exits/:exit             # { at?, notice?, projects? } for a scheduled end; at: "now" ends it now
DELETE /api/v1/programmes/exits/:exit             # cancel a scheduled end
POST   /api/v1/programmes/exits/:exit/reopen      # a preview; "apply": true reopens; projects: false keeps them where they are

POST   /api/v1/programmes/:id/tokens              # { label, company?, scopes?, tools?, ttlDays?, limits? }: the secret, once
GET    /api/v1/programmes/:id/tokens[?company=]   # its tokens, with limits, their sources and today's use
PUT    /api/v1/programmes/:id/tokens/:tokenId     # { limits }
DELETE /api/v1/programmes/:id/tokens/:tokenId     # revoke
PUT    /api/v1/tokens/:id/programme               # owner: { programme, company? } or { programme: null }
PUT    /api/v1/tokens/:id/limits                  # owner: { limits }
GET    /api/v1/programmes/:id/usage?from=&to=&by=day|week[&token=][&format=csv]
GET    /api/v1/tokens/:id/usage                   # owner
GET    /api/v1/context[/me|/brand|/partner/company|/partner/templates|...]   # what a token reads; the same as the MCP resources
```

`POST /api/v1/programmes/exit` also takes `at` (`YYYY-MM-DD`) and `notice` for a programme or a
company, and `PUT /api/v1/programmes/:id` takes `tokenLimits` and `approvalChains` beside the
`name` every programme `PUT` needs.

A `PUT` that leaves out `tools` or `collections` keeps what the programme had. Each change is
audited as `programme.create`, `programme.edit` or `programme.delete` with the before and after,
and each grant and collection change it makes is audited as its own `grant.create`,
`grant.delete` or `catalog.collection.edit`, with `via: "programme:<id>"`.

Adding people is audited per person as `programme.member.add` (with the account or invitation,
never the address, and `via: "domain"` with the domain for someone who joined through one), and
companies as `programme.company.create`, `.edit` and `.delete`. Domains are audited as
`programme.domain.add`, `.rule`, `.assert`, `.proof`, `.verify`, `.pause`, `.move-staff` and
`.remove`. Provider folders are audited as `programme.folder.add`, `.edit`, `.remove` and `.end`.
Templates are audited as `programme.template.publish`, `.update`, `.version`, `.retire` and `.restore`,
and the templates-only switch as `programme.template.only`. Bindings are audited inside
`programme.template.update` and `policy.overlay.edit`.

Company details are audited as `programme.company.profile.edit`, with the fields before and after,
`programme.company.profile.settings` and `programme.company.logo`, which records the surface, the
asset version and any warnings, never the file. A contact's change that waits for approval is an
`approval.submit`. A kit is audited as `programme.company.kit`, with the revisions and the
source, never the files or colours. Licences are audited as `catalog.rights.mark`, `.unmark`, `.licence` and
`.licence.remove`, and choices as `programme.rights.share-anyway` (one row per file) and
`programme.rights.withdraw`. A link that carries held files records them, with the note, on its
`link.create`. Ends are audited as `programme.exit`, `programme.member.leave`,
`programme.exit.schedule`, `.change`, `.cancel` and `.notice`, `programme.member.notice`,
`programme.exit.reopen` and `programme.member.reopen`; what an exit or a reopen does to each kind of
thing is audited as its own row with `via: "programme-exit"` or `via: "programme-exit-reopen"`.
Notices are counted, never addressed. Tokens are audited as `token.create`, `token.limits`,
`token.revoke` and `token.programme`, and a programme's limits as `programme.limits`.

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
lw companies profile set resellers-emea northwind --field website=https://northwind.example/
lw companies profile logo resellers-emea northwind light ./northwind-light.svg --dry-run
lw templates publish resellers-emea --from inst/price-sheet --groups programme-resellers-emea --editable price --bindings logo=logo,details=contact
lw programmes rights-report resellers-emea            # what the licence gate lets through and holds back
lw catalog rights mark folder:partner-dam/Logos       # say a folder is your own
lw people exit --domain northwind.example             # a preview; add --apply to do it
lw people exit --company northwind --at 2026-11-21    # a scheduled end, with the notice; add --apply
lw people exits resellers-emea                        # its ends, and whether Reopen is offered
lw people reopen <exit>                               # a preview; add --apply to reopen
lw tokens add --programme resellers-emea --company northwind --label "Rita's agent"
lw programmes limits resellers-emea --renders-per-day 500
lw programmes usage resellers-emea --by week --csv
```

## Not yet

- **Share with rules files made from tools other than Design.**

## Related

- The guide for partner teams: [Run a partner programme](run-a-partner-programme.md)
- The guide by subject: [Co-branding and partner kits](partner-co-branding.md),
  [Partner templates](partner-templates.md), [Partner approvals](partner-approvals.md),
  [Shared assets and licences](partner-shared-assets.md), [Partners' agents](partner-agents.md) and
  [People and the partnership](partner-people.md)
- Who can do what: [Roles and grants](permissions.md)
- Locking inputs per group: [Policy and governance](governance.md)
- Collections: [Catalog and content](catalog.md#collections)
- Inviting people: [Invite people and handle requests](invitations.md)
