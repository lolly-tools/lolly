# Piosenki Rondocode

Piosenka rondocode to muzyka napisana jako kod: syntezatory, wzorce i miks, odtwarzane w trakcie pisania. Lolly może odtworzyć piosenkę pod wideo, a utility **Rondocode** pozwala napisać ją i wyeksportować jako audio. Oba zapisują piosenkę w Content Credentials pliku, więc muzyka mówi, skąd pochodzi.

## Odtwarzaj piosenkę w Lolly

Selektor zasobów przyjmuje piosenkę jako plik `.rondo` lub `.rondo.json` albo wklejony link udostępniania `rondocode.com`. Piosenka to kod, który sam tworzy dźwięk, więc gra przez tyle, ile prosi jej klip. Może być **music bed** pod eksportem wideo albo grać w ambientowym odtwarzaczu Neurospicy Mode.

Kod piosenki działa w piaskownicy Lolly, bez sieci i bez dostępu do Twoich plików. Każda część, której render nie potrafi odtworzyć, taka jak mikrofon na żywo, albo śpiew bez modeli głosu, jest wymieniona w szczegółach zasobu.

Z terminala `lolly mix` przyjmuje piosenkę jako całą ścieżkę dźwiękową; zobacz [CLI rendering](/info/cli-rendering.html).

## Napisz i wyeksportuj piosenkę

Otwórz **Rondocode** z **Utilities**, aby napisać piosenkę w żywym edytorze rondocode i słyszeć ją w trakcie pisania. Wyeksportuj ją jako **WAV**, **MP3**, **M4A**, **Opus** lub **FLAC**, jako ZIP ze ścieżkami, jako **MIDI** albo jako nagranie tego, co gra. **Export length** ustawia, ile sekund trwa eksport audio. Sam plik piosenki (`.rondo.json`) to Twój kod tak, jak go napisałeś, i nie niesie niczego dodanego.

Piosenka może śpiewać swoje słowa przez `sing()`. Śpiew powstaje na Twoim urządzeniu przez pobrane modele głosu, a plik zawierający syntetyczny śpiew zawsze deklaruje ten śpiew jako wygenerowany przez AI (zobacz [AI features](/info/ai-features.html)).

## Piosenki w poświadczeniu

Eksport wideo lub audio, który odtwarza piosenkę rondocode, zapisuje każdą piosenkę w swoich Content Credentials jako źródło:

- nazwę piosenki;
- SHA-256 jej pliku `.rondo.json`;
- jak została wyrenderowana: w piaskownicy Lolly, klasa wykonania `vm`, z wersją i ziarnem renderera oraz każdą częścią, której render nie potrafił odtworzyć.

Muzyka obliczona z kodu piosenki jest oznaczona jako medium algorytmiczne, więc Verify nie oznacza jej jako AI. Przed eksportem linia pod **Download** wymienia piosenki, które zapisze poświadczenie; po eksporcie ta sama linia zgłasza, co znalazł odczyt dostarczonego pliku. Odznacz **C2PA Credentials**, aby pominąć zapis. Obraz nieruchomy nie zapisuje piosenki, ponieważ nie niesie dźwięku. `lolly mix` i [serwer MCP](/info/mcp.html) zapisują ten sam zapis.

## Pliki z utility Rondocode

Większość utility na urządzeniu nie zapisuje poświadczenia, ponieważ przekształcają plik, który już posiadasz. Rondocode tworzy nowe audio, więc każdy zapisany przez niego plik audio niesie Content Credentials, które zapisują piosenkę jako źródło: jej nazwę, SHA-256 jej pliku `.rondo.json` i miejsce, w którym działał jej kod. Obejmuje to WAV, MP3, M4A, Opus, FLAC, każdą ścieżkę w ZIP ze ścieżkami i nagranie tego, co gra.

- Własne rendery edytora działają w jego prywatnej ramce (klasa wykonania `frame`) i zapisują wersję edytora.
- Render wykonany przez CLI lub link udostępniania działa w klasie `vm` i zapisuje wersję renderera i ziarno.
- WAV podaje to samo także w swoim komentarzu RIFF.
- Muzyka obliczona z kodu piosenki jest medium algorytmicznym i nie jest oznaczana jako AI.

Gdy piosenka śpiewa, plik deklaruje ten śpiew jako wygenerowany przez AI w formie czytelnej maszynowo. Cyfrowy typ źródła poświadczenia to media złożone wykonane z użyciem wytrenowanych modeli, zapis wymienia śpiewane części, a jedno ujawnienie AI C2PA na model identyfikuje każdy model, przez który przeszedł śpiew: zamianę tekstu na mowę Supertonic-3, aligner fonemów wav2vec 2.0, koder ContentVec i głos RVC, z repozytorium i commitem, z którego Lolly je hostuje. Plik zawierający syntetyczny śpiew nigdy nie jest zapisywany bez tej deklaracji.

Plik MIDI nie ma miejsca na poświadczenie, więc zamiast tego oświadczenie niesie zdarzenie tekstowe w pliku, a panel eksportu o tym mówi. Panel opisuje to wszystko przed eksportem, a po każdym eksporcie edytor odczytuje zapisany plik z powrotem i zgłasza tylko to, co znalazł ten odczyt.

Ogólnie o tym, co zapisują Content Credentials, zobacz [Export a file](/info/exporting.html#content-credentials-c2pa).
