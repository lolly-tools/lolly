// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly completion bash|zsh|fish` - static shell-completion scripts (plans/202 WP5.1).
 *
 * `completion` was reserved as a verb ahead of this (args.ts, RESERVED_SUBCOMMANDS) so a
 * brand pack's tool id could never collide with it once it landed.
 *
 * The generated script completes:
 *   - verbs, read from RESERVED_SUBCOMMANDS - a verb added there later (the `tui` verb,
 *     for one) appears here automatically, with no second list to keep in sync
 *   - flags, from VALUE_FLAGS plus the four global boolean flags (--json, --quiet,
 *     --verbose, --strict)
 *   - tool ids, read from the active profile's catalog index at the moment
 *     the script is generated and baked into it as a flat word list
 *   - the flags whose value is a filesystem path (--output, --out-dir, --inputs,
 *     --template, --trust-anchor, --sign-key, --sign-cert, --rebuild, and rebrand's
 *     --plan-out, --plan, --preset and --source) fall through to the shell's own file
 *     completion instead of a word list
 *   - after `rebrand`, its stages (plan, compile, inspect, and presets, which lists
 *     the renovation presets) and then file names, with the folder-run flags
 *     (--jobs, --resume, --recursive) among its flags, all read from args.ts, the one
 *     home the stage and flag lists share with rebrand.ts
 *   - the `read` and `check` flags, from READ_VALUE_FLAGS, CHECK_VALUE_FLAGS and their
 *     on/off lists in args.ts: --source, --file, --edits and --media as paths, --theme,
 *     --browser, --page-cap, --ocr, --force and --thumbnails as words, and
 *     auto, off and require after --browser=
 *   - the `compose` flags, from COMPOSE_VALUE_FLAGS and COMPOSE_BOOL_FLAGS: --inventory,
 *     --master and --edits-out as paths beside --source, --file and --output, and
 *     --size, --theme, --fit, --list and --suggest as words
 *
 * A generated script is a snapshot of the catalog at generation time: installing a
 * tool later needs `lolly completion <shell>` run again to see it. That is the same
 * trade every other CLI with a static completion script makes (git, cargo, kubectl);
 * there is no host.state or filesystem access from inside a shell's completion
 * function without a lot more plumbing than a small tool catalog is worth.
 */
import { readFile } from 'node:fs/promises';
import { catalogFile } from '@lolly-tools/node-shell/content-roots';
import {
  RESERVED_SUBCOMMANDS, VALUE_FLAGS,
  REBRAND_STAGES, REBRAND_VALUE_FLAGS, REBRAND_PATH_FLAGS, REBRAND_BOOL_FLAGS,
  READ_VALUE_FLAGS, READ_BOOL_FLAGS, CHECK_VALUE_FLAGS, CHECK_BOOL_FLAGS, CHECK_BROWSER_VALUES,
  PACKAGE_VALUE_FLAGS, PACKAGE_BOOL_FLAGS, PACKAGE_PATH_FLAGS,
  MEASURE_VALUE_FLAGS, MEASURE_BOOL_FLAGS,
  COMPOSE_VALUE_FLAGS, COMPOSE_BOOL_FLAGS, COMPOSE_PATH_FLAGS,
} from './args.ts';

export type CompletionShell = 'bash' | 'zsh' | 'fish';
export const COMPLETION_SHELLS: readonly CompletionShell[] = ['bash', 'zsh', 'fish'];

const GLOBAL_BOOL_FLAGS = ['json', 'quiet', 'verbose', 'strict'] as const;

/** Value flags whose value is a filesystem path - completed as files/dirs, never a word list. */
const PATH_FLAGS = new Set([
  'output', 'out-dir', 'inputs', 'template', 'trust-anchor', 'sign-key', 'sign-cert', 'rebuild',
  // `lolly read --media=<dir>`: the folder the pictures are written to (plan 291 W2).
  'media',
  // `lolly check --file=<tokens.json>`: the design system to check against (plan 291 W1).
  'file',
  // `lolly check --edits=<edits.json>`: the source wording changed on purpose (plan 291 W1).
  'edits',
]);

/** `lolly check` and `lolly read` flags whose value is a path: the deck or inventory, the tokens, the edits list, the folder. */
const VERB_PATH_FLAGS = ['source', 'file', 'edits', 'media'] as const;

/**
 * Tool ids from the active profile's catalog, best-effort. Empty (not thrown) when no
 * profile resolves here - a published CLI with no content packs, or a brand whose
 * catalog index has never been built - so the script still completes verbs and flags.
 */
export async function catalogToolIds(): Promise<string[]> {
  try {
    const indexPath = catalogFile('tools/index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8')) as { tools: Array<{ id: string }> };
    return index.tools.map(t => t.id).filter(Boolean).sort();
  } catch {
    return [];
  }
}

function reservedVerbs(): string[] {
  return [...RESERVED_SUBCOMMANDS];
}

function wordFlagNames(): string[] {
  const names: string[] = [];
  for (const f of VALUE_FLAGS) if (!PATH_FLAGS.has(f)) names.push(`--${f}`);
  for (const f of GLOBAL_BOOL_FLAGS) names.push(`--${f}`);
  return names;
}

function pathFlagNames(): string[] {
  return [...PATH_FLAGS].map(f => `--${f}`);
}

/** Rebrand's own stages and flags, and the read and check flags, as `rebrandWords` reads them from args.ts. */
interface RebrandWords {
  stages: string[];
  flags: string[];
  pathFlags: string[];
  /** The values `--browser=` takes on `lolly check`. */
  browser: string[];
}

/**
 * The rebrand stage and flag lists. They live in args.ts beside the other verb
 * lists, so generating a script never loads the renovation pipeline.
 */
function rebrandWords(): RebrandWords {
  // `lolly package` (plan 291 W8): --asset-dir and --source as paths, --asset, --label,
  // --allow-missing-media as words (an --asset value is KEY=PATH, not a bare path).
  const paths = new Set<string>([...REBRAND_PATH_FLAGS, ...VERB_PATH_FLAGS, ...PACKAGE_PATH_FLAGS, ...COMPOSE_PATH_FLAGS]);
  const known = new Set<string>([...VALUE_FLAGS, ...GLOBAL_BOOL_FLAGS, ...PATH_FLAGS]);
  // `lolly measure --text` and `--text-layers` (plan 291 W5).
  // `lolly compose` (plan 291 W6).
  const bools: string[] = [...REBRAND_BOOL_FLAGS, ...READ_BOOL_FLAGS, ...CHECK_BOOL_FLAGS, ...PACKAGE_BOOL_FLAGS, ...MEASURE_BOOL_FLAGS, ...COMPOSE_BOOL_FLAGS];
  const values: string[] = [...REBRAND_VALUE_FLAGS, ...READ_VALUE_FLAGS, ...CHECK_VALUE_FLAGS, ...PACKAGE_VALUE_FLAGS, ...MEASURE_VALUE_FLAGS, ...COMPOSE_VALUE_FLAGS];
  const words = [...new Set([...values.filter(f => !paths.has(f)), ...bools])].filter(f => !known.has(f));
  return {
    stages: [...REBRAND_STAGES],
    flags: words.map(f => `--${f}`),
    pathFlags: [...paths].filter(f => !PATH_FLAGS.has(f)).map(f => `--${f}`),
    browser: [...CHECK_BROWSER_VALUES],
  };
}

/** Build the bare word lists a completion script needs, shared by all three shells. */
function completionWords(toolIds: string[], rebrand: RebrandWords) {
  return {
    verbs: reservedVerbs(),
    flags: [...wordFlagNames(), ...rebrand.flags],
    pathFlags: [...pathFlagNames(), ...rebrand.pathFlags],
    tools: toolIds,
    stages: rebrand.stages,
    browser: rebrand.browser,
  };
}

/** The rebrand stage that takes no inputs, so no file names are offered after it. */
const NO_INPUT_STAGE = 'presets';

function bashScript(toolIds: string[], rebrand: RebrandWords): string {
  const w = completionWords(toolIds, rebrand);
  const pathCases = w.pathFlags.join('|');
  return `# lolly bash completion
# Generated by \`lolly completion bash\`. Install with:
#   lolly completion bash > /usr/local/etc/bash_completion.d/lolly   (Homebrew bash-completion)
# or source it directly from your shell profile.
_lolly_complete() {
  local cur prev words cword
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local verbs="${w.verbs.join(' ')}"
  local tools="${w.tools.join(' ')}"
  local flags="${w.flags.join(' ')}"
  local pathflags="${w.pathFlags.join(' ')}"
  case "\${prev}" in
    ${pathCases})
      COMPREPLY=( $(compgen -f -- "\${cur}") )
      return 0
      ;;
  esac
  # \`lolly check --browser=<mode>\`: bash splits at '=' by default, so the flag sits two words back.
  if [[ "\${prev}" == "=" && "\${COMP_WORDS[COMP_CWORD-2]}" == --browser ]]; then
    COMPREPLY=( $(compgen -W "${w.browser.join(' ')}" -- "\${cur}") )
    return 0
  fi
  if [[ "\${cur}" == --browser=* ]]; then
    COMPREPLY=( $(compgen -W "${w.browser.map(v => `--browser=${v}`).join(' ')}" -- "\${cur}") )
    return 0
  fi
  if [[ "\${cur}" == -* ]]; then
    COMPREPLY=( $(compgen -W "\${flags} \${pathflags}" -- "\${cur}") )
    return 0
  fi
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${verbs} \${tools}" -- "\${cur}") )
    return 0
  fi
  if [[ "\${COMP_WORDS[1]}" == rebrand ]]; then
    if [[ \${COMP_CWORD} -eq 2 ]]; then
      COMPREPLY=( $(compgen -W "${w.stages.join(' ')}" -- "\${cur}") )
    elif [[ "\${COMP_WORDS[2]}" != ${NO_INPUT_STAGE} ]]; then
      COMPREPLY=( $(compgen -f -- "\${cur}") )
    fi
    return 0
  fi
}
complete -F _lolly_complete lolly
`;
}

function zshScript(toolIds: string[], rebrand: RebrandWords): string {
  const w = completionWords(toolIds, rebrand);
  const pathFlagsAlt = w.pathFlags.join('|');
  return `#compdef lolly
# lolly zsh completion. Generated by \`lolly completion zsh\`. Install by saving this to
# a directory on your $fpath as _lolly (e.g. ~/.zsh/completions/_lolly), then
# \`autoload -U compinit && compinit\` in your .zshrc.
_lolly() {
  local -a verbs tools flags pathflags stages
  verbs=(${w.verbs.map(v => `'${v}'`).join(' ')})
  stages=(${w.stages.map(v => `'${v}'`).join(' ')})
  tools=(${w.tools.map(t => `'${t}'`).join(' ')})
  flags=(${w.flags.map(f => `'${f}'`).join(' ')})
  pathflags=(${w.pathFlags.map(f => `'${f}'`).join(' ')})

  if [[ "\${words[CURRENT-1]}" == @(${pathFlagsAlt}) ]]; then
    _files
    return
  fi

  if [[ "\${words[CURRENT]}" == --browser=* ]]; then
    compadd -P '--browser=' ${w.browser.join(' ')}
    return
  fi

  if [[ "\${words[CURRENT]}" == -* ]]; then
    _describe 'flag' flags
    _describe 'flag' pathflags
    return
  fi

  if (( CURRENT == 2 )); then
    _describe 'command' verbs
    _describe 'tool' tools
    return
  fi

  if [[ "\${words[2]}" == rebrand ]]; then
    if (( CURRENT == 3 )); then
      _describe 'stage' stages
    elif [[ "\${words[3]}" != ${NO_INPUT_STAGE} ]]; then
      _files
    fi
  fi
}
_lolly "$@"
`;
}

function fishScript(toolIds: string[], rebrand: RebrandWords): string {
  const w = completionWords(toolIds, rebrand);
  const lines: string[] = [
    '# lolly fish completion. Generated by `lolly completion fish`. Install by saving',
    '# this to ~/.config/fish/completions/lolly.fish.',
    '',
    'complete -c lolly -f',
  ];
  for (const v of w.verbs) {
    lines.push(`complete -c lolly -n "__fish_use_subcommand" -a "${v}"`);
  }
  for (const t of w.tools) {
    lines.push(`complete -c lolly -n "__fish_use_subcommand" -a "${t}" -d "tool"`);
  }
  for (const f of w.flags) {
    if (f === '--browser') lines.push(`complete -c lolly -l "browser" -x -a "${w.browser.join(' ')}"`);
    else lines.push(`complete -c lolly -l "${f.replace(/^--/, '')}"`);
  }
  for (const f of w.pathFlags) {
    lines.push(`complete -c lolly -l "${f.replace(/^--/, '')}" -r -F`);
  }
  const stages = w.stages.join(' ');
  lines.push(`complete -c lolly -n "__fish_seen_subcommand_from rebrand; and not __fish_seen_subcommand_from ${stages}" -a "${stages}"`);
  const inputStages = w.stages.filter(stage => stage !== NO_INPUT_STAGE).join(' ');
  lines.push(`complete -c lolly -n "__fish_seen_subcommand_from rebrand; and __fish_seen_subcommand_from ${inputStages}" -F`);
  return lines.join('\n') + '\n';
}

/** Render the completion script for one shell. Reads the catalog itself (best-effort,
 *  see catalogToolIds); callers do not need to fetch tool ids separately. */
export async function generateCompletion(shell: CompletionShell): Promise<string> {
  const toolIds = await catalogToolIds();
  const rebrand = rebrandWords();
  switch (shell) {
    case 'bash': return bashScript(toolIds, rebrand);
    case 'zsh': return zshScript(toolIds, rebrand);
    case 'fish': return fishScript(toolIds, rebrand);
  }
}
