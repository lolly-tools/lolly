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

Tools are just files — HTML, CSS, and JavaScript — stored in a directory your Lolly instance reads from. You can manage this directory the same way you manage any other code or content.

**Using Git to accept tools**

The recommended way to manage your tool library is with a Git repository. Your tools directory is a Git repo. To publish a new tool or update an existing one, a pull request is raised and reviewed. When it merges, Lolly picks up the change automatically.

This gives you a full audit trail of every tool that has ever been available to your users, the ability to roll back to any previous state, and a standard code review process for approving new creative templates before they reach your workforce.

**Building with a curated tool set**

You do not have to give every team access to every tool. Lolly supports building separate instances — or separate catalogues within one instance — so that, for example:

- Your marketing team sees brand campaign tools
- Your sales team sees proposal and presentation tools
- Your IT team sees communication and report templates
- A subset of power users gets access to experimental tools still in development

This is configured at build time by pointing each instance at a different tool directory, or by using catalogue filters to include or exclude specific tools per deployment.

---

### Experimental flags

Lolly includes a set of feature flags that let administrators enable functionality that is not yet on by default. These are intended for organisations that want to test upcoming capabilities before they ship to all users, or that need to unlock specific behaviours for particular workflows.

Experimental flags are set in the platform configuration. Examples of what flags may control:

- **Render formats in preview** — enable output formats (such as AVIF or specific PDF profiles) that are functional but not yet exposed in the default UI
- **Advanced export options** — unlock higher-resolution outputs, bleed marks, or CMYK colour profiles for print-destined assets
- **Agent API surface** — expose a local HTTP endpoint so AI agents and automation scripts can call Lolly as a generation service
- **Developer tooling** — show raw template source, enable hot-reload for tool authoring, expose timing and render diagnostics

Flags that prove stable and broadly useful are promoted to default-on in subsequent releases. Flags that don't make it are removed cleanly — there is no permanent configuration debt from enabling them.

---

### Keeping things current

**Engine updates** bring improvements to the rendering pipeline, new export capabilities, bug fixes, and performance gains. In the deploy model, these travel with your device management updates. In the serve model, you update the server and all users get the new engine immediately.

**Tool updates** are separate from engine updates. A tool is just a file — updating it is as simple as merging a change into your tools directory. Your tool library can evolve continuously without touching the platform itself.

This separation means your creative capabilities can grow week to week, without requiring IT to push a software update every time a designer improves a template.

---

### Source code

Lolly is open source. The engine, shells, schemas, and docs live in the official repository at [github.com/lolly-tools/lolly](https://github.com/lolly-tools/lolly) — clone it, build any target with the [Build Guide](/info/build-guide.html), or author your own tools.
