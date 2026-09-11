// SPDX-License-Identifier: MPL-2.0
import { highlightCode } from '../../../../engine/src/text-syntax.ts';
import { appendVisibleText } from './invisible-chars.ts';
import '../components/code-editor.css';
export function syntaxLanguageForFile(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return (
    (
      {
        js: 'javascript',
        jsx: 'javascript',
        mjs: 'javascript',
        cjs: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        py: 'python',
        rs: 'rust',
        go: 'go',
        sh: 'bash',
        bash: 'bash',
        zsh: 'bash',
        css: 'css',
        scss: 'css',
        html: 'html',
        htm: 'html',
        xml: 'xml',
        json: 'json',
        jsonl: 'json',
        yaml: 'yaml',
        yml: 'yaml',
        toml: 'toml',
        sql: 'sql',
        dockerfile: 'dockerfile',
      } as Record<string, string>
    )[ext] ?? 'plain'
  );
}
export function paintSyntaxPreview(
  pre: HTMLElement,
  text: string,
  language: string,
  options: { invisibleClass?: string } = {}
): void {
  pre.classList.add('syntax');
  pre.innerHTML = highlightCode(text, language).html;
  if (options.invisibleClass) {
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT),
      nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      appendVisibleText(fragment, node.data, options.invisibleClass);
      node.replaceWith(fragment);
    }
  }
}
/** Tools request decorative highlights while the shell owns the implementation. */
export function wireSyntaxRequests(root: HTMLElement): () => void {
  const listener = (event: Event): void => {
    const value = (
      event as CustomEvent<{
        text?: unknown;
        language?: unknown;
        target?: unknown;
        sandbox?: boolean;
      }>
    ).detail;
    if (
      !value ||
      typeof value.text !== 'string' ||
      typeof value.language !== 'string' ||
      !(value.target instanceof HTMLElement) ||
      !root.contains(value.target)
    )
      return;
    let html = highlightCode(value.text, value.language).html;
    if (value.sandbox) {
      const roles: Record<string, string> = {
        keyword: 'kw',
        string: 'str',
        comment: 'com',
        number: 'num',
        function: 'fn',
        type: 'type',
        operator: 'op',
      };
      html = html.replace(
        /class="tok-(\w+)"/g,
        (_, role: string) => `class="tk-${roles[role] ?? role}"`
      );
    }
    value.target.innerHTML = html + '\n';
  };
  root.addEventListener('lolly:highlight-code', listener);
  return () => root.removeEventListener('lolly:highlight-code', listener);
}
