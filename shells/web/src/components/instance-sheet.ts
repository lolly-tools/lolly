// SPDX-License-Identifier: MPL-2.0
/**
 * Instance sheet - point this installed shell at a remote Lolly deployment
 * (or back to what's bundled), and optionally pull your data across from a
 * portable backup at the same time. Built on mountModal (components/modal.ts
 * - Escape/backdrop dismissal, focus containment, teardown) with the shared
 * `.modal-*` / `.btn--*` / `.field-input` / `.note` chrome already global
 * (dialogs.css / buttons.css / components.css) - only the sheet's own layout
 * (choice cards, field rows, probe/summary lines) gets its own small sheet
 * (styles/parts/instance-sheet.css, imported below like welcome.css).
 *
 * Two callers:
 *  - main.ts's boot(), first run only, via maybeShowFirstRunInstanceSheet:
 *    Tauri shells, gated on no persisted choice yet (hasMadeInstanceChoice)
 * - awaited before the first catalog sync so a chosen instance is
 *    honoured immediately, and a no-op (one IndexedDB read) everywhere else.
 *  - views/profile.ts's "Change" button, calling openInstanceSheet directly,
 *    any time, to switch instances later (the "asked" flag is already set by
 *    then, so it's not re-marked - see `firstRun` below).
 *
 * The instance base itself (getInstanceBase/setInstanceBase/instanceFetch/
 * normalizeInstanceBase) lives in lib/instance.ts, a fixed contract from the
 * parallel core package - this module only adds the UI, plus the "has the
 * user been asked yet" flag, persisted the exact same way that module
 * persists the base itself: the IndexedDB 'profile' KV store, never
 * localStorage (house rule - no localStorage for state).
 *
 * Connecting to another instance is a trust decision, not just a URL field:
 * a connected instance's tool code runs exactly like a bundled tool's (same
 * hooks.js execution model - see runtime.ts's own header on that). The sheet
 * says so plainly rather than burying it; there is no technical sandbox
 * behind that sentence yet.
 */
import '../styles/parts/instance-sheet.css';
import { t, tRaw } from '../i18n.ts';
import { escape, NAV_EVENTS } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { mountModal } from './modal.ts';
import { markInstanceChoiceMade } from '../lib/instance-choice.ts';
import { getInstanceBase, setInstanceBase, instanceFetch } from '../lib/instance.ts';
import { validateInstanceUrl, shapeProbeResult, shapeInstanceManifest, type ProbeOutcome, type ManifestOutcome } from '../lib/instance-probe.ts';
import { syncCatalog } from '../catalog/sync.ts';
import { importBackup, MAX_RESTORE_TOTAL_BYTES } from '../data-transfer.ts';
import { backupHistoryNote } from '../lib/backup-summary.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';


// validateInstanceUrl / shapeProbeResult (the pure URL-validation and probe-
// shaping logic) live in lib/instance-probe.ts - unit-tested there, in
// instance-sheet.test.ts, with no DOM/CSS dependency (see that file's header).

/**
 * Read a fetched backup's body capped at `MAX_RESTORE_TOTAL_BYTES` - the same
 * ceiling data-transfer.ts's own zip-bomb guard applies to the INFLATED
 * contents, applied here to the raw (still-compressed) download too, so a
 * hostile/oversized/never-ending response can't be buffered into memory before
 * that guard ever gets a chance to run. Aborts mid-stream once the cap is
 * exceeded (never buffer-then-check) - same discipline as the Android share
 * intake's readShareCapped. Falls back to a plain arrayBuffer() read when the
 * response has no body stream to read incrementally (defensive; every real
 * fetch/instanceFetch response has one).
 */
async function readCapped(resp: Response): Promise<ArrayBuffer> {
  const declared = Number(resp.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESTORE_TOTAL_BYTES) {
    throw new Error(t('That backup is too large to import ({size}).', { size: `${Math.round(declared / (1024 * 1024))} MB` }));
  }
  const reader = resp.body?.getReader();
  if (!reader) return resp.arrayBuffer();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESTORE_TOTAL_BYTES) {
      await reader.cancel().catch(() => { /* best-effort */ });
      throw new Error(t('That backup is too large to import.'));
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out.buffer;
}

function probeErrorMessage(outcome: Extract<ProbeOutcome, { ok: false }>): string {
  if (outcome.reason === 'http') return t('That instance responded with an error ({status}).', { status: outcome.status });
  if (outcome.reason === 'parse') return t("Couldn't read that instance's response.");
  return t("That doesn't look like a Lolly catalogue (no tools list).");
}

// ── The sheet itself ─────────────────────────────────────────────────────────

type Step =
  | { kind: 'choose' }
  | { kind: 'connect'; url: string; error?: string; probing: boolean; probed?: { base: string; toolCount: number; manifest?: ManifestOutcome } }
  | { kind: 'import'; url: string; busy: boolean; error?: string; summary?: string };

/**
 * Open the instance sheet. Resolves once the user is done - any way (Escape,
 * backdrop, or reaching the end of the flow). Callers that show a status
 * (profile.ts) should just re-render afterwards, reading getInstanceBase()
 * fresh; nothing here reports which path the user took beyond that.
 *
 * `firstRun` marks the "asked" flag on close (any close counts as settled - 
 * same convention as showWelcomeDialog: a dismissal is still an answer) and
 * swaps in slightly different framing copy for the very first sheet a user
 * ever sees. Omit it (the profile "Change"/first re-open case) to leave the
 * flag alone - it's already set.
 */
export function openInstanceSheet(host: HostV1, opts: { firstRun?: boolean } = {}): Promise<void> {
  const firstRun = !!opts.firstRun;
  return new Promise((resolve) => {
    let step: Step = { kind: 'choose' };

    const modal = mountModal<void>(renderStep(), {
      className: 'instance-sheet',
      ariaLabel: t('Lolly instance'),
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="choose-bundled"]') ?? el.querySelector<HTMLElement>('button, input'),
      onClose: async () => {
        NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNav));
        if (firstRun) await markInstanceChoiceMade();
        resolve();
      },
    });
    const onNav = (): void => modal.close();
    NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNav));

    function repaint(focusSel?: string): void {
      if (!modal.el.isConnected) return; // already closed (e.g. a navigation mid-async-op)
      modal.el.innerHTML = renderStep();
      if (focusSel) modal.el.querySelector<HTMLElement>(focusSel)?.focus();
    }

    function renderStep(): string {
      if (step.kind === 'choose') return renderChoose();
      if (step.kind === 'connect') return renderConnect(step);
      return renderImport(step);
    }

    function renderChoose(): string {
      const current = getInstanceBase();
      return `
        <h2 class="modal-title">${t('Where should Lolly get its tools?')}</h2>
        <p class="modal-msg">${firstRun
          ? t('Choose once - you can change this later from your profile.')
          : t('Choose what this install reads its catalogue and tools from.')}</p>
        <div class="instance-choices">
          <button type="button" class="instance-choice" data-act="choose-bundled">
            <span class="instance-choice-icon">${icon('package', { size: 20 })}</span>
            <span>
              <span class="instance-choice-title">${t('Use what is bundled with this app')}</span>
              <span class="instance-choice-sub">${t('The tools shipped in this install. Works offline, no setup.')}</span>
            </span>
          </button>
          <button type="button" class="instance-choice" data-act="choose-connect">
            <span class="instance-choice-icon">${icon('link', { size: 20 })}</span>
            <span>
              <span class="instance-choice-title">${t('Connect to a Lolly instance')}</span>
              <span class="instance-choice-sub">${t('Point this app at another Lolly deployment for its catalogue and tools.')}</span>
            </span>
          </button>
        </div>
        <p class="note note--warning">${t('Tools from a connected instance run with the same trust as bundled ones - connect only to instances you trust.')}</p>
        ${current ? `<p class="modal-msg">${t('Currently connected to {base}.', { base: current })}</p>` : ''}
      `;
    }

    function renderConnect(s: Extract<Step, { kind: 'connect' }>): string {
      // The instance card (plans/34 wave 1a server-side): what the deployment
      // says about itself before anyone signs in. Absent for a plain Lolly
      // deployment - the tool count line is then the whole story, as before.
      const m = s.probed?.manifest;
      const card = m?.found
        ? `<div class="instance-probe instance-probe--ok" style="text-align:left">
            <strong>${escape(m.name)}</strong>
            ${m.accessMode === 'gated' || m.accessMode === 'per-tool'
              ? `<div>${m.providerName
                  ? t('Sign-in required (via {provider}).', { provider: m.providerName })
                  : t('Sign-in required.')}</div>`
              : ''}
            ${m.engineVersion ? `<div>${t('Serves engine {version}.', { version: m.engineVersion })}</div>` : ''}
            ${m.packUrl ? `<div>${t('Offers a setup pack - your organisation may have sent you its .lolly file directly.')}</div>` : ''}
          </div>`
        : '';
      const probe = s.probed
        ? `${card}<p class="instance-probe instance-probe--ok">${t('✓ Found {n} tools at {base}.', { n: s.probed.toolCount, base: s.probed.base })}</p>`
        : '';
      const err = s.error ? `<p class="instance-probe instance-probe--err">${escape(s.error)}</p>` : '';
      return `
        <h2 class="modal-title">${t('Connect to a Lolly instance')}</h2>
        <p class="modal-msg">${t('Enter the web address of the Lolly deployment to use.')}</p>
        <div class="instance-field-row">
          <input type="url" class="field-input field-input--mono" id="instance-url" placeholder="https://your-instance.example.com" value="${escape(s.url)}" inputmode="url" autocomplete="off" spellcheck="false">
        </div>
        ${err}${probe}
        <p class="note note--warning">${t('Tools from a connected instance run with the same trust as bundled ones - connect only to instances you trust.')}</p>
        <div class="modal-actions">
          <button type="button" class="btn" data-act="connect-back">${t('Back')}</button>
          ${s.probed
            ? `<button type="button" class="btn btn--primary" data-act="connect-confirm">${t('Use this instance')}</button>`
            : `<button type="button" class="btn btn--primary" data-act="connect-probe"${s.probing ? ' disabled' : ''}>${s.probing ? t('Checking…') : t('Check & connect')}</button>`}
        </div>
      `;
    }

    function renderImport(s: Extract<Step, { kind: 'import' }>): string {
      const err = s.error ? `<p class="instance-probe instance-probe--err">${escape(s.error)}</p>` : '';
      const summary = s.summary ? `<p class="instance-summary">${escape(s.summary)}</p>` : '';
      return `
        <h2 class="modal-title">${t('Import your data (optional)')}</h2>
        <p class="modal-msg">${t('Bring your saved sessions, images and profile across from a Lolly backup zip - from a link, or a file on this device.')}</p>
        <div class="instance-field-row">
          <input type="url" class="field-input field-input--mono" id="instance-import-url" placeholder="https://…/LollyTools-backup.zip" value="${escape(s.url)}" inputmode="url" autocomplete="off" spellcheck="false">
          <button type="button" class="btn" data-act="import-url"${s.busy ? ' disabled' : ''}>${t('Fetch')}</button>
        </div>
        <div class="instance-import-or">${t('or')}</div>
        <div class="modal-actions" style="justify-content:flex-start">
          <button type="button" class="btn" data-act="import-file"${s.busy ? ' disabled' : ''}>${t('Choose a file…')}</button>
          <input type="file" id="instance-import-file" accept=".zip,application/zip" hidden>
        </div>
        ${err}${summary}
        <div class="modal-actions">
          <button type="button" class="btn btn--primary" data-act="import-done">${s.summary ? t('Done') : t('Skip')}</button>
        </div>
      `;
    }

    function goImportStep(): void {
      step = { kind: 'import', url: '', busy: false };
      // Seeding focus into the URL field pops the soft keyboard over the sheet
      // before any intent to type (seen on the Android first run); touch users
      // tap the field themselves. Mirrors search-bar.ts's fine-pointer gate.
      repaint(window.matchMedia?.('(pointer: fine)').matches ? '#instance-import-url' : undefined);
    }

    async function runImport(bytes: ArrayBuffer): Promise<void> {
      if (step.kind !== 'import') return;
      step = { ...step, busy: true, error: undefined };
      repaint();
      try {
        const summary = await importBackup(
          { host: host as unknown as Parameters<typeof importBackup>[0]['host'], storage: localStorage },
          bytes,
        );
        const line = tRaw('Imported {sessions} and {images}', {
          sessions: summary.sessions === 1 ? t('1 session') : t('{n} sessions', { n: summary.sessions }),
          images: summary.userAssets === 1 ? t('1 image') : t('{n} images', { n: summary.userAssets }),
        }) + backupHistoryNote(summary)
          + (summary.failedAssets ? ` · ${t('{n} assets could not be restored. Keep your backup.', { n: summary.failedAssets })}` : '')
          + (summary.skipped ? ` · ${t('{n} unsupported backup parts skipped', { n: summary.skipped })}` : '');
        announce(line, summary.failedAssets || summary.failedHistory ? { assertive: true } : undefined);
        if (step.kind === 'import') step = { ...step, busy: false, summary: line };
      } catch (e) {
        if (step.kind === 'import') step = { ...step, busy: false, error: e instanceof Error ? e.message : String(e) };
      }
      repaint();
    }

    modal.el.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const act = target?.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (!act) return;

      if (act === 'choose-bundled') { goImportStep(); return; }
      if (act === 'choose-connect') { step = { kind: 'connect', url: '', probing: false }; repaint('#instance-url'); return; }
      if (act === 'connect-back') { step = { kind: 'choose' }; repaint(); return; }

      if (act === 'connect-probe') {
        if (step.kind !== 'connect') return;
        const raw = modal.el.querySelector<HTMLInputElement>('#instance-url')?.value ?? '';
        const valid = validateInstanceUrl(raw);
        if (!valid.ok) { step = { ...step, url: raw, error: valid.message, probed: undefined }; repaint('#instance-url'); return; }
        step = { ...step, url: raw, error: undefined, probing: true, probed: undefined };
        repaint();
        void (async () => {
          try {
            // The catalog probe decides; the optional instance manifest only
            // enriches the card (a plain deployment has none - not an error).
            const [resp, manifest] = await Promise.all([
              instanceFetch(`${valid.base}/catalog/tools/index.json`),
              (async (): Promise<ManifestOutcome> => {
                try {
                  const r = await instanceFetch(`${valid.base}/api/v1/instance`);
                  let mBody: unknown;
                  try { mBody = await r.json(); } catch { mBody = undefined; }
                  return shapeInstanceManifest(r.status, r.ok, mBody);
                } catch {
                  return { found: false };
                }
              })(),
            ]);
            let body: unknown;
            try { body = await resp.json(); } catch { body = undefined; }
            const outcome = shapeProbeResult(resp.status, resp.ok, body);
            if (step.kind !== 'connect') return;
            step = outcome.ok
              ? { ...step, probing: false, probed: { base: valid.base, toolCount: outcome.toolCount, manifest } }
              : { ...step, probing: false, error: probeErrorMessage(outcome) };
          } catch (e) {
            if (step.kind !== 'connect') return;
            step = { ...step, probing: false, error: e instanceof Error ? e.message : String(e) };
          }
          repaint();
        })();
        return;
      }

      if (act === 'connect-confirm') {
        if (step.kind !== 'connect' || !step.probed) return;
        const base = step.probed.base;
        void (async () => {
          await setInstanceBase(base);
          try {
            // "sync's public resync/bust entry" - the same exported function
            // gallery.ts's own empty-catalog retry button calls.
            await syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]);
          } catch { /* offline - sync falls back to cache; the instance is still set */ }
          window.dispatchEvent(new Event('lolly:remount'));
          announce(tRaw('Connected to {base}.', { base }));
          goImportStep();
        })();
        return;
      }

      if (act === 'import-file') { modal.el.querySelector<HTMLInputElement>('#instance-import-file')?.click(); return; }

      if (act === 'import-url') {
        if (step.kind !== 'import') return;
        const url = modal.el.querySelector<HTMLInputElement>('#instance-import-url')?.value.trim() ?? '';
        if (!url) return;
        void (async () => {
          try {
            const resp = await instanceFetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            await runImport(await readCapped(resp));
          } catch (e) {
            if (step.kind === 'import') step = { ...step, error: e instanceof Error ? e.message : String(e) };
            repaint();
          }
        })();
        return;
      }

      if (act === 'import-done') { modal.close(); return; }
    });

    // 'change' bubbles (unlike 'input'), so this delegated listener survives
    // every repaint()'s innerHTML replacement same as the click listener above.
    modal.el.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.id !== 'instance-import-file') return;
      const file = input.files?.[0];
      input.value = ''; // let the same file be re-picked later
      if (!file) return;
      void file.arrayBuffer().then(runImport);
    });
  });
}

/* maybeShowFirstRunInstanceSheet + the isTauriShell/hasMadeInstanceChoice
 * probes it gates on now live in lib/instance-choice.ts, a leaf module main.ts
 * can import for ~0 bytes; it dynamic-imports this file only when the sheet is
 * actually shown. See that file's header. Re-exported here so the historical
 * import path keeps working. */
export { isTauriShell, hasMadeInstanceChoice, maybeShowFirstRunInstanceSheet } from '../lib/instance-choice.ts';
