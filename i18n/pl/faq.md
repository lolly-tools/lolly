# FAQ

Najczęściej zadawane pytania wyświetlane w akordeonie na stronie startowej `/info`.

**Jak to utrzymywać:** każdy nagłówek `##` poniżej to pytanie; wszystko pod nim
(aż do następnego `##`) jest odpowiedzią. Odpowiedzi korzystają z tego samego lekkiego markdownu co
reszta strony - akapity rozdzielaj pustą linią. Dodawaj, usuwaj lub
zmieniaj kolejność pytań tutaj, a potem uruchom ponownie `npm run build:info` (albo `npm run dev:web`).
Wszystko powyżej pierwszego `##` (ten tytuł i te notatki) jest pomijane przez build.

## Co się dzieje, gdy wyrażę zgodę na stronie /profile?

Gdy zaczynasz korzystać z Lolly, wszystko, co gdziekolwiek wpisujesz, jest w pełni prywatne, dopóki świadomie nie zechcesz wypuścić tych informacji na zewnątrz przez plik albo link do udostępnienia (jeśli jesteś online).

Po włączeniu zgody wybrane przez ciebie dane profilu są zapieczętowane w tym, co tworzysz, i wskazują ciebie jako źródło. Nic nie trafia do środka, jeśli sam tego nie wybierzesz.

Lolly tworzy duże ilości treści. Stosujemy ścisłą minimalizację danych, żeby ograniczyć ryzyko.

## Czy Lolly została "vibe codowana"?

Lolly powstała dzięki kodowaniu wspomaganemu przez AI, odkrywaniu wspomaganemu przez AI oraz, w wielu miejscach, treściom wspomaganym przez AI, z wykorzystaniem różnych modeli i dostawców, w tym czołowych firm z obszaru publicznej chmury.

W chwili pisania tego tekstu Lolly nie zawiera żadnych znanych luk bezpieczeństwa w swoim łańcuchu dostaw i zobowiązuje się do szybkiej reakcji na incydenty bezpieczeństwa, gdy pojawiają się CVE.

Człowiek stworzył architekturę, świadomie wyselekcjonował kod i pokierował stroną artystyczną doświadczenia.

Co najważniejsze, Lolly opiera się na dziesięcioleciach innowacji open source tworzonych przez prawdziwych ekspertów na całym świecie.

W kodzie źródłowym Lolly istnieje deterministyczna bramka budowania, która utrzymuje spójność kodu i dokumentacji dla przeciętnego czytelnika i "odbadziewia" doświadczenie. Może to utrudniać zastrzeżone, syntetyczne ustalanie pochodzenia. Nie jest to zamierzone.

**Ujawnienie użycia generatywnej AI:**

- **Kod napisany przez LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (ta lista może się rozszerzyć)
- **Odkrywanie przez LLM:** Gemini 3.1, Fable
- **Dokumentacja:** Sonnet 5
- **Biblioteki open source:** ich odpowiedni autorzy, wskazani w SBOM, komentarzach i nagłówkach plików

Ta lista nie obejmuje modeli dołączonych (vendored) do Lolly.

**Wkład ludzki:**

- **Architektura:** Andy Fitzsimon
- **Kierownictwo artystyczne:** Andy Fitzsimon
- **Kod napisany przez człowieka:** Andy Fitzsimon
- **Koncepcja, przegląd i opinie:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, społeczność Penpot (lista niepełna)

## Czym są flagi funkcji?

Flagi funkcji włączają i wyłączają części Lolly. Zwykle steruje nimi administrator - w Lolly sterujesz nimi ty.

![Każda flaga funkcji to przełącznik należący do ciebie, umieszczony w twoim profilu, a nie w konsoli administratora](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Jak zdobyć aplikację mobilną albo desktopową?

Każdy może dystrybuować własne aplikacje, a narzędzia i konfiguracja takich aplikacji powinny się mocno różnić w zależności od tego, dla kogo są przeznaczone. Nie ma więc jednej aplikacji, chyba że sam ją zrobisz albo dostaniesz ją od kogoś, kogo to dotyczy.

## Skąd nazwa "Lolly Tools"?

**Lolly** dlatego, że wolność jest słodka, i dlatego, że w Australii, Nowej Zelandii i Wielkiej Brytanii "lolly" to cukierek.

**Tools** dlatego, że narzędzie leży bez ruchu, dopóki go nie weźmiesz do ręki. Nie działa, kiedy z niego nie korzystasz, i nie obserwuje cię, kiedy korzystasz.

## Jakich przeszkód mogę się spodziewać przy wdrażaniu Lolly?

Lolly wpasowuje się wszędzie tam, gdzie już generujesz pliki - CLI to ten sam silnik
co aplikacja, więc pipeline uruchomiony o drugiej w nocy nie może się rozjechać z tym, co ktoś ogląda w
przeglądarce. Opór przed wdrożeniem rzadko jest techniczny; jest organizacyjny. Spodziewaj się tego:

**Ktoś musi opracować wyselekcjonowany katalog marki.** Lolly to platforma, a nie
gotowy pakiet twoich szablonów. Przy *zarządzanym wdrożeniu* ktoś definiuje wspólny
katalog zasobów (logo, palety, fonty jako trwałe identyfikatory) i pisze manifest +
szablon dla każdego typu wyniku. Osoby prywatne nie muszą jednak na to czekać - w
otwartej aplikacji każdy może wgrać własne pliki do katalogu i budować narzędzia w
Design od pierwszego dnia.

**Do współtworzenia nie jest potrzebny git.** Projektanci tworzą własne narzędzia i szablony
w aplikacji, a potem udostępniają je współpracownikom albo zgłaszają je osobie odpowiedzialnej za
wdrożenie, żeby weszły do zestawu domyślnego.

**To celowo wąskie narzędzie - tak je przedstawiaj.** Lolly nie służy do treści szytych na miarę ani
flagowych. Jest za to twoim osobistym DAM - zasilanym i wzmocnionym przez twój system
projektowy, narzędzia i katalog - i owszem, ma otwarte płótno (Design), ale
nawet tam kolory, typografia i zasoby trzymają się aktywnych ustawień globalnych, więc swobodne
układanie zostaje w ramach systemu. Oceniane wobec Figmy czy Canvy będzie wyglądać
na ograniczone. Oceniane jako to, czym jest - zoperacjonalizowane, powtarzalne generowanie zasobów
na ogromną skalę - nie ma konkurencji. Złe ujęcie tematu to najczęstsza przeszkoda.

**Zarządzanie zmianą po stronie produkcji.** Istniejące procesy działają już dziś, nawet jeśli
wynik jest niezgodny z marką. Przestawienie ich na silnik oznacza ponowne testy i naukę od nowa,
a "przecież już umiemy robić pliki" staje się wymówką, żeby nie migrować. Zacznij od przeniesienia
jednego dobrze widocznego materiału o jakości produkcyjnej i pokaż stan przed i po obok siebie.

Lolly podnosi poziom wszystkiego.


## Czym narzędzia użytkowe różnią się od narzędzi?

**Prosta odpowiedź →** Narzędzia użytkowe nie zawsze muszą coś renderować, więc mogą dostać inny interfejs. 

**Prawdziwa odpowiedź →** Narzędzia użytkowe da się hostować wewnątrz Lolly Tools po to, żeby dołożyć kolejną 'warstwę wygody' w obronie zniechęcającej do wyprowadzania danych. 

Dlaczego? Bo wiadomo, że codziennie ludzie biorą **poufne treści, które już mają**, i oddają je
przypadkowej stronie, żeby wykonała jedną drobną, mechaniczną operację:

- "**Skompresuj ten PDF**" → wysyła umowę / pasek płacowy / prezentację dla zarządu nieznanym podmiotom.
- "**przekonwertuj HEIC na JPG**" → wysyła prywatne zdjęcia (z GPS w EXIF) na serwis utrzymywany z reklam
- "**przytnij / zmień rozmiar tego obrazu**" → wysyła zrzut produktu albo niewydany zasób
- "**sformatuj ten JSON**" / "zdekoduj ten JWT" → wkleja odpowiedzi API, tokeny, sekrety do formatera
- "**scal te PDF-y**" → wysyła **dwa dokumenty, które nigdy nie powinny trafić na jeden serwer**

Te strony i ich ogromny ogon klonów **domyślnie nie są godne zaufania**:
nieznany okres przechowywania, nieznane jurysdykcje, nieznani podprocesorzy i model biznesowy oparty na
reklamach i afiliacji, który ma wszelkie powody, żeby zatrzymać to, co im dasz. Sama operacja jest
błaha; **kosztem jest treść.** 

Wojnę o ład wygrywamy znakomitą wygodą i obsługą. 

![Widok Utilities zbiera mechaniczne zadania, które ludzie zwykle oddają przypadkowym stronom, a które tutaj wykonują się wewnątrz Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Czy Lolly potrafi edytować i renderować moje pliki z Figmy, Penpota, Illustratora albo InDesigna?

Tak. Otwórz **Design** i kliknij **Import a design**: przyjmuje natywny plik Figmy **.fig** (Save local copy), eksport Penpota **.penpot**, plik Illustratora **.ai** lub **.pdf**, plik InDesigna **.idml** (File → Export → InDesign Markup) albo **dowolny SVG** (szeroko otwarte drzwi - eksportuje go niemal każdy program graficzny). Nie potrzeba konta, wtyczki ani licencji na program graficzny.

![Otwarte płótno Design - Importowanie projektu znajduje się w menu Lolly na pasku narzędzi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Warstwy trafiają na otwarte płótno jako edytowalne bloki: tekst nadal da się przepisać, kształty pozostają kształtami, obrazy dołączają do twojej biblioteki obrazów, a typografia i kolory trzymają się ustawień globalnych marki. Zapisz układ, a stanie się on szablonem wielokrotnego użytku z własnym adresem URL, który każdy, kto ma Lolly, może wypełnić na nowo - możesz też wpleść w niego żywe narzędzia (kod QR, wykres), które renderują się ponownie przy wczytaniu. Dalej renderuje się jak wszystko inne w Lolly - SVG, PDF, PNG i reszta, odtwarzalne z adresu URL. Zobacz [Import a design](/info/design-import.html).

## Czy mogę udostępnić swoją pracę jako plik zamiast linku?

Tak. Kiedy link nie jest w stanie unieść wszystkiego (twoich własnych zdjęć, długiego tekstu), okno Share dokładnie mówi, czego by zabrakło, i proponuje w zamian plik **.lolly**: jeden plik z projektem, używanymi w nim obrazami i, jeśli chcesz, samym narzędziem. To ty decydujesz, ile z tego wyrusza w drogę - twoje imię i dane trafiają tam tylko wtedy, gdy zgodzisz się na to w profilu, licencjonowane grafiki zostają na miejscu, chyba że sam je dołączysz, a każdy, kto otworzy plik z narzędziem, jest pytany, czy mu ufa, zanim narzędzie się uruchomi. Zobacz [Udostępnianie swojej pracy](/info/using.html#sharing-your-work).

## Czy dwie osoby mogą pracować nad tym samym projektem bez internetu?

Tak. Jedna osoba udostępnia zaproszenie (link, kod QR albo krótki kod), druga je przyjmuje i oba urządzenia trzymają tę samą sesję na żywo - z obecnością, obwódkami fokusu i całą resztą. Działa w dowolnej wspólnej sieci, także na hotspocie z telefonu w piwnicy, bo pośrodku nie ma żadnego serwera. Zobacz [Wspólna praca](/info/collaborate.html).

## Gdzie podziały się narzędzia z marką SUSE?

Są już w osobnym, prywatnym repozytorium. Publiczny klon w ogóle nie pobiera pakietu marki SUSE, więc publiczny build działa na neutralnym profilu `lolly-start` - narzędziach społecznościowych niezwiązanych z żadną marką plus pustej marce, którą wypełniasz własną. SUSE prowadzi własną instancję, żeby chronić swoje znaki towarowe.

## Dlaczego to jest darmowe? Gdzie haczyk?

**Zbudowaliśmy Lolly dla siebie.** SUSE potrzebowało tysięcy plików zgodnych z marką, każdego z zapieczętowaną w środku nazwą, tworzonych bez oddawania czegokolwiek zewnętrznym usługom. Zbudowaliśmy więc narzędzie, które robi to wszystko na urządzeniu, i wydaliśmy je jako open source, tak jak wszystko inne, co robimy. Utrzymujemy je dalej, bo korzystamy z niego codziennie. **Nie ma tu żadnego zobowiązania:** wszystko tutaj działa z nami i bez nas.

Ta granica jest wyznaczona licencją, a nie obietnicą: wszystko, co działa lokalnie, jest darmowe na zawsze. Wydana wersja ma licencję, której nie da się cofnąć, i nie ma umowy dla współtwórców, która mogłaby zmienić licencję czyjejś pracy. Pełne stanowisko znajdziesz w [pozycjonowaniu](/info/positioning.html).

## Ile SUSE zatrzymuje dla siebie? (czyli kiedy wyciągną nam dywan spod nóg)

Silnik, powłoki, schematy i narzędzia niezwiązane z marką są open source; prywatne zostają znaki towarowe SUSE i narzędzia z jego marką, i są już wydzielone. Publiczna instancja pod adresem [lolly.tools](https://lolly.tools) działa na neutralnej marce.

Ta granica wynika ze struktury, a nie z obietnicy. Każda wydana wersja jest open source i nie da się jej cofnąć, nie ma umowy dla współtwórców, która mogłaby zmienić licencję czyjejś pracy, a jedyne, co jest zatrzymane, to znak towarowy. Kiedy w 2023 roku inna firma zamknęła źródła swojego korporacyjnego Linuksa, SUSE współzałożyło [OpenELA](https://openela.org), żeby ten kod pozostał otwarty - ten projekt dziedziczy dokładnie tę postawę.

Dla pełnej jasności: SUSE *rzeczywiście* buduje wewnętrzne narzędzia, żeby zintegrować Lolly ze swoimi systemami IT - dotyczy to wewnętrznej konfiguracji SUSE, a nie podziału na rozwój publiczny i prywatny. Lolly ma też być budowane przez [Open Build Service](https://openbuildservice.org/), a bezpieczne artefakty łańcucha dostaw ma dostarczać [SUSE Application Collection](https://apps.rancher.io/applications).

## Jaki smak ma to logo Lolly?

Jedni mówią, że limonka, inni że mięta, a czasem że jabłko - Lolly wnosi słodycz, a smak tworzysz ty!
