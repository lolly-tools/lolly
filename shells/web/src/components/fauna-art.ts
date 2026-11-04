// SPDX-License-Identifier: MPL-2.0
/**
 * Fauna: Lolly's line drawings of the animals that wandered into the studio. Each
 * one watches the place where the first action happens in a blank room and leads
 * the eye there:
 *
 * - the lorikeet, perched, turns its head to look at the colour it is beside;
 * - the magpie, careful and protective, leans in and peers at an empty logo slot
 *   or a drop area;
 * - the wombat, settled at its burrow, lifts its head to watch the Files room;
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

export type FaunaName = 'lorikeet' | 'magpie' | 'wombat' | 'koala';

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
    'M18 85.6C37.99 84.9 84.05 83.33 106 81.8',
    // a twig
    'M92 82.6C93.05 80.44 95.82 76.93 97.4 75.4',
    // the tail below the branch
    [
      'M51.72 87.7C50.09 91.35 45.77 96.44 42.94 99.81C40.75 102.42 35.08 106.79 33.22 107.96C34.74 107.46 43.71 103.85 46.77 100.68C49.83 97.52 56.93 90.11 58.72 87.46',
      'M51.45 86.44C49.51 89.94 44.76 94.63 41.65 97.74C39.24 100.15 33.21 104.01 31.25 105.01C32.81 104.65 42.07 101.83 45.39 98.94C48.71 96.06 56.43 89.3 58.44 86.81',
      'M51.53 86.85C49.69 90.4 45.06 95.22 42.04 98.42C39.7 100.89 33.78 104.92 31.85 105.97C33.4 105.57 42.58 102.49 45.81 99.51C49.05 96.53 56.58 89.56 58.52 87.02',
    ],
    // the bird
    [
      'M50.97 83.32C51.93 79.44 52.36 71.24 52.75 65.65C53.14 60.06 55.21 53.62 56.78 49.3C58.01 45.92 58.96 42.51 59.98 39.3C60.76 36.84 60.22 33.84 61.54 31.37C63.13 28.37 64.71 25.67 68.23 24.25C71.57 22.9 73.92 23.6 76.39 24.41C77.34 24.72 78.64 26.05 79.42 26.25C81.36 26.73 83.85 27.32 84.75 28.88C86.05 31.13 87.3 34.33 87.09 36.32C85.09 36.32 83.18 35.05 81.81 35.34C82.53 36.03 83.34 37.35 83.27 38.25C81.99 38.82 81.33 40.46 80.36 41.16C81.09 45.3 87.09 53.88 87.98 60.22C88.68 65.17 86.23 71.13 83.87 74.37C81.41 77.77 75.88 81.35 72.33 81.98',
      'M51.08 82.02C52.39 78.23 53.53 70.1 54.4 64.57C55.28 59.04 57.9 52.8 59.84 48.63C61.36 45.37 65.43 38.63 67.76 36.24C69.54 34.41 74.51 31.11 77.13 30.1C80.3 28.89 83.26 27.89 86.86 29.12C90.26 30.3 91.57 32.37 92.91 34.59C93.43 35.45 93.53 37.31 93.99 37.97C95.13 39.6 96.63 41.68 96.28 43.45C95.79 46 94.63 49.24 93.17 50.6C91.66 49.29 91.06 47.08 89.83 46.4C89.92 47.4 89.66 48.92 89.02 49.55C87.69 49.14 86.11 49.95 84.92 49.85C82.75 53.45 89.64 55.83 89.97 62.22C90.23 67.22 87.27 72.95 84.65 75.96C81.89 79.13 76.07 82.22 72.49 82.54',
      'M51.03 82.43C52.23 78.62 53.14 70.45 53.86 64.9C54.58 59.34 57.03 53.04 58.86 48.81C60.29 45.51 63.09 39.4 65.11 36.68C66.65 34.61 69.99 30.91 72.35 29.4C75.21 27.57 77.91 25.99 81.68 26.48C85.25 26.95 86.95 28.71 88.71 30.62C89.39 31.36 89.86 33.16 90.44 33.71C91.9 35.08 93.78 36.82 93.8 38.62C93.82 41.22 93.34 44.62 92.18 46.25C90.44 45.27 89.41 43.23 88.07 42.81C88.36 43.77 88.41 45.31 87.91 46.06C86.52 45.93 85.14 47.03 83.95 47.17C82.55 51.13 88.84 55.18 89.36 61.56C89.76 66.55 86.95 72.36 84.41 75.45C81.75 78.69 76.02 81.94 72.44 82.36',
    ],
    // the folded wing
    [
      'M70.79 49.21C69.04 52.81 66.5 62.1 65.59 66.4C64.75 70.32 59.41 79.08 57.91 81.68',
      'M73.8 49.76C71.74 53.19 68.41 62.23 67.12 66.43C65.95 70.26 59.87 78.53 58.15 80.98',
      'M72.84 49.56C70.88 53.04 67.8 62.17 66.63 66.41C65.57 70.27 59.72 78.7 58.07 81.21',
    ],
    // the foot
    'M69.4 81.6C69.51 83.2 69.9 85.19 70.6 86.4C71.3 87.61 73.73 86.3 74.8 85.4',
    // the eye
    [
      'M74.78 29.66h.01',
      'M88.25 37.5h.01',
      'M84.73 34.4h.01',
    ],
  ],
};
const MAGPIE: Drawing = {
  viewBox: '12 18 96 96',
  dur: '1300ms',
  keyTimes: '0;0.14;0.62;1',
  keySplines: '0 0 1 1;.45 0 .25 1;.4 0 .5 1',
  keys: [0, 0, 1, 2],
  strokes: [
    // the back leg
    [
      'M58.39 83.27L55 105.6L63.2 105.6',
      'M58.07 84.23L55 105.6L63.2 105.6',
      'M58.17 83.98L55 105.6L63.2 105.6',
    ],
    // the front leg
    [
      'M64.74 80.62L66.8 105.6L75 105.6',
      'M64.75 82.61L66.8 105.6L75 105.6',
      'M64.76 82.01L66.8 105.6L75 105.6',
    ],
    // the bird
    [
      'M62.72 81.14C58.86 83.64 51.61 84.41 46.39 85.81C41.95 87 35.1 88.42 30.62 89.46C26.72 90.36 19.29 92.46 16.83 93.31C15.99 92.19 15.19 89.59 14.73 88.27C18.31 85.37 23.77 80.01 27.18 76.36C31 72.26 35.33 64.19 37.87 59.2C40.32 54.39 43.89 48.61 46.85 44.58C49.21 41.36 51.21 38.75 54.32 36.57C56.94 34.73 60.48 34.09 63.08 34.23C64.08 34.28 65.69 35.14 66.68 35.02C73.03 34.24 83.96 33.63 87.56 33.81C86.05 35.68 79.52 37.69 73.17 40.65C73.36 41.83 72.92 43.62 73.46 44.69C76.19 50.03 79.78 55.46 79.11 62.82C78.69 67.39 73.41 74.6 70.4 77.22C68.58 78.8 66.45 79.59 64.74 80.62',
      'M62.67 82.8C58.47 84.67 51.19 84.3 45.82 84.87C41.24 85.35 34.26 85.68 29.67 86C25.68 86.28 18.01 87.19 15.45 87.65C14.79 86.41 14.41 83.72 14.17 82.34C18.15 80.04 24.38 75.6 28.32 72.52C32.73 69.08 38.27 61.78 41.56 57.25C44.74 52.88 53.57 42.86 57.84 40.71C61.26 38.99 71.8 36.53 75.49 37.45C78.59 38.22 81.4 40.47 83 42.52C83.61 43.31 84.02 45.09 84.76 45.76C89.52 50.04 97.15 57.88 99.37 60.72C96.97 60.8 91.17 57.19 84.78 54.35C84.01 55.27 82.37 56.1 81.92 57.22C79.67 62.78 82.06 62.93 78.93 69.33C76.98 73.32 74.26 78.02 70.87 80.14C68.84 81.41 66.61 81.86 64.75 82.61',
      'M62.69 82.31C58.59 84.4 51.3 84.41 45.97 85.26C41.43 85.98 34.46 86.67 29.9 87.23C25.93 87.72 18.32 89.04 15.79 89.62C15.06 88.42 14.54 85.75 14.23 84.39C18.09 81.89 24.07 77.13 27.85 73.85C32.07 70.17 37.22 62.6 40.27 57.9C43.21 53.37 50.48 43.56 54.56 40.93C57.83 38.81 66.73 35.49 70.52 35.76C73.71 35.98 76.86 37.71 78.79 39.45C79.54 40.12 80.25 41.8 81.09 42.33C86.52 45.72 95.4 52.12 98.08 54.53C95.73 55.03 89.39 52.48 82.6 50.79C82 51.83 80.53 52.94 80.28 54.11C79.03 59.98 81.34 61.02 78.75 67.77C77.14 71.97 74.02 76.93 70.74 79.22C68.77 80.6 66.57 81.17 64.76 82.01',
    ],
    // the folded wing
    [
      'M57.69 53.36C52.34 56.08 46.83 62.85 42.68 67.98C38.9 72.64 31.75 80.96 27.87 84.11',
      'M62.05 54.58C56.35 56.43 49.84 62.26 44.94 66.67C40.48 70.69 32.12 77.79 27.79 80.29',
      'M60.6 54.16C55 56.31 48.8 62.47 44.14 67.13C39.89 71.38 31.92 78.9 27.73 81.63',
    ],
    // the edge of the white nape
    [
      'M56.37 41.28C54.97 44.6 56.83 49.47 57.76 53.35',
      'M73.27 42.09C69.85 43.2 63.97 49.36 63.21 53.12',
      'M69.14 40.71C65.96 42.4 61.75 48.98 61.36 52.85',
    ],
    // the eye
    [
      'M63.01 39.79h.01',
      'M78.76 46.12h.01',
      'M75.24 43.73h.01',
    ],
  ],
};
const WOMBAT: Drawing = {
  viewBox: '12 8 96 96',
  dur: '1300ms',
  keyTimes: '0;0.16;0.62;1',
  keySplines: '0 0 1 1;.4 0 .2 1;.4 0 .5 1',
  keys: [0, 0, 1, 2],
  strokes: [
    // the ground behind the burrow
    'M12 96L13 96',
    // the ground between the burrow and the wombat
    'M28.2 96L36.49 96',
    // the ground in front
    'M95.22 96L107 96',
    // the burrow's mouth
    'M13 96C13 90.4 16.2 85 20.6 85C25 85 28.2 90.4 28.2 96',
    // the wombat
    [
      'M36.49 96C33.44 95.12 31.27 89.64 31.4 85.82C31.57 80.95 35.95 74.37 39.46 70.98C44.19 66.42 49.02 64.26 56 63.78C64.46 63.18 67.11 64.02 72.96 65.05C76.09 65.6 78.93 65.96 81.41 66.42C82.65 66.65 85.3 66.8 86.04 66.04C87.22 64.82 88.11 62.66 89.94 63.19C91.78 63.72 91.45 65.81 91.8 67.47C94.16 68.43 95.82 69.09 98.44 70.48C100.87 71.77 102.74 74.35 103.97 75.81C103.91 77.3 104.68 79.99 104.22 81.84C103.76 83.69 102.42 85.89 101.42 86.99C99.74 86.76 98.58 87.17 97.23 87.78C95.68 88.47 94.3 89.55 92.4 89.67C89.66 89.84 90.58 88.57 88.06 88.45C87.63 89.86 87.5 90.51 87.8 92.18C88.02 93.44 90.36 92.99 91.82 93.24C93.29 93.5 95 94.75 95.22 96',
      'M36.49 96C33.44 95.12 31.27 89.64 31.4 85.82C31.57 80.95 35.95 74.37 39.46 70.98C44.19 66.42 49.02 64.26 56 63.78C64.46 63.18 67.11 64.02 72.96 65.05C76.09 65.6 76.62 66.03 79.15 66.05C80.42 66.06 79.47 65.17 79.81 64.17C80.37 62.56 80.26 60.23 82.15 59.94C84.03 59.64 84.62 61.68 85.64 63.03C88.18 62.9 89.97 62.79 92.93 62.95C95.68 63.09 98.46 64.64 100.19 65.45C100.77 66.81 102.61 68.93 102.97 70.8C103.34 72.68 103.05 75.24 102.61 76.66C100.99 77.15 100.12 78.02 99.14 79.14C98.03 80.42 97.14 82.79 95.42 83.63C92.95 84.84 91.77 86.98 89.24 87.19C89 88.65 87.5 90.51 87.8 92.18C88.02 93.44 90.36 92.99 91.82 93.24C93.29 93.5 95 94.75 95.22 96',
      'M36.49 96C33.44 95.12 31.27 89.64 31.4 85.82C31.57 80.95 35.95 74.37 39.46 70.98C44.19 66.42 49.02 64.26 56 63.78C64.46 63.18 67.11 64.02 72.96 65.05C76.09 65.6 77.05 65.99 79.59 66.09C80.86 66.15 80.63 65.41 81.07 64.44C81.76 62.89 81.86 60.56 83.76 60.43C85.66 60.3 86.07 62.38 86.97 63.82C89.52 63.91 91.3 63.96 94.24 64.37C96.97 64.76 99.6 66.54 101.26 67.5C101.71 68.91 103.36 71.17 103.56 73.07C103.76 74.97 103.24 77.5 102.69 78.87C101.03 79.22 100.08 80.01 99.02 81.04C97.8 82.22 96.76 84.34 94.99 85.04C92.43 86.06 91.57 87.38 89.03 87.52C88.75 88.98 87.5 90.51 87.8 92.18C88.02 93.44 90.36 92.99 91.82 93.24C93.29 93.5 95 94.75 95.22 96',
    ],
    // the edge of the nose
    [
      'M102.71 76.34C100.59 78.7 99.07 82.46 99.62 85.59',
      'M99.28 66.45C98.35 69.49 98.56 73.54 100.39 76.15',
      'M100.26 68.42C99.07 71.36 98.92 75.42 100.51 78.17',
    ],
    // the eye
    [
      'M96.6 76.13h.01',
      'M93.65 68.85h.01',
      'M94.44 70.31h.01',
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
  wombat: WOMBAT,
  koala: KOALA,
};

export const FAUNA_NAMES = Object.keys(DRAWINGS) as readonly FaunaName[];

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
