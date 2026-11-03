# Plural strings: notes for the generation prompt

Read this with `docs/contributing-setup.md` (Write plural strings). It applies to the spa corpus keys that come from `tn()` and `tnRaw()` call sites. `node scripts/plural-work.ts` lists them.

## Shape of the work

- The catalog key is the English `other` form, for example `{n} files`.
- The English `one` form (`1 file`) is context only. Do not translate it as a separate key.
- Write the value as a JSON object whose keys are exactly the categories listed for that language in the work file, from `Intl.PluralRules`. Not fewer, not more.

```json
"{n} files": { "one": "...", "few": "...", "many": "...", "other": "..." }
```

## Rules for each language

1. Write every category as a complete, grammatical phrase for the numbers that fall in it. Take the numbers from the work file's `locales.<lang>.examples`, or compute them with `new Intl.PluralRules(lang).select(n)`. In Russian `one` covers 1, 21, 31 and `few` covers 2 to 4, 22 to 24. In Arabic `zero` is 0, `two` is 2, `few` is 3 to 10, `many` is 11 to 99. In Polish `many` covers 5 to 21 and also 25 to 31.
2. Keep every `{placeholder}` the English key has, with the same spelling. A form for a category that selects only the number 1 (Arabic `one`, Welsh `two`, a language whose `one` is exactly 1) may say the number in words and drop `{n}`.
3. `other` is also the form for fractions in languages such as Russian and Polish, so write it as the form that agrees with a decimal count ("2,5 файла").
4. Languages with a single category (Chinese, Japanese, Korean, Vietnamese, Indonesian, Malay) get `{"other": "..."}`. Write the measure word where the language needs one.
5. Spanish, French, Italian and Portuguese list `many` (CLDR uses it for large round numbers such as 1 000 000). Give it the same noun form as `other`, with "de" where the language needs it ("1 000 000 de archivos").
6. Keep any trailing ellipsis, any markup and the glossary's never-translate terms exactly as in English.
7. Keep the length close to the English. A short count label should still fit the button or chip it sits in.
8. Use the language's own number words only for the categories that name a specific number (`zero`, `two`).
9. The existing single translation is in the work file under `existing.other`. Reuse its vocabulary so a key keeps one term for each thing, and correct its agreement for the categories it got wrong.

## After the pass

- Write the objects into `scripts/i18n/overrides/spa.<lang>.json` (the human layer, which wins over the cache and survives a regenerate) and into `shells/web/src/locales/<lang>.json`, under the `other` key. Leave the old plain `one` key in place until every language has an object, then drop it and the companion emission in `extractSpaKeys`.
- Run `node --test shells/web/src/locales.test.ts tests/plural-strings.test.ts`. The shape check and the placeholder-name check read the objects.
- A key whose `forms` is still `null` after the pass is a gap. The language keeps its single translation for that key, which is the pre-plural behaviour.

## What the pipeline does not do

`scripts/translate.ts` produces plain strings from the cache. It carries an override object through unchanged, but it never writes one itself. Do not run its translate path over plural keys expecting forms: the cache holds a single string per key, and the catalog regenerates from the cache and the overrides.
