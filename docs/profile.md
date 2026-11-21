# Profiles

Set your name, contact details and headshot once, and every tool built to use them fills them in, such as an email signature, a badge or a speaker card. That record is your **profile**, and it lives on your device.

Your profile also holds saved sessions, uploaded images and your local activity tally. Manage it under **Settings → Preferences**. Tools read only the fields they were built to pre-fill. Standalone use needs no account. Optional Sync, sharing and organisation services each have their own data flows.

<!--i:eti-user-check-->
## What's in a profile

| Part | What it is |
|---|---|
| **Name** | First and last name. |
| **Contact** | Email and phone. |
| **Location** | City and country. |
| **Headshot** | An optional photo, cropped to a square and kept as a local image, for tools such as email signatures, quote cards and org charts. |
| **Use my details to create** | An opt-in switch that reads **Using my details** once on. It decides whether your details travel as the author credit in exported files and on Lolly Batch runs; see [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Your theme, your colourway in each design system, your accessibility settings and which parts of the app you turned on in **Feature flags**. |
| **Your work** | Saved sessions with their thumbnails, organised in [Lolly Projects](/info/find-your-work.html), your uploaded images and your local activity stats. |

None of it is required, and a blank profile works.

![Settings on the Preferences tab: the settings rail, and Your details with the Use my details to create switch and the name, contact and location fields](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly Settings](/info/dashboard.html) covers the rest of Preferences, from appearance and emoji to storage and offline downloads.

<!--i:eti-users-->
## You, a team or a role

In Lolly a profile is who you are while you make something: yourself, a team or a role. Lolly handles all three the same way.

::: cols
## As yourself

The default: your name, email and headshot. Your signature, badge and conference lockup fill in from them.

## As a team

A team's shared name, a group inbox such as `events@…`, a department and the team's mark. One person sets up the profile and exports a file. Everyone else loads the same profile, so the team's files carry the same details. A shared kiosk or a demo laptop can run one team profile.

## As a role

An event manager needs the event inbox and sub-brand on badges and signage three days a year, then their usual identity back. Keep the role as a saved profile file, load the file for the event and set it aside afterwards.
:::

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profiles at an organisation using Lolly Work
When you sign in to an [organisation's Lolly](/info/organisation.html), Lolly Work can supply verified profile fields from its identity provider and fix fields or preferences under organisation policy. A managed field is labelled in the app.

That sign-in also controls access to shared projects and assets. A team profile file is a local file. It does not grant organisation membership or replace a work account. **Use my details to create** controls the credit in your exports, not the organisation's sign-in or audit records. See [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Keep several, use one

An install has one active profile at a time, with no in-app switcher. Each profile is a portable file, the same backup file that moves your work to a new device. To switch context:

::: timeline
- <!--i:download--> **Export my data** under **Settings → Storage → Move to another device** saves the current profile as one `.zip`.
- <!--i:trash--> **Clear all my data** empties this install.
- <!--i:upload--> **Import data…** loads the profile file for the context you are stepping into.
:::

::: note Importing without clearing first merges
Imported sessions and images are added. Where both copies exist, the more recently saved one is kept. Folders, favourites and templates are added beside yours. Your own details stay, except empty fields, which take the file's values. A merge suits pulling a team's sessions into your setup, but not a clean break between roles.
:::

For two contexts at once, use a separate browser profile, user account or installed copy of the web app. Each has its own Lolly profile.

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Keep one file per context
Name each file for what it is, such as `LollyTools-events-2026.zip` and `LollyTools-me.zip`. The file is the profile.
:::

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) covers what the file holds, what stays behind and the other ways to move, including Sync.

<!--i:eti-pen-->
## How tools use your profile

**Pre-fill.** A tool author marks an input as drawing from your profile (`bindToProfile: "firstname"`, `"email"`, `"headshot"` and so on). When the tool opens, that input fills from your profile. You can override the value for one session without changing the profile, unless an organisation policy locks the input. Pre-fill is local and happens whether or not **Use my details** is on.

**Credit.** When you export, your details can travel as the author credit in the file's metadata (PNG, PDF, SVG and more). **Use my details to create** controls this credit and the author on Lolly Batch runs. With the switch off, the export still says it was made with Lolly, but carries no personal author or contact line.

Tool authors: see [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) and [`host.profile`](/info/host-api.html#host-profile).

![The single Use my details to create switch, marked opt-in and off until you turn it on](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profile, design system and capabilities

Three things sit near each other in Settings and are easy to confuse:

- <!--i:people--> **Profile** - you, your team or the role you are in: name, contact, headshot and saved work. Personal, kept on the device and portable as a file.
- <!--i:palette--> **Design system** - the brand: colours, fonts and settings every tool renders with. Shared, not personal; see [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - what the app can do: the features and tools available to you.

The word has three other meanings in Lolly. A **content profile** is a build setting that chooses which tools and catalogue a deployment ships; the [Glossary](/info/glossary.html) defines the term. The `profile` link parameter picks a colour profile for an export, such as a CMYK press condition; see [Reserved URL parameters](/info/url-parameters.html#print). A **verified identity** is the optional signing certificate that ties your email to your signed exports. It is separate from these details, but **Use my details to create** decides whether either is embedded; see [Content Credentials](/info/content-credentials-identity.html).

![The Verified identity card, phone-width: the certificate lifetime picker and the enrolment step beneath it - the identity profile, separate from your personal details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Privacy

Your personal profile is stored locally. Your details can travel in a backup or Sync copy, in content you share or export and during optional Content Credentials enrolment. On a Lolly Work instance, sign-in, shared work, telemetry policy and audit records are separate from this local profile. **Settings → Preferences → Clear all my data** clears this device; it does not erase copies held by your storage provider or organisation. See the [Privacy Policy](/info/privacy.html).
