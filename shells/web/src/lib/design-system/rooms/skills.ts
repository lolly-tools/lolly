// SPDX-License-Identifier: MPL-2.0
/**
 * The Skills room (plan 323): the active design system's brand skills, the brand's
 * own guidance written for people and agents, one per discipline.
 *
 * One row per skill (discipline, label, the brand's status, audience, revision and
 * who answers for the text), plus the baseline Lolly generates from the design
 * brief, labelled as generated. Choosing a row reads that skill: the text is
 * fetched through the asset bridge, admitted with the engine's check before
 * anything shows it, rendered through the same sanitised Markdown path the assets
 * details sheet uses, and set against the design system by the coverage map.
 *
 * Nothing here edits a skill. Brands author in their own tools; a managed system
 * shows its lock, as the Usage room does. The two exports are the forms another
 * model can read: an Agent Skills folder as a zip (linked mode, so catalog links
 * point at this instance) and the same text as one file for a plain chat window.
 */
import DOMPurify from 'dompurify';
import type { BrandSkillIndexEntryV1, BrandSkillMetaV1 } from '@lolly-tools/core/brand-skill-v1';
import type { AssetQuery, AssetRef, TokensSnapshot } from '@lolly-tools/core/host-v1';
import {
  admitBrandSkill, baselineBrandSkill, brandSkillCoverage, brandSkillCoverageFacts, classifyBrandSkillLinks,
  exportBrandSkillFolder, type AdmittedBrandSkillV1, type BrandSkillCoverageRowV1, type BrandSkillCoverageV1,
  type BrandSkillFindingV1, type BrandSkillLinkClassV1,
} from '../../../../../../engine/src/brand-skill.ts';
import { designBrief } from '../../../../../../engine/src/design-brief.ts';
import { t } from '../../../i18n.ts';
import { escape as e } from '../../../utils.ts';
import { prefersReducedMotion } from '../../a11y-prefs.ts';
import { copyText } from '../../copy-text.ts';
import { icon, type IconName } from '../../icons.ts';
import { getInstanceBase } from '../../instance.ts';
import { mdToHtml } from '../../markdown.ts';
import { readableMarkdown, tidyReaderLinks } from '../../text-kinds.ts';
import { routeParams } from '../../url-state.ts';
import { zipAsync } from '../../zip.ts';
import type { ActiveRecord } from '../active.ts';
import {
  DISCIPLINE_LABELS, briefSkillAssets, coverageLineText, groupCoverage, listActiveBrandSkills, readBrandSkillFiles, skillAsOneFile,
  skillSteward, type ActiveBrandSkill, type BrandSkillHost,
} from '../brand-skills.ts';

/** The host slice the room reads. Structural: the studio passes its own host. */
export interface SkillsRoomHost extends BrandSkillHost {
  assets: BrandSkillHost['assets'] & { _queryMetadata?(filter: AssetQuery): Promise<AssetRef[]> };
  tokens?: {
    snapshot?(): Promise<TokensSnapshot>;
    raw?(): Promise<unknown>;
    active?(): Promise<{ label?: string } | null>;
    activeRecord?(): Promise<ActiveRecord | null>;
  };
  export: { download(blob: Blob, filename: string): Promise<void> | void };
}

export interface SkillsRoomOpts {
  host: SkillsRoomHost;
  /** A managed system: read-only, and the room says so. */
  readonly?: boolean;
}

/** One row: an authored skill from the catalog, or the generated baseline. */
interface Row {
  key: string;
  entry: BrandSkillIndexEntryV1;
  meta: BrandSkillMetaV1;
  skill?: ActiveBrandSkill;
  markdown?: string;
}

type Reading =
  | { state: 'loading' }
  | { state: 'refused'; reason: string }
  | { state: 'ready'; admitted: AdmittedBrandSkillV1; coverage: BrandSkillCoverageV1 };

const BASELINE_KEY = 'baseline';

const DISCIPLINE_ICONS: Partial<Record<string, IconName>> = {
  brand: 'seal', voice: 'speech', logo: 'hexagon', colour: 'palette', typography: 'font', layout: 'layers',
  photography: 'camera', illustration: 'penTool', iconography: 'shapes', motion: 'filmStrip', sound: 'music',
  interactive: 'monitor', presentation: 'monitor', 'data-visualisation': 'table', print: 'document',
  merchandise: 'package', environmental: 'building', social: 'share', accessibility: 'eye',
};

const ENCODER = new TextEncoder();

export function mountSkillsRoom(el: HTMLElement, opts: SkillsRoomOpts) {
  const { host } = opts;
  let disposed = false, sequence = 0, busy = false;
  let rows: Row[] = [];
  let label = '';
  let record: ActiveRecord | null = null;
  let snapshotVersion: string | null = null;
  let facts = brandSkillCoverageFacts(null);
  let selected = routeParams().get('skill') ?? '';
  const readings = new Map<string, Reading>();
  el.classList.add('usage-room', 'skills-room');

  const rowOf = (key: string): Row | undefined => rows.find(r => r.key === key);
  const status = (message: string): void => {
    const node = el.querySelector<HTMLElement>('[data-skills-status]');
    if (node) node.textContent = message;
  };

  const readDoc = async (): Promise<{ doc: unknown; theme?: string; version: string | null }> => {
    const tokens = host.tokens;
    if (tokens?.snapshot) {
      const snap = await tokens.snapshot();
      return { doc: snap.document, ...(snap.selection?.theme ? { theme: snap.selection.theme } : {}), version: snap.version ?? null };
    }
    return { doc: (await tokens?.raw?.()) ?? null, version: null };
  };

  const rowHtml = (row: Row): string => {
    const { entry } = row;
    const on = row.key === selected;
    const steward = skillSteward(entry);
    const kind = entry.generated ? t('Baseline') : t(DISCIPLINE_LABELS[entry.discipline]);
    const hint = [kind, entry.generated ? '' : t('Revision {revision}', { revision: entry.skillRevision }), entry.audience === 'internal' ? t('Internal') : t('Public'), steward].filter(Boolean).join(' · ');
    const badge = entry.generated
      ? `<span class="usage-badge" data-status="generated">${t('Generated')}</span>`
      : `<span class="usage-badge" data-status="${entry.status}">${entry.status === 'approved' ? t('Approved') : t('Draft')}</span>`;
    const glyph: IconName = entry.generated ? 'tokens' : (DISCIPLINE_ICONS[entry.discipline] ?? 'document');
    return `<article class="usage-rule skills-row" data-skill-row="${e(row.key)}"${on ? ' data-selected' : ''}>
      <div class="usage-rule-icon" aria-hidden="true">${icon(glyph, { size: 20 })}</div>
      <div class="usage-rule-copy">
        <h3><button type="button" class="skills-open" data-skill-open="${e(row.key)}" aria-controls="skills-reader"${on ? ' aria-current="true"' : ''}>${e(entry.label)}</button></h3>
        <p class="skills-row-desc">${e(entry.description)}</p>
        <p class="usage-hint">${e(hint)}</p>
      </div>
      <div class="usage-rule-meta">${badge}</div>
    </article>`;
  };

  const coverageRowHtml = (row: BrandSkillCoverageRowV1): string => {
    const where = [row.section, t('line {line}', { line: row.line })].filter(Boolean).join(' · ');
    const swatches = (row.values ?? []).filter(v => /^#[0-9a-f]{6}$/i.test(v)).slice(0, 12)
      .map(v => `<span class="skills-swatch" style="background:${v}" title="${e(v)}"></span><code>${e(v)}</code>`).join('');
    return `<li><p class="skills-cov-text">${e(coverageLineText(row.text))}</p><p class="usage-hint">${e(where)}</p><p>${e(row.detail)}</p>${swatches ? `<p class="skills-swatches">${swatches}</p>` : ''}</li>`;
  };

  const coverageHtml = (coverage: BrandSkillCoverageV1): string => {
    const groups = groupCoverage(coverage);
    const total = groups.checked.length + groups.conflicts.length + groups.agree.length + groups.guidance.length;
    const group = (key: string, title: string, list: BrandSkillCoverageRowV1[], open: boolean): string => list.length
      ? `<details class="usage-details skills-group" data-coverage="${key}"${open ? ' open' : ''}><summary><span>${title}</span><span class="skills-count">${list.length}</span></summary><ul>${list.map(coverageRowHtml).join('')}</ul></details>`
      : `<p class="skills-group skills-group--empty" data-coverage="${key}"><span>${title}</span><span class="skills-count">0</span></p>`;
    return `<section class="skills-coverage" aria-labelledby="skills-coverage-title">
      <h4 id="skills-coverage-title">${t('Coverage')}</h4>
      ${group('checked', t('Lolly checks this'), groups.checked, true)}
      ${group('conflict', t('Conflicts with your tokens'), groups.conflicts, true)}
      ${group('agree', t('Agrees with your tokens'), groups.agree, total <= 12)}
      ${group('guidance', t('Guidance only'), groups.guidance, total <= 12)}
      <p class="usage-hint skills-note">${e(coverage.note)}</p>
    </section>`;
  };

  const findingsHtml = (findings: readonly BrandSkillFindingV1[]): string => {
    if (!findings.length) return '';
    return `<section class="skills-findings" aria-labelledby="skills-findings-title">
      <h4 id="skills-findings-title">${t('Notes for the owner')}</h4>
      <ul>${findings.map(f => `<li data-severity="${f.severity}">${f.severity === 'warning' ? `<span class="skills-finding-ic" aria-hidden="true">${icon('alert', { size: 14 })}</span>` : ''}<span>${e(f.message)}${f.line ? ` <span class="usage-hint">${e(t('Line {line}', { line: f.line }))}</span>` : ''}</span></li>`).join('')}</ul>
    </section>`;
  };

  const readerHtml = (row: Row): string => {
    const { entry } = row;
    const reading = readings.get(row.key) ?? { state: 'loading' as const };
    const factLine = [entry.name, entry.generated ? '' : t('Revision {revision}', { revision: entry.skillRevision }), entry.audience === 'internal' ? t('Internal') : t('Public')].filter(Boolean).join(' · ');
    const note = entry.generated
      ? t('Lolly writes this from the design system’s tokens, pairings and house rules each time it is read. Where one of the brand’s own skills covers the same ground, that skill wins.')
      : entry.status === 'approved'
        ? t('Approved is the brand’s own statement about this text. Lolly has not reviewed what it says.')
        : t('A draft. The brand has not approved this text yet.');
    const ready = reading.state === 'ready';
    const body = reading.state === 'loading'
      ? `<p class="usage-message">${t('Reading the skill…')}</p>`
      : reading.state === 'refused'
        ? `<div class="usage-empty skills-refused" role="alert">${icon('alert', { size: 28 })}<h3>${t('This skill could not be read')}</h3><p>${e(reading.reason)}</p></div>`
        : `<div class="skills-reader-grid"><article class="skills-md" data-skills-md aria-label="${e(t('{name}, rendered', { name: entry.label }))}"></article><aside class="skills-aside">${coverageHtml(reading.coverage)}${findingsHtml(reading.admitted.parsed.findings)}</aside></div>`;
    return `<header class="skills-reader-head">
        <div class="skills-reader-title">
          <p class="start-eyebrow">${e(entry.generated ? t('Baseline') : t(DISCIPLINE_LABELS[entry.discipline]))}</p>
          <h3 id="skills-reader-title">${e(entry.label)}</h3>
          <p class="skills-reader-desc">${e(entry.description)}</p>
          <p class="usage-hint">${e(factLine)}</p>
        </div>
        <div class="skills-reader-actions">
          <button type="button" class="btn btn--sm" data-skill-zip${ready && !busy ? '' : ' disabled'}>${icon('download', { size: 16 })} ${t('Download skill (.zip)')}</button>
          <button type="button" class="btn btn--sm" data-skill-copy${ready && !busy ? '' : ' disabled'}>${icon('duplicate', { size: 16 })} ${t('Copy as one file')}</button>
        </div>
      </header>
      <p class="usage-hint skills-reader-note">${e(note)}</p>
      <p class="usage-message" data-skills-status role="status" aria-live="polite"></p>
      ${body}`;
  };

  /** Fill the rendered Markdown: sanitised, links made safe to press (a web link opens a
   *  new tab, an asset id opens that asset), and no remote images. */
  const fillMarkdown = (row: Row): void => {
    const reading = readings.get(row.key);
    const box = el.querySelector<HTMLElement>('[data-skills-md]');
    if (!box || reading?.state !== 'ready') return;
    box.innerHTML = DOMPurify.sanitize(mdToHtml(readableMarkdown(reading.admitted.markdown)));
    tidyReaderLinks(box);
    for (const img of box.querySelectorAll<HTMLImageElement>('img')) {
      if (!/^\/catalog\//.test(img.getAttribute('src') ?? '')) img.replaceWith(document.createTextNode(img.alt ? `[${img.alt}]` : ''));
    }
  };

  const paintReader = (): void => {
    const reader = el.querySelector<HTMLElement>('#skills-reader');
    const row = rowOf(selected);
    if (!reader || !row) return;
    reader.innerHTML = readerHtml(row);
    fillMarkdown(row);
  };

  const paint = (): void => {
    const authored = rows.filter(r => !r.entry.generated).length;
    const intro = authored
      ? t('Your brand’s guidance, written for people and agents. Agents read the brand skill first, then the one for the work at hand. Skills guide the work; the house rules in Usage & rules are what Lolly checks.')
      : t('This design system has no skills of its own yet. Until the brand adds some, agents read the baseline Lolly generates from the tokens and house rules.');
    el.innerHTML = `<header class="usage-head"><div><p class="start-eyebrow">${e(label)}</p><h2>${t('Skills')}</h2><p>${intro}</p></div>${opts.readonly ? `<span class="usage-badge skills-lock">${icon('lock', { size: 14 })} ${t('Read-only')}</span>` : ''}</header>
      <section class="usage-rules skills-list" aria-label="${e(t('Skills in this design system'))}">${rows.map(rowHtml).join('')}</section>
      <section class="skills-reader" id="skills-reader" aria-labelledby="skills-reader-title"></section>`;
    paintReader();
  };

  /** Read, admit and map one row. The result is cached per row for this room's life. */
  const load = async (row: Row): Promise<void> => {
    if (readings.get(row.key)?.state === 'ready') return;
    readings.set(row.key, { state: 'loading' });
    const current = sequence;
    let result: Reading;
    try {
      const files = row.skill ? await readBrandSkillFiles(host, row.skill) : { 'SKILL.md': ENCODER.encode(row.markdown ?? '') };
      const admission = await admitBrandSkill(files);
      result = admission.ok
        ? { state: 'ready', admitted: admission.skill, coverage: brandSkillCoverage(admission.skill.parsed.body, facts) }
        : { state: 'refused', reason: admission.reason };
    } catch (error) {
      result = { state: 'refused', reason: error instanceof Error ? error.message : t('The skill file could not be read.') };
    }
    if (disposed || current !== sequence) return;
    readings.set(row.key, result);
    if (selected === row.key) paintReader();
  };

  const select = (key: string, fromUser = false): void => {
    const row = rowOf(key);
    if (!row) return;
    selected = key;
    for (const node of el.querySelectorAll<HTMLElement>('[data-skill-row]')) {
      const on = node.dataset.skillRow === key;
      node.toggleAttribute('data-selected', on);
      const button = node.querySelector<HTMLButtonElement>('[data-skill-open]');
      if (on) button?.setAttribute('aria-current', 'true'); else button?.removeAttribute('aria-current');
    }
    paintReader();
    void load(row);
    // On a phone the reader sits under the list, so a choice there would otherwise
    // change nothing the person can see.
    if (fromUser && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 899px)').matches) {
      el.querySelector<HTMLElement>('#skills-reader')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const refresh = async (): Promise<void> => {
    const current = ++sequence;
    try {
      const [{ doc, theme, version }, active, skills, rec] = await Promise.all([
        readDoc(),
        host.tokens?.active?.().catch(() => null) ?? Promise.resolve(null),
        listActiveBrandSkills(host),
        host.tokens?.activeRecord?.().catch(() => null) ?? Promise.resolve(null),
      ]);
      if (disposed || current !== sequence) return;
      record = rec;
      snapshotVersion = version;
      label = rec?.label || active?.label || t('Your design system');
      const brief = designBrief(doc, { assets: briefSkillAssets(skills) }, { name: label, ...(theme ? { theme } : {}) });
      facts = brandSkillCoverageFacts(brief);
      const baseline = baselineBrandSkill(brief as unknown as Record<string, unknown>);
      const baselineEntry: BrandSkillIndexEntryV1 = {
        id: BASELINE_KEY, name: baseline.meta.name, label: t('{name} baseline', { name: label }),
        description: brief.skills.baseline.description, discipline: 'brand', audience: 'public', status: 'draft',
        skillRevision: baseline.meta.skillRevision, version: version ?? 'head', maintainer: 'lolly', generated: true,
      };
      rows = [
        ...skills.map(skill => ({ key: skill.ref.id, entry: skill.entry, meta: skill.meta, skill })),
        { key: BASELINE_KEY, entry: baselineEntry, meta: baseline.meta, markdown: baseline.markdown },
      ];
      // The baseline is regenerated from the current brief on every refresh; an authored
      // skill's admitted text stays cached while its version does not change.
      readings.delete(BASELINE_KEY);
      for (const key of [...readings.keys()]) if (!rowOf(key)) readings.delete(key);
      if (!rowOf(selected)) selected = rows[0]!.key;
      paint();
      void load(rowOf(selected)!);
    } catch (error) {
      if (!disposed) el.textContent = error instanceof Error ? error.message : t('The skills could not be read. Open this room again to retry.');
    }
  };

  /** The selected skill as an Agent Skills folder, linked to this instance. */
  const exportSelected = async () => {
    const row = rowOf(selected);
    const reading = row && readings.get(row.key);
    if (!row || reading?.state !== 'ready') throw new Error(t('Choose a skill that has finished loading.'));
    const { admitted } = reading;
    const origin = getInstanceBase() || location.origin;
    const catalogUrl = row.skill?.url.startsWith('/') ? row.skill.url : undefined;
    let links: BrandSkillLinkClassV1[] | undefined;
    if (admitted.parsed.links.length) {
      const list = await (host.assets._queryMetadata?.({}) ?? host.assets.query({})).catch(() => [] as AssetRef[]);
      links = classifyBrandSkillLinks(admitted.parsed.links, list.map(ref => ({ id: ref.id, type: ref.type, formats: [{ format: ref.format, url: ref.url }] })), row.meta);
    }
    return exportBrandSkillFolder({
      markdown: admitted.markdown,
      references: admitted.references,
      meta: row.meta,
      asset: {
        id: row.skill?.ref.id ?? `generated/${row.meta.name}`,
        version: row.skill?.entry.version ?? snapshotVersion ?? 'head',
        name: row.entry.label,
        ...(row.skill?.license ? { license: row.skill.license } : {}),
        ...(catalogUrl ? { url: catalogUrl } : {}),
      },
      system: { ...(record?.id ? { id: record.id } : {}), label },
      sha256: admitted.sha256,
      mode: 'linked',
      origin,
      ...(links ? { links } : {}),
      coverage: reading.coverage,
    });
  };

  const run = async (kind: 'zip' | 'copy'): Promise<void> => {
    if (busy) return;
    busy = true;
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-skill-zip], [data-skill-copy]')) button.disabled = true;
    try {
      const folder = await exportSelected();
      if (disposed) return;
      if (kind === 'copy') {
        const ok = await copyText(skillAsOneFile(folder.files));
        status(ok ? t('Copied {name} as one file, with its source and revision in the frontmatter.', { name: folder.name }) : t('The clipboard is not available here. Use Download skill instead.'));
      } else {
        const entries: Record<string, Uint8Array> = {};
        for (const [path, value] of Object.entries(folder.files)) entries[`${folder.name}/${path}`] = typeof value === 'string' ? ENCODER.encode(value) : value;
        const bytes = await zipAsync(entries);
        await host.export.download(new Blob([bytes], { type: 'application/zip' }), `${folder.name}.zip`);
        status(t('Downloaded {name}.zip. Catalog links in it point at this instance, and lolly.json records where it came from.', { name: folder.name }));
      }
    } catch (error) {
      status(error instanceof Error ? error.message : t('The skill could not be prepared.'));
    } finally {
      busy = false;
      const ready = readings.get(selected)?.state === 'ready';
      for (const button of el.querySelectorAll<HTMLButtonElement>('[data-skill-zip], [data-skill-copy]')) button.disabled = !ready;
    }
  };

  el.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.skillOpen) select(button.dataset.skillOpen, true);
    else if (button.hasAttribute('data-skill-zip')) void run('zip');
    else if (button.hasAttribute('data-skill-copy')) void run('copy');
  });

  void refresh();
  return {
    refresh,
    /** No overlays: the room opens nothing the Escape stack would need to close first. */
    modalOpen: () => false,
    suspend: () => { /* nothing runs in the background */ },
    teardown: () => { disposed = true; sequence++; },
  };
}
export type SkillsRoom = ReturnType<typeof mountSkillsRoom>;
