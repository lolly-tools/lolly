// SPDX-License-Identifier: MPL-2.0

export type MountDisposer = () => void;

export interface MountLifecycleOptions {
  onDisposeError?: (name: string, error: unknown) => void;
}

/**
 * Owns resources acquired by one mounted browser view. Disposal aborts first,
 * then releases named resources in reverse acquisition order. A resource added
 * after navigation has already won is released immediately instead of leaking.
 */
export class MountLifecycle {
  readonly #abort = new AbortController();
  readonly #resources: Array<{ name: string; dispose: MountDisposer }> = [];
  readonly #onDisposeError: (name: string, error: unknown) => void;
  #disposed = false;

  constructor(options: MountLifecycleOptions = {}) {
    this.#onDisposeError = options.onDisposeError ?? ((name, error) => {
      console.error(`[mount] failed to dispose ${name}`, error);
    });
  }

  get signal(): AbortSignal {
    return this.#abort.signal;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  add(name: string, dispose: MountDisposer): MountDisposer {
    if (!name.trim()) throw new TypeError('A mounted resource needs a name');
    if (this.#disposed) {
      this.#run(name, dispose);
      return () => {};
    }
    const resource = { name, dispose };
    this.#resources.push(resource);
    return () => {
      const index = this.#resources.indexOf(resource);
      if (index >= 0) this.#resources.splice(index, 1);
    };
  }

  listen(
    name: string,
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): MountDisposer {
    target.addEventListener(type, listener, options);
    return this.add(name, () => target.removeEventListener(type, listener, options));
  }

  timeout(name: string, callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      unregister();
      if (!this.#disposed) callback();
    }, delayMs);
    const unregister = this.add(name, () => clearTimeout(id));
    return id;
  }

  animationFrame(
    name: string,
    callback: FrameRequestCallback,
    scheduler: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'> = window,
  ): number {
    const id = scheduler.requestAnimationFrame((time) => {
      unregister();
      if (!this.#disposed) callback(time);
    });
    const unregister = this.add(name, () => scheduler.cancelAnimationFrame(id));
    return id;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#abort.abort();
    for (let resource = this.#resources.pop(); resource; resource = this.#resources.pop()) {
      this.#run(resource.name, resource.dispose);
    }
  }

  #run(name: string, dispose: MountDisposer): void {
    try {
      dispose();
    } catch (error) {
      this.#onDisposeError(name, error);
    }
  }
}
