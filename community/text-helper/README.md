# Text

The permanent ID is `text-helper`. The visible utility is **Text**.

The manifest declares the document, operation/options, source, syntax language, current workspace mode and recent character choices. Hooks call `host.textTools`; operations work through the same engine service in web, desktop and CLI. The web shell progressively enhances `data-text-workspace` with the editor and character browser. The two starting tabs are Characters & emoji and Write & edit. Find an action shows popular and context-aware suggestions, with labelled icons and Edit, Inspect, Convert and Create filters. Search matches task words as well as operation names.

Shared parts include the code editor, character grid, emoji picker, modal and menu components, virtual data grid, comparison results, automatic history, catalog picker and uploads, document downloads, Verify's text observations and the local reword model. There is no second persistence or syntax-highlighting library inside this tool.

Operations act on the selection, or the complete document when there is no selection. Simple edits apply as one undoable change. Other results can be reviewed alongside the source on desktop, or in result tabs on phones. They can be copied, inserted, saved or downloaded. Option dialogs retain settings and show errors in place; ASCII art has a phrase field and live preview. Logs open directly into searchable events with level filters and original event details. Code and ASCII output retain whitespace. Catalog and project handoffs retain source identity; source updates compare the current fingerprint before writing. Save changes is the primary choice for writable sources; conflicts keep the dialog open with Save a copy available. Shipped assets can be saved as copies. Opening another document clears the editor undo history; the shared automatic history preserves drafts.

## Limits

- Open UTF-8 text up to 4 MiB; binary files and other encodings are refused. Highlighting covers the first 80,000 characters; remaining text is still displayed and preserved.
- Expensive actions run in disposable workers with a ten-second limit. Regular expressions use JavaScript syntax, with at most 10,000 reported matches.
- Log analysis is of supplied text, not a live journal reader. Unknown lines remain available. Log events are bounded at 50,000.
- JSON Schema uses Ajv's draft-07 support without remote schema loading or format assertions. XML/XSD uses libxml2-wasm in the shell with network, DTDs and external schema dependencies refused. XML is limited to 1 MiB and schemas to 256 KiB.
- JSON/YAML/TOML conversions refuse unsupported nulls, cycles and unsafe numeric conversions. Comments and formatting can change. Helm inspection is static and does not execute templates.
- AI actions accept up to 16,000 characters in bounded sections. Synopsis selects source excerpts with a constrained model choice; generated rewrites pass the existing detail-preservation gate. Excerpts can omit context, and a passed rewrite still needs a meaning check. Cancel terminates the request's model worker.
- ASCII lettering uses an original small bitmap alphabet. Unsupported characters are reported rather than dropped. The font changes display, not copied bytes.
- JWT inspection decodes header and payload; it does not verify a signature. HTML unescape handles numeric references and the common amp/lt/gt/quot/apos/nbsp names, and reports that limit.

## References and reuse

Dev Toolbox, GNOME Characters and GNOME Logs informed grouping, browsing and log detail interactions. The inspected Dev Toolbox revision is GPL-3.0-or-later, not MIT; no source from those apps was copied. Unicode character names use Unicode 17 data with its license in the web shell. Parsing and formatting dependencies are declared in the engine or shell package and the workspace lockfile.

QR codes, image tools, signing/key management, system permissions and compression utilities are outside this utility. The existing QR utility owns that workflow.
