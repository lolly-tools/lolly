// SPDX-License-Identifier: MPL-2.0
/** The manifest is the editable source for public and packaged documentation. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Pathway = 'quickstart' | 'creators' | 'builders' | 'managers' | 'operators' | 'trust';
export interface DocsSection {
  id: string;
  key: Pathway;
  title: string;
  prefix: string;
  hub: string;
}
export interface DocsPage {
  slug: string;
  title: string;
  src: string;
  section: string;
  group: string;
  path: string;
  icon: string;
  aliases: string[];
  secondarySections?: string[];
  description?: string;
  headingId?: string;
  author?: string;
  isLanding?: boolean;
  isHub?: boolean;
  immersive?: boolean;
  pdf?: string;
  register?: 'stage';
  renderer?: string;
  contentLicense: 'CC-BY-SA-4.0' | 'MPL-2.0';
  work?: { slug: string; path: string; icon: string };
}
export interface DocsRegistry {
  version: 1;
  canonical: string;
  sectionSubtitles: false;
  sections: DocsSection[];
  pages: DocsPage[];
  workImport: { repository: string; commit: string; version: string; files: Record<string, { source: string; sha256: string }> };
}

export const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /^[a-z0-9][a-z0-9-]*$/;
const PATH = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;

export function validateRegistry(registry: DocsRegistry, root = DOCS_ROOT): void {
  if (registry.version !== 1 || registry.sectionSubtitles !== false || registry.canonical !== 'https://lolly.tools/info') {
    throw new Error('The documentation manifest must retain its canonical entrance and approved section titles.');
  }
  const sections = new Map(registry.sections.map(s => [s.id, s]));
  if (sections.size !== 6 || new Set(registry.sections.map(s => s.key)).size !== 6) throw new Error('Expected the six distinct documentation sections.');
  const slugs = new Set<string>();
  const paths = new Set<string>();
  const aliases = new Set<string>();
  const workSlugs = new Set<string>();
  const renderers = new Set(['renderMakeSomethingPage', 'renderFaqPage', 'renderTenetsPage', 'renderDesignImportPage', 'renderFormatsPage']);
  for (const page of registry.pages) {
    if (!ID.test(page.slug) || slugs.has(page.slug) || !PATH.test(page.path) || paths.has(page.path)) throw new Error(`Duplicate or invalid documentation identity: ${page.slug}`);
    if (!sections.has(page.section) || !page.group || !page.title || !ID.test(page.icon)) throw new Error(`Incomplete documentation metadata: ${page.slug}`);
    if (page.headingId && !ID.test(page.headingId)) throw new Error(`Invalid stable heading id: ${page.slug}`);
    if (page.renderer && !renderers.has(page.renderer)) throw new Error(`Unknown page renderer: ${page.renderer}`);
    if (!['CC-BY-SA-4.0', 'MPL-2.0'].includes(page.contentLicense)) throw new Error(`Missing content licence: ${page.slug}`);
    const source = resolve(root, 'docs', page.src);
    const rel = relative(root, source);
    if (rel === '..' || rel.startsWith('..' + sep) || !source.endsWith('.md') || !existsSync(source)) throw new Error(`Missing or out-of-repository source: ${page.src}`);
    for (const alias of page.aliases) {
      if (!PATH.test(alias) || aliases.has(alias)) throw new Error(`Duplicate or invalid old documentation path: ${alias}`);
      aliases.add(alias);
    }
    for (const section of page.secondarySections ?? []) if (!sections.has(section)) throw new Error(`Unknown cross-listed section: ${section}`);
    if (page.work) {
      if (!ID.test(page.work.slug) || workSlugs.has(page.work.slug) || !/^(?:[a-z0-9-]+\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(page.work.path)) throw new Error(`Invalid legacy Work page: ${page.slug}`);
      if (page.contentLicense !== 'MPL-2.0') throw new Error(`Imported Work page lost its original licence: ${page.slug}`);
      workSlugs.add(page.work.slug);
    }
    slugs.add(page.slug);
    paths.add(page.path);
  }
  for (const alias of aliases) if (paths.has(alias)) throw new Error(`An old path would overwrite a current page: ${alias}`);
  for (const section of registry.sections) {
    if (!ID.test(section.id) || !ID.test(section.prefix) || !registry.pages.some(p => p.slug === section.hub && p.section === section.id && p.isHub)) throw new Error(`Missing documentation hub: ${section.id}`);
  }
  if (registry.pages.filter(p => p.isLanding).length !== 1 || !registry.pages.some(p => p.slug === 'index' && p.isLanding)) throw new Error('The documentation must have one /info entrance.');
}

export function readRegistry(root = DOCS_ROOT): DocsRegistry {
  const registry = JSON.parse(readFileSync(resolve(root, 'docs/manifest.json'), 'utf8')) as DocsRegistry;
  validateRegistry(registry, root);
  return registry;
}

function quote(text: string): string {
  return "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n') + "'";
}
const object = (properties: string[]) => '{ ' + properties.join(', ') + ' }';

/** Literal generated declarations remain readable to the existing nav guards. */
export function navigationBlocks(registry: DocsRegistry): Record<string, string> {
  const sections = new Map(registry.sections.map(s => [s.id, s]));
  const page = (p: DocsPage): string => object([
    `slug: ${quote(p.slug)}`, `title: ${quote(p.title)}`, `src: ${quote(p.src)}`,
    ...(!p.isLanding ? [`pathway: ${quote(sections.get(p.section)!.key)}`] : []),
    `canonicalPath: ${quote(p.path)}`, `contentLicense: ${quote(p.contentLicense)}`,
    ...(['author', 'description', 'pdf', 'register', 'headingId'] as const).flatMap(key => p[key] ? [`${key}: ${quote(p[key]!)}`] : []),
    ...(['isLanding', 'isHub', 'immersive'] as const).flatMap(key => p[key] ? [`${key}: true`] : []),
    ...(p.renderer ? [`render: ${p.renderer}`] : []),
  ]);
  const nav = registry.sections.map(s => object([`label: ${quote(s.title)}`, `href: ${quote('/info/' + s.hub + '.html')}`]));
  const sidebar = registry.sections.map(section => {
    const list = registry.pages.filter(p => !p.isLanding && (p.section === section.id || p.secondarySections?.includes(section.id)));
    const groups = [...new Set(list.map(p => p.group))];
    return `  ${section.key}: { title: ${quote(section.title)}, groups: [\n` + groups.map(group => {
      const items = list.filter(p => p.group === group).map(p => object([`slug: ${quote(p.slug)}`, `label: ${quote(p.title)}`]));
      return `    { label: ${quote(group)}, items: [\n${items.map(item => '      ' + item + ',').join('\n')}\n    ] },`;
    }).join('\n') + '\n  ] },';
  });
  const footers = registry.sections.flatMap(section => {
    const list = registry.pages.filter(p => p.section === section.id && p.slug !== section.hub);
    return [...new Set(list.map(p => p.group))].map(group => `  ${object([`hub: ${quote(section.key)}`, `label: ${quote(group)}`, `slugs: [${list.filter(p => p.group === group).map(p => quote(p.slug)).join(', ')}]`])},`);
  });
  return {
    pages: `const pages: Page[] = [\n${registry.pages.map(p => '  ' + page(p) + ',').join('\n')}\n];`,
    DOOR: `const DOOR: Record<Pathway, string> = {\n${registry.sections.map(s => `  ${s.key}: ${quote(s.prefix)},`).join('\n')}\n};`,
    NAV: `const NAV: NavLink[][] = [\n  [ ${nav.join(',\n    ')} ],\n];`,
    NAV_PATHWAY: `const NAV_PATHWAY: Record<string, Pathway> = {\n${registry.sections.map(s => `  ${quote('/info/' + s.hub + '.html')}: ${quote(s.key)},`).join('\n')}\n};`,
    SIDEBARS: `const SIDEBARS: Record<Pathway, { title: string; groups: SideGroup[] }> = {\n${sidebar.join('\n')}\n};`,
    PATHWAY_HUB: `const PATHWAY_HUB: Record<Pathway, string> = {\n${registry.sections.map(s => `  ${s.key}: ${quote(s.hub)},`).join('\n')}\n};`,
    FOOTER_SECTIONS: `const FOOTER_SECTIONS: SitemapSection[] = [\n${footers.join('\n')}\n];`,
    SIDEBAR_ICON: `const SIDEBAR_ICON: Record<string, string> = {\n${registry.pages.map(p => `  ${quote(p.slug)}: ${quote(p.icon)},`).join('\n')}\n};`,
    LLMS_SECTIONS: `const LLMS_SECTIONS: Array<{ pathway: Pathway; label: string }> = [\n${registry.sections.map(s => `  ${object([`pathway: ${quote(s.key)}`, `label: ${quote(s.title)}`])},`).join('\n')}\n];`,
  };
}

export function documentationReadme(registry: DocsRegistry): string {
  const intro = `# Lolly documentation\n\nRead the complete documentation at <https://lolly.tools/info>. This directory is the canonical source for Lolly and Lolly Work guides.\n\nEdit page metadata and navigation in [manifest.json](manifest.json), then run \`node scripts/sync-docs-navigation.ts\` from the repository root. The generated declarations in \`docs/build.ts\`, this index, public search, Markdown and agent indexes all follow that manifest.\n\nLolly Work packages a generated, version-pinned subset for its existing console and offline installations. Update the source here; do not edit the generated Work copy. [The bundle instructions](work/README.md) describe the workflow.\n\nOriginal Lolly prose is CC BY-SA 4.0; imported Work prose and screenshots retain their original MPL-2.0 terms and third-party notices. See [LICENSE](LICENSE) and [work/LICENSE](work/LICENSE). The generator and code examples remain MPL-2.0.\n\n`;
  return (intro + registry.sections.map(section => `## ${section.title}\n\n| Guide | Source |\n| --- | --- |\n` + registry.pages.filter(p => p.section === section.id).map(p => `| ${p.title.replace(/\|/g, '\\|')} | [${p.src}](${p.src}) |`).join('\n') + '\n\n').join('')).trimEnd() + '\n';
}

/** Resolve a Work repository-relative guide to its one public page. */
export function workPageMap(registry: DocsRegistry): Map<string, DocsPage> {
  return new Map(registry.pages.filter(p => p.work).map(p => [p.work!.path, p]));
}
