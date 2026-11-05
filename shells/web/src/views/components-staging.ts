// SPDX-License-Identifier: MPL-2.0
import { COMPONENT_ARTWORK, type Specimen } from './components-data.ts';

const CONTEXT_CLASSES = {
  profile: 'profile-view',
  catalog: 'catalog',
  studio: 'start start--studio',
} satisfies Record<NonNullable<Specimen['context']>, string>;

/** Supply the production ancestor without mounting its view or changing state. */
export function prepareSpecimenStage(stage: HTMLElement, specimen: Specimen, name: string): void {
  if (specimen.context) {
    const context = document.createElement('div');
    context.className = `cl-preview-context ${CONTEXT_CLASSES[specimen.context]}`;
    context.append(...stage.childNodes);
    stage.append(context);
  }
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', `Preview: ${name}`);
  // Keep the library's heading outline; the original tags retain their styles.
  stage.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
    heading.setAttribute('role', 'presentation');
  });
  stage.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    const fallback = (): void => {
      if (img.getAttribute('src') === COMPONENT_ARTWORK.icon) return;
      img.src = COMPONENT_ARTWORK.icon;
      img.alt = 'Lolly primary icon';
      img.classList.remove('cl-example-cover');
    };
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && !img.naturalWidth) fallback();
  });
}
