# Reserveskrifter

Når skriftene i et designsystem ikke kan tegne en bokstav, tegner Lolly bokstaven med en åpen Noto-skrift, slik at eksporten beholder bokstaven som et vektoromriss i stedet for et bilde. Skriftene til Lolly Demo, Outfit for overskrifter og SUSE for tekst, har ingen kyrilliske, greske, arabiske, hebraiske, devanagari-, bengalske, thailandske, kinesiske, japanske eller koreanske bokstaver.

Designsystemets skrifter kommer alltid først, i rekkefølgen de er oppført. Outfit har ingen vietnamesiske bokstaver, så en vietnamesisk overskrift henter dem fra SUSE, den neste skriften i Lolly Demos liste. En reserveskrift tegner bare tegnene ingen av disse skriftene kan tegne. En profilskrift beholder hver bokstav, hvert siffer og hvert tegn den har, inkludert kinesiske tegn, også inne i et ord i et annet skriftsystem.

<!--i:eti-package-->
## Hva som følger med

Femten skrifter, alle fra Google Fonts ved en fastsatt commit. Hver fil vises med nedlastingsstørrelsen.

| Skriftsystem | Skrift | Versjon | Nedlasting |
|---|---|---|---|
| Arabisk, inkludert urdu- og persiske bokstaver | Noto Sans Arabic | 2.012 | 211 KB |
| Hebraisk | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepali) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalsk | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Kyrillisk | Noto Sans, kyrilliske bokstaver | 2.015 | 115 KB, kursiv 132 KB |
| Gresk | Noto Sans, greske bokstaver | 2.015 | 77 KB, kursiv 83 KB |
| Latinsk, inkludert vietnamesiske og andre bokstaver med aksenter | Noto Sans, latinske bokstaver | 2.015 | 316 KB, kursiv 350 KB |
| Forenklet kinesisk, tegnene i GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Tradisjonelt kinesisk, tegnene i Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Japansk, tegnene i Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Koreansk, alle Hangul-stavelser og tegnene i KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

Hver skrift beholder alle vekter på vektaksen sin, så en fet kinesisk, japansk eller koreansk overskrift blir fet. Noto Sans-skriftene har breddeaksen låst til normal, noe som halverer hver fil. De kinesiske, japanske og koreanske skriftene har ingen breddeakse. Noto Sans er delt etter skriftsystem, så et kyrillisk ord laster bare ned de kyrilliske bokstavene. Omrissene er uendret fra originalkilden.

::: details Hvor skriftene ligger og hvordan de bygges
Skriftene ligger i én delt mappe, `community/fallback-fonts`, og leveres til hvert designsystem fra `/catalog/packs/fallback-fonts/`, som emojisettene. `scripts/import-fallback-fonts.ts` bygger filene fra originalskriftene som er låst til bestemte versjoner i `scripts/data/fallback-fonts.json`, kontrollerer hver originalfil mot dens registrerte SHA-256 og skriver lisenstekstene ved siden av skriftene.
:::

<!--i:eti-globe-->
## Kinesisk, japansk og koreansk

En fullstendig kinesisk, japansk eller koreansk skrift er på 9,6 MB til 17,8 MB. Hver av dem reduseres til sitt nasjonale tegnsett, pluss tegnsetting, kana, fullbreddetegn og symboler i løpende tekst:

- Forenklet kinesisk: GB 2312, de 6 763 vanlige hanzi-tegnene og symbolene, 7 522 tegn totalt.
- Tradisjonelt kinesisk: Big5, med sine 13 053 hanzi-tegn og symboler, 13 629 tegn totalt. Hong Kong Supplementary Character Set er ikke inkludert.
- Japansk: Shift_JIS slik Windows og nettet leser det, som er JIS X 0208 med NEC- og IBM-tilleggene som navn med tegn som 髙 og 﨑 trenger, alle kana og katakana i halv bredde, 7 432 tegn totalt.
- Koreansk: alle 11 172 Hangul-stavelser og KS X 1001, med sine 4 888 hanja-tegn, 17 082 tegn totalt.

Disse fire skriftene utelater latinske, greske og kyrilliske bokstaver, som designsystemets skrifter og skriftene ovenfor tegner. Settene kommer fra indeksfilene i Encoding Standard ved en fastsatt commit, så en ny bygging gir de samme filene.

Kinesisk, japansk og koreansk deler de fleste tegnene, men tegner mange av dem forskjellig. 直 skrives for eksempel på én måte på kinesisk og en annen på japansk. Ett tekstløp henter alle sine delte tegn fra én av disse skriftene, aldri to. Lolly velger skriften i denne rekkefølgen:

1. Tekstløpets språk, fra `lang` i elementet eller det nærmeste omsluttende elementet i dokumentet. Et verktøys språkinnstilling, som Language i sertifikatet, angir dette. Språket i Lollys eget grensesnitt og designsystemets språk teller ikke, så et dokument eksporteres likt for alle.
2. Tekstløpets skriftsystem: kana betyr japansk og Hangul betyr koreansk. Når tekstløpet ikke har noen av dem, leser Lolly dokumentet, så en overskrift med bare kanji i et japansk dokument tegnes på japansk. Et dokument med både kana og Hangul avgjør ingenting i dette trinnet.
3. Et tegn som bare tradisjonelt kinesisk bruker, som 體 eller 說, i tekstløpet eller ellers i dokumentet, betyr tradisjonelt kinesisk, med mindre den samme teksten også inneholder et tegn som bare forenklet kinesisk bruker.
4. Ellers forenklet kinesisk.

Et tegn den valgte skriften mangler, hentes aldri fra en av de tre andre. Det forblir et bilde. Kana eller Hangul som den valgte skriften mangler, som koreanske ord på en linje merket som japansk, kan fortsatt komme fra den japanske eller koreanske skriften, men bare når den skriften ikke ville tegnet noen av linjens delte tegn.

På siden lister et lerret med to av disse språkene begge skriftene, og nettleseren tegner de delte tegnene med den første. Eksporten tegner hvert tekstløp med sin egen.

<!--i:eti-download-->
## Når en skrift lastes ned

Ingenting lastes ned før et dokument inneholder et tegn som ingen skrift i designsystemet kan tegne. Et symbol på en engelsk linje, som ★ eller ※, laster aldri ned en kinesisk, japansk eller koreansk skrift.

Første gang et dokument trenger en reserveskrift, laster Lolly ned den ene skriften og beholder den på enheten din. Et japansk dokument laster bare ned den japanske skriften, 2,2 MB, og et tradisjonelt kinesisk dokument den tradisjonelle skriften på 3,8 MB. Fra da av tegnes skriftsystemet uten nett, og skriften blir værende når katalogen ryddes. Skriften lagres sammen med katalogens filer, aldri blant de opplastede skriftene dine, og vises ikke i merkevarens skriftliste.

Kommandolinjen, terminalappen og MCP-serveren leser de samme filene fra disk, så de trenger ingen nedlasting.

<!--i:eti-eye-->
## På siden og i eksporten

Siden bruker samme reserveskrift som eksporten, så en linje med slike bokstaver har samme bredde begge steder. Bare på det lerretet legger Lolly til reserveskriften etter designsystemets egne skrifter og før alle systemskrifter. Et verktøy som angir sin egen skriftliste, i stilene eller på elementene, får reserveskriften på samme sted. Et lerret som designsystemet dekker, beholder skriftlisten uendret.

Siden lar en skriftliste være når den starter med en systemskrift, som `system-ui` eller Helvetica, fordi eksporten tegner den teksten med designsystemets skrifter og siden ikke gjør det.

I en PDF blir ordene til omriss i reserveskriften uansett tekstinnstilling, fordi levende PDF-tekst ikke kan inneholde et skriftsystem den innebygde skriften mangler. I SVG, EMF, EPS, DXF og WMF blir de til omriss når tekst konverteres til omriss. Når teksten beholdes levende, tegnes den av leserens egne skrifter. Når en reserveskrift tegnet en del av en eksport, viser eksportpanelet en merknad som:

> Japansk tekst tegnes med Noto Sans JP, fordi skriftene i dette designsystemet ikke har disse bokstavene.

Kommandolinjen skriver samme setning som en merknad.

<!--i:eti-image-->
## Hva som forblir et bilde

Et tegn utenfor de fire nasjonale settene, som 𠮷 eller et tilleggstegn for Hongkong, har ingen reserveskrift. Sjeldne tegn som 𠮷, tegnene lagt til for Hongkong gjennom tilleggstegnsettet og skriftsystemer uten reserveskrift, som tamil, etiopisk eller syrisk, behandles alle på samme måte. Heller ikke et skriftsystem som tamil, etiopisk eller syrisk har noen reserveskrift. I en PDF legges linjen med slik tekst inn som et bilde på 300 dpi, og eksportpanelet lister skriftsystemene. I en SVG forblir tekstløpet levende tekst, som leserens egne skrifter tegner.

::: details I EPS-, WMF- og EMF-eksporter
En EPS, WMF eller EMF med **Outline fonts** på har ingen levende tekst å falle tilbake på, så tekstløpet legges også inn som et bilde på 300 dpi. Bildet maler tekstens farge bare der bokstavene er, så bakgrunnen synes gjennom. Eksportpanelet lister skriftsystemene. Et bilde tegnes bare rettvendt, så et rotert eller skråstilt tekstløp stopper eksporten med en melding som siterer tekstløpet. I en WMF eller EMF er bildet et par punktgrafikkoperasjoner, en maske og en fargelegging. Microsoft Office og LibreOffice tegner dem som tiltenkt. En app som ignorerer dem, som Inkscape, viser ordene på en hvit boks.

En EMF med **Outline fonts** av beholder et slikt tekstløp som levende tekst, som leserens egne skrifter tegner. Unntaket er et tekstløp levende EMF-tekst ikke kan inneholde, som tekst med bokstavavstand. Lolly gjør det tekstløpet om til omriss, så et tekstløp ingen skrift kan tegne, legges inn som et bilde også der.
:::

::: warning En DXF-eksport stopper ved tekst ingen skrift kan tegne
En DXF går til skjæremaskiner og CAD-programvare, som trenger omriss, så et tekstløp ingen skrift kan tegne, stopper en DXF-eksport. Meldingen siterer tekstløpet og oppgir skriftsystemet. Legg til en skrift med disse bokstavene, eller eksporter SVG eller PDF.
:::

<!--i:eti-checklist-->
## Kontrollen før du eksporterer

Kortet **Before you export** i Lolly Design og `render`-kontrollene i `lolly check` rapporterer tekst som ingen skrift kan tegne. De tar hensyn til reserveskriftene slik en eksport gjør, fra de samme tegnlistene for hver skrift, så tekst en reserveskrift tegner, rapporteres ikke. Et skriftsystem uten reserveskrift, som tamil, og et kinesisk, japansk eller koreansk tegn utenfor de nasjonale settene rapporteres fortsatt, fordi eksporten tegner dem som et bilde eller som levende tekst, og en DXF-eksport stopper ved dem. Kontrollen leser disse listene fra katalogen og laster ikke ned noen skrift.

<!--i:eti-stamp-->
## Lisenser og kreditering

Alle reserveskrifter er underlagt SIL Open Font License 1.1. Hver katalogoppføring registrerer lisensen med en hash av lisensteksten, så rettighetsreglene i [Kreative rettigheter og kreditering](/info/creative-rights.html) leser lisensen som enhver annen skrifts lisens. Lisenstekstene ligger ved siden av skriftene. Noto Sans-filene oppgir ikke noe Reserved Font Name. De kinesiske, japanske og koreanske skriftene er fra Adobe og reserverer navnet Source. De reduserte filene beholder Noto-navnene sine, som ikke bruker det navnet.

Lisensen sier at vilkårene ikke gjelder for dokumenter laget med skriftene. En eksport inneholder bare omrissene av bokstavene den bruker, som med designsystemets egne skrifter. Lolly legger ikke til noe skriftprogram, noen krediteringslinje eller noen ny oppføring i innholdsattesten for en reserveskrift.
