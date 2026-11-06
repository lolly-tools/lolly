// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's colour fields: the one wiring every colour control in the
 * panel shares, and the `palette` colour control (plans/319).
 *
 * Moved out of renderInputs (tool-inputs.ts) so the colourway leads source has a
 * home outside that hotspot. The wiring itself is unchanged: top-level inputs
 * commit through setInput(id), and a block field's composite id
 * ("blockId:idx:fieldId") routes into its block row.
 */
import {
  colorFieldHtml, colourwayLeadSwatches, LEADS_SWATCH_SOURCE, provideSwatchSource, setColorFieldAuto, wireColorField,
} from '../components/color-field.ts';
import type { ColorFieldAuto } from '../components/color-field.ts';
import { liveThemedHost } from '../lib/document-theme.ts';
import { asRow } from './tool-types.ts';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { WebToolHost } from './tool/shared.ts';

/**
 * The markup for a colour input that declares a `palette`. `colourway-leads`
 * offers the design system's colourway leads (see wireToolColourFields); any
 * other value is a palette asset's id, which is not read yet, so that field
 * offers the shared swatches. Either way it is the same colour field as an
 * ordinary colour input, restricted to swatches when `swatchesOnly` is set.
 */
export function paletteFieldHtml(id: string, input: Pick<InputModelItem, 'value' | 'palette' | 'swatchesOnly' | 'default' | 'label'>, word = ''): string {
  return colorFieldHtml(id, input.value, {
    swatchesOnly: input.swatchesOnly === true,
    ...(input.palette === LEADS_SWATCH_SOURCE ? { swatchSource: LEADS_SWATCH_SOURCE } : {}),
    ...fieldNaming(input),
    ...(word ? { name: word } : {}),
  });
}

/**
 * The markup for an ordinary colour input. The field's accessible name leads with the
 * input's own label ("Ink: Liquorice #09141a"), and an input whose default is empty
 * may be left empty, so its field takes `auto` (ColorFieldAuto): empty reads as
 * automatic instead of as black. The colour the tool draws there arrives after render
 * from paintAutoColours. `word` is the design system's word when the input links a colour
 * role: the value here is flat, and a colourway switch can draw before the swatches move.
 */
export function colourInputHtml(id: string, input: Pick<InputModelItem, 'value' | 'swatchesOnly' | 'default' | 'label'>, word = ''): string {
  return colorFieldHtml(id, input.value, { swatchesOnly: input.swatchesOnly === true, ...fieldNaming(input), ...(word ? { name: word } : {}) });
}

/** A block row's colour field (a block field's default decides, as above). */
export function blockColourFieldHtml(fieldId: string, value: string, field: { default?: unknown }): string {
  return colorFieldHtml(fieldId, value, { block: true, ...(emptyByDefault(field) ? { auto: {} } : {}) });
}

const emptyByDefault = (input: { default?: unknown }): boolean =>
  input.default === undefined || input.default === null || input.default === '';

function fieldNaming(input: { default?: unknown; label?: string }): { label?: string; auto?: ColorFieldAuto } {
  return {
    ...(input.label ? { label: input.label } : {}),
    ...(emptyByDefault(input) ? { auto: {} } : {}),
  };
}

/** Input ids that can be read as a template path (`autoColors.<id>.value`). */
const PATH_ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * What the tool draws in each empty colour input, from its hook's `autoColors` value:
 * `{ <inputId>: { value: '<css colour>', source: 'design-system' } }`. A tool that does
 * not report leaves its empty inputs on the neutral automatic chip. Read through the
 * runtime's template context, in one pass for the whole panel.
 */
export function readAutoColours(runtime: Pick<Runtime, 'getHydratedText'>, ids: readonly string[]): Map<string, ColorFieldAuto> {
  const out = new Map<string, ColorFieldAuto>();
  const readable = ids.filter((id) => PATH_ID.test(id));
  if (!readable.length) return out;
  let text = '';
  try {
    text = runtime.getHydratedText(readable.map((id) => `{{autoColors.${id}.value}}\u001f{{autoColors.${id}.source}}`).join('\u001e'));
  } catch { return out; }
  const rows = text.split('\u001e');
  readable.forEach((id, i) => {
    const [value = '', source = ''] = (rows[i] ?? '').split('\u001f');
    out.set(id, { color: value.trim() || null, source: source.trim() === 'design-system' ? 'design-system' : 'tool' });
  });
  return out;
}

/** Point every empty-capable top-level colour field under `panel` at what the tool draws now. */
export function paintAutoColours(panel: ParentNode, runtime: Pick<Runtime, 'getHydratedText'>): void {
  const fields = [...panel.querySelectorAll<HTMLElement>('[data-color-field][data-color-auto]')]
    .filter((f) => !(f.dataset.colorField ?? '').includes(':'));
  if (!fields.length) return;
  const autos = readAutoColours(runtime, fields.map((f) => f.dataset.colorField ?? ''));
  for (const field of fields) {
    const auto = autos.get(field.dataset.colorField ?? '');
    if (auto) setColorFieldAuto(field, auto);
  }
}

export interface ToolColourWiring {
  runtime: Runtime;
  host: WebToolHost;
  /** The inputs this render draws, to see whether a leads field is among them. */
  panelModel: readonly InputModelItem[];
  /** The input as the runtime holds it now (block rows are rebuilt from this). */
  liveInput(id: string): InputModelItem | undefined;
  onDirty?(id: string): void;
  /** A slider drag inside a colour field started (true) or ended (false). */
  onInteract(active: boolean): void;
}

/**
 * Wire every colour field under `el`: OKLCH sliders, hex, alpha, swatches and the
 * popover toggle. Block rows store plain strings, so a token-linked swatch pick is
 * flattened to its hex there; the {ref,value} shape is a top-level-input contract
 * (resolveTokenRefs), not a row value.
 *
 * When the panel draws a `palette: "colourway-leads"` field, the leads source is
 * pointed at this document: read through the runtime's live choices, so a field
 * opened after a look switch offers that look's leads.
 */
export function wireToolColourFields(el: HTMLElement, w: ToolColourWiring): void {
  const { runtime, onDirty } = w;
  if (w.panelModel.some((i) => i.control === 'palette-picker' && i.palette === LEADS_SWATCH_SOURCE)) {
    const live = liveThemedHost(w.host, runtime);
    void provideSwatchSource(LEADS_SWATCH_SOURCE, () => colourwayLeadSwatches(live.tokens));
  }
  wireColorField(el, {
    onChange: (inputId: string, value: InputValue) => {
      if (!inputId.includes(':')) {
        runtime.setInput(inputId, value);
        onDirty?.(inputId);
        return;
      }
      const parts = inputId.split(':');
      const blockId = parts[0]!,
        idx = parseInt(parts[1]!, 10),
        fieldId = parts[2]!;
      const inp = w.liveInput(blockId);
      if (!inp) return;
      const arr = (Array.isArray(inp.value) ? inp.value : []).map((x) => ({ ...asRow(x) }));
      let row = arr[idx];
      if (!row) { row = {}; arr[idx] = row; }
      const o = value as { ref?: unknown; value?: unknown };
      row[fieldId] = (
        value && typeof value === 'object' && typeof o.ref === 'string'
          ? String(o.value ?? '')
          : value
      ) as InputValue;
      runtime.setInput(blockId, arr);
      onDirty?.(blockId);
    },
    onInteractStart: () => w.onInteract(true),
    onInteractEnd: () => w.onInteract(false),
  });
  paintAutoColours(el, runtime);
}
