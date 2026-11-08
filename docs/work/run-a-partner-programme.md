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
| **Licences** | When the licence gate is on, only the shared files whose licence lets them be passed on, that your team marked as its own or that someone chose to share anyway. | An administrator's setting |
| **Templates** | The templates published to them, on their home and in the tool's **Start** chooser. They change only what you left open; everything else is simply not there, with no note about why. | The programme's **Templates** card |
| **Templates only** | Optional, per tool: the tool leaves their gallery, and they make pieces from your templates only. Off by default. | A switch under each template |
| **Their company** | A card for their company at the top of their home, with its logos and details. A template that takes company details fills them in, and partners cannot change those inputs. Named contacts may edit the details. | The company's page |
| **What they can do** | Open tools and files, make, save and export pieces, comment, work in projects and make links to what they can see. Admin actions are refused for partners whatever a grant says: editing grants, policy, programmes or the catalog, inviting people, sending messages, making groups and deciding approvals. | Fixed |
| **Their files** | Each export records the company and programme it was made for, and the revision of the company's details. Never the person, a contact's details, the address, the currency, a token or an agent. | Built in; the export panel's **Design system** card can leave the record out |
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
   approval of their changes. Both are off by default
   ([Company details and logos](partner-programmes.md#company-details-and-logos)).
4. **Publish templates.** Someone draws each template: your brand team, or a designer in your own
   team, depending on how your organisation works. Publish it from the programme's **Templates**
   card, choose who gets it and untick what partners may not change. Under **Change**, **Takes
   from the company** fills an input from each company's details, such as its logo or its contact
   line, so partners never type them ([Templates](partner-programmes.md#templates),
   [Company details in templates](partner-programmes.md#company-details-in-templates)).
5. **Check what they get.** On the programme's page, or a company's, **See what they get** shows
   the programme or the company as its partners get it: the tools, the files and the templates
   with what each lets them change, each drawn with the company's details. Check here before
   anyone is invited ([See what they get](partner-programmes.md#see-what-they-get)).
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
two companies gets company details filled in only by a template published to one of those
companies; anywhere else those inputs start from the tool's own default
([A person in two programmes](partner-programmes.md#a-person-in-two-programmes)).

**A file the licence gate holds back.** With the licence gate on, a file that records no licence
stays with your own people. Your brand team can mark a folder or a file as your own, or record the
licence of a file that records none. You can also share one held file anyway with one programme or
company, and the choice is recorded with your name. A console card for this is planned. Until then
`lw programmes rights-report` lists what is held and why, `lw catalog rights` records marks and
licences and the API shares a file anyway ([Licences](partner-programmes.md#licences)).

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

A partner can work through an AI agent too. The programme's manager issues the agent a token for
the programme, or for one company in it, with `lw tokens add --programme`. The token sees what that
company's people see, reads your brand guidance and its company's details over your organisation's
MCP endpoint, and the files it makes record the company, never the agent. Tokens have limits, by
default 120 calls a minute and 2,000 renders a day, and you can read what each token did. Approvals
for agents are off unless you turn them on. A console card for tokens, and offering templates to
agents by purpose, are planned ([Partners' agents](partner-programmes.md#partners-agents)).

## Not yet

- **Partner kits.** A partner company's own rules for its logo, such as clear space and minimum
  size, checked as a partner works in Lolly Design. The kit format and the check exist, and
  `lolly check --kit` reads a kit from a terminal; keeping a kit for each company in Lolly Work is
  planned.
- **Console cards** for licences, agent tokens and their use, a planned end and Reopen. Use `lw` or
  the API until then.
- **View as partner**: opening the app itself as one of a programme's companies, beyond what
  **See what they get** shows.

## Related

- Every option, route and audit event: [Partner programmes](partner-programmes.md)
- Locking inputs for a programme or a company: [Policy and governance](governance.md)
- Who can do what: [Roles and grants](permissions.md)
- Co-branding in the app: [Working with partners](/info/partners.html)
- Reading a file's record: [What Lolly Verify checks](/info/what-verify-checks.html)
