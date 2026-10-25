# Ask Lolly

Mag-type ng tanong at sasagutin ito ng Ask Lolly gamit ang seksyon ng mga gabay na ito na sumasaklaw dito, salita por salita, na may binanggit na page na pinanggalingan at **Open in docs** link diretso sa seksyong iyon. Walang binubuo: kinukuha, sinisipi at binabanggit ang pinagmulan ng sagot, sa device mo.

Sa ilalim ng sinipi na seksyon ang mga lugar sa app na tugma sa parehong tanong: tool, utility, naka-save na project, catalogue asset, setting o page ng app. Ang bawat row ay nagna-navigate lang. Walang sagot na nagbabago ng setting, nagbubukas ng file o kumikilos para sa iyo, ang parehong rule na sinusunod ng [Search](/info/search.html).

## Pagtatanong

Mag-type sa question field sa paanan ng view at pindutin ang Enter. Ang anumang mas maikli sa dalawang character ay binabalewala. Nagpapatong-patong ang mga sagot sa itaas ng field, ang pinakabago ang huli, at maaari kang magpatuloy sa pagtatanong.

![Ask Lolly, bukas at walang laman: ang question field sa paanan ng view, na may tala na galing sa docs ang mga sagot](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Sinasagot nang mag-isa ang bawat tanong: ang mga naunang tanong ay walang dalang konteksto, kaya ang "what about PDF?" pagkatapos ng tanong tungkol sa pag-export ay binabasa bilang tanong tungkol sa PDF at wala nang iba. Itanong ang buong tanong sa bawat pagkakataon.

Ang unang salita ng tanong mo ang nagpapasya kung ano ang nangunguna sa sagot:

| Nagsisimula ka sa | Ang nangunguna |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | ang mga lugar sa app na tugma |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | ang mga tool na tugma |
| anupaman - kasama ang *how do I* at *what is* | ang seksyon ng dokumentasyon, na siyang default |

Laging kinukuha ang dalawang kalahati, kaya ang maling basa sa tanong ay nagpapalit ng ayos ng sagot sa halip na mawalan ng kalahati ng sagot.

Tinatanggal ng pagtutugma ang mga karaniwang salita ng tanong (*how*, *do*, *I*, *the*, *my*) at niraranggo ang seksyon ayon sa dami ng natitirang salita mo na sakop nito, saka ayon sa kung saan nagtugma: mas mahalaga ang heading kaysa body text. Substring ang pagtutugma, tinitiklop para sa case at accent, kaya hindi itinatama ang typo. Kapag walang tumugma, sinasabi ito ng Ask at itinuturo ka sa index ng dokumentasyon sa halip na mag-imbento ng sagot.

Opsyonal ang **Better matching**. Pagkatapos ng unang sagot mo, maaaring mag-alok ang Ask ng maliit na matching model, kasama ang laki ng download nito, na tumutulong itugma ang tanong sa gabay na gumagamit ng ibang salita para sa parehong bagay. Nagda-download lang ito kapag pumayag ka, tumatakbo sa device na ito at binabago lang kung aling mga seksyon ang nangunguna: ang sagot ay mga salita pa rin ng dokumentasyon. Puwede mo rin itong i-download mula sa **Settings → Preferences → Available offline**, kung saan nakalista ito bilang **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Ang bumabalik

Binubuo ang answer card sa nakatakdang pagkakasunod-sunod:

1. **Ang seksyon mismo**, nire-render mula sa pinagmulan ng dokumentasyon - mga talata, listahan, table, code at quote, na buhay ang in-app at `/info` link. Ang mahabang seksyon ay may takdang haba na may **Show more** na nagbubukas nito sa mismong lugar. Inaalis ang mga larawan, at ang link palabas sa ibang site ay nire-render bilang payak na text sa halip na anchor.
2. **Ang citation** - *Page › Heading* - at ang **Open in docs** link sa eksaktong seksyong iyon.
3. **More in the docs** - hanggang apat na ibang seksyong tumugma, bilang mga link.
4. **Ang mga in-app row**, sa ilalim ng parehong group heading na ginagamit ng Search.

Ang buong text ay galing sa plain-markdown twin na inilalathala ng bawat page ng dokumentasyon sa `/info/<slug>.md`, at English lang ang mga twin na iyon. Sa ibang wika - at sa iilang page na hindi binuo mula sa markdown - bumabalik ang sagot sa maikling extract na hawak sa search index sa halip na sa buong seksyon. Nandoon ang citation at ang **Open in docs** link sa alinmang kaso, na tumuturo sa page sa sarili mong wika.

## Kung saan ito nakatira

Ang route ay `#/ask`. Wala itong tab at walang tile sa Utilities grid; ang mga daan papasok ay ang search bar at ang mismong address.

- <!--i:search--> **Mula sa search.** Ang bawat result panel ay may row na **Ask Lolly: *your query*** sa pinakailalim, sa ilalim ng anumang konkretong hit na natagpuan ng ibang grupo. Ipinapasa nito ang tanong bilang `#/ask?q=…`, at tinatanong ng view ang tanong nang minsan pagdating. Dumarating ang ipinasang mga salita sa maliliit na letra na walang bantas, kaya pinuhin ang mga ito sa question field kung kailangan.
- <!--i:link--> **Mula sa link.** Ang `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` ay nagbubukas ng view na may tanong na iyon na naitanong na. Ang hash ay panimulang binhi lang: ang mga tanong na tina-type mo pagkatapos ay sinasagot sa mismong lugar at hindi kailanman binabago ang address.

Tumatabi ang search bar sa loob ng view na ito, dahil kinukuha ng question field ang Enter, at ibinabalik ka ng back pill kung saan ka nanggaling.

Tumatagal ang mga sagot sa screen para sa session na ito: nandoon pa rin ang mga ito kung aalis ka at babalik, at nililinis ng reload ang mga ito. Walang isinusulat sa storage, kaya walang history na pamamahalaan.

## Offline

Binubuo ang mga sagot mula sa dalawang static na file na inilalathala na ng documentation site: ang per-language search index at ang markdown twin ng page. Parehong kinukuha ayon sa pangalan, kaya patuloy na gumagana ang Ask nang walang koneksyon kapag na-cache na ang mga ito. Ang pagbabasa ng mga gabay sa app ay nagka-cache sa mga ito habang nagbabasa ka, at ang **Guides & docs** sa ilalim ng [Available offline](/info/dashboard.html#available-offline) ay kinukuha ang buong site, kasama ang mga screenshot, sa isang download.

Kung wala ang mga ito, ang kalahati ng sagot na mula sa dokumentasyon ay hindi lang lumalabas, nang walang error. Lumalabas pa rin ang mga in-app row, dahil itinutugma ang mga iyon sa data na nasa device na.

## Privacy

Hindi kailanman lumalabas sa device ang tanong mo. Lokal na tumatakbo ang pagtutugma laban sa mga file na kinuha ayon sa pangalan, kaya ang tinype mo ay hindi bahagi ng anumang request; walang server na nakakakita nito, walang account na nakakabit dito at walang talaan nito pagkatapos mong mag-reload. Tingnan ang [Privacy Policy](/info/privacy.html) para sa kumpletong listahan ng lahat ng kinukuha o ipinapadala ng app.

---

**Kaugnay:** [Search](/info/search.html) para sa bar na nagpapasa ng mga tanong. [Paggamit ng Lolly](/info/using.html) para sa natitirang bahagi ng app. [Settings](/info/dashboard.html#available-offline) para dalhin muna offline ang dokumentasyon.
