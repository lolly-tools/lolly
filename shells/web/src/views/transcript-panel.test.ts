// SPDX-License-Identifier: MPL-2.0
/**
 * The Transcript panel's place in the ONE right sidebar (views/transcript-panel.ts).
 *
 * The panel has always ASKED for a dock slot on open (lib/edge-dock.ts, id
 * 'transcript'), and when the dock refuses - below the shell's 640px breakpoint - it
 * falls back to a fixed sheet over the work with no way to tuck it away. That fallback
 * is what the header's Dock button is for, so the affordance exists in the surface
 * itself rather than only in the open gesture.
 *
 * The second half is EDIT SCRIPT mode (plans/181 sections 5.4 and 6): the toggle,
 * the typed-text guard, the per-sentence dirty collapse with its boundary
 * widening, the mark restyler and its pointer controls, the chip bar, and the
 * Regenerate round trip through the injected synthesis half. The pure box
 * arithmetic it calls into has its own headless suite (transcript-edit).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/transcript-panel.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { TimeCfg } from './timeline-math.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'Range', 'NodeFilter', 'Text']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.localStorage = dom.window.localStorage;

/** Controllable breakpoint: mobile = true means the dock column does not exist. */
let mobile = false;
(globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
  matches: q.includes('max-width: 640px') ? mobile : !mobile,
  media: q, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});

const ED = await import('../lib/edge-dock.ts');
const TP = await import('./transcript-panel.ts');
const {
  openTranscriptPanel, deriveScript, dirtyLines, lineSeparator, spokenWordCount,
  markSignature, scriptLines, takePendingRefit,
} = TP;
type TranscriptPanelOpts = Parameters<typeof openTranscriptPanel>[0];
type SpeechWordTiming = TranscriptPanelOpts['words'][number];
type Box = ReturnType<TranscriptPanelOpts['getBoxes']>[number];

const CFG = {
  startField: 'start', durField: 'dur', clipInField: 'in', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane', idField: 'id',
} as unknown as TimeCfg;

function open(): { panel: HTMLElement; close: () => void } {
  const api = openTranscriptPanel({
    cfg: CFG,
    words: [],
    assetId: 'a1',
    sourceId: 'b1',
    assetField: 'image',
    getBoxes: () => [],
    write: () => {},
    seek: () => {},
    subscribeTick: () => () => {},
  });
  const panel = document.querySelector<HTMLElement>('.tr-panel')!;
  return { panel, close: () => api.close() };
}

const dockBtn = (panel: HTMLElement): HTMLButtonElement =>
  panel.querySelector<HTMLButtonElement>('.tr-head-tools button[aria-label="Dock to the side"]')!;

test('on desktop the panel opens straight into the sidebar, with no Dock button to press', () => {
  mobile = false;
  const t1 = open();
  try {
    assert.equal(ED.isDocked('transcript'), true);
    assert.ok(t1.panel.closest('.edge-dock-slot'), 'it is in a dock slot, not floating over the work');
    assert.equal(dockBtn(t1.panel).hidden, true, 'the Dock button is only for a panel that is OUT');
  } finally { t1.close(); }
  assert.equal(ED.isDocked('transcript'), false, 'closing gives the slot back');
});

test('when the dock refuses the panel, the header carries the way in', () => {
  mobile = true;                       // below the breakpoint: no column at all
  const t1 = open();
  try {
    assert.equal(ED.isDocked('transcript'), false);
    assert.equal(t1.panel.parentElement, document.body, 'a fixed sheet, as before');
    const btn = dockBtn(t1.panel);
    assert.equal(btn.hidden, false, 'so the Dock control is offered');
    assert.equal(btn.title, 'Dock to the side');
    btn.click();
    assert.equal(ED.isDocked('transcript'), false, 'and it stays honest: there is nowhere to dock yet');
    mobile = false;                    // the window grew past the breakpoint
    btn.click();
    assert.equal(ED.isDocked('transcript'), true, 'now it goes in');
    assert.ok(t1.panel.closest('.edge-dock-slot'));
    assert.equal(btn.hidden, true, 'and the control stands down');
  } finally { t1.close(); mobile = false; }
});

test('the panel shares the sidebar rather than taking it', () => {
  mobile = false;
  const other = document.createElement('div');
  ED.requestDock('inspector', other, { label: 'Inspector' });
  const t1 = open();
  try {
    assert.equal(ED.dockedFullCount(), 2, 'the inspector kept its slot');
    assert.equal(ED.isDocked('inspector'), true);
  } finally {
    t1.close();
    ED.releaseDock('inspector');
    other.remove();
  }
});

// ── Edit script (plans/181 sections 5.4 and 6) ────────────────────────────────

const SCRIPT = 'Hello there.\nThis is a test.';
const WORDS: SpeechWordTiming[] = ['Hello', 'there.', 'This', 'is', 'a', 'test.']
  .map((text, i) => ({ text, start: i, end: i + 0.8 }));
/** The same six words with everything from `from` on moved by `by`. */
const moved = (from: number, by: number): SpeechWordTiming[] =>
  WORDS.map((w, i) => (i >= from ? { ...w, start: w.start + by, end: w.end + by } : { ...w }));

const CLIP = (): Box[] => [
  { id: 'b1', lane: '', start: 0, dur: 6, clipIn: 0, speed: 1, image: { id: 'a1' } } as Box,
];

interface Harness {
  panel: HTMLElement;
  flow: HTMLElement;
  close: () => void;
  boxes: () => Box[];
  writes: () => Box[][];
  captioned: () => SpeechWordTiming[][];
}

function openTts(extra: Partial<TranscriptPanelOpts> = {}): Harness {
  let boxes = CLIP();
  const writes: Box[][] = [];
  const captioned: SpeechWordTiming[][] = [];
  const api = openTranscriptPanel({
    cfg: CFG,
    words: WORDS.map((w) => ({ ...w })),
    assetId: 'a1',
    sourceId: 'b1',
    assetField: 'image',
    getBoxes: () => boxes,
    write: (next) => { boxes = next; writes.push(next); },
    seek: () => {},
    subscribeTick: () => () => {},
    tts: { script: SCRIPT, voice: 'bf_lily', speed: 1, words: WORDS.map((w) => ({ ...w })) },
    reapplySubtitles: (w) => captioned.push([...w]),
    ...extra,
  });
  const panel = document.querySelector<HTMLElement>('.tr-panel')!;
  return {
    panel,
    flow: panel.querySelector<HTMLElement>('.tr-flow')!,
    close: () => api.close(),
    boxes: () => boxes,
    writes: () => writes,
    captioned: () => captioned,
  };
}

const act = (panel: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...panel.querySelectorAll<HTMLButtonElement>('.tr-act')]
    .find((b) => (b.textContent ?? '').startsWith(label));
const sentenceEls = (panel: HTMLElement): HTMLElement[] =>
  [...panel.querySelectorAll<HTMLElement>('.tr-sentence')];
/** Edit one sentence in place, the way a keystroke inside it would. */
const typeInto = (h: Harness, i: number, text: string): void => {
  sentenceEls(h.panel)[i]!.textContent = text;
  h.flow.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
const beforeInput = (h: Harness, inputType: string): boolean => {
  const e = new dom.window.Event('beforeinput', { cancelable: true, bubbles: true }) as Event;
  Object.defineProperty(e, 'inputType', { value: inputType });
  h.flow.dispatchEvent(e);
  return e.defaultPrevented;
};
/** Put the caret at a character offset inside a sentence's first text node. */
const caretAt = (h: Harness, i: number, offset: number): void => {
  const el = sentenceEls(h.panel)[i]!;
  const walker = document.createTreeWalker(el, 4);
  let node = walker.nextNode() as Text | null;
  let seen = 0;
  while (node && seen + node.data.length < offset) { seen += node.data.length; node = walker.nextNode() as Text | null; }
  const r = document.createRange();
  if (node) r.setStart(node, Math.min(node.data.length, offset - seen));
  else r.selectNodeContents(el);
  r.collapse(true);
  const sel = dom.window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(r);
};

// ---- the pure helpers ------------------------------------------------------

test('deriveScript breaks a legacy clip at terminal punctuation', () => {
  assert.equal(deriveScript(WORDS), SCRIPT);
  assert.equal(deriveScript([]), '');
});

test('dirtyLines: an untouched line is clean, a joined pair is one dirty line', () => {
  const base = scriptLines(SCRIPT);
  assert.deepEqual([...dirtyLines(base, base).dirty], [], 'nothing typed, nothing dirty');
  const joined = dirtyLines(base, ['Hello there This is a test.']);
  assert.deepEqual([...joined.dirty], [0]);
  const split = dirtyLines(base, ['Hello.', 'there.', 'This is a test.']);
  assert.deepEqual([...split.dirty], [0, 1], 'both halves of a split are dirty');
  assert.deepEqual(split.baseOfCur, [null, null, 1], 'and the untouched line keeps its timings');
});

test('spokenWordCount and markSignature ignore what is never spoken', () => {
  assert.equal(spokenWordCount('[pause 1] Hello there.'), 2);
  assert.equal(spokenWordCount('[slow] [SUSE](/sˈuːsə/) ships.'), 2);
  assert.equal(markSignature('Plain words.'), '');
  assert.notEqual(markSignature('[slow] Plain words.'), markSignature('[fast] Plain words.'));
});

test('lineSeparator: a terminal mark is the break, otherwise a newline is', () => {
  assert.equal(lineSeparator('Hello there.'), ' ');
  assert.equal(lineSeparator('A heading'), '\n');
  assert.equal(lineSeparator('Wait for it… [pause 1]'), ' ');
});

// ---- the toggle ------------------------------------------------------------

test('Edit script is offered on a spoken clip and withheld on any other', () => {
  mobile = false;
  const plain = open();
  try { assert.equal(act(plain.panel, 'Edit script'), undefined, 'a recording gets the read-only surface'); }
  finally { plain.close(); }

  const h = openTts();
  try {
    const btn = act(h.panel, 'Edit script')!;
    assert.equal(btn.getAttribute('aria-pressed'), 'false');
    assert.equal(h.panel.querySelector<HTMLElement>('.tr-chips')!.hidden, true, 'no chips until it is on');
    btn.click();
    assert.equal(btn.getAttribute('aria-pressed'), 'true');
    assert.equal(h.panel.querySelector<HTMLElement>('.tr-chips')!.hidden, false);
    assert.equal(sentenceEls(h.panel).length, 2, 'one block per script line');
    assert.equal(h.flow.textContent, 'Hello there. This is a test.');
    assert.equal(h.flow.getAttribute('aria-readonly'), 'false');
  } finally { h.close(); }
});

test('a clean sentence keeps its word timings, so click-to-seek still works', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    const first = sentenceEls(h.panel)[0]!;
    const words = [...first.querySelectorAll<HTMLElement>('.tr-word')];
    assert.deepEqual(words.map((w) => w.textContent), ['Hello', 'there.']);
    assert.equal(words[0]!.dataset.ms0, '0');
    assert.equal(words[1]!.dataset.t0, '1');
  } finally { h.close(); }
});

// ---- the input guard -------------------------------------------------------

test('the guard admits plain text in edit mode and refuses everything else', () => {
  const h = openTts();
  try {
    for (const kind of ['insertText', 'deleteContentBackward', 'insertParagraph']) {
      assert.equal(beforeInput(h, kind), true, `${kind} is refused while reading`);
    }
    act(h.panel, 'Edit script')!.click();
    for (const kind of ['insertText', 'deleteContentBackward', 'deleteContentForward']) {
      assert.equal(beforeInput(h, kind), false, `${kind} is how you type`);
    }
    for (const kind of ['formatBold', 'insertFromDrop', 'insertHTML', 'insertFromPasteAsQuotation']) {
      assert.equal(beforeInput(h, kind), true, `${kind} never reaches the flow`);
    }
  } finally { h.close(); }
});

test('Enter is taken over and inserts a real newline, whatever the engine would do', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    caretAt(h, 0, 6);                       // between "Hello " and "there."
    assert.equal(beforeInput(h, 'insertParagraph'), true,
      'the browser never gets to insert its own <div> or <br>');
    // Read back off textContent, which is the only thing the script is built
    // from - a <br> would have vanished here and glued the two halves together.
    assert.equal(h.flow.textContent, 'Hello\nthere. This is a test.');
    assert.equal(sentenceEls(h.panel).length, 3, 'and the break really is a sentence break');
  } finally { h.close(); }
});

test('paste is coerced to plain text and a drop is refused outright', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    caretAt(h, 0, 5);
    const paste = new dom.window.Event('paste', { cancelable: true, bubbles: true }) as Event;
    Object.defineProperty(paste, 'clipboardData', {
      value: { getData: (kind: string) => (kind === 'text/plain' ? ' again' : '<b>again</b>') },
    });
    h.flow.dispatchEvent(paste);
    assert.equal(paste.defaultPrevented, true, 'the browser never pastes markup');
    assert.equal(h.flow.querySelector('b'), null);
    assert.match(h.flow.textContent ?? '', /Hello again/);

    const drop = new dom.window.Event('drop', { cancelable: true, bubbles: true }) as Event;
    h.flow.dispatchEvent(drop);
    assert.equal(drop.defaultPrevented, true);
  } finally { h.close(); }
});

// ---- dirty collapse and the boundary rules ---------------------------------

test('typing in a sentence collapses it to one run and shows it dirty', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there!');
    const first = sentenceEls(h.panel)[0]!;
    assert.equal(first.classList.contains('is-dirty'), true);
    assert.equal(first.querySelector('.tr-word[data-t0]'), null, 'its old timings mean nothing now');
    assert.equal(sentenceEls(h.panel)[1]!.classList.contains('is-dirty'), false, 'the neighbour is untouched');
    assert.match(act(h.panel, 'Regenerate')!.textContent ?? '', /1 sentence · 2 words/);
  } finally { h.close(); }
});

test('deleting a terminal mark joins two sentences, and the band covers both', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there');           // the full stop is gone
    const sents = sentenceEls(h.panel);
    assert.equal(sents.length, 1, 'the two are one line to speak now');
    assert.equal(sents[0]!.classList.contains('is-dirty'), true);
    assert.match(act(h.panel, 'Regenerate')!.textContent ?? '', /1 sentence · 6 words/,
      'one edited sentence reads in the singular');
  } finally { h.close(); }
});

test('the Regenerate count has a singular form for both halves of it', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hi!');
    assert.match(act(h.panel, 'Regenerate')!.textContent ?? '', /1 sentence · 1 word$/);
  } finally { h.close(); }
});

test('a terminal mark typed mid-sentence splits the line, and both halves are dirty', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello. There.');
    const sents = sentenceEls(h.panel);
    assert.equal(sents.length, 3);
    assert.deepEqual(sents.map((s) => s.classList.contains('is-dirty')), [true, true, false]);
    assert.match(act(h.panel, 'Regenerate')!.textContent ?? '', /2 sentences · 2 words/);
  } finally { h.close(); }
});

test('Enter splits a line the same way a full stop does', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 1, 'This is\na test.');
    const sents = sentenceEls(h.panel);
    assert.equal(sents.length, 3);
    assert.deepEqual(sents.map((s) => s.classList.contains('is-dirty')), [false, true, true]);
  } finally { h.close(); }
});

// ---- marks: the restyler and the pointer controls ---------------------------

test('a typed mark is wrapped in its own segment, caret-transparent', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, '[pause 2] Hello there.');
    const mark = h.panel.querySelector<HTMLElement>('.tr-mark')!;
    assert.equal(mark.textContent, '[pause 2]');
    assert.equal(mark.dataset.mark, 'pause');
    assert.equal(mark.getAttribute('contenteditable'), null, 'a styling wrapper, never contenteditable=false');
    assert.equal(h.flow.textContent, '[pause 2] Hello there. This is a test.');
  } finally { h.close(); }
});

test('clicking a pause steps its seconds; Remove takes it out', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, '[pause 2] Hello there.');
    h.panel.querySelector<HTMLElement>('.tr-mark')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const pop = h.panel.querySelector<HTMLElement>('.tr-pop')!;
    assert.equal(pop.querySelector('.tr-pop-val')!.textContent, '2s');
    [...pop.querySelectorAll<HTMLButtonElement>('.tr-pop-btn')].find((b) => b.textContent === '+')!.click();
    assert.equal(h.panel.querySelector('.tr-mark')!.textContent, '[pause 2.2]');
    assert.equal(h.panel.querySelector('.tr-pop'), null, 'the popover stands down after the change');

    h.panel.querySelector<HTMLElement>('.tr-mark')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const pop2 = h.panel.querySelector<HTMLElement>('.tr-pop')!;
    [...pop2.querySelectorAll<HTMLButtonElement>('.tr-pop-btn')].find((b) => b.textContent === 'Remove')!.click();
    assert.equal(h.panel.querySelector('.tr-mark'), null);
    assert.equal(h.flow.textContent, 'Hello there. This is a test.');
  } finally { h.close(); }
});

test('a speed mark toggles slow, fast and off', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, '[slow] Hello there.');
    const clickMark = (): HTMLElement => {
      h.panel.querySelector<HTMLElement>('.tr-mark')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      return h.panel.querySelector<HTMLElement>('.tr-pop')!;
    };
    const press = (pop: HTMLElement, label: string): void => {
      [...pop.querySelectorAll<HTMLButtonElement>('.tr-pop-btn')]
        .find((b) => (b.textContent ?? '').endsWith(label))!.click();
    };
    press(clickMark(), 'Fast');
    assert.equal(h.panel.querySelector('.tr-mark')!.textContent, '[fast]');
    press(clickMark(), 'Off');
    assert.equal(h.panel.querySelector('.tr-mark'), null);
  } finally { h.close(); }
});

test('a pronunciation mark offers its phonemes in a field', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello [there](/ðɛɹ/).');
    const mark = h.panel.querySelector<HTMLElement>('.tr-mark[data-mark="say"]')!;
    mark.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    const field = h.panel.querySelector<HTMLInputElement>('.tr-pop-field')!;
    assert.equal(field.value, 'ðɛɹ');
    field.value = 'ðˈɛɹ';
    field.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(h.panel.querySelector('.tr-mark')!.textContent, '[there](/ðˈɛɹ/)');
  } finally { h.close(); }
});

// ---- the chip bar and Tips -------------------------------------------------

test('a chip puts its own text in at the caret', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    caretAt(h, 0, 12);                      // right after "Hello there."
    h.panel.querySelector<HTMLButtonElement>('.tr-chip[data-chip="pause"]')!.click();
    assert.match(h.flow.textContent ?? '', /\[pause\]/);
    assert.equal(h.panel.querySelectorAll('.tr-mark').length, 1);
  } finally { h.close(); }
});

test('Tips lists one line per technique, each with an example', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    h.panel.querySelector<HTMLButtonElement>('.tr-chip-tips')!.click();
    const tips = h.panel.querySelectorAll('.tr-pop-tips .tr-tip');
    assert.ok(tips.length >= 6);
    for (const tip of tips) assert.ok((tip.querySelector('.tr-tip-ex')?.textContent ?? '').length > 0);
  } finally { h.close(); }
});

test('the recipe popover reads the clip back, and sends changes to Script audio', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    act(h.panel, 'Voice')!.click();
    const pop = h.panel.querySelector<HTMLElement>('.tr-pop-recipe')!;
    assert.match(pop.textContent ?? '', /bf_lily/);
    assert.match(pop.textContent ?? '', /Script audio/);
    assert.equal(pop.querySelector('input, select'), null, 'read-only here on purpose');
  } finally { h.close(); }
});

test('Escape closes an open popover before it closes the panel', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    h.panel.querySelector<HTMLButtonElement>('.tr-chip-tips')!.click();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(h.panel.querySelector('.tr-pop'), null);
    assert.ok(document.querySelector('.tr-panel'), 'the panel is still here');
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(document.querySelector('.tr-panel'), null);
  } finally { h.close(); }
});

// ---- Regenerate ------------------------------------------------------------

test('Regenerate is offered only once something is dirty, and carries the count', () => {
  const h = openTts({ regenerate: async () => null });
  try {
    act(h.panel, 'Edit script')!.click();
    assert.equal(act(h.panel, 'Regenerate')!.disabled, true, 'nothing to speak again yet');
    typeInto(h, 0, 'Hello there!');
    assert.equal(act(h.panel, 'Regenerate')!.disabled, false);
  } finally { h.close(); }
});

test('Regenerate splices the boxes, re-runs the captions, and keeps the take when asked', async () => {
  let seen: { script: string; dirtyLines: number[]; keepPrevious: boolean } | null = null;
  const h = openTts({
    regenerate: async (req) => {
      seen = { script: req.script, dirtyLines: req.dirtyLines, keepPrevious: req.keepPrevious };
      req.onProgress?.(0.5);
      return { words: moved(2, 1), script: 'Hello there!\nThis is a test.', edits: [{ from: 0, to: 2, delta: 1 }] };
    },
  });
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there!');
    const keep = [...h.panel.querySelectorAll<HTMLInputElement>('.tr-chk input')].at(-1)!;
    assert.equal(keep.checked, false, 'keeping the previous take is opt-in');
    keep.checked = true;
    await act(h.panel, 'Regenerate')!.click();
    await new Promise((r) => setTimeout(r, 0));

    assert.deepEqual(seen, {
      script: 'Hello there!\nThis is a test.', dirtyLines: [0], keepPrevious: true,
    });
    assert.equal(h.writes().length, 1, 'one write, so one undo step');
    assert.equal(h.boxes()[0]!.dur, 7, 'the clip grew by the delta');
    assert.equal(h.captioned().length, 1, 'the captions follow the new words');
    assert.deepEqual([...sentenceEls(h.panel)].map((s) => s.classList.contains('is-dirty')), [false, false]);
  } finally { h.close(); }
});

test('a regeneration that finishes with the panel closed re-fits on the next open', async () => {
  let release: (() => void) | null = null;
  const gate = new Promise<void>((r) => { release = r; });
  const h = openTts({
    regenerate: async () => {
      await gate;
      return { words: moved(2, 1), script: 'Hello there!\nThis is a test.', edits: [{ from: 0, to: 2, delta: 1 }] };
    },
  });
  act(h.panel, 'Edit script')!.click();
  typeInto(h, 0, 'Hello there!');
  act(h.panel, 'Regenerate')!.click();
  h.close();
  release!();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(h.writes().length, 0, 'never edit a document behind the user');

  const again = openTts();
  try {
    assert.equal(again.writes().length, 1, 'the re-fit runs on the open the user asked for');
    assert.equal(again.boxes()[0]!.dur, 7);
    assert.equal(takePendingRefit('a1'), null, 'and it is not applied twice');
  } finally { again.close(); }
});

test('the rewritten clip replaces the box ref, so the canvas plays the new take', async () => {
  const fresh = { id: 'a1', url: 'blob:new', type: 'audio', meta: { tts: { words: moved(2, 1) } } };
  const h = openTts({
    regenerate: async () => ({
      words: moved(2, 1), script: 'Hello there!\nThis is a test.',
      edits: [{ from: 0, to: 2, delta: 1 }],
      ref: fresh as unknown as never,
    }),
  });
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there!');
    act(h.panel, 'Regenerate')!.click();
    await new Promise((r) => setTimeout(r, 0));
    // The stored ref carried the PREVIOUS bytes' object URL and the previous
    // meta.tts; leaving it in place plays the old audio under the new cuts.
    assert.equal(h.writes().length, 1, 'the ref rides the same write as the geometry');
    assert.equal((h.boxes()[0]!.image as { url?: string }).url, 'blob:new');
    assert.equal(h.boxes()[0]!.dur, 7, 'and the geometry is still re-fitted');
  } finally { h.close(); }
});

test('the tts block the panel was handed follows the new take, script and words', async () => {
  const tts = { script: SCRIPT, voice: 'bf_lily', speed: 1, words: WORDS.map((w) => ({ ...w })) };
  const next = moved(2, 1);
  const h = openTts({
    tts,
    regenerate: async () => ({
      words: next, script: 'Hello there!\nThis is a test.', edits: [{ from: 0, to: 2, delta: 1 }],
    }),
  });
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there!');
    act(h.panel, 'Regenerate')!.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(tts.script, 'Hello there!\nThis is a test.');
    // Stale words here are what the NEXT open reads: the read-along would
    // highlight against audio that no longer matches, and the diff for a
    // second Regenerate would run against the wrong base.
    assert.deepEqual(tts.words, next);
  } finally { h.close(); }
});

test('typing is refused while a regeneration is in flight', async () => {
  let release: (() => void) | null = null;
  const gate = new Promise<void>((r) => { release = r; });
  const h = openTts({
    regenerate: async () => {
      await gate;
      return { words: moved(2, 1), script: 'Hello there!\nThis is a test.', edits: [{ from: 0, to: 2, delta: 1 }] };
    },
  });
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there!');
    act(h.panel, 'Regenerate')!.click();
    await new Promise((r) => setTimeout(r, 0));
    // The run was handed a snapshot of the script and rebuilds the flow from
    // what comes back, so a keystroke now would be silently thrown away.
    assert.equal(beforeInput(h, 'insertText'), true, 'the words are the run\'s until it lands');
    assert.equal(h.flow.getAttribute('aria-readonly'), 'true');
    assert.equal(h.panel.querySelector<HTMLButtonElement>('.tr-chip[data-chip="pause"]')!.disabled, true);
    release!();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(beforeInput(h, 'insertText'), false, 'and editable again once it has');
    assert.equal(h.flow.getAttribute('aria-readonly'), 'false');
  } finally { h.close(); }
});

// ---- leaving edit mode ------------------------------------------------------

test('leaving edit mode keeps what was typed, and the button does not say Done', () => {
  const h = openTts();
  try {
    const toggle = act(h.panel, 'Edit script')!;
    toggle.click();
    typeInto(h, 0, 'Hello there!');
    assert.match(toggle.textContent ?? '', /Stop editing/, 'only Regenerate commits');
    toggle.click();
    assert.equal(h.panel.querySelector('.tr-sentence'), null, 'back to the cutting surface');
    toggle.click();
    assert.equal(sentenceEls(h.panel)[0]!.textContent, 'Hello there!', 'the typing survived the trip');
    assert.match(act(h.panel, 'Regenerate')!.textContent ?? '', /1 sentence/);
  } finally { h.close(); }
});

test('Escape puts the cutting surface back before it closes a panel with unspoken edits', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    typeInto(h, 0, 'Hello there!');
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.ok(document.querySelector('.tr-panel'), 'a reflex Escape does not take the script with it');
    assert.equal(act(h.panel, 'Edit script')!.getAttribute('aria-pressed'), 'false');
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(document.querySelector('.tr-panel'), null);
  } finally { h.close(); }
});

test('Say it as at a bare caret leaves the caret in the empty phoneme slot', () => {
  const h = openTts();
  try {
    act(h.panel, 'Edit script')!.click();
    caretAt(h, 0, 2);                       // inside "Hello", nothing selected
    h.panel.querySelector<HTMLButtonElement>('.tr-chip[data-chip="say"]')!.click();
    assert.match(h.flow.textContent ?? '', /\[Hello\]\(\/\/\)/);
    const sel = dom.window.getSelection()!;
    assert.ok(sel.rangeCount > 0 && h.flow.contains(sel.getRangeAt(0).startContainer),
      'the caret is still in the flow, not lost with the detached text node');
    // Two characters back from the end of the inserted mark is between the slashes.
    const r = document.createRange();
    r.selectNodeContents(h.flow);
    r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    assert.match(r.toString(), /\[Hello\]\(\/$/, 'and it sits where the phonemes go');
  } finally { h.close(); }
});
