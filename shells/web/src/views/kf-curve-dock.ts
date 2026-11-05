// SPDX-License-Identifier: MPL-2.0
/**
 * The docked curve editor for the two ease kinds that are not a plain bezier (plans/329).
 *
 * - **A spring** opens the spring editor: the plot of the spring as it plays over this
 *   segment, and its three parameters. A split half (a window) is drawn as it plays and
 *   becomes a whole spring again once a parameter moves.
 * - **A design-system ease** says which token it follows, then opens the editor for what
 *   the token plays now: the spring editor or the bezier one. Editing the curve writes
 *   that curve onto the keyframe, which detaches the keyframe from the token, and the dock
 *   says this before anyone edits the curve.
 *
 * A bezier returns null, and the caller mounts the bezier editor as it always has.
 */
import { t } from '../i18n.ts';
import { mountEasingEditor } from '../components/easing-editor.ts';
import { mountSpringEditor } from '../components/spring-editor.ts';
import { motionTokens } from '../lib/motion-tokens.ts';
import { kfEaseCss, kfEaseKind, kfEaseResolved, kfEaseSpring, kfEaseToken, kfEaseTokenPath, type KfTrack } from '@lolly/engine';

/** The length of the segment that starts at the key at `atMs`, or null when it is the last. */
export function kfSegmentMs(track: KfTrack, atMs: number): number | null {
  const next = track.find((k) => k.t > atMs);
  return next ? next.t - atMs : null;
}

/**
 * Mount the dock for `ease` into `host`, or return null for a plain bezier or a hold.
 * `write` takes the ease a commit puts on the keyframe.
 */
export function mountKfCurveDock(
  host: HTMLElement, ease: string, spanMs: number | null, write: (ease: string) => void,
): { destroy(): void } | null {
  const kind = kfEaseKind(ease);
  if (kind !== 'spring' && kind !== 'token') return null;
  const notes: HTMLElement[] = [];
  if (kind === 'token') {
    const path = kfEaseTokenPath(ease) ?? '';
    const known = motionTokens().curves.find((c) => c.path === path);
    const head = document.createElement('p');
    head.className = 'tl-kf-dock-bound';
    head.textContent = known
      ? t('From the design system: {name}', { name: known.label })
      : t('{name} (not in this design system)', { name: path });
    head.title = path;
    const note = document.createElement('p');
    note.className = 'tl-kf-dock-note';
    note.textContent = t('Editing the curve detaches it from the design system.');
    host.append(head, note);
    notes.push(head, note);
  }
  const playing = kind === 'token' ? kfEaseResolved(ease) : ease;
  const spring = kfEaseSpring(playing);
  const editor = spring
    ? mountSpringEditor(host, { value: spring.spring, spanMs, playing, onCommit: write })
    : mountEasingEditor(host, { value: kfEaseCss(playing), onCommit: (wire) => write(kfEaseToken(wire)) });
  return {
    destroy() {
      editor.destroy();
      for (const n of notes) n.remove();
    },
  };
}
