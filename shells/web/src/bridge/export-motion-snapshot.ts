// SPDX-License-Identifier: MPL-2.0
export function snapshotMotion(node: Element, selector = 'video'): () => void {
  if (!node.querySelectorAll) return () => {};
  const swaps: { video: HTMLElement; still: HTMLElement; prevDisplay: string }[] = [];
  for (const el of [...node.querySelectorAll(selector)]) {
    const video = el as HTMLVideoElement;
    try {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h || video.readyState < 2) continue;   // no decoded frame yet
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(video, 0, 0, w, h);                 // SecurityError if the video is cross-origin tainted
      const still = document.createElement('img');
      still.src = canvas.toDataURL('image/png');        // also throws SecurityError if tainted - caught below
      // Marked so a renderer that decodes the video ITSELF can hide the freeze
      // instead of baking it in. The sequence compositor needs exactly that on the
      // ZIP path, where the guard above keys on the outer 'zip' format and the
      // frozen still therefore already exists by the time mp4/webm re-dispatches.
      still.setAttribute('data-motion-still', '1');
      // Reproduce the on-screen framing: the class + inline style carry sizing
      // (e.g. .lolly-box-img width/height + object-fit), and the computed
      // replaced-element props cover a tool that set them elsewhere.
      still.className = video.className;
      const styleAttr = video.getAttribute('style');
      if (styleAttr) still.setAttribute('style', styleAttr);
      const cs = getComputedStyle(video);
      still.style.objectFit = cs.objectFit;
      still.style.objectPosition = cs.objectPosition;
      still.style.borderRadius = cs.borderRadius;
      video.parentNode?.insertBefore(still, video);
      const prevDisplay = video.style.display;
      video.style.display = 'none';                     // keep only the still in the serialised tree
      swaps.push({ video, still, prevDisplay });
    } catch { /* tainted or undecodable - leave the video as-is rather than throw */ }
  }
  return () => {
    for (const { video, still, prevDisplay } of swaps) {
      still.remove();
      video.style.display = prevDisplay;
    }
  };
}
