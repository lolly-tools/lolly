// SPDX-License-Identifier: MPL-2.0
/**
 * Jelly effects - the flag-gated soft-body chrome controls (vendored Jelly UI,
 * `src/vendor/jelly/`). One entry point: `ensureJelly()` lazily imports the
 * bundle (defining every <jelly-*> element) the first time a surface wants it,
 * so users who turn the flag off never pay for the chunk.
 *
 * Theming: Jelly UI resolves every color through `--jelly-color-*` custom
 * properties re-read from computed style on each repaint, with its own oklch
 * defaults injected under `@layer jelly`. The bridge below is UNLAYERED (like
 * tokens.css), so it outranks those defaults and maps the shell's semantic
 * triples onto them - theme cycling and runtime brand re-injection
 * (brand-vars.ts rewriting --primary) flow through with no further wiring.
 * Named-palette entries (rose/amber/azure/mint/white) and the shadow triple are
 * deliberately left to Jelly's own light/dark defaults, keyed by the
 * [data-jelly-mode] attribute that theme.ts stamps alongside [data-theme].
 */

import { flagEnabledSync, JELLY_FLAG } from '../feature-flags.ts';

const BRIDGE_ID = 'jelly-token-bridge';

// Shell semantic tokens (shadcn HSL triples, consumed as hsl(var(--x))) mapped
// onto Jelly UI's token vocabulary. Fonts ride along so jelly labels match chrome.
const BRIDGE_CSS = `:root {
  --jelly-color-background-accent: hsl(var(--primary));
  --jelly-color-foreground-on-accent: hsl(var(--primary-foreground));
  --jelly-color-background-default: hsl(var(--background));
  --jelly-color-background-surface: hsl(var(--card));
  --jelly-color-background-muted: hsl(var(--muted));
  --jelly-color-background-neutral: hsl(var(--muted));
  --jelly-color-background-neutral-emphasis: hsl(var(--secondary));
  --jelly-color-foreground-default: hsl(var(--foreground));
  --jelly-color-foreground-muted: hsl(var(--muted-foreground));
  --jelly-color-foreground-on-neutral: hsl(var(--foreground));
  --jelly-color-border-default: hsl(var(--border));
  --jelly-color-border-focus: hsl(var(--ring));
  --jelly-color-background-rose: hsl(var(--destructive));
  --jelly-font-display: var(--font-brand);
  --jelly-font-text: var(--font-brand);
  --jelly-font-mono: var(--font-mono);
}
/* Jelly hosts paint ALL their own chrome on canvas. Native-control recipes
   that match by class or attribute - .modal-primary, [data-action="download"],
   .gallery-search, whatever comes next - must never paint a second box (or
   pseudo-element glyph) behind the capsule. Unlayered, these beat every
   layered sheet, so the whole bug class dies here rather than selector by
   selector. */
jelly-button, jelly-input, jelly-switch, jelly-checkbox, jelly-segmented {
  background: none; border: 0; box-shadow: none; padding: 0;
}
jelly-button::before, jelly-button::after { content: none; }
/* Chrome-wide scale: jelly's size tables suit marketing pages; Lolly's chrome
   runs denser. Page-level rules beat shadow :host size tables, so this is the
   one knob for every surface (dialogs, action rows, forms).
   Every size here rides var(--a11y-fs) - the largeText multiplier - for the same
   reason the note below gives about download-btn-jelly: this sheet is injected
   UNLAYERED, so @layer a11y cannot reach it, and jelly mode replaces whole
   controls (switches, inputs, buttons) with shadow-DOM ones. Left off the
   multiplier, turning on Large text would leave an entire alternate control layer
   at its original size - including the switch that turns jelly mode on. The
   default is 1 (styles/parts/a11y.css), so this is byte-identical when off, and
   the height scales with the label so the capsule does not crush. */
jelly-button {
  --jelly-button-font-size: calc(.85rem * var(--a11y-fs));
  --jelly-button-height: calc(2.35rem * var(--a11y-fs));
  --jelly-button-min-width: 0;
  /* Cap the HOST at the same height its shadow capsule uses. The component only
     sizes the inner [part=button]; the host stays height:auto, so in a flex row
     (align-items defaults to stretch) an engine is free to stretch the host - and
     the blob canvas inside it, drawn at height:100% - to the whole row. Chromium
     resolves the host to content height and never grows; some WebKit builds
     stretch it, which is what turned the drop chooser's two buttons into full
     dialog-height arches. An explicit host height reads the same variable every
     size and variant already sets (small/medium/large, download-btn-jelly), so
     this is byte-identical where it already worked and a hard cap where it did
     not. */
  height: var(--jelly-button-height);
  box-sizing: border-box;
}
/* The shadow button is content-sized and sits at the inline start of its
   wrapper - so in a stretched host (flex rows) the capsule spans the host but
   the label hugs the left. Filling the part lets its own justify-content
   centre the slotted label/icon in every stretched jelly button. */
jelly-button::part(button) { width: 100%; }
/* Download is the export pane's core action - bigger than its row-mates.
   Declared HERE because the size knobs above are unlayered: a layered
   tool-chrome rule could never override them. */
jelly-button.download-btn-jelly {
  /* the component drives vertical bulk via height (its padding-block is 0) -
     3.25rem ≈ the old native padding plus the extra breathing room */
  --jelly-button-height: calc(3.25rem * var(--a11y-fs));
  --jelly-button-font-size: calc(.95rem * var(--a11y-fs));
  font-weight: 700;
}
jelly-input {
  --jelly-input-font-size: calc(.9rem * var(--a11y-fs));
  --jelly-input-padding-inline: .65rem;
}`;

let loading: Promise<void> | null = null;
let ready = false;

// The WKWebView in the current macOS/iOS beta grows the jelly components' canvas
// without bound - a measure-then-redraw feedback loop that scales each control up
// until it fills the window (first seen as the drop chooser's two buttons ballooning
// off-frame). A CSS height cap on the host does not stop a JS-driven growth loop, so
// until the vendored component is verified against that WebKit the native shells
// (Tauri desktop and mobile, both WKWebView) never turn Jelly on. The flag still
// drives the web PWA, where the components render correctly. Remove this gate once
// the component holds a fixed size under that WebKit.
const NATIVE_WEBVIEW = typeof window !== 'undefined'
  && typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';

/** Whether the Jelly effects flag is on (sync read of the boot-hydrated mirror). */
export function jellyEnabled(): boolean {
  if (NATIVE_WEBVIEW) return false;
  return flagEnabledSync(JELLY_FLAG.id);
}

/**
 * Flag on AND bundle loaded - the synchronous gate for surfaces that build
 * markup in one pass (dialogs, topbars, sidebars) and can't await a chunk.
 * main.ts idle-preloads the bundle when the flag is on, so by interaction time
 * this is effectively `jellyEnabled()`; before that the surface renders its
 * plain CSS control and simply looks pre-jelly for a moment.
 */
export function jellyActive(): boolean {
  return ready && jellyEnabled();
}

/**
 * Load the Jelly UI bundle and install the token bridge if (and only if) the
 * flag is on. Resolves `true` when <jelly-*> elements are ready to render.
 * Safe to call from any surface on every mount - the import happens once.
 * A caller holding the canonical profile can pass the flag state itself
 * (e.g. right after a toggle, when the sync mirror hasn't been written yet).
 */
export async function ensureJelly(on: boolean = jellyEnabled()): Promise<boolean> {
  if (!on) return false;
  // The gate above only stops callers that read jellyEnabled(); the feature-flag
  // toggle passes its new state in directly (profile.ts), so bar the native
  // WebView here too - otherwise flipping the flag on desktop loads the bundle and
  // the flag cards' own switches balloon. See NATIVE_WEBVIEW above.
  if (NATIVE_WEBVIEW) return false;
  // No custom-element registry means no browser to define <jelly-*> in (a bare
  // jsdom test host is the everyday case). The bundle registers its elements at
  // import time, so importing it there throws and the answer is false either
  // way - refuse up front rather than warning once per mount.
  if (typeof customElements === 'undefined') return false;
  if (!loading) {
    loading = import('../vendor/jelly/jelly.mjs').then(() => {
      if (!document.getElementById(BRIDGE_ID)) {
        const style = document.createElement('style');
        style.id = BRIDGE_ID;
        style.textContent = BRIDGE_CSS;
        document.head.appendChild(style);
      }
      // The import injected @layer jelly defaults keyed off [data-jelly-mode];
      // theme.ts stamps it on every applyTheme, but the first load can happen
      // after the last theme apply - sync it now so unbridged defaults match.
      syncJellyMode();
      installLabelForwarder();
      ready = true;
    });
  }
  try {
    await loading;
    return true;
  } catch (err) {
    loading = null; // a failed chunk load may be transient - allow a retry
    console.warn('jelly: bundle failed to load', err);
    return false;
  }
}

/**
 * One app-wide fix for label-wrapped jelly toggles: a native `<label>` can't
 * activate a control whose real checkbox lives in shadow DOM (the browser's
 * synthesized click lands on the inert host), so clicks on a label's text are
 * forwarded to the jelly control inside it. Direct hits on the control (its own
 * pointer handling toggles), or on interactive elements like the (i) help tips,
 * are left alone - mirroring how a native label ignores nested interactives.
 * Installed once when the bundle loads; delegated, so it covers every surface.
 */
function installLabelForwarder(): void {
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('jelly-switch, jelly-checkbox, button, a, input, select, textarea')) return;
    const sw = e.target.closest('label')?.querySelector<HTMLElement & {
      checked: boolean;
      setChecked?: (on: boolean, animate?: boolean) => void;
    }>('jelly-switch, jelly-checkbox');
    if (!sw) return;
    e.preventDefault();
    // jelly-switch exposes setChecked (its shadow checkbox swallows clicks);
    // jelly-checkbox's shadow checkbox is a real one - click it so the toggle
    // takes the same pop-and-emit path as a direct hit.
    if (typeof sw.setChecked === 'function') sw.setChecked(!sw.checked, true);
    else sw.shadowRoot?.querySelector('input')?.click();
  });
}

/**
 * Pin Jelly's light/dark mode to the shell theme (brand chrome is dark-surfaced,
 * see tokens.css). Attribute-only - no import, so theme.ts can call this
 * unconditionally; it is inert until the bundle's stylesheet exists.
 */
export function syncJellyMode(theme?: string): void {
  const t = theme ?? document.documentElement.dataset.theme ?? 'light';
  document.documentElement.setAttribute('data-jelly-mode', t === 'light' ? 'light' : 'dark');
}
