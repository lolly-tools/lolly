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
  colorFieldHtml, colourwayLeadSwatches, LEADS_SWATCH_SOURCE, provideSwatchSource, wireColorField,
} from '../components/color-field.ts';
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
export function paletteFieldHtml(id: string, input: Pick<InputModelItem, 'value' | 'palette' | 'swatchesOnly'>): string {
  return colorFieldHtml(id, input.value, {
    swatchesOnly: input.swatchesOnly === true,
    ...(input.palette === LEADS_SWATCH_SOURCE ? { swatchSource: LEADS_SWATCH_SOURCE } : {}),
  });
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
}
