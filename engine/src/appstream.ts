// SPDX-License-Identifier: MPL-2.0
/**
 * appstream.ts - generate AppStream MetaInfo and freedesktop `.desktop` entries.
 * A font (or app) package that ships no `metainfo.xml` is invisible in GNOME
 * Software / KDE Discover; this module produces the XML that lists it there,
 * with its name, summary, licences and (for fonts) the families it provides.
 *
 * Fonts-first (plan 197 M3 / D9): `fontMetainfo` is the path that matters most -
 * "my font shows up in the software centre from one macro" is a headline for the
 * packager crowd. `desktopEntry` builds the companion `.desktop` for the app case.
 *
 * PURE string generation (like scorm.ts's manifest): DOM-free, deterministic, no
 * network. The output is checked with `appstreamcli validate` in CI (plan 197
 * section 11). AppStream requires TWO distinct licences: `metadata_license` for
 * the MetaInfo file itself (a permissive default, CC0-1.0) and `project_license`
 * for the shipped content (the font's own SPDX id).
 */

const MetaInfoDir = '/usr/share/metainfo';

/** Escape a string for XML text / attribute content. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** YYYY-MM-DD (UTC) from an epoch, for a deterministic <release date>. */
function isoDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

export interface FontMetainfoOpts {
  /** AppStream component id, reverse-DNS, e.g. "com.acme.AcmeSans". The metainfo
   *  file is installed as <id>.metainfo.xml. */
  id: string;
  /** Human-readable name shown in the software centre. */
  name: string;
  /** One-line summary (no trailing period; keep it short). */
  summary: string;
  /** Longer description paragraphs. Defaults to a sensible one from name+summary. */
  description?: string[];
  /** The font family names this package provides (the <provides><font> list). */
  fontFamilies: string[];
  /** SPDX id of the fonts themselves (OFL-1.1, …). */
  projectLicense: string;
  /** SPDX id of THIS metainfo file. Default CC0-1.0 (the AppStream convention). */
  metadataLicense?: string;
  /** Developer / foundry name. */
  developerName?: string;
  /** Homepage URL. */
  url?: string;
  /** Version for the <releases> entry. */
  version?: string;
  /** Epoch for the release date (deterministic). Default 0. */
  epoch?: number;
}

/** The path the font metainfo installs to (matches its <id>). */
export function metainfoPath(id: string): string {
  return `${MetaInfoDir}/${id}.metainfo.xml`;
}

/**
 * Build an AppStream `type="font"` MetaInfo document. Validates clean under
 * `appstreamcli validate` (no errors). Deterministic.
 */
export function fontMetainfo(opts: FontMetainfoOpts): string {
  const metaLicense = opts.metadataLicense ?? 'CC0-1.0';
  const desc = (opts.description && opts.description.length > 0)
    ? opts.description
    : [`${opts.name} is a font package providing the ${opts.fontFamilies.join(', ')} ${opts.fontFamilies.length === 1 ? 'family' : 'families'}.`];
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<component type="font">');
  lines.push(`  <id>${esc(opts.id)}</id>`);
  lines.push(`  <metadata_license>${esc(metaLicense)}</metadata_license>`);
  lines.push(`  <project_license>${esc(opts.projectLicense)}</project_license>`);
  lines.push(`  <name>${esc(opts.name)}</name>`);
  lines.push(`  <summary>${esc(opts.summary)}</summary>`);
  lines.push('  <description>');
  for (const p of desc) lines.push(`    <p>${esc(p)}</p>`);
  lines.push('  </description>');
  if (opts.developerName) {
    lines.push(`  <developer id="${esc(opts.id.split('.').slice(0, 2).join('.') || opts.id)}">`);
    lines.push(`    <name>${esc(opts.developerName)}</name>`);
    lines.push('  </developer>');
  }
  if (opts.url) lines.push(`  <url type="homepage">${esc(opts.url)}</url>`);
  lines.push('  <provides>');
  for (const fam of opts.fontFamilies) lines.push(`    <font>${esc(fam)}</font>`);
  lines.push('  </provides>');
  if (opts.version) {
    lines.push('  <releases>');
    lines.push(`    <release version="${esc(opts.version)}" date="${isoDate(opts.epoch ?? 0)}"/>`);
    lines.push('  </releases>');
  }
  lines.push('</component>');
  return lines.join('\n') + '\n';
}

export interface DesktopEntryOpts {
  name: string;
  exec: string;
  /** Icon name (a hicolor icon id) or absolute path. */
  icon: string;
  comment?: string;
  categories?: string[];
  terminal?: boolean;
  /** Extra "Key=Value" lines, appended verbatim. */
  extra?: string[];
}

/** Build a freedesktop `.desktop` entry (validates under desktop-file-validate). */
export function desktopEntry(opts: DesktopEntryOpts): string {
  const lines = ['[Desktop Entry]', 'Type=Application', `Name=${opts.name}`];
  if (opts.comment) lines.push(`Comment=${opts.comment}`);
  lines.push(`Exec=${opts.exec}`);
  lines.push(`Icon=${opts.icon}`);
  lines.push(`Terminal=${opts.terminal ? 'true' : 'false'}`);
  const cats = opts.categories ?? ['Utility'];
  lines.push(`Categories=${cats.join(';')};`);
  for (const e of opts.extra ?? []) lines.push(e);
  return lines.join('\n') + '\n';
}
