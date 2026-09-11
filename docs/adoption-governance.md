# Adoption & Governance

> Lolly shipped as open source in August 2026, and SUSE is its first customer. This page is the honest account of who it is for, how people are meant to adopt it, how we know whether it is working and who governs what it produces.

Most of this platform's documentation describes what Lolly *can do*. This page describes what Lolly is *doing right now*: running SUSE's own rollout as the first pilot, gathering evidence and trying to change a behaviour - how ordinary, non-designer colleagues get an on-brand file made.

## Status

**Lolly is released, and its evidence is young.**

- **Version 1.0 is public.** The engine, every shell, the schemas and the docs shipped under MPL-2.0 on 30 August 2026, with installers for macOS, Linux, Android and iOS and the hosted app at lolly.tools. SUSE runs the same code on its own instance. Features, defaults and the tool catalog still move between releases as we learn.
- **Its security is strong by design and not yet independently audited.** The C2PA provenance seals, the X.509 identity handling and the on-device PDF, ZIP and link encryption are built on standard algorithms, covered by fuzz targets and a written [threat model](/info/threat-model.html), and hardened inside SUSE's own security practice. An independent audit has not been done. Where a contract requires that assurance, it does not exist yet.
- **The maths is settled; the adoption data is not.** The engine is deterministic and a render reproduces byte for byte. Real-world adoption evidence is a few months old, most of it SUSE's own. That is by design: we collect stories from people voluntarily, never data invisibly.
- **If you're using it, we need your story.** The architecture is done; the evidence is not. What actually improves Lolly from here is real usage - what worked, what didn't and what you managed to make. See [We need your story](#we-need-your-story).

The framing matters: judged as a finished marvel, Lolly could disappoint you at the fringes. Judged as a platform proving a specific behavioural change - routine asset creation, done safely and professionally, without a designer in the loop - its job and its measure of success are clear.

## Who Lolly is for

Adoption succeeds or fails on the **producer** - the non-designer who has to make something on-brand and, today, either waits for a designer or does it off-brand in whatever tool they have. Everyone else in this table exists to make that person's path frictionless.

| User | Who they are | The friction Lolly removes | What they adopt |
|---|---|---|---|
| **The producer** | Marketers, sales, events, ops, comms - non-designers who need finished, on-brand files | "I need this now, I don't want to break the brand and I don't want to wait for design" | The app: pick a tool, fill in fields, get the asset |
| **The brand creative owner / designer** | The people who own how the brand is expressed | Re-typing the same layout, policing off-brand output after the fact | Authoring tools & the asset catalog - encoding the rules once |
| **The developer / platform team** | Engineers who automate and deploy | Storing binaries in Git, custom renderers, cloud image bills | The CLI, URL mode, MCP endpoints, self-hosting |
| **The AI agent** | Automated workflows that produce assets | Token-expensive, drifting, un-auditable image generation | The MCP tools - deterministic renders from parameters |
| **IT & security** | The people accountable for data leaving the building | Colleagues uploading sensitive files to random web tools | On-device utilities, air-gapped deployment, governance-as-data |

The pilot's centre of gravity is the **producer**. If producers don't self-serve, nothing else matters - the developer integrations and the governance model are means to that end.

One producer case is easy to miss because it is not marketing at all: **critical communications**. Incident notices, compliance reports and executive briefings are structured data that needs to become a clear, finished document in minutes, at any hour, with no design bottleneck in the path. A tool authored once for each of those formats means the 2am incident notice comes out as correct as the campaign poster did.

## What onboarding looks like

### The first 15 minutes (any producer)

1. **Open Lolly** - the web app needs no install, no account, no sign-up. Nothing you type into a tool is sent to Lolly - there is no server collecting it.
2. **Pick a tool** that matches what you need (an event tile, a quote card, a signature).
3. **Fill in the fields.** No fonts, colours or spacing to decide - the tool already holds the brand rules.
4. **Get the file.** Download it, copy a share link or export a batch. Done.
5. **Save your work** - reopen it later as a session, file it into a project or turn it into your own template to start from next time. No git, no ticket.

Step 3 is the one that carries the pilot. A tool opens with the brand already on it, so the only thing left to decide is the words.

![Deck Studio's first slide opened cold, already carrying the brand's type, colour and title layout before a single field is filled in](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&css=%23tool-canvas%20.ds-slide~.ds-slide%7Bdisplay%3Anone%7D&cropSelector=%23tool-canvas%20.ds-slide&dark=1&filename=ce-deck-studio-cold)

The measure of a good onboarding here is blunt: *did they leave with a finished, on-brand file, without asking anyone?*

### The brand owner / designer

Onboarding is about handing over control of the rules, not the output:

1. Define the **asset catalog** - logos, palettes, fonts as permanent IDs.
2. Author the **tools** most in demand (start with the two or three asset types your team asks for weekly).
3. Convert **one high-visibility output** and show the before/after side by side - this is the single most effective adoption lever.
4. Set the **guard-rails**: lock what must never change, expose only what's meant to vary.

![The Brand Studio's Files room, where logos, images and fonts become permanent IDs a tool can call](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dcatalogue&width=1440&height=900&dpi=192&waitMs=1800&walker=1&format=svg&dark=1&filename=aud-brand-catalogue)

### The developer / platform team

1. Run a tool from the **CLI** to see the same engine the app uses (`lolly qr-code --url=… --output=…`).
2. Wire a render into a **build step** or an **MCP endpoint**.
3. Decide the **deployment model**: hosted PWA, self-hosted or air-gapped runner pods.

The Dashboard's capability map is the inventory to scope that decision against: every part of the platform as its own card, grouped by what it makes and where it runs.

![The Dashboard's What Lolly can do panel, the whole feature set laid out as grouped cards rather than a prose feature list](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dcaps&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23dash-caps&walker=1&format=svg&dark=1&filename=ce-capability-map)

### IT & security

1. Confirm the **data posture**: no telemetry, nothing uploaded by default and no backend in the core render/verify path - the two optional server components are inventoried on [Server Surface](/info/server-surface.html).
2. Scope a first rollout to a low-risk context; the independent assurance described in [Status](#status) is still open.
3. Decide who owns **governance** - see [Governance](#governance) below.

## Measuring adoption

We measure a behavioural change, not feature usage. The north-star is **design-ticket deflection**: routine creative requests that are now self-served and never reach the design queue at all.

| Signal | What it tells us | Type |
|---|---|---|
| **Activation** | Share of invited pilot users who render at least one *real* asset | Leading |
| **Self-serve rate** | Assets produced without a design ticket | Leading |
| **Time-to-asset** | Brief → finished file, in minutes not days | Leading |
| **Tool coverage** | Share of routine asset types that have a matching tool | Leading |
| **Repeat use** | Users who come back within a 30-day window | Leading |
| **Design-ticket deflection** | Routine requests that never reach the design queue | **Lagging / north-star** |
| **Story capture** | Concrete before/after cases collected from real users | Qualitative |

A leading signal moving without deflection following is a warning: people are trying Lolly but the work is still landing on a designer's desk. Deflection is the number that says the behaviour actually changed.

### The 90-day pilot cycle

Adoption runs on a **90-day** feedback loop. Each cycle:

1. **Weeks 1–2 - Onboard a cohort.** Bring in one team, author the tools they most need, remove the obvious blockers.
2. **Weeks 3–10 - Use and observe.** Watch the leading signals; collect stories; fix what's in the way.
3. **Weeks 11–12 - Review and re-aim.** Read the deflection number, decide which tools and which next cohort come next.

The 90-day cycle is the *cadence*. It is not the goal - it's how often we re-check whether the goal is moving.

### From cycle to deflection target

The goal the cycle serves is deflection, and it should ramp. The pilot targets **30% design-ticket deflection by month 6** - roughly one in three routine requests self-served away from the design queue.

| Month | Focus | Target deflection |
|---|---|---|
| Month 1 | Onboard first cohort; author first tools | baseline (~0%) |
| Month 2 | First self-serve wins | ~5% |
| Month 3 | End of first 90-day cycle; review | ~10% |
| Month 4 | Expand the tool catalog | ~18% |
| Month 5 | Onboard second cohort | ~25% |
| Month 6 | **Target** | **30%** |

30% is deliberately a *pilot* target, not an end state. It's the threshold that says the behaviour change is real and worth scaling - not a ceiling on what deflection could eventually reach.

## Governance (when you want it)

Most people just make things - work in the app, save what they make as a **session** and pass it on as a share link, a backup or a live collaboration, with no git and no approval step.

They can go further without touching git at all. From any tool, **Save** offers *save as a template* and *save as a variation*: the current doc becomes a named starting point that appears in that tool's "New from template" chooser the next time it opens, kept with your profile. No deployment owner, no commit, no pull request. To hand one to a colleague, share it as a **`.lolly` file** - a self-contained bundle anyone can import - or submit it for catalog inclusion. A marketing team can build, name and circulate its own variations of a tool entirely inside the app.

This is the answer to a claim you will hear often: that *governance by git* is an impossible roadblock for creative and marketing teams. Here it never was the only path, and it is no longer the default one. Brand governance lives **inside the tool itself** - the rules are part of the instrument, not a review gate laid over it (see the guard-rails bullet below), so staying on-brand costs a producer nothing to learn and nothing to wait for.

Git enters only when an organisation wants a single **canonical** catalog everyone shares - the reviewable source of truth. Then whoever runs the deployment records a template's values into the brand pack and commits it - after which it appears in the tool's "New from template" chooser and is deep-linkable as `?template=<id>`. That commit is the locking step, and it belongs to the deployment owner, not the creator. It runs the rules the way engineering runs code - **the rules are data, and changing them is a reviewable change** - and it is entirely optional. Teams that don't want a shared canonical catalog never meet git.

And git is not the only way to govern live. Everything above is self-owned governance-as-data; the other shape is a **control plane**. [lolly.work](https://lolly.work) is a separate open-source service you host that governs the running shell without a code change: SSO-gated sign-in, feature-flag / export / watermark policy, tool-input overlays, catalog federation, approvals and a hash-chained audit log. It is optional and additive - Lolly still runs fully standalone and still renders on-device - so the choice is per deployment: nothing hosted (individual freedom), or a control plane for org-wide governance (organizational freedom).

- **A shared catalog can be the source of truth.** Tools and assets are git-tracked content - a manifest, a template, optional hooks. What ships is exactly what was approved to ship.
- **Review can be the moderation - for the canonical catalog only.** Promoting a template into the shared source of truth is a change to git-tracked content, so it can be a pull request: elegant for engineers, unfamiliar to most brand and marketing teams. The gap is now narrow, because this is the *only* place git appears - creators make and share templates without it, and reach the canonical catalog by **submitting** a `.lolly`, not by opening a PR. Where brand owners want the final say without living in git, bridge that step with a light review, or let IT own the merge (which some long-running production environments actually prefer). Teams that don't want a canonical catalog skip all of it.
- **Guard-rails are structural, not advisory.** Brand constraints are hard-coded in the tool; even the open canvas (the **Design** tool) conforms colours, type and assets to the brand globals. Off-brand output isn't policed after the fact - it's prevented at authoring time.
- **Feature flags put control local.** Parts of Lolly can be turned on or off per deployment. Usually an administrator owns those; with Lolly, whoever runs the deployment does.
- **Configuration is yours.** A deployment can overlay its own authentication, telemetry or Certificate Authority to meet corporate compliance - none of it is on by default.

![Every part of Lolly as its own switch, so turning a whole category of tools off is one click, not a support ticket](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&cropSelector=%23feature-flags-section&format=svg&walker=1&dark=1&filename=aud-feature-switches)

The most common adoption set-back is not technical; it's **framing and change management**. Existing processes work today even when the output is off-brand, and "we can already make files" becomes the excuse not to migrate. The counter is to convert one high-visibility output well and let the before/after make the case. See the [FAQ on adoption hurdles](/info/faq.html#faq-what-hurdles-could-i-expect-adopting-lolly).

## We need your story

Because Lolly collects no telemetry and no component reports usage back to us (see [Server Surface](/info/server-surface.html) for the two optional server components and what they keep), **we genuinely do not know who runs it or how well it's working** - and that's by design. The flip side is that the pilot depends on you telling us.

If you are piloting Lolly, the most valuable thing you can contribute is a concrete before/after: what you used to do, what you did with Lolly, how long it took and where it fell short. That evidence - not more architecture - is what moves this from a promising prototype to something proven.

## Honest limitations

To keep the framing straight, the things Lolly is *not* yet:

- **Not yet independently certified.** See [Status](#status). The cryptography and parsers are fuzzed, threat-modelled and hardened inside SUSE; no independent party has certified them.
- **Not finished.** Version 1.0 is the start of the public record; expect rough edges and change between releases.
- **Not a turnkey pack of your templates.** Lolly is a platform - someone has to author the catalog and the tools before producers can self-serve.
- **Not for hero content.** It's for operationalised, recurring, massive-scale asset generation. Judged against Figma or Canva it will look narrow - that narrowness is the point.
- **Not yet backed by much evidence.** The maths is sound; the track record is months old. Help us change that.
