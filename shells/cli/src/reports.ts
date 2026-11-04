// SPDX-License-Identifier: MPL-2.0
/** Local adapters for saved check envelopes. No check is rerun and nothing is uploaded. */
import { writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { usageError } from './exit-codes.ts';
import { emitResult } from './envelope.ts';
import { writeOut } from './output.ts';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : null;
const string = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
export interface ReportCase {
  suite: string;
  rule: string;
  message: string;
  state: 'passed' | 'failed' | 'error' | 'skipped';
  level: 'error' | 'warning' | 'note' | 'none';
  properties: ObjectValue;
  location?: { file: string; line?: number };
}

function findingCase(value: unknown, suite: string): ReportCase {
  const finding = object(value);
  if (!finding || typeof finding.message !== 'string')
    throw usageError('A finding has no message.', 'BAD_REPORT');
  const severity = string(finding.severity);
  if (!['error', 'warn', 'warning', 'info', 'gap'].includes(severity))
    throw usageError(`Unknown finding severity: ${severity}.`, 'BAD_REPORT');
  const level =
    severity === 'error' ? 'error' : ['warn', 'warning'].includes(severity) ? 'warning' : 'note';
  const location = object(finding.location);
  const line = location?.line;
  const fallbackRule =
    'finding.' +
    createHash('sha256')
      .update(JSON.stringify([finding.message, finding.blockId, finding.lessonId]))
      .digest('hex')
      .slice(0, 12);
  const unmeasured =
    severity === 'gap' ||
    ['not-computable', 'unknown', 'visual-check'].includes(string(finding.needs));
  return {
    suite,
    rule: string(finding.code) || string(finding.id) || fallbackRule,
    message: finding.message,
    level,
    state: severity === 'error' ? 'failed' : unmeasured ? 'skipped' : 'passed',
    properties: Object.fromEntries(
      ['path', 'layerId', 'artboardId', 'page', 'theme', 'needs', 'family', 'blockId', 'lessonId']
        .filter((key) => finding[key] !== undefined)
        .map((key) => [key, finding[key]])
    ),
    ...(typeof location?.file === 'string'
      ? {
          location: {
            file: location.file,
            ...(Number.isInteger(line) && Number(line) > 0 ? { line: Number(line) } : {}),
          },
        }
      : {}),
  };
}

/** Unknown shapes refuse rather than becoming an empty passing test suite. */
export function reportCases(value: unknown, name = 'lolly'): ReportCase[] {
  const root = object(value);
  if (!root) throw usageError('Expected a Lolly check envelope or batch receipt.', 'BAD_REPORT');
  const isEnvelope = root.schemaVersion !== undefined;
  if (
    isEnvelope &&
    (root.schemaVersion !== 1 || typeof root.command !== 'string' || typeof root.ok !== 'boolean')
  )
    throw usageError('Unsupported Lolly envelope.', 'BAD_REPORT');
  const suite = isEnvelope ? string(root.command) : name;
  const error = object(root.error);
  if (error)
    return [
      {
        suite,
        rule: string(error.kind, 'command.error'),
        message: string(error.message, 'The command could not run.'),
        level: 'error',
        state: 'error',
        properties: { exit: error.exit },
      },
    ];
  const result = isEnvelope ? object(root.result) : root;
  if (!result) throw usageError('This report has no result.', 'BAD_REPORT');
  const cases: ReportCase[] = [];
  let recognized = false;
  if (Array.isArray(result.findings)) {
    recognized = true;
    cases.push(...result.findings.map((finding) => findingCase(finding, suite)));
  }
  if (Array.isArray(result.rows)) {
    recognized = true;
    for (const [index, value] of result.rows.entries()) {
      const row = object(value);
      if (!row || typeof row.ok !== 'boolean')
        throw usageError('Malformed batch row result.', 'BAD_REPORT');
      const rowSuite = `${suite}.row-${row.row ?? index + 1}`;
      if (row.report)
        cases.push(
          ...reportCases(row.report, rowSuite).map((item) => ({ ...item, suite: rowSuite }))
        );
      if (!row.ok || !row.report)
        cases.push({
          suite: rowSuite,
          rule: 'batch.row',
          message: row.ok ? 'Row completed.' : string(row.error, 'Row did not complete.'),
          level: row.ok ? 'none' : 'error',
          state: row.ok ? 'passed' : 'failed',
          properties: { row: row.row, toolId: row.toolId, reused: row.reused },
        });
    }
  }
  for (const [family, state] of Object.entries(object(result.families) ?? {})) {
    const detail = object(state);
    if (!detail || !['skipped', 'unavailable', 'failed'].includes(string(detail.state))) continue;
    cases.push({
      suite,
      rule: `family.${family}`,
      message: string(detail.reason, `Family ${family}: ${detail.state}.`),
      level: detail.state === 'failed' ? 'error' : 'note',
      state: detail.state === 'failed' ? 'error' : 'skipped',
      properties: { family },
    });
  }
  for (const value of Array.isArray(result.checks) ? result.checks : []) {
    const check = object(value);
    if (check?.state === 'undetermined')
      cases.push({
        suite,
        rule: string(check.id, 'check.undetermined'),
        message: string(check.reason, 'This check could not be determined.'),
        level: 'note',
        state: 'skipped',
        properties: {},
      });
  }
  if (!recognized)
    throw usageError(
      'Expected findings or batch row results. This command is not a check report.',
      'BAD_REPORT'
    );
  for (const warning of Array.isArray(root.warnings) ? root.warnings : []) {
    const detail = object(warning);
    if (detail)
      cases.push({
        suite,
        rule: string(detail.code, 'command.warning'),
        message: string(detail.message, 'Command warning.'),
        level: 'warning',
        state: 'passed',
        properties: {},
      });
  }
  if (root.ok === false && !cases.some((item) => ['failed', 'error'].includes(item.state)))
    cases.push({
      suite,
      rule: 'command.outcome',
      message: 'The source command reported a nonzero outcome. Review its findings.',
      level: 'error',
      state: 'failed',
      properties: { outcome: result.outcome, exitCode: result.exitCode },
    });
  if (!cases.length)
    cases.push({
      suite,
      rule: 'command.complete',
      message: 'The reported checks completed without findings.',
      level: 'none',
      state: 'passed',
      properties: {},
    });
  return cases;
}

function xml(value: string): string {
  const valid = [...value]
    .filter((character) => {
      const n = character.codePointAt(0)!;
      return (
        n === 9 ||
        n === 10 ||
        n === 13 ||
        (n >= 32 && n <= 0xd7ff) ||
        (n >= 0xe000 && n <= 0xfffd) ||
        n >= 0x10000
      );
    })
    .join('');
  return valid.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!
  );
}

export function junitReport(cases: ReportCase[]): string {
  const failed = cases.filter((item) => item.state === 'failed').length;
  const errors = cases.filter((item) => item.state === 'error').length;
  const skipped = cases.filter((item) => item.state === 'skipped').length;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${cases.length}" failures="${failed}" errors="${errors}" skipped="${skipped}">\n<testsuite name="Lolly" tests="${cases.length}" failures="${failed}" errors="${errors}" skipped="${skipped}">\n${cases
    .map((item) => {
      const details = `${item.message}\n${JSON.stringify(item.properties)}`;
      const tag =
        item.state === 'failed'
          ? 'failure'
          : item.state === 'error'
            ? 'error'
            : item.state === 'skipped'
              ? 'skipped'
              : 'system-out';
      return `<testcase classname="${xml(item.suite)}" name="${xml(item.rule)}"><${tag}${['failure', 'error'].includes(tag) ? ` type="${item.level}"` : ''}>${xml(details)}</${tag}></testcase>`;
    })
    .join('\n')}\n</testsuite>\n</testsuites>\n`;
}

/** SARIF 2.1.0; physical locations are emitted only when the report supplies them. */
export function sarifReport(cases: ReportCase[]): ObjectValue {
  const rules = [...new Set(cases.map((item) => item.rule))];
  return {
    version: '2.1.0',
    $schema: 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'Lolly',
            informationUri: 'https://lolly.tools',
            rules: rules.map((id) => ({ id })),
          },
        },
        invocations: [{ executionSuccessful: !cases.some((item) => item.state === 'error') }],
        results: cases.map((item) => ({
          ruleId: item.rule,
          ruleIndex: rules.indexOf(item.rule),
          level: item.level,
          kind:
            item.state === 'skipped'
              ? 'review'
              : ['failed', 'error'].includes(item.state)
                ? 'fail'
                : item.level === 'none'
                  ? 'pass'
                  : 'informational',
          message: { text: item.message },
          properties: { suite: item.suite, ...item.properties },
          partialFingerprints: {
            'lolly/v1': createHash('sha256')
              .update(JSON.stringify([item.suite, item.rule, item.properties]))
              .digest('hex'),
          },
          ...(item.location
            ? {
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: pathToFileURL(resolve(item.location.file)).href },
                      ...(item.location.line ? { region: { startLine: item.location.line } } : {}),
                    },
                  },
                ],
              }
            : {}),
        })),
      },
    ],
  };
}

export async function reportsCli(
  args: string[],
  flags: Record<string, string>,
  json: boolean
): Promise<void> {
  if (args.length !== 1 || !['junit', 'sarif', 'jsonl'].includes(flags.to ?? ''))
    throw usageError(
      'lolly reports <report.json|-> --to=junit|sarif|jsonl [--output=new-file] [--input-format=jsonl]',
      'USAGE'
    );
  if (json && !flags.output)
    throw usageError(
      '--json needs --output so the envelope and converted report use separate destinations.',
      'BAD_INPUT'
    );
  if (flags['input-format'] && !['json', 'jsonl'].includes(flags['input-format']))
    throw usageError('--input-format must be json or jsonl.', 'BAD_INPUT');
  const stream = args[0] === '-' ? process.stdin : createReadStream(args[0]!);
  stream.setEncoding('utf8');
  const chunks: string[] = [];
  let bytes = 0;
  for await (const chunk of stream) {
    const text = String(chunk);
    bytes += Buffer.byteLength(text);
    if (bytes > 16 * 1024 * 1024) throw usageError('Report input exceeds 16 MB.', 'BAD_REPORT');
    chunks.push(text);
  }
  const input = chunks.join('');
  const jsonl =
    flags['input-format'] === 'jsonl' || (!flags['input-format'] && /\.jsonl$/i.test(args[0]!));
  let values: unknown[];
  try {
    values = jsonl
      ? input
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line))
      : [JSON.parse(input)];
  } catch {
    throw usageError('Report input is not valid JSON.', 'BAD_REPORT');
  }
  if (!values.length) throw usageError('Report input is empty.', 'BAD_REPORT');
  const cases = values.flatMap((value) => reportCases(value));
  const text =
    flags.to === 'junit'
      ? junitReport(cases)
      : flags.to === 'sarif'
        ? JSON.stringify(sarifReport(cases), null, 2) + '\n'
        : cases.map((item) => JSON.stringify(item)).join('\n') + '\n';
  if (!flags.output) await writeOut(text);
  else {
    await writeFile(flags.output, text, { flag: 'wx', mode: 0o600 });
    const result = {
      output: flags.output,
      format: flags.to,
      cases: cases.length,
      failures: cases.filter((item) => ['failed', 'error'].includes(item.state)).length,
    };
    if (json) await emitResult(result);
    else await writeOut(JSON.stringify(result) + '\n');
  }
}
