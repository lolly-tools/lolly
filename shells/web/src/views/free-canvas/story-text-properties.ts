// SPDX-License-Identifier: MPL-2.0
/** Inspector commands share the active range and the canvas transaction history. */
import { formatStoryRange, formatStoryParagraphs, textStyleResolver, styleTextRange, defineTextStyle } from '@lolly/engine';
import type { TextCharacterV1 } from '@lolly-tools/core';
import type { TextPropertyCommand, TextPropertyPort, TextPropertyState } from '../design-ports.ts';
import { bindParagraphToken, paragraphTokenState } from '../../../../../engine/src/text-token-bindings.ts';
import { textTypographyPreview } from '../../lib/text-typography-preview.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { pinEditorFont } from '../../lib/text-editor-fonts.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';
export function read(fc: FcCtx, ids: string[]): TextPropertyState | null {
  if (!ids.length || !fc.storyText.available()) return null;
  const snapshot = fc.storyText.read(), frames = ids.map(id => snapshot.frames.find(frame => frame.id === id));
  if (frames.some(frame => !frame)) return null;
  const storyIds = [...new Set(frames.map(frame => frame!.storyId))], active = ids.length === 1 && fc.editing?.id === ids[0] ? fc.editing?.composed?.editor : undefined;
  const stories = storyIds.map(id => snapshot.document.stories.find(story => story.id === id)!);
  const resolver = textStyleResolver(snapshot.document), story = stories[0]!;
  const paragraph = story.paragraphs.find(paragraph => paragraph.start <= (active?.range.start ?? 0) && paragraph.end >= (active?.range.start ?? 0)) ?? story.paragraphs[0]!;
  const character = active?.character() ?? resolver.character(story, paragraph, 0), mixed = active?.mixed() ?? new Set<keyof TextCharacterV1>();
  if (!active) for (const item of stories) for (const paragraph of item.paragraphs) {
    for (const at of new Set([paragraph.start, ...item.spans.flatMap(span => [span.start, span.end]).filter(at => at >= paragraph.start && at <= paragraph.end)])) {
      const value = resolver.character(item, paragraph, at);
      for (const key of new Set([...Object.keys(value), ...Object.keys(character)]) as Set<keyof TextCharacterV1>) if (JSON.stringify(value[key]) !== JSON.stringify(character[key])) mixed.add(key);
    }
  }
  const selectedSpan = story.spans.find(span => span.start <= (active?.range.start ?? 0) && span.end > (active?.range.start ?? 0));
  const styles = { styles: snapshot.document.styles, paragraph: paragraph.style??story.defaultStyle, character: selectedSpan?.style,characterFormat:character,paragraphFormat:resolver.paragraph(story,paragraph),
    paragraphOverrides: !!paragraph.paragraph && Object.keys(paragraph.paragraph).length > 0,
    characterOverrides: stories.some(item => item.spans.some(span => !!span.character && (!active || span.end > active.range.start && span.start <= active.range.end))) };
  const tokenState = paragraphTokenState(snapshot.document, stories, active?.range);
  return { paragraphTokenSelection: tokenState.selection, paragraphTokenActive: tokenState.active, paragraphTokenMixed: tokenState.mixed, paragraphTokenRestores: tokenState.restoreRefs, scope: active ? active.range.start === active.range.end ? 'caret' : 'range' : 'story', storyIds, character, mixed: [...mixed], paragraph: tokenState.paragraph, frame: frames[0]!, styles, appliedScale:active ? active.layout?.frames.find(frame=>frame.id===ids[0])?.appliedScale??1 : frames[0]!.shrink ? fc.storyText.peek({document:snapshot.document,storyId:story.id,frames:snapshot.frames.filter(frame=>frame.storyId===story.id)})?.layout.frames.find(frame=>frame.id===ids[0])?.appliedScale??1 : 1, linked:stories.some(story=>story.frameIds.length>1), family: snapshot.document.fonts.find(font => font.id === character.font)?.family ?? '' };
}
function family(fc: FcCtx, value: string): string {
  const probe = document.createElement('span'); probe.style.fontFamily = fc.helpers.fontStackFor(value); fc.canvasEl.append(probe);
  const result = getComputedStyle(probe).fontFamily; probe.remove(); return result;
}
export async function apply(fc: FcCtx, ids: string[], command: TextPropertyCommand, label: string): Promise<void> {
  try {
    const state = read(fc, ids); if (!state) return;
    const active = ids.length === 1 && fc.editing?.id === ids[0] ? fc.editing?.composed?.editor : undefined;
    if (active) {
      if (command.kind === 'paragraph-token') active.paragraphToken(command.field, command.value);
      else if (command.kind === 'character') active.format(command.value, label);
      else if (command.kind === 'paragraph') active.paragraph(command.value, label);
      else if (command.kind === 'frame') active.setFrame(command.value);
      else if (command.kind === 'style-definition') active.defineStyle(command.value);
      else if (command.kind === 'style') active.style(command.value, label);
      else if (command.kind === 'span') active.span(command.value, label);
      else await active.font(family(fc, command.family ?? state.family), command.weight ?? state.character.weight, command.italic ?? state.character.italic);
      return;
    }
    const snapshot = fc.storyText.read(), revision = JSON.stringify(snapshot.document);
    if(command.kind==='style-definition'){snapshot.document=defineTextStyle(snapshot.document,command.value);await fc.storyText.write(snapshot,label);return;}
    let value = command.kind === 'character' ? command.value : undefined;
    if (command.kind === 'font') {
      const pinned = await pinEditorFont({ fontFamily: family(fc, command.family ?? state.family), fontWeight: String(command.weight ?? state.character.weight ?? 400), fontStyle: (command.italic ?? state.character.italic) ? 'italic' : 'normal' }, snapshot.document.stories.filter(story => state.storyIds.includes(story.id)).map(story => story.source).join('\n'));
      if (JSON.stringify(fc.storyText.read().document) !== revision) throw new Error(t('The text changed while its font loaded. Choose the font again.'));
      snapshot.document.fonts = [...new Map([...snapshot.document.fonts, ...pinned.fonts].map(font => [font.id, font])).values()]; value = pinned.character;
    }
    snapshot.document.stories = snapshot.document.stories.map(story => !state.storyIds.includes(story.id) ? story : value
      ? story.source ? formatStoryRange(story, { start: 0, end: story.source.length }, { character: value }) : formatStoryParagraphs(story, story.paragraphs.map(paragraph => paragraph.id), { character: { ...state.character, ...value } })
      : command.kind === 'paragraph-token' ? bindParagraphToken(snapshot.document, story, story.paragraphs.map(p => p.id), command.field, command.value)
      : command.kind === 'paragraph' ? formatStoryParagraphs(story, story.paragraphs.map(paragraph => paragraph.id), command.value)
      : command.kind === 'style' ? styleTextRange(snapshot.document, story, { start: 0, end: story.source.length }, command.value)
      : command.kind === 'span' ? formatStoryRange(story, { start: 0, end: story.source.length }, command.value) : story);
    if (command.kind === 'frame') snapshot.frames = snapshot.frames.map(frame => ids.includes(frame.id) ? { ...frame, ...command.value, id: frame.id, storyId: frame.storyId } : frame);
    await fc.storyText.write(snapshot, label);
  } catch (error) { announce(error instanceof Error ? error.message : String(error)); }
}
export function port(fc: FcCtx): TextPropertyPort {
  return { typography:ids=>({read:()=>read(fc,ids)?.character??{},write:(value,label)=>{void apply(fc,ids,{kind:'character',value},label);},
    async info(){const state=read(fc,ids),snapshot=fc.storyText.read(),font=snapshot.document.fonts.find(font=>font.id===state?.character.font),api=(fc.host as HostV1).text;if(!font||!api?.fontInfo)throw new Error(t('Font metadata is unavailable.'));return api.fontInfo(font);},
    preview(value){const state=read(fc,ids);if(!state)return Promise.reject(new Error(t('Select a text frame.')));const active=ids.length===1&&fc.editing?.id===ids[0]?fc.editing?.composed?.editor:undefined;if(active)return active.previewTypography(value);const snapshot=fc.storyText.read(),story=snapshot.document.stories.find(story=>story.id===state.storyIds[0])!;return textTypographyPreview(snapshot.document,story,{start:0,end:0},{...state.character,...value},request=>fc.storyText.layout(request));},
    error:error=>announce(error instanceof Error?error.message:String(error))}), read: ids => read(fc, ids), apply: (ids, command, label) => { void apply(fc, ids, command, label); }, subscribe(listener) {
    const off = fc.runtime.subscribe(listener); fc.canvasEl.addEventListener('lolly:text-selection-change', listener);
    return () => { off?.(); fc.canvasEl.removeEventListener('lolly:text-selection-change', listener); };
  } };
}
export function storyTextPropertiesOps(fc: FcCtx) { return { read: bindOp(fc, read), apply: bindOp(fc, apply), port: bindOp(fc, port) }; }
