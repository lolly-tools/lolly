# Shared project assets

Your team keeps files in shared projects. From **Assets** you can browse those folders, copy a file into another project, offer it to your organisation's library or send it to a connected service, without importing anything into your personal library first.

::: note Needs Lolly Work
These steps work when you are signed in to your organisation's Lolly, with shared project files and folders on Lolly Work. Personal projects stay on your device; [Find and recover your work](/info/find-your-work.html) covers them, and [Use Lolly at your organisation](/info/organisation.html) covers signing in.
:::

## Browse a shared project

1. In **Assets**, open **Browse sources**, then **Shared projects**.
2. Choose a project and a folder. The grid shows up to 100 files per page, with the folder path above the grid.
3. Open a file to download and verify the original. Browsing itself reads only the files' details.

## Copy files to another project

::: timeline
- <!--i:check--> Select one or more files.
- <!--i:folder--> Choose **Copy to a shared project**, then the project and the folder: its root or a nested folder.
- <!--i:people--> Everyone with access to that project sees the copies, under the project's access rules. The originals stay where they were.
:::

**Add to project** is the other choice: it adds references to a project folder on your device instead of copying files.

The result lists each copy that succeeded and each that failed. **Cancel remaining copies** stops further work, and closing the dialog cancels the rest too. If cancelling or lost access stops a copy before it is placed in its folder, the upload may remain at the project root, and the result says so.

::: cols
## Travels with a copy

- The file's bytes and name
- Embedded credentials, in bytes that did not change
- A new shared file identity of its own, even when a teammate uploaded the same bytes

## Stays behind

- Source tags and organisation fields
- Review decisions
- Private notes and prompts
- Any export assertion: copying adds none
:::

Only files a provider marks as available originals can be copied; renditions and files of unknown role are refused. SVG files go through the shared upload flow, which sanitises SVG markup and may change the bytes.

::: details How copies stay reliable
A receipt for each transfer is kept on this device for your current account and instance. Upload and folder placement are recorded separately, so retrying a failed placement reuses the upload that was already acknowledged. A lost response from the server is checked against the project's ready files, and an upload that cannot be confirmed is reported rather than sent twice. A copy a teammate moves afterwards is never moved back.
:::

## Offer a file to the library

Open a shared file and choose **Submit to the catalog** (or your workspace's name for it) to offer the original to your organisation's library.

- Choose the audience: everyone in the workspace, or one of your groups. Library access is separate from project membership.
- Lolly Work reads and checks the stored original on the server and applies its usual scan, quota and review policy. The project file stays unchanged.
- The result says whether the file is live or waiting for review. Trying again returns your existing pending submission rather than a second one.

## Send to a connected service

**Send to** lists the connected destinations that accept this file's format and allow uploads. The destination receives the original file under its own access rules, and the result reports delivery, review or a failure you can retry. Destinations that only take exports are not listed, and a library connection used only for browsing cannot upload.

When an administrator turns on shared-original delivery, Lolly Work can also offer fixed Brandfolder and Cloudinary destinations. These send the verified server original without downloading it to your device first.

::: details For administrators
Brandfolder creates a new asset in a fixed section. Cloudinary's first writer stores an authenticated raw original in a fixed dynamic asset folder. Both check the remote original's digest before reporting delivery. A Brandfolder create that times out may need reconciling by an operator; do not create another delivery to get round that result. Qualifying a tenant for writes, and configuring it, are separate from connecting a read-only source.

Submitting project files to the library needs Lolly Work's project-source intake on the server, so update Lolly Work before releasing the matching app; no engine or SDK change is needed. [Organisation delivery destinations](/info/manage/organisation-delivery.html) covers the server side.
:::
