var DEFAULT_CODE = "const greet = (name) => {\n  console.log(`Hello, ${name}!`);\n  return name;\n};\n\ngreet('World');";

var EXT = {
  javascript: 'js', typescript: 'ts', python: 'py', rust: 'rs',
  go: 'go', css: 'css', html: 'html', bash: 'sh', json: 'json',
  plain: 'txt', auto: 'txt'
};

function detectLang(code) {
  if (/^<(!DOCTYPE|html)/i.test(code.trim())) return 'html';
  if (/^\s*\{[\s\S]*\}\s*$/.test(code.trim()) && code.includes('"')) return 'json';
  if (/\bdef \w+\(|^import \w|^from \w+ import|:\s*$|\bprint\(/m.test(code)) return 'python';
  if (/\bfn \w+\(|\blet mut\b|\bimpl\b|\buse std::/m.test(code)) return 'rust';
  if (/\bfunc \w+\(|\bpackage \w|\bfmt\.\w|\bgo \w/m.test(code)) return 'go';
  if (/\$\(|\becho\b|\b(?:if|fi|then|done)\b.*\n|\bexport\b/m.test(code)) return 'bash';
  if (/\{[^}]*:\s*[^;]+;/.test(code) && !code.includes('function')) return 'css';
  if (/\binterface\b|\btype\b.*=|\b(?:string|number|boolean)\b/.test(code)) return 'typescript';
  return 'javascript';
}

function safeJson(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function compute(inputs) {
  var code = inputs.code || DEFAULT_CODE;
  var lang = inputs.language === 'auto' ? detectLang(code) : (inputs.language || 'javascript');
  var theme = inputs.theme || 'suse-dark';
  var lineNumbers = inputs.lineNumbers !== false;
  var showWindow = inputs.showWindow !== false;
  var ext = EXT[lang] || 'txt';

  var filename = inputs.filename && inputs.filename.trim()
    ? inputs.filename.trim()
    : '';

  return {
    rawCode:     safeJson(code),
    language:    lang,
    theme:       theme,
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
