# Creative rights, credits and what stays yours

You should be able to use good work made by other people without becoming an expert in licensing, and without quietly dropping the people who made it. So Lolly keeps the source of every work it draws, reads the licence that was recorded for it, works out what that licence asks of the use you are actually making, does the part a program can do and tells you the part only you can do.

None of this is legal advice and none of it is a ruling about your project. Lolly records facts, applies a small set of rules that were read from the licences' own legal texts and shows its working. A licence with conditions is a normal, permitted choice. It is never presented as a broken asset.

## Three facts, kept apart

"CC BY 4.0", "this use needs a credit" and "the credit is in the file you just downloaded" are three different statements, and Lolly keeps them apart:

- **Evidence** is what a source declared, recorded as it was found, with who said it and where it was read. A later import never overwrites an earlier record.
- **Obligation** is what the reviewed rules make of that evidence for one use, one delivery route and one audience. Sharing conditions stay conditional while you are working privately.
- **Delivery** is what the finished bytes actually carry, measured by reading them back. Lolly says credits are included only after a reader has found them in the delivered file.

## Where you meet this first

The emoji sets are the everyday case. Twemoji is CC BY 4.0, so a heading with an emoji in it exports with the artwork credited and nothing left for you to do. Both OpenMoji sets are CC BY-SA 4.0, so recolouring one of their glyphs with a brand treatment is an adaptation, and sharing that adaptation asks you to pick a compatible licence once. Choosing the set is never blocked, and the set control shows the licence where you choose it. The same rules answer for a catalog illustration, a LUT, a font and any other recorded work.

## The words Lolly uses

One vocabulary across the export panel, Verify, the command line and the machine result.

| What you see | What it means |
|---|---|
| Source credits will be included. | The credit is prepared and the route can carry it. Nothing has been written yet, so this is not a success message. |
| Credits included in this file's metadata. | The delivered bytes were read back, the credential verified and every required source was found in it. |
| Credits and credentials are in the download package. | The credit travels as a companion file beside the artifact. Keep them together when you pass them on. |
| Add this credit to the post description. | The chosen route carries neither a credential nor a readable credit, so the credit text is yours to paste. |
| If you share this adaptation, it needs a compatible licence. | A ShareAlike source was changed and the result is headed somewhere other than private use. Choosing is one action, not a dialog per placement. |
| Source licence not recorded. | Nothing was recorded for this source. That is a gap to fill, not a finding against the work. |
| Conditions recorded, not yet interpreted. | The identifier is recognised and its conditions are listed, and no rule here reads them. No automatic pass, no automatic ban. |
| Two licence declarations disagree. | Two records name different licences and nothing has selected which grant applies. |
| No required credit under the recorded CC0 dedication. | The dedication asks for nothing. A courtesy credit is offered anyway. |
| The credits are not in the file that was delivered. | A credit was promised, the readback did not find it and the file is still yours. Export again, or use the credit text by hand. |

Lolly does not use "copyright verified", "legally safe", "fully cleared" or "rights cleared", and there is no single green licence badge anywhere in the product. Those words would claim something no program can check.

## The licences Lolly has reviewed

Rules version `rights-rules-2026-09-13.2`. Each rule below was read from the licence's own legal text, and the section it came from is cited beside it in `engine/src/rights-profiles.ts` as well as here. A version and a port are kept as recorded: a CC BY 3.0 declaration keeps its own version rather than being reported as 4.0 because the app's chooser prefers 4.0.

| Licence | What it asks of a use Lolly can make | Read from |
|---|---|---|
| CC BY 4.0 | The creator, the title, the copyright notice, the licence name and link, the source link and an indication of changes, each one when the source supplied it. No use is excluded, commercial use included. | [Legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en), sections 2(a)(1) and 3(a) |
| CC BY-SA 4.0 | The same credit. In addition, if you share an adaptation, it goes out under a compatible licence: CC BY-SA 4.0, the Free Art License 1.3 or GPL-3.0-or-later, which runs one way only. Those three are carried as data from the Creative Commons list, never matched by name. | [Legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), sections 3(a) and 3(b); the [compatible-licences list](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Nothing. The dedication carries no condition, so Lolly offers a courtesy credit and never presents one as required. | [The dedication](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), sections 2 and 3; the [CC FAQ](https://creativecommons.org/faq/) on crediting |
| CC-PDDC | Nothing. What is recorded is the assertion itself and who made it, because a certification is one party's statement rather than proof. | [The dedication and certification](https://creativecommons.org/licenses/publicdomain/) paragraphs |
| Apache License 2.0 | The notices from the source and the NOTICE file's attribution text travel with a distributed work. A runtime use asks nothing. A licence that asks for a notice text and a work that carries none is reported as a gap. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), section 4, conditions 1 to 4 |
| MIT | The copyright line and the permission notice travel with copies and substantial portions. Runtime and reference uses ask nothing. | [MIT](https://opensource.org/license/mit), the permission-notice condition |
| SIL OFL 1.1 | Rendering text with the font asks nothing of the text. Passing the font file on carries the licence, the copyright notice and the reserved-name rule. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), conditions 2, 3 and 5; the [OFL FAQ](https://openfontlicense.org/ofl-faq/) on documents |

### Recorded, not interpreted

CC BY-NC, CC BY-ND and the NC-SA and NC-ND combinations are recognised, their conditions are listed and no rule here reads them. They report `licence.unknown` with a line naming the conditions. A commercial context cannot be read off a price or an account, and each combined text needs its own review before a rule touches it.

Three more honest answers, none of which is permission:

- A `LicenseRef-` identifier comes back as itself. It points at a stored definition and is never proprietary by spelling.
- A declaration nothing recognises comes back unparsed, with the original text kept beside it.
- `A OR B` is a choice the rights holder offered, so every alternative is returned and none is selected. `A AND B` is cumulative, and these rules record it rather than reading two profiles together.

Missing licence information is never read as evidence that a work is free to pass on.

## What Lolly does for you

- **In the catalog.** A work's sheet shows its source and creator, the canonical licence name with the original label kept underneath, a copyable credit where one is recorded and one line saying what using it asks for. A tile states the requirement; it never claims an export was completed.
- **In the export panel.** A Source credits card appears inside Content protection once a render uses recorded work, beside the Licence you choose for your own export. It shows the state, the credit text behind Details, a Copy credit button and an inline card when a decision is owed. A decision is never a blocking dialog: a download that has an action left proceeds, and private work stays usable.
- **In the file.** An export that placed recorded work writes one Content Credentials source ingredient per distinct work, bound to the original bytes at their public address, carrying the creator, the licence and its link, the source, the revision and the changes. Lolly signs what it observed. It never signs a claim on the upstream artist's behalf, and Verify says which of the two happened.
- **After writing.** The delivered bytes are read back before anything says credits are included. A credential that did not verify does not count as a credit delivered.
- **In an editable `.lolly` file.** Bytes travel only when a reviewed licence records permission to pass the source on, and the pack's `CREDITS.txt` lists what travelled, under which licence and what was held back with the reason. An unrecorded licence is held back. You can still include held-back content deliberately, and the credits file records that it was your choice.
- **In Verify.** A Sources panel lists every source a file records, with a computed summary, the credit, a Copy credit button, an Open source link that is opened only on request and the stated limits of what was inspected. A Check for this use question is asked only when you pick a use, and nothing is fetched to answer it.
- **When you remove metadata.** Stripping tells you how many source credits the file no longer carries, offers the credit text and offers a clean file with the credits beside it. Stripped bytes are never restamped.

## What stays yours

- **Your licence choice is yours.** Claiming a file separates three states that used to be one: no public licence declared, an explicit all-rights-reserved notice and an actual public licence grant. Lolly writes a rights line only for the last two, and never from your profile.
- **Your work is not relicensed for you.** A source's terms and your own output declaration are separate records. A ShareAlike condition applies to the adaptation it governs, not automatically to everything else you made.
- **Private work stays usable.** Conditions that apply on sharing are raised when sharing is in view. Nothing here turns into an import ban, and no licensing questionnaire stands between you and your own files.
- **A decision is remembered against its own facts.** Every choice you record is stamped with a fingerprint of the works, uses, route and audience it was made about. Change the set, the treatment, the format or the audience and the question is asked again. There is no blanket "ignore licences" switch, because clicking a warning away cannot deliver a credit or grant a permission.
- **Your details stay separate from a third party's credit.** Removing your own personal metadata does not remove a credited artist, and a required credit is never an excuse to export your contact details.

## On the command line

A render prints a `Rights:` block to standard error when the evaluation has a required credit or an issue. It carries the status, one line per issue as `code - summary`, what the delivered file was read back as and the credit text to paste.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Those two statements are independent, which is the point of keeping them apart: the credit is in the file, and a licence decision is still owed before the file is shared. The file is written either way.

| Status | Meaning | Exit |
|---|---|---|
| `ready` | Nothing is waiting on a person. | 0 |
| `actions-required` | A decision remains before the file is shared. The file is still written. | 4 |
| `use-not-covered` | A reviewed rule says the licence does not cover this use. | 4 |
| `unknown` | The only issues are gaps: a licence that was not recorded, or conditions that are not interpreted. | 0 |
| `delivery-failed` | Set by a receipt, never by an evaluation: a promised credit was not found in the delivered bytes. The export panel shows it; the CLI reports the same fact in its readback line instead. | not printed |

Exit 4 is the code this CLI already gives a protective check that said no. It is deliberately not 3, which means "retry on another runner", and a licence decision will be waiting on every runner there is.

`--rights=private` states that this render is not being delivered to anyone. The block still prints and the credit is still there to copy; what stands down is the condition that applies on sharing, and no delivery claim is recorded. There is no flag for ignoring a condition: `--rights=ignore` is a usage error.

The issue codes are stable and machine-readable, independent of the translated copy:

`attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Over MCP, `lolly_verify` returns a `rights` payload with the summary, one row per recorded source and the stated limits; a browser-free `lolly_render` returns `status`, `issues`, `credits`, `fingerprint` and a `creditsInFile` flag that is measured by reading the bytes back.

## Where the rules live

Four engine modules, all pure: no network, no clock, no filesystem. The rule data is versioned and in the repository, never fetched.

| Module | What it holds |
|---|---|
| `engine/src/rights-profiles.ts` | The identifier table, the minimal SPDX expression reader, the reviewed profiles with their citations and the one rule for a link a credit may print. |
| `engine/src/rights-evaluate.ts` | Classification, issues, the attribution plan and the fingerprint. Deterministic: the same facts in a different order give the same answer. |
| `engine/src/rights-attribution.ts` | Readable credits, the companion files, the source ingredients and the receipt measured after writing. |
| `engine/src/rights-report.ts` | A verified credential read back as the three questions Verify asks. |

The expectation files in `tests/fixtures/rights/` were authored from the licence texts rather than from the evaluator's output, and its README cites the section behind each expectation.

## What this does not do

Stated plainly, because a gap that is not named reads as a promise.

- **NC and ND are not interpreted.** Their conditions are recorded and reported as unknown.
- **No destination is confirmed.** Lolly prepares a caption; a connector accepting a request is not proof that a credit reached a reader, and nothing here promises that a later upload, screenshot or transcode preserves hidden metadata.
- **Native metadata credit fields are not written from the plan.** Credits travel in Content Credentials and in readable text. The IPTC and XMP per-source credit fields are not filled from the attribution plan yet.
- **Corrections and withdrawal are not built.** Adding a missing creator or a local correction to a recorded work, and withdrawing a record, have no interface.
- **Connected providers are not built.** Purchased stock, a custom permission and a provider account have no import path, so their grants can only be recorded as your own statement.
- **Organisation policy is not composed with these results.** Export policy and licence conditions are separate today, and an organisation approval is not permission from a rights holder.
- **Several delivery routes are not yet on this path.** Downloading a catalog original, a bulk ZIP, a derived download, Send and Copy image do not evaluate or carry these credits yet.
