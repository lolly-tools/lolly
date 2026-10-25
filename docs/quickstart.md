# Start

By the end of this page your tools will wear your own colours and fonts, and the work you already have will be ready to reuse. You need no account, and making and exporting run on your device.

::: timeline
- <!--i:sparkle--> **Make one file.** [Make your first file](/info/make-something.html) walks you through a QR code in a few minutes.
- <!--i:palette--> **Put your brand in.** Start from one colour, a tokens file or a finished design.
- <!--i:layers--> **Make more of the same.** Share a link, fill a spreadsheet or run the tool from a script.
:::

New to the idea itself? [What is Lolly?](/info/what-is-lolly.html) is the five-minute introduction, and [How Lolly works](/info/how-lolly-works.html) shows who does what.

## Put your brand in

lolly.tools opens in **Lolly Demo**, Lolly's own sample design system; [Meet Lolly Demo](/info/lolly-demo.html) shows what you are looking at. Your design system replaces it: a small set of design tokens, meaning colours, fonts and a few rules, that every tool draws with. Set it once, and everything you make starts on-brand.

Choose the route that matches what you have:

- <!--i:palette--> **One colour.** Open **Design System Setup** (`#/start`), give your design system a name and pick a primary colour. Lolly derives a complete, accessible palette from it, with light and dark surfaces, text and accents. Pick a font and you have a working brand.
- <!--i:upload--> **A tokens file.** **Add from…**, at the foot of the room rail in Design System Setup, takes a DTCG, Tokens Studio or Penpot tokens file, an SVG or a `LollyBrand` pack. Drop it in and the palette fills. While the design system is still empty, **Start from a reference** in the Overview room opens the same picker.
- <!--i:pentool--> **A finished design.** In Design, choose **Import a design** and drop a `.fig`, `.penpot`, `.ai`, `.idml` or SVG file. See [Bring in what you already have](#bring-in-what-you-already-have) below.

The first time you open the gallery, a short welcome offers the same choices: **Make it yours** opens Design System Setup, **Bring your design** opens a file picker for a design and **Explore the community tools** closes the welcome.

![The Colours room of Design System Setup on a fresh install: one live chip, one field and the whole of the first decision](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

From there, seven rooms take it as far as you like, in any order: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** and **Usage & rules**. Every preview in the app updates as you type. [Design System Setup](/info/brand-studio.html) covers each room.

Fonts are kept on your device. Pick a Google Font and Lolly stores the file as a brand asset, so your type travels offline and nothing is fetched when a tool draws.

### See, switch and share a design system

- **See the active one.** **Settings → Design system** shows the active design system as a cover and pages, read-only.
- **Switch between them.** **Settings → Preferences → Design systems** lists every design system on this device. One organisation can run several design systems, or one with several colourways; [Brand architectures](/info/brand-architectures.html) maps the arrangements.
- **Share one.** Export the design system as a `LollyBrand` pack: one file a colleague imports to get the same palette, fonts and rules.

A design system your build or organisation supplies is **managed**: it shows a lock and stays read-only. To change one, make an editable copy from **Settings → Preferences → Design systems**.

![The Design system tab in Settings: the active design system as a cover and pages](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Your design system is DTCG tokens, the format Penpot reads and writes and Tokens Studio brings to Figma, so the palette you design with and the palette Lolly applies are one document. [Design Tokens](/info/design-tokens.html) has the details.

::: details For developers: build a brand pack from the command line
To stand up a reusable brand pack in a checkout, `ingest:brand` accepts the three containers Penpot and Tokens Studio export: a single `tokens.json`, a directory of per-set files with `$metadata.json`, or a `project.penpot` archive.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registers the brand as a profile and builds and validates its catalog. It never changes the default profile: run with `LOLLY_PROFILE=acme` to use the new pack. [Configuration](/info/configuration.html) explains how brand packs and profiles fit together.
:::

## Bring in what you already have

You do not start from a blank page.

**Design files.** Finished work from Figma, Penpot, Illustrator, InDesign or any SVG app opens in Design as a living layout: text stays retypable, shapes stay shapes and images land in your library. The file is read in your browser and nothing is uploaded. [Import a design](/info/design-import.html) lists each format and what carries over.

**Decks.** Drop a PowerPoint `.pptx` on Lolly to file its slides as assets, write a new deck from Markdown in **Markdown Slides**, or use [Rebrand a deck](/info/rebrand.html) to move the whole deck onto your design system.

**Data.** Paste or drop a CSV or JSON table and a tool's repeating fields fill from it, or [Batch](/info/batch.html#make-many-versions-of-one-design) makes one finished file per row.

### From a one-off to a template

An imported layout is an ordinary Design session. **Share with rules** turns it into a tool: you choose which parts other people may change, and they fill in only those.

![Keep the Design master, choose inputs and limits in an authoring copy, then share a reusable .lolly tool that recipients fill in](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) walks through each step.

## Make many, share and automate

- <!--i:download--> **Export.** Tools make SVG, PDF, PNG, JPG, WebP, video and more, in the formats each tool offers, at true print sizes when you need them. See [Export a file](/info/exporting.html).
- <!--i:link--> **Share a link.** A tool's settings travel in its link, so the link reopens the same file anywhere.
- <!--i:layers--> **Make one per row.** Drive a tool from a spreadsheet in [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automate.** The same render runs from the [CLI](/info/cli.html) and from an [AI agent](/info/ai-agents.html).

A link is a complete request. Nobody drew the chart below: its type, its heading and its whole data table were typed into the address bar, and the same link draws the same chart on any device.

![An area chart of monthly signups, every value of which arrived as a query parameter rather than a click](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Where to go next

- <!--i:people--> **[Create](/info/creators.html)**: making, animating, recording, sharing and exporting.
- <!--i:code--> **[Automate](/info/builders.html)**: design systems, tool authoring, the command line, links and agents.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: running Lolly for a team with Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: hosting Lolly and Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: privacy, security and checking a file yourself.
