// SPDX-License-Identifier: MPL-2.0
/**
 * Bake the live element's computed text styles onto its clone so a detached
 * subtree paints the same words the user saw. Shared by the PPTX writer and the
 * Penpot DOM lift, and a leaf on purpose: lib/dom-penpot.ts used to import it from
 * export-pptx.ts, which pulled dom-penpot into the export.ts dependency cycle.
 */
// The custGeom/text lowering (and the svgBlip .svg part in svgPic) read a SERIALISED
// clone, where the live document's CSS cascade no longer applies - a chart whose
// labels are styled from the tool's stylesheet would lower with default fonts
// (and the svgBlip would render serif, which is exactly what Google Slides was
// showing). Bake COMPUTED presentation state onto the clone as attributes, only
// where no attribute already says otherwise: font/paint for <text>, paint for
// every drawable - the latter is what makes stripping <style> off the clone safe (a
// class-painted shape keeps its resolved colours instead of defaulting black).
// Module-level and exported because the .penpot writer's SVG producer
// (bridge/export-penpot.ts) reads the same serialised clone and needs the same bake;
// two copies of this walk is how one of them ends up painting a different colour.
export function bakeTextStyles(liveEl: Element, clone: Element): void {
  const SEL = 'text, path, rect, circle, ellipse, line, polygon, polyline';
  const live = liveEl.querySelectorAll(SEL);
  const cloned = clone.querySelectorAll(SEL);
  if (!live.length || live.length !== cloned.length) return;
  live.forEach((lt, i) => {
    const ct = cloned[i]!;
    let cs: CSSStyleDeclaration;
    try { cs = getComputedStyle(lt); } catch { return; }
    const set = (attr: string, v: string | undefined): void => {
      if (v && !ct.getAttribute(attr)) ct.setAttribute(attr, v);
    };
    set('fill', cs.fill);
    set('stroke', cs.stroke);
    if (cs.stroke && cs.stroke !== 'none') set('stroke-width', cs.strokeWidth);
    if (cs.opacity && parseFloat(cs.opacity) < 1) set('opacity', cs.opacity);
    if (cs.fillOpacity && parseFloat(cs.fillOpacity) < 1) set('fill-opacity', cs.fillOpacity);
    if (cs.strokeOpacity && parseFloat(cs.strokeOpacity) < 1) set('stroke-opacity', cs.strokeOpacity);
    if (lt.tagName.toLowerCase() !== 'text') return;
    set('font-family', cs.fontFamily);
    set('font-size', cs.fontSize);
    set('font-weight', cs.fontWeight);
    set('font-style', cs.fontStyle);
    set('text-anchor', cs.textAnchor);
    // Only bake tracking when it is real - its presence makes the lowering bail.
    if (cs.letterSpacing && cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) !== 0) {
      set('letter-spacing', cs.letterSpacing);
    }
  });
}
