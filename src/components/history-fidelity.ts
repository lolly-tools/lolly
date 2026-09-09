// SPDX-License-Identifier: MPL-2.0
import type { RevisionEntry } from '../bridge/revision-history.ts';
import type { RevisionAssetReport, RevisionAssetReplacement, RevisionAssetStatus, RevisionFidelityAPI } from '../bridge/revision-fidelity.ts';
import type { SavedStateData } from '../bridge/state.ts';
import { t } from '../i18n.ts';
import './history-fidelity.css';

const button = (label: string): HTMLButtonElement => {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'btn'; el.textContent = label; return el;
};
const paragraph = (label: string): HTMLParagraphElement => {
  const el = document.createElement('p'); el.textContent = label; return el;
};
function statusText(asset: RevisionAssetStatus): string {
  switch (asset.status) {
    case 'saved': return t('Saved file available on this device');
    case 'current': return t('Uses the current asset; appearance can change');
    case 'missing': return asset.version ? t('Saved asset version unavailable on this device') : t('Asset unavailable on this device');
    case 'embedded': return t('Embedded in this version');
    case 'invalid': return t('This asset reference could not be read');
    default: return t('Cannot verify this asset locally');
  }
}

/** A single inspector per panel. Opening a row never reads its inputs until the
 * user asks; changing pages invalidates results and releases the previous view. */
export function mountHistoryFidelity(api: RevisionFidelityAPI, openCopy: (entry: RevisionEntry, data: SavedStateData) => Promise<void>): {
  action(entry: RevisionEntry, article: HTMLElement): HTMLButtonElement;
  clear(): void;
} {
  const buttons = new Set<HTMLButtonElement>();
  let generation = 0, busy = false;
  let active: { section: HTMLElement; trigger: HTMLButtonElement } | undefined;
  const dismiss = (): void => {
    generation++;
    active?.section.remove(); active?.trigger.setAttribute('aria-expanded', 'false'); active = undefined;
  };
  const lock = (value: boolean): void => { busy = value; for (const el of buttons) el.disabled = value; };
  const render = (section: HTMLElement, entry: RevisionEntry, report: RevisionAssetReport, token: number): void => {
    const missing = report.assets.filter(asset => asset.status === 'missing' || asset.status === 'invalid').length;
    const summary = paragraph(missing ? t('Some assets need attention') : report.assets.length ? t('Asset check complete') : t('No saved asset references found'));
    summary.className = 'revision-history-fidelity-summary'; summary.setAttribute('role', 'status');
    section.append(summary);
    section.append(paragraph(t('This checks local file availability. Fonts, brand settings, linked content and tool updates may still change the result.')));
    if (report.truncated) section.append(paragraph(t('Only part of this version could be checked. Open a copy to review all assets in the tool.')));
    const list = document.createElement('ul');
    const choices = new Map<string, RevisionAssetReplacement>();
    const repair = button(t('Open copy with selected assets')); repair.disabled = true;
    let creating = false;
    for (const asset of report.assets) {
      const item = document.createElement('li');
      const name = document.createElement('strong'); name.textContent = asset.label.length > 160 ? `${asset.label.slice(0, 160)}…` : asset.label;
      item.append(name, paragraph(statusText(asset)));
      if (asset.version) item.append(paragraph(t('Saved version: {version}', { version: asset.version })));
      if (asset.replacement && !report.truncated) {
        const label = document.createElement('label'); label.className = 'revision-history-fidelity-choice';
        const input = document.createElement('input'); input.type = 'checkbox';
        const text = document.createTextNode(t('Use current version {version} in copy', { version: asset.replacement.version }));
        input.addEventListener('change', () => {
          if (input.checked) choices.set(asset.key, asset.replacement!); else choices.delete(asset.key);
          repair.disabled = creating || choices.size === 0;
        });
        label.append(input, text); item.append(label);
      }
      list.append(item);
    }
    section.append(list);
    if (!report.truncated && report.assets.some(asset => asset.replacement)) {
      section.append(paragraph(t('Selected assets replace missing versions in a new copy. Your saved version stays unchanged.')));
      const error = paragraph(''); error.hidden = true; error.setAttribute('role', 'alert');
      repair.addEventListener('click', async () => {
        if (creating) return;
        creating = true; repair.disabled = true; error.hidden = true;
        try {
          const data = await api.prepareCopy(entry.id, [...choices.values()]);
          if (token === generation && section.isConnected) await openCopy(entry, data);
        } catch (cause) {
          if (token === generation) { error.textContent = cause instanceof Error ? cause.message : t('Could not prepare this copy.'); error.hidden = false; }
        } finally { creating = false; repair.disabled = choices.size === 0; }
      });
      section.append(repair, error);
    }
  };
  return {
    action(entry, article) {
      const trigger = button(t('Check assets')); trigger.disabled = busy;
      trigger.setAttribute('aria-expanded', 'false'); buttons.add(trigger);
      trigger.addEventListener('click', async () => {
        if (active?.trigger === trigger) { dismiss(); return; }
        dismiss();
        const token = generation;
        const section = document.createElement('section'); section.className = 'revision-history-fidelity';
        section.id = `history-assets-${crypto.randomUUID()}`;
        section.setAttribute('aria-label', t('Saved asset check'));
        trigger.setAttribute('aria-controls', section.id); trigger.setAttribute('aria-expanded', 'true');
        const heading = document.createElement('h3'); heading.textContent = t('Saved asset check');
        const close = button(t('Close asset check')); close.addEventListener('click', () => { dismiss(); trigger.focus(); });
        const loading = paragraph(t('Checking assets…')); loading.setAttribute('role', 'status');
        section.append(heading, loading, close); article.append(section); active = { section, trigger }; lock(true);
        try {
          const report = await api.inspect(entry.id);
          if (token !== generation || !section.isConnected) return;
          section.replaceChildren(heading); render(section, entry, report, token); section.append(close);
        } catch (cause) {
          if (token === generation) { loading.textContent = cause instanceof Error ? cause.message : t('Could not check this version.'); loading.setAttribute('role', 'alert'); }
        } finally { lock(false); }
      });
      return trigger;
    },
    clear() { dismiss(); buttons.clear(); },
  };
}
