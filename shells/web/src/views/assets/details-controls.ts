// SPDX-License-Identifier: MPL-2.0
/** Editing controls in the inspector header, with sharing and file actions in the sidebar. */
import { wireMenuNavigation } from '../../components/menu-navigation.ts';
import { createThemeToggle } from '../../components/theme-toggle.ts';
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { catalogSubmitter } from '../../lib/catalog-submit.ts';
import { escape as escapeText } from '../../utils.ts';
import { bindOp, type DetailsCtx } from './details-context.ts';
import { CHEVRON_RIGHT, CROP_ICON, DOWNLOAD_ICON, EYE_ICON, EYE_OFF_ICON, PENCIL_ICON, REPLACE_ICON, SHARE_ICON, STAR_ICON, TAG_ICON, TRASH_ICON, emojiPackMeta } from './shared.ts';

interface EditAction {
  act: string;
  label: string;
  glyph: string;
  available: boolean;
  disabled?: boolean;
  menu?: boolean;
}

export function editingHtml(dt: DetailsCtx): string {
  const { cat, ref } = dt;
  if (cat.preview && ref.source === 'remote') return '';
  const actions: EditAction[] = [
    { act: 'open-with', label: t('Open with'), glyph: icon('box'), available: true, disabled: !cat.actions.choices([ref]).length, menu: true },
    { act: 'convert', label: t('Convert…'), glyph: REPLACE_ICON, available: true, disabled: !cat.actions.canConvert([ref]) },
    { act: 'open-3d', label: t('Open in 3D Studio'), glyph: icon('box'), available: ref.type === 'model' },
    { act: 'open-lut', label: t('Open in Darkroom'), glyph: icon('camera'), available: ref.type === 'lut' },
    { act: 'crop', label: t('Crop…'), glyph: CROP_ICON, available: dt.croppable },
    { act: 'retouch', label: t('Retouch…'), glyph: icon('stamp'), available: dt.canRetouch },
    { act: 'grade', label: t('Grade…'), glyph: icon('palette'), available: dt.canGrade },
    { act: 'darkroom', label: t('Open in Darkroom'), glyph: icon('camera'), available: dt.canGrade },
    { act: 'upscale', label: t('Upscale…'), glyph: icon('aiSpark'), available: dt.canUpscale },
    { act: 'matte', label: t('Remove background…'), glyph: icon('scissors'), available: dt.canMatte },
    { act: 'trim', label: t('Trim margins'), glyph: icon('fitContain'), available: dt.trimmable },
    { act: 'read-text', label: t('Read text'), glyph: icon('aiSpark'), available: dt.canOcr || dt.canReadDoc || dt.canReadVector },
    { act: 'extract-audio', label: t('Extract audio…'), glyph: icon('music'), available: dt.canExtractAudio },
    { act: 'edit-script', label: t('Edit script'), glyph: icon('mic'), available: dt.canEditScript },
    { act: 'vid-matte', label: t('Remove background…'), glyph: icon('scissors'), available: dt.canVideoMatte },
    { act: 'vid-crop', label: t('Crop…'), glyph: CROP_ICON, available: dt.canVideoCrop },
    { act: 'vid-upscale', label: t('Upscale…'), glyph: icon('aiSpark'), available: dt.canVideoUpscale },
    { act: 'vid-grade', label: t('Grade…'), glyph: icon('palette'), available: dt.canVideoGrade },
    { act: 'vid-trim', label: t('Trim…'), glyph: icon('filmStrip'), available: dt.canVideoTrim },
    // A brand skill is the brand team's own text: no AI-signal analysis, and no
    // character fixes on a file Lolly never rewrites (lib/text-kinds.ts).
    { act: 'analyse-text', label: t('Analyse text'), glyph: icon('aiSpark'), available: dt.isTextAsset && !dt.isSkillAsset },
    { act: 'humanize', label: t('Fix characters'), glyph: icon('wrench'), available: dt.isTextAsset && !dt.isSkillAsset },
    { act: 'copy-text', label: t('Copy text'), glyph: icon('duplicate'), available: dt.isTextAsset },
  ];
  return `<details class="cat-edit-toolbar">
    <summary class="btn cat-edit-heading" aria-haspopup="menu" aria-expanded="false">${PENCIL_ICON}<span>${t('Edit')}</span>${icon('chevronDown')}</summary>
    <div class="cat-edit-menu" role="menu" aria-label="${escapeText(t('Edit and transform'))}">
      ${actions.filter(a => a.available).map(a => `<button type="button" role="menuitem" class="cat-edit-tool cat-act-${a.act}" data-act="${a.act}" aria-label="${escapeText(a.label)}" title="${escapeText(a.disabled ? t('No compatible tool is available') : a.label)}"${a.disabled ? ' disabled' : ''}${a.menu ? ' aria-haspopup="menu"' : ''}>
        <span class="cat-edit-glyph" aria-hidden="true">${a.glyph}</span><span class="cat-edit-label">${escapeText(a.label)}</span>${a.menu ? `<span class="cat-edit-arrow" aria-hidden="true">${CHEVRON_RIGHT}</span>` : ''}
      </button>`).join('')}
    </div>
  </details>`;
}

export function sidebarHtml(dt: DetailsCtx): string {
  const { cat, ref, fav, isUser, hidden, configurable } = dt;
  const shared = !!cat.preview && ref.source === 'remote';
  const button = (act: string, label: string, glyph = '', cls = '', attrs = ''): string =>
    `<button type="button" class="btn ${cls}" data-act="${act}" ${attrs}>${glyph}<span>${escapeText(label)}</span></button>`;
  const sharing = [
    button('download', configurable ? t('Download…') : t('Download'), DOWNLOAD_ICON, 'cat-act-download'),
    dt.isTextAsset && !shared ? button('dl-as', t('Download as'), DOWNLOAD_ICON, 'cat-act-dl-as', 'aria-haspopup="menu" aria-expanded="false"') : '',
    button('share', t('Copy link'), SHARE_ICON, 'cat-act-share'),
    !shared || ref.meta?.projectFileId ? button('send', t('Send to…'), icon('upload'), 'cat-act-send') : '',
    !shared ? button('prepare', t('Prepare for sharing'), icon('shield')) : '',
  ].join('');
  const projectFile = !!ref.meta?.projectFileId;
  const projectActions = `${button('add-to-project', t('Copy to shared project…'), icon('folder'))}${catalogSubmitter('upload') ? button('catalog-submit', catalogSubmitter('upload')!.label(), icon('upload')) : ''}`;
  const management = projectFile ? `<details class="cat-action-group" open><summary>${t('File')}</summary><div class="cat-act-row">${projectActions}</div></details>` : shared ? '' : `<details class="cat-action-group">
    <summary>${t('File')}</summary><div class="cat-act-row">
      ${button('add-to-project', t('Add to project…'), icon('folder'))}
      ${button('recategorise', t('Recategorise…'), TAG_ICON)}
      ${isUser ? button('rename', t('Rename'), PENCIL_ICON) + button('replace', t('Replace…'), REPLACE_ICON) : ''}
      ${isUser && catalogSubmitter('upload') ? button('catalog-submit', catalogSubmitter('upload')!.label(), icon('upload')) : ''}
      ${isUser ? button('delete', t('Move to Trash'), TRASH_ICON, 'cat-act-danger') : hidden ? button('unhide', t('Unhide'), EYE_ICON) : button('hide', t('Hide'), EYE_OFF_ICON, 'cat-act-danger')}
    </div></details>`;
  return `<div class="cat-details-actions">
    ${shared ? '' : `<div class="cat-act-row">${button('fav', fav ? t('Favourited') : t('Favourite'), STAR_ICON, `cat-act-fav${fav ? ' is-fav' : ''}`, `data-sfx="twinkle" aria-pressed="${fav}"`)}
      ${emojiPackMeta(ref) ? button('use-emoji-set', t('Use this set'), icon('smile'), 'cat-act-use-emoji', 'aria-pressed="false"') : ''}</div>`}
    <details class="cat-action-group" open><summary>${t('Share & export')}</summary><div class="cat-act-row">${sharing}</div></details>
    ${management}
  </div>`;
}

/** Menu rows run directly on touch, pointer and keyboard activation. */
export function handleEditingClick(dt: DetailsCtx, e: MouseEvent): boolean {
  const tool = (e.target as HTMLElement).closest<HTMLButtonElement>('.cat-edit-tool');
  if (!tool) return false;
  if (tool.disabled) return true;
  if (!tool.hasAttribute('aria-haspopup')) {
    const menu = dt.dlg.querySelector<HTMLDetailsElement>('.cat-edit-toolbar');
    if (menu) menu.open = false;
  }
  return false;
}

export function wireControls(dt: DetailsCtx): void {
  const { dlg, host } = dt;
  const menu = dlg.querySelector<HTMLDetailsElement>('.cat-edit-toolbar');
  const trigger = menu?.querySelector<HTMLElement>('summary');
  if (menu && trigger) {
    wireMenuNavigation(menu);
    menu.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(menu.open)));
    trigger.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      menu.open = true;
      menu.querySelector<HTMLElement>('.cat-edit-tool:not(:disabled)')?.focus();
    });
    dlg.addEventListener('pointerdown', event => {
      if (!menu.contains(event.target as Node)) menu.open = false;
    });
  }
  const preview = dlg.querySelector<HTMLElement>('.cat-details-preview');
  if (!preview) return;
  let bar = preview.querySelector<HTMLElement>('.cat-stage-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'cat-stage-bar';
    preview.append(bar);
  }
  const hud = bar.querySelector<HTMLElement>('.cat-zoom-hud');
  const toggle = createThemeToggle(host, { className: 'cat-zoom-btn cat-inspect-theme' });
  if (hud) {
    const sep = document.createElement('span');
    sep.className = 'cat-zoom-sep';
    sep.setAttribute('aria-hidden', 'true');
    hud.append(sep, toggle);
  } else {
    const pill = document.createElement('div');
    pill.className = 'cat-zoom-hud';
    pill.append(toggle);
    bar.append(pill);
  }
}

export function controlsOps(dt: DetailsCtx) {
  return {
    editingHtml: bindOp(dt, editingHtml),
    sidebarHtml: bindOp(dt, sidebarHtml),
    handleEditingClick: bindOp(dt, handleEditingClick),
    wireControls: bindOp(dt, wireControls),
  };
}
