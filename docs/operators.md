# Lolly for Operators

You get to be the person who said yes to something both safe and popular. You close an exfiltration hole, gain capability and delete a request queue in one move, which is the rare security win that makes you more liked rather than less: no 3am call because embargoed files reached a random web tool, fewer vendors and contracts on your plate and a record you can point at when someone asks. Pick the lane below that matches the function you answer for.

You govern the whole relay: a creative authors the rules and a developer scales them, and it is the operator who makes that safe to run across an organisation, which [The lifecycle of a campaign](/info/overview.html#the-lifecycle-of-a-campaign) follows end to end.

New here? [Adoption & Governance](/info/adoption-governance.html) is the rollout in full. [Deployment](/info/deployment.html) covers deploy, serve and hybrid, and [Configuration](/info/configuration.html) is what shapes a single instance.

## Sales

Walk into the meeting with exactly the file you need, made on the way there. Drop the deck you already have in and rebuild it sharp as a native deck file, with no request queue between you and the asset.

- **[Lolly for sales teams](/info/sales.html)** - the playbook: fixing the deck you have, rebuilding it natively and making the one-off asset yourself.
- **[Exporting & Formats](/info/exporting.html)** - the deck, PDF and image side of the export panel, when the file has to open on someone else's laptop.

## Press

Live data into charts, maps and tables that already match the house style. Build the story format once and reuse it every time the story runs, for print and for screen.

- **[Lolly for the newsroom](/info/press.html)** - the playbook: the info-editorial style, live data in and publication-quality output.
- **[Utility views](/info/utilities.html)** - the spreadsheet and the converter, for the step before the chart.

## Marketing

Every size, every language, one source of truth. Paste a spreadsheet and get one finished file per row, with no agency in the middle of the routine files.

- **[Lolly for marketing teams](/info/marketing.html)** - the playbook: variants at volume, localisation and what stops being a bottleneck.
- **[Using Lolly](/info/using.html#batch-pro-mode)** - the batch run itself: a sheet in, a folder of assets out.

## Security

The usual way routine creative work gets done is a liability surface: files emailed to outside contractors, brand assets uploaded to a dozen web editors, customer data pasted into a stranger's site to make a quick graphic. Lolly is the immune response to that, because it replaces the work rather than adding a control on top of it: the quote card, the localised banner and the redacted screenshot are made on the employee's own device against your brand, so nothing uploads that you did not put there and every result is reproducible from its inputs. Exports can carry several layers of cryptographic record - a C2PA Content Credential signed by a key generated on the device and never readable off it, the invisible Lolly Imprint and an opt-in durable mark that outlives a re-save - each of which is tamper-evident and strippable: a credential flags a change rather than preventing one, and that is precisely what makes fully offline verification possible. The cryptography and the file parsers are going through SUSE's enterprise-grade hardening: the seals, on-device signing and encryption are real and defensible now, so where a contract calls for certified assurance, deploy them as defence-in-depth while that process completes.

- **[Trust](/info/trust.html)** - every claim this site makes, with the mechanism that enforces it beside it.
- **[Security & Verification](/info/security.html)** - the standards, primitives, trust model and testing, written for a reviewer.
- **[Threat Model & Trust Boundaries](/info/threat-model.html)** - what Lolly defends against, what it explicitly does not and where each boundary falls.
- **[Server Surface](/info/server-surface.html)** - the complete inventory of what runs server-side (two optional components) against what runs on the device.
- **[Parser Inventory](/info/parser-inventory.html)** - every parser that touches a file a user opens and what each one is hardened against.
- **[Verify It Yourself](/info/verify-yourself.html)** - check the claims against a real export, step by step, with nothing you cannot run yourself.
- **[Privacy Policy](/info/privacy.html)** - the formal statement of what is and is not collected, stored and sent.
- **[Sovereign creative production](/info/sovereign-production.html)** - air-gapped deployment, consent-gated networking and on-device signing.
- **[Adoption & Governance](/info/adoption-governance.html)** - who approves a tool, how brand rules become enforceable and what the catalog-as-a-repository option buys you.

## Legal

MPL-2.0 with no contributor licence agreement, stated plainly, with what is not claimed stated as clearly as what is. Content Credentials are tamper-evident and strippable, so the pages below say what a signature actually asserts before anyone writes it into a contract.

- **[AI marking and the EU AI Act](/info/eu-ai-act.html)** - Article 50, the Code of Practice that points at C2PA and Lolly's honest fit.
- **[How Lolly compares](/info/positioning.html)** - the licence facts: MPL-2.0, no contributor licence agreement and what free forever actually rests on.
- **[Content Credentials Identity](/info/content-credentials-identity.html)** - what a signed credential asserts, what it does not and who the certificate names.
- **[Data Transfer](/info/data-transfer.html)** - the backup bundle a records request or a device handover is answered with.

## AI

Agents supply inputs, never a persona. AI helps when it is asked, what it made says so and your work carries your name rather than a model's.

- **[Our AI Stance](/info/ai-stance.html)** - what Lolly does and does not do with generated content, and what enforces each commitment.
- **[Generated once, rendered the same](/info/ai-features.html)** - the AI features that ship, and why inventing pixels is marked while removing them is not.
- **[Input, not impersonation](/info/input-not-impersonation.html)** - why an agent supplies inputs and never a persona, how that is enforced and what a rogue agent still cannot do.
- **[AI Agents](/info/ai-agents.html)** - what an agent can actually drive, if your teams are already pointing one at this.
