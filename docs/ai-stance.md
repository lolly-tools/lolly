# Our AI stance

Lolly was built in the middle of the biggest change in how media gets made since the printing press, by people who are neither panicked about AI nor breathless about it. This page states the project's position plainly and pairs every claim with the mechanism that enforces it, so you can verify rather than trust.

> "We're drinking like the tap will run dry any moment. It won't - today's AI is the worst it will ever be. If we survive the flood, it won't be by hoarding what's in the rusty water tank down the hill, full of sediment. It will be by irrigating and reclaiming ***our*** land for a prosperous future."
>
> - Andy Fitzsimon, Lolly Contributor

![A supercell storm breaking over an outback homestead - the tank and sheds below, floodwater already cutting channels through the dry paddock](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} generated image %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{resized} and %act{exported to WebP} as %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Verify this now](/#/verify?src=%2Finfo%2Fthe-flood.webp)

To be precise about it, because this page argues that precision matters: the image above is generated, not photographed. No camera was pointed at that homestead, because there is no homestead. It describes regional Queensland, Australia, prompted from The United Kingdom, generated in a datacenter in the United States. It attempts to be faithful to a place without being a record of one, and that distinction is the entire reason its Content Credentials say so.

Here is what that looks like when you check it. Nine steps survive in the file: five recorded by Google as it generated and watermarked the image, then four recorded by Lolly as it opened, created, marked and converted the version on this page. Lolly did not generate anything, and its entry says so.

![The change history Lolly reads back out of the finished file - five steps recorded by Google, then four by Lolly, ending in the WebP on this page](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Andy's metaphor for a flood is this: the scarcity posture toward AI - invest everything in the few, diminish yourself today and worry later - is drinking spoiled tank water while the rain sets in and floodwater races across the plains toward you. Generated content is about to be effectively infinite. When something becomes infinite, its value moves to whatever remains scarce around it: trust, provenance, brand coherence and human judgment. Lolly is not a bigger bucket for the flood. It is irrigation - channels that direct the water, and soil where things actually grow.

## The stance, in five commitments

- <!--i:layers--> **AI is welcome as input, never as impersonation.** Agents are first-class users of Lolly: they run the same tools people do, through the [MCP server](/info/mcp.html) and [URL mode](/info/url-mode.html), inside exactly the same constraints. A tool that cannot emit an off-brand asset for a person cannot emit one for an agent either - the guard-rails do not care who is throwing the ball. What no agent gets to do is pass its output off as something it is not.
- <!--i:shieldcheck--> **AI declares itself.** When AI generated the pixels, the export says so: a machine-readable assertion in the file's Content Credentials and a visible GEN AI badge when anyone verifies it. Lolly also reads and surfaces the AI declarations of files made elsewhere, and flags when a SynthID watermark is likely present - reading the declaration, not the watermark itself. The same rule binds Lolly's own on-device rewriter: every sentence it writes carries a public statistical watermark in its word choices, disclosed here and in the tool, so text a model wrote stays self-declaring even as a plain-text copy - and anyone can check it on the [Verify](/info/verify-yourself.html) page. The scheme is public by design: verification for everyone, secrets for no one. Audiences deserve to know how media was made - that sentence appears on our [Inclusive Design](/info/inclusive-design.html) page as an ethical commitment, and this is what makes it real. And when media you have declared as AI-made is placed into a design, the export's own credential says so too: a composite origin mark and a signed, machine-readable AI disclosure.
- <!--i:check--> **Provenance is default-on.** Exports carry [Content Credentials](/info/content-credentials-identity.html) by default, not as a buried setting. The chain covers edits and ingredients, so a work's history travels with it. You can [verify this yourself](/info/verify-yourself.html) on any file Lolly produces.
- <!--i:people--> **People stay the authors.** Every input is ultimately a decision, triggered somewhere by a person, no matter how many systems or left turns it took to get here. An agent can carry a decision a long way. It cannot originate one. The words, the image, the palette, the call that needed judgment: tools scale that judgment, they do not replace it. The tedious parts are what get automated: the brand-checking, the re-exporting at every size, the hand-localising. What remains is the authorship.
- <!--i:globe--> **Channels, not buckets.** Today's models are the floor, not the ceiling, so we refuse to build anything whose value depends on hoarding access to them. The engine is open source, renders on your own device and works offline. There is no model moat, no usage meter, no scarcity business attached to the flood itself. The durable investment is the infrastructure around the water - and that infrastructure is what we give away.

## Human decision is the point

Let us be crystal clear about what sits underneath every commitment above.

Individuals shape the earth and our history. Their choices, made one at a time, become the world the rest of us live in. Their actions make it. That is not sentiment, it is simply how anything has ever happened.

So we empower human decision and we do not compromise it. The right to choose. Agency. Autonomy. The ability to decide and to act, and for that act to be yours.

Tools here scale what a person decided. They do not decide instead of them, and they never quietly stand in for them. Where a decision is carried by automation, the record still leads back to the person who triggered it, however many systems and left turns it passed through on the way.

We honour that end to end, and we record it: for history, for accountability, for trust and for tomorrow.

## AI, on your terms

You never need AI here. If you choose it, three things hold:

- <!--i:people--> **You are in control.** AI helps only when you ask, and only with the piece you point it at. Nothing is decided for you.
- <!--i:check--> **It stops costing.** If AI helps make something once, the result is yours. Using it again is free, however many times you need it.
- <!--i:shieldcheck--> **It stays honest.** A piece made by AI says so, and what you make carries your name instead of pretending to be someone else. Even the built-in help works this way: [Ask Lolly](/info/ask.html) answers with the manual's own sentence and a link, never a made-up answer.

## What this is not

- <!--i:check--> **Not a ban.** Tools may use AI where it serves the work, and agents are a supported audience - see [AI Agents](/info/ai-agents.html).
- <!--i:seal--> **Not a purity claim.** Lolly reads provenance broadly and writes it honestly; it does not pretend to detect every generated pixel on the internet.
- <!--i:sunburst--> **Not a moral panic.** The flood is not the enemy. Unattributed water is.

## How to hold us to it

Every commitment above is enforced in the open codebase, not in a policy PDF: the provenance path, the GEN AI labelling and the no-trackers guarantee all ship with tests, and the [Verify It Yourself](/info/verify-yourself.html) page walks you through checking the claims against a real export. If you find a place where the code and this page disagree, the code is the bug.
