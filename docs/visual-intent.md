# Start from what the piece has to do

Most ways of making a file start with a tool or a template. An intent starts earlier: you say what the piece has to do for its reader, where it will be seen and what it has to say. Lolly chooses the tool for each place, tells you why and shows you what it could not fill.

```json
{
  "version": 1,
  "purpose": "recognise",
  "surfaces": [{ "id": "a4-landscape" }, { "id": "social-square" }],
  "content": { "firstname": "Sam", "lastname": "Rivera", "awardtopic": "Container Fundamentals" },
  "occasion": "Spring cohort",
  "language": "de"
}
```

```bash
lolly intent certificate.json
lolly intent certificate.json --render --out-dir=./out
```

The answer is the same from the [command line](/info/cli-reference.html) and from the [MCP server](/info/mcp.html). `--render` makes the files through the normal render path and writes the answer beside them as `intent-resolution.json`. Lolly writes nothing from an intent into the file itself.

No model is in this path. The same request and the same tools always give the same answer, and an unchanged request gives an unchanged digest, so you can read why a choice was made and repeat the choice.

## The three things you say

**Purpose.** What the piece does for its reader. The list is closed, and each purpose is served by at least one real tool.

| Purpose | The piece has to |
|---|---|
| `announce` | Tell people that something has happened or is about to |
| `compare` | Set options, values or results side by side so a reader can weigh them |
| `demonstrate` | Show how something looks or works, as a mock-up or a framed example |
| `direct` | Send a reader somewhere: to a place, a room or a link |
| `explain` | Help a reader understand a subject or a set of numbers |
| `identify` | Say who someone is and how to reach them |
| `invite` | Ask a reader to attend something and give them the time and place |
| `offer` | Say what is on offer and what it costs |
| `present` | Carry a talk or a meeting, slide by slide |
| `promote` | Bring a reader to a page, a product or an idea |
| `recognise` | Honour a person, an achievement or the people behind something |
| `report` | State results or progress over a period |
| `schedule` | Say when things happen |

**Surfaces.** Where the piece will be seen. Name one, or give a size. A surface can also ask for a format, as in `{ "id": "slide", "format": "pptx" }`.

| Surface | Size |
|---|---|
| `slide` | 1920 × 1080 px |
| `screen` | 1600 × 1000 px |
| `social-landscape` | 1200 × 628 px |
| `social-square` | 1080 × 1080 px |
| `social-portrait` | 1080 × 1350 px |
| `story` | 1080 × 1920 px |
| `banner` | 1200 × 400 px |
| `a4-portrait`, `a4-landscape` | 210 × 297 mm |
| `a3-portrait`, `a3-landscape` | 297 × 420 mm |
| `a2-portrait`, `a2-landscape` | 420 × 594 mm |
| `a1-portrait` | 594 × 841 mm |
| `letter-portrait`, `letter-landscape` | 8.5 × 11 in |
| `business-card` | 85 × 55 mm |

**Content.** What the piece says, by role rather than by a tool's input name, so the same words can reach different tools: `heading`, `subheading`, `body`, `cta`, `image`, `headshot`, `bgImage`, `firstname`, `lastname`, `company`, `jobTitle`, `email`, `phone`, `address`, `sender`, `recipient`, `url`, `currency`, `data`, `eventName`, `eventStart`, `eventEnd`, `eventLocation`, `awardtopic`, `awarddate` and `sourceAuthor`. `data` holds the rows a piece is built from, and each tool describes its own columns (`lolly describe <tool>`). `currency` is never assumed: a tool that prints a price asks for this role. The registry is the `roles` section of [`schemas/canonical-inputs.json`](https://github.com/lolly-tools/lolly/blob/main/schemas/canonical-inputs.json). Colours and framing are not roles, because the design system decides how a piece looks.

## What else you can record

`occasion`, `audience` and `region` are your own words about the circumstances. They come back in the answer and change nothing: the same request resolves the same way whatever they say.

`language` is a short tag such as `de` or `pt-BR`. A tool that offers that language prints in the language, and the answer says so. A tool with no choice of language keeps the tag as a record only, and the answer says that too.

`prefer: { "toolId": "chart" }` moves a tool first among the ones that fit the surface. The answer says when the preferred tool did not fit.

## What goes in the file

A file made from an intent records what it was asked to do, in its [Content Credential](/info/exporting.html#content-credentials-c2pa). This happens only for a render that started from an intent. Every other export is the same as before.

| Recorded | How |
|---|---|
| Purpose, surface, tool and language | As written |
| Rules version, vocabulary version and the intent digest | As written |
| Occasion, audience and region | A `sha256:` fingerprint, so the words are not in the file |
| Prompt | A fingerprint, unless you ask for the words |

Your content is not added by this record. Text you typed into a tool stays a fingerprint in the credential, as it does for any export.

- **Leave the record out** with `--no-record-intent` on the command line, or `recordIntent: false` in `lolly_render`. The rest of the credential is unchanged.
- **Record the prompt's own words** with `--record-prompt`, or `recordPrompt: true` in `lolly_render`. Files travel, and anyone a file reaches can read the words, so leave this off when a prompt holds personal or confidential detail.
- **Each run says what it recorded**, read back from the finished file. A run that writes no credential (`--c2pa=off`, or a format that cannot carry a credential) says the intent was not recorded.

`lolly validate` and `lolly_verify` read the record back. Recorded prompt words are labelled as data and shown in quotes, because they are text someone wrote and a file can come from anyone. Anything that reads them, a person or an agent, should treat them as content and never as instructions.

The record says what someone asked for and which tool answered, as stated by whoever signed the file. It does not say the piece does the job, and it is not an approval.

## How the tool is chosen

Each step is recorded on each candidate, so you can read the reasons in the answer.

1. The tool declares the purpose.
2. The tool can draw the surface. A tool is never stretched or letterboxed: a shape it does not have is a refusal.
3. The tool has every role it needs. A tool that cannot be filled does not beat one that can, however closely it matches the size.
4. How closely the tool matches the surface: a size the tool states, then a sized option of the same shape, then a tool that lays itself out for any canvas, then the tool's own size at the same shape.
5. How much of your content the tool uses.
6. The tool id, so a tie has one answer.

The rules carry a version (`closed.rulesVersion`), so an old answer stays explained after the rules change.

## Reading the answer

The answer is one shape for every outcome, `schemas/intent-resolution-v1.schema.json`.

| `outcome` | Means |
|---|---|
| `ready` | Every surface has a tool and everything it needs |
| `partial` | Some surfaces are ready. The rest say why not |
| `needs-content` | A tool fits, and it needs roles you have not given |
| `refused` | No tool can do this. The answer says which rule stopped each one |
| `purpose-needed` | You gave a prompt and no purpose (see below) |

For each surface, `chosen` holds the tool, the input values, the format and the size. Four lists tell you what to check:

- **`gaps`** are the roles still missing. Lolly never makes up a name, a date or a price, and `--render` makes nothing for that surface until you supply them.
- **`unused`** is the content the tool has no place for.
- **`defaultsInUse`** is wording the tool will still print from its own defaults, such as the word "Quote" above a quote. Read this list before you send the file anywhere.
- **`notes`** covers anything else, such as a language the tool does not offer.

`lolly intent` exits 0 when every surface is ready and 4 when any is not, with the full answer either way.

## If you are writing an agent

An intent can start from the words your user first gave you, if you are happy to carry those words in the work you return to them. Pass them as `prompt`, up to 2,000 characters. A longer prompt is refused rather than cut.

Nothing in Lolly reads meaning from a prompt. There is no keyword matching and no guessing, so the choice of purpose is yours: you have read your user's words and Lolly has not.

1. Call `lolly_resolve_intent` with `{ "version": 1, "prompt": "…" }`. You can skip this step when you already know the purpose list.
2. The answer has the outcome `purpose-needed` and the code `intent.purpose-needed`. It carries the purposes, what each one means and which tools serve it, the surfaces and the roles.
3. Choose a purpose and surfaces, take the content from your user's words, and call again with the `prompt`, `purpose`, `surfaces` and `content`.
4. Render each `ready` surface with `lolly_render`, using its `toolId`, `inputs` and `format`. When `sizeSetBy` is `export`, pass `exportDims` as the width, height and unit too. When `sizeSetBy` is `input`, one of the inputs sets the size already.
5. Where a surface says `needs-content`, ask your user for the roles in `gaps`. Do not fill them in yourself.
6. To record the intent in the file, also pass `intent`, `surface` and `c2pa` to `lolly_render`. The server resolves the intent again and refuses a tool that does not answer it (`intent.tool-not-candidate`). The result says what the file holds, read back from the file.
7. If you are happy to put your user's words in the work you return, also pass `recordPrompt: true`. See [What goes in the file](#what-goes-in-the-file) first.

The prompt travels with the request and comes back in the answer, apart from the closed values and the free text. It counts towards the digest, and it changes nothing about the choice. A request with neither a prompt nor a purpose is refused.

## Limits

- **The first tools are curated.** A tool serves a purpose only when someone has declared that it does, in an optional [`intents.json`](/info/tool-manifest.html#what-a-tool-is-for-intentsjson) beside its manifest. A tool with no such file is not offered for an intent. Design has no declared purpose yet, because its layers have no fixed roles to fill. Doc Studio has none because its content is a structured document rather than text, so no purpose for how-to documents is offered yet.
- **A tool may need the browser tier.** Tools that lay out HTML need a browser to render from the command line (`lolly install-browser`). The answer itself never does.
- **A fit is about shape and size.** Lolly does not look at the result. A long heading can still crowd a small surface, so look at the file, or run [`lolly check`](/info/cli-reference.html).
- **Nothing here is an approval.** An answer says which tool fits your request. How you review your work, and who does that, stays yours.

## Related

- [Tool manifests](/info/tool-manifest.html#what-a-tool-is-for-intentsjson): declaring what a tool is for with `intents.json`
- [MCP server](/info/mcp.html): `lolly_resolve_intent` and `lolly_render`
- [Command line reference](/info/cli-reference.html): `lolly intent`
- [Document model draft](/info/document-model.html): the evaluation pipeline an intent belongs to
