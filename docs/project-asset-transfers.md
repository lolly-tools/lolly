# Shared project assets

In Assets, open **Browse sources**, then **Shared projects**. Choose a project and
folder to browse files you can access. The grid shows up to 100 files per page.
The current folder path appears above the grid. Browsing reads metadata; opening
a file downloads and verifies the original. No personal-library import is needed.

Select one or more assets and choose **Add to project**. A device folder stores
references. **Copy to a shared project** copies files to a project root or nested
folder. Everyone with project access can see those copies. Folders inherit the
project's access rules. Original files stay in place.

Copies include the file bytes and name. Source tags, organisation fields, review
decisions, private notes and prompts are not transferred. Embedded credentials
remain in unchanged bytes; the copy action adds no export assertion. Provider
files must explicitly be available originals. Renditions and unknown file roles
are refused. SVG copies use the separate shared upload flow, which sanitizes SVG
markup and may change the bytes.

Each copy gets a distinct shared file identity, even when a teammate already
uploaded equal bytes. A transfer receipt is kept on this device for the current
account and connected instance. Upload and folder placement are recorded
separately. Retrying a failed placement reuses the acknowledged upload. A lost
finalize response is reconciled against the project's ready files. Unconfirmed
uploads are reported rather than duplicated. A completed copy that a teammate
subsequently moves is never automatically moved back.

The result lists successful copies and individual failures. **Cancel remaining
copies** stops further work. A completed upload may remain at the project root
when cancellation or lost access prevents placement. The result identifies that
partial outcome. Closing the copy dialog also cancels remaining work.

Open a shared file and choose **Submit to the catalog** (or the workspace's
name) to offer the original to the connected Work instance. Choose the library
audience explicitly: everyone in the workspace, or one of your groups. Library
access is separate from project membership. Work reads and checks the stored
original on the server and applies its usual scan, quota and review policy.
The project file stays unchanged. The result distinguishes live assets and
submissions awaiting review. A retry returns your existing pending submission.

**Send to** offers connected destinations that accept this asset format and
allow asset uploads. The destination receives the original file bytes under its
own access rules. Export-only organisation destinations are excluded. A DAM
connection used for browsing does not acquire upload capability. Cloudinary,
Orange Logic, Papirfly, Air and Adobe tenant write qualification is separate.

These workflows require shared project files and folders on Work. Project-to-library
submission requires the server-side project-source intake API. Update Work before
releasing the matching shell. No engine or SDK change is required.
