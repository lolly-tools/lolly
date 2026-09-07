# Component download failure, 2026-09-06

## Reproduced trigger

In the affected normal Chrome profile (Chrome 152 on macOS), ordinary downloads
silently fail when **Settings → Downloads → Ask where to save each file before
downloading** is enabled. Turning that setting off makes the same retained Blob
download succeed immediately. Restoring it to on reproduces the failure.

This isolates the failure to Chrome's download-location prompt path in this
profile. The internal reason the prompt fails remains unconfirmed; this is not
evidence that the setting is generally broken in Chrome. Incognito's ordinary
download opens its Save dialog correctly.

## Browser observations

| Test | Result |
| --- | --- |
| Original `.penpot` action | Builds archive; anchor clicks; no download/history entry |
| Tiny text Blob, URL and anchor kept alive, direct click | Same failure |
| New normal tab, same origin | Same failure |
| `127.0.0.1:5173/icon-primary.svg`, zero service-worker registrations | Same failure |
| Ordinary HTTP SVG download | Same failure after allowing the second controlled download |
| Same text Blob in incognito | Save dialog appears; file saved |
| Video Downloader Professional, Claude, AdGuard, Adblock Plus disabled individually | Each individual test still fails; each extension restored |
| Chrome policies | No policies set |
| Normal profile, ask-where-to-save off | `lolly-probe-without-save-prompt.txt`, 24 bytes, **Done** |
| Same profile, ask-where-to-save restored on | Silent failure returns |
| `showSaveFilePicker`, same affected normal profile | Dialog, write and close succeed |
| Updated component UI's **Save file…** action in original tab | `lolly-001-button-system.penpot` saved; success reported after close |

The original tab had device emulation and a service worker, but both were absent
from other failing controls. The retained Blob could be fetched and read, the
click was not cancelled, and transient user activation was true. These controls
rule out Penpot generation, stale site cache, and early Blob URL revocation as the
immediate cause of this incident. Individual extension tests do not rule out all
possible extension interactions.

## Application mitigation

An anchor click has no delivery acknowledgement, so the component and token
actions now report **File ready**, not **Downloaded**. The most recently prepared
file remains available via **Save file…** where the browser supports it. This
opens the separate File System Access picker directly from a new user click,
without rebuilding the archive or losing transient activation. It reports
**Saved** only after the writable stream closes. Cancellation and failures leave
the file available to retry. Starting another export or leaving the view releases
the recovery action and its retained file.

The user's ask-where-to-save setting and individually tested extensions were
restored. No app cache reset or service-worker change was needed.

Validation: component mount/export, native capture, archive structure/token
bindings, and recovery/save-result tests. Browser validation included the actual
Penpot recovery save in the affected tab.
