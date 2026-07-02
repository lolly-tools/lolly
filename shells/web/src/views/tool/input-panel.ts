// SPDX-License-Identifier: MPL-2.0
/**
 * The sidebar input panel (findings 1 + 6): renderInputs / controlHtml and the
 * per-control wiring (custom slider, vector scrub, blocks, pickers), plus the
 * per-instance gesture state and the createInputPanel instance API.
 *
 * `sliderDragging` and `blockDrag` used to be module-global `let`s in tool.js,
 * so the main sidebar panel and the nested embed-editor panel — which render
 * through the exact same renderInputs path — shared one set of drag flags. A
 * slider drag in one could suppress the other's rebuild, and a block-reorder in
 * one leaked into the other. Making the panel an INSTANCE gives each its own
 * gesture state: the main sidebar creates one, the embed editor creates another,
 * and they never touch each other's flags.
 */
import type { Runtime, InputModelItem, InputValue, BlocksDropToAdd, BlockFieldSpec } from '@lolly/engine';
import flatpickr from 'flatpickr';
import { escape } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { PALETTE } from '../../palette.ts';
import { colorFieldHtml, wireColorField } from '../../components/color-field.ts';
import { helpTip, wireHelpTips, linkHelpDescriptions } from '../../components/help-tip.ts';
import { canSkipInputsRebuild } from '../inputs-sync.ts';
import {
  nestingActive, nestingConfig, deriveBlockKeys, blockParentIndex,
  blockTreeOrder, blockReparentMove, buildRefOptions, materializeRefTarget,
} from '../block-tree.ts';
import type { WebHost } from '../../bridge/index.ts';
import type { InputHistory } from './input-history.ts';
import { blockFieldDefault, fmtBytes } from './constants.ts';
import { fileToRef, makeBlocksDropper } from './drop.ts';
import { toggleBlock, scrollToControl } from './canvas.ts';
// NB: embed-editor.ts and this module are mutually recursive by design — the
// panel opens the embed editor (Edit / configure-then-insert affordances), and
// the embed editor drives its own panel instance. Both references resolve at
// call time, so the ESM cycle is safe.
import { openEmbedEditor } from './embed-editor.ts';

/** The active drag intent while dropping a block near another (tree layouts). */
export type BlockDropIntent = 'before' | 'after' | 'inside';

/** The in-flight block drag-reorder gesture, or null when none is active. */
export interface BlockDrag {
  /** The blocks input whose child is being dragged. */
  inputId: string;
  /** The source index of the dragged block. */
  from: number;
  /** Where it will land relative to the hovered block (tree mode), or null. */
  intent: BlockDropIntent | null;
  /** The index currently hovered over, or null. */
  over: number | null;
}

/**
 * The mutable gesture state one input panel owns. Passed to renderInputs and the
 * per-control wiring so a drag in one panel can't affect another panel's flags.
 */
export interface GestureState {
  /**
   * True while a custom slider / vector-field scrub is in progress, so the panel
   * isn't rebuilt mid-drag (which would kill pointer capture). The canvas still
   * updates live via the runtime subscriber.
   */
  sliderDragging: boolean;
  /** The active block drag-reorder gesture (survives a single renderInputs pass). */
  blockDrag: BlockDrag | null;
}

/** Create a fresh, independent gesture-state object for one input panel instance. */
export function createGestureState(): GestureState {
  return { sliderDragging: false, blockDrag: null };
}

/** The history slice panel edits route through (the embed editor's silent controller also satisfies it). */
export type PanelHistory = Pick<InputHistory, 'set'>;
/** The runtime slice the panel reads. */
export type PanelRuntime = Pick<Runtime, 'getModel'>;
/** The host the panel drives (picker, embed editing, uploads). The embed editor
 *  needs the full runtime-capable host too, so this stays the assembled WebHost. */
export type PanelHost = WebHost;

/** One row of a blocks array (free-form sub-field map). */
type BlockRow = { [key: string]: InputValue | undefined };

/** Structured (indexable) input value — a vector compound or a blocks row. */
const isRecord = (v: InputValue | undefined): v is BlockRow =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);

const asRow = (v: InputValue | undefined): BlockRow => (isRecord(v) ? v : {});

const asString = (v: InputValue | undefined): string | undefined =>
  typeof v === 'string' ? v : undefined;

/** The panel container element; renderInputs parks its document-level dismissers on it. */
export interface PanelContainer extends HTMLElement {
  _colorPopoverDismiss?: (e: MouseEvent) => void;
  _blockMenuDismiss?: (e: MouseEvent) => void;
  _helpTipDismiss?: (e: MouseEvent) => void;
}

/** The two-step block remove button arms itself with these expandos. */
interface ConfirmButton extends HTMLElement {
  _armed?: boolean;
  _disarm?: (() => void) | null;
}

/** A block drag handle flags the click that trails a drag. */
interface DragHandle extends HTMLElement {
  _dragJustHappened?: boolean;
}

/** A flatpickr-enhanced input carries its instance for teardown. */
interface FlatpickrHost extends HTMLInputElement {
  _flatpickr?: { destroy(): void };
}

/**
 * Reflect a model change in the sidebar with the least work. renderInputs()
 * rebuilds the whole panel's innerHTML and re-wires every listener (and
 * destroys/recreates each flatpickr) — necessary on first render or a structural
 * change, but pure waste on a keystroke, where the only change is a value the
 * edited field already shows. In that case (canSkipInputsRebuild) the rebuild is
 * skipped entirely. Returns the model to remember as the new baseline.
 */
export function syncInputs(
  el: PanelContainer,
  model: InputModelItem[],
  prevModel: InputModelItem[] | undefined,
  runtime: PanelRuntime,
  history: PanelHistory,
  gesture: GestureState,
  host: PanelHost,
  onDirty: ((id: string) => void) | undefined,
): InputModelItem[] {
  if (canSkipInputsRebuild(el, model, prevModel)) return model;
  renderInputs(el, model, runtime, history, gesture, host, onDirty);
  return model;
}

export function renderInputs(
  el: PanelContainer,
  model: InputModelItem[],
  runtime: PanelRuntime,
  history: PanelHistory,
  gesture: GestureState,
  host: PanelHost,
  onDirty: ((id: string) => void) | undefined,
): void {
  const modelValues: Record<string, InputValue | undefined> = Object.fromEntries(model.map(i => [i.id, i.value]));
  const panelModel = model.filter(i => {
    if (i.group === 'export') return false;
    if (!i.showIf) return true;
    return Object.entries(i.showIf).every(([k, v]) => modelValues[k] === v);
  });

  const active       = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusId      = active?.dataset?.inputId;
  const blockFocusId = active?.dataset?.fieldId;
  // Vector number fields can't use data-input-id (that's the container) or
  // data-field-id (the blocks handler claims those), so restore them by
  // "<inputId>::<fieldId>".
  const vecFocusKey  = active?.classList?.contains('vec-num')
    ? `${active.closest<HTMLElement>('[data-input-id]')?.dataset.inputId}::${active.dataset.vecField}`
    : null;
  const isTextField  = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  const selStart     = isTextField ? active.selectionStart : null;
  const selEnd       = isTextField ? active.selectionEnd : null;

  const renderOneInput = (input: InputModelItem): string => {
    const isCheckbox = input.control === 'checkbox';
    // The datetime field is a flatpickr (altInput) control, and the whole panel
    // re-renders on every keystroke — a floating label would re-animate from its
    // resting to floating position each time the value re-populates and visibly
    // wobble. Pin it to a static label above the field instead.
    const isStaticLabel = input.control === 'datetime-local-input';
    // Composite controls hold MANY interactive elements. A wrapping <label> makes the
    // browser forward any dead-space click to the label's first labelable descendant —
    // so a `blocks` input forwards gap / pill-body / near-miss clicks to block #0's
    // collapse chevron (the reported "clicking the 2nd scene expands the 1st"), and a
    // `vector` input forwards to its first number field. Wrap these in a <div role=group>
    // instead: the caption still names them (aria-labelledby), but it never proxies clicks.
    const isComposite = ['blocks', 'vector', 'asset-picker', 'file-picker', 'color-picker'].includes(input.control);
    const cls = `input-row${isCheckbox ? ' input-row--checkbox' : ''}${isStaticLabel ? ' input-row--static-label' : ''}`;
    const valueTag = input.control === 'slider'
      ? ` <span class="input-value">${parseFloat(String(input.value ?? 0))}</span>`
      : '';
    const labelId = `irow-label-${escape(input.id)}`;
    // Help moves behind an info button (see help-tip.js). The label id rides on the
    // text span only, so a composite's aria-labelledby never absorbs "More info".
    const ht = input.help ? helpTip(input.help) : null;
    const labelText = `<span class="input-label-text"${isComposite ? ` id="${labelId}"` : ''}>${escape(input.label ?? input.id)}${valueTag}</span>`;
    const label = `<span class="input-label">${labelText}${ht ? ht.button : ''}</span>`;
    const control = controlHtml(input, modelValues);
    const help = ht ? ht.pop : '';
    if (isCheckbox) return `<label class="${cls}">${control}${label}${help}</label>`;
    if (isComposite) return `<div class="${cls}" role="group" aria-labelledby="${labelId}">${label}${control}${help}</div>`;
    return `<label class="${cls}">${label}${control}${help}</label>`;
  };

  const openSections = new Set(
    [...el.querySelectorAll('.input-section[open] .input-section-summary')].map(s => s.textContent)
  );

  // Folded blocks carry no model value, so capture which are collapsed and re-apply
  // once the panel HTML is regenerated. Tree blocks key by their stable derived id
  // (data-block-key) so fold state follows a card across a drag-reparent reorder;
  // others key by array index as before.
  const foldKey = (b: HTMLElement): string => `${b.closest<HTMLElement>('.blocks-input')?.dataset.inputId}:${b.dataset.blockKey || b.dataset.blockIndex}`;
  const collapsedBlocks = new Set(
    [...el.querySelectorAll<HTMLElement>('.block-item.is-collapsed')].map(foldKey)
  );

  const parts: string[] = [];
  let openSection: string | null = null;
  for (const input of panelModel) {
    const sec = input.section ?? null;
    if (sec !== openSection) {
      if (openSection !== null) parts.push('</div></details>');
      if (sec !== null) {
        const wasOpen = openSections.has(sec);
        parts.push(`<details class="input-section"${wasOpen ? ' open' : ''}><summary class="input-section-summary">${escape(sec)}</summary><div class="input-section-body">`);
      }
      openSection = sec;
    }
    parts.push(renderOneInput(input));
  }
  if (openSection !== null) parts.push('</div></details>');
  el.innerHTML = parts.join('');

  const collapseBlock = (item: Element): void => {
    item.classList.add('is-collapsed');
    const btn = item.querySelector('[data-block-collapse]');
    btn?.setAttribute('aria-label', 'Expand block');
    btn?.setAttribute('title', 'Expand');
  };
  // On the first render of a freshly-mounted tool, fold every typed block so the
  // sidebar opens as a clean, scannable list — the user expands the ones they
  // want to edit. On later re-renders, preserve whatever the user had folded
  // (captured above); newly-added blocks stay open.
  const firstRender = !el.dataset.blocksDefaulted;
  el.dataset.blocksDefaulted = '1';
  if (firstRender) {
    el.querySelectorAll('.block-item.is-typed').forEach(collapseBlock);
  } else if (collapsedBlocks.size) {
    el.querySelectorAll<HTMLElement>('.block-item.is-typed').forEach(item => {
      if (collapsedBlocks.has(foldKey(item))) collapseBlock(item);
    });
  }

  // Reflect the live fold state on each blocks input's "Collapse all" pill: when
  // every block is already folded it offers "Expand all", otherwise "Collapse all".
  // Called after the fold-restore pass above and after every fold change (chevron,
  // header click, the pill itself) so the label never goes stale.
  const syncCollapseAllPills = (): void => {
    el.querySelectorAll('.blocks-input').forEach(wrap => {
      const pill = wrap.querySelector<HTMLElement>('[data-blocks-collapse-all]');
      if (!pill) return;
      const blocks = [...wrap.querySelectorAll('.block-item.is-typed')];
      const allFolded = blocks.length > 0 && blocks.every(b => b.classList.contains('is-collapsed'));
      pill.dataset.mode = allFolded ? 'expand' : 'collapse';
      pill.textContent = allFolded ? 'Expand all' : 'Collapse all';
      pill.setAttribute('aria-label', allFolded ? 'Expand all blocks' : 'Collapse all blocks');
    });
  };
  syncCollapseAllPills();

  const restoreFocus = (restored: HTMLElement | null): void => {
    if (!restored) return;
    restored.focus();
    if (selStart != null && (restored instanceof HTMLInputElement || restored instanceof HTMLTextAreaElement) && restored.setSelectionRange) {
      restored.setSelectionRange(selStart, selEnd);
    }
  };

  if (focusId) {
    restoreFocus(el.querySelector<HTMLElement>(`[data-input-id="${CSS.escape(focusId)}"]`));
  }

  if (blockFocusId) {
    restoreFocus(el.querySelector<HTMLElement>(`[data-field-id="${CSS.escape(blockFocusId)}"]`));
  }

  if (vecFocusKey) {
    const [vid = '', vfield = ''] = vecFocusKey.split('::');
    const restored = el.querySelector<HTMLElement>(
      `.vector-input[data-input-id="${CSS.escape(vid)}"] .vec-num[data-vec-field="${CSS.escape(vfield)}"]`
    );
    restored?.focus(); // number inputs expose no caret to restore
  }

  el.querySelectorAll<HTMLElement>('[data-input-id]').forEach(control => {
    const id    = control.dataset.inputId;
    if (id == null) return;
    const input = panelModel.find(i => i.id === id);

    if (input?.control === 'slider') {
      setupCustomSlider(control, runtime, history, gesture, id, onDirty);
      return;
    }

    if (input?.control === 'asset-picker') {
      control.addEventListener('click', async () => {
        const ref = await host.assets.pick({
          title:       `Choose ${input.label ?? input.id}`,
          type:        input.assetType === 'any' ? undefined : asAssetType(input.assetType),
          tags:        filterTags(input.filter),
          namespace:   filterNamespace(input.filter),
          allowUpload: input.allowUpload === true,
          current:     asString(asRow(input.value).id),
          // Picking a tool in the picker opens its inputs first (configure → insert),
          // reusing the same in-place editor the "from <tool>" Edit badge uses.
          editTool:    (toolUrl) => openEmbedEditor(host, { editUrl: toolUrl, slotLabel: input.label ?? input.id, mode: 'insert' }),
        });
        if (ref) { void history.set(id, ref); onDirty?.(id); }
      });
      return;
    }

    if (input?.control === 'file-picker') {
      const native  = control.querySelector<HTMLInputElement>('.file-native');
      const trigger = control.querySelector<HTMLElement>('.file-trigger');
      const clearer = control.querySelector<HTMLElement>('.file-clear');
      // Revoke the previous preview object URL so picking a new file doesn't leak.
      const revokePrev = (): void => {
        const prev = runtime.getModel().find(i => i.id === id)?.value;
        const url = asString(asRow(prev).url);
        if (url) URL.revokeObjectURL(url);
      };
      trigger?.addEventListener('click', () => native?.click());
      clearer?.addEventListener('click', () => { revokePrev(); void history.set(id, null); onDirty?.(id); });
      native?.addEventListener('change', async () => {
        const file = native.files && native.files[0];
        if (!file) return;
        if (input.maxSize && file.size > input.maxSize) {
          announce(`That file is too large (max ${fmtBytes(input.maxSize)}).`, { assertive: true });
          native.value = '';
          return;
        }
        const ref = await fileToRef(file);
        revokePrev();
        void history.set(id, ref);
        onDirty?.(id);
      });
      return;
    }

    if (input?.control === 'datetime-local-input') return; // handled by flatpickr onClose
    if (input?.control === 'color-picker') return; // native picker handled by color-popover-native listener

    if (input?.control === 'vector') {
      setupVectorControl(control, runtime, history, gesture, id, onDirty, input);
      return;
    }

    control.addEventListener('input', (e) => {
      if (e.target !== control) return; // block fields bubble up — ignore them here
      // 'input' only ever fires here on real form controls; the guard just proves it.
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return;
      const value = control instanceof HTMLInputElement && control.type === 'checkbox' ? control.checked : control.value;
      void history.set(id, value);
    });
  });

  el.querySelectorAll<FlatpickrHost>('.fp-datetime').forEach(control => {
    const id       = control.dataset.inputId;
    if (id == null) return;
    const initVal  = control.dataset.fpValue || null;
    const existing = control._flatpickr;
    if (existing) existing.destroy();
    flatpickr(control, {
      enableTime:    true,
      dateFormat:    'Y-m-dTH:i',
      altInput:      true,
      altFormat:     'D j M Y h:iK',
      defaultDate:   initVal || undefined,
      allowInput:    false,
      time_24hr:     true,
      disableMobile: true,
      onReady(_, __, fp) {
        if (fp.altInput) fp.altInput.placeholder = control.placeholder || 'Live — current time';
      },
      // onClose fires once when the picker closes, after the user has finished
      // picking both the date and time. onChange would fire mid-interaction and
      // trigger renderInputs → el.innerHTML reset → destroying the open calendar.
      onClose(selectedDates, dateStr) {
        const next = selectedDates.length ? dateStr : '';
        void history.set(id, next);
        onDirty?.(id);
      },
    });
  });

  el.querySelectorAll<HTMLElement>('[data-clear-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const clearId = btn.dataset.clearId;
      if (clearId == null) return;
      void history.set(clearId, null);
      onDirty?.(clearId);
    });
  });

  // Edit a Lolly-sourced image in place: re-open the source tool's own inputs
  // (pre-filled from the asset's stored embed URL), tweak, and re-apply the new
  // render to this same slot. Only present when the asset carries meta.toolUrl.
  el.querySelectorAll<HTMLElement>('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const editId  = btn.dataset.editId;
      if (editId == null) return;
      const cur     = panelModel.find(i => i.id === editId);
      const toolUrl = asString(asRow(asRow(cur?.value).meta).toolUrl);
      if (!cur || !toolUrl || !host.compose?.renderUrl) return;
      const ref = await openEmbedEditor(host, { editUrl: toolUrl, slotLabel: cur.label ?? editId });
      if (ref) { void history.set(editId, ref); onDirty?.(editId); }
    });
  });

  // Top-level colour inputs use the shared SUSE colour picker (swatches, native,
  // hex, alpha, popover toggle). Block-colour fields below keep their own wiring
  // since they write into a block array, not a top-level input.
  wireColorField(el, {
    onChange: (inputId, value) => { void history.set(inputId, value); onDirty?.(inputId); },
    onInteractStart: () => { gesture.sliderDragging = true; },
    onInteractEnd: () => { gesture.sliderDragging = false; },
  });

  // On-demand help: delegated tap/Escape/outside-click wiring is attached once and
  // survives rebuilds; the aria-describedby links are (re)applied every render.
  wireHelpTips(el);
  linkHelpDescriptions(el);

  el.querySelectorAll<HTMLElement>('[data-block-swatch-field]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fieldKey = btn.dataset.blockSwatchField; // "blockId:idx:fieldId"
      const hex = btn.dataset.swatchValue ?? '';
      if (fieldKey == null) return;
      const parts = fieldKey.split(':');
      const blockId = parts[0] ?? '', bIdx = parseInt(parts[1] ?? '', 10), fId = parts[2] ?? '';
      const native = el.querySelector<HTMLInputElement>(`[data-field-id="${CSS.escape(fieldKey)}"]`);
      if (native && hex.startsWith('#')) native.value = hex;
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...asRow(x) }));
      const row = arr[bIdx] ?? (arr[bIdx] = {});
      row[fId] = hex;
      void history.set(blockId, arr);
      onDirty?.(blockId);
    });
  });


  // Block field changes
  el.querySelectorAll<HTMLElement>('[data-field-id]').forEach(field => {
    field.addEventListener('input', () => {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      // A number field mid-decimal — "1." or just "." — reports value="" with
      // validity.badInput. Committing that empties the model, which re-renders
      // the panel (blocks always take the full rebuild path) and wipes the
      // trailing "." the user is about to complete, so "1.2" lands as "12".
      // Hold off until the value parses; the field keeps showing the in-progress
      // text on its own, and the spinner arrows still commit valid steps. badInput
      // is never true for text/textarea/select, so this only ever guards numbers.
      if (field.validity?.badInput) return;
      const parts = (field.dataset.fieldId ?? '').split(':');
      const blockId = parts[0] ?? '', idx = parseInt(parts[1] ?? '', 10), fieldId = parts[2] ?? '';
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      let arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...asRow(x) }));
      const value = field instanceof HTMLInputElement && field.type === 'checkbox' ? field.checked : field.value;
      const row = arr[idx] ?? (arr[idx] = {});
      row[fieldId] = value;
      // Picking a parent from a reference dropdown anchors the target to a durable
      // id, so the link can't drift if rows are later reordered/added (same as the
      // drag-reparent path). Only for a same-input tree parent ref.
      const fdef = (inp.fields ?? []).find(f => f.id === fieldId);
      if (value && fdef?.optionsFrom && inp.nesting && fieldId === nestingConfig(inp).parentField) {
        arr = materializeRefTarget(arr, String(value), nestingConfig(inp));
      }
      void history.set(blockId, arr);
      onDirty?.(blockId);
    });
  });

  // "+ Add" (and each typed add-menu option) appends a block. Typed menus carry
  // data-block-add-type, which seeds the discriminator; fields start at their
  // declared defaults so a new block renders cleanly rather than all-blank.
  el.querySelectorAll<HTMLButtonElement>('[data-block-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const blockId = btn.dataset.blockAdd;
      if (blockId == null) return;
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = Array.isArray(inp.value) ? [...inp.value] : [];
      const block: BlockRow = {};
      for (const f of inp.fields ?? []) block[f.id] = blockFieldDefault(f);
      const type = btn.dataset.blockAddType;
      if (inp.addMenu && type !== undefined) block[inp.addMenu.field] = type;
      void history.set(blockId, [...arr, block]);
      onDirty?.(blockId);
    });
  });

  // Drop-to-add: a blocks input that declares `dropToAdd` turns its list into a
  // drop zone — dragging or selecting several image files at once uploads each
  // and appends one block per file (the image in the named asset field, every
  // other field at its default). It reuses the picker's upload path, so SVGs are
  // sanitised and big rasters downscaled exactly like a single "+ Add" upload.
  panelModel
    .filter((i): i is InputModelItem & { dropToAdd: BlocksDropToAdd } => i.control === 'blocks' && !!i.dropToAdd?.field)
    .forEach(input => {
      const blockId = input.id;
      const field = input.dropToAdd.field;
      if (!(input.fields ?? []).some(f => f.id === field && f.type === 'asset')) return;
      const wrap = el.querySelector<HTMLElement>(`.blocks-input[data-input-id="${CSS.escape(blockId)}"]`);
      const list = wrap?.querySelector<HTMLElement>('.blocks-list');
      if (!wrap || !list) return;
      wrap.classList.add('blocks-input--droppable');

      // The committer (upload each file → append one block per file) is shared with
      // the canvas drop zone (setupCanvasBlocksDrop), so both surfaces behave alike
      // and serialise through _dropChains.
      const { accept, plural, addFiles } = makeBlocksDropper({ runtime, history, host, input, onDirty });

      // Hidden multi-file input, opened by the drop hint — so "select several files"
      // works alongside drag-and-drop.
      const native = document.createElement('input');
      native.type = 'file';
      native.multiple = true;
      native.accept = accept;
      native.style.display = 'none';
      wrap.appendChild(native);
      native.addEventListener('change', () => { void addFiles(native.files); native.value = ''; });

      // A persistent drop hint that doubles as a "choose files" button — it stays
      // put once blocks exist (just with shorter text) so adding more is always one
      // drop or click away, alongside the per-row "+ Add".
      const hasItems = !!list.querySelector('.block-item');
      const hint = document.createElement('button');
      hint.type = 'button';
      hint.className = 'blocks-drop-hint';
      hint.textContent = hasItems
        ? `Drop or click to add more ${plural}`
        : `Drop ${plural} here, or click to choose files`;
      hint.addEventListener('click', () => native.click());
      list.appendChild(hint);

      let depth = 0;
      const setDrag = (on: boolean): void => { wrap.classList.toggle('is-file-dragover', on); };
      const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types || []).includes('Files');
      list.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDrag(true); });
      list.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
      list.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; setDrag(false); } });
      list.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; setDrag(false); void addFiles(e.dataTransfer?.files); });
    });

  // Typed add-menu: toggle the option list; one open at a time.
  el.querySelectorAll<HTMLElement>('[data-block-add-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.closest('.block-add-menu')?.querySelector<HTMLElement>('.block-add-options');
      if (!menu) return;
      const willOpen = menu.hidden;
      el.querySelectorAll<HTMLElement>('.block-add-options').forEach(m => { if (m !== menu) m.hidden = true; });
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });

  // Per-block asset (image) fields delegate to the host picker, mirroring the
  // top-level asset-picker control but writing into the block array.
  el.querySelectorAll<HTMLElement>('[data-block-asset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [blockId = '', idxStr = '', fId = ''] = (btn.dataset.blockAsset ?? '').split(':');
      const idx = parseInt(idxStr, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const f: Partial<BlockFieldSpec> = (inp.fields ?? []).find(x => x.id === fId) ?? {};
      const cur = Array.isArray(inp.value) ? asString(asRow(asRow(inp.value[idx])[fId]).id) : undefined;
      const ref = await host.assets.pick({
        title:       `Choose ${fieldLabel(f, fId)}`,
        type:        f.assetType === 'any' ? undefined : asAssetType(f.assetType),
        tags:        filterTags(f.filter),
        namespace:   filterNamespace(f.filter),
        allowUpload: f.allowUpload === true,
        current:     cur,
        editTool:    (toolUrl) => openEmbedEditor(host, { editUrl: toolUrl, slotLabel: fieldLabel(f, fId), mode: 'insert' }),
      });
      if (!ref) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...asRow(x) }));
      const row = arr[idx] ?? (arr[idx] = {});
      row[fId] = ref;
      void history.set(blockId, arr);
      onDirty?.(blockId);
    });
  });

  el.querySelectorAll<HTMLElement>('[data-block-asset-clear]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [blockId = '', idxStr = '', fId = ''] = (btn.dataset.blockAssetClear ?? '').split(':');
      const idx = parseInt(idxStr, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...asRow(x) }));
      const row = arr[idx];
      if (row) row[fId] = null;
      void history.set(blockId, arr);
      onDirty?.(blockId);
    });
  });

  // Edit a Lolly-sourced block image in place (same flow as the top-level
  // data-edit-id handler, but writing back into the block array).
  el.querySelectorAll<HTMLElement>('[data-block-asset-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [blockId = '', idxStr = '', fId = ''] = (btn.dataset.blockAssetEdit ?? '').split(':');
      const idx = parseInt(idxStr, 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const cur     = Array.isArray(inp.value) ? asRow(inp.value[idx])[fId] : null;
      const toolUrl = asString(asRow(asRow(cur).meta).toolUrl);
      if (!toolUrl || !host.compose?.renderUrl) return;
      const f: Partial<BlockFieldSpec> = (inp.fields ?? []).find(x => x.id === fId) ?? {};
      const ref = await openEmbedEditor(host, { editUrl: toolUrl, slotLabel: fieldLabel(f, fId) });
      if (!ref) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map(x => ({ ...asRow(x) }));
      const row = arr[idx] ?? (arr[idx] = {});
      row[fId] = ref;
      void history.set(blockId, arr);
      onDirty?.(blockId);
    });
  });

  // Block range sliders: hold the sidebar steady while dragging (the canvas
  // still updates live), exactly like the top-level custom slider / vector scrub.
  el.querySelectorAll<HTMLElement>('.block-range-input').forEach(r => {
    const hold = (): void => { gesture.sliderDragging = true; };
    const release = (): void => { gesture.sliderDragging = false; };
    r.addEventListener('pointerdown', hold);
    r.addEventListener('pointerup', release);
    r.addEventListener('pointercancel', release);
    r.addEventListener('blur', release);
    r.addEventListener('change', release);
  });

  // Remove is a two-step confirm so a stray click can't drop a block: the first
  // click arms the button ("Delete?"); a second click within 3s (or while armed)
  // commits. Clicking elsewhere — or the timeout — disarms it.
  el.querySelectorAll<ConfirmButton>('[data-block-remove]').forEach(btn => {
    // Confirm only for typed (card) blocks; compact name/value rows keep their
    // immediate delete (a "Delete?" label would stretch their tight grid cells).
    const confirms = !!btn.closest('.block-item.is-typed');
    const commit = (): void => {
      const blockId = btn.dataset.blockInput;
      if (blockId == null) return;
      const idx = parseInt(btn.dataset.blockIndex ?? '', 10);
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? [...inp.value] : []).filter((_, i) => i !== idx);
      void history.set(blockId, arr);
      onDirty?.(blockId);
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirms) { commit(); return; }
      if (btn._armed) { btn._disarm?.(); commit(); return; }
      btn._armed = true;
      btn.classList.add('is-confirming');
      const original = btn.innerHTML;
      btn.innerHTML = 'Delete?';
      const away = (ev: PointerEvent): void => { if (!(ev.target instanceof Node && btn.contains(ev.target))) btn._disarm?.(); };
      const t = setTimeout(() => btn._disarm?.(), 3000);
      btn._disarm = () => {
        btn._armed = false;
        btn.classList.remove('is-confirming');
        btn.innerHTML = original;
        clearTimeout(t);
        document.removeEventListener('pointerdown', away, true);
        btn._disarm = null;
      };
      // Defer so this very click doesn't immediately count as "clicking away".
      setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
    });
  });

  // Drag a block's header to reorder. Native HTML5 DnD — the header is the handle.
  // For a plain blocks input the array is spliced into the new order. For a TREE
  // input (input.nesting active) the drop zone splits into before / after / inside,
  // so a card can be moved, re-nested or reordered in one gesture; the dragged
  // card's parent reference is updated and its whole subtree travels with it.
  const clearDropMarks = (): void => el
    .querySelectorAll('.drag-over, .drop-before, .drop-after, .drop-inside')
    .forEach(n => n.classList.remove('drag-over', 'drop-before', 'drop-after', 'drop-inside'));

  el.querySelectorAll<HTMLElement>('.block-item.is-typed').forEach(item => {
    const head = item.querySelector<DragHandle>('[data-block-handle]');
    if (!head) return;
    const blockId = head.dataset.blockInput ?? '';
    const idx = parseInt(head.dataset.blockIndex ?? '', 10);
    const treeInp = panelModel.find(i => i.id === blockId);
    const treeMode = nestingActive(treeInp, modelValues);

    // Which of the three zones the pointer is over, by vertical position in the row.
    const zoneIntent = (e: DragEvent): BlockDropIntent => {
      const r = item.getBoundingClientRect();
      const rel = (e.clientY - r.top) / Math.max(1, r.height);
      return rel < 0.30 ? 'before' : rel > 0.70 ? 'after' : 'inside';
    };

    head.addEventListener('dragstart', (e) => {
      gesture.blockDrag = { inputId: blockId, from: idx, intent: null, over: null };
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer?.setData('text/plain', String(idx)); } catch { /* Safari */ }
      item.classList.add('is-dragging');
    });
    head.addEventListener('dragend', () => {
      item.classList.remove('is-dragging');
      clearDropMarks();
      gesture.blockDrag = null;   // clear even on a cancelled drag (no drop fired) so it can't go stale
      // A real drag suppresses the trailing click, but flag it anyway so a drag that
      // the browser rounds to a click can't also expand the pill (see head click below).
      head._dragJustHappened = true;
      setTimeout(() => { head._dragJustHappened = false; }, 0);
    });
    item.addEventListener('dragover', (e) => {
      if (!gesture.blockDrag || gesture.blockDrag.inputId !== blockId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      if (!treeMode) { item.classList.toggle('drag-over', idx !== gesture.blockDrag.from); return; }
      if (idx === gesture.blockDrag.from) { item.classList.remove('drop-before', 'drop-after', 'drop-inside'); return; }
      const intent = zoneIntent(e);
      gesture.blockDrag.intent = intent;
      gesture.blockDrag.over = idx;
      item.classList.toggle('drop-before', intent === 'before');
      item.classList.toggle('drop-after', intent === 'after');
      item.classList.toggle('drop-inside', intent === 'inside');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over', 'drop-before', 'drop-after', 'drop-inside'));
    item.addEventListener('drop', (e) => {
      if (!gesture.blockDrag || gesture.blockDrag.inputId !== blockId) return;
      e.preventDefault();
      const from = gesture.blockDrag.from, to = idx, intent = gesture.blockDrag.intent || zoneIntent(e);
      clearDropMarks();
      gesture.blockDrag = null;
      const inp = panelModel.find(i => i.id === blockId);
      if (!inp || from == null) return;
      const arr = Array.isArray(inp.value) ? inp.value : [];
      if (from < 0 || from >= arr.length) return;
      let next;
      if (treeMode) {
        next = blockReparentMove(arr.map(asRow), from, to, intent, nestingConfig(inp));
        if (!next) return;                      // no-op / illegal (e.g. into own subtree)
      } else {
        if (from === to) return;
        next = [...arr];
        const [moved] = next.splice(from, 1);
        if (moved !== undefined) next.splice(to, 0, moved);
      }
      void history.set(blockId, next);
      onDirty?.(blockId);
    });

    // Icon button folds this block to a pill — pure DOM toggle, no re-render
    // (renderInputs re-applies the collapsed state across rebuilds). toggleBlock
    // keeps the chevron's aria/title and the open animation in lockstep.
    const collapse = item.querySelector<HTMLElement>('[data-block-collapse]');
    collapse?.addEventListener('click', (e) => {
      e.stopPropagation();                 // don't reach the header's expand/drag
      const folded = !item.classList.contains('is-collapsed');
      toggleBlock(item, folded);
      syncCollapseAllPills();
      // On expand, bring the revealed fields into view so the click never looks dead
      // (a lower pill's fields would otherwise open below the scroll fold).
      if (!folded) scrollToControl(item, { pulse: false });
    });

    // The whole pill is the expand target while collapsed — clicking its body (preview,
    // swatch, grip, dead space) opens it, not just the 22px chevron. Only acts while
    // collapsed; ignores the chevron/remove buttons (they handle themselves) and the
    // click that ends a drag-reorder. Expanded cards are untouched (fields stay editable).
    head.addEventListener('click', (e) => {
      if (!item.classList.contains('is-collapsed')) return;
      if (e.target instanceof Element && e.target.closest('button')) return;
      if (head._dragJustHappened) return;
      toggleBlock(item, false);
      syncCollapseAllPills();
      scrollToControl(item, { pulse: false });
    });
  });

  // "Collapse all / Expand all" pill: fold or unfold every block in its group at
  // once — pure DOM toggle like the per-block chevron (renderInputs re-applies the
  // fold state across rebuilds), so no model change and no re-render.
  el.querySelectorAll<HTMLElement>('[data-blocks-collapse-all]').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = pill.closest('.blocks-input');
      const fold = pill.dataset.mode !== 'expand';
      wrap?.querySelectorAll('.block-item.is-typed').forEach(item => toggleBlock(item, fold));
      syncCollapseAllPills();
      // Expanding many at once: surface the first so the change is visible.
      if (!fold) {
        const first = wrap?.querySelector('.block-item');
        if (first) scrollToControl(first, { pulse: false });
      }
    });
  });

  if (el._colorPopoverDismiss) {
    document.removeEventListener('click', el._colorPopoverDismiss, true);
  }
  el._colorPopoverDismiss = e => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t?.closest('.color-picker-field') && !t?.closest('.color-popover')) {
      el.querySelectorAll<HTMLElement>('.color-popover:not([hidden])').forEach(p => { p.hidden = true; p.style.cssText = ''; });
    }
  };
  document.addEventListener('click', el._colorPopoverDismiss, true);

  // Dismiss any open typed add-menu on an outside click. A click inside
  // .block-add-menu is left alone (the option's own handler appends + rebuilds).
  if (el._blockMenuDismiss) {
    document.removeEventListener('click', el._blockMenuDismiss, true);
  }
  el._blockMenuDismiss = e => {
    if (!(e.target instanceof Element && e.target.closest('.block-add-menu'))) {
      el.querySelectorAll<HTMLElement>('.block-add-options:not([hidden])').forEach(m => { m.hidden = true; });
    }
  };
  document.addEventListener('click', el._blockMenuDismiss, true);
}

// ── controlHtml helpers (typed narrowings of manifest-driven reads) ───────────
const ASSET_TYPES = ['vector', 'raster', 'video', 'palette', 'font'] as const;
type AssetType = (typeof ASSET_TYPES)[number];
const asAssetType = (t: string | undefined): AssetType | undefined =>
  ASSET_TYPES.find(x => x === t);
const filterTags = (f: Record<string, unknown> | undefined): string[] | undefined => {
  const t = f?.tags;
  return Array.isArray(t) && t.every((x): x is string => typeof x === 'string') ? t : undefined;
};
const filterNamespace = (f: Record<string, unknown> | undefined): string | undefined =>
  typeof f?.namespace === 'string' ? f.namespace : undefined;
const fieldLabel = (f: Partial<BlockFieldSpec>, fId: string): string => f.label ?? fId;

export function controlHtml(input: InputModelItem, modelValues: Record<string, InputValue | undefined> = {}): string {
  const id  = escape(input.id);
  const val = escape(input.value ?? '');
  switch (input.control) {
    case 'textarea':
      return `<textarea data-input-id="${id}" rows="${input.rows ?? 3}" maxlength="${input.maxLength ?? ''}" placeholder="${escape(input.placeholder ?? ' ')}">${val}</textarea>`;
    case 'slider': {
      const min  = input.min  ?? 0;
      const max  = input.max  ?? 100;
      const step = input.step ?? 1;
      const num  = parseFloat(String(input.value ?? min));
      const pct  = ((num - min) / (max - min) * 100).toFixed(3);
      const stops = Math.round((max - min) / step);
      const ticks = (stops >= 2 && stops <= 30)
        ? `<div class="cs-ticks" aria-hidden="true">${
            Array.from({ length: stops + 1 }, (_, i) =>
              `<span class="cs-tick" style="left:${(i / stops * 100).toFixed(3)}%"></span>`
            ).join('')
          }</div>`
        : '';
      const unit = input.unit ?? input.suffix ?? '';
      return `<div class="custom-slider" data-input-id="${id}"
          data-min="${min}" data-max="${max}" data-step="${step}"${unit ? ` data-unit="${escape(unit)}"` : ''}
          tabindex="0" role="slider" aria-label="${escape(input.label ?? id)}"
          aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${num}" aria-valuetext="${escape(unit ? `${num} ${unit}` : String(num))}">
        <div class="cs-track">
          <div class="cs-fill" style="width:${pct}%"></div>
          <div class="cs-thumb" style="left:${pct}%"></div>
        </div>
        ${ticks}
      </div>`;
    }
    case 'select':
      return `<select data-input-id="${id}">${(input.options ?? []).map(o =>
        `<option value="${escape(o.value)}" ${o.value === input.value ? 'selected' : ''}>${escape(o.label ?? o.value)}</option>`
      ).join('')}</select>`;
    case 'checkbox':
      return `<input type="checkbox" data-input-id="${id}" ${input.value ? 'checked' : ''}>`;
    case 'color-picker':
      // Shared SUSE colour picker (see components/color-field.js).
      // `swatchesOnly` makes it a palette-restricted picker (no hex/native/alpha).
      return colorFieldHtml(id, input.value, { swatchesOnly: input.swatchesOnly === true });
    case 'palette-picker':
      return `<input type="text" data-input-id="${id}" value="${val}" placeholder="(palette picker: stub)">`;
    case 'asset-picker': {
      const ref  = asRow(input.value);
      const meta = asRow(ref.meta);
      const currentLabel = asString(meta.name) ?? asString(ref.id) ?? 'Choose asset…';
      const hasValue = Boolean(input.value);
      // A selected asset carries a resolved blob: URL (see runtime resolveAssetRefs)
      // — show it as a small preview so the picked image is visible at a glance.
      const thumbUrl = asString(ref.url);
      const thumb = thumbUrl
        ? `<img class="asset-picker-thumb-inline" src="${escape(thumbUrl)}" alt="">`
        : '';
      // An image minted from a pasted Lolly link keeps its origin in meta.toolUrl —
      // the canonical, re-renderable embed URL (see compose.renderUrl). Surface that
      // provenance and an Edit affordance that re-opens the source tool's own inputs
      // (openEmbedEditor) so the editor can tweak it and re-apply. Plain library /
      // uploaded assets have no toolUrl, so they show no badge.
      const fromTool = meta.toolUrl ? (asString(meta.name) ?? 'a Lolly tool') : null;
      return `<div class="asset-picker-row">
        ${thumb}
        <button type="button" class="asset-picker-trigger" data-input-id="${id}">${escape(currentLabel)}</button>
        ${hasValue ? `<button type="button" class="asset-clear" data-clear-id="${id}" aria-label="Clear selection">&#x2715;</button>` : ''}
      </div>${fromTool ? `<div class="asset-from-tool">
        <span class="asset-from-tool-label"><span class="asset-from-tool-spark" aria-hidden="true">&#10022;</span> from <strong>${escape(fromTool)}</strong></span>
        <button type="button" class="asset-edit" data-edit-id="${id}">Edit</button>
      </div>` : ''}`;
    }
    case 'file-picker': {
      // A picked file is a FileRef (bytes + metadata) the hook transforms; the
      // bytes live only in memory and are never uploaded or persisted. The native
      // <input type=file> is hidden behind a styled trigger; binding (renderInputs)
      // reads the File into a FileRef on change.
      const rowVal = asRow(input.value);
      const ref = rowVal.__file ? rowVal : null;
      const accept = Array.isArray(input.accept) ? input.accept.join(',') : '';
      const refName = ref ? asString(ref.name) ?? '' : '';
      const refSize = ref && typeof ref.size === 'number' ? ref.size : 0;
      const meta = ref ? `${escape(refName)}${refSize ? ` · ${fmtBytes(refSize)}` : ''}` : '';
      return `<div class="file-picker" data-input-id="${id}">
        <input type="file" class="file-native" ${accept ? `accept="${escape(accept)}"` : ''} hidden>
        <button type="button" class="file-trigger">${ref ? 'Replace file…' : 'Choose file…'}</button>
        ${ref ? `<div class="file-chosen"><span class="file-name" title="${escape(refName)}">${meta}</span><button type="button" class="file-clear" aria-label="Remove file">&#x2715;</button></div>` : ''}
      </div>`;
    }
    case 'time-input':
      return `<div class="time-input-wrap"><input type="time" data-input-id="${id}" value="${val}"></div>`;
    case 'datetime-local-input':
      return `<input type="text" class="fp-datetime" data-input-id="${id}" data-fp-value="${val}" placeholder="Live — current time" readonly>`;
    case 'blocks': {
      const items   = Array.isArray(input.value) ? input.value : [];
      const fields  = input.fields ?? [];
      // addMenu turns "+ Add" into a typed menu and makes one sub-field the
      // block's fixed discriminator (shown as a head label, not an editable
      // control). Other sub-fields can opt into per-type visibility via showFor.
      const addMenu  = input.addMenu || null;
      const discr    = addMenu ? fields.find(f => f.id === addMenu.field) : null;
      const typeOpts = discr?.options ?? [];
      const typeLabel = (v: InputValue | null | undefined): string =>
        typeOpts.find(o => o.value === v)?.label ?? (v == null ? '' : String(v));

      // Stack a label above a control inside a typed block; plain controls
      // (untyped blocks) render bare to keep the legacy compact row layout —
      // unless the input opts in with `labelledFields` (e.g. logo-wall, whose
      // optional per-logo controls aren't self-evident).
      const labelEach = !!(addMenu || input.labelledFields);
      const labelled = (f: BlockFieldSpec, inner: string, cls = ''): string => {
        if (!labelEach) return inner;
        const ht = f.help ? helpTip(f.help) : null;
        return `<div class="block-control${cls}"><span class="block-control-label">${escape(f.label ?? f.id)}${ht ? ht.button : ''}</span>${inner}${ht ? ht.pop : ''}</div>`;
      };

      // A sub-field's `showIf` is matched first against sibling fields of the same
      // block, then against top-level input values (modelValues) — so a per-block
      // control can depend on both another block field and a global toggle.
      const blockShowIf = (f: BlockFieldSpec, item: BlockRow): boolean => {
        if (!f.showIf) return true;
        return Object.entries(f.showIf).every(([k, v]) =>
          ((item && k in item) ? item[k] : modelValues[k]) === v);
      };

      const blockField = (f: BlockFieldSpec, item: BlockRow, idx: number, typeVal: InputValue | null | undefined): string => {
        const fieldId = `${id}:${idx}:${escape(f.id)}`;
        if (addMenu && f.id === addMenu.field) return '';                 // discriminator → head label
        if (Array.isArray(f.showFor) && !(typeof typeVal === 'string' && f.showFor.includes(typeVal))) return '';
        if (!blockShowIf(f, item)) return '';

        // A reference picker: choices come from the rows of another blocks input
        // (e.g. "parent" lists the other cards). The value stored is each target
        // row's derived id, which the tool's hook resolves — so this replaces the
        // old "type the matching ID by hand" text boxes without any data change.
        if (f.optionsFrom) {
          const cur = String(item[f.id] ?? f.default ?? '');
          const { options, emptyLabel, freeText } = buildRefOptions({
            of: f.optionsFrom,
            ownerInputId: input.id,
            idx,
            getRows: (inId: string) => (Array.isArray(modelValues[inId]) ? modelValues[inId] : []),
            ownerNestingCfg: input.nesting ? nestingConfig(input) : null,
          });
          if (freeText) {
            // Combobox — pick an existing target or type a new id (kanban columns).
            const listId = `dl-${id}-${idx}-${escape(f.id)}`;
            const dlOpts = options.map((o: { value: string; label: string }) => `<option value="${escape(o.value)}">${escape(o.label)}</option>`).join('');
            return labelled(f, `<input class="block-field block-field--ref" list="${listId}" data-field-id="${fieldId}"
              value="${escape(cur)}" placeholder="${escape(f.placeholder ?? emptyLabel ?? '— none —')}"
              aria-label="${escape(f.label ?? f.id)}"><datalist id="${listId}">${dlOpts}</datalist>`);
          }
          // Strict select. A stored value matching no current row is surfaced as a
          // selected "(unknown)" option rather than silently dropped — so a stale or
          // mistyped reference is visible instead of just "the link didn't work".
          const known = options.some((o: { value: string }) => o.value === cur);
          const empty = `<option value=""${cur === '' ? ' selected' : ''}>${escape(emptyLabel ?? '— none —')}</option>`;
          const unknown = (cur !== '' && !known)
            ? `<option value="${escape(cur)}" selected>${escape(cur)} (unknown)</option>` : '';
          const opts = options.map((o: { value: string; label: string }) =>
            `<option value="${escape(o.value)}"${o.value === cur ? ' selected' : ''}>${escape(o.label)}</option>`).join('');
          return labelled(f, `<select class="block-field block-field--ref" data-field-id="${fieldId}" aria-label="${escape(f.label ?? f.id)}">${empty}${unknown}${opts}</select>`);
        }

        if (f.type === 'boolean') {
          const on = !!item[f.id];
          const ht = f.help ? helpTip(f.help) : null;
          // Checkbox + inline label (always labelled — a bare checkbox is opaque),
          // spanning the full row so it reads as its own line.
          return `<label class="block-control block-control--checkbox block-control--full">
            <input type="checkbox" class="block-field block-field--checkbox" data-field-id="${fieldId}"${on ? ' checked' : ''}>
            <span class="block-control-label">${escape(f.label ?? f.id)}${ht ? ht.button : ''}</span>
            ${ht ? ht.pop : ''}
          </label>`;
        }

        if (f.type === 'color') {
          const hex = String(item[f.id] ?? '').trim();
          const pickerVal = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#30ba78';
          const swatches = PALETTE.map(s => `<button type="button"
            class="color-swatch"
            data-block-swatch-field="${fieldId}" data-swatch-value="${s.hex}"
            style="background:${s.hex}" title="${escape(s.label)}"></button>`).join('');
          return labelled(f, `<div class="color-picker-field block-color-field" data-color-field="${fieldId}">
            <button type="button" class="color-trigger" data-color-trigger="${fieldId}"
              aria-label="${escape(f.label ?? f.id)}">
              <span class="color-trigger-preview" style="background:${pickerVal}"></span>
              <span class="color-trigger-hex">${pickerVal}</span>
            </button>
            <div class="color-popover" hidden>
              <div class="color-swatches">${swatches}</div>
              <input type="color" class="color-popover-native"
                data-field-id="${fieldId}" value="${pickerVal}">
            </div>
          </div>`);
        }

        if (f.type === 'select') {
          const cur = String(item[f.id] ?? f.default ?? '');
          const opts = (f.options ?? []).map(o =>
            `<option value="${escape(o.value)}" ${String(o.value) === cur ? 'selected' : ''}>${escape(o.label ?? o.value)}</option>`).join('');
          return labelled(f, `<select class="block-field" data-field-id="${fieldId}" aria-label="${escape(f.label ?? f.id)}">${opts}</select>`);
        }

        if (f.type === 'number') {
          const min = f.min ?? 0, max = f.max ?? 1, step = f.step ?? 0.01;
          const cur = item[f.id] ?? f.default ?? min;
          // display:'slider' → range track; otherwise a plain number input that shows
          // the value and accepts decimals (e.g. 1.3, 0.5). Mirrors the top-level
          // number-vs-slider convention so block fields read consistently.
          if (f.display === 'slider') {
            return labelled(f, `<input type="range" class="block-field block-range-input" data-field-id="${fieldId}"
              min="${min}" max="${max}" step="${step}" value="${escape(cur)}" aria-label="${escape(f.label ?? f.id)}">`);
          }
          return labelled(f, `<input type="number" class="block-field block-number-input" data-field-id="${fieldId}"
            min="${min}" max="${max}" step="${step}" value="${escape(cur)}" inputmode="decimal" aria-label="${escape(f.label ?? f.id)}">`);
        }

        if (f.type === 'asset') {
          const ref = item[f.id];
          const refRow = asRow(ref);
          const has = ref && typeof ref === 'object' && refRow.url;
          const refMeta = asRow(refRow.meta);
          // A block image pasted from a Lolly link is re-editable too (mirrors the
          // top-level asset-picker case): a ✦ Edit button keyed on the same field id
          // the picker/clear handlers use re-opens the source tool (openEmbedEditor).
          const fromTool = refMeta.toolUrl ? (asString(refMeta.name) ?? 'a Lolly tool') : null;
          return labelled(f, `<div class="block-asset">
            <button type="button" class="block-asset-trigger" data-block-asset="${fieldId}" aria-label="${escape(f.label ?? f.id)}">
              ${has ? `<img src="${escape(refRow.url)}" alt="">` : `<span>&#43; ${escape(f.label ?? 'Image')}</span>`}
            </button>
            ${fromTool ? `<button type="button" class="block-asset-edit" data-block-asset-edit="${fieldId}" title="Edit — from ${escape(fromTool)}" aria-label="Edit image, from ${escape(fromTool)}">&#10022;</button>` : ''}
            ${has ? `<button type="button" class="block-asset-clear" data-block-asset-clear="${fieldId}" aria-label="Remove ${escape(f.label ?? 'image')}">&#x2715;</button>` : ''}
          </div>`, ' block-control--full');
        }

        // A field can opt into a multi-line textarea for specific block kinds
        // (e.g. body text) via `multilineFor`; other kinds keep the single-line
        // input. Both carry data-field-id, so the generic commit + focus-restore
        // handlers below treat them identically.
        if (Array.isArray(f.multilineFor) && typeof typeVal === 'string' && f.multilineFor.includes(typeVal)) {
          return `<textarea class="block-field block-field--textarea${addMenu ? ' block-field--full' : ''}"
            data-field-id="${fieldId}" rows="${f.rows ?? 3}"
            placeholder="${escape(f.placeholder ?? f.label ?? f.id)}"
            aria-label="${escape(f.label ?? f.id)}">${escape(String(item[f.id] ?? ''))}</textarea>`;
        }
        return `<input class="block-field${addMenu ? ' block-field--full' : ''}"
          data-field-id="${fieldId}"
          placeholder="${escape(f.placeholder ?? f.label ?? f.id)}"
          value="${escape(String(item[f.id] ?? ''))}"
          aria-label="${escape(f.label ?? f.id)}">`;
      };

      const removeBtn = (idx: number, label: string): string => `<button type="button" class="block-remove"
        data-block-remove data-block-input="${id}" data-block-index="${idx}"
        aria-label="Remove ${escape(label || 'block')}" title="Remove">&#x2715;</button>`;

      // Six-dot grip — signals the header is a drag handle for reordering.
      const grip = `<svg class="block-grip" viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
        <circle cx="2.5" cy="3" r="1.2"/><circle cx="7.5" cy="3" r="1.2"/>
        <circle cx="2.5" cy="8" r="1.2"/><circle cx="7.5" cy="8" r="1.2"/>
        <circle cx="2.5" cy="13" r="1.2"/><circle cx="7.5" cy="13" r="1.2"/></svg>`;

      // Icon-only collapse toggle in the header — folds the block to a pill. The
      // chevron rotates to indicate state (CSS). State carries no model value, so
      // it's a pure DOM toggle here and re-applied after re-render by renderInputs.
      const collapseBtn = `<button type="button" class="block-collapse" data-block-collapse draggable="false" aria-label="Collapse block" title="Collapse">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 6.5 8 10l4-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;

      // Collapsed-pill summary: the first non-empty text field, plus the first
      // valid colour field as a dot — so a folded block stays identifiable.
      // Both respect the active type's showFor visibility.
      const visibleFor = (f: BlockFieldSpec, typeVal: InputValue | null | undefined, item: BlockRow): boolean =>
        !(Array.isArray(f.showFor) && !(typeof typeVal === 'string' && f.showFor.includes(typeVal))) && blockShowIf(f, item);
      const previewOf = (item: BlockRow, typeVal: InputValue | null | undefined): string => {
        for (const f of fields) {
          if (addMenu && f.id === addMenu.field) continue;
          if (!visibleFor(f, typeVal, item)) continue;
          // A field with no declared type renders as a text input, so treat it as
          // text here too — otherwise compact name/value blocks (whose fields omit
          // `type`) would collapse to a blank pill.
          const ty = f.type || 'text';
          if (ty === 'text' || ty === 'longtext') {
            const v = String(item[f.id] ?? '').trim();
            if (v) return v;
          }
        }
        return '';
      };
      const swatchOf = (item: BlockRow, typeVal: InputValue | null | undefined): string => {
        for (const f of fields) {
          if (!visibleFor(f, typeVal, item)) continue;
          if (f.type === 'color') {
            const v = String(item[f.id] ?? '').trim();
            if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
          }
        }
        return '';
      };

      // Tree mode: when the input declares `nesting` and it's active for the
      // current model (e.g. diagramType ∈ org|mindmap), render the flat array as an
      // indented outline in pre-order, and let the header drag drop above / below /
      // inside another card (see the drag handlers in renderInputs). The DATA stays
      // a flat reference-by-id array — only the presentation is tree-shaped.
      const nesting = nestingActive(input, modelValues);
      const nestCfg = nesting ? nestingConfig(input) : null;

      const itemHtml = (item: BlockRow, idx: number, depth = 0, key: string | null = null): string => {
        const typeVal = addMenu ? item[addMenu.field] : null;
        const inner = fields.map(f => blockField(f, item, idx, typeVal)).join('');
        const sw = swatchOf(item, typeVal);
        const swatch = sw ? `<span class="block-head-swatch" style="background:${sw}"></span>` : '';
        const preview = `<span class="block-head-preview">${escape(previewOf(item, typeVal))}</span>`;
        // Typed blocks label their header with the variant name; untyped (compact
        // name/value) blocks have no variant, so the header is a bare handle. The
        // empty label still holds the flex spacer that right-aligns the controls,
        // and the collapsed pill (preview + swatch) supplies the identity. Both
        // kinds carry `is-typed` so they share the card chrome, collapse, drag and
        // first-render fold; `block-item--row` lets CSS tune the compact variant.
        const label = addMenu ? typeLabel(typeVal) : '';
        const rowCls = addMenu ? '' : ' block-item--row';
        const nestAttrs = nesting
          ? ` data-block-nested data-block-key="${escape(key ?? '')}" style="--block-depth:${depth}"` : '';
        const nestCls = nesting ? ` is-nestable${depth > 0 ? ' is-child' : ''}` : '';
        const title = nesting ? 'Drag to move, nest or reorder' : 'Drag to reorder';
        return `<div class="block-item is-typed${rowCls}${nestCls}" data-block-type="${escape(typeVal ?? '')}" data-block-index="${idx}"${nestAttrs}>
          <div class="block-head" data-block-handle draggable="true"
               data-block-input="${id}" data-block-index="${idx}" title="${title}">
            ${grip}<span class="block-type-label">${escape(label)}</span>${swatch}${preview}${collapseBtn}${removeBtn(idx, label || 'block')}
          </div>
          <div class="block-fields">${inner}</div>
        </div>`;
      };

      // In tree mode the list renders in pre-order (parent immediately above its
      // children) with each row carrying its TRUE array index, so the drag handlers
      // operate on the real array regardless of display order.
      let itemsHtml;
      if (nesting && nestCfg) {
        const rows = items.map(asRow);
        const keys = deriveBlockKeys(rows, nestCfg);
        const order = blockTreeOrder(rows, blockParentIndex(rows, keys, nestCfg.parentField));
        itemsHtml = order.map((e: { idx: number; depth: number }) => itemHtml(asRow(items[e.idx]), e.idx, e.depth, keys[e.idx])).join('');
      } else {
        itemsHtml = items.map((it, i) => itemHtml(asRow(it), i)).join('');
      }

      let adder;
      if (addMenu) {
        const opts = typeOpts.map(o => {
          const used = items.some(it => asRow(it)[addMenu.field] === o.value);
          const disabled = used && !o.repeatable;
          return `<button type="button" class="block-add-option" data-block-add="${id}"
            data-block-add-type="${escape(o.value)}"${disabled ? ' disabled' : ''}>${escape(o.label ?? o.value)}</button>`;
        }).join('');
        adder = `<div class="block-add-menu">
          <button type="button" class="block-add block-add--prominent" data-block-add-toggle="${id}" aria-haspopup="true" aria-expanded="false">&#43; ${escape(addMenu.label ?? 'Add')}</button>
          <div class="block-add-options" hidden>${opts}</div>
        </div>`;
      } else {
        adder = `<button type="button" class="block-add" data-block-add="${id}">+ Add</button>`;
      }

      // "Collapse all / Expand all" pill — only worth showing once there are
      // several blocks to fold. Its label is kept in sync with the live fold state
      // in renderInputs (syncCollapseAllPills); it starts as "Collapse all".
      const collapseAll = items.length > 1
        ? `<div class="blocks-toolbar"><button type="button" class="blocks-collapse-all" data-blocks-collapse-all="${id}" data-mode="collapse" aria-label="Collapse all blocks">Collapse all</button></div>`
        : '';
      return `<div class="blocks-input blocks-input--cards${addMenu ? ' blocks-input--typed' : ''}${nesting ? ' blocks-input--tree' : ''}" data-input-id="${id}">
        ${collapseAll}
        <div class="blocks-list">${itemsHtml}</div>
        ${adder}
      </div>`;
    }
    case 'vector': {
      // One compound input rendered as N Figma-style fields: drag the label to
      // scrub, or type a number. The whole { fieldId: number } object is committed
      // at once (see setupVectorControl), so bulk mode sees a single column.
      const fields = input.fields ?? [];
      const v = asRow(input.value);
      const fieldHtml = (f: BlockFieldSpec): string => {
        const fv = v[f.id] ?? f.default ?? f.min ?? 0;
        const lab = escape(f.label ?? f.id);
        // Tiny single-character indicator shown inside the field (+ / X / Y …),
        // doubling as the drag handle. Field may set its own `symbol`; otherwise
        // the first letter of the label. Full label stays in title + aria-label.
        const sym = escape(f.symbol ?? (f.label ?? f.id).trim().charAt(0).toUpperCase());
        return `<span class="vec-field">
          <span class="vec-scrub" data-vec-scrub="${escape(f.id)}" title="Drag to adjust ${lab}" aria-hidden="true">${sym}</span>
          <input type="number" class="vec-num" data-vec-field="${escape(f.id)}"
            value="${escape(fv)}"${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''} step="${f.step ?? 1}"
            aria-label="${escape((input.label ? input.label + ' — ' : '') + (f.label ?? f.id))}">
        </span>`;
      };
      return `<div class="vector-input" data-input-id="${id}">${fields.map(fieldHtml).join('')}</div>`;
    }
    default:
      return `<input type="text" data-input-id="${id}" value="${val}" maxlength="${input.maxLength ?? ''}" placeholder="${escape(input.placeholder ?? ' ')}">`;
  }
}

// A vector input: N number fields committed together as one { fieldId: number }
// object. Each field can be typed into, or its label dragged horizontally to
// scrub (Figma-style). Scrubbing sets gesture.sliderDragging so the sidebar isn't
// rebuilt mid-drag; the canvas still updates live via the runtime subscriber.
export function setupVectorControl(
  container: HTMLElement,
  runtime: PanelRuntime,
  history: PanelHistory,
  gesture: GestureState,
  id: string,
  onDirty: ((id: string) => void) | undefined,
  input: InputModelItem,
): void {
  const fields = input.fields ?? [];
  const nums = new Map<string, HTMLInputElement>();
  container.querySelectorAll<HTMLInputElement>('.vec-num').forEach(n => { if (n.dataset.vecField) nums.set(n.dataset.vecField, n); });

  const commit = (): void => {
    const obj: Record<string, number> = {};
    for (const f of fields) {
      const el = nums.get(f.id);
      if (!el) continue;
      const n = Number(el.value);
      if (!Number.isNaN(n)) { obj[f.id] = n; continue; }
      const prev = asRow(input.value)[f.id];
      obj[f.id] = typeof prev === 'number' ? prev : (f.default ?? 0);
    }
    void history.set(id, obj);
    onDirty?.(id);
  };

  nums.forEach(el => el.addEventListener('input', commit));

  // The whole field is the scrub surface, not just the symbol — drag anywhere on
  // a value to change it (Figma-style); the symbol is only a visual cue. A plain
  // click (no movement past the threshold) falls through to focus the <input> for
  // typing. Pointer Lock kicks in once dragging starts so the cursor wraps at
  // screen edges and a wide range (e.g. zoom) isn't capped by the sidebar width.
  container.querySelectorAll<HTMLElement>('.vec-field').forEach(fieldEl => {
    const fieldId = fieldEl.querySelector<HTMLElement>('.vec-scrub')?.dataset.vecScrub;
    const f  = fields.find(x => x.id === fieldId);
    const el = fieldId != null ? nums.get(fieldId) : undefined;
    if (!f || !el) return;
    const step  = f.step ?? 1;
    const clamp = (v: number): number => {
      if (f.min !== undefined) v = Math.max(f.min, v);
      if (f.max !== undefined) v = Math.min(f.max, v);
      return v;
    };
    let wasDragging = false;

    fieldEl.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const startX   = e.clientX;
      const startVal = Number(el.value) || 0;
      let   accumulated = 0;   // total pixel delta once pointer lock is active
      let   dragging    = false;

      function onMove(ev: PointerEvent): void {
        if (!dragging) {
          // Below the threshold this is still a potential click — leave it alone
          // so the field stays typeable.
          if (Math.abs(ev.clientX - startX) < 4) return;
          dragging = true;
          gesture.sliderDragging = true;         // keep the sidebar from rebuilding mid-drag
          el?.blur();                       // leave any text-edit mode
          document.body.style.cursor = 'ew-resize';
          fieldEl.setPointerCapture(e.pointerId);
          const req = fieldEl.requestPointerLock?.({ unadjustedMovement: true });
          if (req instanceof Promise) req.catch(() => fieldEl.requestPointerLock?.());
        }
        if (document.pointerLockElement === fieldEl) accumulated += ev.movementX;
        else accumulated = ev.clientX - startX; // keep in sync for the switch to locked mode
        if (el) el.value = String(clamp(startVal + Math.round(accumulated / 4) * step)); // ~1 step / 4px
        commit();                          // live: canvas re-hydrates, sidebar held
      }

      function onUp(): void {
        fieldEl.removeEventListener('pointermove', onMove);
        fieldEl.removeEventListener('pointerup', onUp);
        fieldEl.removeEventListener('pointercancel', onUp);
        document.removeEventListener('pointerlockchange', onLockChange);
        if (document.pointerLockElement === fieldEl) document.exitPointerLock();
        document.body.style.cursor = '';
        if (dragging) {
          gesture.sliderDragging = false;
          wasDragging = true;
          setTimeout(() => { wasDragging = false; }, 50);
          commit();                        // final commit now re-renders the sidebar
        }
      }

      function onLockChange(): void {
        // Escape key or other external release — stop dragging cleanly.
        if (document.pointerLockElement !== fieldEl) onUp();
      }

      fieldEl.addEventListener('pointermove', onMove);
      fieldEl.addEventListener('pointerup', onUp);
      fieldEl.addEventListener('pointercancel', onUp);
      document.addEventListener('pointerlockchange', onLockChange);
    });

    // Suppress the click-to-focus that follows a drag so the caret doesn't jump
    // into the field after scrubbing.
    fieldEl.addEventListener('click', e => {
      if (wasDragging) { e.preventDefault(); el?.blur(); }
    });
  });
}

export function setupCustomSlider(
  el: HTMLElement,
  runtime: PanelRuntime,
  history: PanelHistory,
  gesture: GestureState,
  id: string,
  onDirty: ((id: string) => void) | undefined,
): void {
  const min  = parseFloat(el.dataset.min ?? '');
  const max  = parseFloat(el.dataset.max ?? '');
  const step = parseFloat(el.dataset.step ?? '') || 1;
  const unit = el.dataset.unit || '';
  // The slider skeleton was just emitted by controlHtml into this element.
  const track = el.querySelector<HTMLElement>('.cs-track')!;
  const fill  = el.querySelector<HTMLElement>('.cs-fill')!;
  const thumb = el.querySelector<HTMLElement>('.cs-thumb')!;

  let lastSnapped = parseFloat(el.getAttribute('aria-valuenow') ?? '') || min;
  // Live numeric readout next to the label. The panel rebuild is suppressed during a
  // slider drag (gesture.sliderDragging), so update this span directly or it stalls mid-drag.
  const valueOut = el.closest('.input-row')?.querySelector('.input-value');

  function snap(raw: number): number {
    const s = Math.round((raw - min) / step) * step + min;
    return +(Math.min(max, Math.max(min, s)).toFixed(10));
  }

  // Keep aria-valuenow and a human aria-valuetext (with the unit, when one exists)
  // in lockstep so screen readers announce the value on every change.
  function setAria(v: number): void {
    el.setAttribute('aria-valuenow', String(v));
    el.setAttribute('aria-valuetext', unit ? `${v} ${unit}` : String(v));
  }

  function setThumb(rawVal: number): void {
    const pct = ((Math.min(max, Math.max(min, rawVal)) - min) / (max - min) * 100).toFixed(3);
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
  }

  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.focus({ preventScroll: true }); // so the keyboard handler is live right after a click
    el.setPointerCapture(e.pointerId);
    gesture.sliderDragging = true;
    el.classList.add('dragging');

    function fromPointer(e: PointerEvent): void {
      const rect  = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const raw   = min + ratio * (max - min);
      setThumb(raw);
      const snapped = snap(raw);
      if (snapped !== lastSnapped) {
        lastSnapped = snapped;
        setAria(snapped);
        if (valueOut) valueOut.textContent = String(snapped);
        void history.set(id, snapped);
      }
    }

    function onUp(): void {
      el.removeEventListener('pointermove', fromPointer);
      el.removeEventListener('pointerup', onUp);
      gesture.sliderDragging = false;
      el.classList.remove('dragging');
      // Snap thumb to final stop and trigger one last render
      setThumb(lastSnapped);
      onDirty?.(id);
      void history.set(id, lastSnapped);
    }

    el.addEventListener('pointermove', fromPointer);
    el.addEventListener('pointerup', onUp);
    fromPointer(e);
  });

  el.addEventListener('keydown', e => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   next = lastSnapped + step;
    else if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') next = lastSnapped - step;
    else if (e.key === 'Home')      next = min;
    else if (e.key === 'End')       next = max;
    else if (e.key === 'PageUp')    next = lastSnapped + step * 10;
    else if (e.key === 'PageDown')  next = lastSnapped - step * 10;
    if (next === null) return;
    e.preventDefault();
    const snapped = snap(next);
    if (snapped === lastSnapped) return;
    lastSnapped = snapped;
    setThumb(lastSnapped);
    setAria(lastSnapped);
    onDirty?.(id);
    void history.set(id, lastSnapped);
  });
}

/**
 * Drop the panel's document-level capture listeners and flatpickr instances so a
 * detached panel tree isn't pinned alive. Shared by mountTool's view cleanup and
 * the embed editor's close (they used to duplicate this by hand).
 */
export function releaseInputPanel(el: PanelContainer): void {
  if (el._colorPopoverDismiss) document.removeEventListener('click', el._colorPopoverDismiss, true);
  if (el._blockMenuDismiss)    document.removeEventListener('click', el._blockMenuDismiss, true);
  if (el._helpTipDismiss)      document.removeEventListener('click', el._helpTipDismiss, true);
  // A datetime input's flatpickr appends its calendar to <body> and registers its
  // own document/window listeners — removed only by destroy(). Removing the panel
  // detaches the input but not the body-level calendar, so tear them down
  // explicitly (else repeated mounts orphan calendars + retain the runtime via
  // flatpickr's listener roots).
  el.querySelectorAll<FlatpickrHost>('.fp-datetime').forEach(c => c._flatpickr?.destroy());
}

export interface InputPanel {
  /** Re-render from a fresh model (skipped while a drag gesture holds the panel). */
  render(model: InputModelItem[]): void;
  /** Tear down document-level listeners + flatpickrs (call on unmount/close). */
  destroy(): void;
  /** This panel's own gesture state (exposed for tests / advanced callers). */
  readonly gesture: GestureState;
}

/**
 * One sidebar input panel instance (findings 6/8): owns its gesture state and
 * its previous-model baseline. The main sidebar creates one; the embed editor
 * creates another — nothing is shared between them.
 */
export function createInputPanel({ container, runtime, history, host, onDirty }: {
  container: PanelContainer;
  runtime: PanelRuntime;
  history: PanelHistory;
  host: PanelHost;
  onDirty?: (id: string) => void;
}): InputPanel {
  const gesture = createGestureState();
  let prevModel: InputModelItem[] | undefined;
  return {
    render(model) {
      // Mid-drag the sidebar is intentionally left alone (rebuilding would kill
      // pointer capture); the canvas still updates live via the runtime subscriber.
      if (gesture.sliderDragging) return;
      prevModel = syncInputs(container, model, prevModel, runtime, history, gesture, host, onDirty);
    },
    destroy() {
      releaseInputPanel(container);
    },
    gesture,
  };
}
