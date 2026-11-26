# Lolly Rondocode-låtar

<a id="rondocode-songs"></a>

En rondocode-låt är musik skriven som kod: syntar, mönster och en mix, som spelas medan du skriver. Lolly kan spela en låt under en video, och verktyget **Rondocode** skriver låtar och exporterar dem som ljud; båda registrerar låten i filens Content Credentials.

<!--i:eti-music-->
## Spela en låt i Lolly

Tillgångsväljaren tar emot en låt som en `.rondo`- eller `.rondo.json`-fil eller som en inklistrad delningslänk från `rondocode.com`. En låt spelas så länge som dess klipp begär. Den kan vara **bakgrundsmusiken** under en videoexport eller spelas i Neurospicy Modes stämningsspelare.

Låtens kod körs i Lollys sandlåda, utan nätverk och utan tillgång till dina filer. Varje del som en rendering inte kan spela, till exempel en livemikrofon eller sång utan röstmodellerna, listas i tillgångens detaljer.

Från terminalen tar `lolly mix` en låt som hela ljudspåret; se [CLI-rendering](/info/cli-rendering.html).

<!--i:eti-code-->
## Skriv och exportera en låt

Öppna verktyget **Rondocode** från **Utilities** för att skriva en låt i rondocodes liveredigerare och höra den medan du skriver. Exportera den som **WAV**, **MP3**, **M4A**, **Opus** eller **FLAC**, som en ZIP med delspår, som **MIDI** eller som en inspelning av det som spelas. Från terminalen skriver `lolly rondocode --export=mid` samma MIDI-fil. **Export length** anger hur många sekunder en ljudexport varar. Låtfilen (`.rondo.json`) är din kod som du skrev den, utan tillägg.

En låt kan sjunga sin text med `sing()`. Nedladdade röstmodeller skapar sången på din enhet. En fil som innehåller syntetiserad sång anger alltid att sången är AI-genererad (se [AI-funktioner](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Låtar i intyget

En video- eller ljudexport som spelar en rondocode-låt registrerar varje låt i sina Content Credentials som en källa:

- låtens namn;
- SHA-256 för dess `.rondo.json`-fil;
- hur den renderades: i Lollys sandlåda, körningsklassen `vm`, med renderarens version och slumpfrö och varje del som renderingen inte kunde spela.

Musik som beräknas från en låts kod märks som algoritmiska medier, så Lolly Verify flaggar den inte som AI. Innan du exporterar listar en rad under **Download** de låtar som intyget kommer att registrera. Efter exporten rapporterar samma rad vad en läsning av den levererade filen hittade. Avmarkera **C2PA Credentials** för att utelämna posten. En stillbild registrerar ingen låt, eftersom den saknar ljud. En stillbild registrerar ingen låt. `lolly mix` och [MCP-servern](/info/mcp.html) skriver samma post.

<!--i:eti-file-->
## Filer från Rondocode-verktyget

De flesta verktyg som körs på enheten skriver inget intyg, eftersom de omvandlar en fil du redan äger. Lolly Rondocode skapar nytt ljud, så varje ljudfil det skriver innehåller Content Credentials som registrerar låten som dess källa: WAV, MP3, M4A, Opus, FLAC, varje delspår i en ZIP med delspår och en inspelning av det som spelas.

- Redigerarens egna renderingar körs i dess privata ram (körningsklassen `frame`) och registrerar redigerarens version.
- En rendering som skapas av CLI eller en delningslänk körs i klassen `vm` och registrerar renderarens version och slumpfrö.
- En WAV anger också samma sak i sin RIFF-kommentar.

När en låt sjunger är AI-deklarationen maskinläsbar. Intygets digitala källtyp är sammansatta medier skapade med tränade modeller, posten listar de sjungna delarna och en C2PA AI-deklaration per modell identifierar varje modell som sången passerade: Supertonic-3 text till tal, fonemjusteraren wav2vec 2.0, ContentVec-kodaren och RVC-rösten, med det kodförråd och den commit som Lolly tillhandahåller den från.

### Det som MIDI-filen innehåller

MIDI-filen är en Standard MIDI File, format 1. Det första spåret innehåller tempot och taktarten 4/4, följt av ett spår per synt, uppkallat efter synten. Varje not behåller sin start, längd och anslagsstyrka. En synt vars namn tolkas som ett instrument, till exempel bas, stråkar, pad eller piano, får motsvarande General MIDI-instrument, och ett trumliknande namn hamnar på kanal 10. En stämning som inte är tolvtonig avrundas till närmaste halvton med en tonhöjdsböjning.

En MIDI-fil kan inte innehålla syntinställningar, filter, effekter, bussar, samplingar eller sång, så en DAW spelar noterna med sina egna instrument. Tempot läses från låtens cykler per sekund med en cykel som en takt på fyra slag, eftersom låtens egen taktart inte ingår i det som renderaren lämnar tillbaka.

En MIDI-fil har ingen plats för ett intyg, så en texthändelse i filen innehåller uppgiften, och exportpanelen berättar det för dig. Panelen beskriver allt detta innan du exporterar. Efter varje export läser redigeraren tillbaka den sparade filen och rapporterar bara vad den läsningen hittade.

För vad Content Credentials registrerar i allmänhet, se [Exportera en fil](/info/exporting.html#content-credentials-c2pa).
