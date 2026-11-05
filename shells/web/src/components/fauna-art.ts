// SPDX-License-Identifier: MPL-2.0
/**
 * Fauna: Lolly's line drawings of the animals that wandered into the studio. Each
 * one watches the place where the first action happens in a blank room and leads
 * the eye there:
 *
 * - the lorikeet, a compact rainbow lorikeet perched and leaning forward, turns
 *   its head to look at the colour it is beside;
 * - the magpie, mid-stride on the lawn with its white nape and shoulder, cocks
 *   its head to listen at an empty logo slot or a drop area;
 * - the echidna, spines over its domed back, lifts its long snout and sniffs
 *   towards the empty Files room;
 * - the koala, asleep on a gum branch, wakes gently at the WebGPU gate.
 *
 * They are drawn in the kangaroo's system (components/kangaroo-art.ts): a 2-unit
 * round stroke on a 120 grid in currentColor, so the host's CSS colours them for
 * every theme and brand, and nothing filled. Each drawing is aria-hidden with no
 * title or description: the words beside it carry the meaning.
 *
 * One drawing is both the still and the motion. It is drawn in the end pose, so it
 * is the still wherever nothing starts the motion (Reduce motion, the system
 * setting, a test DOM). The motion is SMIL, because CSS cannot morph a path in
 * WebKit, and every moving stroke keeps the same commands in every pose so the
 * path morphs instead of jumping. Nothing starts by itself: playFauna() calls
 * beginElement() on the drawing's first motion and every other motion begins with
 * that one. Each motion is one short gesture, under 1.5 s, and never repeats.
 *
 * Ids are minted per drawing and hold no hyphen: Chrome reads the hyphen in a
 * begin value such as "fa-go.begin" as a negative offset, and every motion keyed
 * to that value never starts. WebKit's parser for begin values comes from the
 * same code.
 *
 * Placement follows the slot contract: a view leaves
 * <span class="fauna-slot" data-fauna="lorikeet" data-fauna-watch="..."
 * aria-hidden="true"></span> where the animal belongs, and hydrateFauna() fills
 * it, turns the animal to face what it watches and plays the motion once, the
 * first time the slot comes into view. The colour and size are in
 * styles/parts/fauna.css. Chrome only: never inside a tool canvas or an export
 * stage, so exports stay byte-identical.
 *
 * The anchors and poses come from the brand drafts (fa.py, one module per animal
 * and emit.py, which writes the data below) in plans/lolly-brand-universe/drafts/fauna.
 */
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';

export type FaunaName = 'lorikeet' | 'magpie' | 'echidna' | 'koala';

/** Which way the animal looks. Every drawing faces right as drawn. */
export type FaunaFace = 'left' | 'right';

export interface FaunaArtOptions {
  /** Which way the animal looks; right, as drawn, unless this says left. */
  face?: FaunaFace;
}

interface Drawing {
  /** The 120 grid framed round the drawing, the same 96 units square for every animal. */
  readonly viewBox: string;
  readonly dur: string;
  readonly keyTimes: string;
  readonly keySplines: string;
  /** The pose at each key time, as an index into each moving stroke's poses. The last is the still. */
  readonly keys: readonly number[];
  /** Each stroke: one fixed path, or one path per pose with the same commands in each. */
  readonly strokes: readonly (string | readonly string[])[];
}

/* The drawings, written by plans/lolly-brand-universe/drafts/fauna/emit.py. */
const LORIKEET: Drawing = {
  viewBox: '12 14 96 96',
  dur: '1100ms',
  keyTimes: '0;0.12;0.55;1',
  keySplines: '0 0 1 1;.5 0 .2 1;.4 0 .4 1',
  keys: [0, 0, 1, 2],
  strokes: [
    // the branch
    'M14 88.8C35.99 88.03 84.01 86.97 106 86.2',
    // the bird
    [
      'M29.56 85.57C32.54 82.89 41.07 71.63 43.93 67.05C46.05 63.66 48.22 55.56 49.17 51.06C50.13 46.56 54.77 43.63 57.56 40.01C59.74 37.18 62.49 31.99 66.14 30.37C69.8 28.74 74.09 29.41 76.83 30.63C77.93 31.12 79.35 32.67 80.35 32.74C82.94 32.92 86.5 33.93 87.55 36.09C88.69 38.42 89.27 41.88 88.85 44.24C86.46 44.08 84.73 42.21 83.16 42.55C83.83 43.29 85.18 44.73 85.12 45.73C83.8 46.21 83.26 47.5 82.29 48.21C84.73 52.11 88.5 59.1 88.85 64.08C89.2 69.07 84.78 76.17 82.19 79.73C80.08 82.64 71.56 85.8 68.02 86.43C64.47 87.05 56.61 82.79 52.23 81.37C48.43 80.14 35.47 84.52 29.56 85.57',
      'M29.7 83C32.87 80.56 42.23 69.99 45.44 65.65C47.81 62.43 50.59 54.52 51.89 50.1C53.19 45.69 62.68 38.82 66.7 36.72C69.84 35.08 79.72 32.41 83.59 33.41C87.47 34.4 90.41 37.6 91.8 40.26C92.36 41.32 92.51 43.42 93.25 44.1C95.17 45.85 97.33 48.85 96.81 51.19C96.26 53.73 94.56 56.8 92.76 58.39C90.99 56.77 90.79 54.24 89.36 53.53C89.42 54.52 89.59 56.5 88.91 57.24C87.59 56.79 86.36 57.47 85.16 57.42C84.65 61.99 90.49 61.13 90.46 66.13C90.42 71.13 85.47 77.87 82.62 81.22C80.28 83.96 71.55 86.46 67.97 86.81C64.39 87.16 56.87 82.31 52.62 80.56C48.92 79.04 35.67 82.42 29.7 83',
      'M29.64 83.7C32.76 81.19 41.9 70.43 45.01 66.02C47.32 62.75 49.94 54.78 51.14 50.34C52.35 45.9 60.29 39.54 64.1 37C67.08 35.02 75.36 31.24 79.34 31.6C83.33 31.96 86.75 34.64 88.54 37.04C89.26 38 89.75 40.06 90.59 40.6C92.76 42.03 95.37 44.64 95.24 47.04C95.09 49.63 93.91 52.93 92.39 54.79C90.39 53.48 89.78 51.01 88.26 50.53C88.48 51.51 88.96 53.43 88.41 54.27C87.03 54.04 85.92 54.91 84.73 55.05C84.96 59.64 89.96 60.56 90.03 65.56C90.1 70.56 85.29 77.4 82.51 80.81C80.24 83.6 71.56 86.28 67.99 86.7C64.41 87.13 56.8 82.44 52.51 80.78C48.78 79.33 35.6 82.99 29.64 83.7',
    ],
    // the collar, where the blue head ends
    [
      'M57.92 42.69C61.05 46.55 77.27 51.66 83.21 51.35',
      'M65.06 39.73C66.55 44.42 79.68 55.02 85.29 56.88',
      'M62.98 40.07C64.91 44.66 79.08 54.11 84.89 55.47',
    ],
    // the folded wing
    [
      'M68.34 55.4C66.3 59.96 63.3 68.02 59.88 71.1C56.46 74.18 45.65 76.65 40.68 77.17',
      'M70.67 55.89C68.29 60.29 64.67 68.1 61.03 70.9C57.39 73.71 46.42 75.35 41.42 75.49',
      'M70.04 55.74C67.75 60.19 64.3 68.07 60.71 70.95C57.13 73.83 46.2 75.7 41.21 75.94',
    ],
    // the foot
    'M64.6 85.2C64.77 86.79 64.9 89.19 65.6 90.4C66.3 91.61 68.73 90.5 69.8 89.6',
    // the eye
    [
      'M74.28 36.98h.01',
      'M85.86 43.65h.01',
      'M83.22 41.34h.01',
    ],
  ],
};
const MAGPIE: Drawing = {
  viewBox: '12 14 96 96',
  dur: '1100ms',
  keyTimes: '0;0.12;0.36;0.56;1',
  keySplines: '0 0 1 1;.3 0 .2 1;.4 0 .5 1;0 0 1 1',
  keys: [0, 0, 1, 2, 2],
  strokes: [
    // the lawn and a tuft of grass
    'M26 104L102 104M84 104L82.4 98.6M86.4 104L86.8 97.4M88.8 104L90.8 99.4',
    // the legs
    [
      'M57.4 82.2L49 104M64 83.4L72.4 104',
      'M57.31 82.49L49 104M63.85 83.96L72.4 104',
      'M57.34 82.43L49 104M63.9 83.81L72.4 104',
    ],
    // the bird
    [
      'M60.05 81.46C56.14 80.62 50.39 80.25 46.37 78.46C42.17 76.59 31.63 82.26 26.77 83.47C26.67 82.47 24.79 79.46 24.93 78.47C29.56 76.6 38.87 71.02 43.11 68.37C47.69 65.51 53.38 58.07 56.35 53.32C59.1 48.91 66.24 43.97 69.65 41.2C72.29 39.07 75.44 35.92 78.84 35.8C81.63 35.71 83.78 36.85 85.77 38.19C86.6 38.75 86.82 39.95 87.67 40.48C94.12 44.51 105.42 52.16 107.78 54.01C106.44 54.39 106.74 54.27 106.14 54.18C99.28 51.41 91.62 49.14 87.86 47.77C87.16 48.99 86.39 50.83 86.02 52.18C84.19 58.93 85.71 66.98 81.71 73.2C79.22 77.06 70.03 83 65.43 83',
      'M59.99 81.86C56.11 80.86 50.39 80.24 46.45 78.29C42.32 76.24 31.56 81.47 26.66 82.47C26.6 81.47 24.84 78.39 25.02 77.4C29.73 75.73 39.27 70.54 43.61 68.07C48.31 65.4 54.3 58.21 57.47 53.59C60.4 49.3 70.46 43.05 74.46 41.51C77.56 40.31 85.47 40.06 88.37 41.83C90.76 43.29 91.92 45.42 92.84 47.64C93.23 48.56 92.75 49.68 93.17 50.59C96.33 57.5 101.56 70.12 102.51 72.96C101.18 72.54 101.5 72.6 101.05 72.2C96.85 66.11 91.69 60 89.31 56.79C88.06 57.42 86.73 57.33 85.8 58.35C81.14 63.43 84.42 69.27 79.61 74.74C76.62 78.14 69.9 83.82 65.3 83.63',
      'M60.01 81.76C56.12 80.82 50.38 80.28 46.42 78.38C42.27 76.39 31.57 81.76 26.69 82.84C26.61 81.84 24.82 78.78 24.98 77.79C29.67 76.05 39.13 70.73 43.44 68.2C48.1 65.47 53.99 58.2 57.09 53.53C59.97 49.2 69.3 42.98 73.23 41.15C76.27 39.74 83.34 38.63 86.43 40.05C88.98 41.21 90.39 43.2 91.56 45.29C92.05 46.16 91.72 47.33 92.24 48.18C96.2 54.67 102.88 66.58 104.16 69.29C102.79 69.03 103.11 69.05 102.62 68.71C97.73 63.16 91.89 57.7 89.14 54.79C87.97 55.56 86.68 55.89 85.85 57C81.69 62.56 84.62 68.73 79.97 74.41C77.08 77.93 69.95 83.58 65.35 83.45',
    ],
    // the edge of the white nape
    [
      'M77.56 36.23C75.84 40.49 75.04 45.66 72.45 48.7C70.12 51.44 63.43 52.15 59.88 51.53',
      'M87.07 41.48C83.28 44.1 78.47 47.4 75.03 49.27C71.94 50.95 64.59 52.72 61.08 51.95',
      'M85.1 39.86C81.65 42.9 77.58 46.8 74.27 48.95C71.29 50.88 64.21 52.56 60.68 51.83',
    ],
    // the white shoulder patch
    [
      'M75.12 60.68C71.47 59.06 64.17 59.19 59.94 60.4C58.02 60.95 55.22 62.13 54.65 63.41C56.21 63.8 60.27 65.12 64.26 65.4C67.85 65.65 77.86 61.9 75.12 60.68Z',
      'M75.92 61.73C72.33 59.96 65.04 59.78 60.76 60.82C58.82 61.29 55.98 62.35 55.35 63.6C56.89 64.06 60.89 65.54 64.87 65.99C68.44 66.39 78.6 63.07 75.92 61.73Z',
      'M75.66 61.41C72.05 59.69 64.75 59.61 60.49 60.71C58.55 61.21 55.72 62.31 55.12 63.57C56.66 64 60.68 65.43 64.67 65.82C68.25 66.17 78.36 62.71 75.66 61.41Z',
    ],
    // the folded wing
    [
      'M70.91 69.32C64.91 69.32 56.11 69.29 50.15 69.92C45.17 70.44 38.23 74.16 34.39 75.26',
      'M71.34 70.19C65.35 69.94 56.57 69.54 50.58 69.91C45.59 70.23 38.49 73.65 34.61 74.59',
      'M71.2 69.93C65.2 69.76 56.41 69.49 50.43 69.95C45.45 70.33 38.4 73.85 34.53 74.85',
    ],
    // the eye
    [
      'M81.87 41.48h.01',
      'M87.78 48.24h.01',
      'M86.61 46.48h.01',
    ],
  ],
};
const ECHIDNA: Drawing = {
  viewBox: '12 18 96 96',
  dur: '1300ms',
  keyTimes: '0;0.08;0.4;0.52;0.64;0.76;1',
  keySplines: '0 0 1 1;.4 0 .25 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .5 1',
  keys: [0, 0, 1, 2, 1, 2, 3],
  strokes: [
    // the ground
    'M12 100L108 100',
    // the echidna, its spines on the outline
    [
      'M24 100C23.48 97.05 19.96 90.96 20.28 87.97L16.57 84.87L22.73 80.53L18.85 76.63L26.35 73.83L22.57 69.09L31.01 68.14L27.62 62.65L36.51 63.68L33.8 57.63L42.63 60.65L40.82 54.3L49.12 59.15L48.37 52.85L55.74 59.26L56.1 53.35L62.2 60.96L63.64 55.8L68.25 64.19L70.64 60.11L73.65 68.81L76.74 66.06L78.18 74.65L81.64 73.39L82.05 81.69C83.23 82.78 86.66 82.18 88.26 83C90.4 84.09 93.97 86.21 96.65 87.57C99.86 89.2 105.29 93.19 106.53 94.2C105.79 94.48 105.63 96.08 105.03 95.99C101.48 95.42 97.21 94.19 93.7 93.38C91.36 92.84 87.62 92.16 86.17 92.83C85.65 93.91 84.21 94.42 84 95.6C83.83 96.58 85.87 98.19 87 98.6C87.94 98.94 88.93 99.25 89.2 100',
      'M24 100C23.48 97.05 19.96 90.96 20.28 87.97L16.57 84.87L22.73 80.53L18.85 76.63L26.35 73.83L22.57 69.09L31.01 68.14L27.62 62.65L36.51 63.68L33.8 57.63L42.63 60.65L40.82 54.3L49.12 59.15L48.37 52.85L55.74 59.26L56.1 53.35L62.2 60.96L63.64 55.8L68.25 64.19L70.64 60.11L73.65 68.81L76.74 66.06L78.18 74.65L81.64 73.39L81.21 81.3C82.48 82.26 83.62 79.66 85.4 79.92C87.78 80.25 91.85 81.09 94.82 81.5C98.38 82 104.82 84.01 106.32 84.55C105.71 85.07 106.08 86.63 105.49 86.73C101.94 87.36 97.51 87.58 93.93 87.96C91.54 88.21 87.84 90.14 86.55 91.07C86.26 92.24 84.21 94.42 84 95.6C83.83 96.58 85.87 98.19 87 98.6C87.94 98.94 88.93 99.25 89.2 100',
      'M24 100C23.48 97.05 19.96 90.96 20.28 87.97L16.57 84.87L22.73 80.53L18.85 76.63L26.35 73.83L22.57 69.09L31.01 68.14L27.62 62.65L36.51 63.68L33.8 57.63L42.63 60.65L40.82 54.3L49.12 59.15L48.37 52.85L55.74 59.26L56.1 53.35L62.2 60.96L63.64 55.8L68.25 64.19L70.64 60.11L73.65 68.81L76.74 66.06L78.18 74.65L81.64 73.39L81.25 81.3C82.52 82.27 83.79 79.73 85.57 80.01C87.94 80.39 91.78 81.29 94.78 81.39C98.37 81.52 104.98 82.83 106.54 83.22C105.98 83.8 106.51 85.31 105.93 85.47C102.47 86.47 98.08 87.15 94.56 87.9C92.21 88.4 87.84 90.22 86.54 91.14C86.24 92.3 84.21 94.42 84 95.6C83.83 96.58 85.87 98.19 87 98.6C87.94 98.94 88.93 99.25 89.2 100',
      'M24 100C23.48 97.05 19.96 90.96 20.28 87.97L16.57 84.87L22.73 80.53L18.85 76.63L26.35 73.83L22.57 69.09L31.01 68.14L27.62 62.65L36.51 63.68L33.8 57.63L42.63 60.65L40.82 54.3L49.12 59.15L48.37 52.85L55.74 59.26L56.1 53.35L62.2 60.96L63.64 55.8L68.25 64.19L70.64 60.11L73.65 68.81L76.74 66.06L78.18 74.65L81.64 73.39L81.44 81.37C82.69 82.37 84.47 80.22 86.22 80.62C88.56 81.16 92.55 82.35 95.47 83.03C98.98 83.84 105.21 86.39 106.66 87.07C106.01 87.52 106.24 89.11 105.64 89.16C102.06 89.48 97.62 89.31 94.02 89.38C91.62 89.42 87.83 90.67 86.49 91.54C86.14 92.69 84.21 94.42 84 95.6C83.83 96.58 85.87 98.19 87 98.6C87.94 98.94 88.93 99.25 89.2 100',
    ],
    // its belly and legs
    'M79.4 100C79.21 98.21 79.01 94.3 77.8 93.6C74.34 91.6 48 93.19 42 93.4C40.4 93.46 39.57 95.46 39.2 96.6C38.89 97.55 41.62 98.63 42.6 98.8C43.58 98.97 45.33 99.25 45.6 100',
    // the eye
    [
      'M86.16 87.33h.01',
      'M84.82 84.69h.01',
      'M84.91 84.77h.01',
      'M85.23 85.33h.01',
    ],
  ],
};
const KOALA: Drawing = {
  viewBox: '12 18 96 96',
  dur: '1400ms',
  keyTimes: '0;0.16;0.5;0.74;1',
  keySplines: '0 0 1 1;.45 0 .55 1;.3 0 .4 1;.4 0 .5 1',
  keys: [0, 0, 1, 2, 3],
  strokes: [
    // the branch
    'M14 85.6C33.95 84.2 84.01 81.17 106 80.4',
    // a gum leaf
    'M95 82.4C95.48 86.97 98.82 89.7 98 93C97.13 96.49 94.84 101.01 93.4 102.4C94.63 99.02 93.38 93.38 93.8 89.4C94.11 86.42 94.79 80.41 95 82.4Z',
    // the koala
    [
      'M42 83.2C40.21 76.02 37.71 69.19 39.4 62.4C40.71 57.16 47.25 50.46 50.28 47.99C52.1 46.51 55.93 42.18 55.65 40.6C55.06 37.25 53.71 32.71 55.51 29.6C57.41 26.3 63.1 21.92 66.81 23.9C70.34 25.77 70.86 30.74 69.81 32.89C72.66 31.97 75.11 31.31 78.4 32.78C81.32 34.08 83.44 37 84.16 39.5C84.55 40.85 84.06 42.91 84.89 43.77C87.67 46.65 90.98 52.84 89.29 56.02C87.78 58.84 83.87 60.67 81.32 60.13C79.95 59.84 78.32 59.91 76.94 60.15C75.17 60.46 75.04 58.39 74.26 60.19C72.53 64.14 78.54 64.31 80 67.6C81.46 70.89 81.73 73.22 81.4 76.4C81.19 78.39 80.71 80.4 80.6 82C81.92 82.48 83.59 83.47 84 84.6',
      'M42 83.2C40.21 76.02 37.71 69.19 39.4 62.4C40.71 57.16 46.34 51.57 49.15 48.76C50.84 47.06 52.47 43.22 51.84 41.75C50.51 38.62 48.18 34.5 49.24 31.06C50.35 27.42 54.9 21.88 58.96 22.96C62.82 24 64.45 28.72 63.91 31.06C66.48 29.51 68.72 28.32 72.25 29.01C75.39 29.62 78.12 31.99 79.38 34.27C80.06 35.49 80.04 37.61 81.05 38.26C84.4 40.44 89.02 45.73 88.09 49.2C87.26 52.29 83.85 54.96 81.25 55.01C79.85 55.03 78.27 55.46 76.98 56.01C75.33 56.71 75.29 56.92 74.66 58.81C73.28 62.96 78.54 64.31 80 67.6C81.46 70.89 81.73 73.22 81.4 76.4C81.19 78.39 80.71 80.4 80.6 82C81.92 82.48 83.59 83.47 84 84.6',
      'M42 83.2C40.21 76.02 37.71 69.19 39.4 62.4C40.71 57.16 45.71 53.25 48.13 50.08C49.58 48.17 48.78 45.65 47.75 44.43C45.57 41.82 42.13 38.56 42.13 34.96C42.13 31.16 44.87 24.53 49.07 24.38C53.06 24.24 56 28.28 56.16 30.67C58.17 28.44 59.96 26.65 63.54 26.28C66.73 25.94 70.03 27.41 71.9 29.22C72.9 30.19 73.51 32.22 74.66 32.55C78.51 33.65 84.47 37.36 84.59 40.96C84.7 44.16 82.23 47.7 79.76 48.51C78.42 48.94 77.04 49.81 75.97 50.71C74.59 51.87 75.24 54.94 74.84 56.9C73.96 61.21 78.54 64.31 80 67.6C81.46 70.89 81.73 73.22 81.4 76.4C81.19 78.39 80.71 80.4 80.6 82C81.92 82.48 83.59 83.47 84 84.6',
      'M42 83.2C40.21 76.02 37.71 69.19 39.4 62.4C40.71 57.16 45.83 52.66 48.4 49.6C49.94 47.76 49.89 44.73 49 43.4C47.1 40.58 44.02 36.98 44.4 33.4C44.8 29.62 48.21 23.31 52.4 23.6C56.39 23.88 58.88 28.2 58.8 30.6C61.03 28.59 63 27 66.6 27C69.8 27 72.93 28.81 74.6 30.8C75.5 31.87 75.89 33.95 77 34.4C80.71 35.9 86.25 40.21 86 43.8C85.78 46.99 82.94 50.26 80.4 50.8C79.03 51.09 77.56 51.82 76.4 52.6C74.91 53.61 75.28 55.66 74.8 57.6C73.74 61.87 78.54 64.31 80 67.6C81.46 70.89 81.73 73.22 81.4 76.4C81.19 78.39 80.71 80.4 80.6 82C81.92 82.48 83.59 83.47 84 84.6',
    ],
    // the edge of the nose
    [
      'M84.89 43.77C79.99 47.88 80.68 53.97 81.32 60.13',
      'M81.05 38.26C77.19 43.37 79.24 49.14 81.25 55.01',
      'M74.66 32.55C72.47 38.56 76.11 43.49 79.76 48.51',
      'M77 34.4C74.19 40.15 77.3 45.43 80.4 50.8',
    ],
    // the arm
    'M61.2 60C62.56 64.18 64.12 68.47 66 72C67.13 74.12 69.77 78.02 71 79.6C71.86 80.7 73.79 82.42 74 83.6',
    // the eye, shut until it wakes
    [
      'M74.94 44.48C75.24 46.26 77.43 47.24 78.96 46.27',
      'M71.51 41.19C72.21 42.86 74.56 43.31 75.83 42.03',
      'M68.62 38.21C68.62 38.21 68.62 38.21 68.63 38.21',
      'M70.4 39.4C70.4 39.4 70.4 39.4 70.41 39.4',
    ],
  ],
};
/* End of the drawings. */

const DRAWINGS: Readonly<Record<FaunaName, Drawing>> = {
  lorikeet: LORIKEET,
  magpie: MAGPIE,
  echidna: ECHIDNA,
  koala: KOALA,
};

export const FAUNA_NAMES = Object.keys(DRAWINGS) as readonly FaunaName[];

/** The drawings Andy has approved to ship (2026-11-04: the koala, lorikeet A,
 *  magpie B and echidna A). Every view hydrates with this list, so a slot for an
 *  animal that is not on it stays an empty placeholder. */
export const APPROVED_FAUNA: readonly FaunaName[] = ['lorikeet', 'magpie', 'echidna', 'koala'];

export function isFaunaName(name: string | null | undefined): name is FaunaName {
  return typeof name === 'string' && Object.hasOwn(DRAWINGS, name);
}

let drawings = 0;

/** The mirror for a left-facing drawing: flipped about the middle of its own viewBox. */
function mirror(viewBox: string): string {
  const [x = 0, , w = 0] = viewBox.split(' ').map(Number);
  return `matrix(-1 0 0 1 ${2 * x + w} 0)`;
}

/** The drawing's markup, in its still, with ids no other drawing in the document uses. */
export function faunaArt(name: FaunaName, opts: FaunaArtOptions = {}): string {
  const art = DRAWINGS[name];
  const n = ++drawings;
  const go = `fa${n}_go`;
  const still = art.keys[art.keys.length - 1] ?? 0;
  let first = true;
  const strokes = art.strokes.map((stroke) => {
    if (typeof stroke === 'string') return `<path d="${stroke}"/>`;
    const begin = first ? `id="${go}" data-fauna-go begin="indefinite"` : `begin="${go}.begin"`;
    first = false;
    const values = art.keys.map(k => stroke[k]).join(';');
    return `<path d="${stroke[still]}"><animate ${begin} attributeName="d" values="${values}" keyTimes="${art.keyTimes}" calcMode="spline" keySplines="${art.keySplines}" dur="${art.dur}" fill="freeze"/></path>`;
  }).join('');
  const face = opts.face === 'left' ? 'left' : 'right';
  const flip = face === 'left' ? ` transform="${mirror(art.viewBox)}"` : '';
  return `<svg class="fauna fauna--${name}" xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-fauna-face="${face}">`
    + `<g data-fauna-flip${flip}>${strokes}</g></svg>`;
}

/** Turn a drawing already in the document to look left or right. */
export function faceFauna(svg: Element, face: FaunaFace): void {
  const g = svg.querySelector('[data-fauna-flip]');
  const viewBox = svg.getAttribute('viewBox');
  if (!g || !viewBox) return;
  if (face === 'left') g.setAttribute('transform', mirror(viewBox));
  else g.removeAttribute('transform');
  svg.setAttribute('data-fauna-face', face);
}

/**
 * Play the motion of every Fauna drawing in el (or el itself) once, from the
 * start, when motion is allowed: neither the system's reduced-motion setting nor
 * the app's own (html[data-a11y-motion="reduce"]) may be on. Otherwise the still
 * stays and beginElement() is never called. Returns whether a motion started.
 */
export function playFauna(el: Element | ParentNode): boolean {
  if (prefersReducedMotion()) return false;
  const triggers = [...el.querySelectorAll<SVGAnimationElement>('svg.fauna [data-fauna-go]')];
  let started = false;
  for (const trigger of triggers) {
    if (typeof trigger.beginElement !== 'function') continue;
    try {
      trigger.beginElement();
      started = true;
    } catch {
      // decoration only: a motion that cannot start leaves the still
    }
  }
  return started;
}

/** Slots that have played this session, by key, so a view that renders again shows the still. */
const played = new Set<string>();

/** Forget which slots have played; for tests. */
export function _resetFaunaForTests(): void {
  played.clear();
}

/** The slot's key: its own data-fauna-key, else the animal with what it watches. */
function slotKey(slot: HTMLElement, name: FaunaName): string {
  return slot.dataset.faunaKey || `${name}|${slot.dataset.faunaWatch ?? ''}`;
}

/** The element the slot's data-fauna-watch selector finds, in the root first and then the document. */
function watched(slot: HTMLElement, root: ParentNode): Element | null {
  const selector = slot.dataset.faunaWatch?.trim();
  if (!selector) return null;
  for (const scope of [root, slot.ownerDocument]) {
    try {
      const el = scope.querySelector(selector);
      if (el && el !== slot) return el;
    } catch {
      return null; // a description rather than a selector: the animal keeps its own facing
    }
  }
  return null;
}

/**
 * Which way the animal should look. data-fauna-watch may be a direction (left,
 * right, start or end) or a selector for the element it watches; the animal
 * turns towards that element's side of the slot. Without a layout to measure
 * (a test DOM, a slot not yet laid out) it keeps the way it is drawn.
 */
function facing(slot: HTMLElement, root: ParentNode): FaunaFace {
  const watch = slot.dataset.faunaWatch?.trim();
  if (watch === 'left' || watch === 'right') return watch;
  if (watch === 'start' || watch === 'end') {
    const rtl = getComputedStyle(slot).direction === 'rtl';
    return (watch === 'end') === rtl ? 'left' : 'right';
  }
  const target = watched(slot, root);
  if (!target) return 'right';
  const a = slot.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return 'right';
  return b.left + b.width / 2 < a.left + a.width / 2 ? 'left' : 'right';
}

/**
 * Fill every empty .fauna-slot[data-fauna] in root with its drawing, turned to face
 * what it watches. When motion is allowed and the slot has not played this
 * session, the drawing waits hidden (data-fauna-state="waiting", see fauna.css)
 * until the slot first comes into view, then plays once from its first pose. Under
 * reduced motion, or where IntersectionObserver is missing, the still shows at
 * once. `only` limits the pass to the animals named, so a caller hydrates just the
 * drawings Andy has approved and every other slot stays empty. Returns the slots
 * it filled.
 */
export function hydrateFauna(root: ParentNode = document, opts: { only?: readonly FaunaName[] } = {}): HTMLElement[] {
  const filled: HTMLElement[] = [];
  const slots = [...root.querySelectorAll<HTMLElement>('.fauna-slot[data-fauna]')];
  const waiting: HTMLElement[] = [];
  for (const slot of slots) {
    const name = slot.dataset.fauna;
    if (!isFaunaName(name) || slot.querySelector('svg.fauna')) continue;
    if (opts.only && !opts.only.includes(name)) continue;
    slot.setAttribute('aria-hidden', 'true');
    slot.innerHTML = faunaArt(name, { face: facing(slot, root) });
    filled.push(slot);
    const key = slotKey(slot, name);
    if (played.has(key) || prefersReducedMotion() || typeof IntersectionObserver !== 'function') continue;
    slot.dataset.faunaState = 'waiting';
    waiting.push(slot);
  }
  if (waiting.length === 0) return filled;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const slot = entry.target as HTMLElement;
      observer.unobserve(slot);
      const name = slot.dataset.fauna;
      if (!isFaunaName(name)) continue;
      const svg = slot.querySelector('svg.fauna');
      if (svg) faceFauna(svg, facing(slot, root));
      const key = slotKey(slot, name);
      if (!played.has(key)) {
        played.add(key);
        playFauna(slot);
      }
      delete slot.dataset.faunaState;
    }
  }, { threshold: 0.6 });
  for (const slot of waiting) observer.observe(slot);
  return filled;
}
