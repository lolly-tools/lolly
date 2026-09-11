// Types for the vendored Jelly UI bundle (jelly.mjs). Importing the module is
// side-effecting: it defines every <jelly-*> custom element and injects the
// default token stylesheet (@layer jelly) into document.head. Only the surface
// lib/jelly.ts actually touches is declared; the bundle exports much more.

/** Pin the jelly light/dark mode (sets [data-jelly-mode] on <html>) and notify. */
export declare function setThemeMode(mode?: 'light' | 'dark' | 'auto'): void;

/** Dispatch the window 'jelly-theme-change' event that repaints settled canvases. */
export declare function notifyThemeChange(): void;
