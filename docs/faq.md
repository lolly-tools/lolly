# FAQ

Frequently asked questions shown in the accordion on the `/info` landing page.

**How to maintain:** each `##` heading below is a question; everything beneath it
(up to the next `##`) is the answer. Answers use the same lightweight markdown as
the rest of the site — separate paragraphs with a blank line. Add, remove, or
reorder questions here and re-run `npm run build:info` (or `npm run dev:web`).
Everything above the first `##` (this title and these notes) is ignored by the build.

## What happens when I opt-in on the /profile page?

When you first use Lolly, everything you type anywhere is fully private until you deliberately want that information out there via media or a share link (if online).

With the opt-in selected, we embed some of your profile information as provenance into assets and bundles to identify you as the source.

Lolly produces a large volume of content. We take a strict data minimization approach to prevent risk.

## How do I get the mobile or desktop apps?

Anybody can distribute their own apps, the tools and configuration of those apps should vary widely depending on what audience it's intended for. So there's no one app unless you made it or someone relevant gives it to you.

## Why the name "Lolly Tools"?

Because freedom is sweet.

**Lolly** is an Australian, New Zealand, British term for 'sweets' or 'candy'. Just like lollies, tools are very tasty for people needing them.

We're also laughing at the time and bills we are saving with this approach.

**Tools** specifically because that's what Lolly hosts and supercharges: things that can be put to work, and are inactive and in your control without instruction. 


## What makes utilities different from tools?

**Basic Answer →** Utilities dont alawys need to render and therefore demand a different UX. 

**Real Answer →** The reason utilities are hostable inside Lolly Tools is to add yet another 'convenience layer' of defence to disincentivise data exfiltration. 

Every day, people take **confidential content they already have** and hand it to a
random website to perform one small mechanical operation:

- "**Compress this PDF**" → uploads a contract / payslip / board deck to unknown entities.
- "**convert HEIC to JPG**" → uploads personal photos (with GPS EXIF) to an ad-funded host
- "**crop / resize this image**" → uploads a product screenshot or unreleased asset
- "**format this JSON**" / "decode this JWT" → pastes API responses, tokens, secrets into a formatter
- "**merge these PDFs**" → uploads **two documents that should never share a server**

These sites and their massive clone long-tail are **not trustworthy by default** with
unknown retention, unknown jurisdictions, unknown subprocessors, and an ad/affiliate
business model that has every incentive to keep what you give them. The operation is
trivial; the **content is the cost.** The file leaves the building so a free tool can
do 200ms of work that a browser can do locally. 

We can win all wars with excellent conveinece and service. 