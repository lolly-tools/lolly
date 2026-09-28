const DEFAULT_CODE = "const greet = (name) => {\n  console.log(`Hello, ${name}!`);\n  return name;\n};\n\ngreet('World');";

function safeJson(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function bounded(value, fallback, min, max) {
  const n = Number(value == null ? fallback : value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function expandTabs(text) {
  let col = 0;
  return String(text).replace(/\r\n?/g, '\n').replace(/\t|\n|[^\t\n]+/g, (s) => {
    if (s === '\n') { col = 0; return s; }
    if (s === '\t') { const n = 2 - col % 2; col += n; return ' '.repeat(n); }
    col += s.length;
    return s;
  });
}

function textCuts(text, style) {
  const segments = Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text));
  let cuts = [], weight = 0;
  segments.forEach((part, i) => {
    const last = i === segments.length - 1;
    const boundary = style === 'line' ? part.segment === '\n' : /\s/.test(part.segment);
    if ((style === 'word' || style === 'line') && !boundary && !last) return;
    if (style === 'paste' && !last) return;
    let w = 1;
    if (style === 'natural') {
      w = 0.8 + ((i * 17 + part.segment.codePointAt(0)) % 11) / 20;
      if (/[.!?,;:]/.test(part.segment)) w += 1.5;
      if (part.segment === '\n') w += 3;
    }
    weight += w;
    cuts.push([weight, part.index + part.segment.length]);
  });
  return cuts.map((c) => [c[0] / (weight || 1), c[1]]);
}

function sceneSteps(inputs, code) {
  const mode = inputs.scene || 'still';
  if (mode === 'custom') return (Array.isArray(inputs.steps) ? inputs.steps : []).slice(0, 24);
  const typing = bounded(inputs.typingSeconds, 6, 0.2, 30);
  const hold = bounded(inputs.readSeconds, 2, 0, 30);
  const steps = mode === 'typing' ? [] : [{ action: 'open', seconds: 0.5 }];
  steps.push({ action: 'click', seconds: 0.8 });
  if (mode === 'replace') {
    steps.push({ action: 'wait', seconds: 0.6 },
      { action: 'select', text: inputs.selectText || '', seconds: 0.8 },
      { action: 'wait', seconds: 0.4 },
      { action: 'replace', text: inputs.replacementText || '', seconds: typing });
  } else if (mode === 'autocomplete') {
    const cuts = textCuts(code, 'steady');
    const count = Math.floor(cuts.length * bounded(inputs.completeAfter, 35, 0, 95) / 100);
    const at = count ? cuts[count - 1][1] : 0;
    steps.push({ action: 'type', text: code.slice(0, at), seconds: typing, literal: true },
      { action: 'complete', text: code.slice(at), seconds: 1.2 });
  } else {
    steps.push({ action: 'type', text: code, seconds: typing });
  }
  steps.push({ action: 'wait', seconds: hold });
  if (mode !== 'typing' && inputs.ending !== 'hold') steps.push({ action: 'close', seconds: 1 });
  return steps;
}

async function compileScene(inputs, code, language) {
  const mode = inputs.scene || 'still';
  const animated = mode !== 'still';
  const filled = mode === 'still' || mode === 'replace' || (mode === 'custom' && inputs.startFilled === true);
  const docs = [], events = [], warnings = [];
  if (mode === 'custom' && Array.isArray(inputs.steps) && inputs.steps.length > 24) warnings.push('Use at most 24 scene steps.');
  function documentId(text) {
    const existing = docs.findIndex((d) => d.text === text);
    if (existing >= 0) return existing;
    docs.push({ text: text, html: '' });
    return docs.length - 1;
  }
  const state = { doc: documentId(filled ? code : ''), caret: 0, selection: null, open: mode === 'still' || mode === 'typing' || (mode === 'custom' && inputs.startFilled === true), focused: false };
  let initial = Object.assign({}, state), time = 0, poster = 0;
  const steps = animated ? sceneSteps(inputs, code) : [];
  steps.forEach((step) => {
    const action = step.action || 'wait';
    if (!['open', 'click', 'type', 'wait', 'select', 'replace', 'complete', 'close'].includes(action)) return;
    const seconds = bounded(step.seconds, 1, 0, 30);
    const before = Object.assign({}, state), source = docs[state.doc].text;
    let text = expandTabs(step.text == null ? '' : step.text);
    const event = { action: action, start: time, end: time + seconds, before: before, after: null, cuts: [], insert: '', at: state.caret };
    if (action === 'open') { state.open = true; state.focused = false; }
    if (action === 'close') { state.open = false; state.focused = false; state.selection = null; }
    if (action === 'click') { state.open = true; state.focused = true; state.caret = source.length; state.selection = null; }
    if (action === 'select') {
      const start = text ? source.indexOf(text) : -1;
      const boundaries = [0].concat(textCuts(source, 'steady').map((c) => c[1]));
      if (start >= 0 && boundaries.includes(start) && boundaries.includes(start + text.length)) {
        state.selection = [start, start + text.length]; state.caret = start + text.length; state.focused = true;
        event.cuts = textCuts(text, 'steady');
      } else {
        state.selection = null;
        warnings.push('Choose text that occurs in the snippet as whole characters.');
      }
    }
    if (action === 'type' || action === 'replace' || action === 'complete') {
      if (action === 'type' && !text && !step.literal) text = code;
      if (action === 'replace' && !state.selection) {
        warnings.push('Select text before a Replace step.');
      } else {
        const from = state.selection ? state.selection[0] : state.caret;
        const to = state.selection ? state.selection[1] : state.caret;
        event.at = from; event.insert = text;
        state.doc = documentId(source.slice(0, from) + text + source.slice(to));
        state.caret = from + text.length; state.selection = null; state.focused = true; state.open = true;
        event.cuts = textCuts(text, inputs.typingStyle || 'natural');
      }
    }
    event.after = Object.assign({}, state);
    events.push(event);
    time = event.end;
    if (state.open && action !== 'open') poster = time;
  });
  if (!events.length && animated) warnings.push('Add a step to play this scene.');
  await Promise.all(docs.map(async (doc) => {
    doc.html = (await host.textTools.highlight(doc.text, language, { calloutMode: 'off' })).html;
  }));
  return {
    version: 1, animated: animated, initial: initial, docs: docs, events: events,
    duration: Math.max(0.1, time), poster: poster, warnings: Array.from(new Set(warnings)),
    pointer: inputs.showPointer !== false, clickRing: inputs.clickRing === true,
    cursorScale: bounded(inputs.cursorSize, 100, 50, 250) / 100,
    entry: inputs.entryMotion || 'scale', exit: inputs.exitMotion || 'scale',
    rotate: bounded(inputs.windowRotate, 0, -15, 15), tiltX: bounded(inputs.windowTiltX, 0, -25, 25), tiltY: bounded(inputs.windowTiltY, 0, -25, 25),
    scroll: inputs.textOverflow === 'scroll', wrap: inputs.wrapText === true,
    posterAt: bounded(inputs.posterAt, -1, -1, Math.max(0.1, time))
  };
}

async function compute(inputs) {
  const code = inputs.code == null ? DEFAULT_CODE : String(inputs.code);
  const displayCode = expandTabs(code);
  const highlighted = await host.textTools.highlight(displayCode, inputs.language || 'auto', { calloutMode: inputs.calloutMode || 'off', calloutPrefixes: (inputs.calloutPrefix || '').split(',').map((p) => p.trim().toLowerCase()).filter(Boolean) });
  const lang = highlighted.language;
  const theme = inputs.theme || 'suse-dark';
  const windowStyle = inputs.windowStyle || 'nuremberg';
  const lineNumbers = inputs.lineNumbers !== false;
  const showWindow = inputs.showWindow !== false;
  const scene = await compileScene(inputs, displayCode, lang);

  const filename = inputs.fileName?.trim()
    ? inputs.fileName.trim()
    : '';

  return {
    highlightedCode: safeJson(highlighted.html),
    snippetScene: safeJson(scene),
    snippetClipMs: scene.animated ? Math.round(scene.duration * 1000) : '',
    rawCode:     safeJson(code),
    language:    lang,
    theme:       theme,
    windowStyle: windowStyle,
    lineNumbers: lineNumbers,
    showWindow:  showWindow,
    filename:    filename,
    scale:       inputs.scale || 100
  };
}

function snippetController(node) {
  const root = node && (node.id === 'cc-root' ? node : node.querySelector?.('#cc-root'));
  return root?.__snippet;
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function beforeExport(ctx) {
  const player = snippetController(ctx.node);
  if (!player) return;
  const motion = ['mp4', 'webm', 'gif', 'webp-anim', 'apng', 'html'].includes(ctx.format);
  const requestedDuration = ctx.opts.durationUserSet || ctx.opts.thumbnail ? ctx.opts.duration : player.duration;
  player.prepareExport(motion, requestedDuration);
  if (motion && player.animated) {
    ctx.opts.wait = 0;
    if (!ctx.opts.durationUserSet && !ctx.opts.thumbnail) ctx.opts.duration = player.duration;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function afterExport(ctx) {
  const player = snippetController(ctx.node);
  if (player) player.finishExport();
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInit({ model }) {
  return compute(Object.fromEntries(model.map((i) => [i.id, i.value])));
}

// biome-ignore lint/correctness/noUnusedVariables: The engine calls this named hook.
function onInput({ model }) {
  return compute(Object.fromEntries(model.map((i) => [i.id, i.value])));
}
