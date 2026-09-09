// SPDX-License-Identifier: MPL-2.0
/**
 * Capabilities content - a human-readable map of what Lolly can actually do,
 * as data. Extracted from the old Capabilities view so the merged Dashboard
 * (#/d) can render it with progressive disclosure. Content here is descriptive
 * prose about settled capabilities; kept in step with docs/exporting.md,
 * docs/using.md and the export bridge. `desc` strings may carry safe inline
 * <code>/<strong>/<a> (authored here, not user input).
 */

// Small, monochrome line icons (inherit the heading colour via currentColor).
const I = (p: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

const ICONS = {
  edit:      I('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  mobile:    I('<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>'),
  install:   I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12l4 4 4-4"/>'),
  link:      I('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
  save:      I('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  grid:      I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  extension: I('<path d="M4 7h4V5a2 2 0 1 1 4 0v2h4v4h2a2 2 0 1 1 0 4h-2v4H4z"/>'),
  transfer:  I('<path d="M4 7h13M13 3l4 4-4 4"/><path d="M20 17H7M11 21l-4-4 4-4"/>'),
  users:     I('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  package:   I('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  present:   I('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>'),
  ask:       I('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
  globe:     I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>'),
  desktop:   I('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  phone:     I('<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="10" y1="18" x2="14" y2="18"/>'),
  terminal:  I('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M13 15h4"/>'),
  tui:       I('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 4v16"/><path d="M4 8h2M4 11h2M4 14h2"/><path d="m12 10 2 2-2 2"/>'),
  layers:    I('<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'),
  vector:    I('<rect x="2" y="2" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 5h7a4 4 0 0 1 4 4v7"/>'),
  image:     I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  printer:   I('<path d="M6 9V2h12v7"/><rect x="6" y="13" width="12" height="8"/><path d="M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>'),
  film:      I('<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5"/>'),
  doc:       I('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  zip:       I('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M12 7v2M12 11v2M12 15v3"/>'),
  ruler:     I('<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 11l2 2M11 7l2 2M15 11l2 2"/>'),
  swatch:    I('<rect x="3" y="3" width="7" height="18" rx="1"/><path d="M10 14 17 7l4 4-9 9H10z"/>'),
  marks:     I('<path d="M9 3v6H3M21 9h-6V3M3 15h6v6M15 21v-6h6"/>'),
  stamp:     I('<path d="M5 21h14"/><path d="M9 12a3 3 0 0 1-3-3 3 3 0 0 1 6 0 3 3 0 0 1-3 3z"/><path d="M9 12v3h6v-3"/>'),
  lock:      I('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  repeat:    I('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  url:       I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>'),
  bot:       I('<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 8V4M9 13h.01M15 13h.01M9 16h6"/>'),
  shield:    I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  device:    I('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 9h6"/>'),
  brush:     I('<path d="M3 21c3 0 4-3 4-3a3 3 0 1 0-4-4s-3 1-3 4a3 3 0 0 0 3 3z"/><path d="M11 13 19 5a2.8 2.8 0 0 0-4-4l-8 8"/>'),
  font:      I('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
  user:      I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  tag:       I('<path d="M20.6 13.4 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  cube:      I('<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m12 12 9-5M12 12v10M12 12 3 7"/>'),
  bridge:    I('<path d="M3 18v-5a9 9 0 0 1 18 0v5M3 13h18M8 13v5M16 13v5M12 13v5"/>'),
  sync:      I('<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>'),
  id:        I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 9h4M14 13h4M6 16h6"/>'),
  open:      I('<path d="M7 11V7a5 5 0 0 1 10 0M4 11h16v9H4z"/>'),
  canvas:    I('<path d="m4 4 7 17 2.5-6.5L20 12z"/>'),
  camera:    I('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'),
  batchcube: I('<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/><path d="m9.5 15 2 1.5 3.5-3"/>'),
  mcp:       I('<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>'),
  credential:I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  circles:   I('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>'),
} as const;

/** One named feature line within a card. */
export interface CapFeature {
  name: string;
  desc: string;
}
/** One feature-group card: an icon, a title, and its stacked list of features. */
export interface CapCard {
  icon: string;
  title: string;
  features: CapFeature[];
  /**
   * Slug of a committed docs screenshot to show in this card's detail dialog - 
   * `<slug>` resolves to `/info/shots/<slug>.svg`, the same signed vector
   * captures the /info site uses (see scripts/build-docs-shots.ts).
   *
   * Three rules, all essential:
   *  - BASE SLUG ONLY - never a variant suffix. The dialog appends `.dark`
   *    itself under a dark/brand theme and falls back to the light capture when
   *    a slug has no committed dark twin (a light-only recipe). Writing
   *    `<slug>.dark` here would double the suffix into a 404.
   *  - The slug must EXIST. A missing file is a broken image in a dialog, so
   *    capabilities-data.test.ts asserts every slug resolves to a real light
   *    file, and to a dark twin unless it is a documented light-only shot.
   *  - The shot must actually DEPICT the card. Each slug here was picked by
   *    reading its recipe's alt text in docs/*.md, not by guessing from the
   *    name. A screenshot of the wrong screen is worse than no screenshot - 
   *    which is why `shot` is optional and roughly a third of the cards have
   *    none rather than a loose approximation.
   */
  shot?: string;
  /**
   * The shot's file extension when it is not the default vector - a few docs
   * baselines are raster on purpose (tests/docs-shots-vector.test.ts's
   * RASTER_ALLOWED, e.g. `design`, whose subject includes export-hidden editor
   * chrome the vector walker can never carry). The dialog appends this to both
   * the light and `.dark` variants.
   */
  shotExt?: 'png';
  /**
   * Extra search terms for this card - NOT rendered and NOT translated.
   * The visible copy is already indexed by the Capabilities search; this is for
   * the words a person types that the copy doesn't literally use (format ids,
   * competitor/app names, spelling variants, the thing they call it at work).
   */
  keywords?: string;
}
/** One section of the capabilities map (a labelled group of cards). */
export interface CapSection {
  flag: string;
  id: string;
  title: string;
  /** One representative glyph for the whole sub-section (the big banner icon). */
  icon: string;
  desc: string;
  cards: CapCard[];
}

// Each section becomes a labelled group in the Dashboard's Capabilities panel;
// `flag` is the deep-link key (e.g. #/d?print force-opens the panel and jumps).
export const CAPABILITY_SECTIONS: CapSection[] = [
  {
    flag: 'experiences', id: 'cap-experiences', title: 'Experiences', icon: ICONS.edit,
    desc: 'The ways people actually use Lolly - from a thumb-typed edit on a phone to a one-link share or an automated render. The same tool, met where you are.',
    cards: [
      { icon: ICONS.edit, title: 'Live tool editing', shot: 'aud-web-split', keywords: 'editor sidebar preview wysiwyg zoom pan shortcuts keyboard dark mode', features: [
        { name: 'Split view', desc: 'Controls on one side, a live canvas on the other - change any input and the preview updates instantly.' },
        { name: 'The preview is the file', desc: 'What you see is exactly what exports - no separate render step.' },
        { name: 'Zoom & pan', desc: 'Cmd/Ctrl-scroll or pinch to zoom; <code>Space</code>-drag or middle-drag to pan; <code>0</code> fit, <code>1</code> = 100%.' },
        { name: 'System dark mode', desc: 'Tools that support it adapt their canvas to your device’s light/dark preference.' },
      ] },
      { icon: ICONS.canvas, title: 'Free-canvas layout', shot: 'pen-editor-rail', keywords: 'layout studio drag resize rotate snap guides text box shapes design', features: [
        { name: 'Direct manipulation', desc: 'Some tools open as a chromeless free canvas (<strong>Design</strong>): drag, resize and rotate boxes of text, shapes and images, with smart guides that snap to edges and centres.' },
        { name: 'Edit in place', desc: 'Double-click a text box to type; pick fills and images from the same shared controls - then export through the exact same render path as every other tool, so the canvas <em>is</em> the file.' },
      ] },
      { icon: ICONS.camera, title: 'Live camera', keywords: 'webcam video motion filter halftone duotone posterize snapshot photo', features: [
        { name: 'Motion-reactive filters', desc: 'Hit “Go live” on a photo filter - halftone, scanline, posterize, duotone or pixel-stretch - and it tracks your webcam in real time, so the effect responds to movement.' },
        { name: 'Stays on your device', desc: 'Frames are read and processed locally and never leave the device; the camera is released the moment you stop or leave the tool.' },
        { name: 'Or just a snapshot', desc: '“Take a photo” in any image picker grabs a single frame as an on-device image - no upload, no camera roll.' },
      ] },
      { icon: ICONS.mobile, title: 'On a phone', shot: 'vt-phone-palette', keywords: 'mobile touch sheet gestures pinch tablet ipad android', features: [
        { name: 'Controls sheet', desc: 'The inputs become a sheet with a drag grip that snaps to peek / half / full; the preview stays visible while you edit.' },
        { name: 'Render sheet', desc: 'A floating Render button opens every format, size, copy, save and share control - sized for touch.' },
        { name: 'Touch canvas', desc: 'Pinch to zoom, drag to pan, double-tap to fit.' },
      ] },
      { icon: ICONS.install, title: 'Install & full-screen', shot: 'exp-url-full', keywords: 'pwa offline home screen app install fullscreen kiosk deep link', features: [
        { name: 'Installable PWA', desc: 'Add to home screen / install from the address bar for an app-like, full-screen experience; updates itself when online.' },
        { name: 'Deep-link modes', desc: '<code>full</code> opens fullscreen (sidebar collapsed); <code>options</code> opens with the export panel expanded.' },
      ] },
      { icon: ICONS.link, title: 'Share a link', shot: 'aud-url-mode-qr', keywords: 'url share permalink short link copy paste bookmark commit query params', features: [
        { name: 'The URL is the design', desc: 'Every input lives in the link - paste it to a colleague, bookmark it, or commit it.' },
        { name: 'Shortest link', desc: 'A big design would make a long URL; the Share dialog offers a <strong>Shortest link</strong> that packs the whole state into a compact token so it stays short enough to paste anywhere - the readable form is always there too.' },
        { name: 'Act-on-open flags', desc: 'Add <code>&amp;export</code> to download on open, or <code>&amp;copy</code> to arm copy-to-clipboard.' },
      ] },
      { icon: ICONS.package, title: 'Share it whole (.lolly)', keywords: 'lolly file share download fidelity verdict licensed art carry tool trust gate drop import airdrop send zip', features: [
        { name: 'One file, everything in it', desc: '<strong>Download .lolly</strong> writes the design as a single file - the session plus the images you added from your device - so it opens complete on a machine that has never seen your brand.' },
        { name: 'An honest verdict first', desc: 'When a link cannot carry everything, the Share dialog says exactly what would go missing and offers the file instead.' },
        { name: 'You choose how much travels', desc: 'Your name goes in only if your profile opts in; licensed art is held back unless you include it; the tool itself can ride along.' },
        { name: 'A consent gate on arrival', desc: 'A carried tool never runs silently - the recipient is asked <strong>Trust this tool?</strong> before its code can run, and declining still saves the shared work to their Projects.' },
        { name: 'Drop to open', desc: 'Drop a <code>.lolly</code> onto the app: assets land in the library, the session lands in Projects, and every part is checked against the file’s own checksums on the way in.' },
      ] },
      { icon: ICONS.users, title: 'Work together, no internet', keywords: 'collaborate collaboration co-edit live two devices peer to peer p2p invite qr code presence focus hotspot offline beam no server', features: [
        { name: 'Two devices, one design', desc: 'One person shares an invite - a link, a QR code or a short code - the other accepts, and both devices hold the same session live, presence and focus rings included.' },
        { name: 'No server in the middle', desc: 'It works on any shared network, including a phone hotspot with no internet at all, because nothing relays through a cloud.' },
        { name: 'Your undo stays yours', desc: 'A change arriving from the other device never lands on your undo stack, so undo only ever takes back something you did.' },
      ] },
      { icon: ICONS.present, title: 'Present it, full screen', keywords: 'present presentation slides deck fullscreen stage kiosk loop keyboard advance pptx frames', features: [
        { name: 'Frames become slides', desc: 'A design’s frames present in order on a full-screen stage, advanced from the keyboard, with a kiosk loop for a stand or a lobby screen.' },
        { name: 'The deck is a link', desc: 'Add <code>?present</code> and the link opens straight into the presentation; the address follows the slide you are on, so what you send is the slide you see.' },
        { name: 'Fix the deck, then present it', desc: 'Import a PPTX, rebrand it, and present from the same tool - no export round-trip in the middle.' },
      ] },
      { icon: ICONS.save, title: 'Save, organise & share', shot: 'projects', keywords: 'save named session continue folders organise nest drag rename projects', features: [
        { name: 'Named sessions', desc: 'Keep multiple saved sessions per tool, all device-local; Continue resumes your most recent.' },
        { name: 'Projects & folders', desc: 'Organise saved work in the <strong>Projects</strong> view - group sessions into folders that nest as deep as you like, drag to move, rename, and file new sessions straight into a folder.' },
        { name: 'Share a saved session', desc: 'Right-click any saved session for a link that reopens it with the exact same inputs - the full Share dialog, from Projects.' },
        { name: 'Copy to clipboard', desc: 'Paste an image straight into Slack, email or a doc; falls back to a download where the browser can’t.' },
      ] },
      { icon: ICONS.batchcube, title: 'Render many at once', keywords: 'batch bulk export folder zip multi select marquee all sessions', features: [
        { name: 'Render a whole project', desc: 'From Projects, export every saved session in a folder - recursing every sub-folder - as one nested zip that mirrors your folder tree. No Batch/Pro needed.' },
        { name: 'Render a selection', desc: 'Multi-select tiles (tick a checkbox, drag a marquee, or Shift-click) and render the lot in one pass; a single session renders straight to its native file.' },
        { name: 'Render everything', desc: 'The Storage panel can render <em>every</em> saved session across all your tools to files in one nested zip - a full snapshot of your work - produced alongside the profile/data backup, so a single export carries both the editable state and the finished files.' },
      ] },
      { icon: ICONS.grid, title: 'Batch (Pro) mode', shot: 'ov2-batch-grid', keywords: 'grid rows variants languages sizes matrix csv batch pro', features: [
        { name: 'Many at once', desc: 'A grid where each row is a set of inputs, all exported together - a dozen languages or every size variant in one pass.' },
      ] },
      { icon: ICONS.extension, title: 'Browser extension', shot: 'exp-url-shot-notice', keywords: 'chrome extension capture screenshot page grab', features: [
        { name: 'Capture into a tool', desc: 'Pull a page or screenshot from the browser into a Lolly tool to finish and export it.' },
        { name: 'Read a website into a design system', desc: 'With the extension installed, the Design System studio can read one web page you name (its markup, its stylesheets and a few icon files) and turn it into colour, type and logo candidates. See <strong>Design system from a website</strong> under Brand &amp; design system.' },
      ] },
      { icon: ICONS.transfer, title: 'Move to another device', shot: 'pd-transfer-controls', keywords: 'backup restore export import migrate zip checksum no account offline', features: [
        { name: 'Portable backup', desc: 'Export one checksummed zip - profile, every session + thumbnail, your images and preferences - and import-merge it on another install. No account, no cloud.' },
      ] },
      { icon: ICONS.cube, title: 'Use Tools like any asset', shot: 'auth-url-render', keywords: 'embed img src css url background live render hotlink asset', features: [
        { name: 'Just an asset URL', desc: 'Tools can become composed renders, just an asset URL from where the user is, so a template can drop it into an <code>&lt;img src&gt;</code> or a CSS <code>url()</code> background exactly like a library image.' },
      ] },
    ],
  },
  {
    flag: 'platforms', id: 'cap-platforms', title: 'Platforms & runtimes', icon: ICONS.layers,
    desc: 'One platform-agnostic engine and the same render path on every surface, so a tool - and its output - behaves identically wherever it runs.',
    cards: [
      { icon: ICONS.globe, title: 'Web PWA', shot: 'gallery', keywords: 'browser chrome safari firefox offline installable service worker', features: [
        { name: 'Installable & offline', desc: 'Works fully offline after the first load; installs as an app; auto-updates online.' },
      ] },
      { icon: ICONS.desktop, title: 'Desktop', keywords: 'mac macos linux windows tauri native app lolly document file association deep link uri', features: [
        { name: 'macOS, Windows & Linux', desc: 'Native packages via Tauri - the same engine in a desktop shell.' },
        { name: '.lolly belongs to Lolly', desc: 'The installer registers the document format, gives it Lolly artwork and opens a double-clicked file in the same importer as a drop.' },
        { name: 'App links with every input', desc: '<code>lolly://</code> launches the installed app at any documented route with the same URL-mode parameters. The Share dialog writes one under <strong>Link options</strong>.' },
      ] },
      { icon: ICONS.desktop, title: 'At home on the Linux desktop', keywords: 'gnome kde plasma flatpak rpm tray eyedropper wallpaper search hot folder lolly file dbus portal', features: [
        { name: 'Pick colours from any window', desc: 'The eyedropper in every colour control reaches the whole screen through the desktop portal - grab a colour from a photo in another app.' },
        { name: 'Saved shares have thumbnails', desc: 'A shared .lolly lands in the right tool, and saved sessions can show their own thumbnails in GNOME Files.' },
        { name: 'Set a render as your wallpaper', desc: 'One entry in the send menu; your desktop previews and confirms before anything changes.' },
        { name: 'Search from the desktop', desc: 'Type a tool name in GNOME Activities or KRunner and Lolly answers, using the same vocabulary as in-app search.' },
        { name: 'Clipboard tray & hot folder', desc: 'A tray click turns a copied link into a QR code; a watched folder pulls new files straight into your uploads. The clipboard is read only when you click - never watched.' },
      ] },
      { icon: ICONS.phone, title: 'Mobile', shot: 'incl-utility-card', keywords: 'ios android tauri app store native lolly document files open with deep link uri', features: [
        { name: 'iOS & Android', desc: 'Installable mobile packages via Tauri, with the touch-first UI.' },
        { name: 'Open a .lolly from Files', desc: 'Tap or share a Lolly document from the system file manager and the app imports it directly.' },
      ] },
      { icon: ICONS.terminal, title: 'Command line', keywords: 'cli headless script ci pipeline stdout node npm', features: [
        { name: 'Headless render', desc: 'Run any tool from the CLI (jsdom + the same engine); write to a file or stdout.' },
        { name: 'Same parameters', desc: '<code>--flag=value</code> arguments are the URL params - a web link runs unchanged on the CLI.' },
      ] },
      { icon: ICONS.tui, title: 'Terminal app (TUI)', keywords: 'tui terminal keyboard ssh remote ansi truecolor preview', features: [
        { name: 'Interactive in the shell', desc: 'Run <code>pnpm run tui</code> for a full keyboard-driven terminal app - browse the gallery, edit any tool’s inputs and organise saved projects into folders, all without leaving the shell.' },
        { name: 'Preview inline', desc: 'Press <code>p</code> to render the current design straight into the terminal as a truecolor half-block image - no window, no browser.' },
        { name: 'Same engine, same file', desc: 'It reuses the CLI’s host bridge and the one shared engine, so a tool renders and exports exactly as it does in the browser or on the desktop.' },
      ] },
      { icon: ICONS.layers, title: 'One engine everywhere', keywords: 'parity consistency drift bridge portable same output', features: [
        { name: 'No drift', desc: 'The engine knows nothing about the DOM, storage or networking; a capability bridge injects each host’s specifics, so GUI and CLI never diverge.' },
      ] },
    ],
  },
  {
    flag: 'formats', id: 'cap-formats', title: 'Export formats', icon: ICONS.image,
    desc: 'Forty formats across vector, raster, layered, print, motion, audio, documents, data and design tokens. A tool offers only the formats its author declared, and the picker hides any your browser can’t produce.',
    cards: [
      { icon: ICONS.vector, title: 'Vector', shot: 'vt-wordmark-vector', keywords: 'svg eps emf dxf illustrator postscript outlines paths cut file laser cnc plotter', features: [
        { name: 'SVG', desc: 'Infinitely scalable and self-contained - text is outlined to paths (HarfBuzz-shaped) so it renders identically without the font installed.' },
        { name: 'EMF · EPS · EPS (CMYK)', desc: 'EMF pastes as editable vector into PowerPoint and Word; EPS is PostScript vector for Illustrator and press workflows, with a DeviceCMYK variant. Text is outlined to paths in all of them.' },
        { name: 'DXF (cut file)', desc: 'AutoCAD R12 interchange for laser cutters, vinyl plotters and CNC/CAD - outline paths in millimetres, colour as the nearest AutoCAD Color Index. Line-art only.' },
      ] },
      { icon: ICONS.image, title: 'Raster', shot: 'exp-format-picker', keywords: 'png jpg jpeg webp avif ico bitmap dpi icc srgb transparent alpha hdr', features: [
        { name: 'PNG · JPG · WebP · AVIF · TIFF · ICO', desc: 'Lossless or compact, alpha where supported, with the real DPI and an embedded sRGB ICC profile so colour reproduces faithfully.' },
        { name: 'EXR · Radiance HDR (floating-point)', desc: 'High-dynamic-range masters written from a tool’s own high-precision float pixels - OpenEXR for film/VFX grading, Radiance <code>.hdr</code> for lighting and 360° environment maps - keeping the unbounded linear light intact rather than clipping to 0–255.' },
      ] },
      { icon: ICONS.layers, title: 'Layered', keywords: 'psd photoshop affinity gimp layers blend mode layered document editable', features: [
        { name: 'Photoshop (PSD)', desc: 'Write a layered <code>.psd</code> - each design layer kept as a real Photoshop layer with its blend mode, not a flattened picture - so it opens editable in Photoshop, Affinity or GIMP. Built on the engine’s own PSD writer (<code>host.layers</code>), entirely on-device.' },
      ] },
      { icon: ICONS.printer, title: 'Print', shot: 'exp-export-dims', keywords: 'pdf cmyk tiff press prepress fogra swop bleed', features: [
        { name: 'PDF · Print PDF (CMYK) · CMYK TIFF', desc: 'True page sizes and DeviceCMYK output for the press - see Print production below.' },
      ] },
      { icon: ICONS.film, title: 'Motion', keywords: 'mp4 webm gif apng animated webp video animation loop svg keyframes fps', features: [
        { name: 'MP4 · WebM · GIF · Animated PNG · Animated WebP', desc: 'Animated tools record to video (the picker shows what your browser can encode), or to GIF, lossless animated PNG, and colour-plus-alpha animated WebP - all of which work everywhere.' },
        { name: 'Animated SVG', desc: 'A self-contained vector animation - stacks vector snapshots with embedded CSS keyframes, so it scales to any size with no codec and loops in a browser tab or an <code>&lt;img&gt;</code>.' },
      ] },
      { icon: ICONS.film, title: 'Audio', keywords: 'mp3 m4a wav opus audio soundtrack voice recorder audiogram sequence studio lossless encode', features: [
        { name: 'MP3 · M4A · WAV · Opus', desc: 'Recording and audio tools (the Voice Recorder, Audiogram and Sequence Studio) export their soundtrack on its own - compact MP3, M4A or Opus, or full-quality lossless WAV - encoded on your device.' },
      ] },
      { icon: ICONS.doc, title: 'Documents & data', keywords: 'pptx powerpoint keynote html markdown md txt json csv ics calendar vcf contact vcard', features: [
        { name: 'PowerPoint (PPTX)', desc: 'Multi-page and layout tools export an editable deck - each page decomposed into native text boxes, real shapes, and extractable images and vectors (logos embedded as real SVG). Built to hand a colleague content they can edit and reuse, not a flat screenshot.' },
        { name: 'HTML · MD · TXT', desc: 'HTML pastes formatted into mail clients; Markdown and plain text for content.' },
        { name: 'JSON · CSV · ICS · VCF', desc: 'Structured data straight from the input model - calendar invites, contacts, tabular and machine-readable payloads.' },
      ] },
      { icon: ICONS.zip, title: 'Bundles', keywords: 'zip archive multiple formats password encrypt download', features: [
        { name: 'ZIP', desc: 'Bundle several formats of one design into a single download - optionally password-locked (ZipCrypto or AES-256), with any PDF inside individually locked too.' },
      ] },
      { icon: ICONS.swatch, title: 'Design tokens & palettes', keywords: 'dtcg design tokens ase adobe swatch exchange gpl gimp inkscape krita css variables custom properties palette export brand colours', features: [
        { name: 'DTCG · ASE · GPL · CSS variables', desc: 'Export your brand palette as W3C design tokens (DTCG JSON), an Adobe Swatch Exchange (.ase) for Photoshop / Illustrator / InDesign, a GIMP · Inkscape · Krita .gpl, or ready-to-paste CSS custom properties - so the exact brand colours drop into any tool or codebase, no eyedropper.' },
      ] },
    ],
  },
  {
    flag: 'import', id: 'cap-import', title: 'Import formats', icon: ICONS.install,
    desc: 'Bring existing work in - photos, design files, tables and video. Every file is parsed on your device and never uploaded: design files open as an editable layout, images join your local library, and data fills a tool’s blocks.',
    cards: [
      { icon: ICONS.image, title: 'Images', shot: 'auth-catalogue-uploads', keywords: 'png jpg jpeg webp avif heic heif iphone photo exif gps strip gif apng animated svg sanitise', features: [
        { name: 'PNG · JPG · WebP · AVIF · HEIC/HEIF', desc: 'Drop a photo or graphic into any image picker or your <strong>My images</strong> library. Stills are downscaled and stripped of EXIF/GPS on ingest; iPhone HEIC/HEIF decodes even where the browser can’t, via a bundled fallback. AVIF reads wherever the browser decodes it.' },
        { name: 'Animated GIF · Animated PNG · Animated WebP', desc: 'Animated rasters are recognised and kept <em>verbatim</em> - frames intact - so a looping GIF or animated PNG stays animated when you place it.' },
        { name: 'SVG', desc: 'Vector artwork is sanitised - scripts, <code>on*</code> handlers and <code>javascript:</code> URLs are stripped - and normalised to a clean viewBox before it’s stored.' },
      ] },
      { icon: ICONS.vector, title: 'Design files', shot: 'design', shotExt: 'png', keywords: 'figma fig penpot illustrator ai indesign idml pdf sketch import layout editable', features: [
        { name: 'Figma · Penpot · Illustrator · InDesign · PDF', desc: 'Design imports a native Figma <code>.fig</code>, a Penpot export, an Illustrator <code>.ai</code> or any <code>.pdf</code>, and an InDesign <code>.idml</code> - each parsed in the browser into editable boxes. Text stays text, shapes stay shapes, complex art flattens faithfully.' },
        { name: 'Photoshop (PSD · PSB) · GIMP (XCF)', desc: 'Layered Photoshop and GIMP files open with their layers intact - each layer becomes an editable box - read on-device by the engine’s own PSD/XCF parsers, big PSB documents included.' },
        { name: 'Any SVG is the wide door', desc: 'Almost every design app can export SVG, so an SVG export becomes an editable, brand-conformed layout - the universal way in.' },
      ] },
      { icon: ICONS.doc, title: 'Data & animation', shot: 'auth-blocks-rows', keywords: 'csv json table rows paste spreadsheet lottie bodymovin dotlottie', features: [
        { name: 'CSV · JSON', desc: 'Paste or drop a table and a tool’s repeating blocks fill from it - RFC 4180 CSV (quoted fields, embedded newlines) or JSON rows/arrays, up to a thousand rows.' },
        { name: 'Lottie (.json · .lottie)', desc: 'Bodymovin JSON and dotLottie animations validate and place as live vector animations.' },
      ] },
      { icon: ICONS.film, title: 'Video', keywords: 'mp4 mov webm footage clip verbatim transcode', features: [
        { name: 'MP4 · MOV · WebM', desc: 'Video files are stored <em>verbatim</em> - never transcoded - and their dimensions probed locally, ready to place in motion tools.' },
      ] },
      { icon: ICONS.credential, title: 'Content Credentials (verify)', shot: 'cc-verify-drop', keywords: 'c2pa verify provenance manifest signature authenticity cai check', features: [
        { name: 'Read provenance from any file', desc: 'Verify checks a signed <a href="https://c2pa.org" target="_blank" rel="noopener">C2PA</a> manifest embedded in PDF, PNG/APNG, JPG, GIF, SVG, TIFF, WebP, AVIF, MP4 and WebM/MKV - cryptographically, entirely on-device. See <a href="#/verify">Verify</a>.' },
      ] },
    ],
  },
  {
    flag: 'print', id: 'cap-print', title: 'Print production', icon: ICONS.printer,
    desc: 'Press-ready output computed entirely on-device - the engine owns the dimension and colour maths, and each shell draws it. No print service, no upload.',
    cards: [
      { icon: ICONS.ruler, title: 'Physical sizing', shot: 'um-units-a4', keywords: 'mm cm inch points picas dpi resolution 300 size dimensions bleed page', features: [
        { name: 'Real units & DPI', desc: 'Set width × height in <code>mm/cm/in/pt/pc</code> at a DPI (default 300). PDF becomes a true page, raster renders the exact pixel count (and embeds the resolution), SVG keeps the physical unit with a px viewBox.' },
      ] },
      { icon: ICONS.layers, title: 'Multi-page documents', keywords: 'pages a4 letter a5 portrait landscape cover paginate flow booklet', features: [
        { name: 'Real pages, not one long image', desc: 'A tool can build a paginated PDF - a cover, content, and a back page - where every page is a true, separately-sized PDF page (A4, US Letter or A5; portrait or landscape).' },
        { name: 'Content that flows', desc: 'Text and image blocks flow onto as many pages as they need; new pages are created automatically, with a manual page break where you want one. See the <strong>Multi-Page PDF</strong> tool.' },
        { name: 'Vector & lockable', desc: 'Each page is drawn as vectors with text outlined to paths (so it renders without the font), and the document can carry a password (a basic link-lock or strong AES-256). These are RGB documents; crop/bleed marks stay on the single-page <em>Print PDF</em> path.' },
      ] },
      { icon: ICONS.swatch, title: 'CMYK colour', keywords: 'cmyk devicecmyk separation ink press conversion brand swatch', features: [
        { name: 'DeviceCMYK output', desc: 'Print PDF and CMYK TIFF write CMYK, not RGB.' },
        { name: 'Exact brand inks', desc: 'Brand swatches with measured CMYK values are substituted exactly; other colours use a standard device conversion.' },
      ] },
      { icon: ICONS.id, title: 'Press conditions', keywords: 'outputintent fogra39 fogra51 swop icc rip coated uncoated profile', features: [
        { name: 'OutputIntent', desc: 'A CMYK PDF declares its target press condition (Coated FOGRA39 by default; FOGRA51, SWOP and more) so a RIP knows how the inks are meant to read. On-screen and raster stay sRGB.' },
      ] },
      { icon: ICONS.marks, title: 'Bleed & marks', shot: 'exp-print-marks-card', keywords: 'crop marks registration trimbox bleedbox trim plate printer', features: [
        { name: 'Trim, bleed & marks', desc: 'Add bleed (with declared TrimBox/BleedBox) plus crop, registration and bleed marks in the margin; registration prints on every plate.' },
      ] },
      { icon: ICONS.swatch, title: 'Colour bars', keywords: 'colour bar calibration verification strip process control operator', features: [
        { name: 'Calibration + verification', desc: 'A solid C/M/Y/K process strip to calibrate against, then RGB↔CMYK pairs for the brand inks actually used - so a press operator can confirm the conversion landed.' },
      ] },
      { icon: ICONS.stamp, title: 'Provenance stamps', keywords: 'timestamp made with credit annotation proof margin trimmed', features: [
        { name: 'Proof-margin credits', desc: 'Optional timestamp, “Made with…”, and tool/author credit in the margin - a proof annotation, trimmed at the final cut.' },
      ] },
      { icon: ICONS.lock, title: 'Lockable output', shot: 'exp-pdf-password', keywords: 'password protect pdf encrypt aes open password', features: [
        { name: 'Password-protect the press file', desc: 'Any PDF - including Print and CMYK PDFs - can carry a <strong>Standard</strong> (40-bit, link-embeddable) or <strong>Strong</strong> (AES-256) open-password. Full PDF, zip and share-link encryption lives under <strong>Security &amp; access control</strong> below.' },
      ] },
    ],
  },
  {
    flag: 'automation', id: 'cap-automation', title: 'Automation & AI', icon: ICONS.bot,
    desc: 'Built to be driven by scripts, pipelines and agents as easily as by a person.',
    cards: [
      { icon: ICONS.terminal, title: 'CLI & pipelines', shot: 'vt-d3-url-chart', keywords: 'ci cd build script og image social card generate makefile github actions', features: [
        { name: 'Generate at build time', desc: 'Produce OG images, QR codes, social cards and data visuals from the command line - repeatably, as part of CI, instead of checking binaries into Git.' },
      ] },
      { icon: ICONS.url, title: 'URL mode', shot: 'ov2-url-palette', keywords: 'query params link api get request deep link parameters reserved', features: [
        { name: 'Everything is a parameter', desc: 'Inputs plus reserved controls - <code>format</code>, <code>export</code>, <code>copy</code>, size/unit/dpi, bleed and marks - all expressible in a link.' },
      ] },
      { icon: ICONS.bot, title: 'AI agents', shot: 'um-compact-shortkeys', keywords: 'llm ai prompt tokens deterministic cheap no drift hallucination', features: [
        { name: 'Cheap & deterministic', desc: 'A parameterised URL is a few tokens and always renders the same press-quality result locally - no prompt drift, no stochastic surprises in production.' },
      ] },
      { icon: ICONS.ask, title: 'Ask the app', keywords: 'ask help question answer citation retrieval manual docs quote no hallucination chatbot', features: [
        { name: 'The manual’s own words', desc: 'Ask a question and the answer is a sentence retrieved from the documentation, quoted with a link to its source - never a generated guess. The AI stance, running inside the product it describes.' },
      ] },
      { icon: ICONS.image, title: 'On-device AI & media', keywords: 'ai upscale onnx webgpu background removal alpha matte text to speech kokoro tts audio reactivity local machine no server', features: [
        { name: 'Runs on your machine, never a server', desc: 'The AI touches are local: <strong>image upscaling</strong> (ONNX / WebGPU) and <strong>background removal</strong> (alpha matte), a bundled <strong>text-to-speech</strong> voice (Kokoro) that returns audio with word timings for captions, and <strong>audio reactivity</strong> that reads a finished clip into a per-frame track to drive motion. No prompt, no upload - and an AI-generated or AI-enhanced result records that in its Content Credential (an IPTC digital-source-type), so the provenance is never laundered away.' },
      ] },
      { icon: ICONS.mcp, title: 'MCP server (add-on)', keywords: 'model context protocol agent claude ide connector oauth bearer token render', features: [
        { name: 'Native agent endpoint', desc: 'An optional <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">Model Context Protocol</a> server that any MCP client - an agent runtime, an IDE, a script - connects to: discover a tool, fill its declared inputs, and get back a finished file plus an editable link. Tools sync as data, so it needs no app update.' },
        { name: 'Every format an agent asks for', desc: 'One <code>lolly_render</code> call returns vector (SVG/PDF/EPS/DXF), raster (PNG/JPG/WebP/AVIF/TIFF), motion (MP4/WebM/GIF/APNG/Animated WebP/Animated SVG), documents (PowerPoint) or data - the server picks how to render each; the agent just names a format the tool declares.' },
        { name: 'A hosted add-on - not offline or edge', desc: 'Unlike the rest of Lolly, the MCP server is a <strong>server-side component</strong>: producing the full format range drives a headless browser against a built web shell, so it runs as a hosted service and is <strong>not suitable for offline or edge deployments</strong>. The on-device shells - web, desktop, mobile and CLI - stay the offline / air-gapped path.' },
        { name: 'Connect any MCP client', desc: 'Register the hosted endpoint as a <strong>custom connector</strong> (OAuth 2.1) in any client that supports one, or point an MCP-capable agent or IDE at it with a bearer token. Either way the client authenticates before it can render, and access is verified statelessly on every call - no session store to breach. See <strong>Security &amp; access control</strong>.' },
      ] },
    ],
  },
  {
    flag: 'determinism', id: 'cap-determinism', title: 'Determinism & reproducibility', icon: ICONS.repeat,
    desc: 'The same inputs produce the same file - on every device, today and next year. Output is a build artifact, not a stochastic guess.',
    cards: [
      { icon: ICONS.repeat, title: 'One render path', keywords: 'deterministic one render path engine web mobile desktop cli same output no drift', features: [
        { name: 'No surprises', desc: 'Web, mobile, desktop and CLI share the engine; there is one code path that turns inputs into a file.' },
      ] },
      { icon: ICONS.url, title: 'URL = state', keywords: 'url state parameter reproducible link commit diff regenerate deterministic', features: [
        { name: 'Reproducible from a link', desc: 'Every input is expressible as a URL parameter, so a link reproduces the design exactly - commit it, diff it, regenerate on demand.' },
      ] },
      { icon: ICONS.tag, title: 'Version pinning', keywords: 'version pin _v forward compatible saved link stable tool version', features: [
        { name: 'Forward-compatible', desc: 'Pin a tool version with <code>_v</code> so a saved link keeps rendering the way it did when you made it.' },
      ] },
      { icon: ICONS.shield, title: 'Auditable', keywords: 'auditable reviewable no model no server no randomness inspectable version control reproducible', features: [
        { name: 'Reviewable output', desc: 'No model, no server and no randomness in the render path - outputs are inspectable and version-controllable.' },
      ] },
    ],
  },
  {
    flag: 'brand', id: 'cap-brand', title: 'Brand & design system', icon: ICONS.swatch,
    desc: 'Design decisions are locked at the template level; only the inputs that are meant to vary are exposed - so whatever anyone makes stays inside the rules the author set.',
    cards: [
      { icon: ICONS.brush, title: 'Constraint-first tools', shot: 'aud-approve-the-tool', keywords: 'guardrails brand guidelines compliance lock template author', features: [
        { name: 'Guardrails, not guidelines', desc: 'Authors hard-code typography, colour and spacing; users just fill in content. The tool is the brand guardrail.' },
      ] },
      { icon: ICONS.swatch, title: 'Tokens, themes & palette', shot: 'bs-token-editor', keywords: 'design tokens dtcg theme palette colour picker cmyk swatch variables', features: [
        { name: 'Defined once, used everywhere', desc: 'Shared design tokens and multiple themes; the brand palette appears in every colour picker, with measured CMYK ink values where known.' },
      ] },
      { icon: ICONS.globe, title: 'Design system from a website', keywords: 'design system website url read extract colours type logo brand from url scrape import extension desktop', features: [
        { name: 'One page, read on your device', desc: 'The Design System studio can take a web address and read that one page into candidates: the colours it declares, the type it sets, the name it calls itself and its icon and logo files. Nothing is added until you pick it from the tray. One page only, no crawling, no link followed.' },
        { name: 'Where it works, and why not everywhere', desc: 'A web page cannot fetch another site (the browser stops it), and Lolly runs <strong>no server</strong> that would do it for you, so this needs a reader that already lives on your device. Two do: the <strong>desktop and mobile apps</strong>, which fetch the page directly and signed in to nothing, and <strong>Chromium with the Lolly extension</strong>, which reads it in a background tab, signed in as you are in that browser. With neither installed the source is simply not shown, because it could not work.' },
        { name: 'The button is the consent', desc: 'Nothing is fetched until you press Read, and the button names the host it is about to read plus who does the reading. A shared link can fill the address in for you; it can never start the read.' },
        { name: 'Or bring the material yourself', desc: 'Without one of those readers the <strong>colours</strong> still get in, and only the colours: paste a block of CSS or a list of colours into Add a colour, or drop a screenshot as an image source and the colours it is painted with are read on your device. The typefaces, the name and the logo files are what a page read brings that nothing else does; add a font file in Type and a mark in Logos to cover those by hand.' },
      ] },
      { icon: ICONS.circles, title: 'Themable icons & backgrounds', shot: 'aud-brand-catalogue', keywords: 'icon library recolour two colour background pattern decorative pairing', features: [
        { name: 'Recolour to any brand pairing', desc: 'A library of two-colour icons and decorative backgrounds that recolour to a chosen brand pairing right in the asset picker; the colour choice rides in the asset id, so it round-trips through URL mode and re-bakes on every render.' },
      ] },
      { icon: ICONS.font, title: 'Bundled type', shot: 'bs-type-specimen', keywords: 'font variable ttf otf woff google fonts upload family weight local', features: [
        { name: 'Local variable fonts', desc: 'SUSE and SUSE Mono ship with the app - no webfont or CDN dependency at render time.' },
      ] },
      { icon: ICONS.user, title: 'Personalisation', shot: 'pd-use-my-details', keywords: 'profile name email headshot prefill bind opt in signature', features: [
        { name: 'Bind to your profile', desc: 'Any input can pre-fill from your saved name, contact details or headshot (opt-in); override per session.' },
      ] },
      { icon: ICONS.tag, title: 'Maturity tags', shot: 'fq-experimental-badge', keywords: 'official community experimental watermark status review approved', features: [
        { name: 'Approved by default', desc: 'Every tool declares official / community / experimental; experimental tools watermark their exports - applied by the host, so it can’t be edited out.' },
      ] },
    ],
  },
  {
    flag: 'privacy', id: 'cap-privacy', title: 'Privacy & data ownership', icon: ICONS.shield,
    desc: 'Creative production stays on the device, under your control - rendering, storage and export never require a server. The optional hosted add-ons are listed separately.',
    cards: [
      { icon: ICONS.shield, title: 'On-device by default', shot: 'pv-ondevice-badge', keywords: 'no cloud local analytics telemetry tracking server private', features: [
        { name: 'No cloud rendering', desc: 'No analytics, no telemetry, and rendering happens locally - what you create is stored on your machine, not on a server.' },
      ] },
      { icon: ICONS.device, title: 'Local storage', shot: 'pd-storage-meter', keywords: 'indexeddb browser database quota clear storage usage sessions', features: [
        { name: 'Your browser’s database', desc: 'Profile, saved sessions, uploaded images and the catalogue cache live in IndexedDB; Storage tools show usage and let you clear it.' },
      ] },
      { icon: ICONS.image, title: 'Image hygiene', shot: 'aud-strip-data', keywords: 'exif gps metadata strip downscale my images library location', features: [
        { name: 'Stripped & local', desc: 'Images you add are downscaled and stripped of EXIF/GPS, then kept in a local My images library - never uploaded.' },
      ] },
      { icon: ICONS.credential, title: 'Content Credentials', shot: 'exp-c2pa-card', keywords: 'c2pa cai provenance sign manifest tamper evident authorship', features: [
        { name: 'Signed, tamper-evident provenance', desc: 'Exports can carry a signed <a href="https://c2pa.org" target="_blank" rel="noopener">C2PA</a> manifest - the <a href="https://contentauthenticity.org" target="_blank" rel="noopener">Content Authenticity Initiative</a> standard for tamper-evident provenance - created entirely on your device, so a file can prove what made it without any cloud signing service. PDF, PNG, JPG, GIF, SVG, TIFF, WebP, MP4 and WebM all take the credential, recording the tool, the author (profile opt-in) and where the export happened; <a href="#/verify">Verify</a> checks any file on-device.' },
      ] },
      { icon: ICONS.shield, title: 'On-device utilities', shot: 'use-utilities', keywords: 'strip hidden data metadata remove clean pdf jpeg png svg transform file', features: [
        { name: 'File in → clean file out', desc: 'Content-transform utilities take a file you supply, process it entirely on your device and hand back a cleaned copy - never uploaded, never watermarked. Strip Hidden Data removes EXIF/GPS, camera, author and editor metadata from JPEG, PNG, SVG and PDF. This replaces handing confidential files to single-purpose websites.' },
      ] },
      { icon: ICONS.lock, title: 'Self-host / air-gap', keywords: 'firewall on premise intranet offline deploy static no backend', features: [
        { name: 'No backend for rendering', desc: 'The shells render, export and store everything on-device - no server-side render pipeline, no database. Deploy on your own infrastructure and run entirely behind your firewall; the optional hosted add-ons (the MCP endpoint, identity enrolment) are separate opt-in services you can omit.' },
      ] },
    ],
  },
  {
    flag: 'security encryption', id: 'cap-security', title: 'Security & access control', icon: ICONS.lock,
    desc: 'When work does leave the device - a share link, a download, a PDF - you decide who can open it. Every lock is applied on-device, and passwords and keys are never sent to a server.',
    cards: [
      { icon: ICONS.link, title: 'Password-gated links', keywords: 'encrypted share link aes gcm pbkdf2 password recipient ciphertext', features: [
        { name: 'Encrypted share links', desc: 'Any share link can be encrypted: the design is AES-256-GCM-encrypted under a key stretched from the password with PBKDF2-SHA256 (210k iterations). The link carries <em>only</em> the ciphertext - opening it prompts the recipient for the password and rebuilds the design in their browser. The password never travels in the link and never reaches a server - the server sees only ciphertext in the URL, and decryption happens entirely in the recipient’s browser.' },
      ] },
      { icon: ICONS.lock, title: 'Locked PDFs', shot: 'cc-pdf-lock', keywords: 'pdf password encrypt aes 256 rc4 40 bit open password acrobat', features: [
        { name: 'Two lock strengths', desc: 'A PDF can carry a <strong>Standard</strong> open-password (a basic 40-bit lock that opens in any PDF app and can ride in a share link - a deterrent for short-lived material) or a <strong>Strong</strong> one (AES-256; opens in newer PDF apps only, and its password is typed at export, never in a link). Strong locks also apply to Print/CMYK and multi-page PDFs.' },
      ] },
      { icon: ICONS.zip, title: 'Locked downloads', keywords: 'zip encryption zipcrypto winzip aes 7zip windows explorer unzip', features: [
        { name: 'Whole-zip encryption (defense-in-depth)', desc: 'A folder or multi-file download can lock the whole zip - <strong>Standard</strong> (ZipCrypto; opens in any unzip tool including Windows Explorer) or <strong>Strong</strong> (WinZip AES-256; needs 7-Zip / WinZip / macOS, not Windows Explorer’s built-in extract). One password protects <em>every</em> member - images and all - and any PDFs inside are <em>also</em> individually AES-256-locked, so they stay locked even after the zip is unpacked.' },
      ] },
      { icon: ICONS.shield, title: 'Reviewed tools', keywords: 'sandbox isolation worker hooks host bridge allowlist network review first party', features: [
        { name: 'One portable contract', desc: 'A tool’s optional logic is written against the <code>host.*</code> bridge - the supported, portable API for storage, network and export - and its calls are time-boxed. This is a portability contract, not an isolation boundary: every tool in the catalogue is first-party and reviewed before it ships, and stronger Worker-based isolation is on the roadmap.' },
        { name: 'Allowlisted network by policy', desc: '<code>host.net</code> is the sanctioned network path for tools, allowlisted per the tool’s manifest, and tool templates are logic-less with escaping on by default. Network use outside the allowlist is a review failure, caught before a tool ships.' },
      ] },
      { icon: ICONS.mcp, title: 'Access-controlled agent endpoint', keywords: 'oauth 2.1 pkce bearer token connector mcp stateless session', features: [
        { name: 'OAuth 2.1 on the MCP server', desc: 'The optional hosted MCP server is gated by <strong>OAuth 2.1</strong> - register it as a custom connector in any MCP client, or bring a bearer token from an MCP-capable agent or IDE. Client registration, authorization codes and tokens are short-lived signed values (PKCE-protected) verified on each call, so there is no session store to breach. The on-device shells need no server at all and stay behind your firewall.' },
      ] },
      { icon: ICONS.credential, title: 'Tamper-evident provenance', keywords: 'c2pa verify signature integrity chain of custody', features: [
        { name: 'Prove what made a file', desc: 'Exports can carry a signed, on-device <a href="https://c2pa.org" target="_blank" rel="noopener">C2PA</a> credential recording the tool, author and export - no cloud signing service - and <a href="#/verify">Verify</a> checks any file locally. See <strong>Privacy &amp; data ownership</strong>.' },
      ] },
    ],
  },
  {
    flag: 'architecture', id: 'cap-architecture', title: 'Architecture (for builders)', icon: ICONS.bridge,
    desc: 'The structure that makes the rest possible: tools are data, not bundled code, so new tools ship without an app update.',
    cards: [
      { icon: ICONS.doc, title: 'Declarative tools', shot: 'aud-manifest-controls', keywords: 'manifest template handlebars hooks json schema inputs declared authoring', features: [
        { name: 'Manifest + template + hooks', desc: 'A tool is a manifest, a template and optional hooks; inputs are declared, not inferred. Non-developers can author the template; hooks are the escape hatch for real logic.' },
      ] },
      { icon: ICONS.bridge, title: 'Capability bridge', keywords: 'host api versioned contract profile assets state clipboard export text net tokens pdf capture compose audio media recorder', features: [
        { name: 'One tool, every shell', desc: 'Tools call a versioned <code>host.*</code> API - profile, assets, state, clipboard, export and text-to-path, plus optional capability-gated extras (design tokens, PDF tools, page capture, network, tool composition, layered PSD write, exact vector geometry, perceptual colour, on-device image codecs, camera/mic capture, speech, upscale and background-removal) - and never touch the DOM, filesystem or network directly, which is why one tool runs unchanged in browser, Tauri and CLI.' },
      ] },
      { icon: ICONS.cube, title: 'Tool composition', keywords: 'compose nested render embed recursion depth guard reuse', features: [
        { name: 'Tools compose tools', desc: 'A tool can embed another tool’s rendered output as an image - declared in the manifest (<code>composes</code>) and placed with <code>{{asset …}}</code>. It renders through the same engine path, so the embed is pixel-identical, and recursion is depth- and cycle-guarded. One tool reuses another instead of copying its code.' },
      ] },
      { icon: ICONS.sync, title: 'Synced as data', shot: 'at2-catalogue-more-group', keywords: 'catalog sync manifest signed no app update ship tools', features: [
        { name: 'No app update needed', desc: 'Tools and assets sync from a signed manifest; new tools appear automatically on clients.' },
      ] },
      { icon: ICONS.id, title: 'Stable asset IDs', shot: 'at2-token-linked-swatch', keywords: 'permanent id contract rename version replacedby checksum', features: [
        { name: 'Permanent contracts', desc: 'An asset id is forever - never reused or renamed; versioning lives in the manifest, never the path.' },
      ] },
      { icon: ICONS.open, title: 'Open-source engine', keywords: 'mpl licence open source engine schemas docs brand separate', features: [
        { name: 'MPL-licensed core', desc: 'The engine, shells, schemas and docs are designed to be open-sourceable; brand content stays separate.' },
      ] },
    ],
  },
];
