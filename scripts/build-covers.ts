#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Pose the landing's Cover Flow (docs/site/covers.json, plans/177 beat 2).
 *
 * Run as: node scripts/build-covers.ts [--url=http://localhost:5173] [--only=a,b]
 *                                       [--stills] [--videos] [--headed] [--list]
 *
 * Every cover is the app or a file it made, and each one wears a colourway of Lolly
 * Demo, the sample design system lolly.tools opens with (brands/lolly-demo): Spearmint,
 * Morning, Spring, Beach, Afternoon or Midnight, in the light, dark or brand look. The
 * run chooses the colourway the way a person does, on the Appearance card of Settings
 * ("Your colourway"), which leads the app's chrome, sets the look through the same
 * `theme` key the theme switch writes, and hands a tool its document's colourway and
 * mode through `_themes` on the link. Neighbouring covers wear different colourways
 * and alternate light and dark grounds, so the fan changes colour from card to card
 * (Andy, 2026-11-14: "different design system colours and a wider variety of
 * screenshots that work well for the tool or view or utility it represents
 * composition wise").
 *
 * Five kinds of cover:
 *   - a still of the app, a 1200x900 CSS viewport at 2x shrunk to 1040x780 WebP (the
 *     card is 520x390 CSS on the landing, 4:3, so 2x device pixels);
 *   - a phone composition (`phone`): the view at a 390x844 phone viewport, one shot
 *     per entry, set side by side on a ground in the colourway's own colours;
 *   - the tool's own export (`exportStill`, `exportVideo`), so the card is the file;
 *   - a vector screenshot of an app view through the DOM-to-SVG walker (`walkerSvg`);
 *   - a `crop` of the render alone.
 * Output goes to docs/shots/covers/. `covers.json` is hand-edited to point at it;
 * this script never touches the copy. Each cover's `hue` in covers.json is the
 * OKLCH hue of the lead colour it wears (`--list` prints it), and lib/covers-flow.ts
 * opens the fan on the cover nearest the reader's own accent.
 *
 * Two covers keep an older pose: Audiogram and 3D Studio wear a design system
 * derived a hue apart (`derivedHue`, the engine's deriveBrandTokens, installed through
 * the loopback hook `window.__lollyInstallBrand` in shells/web/src/main.ts), because
 * their loops are kept as Andy approved them.
 *
 * Needs a running web shell on the lolly-demo profile, the one lolly.tools ships
 * (`LOLLY_PROFILE=lolly-demo pnpm run dev:web`): the colourways belong to Lolly Demo,
 * and SUSE tools and assets must never reach a cover. ffmpeg on PATH for the loops.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { deriveBrandTokens, hexToOklch, oklchToHex, parseOklch } from '../engine/src/brand-derive.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { artC2paOpts, artDims, stripArtManifest, type ArtMeta } from './sign-docs-art.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'docs/shots/covers');
/** Lolly Demo's tokens: the colourways and the Opal colours they point at. */
const DEMO_TOKENS = resolve(ROOT, 'brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');

/** The card's device-pixel size on the landing: 520×390 CSS at 2×. */
const OUT_W = 1040;
const OUT_H = 780;
/** Capture viewport - 4:3 like the card, at a desktop layout width. */
const VIEW_W = 1200;
const VIEW_H = 900;
/** A phone viewport (an iPhone's CSS size), captured at 2×. */
const PHONE_W = 390;
const PHONE_H = 844;
const LOOP_SECONDS = 6;
/** OKLCH hue of the lolly-start primary - what `{shift:}` colours were authored against
 *  (the same constant `lib/covers-flow.ts` opens the fan on when there is no brand). */
const LOLLY_HUE = 157.2;

/** The look a cover is posed in: the app's Light, Dark or Brand theme. */
type Look = 'light' | 'dark' | 'brand';

/** What a cover wears: one of Lolly Demo's colourways in a look, or (the two kept
 *  loops) a brand derived at an OKLCH hue. */
type Wear = { colourway: string; look: Look } | { derivedHue: number; light?: number };

interface CoverPose {
  /** File stem under docs/shots/covers/. */
  slug: string;
  wear: Wear;
  /** App route to pose (hash + query, URL-mode inputs included). With a colourway,
   *  `{lead}`, `{onLead}`, `{partner}`, `{surface}` and `{ink}` become that
   *  colourway's colours in the pose's look (URL-encoded hexes), and a tool route
   *  gets `_themes` for the colourway and the mode unless it carries its own. With a
   *  derived brand, `{primary}`, `{primaryDark}` and `{primaryLight}` are its ramp
   *  steps 5, 3 and 8, and `{shift:rrggbb}` is that colour rotated in OKLCH by the
   *  pose's distance from the lolly-start hue. Token references
   *  (`{color.semantic.muted}`) pass through and resolve inside the app. */
  route: string;
  /** The document's mode when it differs from the look's (`light` for a dark-chrome
   *  pose whose render should stay on paper). */
  docMode?: 'light' | 'dark';
  /** Selector that must be present before the shot (after any `drive` clicks);
   *  tool routes default to the canvas. */
  wait?: string;
  /** Quiet time after the selector appears, ms (rendering, fonts, decode). */
  settleMs?: number;
  /** Record a loop of this many seconds instead of a still (a screen recording
   *  of the app, 30 fps VP9 - the tile shows the app in motion). */
  video?: number;
  /** Ask the TOOL to export instead of photographing the app: the pose opens the
   *  export panel on the format (`format=<f>&options` on the route, the card's
   *  pixel size as `width`/`height`), sets any video knobs and clicks Download,
   *  so the tile is the render itself. `exportVideo` makes `<slug>.mp4` at the
   *  tool's deterministic frame clock - 60 fps H.264, not a 30 fps recording of
   *  the app around it. `exportStill` makes the still: 'svg' ships `<slug>.svg`
   *  as the cover (crisp at every card size); 'png' becomes `<slug>.webp`, or
   *  the video's `<slug>-poster.webp` when both are set. A video with no still
   *  takes its poster from a frame of the file. */
  exportVideo?: { fps: number; seconds: number; quality?: 'smaller' | 'balanced' | 'best' };
  exportStill?: 'png' | 'svg';
  /** For an SVG export whose page is not 4:3 (the QR badge is portrait): the colour
   *  (a placeholder or a hex) that fills the rest of the card. Every SVG export, wrapped
   *  or not, is then signed with the docs figures' claim (`signCover`). */
  svgGround?: string;
  /** Capture the APP VIEW as vector: the web shell's DOM-to-SVG walker (the same
   *  `__lollyWalkerShot` loopback hook the docs screenshots use), windowed to the
   *  viewport, saved as `<slug>.svg`. For a cover of an app surface that should
   *  stay crisp at every card size. */
  walkerSvg?: boolean;
  /** The view on a phone: one 390x844 shot per entry (each entry's `drive` clicks run
   *  on a fresh load of the route), set side by side on `ground` (a placeholder or a
   *  hex) with rounded corners and a soft shadow, saved as `<slug>.webp`. */
  phone?: { ground: string; shots: Array<{ drive?: string[] }> };
  /** Capture-only CSS (hide a control that reads as noise at card size). */
  css?: string;
  /** Selectors to click, in order, once the route has loaded (open a panel the
   *  URL cannot) - each waits for its element, then a beat for the UI to settle. */
  drive?: string[];
  /** Photograph only this element instead of the viewport - for a cover that is
   *  the tool's OUTPUT rather than the app around it (pair with `?full`, which
   *  drops the chrome and lets the render fill the stage). */
  crop?: string;
  /** Not re-posed by a plain run: the file in docs/shots/covers is the one that
   *  ships (Andy's own export, or a loop kept as approved). Only `--only=<slug>`
   *  poses a kept cover again. */
  kept?: string;
}

/**
 * Seventeen poses. The order here is the order in covers.json. Neighbours differ in
 * colourway and alternate light and dark grounds; Design in Spearmint light sits
 * near the middle, nearest Lolly's own hue, so a fresh reader meets the fan there.
 */
const POSES: CoverPose[] = [
  // The lorikeet with the portrait film look, in Afternoon's brand look: red earth chrome.
  { slug: 'darkroom', wear: { colourway: 'afternoon', look: 'brand' }, route: '#/tool/darkroom?filmLook=portrait', settleMs: 5000 },
  // The render alone as the tool's SVG export (Andy, 2026-09-03): the Lolly logo
  // through the halftone with a colour-blend treatment in Spring's Fuchsia, on Donut.
  { slug: 'filter', wear: { colourway: 'spring', look: 'light' },
    route: '#/tool/filter?effect=halftone&image=lolly%2Flogo%2Freverse&ht_gridSize=24&ht_dotScale=1.4&ht_smoothing=0&ht_invert=true&ht_brightness=14&ht_gamma=1.5&ht_fit=cover'
      + '&pz_steps=8&pz_quality=90&pz_smoothing=100&pz_resample=true&pz_brightness=5&pz_bgColor=%23f39dbd&contrast=50&hue=38&saturation=106&lightness=1'
      + '&treatmentColor={lead}&blendMode=color&treatmentIntensity=100'
      + '&ht_transparentBg=false&ht_bgColor=%23f39dbd',
    settleMs: 5000, exportStill: 'svg' },
  // The new 3-D charts as the chart alone (Andy, 2026-11-14: "just have the chart not
  // the UI and no title for the chart"): the glass bars template's values with no
  // heading, Lagoon, Bark and Outback glass on a night stage, in Beach's light look.
  // Still, so the export is the finished pose rather than a frame of the camera sweep.
  // No legend: the 3-D scene draws it along the bottom, under the card's caption, and
  // the rows already carry the series names (First, Second and Final wave).
  { slug: 'chart', wear: { colourway: 'beach', look: 'light' },
    route: '#/tool/chart?renderMode=scene&chartType=bar&sceneType=bar3d&chartStyle=glass-3d&sceneMaterial=glass&sceneStage=night&showLegend=false'
      + '&data=' + encodeURIComponent('Team,First wave,Second wave,Final wave\nDesign,42,51,63\nEngineering,58,66,74\nSales,33,47,59\nSupport,27,39,52'),
    settleMs: 9000, exportStill: 'svg' },
  // Certificate (plan 341): the certificate itself, the tool's SVG export, in Morning.
  // Lolly Demo carries logos, so the certificate's logo stays on.
  { slug: 'certificate', wear: { colourway: 'morning', look: 'light' }, route: '#/tool/certificate?certKind=completion&style=classic', settleMs: 4000, exportStill: 'svg' },
  // The render alone (Andy, 2026-09-03): the card's theme colours carry the cover, so
  // the app chrome around it is dropped and the export fills the frame.
  { slug: 'snippet', wear: { colourway: 'spring', look: 'dark' }, route: '#/tool/snippet?language=typescript&fileName=make-a-card.ts&code=%2F%2F%20Every%20input%20is%20a%20URL%20param%20-%20the%20CLI%20is%20URL%20mode%0Aconst%20card%20%3D%20new%20URL%28%27https%3A%2F%2Flolly.tools%2Ftool%2Fqr-code.svg%27%29%3B%0Acard.searchParams.set%28%27url%27%2C%20%27https%3A%2F%2Flolly.tools%27%29%3B%0Acard.searchParams.set%28%27color%27%2C%20brand.primary%29%3B%0A%0Aconst%20svg%20%3D%20await%20fetch%28card%29.then%28%28r%29%20%3D%3E%20r.text%28%29%29%3B&full', crop: '#tool-canvas', settleMs: 4000 },
  // The QR code dressed up (Andy, 2026-11-14: "the qr code can use the colourway and
  // various effects"): fluid modules, leaf eyes, a radial fill from Liquorice to
  // Jacaranda, the mono Lolly mark in a circle and the badge frame, on Swell (the
  // colourway's partner in the dark look), as the tool's SVG export.
  { slug: 'qr-code', wear: { colourway: 'midnight', look: 'light' },
    route: '#/tool/qr-code?url=https://lolly.tools&ecl=H&moduleShape=fluid&join=true&eyeShape=leaf&eyeColor={partner}'
      + '&fill=gradient&color={lead}&color2={partner}&gradientType=radial&logo=lolly%2Flogo%2Fmono&logoShape=circle&logoScale=24'
      + '&frame=badge&frameText=Scan%20me&background=%23b6f1f1',
    settleMs: 4000, exportStill: 'svg', svgGround: '%23b6f1f1' },
  // The 3D Studio scene Andy composed for this slot (2026-09-23): a "Lolly" badge
  // beside a sphere and a box, iridescent and chrome over a dark blue gradient
  // backdrop, hovering while the camera sweeps. The TOOL exports it as a 3 s loop
  // at the card's own size, so the tile plays the render and none of the app.
  //
  // The tile in docs/shots/covers is ANDY'S OWN export of this scene (800x600,
  // 30 fps, 3 s), transcoded to H.264 for the card; this pose is the reproducible
  // recipe for it, not the bytes that shipped. Re-running it writes a 1040x780
  // capture over that file, so the pose is `kept` and only `--only=3d` runs the recipe.
  //
  // The scene arrived as a ?z= link authored on the SUSE profile, and four of its
  // colours were SUSE token refs - color.ramp.blue.6, color.spectrum.marigold,
  // color.spectrum.lime and color.brand.waterhole. They are written here as the
  // hexes those tokens resolve to, because covers pose on lolly-demo, where the
  // SUSE namespaces do not exist and the refs would not resolve. colorB stays a
  // semantic ref so material B follows the posed brand, and the scene's unused
  // suse/model/geeko asset ref is dropped (source is text, not a model).
  { slug: '3d', wear: { derivedHue: 247.5 }, kept: "Andy's own export of the scene, approved 2026-11-14",
    route: '#/tool/3d-studio?controls=expert&source=text&words=Lolly&wordWeight=100&wordTracking=-0.09'
      + '&subjects=Badge,primitive,,badge,auto,false,25,14,29,1,,,0,0,0,false,0,1,0,0,,,inherit'
      + '~Sphere,primitive,,sphere,auto,false,25,14,29,1,,,0,0,0,false,0,1,0,0,,,inherit'
      + '~Box,primitive,,box,auto,false,25,14,29,1,,,0,0,0,false,0,1,0,0,,,inherit'
      + '&objects=Badge,primitive,,badge,auto,-1.2,0,0.3,0,12,0,0.55,true,true'
      + '~Sphere,primitive,,sphere,auto,1.05,0,-0.2,0,0,0,0.4,true,true'
      + '~Box,primitive,,box,auto,0.15,0,-1.7,0,28,0,0.45,true,true'
      + '&studio=custom&colorA=%2381aefc&colorB=%7Bcolor.semantic.primary%7D'
      + '&finishA=iridescent&finishB=matte&glow=0.25&surfaceFinishes=true'
      + '&faceFinishA=chrome&bevelFinishA=chrome&sideFinishA=iridescent&bevelFinishB=neon&sideFinishB=glow'
      + '&drama=0.45&softness=2.6&exposure=1.15&lightMotion=orbit&lightMotionAmount=0.1'
      + '&shape.depth=0.28&camera.azimuth=25.18017578125&camera.elevation=-33.416015625'
      + '&camera.zoom=2.5&camera.panX=0.05000000000000003&camera.panY=-0.4500000000000002'
      + '&background=031526&background2=294f6d&backdropStrength=0.75&floorColor=031526&shadowOpacity=0.15'
      + '&keyColor=214362&fillColor=%23fcb244&rimColor=%23a1ef8b&warmColor=%232453ff'
      + '&environment=desert&environmentIntensity=1.3&environmentRotation=18'
      + '&lights=directional,ffffff,-3,6,4,2,1.5,true'
      + '&outputMode=scene&motion=hover&motionAmount=0.5&motionRest=0.2'
      + '&cameraMotion=sweep&cameraAmount=0.3&cameraKeys=0,25,36,29,0.7,0,1.6,0,0~0,25,14,29,1,0,1.6,0,0'
      + '&duration=3',
    settleMs: 6000, exportVideo: { fps: 30, seconds: 3 } },
  // The Etiquette icons in Afternoon's dark look, painted in Afternoon's own pairing
  // with the group's Colours swatch.
  { slug: 'assets', wear: { colourway: 'afternoon', look: 'dark' }, route: '#/a?section=etiquette-icons', drive: ['.cat-dl-theme[data-theme="colourway-afternoon"]'], settleMs: 3500 },
  // The design poster from the docs shot recipe (docs/make-something.md): the
  // canvas state rides in ?z=, so it reproduces forever. Lolly's own green, in the
  // light look, nearest Lolly's hue: a fresh reader meets the fan here.
  { slug: 'design', wear: { colourway: 'spearmint', look: 'light' }, route: '#/tool/design?z=17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ', settleMs: 4000 },
  // The music generator on a phone (Andy, 2026-11-14: "the music tool ... could be the
  // mobile view"): the track editor beside the genre picker, in Morning's brand look,
  // on Honey. The seed is pinned, so the same tune is drawn every time.
  { slug: 'music', wear: { colourway: 'morning', look: 'brand' }, route: '#/music?style=spanish&seed=708188&bars=64', wait: '.ms-genre', settleMs: 3500,
    phone: { ground: '{lead}', shots: [{}, { drive: ['.ms-genre'] }] } },
  // MilkDrop with flexi's bouncing balls, driven by a starter loop - the tool's own
  // 60 fps export (Andy, 2026-09-03): the visual full-bleed behind centred type,
  // brand influence at full, so the card plays the clip and none of the app. The
  // palette LEADS with `accent`, which defaults to the brand's secondary - the
  // complement, so the sky-blue tile came out red - hence accent = the primary.
  // Kept as approved (Andy, 2026-11-14: "the audiogram and 3d studio ones look
  // really good"); `--only=audiogram` poses it again.
  { slug: 'audiogram', wear: { derivedHue: 202.5 }, kept: 'the loop Andy approved, 2026-11-14',
    route: '#/tool/audiogram?audio=zzfxm:7:lofi&style=milkdrop&vizLook=stock:flexi-bouncing-balls-double-mindblob-neon-mix&title=Save%20point&subtitle=Pixel%20Quest&layout=overlay-center&vizBrand=full&credit=false&captions=false&size=wide&accent={primary}&bg={primaryDark}', wait: '.lolly-viz-canvas', settleMs: 4000, exportVideo: { fps: 60, seconds: LOOP_SECONDS } },
  // The Colour Lab (#/lab): one colour reported in full, seeded with Jacaranda.
  { slug: 'lab', wear: { colourway: 'midnight', look: 'dark' }, route: '#/lab?c={lead}', settleMs: 5000 },
  // The design system studio's Colours room with Beach chosen, so the colourway list
  // and the In context poster both show Beach, in the dark look.
  { slug: 'colours', wear: { colourway: 'beach', look: 'dark' }, route: '#/start?area=color', wait: '.start', drive: ['[data-be-lead="beach"]'], settleMs: 3500 },
  // A city poster as the tool's own export: Ochre streets and Khaki water on Beach sand.
  { slug: 'street-map', wear: { colourway: 'afternoon', look: 'light' }, route: '#/tool/street-map?city=amsterdam&theme=light&roadColor={lead}&waterColor={partner}&background=%23f2e1bf', settleMs: 9000, exportStill: 'png' },
  // Logo Wall (plan 341): the sponsor wall in the app, eleven placeholder wordmarks in
  // three tiers traced to Liquorice on Honey, with Morning's dark chrome around them.
  { slug: 'logo-wall', wear: { colourway: 'morning', look: 'dark' },
    route: '#/tool/logo-wall?logos=' + encodeURIComponent(JSON.stringify([
      ['your-logo', 'Gold partners'], ['logo-here', 'Gold partners'],
      ['company', 'Silver partners'], ['sponsor', 'Silver partners'], ['brand-name', 'Silver partners'], ['sample-co', 'Silver partners'],
      ['example', 'Supporters'], ['lorem-ipsum', 'Supporters'], ['placeholder', 'Supporters'], ['partner-name', 'Supporters'], ['wordmark', 'Supporters'],
    ].map(([name, tier]) => ({ logo: `/tools/logo-wall/assets/${name}.svg`, tier }))))
      + '&vectorizeAll=true&transparentBg=false&background={lead}&inkColor={surface}&headingColor={surface}',
    docMode: 'dark', settleMs: 4000 },
  // Design's timeline (the Sequence cover): the feature-tour template, five timed
  // beats, in Spring's brand look. A Video-category template opens its own timeline,
  // so no drive click here (one would toggle it shut again).
  { slug: 'sequence', wear: { colourway: 'spring', look: 'brand' }, route: '#/tool/design?template=feature-tour', wait: '.tl-panel', settleMs: 4500 },
  // The Utilities shelf as a vector screenshot (Andy, 2026-09-03: "an svg screenshot
  // of the utilities view in the right colors"), in Midnight's brand look.
  { slug: 'utilities', wear: { colourway: 'midnight', look: 'brand' }, route: '#/utilities', wait: '.gallery-view, .gallery', settleMs: 3500, walkerSvg: true },
];

interface Opts { url: string; only: string[]; stills: boolean; videos: boolean; headed: boolean; list: boolean }
function parseOpts(argv: string[]): Opts {
  const o: Opts = { url: 'http://localhost:5173', only: [], stills: true, videos: true, headed: false, list: false };
  let kinds = 0;
  for (const a of argv) {
    if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--stills') { o.stills = true; o.videos = false; kinds++; }
    else if (a === '--videos') { o.videos = true; o.stills = false; kinds++; }
    else if (a === '--headed') o.headed = true;
    else if (a === '--list') o.list = true;
    else throw new Error(`Unknown option ${a}`);
  }
  if (kinds > 1) throw new Error('--stills and --videos are exclusive');
  return o;
}

/** The brand a kept loop wears: a derived design system whose primary sits at `hue`. */
function brandFor(wear: { derivedHue: number; light?: number }, slug: string): Record<string, unknown> {
  const l = Math.round((wear.light ?? 0.6) * 100);
  return deriveBrandTokens({
    primary: `oklch(${l}% 0.16 ${wear.derivedHue})`,
    scheme: 'complement',
    surface: 'light',
    name: `Cover ${slug} (${wear.derivedHue}°)`,
  }) as Record<string, unknown>;
}

/** A primary-ramp step of a derived doc as #rrggbb (the derive writes oklch()). */
function rampHex(doc: Record<string, unknown>, step: number): string {
  const base = doc.base as Record<string, unknown> | undefined;
  const color = base?.color as Record<string, unknown> | undefined;
  const ramp = color?.ramp as Record<string, unknown> | undefined;
  const primary = ramp?.primary as Record<string, { $value?: string }> | undefined;
  const value = primary?.[String(step)]?.$value;
  const parsed = value ? parseOklch(value) : null;
  if (!parsed) throw new Error(`derived doc has no color.ramp.primary.${step}`);
  return oklchToHex(parsed);
}

type Rec = Record<string, unknown>;
let _demo: Rec | null = null;
function demoTokens(): Rec {
  _demo ??= JSON.parse(readFileSync(DEMO_TOKENS, 'utf8')) as Rec;
  return _demo;
}

/** Lolly Demo's colourway ids, in the order the colourway control draws them. */
function colourwayIds(): string[] {
  const themes = (demoTokens().$themes ?? []) as Array<{ id?: string; group?: string }>;
  return themes.filter((t) => t.group === 'colourway' && t.id).map((t) => t.id as string);
}

/** The colour roles a colourway gives one mode, as #rrggbb: lead (primary), the
 *  colour on the lead, partner (secondary), surface (paper) and ink (text). */
function colourwayColours(id: string, mode: 'light' | 'dark'): { lead: string; onLead: string; partner: string; surface: string; ink: string } {
  const doc = demoTokens();
  const set = doc[`colourway/${id}`] as Rec | undefined;
  const roles = ((set?.color as Rec | undefined)?.colourway as Rec | undefined)?.[mode] as Record<string, { $value?: string }> | undefined;
  if (!roles) throw new Error(`Lolly Demo has no ${mode} colours for the colourway ${id}`);
  const named = ((doc.base as Rec).color as Rec).brand as Record<string, unknown>;
  const hex = (role: string): string => {
    const v = roles[role]?.$value ?? '';
    const ref = /^\{color\.brand\.([a-z-]+)\}$/.exec(v);
    const entry = ref ? named[ref[1] as string] : v;
    const out = entry && typeof entry === 'object' ? (entry as { $value?: unknown }).$value : entry;
    if (typeof out !== 'string' || !/^#[0-9a-f]{6}$/i.test(out)) throw new Error(`colourway ${id} ${mode} ${role} is not an Opal colour: ${v}`);
    return out.toLowerCase();
  };
  return { lead: hex('primary'), onLead: hex('on-primary'), partner: hex('secondary'), surface: hex('surface'), ink: hex('text') };
}

/** The mode a look's colours come from: the light look reads the light colours, Dark
 *  and Brand the dark ones (the same rule the colourway control draws its dots by). */
const modeOf = (look: Look): 'light' | 'dark' => (look === 'light' ? 'light' : 'dark');

/** The OKLCH hue of the lead a cover wears - covers.json's `hue`. */
function hueOf(pose: CoverPose): number {
  if ('derivedHue' in pose.wear) return pose.wear.derivedHue;
  const c = hexToOklch(colourwayColours(pose.wear.colourway, modeOf(pose.wear.look)).lead);
  if (!c) throw new Error(`no hue for ${pose.slug}`);
  return Math.round(c.h * 10) / 10;
}

/** Fill the route's colour placeholders, and give a tool route its document's
 *  colourway and mode through `_themes` (a route that sets `_themes` keeps its own). */
function routeFor(pose: CoverPose, derived: Rec | null): string {
  if ('derivedHue' in pose.wear) {
    if (!derived) throw new Error(`${pose.slug} wears a derived brand and none was made`);
    const enc = (step: number): string => encodeURIComponent(rampHex(derived, step));
    const hue = pose.wear.derivedHue;
    return pose.route
      .replace(/\{primary\}/g, enc(5))
      .replace(/\{primaryDark\}/g, enc(3))
      .replace(/\{primaryLight\}/g, enc(8))
      .replace(/\{shift:([0-9a-f]{6})\}/gi, (_m, hex: string) => encodeURIComponent(shiftHue(`#${hex}`, hue - LOLLY_HUE)));
  }
  const { colourway, look } = pose.wear;
  const c = colourwayColours(colourway, modeOf(look));
  let route = pose.route
    .replace(/\{lead\}/g, encodeURIComponent(c.lead))
    .replace(/\{onLead\}/g, encodeURIComponent(c.onLead))
    .replace(/\{partner\}/g, encodeURIComponent(c.partner))
    .replace(/\{surface\}/g, encodeURIComponent(c.surface))
    .replace(/\{ink\}/g, encodeURIComponent(c.ink));
  if (route.startsWith('#/tool/') && !/[?&]_themes=/.test(route)) {
    const themes = encodeURIComponent(JSON.stringify({ colourway, '': pose.docMode ?? modeOf(look) }));
    route += `${route.includes('?') ? '&' : '?'}_themes=${themes}`;
  }
  return route;
}

/** A colour named in a pose: a placeholder from the pose's colourway, or a hex. */
function colourFor(pose: CoverPose, value: string): string {
  if ('derivedHue' in pose.wear) return value;
  const c = colourwayColours(pose.wear.colourway, modeOf(pose.wear.look));
  const named: Record<string, string> = { '{lead}': c.lead, '{onLead}': c.onLead, '{partner}': c.partner, '{surface}': c.surface, '{ink}': c.ink };
  return named[value] ?? value;
}

/** A hex colour rotated by `deltaDeg` in OKLCH (lightness and chroma kept). */
function shiftHue(hex: string, deltaDeg: number): string {
  const c = hexToOklch(hex);
  if (!c) throw new Error(`shiftHue: not a hex colour: ${hex}`);
  return oklchToHex({ ...c, h: (((c.h + deltaDeg) % 360) + 360) % 360 });
}

/** The app theme a pose boots in: its look, or Brand for a derived brand. */
const themeOf = (pose: CoverPose): Look => ('look' in pose.wear ? pose.wear.look : 'brand');

/** Seeded before any app code runs: no first-run overlays, the pose's theme, and
 *  (stills only) the docs pipeline's neutral-capture state - reduced motion and
 *  eager hydration, which is exactly what a loop must NOT have. */
const initScript = (neutral: boolean, theme: Look): string =>
  "try{localStorage.setItem('lolly-welcome-dismissed','1');" +
  "localStorage.setItem('lolly-tips-dismissed','1');" +
  "localStorage.setItem('lolly-privacy-ack','1');" +
  `localStorage.setItem('theme',${JSON.stringify(theme)});` +
  (neutral ? "localStorage.setItem('lolly-capture-neutral','1');" : '') +
  '}catch(_){}';

const HIDE_CSS = `
  * { cursor: none !important; }
  .tool-guide-steps, .privacy-notice, .welcome-dialog, .welcome-hero, .brand-tips, .job-toast, .toast, .helptip, .personalize-nudge { display: none !important; }
`;

async function main(): Promise<void> {
  const opts = parseOpts(process.argv.slice(2));
  if (opts.only.length) {
    const missing = opts.only.filter((s) => !POSES.some((p) => p.slug === s));
    if (missing.length) throw new Error(`--only names unknown poses: ${missing.join(', ')}`);
  }
  if (opts.list) {
    for (const p of POSES) {
      const wear = 'derivedHue' in p.wear ? `derived ${p.wear.derivedHue}°` : `${p.wear.colourway} ${p.wear.look}`;
      const kind = [p.walkerSvg && 'walker', p.phone && 'phone', p.exportStill, p.exportVideo && 'mp4', p.video && 'loop', !p.exportStill && !p.exportVideo && !p.video && !p.walkerSvg && !p.phone && 'still'].filter(Boolean).join('+');
      console.log(`${String(hueOf(p)).padStart(5)}°  ${p.slug.padEnd(12)} ${wear.padEnd(18)} ${kind.padEnd(10)}${p.kept ? ' kept' : ''}  ${p.route.slice(0, 120)}`);
    }
    return;
  }
  // A kept cover is posed only when --only asks for it by name.
  const poses = POSES.filter((p) => (opts.only.length ? opts.only.includes(p.slug) : !p.kept))
    .filter((p) => (p.video || p.exportVideo ? opts.videos : opts.stills) || (p.exportStill && opts.stills));
  if (!poses.length) { console.log('Nothing to pose.'); return; }
  mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = await import('playwright');
  // The machine's own GPU where it has a reliable one; the shell's WebGPU requirement
  // gets SwiftShader on Linux, where a headless host often has none (webgpu-launch.ts).
  const browser = await chromium.launch({ headless: !opts.headed, args: ['--ignore-gpu-blocklist', ...webGpuLaunchArgs('auto')] });
  const failures: string[] = [];
  try {
    for (const pose of poses) {
      const t0 = Date.now();
      try {
        if (pose.walkerSvg && opts.stills) await poseWalker(browser, opts.url, pose);
        if (pose.exportStill && opts.stills) await poseExport(browser, opts.url, pose, pose.exportStill);
        if (pose.exportVideo && opts.videos) await poseExport(browser, opts.url, pose, 'mp4');
        else if (pose.video && opts.videos) await poseLoop(browser, opts.url, pose);
        if (pose.phone && opts.stills) await posePhone(browser, opts.url, pose);
        if (!pose.exportStill && !pose.exportVideo && !pose.video && !pose.walkerSvg && !pose.phone) await poseStill(browser, opts.url, pose);
        console.log(`✓ ${pose.slug.padEnd(12)} ${String(hueOf(pose)).padStart(5)}°  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (err) {
        failures.push(pose.slug);
        console.error(`✗ ${pose.slug}: ${(err as Error).message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} pose(s) failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}

type Browser = Awaited<ReturnType<Awaited<typeof import('playwright')>['chromium']['launch']>>;
type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

/**
 * Put the app in the pose's colours, then load the route in a FRESH document so it
 * boots wearing them. A colourway other than the canonical one is chosen on the
 * Appearance card of Settings, the person's own colourway, which leads the chrome
 * and is kept on the profile; the look rides in the `theme` key the init script
 * seeds. A derived brand (the kept loops) is installed through the loopback hook.
 */
async function bootPose(page: Page, base: string, pose: CoverPose, drive: string[] = pose.drive ?? []): Promise<void> {
  let derived: Rec | null = null;
  if ('derivedHue' in pose.wear) {
    await page.goto(`${base}/#/`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof (window as unknown as { __lollyInstallBrand?: unknown }).__lollyInstallBrand === 'function', null, { timeout: 90_000 });
    derived = brandFor(pose.wear, pose.slug);
    await page.evaluate(async (d) => {
      await (window as unknown as { __lollyInstallBrand: (doc: unknown, label: string) => Promise<void> }).__lollyInstallBrand(d, 'Cover pose');
    }, derived);
    await page.goto('about:blank');
  } else {
    const ids = colourwayIds();
    const index = ids.indexOf(pose.wear.colourway);
    if (index < 0) throw new Error(`Lolly Demo has no colourway ${pose.wear.colourway} (it has ${ids.join(', ')})`);
    if (index > 0) {
      await page.goto(`${base}/#/profile?focus=appearance-section`, { waitUntil: 'load' });
      const dot = `#colourway-pref [role="radio"][data-theme-option="${index}"]`;
      await page.waitForSelector(dot, { state: 'attached', timeout: 90_000 });
      await page.click(dot);
      await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-checked') === 'true', dot, { timeout: 15_000 });
      await page.waitForTimeout(800);
      await page.goto('about:blank');
    }
  }
  await page.goto(`${base}/${routeFor(pose, derived)}`, { waitUntil: 'load' });
  const arrived = pose.route.startsWith('#/tool/') ? '#tool-content, #tool-canvas' : 'body';
  await page.waitForSelector(arrived, { timeout: 90_000 });
  try {
    if (drive.length) {
      // A control can be in the DOM before its view has wired it (Design's top bar
      // mounts with the template seed still arriving), so let the view settle first.
      await page.waitForTimeout(2500);
    }
    for (const sel of drive) {
      await page.waitForSelector(sel, { timeout: 30_000 });
      await page.click(sel);
      await page.waitForTimeout(1200);
    }
    if (pose.wait) await page.waitForSelector(pose.wait, { timeout: 90_000 });
  } catch (err) {
    // Leave the evidence beside the outputs: a pose that never settled is a
    // debugging job, and the page as it stood is the first thing to look at.
    const dbg = resolve(tmpdir(), `lolly-cover-${pose.slug}-failed.png`);
    await page.screenshot({ path: dbg }).catch(() => {});
    throw new Error(`${(err as Error).message.split('\n')[0]} (page saved to ${dbg})`);
  }
  await page.addStyleTag({ content: HIDE_CSS + (pose.css ?? '') }).catch(() => {});
  await page.waitForTimeout(pose.settleMs ?? 3000);
  // The chrome's accent must be the posed colours, not the default's - a capture
  // in the wrong colours is worse than no capture.
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim());
  if (!accent) throw new Error('the posed colours did not reach the chrome (--brand-primary unset)');
}

/**
 * The view on a phone: each entry in `phone.shots` is a fresh load of the route at a
 * 390x844 viewport (2x), with its own clicks, and the shots stand side by side on
 * the pose's ground with rounded corners and a soft shadow, scaled to fit the card.
 */
async function posePhone(browser: Browser, base: string, pose: CoverPose): Promise<void> {
  const spec = pose.phone;
  if (!spec) throw new Error('posePhone needs phone');
  const shots: Buffer[] = [];
  for (const shot of spec.shots) {
    const ctx = await browser.newContext({
      viewport: { width: PHONE_W, height: PHONE_H },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      forcedColors: 'none',
    });
    try {
      await ctx.addInitScript({ content: initScript(true, themeOf(pose)) });
      const page = await ctx.newPage();
      await bootPose(page, base, pose, shot.drive ?? []);
      shots.push(await page.screenshot({ type: 'png' }));
    } finally {
      await ctx.close();
    }
  }
  const n = shots.length;
  const ph = Math.round(OUT_H * 0.9);
  const pw = Math.round((ph * PHONE_W) / PHONE_H);
  const gap = Math.round(pw * 0.16);
  const total = n * pw + (n - 1) * gap;
  const x0 = Math.round((OUT_W - total) / 2);
  const y0 = Math.round((OUT_H - ph) / 2);
  const r = Math.round(pw * 0.11);
  const ground = colourFor(pose, spec.ground);
  const frames = shots.map((_s, i) => ({ x: x0 + i * (pw + gap), y: y0 }));
  const shadow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">`
    + '<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>'
    + frames.map((f) => `<rect x="${f.x}" y="${f.y + 14}" width="${pw}" height="${ph}" rx="${r}" fill="#000" fill-opacity="0.32" filter="url(#s)"/>`).join('')
    + '</svg>');
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="${r}" fill="#fff"/></svg>`);
  const phones = await Promise.all(shots.map((png) => sharp(png).resize(pw, ph, { fit: 'cover', kernel: 'lanczos3' })
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()));
  const out = resolve(OUT_DIR, `${pose.slug}.webp`);
  await sharp({ create: { width: OUT_W, height: OUT_H, channels: 4, background: ground } })
    .composite([{ input: shadow, left: 0, top: 0 }, ...phones.map((input, i) => ({ input, left: frames[i]!.x, top: frames[i]!.y }))])
    .webp({ quality: 86, effort: 6 })
    .toFile(out);
  console.log(`   ${pose.slug}.webp ${Math.round(statSync(out).size / 1024)} KB (${n} phone shot${n === 1 ? '' : 's'})`);
}

async function poseStill(browser: Browser, base: string, pose: CoverPose): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    forcedColors: 'none',
  });
  try {
    await ctx.addInitScript({ content: initScript(true, themeOf(pose)) });
    const page = await ctx.newPage();
    await bootPose(page, base, pose);
    const target = pose.crop ? await page.$(pose.crop) : null;
    if (pose.crop && !target) throw new Error(`crop selector ${pose.crop} matched nothing`);
    const png = target ? await target.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
    await sharp(png).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 })
      .toFile(resolve(OUT_DIR, `${pose.slug}.webp`));
  } finally {
    await ctx.close();
  }
}

async function poseLoop(browser: Browser, base: string, pose: CoverPose): Promise<void> {
  const seconds = pose.video ?? LOOP_SECONDS;
  const recDir = resolve(tmpdir(), `lolly-cover-${pose.slug}-${Date.now()}`);
  mkdirSync(recDir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
    recordVideo: { dir: recDir, size: { width: VIEW_W, height: VIEW_H } },
  });
  let videoPath: string | null = null;
  const started = Date.now();
  let settledAt = 0;
  try {
    await ctx.addInitScript({ content: initScript(false, themeOf(pose)) });
    const page = await ctx.newPage();
    await bootPose(page, base, pose);
    settledAt = (Date.now() - started) / 1000;
    // Poster from the same run, a beat into the loop so it is a frame the loop
    // actually shows (the card holds it under reduced motion and before play).
    await page.waitForTimeout(1200);
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 })
      .toFile(resolve(OUT_DIR, `${pose.slug}-poster.webp`));
    await page.waitForTimeout(seconds * 1000 + 800);
    const v = page.video();
    await ctx.close();
    videoPath = v ? await v.path() : null;
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err;
  }
  if (!videoPath || !existsSync(videoPath)) throw new Error('no screen recording produced');
  const out = resolve(OUT_DIR, `${pose.slug}.webm`);
  if (existsSync(out)) unlinkSync(out);
  // Cut the boot and the poster pause off the front; VP9 at the card's size, silent.
  const r = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', (settledAt + 1.2).toFixed(2), '-t', String(seconds),
    '-i', videoPath,
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos,fps=30`,
    '-an', '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p',
    out,
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg exited ${r.status ?? 'signal'} (is ffmpeg on PATH?)`);
  // The recording is a temp file; keep the tree clean.
  try { for (const f of readdirSync(recDir)) unlinkSync(resolve(recDir, f)); rmSync(recDir, { recursive: true, force: true }); } catch { /* best effort */ }
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`   ${pose.slug}.webm ${kb} KB`);
}

/**
 * The tool exports its own file. The route gets `format=<f>&options` so the export
 * panel opens on that format at the card's pixel size; for a video the frame rate
 * and codec sit behind the panel's Pro settings disclosure, so they are set through
 * the DOM (value + input/change, what the panel listens for) rather than clicked
 * open. H.264 is pinned because the tile plays in every browser's <video>, and Auto
 * may pick AV1 or HEVC on this machine. Quality defaults to Balanced - Best made a
 * grainy 6 s clip 4.5 MB, more than a landing tile should cost. A video poster is a frame of the finished
 * file unless the pose exports a PNG still, which then IS the poster.
 */
async function poseExport(browser: Browser, base: string, pose: CoverPose, fmt: 'png' | 'svg' | 'mp4'): Promise<void> {
  const ev = fmt === 'mp4' ? pose.exportVideo : undefined;
  if (fmt === 'mp4' && !ev) throw new Error('poseExport mp4 needs exportVideo');
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
    acceptDownloads: true,
  });
  const stillName = pose.exportVideo ? `${pose.slug}-poster.webp` : `${pose.slug}.webp`;
  const out = resolve(OUT_DIR, fmt === 'mp4' ? `${pose.slug}.mp4` : fmt === 'svg' ? `${pose.slug}.svg` : stillName);
  const routed: CoverPose = { ...pose, route: `${pose.route}${pose.route.includes('?') ? '&' : '?'}format=${fmt}&options&width=${OUT_W}&height=${OUT_H}` };
  let bytes: Buffer | null = null;
  try {
    await ctx.addInitScript({ content: initScript(false, themeOf(pose)) });
    const page = await ctx.newPage();
    await bootPose(page, base, routed);
    if (ev) {
      await page.waitForSelector('[data-action="video-fps"]', { state: 'attached', timeout: 30_000 });
      await page.evaluate(({ fps, seconds, quality }) => {
        const set = (sel: string, value: string): void => {
          const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
          if (!el) throw new Error(`${sel} is not in the export panel`);
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set('[data-action="video-fps"]', String(fps));
        set('[data-action="video-codec"]', 'avc1.640033');
        set('[data-action="video-quality"]', quality);
        set('[data-action="video-duration"]', String(seconds));
      }, { fps: ev.fps, seconds: ev.seconds, quality: ev.quality ?? 'balanced' });
    } else {
      await page.waitForSelector('[data-action="download"]', { state: 'attached', timeout: 30_000 });
    }
    // Playwright's click waits for the control to hold still; over a WebGL
    // visualiser at 60 fps that check can run out the clock, so fall back to a
    // DOM click, which the panel's listener treats the same.
    const clickDownload = async (): Promise<void> => {
      try {
        await page.click('[data-action="download"]', { timeout: 15_000 });
      } catch (err) {
        console.warn(`   ${pose.slug}: pointer click did not settle (${(err as Error).message.split('\n')[0]}); clicking through the DOM`);
        await page.evaluate(() => (document.querySelector<HTMLElement>('[data-action="download"]') as HTMLElement).click());
      }
    };
    const [download] = await Promise.all([
      // MilkDrop at the card's size takes over ten minutes for 360 frames headless.
      page.waitForEvent('download', { timeout: 1_800_000 }),
      clickDownload(),
    ]);
    if (fmt === 'png') {
      const tmp = resolve(tmpdir(), `lolly-cover-${pose.slug}-${Date.now()}.png`);
      await download.saveAs(tmp);
      bytes = readFileSync(tmp);
      unlinkSync(tmp);
    } else {
      if (existsSync(out)) unlinkSync(out);
      await download.saveAs(out);
    }
    await ctx.close();
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err;
  }
  if (fmt === 'png') {
    if (!bytes) throw new Error('no PNG export received');
    await sharp(bytes).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 }).toFile(out);
    console.log(`   ${stillName} ${Math.round(statSync(out).size / 1024)} KB (from the PNG export)`);
    return;
  }
  if (fmt === 'svg') {
    const head = readFileSync(out, 'utf8').slice(0, 300);
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(head)) throw new Error(`${out} is not an SVG document`);
    if (pose.svgGround) writeFileSync(out, letterboxSvg(readFileSync(out, 'utf8'), decodeURIComponent(colourFor(pose, pose.svgGround))));
    await signCover(out, pose);
    console.log(`   ${pose.slug}.svg ${Math.round(statSync(out).size / 1024)} KB`);
    return;
  }
  if (!ev) throw new Error('unreachable');
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`ffprobe failed on ${out} (is ffmpeg on PATH?)`);
  const [codec = '', w = '', h = '', rate = ''] = probe.stdout.trim().split(',');
  const fpsOut = rate.includes('/') ? Number(rate.split('/')[0]) / Number(rate.split('/')[1]) : Number(rate);
  if (codec !== 'h264' || Number(w) !== OUT_W || Number(h) !== OUT_H || Math.round(fpsOut) !== ev.fps) {
    throw new Error(`export is ${codec} ${w}x${h} @ ${fpsOut} fps, wanted h264 ${OUT_W}x${OUT_H} @ ${ev.fps}`);
  }
  // The card plays muted, so an audio track (the audiogram's loop) is dead weight:
  // remux without it, video bytes untouched, and put the index up front so the
  // browser can start on the first bytes.
  const remuxed = `${out}.remux.mp4`;
  const remux = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-an', '-c:v', 'copy', '-movflags', '+faststart', remuxed], { stdio: 'inherit' });
  if (remux.status !== 0) throw new Error('ffmpeg could not remux the export');
  renameSync(remuxed, out);
  if (pose.exportStill !== 'png') {
    const frame = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', '1.2', '-i', out, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 64 * 1024 * 1024 });
    if (frame.status !== 0 || !frame.stdout.length) throw new Error('could not read a poster frame from the export');
    await sharp(frame.stdout).resize(OUT_W, OUT_H, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 84, effort: 6 })
      .toFile(resolve(OUT_DIR, `${pose.slug}-poster.webp`));
  }
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`   ${pose.slug}.mp4 ${kb} KB  (${codec} ${w}x${h} @ ${Math.round(fpsOut)} fps)`);
}

/**
 * Set an exported SVG page on a 4:3 card filled with `ground`, scaled to fit with a
 * margin, as a nested <svg>. The export's Content Credential is bound to the bytes the
 * tool wrote, which the wrapper changes, so its <metadata> is dropped here and
 * `signCover` signs the wrapped file.
 */
function letterboxSvg(svg: string, ground: string, margin = 0.05): string {
  const body = svg.replace(/^\s*<\?xml[^>]*>\s*/, '').replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
  const open = /<svg\b[^>]*>/.exec(body)?.[0];
  const vb = open ? /viewBox="([^"]+)"/.exec(open)?.[1]?.split(/[\s,]+/).map(Number) : undefined;
  if (!open || !vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) throw new Error('letterboxSvg needs an <svg> root with a viewBox');
  const [, , vw, vh] = vb as [number, number, number, number];
  const scale = Math.min((OUT_W * (1 - 2 * margin)) / vw, (OUT_H * (1 - 2 * margin)) / vh);
  const w = Math.round(vw * scale * 100) / 100;
  const h = Math.round(vh * scale * 100) / 100;
  const x = Math.round(((OUT_W - w) / 2) * 100) / 100;
  const y = Math.round(((OUT_H - h) / 2) * 100) / 100;
  const nested = open.replace(/\s(?:width|height|style|x|y)="[^"]*"/g, '').replace(/^<svg/, `<svg x="${x}" y="${y}" width="${w}" height="${h}"`);
  return '<?xml version="1.0" standalone="no"?>\n'
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}px" height="${OUT_H}px" viewBox="0 0 ${OUT_W} ${OUT_H}">`
    + `<rect width="${OUT_W}" height="${OUT_H}" fill="${ground}"/>${body.replace(open, nested)}</svg>\n`;
}

/**
 * The claim every SVG export cover is signed with (Andy, 2026-11-14: "Docs claim on
 * all"): the docs figures' own (scripts/sign-docs-art.ts `artC2paOpts`, the claim
 * scripts/build-format-last-art.ts signs its panels with), on the docs figures'
 * ten-year on-device credential rather than the export's thirty-day one. It states
 * the Lolly tool that drew the file, the model that posed the cover under the
 * maintainer's direction, and the maintainer as author. Update `model` when another
 * model poses the covers.
 */
const COVER_MODEL: NonNullable<ArtMeta['model']> = { name: 'Claude Opus 5.5', identifier: 'claude-opus-5-5', vendor: 'Anthropic' };
const coverMeta = (generator: ArtMeta['generator']): ArtMeta => ({
  generator,
  model: COVER_MODEL,
  oversight: 'prompt_guided',
  source: 'compositeWithTrainedAlgorithmicMedia',
  author: { name: 'Andy Fitzsimon' },
});

/** The tool behind a pose, as the generator the claim states: `Lolly <name>` and the
 *  manifest's version, read from the community tool (the covers pose no brand tools). */
function coverGenerator(pose: CoverPose): ArtMeta['generator'] {
  const id = /^#\/tool\/([a-z0-9-]+)/.exec(pose.route)?.[1];
  const manifest = id ? resolve(ROOT, 'community', id, 'tool.json') : '';
  if (!manifest || !existsSync(manifest)) return { name: 'Lolly' };
  const tool = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; version?: string };
  return { name: `Lolly ${tool.name ?? id}`, ...(tool.version ? { version: tool.version } : {}) };
}

/** Sign a cover the way the docs figures are signed, in place of the credential the
 *  export carried, then read the file back with the engine's verifier: anything but a
 *  valid credential naming the author fails the pose. */
async function signCover(file: string, pose: CoverPose): Promise<void> {
  const text = stripArtManifest(readFileSync(file, 'utf8'), 'svg');
  const dims = artDims(text);
  const opts = artC2paOpts(coverMeta(coverGenerator(pose)), { id: `cover-${pose.slug}`, kind: 'figure', format: 'svg', ...(dims ? { dims } : {}) });
  writeFileSync(file, await embedC2pa(new TextEncoder().encode(text), 'svg', opts));
  const report = await verifyC2pa(new Uint8Array(readFileSync(file)));
  if (report.state !== 'valid' || report.author?.name !== 'Andy Fitzsimon') throw new Error(`${file} did not read back with a valid credential (${report.state})`);
  console.log(`   ${pose.slug}.svg signed (${report.state})`);
}

/**
 * Vector screenshot of an app view through the shell's walker. The walker emits
 * every node relative to body's border-box, so the visible band is the viewport
 * window at body's scroll offset - the viewBox is set to exactly that (the
 * off-screen rest stays in the file; a cover is one page, not a corpus). Neutral
 * capture is pinned as for the raster stills, so example strips hydrate up front
 * and motion is off.
 */
async function poseWalker(browser: Browser, base: string, pose: CoverPose): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    forcedColors: 'none',
  });
  try {
    await ctx.addInitScript({ content: initScript(true, themeOf(pose)) });
    const page = await ctx.newPage();
    await bootPose(page, base, pose);
    await page.addStyleTag({ content: HIDE_CSS });
    await page.waitForTimeout(400);
    const out = await page.evaluate(async ({ w, h }) => {
      const hook = (window as unknown as { __lollyWalkerShot?: (sel?: string, o?: Record<string, unknown>) => Promise<{ svg: string }> }).__lollyWalkerShot;
      if (!hook) throw new Error('the served shell has no __lollyWalkerShot hook');
      const body = document.body;
      // The walker paints per-element backgrounds only; give body the page's own
      // backdrop so the frame is opaque (the docs pipeline does the same).
      const pageBg = getComputedStyle(body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor;
      const r = await hook('body', {});
      const rect = body.getBoundingClientRect();
      const off = { x: Math.max(0, -rect.left), y: Math.max(0, -rect.top) };
      const doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw new Error('the walker returned an SVG that does not parse');
      const root = doc.documentElement;
      const vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      const natW = vb.length === 4 ? (vb[2] as number) : w;
      const natH = vb.length === 4 ? (vb[3] as number) : h;
      const wx = Math.min(Math.max(0, off.x), Math.max(0, natW - w));
      const wy = Math.min(Math.max(0, off.y), Math.max(0, natH - h));
      root.setAttribute('viewBox', `${wx} ${wy} ${w} ${h}`);
      root.setAttribute('width', String(w));
      root.setAttribute('height', String(h));
      root.removeAttribute('style');
      if (pageBg && pageBg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(pageBg)) {
        const bg = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', String(wx)); bg.setAttribute('y', String(wy));
        bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h));
        bg.setAttribute('fill', pageBg);
        root.insertBefore(bg, root.firstChild);
      }
      return new XMLSerializer().serializeToString(doc);
    }, { w: VIEW_W, h: VIEW_H });
    const file = resolve(OUT_DIR, `${pose.slug}.svg`);
    if (existsSync(file)) unlinkSync(file);
    writeFileSync(file, out);
    console.log(`   ${pose.slug}.svg ${Math.round(statSync(file).size / 1024)} KB (walker)`);
    await ctx.close();
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
