// SPDX-License-Identifier: MPL-2.0
/** Discoverable terminal actions, all delegated to existing CLI commands. */
export interface TerminalWorkflow {
  id: string;
  label: string;
  fields: Array<{ id: string; label: string; initial?: string }>;
  args(values: Record<string, string>): string[];
}
const source = { id: 'source', label: 'Input file' };
const output = { id: 'output', label: 'Output file (new destination)' };
export const TERMINAL_WORKFLOWS: TerminalWorkflow[] = [
  { id: 'models', label: 'Inspect installed models', fields: [], args: () => ['models', 'ls'] },
  {
    id: 'inspect',
    label: 'Inspect a file and its conversion options',
    fields: [source],
    args: (v) => ['files', 'inspect', v.source!],
  },
  {
    id: 'convert',
    label: 'Convert a file',
    fields: [
      source,
      { id: 'format', label: 'Target format (for example png, csv or pdf-compress)' },
      output,
    ],
    args: (v) => ['files', 'convert', v.source!, `--to=${v.format}`, `--output=${v.output}`],
  },
  {
    id: 'check',
    label: 'Check a document locally',
    fields: [source],
    args: (v) => ['check', v.source!, '--browser=off'],
  },
  {
    id: 'learning-check',
    label: 'Check a learning module',
    fields: [source],
    args: (v) => ['learning', 'check', v.source!],
  },
  {
    id: 'learning-build',
    label: 'Build a learning package',
    fields: [source, { id: 'format', label: 'Package format', initial: 'scorm12' }, output],
    args: (v) => ['learning', 'build', v.source!, `--format=${v.format}`, `--output=${v.output}`],
  },
  {
    id: 'compose',
    label: 'Compose slides from a JSON spec',
    fields: [source, output],
    args: (v) => ['compose', v.source!, `--output=${v.output}`],
  },
];
