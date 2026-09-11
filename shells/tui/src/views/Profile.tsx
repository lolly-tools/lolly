// SPDX-License-Identifier: MPL-2.0
/**
 * Profile - your details, persisted on disk (store.ts). They pre-fill tools that
 * declare bindToProfile and, with "embed in exports" on, ride along in export
 * provenance. Edits save immediately.
 */
import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { verifyC2pa, resolveVerdict } from '@lolly/engine';
import { getProfile, setProfile, backupData, listSessions } from '../store.ts';
import { loadTrustAnchors, describeAnchors } from '../trust-anchors.ts';
import { cleanControlChars, verdictHeadline, verdictFacts, verdictChecks } from '@lolly-tools/node-shell/verdict-report';
import { exportSessions } from '../batch-export.ts';
import { loadFavourites, loadHidden } from '../lib/asset-favourites.ts';
import { loadToolFavourites } from '../lib/tool-favourites.ts';
import type { NavTarget } from '../nav.ts';
import type { TuiBridge } from '../bridge.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { Tabs } from '../components/Tabs.tsx';
import { Panel } from '../components/Panel.tsx';
import { Footer } from '../components/Footer.tsx';
import { Progress } from '../components/Progress.tsx';

interface Prog { done: number; total: number; log: string[]; finished: boolean; note?: string }

// One rendered line of the verify report; tones map onto the theme palette.
interface VLine { text: string; tone: 'good' | 'warn' | 'bad' | 'dim' | 'fg' }
interface VReport { path: string; lines: VLine[] }

const V_TONE_COLOR = { good: theme.accentName, warn: theme.warn, bad: theme.danger, dim: theme.dim, fg: theme.fg } as const;

// Every claim/signer string is attacker-controlled bytes from the file being checked -
// strip control chars (incl. ESC) so a crafted manifest can't inject terminal sequences
// or shred the Ink layout. THE scrub is defined once in node-shell/verdict-report and
// shared with the CLI validator and MCP; this is the local alias.
const vclean = cleanControlChars;

interface Field { key: string; label: string; type: 'text' | 'bool' }
const FIELDS: Field[] = [
  { key: 'firstname', label: 'First name', type: 'text' },
  { key: 'lastname', label: 'Last name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'useDetails', label: 'Embed my details in exports', type: 'bool' },
  // Pinned CA roots for `v` (verify) - the terminal's stand-in for the CLI's repeatable
  // --trust-anchor flag, since the TUI has no argv. PATH-style list of PEM paths.
  { key: 'trustAnchors', label: 'Trust anchors (PEM paths, : separated)', type: 'text' },
];

export function Profile({ bridge, onNav, onQuit }: { bridge: TuiBridge; onNav: (t: NavTarget) => void; onQuit: () => void }) {
  const { cols, rows } = useTermSize();
  const [profile, setP] = useState<Record<string, unknown> | null>(null);
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [verifying, setVerifying] = useState(false);   // 'v' - check a file's Content Credentials
  const [vdraft, setVdraft] = useState('');
  const [prog, setProg] = useState<Prog | null>(null); // 'b' - back up + render every project (live)
  const [vreport, setVreport] = useState<VReport | null>(null);   // the full verify report panel
  const [vscroll, setVscroll] = useState(0);
  // Report window height: Tabs(1) + panel borders(2) + the Panel's own title row(1) +
  // footer(1) around the line list - get this wrong by one and Yoga silently collapses
  // the first line (the headline) instead of clipping the last.
  const vInnerH = Math.max(4, rows - 6);

  useEffect(() => { void getProfile().then(setP); }, []);

  function persist(next: Record<string, unknown>): void {
    setP(next);
    setProfile(next).then(() => setStatus('✓ Saved')).catch(e => setStatus('Save failed: ' + (e as Error).message));
  }

  useInput((input, key) => {
    if (!profile) return;
    // While rendering everything, the Progress panel owns the screen - only dismiss it once done.
    if (prog) { if (prog.finished && (key.return || key.escape || input.length > 0)) setProg(null); return; }
    // The verify report owns the screen: j/k scroll, esc/⏎/q close.
    if (vreport) {
      if (key.escape || key.return || input === 'q') { setVreport(null); return; }
      if (key.downArrow || input === 'j') { setVscroll(s => Math.min(Math.max(0, vreport.lines.length - vInnerH), s + 1)); return; }
      if (key.upArrow || input === 'k') { setVscroll(s => Math.max(0, s - 1)); return; }
      return;
    }
    if (editing) { if (key.escape) setEditing(false); return; }
    if (verifying) { if (key.escape) setVerifying(false); return; }
    if (input === '1') return onNav('tools');
    if (input === '2') return onNav('projects');
    if (input === '4') return onNav('catalog');
    if (input === '5') return onNav('system');
    if (input === 'q') return onQuit();
    if (input === 'b') { renderEverything(); return; }
    if (input === 'v') { setVdraft(''); setStatus(''); setVerifying(true); return; }
    if (key.upArrow || input === 'k') { setSel(s => Math.max(0, s - 1)); return; }
    if (key.downArrow || input === 'j') { setSel(s => Math.min(FIELDS.length - 1, s + 1)); return; }
    const f = FIELDS[sel];
    if (!f) return;
    if (f.type === 'bool' && (input === ' ' || key.return)) { persist({ ...profile, [f.key]: !profile[f.key] }); return; }
    if ((key.return || input === 'e') && f.type === 'text') { setDraft(String(profile[f.key] ?? '')); setEditing(true); }
  });

  function commit(raw: string): void {
    setEditing(false);
    const f = FIELDS[sel];
    if (f && profile) persist({ ...profile, [f.key]: raw });
  }
  // Back up my data AND render everything: the portable JSON backup (quick), then a
  // rendered zip of EVERY saved session to its output file - the terminal twin of the web
  // "Export my data & render everything" button. Heavy but explicit; a live Progress panel
  // shows each render as it lands. (Node renders svg/text + html fallback; raster/pdf/video
  // go through the bundled web shell where available - see engine-render.)
  function renderEverything(): void {
    setStatus('');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    void (async () => {
      const sessions = await listSessions();
      if (!sessions.length) { setStatus('No saved projects to render yet - make something first.'); return; }
      setProg({ done: 0, total: sessions.length, log: ['Backing up your data…'], finished: false });
      let backupNote = '';
      try { const r = await backupData(stamp); backupNote = `data backup → ${r.path}`; } catch (e) { backupNote = 'data backup failed: ' + (e as Error).message; }
      setProg(p => ({ done: 0, total: sessions.length, log: [...(p?.log ?? []), `✓ ${backupNote}`, 'Rendering every project…'], finished: false }));
      const onProgress = (done: number, total: number, label: string): void =>
        setProg(p => ({ done, total, log: [...(p?.log ?? []), label], finished: false }));
      exportSessions(bridge.host, bridge.dom, sessions, { name: 'Lolly', onProgress })
        .then(res => setProg(p => ({
          done: res.count, total: p?.total || res.count, log: p?.log ?? [], finished: true,
          note: `✓ Rendered ${res.count} project${res.count === 1 ? '' : 's'} → ${basename(res.zipPath)} in ${dirname(res.zipPath)}`,
        })))
        .catch(e => setProg(p => ({ done: p?.done ?? 0, total: p?.total ?? 0, log: p?.log ?? [], finished: true, note: `✗ ${(e as Error).message}` })));
    })();
  }
  // Verify a file's Content Credentials - the same engine verifier + shared verdict
  // ladder (resolveVerdict) the web /valid view and `lolly validate` render, shown as a
  // full report panel: headline, claim facts, per-check list, then the deep pixel scan.
  // Trust policy matches the CLI validator: the Lolly CA root (includeLollyRoot: true,
  // per plans/cli-ga-contract.md section 12 O1 - a Lolly-CA-signed export now reads the same
  // here as on the web /valid view) PLUS the vendored C2PA list PLUS every root the user
  // pinned (LOLLY_TRUST_ANCHOR / the profile's Trust anchors field - the terminal's
  // stand-in for --trust-anchor, see trust-anchors.ts). The anchor set is printed in the
  // report, so an untrusted verdict is never unexplained.
  function doVerify(path: string): void {
    setVerifying(false);
    const p = path.trim(); if (!p) return;
    setStatus('Verifying…');
    (async () => {
      try {
        const abs = p.startsWith('~') && (p.length === 1 || p[1] === '/') ? homedir() + p.slice(1) : p;
        const bytes = new Uint8Array(await readFile(abs));
        const trust = await loadTrustAnchors(process.env.LOLLY_TRUST_ANCHOR, profile);
        const report = await verifyC2pa(bytes, { trustAnchors: trust.anchors });
        const v = resolveVerdict(report);
        const lines: VLine[] = [];
        const push = (text: string, tone: VLine['tone'] = 'fg'): void => { lines.push({ text, tone }); };
        // Headline + facts + checks all come from the SHARED node-shell renderer
        // (verdict-report.ts), so this panel and `lolly validate` can never again
        // print different words for the same verdict - the drift that started this
        // collapse. The two terminal quirks (parts elevated to a headline; no
        // separate "Verified" line) live in the shared renderer via elevateParts.
        const h = verdictHeadline(v, { elevateParts: true });
        push(h.detail ? `${h.glyph} ${h.name} - ${h.detail}` : `${h.glyph} ${h.name}`, h.tone);
        if (report.reason && report.state !== 'invalid') push(`  ${vclean(report.reason)}`, 'dim');
        if (report.claim) {
          push(report.trusted
            ? '  (fields below are the CA-verified signer’s own claim)'
            : '  (fields below are self-asserted by whoever signed the file)', 'dim');
          for (const [k, val] of verdictFacts(report)) push(`  ${k.padEnd(11)} ${val}`, 'fg');
        }
        for (const chk of verdictChecks(report)) {
          const tone = chk.mark === 'ok' ? 'good' : chk.mark === 'info' ? 'dim' : 'bad';
          const mark = chk.mark === 'ok' ? '✓' : chk.mark === 'info' ? 'ℹ' : '✕';
          push(`  ${mark} ${chk.code} - ${chk.explanation}`, tone);
        }
        // Which anchor set produced that trust line. Without this a user cannot tell an
        // untrusted-by-design verdict from a mis-pinned root.
        for (const l of describeAnchors(trust)) push(l.text, l.warn ? 'warn' : 'dim');
        setVscroll(0);
        setVreport({ path: abs, lines });
        setStatus('');
        // Deep pixel scan (progressive enhancement - needs the Tier-B browser + built
        // dist): the /valid view's own neural decode for Lolly's ?durable=1 mark and
        // foreign TrustMark / Content Seal watermarks. Metadata can be stripped; the
        // durable mark is what still identifies a Lolly export afterwards.
        let appended = false;
        // Replace this report's LAST line, only while it's still the open report. The
        // RESULT lands at the tail, usually below the fold - follow it then (and only
        // then: yanking the view for the interim "running…" line would hide the headline
        // the user is reading during the ~minute the scan takes).
        const swapTail = (line: VLine): void => {
          setVreport(r => r && r.path === abs ? { ...r, lines: [...r.lines.slice(0, appended ? -1 : undefined), line] } : r);
          setVscroll(Math.max(0, (lines.length + 1) - vInnerH));
        };
        try {
          const { browserInstalled } = await import('@lolly-tools/node-shell/browsers');
          if (!browserInstalled() || !/\.(png|jpe?g|webp|gif|tiff?)$/i.test(abs)) return;
          setVreport(r => r && r.path === abs ? { ...r, lines: [...r.lines, { text: '🔍 Deep pixel scan running…', tone: 'dim' }] } : r);
          appended = true;
          const { deepScanViaWebShell } = await import('@lolly-tools/node-shell/webshell-render');
          const d = (await deepScanViaWebShell([abs]))[0];
          swapTail(!d?.scanned ? { text: '○ Deep scan: this file type can’t be pixel-scanned', tone: 'dim' }
            : d.lollyDurable ? { text: '✦ Lolly durable mark decoded from the pixels - survives metadata stripping and re-encoding', tone: 'good' }
            : d.trustmark ? { text: '~ Adobe TrustMark watermark decoded - embedded by another TrustMark-aware tool', tone: 'warn' }
            : d.contentSeal ? { text: '~ Meta Content Seal watermark decoded', tone: 'warn' }
            : { text: '○ Deep scan: no pixel watermark decoded (not proof of absence)', tone: 'dim' });
        } catch (e) {
          swapTail({ text: `! Deep scan unavailable - ${vclean((e as Error).message)}`, tone: 'warn' });
        }
      } catch (e) { setStatus('Verify failed: ' + (e as Error).message); }
    })();
  }

  const favTools = profile ? loadToolFavourites(profile).size : 0;
  const favAssets = profile ? loadFavourites(profile).size : 0;
  const hidAssets = profile ? loadHidden(profile).size : 0;

  if (prog) {
    return (
      <Box flexDirection="column" width={cols} height={rows}>
        <Tabs active="profile" />
        <Progress
          title="Back up + render everything"
          done={prog.done} total={prog.total} log={prog.log}
          width={cols} height={Math.max(6, rows - 3)}
          active finished={prog.finished} note={prog.note}
        />
        <Footer shortcuts={prog.finished ? [{ key: '⏎', label: 'close' }] : [{ key: '…', label: 'rendering every project - keep the terminal open' }]} />
      </Box>
    );
  }

  // The verify report takes over the screen (same idiom as the render-everything panel):
  // headline + facts + checks + deep-scan line, windowed with j/k when it outgrows the panel.
  if (vreport) {
    const win = vreport.lines.slice(vscroll, vscroll + vInnerH);
    const more = vreport.lines.length > vInnerH;
    return (
      <Box flexDirection="column" width={cols} height={rows}>
        <Tabs active="profile" />
        <Panel
          title={`Content Credentials - ${basename(vreport.path)}${more ? ` (${vscroll + 1}–${Math.min(vscroll + vInnerH, vreport.lines.length)}/${vreport.lines.length})` : ''}`}
          width={cols} height={Math.max(6, rows - 3)} active
        >
          {win.map((l, i) => <Text key={vscroll + i} color={V_TONE_COLOR[l.tone]} wrap="truncate-end">{l.text}</Text>)}
        </Panel>
        <Footer shortcuts={[...(more ? [{ key: 'j/k', label: 'scroll' }] : []), { key: 'esc/⏎', label: 'close' }]} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Tabs active="profile" />
      <Box paddingX={1}>
        <Text color={theme.dim} wrap="truncate-end">Pre-fills tools (bindToProfile); optionally embedded in export provenance.</Text>
      </Box>
      <Box paddingX={1}>
        {verifying
          ? (<><Text color={theme.accentName}>Verify file (C2PA): </Text><TextInput value={vdraft} onChange={setVdraft} onSubmit={doVerify} /></>)
          : (
            <Text color={theme.dim} wrap="truncate-end">
              ★ {favTools} tool{favTools === 1 ? '' : 's'}  ·  ★ {favAssets} asset{favAssets === 1 ? '' : 's'}{hidAssets ? `  ·  ${hidAssets} hidden` : ''}  ·  b back up + render all · v verify
            </Text>
          )}
      </Box>
      <Panel title="Your details" width={cols} height={Math.max(FIELDS.length + 2, rows - 6)} active>
        {profile === null ? <Text color={theme.dim}>Loading…</Text> : FIELDS.map((f, i) => {
          const active = i === sel;
          const val = profile[f.key];
          return (
            <Box key={f.key}>
              <Box width={32}><Text color={active ? theme.accentName : undefined} wrap="truncate-end">{active ? '▸ ' : '  '}{f.label}</Text></Box>
              {active && editing && f.type === 'text'
                ? <Box><Text color={theme.accentName}>› </Text><TextInput value={draft} onChange={setDraft} onSubmit={commit} /></Box>
                : <Text color={active ? theme.fg : theme.dim} wrap="truncate-end">{f.type === 'bool' ? (val ? '[x] on' : '[ ] off') : (String(val ?? '') || '-')}</Text>}
            </Box>
          );
        })}
      </Panel>
      <Footer
        note={status || undefined}
        shortcuts={[
          { key: 'j/k', label: 'field' },
          { key: '⏎/e', label: 'edit' },
          { key: 'spc', label: 'toggle' },
          { key: 'b', label: 'back up + render' },
          { key: 'v', label: 'verify' },
          { key: '1/2/4', label: 'tools/proj/catalog' },
          { key: 'q', label: 'quit' },
        ]}
      />
    </Box>
  );
}
