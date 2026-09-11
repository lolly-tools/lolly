# Linux desktop integration files

Freedesktop-spec integration for the desktop app, kept here as the single source
of truth and installed by both packagings (the RPM spec and the Flatpak manifests).
App *metadata* (the .desktop entry, AppStream metainfo, icons) lives in
`../flatpak/` for the same single-source reason - this directory is only the
*integration* layer: MIME, thumbnails, search, D-Bus activation, right-click verbs.

Everything here is data for other programs to read; none of it changes what the
app renders or exports.

## The files, and where each package installs them

| File | RPM (`/usr/share` unless noted) | Flatpak (`/app/share`, exported) |
|---|---|---|
| `mime/tools.lolly.Desktop.xml` | `mime/packages/` | `mime/packages/` |
| `thumbnailer/lolly-thumbnail` | `/usr/bin/` | `/app/bin/` |
| `thumbnailer/lolly.thumbnailer` | `thumbnailers/` | `thumbnailers/` (see caveat) |
| `search/tools.lolly.Desktop.search-provider.ini` | `gnome-shell/search-providers/` | `gnome-shell/search-providers/` |
| `search/tools.lolly.Desktop.SearchProvider.service` | `dbus-1/services/` | `dbus-1/services/` |
| `search/org.lolly.Desktop1.service` | `dbus-1/services/` | `dbus-1/services/` |
| `kde/lolly-utilities.desktop` | `kio/servicemenus/` | not installed (Flatpak never exports servicemenus) |
| `kde/tools.lolly.Desktop.runner.desktop` | `krunner/dbusplugins/` | `krunner/dbusplugins/` (Flatpak 1.16+) |
| `systemd/lolly-hotfolder.{path,service}` | not installed - documentation | not installed - documentation |

Notes per file:

- **MIME** (`mime/tools.lolly.Desktop.xml`) - registers
  `application/vnd.lolly+zip` ("Lolly bundle", glob `*.lolly`, sub-class of
  `application/zip`, zip magic at priority 40 so plain zips keep winning on
  content). The MIME string is the app's canonical `LOLLY_MIME`
  (`shells/web/src/lib/lolly-pack.ts`); tests guard the two against drift. It
  also supplies extension-only definitions for Penpot, Figma and IDML on
  desktops whose shared MIME database does not know them yet. Those foreign
  types have no Lolly icon or magic rule; the `.desktop` entry merely makes the
  app an Open With fallback and never changes an existing default handler.
- **Thumbnailer** - `lolly-thumbnail` (python3 stdlib only) lifts the PNG `thumb`
  data URL straight out of a `.lolly`'s `manifest.json`; no thumb / non-PNG thumb /
  brand pack exits 1 and the file keeps its generic icon. `lolly.thumbnailer`
  registers it for GNOME Files and friends.
  **Flatpak caveat:** `share/thumbnailers` is not on Flatpak's export whitelist,
  so host file managers only pick this up from the RPM/deb install; it is still
  installed in the Flatpak for forward-compatibility and in-sandbox consumers.
- **Search** - the `.ini` tells GNOME Shell to query the app; the KRunner
  metadata makes the same index discoverable in Plasma Search. The search
  D-Bus service cold-starts `--search-provider`, whose webview stays hidden until
  a result/provider action is activated; **Show more** carries the terms into
  Lolly's `#/?q=` gallery search. The second D-Bus service starts an
  `org.lolly.Desktop1` automation call. `DBusActivatable` stays `false` in the
  .desktop: the running app owns both names itself, and the shell falls back to
  plain launching when activation is not available.
- **KDE service menu** - "Strip hidden data / Convert / Redact with Lolly" on
  images and PDFs in Dolphin. Each verb carries an allowlisted target and the
  selected file directly into that utility; ordinary Open With keeps the generic
  chooser.
- **systemd units** - a documented, hand-installed example of watching a hot
  folder with the CLI while the app is closed. The supported hot folder is the
  in-app one.

## What Dolphin does and does not get (the KIO note)

Dolphin gets the MIME type, the icon, the "Open With Lolly" association and the
service-menu verbs. It does **not** get `.lolly` thumbnails: KDE thumbnailing
requires a compiled KIO ThumbCreator plugin (C++), which is out of this wave and
recorded as such in `plans/174-linux-desktop-home.md`. Until then a `.lolly` in
Dolphin shows the MIME icon, which is correct and honest.

## The GNOME Files story

With the MIME XML and the `.desktop`'s `MimeType=` installed, GNOME Files shows
`.lolly` files with the app icon, names them "Lolly bundle", offers **Open With
Lolly** as the default handler (double-click opens the app's import flow), and -
where the share file carries a thumb - renders a real session thumbnail via the
thumbnailer above. Per-file right-click verbs in Nautilus beyond "Open With"
would need a Nautilus python extension, which is user-installed territory and
deliberately not shipped (same plan, "out of wave").

## After editing anything here

MIME or `.desktop` changes are invisible until the host caches refresh:

    update-mime-database ~/.local/share/mime        # or /usr/share/mime as root
    update-desktop-database ~/.local/share/applications

The RPM does this in `%post`/`%postun`; Flatpak export handles its own. On a test
machine where you copied files by hand, run them yourself or the change silently
"doesn't work".
