# Using Lolly

A practical guide to actually *using* the app — opening a tool, working the canvas, exporting, saving, and sharing. Everything here runs **on your device**: no account, no upload, no internet required after the first load.

> New here? [Getting Started](/info/getting-started.html) covers installing/deploying the app; this page is about driving it once it's open.

## Opening a tool

The home screen is the **gallery** — every tool, grouped by category. Click a card to open the tool; if you've worked on it before, a **Continue** button resumes your most recent session. Use the search box to filter by name.

Each tool is a split view: **controls** on one side, a live **preview** (the canvas) on the other. Change any control and the preview updates instantly.

## The canvas (preview)

The preview always shows exactly what will export.

**Desktop**

- **Zoom:** Cmd/Ctrl-scroll, or pinch on a trackpad — zoom centres on your pointer.
- **Pan:** hold **Space** and drag, or drag with the **middle mouse button**. (Plain clicks stay free for clicking parts of the design.)
- **Keyboard:** `0` = fit to window · `1` = 100% · `+` / `−` = zoom.
- **Zoom HUD:** the small `−  NN%  +  Fit` control in the corner. Click the percentage to toggle Fit ↔ 100%.

**Touch**

- **Pinch** to zoom, **drag** to pan, **double-tap** to reset to fit.

A dimension change always snaps the view back to a clean fit.

## On a phone

On narrow screens the layout reflows to one column:

- The **controls become a sheet** at the top with a **drag grip** on its lower edge. Drag the grip to resize it — it snaps to **peek / half / full** — or **tap** the grip to toggle collapsed ↔ expanded. The preview fills the space below and stays visible while you edit.
- A floating **Render** button opens the **Export** sheet — all the format, size, copy, save, and download controls in one place. Dismiss it by tapping the backdrop.

## Controls (inputs)

Tools expose only the inputs that are meant to vary — everything else (brand colours, layout, typography) is locked in by the tool author, so whatever you make is on-brand by construction. Inputs include text, sliders, colour pickers, dropdowns, dates, image pickers, and repeating row groups. Some are grouped under collapsible sections.

**Reset:** *Clear changes* returns every input to its defaults.

## Your details & headshot

**Profile** (top-right of the gallery) holds your name, contact details, and an optional **headshot**. Tools that ask for those fields pre-fill them automatically — set them once and your email signature, lockups, and badges fill themselves in. You can still override any field per session. Opt in with **Use my details** so a tool may read them.

Your headshot and details live **only on this device**.

## Saving & continuing

Click **Save** to store the current inputs as a session for that tool. Saved sessions appear on the gallery under **Saved sessions** and via each tool's **Continue** button. You can keep multiple named sessions per tool and delete any from the gallery. Sessions are device-local.

## Sharing a link

Every input is captured in the page URL, so a link *is* the design. Use **Copy URL / Share** in the export controls to copy a link that reopens the tool with all your settings applied — paste it to a colleague, bookmark it, or commit it. Add `&export` to a shared link and it downloads the file on open. (Full details: [URL Mode](/info/url-mode.html).)

> Images you uploaded from your device are **not** included in a shared link — they only exist on your machine.

## My images

When a tool lets you add an image from your device, it's downscaled, stripped of EXIF/GPS, and saved to your personal **My images** library (under **Profile → Storage**). Reuse it across any tool. The library is capped and entirely local — manage or delete images there.

## Storage & privacy

Everything is stored in your browser's local database (IndexedDB): your profile, saved sessions, uploaded images, and a cache of downloaded catalog content. **Profile → Storage** shows usage and lets you:

- **Clear cache** — drop downloaded catalog content (re-syncs next load).
- **Clear all my data** — wipe profile, sessions, and images. *Cannot be undone.*

Nothing is transmitted anywhere. No telemetry, no cloud rendering.

## Moving to another device

Because everything lives on your device, **Profile → Storage → Move to another device** lets you carry it all to a second install — no account, no cloud:

- **Export my data** downloads a single `lolly-data-YYYY-MM-DD.zip` containing your profile, every saved session (with its thumbnail), your uploaded images, and your preferences (theme, sidebar width, local activity stats).
- **Import data…** on the other install reads that file back in. It **merges**: anything with the same name (your profile, a session slot, an image) is replaced by the imported copy; everything else on that device is kept. Saved sessions re-link to your imported images automatically.

The catalog cache isn't included — it re-downloads itself on the new device. The bundle is a plain zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, format id `lolly-backup`), so it survives email, USB, or AirDrop intact and is the same format every shell reads. Each part is checksummed, so a file damaged in transit is caught on import rather than restored half-broken. (Full format spec: [Data Transfer](/info/data-transfer.html).)

## Exporting

See **[Exporting & Formats](/info/exporting.html)** for the full story — choosing a format, output size and print units, transparency, video, and copy/share. In short: pick a format, set the size if you need to, and **Download** (or **Copy** to the clipboard).

## Batch (Pro) mode

For power users, **Batch** (linked from the gallery) renders many variations at once — a grid where each row is a set of inputs, exported together. Ideal for localising a card into a dozen languages or generating every size variant in one pass.

## Offline & install

Lolly is a PWA. After the first load it works **offline** — install it from your browser's address bar (or *Add to Home Screen* on mobile) for an app-like, full-screen experience. It updates itself when you're back online.
