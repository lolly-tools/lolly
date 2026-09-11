// SPDX-License-Identifier: MPL-2.0
import { useEffect, useRef, useState } from 'react';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { inspectPreparation, applyPreparation, preparationRecipe, readPreparationRecipe, applyPreparationMetadata } from '@lolly/engine';
import type { PreparationSource, PreparationInspection, PreparationResult, PreparationRule } from '@lolly-tools/core/host-v1';
import { readPreparationSources, savePreparationCopies } from '../../../cli/src/prepare.ts';
import { useTermSize } from '../hooks.ts';
import type { TuiBridge } from '../bridge.ts';
const printable = (value: string): string => [...value.slice(0, 300)].map(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159 ? ' ' : c).join('');
type Mode = 'paths' | 'review' | 'replace' | 'literal' | 'field' | 'load-recipe' | 'save-recipe' | 'output' | 'result';
export function Prepare({ bridge, onBack }: { bridge: TuiBridge; onBack: () => void }) {
  const { rows } = useTermSize();
  const [mode, setMode] = useState<Mode>('paths'), [draft, setDraft] = useState(''), [paths, setPaths] = useState<string[]>([]);
  const [sources, setSources] = useState<PreparationSource[]>([]), [inspection, setInspection] = useState<PreparationInspection>();
  const [rules, setRules] = useState<PreparationRule[]>([]), [categories, setCategories] = useState<string[]>();
  const [choices, setChoices] = useState<Record<string, string>>({}), [remove, setRemove] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<string[]>([]);
  const [selection, setSelection] = useState(0), [members, setMembers] = useState(false), [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<PreparationResult>(), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const work = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => work.current?.abort(), []);
  const run = async (fn: (signal: AbortSignal) => Promise<void>): Promise<void> => {
    work.current?.abort(); const controller = new AbortController(); work.current = controller; setBusy(true);
    try { await fn(controller.signal); }
    catch { if (work.current === controller) setStatus(controller.signal.aborted ? 'Cancelled. Originals are unchanged.' : 'Could not finish. Check input or output paths. Originals and completed copies are retained.'); }
    finally { if (work.current === controller) setBusy(false); }
  };
  const inspect = (newRules = rules, newCategories: string[] | null | undefined = categories): Promise<void> => run(async signal => {
    const files = sources.length ? sources : await readPreparationSources(paths, signal);
    const found = await inspectPreparation(files, newRules, { signal, progress: p => setStatus(`Inspecting ${p.completed}/${p.total}`) }); signal.throwIfAborted();
    setSources(files); setInspection(found); setChoices(Object.fromEntries(found.groups.filter(g => !newCategories || newCategories.includes(g.category)).map(g => [g.id, g.replacement])));
    setRemove([]); setSelection(0); setReveal(false); setMode('review'); setStatus('Suggestions are optional. Space keeps or replaces; Enter builds copies for review.');
  });
  const apply = (unchanged = false): Promise<void> => run(async signal => {
    if (!inspection) return;
    let output = await applyPreparation(sources, inspection, unchanged ? [] : Object.entries(choices).map(([groupId, replacement]) => ({ groupId, replacement })), unchanged ? [] : remove, { signal, progress: p => setStatus(`Inspecting resulting bytes ${p.completed}/${p.total}`) });
    if (!unchanged && metadata.length) output = await applyPreparationMetadata(output, metadata, bridge.host.pdf, { signal });
    signal.throwIfAborted(); setResult(output); setMode('result'); setStatus('Copies ready in memory. D downloads; C copies the first text result; E returns to choices.');
  });
  const edit = (next: Mode, value = ''): void => { setDraft(value); setMode(next); };
  const submit = async (): Promise<void> => {
    if (mode === 'paths') { if (draft.trim()) { setPaths(p => [...p, draft.trim()]); setDraft(''); } else await inspect(); return; }
    if (mode === 'replace') { const g = inspection?.groups[selection]; if (g) setChoices(c => ({ ...c, [g.id]: draft })); setMode('review'); return; }
    if (mode === 'literal' || mode === 'field') {
      const next = [...rules, { id: `custom-${rules.length}`, label: 'Custom rule', kind: mode, value: draft }]; setRules(next); await inspect(next); return;
    }
    await run(async signal => {
      if (mode === 'load-recipe') {
        if ((await stat(draft)).size > 65536) throw new Error();
        const recipe = readPreparationRecipe(JSON.parse(await readFile(draft, 'utf8')));
        signal.throwIfAborted(); const next = recipe.fields.map((value, i) => ({ id: `field-${i}`, kind: 'field' as const, label: 'Custom field', value }));
        setCategories(recipe.categories); setRules(next); setMode('review'); setStatus('Recipe loaded. Press I to inspect with these settings.');
        setInspection(undefined); setChoices({}); setResult(undefined);
      } else if (mode === 'save-recipe') {
        await writeFile(draft, JSON.stringify(preparationRecipe(inspection?.groups.filter(g => choices[g.id] !== undefined).map(g => g.category) ?? [], rules), null, 2), { flag: 'wx', mode: 0o600 });
        setMode('review'); setStatus('Recipe saved without private values or mappings.');
      } else if (mode === 'output' && result) {
        const delivery = await savePreparationCopies(result, draft); setMode('result');
        setStatus(`${delivery.filter(d => d.saved).length}/${delivery.length} copies saved. Existing files were kept. D retries to a new directory.`);
      }
    });
  };
  useInput((input, key) => {
    if (key.escape) { if (busy) work.current?.abort(); else if (mode !== 'review' && mode !== 'paths' && mode !== 'result') setMode('review'); else onBack(); return; }
    if (busy || !['review', 'result'].includes(mode)) return;
    if (mode === 'result') {
      if (input === 'd') edit('output');
      if (input === 'e') { setResult(undefined); setMode('review'); }
      if (input === 'c') void run(async () => {
        const first = result?.outputs[0]; if (!first || first.bytes.length > 1024 * 1024 || !result?.inspection.scopes.some(s => s.id === first.id && ['text', 'yaml', 'json', 'har'].includes(s.format))) throw new Error();
        await bridge.host.clipboard.writeText(new TextDecoder('utf-8', { fatal: true }).decode(first.bytes)); setStatus('First text result copied.');
      });
      return;
    }
    const list = members ? inspection?.scopes ?? [] : inspection?.groups ?? [];
    if (key.upArrow) setSelection(s => Math.max(0, s - 1));
    if (key.downArrow) setSelection(s => Math.min(list.length - 1, s + 1));
    if (key.tab) { setMembers(v => !v); setSelection(0); setReveal(false); }
    if (input === 'm' && members) { const scope = inspection?.scopes[selection]; if (scope?.id === scope?.sourceId && scope && ['pdf', 'png', 'jpg', 'jpeg', 'svg'].includes(scope.format)) setMetadata(ids => ids.includes(scope.id) ? ids.filter(id => id !== scope.id) : [...ids, scope.id]); }
    if (input === 'v') setReveal(v => !v);
    if (input === ' ') {
      if (members) { const scope = inspection?.scopes[selection]; if (scope && scope.id !== scope.sourceId) setRemove(r => r.includes(scope.id) ? r.filter(id => id !== scope.id) : [...r, scope.id]); }
      else { const g = inspection?.groups[selection]; if (g) setChoices(c => { const next = { ...c }; if (next[g.id] !== undefined) delete next[g.id]; else next[g.id] = g.replacement; return next; }); }
    }
    if (input === 'r' && !members) edit('replace', choices[inspection?.groups[selection]?.id ?? ''] ?? '');
    if (input === 'k') { setChoices({}); setRemove([]); }
    if (input === 'u') void apply(true);
    if (input === 'i') void inspect();
    if (input === 'x') { setRules([]); setCategories(undefined); void inspect([], null); }
    if (input === 'a') edit('literal'); if (input === 'f') edit('field');
    if (input === 'l') edit('load-recipe'); if (input === 's') edit('save-recipe');
    if (key.return) void apply();
  });
  const visible = Math.max(2, rows - 13), start = Math.max(0, selection - visible + 1);
  return <Box flexDirection="column" paddingX={1}>
    <Text bold>Prepare for sharing</Text><Text>On this device · private working values stay in memory · Esc {busy ? 'cancels' : 'back'}</Text>
    {mode === 'paths' ? <Text>Add a file path, Enter; repeat for multiple files. Empty Enter inspects. {paths.length} file(s).</Text> : null}
    {!['review', 'result'].includes(mode) && !busy ? <Box flexDirection="column"><Text>{mode === 'paths' ? 'File path:' : mode === 'replace' ? 'Replacement:' : mode === 'literal' ? 'Missed exact value:' : mode === 'field' ? 'Sensitive field name:' : 'Recipe file / result directory:'}</Text><TextInput value={draft} onChange={setDraft} onSubmit={() => { void submit(); }} /></Box> : null}
    {mode === 'review' && !members ? inspection?.groups.slice(start, start + visible).map((g, i) => <Text key={g.id} inverse={start + i === selection}>{start + i === selection ? '›' : ' '} {choices[g.id] !== undefined ? 'replace' : 'keep'} · {g.category} · {g.count} occurrences{reveal && start + i === selection ? ` · ${printable(g.value)} → ${printable(choices[g.id] ?? g.value)}` : ''}</Text>) : null}
    {mode === 'review' && members ? inspection?.scopes.slice(start, start + visible).map((s, i) => <Text key={s.id} inverse={start + i === selection}>{remove.includes(s.id) ? 'remove' : 'keep'} · {s.status} · {metadata.includes(s.id) ? 'strip metadata · ' : ''}{printable(s.path)}{start + i === selection ? ` · ${s.limitations.join(' ')}` : ''}</Text>) : null}
    {mode === 'review' ? <Text>↑↓ select · Space toggle · Tab members · M metadata · V reveal · R replacement · K keep all · U unchanged · A missed value · F field · L/S recipe · X clear rules · Enter preview</Text> : null}
    {mode === 'result' && result ? <Box flexDirection="column"><Text>{result.report.replaced} changed/removed · {result.report.remaining} output suggestions (including possible placeholders).</Text><Text>{result.report.scopes.filter(s => s.status !== 'inspected').length} partial/uninspected scopes. Review with E then Tab. D downloads copies; C copies first text.</Text></Box> : null}
    <Text wrap="wrap">{status}</Text><Text dimColor>Patterns can miss private content. PDF/image inspection and visible redaction use the existing utilities.</Text>
  </Box>;
}
