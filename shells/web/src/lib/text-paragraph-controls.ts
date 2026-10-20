// SPDX-License-Identifier: MPL-2.0
/** The bar and Inspector expose the same authored paragraph settings. */
import type { TextParagraphStyleV1 } from '@lolly-tools/core';
import { textHyphenationLanguage, textRecipe, type TextRecipe } from '@lolly/engine';
import { mountParagraphRefinements } from './text-paragraph-refinements.ts';
import { textControlNumber, styleTextControls, textControlRow, textControlChoices, textControlGrid } from './text-control-ui.ts';
import { t } from '../i18n.ts';
type Settings = TextParagraphStyleV1;
export function mountParagraphControls(root: HTMLElement, read: () => Settings, write: (value: Settings, label: string) => void) {
  const updates: Array<(value: Settings) => void> = [];
  const row = textControlRow;
  const select = (parent: HTMLElement, label: string, choices: Array<[string, string]>, value: (s: Settings) => string, change: (value: string) => Settings) => {
    const input = document.createElement('select'); for (const [value, name] of choices) input.add(new Option(name, value));
    input.addEventListener('change', () => { write(change(input.value), label); refresh(); }); row(parent, label, input);
    updates.push(s => { if (document.activeElement !== input) input.value = value(s); }); return input;
  };
  const number = (parent: HTMLElement, label: string, value: (s: Settings) => number, change: (value: number) => Settings, min = 0, max = 1000, step = '.1') => {
    const field = textControlNumber(parent, label, { value: value(read()), min, max, step: Number(step), onCommit: value => { write(change(value), label); refresh(); } });
    updates.push(s => field.set(value(s)));
  };
  const check = (parent: HTMLElement, label: string, value: (s: Settings) => boolean, change: (value: boolean) => Settings) => {
    const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'field-check'; input.addEventListener('change', () => { write(change(input.checked), label); refresh(); }); row(parent, label, input); updates.push(s => { input.checked = value(s); });
  };
  const alignments: Array<[string, string]> = [['start', t('Start')], ['center', t('Centre')], ['end', t('End')], ['justify', t('Justify')]];
  const alignment = textControlChoices(root, t('Alignment'), [['start', t('Start'), 'textL'], ['center', t('Centre'), 'textC'], ['end', t('End'), 'textR'], ['justify', t('Justify'), 'textJustify']], () => read().align ?? 'start', align => write({ align: align as Settings['align'] }, t('Alignment')));
  updates.push(s => { alignment.refresh(); alignment.group.dataset.direction = s.direction ?? 'auto'; });
  number(root, t('Line height'), s => s.lineHeight ?? 1.2, lineHeight => ({ lineHeight }), .1, 20);
  select(root, t('Composition'), [['standard', t('Standard')], ['balanced', t('Balanced heading')], ['best', t('Best paragraph')]], s => s.composition ?? 'standard', composition => ({ composition: composition as Settings['composition'] }));
  const short = () => read().shortLastLine ?? { enabled: false, words: 2, fraction: .2 };
  check(root, t('Avoid short last line'), s => !!s.shortLastLine?.enabled, enabled => ({ shortLastLine: { ...short(), enabled } }));
  const advanced = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = t('More paragraph settings'); advanced.append(summary); root.append(advanced);
  const spacingFields = textControlGrid(advanced);
  number(spacingFields, t('Space before'), s => s.spaceBefore ?? 0, spaceBefore => ({ spaceBefore }));
  number(spacingFields, t('Space after'), s => s.spaceAfter ?? 0, spaceAfter => ({ spaceAfter }));
  const recipe=select(advanced,t('Apply recipe'),[['',t('Choose a recipe')],['heading',t('Heading')],['body',t('Body')],['label',t('Label')]],()=>'',value=>textRecipe(value as TextRecipe));recipe.options[0]!.disabled=true;
  select(advanced, t('Direction'), [['auto', t('Automatic')], ['ltr', t('Left to right')], ['rtl', t('Right to left')]], s => s.direction ?? 'auto', direction => ({ direction: direction as Settings['direction'] }));
  select(advanced, t('Last line alignment'), alignments, s => s.lastAlign ?? (s.align === 'justify' ? 'start' : s.align) ?? 'start', lastAlign => ({ lastAlign: lastAlign as Settings['align'] }));
  number(advanced, t('Start indent'), s => s.indentStart ?? 0, indentStart => ({ indentStart }));
  number(advanced, t('End indent'), s => s.indentEnd ?? 0, indentEnd => ({ indentEnd }));
  number(advanced, t('First line indent'), s => s.firstIndent ?? 0, firstIndent => ({ firstIndent }), -1000, 1000);
  const keep = () => read().keep ?? {startLines:1,endLines:1,together:false,nextLines:0};
  check(advanced,t('Keep paragraph together'),s=>!!s.keep?.together,together=>({keep:{...keep(),together}}));
  for (const [key,label] of [['startLines',t('Minimum lines before a frame break')],['endLines',t('Minimum lines after a frame break')],['nextLines',t('Keep with next lines')]] as const)
    number(advanced,label,s=>(s.keep ?? keep())[key],value=>({keep:{...keep(),[key]:value}}),0,100,'1');
  check(advanced,t('Align to frame baseline grid'),s=>!!s.baselineGrid,baselineGrid=>({baselineGrid}));
  number(advanced, t('Minimum last-line words'), s => s.shortLastLine?.words ?? 2, words => ({ shortLastLine: { ...short(), words } }), 1, 20, '1');
  number(advanced, t('Minimum last-line width (%)'), s => (s.shortLastLine?.fraction ?? .2)*100, value => ({ shortLastLine: { ...short(), fraction: value/100 } }), 0, 100, '1');
  const spacing = () => read().wordSpacing ?? { min: .8, ideal: 1, max: 1.5 };
  for (const [key, label] of [['min', t('Minimum word spacing (%)')], ['ideal', t('Preferred word spacing (%)')], ['max', t('Maximum word spacing (%)')]] as const)
    number(advanced, label, s => (s.wordSpacing ?? spacing())[key]*100, value => {
      const next = { ...spacing(), [key]: value/100 };
      if (key === 'min') { next.ideal = Math.max(next.min, next.ideal); next.max = Math.max(next.ideal, next.max); }
      else if (key === 'max') { next.ideal = Math.min(next.max, next.ideal); next.min = Math.min(next.ideal, next.min); }
      else { next.min = Math.min(next.min, next.ideal); next.max = Math.max(next.max, next.ideal); }
      return { wordSpacing: next };
    }, 0, 1000, '1');
  const language = document.createElement('input'); language.type = 'text'; language.maxLength = 63; language.placeholder = 'en-GB';
  language.addEventListener('change', () => { if (/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8}){0,5}$/.test(language.value)) { write({ language: language.value }, t('Language')); refresh(); } });
  row(advanced, t('Language'), language); updates.push(s => { if (document.activeElement !== language) language.value = s.language ?? 'und'; });
  const hyphenation = () => read().hyphenation ?? { mode: 'manual', minWord: 6, minBefore: 2, minAfter: 3, consecutive: 2 };
  const hyphens = select(advanced, t('Hyphenation'), [['off', t('Off')], ['manual', t('Manual')], ['auto', t('Automatic')]], s => s.hyphenation?.mode ?? 'manual', mode => ({ hyphenation: { ...hyphenation(), mode: mode as 'off' | 'manual' | 'auto' } }));
  const explanation = document.createElement('p'); explanation.className = 'fc-insp-hint'; advanced.append(explanation);
  updates.push(s => { const supported = !!textHyphenationLanguage(s.language); hyphens.querySelector<HTMLOptionElement>('[value="auto"]')!.disabled = !supported; explanation.textContent = supported ? '' : t('Automatic hyphenation needs a supported language: en-US, en-GB, fr, de or es.'); });
  for (const [key, label, min, max] of [['minWord', t('Minimum word length'), 2, 100], ['minBefore', t('Letters before hyphen'), 1, 100], ['minAfter', t('Letters after hyphen'), 1, 100], ['consecutive', t('Consecutive hyphenated lines'), 0, 100]] as const)
    number(advanced, label, s => (s.hyphenation ?? hyphenation())[key], value => ({ hyphenation: { ...hyphenation(), [key]: value } }), min, max, '1');
  const refinements=mountParagraphRefinements(advanced,read,write);
  function refresh() { refinements.refresh(); const settings = read(); for (const update of updates) update(settings); }
  styleTextControls(root); refresh(); return { refresh };
}
