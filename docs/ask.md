# Ask Lolly

Ask Lolly is the in-app help view: you type a question, and it hands back the section of this documentation that answers it, word for word, with the page it came from cited beside it. Nothing is generated. The answer is retrieved, quoted and attributed, and the whole exchange happens on your device.

## What it is

One job: find the part of these guides that answers your question, and show it to you unchanged. There is no model and no summarising step - the words in an answer are the documentation's own words, the citation under them names the page and section and an **Open in docs** link goes straight there.

Under the quoted section sit the places in the app the same question matches: a tool, a utility, a saved project, a catalogue asset, a setting, a page of the app. Each is a row that only navigates. Nothing in an answer flips a setting, opens a file or acts on your behalf - the same rule [Search](/info/search.html) follows.

## Asking a question

Type into the composer at the foot of the view and press Enter. Anything shorter than two characters is ignored. Answers build up in the transcript above, newest last, and you can keep asking.

Follow-ups are answered on their own. The transcript is a record of what you asked, not a conversation that carries context forward, so "what about PDF?" after a question about exporting will be read as a question about PDF and nothing else. Ask the whole question each time.

The first word of your question decides what leads the answer:

| You start with | What leads |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *jump*, *switch* | the places in the app that match |
| *make*, *create*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | the tools that match |
| anything else - including *how do I* and *what is* | the documentation section, which is the default |

Both halves are always retrieved, so a misread question reorders an answer rather than losing half of it.

Matching drops the common question words (*how*, *do*, *I*, *the*, *my*) and ranks a section first by how many of your remaining words it covers, then by where they matched - a heading counts for more than body text. It is substring matching, folded for case and accents, not fuzzy: it will not correct a typo or guess at a word you did not type. When nothing matches, it says so and points at the documentation index rather than inventing an answer.

## What comes back

An answer card is assembled in a fixed order:

1. **The section itself**, rendered from the documentation source - paragraphs, lists, tables, code and quotes, with in-app and `/info` links live. A long section is capped with a **Show more** that opens it in place. Images are dropped, and a link out to another site renders as plain text rather than an anchor.
2. **The citation** - *Page › Heading* - and the **Open in docs** link to that exact section.
3. **More in the docs** - up to four other sections that matched, as links.
4. **The in-app rows**, under the same group headings Search uses.

The full text comes from the plain-markdown twin each documentation page publishes at `/info/<slug>.md`, and those twins are English only. In another language - and on the handful of pages not built from markdown - the answer falls back to the short extract held in the search index instead of the whole section. The citation and the **Open in docs** link are there either way, pointing at the page in your own language.

## Where it lives

The route is `#/ask`. It has no tab and no tile in the Utilities grid; the ways in are the search bar and the address itself.

- <!--i:search--> **From search.** Every result panel carries an **Ask Lolly: *your query*** row at the very bottom, under whatever concrete hits the other groups found. It hands the question over as `#/ask?q=…` and the view asks it once on arrival. The seed arrives folded by the shared tokenizer - lower case, punctuation dropped - so it will not look exactly as you typed it; the composer is where you refine it.
- <!--i:link--> **From a link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` opens the view with that question already asked. The hash is the entry seed only: questions you type afterwards are answered in place and never rewrite the address.

The shell's search bar steps aside inside this view, since the composer takes Enter, and the back pill returns you to wherever you came from.

The transcript is session memory. It survives navigating away and coming back, and a reload clears it. Nothing is written to storage, so there is no history to manage and nothing to clear.

## Offline

Answers are assembled from two static files the documentation site already publishes: the per-language search index and the page's markdown twin. Both are fetched by name, so Ask keeps working with no connection once they are cached. Reading the guides in the app caches them as you go, and **Profile → Available offline → Guides & docs** takes the whole site, screenshots included, in one download - see [Your profile](/info/profile.html#available-offline).

Without them the documentation half of an answer simply does not appear, with no error. The in-app rows still do, because those are matched against data already on the device.

## Privacy

Your question never leaves the device. Matching runs locally against files fetched by name, so what you typed is not part of any request; there is no server that sees it, no account it is attached to and no record of it after you reload. See the [Privacy Policy](/info/privacy.html) for the complete list of what the app ever fetches or sends.

---

**Related:** [Search](/info/search.html) for the bar that hands questions over. [Using Lolly](/info/using.html#ask-lolly) for how Ask works within the rest of the app. [Your profile](/info/profile.html#available-offline) for taking the documentation offline first.
