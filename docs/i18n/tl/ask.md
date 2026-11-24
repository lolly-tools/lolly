# Ask Lolly

Sinasagot ng Ask Lolly ang tanong gamit ang katugmang seksyon ng mga gabay na ito, sinisipi nang salita por salita, na may sanggunian sa page nito at **Open in docs** link papunta sa seksyong iyon. Walang binubuong bago: hinahanap at sinisipi ang sagot sa device mo.

Sa ilalim ng siniping seksyon ay ang mga lugar sa app na tumutugma sa tanong: tool, utility, naka-save na project, asset sa catalog, setting o page ng app. Pang-navigate lang ang bawat row. Walang anumang nasa sagot na nagbabago ng setting, nagbubukas ng file o kumikilos para sa iyo, ang parehong patakaran ng [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Pagtatanong

Mag-type sa question field sa ibaba ng view at pindutin ang Enter. Binabalewala ang anumang mas maikli sa dalawang character. Nagkakapatong ang mga sagot sa itaas ng field, pinakahuli ang pinakabago.

![Ask Lolly, bukas at walang laman: ang question field sa ibaba ng view, na may talang galing sa docs ang mga sagot](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Hiwalay ang bawat tanong
Walang kontekstong ipinapasa ang mga naunang tanong, kaya ang "paano naman ang PDF?" pagkatapos ng tanong tungkol sa pag-export ay binabasa bilang tanong tungkol lang sa PDF. Itanong ang buong tanong sa bawat pagkakataon.
:::

Ang unang salita ng tanong mo ang nagpapasya kung ano ang mauuna sa sagot:

| Nagsisimula ka sa | Ano ang mauuna |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | mga lugar sa app na tumutugma |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | mga tool na tumutugma |
| anupamang iba - kasama ang *how do I* at *what is* | ang seksyon ng dokumentasyon, na siyang default |

Laging kinukuha ang parehong bahagi, kaya binabago lang ng maling pagbasa sa tanong ang pagkakasunod ng sagot.

Inaalis sa pagtutugma ang mga karaniwang salita sa tanong (*how*, *do*, *I*, *the*, *my*). Niraranggo nito ang seksyon ayon sa dami ng iba mo pang salitang saklaw nito, saka ayon sa kung saan tumugma ang mga ito: mas mabigat ang heading kaysa sa text ng katawan. Batay sa substring ang pagtutugma, na binabalewala ang laki ng titik at mga tuldik, kaya hindi itinatama ang typo. Kapag walang tumugma, sinasabi iyon ng Ask at itinuturo ang index ng dokumentasyon.

**Better matching**: opsyonal ito. Pagkatapos ng unang sagot mo, puwedeng mag-alok ang Ask ng maliit na modelo para sa pagtutugma, kasama ang laki ng download nito. Itinutugma ng modelo ang tanong sa gabay na gumagamit ng ibang salita para sa parehong bagay. Nada-download lang ito kapag pumayag ka, tumatakbo sa device na ito at binabago lang kung aling mga seksyon ang unang niraranggo. Mga salita pa rin ng dokumentasyon mismo ang sagot. Puwede mo rin itong i-download bilang **Ask matching model** sa ilalim ng **Settings → Preferences → Available offline** ([Available offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Ano ang ibinabalik

May nakatakdang pagkakasunod ang answer card:

1. **Ang mismong seksyon**, na ni-render mula sa source ng dokumentasyon: mga talata, listahan, talahanayan, code at sipi, na gumagana ang mga link sa loob ng app at `/info`. Nagtatapos ang mahabang seksyon sa **Show more**, na nagbubukas ng natitira sa parehong lugar. Inaalis ang mga larawan, at ipinapakita bilang plain text ang link sa ibang site.
2. **Ang sanggunian** - *Page › Heading* - at ang **Open in docs** link sa eksaktong seksyong iyon.
3. **More in the docs** - hanggang apat pang seksyong tumugma, bilang mga link.
4. **Ang mga row sa loob ng app**, sa ilalim ng parehong mga heading ng grupo na ginagamit ng Search.

Galing ang buong text sa markdown na katumbas na inilalathala ng bawat page ng dokumentasyon sa `/info/<slug>.md`. English lang ang mga katumbas na iyon. Sa ibang wika, at sa iilang page na hindi binuo mula sa markdown, ipinapakita ng sagot ang maikling sipi mula sa search index sa halip. Tumuturo pa rin ang sanggunian at ang **Open in docs** link sa page sa wika mo.

<!--i:eti-map-pin-->
## Saan ito makikita

Ang route ay `#/ask`. Wala itong tab at walang tile sa Utilities grid. Naaabot mo ang view mula sa search bar o sa address nito.

- <!--i:search--> **Mula sa search.** Nagtatapos ang bawat result panel sa **Ask Lolly: *tanong mo*** na row, sa ilalim ng mga resulta ng ibang grupo. Binubuksan ng row ang `#/ask?q=…`, at isang beses na itinatanong ng view ang tanong pagdating. Dumarating ang mga salita sa maliliit na titik na walang bantas, kaya ayusin ang mga ito sa question field kung kailangan mo.
- <!--i:link--> **Mula sa link.** Binubuksan ng `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` ang view na naitanong na ang tanong na iyon. Itinatakda lang ng hash ang unang tanong. Sinasagot sa parehong lugar ang mga tanong na tina-type mo pagkatapos at hindi kailanman binabago ang address.

Nakatago ang search bar sa view na ito dahil ang question field ang tumatanggap ng Enter. Ibinabalik ka ng back pill sa pinanggalingan mo.

Nananatili ang mga sagot para sa session na ito: naroon pa rin ang mga ito kung umalis ka at bumalik, at inaalis ang mga ito kapag nag-reload. Walang isinusulat sa storage, kaya walang history na kailangang pamahalaan.

<!--i:eti-download-->
## Offline

Galing ang mga sagot sa dalawang static na file na inilalathala ng site ng dokumentasyon: ang search index sa bawat wika at ang markdown na katumbas ng page. Parehong kinukuha ayon sa pangalan, kaya gumagana ang Ask nang walang koneksyon kapag naka-cache na ang mga ito. Naka-cache ang mga gabay kapag binasa mo ang mga ito sa app. Kinukuha ng **Guides & docs** sa ilalim ng [Available offline](/info/dashboard.html#available-offline) ang buong site, kasama ang mga screenshot, sa isang download.

Kung wala ang mga file na ito, hindi lumalabas ang bahagi ng sagot mula sa dokumentasyon, at walang ipinapakitang error. Lumalabas pa rin ang mga row sa loob ng app, dahil tumutugma ang mga ito sa data na nasa device na.

<!--i:eti-lock-->
## Privacy

Hindi kailanman umaalis sa device ang tanong mo. Lokal na tumatakbo ang pagtutugma gamit ang mga file na kinukuha ayon sa pangalan, kaya hindi bahagi ng anumang request ang tinype mo. Walang server na nakakakita ng tanong mo, walang account na may hawak nito at walang naiiwang tala pagkatapos mong mag-reload. Inililista ng [Patakaran sa Privacy](/info/privacy.html) ang lahat ng kinukuha o ipinapadala ng app.

---

**Kaugnay:** [Lolly Search](/info/search.html) para sa bar na nagpapasa ng mga tanong. [Paggamit ng Lolly](/info/using.html) para sa ibang bahagi ng app. [Lolly Settings](/info/dashboard.html#available-offline) para gawing available offline muna ang dokumentasyon.
