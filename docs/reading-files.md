# How Lolly Reads Files

Someone sends you a PDF, a slide deck, a photo or a font, and you open it in Lolly. This page explains what happens to that file, what Lolly checks before it reads a single structure inside, and what you see when the file is damaged or built to cause trouble. For the full list of parsers and their limits, see [Parser Inventory](/info/parser-inventory.html).

## What a parser does

A file is a sequence of bytes. To show you a picture, the words on a slide or the colours in a profile, Lolly has to turn those bytes into structure, and the code that does this is a parser. In the Lolly apps, every parser runs on your device, so opening a file does not upload it anywhere.

A file from someone else can be damaged, or made on purpose to cause trouble. It can claim to be far larger than it is, nest one part inside another thousands of times, or state a length that runs past its own end. A careless parser that believes those claims can hang, run out of memory or read the wrong bytes.

So each parser checks limits before it reads. A limit is usually a named constant in the code, such as the largest part it will read, the deepest nesting it will follow or the most records it will count. Where a limit is set by the structure of the format rather than by a number, the module's header says so. [Parser Inventory](/info/parser-inventory.html) lists each parser's limits.

::: figure reading-files-sources
Four kinds of untrusted input reach a parser. Each parser checks its named limits before reading, then answers in one of three ways.
:::

## The rules each parser is held to

- <!--i:hash--> **Limits first.** Every length, count and depth a file declares is checked before the parser acts on the value. A length is checked before the bytes it describes are read, because reading past the end of a buffer gives an empty value that quietly breaks the next check.
- <!--i:document--> **One stated contract.** Each parser says in its header how it answers a bad file, and keeps to that answer everywhere. There are three, below.
- <!--i:checklist--> **A fuzz target, and tests.** Every registered parser has a fuzz target: a harness that mutates real files, hundreds of times on every test run and thousands more in a weekly run, and fails on runaway recursion, a hang or a runaway allocation. Most also have a test file of their own that feeds them truncated, garbled and oversized input by hand. The weekly run keeps any input that breaks a parser, and once that input joins the saved set it is replayed on every test run.
- <!--i:check--> **A list that cannot drift.** [Parser Inventory](/info/parser-inventory.html) is generated from a register, and CI fails when a listed parser loses its fuzz target or the register and the code disagree.

## Three ways a parser can answer

The right answer to a bad file depends on what the caller does with the result.

| Contract | What you see | Why it is the right answer there | Examples |
|---|---|---|---|
| **Read what it can, never throw** | The parts that were readable, or a note that the file could not be read | A failed read means "we could not read this", and the app can carry on without it | `png-unfilter.ts`, `icc.ts`, `file-metadata.ts`, `pptx-read.ts` |
| **Stop at once on malformed input** | A clear error | A silent misreading would be worse than an error, as for anything that feeds a cryptographic check | `der-read.ts`, the CBOR decoder in `c2pa-extract.ts` |
| **Refuse rather than pass the file through** | The tool refuses the file | Handing back the original unchanged would look like a safety guarantee, so a privacy or security control must never fail open | `strip-metadata.ts` |

## What this means when you open a file

- A damaged or oversized file is cut off at a named limit. You get what could be read, or a message, and the app keeps running.
- **Verify** reports a credential it cannot read as an error, rather than guess at its signature or certificate.
- **Strip Hidden Data** refuses a file it cannot clean safely, rather than hand back the original as if it were clean.
- Office files are inspected without running their macros, and their external references are never fetched. [Privacy Policy](/info/privacy.html#utilities-that-run-on-your-device) lists what the Office inspection covers.
- The parsers decide how a file is read. What a *tool* does with the result is a separate question, covered by [Threat Model & Trust Boundaries](/info/threat-model.html).

## Limits of this evidence

Fuzzing shows that no crash or hang turned up within the runs so far. It does not prove that a parser reads every file correctly, or that every state inside it has been reached.

A few modules that read untrusted input are not yet in the register, and the inventory lists them by name under [Limits of this evidence](/info/parser-inventory.html#limits-of-this-evidence). The web app also caps upload sizes and unpacks archives before a parser sees a part; those gates live in the app rather than in the parsers.

To add a parser, follow [Adding a new parser](/info/parser-inventory.html#adding-a-new-parser) on the inventory page.
