# Live pages that take the clicker

Put a live demo on a Design slide and give the presenter a clear way to drive the page. **Make interactive** adds a focus step to the slide. At that step Lolly highlights the page and keeps the keyboard in the deck. Up and Down move the page; Next continues the presentation.

These settings belong to the document. They travel in its shared link and stay the same for collaborators. Site approval remains a separate choice for each person or their organisation. An unapproved or unavailable page stays a poster, and no permission question interrupts the presentation.

## Prepare a page

1. Select a **Web page** box and enter its link in the inspector. Choose its viewport width, poster and load rule. Check the actual page after approving its site.
2. Turn on **Make interactive**. **Focus on click** defaults to the click after the page appears. Choose **0** to start focused when the slide opens. Each interactive page on a slide needs its own focus step.
3. Choose a **Highlight**: Ring, Spotlight, Zoom or None. The shared colour picker offers your palette; **Use document accent** restores the default. Reduced motion turns Zoom into a stationary ring.
4. Choose what **Up and Down** do: Scroll the page, Act like the keyboard, or Nothing. The inspector reports what the loaded page can actually receive.
5. Open **Scroll and depth** to prepare its start position and stops. Rehearse using **Present** before sharing the deck.

The inspector refuses duplicate focus steps and invalid depths. A focus step cannot come before the click that reveals its page. Switching interaction off preserves the other preferences for later use.

## Drive the presentation

| Control | While a page is highlighted |
|---|---|
| Right, Page Down, Space or Next | Release the page and continue builds or slides. |
| Left, Page Up or Previous | Step backwards through builds and focus steps. |
| Up and Down | Scroll or send arrow keys, according to the author's setting. |
| Escape | Release this page for the current visit without changing the slide step. |
| Enter | Hand over the keyboard, when the author enabled keyboard handover. |
| B or period | Hold a black screen and pause automatic scrolling. |
| K or Pause | Pause and resume automatic progression and scrolling. |
| F5 or Shift+F5 | Stay in the presentation rather than reloading the app. |

On a stacked slide, Up and Down go to the highlighted page. They keep their normal stack meaning when no page is focused, or when **Up and Down** is set to Nothing. The speaker view shows the focused page and its depth or stop where available, and offers **Release**.

Most clickers have only Next and Previous. Turn on **Clicker walks the scroll stops** to visit the page's stops with those buttons before moving the deck. Leave that option off when Next should always move the presentation.

The pre-flight **Test your clicker** panel shows the keys your hardware sends. Start the test deliberately, press a button and choose its action. Learned keys belong to this device, rather than the shared document; reset them when changing clickers.

## Choose the scrolling method

| Page | What Lolly can do |
|---|---|
| A same-origin Lolly page | Scroll its document or main scrollable panel, read depth and send synthetic arrow keys. |
| A Sandbox demo | Send keys and scrolling through its isolated preview channel. |
| A page with the receiver below | Send messages for keys, scrolling and slide lifecycle; read its reported depth. |
| Another site | Jump to named places or pan a taller page, after the author chooses a method. |

For a page Lolly can reach, an uncancelled synthetic arrow key also performs the usual scroll. A synthetic event is never a trusted hardware event; a page that requires trusted keys may not respond.

**Places on the page** uses IDs such as `#pricing`. The browser replaces the frame's fragment without adding a history entry. The page chooses its own smooth-scroll behavior. Hash routers can change views instead; redirects and embedding restrictions can also prevent the jump. Rehearse the actual site.

**Pan a taller page** lays the frame out at the authored **Page length** and moves it inside the box. Use **Preview depth** to inspect the result in the editor. Full-height sections stretch, sticky headers stay at the top, and the page's own scroll effects do not run. Panning changes the viewport rather than the site's scroll position.

Neither outside-site method is selected automatically. A site that refuses framing still cannot be embedded after approval.

## Start positions and stops

Enter a depth in pixels, a percentage of the page's scroll range, or a page ID. Examples are `640`, `50%` and `#pricing`. Percentage depths need a readable scroll range, as supplied by a same-origin page, a receiver or the known Pan viewport.

**Use current depth** records the position of a page Lolly can read. **Add current depth** appends that position to the stops. You can edit or remove each of up to 32 stops. The list preserves your chosen order. **Scroll speed** controls the transition between numeric depths.

Normally the page returns to **Start at** on each slide arrival. **Keep the last position** applies to the **Keep running** load rule. A page set to **Wait for a click** loads when its focus step arrives, if its site is approved.

## Automatic scrolling

Choose **When the slide opens** or **When focused**, then set From, To, Over, Easing and Repeat. Repeat can run once, loop or go back and forth. **Pause at each stop** adds time to inspect prepared stops.

Up or Down stops automation for that visit so the presenter can take over. Blackout, overview and Pause suspend movement. Reduced motion uses timed stop changes; without stops, the page stays at its start position. A kiosk has no clicker focus steps, but can run **When the slide opens** scrolling.

## Type into a demo

Enable **Hand the keyboard to the page** only when the talk needs typing or direct page controls. Press Enter while the page is highlighted. **Back to slides** returns the keyboard to the deck.

A cooperating page can forward deck navigation during handover. An ordinary page on another origin receives the whole keyboard, including the clicker. The deck cannot intercept those keys. Use Back to slides to resume normal navigation.

## Add the receiver to a page you own

The maintained receiver is exported by the Lolly tool-author SDK as `@lolly-tools/core/present-receiver`. Build your page with the SDK version matching the instance. Set an exact list of origins allowed to frame your page, and call the returned cleanup function when your page unmounts:

```js
import { attachPresentReceiver } from '@lolly-tools/core/present-receiver';

const stopReceiving = attachPresentReceiver(window, {
  allowedOrigins: ['https://lolly.ing'],
  onLifecycle(kind, command) {
    if (kind === 'slide' && command.state === 'stop') {
      // Pause your demo's media or animations here.
    }
  },
});

// When your page unmounts:
// stopReceiving();
```

Replace the example origin with your instance's origin. Do not use a wildcard or trust a sender based only on its message. The receiver checks the actual parent window, origin, protocol version and bounded fields. A page reports only its capabilities and two depth numbers. Receiving messages grants no document access and changes no site approval.

Your page and the instance must still allow framing through their normal security headers. A receiver does not override a frame policy. For local development, use a permitted origin and check the live page before rehearsing.

## Shared links and exports

Focus steps are ordinary presentation steps: a link such as `?present&s=4.2` can open slide 4 at focus step 2. Releasing a page for one visit does not change the document.

PNG, SVG, PDF, PowerPoint and video exports continue to show the page's poster. Interactive behavior belongs to the live presentation. Keep a useful poster and test your pages on the devices and network used for the talk.
