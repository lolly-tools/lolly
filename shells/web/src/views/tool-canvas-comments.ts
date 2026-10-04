// SPDX-License-Identifier: MPL-2.0
import { COMMENT_BODY_LIMIT, type CommentAnchor, type CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CanvasCommentsCapability, CommentPermissions } from '../lib/canvas-comments.ts';
import { collabSurface } from '../lib/collab-surface.ts';
import { t } from '../i18n.ts';

/** Review chrome lives beside the artwork and never changes a tool input. */
export function mountCanvasComments(runtime: object, capability: CanvasCommentsCapability, stage: HTMLElement, canvas: HTMLElement, _layer: HTMLElement, preview?: (id: string) => { x: number; y: number; w: number; h: number; rot: number } | undefined) {
  const doc = stage.ownerDocument, abort = new (doc.defaultView?.AbortController ?? AbortController)();
  const open = doc.createElement('button'); open.type = 'button'; open.className = 'collab-comments-open btn btn--sm'; open.textContent = t('Comments'); open.hidden = true;
  const panel = doc.createElement('aside'); panel.className = 'collab-comments-panel'; panel.setAttribute('aria-label', t('Comments')); panel.hidden = true;
  const heading = doc.createElement('h2'); heading.textContent = t('Comments');
  const status = doc.createElement('p'); status.setAttribute('role', 'status');
  const list = doc.createElement('div'); list.className = 'collab-comment-list';
  const messages = doc.createElement('div'); messages.className = 'collab-comment-messages';
  const composer = doc.createElement('form'); composer.className = 'collab-comment-composer'; composer.hidden = true;
  const label = doc.createElement('label'); label.textContent = t('Comment or reply');
  const input = doc.createElement('textarea'); input.className = 'field-input'; input.maxLength = COMMENT_BODY_LIMIT; input.rows = 4; label.append(input);
  const send = doc.createElement('button'); send.className = 'btn btn--primary btn--sm'; send.type = 'submit'; send.textContent = t('Send'); composer.append(label, send);
  const pins = doc.createElement('div'); pins.className = 'collab-comment-pins'; stage.append(pins);
  let disposed = false, busy = false, placing = false, polling = false, enabled = false, selected: string | undefined, anchor: CommentAnchor | undefined;
  let permissions: CommentPermissions | undefined, threads: CommentThread[] = [], painted = '', draftKey = '', draftTicket = 0, draftFailed = false;
  const pinNodes = new Map<string, HTMLButtonElement>();
  let listSignature = '';
  let editing: { id: string; body: string } | undefined;
  let commandId = crypto.randomUUID(), messageId = crypto.randomUUID(), draftChain: Promise<void> = Promise.resolve();
  const button = (text: string, action: () => void) => {
    const element = doc.createElement('button'); element.className = 'btn btn--sm btn--ghost'; element.type = 'button'; element.textContent = t(text);
    element.addEventListener('click', action); return element;
  };
  const close = button('Close comments', () => { panel.hidden = true; placing = false; open.focus(); });
  const point = button('Pin a comment', () => { placing = !placing; status.textContent = placing ? t('Choose an object or a point on the canvas.') : ''; });
  const onSelection = button('Comment on selection', () => {
    const surface = collabSurface(runtime), id = surface?.selection()[0];
    if (!id || !surface?.collection || !surface.object?.(id)) { status.textContent = t('Select an object first.'); return; }
    start({ kind: 'object', collection: surface.collection, objectId: id, surface: surface.id(), x: .5, y: .5 });
  });
  const atCenter = button('Comment at canvas center', () => {
    const surface = collabSurface(runtime), bounds = surface?.element()?.getBoundingClientRect();
    if (!surface?.fromClient || !bounds) return;
    const point = surface.fromClient({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    start({ kind: 'canvas', surface: surface.id(), ...point });
  });
  const header = doc.createElement('header'); header.className = 'collab-comment-head'; header.append(heading, close);
  const actions = doc.createElement('div'); actions.className = 'collab-comment-actions'; actions.append(point, onSelection, atCenter);
  panel.append(header, actions, status, list, messages, composer); stage.append(open, panel);
  function queueDraft(key: string, body: string): void {
    draftChain = draftChain.catch(() => {}).then(() => capability.saveDraft(key, body)).catch(() => {
      draftFailed = true;
      if (!disposed) status.textContent = t('Your reply is only in this tab. Device storage is unavailable.');
    });
  }
  function chooseDraft(key: string): void {
    if (draftKey) queueDraft(draftKey, input.value);
    draftKey = key; input.value = ''; const ticket = ++draftTicket;
    void draftChain.then(() => capability.loadDraft(key)).then(body => {
      if (!disposed && ticket === draftTicket && !input.value) input.value = body;
    }).catch(() => { if (!disposed) status.textContent = t('The saved reply could not be loaded on this device.'); });
  }
  input.addEventListener('input', () => { if (draftKey) queueDraft(draftKey, input.value); }, { signal: abort.signal });
  function start(value: CommentAnchor): void {
    if (!permissions?.create) return;
    anchor = value; selected = undefined; placing = false; painted = ''; messages.replaceChildren();
    commandId = crypto.randomUUID(); messageId = crypto.randomUUID(); chooseDraft('new'); composer.hidden = false; panel.hidden = false;
    status.textContent = t('New comment'); input.focus();
  }
  function select(id: string): void {
    editing = undefined;
    selected = id; anchor = undefined; placing = false; painted = ''; commandId = crypto.randomUUID(); messageId = crypto.randomUUID();
    chooseDraft(id); panel.hidden = false; renderList(); renderMessages();
  }
  function report(error: unknown): void {
    const code = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    if (code === 401 || code === 403 || code === 410) {
      enabled = false; permissions = undefined; threads = []; list.replaceChildren(); messages.replaceChildren(); pins.replaceChildren();
      open.hidden = true; composer.hidden = true; placing = false; pinNodes.clear(); painted = ''; listSignature = '';
      input.disabled = true;
      status.textContent = draftFailed ? t('Comment access ended. Device storage is unavailable.') : t('Comment access ended. Your unsent reply is kept on this device.');
    } else status.textContent = code === 409 ? t('The thread changed. Your reply is kept. Refresh and send again.') : t('Comments could not be loaded. Try again.');
  }
  async function refresh(): Promise<void> {
    if (disposed || polling || busy || doc.hidden) return;
    polling = true;
    try {
      const next = await capability.list(); if (disposed) return;
      enabled = next.enabled; permissions = next.permissions; threads = next.threads; open.hidden = !enabled;
      if (!enabled) { panel.hidden = true; pins.replaceChildren(); pinNodes.clear(); return; }
      input.disabled = false;
      point.hidden = onSelection.hidden = atCenter.hidden = !permissions.create;
      renderList(); renderMessages(); reanchor();
    } catch (error) {
      // A previous server has no review route. Keep its editing experience usable.
      if (error && typeof error === 'object' && 'status' in error && error.status === 404 && !enabled) return;
      if (!disposed) report(error);
    } finally { polling = false; }
  }
  function renderList(): void {
    const signature = `${selected}:${threads.map(thread => `${thread.id}:${thread.revision}`).join(',')}`;
    if (listSignature === signature) return;
    listSignature = signature; list.replaceChildren();
    if (!threads.length) { const empty = doc.createElement('p'); empty.className = 'team-project-notice'; empty.textContent = t('Pin a comment to start a review.'); list.append(empty); }
    threads.forEach((thread, index) => {
      const body = thread.messages.find(message => !message.deletedAt)?.body ?? t('Deleted message');
      const item = button(`${index + 1}. ${thread.resolvedAt ? t('Resolved') + ': ' : ''}${body.slice(0, 100)}`, () => select(thread.id));
      item.classList.add('collab-comment-thread');
      item.setAttribute('data-comment-thread', thread.id); item.setAttribute('aria-pressed', String(selected === thread.id)); list.append(item);
    });
  }
  async function act(thread: CommentThread, action: 'resolve' | 'reopen' | 'delete', message?: string): Promise<void> {
    if (busy) return; busy = true;
    try { await capability.command(thread, action, { ...(message ? { messageId: message } : {}) }); painted = ''; }
    catch (error) { report(error); }
    finally { busy = false; await refresh(); }
  }
  function renderMessages(): void {
    const thread = threads.find(value => value.id === selected);
    composer.hidden = !permissions?.create || !thread && !anchor;
    const present = thread?.anchor.kind !== 'object' || !!collabSurface(runtime)?.object?.(thread.anchor.objectId);
    const signature = thread ? `${thread.id}:${thread.revision}:${present}:${JSON.stringify(permissions)}` : '';
    if (!thread || painted === signature) return;
    painted = signature; messages.replaceChildren();
    const location = button('Show comment location', () => {
      if (thread.anchor.kind === 'object') collabSurface(runtime)?.reveal?.(thread.anchor.objectId);
      reanchor();
    }); messages.append(location);
    const object = thread.anchor.kind === 'object' ? collabSurface(runtime)?.object?.(thread.anchor.objectId) : true;
    if (!object) { const missing = doc.createElement('p'); missing.textContent = t('Object deleted. This thread is still available.'); messages.append(missing); }
    for (const message of thread.messages) {
      const article = doc.createElement('article'), author = doc.createElement('strong'), body = doc.createElement('p');
      author.textContent = message.authorName; body.textContent = message.deletedAt ? t('Deleted message') : message.body; article.append(author, body);
      if (!message.deletedAt && permissions?.editOwn && message.authorId === permissions.userId) {
        article.append(button('Edit message', () => {
          editing = { id: message.id, body: message.body }; painted = ''; renderMessages();
          const key = `edit:${thread.id}:${message.id}`;
          void draftChain.then(() => capability.loadDraft(key)).then(saved => {
            if (!disposed && editing?.id === message.id && editing.body === message.body && saved) { editing.body = saved; painted = ''; renderMessages(); }
          }).catch(report);
        }));
        if (editing?.id === message.id) {
          const editor = doc.createElement('textarea'); editor.className = 'field-input'; editor.rows = 4; editor.maxLength = COMMENT_BODY_LIMIT;
          editor.setAttribute('aria-label', t('Edit message')); editor.value = editing.body;
          const key = `edit:${thread.id}:${message.id}`;
          editor.addEventListener('input', () => { if (editing?.id === message.id) editing.body = editor.value; queueDraft(key, editor.value); });
          article.append(editor, button('Save message', () => {
            if (busy || !editor.value.trim()) return; busy = true;
            void capability.command(thread, 'edit', { messageId: message.id, body: editor.value }).then(() => {
              queueDraft(key, ''); editing = undefined; painted = ''; status.textContent = t('Comment saved.');
            }).catch(report).finally(() => { busy = false; void refresh(); });
          }), button('Cancel edit', () => { queueDraft(key, ''); editing = undefined; painted = ''; renderMessages(); }));
          editor.focus();
        }
      }
      if (!message.deletedAt && (permissions?.deleteAny || permissions?.editOwn && message.authorId === permissions.userId))
        article.append(button('Delete message', () => { void act(thread, 'delete', message.id); }));
      messages.append(article);
    }
    if (permissions?.resolveAny || permissions?.create && thread.authorId === permissions.userId)
      messages.append(button(thread.resolvedAt ? 'Reopen thread' : 'Resolve thread', () => { void act(thread, thread.resolvedAt ? 'reopen' : 'resolve'); }));
  }
  composer.addEventListener('submit', event => {
    event.preventDefault(); if (busy || !input.value.trim() || !permissions?.create) return;
    const body = input.value, thread = threads.find(value => value.id === selected), destination = anchor;
    if (!thread && !destination) return;
    busy = true; send.disabled = true;
    void (thread ? capability.command(thread, 'reply', { messageId, body }) : capability.create(destination!, body, commandId, messageId))
      .then(result => {
        if (disposed) return;
        queueDraft(draftKey, ''); input.value = ''; selected = result.id; anchor = undefined; draftKey = result.id;
        messageId = crypto.randomUUID(); painted = ''; status.textContent = t('Comment saved.');
      }).catch(report).finally(() => { busy = false; send.disabled = false; void refresh(); });
  }, { signal: abort.signal });
  canvas.addEventListener('pointerdown', event => {
    if (!placing || !permissions?.create || event.button !== 0) return;
    const surface = collabSurface(runtime); if (!surface?.fromClient) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const point = surface.fromClient({ x: event.clientX, y: event.clientY });
    const element = (event.target as Element).closest<HTMLElement>('[data-box-id]'), id = element?.dataset.boxId;
    const object = id && surface.object?.(id);
    if (id && object && surface.collection) {
      const rad = -object.rot * Math.PI / 180, dx = point.x - object.x - object.w / 2, dy = point.y - object.y - object.h / 2;
      start({ kind: 'object', surface: surface.id(), collection: surface.collection, objectId: id,
        x: Math.max(0, Math.min(1, .5 + (dx * Math.cos(rad) - dy * Math.sin(rad)) / object.w)),
        y: Math.max(0, Math.min(1, .5 + (dx * Math.sin(rad) + dy * Math.cos(rad)) / object.h)) });
    } else start({ kind: 'canvas', surface: surface.id(), ...point });
  }, { capture: true, signal: abort.signal });
  open.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) { void refresh(); close.focus(); } }, { signal: abort.signal });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); panel.hidden = true; placing = false; open.focus(); } }, { signal: abort.signal });
  function reanchor(): void {
    if (disposed || !enabled) return;
    const used = new Set<string>();
    const surface = collabSurface(runtime), bounds = pins.getBoundingClientRect(); if (!surface?.toClient) return;
    renderMessages();
    threads.forEach((thread, index) => {
      if (thread.resolvedAt || thread.anchor.surface !== surface.id()) return;
      const anchor = thread.anchor; let point = { x: anchor.x, y: anchor.y };
      if (anchor.kind === 'object') {
        if (anchor.collection !== surface.collection) return;
        const current = surface.object?.(anchor.objectId); if (!current) return;
        const object = { ...current, ...preview?.(anchor.objectId) };
        const dx = (anchor.x - .5) * object.w, dy = (anchor.y - .5) * object.h, rad = object.rot * Math.PI / 180;
        point = { x: object.x + object.w / 2 + dx * Math.cos(rad) - dy * Math.sin(rad), y: object.y + object.h / 2 + dx * Math.sin(rad) + dy * Math.cos(rad) };
      }
      const at = surface.toClient!(point); used.add(thread.id);
      let pin = pinNodes.get(thread.id);
      if (!pin) { pin = doc.createElement('button'); pin.type = 'button'; pinNodes.set(thread.id, pin); pins.append(pin); }
      pin.textContent = String(index + 1); pin.className = 'collab-comment-pin'; pin.setAttribute('data-comment-thread', thread.id);
      pin.setAttribute('aria-label', `${t('Comment')} ${index + 1}: ${thread.messages.find(message => !message.deletedAt)?.body.slice(0, 100) ?? t('Deleted message')}`);
      pin.style.left = `${at.x - bounds.left}px`; pin.style.top = `${at.y - bounds.top}px`;
    });
    for (const [id, pin] of pinNodes) if (!used.has(id)) { pin.remove(); pinNodes.delete(id); }
  }
  pins.addEventListener('click', event => {
    const id = (event.target as Element).closest<HTMLElement>('[data-comment-thread]')?.dataset.commentThread;
    if (id) { event.stopPropagation(); select(id); }
  }, { signal: abort.signal });
  const timer = setInterval(() => { void refresh(); }, 2_000); void refresh();
  return { reanchor, refresh, dockControls(container: HTMLElement) {
    open.classList.add('collab-comments-open--docked'); container.append(open);
  }, endAccess() { if (draftKey) queueDraft(draftKey, input.value); report({ status: 403 }); }, teardown() {
    if (disposed) return; disposed = true; if (draftKey) queueDraft(draftKey, input.value);
    clearInterval(timer); abort.abort(); pins.remove(); panel.remove(); open.remove();
  } };
}
