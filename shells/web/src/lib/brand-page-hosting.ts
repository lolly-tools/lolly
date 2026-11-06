// SPDX-License-Identifier: MPL-2.0
/**
 * Publishing a brand page to the connected instance, and sending it a design system
 * edit, as a seam the organisation layer fills. A shell with no instance, or an
 * instance that has not turned brand pages on, has no hosting here, and Download stays
 * the way out. A person who may not edit the instance has no edit hosting here.
 *
 * The org module registers the instance here and the Design System Setup sheets read
 * the report. Neither imports the other, and the organisation layer never imports a view.
 */

/** What publishing did. An instance with an approval chain holds a revision until it is approved. */
export interface BrandPagePublishedV1 {
  url: string;
  state: 'live' | 'pending' | 'unchanged';
}

export interface BrandPageHostingV1 {
  /** The instance's host name, for the button: "Publish to work.example.com". */
  host: string;
  /** The address pages are served from, with no trailing slash. */
  base: string;
  /** A chain must approve each revision before it goes live. */
  approval: boolean;
  /** The largest bundle the instance takes, in bytes. */
  maxBundleBytes: number;
  /** One explicit act: upload this folder. The instance serves it under the manifest's id. */
  publish(input: { bundle: Uint8Array }): Promise<BrandPagePublishedV1>;
}

/** What the instance serves now, and the mounted document every edit is compared with. */
export interface BrandEditDocumentV1 {
  sourceId: string;
  label: string;
  baseChecksum: string;
  /** The mounted document, as text. */
  base: string;
  /** The document this instance serves, as text: the mounted one, or the live edit on top. */
  served: string;
  /** The live revision, or null. */
  live: number | null;
}
export interface BrandEditLineV1 {
  kind: 'colour' | 'colourway' | 'role' | 'binding' | 'brand-page';
  name: string;
  /** The name a person gave this colour, when the document holds one. */
  label?: string;
  action: 'added' | 'changed' | 'removed';
  before: string | null;
  after: string | null;
}
export interface BrandEditPreviewV1 {
  lines: BrandEditLineV1[];
  /** What the document changes that this instance does not take, by name. */
  outOfScope: string[];
  /** Changed values this instance cannot accept, in a sentence each. */
  invalid: string[];
  unchanged: boolean;
  /** A chain has to approve this before it goes live. */
  approval: boolean;
  /** What becomes of the connect download once this goes live. */
  connect: 'none' | 'derived' | 'withdrawn' | 'stopped';
  digest: string;
  revision: number;
  reviewToken: string;
}
export interface BrandEditSentV1 { state: 'live' | 'pending' | 'none'; unchanged?: boolean; revision?: number; digest?: string }

/** Sending a design system's colours, colour roles and brand page address to the instance. */
export interface BrandEditHostingV1 {
  host: string;
  base: string;
  approval: boolean;
  maxDocumentBytes: number;
  read(): Promise<BrandEditDocumentV1>;
  preview(input: { document: string; base: string }): Promise<BrandEditPreviewV1>;
  send(input: { document: string; base: string; revision: number; reviewToken: string }): Promise<BrandEditSentV1>;
}

/** The connected instance's address and offer, for an agent's setup. Never a token. */
export interface ConnectedInstanceV1 {
  host: string;
  mcpUrl: string;
  /** Present when this instance serves brand pages and this caller may publish one. */
  brandPages: BrandPageHostingV1 | null;
  /** Present when this instance can keep an edit and this caller may send one. */
  brandEdits: BrandEditHostingV1 | null;
}

let current: ConnectedInstanceV1 | null = null;
const listeners = new Set<(instance: ConnectedInstanceV1 | null) => void>();

/** The organisation layer's report. Null when no instance is connected. */
export function setConnectedInstance(instance: ConnectedInstanceV1 | null): void {
  current = instance;
  for (const listener of listeners) listener(instance);
}

/** Hear of the next report, for a view that mounted before the organisation layer answered. Returns the way to stop. */
export function onConnectedInstance(listener: (instance: ConnectedInstanceV1 | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function connectedInstance(): ConnectedInstanceV1 | null {
  return current;
}
