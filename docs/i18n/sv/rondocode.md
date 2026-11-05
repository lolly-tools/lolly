# Rondocode-sånger

En rondocode-sång är musik skriven som kod: synthar, mönster och en mix, spelad medan du skriver. Lolly kan spela en sång under en video, och verktyget **Rondocode** låter dig skriva en och exportera den som ljud. Båda registrerar sången i filens Content Credentials, så att musiken säger var den kommer ifrån.

## Spela en sång i Lolly

Tillgångsväljaren tar en sång som en `.rondo`- eller `.rondo.json`-fil, eller som en inklistrad delningslänk från `rondocode.com`. En sång är kod som gör sitt eget ljud, så den spelas i den längd dess klipp ber om. Den kan vara **musikbädden** under en videoexport eller spelas i Neurospicy Modes ambienta spelare.

Sångens kod körs i Lollys sandlåda, utan nätverk och utan åtkomst till dina filer. Varje del som en rendering inte kan spela, som en levande mikrofon, eller sång utan röstmodellerna, listas i tillgångens detaljer.

Från terminalen tar `lolly mix` en sång som hela ljudspåret; se [CLI-rendering](/info/cli-rendering.html).

## Skriv och exportera en sång

Öppna **Rondocode** från **Utilities** för att skriva en sång i rondocodes levande redigerare och höra den medan du skriver. Exportera den som **WAV**, **MP3**, **M4A**, **Opus** eller **FLAC**, som en ZIP med stems, som **MIDI**, eller som en inspelning av det som spelas. Från terminalen skriver `lolly rondocode --export=mid` samma MIDI-fil. **Export length** anger hur många sekunder en ljudexport varar. Själva sångfilen (`.rondo.json`) är din kod som skriven och bär inget tillagt.

En sång kan sjunga sin text med `sing()`. Sången görs på din enhet av nedladdade röstmodeller, och en fil som håller syntetiserad sång deklarerar alltid sången som AI-genererad (se [AI-funktioner](/info/ai-features.html)).

## Sånger i credentialen

En video- eller ljudexport som spelar en rondocode-sång registrerar varje sång i sina Content Credentials som en källa:

- sångens namn;
- SHA-256 av dess `.rondo.json`-fil;
- hur den renderades: i Lollys sandlåda, exekveringsklassen `vm`, med renderarens version och seed, och varje del renderingen inte kunde spela.

Musik som beräknats från en sångs kod märks som algoritmiskt medium, så Verify flaggar den inte som AI. Innan du exporterar listar en rad under **Download** sångerna credentialen kommer att registrera; efter exporten rapporterar samma rad vad en läsning av den levererade filen hittade. Avmarkera **C2PA Credentials** för att lämna posten utanför. En stillbild registrerar ingen sång, eftersom den inte bär något ljud. `lolly mix` och [MCP-servern](/info/mcp.html) skriver samma post.

## Filer från verktyget Rondocode

De flesta verktyg på enheten skriver ingen credential, eftersom de omvandlar en fil du redan äger. Rondocode gör nytt ljud, så varje ljudfil det skriver bär Content Credentials som registrerar sången som sin källa: dess namn, SHA-256 av dess `.rondo.json`-fil och var dess kod kördes. Det gäller WAV, MP3, M4A, Opus, FLAC, varje stem i en stems-ZIP och en inspelning av det som spelas.

- Redigerarens egna renderingar körs i dess privata ram (exekveringsklassen `frame`) och registrerar redigerarens version.
- En rendering gjord av CLI eller en delningslänk körs i klassen `vm` och registrerar renderarens version och seed.
- En WAV anger också samma sak i sin RIFF-kommentar.
- Musik som beräknats från sångens kod är algoritmiskt medium och märks inte som AI.

När en sång sjunger deklarerar filen den sången som AI-genererad i maskinläsbar form. Credentialens digitala källtyp är sammansatt media gjort med tränade modeller, posten listar de sjungna delarna, och en C2PA AI-redovisning per modell identifierar varje modell sången passerat: Supertonic-3 text till tal, wav2vec 2.0-fonemjusteraren, ContentVec-kodaren och RVC-rösten, med arkivet och den commit Lolly hostar den från. En fil som håller syntetiserad sång sparas aldrig utan den deklarationen.

### Vad MIDI-filen innehåller

MIDI-filen är en Standard MIDI File, format 1. Det första spåret innehåller tempot och ett 4/4-taktartstecken, och efter det finns ett spår för varje synt, uppkallat efter synten. Varje ton behåller sin start, längd och velocity. En synt vars namn läses som ett instrument, som en bas, stråkar, en pad eller ett piano, får det matchande General MIDI-instrumentet, och ett trumliknande namn hamnar på kanal 10. En stämning som inte är tolvtonig avrundas till närmaste halvton med en pitch bend.

En MIDI-fil kan inte rymma hur en sång låter. Syntinställningarna, filtren, effekterna, bussarna, samplingarna och sången finns inte med, så en DAW spelar tonerna med sina egna instrument. Tempot läses från sångens cykler per sekund, där en cykel är en takt på fyra slag, eftersom sångens egen taktart inte ingår i det som renderaren lämnar tillbaka.

En MIDI-fil har ingen plats för en credential, så en texthändelse i filen bär uttalandet i stället, och exportpanelen säger det. Panelen beskriver allt detta innan du exporterar, och efter varje export läser redigeraren tillbaka den sparade filen och rapporterar bara vad den läsningen hittade.

För vad Content Credentials registrerar i allmänhet, se [Exportera en fil](/info/exporting.html#content-credentials-c2pa).
