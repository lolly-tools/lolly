// SPDX-License-Identifier: MPL-2.0
/** Recognise app module failures without treating failed tool requests as updates. */
export function looksLikeChunkError(value: unknown): boolean {
  const error = value as { message?: unknown; reason?: { message?: unknown } | string } | null;
  const message = String(error?.message ?? (typeof error?.reason === 'string' ? error.reason : error?.reason?.message) ?? value ?? '');
  return /(dynamically imported module|module script failed|error loading dynamically|loading chunk|chunkloaderror|unable to preload css for)/i.test(message);
}

function failedAppResource(target: EventTarget | null, pageHref: string): boolean {
  const element = target as HTMLElement & { src?: string; href?: string; rel?: string; type?: string } | null;
  if (!element) return false;
  const moduleScript = element.tagName === 'SCRIPT' && element.type === 'module';
  const appLink = element.tagName === 'LINK' && (element.rel === 'stylesheet' || element.rel === 'modulepreload');
  if (!moduleScript && !appLink) return false;
  try {
    const page = new URL(pageHref), source = new URL(element.src || element.href || '', page);
    return source.origin === page.origin && /^\/_app\/[^/]+\.(?:m?js|css)$/.test(source.pathname);
  } catch { return false; }
}

/** A handled preview import must reject to its caller without replacing the view. */
export function installStaleShellRecovery(target: Window, native: boolean, recover: () => void): void {
  // Native resources ship together in one immutable bundle. Reloading cannot fetch
  // a newer chunk, and an incidental tool failure must not restart the WebView.
  if (native) return;
  // Do not intercept vite:preloadError: preventDefault makes Vite resolve a failed
  // import with undefined, while recovering here also catches handled imports.
  target.addEventListener('unhandledrejection', event => {
    if (looksLikeChunkError(event)) { event.preventDefault(); recover(); }
  });
  target.addEventListener('error', event => {
    if (failedAppResource(event.target, target.location.href) || looksLikeChunkError(event)) recover();
  }, true);
}
