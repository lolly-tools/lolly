// SPDX-License-Identifier: MPL-2.0
/** CLI transport for the document API. JSON goes to stdout; package bytes may
 * go to a file. */
import { readFile, writeFile } from 'node:fs/promises';
import { compileDocument, diffDocuments, documentSchema, inspectDocument, measureDocument, optimizeDocument, packageDocument, validateDocument } from '@lolly/engine';
import { createCliBridge } from './bridge.ts';
import { loadToolOrThrow, readProfile, readToolFile } from './run.ts';
import { inspectPath } from '@lolly-tools/node-shell/inspect';

const jsonFile = async (path: string): Promise<any> => JSON.parse(await readFile(path, 'utf8'));

async function compile(toolId: string, inputsPath?: string, profilePath?: string) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="canvas"></div></body></html>');
  const g = globalThis as Record<string, unknown>; const prev = { window: g.window, document: g.document, Element: g.Element };
  g.window = dom.window; g.document = dom.window.document; g.Element = dom.window.Element;
  try {
    const tool = await loadToolOrThrow(toolId, readToolFile);
    const host = await createCliBridge({ dom: dom as never, profile: await readProfile(profilePath), networkAllowlist: tool.manifest.network?.allowlist });
    return compileDocument(tool, inputsPath ? await jsonFile(inputsPath) : {}, { host });
  } finally { g.window = prev.window; g.document = prev.document; g.Element = prev.Element; dom.window.close(); }
}

export async function documentCli(command: string, positionals: string[], flags: Record<string, string>): Promise<void> {
  let value: unknown;
  if (command === 'compile') {
    if (!positionals[0]) throw new Error('usage: lolly compile <tool-id> [--inputs=file.json]');
    value = await compile(positionals[0], flags.inputs, flags['user-profile']);
  } else if (command === 'schema') {
    if (!positionals[0]) throw new Error('usage: lolly schema <tool-id>');
    value = documentSchema(await loadToolOrThrow(positionals[0], readToolFile));
  } else if (command === 'diff') {
    if (!positionals[0] || !positionals[1]) throw new Error('usage: lolly diff <a.json> <b.json>');
    value = diffDocuments(await jsonFile(positionals[0]), await jsonFile(positionals[1]));
  } else if (command === 'validate') {
    if (!positionals[0]) throw new Error('usage: lolly validate <document.json|tool-id> --document [--inputs=file.json]');
    if (positionals[0].toLowerCase().endsWith('.json') && !flags.inputs) {
      value = validateDocument({ kind: 'document', value: await jsonFile(positionals[0]) });
    } else {
      const tool = await loadToolOrThrow(positionals[0], readToolFile);
      value = validateDocument({ kind: 'inputs', manifest: tool.manifest, value: flags.inputs ? await jsonFile(flags.inputs) : {} });
    }
  } else {
    if (!positionals[0]) throw new Error(`usage: lolly ${command} <document.json>`);
    const isJsonDocument = positionals[0].toLowerCase().endsWith('.json');
    const document = isJsonDocument ? await jsonFile(positionals[0]) : null;
    if (command === 'inspect') value = document && document.toolId && document.hydrated ? inspectDocument(document) : await inspectPath(positionals[0]);
    else if (command === 'measure') {
      if (!document) throw new Error('measure requires a compiled document JSON file');
      value = measureDocument(document, { width: flags.width, height: flags.height, unit: flags.unit, dpi: flags.dpi ? Number(flags.dpi) : undefined });
    }
    else if (command === 'optimize') {
      if (document) value = await optimizeDocument(document);
      else {
        const format = (flags.format ?? positionals[0].split('.').pop()?.replace('jpg', 'jpeg')) as 'jpeg' | 'png' | 'svg';
        const optimized = await optimizeDocument(new Uint8Array(await readFile(positionals[0])), { format });
        if (flags.output && flags.output !== '-') { await writeFile(flags.output, optimized.value); value = { output: flags.output, savedBytes: optimized.savedBytes, stages: optimized.stages }; }
        else { process.stdout.write(optimized.value); return; }
      }
    }
    else if (command === 'package') {
      const packed = await packageDocument(document);
      if (flags.output && flags.output !== '-') { await writeFile(flags.output, packed.bytes); value = { ...packed.manifest, output: flags.output, bytes: packed.bytes.byteLength }; }
      else { process.stdout.write(packed.bytes); return; }
    } else throw new Error(`unknown document verb: ${command}`);
  }
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}
