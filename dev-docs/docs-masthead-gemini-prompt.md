# Masthead prompt for docs pages

A copy-paste prompt that asks an AI model (Gemini, Claude, ChatGPT, …) to generate
a creative, page-specific **docs masthead** - the decorative full-bleed band that
sits behind a `/info` page's `<h1>` - that already conforms to Lolly's masthead
contract and passes the signer's lint on the first try. An art director fills in
just two things (their name and the page URL) and pastes back a single payload.

It encodes the same theme rules and code requirements our shipped mastheads obey:
the **default** chip-field band (`docs/build.ts` → `CHIP_FIELD_JS` /
`DOCS_MASTHEAD_SCRIPT`) and the first **custom** one, the Sensory Mixer on the
inclusive-design page (`docs/mastheads/inclusive-sensory.html`). Read that file -
it is the reference implementation for everything below.

---

## How to use it

1. In the prompt, fill the two lines at the top - YOUR NAME and the page's PUBLIC
   URL (e.g. `https://lolly.tools/info/input-not-impersonation.html`). The model
   reads the page itself and derives the theme; nothing else needs editing.
2. Paste the whole **PROMPT** block into any capable model (Gemini, Claude,
   ChatGPT, …). It replies with ONE copy-paste payload holding both files, split by
   `===== FILE: <id>.html =====` / `===== FILE: <id>.meta.json =====` markers.
3. Split that payload on the markers and save the two files to the bank (the model
   also self-identifies its own model/vendor/region in the meta):
   - `docs/mastheads/«id».html`
   - `docs/mastheads/«id».meta.json`
4. Register the page → masthead mapping in `MASTHEADS` in `docs/build.ts`:
   ```ts
   const MASTHEADS: Record<string, string> = {
     'inclusive-design': 'inclusive-sensory',
     '«page-slug»': '«id»',   // ← add this (id = the URL's last path segment)
   };
   ```
5. Lint + sign (this is what appends the C2PA credential - the model must **not**):
   ```bash
   node scripts/sign-docs-art.ts --check   # lint only, writes nothing (what CI runs)
   node scripts/sign-docs-art.ts           # lint + sign what changed
   ```
   Exit code 1 = a lint or meta violation; nothing is signed in that run. Fix and
   re-run. If it lints clean, it gets a signature appended as an HTML comment.
6. Preview: `npm run dev:web` (rebuilds `/info` in watch) and open the page in
   both light and dark, and with **Reduce Motion** on.

The id is a **permanent contract** once banked - versioned in the manifest, never
in the filename. Several pages may point at one masthead; a masthead may be reused.

---

## PROMPT

> Fill the two top lines (YOUR NAME, PAGE URL), then copy everything inside the
> fence into the model.

```
FILL IN 2 LINES, THEN SEND - nothing else below needs editing:
  YOUR NAME:  ____________________   (the art director directing this; goes in the credential)
  PAGE URL:   ____________________   (e.g. https://lolly.tools/info/trust.html)

You are generating a DECORATIVE MASTHEAD for the documentation page at PAGE URL, on
the Lolly docs site (/info). A masthead is furniture: a full-bleed band that sits
BEHIND the page's <h1>. It is aria-hidden - the <h1> already names the page - so it
must carry the page's *idea* as artwork, not as a title.

FIRST, open PAGE URL and read it in full. Derive its THESIS (the one argument the
page exists to make), its central metaphor/imagery, and its tone - the artwork is
about THAT. The masthead «id» = PAGE URL's last path segment without ".html"
(…/trust.html → "trust"; must match ^[a-z0-9][a-z0-9-]*$).
(Optional: BRAND-HUE STEER - e.g. "lean on --blue" - otherwise choose from the tokens.)

── THEMATIC ADHERENCE (the artwork must MEAN this page) ──────────────────────
The masthead is an ABSTRACT VISUAL METAPHOR for THIS page's thesis - not generic
decoration, not a literal illustration, not a diagram, not reused from another page.
  • Abstract, not literal: evoke the idea through motion, form, composition and
    colour - NOT icons, words, logos, UI, or a stock scene.
  • Meaningful, not arbitrary: a reader who knows the page should feel why this
    artwork belongs to it. State that link explicitly in your comment's concept line
    (e.g. inclusive-design → a calm↔spicy stimulation dial; trust → not this one).
  • Distinct per page: no two Lolly pages share an effect. The node-and-edge
    network mesh is already taken (the 'trust' page) - choose a different form.
  • Restrained: it sits behind a heading someone came to READ. Ambient and calm,
    fully legible under the band's scrims in BOTH themes.

── SELF-IDENTIFY (report yourself truthfully) ────────────────────────────────
Several credential fields describe the MODEL - that is YOU, the model reading this.
This prompt deliberately names NO model or vendor, so there is nothing here to copy:
report ONLY what you actually are. Do NOT reuse any name from anywhere, and never
name a different model than yourself - a wrong name is a FALSE provenance record.
  • generator.name - the product/app you are answering as
  • model.name - your model family
  • model.identifier - your EXACT model id/version string, as precisely as you know
    it (if genuinely unsure of the exact string, give your best honest short name -
    never a placeholder and never another model's id)
  • model.vendor - the organisation that makes you
  • model.region - the datacenter city/state/country your request is processed in,
    IF you can determine it; OMIT the whole "region" object if you cannot. Never
    invent a location.
oversight is "prompt_guided" (a human directs you) and source is
"trainedAlgorithmicMedia" (a trained model made the pixels) - those two are fixed.
author.name is the ART DIRECTOR from YOUR NAME above - the person, not you.
Use TODAY'S real date in the provenance comment, not a date from your training.

── Deliverable: ONE copy-paste block ─────────────────────────────────────────
Return the WHOLE deliverable as a SINGLE payload and NOTHING else - no prose before
or after, no second block, no canvas/document/artifact - so the director copies it
in ONE action. The content between the markers is RAW FILE TEXT, not a code block:
do NOT put ``` anywhere, and do NOT indent or wrap it. Emit EXACTLY this shape, with
«id» / «ns» / the self-identified values substituted:

===== FILE: «id».html =====
<!-- 3–6 line comment: (a) the concept and WHY it means THIS page, (b) how it meets
     the band contract, (c) a PROVENANCE line: "Generated by «your exact model +
     version» («your vendor») for the Lolly docs masthead bank, prompt-directed by
     «YOUR NAME» on «today YYYY-MM-DD»; model serving region/jurisdiction: «where
     your request ran, else 'not disclosed'». The C2PA signature added at bank time
     is this file's first provenance record." -->
<div class="«ns»" aria-hidden="true"> …your <canvas> and/or <svg>… </div>
<style> /* every rule scoped under .«ns» - a short unique prefix */ </style>
<script>
(function(){
  var root = document.querySelector('.«ns»');
  var canvas = root.querySelector('canvas'); /* if you use one */
  var ctx = canvas.getContext('2d');
  /* …the rest of your ONE IIFE… */
})();
</script>

The «id».html value is the COMPLETE fragment shown above - it MUST start with the
<!-- comment and include the <div>, its <canvas>/<svg>, the <style>, AND the full
<script> whose IIFE opens by grabbing its own element (root/canvas/ctx). Do NOT
output only the JavaScript body - the loose script the runtime needs its tags and
element lookups. NO <!doctype>/<html>/<head>/<body> - and do not write those literal
tag names even inside the comment (the shape linter flags the text; say "root
data-theme changes", not "<html> data-theme changes").

===== FILE: «id».meta.json =====
{
  "generator": { "name": "«your product name»" },
  "model": {
    "name": "«your model family»",
    "identifier": "«your exact model id»",
    "vendor": "«the org that makes you»",
    "region": { "country": "«where your request ran - or drop the whole region»" }
  },
  "oversight": "prompt_guided",
  "source": "trainedAlgorithmicMedia",
  "author": { "name": "«YOUR NAME»" }
}

Rules for the two files:
• «id».html is an HTML *FRAGMENT* - NO <!doctype>, <html>, <head> or <body>. Pick a
  short unique class prefix «ns» and scope EVERY selector under it.
• meta.json accepts ONLY these keys, at every level: generator{name,version},
  model{name,identifier,vendor,region{city,state,country}}, oversight, source,
  locale, author{name,email,url}. ANY other key - at any level - is REFUSED (no
  `date`/`jurisdiction`/`location`; the date is stamped automatically).
  region.country is required IF region is present; drop region entirely if unknown.

── How it sits in the band (fill it) ─────────────────────────────────────────
Your root .«ns» is placed inside a wrapper that is `position:absolute; inset:0;
overflow:hidden; pointer-events:none`, in a band that is full viewport width and
`min-height: clamp(14rem, 30vh, 20rem)`. So:
  • Root: `position:absolute; inset:0; overflow:hidden;` - FILL the band, don't
    assume a fixed pixel size; read your live size from the element, not constants.
  • The band paints its OWN legibility scrims over you and melts your bottom edge
    into the page - so keep important detail out of the lower-centre, and don't
    rely on a hard bottom edge.
  • Decorative only: keep pointer-events:none UNLESS the piece is genuinely
    interactive; if it is, re-enable pointer-events on your root and warn nothing.
  • If you use an <svg>, it MUST have a viewBox.

── THEME RULES (this is the important part) ──────────────────────────────────
Docs pages are read in BOTH light and dark, and the theme can change WHILE the
page is open. You must READ THE PAGE'S OWN TOKENS LIVE and REPAINT on theme change
- never hardcode a single palette.

Read tokens with getComputedStyle on the document root, with a fallback so a
standalone preview still looks right:
  function tok(name, fallback){
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

Available tokens. The docs share the WEB SHELL's design tokens (shells/web/src/styles/
tokens.css), themed by the [data-theme] attribute on <html>: light is the default, dark is
[data-theme="dark"], and inside the app shell the active brand is [data-theme="brand"]. The
app's tokens are shadcn HSL TRIPLES - bare "H S% L%" - so a raw app slot must be wrapped:
hsl(var(--primary)) or hsl(var(--primary) / <alpha>). The docs' legacy names below are BRIDGED
onto those slots and, read through getComputedStyle, resolve to COMPLETE hsl(...) colours you can
pass straight to canvas. The app slots are the source of truth; the legacy aliases are stable and
already hsl()-wrapped, so PREFER the aliases for canvas fills.

  APP SLOT (source)    LEGACY ALIAS   ROLE
  --background         --page         page ground / your base fill
  --foreground         --text, --dark body text / strong ink (follows the theme, dark↔light)
  --muted-foreground   --muted        secondary / quiet marks
  --muted              --pale         faint tint of the ground / soft surface
  --border             --border       hairlines, faint chips
  --primary            --green        the ACCENT (deep teal in light, pine green in dark)
  --card               (none)         a lifted surface one step off the ground
  --destructive        --red          error / danger hue
  --orange #fe7c3f · --navy #192072 · --blue #2453ff · --light (mint)  - fixed brand hues, no
                                        semantic slot; use sparingly and intentionally.
Prefer --primary (aka --green) for the accent - it reads on both themes. Base your ground on
--background (aka --page). Values you read via getComputedStyle are already resolved to full
colours, e.g. `--page` reads "hsl(224 71% 4%)"; a BARE app slot reads the raw triple, e.g.
`--primary` → "151 57% 46%", so wrap it yourself: `'hsl(' + tok('--primary','151 57% 46%') + ')'`.
The bridged aliases already include the wrapper, so `tok('--page','#061816')` is canvas-ready.

Detect dark, and repaint when it changes, via BOTH signals:
  • the [data-theme] attribute on <html>: `document.documentElement.dataset.theme === 'dark'`,
    plus a MutationObserver on document.documentElement with
    { attributes:true, attributeFilter:['data-theme'] }. (A legacy `.dark` class is kept in
    lock-step with the attribute for older art, so filtering on 'class' also fires - but read
    and filter on 'data-theme', which is the real switch, and treat 'brand' as dark too.)
  • OS "system" setting: window.matchMedia('(prefers-color-scheme: dark)') and
    listen to its 'change' event.
On either change: re-read the tokens and REPAINT immediately. If your effect is
idle at rest (loop parked), you must still force one explicit repaint on the
change - an idle canvas will not switch on its own.

── MOTION CONTRACT (required if it moves) ────────────────────────────────────
If the piece animates (requestAnimationFrame, or Web Animations .animate()):
  • Honour reduced motion. Render ONE static frame with NO loop when
    reduced motion is on. The guard must be VISIBLE beside the loop: write the
    literal `window.matchMedia('(prefers-reduced-motion: reduce)').matches` INLINE
    at the requestAnimationFrame/.animate site (within ~40 lines of it). The linter
    scans for that literal TEXT - a cached `var mq = matchMedia(…)` referenced as
    `mq.matches` at the loop does NOT count, even though it works at runtime. Fine
    to also keep a cached copy for other uses; just inline the literal at the loop.
  • Suspend when off-screen and when the tab is hidden: IntersectionObserver on
    your root (stop the loop when not intersecting) and a `visibilitychange`
    listener (stop when document.hidden). Resume when visible again.
  • Idle when nothing is happening - don't spin rAF forever if the field is at rest.

── HARD CODE REQUIREMENTS (the signer's lint - violating ANY of these is a hard
   fail; the file is refused and cannot be banked) ──────────────────────────────
The artifact is ONE self-contained file that loads nothing and keeps no state. It
must be reviewable by reading it. FORBIDDEN, anywhere in the file:
  • Network:      fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, importScripts
  • Storage:      localStorage, sessionStorage, indexedDB, openDatabase, caches, cookie
  • Second context: Worker, SharedWorker, serviceWorker, BroadcastChannel, postMessage,
                  window.opener, document.domain
  • Dynamic code: eval, new Function, atob, unescape, execScript, require, `.constructor`
                  tricks, setTimeout/setInterval with a STRING body, and building
                  markup/CSS at runtime - NO innerHTML, outerHTML, insertAdjacentHTML,
                  cssText, insertRule, document.write. (Build DOM with
                  createElement / textContent / setAttribute for non-URL attrs, or
                  draw to <canvas>. The offscreen-sprite <canvas> pattern in
                  inclusive-sensory.html is the idiom to copy.)
  • Device/UI:    getUserMedia, geolocation, Notification, clipboard,
                  requestFullscreen, showModal
  • External resources: NO external URLs of any scheme (http/https, ftp, ws/wss,
                  file, blob, about, *-extension), NO CSS @import, NO
                  <meta http-equiv="refresh">, and NO assigning a URL attribute at
                  runtime (.src=, .href=, setAttribute('src'|'href'|'srcset'…)).
                  Allowed references: same-document `#…` only, an inlined
                  `data:image/(png|jpeg|gif|webp|svg+xml)` or `data:font/…`, or a
                  root-relative href on a clickable <a>.
  • XML:          no <!ENTITY> declarations.
  • Every <svg> MUST carry a viewBox.
  • SIZE: the whole .html source must be ≤ 48 KB (before signing).
  • Do NOT include any C2PA manifest, `<c2pa:…>` element, or
    "BEGIN C2PA MANIFEST" comment - the signer adds provenance later; your file
    must lint clean WITHOUT it.

Allowed and encouraged: <canvas> 2D, inline <svg> (with viewBox), a scoped
<style>, getComputedStyle, matchMedia, requestAnimationFrame, addEventListener,
MutationObserver, IntersectionObserver, createElement/appendChild/textContent,
Math, and a single IIFE in one <script>.

── Self-check before you answer ──────────────────────────────────────────────
Confirm: the «id».html value STARTS with the <!-- comment and contains <div> +
<canvas>/<svg> + <style> + a COMPLETE <script> (its IIFE grabs root/canvas/ctx) -
NOT just the JavaScript body; no ``` anywhere in the reply; fragment (no
<html>/<head>/<body>); one class prefix, everything scoped;
reads --page/--green etc. live with fallbacks; repaints on BOTH the [data-theme]
attribute and prefers-color-scheme change; if animated, has a reduced-motion static frame + an
off-screen/hidden suspend; no forbidden token anywhere; every <svg> has a viewBox;
≤ 48 KB; no C2PA/manifest text; you SELF-IDENTIFIED the model fields (name, exact
identifier, vendor, region - or dropped region) rather than copying the examples;
provenance comment names your model+version, the director, the date, the region (or
"not disclosed"); author.name is the director; the artwork is an abstract metaphor
for THIS page and distinct from other pages. Then output the SINGLE copy-paste block
described above (both files, separated by the `===== FILE: … =====` markers, no
triple-backtick fences) and nothing else.
```

---

## Applying a returned reply (and when a model fumbles)

Split the payload on the `===== FILE: … =====` markers into `<id>.html` and
`<id>.meta.json` under `docs/mastheads/`, add the `MASTHEADS` mapping, then
`node scripts/sign-docs-art.ts --check` → fix → sign → verify. Observed failure
modes and the honest fix:

- **Only the JS body / wrapped in ``` fences / `*` operators eaten** (common with
  Gemini via a chat UI - markdown mangles the paste). Reconstruct the envelope
  around the model's own draw code: the `<!-- comment -->`, `<div class="ns">`
  `<canvas>`, `<style>`, and `<script>(function(){ var root=…; canvas=…; ctx=… })()`.
  That scaffolding is fixed boilerplate the contract specifies, so the credential
  still honestly reflects the model's artwork. (Fable and GLM returned clean,
  complete fragments; Gemini repeatedly did not.)
- **Wrong self-identity** (a model copying another model's name, or a training-era
  date). NEVER sign it as-is - that is a false provenance record. Correct
  `meta.json` + the comment to the TRUE model (what actually generated it) and
  today's date. GLM-5.2 once labelled itself "Claude 3.5 Sonnet" from a prompt
  example; the fix was removing all example model names from SELF-IDENTIFY.
- **Directing via a subagent** (e.g. one model steering another): fill the meta
  yourself from the model you invoked. `author.name` is the **accountable human**
  who commissioned it - NEVER the orchestrating AI. The author/`dc:creator` field
  exists to name the human a claim traces back to; putting an AI there conflates it
  with the model disclosure and undercuts the human-accountability the whole site
  asserts (see input-not-impersonation, ai-stance: an agent carries a decision, it
  does not originate one). The generating model goes in `model.*` (disclosed via
  ai-disclosure); any orchestrating AI is a mechanism note in the provenance
  comment, not a structured author.

Verify each signed file reads back correctly (author, disclosure, vendor, region)
before moving on - the co-located tests plus a quick `verifyC2pa()` on the file.

## Credentials - what gets recorded, and where

The four facts you wanted - **model, date, serving jurisdiction/location, and the
person prompting** - are all captured as structured credential data now. The
`meta.json` schema (`scripts/sign-docs-art.ts`) was extended to carry the author
and the model provenance, and each maps to a real assertion at sign time:

| Fact | Where it lands in the credential | Filled by |
|---|---|---|
| **Model + version** | `meta.model.name` + `model.identifier` → the C2PA **ai-disclosure** assertion (section 18.28) | **the model** self-identifies |
| **Human oversight** | `meta.oversight: "prompt_guided"` → ai-disclosure | fixed |
| **Source type** | `meta.source: "trainedAlgorithmicMedia"` → `c2pa.created` digitalSourceType | fixed |
| **Date** | **Automatic** - the signer stamps the claim `when` and the export assertion's build date at bank time | `sign-docs-art.ts` |
| **Director / prompter** | `meta.author.name` (+ optional `email`/`url`) → the C2PA **human author** (a `dc:creator` in the v2 `cawg.metadata` assertion) | director gives it (YOUR NAME); the model copies it verbatim |
| **Model vendor** | `meta.model.vendor` → the **Lolly environment assertion** (`tools.lolly.export` → `modelVendor`) | **the model** self-identifies |
| **Serving region / jurisdiction** | `meta.model.region {city,state,country}` → environment `modelRegion` (joined "City, State, Country") | **the model**, if it discloses it |

Why the split of homes: the **ai-disclosure** assertion is a spec-defined shape
(section 18.28) with no field for a vendor or a datacenter, so grafting them on would
corrupt a standard assertion - instead **vendor + region are Lolly-namespaced
facts** in our own environment assertion (the same place `generator` and `locale`
already ride). The **author** uses C2PA's real human-author path. All of it is
covered by the manifest's hash binding, so it's tamper-evident. The leading HTML
**provenance comment** stays too, as a human-readable echo of the same facts.

Best-effort by design: a model that won't disclose its serving datacenter simply
omits `model.region` (the signer requires only `country` when `region` is present),
and the credential then makes no location claim rather than a guessed one.

## Reference: the two mastheads this prompt is modelled on

**Default band - the floating-format chip field** (`docs/build.ts`).
`CHIP_FIELD_JS` is the engine; `DOCS_MASTHEAD_SCRIPT` is its docs instance. It is
the template for the theme rules: it reads `--green` / `--border` live via a
`tok(name, fallback)` helper, decides dark from the `[data-theme]` attribute, and **re-bakes**
its chips on a `MutationObserver` for that attribute's changes and a
`matchMedia('(prefers-color-scheme:dark)')` change. Blend/opacity are the band's
CSS job (`.docs-mast-canvas` uses `mix-blend-mode:color-dodge` in dark), so the JS
"only ever decides two colours." It also `pause`s off-screen and honours
`reduceMotion` - the same manners the prompt demands.

**Custom band - the Sensory Mixer** (`docs/mastheads/inclusive-sensory.html`).
The inclusive-design page's thesis rendered as artwork: a stimulation dial the
reader runs calm→spicy. It is the shape the prompt asks the model to produce:
a `.ism` fragment (`<div aria-hidden>` + `<canvas>` + scoped `<style>` + one IIFE),
`position:absolute; inset:0` to fill the band, palette read live from `--page`
(with hex fallbacks) and re-read on the `[data-theme]` toggle **and** on
`prefers-color-scheme`, a single static calm frame under reduced motion, and a
loop that idles when parked and suspends via `IntersectionObserver` /
`visibilitychange`. Its `.meta.json` is the exact shape the prompt emits
(`generator/model: Gemini`, `oversight: prompt_guided`, `source:
trainedAlgorithmicMedia`) - it too started as a Gemini draft, Andy-directed, then
adapted to this contract.

## The contract, in one place

- **Bank layout & signing:** `docs/mastheads/README.md`, `scripts/sign-docs-art.ts`
  (the lint + C2PA signer - the source of every "HARD CODE REQUIREMENT" above).
- **Inline + namespacing pipeline:** `docs/docs-art.ts` (`resolveDocsArt`,
  `stripArtForInline`, `mastheadArtBand`). At build time the fragment is inlined
  into the band, the credential copy is stripped, and every `id` / `url(#…)` /
  `href="#…"` is namespaced with a `mast-<id>-` prefix - so id collisions across
  artifacts are handled for you, but keep your ids sane anyway.
- **Band CSS + page mapping:** `docs/build.ts` - the `.docs-masthead` /
  `.docs-mast-art` band, and the `MASTHEADS` slug→id table you register in.
