function values(model) { return Object.fromEntries(model.map(function (input) { return [input.id, input.value]; })); }
async function compute(model) {
  var input = values(model);
  var result = await host.textTools.run({ text: String(input.body || ''), operation: input.operation || 'identity', options: JSON.parse(input.settings || '{}') });
  return { resultText: result.text, resultFormat: result.format, resultNotes: result.notes.join('\n') };
}
async function onInit(args) { return compute(args.model); }
async function onInput(args) { return compute(args.model); }
async function exportFile(args) {
  var result = await compute(args.model);
  return { bytes: new TextEncoder().encode(result.resultText), mime: 'text/plain;charset=utf-8', filename: 'text.' + result.resultFormat };
}
