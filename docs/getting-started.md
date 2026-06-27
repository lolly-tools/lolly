# Getting Started

Lolly is a platform for generating on-brand creative assets — images, documents, social cards, reports, and more — without needing design skills or an internet connection.

This guide explains how it works and how your organisation can adopt it.

---

## How it works

Everything in Lolly is built around a simple idea: design decisions are made once and locked into a **tool**, then anyone can use that tool to produce a finished asset by filling in the content.

**1. Someone authors a tool.**
A designer, developer, or technically minded team member builds a template. They define the layout, fonts, colours, and rules. The tool knows what it produces and how it should look.

**2. The tool is distributed.**
The tool gets published to your Lolly instance — whether that's a web address your team visits, an app on their device, or a command in their terminal.

**3. Anyone generates an asset.**
A marketer needs a localised campaign banner. A sales rep needs a custom quote card for a meeting in an hour. A developer's pipeline needs an OG image for every new product page. They open the tool, fill in the content, and export the file — no design software, no waiting on anyone.

The design decisions never drift. The brand stays consistent. The work gets done faster.

---

## Working styles

Lolly is built to fit how your organisation actually operates. There is no single right way to deploy it — choose the model that matches your security posture, your team's devices, and how you manage software.

### Deploy, don't serve

**Nothing lives on the internet. Your teams hold the platform in their hands.**

In this model, Lolly is distributed to devices the same way any other application is — through your existing device management system (MDM, Intune, Munki, Jamf, or equivalent). Users run it locally as a desktop or mobile app, or access it via a self-contained offline PWA.

- Works completely offline, behind any firewall, in any air-gapped environment
- No server to maintain, no uptime to monitor
- Tool and engine updates flow through your existing device management policy — IT controls when updates reach users, just like any other managed application
- Ideal for environments with strict data handling requirements: nothing leaves the device by default

**Best for:** large enterprises with existing MDM infrastructure, regulated industries, air-gapped environments, or any organisation that needs to control the update cadence of creative tooling.

---

### Serve only

**A single hosted instance. Updates are instant once approved.**

In this model, you run one Lolly instance on a server inside your network (or behind a VPN), and users access it via any web browser. There is nothing to install on end-user devices.

- Ship tool and engine updates to all users simultaneously — publish once, everyone gets it immediately
- Add your own telemetry and usage analytics by hooking into the open-source codebase
- Host behind a VPN or on an internal domain to restrict access to authorised users
- Pair with your identity provider for access control

**Best for:** organisations that want centralised control of the tool library, fast rollout of updates, and usage visibility — without managing installs on every device.

---

### Hybrid

**Devices work offline. The browser works online. Both are always current.**

The hybrid model gives users both: a local app that works without internet access, and an always-available web version for people on borrowed devices, travelling, or working from a browser. Both connect to the same tool library.

- Local app users can generate assets with no connectivity
- Browser users get the latest tools the moment they're published
- Works across Mac, Windows, Linux, iOS, and Android simultaneously
- Useful when your workforce spans both office environments and field teams

**Best for:** organisations with mixed device environments, global teams in variable connectivity zones, or any situation where "it has to work everywhere" is a requirement.

---

## Administration

### Managing your tool library

Tools are just files — a JSON manifest plus an HTML template, with optional CSS and JavaScript — stored in a directory your Lolly instance reads from. The manifest (`tool.json`) is the source of truth: it declares the tool's inputs, output formats, and capabilities. You can manage this directory the same way you manage any other code or content.

**Using Git to accept tools**

The recommended way to manage your tool library is with a Git repository. Your tools directory is a Git repo. To publish a new tool or update an existing one, a pull request is raised and reviewed. When it merges, Lolly picks up the change automatically.

This gives you a full audit trail of every tool that has ever been available to your users, the ability to roll back to any previous state, and a standard code review process for approving new creative templates before they reach your workforce.

**Building with a curated tool set**

You do not have to give every team access to every tool. Lolly supports building separate instances — or separate catalogues within one instance — so that, for example:

- Your marketing team sees brand campaign tools
- Your sales team sees proposal and presentation tools
- Your IT team sees communication and report templates
- A subset of power users gets access to experimental tools still in development

This is configured at build time by pointing each instance at a different tool directory. Beyond that, two mechanisms shape what each user actually sees: **capability gating** (a shell that can't fulfil a tool's declared capabilities shows it greyed-out as a non-runnable "Desktop only" card rather than letting it run — for example, the page-capture tool can't run in the web PWA itself; on Chromium it offers a browser add-on, otherwise it's marked desktop-only) and **per-user feature flags** (see below), which let each person show or hide whole gallery categories.

---

### Feature flags

Lolly has a small set of **per-user feature flags**, surfaced in each person's Profile view. They are stored on the user's own profile (so they ride normal profile persistence and sync) and every flag defaults to **on**. They are personal preferences, not an administrator-configured server setting, and they do exactly two things:

- **Show or hide gallery categories** — toggle whole sections of the tool gallery ("Tools for Everyone", "Designer Tools", "Event Kit", "Offline Utilities") so a user only sees the tools relevant to them
- **Show or hide the Pro / Batch entry** — toggle the "Batch" link in the gallery footer (the batch route still works via a deep link even when the link is hidden)

They do not gate output formats, export options, or any kind of API surface — those are always available where a tool and shell support them.

### Experimental tools

When a tool itself is still in development, its manifest carries `status: "experimental"`. The engine handles this directly: every export from an experimental tool gets a visible watermark applied automatically, so work-in-progress assets can't be mistaken for finished, on-brand output. This is how you put new capabilities in front of a subset of power users before they're promoted to a normal, watermark-free `official` tool.

---

### Keeping things current

**Engine updates** bring improvements to the rendering pipeline, new export capabilities, bug fixes, and performance gains. In the deploy model, these travel with your device management updates. In the serve model, you update the server and all users get the new engine immediately.

**Tool updates** are separate from engine updates. A tool is just a file — updating it is as simple as merging a change into your tools directory. Your tool library can evolve continuously without touching the platform itself.

This separation means your creative capabilities can grow week to week, without requiring IT to push a software update every time a designer improves a template.

---

### Source code

Lolly is open source. The engine, shells, schemas, and docs live in the official repository at [github.com/lolly-tools/lolly](https://github.com/lolly-tools/lolly) — clone it, build any target with the [Build Guide](/info/build-guide.html), or author your own tools.
