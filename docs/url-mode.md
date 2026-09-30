# URL Mode

Every tool's state is expressible as URL parameters. This means any combination of inputs and export settings can be bookmarked, linked, embedded or piped through automation - with no login, no cookies and no server state.

The CLI uses the same parameter names and the same conversion logic. A URL you build for the web shell runs unchanged as `--flag=value` arguments on the CLI.

---


## Choose a guide

| Task | Guide |
| --- | --- |
| Encode each input type, keyframes and compact values. | [Inputs in URLs](/info/url-inputs.html) |
| Look up export settings, packed links, units, print marks and contact sheets. | [Reserved URL parameters](/info/url-parameters.html) |
| Choose formats, download, copy, size, presentation and saved state. | [Export and presentation URLs](/info/url-export.html) |
| Open app views and use the lolly URL scheme. | [App links and deep links](/info/url-app-links.html) |

## URL structure

```
https://your-host/t/{toolId}?{param}={value}&{param}={value}
```

That path form is canonical - it's what the address bar shows once a tool has loaded, and what Share and the embed URLs build on. The older hash form, `#/tool/{toolId}?…`, still routes and is what a freshly-opened link often arrives as, so the two are interchangeable in everything below.

**Examples:**

```
/#/tool/qr-code?url=https://suse.com&color=%230c322c
/#/tool/qr-code?url=https://suse.com&format=png&export&filename=my-qr
/#/tool/quotes?quote=Open+source+wins.&name=Andy&format=svg&export&full
```

The first of those opens the QR tool with the address and the dark green already applied, no clicks in between.

![A QR code rendered straight from the URL, in the dark green passed as ?color](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26color%3D%25230c322c&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=exp-url-qr-color&try=1)

### Clean URL redirect

If a tool is deployed at a dedicated domain or path, you can use a plain query string and the shell redirects to hash form automatically:

```
https://qr.brand.example.com/?url=https://suse.com
  → redirects to → /#/tool/qr-code?url=https://suse.com
```

---

## Combining parameters

All parameters compose freely. A fully-specified automation URL might look like:

```
/#/tool/qr-code?url=https://suse.com/event&color=%230c322c&background=%23ffffff&ecl=H&padding=4&format=png&export&filename=event-qr&w=600&h=600&full
```

This opens the QR tool, applies all inputs, sets the canvas to 600×600, collapses the sidebar and immediately downloads `event-qr.png`.

The same stacking works on a chart, where inputs, compact keys, canvas size and `full` arrive together:

```
/#/tool/chart?ct=donut&pl=warm&t=Everything+in+one+link&lg=1&lp=right&sv=1&w=1200&h=800&full
```

![A warm-palette donut with a legend on the right and values on every slice, filling the window because the same link also passed full](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Ddonut%26pl%3Dwarm%26t%3DEverything%2520in%2520one%2520link%26lg%3D1%26lp%3Dright%26sv%3D1%26w%3D1200%26h%3D800%26full&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&dark=1&filename=um-combined-stack)

---

## CLI usage

The CLI uses the same param names as URL mode - `--key=value` instead of `?key=value`. `--export=<fmt>` sets the output format and `--output` the destination; all other params are tool inputs. Note that on the CLI `--export` *takes* the format - it is not URL mode's presence flag, which has no CLI equivalent because writing a file **is** the export. (`--format=<fmt>` is accepted as a synonym, but never pass a bare `--export` alongside it: the bare form is read as the format `1` and the render aborts.)

```bash
# Web equivalent: /t/qr-code?url=https://suse.com&format=png&export&filename=my-qr
lolly qr-code --url=https://suse.com --export=png --output=my-qr.png

# Pipe SVG to another tool
lolly qr-code --url=https://suse.com --export=svg > qr.svg

# Print available inputs for a tool
lolly qr-code
```

---

## Integration patterns

### Shareable link

The web shell writes inputs, result settings and supported workspace state to the address bar as they change. Copy that address to bookmark the workspace. Use **Share** to create a content link: the recipient gets the inputs and result settings without your editor selection, viewport, open panels or local session pointer. Explicit false and cleared values survive reopening, and long text is retained rather than silently truncated. See [App links and deep links](/info/url-app-links.html) for the workspace keys and device-local limits.

### Pre-filled embed

Embed the tool in an iframe with inputs pre-filled via URL:

```html
<iframe src="https://brand.example.com/#/tool/qr-code?url=https://suse.com&full"
        width="900" height="700" frameborder="0"></iframe>
```

Embedding a page **into another origin** is off unless the deployment turns it on.
Lolly ships `frame-ancestors 'self'` in its Content-Security-Policy, so a shell
frames inside its own site but not inside someone else's. That is the safer default
for an app holding your documents and offering export actions, since a page you do
not control can otherwise position an invisible frame over its own buttons. Framing
within one origin (your marketing page embedding your own Lolly) needs no change.
To allow another origin, the operator adds it to `frame-ancestors` where the headers
are set (`vercel.json`, or `deploy/docker/security-headers.conf` for the container),
naming the specific origins rather than widening it to every site.

### Tool composition (portable embed URL)

A tool can embed **another tool's** render with no tool-to-tool imports. The URL-mode face of this is a portable embed URL - a real-looking image URL whose query is ordinary URL-mode params:

```html
<img src="https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c">
```

**Nothing is ever fetched from `lolly.tools`.** A shell recognises this exact shape and renders the named tool **locally**, substituting the result (a placeholder pixel shows until the local render resolves). Anything that isn't exactly this grammar is treated as an ordinary image - that strict match is the security boundary.

The path extension is the author's fidelity choice. Compose any tool's render: an SVG child stays a **true vector** when the parent exports to SVG or PDF and rasterises crisply for PNG; raster children (`png`, `jpg`/`jpeg`, `webp`) embed as images. (`pdf` appears in the grammar but is not inlined as a child format.)

This is the URL-mode surface of composition. The declarative form - a manifest `composes: [{ id, tool, inputs, format? }]` block resolved by the engine and placed in the template as `{{asset <id>}}` - is not a URL param; see the authoring guide. Either form requires the tool to declare the `compose` capability. `event-name-badge` composes `qr-code` as SVG today.

### Automation / CI

Call the CLI in a build pipeline to generate assets on demand:

```bash
lolly qr-code \
  --url=https://suse.com/product/${SLUG} \
  --color=#0c322c \
  --export=svg \
  --output=./dist/qr-${SLUG}.svg
```

---
