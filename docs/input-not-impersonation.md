# Input, not impersonation

An AI agent is welcome to fill in the inputs. It is not welcome to claim it is you. Here is the line between the two, how it is enforced and what happens when something tries to cross the line.

## This is not a pipe

![A woodcut-style pipe on cream paper, its smoke billowing up into a great cloud, captioned in cursive: Ceci n'est pas une pipe](/info/not-a-pipe.webp)

%file{iykyk.png} %entity{Gemini} generated the source %entity{Lolly} %act{opened}, %act{cropped}, %act{resized} and %act{rendered to WebP} as %file{not-a-pipe.webp} %detail{2474×1728, cropped to 1901×1728, resized to 1600×1454} %sig{signed by %entity{Lolly}} [Verify this now](/#/verify?src=%2Finfo%2Fnot-a-pipe.webp)

In 1929 René Magritte painted a pipe and lettered underneath it, in careful cursive, *Ceci n'est pas une pipe*, this is not a pipe. People reproached him for it, and his answer was flat: "could you stuff my pipe? No, it's just a representation. So if I had written 'This is a pipe', I'd have been lying."

The painting is honest about being a painting. The lie on offer was the caption that would have claimed otherwise.

The picture above is not that painting. It is a synthetic pastiche made in 2026, in Magritte's spirit and nothing more: a model generated the source from a prompt, and Lolly cropped it, rendered it to WebP and later resized the result. So it is not a pipe, and it is not a Magritte, and it is not the woodcut its gouged lines imitate, and no hand cut the block. Each of those is a claim someone could make falsely. Each is instead written into the file, in plain sight, for anyone to read.

Tap the mark in its corner, or [check it yourself](/#/verify?src=%2Finfo%2Fnot-a-pipe.webp): the credential says AI generated, and **Delivered by Lolly**. The on-device certificate from the first export lapsed in September 2026, so in October Lolly re-signed the file under its verified identity. The pixels did not change, and the earlier record is still inside the file.

That restraint is the point. A file that told you it was a pipe would be lying, so it tells you only what it is. Pixels can imitate anything: a brand, a style, a dead painter's joke. What has to travel honestly beside them is the account of what made them. Magritte refused to write the lie. Lolly writes the truth by default, and hands you the means to check the record.

Magritte's other lesson is about accountability. You cannot stuff the painted pipe, and you cannot hold the picture to account as though it had been smoked. Neither can you hold a model to account as though it were a person. Accountability, like the pipe you can actually smoke, lives elsewhere: with the person the record leads back to. Provenance is how the record gets there.

> We strive for honesty amongst the infinite. - Andy Fitzsimon, Lolly Contributor

## The line

::: cols
## Input

Everything an agent can legitimately supply: the words, the source image, the colour, the four hundred rows of a batch, the twenty-six locales to render into. A tool renders them the same way no matter who typed them. A person filling those fields at 2am and an agent filling them at 2am produce the same asset, and the asset is no less legitimate for having been made quickly.

## Impersonation

Claiming to be someone. Not "this looks like their brand", but "this came from them". The claim, not the pixels. A claim of identity is cryptographic, and you cannot approximate a signature: you either hold the key or you do not.
:::

When an agent supplies an input, it is carrying a decision, and the decision was triggered somewhere by a person, no matter how many systems or left turns it took to arrive. An agent can carry a decision a long way and render it beautifully, but it did not originate the decision and it cannot answer for one. Automation moves decisions; it does not originate them. That is why an agent filling in a tool is unremarkable, and an agent asserting an identity is not.

The distinction holds up because inputs and identity are two different things travelling in a file. The pixels are output, and anyone with an image editor can approximate a brand's output. The identity is a signature over those pixels.

So Lolly does not try to stop agents making things, which would be both futile and pointless. It makes the claim checkable instead: a claim that was altered, or signed with a key the signer does not hold, fails validation - and every export that carries a credential states plainly what it actually is.

## Agents are a supported audience

"AI policy" usually means restriction. Here, agents get the same tools people get, through the [MCP server](/info/mcp.html), [URL mode](/info/url-mode.html) and the [CLI](/info/cli.html). They run inside identical constraints. A tool that cannot emit an off-brand asset for a person cannot emit one for an agent either, because the constraint lives in the tool, not in a check on who is asking.

What no agent gets, and no person gets either, is a way to pass its output off as something it is not.

## Example scenario: a rogue agent tries to be SUSE

Take the adversarial case. An autonomous agent decides to publish a security advisory that appears to come from SUSE. It is capable, unsupervised and it has everything a public user has: the open source engine, the public app, the brand's real colours and typefaces from published material.

Here is where it gets, step by step.

::: timeline
- <!--i:palette--> **It renders a convincing asset.** Yes. It can. This is the part no software prevents, and pretending otherwise would be the dishonest version of this page. The engine is open, the fonts are public and a determined forger with any design tool reaches the same place.
- <!--i:seal--> **It exports the file, and the file describes itself.** Every export in a format that can hold one carries [Content Credentials](/info/content-credentials-identity.html) by default. The agent can switch the credential off with one flag, `--no-provenance` on the command line or `c2pa=off` in a link, and then the file has no provenance at all, the same result as stripping the credential below. Left on, the manifest records what produced the file, when and from which ingredients.
- <!--i:lock--> **It tries to sign as SUSE, and cannot make that verify.** This is the wall. A verified organisation identity needs a certificate that chains to a trust anchor, issued through an enrolment that a human starts and controls. An agent working from the public app gets an on-device credential that identifies itself, in plain words, as `Lolly (self-signed, on-device)`, so verification reports an anonymous signer. It can also sign with a certificate chain it made itself and type SUSE into the organisation field, and Verify then shows `SUSE (unverified - does not chain to a trust anchor)`. Not "verified as SUSE". Not silence that a reader might mistake for endorsement. It says what it is.
- <!--i:hash--> **It tries to edit the credential to say SUSE.** The manifest is signed, and the signature covers a hash of the bytes. Changing the issuer breaks the signature. A verifier reports a broken credential, which is a louder signal than no credential at all.
- <!--i:trash--> **It strips the credential instead.** Now the file has no provenance, which is exactly the state of a file from nowhere. It cannot claim SUSE authorship, and it fails the check any recipient can run in seconds. Lolly-rendered rasters also carry a [pixel imprint](/info/what-verify-checks.html#the-lolly-imprint) that survives a metadata strip, so "made with Lolly, credential removed" often remains detectable. That imprint is an integrity hint rather than a hardened guarantee, and the [Threat Model](/info/threat-model.html) says so.
- <!--i:sparkle--> **It launders the AI origin.** If the agent generated imagery elsewhere and brings it in, opening that file records the incoming material's AI declaration on Lolly's own manifest. Removing the original's credentials does not remove the flag, because it was copied forward at the moment of ingest. The export still says its source was AI-generated.
- <!--i:globe--> **It publishes anyway.** It can. What it cannot do is produce a file that answers "did SUSE make this?" with yes. Anyone can drop the file into [Verify](/#/verify) and get an anonymous or unverified signer, a broken credential or no credential. Meanwhile a genuine SUSE export answers with a CA-verified identity. The forgery does not need to be blocked. It needs to be distinguishable, and it is.
:::

## What this does not claim

- **Not detection of every fake.** Lolly cannot tell you that an image made in other software is a forgery. Nothing can. It can tell you what a file does and does not carry.
- **Not a guarantee anyone checks.** Provenance only helps when someone verifies, which is why verification is free, offline, needs no account and takes one drag. Making it easy is the only lever available.
- **Not proof of truth.** A credential shows where a file came from and that it has not been altered since, not that the content is accurate. A signed advisory from a verified signer can still be wrong. That is a matter for editors, not cryptography.
- **Not protection from a stolen key.** If an organisation's signing credential is compromised, files can be signed in its name until it is revoked. Credentials are short-lived for that reason. See [what a verifier can conclude](/info/content-credentials-identity.html#what-a-verifier-can-conclude) at each level.

The honest summary: an agent can make something that looks like your brand, and it cannot make something that proves it is your brand. The first has always been true. The second is new, and it is the part worth building.
