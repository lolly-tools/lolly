import './style.css'
import { AudioSession } from './audio/AudioSession'
import { mountEditor } from './editor/editor'
import { mountLibrary } from './editor/library'
import type { ProjectStore } from './session/projects'
import { mountDocs } from './editor/docspanel'
import { mountSynthLib } from './editor/synthlib'
import { compile } from '@rondocode/rondo'
import { bounceLoop, bounceMidi, bounceStems } from './editor/export'
import { lolly } from './lolly/host'
import { bakedSingParts, bakedSingVoices, silentSingParts } from './sing/singMgr'
import { mountProbes } from './editor/probes'
import { mountOptions } from './ui/options'
import { getSetting } from './ui/settings'
import { looksMobile } from './audio/devices'
import { mountTour } from './ui/tour'
import { mountMidi } from './editor/midi'
import { mountMask } from './editor/mask'
import { mountHeaderOverflow } from './ui/header-overflow'
import { applyPalette } from './ui/palette'
import { installViewportFit } from './ui/viewport'

/* Lolly: upstream's MCP browser bridge (session/bridge-client.ts, a WebSocket
 * to a local server) is not started, so it is not in the build at all. The
 * utility runs untrusted songs in this frame, and the frame talks only to the
 * page that holds it. */

// Palette first: style.css consumes var(--c-*) with no fallbacks, so the
// custom properties must exist before anything renders (see ui/palette.ts).
applyPalette()

// Lock the shell to the visible viewport so the mobile keyboard can't scroll
// the header off-screen (see ui/viewport.ts). Runs before mount so #app is
// sized correctly on first paint.
installViewportFit()

const app = document.getElementById('app')
if (!app) throw new Error('missing #app root')

/* No tap-to-start gate: the audio graph is built at load in a SUSPENDED
 * context (silent, no gesture needed), so the editor mounts immediately. The
 * first Run resumes the context from its own click/keypress gesture — that's
 * where the browser's audio-unlock requirement is satisfied (see editor.ts). */
AudioSession.start().then(
  (audio) => {
    const editor = mountEditor(app, audio)
    // mixer + scopes panel removed for now (mountViz) — see viz/viz.ts to restore
    // The library opens the store (IndexedDB, or an in-memory fallback) and
    // it does so asynchronously. The shelf needs the SAME store to hold
    // snippets — a second opener would be a second answer to which backend
    // is in use — so it reads through a getter that is null until this lands.
    let projectStore: ProjectStore | null = null
    const library = mountLibrary(editor)
    void library.then((h) => { projectStore = h.store }).catch((e) => console.warn('[library] failed to mount', e))
    mountDocs(editor)
    mountSynthLib(editor, () => projectStore)
    mountProbes(editor) // inline live-value readouts on modulation expressions
    // First-run onboarding: a one-question survey sets the default language,
    // a dedicated welcome project owns the coach marks (created through the
    // library, hence the promise). Mounted after docs/synthlib so the coach
    // anchors (docs button, chip bar) exist; auto-shows for first-time
    // visitors only (never over a share link).
    const tour = mountTour(editor, { library })
    /* The saved rig, applied before anything listens. Output routing takes
     * effect immediately; the input choice is held until mic() actually opens
     * a capture, so this never triggers a permission prompt on its own. */
    void audio.setPreferredDevices(getSetting('inputDevice'), getSetting('outputDevice'))
      .catch((e) => console.warn('[audio] preferred devices', e))
    // on a phone the speaker is next to the mic: 'auto' turns on echo
    // cancellation there, so a live mic chain does not simply howl
    void audio.setMicProcessing(getSetting('micProcessing'), looksMobile())
      .catch((e) => console.warn('[audio] mic processing', e))
    mountOptions(editor, {
      showTour: () => tour.start(),
      audio: {
        listDevices: () => audio.listDevices(),
        setPreferredDevices: (i, o) => audio.setPreferredDevices(i, o),
        latency: () => audio.latency(),
        deviceWarnings: () => audio.deviceWarnings(),
        setMicProcessing: (m, mob) => audio.setMicProcessing(m, mob),
        micProcessingActive: () => audio.micProcessingActive(),
      },
    }) // user settings popover (gear)
    mountMidi(editor, audio)
    mountMask(editor) // the Bluetooth LED mask as a pattern output
    // Lolly: no phone overflow menu; Lolly's own menus carry these controls
    if (!lolly) mountHeaderOverflow(editor.topbar) // after every module has added its button
    /* Lolly: Lolly's own chrome over the editor - the transport, the song, the
     * visualiser, export and menus - in place of upstream's header and the
     * WebGPU shader visuals. Upstream's header stays in the page, unseen, so its
     * panels and popovers still open from Lolly's menus. */
    lolly?.mountChrome({
      editor,
      audio,
      library,
      exports: {
        evalCode: () => {
          const source = editor.getDoc()
          if (editor.getLang() !== 'rondo') return source
          const c = compile(source)
          if (c.ok) return c.code
          const first = c.errors[0]
          return { error: first ? `line ${first.line}: ${first.message}` : 'rondo compile failed' }
        },
        bounceLoop,
        bounceStems,
        bounceMidi,
      },
      sungParts: bakedSingParts,
      sungVoices: bakedSingVoices,
      silentParts: silentSingParts,
    })
    // DEV-only: singing-engine console hook for bring-up (window.__rcSing).
    if (import.meta.env.DEV) {
      void import('./sing/devhook').then((m) => m.installSingDevHook())
      ;(window as unknown as { __rcEditor: typeof editor }).__rcEditor = editor
      ;(window as unknown as { __rcAudio: typeof audio }).__rcAudio = audio
    }
  },
  (e: unknown) => {
    const banner = document.createElement('div')
    banner.className = 'boot-error'
    banner.textContent = `audio failed to start: ${e instanceof Error ? e.message : String(e)}`
    app.append(banner)
  },
)
