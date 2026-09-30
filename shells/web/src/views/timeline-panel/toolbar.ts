// SPDX-License-Identifier: MPL-2.0
import { t } from '../../i18n.ts';
import { announce } from '../../a11y.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { bindOp, type TpCtx } from './context.ts';

/** Keep common tasks visible and disclose the existing precision controls in place. */
export function wire(tp: TpCtx): void {
  const quick = document.createElement('div');
  quick.className = 'tl-quick-actions';
  if (tp.opts.addMedia) {
    const media = tp.helpers.actionBtn('tl-add-media', t('Add media'), 'image');
    media.addEventListener('click', async () => {
      if (media.disabled || tp.disposed) return;
      tp.clock.pause();
      tp.playback.syncPlayBtn();
      media.disabled = true;
      try {
        await tp.opts.addMedia?.();
      } catch (err) {
        tp.host.log?.('warn', `Add media failed: ${String(err)}`);
        announce(t('Could not add media. Please try again.'), { assertive: true });
      } finally {
        media.disabled = false;
        if (!tp.disposed && tp.open) media.focus();
      }
    });
    quick.append(media);
  }
  if (tp.addKinds.some(k => k.id === 'text')) {
    const text = tp.helpers.actionBtn('tl-add-text', t('Text'), 'font');
    text.addEventListener('click', () => tp.menus.emitAdd('text'));
    quick.append(text);
  }
  tp.captionsBtn = tp.helpers.actionBtn('tl-captions', t('Captions'), 'transcript');
  tp.captionsBtn.hidden = !tp.cfg.groupField || !tp.opts.textField || !tp.subtitles.textKind();
  tp.captionsBtn.addEventListener('click', () => {
    const ids = tp.selection.get();
    if (ids.length === 1 && tp.subtitles.canGenerateSubtitles(ids[0]!)) {
      void tp.subtitles.generateSubtitles(ids[0]!);
    } else {
      announce(tp.captionsBtn.getAttribute('data-tip') || '');
    }
  });
  quick.append(tp.captionsBtn);

  const record = tp.helpers.actionBtn('tl-record', t('Record'), 'mic');
  record.hidden = [tp.micBtn, tp.camBtn, tp.screenBtn, tp.scriptBtn].every(b => b.hidden);
  tp.recordMenu = mountBodyPopover(record, (el, pop) => {
    el.textContent = '';
    const actions = [
      [tp.screenBtn, 'monitor'], [tp.camBtn, 'camera'],
      [tp.micBtn, 'mic'], [tp.scriptBtn, 'speech'],
    ] as const;
    for (const [button, glyph] of actions) {
      if (button.hidden) continue;
      const item = tp.menus.menuItem(button.getAttribute('aria-label') || '', glyph, () => {
        pop.close(true);
        button.click();
      });
      item.disabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
      el.append(item);
    }
    return el.querySelector<HTMLElement>('button:not(:disabled)');
  }, {
    className: 'folder-menu tl-menu',
    ariaLabel: t('Record'),
    position: tp.menus.menuPosition,
  });
  record.addEventListener('click', () => {
    if (tp.recordMenu.isOpen()) tp.recordMenu.close(true);
    else tp.recordMenu.open();
  });
  quick.append(record);
  tp.editBtn = tp.helpers.actionBtn('tl-edit', t('Edit'), 'scissors');
  tp.editMenu = mountBodyPopover(tp.editBtn, (el, pop) => tp.selectionActions.render(el, pop, tp.editBtn), {
    className: 'folder-menu tl-menu tl-edit-menu',
    ariaLabel: t('Edit selected clips'), position: tp.menus.menuPosition,
  });
  tp.editBtn.addEventListener('click', () => {
    if (tp.editMenu.isOpen()) tp.editMenu.close(true);
    else {
      tp.clock.pause();
      tp.playback.syncPlayBtn();
      tp.editMenu.open();
    }
  });
  quick.append(tp.editBtn);

  const guide = tp.helpers.actionBtn('tl-guide', t('Guide'), 'help');
  tp.guideMenu = mountBodyPopover(guide, (el, pop) => {
    el.textContent = '';
    const heading = document.createElement('strong');
    heading.textContent = t('Make a video in three steps');
    const steps = document.createElement('ol');
    for (const text of [
      t('Add photos or video. They play in the order you choose.'),
      t('Add a title with Text. Select it to change the words and style.'),
      t('Press Play to watch. When you like it, use Export to save your video.'),
    ]) {
      const item = document.createElement('li');
      item.textContent = text;
      steps.append(item);
    }
    const tip = document.createElement('p');
    tip.textContent = t('Drag clips to change the order. Drag either end to change the length. Select several clips to edit them together.');
    const done = tp.helpers.actionBtn('tl-guide-done', t('Got it'), 'check');
    done.addEventListener('click', () => pop.close(true));
    el.append(heading, steps, tip, done);
    return done;
  }, {
    className: 'folder-menu tl-menu tl-guide-pop', role: 'dialog',
    ariaLabel: t('Quick video guide'), position: tp.menus.menuPosition,
  });
  guide.addEventListener('click', () => {
    if (tp.guideMenu.isOpen()) tp.guideMenu.close(true);
    else tp.guideMenu.open();
  });
  quick.append(guide);
  tp.tools.prepend(quick);

  for (const button of [tp.micBtn, tp.camBtn, tp.screenBtn]) button.classList.add('tl-record-source');
  for (const button of [tp.addBtn, tp.scriptBtn, tp.transcriptBtn, tp.onionBtn,
    tp.zoomOutBtn, tp.zoomInBtn, tp.keysBtn, tp.kfBtn]) button.classList.add('tl-secondary-tool');
  // Keep the original buttons and their anchors: keyframe and onion popovers still
  // open beside the control that owns them, and all keyboard commands keep working.
  const moreLabel = document.createElement('span');
  moreLabel.className = 'tl-action-label';
  moreLabel.textContent = t('More tools');
  tp.mobileToolsBtn.append(moreLabel);
  tp.mobileToolsBtn.classList.add('tl-action');
  tp.mobileToolsBtn.setAttribute('aria-label', t('More tools'));
  tp.mobileToolsBtn.removeAttribute('data-tip');
  sync(tp);
}

/** Selection/model changes only; this never runs on the playback clock. */
export function sync(tp: TpCtx): void {
  if (!tp.captionsBtn) return;
  const ids = tp.selection.get();
  if (tp.editBtn) {
    const key = JSON.stringify(ids);
    if (tp.editBtn.dataset.selection !== key) {
      tp.editMenu.close();
      tp.editBtn.dataset.selection = key;
      const label = tp.editBtn.querySelector('.tl-action-label');
      if (label) label.textContent = ids.length > 1 ? t('Edit {n}', { n: String(ids.length) }) : t('Edit');
      tp.editBtn.setAttribute('aria-label', ids.length === 1 ? t('Edit selected item')
        : ids.length ? t('Edit {n} selected items', { n: String(ids.length) }) : t('Edit clips'));
      tp.editBtn.dataset.tip = tp.editBtn.getAttribute('aria-label')!;
    }
  }
  const enabled = ids.length === 1 && tp.subtitles.canGenerateSubtitles(ids[0]!);
  tp.captionsBtn.setAttribute('aria-disabled', String(!enabled));
  tp.captionsBtn.setAttribute('data-tip', enabled ? t('Generate editable captions')
    : ids.length === 1 ? t('Select an audio or video clip with available speech recognition.')
      : t('Select one audio or video clip to add captions.'));
}

/** Keep the original controls as the owners of their actions and nested popovers. */
export function arrange(tp: TpCtx): void {
  const add = tp.helpers.actionBtn('tl-add-compact', t('Add'), 'plus');
  add.dataset.tip = t('Add media, text or a recording');
  const addControls = [...tp.tools.querySelectorAll<HTMLButtonElement>('.tl-add-media,.tl-add-text,.tl-record,.tl-add')];
  const primary = new Set<HTMLElement>([tp.editBtn, tp.mobileToolsBtn, tp.fitBtn, tp.alwaysBtn,
    ...tp.tools.querySelectorAll<HTMLElement>('.tl-track-size'), ...addControls]);
  const secondary = [...tp.tools.querySelectorAll<HTMLButtonElement>('button')].filter(button => !primary.has(button) && !button.classList.contains('tl-record-source') && button !== tp.scriptBtn);
  const parking = document.createElement('div'); parking.className = 'tl-tool-parking'; parking.hidden = true;
  tp.root.append(parking);
  for (const button of secondary) parking.append(button);
  for (const button of addControls) button.classList.add('tl-add-source');
  tp.tools.prepend(add);
  tp.tools.append(tp.editBtn, tp.tools.querySelector('.tl-track-size')!, tp.fitBtn, tp.alwaysBtn, tp.mobileToolsBtn);
  for (const button of tp.tools.querySelectorAll<HTMLButtonElement>('button')) {
    button.dataset.tip ||= button.getAttribute('aria-label') || button.textContent || '';
  }
  const menu = (trigger: HTMLButtonElement, controls: HTMLButtonElement[], grouped: boolean) => {
    let homes: Array<{ button: HTMLButtonElement; marker: Comment }> = [];
    let surface: HTMLElement | undefined;
    const pop = mountBodyPopover(trigger, (el) => {
      surface = el;
      el.replaceChildren();
      const groups = grouped ? [
        [t('Edit clips'), controls.filter(b => b.matches('.tl-split,.tl-captions,.tl-transcript,.tl-kf-btn'))],
        [t('View and timing'), controls.filter(b => !b.matches('.tl-split,.tl-captions,.tl-transcript,.tl-kf-btn,.tl-guide,.tl-keys'))],
        [t('Help'), controls.filter(b => b.matches('.tl-guide,.tl-keys'))],
      ] as const : [[t('Add'), controls]] as const;
      for (const [label, buttons] of groups) {
        const visible = buttons.filter(b => !b.hidden && (!b.matches('.tl-fit,.tl-always-on') || tp.root.dataset.toolbarDensity === 'compact'));
        if (!visible.length) continue;
        const heading = document.createElement('div'); heading.className = 'tl-tool-menu-heading'; heading.textContent = label; el.append(heading);
        for (const button of visible) {
          const marker = document.createComment('Sequence control'); button.replaceWith(marker); homes.push({ button, marker });
          if (!button.querySelector('.tl-action-label')) { const text = document.createElement('span'); text.className = 'tl-action-label'; text.textContent = button.getAttribute('aria-label') || ''; button.append(text); }
          el.append(button);
        }
      }
      return el.querySelector<HTMLElement>('button:not(:disabled)');
    }, {
      className: 'folder-menu tl-menu tl-tool-menu', ariaLabel: trigger.getAttribute('aria-label') || '',
      position: tp.menus.menuPosition,
      onResize: pop => pop.close(),
      isInside: node => { const child = (node as Element | null)?.closest?.('.tl-menu,.tl-ctx-menu,[role="dialog"]'); return !!child && child !== surface; },
      onClose() { for (const { button, marker } of homes) marker.replaceWith(button); homes = []; surface = undefined; },
    });
    trigger.addEventListener('click', () => { if (pop.isOpen()) pop.close(true); else pop.open(); });
    return pop;
  };
  tp.addToolsMenu = menu(add, addControls, false);
  tp.moreToolsMenu = menu(tp.mobileToolsBtn, [...secondary, tp.fitBtn, tp.alwaysBtn], true);
  tp.mobileToolsBtn.dataset.tip = t('More tools');
  const resize = (): void => {
    const width = tp.root.clientWidth;
    const density = width < 620 ? 'compact' : width < 1100 ? 'icons' : 'labels';
    if (tp.root.dataset.toolbarDensity === density) return;
    close(tp); tp.root.dataset.toolbarDensity = density;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined;
  observer?.observe(tp.root); resize();
  tp.toolbarDispose = () => { observer?.disconnect(); close(tp); parking.remove(); };
}

export function close(tp: TpCtx): void { tp.addToolsMenu?.close(); tp.moreToolsMenu?.close(); }

export function toolbarOps(tp: TpCtx) {
  return { wire: bindOp(tp, wire), sync: bindOp(tp, sync), arrange: bindOp(tp, arrange), close: bindOp(tp, close) };
}
