# Move from a hosted render API

This page is for the developer or admin who renders images through Bannerbear or Placid and wants to run that production on a server of their own. A hosted service can stay in place while you test the move, you can move one template at a time, and leaving stays open in both directions.

**Note: Built from public documentation, never run against a live account**

Every adapter on this page comes from each vendor's public documentation and from fixtures built from those docs. None has been run against a real Bannerbear or Placid account. If you hold an account, the [check list](#check-it-on-your-own-account) takes under an hour, and it is the check that counts for your move.

[Lolly and rendering APIs](/info/compare-render-apis.html) compares the services. This page is the how.

## What each source allows

The move follows the same stages as [leaving a DAM](offboarding.md): connect, pin, recreate, compare, run side by side, then cut over. How much carries across depends on what the vendor's API returns.

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Template list | Names, tags, size, preview and the full layer design | Names, tags, size, preview and field names | Names, tags, thumbnail, and layer names and types |
| The design itself | **Imports** as an editable Design document | Rebuilt against a reference | Rebuilt against a reference |
| Size | Given | Given | Not given: a reference render shows the size |
| Image requests | Yes, on `/compat/` | Yes, on `/compat/` | Yes, on `/compat/` |
| Waiting for a result | Sync host, 10 second limit | Sync host, 10 second limit | `create_now` |
| Per-request webhook | The API has none | `webhook_url` | `webhook_success` |
| Dynamic image URLs | Not supported | Not supported | `/u/{uuid}` with its signatures |

## Connect

Read the account, with no Lolly Work server involved. Nothing is written to the account.

```bash
export BANNERBEAR_KEY=...
lw render-api inventory --from bannerbear-v5 --token-env BANNERBEAR_KEY --out ./move
```

`--from` takes `bannerbear-v5`, `bannerbear-v2` or `placid`. The key is read from the environment variable you name, goes only to the vendor's API host, and is never printed. The folder holds:

- `inventory.json`: every template and its layers.
- `coverage.md`: what maps, what does not and why, one table per template.
- `templates/`: each template's raw record. For Bannerbear V5 this holds the design.
- `previews/`: each preview picture. Your key is not sent with these downloads.
- `mappings.draft.json`: a first mapping to review.

## Pin

Keep what you would miss after the account ends. The inventory folder is the start. To keep a real render as a reference, use `sample`, which asks the vendor to render and so **spends credits on your account**. It refuses to run without `--spend-credits`.

```bash
lw render-api sample --from placid --template ospo24ysn --token-env PLACID_KEY \
  --values request.json --out ./move/references --spend-credits
```

`request.json` is the body you would send the vendor. Re-run `inventory` on a cadence while you move, and compare the folders to see what changed upstream.

## Recreate the design

**Bannerbear V5.** The API returns the design, so bring it in:

```bash
lolly import ./move/templates/6EZ9nQX0lzpWwqAgzB.json --output=design.json --mapping=mapping.json
```

You can also open the JSON in [Design Import](/info/design-import.html#bannerbear-templates). Text, rectangles, circles and image containers become editable layers, and the report names everything left out. Check the result against the preview, then make it a tool with [Share with rules](/info/create-a-tool.html). `--mapping` writes the entry below with the final input ids, so prefer it to the draft for this source.

**Bannerbear V2 and Placid.** Their APIs return field names and a preview, not a design, so nothing can import the layout. Rebuild each template as a tool, by hand or with an agent, with the preview in view. Keep one input per field in `coverage.md`.

Tools are the part worth taking time over. A rebuilt tool can use your design system's colours, type and rules, and its inputs can be locked or limited by [policy](governance.md).

## Map the template

A mapping says which tool serves a vendor template, and which input each vendor property fills. Review it like a delivery destination, because it decides what callers can change.

```json
{
  "templates": [
    {
      "source": "placid",
      "template": "ospo24ysn",
      "toolId": "link-card",
      "format": "png",
      "layers": {
        "title": { "text": "heading" },
        "subline": { "text": "body" },
        "img": { "image": "image" }
      },
      "ignore": ["title.text_color"],
      "fixed": { "siteName": "Example" }
    }
  ]
}
```

- **`layers`** gives each layer and property, then the input. Request-level fields use the pseudo layers `$request`, `$template` and `$modifications`, for example `"$modifications": { "width": "width" }`.
- **`ignore`** lists properties you have decided to drop, as `layer.property`.
- **`fixed`** holds inputs this template always sends, whatever the request says.

**A property the mapping does not name is refused by name**, with `422 PROPERTY_NOT_MAPPED` and the list. Nothing a client sends is dropped silently, so a surprise shows up as an error during testing rather than as a wrong image later.

Check a mapping against this instance before you rely on it:

```bash
lw render-api check --mapping mapping.json
```

It reads each tool's effective schema and reports an input that does not exist, an input policy has locked, or a format this deployment cannot make. It exits `2` if any template cannot run.

## Compare before you cut over

Measure a render here against the vendor's reference, with the same [production comparison](renders.md#production-still-checks-and-permitted-repairs) a durable render can use.

```bash
lw render-api compare --from placid --mapping mapping.json --template ospo24ysn \
  --reference ./move/references/ospo24ysn.png --values request.json --regions regions.json
```

- `--values` is the vendor request. It goes through the same mapping as live traffic.
- `--regions` lists areas that matter, each with `id`, `x`, `y`, `width`, `height`, `minSsim` and `maxInkDelta`. A whole-image number can miss a missing caption, so name the areas you care about.
- `--max-changed` and `--tolerance` set the whole-image limits.

The command prints each check and exits `2` when the render differs, naming the region that moved. It renders in the reference's own size and format, and the reference must be a PNG or JPEG of at most 675,000 bytes. A match measures pixels against this reference. It is not an approval of the design.

## Run both, then cut over

The migration API is off by default, and every `/compat/` route then answers `404`. Turn it on in the instance configuration:

```json
{
  "renderApi": {
    "enabled": true,
    "mappingsFile": "/etc/lolly-work/render-api-mappings.json",
    "resultUrls": { "signedDays": 30 }
  }
}
```

Set `LW_RENDER_API_URL_SECRET` as well, for result URLs. Then change the base URL and the token in your client. The request and response shapes stay the same.

| Your client calls | Change the base to |
|---|---|
| `https://api.bannerbear.com/v5/images` | `https://work.example.com/compat/bannerbear/v5/images` |
| `https://sync.api.bannerbear.com/v5/images` | `https://work.example.com/compat/bannerbear/sync/v5/images` |
| `https://api.bannerbear.com/v2/images` | `https://work.example.com/compat/bannerbear/v2/images` |
| `https://sync.api.bannerbear.com/v2/images` | `https://work.example.com/compat/bannerbear/sync/v2/images` |
| `https://api.placid.app/api/rest/images` | `https://work.example.com/compat/placid/api/rest/images` |
| `https://api.placid.app/u/{uuid}` | `https://work.example.com/compat/placid/u/{uuid}` |

Authentication is the same header, `Authorization: Bearer`, carrying a [service token](enterprise-identity.md#service-tokens) with the `render` scope. A person's session is refused. Everything runs as a [durable render](renders.md), so tool visibility, input policy, validation and audit apply, and a locked input is refused at submission with `INPUT_LOCKED`. Every response keeps the vendor's fields and adds a `lolly` member with the record id and render ids.

Move one template at a time, because a template that has no mapping answers `404` here while the vendor keeps serving that template. Send each client to whichever host holds its template, and keep the vendor account until the last one has moved and the references are safe.

## What runs and what is refused

| Request | Here |
|---|---|
| Bannerbear V5 `formats` | One durable render per format under one record. `webp` and `avif` are refused by name |
| Bannerbear V5 `scale`, `dpi`, `quality`, `proxy`, `version` | Map them to an input or list them under `ignore`. `scale: 1` needs neither |
| Bannerbear V5 registered webhooks | `501`: their payload and signature could not be confirmed. Use [`callbackUrl`](renders.md) on a native render |
| Bannerbear V2 `render_pdf` | A second render, polled as `pdf_url`. With `webhook_url` it is refused, because two renders cannot announce themselves as one webhook |
| Placid `transfer` | Refused: use a [delivery destination](delivery.md) |
| Placid `modifications.image_format` | `jpg`, `png` and `auto` work. `webp` is refused by name |
| Placid `modifications.width`, `height`, `dpi` | Map them to an input or list them under `ignore` |
| Anything else on those hosts: animations, videos, PDFs, collections, screenshots, tools, template editing | `501` with the reason |

Formats depend on the deployment: JPG and PDF need the [render worker](configuration.md#render).

## Webhooks

`webhook_url` and `webhook_success` post the vendor's object when the render finishes, through the same durable outbox as native callbacks, with the same retries. A failed render sends the object too, with its failed status.

- List the receiver's origin in `automation.callbacks.allowedOrigins` and set `LW_WEBHOOK_SECRET`. Any other URL is refused with `403 CALLBACK_URL_NOT_ALLOWED`.
- Each post also carries `x-lolly-signature`, `x-lolly-timestamp` and `x-lolly-delivery-id`, so a receiver can start checking them. Neither vendor documents signing for these webhooks, so a receiver that ignores the headers still works.

## Result URLs

Clients built for hosted APIs store a result URL and embed it, so `image_url` and `files` hold signed URLs that need no token. This is a tradeoff, and the opposite of what [job result tokens](automation-api.md#callbacks) do, which moved out of URLs because a URL ends up in logs.

- **The URL is the credential.** Anyone holding it can fetch the file until it expires.
- **It expires.** It works for `resultUrls.signedDays` after the render finished, 30 by default. Polling the record later gives a fresh URL.
- **Deleting the record revokes the URL.** Use `DELETE /compat/requests/:id` with the token that made the record, or as an admin, and Placid's `DELETE /images/{id}` too. A shared cache may hold a file for up to five minutes after that.
- **Revoking a token does not revoke its URLs.** Delete the records as well.
- **`signedDays: 0` turns this off.** Result URLs then need the same bearer token, which suits server-to-server clients.

Output [retention](configuration.md#policy), when configured, also ends a URL: the file then answers `410`.

## Placid's URL API

`GET /compat/placid/u/{uuid}?title[text]=Hello` answers with the image, and the same URL is one render until your design system or catalog changes. Set which service token these renders act as:

```json
{ "renderApi": { "urlApi": { "actAs": "<service token id>" } } }
```

These URLs keep working. If output [retention](configuration.md#policy) removes the file, or the stored file is lost, the next request makes a new render and later requests reuse that one. A failed render answers `502` for a minute, then the next request tries again. These renders run at normal priority, so under load a URL can answer `503` with `Retry-After` while the render finishes.

Existing signed URLs keep working with a host change alone, if you give the template the old private token:

```json
{ "source": "placid", "template": "ospo24ysn", "toolId": "link-card", "format": "png",
  "layers": { "title": { "text": "heading" } },
  "url": { "credentialRef": "PLACID_PRIVATE_TOKEN" } }
```

`credentialRef` is the name of the environment variable. An unsigned URL is refused unless the template sets `"allowUnsigned": true`, because anyone could then make the server render. Placid's example signs a query string starting with `&`, and its documentation does not say whether that character is part of the contract, so both forms verify. A proxy that re-encodes the query will break a signature.

Bannerbear's signed base URLs and Instant URLs are not supported, because their signing could not be confirmed from public documentation.

## Leave Lolly too

Nothing here is one-way.

- **The tools are files.** A manifest, a template and optional hooks in a folder you hold, under the licence you chose for them.
- **The CLI renders them with no server.** `lolly <tool> --heading=Hello --export=png` runs the same engine.
- **The outputs are plain.** PNG, SVG, JPG and PDF, with a JSON [manifest](renders.md#batches-with-durable-rows) for a batch.
- **The mappings and inventories are JSON.** They show what you moved and how it maps, and they read just as well in the other direction.

Your vendor account also stays yours for as long as you keep the account open. Moving some templates and keeping others is a fine place to stop.

## Check it on your own account

If you hold an account, this confirms the adapter for your templates. Use a template you can spare, and note that steps 2 and 4 spend credits.

1. Run `inventory`. Read `coverage.md`: does every layer you use appear, with the type you expect?
2. Run `sample` on one template, then send the same body to `/compat/`. Do the responses have the same fields?
3. For Bannerbear V5, run `lolly import` and open the result. Do positions and sizes match the preview? The docs give no units or paint order, so these are the first things to check.
4. Send a request with a webhook to a receiver you control. Is the body the same shape as the vendor's?
5. For Placid, sign a URL the way your code does, and request it from `/compat/placid/u/`. Does it verify?

Tell us what you find with [an issue](https://github.com/lolly-tools/lolly-work/issues). Please leave out your key, and any customer data in the requests.

## Related

- [Lolly and rendering APIs](/info/compare-render-apis.html)
- [Render jobs and batches](renders.md)
- [Automate with the Work API](automation-api.md)
- [Leave a DAM](offboarding.md)
- [Import a design](/info/design-import.html)

Bannerbear and Placid are trademarks of their owners. This page describes how to move work between products and is not affiliated with either.
