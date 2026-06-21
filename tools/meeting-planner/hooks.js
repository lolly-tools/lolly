function compute(inputs) {
  const people = Array.isArray(inputs.people) ? inputs.people : [];
  const active = people.filter(p => (p.city || '').trim());
  const showNight     = inputs.showNight     !== false;
  const showGraticule = inputs.showGraticule !== false;
  const showBorders   = inputs.showBorders   !== false;
  const pinSize       = +inputs.pinSize   || 1;
  const labelSize     = +inputs.labelSize || 1;
  const fontSize      = +inputs.fontSize  || 1;
  const showNameInPin = inputs.showNameInPin === true || inputs.showNameInPin === 'true';
  return {
    // Declared input values — used in HTML markup (attribute values are NOT annotated
    // by the shell so {{theme}} and {{layout}} in class="..." are safe)
    heading:       (inputs.heading || '').trim() || 'Team Meeting',
    hostCity:      (inputs.hostCity || '').trim(),
    meetingTime:   inputs.meetingTime || '',
    theme:         inputs.theme || 'dark',
    layout:        inputs.layout || 'landscape',
    projection:    inputs.projection || 'geoNaturalEarth1',
    showNight,
    showGraticule,
    showBorders,
    landColor:     (inputs.landColor || '').trim(),
    oceanColor:    (inputs.oceanColor || '').trim(),
    mapZoom:       (inputs.mapZoom || '').trim(),
    pinColor:      (inputs.pinColor || '').trim(),
    pinShape:      inputs.pinShape || 'circle',
    pinSize,
    labelSize,
    showNameInPin,
    fontSize,
    // Extras for JS use in <script> — keys don't match any input ID so the
    // shell's annotateTemplate won't wrap them in <!-- ci:id --> markers.
    _mapZoom:       (inputs.mapZoom || '').trim(),
    _hostCity:      (inputs.hostCity || '').trim(),
    _meetingTime:   inputs.meetingTime || '',
    _theme:         inputs.theme || 'dark',
    _projection:    inputs.projection || 'geoNaturalEarth1',
    _showNight:     showNight     ? 'yes' : 'no',
    _showGraticule: showGraticule ? 'yes' : 'no',
    _showBorders:   showBorders   ? 'yes' : 'no',
    _landColor:     (inputs.landColor || '').trim(),
    _oceanColor:    (inputs.oceanColor || '').trim(),
    _pinColor:      (inputs.pinColor || '').trim(),
    _pinShape:      inputs.pinShape || 'circle',
    _pinSize:       String(pinSize),
    _labelSize:     String(labelSize),
    _showNameInPin: showNameInPin ? 'yes' : 'no',
    _hideCity:      (inputs.hideCity === true || inputs.hideCity === 'true') ? 'yes' : 'no',
    _fontSize:      String(fontSize),
    peopleJson:     JSON.stringify(active).replace(/<\//g, '<\\/'),
  };
}

function onInit({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const result = compute(inputs);
  if (!result.meetingTime) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const p = n => String(n).padStart(2, '0');
    result.meetingTime = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T10:00`;
    result._meetingTime = result.meetingTime;
  }
  return result;
}

function onInput({ model }) {
  return compute(Object.fromEntries(model.map(i => [i.id, i.value])));
}
