
# Lolly — Landing page copy

Save money, time, tokens, with deterministic assets.
No cloud, no waiting, no worries.

---

## Developers

### Your build pipeline should include your visuals.

Images are build artifacts. Treat them that way. Lolly runs from the CLI so you can generate assets the same way you generate everything else — repeatably, automatically, and as part of your workflow.

- **Reproducible outputs.** Same inputs produce the same file, every time. Commit a URL, regenerate on demand — no more checking in images or chasing the latest version from Slack.
- **Get media out of your codebase.** Generate OG images, QR codes, social cards, and data visuals at build time instead of storing binaries in Git.
- **Execute logic inside assets.** Tools like Code Canvas and Chart Creator let you place real content — code snippets, structured data, live values — inside production-quality templates without building a custom renderer.
- **Zero lock-in.** Open source engine, local compute, no API keys, no rate limits.

```bash
brand-tool qr-code --url=https://suse.com --output=./og-qr.svg
brand-tool quotes --quote="Ship it." --output=./quote.png
```

---

## Marketers

### Brand consistency at the scale of a content factory.

Design decisions are locked in at the template level — not in a style guide nobody reads. Every asset your team generates is already on-brand, even if they've never opened a design tool.

- **Infinite permutations, one source of truth.** Localize a quote card into 12 languages, swap a brand lockup across 40 campaigns, or generate every size variant for every placement — without touching the design. Drive it all from a spreadsheet in the batch grid: paste or import a CSV, get one finished asset per row.
- **No creative agency bottleneck for routine assets.** Email signatures, event countdowns, quote cards, street maps — everything your team needs on a Tuesday at 4pm, self-serve.
- **Collaborate without compliance risk.** No customer data uploaded to third-party cloud services. No SaaS licensing to audit. Runs entirely on local device compute.
- **Operationalize production.** Connect structured data — campaign names, dates, stats, speaker details — to templates that output print-ready files. Your operations team can run a campaign without touching design software.

---

## Sales

### Walk into every meeting with exactly what you need.

You're on the road, the deck is wrong, the customer asked for something specific. Lolly turns any device into an asset studio — no designer, no wait, no excuses.

- **Wait on nothing.** If you're on the road, there are no days left before your meeting, you need assets now. Generate them.
- **One person army.** The power of a coordinated global campaign in the palm of your hand. Every rep, every region, always on-brand.
- **World class experience.** Nothing looks rushed even though it was rendered instantly. Nothing is a one-off — so every interaction gets a little more polished than the last.
- **Wow your team is fast!** They're asleep. This was solved the first time I needed it.

---

## Journalists

### Your editorial toolkit, built for speed and precision.

Build your info-editorial style once, then generate publication-quality assets from live data as it happens.

- **Bring data directly into visuals.** Connect structured data to chart, map, and table templates. Update the numbers; the layout takes care of itself.
- **Match your publication's style, exactly.** Tools are authored with hard-coded typographic and color constraints — your house style enforced at the template level, not as a loose guideline.
- **Print-ready or screen-ready.** Export SVG, CMYK PDF, high-res PNG, or 60fps video from the same template. One source, every format your production desk needs.
- **Reusable formats for recurring stories.** Election results, quarterly earnings, weather events — build the template once and reuse it every time the story runs.

---

## Media & Creatives

### Stop doing things machines do best.

You design systems and solve problems, not one-offs. Lolly is the execution layer that turns your design decisions into tools your whole organization can use — without you in the loop for every asset.

- **This is the frontier.** Advanced filters, compositing, animation, generative design — the platform has no ceiling. Every web technology is available to the template author. Do more than any creative suite would allow - with all the power to get finished production quality.
- **Tools compose tools.** One tool can embed another tool's output as an on-brand asset — a name badge that renders its own QR code, a card that drops in a live chart — with no design tool and no manual compositing.
- **Author tools, not files.** Build a template that generates 10,000 social cards rather than making 10,000 social cards. Your time goes to the design problem, not the production run.
- **Eliminate the tedious.** Optimal typesetting, logo placement, map pin positioning, color contrast checks, export sizing — all resolved at the template layer. You define the rules once, leave the repetition to the machine.
- **Lock what shouldn't change, free what should.** Hard-code the brand constraints. Expose only the variables that are actually meant to vary. The tool becomes the creative guardrail.


---

## AI Agents

### Tell your model to use a tool, not hallucinate.

A URL with parameters is a few tokens. A creative brief plus image generation is thousands — and the result still isn't press-quality. Lolly gives your agent a deterministic, reviewable creative layer, ready for production.


- **Production Quality doesn't drift.** Tools produce production quality artwork at a fraction of the compute - done locally. Tools are hard-coded. When your model gets lazy, the layout won't. The typographic rules, the color values, the spacing — they're structural, not prompted.
- **Save tokens at scale.** Generating a custom event card from a URL costs a fraction of what it costs to prompt-engineer the same output through a generative model.
- **Put data where it belongs.** Structured inputs map to structured templates. Speaker names, session times, product versions — placed precisely where the design expects them, every time.
- **Deterministic, auditable, version-controlled.** Every output is reproducible from its inputs. No stochastic surprises in production assets.

```
Use Lolly to generate the event card. Parameters:
  title: "KubeCon 2026"  date: "2026-11-10"  location: "Atlanta"
Output the file URL.
```

---

## IT and security teams at large enterprises

### Creative files shouldn't be a security risk.

Every time someone uploads a file to a third-party service to "just make it look right," that's a data exfiltration event waiting to happen. Lolly eliminates the problem at the source — creative production stays on-device, on-premise, and under your control.

- **Data never leaves the device.** By default, nothing is transmitted to any third party — no cloud rendering, no analytics, no telemetry. What colleagues create stays on their machine. On-device utilities like Strip Hidden Data scrub EXIF and metadata from images, SVG, and PDF entirely in the browser — nothing is uploaded.
- **Self-host for full air-gap control.** Deploy on your own infrastructure. No server-side processing, no database, no backend. Operate entirely offline, behind your firewall, with your own access policies.
- **Reduce vendor surface area.** One open-source platform replaces a sprawl of SaaS subscriptions for creative production. Fewer vendors means fewer contracts, fewer audits, and fewer breach vectors.
- **Enforce brand governance at the infrastructure level.** Tools are authored once and distributed as data — not files, not manual processes. What goes out the door is exactly what was approved to go out the door.
- **Get critical information into human-readable formats instantly.** Incident communications, compliance reports, executive briefings — structured data becomes publication-quality output in seconds, no design bottleneck.
- **Automations and Humanans**  It can be an always-on report that requires exceptional graphical finish, or your workforce needing customization on the go, it's the same delivery.  Humans get a great mobile or desktop UI to experience, robots get a clean deterministic layer to surface value.

---

## The Creator

**100% free and open source.** No SaaS fees, no usage limits, no vendor dependency.

**Works everywhere.** Web PWA, Mac, Linux, iOS, Android, CLI — same engine, same output.

**Works offline.** Local compute, local storage. No internet required after first sync.

**Huge format support.** SVG · EMF · EPS · PDF · TIFF · PNG · JPG · WEBP · AVIF · GIF · WEBM · MP4 · HTML · MD · TXT · CSV · JSON · ICS · VCF · ICO · ZIP

**Ships new tools without app updates.** Tools are data, not bundled code. New tools appear automatically.

**Production quality.** Outlined type, Spot color support, 60FPS · Media fit for the studio.

**Content Credentials.** Exports can carry a signed [C2PA](https://c2pa.org) manifest — the [Content Authenticity Initiative](https://contentauthenticity.org) standard for tamper-evident provenance — created entirely on your device.

**Organise & render in bulk.** Keep saved work in nested Projects folders, then render a whole folder — or any multi-selection — as one zip. No batch grid required.

**Shortest shareable links.** Every design lives in its URL; a big one packs into a compact token so the link stays short enough to paste anywhere.


## The Tools


Think of it like a vending machine for design. Make a selection, get a result. Every time.

A tool is a ready-to-use creative template that knows exactly what it's making and how. Give it a headline, a date, a number — and it produces a finished, on-brand asset.

No design experience needed. No decisions about fonts, colors, or spacing — the tool already knows best. Whether you're a designer, a marketer, a developer, or an AI agent, the output is the same.

Tools are authored once by the people who know the brand, and then used by everyone else — from a web browser, a phone, the command line, or an automated pipeline. The design decisions are locked in at the template level. The only thing left to do is fill in the content.
