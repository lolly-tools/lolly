// SPDX-License-Identifier: MPL-2.0
/** Data shared by the portable writer and its standalone playback runtime. */
export interface PortablePlayerScene {
  id: string;
  name: string;
  start: number;
  end: number;
}
export interface PortablePlayerConfig {
  kind: 'sequence' | 'tool' | 'still';
  width: number;
  height: number;
  duration: number;
  sourceDuration: number;
  from: number;
  poster: number;
  fps: number;
  scenes?: PortablePlayerScene[];
}
export interface PortablePlayback {
  animated?: boolean;
  duration: number;
  poster: number;
  seek(seconds: number): void;
  /** Authored markup with prepared glyphs, before transient animation writes. */
  portableMarkup?(): string;
}
export type PlaybackElement = HTMLElement & { __lollyPlayback?: PortablePlayback };

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
export const playerIcons = {
  play: svg('<path d="m9 5 11 7-11 7Z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  replay: svg('<path d="M5 8a8 8 0 1 1-1 8M5 3v5h5"/>'),
  sound: svg('<path d="M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'),
  muted: svg('<path d="M11 5 6 9H3v6h3l5 4Zm5 4 5 6m0-6-5 6"/>'),
  fullscreen: svg('<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>'),
  scenes: svg('<rect x="3" y="4" width="7" height="6" rx="1"/><rect x="14" y="4" width="7" height="6" rx="1"/><rect x="3" y="14" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/>'),
};
const button = (action: string, label: string, icon: string) => `<button type="button" data-player-${action} aria-label="${label}" title="${label}">${icon}</button>`;
export function playerMarkup(markup: string, config: PortablePlayerConfig, audio = ''): string {
  const controls = config.kind === 'still' ? '' : `<button type="button" class="lp-big" data-player-big aria-label="Play animation">${playerIcons.play}</button>
    <nav class="lp-bar" aria-label="Animation controls">
      ${button('play', 'Play', playerIcons.play)}${button('replay', 'Replay', playerIcons.replay)}
      ${(config.scenes?.length ?? 0) > 1 ? '<button type="button" data-player-scenes aria-label="Scenes" aria-expanded="false" aria-controls="lp-scenes" title="Scenes">' + playerIcons.scenes + '</button>' : ''}
      <input class="lp-seek" data-player-seek type="range" min="0" max="${config.duration}" step="0.001" value="0" aria-label="Animation time">
      <output data-player-time aria-live="off"></output>
      ${audio ? button('mute', 'Mute', playerIcons.sound) + '<input class="lp-volume" data-player-volume type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume">' : ''}
      ${button('fullscreen', 'Enter fullscreen', playerIcons.fullscreen)}
    </nav>`;
  return `<main class="lp-root" data-player-root tabindex="0" aria-label="Lolly animation">
    <div class="lp-stage" data-player-stage style="width:${config.width}px;height:${config.height}px">${markup}</div>${controls}
    ${(config.scenes?.length ?? 0) > 1 ? '<nav id="lp-scenes" class="lp-scenes" aria-label="Scenes" hidden></nav>' : ''}
    <p class="lp-error" role="status" hidden></p>${audio ? `<audio data-player-audio preload="none" src="${audio}"></audio>` : ''}
    <script type="application/json" data-player-config>${JSON.stringify(config).replace(/</g, '\\u003c')}</script></main>`;
}
export const playerCss = `
html,body{width:100%;height:100%;overflow:hidden;background:#111}
.lp-root{position:fixed;inset:0;background:#111;color:#fff;overflow:hidden;isolation:isolate;font:12px/1.2 system-ui,sans-serif;outline-offset:-4px}
.lp-stage{position:absolute;z-index:0;transform-origin:0 0;overflow:hidden}.lp-stage .seq-off{visibility:hidden!important;pointer-events:none!important}
.lp-stage [data-export-hide]:not([data-cam]){display:none!important}
.lp-bar button,.lp-scenes button,.lp-root .lp-big{display:grid;place-items:center;flex:none;width:40px;height:40px;padding:0;border:0;border-radius:8px;color:#fff;background:transparent;cursor:pointer}
.lp-bar svg,.lp-big svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.lp-bar button:hover,.lp-scenes button:hover{background:#ffffff1c}.lp-bar button:focus-visible,.lp-scenes button:focus-visible,.lp-root .lp-big:focus-visible,.lp-bar input:focus-visible{outline:2px solid #fff;outline-offset:3px}
.lp-root .lp-big{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);width:80px;height:80px;border-radius:50%;background:#26263266;backdrop-filter:blur(12px);border:1px solid #ffffff66;box-shadow:0 4px 30px #0002}
.lp-big svg{width:32px;height:32px;stroke-width:1.8}.lp-big[aria-label="Play animation"] svg{fill:currentColor;stroke-width:1}.lp-root .lp-big:hover{background:#26263299}
.lp-bar{position:absolute;z-index:3;bottom:0;left:0;right:0;display:flex;align-items:center;gap:4px;padding:18px 12px 8px;background:linear-gradient(transparent,#0009);transition:opacity .2s}
.lp-root[data-idle] .lp-bar{opacity:0;pointer-events:none}.lp-root[data-idle]{cursor:none}.lp-bar:focus-within{opacity:1!important;pointer-events:auto!important}
.lp-bar input{appearance:none;-webkit-appearance:none;height:32px;margin:0 6px;background:transparent;cursor:pointer;min-width:0;padding:0;border:0}
.lp-seek{flex:1}.lp-volume{width:64px;flex:none}
.lp-bar input::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(to right,#fff var(--progress,100%),#ffffff4d var(--progress,100%))}
.lp-bar input::-moz-range-track{height:4px;border-radius:2px;background:linear-gradient(to right,#fff var(--progress,100%),#ffffff4d var(--progress,100%))}
.lp-bar input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;margin-top:-4px;border:0}
.lp-bar input::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:0}
.lp-bar output{font-variant-numeric:tabular-nums;white-space:nowrap;color:#ffffffe0;margin:0 8px;font-size:11px;min-width:65px;text-align:center}
.lp-root [hidden]{display:none!important}.lp-error{position:absolute;z-index:4;top:16px;left:16px;right:16px;padding:12px;background:#181820e8;color:#fff;border-radius:8px;font:14px/1.5 system-ui}
.lp-scenes{position:absolute;z-index:4;left:16px;bottom:68px;max-height:calc(100% - 100px);width:min(320px,calc(100% - 32px));overflow:auto;padding:6px;background:#22222aee;backdrop-filter:blur(16px);border:1px solid #ffffff26;border-radius:12px;box-shadow:0 8px 32px #0004}
.lp-scenes button{display:flex;box-sizing:border-box;gap:14px;width:100%;height:auto;min-height:44px;padding:10px 12px;text-align:left;font:inherit}.lp-scenes button[aria-current]{background:#ffffff20}.lp-scenes time{flex:none;color:#ffffff90;font-variant-numeric:tabular-nums}.lp-scenes span{min-width:0;overflow-wrap:anywhere}
@media(max-width:600px){.lp-bar{padding:16px 4px 4px;gap:0}.lp-volume{display:none}.lp-bar button{width:36px;height:40px}.lp-bar output{margin:0 4px;font-size:10px;min-width:60px}.lp-root .lp-big{width:64px;height:64px}}
@media(prefers-reduced-motion:reduce){.lp-bar{transition:none}}
`;
