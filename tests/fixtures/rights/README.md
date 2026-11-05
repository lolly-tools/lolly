# Rights expectation fixtures (plan 253)

Each `*.json` file here is one hand-authored expectation for
`evaluateCreativeUses` in `engine/src/rights-evaluate.ts`. They were written
from the primary licence texts cited below, not from the evaluator's output, so
a rule change that alters an answer has to be argued against the citation
before the file moves.

A file holds:

| Key | Meaning |
|---|---|
| `name` | The file's own name, so a failure names itself. |
| `title` | The case in one sentence. |
| `citations` | The exact section of the legal code or the plan that justifies the expectation. |
| `input` | `works`, `uses`, `context` and optional `decisions` and `details`, exactly as `evaluateCreativeUses` takes them. |
| `expect` | `status`, sorted `issues` codes, one row per evaluated use, the required and optional notices with their exact credit lines, the delivery `channels`, the `changes` summary and the `unresolved` list. |

Nothing here is a legal determination. The evaluator applies reviewed,
versioned rules to recorded facts and names the rule that produced each answer;
a person still decides what to do with the result.

## Sources for the expectations

- **CC BY 4.0**: <https://creativecommons.org/licenses/by/4.0/legalcode.en>.
  Section 3(a)(1) lists the credit parts to retain when the licensor supplied
  them: the creator identification, a copyright notice, a notice referring to
  the licence, a notice referring to the warranty disclaimer, and a URI for the
  material. Section 3(a)(1)(B) asks for an indication that the material was
  modified. Section 2(a)(1) permits reproduction and adapted material for any
  purpose, so the profile forbids no use and adds no ShareAlike step.
  Two of those parts are worth stating plainly. The warranty-disclaimer notice
  is retained IF SUPPLIED, and `RightsEvidenceV1.notices` is where a supplied one
  is recorded: a recorded notice travels in the credits, and a work that carries
  none raises nothing, which is why CC BY's `noticeRequired` is false and its
  `retainSuppliedNotices` is true. And section 3(a)(1) qualifies the whole
  condition as "in any reasonable manner requested by the Licensor", which is why
  a `details` entry's `attribution` sentence identifies the creator in the credit
  when the source asked for particular words.
  Used by `by-unchanged-placed`, `by-recoloured`, `clipboard-delivery-missing`,
  `package-route`, `grant-conflict`, `work-grant-resolves-conflict`,
  `missing-evidence-beside-parsed` and `requested-attribution`.
- **CC BY-SA 4.0**: <https://creativecommons.org/licenses/by-sa/4.0/legalcode.en>.
  Section 3(a) repeats the BY credit. Section 3(b)(1) adds the adapter licence
  condition, which applies to Adapted Material that is shared, so a private
  adaptation raises nothing. Section 1(a) defines Adapted Material and states
  that where the licensed material is a musical work, performance or sound
  recording, adapted material is always produced where it is synched in timed
  relation with a moving image.
  The compatible adapter licences are carried as data from the published list of
  BY-SA Compatible Licenses at
  <https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/>,
  which names two: the Free Art License 1.3, approved 2014-10-21, and the GNU GPL
  version 3, approved 2015-10-08, whose compatibility runs one way only. Both
  sit beside the same-elements later-version rule from section 3(b)(1).
  Used by `by-sa-unchanged`, `by-sa-recoloured-private`,
  `by-sa-recoloured-shared`, `by-sa-recoloured-decided`, `by-sa-synchronised`
  and `requested-attribution`.
- **CC FAQ on collections**: <https://creativecommons.org/faq/>. An unchanged
  work included alongside others is a collection rather than adapted material,
  which is the `collection-component` classification. Its limit is written into
  the rule's own doc comment rather than left implied: it holds for a work
  reproduced whole, unchanged and still separable inside the composition, and a
  caller that composites a work INTO a new single work should pass
  `classification: 'undetermined'` or `'adaptation'` on the use, which the
  caution ordering keeps. The live FAQ page is script-rendered and could not be
  quoted verbatim here, so this citation is a pointer rather than a quotation.
- **CC0 1.0**: <https://creativecommons.org/publicdomain/zero/1.0/legalcode.en>.
  Section 2 waives the affirmer's rights without conditions and section 3 is a
  fallback licence with none either. The CC FAQ on crediting CC0 material asks
  for a credit as a courtesy. Used by `cc0-courtesy`.
- **Apache License 2.0**: <https://www.apache.org/licenses/LICENSE-2.0>.
  Section 4 conditions a redistribution on giving recipients the licence (4.1),
  marking changed files (4.2), keeping the source's notices (4.3) and carrying
  the NOTICE text in the derivative work (4.4). A work whose NOTICE text was
  never recorded therefore has nothing to put in the file, which is a gap and not
  a delivery. Used by `apache-recoloured` and `apache-no-notice`.
- **SIL Open Font License 1.1**:
  <https://openfontlicense.org/open-font-license-official-text/> and the FAQ at
  <https://openfontlicense.org/ofl-faq/>. The permission block covers the Font
  Software; condition 2 asks a redistributed copy to carry the licence and the
  copyright notice; condition 3 is the Reserved Font Name rule. FAQ question
  1.4 states that documents rendered with the font are not affected. Used by
  `ofl-font-runtime` and `ofl-font-in-package`.
- **MIT**: <https://opensource.org/license/mit>. The one condition asks that the
  copyright notice and the permission notice be included in all copies or
  substantial portions, so a work recording neither is a gap. Used by
  `mit-no-notice`.
- **CC BY-NC 4.0**: <https://creativecommons.org/licenses/by-nc/4.0/legalcode.en>.
  Section 2(a)(1) limits the grant to NonCommercial purposes. This rules
  version records the conditions and interprets none of them, so the expected
  answer is `licence.unknown` with no pass and no ban. Used by
  `nc-recognised-not-reviewed`.
- **SPDX licence expressions**:
  <https://spdx.github.io/spdx-spec/v2.3/SPDX-license-expressions/>. `OR` is a
  choice of grant, `AND` is cumulative, and `LicenseRef-*` points at a stored
  definition, which is data rather than a proprietary declaration. Because `AND`
  is cumulative, these rules record such an expression and interpret none of it:
  reading only its first term would drop the other's conditions, and merging two
  profiles into one synthetic licence is what plan 253 section 3.2 tells us not
  to build. Used by `licenseref-not-proprietary` and `and-expression`.
- **Plan 253** sections 3.2, 4.1, 4.2, 5.1 and 8.2 for the unknown-stays-unknown
  rule, the state vocabulary, when to interrupt, evidence separation and the
  delivery routes. Used by `unknown-licence`, `clipboard-delivery-missing`,
  `package-route` and `grant-conflict`. Section 5.1 on keeping evidence sources
  and status separate is why an evidence record whose status is `missing` is not
  read as a declaration (`missing-evidence-beside-parsed`), section 5.2 on not
  merging contradictory records is why `redistributeSource: 'unknown'` is not
  permission (`source-distribution-unreviewed`), and section 8.3 on the C2PA
  adapter and the readable credits describing the same source revisions is why a
  producer's recorded modifications win over the operation words
  (`requested-attribution`).

The rules version these expectations were written against is
`rights-rules-2026-11-05.1` (`RIGHTS_RULES_VERSION` in
`engine/src/rights-profiles.ts`). Bumping it does not by itself invalidate a
file here; a changed answer does, and then the citation is the thing to argue
with.
