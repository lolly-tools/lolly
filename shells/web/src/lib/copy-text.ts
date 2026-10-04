// SPDX-License-Identifier: MPL-2.0
/** Report clipboard success honestly and remove the temporary selection field. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* try the selection copy below */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(ta);
  try {
    ta.select();
    return typeof document.execCommand === 'function' && document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}
