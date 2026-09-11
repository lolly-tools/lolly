var DEFAULT_CODE = "const greet = (name) => {\n  console.log(`Hello, ${name}!`);\n  return name;\n};\n\ngreet('World');";

var EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', rust: 'rs',
  go: 'go', css: 'css', html: 'html', bash: 'sh', json: 'json',
  plain: 'txt', auto: 'txt'
};

function safeJson(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

async function compute(inputs) {
  var code = inputs.code || DEFAULT_CODE;
  var col = 0;
  var displayCode = code.replace(/\t|\n/g, function (c, offset) {
    if (c === '\n') { col = offset + 1; return c; }
    var count = 2 - ((offset - col) % 2); col -= count - 1; return ' '.repeat(count);
  });
  var highlighted = await host.textTools.highlight(displayCode, inputs.language || 'auto', { calloutMode: inputs.calloutMode || 'off', calloutPrefixes: (inputs.calloutPrefix || '').split(',').map(function(p) { return p.trim().toLowerCase(); }).filter(Boolean) });
  var lang = highlighted.language;
  var theme = inputs.theme || 'suse-dark';
  var windowStyle = inputs.windowStyle || 'nuremberg';
  var lineNumbers = inputs.lineNumbers !== false;
  var showWindow = inputs.showWindow !== false;
  var ext = EXT[lang] || 'txt';

  var filename = inputs.fileName && inputs.fileName.trim()
    ? inputs.fileName.trim()
    : '';

  return {
    highlightedCode: safeJson(highlighted.html),
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

function onInit({ model }) {
  return compute(Object.fromEntries(model.map(function(i) { return [i.id, i.value]; })));
}

function onInput({ model }) {
  return compute(Object.fromEntries(model.map(function(i) { return [i.id, i.value]; })));
}
