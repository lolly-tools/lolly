// SPDX-License-Identifier: MPL-2.0
/**
 * A built brand page as one document for a sandboxed frame. The real page reads its
 * stylesheet and pictures from files beside it; here they are written inline, because
 * a frame with no origin of its own has nothing beside it to read. Links are taken out,
 * since a preview has nowhere to go, and a meta policy stops the frame reaching anything.
 * Nothing here decides what the page says: that is the engine's output, unchanged.
 */

export interface PreviewFile { path: string; mediaType: string; bytes: Uint8Array }

/** The frame reaches nothing but what is written into the document. */
const PREVIEW_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";

const CHUNK = 0x8000;
function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(out);
}

const dataUrl = (file: PreviewFile): string => `data:${file.mediaType};base64,${base64(file.bytes)}`;

/** A relative path written from `from`'s folder, as a path from the page's root. */
function resolvePath(from: string, target: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.' && segment !== '') parts.push(segment);
  }
  return parts.join('/');
}

/** A stylesheet with every `url(...)` it can resolve written inline, and the rest left out. */
export function inlineStylesheet(css: string, cssPath: string, byPath: ReadonlyMap<string, PreviewFile>): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, _quote: string, target: string) => {
    if (/^data:/i.test(target)) return match;
    const file = byPath.get(resolvePath(cssPath, target));
    return file ? `url(${dataUrl(file)})` : 'url()';
  });
}

/**
 * The document for `<iframe sandbox srcdoc>`. `parse` is a DOMParser's parseFromString,
 * injected so a test can hand in jsdom's.
 */
export function brandPagePreviewHtml(
  files: readonly PreviewFile[],
  parse: (html: string) => Document = html => new DOMParser().parseFromString(html, 'text/html'),
): string {
  const byPath = new Map(files.map(file => [file.path, file]));
  const page = byPath.get('index.html');
  if (!page) return '';
  const doc = parse(new TextDecoder().decode(page.bytes));
  const meta = doc.createElement('meta');
  meta.setAttribute('http-equiv', 'Content-Security-Policy');
  meta.setAttribute('content', PREVIEW_CSP);
  doc.head.prepend(meta);
  for (const link of doc.querySelectorAll('link')) {
    const href = link.getAttribute('href') ?? '';
    const file = link.getAttribute('rel') === 'stylesheet' ? byPath.get(resolvePath('index.html', href)) : undefined;
    if (file) {
      const style = doc.createElement('style');
      style.textContent = inlineStylesheet(new TextDecoder().decode(file.bytes), file.path, byPath);
      link.replaceWith(style);
    } else link.remove();
  }
  for (const image of doc.querySelectorAll('img')) {
    const file = byPath.get(resolvePath('index.html', image.getAttribute('src') ?? ''));
    if (file) image.setAttribute('src', dataUrl(file));
    else image.remove();
  }
  for (const anchor of doc.querySelectorAll('a[href]')) {
    if (!anchor.getAttribute('href')!.startsWith('#')) anchor.removeAttribute('href');
  }
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
