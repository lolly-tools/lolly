// SPDX-License-Identifier: MPL-2.0
import type { IconName } from '../lib/icons.ts';
import { iconNode } from '../lib/icon-node.ts';

/** A Share group using the same native disclosure as the tool sidebar. */
export function createShareSection(
  title: string,
  iconName: string,
  options: { open?: boolean; className?: string } = {},
): { section: HTMLDetailsElement; body: HTMLDivElement } {
  const section = document.createElement('details');
  section.className = ['input-section', 'share-section', options.className].filter(Boolean).join(' ');
  section.open = options.open ?? false;
  section.dataset.shareSection = options.className?.split(/\s+/)[0] || title;
  const summary = document.createElement('summary');
  summary.className = 'input-section-summary';
  const heading = document.createElement('span');
  heading.className = 'input-section-title';
  const glyph = document.createElement('span');
  glyph.className = 'input-section-icon';
  glyph.setAttribute('aria-hidden', 'true');
  const svg = iconNode(iconName as IconName) ?? iconNode('share');
  if (svg) {
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    glyph.append(svg);
  }
  heading.append(glyph, document.createTextNode(title));
  summary.append(heading);
  const body = document.createElement('div');
  body.className = 'input-section-body share-section-body';
  section.append(summary, body);
  return { section, body };
}
