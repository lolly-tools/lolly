# PROJECT LOLLY: THE DIGITAL FACTORY FOR SECURE, EVERYDAY CREATIVE WORK

> **Status — internal prototype, closed pilot (not finished).** This document describes what Lolly is *trying to become*, written while the pilot is still running. Lolly is a fast-moving behavioural experiment inside the enterprise, not a shipped product. Its cryptographic and file-parsing engines have **not** yet been externally security-audited — treat their protections as strong-by-design, not certified. Lolly is arithmetically robust and, honestly, evidentially empty: it was born yesterday, **SUSE is customer number one**, and if you're using it we need your story to make it better. There's more to share on **August 29**.

Imagine you work at a company with hundreds of employees, a brilliant marketing team, and one or more AI agent helpers. Every single day, your team needs to create thousands of small but quality visual assets: event badges & pull up banners, personalized testimonaial quote cards, localized social media graphics, simply QR codes, and dynamic and aesthetically 'locked-in' charts and files like .ics calender files and promotional email signatures for everyone. 

Traditionally, this creates two major problems:
1. **The Human Bottleneck:** Non-designers use the wrong colors and fonts, breaking the company’s brand rules. Or, designers waste hours manually typing new names onto the same badge design over and over again.
2. **The Security & Cloud Nightmare:** To quickly convert a file or crop an image, employees upload sensitive company data, contracts, and private photos to random, ad-funded websites. Meanwhile, developers pay massive cloud fees to automated text-to-image AI tools that are unpredictable, slow, and frequently mess up text. To top it all off, providence and 'edit history' with flags like "does this document or video contain generative AI?"  "was this file ever changed since it was made" are all sorted. Lolly is also configurable, you want to implement your own auth layer, telemetry, or CA? it's possible for your deployment.

3. **The Hallucination Quality arms race** the 'uncanny valley' of AI is forever a battle.  With reproducible and guarunteed outcomes, AI can move fast and give instant accurate results without adversarial flows or design skills, meaning smaller models but guarunteed production quality.  Lolly also contains a validator to check whether Lolly made the file, and how, with what tool, and by whom — a pilot-stage capability we're still hardening, not an independently audited guarantee.  AI generated assets embedded before the render of a lolly asset will preserve that knowledge and flag parts of the composition as AI generated automateically. 

**This is the problem Lolly is trying to solve.** Lolly is a free, open-source, privacy-first digital factory that runs entirely on your own device—no cloud, no accounts, and no tracking required. The goal is to make asset generation **faster, more predictable, and genuinely easy** — and the closed pilot is how we find out whether it delivers on that in the real world.

---

### How It Works

Instead of creating flat pictures, your design team creates smart templates using **Penpot** or standard web code. These templates (or 'tools') don't contain your traditional static { put value here } information; they contain **rules**. They know exactly how to respond to the presence and absence of information, they decide where a logo goes, what fonts are allowed, and how the layout should stretch if someone has a really long name or it's a really tall poster/video. 

Once a template is locked into Lolly, anyone can use it safely:

1. **For Marketers & Sales Reps:** You can paste a massive spreadsheet with 1,000 customer names directly into Lolly's Batch Grid. It will instantly generate 1,000 perfect, print-ready, on-brand graphics. Because it processes them one after another, it runs cleanly and safely on any device. In fact, an old phone running a modern browser will generate assets with the exact same pixel-perfect accuracy as a top-tier desktop workstation.
2. **For AI Agents:** Instead of asking an AI image model to draw a graphic from scratch (which costs a lot of money and usually gets the text wrong), an AI agent can simply tell Lolly: *"Fill this template out with Name: Alice, Date: Tuesday."* It costs almost nothing in tokens, takes less than a second, and looks immaculate every single time. If an end-user visits an AI-filled link, their device renders the final file near-instantly right in front of them.
3. **For Security & IT:** Lolly works completely offline by default. It includes handy built-in utilities to scrub hidden tracking data, location tags, and camera metadata from your images. You can lock PDFs and ZIP files with passwords right on your machine, or choose to embed opt-in author tags directly into the file metadata or print layout to prove you made it. Your company data never leaves your physical device. One honest caveat while the pilot runs: these cryptographic and parsing protections have not yet been externally audited, so scope your pilot accordingly and treat them as strong-by-design rather than certified.

---

### The Hidden Superpowers of Lolly

* **Tools inside Tools:** You can drop one Lolly tool inside another. For instance, a conference pass template can automatically generate its own dynamic QR code tool inside it. Our ideal future layout engine uses modern web tech (Shadow DOM) so your animations, vectors, and crisp layouts stay fully alive and interactive instead of being flattened into an uneditable picture.
* **The Robot Translator (MCP):** Lolly speaks fluent AI. It has two built-in connection endpoints. One is a lightweight, super-fast endpoint for basic vector graphics. The other is a heavy-duty endpoint that spins up a local browser engine under the hood to render high-end video, print-ready CMYK layouts, and animations.
* **Massive Enterprise Scaling:** If you need to scale up to millions of renders across an entire global infrastructure, Lolly scales out beautifully. Enterprise teams can easily spin up isolated, air-gapped Lolly runner pods inside their networks. Down the road, Lolly will offer pre-packaged Helm charts and containers right on the Rancher Applications Catalog (`apps.rancher.io`) alongside Penpot itself.
* **True Open Source Freedom:** Lolly was originally incubated by the open-source pioneers at SUSE. On **August 29**, the project reaches a key decoupling milestone: it will shed its internal SUSE branding completely, leaving behind a 100% free, generic, unbranded software engine that any company or individual on Earth can run, modify, and own forever. 

Lolly doesn't lock you in, track your movements, or cost you a dime. It is software built the way it can and should be.

---

### Where Lolly is right now

Everything above is the ambition. Here is the honest status: Lolly is an internal prototype in a **closed pilot that hasn't finished**. The engine is deterministic and the maths is sound, but the product was effectively born yesterday and its security engines are not yet externally audited. **SUSE is customer number one.** The architecture is done; the evidence isn't — and that's the gap the pilot exists to close. If you're using Lolly, the single most useful thing you can give back is a concrete before/after: what you used to do, what you did with Lolly, how long it took, and where it fell short. That story is what turns a promising prototype into something proven. More on **August 29**.
