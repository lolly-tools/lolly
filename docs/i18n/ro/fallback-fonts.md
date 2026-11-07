# Fonturi de rezervă

Fonturile unui sistem de design acoperă adesea doar o parte din scrierile lumii. Lolly Demo setează titlurile în Outfit și textul în SUSE, iar niciunul dintre ele nu are litere chirilice, grecești, arabe, ebraice, devanagari, bengaleze, thailandeze, chineze, japoneze sau coreene. Când un document conține litere pe care fonturile sistemului său de design nu le pot desena, Lolly le desenează cu un font Noto deschis, astfel că exportul le păstrează ca contururi vectoriale în loc să transforme cuvintele într-o imagine.

Fonturile sistemului de design au mereu prioritate, în ordinea în care le listează sistemul de design. Outfit nu are litere vietnameze, deci un titlu în vietnameză le ia din SUSE, următorul font din lista Lolly Demo. Un font de rezervă desenează doar caracterele pe care niciunul dintre aceste fonturi nu le poate desena, deci un font de brand păstrează fiecare literă, cifră și semn pe care îl are, chiar și în interiorul unui cuvânt dintr-o altă scriere. Un font de brand care are un caracter chinezesc păstrează și acel caracter.

## Ce este inclus

Cincisprezece fonturi, toate din Google Fonts la un commit fixat și toate sub SIL Open Font License 1.1. Fiecare fișier este afișat cu dimensiunea sa de descărcare.

| Scriere | Font | Versiune | Descărcare |
|---|---|---|---|
| Arabă, inclusiv literele urdu și persane | Noto Sans Arabic | 2.012 | 206 KB |
| Ebraică | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepaleză) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengaleză | Noto Sans Bengali | 3.011 | 136 KB |
| Thailandeză | Noto Sans Thai | 2.002 | 61 KB |
| Chirilică | Noto Sans, litere chirilice | 2.015 | 112 KB, cursiv 129 KB |
| Greacă | Noto Sans, litere grecești | 2.015 | 75 KB, cursiv 81 KB |
| Latină, inclusiv vietnameza și alte litere cu accente | Noto Sans, litere latine | 2.015 | 309 KB, cursiv 342 KB |
| Chineza simplificată, caracterele GB 2312 | Noto Sans SC | 2.004 | 1.9 MB |
| Chineza tradițională, caracterele Big5 | Noto Sans TC | 2.004 | 3.6 MB |
| Japoneza, caracterele Shift_JIS | Noto Sans JP | 2.004 | 2.1 MB |
| Coreeana, fiecare silabă Hangul și caracterele KS X 1001 | Noto Sans KR | 2.004 | 2.4 MB |

Axa grosimii fiecărui font este păstrată întreagă, deci fiecare grosime cerută de un design se desenează în continuare, iar un titlu îngroșat în chineză, japoneză sau coreeană rămâne îngroșat. Axa lățimii fonturilor Noto Sans este fixată la normal, ceea ce reduce la jumătate fiecare fișier; fonturile chinezești, japoneze și coreene nu au axă a lățimii. Noto Sans este împărțit pe scrieri, deci un cuvânt chirilic descarcă doar literele chirilice. Contururile sunt cele originale din amonte, neschimbate.

Fonturile se află într-un dosar comun, `community/fallback-fonts`, servit fiecărui sistem de design din `/catalog/packs/fallback-fonts/`, la fel cum sunt partajate seturile de emoji. `scripts/import-fallback-fonts.ts` construiește fișierele din fonturile din amonte fixate în `scripts/data/fallback-fonts.json`, verifică fiecare fișier din amonte față de SHA-256 înregistrat și scrie textele licenței lângă fonturi.

## Chineza, japoneza și coreeana

Un font chinezesc, japonez sau coreean întreg are între 9.6 MB și 17.8 MB, deci fiecare dintre aceste fonturi este tăiat la setul național de caractere pe care îl folosesc zilnic cititorii săi, plus punctuația, kana, formele de lățime întreagă și simbolurile unui text curent:

- Chineza simplificată: GB 2312, cele 6,763 de hanzi uzuale și simbolurile lor, 7,522 de caractere în total.
- Chineza tradițională: Big5, cei 13,053 de hanzi și simbolurile lui, 13,629 de caractere în total. Hong Kong Supplementary Character Set nu este inclus.
- Japoneza: Shift_JIS așa cum îl citesc Windows și web-ul, adică JIS X 0208 cu adăugirile NEC și IBM de care au nevoie nume precum 髙 și 﨑, fiecare kana și katakana de lățime pe jumătate, 7,432 de caractere în total.
- Coreeana: toate cele 11,172 de silabe Hangul și KS X 1001, cu cele 4,888 de hanja ale sale, 17,082 de caractere în total.

Literele latine, grecești și chirilice sunt lăsate în afara acestor patru fonturi, pentru că fonturile sistemului de design și fonturile de mai sus le desenează. Seturile sunt citite din fișierele index ale Encoding Standard la un commit fixat, deci o reconstruire dă aceleași fișiere.

Chineza, japoneza și coreeana împart cele mai multe caractere, dar fiecare desenează multe dintre ele diferit. Același caracter 直 se scrie într-un fel în chineză și altfel în japoneză. Așadar o secvență de text ia toate caracterele comune dintr-unul dintre aceste fonturi, niciodată din două, iar Lolly alege acel font în această ordine:

1. Limba secvenței, din `lang` al elementului ei sau al celui mai apropiat element din jur din document. Setarea de limbă a unui instrument, precum Language de la certificat, o stabilește. Limba interfeței proprii Lolly și limba sistemului de design nu contează, deci un document se exportă la fel pentru toată lumea.
2. Scrierea secvenței: kana înseamnă japoneză, iar Hangul înseamnă coreeană. Când secvența însăși nu are niciuna, se citește întregul document, deci un titlu doar din kanji într-un document japonez este desenat în japoneză. Un document care conține și kana, și Hangul nu stabilește nimic aici.
3. Un caracter folosit doar în chineza tradițională, precum 體 sau 說, în secvență sau altfel în document, înseamnă chineză tradițională, cu excepția cazului în care același text conține și unul folosit doar în chineza simplificată.
4. În rest, chineza simplificată.

Un caracter pe care fontul ales nu îl are nu este luat niciodată din unul dintre celelalte trei. Rămâne o imagine, așa cum se descrie mai jos. Kana sau Hangul pe care fontul ales le lipsește, precum cuvinte coreene într-o linie marcată ca japoneză, pot veni totuși din fontul japonez sau coreean, dar numai când acel font nu ar desena niciun caracter comun al liniei.

Pe pagină, un canvas care conține două dintre aceste limbi listează ambele fonturi, iar browserul desenează caracterele comune cu primul. Exportul desenează fiecare secvență cu fontul ei.

## Când se descarcă un font

Nimic nu se descarcă până când un document conține un caracter pe care niciun font al sistemului său de design nu îl poate desena. Un document în engleză sau în orice limbă pe care o acoperă sistemul său de design nu descarcă niciodată un font de rezervă. Un simbol într-o linie în engleză, precum ★ sau ※, nu descarcă niciodată un font chinezesc, japonez sau coreean.

Prima dată când un document are nevoie de unul, Lolly descarcă acel font, pentru acea scriere, și îl păstrează pe dispozitivul tău. Un document japonez descarcă doar fontul japonez, 2.1 MB, iar unul în chineza tradițională fontul tradițional de 3.6 MB. De atunci scrierea se desenează offline, iar fontul rămâne când catalogul este curățat. Fontul este păstrat laolaltă cu fișierele proprii ale catalogului, niciodată printre fonturile pe care le-ai încărcat, deci nu apare în lista de fonturi a brandului tău.

Linia de comandă, aplicația de terminal și serverul MCP citesc aceleași fișiere de pe disc, deci nu au nevoie de descărcare.

## Pe pagină și în export

Pagina folosește același font de rezervă ca exportul. Fără aceasta, un browser desenează astfel de litere într-un font de sistem, în timp ce exportul folosește Noto, iar o linie care le conține își schimbă lățimea între cele două. Lolly adaugă fontul de rezervă la sfârșitul listei de fonturi a sistemului de design doar pe acel canvas, după fonturile proprii ale sistemului de design și înaintea oricărui font de sistem. Un canvas pe care îl acoperă sistemul de design își păstrează lista de fonturi exact ca înainte.

Într-un PDF cuvintele devin contururi desenate cu fontul de rezervă, indiferent ce setare de text alegi, pentru că textul PDF live nu poate purta o scriere pe care fontul încorporat nu o are. În SVG, EMF, EPS, DXF și WMF devin contururi ori de câte ori textul este convertit în contururi; cu textul păstrat live, fonturile proprii ale cititorului le desenează, ca înainte. Când un font de rezervă a desenat o parte dintr-un export, panoul de export arată o notă precum:

> Textul japonez este desenat cu Noto Sans JP, pentru că fonturile acestui sistem de design nu au acele litere.

Linia de comandă tipărește aceeași propoziție ca notă.

## Ce rămâne o imagine

Un caracter din afara celor patru seturi naționale nu are font de rezervă. Caracterele rare precum 𠮷, caracterele adăugate pentru Hong Kong prin setul său suplimentar și scrierile fără font de rezervă, precum tamila, etiopiana sau siriaca, sunt toate tratate la fel. Într-un PDF linia care conține unul intră ca imagine de 300 dpi, iar panoul de export listează scrierile. Într-un SVG secvența rămâne text live, pe care îl desenează fonturile proprii ale cititorului.

## Licențe și credite

Fiecare font de rezervă este sub SIL Open Font License 1.1, iar fiecare intrare din catalog înregistrează acea licență cu un hash al textului licenței, deci regulile de drepturi din [Drepturi creative și credite](/info/creative-rights.html) citesc licența ca pe cea a oricărui alt font. Textele licenței se află lângă fonturi. Fișierele Noto Sans nu declară niciun Reserved Font Name. Fonturile chinezești, japoneze și coreene sunt ale Adobe și rezervă numele Source; fișierele tăiate își păstrează numele Noto, care nu folosesc acel nume.

Licența spune că termenii ei nu se aplică documentelor făcute cu fonturile. Un export conține doar contururile desenate ale literelor pe care le folosește, ca pentru fonturile proprii ale sistemului de design, iar Lolly nu adaugă niciun program de font, nicio linie de credit și nicio intrare nouă de content credential pentru un font de rezervă.
