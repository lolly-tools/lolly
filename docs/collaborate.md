# Working on something together

Two people, two devices, one tool session, edited live. No account, no sign-in, no server in the middle and no internet needed if both devices are on the same network. This page is the whole feature: how to start one, the three ways to hand the invite over, the reply leg that trips most pairs up, the six characters that tell you the connection is private, what you see while you work, how to send files and sessions down the same link and what to do when a network refuses to let two devices talk.

> This is the individual path. It pairs exactly two devices, directly, and it is yours to start whenever you want one. Nothing about it asks permission from anything.

## What a private collab is

A **private collab** is a live editing link between two devices. One person invites, the other joins and from that moment both are typing into the same tool session: change a field on one device and it appears on the other. The link is made by the two browsers talking to each other directly. Your work does not travel through a service on the way, because there is no service - the invite and the reply are the whole of the setup, and you are the one who carries them across.

Two things follow from that, and it helps to have them straight before you invite anyone.

- **The person who invites owns the session.** The saved session lives on the inviting device. The joining device gets a working copy that is deliberately never written into its own Projects. That copy is real, editable and exportable on the joining device, but it is not filed there and it does not survive the collab.
- **Anyone holding the invite can join and edit.** The invite is the key. Send it through a channel you would send the work itself through, and treat a re-sent invite as a re-shared document.

The feature is on by default. It carries a **beta** pill in the profile settings, which is where you can also turn it off. Turning it off means an invite link opened on that device offers to turn it back on rather than dead-ending.

![The Feature flags section of the profile, with Private collab and its beta pill at the end of the list](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2400&cropSelector=%23feature-flags-section&walker=1&format=svg&dark=1&filename=collab-flag-setting)

<!--
SHOT NOTE (collab-flag-setting): geometry copied from the PROVEN recipe for the same
element (docs/adoption-governance.md's `aud-feature-switches`, 1440x1800). Do not shrink
it: `PRIVATE_COLLAB_FLAG` is the LAST row `flagRow()` writes into #feature-flags-section
(views/profile.ts), and a walker crop is windowed to min(element box, recipe frame), so a
900px frame culls the very row this shot is for.
The flag's `info` sentence is NOT inline copy - it is a help-tip popover (`.help-tip-pop`,
`hidden` until hover/tap) behind the (i) button on the row, which is why the alt text
above claims only the label, the beta pill and the switch. If the capture pass wants the
explanation visible, drive the (i) open (`click:` the row's `.help-tip-btn`) and say so
in the alt text; never drive the switch itself, which would turn the feature off.
ALSO: `aud-feature-switches` already publishes this element. Consider pointing this
section at that baseline instead of minting a second near-identical shot.
-->

**What both devices need.** The same tool, present locally on each. A collab sends values, never code, so the template and the logic always come from the catalogue on each device. If the joining device does not have the tool, the join is refused at the moment the invite is read, by name, rather than opening something that renders nothing.

## Start a collab

Open the tool and get the session to the state you want to share. Then:

1. Press **Share** in the export controls, the same button that copies a share link.
2. Scroll to **Private collab** and press **Start a collab**.
3. Give yourself a name for this collab and press **Create the invite**.

![The Share dialog's Private collab section - one line saying what it does, then Start a collab and Join with a code](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1100&height=900&dpi=192&waitMs=2600&drive=click%3A%23render-fab%3Bclick%3A%5Bdata-action%3D%22copy-url%22%5D&cropSelector=.share-private-collab&walker=1&format=svg&dark=1&filename=collab-share-section)

<!--
SHOT NOTE (collab-share-section): TWO clicks, not one, and the first is the fix for a
failure this recipe shipped with. `[data-action="copy-url"]` (the Share button, wired to
showShareDialog in views/tool.ts) does not live in the sidebar - it lives in the EXPORT
PANEL, which is a `position: fixed` host holding a child pushed off the bottom by
`transform: translateY(100%)` until `.tool-layout.export-open`. Measured at 1100x900:
the button sits at y=1517 in a 900px viewport that does not scroll, so Playwright
correctly refused it as "outside of the viewport" through every actionability retry.
`click:#render-fab` opens the panel first, which is also what the prose above tells the
reader to do ("Press Share in the export controls").
Width is NOT the cause and 1440 behaves identically - there is no mobile-layout switch
at 1100 here, and the vector path builds its context at the recipe's CSS width with no
dpi halving (dpi is raster-only). Do not "fix" this class by widening the frame.
The section renders whenever the `private-collab` flag resolves ON, which a fresh
capture context does by default (feature-flags.ts, `default: true`), and
`.share-private-collab` measured comfortably inside the frame - the internal-scroll risk
this note used to warn about did not materialise.
-->


The name is chosen here, per collab, and it is the only thing about you that crosses the link. It is not read from your profile, and nothing else from your profile goes anywhere. Leave it empty and you appear as **Host** to the other person, or **Invitee** if you are the one joining.

![Step 1 of 3 - naming yourself for this collab, with the note that the other person sees this name while you work together](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1100&height=900&dpi=192&waitMs=3000&drive=click%3A%23render-fab%3Bclick%3A%5Bdata-action%3D%22copy-url%22%5D%3Bclick%3A%5Bdata-act%3D%22start-private-collab%22%5D&cropSelector=.collab-ceremony&walker=1&format=svg&dark=1&filename=collab-invite-name)

The whole ceremony is numbered **1 of 3**, **2 of 3**, **3 of 3** on every screen, on both sides. That is deliberate: the hand-over has two legs, both people are looking at different screens and the numbers are how you tell each other where you are.

## Handing over the invite

Once the invite is minted you get the same invite in three forms at once. They are the same thing wearing different clothes, so pick whichever suits the two of you and wherever you happen to be.

<!--
SHOT DROPPED (collab-invite-minted). It captured cleanly on 2026-08-10 and was then
withdrawn, because what it captures cannot be published:

1. THE LINK IS THE CAPTURE SERVER'S. The screen shows the invite as a real URL, and
   the base is whatever origin the capture ran against, so the committed baseline read
   `http://127.0.0.1:50133/#/join?inv=...`. `linkBase` is a ceremony option with no
   URL seam (components/collab-ceremony.ts, defaultLinkBase), so no recipe can pin it,
   and a reader shown a localhost link is being shown the wrong thing.
2. IT CAN NEVER COMPARE EQUAL. All three forms are functions of one freshly minted,
   single-use payload: a DTLS fingerprint and an ICE ufrag that are new every run. A
   vector baseline compares EXACTLY, so this recipe would report ▲ CHANGED on every
   run for the rest of its life, and `tolerance=` is inert on a vector.
3. THE ALT TEXT PROMISED A QR THAT IS NOT THERE. `qrSlot` returns null unless the
   caller passes `renderQr` (collab-ceremony.ts ~1221); on this path it does not, so
   the screen is link + code, not link + code + QR.

A drill capture does not rescue it: the drill's own base is a dev server, so leg 1
stands. Freezing the payload with `css=` would be staging a fake. The three forms are
described in the prose below instead, which is the honest version of what a one-time
secret looks like. Re-open only if the ceremony grows a way to render a specimen
invite against a real origin.
-->

### A link

The invite as a `#/join?inv=...` URL. Send it through any channel the two of you already use. The other person clicks it, their device opens Lolly at the join screen with the invite already read and they go straight to naming themselves. Nothing to paste.

**When it fits:** you have any messaging channel at all between the two devices, and the joining device can reach the same address you are using.

### A QR code

The invite as a QR on screen. The other device points its camera at it and scans.

**When it fits:** the two devices are in the same room and there is no channel between them at all. It is also the leg that works when one device is a phone and the other is a laptop across a desk.

Two things to know. The reply comes back the same way, so this is genuinely two scans and not one: your device shows the invite, theirs scans it, then theirs shows the reply and yours scans that. Numbering the steps 1-2-3 is what stops that going wrong. And scanning is only offered where the browser can actually decode a QR, which today means Chromium-family browsers. Where it cannot, there is no **Scan a code** button at all rather than a button that opens a camera and never finds anything - the code beside the QR is the same payload, so pasting is always available.

### A code

The invite as a block of text. Copy it, send it however you like and the other person opens `#/join` on their device with nothing in the URL and pastes it into the field there. The Share dialog has a **Join with a code** button that opens exactly that screen, so both entrances are one place.

**When it fits:** the invite came through a channel that mangles links, or the other person is typing an address in by hand, or you are reading it out.

![The bare join screen - one field, one button and the note that a code or a link both work here](/t/url-shot?url=%2F%23%2Fjoin&width=1100&height=760&dpi=192&waitMs=2400&cropSelector=%5Bdata-collab-join%5D&walker=1&format=svg&dark=1&filename=collab-join-code-door)

> **The invite does not last forever.** While you are waiting, the screen counts down how long the current invite still works. After ten minutes a fresh one is minted automatically and the screen says so, so send the new one rather than the one you already sent. That happens twice; after that the wait gives up and tells you nothing came back in time. **Make a new invite** sits on the waiting screen throughout, if you want to start the clock again yourself.

## Sending the reply back

This is the leg pairs give up on, so it is worth being explicit: **an invite on its own does not connect anything.** The joining device makes a reply, and that reply has to get back to the waiting device before either of you is connected. Same three forms, same choice.

<!--
SHOT DROPPED (collab-answer-minted): the same call as collab-invite-minted above, and
for the same first reason. It WAS captured: the drill reaches the reply screen, and the
walker serialises it cleanly (126 KB of vector). What it serialises is the problem.
The reply link carries the origin the capture ran against, so the file read
`http://localhost:5213/#/join-reply?ans=...`, and the code and the QR beside it are two
further renderings of the same single-use payload.

So the rule both drops share, stated once: LOLLY'S DOCS DO NOT PHOTOGRAPH A ONE-TIME
SECRET. There is no framing of these two screens that is both honest and publishable:
the token IS the screen, and the only "fix" available is to invent a token and an origin,
which would make the picture a drawing of the product rather than a picture of it. The
three forms are described in the prose instead.

Everything downstream of the handover still has its picture, because none of those
screens carries a secret: the plate, the pill and roster, the focus ring and the beam
consent card are all captured by the drill below.
-->

- **As a link.** The reply is a `#/join-reply?ans=...` URL. Opening it on the same device that made the invite hands the reply straight to the window that is waiting, and that window moves on by itself. The tab that did the handing says so and can be closed. If no window on that device is waiting, it says that too and leaves the code on screen to copy.
- **As a code.** Paste it into the **Paste the reply here** field on the waiting screen and press **Connect**.
- **As a QR.** The waiting screen has its own **Scan a code** button, so the reply can be scanned back exactly like the invite was scanned across.

**Testing it with two tabs on one device works.** If you open your own invite in another tab, the join screen notices and says so in one dismissible line. It is information and never a refusal - the pairing is real, it just happens to be between two windows of one browser.

If the reply arrives in a window that was not expecting it, nothing silently goes wrong: a reply pasted into the invite door is named as a reply and you are told which window it belongs in, and a device with more than one invite waiting says so and leaves the code for you to paste into the right one rather than guessing.

## The matching plates

The moment the two devices connect, both screens show the same six characters, grouped as three and three. Under them, one sentence:

> Both screens show the same plate when the connection is private.

Read the plate out loud and check it against the other screen. If they match, the two devices are talking to each other and to nobody in between.

![The Connected screen with the six-character plate across it, and the line saying both screens show the same plate when the connection is private](/info/shots/collab-plate.svg)

<!--
DRILL-ASSISTED SHOT (collab-plate) - captured, not recipe-driven. The plate only exists
once a real pairing is live and is derived from the two DTLS fingerprints the handshake
validated (shells/web/src/collab/plate.ts), so no URL can reach this state. Written by
tests/collab-private.browser.test.ts under LOLLY_BROWSER_DRILLS=1 LOLLY_DRILL_DOCS=1, at
the connected step, through the shell's own walker.
ONE SCREEN, NOT TWO, and that is a finding rather than a shortcut. The side-by-side this
note used to ask for cannot be taken: the ACCEPTOR's Connected screen is torn down by its
own live mount inside the task that painted it (the drill reads its plate from a mutation
record for exactly this reason), so there is no instant when both screens are live to
photograph. The drill tries the pair first and falls back to the inviter alone; if the
handoff ever pauses on the Connected screen, the pair completes automatically.
Worth Andy's eye separately: if the acceptor's screen really does not survive a frame,
then on that side no human ever sees the plate to compare - which is the one security
property of this feature that needs a person.
-->

Here is what the check is actually doing, because it is the one security property of this feature that needs a person rather than code. The invite carries a fingerprint of the inviting device, and the reply carries one back. The plate is derived from **both** fingerprints together, ordered so that each device computes the same answer without either of them having to be told who is who. Anyone who wanted to sit in the middle would have to terminate the connection on both sides with certificates of their own, which is two fingerprints neither of your devices ever saw, and there is no substitution they can make in the invite or the reply that produces two matching plates on your two screens.

This is the same idea as the short authentication string in ZRTP (RFC 6189 section 7): the humans are the part of the channel that cannot be forged. It is not a formality. Comparing the plates is what turns "the invite reached them" into "the invite reached them and nothing changed it on the way".

A few details that follow from how it is built:

- **The alphabet has no ambiguous characters.** No 0 or O, no 1 or I or L, no B against 8. The plate exists to be compared out loud, and "oh" against "zero" is exactly the confusion the comparison must not absorb.
- **A screen reader says it character by character**, spaced, with a pause at the group break. Read as a word it would sound like a match when it is not.
- **A new pairing has a new plate.** If the connection drops and you pair again, compare again. The old plate belongs to a connection that no longer exists.

## Editing together

Once you are connected, the tool opens on both devices with the session in it and you both just work.

**What you see.** A **collab pill** sits over the canvas: the people in the collab as a stack of initials, and a dot for the state of the link - Connecting, Live, Reconnecting, Away, Disconnected. Open it for the roster, which names everyone and tags who is you, who is away and who is observing.

![The collab pill: a status dot and two stacked initials over the canvas](/info/shots/collab-pill.svg)

![The roster open under the pill - Ada tagged You and Host, and Grace below her](/info/shots/collab-pill-roster.svg)

<!--
DRILL-ASSISTED SHOTS (collab-pill, collab-pill-roster) - two live participants, so no
recipe can reach them. Milestone `15-A-pill` in tests/collab-private.browser.test.ts,
which waits for `.collab-pill .collab-av` to reach 2 first.
The roster is opened with an IN-PAGE `stack.click()`, not a Playwright click: the pill is
a fixed floating control over the canvas and Playwright refuses the real press as
"outside of the viewport" - the same class of refusal the docs pipeline now has a
documented fallback for (DriveOpts.clickFallback in packages/node-shell/src/url-capture.ts).
-->

**Where the other person is working** shows as a coloured ring on the control they are in, with their name on a chip beside it, and as a matching outline on the part of the render that control draws. Colour is never the only signal - the ring is always paired with the name, the canvas outline carries a hairline that reads as a shape rather than a hue and every handover is spoken through the live region for screen readers.

![The whole editing window on one device while the other person works: the Quiet zone row in the sidebar carries a coloured ring and a name chip reading Grace](/info/shots/collab-focus-ring.svg)

<!--
DRILL-ASSISTED SHOT (collab-focus-ring). Milestone `17-A-focus-ring` in
tests/collab-private.browser.test.ts: B focuses a control, A paints
`.input-row.is-remote-focus` in the sidebar and `.collab-focus-box` over the canvas.
Framed on `.tool-layout` rather than either half, per this note's original instruction -
the pairing of sidebar row and canvas outline is the point, so the frame has to be able
to hold both. In the captured run the peer's control was Quiet zone, which has no
distinct canvas region of its own, so only the sidebar half is painted; the canvas
outline appears in this same frame whenever the peer is in a control that draws one.
-->

**What you do not see is a floating mouse pointer.** That is a decision rather than a gap: the canvas here is a rendered preview and not a freeform surface, so "Priya is editing the Headline" is both truer and cheaper than an arrow drifting over a picture. Nothing about presence is written into the render - the rings and outlines are painted on a layer above it - so someone else working alongside you cannot change a single byte of what you export.

**Undo stays yours.** Your undo history is a record of your own edits and nothing else. A change arriving from the other device never goes onto your undo stack, so you can never undo something you did not do. When you do undo, the value goes back the way you meant and that change travels to the other device like any other edit.

**Two people in the same field.** The last write wins, per field. There is no locking and no queue, and both of you will see the same final value. Two people typing into the same text field at the same moment is the one case that behaves poorly, for the same reason it does in every design tool: you get one of the two versions, not a merge of both. In practice this is what the focus rings are for - you can see where the other person is.

**If the connection wobbles**, the dot says Reconnecting and nothing is torn down. A brief drop heals on its own. A real drop needs a fresh invite, because a private collab has no server to resume from: the state lives on the two devices and nowhere else.

**If the two devices are running different versions**, you are told rather than left to wonder. A minor difference in the tool says some fields may not match. A larger difference in the collab format puts the older device into **Observing**: it keeps seeing everything, and its own edits are not sent.

## Sending files and sessions

The same link that carries your edits will also carry things that are too big to be edits. This is a **beam**, and it works like handing someone a file across the table.

Press **Send this session** on the collab pill. The other device gets a card naming what is being offered, how many items it contains and how large it is, with **Accept** and **Decline**. Nothing moves until they accept. Both of you watch the same progress card, and either of you can cancel.

![Both devices at the same moment: on the left the sender waiting to be let in, on the right the card naming what is offered, who it is from and Decline beside Accept](/info/shots/collab-beam-consent.svg)

<!--
DRILL-ASSISTED SHOT (collab-beam-consent). The consent card
(shells/web/src/components/beam-toast.ts) paints only from an `offer-received` event, so
it needs a live pair with both tools mounted. The drill had no beam milestone; it has one
now - "BEAM: Send this session raises a consent card on the other device, and Decline ends
it" in tests/collab-private.browser.test.ts. Deliberately the SMALLEST step that produces
the card: offer, card, DECLINE. Nothing transfers, nothing is written to either library,
and the pair is left exactly as the hygiene drills below expect to find it.
It is the two-screen shot this note asked for: sender's "waiting" card on the left,
receiver's consent card on the right, both walked live and placed side by side (no
re-render, nothing drawn that neither screen showed). The drill falls back to the
receiver's card alone if either half is missing.
GATED, NOT ASSUMED: "Send this session" renders only while the bulk channel is open, so
the drill notes and returns when the control is absent rather than failing - that is a
state the pill has by design.
-->

**What travels.** The session itself, plus the files you brought to it - uploads, recordings, captures. Those exist on one device only, so without them the session would arrive with holes in it.

**What does not travel.** Anything already in the catalogue on both devices. Those are listed by reference and resolved locally, which keeps the transfer to the size of your own work rather than the size of a design system. If the two devices are set up differently and a reference cannot be resolved on the other side, the manifest says plainly which ones those were rather than pretending the render is faithful.

**What happens on arrival.** A received session is filed as a **new** session, always, labelled with who it came from. It never overwrites anything. Received files are stored byte for byte as they arrived, with no re-encode and no downscale, and the transfer is checked against its declared size and digest before and after the write - which is also what keeps content credentials intact across the hop. A file the other device already has is recognised by its checksum and not stored twice.

The transfer runs on its own channel, so a large beam never queues your edits behind it. Editing stays responsive for the whole transfer.

> Today the one control wired up is **Send this session**, and it appears only while the bulk channel is actually open. The wider shapes the format already supports - a hand-picked set of files, a whole project, everything under a tag - are not reachable from the interface yet.

## When there is no internet at all

This is the case the feature was built for.

**Same network is the first-class path.** Two laptops on the same Wi-Fi, a laptop and a phone on the same router, two machines on a wired switch: the two devices find each other on the local network and the pairing completes without anything leaving it. No internet is involved at any point in the editing.

**The hotspot trick.** If there is no network to share, make one. Turn on the personal hotspot on a phone and connect the other device to it. That is a network with exactly two devices on it, no route to anywhere, and it is enough - a plane, a basement, a site with no coverage. This is also the standing answer when a venue's Wi-Fi will not let two of its own clients talk to each other, which happens more often than you would like.

**What needs what**, honestly:

| The part | What it needs |
|---|---|
| Editing together | Both devices reachable from each other on the same network. Nothing else. |
| Opening an invite link | The joining device has to be able to load Lolly at the address in the link. Already installed as an app, or already open on that device, and it loads offline. A first-ever visit needs to be able to reach the address. |
| A code or a QR | Nothing beyond the app being open on both devices. This is the fully cold path. |
| Scanning a QR | A camera, and a browser that can decode barcodes - Chromium-family today. |
| A beam | Both people in the tool. There is no queue for a transfer offered before the other side has the tool open. |

**Across the open internet**, be realistic. The pairing uses the addresses each device can see on the network it is on, and this build configures no external address-discovery server. Two devices on different networks, in different buildings, is not something to plan around. Get onto one network, or onto a hotspot.

## When it will not work

The failures are named rather than shrugged at, and each screen offers the one thing worth doing next.

**This network blocks direct connections.** Both devices gathered addresses and no route between them ever formed. This is client isolation - a guest network, a corporate Wi-Fi, a hotel, a conference floor - where the network deliberately stops its own clients from talking to each other. The screen says so and offers **Try again**.

> **What to try:** a personal hotspot from a phone, with both devices on it. Or a wired network. Or any network you control. Nothing about the app can talk its way past a network that has been configured to prevent exactly this, and pretending otherwise would waste your time.

<!--
DRILL-ASSISTED SHOT (collab-isolation-fail). The isolation screen is reached through the
`ice-failed-isolation-suspected` end cause, which the drill does not currently produce
(the loopback pair connects). Reaching it for real needs a network that isolates clients,
or the connect watchdog (CONNECT_WATCHDOG_MS = 45s) firing.
CAPTURE PASS: cheapest honest route is a hand-driven run with one peer's candidates
blocked, then walker-in-page over `.collab-ceremony`. It is a heading, a paragraph and one
button, so if it turns out to be impractical to reach, DROP the shot rather than staging a
fake one - the copy is quoted in the text above and carries the same information.
-->

**Nothing came back in time.** The reply never arrived. Make a new invite and send it again. Nine times in ten this is the reply leg: the invite was sent, the other person opened it and the reply is still sitting on their screen waiting to be sent back.

**The connection dropped.** The other device stopped answering. A new invite is needed to carry on - there is no server holding the session, so there is nothing to resume from. Your work is untouched on your own device.

**This device does not have that tool.** The collab needs a tool the joining device does not have. Add it there, then ask for a fresh invite.

**The two versions of that tool do not match.** One device has a version of the tool the other cannot read. Update both.

**This device could not open the connection.** The browser refused to make a direct connection at all. Reload and try again.

**This link carries no invite**, or **this invite could not be read.** The link arrived incomplete or something changed it on the way. Ask for a fresh one. If the code came through a channel that wraps lines, the code form pastes more reliably than the link form.

---

**Related:** [Using Lolly](/info/using.html) for the tool, the canvas and saving sessions. [Trust](/info/trust.html) for how the rest of the app treats your work and your data. [Privacy](/info/privacy.html) for what is stored and where.
