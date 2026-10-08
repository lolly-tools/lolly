/* ------------------------------------------------------------------------- *
 * Lolly host seam (added by Lolly's patch series, not part of upstream).
 *
 * Lolly runs this app inside an opaque-origin frame of its Rondocode utility.
 * Before any module of the app is evaluated, Lolly's boot script puts one
 * object on globalThis.__lollyRondo. Every Lolly patch reads the host through
 * this module, so the patches stay small, and with no host present
 * (lolly === null) the app behaves exactly as upstream wrote it.
 * ------------------------------------------------------------------------- */

/** A song as the utility holds it: the editor text, its language, a name. */
export interface LollySong {
  code: string
  /** 'rondocode' is the JavaScript dialect; undefined means "sniff it". */
  lang?: 'rondocode' | 'rondo'
  name: string
}

/** The project library backend (session/projects.ts Db), kept by Lolly. */
export interface LollyDb {
  all<T>(store: string): Promise<T[]>
  get<T>(store: string, id: string): Promise<T | undefined>
  put(store: string, value: unknown): Promise<void>
  del(store: string, id: string): Promise<void>
}

/** What Lolly's chrome drives: the app's own objects and its offline renders. */
export interface LollyChromeHandles {
  editor: import('../editor/editor').EditorHandle
  audio: import('../audio/AudioSession').AudioSession
  library: Promise<import('../editor/library').LibraryHandle>
  exports: {
    /** The program an offline render runs (rondo source compiled to JavaScript). */
    evalCode(): string | { error: string }
    bounceLoop: typeof import('../editor/export').bounceLoop
    bounceStems: typeof import('../editor/export').bounceStems
    bounceMidi: typeof import('../editor/export').bounceMidi
  }
  /** The parts whose synthesised singing is loaded, when the app can sing. */
  sungParts?(): string[]
  /** The voices that singing was synthesised with. */
  sungVoices?(): string[]
  /** Sung parts left silent because Lolly had no singing models to give. */
  silentParts?(): string[]
}

export interface LollyHost {
  /** The resolved colour table: upstream's palette entries, by their const names. */
  palette: Readonly<Record<string, string>>
  /** The library backend. Resolves once the saved library has arrived. */
  openDb(): Promise<LollyDb>
  /** The song the utility opened with, or null to carry on with the library. */
  song: LollySong | null
  /** Report the editor's current song to the utility (debounced by the host). */
  publishDoc(song: Required<LollySong>): void
  /** The utility replaced the song (undo, a pasted link, a collaborator). */
  onSong(fn: (song: LollySong) => void): void
  /** Hand a finished file to Lolly, which saves it the way the app saves files.
   *  `sung` lists the parts whose generated singing is in the file, so Lolly
   *  can tell the person the file holds AI-generated vocals. */
  download(bytes: Uint8Array, name: string, type: string, about?: { sung?: string[]; voices?: string[] }): void
  /** Mount Lolly's chrome: transport, song, visualiser, export, menus. */
  mountChrome(handles: LollyChromeHandles): void
  /** Show a plain notice in the editor. `key` keeps one notice per subject. */
  notice(key: string, message: string): void
  /**
   * The bytes of singing-model files, by their file id (lolly/sing.ts lists
   * them). Lolly asks the person, downloads or reads them from its own store,
   * and transfers them in; a refusal rejects with a LollySingRefusal.
   */
  singModels(files: string[], onProgress?: (p: { label: string; done: number; total: number }) => void): Promise<Record<string, ArrayBuffer>>
}

/** Why Lolly did not hand over singing models. */
export interface LollySingRefusal extends Error {
  lollyReason: 'declined' | 'offline' | 'error'
}

export const lolly: LollyHost | null =
  (globalThis as { __lollyRondo?: LollyHost }).__lollyRondo ?? null
