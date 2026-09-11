// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: copy to clipboard, send targets and preview.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { announce } from '../../a11y.js';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { sendTargetId, sendTargetsFor } from '../../lib/send-target.ts';
import { bumpMetric } from '../../metrics.js';
import { navigateTo } from '../../nav.js';
import { escape as escapeText, safeHref } from '../../utils.js';
import { captureThumbnail, exportTargetNode, flatExportNode } from '../tool-action-helpers.ts';
import { bindOp, type ActionsCtx } from './context.ts';

// Copies the current render to the clipboard. Shared by the Copy button and
// the `?copy` URL action. `fmtOverride` honours `?format=<format>&copy`.
export async function performCopy(ta: ActionsCtx, fmtOverride?: string): Promise<{ method: string } | undefined> {
  const { canvasEl, exportUnscaled, formatEl, formats, host, playShutter, runtime } = ta;
  const fmt = fmtOverride || formatEl?.value || (formats.includes('png') ? 'png' : formats[0]!);
  if (fmt === 'lolly') { announce(t('Download the editable .lolly file from Share.')); return; }

  // Universal copy, by format:
  //   • txt / md   → plain text
  //   • html       → rich HTML (so an email signature pastes formatted into Gmail)
  //   • everything else (raster, SVG, PDF, …) → a PNG bitmap
  // so a paste always yields something useful whatever format is selected.
  const TEXT_FORMATS = new Set(['txt', 'md', 'markdown']);
  if (TEXT_FORMATS.has(fmt)) {
    playShutter(); // parallel capture feedback - writeText must stay in-gesture
    const blob = await exportUnscaled(() =>
      runtime.export(flatExportNode(canvasEl), fmt, ta.dims.exportDims())
    );
    await host.clipboard.writeText(await blob.text());
    return;
  }

  if (fmt === 'html') {
    playShutter(); // parallel capture feedback - no off-screen resize to hide here
    // Clone the canvas, then scrub everything email clients strip or ignore.
    const clone = canvasEl!.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll<HTMLElement>('[data-canvas-input]')
      .forEach((el) => { el.removeAttribute('data-canvas-input'); });
    clone.querySelectorAll('script').forEach((el) => { el.remove(); });
    // <style> blocks - email clients (Gmail etc.) strip them; the template
    // already carries full inline styles so these are pure character waste.
    clone.querySelectorAll('style').forEach((el) => { el.remove(); });
    // Annotation comment markers (<!-- ci:id -->) - invisible, ~30 chars each.
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
    const comments: Comment[] = [];
    let commentNode: Node | null;
    while ((commentNode = walker.nextNode())) comments.push(commentNode as Comment);
    comments.forEach((n) => { n.parentNode?.removeChild(n); });

    // Wrap the async blob-URL → data-URL conversion in a Promise so ClipboardItem
    // receives it while navigator.clipboard.write() is still in gesture context.
    const htmlBlobPromise = (async () => {
      // Email signatures display at ≤200px, so cap encoding there; html tools
      // needing larger images can raise this in their own beforeExport hook.
      await Promise.all(
        [...clone.querySelectorAll('img')].map(async (img) => {
          const src = img.getAttribute('src');
          if (!src?.startsWith('blob:')) return;
          try {
            const dataUrl = await new Promise<string>((res, rej) => {
              const bmp = new Image();
              bmp.onload = () => {
                const MAX = 200;
                const scale = Math.min(1, MAX / Math.max(bmp.naturalWidth, bmp.naturalHeight));
                const w = Math.round(bmp.naturalWidth * scale);
                const h = Math.round(bmp.naturalHeight * scale);
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const ctx = c.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(bmp, 0, 0, w, h);
                res(c.toDataURL('image/jpeg', 0.75));
              };
              bmp.onerror = rej;
              bmp.src = src;
            });
            img.src = dataUrl;
          } catch {
            /* leave as-is if conversion fails */
          }
        })
      );
      return new Blob([clone.innerHTML], { type: 'text/html' });
    })();

    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        const textBlob = htmlBlobPromise.then((b) =>
          b.text().then((t) => {
            const d = document.createElement('div');
            d.innerHTML = t;
            return new Blob([d.textContent ?? ''], { type: 'text/plain' });
          })
        );
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': htmlBlobPromise, 'text/plain': textBlob }),
        ]);
        return;
      } catch {
        /* fall through to the bridge path */
      }
    }
    await host.clipboard.writeHtml(await htmlBlobPromise.then((b) => b.text()));
    return;
  }

  // Image copy. { shutter: true } closes the camera-iris BEFORE the off-screen
  // resize so its brief "shake" is hidden - exactly like exports - then opens it.
  // The clipboard write still stays in the user gesture because we hand the
  // shutter-delayed blob *promise* straight to ClipboardItem rather than awaiting
  // it first (awaiting before write() loses the gesture and the browser silently
  // denies the write; deferring the blob inside the promise is the cross-browser
  // pattern that survives the ~shutter delay). One export feeds both paths.
  const blobPromise = exportUnscaled(
    () => runtime.export(flatExportNode(canvasEl), 'png', ta.dims.exportDims()),
    { shutter: true }
  );
  if (navigator.clipboard?.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      return { method: 'clipboard' };
    } catch {
      /* fall through to the bridge path - blobPromise has already resolved */
    }
  }
  // Bridge path: image clipboard write unavailable (e.g. older Firefox) - this
  // returns { method: 'download' } when it falls back to saving the file instead.
  return host.clipboard.writeImage(await blobPromise);
}
export function renderSendTargets(ta: ActionsCtx, fmt: string): void {
  const { el } = ta;
  const box = el!.querySelector<HTMLElement>('[data-send-targets]');
  if (!box) return;
  const offered = sendTargetsFor(fmt);
  // ONE row for every destination, not a card each. Each target used to render as
  // a full .section-card with its own icon head and a full-width button, which gave
  // "Send to Google Drive" the same weight as Content protection - and more weight
  // than Download - for someone who has never connected a cloud. The head names the
  // job once; a destination is a compact button beside its siblings. The kind, the
  // status span and the delegated click handling are unchanged. The button now shows
  // the provider NAME rather than the target's own actionLabel ("Send to Google
  // Drive"), which would repeat the head next to it.
  box.innerHTML = offered.length
    ? `
      <div class="section-card export-send${ta.sendOpen ? ' is-open' : ''}">
        <button type="button" class="protection-head" data-action="send-toggle" aria-expanded="${ta.sendOpen}">${icon('share', { className: 'c2pa-icon' })}<span>${escapeText(t('Send to'))}</span></button>
        <div class="export-send-row" data-send-body style="display:${ta.sendOpen ? 'flex' : 'none'}">
          ${offered
            .map(
              (tg) => `
          <button type="button" data-send-kind="${escapeText(sendTargetId(tg))}"${tg.hint ? ` title="${escapeText(tg.hint)}"` : ''}>${icon('upload', { size: 14 })}<span>${escapeText(tg.label)}</span></button>
          <span class="send-status" data-send-status="${escapeText(sendTargetId(tg))}" role="status"></span>`
            )
            .join('')}
        </div>
      </div>`
    : '';
  // The container outlives its contents (it is emitted unconditionally so late
  // registration has somewhere to land), so it carries the empty state itself: no
  // destination for this format ⇒ nothing in the panel, exactly as when the row
  // wasn't rendered at all.
  box.hidden = !offered.length;
}
export async function preview(ta: ActionsCtx): Promise<void> {
  const { canvasEl, exportUnscaled, manifest, runtime } = ta;
  if (ta.previewing) return;
  ta.previewing = true;
  try {
    const fmt =
      (manifest.render.preview as { format?: string } | undefined)?.format ||
      manifest.render.formats[0]!;
    await exportUnscaled(() => runtime.export(exportTargetNode(canvasEl), fmt, ta.dims.exportDims()));
  } finally {
    ta.previewing = false;
  }
}
export function wireSendTargets(ta: ActionsCtx): void {
  const { actions, canvasEl, el, exportUnscaled, formatEl, formats, host, initialFmt, manifest, runtime } = ta;
  ta.copying.renderSendTargets(initialFmt ?? formats[0] ?? '');
  // …and load the built-in destinations, if this is the first export panel of the
  // session. They are no longer registered at boot (plans/155 Task 3.3 took ~59 KB of
  // OAuth/upload drivers off the boot graph for a capability most builds never use);
  // an export panel opening is the first moment anything consults them, so it is the
  // panel that fetches them. Memoised in lib/send-targets-builtin.ts, so every later
  // panel reuses one registration. The re-render is what makes the late arrival
  // invisible: the call above painted with whatever was registered at mount (nothing,
  // the first time), and this repaints against the real set - reading the CURRENT
  // format, since the user may have changed it while the drivers were in flight.
  // Kept as the shared promise: the export-home auto-send in the download handler
  // above awaits this same one rather than racing it (a download fired seconds after
  // mount would otherwise find an empty registry and silently skip the user's pinned
  // cloud). That is a read from a closure, so the declaration order is fine - the
  // handler cannot run before the panel is mounted.
  const sendTargetsReady = actions.includes('download')
    ? import('../../lib/send-targets-builtin.ts')
        .then((m) => m.ensureBuiltinSendTargets())
        .then(() => ta.copying.renderSendTargets(formatEl?.value || initialFmt || formats[0] || ''))
        .catch((err: unknown) => {
          console.error('Send destinations unavailable:', err);
        })
    : Promise.resolve(); ta.sendTargetsReady = sendTargetsReady;
  el.querySelector<HTMLElement>('[data-send-targets]')?.addEventListener('click', async (ev) => {
    // The header toggle rides the same delegated listener (the card is rebuilt
    // per format; the container survives) - same idiom as protection-toggle.
    const head = (ev.target as HTMLElement).closest?.('[data-action="send-toggle"]');
    if (head) {
      ta.sendOpen = el!.querySelector('.export-send')?.classList.toggle('is-open') ?? false;
      head.setAttribute('aria-expanded', String(ta.sendOpen));
      const bodyEl = el!.querySelector<HTMLElement>('[data-send-body]');
      if (bodyEl) bodyEl.style.display = ta.sendOpen ? 'flex' : 'none';
      return;
    }
    const btn = (ev.target as HTMLElement).closest?.(
      '[data-send-kind]'
    ) as HTMLButtonElement | null;
    if (!btn || btn.hasAttribute('disabled')) return;
    const targetId = btn.dataset.sendKind!;
    const fmt = formatEl?.value || initialFmt || formats[0] || '';
    const target = sendTargetsFor(fmt, 'export').find((tg) => sendTargetId(tg) === targetId);
    if (!target) return;
    const status = [...el!.querySelectorAll<HTMLElement>('[data-send-status]')].find(
      (candidate) => candidate.dataset.sendStatus === targetId
    );
    // Progress wording swaps the LABEL SPAN, not the button - the button also holds
    // the destination glyph, and writing textContent on it would delete that glyph
    // and never bring it back.
    const label = btn.querySelector<HTMLElement>('span') ?? btn;
    const prev = label.textContent;
    btn.toggleAttribute('disabled', true);
    btn.setAttribute('aria-busy', 'true');
    try {
      const name =
        el!.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ||
        ta.formatRules.autoFilename();
      // Destination first, bytes second: a target with a `prepare` (Penpot's
      // project + file-name picker) asks BEFORE anything renders, so the
      // question arrives while this is still a choice rather than after a wait
      // nobody asked for. Cancelling sends nothing. The mime is unknown until
      // the render, so it goes empty here.
      let choice: Record<string, unknown> | undefined;
      if (target.prepare) {
        const picked = await target.prepare({ name, format: fmt, mime: '' }, { anchor: btn });
        if (!picked) {
          if (status) status.textContent = t('Cancelled');
          return;
        }
        choice = picked;
      }
      label.textContent = t('Rendering…');
      const opts = {
        ...ta.dims.exportDims(),
        ...(target.requiresCredential
          ? { c2pa: true, ...(ta.dims.c2paDaysVal() ? { c2paDays: ta.dims.c2paDaysVal()! } : {}) }
          : {}),
        ...(fmt === 'emf' &&
        el!.querySelector<HTMLInputElement>('[data-action="emf-outline"]')?.checked
          ? { text: 'outline' as const }
          : {}),
      };
      // Multi-page/animated sends keep the whole canvas (their walkers need every
      // [data-pdf-page]); flat single-image sends target the active artboard.
      const multiPage =
        fmt === 'pdf' ||
        fmt === 'pdf-cmyk' ||
        fmt === 'pptx' ||
        fmt === 'penpot' ||
        fmt === 'docx' ||
        fmt === 'odt' ||
        ta.formatRules.isAnimatedFmt(fmt);
      const sendNode = multiPage ? exportTargetNode(canvasEl) : flatExportNode(canvasEl);
      const blob = await exportUnscaled(() => runtime.export(sendNode, fmt, opts), {
        shutter: true,
      });
      label.textContent = t('Sending…');
      const out = await target.send({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        name,
        format: fmt,
        mime: blob.type,
        choice,
      });
      if (status) {
        // The driver's url is REMOTE-SOURCED (an upload service's response), so it
        // must pass the scheme gate before it renders as a link - a bad one
        // degrades to the plain label.
        status.innerHTML =
          out.url && safeHref(out.url)
            ? // nosemgrep: lolly-href-escape-is-not-scheme-validation - safeHref()-gated in the guard above
              `<a href="${escapeText(out.url)}" target="_blank" rel="noopener">${escapeText(out.label)}</a>`
            : escapeText(out.label);
      }
      bumpMetric('filesRendered');
      announce(`Sent to ${target.label}`);
    } catch (err) {
      console.error(`Send to ${targetId} failed:`, err);
      const msg = String((err as Error)?.message || '');
      if (status)
        status.textContent = msg && msg.length <= 120 ? msg : t('Send failed - try again');
      announce('Send failed', { assertive: true });
    } finally {
      btn.removeAttribute('aria-busy');
      label.textContent = prev;
      btn.toggleAttribute('disabled', false);
    }
  });

  // "Make variants" / multi-edit - the icon button NEXT TO THE TOOL NAME (markup
  // in tool.ts's sidebar header; it lives outside `el`, hence the document lookup).
  // Deliberately not an export option: it's a step BEFORE export. The click opens
  // a how-many dropdown (a 2–8 quick-pick - multi-edit's grid holds far more now,
  // but a dropdown of one tool's variants stays short; for a big fan-out use the
  // gallery's multi-select "Make copies"); picking a count
  // persists the CURRENT live state into that many fresh sessions (labelled A…H -
  // the same payload + slot shape performSave writes, so they're ordinary saved
  // sessions everywhere) and jumps straight into multi-edit with them side by
  // side. The active session's own slot is untouched: variants are copies, so
  // the experiments never overwrite the original.
  const multiBtn = document.getElementById('multi-edit-btn') as HTMLButtonElement | null; ta.multiBtn = multiBtn as ActionsCtx['multiBtn'];
  if (multiBtn) {
    const makeVariants = async (count: number): Promise<void> => {
      if (multiBtn.dataset.saving) return;
      multiBtn.dataset.saving = '1';
      multiBtn.disabled = true;
      multiBtn.setAttribute('aria-busy', 'true');
      try {
        const data = ta.saving.sessionSnapshot();
        // One thumbnail serves every copy - they start identical.
        const thumb = await captureThumbnail(
          manifest,
          canvasEl,
          runtime,
          exportUnscaled,
          data.__export_format
        );
        const stamp = Date.now();
        const slots: string[] = [];
        for (let i = 0; i < count; i++) {
          const slot = `${manifest.id}:${stamp + i}`; // ms offset keeps the minted slots unique
          await host.state.save(slot, { ...data, __label: String.fromCharCode(65 + i) }, thumb);
          slots.push(slot);
        }
        announce('Saved');
        // The shape mountMultiEdit parses (main.ts route 'multi': ?s=slot,slot…).
        navigateTo(`#/multi?s=${slots.map(encodeURIComponent).join(',')}`);
      } catch (err) {
        console.error('Make variants failed:', err);
        announce('Save failed');
      } finally {
        multiBtn.disabled = false;
        multiBtn.removeAttribute('aria-busy');
        delete multiBtn.dataset.saving;
      }
    };
    const menu = mountBodyPopover(
      multiBtn,
      (pop) => {
        pop.innerHTML = `
        <div class="multi-edit-menu-head">${t('How many copies?')}</div>
        <div class="multi-edit-menu-counts">${[2, 3, 4, 5, 6, 7, 8]
          .map(
            (n) =>
              `<button type="button" class="multi-edit-count" role="menuitem" data-count="${n}">${n}</button>`
          )
          .join('')}</div>`;
        pop.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((b) =>
          { b.addEventListener('click', () => {
            menu.close();
            void makeVariants(Number(b.dataset.count));
          }); }
        );
        return pop.querySelector<HTMLElement>('[data-count]');
      },
      {
        className: 'multi-edit-menu',
        ariaLabel: t('Make variants'),
        // Left-aligned under the trigger (the default is right-aligned - built for
        // the top-right chrome; this trigger sits in the LEFT sidebar).
        position(pop, anchor) {
          const r = anchor.getBoundingClientRect();
          pop.style.top = `${Math.round(r.bottom + 8)}px`;
          pop.style.left = `${Math.max(8, Math.round(r.left))}px`;
        },
      }
    );
    multiBtn.addEventListener('click', () => {
      menu.isOpen() ? menu.close(true) : menu.open();
    });
  }

  // Apply the initial (or restored) dimensions to the canvas preview immediately.
  ta.video.refreshCanvasPreview();

  // Render to the live frame for PREVIEW only (deferred-preview tools - see
  // manifest.render.preview). We run the normal export pipeline purely for its
  // side effect: an expensive beforeExport hook (e.g. url-shot's page capture)
  // paints its result into the canvas DOM. We then discard the blob - no
  // download, no clipboard. The painted frame stays until the next input change
  // rebuilds the template (which correctly invalidates the stale preview).
  ta.previewing = false;
}

export function copyingOps(ta: ActionsCtx) {
  return {
    performCopy: bindOp(ta, performCopy),
    renderSendTargets: bindOp(ta, renderSendTargets),
    preview: bindOp(ta, preview),
    wireSendTargets: bindOp(ta, wireSendTargets),
  };
}
