# Ask Lolly

Ask Lolly answers a question with the matching section of these guides, quoted word for word, with its page cited and an **Open in docs** link to that section. Nothing is generated: the answer is found and quoted on your device.

Under the quoted section are the places in the app that match the question: a tool, a utility, a saved project, a catalogue asset, a setting or a page of the app. Each row only navigates. Nothing in an answer changes a setting, opens a file or acts for you, the same rule as [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Asking a question

Type into the question field at the foot of the view and press Enter. Anything shorter than two characters is ignored. Answers stack above the field, newest last.

![Ask Lolly, open and empty: the question field at the foot of the view, with the note that answers come from the docs](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Each question stands alone
Earlier questions carry no context forward, so "what about PDF?" after a question about exporting is read as a question about PDF only. Ask the whole question each time.
:::

The first word of your question decides what leads the answer:

| You start with | What leads |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | the places in the app that match |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | the tools that match |
| anything else - including *how do I* and *what is* | the documentation section, which is the default |

Both halves are always retrieved, so a misread question only reorders the answer.

Matching drops common question words (*how*, *do*, *I*, *the*, *my*). It ranks a section by how many of your other words it covers, then by where they matched: a heading counts for more than body text. Matching is by substring, ignoring case and accents, so a typo is not corrected. When nothing matches, Ask says so and points at the documentation index.

**Better matching** is optional. After your first answer, Ask can offer a small matching model, with its download size. The model matches a question to a guide that uses different words for the same thing. It downloads only when you agree, runs on this device and changes only which sections rank first. The answer is still the documentation's own words. You can also download it as **Ask matching model** under **Settings → Preferences → Available offline** ([Available offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## What comes back

An answer card has a fixed order:

1. **The section itself**, rendered from the documentation source: paragraphs, lists, tables, code and quotes, with in-app and `/info` links live. A long section ends in **Show more**, which opens the rest in place. Images are dropped, and a link to another site shows as plain text.
2. **The citation** - *Page › Heading* - and the **Open in docs** link to that exact section.
3. **More in the docs** - up to four other sections that matched, as links.
4. **The in-app rows**, under the same group headings Search uses.

The full text comes from the markdown twin each documentation page publishes at `/info/<slug>.md`. Those twins are English only. In another language, and on the few pages not built from markdown, the answer shows the short extract from the search index instead. The citation and the **Open in docs** link still point at the page in your language.

<!--i:eti-map-pin-->
## Where it lives

The route is `#/ask`. It has no tab and no tile in the Utilities grid. You reach the view from the search bar or by its address.

- <!--i:search--> **From search.** Every result panel ends with an **Ask Lolly: *your query*** row, under the other groups' results. The row opens `#/ask?q=…`, and the view asks the question once on arrival. The words arrive in lower case without punctuation, so refine them in the question field if you need to.
- <!--i:link--> **From a link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` opens the view with that question already asked. The hash only seeds the first question. Questions you type afterwards are answered in place and never change the address.

The search bar hides in this view because the question field takes Enter. The back pill returns you to where you came from.

Answers stay for this session: they are still there if you leave and come back, and a reload clears them. Nothing is written to storage, so there is no history to manage.

<!--i:eti-download-->
## Offline

Answers come from two static files the documentation site publishes: the per-language search index and the page's markdown twin. Both are fetched by name, so Ask works with no connection once they are cached. Reading the guides in the app caches them. **Guides & docs** under [Available offline](/info/dashboard.html#available-offline) takes the whole site, screenshots included, in one download.

Without these files the documentation half of an answer does not appear, and no error shows. The in-app rows still appear, because they match against data already on the device.

<!--i:eti-lock-->
## Privacy

Your question never leaves the device. Matching runs locally against files fetched by name, so what you typed is not part of any request. No server sees your question, no account has it and no record remains after you reload. The [Privacy Policy](/info/privacy.html) lists everything the app fetches or sends.

---

**Related:** [Lolly Search](/info/search.html) for the bar that hands questions over. [Using Lolly](/info/using.html) for the rest of the app. [Lolly Settings](/info/dashboard.html#available-offline) for taking the documentation offline first.
