// SPDX-License-Identifier: MPL-2.0
import { posix } from 'node:path';
import type { DocsPage, DocsRegistry } from './navigation.ts';

/** Public links are independent of the console's retained relative paths. */
export function publicWorkMarkdown(markdown: string, page: DocsPage, registry: DocsRegistry): string {
  const byWorkPath = new Map(registry.pages.filter(p => p.work).map(p => [p.work!.path, p]));
  const resolveLink = (url: string, image: boolean): string => {
    const github = /^https:\/\/github\.com\/lolly-tools\/lolly-work\/blob\/(?:main|[a-f0-9]{7,40})\/docs\/([^#?]+)(.*)$/.exec(url);
    if (github) {
      if (github[1] === 'README.md') return '/info/operate/index.html' + github[2];
      const target = byWorkPath.get(github[1]!);
      return target ? `/info/${target.path}.html${github[2]}` : url;
    }
    if (!page.work || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) return url;
    const boundary = url.search(/[?#]/);
    const path = boundary < 0 ? url : url.slice(0, boundary);
    const suffix = boundary < 0 ? '' : url.slice(boundary);
    const resolved = posix.normalize(posix.join(posix.dirname(page.work.path), path!));
    const target = byWorkPath.get(resolved);
    if (target) return `/info/${target.path}.html${suffix}`;
    if (resolved === 'README.md') return '/info/operate/index.html' + suffix;
    if (resolved.startsWith('shots/')) return '/info/shots/work/' + resolved.slice('shots/'.length) + suffix;
    if (resolved.startsWith('img/')) return '/info/work/img/' + resolved.slice('img/'.length) + suffix;
    if (image && !resolved.startsWith('..')) return '/info/work/' + resolved + suffix;
    const repositoryPath = posix.normalize(posix.join('docs', resolved));
    return `${registry.workImport.repository}/blob/${registry.workImport.commit}/${repositoryPath}${suffix}`;
  };
  let fenced = false;
  const body = markdown.split('\n').map(line => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (original, image: string, label: string, url: string) => {
      if (page.work && !image && /^(?:\/admin(?:[#/?]|$)|\/#)/.test(url)) return `${label} (\`${url}\` on your Work instance)`;
      const target = resolveLink(url, Boolean(image));
      return target === url ? original : `${image}[${label}](${target})`;
    });
  }).join('\n');
  return body;
}

export function workApplicability(page: DocsPage): string {
  if (!page.work) return '';
  return `::: note Lolly Work\nThis guide covers the optional organisation service. Configuration, console and API paths refer to your Work instance. The packaged console keeps its release-matched copy of this guide.\n:::\n\n`;
}
