# Trust

Most software asks you to trust it. This section is the opposite: every claim Lolly makes about your content, your data and its own behaviour is written down here with the mechanism that enforces it, so you can check rather than believe.

> **The internet is optional with Lolly: use it when it helps, never surrender control.** A font you pick, a place you look up, a link you share - things happen online only because you asked. Nothing you make leaves your device unless you send it or turn on a feature that does, such as Sync. The app asks before it downloads an on-device AI model, and the brand editor asks before it fetches a font from Google. Nobody is listening in. Go offline and everything you have works. **Freedom is sweet.**
>
> The receipts: the [Privacy Policy](/info/privacy.html) lists every request the app can ever make, and [Verify It Yourself](/info/verify-yourself.html) shows you how to check each one.


## Where did this content come from?

The media Lolly renders carries [Content Credentials](/info/content-credentials-identity.html) by default - a signed record of what made it, from what and when. When a file arrives with a history already attached, Lolly preserves it rather than flattening it, so the chain stays intact through an edit.

- <!--i:seal--> [**Content Credentials**](/info/content-credentials-identity.html) - what gets signed, what the signature proves and who the signer is.
- <!--i:cpu--> [**Content Credentials - Engineering**](/info/content-credentials-engineering.html) - the C2PA implementation itself: manifests, ingredients, action histories, formats.
- <!--i:sunburst--> [**Our AI Stance**](/info/ai-stance.html) - where AI is welcome, where it is not and why AI-generated content declares itself.
- <!--i:sparkle--> [**Generated once, rendered the same**](/info/ai-features.html) - which AI operations are marked as generated, which are plain edits, and why.
- <!--i:document--> [**AI marking and the EU AI Act**](/info/eu-ai-act.html) - how these marks relate to Article 50, and what they do not establish.
- <!--i:shield--> [**Input, not impersonation**](/info/input-not-impersonation.html) - an AI agent may fill in the inputs, and may not claim to be you.
- <!--i:usercheck--> [**Creative rights and credits**](/info/creative-rights.html) - how a source's licence is recorded and how its credit travels with your file.

## Can I check that for myself?

You can, and you should - the point of provenance is that it does not need our word.

- <!--i:checklist--> [**Verify It Yourself**](/info/verify-yourself.html) - walk the claims on this site against a real export, step by step.
- <!--i:search--> [**AI evidence in Verify**](/info/verify-ai-evidence.html) - the clues Verify finds in text and layout, offered as evidence rather than a verdict.
- <!--i:shieldcheck--> [**Security & Verification**](/info/security.html) - how the code is built, signed and checked.
- <!--i:lock--> [**Threat Model**](/info/threat-model.html) - what Lolly defends against, and what it explicitly does not.
- <!--i:code--> [**Parser Inventory**](/info/parser-inventory.html) - every format Lolly parses, because parsers are where untrusted input meets your device.
- <!--i:server--> [**Server Surface**](/info/server-surface.html) - the complete list of what a server ever sees.

## What happens to my data?

Lolly renders on your device. That is not a privacy posture bolted on afterwards - it is the architecture, and it is why most of the usual questions have short answers.

- <!--i:eyeoff--> [**Privacy Policy**](/info/privacy.html) - what is collected, what is not and what leaves your device.
- <!--i:convert--> [**Data Transfer**](/info/data-transfer.html) - moving your work in and out, with nothing held hostage.
- <!--i:people--> [**Inclusive Design**](/info/inclusive-design.html) - who the software is built to work for.

## Where we stand

- <!--i:clock--> [**The trade we never agreed to**](/info/status-quo.html) - the frictions we learned to accept, and what replaces them.
- <!--i:star--> [**Tenets**](/info/tenets.html) - our vision, values and mission.
- <!--i:pentool--> [**Beatrice Warde**](/info/beatrice-warde.html) - the typographer whose 1932 lines we adapted as our motto.
- <!--i:layers--> [**Shoulders of giants**](/info/shoulders-of-giants.html) - the open source projects and people Lolly is built from.

## The refusal

Nothing to sell you, nothing to take. Four commitments, stated once and checkable:

- <!--i:check--> **Free, and it stays free.** A version that has been released is licensed so it can never be taken back. The free Lolly always exists, whatever happens next - the exact mechanism is on [How Lolly compares](/info/positioning.html).
- <!--i:code--> **Open source.** Read it, run it, fork it, keep it. Nothing on this page needs to be believed: the code is public and the claims are checkable.
- <!--i:eyeoff--> **Blind by design.** The Lolly app sends no analytics, usage reports or crash reports, so nobody, the makers included, can see what you make or how you use the app - see the [Privacy Policy](/info/privacy.html). A tool that cannot see you has nothing to sell about you. A Lolly Work server, which an organisation runs for its members, is different. When your app is connected to one, the server keeps an audit log of sign-ins and other governed actions such as approvals. It records which app versions connect to it and, while you are signed in, from which devices. It can also store usage events made of labels such as a tool id, never your inputs, at a level the organisation sets. See [Telemetry and dashboards](/info/work-telemetry.html).
- <!--i:checklist--> **Your vote, visible.** Your work never goes where you have no say. Anything that touches the internet happens because you chose it, at the moment you chose it, and the code that keeps that promise is open.

## Why this is free

**We built Lolly for ourselves.** SUSE needed thousands of on-brand files, made without handing anything to outside services. So we built a tool that does all of it on the device, and released it as open source. We keep maintaining it because we use it every day. **There is no obligation:** everything here works with or without us.

---

If you find a place where these pages and the code disagree, the code is the bug - and the [repository is public](https://github.com/lolly-tools/lolly) so you can prove it either way.
