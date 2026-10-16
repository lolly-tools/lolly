# Diagram fixtures

Six recorded diagrams for `community/diagram-builder`. Each file pairs a source with the census a reader expects from it, and `tests/diagram-builder-fixtures.test.ts` checks that the census and the direction survive four steps: the shipping parser, the render, a link written from the rendered state, and a saved session reopened from JSON.

| File | Source | What it covers |
| --- | --- | --- |
| `branch-return.json` | Mermaid flowchart | A decision with two labelled branches and a link back to an earlier step |
| `dense-architecture.json` | DOT with clusters | Twenty cards in four groups and twenty-four links, including undirected and two-way links |
| `dated-roadmap.json` | Visual cards | Dated Gantt bars in three lanes, a milestone and dependency links |
| `repeated-messages.json` | Mermaid sequenceDiagram | Eight ordered messages, with repeats between the same two participants |
| `long-multilingual.json` | Tab-separated table | Long labels in ten languages and eight scripts, decomposed accents, right-to-left text and an emoji sequence |
| `sparse-legacy-url.json` | A shared link | Compact rows with trailing fields left out, opened by the Legacy renderer |

## File format

- `id`, `title`, `purpose`: the file name without `.json`, a short title and what the fixture is for.
- `inputs` or `url`: the tool inputs, or a literal query string read the way a shell reads a link. A fixture has one or the other.
- `source` (optional): the source record when the census merges source items. `repeated-messages.json` lists each message here, and the census says which connection carries each message.
- `census.look` (optional): the look the diagram must open with, such as `legacy`.
- `census.diagramType` and `census.direction`: the type the source resolves to, and `right`, `down` or `chronological`.
- `census.nodes`: canonical id, label and the fields that matter for the type: `detail`, `shape`, `group`, `parent`, `start`, `end`, `milestone` and `rtl`. `source` records the id as the source spells it when the tool makes it canonical, for example `users_db` becoming `users-db`.
- `census.edges`: `from`, `to` and `label` in source order, plus `style` when not solid, `heads` (`end`, `none` or `both`, default `end`) and `kind` (`forward` or `return`) when the layout direction can be checked.
- `census.groups`: id, label and members in order.
- `features`: what the tool supports, what it simplifies, and `unsupported`, the exact lines the parser reports as skipped.

## Rules

- Write the census from the source text. Generating it from the parser would hide a parser change that loses content.
- Keep the content neutral and redistributable: no brand names, brand assets, asset references or personal data, so every fixture works on the `lolly-start` profile.
- Never edit `sparse-legacy-url.json`'s `url`. Its rows are positional, and the string pins the wire order of the card and connection fields. Add another fixture for a new case.
- Combining marks and joiners are written as `\u` escapes so the difference stays visible in review.
- `repeated-messages.json` records the current Mermaid sequence import, which merges messages between the same two participants. Keep it until a caller opts into a sequence layout.

Run:

```sh
node --test tests/diagram-builder-fixtures.test.ts
```
