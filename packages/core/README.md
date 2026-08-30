# @lolly-tools/core

**The contract for building a [Lolly](https://lolly.tools) tool - without cloning the platform.**

```bash
npm i -D @lolly-tools/core
```

A Lolly tool is **data, not bundled code**: a `tool.json` manifest, a Handlebars
`template.html`, optional `styles.css`, and an optional `hooks.js`. The same tool
runs unchanged in every Lolly shell (web PWA, Tauri desktop/mobile, CLI) because it
only ever talks to the host through one versioned interface - the **capability
bridge**, `HostV1`.

This package is that interface, plus the tooling to author and check a tool against
it:

| Export | What it gives you |
| --- | --- |
| **types** (`HostV1`, `ToolManifest`, …) | Type-check your `hooks.js` and `tool.json`. |
| `validateTool(manifest)` | Validate a manifest against the authoritative JSON Schema - the exact check Lolly's catalog CI and every shell run. |
| `createMockHost(opts)` | An in-memory `HostV1` to unit-test your hooks headlessly (no DOM, FS, or network). |
| `defineTool()` / `defineHooks()` | Identity helpers for editor autocomplete + type-checking while you author. |
| `@lolly-tools/core/schema/tool.schema.json` | The manifest schema, bundled for offline validation. |

It depends only on [`ajv`](https://ajv.js.org/) - no DOM library, framework, or
platform code. It knows nothing about storage or networking; all of that is
injected by the host at runtime.

## Quickstart

A whole tool is four files in a folder. Here is the smallest useful one.

`tool.json` - inputs are declared here, never inferred from the template:

```json
{
  "id": "hello-badge",
  "name": "Hello Badge",
  "version": "1.0.0",
  "engineVersion": "1.0.0",
  "status": "community",
  "render": { "width": 600, "height": 400, "formats": ["svg", "png"] },
  "inputs": [{ "id": "name", "type": "text", "label": "Name", "default": "Ada Lovelace" }],
  "hooks": { "onInit": true }
}
```

`hooks.js` - the escape hatch when the logic-less template is not enough. It is
tool **data**, not a module: bare function declarations, no imports, no exports.
The runtime injects `host` and collects the hooks by name. A hook returns a plain
object; keys matching a declared input `id` update it, anything else becomes an
extra the template uses directly as `{{initials}}`:

```js
function onInit(ctx) {
  var name = '';
  for (var i = 0; i < ctx.model.length; i++) if (ctx.model[i].id === 'name') name = ctx.model[i].value;
  host.log('info', 'badge for ' + name);
  return { initials: String(name).split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() };
}
```

`template.html` is Handlebars: `<svg …><text>{{initials}}</text></svg>`.

Now test it with no browser. `createMockHost` implements the required bridge
surface in memory and records what your tool did. Load the hook the way the
runtime does - inject `host`, take the function by name:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMockHost, validateTool } from '@lolly-tools/core';
import manifest from './tool.json' with { type: 'json' };

test('manifest is valid and onInit derives initials', () => {
  assert.equal(validateTool(manifest).valid, true);
  const host = createMockHost();
  const src = readFileSync(new URL('./hooks.js', import.meta.url), 'utf8');
  const { onInit } = new Function('host', `${src}\nreturn { onInit };`)(host);
  assert.equal(onInit({ model: [{ id: 'name', value: 'Ada Lovelace' }] }).initials, 'AL');
  assert.equal(host.inspect.logs.at(-1)?.level, 'info');
});
```

To see it render, zip the tool folder and drop the zip on
[lolly.tools](https://lolly.tools).

## Authoring with types

`defineTool` and `defineHooks` are identity functions that give you autocomplete
and type-checking while you write. `hooks.js` ships as tool **data**, so author in
TypeScript if you like but ship plain `.js`.

```ts
import { defineHooks } from '@lolly-tools/core';

export default defineHooks({
  onInit({ model, host }) {
    /* `model` and `host` are fully typed here */
  },
});
```

The optional capabilities (`net`, `tokens`, `text`, `pdf`, `capture`, `compose`,
`audio`, `media`, `recorder`) are absent on the mock by default, so a hook that
feature-detects one (`if (host.pdf) …`) sees it as unavailable. Assign your own
stub to the returned host to exercise those paths.

## Versioning

The bridge follows the rule in `HostV1`: methods may be **added** in a minor
version, never removed or signature-changed without a major bump. Your manifest's
`engineVersion` is the minimum contract minor your tool needs; a shell refuses to
load a tool that asks for more than it implements.

**Compatibility:** `HostV1` contract version `1` (`CONTRACT_VERSION`), built
against Lolly engine 1.157.0 and shipped alongside Lolly 1.0.1. This package
keeps its own semver: it moves when the tool-author surface moves, not when the
app releases.

## License

MPL-2.0.
