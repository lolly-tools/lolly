// SPDX-License-Identifier: MPL-2.0
const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element in the current document. */
export const svgEl = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);
