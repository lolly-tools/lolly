# Polityka prywatności

*Ostatnia aktualizacja: 11 sierpnia 2026*

> **Krótka wersja.** Dokumenty, obrazy, filmy i pliki, które tworzysz w Lolly, zostają
> na Twoim urządzeniu. Nie ma kont do zwykłego użytku, nie ma ciasteczek z samej
> aplikacji ani żadnej analityki czy trackerów nigdzie w kodzie źródłowym - to nie jest
> "nie używamy tych danych", naprawdę ich tam nie ma. Istnieje krótka, pełna lista
> wyjątków tam, gdzie oprogramowanie w ogóle łączy się z siecią, i każdy z nich jest
> opisany poniżej ze szczegółami: co wychodzi, do kogo i kiedy. Jedynym wyjątkiem
> dotyczącym czegokolwiek osobistego jest logowanie, które musisz jawnie rozpocząć.
> Jeśli czegoś nie ma w tym dokumencie, to się nie dzieje.

## Co obejmuje ta polityka

Lolly to oprogramowanie open source - silnik, kilka powłok aplikacji (web, desktop,
mobile, CLI) oraz rozszerzenie przeglądarki - które każdy może uruchomić. Ta polityka
składa się z dwóch części:

- <!--i:code--> **Samo oprogramowanie**: co robi, a czego nie robi z twoimi danymi, niezależnie
  od tego, gdzie działa. To cecha kodu, więc dotyczy każdego wdrożenia Lolly,
  naszego i cudzego.
- <!--i:server--> **lolly.tools**, wdrożenie referencyjne prowadzone przez SUSE: konkretne decyzje
  dotyczące działania jego opcjonalnych elementów po stronie serwera (co jest
  logowane, jak długo i przez kogo).

Jeśli korzystasz z instancji Lolly hostowanej samodzielnie lub firmowej, poniższe
zachowanie oprogramowania nadal obowiązuje, ale *operator* tej instancji - nie SUSE -
odpowiada za wszystko po stronie serwera: swój punkt końcowy renderowania, swój
serwer MCP, swój urząd certyfikacji Content Credentials, jeśli taki prowadzi. Poproś
go o jego własną politykę. Zobacz [Wdrożenie i zarządzanie](/info/adoption-governance.html),
aby dowiedzieć się, co wiąże się z prowadzeniem Lolly.

## Aplikacja: co zostaje na twoim urządzeniu

Powłoki web, desktop i mobile Lolly uruchamiają cały silnik renderowania po stronie
klienta. Otwieranie narzędzia, wypełnianie pól, podgląd i eksport - wszystko to
odbywa się na twoim urządzeniu - żaden serwer nie bierze w tym udziału, a aplikacja
działa offline po jednorazowym wczytaniu.

**Aplikacja nie ustawia żadnych plików cookie.** Aby działać, przechowuje niewielką
ilość danych **wyłącznie na twoim urządzeniu**, nigdy nie przesyłanych dalej:

- <!--i:sliders--> **Preferencje interfejsu** - motyw, język, ustawienia dźwięku, rozmiar paska
  bocznego/powiększenia, wybory sortowania i widoku, które wskazówki wdrożeniowe już
  widziałeś - w `localStorage`, więc są dostępne, zanim aplikacja skończy się uruchamiać.
- <!--i:download--> **Offline'owy cache katalogu narzędzi i podglądów zasobów**, dzięki czemu
  galeria działa bez połączenia.
- <!--i:hash--> **Lokalne liczniki użycia** dla statystyk na karcie profilu (ile eksportów,
  jakie narzędzia) - niewielki, ograniczony blok danych w `localStorage`, nigdy nie
  odczytywany przez nas ani nigdzie nie wysyłany.
- <!--i:folder--> **Twoje własne dokumenty, zapisane sesje, przesłane zasoby i czcionki** -
  przechowywane w IndexedDB na twoim urządzeniu, nigdy nie przesyłane, nigdy nie
  odczytywane przez nikogo poza tobą.

Nic z tego nie jest udostępniane, sprzedawane ani wykorzystywane do identyfikowania
czy śledzenia cię. Nie ma na co wyrażać zgody, ponieważ nie zachodzi żadne zbieranie
danych - jest tylko ta informacja, żebyś wiedział, co jest przechowywane i gdzie.
Usuń to wszystko w dowolnej chwili za pomocą **Profile → Clear all my data**, lub
czyszcząc pamięć strony w przeglądarce. (Zgodnie z dyrektywą ePrivacy, art. 5(3),
przechowywanie ściśle niezbędne do świadczenia usługi, o którą poprosiłeś, nie wymaga
zgody - jedynie przejrzystości, którą zapewniają zarówno ten dokument, jak i
powiadomienie w aplikacji.)

![Sekcja przechowywania danych na stronie profilu na ekranie o szerokości telefonu: każda kategoria danych na urządzeniu nazwana, z przyciskiem Clear all my data tuż obok](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Twoja własna kopia zapasowa tych danych - paczka `lolly-backup` tworzona przez
**Export my data & render everything** - to plik, który przechowujesz i kontrolujesz
ty sam. Nigdy nie trafia na nasze serwery, chyba że sam zdecydujesz się gdzieś ją
wysłać. Zobacz [Przesyłanie danych](/info/data-transfer.html).

## Narzędzia działające na urządzeniu

Niektóre narzędzia - **Strip Hidden Data**, **Compress PDF** i inne oznaczone
plakietką **"Runs on your device"** - działają na pliku, który im dostarczasz. Plik
jest wczytywany do pamięci w przeglądarce, przekształcany lokalnie i oddawany z
powrotem jako plik do pobrania. Nigdy nie jest przesyłany, ponieważ na tej ścieżce
nie ma żadnego serwera, do którego można by go przesłać. Te narzędzia działają
offline, a ich wynik nie zawiera żadnego naszego znaku wodnego ani metadanych - celem
większości z nich jest usuwanie i ochrona danych, a nie dodawanie ryzyka.

![Plakietka, którą noszą te narzędzia: Runs on your device - nic nie jest przesyłane](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Kiedy aplikacja komunikuje się z siecią - pełna lista

Poniższa tabela to pełna lista wszystkiego, co aplikacja pobiera lub wysyła przez
sieć. Jeśli czegoś tu nie ma, aplikacja tego nie robi.

| Co | Co faktycznie opuszcza twoje urządzenie | Kiedy (czynność, która to wyzwala) | Jeśli operator to zablokuje |
|---|---|---|---|
| Synchronizacja katalogu narzędzi | Nic osobistego - zapytanie o publiczny indeks narzędzi i zasobów samej Lolly, do własnego źródła aplikacji | Przy starcie, potem buforowane offline | Aplikacja działa na swoim zbuforowanym zestawie narzędzi. Przestaje jedynie wykrywać nowe narzędzia |
| Narzędzie wymagające danych na żywo | To, o co poprosi konkretne narzędzie, do hosta wskazanego w jego własnym opisie. Obecnie jest to tylko wyszukiwanie miasta w narzędziu Meeting Planner, które pyta `geocoding-api.open-meteo.com` o zamianę nazwy miasta na współrzędne i strefę czasową - bez konta, klucza czy jakiegokolwiek identyfikatora poza samym zapytaniem. Pole wejściowe informuje o tym dokładnie tam, gdzie wpisujesz tekst, a każda odpowiedź jest zapisywana na twoim urządzeniu, więc miasto jest wyszukiwane tylko raz | Tylko podczas korzystania z tego narzędzia i tylko po wpisaniu lokalizacji | To jedno wyszukiwanie zawiedzie. Nadal możesz wpisać współrzędne ręcznie, a nic innego nie zostaje naruszone |
| Google Fonts | Nazwa wybranej rodziny czcionek oraz twój adres IP, do serwerów czcionek Google (`fonts.googleapis.com` dla arkusza stylów, `fonts.gstatic.com` dla pliku czcionki) | Tylko jeśli dodasz czcionkę Google w edytorze marki **i tylko po zaakceptowaniu tego w oknie dialogowym o dokładnie takiej treści** - jednorazowe pobranie na rodzinę czcionek, potem plik pozostaje na twoim urządzeniu i jest używany offline | Selektor Google Fonts zawodzi bezpiecznie (fail closed). Zamiast tego prześlij plik czcionki |
| Wyślij do Google Drive | Jeden plik, który wybrałeś do wysłania, do interfejsu API Google Drive (`www.googleapis.com`), po zalogowaniu się w Google we własnym wyskakującym oknie Google. Dostęp Lolly jest ograniczony do plików, które sama utworzyła (zakres `drive.file` - nigdy nie może odczytać reszty twojego Dysku), a token logowania jest przechowywany w pamięci tylko na czas sesji, nigdy zapisywany na stałe | Tylko gdy klikniesz "Send to Google Drive" przy eksporcie EMF, i tylko w wersjach, w których operator skonfigurował identyfikator klienta Google - bez niego przycisk nie istnieje | Przycisk nigdy się nie pojawia. Pobierz plik i sam prześlij go na Dysk |
| Wyślij do Dropbox | Jeden plik, który wybrałeś do wysłania, do interfejsu API Dropbox (`api.dropboxapi.com` dla logowania i metadanych, `content.dropboxapi.com` dla samego pliku), po zalogowaniu się w Dropbox we własnym oknie Dropbox. Dostęp Lolly ogranicza się do folderu aplikacji (widzi wyłącznie `Apps/` i swój własny folder w nim - nigdy resztę twojego Dropboksa), pokazywany link "Open" jest krótkotrwałym linkiem prywatnym (nie tworzy się żadne publiczne udostępnienie), a token odświeżania jest zapisywany tylko wtedy, gdy zaznaczysz "stay connected" | Tylko gdy klikniesz "Send to Dropbox" przy pliku, i tylko w wersjach, w których operator skonfigurował identyfikator klienta Dropbox - bez niego przycisk nie istnieje | Przycisk nigdy się nie pojawia. Pobierz plik i sam prześlij go do Dropboksa |
| Wyślij do OneDrive | Jeden plik, który wybrałeś do wysłania, do usług tożsamości i Graph firmy Microsoft (`login.microsoftonline.com` dla logowania, `graph.microsoft.com` dla przesyłania; duży plik jest przesyłany w częściach na adres przesyłania należący do Microsoftu, pod `api.onedrive.com`, `*.up.1drv.com` lub `*.sharepoint.com`), po zalogowaniu się w Microsoft we własnym oknie Microsoftu. Dostęp Lolly jest ograniczony do jej własnego folderu pod `Apps/` (nigdy nie może odczytać reszty twojego OneDrive) oraz twojej nazwy wyświetlanej do etykiety konta, a token odświeżania jest zapisywany tylko wtedy, gdy zaznaczysz "stay connected" | Tylko gdy klikniesz "Send to OneDrive" przy pliku, i tylko w wersjach, w których operator skonfigurował identyfikator klienta Microsoft - bez niego przycisk nie istnieje | Przycisk nigdy się nie pojawia. Pobierz plik i sam prześlij go do OneDrive |
| Wyślij do LinkedIn | Jeden plik, który wybrałeś do wysłania, wraz z jego nazwą jako treścią posta, do LinkedIn (`www.linkedin.com` dla logowania, `api.linkedin.com` dla przesyłania i publikacji), po zalogowaniu się w LinkedIn we własnej przeglądarce. Post trafia na twój własny profil jako post publiczny pod twoim nazwiskiem. Lolly może publikować w twoim imieniu i odczytać twoją nazwę do etykiety konta, nic więcej z twojego LinkedIn, a logowanie jest zachowywane na tym urządzeniu tylko wtedy, gdy zaznaczysz "stay connected" - tokeny LinkedIn są ważne 60 dni i nie mogą być odnawiane po cichu, więc wygasają same | Tylko gdy klikniesz "Send to LinkedIn" przy pliku, wyłącznie w aplikacjach desktopowych, i tylko w wersjach, w których skonfigurowano aplikację LinkedIn - bez niej przycisk nie istnieje | W aplikacji webowej nie ma nic do zablokowania: ta funkcja istnieje **wyłącznie w aplikacjach desktopowych**, więc te dwa hosty są celowo pominięte w polityce Content-Security-Policy aplikacji webowej poniżej. W aplikacjach desktopowych usuń skonfigurowaną aplikację LinkedIn, a przycisk przestanie się pojawiać |
| Profile drukarskie ICC | Nic osobistego - zapytanie o standardowy profil warunków druku, do publicznego rejestru ICC (`registry.color.org`, `www.color.org`) | Tylko gdy klikniesz gotowy profil ICC w menedżerze profili druku - jednorazowe pobranie na profil, potem plik pozostaje na twoim urządzeniu | Gotowe profile ICC zawodzą. Zamiast tego dostarcz własny profil `.icc` |
| Radio internetowe | Nic osobistego - zapytanie o playlistę i strumień audio, do stacji (`api.somafm.com` oraz wskazany przez nią serwer icecast, `*.somafm.com`) | Tylko podczas odtwarzania opcjonalnego wbudowanego radia w odtwarzaczu dźwięku | Radio zawodzi. Każda inna funkcja dźwiękowa nadal działa |
| Adres URL, który zlecasz narzędziu do przechwycenia | Zapytanie do dokładnie tego adresu, który wpiszesz, wysyłane przez narzędzie do zrzutów URL. Bez względu na to, jaki to adres. Ten host nie znajduje się w polityce poniżej, ponieważ wybierasz go w chwili użycia | Tylko gdy wpiszesz URL w tym narzędziu i uruchomisz przechwytywanie | Operator nie może umieścić tego na białej liście według hosta. Aby to usunąć, trzeba usunąć narzędzie |
| Weryfikacja podpisu SEAL | **Nic.** Aplikacja webowa w ogóle nie ma resolvera DNS - patrz niżej | Nigdy | Nic do zablokowania |
| Modele AI na urządzeniu | Nic osobistego - jednorazowe pobranie pliku modelu z hosta modeli Lolly (`lolli.li`), potem zbuforowane na twoim urządzeniu; bez konta, bez identyfikatora, tylko samo zapytanie i twój adres IP | Tylko gdy korzystasz z funkcji wymagającej modelu (dogłębne skanowanie Verify, powiększanie obrazu, mowa i podobne) | Ta funkcja czeka na pobranie; wszystko inne nadal działa |
| Zdalna instancja | To, co odeśle instancja, którą wskażesz, w ramach tej samej synchronizacji katalogu opisanej wyżej - plus znacznik wersji dołączany do zapytań do niej (rodzaj powłoki i wersja silnika, ta sama informacja, jaką niesie user agent), dzięki czemu operator widzi, jakie wersje Lolly są w użyciu. W instancji zarządzanej, gdy jesteś zalogowany, ten znacznik niesie też identyfikator instalacji dla danego urządzenia, dzięki czemu lista urządzeń operatora może odróżnić tę instalację od innych. Znacznik podpina się wyłącznie pod zapytania, które i tak generuje twoje własne użycie - nie ma żadnego licznika czasu i nic nie "dzwoni do domu" - a opuszczenie instancji usuwa ten identyfikator, więc urządzenie, które połączy się ponownie później, przedstawia nowy. Host wybierasz w chwili użycia, więc nie znajduje się w polityce poniżej | Tylko jeśli wyraźnie wskażesz powłoce inne wdrożenie Lolly | Przełączanie instancji zawodzi. Twoja lokalna instancja pozostaje nienaruszona |

Każdy stały host w tej tabeli jest też pełną listą dozwolonych adresów w polityce Content-Security-Policy aplikacji, którą egzekwuje przeglądarka. Ta lista nie jest więc tylko opisem tego, co robi dziś kod - to granica, do której przeglądarka trzyma aplikację: przyszła zmiana, która próbowałaby skontaktować się z innym hostem, zostałaby zablokowana, a nie po cichu dopuszczona. Jeden wiersz to celowy wyjątek i jego własna komórka to mówi: Send to LinkedIn istnieje wyłącznie w aplikacjach desktopowych, więc polityka aplikacji webowej nie wymienia żadnego z jej hostów - aplikacja webowa nie mogłaby ich osiągnąć, nawet gdyby jej kod próbował. Dwa kolejne wiersze nie mają stałego hosta, ponieważ adres wybierasz w chwili użycia: URL, który zlecasz narzędziu do przechwycenia, oraz zdalna instancja, którą wskazujesz powłoce. Żaden z nich nie znajduje się w polityce, a każdy zdarza się tylko wtedy, gdy wpiszesz adres i go użyjesz. Wdrożenie, które nie chce żadnej z opcjonalnych pozycji (na przykład instancja korporacyjna z własnymi czcionkami), usuwa te hosty ze swojej polityki, a odpowiednie funkcje zawodzą bezpiecznie (fail closed), zamiast łączyć się na zewnątrz.

Żadna z tych operacji nigdzie nie wysyła twoich dokumentów, projektów, sesji ani
przesłanych plików. Istnieją po to, by przynosić rzeczy *do* twojego urządzenia
(narzędzia, czcionki, modele), nigdy by wysyłać rzeczy *z* niego - z wyjątkami
wymienionymi wprost w poniższych sekcjach.

**Uwaga o tym, co usunęliśmy.** Verify potrafi sprawdzać podpisy SEAL - schemat, w
którym klucz podpisujący pliku jest publikowany w DNS. Przeglądarki nie mogą
wykonywać zapytań DNS, więc każda implementacja webowa musi kierować wyszukiwanie
przez resolver DNS-over-HTTPS należący do strony trzeciej - co ujawniłoby temu
operatorowi sprawdzaną domenę oraz twój adres IP. Kiedyś używaliśmy resolvera
Cloudflare. **Już go nie używamy i nie ma żadnego zamiennika**: aplikacja webowa nie
przekazuje teraz żadnego resolvera, więc weryfikacja SEAL nie wykonuje tu żadnych
zapytań sieciowych. Pliki, których rekord SEAL zawiera klucz w treści, nadal
weryfikują się całkowicie offline. Pliki, których klucz znajduje się w DNS, zgłaszają
zamiast tego "no key resolver", a możesz je sprawdzić w aplikacji desktopowej lub
wierszu poleceń, które rozwiązują DNS natywnie przez twoją własną maszynę, bez
udziału żadnej strony trzeciej.

![Ekran Verify: cel przeciągnięcia i nic więcej - plik jest sprawdzany tam, gdzie już się znajduje, bez przesyłania i bez konta](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Możesz to sam potwierdzić: sprawdzalne za pomocą grep testy dla tego i każdego
innego twierdzenia na tej stronie, z dokładnymi poleceniami i oczekiwanym wynikiem,
znajdziesz na stronie [Verify It Yourself](/info/verify-yourself.html).

## Bezpośrednio linkowane adresy URL renderowania

> **Aktywne na lolly.tools.** Każdy adres
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` renderuje się naprawdę, a
> dane wejściowe podróżują razem z tym adresem URL. Poniższa sekcja wyjaśnia,
> co to oznacza dla Ciebie, a operator może wyłączyć tę funkcję na swojej
> własnej instancji.

Sama aplikacja pozostaje w całości na twoim urządzeniu. Niezależnie od tego operator
może włączyć **bezpośrednio linkowane adresy URL renderowania** - `/tool/<tool-id>.<ext>?<inputs>` -
dzięki czemu udostępniony link Lolly może pojawić się jako żywy obraz w README, wiki
lub dashboardzie. Pobranie takiego linku prosi serwer o wyrenderowanie **publicznych
danych narzędzia i katalogu** z parametrami wpisanymi w adres URL.

- <!--i:usercheck--> **Brak kont, brak ciasteczek, brak stanu.** Punkt końcowy jest anonimowy, a nic
  na Twoim urządzeniu nie jest odczytywane. Twoje dokumenty, sesje i przesłane pliki nigdy nie opuszczają
  Twojej przeglądarki - nie mogą się w ogóle pojawić w tych linkach.
- <!--i:document--> **Ale sam adres URL jest rejestrowany.** Ciąg zapytania URL jest częścią linii
  żądania, więc pojawia się w zwykłych logach dostępu platformy hostingowej tak samo jak
  każda żądana ścieżka. Jeśli dane wejściowe linku zawierają czyjeś imię lub e-mail -
  identyfikator na plakietce, podpis w e-mailu - **ten tekst trafia do tych logów**, i żadne
  sformułowanie polityki tego nie zmieni. Dlatego adres hot-link to złe miejsce na dane
  osobowe: podawaj w nim tylko to, co umieściłbyś na publicznej stronie.
- <!--i:globe--> **Dane wejściowe są z natury publiczne** i tak - to cokolwiek autor linku
  wpisał w adres URL, czytelne dla każdego, do kogo link dotrze. Nie umieszczaj
  sekretów we współdzielonym linku. Lolly oferuje szyfrowanie linków dla wrażliwych treści.
- <!--i:eyeoff--> Odpowiedzi są **buforowane i ograniczane częstotliwościowo** jak każdy publiczny obraz, i oznaczone
  jako `noindex`, więc wyszukiwarki nie indeksują Twoich renderów.

Hostujesz Lolly samodzielnie i nie chcesz publicznej powierzchni renderowania?
Ustaw `LOLLY_DISABLE_RENDER_GET=1`,
a każdy z tych adresów URL zwróci 404.

## Serwer MCP (opcjonalny, dla agentów AI)

Do Lolly może dotrzeć również agent AI za pomocą protokołu Model Context Protocol -
punktu końcowego prowadzonego przez operatora (lolly.tools prowadzi jeden; każdy
może hostować własny, w tym całkowicie odizolowany od sieci). Podziela on postawę
"brak kont" ścieżki renderowania, plus trzy narzędzia, które z natury operują na
bajtach plików:

- <!--i:cpu--> **`lolly_transform`** (uruchamia narzędzie działające na urządzeniu po stronie
  serwera, w imieniu wywołującego agenta), **`lolly_verify`** (sprawdza Content Credentials)
  i **`lolly_redact`** (zaczernia fragmenty obrazu lub pliku PDF) - wszystkie
  przyjmują od wywołującego bajty pliku. Są przetwarzane **w tym samym procesie, w
  pamięci**, a wynik jest zwracany w tym samym wywołaniu - plik nigdy nie jest
  zapisywany na dysku i nigdy nie jest przechowywany po zakończeniu żądania.
- <!--i:checklist--> Każde inne narzędzie - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - działa wyłącznie na parametrach (tekst, liczby, kolory,
  adresy URL, identyfikatory zasobów katalogu), czyli tych samych danych
  wejściowych, jakie przyjmuje bezpośrednio linkowany adres URL renderowania.
- <!--i:lock--> Dostęp odbywa się albo za pomocą tokenu współdzielonego, który operator wydaje
  zaufanym klientom, albo za pomocą bezstanowego OAuth 2.1: krótkotrwałe podpisane
  tokeny weryfikowane wobec współdzielonego sekretu, nic nie jest przechowywane po
  stronie serwera, a sam token nigdy nie trafia do logu ani do adresu URL
  renderowania.

## Tożsamość Content Credentials (logowanie, które musisz rozpocząć sam)

Lolly może zapieczętować kryptograficzny **Content Credential** w Twoich eksportach, dzięki czemu
każdy może offline zweryfikować, że plik nie został zmieniony od czasu, gdy opuścił Lolly. To
**jest domyślnie włączone i w pełni lokalne** - klucz podpisujący jest generowany na Twoim urządzeniu,
a samo podpisywanie odbywa się offline. Bez rejestracji ten klucz jest jednorazowy:
świeża para kluczy jest tworzona dla każdego eksportu i porzucana razem z nim. Po zarejestrowaniu się
klucz staje się trwały i jest generowany jako **nieeksportowalny** - nawet własny kod Lolly
nie może go odczytać, może jedynie poprosić go o podpisanie. Tak czy inaczej nigdy nie opuszcza
Twojego urządzenia. Ta sekcja opisuje ten jeden *opcjonalny* krok ponad to:
zarejestrowanie zweryfikowanej tożsamości, dzięki czemu Twoje eksporty mówią "Verified - signed by
\<your email\>" zamiast anonimowego klucza. **Jeśli pominiesz rejestrację, nic w
tej sekcji Cię nie dotyczy i żadne dane osobowe nigdy nie opuszczają Twojego urządzenia.**

![Karta zweryfikowanej tożsamości na stronie profilu, szerokość telefonu: wybór czasu życia certyfikatu i krok rejestracji poniżej, nieaktywne, dopóki sam ich nie uruchomisz](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Jeśli się zarejestrujesz, oto dokładnie, co się dzieje:

1. **Wybierasz metodę logowania** - GitHub, Google, SUSE (id.suse.com) lub link
   wysłany e-mailem. Dla trzech dostawców OIDC zostajesz przekierowany na stronę
   logowania tego dostawcy, rządzoną jego własną polityką prywatności, nie naszą.
   Usługa certyfikatów Lolly otrzymuje z powrotem jedynie zweryfikowany adres
   e-mail i nazwę dostawcy. W przypadku linku e-mailowego wpisany przez ciebie
   adres jest przekazywany do **Resend**, transakcyjnego API do wysyłki e-maili,
   wyłącznie po to, by dostarczyć ten jeden link.
2. **Krótkotrwały plik cookie chroni przekierowanie.** To jedyny plik cookie, jaki
   ustawia cały system Lolly: `lolly_ca_state`, `HttpOnly`, ograniczony do
   `/api/ca`, wygasający w ciągu dziesięciu minut. Zawiera losową wartość, nie
   identyfikator śledzący, i istnieje wyłącznie po to, by uniemożliwić
   sfałszowanie przekierowania OAuth. Jest usuwany, gdy tylko logowanie się
   zakończy.
3. **Twój adres IP jest krótko wykorzystywany, aby zapobiec nadużyciom** punktów
   końcowych logowania (żeby jeden skrypt nie mógł zasypać skrzynki spamem ani
   wyczerpać limitu wysyłki e-maili) - przechowywany wyłącznie w pamięci serwera,
   w przesuwnym oknie czasowym trwającym około minuty, nigdy nie zapisywany w
   logu ani nigdzie utrwalany.
4. **Usługa certyfikatów wystawia krótkotrwały certyfikat** (7, 30, 90 lub 365
   dni, do wyboru, ograniczone polityką operatora), wiążący twój zweryfikowany
   adres e-mail z publiczną połową pary kluczy wygenerowanej na twoim urządzeniu.
   Prywatna połowa nigdy nie opuszcza twojej przeglądarki.
5. **Nic dotyczącego wystawienia nie jest rejestrowane.** Usługa certyfikatów nie
   prowadzi żadnego dziennika wystawień: ani twojego e-maila, ani dostawcy, ani
   numeru seryjnego, ani znacznika czasu. Żadnej bazy danych, żadnej linii logu,
   żadnego webhooka. Twój adres e-mail istnieje w żądaniu tylko tak długo, by
   zostać zapisany w certyfikacie, który otrzymuje twoje własne urządzenie, a
   potem znika po naszej stronie całkowicie.
6. **Po tym podpisywanie znów odbywa się offline** przez cały okres ważności
   certyfikatu. Eksportowanie pliku nigdy nie kontaktuje się z usługą
   certyfikatów - kontaktowała się z nią tylko rejestracja.

**Kompromis wprost.** Wcześniejsza wersja tej usługi rejestrowała każde wystawienie,
aby błędnie wystawiony lub przejęty certyfikat można było wyśledzić. Usunęliśmy to,
ponieważ ten dziennik był jedynym miejscem w całym Lolly, gdzie dane osobowe
spoczywały na serwerze, a wolimy ich nie przechowywać niż przechowywać starannie. To,
z czego rezygnujemy, to możliwość śledzenia po stronie serwera: jeśli certyfikat
zostanie nadużyty, nie możemy sprawdzić, kto go uzyskał. Certyfikaty są z założenia
krótkotrwałe - od 7 do 365 dni, do wyboru, ograniczone przez operatora - i wygasają
same, co jest środkiem zaradczym, na którym polegamy zamiast tego. Osoby hostujące
Lolly samodzielnie, których własne obowiązki wymagają dziennika audytu, mogą go
dodać i tym samym stają się administratorem tych danych.

## Rozszerzenie przeglądarki

Rozszerzenie przeglądarki **Lolly URL Screenshot** nie zbiera, nie przechowuje ani
nie przesyła żadnych danych osobowych. Bez analityki, bez śledzenia, bez zdalnego
serwera.

**Co robi.** Gdy poprosisz aplikację webową Lolly o zrzut ekranu adresu URL,
rozszerzenie otwiera tę stronę w tymczasowej karcie w tle, przechwytuje ją w twojej
przeglądarce za pomocą DevTools Protocol, przekazuje obraz z powrotem do aplikacji i
zamyka kartę. Wszystko dzieje się lokalnie, na twoim własnym urządzeniu i w twojej
sieci.

**Dane.**

- <!--i:shieldcheck--> **Nie zbieramy niczego.** Rozszerzenie nie ma żadnych serwerów i samo nie
  wykonuje żadnych zapytań sieciowych.
- <!--i:photos--> **Przechwycone obrazy** trafiają bezpośrednio do aplikacji Lolly w tej samej
  przeglądarce - rozszerzenie nigdy ich nie przesyła.
- <!--i:link--> **Adresy URL, które przechwytujesz**, są używane wyłącznie do wczytania tej
  jednej strony na potrzeby tego jednego zrzutu ekranu. Nie są logowane ani
  udostępniane.

**Uprawnienia.**

- <!--i:wrench--> **`debugger`** - do przechwytywania wyrenderowanej strony za pomocą DevTools
  Protocol (ten sam mechanizm, którego używa aplikacja desktopowa Lolly).
- <!--i:monitor--> **`tabs`** - do otwierania i zamykania tymczasowej karty, w której wczytuje się
  strona.
- <!--i:globe--> **Dostęp do hostów (`<all_urls>`)** - ponieważ strona, którą wybierzesz do
  przechwycenia, może znajdować się na dowolnej witrynie. Chrome pokazuje to przy
  instalacji jako szerokie ostrzeżenie o uprawnieniach. Rozszerzenie odwiedza
  wyłącznie adres URL, który mu podasz.

Żadne z nich nie jest wykorzystywane do odczytywania, monitorowania ani przesyłania
twojej aktywności w przeglądarce poza tym jednym zażądanym przechwyceniem.

## Logi infrastruktury

Jak każda strona internetowa, serwery stojące za lolly.tools - i za każdym
wdrożeniem Lolly - generują standardowe logi dostępu serwera webowego za każdym
razem, gdy w ogóle dotrze do nich żądanie: adres IP, żądana ścieżka, znacznik czasu,
agent użytkownika. To podstawowe zachowanie hostingu, nie coś, co Lolly dodaje od
siebie, i nigdy nie zawiera ono treści twoich dokumentów, ponieważ te w ogóle nigdy
nie docierają do serwera. Jedynym celowym wyjątkiem jest plik, który jawnie
przekazujesz do wywołania MCP `lolly_transform`, `lolly_verify` lub `lolly_redact`,
przetwarzany w pamięci i nigdy niezapisywany na dysku ani w logu, jak opisano
powyżej.

**Własny kod Lolly nic nie zapisuje w tych logach.** Serwer MCP w ogóle nie
zawiera żadnych instrukcji logujących. Usługa certyfikatów zapisuje dokładnie dwie
linie, obie tylko przy niepowodzeniu i obie celowo pozbawione danych: kod statusu
niepowodzenia wysyłki bez adresu odbiorcy oraz komunikat błędu bez śladu stosu czy
adresu URL (ślad stosu mógłby zawierać token rejestracji). Wszystko inne w logu
należy do platformy hostingowej, nie do nas.

W przypadku lolly.tools hostingiem jest Vercel, a przechowywanie logów dostępu
podlega domyślnym ustawieniom platformy Vercel dla naszego planu. Nie konfigurujemy
żadnego odpływu logów, żadnego długoterminowego eksportu logów ani żadnego produktu
do analityki czy monitorowania ponad to. Sami nie przechowujemy kopii tych logów, co
oznacza również, że nie mamy możliwości przeszukania ich dla ciebie - zobacz
[Twoje prawa](#your-rights).

## Podstawy prawne, okres przechowywania i odbiorcy

Niemal nic tutaj nie wymaga podstawy prawnej, ponieważ niemal nic nie jest przetwarzane. Dla
kompletności, cała lista:

| Przetwarzanie | Podstawa prawna (RODO art. 6) | Okres przechowywania |
|---|---|---|
| Wszystko na Twoim urządzeniu (dokumenty, preferencje, pamięć podręczna, liczniki) | **W ogóle nie jest to nasze przetwarzanie** - nigdy do nas nie dociera. Przechowywanie na Twoim urządzeniu jest ściśle niezbędne do świadczenia usługi, o którą poprosiłeś (dyrektywa ePrivacy art. 5(3)), więc nie wymaga zgody | Do momentu usunięcia przez Ciebie |
| Twój adres e-mail podczas rejestracji w Content Credentials | **Art. 6(1)(b)**, wykonanie usługi, o którą wyraźnie poprosiłeś | Nie jest przechowywany. Obecny w pamięci wyłącznie na czas trwania żądania |
| Twój adres IP na punktach logowania, w celu ograniczania liczby żądań | **Art. 6(1)(f)**, nasz prawnie uzasadniony interes w zapobieganiu nadużyciom bezpłatnej usługi oraz limitu wiadomości e-mail strony trzeciej. Uznajemy, że spełnia to test równowagi interesów, ponieważ dane znajdują się wyłącznie w pamięci, nigdy nie są zapisywane i są usuwane w ciągu około minuty | ~1 minuta, w pamięci serwera, nigdy nie utrwalane |
| Dzienniki dostępu hostingu (IP, ścieżka, znacznik czasu, user agent) | **Art. 6(1)(f)**, nasz prawnie uzasadniony interes w bezpieczeństwie usługi, zapobieganiu nadużyciom i diagnozowaniu awarii | Domyślny okres platformy Vercel dla naszego planu. Nie dodajemy żadnego eksportu ani odpływu danych |

**Odbiorcy.** Kategorie odbiorców to: nasz dostawca hostingu (Vercel
Inc.) oraz - wyłącznie jeśli korzystasz z opcji logowania e-mailem - dostawca
transakcyjnej poczty e-mail (Resend). Jeśli logujesz się przez GitHub, Google lub SUSE (id.suse.com),
kontaktujesz się z tym dostawcą bezpośrednio, na podstawie jego własnej polityki prywatności. Przekazuje
nam on zweryfikowany adres e-mail i nic więcej. Nie udostępniamy danych osobowych nikomu
innemu i nie sprzedajemy danych, nie prowadzimy reklam ani nie profilujemy użytkowników.

**Przekazywanie danych poza EOG.** Vercel i Resend są firmami amerykańskimi. Przetwarzanie funkcji
dla lolly.tools jest przypisane do regionu Vercel we Frankfurcie (`fra1`) więc
przetwarzanie odbywa się w UE, jednak jako dostawcy z siedzibą w USA mogą oni nadal
uzyskiwać dostęp do danych jako podmioty przetwarzające z terytorium USA. Te transfery opierają się na
standardowych klauzulach umownych Komisji Europejskiej i/lub na ramach
EU-US Data Privacy Framework, zgodnie z umową powierzenia przetwarzania danych każdego z
dostawców. Ponieważ dane osobowe docierające do każdego z dostawców są tak ograniczone
- adres e-mail przekazywany w celu wysłania jednej wiadomości oraz zwykłe dzienniki
dostępu - narażenie jest odpowiednio niewielkie.

**Zautomatyzowane podejmowanie decyzji.** Brak. Nie ma profilowania ani zautomatyzowanych decyzji
wywołujących skutki prawne lub podobnie istotne (art. 22).

## Prywatność dzieci

Lolly świadomie nie zbiera danych osobowych od nikogo, w żadnym wieku, w toku zwykłego korzystania z
aplikacji - nie ma niczego do zebrania. Jedynym miejscem, w którym w ogóle gromadzone są
dane osobowe (adres e-mail), jest rejestracja w Content Credentials, opisana powyżej, która nie jest
kierowana do dzieci ani im przeznaczona.

## Twoje prawa

Ponieważ niemal wszystko, czego dotyka Lolly, jest przechowywane wyłącznie na Twoim własnym
urządzeniu, większość tego, co prawo o ochronie danych nazywa "Twoimi prawami" -
dostęp, poprawianie, usuwanie, przenoszenie - możesz już wykonać sam, natychmiast,
bez pytania kogokolwiek: Twoje dane znajdują się w pamięci przeglądarki, w formie, którą możesz przejrzeć,
wyeksportować (**Export my data & render everything**, powyżej) lub usunąć (**Profile → Clear all
my data**).

Formalnie, na mocy artykułów 15-22 RODO masz prawo do **dostępu** do swoich
danych osobowych, do ich **sprostowania**, do ich **usunięcia**, do **ograniczenia** lub **wniesienia
sprzeciwu** wobec ich przetwarzania (w tym sprzeciwu wobec wszystkiego, co opieramy na prawnie uzasadnionym
interesie), do **przenoszenia danych** oraz - gdy przetwarzanie opiera się na zgodzie - do
**wycofania tej zgody w dowolnym momencie**, bez wpływu na zgodność z prawem tego, co
miało miejsce przed jej wycofaniem.

Oto uczciwe stanowisko w sprawie egzekwowania tych praw wobec nas. Ponieważ nie prowadzimy już
dziennika wydawania, **nie posiadamy żadnych danych osobowych na Twój temat, które moglibyśmy wyszukać,
poprawić, wyeksportować lub usunąć.** Jeśli napiszesz i zapytasz, co o Tobie mamy, prawdziwa
odpowiedź brzmi: nic, i tak właśnie odpowiemy. Jedyną kategorią, która w ogóle istnieje, są
dzienniki dostępu hostingu powiązane z adresem IP, przechowywane przez naszego dostawcę hostingu zgodnie
z jego domyślnym okresem przechowywania. Nie mamy możliwości przeszukiwania ani selektywnego usuwania
tych danych i powiemy Ci to wprost, zamiast udawać inaczej. Wszystko, co rzeczywiście jest
*Twoje*, znajduje się na Twoim urządzeniu, gdzie możesz to już odczytać, wyeksportować
i zniszczyć bez pytania kogokolwiek o pozwolenie.

**Masz prawo złożyć skargę.** Jeśli uważasz, że nieprawidłowo obchodziliśmy się z Twoimi
danymi, możesz złożyć skargę do organu nadzorczego ds. ochrony danych
- w UE jest to organ w Twoim kraju zamieszkania, miejscu pracy lub tam, gdzie Twoim zdaniem
doszło do naruszenia (art. 77). Naszym wiodącym organem nadzorczym jest *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA)
w Ansbach, w Niemczech. Nie musisz najpierw kontaktować się z nami, choć chcielibyśmy mieć
szansę to naprawić.

Nie sprzedajemy danych. Nie mamy żadnych do sprzedania.

## Zmiany w niniejszej polityce

Data na górze zmienia się za każdym razem, gdy zmienia się ten dokument. Zmiana, która wpływa na
to, co opuszcza Twoje urządzenie lub co jest przechowywane, otrzymuje tutaj własną linijkę, a nie cichą
edycję - jeśli chcesz zobaczyć, co się zmieniło, zapytaj (poniżej) lub porównaj z
[publicznym źródłem](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Kto ponosi odpowiedzialność i jak się z nami skontaktować

**Administratorem danych** dla lolly.tools jest:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Niemcy

SUSE wyznaczyło **Inspektora Ochrony Danych**, dostępnego pod adresem
[privacy@suse.com](mailto:privacy@suse.com). Użyj tego adresu w przypadku każdego formalnego
żądania w ramach sekcji "Twoje prawa" powyżej.

W sprawie wszystkiego, co dotyczy samego Lolly - jak to działa, dlaczego coś jest zrobione w taki sposób lub
w sprawie poprawki do tego dokumentu - skontaktuj się z **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

W przypadku instancji Lolly hostowanej samodzielnie lub w wersji enterprise skontaktuj się zamiast tego
z podmiotem, który ją obsługuje: operator jest administratorem danych dla swojego własnego
wdrożenia. SUSE i projekt open source Lolly nie posiadają żadnych danych dotyczących wdrożeń, którymi nie zarządzają.
