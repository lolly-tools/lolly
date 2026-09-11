# The trade we never agreed to

Nobody sat us down and offered us the deal. It arrived one tool at a time, each step reasonable on its own, until the normal way to resize an image was to send it to a company none of us have met.

This page is about that accumulation. Not about villains, because most of it was built by people making sensible decisions inside incentives that pointed one way. The incentives are the problem, and this page names them.

::: cols
## We did this easily

::: timeline
- <!--i:upload--> We uploaded a logo to a free converter, waited through an ad and downloaded a file we hoped was the same picture.
- <!--i:lock--> We went back for artwork from eighteen months ago and found it behind a login for a plan the team had stopped paying for. The artwork was ours. The file was not reachable.
- <!--i:eyeoff--> We accepted cookies we did not read, on a site we visited once, to do something that took eleven seconds.
- <!--i:hash--> We sent a near-final campaign to a colleague, who sent it onward, and the version everyone uses now is one nobody can point back to.
- <!--i:pause--> We clicked "not now" on the same upsell for a year.
:::

## The cost

- <!--i:upload--> **Our content became the price.** A tool that runs on someone else's server has to be paid for, so the bill arrives as a subscription, an ad, a data broker or a training corpus. The upload was never technically necessary for resizing a picture. Browsers have done that locally for years.
- <!--i:lock--> **Our files became leverage.** Work kept in a format only one program opens is leverage over the person who made it, and leverage that expires with a card is not a partnership.
- <!--i:eyeoff--> **Our consent became paperwork.** Twelve toggles and a forty-page policy do not produce informed agreement. They produce legal cover, and one more task standing between us and the work.
- <!--i:hash--> **Our proof went missing.** For most of the last decade a file carried no reliable record of where it came from. You could live with that while making a convincing image still took a studio. You cannot now.
:::

None of it was carelessness. Each step was the reasonable one available at the time, and the incentives underneath were pointing the same way for everyone.

Living inside it gave the trade its textures. The quiet fear of picking the wrong colour or font for something that was meant to be simple. Every file stuck behind a busy queue, a slow tool or one more approval. An account before we could start, a subscription that outlived the job, pricing ladders built to hold our own work hostage.

## The old way and the new way

| | The usual way | Here |
|---|---|---|
| **Friction** | Upload, queue, sign in, dismiss the upsell, download something you hope is right | Open a link and work. No account, no upload, no waiting on a stranger's server |
| **Risk** | Your file rests on someone else's disk, under their retention policy and their breach exposure | The file never leaves your device, so there is no second copy to leak |
| **Quality** | Silently re-encoded, resolution capped on the free tier, a watermark you pay to remove | Real vector out, print-ready colour, the same render on every device, nothing withheld |
| **Trust** | A policy you have to believe, rewritable at any time without telling you | An architecture you can check, and a signed credential travelling inside every export |
| **Ethics** | Your work becomes training data or an ad profile by default, and consent is a wall you click through | Nothing is collected, so nothing can be repurposed. AI declares itself, and access needs are settings rather than requests |

And the same trade, scene by scene:

| The usual way | Here |
|---|---|
| Your work lives where you do not get a vote: the rules can change, and you find out later | Your work stays with you. Every choice about it is yours, and you can leave with everything at any time |
| A subscription that keeps charging long after the job is done | Free, forever: a version that has been released is licensed so it can never be taken back - see [How Lolly compares](/info/positioning.html) |
| The template that is almost right, with the part you need locked behind an upgrade | What should change is yours to change; what should not is already handled - see [Constraints](/info/constraints.html) |
| Pay the AI again for something it already made, and get it back slightly different | AI answers to you: if it helps make something once, the result is yours, and re-making it is free - see [Our AI Stance](/info/ai-stance.html) |
| Email a brief, then wait days for one small graphic we knew every detail of | Fill in a few fields. The finished file is ready in seconds - see [Make something](/info/make-something.html) |
| Guess at the right font and colour, and hope it passes review | The design rules are baked into the tool. They bend, not break |
| Re-make the same badge, card or banner a hundred times by hand | Paste a spreadsheet. Get a hundred finished, print-ready files at once - see [Using Lolly](/info/using.html) |
| "Which version is the latest?", hunted through chat threads and shared drives | The file is a link: same inputs, same file, every single time - see [Reproducibility](/info/reproducibility.html) |

Each row is a claim you can test rather than a slogan, which is what the rest of this section is for.

## Trust what you can verify 

Every one of those has a fix that is architectural, not a promise in a policy document. The difference matters: a promise is a thing a company can change on a Tuesday, and an architecture is a thing you can check.

- <!--i:cpu--> **The work happens on your device.** Rendering, exporting, converting, stripping metadata: all of it runs in your browser, on your machine. Not as a privacy feature bolted on afterwards, but because that is where the engine lives. It follows that your content cannot be collected, sold or trained on by us, because it never arrives. See [Privacy](/info/privacy.html), and the complete list of what a server ever sees in [Server Surface](/info/server-surface.html).
- <!--i:download--> **Exports are ordinary files.** PNG, SVG, PDF, WebP, TIFF and the rest. They open in software that has nothing to do with us, they keep working if this project disappears and there is no export tier. Your last day using Lolly leaves you with everything you made. See [Exporting and Formats](/info/exporting.html) and [Data Transfer](/info/data-transfer.html).
- <!--i:seal--> **Provenance travels with the work.** Exports carry [Content Credentials](/info/content-credentials-identity.html) by default, recording what made a file and from what. Anyone can check it, including you, including on files we did not make. That turns "trust me" into a question with an answer. Try it on something you made: [Verify It Yourself](/info/verify-yourself.html).
- <!--i:globe--> **There is nothing to consent to.** No trackers, no analytics, no profile, no account required to use the tools. The engine is open source, works offline and needs no sign-in, so the usual consent surface has nothing to ask you about. [Security and Verification](/info/security.html) covers how to confirm that rather than take our word.
- <!--i:people--> **Accessibility is not a later release.** Motion, contrast, text size and preview intensity are preferences in the product, not accommodations you request. See [Inclusive Design](/info/inclusive-design.html).

## What this is not

It is not a claim that everyone doing it the other way acts in bad faith. Server-side software is a legitimate way to build things, and plenty of it is made carefully by people who would rather not be collecting what they collect.

It is not a claim that Lolly does everything those tools do. It does a narrower set of things without the trade.

And it is not a request for your trust. Trust is the thing we are trying to make unnecessary. Everything above is checkable, the code is public and the [Threat Model](/info/threat-model.html) is honest about the limits. If the page and the code ever disagree, the code is the bug.
