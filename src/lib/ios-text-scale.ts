// SPDX-License-Identifier: MPL-2.0
/** WebKit's system body style follows iOS Dynamic Type, including per-app Text
 * Size. Keep the probe alive: a one-shot sample misses Control Centre changes.
 * Scale the shell's existing type/icon/control tokens, preserving render units.
 * https://webkit.org/blog/3709/using-the-system-font-in-web-content/ */
export function mountIOSTextScale(root = document.documentElement): () => void {
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;'
    + 'contain:layout style;white-space:nowrap;font:-apple-system-body;line-height:normal;'
    + '-webkit-text-size-adjust:none;';
  probe.textContent = 'Dynamic Type';
  root.appendChild(probe);
  let last = '';
  const refresh = (): void => {
    const size = parseFloat(getComputedStyle(probe).fontSize);
    if (!Number.isFinite(size) || size <= 0) return;
    const scale = (size / 17).toFixed(4);
    if (scale === last) return;
    last = scale;
    root.style.setProperty('--a11y-os-fs', scale);
    root.toggleAttribute('data-ios-large-type', size / 17 > 1.5);
  };
  // The probe changes size when WebKit invalidates its system font. Resume
  // events also cover Settings round trips and a restored/suspended webview.
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
  observer?.observe(probe);
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  const resume = (): void => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', resume);
  refresh();
  return () => {
    observer?.disconnect();
    window.removeEventListener('focus', refresh);
    window.removeEventListener('pageshow', refresh);
    document.removeEventListener('visibilitychange', resume);
    probe.remove();
    root.style.removeProperty('--a11y-os-fs');
    root.removeAttribute('data-ios-large-type');
  };
}
