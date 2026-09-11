// SPDX-License-Identifier: MPL-2.0
/** The TUI's design-system room: colour-first, import-first, or add as you go. */
import { useEffect, useState } from 'react';
import { basename, extname } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { createTokenSet, deriveBrandTokens, summarizeTokensDoc } from '@lolly/engine';
import {
  activateNodeDesignSystem, activeNodeDesignSystem, addNodeDesignResources, createNodeDesignSystem,
  exportActiveDesignSystem, listNodeDesignSystems, markNodeStartSeen, readActiveDesignSystemTokens,
  writeNodeDesignSystemTokens,
} from '@lolly-tools/node-shell/design-systems';
import type { NodeDesignSystem } from '@lolly-tools/node-shell/design-systems';
import { importSystemTokens } from '../../../cli/src/system.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { Tabs } from '../components/Tabs.tsx';
import { Footer } from '../components/Footer.tsx';
import type { NavTarget } from '../nav.ts';
import { defaultExportDir } from '../store.ts';

type Mode = 'browse' | 'colour' | 'import' | 'resource' | 'switch';
export type SystemAction = Exclude<Mode, 'browse' | 'switch'>;
interface Summary { tokens: number; colours: number; themes: number; resources: number }

export function System({ onNav, onQuit, initialAction }: {
  onNav: (target: NavTarget) => void;
  onQuit: () => void;
  initialAction?: SystemAction;
}) {
  const { cols, rows } = useTermSize();
  const compact = rows < 24 || cols < 66;
  const [mode, setMode] = useState<Mode>(initialAction ?? 'browse');
  const [draft, setDraft] = useState('');
  const [systems, setSystems] = useState<NodeDesignSystem[]>([]);
  const [active, setActive] = useState<NodeDesignSystem | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [switchSel, setSwitchSel] = useState(0);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  const reload = async (): Promise<void> => {
    const registry = await listNodeDesignSystems();
    const current = registry.systems.find(s => s.id === registry.active) ?? null;
    setSystems(registry.systems);
    setActive(current);
    setSummary(current ? { tokens: 0, colours: 0, themes: 0, resources: current.resources.length } : null);
    if (!current) return;
    const doc = await readActiveDesignSystemTokens();
    try {
      if (doc) {
        const s = summarizeTokensDoc(doc);
        setSummary({ tokens: s.tokenCount, colours: s.colorCount, themes: s.themes.length, resources: current.resources.length });
      }
    } catch { setSummary({ tokens: 0, colours: 0, themes: 0, resources: current.resources.length }); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (initialAction) { setMode(initialAction); setDraft(''); } }, [initialAction]);

  const open = (next: Mode): void => { setMode(next); setDraft(''); setStatus(''); };
  const finish = async (message: string): Promise<void> => {
    await markNodeStartSeen();
    await reload();
    setStatus(message);
    setMode('browse');
    setDraft('');
  };

  const createOrFill = async (label: string, tokens: Record<string, unknown>, source: NodeDesignSystem['source']): Promise<NodeDesignSystem> => {
    // Read at action time: the screen may have been opened before another shell
    // changed the shared store, and a stale React closure must not fork a system.
    const current = await activeNodeDesignSystem();
    return current && !current.tokensFile
      ? writeNodeDesignSystemTokens({ id: current.id, label, tokens, source })
      : createNodeDesignSystem({ label, tokens, source });
  };

  const exportSystem = async (): Promise<void> => {
    setWorking(true);
    try {
      const packed = await exportActiveDesignSystem();
      const dir = defaultExportDir();
      await mkdir(dir, { recursive: true });
      let path = join(dir, packed.filename);
      let n = 2;
      while (existsSync(path)) {
        path = join(dir, packed.filename.replace(/\.lolly$/, `-${n}.lolly`));
        n += 1;
      }
      await writeFile(path, packed.bytes);
      await finish(`✓ Exported ${packed.system.label} to ${path}.`);
    } catch (error) { setStatus((error as Error).message); }
    finally { setWorking(false); }
  };

  const submit = async (value: string): Promise<void> => {
    if (working) return;
    const raw = value.trim();
    if (!raw) { setStatus('Enter a value, or Esc to go back.'); return; }
    setWorking(true);
    try {
      if (mode === 'colour') {
        const current = await activeNodeDesignSystem();
        const label = current && !current.tokensFile ? current.label : 'My design system';
        let doc: Record<string, unknown>;
        try { doc = deriveBrandTokens({ primary: raw, name: label }); }
        catch { setStatus(`Could not read ${raw} as a colour.`); return; }
        const made = await createOrFill(label, doc, { kind: 'colour', name: raw });
        await finish(`✓ ${made.label} is active. Shades and roles were built from ${raw}.`);
      } else if (mode === 'import') {
        const imported = await importSystemTokens(raw);
        createTokenSet(imported.doc); // fail here, beside the chosen file, not on the next render
        const label = imported.label || basename(raw, extname(raw)) || 'Imported design system';
        const made = await createOrFill(label, imported.doc, { kind: 'file', name: basename(raw) });
        await addNodeDesignResources(imported.resources.length
          ? imported.resources
          : [{ name: basename(raw), bytes: imported.bytes }]);
        await finish(`✓ ${made.label} is active${imported.warnings.length ? ` · ${imported.warnings.length} note${imported.warnings.length === 1 ? '' : 's'}` : ''}.`);
      } else if (mode === 'resource') {
        const info = await stat(raw);
        if (!info.isFile()) throw new Error(`${raw} is not a file.`);
        if (info.size > 256 * 1024 * 1024) throw new Error(`${basename(raw)} is larger than the 256 MB local import limit.`);
        const bytes = new Uint8Array(await readFile(raw));
        if (!(await activeNodeDesignSystem())) await createNodeDesignSystem({ label: 'My design system', tokens: null, source: { kind: 'manual' } });
        const made = await addNodeDesignResources([{ name: basename(raw), bytes }]);
        await finish(`✓ Added ${basename(raw)} to ${made.label}.`);
      }
    } catch (error) { setStatus((error as Error).message); }
    finally { setWorking(false); }
  };

  useInput((input, key) => {
    if (working) return;
    if (mode === 'colour' || mode === 'import' || mode === 'resource') {
      if (key.escape) { setMode('browse'); setStatus(''); }
      return;
    }
    if (mode === 'switch') {
      if (key.escape) { setMode('browse'); return; }
      if (key.upArrow || input === 'k') setSwitchSel(i => Math.max(0, i - 1));
      else if (key.downArrow || input === 'j') setSwitchSel(i => Math.min(Math.max(0, systems.length - 1), i + 1));
      else if (key.return) {
        const picked = systems[switchSel];
        if (picked) void activateNodeDesignSystem(picked.id).then(() => finish(`✓ Now using ${picked.label}.`)).catch(e => setStatus((e as Error).message));
      }
      return;
    }
    if (input === '1') return onNav('tools');
    if (input === '2') return onNav('projects');
    if (input === '3') return onNav('profile');
    if (input === '4') return onNav('catalog');
    if (input === 'q') return onQuit();
    if (input === 'c') return open('colour');
    if (input === 'i') return open('import');
    if (input === 'a') return open('resource');
    if (input === 'e') { void exportSystem(); return; }
    if (input === 'u') { setSwitchSel(Math.max(0, systems.findIndex(s => s.id === active?.id))); return open('switch'); }
  });

  const prompt = mode === 'colour' ? 'Colour value'
    : mode === 'import' ? '.lolly, tokens, Penpot, token zip or SVG path'
      : 'Logo, font, PDF, image or reference path';

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Tabs active="system" />
      <Box marginX={1} marginTop={compact ? 0 : 1} paddingX={2} paddingY={compact ? 0 : 1} borderStyle="round" borderColor={theme.accentName} flexDirection="column" flexGrow={1}>
        {compact ? null : <Text bold color={theme.accentName}>DESIGN SYSTEM</Text>}
        <Box flexShrink={0} flexDirection="column">
          <Text bold>Start with what you have.</Text>
          <Text color={theme.dim}>{compact ? 'One colour, a complete file, or add things as they arrive.' : 'One colour is enough. A complete file works too; add everything else whenever it arrives.'}</Text>
        </Box>
        {compact ? null : <Text> </Text>}
        {active ? (
          <Box flexDirection="column" flexShrink={0}>
            <Text><Text color={theme.accentName}>●</Text> <Text bold>{active.label}</Text> <Text color={theme.dim}>({active.id})</Text></Text>
            <Text color={theme.dim}>{summary ? `${summary.colours} colours · ${summary.tokens} tokens · ${summary.themes} themes · ${summary.resources} resources` : 'Reading…'}</Text>
          </Box>
        ) : <Text color={theme.dim}>No active terminal design system. Tools still work with the bundled defaults.</Text>}
        {compact ? null : <Text> </Text>}
        {mode === 'browse' ? (
          <Box flexDirection="column" flexShrink={0}>
            <Text><Text bold color={theme.accentName}>c</Text>  One colour      <Text color={theme.dim}>{compact ? 'build shades + roles' : 'build shades and roles, then keep moving'}</Text></Text>
            <Text><Text bold color={theme.accentName}>i</Text>  Bring a file    <Text color={theme.dim}>{compact ? '.lolly · tokens · Penpot · SVG' : '.lolly · JSON · Penpot · token zip · SVG'}</Text></Text>
            <Text><Text bold color={theme.accentName}>a</Text>  Add a resource  <Text color={theme.dim}>{compact ? 'logo · font · PDF · image' : 'logo · font · PDF · image · anything in between'}</Text></Text>
            <Text><Text bold color={theme.accentName}>e</Text>  Export .lolly   <Text color={theme.dim}>{compact ? 'tokens + retained resources' : 'portable tokens plus every retained resource'}</Text></Text>
            <Text><Text bold color={theme.accentName}>u</Text>  Switch system   <Text color={theme.dim}>{systems.length} on this device</Text></Text>
          </Box>
        ) : mode === 'switch' ? (
          <Box flexDirection="column" flexShrink={0}>
            <Text bold>Choose a system</Text>
            {systems.map((system, i) => (
              <Text key={system.id} inverse={i === switchSel}>{i === switchSel ? '›' : ' '} {system.label}  <Text color={theme.dim}>{system.id}</Text></Text>
            ))}
            {!systems.length ? <Text color={theme.dim}>Nothing to switch to yet.</Text> : null}
          </Box>
        ) : (
          <Box flexDirection="column" flexShrink={0}>
            <Text bold>{prompt}</Text>
            <Box borderStyle="single" borderColor={status ? theme.warn : theme.accentName} paddingX={1} flexShrink={0}>
              <Text>{working ? 'Working… ' : '› '}</Text>
              <TextInput value={draft} onChange={setDraft} onSubmit={value => void submit(value)} focus={!working} />
            </Box>
            <Text color={theme.dim}>{mode === 'colour'
              ? (compact ? 'Try #7c3aed, rgb(124 58 237), or oklch(54% .25 293).' : 'Examples: #7c3aed · rgb(124 58 237) · oklch(54% .25 293)')
              : (compact ? 'Existing material changes only after this succeeds.' : 'Nothing is removed or replaced until this import succeeds.')}</Text>
          </Box>
        )}
        {status ? <Box marginTop={1}><Text color={status.startsWith('✓') ? theme.accentName : theme.warn}>{status}</Text></Box> : null}
      </Box>
      <Footer shortcuts={mode === 'browse'
        ? [{ key: 'c', label: 'colour' }, { key: 'i', label: 'import' }, { key: 'a', label: 'add' }, { key: 'e', label: 'export' }, { key: 'u', label: 'switch' }, { key: 'q', label: 'quit' }]
        : [{ key: 'enter', label: 'continue' }, { key: 'esc', label: 'back' }]} />
    </Box>
  );
}
