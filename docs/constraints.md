# Constraints

Why does a file made with a Lolly tool stay on brand, whoever fills it in? Because a constraint here is a rule the software enforces when it loads a tool and when it renders, not guidance in a style guide. A tool exposes a fixed set of declared inputs, and its template can see exactly those inputs plus whatever the tool's own code computed. This page shows that mechanism, the tests that hold it and the places it stops.

## The manifest declares the inputs

Every tool is a directory with a `tool.json` manifest, validated against `schemas/tool.schema.json` when the catalog is built, when a shell loads the tool and while you author one. Two parts of that schema carry most of the weight:

- The root object requires `id`, `name`, `version`, `engineVersion`, `status`, `render` and `inputs`, and sets `"additionalProperties": false`. A manifest cannot carry a key the schema does not know.
- Each entry in `inputs` requires an `id` and a `type`, and `type` is a closed list of fifteen: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `file`, `table`.

Inputs are declared, never inferred from the template. Reading a manifest tells you everything a person using the tool can change, before you open the template.

The declaration also carries the bounds. A `number` input's `min` and `max` clamp on update, a `text` input's `maxLength` truncates, a `select` closes its option list and a `color` input can point at a `palette` asset to restrict choices to brand swatches, with `swatchesOnly` removing the hex field and the native picker entirely (`schemas/tool.schema.json`, the `color` conditional).

## The template cannot compute

Templates use Handlebars expressions that are logic-less on purpose (`engine/src/template.ts`). The helpers registered there cover text formatting, asset and media references and escaping for sibling data formats. An expression cannot call arbitrary JavaScript or reach page globals. `{{x}}` escapes HTML, and `{{{x}}}` is the opt-in raw form.

![Declared inputs from the manifest and the extras a hook computes are the only two sources of the template context, which renders the file with HTML escaped by default.](/info/diagrams/concepts/template-context.svg)

The context a template is filled with is one assignment in `engine/src/runtime.ts` (search for `ctxCache`):

```js
ctxCache = { ...modelToValues(model), ...extras };
```

Declared input values, then the extras a hook computed. A template that refers to a name in neither renders it empty, because there is no outer scope to reach into.

The data context limits which values Handlebars can resolve. It does not make arbitrary template HTML safe: triple braces insert raw content, and literal HTML or scripts in a template still need review. Markup a hook produces must escape user-controlled text for its destination. The `markdown` helper is different: it escapes input text, builds a limited set of tags and checks URL schemes before returning HTML, and the Markdown cases in [the engine contract suite](https://github.com/lolly-tools/lolly/blob/main/tests/engine.test.ts) cover the helper. Review both the template and its hooks when you publish a tool.

## Brand values resolve from tokens

Colour, type and spacing can bind to the brand's design tokens. `engine/src/tokens.ts` is the engine's single source of truth for token meaning. It parses a W3C DTCG document (the format Penpot and Tokens Studio exchange), resolves `{dotted.path}` aliases including chains, applies `$themes` set layering and converts colours for swatches and bound input values.

Most converted colours become sRGB hex strings; safe named colours and `transparent` can stay CSS keywords, and ordinary unbound input strings pass through. A wide-gamut `oklch()` token is gamut-mapped to reach that hex (an authored sRGB override wins where one is given), while the token itself keeps the notation its author typed.

A colour input can hold a token reference rather than a literal, as `{ ref, value }`. The reference is what travels in a share link, and the template only ever sees the resolved string. So re-pointing a brand token updates every tool that refers to it, and no template has to change. A tool whose colours are its content can declare `tokenAxes` in its manifest to stay in the canonical theme or colourway, whatever a link asks for ([Colourways](/info/colourways.html#tools-that-keep-their-own-colours)).

## One place input semantics live

`engine/src/inputs.ts` builds the runtime input model from the manifest: defaults resolved, profile bindings applied, control chosen. Its header states the rule the architecture depends on: this is the only place input meaning lives, and shells render the model rather than reading manifest declarations themselves.

That is why the same `number` input with a `min`, a `max` and a `step` becomes a slider in the browser, the same clamped number in the CLI and the same value in an MCP call. The engine applies the bounds when values are updated, and shells are expected to render its input model consistently.

## The same closed set in a URL

A tool's URL is not a wider door than its sidebar. `engine/src/url-mode.ts` parses a query string against the tool's own declared inputs and ignores anything it does not recognise. The only parameters that mean something without being inputs are a closed, explicit group, the exported `RESERVED` set in the same file, covering output settings such as `format`, `width`, `height`, `unit`, `dpi`, `profile`, `bleed`, `marks` and the provenance switches ([Reserved URL parameters](/info/url-parameters.html)). The CLI speaks the same vocabulary, because that module converts `--foo=bar` too.

These declarations define what engine URL mode accepts. They do not stop trusted in-realm hooks or literal scripts from reading other query parameters directly; the next section explains why.

## `host.net` reaches only the hosts its manifest lists

`host.net` is the supported, portable way for a tool to fetch, and it fails closed: it needs the `network` capability and an explicit `network.allowlist` in the manifest, and without both every fetch rejects before any I/O happens. `tests/net-allowlist-conformance.test.ts` proves that against the real shared module across shells, which is the drift it exists to catch: a new shell writing its own `host.net` and leaving the check out.

That is a statement about the adapter, not about every line of code a tool can run. Whether a hook can reach around `host.net` depends on how it is executed, and there are two modes (`engine/src/runtime.ts` takes the executor as its `hookExecutor` option; `engine/src/loader.ts` lists the trust levels):

- **Trusted compatibility execution.** First-party catalog hooks can run through `new Function('host', …)` in the shell's realm, where in a browser they can reach `window`, `document` and `fetch`. A trusted tool with `isolate: true` prefers the Worker executor, but may fall back to in-realm execution if the Worker cannot start. Opting into that path does not mean strict confinement.
- **Strict execution for sideloaded and remote tools.** The web mount path picks a Worker executor with in-realm fallback disabled for `sideloaded-consented` and `remote-untrusted` tools. A startup failure refuses the mount, and unsupported in-realm export hooks are refused. The Worker host proxy and global lockdown apply the policy in [hook-worker-core.ts](https://github.com/lolly-tools/lolly/blob/main/engine/src/hook-worker-core.ts). A Worker supplies a separate realm and no page DOM; the proxy and lockdown are extra controls, so a Worker alone is not the whole boundary. The [Threat Model](/info/threat-model.html) states the residual risks.

The selection and refusal paths are exercised by `shells/web/src/bridge/hook-worker.test.ts`, `tests/hook-worker-node.test.ts` and `tests/tool-isolation.test.ts`.

## The receipts

| Claim | Enforced by |
|---|---|
| A malformed manifest is refused | `tests/engine.test.ts` - `validate: rejects manifest missing required fields`, `rejects invalid id format`, `rejects unknown status` |
| A URL param that is not a declared input is dropped | `tests/engine.test.ts` - `url-mode: ignores unknown params (forward-compat)` |
| Declared bounds actually bind | `tests/engine.test.ts` - `inputs: number constraints clamp to min/max on update`, `inputs: text maxLength truncates on update` |
| A template escapes by default and cannot invent values | `tests/engine.test.ts` - `template: escapes HTML by default (XSS guard)`, `template: missing values render empty in if-blocks` |
| A token reference resolves before the template sees it | `tests/tokens-value-path.test.ts` |
| `host.net` fails closed without a capability and an allowlist | `tests/net-allowlist-conformance.test.ts` |
| Strict untrusted execution refuses in-realm fallback; trusted isolation keeps a compatibility fallback | `shells/web/src/bridge/hook-worker.test.ts`, `tests/hook-worker-node.test.ts`, `tests/tool-isolation.test.ts` |
| The shipped catalog matches its manifests | `scripts/validate-catalog.ts`, run as a CI job in `.github/workflows/ci.yml`: duplicate ids, index drift, asset checksums, `bindToProfile` fields, palette references and `replacedBy` chains |
| Every tool still renders at its declared defaults | the catalog-wide render gate in `.github/workflows/ci.yml`, which renders every tool in the active profile and exits non-zero on any failure |

## Check the claim yourself

The whole claim is readable in a few minutes:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
cat community/qr-code/tool.json          # the complete input surface of one tool

pnpm install                              # the contract tests import ajv + handlebars
node --test tests/engine.test.ts         # the validate / inputs / template contract
```

The manifest you just read is the same file the browser fetches, the CLI loads and the catalog validator checks. There is no second, richer configuration hidden elsewhere.

## Limits

- **Constraints bound the person filling in, not the author.** A tool author can write a badly proportioned layout, pick a poor default or expose an input that should have been locked. The engine has no opinion about whether a design is good, only about whether the person using the tool can leave its rules. Authoring quality is a review question, and [Authoring Tools](/info/authoring-tools.html) is where that review starts.
- **Trusted hooks are the escape hatch.** In-realm execution loads `hooks.js` through `new Function` with the host bridge injected, which `engine/src/runtime.ts` describes at the site as closure-scope injection, not isolation. In a browser shell such a hook can reach `window`, `document` and `fetch`, and some shipping tools rely on that access. Async hook results are time-boxed by `HOOK_BUDGET_MS`, a synchronous runaway hook cannot be stopped in-realm, and a manifest may opt into a Worker with `isolate: true` where its hooks touch no DOM globals. Run tools you have reviewed. The [Threat Model](/info/threat-model.html) states this boundary in full.
- **Raw output exists on purpose.** Triple braces bypass Handlebars escaping, so review where that content comes from and where it goes.
- **Size is bounded on the hosted route, not in the app.** The public render route refuses a side over 10,000 px or a DPI over 1,200, and caps a PNG's area at about 4.2 million pixels (2,048 by 2,048), because an unauthenticated request must not be able to ask for a 400 MB raster (`services/mcp/src/render-get.ts`). The web app and the CLI apply no such ceiling: a multi-page PDF or a high-DPI raster is limited by the device's memory, and a request the browser cannot meet fails as an export error rather than a smaller file. Physical sizes convert to pixels at the chosen DPI before any check, so 10,000 mm at 300 DPI is the same request as 118,000 px.
- **A constraint holds inside the tool.** Once a file is exported it is an ordinary PNG, SVG or PDF, and anyone can open it in another program and change its contents. Constraints govern how the file was made, which is also why the export carries a [Content Credential](/info/security.html) recording that.

## Related

- [Determinism](/info/determinism.html): the same declared inputs producing the same render on every shell.
- [Reproducibility](/info/reproducibility.html): those inputs travelling in a link, so the render can be rebuilt later.
- [Sovereign creative production](/info/sovereign-production.html): the same tools and rules as files an organisation holds.
- [Authoring Tools](/info/authoring-tools.html): writing a manifest, a template and hooks against these rules.
