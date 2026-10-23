# Live pages that take the clicker

You want to show a live product demo halfway through your talk, scroll it to the pricing table with your clicker, then carry on with the deck. **Make interactive** gives a **Web page** box on a Design slide a focus step. At that step Lolly highlights the page and keeps the keyboard in the deck: Up and Down move the page, and Next continues the presentation.

::: figure interactive-pages-focus-step
Click steps on one slide: the page appears, then takes focus; Up and Down go to the page, and Next moves on.
:::

## Prepare a page

::: timeline
- <!--i:globe--> Select a **Web page** box and enter its link in the inspector. Choose its viewport width, poster and load rule.
- <!--i:check--> Turn on **Make interactive**. **Focus on click** defaults to the click after the page appears; choose **0** to start focused when the slide opens. Each interactive page on a slide needs its own focus step.
- <!--i:sparkle--> Choose a **Highlight**: Ring, Spotlight, Zoom or None. The colour picker offers your palette, and **Use document accent** restores the default. Reduced motion turns Zoom into a still ring.
- <!--i:sliders--> Choose what **Up and Down** do: Scroll the page, Act like the keyboard, or Nothing. The inspector reports what the loaded page can receive.
- <!--i:sliders--> Open **Scroll and depth** to set a start position and stops (see [Long pages](#start-positions-and-stops)).
:::

The inspector refuses duplicate focus steps, invalid depths and a focus step that comes before the click that reveals its page. Switching interaction off keeps the other settings for later.

A Web page box shows a page only once its site is approved under Settings → Trusted sites, or after **Allow pages from any site** in the web app. Approval is each person's or organisation's own choice. An unapproved or unavailable page stays a poster, and no permission question interrupts the presentation. The interaction settings themselves belong to the document: they travel in its shared link and stay the same for collaborators.

## Drive it with the clicker

| Control | While a page is highlighted |
|---|---|
| Right, Page Down, Space or Next | Release the page and continue builds or slides. |
| Left, Page Up or Previous | Step backwards through builds and focus steps. |
| Up and Down | Scroll or send arrow keys, as the author set. |
| Escape | Release this page for the current visit without changing the slide step. The speaker view offers the same as **Release**. |
| Enter | Hand over the keyboard, when the author turned keyboard handover on. |
| B or period | Show a black screen and pause automatic scrolling. |
| K, or the Pause button | Pause and resume automatic progression and scrolling. |
| F5 or Shift+F5 | Stay in the presentation rather than reloading the app. |

On a stacked slide, Up and Down go to the highlighted page; they keep their stack meaning when no page is focused or **Up and Down** is set to Nothing. The speaker view shows the focused page and its depth or stop where it can.

Most clickers have only Next and Previous. Turn on **Clicker walks the scroll stops** to visit the page's stops with those buttons before the deck moves on. Leave it off when Next should always move the presentation.

The pre-flight **Test your clicker** panel shows the keys your hardware sends. Choose **Start test**, press a button and choose its action. Learned keys belong to this device, not the shared document, so reset them when you change clickers.

## Start positions and stops

Enter a depth in pixels, a percentage of the page's scroll range or a page ID, such as `640`, `50%` or `#pricing`. A percentage needs a readable scroll range, which a same-origin page, a page with the receiver or the known Pan viewport supplies.

**Use current depth** records the position of a page Lolly can read, and **Add current depth** appends it to the stops. You can edit or remove each of up to 32 stops, in the order you choose. **Scroll speed** sets the transition between numeric depths.

The page returns to **Start at** each time the slide arrives. **Keep the last position** applies with the **Keep running** load rule. A page set to **Wait for a click** loads when its focus step arrives, if its site is approved.

### Automatic scrolling

Choose **When the slide opens** or **When focused**, then set From, To, Over, Easing and Repeat (once, loop or back and forth). **Pause at each stop** adds time at each prepared stop.

Up or Down stops the automation for that visit so the presenter can take over. Blackout, overview and Pause suspend movement. Reduced motion uses timed stop changes; without stops, the page stays at its start. A kiosk has no clicker focus steps but can run **When the slide opens** scrolling.

## Pages Lolly can and cannot reach

| Page | What Lolly can do |
|---|---|
| A same-origin Lolly page | Scroll its document or main scrolling panel, read depth and send synthetic arrow keys. |
| A Sandbox demo | Send keys and scrolling through its isolated preview channel. |
| A page with the receiver | Send keys, scrolling and slide events; read the depth it reports. |
| A reveal.js or Slides.com deck | Step through its fragments and slides; show its slide number in the speaker view. |
| Another site | Jump to named places or pan a taller page, after the author chooses a method. |

For a page Lolly can reach, an uncancelled synthetic arrow key also scrolls as usual. A synthetic event is never a trusted hardware event, so a page that requires trusted keys may not respond.

For another site, neither method is chosen automatically:

- **Places on the page** uses IDs such as `#pricing`. The browser replaces the frame's fragment without adding a history entry, and the page chooses its own smooth-scroll behaviour. Hash routers may change views instead, and redirects or embedding restrictions can stop the jump.
- **Pan a taller page** lays the frame out at the set **Page length** and moves it inside the box. **Preview depth** shows the result in the editor. Full-height sections stretch, sticky headers stay at the top and the page's own scroll effects do not run, because panning moves the viewport rather than the site's scroll position.

A site that refuses framing still cannot be embedded after approval.

## Embedded reveal.js and Slides.com decks

A deck inside a slide can follow the clicker. Paste a Slides.com link, such as `https://slides.com/name/talk`, into a **Web page** box; Lolly loads the deck's embed form and asks reveal.js to report its position. A private deck's `token` stays in the link. The web app shows a Slides.com deck after **Allow pages from any site**; the desktop app shows it directly.

A self-hosted reveal.js deck opts in through its own link: add `postMessageEvents=true`, for example `https://talks.example.com/keynote/?postMessageEvents=true`. Its `postMessage` option must stay on, which is the reveal.js default.

| Up and Down setting | What the deck does |
|---|---|
| Scroll the page | Down shows the next fragment or slide and Up goes back, like Space and Shift+Space in reveal.js. |
| Act like the keyboard | Down and Up move through a vertical stack, like the arrow keys in reveal.js. |
| Nothing | Up and Down keep their meaning in the Lolly presentation. |

The inspector shows "This slide deck follows the clicker" once the deck reports, and the speaker view shows its slide number. Next and Previous always move the Lolly presentation. Stops, start positions and automatic scrolling do not apply to a deck.

## Type into a demo

Turn on **Hand the keyboard to the page** only when the talk needs typing or the page's own controls. Press Enter while the page is highlighted, and **Back to slides** returns the keyboard to the deck. A cooperating page can forward deck navigation during handover; an ordinary page on another origin receives the whole keyboard, including the clicker, until you choose Back to slides.

::: details What a page can and cannot learn
To a reveal.js deck, Lolly sends only navigation commands and a request for its position, addressed to the deck's own origin. It accepts reports only from that frame and origin, and reads only the slide numbers.

A page with the receiver checks the parent window, origin, protocol version and field sizes of every message. It reports only its capabilities and two depth numbers. Neither kind of message grants document access or changes a site approval.
:::

## Shared links and exports

Focus steps are ordinary presentation steps, so a link such as `?present&s=4.2` opens slide 4 at focus step 2. Releasing a page for one visit does not change the document.

PNG, SVG, PDF, PowerPoint and video exports show the page's poster, because interaction belongs to the live presentation. Keep the poster useful.

::: check Rehearse on the real network
Approve the site, then rehearse in **Present** on the devices and network you will use for the talk, and check each live page before you share the deck.
:::

## Add the receiver to a page you own

If you build the page being shown, the receiver lets it report its depth and react to slide events, so Lolly can drive it like a same-origin page.

::: details Set up the receiver
The receiver is exported by the Lolly tool-author SDK as `@lolly-tools/core/present-receiver`. Use an instance revision that includes the receiver protocol, and build the SDK from that same revision. From a clean Lolly checkout with its locked dependencies installed, run:

```sh
pnpm run pack:core
```

For SDK 1.5.0, this produces `dist/core-pack/lolly-tools-core-1.5.0.tgz` with compiled JavaScript and TypeScript declarations. The number in the file name is the `version` in `packages/core/package.json`, so another revision can produce a different name. Check that `dist/core-pack/manifest.json` records the selected revision in `generatedFrom` and the file name in `core.tarball`. Install the tarball in your page's project, using your checkout's absolute path:

```sh
npm install /path/to/lolly/dist/core-pack/lolly-tools-core-1.5.0.tgz
```

This route does not depend on SDK 1.5.0 being published to npm. Your page's bundler can import the compiled receiver. Set an exact list of origins allowed to frame your page, and call the returned cleanup function when the page unmounts:

```js
import { attachPresentReceiver } from '@lolly-tools/core/present-receiver';

const stopReceiving = attachPresentReceiver(window, {
  allowedOrigins: ['https://lolly.example'],
  onLifecycle(kind, command) {
    if (kind === 'slide' && command.state === 'stop') {
      // Pause your demo's media or animations here.
    }
  },
});

// When your page unmounts:
// stopReceiving();
```

Replace the example origin with your instance's origin. Do not use a wildcard, and do not trust a sender based on its message alone. Your page and the instance must still allow framing through their normal security headers; the receiver does not override a frame policy. For local development, use a permitted origin and check the live page before rehearsing.
:::
