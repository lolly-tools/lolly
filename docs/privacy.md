# Privacy Policy

*Last updated: 3 October 2026*

> **The short version.** Ordinary Lolly editing, rendering and downloads happen on
> your device and need no account. Features such as sharing, Sync, hosted rendering
> and optional **lolly.work** organisation services send the data they need to the
> destination you or your organisation use. lolly.work can hold shared content,
> identities, audit records and configured usage telemetry. The sections below
> distinguish local data from those server-held records.

## What this policy covers

Lolly is open-source software - an engine, several app shells (web, desktop,
mobile, CLI) and a browser extension - that anyone can run. This policy has two
parts:

- <!--i:code--> **The software itself**: what it does and doesn't do with your data, wherever it
  runs. This is a property of the code, so it's true of every Lolly deployment,
  ours or anyone else's.
- <!--i:server--> **lolly.tools**, the reference deployment SUSE operates: the specific choices
  made running its optional server-side pieces (what's logged, for how long, by
  whom).

If you're using a self-hosted or enterprise Lolly instance, the software behaviour
below still applies, but the *operator* of that instance - not SUSE - is
responsible for anything server-side: their render endpoint, their MCP server,
their Content Credentials certificate authority and their optional lolly.work instance, including its accounts, shared content, telemetry and audit records. Ask them for
their own policy. See [Adoption & Governance](/info/adoption-governance.html) for
what operating Lolly involves.

## The app: what stays on your device

Lolly's web, desktop and mobile shells run the entire render engine client-side.
The local render and download path needs no server once its tools, assets and
encoders are available. Connected organisation workflows can separately save
shared state or submit content for review and delivery, as described below.

**Standalone app use sets no cookies.** Organisation sign-in and optional CA
enrolment have separate cookies, described below. The app keeps these local
records; sharing, Sync and organisation workflows are separate data flows:

- <!--i:sliders--> **Interface preferences** - theme, language, sound settings, sidebar/zoom
  sizing, sort and view choices, which onboarding tips you've seen - in
  `localStorage`, so they're available before the app has finished booting.
- <!--i:download--> **An offline cache of the tool catalogue and asset previews**, so the gallery
  works without a connection.
- <!--i:hash--> **Local usage counters** for your profile card's stats (how many exports, which
  tools) - a small bounded blob in `localStorage`, never read by us, never sent
  anywhere.
- <!--i:folder--> **Your own documents, saved sessions, uploaded assets and fonts** - stored in
  IndexedDB on your device. Personal saves stay there unless you choose Sync or sharing; organisation-held sessions and assets are described below.

Local storage itself sends none of these records to us. Optional network
features have their own destinations and data handling, described below. Clearing the site's storage in your browser removes
the local copy at any time, and so does **Settings → Storage → Clear all my data**,
which also turns off Sync first. (Under the ePrivacy
Directive Art. 5(3), storage that is strictly necessary for the service you asked
for doesn't require consent - only transparency, which is what this document and
the in-app notice both are.)

![The storage section of the profile page on a phone-width screen: every category of on-device data named, with the Clear all my data button right beside it](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Your own backup of this data - the `lolly-backup` bundle produced by **Export my
data** - is a file you keep and control. It never touches our
servers unless you choose to send it somewhere yourself. See [Data
Transfer](/info/data-transfer.html).

## On-device utilities

Some tools - **Strip Hidden Data**, **Compress PDF** and others carrying the
**"Runs on your device"** badge - operate on a file you provide. The file is read
into memory in your browser, transformed locally and offered back as a download.
It is never uploaded, because there is no server in the path to upload it to.
These utilities work offline, and their output carries no watermark or metadata of
ours - the point of most of them is to remove & protect data, not add risk.

![The badge these tools carry: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

Prepare for sharing holds working inputs, private findings and replacement maps
in memory, without automatically adding them to history, links, backups or sync.
Inspection and replacement do not send file contents to a server or validate
credentials online. Users choose whether to copy, download, send or explicitly
save a result to their library; a saved result then follows normal library
backup and sync settings. Recipe files omit prior payloads and literal mappings.
Summary reports contain counts, scope IDs and file hashes. The CLI can also save
a private review file containing original values, only when explicitly requested
with `--review-file`. Clearing or leaving a browser preparation view releases its
working state; this is not a promise of forensic erasure from browser or OS memory.

## Every network request the app can make

The table below lists the app's network features. Organisation services are
grouped in one row and detailed in [their own section](#organisation-services-with-lolly-work).
An operator's configured identity and asset providers can add destinations to that deployment.

| What | What actually leaves your device | When (the act that triggers it) | If an operator blocks it |
|---|---|---|---|
| Tool catalogue sync | Nothing personal - a request for Lolly's own public tool and asset index, to the app's own origin | On startup, then cached offline | The app runs on its cached tool set. It only stops discovering new tools |
| A tool that needs live data | Whatever that specific tool requests, to the host named in its own description. Today that is only the city lookup in the Meeting Planner tool, which asks `geocoding-api.open-meteo.com` to turn a city name into coordinates and a time zone - no account, no key and no identifier beyond the request itself. The input says so right where you type, and each answer is saved on your device so a city is looked up once | Only while using that tool, and only once you enter a location | That one lookup fails. You can still type coordinates by hand, and nothing else is affected |
| Google Fonts | The chosen font family name and your IP address, to Google's font servers (`fonts.googleapis.com` for the stylesheet, `fonts.gstatic.com` for the font file) | Only if you add a Google Font in the brand editor, **and only after you agree to it in a dialog that says exactly this** - a one-time fetch per family, then it lives on your device and is used offline | The Google Fonts picker fails closed. Upload a font file instead |
| Send to Google Drive | The one file you chose to send, to Google's Drive API (`www.googleapis.com`), after a Google sign-in you complete in Google's own popup window. Lolly's access is limited to files it created (the `drive.file` scope - it can never read the rest of your Drive), and the sign-in token is held in memory for the session, never stored | Only when you press "Send to Google Drive" on an EMF export, and only on builds where the operator has configured a Google client id - without one the button does not exist | The button never appears. Download the file and upload it to Drive yourself |
| Send to Dropbox | The one file you chose to send, to Dropbox's API (`api.dropboxapi.com` for sign-in and metadata, `content.dropboxapi.com` for the file itself), after a Dropbox sign-in you complete in Dropbox's own window. Lolly's access is app-folder only (it can only ever see `Apps/` and its own folder there - never the rest of your Dropbox), the "Open" link it shows you is a short-lived private link (no public share is created), and a refresh token is stored only if you tick "stay connected" | Only when you press "Send to Dropbox" on a file, and only on builds where the operator has configured a Dropbox client id - without one the button does not exist | The button never appears. Download the file and upload it to Dropbox yourself |
| Send to OneDrive | The one file you chose to send, to Microsoft's identity and Graph services (`login.microsoftonline.com` for sign-in, `graph.microsoft.com` for the upload; a large file uploads in chunks to a Microsoft-owned upload address on `api.onedrive.com`, `*.up.1drv.com` or `*.sharepoint.com`), after a Microsoft sign-in you complete in Microsoft's own window. Lolly's access is limited to its own folder under `Apps/` (it can never read the rest of your OneDrive) plus your display name for the account label, and a refresh token is stored only if you tick "stay connected" | Only when you press "Send to OneDrive" on a file, and only on builds where the operator has configured a Microsoft client id - without one the button does not exist | The button never appears. Download the file and upload it to OneDrive yourself |
| Send to LinkedIn | The one file you chose to send, plus its name as the text of the post, to LinkedIn (`www.linkedin.com` for the sign-in, `api.linkedin.com` for the upload and the post), after a LinkedIn sign-in you complete in your own browser. The post goes to your own feed as a public post under your name. Lolly can post as you and read your name for the account label, nothing else on your LinkedIn, and the sign-in is kept on this device only if you tick "stay connected" - LinkedIn's tokens last 60 days and cannot be renewed silently, so it lapses on its own | Only when you press "Send to LinkedIn" on a file, in the desktop apps only, and only on builds where a LinkedIn app is configured - without one the button does not exist | Nothing to block in the web app: this exists in the **desktop apps only**, so those two hosts are deliberately NOT in the web app's Content-Security-Policy below. In the desktop apps, remove the configured LinkedIn app and the button never appears |
| Send to Penpot | Your Penpot personal access token (you paste it in the app) and the `.penpot` archive of the design you chose to send, to Penpot's API (`design.penpot.app`) through a small pass-through on the app's own origin (`/api/penpot`), because Penpot's API will not answer a browser directly. The pass-through forwards and forgets; the desktop apps talk to Penpot directly | Only when you press "Send to Penpot" in the Design tool and confirm a project | The pass-through returns an error and the send fails closed. Export the `.penpot` file and import it in Penpot yourself |
| Send to Bluesky | The one image you chose to send, its name as the post text and alt text, and your handle plus an app password (Bluesky → Settings → App passwords, never your account password), to the Bluesky server you name (`bsky.social` unless you self-host). The app password is stored on this device only, never in a backup, and Disconnect wipes it | Only when you press "Send to Bluesky" on an image, after you connect the account in your profile, in the **desktop apps only** | Nothing to block in the web app: its policy below lists no Bluesky host, so the crossing does not exist there. In the desktop apps, remove the connection and the button never appears |
| Send to Discord | The one file you chose to send, as an attachment, to the channel webhook address you pasted (`discord.com`). A webhook address lets anyone holding it post to that channel, so it is stored on this device only, never in a backup, and Disconnect wipes it | Only when you press "Send to Discord" on a file, in the **desktop apps only** | Nothing to block in the web app: its policy below does not name `discord.com`, so the crossing does not exist there. In the desktop apps, remove the webhook and the button never appears |
| Send to Mastodon | The one file you chose to send and its name as the post text, to the Mastodon (or compatible) server you name, after a sign-in you complete in that server's own window. Connecting registers a small per-device app on that server; the sign-in is kept on this device only if you tick "stay connected" | Only when you press "Send to Mastodon" on a file. You choose the server, so it is not in the policy below | The server you name has to allow browser calls; if it does not, use the desktop apps. Disconnect removes the button |
| Send to Nextcloud / WebDAV | The one file you chose to send, to your own server, over one authenticated PUT with the server address, user name and app password you entered (Nextcloud → Settings → Security → Devices & sessions; never your account password). Stored on this device only, never in a backup, wiped by Disconnect | Only when you press "Send to Nextcloud" on a file. You choose the server, so it is not in the policy below | Your server has to allow browser calls from the app's origin; if it does not, use the desktop apps |
| Send to S3-compatible storage | The one file you chose to send, to your own bucket (AWS S3, MinIO, R2, B2, Garage - any SigV4 endpoint), signed on your device with the key pair you entered. Keys are stored on this device only, never in a backup, wiped by Disconnect | Only when you press "Send to S3" on a file. You choose the endpoint, so it is not in the policy below | Your bucket's CORS rules have to allow the app's origin; if they do not, use the desktop apps |
| Sync across your devices | A copy of what you made on this device - saved sessions and projects, your design systems with their fonts and logos, uploaded images, your profile and your preferences - as one file, to the one storage you chose: the Lolly app folder in your Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), files Lolly created in your Google Drive (`www.googleapis.com`), the Lolly app folder in your OneDrive (`graph.microsoft.com`, with larger files uploaded to `api.onedrive.com`, `*.up.1drv.com` or `*.sharepoint.com`, and downloads from Microsoft's `*.files.1drv.com`, `my.microsoftpersonalcontent.com` or `*.sharepoint.com`), or your own Nextcloud / WebDAV server or S3 bucket. The same storage also keeps up to seven daily copies and one copy from before your last apply. **Nothing goes to Lolly:** no Lolly server, relay or Lolly Work server is in the path, and the apps need no Lolly website for it, not even to sign in. The copy is encrypted on your device first only if you set a passphrase. Sign-ins, keys, app passwords, the passphrase and the sync settings stay on the device and are never in the copy. On the web, a remembered Google Drive connection keeps only your account name (and your own client id, if you gave one); the Google sign-in itself lasts one visit. In the Android app, the Google Drive sign-in goes through Google Play services on the phone, which Google runs | Only after you turn on "Sync across my devices" or press "Sync now": an upload shortly after each change and when you leave the app, and a check for a newer copy when the app starts | Sync fails and says why; your work stays on the device. Export your data to a file and move it yourself instead |
| ICC press profiles | Nothing personal - a request for a standard printing-condition profile, to the ICC's public registry (`registry.color.org`, `www.color.org`) | Only if you click an ICC preset in the print-profile manager - a one-time fetch per profile, then it lives on your device | ICC presets fail. Supply your own `.icc` profile instead |
| Internet radio | Nothing personal - a playlist request and an audio stream, to the station (`api.somafm.com` and the icecast server it points at, `*.somafm.com`) | Only while you play the optional built-in radio in the sound player | The radio fails. Every other sound feature still works |
| A URL you ask a tool to capture | A request to the exact web address you type, from the URL screenshot tool. Whatever that address is. This host is not in the policy below, because you choose it at the moment of use | Only when you enter a URL in that tool and start the capture | An operator cannot allowlist this by host. To remove it, remove the tool |
| A web page in a Design box | A request for that page, with your IP address, to the site it comes from, and whatever the page itself then requests. The frame is sent no cookies where the browser supports it and no address beyond the app's own origin, so your document and its link never travel with the request. On the web app only these players can be framed: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (maps) and `www.figma.com`, plus reference pages on `wikipedia.org` and `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` and `www.openstreetmap.org`, until you turn on **Allow pages from any site** (Profile, Trusted sites). That setting reloads Lolly on your device under a policy that can frame any https page, and the same rules about trust and asking still apply. Lolly tools and Sandbox demos in a box run on the app's own origin and contact no one | Only for a site in your Trusted sites (under Profile), including the removable reference defaults, or after you approve that box in its inspector. A deck someone sent you shows a picture of each page until then. The list shown before you present offers "Just this time" and "Always trust" for each site, and nothing is asked while you present | The box shows its picture instead, with a link to open the page in a new tab |
| A Sandbox demo's web resources | A request for each stylesheet, script, font or image the demo's code links to, with your IP address, to the site that hosts the file. No cookies are sent. Files a fetched stylesheet names (Google Fonts' font files, for example) count as separate sites | Only after you click "Fetch & inline", or for a site in your Trusted sites. "Always trust" beside a file adds its site to that list | The demo runs without those files, and the Sandbox lists each file it could not fetch and why |
| Add an image from a URL | A request to the exact image address you paste in "Add from URL" (in the asset picker or Assets). The web app's own policy forbids the browser from fetching another site directly, so the request is made for you by a small pass-through on the app's own origin (`/api/fetch-image`), which fetches the image server-side and hands back only the bytes - it stores nothing and forgets the address. It refuses anything that is not a public image address (a private or internal address is blocked). The desktop apps fetch the address directly. A Lolly link you paste is not fetched at all - it renders on your device. The host is not in the policy below, because you choose it at the moment of use | Only when you paste a URL in "Add from URL" and confirm | The operator turns the pass-through off (`LOLLY_DISABLE_IMAGE_PROXY=1`); then only Lolly links, `data:` images and same-origin images can be added in the web app. The desktop apps are unaffected |
| SEAL signature check | **Nothing.** The web app has no DNS resolver at all - see below | Never | Nothing to block |
| On-device AI models | Nothing personal - a one-time model-file download from Lolly's model host (`lolli.li`), then cached on your device; no account, no identifier, only the request and your IP | Only when you use a feature that needs a model (Verify deep scan, image upscale, speech, and similar) | That feature waits for the download; everything else still works |
| Remote instance | Whatever the instance you name serves back, over the same catalogue sync described above - plus a version tag on requests to it (shell kind and engine version, the same information a user agent carries), so its operator can see which Lolly versions are in the field. On a managed instance, while you are signed in, that tag also carries a per-device install id so the operator's device list can tell this install apart. The tag accompanies requests to that instance; leaving deletes the id, so a device that reconnects later presents a fresh one. Managed instances also make the authenticated policy and service requests described in the next row. You choose the host at the moment of use, so it is not in the policy below | Only if you explicitly point the shell at another Lolly deployment | Instance switching fails. Your local instance is unaffected |
| Organisation services with lolly.work | Sign-in identity and device information; policy requests; the shared sessions, collaboration edits, uploaded assets, approval submissions and delivery files you use; allowed usage-event labels when configured. Requests go to your organisation's instance, with sign-in through its identity provider. See [details below](#organisation-services-with-lolly-work) | When connected and signed in: policy refresh and enabled telemetry can run during use; shared work, collabs, review and delivery send content as part of those workflows | Those organisation features cannot complete; local personal work remains separate |

Every fixed host in that table is also the complete allowlist in the app's
Content-Security-Policy, which the browser enforces. So the list is not only a
description of what the code does today, it is the boundary the browser holds the
app to: a future change that tried to contact some other host would be blocked,
not silently permitted. One row is the deliberate exception, and its own cell
explains it: Send to LinkedIn exists in the desktop apps only, and the web app's
policy lists neither of its hosts - the web app could not reach them even if its
code tried.
Two more rows, Bluesky and Discord, are desktop-only the same way, and their
hosts are left out of the web policy for the same reason. Five rows have no fixed
host, because you choose the address at the moment of use: a URL you ask a tool
to capture, a remote instance you point the shell at, and your own Mastodon
server, WebDAV server or S3 bucket (the last two also as a sync home). None of those is in the policy, and each
uses the destination you selected. A lolly.work deployment must also permit its
configured identity providers and service connections; it does not inherit an
unchanging list of public-reference hosts. The Penpot row reaches
Penpot through the app's own origin, so it is covered by `'self'`. A deployment that wants none of the
optional ones (an enterprise instance with its own fonts, say) removes those
hosts from its policy and the features fail closed rather than reaching out.

Most fetches bring tools, fonts or models to your device. Send actions transmit
the selected file, personal Sync transmits a backup to your chosen storage, and
organisation services transmit the content or metadata needed for shared work.
Hosted render and MCP requests have the separate data flows described below.

**A note on what we removed.** Verify can check SEAL signatures, a scheme where a
file's signing key is published in DNS. Browsers can't make DNS queries, so any
web implementation has to route the lookup through a third-party DNS-over-HTTPS
resolver - which would show that operator the domain being checked plus your IP
address. We used to use Cloudflare's. **We don't any more, and there is no
replacement**: the web app now passes no resolver at all, so SEAL verification
here makes zero network requests. Files whose SEAL record carries its key inline
still verify completely offline. Files whose key lives in DNS report "no key
resolver" instead, and you can check those in the desktop or command-line app,
which resolve DNS natively through your own machine with no third party
involved.

![The Verify screen: a drop target and nothing else - the file is checked where it already is, with no upload and no account](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) You can confirm this yourself: greppable checks for this and every
other claim on this page, with the exact commands and expected output, live at
[Verify It Yourself](/info/verify-yourself.html).

## Organisation services with lolly.work

**lolly.work** is the Lolly project's optional, separately deployed organisation
service. Connecting to an instance introduces server-held data alongside local
editing. Its operator is responsible for that deployment's privacy policy,
access controls, recipients, retention and backups.

| Workflow | Data handled by the organisation's service |
|---|---|
| Sign-in and provisioning | Identity-provider claims, account and group membership, sign-in sessions and device information. OIDC handles sign-in; administrators can provision and deactivate accounts through SCIM |
| Shared catalog and projects | Uploaded assets, metadata and versions; shared projects and sessions; content retrieved from configured library providers |
| Work collabs | Shared session state, live edits and participant presence sent through the instance; saved state persists under its storage policy |
| Managed share links | Link target and access settings, such as expiry and optional password protection; requests resolve through the instance and can be revoked |
| Review and delivery | Submitted content, approval decisions, selected destination, staged files and delivery receipts |
| Server renders and batches | Submitted tool inputs, render requests, status and retained output files. These jobs run on the server rather than on the user's device |
| Usage reporting | Allowlisted event labels such as tool id, format and asset id, according to the telemetry policy below |
| Audit | Actor and action records for governed operations, retained separately from usage telemetry |

The service uses authentication cookies, including `lw_session` for signed-in
members and `lw_guest` for guest access where enabled. These are separate from
the CA enrolment cookie below. Policy refreshes and enabled usage reporting can
make requests while the app is in use; a separate click is not needed for every
request. This is traffic to the configured instance, not a report to the Lolly
project about deployments it does not operate.

**Usage telemetry has three levels:** `off` stores no usage events; `aggregate`
strips user ids; `standard` can attribute events. The default attribution policy
is `opt-in`, which requires the user's consent before storing a user id. An
operator can instead configure attributed reporting with
`telemetryAttribution: default`. Allowed attributes are labels, not tool input
values. See the [telemetry reference](https://github.com/lolly-tools/lolly-work/blob/main/docs/telemetry.md).

**Audit is separate.** Governed actions can retain an identified audit record
regardless of usage-telemetry consent. Turning telemetry off does not turn off
shared-session storage, approval records, render-job storage or audit. The
operator controls retention and erasure, including any audit pseudonymisation;
see [data lifecycle](https://github.com/lolly-tools/lolly-work/blob/main/docs/data-lifecycle.md).

**Local deletion is not server deletion.** Leaving an instance or clearing your
browser removes local state, not the organisation's stored records or backups.
Ask the operator for access, export or erasure of server-held data. Personal
[Sync](/info/sync.html) and **Export my data** are backups of your device, not of
that organisation service. The public [lolly.work](https://lolly.work) sandbox is
a demonstration with memory-only state, not durable storage for your work.

## Hot-linked render URLs

> **Live on lolly.tools.** Every `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`
> URL renders for real, and the inputs travel in that URL. The section below is
> what that means for you, and an operator can switch the feature off on their
> own instance.

The app itself stays entirely on your device. Separately, an operator can enable
**hot-link render URLs** - `/tool/<tool-id>.<ext>?<inputs>` - so a shared Lolly
link can appear as a live image in a README, a wiki or a dashboard. Fetching one
asks the server to render **public tool and catalogue data** with the inputs
written into the URL.

- <!--i:usercheck--> **No accounts, no cookies, no state.** The endpoint is anonymous, and nothing
  on your device is read. Your documents, sessions and uploads never leave your
  browser - they cannot appear in these links at all.
- <!--i:document--> **But the URL itself is recorded.** A URL's query string is part of the request
  line, so it shows up in the hosting platform's ordinary access logs the same way
  every requested path does. If a link's inputs contain someone's name or email -
  a name badge, an email signature - **that text sits in those logs**, and no
  amount of policy wording changes it. So a hot-link URL is the wrong place for
  personal details: give it only what you would put on a public page.
- <!--i:globe--> **The inputs are public by construction** anyway - they are whatever the link's
  author typed into the URL, readable by anyone the link reaches. Don't put
  secrets in a shared link. Lolly offers link encryption for sensitive content.
- <!--i:eyeoff--> Responses are **cached and rate-limited** like any public image, and marked
  `noindex` so search engines don't index your renders.

Self-hosting Lolly and don't want a public render surface? Set
`LOLLY_DISABLE_RENDER_GET=1` and every one of these URLs returns 404.

## The MCP server (optional, for AI agents)

Lolly can also be reached by an AI agent over the Model Context Protocol - an
operator-run endpoint (lolly.tools runs one; anyone can self-host their own,
including fully air-gapped). It shares the render path's no-accounts posture,
plus the tools that necessarily handle file bytes:

- <!--i:cpu--> **`lolly_transform`** (run an on-device utility server-side, on the calling
  agent's behalf), **`lolly_verify`** (check Content Credentials), **`lolly_redact`**
  (black out regions of an image or PDF), **`lolly_read`** (read what a slide deck
  says), **`lolly_check`** (check a document or an export, optionally against
  its source deck), **`lolly_package`** (package a Design document as a
  `.lolly`, with the pictures and the source deck the caller supplies) and
  **`lolly_compose`** (lay slides out from a slide master, reading the text of a
  source deck the caller supplies) all accept
  a file's bytes from the caller. They are processed **in-process, in memory**,
  and the result is returned in that same call - the file is never written to
  disk and never stored once the request completes.
- <!--i:cpu--> **`lolly_rebrand`** (renovate an old slide deck onto a design system,
  across its `plan`, `compile` and `inspect` stages) accepts a deck's bytes the
  same way, and processes them **in memory, for that call only** - nothing is
  written to disk or kept once the response is sent. Its first stage,
  `capabilities`, states in words where your bytes would go before you send
  any: on a self-hosted local server the deck never leaves that machine; on a
  hosted server, calling `lolly_rebrand` sends the deck there, up to the size
  and slide limits that same stage gives.
- <!--i:checklist--> Every other tool - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - works from parameters only (text, numbers, colours,
  URLs, catalogue asset ids), the same inputs a hot-link render URL takes.
- <!--i:lock--> On lolly.tools, `lolly.tools/api/mcp` is open to anyone with no token.
  Its calls are limited per address and by a daily budget: the address becomes
  a one-way-derived bucket key in the abuse-control store, as on the sign-in
  endpoints below, and the budget counts only CPU time and bytes sent, with no
  address. `mcp.lolly.tools` takes a shared token the operator issues to clients
  they trust, or stateless OAuth 2.1: short-lived signed tokens verified against
  a shared secret, nothing stored server-side and the token itself is never
  written to a log or a render URL.

## Content Credentials identity (a sign-in you have to start yourself)

Lolly can seal a cryptographic **Content Credential** into your exports so anyone
can verify, offline, that a file is unaltered since it left Lolly. That much is
**on by default and fully local** - the signing key is generated on your device
and signing itself happens offline. Without enrolment that key is a throwaway:
a fresh keypair minted for each export and dropped with it. Once you enrol, the
key becomes a lasting one and is generated **non-extractable** - not even Lolly's
own code can read it, only ask it to sign. Either way it never leaves your
device. This section covers the one *optional* step on top of that:
enrolling a verified identity, so your exports say "Verified - signed by
\<your email\>" instead of an anonymous key. **If you skip enrolment, this certificate service receives no enrolment data
from you. Other optional services have the data flows described above.**

![The Verified identity card on the profile page, phone-width: the certificate lifetime picker and the enrolment step beneath it, dormant until you start it yourself](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

If you do enrol, here is exactly what happens:

1. **You choose a sign-in method** - GitHub, Google, SUSE (id.suse.com) or an
   emailed link. For the three OIDC providers, you're redirected to that
   provider's own login page, governed by their privacy policy, not ours.
   Lolly's certificate service receives back only a verified email address and
   the provider's name. For the email link, the address you type is passed to
   **Resend**, a transactional email API, solely to deliver that one link.
2. **A short-lived cookie protects the redirect.** The certificate service sets `lolly_ca_state`, `HttpOnly`, scoped to `/api/ca`,
   expiring within ten minutes. It carries a random value, not a tracking
   identifier, and exists only to stop the OAuth redirect being forged. It is
   cleared as soon as sign-in completes.
3. **Your IP address is used, briefly, to prevent abuse** of the sign-in
   endpoints (so one script can't spam an inbox or exhaust the email quota).
   Lolly hashes it before creating a short-lived abuse-control bucket; the raw
   address is not sent to that store. The bucket expires after about a minute
   and is not used for tracking. Ordinary hosting access logs are separate and
   described below.
4. **The certificate service issues a short-lived certificate** (7, 30, 90 or 365
   days, your choice, capped by the operator's policy) binding your verified
   email to the public half of the keypair generated on your device. The private
   half never leaves your browser.
5. **Nothing about the issuance is recorded.** The certificate service keeps no
   issuance log: not your email, not the provider, not a serial number, not a
   timestamp. No database, no log line, no webhook. Your email address exists in
   the request only long enough to be written into the certificate that your own
   device receives, and then it is gone from our side entirely.
6. **After that, signing is offline again** for the certificate's whole lifetime.
   Exporting a file never contacts the certificate service - only enrolling did.

**The tradeoff, stated plainly.** An earlier version of this service did log each
issuance, so that a misissued or compromised certificate could be traced. We
removed it to avoid retaining personal data in this certificate service.
Organisation identity and audit records in lolly.work are separate and follow
the operator's retention policy. What we give up is server-side traceability: if a certificate is
misused we cannot look up who obtained it. Certificates are short-lived by
design - 7 to 365 days, your choice, capped by the operator - and expire on their
own, which is the mitigation we rely on instead. Self-hosters whose own
obligations require an audit log can add one, and become the controller of that
data by doing so.

## The browser extension

The **Lolly URL Screenshot** browser extension does not collect, store or
transmit any personal data. No analytics, no tracking, no remote server.

**What it does.** When you ask the Lolly web app to screenshot a URL, the
extension opens that page in a temporary background tab, captures it in your
browser using the DevTools Protocol, hands the image back to the app and closes
the tab. Everything happens locally, on your own device and network.

**Data.**

- <!--i:shieldcheck--> **We collect nothing.** The extension has no servers and makes no network
  requests of its own.
- <!--i:photos--> **Captured images** go straight to the Lolly app in the same browser - never
  uploaded by the extension.
- <!--i:link--> **The URLs you capture** are used only to load that one page for that one
  screenshot. They are not logged or shared.

**Permissions.**

- <!--i:wrench--> **`debugger`** - to capture the rendered page via the DevTools Protocol (the
  same mechanism the Lolly desktop app uses).
- <!--i:monitor--> **`tabs`** - to open and close the temporary tab the page loads in.
- <!--i:globe--> **Host access (`<all_urls>`)** - because the page you choose to capture can be
  on any site. Chrome surfaces this at install time as a broad permission
  warning. The extension only ever visits the URL you give it.

None of these are used to read, monitor or transmit your browsing beyond that
one requested capture.

## Infrastructure logs

This section describes the public lolly.tools deployment. Its hosting platform
records ordinary request metadata: IP address, requested path, timestamp and
user agent. Local edits do not reach that host. A hot-link render's query string
can contain the text supplied by its caller, as explained above. MCP file tools
process supplied bytes in memory. A separate lolly.work deployment additionally
holds the service records described above and has its operator's logging policy.

**The public services minimise application logging.** The MCP server contains no
logging statements at all. The certificate service emits exactly two lines, both
on failure and both deliberately stripped: a send-failure status code with no
recipient address, and an error message with no stack trace or URL (a stack could
carry an enrolment token). Everything else in the log is the hosting platform's,
not ours.

For lolly.tools, hosting is Vercel and access-log retention follows Vercel's own
platform defaults for our plan. We configure no log drain, no long-term log
export and no analytics or monitoring product on top. We keep no copy of these
logs ourselves, which also means we have no way to search them for you - see
[Your rights](#your-rights).

## Legal bases, retention and recipients

This table covers the reference **lolly.tools** deployment. It does not state
the legal bases or retention periods of your organisation's lolly.work instance;
its operator must provide those in its own policy.

| Processing | Legal basis (GDPR Art. 6) | Retained for |
|---|---|---|
| Everything on your device (documents, prefs, cache, counters) | **Not our processing at all** - it never reaches us. Storage on your device is strictly necessary for the service you requested (ePrivacy Art. 5(3)), so it needs no consent | Until you delete it |
| Your email address during Content Credentials enrolment | **Art. 6(1)(b)**, performance of a service you explicitly requested | Not retained. Present in memory for the duration of the request only |
| A one-way-derived bucket key made from your IP address, for rate limiting the sign-in endpoints and the public render, image and MCP endpoints | **Art. 6(1)(f)**, our legitimate interest in preventing abuse of a free service and of a third party's email quota. We consider this to pass a balancing test because the raw address is not sent to the limiter, the bucket is used only for abuse control and it expires automatically | About 1 minute in the abuse-control store; not retained afterwards |
| Hosting access logs (IP, path, timestamp, user agent) | **Art. 6(1)(f)**, our legitimate interest in service security, abuse prevention and diagnosing faults | Vercel's platform default for our plan. We add no drain or export |

**Recipients.** The categories of recipient are: our hosting provider (Vercel
Inc.); our abuse-control store provider, which receives only short-lived,
one-way-derived bucket keys and never the raw IP address; and - only if you use
the email sign-in option - a transactional email provider (Resend). If you sign
in with GitHub, Google or SUSE (id.suse.com), you
interact with that provider directly under their own privacy policy. They tell
us a verified email address and nothing else. We share personal data with no one
else, and we do not sell data, run advertising or profile users.

**Transfers outside the EEA.** Vercel and Resend are US companies. Function
compute for lolly.tools is pinned to Vercel's Frankfurt (`fra1`) region so
processing happens in the EU, but as US-headquartered providers they may still
access data as processors from the US. Those transfers rely on the European
Commission's Standard Contractual Clauses and/or the EU-US Data Privacy
Framework, as set out in each provider's data processing agreement. Because the
personal data reaching these providers is so limited - an email address passed
through to send one message, ordinary access logs, and a short-lived derived
abuse-control bucket - the exposure is correspondingly small.

**Automated decision-making.** None. There is no profiling and no automated
decision producing legal or similarly significant effects (Art. 22).

## Children's privacy

Ordinary local app use does not send personal content to lolly.tools. Its
optional Content Credentials enrolment receives an email address and is not
directed at or intended for children. Organisation services have separate
accounts and data handling; their operator's policy applies.

## Your rights

For records stored only on your device, you can access, correct, delete and
move the data yourself. Your data lives in your browser's storage, in a form you can inspect,
export (**Export my data**, above) or delete (by clearing the site's storage in
your browser, as above).

Formally, under GDPR Articles 15-22 you have the right to **access** your
personal data, to **rectify** it, to **erase** it, to **restrict** or **object
to** its processing (including objecting to anything we base on legitimate
interests), to **data portability** and - where processing rests on consent - to
**withdraw that consent at any time**, without affecting the lawfulness of what
happened before you withdrew it.

For the public lolly.tools services described here, we no longer
keep an issuance log, so **we hold no personal data about you that we can look up,
correct, export or delete.** If you write and ask what we have on you, the
truthful answer is nothing, and we will state it. The one category that exists at
all is hosting access logs keyed to an IP address, held by our hosting provider
under their retention defaults. We have no facility to search or selectively
delete those, and we will tell you that rather than pretend otherwise. Your local records remain accessible on your device. For organisation-held
work, identities, telemetry and audit records, contact your lolly.work operator;
local export and deletion controls do not manage those copies.

**You have the right to complain.** If you think we have handled your data
improperly, you can lodge a complaint with a data protection supervisory
authority - in the EU, the authority in your country of residence, place of work
or where you believe the infringement occurred (Art. 77). Our lead supervisory
authority is the *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) in
Ansbach, Germany. You do not need to contact us first, though we would like the
chance to fix it.

We do not sell personal data.

## Changes to this policy

The date at the top changes whenever this document does. A change that alters
what leaves your device or what's retained gets its own line here, not a silent
edit - if you want to see what changed, ask (below) or compare against the
[public source](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 September 2026:** clarified the optional lolly.work service, its organisation-held content, authentication cookies, usage telemetry and audit records, and the separation between local deletion and server retention. These are existing optional workflows, not a new upload requirement for local editing.

## Who is responsible, and how to reach us

The **data controller** for lolly.tools is:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germany

SUSE has appointed a **Data Protection Officer**, reachable at
[privacy@suse.com](mailto:privacy@suse.com). Use that address for any formal
request under "Your rights" above.

For anything about Lolly itself - how it works, why a thing is the way it is or
a correction to this document - contact **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

For a self-hosted or enterprise Lolly instance, contact whoever operates it
instead: the operator is the controller for their own deployment. SUSE and the
Lolly open source project hold no data for deployments they don't run.
