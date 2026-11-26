// SPDX-License-Identifier: MPL-2.0

/** Append a stylesheet to the document head unless its id already exists. */
export function injectStyleOnce(id: string, css: string, doc?: Document | null): void {
  const d = doc ?? (typeof document !== 'undefined' ? document : null);
  if (!d || d.getElementById(id)) return;
  const style = d.createElement('style');
  style.id = id;
  style.textContent = css;
  d.head.appendChild(style);
}
