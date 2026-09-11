# Lolly Inclusive Design Policy

*Last updated: 30 July 2026*

> **Our ethos.** An open source community includes all of us. Software that anyone
> can read, run and change only earns that openness when anyone can actually use
> it - whatever they see, hear, process, speak or believe. So we treat
> accommodation as a form of celebration, never a compromise: a preference that
> makes Lolly calmer, louder, larger or more familiar for someone is not a
> degraded mode of the product. It is the product, meeting one more of us where
> they are.

## What this policy covers

Lolly is a creative tool: people come here to make things that represent them.
That shapes every accommodation below in one specific way - **adjusting the app
never adjusts your work**. Accessibility preferences restyle Lolly's own
interface: menus, cards, navigation, type. They are engineered never to reach
inside the tool canvas or the export pipeline, and automated tests fail our
builds if a preference could move a single pixel of an exported file. You should
never have to choose between a comfortable app and a faithful render.

## Accessibility

Beyond following the platform's own signals (system dark mode, the OS
reduced-motion preference), Lolly ships explicit, opt-in accessibility
preferences on your profile:

- <!--i:pause--> **Reduce motion** turns off transitions, slides and animated flourishes in the
  app, and combines with (never overrides) your operating system's setting.
  Animated exports keep moving exactly as designed.
- <!--i:sunburst--> **High contrast** strengthens borders, text and focus rings around your work.
  Your brand colours and canvas stay exactly as you set them.
- <!--i:font--> **Large text** grows the app's type and icon glyphs without reflowing your
  designs, so what you export is byte-identical.
- <!--i:eyeoff--> **Hide colourful previews** swaps the gallery's preview artwork for calm icon
  and text cards, and softens project thumbnails, halving their colour and contrast, so they
  stay recognisable without the colour noise. Full colour returns the moment you
  step inside a tool, so the one place high-stimulus imagery appears is the one
  place you chose to work on it.

![The Accessibility card on the profile page: four plain switches - Reduce motion, Hide colourful previews, High contrast and Large text - each with a help tip](/t/url-shot?url=%2F%23%2Fprofile&width=430&height=900&dpi=192&waitMs=2000&scrollDepth=1300&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.profile-card--a11y&dark=1&filename=incl-a11y-card)

You can set these for yourself right now: [open your Accessibility settings](/#/profile?focus=a11y-section) -
the four switches above, on one plain card, no digging.

Alongside the preferences: controls carry accessible names and pressed states,
changes are announced to screen readers, overlays close on Escape, the drawing
tools answer single keypresses and the arrow keys nudge whatever you have
selected, keyboard focus is visible and strengthened further under high
contrast and every one of these switches is a plain, always-visible card on
the profile page - findable by someone who can barely read the page as it is,
which is the moment it matters.

**Listen.** Eleven core pages of this documentation can be read aloud - play,
pause and follow the words as they are spoken, at a pace you set. Narration is
English-only for now, and more pages are being recorded. Slowing down costs
nothing in quality: it is a different speed, not a lesser one, for anyone who
learns at their own pace.

## Reduced and enhanced stimulation

Neurodivergent people are not one audience with one need. The same brain that is
overwhelmed by a wall of colourful thumbnails on a hard day may seek strong
sensory input on another, so Lolly accommodates in both directions, always
opt-in:

- <!--i:moon--> **Turning it down.** Reduce motion and Hide colourful previews strip the
  interface back to icons, text and one accent colour. Navigation stays busy-free
  for people with ADHD, autistic people and dyslexic people who find dense,
  high-variance imagery hard to scan; nothing you need (favourites, pinning,
  actions) is taken away in the calmer presentation.
- <!--i:neurobeat--> **Turning it up.** Neurospicy Mode is a deliberate sensory layer - focus
  loops, an atmosphere mixer with individually levelled ambient beds, procedural
  music and interface sound effects - for people who focus best with rich input.
  It is off by default and never auto-plays before you ask.
- <!--i:sliders--> **Sound is separable.** Every audible layer has its own switch, so "visuals
  calm, sound rich" and the reverse are both real configurations, not a single
  accessibility bundle someone else composed for you.

![A utility card on a phone-width screen: a calm icon and text tile that keeps its favourite, pin and info actions](/t/url-shot?url=%2F%23%2Fu&width=430&height=900&dpi=192&waitMs=2400&scrollDepth=900&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D.gtile%7Bcontent-visibility%3Avisible%7D&format=svg&walker=1&cropSelector=.gtile--utility%5Bdata-tool-id%5D&dark=1&filename=incl-utility-card)

![The Neurospicy player docked over the app: track title and transport, separate Music and Effects volumes and the Atmosphere mixer with Wind, Birdsong and Crickets raised](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dplayer&width=1440&height=1000&dpi=192&waitMs=3200&css=%5Bdata-dock-viz-slot%5D%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23neuro-dock&dark=1&filename=incl-neuro-player)

![The visualiser open over the app, painting the music as a full-motion field, with its own transport and volume controls](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dviz&width=1440&height=900&dpi=96&waitMs=2000&waitSelector=.audio-dock%5Bdata-demo-settled%5D&walker=1&format=svg&cropSelector=.audio-dock&css=.audio-dock%20*%7Bbackdrop-filter%3Anone%21important%7D&dark=1&filename=incl-neuro-viz)

## Language and localization priority

- <!--i:globe--> Lolly's interface and documentation are translated into more than 25
  languages, and we **prioritise languages by how many people speak them**, not
  by market revenue - Hindi, Bengali, Urdu and Indonesian arrived in the same
  waves as French and German.
- <!--i:convert--> Right-to-left scripts are first-class: Arabic ships with full RTL layout, not
  a mirrored afterthought.
- <!--i:layers--> Languages are distinct, not interchangeable: Indonesian and Malay are separate
  catalogs, Traditional and Simplified Chinese are separate catalogs and the
  language attribute is set before first paint so Han characters and script
  fallbacks render correctly for your language, not a lookalike.
- <!--i:checklist--> The language menu lists every language in its own name and script, and can be
  ordered by speaker population, so finding yours never requires knowing its
  English name.

![The appearance settings rendered in Arabic on a phone-width screen: a fully right-to-left layout, not a mirrored afterthought](/t/url-shot?url=%2F%23%2Fprofile%3Flang%3Dar&width=430&height=900&dpi=192&waitMs=2200&scrollDepth=950&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=incl-profile-rtl)

## Cultural inclusion

- <!--i:palette--> The neutral starting brand assumes nothing about who you are; Lolly exists so
  your own identity, palette and type replace ours in minutes.
- <!--i:pentool--> Type is treated as a cultural surface: uploaded and Google fonts are shaped
  with proper text shaping across scripts, so names, diacritics and non-Latin
  text export as correctly drawn outlines rather than tofu or substitutions.
- <!--i:people--> Copy avoids idioms and culture-bound references that translate poorly, and
  translators receive clean, bare strings rather than sentences with markup
  fragments baked in.

## Why this produces better work, not just kinder software

Accessibility gets filed under compliance, which quietly frames it as a cost. It
is not one. The same properties that make a tool usable on a hard day make it
faster on every other day, and they compound.

- <!--i:neurobeat--> **Cognitive endurance is the real budget.** Attention is finite and it
  drains unevenly. Every dialog you dismiss, every setting that resets, every
  choice a template should have made for you spends a little of what you had
  left for the work. Constraint-first tools spend almost none of it: the brand
  decisions were made once, at the tool, so producing the twentieth asset costs
  what the first did. People who need that most feel it first, and everyone
  benefits from it.
- <!--i:star--> **Creative confidence comes from safety.** When
  any output could be wrong in a way you will only discover later, you check
  everything twice and stay cautious. When off-brand output is not reachable,
  the checking stops being your job and the caution goes back into the work.
  Confidence is not a mood, it is a property of the constraints.
- <!--i:convert--> **The value of tools is compounding.** A decision set by a tool is correct every time
  that tool runs, in every language, at every size, for everyone who uses it.
  A rule written in some style guidelines doc is only as influential when it is read. With no promise of correct output to the reader. The
  difference is small at first; huge when multiplied by every task.
- <!--i:lock--> **What protects the workflow protects the person.** On-device rendering,
  plain-file exports and offline capability are usually filed under privacy, and
  they are also what keeps you working on a bad connection, on a locked-down
  machine or the day a subscription lapses. Your workflow does not have
  dependencies you did not choose.

Two things follow that we treat as inseparable: operational superiority, because
software that respects your attention and your data is simply faster to work in,
and ethics that cannot be traded away, because they are architectural rather than
promised. A policy can be revised under pressure. An engine that never receives
your content has nothing to revise.

## Ethical commitments

- <!--i:lock--> **Privacy by architecture.** Your work stays on your device. There are no
  trackers or analytics in the codebase, and the few network touchpoints are
  enumerated in the [Privacy Policy](/info/privacy.html). Accessibility and
  language preferences are stored in your own profile, on your device - a
  person's disability or language is never telemetry. Telemetry is no friend
  of this project: we don't want it, and nobody should have to give their
  data away.
- <!--i:shieldcheck--> **Honest provenance.** Exports can carry Content Credentials, and
  AI-generated content is labelled as such. We believe audiences deserve to know
  how media was made, and creators deserve tools that can prove their work is
  theirs.
- <!--i:check--> **No dark patterns.** Preferences are plain switches that do what they say,
  defaults are dormant until you choose them and platform conventions (native
  scrolling, browser shortcuts, standard dialogs) are respected rather than
  hijacked.
- <!--i:code--> **Open source.** The engine, shells and community tools are public. Every
  claim in this document is checkable in the source, and several are enforced by
  tests that fail the build when broken - the additive-by-default rule for
  accessibility attributes, the ban on preferences reaching exports and the
  keeping-in-step of the app's two copies of each preference.

## Holding ourselves to it

Inclusive design here is a policy in the engineering sense: invariants with
tests, not aspirations with adjectives. When an accommodation and a feature
conflict, we redesign the feature (when a 'hide previews' setting also hid icons
off utility cards, the fix was to keep the actions, not to excuse the loss). If
something in Lolly excludes you - a missing language, an overwhelming moment, an
assumption we baked in without noticing - that is a bug. Tell us:
[fitzy@suse.com](mailto:fitzy@suse.com).
