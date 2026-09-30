# Find and recover your work

Personal work stays in the browser or app you made it in, on that device, unless you turn on [Sync](/info/sync.html). An organisation using optional **lolly.work** also has server-held **Team projects**, covered below. Saved work is in **Projects**. A downloaded file is wherever your browser or system put it, and a copy usually waits in **Assets**. In most tools, work you never saved is kept as well. This page covers each of these, plus a closed tab, cleared browser data, earlier versions, deleted items and moving to another device.

| What you did | Where to look |
|---|---|
| Pressed **Save as** or **Save** | **Projects** |
| Pressed **Download** | Your browser's downloads, and a copy in **Assets** |
| Neither, in a [tool that saves as you work](#which-tools-save-as-you-work) | **Projects** and **History** |
| Neither, in a tool that does not | Only the tab you worked in, until you close the tab |
| Deleted it in the app | **Trash**, in **Projects**, **Assets** or **Settings → Storage**, for 30 days |

::: details Find shared work in lolly.work (optional)
Open your organisation's Lolly and sign in, then look in **Projects → Team projects**. Shared sessions are held by that instance and appear according to your access. Signing in can restore access to those sessions on another device; it does not restore your personal library or device backup.

In a [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), wait for **Saved to work** before leaving. If a shared project is missing, check that you are connected to the right instance and ask its operator about access or retention. Clearing browser data removes local copies, not the organisation's server copy. See [Use Lolly at your organisation](/info/organisation.html).
:::

## Find something you saved

1. Press **Home** at the top left of the tool.
2. Open the **Projects** tab at the top of the home screen (the folder icon on a phone).
3. Look on the first screen. Work saved to **My library** is there, and each project is a folder. To search every folder at once, type in **Search all projects…** at the foot of the screen.

An item is named after the file name you typed in the export panel, or after its tool, such as **QR Code**, if you typed none. Open the item and every setting is back, ready to change and export again. To keep new work this way, see [Saving and continuing](/info/using.html#saving-continuing).

::: note Not in Projects?
- It may be in **Trash**: see [Get back something you deleted](#get-back-something-you-deleted).
- Another browser, a private window or another device starts empty, unless you use [Sync](/info/sync.html) or [move your work](#move-your-work-to-another-device).
- If you only pressed **Download**, see [Find a file you downloaded](#find-a-file-you-downloaded).
:::

::: details Working with Projects
You can also open **Projects** from **Settings → Storage → Saved sessions → Organise in Projects**. It works like a file manager:

![Projects before anything is saved: the New folder, New asset and Templates tiles, the History clock at the top right and the Search all projects bar at the foot](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Folders that nest.** Group saved sessions into folders, and folders inside folders, as deep as you like. Create a folder, rename it or drag a tile onto another folder to move it; a breadcrumb walks you back up. Sessions saved without a folder appear directly at the **Projects** root.
- <!--i:clock--> **Sort your own way.** **View options**, the sliders button at the top right, offers **Grid** or **List** and sorts by **Name**, **Date added**, **Last modified** (the default), **Size** and, inside a folder, **By tool**. Folders always come first regardless of which sort is active - the sort only orders the sessions and folders within their own group.
- <!--i:document--> **File new work straight in.** **New asset** opens the shared picker. Choose **Templates** to start from a saved template: open it to edit, or use **+ Add** to save a new creation immediately.
- <!--i:checklist--> **Multi-select (desktop).** Tick a tile's checkbox, drag a selection box across empty space or **Shift/Cmd-click**; **right-click** a tile for its context menu. The selection bar then offers **Render selection**, **Move to…**, **New folder**, **Delete** (which moves to Trash), **Edit together** for two to eight single-tool sessions, side by side under one sidebar, and **Edit as sheet**, which opens a selection of any size or mix as rows in the batch grid.
- <!--i:download--> **Render a whole folder or selection.** **Render folder** exports every saved session in a folder - including its sub-folders - as one nested `.zip`. **Render selection** does the same for any multi-selection, and a single session renders straight to its own file. No Batch/Pro needed.
- <!--i:link--> **Jump straight to a tool's saved work.** Tick one or more tools on the Tools gallery and choose **View sessions** from the selection bar - Projects opens showing only the sessions made with those tools, with a **Clear** to get back to the full view.
- <!--i:link--> **Share a saved session.** Right-click a session (on a phone, press the **•••** on its tile) → **Share link** to copy a link that reopens it with the same settings; pictures from your device do not travel with a link (the full Share dialog: see [Sharing your work](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Rename or copy one.** Right-click a session (on a phone, press the **•••** on its tile) for **Rename**, **Duplicate** (a copy in the same folder) and **Move to…**.

![The View options popover in Projects: Layout with Grid and List, and Sort by set to Last modified, beside a button that reverses the order](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## If you closed the tab or left the tool

What comes back depends on how you left and which tool you used:

- **You closed the tab, or came back another time.** Unsaved work is gone, except in the [tools that save as you work](#which-tools-save-as-you-work): open that work from **Projects**.
- **You reloaded the page in the same tab.** Your settings come back from the page address. In tools that do not save as you work, pictures and files you added from your device, and single-line text longer than 150 characters, do not come back, because the address does not hold them.
- **You pressed Home, or the back button at the top left.** If you changed something since you last saved, downloaded or copied, an **Unsaved changes** dialog asks whether to save first. **Save & leave** saves the work and takes you to **Projects**, or back to the project folder you opened the work from. **Leave without saving** discards your changes: a saved item goes back to how you last saved it, and a creation you never saved leaves **Projects**. **Cancel** keeps you in the tool.

Lolly asks only when you press **Home** or the back button in a tool. Closing the tab, reloading and your browser's own Back button never ask. To be sure, press **Save as**, or **Save** in the export panel, before you leave a tool.

When automatic recovery is unavailable, a note beside the editing controls explains what to keep. In an imported-file tool, save your settings and keep the original files too. In a recording tool or a utility with no Save action, save or download the result before leaving. The native apps identify when you need to save manually. A private collaboration's history is temporary; save a separate copy before the session ends.

::: note Left without saving by mistake?
In tools that save as you work, History keeps a copy of the discarded edits. Open the **History** page, find them under **Changes** and press **Open as a copy**. In other tools the changes are gone.
:::

::: details Which tools save as you work
In the web app, every tool that makes a document saves as you work: Design, Chart, QR Code, Text, Sandbox and the rest. These tools do not:

- tools that work on a file you bring, such as Redact, Sign or Convert Image, because Lolly never keeps a copy of that file;
- tools that record from your camera, microphone or screen, such as Record, Screen Capture and Voice Recorder;
- 3D and Darkroom, which take a file of their own;
- a tool with nothing to change, such as Countdown.

In the other tools, your first change files the work in **Projects** as if you had saved, and later changes are kept as you work, once the tool has finished drawing. So an unsaved creation is still in Projects after you close the tab and reopens with its changes marked unsaved. **Leave without saving** still discards them, and History keeps a copy of the discarded edits for 30 days. Opening the tool again from the home screen starts a new creation; open the earlier one from Projects.

With [Sync](/info/sync.html) on, a creation filed this way goes to your other devices like anything else in Projects. Its versions stay on the device where they were made.

If a creation is open in two tabs and you save in both, the last save is kept. The work it replaced is not lost: it is under **Protected drafts** in the creation's History, with **Open draft as a copy**.

This works in the web app only, not in the desktop or mobile apps, and not while you work live with someone else.
:::

## Find a file you downloaded

In a browser, **Download** hands the file to your browser, which saves it in its downloads folder (usually **Downloads**) or asks you where. Lolly is not told where the file went, so look in your browser's list of downloads.

If no file appeared, look in the export panel while you are still in the tool. Under **Download**, a line gives the file name and the time, with **Retry download**, and in Chrome, Edge and other Chromium browsers **Save file…** to choose a folder yourself. The line and its file last until you leave the tool, reload or export again.

Lolly also keeps two things after each download:

- **A copy of the file**, in **Assets** under **Your uploads**, while **Save my renders to my library** is on under **Settings → Your renders** (**Settings** is at the foot of the home screen). The setting starts on. A video, or a file over 50 MB, asks first, and a zip is not copied.
- **The settings you used**, for your last 24 downloads. **Recent exports**, below your saved work in **Projects**, reopens the tool with those settings so you can make the file again, though pictures and files you added from your device are not included. The same list is under **Settings → Activity & stats → Latest exports** and on the **Changes** tab of **History**. This list keeps settings, not the files.

::: details In the desktop and mobile apps
- **Desktop app:** **Download** saves straight into a **Lolly** folder inside your **Downloads** folder, without a dialog. The line under **Download** says where it went, such as "Saved to Downloads/Lolly", with **Show in folder**. **Open Exports Folder**, in the **Window** or **Exports** menu, opens the folder at any time. A file with the same name as an earlier one is saved as "name (1)".
- **iPhone and iPad:** the file is saved in the **Files** app, under **Lolly**, and the share sheet opens so you can send it on. The line under **Download** reads "Saved to Files → Lolly".
- **Android:** the share menu opens so you can choose where the file goes.

On iPhone, iPad and Android, a new file replaces an earlier one with the same name.
:::

## Go back to an earlier version

- **During this visit:** **Undo** steps back through your last 100 changes, until you leave the tool or reload. See [Undo and redo](/info/using.html#undo-and-redo).
- **In [tools that save as you work](#which-tools-save-as-you-work):** earlier versions of each creation are kept. Follow the steps below.
- **Everything on the device:** with [Sync](/info/sync.html) on, **Restore an earlier copy**, under **Settings → Connected services**, brings back one of the last seven daily copies, or the copy from before your last apply. Everything on this device then matches that copy, not just one design.

To open an earlier version:

1. Press **History**, the clock button beside **Undo** and **Redo**. In Design, **History** is in the top bar; on a phone, press **•••** and then **History**. In tools without **Undo**, such as Text and Sandbox, **History** is beside **Home** at the top left.
2. Find the version by its date and time. **Automatic checkpoint** rows are taken as you work; **Saved version** rows are the times you saved.
3. Press **Open as a copy**. The version opens as a new creation, and the one you had open stays as it was. The copy is in **Projects**, with "(copy)" after its name.

To keep a version by name, press **Name version**, type a name and press **Keep milestone**. Named versions are listed on the **History** page, under **Milestones**.

::: details The History panel and the History page
The **History** panel also lists **Recovered work** rows, and **Protected drafts** holds your latest edits between checkpoints, with **Open draft as a copy**. **Compare** and **Check assets** help you choose before you open a copy. Switch **This creation** to **All history on this device** to see every creation.

Automatic checkpoints thin out with age: one a minute for the last hour, one an hour for the last day, one a day for 30 days, then one a week. Saved versions and named versions are all kept. Deleting a creation moves its versions to **Trash** too, and **Delete forever** removes them.

When History storage fills up, the oldest automatic checkpoints of creations you have not opened for 30 days are removed first. A save is always kept, even then: it is written as the current work, and History says that this save is not kept as a version. **Settings → Storage** shows how much History uses.

The **History** page (`#/history`, or **Open app history** in the panel) covers every creation in this browser. On a computer, open the page from the clock button at the top right of the home screen or of **Projects**. On a phone, go to the tools gallery on the home screen, press the round logo button at the top right and choose **Saved sessions**, which opens History. From **Projects** that item does nothing yet.

- **Recent** lists your creations, newest first, with **Resume**.
- **Changes** puts checkpoints, downloads and Convert results on one timeline. A download has **Reopen settings**.
- **Milestones** lists named versions.

Filter by project, tool and date (behind **Filters** on a phone). The History page has no delete button; to remove an item, use Projects.
:::

## Move your work to another device

| To | Use |
|---|---|
| Keep your devices in step | **Sync across devices**, under **Settings → Connected services**: see [Sync your devices](/info/sync.html) |
| Move everything once | **Export my data** and **Import data…**, below |
| Hand over one design or one project | A `.lolly` file: **Export**, then **Share**, then **Download .lolly**; for a whole project, **Download project (.lolly)** in the folder's menu. Press **Open** on the other device. See [The .lolly file](/info/using.html#the-lolly-file) |

A share link carries your settings, but not pictures or files you added from your device.

::: note Importing adds and deletes nothing
Folders, favourites and templates in the file are added beside the ones already on the other device. When a saved item is on both, the copy saved more recently is kept. Your details and settings on that device stay as they are; empty ones are filled in from the file. **Bring it to this device**, in Sync, works the same way.
:::

To move everything once:

1. On the old device, open **Settings → Storage** and, under **Move to another device**, press **Export my data**. Lolly downloads one `.zip` file whose name starts with `LollyTools-`.
2. Carry the file across by USB, email to yourself, AirDrop or a shared folder.
3. On the new device, open **Settings → Storage**, press **Import data…**, choose the file and press **Import**.

::: note What stays behind
Sign-ins, keys and the sync passphrase stay on each device. The list of recent downloads, offline downloads and AI models do not travel by any route. Version history travels only in an **Export my data** file, not through Sync or a `.lolly`. When the history is too large for one file, the oldest automatic checkpoints are left out and the export line says how many. A copy Sync keeps in your storage can be downloaded and opened, or picked in **Import data…**, like a backup file; an encrypted copy asks for your passphrase.
:::

::: details What the backup file holds
The file is named `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (the name parts come from your profile and are dropped if unset; `<n>` is a per-day counter so same-day exports don't collide). It contains your profile, with your folders, Trash, templates and favourites; every saved session with its thumbnail; your uploaded images, fonts, logos and the copies of your downloads; your design systems; your preferences (theme, sidebar width, local activity stats); saved versions and results from Convert; and, from the web app, the version history of your creations.

The catalogue cache isn't included - it re-downloads itself on the new device. Each part is checksummed, so a file damaged in transit is caught on import rather than restored half-broken. Saved sessions re-link to your imported images automatically. The web, desktop and mobile apps read the same file; the terminal app writes a simpler backup of its own, which this format does not read. **📦 Export my data & render everything** makes the same file plus a second zip with every saved session rendered to its output. (Full format spec: [Data Transfer](/info/data-transfer.html).)
:::

## If you clear your browser data

In the web app, Lolly keeps everything in your browser's storage for this site: saved work, pictures, fonts, design systems, version history and offline downloads. Clearing this site's data in your browser removes all of that, and Lolly cannot bring any of it back. What remains is what already left the browser: files you downloaded, an **Export my data** file, a [Sync](/info/sync.html) copy and links you shared.

::: warning Before you clear browser data
Press **Export my data** under **Settings → Storage**, and keep the file somewhere else.
:::

When the app starts, Lolly asks the browser not to clear its storage when the device runs low on space. The browser decides. Under **Settings → Available offline**, a line starting **Protected** means the browser agreed; "The browser may clear downloads if the device runs low on space" means it did not, and **Protect downloads** asks again. If the browser did not agree, it may clear saved work as well as downloads when space runs low, so keep a recent **Export my data** file.

**Settings → Storage** shows how much space each kind of data uses. Its **History** row counts automatic checkpoints, their previews and recovery drafts; **Remove automatic checkpoints older than 30 days** frees that space and keeps saved and named versions. **Clear cache** drops downloaded catalogue files, which download again when needed. **Clear all my data** asks you to type a word, turns off Sync, then removes everything Lolly keeps in this browser: your profile and settings, saved sessions with their history and the Trash, uploads, fonts and design systems, the download log, Convert results, downloaded AI models and offline copies. Files you downloaded stay where you saved them. The app then starts as on a first visit.

![The storage card on a phone-width screen: every category of on-device data named, with the Clear all my data button at the bottom](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

In the desktop and mobile apps, saved sessions are files in the app's own data folder and the rest is in the app's own storage, so clearing a web browser does not touch them.

::: details Where the desktop and mobile apps keep saved sessions
One file per saved session, in a `saved-state` folder:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, or the same path under `$XDG_DATA_HOME`
- iPhone, iPad and Android: inside the app's own storage, which the Files app does not show

Pictures, design systems and the list of recent downloads stay in the app's internal storage, not in these folders. The terminal app and the command line read the same `saved-state` folder: see [Where saved sessions live](/info/cli-reference.html#where-saved-sessions-live).
:::

## Get back something you deleted

Deleting a saved session, a folder, one of your uploads or one of your fonts in the app moves it to **Trash** for 30 days, wherever you delete it: **Projects**, **Assets**, **Settings → Storage** or a tool's list of saved sessions. A folder goes with everything in it, as one entry, and a session keeps its version history while it is there. Straight after, a message offers **Undo**. Later:

1. Open **Trash**: the **Trash** tile in **Projects**, the **Trash** button in **Assets → Your uploads**, or the **Trash** row in **Settings → Storage**. All three open the same list.
2. Press **Restore** beside the item. It goes back to its folder, and a font gets back the roles it had in its design system.

**Delete forever** removes one item for good. **Empty Trash** asks first, then removes every item in Trash. Items older than 30 days are removed for good.

::: warning Some deletes are immediate
Deleting a design system, a logo or your profile photo does not go to Trash. The command line and the terminal app delete at once too.
:::

With [Sync](/info/sync.html) on, **Restore an earlier copy** can bring back an earlier day's state of the whole device, and an **Export my data** file brings back what the file holds.
