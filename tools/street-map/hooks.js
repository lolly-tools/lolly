/**
 * Street Map hooks.
 *
 * The interactive map itself lives in the template <script> (it needs the DOM
 * and d3, which the sandboxed hook context doesn't have). The hook's only job is
 * to normalise input values and expose them as `_`-prefixed extras so the
 * template script can read them — declared input IDs get wrapped in HTML comment
 * markers by the engine's annotateTemplate, which would break JS if read inside
 * <script>. See meeting-planner for the same pattern.
 */

function compute(inputs) {
  const theme           = inputs.theme === 'dark' ? 'dark' : 'light';
  const city            = (inputs.city || 'nuremberg').trim();
  const minorRoadWeight = Math.max(0.1, Number(inputs.minorRoadWeight) || 1);
  const majorRoadWeight = Math.max(0.1, Number(inputs.majorRoadWeight) || 1);
  const waterWeight     = Math.max(0.1, Number(inputs.waterWeight) || 1);
  const showWater       = inputs.showWater !== false && inputs.showWater !== 'false';
  const roadColor       = (inputs.roadColor || '').trim();
  const waterColor      = (inputs.waterColor || '').trim();
  const background       = (inputs.background || '').trim();
  const view            = (inputs.view || '').trim();

  return {
    // Declared values — only used in attribute context in the markup (safe).
    theme,
    city,

    // Extras for the template <script> (keys don't match input IDs → not annotated).
    _theme:           theme,
    _city:            city,
    _minorRoadWeight: String(minorRoadWeight),
    _majorRoadWeight: String(majorRoadWeight),
    _waterWeight:     String(waterWeight),
    _showWater:       showWater ? 'yes' : 'no',
    _roadColor:       roadColor,
    _waterColor:      waterColor,
    _background:      background,
    _view:            view,
  };
}

function onInit({ model }) {
  return compute(Object.fromEntries(model.map((i) => [i.id, i.value])));
}

function onInput({ model }) {
  return compute(Object.fromEntries(model.map((i) => [i.id, i.value])));
}
