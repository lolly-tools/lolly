// SPDX-License-Identifier: MPL-2.0
/**
 * The Tools | Projects segmented switch shown atop the gallery and the projects
 * view. Pure markup — navigation is plain hash links (`#` → tools gallery, `#/p`
 * → projects root), so the router's hashchange listener handles it; no JS wiring.
 *
 * `active` is 'tools' or 'projects'.
 */
export function viewToggle(active) {
  const opt = (key, href, label) =>
    `<a href="${href}" class="view-toggle-opt${active === key ? ' is-active' : ''}"` +
    `${active === key ? ' aria-current="page"' : ''} data-vt="${key}">${label}</a>`;
  return `
    <nav class="view-toggle" aria-label="Switch between tools and projects">
      ${opt('tools', '#', 'Tools')}
      ${opt('projects', '#/p', 'Projects')}
    </nav>`;
}
