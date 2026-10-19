// SPDX-License-Identifier: MPL-2.0
import type { LearningContent, LearningTarget } from '@lolly-tools/core/learning-v1';
import {
  learningProgress,
  encodeLearningAttempt,
  decodeLearningAttempt,
} from '../../../engine/src/learning/progress.ts';
import { renderLearningRichText } from './authoring.ts';
import { learningQuizCorrect } from '../../../engine/src/learning/authoring.ts';
import { bootLearningPlayer } from './player.ts';
import { createLearningTracking } from './tracking.ts';

export const LEARNING_PLAYER_VERSION = '1.4.0';
import { learningPresentationCss } from './presentation.ts';
export const learningPlayerCss = `
:root {
  color-scheme: light;
  --ui-color-text-default: #172927;
  --ui-color-text-muted: #526561;
  --ui-color-surface-canvas: #f4f7f6;
  --ui-color-surface-raised: #ffffff;
  --ui-color-surface-muted: #edf2f0;
  --ui-color-action-primary: #0c322c;
  --ui-color-action-on-primary: #ffffff;
  --ui-color-selection-surface: #e5eee9;
  --ui-color-selection-border: #0c322c;
  --ui-color-border-default: #cedbd5;
  --ui-color-focus-ring: #0c322c;
  --ui-type-ui-family: system-ui, sans-serif;
  --learning-font-heading: var(--ui-type-ui-family);
  --ui-type-body: 16px;
  --ui-type-heading: 32px;
  --ui-space-panel: 16px;
  --ui-space-page: 24px;
  --ui-radius-control: 10px;
  --ui-radius-surface: 20px;
  --ui-elevation-panel: 0 8px 28px rgb(0 0 0 / .04);
  font-family: var(--ui-type-ui-family);
  line-height: 1.65;
}
* { box-sizing: border-box; }
body { margin: 0; padding: clamp(16px, 4vw, 48px); background: var(--ui-color-surface-canvas); color: var(--ui-color-text-default); font-size: max(16px, var(--ui-type-body)); }
[hidden] { display: none !important; }
#learning-player { max-width: 1200px; margin: auto; }
h1, h2, h3, p { margin: 0; overflow-wrap: anywhere; }
h1, h2, h3 { font-family: var(--learning-font-heading); line-height: 1.2; text-wrap: balance; }
h1 { font-size: clamp(28px, 4vw, max(42px, var(--ui-type-heading))); letter-spacing: -.025em; max-width: 24ch; }
h2 { font-size: max(24px, var(--ui-type-heading)); }
.learning-course-header { display: grid; gap: var(--ui-space-panel); padding-block: var(--ui-space-panel) calc(2 * var(--ui-space-page)); }
.learning-course-header > p { max-width: 70ch; color: var(--ui-color-text-muted); }
.learning-eyebrow, .learning-position { font-size: .8125em; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--ui-color-text-muted); }
.learning-objectives { max-width: 75ch; padding: var(--ui-space-panel); border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-control); }
.learning-objectives p { white-space: pre-wrap; padding-top: var(--ui-space-panel); }
summary { cursor: pointer; min-height: 44px; align-content: center; font-weight: 600; }
.learning-layout { display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); gap: var(--ui-space-page); align-items: start; }
.learning-sidebar { position: sticky; top: var(--ui-space-page); min-width: 0; display: grid; gap: var(--ui-space-panel); }
.learning-progress { display: grid; gap: 8px; padding: var(--ui-space-panel); background: var(--ui-color-surface-muted); border-radius: var(--ui-radius-control); font-size: .875em; }
progress { display: block; width: 100%; height: 8px; border: 0; border-radius: 99px; overflow: hidden; accent-color: var(--ui-color-action-primary); background: var(--ui-color-selection-surface); }
progress::-webkit-progress-bar { background: var(--ui-color-selection-surface); }
progress::-webkit-progress-value { background: var(--ui-color-action-primary); border-radius: 99px; }
progress::-moz-progress-bar { background: var(--ui-color-action-primary); border-radius: 99px; }
nav { display: grid; gap: 8px; max-height: 60vh; overflow: auto; padding: 4px; }
nav h2 { font-size: .875em; padding: var(--ui-space-panel) 12px 4px; color: var(--ui-color-text-muted); }
button { font: inherit; min-height: 44px; padding: 10px 16px; border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-control); background: var(--ui-color-surface-raised); color: var(--ui-color-text-default); cursor: pointer; overflow-wrap: anywhere; }
button:hover:not(:disabled) { background: var(--ui-color-surface-muted); }
nav button { display: flex; align-items: start; gap: 12px; text-align: start; border-color: transparent; background: transparent; }
.learning-nav-number { flex: none; width: 1.5em; font-variant-numeric: tabular-nums; color: var(--ui-color-text-muted); }
.learning-nav-label { min-width: 0; }
nav button[aria-current=step] { border-color: var(--ui-color-border-default); background: var(--ui-color-selection-surface); font-weight: 650; }
button:disabled { opacity: .5; cursor: default; }
button.btn--primary { background: var(--ui-color-action-primary); border-color: var(--ui-color-action-primary); color: var(--ui-color-action-on-primary); font-weight: 650; }
button.btn--primary:hover:not(:disabled) { background: var(--ui-color-action-primary); filter: brightness(.95); }
:focus-visible { outline: 3px solid var(--ui-color-focus-ring); outline-offset: 3px; }
.learning-reading { min-width: 0; background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-surface); box-shadow: var(--ui-elevation-panel); }
main { min-width: 0; padding: clamp(20px, 4vw, 48px); min-height: 260px; scroll-margin-top: 24px; }
main > h2 { margin-top: 8px; margin-bottom: calc(1.5 * var(--ui-space-page)); }
main section { margin-block: var(--ui-space-page); }
main section:last-child { margin-bottom: 0; }
main section > p, main details { max-width: 70ch; }
img, video { display: block; width: 100%; height: auto; border-radius: var(--ui-radius-control); margin-block: var(--ui-space-panel); }
audio { width: 100%; }
.learning-text, details p { white-space: pre-wrap; }
main section > img + p, main section > video + p { font-size: .875em; color: var(--ui-color-text-muted); }
main details { padding: var(--ui-space-panel); background: var(--ui-color-surface-muted); border-radius: var(--ui-radius-control); margin-top: var(--ui-space-panel); }
main details p { padding-top: var(--ui-space-panel); }
a { color: var(--ui-color-action-primary); text-underline-offset: .2em; overflow-wrap: anywhere; }
.learning-resource { display: block; padding: var(--ui-space-panel); border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-control); }
footer { display: flex; gap: 12px; flex-wrap: wrap; padding: var(--ui-space-page); border-top: 1px solid var(--ui-color-border-default); }
.learning-status { color: var(--ui-color-text-muted); font-size: .8125em; padding: var(--ui-space-panel) var(--ui-space-page); border-top: 1px solid var(--ui-color-border-default); }
.learning-placeholder { padding: var(--ui-space-page); border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-control); color: var(--ui-color-text-muted); background: var(--ui-color-surface-muted); }
.learning-rich-text { max-width: 70ch; overflow-wrap: anywhere; }
.learning-rich-text > * + * { margin-top: 1em; }
.learning-rich-text h2 { font-size: 1.5em; }
.learning-rich-text h3 { font-size: 1.25em; }
.learning-rich-text blockquote { margin-inline: 0; padding: var(--ui-space-panel); background: var(--ui-color-surface-muted); border-left: 3px solid var(--ui-color-border-default); }
.learning-rich-text code { font-size: .9em; background: var(--ui-color-surface-muted); padding: .1em .25em; }
.learning-quiz { padding: var(--ui-space-page); border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-control); background: var(--ui-color-surface-muted); display: grid; gap: var(--ui-space-panel); }
.learning-quiz > p:first-child { color: var(--ui-color-text-muted); font-size: .875em; }
.learning-quiz fieldset { min-width: 0; border: 0; padding: 0; margin: 0; display: grid; gap: 8px; }
.learning-quiz legend { font-family: var(--learning-font-heading); font-size: 1.25em; font-weight: 650; margin-bottom: 12px; }
.learning-quiz fieldset > p { font-size: .875em; color: var(--ui-color-text-muted); margin-bottom: 8px; }
.learning-quiz label { display: flex; gap: 12px; align-items: center; min-height: 44px; padding: 12px; border: 1px solid var(--ui-color-border-default); border-radius: var(--ui-radius-control); background: var(--ui-color-surface-raised); cursor: pointer; }
.learning-quiz label:has(:checked) { background: var(--ui-color-selection-surface); }
.learning-quiz input { flex: none; width: 20px; height: 20px; accent-color: var(--ui-color-action-primary); }
.learning-quiz button { justify-self: start; }
.learning-quiz-feedback { padding: var(--ui-space-panel); background: var(--ui-color-surface-raised); border-radius: var(--ui-radius-control); }
@media (max-width: 700px) {
  .learning-layout { grid-template-columns: minmax(0, 1fr); }
  .learning-sidebar { position: static; }
  nav { max-height: 190px; }
  .learning-course-header { padding-top: 0; padding-bottom: var(--ui-space-page); }
  main { padding: var(--ui-space-page); }
  footer { gap: 8px; padding: var(--ui-space-panel); }
  footer button { flex: 1 1 auto; }
}
@media (forced-colors: active) {
  .learning-reading, .learning-progress { border: 1px solid CanvasText; }
  nav button[aria-current=step] { outline: 2px solid Highlight; }
}
`;

export function learningPlayerStyles(
  content: LearningContent,
  fontUrl?: (path: string) => string
): string {
  return learningPlayerCss + learningPresentationCss(content.presentation, fontUrl);
}

/** Functions have no external runtime bindings; bundling renames cannot break them. */
export function learningPlayerJs(
  content: LearningContent,
  target: LearningTarget | 'preview'
): string {
  const data = JSON.stringify(content)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `(${bootLearningPlayer.toString()})(window,${data},${JSON.stringify(target)},${learningProgress.toString()},${createLearningTracking.toString()},${encodeLearningAttempt.toString()},${decodeLearningAttempt.toString()},${renderLearningRichText.toString()},${learningQuizCorrect.toString()});`;
}

export function learningPlayerHtml(title: string, language: string): string {
  const htmlEscape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
    );
  return `<!doctype html><html lang="${htmlEscape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${htmlEscape(title)}</title><link rel="stylesheet" href="player.css"></head><body><div id="learning-player"></div><script src="player.js"></script></body></html>`;
}
