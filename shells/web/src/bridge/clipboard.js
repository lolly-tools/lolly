// SPDX-License-Identifier: MPL-2.0
/**
 * ClipboardAPI — text and image clipboard ops with graceful fallback.
 */

// Download extension for an image MIME. A bare `type.split('/')[1]` yields
// "svg+xml" for SVG (→ a broken "image.svg+xml" name); map the common types and
// strip any structured-syntax suffix for the rest.
const IMAGE_EXT = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};
function imageExt(mime) {
  return IMAGE_EXT[mime] || (mime?.split('/')[1] || 'png').replace(/\+.*$/, '');
}

export function createClipboardAPI() {
  return {
    async writeText(text) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      // Fallback for very old browsers / insecure contexts.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    },

    // Writes an HTML fragment to the clipboard so email clients paste it as rich
    // text. Includes a plain-text fallback for clients that don't accept text/html.
    async writeHtml(html) {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          await navigator.clipboard.write([new ClipboardItem({
            'text/html':  new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([tmp.textContent ?? ''], { type: 'text/plain' }),
          })]);
          return;
        } catch (e) { /* fall through to selection fallback */ }
      }
      // Fallback: inject a hidden node, select its contents, execCommand.
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      Object.assign(tmp.style, { position: 'fixed', pointerEvents: 'none', opacity: '0' });
      document.body.appendChild(tmp);
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(tmp);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
      document.body.removeChild(tmp);
    },

    async writeImage(blob) {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          return { method: 'clipboard' };
        } catch (e) {
          // Fall through to download.
        }
      }
      // Fallback: trigger a download instead. Tools that ask for clipboard
      // get a guaranteed outcome — the user gets the image one way or another.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image.${imageExt(blob.type)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { method: 'download' };
    },
  };
}
