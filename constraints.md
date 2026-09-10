# Constraints

A constraint in Lolly is a rule the software enforces at load time and render time, rather than guidance a style guide offers an author: a tool exposes a fixed set of declared inputs, and the values its template can see are exactly those inputs plus whatever the tool's own code computed. Nothing else is reachable.

That is what the landing page means by "[it comes out right](/info/index.html)" - a property of the mechanism, not a promise about care. This page is the mechanism, the tests that hold it and the places it stops.

## The manifest declares the inputs

Every tool is a directory with a `tool.json` manifest, and that manifest is validated against `schemas/tool.schema.json` at catalog build time, at shell load time and while authoring. Two lines of that schema carry most of the weight:

- The root object requires `id`, `name`, `version`, `engineVersion`, `status`, `render` and `inputs`, and sets `"additionalProperties": false`. A manifest cannot carry a key the schema does not know about.
- Each entry in `inputs` requires an `id` and a `type`, and `type` is a closed enum of fifteen: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `file`, `table`.

Inputs are declared, never inferred from the template. Reading a tool's manifest tells you the complete surface a person using it can change, before you open the template at all.

The declaration also carries the bounds. A `number` input's `min`/`max` clamp on update, a `text` input's `maxLength` truncates, a `select` closes its option list and a `color` input can name a `palette` asset to restrict choices to brand swatches - with `swatchesOnly` removing the hex field and the native picker entirely (`schemas/tool.schema.json`, the `color` conditional).

## The template cannot compute

Templates are Handlebars and logic-less on purpose (`engine/src/template.ts`). The helper set is registered once at module load and deliberately small: `default`, `upper`, `lower`, `eq`, `icsStamp`, `rfcText`, `csvCell`, `arrow`, `markdown`, `asset` and `media`. There is no way to write a loop with a side effect, call out to the page or invent a value. `{{x}}` HTML-escapes; `{{{x}}}` is the opt-in raw form.

The context a template is hydrated with is one assignment in `engine/src/runtime.ts` (search for `ctxCache`):

```js
ctxCache = { ...modelToValues(model), ...extras };
```

Declared input values, then hook-computed extras. A template that references a name in neither renders empty, because there is no outer scope for it to reach into.

That bounds what a template can *compute*; it does not make every template safe to ship unread. `{{x}}` escapes, but `{{{x}}}` and the `markdown` helper emit whatever they are handed, and many templates use them for markup, JSON inside a `<script>` and style strings that a hook built. The escaping responsibility for that content sits with the hook that produced it (the community `_shared` `esc` helper is the convention), so a review of a tool still reads its raw interpolations and its hooks. What the logic-less template guarantees is narrower, and still worth having: no loop with a side effect, no call out to the page, and no value the template invented for itself.

## Brand values resolve from tokens

Colour, type and spacing come from the brand's design tokens rather than from numbers typed into a template. `engine/src/tokens.ts` is the engine's single source of truth for token semantics: it parses a W3C DTCG document (the format Penpot and Tokens Studio exchange), resolves `{dotted.path}` aliases including chains, applies `$themes` set layering and resolves every colour form to an sRGB hex string for the rest of the app. A wide-gamut `oklch()` token is gamut-mapped to reach that hex (an authored sRGB override wins where one is given), while the token itself keeps the notation its author typed.

A colour input can hold a token reference rather than a literal, as `{ ref, value }`. The reference is what travels in a share link; the template only ever sees the resolved string. So re-pointing a brand token updates every tool that referenced it, and no template has to be edited.

## One place input semantics live

`engine/src/inputs.ts` builds the runtime input model from the manifest: defaults resolved, profile bindings applied, control chosen. Its header states the rule the architecture depends on - this is the only place input semantics live, and shells render the model rather than interpreting manifest declarations themselves.

That is why the same `number` input with a `min`, a `max` and a `step` becomes a slider in the browser, the same clamped number in the CLI and the same value in an MCP call. A shell cannot quietly widen a constraint, because a shell never reads the constraint.

## The same closed set in a URL

A tool's URL is not a wider door than its sidebar. `engine/src/url-mode.ts` parses a query string against the tool's own declared inputs, and anything it does not recognise is ignored rather than guessed at. The one set of names that mean something without being inputs is closed and explicit - the exported `RESERVED` set in `engine/src/url-mode.ts`, covering output concerns such as `format`, `width`, `height`, `unit`, `dpi`, `profile`, `bleed`, `marks` and the provenance switches.

So there is no undocumented parameter that changes what a tool will do. You can read the manifest, read `RESERVED` and know the complete vocabulary a link can speak. The CLI speaks the same one, because `--foo=bar` is converted by that module too.

## `host.net` reaches only the hosts its manifest names

`host.net` is the supported, portable way for a tool to fetch, and it is fail-closed: it is gated by the `network` capability plus an explicit `network.allowlist` in the manifest, and no capability or no allowlist means every fetch rejects before any I/O happens. `tests/net-allowlist-conformance.test.ts` proves that against the real shared module across shells, which is the drift it exists to catch - a new shell writing its own `host.net` and omitting the check.

That is a statement about the adapter, not about every line of code a tool can run. Whether a hook can reach *around* `host.net` depends on how it is executed, and there are two modes (`engine/src/runtime.ts` takes the executor as its `hookExecutor` option; `engine/src/loader.ts` names the trust levels):

- **Trusted, in the shell's realm.** A first-party catalog tool's `hooks.js` runs through `new Function('host', …)` in the page's own realm. That is closure-scope injection for compatibility, not confinement: in a browser such a hook can reach `window`, `document` and `fetch`, and the Limits section below says so plainly. Review is the control for these tools.
- **Strict, in a Worker.** A tool that opts in with `isolate: true`, and every sideloaded or remote tool (the `sideloaded-consented` and `remote-untrusted` trust levels), runs its hooks in a Worker whose `host` is a proxy and whose globals are omitted or seeded by policy - `engine/src/hook-worker-core.ts`, with the web executor in `shells/web/src/bridge/hook-worker.ts` and the Node one in `packages/node-shell/src/hook-worker.ts`; `shells/web/src/bridge/hook-worker.test.ts`, `tests/hook-worker-node.test.ts` and `tests/tool-isolation.test.ts` pin the policy. A Worker is a strong boundary for globals and the DOM, not the whole security story; the [Threat Model](/info/threat-model.html) states that boundary in full.

## The receipts

| Claim | Enforced by |
|---|---|
| A malformed manifest is refused | `tests/engine.test.ts` - `validate: rejects manifest missing required fields`, `rejects invalid id format`, `rejects unknown status` |
| A URL param that is not a declared input is dropped | `tests/engine.test.ts` - `url-mode: ignores unknown params (forward-compat)` |
| Declared bounds actually bind | `tests/engine.test.ts` - `inputs: number constraints clamp to min/max on update`, `inputs: text maxLength truncates on update` |
| A template escapes by default and cannot invent values | `tests/engine.test.ts` - `template: escapes HTML by default (XSS guard)`, `template: missing values render empty in if-blocks` |
| A token reference resolves before the template sees it | `tests/tokens-value-path.test.ts` |
| `host.net` is fail-closed without a capability and an allowlist | `tests/net-allowlist-conformance.test.ts` |
| Isolated, sideloaded and remote tools run their hooks behind the Worker policy | `shells/web/src/bridge/hook-worker.test.ts`, `tests/hook-worker-node.test.ts`, `tests/tool-isolation.test.ts` |
| The shipped catalog matches its manifests | `scripts/validate-catalog.ts`, run as a CI job in `.github/workflows/ci.yml` - duplicate ids, index drift, asset checksums, `bindToProfile` fields, palette references and `replacedBy` chains |
| Every tool still renders at its declared defaults | the catalog-wide render gate in `.github/workflows/ci.yml`, which renders every tool in the active profile and exits non-zero on any failure |

## Check it yourself

The whole claim is readable in a few minutes:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
cat community/qr-code/tool.json          # the complete input surface of one tool

pnpm install                              # the contract tests import ajv + handlebars
node --test tests/engine.test.ts         # the validate / inputs / template contract
```

The manifest you just read is the same file the browser fetches, the CLI loads and the catalog validator checks. There is no second, richer configuration behind it.

## Limits

- **Constraints bound the filler, not the author.** A tool author can write a badly proportioned layout, pick a poor default or expose an input that should have been locked. The engine has no opinion about whether a design is good, only about whether the person using the tool can leave its rules. Authoring quality is a review question, and [Authoring Tools](/info/authoring-tools.html) is where that review starts.
- **Hooks are the escape hatch, and they are trusted code.** A tool declaring `hooks` gets its `hooks.js` loaded through `new Function` with the host bridge injected. `engine/src/runtime.ts` says so at the site: closure-scope injection, not isolation. In a browser shell a hook can reach `window`, `document` and `fetch`, and some shipping tools rely on it. Async hook results are time-boxed by `HOOK_BUDGET_MS`, a synchronous runaway hook cannot be preempted in-realm, and a manifest may opt into a Worker with `isolate: true` where its hooks touch no DOM globals. Run tools you have reviewed. The [Threat Model](/info/threat-model.html) states this boundary in full.
- **Raw output is available on purpose.** `{{{x}}}` and the `markdown` helper emit unescaped HTML by design. An author who pipes an input through triple-stache has opted out of escaping, and tool review is the control that catches it.
- **A constraint holds inside the tool.** Once a file is exported it is an ordinary PNG, SVG or PDF, and anyone can open it in another program and change it. Constraints govern how the file was made, which is also why the export carries a [Content Credential](/info/security.html) recording that.

## Related

- [Determinism](/info/determinism.html) - the same declared inputs producing the same render on every shell.
- [Reproducibility](/info/reproducibility.html) - those inputs travelling in a link, so the render can be rebuilt later.
- [Sovereign creative production](/info/sovereign-production.html) - the same tools and rules as files an organisation holds.
- [Authoring Tools](/info/authoring-tools.html) - writing a manifest, a template and hooks against these rules.
