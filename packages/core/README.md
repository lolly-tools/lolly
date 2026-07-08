# @lolly-tools/core

**The contract for building a [Lolly](https://lolly.tools) tool — without cloning the platform.**

A Lolly tool is **data, not bundled code**: a `tool.json` manifest, a Handlebars
`template.html`, optional `styles.css`, and an optional `hooks.js`. The same tool
runs unchanged in every Lolly shell (web PWA, Tauri desktop/mobile, CLI) because it
only ever talks to the host through one versioned interface — the **capability
bridge**, `HostV1`.

This package is that interface, plus the tooling to author and check a tool against
it:

| Export | What it gives you |
| --- | --- |
| **types** (`HostV1`, `ToolManifest`, …) | Type-check your `hooks.js` and `tool.json`. |
| `validateTool(manifest)` | Validate a manifest against the authoritative JSON Schema — the exact check Lolly's catalog CI and every shell run. |
| `createMockHost(opts)` | An in-memory `HostV1` to unit-test your hooks headlessly (no DOM, FS, or network). |
| `defineTool()` / `defineHooks()` | Identity helpers for editor autocomplete + type-checking while you author. |
| `@lolly-tools/core/schema/tool.schema.json` | The manifest schema, bundled for offline validation. |

It depends only on [`ajv`](https://ajv.js.org/) — no DOM library, framework, or
platform code. It knows nothing about SUSE, storage, or networking; all of that is
injected by the host at runtime.

## Install

```bash
npm install --save-dev @lolly-tools/core
```

## Anatomy of a tool

```
my-tool/
├── tool.json        # manifest (validated against the schema)
├── template.html    # Handlebars markup for the canvas
├── styles.css       # optional — auto-scoped to the tool canvas
└── hooks.js         # optional — imperative escape hatch (only if the manifest declares it)
```

Inputs are **declared in the manifest, not inferred from the template**, and every
input is expressible as a URL param — that is what lets one render path serve the
GUI and the CLI identically.

## Author a manifest with type-checking

```ts
import { defineTool, validateTool } from '@lolly-tools/core';

export const manifest = defineTool({
  id: 'hello-badge',            // permanent contract — never rename or reuse
  name: 'Hello Badge',
  version: '1.0.0',
  engineVersion: '1.0.0',       // minimum HostV1 minor your tool needs
  status: 'community',
  render: { width: 600, height: 400, formats: ['svg', 'png'] },
  inputs: [
    { id: 'name', type: 'text', label: 'Name', default: 'Ada Lovelace' },
    { id: 'bg', type: 'color', label: 'Background', default: '#30ba78' },
  ],
  hooks: { onInit: true },
});

const { valid, errors } = validateTool(manifest);
if (!valid) throw new Error(errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
```

## Write typed hooks

Hooks return a plain object: keys matching a declared input `id` update that input;
any other key becomes a computed **extra** the template can reference directly.

```ts
import { defineHooks } from '@lolly-tools/core';

export default defineHooks({
  onInit({ model, host }) {
    const name = String(model.find((m) => m.id === 'name')?.value ?? '');
    host.log('info', `rendering badge for ${name}`);
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return { initials }; // no input has id "initials" → exposed as {{initials}}
  },
});
```

> `hooks.js` ships as tool **data** (it is not compiled into the app). Authoring it
> in TypeScript with `defineHooks` is a convenience for your own editor; ship the
> compiled/plain `.js`.

## Test hooks against a mock host

`createMockHost` implements the required bridge surface in memory and records what
your tool did, so you can assert on it without a browser.

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockHost } from '@lolly-tools/core';
import hooks from './hooks.js';

test('onInit derives initials and logs', async () => {
  const host = createMockHost({ profile: { firstname: 'Ada' } });
  const patch = await hooks.onInit({
    model: [{ id: 'name', value: 'Ada Lovelace' }],
    host,
  });
  assert.equal(patch.initials, 'AL');
  assert.equal(host.inspect.logs.at(-1)?.level, 'info');
});
```

The optional capabilities (`net`, `tokens`, `text`, `pdf`, `capture`, `compose`,
`media`, `recorder`) are absent on the mock by default — a hook that feature-detects
one (`if (host.pdf) …`) sees it as unavailable. Assign your own stub to the returned
host to exercise those paths.

## Versioning

The bridge follows the rule in `HostV1`: methods may be **added** in a minor
version, never removed or signature-changed without a major bump. Your manifest's
`engineVersion` is the minimum contract minor your tool needs; a shell refuses to
load a tool that asks for more than it implements.

## License

MPL-2.0.
