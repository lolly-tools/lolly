// SPDX-License-Identifier: MPL-2.0
import { COMMENT_BODY_LIMIT, type CommentAnchor, type CommentMessage, type CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CanvasCommentsCapability, CommentPermissions } from '../lib/canvas-comments.ts';
import { collabSurface } from '../lib/collab-surface.ts';
import { t } from '../i18n.ts';
import type { CollabSession } from '../lib/collab-session.ts';
import type { IconName } from '../lib/icons.ts';
import { mountCommentPresence } from './tool-comment-presence.ts';
import { commentIcon, commentPeople, commentAvatar, commentBubble, commentPin, commentText } from './tool-comment-chat.ts';
import type { CollabColor } from '../lib/collab-colors.ts';
import { wireCommentPanel } from './tool-comment-panel.ts';
import { createCommentReads, emptyFilterText, matchesFilter, mountCommentFilters, newestMessage, paintUnreadCount, threadInvolves, type CommentFilter } from './tool-comment-filters.ts';
import { attachMentionPicker, mentionIdsFor, mentionsMissed, mentionsOf, type MentionPicker } from './tool-comment-mentions.ts';
import { copyText, createTargetOpener, jumpToAnchor, objectPoint, pinsHidden, rememberPinsHidden, savedPoint, stepThread, type TargetOutcome } from './tool-comment-navigation.ts';

/** Polling is the fallback; with live comment events a slow poll only catches what an event missed. */
const POLL_MS = 2_000, EVENT_POLL_MS = 15_000, READ_DELAY_MS = 500, EVENT_DELAY_MS = 50, READ_BATCH = 100;
type Pinned = CommentAnchor & { at?: { x: number; y: number } };
const statusOf = (error: unknown): unknown => error && typeof error === 'object' && 'status' in error ? error.status : undefined;

/** Review chrome lives beside the artwork and never changes a tool input. */
export function mountCanvasComments(runtime: object, capability: CanvasCommentsCapability, stage: HTMLElement, canvas: HTMLElement, _layer: HTMLElement, preview?: (id: string) => { x: number; y: number; w: number; h: number; rot: number } | undefined, session?: CollabSession, colors?: readonly CollabColor[]) {
  const doc = stage.ownerDocument, win = doc.defaultView, abort = new (win?.AbortController ?? AbortController)();
  const open = doc.createElement('button'); open.type = 'button'; open.className = 'collab-comments-open btn btn--sm'; open.textContent = t('Comments'); open.hidden = true;
  const panel = doc.createElement('aside'); panel.className = 'collab-comments-panel'; panel.setAttribute('aria-label', t('Comments')); panel.hidden = true;
  const heading = doc.createElement('h2'); heading.textContent = t('Comments');
  const status = doc.createElement('p'); status.setAttribute('role', 'status');
  const list = doc.createElement('div'); list.className = 'collab-comment-list';
  const messages = doc.createElement('div'); messages.className = 'collab-comment-messages';
  messages.tabIndex = 0; messages.setAttribute('aria-label', t('Conversation'));
  const composer = doc.createElement('form'); composer.className = 'collab-comment-composer'; composer.hidden = true;
  const label = doc.createElement('label'), caption = doc.createElement('span'); caption.className = 'visually-hidden'; caption.textContent = t('Comment or reply'); label.append(caption);
  const input = doc.createElement('textarea'); input.className = 'field-input'; input.maxLength = COMMENT_BODY_LIMIT; input.rows = 2; input.placeholder = t('Comment or reply'); label.className = 'collab-comment-input-label'; label.append(input);
  const send = doc.createElement('button'); send.className = 'btn btn--primary btn--sm'; send.type = 'submit'; send.textContent = t('Send'); composer.append(label, send);
  commentIcon(send, 'Send'); commentIcon(open, 'Comments');
  const personColor = commentPeople(session, colors);
  const pins = doc.createElement('div'); pins.className = 'collab-comment-pins'; stage.append(pins);
  let disposed = false, busy = false, placing = false, enabled = false, selected: string | undefined, anchor: Pinned | undefined;
  let permissions: CommentPermissions | undefined, threads: CommentThread[] = [], painted = '', draftKey = '', draftTicket = 0, draftFailed = false;
  const pinNodes = new Map<string, HTMLButtonElement>(), pinPoints = new Map<string, { x: number; y: number }>();
  let listSignature = '', followLatest = true;
  let activePoll: Promise<void> | undefined;
  let controlsHost: HTMLElement | undefined;
  let editing: { id: string; body: string; mentions: Map<string, string> } | undefined;
  let commandId = crypto.randomUUID(), messageId = crypto.randomUUID(), draftChain: Promise<void> = Promise.resolve();
  let filter: CommentFilter = 'open', mentionsOn = false, suggestGone = false, eventsOn = false, hidePins = pinsHidden(win);
  let picker: MentionPicker | undefined, editorPicker: MentionPicker | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined, pollEvery = 0, readTimer: ReturnType<typeof setTimeout> | undefined, readFor: string | undefined;
  let eventTimer: ReturnType<typeof setTimeout> | undefined;
  const reads = createCommentReads(), changed = new Set<string>(), chosenByDraft = new Map<string, Map<string, string>>();
  const me = (): string => permissions?.userId ?? '';
  const current = (): CommentThread | undefined => threads.find(value => value.id === selected);
  const shown = (): CommentThread[] => threads.filter(thread => matchesFilter(thread, filter, me(), reads));
  const chosen = (key = draftKey): Map<string, string> => {
    const people = chosenByDraft.get(key) ?? new Map<string, string>(); chosenByDraft.set(key, people); return people;
  };
  const button = (text: string, glyph: IconName, action: () => void) => {
    const element = doc.createElement('button'); element.className = 'btn btn--sm btn--ghost'; element.type = 'button'; element.textContent = text;
    commentIcon(element, '', glyph);
    element.addEventListener('click', action); return element;
  };
  const close = button(t('Close comments'), 'close', () => { layout.setOpen(false); placing = false; open.focus(); });
  const point = button(t('Pin a comment'), 'pin', () => { placing = !placing; status.textContent = placing ? t('Choose an object or a point on the canvas.') : ''; });
  const onSelection = button(t('Comment on selection'), 'messageCircle', () => {
    const surface = collabSurface(runtime), id = surface?.selection()[0], object = id ? surface?.object?.(id) : undefined;
    if (!id || !surface?.collection || !object) { status.textContent = t('Select an object first.'); return; }
    start({ kind: 'object', collection: surface.collection, objectId: id, surface: surface.id(), x: .5, y: .5, at: objectPoint({ x: .5, y: .5 }, object) });
  });
  const atCenter = button(t('Comment at canvas center'), 'plus', () => {
    const surface = collabSurface(runtime), bounds = surface?.element()?.getBoundingClientRect();
    if (!surface?.fromClient || !bounds) return;
    const point = surface.fromClient({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    start({ kind: 'canvas', surface: surface.id(), ...point });
  });
  const pinsToggle = button(hidePins ? t('Show pins') : t('Hide pins'), hidePins ? 'eye' : 'eyeOff', () => {
    hidePins = !hidePins; rememberPinsHidden(win, hidePins); pins.hidden = hidePins;
    pinsToggle.textContent = hidePins ? t('Show pins') : t('Hide pins'); commentIcon(pinsToggle, '', hidePins ? 'eye' : 'eyeOff');
    reanchor();
  });
  pins.hidden = hidePins;
  const back = button(t('Comments'), 'arrowLeft', () => { selected = undefined; anchor = undefined; painted = ''; messages.replaceChildren(); renderList(); renderMessages(); }); back.hidden = true;
  const previous = button(t('Previous thread'), 'chevronLeft', () => { step(-1); });
  const next = button(t('Next thread'), 'chevronRight', () => { step(1); });
  const where = button(t('Show comment location'), 'pin', () => { const thread = current(); if (thread) showLocation(thread); });
  const copy = button(t('Copy link to thread'), 'link', () => { const thread = current(); if (thread) copyLink(thread); });
  const resolveSlot = doc.createElement('span'); resolveSlot.className = 'collab-comment-resolve';
  const reviewTools = doc.createElement('div'); reviewTools.className = 'collab-comment-thread-tools'; reviewTools.hidden = true;
  reviewTools.append(previous, next, where, copy, resolveSlot);
  const linkField = doc.createElement('input'); linkField.className = 'field-input collab-comment-link'; linkField.readOnly = true; linkField.hidden = true;
  linkField.setAttribute('aria-label', t('Copy link to thread'));
  const filters = mountCommentFilters(doc, value => { filter = value; listSignature = ''; renderList(); reanchor(); });
  const markAll = doc.createElement('button'); markAll.type = 'button'; markAll.className = 'btn btn--sm btn--ghost collab-comment-mark-read'; markAll.textContent = t('Mark all as read'); markAll.hidden = true;
  markAll.addEventListener('click', () => {
    markRead(threads.filter(thread => reads.unread(thread, me())));
    filters.element.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  });
  const filterBar = doc.createElement('div'); filterBar.className = 'collab-comment-filter-bar'; filterBar.hidden = true; filterBar.append(filters.element, markAll);
  const header = doc.createElement('header'); header.className = 'collab-comment-head'; header.append(back, heading, close);
  const actions = doc.createElement('div'); actions.className = 'collab-comment-actions'; actions.append(point, onSelection, atCenter, pinsToggle);
  panel.append(header, actions, reviewTools, status, linkField, filterBar, list, messages, composer); stage.append(open, panel);
  const layout = wireCommentPanel(panel, header, close);
  const presence = session && mountCommentPresence(panel, session, () => selected ?? anchor?.surface ?? 'document');
  const targets = createTargetOpener({
    capability, live: () => !session || session.state().connection === 'live',
    say: text => { if (!disposed) status.textContent = text; }, open: openTarget,
  });
  function queueDraft(key: string, body: string): void {
    draftChain = draftChain.catch(() => {}).then(() => capability.saveDraft(key, body)).catch(() => {
      draftFailed = true;
      if (!disposed) status.textContent = t('Your reply is only in this tab. Device storage is unavailable.');
    });
  }
  function chooseDraft(key: string): void {
    if (draftKey) queueDraft(draftKey, input.value);
    picker?.close(); draftKey = key; input.value = ''; const ticket = ++draftTicket;
    void draftChain.then(() => capability.loadDraft(key)).then(body => {
      if (!disposed && ticket === draftTicket && !input.value) input.value = body;
    }).catch(() => { if (!disposed) status.textContent = t('The saved reply could not be loaded on this device.'); });
  }
  input.addEventListener('input', () => { if (draftKey) queueDraft(draftKey, input.value); if (!input.value.trim()) resume(); }, { signal: abort.signal });
  /** A thread someone else's view opened (following them) while this person was writing: shown once the writing stops. */
  let deferred: { context?: string } | undefined;
  /** The person is writing here: a reply is on its way, or the composer or an edit field has focus and holds unsent text. */
  const writing = (): boolean => {
    const active = doc.activeElement;
    return busy || !!win && active instanceof win.HTMLTextAreaElement && panel.contains(active) && !!active.value.trim();
  };
  function resume(): void {
    if (!deferred || disposed || writing()) return;
    const { context } = deferred; deferred = undefined;
    void locate(context, { focus: false });
  }
  // Focus leaving the panel ends the writing; moving to Send or a mention inside the panel does not.
  panel.addEventListener('focusout', event => {
    const to = event.relatedTarget;
    if (!(win && to instanceof win.Node && panel.contains(to))) setTimeout(resume, 0);
  }, { signal: abort.signal });
  function start(value: Pinned): void {
    if (!permissions?.create) return;
    anchor = value; selected = undefined; placing = false; painted = ''; messages.replaceChildren(); linkField.hidden = true;
    commandId = crypto.randomUUID(); messageId = crypto.randomUUID(); chooseDraft('new'); composer.hidden = false; layout.setOpen(true);
    renderList(); status.textContent = t('New comment'); input.focus();
  }
  function select(id: string): void {
    followLatest = true;
    editing = undefined;
    selected = id; anchor = undefined; placing = false; painted = ''; commandId = crypto.randomUUID(); messageId = crypto.randomUUID(); linkField.hidden = true;
    chooseDraft(id); layout.setOpen(true); renderList(); renderMessages();
    presence?.activate();
  }
  function report(error: unknown): void {
    const code = statusOf(error);
    if (code === 401 || code === 403 || code === 410) {
      enabled = false; permissions = undefined; threads = []; list.replaceChildren(); messages.replaceChildren(); pins.replaceChildren();
      open.hidden = true; composer.hidden = true; placing = false; pinNodes.clear(); pinPoints.clear(); painted = ''; listSignature = '';
      input.disabled = true; picker?.close(); paintUnreadCount(open, 0);
      status.textContent = draftFailed ? t('Comment access ended. Device storage is unavailable.') : t('Comment access ended. Your unsent reply is kept on this device.');
    } else status.textContent = code === 429 ? t('You are commenting too quickly. Try again in a moment.')
      : code === 409 ? t('The thread changed. Your reply is kept. Refresh and send again.') : t('Comments could not be loaded. Try again.');
  }
  function pollInterval(): number { return eventsOn && session?.state().connection === 'live' ? EVENT_POLL_MS : POLL_MS; }
  function schedulePoll(): void {
    if (disposed) return;
    if (pollTimer) clearTimeout(pollTimer);
    pollEvery = pollInterval();
    pollTimer = setTimeout(() => { pollTimer = undefined; void refresh(); }, pollEvery);
  }
  /** A list that started before a single-thread fetch never rolls that thread back. */
  function merged(incoming: CommentThread[]): CommentThread[] {
    const known = new Map(threads.map(thread => [thread.id, thread]));
    return incoming.map(thread => { const have = known.get(thread.id); return have && have.revision > thread.revision ? have : thread; });
  }
  function refresh(): Promise<void> {
    if (disposed || busy || doc.hidden) { schedulePoll(); return Promise.resolve(); }
    if (activePoll) return activePoll;
    activePoll = capability.list().then(result => {
      if (disposed) return;
      enabled = result.enabled; permissions = result.permissions; threads = merged(result.threads); open.hidden = !enabled;
      reads.apply(result, !!capability.markRead);
      eventsOn = !!capability.changes && result.features?.events === true;
      mentionsOn = !suggestGone && !!capability.suggest && result.features?.mentions === true && permissions.create;
      syncMentions();
      if (!enabled) { layout.setOpen(false); pins.replaceChildren(); pinNodes.clear(); paintUnread(); return; }
      input.disabled = false;
      point.hidden = onSelection.hidden = atCenter.hidden = !permissions.create;
      if (filter === 'unread' && !reads.enabled) filters.choose('open');
      renderList(); renderMessages(); reanchor(); paintUnread();
      targets.ready();
    }).catch(error => {
      // A previous server has no review route. Keep its editing experience usable.
      if (statusOf(error) === 404 && !enabled) return;
      if (!disposed) report(error);
    }).finally(() => { activePoll = undefined; schedulePoll(); });
    return activePoll;
  }
  function suggestPeople(query: string) {
    const suggest = capability.suggest;
    return suggest ? suggest.call(capability, query) : Promise.resolve({ people: [], truncated: false });
  }
  function syncMentions(): void {
    if (mentionsOn && !picker) picker = attachMentionPicker(input, composer, { suggest: suggestPeople, chosen: () => chosen(), onError: mentionError });
    else if (!mentionsOn && picker) { picker.dispose(); picker = undefined; }
    const hint = mentionsOn ? t('Comment or reply. Type @ to mention someone.') : t('Comment or reply');
    if (input.placeholder !== hint) { input.placeholder = hint; caption.textContent = hint; }
  }
  function mentionError(error: unknown): void {
    const code = statusOf(error);
    // A host without suggestions answers 404, and 403 while commenting is off: offer no `@` here.
    if (code === 404 || code === 403) { suggestGone = true; mentionsOn = false; syncMentions(); painted = ''; renderMessages(); }
    else if (code === 429) status.textContent = t('You are commenting too quickly. Try again in a moment.');
  }
  function sentText(result: CommentThread & { notified?: boolean }, sent: string, requested: readonly string[]): string {
    return mentionsMissed(result, sent, requested) ? t('Some people were not notified because they cannot open this document.') : t('Comment saved.');
  }
  function paintUnread(): void {
    paintUnreadCount(open, enabled && reads.enabled ? threads.filter(thread => reads.unread(thread, me())).length : 0);
  }
  function markRead(items: readonly CommentThread[], at?: string): void {
    const mark = capability.markRead;
    if (!mark || !items.length) return;
    for (const thread of items) reads.markLocal(thread);
    listSignature = ''; renderList(); paintUnread();
    for (let index = 0; index < items.length; index += READ_BATCH) {
      const ids = items.slice(index, index + READ_BATCH).map(thread => thread.id);
      (at === undefined ? mark.call(capability, ids) : mark.call(capability, ids, at)).catch(error => {
        if (disposed) return;
        reads.forget(ids); listSignature = ''; renderList(); paintUnread();
        if (statusOf(error) === 429) status.textContent = t('You are commenting too quickly. Try again in a moment.');
      });
    }
  }
  /** A thread the person is looking at counts as read after a short pause, so walking past it does not. */
  function scheduleRead(thread: CommentThread): void {
    if (!reads.enabled || panel.hidden || !reads.unread(thread, me()) || readTimer && readFor === thread.id) return;
    if (readTimer) clearTimeout(readTimer);
    readFor = thread.id;
    readTimer = setTimeout(() => {
      readTimer = undefined; readFor = undefined;
      const now = current();
      if (!disposed && !panel.hidden && !doc.hidden && now?.id === thread.id && reads.unread(now, me())) markRead([now], newestMessage(now)?.iso);
    }, READ_DELAY_MS);
  }
  function renderList(): void {
    const listing = !selected && !anchor;
    list.hidden = !listing; back.hidden = listing; reviewTools.hidden = !selected;
    filterBar.hidden = !listing || !threads.length;
    const unread = new Set(threads.filter(thread => reads.unread(thread, me())).map(thread => thread.id));
    const counts = { open: 0, resolved: 0, unread: unread.size, involving: 0 };
    for (const thread of threads) {
      if (thread.resolvedAt) counts.resolved += 1; else counts.open += 1;
      if (threadInvolves(thread, me())) counts.involving += 1;
    }
    filters.paint(counts, reads.enabled); markAll.hidden = !reads.enabled || !unread.size;
    const signature = `${selected}:${filter}:${threads.map(thread => `${thread.id}:${thread.revision}:${unread.has(thread.id) ? 1 : 0}`).join(',')}`;
    if (listSignature === signature) return;
    listSignature = signature; list.replaceChildren();
    const visible = shown();
    if (!visible.length) {
      const empty = doc.createElement('p'); empty.className = 'team-project-notice';
      empty.textContent = threads.length ? emptyFilterText(filter) : t('Pin a comment to start a review.'); list.append(empty);
    }
    for (const thread of visible) list.append(threadRow(thread, threads.indexOf(thread) + 1, unread.has(thread.id)));
  }
  function threadRow(thread: CommentThread, number: number, unread: boolean): HTMLButtonElement {
    const item = doc.createElement('button'); item.type = 'button'; item.className = 'btn btn--sm btn--ghost collab-comment-thread';
    const body = thread.messages.find(message => !message.deletedAt)?.body ?? t('Deleted message');
    const snippet = doc.createElement('span'); snippet.className = 'collab-comment-preview';
    const name = doc.createElement('strong'); name.textContent = thread.authorName;
    const summary = doc.createElement('span'); summary.textContent = `${number}. ${thread.resolvedAt ? `${t('Resolved')}: ` : ''}${body.slice(0, 100)}`;
    snippet.append(name, summary); item.append(commentAvatar(doc, thread.authorName, personColor(thread.authorId), thread.authorId), snippet);
    if (unread) {
      const dot = doc.createElement('span'); dot.className = 'collab-comment-unread'; dot.setAttribute('aria-hidden', 'true');
      const text = doc.createElement('span'); text.className = 'visually-hidden'; text.textContent = t('Unread');
      item.append(dot, text); item.dataset.unread = 'true';
    }
    item.setAttribute('data-comment-thread', thread.id); item.setAttribute('aria-pressed', String(selected === thread.id));
    item.addEventListener('click', () => { select(thread.id); });
    return item;
  }
  async function act(thread: CommentThread, action: 'resolve' | 'reopen' | 'delete', message?: string): Promise<void> {
    if (busy) return; busy = true;
    try { await capability.command(thread, action, { ...(message ? { messageId: message } : {}) }); painted = ''; }
    catch (error) { report(error); }
    finally { busy = false; await refresh(); }
  }
  function step(direction: 1 | -1): void {
    const thread = stepThread(shown(), selected, direction);
    if (!thread) return;
    if (thread.id !== selected) select(thread.id);
    showLocation(thread);
  }
  function showLocation(thread: CommentThread): void {
    if (jumpToAnchor(runtime, thread.anchor) === 'deleted') status.textContent = t('The commented object was deleted. Showing where it was.');
    reanchor();
  }
  function copyLink(thread: CommentThread): void {
    const url = capability.link?.(thread.id);
    if (!url) return;
    void copyText(doc, url).then(copied => {
      if (disposed || selected !== thread.id) return;
      linkField.hidden = copied;
      if (copied) { status.textContent = t('Link copied. Only people who can open this document can use the link.'); return; }
      status.textContent = t('The link could not be copied. Copy it from here instead.');
      linkField.value = url; linkField.focus(); linkField.select();
    });
  }
  /** Mentions to send with an edit: only when the person chose someone new; otherwise the host keeps the stored ones. */
  function editMentions(message: CommentMessage, body: string): string[] | undefined {
    if (!mentionsOn || !editing) return undefined;
    const before = new Set(mentionsOf(message).map(person => person.id));
    return [...editing.mentions.keys()].some(id => !before.has(id)) ? mentionIdsFor(body, editing.mentions) : undefined;
  }
  function renderMessages(): void {
    const thread = current();
    composer.hidden = !permissions?.create || !thread && !anchor;
    if (!thread) { resolveSlot.replaceChildren(); return; }
    const walkable = shown(), solo = !walkable.length || walkable.length === 1 && walkable[0]!.id === thread.id;
    if (previous.disabled !== solo) previous.disabled = next.disabled = solo;
    const present = thread.anchor.kind !== 'object' || !!collabSurface(runtime)?.object?.(thread.anchor.objectId);
    const signature = `${thread.id}:${thread.revision}:${present}:${JSON.stringify(permissions)}:${mentionsOn}`;
    if (painted !== signature) paintThread(thread, signature, present);
    scheduleRead(thread);
  }
  function paintThread(thread: CommentThread, signature: string, present: boolean): void {
    const scrollTop = messages.scrollTop;
    const atEnd = followLatest || messages.scrollHeight - messages.clientHeight - scrollTop < 48;
    copy.hidden = !capability.link;
    resolveSlot.replaceChildren(); editorPicker?.dispose(); editorPicker = undefined;
    painted = signature; messages.replaceChildren();
    if (!present) { const missing = doc.createElement('p'); missing.textContent = t('Object deleted. This thread is still available.'); messages.append(missing); }
    for (const message of thread.messages) {
      const { article, bubble } = commentBubble(doc, message, personColor(message.authorId), message.authorId === permissions?.userId);
      bubble.append(commentText(doc, message, t('Deleted message')));
      const tools = doc.createElement('div'); tools.className = 'collab-comment-message-tools'; article.append(tools);
      if (!message.deletedAt && permissions?.editOwn && message.authorId === permissions.userId) {
        tools.append(button(t('Edit message'), 'pen', () => {
          editing = { id: message.id, body: message.body, mentions: new Map(mentionsOf(message).map(person => [person.id, person.name])) };
          painted = ''; renderMessages();
          const key = `edit:${thread.id}:${message.id}`;
          void draftChain.then(() => capability.loadDraft(key)).then(saved => {
            if (!disposed && editing?.id === message.id && editing.body === message.body && saved) { editing.body = saved; painted = ''; renderMessages(); }
          }).catch(report);
        }));
        if (editing?.id === message.id) {
          const editor = doc.createElement('textarea'); editor.className = 'field-input'; editor.rows = 4; editor.maxLength = COMMENT_BODY_LIMIT;
          editor.setAttribute('aria-label', t('Edit message')); editor.value = editing.body;
          const key = `edit:${thread.id}:${message.id}`, people = editing.mentions;
          editor.addEventListener('input', () => { if (editing?.id === message.id) editing.body = editor.value; queueDraft(key, editor.value); });
          bubble.append(editor, button(t('Save message'), 'check', () => {
            if (busy || !editor.value.trim()) return; busy = true;
            const requested = editMentions(message, editor.value);
            void capability.command(thread, 'edit', { messageId: message.id, body: editor.value, ...(requested ? { mentions: requested } : {}) }).then(result => {
              queueDraft(key, ''); editing = undefined; painted = ''; status.textContent = sentText(result, message.id, requested ?? []);
            }).catch(report).finally(() => { busy = false; void refresh(); });
          }), button(t('Cancel edit'), 'close', () => { queueDraft(key, ''); editing = undefined; painted = ''; renderMessages(); }));
          if (mentionsOn) editorPicker = attachMentionPicker(editor, bubble, { suggest: suggestPeople, chosen: () => people, onError: mentionError });
          editor.focus();
        }
      }
      if (!message.deletedAt && (permissions?.deleteAny || permissions?.editOwn && message.authorId === permissions.userId))
        tools.append(button(t('Delete message'), 'trash', () => { void act(thread, 'delete', message.id); }));
      messages.append(article);
    }
    if (permissions?.resolveAny || permissions?.create && thread.authorId === permissions.userId)
      resolveSlot.append(button(thread.resolvedAt ? t('Reopen thread') : t('Resolve thread'), thread.resolvedAt ? 'refresh' : 'check', () => { void act(thread, thread.resolvedAt ? 'reopen' : 'resolve'); }));
    followLatest = false;
    const settleScroll = () => { if (!disposed) messages.scrollTop = atEnd ? messages.scrollHeight : scrollTop; };
    if (win?.requestAnimationFrame) win.requestAnimationFrame(settleScroll); else settleScroll();
  }
  composer.addEventListener('submit', event => {
    event.preventDefault(); if (busy || !input.value.trim() || !permissions?.create) return;
    const body = input.value, thread = current(), destination = anchor, sentFrom = draftKey, sent = messageId;
    if (!thread && !destination) return;
    const requested = mentionsOn ? mentionIdsFor(body, chosen(sentFrom)) : [];
    busy = true; send.disabled = true; picker?.close();
    void (thread ? capability.command(thread, 'reply', { messageId, body, ...(requested.length ? { mentions: requested } : {}) })
      : capability.create(destination!, body, commandId, messageId, requested.length ? requested : undefined))
      .then(result => {
        if (disposed) return;
        followLatest = true; chosenByDraft.delete(sentFrom);
        queueDraft(sentFrom, ''); input.value = ''; selected = result.id; anchor = undefined; draftKey = result.id;
        messageId = crypto.randomUUID(); painted = ''; status.textContent = sentText(result, sent, requested);
      }).catch(report).finally(() => { busy = false; send.disabled = false; void refresh(); resume(); });
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
      start({ kind: 'object', surface: surface.id(), collection: surface.collection, objectId: id, at: point,
        x: Math.max(0, Math.min(1, .5 + (dx * Math.cos(rad) - dy * Math.sin(rad)) / object.w)),
        y: Math.max(0, Math.min(1, .5 + (dx * Math.sin(rad) + dy * Math.cos(rad)) / object.h)) });
    } else start({ kind: 'canvas', surface: surface.id(), ...point });
  }, { capture: true, signal: abort.signal });
  open.addEventListener('click', () => { layout.setOpen(panel.hidden); if (!panel.hidden) { void refresh(); close.focus(); } }, { signal: abort.signal });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); layout.setOpen(false); placing = false; open.focus(); return; }
    const field = (event.target as HTMLElement | null)?.tagName;
    if (!event.altKey || event.key !== 'ArrowUp' && event.key !== 'ArrowDown' || field === 'TEXTAREA' || field === 'INPUT') return;
    event.preventDefault(); step(event.key === 'ArrowDown' ? 1 : -1);
  }, { signal: abort.signal });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) void refresh(); }, { signal: abort.signal });
  function reanchor(): void {
    if (disposed || !enabled) return;
    if (controlsHost && !layout.positioned()) {
      const host = controlsHost.getBoundingClientRect(), style = win!.getComputedStyle(panel);
      if (host.height) {
        const bounds = stage.getBoundingClientRect(), compact = stage.dataset.designLayout === 'compact';
        const gap = parseFloat(style.paddingTop || '0');
        panel.style.top = `${host.bottom + gap}px`;
        if (compact) { panel.style.removeProperty('inset-inline-end'); panel.style.removeProperty('max-width'); }
        else {
          const dock = controlsHost.closest<HTMLElement>('.edge-dock')?.getBoundingClientRect(), rtl = style.direction === 'rtl';
          const left = Math.max(bounds.left, rtl && dock ? dock.right : bounds.left);
          const right = Math.min(bounds.right, !rtl && dock ? dock.left : bounds.right);
          panel.style.insetInlineEnd = `${Math.max(0, rtl ? Math.max(left, host.left) : win!.innerWidth - Math.min(right, host.right))}px`;
          panel.style.maxWidth = `${Math.max(0, right - left - gap * 2)}px`;
        }
      }
    }
    presence?.refresh();
    const used = new Set<string>();
    const surface = collabSurface(runtime), bounds = pins.getBoundingClientRect(); if (!surface?.toClient) return;
    renderMessages();
    threads.forEach((thread, index) => {
      const resolved = !!thread.resolvedAt;
      if (resolved && filter !== 'resolved' || thread.anchor.surface !== surface.id()) return;
      const anchor = thread.anchor; let point = { x: anchor.x, y: anchor.y }, missing = false;
      if (anchor.kind === 'object') {
        if (anchor.collection !== surface.collection) return;
        const geometry = surface.object?.(anchor.objectId);
        if (geometry) { point = objectPoint(anchor, { ...geometry, ...preview?.(anchor.objectId) }); pinPoints.set(thread.id, point); }
        else {
          // A deleted object keeps its pin, muted, where it last stood, until undo brings the object back.
          const last = pinPoints.get(thread.id) ?? savedPoint(anchor); if (!last) return;
          point = last; missing = true;
        }
      }
      const at = surface.toClient!(point); used.add(thread.id);
      let pin = pinNodes.get(thread.id);
      if (!pin) { pin = doc.createElement('button'); pin.type = 'button'; pinNodes.set(thread.id, pin); pins.append(pin); }
      commentPin(pin, index + 1, personColor(thread.authorId)); pin.className = 'collab-comment-pin'; pin.setAttribute('data-comment-thread', thread.id);
      pin.classList.toggle('is-resolved', resolved); pin.classList.toggle('is-missing', missing);
      pin.setAttribute('aria-label', `${t('Comment')} ${index + 1}: ${resolved ? `${t('Resolved')}: ` : ''}${thread.messages.find(message => !message.deletedAt)?.body.slice(0, 100) ?? t('Deleted message')}`);
      pin.style.left = `${at.x - bounds.left}px`; pin.style.top = `${at.y - bounds.top}px`;
    });
    for (const [id, pin] of pinNodes) if (!used.has(id)) { pin.remove(); pinNodes.delete(id); }
  }
  pins.addEventListener('click', event => {
    const id = (event.target as Element).closest<HTMLElement>('[data-comment-thread]')?.dataset.commentThread;
    if (id) { event.stopPropagation(); select(id); }
  }, { signal: abort.signal });
  /** Saved comment writes from the live room: fetch only the changed thread, a few at a time. */
  const offChanges = capability.changes?.subscribe(event => {
    if (disposed || !enabled) return;
    const known = threads.find(thread => thread.id === event.threadId);
    if (known && known.revision >= event.revision) return;
    changed.add(event.threadId);
    eventTimer ??= setTimeout(fetchChanged, EVENT_DELAY_MS);
  });
  function fetchChanged(): void {
    eventTimer = undefined;
    const ids = [...changed]; changed.clear();
    if (disposed || !ids.length) return;
    if (!capability.get) { void refresh(); return; }
    for (const id of ids) capability.get(id).then(thread => { applyThread(id, thread); }, () => { void refresh(); });
  }
  function applyThread(id: string, thread: CommentThread | null): void {
    if (disposed || !enabled || thread && thread.id !== id) return;
    const at = threads.findIndex(value => value.id === id);
    if (!thread) {
      if (at < 0) return;
      threads = threads.filter(value => value.id !== id);
      if (selected === id) { selected = undefined; painted = ''; messages.replaceChildren(); status.textContent = t('This thread was deleted or is no longer available.'); }
    } else if (at < 0) threads = [...threads, thread];
    else if (threads[at]!.revision < thread.revision) threads = threads.map(value => value.id === id ? thread : value);
    else return;
    renderList(); renderMessages(); reanchor(); paintUnread();
  }
  const offSession = session?.subscribe(state => {
    if (disposed) return;
    if (pollTimer && pollInterval() !== pollEvery) schedulePoll();
    if (state.connection === 'live') targets.retry();
  });
  /**
   * Show a thread, or close the panel with no context. `focus: false` is for a change the
   * person did not ask for (following someone): focus stays where it is, and while the
   * person is writing the change waits until they stop, so the field never changes under them.
   */
  async function locate(context?: string, opts: { focus?: boolean } = {}): Promise<void> {
    if (disposed) return;
    const quiet = opts.focus === false;
    if (quiet && writing()) { deferred = { context }; return; }
    deferred = undefined;
    if (context === undefined) { layout.setOpen(false); placing = false; return; }
    await refresh();
    if (disposed || !enabled || session && session.state().connection !== 'live') return;
    if (quiet && writing()) { deferred = { context }; return; }
    if (threads.some(thread => thread.id === context)) { if (selected !== context) select(context); }
    else { selected = undefined; anchor = undefined; messages.replaceChildren(); renderList(); renderMessages(); }
    layout.setOpen(true); if (!quiet) close.focus(); presence?.refresh();
    const thread = current(); if (thread) scheduleRead(thread);
  }
  /** A link or notification's thread: open it, then show where it is. */
  async function openTarget(id: string): Promise<TargetOutcome> {
    await locate(id);
    if (disposed || !enabled) return 'off';
    const thread = threads.find(value => value.id === id);
    if (!thread) return 'missing';
    status.textContent = ''; showLocation(thread);
    return 'opened';
  }
  void refresh();
  return { reanchor, refresh, locate, dockControls(container: HTMLElement) {
    controlsHost = container;
    open.classList.add('collab-comments-open--docked'); container.append(open);
  }, endAccess() { if (draftKey) queueDraft(draftKey, input.value); report({ status: 403 }); }, teardown() {
    if (disposed) return; disposed = true; if (draftKey) queueDraft(draftKey, input.value);
    for (const timer of [pollTimer, readTimer, eventTimer]) if (timer) clearTimeout(timer);
    offChanges?.(); offSession?.(); targets.dispose(); picker?.dispose(); editorPicker?.dispose();
    abort.abort(); layout.destroy(); pins.remove(); panel.remove(); open.remove();
    presence?.dispose();
  } };
}
