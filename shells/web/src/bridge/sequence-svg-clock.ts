// SPDX-License-Identifier: MPL-2.0
/** Freeze a CSS/SMIL SVG at a source time while its ordinary plate is captured. */
export async function captureSvgTime<T>(box: HTMLElement, seconds: number, capture: () => Promise<T>): Promise<T> {
  const originalStyles = new Map([box, ...box.querySelectorAll('[style]')].map(target => [target, target.getAttribute('style')]));
  const animations = box.getAnimations({ subtree: true }).map(animation => ({ animation, time: animation.currentTime, state: animation.playState }));
  const roots = [...box.querySelectorAll('svg')].map(svg => ({ svg, time: svg.getCurrentTime(), paused: svg.animationsPaused() }));
  const restore: (() => void)[] = [];
  const styles = new Map<HTMLElement | SVGElement, string | null>();
  const pins: { target: HTMLElement | SVGElement; name: string; value: string }[] = [];
  const pin = (target: Element, name: string, value: string) => {
    if (!value || !(target instanceof HTMLElement || target instanceof SVGElement)) return;
    if (!styles.has(target)) styles.set(target, originalStyles.get(target) ?? null);
    pins.push({ target, name, value });
  };
  try {
    for (const { animation } of animations) { animation.pause(); animation.currentTime = seconds * 1000; }
    for (const { svg } of roots) { svg.pauseAnimations(); svg.setCurrentTime(seconds); }
    // Freeze computed animation properties so a serialized SVG cannot restart them.
    for (const { animation } of animations) {
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect) || !effect.target) continue;
      if (effect.pseudoElement) throw new Error('Animated SVG pseudo-elements cannot be sampled accurately.');
      const computed = getComputedStyle(effect.target);
      for (const name of new Set(effect.getKeyframes().flatMap(frame => Object.keys(frame)))) {
        if (['offset', 'computedOffset', 'easing', 'composite'].includes(name)) continue;
        const cssName = name.startsWith('--') ? name : name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        pin(effect.target, cssName, computed.getPropertyValue(cssName));
      }
    }
    const frozen = new Map<Element, Map<string, string>>();
    const nodes: Element[] = [];
    for (const animation of box.querySelectorAll('animate, set, animateTransform, animateMotion')) {
      if (animation.tagName.toLowerCase() === 'animatemotion') throw new Error('SVG motion-path samples are not supported; convert the source to Lottie or video.');
      const target = (animation as SVGAnimationElement).targetElement;
      const name = animation.getAttribute('attributeName');
      if (!target || !name) throw new Error('Animated SVG has an unresolved target.');
      nodes.push(animation);
      if (frozen.get(target)?.has(name)) continue;
      const previous = target.getAttribute(name);
      const css = getComputedStyle(target).getPropertyValue(name);
      const property: unknown = Reflect.get(target, name);
      const animated = property && typeof property === 'object' && 'animVal' in property ? property.animVal : undefined;
      let value: string;
      if (typeof animated === 'number' || typeof animated === 'string') value = String(animated);
      else if (animated && typeof animated === 'object' && 'value' in animated) value = String(animated.value);
      else if (css && name !== 'transform') value = css;
      else if (name === 'transform' && animated && typeof animated === 'object' && 'numberOfItems' in animated) {
        const list = animated as SVGTransformList; let matrix = new DOMMatrix();
        for (let i = 0; i < list.numberOfItems; i++) matrix = matrix.multiply(list.getItem(i).matrix);
        value = `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
      } else throw new Error(`Animated SVG property ${name} cannot be sampled accurately.`);
      if (!frozen.has(target)) frozen.set(target, new Map());
      frozen.get(target)!.set(name, value);
      pin(target, name, css);
      restore.push(() => { if (previous === null) target.removeAttribute(name); else target.setAttribute(name, previous); });
    }
    // Read every animated value before changing attributes or removing animations.
    for (const [target, values] of frozen) for (const [name, value] of values) target.setAttribute(name, value);
    for (const { target, name, value } of pins) target.style.setProperty(name, value, 'important');
    for (const animation of nodes) {
      const parent = animation.parentNode!, next = animation.nextSibling;
      animation.remove();
      restore.push(() => parent.insertBefore(animation, next?.parentNode === parent ? next : null));
    }
    return await capture();
  } finally {
    for (const undo of restore.reverse()) undo();
    for (const [target, style] of styles) { if (style === null) target.removeAttribute('style'); else target.setAttribute('style', style); }
    for (const { svg, time, paused } of roots) { svg.setCurrentTime(time); if (!paused) svg.unpauseAnimations(); }
    for (const { animation, time, state } of animations) {
      if (state === 'idle') animation.cancel();
      else { animation.currentTime = time; if (state === 'running') animation.play(); else if (state === 'finished') animation.finish(); }
    }
  }
}
