/* global onInit, onInput */

function hexToChannels(hex) {
  const c = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

function ch(n) {
  return parseFloat(n.toFixed(4));
}

function buildDuo(inputs) {
  const fg = hexToChannels(inputs.colorFg);
  const bg = hexToChannels(inputs.colorBg);
  return {
    tableR: `${ch(fg.r)} ${ch(bg.r)}`,
    tableG: `${ch(fg.g)} ${ch(bg.g)}`,
    tableB: `${ch(fg.b)} ${ch(bg.b)}`,
  };
}

function patch({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  return buildDuo(inputs);
}

function onInit(ctx) {
  return patch(ctx);
}

function onInput(ctx) {
  return patch(ctx);
}
