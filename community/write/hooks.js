// SPDX-License-Identifier: MPL-2.0
function values(model) { return Object.fromEntries(model.map(function (input) { return [input.id, input.value]; })); }
function compute(model) { return { resultText: String(values(model).body || '') }; }
function onInit(args) { return compute(args.model); }
function onInput(args) { return compute(args.model); }
function exportFile(args) {
  var input = values(args.model), source = {};
  try { source = JSON.parse(input.source || '{}'); } catch (_) { /* Use the default filename. */ }
  var markdown = input.language === 'markdown';
  return { bytes: new TextEncoder().encode(String(input.body || '')), mime: markdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8', filename: source.name || (markdown ? 'Untitled.md' : 'Untitled.txt') };
}
