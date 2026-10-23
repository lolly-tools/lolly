# The trade we never agreed to

Nobody sat us down and offered us the deal. It arrived one tool at a time, each step reasonable on its own, until the normal way to resize an image was to send it to a company none of us have met.

This is not a story about villains. Most of it was built by people making sensible decisions inside incentives that all pointed one way. The incentives are the problem.

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

- <!--i:upload--> **Our content became the price.** A tool that runs on someone else's server has to be paid for, so the bill arrives as a subscription, an ad, a data broker or a training corpus. The upload was never needed to resize a picture. Browsers have done that locally for years.
- <!--i:lock--> **Our files became leverage.** Work kept in a format only one program opens is leverage over the person who made it, and leverage that expires with a card is not a partnership.
- <!--i:eyeoff--> **Our consent became paperwork.** Twelve toggles and a forty-page policy do not produce informed agreement. They produce legal cover, and one more task between us and the work.
- <!--i:hash--> **Our proof went missing.** For most of the last decade a file carried no reliable record of where it came from. You could live with that while making a convincing image still took a studio. You cannot now.
:::

Living inside it gave the trade its textures. The quiet fear of picking the wrong colour or font for something that was meant to be simple. Every file stuck behind a busy queue, a slow tool or one more approval. An account before we could start, a subscription that outlived the job, pricing ladders built to hold our own work hostage.

## The old way and the new way

Take the smallest job there is: a logo that needs resizing.

![Two ways to resize a logo. The usual way uploads it to a server, where it rests on their disk under their retention rules. The bill arrives as ads, data or training, and you download a file you hope matches. Here, your device renders it and you have your file, with no second copy anywhere.](/info/diagrams/concepts/two-ways-to-resize.svg)

The same trade runs through everything else:

| The usual way | Here |
|---|---|
| Upload, queue, sign in and dismiss the upsell, or else email a brief and wait days for one small graphic | Open a link and work. Fill in a few fields and the finished file is ready in seconds. See [Make your first file](/info/make-something.html) |
| A subscription that outlives the job, the part you need locked behind an upgrade and a watermark you pay to remove | Free, forever: a released version is licensed so it can never be taken back ([How Lolly compares](/info/positioning.html)). What should change is yours to change; what should not is already handled ([Constraints](/info/constraints.html)) |
| Files silently re-encoded and capped in resolution on the free tier, with a guess at the right font and colour that you hope passes review | Real vector out, print-ready colour and the same render on every device. The design rules are built into the tool. They bend, not break |
| The same badge, card or banner re-made a hundred times by hand, then "which version is the latest?" hunted through chats and drives | Paste a spreadsheet and get a hundred finished, print-ready files at once ([Using Lolly](/info/using.html)). The file is a link: same inputs, same file, every time ([Reproducibility](/info/reproducibility.html)) |
| Pay the AI again for something it already made, and your work becomes training data or an ad profile by default | If AI helps make something once, the result is yours and re-making it is free ([Our AI Stance](/info/ai-stance.html)). Nothing is collected, so nothing can be repurposed, and AI declares itself |
| A policy you have to believe, rewritable at any time without telling you, while the rules about your work change and you find out later | An architecture you can check, a signed credential inside every export whose format can carry one, and the freedom to leave with everything at any time |

## Trust what you can verify

A promise is something a company can change on a Tuesday. An architecture is something you can check. Each row above rests on one:

- <!--i:cpu--> **The work happens on your device.** Rendering, exporting, converting and stripping metadata all run on your machine, so your content cannot be collected, sold or trained on by us: it never arrives. See [Privacy](/info/privacy.html) and [Server Surface](/info/server-surface.html).
- <!--i:download--> **Exports are ordinary files.** PNG, SVG, PDF and the rest open in software that has nothing to do with us, keep working if this project disappears and sit behind no export tier. See [Exporting & Formats](/info/exporting.html) and [Data Transfer](/info/data-transfer.html).
- <!--i:seal--> **Provenance travels with the work.** What you make carries [Content Credentials](/info/content-credentials-identity.html) by default, in every format that can hold one, and anyone can check them. Try it on something you made: [Verify It Yourself](/info/verify-yourself.html).
- <!--i:globe--> **There is no consent wall.** No trackers, no analytics, no ad profile and no account needed to use the tools. Lolly asks only before a network action you start, such as fetching a font or a model. [Security & Verification](/info/security.html) covers how to confirm that.
- <!--i:people--> **Accessibility ships now.** Motion, contrast, text size and preview intensity are settings in the product, not accommodations you request. See [Inclusive Design](/info/inclusive-design.html).

## What this is not

It is not a claim that everyone doing it the other way acts in bad faith. Server-side software is a legitimate way to build things, and plenty of it is made carefully by people who would rather not be collecting what they collect.

It is not a claim that Lolly does everything those tools do. It does a narrower set of things without the trade.

And it is not a request for your trust. Trust is the thing we are trying to make unnecessary. Everything above can be checked, the code is public and the [Threat Model](/info/threat-model.html) is honest about the limits.
