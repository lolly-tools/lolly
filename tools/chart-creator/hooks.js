/* global onInit, onInput */

const PAD = 72;

const BRAND = ['#30ba78','#0c322c','#fe7c3f','#192072','#2453ff','#90ebcd','#279963','#145b39'];

// ── colour helpers ──────────────────────────────────────────────────────────

function lum(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16)/255;
  const g = parseInt(c.slice(2,4),16)/255;
  const b = parseInt(c.slice(4,6),16)/255;
  const l = v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  return 0.2126*l(r) + 0.7152*l(g) + 0.0722*l(b);
}

function autoText(hex) {
  return lum(hex) > 0.179 ? '#0c322c' : '#ffffff';
}

function isValidHex(s) {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

// ── utils ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function fmt(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if (abs >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (abs >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(Number.isInteger(n) ? n : n.toFixed(1));
}

function niceMax(v) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * mag;
}

function trunc(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Returns a formatted data value (raw number or percentage).
function fmtValue(value, total, format) {
  if (format === 'value') return fmt(value);
  return Math.round(Math.abs(value) / total * 100) + '%';
}

// Returns y coordinate of text within a segment based on alignment.
function alignedY(segY, segH, textSize, align) {
  if (align === 'top')    return segY + textSize * 1.2;
  if (align === 'center') return segY + segH / 2 + textSize * 0.35;
  return segY + segH - textSize * 0.4; // bottom
}

// ── data parsing ─────────────────────────────────────────────────────────────

function resolveItems(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((row, i) => {
    const label  = (row.label || '').trim() || `Item ${i+1}`;
    const value  = parseFloat(row.value) || 0;
    const rawCol = (row.color || '').trim();
    const color  = isValidHex(rawCol) ? rawCol : BRAND[i % BRAND.length];
    return { label, value, color };
  }).filter(r => r.label || r.value);
}

// ── layout ───────────────────────────────────────────────────────────────────

function computeLayout(W, H, title, subtitle) {
  let headerH = 0;
  if (title && subtitle) headerH = 120;
  else if (title)        headerH = 84;
  return { x: PAD, y: PAD + headerH, w: W - 2*PAD, h: H - 2*PAD - headerH };
}

// ── title ────────────────────────────────────────────────────────────────────

function titleSvg(title, subtitle, textColor) {
  if (!title) return '';
  const tc = esc(textColor);
  let out = `<text x="${PAD}" y="${PAD+52}" font-size="52" font-weight="700" fill="${tc}">${esc(title)}</text>`;
  if (subtitle) {
    out += `<text x="${PAD}" y="${PAD+90}" font-size="28" font-weight="300" fill="${tc}" opacity="0.65">${esc(subtitle)}</text>`;
  }
  return out;
}

// ── legend dot ───────────────────────────────────────────────────────────────

function legendDot(lx, ly, size, color, shape) {
  const sw = size * 0.9;
  if (shape === 'circle') {
    const cr = sw / 2;
    return `<circle cx="${lx + cr}" cy="${ly + 2 + cr}" r="${cr}" fill="${esc(color)}"/>`;
  }
  return `<rect x="${lx}" y="${ly+2}" width="${sw}" height="${sw}" fill="${esc(color)}" rx="3"/>`;
}

// ── vertical bars ─────────────────────────────────────────────────────────────

function verticalBars(items, lay, cfg) {
  if (!items.length) return '';
  const { textColor, showLabels, dataLabels, labelSize, valueSize,
          labelWeight, valueWeight, labelPosition, valuePosition, valueFormat,
          labelAlign, valueAlign,
          labelOffsetX, labelOffsetY, valueOffsetX, valueOffsetY,
          labelGap, valueGap, labelMaxChars } = cfg;

  const total  = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
  // Scale bars by magnitude so all-negative (or mixed-sign) data renders at true
  // size rather than collapsing to the niceMax(<=0)=10 floor as 2px stub bars.
  const max    = niceMax(Math.max(...items.map(i => Math.abs(i.value)), 0));
  const axisW  = 56;
  const chartX = lay.x + axisW;
  const chartW = lay.w - axisW;
  const chartY = lay.y + 16;
  const chartH = lay.h - 16;
  const barW   = Math.min(chartW / items.length * 0.6, 120);
  const gap    = chartW / items.length;

  let out = '';

  for (let t = 0; t <= 5; t++) {
    const v     = max * (t / 5);
    const y     = chartY + chartH - (v / max) * chartH;
    const alpha = t === 0 ? '0.15' : '0.08';
    out += `<line x1="${chartX}" y1="${y}" x2="${chartX+chartW}" y2="${y}" stroke="${textColor}" stroke-width="1" opacity="${alpha}"/>`;
    out += `<text x="${chartX-8}" y="${y + labelSize*0.4}" font-size="${labelSize*0.8}" fill="${textColor}" opacity="0.4" text-anchor="end">${fmt(v)}</text>`;
  }

  items.forEach((item, i) => {
    const bh  = Math.max(2, (Math.abs(item.value) / max) * chartH);
    const bx  = chartX + gap*i + (gap - barW)/2;
    const by  = chartY + chartH - bh;
    const cx  = bx + barW/2;
    const tc  = autoText(item.color);

    out += `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${esc(item.color)}" rx="4" ry="4"/>`;

    const roomForBoth = bh >= valueSize + labelSize + 12;
    const roomForOne  = bh >= valueSize + 8;
    const vLabel = fmtValue(item.value, total, valueFormat);

    if (dataLabels) {
      const vx = cx + valueOffsetX;
      if (valuePosition === 'outside') {
        const vy = by - 6 - valueGap + valueOffsetY;
        out += `<text x="${vx}" y="${vy}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${esc(textColor)}" text-anchor="middle" opacity="0.75">${vLabel}</text>`;
      } else if (roomForOne) {
        const vy = alignedY(by, bh, valueSize, valueAlign) + valueOffsetY;
        out += `<text x="${vx}" y="${vy}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${esc(tc)}" text-anchor="middle">${vLabel}</text>`;
      } else {
        const vy = by - 6 - valueGap + valueOffsetY;
        out += `<text x="${vx}" y="${vy}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${esc(textColor)}" text-anchor="middle" opacity="0.75">${vLabel}</text>`;
      }
    }

    if (showLabels) {
      const lx = cx + labelOffsetX;
      if (labelPosition === 'outside') {
        const ly = chartY + chartH + labelSize*1.2 + labelGap + labelOffsetY;
        out += `<text x="${lx}" y="${ly}" font-size="${labelSize}" font-weight="${labelWeight}" fill="${esc(textColor)}" text-anchor="middle" opacity="0.65">${esc(trunc(item.label, labelMaxChars || 10))}</text>`;
      } else if (roomForBoth || (!dataLabels && roomForOne)) {
        const ly = alignedY(by, bh, labelSize, labelAlign) + labelOffsetY;
        out += `<text x="${lx}" y="${ly}" font-size="${labelSize}" font-weight="${labelWeight}" fill="${esc(tc)}" text-anchor="middle">${esc(trunc(item.label, labelMaxChars || 10))}</text>`;
      } else {
        const ly = chartY + chartH + labelSize*1.2 + labelGap + labelOffsetY;
        out += `<text x="${lx}" y="${ly}" font-size="${labelSize}" font-weight="${labelWeight}" fill="${esc(textColor)}" text-anchor="middle" opacity="0.65">${esc(trunc(item.label, labelMaxChars || 10))}</text>`;
      }
    }
  });

  return out;
}

// ── horizontal bars ───────────────────────────────────────────────────────────

function horizontalBars(items, lay, cfg) {
  if (!items.length) return '';
  const { textColor, showLabels, dataLabels, labelSize, valueSize,
          labelWeight, valueWeight, labelPosition, valuePosition, valueFormat,
          labelAlign, valueAlign,
          labelOffsetX, labelOffsetY, valueOffsetX, valueOffsetY,
          labelGap, valueGap, labelMaxChars } = cfg;

  const total   = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
  // Scale by magnitude (see verticalBars) so negative values render at true size.
  const max     = niceMax(Math.max(...items.map(i => Math.abs(i.value)), 0));
  const rowH    = Math.min(lay.h / items.length, 120);
  const barH    = rowH * 0.55;
  const chartX  = lay.x;
  const chartW  = lay.w;

  let out = '';

  for (let t = 0; t <= 5; t++) {
    const v     = max * (t / 5);
    const x     = chartX + (v / max) * chartW;
    const alpha = t === 0 ? '0.15' : '0.08';
    out += `<line x1="${x}" y1="${lay.y}" x2="${x}" y2="${lay.y + lay.h}" stroke="${textColor}" stroke-width="1" opacity="${alpha}"/>`;
  }

  items.forEach((item, i) => {
    const bw  = Math.max(2, (Math.abs(item.value) / max) * chartW);
    const by  = lay.y + i*rowH + (rowH - barH)/2;
    const tc  = autoText(item.color);
    const pad = 10;

    out += `<rect x="${chartX}" y="${by}" width="${bw}" height="${barH}" fill="${esc(item.color)}" rx="4" ry="4"/>`;

    const minWBoth   = labelSize * 4;
    const minWSingle = labelSize * 2.5;
    const outsideX   = chartX + bw + pad;
    const anchorX    = chartX + pad;

    const labelInside = labelPosition !== 'outside' && bw >= minWSingle;
    const valueInside = valuePosition !== 'outside' && bw >= minWBoth;

    if (showLabels) {
      const lx      = (labelInside ? anchorX : outsideX + labelGap) + labelOffsetX;
      const ly      = alignedY(by, barH, labelSize, labelAlign) + labelOffsetY;
      const fill    = labelInside ? esc(tc) : esc(textColor);
      const opacity = labelInside ? '1' : '0.75';
      out += `<text x="${lx}" y="${ly}" font-size="${labelSize}" font-weight="${labelWeight}" fill="${fill}" text-anchor="start" opacity="${opacity}">${esc(trunc(item.label, labelMaxChars || 16))}</text>`;
    }

    if (dataLabels) {
      const vLabel  = fmtValue(item.value, total, valueFormat);
      const vx      = (valueInside ? anchorX : outsideX + valueGap) + valueOffsetX;
      const vy      = alignedY(by, barH, valueSize, valueAlign) + valueOffsetY;
      const fill    = valueInside ? esc(tc) : esc(textColor);
      const opacity = valueInside ? '1' : '0.75';
      out += `<text x="${vx}" y="${vy}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${fill}" text-anchor="start" opacity="${opacity}">${vLabel}</text>`;
    }
  });

  return out;
}

// ── pie / donut ───────────────────────────────────────────────────────────────

function pieDonut(items, lay, isDonut, cfg) {
  if (!items.length) return '';
  const { textColor, showLabels, showLegend, dataLabels, labelSize, valueSize,
          labelWeight, valueWeight, legendFontWeight, legendSize, legendDotShape, legendPosition,
          labelPosition, valuePosition, valueFormat,
          labelOffsetX, labelOffsetY, valueOffsetX, valueOffsetY,
          labelGap, valueGap, labelMaxChars, legendMaxChars } = cfg;

  const total      = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
  const legendRowH = legendSize * 1.6;

  const isSideLeft  = showLegend && legendPosition === 'left';
  const isSideRight = showLegend && legendPosition === 'right';
  const isSide      = isSideLeft || isSideRight;
  const legendH     = (showLegend && !isSide) ? Math.min(items.length * legendRowH + 16, 220) : 0;

  let cx, cy, r, legendTop, legendX;

  if (isSide) {
    const legendW = lay.w * (cfg.legendWidth / 100);
    const circleW = lay.w - legendW;
    cx       = isSideLeft ? lay.x + legendW + circleW / 2 : lay.x + circleW / 2;
    cy       = lay.y + lay.h / 2;
    r        = Math.min(circleW / 2, lay.h / 2) * 0.92;
    legendX  = isSideLeft ? lay.x : lay.x + lay.w - legendW;
    legendTop = Math.max(lay.y, cy - (items.length * legendRowH) / 2);
  } else if (legendPosition === 'top' && showLegend) {
    legendTop = lay.y;
    cy        = lay.y + legendH + (lay.h - legendH) / 2;
    cx        = lay.x + lay.w / 2;
    r         = Math.min(lay.w / 2, (lay.h - legendH) / 2);
    legendX   = lay.x;
  } else {
    cy        = lay.y + (lay.h - legendH) / 2;
    legendTop = lay.y + (lay.h - legendH) + 8;
    cx        = lay.x + lay.w / 2;
    r         = Math.min(lay.w / 2, (lay.h - legendH) / 2);
    legendX   = lay.x;
  }

  const ri = isDonut ? r * (cfg.donutRadius ?? 0.55) : 0;

  let out  = '';
  let angle = -Math.PI / 2;

  const lmrInside = isDonut ? (r + ri) / 2 : r * 0.62;

  items.forEach(item => {
    const slice = (Math.abs(item.value) / total) * 2 * Math.PI;
    const a1 = angle, a2 = angle + slice;
    const x1 = cx + r*Math.cos(a1),   y1 = cy + r*Math.sin(a1);
    const x2 = cx + r*Math.cos(a2),   y2 = cy + r*Math.sin(a2);
    const xi1 = cx + ri*Math.cos(a1), yi1 = cy + ri*Math.sin(a1);
    const xi2 = cx + ri*Math.cos(a2), yi2 = cy + ri*Math.sin(a2);
    const lg  = slice > Math.PI ? 1 : 0;
    const tc  = autoText(item.color);

    const d = isDonut
      ? `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${lg} 0 ${xi1} ${yi1} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
    out += `<path d="${d}" fill="${esc(item.color)}"/>`;

    if (slice > 0.22) {
      const mid  = angle + slice / 2;
      const cosM = Math.cos(mid);
      const sinM = Math.sin(mid);

      const lmrLabelOut = r + labelSize * 1.4 + labelGap;
      const lmrValueOut = r + labelSize * 1.4 + valueSize * 1.5 + valueGap;

      const lmrLabel = labelPosition === 'outside' ? lmrLabelOut : lmrInside;
      const lmrValue = valuePosition === 'outside' ? lmrValueOut : lmrInside;

      const lxLabel = cx + lmrLabel * cosM + labelOffsetX;
      const lyLabel = cy + lmrLabel * sinM + labelOffsetY;
      const lxValue = cx + lmrValue * cosM + valueOffsetX;
      const lyValue = cy + lmrValue * sinM + valueOffsetY;

      const anchorLabel = labelPosition === 'outside'
        ? (cosM > 0.1 ? 'start' : cosM < -0.1 ? 'end' : 'middle') : 'middle';
      const anchorValue = valuePosition === 'outside'
        ? (cosM > 0.1 ? 'start' : cosM < -0.1 ? 'end' : 'middle') : 'middle';

      const bothInside = labelPosition !== 'outside' && valuePosition !== 'outside';
      const showBoth   = showLabels && dataLabels && !showLegend;

      if (dataLabels) {
        const vLabel = fmtValue(item.value, total, valueFormat);
        const vy = (showBoth && bothInside) ? lyValue + valueSize*1.1 : lyValue + valueSize*0.35;
        const fill = valuePosition === 'outside' ? esc(textColor) : esc(tc);
        out += `<text x="${lxValue}" y="${vy}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${fill}" text-anchor="${anchorValue}">${vLabel}</text>`;
      }

      if (showLabels && !showLegend) {
        const lblY = (showBoth && bothInside) ? lyLabel - labelSize*0.9 : lyLabel + labelSize*0.35;
        const fill = labelPosition === 'outside' ? esc(textColor) : esc(tc);
        out += `<text x="${lxLabel}" y="${lblY}" font-size="${labelSize}" font-weight="${labelWeight}" fill="${fill}" text-anchor="${anchorLabel}">${esc(trunc(item.label, labelMaxChars || 10))}</text>`;
      }
    }

    angle += slice;
  });

  if (showLegend) {
    if (isSide) {
      const legendW    = lay.w * (cfg.legendWidth / 100);
      const dotW       = legendSize * 0.9 + 8;
      const maxChars   = Math.max(8, Math.floor((legendW - dotW) / (legendSize * 0.52)));
      items.forEach((item, i) => {
        const lx = legendX;
        const ly = legendTop + i * legendRowH;
        out += legendDot(lx, ly, legendSize, item.color, legendDotShape);
        if (showLabels) {
          const sw = legendSize * 0.9;
          out += `<text x="${lx+sw+8}" y="${ly+legendSize*0.85}" font-size="${legendSize}" font-weight="${legendFontWeight}" fill="${esc(textColor)}" opacity="0.85">${esc(trunc(item.label, legendMaxChars || maxChars))}</text>`;
        }
      });
    } else {
      const cols = Math.min(items.length, 4);
      const colW = lay.w / cols;
      items.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const lx  = lay.x + col * colW;
        const ly  = legendTop + row * legendRowH;
        out += legendDot(lx, ly, legendSize, item.color, legendDotShape);
        if (showLabels) {
          const sw = legendSize * 0.9;
          out += `<text x="${lx+sw+8}" y="${ly+legendSize*0.85}" font-size="${legendSize}" font-weight="${legendFontWeight}" fill="${esc(textColor)}" opacity="0.85">${esc(trunc(item.label, legendMaxChars || 18))}</text>`;
        }
      });
    }
  }

  return out;
}

// ── stacked bar ───────────────────────────────────────────────────────────────

function stackedBar(items, lay, cfg) {
  if (!items.length) return '';
  const { textColor, showLabels, showLegend, dataLabels, labelSize, valueSize,
          labelWeight, valueWeight, legendFontWeight, legendSize, legendDotShape, legendPosition,
          valueFormat, stackMax,
          labelAlign, valueAlign,
          labelOffsetX, labelOffsetY, valueOffsetX, valueOffsetY, labelMaxChars, legendMaxChars } = cfg;

  const total      = items.reduce((s, i) => s + Math.abs(i.value), 0) || 1;
  // The bar is a COMPOSITE of the values. By default it fits their total (denom = total,
  // so it spans the full width). A Scale max GREATER than the total scales the composite
  // against that maximum — the segments fill only their share and the rest is an empty
  // remainder track. A max ≤ total is ignored (would overflow the bar).
  const denom      = stackMax > total ? stackMax : total;
  const legendRowH = legendSize * 1.6;
  const legendH    = showLegend ? Math.min(items.length * legendRowH + 16, 220) : 0;

  const chartH = lay.h - legendH - 32;
  const barH   = Math.min(chartH * 0.45, 96);

  let legendTop, barY;
  if (legendPosition === 'top' && showLegend) {
    legendTop = lay.y;
    barY = lay.y + legendH + 16 + (chartH - barH) / 2;
  } else {
    barY = lay.y + chartH / 2 - barH / 2;
    legendTop = barY + barH + 32;
  }

  const barX = lay.x;
  const barW = lay.w;

  let out  = '';
  let curX = barX;

  // Empty remainder track behind the segments, shown only when a Scale max leaves the
  // composite short of the full width (unused capacity up to the max).
  if (denom > total) {
    out += `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="${esc(textColor)}" opacity="0.08"/>`;
  }

  items.forEach(item => {
    const sw  = (Math.abs(item.value) / denom) * barW;
    const tc  = autoText(item.color);
    out += `<rect x="${curX}" y="${barY}" width="${sw}" height="${barH}" fill="${esc(item.color)}"/>`;

    if (sw > labelSize * 2.5) {
      if (dataLabels) {
        const vLabel = fmtValue(item.value, total, valueFormat);
        const vx = curX + sw / 2 + valueOffsetX;
        const vy = alignedY(barY, barH, valueSize, valueAlign) + valueOffsetY;
        out += `<text x="${vx}" y="${vy}" font-size="${valueSize}" font-weight="${valueWeight}" fill="${esc(tc)}" text-anchor="middle">${vLabel}</text>`;
      }
      if (showLabels) {
        const lx = curX + sw / 2 + labelOffsetX;
        const ly = alignedY(barY, barH, labelSize, labelAlign) + labelOffsetY;
        out += `<text x="${lx}" y="${ly}" font-size="${labelSize}" font-weight="${labelWeight}" fill="${esc(tc)}" text-anchor="middle">${esc(trunc(item.label, labelMaxChars || Math.floor(sw / (labelSize*0.55))))}</text>`;
      }
    }
    curX += sw;
  });

  if (showLegend) {
    const cols = Math.min(items.length, 4);
    const colW = lay.w / cols;
    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lx  = lay.x + col * colW;
      const ly  = legendTop + row * legendRowH;
      out += legendDot(lx, ly, legendSize, item.color, legendDotShape);
      if (showLabels) {
        const sw  = legendSize * 0.9;
        const val = dataLabels ? ` (${fmtValue(item.value, total, valueFormat)})` : '';
        out += `<text x="${lx+sw+8}" y="${ly+legendSize*0.85}" font-size="${legendSize}" font-weight="${legendFontWeight}" fill="${esc(textColor)}" opacity="0.85">${esc(trunc(item.label, legendMaxChars || 18)+val)}</text>`;
      }
    });
  }

  return out;
}

// ── main build ────────────────────────────────────────────────────────────────

function buildChart(inputs) {
  const W         = Math.max(100, parseInt(inputs.width,  10) || 1080);
  const H         = Math.max(100, parseInt(inputs.height, 10) || 1080);
  const chartType = inputs.chartType  || 'donut';
  const title     = (inputs.heading    || '').trim();
  const subtitle  = (inputs.subheading || '').trim();
  const textColor = isValidHex(inputs.color) ? inputs.color : '#0c322c';
  const bgColor   = isValidHex(inputs.background) ? inputs.background : '#ffffff';
  const items     = resolveItems(inputs.data);

  const rawFormat = inputs.valueFormat || 'auto';
  const isBar     = chartType === 'vertical-bar' || chartType === 'horizontal-bar';
  // Stacked is a COMPOSITE of the actual values (not a forced 100%), so it defaults to
  // showing real numbers like the bar charts; pie/donut still default to percentages.
  const resolvedValueFormat = rawFormat === 'auto' ? ((isBar || chartType === 'stacked') ? 'value' : 'percent') : rawFormat;

  const cfg = {
    chartType,
    title,
    subtitle,
    textColor,
    showLabels:      inputs.showLabels !== false,
    showLegend:      inputs.showLegend === true,
    dataLabels:      inputs.dataLabels === true,
    labelSize:       Math.max(8,  parseInt(inputs.labelSize,  10) || 22),
    valueSize:       Math.max(8,  parseInt(inputs.valueSize,  10) || 24),
    labelWeight:     clamp(parseInt(inputs.labelWeight,      10) || 500, 100, 900),
    valueWeight:     clamp(parseInt(inputs.valueWeight,      10) || 700, 100, 900),
    legendFontWeight:clamp(parseInt(inputs.legendFontWeight, 10) || 500, 100, 900),
    legendSize:      Math.max(8,  parseInt(inputs.legendSize, 10) || 22),
    legendDotShape:  inputs.legendDotShape  || 'square',
    legendPosition:  inputs.legendPosition  || 'bottom',
    labelPosition:   inputs.labelPosition   || 'inside',
    valuePosition:   inputs.valuePosition   || 'inside',
    labelAlign:      inputs.labelAlign      || 'bottom',
    valueAlign:      inputs.valueAlign      || 'top',
    labelOffsetX:    parseInt(inputs.labelOffset?.x, 10) || 0,
    labelOffsetY:    parseInt(inputs.labelOffset?.y, 10) || 0,
    valueOffsetX:    parseInt(inputs.valueOffset?.x, 10) || 0,
    valueOffsetY:    parseInt(inputs.valueOffset?.y, 10) || 0,
    labelGap:        Math.max(0, parseInt(inputs.labelGap,  10) || 0),
    valueGap:        Math.max(0, parseInt(inputs.valueGap,  10) || 0),
    labelMaxChars:   Math.max(0, parseInt(inputs.labelMaxChars, 10) || 0),
    legendMaxChars:  Math.max(0, parseInt(inputs.legendMaxChars, 10) || 0),
    valueFormat:     resolvedValueFormat,
    donutRadius:     parseFloat(inputs.donutRadius) || 0.55,
    legendWidth:     clamp(parseInt(inputs.legendWidth, 10) || 40, 15, 65),
    stackMax:        Math.max(0, parseFloat(inputs.stackMax) || 0),
  };

  const lay = computeLayout(W, H, title, subtitle);
  const chartBgFill = inputs.transparentBg ? 'none' : bgColor;

  let body = '';
  if      (chartType === 'vertical-bar')   body = verticalBars(items, lay, cfg);
  else if (chartType === 'horizontal-bar') body = horizontalBars(items, lay, cfg);
  else if (chartType === 'donut')          body = pieDonut(items, lay, true,  cfg);
  else if (chartType === 'pie')            body = pieDonut(items, lay, false, cfg);
  else if (chartType === 'stacked')        body = stackedBar(items, lay, cfg);

  return { chartSvg: titleSvg(title, subtitle, textColor) + body, chartBgFill };
}

// ── hooks ─────────────────────────────────────────────────────────────────────

function getInputs(model) {
  return Object.fromEntries(model.map(i => [i.id, i.value]));
}

function onInit({ model }) { return buildChart(getInputs(model)); }
function onInput({ model }) { return buildChart(getInputs(model)); }
