# Utwory Lolly Rondocode

<a id="rondocode-songs"></a>

Utwór rondocode to muzyka zapisana jako kod: syntezatory, sekwencje i miks, odtwarzane podczas pisania. Lolly może odtwarzać utwór w tle wideo, a narzędzie pomocnicze **Rondocode** tworzy utwory i eksportuje je jako audio; oba zapisują utwór w Content Credentials pliku.

<!--i:eti-music-->
## Odtwórz utwór w Lolly

Selektor zasobów przyjmuje utwór jako plik `.rondo` lub `.rondo.json` albo wklejony link udostępniania `rondocode.com`. Utwór odtwarza się przez czas określony przez jego klip. Może być **podkładem muzycznym** w eksporcie wideo lub grać w odtwarzaczu dźwięków tła trybu Neurospicy.

Kod utworu działa w piaskownicy Lolly, bez sieci i dostępu do Twoich plików. Każda część, której renderowanie nie może odtworzyć, na przykład mikrofon na żywo lub śpiew bez modeli głosu, jest wymieniona w szczegółach zasobu.

W terminalu `lolly mix` przyjmuje utwór jako całą ścieżkę dźwiękową; zobacz [Renderowanie w CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Napisz i wyeksportuj utwór

Otwórz narzędzie **Rondocode** z **Utilities**, aby napisać utwór w edytorze na żywo rondocode i słyszeć go podczas pisania. Wyeksportuj go jako **WAV**, **MP3**, **M4A**, **Opus** lub **FLAC**, jako ZIP ze ścieżkami składowymi, jako **MIDI** lub jako nagranie tego, co jest odtwarzane. W terminalu `lolly rondocode --export=mid` zapisuje ten sam plik MIDI. **Export length** określa, ile sekund trwa eksport audio. Plik utworu (`.rondo.json`) to Twój kod w zapisanej postaci, bez żadnych dodatków.

Utwór może śpiewać swój tekst za pomocą `sing()`. Pobrane modele głosu tworzą śpiew na Twoim urządzeniu. Plik zawierający syntezowany śpiew zawsze deklaruje go jako wygenerowany przez AI (zobacz [Funkcje AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Utwory w poświadczeniu

Eksport wideo lub audio odtwarzający utwór rondocode zapisuje każdy utwór w swoich Content Credentials jako źródło:

- nazwę utworu;
- SHA-256 jego pliku `.rondo.json`;
- sposób renderowania: w piaskownicy Lolly, w klasie wykonania `vm`, z wersją renderera i ziarnem oraz każdą część, której renderowanie nie mogło odtworzyć.

Muzyka obliczona z kodu utworu jest oznaczana jako media algorytmiczne, więc Lolly Verify nie oznacza jej jako AI. Przed eksportem wiersz pod **Download** wymienia utwory, które zapisze poświadczenie. Po eksporcie ten sam wiersz informuje, co wykrył odczyt dostarczonego pliku. Odznacz **C2PA Credentials**, aby pominąć zapis. Statyczny obraz nie zapisuje utworu, ponieważ nie ma dźwięku. Statyczny obraz nie zapisuje utworu. `lolly mix` i [serwer MCP](/info/mcp.html) tworzą ten sam zapis.

<!--i:eti-file-->
## Pliki z narzędzia pomocniczego Rondocode

Większość narzędzi pomocniczych działających na urządzeniu nie zapisuje poświadczenia, ponieważ przekształca plik, który już posiadasz. Lolly Rondocode tworzy nowe audio, więc każdy zapisany przez nie plik audio zawiera Content Credentials, które zapisują utwór jako źródło: WAV, MP3, M4A, Opus, FLAC, każda ścieżka składowa w ZIP ze ścieżkami i nagranie tego, co jest odtwarzane.

- Własne rendery edytora działają w jego prywatnej ramce (klasa wykonania `frame`) i zapisują wersję edytora.
- Render utworzony przez CLI lub link udostępniania działa w klasie `vm` i zapisuje wersję renderera i ziarno.
- WAV podaje też te same informacje w komentarzu RIFF.

Gdy utwór zawiera śpiew, deklaracja AI jest czytelna maszynowo. Typ źródła cyfrowego w poświadczeniu to media złożone utworzone za pomocą wytrenowanych modeli, zapis wymienia śpiewane partie, a jedna deklaracja użycia AI w C2PA na model identyfikuje każdy model, przez który przeszedł śpiew: syntezę mowy Supertonic-3, narzędzie dopasowujące fonemy wav2vec 2.0, koder ContentVec i głos RVC, wraz z repozytorium i commitem, z których Lolly go udostępnia.

### Co zawiera plik MIDI

Plik MIDI to Standard MIDI File w formacie 1. Pierwsza ścieżka zawiera tempo i metrum 4/4, a po niej następuje jedna ścieżka na syntezator, nazwana od syntezatora. Każda nuta zachowuje początek, długość i siłę uderzenia. Syntezator, którego nazwa wskazuje na instrument, na przykład bas, smyczki, pad lub fortepian, otrzymuje odpowiadający mu instrument General MIDI, a nazwa wskazująca na perkusję trafia na kanał 10. Strój inny niż dwunastotonowy jest zaokrąglany do najbliższego półtonu z użyciem pitch bend.

Plik MIDI nie może zawierać ustawień syntezatorów, filtrów, efektów, szyn, sampli ani śpiewu, więc DAW odtwarza nuty własnymi instrumentami. Tempo jest odczytywane z liczby cykli na sekundę utworu, przyjmując jeden cykl za takt o czterech miarach, ponieważ własne metrum utworu nie jest częścią danych zwracanych przez renderer.

Plik MIDI nie ma miejsca na poświadczenie, więc deklarację przenosi zdarzenie tekstowe w pliku, a panel eksportu Cię o tym informuje. Panel opisuje to wszystko przed eksportem. Po każdym eksporcie edytor ponownie odczytuje zapisany plik i raportuje tylko to, co wykrył ten odczyt.

Ogólne informacje o tym, co zapisują Content Credentials, znajdziesz w [Eksporcie pliku](/info/exporting.html#content-credentials-c2pa).
