// SPDX-License-Identifier: MPL-2.0
/**
 * approval-request - a generic seam for opening the "request approval" flow.
 *
 * The sibling of lib/share-sections.ts one purpose over: where that lets a feature
 * register EXTRA sections into the Share dialog, this lets a feature register the
 * opener for an approval-request flow, so the tool view can offer "Request approval"
 * without importing any of the machinery behind it. No opener is registered by
 * default, so `openApprovalRequest` is a no-op returning false and the view is
 * byte-identical until something registers one.
 *
 * It knows nothing about WHO registers the opener: a deployment's optional control
 * plane registers one that opens the approval dialog (see src/org/), but the registry
 * is a standalone primitive - a test or a future feature can drive it the same way.
 * The opener is handed a small, product-neutral context (the tool id, an optional
 * subject reference, a default title and, when the opener asked for it, the exact
 * file the view exported) and owns everything else.
 */

/** The file a request is about: the bytes the export made, untouched. */
export interface ApprovalArtifact {
  blob: Blob;
  /** The file's name, with the extension the export chose. */
  name: string;
  /** The tool's current inputs as a URL-mode query. The instance reads them to work
   *  out a digest and does not keep them. */
  query?: string;
  /** The saved session this came from, when there is one. */
  sessionId?: string;
  /** A picture of a PDF's first page, for the requester's own dialog. Never sent. */
  firstPage?: () => Promise<Blob | null>;
}

export interface ApprovalRequestContext {
  /** The tool whose output is being submitted for approval. */
  toolId?: string;
  /** A short identifier for the subject being approved (e.g. a saved-session id).
   *  When absent, the flow derives a tool-scoped default. */
  subjectRef?: string;
  /** A sensible default title for the request (e.g. the tool/session name). */
  title?: string;
  /** The exported file, when `approvalWantsArtifact` said to make one. */
  artifact?: ApprovalArtifact;
  /** Called once the request has been accepted, so a view can show its new state. */
  onSent?: () => void;
}

/** Where a tool's current inputs stand with the instance's reviewers. */
export type ApprovalState = 'none' | 'in_review' | 'approved' | 'rejected' | 'changed';

/** The instance's answer for one tool, format and set of inputs. */
export interface ApprovalStatus {
  state: ApprovalState;
  approvalId?: string;
  fingerprint?: string;
  title?: string;
  decidedAt?: string;
}

/** A saved session's request, for the views that list sessions. */
export interface SessionApproval {
  state: 'in_review' | 'approved';
  approvalId: string;
  title: string;
  decidedAt?: string;
}

/** What a registered approval flow can tell and fetch for a view. Every method is
 *  optional work for the view: it holds no knowledge of where the answers come from. */
/** What one request records about its file, to compare with the current settings. */
export interface ApprovalFile {
  approvalId: string;
  state: 'in_review' | 'approved' | 'rejected';
  format: string;
  /** Absent when the requesting app could not measure the file, as with a PDF. */
  widthPx?: number;
  heightPx?: number;
  /** A video's encoder can move a side by a pixel to reach an even size. */
  video: boolean;
  decidedAt?: string;
}

export interface ApprovalWork {
  /** The state of these inputs, or null when this instance does not say. */
  status(query: { toolId: string; format: string; query: string }, signal?: AbortSignal): Promise<ApprovalStatus | null>;
  /** This request's file, and the files of other requests for the same tool, format,
   *  tool version and inputs, newest first. Empty when the list does not hold this request. */
  files(approvalId: string): Promise<ApprovalFile[]>;
  /** The approved file's exact bytes. Rejects when they are not released to this person. */
  approvedFile(approvalId: string): Promise<{ blob: Blob; name: string }>;
  /** Open the request, with its file and its history. */
  open(approvalId: string): void;
  /** The newest request for each saved session this person raised. */
  sessions(signal?: AbortSignal): Promise<ReadonlyMap<string, SessionApproval>>;
}

/** Opens the approval-request flow for the given context. */
export type ApprovalOpener = (ctx: ApprovalRequestContext) => void;

let opener: ApprovalOpener | undefined;
let wantsArtifact: ((toolId: string) => boolean) | undefined;
let work: ApprovalWork | undefined;
let pdfPreview: ((blob: Blob) => Promise<Blob | null>) | undefined;

/** Register the approval opener; returns an unregister fn. A later register replaces
 *  the current opener (last wins), mirroring a single-owner flow. */
export function registerApprovalOpener(fn: ApprovalOpener, opts: { wantsArtifact?: (toolId: string) => boolean; work?: ApprovalWork } = {}): () => void {
  opener = fn;
  wantsArtifact = opts.wantsArtifact;
  work = opts.work;
  return () => { if (opener === fn) { opener = undefined; wantsArtifact = undefined; work = undefined; } };
}

/** The registered flow's working state, or undefined when there is none: the view
 *  then shows the plain request and asks nothing. */
export function approvalWork(): ApprovalWork | undefined {
  return work;
}

/** Supply the picture of a PDF's first page. The reader lives with the views, above
 *  this layer, so the app registers it once. */
export function setApprovalPdfPreview(fn: (blob: Blob) => Promise<Blob | null>): void {
  pdfPreview = fn;
}

/** A PDF's first page as a picture, or null when no reader is registered or it fails. */
export async function approvalPdfPreview(blob: Blob): Promise<Blob | null> {
  try { return (await pdfPreview?.(blob)) ?? null; } catch { return null; }
}

/** Whether the view should make the export first and hand it over. False when the
 *  opener cannot take a file, so nothing is rendered for a request with no file. */
export function approvalWantsArtifact(toolId: string): boolean {
  try { return !!opener && !!wantsArtifact?.(toolId); } catch { return false; }
}

/**
 * Open the approval-request flow, or do nothing when none is registered (the dormant
 * default). Returns whether an opener handled it. Tolerant: a throwing opener is
 * swallowed so a consulting view can never break on it.
 */
export function openApprovalRequest(ctx: ApprovalRequestContext): boolean {
  if (!opener) return false;
  try { opener(ctx); return true; } catch { return false; }
}

/** TEST-ONLY: drop any registered opener, restoring the dormant default. */
export function _clearApprovalOpenerForTests(): void {
  opener = undefined;
  wantsArtifact = undefined;
  work = undefined;
  pdfPreview = undefined;
}
