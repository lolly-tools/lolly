# Trust

Most software asks for your trust. This section does the opposite: every claim Lolly makes about your content, your data and its own behaviour is written down here with the mechanism that enforces it, so you can check rather than believe.

> **The internet is optional with Lolly: use it when it helps, never surrender control.** A font you pick, a place you look up, a link you share: things happen online only because you asked. Nothing you make leaves your device unless you send it or turn on a feature that does, such as Sync. The app asks before it downloads an on-device AI model, and Design System Setup asks before it fetches a font from Google. Nobody is listening in. Go offline and everything you have keeps working. **Freedom is sweet.**
>
> The receipts: the [Privacy Policy](/info/privacy.html) lists every request the app can make, and [Verify It Yourself](/info/verify-yourself.html) shows you how to check each one.

## Where did this content come from?

The media Lolly renders carries [Content Credentials](/info/content-credentials-identity.html) by default. When a file arrives with a history already attached, Lolly keeps it rather than flattening it, so the chain survives an edit. Drop any file on [Verify](/#/verify) and the record comes back, worked out on your device:

![The full Verify verdict for a generated storm image - the image itself, a green Made with Lolly pill, the intact-credential and unchanged-bytes badges and the provenance scorecard](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1240&height=940&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-masthead)

- <!--i:seal--> [**Content Credentials**](/info/content-credentials-identity.html): what gets signed, what each verdict means and how to put your name on your files.
- <!--i:check--> [**What Verify checks**](/info/what-verify-checks.html): the Imprint, AI declarations, watermarks, SEAL signatures and hidden data, beyond the credential.
- <!--i:sparkle--> [**AI evidence in Verify**](/info/verify-ai-evidence.html): located clues that text or a layout may be machine-written, as evidence rather than a verdict.
- <!--i:people--> [**Creative rights and credits**](/info/creative-rights.html): how a source's licence is recorded, what it asks of your use and how the credit travels in the file.
- <!--i:cpu--> [**Content Credentials engineering**](/info/content-credentials-engineering.html): the signing architecture, the engine contracts and the CA service.

## Can I check that for myself?

You can, and you should: the point of provenance is that it does not need our word.

- <!--i:checklist--> [**Verify It Yourself**](/info/verify-yourself.html): walk the claims on this site against a real export, step by step.
- <!--i:shieldcheck--> [**Security & Verification**](/info/security.html): the standards, the cryptography and how all of it is tested.
- <!--i:lock--> [**Threat Model**](/info/threat-model.html): what Lolly defends against, and what it does not.
- <!--i:code--> [**Parser Inventory**](/info/parser-inventory.html): every format Lolly parses, because parsers are where untrusted input meets your device.
- <!--i:server--> [**Server Surface**](/info/server-surface.html): everything a server can see.

## What happens to my data?

Lolly renders on your device. That is not a privacy setting added afterwards: it is the architecture, and it is why most of the usual questions have short answers.

- <!--i:eyeoff--> [**Privacy Policy**](/info/privacy.html): what is collected, what is not and what leaves your device.
- <!--i:convert--> [**Data Transfer**](/info/data-transfer.html): moving your work in and out, with nothing held hostage.

## Where we stand

- <!--i:convert--> [**The trade we never agreed to**](/info/status-quo.html): the frictions we learned to accept, and what replaces them.
- <!--i:sunburst--> [**Our AI Stance**](/info/ai-stance.html): AI welcome as labour, refused as impersonation and declared wherever it made something.
- <!--i:usercheck--> [**Input, not impersonation**](/info/input-not-impersonation.html): what an AI agent can supply, and what it can never claim.
- <!--i:sparkle--> [**Generated once, rendered the same**](/info/ai-features.html): Lolly's own AI features, and why inventing pixels is marked while removing them is not.
- <!--i:document--> [**AI marking and the EU AI Act**](/info/eu-ai-act.html): how Lolly preserves, declares and verifies AI marks for an Article 50 review.
- <!--i:people--> [**Inclusive Design**](/info/inclusive-design.html): who the software is built to work for, and the tests that hold it there.
- <!--i:star--> [**Tenets**](/info/tenets.html), [**Beatrice Warde**](/info/beatrice-warde.html) and [**Shoulders of giants**](/info/shoulders-of-giants.html): what we believe, the typographer whose words we adapted and everyone Lolly is built from.

## The refusal, and why it is free

Nothing to sell you, nothing to take. Four commitments, stated once and checkable:

- <!--i:check--> **Free, and it stays free.** A version that has been released is licensed so it can never be taken back. The free Lolly always exists, whatever happens next; the exact mechanism is on [How Lolly compares](/info/positioning.html).
- <!--i:code--> **Open source.** Read it, run it, fork it, keep a copy. The code is public, so every claim here can be checked.
- <!--i:eyeoff--> **Blind by design.** The Lolly app sends no analytics, usage reports or crash reports, so nobody, the makers included, can see what you make or how you use the app; see the [Privacy Policy](/info/privacy.html). A tool that cannot see you has nothing to sell about you.
- <!--i:checklist--> **Your vote, visible.** Anything that touches the internet happens because you chose it, at the moment you chose it, and the code that keeps that promise is open.

A Lolly Work server, which an organisation runs for its members, is different. When your app is connected to one, the server keeps an audit log of sign-ins and other governed actions such as approvals. It records which app versions connect to it and, while you are signed in, from which devices. It can also store usage events made of labels such as a tool id, never your inputs, at a level the organisation sets. See [Telemetry and dashboards](/info/work-telemetry.html).

**We built Lolly for ourselves.** SUSE needed thousands of on-brand files, made without handing anything to outside services. So we built a tool that does all of it on the device, and released it as open source, like everything else we make. We keep maintaining it because we use it every day. **There is no obligation:** everything here works with or without us.

---

If you find a place where these pages and the code disagree, the code is the bug, and the [repository is public](https://github.com/lolly-tools/lolly) so you can prove it either way.
