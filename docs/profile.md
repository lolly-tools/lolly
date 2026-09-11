# Profiles - who you are when you create

A **profile** is the working identity Lolly creates *as*. It's the small set of details a tool can pull from so you don't retype them every time - your name, contact details, an optional headshot, a few preferences - plus everything you accumulate while you work: saved sessions, uploaded images and the local activity tally.

Everything in a profile lives **on the device**, in the browser's local database (IndexedDB on the web PWA, the filesystem on the Tauri apps). There's no account and nothing is uploaded. You manage it under **Profile** (top-right of the gallery); tools only ever *read* it, and only the specific fields they were built to pre-fill.

> A profile is about *you* (or whoever's creating here). It's distinct from the **Platform** - the brand's colours, fonts and global settings - and from **Capabilities**, the catalogue of what the app can do. See [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) at the end.

## What's in a profile

| Part | What it is |
|---|---|
| **Name** | First and last name. |
| **Contact** | Email and phone. |
| **Location** | City and country. |
| **Headshot** | An optional photo, cropped to a square and kept as a local image. Used by tools like email signatures, quote cards, org charts and dynamic layouts. |
| **Use my details to create** | A single opt-in switch (it reads **Using my details** once it's on). It controls whether your personal details ride along as **provenance** - the author/credit line embedded in exported files - and as the author on **/pro** batch runs. (It doesn't gate pre-fill: see [How tools use your profile](#how-tools-use-your-profile).) |
| **Preferences** | Your theme (Light, Dark or Brand - the brand theme paints the app in your own palette) and which parts of the app you've enabled via **Feature flags**. |
| **Accessibility** | Four comfort switches - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - kept on the profile record, so they ride along in a profile export. See [Accessibility](#accessibility). |
| **Your work** | Saved sessions (with thumbnails) - organised into nested folders in **[Projects](/info/using.html)** - your **My images** library and the local activity stats, all keyed to this profile. |

None of this is required. A blank profile is a perfectly good profile; you fill in only what saves you typing.

![The Profile screen - name, contact, an optional headshot and your preferences](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Preferences are the one part that changes how the app looks back at you. The theme cards are live previews and apply the moment you pick one, on this device only.

The page is a long one, so it carries its own **settings rail** down the side - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - with a **Search settings** field above it that filters the list as you type. Every section is deep-linkable as `#/profile?focus=<section-id>`, which opens it and scrolls it into view (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, and so on), so a link can point at one setting rather than at the top of the page.

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## A profile is a context, not just a person

The word "profile" suggests one fixed person, but in Lolly it's really a **creating context** - *who you are while you make this thing*. That context can be three different shapes, and Lolly handles all of them the same way.

### As an individual

The default. The profile is you: your name, your email, your headshot. Set it once and your signature, your badge, your conference lockup all fill themselves in. This is what most people will ever need.

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### As a team

A profile doesn't have to be a single human. It can stand in for a **team or function within an org**: the team's shared name, a group inbox address (`events@…`), a department, the team's headshot or unit mark. One person sets it up, exports it (see below) and the rest of the team loads the same profile - so everything the team produces carries consistent details without anyone re-entering them. A shared kiosk or a checked-out demo laptop can run a single team profile that everyone behind it creates as.

### As a function - a role you wear sometimes

This is the case the rigid "one person, one profile" model misses. You might be an **event manager three days a year** and something else entirely the rest of the time. Those three days you want event details, the event inbox, maybe an event sub-brand to fill in your badges and signage; the other 362 you want your normal identity back.

In Lolly, that role is just **another profile you keep on hand** - a saved bundle (next section) you load for the event and set aside afterwards. The role is a hat, not a new account. Wear it when you need it, take it off when you're done.

## One install, one active profile - many you can keep

At any moment an install has **one active profile** - the details a tool sees right now. There's no in-app profile switcher; instead, each profile is a **portable bundle** (a single `.zip`, see [below](#moving-a-profile-to-a-new-device)). That's deliberately the same mechanism as moving to a new device - a profile is a file you can save, copy and load.

So if you genuinely juggle several contexts (you, your team, the event-manager hat), you keep several bundles and load the one you need:

- <!--i:trash--> **Cleanest switch:** **Profile → Storage → Clear all my data**, then **Import** the bundle for the context you're stepping into. You're now creating purely as that profile.
- <!--i:layers--> **Layering:** importing *without* clearing first **merges** - the imported profile, sessions and images land on top of what's already there, replacing anything with the same name and leaving the rest. Handy for pulling one team's saved sessions into your own setup; not what you want if you need a clean role boundary.
- <!--i:monitor--> **Side by side:** because everything is device-scoped, a separate browser profile, a separate user account or a second installed PWA each carries its own independent Lolly profile. Run your personal install and the event kiosk install at once, no switching.

Storage is where both halves of that live: the meter accounts for every byte this install is holding, category by category, and the buttons under it are how you clear or carry it.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Keep a bundle per context and rename the files for what they are (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). The file *is* the profile.

## Accessibility

**Profile → Accessibility** holds four comfort settings for the app *around* your work. Each is off until you turn it on, and none of them reach inside a tool canvas or an export - a calmer app must not move a pixel of the file you ship.

- <!--i:film--> **Reduce motion** - turns off the transitions, slides and animated flourishes in the app. Your tool canvas and any animated export keep moving exactly as designed.
- <!--i:image--> **Hide colourful previews** - swaps the gallery preview artwork for calm icon-and-text cards, and lowers the colour and contrast of your project thumbnails so they stay recognisable without shouting. Inside a tool everything shows in full colour.
- <!--i:sliders--> **High contrast** - strengthens the borders, text and focus rings of the app. Your brand colours and everything on the canvas stay exactly as you set them.
- <!--i:font--> **Large text** - grows the app type: labels, menus and button text. The controls keep their size, so only the words inside them get bigger, and type inside your designs is untouched, so nothing you export reflows.

These live on the profile record itself, which is why they travel in a profile export and land on the next install alongside your name and your sessions. (The device also keeps a small local mirror so the setting applies before the first paint; that mirror is device-only and doesn't travel.)

## Your Lolly instance

**Profile → Lolly instance** says where this install gets its tools and catalogue from - the address of the instance, or *Bundled with this app* when everything ships inside the build. Where a deployment offers one, an **Instance console** link opens its admin surface, and **Change** / **Disconnect** re-point the install or cut it loose.

Re-pointing at another instance needs the **desktop app**: a browser blocks a page from loading tools and assets across origins, so on the web the section reports where you are and leaves it there.

## Available offline

Lolly caches as you go, but caching-as-you-go only covers where you've already been. **Profile → Available offline** is for the trip you can see coming: an hour on airport wifi before a flight with none. Download the parts you'll need, watch one progress bar, and everything you took keeps working with the connection gone.

Seven parts, each with its size stated before you commit:

- <!--i:layout--> **The app** - every view, editor and font, including the ones you haven't opened yet. Without this, a screen you never visited online can't load offline.
- <!--i:image--> **Catalogue** - brand assets beyond the essentials. Take all of it, or open *Choose by tag* and take only the tags you use.
- <!--i:book--> **Guides & docs** - this documentation site, in your language, screenshots included.
- <!--i:cpu--> **Speech voices** - the voice models behind Script audio and narration. Downloaded once, then it runs on-device.
- <!--i:zap--> **Upscaling models** - the AI image upscalers: photo, illustration/anime and face.
- <!--i:layers--> **Background removal** - the on-device cut-out models behind *Remove background*.
- <!--i:shield--> **Verify deep scan** - the on-device watermark scanner, for checking Content Credentials away from a connection.

The last four are marked **large download**, and they are deliberately individual opt-ins: **Download everything** at the top takes the app, the catalogue scope you chose, the docs and all tools in one pass and nothing else. Speech voices, the upscalers, background removal and the deep scan each download only when you ask for that row by name - a few hundred megabytes hiding inside one button would be dishonest.

Below the parts sits the per-tool list: each tool downloads individually (the tick means ready offline), or **Download all** sweeps the lot. Downloads are resumable - cancel or lose the connection and the next run picks up where it stopped, fetching only what's missing - and they refresh themselves when you're back online, pulling just what a new release changed.

If the browser hasn't granted persistent storage, the section says so and offers **Protect downloads**, which asks for it - the difference between "downloaded" and "downloaded until the browser wants the space back".

## Moving a profile to a new device

Because a profile is entirely local, the only way to get it onto a blank install - a new laptop, a freshly reset browser, a colleague's machine, an offline box - is to **carry the file**. No login restores it for you, and that's the point: nothing ever left your device to begin with.

Under **Profile → Storage → Move to another device**:

- <!--i:download--> **Export my data** downloads one `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - named for the profile it belongs to, with a per-day sequence number so repeat exports don't collide (name parts are dropped when the profile doesn't have them). It contains your profile, every saved session (with its thumbnail), your uploaded images - your brand tokens and installed fonts ride along as user assets - and your preferences (theme, layout, local activity stats).
- <!--i:upload--> **Import data…** on the other install reads that file back in and you pick up exactly where you left off.
- <!--i:box--> **Export my data & render everything** writes that same backup *plus* a second zip that renders every saved session to its finished output file, in folders that mirror your Projects. A complete offline archive of both the sources and the results - and it can be large and slow with a lot of sessions.

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

The bundle is a plain, self-contained zip, so it travels by **any** means - USB, AirDrop, a network share, email-to-yourself - and the target can be completely offline. Each part is checksummed, so a file damaged in transit is caught on import rather than restored half-broken. Import **merges** (same-named profile/session/image is overwritten; everything else is kept), so it never wipes a target that was already in use.

What doesn't travel: the catalogue cache (it re-downloads itself on the new device) and the tools themselves (assumed already present). 

For the exact bundle layout, version policy and integrity rules, see **[Data Transfer](/info/data-transfer.html)**; for the end-to-end walkthrough, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## How tools use your profile

A tool only ever *pre-fills* the profile fields it was explicitly built to bind:

**Explicit binding.** A tool author marks an input as drawing from the profile (`bindToProfile: "firstname"`, `"email"`, `"headshot"`, …). When the tool opens, that input pre-fills from your profile - and you can still override it for that one session without changing the profile. Pre-fill is a local convenience and happens whether or not **Use my details** is on.

**The opt-in (provenance).** When you export an asset, your details optionally ride along as **provenance** - an author/credit line embedded in the file's metadata (PNG, PDF, SVG, …) - so a finished asset can say who made it. *This* is what **Use my details to create** governs: leave it off and the export still carries the "Made with Lolly" tool/platform attribution, but no personal author/contact line is embedded. (The same opt-in sets the author on **/pro** batch runs.) (Tool authors: see [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) and [Host API → `host.profile`](/info/host-api.html#host-profile).)

![The single Use my details to create switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profile vs Platform vs Capabilities

Three things sit near each other in the UI and are easy to confuse:

- <!--i:people--> **Profile** - *you* (or your team, or the role you're in): name, contact, headshot, your saved work. Personal, device-local, portable as a bundle.
- <!--i:palette--> **Platform** - the *brand*: colours, fonts and global settings every tool renders against. Shared and consistent, not personal.
- <!--i:sliders--> **Capabilities** - *what the app can do*: the full feature set and the tools available to you.

A profile changes who an asset is *from*; the platform changes what it *looks like*; capabilities are *what you can make*.

### "Profile" means two other things elsewhere - not this one

The word is overloaded across the project. Neither of these is the personal profile this page is about:

- <!--i:box--> **Content profile** - a build-time configuration in `profiles.json` that binds a set of tool packs to a brand catalog (e.g. `suse`, `lolly-start`). It's what an operator picks when deploying, and it's what the `profile` **URL/CLI parameter** also selects a *colour* variant of at export time (the ICC/CMYK press condition - see [URL Mode](/info/url-mode.html)). Both are about the *build/output*, not about *you*. See [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - the optional **verified Content Credentials identity** you can enrol (a short-lived certificate that ties your email to your signed exports). That's a signing identity, separate from the personal profile's name/contact fields, though **Use my details to create** governs whether either is embedded. See [Content Credentials Identity](/info/content-credentials-identity.html).

![The Verified identity card, phone-width: the certificate lifetime picker and the enrolment step beneath it - the identity profile, separate from your personal details](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacy

Outside the optional identity enrolment above (which sends the email you enrol to the certificate service - see [Server Surface](/info/server-surface.html)), a profile is never transmitted, uploaded or used to identify or track you - there's nothing to consent to, only this notice so you know what's kept. Wipe all of it at any time with **Profile → Clear all my data**. See the [Privacy Policy](/info/privacy.html).
