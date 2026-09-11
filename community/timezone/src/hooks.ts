// SPDX-License-Identifier: MPL-2.0

import { artwork } from './artwork';
import {
  dataCsv,
  dataDocument,
  dataIcs,
  dataMarkdown,
  makeState,
  type State,
  safeJson,
  updateTimes,
} from './model';

let latest: State | null = null;
let exportData: Record<string, string> = {};
function refreshData(s: State) {
  Object.assign(exportData, {
    json: JSON.stringify(dataDocument(s), null, 2),
    csv: dataCsv(s),
    markdown: dataMarkdown(s),
    ics: dataIcs(s),
  });
}
async function compute(ctx: any) {
  const inputs = Object.fromEntries(ctx.model.map((i: any) => [i.id, i.value]));
  const state = await makeState(inputs, ctx.host);
  // Artwork stays portable: even a shell without WebGL gets a complete SVG from hooks.
  latest = state;
  exportData = {};
  refreshData(state);
  return {
    _state: safeJson(state),
    _artwork: artwork(state),
    _data: exportData,
  };
}
export const onInit = (ctx: any) => compute(ctx);
export const onInput = (ctx: any) => compute(ctx);
export function beforeExport() {
  if (!latest) throw new Error('Timezone is still loading.');
  if (latest.error || latest.places.some((p) => p.error))
    throw new Error(
      latest.error ||
        latest.places
          .filter((p) => p.error)
          .map((p) => `${p.label}: ${p.error}`)
          .join('\n')
    );
  if (latest.inputs.timeMode === 'now') updateTimes(latest, new Date());
  // The runtime keeps this plain nested extra by reference. Refresh it before the
  // sibling text template hydrates, without DOM access or a shell-specific export.
  refreshData(latest);
}
