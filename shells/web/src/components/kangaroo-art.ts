// SPDX-License-Identifier: MPL-2.0
/**
 * The kangaroo and joey: Lolly's line drawing for the Unsaved edits dialog
 * (views/tool-leave-dialog.ts). A mother kangaroo with her joey looking out of the
 * pouch, drawn with a 2-unit round stroke on a 120 grid in currentColor, so the
 * host's CSS colours it for every theme and brand. Purely decorative: the markup
 * is aria-hidden and carries no title or description to read aloud.
 *
 * One drawing is both the still and the motion. It is drawn in the end pose, so it
 * is the still wherever nothing starts the motion (Reduce motion, the system
 * setting, a test DOM). The motion is SMIL, because CSS cannot morph a path in
 * WebKit. Over 1300 ms the joey holds, leans back and looks up, holds again, then
 * turns out past his rest pose and settles a little further out than he started.
 * The pouch lip follows the front of his neck, and the mother's outline, the pouch
 * rim and the clip that hides the rest of him move with the lip. Nothing starts by
 * itself: playKangaroo() calls beginElement() on the joey's turn, and every other
 * motion begins with that one.
 *
 * The joey is a closed shape clipped at the pouch rim and filled with --kg-ground
 * (the .kg-joey rule in styles/parts/dialogs.css), so the host sets --kg-ground to
 * the surface behind the drawing and the outline behind him stays hidden.
 *
 * Ids are minted per drawing, because the clip and the motions refer to each other
 * by id and two drawings in one document must not share them. They hold no hyphen:
 * Chrome reads the hyphen in a begin value such as "kg-go.begin" as a negative
 * offset, and every motion keyed to that value never starts. WebKit's parser for
 * begin values comes from the same code.
 *
 * The anchors and poses come from the brand drafts (kg.py and build4.py beside
 * kangaroo-v4.svg in plans/lolly-brand-universe/drafts/kangaroo/v3).
 */
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';

/** The four poses the motion passes through. */
type Pose = 'rest' | 'back' | 'over' | 'out';

/** The pose at each key time: a hold at rest, the lean back and its hold, the turn past rest, the settle. */
const KEYS: readonly Pose[] = ['rest', 'rest', 'back', 'back', 'over', 'out'];
const KEY_TIMES = '0;0.06;0.4;0.52;0.86;1';
const KEY_SPLINES = '0 0 1 1;.45 0 .25 1;0 0 1 1;.3 0 .2 1;.4 0 .6 1';
const DURATION = '1300ms';
/** The still, which is also where the motion settles. */
const STILL: Pose = 'out';
/** The 120 grid framed close round the drawing (ear tips to the ground, tail tip to
 *  nose, strokes included), so a host can line its edges up with text. The joey's
 *  nose passes the right edge for a moment during the motion; the host lets the
 *  drawing overflow. */
const VIEW_BOX = '11 11 96 96';

/** Her outline from the belly under her forearm round to the lower front of the pouch, the same in every pose. */
const OUTLINE = [
  'M92.8 69.4C93.26 65.02 93.34 58.97 92.8 54.6', // belly, up to the armpit
  'C94.26 55.25 95.19 55.7 96.4 56.4C97.44 57 98.46 58.53 99.2 59.2C99.79 59.74 100.52 59.11 100.9 58.4C101.37 57.52 100.69 56.3 100.2 55.2C99.55 53.74 98.26 52.99 97 52C95.74 51.01 94.7 49.92 93.4 49.4', // forearm and paw, to the shoulder
  'C93.34 47.8 93.4 44.8 93.4 43.4C94.49 42.89 95.62 41.82 97.2 41.6C99.18 41.32 100.73 40.67 102.4 40C103.51 39.55 105.03 38.2 105 37.2C104.97 36.2 104.08 35.07 103.2 34.6C101.26 33.57 99.84 32.15 98.2 31C96.73 29.97 95.26 28.7 94.4 27.6', // throat, jaw, nose and brow
  'C93.91 26.97 93.94 26.19 93.8 25.4C94.29 22.64 95.87 20.99 95.6 18.4C95.37 16.21 94.96 12.91 93.8 12.6C92.64 12.29 91.22 14.76 90.4 16.8C89.5 19.03 88.59 21.01 88.8 23C88.68 22.51 87.72 23.49 87.6 23C86.97 20.48 87.05 18.76 86 16.6C85.04 14.62 82.8 12.84 81.6 12.8C80.4 12.76 78.91 15.62 78.6 17.8C78.27 20.18 79.98 23.34 80.8 25.6', // both ears, to the back of the head
  'C80.32 27.54 80.63 31.48 80 34C79.27 36.91 78.28 42.07 76 44.6C73.32 47.57 70.03 49.9 64.09 50.74C60.36 51.26 56.8 52.64 53.68 54.77C50.57 56.89 47.99 59.71 46.14 63C44.29 66.28 43.23 69.95 43.03 73.72C42.82 77.71 42.72 81.25 42.2 84.2', // nape and back
  'C41.75 86.76 40.6 88.75 39 90.8C36.54 93.95 33.76 94.23 30 95.6C26.24 96.97 22.96 97.44 19 98C17.42 98.22 14 99.56 13.4 100.6C12.95 101.38 14.6 103.4 16 103.4C25 103.4 34 103.4 40 103.4', // tail
  'C43 103.4 47.11 101.93 48.6 99.8C49.98 97.83 51.35 94.39 51.6 92C51.77 90.41 52.4 88.2 52.4 86.6C53.32 87.91 54.85 88.99 55.6 90.4C56.35 91.81 57.86 94.4 57.8 96C57.74 97.6 57.57 100.22 57.4 101.2C57.19 102.38 58.2 103.4 59.6 103.4C68.6 103.4 77 103.4 86 103.4C87.2 103.4 88.4 102.3 88.4 101.1C88.4 99.9 87.4 98.88 86.2 98.8C82.21 98.52 80.79 98.18 76.8 97.9C78.88 96.7 81.32 95.6 83.4 94.4C86 92.9 89.67 91.14 91.6 89.4', // tail on the ground, heel, foot, shin and the lower pouch
].join('');

/** The end of her outline, up the pouch front to the lip and back to her belly, per pose. */
const LIP: Record<Pose, string> = {
  rest: 'C93.09 88.06 95.92 86.18 96.2 84.6C96.44 83.22 96.79 81.59 96.6 80.2C95.36 76.4 93.22 73.38 92.8 69.4Z',
  back: 'C93.09 88.06 96.09 85.64 96.36 84.06C96.61 82.68 97.12 80.51 96.93 79.12C95.69 75.32 93.22 73.38 92.8 69.4Z',
  over: 'C93.09 88.06 97 85.99 97.28 84.41C97.52 83.04 98.96 81.22 98.76 79.83C97.53 76.02 93.22 73.38 92.8 69.4Z',
  out: 'C93.09 88.06 96.93 86.01 97.21 84.43C97.45 83.05 98.81 81.25 98.61 79.87C97.38 76.06 93.22 73.38 92.8 69.4Z',
};

/** The top of the thigh, running on under the joey's chin as the pouch rim; its last span ends at the lip. */
const RIM = 'M53.2 72.4C55.39 67.91 61.2 63.8 66.6 63.8C71.6 63.8 78.99 70.95 80.4 73.6C84.67 74.66 ';
const RIM_END: Record<Pose, string> = {
  rest: '92.27 79.44 96.6 80.2',
  back: '92.6 78.36 96.93 79.12',
  over: '94.43 79.07 98.76 79.83',
  out: '94.28 79.1 98.61 79.87',
};

/** The clip that shows the joey only out of the pouch: everything above the rim's last span. */
const CLIP: Record<Pose, string> = {
  rest: 'M60 0H120V80.8H96.6V80.2C92.27 79.44 84.67 74.66 80.4 73.6L60 73.6Z',
  back: 'M60 0H120V79.72H96.93V79.12C92.6 78.36 84.67 74.66 80.4 73.6L60 73.6Z',
  over: 'M60 0H120V80.43H98.76V79.83C94.43 79.07 84.67 74.66 80.4 73.6L60 73.6Z',
  out: 'M60 0H120V80.47H98.61V79.87C94.28 79.1 84.67 74.66 80.4 73.6L60 73.6Z',
};

/** The joey turns about the base of his neck (degrees, y down, so negative tips his head back), then shifts. */
const PIVOT = '94.6 79';
const TURN: Record<Pose, number> = { rest: 0, back: -28, over: 10, out: 8 };
const SHIFT: Record<Pose, string> = {
  rest: '0 0',
  back: '0 0',
  over: '2.4 -0.7',
  out: '2.2 -0.6',
};

/** Her eye, and the joey's: dots drawn by the round cap of a zero-length line. */
const EYE = 'M92.8 31.6h.01';
const JOEY_EYE = 'M99.8 73.4h.01';

/** The joey: chin, snout, ear and neck as one closed shape. */
const JOEY = 'M96.6 80.2C97.35 78.79 98.3 78.26 99.4 77.4C100.66 76.41 101.94 75.56 103 75C103.79 74.58 104.43 73.7 104.4 72.8C104.37 71.9 103.26 71.08 102.4 70.8C100.69 70.24 100.3 69.92 99 69.4C98.72 67.82 98.39 65.99 98.2 64.6C98.07 63.71 97.8 62.48 96.9 62.4C96 62.32 95.61 64.22 95.4 65.4C95.23 66.38 95.54 67.46 95.2 68.4C94.79 69.53 93.24 71.02 93 72.4C92.58 74.76 92.8 76.6 92.8 79C92.8 81 92.9 82.8 92.9 84.2C92.9 85.2 93.42 85.37 94.4 85.2C94.75 83.23 94.52 81.4 96.6 80.2Z';

let drawings = 0;

/** One spline-timed motion through the poses, frozen at the last. */
function motion(tag: 'animate' | 'animateTransform', attrs: string, value: (pose: Pose) => string | number, begin: string): string {
  return `<${tag} ${attrs} values="${KEYS.map(value).join(';')}" keyTimes="${KEY_TIMES}" calcMode="spline" keySplines="${KEY_SPLINES}" dur="${DURATION}" begin="${begin}" fill="freeze"/>`;
}

/** The drawing's markup, with ids no other drawing in the document uses. */
export function kangarooArt(): string {
  const n = ++drawings;
  const go = `kg${n}_go`;
  const pouch = `kg${n}_pouch`;
  const after = `${go}.begin`;
  const turn = (pose: Pose): string => `${TURN[pose]} ${PIVOT}`;
  return `<svg class="kg" xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`
    + `<clipPath id="${pouch}"><path d="${CLIP[STILL]}">${motion('animate', 'attributeName="d"', pose => CLIP[pose], after)}</path></clipPath>`
    + `<path d="${OUTLINE}${LIP[STILL]}">${motion('animate', 'attributeName="d"', pose => OUTLINE + LIP[pose], after)}</path>`
    + `<path d="${EYE}"/>`
    + `<g clip-path="url(#${pouch})">`
    + `<g transform="translate(${SHIFT[STILL]})">${motion('animateTransform', 'attributeName="transform" type="translate"', pose => SHIFT[pose], after)}`
    + `<g transform="rotate(${turn(STILL)})">${motion('animateTransform', `id="${go}" data-kg-go attributeName="transform" type="rotate"`, turn, 'indefinite')}`
    + `<path class="kg-joey" d="${JOEY}"/><path d="${JOEY_EYE}"/>`
    + '</g></g></g>'
    + `<path d="${RIM}${RIM_END[STILL]}">${motion('animate', 'attributeName="d"', pose => RIM + RIM_END[pose], after)}</path>`
    + '</svg>';
}

/**
 * Play the motion once, from the start, when motion is allowed: neither the
 * system's reduced-motion setting nor the app's own (html[data-a11y-motion="reduce"])
 * may be on. Otherwise the still stays and beginElement() is never called. Returns
 * whether the motion started.
 */
export function playKangaroo(root: ParentNode): boolean {
  if (prefersReducedMotion()) return false;
  const trigger = root.querySelector<SVGAnimationElement>('svg.kg [data-kg-go]');
  if (typeof trigger?.beginElement !== 'function') return false;
  try {
    trigger.beginElement();
  } catch {
    return false; // decoration only: a motion that cannot start leaves the still
  }
  return true;
}
