// SPDX-License-Identifier: MPL-2.0
/** One range-local bar and one child surface for composed text. */
import type { EmojiPopoverOptions } from '../components/emoji-picker.ts';
import type { ComposedTextEditor } from './text-editor-session.ts';
import { textStyleResolver } from '@lolly/engine';
import { textControlNumber, destroyTextControls, styleTextControls } from './text-control-ui.ts';
import { icon } from './icons.ts';
import { t } from '../i18n.ts';
import { mountTextColor } from './text-color.ts';
import { mountParagraphControls } from './text-paragraph-controls.ts';
import { mountTextCleanup } from './text-cleanup-controls.ts';
import { mountTextStyleControls } from './text-style-controls.ts';
import { mountTextTypographyControls } from './text-typography-controls.ts';
import { mountTextFrameControls } from './text-frame-controls.ts';
interface ControlsOptions {
  fonts: Array<{ value: string; label: string }>;
  family(value: string): string;
  emoji: EmojiPopoverOptions;
  done(): void;
  convert?(anchor:HTMLElement):void;
  adjustType?(anchor:HTMLElement):void;
  focus(active: boolean): void;
  error(error: unknown): void;
}
export function mountTextControls(bar: HTMLElement, editor: ComposedTextEditor, options: ControlsOptions) {
  bar.classList.add('fc-composed-bar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', t('Text formatting'));
  let child: HTMLElement | null = null, focused = false, closeEmoji: (() => void) | undefined;
  let childAnchor: HTMLElement | null = null, childTicket = 0;
  let refreshChild: (() => void) | undefined;
  const abort = new AbortController(), signal = abort.signal;
  const close = (restore = true): boolean => {
    childTicket++; childAnchor = null;
    refreshChild = undefined;
    editor.highlight([]);
    if (!child && !closeEmoji && !colorControl.isOpen()) return false;
    colorControl.close();
    if (child) destroyTextControls(child); child?.remove(); child = null; closeEmoji?.(); closeEmoji = undefined;
    if (restore) editor.select(editor.range); return true;
  };
  const button = (label: string, run: (button: HTMLButtonElement) => void, short = label): HTMLButtonElement => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'fc-cbtn';
    button.textContent = short; button.setAttribute('aria-label', label); button.title = label;
    button.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
    button.addEventListener('click', event => { event.stopPropagation(); run(button); }); bar.append(button); return button;
  };
  const field = (label: string, control: HTMLInputElement | HTMLSelectElement): void => {
    control.setAttribute('aria-label', label); control.title = label;
    control.addEventListener('pointerdown', event => event.stopPropagation()); bar.append(control);
  };
  const fonts = document.createElement('select'); fonts.className = 'fc-composed-font field-select field-select--sm';
  const mixedFont = new Option(t('Mixed'), ''); mixedFont.disabled = true; fonts.add(mixedFont);
  for (const font of options.fonts) fonts.add(new Option(font.label, font.value));
  fonts.addEventListener('change', () => { void editor.font(options.family(fonts.value)).catch(options.error); }); field(t('Font'), fonts);
  const sizeHost = document.createElement('div'); sizeHost.className = 'fc-composed-size'; bar.append(sizeHost);
  const sizeField = textControlNumber(sizeHost, t('Font size'), { value: editor.character().size ?? 16, min: 1, max: 1000, step: 1, precision: 1, onCommit: size => editor.format({ size }, t('Font size')) });
  sizeField.el.addEventListener('pointerdown', event => event.stopPropagation());
  sizeHost.replaceChildren(sizeField.el);
  const bold = button(t('Bold'), () => {
    const current = editor.character(), family = editor.document.fonts.find(font => font.id === current.font)?.family;
    if (family) void editor.font(family, (current.weight ?? 400) >= 600 ? 400 : 700).catch(options.error);
  }, 'B');
  const italic = button(t('Italic'), () => {
    const current = editor.character(), family = editor.document.fonts.find(font => font.id === current.font)?.family;
    if (family) void editor.font(family, current.weight, !current.italic).catch(options.error);
  }, 'I');
  const underline = button(t('Underline'), () => editor.format({ underline: !editor.character().underline }, t('Underline')), 'U');
  const color = document.createElement('div'); color.className = 'fc-composed-color'; bar.append(color);
  const colorControl = mountTextColor(color, editor.character().color ?? '#000000', value => editor.format({ color: value }, t('Text colour')), () => close(false));
  button(t('Insert emoji'), anchor => {
    close(false); const selected = editor.range, ticket = childTicket;
    void import('../components/emoji-picker.ts').then(async module => {
      if (!bar.isConnected || ticket !== childTicket) return;
      closeEmoji = module.closeEmojiPopover;
      child = await module.openEmojiPopover(anchor, source => { child = null; closeEmoji = undefined; editor.insert({ source }, selected, t('Insert emoji')); editor.input.focus(); }, options.emoji);
      if (ticket !== childTicket) { child?.remove(); child = null; }
    }).catch(options.error);
  }, t('Emoji')).innerHTML = icon('smile',{size:18});
  button(t('More character settings'),anchor=>{
    if(child?.hasAttribute('data-text-character')){close();return;}close(false);childAnchor=anchor;
    child=document.createElement('div');child.className='fc-text-popover';child.dataset.textCharacter='';child.setAttribute('role','dialog');child.setAttribute('aria-label',t('Character typography'));
    document.body.append(child);
    const typography=mountTextTypographyControls(child,{read:()=>editor.character(),write:(value,label)=>editor.format(value,label),info:()=>editor.fontInfo(),preview:value=>editor.previewTypography(value),error:options.error});refreshChild=typography.refresh;
    if(options.adjustType){const adjust=document.createElement('button');adjust.type='button';adjust.textContent=t('Adjust type');adjust.disabled=editor.range.start===editor.range.end;adjust.addEventListener('click',()=>{close(false);options.adjustType!(anchor);});child.append(adjust);}
    if(options.convert){const convert=document.createElement('button');convert.type='button';convert.textContent=t('Convert selection to paths');convert.addEventListener('click',()=>{close(false);options.convert!(anchor);});child.append(convert);}
    const focus=document.createElement('button');focus.type='button';focus.textContent=t('Focus text');focus.setAttribute('aria-pressed',String(focused));focus.addEventListener('click',()=>{focused=!focused;options.focus(focused);focus.setAttribute('aria-pressed',String(focused));});child.append(focus);
    child.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});positionChild(anchor);
  },t('Type'));
  button(t('Paragraph'), anchor => {
    if (child?.hasAttribute('data-text-paragraph')) { close(); return; }
    close(false);
    childAnchor = anchor;
    child = document.createElement('div'); child.className = 'fc-text-popover'; child.dataset.textParagraph = '';
    child.setAttribute('role', 'dialog'); child.setAttribute('aria-label', t('Paragraph'));
    child.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } });
    const caption = document.createElement('p'); caption.textContent = t('Selected paragraphs'); child.append(caption);
    const hiddenLabel=document.createElement('label'),hidden=document.createElement('input');hidden.type='checkbox';hidden.checked=editor.input.hasAttribute('data-show-hidden');hidden.addEventListener('change',()=>editor.input.toggleAttribute('data-show-hidden',hidden.checked));hiddenLabel.append(document.createTextNode(t('Show hidden characters')),hidden);child.append(hiddenLabel);
    const paragraphs = mountParagraphControls(child, () => {
      const paragraph = editor.story.paragraphs.find(item => item.start <= editor.range.start && item.end >= editor.range.start) ?? editor.story.paragraphs.at(-1)!;
      return textStyleResolver(editor.document).paragraph(editor.story, paragraph);
    }, (value, label) => editor.paragraph(value, label));
    const together = document.createElement('label'), togetherInput = document.createElement('input'); togetherInput.type = 'checkbox'; togetherInput.className = 'field-check'; togetherInput.disabled = editor.range.start === editor.range.end;
    togetherInput.checked = editor.story.spans.some(span => span.noBreak && span.start <= editor.range.start && span.end >= editor.range.end);
    togetherInput.addEventListener('change', () => editor.span({ noBreak: togetherInput.checked }, t('Keep selection together')));
    together.append(togetherInput, document.createTextNode(t('Keep selection together'))); child.append(together);
    const literal = document.createElement('label'), literalInput = document.createElement('input'); literalInput.type = 'checkbox'; literalInput.className = 'field-check'; literalInput.disabled = editor.range.start === editor.range.end;
    literalInput.checked = editor.story.spans.some(span => span.literal && span.start <= editor.range.start && span.end >= editor.range.end);
    literalInput.addEventListener('change', () => editor.span({ literal: literalInput.checked }, t('Literal text')));
    literal.append(literalInput, document.createTextNode(t('Literal text'))); child.append(literal);
    const styles = mountTextStyleControls(child, () => {
      const paragraph = editor.story.paragraphs.find(item => item.start <= editor.range.start && item.end >= editor.range.start)!;
      const span = editor.story.spans.find(item => item.start <= editor.range.start && item.end > editor.range.start);
      return { styles: editor.document.styles, paragraph: paragraph.style??editor.story.defaultStyle, character: span?.style, characterFormat:editor.character(),paragraphFormat:textStyleResolver(editor.document).paragraph(editor.story,paragraph),
        paragraphOverrides: !!paragraph.paragraph && Object.keys(paragraph.paragraph).length > 0,
        characterOverrides: editor.story.spans.some(item => item.end > editor.range.start && item.start <= editor.range.end && !!item.character) };
    }, (command, label) => editor.style(command, label),definition=>editor.defineStyle(definition));
    mountTextCleanup(child, editor, options.error);
    const frameDetails = document.createElement('details'), frameSummary = document.createElement('summary'); frameSummary.textContent = t('Frame options'); frameDetails.append(frameSummary); child.append(frameDetails);
    const frames = mountTextFrameControls(frameDetails,()=>editor.frame,()=>editor.story.frameIds.length>1,value=>editor.setFrame(value),()=>editor.layout?.frames.find(frame=>frame.id===editor.frame.id)?.appliedScale??1);
    const diagnostics = document.createElement('div'); diagnostics.setAttribute('aria-label',t('Text layout findings')); child.append(diagnostics);
    const updateDiagnostics = () => {
      const notices = editor.layout?.diagnostics ?? [];
      if (diagnostics.dataset.notices === JSON.stringify(notices)) return; diagnostics.dataset.notices = JSON.stringify(notices); diagnostics.replaceChildren();
      for (const notice of notices) { const button = document.createElement('button'); button.type = 'button'; button.textContent = notice.message; button.addEventListener('click',()=>editor.select(notice)); diagnostics.append(button); }
    };
    refreshChild = () => { paragraphs.refresh(); styles.refresh(); frames.refresh(); updateDiagnostics(); }; updateDiagnostics();
    const done = document.createElement('button'); done.type = 'button'; done.textContent = t('Done'); done.addEventListener('click', () => close()); child.append(done);
    document.body.append(child); positionChild(anchor); child.querySelector('select')?.focus();
  });
  button(t('Done'), options.done).classList.add('fc-composed-done');
  const status = document.createElement('span'); status.className = 'fc-composed-status'; status.setAttribute('role', 'status'); bar.append(status);
  function positionChild(anchor: HTMLElement): void {
    if (!child) return;
    styleTextControls(child);
    const rect = anchor.getBoundingClientRect(), view = window.visualViewport;
    const left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0, width = view?.width ?? innerWidth, height = view?.height ?? innerHeight;
    child.style.maxHeight = `${Math.max(120, height - 100)}px`;
    child.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - child.offsetWidth - 8))}px`;
    child.style.top = `${Math.max(top + 8, Math.min(rect.bottom + 8, top + height - child.offsetHeight - 70))}px`;
  }
  document.addEventListener('pointerdown', event => { if (child && !child.contains(event.target as Node) && !bar.contains(event.target as Node)) close(false); }, { signal });
  bar.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }, { signal });
  const reposition = () => { if (childAnchor) positionChild(childAnchor); };
  window.addEventListener('resize', reposition, { signal });
  window.visualViewport?.addEventListener('resize', reposition, { signal });
  window.visualViewport?.addEventListener('scroll', reposition, { signal });
  return {
    close,
    owns(node: Node | null) { return !!node && (bar.contains(node) || !!child?.contains(node)); },
    refresh() {
      refreshChild?.();
      const character = editor.character(), mixed = editor.mixed(), family = editor.document.fonts.find(font => font.id === character.font)?.family;
      sizeField.set(mixed.has('size') ? 'mixed' : character.size ?? 16);
      colorControl.update(character.color ?? '#000000', mixed.has('color'));
      if (family && document.activeElement !== fonts) { if (![...fonts.options].some(option => option.value === family)) fonts.add(new Option(family, family)); fonts.value = family; }
      if (mixed.has('font') && document.activeElement !== fonts) fonts.value = '';
      bold.setAttribute('aria-pressed', mixed.has('weight') ? 'mixed' : String((character.weight ?? 400) >= 600)); italic.setAttribute('aria-pressed', mixed.has('italic') ? 'mixed' : String(!!character.italic));
      underline.setAttribute('aria-pressed', mixed.has('underline') ? 'mixed' : String(!!character.underline));

      status.textContent = editor.error || (editor.pending ? t('Laying out text…') : editor.layout?.overset ? t('Text continues beyond this frame.') : editor.range.start === editor.range.end ? t('At caret') : t('Selected text'));
    },
    destroy() { abort.abort(); close(false); destroyTextControls(bar); options.focus(false); },
  };
}
