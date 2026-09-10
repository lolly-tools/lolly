#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * lolly CLI - the entry point.
 *
 * The usage text below is the REAL one: USAGE is printed by `lolly --help`, exit codes
 * and all (they used to live only in docs/cli.md, where a script author never sees them).
 *
 * Architectural note: this CLI is URL mode under a different transport. --foo=bar argv
 * pairs become the same input values the web shell would parse from ?foo=bar in the URL
 * hash. The engine doesn't know which path delivered them.
 *
 * TWO RULES this file exists to enforce (plans/73-cli-ga-contract.md section 0):
 *   • stdout carries the payload and nothing else; every diagnostic goes to stderr.
 *   • NOTHING here calls process.exit() after writing to stdout. An exit() right after
 *     a pipe write discards the unflushed remainder - a 638 KB PNG arrived as 65536
 *     bytes that way. The exit code is set on process.exitCode and the process ends
 *     when the event loop drains, which is what flushes the pipe.
 */

import { argv } from 'node:process';
import { readFile } from 'node:fs/promises';
import { parseToolUrl, normalizeLang } from '@lolly/engine';
import { runToolCli, listToolsCli, showToolInputsCli, listAssetsCli, readStdin } from '../src/run.ts';
import { parseArgs, globalFlags, isOn, textMode, resolvePassword, RESERVED_SUBCOMMANDS, isMlSubcommand } from '../src/args.ts';
import { EXIT, exitCodeFor, usageError } from '../src/exit-codes.ts';
import { configureOutput, strictExitCode, note, writeOut, keepConsoleOffStdout } from '../src/output.ts';
import { beginCommand, emitError, jsonRequested, envelopeEmitted } from '../src/envelope.ts';
import { assertContentRoot, needsContentRoot } from '../src/content-root.ts';

const USAGE = `lolly - constraint-first asset generation from the terminal.

Usage:
  lolly                                    welcoming start in a TTY; list tools when piped
  lolly start                              show colour, .lolly/import and explore paths
  lolly system status                      show the active terminal design system
  lolly system init --color=#7c3aed        build and activate a system from one colour
  lolly system import <file>                import .lolly, tokens, Penpot, token zip or SVG
  lolly system add <file…>                  retain logos, fonts and other source material
  lolly system export [--output=brand.lolly] export a portable system pack
  lolly system list | use <id>              list or switch on-device systems
  lolly list                               list tools (explicit spelling)
  lolly describe <tool-id> [--all]         show essential inputs; --all shows every input
  lolly run <tool-id> [--flags]            render
  lolly compile <tool-id> [--inputs=x.json] compile a hydrated document (JSON)
  lolly schema <tool-id>                    print its typed input JSON Schema
  lolly inspect|measure <document.json>     inspect without rasterising
  lolly prepare <file…>                   inspect and prepare private files locally
  lolly diff <a.json> <b.json>              semantic document diff
  lolly optimize <document.json>            run named immutable stages
  lolly package <document.json> [--output]  write a portable .lolly package
  lolly validate <document.json> --document validate a compiled document (or a
                           tool id with --inputs=x.json) through the document API
  lolly <tool-id> [--flags]                sugar for run (or describe, with no flags)
  lolly <https://lolly.tools/#/tool/…>     run a pasted link; later --flags override it

Subcommands:
  lolly assets [query] [--type=raster]     list catalog asset ids usable as asset inputs
  lolly batch <rows.csv> [--out-dir=./out] render one file per CSV row (--keep-going)
  lolly preflight <tool-id|url> [--json]   count and check an export without rendering it
                           add --rate-card=<f.json> to cost the counts against your
                           printer's own rates (--run-length=N feeds perUnit lines;
                           --use-expired-rates opts in past the card's validUntil)
                        [--strict]         (exit 4 when a check says no; 2 if it could
                                            not run. Report goes to stdout - redirect it)
  lolly smoke [--only=a,b] [--format=svg]  render every catalog tool at defaults (CI gate)
  lolly icons <icon.svg>… --name --license build a hicolor icon RPM (offline, reproducible)
                        [--id --symbolic --output]
  lolly pack --type=font <font.ttf>…       build a font RPM (fc-cache scriptlet, /usr/share/fonts)
                        --name --license [--foundry --output]
  lolly validate <file…> [--json] [--deep] check Content Credentials (--deep adds the
                                           neural pixel-watermark scan; needs a browser)
                        [--metadata]       …and report what else is in the file: embedded
                                           metadata, PDF structure, and text present in
                                           the file but not visible on the page
                        [--rebuild=<session.lolly>]   the reproducibility receipt: render
                                           the session again here and report IDENTICAL
                                           (exit 0) or DIFFERENT (exit 1) with why.
                                           svg/emf/eps/dxf/csv only - raster and PDF
                                           bytes depend on the browser engine
                        [--trust-anchor=<root.pem>]   pin a CA root (repeatable)
                        [--no-default-anchors]        …and trust ONLY what you pinned:
                                           drops the Lolly CA root and the vendored
                                           C2PA list. With nothing pinned, nothing is
                                           trusted - the bare-trust check
  lolly install-browser [--with-deps]      one-time Chromium download for the full render
                                           tier (also needs \`pnpm run build:web\`)
  lolly models ls                          which on-device model files are here
  lolly models fetch <family> [--yes]      download one model family (prints the size
                                           first and asks; --yes answers in advance).
                                           kokoro, whisper, upscale, matte, ocr,
                                           ai-detect, reword - depth has no published
                                           model yet and refuses instead
  lolly speak "<text>" [--out=clip.wav]    on-device text to speech, WAV out
                        [--voice=bf_lily] [--speed=1] [--json for word timings]
  lolly transcribe <clip.wav> [--json]     on-device speech to text, with word timings
                        [--lang=en]        (WAV only here: Node has no mp3/aac codec)
  lolly mix <state|plan.json>              a design timeline's soundtrack, mixed with no
                        [--out=mix.wav]    browser (WAV/ZzFXM sources; --normalize=-16)
  lolly upscale <image> [--scale=2|4]      on-device AI enlargement, PNG out
                        [--model=<id>] [--max-edge=N] [--out=big.png] [--models to list]
  lolly matte <image> [--out=cut.png]      on-device background removal (alpha cutout)
                        [--model=u2netp|modnet] [--max-edge=N] [--models to list]
  lolly ocr <image> [--json]               on-device text recognition; the text is stdout
                        [--single-line] [--min-confidence=0.5] [--models to list]
  lolly detect-ai "<text>" [--json]        on-device AI-text ESTIMATE, never a verdict
                        [--in=<file.txt>]  (refuses under 50 words or non-Latin script)
  lolly reword "<sentence>" [--json]       on-device rewrite, shorter and plainer, gated
                        [--style=plain] [--samples=3] [--in=<file.txt>]
  lolly depth <image> [--out=depth.png]    on-device depth map, greyscale, white nearest
                        [--max-edge=N]     (no model published yet: refuses by name)
  lolly completion bash|zsh|fish           print a shell-completion script to stdout
  lolly tui                                start the interactive terminal shell (needs a
                                           real terminal; same engine, same bytes)

Global flags (valid on every command):
  --json                   one JSON envelope on stdout instead of human text, on list,
                           describe, assets, validate, smoke, batch, preflight, models,
                           speak, transcribe, ocr, detect-ai and reword. NOT on a render:
                           there, stdout carries the exported bytes.
  --quiet                  suppress non-error stderr (progress, notes, warnings)
  --verbose                diagnostics + stack traces (DEBUG=1 is an alias)
  --strict                 promote warnings to failures (exit 2 usage, 4 gate)
  -h, --help  ·  -v, --version

Export options:
  --output=<path>          write here (\`-\` = stdout; the extension can pick the format)
  --export=<fmt>           format: svg, png, jpg, webp, pdf, emf, eps, dxf, json, csv, …
                           (jpg and jpeg are one format; either spelling works on any
                           tool, whichever one its manifest happens to declare)
  --filename=<name>        name the output file in the working directory (no --output)
  --width= --height=       size, in --unit= (px default, or mm/cm/in/pt) at --dpi= (300)
  --text=outline|live      vector text as paths or editable text. svg defaults to
                           outline; emf defaults to live (editable in Office/Slides)
  --input.<id>=<value>     set a tool input whose name collides with a reserved flag
  --html-fallback          OPT IN: if the requested format cannot be produced here, write
                           HTML under a .html name instead of failing. Off by default - 
                           without it a format that cannot be produced is an error, never
                           a different file under the name you asked for.
  --bleed=3mm --marks=crop,reg,bars        print prep (routes through the full render tier)
  --press-profile=fogra39  CMYK press condition for pdf-cmyk / cmyk-tiff. \`--profile=\`
                           is its alias, matching URL mode's reserved \`profile\` param.
  --user-profile=<f.json>  pre-fill bindToProfile inputs from a user-profile JSON file
  --rate-card=<f.json>     load + validate a printer's rate card and confirm it (a bad
                           card warns and continues; no prices are computed)
  --c2pa[=7|30|90|365]     stamp Content Credentials. ON BY DEFAULT, like the app
                           (--c2pa=off opts out; =N sets the certificate lifetime)
  --imprint                embed the Lolly pixel watermark (raster). ON BY DEFAULT
                           for the formats that can carry it (--imprint=0 opts out)
  --no-provenance          one word for a bare render: no credential, no imprint,
                           no durable mark. THE deterministic-bytes switch - both
                           marks embed a fresh timestamp, so a default render is
                           not byte-identical run to run
  --sign-key=<key.pem>     sign the credential with an enrolled identity instead of an
  --sign-cert=<chain.pem>  anonymous on-device key: a P-256 PKCS#8 key file plus its
                           certificate chain, LEAF FIRST. Both are PATHS - no flag ever
                           takes key material, because argv is visible in \`ps\`. An
                           encrypted key takes its passphrase from
                           $LOLLY_SIGN_KEY_PASSWORD, or a prompt on a terminal.
                           ($LOLLY_SIGN_KEY/$LOLLY_SIGN_CERT are the same two paths;
                           $LOLLY_SIGN_KEY_PEM/$LOLLY_SIGN_CERT_PEM carry the PEM text
                           itself, for CI secret stores with no filesystem.)
                           See /info/cli-signing.html
  --durable=1              embed the durable Content Credential (neural TrustMark).
                           Off by default (a neural encode, and a model download)
  --password=<pw>          PDF open-password (visible in \`ps\`; see --password-stdin)
  --password-stdin         read the password from stdin instead of argv
  --depth=8|16|float       requested bits per channel; --hdr=1 for the float view transform
  --fps=<n> --seconds=<s>  video clip controls (mp4/webm/gif/apng): frame rate and length;
  --wait=<s> --codec=<c>   settle time before frame one, codec h264|hevc|vp9|av1,
  --vq=smaller|balanced|best   and quality - the export panel's fields, as URL params
  --lang=<xx>              use a tool's manifest translation sidecar
  --designv=<slug|latest>  the design-system version to render against: a published
                           version's slug, or \`latest\` for the edit head. Beats a
                           tool's own pin; a slug this catalog does not ship falls
                           through to the pin, then the head, and says so either way
  --verify                 for a file utility: print a per-file line when no check failed

Link options:
  --z=<token>              a packed share link's state
  --zx=<token>             a PASSWORD-PROTECTED share link's state; needs
  --link-password=<pw>     …this. A missing or wrong password is an error, never a
                           silent render of the tool's defaults.
  --share / --link         print a shareable lolly.tools link instead of rendering

Exit codes:
  0  OK                the requested thing was produced
  1  FAILED            it was possible, it ran, it failed
  2  USAGE             wrong invocation: unknown tool/format/flag, unreadable path
  3  UNAVAILABLE_HERE  impossible in THIS installation (no browser, no capability) - 
                       the retry-on-another-runner code
  4  REFUSED           a protective check said no (--verify, format mismatch, forged
                       credential)
  5  NOT_FOUND         a legitimate negative answer (validate: no credential present)
  6  AUTH              missing or wrong password
  70 INTERNAL          unclassified exception: a bug in Lolly

Examples:
  lolly qr-code --url=https://suse.com --output=qr.svg
  lolly run qr-code --url=https://suse.com --export=png > qr.png
  lolly redact --source=./f.pdf --bars=1,40,60,200,24 --output=./out.pdf --verify
`;

const args = argv.slice(2);
// Rule 1 of section 5.3, enforced before any command runs: stdout is the payload. A tool hook
// calling console.log would otherwise write into the middle of an exported PNG.
keepConsoleOffStdout();
// A downstream reader that closes early (`lolly list | head -1`) makes the next write to
// stdout raise EPIPE. Nothing subscribed to the stream's 'error' event, so that surfaced
// as Node's raw "Unhandled 'error' event" stack trace and exit 1 - which under
// `set -o pipefail` fails the whole pipeline for an ordinary `| head`. A closed pipe is
// not a failure of this run: it ends quietly, keeping whatever exit code the work had.
// Swallowed rather than exited on, because section 0/B3 forbids process.exit() around stdout - 
// the event loop drains and the process ends with the code the work already set. Every
// other stdout error still reaches the caller through writeOut's rejected promise.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err?.code !== 'EPIPE') throw err;
});
// section 5.2 says a `--json` run puts a complete envelope on stdout on EVERY path. The parse
// below can itself throw (a bare value-flag is exit 2), and `beginCommand` had not run
// yet, so `lolly validate f.png --json --require > r.json` left a zero-byte file and an
// agent reading stdout got EOF - the exact failure the envelope was written to remove.
// A raw argv scan is enough: `--json` has one spelling and no bare-value trap. The
// command name is re-set accurately by main() once the parse succeeds; this pre-set is
// only the fallback for a failure that happens before that.
const RAW_VERBS = new Set(['prepare', 'files', 'start', 'system', 'list', 'describe', 'run', 'compile', 'schema', 'inspect', 'diff', 'measure', 'optimize', 'package', 'validate', 'preflight', 'install-browser', 'assets', 'batch', 'smoke', 'models', 'speak', 'transcribe', 'mix', 'upscale', 'matte', 'ocr', 'detect-ai', 'reword', 'depth', 'icons', 'pack', 'tui']);
const rawFirst = args.find(a => !a.startsWith('-'));
beginCommand(
  RAW_VERBS.has(rawFirst ?? '') ? rawFirst! : 'lolly',
  args.some(a => a === '--json' || /^--json=(?!0$|false$|off$|no$)/i.test(a)),
);
// The stderr writer the error printer uses, captured BEFORE --quiet can replace it: a
// quiet run still prints errors, and it must not print them into a sink.
const writeErr = process.stderr.write.bind(process.stderr);

try {
  // --help / -h / --version / -v are recognised ANYWHERE in argv, before anything treats
  // the token as a tool id (`lolly --help` used to print "Tool not found: --help").
  if (args.some(a => a === '--help' || a === '-h' || a === 'help')) {
    if (rawFirst === 'prepare') { const { prepareCli } = await import('../src/prepare.ts'); await prepareCli([], { help: '1' }); }
    else await writeOut(USAGE);
  } else if (args.some(a => a === '--version' || a === '-v')) {
    const { ENGINE_VERSION } = await import('@lolly/engine');
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    await writeOut(`lolly ${pkg.version} (engine ${ENGINE_VERSION})\n`);
  } else {
    await main();
  }
  // --strict turns this run's warnings into a failure AFTER the work is reported, so the
  // operator still sees what was wrong rather than a bare exit code.
  const promoted = strictExitCode();
  if (promoted && !process.exitCode) process.exitCode = promoted;
} catch (e) {
  const err = e as { message?: string; validationErrors?: Array<{ path: string; message: string }>; stack?: string };
  writeErr(`Error: ${err.message}\n`);
  if (err.validationErrors?.length) {
    for (const ve of err.validationErrors) writeErr(`  ${ve.path}: ${ve.message}\n`);
  }
  if (process.env.DEBUG) writeErr((err.stack as string) + '\n');
  process.exitCode = exitCodeFor(e);
  // --json covers the FAILURE path (contract section 5.2). Without this, `lolly validate
  // /nope.png --json > r.json` left a zero-byte file and an agent reading stdout got
  // EOF; now stdout carries a complete envelope on every path. `envelopeEmitted` guards
  // the case where the command already wrote its own document and then threw.
  if (jsonRequested() && !envelopeEmitted()) {
    try { await emitError(e); } catch { /* the exit code still tells the truth */ }
  }
}

async function main(): Promise<void> {
  if (args.length === 0) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      beginCommand('start', false);
      const { startCli } = await import('../src/system.ts');
      await startCli();
    } else {
      beginCommand('list', false);
      assertContentRoot();
      await listToolsCli();
    }
    return;
  }

  // ONE parse for the whole command line: `--` ends option parsing, value-taking flags
  // reject their bare form, and --trust-anchor accumulates.
  const { flags, repeated, positionals } = parseArgs(args);
  const g = globalFlags(flags);
  configureOutput({ quiet: g.quiet, strict: g.strict });
  if (g.verbose) process.env.DEBUG ??= '1';
  // --quiet means everything except errors stops writing to stderr. Enforced at the
  // stream, not per call site, because the render tiers this shell drives (raster.ts,
  // webshell-render.ts, the tools' own console) all write there too.
  if (g.quiet) process.stderr.write = (() => true) as typeof process.stderr.write;

  const cmd = positionals[0];
  // Which command this is, and whether stdout must carry the section 5.2 envelope. Recorded
  // before any work, so the top-level catch can name the command in a failure envelope
  // even when the throw happened before the command function was reached. A bare tool
  // id reports as `describe`/`run` - the verb it is sugar for - not as its own name.
  const VERBS = new Set(['prepare', 'files', 'start', 'system', 'list', 'describe', 'run', 'compile', 'schema', 'inspect', 'diff', 'measure', 'optimize', 'package', 'validate', 'preflight', 'install-browser', 'assets', 'batch', 'smoke', 'models', 'speak', 'transcribe', 'mix', 'upscale', 'matte', 'ocr', 'detect-ai', 'reword', 'depth', 'icons', 'pack', 'completion', 'tui']);
  beginCommand(VERBS.has(cmd ?? '') ? cmd! : 'run', g.json);

  // Content-free binary (plans/131): the published CLI ships no tools and no catalog.
  // A command that needs them says so here, once, with the routes to a root - instead
  // of an ENOENT on catalog/tools/index.json from somewhere deep in the render path.
  if (needsContentRoot(cmd)) assertContentRoot();

  // ── explicit verbs ────────────────────────────────────────────────────────
  // `list` / `describe` / `run` exist because the first positional is an open namespace
  // shared with tool ids: a brand pack shipping a tool called `batch` would otherwise be
  // permanently unreachable. The verbs can never be shadowed.
  if (cmd === 'files') {
    if (args.some(arg => /^--(?:to|max-edge|quality|target-bytes|background)$/.test(arg))) throw usageError('File operation options need explicit values: --to=jpeg --quality=0.92 --max-edge=1920.');
    const { filesCli } = await import('../src/files.ts');
    await filesCli(positionals.slice(1), flags, g.json);
    return;
  }

  if (cmd === 'start') {
    const { startCli } = await import('../src/system.ts');
    await startCli(g.json);
    return;
  }

  if (cmd === 'system') {
    const { systemCli } = await import('../src/system.ts');
    await systemCli(positionals.slice(1), flags, g.json);
    return;
  }

  if (cmd === 'list') {
    await listToolsCli({ json: g.json });
    return;
  }

  if (cmd === 'describe') {
    const toolId = positionals[1];
    if (!toolId) throw usageError('usage: lolly describe <tool-id>', 'MISSING_ARGUMENT');
    await showToolInputsCli(toolId, { lang: normalizeLang(flags.lang) ?? undefined, json: g.json, full: isOn(flags.all) });
    return;
  }

  if (cmd === 'run') {
    const toolId = positionals[1];
    if (!toolId) throw usageError('usage: lolly run <tool-id> [--flags]', 'MISSING_ARGUMENT');
    await render(toolId, flags, undefined, repeated);
    return;
  }

  if (cmd === 'prepare') {
    const { prepareCli } = await import('../src/prepare.ts');
    await prepareCli(positionals.slice(1), flags);
    return;
  }

  if (cmd && ['compile', 'schema', 'inspect', 'diff', 'measure', 'optimize', 'package'].includes(cmd)) {
    const { documentCli } = await import('../src/document.ts');
    await documentCli(cmd, positionals.slice(1), flags);
    return;
  }

  // ── validate ──────────────────────────────────────────────────────────────
  // N files, one record each, exit = the worst file's code (contract B9): taking the
  // first non-flag and silently ignoring the rest was wrong-answer shaped.
  if (cmd === 'validate') {
    const files = positionals.slice(1);
    if (!files.length) {
      throw usageError('usage: lolly validate <file…> [--json] [--metadata] [--deep] [--rebuild=<session.lolly>] [--require=credential|none] [--trust-anchor=<root.pem>] [--no-default-anchors]', 'MISSING_ARGUMENT');
    }
    if (isOn(flags.document)) {
      if (files.length !== 1) throw usageError('document validation takes one compiled JSON file or one tool id.', 'CONFLICTING_FLAGS');
      const { documentCli } = await import('../src/document.ts');
      await documentCli('validate', files, flags);
      return;
    }
    // `--rebuild=<session.lolly>`: the reproducibility receipt. A different question from
    // the credential check ("do these bytes still match what was signed") - it asks whether
    // the SESSION still produces them - so it takes one artifact and answers on its own.
    if (flags.rebuild) {
      if (files.length > 1) {
        throw usageError('--rebuild compares ONE artifact against one .lolly session; name a single file.', 'CONFLICTING_FLAGS');
      }
      const { rebuildCli } = await import('../src/rebuild.ts');
      process.exitCode = await rebuildCli(files[0]!, flags.rebuild, { json: g.json });
      return;
    }
    const { validateFilesCli } = await import('../src/validate.ts');
    process.exitCode = await validateFilesCli(files, {
      json: isOn(flags.json),
      deep: isOn(flags.deep),
      require: flags.require,
      metadata: isOn(flags.metadata),
      strict: g.strict,
      trustAnchors: repeated['trust-anchor'],
      // --no-default-anchors: pinned roots only (contract section 12 O1). Absent = the
      // default set (Lolly CA root + the vendored C2PA list).
      defaultAnchors: !isOn(flags['no-default-anchors']),
    });
    return;
  }

  // `preflight` is a reserved subcommand: count and check the export you were about to
  // run, WITHOUT rendering it. It takes the same render flags a real run takes (and the
  // same pasted-URL form), because preflighting settings other than the ones a render
  // would use is worthless. The engine owns the rules; this shell only collects the
  // facts. Counts and findings only - there is no rate, price or currency in it.
  if (cmd === 'preflight') {
    const rest = args.slice(args.indexOf('preflight') + 1);
    const { preflightCli } = await import('../src/preflight.ts');
    process.exitCode = await preflightCli(rest, flags);
    return;
  }

  // `install-browser`: download Chromium for the Tier-B render path (HTML-layout raster,
  // jpg/webp, pdf, video). The DOM-free formats (svg/emf/eps + data) and PNG for
  // SVG-native tools never need it. `--with-deps`/`--force` pass through.
  if (cmd === 'install-browser') {
    const { installBrowserCli } = await import('../src/install-browser.ts');
    process.exitCode = await installBrowserCli(args.slice(args.indexOf('install-browser') + 1));
    return;
  }

  // `models`: what on-device model files are staged, and the ONE command that
  // downloads any. Nothing else in this shell ever fetches a model - a missing one
  // refuses and names this command with its size (plans/183 section 0.2).
  if (cmd === 'models') {
    const { modelsCli } = await import('../src/models.ts');
    process.exitCode = await modelsCli(args.slice(args.indexOf('models') + 1), { json: g.json, yes: isOn(flags.yes) });
    return;
  }

  // The on-device ML utilities (plans/183 WS2): the discovery surface for
  // host.upscale / host.matte / host.ocr and for the three families that have no
  // bridge member (ai-detect, reword, depth). Thin wrappers over the same APIs a
  // tool hook reaches; each refuses by model name, and never downloads anything.
  if (isMlSubcommand(cmd)) {
    const rest = positionals.slice(1);
    const ml = await import('../src/ml-cli.ts');
    if (cmd === 'upscale') process.exitCode = await ml.upscaleCli(rest, flags);
    else if (cmd === 'matte') process.exitCode = await ml.matteCli(rest, flags);
    else if (cmd === 'ocr') process.exitCode = await ml.ocrCli(rest, flags, g.json);
    else if (cmd === 'detect-ai') process.exitCode = await ml.detectAiCli(rest, flags, g.json, readStdin);
    else if (cmd === 'reword') process.exitCode = await ml.rewordCli(rest, flags, g.json, readStdin);
    else process.exitCode = await ml.depthCli(rest, flags);
    return;
  }

  // `speak` / `transcribe`: the discovery surface for host.speech, on-device both
  // ways. Thin wrappers over the same API a tool hook reaches (src/speak.ts).
  if (cmd === 'speak') {
    const { speakCli, speakOptions } = await import('../src/speak.ts');
    // Piped text is accepted (`cat script.txt | lolly speak --out=x.wav`), but only
    // when stdin is a pipe: reading a terminal here would hang waiting for input
    // the caller never meant to type.
    const spoken = positionals.slice(1).join(' ')
      || (process.stdin.isTTY ? '' : (await readStdin()).toString('utf8'));
    process.exitCode = await speakCli(spoken, speakOptions(flags));
    return;
  }

  if (cmd === 'transcribe') {
    const { transcribeCli } = await import('../src/speak.ts');
    process.exitCode = await transcribeCli(positionals[1] ?? '', { json: g.json, ...(flags.lang ? { lang: flags.lang } : {}) });
    return;
  }

  // `mix`: a design timeline's soundtrack, mixed without a browser (plan 183 WS3).
  // The picture of a sequence still needs the paint tier; the sound is a closed form
  // over decoded PCM, so it comes out here (src/mix.ts).
  if (cmd === 'mix') {
    const { mixCli } = await import('../src/mix.ts');
    const target = Number.parseFloat(flags.normalize ?? '');
    process.exitCode = await mixCli(positionals[1] ?? '', {
      out: flags.out ?? flags.output, json: g.json,
      ...(Number.isFinite(target) ? { normalize: target } : {}),
      ...(flags['user-profile'] ? { userProfile: flags['user-profile'] } : {}),
    });
    return;
  }

  // `assets`: list catalog asset ids so they can be passed to any `asset`-type input
  // (the engine already resolves an id → the embedded asset).
  if (cmd === 'assets') {
    await listAssetsCli(positionals[1], { type: flags.type, json: g.json });
    return;
  }

  // `batch`: render many rows from a CSV/TSV, one output file per row into a DIRECTORY.
  // `--template=tool,tool` prints a starter grid instead.
  if (cmd === 'batch') {
    if (flags.output !== undefined) {
      // It used to accept --output, write `<out-dir>/01-….svg` anyway, and say nothing
      // (contract B13). A batch has many outputs; one path cannot name them.
      throw usageError('batch writes one file per row into a directory - use --out-dir=<dir>, not --output.', 'CONFLICTING_FLAGS');
    }
    if (flags.template !== undefined) {
      const { batchTemplateCli } = await import('../src/batch.ts');
      await batchTemplateCli((flags.template === '1' ? '' : flags.template).split(','), { json: g.json });
      return;
    }
    const csv = positionals[1];
    if (!csv) throw usageError('usage: lolly batch <rows.csv> [--out-dir=./out] [--keep-going]   (or --template=tool,tool)', 'MISSING_ARGUMENT');
    const { runBatchCli } = await import('../src/batch.ts');
    process.exitCode = await runBatchCli(csv, { outDir: flags['out-dir'] || './out', keepGoing: isOn(flags['keep-going']), json: g.json });
    return;
  }

  // `smoke`: render EVERY catalog tool at manifest defaults to its first Node-native
  // format, ✓/✗ per tool - the catalog-wide gate CI runs so a hooks.js regression can
  // never ship a tool that renders blank.
  if (cmd === 'smoke') {
    const { smokeCli } = await import('../src/smoke.ts');
    process.exitCode = await smokeCli({ only: flags.only, format: flags.format, json: g.json });
    return;
  }

  // `icons` / `pack`: build a Linux package (RPM) - the packager entry point (plans/197).
  // Offline + deterministic + rpmlint-clean: an app-icon or font package, ready to call
  // from a spec's %build or an OBS source service. Honours SOURCE_DATE_EPOCH.
  if (cmd === 'icons' || cmd === 'pack') {
    const { iconsCli, packCli } = await import('../src/pack.ts');
    const rest = positionals.slice(1);
    process.exitCode = cmd === 'icons' ? await iconsCli(rest, flags) : await packCli(rest, flags);
    return;
  }

  // `completion`: a static shell-completion script, printed to stdout so it can be
  // saved or sourced directly (`lolly completion zsh > ~/.zsh/completions/_lolly`).
  if (cmd === 'completion') {
    const shellArg = positionals[1];
    const { COMPLETION_SHELLS, generateCompletion } = await import('../src/completion.ts');
    if (!COMPLETION_SHELLS.includes(shellArg as (typeof COMPLETION_SHELLS)[number])) {
      throw usageError(`usage: lolly completion ${COMPLETION_SHELLS.join('|')}`, 'MISSING_ARGUMENT');
    }
    await writeOut(await generateCompletion(shellArg as (typeof COMPLETION_SHELLS)[number]));
    return;
  }

  // `tui`: the interactive terminal shell, from the same install (plans/202 WP1.4). It
  // runs as a child with stdio inherited, so the terminal and the exit code pass
  // through and this process still writes nothing to stdout.
  if (cmd === 'tui') {
    const { tuiCli } = await import('../src/tui.ts');
    process.exitCode = await tuiCli(args.slice(args.indexOf('tui') + 1));
    return;
  }

  // ── a pasted lolly.tools link ─────────────────────────────────────────────
  // A fully-configured tool URL: parse it into a toolId + query and run it as if the
  // query were --flags (the URL-mode-as-CLI principle). Any --flag=val after the URL
  // overrides the URL's params - "the URL as settings, then edit".
  if (/^https?:\/\//i.test(cmd ?? '')) {
    const ref = parseToolUrl(cmd!);
    if (!ref) throw usageError(`Not a recognised Lolly tool URL: ${cmd}`, 'BAD_URL');
    const urlParams = Object.fromEntries(new URLSearchParams(ref.query));
    // No `profile` remap any more: url-mode's `profile` IS the press condition and so is
    // the CLI's `--profile` (contract B1). The user-profile FILE has its own name,
    // `--user-profile`, so a share link and a flag can no longer mean different things.
    const merged: Record<string, string> = { ...urlParams, ...flags };
    note(`→ ${ref.toolId}${ref.format ? ` (${ref.format})` : ''} from URL`);
    // In URL mode `export` is a bare PRESENCE flag ("auto-download on open") - the web
    // Share dialog's default link emits `…&format=png&export`, so URLSearchParams gives
    // export=''. That empty string is NOT a format: coalesce it to undefined so the URL's
    // own `format=` param (kept in the params, read by runToolCli) or the path-segment
    // format wins. An explicit CLI `--export=svg` is non-empty and still overrides.
    const toleratedUrlKeys = new Set(Object.keys(urlParams).filter(key => !(key in flags)));
    await render(ref.toolId, merged, ref.format ?? undefined, repeated, toleratedUrlKeys);
    return;
  }

  // ── the bare-tool-id sugar ────────────────────────────────────────────────
  const toolId = cmd!;
  // No flags (or only --lang) → show the tool's input schema. `lang` is reserved (see
  // engine/src/url-mode.ts), never a tool input, so it doesn't count as "a flag was
  // given" for the describe-vs-render branch. `lolly run <id>` renders at defaults.
  // Global flags are not "a flag was given" either: `lolly qr-code --quiet` still means
  // "tell me about this tool", and `--json` on a bare tool id is the machine-readable
  // spelling of `describe`, not a render request.
  const GLOBAL = new Set(['lang', 'quiet', 'verbose', 'strict', 'json']);
  const flagKeys = Object.keys(flags).filter(k => !GLOBAL.has(k));
  if (flagKeys.length === 0) {
    beginCommand('describe', g.json);
    await showToolInputsCli(toolId, { lang: normalizeLang(flags.lang) ?? undefined, json: g.json });
    return;
  }
  await render(toolId, flags, undefined, repeated);
}

/** The one render call site: every path (verb, sugar, URL) funnels through it, so the
 *  flag→argument mapping cannot drift between them. */
async function render(
  toolId: string,
  flags: Record<string, string>,
  urlFormat?: string,
  repeated: Record<string, string[]> = {},
  toleratedUnknown: ReadonlySet<string> = new Set(),
): Promise<void> {
  if (isOn(flags.json)) {
    // `--json` on a render is deliberately absent at GA (contract section 3): run's stdout IS
    // the artefact. Accepting and ignoring the flag is the silent class this shell has
    // spent its whole life removing.
    throw usageError(
      '--json is not available on a render: stdout carries the exported bytes. It is supported on list, describe, assets, validate, smoke and batch.',
      'UNSUPPORTED_FLAG',
    );
  }
  const {
    output, export: fmt, share, link, verify, 'html-fallback': htmlFallback,
    json: _json, quiet: _quiet, verbose: _verbose, strict: _strict,
    ...params
  } = flags;
  // --password-stdin (contract B15) keeps the password out of argv, where `ps` can read
  // it. It replaces the value the rest of the pipeline reads, so nothing downstream
  // needs to know which way it arrived.
  const password = await resolvePassword(flags, readStdin);
  if (password !== undefined) params.password = password;
  delete params['password-stdin'];

  await runToolCli({
    toolId,
    params,
    repeated,
    outputPath: output,
    format: (fmt || undefined) ?? urlFormat,
    share: share !== undefined || link !== undefined,
    verify: verify !== undefined,
    htmlFallback: isOn(htmlFallback),
    text: textMode(flags.text),
    rejectUnknown: true,
    toleratedUnknown,
  });
}

// Re-exported so scripts/validate-catalog.ts can refuse a tool id that would shadow a
// subcommand, and so the contract's frozen word list has exactly one home.
export { RESERVED_SUBCOMMANDS, EXIT };
