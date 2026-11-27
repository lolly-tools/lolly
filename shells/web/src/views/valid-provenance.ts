// SPDX-License-Identifier: MPL-2.0
/** Generator, software stack and rights evidence for Verify's expanded and collapsed reports. */
import { softwareOrigins, normaliseLicence, licenceDisplayName } from '@lolly/engine';
import type { FileMetadata, MetaField, SoftwareRole, VerifyStrength } from '@lolly/engine';
import type { VerifyReport } from './valid-verdict.ts';
import { hasHashVerdict, hashFailed } from './valid-verdict.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { strengthHtml, vendorMark } from './valid-vendors.ts';
import { icon } from '../lib/icons.ts';
import { metadataValueHtml, metadataLinkHtml } from './valid-links.ts';

type EvidenceKind = 'credential' | 'unverified-credential' | 'metadata' | 'hint';
interface Evidence { source: string; value: string; kind: EvidenceKind; }
interface App { name: string; role: SoftwareRole; evidence: Evidence[]; }
interface Rights { name: string; evidence: Evidence[]; }
interface Fact { label: string; evidence: Evidence; }
export interface ProvenanceOverview { apps: App[]; devices: Rights[]; rights: Rights[]; facts: Fact[]; }

const KIND_LABEL: Record<EvidenceKind, string> = {
  credential: 'Intact credential', 'unverified-credential': 'Unverified credential',
  metadata: 'Metadata', hint: 'Hint',
};
const ROLE_LABEL: Record<SoftwareRole, string> = {
  authoring: 'Authoring', export: 'Export & processing', history: 'Recorded history', system: 'Operating system',
};
const bounded = (s: string) => s.slice(0, 2048).replace(/\p{Cc}/gu, ' ').trim().slice(0, 2048);

/** A credential never authenticates unrelated EXIF, XMP or comments. */
export function provenanceOverview(report: VerifyReport, meta?: FileMetadata): ProvenanceOverview {
  const apps: App[] = [], rights: Rights[] = [], facts: Fact[] = [];
  const devices: Rights[] = [];
  for (const field of meta?.fields ?? []) {
    if (devices.length < 8 && field.group === 'device' && /^(Camera|Device|Model)$/.test(field.label) && field.value.trim()) devices.push({ name: bounded(field.value), evidence: [{ source: field.source ?? `${meta?.format} ${field.label}`, value: bounded(field.value), kind: 'metadata' }] });
  }
  const credentialKind: EvidenceKind = report.found && report.state === 'valid' && hasHashVerdict(report) && !hashFailed(report)
    ? 'credential' : 'unverified-credential';
  const addApp = (name: string, role: SoftwareRole, evidence: Evidence) => {
    const app = apps.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (app) {
      if (role === 'authoring' || (role === 'export' && app.role === 'history')) app.role = role;
      if (!app.evidence.some((e) => e.source === evidence.source && e.value === evidence.value)) app.evidence.push(evidence);
    } else if (apps.length < 32) apps.push({ name, role, evidence: [evidence] });
  };
  const addCredentialApp = (raw: unknown, source: string, role: SoftwareRole) => {
    if (raw && typeof raw === 'object' && 'name' in raw && typeof raw.name === 'string') raw = `${raw.name}${'version' in raw && typeof raw.version === 'string' ? ` ${raw.version}` : ''}`;
    if (typeof raw !== 'string' || !raw.trim()) return;
    const value = bounded(raw);
    const identified = softwareOrigins([{ label: 'Software', value, group: 'software' }])[0];
    if (identified) addApp(identified.name, role === 'authoring' ? identified.role : role, { source, value, kind: credentialKind });
  };
  if (report.found) {
    const gi = report.claim?.generatorInfo;
    addCredentialApp(typeof gi?.name === 'string' ? `${gi.name}${gi.version ? ` ${gi.version}` : ''}` : report.claim?.claimGenerator,
      'C2PA claim generator', report.delivered ? 'export' : 'authoring');
    for (const action of (report.claim?.actions ?? []).slice(0, 32)) addCredentialApp(action.softwareAgent, 'C2PA action softwareAgent', 'history');
    for (const action of (report.history ?? []).slice(0, 32)) addCredentialApp(action.softwareAgent || action.generator, 'C2PA history', 'history');
  }
  for (const app of softwareOrigins(meta?.fields ?? [])) {
    for (const e of app.evidence) addApp(app.name, app.role, { source: e.source, value: e.value, kind: e.kind });
  }
  const order: Record<SoftwareRole, number> = { authoring: 0, export: 1, history: 2, system: 3 };
  apps.sort((a, b) => order[a.role] - order[b.role]);
  const addRights = (value: string, source: string, kind: EvidenceKind) => {
    const text = bounded(value);
    if (!text) return;
    const cc = /^https?:\/\/(?:www\.)?creativecommons\.org\/(?:licenses\/(by(?:-nc)?(?:-sa|-nd)?)\/(\d+\.\d+)|publicdomain\/(zero|mark)\/(1\.0))\/(?:deed(?:\.[\w-]+)?|legalcode(?:\.[\w-]+)?)?\/?$/i.exec(text);
    const declaration = cc ? (cc[1] ? `CC-${cc[1].toUpperCase()}-${cc[2]}` : cc[3] === 'zero' ? 'CC0-1.0' : 'CC-PDDC') : text;
    const normal = normaliseLicence(declaration);
    const name = normal.id ? licenceDisplayName(normal.id) : text;
    const entry = rights.find((r) => r.name === name);
    const evidence = { source, value: text, kind };
    if (entry) {
      if (!entry.evidence.some((e) => e.source === source && e.value === text)) entry.evidence.push(evidence);
    } else if (rights.length < 16) rights.push({ name, evidence: [evidence] });
  };
  if (report.found && typeof report.rights === 'string') addRights(report.rights, 'C2PA rights declaration', credentialKind);
  for (const field of (meta?.fields ?? []).slice(0, 128)) {
    if (/^(?:Rights|Copyright|Licence|License|Usage terms|Rights statement)$|(?:^|:)license$|:(?:rights|UsageTerms|WebStatement)$/i.test(field.label)) {
      addRights(field.value, field.source ?? `${meta?.format ?? ''} ${field.label}`.trim(), 'metadata');
    }
  }
  const fact = (label: string, value: unknown, source: string, kind: EvidenceKind) => {
    if (typeof value === 'string' && value.trim()) facts.push({ label, evidence: { value: bounded(value), source, kind } });
  };
  if (report.found) {
    fact('Creator', report.author?.name, 'C2PA author', credentialKind);
    fact('Creator website', report.author?.url, 'C2PA author URL', credentialKind);
    fact('Recorded action', report.claim?.actions?.find((a) => a.when)?.when, 'C2PA action time', credentialKind);
  }
  for (const [label, pattern] of [['Creator', /^(Author|Artist|Creator|By-line)$/], ['Captured', /^(Taken|Date taken)$/], ['Created', /^(Created|Creation Time)$/], ['Modified', /^(Modified|Last modified)$/], ['Location', /^(Coordinates|Location)$/]] as const) {
    const field = meta?.fields.find((f) => pattern.test(f.label));
    if (field && !facts.some((f) => f.label === label && f.evidence.value === field.value)) fact(label, field.value, field.source ?? field.label, 'metadata');
  }
  return { apps, devices, rights, facts };
}

const kindsHtml = (evidence: Evidence[]): string => [...new Set(evidence.map((e) => e.kind))].map((kind) => `<span class="valid-evidence-kind is-${kind}">${esc(t(KIND_LABEL[kind]))}</span>`).join('');
/** The same evidence in the strength words the answer row uses, strongest first. */
const KIND_STRENGTH: Record<EvidenceKind, VerifyStrength> = { credential: 'signed', 'unverified-credential': 'unverified', metadata: 'stated', hint: 'hint' };
const RANK: readonly VerifyStrength[] = ['signed', 'unverified', 'stated', 'hint'];
/**
 * A row's strength, only when its best evidence differs from what the section's
 * heading already states. Every source stays listed under Evidence.
 */
function rowStrengthHtml(evidence: Evidence[], stated: VerifyStrength | undefined): string {
  if (!stated) return kindsHtml(evidence);
  const best = RANK.find((s) => evidence.some((e) => KIND_STRENGTH[e.kind] === s));
  return best && best !== stated ? strengthHtml(best) : '';
}
const evidenceDetails = (entries: Array<{ name: string; evidence: Evidence[] }>): string => {
  const count = entries.reduce((n, entry) => n + entry.evidence.length, 0);
  return count ? `<details class="valid-origin-evidence"><summary>${icon('search')}<span>${t('Evidence ({n})', { n: count })}</span>${icon('chevronDown')}</summary>${entries.map((entry) => `<div><h4>${esc(entry.name)}</h4><ul>${entry.evidence.map((e) => `<li>${kindsHtml([e])}<span class="valid-evidence-source">${esc(e.source)}</span><q>${metadataValueHtml(e.value)}</q></li>`).join('')}</ul></div>`).join('')}</details>` : '';
};

/** `stated` is the strength the section's heading shows; a row then repeats no strength that matches. */
export function provenanceOverviewHtml(report: VerifyReport, meta?: FileMetadata, withRights = true, stated?: VerifyStrength): string {
  const { apps, devices, rights, facts } = provenanceOverview(report, meta);
  const roles: SoftwareRole[] = ['authoring', 'export', 'history', 'system'];
  return `<div class="valid-origin-overview">
    <section class="valid-origin-card valid-origin-software" aria-label="${esc(t('Generator & software'))}">
      <h3>${icon('tool')}<span>${t('Generator & software')}</span></h3>
      ${devices.length ? `<div class="valid-software-group"><p class="valid-origin-label">${t('Capture device')}</p><div class="valid-software-badges">${devices.map((device) => `<div class="valid-software-badge is-primary">${vendorMark(device.name)}<span class="valid-vendor-copy"><strong>${esc(device.name)}</strong>${rowStrengthHtml(device.evidence, stated)}</span></div>`).join('')}</div></div>` : ''}
      ${apps.length ? roles.map((role) => {
        const selected = apps.filter((a) => a.role === role);
        return selected.length ? `<div class="valid-software-group"><p class="valid-origin-label">${t(ROLE_LABEL[role])}</p><div class="valid-software-badges">${selected.map((app) => `<div class="valid-software-badge${role === 'authoring' ? ' is-primary' : ''}">${vendorMark(app.name)}<span class="valid-vendor-copy"><strong>${esc(app.name)}</strong><span class="valid-origin-kinds">${rowStrengthHtml(app.evidence, stated)}</span></span></div>`).join('')}</div></div>` : '';
      }).join('') : devices.length ? '' : `<p class="valid-origin-empty">${t('Generator not identified')}</p>`}
      ${apps.some((a) => a.evidence.some((e) => e.kind === 'metadata' || e.kind === 'hint')) ? `<p class="valid-origin-note">${t('Metadata and hints are editable; earlier software may still be named.')}</p>` : ''}
      ${evidenceDetails([...devices, ...apps])}
    </section>
    ${withRights ? `<section class="valid-origin-card valid-origin-rights" aria-label="${esc(t('Licence & rights'))}">
      <h3>${icon('document')}<span>${t('Licence & rights')}</span></h3>
      ${rights.length ? `<div class="valid-rights-declarations">${rights.map((entry) => `<div class="valid-rights-declaration"><strong>${metadataLinkHtml(entry.evidence.find((e) => /^https?:\/\//i.test(e.value))?.value ?? '', entry.name)}</strong><span class="valid-origin-kinds">${kindsHtml(entry.evidence)}</span></div>`).join('')}</div>` : `<p class="valid-origin-empty">${t('No licence recorded')}</p>`}
      <p class="valid-origin-note">${rights.length ? t('Declared terms. Permission to reuse is not verified.') : t('No recorded licence does not mean free to use.')}</p>
      ${evidenceDetails(rights)}
    </section>` : ''}
    ${facts.length ? `<dl class="valid-origin-facts">${facts.filter((f) => !['Creator', 'Creator website', 'Location'].includes(f.label)).map(({ label, evidence }) => `<div><dt>${icon('calendar')}${esc(t(label))}</dt><dd title="${esc(evidence.source)}"><span>${label === 'Location' && meta?.mapUrl ? metadataLinkHtml(meta.mapUrl, evidence.value) : metadataValueHtml(evidence.value.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3 ').replace(/^(\d{4}-\d{2}-\d{2})T/, '$1 ').replace(/(\d\d:\d\d:\d\d)(?:\.000)?Z$/, '$1 UTC'))}</span>${rowStrengthHtml([evidence], stated)}</dd></div>`).join('')}</dl>` : ''}
  </div>`;
}

/** Compact evidence remains visible when a batch report is collapsed. */
export function provenanceSummaryHtml(report: VerifyReport, meta?: FileMetadata): string {
  const { apps, devices, rights } = provenanceOverview(report, meta);
  const app = apps.find((a) => a.role === 'authoring') ?? apps[0];
  const primary = devices[0] ?? app;
  const appText = devices[0]?.name ?? (app ? `${app.name}${apps.length > 1 ? ` +${apps.length - 1}` : ''}` : '');
  return `${primary ? `<span class="valid-item-origin" title="${esc([...devices, ...apps].map((a) => `${a.name}: ${a.evidence.map((e) => t(KIND_LABEL[e.kind])).join(', ')}`).join('; '))}">${icon(devices.length ? 'camera' : 'tool')}<span>${esc(appText)}</span><small>${esc(t(KIND_LABEL[primary.evidence[0]!.kind]))}</small></span>` : ''}${rights.length ? `<span class="valid-item-rights" title="${esc(rights.map((r) => r.name).join('; '))}">${icon('document')}<span>${esc(rights[0]!.name)}</span><small>${esc(t(KIND_LABEL[rights[0]!.evidence[0]!.kind]))}</small></span>` : ''}`;
}

/** Preserve XMP properties as evidence while grouping PDF findings consistently. */
export function pdfProvenanceField(label: string): Partial<MetaField> {
  if (label === 'PDF generator comment') return { source: 'PDF comment', label: 'Generator comment', group: 'software', signal: 'hint' };
  if (/^XMP\/RDF /.test(label)) return {
    source: label, group: /:(?:CreatorTool|Producer|Software|softwareAgent|xmptk)$/.test(label) ? 'software' : /:(?:CreateDate|ModifyDate)$/.test(label) ? 'timestamps' : 'authorship',
    label: /:CiEmailWork$/.test(label) ? 'Contact email' : /:CiTelWork$/.test(label) ? 'Contact phone' : /:CiUrlWork$/.test(label) ? 'Contact website' : /:CiAdr/.test(label) ? 'Contact address' : /:xmptk$/.test(label) ? 'Metadata toolkit' : /:softwareAgent$/.test(label) ? 'Software history' : /:CreateDate$/.test(label) ? 'Created' : /:ModifyDate$/.test(label) ? 'Modified' : /:creator$/.test(label) ? 'Creator' : label,
  };
  if (label === 'Link' || label === 'Links') return { source: 'PDF link annotation', group: 'structure' };
  return { source: `PDF Info ${label === 'Created with' ? 'Creator' : label === 'PDF producer' ? 'Producer' : label}` };
}
