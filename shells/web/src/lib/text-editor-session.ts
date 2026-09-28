// SPDX-License-Identifier: MPL-2.0
/** Native editing and authored commands share the same source and settled layout. */
import type { AssetsAPI, TextAPI } from '@lolly-tools/core/host-v1';
import type { TextCharacterV1, TextDocumentV1, TextFrameV1, TextLayoutRequestV1, TextLayoutV1, TextParagraphStyleV1, TextRangeV1, TextStoryV1, TextSpanV1, TextNamedStyleV1 } from '@lolly-tools/core';
import { formatStoryParagraphs, formatStoryRange, replaceStoryRange, storyParagraphIds, textStyleResolver, snapTextRange, importTextFragment, parseTextDocument, applyTextCleanup, styleTextRange, defineTextStyle, nextParagraphStyle } from '@lolly/engine';
import type { TextInsertion, TextSpanPatch, TextCleanupPreview, TextStyleCommand } from '@lolly/engine';
import { mountNativeText, nativeTextChange } from './text-native.ts';
import { acquireEditorFonts, nativeFontFamily, pinEditorFont } from './text-editor-fonts.ts';
import { copyTextFragment, pastedTextHtml, TEXT_CLIPBOARD_MIME } from './text-clipboard.ts';
import { textTypographyPreview } from './text-typography-preview.ts';
import { t } from '../i18n.ts';
import { hitNativeTextStop } from './text-native-hit.ts';
import { rebaseTextEdit } from './text-edit-rebase.ts';
import { patchComposedText } from './text-edit-paint.ts';
export interface TextEditorSnapshot { document: TextDocumentV1; frames: TextFrameV1[] }
export interface TextEditorOptions {
  frameId: string;
  read(): TextEditorSnapshot;
  write(value: TextEditorSnapshot, label: string, typingGroup?: string): Promise<void>;
  layout(request: TextLayoutRequestV1): Promise<TextLayoutV1>;
  text?: TextAPI;
  assets?: Pick<AssetsAPI, 'get' | 'bytes'>;
  history(redo: boolean): void;
  changed?(): void;
  error(error: unknown): void;
  recover?(value: TextEditorSnapshot): void;
  removed?(): void;
  composition?(active: boolean): void;
  frameElement?(id: string): HTMLElement | null;
  nativeRoot?: HTMLElement;
}
export function mountTextEditor(element: HTMLElement, options: TextEditorOptions) {
  let current = options.read(), frame = current.frames.find(item => item.id === options.frameId)!;
  let persisted = current;
  if (!frame) throw new Error('The selected text frame is missing.');
  const storyId = frame.storyId, initial = structuredClone(current.document.stories.find(item => item.id === storyId)!);
  const editedDefinitions=new Map<string,{before:TextNamedStyleV1|undefined;after:TextNamedStyleV1}>();
  const initialFrames = structuredClone(current.frames.filter(item=>item.storyId===storyId));
  let story = initial, range: TextRangeV1 = { start: story.source.length, end: story.source.length }, typing: Omit<TextSpanV1,'start'|'end'> | undefined;
  let layout: TextLayoutV1 | null = null, generation = 0, disposed = false, pendingSelection: TextRangeV1 | null = null;
  let drawing:Promise<void>=Promise.resolve();const pending=new Set<Promise<unknown>>();
  function track<T>(promise:Promise<T>):Promise<T>{pending.add(promise);void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;}
  let externalStoryChange = false;
  const localVersions = new Set<string>(); let localVersionBytes = 0;
  function editVersion(value: TextEditorSnapshot): string {
    return JSON.stringify([value.document.stories.find(item => item.id === storyId), value.frames.filter(item => item.storyId === storyId).map(item => ({ ...item, height: item.mode === 'auto-height' || item.mode === 'auto-width' ? 0 : item.height, width: item.mode === 'auto-width' ? 0 : item.width }))]);
  }
  function rememberLocal(): void {
    const key = editVersion(current); if (localVersions.has(key)) return;
    localVersions.add(key); localVersionBytes += key.length * 2;
    while (localVersions.size > 128 || localVersionBytes > 8 * 1024 * 1024) { const first = localVersions.values().next().value!; localVersions.delete(first); localVersionBytes -= first.length * 2; }
  }
  rememberLocal();
  function persist(label: string, typingGroup?: string): Promise<void> {
    const live = options.read();
    try { current = rebaseTextEdit(persisted, current, live); }
    catch (error) {
      options.recover?.(current); externalStoryChange = true;
      if (!live.document.stories.some(item => item.id === storyId) || !live.frames.some(item => item.id === options.frameId)) { options.removed?.(); return Promise.reject(error); }
      current = live; persisted = live; story = sourceStory();
      return Promise.reject(error);
    }
    persisted = current; story = sourceStory(); rememberLocal();
    const attempted = current;
    return options.write(current, label, typingGroup).catch(error => {
      if (current === attempted) { current = options.read(); persisted = current; story = sourceStory(); void scheduleDraw(); }
      throw error;
    });
  }
  let layoutError = '', releaseFonts: (() => void) | undefined;
  const typingFonts = new Map<string, TextDocumentV1['fonts'][number]>();
  const originalStyle = element.style.cssText, ink = document.createElement('div'), input = document.createElement('div');
  ink.className = 'fc-composed-ink'; ink.setAttribute('aria-hidden', 'true'); ink.innerHTML = element.innerHTML;
  input.dataset.nativeTextEditor = storyId; input.setAttribute('data-export-hide', ''); input.setAttribute('aria-label', t('Edit text'));
  element.replaceChildren(ink);
  element.dataset.nativeTextAnchor = storyId;
  (options.nativeRoot ?? element).append(input);
  Object.assign(element.style, { display: 'block', padding: '0', lineHeight: 'normal', textAlign: 'start', overflow: 'visible' });
  Object.assign(ink.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  Object.assign(input.style, { width: '100%', minHeight: '100%', zIndex: '1' });
  let projectionKey = '';
  function reposition(repaint = true): void {
    if (!options.nativeRoot) return;
    const matrix = ink.querySelector('svg')?.getScreenCTM(); if (!matrix) return;
    const root = options.nativeRoot.getBoundingClientRect();
    Object.assign(input.style,{position:'absolute',left:'0',top:'0',transformOrigin:'0 0',pointerEvents:'auto',transform:`matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e-root.x},${matrix.f-root.y})`});
    if (!layout) return;
    const key = JSON.stringify(layout.frames.map(frame=>{
      const target = frame.id===options.frameId?matrix:options.frameElement?.(frame.id)?.querySelector('svg')?.getScreenCTM();
      if (!target) return [frame.id,null]; const pose=matrix.inverse().multiply(target);
      return [frame.id,...[pose.a,pose.b,pose.c,pose.d,pose.e,pose.f].map(value=>Math.round(value*1000000)/1000000)];
    }));
    if (key!==projectionKey && !surface.composing) {projectionKey=key;if(repaint)surface.update(layout);}
  }
  const sourceStory = () => current.document.stories.find(item => item.id === storyId)!;
  let snappedSource = '', snappedStart = -1, snappedEnd = -1, snappedRange: TextRangeV1 = { start: 0, end: 0 };
  function logicalRange(): TextRangeV1 {
    if (story.source !== snappedSource || range.start !== snappedStart || range.end !== snappedEnd) {
      snappedSource = story.source; snappedStart = range.start; snappedEnd = range.end; snappedRange = snapTextRange(story.source, range);
    }
    return { ...snappedRange };
  }
  function character(): TextCharacterV1 {
    const position=Math.min(range.start,story.source.length);
    const paragraph = story.paragraphs.findLast(item => item.start <= position && item.end >= position) ?? story.paragraphs.at(-1)!;
    const at=range.start===range.end?Math.max(paragraph.start,position-1):position;
    const resolver=textStyleResolver(current.document);
    return { ...resolver.character(story, paragraph, at), ...(range.start === range.end && typing?.style ? resolver.named(typing.style).character : {}), ...(range.start === range.end ? typing?.character : {}) };
  }
  function mixed(): Set<keyof TextCharacterV1> {
    const result = new Set<keyof TextCharacterV1>();
    if (range.start === range.end) return result;
    const resolver = textStyleResolver(current.document), first = character();
    const points = new Set([range.start, ...story.spans.flatMap(span => [span.start, span.end]), ...story.paragraphs.map(paragraph => paragraph.start)]);
    for (const at of points) if (at >= range.start && at < range.end) {
      const paragraph = story.paragraphs.find(item => item.start <= at && item.end >= at) ?? story.paragraphs.at(-1)!;
      const value = resolver.character(story, paragraph, at);
      for (const key of new Set([...Object.keys(first), ...Object.keys(value)]) as Set<keyof TextCharacterV1>) if (JSON.stringify(first[key]) !== JSON.stringify(value[key])) result.add(key);
    }
    return result;
  }
  async function draw(): Promise<void> {
    const ticket = ++generation, snapshot = current;
    layoutError = ''; input.setAttribute('aria-busy', 'true'); element.dataset.textPending = 'true'; options.changed?.();
    try {
      const next = await options.layout({ document: snapshot.document, storyId, frames: snapshot.frames.filter(item => item.storyId === storyId), includeSvg: true });
      const release = await acquireEditorFonts(snapshot.document.fonts.filter(font => next.resources.some(resource => resource.id === font.id)), options.assets);
      if (disposed || ticket !== generation || surface.composing) { release(); return; }
      releaseFonts?.(); releaseFonts = release;
      layout = next; patchComposedText(ink, next.frames.find(item => item.id === options.frameId)?.svg ?? '');
      for (const frame of next.frames) if (frame.id !== options.frameId && frame.svg) {
        const target = options.frameElement?.(frame.id); if (target) patchComposedText(target, frame.svg);
      }
      const result = next.frames.find(item => item.id === options.frameId);
      if (result) { input.style.width = `${result.width}px`; input.style.minHeight = `${result.height}px`; }
      reposition(false);
      surface.update(next);
      if (pendingSelection) {
        range = pendingSelection; pendingSelection = null;
        // Layout can finish after focus has moved to a formatting control.
        if (input.contains(input.ownerDocument.activeElement)) surface.select(range.start, range.end);
      }
      input.contentEditable = 'true'; input.removeAttribute('aria-busy'); delete element.dataset.textPending; options.changed?.();
    } catch (error) { if (!disposed && ticket === generation) { input.removeAttribute('aria-busy'); element.dataset.textPending = 'error'; layoutError = error instanceof Error ? error.message : String(error); options.error(error); options.changed?.(); } }
  }
  function scheduleDraw(){if(disposed)return Promise.resolve();drawing=draw();return drawing;}
  function write(next: TextStoryV1, label: string, typingGroup?: string): void {
    const document = parseTextDocument({ ...current.document, fonts: [...new Map([...current.document.fonts, ...typingFonts.values()].map(font => [font.id, font])).values()], stories: current.document.stories.map(item => item.id === storyId ? next : item) });
    story = next; current = { ...current, document };
    rememberLocal();
    void track(persist(label, typingGroup)).catch(error => {
      options.error(error);
      if (!disposed && story.revision === next.revision) { current = options.read(); story = sourceStory(); pendingSelection = null; void scheduleDraw(); }
    }); void scheduleDraw();
  }
  function insert(insertion: TextInsertion, selected = logicalRange(), kind = 'Insert text'): void {
    const next = replaceStoryRange(story, selected, insertion, { paragraphId: () => `p-${crypto.randomUUID()}`, ...(typing ? { typing } : {}) });
    if(kind==='insertParagraph'){const styled=nextParagraphStyle(current.document,story,next.story,selected.start);if(styled!==next.story)typing={};next.story=styled;}
    range = next.selection; pendingSelection = range;
    write(next.story, kind, kind === 'insertText' || kind.startsWith('deleteContent') ? `text:${storyId}` : undefined);
  }
  function refresh(): void {
    if (disposed) return;
    const next = options.read();
    const nextStory = next.document.stories.find(item => item.id === storyId), nextFrame = next.frames.find(item => item.id === options.frameId);
    if (!nextStory || !nextFrame || nextFrame.hidden || nextFrame.locked) { options.removed?.(); return; }
    if (surface.composing || JSON.stringify(next) === JSON.stringify(current)) return;
    // Undo can restore any retained local version. Unknown versions stay protected.
    if (!localVersions.has(editVersion(next))) externalStoryChange = true;
    current = next; persisted = next; story = nextStory; frame = nextFrame;
    range = { start: Math.min(range.start, story.source.length), end: Math.min(range.end, story.source.length) }; void scheduleDraw();
  }
  const surface = mountNativeText(input, {
    source: () => story.source, revision: () => story.revision, family: run => nativeFontFamily(run.font),
    clientPoint(x,y){const matrix=ink.querySelector('svg')?.getScreenCTM();return matrix?new DOMPoint(x,y).matrixTransform(matrix.inverse()):{x,y};},
    project(id) {
      if (id === options.frameId) return;
      const element=options.frameElement?.(id);if(options.frameElement && !element?.getClientRects().length)return null;
      const base = ink.querySelector('svg')?.getScreenCTM(), target = element?.querySelector('svg')?.getScreenCTM();
      return base && target ? base.inverse().multiply(target) : undefined;
    },
    edit: (selected, source, kind) => insert({ source }, selected, kind), history: redo => { options.history(redo); refresh(); }, error: options.error,
    copy: (data, selected) => copyTextFragment(data, current.document, story, selected),
    paste(data, selected, plain) {
      const own = !plain && data.getData(TEXT_CLIPBOARD_MIME), html = !plain && data.getData('text/html');
      if (own || html) {
        const imported = importTextFragment(current.document, own || pastedTextHtml(html as string, character(), current.document, markup => new DOMParser().parseFromString(markup, 'text/html')), () => `inline-${crypto.randomUUID()}`);
        current = { ...current, document: imported.document }; insert(imported.insertion, selected, t('Paste text'));
      } else insert({ source: data.getData('text/plain') }, selected, t('Paste text'));
    },
    selection(value) {
      if (!input.contains(input.ownerDocument.activeElement)) return;
      const next = { start: Math.min(value.anchor, value.focus), end: Math.max(value.anchor, value.focus) };
      if (next.start !== range.start || next.end !== range.end) typing = undefined;
      range = next; options.changed?.();
    },
    composition(selected, active) {
      options.composition?.(active);
      for (const path of ink.querySelectorAll<SVGElement>('[data-text-start]')) {
        const a = Number(path.dataset.textStart), b = Number(path.dataset.textEnd ?? a + 1);
        if (a <= selected.end && b >= selected.start) path.style.visibility = active ? 'hidden' : '';
      }
    },
  });
  input.addEventListener('focus', () => { const selected = logicalRange(); surface.select(selected.start, selected.end); });
  input.addEventListener('compositionend', () => queueMicrotask(() => { if (!disposed) void scheduleDraw(); }));
  input.contentEditable = 'false';
  const ready = scheduleDraw();
  return {
    input, ready, surface, reposition,
    recoverDraft() {
      const change = nativeTextChange(story.source, input.textContent ?? story.source);
      const draft = change ? replaceStoryRange(story, change.range, { source: change.text }, { paragraphId: () => `p-${crypto.randomUUID()}` }).story : story;
      options.recover?.({ ...current, document: { ...current.document, stories: current.document.stories.map(item => item.id === storyId ? draft : item) } });
    },
    async settle(){for(let attempt=0;attempt<64;attempt++){const started=generation,work=drawing;await Promise.all([work,...pending]);if(layoutError)throw new Error(layoutError);if(surface.composing)throw new Error('Finish the current text composition before leaving text edit.');if(started===generation&&work===drawing&&!pending.size)return;}throw new Error('Text is still changing. Wait for layout before finishing.');},
    async fontInfo(){const font=current.document.fonts.find(font=>font.id===character().font);if(!font||!options.text?.fontInfo)throw new Error('Font metadata is unavailable.');return options.text.fontInfo(font);},
    previewTypography(patch:TextCharacterV1){return textTypographyPreview(current.document,story,logicalRange(),{...character(),...patch},options.layout);},
    get document() { return current.document; }, get story() { return story; }, get frame() { return frame; }, get layout() { return layout; },
    get range() { return logicalRange(); }, get pending() { return element.dataset.textPending === 'true'; }, get error() { return layoutError; }, character, mixed,
    select(selected: TextRangeV1) { range = selected; input.focus(); surface.select(selected.start, selected.end); },
    selectAt(x: number, y: number) {
      const matrix = ink.querySelector('svg')?.getScreenCTM();
      if (!layout || !matrix) return;
      const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
      const stops=layout.lines.flatMap((line,index)=>line.frameId===frame.id?line.carets.map(caret=>({...caret,line:index})):[]);
      const stop=hitNativeTextStop(stops,point);
      if(stop){range={start:stop.offset,end:stop.offset};input.focus();surface.select(stop.offset,stop.offset,stop);}
    },
    insert,
    format(patch: TextCharacterV1, label: string) {
      if (range.start === range.end) { typing = { ...typing, character: { ...typing?.character, ...patch } }; options.changed?.(); }
      else { pendingSelection = logicalRange(); write(formatStoryRange(story, logicalRange(), { character: patch }), label); }
    },
    span(patch: TextSpanPatch, label: string) { if (range.start !== range.end) { pendingSelection = logicalRange(); write(formatStoryRange(story, logicalRange(), patch), label); } },
    style(command: TextStyleCommand, label: string) {
      pendingSelection = logicalRange();
      if (command.kind === 'character' && range.start === range.end) {
        typing = { ...typing }; if(command.style===null)delete typing.style;else if(command.style!==undefined)typing.style=command.style;if(command.reset)delete typing.character;options.changed?.();
      } else write(styleTextRange(current.document, story, logicalRange(), command), label);
    },
    defineStyle(definition:TextNamedStyleV1){
      const before=current,document=defineTextStyle(current.document,definition);
      editedDefinitions.set(definition.id,{before:editedDefinitions.has(definition.id)?editedDefinitions.get(definition.id)!.before:structuredClone(current.document.styles.find(style=>style.id===definition.id)),after:structuredClone(definition)});
      current={...current,document};story=sourceStory();pendingSelection=logicalRange();
      void track(persist(t('Update text style'))).catch(error=>{options.error(error);if(current.document===document){current=before;story=sourceStory();void scheduleDraw();}});void scheduleDraw();
    },
    highlight(ranges: TextRangeV1[]) {
      for (const span of input.querySelectorAll<HTMLElement>('[data-text-start]')) span.toggleAttribute('data-text-cleanup', ranges.some(range => range.start < Number(span.dataset.textEnd) && range.end > Number(span.dataset.textStart)));
    },
    cleanup(preview: TextCleanupPreview) {
      const next = applyTextCleanup(story, preview);
      const mapped = (at: number) => {
        let delta = 0;
        for (const edit of preview.edits) { if (at < edit.start) break; if (at < edit.end) return edit.start + delta + edit.after.length; delta += edit.after.length - (edit.end-edit.start); }
        return at+delta;
      };
      range = snapTextRange(next.source, { start: mapped(range.start), end: mapped(range.end) }); pendingSelection = range;
      write(next, t('Typography cleanup'));
    },
    paragraph(patch: TextParagraphStyleV1, label: string) {
      pendingSelection = logicalRange(); write(formatStoryParagraphs(story, storyParagraphIds(story, logicalRange()), patch), label);
    },
    async font(family: string, weight = character().weight ?? 400, italic = character().italic ?? false) {
      const revision = story.revision, selected = logicalRange();
      const before = generation; element.dataset.textPending = 'true'; options.changed?.();
      try {
        const pinned = await track(pinEditorFont({ fontFamily: family, fontWeight: String(weight), fontStyle: italic ? 'italic' : 'normal' }, story.source.slice(selected.start, selected.end) || story.source));
        if (disposed || revision !== story.revision) throw new Error('The text changed while its font loaded. Choose the font again.');
        for (const font of pinned.fonts) typingFonts.set(font.id, font);
        const fonts = new Map([...current.document.fonts, ...pinned.fonts].map(font => [font.id, font]));
        current = { ...current, document: { ...current.document, fonts: [...fonts.values()] } };
        if (selected.start === selected.end) typing = { ...typing, character: { ...typing?.character, ...pinned.character } };
        else { pendingSelection = selected; write(formatStoryRange(story, selected, { character: pinned.character }), t('Font')); }
      } finally { if (generation === before) delete element.dataset.textPending; options.changed?.(); }
    },
    setFrame(patch: Partial<TextFrameV1>) {
      frame = { ...frame, ...patch }; current = { ...current, frames: current.frames.map(item => item.id === frame.id ? frame : item) };
      rememberLocal();
      const attempted = current;
      void track(persist(t('Text frame'))).catch(error => {
        options.error(error);
        if (!disposed && current === attempted) { current = options.read(); story = sourceStory(); frame = current.frames.find(item => item.id === options.frameId)!; void scheduleDraw(); }
      }); void scheduleDraw();
    },
    refresh,
    cancel() {
      if(externalStoryChange)throw new Error('This story changed outside the text edit. Finish editing and use Undo to reverse only your own changes.');
      const referencedElsewhere=(id:string)=>current.document.stories.some(item=>item.id!==storyId&&(item.defaultStyle===id||item.paragraphs.some(paragraph=>paragraph.style===id)||item.spans.some(span=>span.style===id)))||current.document.styles.some(style=>style.id!==id&&!editedDefinitions.has(style.id)&&(style.basedOn===id||style.next===id));
      const styles=current.document.styles.flatMap(style=>{const edit=editedDefinitions.get(style.id);return edit&&JSON.stringify(style)===JSON.stringify(edit.after)?edit.before?[structuredClone(edit.before)]:referencedElsewhere(style.id)?[style]:[]:[style];});
      current={...current,document:{...current.document,styles}};
      current={...current,frames:current.frames.map(item=>initialFrames.find(original=>original.id===item.id)??item)};frame=current.frames.find(item=>item.id===options.frameId)!;
      write({ ...structuredClone(initial), revision: story.revision + 1 }, t('Cancel text edit'));
    },
    destroy() {
      disposed = true; generation++; releaseFonts?.(); surface.destroy(); element.style.cssText = originalStyle;
      input.remove(); element.innerHTML = layout?.frames.find(item => item.id === options.frameId)?.svg ?? ink.innerHTML; delete element.dataset.textPending; delete element.dataset.nativeTextAnchor;
    },
  };
}
export type ComposedTextEditor = ReturnType<typeof mountTextEditor>;
