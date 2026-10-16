# Token workflow fixtures

These files are the baseline for design-system token work (plan 286, milestone M0). They hold two synthetic systems with different naming and theme structures, and two pieces of public Tokens Studio material with recorded provenance. The `fixture` cases in `engine/src/token-workflows.test.ts` read every file here and check the coverage table below against the engine. A row and its assertion change together: the last test in that file fails when a case id is missing from either side, or when an upstream file no longer matches its recorded Git blob id.

## Synthetic systems

`larkspur.tokens.json` and `fennwick.tokens.json` are fictional systems written for these tests. They contain no company assets and are covered by the repository licence (MPL-2.0). Both use the single-file Tokens Studio layout that Lolly reads: top-level sets, `$themes` and `$metadata.tokenSetOrder`.

- **Larkspur** uses English kebab-case paths, short readable theme ids and three groups (appearance, density, campaign). Its stored defaults are theme ids. It holds the layering collisions, the gradient and shadow references, a two-member cycle, a missing reference and the DTCG 2025.10 `$ref` and `$extends` examples.
- **Fennwick** uses German labels with non-ASCII letters, spaces in set names, two levels of set folders and 40-character hexadecimal theme ids like those Tokens Studio writes. Its stored defaults use the Penpot `group/name` form. It holds the typography composite, a three-member cycle, competing and duplicate theme entries and a theme that enables a missing set.

## Tokens Studio material

Both items come from the [Tokens Studio for Figma repository](https://github.com/tokens-studio/figma-plugin) at commit `89e49cda6937b96ada2a81c184fefb5a91e99de5` (15 October 2026). They are copyright Jan Six and contributors, under the MIT licence, which is included unchanged as `tokens-studio/LICENSE.tokens-studio` (upstream `LICENSE.md`). The bytes are unchanged; the test recomputes each Git blob id below.

| File | Upstream path | Git blob |
|---|---|---|
| `tokens-studio/LICENSE.tokens-studio` | `LICENSE.md` | `316707f300be33bedf539671ce03abbaffd778b0` |
| `tokens-studio/default-preset.json` | `packages/tokens-studio-for-figma/src/config/default.json` | `dfa0414eec965694dc5d10793bf5f9a5b03eb56a` |
| `tokens-studio/modifier-sync/$metadata.json` | `packages/tokens-studio-for-figma/token-transformer/modifier/$metadata.json` | `dcfd31f053df4587587b1786c22baa7a1436fa33` |
| `tokens-studio/modifier-sync/$themes.json` | `packages/tokens-studio-for-figma/token-transformer/modifier/$themes.json` | `ee28d09a28b07130aae292dcc44f26cc15f525b5` |
| `tokens-studio/modifier-sync/core.json` | `packages/tokens-studio-for-figma/token-transformer/modifier/core.json` | `eff2f2256ad7d84c5533bdc2f000388e3f059038` |
| `tokens-studio/modifier-sync/theme/01-light.json` | `packages/tokens-studio-for-figma/token-transformer/modifier/theme/01-light.json` | `847f7900cd2f6d5e9c266ee0b65b62087ffc0517` |
| `tokens-studio/modifier-sync/theme/02-dark.json` | `packages/tokens-studio-for-figma/token-transformer/modifier/theme/02-dark.json` | `0a7675ee901313f404f8b2cd447b23c391045630` |

- `default-preset.json` is the starter document the plugin loads from its start screen (`src/app/store/models/effects/tokenState/setDefaultTokens.ts`). It was last changed upstream in commit `246098691ff74cc638d8749fed8ac2f146b75e45` (14 August 2026). It uses DTCG `$value` and `$type` keys with Tokens Studio type names and holds four sets: `core`, `light`, `dark` and `theme`. The loader, not the file, marks `core` as a source and enables `light` and `theme`, so case T2 supplies those set states as test data.
- `modifier-sync/` is the token transformer's `modifier` test input, last changed upstream in commit `837a1053c41faf793f1f2eb3005f0aaf21024e5a` (8 October 2023). It has the layout of the plugin's one-file-per-set repository sync: `$metadata.json`, `$themes.json` and one file per set, where a `/` in a set name is a folder. Its tokens use the older `value` and `type` keys. The theme ids and `$figmaStyleReferences` keys match what the plugin writes, but the upstream repository does not record whether the plugin or a person wrote these files.

Neither item is presented as the output of the plugin's export command.

## Coverage table

Reviewed on 17 October 2026 against engine 1.261.0. Each row gives the case, where the fixture holds it, what Lolly does with it today and a status.

| ID | Case | Fixture | Lolly result | Status |
|---|---|---|---|---|
| S1 | Explicit choice by stable theme id in three independent groups | Larkspur | Each group applies its own sets; resolution and inspection agree | Supported |
| S2 | Stored defaults in `$metadata.activeThemes` as theme ids, with one group left unset | Larkspur | Night and Compact apply; the campaign group takes its first option and is listed in `defaults` | Supported |
| S3 | Stored defaults as Penpot-style `group/name` entries, with German labels and 40-character ids | Fennwick | Labels and ids stay as written; Junior applies in Marke; Kontrast takes its first option | Supported |
| S4 | One option name, Standard, in two groups | Larkspur | A legacy `{ theme: 'Standard' }` call applies Standard in both groups; `campaign/Standard` applies only there; theme ids are exact | Supported, legacy rule |
| S5 | A legacy `{ theme }` call on a document with stored defaults | Larkspur | The named option applies and every other group takes its first option; `activeThemes` is not read | Supported, legacy rule |
| S6 | Two stored choices in one group | Fennwick, Erscheinung | A `selection` diagnostic; the option declared first wins, whatever the order in `activeThemes` | Diagnosed |
| S7 | Two themes with one id in a group | Fennwick, Marke | A `selection` diagnostic; selection ignores the second entry, but `themes()` and the compatibility report still list both | Diagnosed |
| S8 | A theme enables a set the document does not contain | Fennwick, Kontrast Hoch | A `selection` diagnostic; the sets that exist still apply | Diagnosed |
| R1 | Set names with `/`, and one token defined in several enabled sets | Larkspur, `action.fill` and `space.unit` | The later set in `tokenSetOrder` wins; inspection lists every candidate with its active state and JSON Pointer | Supported |
| R2 | Alias chains and reverse edges | Larkspur, `button.primary.fill` | Chains resolve through the selected sets; `usedBy` lists direct dependents | Supported |
| R3 | Gradient stops that reference colours | Larkspur, `gradient.horizon` | Stops resolve into a new array; the source keeps its references | Supported |
| R4 | Shadow fields that reference colour and dimension tokens | Larkspur, `elevation.card` | Fields resolve and follow the density choice | Supported |
| R5 | A typography composite whose font family comes from a brand set | Fennwick, `schrift.fließtext` | Fields resolve; switching Marke reports the family as an authored change and the composite as a resolved change | Supported |
| R6 | References to tokens that do not exist | Larkspur `text.muted`, Fennwick `verweis.fehlt` | The alias text stays as the value; inspection reports `missing` | Diagnosed |
| R7 | Two-member and three-member reference cycles | Larkspur `focus`, Fennwick `zyklus` | No exception; values stay as alias text; inspection reports `cycle` on the first member reached | Diagnosed |
| R8 | Unknown vendor extensions, one holding brace text | Larkspur `palette.larkspur`, Fennwick `farbe.moos` | Kept on resolved entries and inspection sources; brace text inside an extension is not a reference; the namespace is listed | Retained |
| R9 | Every object key in reverse order | Both | Selections and every value outside the cycles are unchanged | Supported |
| U1 | Token-level `$ref` with no `$value` (DTCG 2025.10) | Larkspur, `palette.accent` | Not read as a token; inspection reports `unsupported` at its path; compatibility reports `json-pointer` | Diagnosed |
| U2 | `$ref` inside a `$value` | Larkspur, `space.inset` | The value stays as written; compatibility reports `json-pointer`; inspection reports nothing | Gap |
| U3 | Group `$extends` (DTCG 2025.10) | Larkspur, `button.quiet` | Members are not inherited and its own members resolve; inspection reports `unsupported`; compatibility reports `group-inheritance` | Diagnosed |
| C1 | Compatibility report scope with three groups | Larkspur | One row for the stored default and one for each of the six themes on its own; the eight combinations are not checked | Supported, bounded |
| D1 | Resolved object values in the compatibility report | Larkspur, Fennwick | Dimension objects, gradients and shadows count as `unresolved-value`, because the check looks for braces in the serialised value | Defect |
| D2 | Inactive candidates after the keys are reordered | Larkspur `action.fill`, Fennwick `schaltfläche.hintergrund` | Candidates keep source key order, so `diffTokenDocuments` reports an authored change with identical values | Defect |
| D3 | Cycle members after the keys are reordered | Larkspur `focus`, Fennwick `zyklus` | The alias text left in a cycle depends on walk order, so the diff reports resolved changes | Defect |
| T1 | The Tokens Studio default preset as published, with four sets and no `$themes` or `$metadata` | `tokens-studio/default-preset.json` | Classified as plain DTCG and read as one implicit set: paths start with the set name (`core.colors.black`) and aliases between sets stay unresolved | Gap, legacy rule |
| T2 | The same preset with `tokenSetOrder`, first with `$themes: []`, then with one theme matching the plugin start screen | `tokens-studio/default-preset.json` and test data | Classified as Tokens Studio. With no themes every set applies and `dark` wins; with the start-screen theme, `light` and `theme` apply and colour aliases resolve | Supported |
| T3 | Tokens Studio type names: `fontFamilies`, `fontWeights`, `fontSizes`, `lineHeights`, `letterSpacing`, `paragraphSpacing`, `spacing`, `borderRadius`, `borderWidth`, `opacity`, `boxShadow` | `tokens-studio/default-preset.json` | Not mapped to DTCG types; typography composites keep their aliases and report `type` | Gap |
| T4 | Arithmetic (`{dimension.xs} * {dimension.scale}`, `roundTo(...)`) and references inside strings (`rgba({shadows.default}, 0.15)`) | `tokens-studio/default-preset.json` | Kept as written; compatibility counts them as unresolved | Gap |
| T5 | A one-file-per-set folder in the older `value`/`type` format, with ungrouped themes, `$figmaStyleReferences` and a `studio.tokens` modifier | `tokens-studio/modifier-sync/` | Sets, themes and set order assemble and a legacy theme name selects sets, but no token is read and neither report explains why | Gap |

Status key:

- **Supported**: resolves as described.
- **Supported, legacy rule**: existing callers and links depend on this behaviour.
- **Supported, bounded**: works within the limit given in the row.
- **Diagnosed**: not resolved, and at least one report shows the problem.
- **Retained**: kept with the token and not interpreted.
- **Gap**: not read, or read without any report of the problem.
- **Defect**: a wrong result. The assertion records today's behaviour so that a fix changes the row and the assertion together.

## Limits

This is a contract baseline, not a DTCG conformance claim. The rows cover the listed constructs only, through the engine's token modules: `createTokenSet`, `resolveTokenSelection`, `inspectTokenDocument`, `diffTokenDocuments`, `tokenCompatibility` and the brand import containers. URL, session and package transport, rendering, typed input links and the web interface have their own tests and are not repeated here. No case checks every combination of theme choices, and inspection counts cover one token document.

To add a case, add the data to a fixture, add a row with a new id and pass that id to `fixtureTest` in `engine/src/token-workflows.test.ts`.
