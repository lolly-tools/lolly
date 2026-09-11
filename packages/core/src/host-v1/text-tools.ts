// SPDX-License-Identifier: MPL-2.0

export interface TextOperation {
  id: string;
  label: string;
  group: 'Edit' | 'Inspect' | 'Convert' | 'Generate';
  keywords: string[];
  options?: Array<{
    id: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select';
    default?: string | number | boolean;
    choices?: string[];
  }>;
}

export interface TextToolRequest {
  text: string;
  operation: string;
  options?: Record<string, string | number | boolean>;
}

export interface TextToolResult {
  text: string;
  format: string;
  notes: string[];
  /** Observations, never proof of authorship or a root cause. */
  details?: Record<string, unknown>;
}

/** Portable, on-device text operations. Added in v1.191. */
export interface TextToolsAPI {
  highlight(
    text: string,
    language?: string,
    options?: { calloutMode?: string; calloutPrefixes?: string[] }
  ): Promise<{ html: string; language: string; truncated: boolean }>;
  operations(): Promise<TextOperation[]>;
  run(request: TextToolRequest): Promise<TextToolResult>;
}
