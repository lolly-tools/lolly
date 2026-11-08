# Run a partner programme

This page is for the team that runs partner programmes: resellers, distributors, software
partners, service providers or however your organisation groups the companies it works with. It
answers two questions. What does a partner get in Lolly Work? And how do you shape that, from the
first setup to the end of a partnership?

Each step links to [Partner programmes](partner-programmes.md), the reference with every option,
route and audit event. Most steps happen in the Lolly Work console. A few are done with `lw`,
Lolly Work's command line, until their console card arrives, and each of those steps gives the
command.

## Four words

- A **programme** is your own name for one kind of partner, such as *Resellers, EMEA*. Lolly
  Work has no fixed list of partner types.
- A **company** is one partner organisation in a programme, such as *Northwind IT*.
- A **partner** is a person in a programme, or an agent working for one.
- A **template** is a ready piece you publish to a programme, such as a product data sheet where a
  reseller adds only their price.

## What partners get

Partners start with nothing internal. They get what you give their programme and their company,
and nothing you share with everyone in your workspace reaches them. Your own people are
unaffected, and admins and owners are never narrowed.

| | What a partner gets | Where you set this |
| --- | --- | --- |
| **To start with** | Your design system's colours, type and palettes, so every tool draws in your brand. No tools, files, announcements or projects meant for your own people. | Built in |
| **Tools** | Only the tools their programme includes: in the gallery, in search, in server renders and for their agents. | **Choose what they get** |
| **Files** | Only the files shared with their programme or their company: a collection, a folder of a connected source or a file submitted to the programme. A file shared with everyone does not reach them. | **Choose what they get** and **Provider folders** |
| **Licences** | When the licence gate is on, only the shared files whose licence lets them be passed on, that your team marked as its own or that someone chose to share anyway. | An administrator's setting, and the programme's **Licences** card |
| **Templates** | The templates published to them, on their home and in the tool's **Start** chooser. They change only what you left open; everything else is simply not there, with no note about why. | The programme's **Templates** card |
| **Templates only** | Optional, per tool: the tool leaves their gallery, and they make pieces from your templates only. Off by default. | A switch under each template |
| **Their company** | A card for their company at the top of their home, with its logos and details. A template that takes company details fills them in, and partners cannot change the ones the template fixes. Named contacts may edit the details. | The company's page |
| **What they can do** | Open tools and files, make, save and export pieces, comment, work in projects and make links to what they can see. Admin actions are refused for partners whatever a grant says: editing grants, policy, programmes or the catalog, inviting people, sending messages, making groups and deciding approvals. | Fixed |
| **Their files** | Each export's partner record holds the company and programme it was made for, and the revision of the company's details. The record never holds the person, a contact's details, the address, the currency, a token or an agent. | Built in; the export panel's **Design system** card can leave the record out |
| **Their agents** | A token you issue sees what the company's people see, within limits you set. | `lw` today |
| **When they leave** | Access ends at once, or on a date you choose with a notice before. Links they made stop working. | **End this partnership**, or `lw` for a date |

## Set up a programme

Work in this order. Everything can be changed later.

1. **Create the programme.** Open **Partner programmes**, type a name and press **Create
   programme**. Set **Owning team** to the team in your organisation that runs the programme:
   when a partnership ends, its people's projects go to that team. An administrator can give your
   partner team `programme.manage`, so the team runs programmes without being administrators
   ([Create a programme](partner-programmes.md#create-a-programme)).
2. **Choose its tools and share its files.** Open **Choose what they get** and tick the tools and
   the collections. A programme receives only the files you share with the programme, so share the
   logos and pictures your templates use, for example as a logos collection. Without them, a
   template is incomplete for partners, and, with the licence gate on, a render that uses a missing
   file is refused. To give one folder of a connected source, such as your DAM, use **Provider
   folders** ([Choose what it gets](partner-programmes.md#choose-what-it-gets),
   [Licences](partner-programmes.md#licences)).
3. **Add the companies and their details.** Under **Companies**, add each partner organisation.
   On the company's page, fill in its details (website, contact, address, currency and a tax note)
   and upload its logo for light surfaces, its logo for dark surfaces and an optional square mark.
   Lolly Work checks each logo and flags one that is hard to see on your design system's surfaces.
   You can let named contacts at the company edit the details themselves, and you can ask for
   approval of their changes. Both are off by default. When the company has rules of its own for
   its logo, such as clear space and a minimum size, keep them as the company's partner kit
   ([Company details and logos](partner-programmes.md#company-details-and-logos),
   [Partner kits](partner-programmes.md#partner-kits)).
4. **Publish templates.** Someone draws each template: your brand team, or a designer in your own
   team, depending on how your organisation works. Publish it from the programme's **Templates**
   card, choose who gets it and untick what partners may not change. Under **Change**, **Takes
   from the company** fills an input from each company's details, such as its logo or its contact
   line, so partners never type them. An input you leave out of what partners may change keeps
   the company's value ([Templates](partner-programmes.md#templates),
   [Company details in templates](partner-programmes.md#company-details-in-templates)).
5. **Check what they get.** On the programme's page, or a company's, **See what they get** shows
   the programme or the company as its partners get it: the tools, the files and the templates
   with what each lets them change, each drawn with the company's details. Check here before
   anyone is invited. To see the app itself as a partner does, choose **View as partner…** in the
   app's account menu, then the programme and a company; **Stop viewing** ends the view
   ([See what they get](partner-programmes.md#see-what-they-get),
   [View as partner](partner-programmes.md#view-as-partner)).
6. **Invite the people.** On the programme's page, **Add people** takes a list, with a company and
   an end date on each line, and shows what will happen before anything does. **Domains** lets everyone at a partner's
   proved domain join the programme and the company when they sign in. Lolly Work sends no email
   for this, so it gives you one message to send yourself
   ([Add people](partner-programmes.md#add-people),
   [Add people by domain](partner-programmes.md#add-people-by-domain)).

## What partners see

Rita works at Northwind IT, a company in Resellers, EMEA. When she signs in, her home shows:

- **Her company card first**, with Northwind IT's logo on your design system's surface and "Your
  details are on every piece". **Details** shows both logos and every detail. If the brand team
  named her as a contact who may edit, **Edit** opens the same details with the same checks.
- **The templates published to her**, one card each. **Use** starts a piece, **Your copy** goes
  back to the piece she made last, and **New version** appears on her copy when you publish a
  newer version.
- **The tools her programme includes.** There is no featured banner and no prompt to add personal
  details, and the only status chip is **Experimental**, because those tools mark their exports
  as a preview.
- **The end of her access**, when there is one. Her company card adds a line such as "Your access
  through Resellers, EMEA ends on 21 November 2026".
- **Her company's kit**, when it has one. New work starts with Northwind IT's kit attached: colours
  offer the company's colours under its name, the picture picker offers its logos first, and Lolly
  Design's checks point out a mark smaller than the kit allows or too close to other artwork. A
  finding is a note to review and never stops an export.

In a template, the inputs she may change are the only controls shown. Northwind IT's logo and
details are already in place, and a logo the template takes by mode follows the piece between
light and dark. A phone shows the same home in the same order.

When she exports, the export panel's **Design system** card shows what the file records, such as
"Records: Lolly Demo · Colourway: Spearmint · Partner: Northwind IT (Resellers, EMEA)". Anyone who
checks the file in [Lolly Verify](/info/what-verify-checks.html#partner) reads "Northwind IT,
Resellers, EMEA programme, details revision 3" as its **Partner** fact. The partner record is
about the company, never Rita: it holds no person, contact details, address or currency
([The partner record in files](partner-programmes.md#the-partner-record-in-files)).

## Day to day

**A new version of a template.** Press **New version** on the template's row. Partners who saved a
copy see **New version** on its card. One tap brings in what the template fixes and keeps what they
changed. A copy made from a Share with rules file opens on the newest version with their entries
kept ([New versions and retiring](partner-programmes.md#new-versions-and-retiring)).

**Retiring a template.** **Retire** takes a template off partners' homes and choosers at once.
Copies already made keep working; give a replacement and those copies offer the replacement.
**Publish again** brings a retired template back.

**A company's details change.** Change them on the company's page and press **Save details**. Every
revision is kept. New pieces take the new details, and a file already made keeps the details it
was made with, along with the revision it records. A contact who may edit makes the same change
from their home.

**A partner in two programmes.** They get the tools and files of both. For each input, a company's
rule overrides its programme's rule, and across two programmes the stricter rule wins. Someone in
two companies may get no company details filled in, because Lolly Work cannot always tell which
company a piece is for, so put each person in one company where you can
([A person in two programmes](partner-programmes.md#a-person-in-two-programmes)).

**A file the licence gate holds back.** With the licence gate on, a file that records no licence
stays with your own people. The programme's **Licences** card shows what reaches its partners, what
is held back and why. Your brand team can mark a folder or a whole source as your own with **These
are ours**, or record a file's licence on its page in the catalog. You can also **Share anyway**
held files with one programme or company, with a note: the card shows who chose each file, and
**Withdraw** takes a choice back. When you give a provider folder, the form says how many of its
files record no licence ([Licences](partner-programmes.md#licences)).

**Ending a partnership.** **End this partnership** on the programme's page ends the whole
programme or one company. It first shows what ending does, then does all of it in one step: nobody
new joins through its domains, accounts are disabled and signed out, their links and agent tokens
stop working, open invitations are withdrawn, templates published only to them are retired, their
provider folders end and their projects move as you chose. Someone who is also in another live
programme keeps the account and leaves only this programme
([End a partnership](partner-programmes.md#end-a-partnership)).

**Ending on a date.** An end can wait for a day you choose. People are told in their notifications
14 days and 1 day before, and their company card gives the date. Set the date with
`lw people exit --at` today
([End on a date, with a notice](partner-programmes.md#end-on-a-date-with-a-notice)).

**Undoing an end.** Within 30 days, `lw people reopen` brings back the people, templates, folders
and projects an end took away. Links, tokens and sessions stay ended
([Reopen an end](partner-programmes.md#reopen-an-end)).

## Partners' agents

A partner can work through an AI agent too. The programme's manager issues the agent a token for the
programme, or for one company in it, with `lw tokens add --programme`. The token sees what that
company's people see, reads your brand guidance and its company's details over your organisation's
MCP endpoint, and the files it makes record the company, never the agent. When the agent asks for a
piece by what the piece is for, your templates are offered where their purposes fit. Tokens have
limits, by default 120 calls a minute and 2,000 renders a day, and you can read what each token did.
Approvals for agents are off unless you turn them on. A console card for tokens is planned
([Partners' agents](partner-programmes.md#partners-agents)).

## Worked example: Northwind IT

Your organisation runs a programme for resellers in Europe, the Middle East and Africa. Northwind
IT, a reseller in Berlin, joins it, and Rita Ortiz is their sales lead. Your brand team has made a
product data sheet in Lolly Design where a reseller adds only a price. Each step below gives the
console clicks, the same step with `lw` and, where it helps, the API request. Example ids such as
`resellers-emea` are yours to choose.

### 1. Create the programme

**Console.** Open **Partner programmes**, type "Resellers, EMEA" and press **Create programme**.
On its page, set **Owning team** to your partner team's group, here `partner-team`.

**`lw`.**

```bash
lw programmes create resellers-emea --name "Resellers, EMEA" --team partner-team
```

::: details The API request
```
PUT /api/v1/programmes/resellers-emea
{ "name": "Resellers, EMEA", "team": "partner-team" }
```

The answer is `201` with the programme: its `id`, `name` and `team`, its group
`programme-resellers-emea`, and empty `tools`, `collections` and `members` lists.
:::

**Rita** has not been invited yet, so she sees nothing.

### 2. Give the programme its tools and logos

**Console.** Open **Choose what they get**. Tick the tools, here **Certificate** and **QR Code**,
and the **Logos for partners** collection, which holds the logos the data sheet uses.

**`lw`.** A collection reaches the programme when its groups include the programme's group:

```bash
lw programmes set resellers-emea --tools certificate,qr-code
lw catalog collection partner-logos --name "Logos for partners" \
    --members lolly/logo/primary,lolly/logo/reverse --groups design,programme-resellers-emea
```

**Rita** still sees nothing. Once she joins, she gets these two tools, your design system's
colours, type and palettes, and the logos in the collection, and nothing else from your catalog.

### 3. Add Northwind IT and its details

**Console.** Under **Companies**, add "Northwind IT" and open the company. Fill in the website,
the contact (Rita Ortiz, her email and phone), the address, the currency `EUR` and the tax note
"Prices exclude VAT", then press **Save details**. Under **Logos**, upload the logo for light
surfaces, the logo for dark surfaces and the square mark Northwind IT sent. Leave **Contacts who
may edit** off for now.

**`lw`.**

```bash
lw companies add resellers-emea northwind-it --name "Northwind IT"
lw companies profile set resellers-emea northwind-it --field website=https://northwind.example/ \
    --field contact.name="Rita Ortiz" --field contact.email=rita@northwind.example \
    --field contact.phone="+49 30 1234 567" --field address="Unter den Linden 1, 10117 Berlin" \
    --field currency=EUR --field taxNote="Prices exclude VAT"
lw companies profile logo resellers-emea northwind-it light ./northwind-light.svg
lw companies profile logo resellers-emea northwind-it dark ./northwind-dark.svg
lw companies profile logo resellers-emea northwind-it mark ./northwind-mark.svg
```

::: details The API request
```
PUT /api/v1/programmes/resellers-emea/companies/northwind-it/profile
{
  "website": "https://northwind.example/",
  "contact": { "name": "Rita Ortiz", "email": "rita@northwind.example", "phone": "+49 30 1234 567" },
  "address": "Unter den Linden 1\n10117 Berlin\nGermany",
  "currency": "EUR",
  "taxNote": "Prices exclude VAT"
}
```

The answer is `200` with `company`, `programme`, `revision` (1 after the first save), `profile`,
the `logos` and the `limits` the server enforces. Each logo goes up on its own,
`POST .../profile/logo?surface=light` with the SVG or PNG as the body, and each upload is the
next revision, so the three logos bring Northwind IT to revision 4.
:::

**Rita** still sees nothing, but every piece she makes from now on can carry these details.

### 4. Publish the data sheet

**Console.** The brand team saves the data sheet with **Share with rules** in Lolly Design,
leaving three things open: the price, the partner logo and the details line. On the programme's
**Templates** card, choose **Publish a template**, upload the `.lolly` file and choose **Everyone
in Resellers, EMEA**. Then press **Change** on its row, and under **Takes from the company** set
**Partner logo** to **Logo (by mode)** and **Details line** to **Contact**. Press **Save**.

**`lw`.** The upload prints the template's id, such as `inst/7f3a…`:

```bash
lw templates upload resellers-emea product-data-sheet.lolly --groups programme-resellers-emea
lw templates set resellers-emea inst/7f3a… --bindings logo=logo,details=contact
```

**Rita** is not in yet. When she is, the logo and the details line fill themselves from Northwind
IT's details and are not offered to her. She types only the price, and may switch the colourway
and between light and dark, which a Share with rules file leaves open.

### 5. Check what Northwind IT gets

**Console.** On Northwind IT's page, press **See what they get**. Preview shows the company card
at its latest details revision, 4 here, the two tools, the logos collection and the data sheet drawn with
Northwind IT's logo and contact line, as a watermarked preview. To see the app itself, choose
**View as partner…** in the app's account menu, then Resellers, EMEA and Northwind IT, and press
**Stop viewing** when you are done.

**Rita** sees nothing yet; Preview and View as partner change nothing for her.

### 6. Invite Rita

**Console.** On the programme's page, under **Add people**, paste one line per person: the
address, then optionally a name, a company and an end date. Rita's access will end with the
company's in step 8, so her line has no end date of its own:

```
rita@northwind.example,Rita Ortiz,Northwind IT
```

**Preview** lists Rita as new and to be invited. Press **Add 1 person**, then copy the one message
Lolly Work offers and send it to her yourself.

**`lw`.**

```bash
lw people import resellers-emea roster.csv            # a preview
lw people import resellers-emea roster.csv --apply    # does it
```

**Rita** signs in, and her home opens with Northwind IT's card first, then the data sheet.
**Use** opens the sheet with Northwind IT's logo and contact line in place and one field, **Your
price**. When she exports, the **Design system** card reads "Records: Lolly Demo · Colourway:
Spearmint · Partner: Northwind IT (Resellers, EMEA)". The partner record holds Northwind IT and
the programme, never Rita herself; the details line in the artwork shows the contact you set in
step 3.

### 7. Give Rita's agent a token

**`lw`.** The programme's manager issues the token and hands the secret to Rita once:

```bash
lw tokens add --programme resellers-emea --company northwind-it --label "Rita's agent"
```

::: details The API request
```
POST /api/v1/programmes/resellers-emea/tokens
{ "label": "Rita's agent", "company": "northwind-it" }
```

The answer is `201` with the token's `id` (`tok_…`), `label`, `company`, `scopes` (`render` and
`catalog.read` by default), `expiresAt` (90 days on), its limits and today's use, and `token`, the
secret (`lwt_…`). The secret appears in this answer only.
:::

**Rita's agent** connects to your organisation's MCP endpoint with the secret. It sees what Rita
sees, renders the data sheet with only the price, colourway and mode open, and its files record
Northwind IT, never the agent.

### 8. End the partnership on a date

**Console.** **End this partnership**, with **Whose access ends** set to Northwind IT, then **See
what ending it does**, lists Rita, her agent token and anything else that ends.

**`lw`.** To end it at the close of 30 June 2027 rather than now:

```bash
lw people exit --company northwind-it --at 2027-06-30            # a preview
lw people exit --company northwind-it --at 2027-06-30 --apply    # schedules it
```

::: details The API request
```
POST /api/v1/programmes/exit
{ "company": "northwind-it", "at": "2027-06-30" }
```

Without `"apply": true` the answer is `200` and changes nothing: `dryRun: true`, the `accounts`
whose access ends, those who `stays` through another programme, the `tokens`, `templates`,
`folders` and `rightsChoices` it covers, `endsAt` and `notice`. With `"apply": true` the answer is
`201` with `scheduled: true` and the receipt's id as `exit`.
:::

**Rita** is told in her notifications 14 days and 1 day before, and her company card reads "Your
access through Resellers, EMEA ends on 30 June 2027". At the end of that day her access ends, her
links and her agent's token stop, and her saved pieces stay with your team, read-only. For 30
days `lw people reopen` can bring back her access, the templates and her projects; links and
tokens stay ended.

## Not yet

- **A console card for partner kits, and the kit in exported files.** Kits are kept with
  `lw companies kit` until the card arrives.
- **Console cards** for agent tokens and a planned end with Reopen. Use `lw` or the API until then.
- **Limits and quotas**: one console page that lists the limits Lolly Work enforces, grouped by
  area, with each value and where the value comes from.

## Related

- Every option, route and audit event: [Partner programmes](partner-programmes.md)
- Locking inputs for a programme or a company: [Policy and governance](governance.md)
- Who can do what: [Roles and grants](permissions.md)
- Co-branding in the app: [Working with partners](/info/partners.html)
- Reading a file's record: [What Lolly Verify checks](/info/what-verify-checks.html)
