# Reserveskrifter

Et designsystems skrifter dekker ofte bare noen av verdens skriftsystemer. Lolly Demo setter overskrifter i Outfit og tekst i SUSE, og ingen av dem har kyrilliske, greske, arabiske, hebraiske, devanagari-, bengalske, thailandske, kinesiske, japanske eller koreanske bokstaver. Når et dokument har bokstaver som designsystemets skrifter ikke kan tegne, tegner Lolly dem med en åpen Noto-skrift, slik at eksporten beholder dem som vektorkonturer i stedet for å gjøre ordene om til et bilde.

Designsystemets skrifter kommer alltid først, i den rekkefølgen designsystemet lister dem. Outfit har ingen vietnamesiske bokstaver, så en vietnamesisk overskrift henter dem fra SUSE, den neste skriften i Lolly Demos liste. En reserveskrift tegner bare tegnene som ingen av disse skriftene kan tegne, så en merkeskrift beholder hver bokstav, hvert siffer og hvert tegn den har, selv inne i et ord på et annet skriftsystem. En merkeskrift som har et kinesisk tegn, beholder også det tegnet.

## Hva som følger med

Femten skrifter, alle fra Google Fonts på en fastlåst commit og alle under SIL Open Font License 1.1. Hver fil vises med nedlastingsstørrelsen.

| Skriftsystem | Skrift | Versjon | Nedlasting |
|---|---|---|---|
| Arabisk, med urdu- og persiske bokstaver | Noto Sans Arabic | 2.012 | 206 KB |
| Hebraisk | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepali) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengalsk | Noto Sans Bengali | 3.011 | 136 KB |
| Thai | Noto Sans Thai | 2.002 | 61 KB |
| Kyrillisk | Noto Sans, kyrilliske bokstaver | 2.015 | 112 KB, kursiv 129 KB |
| Gresk | Noto Sans, greske bokstaver | 2.015 | 75 KB, kursiv 81 KB |
| Latinsk, med vietnamesisk og andre aksentbokstaver | Noto Sans, latinske bokstaver | 2.015 | 309 KB, kursiv 342 KB |
| Forenklet kinesisk, GB 2312-tegnene | Noto Sans SC | 2.004 | 1,9 MB |
| Tradisjonell kinesisk, Big5-tegnene | Noto Sans TC | 2.004 | 3,6 MB |
| Japansk, Shift_JIS-tegnene | Noto Sans JP | 2.004 | 2,1 MB |
| Koreansk, hver hangul-stavelse og KS X 1001-tegnene | Noto Sans KR | 2.004 | 2,4 MB |

Vektaksen i hver skrift beholdes hel, så hver vekt et design ber om, tegnes fortsatt, og en halvfet kinesisk, japansk eller koreansk overskrift er halvfet. Breddeaksen i Noto Sans-skriftene er fastlåst på normal, noe som halverer hver fil; de kinesiske, japanske og koreanske skriftene har ingen breddeakse. Noto Sans er delt etter skriftsystem, så et kyrillisk ord laster bare ned de kyrilliske bokstavene. Konturene er de opprinnelige, uendret.

Skriftene ligger i én delt mappe, `community/fallback-fonts`, som serveres til hvert designsystem fra `/catalog/packs/fallback-fonts/`, på samme måte som emoji-settene deles. `scripts/import-fallback-fonts.ts` bygger filene fra de oppstrøms skriftene som er fastlåst i `scripts/data/fallback-fonts.json`, kontrollerer hver oppstrøms fil mot den registrerte SHA-256-verdien og skriver lisenstekstene ved siden av skriftene.

## Kinesisk, japansk og koreansk

En hel kinesisk, japansk eller koreansk skrift er på 9,6 MB til 17,8 MB, så hver av disse skriftene er kuttet ned til det nasjonale tegnsettet leserne bruker daglig, pluss tegnsettingen, kanaen, fullbredde-formene og symbolene i løpende tekst:

- Forenklet kinesisk: GB 2312, de 6 763 vanlige hanzi og symbolene, 7 522 tegn til sammen.
- Tradisjonell kinesisk: Big5, de 13 053 hanzi og symbolene, 13 629 tegn til sammen. Hong Kong Supplementary Character Set er ikke med.
- Japansk: Shift_JIS slik Windows og nettet leser det, altså JIS X 0208 med NEC- og IBM-tilleggene som navn som 髙 og 﨑 trenger, all kana og halvbredde-katakana, 7 432 tegn til sammen.
- Koreansk: alle 11 172 hangul-stavelser og KS X 1001 med de 4 888 hanja, 17 082 tegn til sammen.

Latinske, greske og kyrilliske bokstaver er utelatt fra disse fire skriftene, fordi designsystemets skrifter og skriftene ovenfor tegner dem. Tegnsettene leses fra Encoding Standards indeksfiler på en fastlåst commit, så en ombygging gir de samme filene.

Kinesisk, japansk og koreansk deler de fleste tegnene sine, men hver tegner mange av dem forskjellig. Det samme tegnet 直 skrives på én måte på kinesisk og på en annen på japansk. Derfor henter én tekstkjøring alle de delte tegnene fra én av disse skriftene, aldri to, og Lolly velger den skriften i denne rekkefølgen:

1. Kjøringens språk, fra `lang` på elementet eller det nærmeste elementet rundt det i dokumentet. En verktøyinnstilling for språk, for eksempel sertifikatets Language, setter det. Språket i Lollys eget grensesnitt og designsystemets språk teller ikke, så et dokument eksporteres likt for alle.
2. Kjøringens skriftsystem: kana betyr japansk og hangul betyr koreansk. Når selve kjøringen har ingen av dem, leses hele dokumentet, så en overskrift med bare kanji i et japansk dokument tegnes på japansk. Et dokument som har både kana og hangul, avgjør ingenting her.
3. Et tegn som bare tradisjonell kinesisk bruker, for eksempel 體 eller 說, i kjøringen eller ellers i dokumentet, betyr tradisjonell kinesisk, med mindre den samme teksten også har et tegn som bare forenklet kinesisk bruker.
4. Ellers forenklet kinesisk.

Et tegn som den valgte skriften ikke har, hentes aldri fra en av de tre andre. Det forblir et bilde, som beskrevet nedenfor. Kana eller hangul som den valgte skriften mangler, for eksempel koreanske ord på en linje merket som japansk, kan likevel komme fra den japanske eller koreanske skriften, men bare når den skriften ikke ville tegnet noe delt tegn på linjen.

På siden viser et lerret med to av disse språkene begge skriftene, og nettleseren tegner de delte tegnene med den første. Eksporten tegner hver kjøring med sin egen.

## Når en skrift lastes ned

Ingenting lastes ned før et dokument har et tegn som ingen skrift i designsystemet kan tegne. Et dokument på engelsk, eller på et hvilket som helst språk designsystemet dekker, laster aldri ned en reserveskrift. Et symbol på en engelsk linje, for eksempel ★ eller ※, laster aldri ned en kinesisk, japansk eller koreansk skrift.

Første gang et dokument trenger en, laster Lolly ned den ene skriften, for det ene skriftsystemet, og beholder den på enheten din. Et japansk dokument laster ned bare den japanske skriften, 2,1 MB, og et tradisjonelt kinesisk dokument den tradisjonelle skriften på 3,6 MB. Fra da av tegnes skriftsystemet uten nett, og skriften blir liggende når katalogen ryddes. Skriften lagres sammen med katalogens egne filer, aldri blant skriftene du har lastet opp, så den vises ikke i merkets skriftliste.

Kommandolinjen, terminalappen og MCP-serveren leser de samme filene fra disk, så de trenger ingen nedlasting.

## På siden og i eksporten

Siden bruker den samme reserveskriften som eksporten. Uten dette tegner en nettleser slike bokstaver i en systemskrift mens eksporten bruker Noto, og en linje som har dem, endrer bredde mellom de to. Lolly legger reserveskriften til på slutten av designsystemets skriftliste, bare på det lerretet, etter designsystemets egne skrifter og før en eventuell systemskrift. Et lerret designsystemet dekker, beholder skriftlisten helt som før.

I en PDF blir ordene konturer tegnet med reserveskriften, uansett hvilken tekstinnstilling du velger, fordi levende PDF-tekst ikke kan bære et skriftsystem den innebygde skriften mangler. I SVG, EMF, EPS, DXF og WMF blir de konturer hver gang tekst konverteres til konturer; med levende tekst tegnes de av leserens egne skrifter, som før. Når en reserveskrift har tegnet en del av en eksport, viser eksportpanelet en merknad som:

> Japansk tekst tegnes med Noto Sans JP, fordi dette designsystemets skrifter ikke har disse bokstavene.

Kommandolinjen skriver ut den samme setningen som en merknad.

## Det som forblir et bilde

Et tegn utenfor de fire nasjonale tegnsettene har ingen reserveskrift. Sjeldne tegn som 𠮷, tegnene som Hong Kong la til med sitt tilleggssett, og skriftsystemer uten reserveskrift, for eksempel tamil, etiopisk eller syrisk, behandles alle på samme måte. I en PDF legges linjen som har ett, inn som et bilde på 300 dpi, og eksportpanelet lister skriftsystemene. I en SVG forblir kjøringen levende tekst, som leserens egne skrifter tegner.

## Lisenser og kreditter

Hver reserveskrift er under SIL Open Font License 1.1, og hver katalogoppføring registrerer den lisensen med en hash av lisensteksten, så rettighetsreglene i [Creative rights and credits](/info/creative-rights.html) leser lisensen som for enhver annen skrift. Lisenstekstene ligger ved siden av skriftene. Noto Sans-filene oppgir ikke noe Reserved Font Name. De kinesiske, japanske og koreanske skriftene er fra Adobe og reserverer navnet Source; de kuttede filene beholder Noto-navnene sine, som ikke bruker det navnet.

Lisensen sier at vilkårene ikke gjelder for dokumenter laget med skriftene. En eksport har bare de tegnede konturene av bokstavene den bruker, slik den har for designsystemets egne skrifter, og Lolly legger ikke til noe skriftprogram, ingen kredittlinje og ingen ny Content Credentials-oppføring for en reserveskrift.
