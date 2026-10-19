// SPDX-License-Identifier: MPL-2.0
import type { SourceDisplay } from './context.ts';
import type { LearningBlock } from '@lolly-tools/core/learning-v1';
import type { LearningRendition } from '../../../../../engine/src/learning/delivery.ts';
import { escape as esc, safeHref } from '../../utils.ts';
import {
  contentIcon,
  contentLabels,
  courseButton as button,
  courseField as field,
  courseDate,
} from '../../lib/learning-ui.ts';

export function sourceLabel(block: LearningBlock): string {
  const source = block.source;
  const name = source?.asset?.meta?.name || source?.values?.title || source?.values?.name;
  return typeof name === 'string' && name
    ? name
    : source?.toolId
      ? `${source.toolId} creation`
      : 'Imported file';
}
export function blockExcerpt(block: LearningBlock, display?: SourceDisplay): string {
  if (block.kind === 'quiz') return block.quiz?.prompt || 'Write a practice question';
  if (block.kind === 'text')
    return block.text?.trim().slice(0, 100) || 'Write an explanation or instruction';
  if (block.kind === 'resource' && block.description) return block.description;
  return display?.name || sourceLabel(block);
}
export function blockMarkup(
  block: LearningBlock,
  index: number,
  choices: LearningRendition[],
  display?: SourceDisplay
): string {
  const id = esc(block.id),
    type = contentLabels[block.kind] || block.kind;
  const excerpt = blockExcerpt(block, display);
  const preview = display?.preview;
  const safePreview = preview && /^(blob:|https?:|data:image\/)/i.test(preview) ? preview : '';
  const media =
    display?.media && /^(blob:|https?:|data:(?:video|audio)\/)/i.test(display.media)
      ? display.media
      : '';
  const sourcePreview = `<figure class="learning-source-preview">${media && ['video', 'audio'].includes(block.kind) ? `<${block.kind} controls preload="none" src="${esc(media)}"${block.kind === 'video' && safePreview ? ` poster="${esc(safePreview)}"` : ''} aria-label="${esc(display?.name || sourceLabel(block))}"></${block.kind}>` : safePreview ? `<img src="${esc(safePreview)}" alt="" loading="lazy" decoding="async">` : ''}<figcaption><strong>${esc(display?.name || sourceLabel(block))}</strong>${display?.detail ? `<span class="learning-hint">${esc(display.detail)}</span>` : ''}${display?.unavailable ? '<span>File unavailable. Add a replacement using Add content, then remove this item.</span>' : !safePreview && block.source?.kind === 'session' ? '<span class="learning-hint">Use learner preview to see the captured content.</span>' : ''}</figcaption></figure>${block.source?.kind === 'session' ? button('preview', 'Preview course') : ''}`;
  const fields =
    block.kind === 'text'
      ? `<div class="learning-rich-toolbar" role="group" aria-label="Text formatting"><select class="field-select" aria-label="Text style"><option value="paragraph">Paragraph</option><option value="2">Heading</option><option value="3">Subheading</option></select>${[
          ['bold', 'Bold', '<b>B</b>'],
          ['italic', 'Italic', '<i>I</i>'],
          ['underline', 'Underline', '<u>U</u>'],
          ['bulletList', 'Bullet list', '• List'],
          ['orderedList', 'Numbered list', '1. List'],
          ['blockquote', 'Quote', '“ ”'],
          ['link', 'Link', 'Link'],
        ]
          .map(
            ([value, label, display]) =>
              `<button type="button" class="btn btn--ghost" data-format="${value}" aria-label="${label}" title="${label}" aria-pressed="false">${display}</button>`
          )
          .join('')}</div><div class="learning-rich-editor" data-rich-text="${id}"></div>`
      : block.quiz
        ? quizMarkup(block)
        : `${sourcePreview}<details class="learning-content-options" data-disclosure="options-${id}"><summary>Content options</summary><div class="learning-source-options">${
            block.source?.kind === 'session'
              ? `<div class="learning-source">
        <label>Render as<select class="field-select" data-block-field="render">${choices.map((r) => `<option value="${r.kind}" ${block.kind === r.kind ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}${!choices.some((r) => r.kind === block.kind) ? `<option selected disabled value="${block.kind}">Unavailable rendition</option>` : ''}</select></label>
        ${block.source.slot ? `<div class="learning-toolbar">${button('edit-source', 'Edit source', block.id)}${button('refresh-source', 'Update from source', block.id)}</div>` : ''}
        <p class="learning-hint">${block.source.slot ? 'Source changes appear here when you choose Update from source.' : 'To refresh a batch row, add it again from Projects.'}</p>
        ${block.source.capturedAt ? `<details data-disclosure="source-${id}"><summary>Source details</summary><p class="learning-hint">Captured ${esc(courseDate(block.source.capturedAt))}</p></details>` : ''}</div>`
              : ''
          }
      ${field(`description-${block.id}`, block.kind === 'resource' ? 'Resource label' : 'Description or equivalent explanation', block.description || '', 'data-block-field="description"', block.kind !== 'resource')}
      ${['image', 'slides'].includes(block.kind) ? `<label class="learning-check"><input class="field-check" type="checkbox" aria-label="Decorative image" data-block-field="decorative" ${block.decorative ? 'checked' : ''}><span>Decorative image<small>No explanation is needed for this image.</small></span></label>` : ''}
      ${['video', 'audio'].includes(block.kind) ? `${field(`transcript-${block.id}`, 'Read as text', block.transcript || '', 'data-block-field="transcript" placeholder="Add a written version of the media..."', true)}${block.kind === 'video' ? `<details data-disclosure="captions-${id}"><summary>Video captions</summary><p class="learning-hint">Paste reviewed WebVTT captions, then check their timing in preview.</p>${field(`captions-${block.id}`, 'Captions (WebVTT)', block.captions || '', 'data-block-field="captions" placeholder="WEBVTT"', true)}</details>` : ''}` : ''}</div></details>`;
  return `<article class="learning-block" data-block="${id}">
    <div class="learning-block-tools" data-block-tools><label class="learning-block-select"><input class="field-check" type="checkbox" data-block-select aria-label="Select content ${index + 1}"></label><button type="button" class="btn btn--ghost learning-icon-button learning-drag-handle" data-block-drag aria-label="Move content ${index + 1}" aria-describedby="learning-drag-help" aria-pressed="false" title="Drag to reorder">${icon('grip', { size: 20, filled: true })}</button></div>
    <header class="learning-block-heading-row" data-block-surface tabindex="0" role="button" aria-label="Select content ${index + 1}"><span class="learning-content-icon">${contentIcon(block.kind)}</span><span class="learning-block-heading"><strong>${index + 1}. ${esc(type)}</strong><span>${esc(excerpt)}</span></span></header><div class="learning-block-body">${fields}</div>
    <button type="button" class="btn btn--ghost learning-icon-button learning-block-menu" data-block-menu aria-label="Content ${index + 1} actions" aria-haspopup="menu" aria-expanded="false">${icon('menu', { size: 20 })}</button>
    <div class="learning-insert-row">${button('insert-content', 'Insert content below', block.id, { icon: 'plus', iconOnly: true })}</div>
  </article>`;
}

function quizMarkup(block: LearningBlock): string {
  const quiz = block.quiz!;
  return `<div class="learning-quiz-editor"><div class="learning-quiz-heading"><span class="learning-hint">Practice check</span><label>Question type<select class="field-select" data-quiz-field="mode" aria-label="Question type">${[
    ['single', 'Choose one'],
    ['multiple', 'Choose several'],
    ['true-false', 'True or false'],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${quiz.mode === value ? 'selected' : ''}>${label}</option>`
    )
    .join('')}</select></label></div>
    ${field(`quiz-prompt-${block.id}`, 'Question', quiz.prompt, 'data-quiz-field="prompt" maxlength="10000" placeholder="What should learners be able to answer?"', true)}
    <fieldset class="learning-quiz-options"><legend>${quiz.mode === 'multiple' ? 'Mark the correct answers' : 'Mark the correct answer'}</legend>${quiz.options.map((option, i) => `<div class="learning-quiz-option"><label class="learning-quiz-correct"><input class="${quiz.mode === 'multiple' ? 'field-check' : 'field-radio'}" type="${quiz.mode === 'multiple' ? 'checkbox' : 'radio'}" name="correct-${esc(block.id)}" data-quiz-correct="${esc(option.id)}" ${option.correct ? 'checked' : ''} aria-label="Answer ${i + 1} is correct"></label><input class="field-input" data-quiz-option-text="${esc(option.id)}" aria-label="Answer ${i + 1}" value="${esc(option.text)}" maxlength="2000" placeholder="Answer ${i + 1}" ${quiz.mode === 'true-false' ? 'readonly' : ''}>${quiz.mode !== 'true-false' && quiz.options.length > 2 ? button('quiz-remove-option', `Remove answer ${i + 1}`, `${block.id}/${option.id}`, { icon: 'trash', iconOnly: true }) : ''}</div>`).join('')}</fieldset>
    ${quiz.mode !== 'true-false' && quiz.options.length < 8 ? button('quiz-add-option', 'Add answer', block.id, { icon: 'plus' }) : ''}
    <details data-disclosure="feedback-${esc(block.id)}"><summary>Answer explanation ${quiz.feedback ? '(added)' : '(optional)'}</summary>${field(`quiz-feedback-${block.id}`, 'Feedback after checking', quiz.feedback, 'data-quiz-field="feedback" maxlength="10000" placeholder="Explain the reasoning behind the correct answer."', true)}</details><p class="learning-hint">Learners can retry. Practice checks do not affect course completion.</p></div>`;
}

import type { LearningModule, LearningTarget } from '@lolly-tools/core/learning-v1';
import { LEARNING_TARGETS, learningSummary } from '../../../../../engine/src/learning/delivery.ts';
import { checkLearningModule } from '../../../../../engine/src/learning/module.ts';
import { learningHandoff } from '../../../../../engine/src/learning/preflight.ts';
import {
  learningPresetChoices,
  learningPresetFor,
  learningPresetStatus,
  learningPresetTarget,
} from '../../../../../engine/src/learning/presets.ts';
import { icon } from '../../lib/icons.ts';
import { targetLabel } from '../../lib/learning-ui.ts';

/** What the destination step shows for a name and target; delivery.ts updates it in place while typing. */
export function presetNotice(destination: string, target: LearningTarget) {
  const preset = learningPresetFor(destination, target);
  const status = learningPresetStatus(preset);
  return {
    preset,
    status,
    tone: status.tested ? 'success' : 'info',
    label: status.label,
    detail: status.detail,
    format: LEARNING_TARGETS.find((t) => t.id === target)!.description,
    limit: preset.limits.packageMB
      ? `${preset.limits.packageMB} MB from the ${preset.name} preset`
      : 'No limit supplied',
  };
}

/**
 * Resolves each LMS name edit in `root` from the format in place when the name field
 * took focus, so a name that matches a preset only on the way to an unlisted name
 * ("Moodle" in "Moodle Workplace") gives that format back.
 */
export function destinationTarget(root: HTMLElement, current: () => LearningTarget) {
  let base: LearningTarget | undefined;
  const isName = (event: Event) => (event.target as Element).matches('[data-delivery-name]');
  root.addEventListener('focusin', (event) => {
    if (isName(event)) base = current();
  });
  root.addEventListener('focusout', (event) => {
    if (isName(event)) base = undefined;
  });
  return (name: string): LearningTarget => learningPresetTarget(name, base ?? current());
}

interface ExportView {
  module: LearningModule;
  target: LearningTarget;
  destination: string;
  maxMB: number;
  step: number;
  active: boolean;
  checking: boolean;
  saving: boolean;
  saved: boolean;
  original: boolean;
  ready: boolean;
  bytes: number;
  note: string;
  message: string;
  tone: string;
}
export function exportMarkup(v: ExportView): string {
  const summary = learningSummary(v.module),
    findings = checkLearningModule(v.module);
  const errors = findings.filter((f) => f.severity === 'error');
  const reviews = findings.filter((f) => f.severity !== 'error');
  const findingList = (items: typeof findings) =>
    `<ul class="learning-findings">${items
      .map((f) => {
        const index = v.module.lessons.findIndex((lesson) => lesson.id === f.lessonId);
        const lesson = v.module.lessons[index];
        const blockIndex = lesson?.blocks.findIndex((block) => block.id === f.blockId) ?? -1;
        const location = lesson
          ? `Lesson ${index + 1}: ${lesson.title || 'Untitled lesson'}${blockIndex >= 0 ? ` / Content ${blockIndex + 1}: ${contentLabels[lesson.blocks[blockIndex]!.kind]}` : ''}`
          : 'Course details';
        return `<li><span><strong>${esc(location)}</strong><span>${esc(f.message)}</span></span>${f.lessonId && !v.original ? `<button type="button" class="btn btn--ghost" data-delivery-lesson="${esc(f.lessonId)}" data-delivery-block="${esc(f.blockId || '')}" aria-label="Fix ${esc(location)}">Fix item</button>` : ''}</li>`;
      })
      .join('')}</ul>`;
  const notice = presetNotice(v.destination, v.target),
    { preset, status } = notice;
  const destination = `<h3>Where will learners take this course?</h3>
    <label>LMS or website<input class="field-input" data-delivery-name list="learning-lms-choices" maxlength="200" autocomplete="off" placeholder="Search LMS names, or choose Other LMS" value="${esc(v.destination)}" ${v.active ? 'disabled' : ''}></label>
    <datalist id="learning-lms-choices">${learningPresetChoices()
      .map((name) => `<option value="${esc(name)}"></option>`)
      .join('')}</datalist>
    <div class="learning-notice" data-delivery-preset data-tone="${notice.tone}" aria-live="polite"><p><strong data-delivery-preset-label>${esc(notice.label)}</strong> <span data-delivery-preset-detail>${esc(notice.detail)}</span></p><p data-delivery-format>${esc(notice.format)}</p></div>
    <div class="learning-export-grid"><label>Delivery format<select class="field-select" data-delivery-target ${v.active ? 'disabled' : ''}>${LEARNING_TARGETS.map((t) => `<option value="${t.id}" ${v.target === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label><label>Upload limit (MB, optional)<input class="field-input" data-delivery-limit type="number" min="0" step="any" placeholder="${esc(notice.limit)}" value="${v.maxMB || ''}" ${v.active ? 'disabled' : ''}></label></div>
    <p class="learning-hint">Choosing an LMS selects its delivery format. Use the format and upload limit supplied by the receiving platform.</p>`;
  const review = `<h3>Review the course</h3><div class="learning-export-overview"><div><strong>${summary.lessons}</strong><span>Lessons</span></div><div><strong>${summary.required}</strong><span>Required</span></div><div><strong>${summary.optional}</strong><span>Optional</span></div></div>
    <dl><dt>Delivery</dt><dd>${esc(targetLabel(v.target))}${v.destination ? ` / ${esc(v.destination)}` : ''}</dd><dt>Compatibility</dt><dd>${esc(`${status.label}. ${status.detail}`)}</dd><dt>Completion</dt><dd>${esc(summary.completion)}</dd><dt>Media</dt><dd>${summary.videos} video, ${summary.audio} audio, ${summary.resources} resources</dd><dt>Practice</dt><dd>${summary.quizzes} quizzes with feedback; no LMS score</dd><dt>Language</dt><dd>${esc(summary.language)} <span class="learning-hint">(player controls in English)</span></dd></dl>
    ${errors.length ? `<section class="learning-notice" data-tone="error"><h3>${errors.length} ${errors.length === 1 ? 'item to fix' : 'items to fix'}</h3>${findingList(errors)}</section>` : '<p class="learning-notice">The course structure is ready. The next check prepares the media and measures the final ZIP.</p>'}
    ${reviews.length ? `<details class="learning-handoff" data-delivery-reviews><summary>${reviews.length} ${reviews.length === 1 ? 'accessibility item' : 'accessibility items'} to review</summary>${findingList(reviews)}</details>` : '<p class="learning-hint">Use learner preview to check explanations, captions and reading order.</p>'}
    ${v.checking ? '<div><progress aria-label="Preparing course"></progress><p class="learning-hint">Preparing the package. You can continue editing; a content change cancels this check.</p></div>' : ''}`;
  const docHref = preset.documentation && safeHref(preset.documentation) ? esc(preset.documentation) : '';
  const download = `<div class="learning-package-ready"><span class="learning-content-icon">${icon('check', { size: 24 })}</span><div><strong>${v.saved ? 'Version saved' : 'Your package is ready'}</strong><p class="learning-hint">${esc(targetLabel(v.target))} / ${(v.bytes / 1_000_000).toFixed(2)} MB (${v.bytes.toLocaleString()} bytes)</p></div></div>
    <p class="learning-notice" data-tone="success">${v.saved ? 'The finished files are kept on this device. Check your downloads folder for the ZIP.' : `The ZIP includes every selected lesson and its finished content.${v.maxMB ? ' It is within your destination upload limit.' : ''}`}</p>
    ${!v.original && !v.saved ? `<label>Version notes<textarea class="field-input" data-delivery-note placeholder="What changed in this version?" ${v.active ? 'disabled' : ''}>${esc(v.note)}</textarea></label>` : ''}
    <section class="learning-handoff"><h3>${v.target === 'static' ? 'Publish on your website' : preset.generic ? 'Import into your LMS' : `Import into ${esc(preset.name)}`}</h3><p>${v.target === 'static' ? 'Extract the ZIP and upload all files together to your website. Link to index.html. Progress stays in the learner’s browser.' : 'Upload the unopened ZIP to a test course. Verify launch, resume and completion before assigning learners.'}</p><details data-delivery-handoff><summary>Full handoff instructions</summary><p class="learning-hint">${esc(preset.instructions)}</p><p class="learning-hint">${esc(learningHandoff(v.target))}</p>${docHref ? `<p><a href="${docHref}" target="_blank" rel="noopener noreferrer">${esc(preset.name)} documentation</a></p>` : ''}</details></section>
    ${v.saved ? '<button type="button" class="btn btn--ghost" data-delivery-report>Download handoff report</button>' : ''}`;
  const next =
    v.step === 0
      ? '<button type="button" class="btn btn--primary" data-delivery-next>Review course</button>'
      : v.step === 1
        ? v.checking
          ? '<button type="button" class="btn btn--ghost" data-delivery-cancel>Cancel check</button>'
          : `<button type="button" class="btn btn--primary" data-delivery-check ${errors.length || v.active ? 'disabled' : ''}>Check and prepare package</button>`
        : v.saved
          ? '<button type="button" class="btn btn--primary" data-delivery-download>Download ZIP again</button>'
          : `<button type="button" class="btn btn--primary" data-delivery-save ${!v.ready || v.active ? 'disabled' : ''}>${v.saving ? 'Saving version...' : 'Save version and download ZIP'}</button>`;
  return `<header class="learning-modal-header"><h2>Export course${v.original ? ' version' : ''}</h2><p>${esc(v.module.title)}${v.original ? ' / Saved course content' : ''}</p><nav aria-label="Export steps"><ol class="learning-export-steps">${['Destination', 'Review', 'Download'].map((label, i) => `<li><button type="button" data-delivery-step="${i}" ${i === v.step ? 'aria-current="step"' : ''} ${v.active || (i === 2 && !v.ready) ? 'disabled' : ''}><span>${i + 1}</span>${label}</button></li>`).join('')}</ol></nav></header>
    <div class="learning-modal-body" data-delivery-body>${[destination, review, download][v.step]}</div>
    <p class="learning-notice" data-tone="${esc(v.tone)}" role="status" data-delivery-status ${!v.message ? 'hidden' : ''}>${esc(v.message)}</p>
    <footer class="learning-modal-footer"><div class="learning-toolbar"><button type="button" class="btn btn--ghost" data-delivery-close>${v.checking ? 'Continue editing' : v.saved ? 'Done' : 'Continue editing'}</button>${v.step > 0 && !v.active && !v.saved ? '<button type="button" class="btn btn--ghost" data-delivery-back>Back</button>' : ''}</div>${next}</footer>`;
}
