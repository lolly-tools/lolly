# lolly-fold

A small in-repo Tauri 2 mobile plugin that tells the web shell where a foldable
phone's fold or hinge is (plan 345, phase P4). The web shell's layout module
uses it to split a view across the two halves and to choose book or tabletop
posture.

- Android: Jetpack WindowManager (`androidx.window:window` 1.5.1,
  Apache-2.0), read with `WindowInfoTracker.getOrCreate(activity).windowLayoutInfo(activity)`
  and collected while the activity is STARTED.
- iOS and desktop: there is no native half. `current` answers `null` and
  nothing is emitted. The page uses window size and shape.

## Contract

### Payload

CSS pixels, relative to the web view's own content area:

```ts
type Fold = {
  state: 'flat' | 'half-opened';
  orientation: 'vertical' | 'horizontal';
  bounds: { x: number; y: number; width: number; height: number };
  isSeparating: boolean;
  occlusion: 'none' | 'full';
} | null; // no folding feature: folded to the cover screen, or not a foldable
```

`bounds` is the Android `FoldingFeature.bounds` (window pixels) minus the web
view's position in the window (`getLocationInWindow`), divided by the display
density, rounded to two decimals. A hinge with no gap has a width (vertical)
or height (horizontal) of 0. `x` or `y` can be negative if the fold lies
outside the web view.

Only the first folding feature is reported. Android allows several, but
current foldables have one.

### Tauri event and command

- Event `lolly://fold`: emitted to the web view once at startup and on every
  change (a different fold state, a different rectangle, or the web view moving
  or resizing in the window). Repeats are dropped. The payload is the type above.
- Command `plugin:lolly-fold|current`: returns the latest payload, or `null`.
  Before the first report it returns `null`.

Events sent before the page has loaded are lost, so a page asks `current` at
boot.

### What the web layout module should use (no Tauri import)

`shells/tauri-mobile/bridge-overrides/fold.ts` does both of the above and is
started from `bridge-overrides/state.ts`, which is on the boot path. It gives
the page:

- `window.addEventListener('lolly:fold', (e) => e.detail)`: a `CustomEvent`
  whose `detail` is the payload or `null`. Dispatched for the boot answer
  (when no event beat it) and for every event after.
- `window.__lollyFold`: a getter for the latest payload, or `null`. It is
  `null` until the first answer, so read it together with the event.

Bad payloads are dropped in the helper. In a browser, or in a build without
this plugin, neither exists: treat `window.__lollyFold === undefined` as "no
native fold source" and fall back to the Viewport Segments API and window size.

## Wiring

- `src-tauri/Cargo.toml`: path dependency on this crate
- `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_lolly_fold::init())`
- `src-tauri/capabilities/default.json`: `lolly-fold:default`, which allows
  `current` and nothing else. The event needs no permission. The plugin adds
  no Android manifest entry and no permission.

## Layout of the code

- `src/fold.rs`: the pure conversion from window pixels to the payload, with
  its unit tests (`cargo test`).
- `src/lib.rs`: keeps the latest payload, drops repeats, emits the event and
  answers `current`. On Android it registers a stock Tauri listener channel
  with the Kotlin plugin.
- `android/.../LollyFoldPlugin.kt`: collects `WindowLayoutInfo`, reports raw
  window pixels and the density. It does no conversion, so there is one copy
  of the maths and it is tested.

## iOS

iPhone Duo has no known fold API, and the iOS app uses window size and shape.
If the iOS 27 SDK exposes fold state, add a Swift plugin (copy the shape of
`../lolly-auth/ios`), register it from `src/lib.rs` as Android is, and send the
same raw report (`feature` with `state`, `orientation`, `occlusion`,
`isSeparating`, the rectangle in points, `viewX`, `viewY` and `density` of 1,
since iOS points are already CSS pixels). `fold.rs` and the JS helper then work
unchanged. Add `ios_path("ios")` in `build.rs` at the same time.

## Needs a real device

The conversion is tested, and the Kotlin compiles, but the offsets and the
posture names have to be seen on a Galaxy Z Fold or a Pixel Fold: that the
rectangle lines up with the physical hinge on screen, that a half-open book
fold and a half-open tabletop fold report `vertical` and `horizontal`
respectively, and that the cover screen reports `null`.
