// SPDX-License-Identifier: MPL-2.0
/**
 * Motion an HTML tool asks to keep in its SVG.
 *
 * The walker flattens a tool's HTML into one `<g>` per element, so a tool drawn in HTML
 * reached Design as a still: nothing in the file could move, and the sequence clock had
 * nothing to pose. A tool drawn as an inline `<svg>` never had this problem, because its
 * own SMIL survives the walk (Pose Geeko).
 *
 * An element carrying `data-svg-motion="<keyframes> <dur>ms <easing> <delay>ms"` keeps
 * that one CSS animation: the group the walker emits for it gets the animation, and the
 * file gets a `<style>` holding the named `@keyframes`. What the file then does is what
 * an inlined animated SVG already does everywhere: anim-svg-mount inlines it, the
 * sequence clock seeks it through the Web Animations API, and a video export samples the
 * same moments (bridge/sequence-svg-clock.ts). There is no second clock here.
 *
 * The rest state is the finished picture, because the walk reads the page at rest. An SVG
 * editor that ignores CSS animation shows that. An `<img>` needs one rule: Chromium never
 * runs an image's CSS animation but does apply its first keyframe, which would freeze a
 * fill-mode entrance on a blank card. An image document has no scripting, so the rule
 * takes the animations away there and the picture stays finished (MOTION_REST_CSS). The
 * fill runs both ways because a finished fill-backwards animation leaves
 * `getAnimations()`, and the sequence clock could then never seek it again.
 *
 * Opt-in twice: a tool has to mark the element, and the caller has to pass `keepMotion`,
 * which only the plain SVG export does. Formats derived from the walk (Penpot, EMF, EPS,
 * DXF, the animated SVG flipbook) never get it, and with no marked element the emitted
 * bytes do not change.
 */

export const MOTION_ATTR = 'data-svg-motion';

/** In an image, where nothing can seek the animations, the picture is the finished one. */
export const MOTION_REST_CSS = '@media (scripting: none) { [style*="animation:"] { animation: none !important; } }';

/** One carried animation. Strict, because the value ends up in a style attribute. */
export interface SvgMotion { name: string; durMs: number; easing: string; delayMs: number }

const MOTION_RE = /^([a-z][a-z0-9-]{0,40}) (\d{1,6}(?:\.\d{1,3})?)ms (linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(-?[\d.]+,\s*-?[\d.]+,\s*-?[\d.]+,\s*-?[\d.]+\)) (\d{1,6}(?:\.\d{1,3})?)ms$/;

/** Read one `data-svg-motion` value. Null for anything that is not exactly the grammar. */
export function parseSvgMotion(value: string | null | undefined): SvgMotion | null {
  const m = MOTION_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  return { name: m[1]!, durMs: Number(m[2]), easing: m[3]!, delayMs: Number(m[4]) };
}

/**
 * The style one group needs. `font-size` is there for the keyframes: an `em` in a
 * translate resolves against it, so a rise scales with the type it moves wherever the
 * tool drew it, and the file needs no container query to know how far that is.
 */
export function svgMotionStyle(motion: SvgMotion, fontSizePx: number): string {
  const size = Number.isFinite(fontSizePx) && fontSizePx > 0 ? `font-size:${Math.round(fontSizePx * 100) / 100}px;` : '';
  return `${size}transform-box:fill-box;transform-origin:center;animation:${motion.name} ${motion.durMs}ms ${motion.easing} ${motion.delayMs}ms both`;
}

/** The serialised `@keyframes` rules for `names`, in the order `names` gives them. */
export function collectKeyframes(sheets: Iterable<CSSStyleSheet>, names: Iterable<string>): string {
  const wanted = new Set(names);
  const found = new Map<string, string>();
  for (const sheet of sheets) {
    let rules: CSSRuleList;
    // A cross-origin sheet throws on read, and it cannot hold a tool's keyframes.
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.type !== CSSRule.KEYFRAMES_RULE) continue;
      const name = (rule as CSSKeyframesRule).name;
      if (wanted.has(name) && !found.has(name)) found.set(name, rule.cssText);
    }
  }
  return [...wanted].flatMap((name) => found.get(name) ?? []).join('\n');
}

/** Per-walk state: marks each group, then writes the keyframes and the clip length. */
export function createMotionCarrier(doc: Document): {
  stamp(el: Element, g: Element, fontSize: string): void;
  finish(svgEl: Element, defs: Element, node: Element): void;
} {
  const names = new Set<string>();
  return {
    stamp(el, g, fontSize) {
      const motion = parseSvgMotion(el.getAttribute(MOTION_ATTR));
      if (!motion) return;
      names.add(motion.name);
      const prior = g.getAttribute('style');
      g.setAttribute('style', `${prior ? `${prior};` : ''}${svgMotionStyle(motion, parseFloat(fontSize))}`);
    },
    finish(svgEl, defs, node) {
      if (!names.size) return;
      const css = collectKeyframes(doc.styleSheets as unknown as Iterable<CSSStyleSheet>, names);
      if (css) {
        const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `${css}\n${MOTION_REST_CSS}`;
        defs.appendChild(style);
      }
      // A motion that plays once and holds has no loop to measure, so the file says how
      // long the piece is, and a Design box gets a clip that long (compose motionMeta).
      const stage = node.matches('[data-clip-ms]') ? node : node.querySelector('[data-clip-ms]');
      const ms = Number(stage?.getAttribute('data-clip-ms'));
      if (ms > 0) svgEl.setAttribute('data-clip-ms', String(Math.round(ms)));
    },
  };
}

/**
 * Put a placed entrance at its end for a still. A document export draws a fresh copy of
 * the page, where nothing holds the playhead and the animation has only just begun, so
 * an ordinary box shows at rest and a placed entrance would show an empty card. On a
 * live timeline parked at the first instant the frame is empty too, and nobody asks for
 * that picture. Only a piece that says it plays once (data-clip-ms): a looping picture's
 * first frame is a real frame. A playhead the person moved keeps the moment they chose.
 */
export function holdEntrancesFinished(node: Element): () => void {
  const undo: (() => void)[] = [];
  for (const svg of node.querySelectorAll('[data-anim-src] > svg[data-clip-ms]')) {
    const clipMs = Number(svg.getAttribute('data-clip-ms'));
    const animations = svg.getAnimations?.({ subtree: true }) ?? [];
    if (!(clipMs > 0) || !animations.length) continue;
    if (animations.some((a) => a.playState === 'paused' && Number(a.currentTime) > 0)) continue;
    for (const animation of animations) {
      const was = animation.currentTime;
      const paused = animation.playState === 'paused';
      animation.pause();
      animation.currentTime = clipMs;
      undo.push(() => {
        animation.currentTime = was;
        if (!paused) animation.play();
      });
    }
  }
  return () => { for (const step of undo) step(); };
}
