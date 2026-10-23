# Deliver and update a course

You have built a course and downloaded its ZIP from **Export course**. This page covers what comes next: choosing the right format for each customer, publishing on your own website or in an LMS, testing the package before real learners see it, releasing a new version and fixing the problems people most often meet. [Build a course](/info/training-creators.html) covers making the course itself.

## Choose a format for each customer

Each format is a separate package of the same course. Ask the people who run the receiving LMS which format and edition they accept, their package size limit and which learner browsers they support.

::: cols
## Website

For any static HTTP(S) host, including your own platform. Progress stays in the learner's browser. No LMS is involved.

## SCORM 1.2

The format the **Litmos** and **Moodle** presets select, and a common starting point for LMS compatibility testing.

## SCORM 2004 4th Edition

A separate package for an LMS that supports that edition. It uses a different tracking API from SCORM 1.2.

## xAPI / Tin Can

Experimental. For an LMS with a compatible Tin Can launch, which must supply the learner's identity, the registration and temporary tracking authorization.

## cmi5

Experimental. For a cmi5 LMS, using the cmi5 launch and authorization process. Do not assume it is interchangeable with Tin Can.
:::

An LMS's published list of formats does not settle the settings or conventions of a particular tenant. Litmos, for example, lists SCORM 1.2, SCORM 2004 and xAPI/Tin Can support ([Litmos content support](https://www.litmos.com/platform/content-authoring/)), and Moodle documents SCORM 1.2 support without native SCORM 2004 support ([Moodle SCORM FAQ](https://docs.moodle.org/502/en/SCORM_FAQ)). Lolly's generated packages have not yet completed acceptance testing in a real LMS tenant.

You never enter LRS credentials in the authoring screen. An xAPI package expects the customer's LMS to provide the launch authorization, so a standalone xAPI ZIP opened outside that launch creates no learning record. If the connection drops, the learner's browser keeps unsent progress where storage allows, and the next LMS launch of the same attempt delivers it unless the LMS already has newer progress. [Learning integration](/info/learning-integration.html#experimental-xapi-recovery) has the recovery rules.

::: details LMS presets and the Tested label
Each named LMS in the destination list is a preset: a versioned record that selects one delivery format and holds its import steps, any confirmed limits and its test evidence. A saved package records the preset and version it was built for. Choosing a preset never changes the course content or the files in the package.

The destination shows **Standard target**, with "This LMS has not been tested", until a preset carries recorded evidence for that exact format and a named LMS version. **Tested** needs a recorded import, learner launch, media check, completion and resume; a successful ZIP import alone does not earn the label. **Website** and **Other LMS** are standard targets and never show **Tested**. No preset is marked **Tested** yet.

When a preset records a confirmed upload limit, the package check uses it unless you enter your own. Presets never hold credentials, tenant addresses or learner details.
:::

## Publish on your own website

Choose **Website** as the delivery format. Extract the ZIP and upload all its files together to a static HTTP(S) site, keeping the relative paths, then link to its `index.html`. A site builder can embed that URL:

```html
<iframe src="/courses/product-introduction/index.html"
        title="Product introduction" width="100%" height="800"></iframe>
```

Test the hosted URL: images, media, resources, small screens, completion and reopening. Opening the files straight from disk is not a supported way to launch. No Lolly server or special runtime is needed, and access control belongs to your hosting platform.

Progress is kept in the learner's browser, for this course version, URL path and browser profile. It does not follow the learner to another device, clearing site data removes it and people who share a browser profile share it too. If browser storage cannot open, the player says that progress lasts only while the page stays open. Embedding the course on a different origin may restrict browser storage, so test on the real host page.

This is convenient local progress, not an authenticated training record. Keep existing versions at their existing paths when keeping learners' browser progress matters, because a new release starts fresh. [Learning integration](/info/learning-integration.html) covers the progress event a host page can listen for and what a receiving platform is responsible for.

## Test in your LMS

Import the ZIP into a test course before you assign real learners, and use the same downloaded file for every repeat of the checks.

::: check Before real learners see the course
- Launch as a new test learner. The course starts incomplete and the first lesson opens.
- Complete one lesson, use **Save and exit**, then relaunch. The player restores the same lesson and acknowledgements.
- Go to the last lesson without acknowledging earlier required lessons. **Finish** stays unavailable.
- Complete the remaining required lessons and select **Finish**. The completion appears in the LMS's learner record.
- Relaunch the completed module. Reviewing it does not downgrade the completion.
- Check images, resources, silent motion, narrated video, captions and audio in the browsers your customer uses.
- Interrupt a connection or force a save failure in a test environment. The player shows the failure rather than claiming progress was saved.
:::

Record the package checksum, the LMS name and edition, the browser, the date and the results. A successful preview is not evidence that an LMS launch, import or tracking integration works.

## Update a course without changing an existing release

Edit the draft, preview it, add version notes, choose **Export course**, run the checks and save a new version. The new ZIP becomes another saved version. Your customer decides when and how to replace the package in their LMS; Lolly never updates an imported course by itself.

Expand **Saved versions**, then use **Download SCORM 1.2 ZIP**, or the button for the matching format, to recover the exact stored file. **Package details** shows the checksums for comparing files and for acceptance records.

To supply an existing version in another format, choose **Export this version for another destination** on that saved version, select the destination, then check and download. This uses the version's frozen content, even if the current draft or the original source has changed since. A format already built for that version downloads its existing file again.

Test a replacement with the LMS administrator before applying it to an active course. Progress belongs to the release that created it: the player starts fresh when it receives saved state from a different release, and an LMS may reset or keep its own course status according to its replacement policy.

Use Lolly's device backup before clearing site data or moving to another device, and keep a separate copy of each delivered ZIP and its version notes. Team storage, shared review and approval in Lolly Work are not part of this local workflow yet.

## When something goes wrong

| Message or symptom | Next step |
| --- | --- |
| **Save failed** or a storage error | Keep the tab open. Make room on the device, then use **Retry save**. Copy important new text elsewhere if saving keeps failing. |
| **Source unavailable** | Reconnect the source or replace it with **Add content**. A package saved earlier can still be downloaded while its bytes remain on the device. |
| Unsupported SVG content | Export a PNG from the source editor and add that image. External SVG dependencies cannot stay inside a portable package. |
| Motion was expected but still pages appear | Set the saved creation's **Render as** option to **Video with motion**, then preview again. |
| **Launch this package from your LMS** | Import the ZIP and use the LMS's learner launch. Opening `index.html` directly cannot supply the LMS tracking connection. |
| **Retry saving** in the learner player | Keep the player open, restore the connection and retry. A completion message appears only after the tracking operations succeed. |
| Authorization expired, or progress changed in another session | Relaunch from the LMS. Avoid running the same attempt in two tabs. |
| Package will not import | Check the chosen standard, edition and package size with the LMS administrator, and keep the original ZIP structure intact. |
| LMS still shows incomplete | Check that every required lesson was acknowledged, **Finish** was selected and the player confirmed the save. Note the exact package version and any visible error for investigation. |

To build packages from the command line instead of the app, see [Build courses from the command line](/info/learning-integration.html#build-courses-from-the-command-line).
