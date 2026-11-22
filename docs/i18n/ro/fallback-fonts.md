# Fonturi de rezervă

Când fonturile unui sistem de design nu pot desena o literă, Lolly o desenează cu un font Noto deschis, astfel încât exportul să păstreze litera ca un contur vectorial în loc de imagine. Fonturile Lolly Demo, Outfit pentru titluri și SUSE pentru text, nu au litere chirilice, grecești, arabe, ebraice, devanagari, bengaleze, thailandeze, chinezești, japoneze sau coreene.

Fonturile sistemului de design au întotdeauna prioritate, în ordinea listată. Outfit nu are litere vietnameze, deci un titlu în vietnameză le ia din SUSE, următorul font din lista Lolly Demo. Un font de rezervă desenează doar caracterele pe care niciunul dintre acele fonturi nu le poate desena. Un font de brand păstrează fiecare literă, cifră și semn pe care le are, inclusiv caractere chinezești, chiar și într-un cuvânt din alt sistem de scriere.

<!--i:eti-package-->
## Ce este inclus

Cincisprezece fonturi, toate din Google Fonts, la un commit fixat. Fiecare fișier este afișat cu dimensiunea descărcării.

| Sistem de scriere | Font | Versiune | Descărcare |
|---|---|---|---|
| Arab, inclusiv litere urdu și persane | Noto Sans Arabic | 2.012 | 211 KB |
| Ebraic | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepaleză) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalez | Noto Sans Bengali | 3.011 | 139 KB |
| Thailandez | Noto Sans Thai | 2.002 | 62 KB |
| Chirilic | Noto Sans, litere chirilice | 2.015 | 115 KB, cursiv 132 KB |
| Grec | Noto Sans, litere grecești | 2.015 | 77 KB, cursiv 83 KB |
| Latin, inclusiv litere vietnameze și alte litere cu accent | Noto Sans, litere latine | 2.015 | 316 KB, cursiv 350 KB |
| Chineză simplificată, caracterele GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Chineză tradițională, caracterele Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Japonez, caracterele Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Coreean, fiecare silabă Hangul și caracterele KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Fiecare font păstrează toate grosimile de pe axa sa de grosime, deci un titlu aldin în chineză, japoneză sau coreeană este aldin. Fonturile Noto Sans au axa de lățime fixată la normal, ceea ce înjumătățește fiecare fișier. Fonturile chinezești, japoneze și coreene nu au axă de lățime. Noto Sans este împărțit după sistemul de scriere, deci un cuvânt chirilic descarcă doar literele chirilice. Contururile rămân neschimbate față de sursa originală.

::: details Unde se află fonturile și cum sunt construite
Fonturile se află într-un singur folder comun, `community/fallback-fonts`, servit fiecărui sistem de design din `/catalog/packs/fallback-fonts/`, la fel ca seturile de emoji. `scripts/import-fallback-fonts.ts` construiește fișierele din fonturile originale fixate în `scripts/data/fallback-fonts.json`, verifică fiecare fișier original față de SHA-256 înregistrat și scrie textele licențelor lângă fonturi.
:::

<!--i:eti-globe-->
## Chineză, japoneză și coreeană

Un font chinezesc, japonez sau coreean integral are între 9.6 MB și 17.8 MB. Fiecare este redus la setul său național de caractere, plus punctuația, kana, formele cu lățime completă și simbolurile din textul curent:

- Chineză simplificată: GB 2312, cele 6.763 de hanzi uzuale și simbolurile sale, 7.522 de caractere în total.
- Chineză tradițională: Big5, cele 13.053 de hanzi și simbolurile sale, 13.629 de caractere în total. Hong Kong Supplementary Character Set nu este inclus.
- Japoneză: Shift_JIS așa cum îl citesc Windows și webul, adică JIS X 0208 cu adăugirile NEC și IBM necesare unor nume precum 髙 și 﨑, toate caracterele kana și katakana cu jumătate de lățime, 7.432 de caractere în total.
- Coreeană: toate cele 11.172 de silabe Hangul și KS X 1001, cu cele 4.888 de hanja ale sale, 17.082 de caractere în total.

Aceste patru fonturi omit literele latine, grecești și chirilice, pe care le desenează fonturile sistemului de design și fonturile de mai sus. Seturile provin din fișierele de index ale Encoding Standard, la un commit fixat, deci o reconstruire produce aceleași fișiere.

Chineza, japoneza și coreeana au majoritatea caracterelor în comun, dar desenează multe dintre ele diferit. 直, de exemplu, se scrie într-un fel în chineză și în altul în japoneză. Un segment de text își ia toate caracterele comune dintr-un singur font dintre acestea, niciodată din două. Lolly alege acel font în această ordine:

1. Limba segmentului, din `lang` al elementului său sau al celui mai apropiat element care îl înconjoară în document. O setare de limbă a instrumentului, precum Language din instrumentul de certificate, o stabilește. Limba interfeței Lolly și limba sistemului de design nu contează, deci un document se exportă la fel pentru toți.
2. Sistemul de scriere al segmentului: kana înseamnă japoneză, iar Hangul înseamnă coreeană. Când segmentul nu are niciuna, Lolly citește documentul, deci un titlu format doar din kanji într-un document japonez este desenat în japoneză. Un document cu kana și Hangul nu stabilește nimic la acest pas.
3. Un caracter pe care îl folosește doar chineza tradițională, precum 體 sau 說, în segment sau, în lipsa lui, în document, înseamnă chineză tradițională, cu excepția cazului în care același text conține și unul pe care îl folosește doar chineza simplificată.
4. Altfel, chineză simplificată.

Un caracter care lipsește din fontul ales nu este luat niciodată din unul dintre celelalte trei. Rămâne o imagine. Caracterele kana sau Hangul care lipsesc din fontul ales, precum cuvinte coreene într-o linie marcată ca japoneză, pot proveni totuși din fontul japonez sau coreean, dar doar când acel font nu ar desena niciun caracter comun al liniei.

Pe pagină, un canvas care conține două dintre aceste limbi listează ambele fonturi, iar browserul desenează caracterele comune cu primul. Exportul desenează fiecare segment cu fontul său.

<!--i:eti-download-->
## Când se descarcă un font

Nu se descarcă nimic până când un document nu conține un caracter pe care niciun font al sistemului său de design nu îl poate desena. Un simbol într-o linie în engleză, precum ★ sau ※, nu descarcă niciodată un font chinezesc, japonez sau coreean.

Prima dată când un document are nevoie de un font de rezervă, Lolly descarcă doar acel font și îl păstrează pe dispozitivul tău. Un document japonez descarcă doar fontul japonez, de 2.2 MB, iar unul în chineză tradițională descarcă fontul tradițional de 3.8 MB. De atunci, sistemul de scriere se desenează offline, iar fontul rămâne când catalogul este curățat. Fontul este păstrat cu fișierele catalogului, niciodată printre fonturile încărcate de tine, și nu apare în lista de fonturi a brandului tău.

Linia de comandă, aplicația de terminal și serverul MCP citesc aceleași fișiere de pe disc, deci nu au nevoie de descărcare.

<!--i:eti-eye-->
## Pe pagină și în export

Pagina folosește același font de rezervă ca exportul, deci o linie care conține asemenea litere are aceeași lățime în ambele. Doar pe acel canvas, Lolly adaugă fontul de rezervă după fonturile proprii ale sistemului de design și înaintea oricărui font de sistem. Un instrument care își setează propria listă de fonturi, în stilurile sale sau pe elementele sale, primește fontul de rezervă în același loc. Un canvas acoperit de sistemul de design își păstrează lista de fonturi neschimbată.

Pagina lasă o listă de fonturi neschimbată când începe cu un font de sistem, precum `system-ui` sau Helvetica, deoarece exportul desenează acel text cu fonturile sistemului de design, iar pagina nu.

Într-un PDF, cuvintele devin contururi în fontul de rezervă indiferent de setarea textului, deoarece textul live din PDF nu poate conține un sistem de scriere care lipsește din fontul încorporat. În SVG, EMF, EPS, DXF și WMF devin contururi ori de câte ori textul este convertit în contururi. Cu textul păstrat live, fonturile proprii ale cititorului le desenează. Când un font de rezervă a desenat o parte dintr-un export, panoul de export arată o notă precum:

> Textul japonez este desenat cu Noto Sans JP, deoarece fonturile acestui sistem de design nu au acele litere.

Linia de comandă afișează aceeași propoziție ca notă.

<!--i:eti-image-->
## Ce rămâne o imagine

Un caracter din afara celor patru seturi naționale, precum 𠮷 sau un caracter suplimentar din Hong Kong, nu are font de rezervă. Caracterele rare precum 𠮷, caracterele adăugate pentru Hong Kong prin setul său suplimentar și sistemele de scriere fără font de rezervă, precum tamil, etiopian sau siriac, sunt toate tratate la fel. Nici un sistem de scriere precum tamil, etiopian sau siriac nu are font de rezervă. Într-un PDF, linia care conține un asemenea text intră ca imagine la 300 dpi, iar panoul de export listează sistemele de scriere. Într-un SVG, segmentul rămâne text live, pe care îl desenează fonturile proprii ale cititorului.

::: details În exporturile EPS, WMF și EMF
Un EPS, un WMF sau un EMF cu **Outline fonts** activat nu are text live la care să recurgă, deci segmentul intră tot ca imagine la 300 dpi. Imaginea aplică culoarea textului doar acolo unde sunt literele, astfel încât fundalul să se vadă prin ea. Panoul de export listează sistemele de scriere. O imagine este desenată doar drept, deci un segment rotit sau înclinat oprește exportul cu un mesaj care citează segmentul. Într-un WMF sau EMF, imaginea este o pereche de operații bitmap, o mască și o aplicare de culoare. Microsoft Office și LibreOffice le desenează așa cum trebuie. O aplicație care le ignoră, precum Inkscape, arată cuvintele pe o casetă albă.

Un EMF cu **Outline fonts** dezactivat păstrează un asemenea segment ca text live, pe care îl desenează fonturile proprii ale cititorului. Excepția este un segment pe care textul live EMF nu îl poate conține, precum textul cu spațiere între litere. Lolly transformă acel segment în contururi, deci un segment pe care niciun font nu îl poate desena intră și acolo ca imagine.
:::

::: warning Un export DXF se oprește la textul pe care niciun font nu îl poate desena
Un DXF ajunge la mașini de tăiat și software CAD, care au nevoie de contururi, deci un segment pe care niciun font nu îl poate desena oprește un export DXF. Mesajul citează segmentul și indică sistemul său de scriere. Adaugă un font cu acele litere sau exportă SVG ori PDF.
:::

<!--i:eti-checklist-->
## Verificarea înainte de export

Cardul **Before you export** din Lolly Design și verificările `render` ale `lolly check` raportează textul pe care niciun font nu îl poate desena. Iau în calcul fonturile de rezervă la fel ca un export, din aceleași liste de caractere pentru fiecare font, deci textul desenat de un font de rezervă nu este raportat. Un sistem de scriere fără font de rezervă, precum tamil, și un caracter chinezesc, japonez sau coreean din afara seturilor naționale sunt în continuare raportate, deoarece exportul le desenează ca imagine sau ca text live, iar un export DXF se oprește la ele. Verificarea citește acele liste din catalog și nu descarcă niciun font.

<!--i:eti-stamp-->
## Licențe și atribuiri

Fiecare font de rezervă este sub SIL Open Font License 1.1. Fiecare intrare din catalog înregistrează acea licență cu un hash al textului licenței, deci regulile privind drepturile din [Drepturi de creație și atribuiri](/info/creative-rights.html) citesc licența ca pe cea a oricărui alt font. Textele licențelor se află lângă fonturi. Fișierele Noto Sans nu declară niciun Reserved Font Name. Fonturile chinezești, japoneze și coreene aparțin Adobe și rezervă numele Source. Fișierele reduse își păstrează numele Noto, care nu folosesc acel nume.

Licența spune că termenii ei nu se aplică documentelor realizate cu fonturile. Un export conține doar contururile literelor pe care le folosește, la fel ca în cazul fonturilor proprii ale sistemului de design. Lolly nu adaugă niciun program de font, nicio linie de atribuire și nicio intrare nouă în certificatul de conținut pentru un font de rezervă.
