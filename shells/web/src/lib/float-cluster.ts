// SPDX-License-Identifier: MPL-2.0
/**
 * The body-level FLOATING CHROME CLUSTER - one `display: contents` wrapper that
 * holds every fixed-position floating surface that must stay visible and
 * interactive over an open modal: the job toast (lib/job-toast.ts) and the undo
 * toasts (lib/undo-toast.ts).
 *
 * Why it exists: z-index can never beat the native <dialog> top layer, and
 * everything outside a showModal() dialog is inert - so mountModal
 * (components/modal.ts) ADOPTS this cluster into each dialog it opens and hands
 * it back on close. `display: contents` means the wrapper generates no box: each
 * member keeps its own `position: fixed` viewport placement wherever the cluster
 * lives. Members mount ONCE into getFloatCluster() and never re-parent
 * themselves; only the cluster moves.
 */

let cluster: HTMLElement | null = null;
/** Open modal dialogs that adopted the cluster, in open order - it lives inside
 *  the topmost so its members paint above that dialog and escape its inert. */
const adopters: HTMLElement[] = [];

/** The cluster element, created on first use (idempotent). */
export function getFloatCluster(): HTMLElement {
  if (cluster && cluster.isConnected) return cluster;
  cluster = document.createElement('div');
  cluster.className = 'float-cluster';
  cluster.style.display = 'contents';
  (adopters[adopters.length - 1] ?? document.body).appendChild(cluster);
  return cluster;
}

/** A modal <dialog> just opened - move the cluster inside it. Called by
 *  mountModal right after showModal(). */
export function adoptFloatCluster(host: HTMLElement): void {
  adopters.push(host);
  if (cluster) host.appendChild(cluster);
}

/** The adopting dialog is closing (before its node is removed) - fall back to
 *  the next-topmost open modal, or home to document.body. */
export function releaseFloatCluster(host: HTMLElement): void {
  const i = adopters.lastIndexOf(host);
  if (i >= 0) adopters.splice(i, 1);
  if (cluster) (adopters[adopters.length - 1] ?? document.body).appendChild(cluster);
}
