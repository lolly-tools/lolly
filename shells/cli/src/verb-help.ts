// SPDX-License-Identifier: MPL-2.0
/**
 * The `--help` of the document verbs (plan 291 M4): `lolly read`, `lolly check`,
 * `lolly package`, `lolly measure` and `lolly run <session.lolly>`. Each lists every flag
 * the verb takes (the sets in args.ts and design-session.ts), the input forms and the
 * exit codes, the way `lolly compose --help` does. tests/verb-help-cli.test.ts pins each
 * text against those flag sets, so a flag added to a verb without a line here fails.
 */

/** `lolly read --help`. */
export const READ_HELP = `lolly read: what a deck says, slide by slide, for an agent that rebuilds it.

Usage:
  lolly read <deck.pptx|deck.pdf|file.psd|-> [--media=<dir>] [--thumbnails] [--force] [--json]

Input:
  A PowerPoint deck (.pptx), a PDF or a Photoshop file (.psd) by path, or - to read the
  bytes from standard input. No catalog and no browser are needed.

Options:
  --media=<dir>    write each distinct picture once, as <sha256>.<ext>, and record its
                   path on the inventory. A file already there with the same bytes is
                   reused; one with other bytes refuses the run (exit 4)
  --thumbnails     with --media, also draw each slide there as a PNG, recorded as the
                   slide's thumbnail
  --force          replace files in --media that hold other bytes
  --json           the envelope's result is a ContentInventoryV1
                   (schemas/content-inventory-v1.schema.json). Without it, an outline:
                   each slide's text in reading order with its role, its pictures and
                   the first line of its notes

Exit codes:
  0  the deck was read
  1  the file could not be read: unreadable, encrypted or too large
  2  usage: an unknown or bare flag, no input, a file type it does not read, or
     --thumbnails without --media
  4  refused: a picture in --media holds other bytes (pass --force to replace it)
`;

/** `lolly check --help`. */
export const CHECK_HELP = `lolly check: every check for a Design document, a .lolly or an export, in one
findings list: structure, render, brand, Verify and fidelity.

Usage:
  lolly check <design.json|file.lolly|export.pdf|.pptx|.png|.jpg|.webp|.svg|->
              [--source=<deck.pptx|deck.pdf|inventory.json>] [--edits=<edits.json>]
              [--file=<tokens.json>] [--theme=<name> | --themes=<a,b|all>]
              [--browser=auto|off|require] [--page-cap=N] [--ocr] [--strict] [--json]

Input:
  A Design document (.json: a layers array, {boxes} or Design input values), a .lolly,
  or an export (.pdf, .pptx, .png, .jpg, .webp, .svg) by path; the kind comes from the
  file name. - reads a Design document (JSON) from standard input.

Options:
  --source=<deck>    the deck the document recreates (.pptx, .pdf, or the inventory
                     lolly read --json wrote): the fidelity family checks that its
                     text and notes are carried over
  --edits=<file>     wording changed on purpose (needs --source): those fidelity
                     findings stay, marked excepted
  --file=<tokens.json>
                     the design system the brand family checks against, and the one
                     the render family's page resolves linked colours in. Default: as
                     lolly system context (the terminal system, else the content
                     profile's)
  --theme=<name>     check in one theme the design system declares
  --themes=<a,b|all> check in each of these themes: linked colours resolve per theme,
                     and each brand, render and Verify finding says which
  --browser=auto|off|require
                     the render family opens the document in the web shell. auto uses
                     it when it is there, off skips it, require exits 3 without it
  --page-cap=N       artboards or pages Verify reads, 1 to 100 (default 100)
  --ocr              let Verify read the text in pictures with the cached OCR model
  --strict           Verify clues are errors, and any warning refuses
  --json             the envelope's result is a CheckReportV1
                     (schemas/check-report-v1.schema.json); without it, one line per
                     family and one per finding

Exit codes:
  0  clean
  1  a family crashed, or an export had no page that could be decoded
  2  usage: an unknown or bare flag, or a --theme the design system does not declare
  3  --browser=require on a document with no browser tier here
  4  an error finding, or any warning under --strict
  5  warnings to review (the full report, ok false)
`;

/** `lolly package --help`. */
export const PACKAGE_HELP = `lolly package: a Design document as a .lolly the app reopens as the same
document, pictures and name included.

Usage:
  lolly package <design.json|-> --output=<file.lolly> [--asset=KEY=PATH]...
                [--asset-dir=<dir>] [--source=<deck.pptx|deck.pdf|deck.psd|file.lolly>]
                [--label=<name>] [--theme=<name>] [--file=<tokens.json>]
                [--force] [--allow-missing-media] [--json]
  lolly package <document.json> [--output=<file>]
                a compiled document (lolly compile <tool>) as the zip it has always been

Input:
  A Design document by path (a layers array, {boxes}, Design input values or a saved
  session), or - for one on standard input. Authoring keys ($in, $style, $stack and
  the rest) and colour references are lowered first.

Options:
  --output=<file.lolly>
                     where the package is written
  --asset=KEY=PATH   carry the picture at PATH for every layer whose image is KEY: a
                     placeholder such as photo:title, a relative path, or an upload
                     ref user/media/<sha256>, whose file must hash to that ref.
                     Repeat it, once per picture
  --asset-dir=<dir>  resolve upload refs from this folder (the one lolly read --media
                     writes)
  --source=<deck>    resolve upload refs and photo:<sha12> placeholders from the deck
                     itself
  --label=<name>     the name the app shows for the document
  --theme=<name>     the theme authored text styles and colour references resolve in
  --file=<tokens.json>
                     the design system they resolve in. Default: as lolly system
                     context (the terminal system, else the content profile's).
                     The .lolly does not carry that system, and the app opens the
                     file in its own active one, so a --file or terminal system
                     adds a design-system.not-carried note; pass the same --file to
                     lolly check and lolly run
  --force            replace an output that exists
  --allow-missing-media
                     write a picture with no bytes as a reference and say so, instead
                     of refusing
  --json             the envelope's result is a DesignPackageReportV1
                     (schemas/design-package-v1.schema.json)

Exit codes:
  0  written
  1  the file did not read back as written
  2  usage: an unknown or bare flag, a missing file, an asset argument with no key
  4  refused: a picture with no bytes, a file that is not a picture, a hash that does
     not match, a path that will not decode, an authoring key the expansion refuses, or
     an output that exists without --force
`;

/** `lolly measure --help`. */
export const MEASURE_HELP = `lolly measure: where a Design text layer's lines break and how tall it is, before
anything is drawn.

Usage:
  lolly measure --text=<string|-> --width=<px> [--height=<px>]
                [--font=sans|display|mono|<family>] [--weight=100..900] [--size=<px>]
                [--line-height=<n>] [--pad=<px>] [--tracking=<px>] [--italic]
                [--valign=top|middle|bottom] [--style=<id> [--artboard-width=<px>]]
                [--file=<tokens.json>] [--theme=<name>] [--json]
  lolly measure <design.json|file.lolly|-> --text-layers [--layer=<id>]...
                [--file=<tokens.json>] [--theme=<name>] [--json]
  lolly measure <document.json>
                a compiled document (lolly compile <tool>), inspected without
                rasterising, as lolly inspect does

Input:
  --text takes the layer's text, or - to read it from standard input so newlines and
  markup survive the shell. --text-layers takes a Design document (a layers array,
  {boxes}, Design input values or a .lolly) by path, or - for JSON on standard input.

Options:
  --text=<string|->  the text of one layer
  --width=<px>       the text box width (required with --text)
  --height=<px>      the text box height; the verdict says whether the text clips
  --font=<face>      sans, display, mono or a family name
  --weight=<n>       a CSS weight, 100 to 900 (default 700)
  --size=<px>        the font size (default 48)
  --line-height=<n>  the line height as a multiple of the size (default 1.12)
  --pad=<px>         the padding inside the box (default 8)
  --tracking=<px>    letter spacing
  --italic           set every run in emphasis, as an italic style writes *...*
  --valign=top|middle|bottom
                     where the text sits in the box (default middle)
  --style=<id>       set the layer up as an authored row with that text style
                     (title, subtitle, body, caption, label, quote, number,
                     attribution); flags given here win over the style
  --artboard-width=<px>
                     the artboard width a style's size scales with (default 1920)
  --text-layers      measure every plain text layer of the document
  --layer=<id>       with --text-layers, only this layer. Repeat it for more
  --file=<tokens.json>
                     the design system the faces and styles come from. Default: as
                     lolly system context (the terminal system, else the content
                     profile's), else the platform faces
  --theme=<name>     the theme the design system resolves in
  --json             the envelope's result is a TextMeasureV1
                     (schemas/text-measure-v1.schema.json), or for a document
                     { layers, skipped }

Exit codes:
  0  measured; a clipped verdict is data, not a failure
  1  the document could not be read
  2  usage: an unknown or bare flag, a missing --width, a value out of range, or no
     Design document
  4  refused: an authoring key the expansion refuses
`;

/** `lolly run <session.lolly> --help`. */
export const SESSION_RUN_HELP = `lolly run <session.lolly>: export a saved Design session with the app's own
exporter. The file is opened in the web shell, as a person's browser opens it, and the
download it produces is written.

Usage:
  lolly run <session.lolly> [--export=pptx|pdf|png|svg|jpg|jpeg|webp] [--output=<file>]
            [--s=<frame id or position>] [--c2pa=on|off] [--imprint=0|1] [--no-provenance]
            [--theme=<name> | --_themes=<json> | --themes=<a,b|all>]
            [--file=<tokens.json>] [--force]

Input:
  A .lolly saved from the Design tool or written by lolly package. A reusable tool
  .lolly takes lolly run <tool.lolly> --trust-tool instead.

Options:
  --export=<format>  pptx, pdf, png, svg, jpg, jpeg or webp (default png)
  --output=<file>    where the file is written. Default: standard output. Its folder
                     must exist: a missing one is refused before a browser starts
  --s=<frame>        one frame, by id or 1-based position. A one-image format from a
                     deck of several frames takes the first and says so
  --c2pa=on|off      Content Credentials on or off (default: the app's own)
  --imprint=0|1      the pixel Imprint on or off (default: the app's own)
  --no-provenance    both of those off
  --theme=<name>     export once, in this theme the design system declares, to
                     --output as given
  --_themes=<json>   the same as a choice per token group, such as {"":"dark"}
  --themes=<a,b|all> export once per theme, each to <stem>-<theme>.<ext> beside
                     --output (needs --output)
  --file=<tokens.json>
                     the design system the page resolves linked colours in, and whose
                     themes --theme and --themes name. Default: as lolly system context
                     (the terminal system, else the content profile's)
  --force            accepted, as on compose and package. run always replaces an
                     existing output

Exit codes:
  0  written
  1  the export failed
  2  usage: an unknown or bare flag, a format it does not export, a --s that names no
     frame, a theme the design system does not declare, --themes without --output,
     or an --output whose folder does not exist
  3  no browser tier here (install one with lolly install-browser)
`;

/**
 * The verb help for an argv that asks for help, or null for the global usage. `run`
 * has its own help only on a saved session file (`lolly run deck.lolly --help`).
 */
export function verbHelp(args: readonly string[]): string | null {
  const positionals = args.filter((a) => !a.startsWith('-') && a !== 'help');
  const verb = positionals[0];
  if (verb === 'read') return READ_HELP;
  if (verb === 'check') return CHECK_HELP;
  if (verb === 'package') return PACKAGE_HELP;
  if (verb === 'measure') return MEASURE_HELP;
  if (verb === 'run' && /\.lolly$/i.test(positionals[1] ?? '')) return SESSION_RUN_HELP;
  return null;
}
