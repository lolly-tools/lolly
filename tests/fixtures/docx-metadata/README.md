# DOCX metadata fixture

`metadata.docx` is an authentic Office Open XML package exported by LibreOffice
Writer 26.2.3.2 from the authored `metadata.fodt` source. Its visible content includes a
styled heading, a paragraph with bold text and a two-cell table. Its core and custom
properties contain synthetic private values. No property-dependent fields or bound
content controls are present.

Generate with an isolated LibreOffice user profile:

```sh
soffice -env:UserInstallation=file:///absolute/fixture-profile --headless --convert-to docx --outdir tests/fixtures/docx-metadata tests/fixtures/docx-metadata/metadata.fodt
```

`extended-properties.docx` derives from that authored Writer package. Its maintained
generator adds only `Company` and `Manager` elements to `docProps/app.xml`, with the
synthetic values `Private fixture company` and `Private fixture manager`. The original
`metadata.docx`, visible document content and all other package members stay unchanged.
LibreOffice does not supply these fields in the base export, so this seeding step is
explicit:

```sh
node tests/fixtures/docx-metadata/generate-extended.ts
```

The tests use libxml2 and JSDOM as independent XML readers, verify selected removal,
and compare every unrelated raw ZIP member with the original. Untouched property
elements are compared as source text. UTF-8/UTF-16 BOM variants and malformed inputs
are generated in memory. Template, hyperlink base, application and statistics values
are also seeded in memory from `extended-properties.docx`, so no binary fixture
carries them. The chart, drawing, embedded object and VML variants are built in
memory the same way. Application reopening and rendering evidence is recorded
in plan 228; the unit suite does not require LibreOffice.
