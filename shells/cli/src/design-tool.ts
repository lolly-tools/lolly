// SPDX-License-Identifier: MPL-2.0
/** Render a reviewed portable tool through the ordinary browser shell and strict worker. */
import { readFile, writeFile } from 'node:fs/promises';
import { readLollyFile, bundledToolFiles } from '@lolly-tools/node-shell/lolly-file';
import { renderToolPackageViaWebShell, closeWebShell } from '@lolly-tools/node-shell/webshell-render';
import { closeBrowser } from '@lolly-tools/node-shell/browsers';
import { buildInputModel, loadTool, parseUrlState, inspectProduction, sha256Hex, parseProductionRepair, proposeProductionPatch, runProductionRepairs, requireProduction, type ProductionSpec, type ProductionReport } from '@lolly/engine';
import { collectProduction, productionContractFile, productionFile } from '@lolly-tools/node-shell/production';
import { assertDesignValues, designExportSize } from '../../../engine/src/design-tool/policy.ts';
import { writeOut } from './output.ts';
import { refused, usageError } from './exit-codes.ts';

export async function runDesignToolPackage(path: string, flags: Record<string,string>): Promise<void> {
  const bytes = new Uint8Array(await readFile(path));
  const contents = readLollyFile(bytes, {allowTool:true});
  if (contents.manifest.kind !== 'tool') throw usageError('Choose a reusable tool .lolly file.', 'BAD_INPUT');
  const files = bundledToolFiles(contents)!; const id = contents.manifest.tool.id;
  const tool = await loadTool(id, async file => {
    const bytes = files.get(file.slice(id.length + 1)); if (!bytes) throw new Error(`Missing tool file: ${file}`); return new TextDecoder().decode(bytes);
  }, {trustClass:'sideloaded-consented'});
  if (!tool.manifest.designTool) throw usageError('This command supports tools made with Share with rules.', 'BAD_INPUT');
  if (!['1','true','on'].includes(flags['trust-tool'] || '')) throw usageError(`Review ${tool.manifest.name} ${tool.manifest.version}, then add --trust-tool to run its packaged hooks in the isolated reader.`, 'TRUST_REQUIRED');
  const {output,export:format='png','trust-tool':_trust,quiet:_quiet,verbose:_verbose,strict:_strict,production:contractPath,'production-reference':referencePath,'production-report':reportPath,'production-repairs':repairPath,...values} = flags;
  if (!contractPath && [referencePath, reportPath, repairPath].some(value => value !== undefined)) throw usageError('Production options require --production.', 'CONFLICTING_FLAGS');
  const contract = contractPath ? await productionContractFile(contractPath) : undefined;
  const reference = referencePath ? await productionFile(referencePath, 32 * 1024 * 1024) : undefined;
  const plan = repairPath ? parseProductionRepair(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await productionFile(repairPath, 128 * 1024)))) : undefined;
  const query = new URLSearchParams(values).toString();
  const parsed = parseUrlState(query,tool.manifest);
  assertDesignValues(tool.manifest.designTool,parsed.values,true);
  designExportSize(tool.manifest.designTool,parsed.values,format);
  for (const key of Object.keys(values)) if (!tool.manifest.inputs.some(i => i.id === key || i.urlKey === key || i.type === 'vector' && i.fields?.some(f => `${i.id}.${f.id}` === key)) && !['format','width','height','unit','dpi','c2pa','imprint','text','password','bleed','marks'].includes(key)) throw usageError(`Unknown tool input: ${key}`, 'UNKNOWN_FLAG');
  const declared = new Set(tool.manifest.inputs.map(input => input.id));
  if (plan && Object.keys(plan.permitted).some(key => !declared.has(key))) throw usageError('Repair inputs must be declared tool inputs.', 'BAD_INPUT');
  const sourceSha256 = contract ? await sha256Hex(bytes) : undefined;
  const renderCandidate = async (candidateValues: Record<string, unknown>) => {
    const candidate = { ...values };
    for (const key of Object.keys(plan?.permitted ?? {})) {
      const input = tool.manifest.inputs.find(input => input.id === key)!;
      if (input.urlKey) delete candidate[input.urlKey];
      for (const field of input.fields ?? []) delete candidate[`${key}.${field.id}`];
      candidate[key] = typeof candidateValues[key] === 'string' ? candidateValues[key] as string : JSON.stringify(candidateValues[key]);
    }
    const candidateQuery = new URLSearchParams(candidate).toString(), candidateState = parseUrlState(candidateQuery, tool.manifest);
    assertDesignValues(tool.manifest.designTool!, candidateState.values, true);
    designExportSize(tool.manifest.designTool!, candidateState.values, format);
    let inputs: Record<string, string> | undefined;
    const rendered = await renderToolPackageViaWebShell(bytes, id, candidateQuery, format, {
      productionInputIds: contract?.requirements.filter(r => r.kind === 'input').map(r => r.location),
      onProductionInputs: observed => { inputs = observed; },
    });
    const report = await inspectProduction(rendered, contract, collectProduction, { reference, resolved: { sourceSha256, inputs } });
    return { bytes: rendered, contract: contract as ProductionSpec, report };
  };
  try {
    let rendered: Uint8Array;
    if (contract) {
      let result: Awaited<ReturnType<typeof renderCandidate>>, attempts: ProductionReport[] | undefined;
      if (plan) {
        const inputs = Object.fromEntries(buildInputModel(tool.manifest, { initial: parsed.values }).filter(input => declared.has(input.id)).map(input => [input.id, input.value]));
        const run = await runProductionRepairs(inputs, plan, { render: renderCandidate, propose: (inputs, report) => proposeProductionPatch(inputs, report, plan) });
        result = run.attempts.at(-1)!; attempts = run.attempts.map(attempt => attempt.report);
      } else result = await renderCandidate(parsed.values);
      const destination = reportPath ?? (output ? `${output}.production.json` : undefined);
      if (destination) {
        await writeFile(destination, JSON.stringify(result.report, null, 2) + '\n');
        if (attempts) await writeFile(`${destination}.history.json`, JSON.stringify(attempts, null, 2) + '\n');
      } else process.stderr.write(JSON.stringify({ report: result.report, ...(attempts ? { attempts } : {}) }) + '\n');
      try { await requireProduction(result.report, result.bytes, contract); } catch (error) { throw refused((error as Error).message, 'PRODUCTION_VERIFICATION_FAILED'); }
      rendered = result.bytes;
    } else rendered = await renderToolPackageViaWebShell(bytes,id,query,format);
    if (output) await writeFile(output,rendered); else await writeOut(Buffer.from(rendered));
  } finally { await closeBrowser(); await closeWebShell(); }
}
