# FAQ

Frequently asked questions shown in the accordion on the `/info` landing page.

**How to maintain:** each `##` heading below is a question; everything beneath it
(up to the next `##`) is the answer. Answers use the same lightweight markdown as
the rest of the site - separate paragraphs with a blank line. Add, remove or
reorder questions here and re-run `pnpm run build:info` (or `pnpm run dev:web`).
Everything above the first `##` (this title and these notes) is ignored by the build.

## What happens when I opt-in on the /profile page?

When you first use Lolly, everything you type anywhere is fully private until you deliberately want that information out there via media or a share link (if online).

With the opt-in selected, the profile details you choose are sealed into what you make, naming you as the source. Nothing is included without you picking it.

Lolly produces a large volume of content. We take a strict data minimization approach to prevent risk.

## Was Lolly "vibe coded"?

Lolly was developed with AI-assisted coding, AI-assisted discovery and, in many places, AI-assisted content, using a mix of models and vendors, including those from public-cloud frontier companies.

As of this writing Lolly contains zero known security vulnerabilities in its supply chain, and commits to rapid security response practices when CVEs surface.

A human created the architecture, curated the code with intention and art directed the experience.

Most importantly, Lolly stands on the shoulders of decades of open source innovation from real experts around the world.

A deterministic build-gate exists in Lolly's codebase to keep code and documentation coherent to the average reader and "de-slop" the experience. This may make it difficult for proprietary synthetic enumeration of origin. That is unintentional.

**Generative AI disclosure:**

- **LLM-written code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (this list may expand)
- **LLM discovery:** Gemini 3.1, Fable
- **Documentation:** Sonnet 5
- **Open source libraries:** their respective authors, expressed in the SBOM, comments and file headers

This list does not include models vendored into Lolly.

**Human claims:**

- **Architecture:** Andy Fitzsimon
- **Art direction:** Andy Fitzsimon
- **Human-written code:** Andy Fitzsimon
- **Ideation, review and feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, the Penpot Community (list not exhaustive)

## What are the feature flags?

Feature flags turn parts of Lolly on or off. Usually an administrator controls these - with Lolly, you are in control.

![Every feature flag is a switch you own, sitting in your own profile rather than an administrator's console](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## How do I get the mobile or desktop apps?

Anybody can distribute their own apps, the tools and configuration of those apps should vary widely depending on what audience it's intended for. So there's no one app unless you made it or someone relevant gives it to you.

## Why the name "Lolly Tools"?

**Lolly** because freedom is sweet, and because in Australia, New Zealand and Britain a lolly is a sweet.

**Tools** because a tool sits still until you pick it up. It does not run when you are not using it, and it does not watch you while you are.

## What hurdles could I expect adopting Lolly?

Lolly slots in wherever you already generate files - the CLI is the same engine
as the App, so a pipeline run at 2am can't drift from what a person previews in a
browser. The friction to adoption is rarely technical; it's organisational. Expect these:

**A curated brand catalog has to be authored.** Lolly is a platform, not a
finished pack of your templates. For a *governed rollout*, someone defines the shared
asset catalog (logos, palettes, fonts as permanent IDs) and writes the manifest +
template for each output type. Individuals don't have to wait for that, though - in
the open app anyone can ingest their own files into the catalogue and build tools in
Design from day one.

**No git required to contribute.** Designers make their own tools and templates
in the app, then share them with peers or submit them to whoever owns the
deployment for default inclusion.

**It's deliberately narrow - frame it that way.** Lolly is not for bespoke or hero
content. It *is* your personal DAM - hydrated and supercharged by your design
system, tools and catalog - and it *does* have an open canvas (Design), but
even there colours, type and assets conform to the active design globals, so free
arrangement stays inside the system. Judged against Figma or Canva it will
look limited. Judged as what it is - operationalised, recurring, massive-scale asset
generation - nothing competes. The wrong framing is the most common set-back.

**Change management on the producing side.** Existing processes work today, even if
the output is off-brand. Re-pointing them at the engine means re-testing re-learning,
and "we can already make files" becomes the excuse not to migrate. Start by converting
one high-visibility production quality output and showing the before/after side by side.

Lolly lifts everything up.


## What makes utilities different from tools?

**Basic Answer →** Utilities don't always need to render and therefore can get a different UX. 

**Real Answer →** The reason utilities are hostable inside Lolly Tools is to add yet-another 'convenience layer' of defence to disincentivise data-exfiltration. 

Why? Because it is known that every day, people take **confidential content they already have** and hand it to a
random website to perform one small mechanical operation:

- "**Compress this PDF**" → uploads a contract / payslip / board deck to unknown entities.
- "**convert HEIC to JPG**" → uploads personal photos (with GPS EXIF) to an ad-funded host
- "**crop / resize this image**" → uploads a product screenshot or unreleased asset
- "**format this JSON**" / "decode this JWT" → pastes API responses, tokens, secrets into a formatter
- "**merge these PDFs**" → uploads **two documents that should never share a server**

These sites and their massive clone long-tail are **not trustworthy by default** with
unknown retention, unknown jurisdictions, unknown subprocessors and an ad/affiliate
business model that has every incentive to keep what you give them. The operation is
trivial; the **content is the cost.** 

We win the war for governance with excellent convenience and service. 

![The Utilities view collects the mechanical jobs people usually hand to a random website, all running inside Lolly instead](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Can Lolly edit and render my Figma, Penpot, Illustrator or InDesign files?

Yes. Open **Design** and click **Import a design**: it accepts a native Figma **.fig** (Save local copy), a Penpot **.penpot** export, an Illustrator **.ai** or **.pdf**, an InDesign **.idml** (File → Export → InDesign Markup) or **any SVG** (the wide door - almost any design app exports it). No account, no plugin and no design app licence needed.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Layers arrive as editable boxes on the open canvas: text stays retypable, shapes stay shapes, images join your own image library and type and colours conform to the brand globals. Save it and the layout becomes a reusable, URL-addressable template anyone with Lolly can refill - and you can mix in live tools (a QR code, a chart) that re-render on load. From there it renders like anything else in Lolly - SVG, PDF, PNG and the rest, reproducible from its URL. See [Import a design](/info/design-import.html).

## Can I share my work as a file instead of a link?

Yes. When a link can't carry everything (your own photos, long text), the Share dialog says exactly what would go missing and offers a **.lolly** file instead: one file holding the design, the images it uses and, if you choose, the tool itself. You decide how much travels - your name and details go in only if your profile opts in, licensed art is held back unless you include it, and whoever opens a file that carries a tool is asked whether they trust it before it can run. See [Sharing your work](/info/using.html#sharing-your-work).

## Can two people work on the same design without the internet?

Yes. One person shares an invite (a link, a QR code or a short code), the other accepts, and both devices hold the same session live - presence, focus rings and all. It works on any shared network, including a phone hotspot in a basement, because there is no server in the middle. See [Working together](/info/collaborate.html).

## Where did the SUSE-branded tools go?

They already live in a separate, private repository. A public clone doesn't fetch the SUSE brand pack at all, so a public build runs the neutral `lolly-start` profile - the brand-agnostic community tools plus a blank brand you fill in with your own. SUSE operates its own instance to protect its trademarks.

## Why is it free? What's the catch?

**We built Lolly for ourselves.** SUSE needed thousands of on-brand files, each with its name sealed inside, made without handing anything to outside services. So we built a tool that does all of it on the device, and released it as open source, like everything else we make. We keep maintaining it because we use it every day. **There is no obligation:** everything here works with or without us.

That line is drawn in the licence, not in a promise: anything that runs locally is free, forever. A version that has been released is licensed so it cannot be taken back, and there is no contributor agreement that could relicense anyone's work. See [positioning](/info/positioning.html) for the full statement.

## How much is SUSE keeping private? (aka when is the rug-pull)

The engine, the shells, the schemas and the brand-agnostic tools are open source; SUSE's trademarks and branded tools are the part that stays private, and they are already separated out. You can find an unbranded instance of Lolly at [lolly.ART](https://lolly.art).

The boundary is structural rather than promised. Every released version is open source and cannot be un-released, there is no contributor agreement that could relicense anyone's work, and the only thing held back is the trademark. When another company closed its enterprise Linux sources in 2023, SUSE co-founded [OpenELA](https://openela.org) to keep that code open - the same posture this project inherits.

Full disclosure: SUSE *is* building out internal tooling to integrate Lolly within its IT systems - that's about SUSE's internal set-up, not public vs. private development. Lolly also aims to be built through [Open Build Service](https://openbuildservice.org/), with secure supply-chain artifacts delivered by the [SUSE Application Collection](https://apps.rancher.io/applications).

## What flavour is that Lolly logo?

Some say Lime, others say Mint and sometimes Apple, Lolly brings the sweetness, you make the flavour happen!
